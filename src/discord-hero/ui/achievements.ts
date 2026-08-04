import type { LoadedDiscordHeroCommunityAchievements } from "../community-achievements/loader";

const ACHIEVEMENTS_PER_PAGE = 25;

export interface DiscordHeroAchievementProvenance {
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly exportFormat: string;
  readonly sourceSha256: string;
}

export interface DiscordHeroAchievementListItem {
  readonly rowIndex: number;
  readonly target: string;
  readonly title: string;
  readonly rate: string;
}

export interface DiscordHeroAchievementPage {
  readonly page: number;
  readonly pageCount: number;
  readonly pageTarget: string;
  readonly totalAchievements: number;
  readonly summary: string;
  readonly footer: string;
  readonly provenance: DiscordHeroAchievementProvenance;
  readonly achievements: readonly DiscordHeroAchievementListItem[];
}

export interface DiscordHeroAchievementDetail {
  readonly rowIndex: number;
  readonly page: number;
  readonly target: string;
  readonly title: string;
  readonly description: string;
  readonly rate: string;
  readonly provenance: DiscordHeroAchievementProvenance;
}

function achievementProvenance(
  source: LoadedDiscordHeroCommunityAchievements,
): DiscordHeroAchievementProvenance {
  return Object.freeze({
    sourceUrl: source.provenance.source_url,
    capturedAt: source.provenance.scraped_at,
    exportFormat: source.provenance.export_format,
    sourceSha256: source.provenance.source_sha256,
  });
}

function requireAchievementPage(
  source: LoadedDiscordHeroCommunityAchievements,
  page: number,
): void {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page >= discordHeroAchievementPageCount(source)
  ) {
    throw new Error(`DiscordHero achievement page ${page} is out of range`);
  }
}

function requireAchievementRow(
  source: LoadedDiscordHeroCommunityAchievements,
  rowIndex: number,
): void {
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= source.achievements.length
  ) {
    throw new Error(`DiscordHero achievement row ${rowIndex} is out of range`);
  }
}

export function discordHeroAchievementPageCount(
  source: LoadedDiscordHeroCommunityAchievements,
): number {
  return Math.ceil(source.achievements.length / ACHIEVEMENTS_PER_PAGE);
}

export function discordHeroAchievementPage(
  source: LoadedDiscordHeroCommunityAchievements,
  page: number,
): DiscordHeroAchievementPage {
  requireAchievementPage(source, page);
  const start = page * ACHIEVEMENTS_PER_PAGE;
  const achievements = Object.freeze(
    source.achievements
      .slice(start, start + ACHIEVEMENTS_PER_PAGE)
      .map((achievement, offset) => {
        const rowIndex = start + offset;
        return Object.freeze({
          rowIndex,
          target: encodeDiscordHeroAchievementTarget(source, rowIndex),
          title: achievement.title,
          rate: achievement.rate,
        });
      }),
  );
  return Object.freeze({
    page,
    pageCount: discordHeroAchievementPageCount(source),
    pageTarget: encodeDiscordHeroAchievementPage(source, page),
    totalAchievements: source.achievements.length,
    summary: source.summary,
    footer: source.footer,
    provenance: achievementProvenance(source),
    achievements,
  });
}

export function readDiscordHeroAchievementDetail(
  source: LoadedDiscordHeroCommunityAchievements,
  rowIndex: number,
): DiscordHeroAchievementDetail {
  requireAchievementRow(source, rowIndex);
  const achievement = source.achievements[rowIndex]!;
  return Object.freeze({
    rowIndex,
    page: Math.floor(rowIndex / ACHIEVEMENTS_PER_PAGE),
    target: encodeDiscordHeroAchievementTarget(source, rowIndex),
    title: achievement.title,
    description: achievement.description,
    rate: achievement.rate,
    provenance: achievementProvenance(source),
  });
}

export function encodeDiscordHeroAchievementPage(
  source: LoadedDiscordHeroCommunityAchievements,
  page: number,
): string {
  requireAchievementPage(source, page);
  return `p-${page.toString(36)}`;
}

export function decodeDiscordHeroAchievementPage(
  source: LoadedDiscordHeroCommunityAchievements,
  value: string,
): number {
  const match = /^p-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero achievement page target is malformed");
  }
  const encoded = match[1]!;
  const page = Number.parseInt(encoded, 36);
  if (!Number.isSafeInteger(page) || page.toString(36) !== encoded) {
    throw new Error("DiscordHero achievement page target is non-canonical");
  }
  requireAchievementPage(source, page);
  return page;
}

export function encodeDiscordHeroAchievementTarget(
  source: LoadedDiscordHeroCommunityAchievements,
  rowIndex: number,
): string {
  requireAchievementRow(source, rowIndex);
  return `a-${rowIndex.toString(36)}`;
}

export function decodeDiscordHeroAchievementTarget(
  source: LoadedDiscordHeroCommunityAchievements,
  value: string,
): number {
  const match = /^a-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero achievement detail target is malformed");
  }
  const encoded = match[1]!;
  const rowIndex = Number.parseInt(encoded, 36);
  if (!Number.isSafeInteger(rowIndex) || rowIndex.toString(36) !== encoded) {
    throw new Error("DiscordHero achievement detail target is non-canonical");
  }
  requireAchievementRow(source, rowIndex);
  return rowIndex;
}
