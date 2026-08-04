import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectPetEffects } from "./pet-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const EMPTY = { unlocked: [], active: null } as const;

const KILL_MONSTER_PETS = [
  [1001, 10031],
  [1002, 20051],
  [1003, 20091],
  [1004, 30091],
  [1005, 30051],
] as const;

const DLC_PACK_PARAM1 = 4427390;
const DLC_PETS = [6001, 6002, 6003] as const;

const PET_STAT_SOURCE_ROWS = [
  [1001, "DropChanceNormalChestPercent", "FLAT", 100],
  [1001, "IncreaseExpAmount", "FLAT", 150],
  [1002, "IncreaseGoldAmount", "FLAT", 150],
  [1003, "DropChanceStageBossChestPercent", "FLAT", 100],
  [1004, "DropChanceNormalChestPercent", "FLAT", 150],
  [1005, "DropChanceStageBossChestPercent", "FLAT", 150],
  [6001, "IncreaseExpAmount", "FLAT", 150],
  [6002, "IncreaseGoldAmount", "FLAT", 100],
  [6003, "DropChanceNormalChestPercent", "FLAT", 200],
  [6003, "IncreaseGoldAmount", "FLAT", 150],
  [6003, "IncreaseExpAmount", "FLAT", 200],
] as const;

const PET_STAT_FIELDS = ["PetStatKey", "STATTYPE", "MODTYPE", "Value"] as const;

/**
 * Independent freeze oracle: walks Reflect.ownKeys, NOT Object.values, so it
 * can observe a non-enumerable or symbol-keyed child that an Object.values
 * based deep freeze would silently skip. A mirrored oracle would be vacuous.
 */
function expectDeeplyFrozen(value: unknown, path = "$"): void {
  if (typeof value !== "object" || value === null) return;
  expect(`${path}:${Object.isFrozen(value)}`).toBe(`${path}:true`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(`${path}.${String(key)} accessor`).toBe(
      descriptor?.get === undefined && descriptor?.set === undefined
        ? `${path}.${String(key)} accessor`
        : "unexpected accessor in projected output",
    );
    expectDeeplyFrozen(
      (value as Record<string | symbol, unknown>)[key],
      `${path}.${String(key)}`,
    );
  }
}

function collectObjects(root: unknown, depth = 0): Set<unknown> {
  const seen = new Set<unknown>();
  const walk = (value: unknown, level: number): void => {
    if (level > 8 || typeof value !== "object" || value === null) return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) walk(child, level + 1);
  };
  walk(root, depth);
  return seen;
}

function withRows(
  source: DiscordHeroCatalogIndexes,
  name: "pets" | "pet_stats" | "monsters",
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables[name].rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: { ...source.tables[name], rows },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function expectRejectedWithoutMutation(
  forgedIndexes: DiscordHeroCatalogIndexes,
  state: {
    readonly unlocked: readonly number[];
    readonly active: number | null;
  },
  expectedMessage: string,
): void {
  const indexesSnapshot = JSON.stringify({
    pets: forgedIndexes.tables.pets.rows,
    petStats: forgedIndexes.tables.pet_stats.rows,
    monsters: forgedIndexes.tables.monsters.rows,
  });
  const stateSnapshot = JSON.stringify(state);
  let returned: unknown = "SENTINEL";
  let caught: unknown = null;

  try {
    returned = projectPetEffects({ indexes: forgedIndexes, state });
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe(expectedMessage);
  expect(returned).toBe("SENTINEL");
  expect(
    JSON.stringify({
      pets: forgedIndexes.tables.pets.rows,
      petStats: forgedIndexes.tables.pet_stats.rows,
      monsters: forgedIndexes.tables.monsters.rows,
    }),
  ).toBe(indexesSnapshot);
  expect(JSON.stringify(state)).toBe(stateSnapshot);
}

function withPoisonedPetStatSecondReads(source: DiscordHeroCatalogIndexes): {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly reads: ReadonlyMap<string, number>;
} {
  const reads = new Map<string, number>();
  const forged = withRows(source, "pet_stats", (rows) => {
    rows.forEach((row, rowIndex) => {
      const honest = { ...row };
      const counted: Record<string, unknown> = {};
      for (const field of PET_STAT_FIELDS) {
        Object.defineProperty(counted, field, {
          enumerable: true,
          configurable: true,
          get() {
            const readKey = `${rowIndex}.${field}`;
            const count = (reads.get(readKey) ?? 0) + 1;
            reads.set(readKey, count);
            if (count === 1) return honest[field];
            switch (field) {
              case "PetStatKey":
                return 999_999;
              case "STATTYPE":
                return `SmuggledStat${rowIndex}`;
              case "MODTYPE":
                return "ADDITIVE";
              case "Value":
                return 999_999 + rowIndex;
            }
          },
        });
      }
      rows[rowIndex] = counted;
    });
  });
  return { indexes: forged, reads };
}

/**
 * Serves the canonical monsters table for its first `honestReads` reads of
 * `tables.monsters`, then a permissive one whose groups.has() always returns
 * true. Pet row 0 is pointed at a monster that does not exist.
 *
 * The accessor sits on `tables`, NOT on `monsters.groups`: a `groups` accessor
 * is rejected by the own-data-property snapshot before the pet loop ever runs,
 * so it can only prove "an accessor is rejected" -- never "the loop consults
 * the captured local". Switching one level up is what separates capture-once
 * from validate-then-re-read.
 */
function withSwitchingMonstersTable(honestReads: number): {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly monstersReads: () => number;
} {
  const petRows = indexes.tables.pets.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  petRows[0]!.Param1 = 999_999;

  const canonical = indexes.tables.monsters;
  const permissive = { ...canonical, groups: { has: () => true } };
  let monstersReads = 0;
  const tables: Record<string, unknown> = {};
  for (const [name, table] of Object.entries(indexes.tables)) {
    if (name !== "monsters") tables[name] = table;
  }
  tables.pets = { ...indexes.tables.pets, rows: petRows };
  Object.defineProperty(tables, "monsters", {
    enumerable: true,
    configurable: true,
    get() {
      monstersReads += 1;
      return monstersReads <= honestReads ? canonical : permissive;
    },
  });
  return {
    indexes: { ...indexes, tables } as unknown as DiscordHeroCatalogIndexes,
    monstersReads: () => monstersReads,
  };
}

describe("DiscordHero pet-effect projection", () => {
  test("consults the captured monsters.groups instead of re-reading it per pet", () => {
    // Canonical reads tables.monsters EXACTLY twice: once in the table-shape
    // loop, once in the own-data-property snapshot. Reading
    // indexes.tables.monsters.groups live inside the KillMonster branch would
    // add one read per KillMonster pet -- and would consult the permissive
    // table, silently accepting a monster that does not exist.
    const poisoned = withSwitchingMonstersTable(2);
    const state = { unlocked: [1002, 6003], active: 6003 };
    const petsSnapshot = JSON.stringify(poisoned.indexes.tables.pets.rows);
    const statsSnapshot = JSON.stringify(
      poisoned.indexes.tables.pet_stats.rows,
    );
    const stateSnapshot = JSON.stringify(state);

    let returned: unknown = "SENTINEL";
    let caught: unknown = null;
    try {
      returned = projectPetEffects({ indexes: poisoned.indexes, state });
    } catch (error) {
      caught = error;
    }
    // Sampled immediately, so no later assertion can perturb the counter.
    const poisonedReads = poisoned.monstersReads();

    // The security property: the poisoned table is never consulted, so the
    // unknown monster is still rejected.
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "pets.Param1 references unknown monster 999999",
    );
    expect(returned).toBe("SENTINEL");
    expect(JSON.stringify(poisoned.indexes.tables.pets.rows)).toBe(
      petsSnapshot,
    );
    expect(JSON.stringify(poisoned.indexes.tables.pet_stats.rows)).toBe(
      statsSnapshot,
    );
    expect(JSON.stringify(state)).toBe(stateSnapshot);
    // The mechanism that delivers it: capture once, never re-read.
    expect(poisonedReads).toBe(2);

    // Same count when the accessor never turns permissive, so the count pins
    // capture-once itself rather than an artefact of the poisoning.
    const honest = withSwitchingMonstersTable(Number.MAX_SAFE_INTEGER);
    expect(() =>
      projectPetEffects({ indexes: honest.indexes, state: EMPTY }),
    ).toThrow("pets.Param1 references unknown monster 999999");
    expect(honest.monstersReads()).toBe(2);
  });

  test("projects the exact 8-pet, 11-stat-row source corpus with source ordering", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });

    expect(projection.counts).toEqual({
      pets: 8,
      petStatRows: 11,
      killMonsterPets: 5,
      dlcPets: 3,
    });
    expect(projection.pets).toHaveLength(8);
    expect(projection.pets.map((pet) => pet.petKey)).toEqual([
      1001, 1002, 1003, 1004, 1005, 6001, 6002, 6003,
    ]);
    expect(projection.pets.map((pet) => pet.rowIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(
      projection.pets.map((pet) => [
        pet.petKey,
        pet.nameKey,
        pet.descriptionKey,
        pet.statDataKey,
      ]),
    ).toEqual(
      indexes.tables.pets.rows.map((row) => [
        row.PetKey,
        row.NameKey,
        row.DescriptionKey,
        row.StatDataKey,
      ]),
    );
    expect(
      projection.pets
        .flatMap((pet) => pet.effects)
        .map((effect) => effect.value).length,
    ).toBe(11);
  });

  test("preserves every pet_stats row verbatim, in group order, with provenance", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });
    const flattened = projection.pets.flatMap((pet) => pet.effects);

    expect(
      flattened.map((effect) => [
        effect.petStatKey,
        effect.statType,
        effect.modType,
        effect.value,
      ]),
    ).toEqual(PET_STAT_SOURCE_ROWS.map((row) => [...row]));
    expect(
      flattened.map((effect) => [
        effect.provenance.rowIndex,
        effect.provenance.groupIndex,
      ]),
    ).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 0],
      [9, 1],
      [10, 2],
    ]);
    expect(
      new Set(flattened.map((effect) => effect.provenance.rowIndex)).size,
    ).toBe(11);
    expect(
      new Set(
        flattened.map(
          (effect) =>
            `${effect.provenance.statDataKey}:${effect.provenance.groupIndex}`,
        ),
      ).size,
    ).toBe(11);
    for (const effect of flattened) {
      expect(effect.provenance.table).toBe("pet_stats");
      expect(effect.provenance.primaryField).toBe("PetStatKey");
      expect(effect.provenance.statDataKey).toBe(effect.petStatKey);
      expect(effect.unit).toBe("UNPROVEN");
    }
    // group row order and multi-row groups survive exactly
    const byKey = new Map(
      projection.pets.map((pet) => [pet.petKey, pet.effects]),
    );
    expect(
      byKey.get(1001)!.map((effect) => [effect.statType, effect.value]),
    ).toEqual([
      ["DropChanceNormalChestPercent", 100],
      ["IncreaseExpAmount", 150],
    ]);
    expect(
      byKey.get(6003)!.map((effect) => [effect.statType, effect.value]),
    ).toEqual([
      ["DropChanceNormalChestPercent", 200],
      ["IncreaseGoldAmount", 150],
      ["IncreaseExpAmount", 200],
    ]);
    expect(projection.pets.map((pet) => pet.effects.length)).toEqual([
      2, 1, 1, 1, 1, 1, 1, 3,
    ]);
  });

  test("captures every emitted pet_stats field once before projection", () => {
    const forged = withPoisonedPetStatSecondReads(indexes);
    const projection = projectPetEffects({
      indexes: forged.indexes,
      state: EMPTY,
    });
    const flattened = projection.pets.flatMap((pet) => pet.effects);

    expect(
      flattened.map((effect) => [
        effect.petStatKey,
        effect.statType,
        effect.modType,
        effect.value,
      ]),
    ).toEqual(PET_STAT_SOURCE_ROWS.map((row) => [...row]));
    expect(
      flattened.map((effect) => [
        effect.provenance.rowIndex,
        effect.provenance.groupIndex,
        effect.provenance.statDataKey,
      ]),
    ).toEqual([
      [0, 0, 1001],
      [1, 1, 1001],
      [2, 0, 1002],
      [3, 0, 1003],
      [4, 0, 1004],
      [5, 0, 1005],
      [6, 0, 6001],
      [7, 0, 6002],
      [8, 0, 6003],
      [9, 1, 6003],
      [10, 2, 6003],
    ]);
    expect(forged.reads.size).toBe(44);
    for (let rowIndex = 0; rowIndex < 11; rowIndex += 1) {
      for (const field of PET_STAT_FIELDS) {
        expect(forged.reads.get(`${rowIndex}.${field}`)).toBe(1);
      }
    }
    expect(JSON.stringify(projection)).not.toMatch(
      /SmuggledStat|ADDITIVE|999999/,
    );
  });

  test("discriminates the 5 KillMonster pets with exactly resolved monster refs", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });
    const killers = projection.pets.filter(
      (pet) => pet.unlock.kind === "kill-monster",
    );

    expect(killers).toHaveLength(5);
    expect(
      killers.map((pet) => [
        pet.petKey,
        pet.unlock.kind === "kill-monster"
          ? pet.unlock.monsterReference.monsterKey
          : null,
      ]),
    ).toEqual(
      KILL_MONSTER_PETS.map(([petKey, monsterKey]) => [petKey, monsterKey]),
    );
    for (const pet of killers) {
      if (pet.unlock.kind !== "kill-monster") throw new Error("unreachable");
      expect(pet.unlock.monsterReference.kind).toBe("resolved");
      expect(
        indexes.tables.monsters.groups.has(
          pet.unlock.monsterReference.monsterKey,
        ),
      ).toBe(true);
      // Param1 is the raw source reference; Param2 is raw source only.
      expect(pet.unlock.rawParam1).toBe(pet.unlock.monsterReference.monsterKey);
      expect(pet.unlock.rawParam2).toBe(5000);
    }
  });

  test("rejects a monsters.groups accessor before it can bypass an unknown monster", () => {
    const unknownMonster = withRows(indexes, "pets", (rows) => {
      rows[0]!.Param1 = 999_999;
    });
    const canonicalGroups = unknownMonster.tables.monsters.groups;
    const permissiveGroups = {
      has() {
        return true;
      },
    };
    let groupsReads = 0;
    const monsterTable = { ...unknownMonster.tables.monsters };
    Object.defineProperty(monsterTable, "groups", {
      enumerable: true,
      configurable: true,
      get() {
        groupsReads += 1;
        return groupsReads === 1 ? canonicalGroups : permissiveGroups;
      },
    });
    const forged = {
      ...unknownMonster,
      tables: {
        ...unknownMonster.tables,
        monsters: monsterTable,
      },
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectPetEffects({ indexes: forged, state: EMPTY })).toThrow(
      "pet-effect input indexes.tables.monsters.groups must be an own data property",
    );
    expect(groupsReads).toBe(0);
  });

  test("discriminates the 3 DLC pets with the exact pack Param1 and null Param2", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });
    const dlc = projection.pets.filter((pet) => pet.unlock.kind === "dlc");

    expect(dlc.map((pet) => pet.petKey)).toEqual([...DLC_PETS]);
    for (const pet of dlc) {
      if (pet.unlock.kind !== "dlc") throw new Error("unreachable");
      expect(pet.unlock.rawParam1).toBe(DLC_PACK_PARAM1);
      expect(pet.unlock.rawParam2).toBeNull();
      expect(Object.hasOwn(pet.unlock, "monsterReference")).toBe(false);
      expect(Object.hasOwn(pet.unlock, "owned")).toBe(false);
    }
    // Param2 null-vs-5000 is a raw source distinction, never a derived one.
    expect(
      projection.pets.map((pet) => [pet.petKey, pet.unlock.rawParam2]),
    ).toEqual([
      [1001, 5000],
      [1002, 5000],
      [1003, 5000],
      [1004, 5000],
      [1005, 5000],
      [6001, null],
      [6002, null],
      [6003, null],
    ]);
  });

  test("never infers gameplay arithmetic, units, RNG, timing, stacking or caps", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });
    const forbidden = [
      "applied",
      "normalized",
      "total",
      "totals",
      "percent",
      "multiplier",
      "gold",
      "exp",
      "dropChance",
      "killCount",
      "killsRemaining",
      "progress",
      "unlockedAt",
      "unlockTime",
      "purchased",
      "rng",
      "random",
      "stacking",
      "cap",
      "caps",
    ];
    const collect = (value: unknown, into: Set<string>): void => {
      if (typeof value !== "object" || value === null) return;
      for (const [key, child] of Object.entries(value)) {
        into.add(key);
        collect(child, into);
      }
    };
    const keys = new Set<string>();
    collect(projection, keys);
    expect(forbidden.filter((key) => keys.has(key))).toEqual([]);

    // `owned`/`arranged` are the caller's own state echoed back, so they are
    // legitimate at the root. What must never appear is an inferred
    // entitlement or progress claim inside the unlock discriminant.
    const unlockKeys = new Set<string>();
    for (const pet of projection.pets) collect(pet.unlock, unlockKeys);
    expect(
      [
        "owned",
        "purchased",
        "entitled",
        "unlocked",
        "available",
        "progress",
        "killCount",
        "killsRemaining",
        "remaining",
      ].filter((key) => unlockKeys.has(key)),
    ).toEqual([]);
    expect([...unlockKeys].sort()).toEqual([
      "kind",
      "monsterKey",
      "monsterReference",
      "rawParam1",
      "rawParam2",
    ]);
    // every projected value stays raw-source-only
    for (const effect of projection.pets.flatMap((pet) => pet.effects)) {
      expect(Object.keys(effect).sort()).toEqual([
        "modType",
        "petStatKey",
        "provenance",
        "statType",
        "unit",
        "value",
      ]);
    }
  });

  test("reports ownership and arrangement without mutating or applying state", () => {
    const state = { unlocked: [1002, 6003, 1001], active: 6003 };
    const frozenCopy = JSON.stringify(state);
    const projection = projectPetEffects({ indexes, state });

    expect(JSON.stringify(state)).toBe(frozenCopy);
    expect(projection.owned).toEqual([1002, 6003, 1001]);
    expect(projection.arranged).toBe(6003);
    const ownership = new Map(
      projection.pets.map((pet) => [pet.petKey, pet.ownership]),
    );
    expect(ownership.get(1001)).toEqual({ kind: "owned", arranged: false });
    expect(ownership.get(1002)).toEqual({ kind: "owned", arranged: false });
    expect(ownership.get(6003)).toEqual({ kind: "owned", arranged: true });
    expect(ownership.get(1003)).toEqual({ kind: "not-owned" });
    expect(ownership.get(6001)).toEqual({ kind: "not-owned" });
    // effects are still projected for unowned pets: this is catalog truth,
    // not an applied reward.
    expect(
      projection.pets.find((pet) => pet.petKey === 1003)!.effects,
    ).toHaveLength(1);
  });

  test("accepts an empty and a fully-owned arrangement", () => {
    expect(projectPetEffects({ indexes, state: EMPTY }).arranged).toBeNull();
    const all = [1001, 1002, 1003, 1004, 1005, 6001, 6002, 6003];
    const full = projectPetEffects({
      indexes,
      state: { unlocked: all, active: 1005 },
    });
    expect(full.owned).toEqual(all);
    expect(full.pets.every((pet) => pet.ownership.kind === "owned")).toBe(true);
    expect(
      full.pets.filter(
        (pet) => pet.ownership.kind === "owned" && pet.ownership.arranged,
      ),
    ).toHaveLength(1);
  });

  test("rejects duplicate, unknown or unsafe ownership state before any output", () => {
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [1001, 1001], active: null },
      }),
    ).toThrow("pet state unlocked must not contain duplicate pet keys");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [9999], active: null },
      }),
    ).toThrow("pet state unlocked[0] references unknown pet 9999");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [1001.5], active: null },
      }),
    ).toThrow("pet state unlocked[0] must be a positive safe integer");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [], active: 1001 },
      }),
    ).toThrow("pet state active pet 1001 is not unlocked");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [1001], active: 9999 },
      }),
    ).toThrow("pet state active pet 9999 is not unlocked");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [1001], active: 0 },
      }),
    ).toThrow("pet state active must be a positive safe integer or null");
    expect(() =>
      projectPetEffects({
        indexes,
        state: {
          unlocked: [1001, 1002, 1003, 1004, 1005, 6001, 6002, 6003, 1001],
          active: null,
        },
      }),
    ).toThrow("pet state unlocked must not contain duplicate pet keys");
    expect(() =>
      projectPetEffects({
        indexes,
        state: { unlocked: [1001], active: null, extra: 1 },
      } as unknown as Parameters<typeof projectPetEffects>[0]),
    ).toThrow("pet state has unknown field extra");
  });

  test("rejects wrong primary keys, missing stat groups and missing monster rows", () => {
    const wrongPrimary = withRows(indexes, "pets", (rows) => {
      rows[0]!.PetKey = -1;
    });
    const duplicatePrimary = withRows(indexes, "pets", (rows) => {
      rows[1]!.PetKey = rows[0]!.PetKey;
    });
    const missingStatGroup = withRows(indexes, "pets", (rows) => {
      rows[0]!.StatDataKey = 999_999;
    });
    const missingMonster = withRows(indexes, "pets", (rows) => {
      rows[0]!.Param1 = 999_999;
    });
    const unknownCondition = withRows(indexes, "pets", (rows) => {
      rows[0]!.UnlockCondition = "Quest";
    });
    const droppedStatRow = withRows(indexes, "pet_stats", (rows) => {
      rows.pop();
    });
    const droppedPet = withRows(indexes, "pets", (rows) => {
      rows.pop();
    });
    const inventedField = withRows(indexes, "pets", (rows) => {
      rows[0]!.KillCounter = 7;
    });
    const dlcWithParam2 = withRows(indexes, "pets", (rows) => {
      rows[5]!.Param2 = 5000;
    });
    const killMonsterNullParam2 = withRows(indexes, "pets", (rows) => {
      rows[0]!.Param2 = null;
    });

    expect(() =>
      projectPetEffects({ indexes: wrongPrimary, state: EMPTY }),
    ).toThrow("pets.PetKey must be a positive safe integer");
    expect(() =>
      projectPetEffects({ indexes: duplicatePrimary, state: EMPTY }),
    ).toThrow("pets.PetKey must be unique");
    expect(() =>
      projectPetEffects({ indexes: missingStatGroup, state: EMPTY }),
    ).toThrow("pets.StatDataKey references unknown pet_stats group 999999");
    expect(() =>
      projectPetEffects({ indexes: missingMonster, state: EMPTY }),
    ).toThrow("pets.Param1 references unknown monster 999999");
    expect(() =>
      projectPetEffects({ indexes: unknownCondition, state: EMPTY }),
    ).toThrow('pets.UnlockCondition has unknown value "Quest"');
    expect(() =>
      projectPetEffects({ indexes: droppedStatRow, state: EMPTY }),
    ).toThrow("pet_stats must contain exactly 11 rows");
    expect(() =>
      projectPetEffects({ indexes: droppedPet, state: EMPTY }),
    ).toThrow("pets must contain exactly 8 rows");
    expect(() =>
      projectPetEffects({ indexes: inventedField, state: EMPTY }),
    ).toThrow("pets row has unknown field KillCounter");
    expect(() =>
      projectPetEffects({ indexes: dlcWithParam2, state: EMPTY }),
    ).toThrow("pets.Param2 must be null when UnlockCondition is DLC");
    expect(() =>
      projectPetEffects({ indexes: killMonsterNullParam2, state: EMPTY }),
    ).toThrow(
      "pets.Param2 must be a finite number when UnlockCondition is KillMonster",
    );
  });

  test("rejects an orphan pet_stats row without output or input mutation", () => {
    const state = { unlocked: [1001, 6003], active: 6003 };
    const orphan = withRows(indexes, "pet_stats", (rows) => {
      rows[10]!.PetStatKey = 999_999;
    });

    expectRejectedWithoutMutation(
      orphan,
      state,
      "pet_stats rows must be consumed exactly once by pets; consumed 10 of 11",
    );
  });

  test("rejects reuse of any pet_stats group without duplicating effects", () => {
    const state = { unlocked: [1002, 6003], active: 6003 };
    for (const [petRowIndex, reusedStatDataKey] of [
      [1, 1001],
      [4, 1003],
      [7, 6002],
    ] as const) {
      const shared = withRows(indexes, "pets", (rows) => {
        rows[petRowIndex]!.StatDataKey = reusedStatDataKey;
      });

      expectRejectedWithoutMutation(
        shared,
        state,
        `pets.StatDataKey group ${reusedStatDataKey} must be consumed by exactly one pet`,
      );
    }
  });

  test("accepts only the exact input surface and never reads state or RNG fields", () => {
    let rngReads = 0;
    let repositoryReads = 0;
    const input = {
      indexes,
      state: EMPTY,
      get rng() {
        rngReads += 1;
        return () => 0;
      },
      get repository() {
        repositoryReads += 1;
        return {};
      },
    };

    expect(() =>
      projectPetEffects(
        input as unknown as Parameters<typeof projectPetEffects>[0],
      ),
    ).toThrow("pet-effect input has unknown fields repository, rng");
    expect(rngReads).toBe(0);
    expect(repositoryReads).toBe(0);
  });

  test("rejects prototype, symbol and hidden fields while sampling accessors once", () => {
    const prototypeRow = withRows(indexes, "pets", (rows) => {
      rows[0] = Object.create(rows[0]!) as Record<string, unknown>;
    });
    expect(() =>
      projectPetEffects({ indexes: prototypeRow, state: EMPTY }),
    ).toThrow("pets row is missing own field");

    const symbolRow = withRows(indexes, "pets", (rows) => {
      (rows[0] as Record<symbol, unknown>)[Symbol("rng")] = () => 0;
    });
    expect(() =>
      projectPetEffects({ indexes: symbolRow, state: EMPTY }),
    ).toThrow("pets row has unknown field Symbol(rng)");

    const nonEnumerableRow = withRows(indexes, "pets", (rows) => {
      Object.defineProperty(rows[0]!, "KillCounter", {
        value: 7,
        enumerable: false,
      });
    });
    expect(() =>
      projectPetEffects({ indexes: nonEnumerableRow, state: EMPTY }),
    ).toThrow("pets row has unknown field KillCounter");

    // An accessor must never be read twice with divergent results: the
    // projection has to capture EVERY field exactly once, not just one of
    // them. A per-field read counter is what proves it.
    const reads: Record<string, number> = {};
    const honest: Record<string, unknown> = {
      PetKey: 1001,
      NameKey: "PetName_1001",
      DescriptionKey: "PetDescription_1001",
      StatDataKey: 1001,
      UnlockCondition: "KillMonster",
      Param1: 10031,
      Param2: 5000,
    };
    const accessorRow = withRows(indexes, "pets", (rows) => {
      const base: Record<string, unknown> = { ...rows[0]! };
      for (const field of Object.keys(honest)) {
        delete base[field];
        Object.defineProperty(base, field, {
          enumerable: true,
          configurable: true,
          get() {
            reads[field] = (reads[field] ?? 0) + 1;
            // first read is honest; any later read smuggles a poisoned value
            return reads[field] === 1
              ? honest[field]
              : ({ smuggled: field } as unknown);
          },
        });
      }
      rows[0] = base;
    });
    const smuggled = projectPetEffects({
      indexes: accessorRow,
      state: EMPTY,
    });
    expect(reads).toEqual({
      PetKey: 1,
      NameKey: 1,
      DescriptionKey: 1,
      StatDataKey: 1,
      UnlockCondition: 1,
      Param1: 1,
      Param2: 1,
    });
    const first = smuggled.pets[0]!;
    expect(first.petKey).toBe(1001);
    expect(first.nameKey).toBe("PetName_1001");
    expect(first.descriptionKey).toBe("PetDescription_1001");
    expect(first.statDataKey).toBe(1001);
    expect(first.unlock.kind).toBe("kill-monster");
    expect(first.unlock.rawParam1).toBe(10031);
    expect(first.unlock.rawParam2).toBe(5000);
    expect(JSON.stringify(smuggled)).not.toContain("smuggled");
  });

  test("enforces the exact 5 KillMonster / 3 DLC split", () => {
    // Flip pet 1001 from KillMonster to DLC (Param2 must go null with it, or
    // the earlier discriminant guard fires first). The split becomes 4/4 and
    // the corpus guard must reject it.
    const flippedToDlc = withRows(indexes, "pets", (rows) => {
      rows[0]!.UnlockCondition = "DLC";
      rows[0]!.Param2 = null;
    });
    expect(() =>
      projectPetEffects({ indexes: flippedToDlc, state: EMPTY }),
    ).toThrow("pets must contain exactly 5 KillMonster pets");

    // Flip a DLC pet to KillMonster: split becomes 6/2.
    const flippedToKill = withRows(indexes, "pets", (rows) => {
      rows[5]!.UnlockCondition = "KillMonster";
      rows[5]!.Param2 = 5000;
      rows[5]!.Param1 = 10031;
    });
    expect(() =>
      projectPetEffects({ indexes: flippedToKill, state: EMPTY }),
    ).toThrow("pets must contain exactly 5 KillMonster pets");
  });

  test("returns a deeply frozen, fully detached projection", () => {
    const state = { unlocked: [1001], active: 1001 };
    const projection = projectPetEffects({ indexes, state });

    expectDeeplyFrozen(projection);

    const sourceObjects = collectObjects(indexes.tables);
    const stateObjects = collectObjects(state);
    const shared: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value !== "object" || value === null) return;
      if (sourceObjects.has(value)) shared.push(`${path} (source)`);
      if (stateObjects.has(value)) shared.push(`${path} (state)`);
      for (const [key, child] of Object.entries(value)) {
        walk(child, `${path}.${key}`);
      }
    };
    walk(projection, "$");
    expect(shared).toEqual([]);

    expect(projection.pets[0]).not.toBe(indexes.tables.pets.rows[0]);
    expect(projection.owned).not.toBe(state.unlocked);
    expect(() => (projection.pets as unknown as unknown[]).push({})).toThrow(
      TypeError,
    );
    expect(() => (projection.owned as unknown as unknown[]).push(1)).toThrow(
      TypeError,
    );

    // mutating the caller's state afterwards must not reach the projection
    state.unlocked.push(1002);
    expect(projection.owned).toEqual([1001]);
  });

  test("is deterministic and side-effect free across repeated calls", () => {
    const a = projectPetEffects({ indexes, state: EMPTY });
    const b = projectPetEffects({ indexes, state: EMPTY });
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("DiscordHero pet_stats MODTYPE is pinned to the proven source value", () => {
  test("every one of the 11 canonical pet_stats rows is FLAT", () => {
    const rows = indexes.tables.pet_stats.rows;

    expect(rows).toHaveLength(11);
    expect(rows.map((row) => row.MODTYPE)).toEqual(
      Array.from({ length: 11 }, () => "FLAT"),
    );
    expect(new Set(rows.map((row) => row.MODTYPE))).toEqual(new Set(["FLAT"]));

    // and the projection carries that single proven value through verbatim
    const projection = projectPetEffects({ indexes, state: EMPTY });
    expect(
      projection.pets.flatMap((pet) => pet.effects).map((e) => e.modType),
    ).toEqual(Array.from({ length: 11 }, () => "FLAT"));
  });

  test("rejects a single pet_stats row forged to ADDITIVE or MULTIPLICATIVE", () => {
    // ADDITIVE and MULTIPLICATIVE are real MODTYPEs on the buffs table. The
    // pinned pet_stats corpus never proves either one, so accepting them here
    // would certify a pet stat semantic the source does not contain.
    for (const forged of ["ADDITIVE", "MULTIPLICATIVE"]) {
      for (const rowIndex of [0, 5, 10]) {
        const mutated = withRows(indexes, "pet_stats", (rows) => {
          rows[rowIndex]!.MODTYPE = forged;
        });
        expect(() =>
          projectPetEffects({ indexes: mutated, state: EMPTY }),
        ).toThrow(
          `pet_stats.MODTYPE has unknown value ${JSON.stringify(forged)}`,
        );
      }
    }
  });

  test("rejects a corpus with every pet_stats row forged", () => {
    for (const forged of ["ADDITIVE", "MULTIPLICATIVE"]) {
      const mutated = withRows(indexes, "pet_stats", (rows) => {
        for (const row of rows) row.MODTYPE = forged;
      });
      expect(() =>
        projectPetEffects({ indexes: mutated, state: EMPTY }),
      ).toThrow(
        `pet_stats.MODTYPE has unknown value ${JSON.stringify(forged)}`,
      );
    }
  });

  test("returns no partial output and mutates neither index nor state on rejection", () => {
    const state = { unlocked: [1001, 6003], active: 6003 };
    const mutated = withRows(indexes, "pet_stats", (rows) => {
      rows[3]!.MODTYPE = "MULTIPLICATIVE";
    });
    const indexSnapshot = JSON.stringify(mutated.tables.pet_stats.rows);
    const petsSnapshot = JSON.stringify(mutated.tables.pets.rows);
    const stateSnapshot = JSON.stringify(state);

    let returned: unknown = "SENTINEL";
    let caught: unknown = null;
    try {
      returned = projectPetEffects({ indexes: mutated, state });
    } catch (error) {
      caught = error;
    }

    // fails closed: a throw, never a half-built projection
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(TypeError);
    expect(returned).toBe("SENTINEL");
    // and the rejected call left every input byte-identical
    expect(JSON.stringify(mutated.tables.pet_stats.rows)).toBe(indexSnapshot);
    expect(JSON.stringify(mutated.tables.pets.rows)).toBe(petsSnapshot);
    expect(JSON.stringify(state)).toBe(stateSnapshot);
  });

  test("pinning FLAT does not license treating FLAT as a proven scale", () => {
    const projection = projectPetEffects({ indexes, state: EMPTY });
    const effects = projection.pets.flatMap((pet) => pet.effects);

    // FLAT names the source column value; it says nothing about whether 100
    // means 100%, 10.0% or 1.00x. The unit must stay UNPROVEN and the value
    // must stay the untouched source integer.
    expect(effects.map((effect) => effect.unit)).toEqual(
      Array.from({ length: 11 }, () => "UNPROVEN"),
    );
    expect(effects.map((effect) => effect.value)).toEqual([
      100, 150, 150, 100, 150, 150, 150, 100, 200, 150, 200,
    ]);
    for (const effect of effects) {
      expect(Object.keys(effect).sort()).toEqual([
        "modType",
        "petStatKey",
        "provenance",
        "statType",
        "unit",
        "value",
      ]);
    }
  });

  test("keeps the 8/11 corpus, split, params, provenance and freeze intact", () => {
    const state = { unlocked: [1002, 6003], active: 6003 };
    const projection = projectPetEffects({ indexes, state });

    expect(projection.counts).toEqual({
      pets: 8,
      petStatRows: 11,
      killMonsterPets: 5,
      dlcPets: 3,
    });
    expect(projection.pets.map((pet) => pet.petKey)).toEqual([
      1001, 1002, 1003, 1004, 1005, 6001, 6002, 6003,
    ]);
    expect(projection.pets.map((pet) => pet.effects.length)).toEqual([
      2, 1, 1, 1, 1, 1, 1, 3,
    ]);
    expect(projection.pets.map((pet) => pet.unlock.kind)).toEqual([
      "kill-monster",
      "kill-monster",
      "kill-monster",
      "kill-monster",
      "kill-monster",
      "dlc",
      "dlc",
      "dlc",
    ]);
    expect(projection.pets.map((pet) => pet.unlock.rawParam2)).toEqual([
      5000,
      5000,
      5000,
      5000,
      5000,
      null,
      null,
      null,
    ]);
    expect(
      projection.pets
        .flatMap((pet) => pet.effects)
        .map((effect) => effect.provenance.rowIndex),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ownership = new Map(
      projection.pets.map((pet) => [pet.petKey, pet.ownership]),
    );
    expect(ownership.get(6003)).toEqual({ kind: "owned", arranged: true });
    expect(ownership.get(1002)).toEqual({ kind: "owned", arranged: false });
    expect(ownership.get(1001)).toEqual({ kind: "not-owned" });
    expectDeeplyFrozen(projection);
    expect(projection.owned).not.toBe(state.unlocked);
  });
});
