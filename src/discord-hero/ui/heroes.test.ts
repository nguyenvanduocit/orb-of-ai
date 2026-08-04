import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { decodeDiscordHeroHeroKey, discordHeroHeroes } from "./heroes";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero Hero selection", () => {
  test("exposes all six source heroes in exact source order", () => {
    expect(discordHeroHeroes(indexes).map((hero) => hero.HeroKey)).toEqual([
      101, 201, 301, 401, 501, 601,
    ]);
  });

  test("accepts only canonical safe hero keys", () => {
    expect(decodeDiscordHeroHeroKey("601")).toBe(601);
    for (const value of ["0", "0601", "-1", "6e2", "9007199254740992"]) {
      expect(() => decodeDiscordHeroHeroKey(value)).toThrow();
    }
  });
});
