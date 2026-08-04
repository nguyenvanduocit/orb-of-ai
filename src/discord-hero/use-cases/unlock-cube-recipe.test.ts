import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRepository,
  DiscordHeroRevisionConflictError,
} from "../state/repository";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import { unlockDiscordHeroCubeRecipe } from "./unlock-cube-recipe";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
const temporaryDirectories: string[] = [];
const repositories: DiscordHeroRepository[] = [];

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-cube-unlock-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    legacyDirectory: directory,
  });
  repositories.push(store);
  return store;
}

function createPlayer(store: DiscordHeroRepository): void {
  store.transactPlayer({
    scope: "test",
    interactionId: "seed-123",
    operation: "seed",
    requestSha256: "a".repeat(64),
    userId: "123",
    expectedRevision: null,
    decodeOutcome: () => ({ kind: "seeded" }) as const,
    nowMs: 1_000,
    mutate: () => ({
      kind: "commit",
      state: createFreshPlayerStateFromCatalog(indexes, 101),
      outcome: { kind: "seeded" },
    }),
  });
}

afterEach(() => {
  for (const store of repositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("unlock DiscordHero Cube recipe transaction", () => {
  test("commits exact source cost once and replays duplicate interaction", () => {
    const store = repository();
    createPlayer(store);
    const input = {
      userId: "123",
      interactionId: "cube-unlock-1",
      expectedRevision: 1,
      cubeKey: 200001,
      nowMs: 2_000,
    };

    const applied = unlockDiscordHeroCubeRecipe(store, indexes, input);
    const replayed = unlockDiscordHeroCubeRecipe(store, indexes, input);

    expect(applied).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "unlocked",
        cubeKey: 200001,
        defaultSubRecipeKeys: [200011],
        recipeType: "ALCHEMY",
        cost: 10,
        gold: 90,
      },
    });
    expect(replayed).toEqual(applied);
    expect(store.getPlayer("123")).toMatchObject({
      revision: 2,
      state: {
        gold: 90,
        cube: {
          unlockedRecipes: [100001, 200001],
          unlockedSubRecipes: [100011, 200011],
        },
      },
    });
  });

  test("persists deterministic level rejection without changing state", () => {
    const store = repository();
    createPlayer(store);
    const result = unlockDiscordHeroCubeRecipe(store, indexes, {
      userId: "123",
      interactionId: "cube-unlock-locked",
      expectedRevision: 1,
      cubeKey: 600001,
      nowMs: 2_000,
    });

    expect(result).toEqual({
      status: "rejected",
      revision: 1,
      outcome: {
        kind: "level-locked",
        cubeKey: 600001,
        recipeType: "CRAFTING",
        requiredCubeLevel: 5,
        currentCubeLevel: 1,
      },
    });
    expect(store.getPlayer("123")?.revision).toBe(1);
  });

  test("binds request identity and rejects stale revisions", () => {
    const store = repository();
    createPlayer(store);
    unlockDiscordHeroCubeRecipe(store, indexes, {
      userId: "123",
      interactionId: "cube-unlock-1",
      expectedRevision: 1,
      cubeKey: 200001,
      nowMs: 2_000,
    });

    expect(() =>
      unlockDiscordHeroCubeRecipe(store, indexes, {
        userId: "123",
        interactionId: "cube-unlock-stale",
        expectedRevision: 1,
        cubeKey: 300001,
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);
    expect(() =>
      unlockDiscordHeroCubeRecipe(store, indexes, {
        userId: "123",
        interactionId: "cube-unlock-1",
        expectedRevision: 1,
        cubeKey: 300001,
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
  });
});
