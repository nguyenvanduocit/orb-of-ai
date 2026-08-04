import { describe, expect, test } from "bun:test";
import rawLevelRowsJson from "../../../preferences/taskbarhero/raw-data/current/datasets/levels.json";
import {
  MAX_LEVEL,
  advanceLevels,
  applyOfflineRuneBoost,
  classifyOfflineElapsed,
  createLevelCurve,
  experienceToReachLevel,
  offlineRewardAtStage,
  offlineRuneBonuses,
  type LevelCurve,
  type LevelEntry,
  type LevelProgress,
} from "./progression";
import * as progressionModule from "./progression";

interface RawLevelRow {
  Level: number;
  ExpForLevelUp: number;
}

const rawLevelRows: readonly RawLevelRow[] = rawLevelRowsJson;
const LEVELS = rawLevelRows.map((row) => ({
  level: row.Level,
  experienceForLevelUp: row.ExpForLevelUp,
}));

type ExpectedLevelProgressSummary =
  | Readonly<{
      status: "progressing";
      level: number;
      experience: number;
      nextLevel: number;
      experienceForLevelUp: number;
      experienceRemaining: number;
      progressPercent: number;
    }>
  | Readonly<{
      status: "max-level";
      level: 100;
      experience: number;
      terminalBarExperience: number;
      progressPercent: number;
    }>;

interface ExpectedProgressionApi {
  readonly summarizeLevelProgress: (
    curve: LevelCurve,
    progress: LevelProgress,
  ) => ExpectedLevelProgressSummary;
  readonly toCumulativeSourceExperience: (
    curve: LevelCurve,
    progress: LevelProgress,
  ) => number;
  readonly fromCumulativeSourceExperience: (
    curve: LevelCurve,
    cumulativeExperience: number,
  ) => Readonly<LevelProgress>;
}

function progressionApi(): ExpectedProgressionApi {
  const candidate =
    progressionModule as unknown as Partial<ExpectedProgressionApi>;
  expect(typeof candidate.summarizeLevelProgress).toBe("function");
  expect(typeof candidate.toCumulativeSourceExperience).toBe("function");
  expect(typeof candidate.fromCumulativeSourceExperience).toBe("function");
  return candidate as ExpectedProgressionApi;
}

describe("DiscordHero level progression", () => {
  test("loads the exact contiguous level 1 through 100 source table", () => {
    const curve = createLevelCurve(LEVELS);

    expect(curve.entries).toEqual(LEVELS);
    expect(curve.entries.map((entry) => entry.level)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(MAX_LEVEL).toBe(100);
  });

  test("rejects a zero threshold before it can grant a free level", () => {
    const zeroThresholdRows = LEVELS.map((entry, index) =>
      index === 0 ? { ...entry, experienceForLevelUp: 0 } : entry,
    );

    expect(() => createLevelCurve(zeroThresholdRows)).toThrow(
      "level 1 experience must be a positive safe integer",
    );
  });

  test("validates the complete curve before the level-100 early return", () => {
    const emptyCurve = { entries: [] } as unknown as LevelCurve;

    expect(() =>
      advanceLevels(emptyCurve, { level: 100, experience: 0 }),
    ).toThrow("level curve must contain exactly 100 rows");
  });

  test("validates the complete curve before the level-1 threshold return", () => {
    const emptyCurve = { entries: [] } as unknown as LevelCurve;

    expect(() => experienceToReachLevel(emptyCurve, 1)).toThrow(
      "level curve must contain exactly 100 rows",
    );
  });

  test("rejects an all-hole sparse array before creating a level curve", () => {
    const sparseEntries = new Array<LevelEntry>(MAX_LEVEL);

    expect(() => createLevelCurve(sparseEntries)).toThrow(
      "level curve row 0 is missing",
    );
  });

  test("rejects an all-hole sparse curve before the level-100 early return", () => {
    const sparseCurve = {
      entries: new Array<LevelEntry>(MAX_LEVEL),
    } as LevelCurve;

    expect(() =>
      advanceLevels(sparseCurve, { level: 100, experience: 0 }),
    ).toThrow("level curve row 0 is missing");
  });

  test("rejects an all-hole sparse curve before the level-1 threshold return", () => {
    const sparseCurve = {
      entries: new Array<LevelEntry>(MAX_LEVEL),
    } as LevelCurve;

    expect(() => experienceToReachLevel(sparseCurve, 1)).toThrow(
      "level curve row 0 is missing",
    );
  });

  test("rejects a deleted terminal row before level-100 behavior", () => {
    const missingTerminalRow = LEVELS.map((entry) => ({ ...entry }));
    delete missingTerminalRow[99];

    expect(() =>
      advanceLevels({ entries: missingTerminalRow } as LevelCurve, {
        level: 100,
        experience: 0,
      }),
    ).toThrow("level curve row 99 is missing");
  });

  test("rejects a sparse middle row by its exact index", () => {
    const missingMiddleRow = LEVELS.map((entry) => ({ ...entry }));
    delete missingMiddleRow[49];

    expect(() => createLevelCurve(missingMiddleRow)).toThrow(
      "level curve row 49 is missing",
    );
  });

  test("rejects an explicit undefined row without leaking a TypeError", () => {
    const undefinedRow = LEVELS.map((entry) => ({ ...entry })) as Array<
      LevelEntry | undefined
    >;
    undefinedRow[49] = undefined;

    expect(() =>
      createLevelCurve(undefinedRow as readonly LevelEntry[]),
    ).toThrow("level curve row 49 must be an object");
  });

  test("rejects a fully populated plain array-like level curve", () => {
    const plainEntries = {
      length: 100,
      ...Object.fromEntries(
        LEVELS.map((entry, index) => [index, { ...entry }]),
      ),
    };

    expect(() =>
      createLevelCurve(plainEntries as unknown as readonly LevelEntry[]),
    ).toThrow("level curve must contain exactly 100 rows");
  });

  test("rejects null with the canonical level-curve boundary error", () => {
    expect(() =>
      createLevelCurve(null as unknown as readonly LevelEntry[]),
    ).toThrow("level curve must contain exactly 100 rows");
  });

  test("rejects a primitive with the canonical level-curve boundary error", () => {
    expect(() =>
      createLevelCurve("x".repeat(100) as unknown as readonly LevelEntry[]),
    ).toThrow("level curve must contain exactly 100 rows");
  });

  test("matches every cumulative source threshold through level 100", () => {
    const curve = createLevelCurve(LEVELS);
    let sourceThreshold = 0;

    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      expect(experienceToReachLevel(curve, level)).toBe(sourceThreshold);
      if (level < MAX_LEVEL) {
        sourceThreshold += rawLevelRows[level - 1]!.ExpForLevelUp;
      }
    }

    expect(sourceThreshold).toBe(40_293_564_699);
    expect(
      advanceLevels(curve, { level: 1, experience: sourceThreshold }),
    ).toEqual({ level: 100, experience: 0 });
    expect(curve.entries[99]).toEqual({
      level: 100,
      experienceForLevelUp: 1_997_771_834,
    });
  });

  test("progresses past the legacy level-50 cap using exact source costs", () => {
    const curve = createLevelCurve(LEVELS);

    expect(
      advanceLevels(curve, {
        level: 49,
        experience: 63_533_406 + 81_322_760 + 7,
      }),
    ).toEqual({ level: 51, experience: 7 });
  });

  test("never creates a level above 100", () => {
    const curve = createLevelCurve(LEVELS);

    expect(
      advanceLevels(curve, {
        level: 99,
        experience: 1_958_599_837 + 5_000_000_000,
      }),
    ).toEqual({ level: 100, experience: 5_000_000_000 });
  });

  test("summarizes normalized current-row progress at the level-1 boundary", () => {
    const curve = createLevelCurve(LEVELS);
    const { summarizeLevelProgress } = progressionApi();

    expect(summarizeLevelProgress(curve, { level: 1, experience: 0 })).toEqual({
      status: "progressing",
      level: 1,
      experience: 0,
      nextLevel: 2,
      experienceForLevelUp: 30,
      experienceRemaining: 30,
      progressPercent: 0,
    });
    expect(summarizeLevelProgress(curve, { level: 1, experience: 29 })).toEqual(
      {
        status: "progressing",
        level: 1,
        experience: 29,
        nextLevel: 2,
        experienceForLevelUp: 30,
        experienceRemaining: 1,
        progressPercent: 97,
      },
    );
    expect(() =>
      summarizeLevelProgress(curve, { level: 1, experience: 30 }),
    ).toThrow("level 1 experience must be below 30");

    const advanced = advanceLevels(curve, { level: 1, experience: 30 });
    expect(advanced).toEqual({ level: 2, experience: 0 });
    expect(summarizeLevelProgress(curve, advanced)).toEqual({
      status: "progressing",
      level: 2,
      experience: 0,
      nextLevel: 3,
      experienceForLevelUp: 150,
      experienceRemaining: 150,
      progressPercent: 0,
    });
  });

  test("uses row 99 for the final transition and row 100 only for the terminal bar", () => {
    const curve = createLevelCurve(LEVELS);
    const { summarizeLevelProgress } = progressionApi();
    const threshold = 1_958_599_837;

    expect(
      summarizeLevelProgress(curve, {
        level: 99,
        experience: threshold - 1,
      }),
    ).toEqual({
      status: "progressing",
      level: 99,
      experience: 1_958_599_836,
      nextLevel: 100,
      experienceForLevelUp: threshold,
      experienceRemaining: 1,
      progressPercent: 100,
    });
    expect(advanceLevels(curve, { level: 99, experience: threshold })).toEqual({
      level: 100,
      experience: 0,
    });

    for (const [experience, expectedPercent] of [
      [0, 0],
      [1_997_771_833, 100],
      [1_997_771_834, 100],
      [1_997_771_835, 100],
    ] as const) {
      const summary = summarizeLevelProgress(curve, {
        level: 100,
        experience,
      });
      expect(summary).toEqual({
        status: "max-level",
        level: 100,
        experience,
        terminalBarExperience: 1_997_771_834,
        progressPercent: expectedPercent,
      });
      expect(summary).not.toHaveProperty("nextLevel");
      expect(summary).not.toHaveProperty("experienceRemaining");
    }
  });

  test("converts safely between normalized progress and cumulative source HeroExp", () => {
    const curve = createLevelCurve(LEVELS);
    const { fromCumulativeSourceExperience, toCumulativeSourceExperience } =
      progressionApi();

    expect(
      toCumulativeSourceExperience(curve, { level: 2, experience: 0 }),
    ).toBe(30);
    expect(fromCumulativeSourceExperience(curve, 30)).toEqual({
      level: 2,
      experience: 0,
    });
    expect(
      toCumulativeSourceExperience(curve, { level: 100, experience: 0 }),
    ).toBe(40_293_564_699);
    expect(fromCumulativeSourceExperience(curve, 40_293_564_699)).toEqual({
      level: 100,
      experience: 0,
    });
    expect(
      toCumulativeSourceExperience(curve, {
        level: 100,
        experience: 1_997_771_834,
      }),
    ).toBe(42_291_336_533);
    expect(() =>
      toCumulativeSourceExperience(curve, {
        level: 100,
        experience: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow("cumulative source experience produced an unsafe integer result");
  });

  test("covers all 99 source transitions and returns detached frozen values", () => {
    const curve = createLevelCurve(LEVELS);
    const {
      fromCumulativeSourceExperience,
      summarizeLevelProgress,
      toCumulativeSourceExperience,
    } = progressionApi();
    let cumulative = 0;

    for (let level = 1; level < 100; level += 1) {
      const threshold = rawLevelRows[level - 1]!.ExpForLevelUp;
      expect(
        fromCumulativeSourceExperience(curve, cumulative + threshold - 1),
      ).toEqual({ level, experience: threshold - 1 });
      cumulative += threshold;
      expect(fromCumulativeSourceExperience(curve, cumulative)).toEqual({
        level: level + 1,
        experience: 0,
      });
    }
    expect(cumulative).toBe(40_293_564_699);

    const progress = { level: 10, experience: 7 };
    const first = summarizeLevelProgress(curve, progress);
    const second = summarizeLevelProgress(curve, progress);
    const normalized = fromCumulativeSourceExperience(
      curve,
      toCumulativeSourceExperience(curve, progress),
    );
    expect(first).toEqual({
      status: "progressing",
      level: 10,
      experience: 7,
      nextLevel: 11,
      experienceForLevelUp: 74_880,
      experienceRemaining: 74_873,
      progressPercent: 0,
    });
    expect(first).not.toBe(second);
    expect(first).not.toBe(progress);
    expect(normalized).not.toBe(progress);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(progress).toEqual({ level: 10, experience: 7 });
  });

  test("fails closed on unsafe progress and malformed or missing curve rows", () => {
    const curve = createLevelCurve(LEVELS);
    const {
      fromCumulativeSourceExperience,
      summarizeLevelProgress,
      toCumulativeSourceExperience,
    } = progressionApi();
    const missingLastRow = {
      entries: curve.entries.slice(0, -1),
    } as LevelCurve;
    const forgedLevel = {
      entries: curve.entries.map((entry, index) =>
        index === 9 ? { ...entry, level: 11 } : entry,
      ),
    } as LevelCurve;

    expect(() =>
      summarizeLevelProgress(missingLastRow, { level: 1, experience: 0 }),
    ).toThrow("level curve must contain exactly 100 rows");
    expect(() =>
      summarizeLevelProgress(forgedLevel, { level: 10, experience: 0 }),
    ).toThrow("level curve row 9 has level 11; expected 10");
    expect(() =>
      summarizeLevelProgress(curve, {
        level: 1,
        experience: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow("player experience must be a non-negative safe integer");
    expect(() =>
      toCumulativeSourceExperience(curve, {
        level: 0,
        experience: 0,
      }),
    ).toThrow("player level must be between 1 and 100");
    expect(() =>
      fromCumulativeSourceExperience(curve, Number.MAX_SAFE_INTEGER + 1),
    ).toThrow(
      "cumulative source experience must be a non-negative safe integer",
    );
  });
});

describe("DiscordHero offline progression", () => {
  test("classifies exact zero without conflating it with ambiguous elapsed time", () => {
    const lastSeenAtMs = 1_000_000;

    expect(classifyOfflineElapsed(lastSeenAtMs, lastSeenAtMs)).toEqual({
      kind: "exact-zero",
    });
  });

  test("classifies rollback, partial seconds, and tamper windows distinctly", () => {
    const lastSeenAtMs = 1_000_000;
    const thirtyDaysMs = 30 * 24 * 60 * 60_000;

    const vectors = [
      { deltaMs: -1, expectedKind: "clock-regression" },
      { deltaMs: 1, expectedKind: "partial-second" },
      { deltaMs: 999, expectedKind: "partial-second" },
      { deltaMs: thirtyDaysMs - 1, expectedKind: "partial-second" },
      { deltaMs: thirtyDaysMs, expectedKind: "tamper-window" },
      { deltaMs: thirtyDaysMs + 1, expectedKind: "tamper-window" },
    ] as const;

    for (const { deltaMs, expectedKind } of vectors) {
      expect(
        classifyOfflineElapsed(lastSeenAtMs, lastSeenAtMs + deltaMs),
      ).toEqual({
        kind: expectedKind,
      });
    }
  });

  test("caps eligible whole-second elapsed time at eight hours", () => {
    const lastSeenAtMs = 1_000_000;
    const vectors = [
      {
        deltaMs: 1_000,
        elapsedSeconds: 1,
        capApplied: false,
      },
      {
        deltaMs: 28_799_000,
        elapsedSeconds: 28_799,
        capApplied: false,
      },
      {
        deltaMs: 28_800_000,
        elapsedSeconds: 28_800,
        capApplied: false,
      },
      {
        deltaMs: 28_801_000,
        elapsedSeconds: 28_800,
        capApplied: true,
      },
    ] as const;

    for (const { deltaMs, elapsedSeconds, capApplied } of vectors) {
      expect(
        classifyOfflineElapsed(lastSeenAtMs, lastSeenAtMs + deltaMs),
      ).toEqual({
        kind: "eligible",
        elapsedSeconds,
        capApplied,
      });
    }
  });

  test("reads exact stage reward rows without inventing a time-rate formula", () => {
    const rows = [
      {
        stageLevel: 1,
        baseGold: 1,
        baseExperience: 1,
        killCount: 180,
        clearCount: 20,
      },
      {
        stageLevel: 116,
        baseGold: 1_110,
        baseExperience: 21_898,
        killCount: 6_300,
        clearCount: 10,
      },
    ];

    expect(offlineRewardAtStage(rows, 1)).toEqual({
      stageLevel: 1,
      baseGold: 1,
      baseExperience: 1,
      killCount: 180,
      clearCount: 20,
    });
    expect(offlineRewardAtStage(rows, 116)).toEqual({
      stageLevel: 116,
      baseGold: 1_110,
      baseExperience: 21_898,
      killCount: 6_300,
      clearCount: 10,
    });
  });

  test("adds every owned offline rune level before applying its per-thousand bonus", () => {
    const rows = [
      ...[1, 2, 3].map((level) => ({
        levelKey: "110011",
        level,
        statType: "OfflineRewardGoldPercent",
        value: 100,
      })),
      ...[1, 2].map((level) => ({
        levelKey: "15002",
        level,
        statType: "OfflineRewardGoldPercent",
        value: 100,
      })),
      ...[1, 2].map((level) => ({
        levelKey: "110012",
        level,
        statType: "OfflineRewardExpPercent",
        value: 100,
      })),
    ];
    const bonuses = offlineRuneBonuses(rows, {
      "110011": 3,
      "15002": 2,
      "110012": 2,
    });

    expect(bonuses).toEqual({ gold: 0.5, experience: 0.2 });
    expect(applyOfflineRuneBoost(1_000, bonuses.gold)).toBe(1_500);
    expect(applyOfflineRuneBoost(1_000, bonuses.experience)).toBe(1_200);
  });

  test("rejects non-finite offline reward results", () => {
    expect(() => applyOfflineRuneBoost(Number.MAX_VALUE, 1)).toThrow(
      "offline reward produced a non-finite result",
    );
  });
});
