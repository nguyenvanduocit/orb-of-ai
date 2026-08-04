import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { GearAsset, PlayerState } from "../domain/player";
import {
  decodeDiscordHeroAlchemyPage,
  discordHeroAlchemyDebits,
  discordHeroAlchemyOptions,
  discordHeroAlchemyPageCount,
  encodeDiscordHeroAlchemyPage,
  isDiscordHeroAlchemyUnlocked,
} from "./alchemy";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function fresh(): PlayerState {
  return createFreshPlayerStateFromCatalog(indexes, 101);
}

function sword(instanceId: string): GearAsset {
  return {
    kind: "gear",
    instanceId,
    itemKey: 300001,
    rolledStats: [{ statModKey: 100101, value: 1.5 }],
  };
}

describe("DiscordHero Alchemy Inventory projection", () => {
  test("pages occupied slots in stable order with source-exact frozen option details", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    for (let index = 26; index >= 1; index -= 1) {
      state.containers.inventory.slots.push({
        index,
        asset: sword(`alchemy-${index}`),
      });
    }
    state.containers.inventory.slots.push({
      index: 0,
      asset: { kind: "stack", itemKey: 140001, quantity: 8 },
    });

    expect(discordHeroAlchemyPageCount(state)).toBe(2);
    const first = discordHeroAlchemyOptions(indexes, state, 0);
    const last = discordHeroAlchemyOptions(indexes, state, 1);

    expect(first).toHaveLength(25);
    expect(last).toHaveLength(2);
    expect(first.map((option) => option.slotIndex)).toEqual(
      Array.from({ length: 25 }, (_, index) => index),
    );
    expect(last.map((option) => option.slotIndex)).toEqual([25, 26]);
    expect(first[0]).toEqual({
      value: "0",
      label: "Slot 0 · 1 unit of Wood",
      description: "MATERIAL · — · Lv— · COMMON · 8 owned",
      slotIndex: 0,
      detail: {
        itemKey: 140001,
        name: "Wood",
        type: "MATERIAL",
        gearType: null,
        level: null,
        grade: "COMMON",
        quantity: 8,
        instanceId: null,
        rolledStats: [],
      },
    });
    expect(first[1]).toEqual({
      value: "1",
      label: "Slot 1 · Long Sword",
      description: "GEAR · SWORD · Lv1 · COMMON",
      slotIndex: 1,
      detail: {
        itemKey: 300001,
        name: "Long Sword",
        type: "GEAR",
        gearType: "SWORD",
        level: 1,
        grade: "COMMON",
        quantity: null,
        instanceId: "alchemy-1",
        rolledStats: [
          {
            statModKey: 100101,
            statType: "AttackDamage",
            modType: "FLAT",
            value: 1.5,
          },
        ],
      },
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0]!.detail)).toBe(true);
    expect(Object.isFrozen(first[1]!.detail.rolledStats)).toBe(true);

    const secondRead = discordHeroAlchemyOptions(indexes, state, 0);
    expect(secondRead).not.toBe(first);
    expect(secondRead[0]).not.toBe(first[0]);
    expect(secondRead[0]!.detail).not.toBe(first[0]!.detail);
    expect(secondRead[1]!.detail.rolledStats).not.toBe(
      first[1]!.detail.rolledStats,
    );
  });

  test("round-trips only canonical non-negative Alchemy pages", () => {
    expect(decodeDiscordHeroAlchemyPage(encodeDiscordHeroAlchemyPage(35))).toBe(
      35,
    );
    for (const value of ["a-00", "a--1", "a-A", "a-0-extra"]) {
      expect(() => decodeDiscordHeroAlchemyPage(value)).toThrow();
    }
    for (const page of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => encodeDiscordHeroAlchemyPage(page)).toThrow(
        "non-negative safe integer",
      );
    }
  });

  test("exposes availability only when the main and default sub-recipe are unlocked", () => {
    const state = fresh();

    expect(isDiscordHeroAlchemyUnlocked(state)).toBe(false);
    state.cube.unlockedRecipes.push(200001);
    expect(isDiscordHeroAlchemyUnlocked(state)).toBe(false);
    state.cube.unlockedSubRecipes.push(200011);
    expect(isDiscordHeroAlchemyUnlocked(state)).toBe(true);
    state.cube.unlockedRecipes = [];
    expect(isDiscordHeroAlchemyUnlocked(state)).toBe(false);
  });

  test("turns unique current-page slots into stable exact frozen one-item debits", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    state.containers.inventory.slots.push(
      { index: 4, asset: { kind: "stack", itemKey: 140001, quantity: 8 } },
      { index: 1, asset: sword("selected-instance") },
    );
    const before = structuredClone(state);

    const debits = discordHeroAlchemyDebits(state, 0, ["4", "1"]);

    expect(debits).toEqual([
      { kind: "gear", instanceId: "selected-instance" },
      { kind: "stack", itemKey: 140001, quantity: 1 },
    ]);
    expect(Object.isFrozen(debits)).toBe(true);
    expect(Object.isFrozen(debits[0])).toBe(true);
    expect(Object.isFrozen(debits[1])).toBe(true);
    const secondRead = discordHeroAlchemyDebits(state, 0, ["1", "4"]);
    expect(secondRead).not.toBe(debits);
    expect(secondRead[0]).not.toBe(debits[0]);
    expect(state).toEqual(before);
  });

  test("rejects zero, over-limit, duplicate, unknown, cross-page, and non-canonical selections", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    state.containers.inventory.slots.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        index,
        asset: sword(`validation-${index}`),
      })),
    );
    const before = structuredClone(state);

    expect(() => discordHeroAlchemyDebits(state, 0, [])).toThrow(
      "between 1 and 9",
    );
    expect(() =>
      discordHeroAlchemyDebits(
        state,
        0,
        Array.from({ length: 10 }, (_, index) => String(index)),
      ),
    ).toThrow("between 1 and 9");
    expect(() => discordHeroAlchemyDebits(state, 0, ["1", "1"])).toThrow(
      "duplicate slot 1",
    );
    expect(() => discordHeroAlchemyDebits(state, 0, ["99"])).toThrow(
      "is not on Alchemy page 0",
    );
    expect(() => discordHeroAlchemyDebits(state, 0, ["25"])).toThrow(
      "is not on Alchemy page 0",
    );
    expect(() => discordHeroAlchemyDebits(state, 0, ["01"])).toThrow(
      "non-canonical",
    );
    expect(() => discordHeroAlchemyDebits(state, 2, ["25"])).toThrow(
      "page 2 is outside 0-1",
    );
    expect(state).toEqual(before);
  });
});
