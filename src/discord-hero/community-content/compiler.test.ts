import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkDiscordHeroCommunityContent,
  compileDiscordHeroCommunityContent,
  computeDiscordHeroCommunityContentPayloadSha256,
  parseTaskbarHeroCommunityMarkdown,
  serializeDiscordHeroCommunityContent,
  validateDiscordHeroCommunityContent,
  writeDiscordHeroCommunityContent,
} from "./compiler";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const SOURCE_ROOT = join(PROJECT_ROOT, "preferences/taskbarhero");
const CATEGORIES = ["builds", "tier-lists", "guides", "news"] as const;
const EXPECTED_DETAILS = {
  builds: 83,
  "tier-lists": 28,
  guides: 8,
  news: 30,
} as const;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function expectedSourcePaths(): Promise<string[]> {
  const paths: string[] = [];
  for (const category of CATEGORIES) {
    paths.push(`${category}.md`);
    const details = (
      await readdir(join(SOURCE_ROOT, category), {
        recursive: true,
      })
    )
      .filter((path) => path.endsWith(".md"))
      .map((path) => `${category}/${path}`)
      .sort();
    paths.push(...details);
  }
  return paths;
}

async function createCanonicalProject(): Promise<string> {
  const projectRoot = await mkdtemp(
    join(tmpdir(), "discordhero-community-content-source-"),
  );
  const sourceRoot = join(projectRoot, "preferences/taskbarhero");
  await mkdir(sourceRoot, { recursive: true });
  for (const category of CATEGORIES) {
    await cp(
      join(SOURCE_ROOT, `${category}.md`),
      join(sourceRoot, `${category}.md`),
    );
    await cp(join(SOURCE_ROOT, category), join(sourceRoot, category), {
      recursive: true,
    });
  }
  return projectRoot;
}

describe("DiscordHero community content compiler", () => {
  test("compiles all 153 exact snapshots in canonical order without creating gameplay rules", async () => {
    const content = await compileDiscordHeroCommunityContent(PROJECT_ROOT);
    const expectedPaths = await expectedSourcePaths();

    expect(content.format).toBe("discordhero-community-content/v1");
    expect(content.contentPolicy).toEqual({
      classification: "time-stamped-community-snapshots",
      gameplayAuthority: false,
    });
    expect(content.provenance).toMatchObject({
      sourceRoot: "preferences/taskbarhero",
      sourceFiles: 153,
      landingFiles: 4,
      detailFiles: 149,
      categoryCounts: {
        builds: { landings: 1, details: 83, total: 84 },
        "tier-lists": { landings: 1, details: 28, total: 29 },
        guides: { landings: 1, details: 8, total: 9 },
        news: { landings: 1, details: 30, total: 31 },
      },
      sourceAggregateSha256:
        "f18263626c0d25a7555c067652e577d64d687b7ac7f93328ed981ccb866934d6",
    });
    expect(content.documents).toHaveLength(153);
    expect(content.documents.map((document) => document.path)).toEqual(
      expectedPaths,
    );
    expect(
      content.documents.reduce(
        (bytes, document) =>
          bytes + Buffer.byteLength(document.markdown, "utf8"),
        0,
      ),
    ).toBe(2_985_385);

    const sourceEntries: { path: string; sha256: string }[] = [];
    for (const document of content.documents) {
      const bytes = await readFile(join(SOURCE_ROOT, document.path));
      expect(Buffer.from(document.markdown, "utf8")).toEqual(bytes);
      expect(document.sha256).toBe(sha256(bytes));
      sourceEntries.push({ path: document.path, sha256: sha256(bytes) });
    }
    expect(sha256(JSON.stringify(sourceEntries))).toBe(
      content.provenance.sourceAggregateSha256,
    );
    expect(
      content.documents
        .find((document) => document.path === "tier-lists.md")
        ?.markdown.includes("Дмитро Волченко"),
    ).toBe(true);

    expect(content.documents[0]).toMatchObject({
      path: "builds.md",
      kind: "landing",
      category: "builds",
      sha256:
        "6b8433ce37f702048dc1e68982612ddd65c4c0738620a485047d3d229134bd6c",
      frontmatter: {
        title: "Builds",
        source_url: "https://taskbarhero.wiki/builds",
        canonical_url: "https://taskbarhero.wiki/builds",
        language: "en",
        breadcrumbs: ["Home", "Builds"],
        scraped_at: "2026-07-28T14:15:16Z",
        export_format: "goscrape-markdown/v2",
      },
    });
    expect(content.documents[0]!.frontmatter.alternate_urls).toEqual({
      de: "https://taskbarhero.wiki/de/builds",
      en: "https://taskbarhero.wiki/builds",
      es: "https://taskbarhero.wiki/es/builds",
      fr: "https://taskbarhero.wiki/fr/builds",
      id: "https://taskbarhero.wiki/id/builds",
      ja: "https://taskbarhero.wiki/ja/builds",
      ko: "https://taskbarhero.wiki/ko/builds",
      pl: "https://taskbarhero.wiki/pl/builds",
      "pt-br": "https://taskbarhero.wiki/pt/builds",
      ru: "https://taskbarhero.wiki/ru/builds",
      th: "https://taskbarhero.wiki/th/builds",
      tr: "https://taskbarhero.wiki/tr/builds",
      uk: "https://taskbarhero.wiki/uk/builds",
      vi: "https://taskbarhero.wiki/vi/builds",
      "x-default": "https://taskbarhero.wiki/builds",
      "zh-hans": "https://taskbarhero.wiki/zh-hans/builds",
      "zh-hant": "https://taskbarhero.wiki/zh-hant/builds",
    });
  });

  test("recomputes the exact observed landing and reverse-link graph", async () => {
    const content = await compileDiscordHeroCommunityContent(PROJECT_ROOT);
    const reports = new Map(
      content.reconciliation.categories.map((report) => [
        report.category,
        report,
      ]),
    );

    expect(content.reconciliation).toMatchObject({
      totalDetails: 149,
      resolvedLandingLinks: 90,
      unlistedDetails: 59,
      resolvedReverseLinks: 149,
    });
    expect(reports.get("builds")).toMatchObject({
      landingPath: "builds.md",
      detailCount: 83,
      reverseLinkMode: "markdown-link",
    });
    expect(reports.get("builds")?.linkedDetails).toHaveLength(24);
    expect(reports.get("builds")?.unlistedDetails).toHaveLength(59);
    expect(reports.get("tier-lists")).toMatchObject({
      landingPath: "tier-lists.md",
      detailCount: 28,
      reverseLinkMode: "plain-text-label",
      unlistedDetails: [],
    });
    expect(reports.get("tier-lists")?.linkedDetails).toHaveLength(28);
    expect(reports.get("guides")?.linkedDetails).toHaveLength(8);
    expect(reports.get("news")?.linkedDetails).toHaveLength(30);

    const documents = new Set(
      content.documents.map((document) => document.path),
    );
    const reconciledDetails: string[] = [];
    for (const report of content.reconciliation.categories) {
      expect(report.reverseLinkedDetails).toHaveLength(report.detailCount);
      expect(report.linkedDetails.every((path) => documents.has(path))).toBe(
        true,
      );
      expect(report.unlistedDetails.every((path) => documents.has(path))).toBe(
        true,
      );
      reconciledDetails.push(
        ...report.linkedDetails,
        ...report.unlistedDetails,
      );
    }
    expect(reconciledDetails).toHaveLength(149);
    expect(new Set(reconciledDetails).size).toBe(149);
  });

  test("strictly parses the eight-field frontmatter and rejects malformed or escaping input", async () => {
    const canonical = await readFile(join(SOURCE_ROOT, "guides.md"));

    expect(() =>
      parseTaskbarHeroCommunityMarkdown(canonical, "guides.md"),
    ).not.toThrow();
    expect(() =>
      parseTaskbarHeroCommunityMarkdown(
        Buffer.from(
          canonical
            .toString("utf8")
            .replace('title: "Guides"', 'title: "Guides"\ntitle: "Duplicate"'),
        ),
        "guides.md",
      ),
    ).toThrow("frontmatter differs from the strict schema");
    expect(() =>
      parseTaskbarHeroCommunityMarkdown(
        Buffer.from(
          canonical
            .toString("utf8")
            .replace(
              'export_format: "goscrape-markdown/v2"',
              'unknown: "field"\nexport_format: "goscrape-markdown/v2"',
            ),
        ),
        "guides.md",
      ),
    ).toThrow("frontmatter differs from the strict schema");
    expect(() =>
      parseTaskbarHeroCommunityMarkdown(canonical, "../guides.md"),
    ).toThrow("source-relative path is noncanonical");
    expect(() =>
      parseTaskbarHeroCommunityMarkdown(canonical, "guides\\escape.md"),
    ).toThrow("source-relative path is noncanonical");
    expect(() =>
      parseTaskbarHeroCommunityMarkdown(
        Uint8Array.from([0xff, 0xfe, 0xfd]),
        "guides.md",
      ),
    ).toThrow("valid UTF-8");
  });

  test("fails closed on count drift, outside entries, and symlinks before reading escaped bytes", async () => {
    const removedProject = await createCanonicalProject();
    const outsideProject = await createCanonicalProject();
    const symlinkProject = await createCanonicalProject();
    try {
      await unlink(
        join(removedProject, "preferences/taskbarhero/guides/attack-speed.md"),
      );
      await expect(
        compileDiscordHeroCommunityContent(removedProject),
      ).rejects.toThrow("guides must contain exactly 8 detail Markdown files");

      await writeFile(
        join(
          outsideProject,
          "preferences/taskbarhero/guides/not-a-snapshot.txt",
        ),
        "outside canonical Markdown sets\n",
      );
      await expect(
        compileDiscordHeroCommunityContent(outsideProject),
      ).rejects.toThrow("unexpected community content source entry");

      const linkPath = join(
        symlinkProject,
        "preferences/taskbarhero/guides/attack-speed.md",
      );
      await unlink(linkPath);
      await symlink(join(SOURCE_ROOT, "guides/attack-speed.md"), linkPath);
      await expect(
        compileDiscordHeroCommunityContent(symlinkProject),
      ).rejects.toThrow("symbolic links are not allowed");
    } finally {
      await rm(removedProject, { recursive: true, force: true });
      await rm(outsideProject, { recursive: true, force: true });
      await rm(symlinkProject, { recursive: true, force: true });
    }
  });

  test("fails closed on missing, duplicate, cross-category, and noncanonical landing targets", async () => {
    const projectRoot = await createCanonicalProject();
    const landingPath = join(projectRoot, "preferences/taskbarhero/builds.md");
    const canonical = await readFile(landingPath, "utf8");
    const target =
      "builds/1358/mid-game-priest-tank-sorc-aoe-ranger-main-dps.md";
    try {
      await writeFile(
        landingPath,
        canonical.replace(target, "builds/1358/missing.md"),
      );
      await expect(
        compileDiscordHeroCommunityContent(projectRoot),
      ).rejects.toThrow("landing detail target is missing");

      await writeFile(
        landingPath,
        canonical.replace(target, "builds/1806/solo-ranger-3-7-hell-budget.md"),
      );
      await expect(
        compileDiscordHeroCommunityContent(projectRoot),
      ).rejects.toThrow("duplicate landing detail target");

      await writeFile(
        landingPath,
        canonical.replace(target, "guides/attack-speed.md"),
      );
      await expect(
        compileDiscordHeroCommunityContent(projectRoot),
      ).rejects.toThrow("cross-category landing detail target");

      await writeFile(landingPath, canonical.replace(target, `./${target}`));
      await expect(
        compileDiscordHeroCommunityContent(projectRoot),
      ).rejects.toThrow("noncanonical landing detail target");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test("strict validator rejects unknown fields and every integrity cross-field tamper", async () => {
    const canonical = await compileDiscordHeroCommunityContent(PROJECT_ROOT);

    expect(() =>
      validateDiscordHeroCommunityContent({ ...canonical, unknown: true }),
    ).toThrow("artifact contains unexpected or missing fields");
    expect(() =>
      validateDiscordHeroCommunityContent({
        ...canonical,
        provenance: { ...canonical.provenance, unknown: true },
      }),
    ).toThrow("provenance contains unexpected or missing fields");
    expect(() =>
      validateDiscordHeroCommunityContent({
        ...canonical,
        documents: canonical.documents.map((document, index) =>
          index === 0 ? { ...document, unknown: true } : document,
        ),
      }),
    ).toThrow("document 1 contains unexpected or missing fields");
    expect(() =>
      validateDiscordHeroCommunityContent({
        ...canonical,
        documents: canonical.documents.map((document, index) =>
          index === 0
            ? {
                ...document,
                frontmatter: { ...document.frontmatter, unknown: true },
              }
            : document,
        ),
      }),
    ).toThrow("frontmatter does not match exact Markdown");

    const markdownTamper = structuredClone(canonical);
    markdownTamper.documents[0]!.markdown += "tampered";
    expect(() => validateDiscordHeroCommunityContent(markdownTamper)).toThrow(
      "document SHA-256 mismatch",
    );

    const metadataTamper = structuredClone(canonical);
    metadataTamper.documents[0]!.frontmatter.title = "Tampered";
    expect(() => validateDiscordHeroCommunityContent(metadataTamper)).toThrow(
      "frontmatter does not match exact Markdown",
    );

    const pathTamper = structuredClone(canonical);
    pathTamper.documents[0]!.path = "../builds.md";
    expect(() => validateDiscordHeroCommunityContent(pathTamper)).toThrow(
      "source-relative path is noncanonical",
    );

    const orderTamper = structuredClone(canonical);
    [orderTamper.documents[1], orderTamper.documents[2]] = [
      orderTamper.documents[2]!,
      orderTamper.documents[1]!,
    ];
    expect(() => validateDiscordHeroCommunityContent(orderTamper)).toThrow(
      "documents are not in canonical order",
    );

    const countTamper = structuredClone(canonical);
    countTamper.provenance.detailFiles = 148;
    expect(() => validateDiscordHeroCommunityContent(countTamper)).toThrow(
      "provenance census is invalid",
    );

    const linkTamper = structuredClone(canonical);
    linkTamper.reconciliation.categories[0]!.linkedDetails.pop();
    expect(() => validateDiscordHeroCommunityContent(linkTamper)).toThrow(
      "reconciliation does not match exact Markdown",
    );

    const selfHashedTamper = structuredClone(canonical);
    selfHashedTamper.documents[0]!.frontmatter.title = "Self-hashed tamper";
    selfHashedTamper.provenance.compiledSha256 =
      computeDiscordHeroCommunityContentPayloadSha256(selfHashedTamper);
    expect(() =>
      validateDiscordHeroCommunityContent(selfHashedTamper),
    ).toThrow();
  });

  test("serializes and atomically rebuilds byte-identical output while check stays read-only", async () => {
    const first = await compileDiscordHeroCommunityContent(PROJECT_ROOT);
    const second = await compileDiscordHeroCommunityContent(PROJECT_ROOT);
    expect(serializeDiscordHeroCommunityContent(second)).toBe(
      serializeDiscordHeroCommunityContent(first),
    );

    const outputRoot = await mkdtemp(
      join(tmpdir(), "discordhero-community-content-output-"),
    );
    const outputPath = join(outputRoot, "nested/community-content.json");
    try {
      const firstWrite = await writeDiscordHeroCommunityContent(
        PROJECT_ROOT,
        outputPath,
      );
      const firstBytes = await readFile(outputPath, "utf8");
      const secondWrite = await writeDiscordHeroCommunityContent(
        PROJECT_ROOT,
        outputPath,
      );
      expect(firstWrite.changed).toBe(true);
      expect(secondWrite.changed).toBe(false);
      expect(await readFile(outputPath, "utf8")).toBe(firstBytes);
      expect(await readdir(join(outputRoot, "nested"))).toEqual([
        "community-content.json",
      ]);

      const staleBytes = '{"stale":true}\n';
      await writeFile(outputPath, staleBytes);
      await expect(
        checkDiscordHeroCommunityContent(PROJECT_ROOT, outputPath),
      ).rejects.toThrow("does not match generated community content");
      expect(await readFile(outputPath, "utf8")).toBe(staleBytes);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
});
