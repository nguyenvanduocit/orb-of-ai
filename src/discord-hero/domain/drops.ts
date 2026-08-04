import { OracleRequiredError, type RandomSource } from "./items";

export interface SourceDropRow {
  DropKey: number;
  DropType: string;
  REWARDTYPE: string;
  RewardKey: number;
  HeroKeyCondition: number | null;
  Weight: number;
}

export interface SourceItemGroupRow {
  ItemGroupKey: number;
  GroupName?: string;
  ItemKey: number;
}

export interface PreflightedWeightedDrop {
  dropKey: number;
  rows: readonly SourceDropRow[];
  totalWeight: number;
}

function requireSafeWeight(weight: number, context: string): void {
  if (!Number.isSafeInteger(weight) || weight < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function requireRandom(rng: RandomSource, context: string): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${context} RNG must return a value in [0, 1)`);
  }
  return value;
}

export function preflightWeightedDrop(
  rows: readonly SourceDropRow[],
): PreflightedWeightedDrop {
  if (rows.length === 0) {
    throw new Error("drop table must contain at least one row");
  }
  const dropKey = rows[0]!.DropKey;
  if (rows.some((row) => row.DropKey !== dropKey)) {
    throw new Error("weighted drop rows must share one DropKey");
  }
  if (
    rows.some(
      (row) =>
        row.DropType !== "EachDropOneWeight" || row.HeroKeyCondition !== null,
    )
  ) {
    throw new OracleRequiredError(
      `drop ${dropKey} requires unresolved conditional oracle`,
    );
  }

  let total = 0;
  for (const [index, row] of rows.entries()) {
    requireSafeWeight(row.Weight, `drop ${dropKey} weight ${index}`);
    total += row.Weight;
    if (!Number.isSafeInteger(total)) {
      throw new Error(
        `drop ${dropKey} total weight exceeds safe integer range`,
      );
    }
  }
  if (total <= 0) {
    throw new Error(`drop ${dropKey} must have positive weight`);
  }
  return Object.freeze({
    dropKey,
    rows: Object.freeze(rows.map((row) => Object.freeze({ ...row }))),
    totalWeight: total,
  });
}

export function selectPreflightedWeightedDrop(
  prepared: PreflightedWeightedDrop,
  rng: RandomSource,
): SourceDropRow {
  const target =
    requireRandom(rng, `drop ${prepared.dropKey}`) * prepared.totalWeight;
  let cumulative = 0;
  for (const row of prepared.rows) {
    cumulative += row.Weight;
    if (target < cumulative) return row;
  }
  throw new Error(`drop ${prepared.dropKey} weighted selection failed`);
}

export function selectWeightedDrop(
  rows: readonly SourceDropRow[],
  rng: RandomSource,
): SourceDropRow {
  return {
    ...selectPreflightedWeightedDrop(preflightWeightedDrop(rows), rng),
  };
}

export function rewardItemCandidates(
  row: SourceDropRow,
  itemGroups: readonly SourceItemGroupRow[],
): readonly number[] {
  if (row.REWARDTYPE === "ITEM") return [row.RewardKey];
  if (row.REWARDTYPE !== "ITEMGROUP") {
    throw new OracleRequiredError(
      `drop ${row.DropKey} reward type ${row.REWARDTYPE} requires oracle`,
    );
  }

  const candidates = itemGroups
    .filter((group) => group.ItemGroupKey === row.RewardKey)
    .map((group) => group.ItemKey);
  if (candidates.length === 0) {
    throw new Error(`missing item group ${row.RewardKey}`);
  }
  return candidates;
}
