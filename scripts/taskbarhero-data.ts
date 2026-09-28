import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The TaskbarHero source snapshot (preferences/taskbarhero + assets/discordhero)
// is third-party data, so it lives in a private release instead of this public
// repo. The lock file pins exactly which release asset the code was built on.

const projectRoot = resolve(import.meta.dir, "..");
const lockPath = resolve(projectRoot, "taskbarhero-data.lock.json");
const SNAPSHOT_DIRS = ["preferences/taskbarhero", "assets/discordhero"];
// Runtime state written by source-refresh.ts — never part of a snapshot.
const RUNTIME_FILES = [
  ".discordhero-promotion-lock.sqlite",
  ".discordhero-stage-lease.json",
  ".DS_Store",
];

interface SnapshotLock {
  repo: string;
  tag: string;
  asset: string;
  sha256: string;
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.join(" ")} exited with ${code}`);
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function readLock(): Promise<SnapshotLock> {
  return JSON.parse(await readFile(lockPath, "utf8")) as SnapshotLock;
}

async function isPopulated(dir: string): Promise<boolean> {
  const entries = await readdir(resolve(projectRoot, dir)).catch(() => []);
  return entries.length > 0;
}

async function fetchSnapshot(force: boolean): Promise<void> {
  const lock = await readLock();
  const populated = [];
  for (const dir of SNAPSHOT_DIRS) {
    if (await isPopulated(dir)) populated.push(dir);
  }
  if (populated.length > 0 && !force) {
    throw new Error(
      `${populated.join(", ")} already populated — rerun with --force to replace it`,
    );
  }

  const workDir = await mkdtemp(join(tmpdir(), "taskbarhero-data-"));
  try {
    await run([
      "gh", "release", "download", lock.tag,
      "--repo", lock.repo,
      "--pattern", lock.asset,
      "--dir", workDir,
    ]);
    const archive = join(workDir, lock.asset);
    const actual = await sha256File(archive);
    if (actual !== lock.sha256) {
      throw new Error(`${lock.asset} sha256 ${actual} ≠ pinned ${lock.sha256}`);
    }
    for (const dir of SNAPSHOT_DIRS) {
      await rm(resolve(projectRoot, dir), { recursive: true, force: true });
    }
    await run(["tar", "-xzf", archive, "-C", projectRoot]);
    console.log(`fetched | ${lock.repo}@${lock.tag} | ${lock.sha256}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function publishSnapshot(): Promise<void> {
  const lock = await readLock();
  for (const dir of SNAPSHOT_DIRS) {
    if (!(await isPopulated(dir))) throw new Error(`${dir} is empty — nothing to publish`);
  }

  const workDir = await mkdtemp(join(tmpdir(), "taskbarhero-data-"));
  try {
    const archive = join(workDir, lock.asset);
    const tarball = archive.replace(/\.gz$/, "");
    await run([
      "tar", "-cf", tarball,
      ...RUNTIME_FILES.map((name) => `--exclude=${name}`),
      ...SNAPSHOT_DIRS,
    ]);
    // gzip -n drops the header timestamp, so identical data packs to an
    // identical sha256 and an unchanged snapshot is never re-published.
    await run(["gzip", "-n", tarball]);
    const sha256 = await sha256File(archive);
    if (sha256 === lock.sha256) {
      console.log(`unchanged | ${lock.repo}@${lock.tag}`);
      return;
    }
    const tag = `snapshot-${sha256.slice(0, 12)}`;
    await run([
      "gh", "release", "create", tag, archive,
      "--repo", lock.repo,
      "--title", `TaskbarHero snapshot ${sha256.slice(0, 12)}`,
      "--notes", SNAPSHOT_DIRS.join(" + "),
    ]);
    const next: SnapshotLock = { ...lock, tag, sha256 };
    await writeFile(lockPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`published | ${lock.repo}@${tag} | ${sha256} — commit taskbarhero-data.lock.json`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function runTaskbarHeroDataCommand(args: string[]): Promise<void> {
  const [mode, ...rest] = args;
  const force = rest.includes("--force");
  const unknown = rest.filter((arg) => arg !== "--force");
  if (unknown.length > 0) {
    throw new Error(`Unexpected TaskbarHero data arguments: ${unknown.join(" ")}`);
  }
  if (mode === "--fetch") {
    await fetchSnapshot(force);
    return;
  }
  if (mode === "--publish") {
    await publishSnapshot();
    return;
  }
  throw new Error(`Unknown TaskbarHero data mode: ${mode ?? "(none)"} — use --fetch or --publish`);
}

if (import.meta.main) {
  await runTaskbarHeroDataCommand(process.argv.slice(2));
}
