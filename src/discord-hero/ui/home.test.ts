import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  buildCatalogIndexes,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import type { PlayerSnapshot } from "../state/repository";
import { projectDiscordHeroHome } from "./home";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function stackAsset(itemKey: number) {
  return { kind: "stack" as const, itemKey, quantity: Number.MAX_SAFE_INTEGER };
}

function firstStackItemKey(catalog: DiscordHeroCatalogIndexes): number {
  const item = catalog.tables.items.rows.find(
    (row) => row.deleted !== true && row.type !== "GEAR",
  );
  if (item === undefined) {
    throw new Error("test catalog has no stackable non-gear item");
  }
  return item.id;
}

function returningState(catalog: DiscordHeroCatalogIndexes): PlayerState {
  const state = structuredClone(createFreshPlayerStateFromCatalog(catalog));
  const itemKey = firstStackItemKey(catalog);

  state.gold = Number.MAX_SAFE_INTEGER;
  state.party = [101, null, 301];
  state.heroes[0]!.level = 10;
  state.heroes[0]!.xp = 7;
  state.heroes[1]!.level = 20;
  state.heroes[1]!.xp = 8;
  state.heroes[2]!.level = 30;
  state.heroes[2]!.xp = 9;
  state.containers.inventory.slots = Array.from(
    { length: state.containers.inventory.unlockedSlots },
    (_, index) => ({ index, asset: stackAsset(itemKey) }),
  );
  state.cube.level = 100;
  state.cube.xp = Number.MAX_SAFE_INTEGER;
  state.runes = [
    { key: 1, level: 1 },
    { key: 10, level: 1 },
    { key: 11, level: 1 },
    { key: 11001, level: 1 },
  ];
  state.offline = {
    accrualCursorMs: Number.MAX_SAFE_INTEGER,
    rewardStageLevel: 20,
  };
  state.campaign = {
    highestStageKey: 1208,
    stages: [
      {
        stageKey: 1208,
        clearCount: 7,
        firstClearClaimed: true,
        bestClearMs: 1_234,
      },
    ],
  };
  state.stageSession = {
    sessionId: `</session>${"x".repeat(118)}`,
    stageKey: 1208,
    party: [101, null, 301],
    startedAtMs: 10,
    advancedThroughMs: 20,
    wave: 5,
    rngSeed: `</seed>${"y".repeat(249)}`,
    rngCursor: Number.MAX_SAFE_INTEGER,
    pendingRewards: { gold: 0, xp: 0, items: [] },
  };

  return validatePlayerAgainstCatalog(state, catalog);
}

function maximumCatalogState(catalog: DiscordHeroCatalogIndexes): PlayerState {
  const state = structuredClone(createFreshPlayerStateFromCatalog(catalog));
  const itemKey = firstStackItemKey(catalog);
  const sourceHeroes = catalog.tables.heroes.rows;

  state.gold = Number.MAX_SAFE_INTEGER;
  state.party = [
    sourceHeroes[0]!.HeroKey,
    sourceHeroes[1]!.HeroKey,
    sourceHeroes[2]!.HeroKey,
  ];
  state.heroes = sourceHeroes.map((source) => ({
    heroKey: source.HeroKey,
    level: 100,
    xp: Number.MAX_SAFE_INTEGER,
    attributes: [],
    skills: [],
    passives: [],
    equipment: [],
    skins: [],
  }));

  for (const [containerName, datasetName] of [
    ["inventory", "inventory"],
    ["stash", "stash"],
    ["storage", "storage"],
    ["tradingStash", "trading_stash"],
  ] as const) {
    const size = catalog.tables[datasetName].rows.length;
    state.containers[containerName] = {
      unlockedSlots: size,
      slots: Array.from({ length: size }, (_, index) => ({
        index,
        asset: stackAsset(itemKey),
      })),
    };
  }

  state.cube = {
    level: 100,
    xp: Number.MAX_SAFE_INTEGER,
    unlockedRecipes: catalog.tables.cube_recipes.rows.map((row) => row.CubeKey),
    unlockedSubRecipes: catalog.tables.cube_sub_recipes.rows.map(
      (row) => row.CubeSubRecipeKey,
    ),
  };
  state.runes = catalog.tables.runes.rows.map((row) => ({
    key: row.RuneKey,
    level: row.MaxLevel,
  }));
  state.pets = {
    unlocked: catalog.tables.pets.rows.map((row) => row.PetKey),
    active: catalog.tables.pets.rows[0]!.PetKey,
  };
  state.skins = {
    unlocked: catalog.tables.skins.rows.map((row) => row.PcSkinKey),
  };
  state.offline = {
    accrualCursorMs: Number.MAX_SAFE_INTEGER,
    rewardStageLevel: catalog.tables.offline_rewards.rows.at(-1)!.StageLevel,
  };
  state.campaign = {
    highestStageKey: catalog.tables.stages.rows.at(-1)!.StageKey,
    stages: catalog.tables.stages.rows.map((row) => ({
      stageKey: row.StageKey,
      clearCount: Number.MAX_SAFE_INTEGER,
      firstClearClaimed: true,
      bestClearMs: Number.MAX_SAFE_INTEGER,
    })),
  };
  state.stageSession = {
    sessionId: "<".repeat(128),
    stageKey: 1208,
    party: state.party,
    startedAtMs: 0,
    advancedThroughMs: Number.MAX_SAFE_INTEGER,
    wave: Number.MAX_SAFE_INTEGER,
    rngSeed: ">".repeat(256),
    rngCursor: Number.MAX_SAFE_INTEGER,
    pendingRewards: { gold: 0, xp: 0, items: [] },
  };

  return validatePlayerAgainstCatalog(state, catalog);
}

describe("DiscordHero Home projection", () => {
  test("projects a fresh save from exact snapshot and source-backed catalog facts", () => {
    const snapshot: PlayerSnapshot = {
      revision: 1,
      state: createFreshPlayerStateFromCatalog(indexes),
    };

    expect(projectDiscordHeroHome(snapshot, indexes)).toEqual({
      revision: 1,
      gold: 100,
      heroes: [
        {
          heroKey: 101,
          name: "Knight",
          classType: "Knight",
          progression: {
            status: "progressing",
            level: 1,
            experience: 0,
            nextLevel: 2,
            experienceForLevelUp: 30,
            experienceRemaining: 30,
            progressPercent: 0,
          },
        },
        {
          heroKey: 201,
          name: "Ranger",
          classType: "Ranger",
          progression: {
            status: "progressing",
            level: 1,
            experience: 0,
            nextLevel: 2,
            experienceForLevelUp: 30,
            experienceRemaining: 30,
            progressPercent: 0,
          },
        },
        {
          heroKey: 301,
          name: "Sorcerer",
          classType: "Sorcerer",
          progression: {
            status: "progressing",
            level: 1,
            experience: 0,
            nextLevel: 2,
            experienceForLevelUp: 30,
            experienceRemaining: 30,
            progressPercent: 0,
          },
        },
      ],
      party: [
        {
          slot: 1,
          status: "occupied",
          hero: {
            heroKey: 101,
            name: "Knight",
            classType: "Knight",
            progression: {
              status: "progressing",
              level: 1,
              experience: 0,
              nextLevel: 2,
              experienceForLevelUp: 30,
              experienceRemaining: 30,
              progressPercent: 0,
            },
          },
        },
        {
          slot: 2,
          status: "occupied",
          hero: {
            heroKey: 201,
            name: "Ranger",
            classType: "Ranger",
            progression: {
              status: "progressing",
              level: 1,
              experience: 0,
              nextLevel: 2,
              experienceForLevelUp: 30,
              experienceRemaining: 30,
              progressPercent: 0,
            },
          },
        },
        {
          slot: 3,
          status: "occupied",
          hero: {
            heroKey: 301,
            name: "Sorcerer",
            classType: "Sorcerer",
            progression: {
              status: "progressing",
              level: 1,
              experience: 0,
              nextLevel: 2,
              experienceForLevelUp: 30,
              experienceRemaining: 30,
              progressPercent: 0,
            },
          },
        },
      ],
      inventory: { occupiedSlots: 0, unlockedSlots: 20, freeSlots: 20 },
      campaign: {
        status: "not-started",
        highestStage: null,
        recordedStageCount: 0,
      },
      stageSession: { status: "idle" },
      offline: {
        status: "locked",
        accrualCursorMs: 0,
        rewardStageLevel: 1,
        goldBonusPerThousand: 0,
        experienceBonusPerThousand: 0,
        creditedGold: 0,
        creditedExperience: 0,
      },
      alerts: [
        {
          kind: "cube-unlock-available",
          cubeKey: 200001,
          recipeType: "ALCHEMY",
          requiredCubeLevel: 1,
          cost: 10,
        },
      ],
    });
  });

  test("projects returning progress, active status, exact gates, and stable alerts", () => {
    const state = returningState(indexes);
    const snapshot = deepFreeze({
      revision: Number.MAX_SAFE_INTEGER,
      state,
    }) as PlayerSnapshot;
    const before = JSON.stringify(snapshot);

    const home = projectDiscordHeroHome(snapshot, indexes);

    expect(home.revision).toBe(Number.MAX_SAFE_INTEGER);
    expect(home.gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      home.heroes.map(({ name, progression }) => ({ name, progression })),
    ).toEqual([
      {
        name: "Knight",
        progression: {
          status: "progressing",
          level: 10,
          experience: 7,
          nextLevel: 11,
          experienceForLevelUp: 74_880,
          experienceRemaining: 74_873,
          progressPercent: 0,
        },
      },
      {
        name: "Ranger",
        progression: {
          status: "progressing",
          level: 20,
          experience: 8,
          nextLevel: 21,
          experienceForLevelUp: 3_064_410,
          experienceRemaining: 3_064_402,
          progressPercent: 0,
        },
      },
      {
        name: "Sorcerer",
        progression: {
          status: "progressing",
          level: 30,
          experience: 9,
          nextLevel: 31,
          experienceForLevelUp: 15_618_450,
          experienceRemaining: 15_618_441,
          progressPercent: 0,
        },
      },
    ]);
    expect(home.party[1]).toEqual({
      slot: 2,
      status: "empty",
      hero: null,
    });
    expect(home.inventory).toEqual({
      occupiedSlots: 20,
      unlockedSlots: 20,
      freeSlots: 0,
    });
    expect(home.campaign).toEqual({
      status: "progressed",
      highestStage: {
        stageKey: 1208,
        name: "Sacred Tomb",
        sourceLevel: 20,
        clearCount: 7,
        firstClearClaimed: true,
        bestClearMs: 1_234,
      },
      recordedStageCount: 1,
    });
    expect(home.stageSession).toEqual({
      status: "active",
      stageKey: 1208,
      name: "Sacred Tomb",
      wave: 5,
      startedAtMs: 10,
      advancedThroughMs: 20,
      rngCursor: Number.MAX_SAFE_INTEGER,
      pendingItemCount: 0,
    });
    expect(home.offline).toEqual({
      status: "requires-runtime-oracle",
      accrualCursorMs: Number.MAX_SAFE_INTEGER,
      rewardStageLevel: 20,
      goldBonusPerThousand: 0,
      experienceBonusPerThousand: 0,
      creditedGold: 0,
      creditedExperience: 0,
    });
    expect(home.alerts.map((alert) => alert.kind)).toEqual([
      "empty-party-slots",
      "inventory-full",
      "cube-unlock-available",
      "cube-unlock-available",
      "cube-unlock-available",
      "cube-unlock-available",
      "cube-unlock-available",
      "cube-unlock-available",
      "cube-unlock-available",
      "unresolved-stage-source",
    ]);
    expect(
      home.alerts
        .filter((alert) => alert.kind === "cube-unlock-available")
        .map((alert) => alert.cubeKey),
    ).toEqual([200001, 300001, 400001, 500001, 600001, 700001, 900001]);
    expect(home.alerts.at(-1)).toEqual({
      kind: "unresolved-stage-source",
      stageKey: 1208,
      missingMonsterKeys: [20101],
    });

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.state.gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(snapshot.state.heroes.map((hero) => hero.xp)).toEqual([7, 8, 9]);
    expect(snapshot.state.stageSession?.rngCursor).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(snapshot.state.stageSession?.rngSeed).toHaveLength(256);
    expect(JSON.stringify(home)).not.toContain("</session>");
    expect(JSON.stringify(home)).not.toContain("</seed>");
  });

  test("keeps output bounded for source-sized maximum collections and max strings", () => {
    const state = maximumCatalogState(indexes);
    const snapshot = deepFreeze({
      revision: Number.MAX_SAFE_INTEGER,
      state,
    }) as PlayerSnapshot;
    const before = JSON.stringify(snapshot);

    const home = projectDiscordHeroHome(snapshot, indexes);

    expect(home.heroes).toHaveLength(6);
    expect(home.heroes.map((hero) => hero.progression)).toEqual(
      Array.from({ length: 6 }, () => ({
        status: "max-level",
        level: 100,
        experience: Number.MAX_SAFE_INTEGER,
        terminalBarExperience: 1_997_771_834,
        progressPercent: 100,
      })),
    );
    for (const hero of home.heroes) {
      expect(hero.progression).not.toHaveProperty("nextLevel");
      expect(hero.progression).not.toHaveProperty("experienceRemaining");
    }
    expect(home.party).toHaveLength(3);
    expect(home.inventory).toEqual({
      occupiedSlots: 260,
      unlockedSlots: 260,
      freeSlots: 0,
    });
    expect(home.campaign.recordedStageCount).toBe(120);
    expect(home.campaign.highestStage?.stageKey).toBe(
      indexes.tables.stages.rows.at(-1)!.StageKey,
    );
    expect(home.alerts).toEqual([
      { kind: "inventory-full", occupiedSlots: 260, unlockedSlots: 260 },
      {
        kind: "unresolved-stage-source",
        stageKey: 1208,
        missingMonsterKeys: [20101],
      },
    ]);
    expect(JSON.stringify(home).length).toBeLessThan(8_000);
    expect(JSON.stringify(home)).not.toContain("<".repeat(128));
    expect(JSON.stringify(home)).not.toContain(">".repeat(256));
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  test("returns fresh deeply frozen data without state or catalog aliases", () => {
    const snapshot: PlayerSnapshot = {
      revision: 1,
      state: createFreshPlayerStateFromCatalog(indexes),
    };
    const first = projectDiscordHeroHome(snapshot, indexes);
    const second = projectDiscordHeroHome(snapshot, indexes);

    expect(first).not.toBe(second);
    expect(first.heroes).not.toBe(second.heroes);
    expect(first.heroes[0]).not.toBe(second.heroes[0]);
    expect(first.heroes[0]!.progression).not.toBe(
      second.heroes[0]!.progression,
    );
    expect(first.heroes[0]).not.toBe(snapshot.state.heroes[0]);
    expect(first.heroes[0]!.name).not.toBe(
      indexes.tables.heroes.rows[0] as unknown,
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.heroes)).toBe(true);
    expect(Object.isFrozen(first.heroes[0])).toBe(true);
    expect(Object.isFrozen(first.heroes[0]!.progression)).toBe(true);
    expect(Object.isFrozen(first.party[0]!.hero)).toBe(true);
    expect(first.party[0]!.hero?.progression).not.toBe(
      first.heroes[0]!.progression,
    );
    expect(first.party[0]!.hero?.progression).toEqual(
      first.heroes[0]!.progression,
    );
    expect(Object.isFrozen(first.alerts)).toBe(true);
    expect(() => {
      (first.heroes[0] as { name: string }).name = "forged";
    }).toThrow(TypeError);
    expect(() => {
      (first.alerts as unknown[]).push({ kind: "forged" });
    }).toThrow(TypeError);
    expect(snapshot.state.heroes[0]!.heroKey).toBe(101);
    expect(getLocalizedCatalogName(indexes, "heroes", 101, "en-US")).toBe(
      "Knight",
    );
  });

  test("fails closed on malformed snapshots and missing highest-stage progress", () => {
    const fresh = createFreshPlayerStateFromCatalog(indexes);
    expect(() =>
      projectDiscordHeroHome(
        { revision: 0, state: fresh } as PlayerSnapshot,
        indexes,
      ),
    ).toThrow("Home snapshot revision must be a positive safe integer");
    expect(() =>
      projectDiscordHeroHome(
        {
          revision: 1,
          state: {
            ...fresh,
            campaign: { highestStageKey: 1208, stages: [] },
          },
        },
        indexes,
      ),
    ).toThrow("campaign highestStageKey 1208 has no progress record");
    expect(() =>
      projectDiscordHeroHome(
        { revision: 1, state: { ...fresh, gold: -1 } },
        indexes,
      ),
    ).toThrow("player state does not match schema version 1");
  });

  test("has no repository or SQLite runtime dependency", async () => {
    const build = await Bun.build({
      entrypoints: [join(import.meta.dir, "home.ts")],
      target: "bun",
    });
    expect(build.success).toBe(true);
    const bundled = await build.outputs[0]!.text();

    expect(bundled).not.toContain("bun:sqlite");
    expect(bundled).not.toContain("state/repository");
    expect(bundled).not.toContain("globalFile");
  });
});
