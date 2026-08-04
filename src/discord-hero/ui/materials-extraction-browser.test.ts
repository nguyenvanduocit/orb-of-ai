import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  DISCORD_HERO_MATERIALS_EXTRACTION_DISCLAIMER,
  DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE,
  DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS,
  discordHeroMaterialsExtractionDetail,
  discordHeroMaterialsExtractionPage,
  discordHeroMaterialsExtractionPageCount,
  discordHeroMaterialsExtractionTextRows,
  formatDiscordHeroMaterialsExtractionSafeText,
  projectDiscordHeroMaterialsExtractionBrowser,
  type DiscordHeroMaterialsExtractionRow,
} from "./materials-extraction-browser";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectDeeplyFrozen(descriptor.value);
    }
  }
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

const NO_OUTPUT = Symbol("no output");

function expectFailClosed(run: () => unknown): Error {
  let output: unknown = NO_OUTPUT;
  let thrown: unknown = NO_OUTPUT;
  try {
    output = run();
  } catch (error) {
    thrown = error;
  }
  expect(output).toBe(NO_OUTPUT);
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(TypeError);
  return thrown as Error;
}

function allRows(
  section: "materials" | "extraction",
): readonly DiscordHeroMaterialsExtractionRow[] {
  const pageCount = discordHeroMaterialsExtractionPageCount(indexes, section);
  return Array.from({ length: pageCount }, (_unused, page) =>
    discordHeroMaterialsExtractionPage(indexes, { section, page }),
  ).flatMap((page) => page.rows);
}

describe("DiscordHero materials + extraction_costs source browser", () => {
  test("rejects a caller-created callable Proxy before any trap or reflection", () => {
    let traps = 0;
    const callableProxy = new Proxy(() => indexes, {
      apply() {
        traps += 1;
        return indexes;
      },
      get() {
        traps += 1;
        return indexes;
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        return undefined;
      },
      getPrototypeOf() {
        traps += 1;
        return Function.prototype;
      },
      ownKeys() {
        traps += 1;
        return [];
      },
    });

    const error = expectFailClosed(() =>
      projectDiscordHeroMaterialsExtractionBrowser(
        callableProxy as unknown as DiscordHeroCatalogIndexes,
      ),
    );

    expect(error.message).toMatch(/module-produced trusted catalog indexes/i);
    expect(traps).toBe(0);
  });

  test("rejects a caller-created revoked Proxy before proxy internals are read", () => {
    const revocable = Proxy.revocable(indexes, {});
    revocable.revoke();

    const error = expectFailClosed(() =>
      projectDiscordHeroMaterialsExtractionBrowser(revocable.proxy),
    );

    expect(error.message).toMatch(/module-produced trusted catalog indexes/i);
  });

  test("never warms a caller-created frozen facade with mutable private state", () => {
    class MutablePrivateFacade {
      #revision = 0;

      constructor() {
        Object.freeze(this);
      }

      get revision(): number {
        return this.#revision;
      }

      mutate(): void {
        this.#revision += 1;
      }
    }

    const facade = new MutablePrivateFacade();
    const hostileIndexes = Object.freeze({
      ...indexes,
      semanticReport: Object.freeze({
        ...indexes.semanticReport,
        rules: Object.freeze([...indexes.semanticReport.rules, facade]),
      }),
    }) as unknown as DiscordHeroCatalogIndexes;

    const coldError = expectFailClosed(() =>
      discordHeroMaterialsExtractionPageCount(hostileIndexes, "materials"),
    );
    facade.mutate();
    const warmError = expectFailClosed(() =>
      discordHeroMaterialsExtractionPageCount(hostileIndexes, "materials"),
    );

    expect(coldError.message).toMatch(
      /module-produced trusted catalog indexes/i,
    );
    expect(warmError.message).toBe(coldError.message);
    expect(facade.revision).toBe(1);
  });

  test("rejects a 200k-key caller object before Reflect.ownKeys can allocate its key list", () => {
    const wideIndexes = Object.freeze({
      ...Object.fromEntries(
        Array.from({ length: 200_000 }, (_unused, index) => [
          `hostile${index}`,
          index,
        ]),
      ),
      ...indexes,
    }) as DiscordHeroCatalogIndexes;
    const originalOwnKeys = Reflect.ownKeys;
    let wideOwnKeysCalls = 0;
    let rejection: Error | undefined;

    Reflect.ownKeys = (value: object): (string | symbol)[] => {
      if (value === wideIndexes) wideOwnKeysCalls += 1;
      return originalOwnKeys(value);
    };
    try {
      rejection = expectFailClosed(() =>
        projectDiscordHeroMaterialsExtractionBrowser(wideIndexes),
      );
    } finally {
      Reflect.ownKeys = originalOwnKeys;
    }

    expect(rejection?.message).toMatch(
      /module-produced trusted catalog indexes/i,
    );
    expect(wideOwnKeysCalls).toBe(0);
  });

  test("rejects a caller clone before consulting either row cache", () => {
    const callerClone = Object.freeze({
      ...indexes,
    }) as DiscordHeroCatalogIndexes;
    const descriptor = Object.getOwnPropertyDescriptor(
      WeakMap.prototype,
      "get",
    )!;
    let cacheReads = 0;
    let rejection: Error | undefined;

    Object.defineProperty(WeakMap.prototype, "get", {
      ...descriptor,
      value(this: WeakMap<object, unknown>, key: object): unknown {
        if (key === callerClone) cacheReads += 1;
        return Reflect.apply(descriptor.value, this, [key]) as unknown;
      },
    });
    try {
      rejection = expectFailClosed(() =>
        discordHeroMaterialsExtractionPageCount(callerClone, "materials"),
      );
    } finally {
      Object.defineProperty(WeakMap.prototype, "get", descriptor);
    }

    expect(rejection?.message).toMatch(
      /module-produced trusted catalog indexes/i,
    );
    expect(cacheReads).toBe(0);
  });

  test("serves a fresh canonical authority cold and warm without catalog reflection", async () => {
    const canonicalIndexes = buildCatalogIndexes(
      await loadDiscordHeroCatalog(),
    );
    const originalOwnKeys = Reflect.ownKeys;
    let catalogOwnKeysCalls = 0;
    let warmAuthorityOwnKeysCalls = 0;
    let warmed = false;

    Reflect.ownKeys = (value: object): (string | symbol)[] => {
      if (value === canonicalIndexes.catalog) catalogOwnKeysCalls += 1;
      if (
        warmed &&
        (value === canonicalIndexes || value === canonicalIndexes.tables)
      ) {
        warmAuthorityOwnKeysCalls += 1;
      }
      return originalOwnKeys(value);
    };
    try {
      expect(
        projectDiscordHeroMaterialsExtractionBrowser(canonicalIndexes).sections,
      ).toHaveLength(2);
      warmed = true;
      for (let iteration = 0; iteration < 100; iteration += 1) {
        const section =
          iteration % 2 === 0
            ? ("materials" as const)
            : ("extraction" as const);
        expect(
          discordHeroMaterialsExtractionPageCount(canonicalIndexes, section),
        ).toBe(section === "materials" ? 5 : 4);
      }
    } finally {
      Reflect.ownKeys = originalOwnKeys;
    }

    expect(catalogOwnKeysCalls).toBe(0);
    expect(warmAuthorityOwnKeysCalls).toBe(0);
  });

  test("rejects the same mutable-catalog identity cold and after caller mutation", async () => {
    const mutableCatalog = {
      ...(await loadDiscordHeroCatalog()),
    } as unknown as { datasets: unknown };
    const mutableIndexes = buildCatalogIndexes(
      mutableCatalog as unknown as Parameters<typeof buildCatalogIndexes>[0],
    );
    const coldError = expectFailClosed(() =>
      discordHeroMaterialsExtractionPageCount(mutableIndexes, "extraction"),
    );

    let datasetsTraps = 0;
    const datasetsProxy = new Proxy(mutableCatalog.datasets as object, {
      get(target, property, receiver) {
        datasetsTraps += 1;
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        datasetsTraps += 1;
        return Reflect.ownKeys(target);
      },
    });
    mutableCatalog.datasets = datasetsProxy;

    const warmError = expectFailClosed(() =>
      discordHeroMaterialsExtractionPageCount(mutableIndexes, "materials"),
    );
    expect(coldError.message).toMatch(
      /module-produced trusted catalog indexes/i,
    );
    expect(warmError.message).toBe(coldError.message);
    expect(datasetsTraps).toBe(0);
    expect(mutableCatalog.datasets).toBe(datasetsProxy);
  });

  test("exposes the exact canonical section and page shapes", () => {
    expect([...DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS]).toEqual([
      "materials",
      "extraction",
    ]);
    expect(DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE).toBe(25);

    const browser = projectDiscordHeroMaterialsExtractionBrowser(indexes);
    expect(browser).toEqual({
      sections: [
        { section: "materials", rowCount: 125, pageCount: 5 },
        { section: "extraction", rowCount: 90, pageCount: 4 },
      ],
      disclaimer: DISCORD_HERO_MATERIALS_EXTRACTION_DISCLAIMER,
    });
    expect(sha256(browser)).toBe(
      "edcfe6a3af7f3be9090890e1fe2305cdd68d91758adf25574bd751b025ffd62e",
    );
    expectDeeplyFrozen(browser);

    expect(
      Array.from(
        { length: 5 },
        (_unused, page) =>
          discordHeroMaterialsExtractionPage(indexes, {
            section: "materials",
            page,
          }).rows.length,
      ),
    ).toEqual([25, 25, 25, 25, 25]);
    expect(
      Array.from(
        { length: 4 },
        (_unused, page) =>
          discordHeroMaterialsExtractionPage(indexes, {
            section: "extraction",
            page,
          }).rows.length,
      ),
    ).toEqual([25, 25, 25, 15]);
  });

  test("preserves all 125 materials in canonical order with exact joins and provenance", () => {
    const rows = allRows("materials");
    expect(rows).toHaveLength(125);
    expect(sha256(rows)).toBe(
      "1aa709b2fad481327073691036feb5ecbecd5e2a92e746413eb5f3ebfd97fc22",
    );
    expect(
      rows.filter(
        (row) =>
          row.section === "materials" && row.statModGroup.kind === "none",
      ),
    ).toHaveLength(46);
    expect(
      rows.filter(
        (row) =>
          row.section === "materials" && row.statModGroup.kind === "resolved",
      ),
    ).toHaveLength(79);
    expect(rows.map((row) => row.rowIndex)).toEqual(
      Array.from({ length: 125 }, (_unused, index) => index),
    );

    expect(rows[0]).toEqual({
      section: "materials",
      rowIndex: 0,
      itemKey: 110001,
      materialType: "DECORATION",
      statModGroup: {
        kind: "resolved",
        rawStatModGroupKey: 1100011,
        statModGroupIndex: 0,
        statModGroupRowIndexes: [0, 1, 2],
      },
      topologyProvenance: { table: "materials", rowIndex: 0 },
      item: {
        kind: "resolved",
        itemKey: 110001,
        name: "Minor Ruby",
        type: "MATERIAL",
        grade: "COMMON",
      },
    });
    expect(rows[124]).toMatchObject({
      section: "materials",
      rowIndex: 124,
      itemKey: 190004,
      materialType: "SOULSTONE",
      statModGroup: { kind: "none", rawStatModGroupKey: null },
      topologyProvenance: { table: "materials", rowIndex: 124 },
      item: {
        kind: "resolved",
        itemKey: 190004,
        name: "Soulstone - Torment",
        type: "MATERIAL",
        grade: "CELESTIAL",
      },
    });

    for (const [rowIndex, row] of rows.entries()) {
      const detail = discordHeroMaterialsExtractionDetail(indexes, {
        section: "materials",
        rowIndex,
      });
      expect(detail).toEqual(row);
      expect(detail).not.toBe(row);
      expectDeeplyFrozen(detail);
    }
  });

  test("preserves all 90 extraction rows in canonical order with exact provenance", () => {
    const rows = allRows("extraction");
    expect(rows).toHaveLength(90);
    expect(sha256(rows)).toBe(
      "3c84e946dbc877240573473ce89c0fabe3f4bc3833ee2dd9dbdcc78517f21388",
    );
    expect(rows.map((row) => row.rowIndex)).toEqual(
      Array.from({ length: 90 }, (_unused, index) => index),
    );
    expect(rows[0]).toEqual({
      section: "extraction",
      rowIndex: 0,
      extractionKey: 10101,
      gearGroup: "WEAPON",
      materialType: "DECORATION",
      tier: 1,
      cost: 100,
      provenance: {
        table: "extraction_costs",
        primaryField: "ExtractionKey",
        rowIndex: 0,
      },
    });
    expect(rows[89]).toEqual({
      section: "extraction",
      rowIndex: 89,
      extractionKey: 30310,
      gearGroup: "ACCESSORY",
      materialType: "INSCRIPTION",
      tier: 10,
      cost: 200_000,
      provenance: {
        table: "extraction_costs",
        primaryField: "ExtractionKey",
        rowIndex: 89,
      },
    });

    for (const [rowIndex, row] of rows.entries()) {
      expect(
        discordHeroMaterialsExtractionDetail(indexes, {
          section: "extraction",
          rowIndex,
        }),
      ).toEqual(row);
    }
  });

  test("renders the exact canonical text corpus as Discord-safe source preview", () => {
    const materialsText = Array.from({ length: 5 }, (_unused, page) =>
      discordHeroMaterialsExtractionTextRows(indexes, {
        section: "materials",
        page,
      }),
    ).flat();
    const extractionText = Array.from({ length: 4 }, (_unused, page) =>
      discordHeroMaterialsExtractionTextRows(indexes, {
        section: "extraction",
        page,
      }),
    ).flat();

    expect(sha256(materialsText)).toBe(
      "d9c6a3c9e93a0427b43ee9b872edb70617ad9b4320df97ca489be472152551d7",
    );
    expect(sha256(extractionText)).toBe(
      "83af1fee076f07bfbbb25f3aa379b82dea71f082c69de04558a5f14b6100d7d2",
    );
    for (const line of [...materialsText, ...extractionText]) {
      expectDiscordSafePlainText(line);
      expect(line.toLowerCase()).toContain("source preview");
    }
    expect(materialsText[101]).toBe(
      "#101 material 150001 · id-150001 · CRAFTING · no-stat-mod-group · source preview",
    );
  });

  test("sanitizes hostile text and truncates without splitting Unicode", () => {
    expect(
      formatDiscordHeroMaterialsExtractionSafeText(
        "@everyone\n<@123>\t<@&456>\r<#789> `code`\u0000\u2028\ud800😀",
      ),
    ).toBe("＠everyone <＠123> <＠&456> <＃789> 'code'  �😀");
    expect(
      formatDiscordHeroMaterialsExtractionSafeText(
        "@here <#789> `slug`\u0007\udc00😀",
      ),
    ).toBe("＠here <＃789> 'slug' �😀");

    const truncated = formatDiscordHeroMaterialsExtractionSafeText(
      `@everyone ${"😀".repeat(120)}`,
    );
    expect(truncated).toBe(`＠everyone ${"😀".repeat(94)}…`);
    expect(truncated.length).toBe(199);
    expect(hasLoneSurrogate(truncated)).toBe(false);
  });

  test("returns detached frozen outputs without RNG, time, or input mutation", () => {
    const catalogBefore = sha256(indexes.catalog);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    let randomCalls = 0;
    let dateCalls = 0;

    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    Date.now = () => {
      dateCalls += 1;
      return 0;
    };
    try {
      const first = projectDiscordHeroMaterialsExtractionBrowser(indexes);
      const second = projectDiscordHeroMaterialsExtractionBrowser(indexes);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expectDeeplyFrozen(first);

      const page = discordHeroMaterialsExtractionPage(indexes, {
        section: "extraction",
        page: 0,
      });
      expect(page.rows[0]).not.toBe(
        indexes.tables.extraction_costs.rows[0] as unknown,
      );
      expect(() => {
        (page.rows as unknown as unknown[]).push({});
      }).toThrow(TypeError);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }

    expect(randomCalls).toBe(0);
    expect(dateCalls).toBe(0);
    expect(sha256(indexes.catalog)).toBe(catalogBefore);
  });

  test("fails closed on exact-own page and detail inputs", () => {
    expect(() =>
      discordHeroMaterialsExtractionPage(indexes, {
        section: "extraction",
        page: 4,
      }),
    ).toThrow(/outside 0-3/i);
    expect(() =>
      discordHeroMaterialsExtractionDetail(indexes, {
        section: "materials",
        rowIndex: 125,
      }),
    ).toThrow(/outside 0-124/i);
    expect(() =>
      discordHeroMaterialsExtractionPage(indexes, {
        section: "extraction",
        page: 0,
        extra: true,
      } as never),
    ).toThrow(/unknown field extra/i);

    let pageReads = 0;
    const accessorPage = { section: "extraction" } as Record<string, unknown>;
    Object.defineProperty(accessorPage, "page", {
      enumerable: true,
      get() {
        pageReads += 1;
        return 0;
      },
    });
    expect(() =>
      discordHeroMaterialsExtractionPage(indexes, accessorPage as never),
    ).toThrow(/own data property/i);
    expect(pageReads).toBe(0);

    expect(() =>
      discordHeroMaterialsExtractionPage(indexes, {
        section: "extraction",
        page: 0,
        [Symbol("hostile")]: true,
      } as never),
    ).toThrow(/symbol own keys/i);
  });
});
