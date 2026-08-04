import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { GearAsset, PlayerState } from "../domain/player";
import { encodeDiscordHeroCustomId } from "./custom-id";
import {
  DISCORD_HERO_INVENTORY_ALL_FILTER,
  decodeDiscordHeroEquipTarget,
  decodeDiscordHeroEquipmentPage,
  decodeDiscordHeroInventoryPage,
  decodeDiscordHeroRollPageTarget,
  decodeDiscordHeroUnequipTarget,
  discordHeroCompatibleEquipHeroes,
  discordHeroEquippedGear,
  discordHeroEquippedGearPageCount,
  discordHeroFreeInventorySlots,
  discordHeroInventoryPageCount,
  discordHeroInventorySlots,
  encodeDiscordHeroEquipTarget,
  encodeDiscordHeroEquipmentPage,
  encodeDiscordHeroEquipmentRollPageTarget,
  encodeDiscordHeroInventoryPage,
  encodeDiscordHeroInventoryRollPageTarget,
  encodeDiscordHeroUnequipTarget,
  readDiscordHeroStoredAsset,
  type DiscordHeroInventoryFilter,
} from "./inventory";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function fresh(): PlayerState {
  return createFreshPlayerStateFromCatalog(indexes, 101);
}

function sword(instanceId: string, value = 1.5): GearAsset {
  return {
    kind: "gear",
    instanceId,
    itemKey: 300001,
    rolledStats: [{ statModKey: 100101, value }],
  };
}

describe("DiscordHero Inventory source view", () => {
  test("filters mixed owned assets before stable pagination without changing slot identity", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 80;
    for (let index = 25; index >= 0; index -= 1) {
      state.containers.inventory.slots.push({
        index,
        asset: sword(`filtered-sword-${index}`),
      });
    }
    state.containers.inventory.slots.push(
      {
        index: 40,
        asset: { kind: "stack", itemKey: 140001, quantity: 2 },
      },
      {
        index: 41,
        asset: { kind: "stack", itemKey: 112001, quantity: 3 },
      },
      {
        index: 50,
        asset: { kind: "stack", itemKey: 910011, quantity: 1 },
      },
    );
    const before = structuredClone(state);
    const all = DISCORD_HERO_INVENTORY_ALL_FILTER;
    const gear = { kind: "stored-kind", value: "gear" } as const;
    const stacks = { kind: "stored-kind", value: "stack" } as const;
    const material = { kind: "item-type", value: "MATERIAL" } as const;
    const stageBox = { kind: "item-type", value: "STAGEBOX" } as const;
    const swords = { kind: "gear-type", value: "SWORD" } as const;
    const common = { kind: "grade", value: "COMMON" } as const;
    const rare = { kind: "grade", value: "RARE" } as const;

    expect(discordHeroInventoryPageCount(indexes, state, all)).toBe(2);
    expect(
      [0, 1].flatMap((page) =>
        discordHeroInventorySlots(indexes, state, all, page).map(
          (slot) => slot.index,
        ),
      ),
    ).toEqual([...Array.from({ length: 26 }, (_, index) => index), 40, 41, 50]);
    expect(discordHeroInventoryPageCount(indexes, state, swords)).toBe(2);
    expect(
      [0, 1].flatMap((page) =>
        discordHeroInventorySlots(indexes, state, swords, page).map(
          (slot) => slot.index,
        ),
      ),
    ).toEqual(Array.from({ length: 26 }, (_, index) => index));
    expect(
      discordHeroInventorySlots(indexes, state, gear, 1).map(
        (slot) => slot.index,
      ),
    ).toEqual([25]);
    expect(
      discordHeroInventorySlots(indexes, state, stacks, 0).map(
        (slot) => slot.index,
      ),
    ).toEqual([40, 41, 50]);
    expect(
      discordHeroInventorySlots(indexes, state, material, 0).map(
        (slot) => slot.index,
      ),
    ).toEqual([40, 41]);
    expect(
      discordHeroInventorySlots(indexes, state, stageBox, 0).map(
        (slot) => slot.index,
      ),
    ).toEqual([50]);
    expect(
      [0, 1].flatMap((page) =>
        discordHeroInventorySlots(indexes, state, common, page).map(
          (slot) => slot.index,
        ),
      ),
    ).toEqual([...Array.from({ length: 26 }, (_, index) => index), 40, 50]);
    expect(
      discordHeroInventorySlots(indexes, state, rare, 0).map(
        (slot) => slot.index,
      ),
    ).toEqual([41]);
    expect(state).toEqual(before);
  });

  test("filters nonmatching assets before sorting matching slot indexes", () => {
    const state = fresh();
    let nonmatchingIndexReads = 0;
    const nonmatching = {
      get index(): number {
        nonmatchingIndexReads += 1;
        throw new Error("nonmatching slot entered Inventory sorting");
      },
      asset: { kind: "stack", itemKey: 140001, quantity: 2 },
    } satisfies PlayerState["containers"]["inventory"]["slots"][number];
    state.containers.inventory.slots.push(
      { index: 4, asset: sword("filter-before-sort-4") },
      nonmatching,
      { index: 1, asset: sword("filter-before-sort-1") },
    );

    expect(
      discordHeroInventorySlots(
        indexes,
        state,
        { kind: "stored-kind", value: "gear" },
        0,
      ).map((slot) => slot.index),
    ).toEqual([1, 4]);
    expect(nonmatchingIndexReads).toBe(0);
  });

  test("makes every occupied slot reachable in deterministic pages of at most 25", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    for (let index = 59; index >= 0; index -= 1) {
      state.containers.inventory.slots.push({
        index,
        asset: sword(`inventory-${index}`),
      });
    }

    expect(
      discordHeroInventoryPageCount(
        indexes,
        state,
        DISCORD_HERO_INVENTORY_ALL_FILTER,
      ),
    ).toBe(3);
    expect(
      [0, 1, 2].map((page) =>
        discordHeroInventorySlots(
          indexes,
          state,
          DISCORD_HERO_INVENTORY_ALL_FILTER,
          page,
        ).map((slot) => slot.index),
      ),
    ).toEqual([
      Array.from({ length: 25 }, (_, index) => index),
      Array.from({ length: 25 }, (_, index) => index + 25),
      Array.from({ length: 10 }, (_, index) => index + 50),
    ]);
    expect(() =>
      discordHeroInventorySlots(
        indexes,
        state,
        DISCORD_HERO_INVENTORY_ALL_FILTER,
        3,
      ),
    ).toThrow("Inventory page 3 is outside 0-2");
  });

  test("reads exact source item identity and every persisted rolled stat", () => {
    expect(
      readDiscordHeroStoredAsset(indexes, sword("source-sword", 1.5)),
    ).toEqual({
      itemKey: 300001,
      name: "Long Sword",
      type: "GEAR",
      gearType: "SWORD",
      level: 1,
      grade: "COMMON",
      quantity: null,
      instanceId: "source-sword",
      rolledStats: [
        {
          statModKey: 100101,
          statType: "AttackDamage",
          modType: "FLAT",
          value: 1.5,
        },
      ],
    });
  });

  test("offers only compatible owned heroes whose exact gear slot is empty", () => {
    const state = fresh();
    state.containers.inventory.slots.push({
      index: 4,
      asset: sword("hero-choice"),
    });

    expect(
      discordHeroCompatibleEquipHeroes(indexes, state, 4).map(
        (hero) => hero.heroKey,
      ),
    ).toEqual([101]);

    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: sword("already-equipped"),
    });
    expect(discordHeroCompatibleEquipHeroes(indexes, state, 4)).toEqual([]);
  });

  test("pages equipped gear and explicit free unlocked inventory slots", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 60;
    state.containers.inventory.slots.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        index,
        asset: sword(`occupied-${index}`),
      })),
    );
    for (const [index, hero] of state.heroes.entries()) {
      hero.equipment.push({
        slot: "HELMET",
        asset: {
          kind: "gear",
          instanceId: `helmet-${index}`,
          itemKey: 360001,
          rolledStats: [],
        },
      });
    }

    expect(discordHeroEquippedGearPageCount(state)).toBe(1);
    expect(
      discordHeroEquippedGear(state, 0).map((entry) => [
        entry.heroKey,
        entry.gearType,
      ]),
    ).toEqual([
      [101, "HELMET"],
      [201, "HELMET"],
      [301, "HELMET"],
    ]);
    expect(discordHeroFreeInventorySlots(state, 0)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 26),
    );
    expect(discordHeroFreeInventorySlots(state, 1)).toEqual(
      Array.from({ length: 9 }, (_, index) => index + 51),
    );
  });
});

describe("DiscordHero Inventory bound location codecs", () => {
  test("round-trips every canonical equipped Item Effects section and page target within Discord limits", async () => {
    const inventoryModule = (await import("./inventory")) as Record<
      string,
      unknown
    >;
    expect(
      typeof inventoryModule.encodeDiscordHeroItemEffectsSectionTarget,
    ).toBe("function");
    expect(
      typeof inventoryModule.decodeDiscordHeroItemEffectsSectionTarget,
    ).toBe("function");
    expect(typeof inventoryModule.encodeDiscordHeroItemEffectsPageTarget).toBe(
      "function",
    );
    expect(typeof inventoryModule.decodeDiscordHeroItemEffectsPageTarget).toBe(
      "function",
    );
    const encodeSection =
      inventoryModule.encodeDiscordHeroItemEffectsSectionTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        equipmentPage: number,
        equipmentRow: number,
        heroKey: number,
        gearType: string,
      ) => string;
    const decodeSection =
      inventoryModule.decodeDiscordHeroItemEffectsSectionTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        value: string,
      ) => {
        equipmentPage: number;
        equipmentRow: number;
        heroKey: number;
        gearType: string;
      };
    const encodePage =
      inventoryModule.encodeDiscordHeroItemEffectsPageTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        equipmentPage: number,
        equipmentRow: number,
        heroKey: number,
        gearType: string,
        sourceVector: "base" | "inherent" | "rolled",
        effectPage: number,
      ) => string;
    const decodePage =
      inventoryModule.decodeDiscordHeroItemEffectsPageTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        value: string,
      ) => {
        equipmentPage: number;
        equipmentRow: number;
        heroKey: number;
        gearType: string;
        sourceVector: "base" | "inherent" | "rolled";
        effectPage: number;
      };
    const heroKeys = [101, 201, 301, 401, 501, 601] as const;
    const gearTypes = [
      "SWORD",
      "BOW",
      "STAFF",
      "SCEPTER",
      "CROSSBOW",
      "AXE",
      "SHIELD",
      "ARROW",
      "ORB",
      "TOME",
      "BOLT",
      "HATCHET",
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ] as const;
    const vectors = ["base", "inherent", "rolled"] as const;
    let checkedPages = 0;

    for (const [heroIndex, heroKey] of heroKeys.entries()) {
      for (const [gearIndex, gearType] of gearTypes.entries()) {
        const equipmentPage = heroIndex;
        const equipmentRow = gearIndex;
        const section = encodeSection(
          indexes,
          equipmentPage,
          equipmentRow,
          heroKey,
          gearType,
        );
        expect(decodeSection(indexes, section)).toEqual({
          equipmentPage,
          equipmentRow,
          heroKey,
          gearType,
        });
        expect(section.length).toBeLessThanOrEqual(32);

        for (const sourceVector of vectors) {
          for (const effectPage of [0, 1, 2]) {
            const target = encodePage(
              indexes,
              equipmentPage,
              equipmentRow,
              heroKey,
              gearType,
              sourceVector,
              effectPage,
            );
            expect(decodePage(indexes, target)).toEqual({
              equipmentPage,
              equipmentRow,
              heroKey,
              gearType,
              sourceVector,
              effectPage,
            });
            expect(target.length).toBeLessThanOrEqual(32);
            expect(
              encodeDiscordHeroCustomId({
                ownerId: "12345678901234567890",
                view: "inventory",
                action: "page",
                revision: Number.MAX_SAFE_INTEGER,
                value: target,
              }).length,
            ).toBeLessThanOrEqual(100);
            checkedPages += 1;
          }
        }
      }
    }

    expect(checkedPages).toBe(1_080);
    expect(encodePage(indexes, 1, 24, 601, "CROSSBOW", "rolled", 2)).toBe(
      "ef-1-o-gp-CROSSBOW-r-2",
    );
  });

  test("rejects malformed, non-canonical, unsafe, extra, and unknown Item Effects targets", async () => {
    const inventoryModule = (await import("./inventory")) as Record<
      string,
      unknown
    >;
    expect(
      typeof inventoryModule.decodeDiscordHeroItemEffectsSectionTarget,
    ).toBe("function");
    expect(typeof inventoryModule.decodeDiscordHeroItemEffectsPageTarget).toBe(
      "function",
    );
    const decodeSection =
      inventoryModule.decodeDiscordHeroItemEffectsSectionTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        value: string,
      ) => unknown;
    const decodePage =
      inventoryModule.decodeDiscordHeroItemEffectsPageTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        value: string,
      ) => unknown;

    for (const target of [
      "",
      "es-00-o-2t-SWORD",
      "es-0-00-2t-SWORD",
      "es-0-o-0-SWORD",
      "es-0-o-zz-SWORD",
      "es-0-o-2t-UNKNOWN",
      "es-0-o-2t-sword",
      "es-0-o-2t-SWORD-extra",
      "es-zzzzzzzzzzzzzzzzzzzz-o-2t-SWORD",
      "es-0-o-2t-__PROTO__",
    ]) {
      expect(() => decodeSection(indexes, target)).toThrow();
    }
    for (const target of [
      "",
      "ef-00-o-2t-SWORD-r-0",
      "ef-0-00-2t-SWORD-r-0",
      "ef-0-o-0-SWORD-r-0",
      "ef-0-o-zz-SWORD-r-0",
      "ef-0-o-2t-UNKNOWN-r-0",
      "ef-0-o-2t-sword-r-0",
      "ef-0-o-2t-SWORD-base-0",
      "ef-0-o-2t-SWORD-R-0",
      "ef-0-o-2t-SWORD-r-00",
      "ef-0-o-2t-SWORD-r-0-extra",
      "ef-0-o-2t-SWORD-r-zzzzzzzzzzzzzzzzzzzz",
      "ef-0-o-2t-SWORD-r--1",
    ]) {
      expect(() => decodePage(indexes, target)).toThrow();
    }
  });

  test("decodes only canonical Item Effects section choices and vector-global row indexes", async () => {
    const inventoryModule = (await import("./inventory")) as Record<
      string,
      unknown
    >;
    expect(
      typeof inventoryModule.decodeDiscordHeroItemEffectsSectionChoice,
    ).toBe("function");
    expect(typeof inventoryModule.decodeDiscordHeroItemEffectsRowIndex).toBe(
      "function",
    );
    const decodeSectionChoice =
      inventoryModule.decodeDiscordHeroItemEffectsSectionChoice as (
        value: string,
      ) => "summary" | "base" | "inherent" | "rolled";
    const decodeRowIndex =
      inventoryModule.decodeDiscordHeroItemEffectsRowIndex as (
        value: string,
      ) => number;

    expect(["s", "b", "i", "r"].map(decodeSectionChoice)).toEqual([
      "summary",
      "base",
      "inherent",
      "rolled",
    ]);
    expect(["0", "24", "25", "61"].map(decodeRowIndex)).toEqual([
      0, 24, 25, 61,
    ]);
    for (const value of ["", "summary", "base", "B", "x", "rr"]) {
      expect(() => decodeSectionChoice(value)).toThrow();
    }
    for (const value of [
      "",
      "00",
      "-1",
      "+1",
      "1.0",
      "a",
      " 1",
      "1 ",
      "9007199254740992",
    ]) {
      expect(() => decodeRowIndex(value)).toThrow();
    }
  });

  test("rejects hostile Item Effects encoder values before emitting an oversized or unknown target", async () => {
    const inventoryModule = (await import("./inventory")) as Record<
      string,
      unknown
    >;
    const encodeSection =
      inventoryModule.encodeDiscordHeroItemEffectsSectionTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        equipmentPage: number,
        equipmentRow: number,
        heroKey: number,
        gearType: string,
      ) => string;
    const encodePage =
      inventoryModule.encodeDiscordHeroItemEffectsPageTarget as (
        sourceIndexes: DiscordHeroCatalogIndexes,
        equipmentPage: number,
        equipmentRow: number,
        heroKey: number,
        gearType: string,
        sourceVector: string,
        effectPage: number,
      ) => string;

    expect(() => encodePage(indexes, 0, 0, 101, "SWORD", "unknown", 0)).toThrow(
      "unknown source vector",
    );
    expect(() =>
      encodePage(
        indexes,
        Number.MAX_SAFE_INTEGER,
        0,
        101,
        "SWORD",
        "rolled",
        Number.MAX_SAFE_INTEGER,
      ),
    ).toThrow("exceeds 32 characters");
    expect(() => encodeSection(indexes, 0, 25, 101, "SWORD")).toThrow(
      "equipment row must be inside 0-24",
    );
  });

  test("binds one explicit filter into page, inspect, equip, and roll-stat targets", () => {
    const swords: DiscordHeroInventoryFilter = {
      kind: "gear-type",
      value: "SWORD",
    };

    const pageTarget = encodeDiscordHeroInventoryPage(swords, 2);
    expect(pageTarget).toBe("i-gSWORD-2");
    expect(decodeDiscordHeroInventoryPage(indexes, pageTarget)).toEqual({
      inventoryFilter: swords,
      inventoryPage: 2,
    });
    expect(
      decodeDiscordHeroInventoryPage(
        indexes,
        encodeDiscordHeroInventoryPage(DISCORD_HERO_INVENTORY_ALL_FILTER, 10),
      ),
    ).toEqual({
      inventoryFilter: { kind: "all" },
      inventoryPage: 10,
    });
    expect(
      decodeDiscordHeroEquipTarget(
        indexes,
        encodeDiscordHeroEquipTarget(swords, 2, 259),
      ),
    ).toEqual({
      inventoryFilter: swords,
      inventoryPage: 2,
      inventorySlotIndex: 259,
    });
    expect(
      decodeDiscordHeroRollPageTarget(
        indexes,
        encodeDiscordHeroInventoryRollPageTarget(swords, 2, 259, 24),
      ),
    ).toEqual({
      kind: "inventory",
      inventoryFilter: swords,
      inventoryPage: 2,
      inventorySlotIndex: 259,
      rollPage: 24,
    });

    for (const value of [
      "i-tUNKNOWN-0",
      "i-gUNKNOWN-0",
      "i-rUNKNOWN-0",
      "i-t__proto__-0",
      "i-a-00",
    ]) {
      expect(() => decodeDiscordHeroInventoryPage(indexes, value)).toThrow();
    }
  });

  test("round-trips canonical page and multi-step selection targets", () => {
    expect(
      decodeDiscordHeroInventoryPage(
        indexes,
        encodeDiscordHeroInventoryPage(DISCORD_HERO_INVENTORY_ALL_FILTER, 10),
      ),
    ).toEqual({
      inventoryFilter: DISCORD_HERO_INVENTORY_ALL_FILTER,
      inventoryPage: 10,
    });
    expect(
      decodeDiscordHeroEquipmentPage(encodeDiscordHeroEquipmentPage(3)),
    ).toBe(3);
    expect(
      decodeDiscordHeroEquipTarget(
        indexes,
        encodeDiscordHeroEquipTarget(DISCORD_HERO_INVENTORY_ALL_FILTER, 2, 259),
      ),
    ).toEqual({
      inventoryFilter: DISCORD_HERO_INVENTORY_ALL_FILTER,
      inventoryPage: 2,
      inventorySlotIndex: 259,
    });
    expect(
      decodeDiscordHeroUnequipTarget(
        encodeDiscordHeroUnequipTarget(3, 101, "SWORD", 9),
      ),
    ).toEqual({
      equipmentPage: 3,
      heroKey: 101,
      gearType: "SWORD",
      freeInventoryPage: 9,
    });
    expect(
      decodeDiscordHeroRollPageTarget(
        indexes,
        encodeDiscordHeroInventoryRollPageTarget(
          DISCORD_HERO_INVENTORY_ALL_FILTER,
          2,
          259,
          24,
        ),
      ),
    ).toEqual({
      kind: "inventory",
      inventoryFilter: DISCORD_HERO_INVENTORY_ALL_FILTER,
      inventoryPage: 2,
      inventorySlotIndex: 259,
      rollPage: 24,
    });
    expect(
      decodeDiscordHeroRollPageTarget(
        indexes,
        encodeDiscordHeroEquipmentRollPageTarget(1, 301, "BOOTS", 24),
      ),
    ).toEqual({
      kind: "equipment",
      equipmentPage: 1,
      heroKey: 301,
      gearType: "BOOTS",
      rollPage: 24,
    });
  });

  test("rejects non-canonical and delimiter-forged locations", () => {
    for (const value of [
      "i-00",
      "i--1",
      "e-0-04",
      "u-0-101-SWORD:0-0",
      "ri-0-4-00",
      "rq-1-08d-BOOTS-o",
      "rq-1-0-BOOTS-o",
      "rq-1-8d-boots-o",
    ]) {
      expect(() => {
        if (value.startsWith("i-")) {
          decodeDiscordHeroInventoryPage(indexes, value);
        } else if (value.startsWith("e-")) {
          decodeDiscordHeroEquipTarget(indexes, value);
        } else if (value.startsWith("u-"))
          decodeDiscordHeroUnequipTarget(value);
        else decodeDiscordHeroRollPageTarget(indexes, value);
      }).toThrow();
    }
  });
});
