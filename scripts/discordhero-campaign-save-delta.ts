import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  DiscordHeroCampaignSaveDeltaDiscoveryError,
  evaluateCampaignSaveDeltaDiscovery,
  redactCampaignSaveDeltaDiscoveryError,
  type CampaignSaveDeltaDiscoveryReport,
} from "../src/discord-hero/oracles/campaign-save-delta-discovery";

const SNAPSHOT_FORMAT = "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1";
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_FILE = "encrypted-save.es3";
const MANIFEST_FILE = "manifest.json";
const MANIFEST_FIELDS = [
  "format",
  "version",
  "label",
  "capturedAt",
  "bytes",
  "sha256",
  "snapshotFile",
] as const;

interface CampaignSaveDeltaArguments {
  readonly beforeDir: string;
  readonly afterDir: string;
  readonly beforeLabel: string;
  readonly afterLabel: string;
  readonly capturedAt: string;
}

interface CompletedCapture {
  readonly realDirectory: string;
  readonly encryptedBytes: Uint8Array;
  readonly sha256: string;
  readonly label: string;
  readonly capturedAt: string;
}

const OPTION_NAMES = [
  "--before-dir",
  "--after-dir",
  "--before-label",
  "--after-label",
  "--captured-at",
] as const;
const CANONICAL_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_CAPTURE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function invalidArguments(): never {
  throw new DiscordHeroCampaignSaveDeltaDiscoveryError("invalid_arguments");
}

function captureFailed(): never {
  throw new DiscordHeroCampaignSaveDeltaDiscoveryError("capture_failed");
}

function invalidLabel(): never {
  throw new DiscordHeroCampaignSaveDeltaDiscoveryError("invalid_label");
}

function parseArguments(args: readonly string[]): CampaignSaveDeltaArguments {
  if (args.length !== OPTION_NAMES.length * 2) invalidArguments();
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      option === undefined ||
      !OPTION_NAMES.includes(option as (typeof OPTION_NAMES)[number]) ||
      value === undefined ||
      value.length === 0 ||
      value.startsWith("--") ||
      values.has(option)
    ) {
      invalidArguments();
    }
    values.set(option, value);
  }
  if (values.size !== OPTION_NAMES.length) invalidArguments();

  const beforeLabel = values.get("--before-label")!;
  const afterLabel = values.get("--after-label")!;
  const capturedAt = values.get("--captured-at")!;
  if (
    beforeLabel.length > 96 ||
    afterLabel.length > 96 ||
    !CANONICAL_LABEL.test(beforeLabel) ||
    !CANONICAL_LABEL.test(afterLabel) ||
    beforeLabel === afterLabel
  ) {
    invalidLabel();
  }
  if (
    !CANONICAL_CAPTURE_TIME.test(capturedAt) ||
    !Number.isFinite(Date.parse(capturedAt))
  ) {
    invalidArguments();
  }
  const canonical = new Date(capturedAt).toISOString().replace(/\.000Z$/, "Z");
  if (
    capturedAt !== canonical &&
    capturedAt !== canonical.replace(/Z$/, ".000Z")
  ) {
    invalidArguments();
  }

  return {
    beforeDir: values.get("--before-dir")!,
    afterDir: values.get("--after-dir")!,
    beforeLabel,
    afterLabel,
    capturedAt,
  };
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameStableMetadata(before: BigIntStats, after: BigIntStats): boolean {
  return (
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.mode === after.mode &&
    before.nlink === after.nlink &&
    before.uid === after.uid &&
    before.gid === after.gid &&
    before.rdev === after.rdev &&
    before.size === after.size &&
    before.mtimeNs === after.mtimeNs &&
    before.ctimeNs === after.ctimeNs
  );
}

function isPathInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
  );
}

async function assertRealDirectoryOutsideProject(
  directoryPath: string,
  projectRoot: string,
): Promise<string> {
  let metadata: BigIntStats;
  try {
    metadata = await lstat(directoryPath, { bigint: true });
  } catch {
    captureFailed();
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    captureFailed();
  }

  let realDirectory: string;
  let projectRealPath: string;
  try {
    realDirectory = await realpath(directoryPath);
    projectRealPath = await realpath(projectRoot);
  } catch {
    captureFailed();
  }

  let resolvedMetadata: BigIntStats;
  try {
    resolvedMetadata = await lstat(realDirectory, { bigint: true });
  } catch {
    captureFailed();
  }
  if (resolvedMetadata.isSymbolicLink() || !resolvedMetadata.isDirectory()) {
    captureFailed();
  }
  if (isPathInside(projectRealPath, realDirectory)) {
    captureFailed();
  }
  return realDirectory;
}

async function readStableRegularFile(filePath: string): Promise<{
  readonly bytes: Buffer;
  readonly sha256: string;
}> {
  let firstMetadata: BigIntStats;
  let firstBytes: Buffer;
  try {
    firstMetadata = await lstat(filePath, { bigint: true });
    if (firstMetadata.isSymbolicLink() || !firstMetadata.isFile()) {
      captureFailed();
    }
    firstBytes = await readFile(filePath);
  } catch (error) {
    if (error instanceof DiscordHeroCampaignSaveDeltaDiscoveryError)
      throw error;
    captureFailed();
  }

  let secondMetadata: BigIntStats;
  let secondBytes: Buffer;
  try {
    secondMetadata = await lstat(filePath, { bigint: true });
    if (secondMetadata.isSymbolicLink() || !secondMetadata.isFile()) {
      captureFailed();
    }
    secondBytes = await readFile(filePath);
  } catch (error) {
    if (error instanceof DiscordHeroCampaignSaveDeltaDiscoveryError)
      throw error;
    captureFailed();
  }

  const firstSha256 = sha256Hex(firstBytes);
  const secondSha256 = sha256Hex(secondBytes);
  if (
    !sameStableMetadata(firstMetadata, secondMetadata) ||
    firstMetadata.size !== BigInt(firstBytes.byteLength) ||
    secondMetadata.size !== BigInt(secondBytes.byteLength) ||
    firstSha256 !== secondSha256 ||
    !firstBytes.equals(secondBytes)
  ) {
    captureFailed();
  }
  return { bytes: secondBytes, sha256: secondSha256 };
}

function parseCompletedManifest(raw: string): {
  readonly label: string;
  readonly capturedAt: string;
  readonly bytes: number;
  readonly sha256: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    captureFailed();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    captureFailed();
  }
  const record = parsed as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(record);
  if (ownKeys.some((key) => typeof key !== "string")) {
    captureFailed();
  }
  if (ownKeys.length !== MANIFEST_FIELDS.length) {
    captureFailed();
  }
  for (const field of MANIFEST_FIELDS) {
    if (!Object.hasOwn(record, field)) captureFailed();
    const descriptor = Object.getOwnPropertyDescriptor(record, field);
    if (
      descriptor === undefined ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      captureFailed();
    }
  }
  for (const key of ownKeys as string[]) {
    if (!(MANIFEST_FIELDS as readonly string[]).includes(key)) {
      captureFailed();
    }
  }

  if (record.format !== SNAPSHOT_FORMAT) captureFailed();
  if (record.version !== SNAPSHOT_VERSION) captureFailed();
  if (record.snapshotFile !== SNAPSHOT_FILE) captureFailed();
  if (
    typeof record.label !== "string" ||
    record.label.length === 0 ||
    record.label.length > 96 ||
    !CANONICAL_LABEL.test(record.label)
  ) {
    captureFailed();
  }
  if (
    typeof record.capturedAt !== "string" ||
    !CANONICAL_CAPTURE_TIME.test(record.capturedAt) ||
    !Number.isFinite(Date.parse(record.capturedAt))
  ) {
    captureFailed();
  }
  if (
    typeof record.bytes !== "number" ||
    !Number.isSafeInteger(record.bytes) ||
    record.bytes < 1
  ) {
    captureFailed();
  }
  if (typeof record.sha256 !== "string" || !SHA256_HEX.test(record.sha256)) {
    captureFailed();
  }

  return {
    label: record.label,
    capturedAt: record.capturedAt,
    bytes: record.bytes,
    sha256: record.sha256,
  };
}

async function loadCompletedCaptureDirectory(
  directoryPath: string,
  projectRoot: string,
  expectedLabel: string,
): Promise<CompletedCapture> {
  if (directoryPath.length === 0) invalidArguments();
  // Reject relative path ambiguity: require absolute paths at the CLI boundary.
  if (!isAbsolute(directoryPath)) {
    invalidArguments();
  }
  const realDirectory = await assertRealDirectoryOutsideProject(
    directoryPath,
    projectRoot,
  );

  const encryptedPath = join(realDirectory, SNAPSHOT_FILE);
  const manifestPath = join(realDirectory, MANIFEST_FILE);

  const [encrypted, manifestFile] = await Promise.all([
    readStableRegularFile(encryptedPath),
    readStableRegularFile(manifestPath),
  ]);

  const manifest = parseCompletedManifest(manifestFile.bytes.toString("utf8"));
  if (manifest.label !== expectedLabel) {
    captureFailed();
  }
  if (manifest.bytes !== encrypted.bytes.byteLength) {
    captureFailed();
  }
  if (manifest.sha256 !== encrypted.sha256) {
    captureFailed();
  }

  return {
    realDirectory,
    encryptedBytes: Uint8Array.from(encrypted.bytes),
    sha256: encrypted.sha256,
    label: manifest.label,
    capturedAt: manifest.capturedAt,
  };
}

export async function runDiscordHeroCampaignSaveDeltaCommand(
  args: readonly string[],
  options?: Readonly<{ projectRoot?: string }>,
): Promise<CampaignSaveDeltaDiscoveryReport> {
  const parsed = parseArguments(args);
  const projectRoot = resolve(
    options?.projectRoot ?? join(import.meta.dir, ".."),
  );

  const [beforeCapture, afterCapture] = await Promise.all([
    loadCompletedCaptureDirectory(
      parsed.beforeDir,
      projectRoot,
      parsed.beforeLabel,
    ),
    loadCompletedCaptureDirectory(
      parsed.afterDir,
      projectRoot,
      parsed.afterLabel,
    ),
  ]);

  if (beforeCapture.realDirectory === afterCapture.realDirectory) {
    invalidArguments();
  }

  const report = await evaluateCampaignSaveDeltaDiscovery({
    beforeEncrypted: beforeCapture.encryptedBytes,
    afterEncrypted: afterCapture.encryptedBytes,
    beforeLabel: beforeCapture.label,
    afterLabel: afterCapture.label,
    capturedAt: parsed.capturedAt,
  });
  if (report.status !== "DISCOVERY") {
    captureFailed();
  }
  return report;
}

if (import.meta.main) {
  try {
    const report = await runDiscordHeroCampaignSaveDeltaCommand(
      process.argv.slice(2),
    );
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(redactCampaignSaveDeltaDiscoveryError(error))}\n`,
    );
    process.exitCode = 1;
  }
}
