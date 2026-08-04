import { describe, expect, test } from "bun:test";
import rawCubeLevelRowsJson from "../../../preferences/taskbarhero/raw-data/current/datasets/cube_levels.json";
import {
  MAX_CUBE_LEVEL,
  alchemyGoldForItem,
  advanceCubeLevel,
  cubeExperienceToReachLevel,
  cubeExpForItem,
  cubeOperationState,
  createCubeLevelCurve,
  rollSynthesisGrade,
  selectCraftingDrop,
  synthesisResultLevel,
  type CubeLevelEntry,
  type CubeOperationRequirement,
  type SynthesisGradeRule,
} from "./cube";

interface RawCubeLevelRow {
  Level: number;
  ExpForLevelUp: number;
}

const rawCubeLevelRows: readonly RawCubeLevelRow[] = rawCubeLevelRowsJson;
const CUBE_LEVELS: CubeLevelEntry[] = rawCubeLevelRows.map((row) => ({
  level: row.Level,
  experienceForLevelUp: row.ExpForLevelUp,
}));

const OPERATIONS: Record<string, CubeOperationRequirement> = {
  SYNTHESIS: {
    recipeType: "SYNTHESIS",
    unlockCubeLevel: 1,
    unlockCost: 0,
    defaultUnlocked: true,
  },
  ALCHEMY: {
    recipeType: "ALCHEMY",
    unlockCubeLevel: 1,
    unlockCost: 10,
    defaultUnlocked: false,
  },
  CRAFTING: {
    recipeType: "CRAFTING",
    unlockCubeLevel: 5,
    unlockCost: 100,
    defaultUnlocked: false,
  },
};

const GRADES: SynthesisGradeRule[] = [
  {
    grade: "COMMON",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 0,
    higher1Weight: 100_000,
    higher2Weight: 5_000,
  },
  {
    grade: "UNCOMMON",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 0,
    higher1Weight: 100_000,
    higher2Weight: 4_000,
  },
  {
    grade: "RARE",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 0,
    higher1Weight: 100_000,
    higher2Weight: 2_500,
  },
  {
    grade: "LEGENDARY",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 0,
    higher1Weight: 100_000,
    higher2Weight: 1_000,
  },
  {
    grade: "IMMORTAL",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 100_000,
    higher1Weight: 100_000,
    higher2Weight: 500,
  },
  {
    grade: "ARCANA",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 100_000,
    higher1Weight: 50_000,
    higher2Weight: 250,
  },
  {
    grade: "BEYOND",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 100_000,
    higher1Weight: 30_000,
    higher2Weight: 100,
  },
  {
    grade: "CELESTIAL",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 100_000,
    higher1Weight: 20_000,
    higher2Weight: 20,
  },
  {
    grade: "DIVINE",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 100_000,
    higher1Weight: 10_000,
    higher2Weight: 0,
  },
  {
    grade: "COSMIC",
    lower2Weight: 0,
    lower1Weight: 0,
    sameWeight: 0,
    higher1Weight: 0,
    higher2Weight: 0,
  },
];

describe("DiscordHero Cube levels and factors", () => {
  test("uses the exact per-level EXP costs and reaches Cube level 5 at total EXP 405", () => {
    const curve = createCubeLevelCurve(CUBE_LEVELS);

    expect(curve.entries).toEqual(CUBE_LEVELS);
    expect(advanceCubeLevel(curve, 0)).toEqual({ level: 1, experience: 0 });
    expect(advanceCubeLevel(curve, 404)).toEqual({ level: 4, experience: 249 });
    expect(advanceCubeLevel(curve, 405)).toEqual({ level: 5, experience: 0 });
  });

  test("matches every cumulative source threshold through Cube level 100", () => {
    const curve = createCubeLevelCurve(CUBE_LEVELS);
    let sourceThreshold = 0;

    for (let level = 1; level <= MAX_CUBE_LEVEL; level += 1) {
      expect(cubeExperienceToReachLevel(curve, level)).toBe(sourceThreshold);
      if (level < MAX_CUBE_LEVEL) {
        sourceThreshold += rawCubeLevelRows[level - 1]!.ExpForLevelUp;
      }
    }

    expect(sourceThreshold).toBe(234_760_055);
    expect(advanceCubeLevel(curve, sourceThreshold)).toEqual({
      level: 100,
      experience: 0,
    });
    expect(curve.entries[99]).toEqual({
      level: 100,
      experienceForLevelUp: 999_999_999,
    });
  });

  test("multiplies source per-thousand factors, level match, and additive Cube EXP bonus with floor", () => {
    expect(
      cubeExpForItem({
        gradeBase: 18,
        itemLevelScale: 40_000,
        gearTypeScale: 2_000,
        itemTypeScale: 1_000,
        levelMatch: 0.8,
        cubeExpBonus: 100,
      }),
    ).toBe(1_267);
  });

  test("calculates alchemy gold from source factors without applying level match", () => {
    expect(
      alchemyGoldForItem({
        gradeBase: 90,
        itemLevelScale: 25_000,
        gearTypeScale: 2_000,
        itemTypeScale: 1_000,
        alchemyGoldBonus: 100,
      }),
    ).toBe(4_950);
  });

  test("rejects unsafe or non-finite Cube formula results", () => {
    expect(() =>
      cubeExpForItem({
        gradeBase: Number.MAX_SAFE_INTEGER,
        itemLevelScale: Number.MAX_SAFE_INTEGER,
        gearTypeScale: Number.MAX_SAFE_INTEGER,
        itemTypeScale: Number.MAX_SAFE_INTEGER,
        levelMatch: 1,
        cubeExpBonus: 0,
      }),
    ).toThrow("Cube EXP base produced an unsafe integer result");
    expect(() =>
      alchemyGoldForItem({
        gradeBase: Number.MAX_SAFE_INTEGER,
        itemLevelScale: 1_000,
        gearTypeScale: 1_000,
        itemTypeScale: 1_000,
        alchemyGoldBonus: Number.MAX_VALUE,
      }),
    ).toThrow("Alchemy gold produced a non-finite result");
  });
});

describe("DiscordHero Cube operation gates", () => {
  test("distinguishes source default, level eligibility, purchase cost, and owned unlock", () => {
    expect(cubeOperationState(OPERATIONS.SYNTHESIS!, 1, false)).toEqual({
      accessible: true,
      eligibleToUnlock: false,
      unlockCost: 0,
    });
    expect(cubeOperationState(OPERATIONS.CRAFTING!, 4, false)).toEqual({
      accessible: false,
      eligibleToUnlock: false,
      unlockCost: 100,
    });
    expect(cubeOperationState(OPERATIONS.CRAFTING!, 5, false)).toEqual({
      accessible: false,
      eligibleToUnlock: true,
      unlockCost: 100,
    });
    expect(cubeOperationState(OPERATIONS.CRAFTING!, 5, true)).toEqual({
      accessible: true,
      eligibleToUnlock: false,
      unlockCost: 100,
    });
  });
});

describe("DiscordHero documented weighted selections", () => {
  test("selects synthesis grades from exact catalog weights with injected RNG", () => {
    expect(rollSynthesisGrade(GRADES, "COMMON", () => 0)).toBe("UNCOMMON");
    expect(rollSynthesisGrade(GRADES, "COMMON", () => 0.96)).toBe("RARE");
    expect(rollSynthesisGrade(GRADES, "IMMORTAL", () => 0.1)).toBe("IMMORTAL");
    expect(rollSynthesisGrade(GRADES, "IMMORTAL", () => 0.6)).toBe("ARCANA");
    expect(rollSynthesisGrade(GRADES, "IMMORTAL", () => 0.999)).toBe("BEYOND");
    expect(() => rollSynthesisGrade(GRADES, "COSMIC", () => 0)).toThrow(
      "grade COSMIC cannot be synthesized",
    );
  });

  test("selects only fully determined unconditional crafting drop tables", () => {
    const rows = [
      {
        dropKey: "3601003",
        dropType: "EachDropOneWeight",
        rewardType: "ITEMGROUP",
        rewardKey: "1104010",
        heroKeyCondition: "",
        weight: 50_000,
      },
      {
        dropKey: "3601003",
        dropType: "EachDropOneWeight",
        rewardType: "ITEMGROUP",
        rewardKey: "1204010",
        heroKeyCondition: "",
        weight: 40_000,
      },
      {
        dropKey: "3601003",
        dropType: "EachDropOneWeight",
        rewardType: "ITEMGROUP",
        rewardKey: "1304010",
        heroKeyCondition: "",
        weight: 8_000,
      },
      {
        dropKey: "3601003",
        dropType: "EachDropOneWeight",
        rewardType: "ITEMGROUP",
        rewardKey: "1404010",
        heroKeyCondition: "",
        weight: 2_000,
      },
    ];

    expect(selectCraftingDrop(rows, "3601003", () => 0.499999).rewardKey).toBe(
      "1104010",
    );
    expect(selectCraftingDrop(rows, "3601003", () => 0.5).rewardKey).toBe(
      "1204010",
    );
  });

  test("rejects a weighted-selection total above the safe-integer range", () => {
    const unsafe = GRADES.map((rule) => ({ ...rule }));
    unsafe[4] = {
      ...unsafe[4]!,
      sameWeight: Number.MAX_SAFE_INTEGER,
      higher1Weight: Number.MAX_SAFE_INTEGER,
      higher2Weight: 0,
    };

    expect(() => rollSynthesisGrade(unsafe, "IMMORTAL", () => 0)).toThrow(
      "synthesis grade IMMORTAL total weight exceeds the safe-integer range",
    );
  });

  test("throws instead of guessing DLC/hero-conditional drop semantics", () => {
    expect(() =>
      selectCraftingDrop(
        [
          {
            dropKey: "3601001",
            dropType: "EachDropOneWeight_DLCVariant",
            rewardType: "ITEMGROUP",
            rewardKey: "1100010",
            heroKeyCondition: "501",
            weight: 50_000,
          },
        ],
        "3601001",
        () => 0,
      ),
    ).toThrow("Unsupported crafting drop 3601001 semantics");
  });

  test("returns deterministic synthesis levels only and rejects undocumented weighted level buckets", () => {
    expect(synthesisResultLevel({ min: 1, max: 1, weights: [100, 0, 0, 0] })).toBe(
      1,
    );
    expect(() =>
      synthesisResultLevel({ min: 1, max: 10, weights: [50, 200, 50, 0] }),
    ).toThrow("Unsupported synthesis result-level semantics for range 1-10");
  });
});
