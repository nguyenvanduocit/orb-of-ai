import {
  getCatalogRow,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import type { PlayerState } from "./player";
import { resolveRuneLevelRows } from "./rune-levels";

export type RuneUpgradeQuote =
  | Readonly<{
      kind: "available";
      runeKey: number;
      name: string;
      currentLevel: number;
      nextLevel: number;
      cost: number;
      canAfford: boolean;
      statType: string;
      value: number;
    }>
  | Readonly<{
      kind: "maximum-level";
      runeKey: number;
      name: string;
      level: number;
    }>
  | Readonly<{
      kind: "unsupported-effect";
      runeKey: number;
      name: string;
      currentLevel: number;
      nextLevel: number;
      cost: number;
      statType: string;
      value: number;
    }>
  | Readonly<{
      kind: "prerequisite-locked";
      runeKey: number;
      name: string;
      currentLevel: number;
      requiredLevel: number;
      predecessorKeys: readonly number[];
    }>;

export type RuneUpgradeResult =
  | Readonly<{
      kind: "upgraded";
      runeKey: number;
      name: string;
      level: number;
      cost: number;
      statType: string;
      value: number;
      state: PlayerState;
    }>
  | Readonly<{
      kind: "insufficient-gold";
      runeKey: number;
      name: string;
      nextLevel: number;
      cost: number;
      availableGold: number;
    }>
  | Extract<RuneUpgradeQuote, { kind: "maximum-level" }>
  | Extract<RuneUpgradeQuote, { kind: "unsupported-effect" }>
  | Extract<RuneUpgradeQuote, { kind: "prerequisite-locked" }>;

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function parseRuneEdges(
  value: string | number | null,
  runeKey: number,
): readonly number[] {
  if (value === null) return [];
  if (typeof value === "number") {
    requirePositiveSafeInteger(value, `rune ${runeKey}.NextRuneKey`);
    return [value];
  }
  if (!/^[1-9]\d*( [1-9]\d*)*$/.test(value)) {
    throw new Error(
      `rune ${runeKey}.NextRuneKey has invalid key list ${JSON.stringify(value)}`,
    );
  }
  return value.split(" ").map(Number);
}

function runePredecessors(
  indexes: DiscordHeroCatalogIndexes,
): ReadonlyMap<number, readonly number[]> {
  const mutable = new Map<number, number[]>();
  for (const rune of indexes.tables.runes.rows) {
    for (const nextKey of parseRuneEdges(rune.NextRuneKey, rune.RuneKey)) {
      getCatalogRow(indexes, "runes", nextKey);
      const predecessors = mutable.get(nextKey) ?? [];
      predecessors.push(rune.RuneKey);
      mutable.set(nextKey, predecessors);
    }
  }
  return new Map(
    [...mutable].map(([key, predecessors]) => [
      key,
      Object.freeze([...predecessors]),
    ]),
  );
}

export function quoteRuneUpgrade(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  runeKey: number,
): RuneUpgradeQuote {
  requirePositiveSafeInteger(runeKey, "rune upgrade key");
  requireNonNegativeSafeInteger(state.gold, "DiscordHero gold");
  const rune = getCatalogRow(indexes, "runes", runeKey);
  requirePositiveSafeInteger(rune.MaxLevel, `rune ${runeKey} max level`);
  requirePositiveSafeInteger(
    rune.LevelDataKey,
    `rune ${runeKey} level data key`,
  );
  const owned = new Map<number, number>();
  for (const progress of state.runes) {
    requirePositiveSafeInteger(progress.key, "owned rune key");
    requirePositiveSafeInteger(
      progress.level,
      `owned rune ${progress.key} level`,
    );
    if (owned.has(progress.key)) {
      throw new Error(`duplicate owned rune key ${progress.key}`);
    }
    const ownedRune = getCatalogRow(indexes, "runes", progress.key);
    if (progress.level > ownedRune.MaxLevel) {
      throw new Error(
        `owned rune ${progress.key} level exceeds source max ${ownedRune.MaxLevel}`,
      );
    }
    owned.set(progress.key, progress.level);
  }

  const currentLevel = owned.get(runeKey) ?? 0;
  const name = getLocalizedCatalogName(indexes, "runes", runeKey, "en-US");
  const levelRows = resolveRuneLevelRows(indexes, rune).reachable;
  if (currentLevel === rune.MaxLevel) {
    return Object.freeze({
      kind: "maximum-level",
      runeKey,
      name,
      level: currentLevel,
    });
  }

  const predecessors = runePredecessors(indexes).get(runeKey) ?? [];
  if (predecessors.length > 0) {
    const requiredLevel = rune.PrevNodeRequiredLevel ?? 1;
    requirePositiveSafeInteger(
      requiredLevel,
      `rune ${runeKey} predecessor requirement`,
    );
    if (
      !predecessors.some(
        (predecessorKey) => (owned.get(predecessorKey) ?? 0) >= requiredLevel,
      )
    ) {
      return Object.freeze({
        kind: "prerequisite-locked",
        runeKey,
        name,
        currentLevel,
        requiredLevel,
        predecessorKeys: Object.freeze([...predecessors]),
      });
    }
  } else if (rune.PrevNodeRequiredLevel !== null) {
    throw new Error(
      `rune ${runeKey} requires predecessor level ${rune.PrevNodeRequiredLevel} but has no incoming edge`,
    );
  }

  const nextLevel = currentLevel + 1;
  const level = levelRows[nextLevel - 1]!;
  if (
    level.STATTYPE !== "CubeAlchemyGoldPercent" &&
    level.STATTYPE !== "CubeExpPercent" &&
    level.STATTYPE !== "UnlockArrangeSlotCount"
  ) {
    return Object.freeze({
      kind: "unsupported-effect",
      runeKey,
      name,
      currentLevel,
      nextLevel,
      cost: level.CostValue,
      statType: level.STATTYPE,
      value: level.Value,
    });
  }

  return Object.freeze({
    kind: "available",
    runeKey,
    name,
    currentLevel,
    nextLevel,
    cost: level.CostValue,
    canAfford: state.gold >= level.CostValue,
    statType: level.STATTYPE,
    value: level.Value,
  });
}

export function upgradeRune(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  runeKey: number,
): RuneUpgradeResult {
  const quote = quoteRuneUpgrade(indexes, state, runeKey);
  if (quote.kind !== "available") return quote;
  if (!quote.canAfford) {
    return Object.freeze({
      kind: "insufficient-gold",
      runeKey,
      name: quote.name,
      nextLevel: quote.nextLevel,
      cost: quote.cost,
      availableGold: state.gold,
    });
  }

  const next = structuredClone(state);
  next.gold -= quote.cost;
  const existing = next.runes.find((progress) => progress.key === runeKey);
  if (existing === undefined) {
    next.runes.push({ key: runeKey, level: 1 });
  } else {
    existing.level += 1;
  }
  const sourceOrder = new Map(
    indexes.tables.runes.rows.map((rune, index) => [rune.RuneKey, index]),
  );
  next.runes.sort(
    (left, right) => sourceOrder.get(left.key)! - sourceOrder.get(right.key)!,
  );
  return Object.freeze({
    kind: "upgraded",
    runeKey,
    name: quote.name,
    level: quote.nextLevel,
    cost: quote.cost,
    statType: quote.statType,
    value: quote.value,
    state: next,
  });
}
