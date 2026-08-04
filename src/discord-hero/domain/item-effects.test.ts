import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroDatasetName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";

const ITEM_EFFECTS_MODULE = "./item-effects";

type ItemEffectsModule = typeof import("./item-effects");

function loadItemEffectsModule(): Promise<ItemEffectsModule> {
  return import(ITEM_EFFECTS_MODULE) as Promise<ItemEffectsModule>;
}

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function equippedState(
  itemKey: number,
  instanceId: string,
  rolledStats: PlayerState["heroes"][number]["equipment"][number]["asset"]["rolledStats"] = [],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  const item = indexes.tables.items.groups.get(itemKey)?.[0];
  if (item?.type !== "GEAR" || item.gear === null) {
    throw new Error(`test item ${itemKey} must be gear`);
  }
  const sourceHero = indexes.tables.heroes.rows.find(
    (hero) =>
      hero.MainWeaponGearType === item.gear ||
      hero.SubWeaponGearType === item.gear,
  );
  const heroKey = sourceHero?.HeroKey ?? 101;
  let hero = state.heroes.find((candidate) => candidate.heroKey === heroKey);
  if (hero === undefined) {
    hero = {
      heroKey,
      level: 1,
      xp: 0,
      attributes: [],
      skills: [],
      passives: [],
      equipment: [],
      skins: [],
    };
    state.heroes.push(hero);
  }
  hero.equipment.push({
    slot: item.gear,
    asset: {
      kind: "gear",
      instanceId,
      itemKey,
      rolledStats,
    },
  });
  return state;
}

function heroKeyForItem(itemKey: number): number {
  const item = indexes.tables.items.groups.get(itemKey)?.[0];
  if (item?.type !== "GEAR" || item.gear === null) {
    throw new Error(`test item ${itemKey} must be gear`);
  }
  return (
    indexes.tables.heroes.rows.find(
      (hero) =>
        hero.MainWeaponGearType === item.gear ||
        hero.SubWeaponGearType === item.gear,
    )?.HeroKey ?? 101
  );
}

function withRows<Name extends DiscordHeroDatasetName>(
  source: DiscordHeroCatalogIndexes,
  name: Name,
  mutate: (rows: Record<string, unknown>[]) => void,
  rebuildGroups = true,
): DiscordHeroCatalogIndexes {
  const table = source.tables[name];
  const rows = table.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  const groups = new Map<unknown, Record<string, unknown>[]>();
  if (rebuildGroups) {
    for (const row of rows) {
      const key = row[table.primaryField];
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    }
  }
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: {
        ...table,
        rows,
        groups: rebuildGroups ? groups : table.groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

describe("DiscordHero equipped Item effect projection", () => {
  test("accepts known persisted Item Effect sources without changing state", async () => {
    const { assertDiscordHeroItemEffectSourcesKnown } =
      await loadItemEffectsModule();
    const state = equippedState(300001, "known-source", [
      { statModKey: 100101, value: 1 },
    ]);
    const before = JSON.stringify(state);

    expect(() =>
      assertDiscordHeroItemEffectSourcesKnown(indexes, state),
    ).not.toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });

  test("reports an unknown persisted Item Effect source with typed identity", async () => {
    const {
      assertDiscordHeroItemEffectSourcesKnown,
      DiscordHeroUnknownItemEffectSourceError,
    } = await loadItemEffectsModule();
    const state = equippedState(300001, "unknown-source", [
      { statModKey: 999999, value: 1 },
    ]);
    const before = JSON.stringify(state);
    let caught: unknown;

    try {
      assertDiscordHeroItemEffectSourcesKnown(indexes, state);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DiscordHeroUnknownItemEffectSourceError);
    expect(caught).toMatchObject({
      name: "DiscordHeroUnknownItemEffectSourceError",
      statePath: "heroes[0].equipment[0].asset.rolledStats[0]",
      statModKey: 999999,
      message:
        "heroes[0].equipment[0].asset.rolledStats[0].statModKey references unknown stat_mods key 999999",
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  test("propagates a catalog lookup failure with an unknown-source message", async () => {
    const { assertDiscordHeroItemEffectSourcesKnown } =
      await loadItemEffectsModule();
    const state = equippedState(300001, "lookup-failure", [
      { statModKey: 100101, value: 1 },
    ]);
    const before = JSON.stringify(state);
    const lookupFailure = new Error(
      "heroes[0].equipment[0].asset.rolledStats[0].statModKey references unknown stat_mods key 100101",
    );
    const statModGroups = new Map(indexes.tables.stat_mods.groups);
    Object.defineProperty(statModGroups, "get", {
      value: () => {
        throw lookupFailure;
      },
    });
    const failingIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        stat_mods: {
          ...indexes.tables.stat_mods,
          groups: statModGroups,
        },
      },
    } as DiscordHeroCatalogIndexes;
    let caught: unknown;

    try {
      assertDiscordHeroItemEffectSourcesKnown(failingIndexes, state);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(lookupFailure);
    expect(JSON.stringify(state)).toBe(before);
  });

  test("projects exact base, inherent, and rolled source vectors without applying combat semantics", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const state = equippedState(301011, "exact-sword", [
      { statModKey: 100102, value: 10 },
      { statModKey: 100201, value: 40 },
      { statModKey: 100401, value: 10 },
      { statModKey: 101701, value: 25 },
    ]);

    const projection = projectEquippedGearItemEffects({
      indexes,
      state,
      heroKey: 101,
      instanceId: "exact-sword",
    });

    expect(projection).toMatchObject({
      source: "Item",
      heroKey: 101,
      instanceId: "exact-sword",
      itemKey: 301011,
      gearType: "SWORD",
      itemLevel: 1,
      provenance: {
        item: { table: "items", itemKey: 301011 },
        gear: { table: "gear", gearKey: 301011 },
        gearType: { table: "gear_type_scales", gearType: "SWORD" },
        itemLevel: {
          kind: "catalog-row",
          table: "item_level_scales",
          level: 1,
        },
      },
      oracleGates: [],
    });
    expect(projection.effects).toEqual([
      {
        kind: "stat-modifier",
        statType: "AttackDamage",
        modifierType: "FLAT",
        rawValue: 2,
        unit: "RAW",
        provenance: {
          kind: "gear-base",
          gearKey: 301011,
          gearType: "SWORD",
          slot: 1,
          statTypeField: "BaseStat1_STATTYPE",
          modifierTypeField: "BaseStat1_MODTYPE",
          valueField: "BaseStat1_Value",
          sourceValue: 2,
        },
      },
      {
        kind: "stat-modifier",
        statType: "AttackSpeed",
        modifierType: "FLAT",
        rawValue: 10,
        unit: "RAW",
        provenance: {
          kind: "gear-base",
          gearKey: 301011,
          gearType: "SWORD",
          slot: 2,
          statTypeField: "BaseStat2_STATTYPE",
          modifierTypeField: "BaseStat2_MODTYPE",
          valueField: "BaseStat2_Value",
          sourceValue: 10,
        },
      },
      {
        kind: "stat-modifier",
        statType: "AttackDamage",
        modifierType: "ADDITIVE",
        rawValue: 200,
        unit: "RAW_PER_THOUSAND",
        provenance: {
          kind: "gear-inherent",
          gearKey: 301011,
          slot: 1,
          statTypeField: "InherentStat1_STATTYPE",
          modifierTypeField: "InherentStat1_MODTYPE",
          valueField: "InherentStat1_Value",
        },
      },
      {
        kind: "stat-modifier",
        statType: "AttackDamage",
        modifierType: "ADDITIVE",
        rawValue: 100,
        unit: "RAW_PER_THOUSAND",
        provenance: {
          kind: "rolled-stat",
          statePath: "heroes[0].equipment[0].asset.rolledStats[0]",
          table: "stat_mods",
          statModKey: 100102,
          storedValue: 10,
          sourceRows: [
            { tier: 1, minRawValue: 50, maxRawValue: 100, interval: 10 },
            { tier: 2, minRawValue: 100, maxRawValue: 150, interval: 10 },
          ],
        },
      },
      {
        kind: "stat-modifier",
        statType: "AttackSpeed",
        modifierType: "ADDITIVE",
        rawValue: 40,
        unit: "RAW_PER_THOUSAND",
        provenance: {
          kind: "rolled-stat",
          statePath: "heroes[0].equipment[0].asset.rolledStats[1]",
          table: "stat_mods",
          statModKey: 100201,
          storedValue: 40,
          sourceRows: [
            { tier: 1, minRawValue: 40, maxRawValue: 50, interval: 1 },
          ],
        },
      },
      {
        kind: "stat-modifier",
        statType: "CriticalDamage",
        modifierType: "FLAT",
        rawValue: 100,
        unit: "RAW",
        provenance: {
          kind: "rolled-stat",
          statePath: "heroes[0].equipment[0].asset.rolledStats[2]",
          table: "stat_mods",
          statModKey: 100401,
          storedValue: 10,
          sourceRows: [
            { tier: 1, minRawValue: 100, maxRawValue: 150, interval: 10 },
          ],
        },
      },
      {
        kind: "unsupported-source",
        statType: "BlockChance",
        modifierType: "FLAT",
        rawValue: 25,
        unit: "RAW",
        reasons: [
          "BlockChance application requires the unresolved combat oracle",
        ],
        provenance: {
          kind: "rolled-stat",
          statePath: "heroes[0].equipment[0].asset.rolledStats[3]",
          table: "stat_mods",
          statModKey: 101701,
          storedValue: 25,
          sourceRows: [
            { tier: 1, minRawValue: 25, maxRawValue: 35, interval: 1 },
          ],
        },
      },
    ]);
  });

  test("covers all 20 source gear categories and preserves the four accessory zero-base cases", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const representatives = [
      ["SWORD", 300001, [1, 10], ["stat-modifier", "stat-modifier"]],
      ["BOW", 310001, [2, 30], ["stat-modifier", "stat-modifier"]],
      ["STAFF", 320001, [2, 10], ["stat-modifier", "stat-modifier"]],
      ["SCEPTER", 330001, [1, 10], ["stat-modifier", "stat-modifier"]],
      ["CROSSBOW", 340001, [1, 10], ["stat-modifier", "stat-modifier"]],
      ["AXE", 350001, [2, 10], ["stat-modifier", "stat-modifier"]],
      ["SHIELD", 400001, [50], ["unsupported-source"]],
      ["ARROW", 410001, [80], ["stat-modifier"]],
      ["ORB", 420001, [70], ["stat-modifier"]],
      ["TOME", 430001, [70], ["stat-modifier"]],
      ["BOLT", 440001, [200], ["stat-modifier"]],
      ["HATCHET", 450001, [150], ["stat-modifier"]],
      ["HELMET", 500001, [7], ["stat-modifier"]],
      ["ARMOR", 510001, [14], ["stat-modifier"]],
      ["GLOVES", 520001, [6], ["stat-modifier"]],
      ["BOOTS", 530001, [4], ["stat-modifier"]],
      ["AMULET", 601011, [80], ["stat-modifier"]],
      ["EARING", 611011, [80], ["stat-modifier"]],
      ["RING", 621011, [50], ["stat-modifier"]],
      ["BRACER", 631011, [100], ["stat-modifier"]],
    ] as const;

    const layerDistribution = new Map<string, number>();
    const actual = representatives.map(([gearType, itemKey]) => {
      const instanceId = `representative-${gearType.toLowerCase()}`;
      const projection = projectEquippedGearItemEffects({
        indexes,
        state: equippedState(itemKey, instanceId),
        heroKey: heroKeyForItem(itemKey),
        instanceId,
      });
      const baseEffects = projection.effects.filter(
        (effect) => effect.provenance.kind === "gear-base",
      );
      for (const effect of projection.effects) {
        const layer = [
          effect.provenance.kind,
          effect.kind,
          effect.modifierType,
          effect.unit,
        ].join(":");
        layerDistribution.set(layer, (layerDistribution.get(layer) ?? 0) + 1);
      }
      return {
        gearType: projection.gearType,
        itemKey: projection.itemKey,
        rawValues: projection.effects.map((effect) => effect.rawValue),
        kinds: projection.effects.map((effect) => effect.kind),
        baseCount: baseEffects.length,
      };
    });

    expect(actual).toEqual(
      representatives.map(([gearType, itemKey, rawValues, kinds]) => ({
        gearType,
        itemKey,
        rawValues: [...rawValues],
        kinds: [...kinds],
        baseCount: ["AMULET", "EARING", "RING", "BRACER"].includes(gearType)
          ? 0
          : ["SWORD", "BOW", "STAFF", "SCEPTER", "CROSSBOW", "AXE"].includes(
                gearType,
              )
            ? 2
            : 1,
      })),
    );
    expect(Object.fromEntries([...layerDistribution].sort())).toEqual({
      "gear-base:stat-modifier:ADDITIVE:RAW_PER_THOUSAND": 2,
      "gear-base:stat-modifier:FLAT:RAW": 19,
      "gear-base:unsupported-source:FLAT:RAW": 1,
      "gear-inherent:stat-modifier:ADDITIVE:RAW_PER_THOUSAND": 3,
      "gear-inherent:stat-modifier:FLAT:RAW": 1,
    });
  });

  test("keeps MULTIPLICATIVE values in raw-per-thousand units", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const projection = projectEquippedGearItemEffects({
      indexes,
      state: equippedState(301051, "multiplicative-sword"),
      heroKey: 101,
      instanceId: "multiplicative-sword",
    });

    expect(
      projection.effects.find(
        (effect) => effect.provenance.kind === "gear-inherent",
      ),
    ).toEqual({
      kind: "stat-modifier",
      statType: "AttackSpeed",
      modifierType: "MULTIPLICATIVE",
      rawValue: 84,
      unit: "RAW_PER_THOUSAND",
      provenance: {
        kind: "gear-inherent",
        gearKey: 301051,
        slot: 1,
        statTypeField: "InherentStat1_STATTYPE",
        modifierTypeField: "InherentStat1_MODTYPE",
        valueField: "InherentStat1_Value",
      },
    });
  });

  test("parses the pinned trailing-space base value without applying item-level economy scaling", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const projection = projectEquippedGearItemEffects({
      indexes,
      state: equippedState(410007, "source-string-arrow"),
      heroKey: heroKeyForItem(410007),
      instanceId: "source-string-arrow",
    });

    expect(projection.effects[0]).toMatchObject({
      kind: "stat-modifier",
      statType: "AttackSpeed",
      modifierType: "ADDITIVE",
      rawValue: 190,
      unit: "RAW_PER_THOUSAND",
      provenance: {
        kind: "gear-base",
        sourceValue: "190 ",
      },
    });
    expect(projection.provenance.itemLevel).toEqual({
      kind: "catalog-row",
      table: "item_level_scales",
      level: 30,
    });
  });

  test("records the pinned level-100 source limitation without inventing stat scaling", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const projection = projectEquippedGearItemEffects({
      indexes,
      state: equippedState(300020, "level-100-sword"),
      heroKey: 101,
      instanceId: "level-100-sword",
    });

    expect(projection.itemLevel).toBe(100);
    expect(projection.provenance.itemLevel).toEqual({
      kind: "source-limitation",
      ruleId: "items.level->item_level_scales",
      level: 100,
      reason:
        "source documentation defines no level-100 scale and uses factor 1",
    });
    expect(projection.effects.map((effect) => effect.rawValue)).toEqual([
      66, 30,
    ]);
  });

  test("keeps unique modifiers behind an explicit oracle gate", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const projection = projectEquippedGearItemEffects({
      indexes,
      state: equippedState(309171, "unique-sword"),
      heroKey: 101,
      instanceId: "unique-sword",
    });

    expect(projection.oracleGates).toEqual([
      {
        kind: "unique-mod",
        uniqueModKey: 10001,
        reason:
          "unique-mod runtime semantics are outside the source-proven stat projection",
      },
    ]);
    expect(
      projection.effects.some((effect) =>
        Object.hasOwn(effect, "uniqueModKey"),
      ),
    ).toBe(false);
  });

  test("preserves every matching tier row without choosing tier eligibility", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const projection = projectEquippedGearItemEffects({
      indexes,
      state: equippedState(300001, "tier-boundary", [
        { statModKey: 100102, value: 10 },
      ]),
      heroKey: 101,
      instanceId: "tier-boundary",
    });
    const rolled = projection.effects.find(
      (effect) => effect.provenance.kind === "rolled-stat",
    );

    expect(rolled).toMatchObject({
      rawValue: 100,
      provenance: {
        sourceRows: [
          { tier: 1, minRawValue: 50, maxRawValue: 100, interval: 10 },
          { tier: 2, minRawValue: 100, maxRawValue: 150, interval: 10 },
        ],
      },
    });
  });

  test("marks future stat and modifier types as unsupported source entries", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const futureStat = withRows(indexes, "stat_mods", (rows) => {
      for (const row of rows) {
        if (row.StatModKey === 100101) row.STATTYPE = "FutureDamage";
      }
    });
    const futureModifier = withRows(indexes, "stat_mods", (rows) => {
      for (const row of rows) {
        if (row.StatModKey === 100101) row.MODTYPE = "FUTURE_LAYER";
      }
    });
    const state = equippedState(300001, "future-source", [
      { statModKey: 100101, value: 1 },
    ]);

    expect(
      projectEquippedGearItemEffects({
        indexes: futureStat,
        state,
        heroKey: 101,
        instanceId: "future-source",
      }).effects.at(-1),
    ).toEqual({
      kind: "unsupported-source",
      statType: "FutureDamage",
      modifierType: "FLAT",
      rawValue: 1,
      unit: "RAW",
      reasons: ["unproven stat type FutureDamage"],
      provenance: {
        kind: "rolled-stat",
        statePath: "heroes[0].equipment[0].asset.rolledStats[0]",
        table: "stat_mods",
        statModKey: 100101,
        storedValue: 1,
        sourceRows: [{ tier: 1, minRawValue: 1, maxRawValue: 2, interval: 1 }],
      },
    });
    expect(
      projectEquippedGearItemEffects({
        indexes: futureModifier,
        state,
        heroKey: 101,
        instanceId: "future-source",
      }).effects.at(-1),
    ).toMatchObject({
      kind: "unsupported-source",
      modifierType: "FUTURE_LAYER",
      unit: "UNPROVEN",
      reasons: ["unproven modifier type FUTURE_LAYER"],
    });
  });

  test("rejects unknown, unowned, unsafe, and non-equipped target identities", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const state = equippedState(300001, "owned-sword");

    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state,
        heroKey: 401,
        instanceId: "owned-sword",
      }),
    ).toThrow("hero 401 is not owned");
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state,
        heroKey: Number.MAX_SAFE_INTEGER + 1,
        instanceId: "owned-sword",
      }),
    ).toThrow("hero key must be a positive safe integer");
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state,
        heroKey: 101,
        instanceId: "unsafe\ninstance",
      }),
    ).toThrow("canonical stable instance ID");
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state,
        heroKey: 101,
        instanceId: "not-owned",
      }),
    ).toThrow("found 0");
  });

  test("rejects duplicate and unsafe ownership anywhere in state before output", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const duplicateHero = equippedState(300001, "owned-sword");
    duplicateHero.heroes.push(structuredClone(duplicateHero.heroes[1]!));
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state: duplicateHero,
        heroKey: 101,
        instanceId: "owned-sword",
      }),
    ).toThrow("duplicate key 201");

    const duplicateInstance = equippedState(300001, "duplicate-instance");
    duplicateInstance.containers.inventory.slots.push({
      index: 0,
      asset: {
        kind: "gear",
        instanceId: "duplicate-instance",
        itemKey: 601011,
        rolledStats: [],
      },
    });
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state: duplicateInstance,
        heroKey: 101,
        instanceId: "duplicate-instance",
      }),
    ).toThrow("exists in both");

    const unsafeUnrelated = equippedState(300001, "owned-sword");
    unsafeUnrelated.containers.inventory.slots.push({
      index: 0,
      asset: {
        kind: "gear",
        instanceId: "unsafe\nunrelated",
        itemKey: 601011,
        rolledStats: [],
      },
    });
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state: unsafeUnrelated,
        heroKey: 101,
        instanceId: "owned-sword",
      }),
    ).toThrow("canonical stable instance ID");
  });

  test("validates every stored rolled stat before projecting the selected asset", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const invalidUnrelated = equippedState(300001, "owned-sword");
    invalidUnrelated.containers.inventory.slots.push({
      index: 0,
      asset: {
        kind: "gear",
        instanceId: "forged-roll",
        itemKey: 601011,
        rolledStats: [{ statModKey: 100101, value: 999_999 }],
      },
    });
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state: invalidUnrelated,
        heroKey: 101,
        instanceId: "owned-sword",
      }),
    ).toThrow("value 999999 is not a source candidate");

    const duplicateRoll = equippedState(300001, "duplicate-roll", [
      { statModKey: 100101, value: 1 },
      { statModKey: 100101, value: 2 },
    ]);
    expect(() =>
      projectEquippedGearItemEffects({
        indexes,
        state: duplicateRoll,
        heroKey: 101,
        instanceId: "duplicate-roll",
      }),
    ).toThrow("repeats stat mod 100101");
  });

  test("rejects source Interval ambiguity before returning any projection", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const ambiguous = withRows(indexes, "stat_mods", (rows) => {
      const tierTwo = rows.find(
        (row) => row.StatModKey === 100102 && row.Tier === 2,
      );
      if (tierTwo === undefined) throw new Error("missing test source row");
      tierTwo.MinValue = 10;
      tierTwo.MaxValue = 15;
      tierTwo.Interval = 1;
    });
    const state = equippedState(300001, "ambiguous-interval", [
      { statModKey: 100102, value: 10 },
    ]);

    expect(() =>
      projectEquippedGearItemEffects({
        indexes: ambiguous,
        state,
        heroKey: 101,
        instanceId: "ambiguous-interval",
      }),
    ).toThrow("ambiguous source Interval");
  });

  test("rejects duplicate corpus keys and forged rows/groups outside the selected item", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const state = equippedState(300001, "corpus-sword");
    const duplicateGear = withRows(indexes, "gear", (rows) => {
      rows.at(-1)!.GearKey = rows[0]!.GearKey;
    });
    const duplicateCategory = withRows(indexes, "gear_type_scales", (rows) => {
      rows.at(-1)!.GearType = rows[0]!.GearType;
    });
    const staleGroups = withRows(
      indexes,
      "item_level_scales",
      (rows) => {
        rows[0]!.Level = 999;
      },
      false,
    );

    expect(() =>
      projectEquippedGearItemEffects({
        indexes: duplicateGear,
        state,
        heroKey: 101,
        instanceId: "corpus-sword",
      }),
    ).toThrow("duplicate gear key");
    expect(() =>
      projectEquippedGearItemEffects({
        indexes: duplicateCategory,
        state,
        heroKey: 101,
        instanceId: "corpus-sword",
      }),
    ).toThrow("duplicate gear type scale");
    expect(() =>
      projectEquippedGearItemEffects({
        indexes: staleGroups,
        state,
        heroKey: 101,
        instanceId: "corpus-sword",
      }),
    ).toThrow("rows/groups disagree");
  });

  test("rejects forged selected item, gear, and accessory base joins", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const sword = equippedState(300001, "forged-join");
    const wrongItemCategory = withRows(indexes, "items", (rows) => {
      rows.find((row) => row.id === 300001)!.gear = "LASER";
    });
    expect(() =>
      projectEquippedGearItemEffects({
        indexes: wrongItemCategory,
        state: sword,
        heroKey: 101,
        instanceId: "forged-join",
      }),
    ).toThrow();

    const accessory = equippedState(601011, "forged-accessory-base");
    const nonzeroAccessoryBase = withRows(indexes, "gear", (rows) => {
      rows.find((row) => row.GearKey === 601011)!.BaseStat1_Value = 1;
    });
    expect(() =>
      projectEquippedGearItemEffects({
        indexes: nonzeroAccessoryBase,
        state: accessory,
        heroKey: 101,
        instanceId: "forged-accessory-base",
      }),
    ).toThrow("has no base definition");
  });

  test("returns a deeply frozen detached graph and leaves state, indexes, and catalog unchanged", async () => {
    const { projectEquippedGearItemEffects } = await loadItemEffectsModule();
    const mutableIndexes = withRows(indexes, "gear", () => {});
    const state = equippedState(301011, "detached-sword", [
      { statModKey: 100102, value: 10 },
    ]);
    const stateBefore = JSON.stringify(state);
    const rowsBefore = JSON.stringify(mutableIndexes.tables.gear.rows);
    const catalogBefore = JSON.stringify(mutableIndexes.catalog);

    const projection = projectEquippedGearItemEffects({
      indexes: mutableIndexes,
      state,
      heroKey: 101,
      instanceId: "detached-sword",
    });

    expectDeeplyFrozen(projection);
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(mutableIndexes.tables.gear.rows)).toBe(rowsBefore);
    expect(JSON.stringify(mutableIndexes.catalog)).toBe(catalogBefore);

    state.heroes[0]!.equipment[0]!.asset.rolledStats[0]!.value = 15;
    (
      mutableIndexes.tables.gear.rows.find((row) => row.GearKey === 301011) as {
        BaseStat1_Value: number;
      }
    ).BaseStat1_Value = 999;
    expect(projection.effects.map((effect) => effect.rawValue)).toEqual([
      2, 10, 200, 100,
    ]);
    expect(() => {
      (
        projection.effects[0] as {
          rawValue: number;
        }
      ).rawValue = 999;
    }).toThrow();
  });
});
