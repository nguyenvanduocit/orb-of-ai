import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { OracleRequiredError } from "./combat";
import {
  createOfflineRewardTable,
  inspectOfflineAccrual,
  resolveOfflineRewardAmounts,
  resolveOfflineRuneState,
} from "./offline";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const ownedRunes = Object.freeze([
  Object.freeze({ key: 11001, level: 1 }),
  Object.freeze({ key: 110011, level: 3 }),
  Object.freeze({ key: 110012, level: 2 }),
]);

describe("DiscordHero source offline progression", () => {
  test("preserves the exact contiguous 116-row reward table", () => {
    const table = createOfflineRewardTable(indexes);

    expect(table.rows).toHaveLength(116);
    expect(table.rows[0]).toEqual({
      StageLevel: 1,
      BaseGold: 1,
      BaseExp: 1,
      KillCount: 180,
      ClearCount: 20,
    });
    expect(table.rows.at(-1)).toEqual({
      StageLevel: 116,
      BaseGold: 1110,
      BaseExp: 21898,
      KillCount: 6300,
      ClearCount: 10,
    });
    expect(Object.isFrozen(table.rows)).toBe(true);
    expect(Object.isFrozen(table.rows[0])).toBe(true);
  });

  test("joins owned RuneKey to LevelDataKey and sums exact /1000 bonuses", () => {
    expect(resolveOfflineRuneState(indexes, ownedRunes)).toEqual({
      unlocked: true,
      goldBonusPerThousand: 300,
      experienceBonusPerThousand: 200,
    });
  });

  test("inspects capped canonical inputs without inventing reward-rate rounding", () => {
    const lastSeenAtMs = 1_000_000;

    expect(
      inspectOfflineAccrual({
        indexes,
        rewardStageLevel: 95,
        lastSeenAtMs,
        nowMs: lastSeenAtMs + 9 * 60 * 60_000,
        ownedRunes,
      }),
    ).toEqual({
      elapsed: {
        kind: "eligible",
        elapsedSeconds: 28_800,
        capApplied: true,
      },
      rewardRow: {
        StageLevel: 95,
        BaseGold: 1110,
        BaseExp: 21898,
        KillCount: 6300,
        ClearCount: 10,
      },
      runeState: {
        unlocked: true,
        goldBonusPerThousand: 300,
        experienceBonusPerThousand: 200,
      },
    });
    expect(
      inspectOfflineAccrual({
        indexes,
        rewardStageLevel: 95,
        lastSeenAtMs,
        nowMs: lastSeenAtMs + 30 * 24 * 60 * 60_000,
        ownedRunes,
      }).elapsed,
    ).toEqual({ kind: "tamper-window" });
  });

  test("returns exact zero for no elapsed time without consuming RNG", () => {
    let rngCalls = 0;
    const amounts = resolveOfflineRewardAmounts({
      indexes,
      rewardStageLevel: 1,
      lastSeenAtMs: 1_000,
      nowMs: 1_000,
      ownedRunes: [{ key: 11001, level: 1 }],
      rng: () => {
        rngCalls += 1;
        return 0;
      },
    });

    expect(amounts).toEqual({ gold: 0, experience: 0 });
    expect(rngCalls).toBe(0);
  });

  test("requires an oracle for every ambiguous zero without consuming RNG", () => {
    const lastSeenAtMs = 3_000_000_000;
    const thirtyDaysMs = 30 * 24 * 60 * 60_000;
    const ambiguousDeltasMs = [
      -1,
      1,
      999,
      thirtyDaysMs - 1,
      thirtyDaysMs,
      thirtyDaysMs + 1,
    ] as const;

    for (const deltaMs of ambiguousDeltasMs) {
      let rngCalls = 0;

      expect(() =>
        resolveOfflineRewardAmounts({
          indexes,
          rewardStageLevel: 1,
          lastSeenAtMs,
          nowMs: lastSeenAtMs + deltaMs,
          ownedRunes: [{ key: 11001, level: 1 }],
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(rngCalls).toBe(0);
    }
  });

  test("requires an oracle for eligible whole-second settlement without consuming RNG", () => {
    const lastSeenAtMs = 3_000_000_000;
    const eligibleDeltasMs = [
      1_000, 28_799_000, 28_800_000, 28_801_000,
    ] as const;

    for (const deltaMs of eligibleDeltasMs) {
      let rngCalls = 0;

      expect(() =>
        resolveOfflineRewardAmounts({
          indexes,
          rewardStageLevel: 1,
          lastSeenAtMs,
          nowMs: lastSeenAtMs + deltaMs,
          ownedRunes: [{ key: 11001, level: 1 }],
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(() =>
        resolveOfflineRewardAmounts({
          indexes,
          rewardStageLevel: 1,
          lastSeenAtMs,
          nowMs: lastSeenAtMs + deltaMs,
          ownedRunes: [{ key: 11001, level: 1 }],
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ).toThrow(
        "offline reward rate, rounding, and drop batching require a runtime oracle",
      );
      expect(rngCalls).toBe(0);
    }
  });

  test("rejects an owned rune level above its canonical source maximum", () => {
    expect(() =>
      resolveOfflineRuneState(indexes, [{ key: 110011, level: 4 }]),
    ).toThrow("owned rune 110011 level 4 exceeds source max 3");
  });

  test("rejects forged reward rows and rune bonuses at the stable-key boundary", () => {
    expect(() =>
      inspectOfflineAccrual({
        indexes,
        rewardStageLevel: 1,
        lastSeenAtMs: 1_000,
        nowMs: 2_000,
        ownedRunes: [{ key: 11001, level: 1 }],
        BaseGold: 999_999_999,
      }),
    ).toThrow("offline accrual input has unknown field BaseGold");
    expect(() =>
      inspectOfflineAccrual({
        indexes,
        rewardStageLevel: 1,
        lastSeenAtMs: 1_000,
        nowMs: 2_000,
        ownedRunes: [{ key: 11001, level: 1 }],
        runeState: {
          unlocked: true,
          goldBonusPerThousand: 900_000,
          experienceBonusPerThousand: 900_000,
        },
      }),
    ).toThrow("offline accrual input has unknown field runeState");
  });

  test("returns fresh deeply frozen output with no input or catalog aliases", () => {
    const owned = [{ key: 11001, level: 1 }];
    const inspection = inspectOfflineAccrual({
      indexes,
      rewardStageLevel: 1,
      lastSeenAtMs: 1_000,
      nowMs: 2_000,
      ownedRunes: owned,
    });

    expect(inspection.rewardRow).not.toBe(
      indexes.tables.offline_rewards.rows[0],
    );
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.rewardRow)).toBe(true);
    expect(Object.isFrozen(inspection.runeState)).toBe(true);
    expect(owned).toEqual([{ key: 11001, level: 1 }]);
    expect(() => {
      (inspection.rewardRow as { BaseGold: number }).BaseGold = 999_999_999;
    }).toThrow(TypeError);
  });
});
