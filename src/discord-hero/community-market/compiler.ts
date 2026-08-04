import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const SOURCE_MARKET_LANDING_PATH = "preferences/taskbarhero/market.md";
export const SOURCE_MARKET_DIRECTORY = "preferences/taskbarhero/market";
export const SOURCE_MARKET_CATALOG_PATH =
  "preferences/taskbarhero/raw-data/current/datasets/items.json";
export const SOURCE_MARKET_LANDING_SHA256 =
  "ec16acb28022497811d422ee8f10e9ee0cf868fd23df267bd486be2429647a23";
export const SOURCE_MARKET_CATALOG_SHA256 =
  "0c89eb59b840a89eee7cbfb604899eabcfc3f295d4425ee723282cc440030e27";
export const SOURCE_MARKET_AGGREGATE_SHA256 =
  "58a167e2c843565c75a606df0baf308f5f0b9c74d5745a73f0a97fb28e0dd7af";
export const COMMUNITY_MARKET_PAYLOAD_SHA256 =
  "2666cd73e453f7ca4239b2727859cc8fa58dce7cb9d3cb89a1e4dba5b6914967";
export const COMMUNITY_MARKET_FILE_SHA256 =
  "1ce1fe0016db53a60e6679b10a2845bcade6cdd98c166520a7837851992a8a3e";
export const EXPECTED_MARKET_PAGES = 945;
export const EXPECTED_LANDING_MARKET_RECORDS = 935;
export const EXPECTED_MARKETABLE_CATALOG_RECORDS = 945;
export const EXPECTED_CATALOG_RECORDS = 5944;
export const SOURCE_MARKET_EXPORT_FORMAT = "goscrape-markdown/v2";

const MARKET_SOURCE_URL = "https://taskbarhero.wiki/market";
const MARKET_LOCALES = [
  "de",
  "en",
  "es",
  "fr",
  "id",
  "ja",
  "ko",
  "pl",
  "pt-br",
  "ru",
  "th",
  "tr",
  "uk",
  "vi",
  "x-default",
  "zh-hans",
  "zh-hant",
] as const;
const UNCONFIRMED_MARKET_NOTICE =
  "This item has not been confirmed on the Steam market yet — prices may be missing until it is reconciled.";
const NO_HISTORY_NOTICE =
  "No price history yet — collection starts at market open.";
const NO_ORDER_BOOK_NOTICE = "No order-book snapshot yet.";

export interface DiscordHeroMarketMoney {
  display: string;
  currency: "USD" | "EUR" | "GBP";
  amount: string;
}

export interface DiscordHeroMarketQuantity {
  display: string;
  amount: string;
}

export interface DiscordHeroMarketSpread {
  money: DiscordHeroMarketMoney;
  percent: string;
}

export interface DiscordHeroMarketHistoryRow {
  timestamp: string;
  price: DiscordHeroMarketMoney;
  volume: DiscordHeroMarketQuantity;
}

export interface DiscordHeroMarketOrder {
  price: DiscordHeroMarketMoney;
  quantity: DiscordHeroMarketQuantity;
}

export interface DiscordHeroMarketCatalogItem {
  id: number;
  slug: string;
  name: string | null;
  grade: string;
  type: string;
  evidence: "wiki-link-and-catalog-slug";
}

export interface DiscordHeroCommunityMarketPage {
  key: string;
  title: string;
  grade: string;
  type: string;
  status: "confirmed" | "unconfirmed";
  catalogItem: DiscordHeroMarketCatalogItem | null;
  source: {
    path: string;
    sourceUrl: string;
    capturedAt: string;
    exportFormat: string;
    sha256: string;
  };
  stats: {
    lowestAsk: DiscordHeroMarketMoney | null;
    median: DiscordHeroMarketMoney | null;
    volume24h: DiscordHeroMarketQuantity | null;
    bestBid: DiscordHeroMarketMoney | null;
    bestAsk: DiscordHeroMarketMoney | null;
    spread: DiscordHeroMarketSpread | null;
  };
  priceHistory: {
    currency: "USD";
    updated: string | null;
    rows: DiscordHeroMarketHistoryRow[];
  };
  orderBook: {
    updated: string;
    buyQuantity: DiscordHeroMarketQuantity;
    sellQuantity: DiscordHeroMarketQuantity;
    buyOrders: DiscordHeroMarketOrder[];
    sellOrders: DiscordHeroMarketOrder[];
  } | null;
  rawBody: string;
}

export interface DiscordHeroCommunityMarket {
  format: "discordhero-community-market/v1";
  provenance: {
    sourceFiles: number;
    sourceAggregateSha256: string;
    landing: {
      path: string;
      sourceUrl: string;
      capturedAt: string;
      exportFormat: string;
      sha256: string;
    };
    catalog: {
      path: string;
      records: number;
      marketableRecords: number;
      sha256: string;
    };
    pages: {
      directory: string;
      files: number;
      capturedAtMin: string;
      capturedAtMax: string;
      exportFormat: string;
    };
    compiledSha256: string;
  };
  landing: {
    shownFrom: number;
    shownTo: number;
    declaredTotal: number;
    rawBody: string;
  };
  reconciliation: {
    pageFiles: number;
    landingDeclaredRecords: number;
    catalogMarketableRecords: number;
    confirmedPages: number;
    unconfirmedPages: number;
    pagesMinusLanding: number;
    pagesMinusCatalog: number;
    catalogMinusLanding: number;
    extraPages: {
      sourcePath: string;
      catalogItemId: number;
      catalogSlug: string;
      reason: "unconfirmed-steam-market";
    }[];
    unresolvedPages: {
      sourcePath: string;
      catalogKey: string;
      reason: "no-unique-marketable-catalog-slug";
    }[];
    duplicateCatalogLinks: {
      catalogItemId: number;
      catalogSlug: string;
      sourcePaths: string[];
    }[];
    catalogRecordsWithoutPage: {
      catalogItemId: number;
      catalogSlug: string;
    }[];
  };
  pages: DiscordHeroCommunityMarketPage[];
}

interface ParsedLanding {
  sourceUrl: string;
  capturedAt: string;
  exportFormat: string;
  shownFrom: number;
  shownTo: number;
  declaredTotal: number;
  rawBody: string;
}

interface CatalogSourceItem {
  id: number;
  slug: string;
  name: string | null;
  grade: string;
  type: string;
}

type UnsignedDiscordHeroCommunityMarket = Omit<
  DiscordHeroCommunityMarket,
  "provenance"
> & {
  provenance: Omit<DiscordHeroCommunityMarket["provenance"], "compiledSha256">;
};

function fail(message: string): never {
  throw new Error(`DiscordHero community market: ${message}`);
}

function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    fail(message);
  }
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("\n")
  );
}

function normalizeBytes(source: string | Uint8Array): {
  bytes: Uint8Array;
  markdown: string;
} {
  const bytes =
    typeof source === "string" ? Buffer.from(source, "utf8") : source;
  const markdown = Buffer.from(bytes).toString("utf8");
  requireCondition(!markdown.includes("\r"), "source must use Unix newlines");
  requireCondition(
    markdown.startsWith("---\n"),
    "source must start with YAML frontmatter",
  );
  requireCondition(
    markdown.endsWith("\n") && !markdown.endsWith("\n\n"),
    "source must end with exactly one newline",
  );
  return { bytes, markdown };
}

function splitFrontmatter(source: string | Uint8Array): {
  bytes: Uint8Array;
  frontmatter: string;
  rawBody: string;
} {
  const { bytes, markdown } = normalizeBytes(source);
  const boundary = "\n---\n\n";
  const boundaryIndex = markdown.indexOf(boundary, 4);
  requireCondition(
    boundaryIndex >= 0,
    "source frontmatter is not terminated exactly",
  );
  return {
    bytes,
    frontmatter: markdown.slice(4, boundaryIndex),
    rawBody: markdown.slice(boundaryIndex + boundary.length),
  };
}

function quotedTopLevelValue(frontmatter: string, field: string): string {
  const prefix = `${field}: `;
  const lines = frontmatter
    .split("\n")
    .filter((line) => line.startsWith(prefix));
  requireCondition(
    lines.length === 1,
    `${field} must appear exactly once as a quoted top-level field`,
  );
  try {
    const parsed: unknown = JSON.parse(lines[0]!.slice(prefix.length));
    requireCondition(
      typeof parsed === "string",
      `${field} must be a quoted string`,
    );
    return parsed;
  } catch {
    fail(`${field} must be a quoted string`);
  }
}

function alternateUrl(locale: (typeof MARKET_LOCALES)[number], key?: string) {
  const effectiveLocale = locale === "pt-br" ? "pt" : locale;
  const localizedPrefix =
    locale === "en" || locale === "x-default" ? "" : `${effectiveLocale}/`;
  return `${MARKET_SOURCE_URL.replace("/market", `/${localizedPrefix}market`)}${key === undefined ? "" : `/${key}`}`;
}

function expectedFrontmatter(
  title: string,
  sourceUrl: string,
  capturedAt: string,
  key?: string,
): string {
  const breadcrumbs =
    key === undefined
      ? ['  - "Home"', '  - "Market"']
      : [
          '  - "Home"',
          '  - "Market"',
          `  - ${JSON.stringify(title.endsWith(" — Market") ? title : `${title} — Market`)}`,
        ];
  return [
    `title: ${JSON.stringify(title)}`,
    `source_url: ${JSON.stringify(sourceUrl)}`,
    `canonical_url: ${JSON.stringify(sourceUrl)}`,
    'language: "en"',
    "breadcrumbs:",
    ...breadcrumbs,
    "alternate_urls:",
    ...MARKET_LOCALES.map(
      (locale) =>
        `  ${JSON.stringify(locale)}: ${JSON.stringify(alternateUrl(locale, key))}`,
    ),
    `scraped_at: ${JSON.stringify(capturedAt)}`,
    `export_format: ${JSON.stringify(SOURCE_MARKET_EXPORT_FORMAT)}`,
  ].join("\n");
}

function parseMoney(display: string, context: string): DiscordHeroMarketMoney {
  const prefixMatch = display.match(
    /^([$£])((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})$/,
  );
  if (prefixMatch) {
    return {
      display,
      currency: prefixMatch[1] === "$" ? "USD" : "GBP",
      amount: prefixMatch[2]!.replaceAll(",", ""),
    };
  }
  const euroMatch = display.match(/^((?:\d{1,3}(?: \d{3})*|\d+),\d{2}) €$/);
  if (euroMatch) {
    return {
      display,
      currency: "EUR",
      amount: euroMatch[1]!.replaceAll(" ", "").replace(",", "."),
    };
  }
  fail(`${context} money is malformed: ${display}`);
}

function parseMaybeMoney(
  display: string,
  context: string,
): DiscordHeroMarketMoney | null {
  return display === "—" ? null : parseMoney(display, context);
}

function normalizeQuantity(display: string, context: string): string {
  const match = display.match(/^(\d+)(?:\.(\d+))?([kKmM])?$/);
  requireCondition(match, `${context} quantity is malformed: ${display}`);
  const fraction = match[2] ?? "";
  const digits = BigInt(`${match[1]}${fraction}`);
  const denominator = 10n ** BigInt(fraction.length);
  const suffix = match[3]?.toLowerCase();
  const multiplier = suffix === "k" ? 1_000n : suffix === "m" ? 1_000_000n : 1n;
  const scaled = digits * multiplier;
  requireCondition(
    scaled % denominator === 0n,
    `${context} quantity does not resolve to whole units: ${display}`,
  );
  return String(scaled / denominator);
}

function parseQuantity(
  display: string,
  context: string,
): DiscordHeroMarketQuantity {
  return { display, amount: normalizeQuantity(display, context) };
}

function parseMaybeQuantity(
  display: string,
  context: string,
): DiscordHeroMarketQuantity | null {
  return display === "—" ? null : parseQuantity(display, context);
}

function parseSpread(display: string): DiscordHeroMarketSpread | null {
  if (display === "—") {
    return null;
  }
  const match = display.match(/^(.+) \((\d+(?:\.\d+)?)%\)$/);
  requireCondition(match, `Spread is malformed: ${display}`);
  return {
    money: parseMoney(match[1]!, "Spread"),
    percent: match[2]!,
  };
}

function parseOrderRow(
  display: string,
  context: string,
): DiscordHeroMarketOrder {
  const prefixMatch = display.match(
    /^([$£])((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})(\d+)$/,
  );
  if (prefixMatch) {
    const moneyDisplay = `${prefixMatch[1]}${prefixMatch[2]}`;
    return {
      price: parseMoney(moneyDisplay, context),
      quantity: parseQuantity(prefixMatch[3]!, context),
    };
  }
  const euroMatch = display.match(
    /^((?:\d{1,3}(?: \d{3})*|\d+),\d{2}) €(\d+)$/,
  );
  if (euroMatch) {
    return {
      price: parseMoney(`${euroMatch[1]} €`, context),
      quantity: parseQuantity(euroMatch[2]!, context),
    };
  }
  fail(`${context} order row is malformed: ${display}`);
}

function nextParagraph(
  paragraphs: string[],
  index: number,
  expected: string,
): string {
  const value = paragraphs[index];
  requireCondition(value !== undefined, `expected ${expected}`);
  return value;
}

export function parseTaskbarHeroMarketPageMarkdown(
  source: string | Uint8Array,
  sourcePath: string,
): DiscordHeroCommunityMarketPage {
  const { bytes, frontmatter, rawBody } = splitFrontmatter(source);
  const fileName = basename(sourcePath);
  requireCondition(
    sourcePath.startsWith(`${SOURCE_MARKET_DIRECTORY}/`) &&
      fileName.endsWith(".md"),
    `market page source path is invalid: ${sourcePath}`,
  );
  const key = fileName.slice(0, -3);
  requireCondition(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key),
    `market page key is invalid: ${key}`,
  );
  const title = quotedTopLevelValue(frontmatter, "title");
  const sourceUrl = quotedTopLevelValue(frontmatter, "source_url");
  const capturedAt = quotedTopLevelValue(frontmatter, "scraped_at");
  const exportFormat = quotedTopLevelValue(frontmatter, "export_format");
  requireCondition(
    sourceUrl === `${MARKET_SOURCE_URL}/${key}`,
    `source_url does not match market page key ${key}`,
  );
  requireCondition(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(capturedAt),
    `scraped_at is invalid for ${key}`,
  );
  requireCondition(
    exportFormat === SOURCE_MARKET_EXPORT_FORMAT,
    `export_format differs from the reviewed source for ${key}`,
  );
  requireCondition(
    frontmatter === expectedFrontmatter(title, sourceUrl, capturedAt, key),
    `frontmatter differs from the strict market page schema for ${key}`,
  );

  const paragraphs = rawBody.slice(0, -1).split("\n\n");
  let index = 0;
  requireCondition(
    nextParagraph(paragraphs, index++, "market backlink") ===
      "[← Market](../market.md)",
    `market backlink is malformed for ${key}`,
  );
  requireCondition(
    nextParagraph(paragraphs, index++, "market title") === `# ${title}`,
    `body title differs from frontmatter for ${key}`,
  );
  const identity = nextParagraph(paragraphs, index++, "market identity");
  const identityMatch = identity.match(
    /^([^·\n]+) · ([^·\n]+) · \[Wiki page\]\(\.\.\/items\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md\)$/,
  );
  requireCondition(identityMatch, `market identity is malformed for ${key}`);
  const grade = identityMatch[1]!.trim();
  const type = identityMatch[2]!.trim();
  const catalogKey = identityMatch[3]!;
  requireCondition(
    catalogKey === key,
    `Wiki page key differs from market page key ${key}`,
  );
  requireCondition(
    nextParagraph(paragraphs, index++, "BETA marker") === "BETA",
    `BETA marker is missing for ${key}`,
  );

  let status: DiscordHeroCommunityMarketPage["status"] = "confirmed";
  if (paragraphs[index] === UNCONFIRMED_MARKET_NOTICE) {
    status = "unconfirmed";
    index += 1;
  }

  function field(label: string): string {
    requireCondition(
      nextParagraph(paragraphs, index++, `field ${label}`) === label,
      `expected field ${label} for ${key}`,
    );
    return nextParagraph(paragraphs, index++, `${label} value`);
  }

  const lowestAsk = parseMaybeMoney(field("Lowest ask"), "Lowest ask");
  const median = parseMaybeMoney(field("Median"), "Median");
  const volume24h = parseMaybeQuantity(field("24h volume"), "24h volume");
  const bestBid = parseMaybeMoney(field("Best bid"), "Best bid");
  const bestAsk = parseMaybeMoney(field("Best ask"), "Best ask");
  const spread = parseSpread(field("Spread"));

  requireCondition(
    nextParagraph(paragraphs, index++, "Price history heading") ===
      "## Price history",
    `Price history heading is missing for ${key}`,
  );
  const historyHeader = nextParagraph(
    paragraphs,
    index++,
    "Price history freshness",
  );
  const historyHeaderMatch = historyHeader.match(/^USD · updated (.+)$/);
  requireCondition(
    historyHeaderMatch,
    `Price history freshness is malformed for ${key}`,
  );
  const historyParagraphs: string[] = [];
  while (index < paragraphs.length && paragraphs[index] !== "## Order book") {
    historyParagraphs.push(paragraphs[index++]!);
  }
  const historyRows: DiscordHeroMarketHistoryRow[] = [];
  if (
    historyParagraphs.length === 1 &&
    historyParagraphs[0] === NO_HISTORY_NOTICE
  ) {
    // The source can report a cache freshness even before its first price row.
  } else {
    const historyLines = historyParagraphs.flatMap((paragraph) =>
      paragraph.split("\n"),
    );
    requireCondition(
      historyLines.length > 0 && historyLines.length % 3 === 0,
      `Price history rows are malformed for ${key}`,
    );
    for (
      let historyIndex = 0;
      historyIndex < historyLines.length;
      historyIndex += 3
    ) {
      const timestampMatch = historyLines[historyIndex]!.match(
        /^- (\d{2}-\d{2} \d{2}:\d{2})$/,
      );
      const priceMatch =
        historyLines[historyIndex + 1]!.match(/^- Price (.+)$/);
      const volumeMatch =
        historyLines[historyIndex + 2]!.match(/^- Volume (.+)$/);
      requireCondition(
        timestampMatch && priceMatch && volumeMatch,
        `Price history row ${historyIndex / 3 + 1} is malformed for ${key}`,
      );
      historyRows.push({
        timestamp: timestampMatch[1]!,
        price: parseMoney(priceMatch[1]!, "Price history"),
        volume: parseQuantity(volumeMatch[1]!, "Price history"),
      });
    }
  }

  requireCondition(
    nextParagraph(paragraphs, index++, "Order book heading") ===
      "## Order book",
    `Order book heading is missing for ${key}`,
  );
  let orderBook: DiscordHeroCommunityMarketPage["orderBook"] = null;
  if (paragraphs[index] === NO_ORDER_BOOK_NOTICE) {
    index += 1;
  } else {
    const updatedMatch = nextParagraph(
      paragraphs,
      index++,
      "Order book freshness",
    ).match(/^updated (.+)$/);
    requireCondition(
      updatedMatch,
      `Order book freshness is malformed for ${key}`,
    );
    const buyMatch = nextParagraph(
      paragraphs,
      index++,
      "Buy orders quantity",
    ).match(/^Buy orders(.+) qty$/);
    requireCondition(buyMatch, `Buy orders header is malformed for ${key}`);
    const buyOrders: DiscordHeroMarketOrder[] = [];
    while (
      index < paragraphs.length &&
      !paragraphs[index]!.startsWith("Sell orders")
    ) {
      buyOrders.push(
        parseOrderRow(paragraphs[index++]!, `Buy orders for ${key}`),
      );
    }
    const sellMatch = nextParagraph(
      paragraphs,
      index++,
      "Sell orders quantity",
    ).match(/^Sell orders(.+) qty$/);
    requireCondition(sellMatch, `Sell orders header is malformed for ${key}`);
    const sellOrders: DiscordHeroMarketOrder[] = [];
    while (index < paragraphs.length) {
      sellOrders.push(
        parseOrderRow(paragraphs[index++]!, `Sell orders for ${key}`),
      );
    }
    orderBook = {
      updated: updatedMatch[1]!,
      buyQuantity: parseQuantity(buyMatch[1]!, "Buy orders"),
      sellQuantity: parseQuantity(sellMatch[1]!, "Sell orders"),
      buyOrders,
      sellOrders,
    };
  }
  requireCondition(
    index === paragraphs.length,
    `unexpected body content remains for ${key}`,
  );

  return {
    key,
    title,
    grade,
    type,
    status,
    catalogItem: null,
    source: {
      path: sourcePath,
      sourceUrl,
      capturedAt,
      exportFormat,
      sha256: sha256(bytes),
    },
    stats: {
      lowestAsk,
      median,
      volume24h,
      bestBid,
      bestAsk,
      spread,
    },
    priceHistory: {
      currency: "USD",
      updated: historyHeaderMatch[1] === "—" ? null : historyHeaderMatch[1]!,
      rows: historyRows,
    },
    orderBook,
    rawBody,
  };
}

function parseTaskbarHeroMarketLandingMarkdown(
  source: string | Uint8Array,
): ParsedLanding {
  const { frontmatter, rawBody } = splitFrontmatter(source);
  const title = quotedTopLevelValue(frontmatter, "title");
  const sourceUrl = quotedTopLevelValue(frontmatter, "source_url");
  const capturedAt = quotedTopLevelValue(frontmatter, "scraped_at");
  const exportFormat = quotedTopLevelValue(frontmatter, "export_format");
  requireCondition(title === "Market", "landing title differs from Market");
  requireCondition(
    sourceUrl === MARKET_SOURCE_URL,
    "landing source_url differs from the reviewed source",
  );
  requireCondition(
    capturedAt === "2026-07-28T14:15:20Z",
    "landing scraped_at differs from the reviewed source",
  );
  requireCondition(
    exportFormat === SOURCE_MARKET_EXPORT_FORMAT,
    "landing export_format differs from the reviewed source",
  );
  requireCondition(
    frontmatter === expectedFrontmatter(title, sourceUrl, capturedAt),
    "landing frontmatter differs from the strict market schema",
  );
  const declarations = [
    ...rawBody.matchAll(/^Showing (\d+)–(\d+) of (\d+) items$/gm),
  ];
  requireCondition(
    declarations.length === 1,
    "landing must contain exactly one Showing range declaration",
  );
  const declaration = declarations[0]!;
  return {
    sourceUrl,
    capturedAt,
    exportFormat,
    shownFrom: Number(declaration[1]),
    shownTo: Number(declaration[2]),
    declaredTotal: Number(declaration[3]),
    rawBody,
  };
}

function parseCatalogSource(value: unknown): {
  records: number;
  marketable: CatalogSourceItem[];
} {
  requireCondition(
    Array.isArray(value),
    "catalog items source must be an array",
  );
  const marketable: CatalogSourceItem[] = [];
  const marketableSlugs = new Set<string>();
  const marketableIds = new Set<number>();
  for (const [index, candidate] of value.entries()) {
    requireCondition(
      isRecord(candidate),
      `catalog item ${index + 1} must be an object`,
    );
    if (candidate.marketable !== true) {
      continue;
    }
    requireCondition(
      Number.isSafeInteger(candidate.id) &&
        typeof candidate.id === "number" &&
        candidate.id > 0,
      `marketable catalog item ${index + 1} id is invalid`,
    );
    requireCondition(
      isNonEmptyString(candidate.slug) &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug),
      `marketable catalog item ${candidate.id} slug is invalid`,
    );
    const name =
      isRecord(candidate.name) && isNonEmptyString(candidate.name["en-US"])
        ? candidate.name["en-US"]
        : null;
    requireCondition(
      candidate.name === null || name !== null,
      `marketable catalog item ${candidate.id} English name is invalid`,
    );
    requireCondition(
      isNonEmptyString(candidate.grade) && isNonEmptyString(candidate.type),
      `marketable catalog item ${candidate.id} grade or type is invalid`,
    );
    requireCondition(
      !marketableSlugs.has(candidate.slug),
      `duplicate marketable catalog slug: ${candidate.slug}`,
    );
    requireCondition(
      !marketableIds.has(candidate.id),
      `duplicate marketable catalog id: ${candidate.id}`,
    );
    marketableSlugs.add(candidate.slug);
    marketableIds.add(candidate.id);
    marketable.push({
      id: candidate.id,
      slug: candidate.slug,
      name,
      grade: candidate.grade,
      type: candidate.type,
    });
  }
  marketable.sort((left, right) => left.slug.localeCompare(right.slug));
  return { records: value.length, marketable };
}

export async function compileDiscordHeroCommunityMarket(
  projectRoot: string,
): Promise<DiscordHeroCommunityMarket> {
  const pageNames = (await readdir(join(projectRoot, SOURCE_MARKET_DIRECTORY)))
    .filter((name) => name.endsWith(".md"))
    .sort();
  const pagePaths = pageNames.map(
    (name) => `${SOURCE_MARKET_DIRECTORY}/${name}`,
  );
  const allSourcePaths = [
    SOURCE_MARKET_LANDING_PATH,
    SOURCE_MARKET_CATALOG_PATH,
    ...pagePaths,
  ];
  const allSourceBytes = await Promise.all(
    allSourcePaths.map((path) => readFile(join(projectRoot, path))),
  );
  const sourceEntries = allSourcePaths.map((path, index) => ({
    path,
    sha256: sha256(allSourceBytes[index]!),
  }));
  const sourceAggregateSha256 = sha256(JSON.stringify(sourceEntries));
  requireCondition(
    sourceAggregateSha256 === SOURCE_MARKET_AGGREGATE_SHA256,
    `sources do not match the reviewed aggregate SHA-256: ${sourceAggregateSha256}`,
  );
  requireCondition(
    sourceEntries[0]!.sha256 === SOURCE_MARKET_LANDING_SHA256,
    "landing does not match the reviewed SHA-256",
  );
  requireCondition(
    sourceEntries[1]!.sha256 === SOURCE_MARKET_CATALOG_SHA256,
    "catalog items do not match the reviewed SHA-256",
  );

  const landing = parseTaskbarHeroMarketLandingMarkdown(allSourceBytes[0]!);
  let catalogValue: unknown;
  try {
    catalogValue = JSON.parse(Buffer.from(allSourceBytes[1]!).toString("utf8"));
  } catch {
    fail("catalog items source is not valid JSON");
  }
  const catalog = parseCatalogSource(catalogValue);
  const parsedPages = pagePaths.map((sourcePath, index) =>
    parseTaskbarHeroMarketPageMarkdown(allSourceBytes[index + 2]!, sourcePath),
  );
  const catalogBySlug = new Map(
    catalog.marketable.map((item) => [item.slug, item]),
  );
  const linkedSourcePaths = new Map<number, string[]>();
  const unresolvedPages: DiscordHeroCommunityMarket["reconciliation"]["unresolvedPages"] =
    [];
  const pages = parsedPages.map((page) => {
    const item = catalogBySlug.get(page.key);
    if (!item) {
      unresolvedPages.push({
        sourcePath: page.source.path,
        catalogKey: page.key,
        reason: "no-unique-marketable-catalog-slug",
      });
      return page;
    }
    requireCondition(
      page.grade === item.grade && page.type === item.type,
      `page ${page.key} grade/type differs from catalog item`,
    );
    const paths = linkedSourcePaths.get(item.id) ?? [];
    paths.push(page.source.path);
    linkedSourcePaths.set(item.id, paths);
    return {
      ...page,
      catalogItem: {
        ...item,
        evidence: "wiki-link-and-catalog-slug" as const,
      },
    };
  });
  const duplicateCatalogLinks = catalog.marketable
    .flatMap((item) => {
      const sourcePaths = linkedSourcePaths.get(item.id) ?? [];
      return sourcePaths.length > 1
        ? [{ catalogItemId: item.id, catalogSlug: item.slug, sourcePaths }]
        : [];
    })
    .sort((left, right) => left.catalogSlug.localeCompare(right.catalogSlug));
  const catalogRecordsWithoutPage = catalog.marketable
    .filter((item) => !linkedSourcePaths.has(item.id))
    .map((item) => ({
      catalogItemId: item.id,
      catalogSlug: item.slug,
    }));
  const extraPages = pages
    .filter(
      (
        page,
      ): page is DiscordHeroCommunityMarketPage & {
        catalogItem: DiscordHeroMarketCatalogItem;
      } => page.status === "unconfirmed" && page.catalogItem !== null,
    )
    .map((page) => ({
      sourcePath: page.source.path,
      catalogItemId: page.catalogItem.id,
      catalogSlug: page.catalogItem.slug,
      reason: "unconfirmed-steam-market" as const,
    }));
  const capturedAt = pages.map((page) => page.source.capturedAt).sort();
  const confirmedPages = pages.filter(
    (page) => page.status === "confirmed",
  ).length;
  const unconfirmedPages = pages.length - confirmedPages;

  const unsigned: UnsignedDiscordHeroCommunityMarket = {
    format: "discordhero-community-market/v1",
    provenance: {
      sourceFiles: allSourcePaths.length,
      sourceAggregateSha256,
      landing: {
        path: SOURCE_MARKET_LANDING_PATH,
        sourceUrl: landing.sourceUrl,
        capturedAt: landing.capturedAt,
        exportFormat: landing.exportFormat,
        sha256: sourceEntries[0]!.sha256,
      },
      catalog: {
        path: SOURCE_MARKET_CATALOG_PATH,
        records: catalog.records,
        marketableRecords: catalog.marketable.length,
        sha256: sourceEntries[1]!.sha256,
      },
      pages: {
        directory: SOURCE_MARKET_DIRECTORY,
        files: pages.length,
        capturedAtMin: capturedAt[0] ?? "",
        capturedAtMax: capturedAt.at(-1) ?? "",
        exportFormat: SOURCE_MARKET_EXPORT_FORMAT,
      },
    },
    landing: {
      shownFrom: landing.shownFrom,
      shownTo: landing.shownTo,
      declaredTotal: landing.declaredTotal,
      rawBody: landing.rawBody,
    },
    reconciliation: {
      pageFiles: pages.length,
      landingDeclaredRecords: landing.declaredTotal,
      catalogMarketableRecords: catalog.marketable.length,
      confirmedPages,
      unconfirmedPages,
      pagesMinusLanding: pages.length - landing.declaredTotal,
      pagesMinusCatalog: pages.length - catalog.marketable.length,
      catalogMinusLanding: catalog.marketable.length - landing.declaredTotal,
      extraPages,
      unresolvedPages,
      duplicateCatalogLinks,
      catalogRecordsWithoutPage,
    },
    pages,
  };
  const market: DiscordHeroCommunityMarket = {
    ...unsigned,
    provenance: {
      ...unsigned.provenance,
      compiledSha256: sha256(JSON.stringify(unsigned)),
    },
  };
  validateDiscordHeroCommunityMarket(market);
  return market;
}

function withoutCompiledSha(
  market: DiscordHeroCommunityMarket,
): UnsignedDiscordHeroCommunityMarket {
  return {
    format: market.format,
    provenance: {
      sourceFiles: market.provenance.sourceFiles,
      sourceAggregateSha256: market.provenance.sourceAggregateSha256,
      landing: market.provenance.landing,
      catalog: market.provenance.catalog,
      pages: market.provenance.pages,
    },
    landing: market.landing,
    reconciliation: market.reconciliation,
    pages: market.pages,
  };
}

export function computeDiscordHeroCommunityMarketPayloadSha256(
  market: DiscordHeroCommunityMarket,
): string {
  return sha256(JSON.stringify(withoutCompiledSha(market)));
}

function requireExactObject(
  value: unknown,
  keys: readonly string[],
  message: string,
): asserts value is Record<string, unknown> {
  requireCondition(isRecord(value) && hasExactKeys(value, keys), message);
}

function validateMoney(value: unknown, context: string): void {
  requireExactObject(
    value,
    ["display", "currency", "amount"],
    `${context} money contains unexpected or missing fields`,
  );
  requireCondition(
    isNonEmptyString(value.display) &&
      (value.currency === "USD" ||
        value.currency === "EUR" ||
        value.currency === "GBP") &&
      typeof value.amount === "string" &&
      /^\d+\.\d{2}$/.test(value.amount),
    `${context} money is invalid`,
  );
}

function validateQuantity(value: unknown, context: string): void {
  requireExactObject(
    value,
    ["display", "amount"],
    `${context} quantity contains unexpected or missing fields`,
  );
  requireCondition(
    isNonEmptyString(value.display) &&
      typeof value.amount === "string" &&
      /^\d+$/.test(value.amount),
    `${context} quantity is invalid`,
  );
}

function validateOrder(value: unknown, context: string): void {
  requireExactObject(
    value,
    ["price", "quantity"],
    `${context} order contains unexpected or missing fields`,
  );
  validateMoney(value.price, context);
  validateQuantity(value.quantity, context);
}

function validatePage(value: unknown, index: number): void {
  const context = `market page ${index + 1}`;
  requireExactObject(
    value,
    [
      "key",
      "title",
      "grade",
      "type",
      "status",
      "catalogItem",
      "source",
      "stats",
      "priceHistory",
      "orderBook",
      "rawBody",
    ],
    `${context} contains unexpected or missing fields`,
  );
  requireCondition(
    isNonEmptyString(value.key) &&
      isNonEmptyString(value.title) &&
      isNonEmptyString(value.grade) &&
      isNonEmptyString(value.type) &&
      (value.status === "confirmed" || value.status === "unconfirmed") &&
      typeof value.rawBody === "string" &&
      value.rawBody.endsWith("\n"),
    `${context} identity or raw body is invalid`,
  );
  if (value.catalogItem !== null) {
    requireExactObject(
      value.catalogItem,
      ["id", "slug", "name", "grade", "type", "evidence"],
      `${context} catalog item contains unexpected or missing fields`,
    );
    requireCondition(
      Number.isSafeInteger(value.catalogItem.id) &&
        isNonEmptyString(value.catalogItem.slug) &&
        (value.catalogItem.name === null ||
          isNonEmptyString(value.catalogItem.name)) &&
        isNonEmptyString(value.catalogItem.grade) &&
        isNonEmptyString(value.catalogItem.type) &&
        value.catalogItem.evidence === "wiki-link-and-catalog-slug",
      `${context} catalog item is invalid`,
    );
  }
  requireExactObject(
    value.source,
    ["path", "sourceUrl", "capturedAt", "exportFormat", "sha256"],
    `${context} source contains unexpected or missing fields`,
  );
  requireCondition(
    isNonEmptyString(value.source.path) &&
      isNonEmptyString(value.source.sourceUrl) &&
      typeof value.source.capturedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.source.capturedAt) &&
      value.source.exportFormat === SOURCE_MARKET_EXPORT_FORMAT &&
      typeof value.source.sha256 === "string" &&
      /^[0-9a-f]{64}$/.test(value.source.sha256),
    `${context} source is invalid`,
  );
  requireExactObject(
    value.stats,
    ["lowestAsk", "median", "volume24h", "bestBid", "bestAsk", "spread"],
    `${context} stats contain unexpected or missing fields`,
  );
  for (const key of ["lowestAsk", "median", "bestBid", "bestAsk"] as const) {
    if (value.stats[key] !== null) {
      validateMoney(value.stats[key], `${context} ${key}`);
    }
  }
  if (value.stats.volume24h !== null) {
    validateQuantity(value.stats.volume24h, `${context} volume24h`);
  }
  if (value.stats.spread !== null) {
    requireExactObject(
      value.stats.spread,
      ["money", "percent"],
      `${context} spread contains unexpected or missing fields`,
    );
    validateMoney(value.stats.spread.money, `${context} spread`);
    requireCondition(
      typeof value.stats.spread.percent === "string" &&
        /^\d+(?:\.\d+)?$/.test(value.stats.spread.percent),
      `${context} spread percent is invalid`,
    );
  }
  requireExactObject(
    value.priceHistory,
    ["currency", "updated", "rows"],
    `${context} price history contains unexpected or missing fields`,
  );
  requireCondition(
    value.priceHistory.currency === "USD" &&
      (value.priceHistory.updated === null ||
        isNonEmptyString(value.priceHistory.updated)) &&
      Array.isArray(value.priceHistory.rows),
    `${context} price history is invalid`,
  );
  for (const [rowIndex, row] of value.priceHistory.rows.entries()) {
    requireExactObject(
      row,
      ["timestamp", "price", "volume"],
      `${context} price history row ${rowIndex + 1} contains unexpected or missing fields`,
    );
    requireCondition(
      typeof row.timestamp === "string" &&
        /^\d{2}-\d{2} \d{2}:\d{2}$/.test(row.timestamp),
      `${context} price history row ${rowIndex + 1} timestamp is invalid`,
    );
    validateMoney(row.price, `${context} history row ${rowIndex + 1}`);
    validateQuantity(row.volume, `${context} history row ${rowIndex + 1}`);
  }
  if (value.orderBook !== null) {
    requireExactObject(
      value.orderBook,
      ["updated", "buyQuantity", "sellQuantity", "buyOrders", "sellOrders"],
      `${context} order book contains unexpected or missing fields`,
    );
    requireCondition(
      isNonEmptyString(value.orderBook.updated) &&
        Array.isArray(value.orderBook.buyOrders) &&
        Array.isArray(value.orderBook.sellOrders),
      `${context} order book is invalid`,
    );
    validateQuantity(value.orderBook.buyQuantity, `${context} buy`);
    validateQuantity(value.orderBook.sellQuantity, `${context} sell`);
    value.orderBook.buyOrders.forEach((order, orderIndex) =>
      validateOrder(order, `${context} buy ${orderIndex + 1}`),
    );
    value.orderBook.sellOrders.forEach((order, orderIndex) =>
      validateOrder(order, `${context} sell ${orderIndex + 1}`),
    );
  }
}

export function validateDiscordHeroCommunityMarket(
  value: unknown,
): asserts value is DiscordHeroCommunityMarket {
  requireExactObject(
    value,
    ["format", "provenance", "landing", "reconciliation", "pages"],
    "compiled artifact contains unexpected or missing fields",
  );
  requireCondition(
    value.format === "discordhero-community-market/v1",
    "compiled artifact format is invalid",
  );
  requireExactObject(
    value.provenance,
    [
      "sourceFiles",
      "sourceAggregateSha256",
      "landing",
      "catalog",
      "pages",
      "compiledSha256",
    ],
    "compiled provenance contains unexpected or missing fields",
  );
  requireExactObject(
    value.provenance.landing,
    ["path", "sourceUrl", "capturedAt", "exportFormat", "sha256"],
    "compiled landing provenance contains unexpected or missing fields",
  );
  requireExactObject(
    value.provenance.catalog,
    ["path", "records", "marketableRecords", "sha256"],
    "compiled catalog provenance contains unexpected or missing fields",
  );
  requireExactObject(
    value.provenance.pages,
    ["directory", "files", "capturedAtMin", "capturedAtMax", "exportFormat"],
    "compiled pages provenance contains unexpected or missing fields",
  );
  requireCondition(
    value.provenance.sourceFiles === EXPECTED_MARKET_PAGES + 2 &&
      value.provenance.sourceAggregateSha256 ===
        SOURCE_MARKET_AGGREGATE_SHA256 &&
      value.provenance.landing.path === SOURCE_MARKET_LANDING_PATH &&
      value.provenance.landing.sourceUrl === MARKET_SOURCE_URL &&
      value.provenance.landing.capturedAt === "2026-07-28T14:15:20Z" &&
      value.provenance.landing.exportFormat === SOURCE_MARKET_EXPORT_FORMAT &&
      value.provenance.landing.sha256 === SOURCE_MARKET_LANDING_SHA256 &&
      value.provenance.catalog.path === SOURCE_MARKET_CATALOG_PATH &&
      value.provenance.catalog.records === EXPECTED_CATALOG_RECORDS &&
      value.provenance.catalog.marketableRecords ===
        EXPECTED_MARKETABLE_CATALOG_RECORDS &&
      value.provenance.catalog.sha256 === SOURCE_MARKET_CATALOG_SHA256 &&
      value.provenance.pages.directory === SOURCE_MARKET_DIRECTORY &&
      value.provenance.pages.files === EXPECTED_MARKET_PAGES &&
      value.provenance.pages.capturedAtMin === "2026-07-28T14:55:09Z" &&
      value.provenance.pages.capturedAtMax === "2026-07-28T14:59:12Z" &&
      value.provenance.pages.exportFormat === SOURCE_MARKET_EXPORT_FORMAT,
    "compiled provenance differs from the reviewed sources",
  );
  requireExactObject(
    value.landing,
    ["shownFrom", "shownTo", "declaredTotal", "rawBody"],
    "compiled landing contains unexpected or missing fields",
  );
  requireCondition(
    value.landing.shownFrom === 1 &&
      value.landing.shownTo === 48 &&
      value.landing.declaredTotal === EXPECTED_LANDING_MARKET_RECORDS &&
      typeof value.landing.rawBody === "string" &&
      value.landing.rawBody.endsWith("\n"),
    "compiled landing differs from the reviewed source",
  );
  requireExactObject(
    value.reconciliation,
    [
      "pageFiles",
      "landingDeclaredRecords",
      "catalogMarketableRecords",
      "confirmedPages",
      "unconfirmedPages",
      "pagesMinusLanding",
      "pagesMinusCatalog",
      "catalogMinusLanding",
      "extraPages",
      "unresolvedPages",
      "duplicateCatalogLinks",
      "catalogRecordsWithoutPage",
    ],
    "compiled reconciliation contains unexpected or missing fields",
  );
  requireCondition(
    value.reconciliation.pageFiles === EXPECTED_MARKET_PAGES &&
      value.reconciliation.landingDeclaredRecords ===
        EXPECTED_LANDING_MARKET_RECORDS &&
      value.reconciliation.catalogMarketableRecords ===
        EXPECTED_MARKETABLE_CATALOG_RECORDS &&
      value.reconciliation.confirmedPages === EXPECTED_LANDING_MARKET_RECORDS &&
      value.reconciliation.unconfirmedPages === 10 &&
      value.reconciliation.pagesMinusLanding === 10 &&
      value.reconciliation.pagesMinusCatalog === 0 &&
      value.reconciliation.catalogMinusLanding === 10 &&
      Array.isArray(value.reconciliation.extraPages) &&
      Array.isArray(value.reconciliation.unresolvedPages) &&
      Array.isArray(value.reconciliation.duplicateCatalogLinks) &&
      Array.isArray(value.reconciliation.catalogRecordsWithoutPage),
    "compiled reconciliation counts are invalid",
  );
  requireCondition(
    value.reconciliation.extraPages.length === 10 &&
      value.reconciliation.unresolvedPages.length === 0 &&
      value.reconciliation.duplicateCatalogLinks.length === 0 &&
      value.reconciliation.catalogRecordsWithoutPage.length === 0,
    "compiled reconciliation findings differ from the reviewed sources",
  );
  for (const [index, extra] of value.reconciliation.extraPages.entries()) {
    requireExactObject(
      extra,
      ["sourcePath", "catalogItemId", "catalogSlug", "reason"],
      `extra page ${index + 1} contains unexpected or missing fields`,
    );
    requireCondition(
      isNonEmptyString(extra.sourcePath) &&
        Number.isSafeInteger(extra.catalogItemId) &&
        isNonEmptyString(extra.catalogSlug) &&
        extra.reason === "unconfirmed-steam-market",
      `extra page ${index + 1} is invalid`,
    );
  }
  requireCondition(
    Array.isArray(value.pages) && value.pages.length === EXPECTED_MARKET_PAGES,
    `compiled artifact must contain exactly ${EXPECTED_MARKET_PAGES} market pages`,
  );
  const keys = new Set<string>();
  const itemIds = new Set<number>();
  for (const [index, page] of value.pages.entries()) {
    validatePage(page, index);
    const typedPage = page as unknown as DiscordHeroCommunityMarketPage;
    requireCondition(
      !keys.has(typedPage.key),
      `duplicate market page key: ${typedPage.key}`,
    );
    keys.add(typedPage.key);
    if (typedPage.catalogItem !== null) {
      requireCondition(
        !itemIds.has(typedPage.catalogItem.id),
        `duplicate catalog item link: ${typedPage.catalogItem.id}`,
      );
      itemIds.add(typedPage.catalogItem.id);
    }
    if (index > 0) {
      requireCondition(
        (value.pages[index - 1] as { key: string }).key.localeCompare(
          typedPage.key,
        ) < 0,
        "compiled market pages must be sorted by key",
      );
    }
  }

  const market = value as unknown as DiscordHeroCommunityMarket;
  const computedSha256 = computeDiscordHeroCommunityMarketPayloadSha256(market);
  requireCondition(
    market.provenance.compiledSha256 === computedSha256,
    `compiled SHA-256 mismatch: expected ${computedSha256}`,
  );
  requireCondition(
    market.provenance.compiledSha256 === COMMUNITY_MARKET_PAYLOAD_SHA256,
    `compiled payload does not match the reviewed SHA-256: ${market.provenance.compiledSha256}`,
  );
}

export function serializeDiscordHeroCommunityMarket(
  market: DiscordHeroCommunityMarket,
): string {
  validateDiscordHeroCommunityMarket(market);
  const serialized = `${JSON.stringify(market)}\n`;
  const fileSha256 = sha256(serialized);
  requireCondition(
    fileSha256 === COMMUNITY_MARKET_FILE_SHA256,
    `compiled artifact does not match the reviewed file SHA-256: ${fileSha256}`,
  );
  return serialized;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writeDiscordHeroCommunityMarket(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/community-market.json"),
): Promise<{ market: DiscordHeroCommunityMarket; changed: boolean }> {
  const market = await compileDiscordHeroCommunityMarket(projectRoot);
  const serialized = serializeDiscordHeroCommunityMarket(market);
  await mkdir(dirname(outputPath), { recursive: true });
  if (await fileExists(outputPath)) {
    const existing = await readFile(outputPath, "utf8");
    if (existing === serialized) {
      return { market, changed: false };
    }
  }
  const temporaryDirectory = await mkdtemp(
    join(dirname(outputPath), ".discordhero-community-market-"),
  );
  const temporaryPath = join(temporaryDirectory, basename(outputPath));
  try {
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return { market, changed: true };
}

export async function checkDiscordHeroCommunityMarket(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/community-market.json"),
): Promise<void> {
  const market = await compileDiscordHeroCommunityMarket(projectRoot);
  const expected = serializeDiscordHeroCommunityMarket(market);
  const actual = await readFile(outputPath, "utf8");
  requireCondition(
    actual === expected,
    `${outputPath} does not match generated community market`,
  );
}
