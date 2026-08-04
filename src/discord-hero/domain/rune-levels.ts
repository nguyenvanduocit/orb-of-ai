import {
  getCatalogGroup,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";

type RuneRow = DiscordHeroDatasetRow<"runes">;
type RuneLevelRow = DiscordHeroDatasetRow<"rune_levels">;

export interface ResolvedRuneLevelRows {
  readonly reachable: readonly RuneLevelRow[];
  readonly unreachable: readonly RuneLevelRow[];
}

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

export function resolveRuneLevelRows(
  indexes: DiscordHeroCatalogIndexes,
  rune: RuneRow,
): ResolvedRuneLevelRows {
  requirePositiveSafeInteger(rune.MaxLevel, `rune ${rune.RuneKey} max level`);
  requirePositiveSafeInteger(
    rune.LevelDataKey,
    `rune ${rune.RuneKey} level data key`,
  );

  const sourceRows = getCatalogGroup(indexes, "rune_levels", rune.LevelDataKey);
  if (sourceRows.length < rune.MaxLevel) {
    throw new Error(
      `rune ${rune.RuneKey} has ${sourceRows.length} level rows; expected at least ${rune.MaxLevel}`,
    );
  }

  const currency = indexes.tables.currencies.rows[0];
  if (currency === undefined || indexes.tables.currencies.rows.length !== 1) {
    throw new Error("Rune upgrades require exactly one source currency");
  }
  const reachable = sourceRows.slice(0, rune.MaxLevel);
  for (const [index, row] of reachable.entries()) {
    const expectedLevel = index + 1;
    if (row.Level !== expectedLevel) {
      throw new Error(
        `rune ${rune.RuneKey} reachable row ${index} has level ${row.Level}; expected ${expectedLevel}`,
      );
    }
    if (row.CostItemKey !== currency.CurrencyKey) {
      throw new Error(
        `rune ${rune.RuneKey} level ${expectedLevel} has unsupported cost item`,
      );
    }
    requirePositiveSafeInteger(
      row.CostValue,
      `rune ${rune.RuneKey} level ${expectedLevel} cost`,
    );
    if (row.STATTYPE.length === 0) {
      throw new Error(
        `rune ${rune.RuneKey} level ${expectedLevel} stat type must be non-empty`,
      );
    }
    requirePositiveSafeInteger(
      row.Value,
      `rune ${rune.RuneKey} level ${expectedLevel} value`,
    );
  }

  const unreachable = sourceRows.slice(rune.MaxLevel);
  const finalReachable = reachable.at(-1)!;
  for (const [index, row] of unreachable.entries()) {
    if (
      row.Level !== rune.MaxLevel ||
      row.CostItemKey !== finalReachable.CostItemKey ||
      row.STATTYPE !== finalReachable.STATTYPE ||
      row.Value !== finalReachable.Value
    ) {
      throw new Error(
        `rune ${rune.RuneKey} trailing row ${index} is not a source-duplicate of max level ${rune.MaxLevel}`,
      );
    }
  }

  return Object.freeze({
    reachable: Object.freeze(reachable),
    unreachable: Object.freeze(unreachable),
  });
}
