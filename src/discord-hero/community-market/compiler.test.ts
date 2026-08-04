import { describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  compileDiscordHeroCommunityMarket,
  computeDiscordHeroCommunityMarketPayloadSha256,
  parseTaskbarHeroMarketPageMarkdown,
  serializeDiscordHeroCommunityMarket,
  validateDiscordHeroCommunityMarket,
  writeDiscordHeroCommunityMarket,
} from "./compiler";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const LONG_SWORD_PATH = join(
  PROJECT_ROOT,
  "preferences/taskbarhero/market/303011-long-sword.md",
);

describe("DiscordHero community market compiler", () => {
  test("compiles all sources and reports the reviewed 945/935 reconciliation", async () => {
    const market = await compileDiscordHeroCommunityMarket(PROJECT_ROOT);

    expect(market.format).toBe("discordhero-community-market/v1");
    expect(market.provenance).toMatchObject({
      sourceFiles: 947,
      sourceAggregateSha256:
        "58a167e2c843565c75a606df0baf308f5f0b9c74d5745a73f0a97fb28e0dd7af",
      landing: {
        path: "preferences/taskbarhero/market.md",
        sourceUrl: "https://taskbarhero.wiki/market",
        capturedAt: "2026-07-28T14:15:20Z",
        exportFormat: "goscrape-markdown/v2",
        sha256:
          "ec16acb28022497811d422ee8f10e9ee0cf868fd23df267bd486be2429647a23",
      },
      catalog: {
        path: "preferences/taskbarhero/raw-data/current/datasets/items.json",
        records: 5944,
        marketableRecords: 945,
        sha256:
          "0c89eb59b840a89eee7cbfb604899eabcfc3f295d4425ee723282cc440030e27",
      },
      pages: {
        directory: "preferences/taskbarhero/market",
        files: 945,
        capturedAtMin: "2026-07-28T14:55:09Z",
        capturedAtMax: "2026-07-28T14:59:12Z",
        exportFormat: "goscrape-markdown/v2",
      },
    });
    expect(market.pages).toHaveLength(945);
    expect(market.landing).toMatchObject({
      shownFrom: 1,
      shownTo: 48,
      declaredTotal: 935,
    });
    expect(market.reconciliation).toEqual({
      pageFiles: 945,
      landingDeclaredRecords: 935,
      catalogMarketableRecords: 945,
      confirmedPages: 935,
      unconfirmedPages: 10,
      pagesMinusLanding: 10,
      pagesMinusCatalog: 0,
      catalogMinusLanding: 10,
      extraPages: Array.from({ length: 10 }, (_, index) => ({
        sourcePath: `preferences/taskbarhero/market/id-1500${String(index + 1).padStart(2, "0")}.md`,
        catalogItemId: 150001 + index,
        catalogSlug: `id-1500${String(index + 1).padStart(2, "0")}`,
        reason: "unconfirmed-steam-market",
      })),
      unresolvedPages: [],
      duplicateCatalogLinks: [],
      catalogRecordsWithoutPage: [],
    });

    expect(new Set(market.pages.map((page) => page.key)).size).toBe(945);
    expect(new Set(market.pages.map((page) => page.catalogItem!.id)).size).toBe(
      945,
    );
    expect(
      market.pages.every(
        (page) =>
          page.source.path.endsWith(`/${page.key}.md`) &&
          page.source.sourceUrl.endsWith(`/market/${page.key}`) &&
          page.source.exportFormat === "goscrape-markdown/v2" &&
          /^[0-9a-f]{64}$/.test(page.source.sha256) &&
          page.rawBody.endsWith("\n"),
      ),
    ).toBe(true);
    expect(
      market.pages.reduce(
        (rows, page) => rows + page.priceHistory.rows.length,
        0,
      ),
    ).toBe(874);
    expect(
      market.pages.reduce(
        (rows, page) =>
          rows +
          (page.orderBook?.buyOrders.length ?? 0) +
          (page.orderBook?.sellOrders.length ?? 0),
        0,
      ),
    ).toBe(8966);
    expect(market.pages.filter((page) => page.orderBook === null)).toHaveLength(
      33,
    );
  });

  test("parses missing values, locale prices, Unicode, history, and both order sides", async () => {
    const market = await compileDiscordHeroCommunityMarket(PROJECT_ROOT);
    const byKey = new Map(market.pages.map((page) => [page.key, page]));

    const longSword = byKey.get("303011-long-sword")!;
    expect(longSword.stats.bestBid).toBeNull();
    expect(longSword.stats.lowestAsk).toEqual({
      display: "$0.03",
      currency: "USD",
      amount: "0.03",
    });
    expect(longSword.priceHistory.rows).toEqual([
      {
        timestamp: "07-28 14:00",
        price: { display: "$0.03", currency: "USD", amount: "0.03" },
        volume: { display: "5", amount: "5" },
      },
    ]);
    expect(longSword.orderBook?.buyOrders).toEqual([]);
    expect(longSword.orderBook?.sellOrders).toHaveLength(8);
    expect(longSword.orderBook?.sellOrders[0]).toEqual({
      price: { display: "$0.03", currency: "USD", amount: "0.03" },
      quantity: { display: "343", amount: "343" },
    });

    expect(byKey.get("303091-rune-sword")?.stats.bestAsk).toEqual({
      display: "0,03 €",
      currency: "EUR",
      amount: "0.03",
    });
    expect(byKey.get("307171-dimensional-sword")?.stats.bestBid).toEqual({
      display: "£0.14",
      currency: "GBP",
      amount: "0.14",
    });
    expect(byKey.get("609141-eclipse-amulet")?.stats.bestAsk).toEqual({
      display: "1 019,63 €",
      currency: "EUR",
      amount: "1019.63",
    });
    expect(byKey.get("308111-fate-sword")?.orderBook?.buyOrders).toHaveLength(
      8,
    );
    expect(byKey.get("308111-fate-sword")?.orderBook?.sellOrders).toEqual([
      {
        price: { display: "$1,697.99", currency: "USD", amount: "1697.99" },
        quantity: { display: "1", amount: "1" },
      },
    ]);

    const unconfirmed = byKey.get("id-150001")!;
    expect(unconfirmed.status).toBe("unconfirmed");
    expect(unconfirmed.stats).toEqual({
      lowestAsk: null,
      median: null,
      volume24h: null,
      bestBid: null,
      bestAsk: null,
      spread: null,
    });
    expect(unconfirmed.priceHistory.rows).toEqual([]);
    expect(unconfirmed.orderBook).toBeNull();
    expect(unconfirmed.rawBody).toContain(
      "has not been confirmed on the Steam market yet — prices may be missing",
    );
  });

  test("accepts multiple structured price-history rows without dropping the raw body", async () => {
    const canonical = await readFile(LONG_SWORD_PATH, "utf8");
    const markdown = canonical.replace(
      "- Volume 5\n\n## Order book",
      "- Volume 5\n\n- 07-28 13:00\n- Price $0.02\n- Volume 4\n\n## Order book",
    );

    const parsed = parseTaskbarHeroMarketPageMarkdown(
      markdown,
      "preferences/taskbarhero/market/303011-long-sword.md",
    );

    expect(parsed.priceHistory.rows).toHaveLength(2);
    expect(parsed.priceHistory.rows[1]).toEqual({
      timestamp: "07-28 13:00",
      price: { display: "$0.02", currency: "USD", amount: "0.02" },
      volume: { display: "4", amount: "4" },
    });
    expect(parsed.rawBody).toContain("- 07-28 13:00");
    expect(parsed.orderBook?.sellOrders).toHaveLength(8);
  });

  test("fails closed on unknown frontmatter and malformed body fields", async () => {
    const canonical = await readFile(LONG_SWORD_PATH, "utf8");

    expect(() =>
      parseTaskbarHeroMarketPageMarkdown(
        canonical.replace(
          'export_format: "goscrape-markdown/v2"',
          'unexpected: "field"\nexport_format: "goscrape-markdown/v2"',
        ),
        "preferences/taskbarhero/market/303011-long-sword.md",
      ),
    ).toThrow("frontmatter differs from the strict market page schema");
    expect(() =>
      parseTaskbarHeroMarketPageMarkdown(
        canonical.replace("\nLowest ask\n\n$0.03", "\nLowest price\n\n$0.03"),
        "preferences/taskbarhero/market/303011-long-sword.md",
      ),
    ).toThrow("expected field Lowest ask");
    expect(() =>
      parseTaskbarHeroMarketPageMarkdown(
        canonical.replace("$0.03343", "$0.03 unknown"),
        "preferences/taskbarhero/market/303011-long-sword.md",
      ),
    ).toThrow("order row is malformed");
  });

  test("serializes deterministic canonical JSON and rejects unknown artifact fields", async () => {
    const first = await compileDiscordHeroCommunityMarket(PROJECT_ROOT);
    const second = await compileDiscordHeroCommunityMarket(PROJECT_ROOT);
    const firstBytes = serializeDiscordHeroCommunityMarket(first);
    const secondBytes = serializeDiscordHeroCommunityMarket(second);

    expect(secondBytes).toBe(firstBytes);
    expect(firstBytes.endsWith("\n")).toBe(true);
    expect(JSON.parse(firstBytes)).toEqual(first);
    expect(() =>
      validateDiscordHeroCommunityMarket({ ...first, unexpected: true }),
    ).toThrow("compiled artifact contains unexpected or missing fields");
    expect(() =>
      validateDiscordHeroCommunityMarket({
        ...first,
        pages: first.pages.map((page, index) =>
          index === 0 ? { ...page, unexpected: true } : page,
        ),
      }),
    ).toThrow("market page 1 contains unexpected or missing fields");
  });

  test("rejects content tamper even after its self-hash is recomputed", async () => {
    const market = structuredClone(
      await compileDiscordHeroCommunityMarket(PROJECT_ROOT),
    );
    market.pages[0]!.title = "Tampered";
    market.provenance.compiledSha256 =
      computeDiscordHeroCommunityMarketPayloadSha256(market);

    expect(() => validateDiscordHeroCommunityMarket(market)).toThrow(
      "compiled payload does not match the reviewed SHA-256",
    );
  });

  test("writes atomically, reports unchanged builds, and check does not mutate stale bytes", async () => {
    const { checkDiscordHeroCommunityMarket } = await import("./compiler");
    const outputRoot = await mkdtemp(
      join(tmpdir(), "discordhero-community-market-output-"),
    );
    const outputPath = join(outputRoot, "nested/community-market.json");
    try {
      const first = await writeDiscordHeroCommunityMarket(
        PROJECT_ROOT,
        outputPath,
      );
      const firstBytes = await readFile(outputPath, "utf8");
      const second = await writeDiscordHeroCommunityMarket(
        PROJECT_ROOT,
        outputPath,
      );

      expect(first.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(await readFile(outputPath, "utf8")).toBe(firstBytes);
      expect(await readdir(join(outputRoot, "nested"))).toEqual([
        "community-market.json",
      ]);

      const staleBytes = '{"stale":true}\n';
      await writeFile(outputPath, staleBytes, "utf8");
      await expect(
        checkDiscordHeroCommunityMarket(PROJECT_ROOT, outputPath),
      ).rejects.toThrow("does not match generated community market");
      expect(await readFile(outputPath, "utf8")).toBe(staleBytes);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  test("a source validation failure preserves an existing artifact", async () => {
    const projectRoot = await mkdtemp(
      join(tmpdir(), "discordhero-community-market-invalid-source-"),
    );
    const outputPath = join(
      projectRoot,
      "assets/discordhero/community-market.json",
    );
    const existingBytes = '{"keep":"me"}\n';
    await mkdir(join(projectRoot, "assets/discordhero"), { recursive: true });
    await writeFile(outputPath, existingBytes, "utf8");
    try {
      await expect(
        writeDiscordHeroCommunityMarket(projectRoot, outputPath),
      ).rejects.toThrow();
      expect(await readFile(outputPath, "utf8")).toBe(existingBytes);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
