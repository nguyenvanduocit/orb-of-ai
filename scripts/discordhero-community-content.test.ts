import { describe, expect, test } from "bun:test";

describe("DiscordHero community content command", () => {
  test("check mode validates the committed deterministic artifact", async () => {
    const { runDiscordHeroCommunityContentCommand } =
      await import("./discordhero-community-content");

    await expect(
      runDiscordHeroCommunityContentCommand(["--check"]),
    ).resolves.toBeUndefined();
  });

  test("rejects unknown and extra arguments without a network mode", async () => {
    const { runDiscordHeroCommunityContentCommand } =
      await import("./discordhero-community-content");

    await expect(
      runDiscordHeroCommunityContentCommand(["--refresh"]),
    ).rejects.toThrow("Unknown DiscordHero community content mode: --refresh");
    await expect(
      runDiscordHeroCommunityContentCommand(["--check", "unexpected"]),
    ).rejects.toThrow(
      "Unexpected DiscordHero community content arguments: unexpected",
    );
  });
});
