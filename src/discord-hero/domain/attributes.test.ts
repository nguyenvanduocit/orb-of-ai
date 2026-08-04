import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";
import { allocateAttributePoint, quoteAttributeAllocation } from "./attributes";

let indexes: DiscordHeroCatalogIndexes;
let fresh: PlayerState;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  fresh = createFreshPlayerStateFromCatalog(indexes, 101);
});

function knightAtLevel(level: number): PlayerState {
  const state = structuredClone(fresh);
  const knight = state.heroes.find((hero) => hero.heroKey === 101)!;
  knight.level = level;
  knight.xp = 0;
  return state;
}

describe("DiscordHero source Attribute point allocation", () => {
  test("quotes the first +1 from Hero level budget and exact source cost", () => {
    expect(quoteAttributeAllocation(indexes, fresh, 101, 101001)).toEqual({
      kind: "available",
      heroKey: 101,
      attributeKey: 101001,
      groupKey: 10001,
      currentLevel: 0,
      nextLevel: 1,
      maximumLevel: 3,
      requiredPoint: 1,
      spentPoints: 0,
      pointBudget: 1,
      remainingPoints: 1,
      groupRequiredAllocatedPoint: 0,
    });
  });

  test("allocates only the target Hero Attribute and returns detached state", () => {
    const before = structuredClone(fresh);
    const result = allocateAttributePoint(indexes, fresh, 101, 101001);
    expect(result).toMatchObject({
      kind: "allocated",
      heroKey: 101,
      attributeKey: 101001,
      level: 1,
      requiredPoint: 1,
      spentPoints: 1,
      pointBudget: 1,
      remainingPoints: 0,
    });
    if (result.kind !== "allocated") throw new Error("expected allocation");

    expect(result.state.heroes[0]!.attributes).toEqual([
      { key: 101001, level: 1 },
    ]);
    expect(result.state.heroes[0]!.skills).toEqual([]);
    expect(result.state.heroes[0]!.passives).toEqual([]);
    expect({
      ...result.state,
      heroes: result.state.heroes.map((hero) =>
        hero.heroKey === 101 ? { ...hero, attributes: [] } : hero,
      ),
    }).toEqual(before);
    expect(fresh).toEqual(before);

    result.state.heroes[0]!.attributes[0]!.level = 1;
    expect(fresh.heroes[0]!.attributes).toEqual([]);
  });

  test("separates group threshold from available Hero points", () => {
    const levelTen = knightAtLevel(10);
    levelTen.heroes[0]!.attributes = [{ key: 101001, level: 1 }];
    expect(quoteAttributeAllocation(indexes, levelTen, 101, 101011)).toEqual({
      kind: "group-locked",
      heroKey: 101,
      attributeKey: 101011,
      groupKey: 10002,
      currentLevel: 0,
      maximumLevel: 8,
      requiredPoint: 1,
      spentPoints: 1,
      pointBudget: 10,
      remainingPoints: 9,
      groupRequiredAllocatedPoint: 10,
    });

    levelTen.heroes[0]!.attributes = [
      { key: 101001, level: 3 },
      { key: 101002, level: 7 },
    ];
    expect(quoteAttributeAllocation(indexes, levelTen, 101, 101011)).toEqual({
      kind: "insufficient-points",
      heroKey: 101,
      attributeKey: 101011,
      groupKey: 10002,
      currentLevel: 0,
      nextLevel: 1,
      maximumLevel: 8,
      requiredPoint: 1,
      spentPoints: 10,
      pointBudget: 10,
      remainingPoints: 0,
      groupRequiredAllocatedPoint: 10,
    });

    levelTen.heroes[0]!.level = 11;
    expect(
      quoteAttributeAllocation(indexes, levelTen, 101, 101011),
    ).toMatchObject({
      kind: "available",
      spentPoints: 10,
      pointBudget: 11,
      remainingPoints: 1,
      groupRequiredAllocatedPoint: 10,
    });
  });

  test("rejects a second level-1 spend and stops at exact source max", () => {
    const noPoints = knightAtLevel(1);
    noPoints.heroes[0]!.attributes = [{ key: 101001, level: 1 }];
    expect(
      allocateAttributePoint(indexes, noPoints, 101, 101002),
    ).toMatchObject({
      kind: "insufficient-points",
      spentPoints: 1,
      pointBudget: 1,
      remainingPoints: 0,
    });

    const maximum = knightAtLevel(100);
    maximum.heroes[0]!.attributes = [{ key: 101001, level: 3 }];
    expect(allocateAttributePoint(indexes, maximum, 101, 101001)).toEqual({
      kind: "maximum-level",
      heroKey: 101,
      attributeKey: 101001,
      groupKey: 10001,
      level: 3,
      maximumLevel: 3,
      requiredPoint: 1,
      spentPoints: 3,
      pointBudget: 100,
      remainingPoints: 97,
      groupRequiredAllocatedPoint: 0,
    });
  });

  test("uses RequiredPoint exactly in spent and budget math", () => {
    const source = indexes.tables.attributes.rows.find(
      (row) => row.AttributeKey === 101002,
    )!;
    const expensive = { ...source, RequiredPoint: 2 };
    const rows = indexes.tables.attributes.rows.map((row) =>
      row.AttributeKey === expensive.AttributeKey ? expensive : row,
    );
    const groups = new Map(indexes.tables.attributes.groups);
    groups.set(expensive.AttributeKey, [expensive]);
    const patched = {
      ...indexes,
      tables: {
        ...indexes.tables,
        attributes: {
          ...indexes.tables.attributes,
          rows,
          groups,
        },
      },
    } as DiscordHeroCatalogIndexes;
    const state = knightAtLevel(3);
    state.heroes[0]!.attributes = [{ key: 101001, level: 1 }];

    expect(
      allocateAttributePoint(patched, state, 101, expensive.AttributeKey),
    ).toMatchObject({
      kind: "allocated",
      requiredPoint: 2,
      spentPoints: 3,
      pointBudget: 3,
      remainingPoints: 0,
    });
  });

  test("allocates every one of 132 source Attributes from a reachable gate state", () => {
    let covered = 0;
    for (const attribute of indexes.tables.attributes.rows) {
      const group = indexes.tables.attribute_groups.rows.find(
        (candidate) => candidate.AttributeGroupKey === attribute.GroupKey,
      )!;
      const state = structuredClone(fresh);
      let hero = state.heroes.find(
        (candidate) => candidate.heroKey === attribute.HeroKey,
      );
      if (hero === undefined) {
        hero = {
          heroKey: attribute.HeroKey,
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
      let remainingGateSpend = group.RequiredAllocatedPoint;
      for (const candidate of indexes.tables.attributes.rows) {
        if (
          candidate.HeroKey !== attribute.HeroKey ||
          remainingGateSpend === 0
        ) {
          continue;
        }
        const candidateGroup = indexes.tables.attribute_groups.rows.find(
          (source) => source.AttributeGroupKey === candidate.GroupKey,
        )!;
        if (
          candidateGroup.RequiredAllocatedPoint >= group.RequiredAllocatedPoint
        ) {
          continue;
        }
        const level = Math.min(
          candidate.MaxLevel,
          Math.floor(remainingGateSpend / candidate.RequiredPoint),
        );
        if (level > 0) {
          hero.attributes.push({ key: candidate.AttributeKey, level });
          remainingGateSpend -= level * candidate.RequiredPoint;
        }
      }
      expect(remainingGateSpend).toBe(0);
      hero.level = group.RequiredAllocatedPoint + attribute.RequiredPoint;
      const beforeSkills = structuredClone(hero.skills);
      const beforePassives = structuredClone(hero.passives);

      const result = allocateAttributePoint(
        indexes,
        state,
        attribute.HeroKey,
        attribute.AttributeKey,
      );
      expect(result).toMatchObject({
        kind: "allocated",
        heroKey: attribute.HeroKey,
        attributeKey: attribute.AttributeKey,
        groupKey: attribute.GroupKey,
        level: 1,
        maximumLevel: attribute.MaxLevel,
        requiredPoint: attribute.RequiredPoint,
        spentPoints: group.RequiredAllocatedPoint + attribute.RequiredPoint,
        pointBudget: group.RequiredAllocatedPoint + attribute.RequiredPoint,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: group.RequiredAllocatedPoint,
      });
      if (result.kind !== "allocated") throw new Error("expected allocation");
      const afterHero = result.state.heroes.find(
        (candidate) => candidate.heroKey === attribute.HeroKey,
      )!;
      expect(
        afterHero.attributes.find(
          (progress) => progress.key === attribute.AttributeKey,
        ),
      ).toEqual({ key: attribute.AttributeKey, level: 1 });
      expect(afterHero.skills).toEqual(beforeSkills);
      expect(afterHero.passives).toEqual(beforePassives);
      covered += 1;
    }
    expect(covered).toBe(132);
  });

  test("stores new progress in canonical source order", () => {
    const state = knightAtLevel(3);
    state.heroes[0]!.attributes = [{ key: 101002, level: 1 }];
    const result = allocateAttributePoint(indexes, state, 101, 101001);
    if (result.kind !== "allocated") throw new Error("expected allocation");

    expect(result.state.heroes[0]!.attributes).toEqual([
      { key: 101001, level: 1 },
      { key: 101002, level: 1 },
    ]);
  });

  test("fails closed for noncanonical existing Attribute progress", () => {
    const zero = knightAtLevel(10);
    zero.heroes[0]!.attributes = [{ key: 101001, level: 0 }];
    expect(() => quoteAttributeAllocation(indexes, zero, 101, 101002)).toThrow(
      "Attribute 101001 level must be a positive safe integer",
    );

    const duplicate = knightAtLevel(10);
    duplicate.heroes[0]!.attributes = [
      { key: 101001, level: 1 },
      { key: 101001, level: 1 },
    ];
    expect(() =>
      quoteAttributeAllocation(indexes, duplicate, 101, 101002),
    ).toThrow("duplicates Attribute 101001");

    const groupIllegal = knightAtLevel(10);
    groupIllegal.heroes[0]!.attributes = [{ key: 101011, level: 1 }];
    expect(() =>
      quoteAttributeAllocation(indexes, groupIllegal, 101, 101001),
    ).toThrow(
      "Attribute 101011 requires 10 points spent in lower Attribute groups",
    );

    const selfBootstrapped = knightAtLevel(11);
    selfBootstrapped.heroes[0]!.attributes = [
      { key: 101011, level: 8 },
      { key: 101012, level: 2 },
    ];
    expect(() =>
      quoteAttributeAllocation(indexes, selfBootstrapped, 101, 101013),
    ).toThrow(
      "Attribute 101011 requires 10 points spent in lower Attribute groups",
    );

    const shortByOne = knightAtLevel(11);
    shortByOne.heroes[0]!.attributes = [
      { key: 101001, level: 3 },
      { key: 101002, level: 6 },
      { key: 101011, level: 1 },
    ];
    expect(() =>
      quoteAttributeAllocation(indexes, shortByOne, 101, 101013),
    ).toThrow(
      "Attribute 101011 requires 10 points spent in lower Attribute groups",
    );
  });

  test("fails closed for missing, unowned, cross-Hero, and unsafe identities", () => {
    expect(() => quoteAttributeAllocation(indexes, fresh, 401, 401001)).toThrow(
      "Hero 401 is not owned",
    );
    expect(() => quoteAttributeAllocation(indexes, fresh, 101, 201001)).toThrow(
      "belongs to Hero 201, not 101",
    );
    expect(() => quoteAttributeAllocation(indexes, fresh, 101, 999999)).toThrow(
      "attributes has no unique row",
    );
    expect(() => quoteAttributeAllocation(indexes, fresh, 0, 101001)).toThrow(
      "Hero key must be a positive safe integer",
    );
  });
});
