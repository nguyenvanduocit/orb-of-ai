import { describe, expect, test } from "bun:test";
import rawGearRows from "../../../preferences/taskbarhero/raw-data/current/datasets/gear.json";
import rawItemRows from "../../../preferences/taskbarhero/raw-data/current/datasets/items.json";
import rawStatModRows from "../../../preferences/taskbarhero/raw-data/current/datasets/stat_mods.json";
import cubeLevelMatchOracle from "../../../preferences/taskbarhero/oracles/cube-level-match-v1.json";
import type { GearAsset, SlotContainer } from "./player";
import {
  OracleRequiredError,
  createCanonicalStoredAsset,
  createItemIndex,
  creditInventory,
  cubeLevelMatch,
  debitInventory,
  rollSourceInterval,
  sourceAlchemyGold,
  sourceIntervalCandidates,
  type SourceGearRow,
  type SourceItemRow,
  type SourceStatModRow,
} from "./items";

const ITEMS = rawItemRows as readonly SourceItemRow[];
const GEAR = rawGearRows as readonly SourceGearRow[];
const STAT_MODS = rawStatModRows as readonly SourceStatModRow[];

function inventory(): SlotContainer {
  return {
    unlockedSlots: 5,
    slots: [
      {
        index: 0,
        asset: { kind: "stack", itemKey: 140001, quantity: 5 },
      },
      {
        index: 1,
        asset: {
          kind: "gear",
          instanceId: "gear-source-1",
          itemKey: 300001,
          rolledStats: [],
        },
      },
      {
        index: 2,
        asset: { kind: "stack", itemKey: 140001, quantity: 2 },
      },
    ],
  };
}

describe("DiscordHero source item definitions", () => {
  test("joins every one of the 5,760 gear items to its exact source gear row", () => {
    const index = createItemIndex(ITEMS, GEAR);

    expect(index.size).toBe(5_944);
    expect(
      [...index.values()].filter((item) => item.item.type === "GEAR"),
    ).toHaveLength(5_760);
    expect(index.get(300001)).toEqual({
      item: ITEMS.find((item) => item.id === 300001)!,
      gear: GEAR.find((gear) => gear.GearKey === 300001)!,
    });
    expect(index.get(110001)?.gear).toBeNull();
  });

  test("rejects duplicate item keys, orphan gear rows, and missing gear definitions", () => {
    expect(() => createItemIndex([ITEMS[0]!, ITEMS[0]!], [])).toThrow(
      "duplicate item key",
    );
    expect(() =>
      createItemIndex(
        [{ id: 1, grade: "COMMON", type: "MATERIAL", gear: null, level: null }],
        [{ GearKey: 2 }],
      ),
    ).toThrow("orphan gear row");
    expect(() =>
      createItemIndex(
        [{ id: 1, grade: "COMMON", type: "GEAR", gear: "SWORD", level: 1 }],
        [],
      ),
    ).toThrow("missing gear row");
  });
});

describe("DiscordHero live Cube value rules", () => {
  test("constructs canonical gear and stack assets from source definitions", () => {
    const source = { items: rawItemRows, gear: rawGearRows };

    expect(
      createCanonicalStoredAsset({
        itemKey: 501011,
        gearInstanceId: "server-issued-id",
        source,
      }),
    ).toEqual({
      kind: "gear",
      instanceId: "server-issued-id",
      itemKey: 501011,
      rolledStats: [],
    });
    expect(createCanonicalStoredAsset({ itemKey: 140001, source })).toEqual({
      kind: "stack",
      itemKey: 140001,
      quantity: 1,
    });
    expect(() =>
      createCanonicalStoredAsset({
        itemKey: 140001,
        gearInstanceId: "forged-stack-id",
        source,
      }),
    ).toThrow("does not accept a gear instance ID");
    for (const gearInstanceId of [
      ["array-spoof"],
      { length: 1 },
      "unsafe\nid",
      "x".repeat(129),
    ]) {
      expect(() =>
        createCanonicalStoredAsset({
          itemKey: 501011,
          gearInstanceId: gearInstanceId as unknown as string,
          source,
        }),
      ).toThrow("canonical stable instance ID");
    }
  });

  test("reproduces the current live level-match golden table at Cube level 20", () => {
    for (const vector of cubeLevelMatchOracle.vectors) {
      expect(cubeLevelMatch(vector.cubeLevel, vector.itemLevel)).toBeCloseTo(
        vector.match,
        14,
      );
    }
  });

  test("uses the live item-detail round rule for Alchemy counterexamples", () => {
    expect(
      sourceAlchemyGold({
        itemKey: 505041,
        source: {
          items: rawItemRows,
          gear: rawGearRows,
          grades: [
            {
              GRADE: "ARCANA",
              BaseAlchemyGold: 2_592,
              BaseCubeExp: 518,
            },
          ],
          itemLevelScales: [
            { Level: 15, AlchemyGoldScale: 88_000, CubeExpScale: 120_000 },
          ],
          gearTypeScales: [
            {
              GearType: "HELMET",
              AlchemyGoldScale: 800,
              CubeExpScale: 800,
            },
          ],
          itemTypeScales: [
            {
              ItemType: "GEAR",
              AlchemyGoldScale: 1_000,
              CubeExpScale: 1_000,
            },
          ],
        },
        alchemyGoldBonus: 0,
      }),
    ).toBe(182_477);
  });

  test("rejects malformed source value factors before exact integer arithmetic", () => {
    expect(() =>
      sourceAlchemyGold({
        itemKey: 505041,
        source: {
          items: rawItemRows,
          gear: rawGearRows,
          grades: [
            {
              GRADE: "ARCANA",
              BaseAlchemyGold: 2_592.5,
              BaseCubeExp: 518,
            },
          ],
          itemLevelScales: [
            { Level: 15, AlchemyGoldScale: 88_000, CubeExpScale: 120_000 },
          ],
          gearTypeScales: [
            {
              GearType: "HELMET",
              AlchemyGoldScale: 800,
              CubeExpScale: 800,
            },
          ],
          itemTypeScales: [
            {
              ItemType: "GEAR",
              AlchemyGoldScale: 1_000,
              CubeExpScale: 1_000,
            },
          ],
        },
        alchemyGoldBonus: 0,
      }),
    ).toThrow("non-negative safe integer");
  });
});

describe("DiscordHero source stat intervals", () => {
  test("enumerates raw integer source values inclusively before applying the divisor", () => {
    const row = STAT_MODS.find(
      (candidate) =>
        candidate.MinValue === 10 &&
        candidate.MaxValue === 19 &&
        candidate.Interval === 10,
    );
    expect(row).toBeDefined();
    expect(sourceIntervalCandidates(row!)).toEqual([
      1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
    ]);
  });

  test("fails closed before RNG because source roll seed and endpoint semantics are unresolved", () => {
    let calls = 0;
    const row = STAT_MODS[0]!;

    expect(() =>
      rollSourceInterval(row, () => {
        calls += 1;
        return 0;
      }),
    ).toThrow(OracleRequiredError);
    expect(calls).toBe(0);
  });

  test("rejects malformed source intervals", () => {
    expect(() =>
      sourceIntervalCandidates({
        StatModKey: 1,
        Tier: 1,
        STATTYPE: "AttackDamage",
        MODTYPE: "FLAT",
        MinValue: 2,
        MaxValue: 1,
        Interval: 1,
      }),
    ).toThrow("maximum");
    expect(() =>
      sourceIntervalCandidates({
        StatModKey: 1,
        Tier: 1,
        STATTYPE: "AttackDamage",
        MODTYPE: "FLAT",
        MinValue: 1,
        MaxValue: 2,
        Interval: 0,
      }),
    ).toThrow("interval");
  });
});

describe("DiscordHero pure inventory transitions", () => {
  test("debits stack quantities across slots and gear by stable supplied instance ID", () => {
    const before = inventory();
    const snapshot = structuredClone(before);

    const after = debitInventory(before, [
      { kind: "stack", itemKey: 140001, quantity: 6 },
      { kind: "gear", instanceId: "gear-source-1" },
    ]);

    expect(before).toEqual(snapshot);
    expect(after).toEqual({
      unlockedSlots: 5,
      slots: [
        {
          index: 2,
          asset: { kind: "stack", itemKey: 140001, quantity: 1 },
        },
      ],
    });
  });

  test("returns a defensive inventory copy with no aliases in either direction", () => {
    const before = inventory();
    const after = debitInventory(before, []);

    expect(after).toEqual(before);
    expect(after).not.toBe(before);
    expect(after.slots).not.toBe(before.slots);
    expect(after.slots[0]).not.toBe(before.slots[0]);
    expect(after.slots[0]!.asset).not.toBe(before.slots[0]!.asset);
    expect(after.slots[1]!.asset).not.toBe(before.slots[1]!.asset);
    if (
      before.slots[0]!.asset.kind !== "stack" ||
      after.slots[0]!.asset.kind !== "stack" ||
      before.slots[1]!.asset.kind !== "gear" ||
      after.slots[1]!.asset.kind !== "gear"
    ) {
      throw new Error("test fixture must contain a stack and gear");
    }
    expect(after.slots[1]!.asset.rolledStats).not.toBe(
      before.slots[1]!.asset.rolledStats,
    );
    before.slots[0]!.asset.quantity = 99;
    expect(after.slots[0]!.asset.quantity).toBe(5);
    after.slots[0]!.asset.quantity = 3;
    expect(before.slots[0]!.asset.quantity).toBe(99);
    before.slots[1]!.asset.rolledStats.push({
      statModKey: 100101,
      value: 1,
    });
    expect(after.slots[1]!.asset.rolledStats).toEqual([]);
    after.slots[1]!.asset.rolledStats.push({
      statModKey: 100102,
      value: 2,
    });
    expect(before.slots[1]!.asset.rolledStats).toEqual([
      { statModKey: 100101, value: 1 },
    ]);
  });

  test("rolls back by purity when a debit cannot be satisfied", () => {
    const before = inventory();
    const snapshot = structuredClone(before);

    expect(() =>
      debitInventory(before, [
        { kind: "stack", itemKey: 140001, quantity: 8 },
        { kind: "gear", instanceId: "gear-source-1" },
      ]),
    ).toThrow("insufficient stack item 140001");
    expect(before).toEqual(snapshot);
  });

  test("credits only explicit free slots with defensive asset copies", () => {
    const before = inventory();
    const output: GearAsset = {
      kind: "gear" as const,
      instanceId: "craft-request-42",
      itemKey: 501011,
      rolledStats: [],
    };

    const after = creditInventory(before, [{ index: 4, asset: output }]);

    expect(after.slots.at(-1)).toEqual({ index: 4, asset: output });
    expect(after.slots.at(-1)?.asset).not.toBe(output);
    expect(after.slots[0]).not.toBe(before.slots[0]);
    expect(after.slots[0]!.asset).not.toBe(before.slots[0]!.asset);
    output.rolledStats.push({ statModKey: 100101, value: 1 });
    expect(after.slots.at(-1)?.asset).toEqual({
      kind: "gear",
      instanceId: "craft-request-42",
      itemKey: 501011,
      rolledStats: [],
    });
    expect(() =>
      creditInventory(before, [{ index: 0, asset: output }]),
    ).toThrow("occupied");
    expect(() =>
      creditInventory(before, [
        {
          index: 4,
          asset: {
            ...output,
            instanceId: "gear-source-1",
          },
        },
      ]),
    ).toThrow("duplicate gear instance");
  });

  test("rejects malformed assets, spoofed IDs, and unsafe quantity/capacity", () => {
    const before = inventory();
    const credit = (asset: unknown): void => {
      creditInventory(before, [
        {
          index: 4,
          asset: asset as Parameters<
            typeof creditInventory
          >[1][number]["asset"],
        },
      ]);
    };

    expect(() =>
      credit({
        kind: "stack",
        itemKey: 140001,
        quantity: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow();
    expect(() =>
      credit({
        kind: "stack",
        itemKey: 140001,
        quantity: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow("aggregate quantity produced an unsafe integer");
    expect(() =>
      credit({
        kind: "gear",
        instanceId: ["array-spoof"],
        itemKey: 501011,
        rolledStats: [],
      }),
    ).toThrow();
    expect(() =>
      credit({
        kind: "gear",
        instanceId: "unsafe\nid",
        itemKey: 501011,
        rolledStats: [],
      }),
    ).toThrow();
    expect(() =>
      creditInventory(
        {
          unlockedSlots: Number.MAX_SAFE_INTEGER + 1,
          slots: [],
        },
        [],
      ),
    ).toThrow();
  });
});
