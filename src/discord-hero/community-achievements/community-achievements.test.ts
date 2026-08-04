import { describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileDiscordHeroCommunityAchievements } from "./compiler";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const SOURCE_PATH = join(
  PROJECT_ROOT,
  "preferences/taskbarhero/achievements.md",
);
const FOOTER =
  "Percentages are the share of players who have unlocked each achievement (lower = rarer), pulled from Steam and cached hourly.";

async function canonicalMarkdown(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

async function createProjectWithMarkdown(markdown: string): Promise<string> {
  const projectRoot = await mkdtemp(
    join(tmpdir(), "discordhero-achievements-"),
  );
  const sourceDirectory = join(projectRoot, "preferences/taskbarhero");
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(sourceDirectory, "achievements.md"), markdown, "utf8");
  return projectRoot;
}

async function compileMarkdown(markdown: string) {
  const projectRoot = await createProjectWithMarkdown(markdown);
  try {
    return await compileDiscordHeroCommunityAchievements(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

describe("DiscordHero community achievements", () => {
  test("compiles the exact TaskbarHero snapshot with preserved provenance", async () => {
    const catalog = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);

    expect(catalog).toMatchObject({
      format: "discordhero-community-achievements/v1",
      provenance: {
        source: "preferences/taskbarhero/achievements.md",
        source_url: "https://taskbarhero.wiki/achievements",
        scraped_at: "2026-07-28T14:15:14Z",
        export_format: "goscrape-markdown/v2",
        source_sha256:
          "0cc4e546a80d8772f2118cae34a97e1e80a502a0d7be1238010b0077720d6178",
      },
      summary: "56 Steam achievements with live global unlock rates.",
      footer:
        "Percentages are the share of players who have unlocked each achievement (lower = rarer), pulled from Steam and cached hourly.",
    });
    expect(catalog.achievements).toHaveLength(56);
    expect(catalog.achievements[0]).toEqual({
      title: "Hero Out of the Taskbar",
      description: "Clear stage 1-1 for the first time.",
      rate: "100.0%",
    });
    expect(catalog.achievements[55]).toEqual({
      title: "The Perfectionist",
      description:
        "Complete all decoration/engraving/inscription on all equipped gear (for items with 2/2/2 slots).",
      rate: "0.2%",
    });
  });

  test("rejects a changed summary", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      "56 Steam achievements with live global unlock rates.",
      "56 achievements.",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "summary must exactly match the reviewed source",
    );
  });

  test("rejects a changed footer", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      FOOTER,
      "Percentages are Steam unlock rates.",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "footer must exactly match the reviewed source",
    );
  });

  test("rejects a truncated achievement list", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      `\n\nThe Perfectionist\n\nComplete all decoration/engraving/inscription on all equipped gear (for items with 2/2/2 slots).\n\n0.2%\n\n${FOOTER}`,
      `\n\n${FOOTER}`,
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "must contain exactly 56 title/description/rate triples",
    );
  });

  test("rejects an extra achievement", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      `\n\n${FOOTER}`,
      `\n\nUnreviewed Achievement\n\nThis record is not in the snapshot.\n\n1.0%\n\n${FOOTER}`,
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "must contain exactly 56 title/description/rate triples",
    );
  });

  test("rejects a malformed achievement triple", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      "Clear stage 1-1 for the first time.",
      "Clear stage 1-1\nfor the first time.",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "achievement 1 description must be one non-empty line",
    );
  });

  test("rejects a rate outside the exact percent format", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      "\n\n100.0%",
      "\n\n100%",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "achievement 1 rate must be a percentage with one decimal place",
    );
  });

  test("rejects duplicate achievement titles", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      "TBH, This Game Slaps",
      "Hero Out of the Taskbar",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "duplicate achievement title: Hero Out of the Taskbar",
    );
  });

  test.each([
    [
      'source_url: "https://taskbarhero.wiki/achievements"',
      'source_url: "https://example.com/achievements"',
      "source_url",
    ],
    [
      'scraped_at: "2026-07-28T14:15:14Z"',
      'scraped_at: "2026-07-29T00:00:00Z"',
      "scraped_at",
    ],
    [
      'export_format: "goscrape-markdown/v2"',
      'export_format: "goscrape-markdown/v3"',
      "export_format",
    ],
  ])("rejects changed %s provenance", async (before, after, field) => {
    const markdown = (await canonicalMarkdown()).replace(before, after);

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      `${field} differs from the reviewed source`,
    );
  });

  test("rejects otherwise well-formed Markdown when its exact bytes change", async () => {
    const markdown = (await canonicalMarkdown()).replace(
      "Hero Out of the Taskbar",
      "Hero Outside the Taskbar",
    );

    await expect(compileMarkdown(markdown)).rejects.toThrow(
      "source does not match the reviewed Markdown SHA-256",
    );
  });

  test("serializes the compiled artifact to deterministic bytes", async () => {
    const { serializeDiscordHeroCommunityAchievements, sha256 } =
      await import("./compiler");
    const first = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);
    const second = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);

    const firstBytes = serializeDiscordHeroCommunityAchievements(first);
    const secondBytes = serializeDiscordHeroCommunityAchievements(second);

    expect(secondBytes).toBe(firstBytes);
    expect(firstBytes.endsWith("\n")).toBe(true);
    expect(JSON.parse(firstBytes)).toEqual(first);
    expect(sha256(firstBytes)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("rejects extra fields in the compiled artifact", async () => {
    const { validateDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const catalog = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);

    expect(() =>
      validateDiscordHeroCommunityAchievements({
        ...catalog,
        unexpected: true,
      }),
    ).toThrow(
      "compiled artifact must contain only format, provenance, summary, achievements, footer",
    );
    expect(() =>
      validateDiscordHeroCommunityAchievements({
        ...catalog,
        achievements: catalog.achievements.map((achievement, index) =>
          index === 0 ? { ...achievement, unexpected: true } : achievement,
        ),
      }),
    ).toThrow("achievement 1 must contain only title, description, rate");
  });

  test("rejects extra or truncated compiled achievements", async () => {
    const { validateDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const catalog = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);

    expect(() =>
      validateDiscordHeroCommunityAchievements({
        ...catalog,
        achievements: catalog.achievements.slice(0, -1),
      }),
    ).toThrow("compiled artifact must contain exactly 56 achievements");
    expect(() =>
      validateDiscordHeroCommunityAchievements({
        ...catalog,
        achievements: [...catalog.achievements, catalog.achievements[0]],
      }),
    ).toThrow("compiled artifact must contain exactly 56 achievements");
  });

  test("rejects malformed compiled rates and duplicate titles", async () => {
    const { validateDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const catalog = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);
    const malformed = structuredClone(catalog);
    malformed.achievements[0]!.rate = "100%";
    const duplicate = structuredClone(catalog);
    duplicate.achievements[1]!.title = duplicate.achievements[0]!.title;

    expect(() => validateDiscordHeroCommunityAchievements(malformed)).toThrow(
      "achievement 1 rate must be a percentage with one decimal place",
    );
    expect(() => validateDiscordHeroCommunityAchievements(duplicate)).toThrow(
      "duplicate achievement title: Hero Out of the Taskbar",
    );
  });

  test("rejects changed compiled provenance", async () => {
    const { validateDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const catalog = await compileDiscordHeroCommunityAchievements(PROJECT_ROOT);

    expect(() =>
      validateDiscordHeroCommunityAchievements({
        ...catalog,
        provenance: {
          ...catalog.provenance,
          source_url: "https://example.com/achievements",
        },
      }),
    ).toThrow("compiled provenance differs from the reviewed source");
  });

  test("rejects content tamper after its self-hash is recomputed", async () => {
    const {
      computeDiscordHeroCommunityAchievementsPayloadSha256,
      validateDiscordHeroCommunityAchievements,
    } = await import("./compiler");
    const catalog = structuredClone(
      await compileDiscordHeroCommunityAchievements(PROJECT_ROOT),
    );
    catalog.achievements[0]!.description = "Tampered.";
    catalog.provenance.compiled_sha256 =
      computeDiscordHeroCommunityAchievementsPayloadSha256(catalog);

    expect(() => validateDiscordHeroCommunityAchievements(catalog)).toThrow(
      "compiled payload does not match the reviewed SHA-256",
    );
  });

  test("writes atomically and reports an unchanged second build", async () => {
    const {
      checkDiscordHeroCommunityAchievements,
      writeDiscordHeroCommunityAchievements,
    } = await import("./compiler");
    const outputRoot = await mkdtemp(
      join(tmpdir(), "discordhero-achievements-output-"),
    );
    const outputPath = join(outputRoot, "nested/community-achievements.json");
    try {
      const first = await writeDiscordHeroCommunityAchievements(
        PROJECT_ROOT,
        outputPath,
      );
      const firstBytes = await readFile(outputPath, "utf8");
      const second = await writeDiscordHeroCommunityAchievements(
        PROJECT_ROOT,
        outputPath,
      );

      expect(first.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(await readFile(outputPath, "utf8")).toBe(firstBytes);
      expect(await readdir(join(outputRoot, "nested"))).toEqual([
        "community-achievements.json",
      ]);
      await expect(
        checkDiscordHeroCommunityAchievements(PROJECT_ROOT, outputPath),
      ).resolves.toBeUndefined();
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  test("check mode rejects stale bytes without changing them", async () => {
    const { checkDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const outputRoot = await mkdtemp(
      join(tmpdir(), "discordhero-achievements-check-"),
    );
    const outputPath = join(outputRoot, "community-achievements.json");
    const staleBytes = '{"stale":true}\n';
    await writeFile(outputPath, staleBytes, "utf8");
    try {
      await expect(
        checkDiscordHeroCommunityAchievements(PROJECT_ROOT, outputPath),
      ).rejects.toThrow("does not match generated community achievements");
      expect(await readFile(outputPath, "utf8")).toBe(staleBytes);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  test("a source validation failure preserves the existing artifact", async () => {
    const { writeDiscordHeroCommunityAchievements } =
      await import("./compiler");
    const projectRoot = await createProjectWithMarkdown(
      (await canonicalMarkdown()).replace("\n\n100.0%", "\n\n100%"),
    );
    const outputPath = join(
      projectRoot,
      "assets/discordhero/community-achievements.json",
    );
    const existingBytes = '{"keep":"me"}\n';
    await mkdir(join(projectRoot, "assets/discordhero"), { recursive: true });
    await writeFile(outputPath, existingBytes, "utf8");
    try {
      await expect(
        writeDiscordHeroCommunityAchievements(projectRoot, outputPath),
      ).rejects.toThrow(
        "achievement 1 rate must be a percentage with one decimal place",
      );
      expect(await readFile(outputPath, "utf8")).toBe(existingBytes);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
