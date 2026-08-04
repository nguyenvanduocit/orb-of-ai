import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "../catalog/indexes";
import type { PlayerState } from "./player";

export const DISCORD_HERO_CONTAINERS = [
  "inventory",
  "stash",
  "storage",
  "tradingStash",
] as const;

export type DiscordHeroContainer =
  (typeof DISCORD_HERO_CONTAINERS)[number];

const SOURCE_TABLE = {
  inventory: "inventory",
  stash: "stash",
  storage: "storage",
  tradingStash: "trading_stash",
} as const satisfies Record<DiscordHeroContainer, DiscordHeroDatasetName>;

export type ContainerSlotUnlockQuote =
  | {
      kind: "available";
      container: DiscordHeroContainer;
      slotIndex: number;
      cost: number;
      canAfford: boolean;
    }
  | {
      kind: "maximum-capacity";
      container: DiscordHeroContainer;
      unlockedSlots: number;
    };

export type ContainerSlotUnlockResult =
  | {
      kind: "unlocked";
      container: DiscordHeroContainer;
      slotIndex: number;
      cost: number;
      state: PlayerState;
    }
  | {
      kind: "insufficient-gold";
      container: DiscordHeroContainer;
      slotIndex: number;
      cost: number;
      availableGold: number;
    }
  | Extract<ContainerSlotUnlockQuote, { kind: "maximum-capacity" }>;

function requireSafeNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

export function quoteContainerSlotUnlock(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  container: DiscordHeroContainer,
): ContainerSlotUnlockQuote {
  const unlockedSlots = state.containers[container].unlockedSlots;
  const tableName = SOURCE_TABLE[container];
  const sourceRows = indexes.tables[tableName].rows;
  requireSafeNonNegativeInteger(
    unlockedSlots,
    `${container} unlocked capacity`,
  );
  requireSafeNonNegativeInteger(state.gold, "DiscordHero gold");

  if (unlockedSlots === sourceRows.length) {
    return {
      kind: "maximum-capacity",
      container,
      unlockedSlots,
    };
  }
  if (unlockedSlots > sourceRows.length) {
    throw new Error(
      `${container} unlocked capacity ${unlockedSlots} exceeds source maximum ${sourceRows.length}`,
    );
  }

  const row = getCatalogRow(indexes, tableName, unlockedSlots) as {
    readonly Index: number;
    readonly CostForUnlock: number;
  };
  requireSafeNonNegativeInteger(row.Index, `${tableName}.Index`);
  requireSafeNonNegativeInteger(
    row.CostForUnlock,
    `${tableName}[${row.Index}].CostForUnlock`,
  );
  if (row.Index !== unlockedSlots) {
    throw new Error(
      `${tableName} source row ${row.Index} does not match next slot ${unlockedSlots}`,
    );
  }
  if (row.CostForUnlock === 0) {
    throw new Error(
      `${container} source row ${unlockedSlots} still has zero unlock cost`,
    );
  }

  return {
    kind: "available",
    container,
    slotIndex: unlockedSlots,
    cost: row.CostForUnlock,
    canAfford: state.gold >= row.CostForUnlock,
  };
}

export function unlockContainerSlot(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  container: DiscordHeroContainer,
): ContainerSlotUnlockResult {
  const quote = quoteContainerSlotUnlock(indexes, state, container);
  if (quote.kind === "maximum-capacity") return quote;
  if (!quote.canAfford) {
    return {
      kind: "insufficient-gold",
      container,
      slotIndex: quote.slotIndex,
      cost: quote.cost,
      availableGold: state.gold,
    };
  }

  const next = structuredClone(state);
  next.gold -= quote.cost;
  next.containers[container].unlockedSlots += 1;
  return {
    kind: "unlocked",
    container,
    slotIndex: quote.slotIndex,
    cost: quote.cost,
    state: next,
  };
}
