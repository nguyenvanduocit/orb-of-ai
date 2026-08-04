import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  stat,
  writeFile,
} from "node:fs/promises";
import { hostname } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import {
  CURRENT_VERSION_FILE,
  createDiscordHeroSourceLock,
  MONSTER_DETAILS_SHA256,
  resolveCurrentRawSource,
  serializeSourceLock,
  sha256,
  SOURCE_CATALOG_SHA256,
  SOURCE_LOCK_SHA256,
  SOURCE_MANIFEST_PATH,
  SOURCE_MANIFEST_SHA256,
  validateRawSourceDirectory,
} from "./compiler";

const DEFAULT_SOURCE_ORIGIN = "https://taskbarhero.wiki";
const PROMOTION_LOCK_FILE = ".discordhero-promotion-lock.sqlite";
const STAGE_LEASE_FILE = ".discordhero-stage-lease.json";
const LOCK_RETRY_TIMEOUT_MS = 30_000;
const LOCK_RETRY_INTERVAL_MS = 10;
const UNLEASED_STAGE_GRACE_MS = 60_000;

interface RefreshDataset {
  data_url: string;
  sha256: string;
}

interface RefreshManifest {
  catalog_inventory: {
    sha256: string;
    entries: Array<{ name: string }>;
  };
  datasets: RefreshDataset[];
}

export type PromotionStep =
  | "validated-stage"
  | "materialized-version"
  | "prepared-pointer"
  | "switched-current-link"
  | "switched-pointer";

interface PromotionOptions {
  onPromotionStep?: (step: PromotionStep) => void | Promise<void>;
}

interface StageLease {
  format: "discordhero-stage-lease/v1";
  hostname: string;
  pid: number;
  token: string;
}

function fail(message: string): never {
  throw new Error(`DiscordHero source refresh: ${message}`);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

function isSqliteBusy(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_BUSY"
  );
}

async function withPromotionLock<T>(
  destinationDirectory: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = join(destinationDirectory, PROMOTION_LOCK_FILE);
  const deadline = Date.now() + LOCK_RETRY_TIMEOUT_MS;
  let database: Database | undefined;

  while (database === undefined) {
    const candidate = new Database(lockPath, { create: true, strict: true });
    try {
      candidate.exec("PRAGMA busy_timeout = 0");
      candidate.exec("BEGIN IMMEDIATE");
      database = candidate;
    } catch (error) {
      candidate.close();
      if (!isSqliteBusy(error) || Date.now() >= deadline) {
        if (isSqliteBusy(error)) {
          fail("timed out waiting for the promotion lock");
        }
        throw error;
      }
      await Bun.sleep(LOCK_RETRY_INTERVAL_MS);
    }
  }

  try {
    return await operation();
  } finally {
    try {
      database.exec("ROLLBACK");
    } finally {
      database.close();
    }
  }
}

function isStageLease(value: unknown): value is StageLease {
  return (
    typeof value === "object" &&
    value !== null &&
    "format" in value &&
    value.format === "discordhero-stage-lease/v1" &&
    "hostname" in value &&
    typeof value.hostname === "string" &&
    "pid" in value &&
    typeof value.pid === "number" &&
    Number.isInteger(value.pid) &&
    value.pid > 0 &&
    "token" in value &&
    typeof value.token === "string" &&
    value.token.length > 0
  );
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EPERM"
    );
  }
}

async function ensureStageLease(stagedDirectory: string): Promise<StageLease> {
  const leasePath = join(stagedDirectory, STAGE_LEASE_FILE);
  try {
    const existing: unknown = JSON.parse(await readFile(leasePath, "utf8"));
    if (isStageLease(existing)) {
      if (existing.hostname === hostname() && existing.pid === process.pid) {
        return existing;
      }
      if (existing.hostname !== hostname() || isProcessAlive(existing.pid)) {
        fail(
          `staged source is owned by another live refresh: ${stagedDirectory}`,
        );
      }
    }
  } catch (error) {
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) &&
      error instanceof Error &&
      error.message.startsWith("DiscordHero source refresh:")
    ) {
      throw error;
    }
  }

  const lease: StageLease = {
    format: "discordhero-stage-lease/v1",
    hostname: hostname(),
    pid: process.pid,
    token: randomUUID(),
  };
  const temporaryLeasePath = join(
    stagedDirectory,
    `.discordhero-stage-lease-${lease.token}`,
  );
  try {
    await writeFile(temporaryLeasePath, `${JSON.stringify(lease)}\n`, "utf8");
    await rename(temporaryLeasePath, leasePath);
  } finally {
    await rm(temporaryLeasePath, { force: true });
  }
  return lease;
}

async function collectStalePromotionArtifacts(
  destinationDirectory: string,
  activeStage: string,
): Promise<void> {
  const entries = await readdir(destinationDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(destinationDirectory, entry.name);
    if (entry.name.startsWith(".discordhero-current-")) {
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink() || metadata.isFile()) {
        await rm(path, { force: true });
      }
      continue;
    }
    if (
      !entry.name.startsWith(".discordhero-raw-stage-") ||
      path === activeStage ||
      !entry.isDirectory()
    ) {
      continue;
    }
    const metadata = await lstat(path);
    let lease: unknown;
    try {
      lease = JSON.parse(await readFile(join(path, STAGE_LEASE_FILE), "utf8"));
    } catch {
      lease = undefined;
    }
    const abandonedWithoutLease =
      !isStageLease(lease) &&
      Date.now() - metadata.mtimeMs >= UNLEASED_STAGE_GRACE_MS;
    const abandonedByDeadOwner =
      isStageLease(lease) &&
      lease.hostname === hostname() &&
      !isProcessAlive(lease.pid);
    if (abandonedWithoutLease || abandonedByDeadOwner) {
      await rm(path, { recursive: true });
    }
  }
}

async function reconcileCompatibilityCurrent(
  destinationDirectory: string,
  currentSource: string,
): Promise<void> {
  const currentPath = join(destinationDirectory, "current");
  const versionPointer = `versions/${basename(currentSource)}`;
  let currentMatchesAuthority = false;
  try {
    const metadata = await lstat(currentPath);
    currentMatchesAuthority =
      metadata.isSymbolicLink() &&
      (await readlink(currentPath)) === versionPointer &&
      (await realpath(currentPath)) === currentSource;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code !== "ENOENT" && code !== "EINVAL" && code !== "ELOOP") {
      throw error;
    }
  }
  if (currentMatchesAuthority) {
    return;
  }

  const recoveryPointer = join(
    destinationDirectory,
    `.discordhero-current-reconcile-${randomUUID()}`,
  );
  await symlink(versionPointer, recoveryPointer);
  await rename(recoveryPointer, currentPath);

  const reconciledMetadata = await lstat(currentPath);
  if (
    !reconciledMetadata.isSymbolicLink() ||
    (await readlink(currentPath)) !== versionPointer ||
    (await realpath(currentPath)) !== currentSource
  ) {
    fail(
      "reconciled current link does not match authoritative current-version",
    );
  }
}

async function preparePromotionDestination(
  projectRoot: string,
  destinationDirectory: string,
  activeStage: string,
): Promise<string> {
  const currentSource = await resolveCurrentRawSource(destinationDirectory);
  await validateRawSourceDirectory(projectRoot, currentSource);
  await reconcileCompatibilityCurrent(destinationDirectory, currentSource);
  await collectStalePromotionArtifacts(destinationDirectory, activeStage);
  return currentSource;
}

async function fetchPinnedBytes(
  url: URL,
  expectedSha256: string,
  label: string,
): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        fail(`${label} returned HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const actualSha256 = sha256(bytes);
      if (actualSha256 !== expectedSha256) {
        fail(
          `${label} SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}`,
        );
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        error.message.includes("SHA-256 mismatch")
      ) {
        throw error;
      }
    }
  }
  fail(
    `${label} fetch failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function extractMonsterDetails(
  projectRoot: string,
  stagedDirectory: string,
): Promise<void> {
  const markdownDirectory = join(
    projectRoot,
    "preferences/taskbarhero/monsters",
  );
  const outputDirectory = join(stagedDirectory, "monster-details");
  await mkdir(outputDirectory, { recursive: true });
  const markdownFiles = (await readdir(markdownDirectory))
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();
  if (markdownFiles.length !== 61) {
    fail(
      `expected 61 monster detail Markdown files, received ${markdownFiles.length}`,
    );
  }

  const monsterKeys = new Set<number>();
  for (const fileName of markdownFiles) {
    const markdown = await readFile(join(markdownDirectory, fileName), "utf8");
    const markerIndex = markdown.indexOf("### `/data/monsters.json`");
    if (markerIndex === -1) {
      fail(`${fileName} has no /data/monsters.json appendix`);
    }
    const appendix = markdown.slice(markerIndex);
    const match = appendix.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (match === null) {
      fail(`${fileName} has no JSON appendix body`);
    }
    const bytes = `${match[1]}\n`;
    let record: unknown;
    try {
      record = JSON.parse(bytes);
    } catch (error) {
      fail(`${fileName} appendix is invalid JSON: ${String(error)}`);
    }
    if (
      typeof record !== "object" ||
      record === null ||
      Array.isArray(record) ||
      !("MonsterKey" in record) ||
      typeof record.MonsterKey !== "number" ||
      !Number.isInteger(record.MonsterKey)
    ) {
      fail(`${fileName} appendix has an invalid MonsterKey`);
    }
    if (monsterKeys.has(record.MonsterKey)) {
      fail(`monster appendix key ${record.MonsterKey} repeats`);
    }
    monsterKeys.add(record.MonsterKey);
    await writeFile(
      join(outputDirectory, `${record.MonsterKey}.json`),
      bytes,
      "utf8",
    );
  }
}

const STAGE_BOX_INVENTORY_ROW =
  /^\| \[([^\]]+)\]\((items\/[^)]+\.md)\) \| ([^|]+?) \| ([1-9]\d*) \|$/gm;

const STAGE_BOX_ITEM_KEYS = [
  "affix",
  "gear",
  "grade",
  "icon",
  "id",
  "level",
  "name",
  "slug",
  "type",
];

const STAGE_BOX_DETAIL_KEYS = [
  "desc",
  "dropKey",
  "stats",
  "synthType",
  "uniqueMod",
];

const STAGE_BOX_KIND_PREFIXES = [
  ["Normal Monster Box", "NORMAL"],
  ["Stage Boss Box", "STAGE_BOSS"],
  ["Act Boss Box", "ACT_BOSS"],
] as const;

function readStageBoxAppendix(
  markdown: string,
  dataset: string,
  label: string,
): string {
  const heading = "### `" + dataset + "`";
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex === -1) {
    fail(`${label} has no ${dataset} appendix`);
  }
  if (markdown.indexOf(heading, headingIndex + 1) !== -1) {
    fail(`${label} has more than one ${dataset} appendix`);
  }
  const match = markdown
    .slice(headingIndex)
    .match(/```json\r?\n([\s\S]*?)\r?\n```/);
  if (match === null) {
    fail(`${label} has no ${dataset} appendix body`);
  }
  return match[1]!;
}

/**
 * Captures the DropKey each Stage Box rolls from. DropKey is read from the
 * source record and never computed: 18 retired boxes keep their own item id
 * while pointing at a surviving box's table, so any arithmetic rule is wrong
 * for those 18.
 */
async function extractStageBoxDropKeys(
  projectRoot: string,
  stagedDirectory: string,
): Promise<void> {
  const taskbarHeroRoot = join(projectRoot, "preferences/taskbarhero");
  const inventoryMarkdown = await readFile(
    join(taskbarHeroRoot, "stage-boxes.md"),
    "utf8",
  );
  const inventory = [
    ...inventoryMarkdown.matchAll(STAGE_BOX_INVENTORY_ROW),
  ].map((match) => ({
    itemId: Number(match[4]),
    sourcePath: match[2]!,
    slug: match[3]!.trim(),
  }));
  if (inventory.length !== 59) {
    fail(`expected 59 Stage Box inventory rows, received ${inventory.length}`);
  }
  for (const [label, read] of [
    ["item ID", (row: (typeof inventory)[number]) => String(row.itemId)],
    ["slug", (row: (typeof inventory)[number]) => row.slug],
    ["source path", (row: (typeof inventory)[number]) => row.sourcePath],
  ] as const) {
    if (new Set(inventory.map(read)).size !== inventory.length) {
      fail(`Stage Box inventory repeats a ${label}`);
    }
  }

  const rawItems = JSON.parse(
    await readFile(join(stagedDirectory, "datasets", "items.json"), "utf8"),
  ) as { id: number; slug: string; type: string }[];
  const rawItemsById = new Map(rawItems.map((row) => [row.id, row]));

  const mappings = [];
  for (const row of inventory) {
    if (!/^items\/[A-Za-z0-9._-]+\.md$/.test(row.sourcePath)) {
      fail(`Stage Box page ${row.sourcePath} is not a plain items child`);
    }
    const markdown = await readFile(
      join(taskbarHeroRoot, row.sourcePath),
      "utf8",
    );
    const itemBytes = readStageBoxAppendix(
      markdown,
      "/data/items.json",
      row.sourcePath,
    );
    const detailBytes = readStageBoxAppendix(
      markdown,
      "/data/items_detail.json",
      row.sourcePath,
    );

    let item: Record<string, unknown>;
    let detail: Record<string, unknown>;
    try {
      item = JSON.parse(itemBytes) as Record<string, unknown>;
      detail = JSON.parse(detailBytes) as Record<string, unknown>;
    } catch (error) {
      fail(`${row.sourcePath} appendix is invalid JSON: ${String(error)}`);
    }

    // 41 pages carry the nine base keys; the 18 retired boxes add `deleted`.
    const itemKeys = Object.keys(item).filter((key) => key !== "deleted");
    if (
      itemKeys.length !== STAGE_BOX_ITEM_KEYS.length ||
      itemKeys.some((key, index) => key !== STAGE_BOX_ITEM_KEYS[index])
    ) {
      fail(`${row.sourcePath} item record has unexpected keys`);
    }
    if ("deleted" in item && typeof item.deleted !== "boolean") {
      fail(`${row.sourcePath} item record has a non-boolean deleted flag`);
    }
    const detailKeys = Object.keys(detail);
    if (
      detailKeys.length !== STAGE_BOX_DETAIL_KEYS.length ||
      detailKeys.some((key, index) => key !== STAGE_BOX_DETAIL_KEYS[index])
    ) {
      fail(`${row.sourcePath} detail record has unexpected keys`);
    }

    const name = (item.name as Record<string, unknown> | null)?.["en-US"];
    if (typeof name !== "string" || name.length === 0) {
      fail(`${row.sourcePath} has no en-US item name`);
    }
    if (item.id !== row.itemId || item.slug !== row.slug) {
      fail(`${row.sourcePath} disagrees with the inventory row`);
    }
    if (item.type !== "STAGEBOX") {
      fail(`${row.sourcePath} is not a STAGEBOX item`);
    }
    const rawItem = rawItemsById.get(row.itemId);
    if (
      rawItem === undefined ||
      rawItem.slug !== row.slug ||
      rawItem.type !== "STAGEBOX"
    ) {
      fail(`${row.sourcePath} does not match the staged items dataset`);
    }
    const dropKey = detail.dropKey;
    if (
      typeof dropKey !== "number" ||
      !Number.isSafeInteger(dropKey) ||
      dropKey < 1
    ) {
      fail(`${row.sourcePath} has an invalid dropKey`);
    }
    const kind = STAGE_BOX_KIND_PREFIXES.find(([prefix]) =>
      name.startsWith(prefix),
    );
    if (kind === undefined) {
      fail(`${row.sourcePath} has an unclassified box name ${name}`);
    }

    mappings.push({
      boxKind: kind[1],
      itemId: row.itemId,
      dropKey,
      sourcePath: row.sourcePath,
      itemRecordSha256: sha256(JSON.stringify(item)),
      detailRecordSha256: sha256(JSON.stringify(detail)),
    });
  }

  const artifact = {
    format: "discordhero-stage-box-drop-keys/v1" as const,
    inventoryAggregateSha256: sha256(JSON.stringify(inventory)),
    mappings: mappings.toSorted((left, right) => left.itemId - right.itemId),
  };
  const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
  if (Buffer.byteLength(bytes) > 64 * 1024) {
    fail("Stage Box aggregate exceeds its 64 KiB bound");
  }
  await writeFile(
    join(stagedDirectory, "stage-box-drop-keys.json"),
    bytes,
    "utf8",
  );
}

async function downloadRawSource(
  projectRoot: string,
  stagedDirectory: string,
  sourceOrigin: string,
): Promise<void> {
  const manifestBytes = await readFile(
    join(projectRoot, SOURCE_MANIFEST_PATH),
    "utf8",
  );
  if (sha256(manifestBytes) !== SOURCE_MANIFEST_SHA256) {
    fail("local source manifest does not match its reviewed SHA-256 pin");
  }
  const manifest = JSON.parse(manifestBytes) as RefreshManifest;
  if (manifest.catalog_inventory.sha256 !== SOURCE_CATALOG_SHA256) {
    fail("manifest catalog SHA-256 does not match its reviewed pin");
  }
  if (
    manifest.datasets.length !== 45 ||
    manifest.catalog_inventory.entries.length !== 45
  ) {
    fail("manifest must contain exactly 45 datasets");
  }

  await mkdir(join(stagedDirectory, "datasets"), { recursive: true });
  const catalogBytes = await fetchPinnedBytes(
    new URL("/data/catalog.json", sourceOrigin),
    SOURCE_CATALOG_SHA256,
    "/data/catalog.json",
  );
  await writeFile(join(stagedDirectory, "catalog.json"), catalogBytes);

  for (const [index, entry] of manifest.catalog_inventory.entries.entries()) {
    const metadata = manifest.datasets[index];
    if (metadata === undefined) {
      fail(`manifest metadata is missing ${entry.name}`);
    }
    const bytes = await fetchPinnedBytes(
      new URL(metadata.data_url, sourceOrigin),
      metadata.sha256,
      metadata.data_url,
    );
    await writeFile(
      join(stagedDirectory, "datasets", `${entry.name}.json`),
      bytes,
    );
  }

  await extractMonsterDetails(projectRoot, stagedDirectory);
  await extractStageBoxDropKeys(projectRoot, stagedDirectory);
  const sourceLock = await createDiscordHeroSourceLock(
    projectRoot,
    stagedDirectory,
  );
  await writeFile(
    join(stagedDirectory, "source-lock.json"),
    serializeSourceLock(sourceLock),
    "utf8",
  );
}

export async function installValidatedRawSource(
  projectRoot: string,
  stagedDirectory: string,
  options: PromotionOptions = {},
): Promise<void> {
  const resolvedProjectRoot = await realpath(resolve(projectRoot));
  if (resolvedProjectRoot === parse(resolvedProjectRoot).root) {
    fail("project root cannot be a filesystem root");
  }
  const destinationDirectory = join(
    resolvedProjectRoot,
    "preferences/taskbarhero/raw-data",
  );
  const resolvedDestination = await realpath(destinationDirectory);
  const resolvedStage = await realpath(stagedDirectory);
  if (
    dirname(resolvedStage) !== resolvedDestination ||
    !basename(resolvedStage).startsWith(".discordhero-raw-stage-")
  ) {
    fail(
      "staged source must be a direct child of preferences/taskbarhero/raw-data",
    );
  }

  await ensureStageLease(resolvedStage);
  try {
    await withPromotionLock(resolvedDestination, async () => {
      const currentSource = await preparePromotionDestination(
        resolvedProjectRoot,
        resolvedDestination,
        resolvedStage,
      );
      const currentPath = join(resolvedDestination, "current");
      const currentVersionPath = join(
        resolvedDestination,
        CURRENT_VERSION_FILE,
      );
      const versionsDirectory = join(resolvedDestination, "versions");
      const promotionToken = randomUUID();
      const temporaryPointer = join(
        resolvedDestination,
        `.discordhero-current-link-${promotionToken}`,
      );
      const temporaryVersionPointer = join(
        resolvedDestination,
        `.discordhero-current-version-${promotionToken}`,
      );
      const rollbackPointer = join(
        resolvedDestination,
        `.discordhero-current-rollback-${promotionToken}`,
      );
      let versionPointer: string | undefined;
      let versionDirectory: string | undefined;
      let createdVersion = false;
      let switchedCurrentLink = false;
      let switchedPointer = false;
      try {
        const previousVersionPointer = `versions/${basename(currentSource)}`;
        const stagedSource = await validateRawSourceDirectory(
          resolvedProjectRoot,
          resolvedStage,
        );
        const verifiedLockSha256 = sha256(stagedSource.sourceLockBytes);
        if (verifiedLockSha256 !== SOURCE_LOCK_SHA256) {
          fail(
            `source lock SHA-256 does not match the reviewed pin: ${verifiedLockSha256}`,
          );
        }
        if (
          stagedSource.sourceLock.monsterDetails.aggregateSha256 !==
          MONSTER_DETAILS_SHA256
        ) {
          fail(
            `monster detail aggregate SHA-256 does not match the reviewed pin: ${stagedSource.sourceLock.monsterDetails.aggregateSha256}`,
          );
        }
        versionPointer = `versions/${verifiedLockSha256}`;
        versionDirectory = join(resolvedDestination, versionPointer);
        await options.onPromotionStep?.("validated-stage");

        await mkdir(versionsDirectory, { recursive: true });
        if (await pathExists(versionDirectory)) {
          await rm(join(versionDirectory, STAGE_LEASE_FILE), { force: true });
          await validateRawSourceDirectory(
            resolvedProjectRoot,
            versionDirectory,
          );
          await rm(resolvedStage, { recursive: true });
        } else {
          await rename(resolvedStage, versionDirectory);
          createdVersion = true;
          await rm(join(versionDirectory, STAGE_LEASE_FILE), { force: true });
        }
        await options.onPromotionStep?.("materialized-version");

        await symlink(versionPointer, temporaryPointer);
        await writeFile(temporaryVersionPointer, `${versionPointer}\n`, "utf8");
        await symlink(previousVersionPointer, rollbackPointer);
        await options.onPromotionStep?.("prepared-pointer");

        await rename(temporaryPointer, currentPath);
        switchedCurrentLink = true;
        await options.onPromotionStep?.("switched-current-link");

        await rename(temporaryVersionPointer, currentVersionPath);
        switchedPointer = true;
        await rm(rollbackPointer, { force: true });
        const resolvedCurrent =
          await resolveCurrentRawSource(resolvedDestination);
        if (resolvedCurrent !== versionDirectory) {
          fail(
            `promoted current pointer resolved to unexpected version ${resolvedCurrent}`,
          );
        }
        await validateRawSourceDirectory(resolvedProjectRoot, resolvedCurrent);
        await options.onPromotionStep?.("switched-pointer");
      } catch (error) {
        let promotionError = error;
        if (switchedCurrentLink && !switchedPointer) {
          try {
            await rename(rollbackPointer, currentPath);
            switchedCurrentLink = false;
          } catch (rollbackError) {
            promotionError = new AggregateError(
              [error, rollbackError],
              "DiscordHero source refresh: failed to restore current after an interrupted promotion",
            );
          }
        }
        await Promise.all([
          rm(temporaryPointer, { force: true }),
          rm(temporaryVersionPointer, { force: true }),
          rm(rollbackPointer, { force: true }),
        ]);
        if (await pathExists(resolvedStage)) {
          await rm(resolvedStage, { recursive: true });
        }
        if (
          createdVersion &&
          !switchedPointer &&
          !switchedCurrentLink &&
          versionPointer !== undefined &&
          versionDirectory !== undefined
        ) {
          await rm(versionDirectory, { recursive: true });
        }
        throw promotionError;
      }
    });
  } catch (error) {
    if (await pathExists(resolvedStage)) {
      await rm(resolvedStage, { recursive: true });
    }
    throw error;
  }
}

export async function refreshDiscordHeroRawSource(
  projectRoot: string,
  options: { sourceOrigin?: string } = {},
): Promise<{ sourceLockSha256: string; monsterDetailsSha256: string }> {
  const resolvedProjectRoot = await realpath(resolve(projectRoot));
  const destinationDirectory = join(
    resolvedProjectRoot,
    "preferences/taskbarhero/raw-data",
  );
  const resolvedDestination = await realpath(destinationDirectory);
  const stagedDirectory = await withPromotionLock(
    resolvedDestination,
    async () => {
      await preparePromotionDestination(
        resolvedProjectRoot,
        resolvedDestination,
        "",
      );
      const staged = await mkdtemp(
        join(resolvedDestination, ".discordhero-raw-stage-"),
      );
      try {
        await ensureStageLease(staged);
        return staged;
      } catch (error) {
        await rm(staged, { recursive: true, force: true });
        throw error;
      }
    },
  );

  try {
    await downloadRawSource(
      projectRoot,
      stagedDirectory,
      options.sourceOrigin ?? DEFAULT_SOURCE_ORIGIN,
    );
    const sourceLockBytes = await readFile(
      join(stagedDirectory, "source-lock.json"),
      "utf8",
    );
    const sourceLock = JSON.parse(sourceLockBytes) as {
      monsterDetails: { aggregateSha256: string };
    };
    const result = {
      sourceLockSha256: sha256(sourceLockBytes),
      monsterDetailsSha256: sourceLock.monsterDetails.aggregateSha256,
    };
    if (
      result.sourceLockSha256 !== SOURCE_LOCK_SHA256 ||
      result.monsterDetailsSha256 !== MONSTER_DETAILS_SHA256
    ) {
      fail(
        `refreshed source differs from reviewed pins: source lock ${result.sourceLockSha256}, monster details ${result.monsterDetailsSha256}`,
      );
    }
    await installValidatedRawSource(resolvedProjectRoot, stagedDirectory);
    return result;
  } finally {
    if (await pathExists(stagedDirectory)) {
      await rm(stagedDirectory, { recursive: true, force: true });
    }
  }
}
