import { createDecipheriv, createHash, pbkdf2Sync } from "node:crypto";

const SAVE_ROOTS = ["PlayerSaveData", "AccountSaveData", "SystemInfo"] as const;
const SAVE_ROOT_SET = new Set<string>(SAVE_ROOTS);

export type TaskbarHeroEs3EnvelopeErrorCode =
  | "capture_failed"
  | "decryption_failed"
  | "file_too_small"
  | "invalid_capture_time"
  | "invalid_json";

export class TaskbarHeroEs3EnvelopeError extends Error {
  constructor(readonly code: TaskbarHeroEs3EnvelopeErrorCode) {
    super("TaskbarHero encrypted-save envelope processing failed.");
    this.name = "TaskbarHeroEs3EnvelopeError";
  }
}

// The EasySave3 password ships inside the TaskbarHero binary; it is read from
// the environment so the public repo never carries it.
function taskbarHeroEs3Password(): string {
  const password = process.env.TASKBARHERO_ES3_PASSWORD;
  if (!password) {
    throw new Error("TASKBARHERO_ES3_PASSWORD is not set — add it to .env.");
  }
  return password;
}

export interface TaskbarHeroNormalizedSave {
  readonly PlayerSaveData?: unknown;
  readonly AccountSaveData?: unknown;
  readonly SystemInfo?: unknown;
}

export interface TaskbarHeroComparisonSave extends TaskbarHeroNormalizedSave {
  readonly OuterSaveData: unknown;
}

export type TaskbarHeroRawPathSegment =
  | Readonly<{ kind: "field"; key: string }>
  | Readonly<{ kind: "index"; index: number }>;

export interface TaskbarHeroEnvelopeChange {
  readonly path: readonly TaskbarHeroRawPathSegment[];
  readonly change: "ADDED" | "REMOVED" | "MODIFIED";
  readonly beforePresent: boolean;
  readonly beforeValue: unknown;
  readonly afterPresent: boolean;
  readonly afterValue: unknown;
}

export interface TaskbarHeroEncryptedInputEvidence {
  readonly beforeBytes: number;
  readonly beforeSha256: string;
  readonly afterBytes: number;
  readonly afterSha256: string;
}

export interface TaskbarHeroEs3PairInspection {
  readonly beforeEncrypted: Uint8Array;
  readonly afterEncrypted: Uint8Array;
  readonly encryptedInputs: TaskbarHeroEncryptedInputEvidence;
  readonly before: TaskbarHeroComparisonSave;
  readonly after: TaskbarHeroComparisonSave;
  readonly changes: readonly TaskbarHeroEnvelopeChange[];
}

export function taskbarHeroEs3Bytes(
  input: Uint8Array | ArrayBuffer,
): Uint8Array {
  if (input instanceof Uint8Array) {
    return Uint8Array.from(input);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input.slice(0));
  }
  throw new TaskbarHeroEs3EnvelopeError("capture_failed");
}

function unwrapSaveRoot(value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "value")
  ) {
    const wrapped = (value as { readonly value: unknown }).value;
    if (typeof wrapped === "string") {
      const trimmed = wrapped.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return JSON.parse(
            trimmed.replace(/([:[,]\s*)(\d{16,})(?=\s*[,\]}])/g, '$1"$2"'),
          );
        } catch {
          return wrapped;
        }
      }
    }
    return wrapped;
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownValue(
  record: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

async function decryptTaskbarHeroEs3Outer(
  input: Uint8Array | ArrayBuffer,
  password: string,
): Promise<Readonly<Record<string, unknown>>> {
  const bytes = taskbarHeroEs3Bytes(input);
  if (bytes.byteLength <= 16) {
    throw new TaskbarHeroEs3EnvelopeError("file_too_small");
  }
  const saltAndIv = bytes.slice(0, 16);
  const ciphertext = bytes.slice(16);
  let plaintext: string;
  try {
    const key = pbkdf2Sync(password, saltAndIv, 100, 16, "sha1");
    const decipher = createDecipheriv("aes-128-cbc", key, saltAndIv);
    plaintext = new TextDecoder("utf-8").decode(
      Uint8Array.from([...decipher.update(ciphertext), ...decipher.final()]),
    );
  } catch {
    throw new TaskbarHeroEs3EnvelopeError("decryption_failed");
  }

  let outer: unknown;
  try {
    outer = JSON.parse(plaintext);
  } catch {
    throw new TaskbarHeroEs3EnvelopeError("invalid_json");
  }
  if (!isRecord(outer)) {
    throw new TaskbarHeroEs3EnvelopeError("invalid_json");
  }
  return outer;
}

function defineComparisonValue(
  target: object,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: false,
    writable: false,
  });
}

function normalizedSave(
  outer: Readonly<Record<string, unknown>>,
): TaskbarHeroNormalizedSave {
  const normalized = Object.create(null) as Record<string, unknown>;
  for (const root of SAVE_ROOTS) {
    if (Object.hasOwn(outer, root)) {
      defineComparisonValue(normalized, root, unwrapSaveRoot(outer[root]));
    }
  }
  return Object.freeze(normalized);
}

function comparisonSave(
  outer: Readonly<Record<string, unknown>>,
): TaskbarHeroComparisonSave {
  const normalized = normalizedSave(outer);
  const outerSaveData = Object.create(null) as Record<string, unknown>;
  for (const root of SAVE_ROOTS) {
    const rawRoot = ownValue(outer, root);
    if (!isRecord(rawRoot) || !Object.hasOwn(rawRoot, "value")) {
      continue;
    }
    const siblings = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(rawRoot).sort()) {
      if (key !== "value") {
        defineComparisonValue(siblings, key, rawRoot[key]);
      }
    }
    defineComparisonValue(outerSaveData, root, siblings);
  }
  for (const key of Object.keys(outer).sort()) {
    if (!SAVE_ROOT_SET.has(key)) {
      defineComparisonValue(outerSaveData, key, outer[key]);
    }
  }
  return Object.freeze({
    ...normalized,
    OuterSaveData: outerSaveData,
  });
}

export async function decodeTaskbarHeroEs3Normalized(
  input: Uint8Array | ArrayBuffer,
  password = taskbarHeroEs3Password(),
): Promise<TaskbarHeroNormalizedSave> {
  return normalizedSave(await decryptTaskbarHeroEs3Outer(input, password));
}

function fieldSegment(key: string): TaskbarHeroRawPathSegment {
  return Object.freeze({ kind: "field", key });
}

function indexSegment(index: number): TaskbarHeroRawPathSegment {
  return Object.freeze({ kind: "index", index });
}

function addedChange(
  path: readonly TaskbarHeroRawPathSegment[],
  afterValue: unknown,
): TaskbarHeroEnvelopeChange {
  return Object.freeze({
    path: Object.freeze([...path]),
    change: "ADDED",
    beforePresent: false,
    beforeValue: undefined,
    afterPresent: true,
    afterValue,
  });
}

function removedChange(
  path: readonly TaskbarHeroRawPathSegment[],
  beforeValue: unknown,
): TaskbarHeroEnvelopeChange {
  return Object.freeze({
    path: Object.freeze([...path]),
    change: "REMOVED",
    beforePresent: true,
    beforeValue,
    afterPresent: false,
    afterValue: undefined,
  });
}

function modifiedChange(
  path: readonly TaskbarHeroRawPathSegment[],
  beforeValue: unknown,
  afterValue: unknown,
): TaskbarHeroEnvelopeChange {
  return Object.freeze({
    path: Object.freeze([...path]),
    change: "MODIFIED",
    beforePresent: true,
    beforeValue,
    afterPresent: true,
    afterValue,
  });
}

function collectChanges(
  before: unknown,
  after: unknown,
  path: readonly TaskbarHeroRawPathSegment[],
  output: TaskbarHeroEnvelopeChange[],
): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const childPath = [...path, indexSegment(index)];
      if (index >= before.length) {
        output.push(addedChange(childPath, after[index]));
      } else if (index >= after.length) {
        output.push(removedChange(childPath, before[index]));
      } else {
        collectChanges(before[index], after[index], childPath, output);
      }
    }
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].sort();
    for (const key of keys) {
      const childPath = [...path, fieldSegment(key)];
      if (!Object.hasOwn(before, key)) {
        output.push(addedChange(childPath, after[key]));
      } else if (!Object.hasOwn(after, key)) {
        output.push(removedChange(childPath, before[key]));
      } else {
        collectChanges(before[key], after[key], childPath, output);
      }
    }
    return;
  }
  output.push(modifiedChange(path, before, after));
}

function comparisonChanges(
  before: TaskbarHeroComparisonSave,
  after: TaskbarHeroComparisonSave,
): readonly TaskbarHeroEnvelopeChange[] {
  const changes: TaskbarHeroEnvelopeChange[] = [];
  for (const root of [...SAVE_ROOTS, "OuterSaveData"] as const) {
    const path = [fieldSegment(root)];
    const beforePresent = Object.hasOwn(before, root);
    const afterPresent = Object.hasOwn(after, root);
    if (!beforePresent && afterPresent) {
      changes.push(addedChange(path, after[root]));
    } else if (beforePresent && !afterPresent) {
      changes.push(removedChange(path, before[root]));
    } else if (beforePresent && afterPresent) {
      collectChanges(before[root], after[root], path, changes);
    }
  }
  return Object.freeze(changes);
}

export function taskbarHeroEncryptedInputEvidence(
  beforeEncrypted: Uint8Array,
  afterEncrypted: Uint8Array,
): TaskbarHeroEncryptedInputEvidence {
  return Object.freeze({
    beforeBytes: beforeEncrypted.byteLength,
    beforeSha256: createHash("sha256").update(beforeEncrypted).digest("hex"),
    afterBytes: afterEncrypted.byteLength,
    afterSha256: createHash("sha256").update(afterEncrypted).digest("hex"),
  });
}

export async function inspectTaskbarHeroEs3Pair(input: {
  readonly beforeEncrypted: Uint8Array | ArrayBuffer;
  readonly afterEncrypted: Uint8Array | ArrayBuffer;
}): Promise<TaskbarHeroEs3PairInspection> {
  const beforeEncrypted = taskbarHeroEs3Bytes(input.beforeEncrypted);
  const afterEncrypted = taskbarHeroEs3Bytes(input.afterEncrypted);
  const password = taskbarHeroEs3Password();
  const [beforeOuter, afterOuter] = await Promise.all([
    decryptTaskbarHeroEs3Outer(beforeEncrypted, password),
    decryptTaskbarHeroEs3Outer(afterEncrypted, password),
  ]);
  const before = comparisonSave(beforeOuter);
  const after = comparisonSave(afterOuter);
  return Object.freeze({
    beforeEncrypted,
    afterEncrypted,
    encryptedInputs: taskbarHeroEncryptedInputEvidence(
      beforeEncrypted,
      afterEncrypted,
    ),
    before,
    after,
    changes: comparisonChanges(before, after),
  });
}

export function canonicalTaskbarHeroCaptureTime(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new TaskbarHeroEs3EnvelopeError("invalid_capture_time");
  }
  const canonical = new Date(value).toISOString().replace(/\.000Z$/, "Z");
  if (value !== canonical && value !== canonical.replace(/Z$/, ".000Z")) {
    throw new TaskbarHeroEs3EnvelopeError("invalid_capture_time");
  }
  return canonical;
}

export function taskbarHeroLegacyChangePath(
  change: TaskbarHeroEnvelopeChange,
): string {
  let path = "";
  for (const segment of change.path) {
    if (segment.kind === "index") {
      path += `[${segment.index}]`;
      continue;
    }
    if (path.length === 0) {
      path = segment.key;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment.key)) {
      path += `.${segment.key}`;
    } else {
      path += `[${JSON.stringify(segment.key)}]`;
    }
  }
  return path;
}
