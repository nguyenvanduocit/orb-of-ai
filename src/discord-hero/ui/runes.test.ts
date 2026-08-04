import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  decodeDiscordHeroRuneKey,
  decodeDiscordHeroRunePage,
  discordHeroRunePageCount,
  discordHeroRunes,
  encodeDiscordHeroRunePage,
} from "./runes";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero Rune paging", () => {
  test("covers all 197 source runes exactly once in eight bounded pages", () => {
    expect(discordHeroRunePageCount(indexes)).toBe(8);
    const rows = Array.from(
      { length: discordHeroRunePageCount(indexes) },
      (_, page) => discordHeroRunes(indexes, page),
    );
    expect(rows.slice(0, -1).every((page) => page.length === 25)).toBe(true);
    expect(rows.at(-1)).toHaveLength(22);
    expect(rows.flat().map((rune) => rune.RuneKey)).toEqual(
      indexes.tables.runes.rows.map((rune) => rune.RuneKey),
    );
  });

  test("round-trips canonical pages and rejects page/key forgery", () => {
    expect(decodeDiscordHeroRunePage(encodeDiscordHeroRunePage(7))).toBe(7);
    expect(decodeDiscordHeroRuneKey("1905021")).toBe(1_905_021);
    expect(() => decodeDiscordHeroRunePage("r-07")).toThrow("non-canonical");
    expect(() => discordHeroRunes(indexes, 8)).toThrow("outside");
    for (const value of ["0", "01", "-1", "1e2", "9007199254740992"]) {
      expect(() => decodeDiscordHeroRuneKey(value)).toThrow();
    }
  });
});
