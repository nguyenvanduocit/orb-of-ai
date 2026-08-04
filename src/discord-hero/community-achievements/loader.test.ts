import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  compileDiscordHeroCommunityAchievements,
  serializeDiscordHeroCommunityAchievements,
} from "./compiler";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");

describe("DiscordHero community achievements loader", () => {
  test("loads validated bytes as deeply immutable runtime data", async () => {
    const { loadDiscordHeroCommunityAchievements } = await import("./loader");
    const directory = await mkdtemp(
      join(tmpdir(), "discordhero-achievements-loader-"),
    );
    const artifactPath = join(directory, "community-achievements.json");
    const compiled =
      await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);
    await writeFile(
      artifactPath,
      serializeDiscordHeroCommunityAchievements(compiled),
      "utf8",
    );
    try {
      const loaded = await loadDiscordHeroCommunityAchievements(artifactPath);

      expect(loaded.achievements).toHaveLength(56);
      expect(loaded.achievements[0]!.title).toBe("Hero Out of the Taskbar");
      expect(Object.isFrozen(loaded)).toBe(true);
      expect(Object.isFrozen(loaded.provenance)).toBe(true);
      expect(Object.isFrozen(loaded.achievements)).toBe(true);
      expect(Object.isFrozen(loaded.achievements[0])).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("loads the committed generated artifact by default", async () => {
    const { loadDiscordHeroCommunityAchievements } = await import("./loader");

    const loaded = await loadDiscordHeroCommunityAchievements();

    expect(loaded.provenance.source_sha256).toBe(
      "0cc4e546a80d8772f2118cae34a97e1e80a502a0d7be1238010b0077720d6178",
    );
    expect(loaded.achievements.at(-1)?.title).toBe("The Perfectionist");
  });

  test("rejects tampered artifact bytes before exposing runtime data", async () => {
    const { loadDiscordHeroCommunityAchievements } = await import("./loader");
    const directory = await mkdtemp(
      join(tmpdir(), "discordhero-achievements-tamper-"),
    );
    const artifactPath = join(directory, "community-achievements.json");
    const committedPath = join(
      PROJECT_ROOT,
      "assets/discordhero/community-achievements.json",
    );
    const tampered = (await readFile(committedPath, "utf8")).replace(
      "Hero Out of the Taskbar",
      "Hero Outside the Taskbar",
    );
    await writeFile(artifactPath, tampered, "utf8");
    try {
      await expect(
        loadDiscordHeroCommunityAchievements(artifactPath),
      ).rejects.toThrow("file does not match the reviewed artifact SHA-256");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
