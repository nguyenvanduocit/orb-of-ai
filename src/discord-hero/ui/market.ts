import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";
import type { DiscordHeroCommunityMarketPage } from "../community-market/compiler";
import type {
  DeepReadonly,
  LoadedDiscordHeroCommunityMarket,
} from "../community-market/loader";

const MARKET_PAGE_SIZE = 25;
const DISCORD_OPTION_TEXT_LIMIT = 100;

export type DiscordHeroMarketViewKind = "all" | "confirmed" | "unconfirmed";

export interface DiscordHeroMarketOption {
  readonly rowIndex: number;
  readonly itemKey: number;
  readonly key: string;
  readonly status: "confirmed" | "unconfirmed";
  readonly label: string;
  readonly description: string;
  readonly value: string;
}

export interface DiscordHeroMarketPage {
  readonly kind: DiscordHeroMarketViewKind;
  readonly page: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly kindTarget: string;
  readonly pageTarget: string;
  readonly options: readonly DiscordHeroMarketOption[];
}

export interface DiscordHeroMarketLocation {
  readonly kind: DiscordHeroMarketViewKind;
  readonly page: number;
}

export interface DiscordHeroMarketTarget extends DiscordHeroMarketLocation {
  readonly rowIndex: number;
  readonly itemKey: number;
  readonly key: string;
}

export interface DiscordHeroMarketDetail {
  readonly kind: DiscordHeroMarketViewKind;
  readonly page: number;
  readonly rowIndex: number;
  readonly target: string;
  readonly key: string;
  readonly title: string;
  readonly status: "confirmed" | "unconfirmed";
  readonly statusReason:
    "confirmed-market-snapshot" | "unconfirmed-steam-market";
  readonly catalogItem: {
    readonly key: number;
    readonly slug: string;
    readonly name: string | null;
    readonly type: string;
    readonly grade: string;
  };
  readonly stats: DeepReadonly<DiscordHeroCommunityMarketPage["stats"]>;
  readonly priceHistory: DeepReadonly<
    DiscordHeroCommunityMarketPage["priceHistory"]
  >;
  readonly orderBook: DeepReadonly<DiscordHeroCommunityMarketPage["orderBook"]>;
  readonly rawBody: string;
  readonly provenance: {
    readonly page: DeepReadonly<DiscordHeroCommunityMarketPage["source"]>;
    readonly artifact: LoadedDiscordHeroCommunityMarket["provenance"];
  };
}

interface LinkedMarketRow {
  readonly rowIndex: number;
  readonly market: LoadedDiscordHeroCommunityMarket["pages"][number];
  readonly catalog: DiscordHeroDatasetRow<"items">;
}

interface ValidatedMarketProjection {
  readonly rows: readonly LinkedMarketRow[];
}

const KIND_CODES = {
  all: "a",
  confirmed: "c",
  unconfirmed: "u",
} as const satisfies Readonly<Record<DiscordHeroMarketViewKind, string>>;

function fail(message: string): never {
  throw new Error(`DiscordHero Community Market: ${message}`);
}

function isMarketKind(value: unknown): value is DiscordHeroMarketViewKind {
  return value === "all" || value === "confirmed" || value === "unconfirmed";
}

function requireMarketKind(value: unknown): DiscordHeroMarketViewKind {
  if (!isMarketKind(value)) {
    fail(`unknown view kind ${String(value)}`);
  }
  return value;
}

function kindFromCode(code: string): DiscordHeroMarketViewKind | null {
  if (code === "a") return "all";
  if (code === "c") return "confirmed";
  if (code === "u") return "unconfirmed";
  return null;
}

function catalogEnglishName(
  row: DiscordHeroDatasetRow<"items">,
): string | null {
  if (row.name === null) return null;
  const name = row.name["en-US"];
  if (typeof name !== "string" || name.length === 0) {
    fail(`catalog item ${row.id} has no exact English name`);
  }
  return name;
}

function sameExtraPages(
  source: LoadedDiscordHeroCommunityMarket,
  linked: readonly LinkedMarketRow[],
): boolean {
  const expected = linked.flatMap(({ market }) =>
    market.status === "unconfirmed"
      ? [
          {
            sourcePath: market.source.path,
            catalogItemId: market.catalogItem!.id,
            catalogSlug: market.catalogItem!.slug,
            reason: "unconfirmed-steam-market",
          },
        ]
      : [],
  );
  return (
    expected.length === source.reconciliation.extraPages.length &&
    expected.every((value, index) => {
      const actual = source.reconciliation.extraPages[index];
      return (
        actual !== undefined &&
        actual.sourcePath === value.sourcePath &&
        actual.catalogItemId === value.catalogItemId &&
        actual.catalogSlug === value.catalogSlug &&
        actual.reason === value.reason
      );
    })
  );
}

function validateProjection(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
): ValidatedMarketProjection {
  const itemsDataset = indexes.catalog.datasets.find(
    (dataset) => dataset.name === "items",
  );
  if (
    itemsDataset === undefined ||
    itemsDataset.sourceSha256 !== source.provenance.catalog.sha256
  ) {
    fail("catalog items source SHA does not match market provenance");
  }
  if (
    source.reconciliation.unresolvedPages.length !== 0 ||
    source.reconciliation.duplicateCatalogLinks.length !== 0 ||
    source.reconciliation.catalogRecordsWithoutPage.length !== 0
  ) {
    fail("reconciliation contains unresolved catalog findings");
  }

  const marketableRows = indexes.tables.items.rows.filter(
    (row) => row.marketable === true,
  );
  const catalogById = new Map<number, DiscordHeroDatasetRow<"items">>();
  const catalogSlugs = new Set<string>();
  for (const row of marketableRows) {
    if (catalogById.has(row.id)) {
      fail(`duplicate marketable catalog item ${row.id}`);
    }
    if (catalogSlugs.has(row.slug)) {
      fail(`duplicate marketable catalog slug ${row.slug}`);
    }
    catalogById.set(row.id, row);
    catalogSlugs.add(row.slug);
  }

  const linkedIds = new Set<number>();
  const linkedSlugs = new Set<string>();
  const linked: LinkedMarketRow[] = [];
  for (const [rowIndex, market] of source.pages.entries()) {
    if (rowIndex > 0 && source.pages[rowIndex - 1]!.key >= market.key) {
      fail("market rows are not in stable artifact key order");
    }
    if (market.catalogItem === null) {
      fail(`market row ${market.key} has no catalog item`);
    }
    if (market.key !== market.catalogItem.slug) {
      fail("market row key/catalog slug mismatch");
    }
    if (
      market.grade !== market.catalogItem.grade ||
      market.type !== market.catalogItem.type
    ) {
      fail(`market row ${market.key} grade/type mismatch`);
    }
    if (linkedIds.has(market.catalogItem.id)) {
      fail(`duplicate market catalog item ${market.catalogItem.id}`);
    }
    if (linkedSlugs.has(market.catalogItem.slug)) {
      fail(`duplicate market catalog slug ${market.catalogItem.slug}`);
    }

    const group = indexes.tables.items.groups.get(market.catalogItem.id);
    if (group === undefined || group.length !== 1) {
      fail(
        `catalog item ${market.catalogItem.id} must have exactly one indexed row`,
      );
    }
    const catalog = catalogById.get(market.catalogItem.id);
    if (catalog === undefined) {
      fail(`catalog item ${market.catalogItem.id} is not marketable`);
    }
    if (group[0] !== catalog) {
      fail(
        `catalog item ${market.catalogItem.id} indexed row differs from its source row`,
      );
    }
    if (catalog.marketable !== true) {
      fail(`catalog item ${catalog.id} is not marketable`);
    }
    if (catalog.slug !== market.key) {
      fail(`catalog slug mismatch for market row ${market.key}`);
    }
    if (
      catalog.grade !== market.grade ||
      catalog.type !== market.type ||
      catalogEnglishName(catalog) !== market.catalogItem.name
    ) {
      fail(`catalog identity mismatch for market row ${market.key}`);
    }

    linkedIds.add(market.catalogItem.id);
    linkedSlugs.add(market.catalogItem.slug);
    linked.push({ rowIndex, market, catalog });
  }

  if (
    marketableRows.length !== linked.length ||
    marketableRows.some((row) => !linkedIds.has(row.id))
  ) {
    fail("market pages do not cover every marketable catalog row");
  }

  const confirmedPages = linked.filter(
    ({ market }) => market.status === "confirmed",
  ).length;
  const unconfirmedPages = linked.length - confirmedPages;
  const reconciliation = source.reconciliation;
  if (
    source.provenance.sourceFiles !== linked.length + 2 ||
    source.provenance.pages.files !== linked.length ||
    source.provenance.catalog.marketableRecords !== marketableRows.length ||
    reconciliation.pageFiles !== linked.length ||
    reconciliation.landingDeclaredRecords !== source.landing.declaredTotal ||
    reconciliation.catalogMarketableRecords !== marketableRows.length ||
    reconciliation.confirmedPages !== confirmedPages ||
    reconciliation.unconfirmedPages !== unconfirmedPages ||
    reconciliation.pagesMinusLanding !==
      linked.length - source.landing.declaredTotal ||
    reconciliation.pagesMinusCatalog !==
      linked.length - marketableRows.length ||
    reconciliation.catalogMinusLanding !==
      marketableRows.length - source.landing.declaredTotal
  ) {
    fail("reconciliation counts do not match market rows");
  }
  if (!sameExtraPages(source, linked)) {
    fail("reconciliation extra pages do not match unconfirmed rows");
  }

  return { rows: linked };
}

function rowsForKind(
  projection: ValidatedMarketProjection,
  kind: DiscordHeroMarketViewKind,
): readonly LinkedMarketRow[] {
  return kind === "all"
    ? projection.rows
    : projection.rows.filter(({ market }) => market.status === kind);
}

function pageCount(rows: readonly LinkedMarketRow[]): number {
  return Math.ceil(rows.length / MARKET_PAGE_SIZE);
}

function requirePage(
  rows: readonly LinkedMarketRow[],
  kind: DiscordHeroMarketViewKind,
  page: number,
): void {
  const count = pageCount(rows);
  if (!Number.isSafeInteger(page) || page < 0 || page >= count) {
    fail(`${kind} page ${page} is out of range 0-${count - 1}`);
  }
}

function pageRows(
  rows: readonly LinkedMarketRow[],
  kind: DiscordHeroMarketViewKind,
  page: number,
): readonly LinkedMarketRow[] {
  requirePage(rows, kind, page);
  const start = page * MARKET_PAGE_SIZE;
  return rows.slice(start, start + MARKET_PAGE_SIZE);
}

function requireRowOnPage(
  rows: readonly LinkedMarketRow[],
  kind: DiscordHeroMarketViewKind,
  page: number,
  rowIndex: number,
): LinkedMarketRow {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0) {
    fail(`market row ${rowIndex} is out of range`);
  }
  const row = pageRows(rows, kind, page).find(
    (candidate) => candidate.rowIndex === rowIndex,
  );
  if (row === undefined) {
    fail(`market row ${rowIndex} is not on ${kind} page ${page}`);
  }
  return row;
}

function encodeBase36(value: number): string {
  return value.toString(36);
}

function decodeBase36(value: string, context: string): number {
  const decoded = Number.parseInt(value, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < 0 ||
    decoded.toString(36) !== value
  ) {
    fail(`${context} is non-canonical`);
  }
  return decoded;
}

function encodeKindTarget(kind: DiscordHeroMarketViewKind): string {
  return `k-${KIND_CODES[kind]}`;
}

function encodePageTarget(
  kind: DiscordHeroMarketViewKind,
  page: number,
): string {
  return `p-${KIND_CODES[kind]}-${encodeBase36(page)}`;
}

function encodeDetailTarget(
  kind: DiscordHeroMarketViewKind,
  page: number,
  row: LinkedMarketRow,
): string {
  const target = [
    "t",
    KIND_CODES[kind],
    encodeBase36(page),
    encodeBase36(row.rowIndex),
    encodeBase36(row.catalog.id),
    row.market.key,
  ].join("-");
  if (target.length > DISCORD_OPTION_TEXT_LIMIT) {
    fail(`detail target exceeds Discord's 100-character limit`);
  }
  return target;
}

function truncateOptionText(value: string): string {
  if (value.length <= DISCORD_OPTION_TEXT_LIMIT) return value;
  let result = "";
  for (const codePoint of value) {
    if (result.length + codePoint.length >= DISCORD_OPTION_TEXT_LIMIT) {
      break;
    }
    result += codePoint;
  }
  return `${result}…`;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function clonedFrozen<T>(value: T): DeepReadonly<T> {
  return deepFreeze(structuredClone(value));
}

export function discordHeroMarketPageCount(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroMarketViewKind,
): number {
  const projection = validateProjection(source, indexes);
  return pageCount(rowsForKind(projection, requireMarketKind(kind)));
}

export function discordHeroMarketPage(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroMarketViewKind,
  page: number,
): DiscordHeroMarketPage {
  const projection = validateProjection(source, indexes);
  const checkedKind = requireMarketKind(kind);
  const rows = rowsForKind(projection, checkedKind);
  const selected = pageRows(rows, checkedKind, page);
  return clonedFrozen({
    kind: checkedKind,
    page,
    pageCount: pageCount(rows),
    totalItems: rows.length,
    kindTarget: encodeKindTarget(checkedKind),
    pageTarget: encodePageTarget(checkedKind, page),
    options: selected.map((row) => {
      const displayName =
        row.catalog.name === null
          ? row.market.title
          : catalogEnglishName(row.catalog)!;
      return {
        rowIndex: row.rowIndex,
        itemKey: row.catalog.id,
        key: row.market.key,
        status: row.market.status,
        label: truncateOptionText(
          `${displayName} · ${row.market.stats.bestAsk?.display ?? "—"}`,
        ),
        description: truncateOptionText(
          `${row.catalog.grade} · ${row.catalog.type} · ${
            row.market.status === "confirmed" ? "Confirmed" : "Unconfirmed"
          }`,
        ),
        value: encodeDetailTarget(checkedKind, page, row),
      };
    }),
  });
}

export function encodeDiscordHeroMarketKind(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroMarketViewKind,
): string {
  validateProjection(source, indexes);
  return encodeKindTarget(requireMarketKind(kind));
}

export function decodeDiscordHeroMarketKind(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroMarketViewKind {
  validateProjection(source, indexes);
  const match = /^k-([acu])$/.exec(value);
  const kind = match === null ? null : kindFromCode(match[1]!);
  if (kind === null) {
    fail("kind target is malformed");
  }
  return kind;
}

export function encodeDiscordHeroMarketPage(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroMarketViewKind,
  page: number,
): string {
  const projection = validateProjection(source, indexes);
  const checkedKind = requireMarketKind(kind);
  requirePage(rowsForKind(projection, checkedKind), checkedKind, page);
  return encodePageTarget(checkedKind, page);
}

export function decodeDiscordHeroMarketPage(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroMarketLocation {
  const projection = validateProjection(source, indexes);
  const match = /^p-([acu])-([0-9a-z]+)$/.exec(value);
  const kind = match === null ? null : kindFromCode(match[1]!);
  if (match === null || kind === null) {
    fail("page target is malformed");
  }
  const page = decodeBase36(match[2]!, "page target");
  requirePage(rowsForKind(projection, kind), kind, page);
  return Object.freeze({ kind, page });
}

export function encodeDiscordHeroMarketTarget(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroMarketViewKind,
  page: number,
  rowIndex: number,
): string {
  const projection = validateProjection(source, indexes);
  const checkedKind = requireMarketKind(kind);
  const row = requireRowOnPage(
    rowsForKind(projection, checkedKind),
    checkedKind,
    page,
    rowIndex,
  );
  return encodeDetailTarget(checkedKind, page, row);
}

export function decodeDiscordHeroMarketTarget(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroMarketTarget {
  const projection = validateProjection(source, indexes);
  const match =
    /^t-([acu])-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
      value,
    );
  const kind = match === null ? null : kindFromCode(match[1]!);
  if (match === null || kind === null) {
    fail("detail target is malformed");
  }
  const page = decodeBase36(match[2]!, "detail target");
  const rowIndex = decodeBase36(match[3]!, "detail target");
  const itemKey = decodeBase36(match[4]!, "detail target");
  const key = match[5]!;
  const row = requireRowOnPage(
    rowsForKind(projection, kind),
    kind,
    page,
    rowIndex,
  );
  if (itemKey !== row.catalog.id) {
    fail(`detail target does not match item key for artifact row ${rowIndex}`);
  }
  if (key !== row.market.key) {
    fail(`detail target key ${key} does not match artifact row ${rowIndex}`);
  }
  if (encodeDetailTarget(kind, page, row) !== value) {
    fail("detail target is non-canonical");
  }
  return Object.freeze({ kind, page, rowIndex, itemKey, key });
}

export function readDiscordHeroMarketDetail(
  source: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  target: string,
): DiscordHeroMarketDetail {
  const decoded = decodeDiscordHeroMarketTarget(source, indexes, target);
  const market = source.pages[decoded.rowIndex]!;
  return clonedFrozen({
    kind: decoded.kind,
    page: decoded.page,
    rowIndex: decoded.rowIndex,
    target,
    key: market.key,
    title: market.title,
    status: market.status,
    statusReason:
      market.status === "confirmed"
        ? "confirmed-market-snapshot"
        : "unconfirmed-steam-market",
    catalogItem: {
      key: market.catalogItem!.id,
      slug: market.catalogItem!.slug,
      name: market.catalogItem!.name,
      type: market.catalogItem!.type,
      grade: market.catalogItem!.grade,
    },
    stats: market.stats,
    priceHistory: market.priceHistory,
    orderBook: market.orderBook,
    rawBody: market.rawBody,
    provenance: {
      page: market.source,
      artifact: source.provenance,
    },
  });
}
