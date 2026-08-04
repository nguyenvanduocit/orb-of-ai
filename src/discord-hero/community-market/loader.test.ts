import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("DiscordHero community market loader", () => {
  test("loads the reviewed artifact as deeply immutable runtime data", async () => {
    const { loadDiscordHeroCommunityMarket } = await import("./loader");

    const market = await loadDiscordHeroCommunityMarket();

    expect(market.pages).toHaveLength(945);
    expect(market.reconciliation.landingDeclaredRecords).toBe(935);
    expect(Object.isFrozen(market)).toBe(true);
    expect(Object.isFrozen(market.provenance)).toBe(true);
    expect(Object.isFrozen(market.pages)).toBe(true);
    expect(Object.isFrozen(market.pages[0])).toBe(true);
    expect(Object.isFrozen(market.pages[0]!.orderBook)).toBe(true);
    expect(Object.isFrozen(market.pages[0]!.orderBook?.sellOrders[0])).toBe(
      true,
    );
  });

  test("rejects tampered bytes before exposing runtime data", async () => {
    const { loadDiscordHeroCommunityMarket } = await import("./loader");
    const directory = await mkdtemp(
      join(tmpdir(), "discordhero-community-market-tamper-"),
    );
    const artifactPath = join(directory, "community-market.json");
    const committedUrl = new URL(
      "../../../assets/discordhero/community-market.json",
      import.meta.url,
    );
    const tampered = (await readFile(committedUrl, "utf8")).replace(
      '"title":"Long Sword"',
      '"title":"Tampered Sword"',
    );
    await writeFile(artifactPath, tampered, "utf8");
    try {
      await expect(
        loadDiscordHeroCommunityMarket(artifactPath),
      ).rejects.toThrow("file does not match the reviewed artifact SHA-256");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
