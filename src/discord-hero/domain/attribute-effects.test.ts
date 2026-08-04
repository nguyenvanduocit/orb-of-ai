import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "./invariants";
import type { PlayerState } from "./player";

const ATTRIBUTE_EFFECTS_MODULE = "./attribute-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function knightState(
  level: number,
  attributes: PlayerState["heroes"][number]["attributes"],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  state.heroes[0]!.level = level;
  state.heroes[0]!.attributes = attributes;
  return state;
}

describe("DiscordHero allocated Attribute effect projection", () => {
  test("projects a flat passive from Attribute allocation in raw source units", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.attributes = [{ key: 101001, level: 2 }];
    state.heroes[0]!.level = 2;

    expect(
      projectDiscordHeroAttributeEffect(
        indexes,
        validatePlayerAgainstCatalog(state, indexes),
        101,
        101001,
      ),
    ).toEqual({
      source: "Attribute",
      heroKey: 101,
      attributeKey: 101001,
      allocatedLevel: 2,
      maximumLevel: 3,
      effect: {
        kind: "passive-stat",
        passiveSkillKey: 101001,
        statType: "AttackDamage",
        modifierType: "FLAT",
        rawValue: 1,
        rawTotal: 2,
        additiveFactor: null,
      },
    });
  });

  test("partitions the source catalog into 36 active, 96 linked passive, and 12 unlinked passive records", () => {
    const active = indexes.tables.attributes.rows.filter(
      (attribute) => attribute.ATTRIBUTETYPE === "ACTIVESKILL",
    );
    const linkedPassive = indexes.tables.attributes.rows.filter(
      (attribute) => attribute.ATTRIBUTETYPE === "PASSIVESKILL",
    );
    const linkedPassiveKeys = new Set(
      linkedPassive.map((attribute) => attribute.Value),
    );
    const unlinkedPassiveKeys = indexes.tables.passive_skills.rows
      .filter((passive) => !linkedPassiveKeys.has(passive.PassiveSkillKey))
      .map((passive) => passive.PassiveSkillKey);

    expect(active).toHaveLength(36);
    expect(linkedPassive).toHaveLength(96);
    expect(unlinkedPassiveKeys).toEqual([
      101081, 101082, 201081, 201082, 301081, 301082, 401081, 401082, 501081,
      501082, 601081, 601082,
    ]);
    expect(indexes.tables.passive_skills.rows).toHaveLength(108);

    for (const attribute of active) {
      const skill = getCatalogRow(indexes, "skills", attribute.Value);
      expect(attribute.MaxLevel).toBe(5);
      expect(skill.AttributeKey).toBe(attribute.AttributeKey);
      expect(
        indexes.tables.skill_levels.groups
          .get(skill.SkillLevelKey!)!
          .filter((row) => row.Level <= 5)
          .map(({ Level }) => Level),
      ).toEqual([1, 2, 3, 4, 5]);
    }
    for (const attribute of linkedPassive) {
      const passive = getCatalogRow(indexes, "passive_skills", attribute.Value);
      expect(passive.PassiveSkillKey).toBe(attribute.Value);
      expect(["FLAT", "ADDITIVE"]).toContain(passive.MODTYPE);
    }
  });

  test("uses Attribute level zero even when legacy mirror arrays contain progress", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.skills = [{ key: 999_999, level: 5 }];
    state.heroes[0]!.passives = [{ key: 888_888, level: 5 }];

    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101021),
    ).toMatchObject({
      source: "Attribute",
      allocatedLevel: 0,
      effect: {
        kind: "passive-stat",
        passiveSkillKey: 101021,
        rawValue: 3,
        rawTotal: 0,
      },
    });
    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101003),
    ).toMatchObject({
      source: "Attribute",
      allocatedLevel: 0,
      effect: {
        kind: "active-skill",
        skillKey: 10101,
        levelRow: null,
      },
    });
  });

  test("uses Attribute level two when a skill mirror contradicts it with level five", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = knightState(2, [{ key: 101003, level: 2 }]);
    state.heroes[0]!.skills = [{ key: 10101, level: 5 }];

    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101003),
    ).toEqual({
      source: "Attribute",
      heroKey: 101,
      attributeKey: 101003,
      allocatedLevel: 2,
      maximumLevel: 5,
      effect: {
        kind: "active-skill",
        skillKey: 10101,
        skillLevelKey: 10101,
        levelRow: {
          SkillLevelKey: 10101,
          Level: 2,
          Value: 2700,
        },
      },
    });
  });

  test("projects an unowned Hero catalog effect with unavailable allocation", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = createFreshPlayerStateFromCatalog(indexes, 101);

    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 401, 401001),
    ).toEqual({
      source: "Attribute",
      heroKey: 401,
      attributeKey: 401001,
      allocatedLevel: null,
      maximumLevel: 3,
      effect: {
        kind: "passive-stat",
        passiveSkillKey: 401001,
        statType: "AttackDamage",
        modifierType: "FLAT",
        rawValue: 1,
        rawTotal: null,
        additiveFactor: null,
      },
    });
  });

  test("rejects unknown owned Hero 999999 before projecting accepted target 101001", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const unknownOwner = {
      ...structuredClone(state.heroes[0]!),
      heroKey: 999_999,
    };
    Object.defineProperties(unknownOwner, {
      passives: {
        get(): never {
          throw new Error("attribute ownership read passives");
        },
      },
      skills: {
        get(): never {
          throw new Error("attribute ownership read skills");
        },
      },
    });
    state.heroes.push(unknownOwner);

    expect(() =>
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101001),
    ).toThrow("999999");
  });

  test("rejects invalid owned Hero keys before projecting an unrelated valid target", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );

    for (const heroKey of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const state = createFreshPlayerStateFromCatalog(indexes, 101);
      state.heroes.push({
        ...structuredClone(state.heroes[0]!),
        heroKey,
      });

      expect(() =>
        projectDiscordHeroAttributeEffect(indexes, state, 101, 101001),
      ).toThrow("heroKey must be a positive safe integer");
    }
  });

  test("rejects an unrelated duplicate owned Hero before projection", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes.push(structuredClone(state.heroes[1]!));

    expect(() =>
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101001),
    ).toThrow("Player state repeats owned Hero 201");
  });

  test("projects exact active source rows at levels one and five and rejects level six", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const levelOne = knightState(1, [{ key: 101003, level: 1 }]);
    const levelFive = knightState(5, [{ key: 101003, level: 5 }]);

    expect(
      projectDiscordHeroAttributeEffect(indexes, levelOne, 101, 101003),
    ).toMatchObject({
      allocatedLevel: 1,
      effect: {
        kind: "active-skill",
        skillKey: 10101,
        levelRow: { SkillLevelKey: 10101, Level: 1, Value: 2500 },
      },
    });
    expect(
      projectDiscordHeroAttributeEffect(indexes, levelFive, 101, 101003),
    ).toMatchObject({
      allocatedLevel: 5,
      effect: {
        kind: "active-skill",
        skillKey: 10101,
        levelRow: { SkillLevelKey: 10101, Level: 5, Value: 3300 },
      },
    });
    expect(() =>
      projectDiscordHeroAttributeEffect(
        indexes,
        knightState(6, [{ key: 101003, level: 6 }]),
        101,
        101003,
      ),
    ).toThrow("heroes[0].attributes[0].level exceeds attribute max 5");
  });

  test("exposes additive factor 0.15 for raw 50 at level three without cross-layer aggregation", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = knightState(33, [
      { key: 101001, level: 3 },
      { key: 101002, level: 8 },
      { key: 101003, level: 5 },
      { key: 101004, level: 5 },
      { key: 101011, level: 8 },
      { key: 101012, level: 1 },
      { key: 101032, level: 3 },
    ]);

    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101032),
    ).toEqual({
      source: "Attribute",
      heroKey: 101,
      attributeKey: 101032,
      allocatedLevel: 3,
      maximumLevel: 10,
      effect: {
        kind: "passive-stat",
        passiveSkillKey: 101032,
        statType: "MaxHp",
        modifierType: "ADDITIVE",
        rawValue: 50,
        rawTotal: 150,
        additiveFactor: 0.15,
      },
    });
  });

  test("keeps flat raw 30 at level two as raw total 60", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = knightState(22, [
      { key: 101001, level: 3 },
      { key: 101002, level: 8 },
      { key: 101003, level: 5 },
      { key: 101004, level: 4 },
      { key: 101022, level: 2 },
    ]);

    expect(
      projectDiscordHeroAttributeEffect(indexes, state, 101, 101022),
    ).toMatchObject({
      allocatedLevel: 2,
      effect: {
        kind: "passive-stat",
        statType: "BlockChance",
        modifierType: "FLAT",
        rawValue: 30,
        rawTotal: 60,
        additiveFactor: null,
      },
    });
  });

  test("fails closed on malformed owner, point budget, group gate, and maximum", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );

    expect(() =>
      projectDiscordHeroAttributeEffect(
        indexes,
        knightState(1, [{ key: 201001, level: 1 }]),
        101,
        101001,
      ),
    ).toThrow("heroes[0].attributes[0].key belongs to hero 201");
    expect(() =>
      projectDiscordHeroAttributeEffect(
        indexes,
        knightState(1, [{ key: 101001, level: 2 }]),
        101,
        101001,
      ),
    ).toThrow("Attribute spend 2 exceeds Hero level budget 1");
    expect(() =>
      projectDiscordHeroAttributeEffect(
        indexes,
        knightState(10, [{ key: 101011, level: 1 }]),
        101,
        101011,
      ),
    ).toThrow("requires 10 points spent in lower Attribute groups");
    expect(() =>
      projectDiscordHeroAttributeEffect(
        indexes,
        knightState(4, [{ key: 101001, level: 4 }]),
        101,
        101001,
      ),
    ).toThrow("level exceeds attribute max 3");
  });

  test("returns a deeply frozen detached projection without changing state or catalog bytes", async () => {
    const { projectDiscordHeroAttributeEffect } = await import(
      ATTRIBUTE_EFFECTS_MODULE
    );
    const state = knightState(2, [{ key: 101001, level: 2 }]);
    const stateBefore = JSON.stringify(state);
    const catalogBefore = JSON.stringify(indexes.catalog);
    const projection = projectDiscordHeroAttributeEffect(
      indexes,
      state,
      101,
      101001,
    );

    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.effect)).toBe(true);
    expect(() => {
      (projection.effect as { rawTotal: number }).rawTotal = 999;
    }).toThrow();
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(indexes.catalog)).toBe(catalogBefore);
  });
});
