import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  decodeDiscordHeroStageKey,
  decodeDiscordHeroStagePage,
  discordHeroStagePageCount,
  discordHeroStages,
  encodeDiscordHeroStagePage,
  projectDiscordHeroStageMonsterSourceRows,
} from "./world";
import * as worldModule from "./world";

type ExpectedAttackSource = Readonly<{
  skillKey: number | string;
  skillRefStatus: "resolved-exact" | "unresolved-exact-source-ref";
  activation: string;
  damageType: string;
  deliveryType: string;
  range: number;
  value: number | string;
  sound: number | string;
}>;

type ExpectedMonsterAttackKit = Readonly<{
  monsterKey: number;
  provenance:
    | Readonly<{ kind: "raw" }>
    | Readonly<{ kind: "pinned-enrichment"; sourceSha256: string }>;
  primaryAttack: ExpectedAttackSource;
  attacks: readonly ExpectedAttackSource[];
  attackElements: readonly string[];
}>;

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero World paging", () => {
  test("covers the exact 120-stage source chain in five bounded pages", () => {
    expect(discordHeroStagePageCount(indexes)).toBe(5);
    const pages = Array.from(
      { length: discordHeroStagePageCount(indexes) },
      (_, page) => discordHeroStages(indexes, page),
    );
    expect(pages.slice(0, -1).every((page) => page.length === 25)).toBe(true);
    expect(pages.at(-1)).toHaveLength(20);
    expect(pages.flat().map((stage) => stage.StageKey)).toEqual(
      indexes.tables.stages.rows.map((stage) => stage.StageKey),
    );
  });

  test("round-trips canonical pages and rejects page/key forgery", () => {
    expect(decodeDiscordHeroStagePage(encodeDiscordHeroStagePage(4))).toBe(4);
    expect(decodeDiscordHeroStageKey("4310")).toBe(4_310);
    expect(() => decodeDiscordHeroStagePage("w-04")).toThrow("non-canonical");
    expect(() => discordHeroStages(indexes, 5)).toThrow("outside");
    for (const value of ["0", "04310", "-1", "4e3", "9007199254740992"]) {
      expect(() => decodeDiscordHeroStageKey(value)).toThrow();
    }
  });

  test("projects canonical stage monster source rows with unresolved entries in place", () => {
    const pasture = projectDiscordHeroStageMonsterSourceRows(indexes, 1101);
    expect(
      pasture.map((row) => ({
        status: row.status,
        role: row.role,
        monsterKey: row.monsterKey,
        sourceWeightRaw: row.sourceWeightRaw,
        stats:
          row.stats === null
            ? null
            : {
                maxLife: row.stats.maxLife,
                attackDamage: row.stats.attackDamage,
                sourceRewardGoldPerMonster:
                  row.stats.sourceRewardGoldPerMonster,
                sourceRewardExpPerMonster: row.stats.sourceRewardExpPerMonster,
                attackSpeedRaw: row.stats.attackSpeedRaw,
                movementSpeedRaw: row.stats.movementSpeedRaw,
                bossScaleRaw: row.stats.bossScaleRaw,
              },
      })),
    ).toEqual([
      {
        status: "resolved",
        role: "wave",
        monsterKey: 10011,
        sourceWeightRaw: 1000,
        stats: {
          maxLife: 5,
          attackDamage: 1,
          sourceRewardGoldPerMonster: 1,
          sourceRewardExpPerMonster: 1,
          attackSpeedRaw: 40,
          movementSpeedRaw: 110,
          bossScaleRaw: null,
        },
      },
      {
        status: "resolved",
        role: "wave",
        monsterKey: 10021,
        sourceWeightRaw: 1000,
        stats: {
          maxLife: 4,
          attackDamage: 2,
          sourceRewardGoldPerMonster: 1,
          sourceRewardExpPerMonster: 1,
          attackSpeedRaw: 50,
          movementSpeedRaw: 170,
          bossScaleRaw: null,
        },
      },
      {
        status: "resolved",
        role: "boss",
        monsterKey: 10022,
        sourceWeightRaw: null,
        stats: {
          maxLife: 12,
          attackDamage: 2,
          sourceRewardGoldPerMonster: 4,
          sourceRewardExpPerMonster: 6,
          attackSpeedRaw: 110,
          movementSpeedRaw: 280,
          bossScaleRaw: 3,
        },
      },
    ]);

    const actBoss = projectDiscordHeroStageMonsterSourceRows(indexes, 1110);
    expect(actBoss).toHaveLength(1);
    expect(actBoss[0]).toMatchObject({
      status: "resolved",
      role: "boss",
      monsterKey: 10901,
      sourceWeightRaw: null,
      stats: {
        maxLife: 1544,
        attackDamage: 24,
        sourceRewardGoldPerMonster: 325,
        sourceRewardExpPerMonster: 133,
        attackSpeedRaw: 115,
        movementSpeedRaw: 110,
        bossScaleRaw: null,
      },
    });

    const blocked = projectDiscordHeroStageMonsterSourceRows(indexes, 1208);
    expect(
      blocked.map((row) => [
        row.role,
        row.monsterKey,
        row.status,
        row.sourceWeightRaw,
      ]),
    ).toEqual([
      ["wave", 20061, "resolved", 1000],
      ["wave", 20062, "resolved", 1000],
      ["wave", 20091, "resolved", 200],
      ["wave", 20101, "unresolved-source-row", 1000],
      ["wave", 20071, "resolved", 1000],
      ["boss", 20061, "resolved", null],
    ]);
    expect(blocked[3]!.stats).toBeNull();
    expect(blocked[0]!.stats).toMatchObject({
      maxLife: 744,
      attackDamage: 14,
      sourceRewardGoldPerMonster: 24,
      sourceRewardExpPerMonster: 299,
    });
    expect(blocked[5]!.stats).toMatchObject({
      maxLife: 4464,
      attackDamage: 42,
      sourceRewardGoldPerMonster: 72,
      sourceRewardExpPerMonster: 4485,
    });

    const unresolved: Array<{
      stageKey: number;
      monsterKey: number;
    }> = [];
    for (const stage of indexes.tables.stages.rows) {
      const rows = projectDiscordHeroStageMonsterSourceRows(
        indexes,
        stage.StageKey,
      );
      expect(rows.at(-1)?.role).toBe("boss");
      for (const row of rows) {
        expect(Object.isFrozen(row)).toBe(true);
        if (row.status === "unresolved-source-row") {
          unresolved.push({
            stageKey: stage.StageKey,
            monsterKey: row.monsterKey,
          });
        }
      }
    }
    expect(unresolved).toEqual(
      [1208, 1209, 2208, 2209, 3208, 3209, 4208, 4209].map((stageKey) => ({
        stageKey,
        monsterKey: 20101,
      })),
    );
    expect(Object.isFrozen(pasture)).toBe(true);
    expect(Object.isFrozen(pasture[0]!.stats)).toBe(true);
    const repeated = projectDiscordHeroStageMonsterSourceRows(indexes, 1101);
    expect(repeated).toEqual(pasture);
    expect(repeated).not.toBe(pasture);
    expect(repeated[0]).not.toBe(pasture[0]);
    expect(repeated[0]!.stats).not.toBe(pasture[0]!.stats);
  });
});

describe("DiscordHero source route projection", () => {
  type ExpectedRouteEntry = Readonly<{
    stageKey: number;
    routeIndex: number;
    previousStageKey: number | null;
    nextStageKey: number | null;
    sourceAct: number;
    sourceStageNo: number;
    isRouteStart: boolean;
    isRouteEnd: boolean;
    isActStart: boolean;
    isActEnd: boolean;
  }>;

  const projectRoute = (
    sourceIndexes: DiscordHeroCatalogIndexes,
  ): readonly ExpectedRouteEntry[] => {
    const projector = (
      worldModule as Partial<{
        projectDiscordHeroSourceRoute: (
          indexes: DiscordHeroCatalogIndexes,
        ) => readonly ExpectedRouteEntry[];
      }>
    ).projectDiscordHeroSourceRoute;
    expect(typeof projector).toBe("function");
    if (projector === undefined) {
      throw new Error("missing source route projector");
    }
    return projector(sourceIndexes);
  };

  const routeEntry = (
    sourceIndexes: DiscordHeroCatalogIndexes,
    stageKey: number,
  ): ExpectedRouteEntry => {
    const reader = (
      worldModule as Partial<{
        discordHeroRouteEntry: (
          indexes: DiscordHeroCatalogIndexes,
          stageKey: number,
        ) => ExpectedRouteEntry;
      }>
    ).discordHeroRouteEntry;
    expect(typeof reader).toBe("function");
    if (reader === undefined) {
      throw new Error("missing source route entry reader");
    }
    return reader(sourceIndexes, stageKey);
  };

  // Breaks caught: ordering taken from anything but the source NextStageKey
  // chain, a truncated walk, or wrong route endpoints.
  test("walks all 120 source stages in NextStageKey order from 1101 to 4310", () => {
    const route = projectRoute(indexes);

    expect(route).toHaveLength(120);
    expect(route[0]?.stageKey).toBe(1101);
    expect(route[119]?.stageKey).toBe(4310);
    expect(route.slice(0, 10).map((entry) => entry.stageKey)).toEqual([
      1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110,
    ]);
    expect(route.slice(-10).map((entry) => entry.stageKey)).toEqual([
      4301, 4302, 4303, 4304, 4305, 4306, 4307, 4308, 4309, 4310,
    ]);
    expect(route.every((entry, index) => entry.routeIndex === index)).toBe(
      true,
    );
    expect(new Set(route.map((entry) => entry.stageKey)).size).toBe(120);
    expect(route.filter((entry) => entry.isRouteStart)).toHaveLength(1);
    expect(route.filter((entry) => entry.isRouteEnd)).toHaveLength(1);
  });

  // Break caught: off-by-one or swapped neighbour links, and non-null
  // neighbours leaking past the route ends.
  test("links each route entry to its exact previous and next source stage", () => {
    const route = projectRoute(indexes);
    const at = (stageKey: number) =>
      route.find((entry) => entry.stageKey === stageKey);

    expect(at(1101)).toMatchObject({
      routeIndex: 0,
      previousStageKey: null,
      nextStageKey: 1102,
      isRouteStart: true,
      isRouteEnd: false,
    });
    expect(at(1110)).toMatchObject({
      routeIndex: 9,
      previousStageKey: 1109,
      nextStageKey: 1201,
    });
    expect(at(1208)).toMatchObject({
      routeIndex: 17,
      previousStageKey: 1207,
      nextStageKey: 1209,
    });
    expect(at(4310)).toMatchObject({
      routeIndex: 119,
      previousStageKey: 4309,
      nextStageKey: null,
      isRouteStart: false,
      isRouteEnd: true,
    });
    expect(
      route.every(
        (entry, index) =>
          entry.previousStageKey ===
            (index === 0 ? null : route[index - 1]!.stageKey) &&
          entry.nextStageKey ===
            (index === 119 ? null : route[index + 1]!.stageKey),
      ),
    ).toBe(true);
  });

  // Break caught: act boundaries inferred from the stage-key prefix (which
  // would yield 4 segments) instead of a change in the source Act column
  // (which yields 12).
  test("flags exactly the twelve source act starts and ends", () => {
    const route = projectRoute(indexes);

    expect(
      route.filter((entry) => entry.isActStart).map((entry) => entry.stageKey),
    ).toEqual([
      1101, 1201, 1301, 2101, 2201, 2301, 3101, 3201, 3301, 4101, 4201, 4301,
    ]);
    expect(
      route.filter((entry) => entry.isActEnd).map((entry) => entry.stageKey),
    ).toEqual([
      1110, 1210, 1310, 2110, 2210, 2310, 3110, 3210, 3310, 4110, 4210, 4310,
    ]);
  });

  // Break caught: label fields silently swapped or re-derived from the key.
  test("carries the exact source act and stage numbers", () => {
    expect(routeEntry(indexes, 1101)).toMatchObject({
      sourceAct: 1,
      sourceStageNo: 1,
    });
    expect(routeEntry(indexes, 1110)).toMatchObject({
      sourceAct: 1,
      sourceStageNo: 10,
      isActEnd: true,
      isActStart: false,
    });
    expect(routeEntry(indexes, 1208)).toMatchObject({
      sourceAct: 2,
      sourceStageNo: 8,
    });
    expect(routeEntry(indexes, 4310)).toMatchObject({
      sourceAct: 3,
      sourceStageNo: 10,
    });
    expect(new Set(projectRoute(indexes).map((e) => e.sourceAct))).toEqual(
      new Set([1, 2, 3]),
    );
  });

  // Break caught: the projection aliasing catalog rows or returning a shared
  // mutable array that a caller could edit.
  test("returns detached deeply frozen route entries", () => {
    const catalogBefore = JSON.stringify(indexes.catalog);
    const first = projectRoute(indexes);
    const second = projectRoute(indexes);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(() => {
      (first as ExpectedRouteEntry[]).push(first[0]!);
    }).toThrow(TypeError);
    expect(JSON.stringify(indexes.catalog)).toBe(catalogBefore);
  });

  // Break caught: missing validation letting an unknown or forged stage key
  // resolve to a neighbouring entry instead of failing closed.
  test("fails closed for stage keys that are not on the source route", () => {
    // Resolve the reader first so a missing projector fails this test instead
    // of satisfying the toThrow below.
    const reader = (
      worldModule as Partial<{
        discordHeroRouteEntry: (
          indexes: DiscordHeroCatalogIndexes,
          stageKey: number,
        ) => ExpectedRouteEntry;
      }>
    ).discordHeroRouteEntry;
    expect(typeof reader).toBe("function");
    if (reader === undefined) {
      throw new Error("missing source route entry reader");
    }

    expect(reader(indexes, 1101).stageKey).toBe(1101);
    for (const stageKey of [1111, 0, -1, 1.5, 999999]) {
      expect(() => reader(indexes, stageKey)).toThrow();
    }
  });
});

describe("DiscordHero Monster Attack-Kit source projection", () => {
  const projectAttackKits = (
    sourceIndexes: DiscordHeroCatalogIndexes,
  ): readonly ExpectedMonsterAttackKit[] => {
    const projector = (
      worldModule as Partial<{
        projectDiscordHeroMonsterAttackKits: (
          indexes: DiscordHeroCatalogIndexes,
        ) => readonly ExpectedMonsterAttackKit[];
      }>
    ).projectDiscordHeroMonsterAttackKits;
    expect(typeof projector).toBe("function");
    if (projector === undefined) {
      throw new Error("missing Monster Attack-Kit source projector");
    }
    return projector(sourceIndexes);
  };

  test("projects the exact complete 61-kit corpus without normalizing source refs", () => {
    const skillsBefore = JSON.stringify(indexes.tables.skills.rows);
    const catalogBefore = JSON.stringify(indexes.catalog);
    const kits = projectAttackKits(indexes);
    const attacks = kits.flatMap((kit) => kit.attacks);

    expect(kits).toHaveLength(61);
    expect(kits.map((kit) => kit.monsterKey)).toEqual(
      indexes.tables.monsters.rows.map((monster) => monster.MonsterKey),
    );
    expect(Object.groupBy(kits, (kit) => kit.provenance.kind)).toMatchObject({
      raw: { length: 28 },
      "pinned-enrichment": { length: 33 },
    });
    expect(attacks).toHaveLength(91);
    expect(
      Object.fromEntries(
        Object.entries(
          Object.groupBy(kits, (kit) => String(kit.attacks.length)),
        ).map(([size, rows]) => [size, rows?.length]),
      ),
    ).toEqual({ "1": 49, "2": 3, "3": 3, "4": 3, "5": 3 });
    expect(
      Object.fromEntries(
        Object.entries(
          Object.groupBy(attacks, (attack) => attack.activation),
        ).map(([activation, rows]) => [activation, rows?.length]),
      ),
    ).toEqual({
      BASEATTACK: 61,
      BASEATTACK_COUNT: 7,
      COOLDOWN: 23,
    });
    expect(
      Object.fromEntries(
        Object.entries(
          Object.groupBy(attacks, (attack) => attack.damageType),
        ).map(([damageType, rows]) => [damageType, rows?.length]),
      ),
    ).toEqual({
      Physical: 66,
      Chaos: 15,
      Fire: 7,
      Cold: 2,
      Lightning: 1,
    });
    expect(
      Object.fromEntries(
        Object.entries(
          Object.groupBy(attacks, (attack) => attack.skillRefStatus),
        ).map(([status, rows]) => [status, rows?.length]),
      ),
    ).toEqual({
      "resolved-exact": 58,
      "unresolved-exact-source-ref": 33,
    });

    const raw = kits.find((kit) => kit.monsterKey === 10904);
    expect(raw).toEqual({
      monsterKey: 10904,
      provenance: { kind: "raw" },
      primaryAttack: {
        skillKey: 109011,
        skillRefStatus: "resolved-exact",
        activation: "BASEATTACK",
        damageType: "Physical",
        deliveryType: "",
        range: 300,
        value: 1000,
        sound: "11090111",
      },
      attacks: [
        {
          skillKey: 109011,
          skillRefStatus: "resolved-exact",
          activation: "BASEATTACK",
          damageType: "Physical",
          deliveryType: "",
          range: 300,
          value: 1000,
          sound: "11090111",
        },
        {
          skillKey: 109021,
          skillRefStatus: "resolved-exact",
          activation: "BASEATTACK_COUNT",
          damageType: "Physical",
          deliveryType: "",
          range: 450,
          value: 1500,
          sound: "11090211",
        },
        {
          skillKey: 109031,
          skillRefStatus: "resolved-exact",
          activation: "COOLDOWN",
          damageType: "Physical",
          deliveryType: "",
          range: 700,
          value: 1500,
          sound: "11090311",
        },
        {
          skillKey: 109041,
          skillRefStatus: "resolved-exact",
          activation: "COOLDOWN",
          damageType: "Physical",
          deliveryType: "",
          range: 300,
          value: 1500,
          sound: "11090411",
        },
        {
          skillKey: 109051,
          skillRefStatus: "resolved-exact",
          activation: "COOLDOWN",
          damageType: "Physical",
          deliveryType: "",
          range: 700,
          value: 1500,
          sound: "11090511",
        },
      ],
      attackElements: ["Physical"],
    });

    const enriched = kits.find((kit) => kit.monsterKey === 20011);
    expect(enriched).toEqual({
      monsterKey: 20011,
      provenance: {
        kind: "pinned-enrichment",
        sourceSha256:
          "f0d1a3d78f359d7b9cd473f1ce898671facde5d0e1a2485c72621dc9a41926e7",
      },
      primaryAttack: {
        skillKey: 200111,
        skillRefStatus: "unresolved-exact-source-ref",
        activation: "BASEATTACK",
        damageType: "Physical",
        deliveryType: "",
        range: 150,
        value: 1000,
        sound: "12001111",
      },
      attacks: [
        {
          skillKey: 200111,
          skillRefStatus: "unresolved-exact-source-ref",
          activation: "BASEATTACK",
          damageType: "Physical",
          deliveryType: "",
          range: 150,
          value: 1000,
          sound: "12001111",
        },
      ],
      attackElements: ["Physical"],
    });
    expect(indexes.tables.skills.groups.get(200111)).toBeUndefined();
    expect(indexes.tables.skills.groups.get("200111 ")).toHaveLength(1);

    const heroSkills = indexes.tables.skills.rows.filter(
      (skill) => typeof skill.SkillKey === "number" && skill.SkillKey < 100_000,
    );
    const monsterSkills = indexes.tables.skills.rows.filter(
      (skill) =>
        typeof skill.SkillKey === "string" || skill.SkillKey >= 100_000,
    );
    expect(heroSkills).toHaveLength(42);
    expect(monsterSkills).toHaveLength(64);
    expect(JSON.stringify(indexes.tables.skills.rows)).toBe(skillsBefore);
    expect(JSON.stringify(indexes.catalog)).toBe(catalogBefore);
  });

  test("returns detached deeply frozen source facts", () => {
    const first = projectAttackKits(indexes);
    const second = projectAttackKits(indexes);
    const rawSource = indexes.tables.monsters.rows.find(
      (monster) => monster.MonsterKey === 10904,
    );
    expect(rawSource).toBeDefined();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first.every((kit) => Object.isFrozen(kit))).toBe(true);
    expect(first.every((kit) => Object.isFrozen(kit.provenance))).toBe(true);
    expect(first.every((kit) => Object.isFrozen(kit.primaryAttack))).toBe(true);
    expect(first.every((kit) => Object.isFrozen(kit.attacks))).toBe(true);
    expect(
      first.every(
        (kit) =>
          kit.attacks.every((attack) => Object.isFrozen(attack)) &&
          Object.isFrozen(kit.attackElements),
      ),
    ).toBe(true);
    expect(
      first.find((kit) => kit.monsterKey === 10904)?.primaryAttack,
    ).not.toBe(rawSource?.attack);
    expect(first.find((kit) => kit.monsterKey === 10904)?.attacks).not.toBe(
      rawSource?.attacks,
    );
  });

  test("fails closed for partial raw kits, malformed attacks, and wrong enrichment keys", () => {
    const rawRow = indexes.tables.monsters.rows.find(
      (monster) => monster.MonsterKey === 10011,
    );
    expect(rawRow?.attack).toBeDefined();
    expect(rawRow?.attacks).toBeDefined();
    const partialRows = indexes.tables.monsters.rows.map((monster) =>
      monster.MonsterKey === 10011
        ? Object.freeze({ ...monster, attacks: undefined })
        : monster,
    );
    const partialIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        monsters: {
          ...indexes.tables.monsters,
          rows: partialRows,
        },
      },
    } as DiscordHeroCatalogIndexes;
    expect(() => projectAttackKits(partialIndexes)).toThrow(
      "partial raw attack-kit",
    );

    const malformedRows = indexes.tables.monsters.rows.map((monster) =>
      monster.MonsterKey === 10011
        ? Object.freeze({
            ...monster,
            attack: Object.freeze({
              ...monster.attack,
              range: Number.NaN,
            }),
          })
        : monster,
    );
    const malformedIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        monsters: {
          ...indexes.tables.monsters,
          rows: malformedRows,
        },
      },
    } as DiscordHeroCatalogIndexes;
    expect(() => projectAttackKits(malformedIndexes)).toThrow(
      "malformed attack",
    );

    const firstEnrichment =
      indexes.catalog.semantic.monsterAttacks.enrichments[0]!;
    const wrongKeyIndexes = {
      ...indexes,
      catalog: {
        ...indexes.catalog,
        semantic: {
          ...indexes.catalog.semantic,
          monsterAttacks: {
            ...indexes.catalog.semantic.monsterAttacks,
            enrichments: [
              Object.freeze({
                ...firstEnrichment,
                MonsterKey: firstEnrichment.MonsterKey + 1,
              }),
              ...indexes.catalog.semantic.monsterAttacks.enrichments.slice(1),
            ],
          },
        },
      },
    } as DiscordHeroCatalogIndexes;
    expect(() => projectAttackKits(wrongKeyIndexes)).toThrow(
      "enrichment primary key",
    );
  });
});
