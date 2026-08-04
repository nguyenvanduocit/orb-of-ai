import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectories: string[] = [];
const PROJECT_ROOT = join(import.meta.dir, "..");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "discordhero-save-snapshot-cli-"));
  temporaryDirectories.push(root);
  const output = join(root, "captures");
  const source = join(root, "private-SaveFile_Live.es3");
  const sourceBytes = Uint8Array.from([222, 173, 190, 239, 0, 44, 91, 10]);
  await Promise.all([mkdir(output), writeFile(source, sourceBytes)]);
  return { root, output, source, sourceBytes };
}

async function runCli(args: readonly string[]) {
  const child = Bun.spawn(
    [process.execPath, "run", "discordhero:oracle:save:snapshot", ...args],
    {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("DiscordHero encrypted-save snapshot CLI", () => {
  test("prints one redacted JSON result and creates one private snapshot", async () => {
    const input = await fixture();

    const result = await runCli([
      "--label",
      "before-pet-1001-to-1002",
      "--output",
      input.output,
      "--source",
      input.source,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
      status: "SNAPSHOT_CREATED",
      label: "before-pet-1001-to-1002",
      bytes: input.sourceBytes.byteLength,
      snapshotFile: "encrypted-save.es3",
      manifestFile: "manifest.json",
    });
    expect(result.stdout).not.toContain(input.root);
    expect(result.stdout).not.toContain(input.source);
    expect(result.stdout).not.toContain(input.output);
    const captures = await readdir(input.output);
    expect(captures).toEqual([report.captureDirectory]);
    expect(
      await readFile(
        join(input.output, report.captureDirectory, report.snapshotFile),
      ),
    ).toEqual(Buffer.from(input.sourceBytes));
  });

  test("prints only static path-free JSON on a filesystem failure", async () => {
    const input = await fixture();
    const secretPath = join(
      input.root,
      "customer-password-private-missing-save.es3",
    );

    const result = await runCli([
      "--label",
      "before-pet-change",
      "--output",
      input.output,
      "--source",
      secretPath,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
      status: "FAIL",
      error: {
        code: "source_invalid",
        message: "Encrypted-save source must be a regular file.",
      },
    });
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(result.stderr).not.toContain(secretPath);
    expect(result.stderr).not.toContain(input.root);
    expect(result.stderr).not.toContain("password");
    expect(result.stderr).not.toContain('"bytes"');
    expect(result.stderr).not.toContain(String(input.sourceBytes.byteLength));
  });

  test("rejects malformed, duplicate, and prototype-shaped arguments", async () => {
    for (const args of [
      [],
      ["--label", "before", "--output"],
      [
        "--label",
        "before",
        "--label",
        "after",
        "--output",
        "/private/captures",
      ],
      [
        "--label",
        "before",
        "--output",
        "/private/captures",
        "--__proto__",
        "polluted",
      ],
      [
        "--label",
        "--output",
        "/private/captures",
        "--source",
        "/private/save.es3",
      ],
    ]) {
      const result = await runCli(args);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr)).toEqual({
        format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
        status: "FAIL",
        error: {
          code: "invalid_arguments",
          message: "Encrypted-save snapshot arguments are invalid.",
        },
      });
    }
  });
});
