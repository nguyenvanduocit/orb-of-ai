import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";
import { quoteCubeRecipeUnlock, unlockCubeRecipe } from "./cube-unlocks";

let indexes: DiscordHeroCatalogIndexes;
let fresh: PlayerState;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  fresh = createFreshPlayerStateFromCatalog(indexes, 101);
});

describe("DiscordHero source-backed Cube recipe unlocks", () => {
  test("quotes exact default, level gate and one-time source cost", () => {
    expect(quoteCubeRecipeUnlock(indexes, fresh, 100001)).toEqual({
      kind: "already-unlocked",
      cubeKey: 100001,
      recipeType: "SYNTHESIS",
    });
    expect(quoteCubeRecipeUnlock(indexes, fresh, 200001)).toEqual({
      kind: "available",
      cubeKey: 200001,
      defaultSubRecipeKeys: [200011],
      recipeType: "ALCHEMY",
      requiredCubeLevel: 1,
      cost: 10,
      canAfford: true,
    });
    expect(quoteCubeRecipeUnlock(indexes, fresh, 600001)).toEqual({
      kind: "level-locked",
      cubeKey: 600001,
      recipeType: "CRAFTING",
      requiredCubeLevel: 5,
      currentCubeLevel: 1,
    });
  });

  test("covers all eight source operations and exact main unlock gates", () => {
    const state = structuredClone(fresh);
    state.gold = 1_000_000;
    state.cube.level = 100;
    const quotes = indexes.tables.cube_recipes.rows.map((recipe) =>
      quoteCubeRecipeUnlock(indexes, state, recipe.CubeKey),
    );

    expect(quotes).toEqual([
      {
        kind: "already-unlocked",
        cubeKey: 100001,
        recipeType: "SYNTHESIS",
      },
      {
        kind: "available",
        cubeKey: 200001,
        defaultSubRecipeKeys: [200011],
        recipeType: "ALCHEMY",
        requiredCubeLevel: 1,
        cost: 10,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 300001,
        defaultSubRecipeKeys: [300011],
        recipeType: "DECORATION",
        requiredCubeLevel: 8,
        cost: 300,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 400001,
        defaultSubRecipeKeys: [400011],
        recipeType: "ENGRAVING",
        requiredCubeLevel: 15,
        cost: 1_000,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 500001,
        defaultSubRecipeKeys: [500011],
        recipeType: "INSCRIPTION",
        requiredCubeLevel: 25,
        cost: 10_000,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 600001,
        defaultSubRecipeKeys: [600011],
        recipeType: "CRAFTING",
        requiredCubeLevel: 5,
        cost: 100,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 700001,
        defaultSubRecipeKeys: [
          700011, 700021, 700031, 700041, 700051, 700061, 700071, 700081,
          700091, 700101,
        ],
        recipeType: "OFFERING",
        requiredCubeLevel: 20,
        cost: 3_000,
        canAfford: true,
      },
      {
        kind: "available",
        cubeKey: 900001,
        defaultSubRecipeKeys: [900011],
        recipeType: "EXTRACTION",
        requiredCubeLevel: 10,
        cost: 1_000,
        canAfford: true,
      },
    ]);
  });

  test("pays once, unlocks the main and default sub-recipe, and stays immutable", () => {
    const original = structuredClone(fresh);
    const result = unlockCubeRecipe(indexes, fresh, 200001);

    expect(result).toEqual({
      kind: "unlocked",
      cubeKey: 200001,
      defaultSubRecipeKeys: [200011],
      recipeType: "ALCHEMY",
      cost: 10,
      state: expect.objectContaining({
        gold: 90,
        cube: {
          level: 1,
          xp: 0,
          unlockedRecipes: [100001, 200001],
          unlockedSubRecipes: [100011, 200011],
        },
      }),
    });
    expect(fresh).toEqual(original);
  });

  test("unlocks all ten source-default Offering sub-recipes for one main cost", () => {
    const state = structuredClone(fresh);
    state.cube.level = 20;
    state.gold = 3_000;

    const result = unlockCubeRecipe(indexes, state, 700001);
    expect(result).toMatchObject({
      kind: "unlocked",
      cubeKey: 700001,
      defaultSubRecipeKeys: [
        700011, 700021, 700031, 700041, 700051, 700061, 700071, 700081, 700091,
        700101,
      ],
      recipeType: "OFFERING",
      cost: 3_000,
      state: {
        gold: 0,
        cube: {
          unlockedRecipes: [100001, 700001],
          unlockedSubRecipes: [
            100011, 700011, 700021, 700031, 700041, 700051, 700061, 700071,
            700081, 700091, 700101,
          ],
        },
      },
    });
  });

  test("rejects insufficient gold and invalid source keys without mutation", () => {
    const poor = structuredClone(fresh);
    poor.gold = 9;
    const original = structuredClone(poor);

    expect(unlockCubeRecipe(indexes, poor, 200001)).toEqual({
      kind: "insufficient-gold",
      cubeKey: 200001,
      recipeType: "ALCHEMY",
      requiredCubeLevel: 1,
      cost: 10,
      availableGold: 9,
    });
    expect(poor).toEqual(original);
    expect(() => quoteCubeRecipeUnlock(indexes, fresh, 999999)).toThrow(
      "cube_recipes has no unique row for key 999999",
    );
  });
});
