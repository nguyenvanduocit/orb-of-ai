import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  sep,
  win32,
} from "node:path";

const SNAPSHOT_FORMAT = "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1";
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_FILE = "encrypted-save.es3";
const MANIFEST_FILE = "manifest.json";
const CANONICAL_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type EncryptedSaveSnapshotErrorCode =
  | "capture_failed"
  | "invalid_arguments"
  | "invalid_label"
  | "output_changed"
  | "output_identity_unavailable"
  | "output_inside_project"
  | "output_invalid"
  | "source_changed"
  | "source_invalid"
  | "source_required";

const ERROR_MESSAGES = {
  capture_failed: "Encrypted-save snapshot failed.",
  invalid_arguments: "Encrypted-save snapshot arguments are invalid.",
  invalid_label: "Snapshot label must be canonical kebab-case.",
  output_changed: "Snapshot output changed during capture.",
  output_identity_unavailable:
    "Snapshot output identity is unavailable on this filesystem.",
  output_inside_project: "Snapshot output must be outside the project.",
  output_invalid: "Snapshot output must be an existing real directory.",
  source_changed: "Encrypted-save source changed during capture.",
  source_invalid: "Encrypted-save source must be a regular file.",
  source_required: "Encrypted-save source is required on this platform.",
} as const satisfies Record<EncryptedSaveSnapshotErrorCode, string>;

export class DiscordHeroEncryptedSaveSnapshotError extends Error {
  constructor(readonly code: EncryptedSaveSnapshotErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "DiscordHeroEncryptedSaveSnapshotError";
  }
}

export interface EncryptedSaveSourceResolverInput {
  readonly sourcePath?: string;
  readonly platform: NodeJS.Platform;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export interface SnapshotDirectoryIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
}

export type SnapshotDirectoryIdentityProbe = (
  kind: "output" | "capture",
  actual: SnapshotDirectoryIdentity,
) => SnapshotDirectoryIdentity;

export interface CreateEncryptedSaveSnapshotInput extends EncryptedSaveSourceResolverInput {
  readonly label: string;
  readonly outputDirectory: string;
  readonly projectRoot: string;
  readonly now?: () => Date;
  readonly afterFirstRead?: () => void | Promise<void>;
  readonly beforeManifestWrite?: () => void | Promise<void>;
  readonly directoryIdentityProbe?: SnapshotDirectoryIdentityProbe;
}

export interface EncryptedSaveSnapshotResult {
  readonly format: typeof SNAPSHOT_FORMAT;
  readonly status: "SNAPSHOT_CREATED";
  readonly label: string;
  readonly capturedAt: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly captureDirectory: string;
  readonly snapshotFile: typeof SNAPSHOT_FILE;
  readonly manifestFile: typeof MANIFEST_FILE;
}

export interface EncryptedSaveSnapshotDiagnostic {
  readonly format: typeof SNAPSHOT_FORMAT;
  readonly status: "FAIL";
  readonly error: {
    readonly code: EncryptedSaveSnapshotErrorCode;
    readonly message: string;
  };
}

interface StableEncryptedSave {
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

interface OutputDirectoryBinding {
  readonly realPath: string;
  readonly projectRealPath: string;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly identityProbe?: SnapshotDirectoryIdentityProbe;
}

interface CaptureDirectoryBinding {
  readonly realPath: string;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly output: OutputDirectoryBinding;
}

export function resolveTaskbarHeroEncryptedSaveSource(
  input: EncryptedSaveSourceResolverInput,
): string {
  if (input.sourcePath !== undefined && input.sourcePath.length > 0) {
    return input.sourcePath;
  }
  const userProfile = Object.hasOwn(input.environment, "USERPROFILE")
    ? input.environment.USERPROFILE
    : undefined;
  if (input.platform === "win32" && userProfile) {
    return win32.join(
      userProfile,
      "AppData",
      "LocalLow",
      "TesseractStudio",
      "TaskbarHero",
      "SaveFile_Live.es3",
    );
  }
  throw new DiscordHeroEncryptedSaveSnapshotError("source_required");
}

function sha256(bytes: Uint8Array): string {
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

async function readStableEncryptedSave(
  sourcePath: string,
  afterFirstRead?: () => void | Promise<void>,
): Promise<StableEncryptedSave> {
  let firstMetadata: BigIntStats;
  let firstBytes: Buffer;
  try {
    firstMetadata = await lstat(sourcePath, { bigint: true });
    if (firstMetadata.isSymbolicLink() || !firstMetadata.isFile()) {
      throw new DiscordHeroEncryptedSaveSnapshotError("source_invalid");
    }
    firstBytes = await readFile(sourcePath);
  } catch (error) {
    if (error instanceof DiscordHeroEncryptedSaveSnapshotError) {
      throw error;
    }
    throw new DiscordHeroEncryptedSaveSnapshotError("source_invalid");
  }

  if (afterFirstRead !== undefined) {
    try {
      await afterFirstRead();
    } catch {
      throw new DiscordHeroEncryptedSaveSnapshotError("capture_failed");
    }
  }

  let secondMetadata: BigIntStats;
  let secondBytes: Buffer;
  try {
    secondMetadata = await lstat(sourcePath, { bigint: true });
    if (secondMetadata.isSymbolicLink() || !secondMetadata.isFile()) {
      throw new DiscordHeroEncryptedSaveSnapshotError("source_changed");
    }
    secondBytes = await readFile(sourcePath);
  } catch (error) {
    if (error instanceof DiscordHeroEncryptedSaveSnapshotError) {
      throw error;
    }
    throw new DiscordHeroEncryptedSaveSnapshotError("source_changed");
  }

  const firstSha256 = sha256(firstBytes);
  const secondSha256 = sha256(secondBytes);
  if (
    !sameStableMetadata(firstMetadata, secondMetadata) ||
    firstMetadata.size !== BigInt(firstBytes.byteLength) ||
    secondMetadata.size !== BigInt(secondBytes.byteLength) ||
    firstSha256 !== secondSha256 ||
    !firstBytes.equals(secondBytes)
  ) {
    throw new DiscordHeroEncryptedSaveSnapshotError("source_changed");
  }
  return {
    bytes: Uint8Array.from(secondBytes),
    sha256: secondSha256,
  };
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

function directoryIdentity(
  kind: "output" | "capture",
  metadata: BigIntStats,
  probe?: SnapshotDirectoryIdentityProbe,
): SnapshotDirectoryIdentity {
  const actual = { dev: metadata.dev, ino: metadata.ino };
  if (actual.ino <= 0n) {
    throw new DiscordHeroEncryptedSaveSnapshotError(
      "output_identity_unavailable",
    );
  }
  const observed = probe?.(kind, actual) ?? actual;
  if (
    typeof observed.dev !== "bigint" ||
    typeof observed.ino !== "bigint" ||
    observed.ino <= 0n ||
    observed.dev !== actual.dev ||
    observed.ino !== actual.ino
  ) {
    throw new DiscordHeroEncryptedSaveSnapshotError(
      "output_identity_unavailable",
    );
  }
  return { dev: observed.dev, ino: observed.ino };
}

function sameDirectoryIdentity(
  metadata: BigIntStats,
  identity: SnapshotDirectoryIdentity,
  kind: "output" | "capture",
  probe?: SnapshotDirectoryIdentityProbe,
): boolean {
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    return false;
  }
  const observed = directoryIdentity(kind, metadata, probe);
  return observed.dev === identity.dev && observed.ino === identity.ino;
}

function captureIdentityIsDistinct(
  capture: SnapshotDirectoryIdentity,
  output: SnapshotDirectoryIdentity,
): boolean {
  return capture.dev !== output.dev || capture.ino !== output.ino;
}

function rethrowOutputChange(error: unknown): never {
  if (
    error instanceof DiscordHeroEncryptedSaveSnapshotError &&
    error.code === "output_identity_unavailable"
  ) {
    throw error;
  }
  throw new DiscordHeroEncryptedSaveSnapshotError("output_changed");
}

async function bindOutputDirectory(
  outputDirectory: string,
  projectRoot: string,
  identityProbe?: SnapshotDirectoryIdentityProbe,
): Promise<OutputDirectoryBinding> {
  let outputMetadata: BigIntStats;
  let resolvedMetadata: BigIntStats;
  let outputIdentity: SnapshotDirectoryIdentity;
  let resolvedIdentity: SnapshotDirectoryIdentity;
  let resolvedOutput: string;
  let resolvedProject: string;
  try {
    outputMetadata = await lstat(outputDirectory, { bigint: true });
    if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
      throw new DiscordHeroEncryptedSaveSnapshotError("output_invalid");
    }
    [resolvedOutput, resolvedProject] = await Promise.all([
      realpath(outputDirectory),
      realpath(projectRoot),
    ]);
    resolvedMetadata = await lstat(resolvedOutput, { bigint: true });
    outputIdentity = directoryIdentity("output", outputMetadata, identityProbe);
    resolvedIdentity = directoryIdentity(
      "output",
      resolvedMetadata,
      identityProbe,
    );
    if (
      resolvedMetadata.isSymbolicLink() ||
      !resolvedMetadata.isDirectory() ||
      resolvedIdentity.dev !== outputIdentity.dev ||
      resolvedIdentity.ino !== outputIdentity.ino
    ) {
      throw new DiscordHeroEncryptedSaveSnapshotError("output_invalid");
    }
  } catch (error) {
    if (error instanceof DiscordHeroEncryptedSaveSnapshotError) {
      throw error;
    }
    throw new DiscordHeroEncryptedSaveSnapshotError("output_invalid");
  }
  if (isPathInside(resolvedProject, resolvedOutput)) {
    throw new DiscordHeroEncryptedSaveSnapshotError("output_inside_project");
  }
  return {
    realPath: resolvedOutput,
    projectRealPath: resolvedProject,
    dev: resolvedIdentity.dev,
    ino: resolvedIdentity.ino,
    identityProbe,
  };
}

async function revalidateOutputDirectory(
  binding: OutputDirectoryBinding,
): Promise<void> {
  try {
    const before = await lstat(binding.realPath, { bigint: true });
    const currentRealPath = await realpath(binding.realPath);
    const after = await lstat(binding.realPath, { bigint: true });
    const identity = { dev: binding.dev, ino: binding.ino };
    if (
      !sameDirectoryIdentity(
        before,
        identity,
        "output",
        binding.identityProbe,
      ) ||
      !sameDirectoryIdentity(
        after,
        identity,
        "output",
        binding.identityProbe,
      ) ||
      currentRealPath !== binding.realPath ||
      isPathInside(binding.projectRealPath, currentRealPath)
    ) {
      throw new DiscordHeroEncryptedSaveSnapshotError("output_changed");
    }
  } catch (error) {
    rethrowOutputChange(error);
  }
}

async function bindCaptureDirectory(
  captureDirectory: string,
  output: OutputDirectoryBinding,
): Promise<CaptureDirectoryBinding> {
  try {
    const before = await lstat(captureDirectory, { bigint: true });
    const captureRealPath = await realpath(captureDirectory);
    const after = await lstat(captureDirectory, { bigint: true });
    const beforeIdentity = directoryIdentity(
      "capture",
      before,
      output.identityProbe,
    );
    const afterIdentity = directoryIdentity(
      "capture",
      after,
      output.identityProbe,
    );
    await revalidateOutputDirectory(output);
    if (!captureIdentityIsDistinct(afterIdentity, output)) {
      throw new DiscordHeroEncryptedSaveSnapshotError(
        "output_identity_unavailable",
      );
    }
    if (
      before.isSymbolicLink() ||
      !before.isDirectory() ||
      after.isSymbolicLink() ||
      !after.isDirectory() ||
      beforeIdentity.dev !== afterIdentity.dev ||
      beforeIdentity.ino !== afterIdentity.ino ||
      captureRealPath !== captureDirectory ||
      dirname(captureRealPath) !== output.realPath ||
      isPathInside(output.projectRealPath, captureRealPath)
    ) {
      throw new DiscordHeroEncryptedSaveSnapshotError("output_changed");
    }
    return {
      realPath: captureRealPath,
      dev: afterIdentity.dev,
      ino: afterIdentity.ino,
      output,
    };
  } catch (error) {
    rethrowOutputChange(error);
  }
}

async function revalidateCaptureDirectory(
  binding: CaptureDirectoryBinding,
): Promise<void> {
  try {
    await revalidateOutputDirectory(binding.output);
    const before = await lstat(binding.realPath, { bigint: true });
    const captureRealPath = await realpath(binding.realPath);
    const after = await lstat(binding.realPath, { bigint: true });
    const identity = { dev: binding.dev, ino: binding.ino };
    if (
      !sameDirectoryIdentity(
        before,
        identity,
        "capture",
        binding.output.identityProbe,
      ) ||
      !sameDirectoryIdentity(
        after,
        identity,
        "capture",
        binding.output.identityProbe,
      ) ||
      !captureIdentityIsDistinct(identity, binding.output) ||
      captureRealPath !== binding.realPath ||
      dirname(captureRealPath) !== binding.output.realPath ||
      isPathInside(binding.output.projectRealPath, captureRealPath)
    ) {
      throw new DiscordHeroEncryptedSaveSnapshotError("output_changed");
    }
    await revalidateOutputDirectory(binding.output);
  } catch (error) {
    rethrowOutputChange(error);
  }
}

async function removeCaptureDirectoryIfStillOwned(
  binding: CaptureDirectoryBinding,
): Promise<void> {
  try {
    await revalidateCaptureDirectory(binding);
  } catch {
    // A no-manifest directory is safer than deleting through a replaced path.
    return;
  }
  await rm(binding.realPath, { recursive: true, force: true }).catch(
    () => undefined,
  );
}

function canonicalCaptureTime(now: Date): string {
  if (!Number.isFinite(now.getTime())) {
    throw new DiscordHeroEncryptedSaveSnapshotError("capture_failed");
  }
  return now.toISOString();
}

function captureDirectoryPrefix(
  capturedAt: string,
  label: string,
  digest: string,
): string {
  const compactTime = capturedAt
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(".", "");
  return `${compactTime}--${label}--${digest.slice(0, 12)}--`;
}

function snapshotManifest(input: {
  readonly label: string;
  readonly capturedAt: string;
  readonly bytes: number;
  readonly sha256: string;
}): string {
  return `${JSON.stringify(
    {
      format: SNAPSHOT_FORMAT,
      version: SNAPSHOT_VERSION,
      label: input.label,
      capturedAt: input.capturedAt,
      bytes: input.bytes,
      sha256: input.sha256,
      snapshotFile: SNAPSHOT_FILE,
    },
    null,
    2,
  )}\n`;
}

export async function createDiscordHeroEncryptedSaveSnapshot(
  input: CreateEncryptedSaveSnapshotInput,
): Promise<EncryptedSaveSnapshotResult> {
  if (input.label.length > 64 || !CANONICAL_LABEL.test(input.label)) {
    throw new DiscordHeroEncryptedSaveSnapshotError("invalid_label");
  }

  const sourcePath = resolveTaskbarHeroEncryptedSaveSource(input);
  const output = await bindOutputDirectory(
    input.outputDirectory,
    input.projectRoot,
    input.directoryIdentityProbe,
  );
  const stableSave = await readStableEncryptedSave(
    sourcePath,
    input.afterFirstRead,
  );
  await revalidateOutputDirectory(output);
  const capturedAt = canonicalCaptureTime((input.now ?? (() => new Date()))());
  const captureDirectoryPrefixValue = captureDirectoryPrefix(
    capturedAt,
    input.label,
    stableSave.sha256,
  );
  let captureBinding: CaptureDirectoryBinding | undefined;

  try {
    const captureDirectory = await mkdtemp(
      join(output.realPath, captureDirectoryPrefixValue),
    );
    captureBinding = await bindCaptureDirectory(captureDirectory, output);
    await chmod(captureBinding.realPath, 0o700);
    await revalidateCaptureDirectory(captureBinding);
    const captureSnapshot = join(captureBinding.realPath, SNAPSHOT_FILE);
    const captureManifest = join(captureBinding.realPath, MANIFEST_FILE);
    await writeFile(captureSnapshot, stableSave.bytes, {
      flag: "wx",
      mode: 0o600,
    });
    await chmod(captureSnapshot, 0o600);
    let boundaryFailed = false;
    if (input.beforeManifestWrite !== undefined) {
      try {
        await input.beforeManifestWrite();
      } catch {
        boundaryFailed = true;
      }
    }
    await revalidateCaptureDirectory(captureBinding);
    if (boundaryFailed) {
      throw new DiscordHeroEncryptedSaveSnapshotError("capture_failed");
    }
    await writeFile(
      captureManifest,
      snapshotManifest({
        label: input.label,
        capturedAt,
        bytes: stableSave.bytes.byteLength,
        sha256: stableSave.sha256,
      }),
      { flag: "wx", mode: 0o600 },
    );
    await chmod(captureManifest, 0o600);
    await revalidateCaptureDirectory(captureBinding);
  } catch (error) {
    if (captureBinding !== undefined) {
      await removeCaptureDirectoryIfStillOwned(captureBinding);
    }
    if (error instanceof DiscordHeroEncryptedSaveSnapshotError) {
      throw error;
    }
    throw new DiscordHeroEncryptedSaveSnapshotError("capture_failed");
  }
  const captureDirectory = basename(captureBinding.realPath);

  return {
    format: SNAPSHOT_FORMAT,
    status: "SNAPSHOT_CREATED",
    label: input.label,
    capturedAt,
    bytes: stableSave.bytes.byteLength,
    sha256: stableSave.sha256,
    captureDirectory,
    snapshotFile: SNAPSHOT_FILE,
    manifestFile: MANIFEST_FILE,
  };
}

export function redactDiscordHeroEncryptedSaveSnapshotError(
  error: unknown,
): EncryptedSaveSnapshotDiagnostic {
  const code =
    error instanceof DiscordHeroEncryptedSaveSnapshotError
      ? error.code
      : "capture_failed";
  return {
    format: SNAPSHOT_FORMAT,
    status: "FAIL",
    error: {
      code,
      message: ERROR_MESSAGES[code],
    },
  };
}
