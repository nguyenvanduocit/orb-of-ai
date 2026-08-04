import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { OracleRequiredError } from "./combat";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";
import * as heroesModule from "./heroes";
import {
  createHeroRoster,
  heroSkillKeys,
  materializeHeroUnlock,
  quoteHeroUnlock,
} from "./heroes";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

type ExpectedStatPreview = Readonly<{
  status: "owned" | "unowned";
  heroKey: number;
  label: "Base + allocated Attributes";
  units: "uncapped and unrounded raw source units";
  projectedStats:
    | readonly Readonly<{
        statType: string;
        baseRaw: number;
        flatAttributeRaw: number;
        additiveAttributeRaw: number;
        projectedRaw: number;
        provenance: readonly ["Base", "Attribute"];
      }>[]
    | null;
}>;

type ExpectedBaseCombatUnit = Readonly<{
  heroKey: number;
  classType: string;
  attackDamage: number;
  attackSpeedPerSecond: number;
  castSpeedMultiplier: number;
  criticalChanceRatio: number;
  criticalDamageMultiplier: number;
  baseAttackDps: number;
}>;

function statPreviewApi(): (
  catalog: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
) => ExpectedStatPreview {
  const candidate = heroesModule as unknown as Partial<{
    projectDiscordHeroStatPreview: (
      catalog: DiscordHeroCatalogIndexes,
      state: PlayerState,
      heroKey: number,
    ) => ExpectedStatPreview;
  }>;
  expect(typeof candidate.projectDiscordHeroStatPreview).toBe("function");
  return candidate.projectDiscordHeroStatPreview!;
}

function baseCombatApi(): Readonly<{
  project: (
    catalog: DiscordHeroCatalogIndexes,
  ) => readonly ExpectedBaseCombatUnit[];
  roundDpsForDisplay: (value: number) => number;
}> {
  const candidate = heroesModule as unknown as Partial<{
    projectDiscordHeroBaseCombatUnits: (
      catalog: DiscordHeroCatalogIndexes,
    ) => readonly ExpectedBaseCombatUnit[];
    roundDiscordHeroBaseAttackDpsForDisplay: (value: number) => number;
  }>;
  expect(typeof candidate.projectDiscordHeroBaseCombatUnits).toBe("function");
  expect(typeof candidate.roundDiscordHeroBaseAttackDpsForDisplay).toBe(
    "function",
  );
  return {
    project: candidate.projectDiscordHeroBaseCombatUnits!,
    roundDpsForDisplay: candidate.roundDiscordHeroBaseAttackDpsForDisplay!,
  };
}

function knightState(
  level: number,
  attributes: PlayerState["heroes"][number]["attributes"],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  state.heroes[0]!.level = level;
  state.heroes[0]!.attributes = attributes;
  return state;
}

function withPassiveValue(
  passiveSkillKey: number,
  value: number,
): DiscordHeroCatalogIndexes {
  const source = indexes.tables.passive_skills.rows.find(
    (row) => row.PassiveSkillKey === passiveSkillKey,
  )!;
  const patchedRow = { ...source, Value: value };
  const rows = indexes.tables.passive_skills.rows.map((row) =>
    row.PassiveSkillKey === passiveSkillKey ? patchedRow : row,
  );
  const groups = new Map(indexes.tables.passive_skills.groups);
  groups.set(passiveSkillKey, [patchedRow]);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      passive_skills: {
        ...indexes.tables.passive_skills,
        rows,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function withSkillLevelValue(
  skillLevelKey: number,
  level: number,
  value: number,
): DiscordHeroCatalogIndexes {
  const source = indexes.tables.skill_levels.rows.find(
    (row) => row.SkillLevelKey === skillLevelKey && row.Level === level,
  )!;
  const patchedRow = { ...source, Value: value };
  const rows = indexes.tables.skill_levels.rows.map((row) =>
    row.SkillLevelKey === skillLevelKey && row.Level === level
      ? patchedRow
      : row,
  );
  const groups = new Map(indexes.tables.skill_levels.groups);
  groups.set(
    skillLevelKey,
    groups
      .get(skillLevelKey)!
      .map((row) => (row.Level === level ? patchedRow : row)),
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      skill_levels: {
        ...indexes.tables.skill_levels,
        rows,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

type HeroCombatRawField =
  | "AttackDamage"
  | "AttackSpeed"
  | "CastSpeed"
  | "CriticalChance"
  | "CriticalDamage";

function withHeroRawValues(
  heroKey: number,
  values: Partial<Record<HeroCombatRawField, number>>,
): DiscordHeroCatalogIndexes {
  const source = indexes.tables.heroes.rows.find(
    (row) => row.HeroKey === heroKey,
  )!;
  const patchedRow = { ...source, ...values };
  const rows = indexes.tables.heroes.rows.map((row) =>
    row.HeroKey === heroKey ? patchedRow : row,
  );
  const groups = new Map(indexes.tables.heroes.groups);
  groups.set(heroKey, [patchedRow]);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      heroes: {
        ...indexes.tables.heroes,
        rows,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function withHeroRowOrder(
  heroKeys: readonly number[],
): DiscordHeroCatalogIndexes {
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      heroes: {
        ...indexes.tables.heroes,
        rows: heroKeys.map((heroKey) =>
          indexes.tables.heroes.rows.find((row) => row.HeroKey === heroKey)!,
        ),
      },
    },
  } as DiscordHeroCatalogIndexes;
}

describe("DiscordHero source hero roster", () => {
  test("preserves all six source heroes and exact starter/base-stat data", () => {
    const roster = createHeroRoster(indexes);

    expect(roster.map((hero) => hero.heroKey)).toEqual([
      101, 201, 301, 401, 501, 601,
    ]);
    expect(
      roster
        .filter((hero) => hero.isFirstAvailable)
        .map((hero) => hero.heroKey),
    ).toEqual([101, 201, 301]);
    expect(roster[0]).toMatchObject({
      heroKey: 101,
      classType: "Knight",
      baseSkillKey: 10001,
      mainWeaponGearType: "SWORD",
      subWeaponGearType: "SHIELD",
      unlockCost: 500,
      stats: {
        attackDamage: 2,
        attackSpeed: 90,
        castSpeed: 100,
        criticalChance: 25,
        criticalDamage: 1400,
        maxHp: 130,
        armor: 45,
        cooldownReduction: 0,
        movementSpeed: 950,
      },
    });
    expect(roster[5]).toMatchObject({
      heroKey: 601,
      classType: "Slayer",
      baseSkillKey: 60001,
      mainWeaponGearType: "AXE",
      subWeaponGearType: "HATCHET",
    });
  });

  test("links each hero to its exact base skill and six canonical active skills", () => {
    const roster = createHeroRoster(indexes);
    const allActive = new Set<number>();

    for (const hero of roster) {
      const skills = heroSkillKeys(indexes, { heroKey: hero.heroKey });
      expect(skills.baseSkillKey).toBe(hero.baseSkillKey);
      expect(skills.activeSkillKeys).toHaveLength(6);
      for (const skillKey of skills.activeSkillKeys) allActive.add(skillKey);
    }

    expect(allActive.size).toBe(36);
    expect(heroSkillKeys(indexes, { heroKey: 101 })).toEqual({
      baseSkillKey: 10001,
      activeSkillKeys: [10101, 10201, 10301, 10401, 10501, 10601],
    });
  });

  test("quotes canonical unlock eligibility without mutating caller data", () => {
    const owned = Object.freeze([101, 201, 301]);

    expect(
      quoteHeroUnlock(indexes, {
        heroKey: 101,
        gold: 100,
        ownedHeroKeys: owned,
      }),
    ).toEqual({ status: "owned", heroKey: 101, cost: 0 });
    expect(
      quoteHeroUnlock(indexes, {
        heroKey: 401,
        gold: 499,
        ownedHeroKeys: owned,
      }),
    ).toEqual({ status: "insufficient-gold", heroKey: 401, cost: 500 });
    expect(
      quoteHeroUnlock(indexes, {
        heroKey: 401,
        gold: 500,
        ownedHeroKeys: owned,
      }),
    ).toEqual({ status: "purchasable", heroKey: 401, cost: 500 });
    expect(owned).toEqual([101, 201, 301]);
  });

  test("fails closed before constructing the unresolved post-unlock hero state", () => {
    const state = Object.freeze({
      gold: 500,
      ownedHeroKeys: Object.freeze([101, 201, 301]),
    });
    const before = structuredClone(state);

    expect(() => materializeHeroUnlock(indexes, state, 401)).toThrow(
      OracleRequiredError,
    );
    expect(() => materializeHeroUnlock(indexes, state, 401)).toThrow(
      "new-hero state initialization requires a runtime oracle",
    );
    expect(state).toEqual(before);
  });

  test("rejects source-valid hero stat and unlock-cost tampering", () => {
    const forgedCost = {
      heroKey: 401,
      gold: 0,
      ownedHeroKeys: [101, 201, 301],
      UnlockCost: 0,
    };
    const forgedStats = {
      heroKey: 401,
      gold: 500,
      ownedHeroKeys: [101, 201, 301],
      AttackDamage: 999_999,
    };

    expect(() => quoteHeroUnlock(indexes, forgedCost)).toThrow(
      "hero unlock input has unknown field UnlockCost",
    );
    expect(() => quoteHeroUnlock(indexes, forgedStats)).toThrow(
      "hero unlock input has unknown field AttackDamage",
    );
    expect(
      quoteHeroUnlock(indexes, {
        heroKey: 401,
        gold: 500,
        ownedHeroKeys: [101, 201, 301],
      }),
    ).toEqual({ status: "purchasable", heroKey: 401, cost: 500 });
  });

  test("rejects caller-supplied active skill overrides", () => {
    expect(() =>
      heroSkillKeys(indexes, {
        heroKey: 101,
        activeSkillKeys: [999_999],
      }),
    ).toThrow("hero skill input has unknown field activeSkillKeys");
  });

  test("returns fresh deeply frozen projections instead of catalog aliases", () => {
    const roster = createHeroRoster(indexes);
    const sourceHero = indexes.tables.heroes.rows[0]!;
    const skills = heroSkillKeys(indexes, { heroKey: 101 });

    expect(roster[0]).not.toBe(sourceHero);
    expect(Object.isFrozen(roster)).toBe(true);
    expect(Object.isFrozen(roster[0])).toBe(true);
    expect(Object.isFrozen(roster[0]!.stats)).toBe(true);
    expect(Object.isFrozen(skills)).toBe(true);
    expect(Object.isFrozen(skills.activeSkillKeys)).toBe(true);
  });

  test("rejects reversed or swapped source Hero rows before any roster projection", () => {
    const reversed = withHeroRowOrder([601, 501, 401, 301, 201, 101]);
    const swapped = withHeroRowOrder([101, 301, 201, 401, 501, 601]);
    const outcome = (
      project: () => readonly Readonly<{ heroKey: number }>[],
    ): string | readonly number[] => {
      try {
        return project().map(({ heroKey }) => heroKey);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };

    expect([
      outcome(() => createHeroRoster(reversed)),
      outcome(() => baseCombatApi().project(reversed)),
      outcome(() => createHeroRoster(swapped)),
      outcome(() => baseCombatApi().project(swapped)),
    ]).toEqual([
      "hero roster must use canonical HeroKey order 101,201,301,401,501,601",
      "hero roster must use canonical HeroKey order 101,201,301,401,501,601",
      "hero roster must use canonical HeroKey order 101,201,301,401,501,601",
      "hero roster must use canonical HeroKey order 101,201,301,401,501,601",
    ]);
  });
});

describe("DiscordHero catalog-backed base combat units", () => {
  test("projects all six pinned Hero vectors into explicit units and exact base DPS", () => {
    const units = baseCombatApi().project(indexes);

    expect(units).toEqual([
      {
        heroKey: 101,
        classType: "Knight",
        attackDamage: 2,
        attackSpeedPerSecond: 0.9,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.025,
        criticalDamageMultiplier: 1.4,
        baseAttackDps: 1.818,
      },
      {
        heroKey: 201,
        classType: "Ranger",
        attackDamage: 1,
        attackSpeedPerSecond: 1,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.04,
        criticalDamageMultiplier: 1.5,
        baseAttackDps: 1.02,
      },
      {
        heroKey: 301,
        classType: "Sorcerer",
        attackDamage: 2,
        attackSpeedPerSecond: 0.55,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.05,
        criticalDamageMultiplier: 1.65,
        baseAttackDps: 1.13575,
      },
      {
        heroKey: 401,
        classType: "Priest",
        attackDamage: 1,
        attackSpeedPerSecond: 0.9,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.02,
        criticalDamageMultiplier: 1.4,
        baseAttackDps: 0.9072,
      },
      {
        heroKey: 501,
        classType: "Hunter",
        attackDamage: 2,
        attackSpeedPerSecond: 0.7,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.045,
        criticalDamageMultiplier: 1.55,
        baseAttackDps: 1.43465,
      },
      {
        heroKey: 601,
        classType: "Slayer",
        attackDamage: 2,
        attackSpeedPerSecond: 0.7,
        castSpeedMultiplier: 1,
        criticalChanceRatio: 0.025,
        criticalDamageMultiplier: 1.8,
        baseAttackDps: 1.428,
      },
    ]);
  });

  test("keeps exact DPS precision separate from two-decimal display rounding", () => {
    const api = baseCombatApi();
    const units = api.project(indexes);

    expect(units.map(({ baseAttackDps }) => baseAttackDps)).toEqual([
      1.818, 1.02, 1.13575, 0.9072, 1.43465, 1.428,
    ]);
    expect(
      units.map(({ baseAttackDps }) => api.roundDpsForDisplay(baseAttackDps)),
    ).toEqual([1.82, 1.02, 1.14, 0.91, 1.43, 1.43]);
  });

  test("returns fresh deeply frozen projections detached from catalog rows", () => {
    const api = baseCombatApi();
    const first = api.project(indexes);
    const second = api.project(indexes);

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0]).not.toBe(indexes.tables.heroes.rows[0]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.every((unit) => Object.isFrozen(unit))).toBe(true);
    expect(first).toEqual(second);
  });

  test("rejects malformed raw combat fields before returning a projection", () => {
    const project = baseCombatApi().project;
    const fields: readonly HeroCombatRawField[] = [
      "AttackDamage",
      "AttackSpeed",
      "CastSpeed",
      "CriticalChance",
      "CriticalDamage",
    ];
    const invalidValues = [
      0,
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ];

    for (const field of fields) {
      for (const value of invalidValues) {
        expect(() =>
          project(withHeroRawValues(601, { [field]: value })),
        ).toThrow();
      }
    }
  });

  test("rejects an unsafe derived base DPS before returning a projection", () => {
    expect(() =>
      baseCombatApi().project(
        withHeroRawValues(101, {
          AttackDamage: Number.MAX_SAFE_INTEGER,
          AttackSpeed: Number.MAX_SAFE_INTEGER,
        }),
      ),
    ).toThrow("Hero 101 base attack DPS must be finite and within safe range");
  });

  test("rejects malformed values passed to display rounding", () => {
    const roundDps = baseCombatApi().roundDpsForDisplay;

    for (const value of [
      -1,
      Number.MAX_SAFE_INTEGER + 1,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ]) {
      expect(() => roundDps(value)).toThrow(
        "base attack DPS display value must be finite, non-negative, and within safe range",
      );
    }
  });
});

describe("DiscordHero Base + allocated Attributes stat preview", () => {
  test("projects the exact naked Knight vector in fixed catalog order", () => {
    const project = statPreviewApi();
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const preview = project(indexes, state, 101);

    expect(preview).toMatchObject({
      status: "owned",
      heroKey: 101,
      label: "Base + allocated Attributes",
      units: "uncapped and unrounded raw source units",
    });
    expect(
      preview.projectedStats?.map(({ statType, projectedRaw }) => [
        statType,
        projectedRaw,
      ]),
    ).toEqual([
      ["Armor", 45],
      ["AttackDamage", 2],
      ["AttackSpeed", 90],
      ["CastSpeed", 100],
      ["CooldownReduction", 0],
      ["CriticalChance", 25],
      ["CriticalDamage", 1400],
      ["MaxHp", 130],
      ["MovementSpeed", 950],
    ]);
    expect(preview.projectedStats).not.toBeNull();
    expect(preview.projectedStats).toEqual(
      preview.projectedStats!.map((row) => ({
        ...row,
        flatAttributeRaw: 0,
        additiveAttributeRaw: 0,
        projectedRaw: row.baseRaw,
        provenance: ["Base", "Attribute"],
      })),
    );
  });

  test("applies only allocated passive base-stat rows with exact raw arithmetic", () => {
    const project = statPreviewApi();
    const flat = project(
      indexes,
      knightState(2, [{ key: 101001, level: 2 }]),
      101,
    );
    expect(
      flat.projectedStats?.find(({ statType }) => statType === "AttackDamage"),
    ).toEqual({
      statType: "AttackDamage",
      baseRaw: 2,
      flatAttributeRaw: 2,
      additiveAttributeRaw: 0,
      projectedRaw: 4,
      provenance: ["Base", "Attribute"],
    });

    const mixed = project(
      indexes,
      knightState(33, [
        { key: 101001, level: 3 },
        { key: 101002, level: 8 },
        { key: 101003, level: 5 },
        { key: 101004, level: 5 },
        { key: 101011, level: 8 },
        { key: 101012, level: 1 },
        { key: 101032, level: 3 },
      ]),
      101,
    );
    expect(
      mixed.projectedStats?.find(({ statType }) => statType === "MaxHp"),
    ).toEqual({
      statType: "MaxHp",
      baseRaw: 130,
      flatAttributeRaw: 120,
      additiveAttributeRaw: 150,
      projectedRaw: 287.5,
      provenance: ["Base", "Attribute"],
    });
    expect(mixed.projectedStats).toHaveLength(9);
    expect(
      mixed.projectedStats?.some(
        ({ statType }) =>
          statType === "BlockChance" || statType === "AddHpPerKill",
      ),
    ).toBe(false);
  });

  test("returns an explicit null preview for an unowned source Hero", () => {
    const preview = statPreviewApi()(
      indexes,
      createFreshPlayerStateFromCatalog(indexes, 101),
      401,
    );

    expect(preview).toEqual({
      status: "unowned",
      heroKey: 401,
      label: "Base + allocated Attributes",
      units: "uncapped and unrounded raw source units",
      projectedStats: null,
    });
    expect(Object.isFrozen(preview)).toBe(true);
  });

  test("validates every owned Hero and Attribute allocation before output", () => {
    const project = statPreviewApi();
    const duplicate = createFreshPlayerStateFromCatalog(indexes, 101);
    duplicate.heroes.push(structuredClone(duplicate.heroes[1]!));
    expect(() => project(indexes, duplicate, 401)).toThrow(
      "Player state repeats owned Hero 201",
    );

    const unknown = createFreshPlayerStateFromCatalog(indexes, 101);
    unknown.heroes.push({
      ...structuredClone(unknown.heroes[0]!),
      heroKey: 999_999,
    });
    expect(() => project(indexes, unknown, 101)).toThrow(
      "heroes[3].heroKey references unknown heroes key 999999",
    );

    const invalidGate = knightState(1, [{ key: 101032, level: 1 }]);
    expect(() => project(indexes, invalidGate, 401)).toThrow(
      "requires 30 points spent in lower Attribute groups",
    );

    const invalidUnallocatedOwner = createFreshPlayerStateFromCatalog(
      indexes,
      101,
    );
    invalidUnallocatedOwner.heroes[1]!.level = 0;
    expect(() => project(indexes, invalidUnallocatedOwner, 101)).toThrow(
      "Hero 201 level must be a positive safe integer",
    );
  });

  test("rejects a malformed allocated active source value before returning rows", () => {
    const state = knightState(2, [{ key: 101003, level: 2 }]);

    expect(() =>
      statPreviewApi()(
        withSkillLevelValue(10101, 2, Number.POSITIVE_INFINITY),
        state,
        101,
      ),
    ).toThrow(
      "Hero 101 Attribute 101003 active source Value must be finite, non-negative, and within safe range",
    );
  });

  test("rejects a malformed allocated passive on another owned Hero before selected output", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[1]!.attributes = [{ key: 201001, level: 1 }];

    expect(() =>
      statPreviewApi()(withPassiveValue(201001, -1), state, 101),
    ).toThrow(
      "Hero 201 Attribute AttackDamage raw total must be a non-negative safe integer",
    );
  });

  test("validates a positive all-owner vector without forbidden reads or Hero-level scaling", () => {
    const project = statPreviewApi();
    const levelTwo = createFreshPlayerStateFromCatalog(indexes, 101);
    const levelHundred = createFreshPlayerStateFromCatalog(indexes, 101);
    for (const state of [levelTwo, levelHundred]) {
      state.heroes[0]!.level = 2;
      state.heroes[0]!.attributes = [{ key: 101001, level: 2 }];
      state.heroes[1]!.attributes = [{ key: 201001, level: 1 }];
      state.heroes[2]!.attributes = [{ key: 301003, level: 1 }];
    }
    levelHundred.heroes[0]!.level = 100;
    const before = structuredClone(levelHundred);

    for (const hero of levelHundred.heroes) {
      for (const field of [
        "skills",
        "passives",
        "equipment",
        "skins",
      ] as const) {
        Object.defineProperty(hero, field, {
          configurable: true,
          get(): never {
            throw new Error(`stat preview read hero.${field}`);
          },
        });
      }
    }
    for (const field of [
      "runes",
      "pets",
      "skins",
      "campaign",
      "stageSession",
      "buffs",
    ] as const) {
      Object.defineProperty(levelHundred, field, {
        configurable: true,
        get(): never {
          throw new Error(`stat preview read state.${field}`);
        },
      });
    }

    const first = project(indexes, levelTwo, 101);
    const second = project(indexes, levelHundred, 101);

    expect(
      first.projectedStats?.map(({ statType, projectedRaw }) => [
        statType,
        projectedRaw,
      ]),
    ).toEqual([
      ["Armor", 45],
      ["AttackDamage", 4],
      ["AttackSpeed", 90],
      ["CastSpeed", 100],
      ["CooldownReduction", 0],
      ["CriticalChance", 25],
      ["CriticalDamage", 1400],
      ["MaxHp", 130],
      ["MovementSpeed", 950],
    ]);
    expect(second.projectedStats).toEqual(first.projectedStats);
    expect(second).not.toBe(first);
    expect(second.projectedStats).not.toBe(first.projectedStats);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.projectedStats)).toBe(true);
    expect(Object.isFrozen(second.projectedStats?.[0])).toBe(true);
    expect(Object.isFrozen(second.projectedStats?.[0]?.provenance)).toBe(true);
    expect(before.heroes[0]!.level).toBe(100);
  });

  test("rejects negative, non-finite, and unsafe Attribute raw arithmetic", () => {
    const project = statPreviewApi();
    const state = knightState(2, [{ key: 101001, level: 2 }]);

    for (const value of [
      -1,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(() =>
        project(withPassiveValue(101001, value), state, 101),
      ).toThrow("Attribute AttackDamage raw total");
    }
  });

  test("validates an allocated no-base Attribute raw total before omitting it", () => {
    const project = statPreviewApi();
    const state = knightState(11, [
      { key: 101001, level: 3 },
      { key: 101002, level: 7 },
      { key: 101012, level: 1 },
    ]);

    expect(() => project(withPassiveValue(101012, -1), state, 101)).toThrow(
      "Attribute HpRegenPerSec raw total",
    );
  });
});

/**
 * Every hero row field that createHeroRoster reads and emits. A source row is
 * an inert JSON record, so each of these must be sampled exactly once: a second
 * read is a time-of-check/time-of-use window an accessor-backed row can drive.
 */
const EMITTED_HERO_ROW_FIELDS = [
  "HeroKey",
  "ClassType",
  "MainWeaponGearType",
  "SubWeaponGearType",
  "SkillKey",
  "UnlockCost",
  "IsAvailable",
  "IsFirstAvailable",
  "AttackDamage",
  "AttackSpeed",
  "CastSpeed",
  "CriticalChance",
  "CriticalDamage",
  "MaxHp",
  "Armor",
  "CooldownReduction",
  "MovementSpeed",
] as const;

/** Replaces one hero row wholesale, keeping rows and groups consistent. */
function withHeroRow(
  heroKey: number,
  build: (source: Record<string, unknown>) => Record<string, unknown>,
): DiscordHeroCatalogIndexes {
  const source = indexes.tables.heroes.rows.find(
    (row) => row.HeroKey === heroKey,
  )!;
  const patched = build({ ...source } as Record<string, unknown>);
  const rows = indexes.tables.heroes.rows.map((row) =>
    row.HeroKey === heroKey ? patched : row,
  );
  const groups = new Map(indexes.tables.heroes.groups);
  groups.set(heroKey, [patched] as never);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      heroes: { ...indexes.tables.heroes, rows, groups },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

/** Installs a counting getter on each named field of one hero row. */
function withCountedHeroRow(
  heroKey: number,
  fields: readonly string[],
  valueFor: (field: string, readIndex: number, original: unknown) => unknown,
): Readonly<{
  catalog: DiscordHeroCatalogIndexes;
  reads: Record<string, number>;
}> {
  const reads: Record<string, number> = {};
  const catalog = withHeroRow(heroKey, (row) => {
    const shell: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!fields.includes(key)) {
        shell[key] = value;
        continue;
      }
      reads[key] = 0;
      Object.defineProperty(shell, key, {
        enumerable: true,
        configurable: true,
        get() {
          reads[key] = (reads[key] ?? 0) + 1;
          return valueFor(key, reads[key]!, value);
        },
      });
    }
    return shell;
  });
  return { catalog, reads };
}

describe("DiscordHero base combat units resist accessor-backed source rows", () => {
  test("samples every emitted hero row field exactly once", () => {
    const { catalog, reads } = withCountedHeroRow(
      101,
      EMITTED_HERO_ROW_FIELDS,
      (_field, _readIndex, original) => original,
    );

    const units = baseCombatApi().project(catalog);

    expect(units[0]!.heroKey).toBe(101);
    // A source row is inert data; sampling it twice is the whole vulnerability.
    expect(reads).toEqual(
      Object.fromEntries(EMITTED_HERO_ROW_FIELDS.map((field) => [field, 1])),
    );
  });

  test("cannot be handed a forged HeroKey that changes between reads", () => {
    // Canonical 101 for the order/validation reads, forged 999999 afterwards.
    const { catalog } = withCountedHeroRow(
      101,
      ["HeroKey"],
      (_field, readIndex) => (readIndex === 1 ? 101 : 999_999),
    );

    const outcome = ((): string | readonly number[] => {
      try {
        return baseCombatApi()
          .project(catalog)
          .map((unit) => unit.heroKey);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    })();

    // Either it fails closed, or it emits the canonical key it validated -
    // never the forged one.
    if (Array.isArray(outcome)) {
      expect(outcome).toEqual([101, 201, 301, 401, 501, 601]);
    }
    expect(JSON.stringify(outcome)).not.toContain("999999");
  });

  test("rejects a non-string ClassType that fakes a string length", () => {
    // { length: 1 } satisfies a bare `.length === 0` emptiness probe while
    // being an object, so it must be rejected on its type, not its length.
    const faked = withHeroRow(101, (row) => ({
      ...row,
      ClassType: { length: 1 },
    }));

    expect(() => baseCombatApi().project(faked)).toThrow(
      "hero 101 class type must be a non-empty string",
    );
    expect(() => createHeroRoster(faked)).toThrow(
      "hero 101 class type must be a non-empty string",
    );
  });

  test("never aliases a source object into the projected output", () => {
    const smuggled: Record<string, unknown> = { length: 1, tampered: false };
    const aliased = withHeroRow(101, (row) => ({
      ...row,
      ClassType: smuggled,
    }));

    let projected: readonly ExpectedBaseCombatUnit[] | null = null;
    try {
      projected = baseCombatApi().project(aliased);
    } catch {
      projected = null;
    }
    if (projected !== null) {
      smuggled.tampered = true;
      expect(projected[0]!.classType).not.toBe(smuggled);
      expect(JSON.stringify(projected)).not.toContain("tampered");
    }
  });

  test("rejects object, numeric, empty and non-finite source fields deterministically", () => {
    const cases: readonly (readonly [
      Record<string, unknown>,
      string | RegExp,
    ])[] = [
      [{ ClassType: {} }, "hero 101 class type must be a non-empty string"],
      [{ ClassType: 123 }, "hero 101 class type must be a non-empty string"],
      [{ ClassType: "" }, "hero 101 class type must be a non-empty string"],
      [{ ClassType: null }, "hero 101 class type must be a non-empty string"],
      [
        { MainWeaponGearType: { length: 3 } },
        "hero 101 main weapon gear type must be a non-empty string",
      ],
      [
        { SubWeaponGearType: 7 },
        "hero 101 sub weapon gear type must be a non-empty string",
      ],
      [{ HeroKey: "101" }, "hero key must be a positive safe integer"],
      [{ HeroKey: null }, "hero key must be a positive safe integer"],
      [{ IsAvailable: "true" }, "hero 101 availability flags must be boolean"],
      [{ IsFirstAvailable: 1 }, "hero 101 availability flags must be boolean"],
      [{ AttackDamage: "2" }, /attackDamage|AttackDamage/],
      [{ AttackSpeed: Number.NaN }, /attackSpeed|AttackSpeed/],
      [{ MaxHp: Number.POSITIVE_INFINITY }, /maxHp|MaxHp/],
      [{ Armor: Number.MAX_SAFE_INTEGER + 1 }, /armor|Armor/],
      [{ MovementSpeed: null }, /movementSpeed|MovementSpeed/],
      [{ UnlockCost: {} }, /unlock cost/],
      [{ SkillKey: "10001" }, /base skill key/],
    ];

    for (const [patch, expected] of cases) {
      const catalog = withHeroRow(101, (row) => ({ ...row, ...patch }));
      let caught: unknown = null;
      try {
        baseCombatApi().project(catalog);
      } catch (error) {
        caught = error;
      }
      const label = JSON.stringify(Object.keys(patch)[0]);
      // Deterministic error TYPE: a plain Error, never a TypeError raised by
      // dereferencing a non-object.
      expect(`${label}:${caught instanceof Error}`).toBe(`${label}:true`);
      expect(`${label}:${caught instanceof TypeError}`).toBe(`${label}:false`);
      expect((caught as Error).message).toMatch(expected as never);
    }
  });

  test("keeps the six pinned vectors byte-identical after hardening", () => {
    const units = baseCombatApi().project(indexes);
    expect(
      units.map((unit) => [
        unit.heroKey,
        unit.classType,
        unit.attackDamage,
        unit.attackSpeedPerSecond,
        unit.castSpeedMultiplier,
        unit.criticalChanceRatio,
        unit.criticalDamageMultiplier,
        unit.baseAttackDps,
      ]),
    ).toEqual([
      [101, "Knight", 2, 0.9, 1, 0.025, 1.4, 1.818],
      [201, "Ranger", 1, 1, 1, 0.04, 1.5, 1.02],
      [301, "Sorcerer", 2, 0.55, 1, 0.05, 1.65, 1.13575],
      [401, "Priest", 1, 0.9, 1, 0.02, 1.4, 0.9072],
      [501, "Hunter", 2, 0.7, 1, 0.045, 1.55, 1.43465],
      [601, "Slayer", 2, 0.7, 1, 0.025, 1.8, 1.428],
    ]);
    expect(
      units.map((unit) =>
        baseCombatApi().roundDpsForDisplay(unit.baseAttackDps),
      ),
    ).toEqual([1.82, 1.02, 1.14, 0.91, 1.43, 1.43]);
  });

  test("quotes an unlock from one reading of cost and key, not several", () => {
    // Cost validates as the canonical 500, then reports 0 to the affordability
    // comparison and 999999 to the emitted quote. One snapshot closes this.
    const { catalog, reads } = withCountedHeroRow(
      601,
      ["UnlockCost", "HeroKey"],
      (field, readIndex, original) => {
        if (field === "HeroKey") return readIndex === 1 ? 601 : 999_999;
        return readIndex === 1 ? original : readIndex === 2 ? 0 : 999_999;
      },
    );

    const quote = quoteHeroUnlock(catalog, {
      heroKey: 601,
      gold: 100,
      ownedHeroKeys: [],
    });

    expect(reads.UnlockCost).toBe(1);
    expect(reads.HeroKey).toBe(1);
    expect(quote.heroKey).toBe(601);
    expect(quote.cost).toBe(500);
    // 100 gold against a 500 cost is insufficient; a re-read that saw 0 would
    // have wrongly reported the hero as purchasable.
    expect(quote.status).toBe("insufficient-gold");
    expect(JSON.stringify(quote)).not.toContain("999999");
  });

  test("validates the emitted base skill key from a single reading", () => {
    const forged = withHeroRow(101, (row) => ({ ...row, SkillKey: "10001" }));
    expect(() => heroSkillKeys(forged, { heroKey: 101 })).toThrow(Error);
    expect(() => heroSkillKeys(forged, { heroKey: 101 })).toThrow(
      /base skill key/,
    );
  });

  test("returns a deeply frozen projection with no reachable mutable node", () => {
    const units = baseCombatApi().project(indexes);
    const walk = (value: unknown, path: string): void => {
      if (typeof value !== "object" || value === null) return;
      expect(`${path}:${Object.isFrozen(value)}`).toBe(`${path}:true`);
      for (const key of Reflect.ownKeys(value)) {
        walk(
          (value as Record<string | symbol, unknown>)[key],
          `${path}.${String(key)}`,
        );
      }
    };
    walk(units, "$");
  });
});
