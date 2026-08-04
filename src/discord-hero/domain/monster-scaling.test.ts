import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectStageMonsterBaseStats } from "./monster-scaling";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function withGroupRows(
  base: DiscordHeroCatalogIndexes,
  dataset: "stages" | "stage_levels" | "monsters",
  key: number,
  rows: readonly Readonly<Record<string, unknown>>[],
): DiscordHeroCatalogIndexes {
  const table = base.tables[dataset];
  const groups = new Map<number, readonly Readonly<Record<string, unknown>>[]>(
    table.groups as unknown as ReadonlyMap<
      number,
      readonly Readonly<Record<string, unknown>>[]
    >,
  );
  groups.set(key, rows);
  return {
    ...base,
    tables: {
      ...base.tables,
      [dataset]: {
        ...table,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withRowPatch(
  base: DiscordHeroCatalogIndexes,
  dataset: "stages" | "stage_levels" | "monsters",
  key: number,
  patch: Readonly<Record<string, unknown>>,
): DiscordHeroCatalogIndexes {
  const row = base.tables[dataset].groups.get(key)?.[0];
  if (row === undefined) {
    throw new Error(`${dataset} fixture has no row ${key}`);
  }
  return withGroupRows(base, dataset, key, [
    Object.freeze({ ...row, ...patch }),
  ]);
}

describe("DiscordHero source monster base-stat scaling", () => {
  test("projects the four hand-derived source vectors with sequential half-even scaling", () => {
    expect(
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10011,
        role: "wave",
      }),
    ).toEqual({
      stageKey: 1101,
      stageLevel: 1,
      monsterKey: 10011,
      role: "wave",
      maxLife: 5,
      attackDamage: 1,
      sourceRewardGoldPerMonster: 1,
      sourceRewardExpPerMonster: 1,
      attackSpeedRaw: 40,
      movementSpeedRaw: 110,
      stageMultipliersPerThousand: {
        attackDamage: 100,
        maxLife: 100,
        sourceRewardGoldPerMonster: 100,
        sourceRewardExpPerMonster: 100,
      },
      bossMultipliersPerThousand: null,
      bossScaleRaw: null,
    });
    expect(
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10022,
        role: "boss",
      }),
    ).toEqual({
      stageKey: 1101,
      stageLevel: 1,
      monsterKey: 10022,
      role: "boss",
      maxLife: 12,
      attackDamage: 2,
      sourceRewardGoldPerMonster: 4,
      sourceRewardExpPerMonster: 6,
      attackSpeedRaw: 110,
      movementSpeedRaw: 280,
      stageMultipliersPerThousand: {
        attackDamage: 100,
        maxLife: 100,
        sourceRewardGoldPerMonster: 100,
        sourceRewardExpPerMonster: 100,
      },
      bossMultipliersPerThousand: {
        attackDamage: 2000,
        maxLife: 3000,
        sourceRewardGoldPerMonster: 2000,
        sourceRewardExpPerMonster: 3000,
      },
      bossScaleRaw: 3,
    });
    expect(
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1102,
        monsterKey: 10023,
        role: "boss",
      }),
    ).toEqual({
      stageKey: 1102,
      stageLevel: 2,
      monsterKey: 10023,
      role: "boss",
      maxLife: 30,
      attackDamage: 5,
      sourceRewardGoldPerMonster: 9,
      sourceRewardExpPerMonster: 12,
      attackSpeedRaw: 70,
      movementSpeedRaw: 135,
      stageMultipliersPerThousand: {
        attackDamage: 130,
        maxLife: 180,
        sourceRewardGoldPerMonster: 150,
        sourceRewardExpPerMonster: 130,
      },
      bossMultipliersPerThousand: {
        attackDamage: 2500,
        maxLife: 6000,
        sourceRewardGoldPerMonster: 3000,
        sourceRewardExpPerMonster: 4000,
      },
      bossScaleRaw: 3,
    });
    expect(
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1110,
        monsterKey: 10901,
        role: "boss",
      }),
    ).toEqual({
      stageKey: 1110,
      stageLevel: 12,
      monsterKey: 10901,
      role: "boss",
      maxLife: 1544,
      attackDamage: 24,
      sourceRewardGoldPerMonster: 325,
      sourceRewardExpPerMonster: 133,
      attackSpeedRaw: 115,
      movementSpeedRaw: 110,
      stageMultipliersPerThousand: {
        attackDamage: 470,
        maxLife: 1470,
        sourceRewardGoldPerMonster: 650,
        sourceRewardExpPerMonster: 3700,
      },
      bossMultipliersPerThousand: null,
      bossScaleRaw: null,
    });
  });

  test("rounds exact per-thousand ties to the nearest even integer", () => {
    expect(
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "monsters", 10011, { MaxLife: 45 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ).maxLife,
    ).toBe(4);
    expect(
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "monsters", 10011, { MaxLife: 55 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ).maxLife,
    ).toBe(6);

    const secondStepTie = withRowPatch(
      withRowPatch(
        withRowPatch(indexes, "monsters", 10022, { MaxLife: 10 }),
        "stage_levels",
        1,
        { MonsterHpMultiplier: 1000 },
      ),
      "stages",
      1101,
      { BossHpMultiplier: 250 },
    );
    expect(
      projectStageMonsterBaseStats(secondStepTie, {
        stageKey: 1101,
        monsterKey: 10022,
        role: "boss",
      }).maxLife,
    ).toBe(2);
  });

  test("projects every resolvable source encounter and rejects all eight dangling wave references", () => {
    let bossCount = 0;
    let waveCount = 0;
    let unresolvedCount = 0;
    for (const stage of indexes.tables.stages.rows) {
      const boss = projectStageMonsterBaseStats(indexes, {
        stageKey: stage.StageKey,
        monsterKey: stage.BossMonsterKey,
        role: "boss",
      });
      expect(boss.stageKey).toBe(stage.StageKey);
      expect(boss.monsterKey).toBe(stage.BossMonsterKey);
      bossCount += 1;

      if (stage.STAGETYPE !== "NORMAL") continue;
      for (const token of stage.Monsters!.split(" ")) {
        const monsterKey = Number(token.split("_")[0]);
        if (!indexes.tables.monsters.groups.has(monsterKey)) {
          expect(() =>
            projectStageMonsterBaseStats(indexes, {
              stageKey: stage.StageKey,
              monsterKey,
              role: "wave",
            }),
          ).toThrow(`monsters has no unique row for key ${monsterKey}`);
          unresolvedCount += 1;
          continue;
        }
        const wave = projectStageMonsterBaseStats(indexes, {
          stageKey: stage.StageKey,
          monsterKey,
          role: "wave",
        });
        expect(wave.stageKey).toBe(stage.StageKey);
        expect(wave.monsterKey).toBe(monsterKey);
        waveCount += 1;
      }
    }
    expect(bossCount).toBe(120);
    expect(waveCount).toBe(494);
    expect(unresolvedCount).toBe(8);
  });

  test("validates all 61 monsters and all 170 stage levels through controlled source references", () => {
    for (const monster of indexes.tables.monsters.rows) {
      const controlled = withRowPatch(indexes, "stages", 1101, {
        Monsters: `${monster.MonsterKey}_1000`,
      });
      const result = projectStageMonsterBaseStats(controlled, {
        stageKey: 1101,
        monsterKey: monster.MonsterKey,
        role: "wave",
      });
      expect(result.monsterKey).toBe(monster.MonsterKey);
    }
    for (const stageLevel of indexes.tables.stage_levels.rows) {
      const controlled = withRowPatch(indexes, "stages", 1101, {
        StageLevel: stageLevel.StageLevel,
      });
      const result = projectStageMonsterBaseStats(controlled, {
        stageKey: 1101,
        monsterKey: 10011,
        role: "wave",
      });
      expect(result.stageLevel).toBe(stageLevel.StageLevel);
    }
    expect(indexes.tables.monsters.rows).toHaveLength(61);
    expect(indexes.tables.stage_levels.rows).toHaveLength(170);
  });

  test("requires unique stage, stage-level, and monster source rows", () => {
    const stage = indexes.tables.stages.groups.get(1101)![0]!;
    const stageLevel = indexes.tables.stage_levels.groups.get(1)![0]!;
    const monster = indexes.tables.monsters.groups.get(10011)![0]!;
    for (const malformed of [
      withGroupRows(indexes, "stages", 1101, [stage, stage]),
      withGroupRows(indexes, "stage_levels", 1, [stageLevel, stageLevel]),
      withGroupRows(indexes, "monsters", 10011, [monster, monster]),
    ]) {
      expect(() =>
        projectStageMonsterBaseStats(malformed, {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        }),
      ).toThrow("has no unique row");
    }
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, { StageKey: 1102 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("stage group 1101 contains stage key 1102");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stage_levels", 1, { StageLevel: 2 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("stage-level group 1 contains stage level 2");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "monsters", 10011, { MonsterKey: 10012 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("monster group 10011 contains monster key 10012");
  });

  test("rejects non-record, array, and custom-prototype inputs before reading fields", () => {
    for (const input of [
      null,
      undefined,
      false,
      0,
      "stage",
      Symbol("stage"),
      1n,
      [],
      [1101, 10011, "wave"],
    ]) {
      expect(() =>
        projectStageMonsterBaseStats(indexes, input as never),
      ).toThrow("monster scaling input must be a plain object");
    }

    const inheritedStageKey = Object.assign(Object.create({ stageKey: 1101 }), {
      monsterKey: 10011,
      role: "wave",
    });
    const inheritedUnknown = Object.assign(Object.create({ forged: true }), {
      stageKey: 1101,
      monsterKey: 10011,
      role: "wave",
    });
    class CustomInput {
      stageKey = 1101;
      monsterKey = 10011;
      role = "wave";
    }
    for (const input of [
      inheritedStageKey,
      inheritedUnknown,
      new CustomInput(),
    ]) {
      expect(() =>
        projectStageMonsterBaseStats(indexes, input as never),
      ).toThrow(
        "monster scaling input prototype must be Object.prototype or null",
      );
    }
  });

  test("requires exactly three own string input fields while accepting a null prototype", () => {
    const missingStageKey = {
      monsterKey: 10011,
      role: "wave",
    };
    const missingMonsterKey = {
      stageKey: 1101,
      role: "wave",
    };
    const missingRole = {
      stageKey: 1101,
      monsterKey: 10011,
    };
    const nonEnumerableUnknown = {
      stageKey: 1101,
      monsterKey: 10011,
      role: "wave",
    };
    Object.defineProperty(nonEnumerableUnknown, "forged", {
      value: true,
      enumerable: false,
    });
    const unknownSymbol = Symbol("forged");
    const symbolUnknown = {
      stageKey: 1101,
      monsterKey: 10011,
      role: "wave",
      [unknownSymbol]: true,
    };

    for (const input of [missingStageKey, missingMonsterKey, missingRole]) {
      expect(() =>
        projectStageMonsterBaseStats(indexes, input as never),
      ).toThrow(
        "monster scaling input must contain exactly stageKey, monsterKey, and role as own string fields",
      );
    }
    expect(() =>
      projectStageMonsterBaseStats(indexes, nonEnumerableUnknown as never),
    ).toThrow("monster scaling input has unknown field forged");
    expect(() =>
      projectStageMonsterBaseStats(indexes, symbolUnknown as never),
    ).toThrow(
      "monster scaling input must contain exactly stageKey, monsterKey, and role as own string fields",
    );

    const nullPrototypeInput = Object.assign(Object.create(null), {
      stageKey: 1101,
      monsterKey: 10011,
      role: "wave",
    });
    expect(
      projectStageMonsterBaseStats(indexes, nullPrototypeInput).monsterKey,
    ).toBe(10011);
  });

  test("rejects invalid references, roles, and stage membership", () => {
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() =>
        projectStageMonsterBaseStats(indexes, {
          stageKey: value,
          monsterKey: 10011,
          role: "wave",
        }),
      ).toThrow("stage key must be a positive safe integer");
      expect(() =>
        projectStageMonsterBaseStats(indexes, {
          stageKey: 1101,
          monsterKey: value,
          role: "wave",
        }),
      ).toThrow("monster key must be a positive safe integer");
    }
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 999999,
        monsterKey: 10011,
        role: "wave",
      }),
    ).toThrow("stages has no unique row for key 999999");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 999999,
        role: "wave",
      }),
    ).toThrow("monsters has no unique row for key 999999");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, { StageLevel: 999999 }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("stage_levels has no unique row for key 999999");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10023,
        role: "wave",
      }),
    ).toThrow("is not one exact wave monster");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10011,
        role: "boss",
      }),
    ).toThrow("does not match boss monster 10022");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1110,
        monsterKey: 10901,
        role: "wave",
      }),
    ).toThrow("act-boss stage 1110 has no wave monsters");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1110,
        monsterKey: 10011,
        role: "boss",
      }),
    ).toThrow("monster 10011 does not match boss monster 10901");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, {
          Monsters: "10011_1000 10011_500",
        }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("has duplicate wave monster 10011");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, {
          Monsters: "10011_1000 10021_1000 10021_500",
        }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("has duplicate wave monster 10021");
    for (const Monsters of [null, "", "10011", "10011_0", "10011_1000 "]) {
      expect(() =>
        projectStageMonsterBaseStats(
          withRowPatch(indexes, "stages", 1101, { Monsters }),
          {
            stageKey: 1101,
            monsterKey: 10011,
            role: "wave",
          },
        ),
      ).toThrow("normal stage 1101 has invalid monster weights");
    }
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, {
          Monsters: `10011_${Number.MAX_SAFE_INTEGER + 1}`,
        }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("stage 1101 wave monster weight must be a positive safe integer");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1208,
        monsterKey: 20101,
        role: "wave",
      }),
    ).toThrow("monsters has no unique row for key 20101");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10011,
        role: "elite" as never,
      }),
    ).toThrow("monster role must be wave or boss");
    expect(() =>
      projectStageMonsterBaseStats(indexes, {
        stageKey: 1101,
        monsterKey: 10011,
        role: "wave",
        forged: true,
      } as never),
    ).toThrow("monster scaling input has unknown field forged");
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1101, {
          STAGETYPE: "UNKNOWN",
        }),
        {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        },
      ),
    ).toThrow("stage 1101 has unsupported type UNKNOWN");
  });

  test("rejects every invalid raw monster stat before scaling", () => {
    const fields = [
      "MaxLife",
      "AttackDamage",
      "RewardGold",
      "RewardExp",
      "AttackSpeed",
      "MovementSpeed",
    ] as const;
    const invalidValues = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    for (const field of fields) {
      for (const value of invalidValues) {
        expect(() =>
          projectStageMonsterBaseStats(
            withRowPatch(indexes, "monsters", 10011, { [field]: value }),
            {
              stageKey: 1101,
              monsterKey: 10011,
              role: "wave",
            },
          ),
        ).toThrow(`monster 10011 ${field} must be a positive safe integer`);
      }
    }
  });

  test("rejects every invalid stage and applicable boss multiplier", () => {
    const stageFields = [
      "MonsterAtkDmgMultiplier",
      "MonsterHpMultiplier",
      "MonsterGoldMultiplier",
      "MonsterExpMultiplier",
    ] as const;
    const bossFields = [
      "BossDamageMultiplier",
      "BossHpMultiplier",
      "BossGoldMultiplier",
      "BossExpMultiplier",
    ] as const;
    const invalidValues = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    for (const field of stageFields) {
      for (const value of invalidValues) {
        expect(() =>
          projectStageMonsterBaseStats(
            withRowPatch(indexes, "stage_levels", 1, { [field]: value }),
            {
              stageKey: 1101,
              monsterKey: 10011,
              role: "wave",
            },
          ),
        ).toThrow(`stage level 1 ${field} must be a positive safe integer`);
      }
    }
    for (const field of bossFields) {
      for (const value of invalidValues) {
        expect(() =>
          projectStageMonsterBaseStats(
            withRowPatch(indexes, "stages", 1101, { [field]: value }),
            {
              stageKey: 1101,
              monsterKey: 10022,
              role: "boss",
            },
          ),
        ).toThrow(`stage 1101 ${field} must be a positive safe integer`);
      }
    }
    for (const value of invalidValues) {
      for (const role of ["wave", "boss"] as const) {
        expect(() =>
          projectStageMonsterBaseStats(
            withRowPatch(indexes, "stages", 1101, { BossScale: value }),
            {
              stageKey: 1101,
              monsterKey: role === "wave" ? 10011 : 10022,
              role,
            },
          ),
        ).toThrow("stage 1101 BossScale must be a positive safe integer");
      }
    }
  });

  test("requires all act-boss boss multipliers to remain null", () => {
    for (const field of [
      "BossDamageMultiplier",
      "BossHpMultiplier",
      "BossGoldMultiplier",
      "BossExpMultiplier",
    ] as const) {
      expect(() =>
        projectStageMonsterBaseStats(
          withRowPatch(indexes, "stages", 1110, { [field]: 1000 }),
          {
            stageKey: 1110,
            monsterKey: 10901,
            role: "boss",
          },
        ),
      ).toThrow(`act-boss stage 1110 ${field} must be null`);
    }
    expect(() =>
      projectStageMonsterBaseStats(
        withRowPatch(indexes, "stages", 1110, { BossScale: 1 }),
        {
          stageKey: 1110,
          monsterKey: 10901,
          role: "boss",
        },
      ),
    ).toThrow("act-boss stage 1110 BossScale must be null");
  });

  test("rejects unsafe products for all four scaled fields before either sequential step", () => {
    for (const { rawField, stageField, bossField, label } of [
      {
        rawField: "MaxLife",
        stageField: "MonsterHpMultiplier",
        bossField: "BossHpMultiplier",
        label: "max life",
      },
      {
        rawField: "AttackDamage",
        stageField: "MonsterAtkDmgMultiplier",
        bossField: "BossDamageMultiplier",
        label: "attack damage",
      },
      {
        rawField: "RewardGold",
        stageField: "MonsterGoldMultiplier",
        bossField: "BossGoldMultiplier",
        label: "reward gold",
      },
      {
        rawField: "RewardExp",
        stageField: "MonsterExpMultiplier",
        bossField: "BossExpMultiplier",
        label: "reward EXP",
      },
    ] as const) {
      const firstStepOverflow = withRowPatch(
        withRowPatch(indexes, "monsters", 10011, {
          [rawField]: Number.MAX_SAFE_INTEGER,
        }),
        "stage_levels",
        1,
        { [stageField]: 2 },
      );
      expect(() =>
        projectStageMonsterBaseStats(firstStepOverflow, {
          stageKey: 1101,
          monsterKey: 10011,
          role: "wave",
        }),
      ).toThrow(
        `monster ${label} stage product exceeds the safe-integer range`,
      );

      const secondStepOverflow = withRowPatch(
        withRowPatch(
          withRowPatch(indexes, "monsters", 10022, {
            [rawField]: 1_000_000_000,
          }),
          "stage_levels",
          1,
          { [stageField]: 1000 },
        ),
        "stages",
        1101,
        { [bossField]: Number.MAX_SAFE_INTEGER },
      );
      expect(() =>
        projectStageMonsterBaseStats(secondStepOverflow, {
          stageKey: 1101,
          monsterKey: 10022,
          role: "boss",
        }),
      ).toThrow(`monster ${label} boss product exceeds the safe-integer range`);
    }
  });

  test("returns a detached frozen projection without mutating the catalog", () => {
    const before = structuredClone(
      indexes.tables.monsters.groups.get(10011)![0]!,
    );
    const input = Object.freeze({
      stageKey: 1101,
      monsterKey: 10011,
      role: "wave" as const,
    });
    const inputBefore = structuredClone(input);
    const result = projectStageMonsterBaseStats(indexes, input);
    const repeated = projectStageMonsterBaseStats(indexes, input);
    const boss = projectStageMonsterBaseStats(indexes, {
      stageKey: 1101,
      monsterKey: 10022,
      role: "boss",
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stageMultipliersPerThousand)).toBe(true);
    expect(result.bossMultipliersPerThousand).toBeNull();
    expect(Object.isFrozen(boss)).toBe(true);
    expect(Object.isFrozen(boss.stageMultipliersPerThousand)).toBe(true);
    expect(Object.isFrozen(boss.bossMultipliersPerThousand)).toBe(true);
    expect(repeated).toEqual(result);
    expect(repeated).not.toBe(result);
    expect(repeated.stageMultipliersPerThousand).not.toBe(
      result.stageMultipliersPerThousand,
    );
    expect(() => {
      (result as { maxLife: number }).maxLife = 999;
    }).toThrow();
    expect(() => {
      (
        result.stageMultipliersPerThousand as {
          attackDamage: number;
        }
      ).attackDamage = 999;
    }).toThrow();
    expect(() => {
      (
        boss.bossMultipliersPerThousand as {
          maxLife: number;
        }
      ).maxLife = 999;
    }).toThrow();
    expect(input).toEqual(inputBefore);
    expect(indexes.tables.monsters.groups.get(10011)![0]).toEqual(before);
  });
});
