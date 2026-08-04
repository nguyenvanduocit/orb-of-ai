import { createHash } from "node:crypto";
import {
  canonicalTaskbarHeroCaptureTime,
  decodeTaskbarHeroEs3Normalized,
  inspectTaskbarHeroEs3Pair,
  taskbarHeroEncryptedInputEvidence,
  taskbarHeroEs3Bytes,
  taskbarHeroLegacyChangePath,
  TaskbarHeroEs3EnvelopeError,
  type TaskbarHeroNormalizedSave,
} from "./es3-envelope";

const CAPTURE_FORMAT = "taskbarhero-runtime-oracle/pet-arrangement-capture/v1";
const ARRANGED_PET_PATH = "PlayerSaveData.commonSaveData.ArrangedPetKey";

type CaptureErrorCode =
  | "capture_failed"
  | "decryption_failed"
  | "extra_state_delta"
  | "file_too_small"
  | "invalid_arguments"
  | "invalid_arranged_pet"
  | "invalid_capture_time"
  | "invalid_json"
  | "invalid_pet_data"
  | "invalid_transition"
  | "pet_not_unlocked"
  | "unexpected_after_pet"
  | "unexpected_before_pet";

const ERROR_MESSAGES = {
  capture_failed: "Pet arrangement capture failed.",
  decryption_failed:
    "Save decryption failed for the pinned TaskbarHero protocol.",
  extra_state_delta: "Capture changed state outside the arranged Pet field.",
  file_too_small: "Encrypted save is too small for the TaskbarHero ES3 format.",
  invalid_arguments: "Pet arrangement capture arguments are invalid.",
  invalid_arranged_pet: "Capture has an invalid arranged Pet value.",
  invalid_capture_time: "Capture time must be a valid UTC timestamp.",
  invalid_json: "Decrypted save is not valid TaskbarHero JSON.",
  invalid_pet_data: "Capture has invalid Pet save data.",
  invalid_transition: "Pet arrangement transition is invalid.",
  pet_not_unlocked: "Both transition Pets must be unlocked in both saves.",
  unexpected_after_pet: "After-save arranged Pet does not match --to.",
  unexpected_before_pet: "Before-save arranged Pet does not match --from.",
} as const satisfies Record<CaptureErrorCode, string>;

export class DiscordHeroPetArrangementCaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    readonly evidence?: PetArrangementCaptureEvidence,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "DiscordHeroPetArrangementCaptureError";
  }
}

export type { TaskbarHeroNormalizedSave } from "./es3-envelope";

export interface PetArrangementCaptureInput {
  readonly beforeEncrypted: Uint8Array | ArrayBuffer;
  readonly afterEncrypted: Uint8Array | ArrayBuffer;
  readonly fromPetKey: number;
  readonly toPetKey: number;
  readonly capturedAt: string;
}

export interface PetArrangementCaptureReport {
  readonly format: typeof CAPTURE_FORMAT;
  readonly status: "PASS";
  readonly capturedAt: string;
  readonly encryptedInputs: {
    readonly beforeBytes: number;
    readonly beforeSha256: string;
    readonly afterBytes: number;
    readonly afterSha256: string;
  };
  readonly transition: {
    readonly fromPetKey: number;
    readonly toPetKey: number;
    readonly changedPaths: readonly [typeof ARRANGED_PET_PATH];
  };
  readonly whitelistedState: {
    readonly before: WhitelistedPetState;
    readonly after: WhitelistedPetState;
  };
}

interface EncryptedInputEvidence {
  readonly beforeBytes: number;
  readonly beforeSha256: string;
  readonly afterBytes: number;
  readonly afterSha256: string;
}

interface ChangedPathEvidence {
  readonly totalCount: number;
  readonly allowedArrangedPetPathChanged: boolean;
  readonly unexpectedCount: number;
  readonly unexpectedPathSha256: readonly string[];
}

interface PetArrangementCaptureEvidence {
  readonly capturedAt: string;
  readonly encryptedInputs: EncryptedInputEvidence;
  readonly transition: {
    readonly fromPetKey: number;
    readonly toPetKey: number;
  };
  readonly changedPaths?: ChangedPathEvidence;
}

export interface PetArrangementCaptureDiagnostic {
  readonly format: typeof CAPTURE_FORMAT;
  readonly status: "FAIL";
  readonly error: {
    readonly code: CaptureErrorCode;
    readonly message: string;
    readonly evidence?: PetArrangementCaptureEvidence;
  };
}

interface WhitelistedPetState {
  readonly arrangedPetKey: number;
  readonly pets: readonly [
    { readonly petKey: number; readonly isUnlock: true },
    { readonly petKey: number; readonly isUnlock: true },
  ];
}

export async function decodeTaskbarHeroEs3(
  input: Uint8Array | ArrayBuffer,
  password?: string,
): Promise<TaskbarHeroNormalizedSave> {
  try {
    return await decodeTaskbarHeroEs3Normalized(input, password);
  } catch (error) {
    mapEnvelopeError(error);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requirePositivePetKey(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_transition");
  }
}

function changedPathEvidence(paths: readonly string[]): ChangedPathEvidence {
  const unexpectedPathSha256 = paths
    .filter((path) => path !== ARRANGED_PET_PATH)
    .map((path) => createHash("sha256").update(path).digest("hex"))
    .sort();
  return Object.freeze({
    totalCount: paths.length,
    allowedArrangedPetPathChanged: paths.includes(ARRANGED_PET_PATH),
    unexpectedCount: unexpectedPathSha256.length,
    unexpectedPathSha256: Object.freeze(unexpectedPathSha256),
  });
}

function mapEnvelopeError(error: unknown): never {
  if (error instanceof TaskbarHeroEs3EnvelopeError) {
    throw new DiscordHeroPetArrangementCaptureError(error.code);
  }
  throw error;
}

function readWhitelistedPetState(
  save: TaskbarHeroNormalizedSave,
  fromPetKey: number,
  toPetKey: number,
): WhitelistedPetState {
  const player = save.PlayerSaveData;
  if (!isRecord(player)) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_pet_data");
  }
  const common = player.commonSaveData;
  if (!isRecord(common)) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_arranged_pet");
  }
  const arrangedPetKey = common.ArrangedPetKey;
  if (
    typeof arrangedPetKey !== "number" ||
    !Number.isSafeInteger(arrangedPetKey) ||
    arrangedPetKey < 1
  ) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_arranged_pet");
  }
  const petSaveData = player.PetSaveData;
  if (!Array.isArray(petSaveData)) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_pet_data");
  }
  const pets = [fromPetKey, toPetKey].map((petKey) => {
    const matches = petSaveData.filter(
      (candidate: unknown) =>
        isRecord(candidate) && candidate.PetKey === petKey,
    );
    if (matches.length !== 1) {
      throw new DiscordHeroPetArrangementCaptureError("invalid_pet_data");
    }
    const pet = matches[0]!;
    if (pet.IsUnlock !== true) {
      throw new DiscordHeroPetArrangementCaptureError("pet_not_unlocked");
    }
    return Object.freeze({ petKey, isUnlock: true as const });
  }) as [
    { readonly petKey: number; readonly isUnlock: true },
    { readonly petKey: number; readonly isUnlock: true },
  ];
  return Object.freeze({
    arrangedPetKey,
    pets: Object.freeze(pets),
  });
}

export async function evaluatePetArrangementCapture(
  input: PetArrangementCaptureInput,
): Promise<PetArrangementCaptureReport> {
  requirePositivePetKey(input.fromPetKey);
  requirePositivePetKey(input.toPetKey);
  if (input.fromPetKey === input.toPetKey) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_transition");
  }
  let capturedAt: string;
  let beforeEncrypted: Uint8Array;
  let afterEncrypted: Uint8Array;
  try {
    capturedAt = canonicalTaskbarHeroCaptureTime(input.capturedAt);
    beforeEncrypted = taskbarHeroEs3Bytes(input.beforeEncrypted);
    afterEncrypted = taskbarHeroEs3Bytes(input.afterEncrypted);
  } catch (error) {
    mapEnvelopeError(error);
  }
  const baseEvidence: PetArrangementCaptureEvidence = Object.freeze({
    capturedAt,
    encryptedInputs: taskbarHeroEncryptedInputEvidence(
      beforeEncrypted,
      afterEncrypted,
    ),
    transition: Object.freeze({
      fromPetKey: input.fromPetKey,
      toPetKey: input.toPetKey,
    }),
  });
  let beforeState: WhitelistedPetState;
  let afterState: WhitelistedPetState;
  try {
    const inspection = await inspectTaskbarHeroEs3Pair({
      beforeEncrypted,
      afterEncrypted,
    });
    const { before, after } = inspection;
    beforeState = readWhitelistedPetState(
      before,
      input.fromPetKey,
      input.toPetKey,
    );
    afterState = readWhitelistedPetState(
      after,
      input.fromPetKey,
      input.toPetKey,
    );
    if (beforeState.arrangedPetKey !== input.fromPetKey) {
      throw new DiscordHeroPetArrangementCaptureError("unexpected_before_pet");
    }
    if (afterState.arrangedPetKey !== input.toPetKey) {
      throw new DiscordHeroPetArrangementCaptureError("unexpected_after_pet");
    }
    const changedPaths = inspection.changes.map(taskbarHeroLegacyChangePath);
    if (changedPaths.length !== 1 || changedPaths[0] !== ARRANGED_PET_PATH) {
      throw new DiscordHeroPetArrangementCaptureError(
        "extra_state_delta",
        Object.freeze({
          ...baseEvidence,
          changedPaths: changedPathEvidence(changedPaths),
        }),
      );
    }
  } catch (error) {
    if (error instanceof TaskbarHeroEs3EnvelopeError) {
      throw new DiscordHeroPetArrangementCaptureError(error.code, baseEvidence);
    }
    if (
      error instanceof DiscordHeroPetArrangementCaptureError &&
      error.evidence === undefined
    ) {
      throw new DiscordHeroPetArrangementCaptureError(error.code, baseEvidence);
    }
    throw error;
  }

  return Object.freeze({
    format: CAPTURE_FORMAT,
    status: "PASS",
    capturedAt,
    encryptedInputs: baseEvidence.encryptedInputs,
    transition: Object.freeze({
      fromPetKey: input.fromPetKey,
      toPetKey: input.toPetKey,
      changedPaths: Object.freeze([ARRANGED_PET_PATH] as const),
    }),
    whitelistedState: Object.freeze({
      before: beforeState,
      after: afterState,
    }),
  });
}

export function redactPetArrangementCaptureError(
  error: unknown,
): PetArrangementCaptureDiagnostic {
  const known =
    error instanceof DiscordHeroPetArrangementCaptureError
      ? error
      : new DiscordHeroPetArrangementCaptureError("capture_failed");
  return Object.freeze({
    format: CAPTURE_FORMAT,
    status: "FAIL",
    error: Object.freeze({
      code: known.code,
      message: ERROR_MESSAGES[known.code],
      ...(known.evidence === undefined ? {} : { evidence: known.evidence }),
    }),
  });
}
