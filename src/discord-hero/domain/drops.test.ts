import { describe, expect, test } from "bun:test";
import rawDropRows from "../../../preferences/taskbarhero/raw-data/current/datasets/drops.json";
import rawItemGroupRows from "../../../preferences/taskbarhero/raw-data/current/datasets/item_groups.json";
import { OracleRequiredError } from "./items";
import {
  preflightWeightedDrop,
  rewardItemCandidates,
  selectPreflightedWeightedDrop,
  selectWeightedDrop,
  type SourceDropRow,
  type SourceItemGroupRow,
} from "./drops";

const DROPS = rawDropRows as readonly SourceDropRow[];
const ITEM_GROUPS = rawItemGroupRows as readonly SourceItemGroupRow[];

describe("DiscordHero source drop semantics", () => {
  test("preflights every deterministic table constraint without consuming RNG", () => {
    const row = {
      DropKey: 1,
      DropType: "EachDropOneWeight",
      REWARDTYPE: "ITEM",
      RewardKey: 10,
      HeroKeyCondition: null,
      Weight: 1,
    } satisfies SourceDropRow;

    expect(() =>
      preflightWeightedDrop([row, { ...row, RewardKey: 20, Weight: 3 }]),
    ).not.toThrow();
    expect(() => preflightWeightedDrop([row, { ...row, DropKey: 2 }])).toThrow(
      "one DropKey",
    );
    expect(() =>
      preflightWeightedDrop([{ ...row, Weight: Number.MAX_SAFE_INTEGER }, row]),
    ).toThrow("total weight exceeds safe integer range");

    const prepared = preflightWeightedDrop([
      row,
      { ...row, RewardKey: 20, Weight: 3 },
    ]);
    expect(selectPreflightedWeightedDrop(prepared, () => 0.25).RewardKey).toBe(
      20,
    );
  });

  test("preserves the exact corpus distribution instead of normalizing unlike table types", () => {
    const tables = new Map<number, SourceDropRow[]>();
    for (const row of DROPS) {
      const rows = tables.get(row.DropKey) ?? [];
      rows.push(row);
      tables.set(row.DropKey, rows);
    }

    const semantics = [...tables.values()].map((rows) => {
      if (
        rows.every(
          (row) =>
            row.DropType === "EachDropOneWeight" &&
            row.HeroKeyCondition === null,
        )
      ) {
        return "executable";
      }
      return rows[0]!.DropType;
    });

    expect(DROPS).toHaveLength(6_303);
    expect(tables.size).toBe(245);
    expect(semantics.filter((value) => value === "executable")).toHaveLength(
      157,
    );
    expect(
      semantics.filter((value) => value === "EachDropOneWeight_DLCVariant"),
    ).toHaveLength(87);
    expect(
      semantics.filter((value) => value === "SelectOneByClass"),
    ).toHaveLength(1);
  });

  test("uses exact safe-integer weights and half-open RNG boundaries", () => {
    const rows: SourceDropRow[] = [
      {
        DropKey: 1,
        DropType: "EachDropOneWeight",
        REWARDTYPE: "ITEM",
        RewardKey: 10,
        HeroKeyCondition: null,
        Weight: 1,
      },
      {
        DropKey: 1,
        DropType: "EachDropOneWeight",
        REWARDTYPE: "ITEM",
        RewardKey: 20,
        HeroKeyCondition: null,
        Weight: 3,
      },
    ];

    expect(selectWeightedDrop(rows, () => 0).RewardKey).toBe(10);
    expect(selectWeightedDrop(rows, () => 0.249999).RewardKey).toBe(10);
    expect(selectWeightedDrop(rows, () => 0.25).RewardKey).toBe(20);
    expect(selectWeightedDrop(rows, () => 0.999999).RewardKey).toBe(20);
  });

  test("oracle-gates DLC, hero-conditional, class-based, and mixed-key tables before RNG", () => {
    let calls = 0;
    const rng = (): number => {
      calls += 1;
      return 0;
    };
    const safe = {
      DropKey: 1,
      DropType: "EachDropOneWeight",
      REWARDTYPE: "ITEM",
      RewardKey: 10,
      HeroKeyCondition: null,
      Weight: 1,
    } satisfies SourceDropRow;

    for (const rows of [
      [{ ...safe, DropType: "EachDropOneWeight_DLCVariant" }],
      [{ ...safe, HeroKeyCondition: 501 }],
      [{ ...safe, DropType: "SelectOneByClass" }],
    ]) {
      expect(() => selectWeightedDrop(rows, rng)).toThrow(OracleRequiredError);
    }
    expect(() =>
      selectWeightedDrop([safe, { ...safe, DropKey: 2 }], rng),
    ).toThrow("one DropKey");
    expect(calls).toBe(0);
  });

  test("rejects invalid weights and RNG values", () => {
    const row = {
      DropKey: 1,
      DropType: "EachDropOneWeight",
      REWARDTYPE: "ITEM",
      RewardKey: 10,
      HeroKeyCondition: null,
      Weight: 1,
    } satisfies SourceDropRow;

    expect(() => selectWeightedDrop([{ ...row, Weight: -1 }], () => 0)).toThrow(
      "non-negative safe integer",
    );
    expect(() => selectWeightedDrop([{ ...row, Weight: 0 }], () => 0)).toThrow(
      "positive weight",
    );
    expect(() => selectWeightedDrop([row], () => 1)).toThrow("[0, 1)");
  });
});

describe("DiscordHero item-group resolution", () => {
  test("resolves direct items and preserves exact source order for groups", () => {
    expect(
      rewardItemCandidates(
        {
          DropKey: 1,
          DropType: "EachDropOneWeight",
          REWARDTYPE: "ITEM",
          RewardKey: 300001,
          HeroKeyCondition: null,
          Weight: 1,
        },
        ITEM_GROUPS,
      ),
    ).toEqual([300001]);

    const group = ITEM_GROUPS.find((row) => row.ItemGroupKey === 1110010)!;
    expect(
      rewardItemCandidates(
        {
          DropKey: 1,
          DropType: "EachDropOneWeight",
          REWARDTYPE: "ITEMGROUP",
          RewardKey: group.ItemGroupKey,
          HeroKeyCondition: null,
          Weight: 1,
        },
        ITEM_GROUPS,
      ),
    ).toEqual(
      ITEM_GROUPS.filter((row) => row.ItemGroupKey === group.ItemGroupKey).map(
        (row) => row.ItemKey,
      ),
    );
  });

  test("fails on missing item groups and unknown reward semantics", () => {
    const base = {
      DropKey: 1,
      DropType: "EachDropOneWeight",
      HeroKeyCondition: null,
      Weight: 1,
    } as const;

    expect(() =>
      rewardItemCandidates(
        { ...base, REWARDTYPE: "ITEMGROUP", RewardKey: 999_999_999 },
        ITEM_GROUPS,
      ),
    ).toThrow("missing item group");
    expect(() =>
      rewardItemCandidates(
        { ...base, REWARDTYPE: "GOLD", RewardKey: 1 },
        ITEM_GROUPS,
      ),
    ).toThrow(OracleRequiredError);
  });
});
