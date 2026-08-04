import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { getCatalogRow } from "../catalog/indexes";
import {
  quoteCubeRecipeUnlock,
  type CubeRecipeUnlockQuote,
} from "../domain/cube-unlocks";
import type { PlayerState } from "../domain/player";

export const DISCORD_HERO_CUBE_PAGE_SIZE = 25;

export interface DiscordHeroCubeMainRecipeDetail {
  readonly kind: "main-recipe";
  readonly cubeKey: number;
  readonly recipeType: string;
  readonly index: number;
  readonly name: null;
  readonly description: string;
  readonly isDefaultUnlocked: boolean | null;
  readonly unlocked: boolean;
  readonly subRecipeCount: number;
  readonly unlockQuote: CubeRecipeUnlockQuote;
}

export interface DiscordHeroCubeMainRecipeOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly detail: DiscordHeroCubeMainRecipeDetail;
}

export interface DiscordHeroCubeSubRecipeDetail {
  readonly kind: "sub-recipe";
  readonly cubeKey: number;
  readonly cubeSubRecipeKey: number;
  readonly recipeType: string;
  readonly recipeTier: number | null;
  readonly name: string;
  readonly description: null;
  readonly defaultUnlockWhenMainRecipeOpen: boolean | null;
  readonly unlockCubeLevel: number;
  readonly unlockCost: number | null;
  readonly unlocked: boolean;
}

export interface DiscordHeroCubeSubRecipeOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly detail: DiscordHeroCubeSubRecipeDetail;
}

export type DiscordHeroCubePage =
  | {
      readonly kind: "main-recipes";
      readonly page: number;
    }
  | {
      readonly kind: "sub-recipes";
      readonly cubeKey: number;
      readonly page: number;
    };

export type DiscordHeroCubeTarget =
  | {
      readonly kind: "main-recipe";
      readonly page: number;
      readonly cubeKey: number;
    }
  | {
      readonly kind: "sub-recipe";
      readonly cubeKey: number;
      readonly page: number;
      readonly cubeSubRecipeKey: number;
    };

function orderedMainRecipes(indexes: DiscordHeroCatalogIndexes) {
  return [...indexes.tables.cube_recipes.rows].sort(
    (left, right) => left.Index - right.Index,
  );
}

function sourceMainRecipe(
  indexes: DiscordHeroCatalogIndexes,
  cubeKey: number,
): DiscordHeroDatasetRow<"cube_recipes"> {
  return getCatalogRow(indexes, "cube_recipes", cubeKey);
}

function subRecipesForMain(
  indexes: DiscordHeroCatalogIndexes,
  cubeKey: number,
): readonly DiscordHeroDatasetRow<"cube_sub_recipes">[] {
  const main = sourceMainRecipe(indexes, cubeKey);
  return indexes.tables.cube_sub_recipes.rows.filter(
    (subRecipe) => subRecipe.RECIPETYPE === main.RECIPETYPE,
  );
}

function requirePage(page: number, pageCount: number, label: string): void {
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero Cube ${label} page ${page} is outside 0-${pageCount - 1}`,
    );
  }
}

function localizedEnglish(
  values: Readonly<Record<string, unknown>>,
  label: string,
): string {
  const value = values["en-US"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} has no English source text`);
  }
  return value;
}

function discordBounded(value: string): string {
  if (value.length <= 100) return value;
  let prefix = value.slice(0, 99);
  if (/[\uD800-\uDBFF]$/.test(prefix)) {
    prefix = prefix.slice(0, -1);
  }
  return `${prefix}…`;
}

function frozenQuote(quote: CubeRecipeUnlockQuote): CubeRecipeUnlockQuote {
  if (quote.kind === "available") {
    return Object.freeze({
      ...quote,
      defaultSubRecipeKeys: Object.freeze([...quote.defaultSubRecipeKeys]),
    });
  }
  return Object.freeze({ ...quote });
}

function encodeNonNegative(value: number, label: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value.toString(36);
}

function encodePositive(value: number, label: string): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value.toString(36);
}

function decodeCanonical(value: string, minimum: 0 | 1, label: string): number {
  if (!/^[0-9a-z]+$/.test(value)) {
    throw new Error(`${label} has invalid encoding`);
  }
  const decoded = Number.parseInt(value, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < minimum ||
    decoded.toString(36) !== value
  ) {
    throw new Error(`${label} has non-canonical encoding`);
  }
  return decoded;
}

function requireCubeStateConsistency(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): void {
  if (
    !Number.isSafeInteger(state.cube.level) ||
    state.cube.level < 1 ||
    state.cube.level > 100
  ) {
    throw new Error("DiscordHero Cube level must be between 1 and 100");
  }

  const mains = orderedMainRecipes(indexes);
  const mainByKey = new Map<number, (typeof mains)[number]>();
  const mainByType = new Map<string, (typeof mains)[number]>();
  const sourceIndexes = new Set<number>();
  for (const main of mains) {
    if (mainByKey.has(main.CubeKey)) {
      throw new Error(
        `DiscordHero Cube source repeats main recipe ${main.CubeKey}`,
      );
    }
    if (mainByType.has(main.RECIPETYPE)) {
      throw new Error(
        `DiscordHero Cube source repeats recipe type ${main.RECIPETYPE}`,
      );
    }
    if (
      !Number.isSafeInteger(main.Index) ||
      main.Index < 0 ||
      sourceIndexes.has(main.Index)
    ) {
      throw new Error(
        `DiscordHero Cube source has invalid main recipe Index ${main.Index}`,
      );
    }
    mainByKey.set(main.CubeKey, main);
    mainByType.set(main.RECIPETYPE, main);
    sourceIndexes.add(main.Index);
  }

  const subByKey = new Map<number, DiscordHeroDatasetRow<"cube_sub_recipes">>();
  for (const subRecipe of indexes.tables.cube_sub_recipes.rows) {
    if (!mainByType.has(subRecipe.RECIPETYPE)) {
      throw new Error(
        `DiscordHero Cube sub-recipe ${subRecipe.CubeSubRecipeKey} has no main recipe type ${subRecipe.RECIPETYPE}`,
      );
    }
    if (subByKey.has(subRecipe.CubeSubRecipeKey)) {
      throw new Error(
        `DiscordHero Cube source repeats sub-recipe ${subRecipe.CubeSubRecipeKey}`,
      );
    }
    subByKey.set(subRecipe.CubeSubRecipeKey, subRecipe);
  }

  const unlockedMainKeys = new Set<number>();
  const unlockedMainTypes = new Set<string>();
  for (const cubeKey of state.cube.unlockedRecipes) {
    if (unlockedMainKeys.has(cubeKey)) {
      throw new Error(`DiscordHero Cube player repeats main recipe ${cubeKey}`);
    }
    const main = mainByKey.get(cubeKey);
    if (main === undefined) {
      throw new Error(
        `DiscordHero Cube player has unknown main recipe ${cubeKey}`,
      );
    }
    unlockedMainKeys.add(cubeKey);
    unlockedMainTypes.add(main.RECIPETYPE);
  }

  for (const main of mains) {
    if (
      main.IsDefaultUnlocked === true &&
      !unlockedMainKeys.has(main.CubeKey)
    ) {
      throw new Error(
        `DiscordHero Cube default main recipe ${main.CubeKey} is missing from player state`,
      );
    }
  }

  const unlockedSubKeys = new Set<number>();
  for (const cubeSubRecipeKey of state.cube.unlockedSubRecipes) {
    if (unlockedSubKeys.has(cubeSubRecipeKey)) {
      throw new Error(
        `DiscordHero Cube player repeats sub-recipe ${cubeSubRecipeKey}`,
      );
    }
    const subRecipe = subByKey.get(cubeSubRecipeKey);
    if (subRecipe === undefined) {
      throw new Error(
        `DiscordHero Cube player has unknown sub-recipe ${cubeSubRecipeKey}`,
      );
    }
    if (!unlockedMainTypes.has(subRecipe.RECIPETYPE)) {
      throw new Error(
        `DiscordHero Cube sub-recipe ${cubeSubRecipeKey} requires main recipe type ${subRecipe.RECIPETYPE}`,
      );
    }
    if (state.cube.level < subRecipe.UnlockCubeLevel) {
      throw new Error(
        `DiscordHero Cube sub-recipe ${cubeSubRecipeKey} requires Cube level ${subRecipe.UnlockCubeLevel}`,
      );
    }
    unlockedSubKeys.add(cubeSubRecipeKey);
  }

  for (const subRecipe of subByKey.values()) {
    if (
      subRecipe.DefaultUnlockWhenMainRecipeOpen === true &&
      unlockedMainTypes.has(subRecipe.RECIPETYPE) &&
      !unlockedSubKeys.has(subRecipe.CubeSubRecipeKey)
    ) {
      throw new Error(
        `DiscordHero Cube default sub-recipe ${subRecipe.CubeSubRecipeKey} is missing from player state`,
      );
    }
  }
}

function mainRecipeDetail(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  row: DiscordHeroDatasetRow<"cube_recipes">,
): DiscordHeroCubeMainRecipeDetail {
  const quote = frozenQuote(quoteCubeRecipeUnlock(indexes, state, row.CubeKey));
  return Object.freeze({
    kind: "main-recipe",
    cubeKey: row.CubeKey,
    recipeType: row.RECIPETYPE,
    index: row.Index,
    name: null,
    description: localizedEnglish(
      row.TooltipStringKey_i18n,
      `Cube recipe ${row.CubeKey} description`,
    ),
    isDefaultUnlocked: row.IsDefaultUnlocked,
    unlocked: state.cube.unlockedRecipes.includes(row.CubeKey),
    subRecipeCount: indexes.tables.cube_sub_recipes.rows.filter(
      (subRecipe) => subRecipe.RECIPETYPE === row.RECIPETYPE,
    ).length,
    unlockQuote: quote,
  });
}

export function discordHeroCubeMainRecipePageCount(
  indexes: DiscordHeroCatalogIndexes,
): number {
  return Math.max(
    1,
    Math.ceil(orderedMainRecipes(indexes).length / DISCORD_HERO_CUBE_PAGE_SIZE),
  );
}

export function discordHeroCubeSubRecipePageCount(
  indexes: DiscordHeroCatalogIndexes,
  cubeKey: number,
): number {
  return Math.max(
    1,
    Math.ceil(
      subRecipesForMain(indexes, cubeKey).length / DISCORD_HERO_CUBE_PAGE_SIZE,
    ),
  );
}

export function discordHeroCubeSubRecipeOptions(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  cubeKey: number,
  page: number,
): readonly DiscordHeroCubeSubRecipeOption[] {
  requireCubeStateConsistency(indexes, state);
  const rows = subRecipesForMain(indexes, cubeKey);
  const pageCount = discordHeroCubeSubRecipePageCount(indexes, cubeKey);
  requirePage(page, pageCount, `sub-recipe group ${cubeKey}`);
  const start = page * DISCORD_HERO_CUBE_PAGE_SIZE;
  return Object.freeze(
    rows.slice(start, start + DISCORD_HERO_CUBE_PAGE_SIZE).map((row) => {
      const name = localizedEnglish(
        row.SubRecipeNameStringKey_i18n,
        `Cube sub-recipe ${row.CubeSubRecipeKey} name`,
      );
      const detail: DiscordHeroCubeSubRecipeDetail = Object.freeze({
        kind: "sub-recipe",
        cubeKey,
        cubeSubRecipeKey: row.CubeSubRecipeKey,
        recipeType: row.RECIPETYPE,
        recipeTier: row.RecipeTier,
        name,
        description: null,
        defaultUnlockWhenMainRecipeOpen: row.DefaultUnlockWhenMainRecipeOpen,
        unlockCubeLevel: row.UnlockCubeLevel,
        unlockCost: row.UnlockCost,
        unlocked: state.cube.unlockedSubRecipes.includes(row.CubeSubRecipeKey),
      });
      const sourceKind =
        row.DefaultUnlockWhenMainRecipeOpen === true
          ? "Default"
          : row.RecipeTier === null
            ? "Tier —"
            : `Tier ${row.RecipeTier}`;
      const sourceCost =
        row.UnlockCost === null ? "No source cost" : `${row.UnlockCost}g`;
      return Object.freeze({
        value: encodeDiscordHeroCubeTarget({
          kind: "sub-recipe",
          cubeKey,
          page,
          cubeSubRecipeKey: row.CubeSubRecipeKey,
        }),
        label: discordBounded(name),
        description: discordBounded(
          [
            sourceKind,
            `Unlock Lv${row.UnlockCubeLevel}`,
            sourceCost,
            detail.unlocked ? "Unlocked" : "Locked",
          ].join(" · "),
        ),
        detail,
      });
    }),
  );
}

export function encodeDiscordHeroCubePage(
  location: DiscordHeroCubePage,
): string {
  if (location.kind === "main-recipes") {
    return `m-${encodeNonNegative(location.page, "DiscordHero Cube main page")}`;
  }
  if (location.kind === "sub-recipes") {
    return `s-${encodePositive(
      location.cubeKey,
      "DiscordHero Cube main recipe key",
    )}-${encodeNonNegative(location.page, "DiscordHero Cube sub-recipe page")}`;
  }
  throw new Error(
    `DiscordHero Cube page has unknown kind ${String((location as { kind?: unknown }).kind)}`,
  );
}

export function decodeDiscordHeroCubePage(value: string): DiscordHeroCubePage {
  const main = /^m-([0-9a-z]+)$/.exec(value);
  if (main !== null) {
    return Object.freeze({
      kind: "main-recipes",
      page: decodeCanonical(main[1]!, 0, "DiscordHero Cube main recipe page"),
    });
  }
  const sub = /^s-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (sub !== null) {
    return Object.freeze({
      kind: "sub-recipes",
      cubeKey: decodeCanonical(sub[1]!, 1, "DiscordHero Cube main recipe key"),
      page: decodeCanonical(sub[2]!, 0, "DiscordHero Cube sub-recipe page"),
    });
  }
  throw new Error("DiscordHero Cube page has invalid encoding");
}

export function encodeDiscordHeroCubeTarget(
  target: DiscordHeroCubeTarget,
): string {
  if (target.kind === "main-recipe") {
    return `m-${encodeNonNegative(
      target.page,
      "DiscordHero Cube main recipe page",
    )}-${encodePositive(target.cubeKey, "DiscordHero Cube main recipe key")}`;
  }
  if (target.kind === "sub-recipe") {
    return `s-${encodePositive(
      target.cubeKey,
      "DiscordHero Cube main recipe key",
    )}-${encodeNonNegative(
      target.page,
      "DiscordHero Cube sub-recipe page",
    )}-${encodePositive(
      target.cubeSubRecipeKey,
      "DiscordHero Cube sub-recipe key",
    )}`;
  }
  throw new Error(
    `DiscordHero Cube target has unknown kind ${String((target as { kind?: unknown }).kind)}`,
  );
}

export function decodeDiscordHeroCubeTarget(
  value: string,
): DiscordHeroCubeTarget {
  const main = /^m-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (main !== null) {
    return Object.freeze({
      kind: "main-recipe",
      page: decodeCanonical(main[1]!, 0, "DiscordHero Cube main recipe page"),
      cubeKey: decodeCanonical(main[2]!, 1, "DiscordHero Cube main recipe key"),
    });
  }
  const sub = /^s-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (sub !== null) {
    return Object.freeze({
      kind: "sub-recipe",
      cubeKey: decodeCanonical(sub[1]!, 1, "DiscordHero Cube main recipe key"),
      page: decodeCanonical(sub[2]!, 0, "DiscordHero Cube sub-recipe page"),
      cubeSubRecipeKey: decodeCanonical(
        sub[3]!,
        1,
        "DiscordHero Cube sub-recipe key",
      ),
    });
  }
  throw new Error("DiscordHero Cube target has invalid encoding");
}

export function resolveDiscordHeroCubeTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  value: string,
): DiscordHeroCubeMainRecipeDetail | DiscordHeroCubeSubRecipeDetail {
  const target = decodeDiscordHeroCubeTarget(value);
  if (target.kind === "main-recipe") {
    const option = discordHeroCubeMainRecipeOptions(
      indexes,
      state,
      target.page,
    ).find((candidate) => candidate.value === value);
    if (option === undefined) {
      throw new Error(
        `DiscordHero Cube main recipe ${target.cubeKey} is not on page ${target.page}`,
      );
    }
    return option.detail;
  }
  const option = discordHeroCubeSubRecipeOptions(
    indexes,
    state,
    target.cubeKey,
    target.page,
  ).find((candidate) => candidate.value === value);
  if (option === undefined) {
    throw new Error(
      `DiscordHero Cube sub-recipe ${target.cubeSubRecipeKey} is not in group ${target.cubeKey} page ${target.page}`,
    );
  }
  return option.detail;
}

export function discordHeroCubeMainRecipeOptions(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  page: number,
): readonly DiscordHeroCubeMainRecipeOption[] {
  requireCubeStateConsistency(indexes, state);
  const rows = orderedMainRecipes(indexes);
  const pageCount = discordHeroCubeMainRecipePageCount(indexes);
  requirePage(page, pageCount, "main recipe");
  const start = page * DISCORD_HERO_CUBE_PAGE_SIZE;
  return Object.freeze(
    rows.slice(start, start + DISCORD_HERO_CUBE_PAGE_SIZE).map((row) => {
      const detail = mainRecipeDetail(indexes, state, row);
      return Object.freeze({
        value: encodeDiscordHeroCubeTarget({
          kind: "main-recipe",
          page,
          cubeKey: row.CubeKey,
        }),
        label: discordBounded(row.RECIPETYPE),
        description: discordBounded(detail.description),
        detail,
      });
    }),
  );
}
