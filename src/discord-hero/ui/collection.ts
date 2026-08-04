import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";

const COLLECTION_PAGE_SIZE = 25;

export const DISCORD_HERO_COLLECTION_KINDS = ["pets", "skins"] as const;

export type DiscordHeroCollectionKind =
  (typeof DISCORD_HERO_COLLECTION_KINDS)[number];
export type DiscordHeroPetRow = DiscordHeroDatasetRow<"pets">;
export type DiscordHeroSkinRow = DiscordHeroDatasetRow<"skins">;

export interface DiscordHeroCollectionPage {
  readonly kind: DiscordHeroCollectionKind;
  readonly page: number;
}

export interface DiscordHeroPetStat {
  readonly statType: string;
  readonly modType: string;
  readonly value: number;
}

export interface DiscordHeroPet {
  readonly key: number;
  readonly name: string;
  readonly description: string;
  readonly unlockCondition: string;
  readonly unlockParam1: number;
  readonly unlockParam2: number | null;
  readonly stats: readonly DiscordHeroPetStat[];
}

export interface DiscordHeroSkin {
  readonly key: number;
  readonly partsCategory: string;
  readonly decorableType: string;
  readonly groupKeys: number | string | null;
  readonly cost: number;
  readonly hasUpperLayer: boolean | null;
  readonly defaultUnlocked: boolean;
  readonly iconPath: string;
}

function requireCollectionKind(
  kind: DiscordHeroCollectionKind,
): DiscordHeroCollectionKind {
  if (kind !== "pets" && kind !== "skins") {
    throw new Error(`DiscordHero Collection has unknown kind ${String(kind)}`);
  }
  return kind;
}

function collectionRowCount(
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroCollectionKind,
): number {
  return requireCollectionKind(kind) === "pets"
    ? indexes.tables.pets.rows.length
    : indexes.tables.skins.rows.length;
}

export function discordHeroCollectionPageCount(
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroCollectionKind,
): number {
  return Math.ceil(collectionRowCount(indexes, kind) / COLLECTION_PAGE_SIZE);
}

export function discordHeroCollectionRows(
  indexes: DiscordHeroCatalogIndexes,
  kind: "pets",
  page: number,
): readonly DiscordHeroPetRow[];
export function discordHeroCollectionRows(
  indexes: DiscordHeroCatalogIndexes,
  kind: "skins",
  page: number,
): readonly DiscordHeroSkinRow[];
export function discordHeroCollectionRows(
  indexes: DiscordHeroCatalogIndexes,
  kind: DiscordHeroCollectionKind,
  page: number,
): readonly (DiscordHeroPetRow | DiscordHeroSkinRow)[] {
  const pageCount = discordHeroCollectionPageCount(indexes, kind);
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero ${kind} page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * COLLECTION_PAGE_SIZE;
  const rows =
    kind === "pets" ? indexes.tables.pets.rows : indexes.tables.skins.rows;
  return Object.freeze(rows.slice(start, start + COLLECTION_PAGE_SIZE));
}

export function encodeDiscordHeroCollectionPage(
  kind: DiscordHeroCollectionKind,
  page: number,
): string {
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new Error(
      "DiscordHero collection page must be a non-negative safe integer",
    );
  }
  return `c-${requireCollectionKind(kind) === "pets" ? "p" : "s"}-${page.toString(36)}`;
}

export function decodeDiscordHeroCollectionPage(
  value: string,
): DiscordHeroCollectionPage {
  const match = /^c-([ps])-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero collection page has invalid encoding");
  }
  const encodedPage = match[2]!;
  const page = Number.parseInt(encodedPage, 36);
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page.toString(36) !== encodedPage
  ) {
    throw new Error("DiscordHero collection page has non-canonical encoding");
  }
  return Object.freeze({
    kind: match[1] === "p" ? "pets" : "skins",
    page,
  });
}

export function decodeDiscordHeroCollectionKey(
  kind: DiscordHeroCollectionKind,
  value: string,
): number {
  requireCollectionKind(kind);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      `DiscordHero ${kind} key must be a canonical positive integer`,
    );
  }
  const key = Number(value);
  if (!Number.isSafeInteger(key) || String(key) !== value) {
    throw new Error(`DiscordHero ${kind} key must be a safe canonical integer`);
  }
  return key;
}

function englishText(
  values: Readonly<Record<string, unknown>>,
  path: string,
): string {
  const value = values["en-US"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} has no English source text`);
  }
  return value;
}

export function readDiscordHeroPet(
  indexes: DiscordHeroCatalogIndexes,
  petKey: number,
): DiscordHeroPet {
  const pet = indexes.tables.pets.groups.get(petKey)?.[0];
  if (pet === undefined) {
    throw new Error(`DiscordHero Collection has unknown pet ${petKey}`);
  }
  const stats = indexes.tables.pet_stats.groups.get(pet.StatDataKey);
  if (stats === undefined || stats.length === 0) {
    throw new Error(
      `DiscordHero pet ${petKey} has no source stats ${pet.StatDataKey}`,
    );
  }
  return Object.freeze({
    key: pet.PetKey,
    name: englishText(pet.NameKey_i18n, `pet ${petKey} name`),
    description: englishText(
      pet.DescriptionKey_i18n,
      `pet ${petKey} description`,
    ),
    unlockCondition: pet.UnlockCondition,
    unlockParam1: pet.Param1,
    unlockParam2: pet.Param2,
    stats: Object.freeze(
      stats.map((stat) =>
        Object.freeze({
          statType: stat.STATTYPE,
          modType: stat.MODTYPE,
          value: stat.Value,
        }),
      ),
    ),
  });
}

export function readDiscordHeroSkin(
  indexes: DiscordHeroCatalogIndexes,
  skinKey: number,
): DiscordHeroSkin {
  const skin = indexes.tables.skins.groups.get(skinKey)?.[0];
  if (skin === undefined) {
    throw new Error(`DiscordHero Collection has unknown skin ${skinKey}`);
  }
  return Object.freeze({
    key: skin.PcSkinKey,
    partsCategory: skin.PartsCategory,
    decorableType: skin.DecorableType,
    groupKeys: skin.GroupKeys,
    cost: skin.Cost,
    hasUpperLayer: skin.HasUpperLayer,
    defaultUnlocked: skin.IsDefaultUnlocked,
    iconPath: skin.IconPath,
  });
}
