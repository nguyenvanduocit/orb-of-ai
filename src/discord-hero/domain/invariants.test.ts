import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { equipGear } from "./equipment";
import type { SourceStatModRow } from "./items";
import { arrangePartySlot } from "./party";
import type { PlayerState } from "./player";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "./invariants";

let indexes: DiscordHeroCatalogIndexes;
let fresh: PlayerState;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  fresh = createFreshPlayerStateFromCatalog(indexes, 101);
});

const CAPACITY_TWO_RUNES = [
  { key: 1, level: 1 },
  { key: 20, level: 1 },
  { key: 21, level: 1 },
] as const;

const CAPACITY_THREE_RUNES = [
  ...CAPACITY_TWO_RUNES,
  { key: 22, level: 1 },
  { key: 23, level: 1 },
  { key: 24, level: 1 },
] as const;

function cloneFresh(): PlayerState {
  return structuredClone(fresh);
}

function freshHeroProgress(heroKey: number): PlayerState["heroes"][number] {
  return {
    heroKey,
    level: 1,
    xp: 0,
    attributes: [],
    skills: [],
    passives: [],
    equipment: [],
    skins: [],
  };
}

function groupedRows<Row, Key extends keyof Row>(
  rows: readonly Row[],
  primary: Key,
): ReadonlyMap<number, readonly Row[]> {
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const key = row[primary];
    if (typeof key !== "number") throw new Error("expected numeric group key");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function withRuneLevelValue(
  runeKey: number,
  value: number,
): DiscordHeroCatalogIndexes {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  const rows = table.rows.map((row) =>
    row.LevelKey === rune.LevelDataKey && row.Level === 1
      ? ({ ...row, Value: value } as DiscordHeroDatasetRow<"rune_levels">)
      : row,
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      rune_levels: {
        ...table,
        rows,
        groups: groupedRows(rows, "LevelKey"),
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function transitionOutcome(
  current: PlayerState,
  previous: PlayerState,
): string {
  try {
    validatePlayerAgainstCatalog(current, indexes, previous);
    return "ACCEPTED";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function withStatModRows(
  sourceRows: readonly SourceStatModRow[],
): DiscordHeroCatalogIndexes {
  const table = indexes.tables.stat_mods;
  const groups = new Map(table.groups);
  groups.set(100101, sourceRows);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      stat_mods: {
        ...table,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

describe("DiscordHero catalog-backed fresh player", () => {
  test("derives every gameplay default from source rows", () => {
    expect(fresh).toMatchObject({
      version: 1,
      gold: 100,
      party: [101, null, null],
      containers: {
        inventory: { unlockedSlots: 20, slots: [] },
        stash: { unlockedSlots: 41, slots: [] },
        storage: { unlockedSlots: 39, slots: [] },
        tradingStash: { unlockedSlots: 10, slots: [] },
      },
      cube: {
        level: 1,
        xp: 0,
        unlockedRecipes: [100001],
        unlockedSubRecipes: [100011],
      },
      offline: {
        accrualCursorMs: 0,
        rewardStageLevel: 1,
      },
    });
    expect(fresh.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);
    expect(fresh.skins.unlocked).toHaveLength(57);
    expect(validatePlayerAgainstCatalog(fresh, indexes)).toEqual(fresh);
  });
});

describe("DiscordHero player/catalog invariants", () => {
  test("rejects empty, holed, locked, duplicate, unowned, unreachable, and overflowing formations", () => {
    const empty = cloneFresh();
    empty.party = [null, null, null];
    expect(() => validatePlayerAgainstCatalog(empty, indexes)).toThrow(
      "party slot 1 must be occupied",
    );

    const holed = cloneFresh();
    holed.runes = CAPACITY_THREE_RUNES.map((rune) => ({ ...rune }));
    holed.party = [101, null, 201];
    expect(() => validatePlayerAgainstCatalog(holed, indexes)).toThrow(
      "party occupied slots must form a prefix",
    );

    const occupiedLocked = cloneFresh();
    occupiedLocked.party = [101, 201, null];
    expect(() => validatePlayerAgainstCatalog(occupiedLocked, indexes)).toThrow(
      "party slot 2 exceeds formation capacity 1",
    );

    const duplicate = cloneFresh();
    duplicate.party = [101, 101, null];
    expect(() => validatePlayerAgainstCatalog(duplicate, indexes)).toThrow(
      "party contains duplicate key 101",
    );

    const unowned = cloneFresh();
    unowned.party = [401, null, null];
    expect(() => validatePlayerAgainstCatalog(unowned, indexes)).toThrow(
      "party hero 401 is not owned",
    );

    const unreachable = cloneFresh();
    unreachable.runes = [{ key: 24, level: 1 }];
    expect(() => validatePlayerAgainstCatalog(unreachable, indexes)).toThrow(
      "runes[0] requires a predecessor at level 1",
    );

    const overflowing = cloneFresh();
    overflowing.runes = CAPACITY_TWO_RUNES.map((rune) => ({ ...rune }));
    expect(() =>
      validatePlayerAgainstCatalog(overflowing, withRuneLevelValue(21, 3)),
    ).toThrow("formation capacity 4 exceeds the three-slot party");
  });

  test("rejects Attribute spend above the owning Hero level budget", () => {
    const state = cloneFresh();
    state.heroes[0]!.attributes = [{ key: 101001, level: 2 }];

    expect(() => validatePlayerAgainstCatalog(state, indexes)).toThrow(
      "heroes[0] Attribute spend 2 exceeds Hero level budget 1",
    );
  });

  test("rejects zero-level and group-illegal Attribute progress", () => {
    const zero = cloneFresh();
    zero.heroes[0]!.attributes = [{ key: 101001, level: 0 }];
    expect(() => validatePlayerAgainstCatalog(zero, indexes)).toThrow(
      "heroes[0].attributes[0].level must be a positive safe integer",
    );

    const groupIllegal = cloneFresh();
    groupIllegal.heroes[0]!.level = 10;
    groupIllegal.heroes[0]!.attributes = [{ key: 101011, level: 1 }];
    expect(() => validatePlayerAgainstCatalog(groupIllegal, indexes)).toThrow(
      "heroes[0].attributes[0] requires 10 points spent in lower Attribute groups",
    );

    const selfBootstrapped = cloneFresh();
    selfBootstrapped.heroes[0]!.level = 11;
    selfBootstrapped.heroes[0]!.attributes = [
      { key: 101011, level: 8 },
      { key: 101012, level: 2 },
    ];
    expect(() =>
      validatePlayerAgainstCatalog(selfBootstrapped, indexes),
    ).toThrow(
      "heroes[0].attributes[0] requires 10 points spent in lower Attribute groups",
    );

    const shortByOne = cloneFresh();
    shortByOne.heroes[0]!.level = 11;
    shortByOne.heroes[0]!.attributes = [
      { key: 101001, level: 3 },
      { key: 101002, level: 6 },
      { key: 101011, level: 1 },
    ];
    expect(() => validatePlayerAgainstCatalog(shortByOne, indexes)).toThrow(
      "heroes[0].attributes[2] requires 10 points spent in lower Attribute groups",
    );
  });

  test("rejects every persisted catalog reference when its source row is absent", () => {
    const invalid = cloneFresh();
    invalid.heroes[0]!.heroKey = 999999;

    expect(() => validatePlayerAgainstCatalog(invalid, indexes)).toThrow(
      "heroes[0].heroKey references unknown heroes key 999999",
    );

    const invalidAsset = cloneFresh();
    invalidAsset.containers.inventory.slots.push({
      index: 0,
      asset: { kind: "stack", itemKey: 999999, quantity: 1 },
    });
    expect(() => validatePlayerAgainstCatalog(invalidAsset, indexes)).toThrow(
      "containers.inventory.slots[0].asset.itemKey references unknown items key 999999",
    );
  });

  test("enforces hero ownership, progression caps, prerequisites, and equipment slots", () => {
    const overleveledAttribute = cloneFresh();
    overleveledAttribute.heroes[0]!.attributes.push({
      key: 101001,
      level: 4,
    });
    expect(() =>
      validatePlayerAgainstCatalog(overleveledAttribute, indexes),
    ).toThrow("heroes[0].attributes[0].level exceeds attribute max 3");

    const missingRuneParent = cloneFresh();
    missingRuneParent.runes.push({ key: 11001, level: 1 });
    expect(() =>
      validatePlayerAgainstCatalog(missingRuneParent, indexes),
    ).toThrow("runes[0] requires a predecessor at level 1");

    const nullLevelStillRequiresParent = cloneFresh();
    nullLevelStillRequiresParent.runes.push({ key: 10, level: 1 });
    expect(() =>
      validatePlayerAgainstCatalog(nullLevelStillRequiresParent, indexes),
    ).toThrow("runes[0] requires a predecessor at level 1");

    const exactParentChain = cloneFresh();
    exactParentChain.runes.push(
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 21, level: 1 },
      { key: 22, level: 1 },
      { key: 23, level: 1 },
    );
    expect(validatePlayerAgainstCatalog(exactParentChain, indexes)).toEqual(
      exactParentChain,
    );

    const wrongSlot = cloneFresh();
    wrongSlot.heroes[0]!.equipment.push({
      slot: "BOW",
      asset: {
        kind: "gear",
        instanceId: "wrong-slot",
        itemKey: 300001,
        rolledStats: [],
      },
    });
    expect(() => validatePlayerAgainstCatalog(wrongSlot, indexes)).toThrow(
      "equipment slot BOW does not match item 300001 gear type SWORD",
    );
  });

  test("resolves persisted rolled-stat references against grouped stat-mod keys", () => {
    const valid = cloneFresh();
    valid.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "grouped-stat-mod",
        itemKey: 300001,
        rolledStats: [{ statModKey: 100101, value: 1 }],
      },
    });
    expect(validatePlayerAgainstCatalog(valid, indexes)).toEqual(valid);

    valid.heroes[0]!.equipment[0]!.asset.rolledStats[0]!.statModKey = 999999;
    expect(() => validatePlayerAgainstCatalog(valid, indexes)).toThrow(
      "heroes[0].equipment.SWORD.asset.rolledStats[0].statModKey references unknown stat_mods key 999999",
    );
  });

  test("rejects a source-known rolled-stat value outside every pinned tier candidate without mutation", () => {
    const invalid = cloneFresh();
    invalid.containers.inventory.slots.push({
      index: 0,
      asset: {
        kind: "gear",
        instanceId: "forged-known-stat",
        itemKey: 300001,
        rolledStats: [{ statModKey: 100101, value: 999999 }],
      },
    });
    const before = structuredClone(invalid);

    expect(() => validatePlayerAgainstCatalog(invalid, indexes)).toThrow(
      "stat mod 100101 value 999999 is not a source candidate",
    );
    expect(invalid).toEqual(before);
  });

  test("accepts empty rolls and exact lower and upper source-union candidates", () => {
    for (const [instanceId, rolledStats] of [
      ["empty-rolls", []],
      ["lower-source-candidate", [{ statModKey: 100101, value: 1 }]],
      ["upper-source-candidate", [{ statModKey: 100101, value: 300 }]],
    ] as const) {
      const valid = cloneFresh();
      valid.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId,
          itemKey: 300001,
          rolledStats: [...rolledStats],
        },
      });

      expect(validatePlayerAgainstCatalog(valid, indexes)).toEqual(valid);
    }
  });

  test("rejects a malformed matching source interval before persisted validation or equip in either row order", () => {
    const source = indexes.tables.stat_mods.groups
      .get(100101)
      ?.find(
        (row) => row.MinValue === 1 && row.MaxValue === 2 && row.Interval === 1,
      );
    expect(source).toBeDefined();
    const valid = { ...source! };
    const malformed = { ...valid, Tier: 999, Interval: 0 };

    for (const sourceRows of [
      [valid, malformed],
      [malformed, valid],
    ] as const) {
      const adversarialIndexes = withStatModRows(sourceRows);
      const persistedState = cloneFresh();
      persistedState.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "malformed-source-interval",
          itemKey: 300001,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      });
      const equipState = structuredClone(persistedState);
      const persistedStateBefore = structuredClone(persistedState);
      const equipStateBefore = structuredClone(equipState);
      const sourceRowsBefore = structuredClone(sourceRows);
      const catalogBytesBefore = JSON.stringify(adversarialIndexes.catalog);

      expect(() =>
        validatePlayerAgainstCatalog(persistedState, adversarialIndexes),
      ).toThrow("stat mod 100101 interval must be a positive safe integer");
      expect(() => equipGear(adversarialIndexes, equipState, 101, 0)).toThrow(
        "stat mod 100101 interval must be a positive safe integer",
      );
      expect(persistedState).toEqual(persistedStateBefore);
      expect(equipState).toEqual(equipStateBefore);
      expect(sourceRows).toEqual(sourceRowsBefore);
      expect(JSON.stringify(adversarialIndexes.catalog)).toBe(
        catalogBytesBefore,
      );
    }
  });

  test("enforces catalog capacities and Cube unlock relationships", () => {
    const capacity = cloneFresh();
    capacity.containers.inventory.unlockedSlots = 261;
    expect(() => validatePlayerAgainstCatalog(capacity, indexes)).toThrow(
      "inventory unlocked capacity exceeds catalog row count 260",
    );

    const lockedMainRecipe = cloneFresh();
    lockedMainRecipe.cube.unlockedSubRecipes.push(200011);
    expect(() =>
      validatePlayerAgainstCatalog(lockedMainRecipe, indexes),
    ).toThrow("Cube sub-recipe 200011 requires main recipe type ALCHEMY");
  });

  test("requires every source-default Cube recipe and sub-recipe", () => {
    const missingDefaultRecipe = cloneFresh();
    missingDefaultRecipe.cube.unlockedRecipes = [];
    missingDefaultRecipe.cube.unlockedSubRecipes = [];
    expect(() =>
      validatePlayerAgainstCatalog(missingDefaultRecipe, indexes),
    ).toThrow("Cube default recipe 100001 must be unlocked");

    const missingDefaultSubRecipe = cloneFresh();
    missingDefaultSubRecipe.cube.unlockedSubRecipes = [];
    expect(() =>
      validatePlayerAgainstCatalog(missingDefaultSubRecipe, indexes),
    ).toThrow("Cube default sub-recipe 100011 must be unlocked");

    const alchemyWithoutDefaultSubRecipe = cloneFresh();
    alchemyWithoutDefaultSubRecipe.cube.unlockedRecipes.push(200001);
    expect(() =>
      validatePlayerAgainstCatalog(alchemyWithoutDefaultSubRecipe, indexes),
    ).toThrow("Cube default sub-recipe 200011 must be unlocked");

    const craftingWithoutDefaultSubRecipe = cloneFresh();
    craftingWithoutDefaultSubRecipe.cube.unlockedRecipes.push(600001);
    expect(() =>
      validatePlayerAgainstCatalog(craftingWithoutDefaultSubRecipe, indexes),
    ).toThrow("Cube default sub-recipe 600011 must be unlocked");
  });

  test("rejects stage-session rewards that cannot originate from the selected stage", () => {
    const invalid = cloneFresh();
    invalid.stageSession = {
      sessionId: "stage-1101",
      stageKey: 1101,
      party: [101, 201, 301],
      startedAtMs: 1_000,
      advancedThroughMs: 1_000,
      wave: 0,
      rngSeed: "seed",
      rngCursor: 0,
      pendingRewards: {
        gold: 0,
        xp: 0,
        items: [{ kind: "stack", itemKey: 300001, quantity: 1 }],
      },
    };

    expect(() => validatePlayerAgainstCatalog(invalid, indexes)).toThrow(
      "stageSession.pendingRewards.items[0] item 300001 has no reward origin in stage 1101",
    );

    invalid.stageSession.pendingRewards.items[0] = {
      kind: "stack",
      itemKey: 910011,
      quantity: 1,
    };
    expect(validatePlayerAgainstCatalog(invalid, indexes)).toEqual(invalid);
  });

  test("rejects unsupported state versions and regressing RNG/campaign state", () => {
    const unsupported = {
      ...cloneFresh(),
      version: 2,
    };
    expect(() => validatePlayerAgainstCatalog(unsupported, indexes)).toThrow(
      "player state does not match schema version 1",
    );

    const previous = cloneFresh();
    previous.campaign.highestStageKey = 1102;
    previous.campaign.stages.push({
      stageKey: 1101,
      clearCount: 2,
      firstClearClaimed: true,
      bestClearMs: 1_000,
    });
    previous.stageSession = {
      sessionId: "same-session",
      stageKey: 1102,
      party: [101, 201, 301],
      startedAtMs: 1_000,
      advancedThroughMs: 2_000,
      wave: 2,
      rngSeed: "fixed-seed",
      rngCursor: 10,
      pendingRewards: { gold: 0, xp: 0, items: [] },
    };

    const regressed = structuredClone(previous);
    regressed.campaign.highestStageKey = 1101;
    regressed.campaign.stages[0]!.clearCount = 1;
    regressed.stageSession!.rngCursor = 9;

    expect(() =>
      validatePlayerAgainstCatalog(regressed, indexes, previous),
    ).toThrow("campaign.highestStageKey cannot regress from 1102 to 1101");

    regressed.campaign.highestStageKey = 1102;
    expect(() =>
      validatePlayerAgainstCatalog(regressed, indexes, previous),
    ).toThrow("campaign stage 1101 clear count cannot decrease");

    regressed.campaign.stages[0]!.clearCount = 2;
    expect(() =>
      validatePlayerAgainstCatalog(regressed, indexes, previous),
    ).toThrow("stageSession.rngCursor cannot decrease within same-session");
  });

  test("rejects removal or level rollback for every keyed hero progression collection", () => {
    const previous = cloneFresh();
    previous.heroes[0]!.level = 3;
    previous.heroes[0]!.attributes = [{ key: 101001, level: 2 }];
    previous.heroes[0]!.skills = [{ key: 10101, level: 2 }];
    previous.heroes[0]!.passives = [{ key: 101001, level: 2 }];

    const cases = [
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.attributes = [];
        },
        message: "hero 101 attributes cannot lose key 101001",
      },
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.attributes[0]!.level = 1;
        },
        message: "hero 101 attribute 101001 level cannot regress",
      },
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.skills = [];
        },
        message: "hero 101 skills cannot lose key 10101",
      },
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.skills[0]!.level = 1;
        },
        message: "hero 101 skill 10101 level cannot regress",
      },
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.passives = [];
        },
        message: "hero 101 passives cannot lose key 101001",
      },
      {
        mutate: (current: PlayerState) => {
          current.heroes[0]!.passives[0]!.level = 1;
        },
        message: "hero 101 passive 101001 level cannot regress",
      },
    ] as const;

    for (const scenario of cases) {
      const current = structuredClone(previous);
      scenario.mutate(current);
      expect(() =>
        validatePlayerAgainstCatalog(current, indexes, previous),
      ).toThrow(scenario.message);
    }
  });

  test("rejects every unsupported ordered Hero ownership transition with one exact boundary", () => {
    const additionPrevious = cloneFresh();
    const additionCurrent = structuredClone(additionPrevious);
    additionCurrent.heroes.push(freshHeroProgress(401));

    const removalPrevious = structuredClone(additionCurrent);
    const removalCurrent = cloneFresh();

    const reorderPrevious = cloneFresh();
    const reorderCurrent = structuredClone(reorderPrevious);
    reorderCurrent.heroes = [
      reorderCurrent.heroes[1]!,
      reorderCurrent.heroes[0]!,
      reorderCurrent.heroes[2]!,
    ];

    const replacementPrevious = structuredClone(additionCurrent);
    const replacementCurrent = structuredClone(replacementPrevious);
    replacementCurrent.heroes[3] = freshHeroProgress(501);

    const outcomes = [
      [additionPrevious, additionCurrent],
      [removalPrevious, removalCurrent],
      [reorderPrevious, reorderCurrent],
      [replacementPrevious, replacementCurrent],
    ].map(([previous, current]) => {
      expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
      expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
      const previousBefore = structuredClone(previous);
      const currentBefore = structuredClone(current);

      const outcome = transitionOutcome(current, previous);
      expect(previous).toEqual(previousBefore);
      expect(current).toEqual(currentBefore);
      return outcome;
    });
    expect(outcomes).toEqual([
      "Hero ownership transition is unsupported without source-backed runtime semantics",
      "Hero ownership transition is unsupported without source-backed runtime semantics",
      "Hero ownership transition is unsupported without source-backed runtime semantics",
      "Hero ownership transition is unsupported without source-backed runtime semantics",
    ]);
  });

  test("accepts replace, fill, and swap transitions reproduced by one party operation", () => {
    const capacityTwo = cloneFresh();
    capacityTwo.runes = CAPACITY_TWO_RUNES.map((rune) => ({ ...rune }));
    const capacityTwoFilled = structuredClone(capacityTwo);
    capacityTwoFilled.party = [101, 201, null];
    const cases = [
      [cloneFresh(), 1, 201],
      [capacityTwo, 2, 201],
      [capacityTwoFilled, 1, 201],
    ] as const;

    for (const [previous, targetSlot, selectedHeroKey] of cases) {
      const arranged = arrangePartySlot(
        indexes,
        previous,
        targetSlot,
        selectedHeroKey,
      );
      if (arranged.kind !== "changed") throw new Error("expected transition");
      expect(
        validatePlayerAgainstCatalog(arranged.state, indexes, previous),
      ).toEqual(arranged.state);
    }
  });

  test("rejects a valid formation that cannot be reproduced by one party operation", () => {
    const previous = cloneFresh();
    previous.runes = CAPACITY_TWO_RUNES.map((rune) => ({ ...rune }));
    previous.party = [101, 201, null];
    const current = structuredClone(previous);
    current.party = [301, 101, null];

    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "Party formation transition is unsupported without source-backed runtime semantics",
    );
  });

  test("validates current and previous snapshots before ownership transition gates", () => {
    const previous = cloneFresh();
    previous.heroes.push(freshHeroProgress(401));
    previous.heroes[3]!.level = 0;
    const current = cloneFresh();

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow("heroes.3.level");

    const invalidCurrent = structuredClone(previous);
    expect(() =>
      validatePlayerAgainstCatalog(invalidCurrent, indexes, cloneFresh()),
    ).toThrow("heroes.3.level");
  });

  test("rejects every unsupported ordered global Skin ownership transition with one exact boundary", () => {
    const additionPrevious = cloneFresh();
    const additionCurrent = structuredClone(additionPrevious);
    additionCurrent.skins.unlocked.push(11021);

    const removalPrevious = cloneFresh();
    const removalCurrent = structuredClone(removalPrevious);
    removalCurrent.skins.unlocked = removalCurrent.skins.unlocked.slice(1);

    const reorderPrevious = cloneFresh();
    const reorderCurrent = structuredClone(reorderPrevious);
    [reorderCurrent.skins.unlocked[0], reorderCurrent.skins.unlocked[1]] = [
      reorderCurrent.skins.unlocked[1]!,
      reorderCurrent.skins.unlocked[0]!,
    ];

    const replacementPrevious = cloneFresh();
    const replacementCurrent = structuredClone(replacementPrevious);
    replacementCurrent.skins.unlocked[0] = 11021;

    const outcomes = [
      [additionPrevious, additionCurrent],
      [removalPrevious, removalCurrent],
      [reorderPrevious, reorderCurrent],
      [replacementPrevious, replacementCurrent],
    ].map(([previous, current]) => {
      expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
      expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
      const previousBefore = structuredClone(previous);
      const currentBefore = structuredClone(current);

      const outcome = transitionOutcome(current, previous);
      expect(previous).toEqual(previousBefore);
      expect(current).toEqual(currentBefore);
      return outcome;
    });
    expect(outcomes).toEqual([
      "Skin ownership transition is unsupported without source-backed purchase semantics",
      "Skin ownership transition is unsupported without source-backed purchase semantics",
      "Skin ownership transition is unsupported without source-backed purchase semantics",
      "Skin ownership transition is unsupported without source-backed purchase semantics",
    ]);
  });

  test("rejects every unsupported equipped Skin transition for existing Heroes", () => {
    const equipPrevious = cloneFresh();
    const equipCurrent = structuredClone(equipPrevious);
    equipCurrent.heroes[0]!.skins = [{ partsCategory: "Body", skinKey: 10001 }];

    const unequipPrevious = cloneFresh();
    unequipPrevious.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 10001 },
    ];
    const unequipCurrent = structuredClone(unequipPrevious);
    unequipCurrent.heroes[0]!.skins = [];

    const replacementPrevious = cloneFresh();
    replacementPrevious.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 10001 },
    ];
    const replacementCurrent = structuredClone(replacementPrevious);
    replacementCurrent.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 10002 },
    ];

    const movementPrevious = cloneFresh();
    movementPrevious.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 10001 },
    ];
    const movementCurrent = structuredClone(movementPrevious);
    movementCurrent.heroes[1]!.skins = movementCurrent.heroes[0]!.skins;
    movementCurrent.heroes[0]!.skins = [];

    const outcomes = [
      [equipPrevious, equipCurrent],
      [unequipPrevious, unequipCurrent],
      [replacementPrevious, replacementCurrent],
      [movementPrevious, movementCurrent],
    ].map(([previous, current]) => {
      expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
      expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
      const previousBefore = structuredClone(previous);
      const currentBefore = structuredClone(current);

      const outcome = transitionOutcome(current, previous);
      expect(previous).toEqual(previousBefore);
      expect(current).toEqual(currentBefore);
      return outcome;
    });
    expect(outcomes).toEqual([
      "equipped Skin transition is unsupported without source-backed runtime semantics",
      "equipped Skin transition is unsupported without source-backed runtime semantics",
      "equipped Skin transition is unsupported without source-backed runtime semantics",
      "equipped Skin transition is unsupported without source-backed runtime semantics",
    ]);
  });

  test("validates current and previous Skin snapshots before transition gates", () => {
    const mismatchedCurrent = cloneFresh();
    mismatchedCurrent.heroes[0]!.skins = [
      { partsCategory: "Head", skinKey: 10001 },
    ];
    mismatchedCurrent.skins.unlocked.push(11021);
    expect(() =>
      validatePlayerAgainstCatalog(mismatchedCurrent, indexes, cloneFresh()),
    ).toThrow(
      "heroes[0].skins[0].partsCategory Head does not match skin 10001 category Body",
    );

    const unknownPrevious = cloneFresh();
    unknownPrevious.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 999999 },
    ];
    const ownershipChangedCurrent = cloneFresh();
    ownershipChangedCurrent.skins.unlocked.push(11021);
    expect(() =>
      validatePlayerAgainstCatalog(
        ownershipChangedCurrent,
        indexes,
        unknownPrevious,
      ),
    ).toThrow("heroes[0].skins[0].skinKey references unknown skins key 999999");

    const duplicateEquippedCurrent = cloneFresh();
    duplicateEquippedCurrent.heroes[0]!.skins = [
      { partsCategory: "Body", skinKey: 10001 },
      { partsCategory: "Body", skinKey: 10002 },
    ];
    duplicateEquippedCurrent.skins.unlocked.push(11021);
    expect(() =>
      validatePlayerAgainstCatalog(
        duplicateEquippedCurrent,
        indexes,
        cloneFresh(),
      ),
    ).toThrow("skins repeat category Body");

    const duplicateUnlockedCurrent = cloneFresh();
    duplicateUnlockedCurrent.skins.unlocked.push(
      duplicateUnlockedCurrent.skins.unlocked[0]!,
    );
    expect(() =>
      validatePlayerAgainstCatalog(
        duplicateUnlockedCurrent,
        indexes,
        cloneFresh(),
      ),
    ).toThrow("skins.unlocked contains duplicate key");
  });

  test("allows supported transitions through distinct ownership and party aliases", () => {
    const previous = cloneFresh();
    previous.heroes[0]!.skins = [{ partsCategory: "Body", skinKey: 10001 }];
    const current = structuredClone(previous);
    current.gold = 101;
    current.heroes[0]!.level = 2;
    current.heroes[0]!.xp = 1;
    current.heroes[0]!.attributes = [{ key: 101001, level: 1 }];
    current.heroes[0]!.equipment = [
      {
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "supported-transition-equipment",
          itemKey: 300001,
          rolledStats: [],
        },
      },
    ];
    current.containers.inventory.slots.push({
      index: 0,
      asset: { kind: "stack", itemKey: 910011, quantity: 1 },
    });
    current.offline.accrualCursorMs = 1;
    current.runes.push({ key: 1, level: 1 });
    current.cube.xp = 1;
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    const validated = validatePlayerAgainstCatalog(current, indexes, previous);

    expect(validated).toEqual(current);
    expect(validated).not.toBe(current);
    expect(validated.heroes).not.toBe(current.heroes);
    expect(validated.party).not.toBe(current.party);
    expect(previous.heroes).not.toBe(current.heroes);
    expect(previous.party).not.toBe(current.party);
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("allows an Alchemy-shaped structural-sharing transition", () => {
    const previous = cloneFresh();
    previous.heroes[0]!.skins = [{ partsCategory: "Body", skinKey: 10001 }];
    const current: PlayerState = {
      ...previous,
      gold: 101,
      containers: {
        ...previous.containers,
        inventory: {
          ...previous.containers.inventory,
          slots: [...previous.containers.inventory.slots],
        },
      },
      cube: {
        ...previous.cube,
        xp: 1,
      },
    };
    expect(current.heroes).toBe(previous.heroes);
    expect(current.party).toBe(previous.party);
    expect(current.skins).toBe(previous.skins);
    expect(current.heroes[0]!.skins).toBe(previous.heroes[0]!.skins);
    expect(current.containers).not.toBe(previous.containers);
    expect(current.cube).not.toBe(previous.cube);

    expect(validatePlayerAgainstCatalog(current, indexes, previous)).toEqual(
      current,
    );
  });

  test("accepts unchanged persisted Pet state and returns detached state", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001, 1002];
    previous.pets.active = 1001;
    const current = structuredClone(previous);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);
    const catalogBefore = JSON.stringify(indexes.catalog);

    const validated = validatePlayerAgainstCatalog(current, indexes, previous);

    expect(validated).toEqual(current);
    expect(validated).not.toBe(current);
    expect(validated.pets).not.toBe(current.pets);
    expect(validated.pets.unlocked).not.toBe(current.pets.unlocked);
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
    expect(JSON.stringify(indexes.catalog)).toBe(catalogBefore);
  });

  test("keeps a non-Pet transition valid while Pet state is unchanged", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001];
    previous.pets.active = 1001;
    const current = structuredClone(previous);
    current.offline.accrualCursorMs = 1;
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(validatePlayerAgainstCatalog(current, indexes, previous)).toEqual(
      current,
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported Pet ownership addition without mutating inputs", () => {
    const previous = cloneFresh();
    const current = structuredClone(previous);
    current.pets.unlocked = [1001];
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "Pet ownership transition is unsupported without source-backed provenance",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported Pet ownership removal without mutating inputs", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001];
    const current = structuredClone(previous);
    current.pets.unlocked = [];
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "Pet ownership transition is unsupported without source-backed provenance",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported Pet ownership reordering without mutating inputs", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001, 1002];
    const current = structuredClone(previous);
    current.pets.unlocked = [1002, 1001];
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "Pet ownership transition is unsupported without source-backed provenance",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported arranged Pet null-to-owned transition without mutating inputs", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001, 1002];
    const current = structuredClone(previous);
    current.pets.active = 1001;
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "arranged Pet transition is unsupported without source-backed runtime semantics",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported arranged Pet owned-to-other transition without mutating inputs", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001, 1002];
    previous.pets.active = 1001;
    const current = structuredClone(previous);
    current.pets.active = 1002;
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "arranged Pet transition is unsupported without source-backed runtime semantics",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("rejects unsupported arranged Pet owned-to-null transition without mutating inputs", () => {
    const previous = cloneFresh();
    previous.pets.unlocked = [1001];
    previous.pets.active = 1001;
    const current = structuredClone(previous);
    current.pets.active = null;
    expect(validatePlayerAgainstCatalog(previous, indexes)).toEqual(previous);
    expect(validatePlayerAgainstCatalog(current, indexes)).toEqual(current);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    expect(() =>
      validatePlayerAgainstCatalog(current, indexes, previous),
    ).toThrow(
      "arranged Pet transition is unsupported without source-backed runtime semantics",
    );
    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });

  test("compares Cube progress cumulatively and rejects other persisted progress rollback", () => {
    const previous = cloneFresh();
    previous.cube.xp = 14;
    previous.offline.accrualCursorMs = 10_000;
    previous.offline.rewardStageLevel = 2;

    const completedLevel = structuredClone(previous);
    completedLevel.cube.level = 2;
    completedLevel.cube.xp = 0;
    expect(
      validatePlayerAgainstCatalog(completedLevel, indexes, previous),
    ).toEqual(completedLevel);

    const cubeRollback = structuredClone(previous);
    cubeRollback.cube.xp = 13;
    expect(() =>
      validatePlayerAgainstCatalog(cubeRollback, indexes, previous),
    ).toThrow("Cube progression cannot regress from 14 to 13 cumulative XP");

    const cursorRollback = structuredClone(completedLevel);
    cursorRollback.offline.accrualCursorMs = 9_999;
    expect(() =>
      validatePlayerAgainstCatalog(cursorRollback, indexes, previous),
    ).toThrow("offline.accrualCursorMs cannot decrease");

    const rewardStageRollback = structuredClone(completedLevel);
    rewardStageRollback.offline.rewardStageLevel = 1;
    expect(() =>
      validatePlayerAgainstCatalog(rewardStageRollback, indexes, previous),
    ).toThrow("offline.rewardStageLevel cannot regress from 2 to 1");
  });

  test("fails closed on pending gold and XP without bounded source provenance", () => {
    const invalid = cloneFresh();
    invalid.stageSession = {
      sessionId: "unproven-currency",
      stageKey: 1101,
      party: [101, 201, 301],
      startedAtMs: 1_000,
      advancedThroughMs: 1_000,
      wave: 0,
      rngSeed: "seed",
      rngCursor: 0,
      pendingRewards: {
        gold: Number.MAX_SAFE_INTEGER,
        xp: 0,
        items: [],
      },
    };

    expect(() => validatePlayerAgainstCatalog(invalid, indexes)).toThrow(
      "stageSession.pendingRewards.gold must be zero without source-derived provenance",
    );

    invalid.stageSession.pendingRewards.gold = 0;
    invalid.stageSession.pendingRewards.xp = Number.MAX_SAFE_INTEGER;
    expect(() => validatePlayerAgainstCatalog(invalid, indexes)).toThrow(
      "stageSession.pendingRewards.xp must be zero without source-derived provenance",
    );
  });
});
