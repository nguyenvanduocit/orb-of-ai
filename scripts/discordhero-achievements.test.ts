import { describe, expect, test } from "bun:test";

describe("DiscordHero community achievements command", () => {
  test("check mode validates the committed artifact", async () => {
    const { runDiscordHeroAchievementsCommand } =
      await import("./discordhero-achievements");

    await expect(
      runDiscordHeroAchievementsCommand(["--check"]),
    ).resolves.toBeUndefined();
  });

  test("rejects unknown or extra arguments", async () => {
    const { runDiscordHeroAchievementsCommand } =
      await import("./discordhero-achievements");

    await expect(
      runDiscordHeroAchievementsCommand(["--refresh"]),
    ).rejects.toThrow("Unknown DiscordHero achievements mode: --refresh");
    await expect(
      runDiscordHeroAchievementsCommand(["--check", "unexpected"]),
    ).rejects.toThrow(
      "Unexpected DiscordHero achievements arguments: unexpected",
    );
  });
});
