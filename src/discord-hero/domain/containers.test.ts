import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";
import { quoteContainerSlotUnlock, unlockContainerSlot } from "./containers";

let indexes: DiscordHeroCatalogIndexes;
let fresh: PlayerState;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  fresh = createFreshPlayerStateFromCatalog(indexes, 101);
});

describe("DiscordHero source-backed container capacity", () => {
  test("quotes the next exact source row for every expandable container", () => {
    expect(quoteContainerSlotUnlock(indexes, fresh, "inventory")).toEqual({
      kind: "available",
      container: "inventory",
      slotIndex: 20,
      cost: 50,
      canAfford: true,
    });
    expect(quoteContainerSlotUnlock(indexes, fresh, "stash")).toEqual({
      kind: "available",
      container: "stash",
      slotIndex: 41,
      cost: 100,
      canAfford: true,
    });
    expect(quoteContainerSlotUnlock(indexes, fresh, "storage")).toEqual({
      kind: "available",
      container: "storage",
      slotIndex: 39,
      cost: 50,
      canAfford: true,
    });
    expect(quoteContainerSlotUnlock(indexes, fresh, "tradingStash")).toEqual({
      kind: "maximum-capacity",
      container: "tradingStash",
      unlockedSlots: 10,
    });
  });

  test("pays exact source cost and returns a new state", () => {
    const original = structuredClone(fresh);
    const result = unlockContainerSlot(indexes, fresh, "inventory");

    expect(result).toEqual({
      kind: "unlocked",
      container: "inventory",
      slotIndex: 20,
      cost: 50,
      state: expect.objectContaining({
        gold: 50,
        containers: expect.objectContaining({
          inventory: { unlockedSlots: 21, slots: [] },
        }),
      }),
    });
    expect(fresh).toEqual(original);
    expect(result.kind === "unlocked" && result.state).not.toBe(fresh);
  });

  test("rejects insufficient gold and maximum capacity without mutation", () => {
    const poor = structuredClone(fresh);
    poor.gold = 49;
    const original = structuredClone(poor);

    expect(unlockContainerSlot(indexes, poor, "inventory")).toEqual({
      kind: "insufficient-gold",
      container: "inventory",
      slotIndex: 20,
      cost: 50,
      availableGold: 49,
    });
    expect(poor).toEqual(original);
    expect(unlockContainerSlot(indexes, fresh, "tradingStash")).toEqual({
      kind: "maximum-capacity",
      container: "tradingStash",
      unlockedSlots: 10,
    });
  });

  test("rejects malformed persisted capacity instead of skipping source rows", () => {
    const malformed = structuredClone(fresh);
    malformed.containers.inventory.unlockedSlots = 19;

    expect(() =>
      quoteContainerSlotUnlock(indexes, malformed, "inventory"),
    ).toThrow("source row 19 still has zero unlock cost");
  });
});
