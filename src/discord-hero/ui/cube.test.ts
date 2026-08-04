import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  decodeDiscordHeroCubePage,
  decodeDiscordHeroCubeTarget,
  discordHeroCubeMainRecipeOptions,
  discordHeroCubeMainRecipePageCount,
  discordHeroCubeSubRecipeOptions,
  discordHeroCubeSubRecipePageCount,
  encodeDiscordHeroCubePage,
  encodeDiscordHeroCubeTarget,
  resolveDiscordHeroCubeTarget,
} from "./cube";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function fresh(): PlayerState {
  return createFreshPlayerStateFromCatalog(indexes, 101);
}

function withCubeRows(
  mainRows: readonly DiscordHeroDatasetRow<"cube_recipes">[],
  subRows: readonly DiscordHeroDatasetRow<"cube_sub_recipes">[],
): DiscordHeroCatalogIndexes {
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      cube_recipes: {
        ...indexes.tables.cube_recipes,
        rows: mainRows,
        groups: new Map(
          mainRows.map((row) => [row.CubeKey, Object.freeze([row])]),
        ),
      },
      cube_sub_recipes: {
        ...indexes.tables.cube_sub_recipes,
        rows: subRows,
        groups: new Map(
          subRows.map((row) => [row.CubeSubRecipeKey, Object.freeze([row])]),
        ),
      },
    },
  };
}

describe("DiscordHero Cube browser projection", () => {
  test("projects all main recipes in source Index order with exact quotes and detached status", () => {
    const state = fresh();
    const before = structuredClone(state);

    expect(discordHeroCubeMainRecipePageCount(indexes)).toBe(1);
    const options = discordHeroCubeMainRecipeOptions(indexes, state, 0);

    expect(options.map((option) => option.detail.cubeKey)).toEqual([
      100001, 200001, 600001, 300001, 400001, 500001, 900001, 700001,
    ]);
    expect(options.map((option) => option.detail.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(options[0]).toMatchObject({
      value: "m-0-255t",
      label: "SYNTHESIS",
      detail: {
        cubeKey: 100001,
        recipeType: "SYNTHESIS",
        index: 0,
        name: null,
        isDefaultUnlocked: true,
        unlocked: true,
        subRecipeCount: 8,
        unlockQuote: {
          kind: "already-unlocked",
          cubeKey: 100001,
          recipeType: "SYNTHESIS",
        },
      },
    });
    expect(options[1]).toMatchObject({
      value: "m-0-4abl",
      label: "ALCHEMY",
      detail: {
        cubeKey: 200001,
        recipeType: "ALCHEMY",
        index: 1,
        name: null,
        isDefaultUnlocked: null,
        unlocked: false,
        subRecipeCount: 1,
        unlockQuote: {
          kind: "available",
          cubeKey: 200001,
          defaultSubRecipeKeys: [200011],
          recipeType: "ALCHEMY",
          requiredCubeLevel: 1,
          cost: 10,
          canAfford: true,
        },
      },
    });
    expect(options[1]!.detail.description).toBe(
      "Convert any item into gold.<br><br>- <color=#F5D958>Materials</color> : Any 1~9 items<br>- <color=#30FF63>Result</color> : Items consumed, gold obtained",
    );
    expect(
      options.every(
        (option) =>
          option.value.length <= 100 &&
          option.label.length <= 100 &&
          option.description.length <= 100,
      ),
    ).toBe(true);
    expect(Object.isFrozen(options)).toBe(true);
    expect(Object.isFrozen(options[1])).toBe(true);
    expect(Object.isFrozen(options[1]!.detail)).toBe(true);
    expect(Object.isFrozen(options[1]!.detail.unlockQuote)).toBe(true);
    expect(
      Object.isFrozen(
        options[1]!.detail.unlockQuote.kind === "available"
          ? options[1]!.detail.unlockQuote.defaultSubRecipeKeys
          : null,
      ),
    ).toBe(true);

    const secondRead = discordHeroCubeMainRecipeOptions(indexes, state, 0);
    expect(secondRead).not.toBe(options);
    expect(secondRead[1]).not.toBe(options[1]);
    expect(secondRead[1]!.detail).not.toBe(options[1]!.detail);
    expect(secondRead[1]!.detail.unlockQuote).not.toBe(
      options[1]!.detail.unlockQuote,
    );
    expect(state).toEqual(before);
  });

  test("groups all 31 source sub-recipes under their source-ordered main recipe", () => {
    const state = fresh();
    const mainOptions = discordHeroCubeMainRecipeOptions(indexes, state, 0);
    const groups = mainOptions.map((main) => {
      const cubeKey = main.detail.cubeKey;
      expect(discordHeroCubeSubRecipePageCount(indexes, cubeKey)).toBe(1);
      return discordHeroCubeSubRecipeOptions(indexes, state, cubeKey, 0);
    });

    expect(groups.map((group) => group.length)).toEqual([
      8, 1, 8, 1, 1, 1, 1, 10,
    ]);
    expect(
      groups.map((group) =>
        group.map((option) => option.detail.cubeSubRecipeKey),
      ),
    ).toEqual([
      [100011, 100021, 100031, 100041, 100051, 100061, 100071, 100081],
      [200011],
      [600011, 600021, 600031, 600041, 600051, 600061, 600071, 600081],
      [300011],
      [400011],
      [500011],
      [900011],
      [
        700011, 700021, 700031, 700041, 700051, 700061, 700071, 700081, 700091,
        700101,
      ],
    ]);
    expect(groups.flat()).toHaveLength(31);
    expect(new Set(groups.flat().map((option) => option.value)).size).toBe(31);
    expect(groups[0]![1]).toEqual({
      value: "s-255t-0-256d",
      label: "Lv.10~20",
      description: "Tier 2 · Unlock Lv10 · 100g · Locked",
      detail: {
        kind: "sub-recipe",
        cubeKey: 100001,
        cubeSubRecipeKey: 100021,
        recipeType: "SYNTHESIS",
        recipeTier: 2,
        name: "Lv.10~20",
        description: null,
        defaultUnlockWhenMainRecipeOpen: null,
        unlockCubeLevel: 10,
        unlockCost: 100,
        unlocked: false,
      },
    });
    expect(groups[7]![0]).toEqual({
      value: "s-f04h-0-f04r",
      label: "Coin 1",
      description: "Default · Unlock Lv20 · 3000g · Locked",
      detail: {
        kind: "sub-recipe",
        cubeKey: 700001,
        cubeSubRecipeKey: 700011,
        recipeType: "OFFERING",
        recipeTier: null,
        name: "Coin 1",
        description: null,
        defaultUnlockWhenMainRecipeOpen: true,
        unlockCubeLevel: 20,
        unlockCost: 3000,
        unlocked: false,
      },
    });
    expect(
      groups
        .flat()
        .every(
          (option) =>
            option.value.length <= 100 &&
            option.label.length <= 100 &&
            option.description.length <= 100,
        ),
    ).toBe(true);
    expect(Object.isFrozen(groups[0])).toBe(true);
    expect(Object.isFrozen(groups[0]![1])).toBe(true);
    expect(Object.isFrozen(groups[0]![1]!.detail)).toBe(true);
  });

  test("projects an advanced player's main and sub-recipe ownership without executability claims", () => {
    const state = fresh();
    state.gold = 1_000_000;
    state.cube.level = 100;
    state.cube.unlockedRecipes = [
      100001, 200001, 600001, 300001, 400001, 500001, 900001, 700001,
    ];
    state.cube.unlockedSubRecipes = indexes.tables.cube_sub_recipes.rows.map(
      (subRecipe) => subRecipe.CubeSubRecipeKey,
    );
    const before = structuredClone(state);

    const mains = discordHeroCubeMainRecipeOptions(indexes, state, 0);
    const subs = mains.flatMap((main) =>
      discordHeroCubeSubRecipeOptions(indexes, state, main.detail.cubeKey, 0),
    );

    expect(mains.every((main) => main.detail.unlocked)).toBe(true);
    expect(
      mains.every(
        (main) => main.detail.unlockQuote.kind === "already-unlocked",
      ),
    ).toBe(true);
    expect(subs).toHaveLength(31);
    expect(subs.every((subRecipe) => subRecipe.detail.unlocked)).toBe(true);
    expect(
      [...mains, ...subs].every((option) => !("executable" in option.detail)),
    ).toBe(true);
    expect(state).toEqual(before);
  });

  test("round-trips canonical pages and page-bound targets and rejects forged boundaries", () => {
    const mainPage = { kind: "main-recipes" as const, page: 35 };
    const subPage = {
      kind: "sub-recipes" as const,
      cubeKey: 700001,
      page: 2,
    };
    expect(
      decodeDiscordHeroCubePage(encodeDiscordHeroCubePage(mainPage)),
    ).toEqual(mainPage);
    expect(
      decodeDiscordHeroCubePage(encodeDiscordHeroCubePage(subPage)),
    ).toEqual(subPage);

    const mainTarget = {
      kind: "main-recipe" as const,
      page: 0,
      cubeKey: 200001,
    };
    const subTarget = {
      kind: "sub-recipe" as const,
      cubeKey: 700001,
      page: 0,
      cubeSubRecipeKey: 700011,
    };
    expect(
      decodeDiscordHeroCubeTarget(encodeDiscordHeroCubeTarget(mainTarget)),
    ).toEqual(mainTarget);
    expect(
      decodeDiscordHeroCubeTarget(encodeDiscordHeroCubeTarget(subTarget)),
    ).toEqual(subTarget);
    expect(
      resolveDiscordHeroCubeTarget(
        indexes,
        fresh(),
        encodeDiscordHeroCubeTarget(mainTarget),
      ),
    ).toMatchObject({ kind: "main-recipe", cubeKey: 200001 });
    expect(
      resolveDiscordHeroCubeTarget(
        indexes,
        fresh(),
        encodeDiscordHeroCubeTarget(subTarget),
      ),
    ).toMatchObject({ kind: "sub-recipe", cubeSubRecipeKey: 700011 });

    for (const value of [
      "m-00",
      "m--1",
      "s-f04h-00",
      "s-F04H-0",
      "x-0",
      "s-f04h-0-extra",
    ]) {
      expect(() => decodeDiscordHeroCubePage(value)).toThrow();
    }
    for (const value of [
      "m-00-4abl",
      "m-0-04abl",
      "m-0-4ABL",
      "s-f04h-00-f04r",
      "s-f04h-0-0f04r",
      "s-f04h-0-f04r-extra",
    ]) {
      expect(() => decodeDiscordHeroCubeTarget(value)).toThrow();
    }
    for (const target of [
      {
        kind: "main-recipe" as const,
        page: 1,
        cubeKey: 200001,
      },
      {
        kind: "main-recipe" as const,
        page: 0,
        cubeKey: 999999,
      },
      {
        kind: "sub-recipe" as const,
        cubeKey: 700001,
        page: 0,
        cubeSubRecipeKey: 100011,
      },
      {
        kind: "sub-recipe" as const,
        cubeKey: 200001,
        page: 0,
        cubeSubRecipeKey: 700011,
      },
    ]) {
      expect(() =>
        resolveDiscordHeroCubeTarget(
          indexes,
          fresh(),
          encodeDiscordHeroCubeTarget(target),
        ),
      ).toThrow();
    }
  });

  test("fails closed for inconsistent default, ownership, and level state", () => {
    const invalidStates = [
      (state: PlayerState) => {
        state.cube.unlockedSubRecipes = [];
      },
      (state: PlayerState) => {
        state.cube.unlockedRecipes.push(200001);
      },
      (state: PlayerState) => {
        state.cube.unlockedSubRecipes.push(200011);
      },
      (state: PlayerState) => {
        state.cube.unlockedRecipes.push(999999);
      },
      (state: PlayerState) => {
        state.cube.unlockedSubRecipes.push(999999);
      },
      (state: PlayerState) => {
        state.cube.unlockedRecipes.push(100001);
      },
      (state: PlayerState) => {
        state.cube.unlockedSubRecipes.push(100011);
      },
      (state: PlayerState) => {
        state.cube.unlockedSubRecipes.push(100021);
      },
    ];

    for (const makeInvalid of invalidStates) {
      const state = fresh();
      makeInvalid(state);
      const before = structuredClone(state);
      expect(() =>
        discordHeroCubeMainRecipeOptions(indexes, state, 0),
      ).toThrow();
      expect(() =>
        discordHeroCubeSubRecipeOptions(indexes, state, 100001, 0),
      ).toThrow();
      expect(state).toEqual(before);
    }
  });

  test("pages future large groups and safely bounds adversarial Discord strings without losing exact detail", () => {
    const adversarialText = `${"x".repeat(99)}😀tail`;
    const mainRows = indexes.tables.cube_recipes.rows.map((row) =>
      row.CubeKey === 200001
        ? {
            ...row,
            TooltipStringKey_i18n: {
              ...row.TooltipStringKey_i18n,
              "en-US": adversarialText,
            },
          }
        : row,
    );
    const offeringTemplate = indexes.tables.cube_sub_recipes.rows.find(
      (row) => row.CubeSubRecipeKey === 700021,
    )!;
    const subRows = [
      ...indexes.tables.cube_sub_recipes.rows.map((row) =>
        row.CubeSubRecipeKey === 700011
          ? {
              ...row,
              SubRecipeNameStringKey_i18n: {
                ...row.SubRecipeNameStringKey_i18n,
                "en-US": adversarialText,
              },
            }
          : row,
      ),
      ...Array.from({ length: 16 }, (_, index) => ({
        ...offeringTemplate,
        CubeSubRecipeKey: 710001 + index,
        RecipeTier: index + 1,
        SubRecipeNameStringKey_i18n: {
          ...offeringTemplate.SubRecipeNameStringKey_i18n,
          "en-US": `Future Coin ${index + 1}`,
        },
      })),
    ];
    const adversarialIndexes = withCubeRows(mainRows, subRows);
    const state = fresh();
    const before = structuredClone(state);

    const alchemy = discordHeroCubeMainRecipeOptions(
      adversarialIndexes,
      state,
      0,
    ).find((option) => option.detail.cubeKey === 200001)!;
    expect(alchemy.detail.description).toBe(adversarialText);
    expect(alchemy.description.length).toBeLessThanOrEqual(100);
    expect(alchemy.description.endsWith("…")).toBe(true);
    expect(/[\uD800-\uDBFF]$/.test(alchemy.description)).toBe(false);

    expect(discordHeroCubeSubRecipePageCount(adversarialIndexes, 700001)).toBe(
      2,
    );
    const first = discordHeroCubeSubRecipeOptions(
      adversarialIndexes,
      state,
      700001,
      0,
    );
    const last = discordHeroCubeSubRecipeOptions(
      adversarialIndexes,
      state,
      700001,
      1,
    );
    expect(first).toHaveLength(25);
    expect(last).toHaveLength(1);
    expect(first[0]!.detail.name).toBe(adversarialText);
    expect(first[0]!.label.length).toBeLessThanOrEqual(100);
    expect(first[0]!.label.endsWith("…")).toBe(true);
    expect(/[\uD800-\uDBFF]$/.test(first[0]!.label)).toBe(false);
    expect(
      resolveDiscordHeroCubeTarget(adversarialIndexes, state, last[0]!.value),
    ).toEqual(last[0]!.detail);

    const lastTarget = decodeDiscordHeroCubeTarget(last[0]!.value);
    expect(lastTarget.kind).toBe("sub-recipe");
    if (lastTarget.kind === "sub-recipe") {
      expect(() =>
        resolveDiscordHeroCubeTarget(
          adversarialIndexes,
          state,
          encodeDiscordHeroCubeTarget({ ...lastTarget, page: 0 }),
        ),
      ).toThrow("not in group");
    }
    expect(state).toEqual(before);
  });

  test("stays synchronous and does not consult time or RNG", () => {
    const state = fresh();
    const before = structuredClone(state);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    let randomCalls = 0;
    let clockCalls = 0;
    Math.random = () => {
      randomCalls += 1;
      throw new Error("Cube browser must not use RNG");
    };
    Date.now = () => {
      clockCalls += 1;
      throw new Error("Cube browser must not use the clock");
    };

    try {
      const mains = discordHeroCubeMainRecipeOptions(indexes, state, 0);
      const subs = discordHeroCubeSubRecipeOptions(indexes, state, 100001, 0);
      const selected = resolveDiscordHeroCubeTarget(
        indexes,
        state,
        subs[0]!.value,
      );
      expect(mains).toBeInstanceOf(Array);
      expect(subs).toBeInstanceOf(Array);
      expect(selected.kind).toBe("sub-recipe");
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }

    expect(randomCalls).toBe(0);
    expect(clockCalls).toBe(0);
    expect(state).toEqual(before);
  });
});
