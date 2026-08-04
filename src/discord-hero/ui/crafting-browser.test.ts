import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { parseMaterialRequirements } from "../domain/crafting";
import {
  DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER,
  DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE,
  DISCORD_HERO_CRAFTING_RECIPE_COUNT,
  discordHeroCraftingRecipeDetail,
  discordHeroCraftingRecipePage,
  discordHeroCraftingRecipePageCount,
  discordHeroCraftingRecipeTextRows,
  projectDiscordHeroCraftingBrowser,
} from "./crafting-browser";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function expectDiscordSafePlainText(value: string): void {
  expect(value.length).toBeLessThanOrEqual(200);
  expect(value).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u);
  expect(value).not.toContain("`");
  expect(value).not.toMatch(/@(?:everyone|here)|<@!?\d+>|<@&\d+>|<#\d+>/iu);
  expect(hasLoneSurrogate(value)).toBe(false);
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TypeError);
    return (error as Error).message;
  }
  throw new Error("expected operation to reject");
}

function forbiddenCopyHits(text: string): string[] {
  const lower = text.toLowerCase();
  return [
    "craftable",
    "selected",
    "probability",
    "awarded",
    "inventory credit",
    "guaranteed",
    "pity",
    "rng",
  ].filter((token) => lower.includes(token));
}

describe("DiscordHero crafting recipe source browser", () => {
  test("pins exactly 56 source-ordered crafting recipes across 3 pages of 25", () => {
    expect(DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE).toBe(25);
    expect(DISCORD_HERO_CRAFTING_RECIPE_COUNT).toBe(56);
    expect(indexes.tables.crafting_recipes.rows).toHaveLength(56);

    const browser = projectDiscordHeroCraftingBrowser(indexes);
    expect(browser.recipeCount).toBe(56);
    expect(browser.pageCount).toBe(3);
    expect(browser.disclaimer).toBe(DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER);
    expect(browser.disclaimer.toLowerCase()).toContain("source preview");
    expect(browser.disclaimer.toLowerCase()).toContain("oracle-gated");
    expect(forbiddenCopyHits(browser.disclaimer)).toEqual([]);
    expect(discordHeroCraftingRecipePageCount(indexes)).toBe(3);

    const pages = [0, 1, 2].map((page) =>
      discordHeroCraftingRecipePage(indexes, page),
    );
    expect(pages.map((page) => page.rows.length)).toEqual([25, 25, 6]);
    expect(pages.map((page) => page.page)).toEqual([0, 1, 2]);
    expect(pages.every((page) => page.pageCount === 3)).toBe(true);
    expect(pages.every((page) => page.rowCount === 56)).toBe(true);

    const keys = pages.flatMap((page) =>
      page.rows.map((row) => row.craftingRecipeKey),
    );
    expect(keys).toEqual(
      indexes.tables.crafting_recipes.rows.map((row) => row.CraftingRecipeKey),
    );
    expectDeeplyFrozen(browser);
    for (const page of pages) expectDeeplyFrozen(page);
  });

  test("preserves raw recipe fields, parseMaterialRequirements order, and drop reference-only provenance", () => {
    const source = indexes.tables.crafting_recipes.rows;
    for (const [rowIndex, sourceRow] of source.entries()) {
      const detail = discordHeroCraftingRecipeDetail(indexes, {
        craftingRecipeKey: sourceRow.CraftingRecipeKey,
      });
      expect(detail.rowIndex).toBe(rowIndex);
      expect(detail.craftingRecipeKey).toBe(sourceRow.CraftingRecipeKey);
      expect(detail.itemCraftingType).toBe(sourceRow.ItemCraftingType);
      expect(detail.recipeTier).toBe(sourceRow.RecipeTier);
      expect(detail.materialIndex).toEqual(sourceRow.MaterialIndex);
      expect(detail.rawMaterial).toBe(sourceRow.Material);
      expect(detail.dropKey).toBe(sourceRow.DropKey);

      const parsed = parseMaterialRequirements(sourceRow.Material).map(
        (material) => ({
          itemKey: material.itemKey,
          quantity: material.quantity,
        }),
      );
      expect(
        detail.parsedMaterials.map((m) => ({
          itemKey: m.itemKey,
          quantity: m.quantity,
        })),
      ).toEqual(parsed);

      for (const material of detail.parsedMaterials) {
        expect(material.item.kind).toBe("resolved");
        if (material.item.kind !== "resolved") continue;
        expect(material.item.itemKey).toBe(material.itemKey);
        expect(typeof material.item.name).toBe("string");
        expect(material.item.name.length).toBeGreaterThan(0);
        expect(typeof material.item.type).toBe("string");
        expect(material.item.type.length).toBeGreaterThan(0);
      }

      expect(detail.dropReference.kind).toBe("source-drop-reference");
      expect(detail.dropReference.dropKey).toBe(sourceRow.DropKey);
      expect(detail.dropReference.selectionStatus).toBe("unresolved-reference");
      expect(detail.dropReference.sourceRowCount).toBeGreaterThan(0);
      expect(detail.dropReference.rewardEntryCount).toBe(
        detail.dropReference.sourceRowCount,
      );
      expect(Array.isArray(detail.dropReference.dropTypes)).toBe(true);
      expect(detail.dropReference.dropTypes.length).toBeGreaterThan(0);
      // Never a chosen reward — only counts.
      expect(detail.dropReference).not.toHaveProperty("selectedItemKey");
      expect(detail.dropReference).not.toHaveProperty("selectedReward");
    }

    const dual = discordHeroCraftingRecipeDetail(indexes, {
      craftingRecipeKey: 6001002,
    });
    expect(dual.rawMaterial).toBe("140003_1 140004_1");
    expect(dual.materialIndex).toBe("0 1");
    expect(dual.parsedMaterials.map((m) => m.itemKey)).toEqual([
      140003, 140004,
    ]);
    expect(dual.parsedMaterials.map((m) => m.quantity)).toEqual([1, 1]);
  });

  test("text rows stay Discord-safe, page-sized, and never imply craftability or drop selection", () => {
    for (const page of [0, 1, 2]) {
      const rows = discordHeroCraftingRecipeTextRows(indexes, page);
      const pageModel = discordHeroCraftingRecipePage(indexes, page);
      expect(rows).toHaveLength(pageModel.rows.length);
      expect(rows.length).toBeLessThanOrEqual(25);
      for (const line of rows) {
        expectDiscordSafePlainText(line);
        expect(forbiddenCopyHits(line)).toEqual([]);
      }
    }
    const joined = [0, 1, 2]
      .flatMap((page) => discordHeroCraftingRecipeTextRows(indexes, page))
      .join("\n");
    expect(joined.toLowerCase()).not.toMatch(
      /craftable|selected|probability|awarded|inventory credit|guaranteed|pity/,
    );
    expect(DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER.toLowerCase()).toContain(
      "source preview",
    );
  });

  test("returns detached deeply frozen projections without Math.random or Date", () => {
    let randomCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    const originalDateNow = Date.now;
    let dateCalls = 0;
    Date.now = () => {
      dateCalls += 1;
      return 0;
    };
    try {
      const first = projectDiscordHeroCraftingBrowser(indexes);
      const second = projectDiscordHeroCraftingBrowser(indexes);
      const page = discordHeroCraftingRecipePage(indexes, 0);
      const detail = discordHeroCraftingRecipeDetail(indexes, {
        craftingRecipeKey: page.rows[0]!.craftingRecipeKey,
      });
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
      expect(page.rows[0]).not.toBe(
        indexes.tables.crafting_recipes.rows[0] as unknown,
      );
      expectDeeplyFrozen(first);
      expectDeeplyFrozen(page);
      expectDeeplyFrozen(detail);
      expect(() => {
        (page.rows as unknown as unknown[]).push({});
      }).toThrow(TypeError);
      expect(randomCalls).toBe(0);
      expect(dateCalls).toBe(0);
    } finally {
      Math.random = originalRandom;
      Date.now = originalDateNow;
    }
  });

  test("fails closed on exact-own, prototype, accessor, symbol, and page/detail membership", () => {
    expect(
      errorMessage(() =>
        projectDiscordHeroCraftingBrowser({
          ...indexes,
          tables: Object.assign(
            Object.create({ hostile: true }),
            indexes.tables,
          ),
        } as never),
      ),
    ).toMatch(/prototype|own data|accessor|field/i);

    const withSymbol = { ...indexes } as Record<string | symbol, unknown>;
    withSymbol[Symbol("x")] = true;
    expect(
      errorMessage(() =>
        projectDiscordHeroCraftingBrowser(
          withSymbol as unknown as DiscordHeroCatalogIndexes,
        ),
      ),
    ).toMatch(/symbol|own|field|prototype/i);

    let tableReads = 0;
    const host = { ...indexes };
    const realTables = indexes.tables;
    Object.defineProperty(host, "tables", {
      enumerable: true,
      configurable: true,
      get() {
        tableReads += 1;
        return realTables;
      },
    });
    expect(
      errorMessage(() =>
        projectDiscordHeroCraftingBrowser(
          host as unknown as DiscordHeroCatalogIndexes,
        ),
      ),
    ).toMatch(/own data property|accessor/i);
    expect(tableReads).toBeLessThanOrEqual(1);

    expect(
      errorMessage(() => discordHeroCraftingRecipePage(indexes, 3)),
    ).toMatch(/page|range|out of/i);
    expect(
      errorMessage(() => discordHeroCraftingRecipePage(indexes, -1)),
    ).toMatch(/page|non-negative|range/i);
    expect(
      errorMessage(() =>
        discordHeroCraftingRecipeDetail(indexes, {
          craftingRecipeKey: 9_999_999,
        }),
      ),
    ).toMatch(/unknown|missing|outside|crafting/i);

    expect(
      errorMessage(() =>
        discordHeroCraftingRecipePage(indexes, {
          page: 0,
          extra: true,
        } as never),
      ),
    ).toMatch(/unknown field|must be|page/i);

    expect(
      errorMessage(() =>
        discordHeroCraftingRecipeDetail(indexes, {
          craftingRecipeKey: 6001001,
          selected: true,
        } as never),
      ),
    ).toMatch(/unknown field/i);

    // One-read Material TOCTOU: hostile getter must not re-read after snapshot.
    let materialReads = 0;
    const source = indexes.tables.crafting_recipes.rows[0]!;
    const hostileRow = { ...source };
    Object.defineProperty(hostileRow, "Material", {
      enumerable: true,
      configurable: true,
      get() {
        materialReads += 1;
        return materialReads === 1 ? source.Material : "999999_9";
      },
    });
    const hostileIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        crafting_recipes: {
          ...indexes.tables.crafting_recipes,
          rows: [hostileRow, ...indexes.tables.crafting_recipes.rows.slice(1)],
          groups: new Map(indexes.tables.crafting_recipes.groups).set(
            source.CraftingRecipeKey,
            [hostileRow],
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    let detail: ReturnType<typeof discordHeroCraftingRecipeDetail> | null =
      null;
    try {
      detail = discordHeroCraftingRecipeDetail(hostileIndexes, {
        craftingRecipeKey: source.CraftingRecipeKey,
      });
    } catch {
      detail = null;
    }
    if (detail !== null) {
      expect(materialReads).toBe(1);
      expect(detail.rawMaterial).toBe(source.Material);
      expect(detail.parsedMaterials[0]?.itemKey).not.toBe(999999);
    } else {
      expect(materialReads).toBeLessThanOrEqual(1);
    }
  });

  test("page membership rejects details outside the bound page and keeps DropKey non-selected", () => {
    const page0 = discordHeroCraftingRecipePage(indexes, 0);
    const page0Keys = new Set(page0.rows.map((row) => row.craftingRecipeKey));
    const outside = indexes.tables.crafting_recipes.rows.find(
      (row) => !page0Keys.has(row.CraftingRecipeKey),
    )!;
    expect(page0Keys.has(outside.CraftingRecipeKey)).toBe(false);

    // Detail by key remains valid globally (catalog membership), but page
    // helpers only expose the bound slice — 25 max.
    expect(page0.rows.length).toBeLessThanOrEqual(25);
    const page0Detail = discordHeroCraftingRecipeDetail(indexes, {
      craftingRecipeKey: page0.rows[0]!.craftingRecipeKey,
    });
    expect(page0Keys.has(page0Detail.craftingRecipeKey)).toBe(true);

    const outsideDetail = discordHeroCraftingRecipeDetail(indexes, {
      craftingRecipeKey: outside.CraftingRecipeKey,
    });
    expect(page0Keys.has(outsideDetail.craftingRecipeKey)).toBe(false);
    expect(outsideDetail.dropReference.selectionStatus).toBe(
      "unresolved-reference",
    );

    const serialized = JSON.stringify({
      browser: projectDiscordHeroCraftingBrowser(indexes),
      page0,
      outsideDetail,
    }).toLowerCase();
    expect(forbiddenCopyHits(serialized)).toEqual([]);
  });
});
