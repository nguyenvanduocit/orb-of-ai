import { createHash } from "node:crypto";
import {
  canonicalTaskbarHeroCaptureTime,
  inspectTaskbarHeroEs3Pair,
  TaskbarHeroEs3EnvelopeError,
  type TaskbarHeroEnvelopeChange,
  type TaskbarHeroRawPathSegment,
} from "./es3-envelope";

const DISCOVERY_FORMAT =
  "taskbarhero-runtime-oracle/campaign-save-delta-discovery/v1";
const CANONICAL_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LABEL_LENGTH = 96;
const PROVEN_STATIC_FIELD_PATHS = new Set([
  JSON.stringify(["PlayerSaveData"]),
  JSON.stringify(["AccountSaveData"]),
  JSON.stringify(["SystemInfo"]),
  JSON.stringify(["OuterSaveData"]),
  JSON.stringify(["OuterSaveData", "PlayerSaveData"]),
  JSON.stringify(["OuterSaveData", "AccountSaveData"]),
  JSON.stringify(["OuterSaveData", "SystemInfo"]),
]);

export type CampaignSaveDeltaDiscoveryErrorCode =
  | "capture_failed"
  | "decryption_failed"
  | "file_too_small"
  | "invalid_arguments"
  | "invalid_capture_time"
  | "invalid_json"
  | "invalid_label";

const ERROR_MESSAGES = {
  capture_failed: "Campaign save-delta discovery failed.",
  decryption_failed:
    "Save decryption failed for the pinned TaskbarHero protocol.",
  file_too_small: "Encrypted save is too small for the TaskbarHero ES3 format.",
  invalid_arguments: "Campaign save-delta discovery arguments are invalid.",
  invalid_capture_time: "Capture time must be a valid canonical UTC timestamp.",
  invalid_json: "Decrypted save is not valid TaskbarHero JSON.",
  invalid_label: "Pair labels must be distinct canonical kebab-case values.",
} as const satisfies Record<CampaignSaveDeltaDiscoveryErrorCode, string>;

export class DiscordHeroCampaignSaveDeltaDiscoveryError extends Error {
  constructor(readonly code: CampaignSaveDeltaDiscoveryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "DiscordHeroCampaignSaveDeltaDiscoveryError";
  }
}

export type CampaignSaveDeltaPathSegment =
  | Readonly<{ kind: "field"; name: string }>
  | Readonly<{ kind: "field_hash"; sha256: string }>
  | Readonly<{ kind: "index"; index: number }>;

export type CampaignSaveDeltaValueDescriptor =
  | Readonly<{ type: "missing"; length: 0; sha256: string }>
  | Readonly<{ type: "null"; length: number; sha256: string }>
  | Readonly<{ type: "string"; length: number; sha256: string }>
  | Readonly<{ type: "number"; length: number; sha256: string }>
  | Readonly<{ type: "boolean"; length: number; sha256: string }>
  | Readonly<{ type: "array"; length: number; sha256: string }>
  | Readonly<{ type: "object"; length: number; sha256: string }>
  | Readonly<{ type: "unknown"; length: number; sha256: string }>;

export interface CampaignSaveDeltaChangeDescriptor {
  readonly path: readonly CampaignSaveDeltaPathSegment[];
  readonly change: "ADDED" | "REMOVED" | "MODIFIED";
  readonly before: CampaignSaveDeltaValueDescriptor;
  readonly after: CampaignSaveDeltaValueDescriptor;
}

export interface CampaignSaveDeltaDiscoveryInput {
  readonly beforeEncrypted: Uint8Array | ArrayBuffer;
  readonly afterEncrypted: Uint8Array | ArrayBuffer;
  readonly beforeLabel: string;
  readonly afterLabel: string;
  readonly capturedAt: string;
}

export interface CampaignSaveDeltaDiscoveryReport {
  readonly format: typeof DISCOVERY_FORMAT;
  readonly status: "DISCOVERY";
  readonly capturedAt: string;
  readonly pair: {
    readonly beforeLabel: string;
    readonly afterLabel: string;
  };
  readonly encryptedInputs: {
    readonly beforeBytes: number;
    readonly beforeSha256: string;
    readonly afterBytes: number;
    readonly afterSha256: string;
  };
  readonly changes: readonly CampaignSaveDeltaChangeDescriptor[];
}

export interface CampaignSaveDeltaDiscoveryDiagnostic {
  readonly format: typeof DISCOVERY_FORMAT;
  readonly status: "FAIL";
  readonly error: {
    readonly code: CampaignSaveDeltaDiscoveryErrorCode;
    readonly message: string;
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isProvenStaticFieldPath(
  path: readonly TaskbarHeroRawPathSegment[],
  endIndex: number,
): boolean {
  const fieldPath: string[] = [];
  for (let index = 0; index <= endIndex; index += 1) {
    const segment = path[index]!;
    if (segment.kind !== "field") return false;
    fieldPath.push(segment.key);
  }
  return PROVEN_STATIC_FIELD_PATHS.has(JSON.stringify(fieldPath));
}

function publicPath(
  path: readonly TaskbarHeroRawPathSegment[],
): readonly CampaignSaveDeltaPathSegment[] {
  return Object.freeze(
    path.map((segment, index) => {
      if (segment.kind === "index") {
        return Object.freeze({ kind: "index" as const, index: segment.index });
      }
      if (isProvenStaticFieldPath(path, index)) {
        return Object.freeze({ kind: "field" as const, name: segment.key });
      }
      return Object.freeze({
        kind: "field_hash" as const,
        sha256: sha256(segment.key),
      });
    }),
  );
}

function canonicalValue(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : '"non-finite"';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalValue(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(typeof value);
}

function privateValueDescriptor(
  value: unknown,
  type:
    "null" | "string" | "number" | "boolean" | "array" | "object" | "unknown",
): CampaignSaveDeltaValueDescriptor {
  const canonical = canonicalValue(value);
  return Object.freeze({
    type,
    length: canonical.length,
    sha256: sha256(canonical),
  }) as CampaignSaveDeltaValueDescriptor;
}

function valueDescriptor(
  present: boolean,
  value: unknown,
): CampaignSaveDeltaValueDescriptor {
  if (!present) {
    return Object.freeze({
      type: "missing",
      length: 0,
      sha256: sha256("missing"),
    });
  }
  if (value === null) return privateValueDescriptor(value, "null");
  if (typeof value === "string") {
    return privateValueDescriptor(value, "string");
  }
  if (typeof value === "number") {
    return privateValueDescriptor(value, "number");
  }
  if (typeof value === "boolean") {
    return privateValueDescriptor(value, "boolean");
  }
  if (Array.isArray(value)) return privateValueDescriptor(value, "array");
  if (value !== null && typeof value === "object") {
    return privateValueDescriptor(value, "object");
  }
  return privateValueDescriptor(value, "unknown");
}

function publicChange(
  change: TaskbarHeroEnvelopeChange,
): CampaignSaveDeltaChangeDescriptor {
  return Object.freeze({
    path: publicPath(change.path),
    change: change.change,
    before: valueDescriptor(change.beforePresent, change.beforeValue),
    after: valueDescriptor(change.afterPresent, change.afterValue),
  });
}

function requireLabel(value: string): void {
  if (
    typeof value !== "string" ||
    value.length > MAX_LABEL_LENGTH ||
    !CANONICAL_LABEL.test(value)
  ) {
    throw new DiscordHeroCampaignSaveDeltaDiscoveryError("invalid_label");
  }
}

function mapEnvelopeError(error: unknown): never {
  if (error instanceof TaskbarHeroEs3EnvelopeError) {
    throw new DiscordHeroCampaignSaveDeltaDiscoveryError(error.code);
  }
  throw error;
}

export async function evaluateCampaignSaveDeltaDiscovery(
  input: CampaignSaveDeltaDiscoveryInput,
): Promise<CampaignSaveDeltaDiscoveryReport> {
  requireLabel(input.beforeLabel);
  requireLabel(input.afterLabel);
  if (input.beforeLabel === input.afterLabel) {
    throw new DiscordHeroCampaignSaveDeltaDiscoveryError("invalid_label");
  }
  let capturedAt: string;
  try {
    capturedAt = canonicalTaskbarHeroCaptureTime(input.capturedAt);
  } catch (error) {
    mapEnvelopeError(error);
  }

  try {
    const inspection = await inspectTaskbarHeroEs3Pair(input);
    return Object.freeze({
      format: DISCOVERY_FORMAT,
      status: "DISCOVERY",
      capturedAt,
      pair: Object.freeze({
        beforeLabel: input.beforeLabel,
        afterLabel: input.afterLabel,
      }),
      encryptedInputs: inspection.encryptedInputs,
      changes: Object.freeze(inspection.changes.map(publicChange)),
    });
  } catch (error) {
    mapEnvelopeError(error);
  }
}

export function redactCampaignSaveDeltaDiscoveryError(
  error: unknown,
): CampaignSaveDeltaDiscoveryDiagnostic {
  const known =
    error instanceof DiscordHeroCampaignSaveDeltaDiscoveryError
      ? error
      : new DiscordHeroCampaignSaveDeltaDiscoveryError("capture_failed");
  return Object.freeze({
    format: DISCOVERY_FORMAT,
    status: "FAIL",
    error: Object.freeze({
      code: known.code,
      message: ERROR_MESSAGES[known.code],
    }),
  });
}
