import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";

export type DiscordHeroHeroRow = DiscordHeroDatasetRow<"heroes">;

export function discordHeroHeroes(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroHeroRow[] {
  const heroes = indexes.tables.heroes.rows;
  if (heroes.length !== 6) {
    throw new Error(
      `DiscordHero Heroes view expected 6 rows; received ${heroes.length}`,
    );
  }
  return heroes;
}

export function decodeDiscordHeroHeroKey(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      "DiscordHero hero key must be a canonical positive integer",
    );
  }
  const heroKey = Number(value);
  if (!Number.isSafeInteger(heroKey) || String(heroKey) !== value) {
    throw new Error("DiscordHero hero key must be a safe canonical integer");
  }
  return heroKey;
}
