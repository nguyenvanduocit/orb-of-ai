import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import type { PlayerState } from "./player";

interface CubeRecipeSource {
  readonly CubeKey: number;
  readonly RECIPETYPE: string;
  readonly Index: number;
  readonly IsDefaultUnlocked: boolean | null;
}

interface CubeSubRecipeSource {
  readonly CubeSubRecipeKey: number;
  readonly RECIPETYPE: string;
  readonly DefaultUnlockWhenMainRecipeOpen: boolean | null;
  readonly UnlockCubeLevel: number;
  readonly UnlockCost: number | null;
}

export type CubeRecipeUnlockQuote =
  | {
      kind: "already-unlocked";
      cubeKey: number;
      recipeType: string;
    }
  | {
      kind: "level-locked";
      cubeKey: number;
      recipeType: string;
      requiredCubeLevel: number;
      currentCubeLevel: number;
    }
  | {
      kind: "available";
      cubeKey: number;
      defaultSubRecipeKeys: readonly number[];
      recipeType: string;
      requiredCubeLevel: number;
      cost: number;
      canAfford: boolean;
    };

export type CubeRecipeUnlockResult =
  | {
      kind: "unlocked";
      cubeKey: number;
      defaultSubRecipeKeys: readonly number[];
      recipeType: string;
      cost: number;
      state: PlayerState;
    }
  | {
      kind: "insufficient-gold";
      cubeKey: number;
      recipeType: string;
      requiredCubeLevel: number;
      cost: number;
      availableGold: number;
    }
  | Extract<
      CubeRecipeUnlockQuote,
      { kind: "already-unlocked" | "level-locked" }
    >;

function requireSafeNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function sourceRecipe(
  indexes: DiscordHeroCatalogIndexes,
  cubeKey: number,
): CubeRecipeSource {
  return getCatalogRow(indexes, "cube_recipes", cubeKey) as CubeRecipeSource;
}

function defaultSubRecipes(
  indexes: DiscordHeroCatalogIndexes,
  recipeType: string,
): {
  rows: readonly CubeSubRecipeSource[];
  requiredCubeLevel: number;
  cost: number;
} {
  const matches = indexes.tables.cube_sub_recipes.rows.filter(
    (row) =>
      row.RECIPETYPE === recipeType &&
      row.DefaultUnlockWhenMainRecipeOpen === true,
  );
  if (matches.length === 0) {
    throw new Error(
      `Cube recipe type ${recipeType} has no default sub-recipes`,
    );
  }
  const typed = matches as readonly CubeSubRecipeSource[];
  const requiredLevels = new Set(typed.map((row) => row.UnlockCubeLevel));
  if (requiredLevels.size !== 1) {
    throw new Error(
      `Cube recipe type ${recipeType} default sub-recipes disagree on unlock level`,
    );
  }
  const costs = typed
    .map((row) => row.UnlockCost)
    .filter((cost): cost is number => cost !== null);
  if (costs.length !== 1) {
    throw new Error(
      `Cube recipe type ${recipeType} has ${costs.length} main unlock costs; expected 1`,
    );
  }
  return {
    rows: typed,
    requiredCubeLevel: typed[0]!.UnlockCubeLevel,
    cost: costs[0]!,
  };
}

export function quoteCubeRecipeUnlock(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  cubeKey: number,
): CubeRecipeUnlockQuote {
  const recipe = sourceRecipe(indexes, cubeKey);
  requireSafeNonNegativeInteger(state.gold, "DiscordHero gold");
  if (
    !Number.isSafeInteger(state.cube.level) ||
    state.cube.level < 1 ||
    state.cube.level > 100
  ) {
    throw new Error("Cube level must be a safe integer between 1 and 100");
  }
  if (state.cube.unlockedRecipes.includes(cubeKey)) {
    return {
      kind: "already-unlocked",
      cubeKey,
      recipeType: recipe.RECIPETYPE,
    };
  }
  if (recipe.IsDefaultUnlocked === true) {
    throw new Error(
      `default Cube recipe ${cubeKey} is missing from player state`,
    );
  }

  const defaultGroup = defaultSubRecipes(indexes, recipe.RECIPETYPE);
  requireSafeNonNegativeInteger(
    defaultGroup.requiredCubeLevel,
    `${recipe.RECIPETYPE} unlock Cube level`,
  );
  requireSafeNonNegativeInteger(
    defaultGroup.cost,
    `${recipe.RECIPETYPE} unlock cost`,
  );

  if (state.cube.level < defaultGroup.requiredCubeLevel) {
    return {
      kind: "level-locked",
      cubeKey,
      recipeType: recipe.RECIPETYPE,
      requiredCubeLevel: defaultGroup.requiredCubeLevel,
      currentCubeLevel: state.cube.level,
    };
  }
  return {
    kind: "available",
    cubeKey,
    defaultSubRecipeKeys: defaultGroup.rows.map(
      (row) => row.CubeSubRecipeKey,
    ),
    recipeType: recipe.RECIPETYPE,
    requiredCubeLevel: defaultGroup.requiredCubeLevel,
    cost: defaultGroup.cost,
    canAfford: state.gold >= defaultGroup.cost,
  };
}

export function unlockCubeRecipe(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  cubeKey: number,
): CubeRecipeUnlockResult {
  const quote = quoteCubeRecipeUnlock(indexes, state, cubeKey);
  if (quote.kind !== "available") return quote;
  if (!quote.canAfford) {
    return {
      kind: "insufficient-gold",
      cubeKey,
      recipeType: quote.recipeType,
      requiredCubeLevel: quote.requiredCubeLevel,
      cost: quote.cost,
      availableGold: state.gold,
    };
  }

  const next = structuredClone(state);
  next.gold -= quote.cost;
  next.cube.unlockedRecipes.push(cubeKey);
  next.cube.unlockedRecipes.sort(
    (left, right) =>
      sourceRecipe(indexes, left).Index - sourceRecipe(indexes, right).Index,
  );
  next.cube.unlockedSubRecipes.push(...quote.defaultSubRecipeKeys);
  next.cube.unlockedSubRecipes.sort((left, right) => left - right);

  return {
    kind: "unlocked",
    cubeKey,
    defaultSubRecipeKeys: quote.defaultSubRecipeKeys,
    recipeType: quote.recipeType,
    cost: quote.cost,
    state: next,
  };
}
