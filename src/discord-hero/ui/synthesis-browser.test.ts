import { beforeAll, describe, expect, test } from "bun:test";
import { types as nodeUtilTypes } from "node:util";
import {
  buildCatalogIndexes,
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";

const browserModule = await import("./synthesis-browser").catch(() => null);

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

type Api = {
  DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE: number;
  DISCORD_HERO_SYNTHESIS_RECIPE_COUNT: number;
  DISCORD_HERO_SYNTHESIS_DROP_COUNT: number;
  DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER: string;
  projectDiscordHeroSynthesisBrowser: (ix: unknown) => any;
  discordHeroSynthesisPageCount: (ix: unknown, section: unknown) => number;
  discordHeroSynthesisPage: (ix: unknown, input: unknown) => any;
  discordHeroSynthesisDetail: (ix: unknown, input: unknown) => any;
  discordHeroSynthesisTextRows: (
    ix: unknown,
    input: unknown,
  ) => readonly string[];
};

function api(): Api {
  expect(browserModule).not.toBeNull();
  const candidate = browserModule as Partial<Api> | null;
  for (const name of [
    "DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE",
    "DISCORD_HERO_SYNTHESIS_RECIPE_COUNT",
    "DISCORD_HERO_SYNTHESIS_DROP_COUNT",
    "DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER",
    "projectDiscordHeroSynthesisBrowser",
    "discordHeroSynthesisPageCount",
    "discordHeroSynthesisPage",
    "discordHeroSynthesisDetail",
    "discordHeroSynthesisTextRows",
  ] as const) {
    expect(candidate?.[name]).toBeDefined();
  }
  return candidate as Api;
}

function expectDeeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child, seen);
}

/** Replace one table's rows without touching the caller's original object. */
function withRows(
  base: DiscordHeroCatalogIndexes,
  dataset: keyof DiscordHeroCatalogIndexes["tables"],
  rows: readonly unknown[],
): DiscordHeroCatalogIndexes {
  return {
    ...base,
    tables: {
      ...base.tables,
      [dataset]: { ...base.tables[dataset], rows },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

describe("DiscordHero synthesis source browser", () => {
  // Break caught: page arithmetic derived from anything but the pinned 533/203
  // source row counts at PAGE_SIZE 25.
  test("pins 533 recipes over 22 pages and 203 drops over 9 pages", () => {
    const {
      DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE,
      DISCORD_HERO_SYNTHESIS_RECIPE_COUNT,
      DISCORD_HERO_SYNTHESIS_DROP_COUNT,
      discordHeroSynthesisPageCount,
      discordHeroSynthesisPage,
    } = api();

    expect(DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE).toBe(25);
    expect(DISCORD_HERO_SYNTHESIS_RECIPE_COUNT).toBe(533);
    expect(DISCORD_HERO_SYNTHESIS_DROP_COUNT).toBe(203);
    expect(discordHeroSynthesisPageCount(indexes, "recipes")).toBe(22);
    expect(discordHeroSynthesisPageCount(indexes, "drops")).toBe(9);

    const recipeSizes = Array.from(
      { length: 22 },
      (_, page) =>
        discordHeroSynthesisPage(indexes, { section: "recipes", page }).rows
          .length,
    );
    expect(recipeSizes).toEqual([...Array(21).fill(25), 8]);
    expect(recipeSizes.reduce((total, size) => total + size, 0)).toBe(533);

    const dropSizes = Array.from(
      { length: 9 },
      (_, page) =>
        discordHeroSynthesisPage(indexes, { section: "drops", page }).rows
          .length,
    );
    expect(dropSizes).toEqual([...Array(8).fill(25), 3]);
    expect(dropSizes.reduce((total, size) => total + size, 0)).toBe(203);
  });

  // Break caught: sorting or re-keying the corpus. Source keys are NOT
  // ascending, so any sort silently reorders the browser.
  test("preserves exact source row order across every page", () => {
    const { discordHeroSynthesisPage } = api();
    const recipeKeys = Array.from(
      { length: 22 },
      (_, page) =>
        discordHeroSynthesisPage(indexes, { section: "recipes", page }).rows,
    )
      .flat()
      .map((row: any) => row.synthesisRecipeKey);
    const sourceKeys = indexes.tables.synthesis_recipes.rows.map(
      (row) => row.SynthesisRecipeKey,
    );

    expect(recipeKeys).toEqual(sourceKeys);
    // Guard the guard: the corpus is genuinely unsorted, so this is not a
    // tautology against an already-ascending list.
    expect(
      sourceKeys.every((key, i) => i === 0 || sourceKeys[i - 1]! < key),
    ).toBe(false);

    const dropKeys = Array.from(
      { length: 9 },
      (_, page) =>
        discordHeroSynthesisPage(indexes, { section: "drops", page }).rows,
    )
      .flat()
      .map((row: any) => row.synthesisDropKey);
    expect(dropKeys).toEqual(
      indexes.tables.synthesis_drops.rows.map((row) => row.SynthesisDropKey),
    );
  });

  // Break caught: any dropped or renamed raw recipe field.
  test("preserves every raw recipe field verbatim", () => {
    const { discordHeroSynthesisPage } = api();
    const first = discordHeroSynthesisPage(indexes, {
      section: "recipes",
      page: 0,
    }).rows[0];

    expect(first).toMatchObject({
      rowIndex: 0,
      synthesisRecipeKey: 10100110,
      recipeTier: 1,
      minMaterialTier: 1,
      minResultLevel: 1,
      maxResultLevel: 1,
      itemSynthesisType: "Gear",
      grade: "COMMON",
      materialAmount: 9,
      minMaterialAverageLevel: 1,
      levelWeights: [100, 0, 0, 0],
    });

    const source = indexes.tables.synthesis_recipes.rows;
    for (const page of Array.from({ length: 22 }, (_, index) =>
      discordHeroSynthesisPage(indexes, { section: "recipes", page: index }),
    )) {
      for (const row of page.rows as any[]) {
        const raw = source[row.rowIndex]!;
        expect({
          synthesisRecipeKey: row.synthesisRecipeKey,
          recipeTier: row.recipeTier,
          minMaterialTier: row.minMaterialTier,
          minResultLevel: row.minResultLevel,
          maxResultLevel: row.maxResultLevel,
          itemSynthesisType: row.itemSynthesisType,
          grade: row.grade,
          materialAmount: row.materialAmount,
          minMaterialAverageLevel: row.minMaterialAverageLevel,
          levelWeights: row.levelWeights,
        }).toEqual({
          synthesisRecipeKey: raw.SynthesisRecipeKey,
          recipeTier: raw.RecipeTier,
          minMaterialTier: raw.MinMaterialTier,
          minResultLevel: raw.MinResultLevel,
          maxResultLevel: raw.MaxResultLevel,
          itemSynthesisType: raw.ItemSynthesisType,
          grade: raw.GRADE,
          materialAmount: raw.MaterialAmount,
          minMaterialAverageLevel: raw.MinMaterialAverageLevel,
          levelWeights: [
            raw.LevelWeight1,
            raw.LevelWeight2,
            raw.LevelWeight3,
            raw.LevelWeight4,
          ],
        });
      }
    }
  });

  // Break caught: labelling the span by picking a level, or miscounting the
  // exact-vs-ranged split.
  test("labels exactly 525 ranged and 8 exact result spans without choosing a level", () => {
    const { discordHeroSynthesisPage } = api();
    const rows = Array.from(
      { length: 22 },
      (_, page) =>
        discordHeroSynthesisPage(indexes, { section: "recipes", page }).rows,
    ).flat() as any[];

    expect(
      rows.filter((row) => row.resultLevelSpan.kind === "ranged"),
    ).toHaveLength(525);
    expect(
      rows.filter((row) => row.resultLevelSpan.kind === "exact"),
    ).toHaveLength(8);
    for (const row of rows) {
      expect(row.resultLevelSpan.kind).toBe(
        row.minResultLevel === row.maxResultLevel ? "exact" : "ranged",
      );
      // No chosen level may leak into the span descriptor.
      expect(Object.keys(row.resultLevelSpan).sort()).toEqual([
        "kind",
        "maxResultLevel",
        "minResultLevel",
        "selectionStatus",
      ]);
      expect(row.resultLevelSpan.selectionStatus).toBe("runtime-oracle-gated");
    }
  });

  // Break caught: dropping raw drop fields, the resolved grade, or the ordered
  // DropKey reference summary.
  test("preserves every raw drop field with resolved grade and ordered drop reference", () => {
    const { discordHeroSynthesisPage } = api();
    const first = discordHeroSynthesisPage(indexes, {
      section: "drops",
      page: 0,
    }).rows[0];

    expect(first).toMatchObject({
      rowIndex: 0,
      synthesisDropKey: 10010001,
      itemLevel: 1,
      recipeTier: 1,
      itemSynthesisType: "Gear",
      grade: "UNCOMMON",
      dropKey: 3111011,
    });
    expect(first.gradeReference).toMatchObject({
      kind: "resolved",
      grade: "UNCOMMON",
    });
    expect(first.dropReference).toMatchObject({
      kind: "source-drop-reference",
      dropKey: 3111011,
      selectionStatus: "runtime-oracle-gated",
    });
    expect(first.dropReference.sourceRowCount).toBeGreaterThan(0);
    // Ordered summary: reward entries are listed in exact catalog order.
    const sourceRows = indexes.tables.drops.rows.filter(
      (row) => row.DropKey === 3111011,
    );
    expect(first.dropReference.sourceRowCount).toBe(sourceRows.length);
    expect(first.dropReference.rewardKeys).toEqual(
      sourceRows.map((row) => row.RewardKey),
    );
  });

  // Break caught: page/detail divergence.
  test("returns identical entries from page and detail lookups", () => {
    const { discordHeroSynthesisPage, discordHeroSynthesisDetail } = api();
    const pageRow = discordHeroSynthesisPage(indexes, {
      section: "recipes",
      page: 3,
    }).rows[7];
    expect(
      discordHeroSynthesisDetail(indexes, {
        section: "recipes",
        synthesisRecipeKey: pageRow.synthesisRecipeKey,
      }),
    ).toEqual(pageRow);

    const dropRow = discordHeroSynthesisPage(indexes, {
      section: "drops",
      page: 2,
    }).rows[4];
    expect(
      discordHeroSynthesisDetail(indexes, {
        section: "drops",
        synthesisDropKey: dropRow.synthesisDropKey,
      }),
    ).toEqual(dropRow);
  });

  // Break caught: projection output silently selecting a level, recipe, drop
  // member, or reward member through an added selected/chosen field.
  test("emits no selected, chosen, or reward-member output fields", () => {
    const { discordHeroSynthesisPage } = api();
    const forbiddenFields = new Set([
      "selected",
      "chosen",
      "rewardMember",
      "rewardMembers",
      "rewardMemberKey",
      "selectedRewardKey",
      "chosenRewardKey",
    ]);
    const assertNoSelectionFields = (
      value: unknown,
      seen = new Set<object>(),
    ): void => {
      if (typeof value !== "object" || value === null || seen.has(value))
        return;
      seen.add(value);
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "string")
          expect(forbiddenFields.has(key)).toBe(false);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor !== undefined && "value" in descriptor) {
          assertNoSelectionFields(descriptor.value, seen);
        }
      }
    };

    for (const section of ["recipes", "drops"] as const) {
      const page = discordHeroSynthesisPage(indexes, { section, page: 0 });
      assertNoSelectionFields(page);
    }
    const drop = discordHeroSynthesisPage(indexes, {
      section: "drops",
      page: 0,
    }).rows[0];
    expect(drop.dropReference).not.toHaveProperty("selectedRewardKey");
  });

  // Break caught: unbounded or Discord-unsafe text rows.
  test("emits Discord-safe bounded text rows for every page", () => {
    const { discordHeroSynthesisTextRows } = api();
    for (const [section, pageCount] of [
      ["recipes", 22],
      ["drops", 9],
    ] as const) {
      for (let page = 0; page < pageCount; page += 1) {
        const rows = discordHeroSynthesisTextRows(indexes, { section, page });
        expect(rows.length).toBeLessThanOrEqual(25);
        for (const row of rows) {
          expect(row.length).toBeLessThanOrEqual(200);
          expect(row).not.toContain("`");
          expect(row).not.toContain("@");
          expect(row.codePointAt(0)).toBeDefined();
          expect(/[\u0000-\u001f\u007f-\u009f]/u.test(row)).toBe(false);
        }
        expect(rows.join("\n").length).toBeLessThanOrEqual(4_000);
      }
    }
  });

  // Break caught: shared or mutable output, or mutation of the caller's input.
  test("returns detached deeply frozen output and leaves the input unchanged", () => {
    const { discordHeroSynthesisPage, projectDiscordHeroSynthesisBrowser } =
      api();
    const before = JSON.stringify(indexes.tables.synthesis_recipes.rows);
    const dropsBefore = JSON.stringify(indexes.tables.synthesis_drops.rows);

    const first = discordHeroSynthesisPage(indexes, {
      section: "recipes",
      page: 0,
    });
    const second = discordHeroSynthesisPage(indexes, {
      section: "recipes",
      page: 0,
    });

    expectDeeplyFrozen(first);
    expectDeeplyFrozen(projectDiscordHeroSynthesisBrowser(indexes));
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.rows[0]).not.toBe(second.rows[0]);
    expect(first.rows[0]).not.toBe(indexes.tables.synthesis_recipes.rows[0]);
    expect(() => {
      (first.rows as unknown[]).push("forged");
    }).toThrow(TypeError);
    expect(JSON.stringify(indexes.tables.synthesis_recipes.rows)).toBe(before);
    expect(JSON.stringify(indexes.tables.synthesis_drops.rows)).toBe(
      dropsBefore,
    );
  });

  // Break caught: trusting caller-supplied counts, order, or shapes.
  test("fails closed on wrong count, duplicate keys, and malformed scalars", () => {
    const { discordHeroSynthesisPage } = api();
    const rows = indexes.tables.synthesis_recipes.rows;

    expect(() =>
      discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", rows.slice(0, 10)),
        {
          section: "recipes",
          page: 0,
        },
      ),
    ).toThrow(/533/);

    const duplicated = [rows[0], ...rows.slice(1)].map((row, index) =>
      index === 1 ? { ...rows[0]! } : { ...row! },
    );
    expect(() =>
      discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", duplicated),
        {
          section: "recipes",
          page: 0,
        },
      ),
    ).toThrow(/duplicate/i);

    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      -1,
      1.5,
    ]) {
      const patched = rows.map((row, index) =>
        index === 0 ? { ...row, RecipeTier: bad } : { ...row },
      );
      expect(() =>
        discordHeroSynthesisPage(
          withRows(indexes, "synthesis_recipes", patched),
          {
            section: "recipes",
            page: 0,
          },
        ),
      ).toThrow();
    }
  });

  // Break caught: honouring hostile row shapes instead of failing closed.
  test("fails closed on accessors, symbols, custom prototypes, and sparse arrays", () => {
    const { discordHeroSynthesisPage } = api();
    const rows = indexes.tables.synthesis_recipes.rows;
    const call = (patched: readonly unknown[]) =>
      discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", patched),
        {
          section: "recipes",
          page: 0,
        },
      );

    let getterReads = 0;
    const accessorRow: Record<string, unknown> = { ...rows[0]! };
    Object.defineProperty(accessorRow, "RecipeTier", {
      enumerable: true,
      configurable: true,
      get() {
        getterReads += 1;
        return 1;
      },
    });
    expect(() =>
      call([accessorRow, ...rows.slice(1).map((row) => ({ ...row }))]),
    ).toThrow();
    expect(getterReads).toBe(0);

    const symbolRow = { ...rows[0]!, [Symbol("forged")]: 1 };
    expect(() =>
      call([symbolRow, ...rows.slice(1).map((row) => ({ ...row }))]),
    ).toThrow();

    class ForgedRow {}
    const prototypeRow = Object.assign(new ForgedRow(), rows[0]!);
    expect(() =>
      call([prototypeRow, ...rows.slice(1).map((row) => ({ ...row }))]),
    ).toThrow();

    const sparse: unknown[] = rows.map((row) => ({ ...row }));
    delete sparse[5];
    expect(() => call(sparse)).toThrow(/sparse/i);
  });

  // Break caught: descriptor inspection reaching a Proxy row and letting its
  // traps mutate/read SynthesisRecipeKey before the row is rejected.
  test("rejects Proxy recipe rows trap-free without input mutation or partial output", () => {
    const { discordHeroSynthesisPage } = api();
    const target = { ...indexes.tables.synthesis_recipes.rows[0]! };
    const before = JSON.stringify(target);
    const traps = {
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      ownKeys: 0,
    };
    const hostile = new Proxy(target, {
      get(source, property, receiver) {
        traps.get += 1;
        return Reflect.get(source, property, receiver);
      },
      getOwnPropertyDescriptor(source, property) {
        traps.getOwnPropertyDescriptor += 1;
        source.SynthesisRecipeKey = 999_999_999;
        return Reflect.getOwnPropertyDescriptor(source, property);
      },
      getPrototypeOf(source) {
        traps.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(source);
      },
      ownKeys(source) {
        traps.ownKeys += 1;
        return Reflect.ownKeys(source);
      },
    });
    expect(nodeUtilTypes.isProxy(hostile)).toBe(true);
    const rows = indexes.tables.synthesis_recipes.rows.map((row, index) =>
      index === 0 ? hostile : { ...row },
    );

    let escaped: unknown = "NO_OUTPUT";
    expect(() => {
      escaped = discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", rows),
        { section: "recipes", page: 0 },
      );
    }).toThrow(/Proxy/i);

    expect(escaped).toBe("NO_OUTPUT");
    expect(traps).toEqual({
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      ownKeys: 0,
    });
    expect(JSON.stringify(target)).toBe(before);
  });

  // Break caught: grade membership being accepted from a row whose identity or
  // GRADE can be forged through topology, accessors, symbols, or Proxy traps.
  test("rejects hostile grade join rows with no reads, mutation, or partial output", () => {
    const { discordHeroSynthesisPage } = api();
    const source = indexes.tables.grades.rows;
    const expectRejected = (row: unknown, pattern: RegExp) => {
      let escaped: unknown = "NO_OUTPUT";
      expect(() => {
        escaped = discordHeroSynthesisPage(
          withRows(indexes, "grades", [row, ...source.slice(1)]),
          { section: "recipes", page: 0 },
        );
      }).toThrow(pattern);
      expect(escaped).toBe("NO_OUTPUT");
    };

    const proxyTarget = { ...source[0]! };
    const proxyBefore = JSON.stringify(proxyTarget);
    let proxyTraps = 0;
    const proxyRow = new Proxy(proxyTarget, {
      get(sourceRow, property, receiver) {
        proxyTraps += 1;
        return Reflect.get(sourceRow, property, receiver);
      },
      getOwnPropertyDescriptor(sourceRow, property) {
        proxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(sourceRow, property);
      },
      getPrototypeOf(sourceRow) {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(sourceRow);
      },
      ownKeys(sourceRow) {
        proxyTraps += 1;
        return Reflect.ownKeys(sourceRow);
      },
    });
    expectRejected(proxyRow, /Proxy/i);
    expect(proxyTraps).toBe(0);
    expect(JSON.stringify(proxyTarget)).toBe(proxyBefore);

    const prototypeRow = Object.assign(
      Object.create({ forgedGrade: true }),
      source[0]!,
    );
    const prototypeBefore = JSON.stringify(prototypeRow);
    expectRejected(prototypeRow, /prototype/i);
    expect(JSON.stringify(prototypeRow)).toBe(prototypeBefore);

    const symbolRow = { ...source[0]!, [Symbol("forged-grade")]: "COMMON" };
    const symbolBefore = JSON.stringify(symbolRow);
    expectRejected(symbolRow, /symbol/i);
    expect(JSON.stringify(symbolRow)).toBe(symbolBefore);

    const customFieldRow = { ...source[0]!, forgedGrade: "COMMON" };
    const customFieldBefore = JSON.stringify(customFieldRow);
    expectRejected(customFieldRow, /unknown field/i);
    expect(JSON.stringify(customFieldRow)).toBe(customFieldBefore);

    let accessorReads = 0;
    const accessorRow = { ...source[0]! };
    Object.defineProperty(accessorRow, "GRADE", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        return source[0]!.GRADE;
      },
    });
    expectRejected(accessorRow, /own data|accessor/i);
    expect(accessorReads).toBe(0);
  });

  // Break caught: a drops join row supplying reward membership through a
  // forged prototype, symbol, accessor, or Proxy boundary.
  test("rejects hostile drop join rows with no reads, mutation, or partial output", () => {
    const { discordHeroSynthesisPage } = api();
    const source = indexes.tables.drops.rows;
    const expectRejected = (row: unknown, pattern: RegExp) => {
      let escaped: unknown = "NO_OUTPUT";
      expect(() => {
        escaped = discordHeroSynthesisPage(
          withRows(indexes, "drops", [row, ...source.slice(1)]),
          { section: "drops", page: 0 },
        );
      }).toThrow(pattern);
      expect(escaped).toBe("NO_OUTPUT");
    };

    const proxyTarget = { ...source[0]! };
    const proxyBefore = JSON.stringify(proxyTarget);
    let proxyTraps = 0;
    const proxyRow = new Proxy(proxyTarget, {
      get(sourceRow, property, receiver) {
        proxyTraps += 1;
        return Reflect.get(sourceRow, property, receiver);
      },
      getOwnPropertyDescriptor(sourceRow, property) {
        proxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(sourceRow, property);
      },
      getPrototypeOf(sourceRow) {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(sourceRow);
      },
      ownKeys(sourceRow) {
        proxyTraps += 1;
        return Reflect.ownKeys(sourceRow);
      },
    });
    expectRejected(proxyRow, /Proxy/i);
    expect(proxyTraps).toBe(0);
    expect(JSON.stringify(proxyTarget)).toBe(proxyBefore);

    const prototypeRow = Object.assign(
      Object.create({ forgedRewardKey: true }),
      source[0]!,
    );
    const prototypeBefore = JSON.stringify(prototypeRow);
    expectRejected(prototypeRow, /prototype/i);
    expect(JSON.stringify(prototypeRow)).toBe(prototypeBefore);

    const symbolRow = { ...source[0]!, [Symbol("forged-reward")]: 1 };
    const symbolBefore = JSON.stringify(symbolRow);
    expectRejected(symbolRow, /symbol/i);
    expect(JSON.stringify(symbolRow)).toBe(symbolBefore);

    const customFieldRow = { ...source[0]!, selectedRewardKey: 1 };
    const customFieldBefore = JSON.stringify(customFieldRow);
    expectRejected(customFieldRow, /unknown field/i);
    expect(JSON.stringify(customFieldRow)).toBe(customFieldBefore);

    let accessorReads = 0;
    const accessorRow = { ...source[0]! };
    Object.defineProperty(accessorRow, "RewardKey", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        return source[0]!.RewardKey;
      },
    });
    expectRejected(accessorRow, /own data|accessor/i);
    expect(accessorReads).toBe(0);
  });

  // Break caught: validating only the four tables consulted by this feature,
  // while accepting extra, symbolic, missing, accessor, or Proxy table slots.
  test("exact-snapshots the full canonical tables wrapper trap-free", () => {
    const { projectDiscordHeroSynthesisBrowser } = api();
    const expectRejected = (tables: unknown, pattern: RegExp) => {
      let escaped: unknown = "NO_OUTPUT";
      expect(() => {
        escaped = projectDiscordHeroSynthesisBrowser({
          ...indexes,
          tables,
        } as DiscordHeroCatalogIndexes);
      }).toThrow(pattern);
      expect(escaped).toBe("NO_OUTPUT");
    };

    const symbolTables = {
      ...indexes.tables,
      [Symbol("forged-table")]: indexes.tables.grades,
    };
    expectRejected(symbolTables, /symbol/i);

    const customTables = {
      ...indexes.tables,
      forged_table: indexes.tables.grades,
    };
    expectRejected(customTables, /unknown field/i);

    for (const dataset of [
      "synthesis_recipes",
      "synthesis_drops",
      "grades",
      "drops",
    ] as const) {
      const symbolTable = {
        ...indexes.tables[dataset],
        [Symbol(`forged-${dataset}`)]: true,
      };
      expectRejected({ ...indexes.tables, [dataset]: symbolTable }, /symbol/i);

      const customTable = {
        ...indexes.tables[dataset],
        forgedField: true,
      };
      expectRejected(
        { ...indexes.tables, [dataset]: customTable },
        /unknown field/i,
      );
    }

    const missingTables = { ...indexes.tables } as Record<string, unknown>;
    delete missingTables.heroes;
    expectRejected(missingTables, /missing field.*heroes/i);

    let accessorReads = 0;
    const accessorTables = { ...indexes.tables };
    Object.defineProperty(accessorTables, "heroes", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        return indexes.tables.heroes;
      },
    });
    expectRejected(accessorTables, /own data|accessor/i);
    expect(accessorReads).toBe(0);

    let proxyTraps = 0;
    const proxyTables = new Proxy(indexes.tables, {
      get(source, property, receiver) {
        proxyTraps += 1;
        return Reflect.get(source, property, receiver);
      },
      getOwnPropertyDescriptor(source, property) {
        proxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(source, property);
      },
      getPrototypeOf(source) {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(source);
      },
      ownKeys(source) {
        proxyTraps += 1;
        return Reflect.ownKeys(source);
      },
    });
    expectRejected(proxyTables, /Proxy/i);
    expect(proxyTraps).toBe(0);
    expect(Reflect.ownKeys(indexes.tables)).toEqual([
      ...DISCORD_HERO_DATASET_NAMES,
    ]);
  });

  // Break caught: Proxy detection happening after reflection on the indexes or
  // a required table shell, giving hostile traps authority over validation.
  test("rejects Proxy indexes and table shells before every reflection trap", () => {
    const { projectDiscordHeroSynthesisBrowser } = api();
    const trackedProxy = <T extends object>(target: T) => {
      let traps = 0;
      const proxy = new Proxy(target, {
        get(source, property, receiver) {
          traps += 1;
          return Reflect.get(source, property, receiver);
        },
        getOwnPropertyDescriptor(source, property) {
          traps += 1;
          return Reflect.getOwnPropertyDescriptor(source, property);
        },
        getPrototypeOf(source) {
          traps += 1;
          return Reflect.getPrototypeOf(source);
        },
        ownKeys(source) {
          traps += 1;
          return Reflect.ownKeys(source);
        },
      });
      return { proxy, trapCount: () => traps };
    };

    const hostileIndexes = trackedProxy(indexes);
    let escaped: unknown = "NO_OUTPUT";
    expect(() => {
      escaped = projectDiscordHeroSynthesisBrowser(hostileIndexes.proxy);
    }).toThrow(/Proxy/i);
    expect(escaped).toBe("NO_OUTPUT");
    expect(hostileIndexes.trapCount()).toBe(0);

    const hostileTable = trackedProxy(indexes.tables.synthesis_recipes);
    escaped = "NO_OUTPUT";
    expect(() => {
      escaped = projectDiscordHeroSynthesisBrowser({
        ...indexes,
        tables: {
          ...indexes.tables,
          synthesis_recipes: hostileTable.proxy,
        },
      });
    }).toThrow(/Proxy/i);
    expect(escaped).toBe("NO_OUTPUT");
    expect(hostileTable.trapCount()).toBe(0);
  });

  // Break caught: accepting caller-owned array metadata or obtaining indices
  // through holes, non-canonical numeric keys, accessors, or Proxy traps.
  test("accepts only length plus dense numeric own-data row indices", () => {
    const { discordHeroSynthesisPage } = api();
    const source = indexes.tables.synthesis_recipes.rows;
    const expectRejected = (
      dataset: keyof DiscordHeroCatalogIndexes["tables"],
      rows: readonly unknown[],
      pattern: RegExp,
    ) => {
      const beforeKeys = Reflect.ownKeys(rows);
      let escaped: unknown = "NO_OUTPUT";
      expect(() => {
        escaped = discordHeroSynthesisPage(withRows(indexes, dataset, rows), {
          section: "recipes",
          page: 0,
        });
      }).toThrow(pattern);
      expect(escaped).toBe("NO_OUTPUT");
      expect(Reflect.ownKeys(rows)).toEqual(beforeKeys);
    };

    for (const dataset of [
      "synthesis_recipes",
      "synthesis_drops",
      "grades",
      "drops",
    ] as const) {
      const datasetRows = [...indexes.tables[dataset].rows];
      Object.defineProperty(datasetRows, Symbol(`forged-${dataset}-slot`), {
        value: datasetRows[0],
        enumerable: true,
        configurable: true,
      });
      expectRejected(dataset, datasetRows, /symbol/i);

      const customRows = [...indexes.tables[dataset].rows] as unknown[] & {
        forged?: unknown;
      };
      customRows.forged = customRows[0];
      expectRejected(dataset, customRows, /unexpected own key|unknown field/i);
    }

    const sparseRows = [...source];
    delete sparseRows[5];
    expectRejected("synthesis_recipes", sparseRows, /sparse|dense|index/i);

    const nonDenseRows = [...source];
    Object.defineProperty(nonDenseRows, "01", {
      value: source[0],
      enumerable: true,
      configurable: true,
    });
    expectRejected(
      "synthesis_recipes",
      nonDenseRows,
      /unexpected own key|dense|index/i,
    );

    let accessorReads = 0;
    const accessorRows = [...source];
    Object.defineProperty(accessorRows, "0", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        return source[0];
      },
    });
    expectRejected("synthesis_recipes", accessorRows, /own data|accessor/i);
    expect(accessorReads).toBe(0);

    let proxyTraps = 0;
    const proxyRows = new Proxy([...source], {
      get(target, property, receiver) {
        proxyTraps += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        proxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        proxyTraps += 1;
        return Reflect.ownKeys(target);
      },
    });
    expect(nodeUtilTypes.isProxy(proxyRows)).toBe(true);
    let escaped: unknown = "NO_OUTPUT";
    expect(() => {
      escaped = discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", proxyRows),
        { section: "recipes", page: 0 },
      );
    }).toThrow(/Proxy/i);
    expect(escaped).toBe("NO_OUTPUT");
    expect(proxyTraps).toBe(0);
  });

  // Break caught: a dangling grade or drop reference silently rendering.
  test("fails closed on ghost grade and dangling drop references", () => {
    const { discordHeroSynthesisPage } = api();
    const recipeRows = indexes.tables.synthesis_recipes.rows.map(
      (row, index) =>
        index === 0 ? { ...row, GRADE: "GHOST_GRADE" } : { ...row },
    );
    expect(() =>
      discordHeroSynthesisPage(
        withRows(indexes, "synthesis_recipes", recipeRows),
        {
          section: "recipes",
          page: 0,
        },
      ),
    ).toThrow(/GHOST_GRADE|grade/i);

    const dropRows = indexes.tables.synthesis_drops.rows.map((row, index) =>
      index === 0 ? { ...row, DropKey: 999999999 } : { ...row },
    );
    expect(() =>
      discordHeroSynthesisPage(withRows(indexes, "synthesis_drops", dropRows), {
        section: "drops",
        page: 0,
      }),
    ).toThrow(/999999999|drop/i);
  });

  // Break caught: page inputs that escape the pinned range.
  test("rejects out-of-range and malformed page and section inputs", () => {
    const { discordHeroSynthesisPage, discordHeroSynthesisPageCount } = api();
    expect(() =>
      discordHeroSynthesisPage(indexes, { section: "recipes", page: 22 }),
    ).toThrow(/0-21/);
    expect(() =>
      discordHeroSynthesisPage(indexes, { section: "drops", page: 9 }),
    ).toThrow(/0-8/);
    for (const page of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        discordHeroSynthesisPage(indexes, { section: "recipes", page }),
      ).toThrow();
    }
    expect(() => discordHeroSynthesisPageCount(indexes, "materials")).toThrow();
    expect(() =>
      discordHeroSynthesisPage(indexes, {
        section: "recipes",
        page: 0,
        rng: () => 0,
      }),
    ).toThrow(/unknown field/i);
  });

  // Break caught: page input validation accepting descriptor values for
  // recipes/0, then ordinary property reads switching the call to drops/8.
  test("rejects Proxy page inputs before descriptor or get traps and leaks no output", () => {
    const { discordHeroSynthesisPage } = api();
    const target = { section: "recipes" as const, page: 0 };
    const before = JSON.stringify(target);
    let descriptorTraps = 0;
    let getTraps = 0;
    const hostile = new Proxy(target, {
      get(source, property, receiver) {
        getTraps += 1;
        if (property === "section") return "drops";
        if (property === "page") return 8;
        return Reflect.get(source, property, receiver);
      },
      getOwnPropertyDescriptor(source, property) {
        descriptorTraps += 1;
        return Reflect.getOwnPropertyDescriptor(source, property);
      },
    });
    expect(nodeUtilTypes.isProxy(hostile)).toBe(true);

    let escaped: unknown = "NO_OUTPUT";
    expect(() => {
      escaped = discordHeroSynthesisPage(indexes, hostile);
    }).toThrow(/Proxy/i);

    expect(escaped).toBe("NO_OUTPUT");
    expect(getTraps).toBe(0);
    expect(descriptorTraps).toBe(0);
    expect(JSON.stringify(target)).toBe(before);
  });

  // Break caught: detail lookup falling back across sections or to the first
  // row when a caller supplies a stale/unknown identity.
  test("rejects stale and cross-section detail identities without fallback output", () => {
    const { discordHeroSynthesisDetail } = api();
    const knownRecipeKey =
      indexes.tables.synthesis_recipes.rows[0]!.SynthesisRecipeKey;
    const knownDropKey =
      indexes.tables.synthesis_drops.rows[0]!.SynthesisDropKey;
    const cases: readonly unknown[] = [
      { section: "recipes", synthesisRecipeKey: 999_999_999 },
      { section: "drops", synthesisDropKey: 999_999_999 },
      { section: "recipes", synthesisRecipeKey: knownDropKey },
      { section: "drops", synthesisDropKey: knownRecipeKey },
      { section: "recipes", synthesisDropKey: knownDropKey },
      { section: "drops", synthesisRecipeKey: knownRecipeKey },
    ];

    for (const input of cases) {
      const before = JSON.stringify(input);
      let escaped: unknown = "NO_OUTPUT";
      expect(() => {
        escaped = discordHeroSynthesisDetail(indexes, input);
      }).toThrow(/unknown|missing|field|key/i);
      expect(escaped).toBe("NO_OUTPUT");
      expect(JSON.stringify(input)).toBe(before);
    }
  });

  // Break caught: acquiring rows or membership through any derived groups or
  // semanticReport path instead of rebuilding from trusted row snapshots.
  test("never reads any relevant groups or semanticReport authority", () => {
    const { discordHeroSynthesisPage } = api();
    let forbiddenAuthorityReads = 0;
    const poisonAuthority = new Proxy(Object.freeze({}), {
      get() {
        forbiddenAuthorityReads += 1;
        throw new Error("forbidden derived authority get");
      },
      getOwnPropertyDescriptor() {
        forbiddenAuthorityReads += 1;
        throw new Error("forbidden derived authority descriptor");
      },
      getPrototypeOf() {
        forbiddenAuthorityReads += 1;
        throw new Error("forbidden derived authority prototype");
      },
      ownKeys() {
        forbiddenAuthorityReads += 1;
        throw new Error("forbidden derived authority keys");
      },
    });
    const forged = {
      ...indexes,
      semanticReport: poisonAuthority,
      tables: {
        ...indexes.tables,
        synthesis_recipes: {
          ...indexes.tables.synthesis_recipes,
          groups: poisonAuthority,
        },
        synthesis_drops: {
          ...indexes.tables.synthesis_drops,
          groups: poisonAuthority,
        },
        grades: {
          ...indexes.tables.grades,
          groups: poisonAuthority,
        },
        drops: {
          ...indexes.tables.drops,
          groups: poisonAuthority,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    const recipePage = discordHeroSynthesisPage(forged, {
      section: "recipes",
      page: 0,
    });
    const dropPage = discordHeroSynthesisPage(forged, {
      section: "drops",
      page: 0,
    });
    expect(recipePage.rows).toHaveLength(25);
    expect(dropPage.rows).toHaveLength(25);
    expect(forbiddenAuthorityReads).toBe(0);
  });

  // Break caught: any nondeterminism sneaking into a pure projection.
  test("uses no RNG or clock", async () => {
    const { discordHeroSynthesisPage } = api();
    const originalRandom = Math.random;
    const originalNow = Date.now;
    let randomCalls = 0;
    let nowCalls = 0;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    Date.now = () => {
      nowCalls += 1;
      return 0;
    };
    try {
      discordHeroSynthesisPage(indexes, { section: "recipes", page: 4 });
      discordHeroSynthesisPage(indexes, { section: "drops", page: 4 });
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
    expect(randomCalls).toBe(0);
    expect(nowCalls).toBe(0);

    const source = await Bun.file(
      new URL("./synthesis-browser.ts", import.meta.url).pathname,
    ).text();
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(/);
  });

  // Break caught: the module claiming progression semantics it cannot prove.
  test("marks selection oracle-gated and claims no progression semantics", () => {
    const {
      DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER,
      projectDiscordHeroSynthesisBrowser,
      discordHeroSynthesisTextRows,
    } = api();

    expect(DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER).toContain(
      "runtime-oracle-gated",
    );
    const disclaimer = DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER.toLowerCase();
    expect(disclaimer).toContain("material suitability");
    expect(disclaimer).toContain("result-level choice");
    expect(disclaimer).toContain("result outcome");
    expect(disclaimer).toContain("drop-table member choice");
    expect(projectDiscordHeroSynthesisBrowser(indexes)).toMatchObject({
      recipeCount: 533,
      dropCount: 203,
      pageSize: 25,
      recipePageCount: 22,
      dropPageCount: 9,
    });

    const text = [
      ...discordHeroSynthesisTextRows(indexes, { section: "recipes", page: 0 }),
      ...discordHeroSynthesisTextRows(indexes, { section: "drops", page: 0 }),
      DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER,
    ]
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "craftable",
      "you can craft",
      "eligible",
      "guaranteed",
      "owned",
      "in your inventory",
      "acquired",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
