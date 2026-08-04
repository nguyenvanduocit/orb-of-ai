import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";

const RUNE_PAGE_SIZE = 25;

export type DiscordHeroRuneRow = DiscordHeroDatasetRow<"runes">;

export function discordHeroRunePageCount(
  indexes: DiscordHeroCatalogIndexes,
): number {
  return Math.ceil(indexes.tables.runes.rows.length / RUNE_PAGE_SIZE);
}

export function discordHeroRunes(
  indexes: DiscordHeroCatalogIndexes,
  page: number,
): readonly DiscordHeroRuneRow[] {
  const pageCount = discordHeroRunePageCount(indexes);
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero Rune page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * RUNE_PAGE_SIZE;
  return indexes.tables.runes.rows.slice(start, start + RUNE_PAGE_SIZE);
}

export function encodeDiscordHeroRunePage(page: number): string {
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new Error(
      "DiscordHero Rune page must be a non-negative safe integer",
    );
  }
  return `r-${page.toString(36)}`;
}

export function decodeDiscordHeroRunePage(value: string): number {
  if (!/^r-[0-9a-z]+$/.test(value)) {
    throw new Error("DiscordHero Rune page has invalid encoding");
  }
  const encoded = value.slice(2);
  const page = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page.toString(36) !== encoded
  ) {
    throw new Error("DiscordHero Rune page has non-canonical encoding");
  }
  return page;
}

export function decodeDiscordHeroRuneKey(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      "DiscordHero Rune key must be a canonical positive integer",
    );
  }
  const runeKey = Number(value);
  if (!Number.isSafeInteger(runeKey) || String(runeKey) !== value) {
    throw new Error("DiscordHero Rune key must be a safe canonical integer");
  }
  return runeKey;
}
