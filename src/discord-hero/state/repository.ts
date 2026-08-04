import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { globalFile } from "../../store";
import { COMPILED_PAYLOAD_SHA256 } from "../catalog/compiler";
import { type PlayerState, PlayerStateSchema } from "../domain/player";

export const PLAYER_STATE_SCHEMA_VERSION = 1;
export const APPLICATION_COMPATIBILITY_VERSION = 1;
export const MAX_PLAYER_STATE_JSON_BYTES = 4 * 1024 * 1024;
export const MAX_TRANSACTION_OUTCOME_JSON_BYTES = 64 * 1024;

const CURRENT_MIGRATION_VERSION = 1;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MAX_JSON_DEPTH = 64;
const MAX_STATE_JSON_PROPERTIES = 250_000;
const MAX_OUTCOME_JSON_PROPERTIES = 4_096;
const MIGRATION_NAME = "fresh-discordhero-state";
const LEGACY_RPG_FILES = [
  "characters.json",
  "expeditions.json",
  "expedition-results.json",
  "market.json",
  "pvp.json",
] as const;

const SCHEMA_MIGRATIONS_SQL = `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version BETWEEN 1 AND ${MAX_SAFE_INTEGER}),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  checksum TEXT NOT NULL CHECK (
    length(checksum) = 64
    AND checksum NOT GLOB '*[^0-9a-f]*'
  ),
  applied_at_ms INTEGER NOT NULL CHECK (
    applied_at_ms BETWEEN 0 AND ${MAX_SAFE_INTEGER}
  )
) STRICT`;

const GAME_META_SQL = `
CREATE TABLE game_meta (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 200),
  value TEXT NOT NULL
) STRICT`;

const PLAYERS_SQL = `
CREATE TABLE players (
  user_id TEXT PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 200),
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND ${MAX_SAFE_INTEGER}),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  state_json TEXT NOT NULL CHECK (
    json_valid(state_json)
    AND json_type(state_json) = 'object'
    AND length(state_json) BETWEEN 2 AND ${MAX_PLAYER_STATE_JSON_BYTES}
  ),
  created_at_ms INTEGER NOT NULL CHECK (
    created_at_ms BETWEEN 0 AND ${MAX_SAFE_INTEGER}
  ),
  updated_at_ms INTEGER NOT NULL CHECK (
    updated_at_ms BETWEEN 0 AND ${MAX_SAFE_INTEGER}
    AND updated_at_ms >= created_at_ms
  )
) STRICT`;

const IDEMPOTENCY_SQL = `
CREATE TABLE idempotency (
  interaction_id TEXT PRIMARY KEY CHECK (length(interaction_id) BETWEEN 1 AND 200),
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 200),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 200),
  player_user_id TEXT CHECK (
    player_user_id IS NULL
    OR length(player_user_id) BETWEEN 1 AND 200
  ),
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (
    length(request_sha256) = 64
    AND request_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  expected_revision INTEGER CHECK (
    expected_revision IS NULL
    OR expected_revision BETWEEN 1 AND ${MAX_SAFE_INTEGER}
  ),
  committed_revision INTEGER CHECK (
    committed_revision IS NULL
    OR committed_revision BETWEEN 1 AND ${MAX_SAFE_INTEGER}
  ),
  outcome_json TEXT NOT NULL CHECK (
    json_valid(outcome_json)
    AND json_type(outcome_json) = 'object'
    AND length(outcome_json) BETWEEN 2 AND ${MAX_TRANSACTION_OUTCOME_JSON_BYTES}
  ),
  created_at_ms INTEGER NOT NULL CHECK (
    created_at_ms BETWEEN 0 AND ${MAX_SAFE_INTEGER}
  ),
  CHECK (
    json_type(outcome_json, '$.status') = 'text'
    AND json_extract(outcome_json, '$.status') IN ('committed', 'rejected')
    AND json_type(outcome_json, '$.revision') IN ('integer', 'null')
    AND json_extract(outcome_json, '$.revision') IS committed_revision
    AND (
      (
        json_extract(outcome_json, '$.status') = 'committed'
        AND committed_revision IS NOT NULL
        AND player_user_id = user_id
        AND (
          (expected_revision IS NULL AND committed_revision = 1)
          OR (
            expected_revision IS NOT NULL
            AND committed_revision = expected_revision + 1
          )
        )
      )
      OR (
        json_extract(outcome_json, '$.status') = 'rejected'
        AND committed_revision IS expected_revision
        AND (
          (committed_revision IS NULL AND player_user_id IS NULL)
          OR (
            committed_revision IS NOT NULL
            AND player_user_id = user_id
          )
        )
      )
    )
  ),
  FOREIGN KEY (player_user_id) REFERENCES players(user_id) ON DELETE CASCADE
) STRICT`;

const IDEMPOTENCY_PLAYER_INDEX_SQL = `
CREATE INDEX idempotency_player
  ON idempotency(player_user_id)`;

const IDEMPOTENCY_INDEX_SQL = `
CREATE INDEX idempotency_user_created
  ON idempotency(user_id, created_at_ms)`;

const MIGRATION_V1_SQL = [
  SCHEMA_MIGRATIONS_SQL,
  GAME_META_SQL,
  PLAYERS_SQL,
  IDEMPOTENCY_SQL,
  IDEMPOTENCY_PLAYER_INDEX_SQL,
  IDEMPOTENCY_INDEX_SQL,
].join(";\n\n");

const MIGRATION_V1_CHECKSUM = createHash("sha256")
  .update(`${MIGRATION_V1_SQL};`)
  .digest("hex");

const EXPECTED_SCHEMA_OBJECTS = [
  {
    type: "index",
    name: "idempotency_player",
    table: "idempotency",
    sql: IDEMPOTENCY_PLAYER_INDEX_SQL,
  },
  {
    type: "index",
    name: "idempotency_user_created",
    table: "idempotency",
    sql: IDEMPOTENCY_INDEX_SQL,
  },
  { type: "table", name: "game_meta", table: "game_meta", sql: GAME_META_SQL },
  {
    type: "table",
    name: "idempotency",
    table: "idempotency",
    sql: IDEMPOTENCY_SQL,
  },
  { type: "table", name: "players", table: "players", sql: PLAYERS_SQL },
  {
    type: "table",
    name: "schema_migrations",
    table: "schema_migrations",
    sql: SCHEMA_MIGRATIONS_SQL,
  },
] as const;

const EXPECTED_COLUMNS = {
  schema_migrations: [
    ["version", "INTEGER", 0, 1],
    ["name", "TEXT", 1, 0],
    ["checksum", "TEXT", 1, 0],
    ["applied_at_ms", "INTEGER", 1, 0],
  ],
  game_meta: [
    ["key", "TEXT", 1, 1],
    ["value", "TEXT", 1, 0],
  ],
  players: [
    ["user_id", "TEXT", 1, 1],
    ["revision", "INTEGER", 1, 0],
    ["schema_version", "INTEGER", 1, 0],
    ["state_json", "TEXT", 1, 0],
    ["created_at_ms", "INTEGER", 1, 0],
    ["updated_at_ms", "INTEGER", 1, 0],
  ],
  idempotency: [
    ["interaction_id", "TEXT", 1, 1],
    ["scope", "TEXT", 1, 0],
    ["user_id", "TEXT", 1, 0],
    ["player_user_id", "TEXT", 0, 0],
    ["operation", "TEXT", 1, 0],
    ["request_sha256", "TEXT", 1, 0],
    ["expected_revision", "INTEGER", 0, 0],
    ["committed_revision", "INTEGER", 0, 0],
    ["outcome_json", "TEXT", 1, 0],
    ["created_at_ms", "INTEGER", 1, 0],
  ],
} as const;

const EXPECTED_INDEXES = {
  schema_migrations: [],
  game_meta: [
    {
      name: "sqlite_autoindex_game_meta_1",
      unique: 1,
      origin: "pk",
      columns: ["key"],
    },
  ],
  players: [
    {
      name: "sqlite_autoindex_players_1",
      unique: 1,
      origin: "pk",
      columns: ["user_id"],
    },
  ],
  idempotency: [
    {
      name: "idempotency_player",
      unique: 0,
      origin: "c",
      columns: ["player_user_id"],
    },
    {
      name: "idempotency_user_created",
      unique: 0,
      origin: "c",
      columns: ["user_id", "created_at_ms"],
    },
    {
      name: "sqlite_autoindex_idempotency_1",
      unique: 1,
      origin: "pk",
      columns: ["interaction_id"],
    },
  ],
} as const;

const SafeRevisionSchema = z.number().int().positive().max(MAX_SAFE_INTEGER);
const StoredOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      outcome: z.unknown(),
      revision: SafeRevisionSchema,
      status: z.literal("committed"),
    })
    .strict(),
  z
    .object({
      outcome: z.unknown(),
      revision: SafeRevisionSchema.nullable(),
      status: z.literal("rejected"),
    })
    .strict(),
]);

type StoredOutcome = z.infer<typeof StoredOutcomeSchema>;

const LegacyFilesSchema = z
  .array(
    z
      .object({
        name: z.enum(LEGACY_RPG_FILES),
        size: z.number().int().nonnegative(),
        modifiedAtMs: z.number().int().nonnegative(),
      })
      .strict(),
  )
  .max(LEGACY_RPG_FILES.length);

interface PlayerRow {
  revision: number;
  schema_version: number;
  state_json: string;
  created_at_ms: number;
  updated_at_ms: number;
}

interface IdempotencyRow {
  scope: string;
  user_id: string;
  player_user_id: string | null;
  operation: string;
  request_sha256: string;
  expected_revision: number | null;
  committed_revision: number | null;
  outcome_json: string;
  created_at_ms: number;
}

interface MigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at_ms: number;
}

interface SchemaObjectRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string;
}

interface TableColumnRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
  hidden: number;
}

interface IndexListRow {
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

interface ForeignKeyRow {
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

interface CanonicalJsonLimits {
  maximumBytes: number;
  maximumDepth: number;
  maximumProperties: number;
}

interface CanonicalJson {
  serialized: string;
  value: unknown;
}

export interface PlayerSnapshot {
  revision: number;
  state: PlayerState;
}

export type PlayerMutation<TResult> =
  | {
      kind: "commit";
      state: PlayerState;
      outcome: TResult;
    }
  | {
      kind: "reject";
      outcome: TResult;
    };

export interface PlayerTransaction<TResult> {
  scope: string;
  interactionId: string;
  operation: string;
  requestSha256: string;
  userId: string;
  expectedRevision: number | null;
  decodeOutcome: (value: unknown) => TResult;
  nowMs?: number;
  mutate: (current: PlayerState | null) => PlayerMutation<TResult>;
}

export interface PlayerTransactionReceiptQuery<TResult> {
  scope: string;
  interactionId: string;
  operation: string;
  requestSha256: string;
  userId: string;
  expectedRevision: number | null;
  decodeOutcome: (value: unknown) => TResult;
}

export type PlayerTransactionResult<TResult> =
  | {
      status: "committed";
      revision: number;
      outcome: TResult;
    }
  | {
      status: "rejected";
      revision: number | null;
      outcome: TResult;
    };

export type PersistedUserDataDeletionResult =
  | {
      status: "deleted";
      playerDeleted: boolean;
      idempotencyReceiptsDeleted: number;
    }
  | {
      status: "already_absent";
      playerDeleted: false;
      idempotencyReceiptsDeleted: 0;
    };

export interface DiscordHeroRepositoryOptions {
  databasePath?: string;
  busyTimeoutMs?: number;
  catalogDigest?: string;
  legacyDirectory?: string;
}

export class DiscordHeroRepositoryError extends Error {}

export class DiscordHeroRevisionConflictError extends DiscordHeroRepositoryError {
  constructor(
    readonly userId: string,
    readonly expectedRevision: number | null,
    readonly actualRevision: number | null,
  ) {
    super(
      `DiscordHero revision conflict for ${userId}: expected ${expectedRevision ?? "missing"}, actual ${actualRevision ?? "missing"}`,
    );
    this.name = "DiscordHeroRevisionConflictError";
  }
}

export class DiscordHeroIdempotencyConflictError extends DiscordHeroRepositoryError {
  constructor(readonly interactionId: string) {
    super(
      `DiscordHero interaction ID ${interactionId} was reused with different request metadata`,
    );
    this.name = "DiscordHeroIdempotencyConflictError";
  }
}

export class DiscordHeroCorruptStateError extends DiscordHeroRepositoryError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DiscordHeroCorruptStateError";
  }
}

function requireNonEmpty(
  value: string,
  label: string,
  maximumLength = 200,
): void {
  if (value.length === 0 || value.length > maximumLength) {
    throw new DiscordHeroRepositoryError(
      `${label} must contain 1-${maximumLength} characters`,
    );
  }
}

function validateUserId(value: unknown, source: "input" | "persisted"): string {
  const valid =
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 200 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value);
  if (valid) return value;

  if (source === "persisted") {
    throw new DiscordHeroCorruptStateError(
      "Persisted DiscordHero user ID is invalid",
    );
  }
  throw new DiscordHeroRepositoryError(
    "userId must be a string containing 1-200 characters with no surrounding whitespace or control characters",
  );
}

function requireSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new DiscordHeroRepositoryError(
      `${label} must be a lowercase SHA-256 digest`,
    );
  }
}

function requirePersistedSafeInteger(
  value: unknown,
  label: string,
  minimum: number,
  nullable = false,
): number | null {
  if (value === null && nullable) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new DiscordHeroCorruptStateError(
      `${label} is outside the JavaScript safe-integer range`,
    );
  }
  return value;
}

function assertPlayerIntegerFields(
  row: Pick<
    PlayerRow,
    "revision" | "schema_version" | "created_at_ms" | "updated_at_ms"
  >,
  userId: string,
): void {
  requirePersistedSafeInteger(
    row.revision,
    `DiscordHero player ${userId} revision`,
    1,
  );
  requirePersistedSafeInteger(
    row.schema_version,
    `DiscordHero player ${userId} schema version`,
    1,
  );
  const createdAtMs = requirePersistedSafeInteger(
    row.created_at_ms,
    `DiscordHero player ${userId} created timestamp`,
    0,
  );
  const updatedAtMs = requirePersistedSafeInteger(
    row.updated_at_ms,
    `DiscordHero player ${userId} updated timestamp`,
    0,
  );
  if (
    createdAtMs === null ||
    updatedAtMs === null ||
    updatedAtMs < createdAtMs
  ) {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero player ${userId} timestamps are inconsistent`,
    );
  }
}

function assertIdempotencyIntegerFields(
  row: Pick<
    IdempotencyRow,
    | "user_id"
    | "player_user_id"
    | "expected_revision"
    | "committed_revision"
    | "created_at_ms"
  >,
  interactionId: string,
): void {
  requirePersistedSafeInteger(
    row.expected_revision,
    `DiscordHero interaction ${interactionId} expected revision`,
    1,
    true,
  );
  const committedRevision = requirePersistedSafeInteger(
    row.committed_revision,
    `DiscordHero interaction ${interactionId} committed revision`,
    1,
    true,
  );
  requirePersistedSafeInteger(
    row.created_at_ms,
    `DiscordHero interaction ${interactionId} created timestamp`,
    0,
  );
  if (
    (committedRevision === null && row.player_user_id !== null) ||
    (committedRevision !== null && row.player_user_id !== row.user_id)
  ) {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero interaction ${interactionId} player binding is inconsistent`,
    );
  }
}

function validateOptions(options: DiscordHeroRepositoryOptions): {
  busyTimeoutMs: number;
  catalogDigest: string;
} {
  const busyTimeoutMs = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0) {
    throw new DiscordHeroRepositoryError(
      "busyTimeoutMs must be a non-negative safe integer",
    );
  }
  const catalogDigest = options.catalogDigest ?? COMPILED_PAYLOAD_SHA256;
  requireSha256(catalogDigest, "catalog digest");
  return { busyTimeoutMs, catalogDigest };
}

function validateReceiptQuery(
  input: PlayerTransactionReceiptQuery<unknown>,
): void {
  requireNonEmpty(input.scope, "scope");
  requireNonEmpty(input.interactionId, "interactionId");
  requireNonEmpty(input.operation, "operation");
  validateUserId(input.userId, "input");
  requireSha256(input.requestSha256, "requestSha256");
  if (
    input.expectedRevision !== null &&
    (!Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 1)
  ) {
    throw new DiscordHeroRepositoryError(
      "expectedRevision must be null or a positive safe integer",
    );
  }
  if (typeof input.decodeOutcome !== "function") {
    throw new DiscordHeroRepositoryError(
      "decodeOutcome must be an operation-owned runtime decoder",
    );
  }
}

function validateTransactionInput(input: PlayerTransaction<unknown>): void {
  validateReceiptQuery(input);
  if (
    input.nowMs !== undefined &&
    (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0)
  ) {
    throw new DiscordHeroRepositoryError(
      "nowMs must be a non-negative safe integer",
    );
  }
}

function canonicalizeJson(
  input: unknown,
  label: string,
  limits: CanonicalJsonLimits,
): CanonicalJson {
  const ancestors = new Set<object>();
  let properties = 0;
  let observedStringBytes = 0;

  const fail = (reason: string): never => {
    throw new DiscordHeroRepositoryError(
      `${label} must be canonical JSON: ${reason}`,
    );
  };

  const visit = (candidate: unknown, depth: number): unknown => {
    if (depth > limits.maximumDepth)
      fail(`depth exceeds ${limits.maximumDepth}`);
    if (candidate === null || typeof candidate === "boolean") return candidate;
    if (typeof candidate === "string") {
      observedStringBytes += Buffer.byteLength(candidate, "utf8");
      if (observedStringBytes > limits.maximumBytes) {
        fail(`serialized size exceeds ${limits.maximumBytes} bytes`);
      }
      return candidate;
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate) || Object.is(candidate, -0)) {
        fail("numbers must be finite and must not be negative zero");
      }
      return candidate;
    }
    if (typeof candidate !== "object") return fail("unsupported value type");
    const objectCandidate = candidate as object;
    if (ancestors.has(objectCandidate))
      fail("cyclic references are not supported");
    ancestors.add(objectCandidate);

    let normalized: unknown;
    if (Array.isArray(candidate)) {
      if (Object.getPrototypeOf(candidate) !== Array.prototype) {
        fail("unsupported array prototype");
      }
      if (candidate.length > limits.maximumProperties - properties) {
        fail(`property count exceeds ${limits.maximumProperties}`);
      }
      const keys = Reflect.ownKeys(candidate);
      if (keys.some((key) => typeof key === "symbol"))
        fail("symbol keys are not supported");
      const stringKeys = keys as string[];
      if (
        stringKeys.length !== candidate.length + 1 ||
        !stringKeys.includes("length")
      ) {
        fail("arrays must not contain holes or extra properties");
      }
      const result: unknown[] = [];
      for (let index = 0; index < candidate.length; index += 1) {
        const key = String(index);
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined ||
          descriptor.enumerable !== true ||
          !("value" in descriptor)
        ) {
          fail("arrays must contain enumerable data properties without holes");
        }
        properties += 1;
        if (properties > limits.maximumProperties) {
          fail(`property count exceeds ${limits.maximumProperties}`);
        }
        const dataDescriptor = descriptor as PropertyDescriptor & {
          value: unknown;
        };
        result.push(visit(dataDescriptor.value, depth + 1));
      }
      normalized = result;
    } else {
      if (Object.getPrototypeOf(objectCandidate) !== Object.prototype) {
        fail("unsupported object prototype");
      }
      const keys = Reflect.ownKeys(objectCandidate);
      if (keys.some((key) => typeof key === "symbol"))
        fail("symbol keys are not supported");
      const stringKeys = (keys as string[]).sort();
      const result: Record<string, unknown> = {};
      for (const key of stringKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(
          objectCandidate,
          key,
        );
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined ||
          descriptor.enumerable !== true ||
          !("value" in descriptor)
        ) {
          fail("object properties must be enumerable data properties");
        }
        properties += 1;
        observedStringBytes += Buffer.byteLength(key, "utf8");
        if (properties > limits.maximumProperties) {
          fail(`property count exceeds ${limits.maximumProperties}`);
        }
        if (observedStringBytes > limits.maximumBytes) {
          fail(`serialized size exceeds ${limits.maximumBytes} bytes`);
        }
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value: visit(
            (descriptor as PropertyDescriptor & { value: unknown }).value,
            depth + 1,
          ),
          writable: true,
        });
      }
      normalized = result;
    }

    ancestors.delete(objectCandidate);
    return normalized;
  };

  const normalized = visit(input, 0);
  const serialized = JSON.stringify(normalized);
  if (serialized === undefined) fail("unsupported root value");
  if (Buffer.byteLength(serialized, "utf8") > limits.maximumBytes) {
    fail(`serialized size exceeds ${limits.maximumBytes} bytes`);
  }
  return {
    serialized,
    value: JSON.parse(serialized) as unknown,
  };
}

function parseCanonicalJson(
  serialized: string,
  label: string,
  limits: CanonicalJsonLimits,
): unknown {
  if (Buffer.byteLength(serialized, "utf8") > limits.maximumBytes) {
    throw new DiscordHeroCorruptStateError(
      `${label} exceeds ${limits.maximumBytes} persisted bytes`,
    );
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    const canonical = canonicalizeJson(parsed, label, limits);
    if (canonical.serialized !== serialized) {
      throw new DiscordHeroCorruptStateError(
        `${label} is not stored in canonical form`,
      );
    }
    return canonical.value;
  } catch (error) {
    if (error instanceof DiscordHeroCorruptStateError) throw error;
    throw new DiscordHeroCorruptStateError(
      `${label} contains invalid persisted JSON`,
      {
        cause: error,
      },
    );
  }
}

const STATE_JSON_LIMITS: CanonicalJsonLimits = {
  maximumBytes: MAX_PLAYER_STATE_JSON_BYTES,
  maximumDepth: MAX_JSON_DEPTH,
  maximumProperties: MAX_STATE_JSON_PROPERTIES,
};

const OUTCOME_JSON_LIMITS: CanonicalJsonLimits = {
  maximumBytes: MAX_TRANSACTION_OUTCOME_JSON_BYTES,
  maximumDepth: MAX_JSON_DEPTH,
  maximumProperties: MAX_OUTCOME_JSON_PROPERTIES,
};

function parseStoredOutcome(
  row: IdempotencyRow,
  interactionId: string,
): StoredOutcome {
  assertIdempotencyIntegerFields(row, interactionId);

  let stored: StoredOutcome;
  try {
    stored = StoredOutcomeSchema.parse(
      parseCanonicalJson(
        row.outcome_json,
        `DiscordHero interaction ${interactionId} outcome`,
        OUTCOME_JSON_LIMITS,
      ),
    );
  } catch (error) {
    if (error instanceof DiscordHeroCorruptStateError) throw error;
    throw new DiscordHeroCorruptStateError(
      `DiscordHero interaction ${interactionId} outcome contract is invalid`,
      { cause: error },
    );
  }

  if (stored.revision !== row.committed_revision) {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero interaction ${interactionId} revision metadata is inconsistent`,
    );
  }

  const matchesLedger =
    stored.status === "committed"
      ? row.player_user_id === row.user_id &&
        ((row.expected_revision === null && stored.revision === 1) ||
          (row.expected_revision !== null &&
            stored.revision === row.expected_revision + 1))
      : row.committed_revision === row.expected_revision &&
        ((stored.revision === null && row.player_user_id === null) ||
          (stored.revision !== null && row.player_user_id === row.user_id));
  if (!matchesLedger) {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero interaction ${interactionId} outcome does not match its ledger columns`,
    );
  }

  return stored;
}

function decodeTransactionOutcome<TResult>(
  input: PlayerTransactionReceiptQuery<TResult>,
  value: unknown,
): TResult {
  try {
    return input.decodeOutcome(value);
  } catch (error) {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero interaction ${input.interactionId} operation ${input.operation} outcome is invalid`,
      { cause: error },
    );
  }
}

function parsePlayerState(serialized: string, userId: string): PlayerState {
  try {
    const parsed = PlayerStateSchema.parse(
      parseCanonicalJson(
        serialized,
        `DiscordHero player ${userId}`,
        STATE_JSON_LIMITS,
      ),
    );
    const canonical = canonicalizeJson(
      parsed,
      `DiscordHero player ${userId}`,
      STATE_JSON_LIMITS,
    );
    if (canonical.serialized !== serialized) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero player ${userId} does not match state schema canonical form`,
      );
    }
    return canonical.value as PlayerState;
  } catch (error) {
    if (error instanceof DiscordHeroCorruptStateError) throw error;
    throw new DiscordHeroCorruptStateError(
      `DiscordHero player ${userId} contains invalid persisted state`,
      { cause: error },
    );
  }
}

function observedLegacyFiles(directory: string): string {
  const files = LEGACY_RPG_FILES.flatMap((name) => {
    const path = join(directory, name);
    if (!existsSync(path)) return [];
    const file = statSync(path);
    return [{ name, size: file.size, modifiedAtMs: Math.trunc(file.mtimeMs) }];
  });
  return JSON.stringify(files);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().replace(/;$/, "");
}

function assertIntegrity(database: Database): void {
  const integrity = database
    .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
    .all()
    .map((row) => row.integrity_check);
  if (integrity.length !== 1 || integrity[0] !== "ok") {
    throw new DiscordHeroCorruptStateError(
      `DiscordHero SQLite integrity check failed: ${integrity.join("; ")}`,
    );
  }
  const foreignKeyFailures = database
    .query<Record<string, unknown>, []>("PRAGMA foreign_key_check")
    .all();
  if (foreignKeyFailures.length !== 0) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero SQLite foreign-key check failed",
    );
  }
}

function assertExactSchema(database: Database): void {
  const actualObjects = database
    .query<SchemaObjectRow, []>(
      `SELECT type, name, tbl_name, sql
       FROM sqlite_schema
       WHERE sql IS NOT NULL
       ORDER BY type, name`,
    )
    .all();
  if (actualObjects.length !== EXPECTED_SCHEMA_OBJECTS.length) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero schema contains missing or unexpected DDL objects",
    );
  }
  for (const [index, expected] of EXPECTED_SCHEMA_OBJECTS.entries()) {
    const actual = actualObjects[index];
    if (
      actual?.type !== expected.type ||
      actual.name !== expected.name ||
      actual.tbl_name !== expected.table ||
      normalizeSql(actual.sql) !== normalizeSql(expected.sql)
    ) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero schema DDL differs for ${expected.name}`,
      );
    }
  }

  for (const [table, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
    const tableDefinition = database
      .query<
        {
          name: string;
          type: string;
          ncol: number;
          wr: number;
          strict: number;
        },
        [string]
      >(
        "SELECT name, type, ncol, wr, strict FROM pragma_table_list WHERE name = ?",
      )
      .get(table);
    if (
      tableDefinition === null ||
      tableDefinition.type !== "table" ||
      tableDefinition.strict !== 1 ||
      tableDefinition.wr !== 0 ||
      tableDefinition.ncol !== expectedColumns.length
    ) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero table ${table} is not the expected STRICT table`,
      );
    }

    const actualColumns = database
      .query<TableColumnRow, []>(`PRAGMA table_xinfo('${table}')`)
      .all()
      .map((column) => [
        column.name,
        column.type,
        column.notnull,
        column.pk,
        column.dflt_value,
        column.hidden,
      ]);
    const expectedColumnShape = expectedColumns.map((column) => [
      ...column,
      null,
      0,
    ]);
    if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumnShape)) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero table ${table} columns differ from the required schema`,
      );
    }

    const actualIndexes = database
      .query<IndexListRow, []>(`PRAGMA index_list('${table}')`)
      .all()
      .map((index) => ({
        name: index.name,
        unique: index.unique,
        origin: index.origin,
        partial: index.partial,
        columns: database
          .query<{ name: string }, []>(`PRAGMA index_info('${index.name}')`)
          .all()
          .map((column) => column.name),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const expectedIndexes = [
      ...EXPECTED_INDEXES[table as keyof typeof EXPECTED_INDEXES],
    ]
      .map((index) => ({
        name: index.name,
        unique: index.unique,
        origin: index.origin,
        partial: 0,
        columns: [...index.columns],
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (JSON.stringify(actualIndexes) !== JSON.stringify(expectedIndexes)) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero table ${table} indexes differ from the required schema`,
      );
    }
  }

  const foreignKeys = database
    .query<ForeignKeyRow, []>("PRAGMA foreign_key_list('idempotency')")
    .all()
    .map((row) => ({
      table: row.table,
      from: row.from,
      to: row.to,
      onUpdate: row.on_update,
      onDelete: row.on_delete,
      match: row.match,
    }));
  if (
    JSON.stringify(foreignKeys) !==
    JSON.stringify([
      {
        table: "players",
        from: "player_user_id",
        to: "user_id",
        onUpdate: "NO ACTION",
        onDelete: "CASCADE",
        match: "NONE",
      },
    ])
  ) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero idempotency foreign key differs from the required schema",
    );
  }
}

function assertPersistedRows(database: Database): void {
  const migrations = database
    .query<MigrationRow, []>(
      "SELECT version, name, checksum, applied_at_ms FROM schema_migrations",
    )
    .all();
  for (const migration of migrations) {
    requirePersistedSafeInteger(
      migration.version,
      "DiscordHero migration version",
      1,
    );
    requirePersistedSafeInteger(
      migration.applied_at_ms,
      `DiscordHero migration ${migration.version} applied timestamp`,
      0,
    );
  }

  const players = database
    .query<PlayerRow & { user_id: string }, []>(
      `SELECT
         user_id,
         revision,
         schema_version,
         state_json,
         created_at_ms,
         updated_at_ms
       FROM players`,
    )
    .all();
  for (const player of players) {
    assertPlayerIntegerFields(player, player.user_id);
  }

  const receipts = database
    .query<IdempotencyRow & { interaction_id: string }, []>(
      `SELECT
         interaction_id,
         scope,
         user_id,
         player_user_id,
         operation,
         request_sha256,
         expected_revision,
         committed_revision,
         outcome_json,
         created_at_ms
       FROM idempotency`,
    )
    .all();
  for (const receipt of receipts) {
    parseStoredOutcome(receipt, receipt.interaction_id);
  }
}

function assertMigrationAndMeta(
  database: Database,
  catalogDigest: string,
): void {
  const migrations = database
    .query<MigrationRow, []>(
      "SELECT version, name, checksum, applied_at_ms FROM schema_migrations ORDER BY version",
    )
    .all();
  const migrationIdentity = migrations.map(({ version, name, checksum }) => ({
    version,
    name,
    checksum,
  }));
  if (
    JSON.stringify(migrationIdentity) !==
    JSON.stringify([
      {
        version: CURRENT_MIGRATION_VERSION,
        name: MIGRATION_NAME,
        checksum: MIGRATION_V1_CHECKSUM,
      },
    ])
  ) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero migration history or checksum does not match this binary",
    );
  }

  const metaRows = database
    .query<{ key: string; value: string }, []>(
      "SELECT key, value FROM game_meta ORDER BY key",
    )
    .all();
  const meta = new Map(metaRows.map((row) => [row.key, row.value]));
  const expectedKeys = [
    "app_compatibility_version",
    "catalog_digest",
    "legacy_rpg_files_observed",
    "origin",
    "state_schema_version",
  ];
  if (JSON.stringify([...meta.keys()]) !== JSON.stringify(expectedKeys)) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero required metadata keys are missing or unexpected",
    );
  }
  if (meta.get("catalog_digest") !== catalogDigest) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero catalog digest does not match the configured catalog",
    );
  }
  if (
    meta.get("state_schema_version") !== String(PLAYER_STATE_SCHEMA_VERSION)
  ) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero state schema version is incompatible with this binary",
    );
  }
  if (
    meta.get("app_compatibility_version") !==
    String(APPLICATION_COMPATIBILITY_VERSION)
  ) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero application compatibility version is incompatible with this binary",
    );
  }
  if (meta.get("origin") !== "fresh-v1") {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero database origin metadata is invalid",
    );
  }
  try {
    LegacyFilesSchema.parse(
      JSON.parse(meta.get("legacy_rpg_files_observed") ?? ""),
    );
  } catch (error) {
    throw new DiscordHeroCorruptStateError(
      "DiscordHero legacy-file observation metadata is invalid",
      { cause: error },
    );
  }
}

function assertOwnedDatabase(database: Database, catalogDigest: string): void {
  assertIntegrity(database);
  assertExactSchema(database);
  assertPersistedRows(database);
  assertMigrationAndMeta(database, catalogDigest);
}

function preflightExistingDatabase(
  databasePath: string,
  catalogDigest: string,
): void {
  let database: Database | null = null;
  try {
    database = new Database(databasePath, { readonly: true, strict: true });
    assertOwnedDatabase(database, catalogDigest);
    const journalMode = database
      .query<{ journal_mode: string }, []>("PRAGMA journal_mode")
      .get()?.journal_mode;
    if (journalMode !== "wal") {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero database journal mode is ${journalMode ?? "unknown"}, expected wal`,
      );
    }
  } catch (error) {
    if (error instanceof DiscordHeroRepositoryError) throw error;
    throw new DiscordHeroCorruptStateError(
      "Existing database is not an owned, complete DiscordHero database",
      { cause: error },
    );
  } finally {
    database?.close();
  }
}

export class DiscordHeroRepository {
  readonly databasePath: string;
  private readonly database: Database;
  private readonly catalogDigest: string;
  private closed = false;

  constructor(options: DiscordHeroRepositoryOptions = {}) {
    const validated = validateOptions(options);
    this.catalogDigest = validated.catalogDigest;
    this.databasePath =
      options.databasePath ?? globalFile("discordhero.sqlite");
    const existingNonempty =
      existsSync(this.databasePath) && statSync(this.databasePath).size > 0;

    if (existingNonempty) {
      preflightExistingDatabase(this.databasePath, this.catalogDigest);
    } else {
      mkdirSync(dirname(this.databasePath), { recursive: true });
    }

    this.database = new Database(this.databasePath, {
      create: true,
      readwrite: true,
      strict: true,
    });

    try {
      if (existingNonempty) {
        assertOwnedDatabase(this.database, this.catalogDigest);
      } else {
        this.database.run("PRAGMA journal_mode = WAL");
        this.database.run("PRAGMA foreign_keys = ON");
        this.migrateFresh(
          options.legacyDirectory ?? dirname(this.databasePath),
        );
      }
      this.database.run("PRAGMA foreign_keys = ON");
      this.database.run("PRAGMA synchronous = FULL");
      this.database.run(`PRAGMA busy_timeout = ${validated.busyTimeoutMs}`);
      this.database.run("PRAGMA wal_autocheckpoint = 1000");
      assertOwnedDatabase(this.database, this.catalogDigest);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  getMeta(key: string): string | null {
    this.assertOpen();
    requireNonEmpty(key, "meta key");
    const row = this.database
      .query<{ value: string }, [string]>(
        "SELECT value FROM game_meta WHERE key = ?",
      )
      .get(key);
    return row?.value ?? null;
  }

  getPlayer(userId: string): PlayerSnapshot | null {
    this.assertOpen();
    validateUserId(userId, "input");
    const row = this.database
      .query<PlayerRow, [string]>(
        `SELECT
           revision,
           schema_version,
           state_json,
           created_at_ms,
           updated_at_ms
         FROM players
         WHERE user_id = ?`,
      )
      .get(userId);
    if (row === null) return null;
    assertPlayerIntegerFields(row, userId);
    if (row.schema_version !== PLAYER_STATE_SCHEMA_VERSION) {
      throw new DiscordHeroCorruptStateError(
        `DiscordHero player ${userId} has unsupported state schema ${row.schema_version}`,
      );
    }
    return {
      revision: row.revision,
      state: parsePlayerState(row.state_json, userId),
    };
  }

  /**
   * Returns every user ID that owns any persisted DiscordHero datum.
   * This is the sorted union of player rows, idempotency receipt owners, and
   * receipt player references, including rejected receipts created before a
   * player exists.
   */
  listAllPersistedUserDataOwnerIds(): string[] {
    this.assertOpen();
    return this.database
      .query<{ user_id: string }, []>(
        `SELECT user_id
         FROM (
           SELECT user_id FROM players
           UNION
           SELECT user_id FROM idempotency
           UNION
           SELECT player_user_id AS user_id
           FROM idempotency
           WHERE player_user_id IS NOT NULL
         )
         ORDER BY user_id`,
      )
      .all()
      .map((row) => validateUserId(row.user_id, "persisted"));
  }

  /**
   * Atomically deletes a user's player plus every idempotency receipt owned by
   * or referencing that player. Repeating the deletion is explicitly harmless.
   */
  deleteAllPersistedUserDataForUser(
    userId: string,
  ): PersistedUserDataDeletionResult {
    this.assertOpen();
    validateUserId(userId, "input");

    const transaction = this.database.transaction(
      (): PersistedUserDataDeletionResult => {
        const receipts = this.database.run(
          `DELETE FROM idempotency
           WHERE user_id = ? OR player_user_id = ?`,
          [userId, userId],
        );
        const players = this.database.run(
          "DELETE FROM players WHERE user_id = ?",
          [userId],
        );
        if (receipts.changes === 0 && players.changes === 0) {
          return {
            status: "already_absent",
            playerDeleted: false,
            idempotencyReceiptsDeleted: 0,
          };
        }
        return {
          status: "deleted",
          playerDeleted: players.changes === 1,
          idempotencyReceiptsDeleted: receipts.changes,
        };
      },
    );

    return transaction.immediate();
  }

  getPlayerTransactionReceipt<TResult>(
    input: PlayerTransactionReceiptQuery<TResult>,
  ): PlayerTransactionResult<TResult> | null {
    this.assertOpen();
    validateReceiptQuery(input);
    const replay = this.database
      .query<IdempotencyRow, [string]>(
        `SELECT
           scope,
           user_id,
           player_user_id,
           operation,
           request_sha256,
           expected_revision,
           committed_revision,
           outcome_json,
           created_at_ms
         FROM idempotency
         WHERE interaction_id = ?`,
      )
      .get(input.interactionId);
    if (replay === null) return null;
    const stored = parseStoredOutcome(replay, input.interactionId);
    if (
      replay.scope !== input.scope ||
      replay.user_id !== input.userId ||
      replay.operation !== input.operation ||
      replay.request_sha256 !== input.requestSha256 ||
      replay.expected_revision !== input.expectedRevision
    ) {
      throw new DiscordHeroIdempotencyConflictError(input.interactionId);
    }
    if (stored.status === "committed") {
      return {
        status: "committed",
        revision: stored.revision,
        outcome: decodeTransactionOutcome(input, stored.outcome),
      };
    }
    return {
      status: "rejected",
      revision: stored.revision,
      outcome: decodeTransactionOutcome(input, stored.outcome),
    };
  }

  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult> {
    this.assertOpen();
    validateTransactionInput(input);

    const transaction = this.database.transaction(
      (): PlayerTransactionResult<TResult> => {
        const replay = this.getPlayerTransactionReceipt<TResult>(input);
        if (replay !== null) return replay;

        const currentRow = this.database
          .query<PlayerRow, [string]>(
            `SELECT
               revision,
               schema_version,
               state_json,
               created_at_ms,
               updated_at_ms
             FROM players
             WHERE user_id = ?`,
          )
          .get(input.userId);
        if (currentRow !== null) {
          assertPlayerIntegerFields(currentRow, input.userId);
        }
        const actualRevision = currentRow?.revision ?? null;
        if (actualRevision !== input.expectedRevision) {
          throw new DiscordHeroRevisionConflictError(
            input.userId,
            input.expectedRevision,
            actualRevision,
          );
        }

        const currentState =
          currentRow === null
            ? null
            : structuredClone(
                parsePlayerState(currentRow.state_json, input.userId),
              );
        const mutation = input.mutate(currentState);
        if (
          typeof mutation === "object" &&
          mutation !== null &&
          "then" in mutation &&
          typeof mutation.then === "function"
        ) {
          throw new DiscordHeroRepositoryError(
            "DiscordHero mutations must be synchronous and must not return a Promise",
          );
        }
        if (
          typeof mutation !== "object" ||
          mutation === null ||
          (mutation.kind !== "commit" && mutation.kind !== "reject")
        ) {
          throw new DiscordHeroRepositoryError(
            "DiscordHero mutation must return an explicit commit or reject result",
          );
        }

        const canonicalOutcome = canonicalizeJson(
          mutation.outcome,
          "transaction outcome",
          OUTCOME_JSON_LIMITS,
        );
        const decodedOutcome = decodeTransactionOutcome(
          input,
          canonicalOutcome.value,
        );
        const nowMs = input.nowMs ?? Date.now();
        let result: PlayerTransactionResult<TResult>;
        let playerUserId: string | null;

        if (mutation.kind === "reject") {
          result = {
            status: "rejected",
            revision: actualRevision,
            outcome: decodedOutcome,
          };
          playerUserId = currentRow === null ? null : input.userId;
        } else {
          canonicalizeJson(mutation.state, "player state", STATE_JSON_LIMITS);
          const nextState = PlayerStateSchema.parse(mutation.state);
          const canonicalState = canonicalizeJson(
            nextState,
            "player state",
            STATE_JSON_LIMITS,
          );
          if (actualRevision === MAX_SAFE_INTEGER) {
            throw new DiscordHeroRepositoryError(
              "DiscordHero player is already at the maximum safe revision",
            );
          }
          const committedRevision = (actualRevision ?? 0) + 1;
          result = {
            status: "committed",
            revision: committedRevision,
            outcome: decodedOutcome,
          };
          playerUserId = input.userId;

          if (currentRow === null) {
            this.database.run(
              `INSERT INTO players(
                 user_id,
                 revision,
                 schema_version,
                 state_json,
                 created_at_ms,
                 updated_at_ms
               ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                input.userId,
                committedRevision,
                PLAYER_STATE_SCHEMA_VERSION,
                canonicalState.serialized,
                nowMs,
                nowMs,
              ],
            );
          } else {
            const updated = this.database.run(
              `UPDATE players
               SET revision = ?, schema_version = ?, state_json = ?, updated_at_ms = ?
               WHERE user_id = ? AND revision = ?`,
              [
                committedRevision,
                PLAYER_STATE_SCHEMA_VERSION,
                canonicalState.serialized,
                nowMs,
                input.userId,
                actualRevision,
              ],
            );
            if (updated.changes !== 1) {
              const latest = this.database
                .query<{ revision: number }, [string]>(
                  "SELECT revision FROM players WHERE user_id = ?",
                )
                .get(input.userId);
              const latestRevision =
                latest === null
                  ? null
                  : requirePersistedSafeInteger(
                      latest.revision,
                      `DiscordHero player ${input.userId} latest revision`,
                      1,
                    );
              throw new DiscordHeroRevisionConflictError(
                input.userId,
                actualRevision,
                latestRevision,
              );
            }
          }
        }

        const storedOutcome = canonicalizeJson(
          result,
          "transaction outcome",
          OUTCOME_JSON_LIMITS,
        );
        this.database.run(
          `INSERT INTO idempotency(
             interaction_id,
             scope,
             user_id,
             player_user_id,
             operation,
             request_sha256,
             expected_revision,
             committed_revision,
             outcome_json,
             created_at_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.interactionId,
            input.scope,
            input.userId,
            playerUserId,
            input.operation,
            input.requestSha256,
            input.expectedRevision,
            result.revision,
            storedOutcome.serialized,
            nowMs,
          ],
        );

        return result;
      },
    );

    return transaction.immediate();
  }

  integrityCheck(): string[] {
    this.assertOpen();
    return this.database
      .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
      .all()
      .map((row) => row.integrity_check);
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private migrateFresh(legacyDirectory: string): void {
    const migrate = this.database.transaction(() => {
      this.database.run(`${MIGRATION_V1_SQL};`);
      const nowMs = Date.now();
      this.database.run(
        `INSERT INTO schema_migrations(version, name, checksum, applied_at_ms)
         VALUES (?, ?, ?, ?)`,
        [
          CURRENT_MIGRATION_VERSION,
          MIGRATION_NAME,
          MIGRATION_V1_CHECKSUM,
          nowMs,
        ],
      );
      this.database.run(
        `INSERT INTO game_meta(key, value) VALUES
           ('app_compatibility_version', ?),
           ('catalog_digest', ?),
           ('legacy_rpg_files_observed', ?),
           ('origin', 'fresh-v1'),
           ('state_schema_version', ?)`,
        [
          String(APPLICATION_COMPATIBILITY_VERSION),
          this.catalogDigest,
          observedLegacyFiles(legacyDirectory),
          String(PLAYER_STATE_SCHEMA_VERSION),
        ],
      );
      assertOwnedDatabase(this.database, this.catalogDigest);
    });
    migrate.immediate();
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new DiscordHeroRepositoryError("DiscordHero repository is closed");
    }
  }
}

export function openDiscordHeroRepository(
  options: DiscordHeroRepositoryOptions = {},
): DiscordHeroRepository {
  return new DiscordHeroRepository(options);
}
