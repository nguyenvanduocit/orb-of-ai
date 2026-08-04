import type { DiscordHeroCommunityContentCategory } from "../community-content/compiler";
import type { LoadedDiscordHeroCommunityContent } from "../community-content/loader";

export const DISCORD_HERO_COMMUNITY_CATEGORIES = [
  "builds",
  "tier-lists",
  "guides",
  "news",
] as const satisfies readonly DiscordHeroCommunityContentCategory[];

export const DISCORD_HERO_COMMUNITY_CHUNK_UNITS = 3_500;

export interface DiscordHeroCommunityListPageLocation {
  category: DiscordHeroCommunityContentCategory;
  listPage: number;
}

export interface DiscordHeroCommunityDocumentLocation extends DiscordHeroCommunityListPageLocation {
  documentIndex: number;
}

export interface DiscordHeroCommunityChunkLocation extends DiscordHeroCommunityDocumentLocation {
  chunkPage: number;
}

export interface DiscordHeroCommunityContentOption {
  label: string;
  description: string;
  value: string;
  path: string;
  documentIndex: number;
}

export interface DiscordHeroCommunityContentPage {
  category: DiscordHeroCommunityContentCategory;
  listPage: number;
  pageCount: number;
  options: DiscordHeroCommunityContentOption[];
  reconciliation: LoadedDiscordHeroCommunityContent["reconciliation"]["categories"][number];
}

export interface DiscordHeroCommunityContentDocumentProjection extends DiscordHeroCommunityChunkLocation {
  document: LoadedDiscordHeroCommunityContent["documents"][number];
  chunk: string;
  chunkCount: number;
  chunkTarget: string;
  exportFilename: string;
}

const COMMUNITY_DOCUMENTS_PER_PAGE = 25;
const LIST_ARTIFACT_IDENTITY_UNITS = 20;
const DOCUMENT_ARTIFACT_IDENTITY_UNITS = 10;
const DOCUMENT_SHA_IDENTITY_UNITS = 10;
const CATEGORY_CODES = {
  builds: "b",
  "tier-lists": "t",
  guides: "g",
  news: "n",
} as const satisfies Record<DiscordHeroCommunityContentCategory, string>;

const CATEGORIES_BY_CODE = {
  b: "builds",
  t: "tier-lists",
  g: "guides",
  n: "news",
} as const satisfies Record<string, DiscordHeroCommunityContentCategory>;

function fail(message: string): never {
  throw new Error(`DiscordHero Community projection: ${message}`);
}

function identityPrefix(sha256: string, units: number, label: string): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    return fail(`${label} SHA-256 is malformed`);
  }
  return sha256.slice(0, units);
}

function listArtifactIdentity(
  content: LoadedDiscordHeroCommunityContent,
): string {
  return identityPrefix(
    content.provenance.compiledSha256,
    LIST_ARTIFACT_IDENTITY_UNITS,
    "artifact",
  );
}

function documentIdentity(
  content: LoadedDiscordHeroCommunityContent,
  documentIndex: number,
): string {
  const document = content.documents[documentIndex];
  if (document === undefined) {
    return fail("document index is out of range");
  }
  return `${identityPrefix(
    content.provenance.compiledSha256,
    DOCUMENT_ARTIFACT_IDENTITY_UNITS,
    "artifact",
  )}${identityPrefix(
    document.sha256,
    DOCUMENT_SHA_IDENTITY_UNITS,
    "document",
  )}`;
}

function assertDocumentIdentity(
  content: LoadedDiscordHeroCommunityContent,
  documentIndex: number,
  identity: string,
): void {
  const artifactIdentity = identity.slice(0, DOCUMENT_ARTIFACT_IDENTITY_UNITS);
  if (
    artifactIdentity !==
    identityPrefix(
      content.provenance.compiledSha256,
      DOCUMENT_ARTIFACT_IDENTITY_UNITS,
      "artifact",
    )
  ) {
    fail("target has a stale artifact identity");
  }
  const document = content.documents[documentIndex];
  if (document === undefined) {
    fail("document index is out of range");
  }
  if (
    identity.slice(DOCUMENT_ARTIFACT_IDENTITY_UNITS) !==
    identityPrefix(document.sha256, DOCUMENT_SHA_IDENTITY_UNITS, "document")
  ) {
    fail("target has a stale document identity");
  }
}

function categoryCode(category: DiscordHeroCommunityContentCategory): string {
  const code = CATEGORY_CODES[category];
  if (!code) {
    return fail("category is malformed");
  }
  return code;
}

function categoryFromCode(code: string): DiscordHeroCommunityContentCategory {
  const category = CATEGORIES_BY_CODE[code as keyof typeof CATEGORIES_BY_CODE];
  if (!category) {
    return fail("target is malformed");
  }
  return category;
}

function encodeBase36(value: number, label: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(`${label} is out of range`);
  }
  return value.toString(36);
}

function decodeBase36(value: string, label: string): number {
  if (!/^(?:0|[1-9a-z][0-9a-z]*)$/.test(value)) {
    if (/^[0-9a-z]+$/.test(value)) {
      return fail(`${label} is non-canonical`);
    }
    return fail("target is malformed");
  }
  const decoded = Number.parseInt(value, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < 0 ||
    decoded.toString(36) !== value
  ) {
    return fail(`${label} is non-canonical`);
  }
  return decoded;
}

function documentIndexesForCategory(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
): number[] {
  categoryCode(category);
  const indexes: number[] = [];
  for (let index = 0; index < content.documents.length; index += 1) {
    if (content.documents[index]?.category === category) {
      indexes.push(index);
    }
  }
  return indexes;
}

function assertListPage(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
): void {
  const pageCount = discordHeroCommunityContentPageCount(content, category);
  if (
    !Number.isSafeInteger(listPage) ||
    listPage < 0 ||
    listPage >= pageCount
  ) {
    fail("list page is out of range");
  }
}

function assertDocumentLocation(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
  documentIndex: number,
): void {
  assertListPage(content, category, listPage);
  if (
    !Number.isSafeInteger(documentIndex) ||
    documentIndex < 0 ||
    documentIndex >= content.documents.length
  ) {
    fail("document index is out of range");
  }
  const document = content.documents[documentIndex]!;
  if (document.category !== category) {
    fail("document target is cross-category");
  }
  const categoryIndexes = documentIndexesForCategory(content, category);
  const categoryIndex = categoryIndexes.indexOf(documentIndex);
  if (
    categoryIndex < listPage * COMMUNITY_DOCUMENTS_PER_PAGE ||
    categoryIndex >= (listPage + 1) * COMMUNITY_DOCUMENTS_PER_PAGE
  ) {
    fail("document target is cross-page");
  }
}

function truncateUtf16(value: string, maxUnits: number): string {
  if (value.length <= maxUnits) {
    return value;
  }
  let truncated = "";
  for (const codePoint of value) {
    if (truncated.length + codePoint.length > maxUnits - 1) {
      break;
    }
    truncated += codePoint;
  }
  return `${truncated}…`;
}

export function discordHeroCommunityContentPageCount(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
): number {
  return Math.ceil(
    documentIndexesForCategory(content, category).length /
      COMMUNITY_DOCUMENTS_PER_PAGE,
  );
}

export function discordHeroCommunityContentPage(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
): DiscordHeroCommunityContentPage {
  assertListPage(content, category, listPage);
  const indexes = documentIndexesForCategory(content, category).slice(
    listPage * COMMUNITY_DOCUMENTS_PER_PAGE,
    (listPage + 1) * COMMUNITY_DOCUMENTS_PER_PAGE,
  );
  const reconciliation = content.reconciliation.categories.find(
    (candidate) => candidate.category === category,
  );
  if (!reconciliation) {
    return fail("category reconciliation is missing");
  }
  return {
    category,
    listPage,
    pageCount: discordHeroCommunityContentPageCount(content, category),
    options: indexes.map((documentIndex) => {
      const document = content.documents[documentIndex]!;
      return {
        label: truncateUtf16(document.frontmatter.title, 100),
        description: truncateUtf16(`${document.kind} · ${document.path}`, 100),
        value: encodeDiscordHeroCommunityDocumentTarget(
          content,
          category,
          listPage,
          documentIndex,
        ),
        path: document.path,
        documentIndex,
      };
    }),
    reconciliation,
  };
}

export function encodeDiscordHeroCommunityListPage(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
): string {
  assertListPage(content, category, listPage);
  return `cl-${categoryCode(category)}-${encodeBase36(listPage, "list page")}-${listArtifactIdentity(content)}`;
}

export function decodeDiscordHeroCommunityListPage(
  content: LoadedDiscordHeroCommunityContent,
  target: string,
): DiscordHeroCommunityListPageLocation {
  const match = /^cl-([a-z])-([0-9a-z]+)-([0-9a-f]{20})$/.exec(target);
  if (!match) {
    return fail("target is malformed");
  }
  const category = categoryFromCode(match[1]!);
  const listPage = decodeBase36(match[2]!, "list page");
  if (match[3] !== listArtifactIdentity(content)) {
    return fail("target has a stale artifact identity");
  }
  assertListPage(content, category, listPage);
  if (
    encodeDiscordHeroCommunityListPage(content, category, listPage) !== target
  ) {
    return fail("target is non-canonical");
  }
  return { category, listPage };
}

export function encodeDiscordHeroCommunityDocumentTarget(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
  documentIndex: number,
): string {
  assertDocumentLocation(content, category, listPage, documentIndex);
  return `cd-${categoryCode(category)}-${encodeBase36(listPage, "list page")}-${encodeBase36(documentIndex, "document index")}-${documentIdentity(content, documentIndex)}`;
}

export function decodeDiscordHeroCommunityDocumentTarget(
  content: LoadedDiscordHeroCommunityContent,
  target: string,
): DiscordHeroCommunityDocumentLocation {
  const match = /^cd-([a-z])-([0-9a-z]+)-([0-9a-z]+)-([0-9a-f]{20})$/.exec(
    target,
  );
  if (!match) {
    return fail("target is malformed");
  }
  const category = categoryFromCode(match[1]!);
  const listPage = decodeBase36(match[2]!, "list page");
  const documentIndex = decodeBase36(match[3]!, "document index");
  assertDocumentLocation(content, category, listPage, documentIndex);
  assertDocumentIdentity(content, documentIndex, match[4]!);
  if (
    encodeDiscordHeroCommunityDocumentTarget(
      content,
      category,
      listPage,
      documentIndex,
    ) !== target
  ) {
    return fail("target is non-canonical");
  }
  return { category, listPage, documentIndex };
}

export function encodeDiscordHeroCommunityChunkTarget(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
  documentIndex: number,
  chunkPage: number,
): string {
  assertDocumentLocation(content, category, listPage, documentIndex);
  const chunks = splitDiscordHeroCommunityMarkdown(
    content.documents[documentIndex]!.markdown,
  );
  if (
    !Number.isSafeInteger(chunkPage) ||
    chunkPage < 0 ||
    chunkPage >= chunks.length
  ) {
    return fail("chunk page is out of range");
  }
  return `cc-${categoryCode(category)}-${encodeBase36(listPage, "list page")}-${encodeBase36(documentIndex, "document index")}-${encodeBase36(chunkPage, "chunk page")}-${documentIdentity(content, documentIndex)}`;
}

export function decodeDiscordHeroCommunityChunkTarget(
  content: LoadedDiscordHeroCommunityContent,
  target: string,
): DiscordHeroCommunityChunkLocation {
  const match =
    /^cc-([a-z])-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)-([0-9a-f]{20})$/.exec(
      target,
    );
  if (!match) {
    return fail("target is malformed");
  }
  const category = categoryFromCode(match[1]!);
  const listPage = decodeBase36(match[2]!, "list page");
  const documentIndex = decodeBase36(match[3]!, "document index");
  const chunkPage = decodeBase36(match[4]!, "chunk page");
  assertDocumentLocation(content, category, listPage, documentIndex);
  assertDocumentIdentity(content, documentIndex, match[5]!);
  const chunks = splitDiscordHeroCommunityMarkdown(
    content.documents[documentIndex]!.markdown,
  );
  if (chunkPage >= chunks.length) {
    return fail("chunk page is out of range");
  }
  if (
    encodeDiscordHeroCommunityChunkTarget(
      content,
      category,
      listPage,
      documentIndex,
      chunkPage,
    ) !== target
  ) {
    return fail("target is non-canonical");
  }
  return { category, listPage, documentIndex, chunkPage };
}

export function splitDiscordHeroCommunityMarkdown(markdown: string): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const codePoint of markdown) {
    if (
      chunk.length > 0 &&
      chunk.length + codePoint.length > DISCORD_HERO_COMMUNITY_CHUNK_UNITS
    ) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += codePoint;
  }
  if (chunk.length > 0 || markdown.length === 0) {
    chunks.push(chunk);
  }
  return chunks;
}

export function readDiscordHeroCommunityContentDocument(
  content: LoadedDiscordHeroCommunityContent,
  category: DiscordHeroCommunityContentCategory,
  listPage: number,
  documentIndex: number,
  chunkPage: number,
): DiscordHeroCommunityContentDocumentProjection {
  assertDocumentLocation(content, category, listPage, documentIndex);
  const document = content.documents[documentIndex]!;
  const chunks = splitDiscordHeroCommunityMarkdown(document.markdown);
  if (
    !Number.isSafeInteger(chunkPage) ||
    chunkPage < 0 ||
    chunkPage >= chunks.length
  ) {
    return fail("chunk page is out of range");
  }
  return {
    category,
    listPage,
    documentIndex,
    chunkPage,
    document,
    chunk: chunks[chunkPage]!,
    chunkCount: chunks.length,
    chunkTarget: encodeDiscordHeroCommunityChunkTarget(
      content,
      category,
      listPage,
      documentIndex,
      chunkPage,
    ),
    exportFilename: `discordhero-community-${documentIndex + 1}-${document.path
      .replace(/\.md$/, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.md`,
  };
}
