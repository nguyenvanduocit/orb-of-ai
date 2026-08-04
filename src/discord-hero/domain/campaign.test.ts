import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { OracleRequiredError } from "./combat";
import {
  createCampaignGraph,
  getCampaignStage,
  rollPerThousand,
  simulateCampaignStage,
  stageEncounter,
} from "./campaign";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero source campaign graph", () => {
  test("preserves the exact 120-stage single chain from 1101 through 4310", () => {
    const graph = createCampaignGraph(indexes);
    const visited: number[] = [];
    let key: number | null = graph.rootStageKey;

    while (key !== null) {
      visited.push(key);
      key = getCampaignStage(graph, key).NextStageKey;
    }

    expect(graph.stages).toHaveLength(120);
    expect(graph.rootStageKey).toBe(1101);
    expect(graph.finalStageKey).toBe(4310);
    expect(visited).toEqual(
      indexes.tables.stages.rows.map((stage) => stage.StageKey),
    );
  });

  test("parses exact canonical normal-wave and boss metadata in source order", () => {
    expect(stageEncounter(indexes, { stageKey: 1101 })).toEqual({
      stageKey: 1101,
      stageLevel: 1,
      kind: "normal",
      waveAmount: 10,
      waveMonsterAmount: 1,
      waveMonsters: [
        { monsterKey: 10011, weight: 1000 },
        { monsterKey: 10021, weight: 1000 },
      ],
      unresolvedMonsterKeys: [],
      bossMonsterKey: 10022,
      monsterDrop: { dropKey: 910011, chancePerThousand: 160 },
      bossDrop: { dropKey: 920011, chancePerThousand: 1000 },
      firstClearDropKey: 9200010,
    });
    expect(stageEncounter(indexes, { stageKey: 1110 })).toEqual({
      stageKey: 1110,
      stageLevel: 12,
      kind: "act-boss",
      waveAmount: null,
      waveMonsterAmount: null,
      waveMonsters: [],
      unresolvedMonsterKeys: [],
      bossMonsterKey: 10901,
      monsterDrop: null,
      bossDrop: { dropKey: 930101, chancePerThousand: null },
      firstClearDropKey: null,
    });
  });

  test("rolls the proven /1000 stage chance with injected deterministic RNG", () => {
    expect(rollPerThousand(160, () => 0.159)).toBe(true);
    expect(rollPerThousand(160, () => 0.16)).toBe(false);
    expect(rollPerThousand(0, () => 0)).toBe(false);
    expect(rollPerThousand(1000, () => 0.999999)).toBe(true);
  });

  test("rejects invalid chance before consuming RNG", () => {
    let rngCalls = 0;
    expect(() =>
      rollPerThousand(1001, () => {
        rngCalls += 1;
        return 0;
      }),
    ).toThrow("chance must be a safe integer between 0 and 1000");
    expect(rngCalls).toBe(0);
  });

  test("fails closed on unresolved combat/reward ordering before RNG", () => {
    let rngCalls = 0;
    const state = Object.freeze({
      party: Object.freeze([101, 201, 301]),
      gold: 100,
    });
    const before = structuredClone(state);

    expect(() =>
      simulateCampaignStage({
        indexes,
        stageKey: 1101,
        state,
        rng: () => {
          rngCalls += 1;
          return 0;
        },
      }),
    ).toThrow(OracleRequiredError);
    expect(rngCalls).toBe(0);
    expect(state).toEqual(before);
  });

  test("preserves and reports exactly eight dangling 20101 references, then oracle-gates them before RNG", () => {
    const affected = indexes.tables.stages.rows
      .filter((stage) => stage.Monsters?.includes("20101_"))
      .map((stage) => stage.StageKey);

    expect(affected).toEqual([
      1208, 1209, 2208, 2209, 3208, 3209, 4208, 4209,
    ]);
    expect(stageEncounter(indexes, { stageKey: 1208 })).toMatchObject({
      stageKey: 1208,
      unresolvedMonsterKeys: [20101],
      waveMonsters: expect.arrayContaining([
        { monsterKey: 20101, weight: 1000 },
      ]),
    });

    let rngCalls = 0;
    expect(() =>
      simulateCampaignStage({
        indexes,
        stageKey: 1208,
        state: {},
        rng: () => {
          rngCalls += 1;
          return 0;
        },
      }),
    ).toThrow("stage 1208 references unresolved source monster key 20101");
    expect(rngCalls).toBe(0);
  });

  test("rejects forged stage, monster, drop, and boss keys at the stable-key boundary", () => {
    expect(() =>
      stageEncounter(indexes, {
        stageKey: 1101,
        Monsters: "999999_1000",
      }),
    ).toThrow("stage encounter input has unknown field Monsters");
    expect(() =>
      stageEncounter(indexes, {
        stageKey: 1101,
        MonsterDropItemKey: 999999,
      }),
    ).toThrow("stage encounter input has unknown field MonsterDropItemKey");
    expect(() =>
      stageEncounter(indexes, {
        stageKey: 1101,
        BossMonsterKey: 999999,
      }),
    ).toThrow("stage encounter input has unknown field BossMonsterKey");
    expect(stageEncounter(indexes, { stageKey: 1101 }).bossMonsterKey).toBe(
      10022,
    );
  });
});
