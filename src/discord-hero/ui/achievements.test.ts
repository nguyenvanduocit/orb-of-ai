import { beforeAll, describe, expect, test } from "bun:test";
import {
  type LoadedDiscordHeroCommunityAchievements,
  loadDiscordHeroCommunityAchievements,
} from "../community-achievements/loader";
import {
  decodeDiscordHeroAchievementPage,
  decodeDiscordHeroAchievementTarget,
  discordHeroAchievementPage,
  discordHeroAchievementPageCount,
  encodeDiscordHeroAchievementPage,
  encodeDiscordHeroAchievementTarget,
  readDiscordHeroAchievementDetail,
} from "./achievements";

let source: LoadedDiscordHeroCommunityAchievements;

beforeAll(async () => {
  source = await loadDiscordHeroCommunityAchievements();
});

describe("DiscordHero achievement UI projection", () => {
  test("covers all 56 source records once in deterministic 25/25/6 pages", () => {
    expect(discordHeroAchievementPageCount(source)).toBe(3);
    const pages = [0, 1, 2].map((page) =>
      discordHeroAchievementPage(source, page),
    );

    expect(pages.map((page) => page.achievements.length)).toEqual([25, 25, 6]);
    expect(
      pages
        .flatMap((page) => page.achievements)
        .map(({ title, rate }) => ({ title, rate })),
    ).toEqual(source.achievements.map(({ title, rate }) => ({ title, rate })));
    expect(pages[0]!.achievements.at(-1)).toMatchObject({
      rowIndex: 24,
      target: "a-o",
      title: "Horroric Cube",
      rate: "68.8%",
    });
    expect(pages[1]!.achievements[0]).toMatchObject({
      rowIndex: 25,
      target: "a-p",
      title: "Recipe for Immortality",
      rate: "67.1%",
    });
    expect(pages[1]!.achievements.at(-1)).toMatchObject({
      rowIndex: 49,
      target: "a-1d",
      title: "Heroes Never Walk Alone",
      rate: "17.0%",
    });
    expect(pages[2]!.achievements[0]).toMatchObject({
      rowIndex: 50,
      target: "a-1e",
      title: "Etched into the Soul",
      rate: "14.1%",
    });
    expect(pages[2]!.achievements.at(-1)).toMatchObject({
      rowIndex: 55,
      target: "a-1j",
      title: "The Perfectionist",
      rate: "0.2%",
    });
  });

  test("exposes exact summary, footer, provenance, and capture time on every page", () => {
    for (let page = 0; page < 3; page += 1) {
      expect(discordHeroAchievementPage(source, page)).toMatchObject({
        page,
        pageCount: 3,
        pageTarget: `p-${page}`,
        totalAchievements: 56,
        summary: "56 Steam achievements with live global unlock rates.",
        footer:
          "Percentages are the share of players who have unlocked each achievement (lower = rarer), pulled from Steam and cached hourly.",
        provenance: {
          sourceUrl: "https://taskbarhero.wiki/achievements",
          capturedAt: "2026-07-28T14:15:14Z",
          exportFormat: "goscrape-markdown/v2",
          sourceSha256:
            "0cc4e546a80d8772f2118cae34a97e1e80a502a0d7be1238010b0077720d6178",
        },
      });
    }
  });

  test("reads punctuation-heavy details by stable source row index", () => {
    expect(readDiscordHeroAchievementDetail(source, 1)).toEqual({
      rowIndex: 1,
      page: 0,
      target: "a-1",
      title: "TBH, This Game Slaps",
      description: "Clear stage 1-10 for the first time!",
      rate: "100.0%",
      provenance: {
        sourceUrl: "https://taskbarhero.wiki/achievements",
        capturedAt: "2026-07-28T14:15:14Z",
        exportFormat: "goscrape-markdown/v2",
        sourceSha256:
          "0cc4e546a80d8772f2118cae34a97e1e80a502a0d7be1238010b0077720d6178",
      },
    });
    expect(readDiscordHeroAchievementDetail(source, 53)).toMatchObject({
      rowIndex: 53,
      page: 2,
      target: "a-1h",
      title: "...Wait, I'm the Only One Left?",
      description:
        "Clear Normal 3-10 act boss with 2 party members dead in a 3-player party.",
      rate: "5.4%",
    });
  });

  test("returns fresh deeply frozen pages and details without source aliases", () => {
    const firstPage = discordHeroAchievementPage(source, 0);
    const secondPage = discordHeroAchievementPage(source, 0);
    const firstDetail = readDiscordHeroAchievementDetail(source, 0);
    const secondDetail = readDiscordHeroAchievementDetail(source, 0);

    expect(firstPage).not.toBe(secondPage);
    expect(firstPage.achievements).not.toBe(secondPage.achievements);
    expect(firstPage.achievements[0]).not.toBe(secondPage.achievements[0]);
    expect(firstPage.achievements[0]).not.toBe(source.achievements[0]);
    expect(firstPage.provenance).not.toBe(secondPage.provenance);
    expect(firstDetail).not.toBe(secondDetail);
    expect(firstDetail).not.toBe(source.achievements[0]);
    expect(firstDetail.provenance).not.toBe(secondDetail.provenance);

    for (const value of [
      firstPage,
      firstPage.achievements,
      firstPage.achievements[0],
      firstPage.provenance,
      firstDetail,
      firstDetail.provenance,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  test("round-trips canonical bounded page and row-index targets", () => {
    for (let page = 0; page < 3; page += 1) {
      const encoded = encodeDiscordHeroAchievementPage(source, page);
      expect(encoded).toBe(`p-${page}`);
      expect(decodeDiscordHeroAchievementPage(source, encoded)).toBe(page);
    }
    for (let rowIndex = 0; rowIndex < 56; rowIndex += 1) {
      const encoded = encodeDiscordHeroAchievementTarget(source, rowIndex);
      expect(decodeDiscordHeroAchievementTarget(source, encoded)).toBe(
        rowIndex,
      );
    }
    expect(encodeDiscordHeroAchievementTarget(source, 35)).toBe("a-z");
    expect(encodeDiscordHeroAchievementTarget(source, 36)).toBe("a-10");
    expect(encodeDiscordHeroAchievementTarget(source, 55)).toBe("a-1j");
  });

  test("rejects malformed, non-canonical, and out-of-range page targets", () => {
    for (const value of ["page-0", "p-", "p--1", "P-0", "p-0-extra"]) {
      expect(() => decodeDiscordHeroAchievementPage(source, value)).toThrow(
        "malformed",
      );
    }
    expect(() => decodeDiscordHeroAchievementPage(source, "p-00")).toThrow(
      "non-canonical",
    );
    expect(() => decodeDiscordHeroAchievementPage(source, "p-3")).toThrow(
      "out of range",
    );
    for (const page of [-1, 3, 1.5, Number.NaN]) {
      expect(() => encodeDiscordHeroAchievementPage(source, page)).toThrow(
        "out of range",
      );
      expect(() => discordHeroAchievementPage(source, page)).toThrow(
        "out of range",
      );
    }
  });

  test("rejects malformed, non-canonical, and out-of-range detail targets", () => {
    for (const value of [
      "achievement-0",
      "a-",
      "a--1",
      "A-0",
      "a-0-extra",
      "a-TBH, This Game Slaps",
    ]) {
      expect(() => decodeDiscordHeroAchievementTarget(source, value)).toThrow(
        "malformed",
      );
    }
    expect(() => decodeDiscordHeroAchievementTarget(source, "a-00")).toThrow(
      "non-canonical",
    );
    expect(() => decodeDiscordHeroAchievementTarget(source, "a-1k")).toThrow(
      "out of range",
    );
    for (const rowIndex of [-1, 56, 1.5, Number.NaN]) {
      expect(() =>
        encodeDiscordHeroAchievementTarget(source, rowIndex),
      ).toThrow("out of range");
      expect(() => readDiscordHeroAchievementDetail(source, rowIndex)).toThrow(
        "out of range",
      );
    }
  });
});
