import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectSourceEffectTopology } from "./source-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function counts(values: readonly unknown[]): Record<string, number> {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = String(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...result].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function withRows(
  source: DiscordHeroCatalogIndexes,
  name: "buff_groups" | "buffs" | "monsters" | "skills" | "status_effects",
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
      [name]: {
        ...source.tables[name],
        rows,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

const TRAILING_SPACE_MONSTER_SKILL_REFERENCES = [
  [20011, 200111],
  [20021, 200211],
  [20022, 200221],
  [20023, 200231],
  [20024, 200241],
  [20031, 200311],
  [20041, 200411],
  [20042, 200421],
  [20051, 200511],
  [20061, 200611],
  [20062, 200621],
  [20071, 200711],
  [20081, 200811],
  [20091, 200911],
  [20111, 201111],
  [30011, 300111],
  [30012, 300121],
  [30013, 300131],
  [30021, 300211],
  [30031, 300311],
  [30041, 300411],
  [30042, 300421],
  [30043, 300431],
  [30044, 300441],
  [30051, 300511],
  [30061, 300611],
  [30071, 300711],
  [30081, 300811],
  [30082, 300821],
  [30083, 300831],
  [30084, 300841],
  [30091, 300911],
  [30111, 301111],
] as const;

describe("DiscordHero source-effect topology", () => {
  test("projects the exact source corpus and preserves every raw skill effect field", () => {
    const topology = projectSourceEffectTopology({ indexes });

    expect(topology.counts).toEqual({
      skills: 106,
      buffGroupRows: 16,
      uniqueBuffGroupKeys: 15,
      buffs: 29,
      statusEffects: 6,
      monsterSkillReferences: 91,
    });
    expect(
      topology.skills.map(
        ({
          skillKey,
          activationType,
          activationValue,
          skillBuffType,
          buffGroupKey,
          damageType,
          deliveryType,
          range,
          value,
        }) => ({
          skillKey,
          activationType,
          activationValue,
          skillBuffType,
          buffGroupKey,
          damageType,
          deliveryType,
          range,
          value,
        }),
      ),
    ).toEqual(
      indexes.tables.skills.rows.map((skill) => ({
        skillKey: skill.SkillKey,
        activationType: skill.ACTIVATIONTYPE,
        activationValue: skill.ActivationValue,
        skillBuffType: skill.SkillBuffType,
        buffGroupKey: skill.BuffGroupKey,
        damageType: skill.DamageType,
        deliveryType: skill.DamageDeliveryType,
        range: skill.Range,
        value: skill.Value,
      })),
    );
    expect(
      counts(topology.skills.map((skill) => skill.activationType)),
    ).toEqual({
      BASEATTACK: 58,
      BASEATTACK_COUNT: 11,
      CONTINUOUS: 2,
      COOLDOWN: 35,
    });
    expect(counts(topology.skills.map((skill) => skill.skillBuffType))).toEqual(
      {
        Buff: 12,
        Normal: 94,
      },
    );
    expect(counts(topology.skills.map((skill) => skill.damageType))).toEqual({
      Chaos: 8,
      Cold: 5,
      Fire: 12,
      Lightning: 4,
      Physical: 77,
    });
    expect(counts(topology.skills.map((skill) => skill.deliveryType))).toEqual({
      AOE: 10,
      Melee: 6,
      "Melee, AOE": 4,
      Projectile: 10,
      "Projectile, AOE": 2,
      "Projectile, Summon": 2,
      Trap: 1,
      null: 71,
    });

    for (const skill of topology.skills) {
      expect(Object.hasOwn(skill, "statusEffectKey")).toBe(false);
      expect(Object.hasOwn(skill, "status")).toBe(false);
      if (skill.buffGroupKey === null) {
        expect(skill.buffGroupReference).toEqual({ kind: "none" });
      } else {
        expect(skill.buffGroupReference).toMatchObject({
          kind: "resolved",
          buffGroupKey: skill.buffGroupKey,
        });
      }
    }
  });

  test("keeps all 16 buff-group rows in source order, including both 60601 rows and missing buff 206011", () => {
    const topology = projectSourceEffectTopology({ indexes });

    expect(
      topology.buffGroupRows.map(({ rowIndex, buffGroupKey, rawBuffKeys }) => ({
        rowIndex,
        buffGroupKey,
        rawBuffKeys,
      })),
    ).toEqual(
      indexes.tables.buff_groups.rows.map((row, rowIndex) => ({
        rowIndex,
        buffGroupKey: row.BuffGroupKey,
        rawBuffKeys: row.BuffKeys,
      })),
    );
    expect(
      topology.buffGroupRows
        .filter((row) => row.buffGroupKey === 60601)
        .map((row) => ({
          rowIndex: row.rowIndex,
          rawBuffKeys: row.rawBuffKeys,
          buffReferences: row.buffReferences,
        })),
    ).toEqual([
      {
        rowIndex: 10,
        rawBuffKeys: 606011,
        buffReferences: [{ kind: "resolved", buffKey: 606011 }],
      },
      {
        rowIndex: 11,
        rawBuffKeys: null,
        buffReferences: [],
      },
    ]);
    expect(
      topology.buffGroupRows.find((row) => row.buffGroupKey === 20601)
        ?.buffReferences,
    ).toEqual([
      {
        kind: "unresolved-source",
        source: "buff-group",
        sourceKey: 20601,
        buffKey: 206011,
        ruleId: "buff_groups.BuffKeys->buffs",
        reason: "source buff key is absent from the buffs table",
      },
    ]);
  });

  test("preserves all buff contracts and marks the four null values as runtime unresolved", () => {
    const topology = projectSourceEffectTopology({ indexes });

    expect(
      topology.buffs.map(({ buffKey, buffType, statType, modType, value }) => ({
        buffKey,
        buffType,
        statType,
        modType,
        value,
      })),
    ).toEqual(
      indexes.tables.buffs.rows.map((buff) => ({
        buffKey: buff.BuffKey,
        buffType: buff.BuffType,
        statType: buff.STATTYPE,
        modType: buff.MODTYPE,
        value: buff.Value,
      })),
    );
    expect(counts(topology.buffs.map((buff) => buff.buffType))).toEqual({
      Buff: 11,
      Debuff: 18,
    });
    expect(counts(topology.buffs.map((buff) => buff.modType))).toEqual({
      ADDITIVE: 3,
      FLAT: 19,
      MULTIPLICATIVE: 7,
    });
    expect(counts(topology.buffs.map((buff) => buff.statType))).toEqual({
      AttackDamage: 3,
      AttackSpeed: 4,
      ChaosResistance: 3,
      ColdResistance: 4,
      CriticalChance: 1,
      DamageAddition: 1,
      FireDamageAddition: 1,
      FireResistance: 4,
      LightningDamageAddition: 1,
      LightningResistance: 4,
      MovementSpeed: 2,
      PhysicalDamageAddition: 1,
    });
    expect(
      topology.buffs
        .filter((buff) => buff.value === null)
        .map((buff) => [buff.buffKey, buff.runtimeValue]),
    ).toEqual([
      [
        402011,
        {
          kind: "runtime-value-unresolved",
          reason: "source buff Value is null",
        },
      ],
      [
        405011,
        {
          kind: "runtime-value-unresolved",
          reason: "source buff Value is null",
        },
      ],
      [
        405012,
        {
          kind: "runtime-value-unresolved",
          reason: "source buff Value is null",
        },
      ],
      [
        405013,
        {
          kind: "runtime-value-unresolved",
          reason: "source buff Value is null",
        },
      ],
    ]);
    expect(
      topology.buffs
        .filter((buff) => buff.value !== null)
        .every(
          (buff) =>
            buff.runtimeValue.kind === "source-value" &&
            buff.runtimeValue.value === buff.value,
        ),
    ).toBe(true);
  });

  test("keeps the six status contracts in a separate exact-reference registry", () => {
    const topology = projectSourceEffectTopology({ indexes });

    expect(
      topology.statusEffects.map((status) => ({
        statusEffectKey: status.statusEffectKey,
        statusEffectType: status.statusEffectType,
        duration: status.duration,
        rawBuffKeys: status.rawBuffKeys,
        overrideType: status.overrideType,
        params: status.params,
        buffReferences: status.buffReferences,
      })),
    ).toEqual([
      {
        statusEffectKey: 101,
        statusEffectType: "Chill",
        duration: 400,
        rawBuffKeys: "1011 1012",
        overrideType: "InitDuration",
        params: [null, null, null, null],
        buffReferences: [
          { kind: "resolved", buffKey: 1011 },
          { kind: "resolved", buffKey: 1012 },
        ],
      },
      {
        statusEffectKey: 102,
        statusEffectType: "Freeze",
        duration: 150,
        rawBuffKeys: null,
        overrideType: "NotOverride",
        params: [null, null, null, null],
        buffReferences: [],
      },
      {
        statusEffectKey: 103,
        statusEffectType: "Ignite",
        duration: 400,
        rawBuffKeys: 1031,
        overrideType: "NotOverride",
        params: [50, 2, null, null],
        buffReferences: [{ kind: "resolved", buffKey: 1031 }],
      },
      {
        statusEffectKey: 104,
        statusEffectType: "Shock",
        duration: 600,
        rawBuffKeys: 1041,
        overrideType: "InitDuration",
        params: [800, 100, null, null],
        buffReferences: [{ kind: "resolved", buffKey: 1041 }],
      },
      {
        statusEffectKey: 105,
        statusEffectType: "Bleed",
        duration: 700,
        rawBuffKeys: 1051,
        overrideType: "NotOverride",
        params: [30, 2, null, null],
        buffReferences: [{ kind: "resolved", buffKey: 1051 }],
      },
      {
        statusEffectKey: 106,
        statusEffectType: "Stun",
        duration: 200,
        rawBuffKeys: 1061,
        overrideType: "InitDuration",
        params: [null, null, null, null],
        buffReferences: [{ kind: "resolved", buffKey: 1061 }],
      },
    ]);
    expect(
      topology.skills.every(
        (skill) =>
          !Object.hasOwn(skill, "statusEffectKey") &&
          !Object.hasOwn(skill, "status"),
      ),
    ).toBe(true);
  });

  test("resolves monster skills only by exact key and exposes all 33 trailing-space source limitations", () => {
    const topology = projectSourceEffectTopology({ indexes });
    const unresolved = topology.monsterSkillReferences.filter(
      (reference) => reference.kind === "unresolved-source",
    );

    expect(topology.monsterSkillReferences).toHaveLength(91);
    expect(unresolved).toHaveLength(33);
    expect(
      unresolved.map(({ monsterKey, skillKey }) => [monsterKey, skillKey]),
    ).toEqual(
      TRAILING_SPACE_MONSTER_SKILL_REFERENCES.map(([monsterKey, skillKey]) => [
        monsterKey,
        skillKey,
      ]),
    );
    for (const reference of unresolved) {
      expect(reference).toMatchObject({
        kind: "unresolved-source",
        source: "monster",
        ruleId: "monsters.SkillKey->skills",
        reason:
          "exact numeric reference does not match the trailing-space skill key",
      });
      expect(reference.apparentSkillKey).toBe(`${reference.skillKey} `);
      expect(indexes.tables.skills.groups.has(reference.apparentSkillKey)).toBe(
        true,
      );
      expect(indexes.tables.skills.groups.has(reference.skillKey)).toBe(false);
    }
  });

  test("fails closed on duplicate or malformed primaries before returning a partial topology", () => {
    const duplicateSkill = withRows(indexes, "skills", (rows) => {
      rows[105] = { ...rows[0]! };
    });
    const malformedBuff = withRows(indexes, "buffs", (rows) => {
      rows[0]!.BuffKey = 1.5;
    });
    const wrongGroupedDuplicate = withRows(indexes, "buff_groups", (rows) => {
      rows[11]!.BuffGroupKey = 60501;
    });

    expect(() =>
      projectSourceEffectTopology({ indexes: duplicateSkill }),
    ).toThrow("skills.SkillKey must be unique");
    expect(() =>
      projectSourceEffectTopology({ indexes: malformedBuff }),
    ).toThrow("buffs.BuffKey must be a positive safe integer");
    expect(() =>
      projectSourceEffectTopology({ indexes: wrongGroupedDuplicate }),
    ).toThrow(
      "buff_groups duplicate topology must be exactly 60601 at rows 10,11",
    );
  });

  test("fails closed instead of trimming, coercing, or accepting unknown references and row fields", () => {
    const trailingSpaceReference = withRows(indexes, "monsters", (rows) => {
      rows[0]!.SkillKey = "100111 ";
    });
    const unknownBuff = withRows(indexes, "status_effects", (rows) => {
      rows[0]!.BuffKeys = 999_999;
    });
    const unknownGroup = withRows(indexes, "skills", (rows) => {
      rows[0]!.BuffGroupKey = 999_999;
    });
    const inventedRuntimeField = withRows(indexes, "skills", (rows) => {
      rows[0]!.cooldownSeconds = 1;
    });

    expect(() =>
      projectSourceEffectTopology({ indexes: trailingSpaceReference }),
    ).toThrow("monsters.SkillKey must be a canonical positive-integer list");
    expect(() => projectSourceEffectTopology({ indexes: unknownBuff })).toThrow(
      "status_effects.BuffKeys references unknown buff 999999",
    );
    expect(() =>
      projectSourceEffectTopology({ indexes: unknownGroup }),
    ).toThrow("skills.BuffGroupKey references unknown buff group 999999");
    expect(() =>
      projectSourceEffectTopology({ indexes: inventedRuntimeField }),
    ).toThrow("skills row has unknown field cooldownSeconds");
  });

  test("accepts only the exact indexes input and never reads state or RNG fields", () => {
    let stateReads = 0;
    let rngReads = 0;
    const input = {
      indexes,
      get state() {
        stateReads += 1;
        return {};
      },
      get rng() {
        rngReads += 1;
        return () => 0;
      },
    };

    expect(() =>
      projectSourceEffectTopology(
        input as unknown as { indexes: DiscordHeroCatalogIndexes },
      ),
    ).toThrow("source-effect topology input has unknown fields rng, state");
    expect(stateReads).toBe(0);
    expect(rngReads).toBe(0);
    expect(() =>
      projectSourceEffectTopology({
        indexes: {
          ...indexes,
          state: {},
        } as unknown as DiscordHeroCatalogIndexes,
      }),
    ).toThrow("source-effect topology indexes has unknown field state");
  });

  test("returns a deeply frozen detached value graph", () => {
    const topology = projectSourceEffectTopology({ indexes });

    expectDeeplyFrozen(topology);
    expect(topology.skills[0]).not.toBe(indexes.tables.skills.rows[0]);
    expect(topology.buffGroupRows[0]).not.toBe(
      indexes.tables.buff_groups.rows[0],
    );
    expect(topology.buffs[0]).not.toBe(indexes.tables.buffs.rows[0]);
    expect(topology.statusEffects[0]).not.toBe(
      indexes.tables.status_effects.rows[0],
    );
    expect(() =>
      (
        topology.skills as unknown as Array<(typeof topology.skills)[number]>
      ).push(topology.skills[0]!),
    ).toThrow(TypeError);
  });
});
