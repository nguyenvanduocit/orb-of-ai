import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { posix } from "node:path";

export const SOURCE_COMMUNITY_CONTENT_ROOT = "preferences/taskbarhero";
export const SOURCE_COMMUNITY_CONTENT_AGGREGATE_SHA256 =
  "f18263626c0d25a7555c067652e577d64d687b7ac7f93328ed981ccb866934d6";
export const COMMUNITY_CONTENT_PAYLOAD_SHA256 =
  "47e026a0733b31fc7f171d00789017955eac1a9752471cb6d5c8394477064aca";
export const COMMUNITY_CONTENT_FILE_SHA256 =
  "c387cec4cae20f703c9452ca31739fc99eb13120e12efe940bfe821bc6683ada";

const CATEGORY_ORDER = ["builds", "tier-lists", "guides", "news"] as const;
const ALTERNATE_URL_LOCALES = [
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
const EXPECTED_DETAIL_COUNTS = {
  builds: 83,
  "tier-lists": 28,
  guides: 8,
  news: 30,
} as const;
const EXPECTED_SOURCE_FILES = 153;
const EXPECTED_DETAIL_FILES = 149;
const EXPECTED_RESOLVED_LANDING_LINKS = 90;
const EXPECTED_UNLISTED_DETAILS = 59;
const SOURCE_EXPORT_FORMAT = "goscrape-markdown/v2";

export type DiscordHeroCommunityContentCategory =
  (typeof CATEGORY_ORDER)[number];

export interface DiscordHeroCommunityContentAlternateUrls {
  de: string;
  en: string;
  es: string;
  fr: string;
  id: string;
  ja: string;
  ko: string;
  pl: string;
  "pt-br": string;
  ru: string;
  th: string;
  tr: string;
  uk: string;
  vi: string;
  "x-default": string;
  "zh-hans": string;
  "zh-hant": string;
}

export interface DiscordHeroCommunityContentFrontmatter {
  title: string;
  source_url: string;
  canonical_url: string;
  language: "en";
  breadcrumbs: string[];
  alternate_urls: DiscordHeroCommunityContentAlternateUrls;
  scraped_at: string;
  export_format: "goscrape-markdown/v2";
}

export interface DiscordHeroCommunityContentDocument {
  path: string;
  kind: "landing" | "detail";
  category: DiscordHeroCommunityContentCategory;
  sha256: string;
  frontmatter: DiscordHeroCommunityContentFrontmatter;
  markdown: string;
}

interface DiscordHeroCommunityContentCategoryCount {
  landings: 1;
  details: number;
  total: number;
}

export interface DiscordHeroCommunityContentCategoryReconciliation {
  category: DiscordHeroCommunityContentCategory;
  landingPath: string;
  detailCount: number;
  linkedDetails: string[];
  unlistedDetails: string[];
  reverseLinkMode: "markdown-link" | "plain-text-label";
  reverseLinkedDetails: string[];
}

export interface DiscordHeroCommunityContent {
  format: "discordhero-community-content/v1";
  contentPolicy: {
    classification: "time-stamped-community-snapshots";
    gameplayAuthority: false;
  };
  provenance: {
    sourceRoot: "preferences/taskbarhero";
    sourceFiles: number;
    landingFiles: number;
    detailFiles: number;
    categoryCounts: {
      builds: DiscordHeroCommunityContentCategoryCount;
      "tier-lists": DiscordHeroCommunityContentCategoryCount;
      guides: DiscordHeroCommunityContentCategoryCount;
      news: DiscordHeroCommunityContentCategoryCount;
    };
    scrapedAtMin: string;
    scrapedAtMax: string;
    sourceAggregateSha256: string;
    compiledSha256: string;
  };
  reconciliation: {
    totalDetails: number;
    resolvedLandingLinks: number;
    unlistedDetails: number;
    resolvedReverseLinks: number;
    categories: DiscordHeroCommunityContentCategoryReconciliation[];
  };
  documents: DiscordHeroCommunityContentDocument[];
}

type UnsignedDiscordHeroCommunityContent = Omit<
  DiscordHeroCommunityContent,
  "provenance"
> & {
  provenance: Omit<DiscordHeroCommunityContent["provenance"], "compiledSha256">;
};

interface IdentifiedCommunityContentPath {
  category: DiscordHeroCommunityContentCategory;
  kind: "landing" | "detail";
}

function fail(message: string): never {
  throw new Error(`DiscordHero community content: ${message}`);
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

function compareCanonical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compareCanonical);
  const expected = [...expectedKeys].sort(compareCanonical);
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function requireExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  message: string,
): asserts value is Record<string, unknown> {
  requireCondition(
    isRecord(value) && hasExactKeys(value, expectedKeys),
    message,
  );
}

function isNonEmptySingleLine(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("\n") &&
    !value.includes("\r")
  );
}

function identifySourcePath(
  sourcePath: string,
): IdentifiedCommunityContentPath {
  requireCondition(
    sourcePath.length > 0 &&
      !sourcePath.includes("\\") &&
      !sourcePath.includes("\0") &&
      !sourcePath.startsWith("/") &&
      posix.normalize(sourcePath) === sourcePath &&
      !sourcePath.split("/").some((part) => part === "." || part === ".."),
    `source-relative path is noncanonical: ${sourcePath}`,
  );
  for (const category of CATEGORY_ORDER) {
    if (sourcePath === `${category}.md`) {
      return { category, kind: "landing" };
    }
    const prefix = `${category}/`;
    if (!sourcePath.startsWith(prefix)) {
      continue;
    }
    const detailPath = sourcePath.slice(prefix.length);
    const validDetail =
      category === "builds"
        ? /^\d+\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(detailPath)
        : /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(detailPath);
    requireCondition(
      validDetail,
      `source-relative path is noncanonical: ${sourcePath}`,
    );
    return { category, kind: "detail" };
  }
  fail(`source-relative path is outside canonical sets: ${sourcePath}`);
}

function decodeMarkdownBytes(source: string | Uint8Array): {
  bytes: Uint8Array;
  markdown: string;
} {
  const bytes =
    typeof source === "string" ? Buffer.from(source, "utf8") : source;
  let markdown: string;
  try {
    markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("source must contain valid UTF-8");
  }
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

function parseQuotedValue(
  line: string | undefined,
  prefix: string,
  context: string,
): string {
  requireCondition(
    line !== undefined && line.startsWith(prefix),
    `frontmatter differs from the strict schema: expected ${context}`,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(line.slice(prefix.length));
  } catch {
    fail(`frontmatter differs from the strict schema: ${context} is unquoted`);
  }
  requireCondition(
    typeof parsed === "string",
    `frontmatter differs from the strict schema: ${context} is unquoted`,
  );
  return parsed;
}

function alternateUrlFor(
  locale: (typeof ALTERNATE_URL_LOCALES)[number],
  canonicalPath: string,
): string {
  const localized =
    locale === "en" || locale === "x-default"
      ? ""
      : `${locale === "pt-br" ? "pt" : locale}/`;
  return `https://taskbarhero.wiki/${localized}${canonicalPath}`;
}

function serializeFrontmatter(
  frontmatter: DiscordHeroCommunityContentFrontmatter,
): string {
  return [
    `title: ${JSON.stringify(frontmatter.title)}`,
    `source_url: ${JSON.stringify(frontmatter.source_url)}`,
    `canonical_url: ${JSON.stringify(frontmatter.canonical_url)}`,
    `language: ${JSON.stringify(frontmatter.language)}`,
    "breadcrumbs:",
    ...frontmatter.breadcrumbs.map(
      (breadcrumb) => `  - ${JSON.stringify(breadcrumb)}`,
    ),
    "alternate_urls:",
    ...ALTERNATE_URL_LOCALES.map(
      (locale) =>
        `  ${JSON.stringify(locale)}: ${JSON.stringify(frontmatter.alternate_urls[locale])}`,
    ),
    `scraped_at: ${JSON.stringify(frontmatter.scraped_at)}`,
    `export_format: ${JSON.stringify(frontmatter.export_format)}`,
  ].join("\n");
}

function parseFrontmatter(
  rawFrontmatter: string,
  sourcePath: string,
  identity: IdentifiedCommunityContentPath,
): DiscordHeroCommunityContentFrontmatter {
  const lines = rawFrontmatter.split("\n");
  let index = 0;
  const title = parseQuotedValue(
    lines[index++],
    "title: ",
    `${sourcePath} title`,
  );
  const sourceUrl = parseQuotedValue(
    lines[index++],
    "source_url: ",
    `${sourcePath} source_url`,
  );
  const canonicalUrl = parseQuotedValue(
    lines[index++],
    "canonical_url: ",
    `${sourcePath} canonical_url`,
  );
  const language = parseQuotedValue(
    lines[index++],
    "language: ",
    `${sourcePath} language`,
  );
  requireCondition(
    lines[index++] === "breadcrumbs:",
    "frontmatter differs from the strict schema: expected breadcrumbs",
  );
  const breadcrumbs: string[] = [];
  while (lines[index]?.startsWith("  - ")) {
    breadcrumbs.push(
      parseQuotedValue(
        lines[index++],
        "  - ",
        `${sourcePath} breadcrumb ${breadcrumbs.length + 1}`,
      ),
    );
  }
  requireCondition(
    lines[index++] === "alternate_urls:",
    "frontmatter differs from the strict schema: expected alternate_urls",
  );
  const alternateUrlValues: string[] = [];
  for (const locale of ALTERNATE_URL_LOCALES) {
    alternateUrlValues.push(
      parseQuotedValue(
        lines[index++],
        `  ${JSON.stringify(locale)}: `,
        `${sourcePath} alternate_urls.${locale}`,
      ),
    );
  }
  const scrapedAt = parseQuotedValue(
    lines[index++],
    "scraped_at: ",
    `${sourcePath} scraped_at`,
  );
  const exportFormat = parseQuotedValue(
    lines[index++],
    "export_format: ",
    `${sourcePath} export_format`,
  );
  requireCondition(
    index === lines.length,
    "frontmatter differs from the strict schema: unexpected or duplicate key",
  );

  const alternateUrls: DiscordHeroCommunityContentAlternateUrls = {
    de: alternateUrlValues[0]!,
    en: alternateUrlValues[1]!,
    es: alternateUrlValues[2]!,
    fr: alternateUrlValues[3]!,
    id: alternateUrlValues[4]!,
    ja: alternateUrlValues[5]!,
    ko: alternateUrlValues[6]!,
    pl: alternateUrlValues[7]!,
    "pt-br": alternateUrlValues[8]!,
    ru: alternateUrlValues[9]!,
    th: alternateUrlValues[10]!,
    tr: alternateUrlValues[11]!,
    uk: alternateUrlValues[12]!,
    vi: alternateUrlValues[13]!,
    "x-default": alternateUrlValues[14]!,
    "zh-hans": alternateUrlValues[15]!,
    "zh-hant": alternateUrlValues[16]!,
  };
  requireCondition(
    isNonEmptySingleLine(title),
    `${sourcePath} title must be one non-empty line`,
  );
  const expectedUrl = `https://taskbarhero.wiki/${sourcePath.slice(0, -3)}`;
  requireCondition(
    sourceUrl === expectedUrl && canonicalUrl === expectedUrl,
    `${sourcePath} source_url and canonical_url must match its canonical path`,
  );
  requireCondition(
    language === "en",
    `${sourcePath} language must be exactly en`,
  );
  requireCondition(
    breadcrumbs.length === (identity.kind === "landing" ? 2 : 3) &&
      breadcrumbs.every(isNonEmptySingleLine) &&
      breadcrumbs[0] === "Home",
    `${sourcePath} breadcrumbs are invalid`,
  );
  const expectedSecondBreadcrumb =
    identity.category === "tier-lists"
      ? identity.kind === "landing"
        ? "Tier lists"
        : "Tier Lists"
      : identity.category[0]!.toUpperCase() + identity.category.slice(1);
  requireCondition(
    breadcrumbs[1] === expectedSecondBreadcrumb,
    `${sourcePath} category breadcrumb is invalid`,
  );
  for (const locale of ALTERNATE_URL_LOCALES) {
    requireCondition(
      alternateUrls[locale] ===
        alternateUrlFor(locale, sourcePath.slice(0, -3)),
      `${sourcePath} alternate_urls.${locale} is invalid`,
    );
  }
  requireCondition(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(scrapedAt) &&
      new Date(scrapedAt).toISOString() === scrapedAt.replace(/Z$/, ".000Z"),
    `${sourcePath} scraped_at is invalid`,
  );
  requireCondition(
    exportFormat === SOURCE_EXPORT_FORMAT,
    `${sourcePath} export_format is invalid`,
  );

  const parsed: DiscordHeroCommunityContentFrontmatter = {
    title,
    source_url: sourceUrl,
    canonical_url: canonicalUrl,
    language: "en",
    breadcrumbs,
    alternate_urls: alternateUrls,
    scraped_at: scrapedAt,
    export_format: SOURCE_EXPORT_FORMAT,
  };
  requireCondition(
    serializeFrontmatter(parsed) === rawFrontmatter,
    "frontmatter differs from the strict schema",
  );
  return parsed;
}

export function parseTaskbarHeroCommunityMarkdown(
  source: string | Uint8Array,
  sourcePath: string,
): DiscordHeroCommunityContentDocument {
  const identity = identifySourcePath(sourcePath);
  const { bytes, markdown } = decodeMarkdownBytes(source);
  const boundary = "\n---\n\n";
  const boundaryIndex = markdown.indexOf(boundary, 4);
  requireCondition(
    boundaryIndex >= 0,
    "source frontmatter is not terminated exactly",
  );
  const rawFrontmatter = markdown.slice(4, boundaryIndex);
  const frontmatter = parseFrontmatter(rawFrontmatter, sourcePath, identity);
  return {
    path: sourcePath,
    kind: identity.kind,
    category: identity.category,
    sha256: sha256(bytes),
    frontmatter,
    markdown,
  };
}

function pathIsContained(rootPath: string, candidatePath: string): boolean {
  const fromRoot = relative(rootPath, candidatePath);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) &&
      fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`))
  );
}

async function requireRegularContainedFile(
  sourceRootRealPath: string,
  filePath: string,
  sourcePath: string,
): Promise<void> {
  const fileStat = await lstat(filePath);
  requireCondition(
    !fileStat.isSymbolicLink(),
    `symbolic links are not allowed: ${sourcePath}`,
  );
  requireCondition(
    fileStat.isFile(),
    `source entry must be a regular file: ${sourcePath}`,
  );
  const fileRealPath = await realpath(filePath);
  requireCondition(
    pathIsContained(sourceRootRealPath, fileRealPath),
    `source path escapes source root: ${sourcePath}`,
  );
}

async function discoverCategoryDetails(
  sourceRootPath: string,
  sourceRootRealPath: string,
  category: DiscordHeroCommunityContentCategory,
): Promise<string[]> {
  const categoryPath = join(sourceRootPath, category);
  const categoryStat = await lstat(categoryPath);
  requireCondition(
    !categoryStat.isSymbolicLink(),
    `symbolic links are not allowed: ${category}`,
  );
  requireCondition(
    categoryStat.isDirectory(),
    `${category} source must be a directory`,
  );
  const categoryRealPath = await realpath(categoryPath);
  requireCondition(
    pathIsContained(sourceRootRealPath, categoryRealPath),
    `source path escapes source root: ${category}`,
  );

  const paths: string[] = [];
  async function walk(
    directoryPath: string,
    relativeDirectory: string,
  ): Promise<void> {
    const entries = (
      await readdir(directoryPath, {
        withFileTypes: true,
      })
    ).sort((left, right) => compareCanonical(left.name, right.name));
    for (const entry of entries) {
      const relativeEntry = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const sourcePath = `${category}/${relativeEntry}`;
      const absoluteEntry = join(directoryPath, entry.name);
      const entryStat = await lstat(absoluteEntry);
      requireCondition(
        !entry.isSymbolicLink() && !entryStat.isSymbolicLink(),
        `symbolic links are not allowed: ${sourcePath}`,
      );
      if (entry.isDirectory() && entryStat.isDirectory()) {
        requireCondition(
          category === "builds" &&
            relativeDirectory === "" &&
            /^\d+$/.test(entry.name),
          `unexpected community content directory: ${sourcePath}`,
        );
        const directoryRealPath = await realpath(absoluteEntry);
        requireCondition(
          pathIsContained(sourceRootRealPath, directoryRealPath),
          `source path escapes source root: ${sourcePath}`,
        );
        await walk(absoluteEntry, relativeEntry);
        continue;
      }
      requireCondition(
        entry.isFile() && entryStat.isFile() && entry.name.endsWith(".md"),
        `unexpected community content source entry: ${sourcePath}`,
      );
      identifySourcePath(sourcePath);
      await requireRegularContainedFile(
        sourceRootRealPath,
        absoluteEntry,
        sourcePath,
      );
      paths.push(sourcePath);
    }
  }
  await walk(categoryPath, "");
  paths.sort(compareCanonical);
  requireCondition(
    paths.length === EXPECTED_DETAIL_COUNTS[category],
    `${category} must contain exactly ${EXPECTED_DETAIL_COUNTS[category]} detail Markdown files`,
  );
  return paths;
}

function parseMarkdownDestination(rawDestination: string): string {
  if (rawDestination.startsWith("<")) {
    const closing = rawDestination.indexOf(">");
    requireCondition(closing > 1, "Markdown link destination is malformed");
    return rawDestination.slice(1, closing);
  }
  return rawDestination.split(/\s+/, 1)[0]!;
}

interface LocalMarkdownLink {
  destination: string;
  resolvedPath: string;
}

function localMarkdownLinks(
  document: DiscordHeroCommunityContentDocument,
): LocalMarkdownLink[] {
  const links: LocalMarkdownLink[] = [];
  for (const match of document.markdown.matchAll(/\]\(([^)\n]+)\)/g)) {
    const destination = parseMarkdownDestination(match[1]!);
    if (
      destination.startsWith("#") ||
      /^(?:https?:|mailto:)/.test(destination)
    ) {
      continue;
    }
    requireCondition(
      destination.length > 0 &&
        !destination.startsWith("/") &&
        !destination.includes("\\") &&
        !destination.includes("\0"),
      `${document.path} contains a noncanonical local Markdown link`,
    );
    const withoutFragment = destination.split(/[?#]/, 1)[0]!;
    const resolvedPath = posix.normalize(
      posix.join(posix.dirname(document.path), withoutFragment),
    );
    requireCondition(
      resolvedPath !== ".." && !resolvedPath.startsWith("../"),
      `${document.path} contains a local Markdown path escape`,
    );
    links.push({ destination: withoutFragment, resolvedPath });
  }
  return links;
}

function buildReconciliation(
  documents: readonly DiscordHeroCommunityContentDocument[],
): DiscordHeroCommunityContent["reconciliation"] {
  const byPath = new Map(
    documents.map((document) => [document.path, document]),
  );
  const categories: DiscordHeroCommunityContentCategoryReconciliation[] = [];
  for (const category of CATEGORY_ORDER) {
    const landingPath = `${category}.md`;
    const landing = byPath.get(landingPath);
    requireCondition(landing, `missing canonical landing: ${landingPath}`);
    const detailPaths = documents
      .filter(
        (document) =>
          document.kind === "detail" && document.category === category,
      )
      .map((document) => document.path)
      .sort(compareCanonical);
    const detailPathSet = new Set(detailPaths);
    const linkedDetails: string[] = [];
    const seenLandingTargets = new Set<string>();
    for (const link of localMarkdownLinks(landing)) {
      if (link.resolvedPath === landingPath) {
        requireCondition(
          link.destination === landingPath,
          `noncanonical landing self target in ${landingPath}`,
        );
        continue;
      }
      const targetIdentity = identifySourcePath(link.resolvedPath);
      requireCondition(
        targetIdentity.kind === "detail" &&
          targetIdentity.category === category,
        `cross-category landing detail target in ${landingPath}: ${link.destination}`,
      );
      requireCondition(
        link.destination === link.resolvedPath,
        `noncanonical landing detail target in ${landingPath}: ${link.destination}`,
      );
      requireCondition(
        detailPathSet.has(link.resolvedPath),
        `landing detail target is missing: ${link.resolvedPath}`,
      );
      requireCondition(
        !seenLandingTargets.has(link.resolvedPath),
        `duplicate landing detail target: ${link.resolvedPath}`,
      );
      seenLandingTargets.add(link.resolvedPath);
      linkedDetails.push(link.resolvedPath);
    }
    linkedDetails.sort(compareCanonical);
    const unlistedDetails = detailPaths.filter(
      (path) => !seenLandingTargets.has(path),
    );

    const reverseLinkMode =
      category === "tier-lists" ? "plain-text-label" : "markdown-link";
    const reverseLinkedDetails: string[] = [];
    for (const detailPath of detailPaths) {
      const detail = byPath.get(detailPath)!;
      const links = localMarkdownLinks(detail);
      if (reverseLinkMode === "markdown-link") {
        const backlinks = links.filter(
          (link) => link.resolvedPath === landingPath,
        );
        requireCondition(
          backlinks.length === 1,
          `${detailPath} must contain exactly one Markdown landing backlink`,
        );
      } else {
        const plainTextLabels = detail.markdown
          .split("\n")
          .filter((line) => line === "← Tier lists");
        requireCondition(
          plainTextLabels.length === 1 &&
            !links.some((link) => link.resolvedPath === landingPath),
          `${detailPath} must preserve exactly one plain-text Tier lists backlink label`,
        );
      }
      reverseLinkedDetails.push(detailPath);
    }
    categories.push({
      category,
      landingPath,
      detailCount: detailPaths.length,
      linkedDetails,
      unlistedDetails,
      reverseLinkMode,
      reverseLinkedDetails,
    });
  }
  return {
    totalDetails: categories.reduce(
      (total, category) => total + category.detailCount,
      0,
    ),
    resolvedLandingLinks: categories.reduce(
      (total, category) => total + category.linkedDetails.length,
      0,
    ),
    unlistedDetails: categories.reduce(
      (total, category) => total + category.unlistedDetails.length,
      0,
    ),
    resolvedReverseLinks: categories.reduce(
      (total, category) => total + category.reverseLinkedDetails.length,
      0,
    ),
    categories,
  };
}

function expectedCategoryCounts(): DiscordHeroCommunityContent["provenance"]["categoryCounts"] {
  return {
    builds: { landings: 1, details: 83, total: 84 },
    "tier-lists": { landings: 1, details: 28, total: 29 },
    guides: { landings: 1, details: 8, total: 9 },
    news: { landings: 1, details: 30, total: 31 },
  };
}

function withoutCompiledSha(
  content: DiscordHeroCommunityContent,
): UnsignedDiscordHeroCommunityContent {
  return {
    format: content.format,
    contentPolicy: content.contentPolicy,
    provenance: {
      sourceRoot: content.provenance.sourceRoot,
      sourceFiles: content.provenance.sourceFiles,
      landingFiles: content.provenance.landingFiles,
      detailFiles: content.provenance.detailFiles,
      categoryCounts: content.provenance.categoryCounts,
      scrapedAtMin: content.provenance.scrapedAtMin,
      scrapedAtMax: content.provenance.scrapedAtMax,
      sourceAggregateSha256: content.provenance.sourceAggregateSha256,
    },
    reconciliation: content.reconciliation,
    documents: content.documents,
  };
}

export function computeDiscordHeroCommunityContentPayloadSha256(
  content: DiscordHeroCommunityContent,
): string {
  return sha256(JSON.stringify(withoutCompiledSha(content)));
}

export async function compileDiscordHeroCommunityContent(
  projectRoot: string,
): Promise<DiscordHeroCommunityContent> {
  const sourceRootPath = resolve(projectRoot, SOURCE_COMMUNITY_CONTENT_ROOT);
  const sourceRootStat = await lstat(sourceRootPath);
  requireCondition(
    !sourceRootStat.isSymbolicLink() && sourceRootStat.isDirectory(),
    "source root must be a real directory",
  );
  const sourceRootRealPath = await realpath(sourceRootPath);
  const sourcePaths: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const landingPath = `${category}.md`;
    await requireRegularContainedFile(
      sourceRootRealPath,
      join(sourceRootPath, landingPath),
      landingPath,
    );
    sourcePaths.push(landingPath);
    sourcePaths.push(
      ...(await discoverCategoryDetails(
        sourceRootPath,
        sourceRootRealPath,
        category,
      )),
    );
  }
  requireCondition(
    sourcePaths.length === EXPECTED_SOURCE_FILES &&
      new Set(sourcePaths).size === EXPECTED_SOURCE_FILES,
    `source census must contain exactly ${EXPECTED_SOURCE_FILES} unique Markdown paths`,
  );
  const sourceBytes = await Promise.all(
    sourcePaths.map((path) => readFile(join(sourceRootPath, path))),
  );
  const documents = sourcePaths.map((path, index) =>
    parseTaskbarHeroCommunityMarkdown(sourceBytes[index]!, path),
  );
  const sourceEntries = documents.map((document) => ({
    path: document.path,
    sha256: document.sha256,
  }));
  const sourceAggregateSha256 = sha256(JSON.stringify(sourceEntries));
  const sourceUrls = new Set<string>();
  for (const document of documents) {
    requireCondition(
      !sourceUrls.has(document.frontmatter.source_url),
      `duplicate canonical source identity: ${document.frontmatter.source_url}`,
    );
    sourceUrls.add(document.frontmatter.source_url);
  }
  const reconciliation = buildReconciliation(documents);
  requireCondition(
    reconciliation.totalDetails === EXPECTED_DETAIL_FILES &&
      reconciliation.resolvedLandingLinks === EXPECTED_RESOLVED_LANDING_LINKS &&
      reconciliation.unlistedDetails === EXPECTED_UNLISTED_DETAILS &&
      reconciliation.resolvedReverseLinks === EXPECTED_DETAIL_FILES,
    "source link reconciliation differs from the reviewed snapshot graph",
  );
  requireCondition(
    sourceAggregateSha256 === SOURCE_COMMUNITY_CONTENT_AGGREGATE_SHA256,
    `sources do not match the reviewed aggregate SHA-256: ${sourceAggregateSha256}`,
  );
  const scrapedAt = documents
    .map((document) => document.frontmatter.scraped_at)
    .sort(compareCanonical);
  const unsigned: UnsignedDiscordHeroCommunityContent = {
    format: "discordhero-community-content/v1",
    contentPolicy: {
      classification: "time-stamped-community-snapshots",
      gameplayAuthority: false,
    },
    provenance: {
      sourceRoot: SOURCE_COMMUNITY_CONTENT_ROOT,
      sourceFiles: EXPECTED_SOURCE_FILES,
      landingFiles: CATEGORY_ORDER.length,
      detailFiles: EXPECTED_DETAIL_FILES,
      categoryCounts: expectedCategoryCounts(),
      scrapedAtMin: scrapedAt[0]!,
      scrapedAtMax: scrapedAt.at(-1)!,
      sourceAggregateSha256,
    },
    reconciliation,
    documents,
  };
  const content: DiscordHeroCommunityContent = {
    ...unsigned,
    provenance: {
      ...unsigned.provenance,
      compiledSha256: sha256(JSON.stringify(unsigned)),
    },
  };
  validateDiscordHeroCommunityContent(content);
  return content;
}

function unsignedValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  requireExactObject(
    value.provenance,
    [
      "sourceRoot",
      "sourceFiles",
      "landingFiles",
      "detailFiles",
      "categoryCounts",
      "scrapedAtMin",
      "scrapedAtMax",
      "sourceAggregateSha256",
      "compiledSha256",
    ],
    "provenance contains unexpected or missing fields",
  );
  return {
    format: value.format,
    contentPolicy: value.contentPolicy,
    provenance: {
      sourceRoot: value.provenance.sourceRoot,
      sourceFiles: value.provenance.sourceFiles,
      landingFiles: value.provenance.landingFiles,
      detailFiles: value.provenance.detailFiles,
      categoryCounts: value.provenance.categoryCounts,
      scrapedAtMin: value.provenance.scrapedAtMin,
      scrapedAtMax: value.provenance.scrapedAtMax,
      sourceAggregateSha256: value.provenance.sourceAggregateSha256,
    },
    reconciliation: value.reconciliation,
    documents: value.documents,
  };
}

export function validateDiscordHeroCommunityContent(
  value: unknown,
): asserts value is DiscordHeroCommunityContent {
  requireExactObject(
    value,
    ["format", "contentPolicy", "provenance", "reconciliation", "documents"],
    "artifact contains unexpected or missing fields",
  );
  requireCondition(
    value.format === "discordhero-community-content/v1",
    "artifact format is invalid",
  );
  requireCondition(
    JSON.stringify(value.contentPolicy) ===
      JSON.stringify({
        classification: "time-stamped-community-snapshots",
        gameplayAuthority: false,
      }),
    "content policy is invalid",
  );
  requireExactObject(
    value.provenance,
    [
      "sourceRoot",
      "sourceFiles",
      "landingFiles",
      "detailFiles",
      "categoryCounts",
      "scrapedAtMin",
      "scrapedAtMax",
      "sourceAggregateSha256",
      "compiledSha256",
    ],
    "provenance contains unexpected or missing fields",
  );
  requireCondition(
    value.provenance.sourceRoot === SOURCE_COMMUNITY_CONTENT_ROOT &&
      value.provenance.sourceFiles === EXPECTED_SOURCE_FILES &&
      value.provenance.landingFiles === CATEGORY_ORDER.length &&
      value.provenance.detailFiles === EXPECTED_DETAIL_FILES &&
      JSON.stringify(value.provenance.categoryCounts) ===
        JSON.stringify(expectedCategoryCounts()),
    "provenance census is invalid",
  );
  requireCondition(
    typeof value.provenance.scrapedAtMin === "string" &&
      typeof value.provenance.scrapedAtMax === "string" &&
      typeof value.provenance.sourceAggregateSha256 === "string" &&
      /^[0-9a-f]{64}$/.test(value.provenance.sourceAggregateSha256) &&
      typeof value.provenance.compiledSha256 === "string" &&
      /^[0-9a-f]{64}$/.test(value.provenance.compiledSha256),
    "provenance hashes or capture range are invalid",
  );
  requireCondition(
    Array.isArray(value.documents) &&
      value.documents.length === EXPECTED_SOURCE_FILES,
    `artifact must contain exactly ${EXPECTED_SOURCE_FILES} documents`,
  );
  const parsedDocuments: DiscordHeroCommunityContentDocument[] = [];
  const documentPaths = new Set<string>();
  for (const [index, candidate] of value.documents.entries()) {
    requireExactObject(
      candidate,
      ["path", "kind", "category", "sha256", "frontmatter", "markdown"],
      `document ${index + 1} contains unexpected or missing fields`,
    );
    requireCondition(
      typeof candidate.path === "string",
      `document ${index + 1} path is invalid`,
    );
    const identity = identifySourcePath(candidate.path);
    requireCondition(
      candidate.kind === identity.kind &&
        candidate.category === identity.category,
      `document ${candidate.path} kind or category is invalid`,
    );
    requireCondition(
      typeof candidate.markdown === "string" &&
        typeof candidate.sha256 === "string" &&
        /^[0-9a-f]{64}$/.test(candidate.sha256),
      `document ${candidate.path} bytes or SHA-256 are invalid`,
    );
    const computedDocumentSha256 = sha256(
      Buffer.from(candidate.markdown, "utf8"),
    );
    requireCondition(
      candidate.sha256 === computedDocumentSha256,
      `document SHA-256 mismatch: ${candidate.path}`,
    );
    const parsed = parseTaskbarHeroCommunityMarkdown(
      candidate.markdown,
      candidate.path,
    );
    requireCondition(
      JSON.stringify(candidate.frontmatter) ===
        JSON.stringify(parsed.frontmatter),
      `document frontmatter does not match exact Markdown: ${candidate.path}`,
    );
    requireCondition(
      !documentPaths.has(candidate.path),
      `duplicate document path: ${candidate.path}`,
    );
    documentPaths.add(candidate.path);
    parsedDocuments.push(parsed);
  }
  const expectedOrder = [...parsedDocuments].sort((left, right) => {
    const categoryOrder =
      CATEGORY_ORDER.indexOf(left.category) -
      CATEGORY_ORDER.indexOf(right.category);
    if (categoryOrder !== 0) {
      return categoryOrder;
    }
    if (left.kind !== right.kind) {
      return left.kind === "landing" ? -1 : 1;
    }
    return compareCanonical(left.path, right.path);
  });
  requireCondition(
    parsedDocuments.every(
      (document, index) => document.path === expectedOrder[index]!.path,
    ),
    "documents are not in canonical order",
  );
  const sourceEntries = parsedDocuments.map((document) => ({
    path: document.path,
    sha256: document.sha256,
  }));
  const sourceAggregateSha256 = sha256(JSON.stringify(sourceEntries));
  requireCondition(
    value.provenance.sourceAggregateSha256 === sourceAggregateSha256 &&
      sourceAggregateSha256 === SOURCE_COMMUNITY_CONTENT_AGGREGATE_SHA256,
    "source aggregate SHA-256 mismatch",
  );
  const scrapedAt = parsedDocuments
    .map((document) => document.frontmatter.scraped_at)
    .sort(compareCanonical);
  requireCondition(
    value.provenance.scrapedAtMin === scrapedAt[0] &&
      value.provenance.scrapedAtMax === scrapedAt.at(-1),
    "provenance capture range does not match documents",
  );
  const expectedReconciliation = buildReconciliation(parsedDocuments);
  requireCondition(
    JSON.stringify(value.reconciliation) ===
      JSON.stringify(expectedReconciliation),
    "reconciliation does not match exact Markdown",
  );
  requireCondition(
    expectedReconciliation.totalDetails === EXPECTED_DETAIL_FILES &&
      expectedReconciliation.resolvedLandingLinks ===
        EXPECTED_RESOLVED_LANDING_LINKS &&
      expectedReconciliation.unlistedDetails === EXPECTED_UNLISTED_DETAILS &&
      expectedReconciliation.resolvedReverseLinks === EXPECTED_DETAIL_FILES,
    "reconciliation census differs from reviewed source",
  );
  const computedPayloadSha256 = sha256(JSON.stringify(unsignedValue(value)));
  requireCondition(
    value.provenance.compiledSha256 === computedPayloadSha256,
    `compiled SHA-256 mismatch: expected ${computedPayloadSha256}`,
  );
  requireCondition(
    value.provenance.compiledSha256 === COMMUNITY_CONTENT_PAYLOAD_SHA256,
    `compiled payload does not match the reviewed SHA-256: ${value.provenance.compiledSha256}`,
  );
}

export function serializeDiscordHeroCommunityContent(
  content: DiscordHeroCommunityContent,
): string {
  validateDiscordHeroCommunityContent(content);
  const serialized = `${JSON.stringify(content)}\n`;
  const fileSha256 = sha256(serialized);
  requireCondition(
    fileSha256 === COMMUNITY_CONTENT_FILE_SHA256,
    `artifact does not match the reviewed file SHA-256: ${fileSha256}`,
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

export async function writeDiscordHeroCommunityContent(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/community-content.json"),
): Promise<{ content: DiscordHeroCommunityContent; changed: boolean }> {
  const content = await compileDiscordHeroCommunityContent(projectRoot);
  const serialized = serializeDiscordHeroCommunityContent(content);
  await mkdir(dirname(outputPath), { recursive: true });
  if (await fileExists(outputPath)) {
    const existing = await readFile(outputPath, "utf8");
    if (existing === serialized) {
      return { content, changed: false };
    }
  }
  const temporaryDirectory = await mkdtemp(
    join(dirname(outputPath), ".discordhero-community-content-"),
  );
  const temporaryPath = join(temporaryDirectory, basename(outputPath));
  try {
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return { content, changed: true };
}

export async function checkDiscordHeroCommunityContent(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/community-content.json"),
): Promise<void> {
  const content = await compileDiscordHeroCommunityContent(projectRoot);
  const expected = serializeDiscordHeroCommunityContent(content);
  const actual = await readFile(outputPath, "utf8");
  requireCondition(
    actual === expected,
    `${outputPath} does not match generated community content`,
  );
}
