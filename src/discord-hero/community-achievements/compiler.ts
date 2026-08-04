import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const SOURCE_ACHIEVEMENTS_PATH =
  "preferences/taskbarhero/achievements.md";
export const SOURCE_ACHIEVEMENTS_URL = "https://taskbarhero.wiki/achievements";
export const SOURCE_ACHIEVEMENTS_SCRAPED_AT = "2026-07-28T14:15:14Z";
export const SOURCE_ACHIEVEMENTS_EXPORT_FORMAT = "goscrape-markdown/v2";
export const SOURCE_ACHIEVEMENTS_SHA256 =
  "0cc4e546a80d8772f2118cae34a97e1e80a502a0d7be1238010b0077720d6178";
export const COMMUNITY_ACHIEVEMENTS_PAYLOAD_SHA256 =
  "b6b6b40edf725990b7463743c5f48c7a3feb6106b94a3ed98ca450572140c65a";
export const COMMUNITY_ACHIEVEMENTS_FILE_SHA256 =
  "ad8c6b5ca126549a4b56946939d5c4157fcc5299474302db31f0686a83b7fc94";
export const EXPECTED_COMMUNITY_ACHIEVEMENTS = 56;
export const COMMUNITY_ACHIEVEMENTS_SUMMARY =
  "56 Steam achievements with live global unlock rates.";
export const COMMUNITY_ACHIEVEMENTS_FOOTER =
  "Percentages are the share of players who have unlocked each achievement (lower = rarer), pulled from Steam and cached hourly.";

export interface DiscordHeroCommunityAchievement {
  title: string;
  description: string;
  rate: string;
}

export interface DiscordHeroCommunityAchievements {
  format: "discordhero-community-achievements/v1";
  provenance: {
    source: string;
    source_url: string;
    scraped_at: string;
    export_format: string;
    source_sha256: string;
    compiled_sha256: string;
  };
  summary: string;
  achievements: DiscordHeroCommunityAchievement[];
  footer: string;
}

interface ParsedTaskbarHeroAchievements {
  sourceUrl: string;
  scrapedAt: string;
  exportFormat: string;
  sourceSha256: string;
  summary: string;
  achievements: DiscordHeroCommunityAchievement[];
  footer: string;
}

interface UnsignedDiscordHeroCommunityAchievements {
  format: DiscordHeroCommunityAchievements["format"];
  provenance: Omit<
    DiscordHeroCommunityAchievements["provenance"],
    "compiled_sha256"
  >;
  summary: string;
  achievements: DiscordHeroCommunityAchievement[];
  footer: string;
}

function fail(message: string): never {
  throw new Error(`DiscordHero community achievements: ${message}`);
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

function frontmatterValue(frontmatter: string, field: string): string {
  const prefix = `${field}: "`;
  const values = frontmatter
    .split("\n")
    .filter((line) => line.startsWith(prefix) && line.endsWith('"'))
    .map((line) => line.slice(prefix.length, -1));
  requireCondition(
    values.length === 1,
    `${field} must appear exactly once as a quoted top-level field`,
  );
  return values[0]!;
}

function isSingleLine(value: string): boolean {
  return value.length > 0 && value.trim() === value && !value.includes("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

export function parseTaskbarHeroAchievementsMarkdown(
  source: string | Uint8Array,
): ParsedTaskbarHeroAchievements {
  const bytes =
    typeof source === "string" ? Buffer.from(source, "utf8") : source;
  const markdown = Buffer.from(bytes).toString("utf8");
  requireCondition(
    markdown.startsWith("---\n"),
    "source must start with YAML frontmatter",
  );
  requireCondition(
    markdown.endsWith("\n"),
    "source must end with exactly one newline",
  );

  const bodyBoundary = "\n---\n\n";
  const boundaryIndex = markdown.indexOf(bodyBoundary, 4);
  requireCondition(
    boundaryIndex >= 0,
    "source frontmatter is not terminated exactly",
  );
  const frontmatter = markdown.slice(4, boundaryIndex);
  const sourceUrl = frontmatterValue(frontmatter, "source_url");
  const scrapedAt = frontmatterValue(frontmatter, "scraped_at");
  const exportFormat = frontmatterValue(frontmatter, "export_format");
  requireCondition(
    sourceUrl === SOURCE_ACHIEVEMENTS_URL,
    "source_url differs from the reviewed source",
  );
  requireCondition(
    scrapedAt === SOURCE_ACHIEVEMENTS_SCRAPED_AT,
    "scraped_at differs from the reviewed source",
  );
  requireCondition(
    exportFormat === SOURCE_ACHIEVEMENTS_EXPORT_FORMAT,
    "export_format differs from the reviewed source",
  );

  const body = markdown.slice(boundaryIndex + bodyBoundary.length, -1);
  const paragraphs = body.split("\n\n");
  requireCondition(
    paragraphs[0] === "Community" && paragraphs[1] === "# Achievements",
    "body header must exactly match the reviewed source",
  );
  requireCondition(
    paragraphs[2] === COMMUNITY_ACHIEVEMENTS_SUMMARY,
    "summary must exactly match the reviewed source",
  );
  requireCondition(
    paragraphs.at(-1) === COMMUNITY_ACHIEVEMENTS_FOOTER,
    "footer must exactly match the reviewed source",
  );

  const achievementParagraphs = paragraphs.slice(3, -1);
  requireCondition(
    achievementParagraphs.length === EXPECTED_COMMUNITY_ACHIEVEMENTS * 3,
    `must contain exactly ${EXPECTED_COMMUNITY_ACHIEVEMENTS} title/description/rate triples`,
  );

  const achievements: DiscordHeroCommunityAchievement[] = [];
  const titles = new Set<string>();
  for (let index = 0; index < EXPECTED_COMMUNITY_ACHIEVEMENTS; index += 1) {
    const title = achievementParagraphs[index * 3]!;
    const description = achievementParagraphs[index * 3 + 1]!;
    const rate = achievementParagraphs[index * 3 + 2]!;
    const recordNumber = index + 1;
    requireCondition(
      isSingleLine(title),
      `achievement ${recordNumber} title must be one non-empty line`,
    );
    requireCondition(
      isSingleLine(description),
      `achievement ${recordNumber} description must be one non-empty line`,
    );
    requireCondition(
      /^(?:100\.0|[1-9]?\d\.\d)%$/.test(rate),
      `achievement ${recordNumber} rate must be a percentage with one decimal place`,
    );
    requireCondition(
      !titles.has(title),
      `duplicate achievement title: ${title}`,
    );
    titles.add(title);
    achievements.push({ title, description, rate });
  }

  const sourceSha256 = sha256(bytes);
  requireCondition(
    sourceSha256 === SOURCE_ACHIEVEMENTS_SHA256,
    `source does not match the reviewed Markdown SHA-256: ${sourceSha256}`,
  );
  return {
    sourceUrl,
    scrapedAt,
    exportFormat,
    sourceSha256,
    summary: COMMUNITY_ACHIEVEMENTS_SUMMARY,
    achievements,
    footer: COMMUNITY_ACHIEVEMENTS_FOOTER,
  };
}

export async function compileDiscordHeroCommunityAchievements(
  projectRoot: string,
): Promise<DiscordHeroCommunityAchievements> {
  const bytes = await readFile(join(projectRoot, SOURCE_ACHIEVEMENTS_PATH));
  const parsed = parseTaskbarHeroAchievementsMarkdown(bytes);
  const unsigned: UnsignedDiscordHeroCommunityAchievements = {
    format: "discordhero-community-achievements/v1",
    provenance: {
      source: SOURCE_ACHIEVEMENTS_PATH,
      source_url: parsed.sourceUrl,
      scraped_at: parsed.scrapedAt,
      export_format: parsed.exportFormat,
      source_sha256: parsed.sourceSha256,
    },
    summary: parsed.summary,
    achievements: parsed.achievements,
    footer: parsed.footer,
  };
  const catalog: DiscordHeroCommunityAchievements = {
    ...unsigned,
    provenance: {
      ...unsigned.provenance,
      compiled_sha256: sha256(JSON.stringify(unsigned)),
    },
  };
  validateDiscordHeroCommunityAchievements(catalog);
  return catalog;
}

function withoutCompiledSha(
  catalog: DiscordHeroCommunityAchievements,
): UnsignedDiscordHeroCommunityAchievements {
  return {
    format: catalog.format,
    provenance: {
      source: catalog.provenance.source,
      source_url: catalog.provenance.source_url,
      scraped_at: catalog.provenance.scraped_at,
      export_format: catalog.provenance.export_format,
      source_sha256: catalog.provenance.source_sha256,
    },
    summary: catalog.summary,
    achievements: catalog.achievements,
    footer: catalog.footer,
  };
}

export function computeDiscordHeroCommunityAchievementsPayloadSha256(
  catalog: DiscordHeroCommunityAchievements,
): string {
  return sha256(JSON.stringify(withoutCompiledSha(catalog)));
}

export function validateDiscordHeroCommunityAchievements(
  value: unknown,
): asserts value is DiscordHeroCommunityAchievements {
  requireCondition(isRecord(value), "compiled artifact must be an object");
  requireCondition(
    hasExactKeys(value, [
      "format",
      "provenance",
      "summary",
      "achievements",
      "footer",
    ]),
    "compiled artifact must contain only format, provenance, summary, achievements, footer",
  );
  requireCondition(
    value.format === "discordhero-community-achievements/v1",
    "compiled artifact format is invalid",
  );
  requireCondition(
    isRecord(value.provenance),
    "compiled provenance is missing",
  );
  requireCondition(
    hasExactKeys(value.provenance, [
      "source",
      "source_url",
      "scraped_at",
      "export_format",
      "source_sha256",
      "compiled_sha256",
    ]),
    "compiled provenance contains unexpected or missing fields",
  );
  requireCondition(
    value.provenance.source === SOURCE_ACHIEVEMENTS_PATH &&
      value.provenance.source_url === SOURCE_ACHIEVEMENTS_URL &&
      value.provenance.scraped_at === SOURCE_ACHIEVEMENTS_SCRAPED_AT &&
      value.provenance.export_format === SOURCE_ACHIEVEMENTS_EXPORT_FORMAT &&
      value.provenance.source_sha256 === SOURCE_ACHIEVEMENTS_SHA256,
    "compiled provenance differs from the reviewed source",
  );
  requireCondition(
    value.summary === COMMUNITY_ACHIEVEMENTS_SUMMARY,
    "compiled summary differs from the reviewed source",
  );
  requireCondition(
    value.footer === COMMUNITY_ACHIEVEMENTS_FOOTER,
    "compiled footer differs from the reviewed source",
  );
  requireCondition(
    Array.isArray(value.achievements) &&
      value.achievements.length === EXPECTED_COMMUNITY_ACHIEVEMENTS,
    `compiled artifact must contain exactly ${EXPECTED_COMMUNITY_ACHIEVEMENTS} achievements`,
  );

  const titles = new Set<string>();
  for (const [index, candidate] of value.achievements.entries()) {
    const recordNumber = index + 1;
    requireCondition(
      isRecord(candidate),
      `achievement ${recordNumber} must be an object`,
    );
    requireCondition(
      hasExactKeys(candidate, ["title", "description", "rate"]),
      `achievement ${recordNumber} must contain only title, description, rate`,
    );
    requireCondition(
      typeof candidate.title === "string" && isSingleLine(candidate.title),
      `achievement ${recordNumber} title must be one non-empty line`,
    );
    requireCondition(
      typeof candidate.description === "string" &&
        isSingleLine(candidate.description),
      `achievement ${recordNumber} description must be one non-empty line`,
    );
    requireCondition(
      typeof candidate.rate === "string" &&
        /^(?:100\.0|[1-9]?\d\.\d)%$/.test(candidate.rate),
      `achievement ${recordNumber} rate must be a percentage with one decimal place`,
    );
    requireCondition(
      !titles.has(candidate.title),
      `duplicate achievement title: ${candidate.title}`,
    );
    titles.add(candidate.title);
  }

  const catalog = value as unknown as DiscordHeroCommunityAchievements;
  const computedSha256 =
    computeDiscordHeroCommunityAchievementsPayloadSha256(catalog);
  requireCondition(
    catalog.provenance.compiled_sha256 === computedSha256,
    `compiled SHA-256 mismatch: expected ${computedSha256}`,
  );
  requireCondition(
    catalog.provenance.compiled_sha256 ===
      COMMUNITY_ACHIEVEMENTS_PAYLOAD_SHA256,
    `compiled payload does not match the reviewed SHA-256: ${catalog.provenance.compiled_sha256}`,
  );
}

export function serializeDiscordHeroCommunityAchievements(
  catalog: DiscordHeroCommunityAchievements,
): string {
  validateDiscordHeroCommunityAchievements(catalog);
  const serialized = `${JSON.stringify(catalog)}\n`;
  const fileSha256 = sha256(serialized);
  requireCondition(
    fileSha256 === COMMUNITY_ACHIEVEMENTS_FILE_SHA256,
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

export async function writeDiscordHeroCommunityAchievements(
  projectRoot: string,
  outputPath = join(
    projectRoot,
    "assets/discordhero/community-achievements.json",
  ),
): Promise<{ catalog: DiscordHeroCommunityAchievements; changed: boolean }> {
  const catalog = await compileDiscordHeroCommunityAchievements(projectRoot);
  const serialized = serializeDiscordHeroCommunityAchievements(catalog);
  await mkdir(dirname(outputPath), { recursive: true });
  if (await fileExists(outputPath)) {
    const existing = await readFile(outputPath, "utf8");
    if (existing === serialized) {
      return { catalog, changed: false };
    }
  }

  const temporaryDirectory = await mkdtemp(
    join(dirname(outputPath), ".discordhero-community-achievements-"),
  );
  const temporaryPath = join(temporaryDirectory, basename(outputPath));
  try {
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return { catalog, changed: true };
}

export async function checkDiscordHeroCommunityAchievements(
  projectRoot: string,
  outputPath = join(
    projectRoot,
    "assets/discordhero/community-achievements.json",
  ),
): Promise<void> {
  const catalog = await compileDiscordHeroCommunityAchievements(projectRoot);
  const expected = serializeDiscordHeroCommunityAchievements(catalog);
  const actual = await readFile(outputPath, "utf8");
  requireCondition(
    actual === expected,
    `${outputPath} does not match generated community achievements`,
  );
}
