import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("DiscordHero community content loader", () => {
  test("returns fresh deeply frozen lossless snapshots", async () => {
    const { loadDiscordHeroCommunityContent } = await import("./loader");

    const first = await loadDiscordHeroCommunityContent();
    const second = await loadDiscordHeroCommunityContent();

    expect(first).not.toBe(second);
    expect(first.documents).toHaveLength(153);
    expect(first.provenance.detailFiles).toBe(149);
    expect(first.reconciliation.unlistedDetails).toBe(59);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.provenance)).toBe(true);
    expect(Object.isFrozen(first.provenance.categoryCounts)).toBe(true);
    expect(Object.isFrozen(first.documents)).toBe(true);
    expect(Object.isFrozen(first.documents[0])).toBe(true);
    expect(Object.isFrozen(first.documents[0]!.frontmatter)).toBe(true);
    expect(Object.isFrozen(first.documents[0]!.frontmatter.breadcrumbs)).toBe(
      true,
    );
    expect(
      Object.isFrozen(first.documents[0]!.frontmatter.alternate_urls),
    ).toBe(true);
    expect(Object.isFrozen(first.reconciliation.categories)).toBe(true);
    expect(
      Object.isFrozen(first.reconciliation.categories[0]!.linkedDetails),
    ).toBe(true);
  });

  test("rejects tampered artifact bytes before exposing data", async () => {
    const { loadDiscordHeroCommunityContent } = await import("./loader");
    const directory = await mkdtemp(
      join(tmpdir(), "discordhero-community-content-tamper-"),
    );
    const artifactPath = join(directory, "community-content.json");
    const committedUrl = new URL(
      "../../../assets/discordhero/community-content.json",
      import.meta.url,
    );
    const tampered = (await readFile(committedUrl, "utf8")).replace(
      '"title":"Builds"',
      '"title":"Tampered"',
    );
    await writeFile(artifactPath, tampered);
    try {
      await expect(
        loadDiscordHeroCommunityContent(artifactPath),
      ).rejects.toThrow("file does not match the reviewed artifact SHA-256");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
