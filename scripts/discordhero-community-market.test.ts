import { describe, expect, test } from "bun:test";

describe("DiscordHero community market command", () => {
  test("check mode validates the committed artifact", async () => {
    const { runDiscordHeroCommunityMarketCommand } =
      await import("./discordhero-community-market");

    await expect(
      runDiscordHeroCommunityMarketCommand(["--check"]),
    ).resolves.toBeUndefined();
  });

  test("rejects unknown or extra arguments without a network mode", async () => {
    const { runDiscordHeroCommunityMarketCommand } =
      await import("./discordhero-community-market");

    await expect(
      runDiscordHeroCommunityMarketCommand(["--refresh"]),
    ).rejects.toThrow("Unknown DiscordHero community market mode: --refresh");
    await expect(
      runDiscordHeroCommunityMarketCommand(["--check", "unexpected"]),
    ).rejects.toThrow(
      "Unexpected DiscordHero community market arguments: unexpected",
    );
  });
});
