import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import { equipGear, isHeroGearTypeCompatible, unequipGear } from "./equipment";
import type { GearAsset, PlayerState, StoredAsset } from "./player";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function fresh(): PlayerState {
  return createFreshPlayerStateFromCatalog(indexes, 101);
}

function itemKeyFor(gearType: string): number {
  const item = indexes.tables.items.rows.find(
    (candidate) => candidate.type === "GEAR" && candidate.gear === gearType,
  );
  if (item === undefined) throw new Error(`missing test gear type ${gearType}`);
  return item.id;
}

function gear(
  gearType: string,
  instanceId: string,
  rolledStats: GearAsset["rolledStats"] = [],
): GearAsset {
  return {
    kind: "gear",
    instanceId,
    itemKey: itemKeyFor(gearType),
    rolledStats,
  };
}

function inventorySlot(index: number, asset: StoredAsset) {
  return { index, asset };
}

describe("DiscordHero source-derived equipment compatibility", () => {
  test("covers the canonical 20 item gear categories as 12 specialized and 8 common", () => {
    const gearTypes = [
      ...new Set(
        indexes.tables.items.rows.flatMap((item) =>
          item.type === "GEAR" && item.gear !== null ? [item.gear] : [],
        ),
      ),
    ];
    const specialized = new Set(
      indexes.tables.heroes.rows.flatMap((hero) => [
        hero.MainWeaponGearType,
        hero.SubWeaponGearType,
      ]),
    );
    const common = gearTypes.filter((gearType) => !specialized.has(gearType));

    expect(gearTypes).toHaveLength(20);
    expect(specialized.size).toBe(12);
    expect(common).toEqual([
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ]);
    expect(indexes.tables.gear_types.rows).toHaveLength(16);
    expect(
      common.filter(
        (gearType) => !indexes.tables.gear_types.groups.has(gearType),
      ),
    ).toEqual(["AMULET", "EARING", "RING", "BRACER"]);

    expect(indexes.tables.heroes.rows).toHaveLength(6);
    let matrixChecks = 0;
    for (const hero of indexes.tables.heroes.rows) {
      for (const gearType of gearTypes) {
        expect(isHeroGearTypeCompatible(indexes, hero.HeroKey, gearType)).toBe(
          !specialized.has(gearType) ||
            gearType === hero.MainWeaponGearType ||
            gearType === hero.SubWeaponGearType,
        );
        matrixChecks += 1;
      }
    }
    expect(matrixChecks).toBe(120);
  });

  test("rejects unknown heroes and non-catalog equipment categories", () => {
    expect(() => isHeroGearTypeCompatible(indexes, 999_999, "SWORD")).toThrow(
      "heroes has no unique row",
    );
    expect(() => isHeroGearTypeCompatible(indexes, 101, "LASER")).toThrow(
      "unknown equipment category LASER",
    );
  });
});

describe("DiscordHero pure equip transition", () => {
  test("moves one exact compatible instance and returns detached canonical order", () => {
    const state = fresh();
    const selected = gear("SWORD", "sword-selected", [
      { statModKey: 100101, value: 1 },
    ]);
    state.containers.inventory.slots.push(
      inventorySlot(8, gear("AMULET", "amulet-kept")),
      inventorySlot(5, selected),
      inventorySlot(1, {
        kind: "stack",
        itemKey: 10001,
        quantity: 2,
      }),
    );
    state.heroes[0]!.equipment.push({
      slot: "BOOTS",
      asset: gear("BOOTS", "boots-kept"),
    });

    const result = equipGear(indexes, state, 101, 5);

    expect(result).toMatchObject({
      kind: "equipped",
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 5,
      instanceId: "sword-selected",
      itemKey: selected.itemKey,
    });
    if (result.kind !== "equipped") throw new Error("expected equip");
    expect(
      result.state.containers.inventory.slots.map((slot) => slot.index),
    ).toEqual([1, 8]);
    expect(result.state.heroes[0]!.equipment).toEqual([
      {
        slot: "SWORD",
        asset: selected,
      },
      {
        slot: "BOOTS",
        asset: gear("BOOTS", "boots-kept"),
      },
    ]);
    expect(state.containers.inventory.slots.map((slot) => slot.index)).toEqual([
      8, 5, 1,
    ]);
    expect(state.heroes[0]!.equipment).toHaveLength(1);
    expect(result.state).not.toBe(state);
    expect(result.state.heroes[0]!.equipment[0]!.asset).not.toBe(selected);
    expect(result.state.heroes[0]!.equipment[0]!.asset.rolledStats).not.toBe(
      selected.rolledStats,
    );

    selected.rolledStats[0]!.value = 99;
    expect(
      result.state.heroes[0]!.equipment[0]!.asset.rolledStats[0]!.value,
    ).toBe(1);
    result.state.heroes[0]!.equipment[0]!.asset.rolledStats[0]!.value = 2;
    expect(selected.rolledStats[0]!.value).toBe(99);
  });

  test("equips common gear but rejects specialized gear owned by another hero", () => {
    const common = fresh();
    common.containers.inventory.slots.push(
      inventorySlot(0, gear("AMULET", "common-amulet")),
    );
    expect(equipGear(indexes, common, 201, 0)).toMatchObject({
      kind: "equipped",
      heroKey: 201,
      gearType: "AMULET",
    });

    const incompatible = fresh();
    incompatible.containers.inventory.slots.push(
      inventorySlot(0, gear("SWORD", "warrior-only")),
    );
    expect(equipGear(indexes, incompatible, 201, 0)).toEqual({
      kind: "incompatible-gear",
      heroKey: 201,
      gearType: "SWORD",
      itemKey: itemKeyFor("SWORD"),
    });
    expect(incompatible.containers.inventory.slots).toHaveLength(1);
  });

  test("rejects occupied, stack, empty, locked, and unowned actions without mutation", () => {
    const occupied = fresh();
    occupied.containers.inventory.slots.push(
      inventorySlot(0, gear("SWORD", "new-sword")),
    );
    occupied.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: gear("SWORD", "old-sword"),
    });
    expect(equipGear(indexes, occupied, 101, 0)).toEqual({
      kind: "equipment-slot-occupied",
      heroKey: 101,
      gearType: "SWORD",
      instanceId: "old-sword",
    });

    const unavailable = fresh();
    unavailable.containers.inventory.slots.push(
      inventorySlot(0, { kind: "stack", itemKey: 10001, quantity: 1 }),
    );
    expect(equipGear(indexes, unavailable, 101, 0)).toEqual({
      kind: "inventory-slot-not-gear",
      inventorySlotIndex: 0,
      itemKey: 10001,
    });
    expect(equipGear(indexes, unavailable, 101, 1)).toEqual({
      kind: "inventory-slot-empty",
      inventorySlotIndex: 1,
    });
    expect(equipGear(indexes, unavailable, 101, 20)).toEqual({
      kind: "inventory-slot-locked",
      inventorySlotIndex: 20,
      unlockedSlots: 20,
    });
    expect(equipGear(indexes, unavailable, 401, 0)).toEqual({
      kind: "hero-not-owned",
      heroKey: 401,
    });
    expect(unavailable.containers.inventory.slots).toEqual([
      inventorySlot(0, { kind: "stack", itemKey: 10001, quantity: 1 }),
    ]);
  });

  test("throws on malformed/unknown inputs and duplicate gear identities before mutation", () => {
    const state = fresh();
    state.containers.inventory.slots.push(
      inventorySlot(0, gear("SWORD", "duplicate")),
      inventorySlot(1, gear("AMULET", "duplicate")),
    );

    expect(() => equipGear(indexes, state, 101, 0)).toThrow(
      "gear instance duplicate exists in both inventory:0 and inventory:1",
    );
    expect(() => equipGear(indexes, fresh(), 999_999, 0)).toThrow(
      "heroes has no unique row",
    );
    expect(() => equipGear(indexes, fresh(), 101, -1)).toThrow(
      "inventory slot index must be a non-negative safe integer",
    );
    expect(() => equipGear(indexes, fresh(), 101, 999_999)).toThrow(
      "inventory has no unique row",
    );
  });

  test("rejects a source-known impossible rolled-stat value before moving gear", () => {
    const state = fresh();
    state.containers.inventory.slots.push(
      inventorySlot(
        0,
        gear("SWORD", "forged-known-stat", [
          { statModKey: 100101, value: 999999 },
        ]),
      ),
    );
    const before = structuredClone(state);

    expect(() => equipGear(indexes, state, 101, 0)).toThrow(
      "stat mod 100101 value 999999 is not a source candidate",
    );
    expect(state).toEqual(before);
  });

  test("equips empty rolls and exact lower and upper source-union candidates", () => {
    for (const [instanceId, rolledStats] of [
      ["empty-rolls", []],
      ["lower-source-candidate", [{ statModKey: 100101, value: 1 }]],
      ["upper-source-candidate", [{ statModKey: 100101, value: 300 }]],
    ] as const) {
      const state = fresh();
      state.containers.inventory.slots.push(
        inventorySlot(0, gear("SWORD", instanceId, [...rolledStats])),
      );

      expect(equipGear(indexes, state, 101, 0)).toMatchObject({
        kind: "equipped",
        instanceId,
      });
    }
  });
});

describe("DiscordHero pure unequip transition", () => {
  test("moves one exact equipped instance to an explicit free slot in canonical order", () => {
    const state = fresh();
    const selected = gear("SWORD", "equipped-sword", [
      { statModKey: 100101, value: 1 },
    ]);
    state.heroes[0]!.equipment.push(
      { slot: "BOOTS", asset: gear("BOOTS", "boots-kept") },
      { slot: "SWORD", asset: selected },
    );
    state.containers.inventory.slots.push(
      inventorySlot(8, gear("AMULET", "amulet-kept")),
      inventorySlot(1, { kind: "stack", itemKey: 10001, quantity: 1 }),
    );

    const result = unequipGear(indexes, state, 101, "SWORD", 5);

    expect(result).toMatchObject({
      kind: "unequipped",
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 5,
      instanceId: "equipped-sword",
      itemKey: selected.itemKey,
    });
    if (result.kind !== "unequipped") throw new Error("expected unequip");
    expect(result.state.heroes[0]!.equipment).toEqual([
      { slot: "BOOTS", asset: gear("BOOTS", "boots-kept") },
    ]);
    expect(
      result.state.containers.inventory.slots.map((slot) => slot.index),
    ).toEqual([1, 5, 8]);
    expect(result.state.containers.inventory.slots[1]!.asset).toEqual(selected);
    expect(result.state.containers.inventory.slots[1]!.asset).not.toBe(
      selected,
    );
    expect(state.heroes[0]!.equipment).toHaveLength(2);
    expect(state.containers.inventory.slots.map((slot) => slot.index)).toEqual([
      8, 1,
    ]);
  });

  test("rejects empty equipment and occupied/locked inventory targets without mutation", () => {
    const state = fresh();
    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: gear("SWORD", "equipped-sword"),
    });
    state.containers.inventory.slots.push(
      inventorySlot(0, { kind: "stack", itemKey: 10001, quantity: 1 }),
    );

    expect(unequipGear(indexes, state, 101, "SHIELD", 1)).toEqual({
      kind: "equipment-slot-empty",
      heroKey: 101,
      gearType: "SHIELD",
    });
    expect(unequipGear(indexes, state, 101, "SWORD", 0)).toEqual({
      kind: "inventory-slot-occupied",
      inventorySlotIndex: 0,
    });
    expect(unequipGear(indexes, state, 101, "SWORD", 20)).toEqual({
      kind: "inventory-slot-locked",
      inventorySlotIndex: 20,
      unlockedSlots: 20,
    });
    expect(unequipGear(indexes, state, 401, "SWORD", 1)).toEqual({
      kind: "hero-not-owned",
      heroKey: 401,
    });
    expect(state.heroes[0]!.equipment).toHaveLength(1);
    expect(state.containers.inventory.slots).toHaveLength(1);
  });

  test("throws on unknown equipment categories and slot inputs", () => {
    expect(() => unequipGear(indexes, fresh(), 101, "LASER", 0)).toThrow(
      "unknown equipment category LASER",
    );
    expect(() => unequipGear(indexes, fresh(), 101, "SWORD", -1)).toThrow(
      "inventory slot index must be a non-negative safe integer",
    );
    expect(() => unequipGear(indexes, fresh(), 999_999, "SWORD", 0)).toThrow(
      "heroes has no unique row",
    );
  });
});
