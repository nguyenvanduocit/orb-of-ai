import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  loadDiscordHeroCommunityMarket,
  type LoadedDiscordHeroCommunityMarket,
} from "../community-market/loader";
import {
  decodeDiscordHeroMarketKind,
  decodeDiscordHeroMarketPage,
  decodeDiscordHeroMarketTarget,
  discordHeroMarketPage,
  discordHeroMarketPageCount,
  encodeDiscordHeroMarketKind,
  encodeDiscordHeroMarketPage,
  encodeDiscordHeroMarketTarget,
  readDiscordHeroMarketDetail,
  type DiscordHeroMarketViewKind,
} from "./market";

let source: LoadedDiscordHeroCommunityMarket;
let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  source = await loadDiscordHeroCommunityMarket();
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const EXPECTED_KIND_COUNTS = {
  all: 945,
  confirmed: 935,
  unconfirmed: 10,
} as const satisfies Readonly<Record<DiscordHeroMarketViewKind, number>>;

const EXPECTED_PAGE_COUNTS = {
  all: 38,
  confirmed: 38,
  unconfirmed: 1,
} as const satisfies Readonly<Record<DiscordHeroMarketViewKind, number>>;

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;

function hasWholeCodePoints(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function replaceItemRow(
  itemKey: number,
  replacement: DiscordHeroDatasetRow<"items">,
): DiscordHeroCatalogIndexes {
  const rows = indexes.tables.items.rows.map((row) =>
    row.id === itemKey ? replacement : row,
  );
  const groups = new Map(indexes.tables.items.groups);
  groups.set(itemKey, [replacement]);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      items: {
        ...indexes.tables.items,
        rows,
        groups,
      },
    },
  };
}

function cloneSource(): Mutable<LoadedDiscordHeroCommunityMarket> {
  return structuredClone(source) as Mutable<LoadedDiscordHeroCommunityMarket>;
}

describe("DiscordHero Community Market views", () => {
  test("covers every row once in stable 25-row All, Confirmed, and Unconfirmed pages", () => {
    for (const kind of [
      "all",
      "confirmed",
      "unconfirmed",
    ] as const satisfies readonly DiscordHeroMarketViewKind[]) {
      expect(discordHeroMarketPageCount(source, indexes, kind)).toBe(
        EXPECTED_PAGE_COUNTS[kind],
      );
      const pages = Array.from(
        { length: EXPECTED_PAGE_COUNTS[kind] },
        (_, page) => discordHeroMarketPage(source, indexes, kind, page),
      );
      const options = pages.flatMap((page) => page.options);
      const expectedIndexes = source.pages.flatMap((row, rowIndex) =>
        kind === "all" || row.status === kind ? [rowIndex] : [],
      );

      expect(options).toHaveLength(EXPECTED_KIND_COUNTS[kind]);
      expect(options.map((option) => option.rowIndex)).toEqual(expectedIndexes);
      expect(new Set(options.map((option) => option.rowIndex)).size).toBe(
        EXPECTED_KIND_COUNTS[kind],
      );
      expect(
        pages.slice(0, -1).every((page) => page.options.length === 25),
      ).toBe(true);
      expect(pages.at(-1)?.options.length).toBe(
        kind === "all" ? 20 : kind === "confirmed" ? 10 : 10,
      );
      expect(
        pages.every(
          (page, pageIndex) =>
            page.kind === kind &&
            page.page === pageIndex &&
            page.pageCount === EXPECTED_PAGE_COUNTS[kind] &&
            page.totalItems === EXPECTED_KIND_COUNTS[kind],
        ),
      ).toBe(true);
    }

    expect(
      discordHeroMarketPage(source, indexes, "confirmed", 34).options.map(
        (option) => option.rowIndex,
      ),
    ).toEqual([
      ...Array.from({ length: 15 }, (_, offset) => 850 + offset),
      ...Array.from({ length: 10 }, (_, offset) => 875 + offset),
    ]);
    expect(
      discordHeroMarketPage(source, indexes, "unconfirmed", 0).options.map(
        (option) => option.rowIndex,
      ),
    ).toEqual(Array.from({ length: 10 }, (_, offset) => 865 + offset));
  });

  test("keeps every option within Discord limits and binds it to its exact source row", () => {
    let visited = 0;
    for (const kind of [
      "all",
      "confirmed",
      "unconfirmed",
    ] as const satisfies readonly DiscordHeroMarketViewKind[]) {
      for (let page = 0; page < EXPECTED_PAGE_COUNTS[kind]; page += 1) {
        for (const option of discordHeroMarketPage(source, indexes, kind, page)
          .options) {
          const decoded = decodeDiscordHeroMarketTarget(
            source,
            indexes,
            option.value,
          );
          const row = source.pages[option.rowIndex]!;

          expect(decoded).toEqual({
            kind,
            page,
            rowIndex: option.rowIndex,
            itemKey: row.catalogItem!.id,
            key: row.key,
          });
          expect(option.itemKey).toBe(row.catalogItem!.id);
          expect(option.key).toBe(row.key);
          for (const text of [option.label, option.description, option.value]) {
            expect(text.length).toBeLessThanOrEqual(100);
            expect(hasWholeCodePoints(text)).toBe(true);
          }
          visited += 1;
        }
      }
    }
    expect(visited).toBe(945 + 935 + 10);
  });

  test("returns every captured stat, history/order row, raw body, and provenance without truncation", () => {
    let historyRows = 0;
    let orderRows = 0;
    for (let rowIndex = 0; rowIndex < source.pages.length; rowIndex += 1) {
      const row = source.pages[rowIndex]!;
      const page = Math.floor(rowIndex / 25);
      const target = encodeDiscordHeroMarketTarget(
        source,
        indexes,
        "all",
        page,
        rowIndex,
      );
      const detail = readDiscordHeroMarketDetail(source, indexes, target);

      expect(detail.catalogItem).toEqual({
        key: row.catalogItem!.id,
        slug: row.key,
        name: row.catalogItem!.name,
        type: row.type,
        grade: row.grade,
      });
      expect(detail.stats).toEqual(row.stats);
      expect(detail.priceHistory).toEqual(row.priceHistory);
      expect(detail.orderBook).toEqual(row.orderBook);
      expect(detail.rawBody).toBe(row.rawBody);
      expect(detail.provenance.page).toEqual(row.source);
      expect(detail.provenance.artifact).toEqual(source.provenance);
      expect(detail.statusReason).toBe(
        row.status === "confirmed"
          ? "confirmed-market-snapshot"
          : "unconfirmed-steam-market",
      );
      historyRows += detail.priceHistory.rows.length;
      orderRows +=
        (detail.orderBook?.buyOrders.length ?? 0) +
        (detail.orderBook?.sellOrders.length ?? 0);
    }

    expect(historyRows).toBe(874);
    expect(orderRows).toBe(8966);
  });

  test("exposes exact representative source details including missing and locale values", () => {
    const first = readDiscordHeroMarketDetail(
      source,
      indexes,
      encodeDiscordHeroMarketTarget(source, indexes, "all", 0, 0),
    );
    expect(first).toMatchObject({
      kind: "all",
      page: 0,
      rowIndex: 0,
      target: "t-a-0-0-6hsz-303011-long-sword",
      key: "303011-long-sword",
      title: "Long Sword",
      status: "confirmed",
      statusReason: "confirmed-market-snapshot",
      catalogItem: {
        key: 303011,
        slug: "303011-long-sword",
        name: "Long Sword",
        type: "GEAR",
        grade: "LEGENDARY",
      },
      stats: {
        lowestAsk: { display: "$0.03", currency: "USD", amount: "0.03" },
        median: { display: "$0.03", currency: "USD", amount: "0.03" },
        volume24h: { display: "5", amount: "5" },
        bestBid: null,
        bestAsk: { display: "$0.03", currency: "USD", amount: "0.03" },
        spread: null,
      },
      provenance: {
        page: {
          path: "preferences/taskbarhero/market/303011-long-sword.md",
          sourceUrl: "https://taskbarhero.wiki/market/303011-long-sword",
          capturedAt: "2026-07-28T14:55:28Z",
          exportFormat: "goscrape-markdown/v2",
          sha256:
            "897f0f5f1931a15a56bd617e309947b68de7275758e4830cc40087789734bf55",
        },
        artifact: {
          sourceAggregateSha256:
            "58a167e2c843565c75a606df0baf308f5f0b9c74d5745a73f0a97fb28e0dd7af",
          compiledSha256:
            "2666cd73e453f7ca4239b2727859cc8fa58dce7cb9d3cb89a1e4dba5b6914967",
        },
      },
    });
    expect(first.priceHistory.rows).toEqual([
      {
        timestamp: "07-28 14:00",
        price: { display: "$0.03", currency: "USD", amount: "0.03" },
        volume: { display: "5", amount: "5" },
      },
    ]);
    expect(first.orderBook?.sellOrders).toHaveLength(8);
    expect(first.rawBody).toContain("Best bid\n\n—");

    const unconfirmedTarget = encodeDiscordHeroMarketTarget(
      source,
      indexes,
      "unconfirmed",
      0,
      865,
    );
    const unconfirmed = readDiscordHeroMarketDetail(
      source,
      indexes,
      unconfirmedTarget,
    );
    expect(unconfirmed).toMatchObject({
      kind: "unconfirmed",
      page: 0,
      rowIndex: 865,
      key: "id-150001",
      status: "unconfirmed",
      statusReason: "unconfirmed-steam-market",
      catalogItem: {
        key: 150001,
        slug: "id-150001",
        name: null,
        type: "MATERIAL",
        grade: "COMMON",
      },
      stats: {
        lowestAsk: null,
        median: null,
        volume24h: null,
        bestBid: null,
        bestAsk: null,
        spread: null,
      },
      orderBook: null,
    });
    expect(unconfirmed.priceHistory.rows).toEqual([]);
    expect(unconfirmed.rawBody).toContain(
      "has not been confirmed on the Steam market yet — prices may be missing",
    );
  });
});

describe("DiscordHero Community Market bound codecs", () => {
  test("round-trips canonical kind and page targets with exact bounds", () => {
    const expectedKindTargets = {
      all: "k-a",
      confirmed: "k-c",
      unconfirmed: "k-u",
    } as const;
    for (const kind of [
      "all",
      "confirmed",
      "unconfirmed",
    ] as const satisfies readonly DiscordHeroMarketViewKind[]) {
      const kindTarget = encodeDiscordHeroMarketKind(source, indexes, kind);
      expect(kindTarget).toBe(expectedKindTargets[kind]);
      expect(decodeDiscordHeroMarketKind(source, indexes, kindTarget)).toBe(
        kind,
      );
      for (let page = 0; page < EXPECTED_PAGE_COUNTS[kind]; page += 1) {
        const pageTarget = encodeDiscordHeroMarketPage(
          source,
          indexes,
          kind,
          page,
        );
        expect(
          decodeDiscordHeroMarketPage(source, indexes, pageTarget),
        ).toEqual({ kind, page });
      }
    }
    expect(encodeDiscordHeroMarketPage(source, indexes, "all", 37)).toBe(
      "p-a-11",
    );
    expect(encodeDiscordHeroMarketPage(source, indexes, "confirmed", 37)).toBe(
      "p-c-11",
    );
    expect(encodeDiscordHeroMarketPage(source, indexes, "unconfirmed", 0)).toBe(
      "p-u-0",
    );
  });

  test("round-trips all 945 exact row identities in every reachable view", () => {
    let targets = 0;
    for (const kind of [
      "all",
      "confirmed",
      "unconfirmed",
    ] as const satisfies readonly DiscordHeroMarketViewKind[]) {
      for (let page = 0; page < EXPECTED_PAGE_COUNTS[kind]; page += 1) {
        for (const option of discordHeroMarketPage(source, indexes, kind, page)
          .options) {
          expect(
            encodeDiscordHeroMarketTarget(
              source,
              indexes,
              kind,
              page,
              option.rowIndex,
            ),
          ).toBe(option.value);
          expect(
            decodeDiscordHeroMarketTarget(source, indexes, option.value),
          ).toEqual({
            kind,
            page,
            rowIndex: option.rowIndex,
            itemKey: option.itemKey,
            key: option.key,
          });
          targets += 1;
        }
      }
    }
    expect(targets).toBe(945 + 935 + 10);
  });

  test("rejects malformed, non-canonical, out-of-range, and cross-bound targets", () => {
    for (const value of ["k-", "k-all", "K-a", "k-a-extra"]) {
      expect(() => decodeDiscordHeroMarketKind(source, indexes, value)).toThrow(
        "kind target is malformed",
      );
    }
    for (const value of ["p-", "p-all-0", "P-a-0", "p-a--1"]) {
      expect(() => decodeDiscordHeroMarketPage(source, indexes, value)).toThrow(
        "page target is malformed",
      );
    }
    expect(() =>
      decodeDiscordHeroMarketPage(source, indexes, "p-a-00"),
    ).toThrow("page target is non-canonical");
    expect(() =>
      decodeDiscordHeroMarketPage(source, indexes, "p-a-12"),
    ).toThrow("page 38 is out of range");
    expect(() => decodeDiscordHeroMarketPage(source, indexes, "p-u-1")).toThrow(
      "page 1 is out of range",
    );

    for (const value of [
      "t-",
      "t-all-0-0-0-key",
      "T-a-0-0-0-key",
      "t-a--1-0-0-key",
      "t-a-0-0-0",
    ]) {
      expect(() =>
        decodeDiscordHeroMarketTarget(source, indexes, value),
      ).toThrow("detail target is malformed");
    }
    expect(() =>
      decodeDiscordHeroMarketTarget(
        source,
        indexes,
        "t-a-00-0-6hsz-303011-long-sword",
      ),
    ).toThrow("detail target is non-canonical");
    expect(() =>
      decodeDiscordHeroMarketTarget(
        source,
        indexes,
        "t-a-0-00-6hsz-303011-long-sword",
      ),
    ).toThrow("detail target is non-canonical");
    expect(() =>
      decodeDiscordHeroMarketTarget(source, indexes, "t-c-y-o1-37qp-id-150001"),
    ).toThrow("not on confirmed page 34");
    expect(() =>
      decodeDiscordHeroMarketTarget(
        source,
        indexes,
        "t-u-0-o1-6hsz-303011-long-sword",
      ),
    ).toThrow("does not match item key");
    expect(() =>
      decodeDiscordHeroMarketTarget(source, indexes, "t-u-0-o2-37qp-id-150001"),
    ).toThrow("does not match item key");
    expect(() =>
      decodeDiscordHeroMarketTarget(source, indexes, "t-u-0-o1-37qp-id-150002"),
    ).toThrow("does not match artifact row");

    for (const page of [-1, 38, 1.5, Number.NaN]) {
      expect(() =>
        encodeDiscordHeroMarketPage(source, indexes, "all", page),
      ).toThrow("out of range");
    }
    expect(() =>
      encodeDiscordHeroMarketTarget(source, indexes, "confirmed", 0, 865),
    ).toThrow("not on confirmed page 0");
    expect(() =>
      encodeDiscordHeroMarketTarget(source, indexes, "all", 0, 25),
    ).toThrow("not on all page 0");
  });
});

describe("DiscordHero Community Market validation and immutability", () => {
  test("fails closed on missing, duplicate, mismatched, and non-marketable catalog links", () => {
    const item = indexes.tables.items.rows.find(
      (candidate) => candidate.id === 303011,
    )!;

    const missingGroups = new Map(indexes.tables.items.groups);
    missingGroups.delete(303011);
    const missing = {
      ...indexes,
      tables: {
        ...indexes.tables,
        items: { ...indexes.tables.items, groups: missingGroups },
      },
    };
    expect(() => discordHeroMarketPage(source, missing, "all", 0)).toThrow(
      "catalog item 303011 must have exactly one indexed row",
    );

    const duplicateGroups = new Map(indexes.tables.items.groups);
    duplicateGroups.set(303011, [item, item]);
    const duplicate = {
      ...indexes,
      tables: {
        ...indexes.tables,
        items: { ...indexes.tables.items, groups: duplicateGroups },
      },
    };
    expect(() => discordHeroMarketPage(source, duplicate, "all", 0)).toThrow(
      "catalog item 303011 must have exactly one indexed row",
    );

    const mismatched = replaceItemRow(303011, {
      ...item,
      slug: "forged-long-sword",
    });
    expect(() => discordHeroMarketPage(source, mismatched, "all", 0)).toThrow(
      "catalog slug mismatch for market row 303011-long-sword",
    );

    const notMarketable = replaceItemRow(303011, {
      ...item,
      marketable: false,
    });
    expect(() =>
      discordHeroMarketPage(source, notMarketable, "all", 0),
    ).toThrow("catalog item 303011 is not marketable");
  });

  test("fails closed on artifact linkage and reconciliation tampering", () => {
    const missingLink = cloneSource();
    missingLink.pages[0]!.catalogItem = null;
    expect(() => discordHeroMarketPage(missingLink, indexes, "all", 0)).toThrow(
      "market row 303011-long-sword has no catalog item",
    );

    const duplicateLink = cloneSource();
    duplicateLink.pages[1]!.catalogItem = {
      ...duplicateLink.pages[1]!.catalogItem!,
      id: duplicateLink.pages[0]!.catalogItem!.id,
    };
    expect(() =>
      discordHeroMarketPage(duplicateLink, indexes, "all", 0),
    ).toThrow("duplicate market catalog item 303011");

    const mismatchedLink = cloneSource();
    mismatchedLink.pages[0]!.catalogItem!.slug = "forged-long-sword";
    expect(() =>
      discordHeroMarketPage(mismatchedLink, indexes, "all", 0),
    ).toThrow("market row key/catalog slug mismatch");

    const badReconciliation = cloneSource();
    badReconciliation.reconciliation.confirmedPages = 934;
    expect(() =>
      discordHeroMarketPage(badReconciliation, indexes, "all", 0),
    ).toThrow("reconciliation counts do not match market rows");

    const unresolved = cloneSource();
    unresolved.reconciliation.unresolvedPages.push({
      sourcePath: "preferences/taskbarhero/market/forged.md",
      catalogKey: "forged",
      reason: "no-unique-marketable-catalog-slug",
    });
    expect(() => discordHeroMarketPage(unresolved, indexes, "all", 0)).toThrow(
      "reconciliation contains unresolved catalog findings",
    );
  });

  test("truncates option text by UTF-16 units without splitting Unicode code points", () => {
    const unicodeSource = cloneSource();
    const unicodeName = `${"😀".repeat(60)} exact name`;
    const unicodeGrade = `${"🚀".repeat(60)} exact grade`;
    const unicodeType = `${"🧪".repeat(60)} exact type`;
    unicodeSource.pages[0]!.catalogItem!.name = unicodeName;
    unicodeSource.pages[0]!.catalogItem!.grade = unicodeGrade;
    unicodeSource.pages[0]!.catalogItem!.type = unicodeType;
    unicodeSource.pages[0]!.grade = unicodeGrade;
    unicodeSource.pages[0]!.type = unicodeType;
    const item = indexes.tables.items.rows.find(
      (candidate) => candidate.id === 303011,
    )!;
    const unicodeIndexes = replaceItemRow(303011, {
      ...item,
      name: { ...item.name!, "en-US": unicodeName },
      grade: unicodeGrade,
      type: unicodeType,
    });

    const option = discordHeroMarketPage(
      unicodeSource,
      unicodeIndexes,
      "all",
      0,
    ).options[0]!;
    expect(option.label.length).toBeLessThanOrEqual(100);
    expect(option.description.length).toBeLessThanOrEqual(100);
    expect(option.value.length).toBeLessThanOrEqual(100);
    expect(hasWholeCodePoints(option.label)).toBe(true);
    expect(hasWholeCodePoints(option.description)).toBe(true);
    expect(hasWholeCodePoints(option.value)).toBe(true);
    expect(option.label.endsWith("…")).toBe(true);
    expect(option.description.endsWith("…")).toBe(true);

    const detail = readDiscordHeroMarketDetail(
      unicodeSource,
      unicodeIndexes,
      option.value,
    );
    expect(detail.catalogItem.name).toBe(unicodeName);
    expect(detail.catalogItem.grade).toBe(unicodeGrade);
    expect(detail.catalogItem.type).toBe(unicodeType);
  });

  test("returns fresh deeply frozen alias-safe outputs without mutating inputs", () => {
    const sourceBefore = JSON.stringify(source);
    const firstItem = indexes.tables.items.rows.find(
      (candidate) => candidate.id === 303011,
    )!;
    const firstGroup = indexes.tables.items.groups.get(303011)!;
    const firstPage = discordHeroMarketPage(source, indexes, "all", 0);
    const secondPage = discordHeroMarketPage(source, indexes, "all", 0);
    const firstDetail = readDiscordHeroMarketDetail(
      source,
      indexes,
      firstPage.options[0]!.value,
    );
    const secondDetail = readDiscordHeroMarketDetail(
      source,
      indexes,
      secondPage.options[0]!.value,
    );

    expect(firstPage).not.toBe(secondPage);
    expect(firstPage.options).not.toBe(secondPage.options);
    expect(firstPage.options[0]).not.toBe(secondPage.options[0]);
    expect(firstDetail).not.toBe(secondDetail);
    expect(firstDetail.stats).not.toBe(source.pages[0]!.stats);
    expect(firstDetail.priceHistory).not.toBe(source.pages[0]!.priceHistory);
    expect(firstDetail.priceHistory.rows).not.toBe(
      source.pages[0]!.priceHistory.rows,
    );
    expect(firstDetail.orderBook).not.toBe(source.pages[0]!.orderBook);
    expect(firstDetail.provenance.page).not.toBe(source.pages[0]!.source);
    expect(firstDetail.provenance.artifact).not.toBe(source.provenance);

    for (const value of [
      firstPage,
      firstPage.options,
      firstPage.options[0],
      firstDetail,
      firstDetail.catalogItem,
      firstDetail.stats,
      firstDetail.stats.lowestAsk,
      firstDetail.priceHistory,
      firstDetail.priceHistory.rows,
      firstDetail.priceHistory.rows[0],
      firstDetail.orderBook,
      firstDetail.orderBook?.sellOrders,
      firstDetail.orderBook?.sellOrders[0],
      firstDetail.provenance,
      firstDetail.provenance.page,
      firstDetail.provenance.artifact,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }

    expect(() => {
      (firstDetail.priceHistory.rows as unknown as Array<unknown>).push(
        "tamper",
      );
    }).toThrow();
    expect(JSON.stringify(source)).toBe(sourceBefore);
    expect(indexes.tables.items.rows.find((row) => row.id === 303011)).toBe(
      firstItem,
    );
    expect(indexes.tables.items.groups.get(303011)).toBe(firstGroup);
  });
});
