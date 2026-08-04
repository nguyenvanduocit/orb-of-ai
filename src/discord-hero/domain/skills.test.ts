import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { OracleRequiredError } from "./combat";
import {
  describeSkillActivation,
  executeSourceSkill,
  resolveSkillLevelValue,
} from "./skills";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero source skill mechanics", () => {
  test("classifies all 106 exact source activation rows without coercing IDs", () => {
    const counts = new Map<string, number>();

    for (const skill of indexes.tables.skills.rows) {
      const descriptor = describeSkillActivation(indexes, skill.SkillKey);
      counts.set(descriptor.kind, (counts.get(descriptor.kind) ?? 0) + 1);
    }

    expect(Object.fromEntries(counts)).toEqual({
      "base-attack": 58,
      "base-attack-count": 11,
      aura: 2,
      cooldown: 35,
    });
    expect(describeSkillActivation(indexes, "301111 ")).toEqual({
      kind: "base-attack",
      skillKey: "301111 ",
    });
    expect(() => describeSkillActivation(indexes, 301111)).toThrow(
      "skills has no unique row for key 301111",
    );
  });

  test("preserves the exact activation parameter for each proven trigger kind", () => {
    expect(describeSkillActivation(indexes, 10101)).toEqual({
      kind: "base-attack-count",
      skillKey: 10101,
      attackCount: 6,
    });
    expect(describeSkillActivation(indexes, 40201)).toEqual({
      kind: "aura",
      skillKey: 40201,
      immediate: true,
    });
    expect(describeSkillActivation(indexes, 30101)).toEqual({
      kind: "cooldown",
      skillKey: 30101,
      baseSeconds: 6,
    });
  });

  test("resolves every one of the 360 canonical skill-level values exactly", () => {
    let resolved = 0;

    for (const skill of indexes.tables.skills.rows) {
      if (skill.SkillLevelKey === null) continue;
      const rows = indexes.tables.skill_levels.groups.get(skill.SkillLevelKey)!;
      for (const row of rows) {
        expect(
          resolveSkillLevelValue(indexes, {
            skillKey: skill.SkillKey,
            level: row.Level,
          }),
        ).toBe(row.Value);
        resolved += 1;
      }
    }

    expect(resolved).toBe(360);
  });

  test("requires an oracle for cadence/target/status execution before RNG or mutation", () => {
    for (const skillKey of [10101, 40201, 30101] as const) {
      let rngCalls = 0;
      const state = Object.freeze({ hp: 100, buffs: Object.freeze([]) });
      const before = structuredClone(state);

      expect(() =>
        executeSourceSkill({
          indexes,
          skillKey,
          state,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(rngCalls).toBe(0);
      expect(state).toEqual(before);
    }
  });

  test("rejects arbitrary keys, forged level values, and forged activation rows before RNG", () => {
    expect(() => describeSkillActivation(indexes, "not-source ")).toThrow(
      'skills has no unique row for key "not-source "',
    );
    expect(() =>
      resolveSkillLevelValue(indexes, {
        skillKey: 10101,
        level: 1,
        Value: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow("skill level input has unknown field Value");

    let rngCalls = 0;
    expect(() =>
      executeSourceSkill({
        indexes,
        skillKey: 10101,
        skill: {
          SkillKey: 10101,
          ACTIVATIONTYPE: "COOLDOWN",
          ActivationValue: 0,
        },
        state: {},
        rng: () => {
          rngCalls += 1;
          return 0;
        },
      }),
    ).toThrow("skill execution input has unknown field skill");
    expect(rngCalls).toBe(0);
  });
});
