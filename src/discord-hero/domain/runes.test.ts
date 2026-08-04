import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "./invariants";
import type { PlayerState } from "./player";
import { resolveRuneLevelRows } from "./rune-levels";
import { quoteRuneUpgrade, upgradeRune } from "./runes";

let indexes: DiscordHeroCatalogIndexes;
let fresh: PlayerState;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  fresh = createFreshPlayerStateFromCatalog(indexes);
});

function withRuneLevelStatType(
  runeKey: number,
  statType: string,
): DiscordHeroCatalogIndexes {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  const groups = new Map(table.groups);
  groups.set(
    rune.LevelDataKey,
    table.groups
      .get(rune.LevelDataKey)!
      .map((row) => Object.freeze({ ...row, STATTYPE: statType })),
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      rune_levels: {
        ...table,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function withRuneLevelRow(
  runeKey: number,
  rowIndex: number,
  patch: Partial<DiscordHeroDatasetRow<"rune_levels">>,
): DiscordHeroCatalogIndexes {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  const groups = new Map(table.groups);
  groups.set(
    rune.LevelDataKey,
    table.groups
      .get(rune.LevelDataKey)!
      .map((row, index) =>
        index === rowIndex ? Object.freeze({ ...row, ...patch }) : row,
      ),
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      rune_levels: {
        ...table,
        groups,
      },
    },
  } as DiscordHeroCatalogIndexes;
}

describe("DiscordHero source rune upgrades", () => {
  test("maps all 197 runes and every reachable source level to exact costs and effects", () => {
    let coveredLevels = 0;
    let unreachableRows = 0;
    for (const rune of indexes.tables.runes.rows) {
      const resolved = resolveRuneLevelRows(indexes, rune);
      const levelRows = resolved.reachable;
      expect(levelRows).toHaveLength(rune.MaxLevel);
      for (let level = 1; level <= rune.MaxLevel; level += 1) {
        const row = levelRows[level - 1]!;
        expect(row.Level).toBe(level);
        expect(row.CostItemKey).toBe(100001);
        expect(row.CostValue).toBeGreaterThan(0);
        expect(row.STATTYPE.length).toBeGreaterThan(0);
        expect(Number.isFinite(row.Value)).toBe(true);
        coveredLevels += 1;
      }
      unreachableRows += resolved.unreachable.length;
    }
    expect(indexes.tables.runes.rows).toHaveLength(197);
    expect(coveredLevels).toBe(658);
    expect(unreachableRows).toBe(5);
  });

  test("validates every reachable source row before prerequisite, earlier-level, or maximum quote results", () => {
    const prerequisiteLocked = structuredClone(fresh);
    const earlierLevel = structuredClone(fresh);
    earlierLevel.runes.push({ key: 408, level: 1 });
    const maximum = structuredClone(fresh);
    maximum.runes.push({ key: 408, level: 1 }, { key: 409, level: 5 });

    for (const [patch, expectedError] of [
      [{ STATTYPE: "" }, "rune 409 level 4 stat type must be non-empty"],
      [
        { Value: Number.NaN },
        "rune 409 level 4 value must be a positive safe integer",
      ],
      [
        { CostValue: 0 },
        "rune 409 level 4 cost must be a positive safe integer",
      ],
      [{ CostItemKey: 999999 }, "rune 409 level 4 has unsupported cost item"],
    ] as const) {
      const malformed = withRuneLevelRow(409, 3, patch);
      for (const state of [prerequisiteLocked, earlierLevel, maximum]) {
        expect(() => quoteRuneUpgrade(malformed, state, 409)).toThrow(
          expectedError,
        );
      }
    }
  });

  test("rejects non-positive, fractional supported Rune values before quoting or spending", () => {
    const state = structuredClone(fresh);
    state.gold = 20_000;
    state.runes.push(
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    );

    for (const value of [-1, 0, 1.5]) {
      const malformed = withRuneLevelRow(2031, 0, { Value: value });
      const before = structuredClone(state);
      expect(() => quoteRuneUpgrade(malformed, state, 2031)).toThrow(
        "rune 2031 level 1 value must be a positive safe integer",
      );
      expect(() => upgradeRune(malformed, state, 2031)).toThrow(
        "rune 2031 level 1 value must be a positive safe integer",
      );
      expect(state).toEqual(before);
    }
  });

  test("uses only the five reachable Rune 409 rows from source order", () => {
    const rune = indexes.tables.runes.groups.get(409)![0]!;
    const resolved = resolveRuneLevelRows(indexes, rune);
    expect(resolved.reachable.map((row) => row.CostValue)).toEqual([
      50_000, 55_000, 60_000, 65_000, 70_000,
    ]);
    expect(resolved.unreachable.map((row) => row.CostValue)).toEqual([
      75_000, 80_000, 85_000, 90_000, 95_000,
    ]);

    const levelFour = structuredClone(fresh);
    levelFour.gold = 1_000_000;
    levelFour.runes.push({ key: 408, level: 1 }, { key: 409, level: 4 });
    expect(quoteRuneUpgrade(indexes, levelFour, 409)).toMatchObject({
      kind: "unsupported-effect",
      currentLevel: 4,
      nextLevel: 5,
      cost: 70_000,
      statType: "AllHeroAttackSpeed",
      value: 10,
    });
  });

  test("requires a source parent even when PrevNodeRequiredLevel is null", () => {
    const locked = quoteRuneUpgrade(indexes, fresh, 10);
    expect(locked).toEqual({
      kind: "prerequisite-locked",
      runeKey: 10,
      name: "Rune of Wealth",
      currentLevel: 0,
      requiredLevel: 1,
      predecessorKeys: [1],
    });

    const withParent = structuredClone(fresh);
    withParent.gold = 1_000;
    withParent.runes.push({ key: 1, level: 1 });
    expect(quoteRuneUpgrade(indexes, withParent, 10)).toMatchObject({
      kind: "unsupported-effect",
      currentLevel: 0,
      nextLevel: 1,
      cost: 200,
      statType: "AdditionalGoldStageBoss",
      value: 10,
    });
  });

  test("enforces explicit higher parent levels from the source graph", () => {
    const state = structuredClone(fresh);
    state.gold = 1_000_000;
    state.runes.push({ key: 1051, level: 4 });
    expect(quoteRuneUpgrade(indexes, state, 1053)).toMatchObject({
      kind: "prerequisite-locked",
      requiredLevel: 5,
      predecessorKeys: [1051],
    });

    state.runes[0]!.level = 5;
    expect(quoteRuneUpgrade(indexes, state, 1053)).toMatchObject({
      kind: "unsupported-effect",
      currentLevel: 0,
      nextLevel: 1,
      statType: "DropChanceNormalChestPercent",
    });
  });

  test("spends one exact level cost and returns a detached state", () => {
    const state = structuredClone(fresh);
    state.gold = 20_000;
    state.runes.push(
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    );
    const result = upgradeRune(indexes, state, 2031);
    expect(result).toMatchObject({
      kind: "upgraded",
      runeKey: 2031,
      name: "Rune of Alchemy",
      level: 1,
      cost: 20_000,
      statType: "CubeAlchemyGoldPercent",
      value: 100,
    });
    if (result.kind !== "upgraded") throw new Error("expected upgrade");
    expect(result.state.gold).toBe(0);
    expect(result.state.runes.at(-1)).toEqual({ key: 2031, level: 1 });
    expect(state.gold).toBe(20_000);
    expect(state.runes.at(-1)).toEqual({ key: 203, level: 1 });

    result.state.runes.at(-1)!.level = 1;
    expect(state.runes.at(-1)).toEqual({ key: 203, level: 1 });
  });

  test("returns frozen unsupported-effect quotes for affordable formation and Skill-slot Runes without mutation", () => {
    const command = structuredClone(fresh);
    command.gold = 1_000;
    command.runes.push({ key: 1, level: 1 }, { key: 20, level: 1 });
    const commandBefore = structuredClone(command);
    const commandQuote = quoteRuneUpgrade(indexes, command, 21);

    expect(commandQuote).toEqual({
      kind: "unsupported-effect",
      runeKey: 21,
      name: "Rune of Command",
      currentLevel: 0,
      nextLevel: 1,
      cost: 1_000,
      statType: "UnlockArrangeSlotCount",
      value: 1,
    });
    expect(Object.isFrozen(commandQuote)).toBe(true);
    if (commandQuote.kind !== "unsupported-effect") {
      throw new Error("expected Rune 21 to be oracle-gated");
    }
    expect(upgradeRune(indexes, command, 21)).toEqual(commandQuote);
    expect(command).toEqual(commandBefore);

    const awakening = structuredClone(fresh);
    awakening.gold = 50_000;
    awakening.runes.push(
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 21, level: 1 },
      { key: 25, level: 1 },
      { key: 26, level: 1 },
    );
    const awakeningBefore = structuredClone(awakening);
    const awakeningQuote = quoteRuneUpgrade(indexes, awakening, 27);

    expect(awakeningQuote).toEqual({
      kind: "unsupported-effect",
      runeKey: 27,
      name: "Rune of Awakening",
      currentLevel: 0,
      nextLevel: 1,
      cost: 50_000,
      statType: "UnlockSkillSlotCount",
      value: 1,
    });
    expect(Object.isFrozen(awakeningQuote)).toBe(true);
    if (awakeningQuote.kind !== "unsupported-effect") {
      throw new Error("expected Rune 27 to be oracle-gated");
    }
    expect(upgradeRune(indexes, awakening, 27)).toEqual(awakeningQuote);
    expect(awakening).toEqual(awakeningBefore);
  });

  test("classifies the exact next-level STATTYPE instead of trusting a Rune key or graph path", () => {
    const root = structuredClone(fresh);
    root.gold = 100;
    expect(
      quoteRuneUpgrade(withRuneLevelStatType(1, "CubeExpPercent"), root, 1),
    ).toMatchObject({
      kind: "available",
      runeKey: 1,
      statType: "CubeExpPercent",
    });

    const alchemy = structuredClone(fresh);
    alchemy.gold = 20_000;
    alchemy.runes.push(
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    );
    expect(
      quoteRuneUpgrade(
        withRuneLevelStatType(2031, "AllHeroAttackDamage"),
        alchemy,
        2031,
      ),
    ).toMatchObject({
      kind: "unsupported-effect",
      runeKey: 2031,
      statType: "AllHeroAttackDamage",
    });
  });

  test("rejects insufficient gold and stops exactly at source max", () => {
    const poor = structuredClone(fresh);
    poor.gold = 19_999;
    poor.runes.push(
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    );
    expect(upgradeRune(indexes, poor, 2031)).toEqual({
      kind: "insufficient-gold",
      runeKey: 2031,
      name: "Rune of Alchemy",
      nextLevel: 1,
      cost: 20_000,
      availableGold: 19_999,
    });
    expect(poor.runes.at(-1)).toEqual({ key: 203, level: 1 });

    const maximum = structuredClone(fresh);
    maximum.runes.push({ key: 1, level: 1 });
    expect(upgradeRune(indexes, maximum, 1)).toEqual({
      kind: "maximum-level",
      runeKey: 1,
      name: "Rune of War",
      level: 1,
    });
  });

  test("rejects forged keys, duplicate progress and unsafe gold", () => {
    expect(() => quoteRuneUpgrade(indexes, fresh, 999999)).toThrow(
      "runes has no unique row",
    );
    const duplicate = structuredClone(fresh);
    duplicate.runes.push({ key: 1, level: 1 }, { key: 1, level: 1 });
    expect(() => quoteRuneUpgrade(indexes, duplicate, 1)).toThrow(
      "duplicate owned rune key 1",
    );
    const unsafe = structuredClone(fresh);
    unsafe.gold = Number.MAX_SAFE_INTEGER + 1;
    expect(() => quoteRuneUpgrade(indexes, unsafe, 1)).toThrow(
      "gold must be a non-negative safe integer",
    );
  });
});
