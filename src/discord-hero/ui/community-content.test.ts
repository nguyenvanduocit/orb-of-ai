import { beforeAll, describe, expect, test } from "bun:test";
import type { DiscordHeroCommunityContent } from "../community-content/compiler";
import type { LoadedDiscordHeroCommunityContent } from "../community-content/loader";
import { loadDiscordHeroCommunityContent } from "../community-content/loader";
import {
  DISCORD_HERO_COMMUNITY_CATEGORIES,
  DISCORD_HERO_COMMUNITY_CHUNK_UNITS,
  decodeDiscordHeroCommunityChunkTarget,
  decodeDiscordHeroCommunityDocumentTarget,
  decodeDiscordHeroCommunityListPage,
  discordHeroCommunityContentPage,
  discordHeroCommunityContentPageCount,
  encodeDiscordHeroCommunityChunkTarget,
  encodeDiscordHeroCommunityDocumentTarget,
  encodeDiscordHeroCommunityListPage,
  readDiscordHeroCommunityContentDocument,
  splitDiscordHeroCommunityMarkdown,
} from "./community-content";

let content: LoadedDiscordHeroCommunityContent;

beforeAll(async () => {
  content = await loadDiscordHeroCommunityContent();
});

describe("DiscordHero Community Codex projection", () => {
  test("pages all 153 documents in artifact canonical order with exact reconciliation", () => {
    const expectedPageCounts = {
      builds: 4,
      "tier-lists": 2,
      guides: 1,
      news: 2,
    } as const;
    const projectedPaths: string[] = [];

    for (const category of DISCORD_HERO_COMMUNITY_CATEGORIES) {
      expect(discordHeroCommunityContentPageCount(content, category)).toBe(
        expectedPageCounts[category],
      );
      for (
        let pageIndex = 0;
        pageIndex < expectedPageCounts[category];
        pageIndex += 1
      ) {
        const page = discordHeroCommunityContentPage(
          content,
          category,
          pageIndex,
        );
        expect(page.options.length).toBeLessThanOrEqual(25);
        expect(page.reconciliation.category).toBe(category);
        expect(page.reconciliation.detailCount).toBe(
          content.provenance.categoryCounts[category].details,
        );
        for (const option of page.options) {
          expect(option.label.length).toBeLessThanOrEqual(100);
          expect(option.description.length).toBeLessThanOrEqual(100);
          expect(option.value.length).toBeLessThanOrEqual(32);
          projectedPaths.push(option.path);
        }
      }
    }

    expect(projectedPaths).toEqual(
      content.documents.map((document) => document.path),
    );
    expect(projectedPaths).toHaveLength(153);
  });

  test("round-trips canonical category, page, document, and chunk identities", () => {
    let visitedDocuments = 0;
    let visitedChunks = 0;

    for (const category of DISCORD_HERO_COMMUNITY_CATEGORIES) {
      const pageCount = discordHeroCommunityContentPageCount(content, category);
      for (let listPage = 0; listPage < pageCount; listPage += 1) {
        const pageTarget = encodeDiscordHeroCommunityListPage(
          content,
          category,
          listPage,
        );
        expect(decodeDiscordHeroCommunityListPage(content, pageTarget)).toEqual(
          { category, listPage },
        );
        const page = discordHeroCommunityContentPage(
          content,
          category,
          listPage,
        );
        for (const option of page.options) {
          const documentTarget = encodeDiscordHeroCommunityDocumentTarget(
            content,
            category,
            listPage,
            option.documentIndex,
          );
          expect(documentTarget).toBe(option.value);
          expect(
            decodeDiscordHeroCommunityDocumentTarget(content, documentTarget),
          ).toEqual({
            category,
            listPage,
            documentIndex: option.documentIndex,
          });

          const first = readDiscordHeroCommunityContentDocument(
            content,
            category,
            listPage,
            option.documentIndex,
            0,
          );
          const reconstructed: string[] = [];
          for (
            let chunkPage = 0;
            chunkPage < first.chunkCount;
            chunkPage += 1
          ) {
            const chunkTarget = encodeDiscordHeroCommunityChunkTarget(
              content,
              category,
              listPage,
              option.documentIndex,
              chunkPage,
            );
            expect(
              decodeDiscordHeroCommunityChunkTarget(content, chunkTarget),
            ).toEqual({
              category,
              listPage,
              documentIndex: option.documentIndex,
              chunkPage,
            });
            const detail = readDiscordHeroCommunityContentDocument(
              content,
              category,
              listPage,
              option.documentIndex,
              chunkPage,
            );
            expect(detail.chunk.length).toBeLessThanOrEqual(
              DISCORD_HERO_COMMUNITY_CHUNK_UNITS,
            );
            expect(detail.chunkTarget).toBe(chunkTarget);
            reconstructed.push(detail.chunk);
            visitedChunks += 1;
          }
          expect(reconstructed.join("")).toBe(
            content.documents[option.documentIndex]!.markdown,
          );
          visitedDocuments += 1;
        }
      }
    }

    expect(visitedDocuments).toBe(153);
    expect(visitedChunks).toBeGreaterThan(153);
  });

  test("chunks by UTF-16 units without splitting astral code points", () => {
    const markdown = `${"a".repeat(3_499)}😀${"b".repeat(3_499)}🚀`;
    const chunks = splitDiscordHeroCommunityMarkdown(markdown);

    expect(chunks.join("")).toBe(markdown);
    expect(chunks.every((chunk) => chunk.length <= 3_500)).toBe(true);
    expect(chunks[0]).toBe("a".repeat(3_499));
    expect(chunks[1]?.startsWith("😀")).toBe(true);
    for (const chunk of chunks) {
      const finalUnit = chunk.charCodeAt(chunk.length - 1);
      expect(finalUnit < 0xd800 || finalUnit > 0xdbff).toBe(true);
    }
  });

  test("rejects noncanonical, cross-category, cross-page, and out-of-range targets", () => {
    const listTarget = encodeDiscordHeroCommunityListPage(content, "builds", 0);
    const documentTarget = encodeDiscordHeroCommunityDocumentTarget(
      content,
      "builds",
      0,
      0,
    );
    const chunkTarget = encodeDiscordHeroCommunityChunkTarget(
      content,
      "builds",
      0,
      0,
      0,
    );
    expect(() =>
      decodeDiscordHeroCommunityListPage(
        content,
        listTarget.replace("cl-b-0-", "cl-b-00-"),
      ),
    ).toThrow("non-canonical");
    expect(() =>
      decodeDiscordHeroCommunityListPage(
        content,
        listTarget.replace("cl-b-", "cl-x-"),
      ),
    ).toThrow("malformed");
    expect(() =>
      decodeDiscordHeroCommunityListPage(
        content,
        listTarget.replace("cl-b-0-", "cl-b-z-"),
      ),
    ).toThrow("out of range");
    expect(() =>
      decodeDiscordHeroCommunityDocumentTarget(
        content,
        documentTarget.replace("cd-b-", "cd-g-"),
      ),
    ).toThrow("cross-category");
    expect(() =>
      decodeDiscordHeroCommunityDocumentTarget(
        content,
        documentTarget.replace("cd-b-0-0-", "cd-b-1-0-"),
      ),
    ).toThrow("cross-page");
    expect(() =>
      decodeDiscordHeroCommunityDocumentTarget(
        content,
        documentTarget.replace("cd-b-0-0-", "cd-b-0-00-"),
      ),
    ).toThrow("non-canonical");
    expect(() =>
      decodeDiscordHeroCommunityChunkTarget(
        content,
        chunkTarget.replace("cc-b-0-0-0-", "cc-b-0-0-z-"),
      ),
    ).toThrow("out of range");
    expect(() =>
      encodeDiscordHeroCommunityDocumentTarget(content, "news", 0, 0),
    ).toThrow("cross-category");
    expect(() =>
      readDiscordHeroCommunityContentDocument(content, "builds", 0, 0, -1),
    ).toThrow("chunk page is out of range");
  });

  test("rejects list, document, and chunk identities from a shifted artifact", () => {
    const listTarget = encodeDiscordHeroCommunityListPage(content, "builds", 0);
    const documentTarget = encodeDiscordHeroCommunityDocumentTarget(
      content,
      "builds",
      0,
      0,
    );
    const chunkTarget = encodeDiscordHeroCommunityChunkTarget(
      content,
      "builds",
      0,
      0,
      0,
    );
    const shiftedArtifact = structuredClone(
      content,
    ) as DiscordHeroCommunityContent;
    shiftedArtifact.provenance.compiledSha256 = "a".repeat(64);
    shiftedArtifact.documents[0]!.path = "builds/shifted-secret.md";
    shiftedArtifact.documents[0]!.sha256 = "b".repeat(64);
    shiftedArtifact.documents[0]!.markdown = "SHIFTED SECRET MARKDOWN";

    expect(() =>
      decodeDiscordHeroCommunityListPage(shiftedArtifact, listTarget),
    ).toThrow("stale artifact identity");
    expect(() =>
      decodeDiscordHeroCommunityDocumentTarget(shiftedArtifact, documentTarget),
    ).toThrow("stale artifact identity");
    expect(() =>
      decodeDiscordHeroCommunityChunkTarget(shiftedArtifact, chunkTarget),
    ).toThrow("stale artifact identity");

    const shiftedDocument = structuredClone(
      content,
    ) as DiscordHeroCommunityContent;
    shiftedDocument.documents[0]!.path = "builds/shifted-secret.md";
    shiftedDocument.documents[0]!.sha256 = "b".repeat(64);
    shiftedDocument.documents[0]!.markdown = "SHIFTED SECRET MARKDOWN";
    expect(() =>
      decodeDiscordHeroCommunityDocumentTarget(shiftedDocument, documentTarget),
    ).toThrow("stale document identity");
    expect(() =>
      decodeDiscordHeroCommunityChunkTarget(shiftedDocument, chunkTarget),
    ).toThrow("stale document identity");
  });
});
