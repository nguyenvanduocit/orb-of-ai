import { beforeAll, describe, expect, test } from "bun:test";
import { StringSelectMenuOptionBuilder } from "discord.js";
import { join } from "node:path";
import {
  buildCatalogIndexes,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  decodeDiscordHeroAttributeHero,
  decodeDiscordHeroAttributePage,
  decodeDiscordHeroAttributeTarget,
  discordHeroAttributePage,
  discordHeroAttributePageCount,
  encodeDiscordHeroAttributeHero,
  encodeDiscordHeroAttributePage,
  encodeDiscordHeroAttributeTarget,
  projectDiscordHeroAttributeTrees,
  readDiscordHeroAttributeDetail,
} from "./attributes";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const EXPECTED_ATTRIBUTE_KEYS = [
  [
    101001, 101002, 101003, 101004, 101011, 101012, 101013, 101021, 101022,
    101023, 101031, 101032, 101033, 101041, 101042, 101043, 101051, 101052,
    101061, 101062, 101071, 101072,
  ],
  [
    201001, 201002, 201003, 201004, 201011, 201012, 201013, 201021, 201022,
    201023, 201031, 201032, 201033, 201041, 201042, 201043, 201051, 201052,
    201061, 201062, 201071, 201072,
  ],
  [
    301001, 301002, 301003, 301004, 301011, 301012, 301013, 301021, 301022,
    301023, 301031, 301032, 301033, 301041, 301042, 301043, 301051, 301052,
    301061, 301062, 301071, 301072,
  ],
  [
    401001, 401002, 401003, 401004, 401011, 401012, 401013, 401021, 401022,
    401023, 401031, 401032, 401033, 401041, 401042, 401043, 401051, 401052,
    401061, 401062, 401071, 401072,
  ],
  [
    501001, 501002, 501003, 501004, 501011, 501012, 501013, 501021, 501022,
    501023, 501031, 501032, 501033, 501041, 501042, 501043, 501051, 501052,
    501061, 501062, 501071, 501072,
  ],
  [
    601001, 601002, 601003, 601004, 601011, 601012, 601013, 601021, 601022,
    601023, 601031, 601032, 601033, 601041, 601042, 601043, 601051, 601052,
    601061, 601062, 601071, 601072,
  ],
] as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function hasValidUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function fullBudgetProgressState(
  catalog: DiscordHeroCatalogIndexes,
): PlayerState {
  const state = structuredClone(
    createFreshPlayerStateFromCatalog(catalog, 101),
  );
  state.heroes = catalog.tables.heroes.rows.map((hero) => {
    const attributes = hero.attribute_keys.map((key) =>
      getCatalogRow(catalog, "attributes", key as number),
    );
    let remainingPoints = 100;
    const allocatedAttributes = attributes.flatMap((attribute) => {
      const level = Math.min(
        attribute.MaxLevel,
        Math.floor(remainingPoints / attribute.RequiredPoint),
      );
      remainingPoints -= level * attribute.RequiredPoint;
      return level === 0 ? [] : [{ key: attribute.AttributeKey, level }];
    });
    return {
      heroKey: hero.HeroKey,
      level: 100,
      xp: Number.MAX_SAFE_INTEGER,
      attributes: allocatedAttributes,
      passives: [],
      skills: [],
      equipment: [],
      skins: [],
    };
  });
  return validatePlayerAgainstCatalog(state, catalog);
}

function withTableGroups<
  Name extends "attribute_groups" | "passive_skills" | "skills",
>(
  source: DiscordHeroCatalogIndexes,
  name: Name,
  groups: ReadonlyMap<number | string, readonly DiscordHeroDatasetRow<Name>[]>,
  rows = source.tables[name].rows,
): DiscordHeroCatalogIndexes {
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: {
        ...source.tables[name],
        rows,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

describe("DiscordHero Hero attribute-tree projection", () => {
  test("projects every exact source node and relationship for all six heroes", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const trees = projectDiscordHeroAttributeTrees(indexes, state);

    expect(trees.map((tree) => tree.HeroKey)).toEqual([
      101, 201, 301, 401, 501, 601,
    ]);
    expect(trees.map((tree) => tree.heroName)).toEqual([
      "Knight",
      "Ranger",
      "Sorcerer",
      "Priest",
      "Hunter",
      "Slayer",
    ]);
    expect(
      trees.map((tree) =>
        tree.groups.flatMap((group) =>
          group.nodes.map((node) => node.AttributeKey),
        ),
      ),
    ).toEqual(EXPECTED_ATTRIBUTE_KEYS.map((keys) => [...keys]));
    expect(
      trees.flatMap((tree) => tree.groups.flatMap((group) => group.nodes)),
    ).toHaveLength(132);

    for (const tree of trees) {
      expect(
        tree.groups.map(
          ({ AttributeGroupKey, RequiredAllocatedPoint, nodes }) => ({
            AttributeGroupKey,
            RequiredAllocatedPoint,
            count: nodes.length,
          }),
        ),
      ).toEqual([
        { AttributeGroupKey: 10001, RequiredAllocatedPoint: 0, count: 4 },
        { AttributeGroupKey: 10002, RequiredAllocatedPoint: 10, count: 3 },
        { AttributeGroupKey: 10003, RequiredAllocatedPoint: 20, count: 3 },
        { AttributeGroupKey: 10004, RequiredAllocatedPoint: 30, count: 3 },
        { AttributeGroupKey: 10005, RequiredAllocatedPoint: 40, count: 3 },
        { AttributeGroupKey: 10006, RequiredAllocatedPoint: 50, count: 2 },
        { AttributeGroupKey: 10007, RequiredAllocatedPoint: 60, count: 2 },
        { AttributeGroupKey: 10008, RequiredAllocatedPoint: 70, count: 2 },
      ]);
      const nodes = tree.groups.flatMap((group) => group.nodes);
      expect(nodes).toHaveLength(22);
      expect(
        nodes.filter((node) => node.ATTRIBUTETYPE === "PASSIVESKILL"),
      ).toHaveLength(16);
      expect(
        nodes.filter((node) => node.ATTRIBUTETYPE === "ACTIVESKILL"),
      ).toHaveLength(6);
      expect(tree.pageCount).toBe(1);

      for (const node of nodes) {
        const attribute = getCatalogRow(
          indexes,
          "attributes",
          node.AttributeKey,
        );
        expect(node).toMatchObject({
          AttributeKey: attribute.AttributeKey,
          HeroKey: attribute.HeroKey,
          GroupKey: attribute.GroupKey,
          ATTRIBUTETYPE: attribute.ATTRIBUTETYPE,
          Value: attribute.Value,
          RequiredPoint: attribute.RequiredPoint,
          MaxLevel: attribute.MaxLevel,
          AvailableDemo: attribute.AvailableDemo,
          effect: {
            source: "Attribute",
            heroKey: attribute.HeroKey,
            attributeKey: attribute.AttributeKey,
            maximumLevel: attribute.MaxLevel,
          },
        });
        if (node.relation.kind === "passive-skill") {
          const passive = getCatalogRow(
            indexes,
            "passive_skills",
            attribute.Value,
          );
          expect(node.relation.source).toEqual(passive);
          expect(node.relation.source).not.toBe(passive);
          expect(node.relation.source.PassiveSkillKey).toBe(attribute.Value);
        } else {
          const skill = getCatalogRow(indexes, "skills", attribute.Value);
          expect(node.relation.source).toEqual(skill);
          expect(node.relation.source).not.toBe(skill);
          expect(typeof node.relation.source.SkillKey).toBe("number");
          expect(node.relation.source.SkillKey).toBe(attribute.Value);
          expect(node.relation.source.AttributeKey).toBe(
            attribute.AttributeKey,
          );
        }
      }
    }
  });

  test("rejects unknown owned Hero 999999 instead of returning six catalog trees", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes.push({
      ...structuredClone(state.heroes[0]!),
      heroKey: 999_999,
    });

    expect(() => projectDiscordHeroAttributeTrees(indexes, state)).toThrow(
      "999999",
    );
  });

  test("overlays fresh ownership without inventing absent allocation progress", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const trees = projectDiscordHeroAttributeTrees(indexes, state);

    expect(
      trees.map(({ HeroKey, owned, heroLevel }) => ({
        HeroKey,
        owned,
        heroLevel,
      })),
    ).toEqual([
      { HeroKey: 101, owned: true, heroLevel: 1 },
      { HeroKey: 201, owned: true, heroLevel: 1 },
      { HeroKey: 301, owned: true, heroLevel: 1 },
      { HeroKey: 401, owned: false, heroLevel: null },
      { HeroKey: 501, owned: false, heroLevel: null },
      { HeroKey: 601, owned: false, heroLevel: null },
    ]);
    for (const tree of trees) {
      for (const node of tree.groups.flatMap((group) => group.nodes)) {
        expect(node.allocatedLevel).toBe(tree.owned ? 0 : null);
        expect(node.effect.allocatedLevel).toBe(tree.owned ? 0 : null);
        expect(node.effect.source).toBe("Attribute");
        expect(node.relation).not.toHaveProperty("currentLevel");
      }
    }

    expect(encodeDiscordHeroAttributeHero(indexes, 101)).toBe("h-2t");
    expect(decodeDiscordHeroAttributeHero(indexes, "h-2t")).toBe(101);
    expect(encodeDiscordHeroAttributePage(indexes, 101, 0)).toBe("p-2t-0");
    expect(decodeDiscordHeroAttributePage(indexes, "p-2t-0")).toEqual({
      heroKey: 101,
      page: 0,
    });
    expect(encodeDiscordHeroAttributeTarget(indexes, 101, 0, 101001)).toBe(
      "a-2t-0-25xl",
    );
    expect(decodeDiscordHeroAttributeTarget(indexes, "a-2t-0-25xl")).toEqual({
      heroKey: 101,
      page: 0,
      attributeKey: 101001,
    });
  });

  test("exposes all nodes through bounded pages and exact target detail", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const page = discordHeroAttributePage(indexes, state, "p-2t-0");

    expect(discordHeroAttributePageCount(indexes, 101)).toBe(1);
    expect(page).toMatchObject({
      HeroKey: 101,
      heroName: "Knight",
      heroTarget: "h-2t",
      page: 0,
      pageCount: 1,
      pageTarget: "p-2t-0",
    });
    expect(page.options).toHaveLength(22);
    expect(page.options[0]).toEqual({
      target: "a-2t-0-25xl",
      AttributeKey: 101001,
      GroupKey: 10001,
      label: "Attack Damage Enhancement",
      description: "PASSIVESKILL · Required 1 · Max 3",
      allocatedLevel: 0,
    });
    expect(page.options.every((option) => option.label.length <= 100)).toBe(
      true,
    );
    expect(
      page.options.every((option) => option.description.length <= 100),
    ).toBe(true);

    const passive = readDiscordHeroAttributeDetail(
      indexes,
      state,
      "a-2t-0-25xl",
    );
    expect(passive.relation).toMatchObject({
      kind: "passive-skill",
      source: {
        PassiveSkillKey: 101001,
        STATTYPE: "AttackDamage",
        MODTYPE: "FLAT",
        Value: 1,
      },
    });
    expect(passive.effect).toEqual({
      source: "Attribute",
      heroKey: 101,
      attributeKey: 101001,
      allocatedLevel: 0,
      maximumLevel: 3,
      effect: {
        kind: "passive-stat",
        passiveSkillKey: 101001,
        statType: "AttackDamage",
        modifierType: "FLAT",
        rawValue: 1,
        rawTotal: 0,
        additiveFactor: null,
      },
    });
    const active = readDiscordHeroAttributeDetail(
      indexes,
      state,
      encodeDiscordHeroAttributeTarget(indexes, 101, 0, 101003),
    );
    expect(active.relation).toMatchObject({
      kind: "active-skill",
      source: {
        SkillKey: 10101,
        AttributeKey: 101003,
        ACTIVATIONTYPE: "BASEATTACK_COUNT",
        ActivationValue: 6,
      },
    });
    expect(active.effect).toMatchObject({
      source: "Attribute",
      allocatedLevel: 0,
      effect: {
        kind: "active-skill",
        skillKey: 10101,
        levelRow: null,
      },
    });
    if (active.relation.kind !== "active-skill") {
      throw new Error("expected active-skill attribute detail");
    }
    expect(active.relation.source.levels).toHaveLength(10);
  });

  test("projects maximum valid effects only from Attribute allocation", () => {
    const state = fullBudgetProgressState(indexes);
    const frozenState = deepFreeze(state) as PlayerState;
    const before = JSON.stringify(frozenState);
    const trees = projectDiscordHeroAttributeTrees(indexes, frozenState);

    expect(trees).toHaveLength(6);
    for (const tree of trees) {
      expect(tree.owned).toBe(true);
      expect(tree.heroLevel).toBe(100);
      const progress = new Map(
        state.heroes
          .find((hero) => hero.heroKey === tree.HeroKey)!
          .attributes.map((attribute) => [attribute.key, attribute.level]),
      );
      expect(
        [...progress.values()].reduce((total, level) => total + level, 0),
      ).toBe(100);
      for (const node of tree.groups.flatMap((group) => group.nodes)) {
        expect(node.allocatedLevel).toBe(progress.get(node.AttributeKey) ?? 0);
        expect(node.effect.allocatedLevel).toBe(
          progress.get(node.AttributeKey) ?? 0,
        );
        expect(node.relation).not.toHaveProperty("currentLevel");
      }
    }
    expect(JSON.stringify(frozenState)).toBe(before);
  });

  test("rejects malformed, noncanonical, cross-hero, and cross-page codecs", () => {
    for (const value of [
      "",
      "h-",
      "h-02t",
      "h-2T",
      "h-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    ]) {
      expect(() => decodeDiscordHeroAttributeHero(indexes, value)).toThrow();
    }
    expect(() => decodeDiscordHeroAttributeHero(indexes, "h-1")).toThrow(
      "unknown source hero 1",
    );
    expect(() => decodeDiscordHeroAttributePage(indexes, "p-2t-00")).toThrow(
      "non-canonical",
    );
    expect(() => decodeDiscordHeroAttributePage(indexes, "p-2t-1")).toThrow(
      "outside 0-0",
    );
    expect(() =>
      decodeDiscordHeroAttributeTarget(indexes, "a-2t-0-4b3d"),
    ).toThrow("attribute 201001 belongs to hero 201, not 101");
    expect(() =>
      decodeDiscordHeroAttributeTarget(indexes, "a-2t-1-25xl"),
    ).toThrow("outside 0-0");
    expect(() =>
      decodeDiscordHeroAttributeTarget(indexes, "a-2t-0-025xl"),
    ).toThrow("non-canonical");
    expect(() =>
      encodeDiscordHeroAttributeTarget(indexes, 101, 0, 201001),
    ).toThrow("attribute 201001 belongs to hero 201, not 101");
  });

  test("fails closed on missing, duplicate, and type-mismatched relationships", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const passive = getCatalogRow(indexes, "passive_skills", 101001);
    const missingPassiveGroups = new Map(indexes.tables.passive_skills.groups);
    missingPassiveGroups.delete(101001);
    expect(() =>
      projectDiscordHeroAttributeTrees(
        withTableGroups(indexes, "passive_skills", missingPassiveGroups),
        state,
      ),
    ).toThrow("passive_skills has no unique row for key 101001");

    const duplicatePassiveGroups = new Map(
      indexes.tables.passive_skills.groups,
    );
    duplicatePassiveGroups.set(101001, [passive, passive]);
    expect(() =>
      projectDiscordHeroAttributeTrees(
        withTableGroups(indexes, "passive_skills", duplicatePassiveGroups),
        state,
      ),
    ).toThrow("passive_skills has no unique row for key 101001");

    const skill = getCatalogRow(indexes, "skills", 10101);
    const mismatchedSkill = {
      ...skill,
      SkillKey: "10101",
    } as unknown as DiscordHeroDatasetRow<"skills">;
    const mismatchedSkillGroups = new Map(indexes.tables.skills.groups);
    mismatchedSkillGroups.set(10101, [mismatchedSkill]);
    expect(() =>
      projectDiscordHeroAttributeTrees(
        withTableGroups(indexes, "skills", mismatchedSkillGroups),
        state,
      ),
    ).toThrow(
      'attribute 101003 relation expected numeric skill key 10101; received "10101"',
    );
  });

  test("fails closed on inconsistent Attributes and ignores mirror progress", () => {
    const fresh = createFreshPlayerStateFromCatalog(indexes, 101);
    expect(() =>
      projectDiscordHeroAttributeTrees(indexes, {
        ...fresh,
        heroes: fresh.heroes.map((hero, index) =>
          index === 0
            ? {
                ...hero,
                attributes: [{ key: 101001, level: 4 }],
              }
            : hero,
        ),
      }),
    ).toThrow("heroes[0].attributes[0].level exceeds attribute max 3");
    expect(() =>
      projectDiscordHeroAttributeTrees(indexes, {
        ...fresh,
        heroes: fresh.heroes.map((hero, index) =>
          index === 0
            ? {
                ...hero,
                attributes: [{ key: 201001, level: 1 }],
              }
            : hero,
        ),
      }),
    ).toThrow("heroes[0].attributes[0].key belongs to hero 201");
    const baseline = JSON.stringify(
      projectDiscordHeroAttributeTrees(indexes, fresh),
    );
    const invalidMirrors = {
      ...fresh,
      heroes: fresh.heroes.map((hero, index) =>
        index === 0
          ? {
              ...hero,
              skills: [{ key: 999_999, level: 5 }],
              passives: [{ key: 888_888, level: 5 }],
            }
          : hero,
      ),
    };
    expect(
      JSON.stringify(projectDiscordHeroAttributeTrees(indexes, invalidMirrors)),
    ).toBe(baseline);
  });

  test("bounds adversarial source previews while retaining exact detail", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const passive = getCatalogRow(indexes, "passive_skills", 101001);
    const adversarialName = `<script>${"x".repeat(300)}`;
    const forgedPassive = {
      ...passive,
      SkillNameKey_i18n: {
        ...passive.SkillNameKey_i18n,
        "en-US": adversarialName,
      },
    };
    const rows = indexes.tables.passive_skills.rows.map((row) =>
      row.PassiveSkillKey === 101001 ? forgedPassive : row,
    );
    const groups = new Map(indexes.tables.passive_skills.groups);
    groups.set(101001, [forgedPassive]);
    const forgedIndexes = withTableGroups(
      indexes,
      "passive_skills",
      groups,
      rows,
    );

    const page = discordHeroAttributePage(forgedIndexes, state, "p-2t-0");
    const detail = readDiscordHeroAttributeDetail(
      forgedIndexes,
      state,
      "a-2t-0-25xl",
    );

    expect(page.options[0]!.label).toHaveLength(100);
    expect(page.options[0]!.label.endsWith("…")).toBe(true);
    if (detail.relation.kind !== "passive-skill") {
      throw new Error("expected passive-skill attribute detail");
    }
    expect(detail.relation.source.SkillNameKey_i18n["en-US"]).toBe(
      adversarialName,
    );
  });

  test("bounds astral source previews by UTF-16 units without splitting code points", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const skill = getCatalogRow(indexes, "skills", 10101);
    const cases = [
      {
        name: "50 emoji",
        sourceName: "😀".repeat(50),
        sourceDescription: "🚀".repeat(50),
        expectedName: "😀".repeat(50),
        expectedDescription: "🚀".repeat(50),
      },
      {
        name: "51 emoji",
        sourceName: "😀".repeat(51),
        sourceDescription: "🚀".repeat(51),
        expectedName: `${"😀".repeat(49)}…`,
        expectedDescription: `${"🚀".repeat(49)}…`,
      },
      {
        name: "100 emoji",
        sourceName: "😀".repeat(100),
        sourceDescription: "🚀".repeat(100),
        expectedName: `${"😀".repeat(49)}…`,
        expectedDescription: `${"🚀".repeat(49)}…`,
      },
      {
        name: "mixed BMP and astral boundary",
        sourceName: `${"a".repeat(97)}😀tail`,
        sourceDescription: `${"b".repeat(98)}🚀tail`,
        expectedName: `${"a".repeat(97)}😀…`,
        expectedDescription: `${"b".repeat(98)}…`,
      },
    ] as const;

    for (const fixture of cases) {
      const forgedSkill = {
        ...skill,
        SkillNameKey_i18n: {
          ...skill.SkillNameKey_i18n,
          "en-US": fixture.sourceName,
        },
        SkillDescriptionKey_i18n: {
          ...skill.SkillDescriptionKey_i18n,
          "en-US": fixture.sourceDescription,
        },
      };
      const rows = indexes.tables.skills.rows.map((row) =>
        row.SkillKey === 10101 ? forgedSkill : row,
      );
      const groups = new Map(indexes.tables.skills.groups);
      groups.set(10101, [forgedSkill]);
      const forgedIndexes = withTableGroups(indexes, "skills", groups, rows);

      const page = discordHeroAttributePage(forgedIndexes, state, "p-2t-0");
      const option = page.options.find(
        (candidate) => candidate.AttributeKey === 101003,
      )!;
      const detail = readDiscordHeroAttributeDetail(
        forgedIndexes,
        state,
        "a-2t-0-25xn",
      );
      const serialized = new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setDescription(option.description)
        .setValue(option.target)
        .toJSON();

      expect(option.label, fixture.name).toBe(fixture.expectedName);
      expect(option.description, fixture.name).toBe(
        fixture.expectedDescription,
      );
      expect(option.label.length, fixture.name).toBeLessThanOrEqual(100);
      expect(option.description.length, fixture.name).toBeLessThanOrEqual(100);
      expect(hasValidUtf16(option.label), fixture.name).toBe(true);
      expect(hasValidUtf16(option.description), fixture.name).toBe(true);
      expect(serialized.label, fixture.name).toBe(option.label);
      expect(serialized.description, fixture.name).toBe(option.description);
      if (detail.relation.kind !== "active-skill") {
        throw new Error("expected active-skill attribute detail");
      }
      expect(
        detail.relation.source.SkillNameKey_i18n?.["en-US"],
        fixture.name,
      ).toBe(fixture.sourceName);
      expect(
        detail.relation.source.SkillDescriptionKey_i18n?.["en-US"],
        fixture.name,
      ).toBe(fixture.sourceDescription);
    }
  });

  test("returns fresh deeply frozen projections without catalog or state aliases", () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const before = JSON.stringify(state);
    const first = projectDiscordHeroAttributeTrees(indexes, state);
    const second = projectDiscordHeroAttributeTrees(indexes, state);
    const firstNode = first[0]!.groups[0]!.nodes[0]!;
    const secondNode = second[0]!.groups[0]!.nodes[0]!;

    expect(first).not.toBe(second);
    expect(firstNode).not.toBe(secondNode);
    expect(firstNode).not.toBe(indexes.tables.attributes.rows[0]);
    expect(firstNode.relation.source).not.toBe(
      indexes.tables.passive_skills.rows[0],
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0]!.groups)).toBe(true);
    expect(Object.isFrozen(firstNode)).toBe(true);
    expect(Object.isFrozen(firstNode.relation.source)).toBe(true);
    expect(() => {
      (firstNode as { AttributeKey: number }).AttributeKey = 9;
    }).toThrow(TypeError);
    expect(() => {
      (first as unknown[]).push(second[0]);
    }).toThrow(TypeError);
    expect(JSON.stringify(state)).toBe(before);
  });

  test("stays synchronous and has no RNG, clock, SQLite, or repository dependency", async () => {
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    let randomCalls = 0;
    let clockCalls = 0;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    Date.now = () => {
      clockCalls += 1;
      return 0;
    };
    let result;
    try {
      result = projectDiscordHeroAttributeTrees(indexes, state);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
    expect(result).not.toBeInstanceOf(Promise);
    expect(randomCalls).toBe(0);
    expect(clockCalls).toBe(0);

    const build = await Bun.build({
      entrypoints: [join(import.meta.dir, "attributes.ts")],
      target: "bun",
    });
    expect(build.success).toBe(true);
    const bundled = await build.outputs[0]!.text();
    expect(bundled).not.toContain("bun:sqlite");
    expect(bundled).not.toContain("state/repository");
  });
});
