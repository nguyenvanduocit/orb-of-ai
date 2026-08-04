import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { OracleRequiredError } from "./combat";
import {
  classifyOfflineElapsed,
  type OfflineElapsedClassification,
} from "./progression";
import { resolveRuneLevelRows } from "./rune-levels";
import type { RandomSource } from "./stats";

export type SourceOfflineRewardRow = DiscordHeroDatasetRow<"offline_rewards">;

export interface OfflineRewardTable {
  readonly rows: readonly SourceOfflineRewardRow[];
}

export interface OfflineRuneState {
  readonly unlocked: boolean;
  readonly goldBonusPerThousand: number;
  readonly experienceBonusPerThousand: number;
}

export interface OfflineAccrualInspection {
  readonly elapsed: OfflineElapsedClassification;
  readonly rewardRow: SourceOfflineRewardRow;
  readonly runeState: OfflineRuneState;
}

export function createOfflineRewardTable(
  indexes: DiscordHeroCatalogIndexes,
): OfflineRewardTable {
  const rows = indexes.tables.offline_rewards.rows;
  if (rows.length !== 116) {
    throw new Error(
      `offline reward table must contain exactly 116 rows; received ${rows.length}`,
    );
  }
  const normalized = rows.map((row, index) => {
    const expectedStageLevel = index + 1;
    if (row.StageLevel !== expectedStageLevel) {
      throw new Error(
        `offline reward row ${index} has stage level ${row.StageLevel}; ` +
          `expected ${expectedStageLevel}`,
      );
    }
    validateOfflineRewardRow(row);
    return Object.freeze({
      StageLevel: row.StageLevel,
      BaseGold: row.BaseGold,
      BaseExp: row.BaseExp,
      KillCount: row.KillCount,
      ClearCount: row.ClearCount,
    });
  });
  return Object.freeze({ rows: Object.freeze(normalized) });
}

export function resolveOfflineRuneState(
  indexes: DiscordHeroCatalogIndexes,
  owned: readonly Readonly<{ key: number; level: number }>[],
): OfflineRuneState {
  const seenOwned = new Set<number>();
  let unlocked = false;
  let goldBonusPerThousand = 0;
  let experienceBonusPerThousand = 0;
  for (const entry of owned) {
    rejectUnknownFields(entry, ["key", "level"], "owned rune input");
    requirePositiveSafeInteger(entry.key, "owned rune key");
    requirePositiveSafeInteger(entry.level, `owned rune ${entry.key} level`);
    if (seenOwned.has(entry.key)) {
      throw new Error(`duplicate owned rune key ${entry.key}`);
    }
    seenOwned.add(entry.key);
    const rune = getCatalogRow(indexes, "runes", entry.key);
    requirePositiveSafeInteger(rune.MaxLevel, `rune ${rune.RuneKey} max level`);
    requirePositiveSafeInteger(
      rune.LevelDataKey,
      `rune ${rune.RuneKey} level data key`,
    );
    if (entry.level > rune.MaxLevel) {
      throw new Error(
        `owned rune ${entry.key} level ${entry.level} exceeds source max ${rune.MaxLevel}`,
      );
    }

    const levels = resolveRuneLevelRows(indexes, rune).reachable;
    for (const source of levels.slice(0, entry.level)) {
      requireNonNegativeSafeInteger(
        source.Value,
        `rune ${entry.key} level ${source.Level} value`,
      );
      if (source.STATTYPE === "UnlockOfflineReward" && source.Value > 0) {
        unlocked = true;
      }
      if (source.STATTYPE === "OfflineRewardGoldPercent") {
        goldBonusPerThousand = safeAdd(
          goldBonusPerThousand,
          source.Value,
          "offline gold rune bonus",
        );
      }
      if (source.STATTYPE === "OfflineRewardExpPercent") {
        experienceBonusPerThousand = safeAdd(
          experienceBonusPerThousand,
          source.Value,
          "offline experience rune bonus",
        );
      }
    }
  }
  return Object.freeze({
    unlocked,
    goldBonusPerThousand,
    experienceBonusPerThousand,
  });
}

interface OfflineAccrualInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly rewardStageLevel: number;
  readonly lastSeenAtMs: number;
  readonly nowMs: number;
  readonly ownedRunes: readonly Readonly<{ key: number; level: number }>[];
  readonly [key: string]: unknown;
}

export function inspectOfflineAccrual(
  input: OfflineAccrualInput,
): OfflineAccrualInspection {
  rejectUnknownFields(
    input,
    ["indexes", "rewardStageLevel", "lastSeenAtMs", "nowMs", "ownedRunes"],
    "offline accrual input",
  );
  const runeState = resolveOfflineRuneState(input.indexes, input.ownedRunes);
  if (!runeState.unlocked) {
    throw new Error("offline rewards are not unlocked");
  }
  requirePositiveSafeInteger(
    input.rewardStageLevel,
    "offline reward stage level",
  );
  const source = getCatalogRow(
    input.indexes,
    "offline_rewards",
    input.rewardStageLevel,
  );
  validateOfflineRewardRow(source);
  const rewardRow = Object.freeze({
    StageLevel: source.StageLevel,
    BaseGold: source.BaseGold,
    BaseExp: source.BaseExp,
    KillCount: source.KillCount,
    ClearCount: source.ClearCount,
  });
  return Object.freeze({
    elapsed: classifyOfflineElapsed(input.lastSeenAtMs, input.nowMs),
    rewardRow,
    runeState: Object.freeze({ ...runeState }),
  });
}

interface OfflineRewardResolutionInput extends OfflineAccrualInput {
  readonly rng: RandomSource;
}

export function resolveOfflineRewardAmounts(
  input: OfflineRewardResolutionInput,
): Readonly<{ gold: number; experience: number }> {
  rejectUnknownFields(
    input,
    [
      "indexes",
      "rewardStageLevel",
      "lastSeenAtMs",
      "nowMs",
      "ownedRunes",
      "rng",
    ],
    "offline reward resolution input",
  );
  const inspection = inspectOfflineAccrual({
    indexes: input.indexes,
    rewardStageLevel: input.rewardStageLevel,
    lastSeenAtMs: input.lastSeenAtMs,
    nowMs: input.nowMs,
    ownedRunes: input.ownedRunes,
  });
  if (inspection.elapsed.kind === "exact-zero") {
    return Object.freeze({ gold: 0, experience: 0 });
  }
  if (inspection.elapsed.kind !== "eligible") {
    throw new OracleRequiredError(
      `offline elapsed ${inspection.elapsed.kind} requires a runtime oracle`,
    );
  }
  throw new OracleRequiredError(
    "offline reward rate, rounding, and drop batching require a runtime oracle",
  );
}

function rejectUnknownFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unknown !== undefined) {
    throw new Error(`${context} has unknown field ${unknown}`);
  }
}

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function safeAdd(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${context} produced an unsafe integer`);
  }
  return result;
}

function validateOfflineRewardRow(row: SourceOfflineRewardRow): void {
  requirePositiveSafeInteger(row.StageLevel, "offline reward stage level");
  requireNonNegativeSafeInteger(
    row.BaseGold,
    `offline reward ${row.StageLevel}.BaseGold`,
  );
  requireNonNegativeSafeInteger(
    row.BaseExp,
    `offline reward ${row.StageLevel}.BaseExp`,
  );
  requireNonNegativeSafeInteger(
    row.KillCount,
    `offline reward ${row.StageLevel}.KillCount`,
  );
  requireNonNegativeSafeInteger(
    row.ClearCount,
    `offline reward ${row.StageLevel}.ClearCount`,
  );
}
