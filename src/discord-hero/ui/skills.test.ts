import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  decodeDiscordHeroSkillPage,
  decodeDiscordHeroSkillTarget,
  discordHeroSkillPageCount,
  discordHeroSkills,
  encodeDiscordHeroSkillPage,
  encodeDiscordHeroSkillTarget,
  readDiscordHeroSkill,
} from "./skills";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero Skills source projection", () => {
  test("covers all 106 definitions and 360 level rows in bounded source order", () => {
    expect(discordHeroSkillPageCount(indexes)).toBe(5);
    const pages = Array.from(
      { length: discordHeroSkillPageCount(indexes) },
      (_, page) => discordHeroSkills(indexes, page),
    );
    expect(pages.map((page) => page.length)).toEqual([25, 25, 25, 25, 6]);
    expect(pages.every((page) => Object.isFrozen(page))).toBe(true);
    expect(pages.flat().map((skill) => skill.SkillKey)).toEqual(
      indexes.tables.skills.rows.map((skill) => skill.SkillKey),
    );
    expect(
      pages.flat().reduce((total, skill) => total + skill.levels.length, 0),
    ).toBe(360);
  });

  test("projects exact named hero skill fields and level linkage", () => {
    const rowIndex = indexes.tables.skills.rows.findIndex(
      (skill) => skill.SkillKey === 10101,
    );
    const skill = readDiscordHeroSkill(
      indexes,
      encodeDiscordHeroSkillTarget(rowIndex),
    );

    expect(skill).toMatchObject({
      rowIndex,
      sourceKey: 10101,
      name: "Piercing Thrust",
      description:
        "Thrust your sword deeply forward, dealing {0}% physical damage to enemies in range.",
      activationType: "BASEATTACK_COUNT",
      activationValue: 6,
      slotType: "SKILL",
      skillBuffType: "Normal",
      damageType: "Physical",
      damageDeliveryType: "Melee, AOE",
      attributeKey: 101003,
      soundKey: 1101011,
      heroKeys: [101],
    });
    expect(skill.levels).toEqual(
      Array.from({ length: 10 }, (_, index) => ({
        level: index + 1,
        value: 2500 + index * 200,
      })),
    );
    expect(indexes.tables.skill_levels.groups.get(10101)).toHaveLength(10);
  });

  test("preserves exact trailing-space monster skill keys and scalar strings", () => {
    const rowIndex = indexes.tables.skills.rows.findIndex(
      (skill) => skill.SkillKey === "200111 ",
    );
    expect(rowIndex).toBeGreaterThanOrEqual(0);

    const skill = readDiscordHeroSkill(
      indexes,
      encodeDiscordHeroSkillTarget(rowIndex),
    );
    expect(skill.sourceKey).toBe("200111 ");
    expect(skill.order).toBe("999 ");
    expect(skill.value).toBe("1000 ");
    expect(skill.name).toBe('Source Skill "200111 "');
    expect(skill.heroKeys).toEqual([]);
    expect(skill.levels).toEqual([]);
  });

  test("maps all 6 base skills and 36 active hero skills without inventing ownership", () => {
    const projected = indexes.tables.skills.rows.map((_, rowIndex) =>
      readDiscordHeroSkill(indexes, encodeDiscordHeroSkillTarget(rowIndex)),
    );
    const heroLinks = projected.flatMap((skill) =>
      skill.heroKeys.map((heroKey) => [heroKey, skill.sourceKey]),
    );

    expect(heroLinks).toHaveLength(42);
    for (const heroKey of [101, 201, 301, 401, 501, 601]) {
      expect(
        heroLinks.filter(([candidate]) => candidate === heroKey),
      ).toHaveLength(7);
    }
  });

  test("round-trips canonical pages/targets and rejects forged locations", () => {
    expect(decodeDiscordHeroSkillPage(encodeDiscordHeroSkillPage(4))).toBe(4);
    expect(
      decodeDiscordHeroSkillTarget(encodeDiscordHeroSkillTarget(105)),
    ).toBe(105);

    for (const value of ["s-04", "s--1", "s-0-extra", "x-0"]) {
      expect(() => decodeDiscordHeroSkillPage(value)).toThrow();
    }
    for (const value of ["k-00", "k--1", "k-0-extra", "x-0"]) {
      expect(() => decodeDiscordHeroSkillTarget(value)).toThrow();
    }
    expect(() => discordHeroSkills(indexes, 5)).toThrow("outside");
    expect(() => readDiscordHeroSkill(indexes, "k-2y")).toThrow("outside");
  });
});
