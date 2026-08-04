import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "./invariants";
import {
  arrangePartySlot,
  deriveDiscordHeroFormationCapacity,
  discordHeroStarterCandidates,
  isDiscordHeroPartyTransition,
} from "./party";
import { createFreshPlayerState, type PlayerState } from "./player";
import { projectOwnedRuneSourceEffects } from "./rune-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const CAPACITY_TWO_RUNES: PlayerState["runes"] = [
  { key: 1, level: 1 },
  { key: 20, level: 1 },
  { key: 21, level: 1 },
];

const CAPACITY_THREE_RUNES: PlayerState["runes"] = [
  ...CAPACITY_TWO_RUNES,
  { key: 22, level: 1 },
  { key: 23, level: 1 },
  { key: 24, level: 1 },
];

function groupedRows<Row, Key extends keyof Row>(
  rows: readonly Row[],
  primary: Key,
): ReadonlyMap<number, readonly Row[]> {
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const key = row[primary];
    if (typeof key !== "number") throw new Error("expected numeric group key");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function withRuneLevelValue(
  runeKey: number,
  value: number,
): DiscordHeroCatalogIndexes {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  const rows = table.rows.map((row) =>
    row.LevelKey === rune.LevelDataKey && row.Level === 1
      ? { ...row, Value: value }
      : row,
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      rune_levels: {
        ...table,
        rows,
        groups: groupedRows(rows, "LevelKey"),
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function withHeroRows(
  mutate: (
    rows: DiscordHeroDatasetRow<"heroes">[],
  ) => DiscordHeroDatasetRow<"heroes">[],
): DiscordHeroCatalogIndexes {
  const table = indexes.tables.heroes;
  const rows = mutate(
    table.rows.map((row) => ({
      ...row,
      HeroNameKey_i18n: { ...row.HeroNameKey_i18n },
    })),
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      heroes: {
        ...table,
        rows,
        groups: groupedRows(rows, "HeroKey"),
      },
    },
  } as DiscordHeroCatalogIndexes;
}

function freshWithRunes(
  runes: PlayerState["runes"],
  party: PlayerState["party"] = [101, null, null],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  state.runes = runes.map((rune) => ({ ...rune }));
  state.party = [...party];
  return state;
}

describe("DiscordHero starter candidates and fresh state", () => {
  test("projects the exact available starter choices as frozen detached values", () => {
    const mutableIndexes = withHeroRows((rows) => rows);
    const candidates = discordHeroStarterCandidates(mutableIndexes);

    expect(candidates).toEqual([
      { heroKey: 101, name: "Knight", classType: "Knight" },
      { heroKey: 201, name: "Ranger", classType: "Ranger" },
      { heroKey: 301, name: "Sorcerer", classType: "Sorcerer" },
    ]);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(candidates.every((candidate) => Object.isFrozen(candidate))).toBe(
      true,
    );
    expect(candidates[0]).not.toBe(
      mutableIndexes.tables.heroes.rows[0] as unknown,
    );

    const source = mutableIndexes.tables.heroes.rows[0]! as unknown as {
      ClassType: string;
      HeroNameKey_i18n: Record<string, unknown>;
    };
    source.ClassType = "forged";
    source.HeroNameKey_i18n["en-US"] = "forged";
    expect(candidates[0]).toEqual({
      heroKey: 101,
      name: "Knight",
      classType: "Knight",
    });
  });

  test("rejects missing, unavailable, or reordered starter source rows", () => {
    expect(() =>
      discordHeroStarterCandidates(
        withHeroRows((rows) => {
          (
            rows[0]! as unknown as { IsFirstAvailable: boolean }
          ).IsFirstAvailable = false;
          return rows;
        }),
      ),
    ).toThrow("heroes must contain exactly three first-available rows");

    expect(() =>
      discordHeroStarterCandidates(
        withHeroRows((rows) => {
          (rows[0]! as unknown as { IsAvailable: boolean }).IsAvailable = false;
          return rows;
        }),
      ),
    ).toThrow("first-available hero 101 must be available");

    expect(() =>
      discordHeroStarterCandidates(
        withHeroRows((rows) => {
          [rows[0], rows[1]] = [rows[1]!, rows[0]!];
          return rows;
        }),
      ),
    ).toThrow("starter heroes must use canonical order 101,201,301");
  });

  test("requires one explicit selected starter while owning all three candidates", () => {
    for (const selected of [101, 201, 301] as const) {
      const plain = createFreshPlayerState(selected);
      expect(plain.party).toEqual([selected, null, null]);
      expect(plain.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);

      const state = createFreshPlayerStateFromCatalog(indexes, selected);
      expect(state.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);
      expect(state.party).toEqual([selected, null, null]);
      expect(state.gold).toBe(100);
      expect(state.runes).toEqual([]);
      expect(validatePlayerAgainstCatalog(state, indexes)).toEqual(state);
    }
  });
});

describe("DiscordHero formation capacity", () => {
  test("derives one, two, and three slots only from reachable owned source effects", () => {
    expect(deriveDiscordHeroFormationCapacity(indexes, [])).toBe(1);
    expect(
      deriveDiscordHeroFormationCapacity(indexes, CAPACITY_TWO_RUNES),
    ).toBe(2);
    expect(
      deriveDiscordHeroFormationCapacity(indexes, CAPACITY_THREE_RUNES),
    ).toBe(3);
  });

  test("retains the exact Rune 21 and Rune 24 value and cost provenance", () => {
    const effects = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: CAPACITY_THREE_RUNES,
    }).sourceEffects.filter(
      (effect) =>
        effect.kind === "arrange-slot-source-metadata" &&
        (effect.runeKey === 21 || effect.runeKey === 24),
    );

    expect(effects).toMatchObject([
      {
        runeKey: 21,
        rawValue: 1,
        provenance: { costValue: 1_000 },
      },
      {
        runeKey: 24,
        rawValue: 1,
        provenance: { costValue: 150_000 },
      },
    ]);
  });

  test("rejects non-positive, fractional, and overflowing source contributions without clamping", () => {
    for (const value of [0, 1.5, 3]) {
      expect(() =>
        deriveDiscordHeroFormationCapacity(
          withRuneLevelValue(21, value),
          CAPACITY_TWO_RUNES,
        ),
      ).toThrow();
    }
  });
});

describe("DiscordHero pure party arrangement", () => {
  test("replaces, fills, swaps, and replaces without changing ownership", () => {
    const base = createFreshPlayerStateFromCatalog(indexes, 101);
    const capacityTwo = freshWithRunes(CAPACITY_TWO_RUNES);
    const capacityTwoFilled = freshWithRunes(CAPACITY_TWO_RUNES, [
      101,
      201,
      null,
    ]);

    expect(arrangePartySlot(indexes, base, 1, 201)).toMatchObject({
      kind: "changed",
      transition: "replace",
      targetSlot: 1,
      selectedHeroKey: 201,
      previousHeroKey: 101,
      sourceSlot: null,
      state: { party: [201, null, null] },
    });
    expect(arrangePartySlot(indexes, capacityTwo, 2, 201)).toMatchObject({
      kind: "changed",
      transition: "fill",
      targetSlot: 2,
      selectedHeroKey: 201,
      previousHeroKey: null,
      sourceSlot: null,
      state: { party: [101, 201, null] },
    });
    expect(arrangePartySlot(indexes, capacityTwoFilled, 1, 201)).toMatchObject({
      kind: "changed",
      transition: "swap",
      targetSlot: 1,
      selectedHeroKey: 201,
      previousHeroKey: 101,
      sourceSlot: 2,
      state: { party: [201, 101, null] },
    });
    expect(arrangePartySlot(indexes, capacityTwoFilled, 2, 301)).toMatchObject({
      kind: "changed",
      transition: "replace",
      targetSlot: 2,
      selectedHeroKey: 301,
      previousHeroKey: 201,
      sourceSlot: null,
      state: { party: [101, 301, null] },
    });
    expect(base.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);
    expect(capacityTwo.heroes.map((hero) => hero.heroKey)).toEqual([
      101, 201, 301,
    ]);
  });

  test("distinguishes no-op, locked, unowned, malformed, deployed-to-empty, and active-stage outcomes", () => {
    const base = createFreshPlayerStateFromCatalog(indexes, 101);
    const capacityTwo = freshWithRunes(CAPACITY_TWO_RUNES);

    expect(arrangePartySlot(indexes, base, 1, 101)).toEqual({
      kind: "unchanged",
    });
    expect(arrangePartySlot(indexes, base, 2, 201)).toEqual({
      kind: "slot-locked",
      capacity: 1,
    });
    expect(arrangePartySlot(indexes, base, 1, 401)).toEqual({
      kind: "hero-not-owned",
    });
    for (const targetSlot of [
      0,
      1.5,
      4,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(arrangePartySlot(indexes, base, targetSlot, 201)).toEqual({
        kind: "invalid-target",
      });
    }
    for (const heroKey of [0, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(arrangePartySlot(indexes, base, 1, heroKey)).toEqual({
        kind: "invalid-target",
      });
    }
    expect(arrangePartySlot(indexes, capacityTwo, 2, 101)).toEqual({
      kind: "invalid-target",
    });

    const active = structuredClone(base);
    active.stageSession = {
      sessionId: "active",
      stageKey: 1101,
      party: [101, null, null],
      startedAtMs: 1,
      advancedThroughMs: 1,
      wave: 0,
      rngSeed: "seed",
      rngCursor: 0,
      pendingRewards: { gold: 0, xp: 0, items: [] },
    };
    expect(arrangePartySlot(indexes, active, 1, 201)).toEqual({
      kind: "stage-active",
    });
  });

  test("leaves input bytes unchanged and returns a frozen result with detached changed state", () => {
    const state = freshWithRunes(CAPACITY_TWO_RUNES);
    const before = JSON.stringify(state);
    const result = arrangePartySlot(indexes, state, 2, 201);

    expect(JSON.stringify(state)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind !== "changed") throw new Error("expected changed result");
    expect(result.state).not.toBe(state);
    expect(result.state.party).not.toBe(state.party);
    expect(result.state.heroes).not.toBe(state.heroes);
    expect(result.state.runes).not.toBe(state.runes);
    expect(result.state.containers).not.toBe(state.containers);

    result.state.heroes[0]!.level = 2;
    result.state.runes[0]!.level = 1;
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("DiscordHero party transition proof", () => {
  test("accepts unchanged, replace, fill, and swap parties reproduced by one operation", () => {
    const base = createFreshPlayerStateFromCatalog(indexes, 101);
    const capacityTwo = freshWithRunes(CAPACITY_TWO_RUNES);
    const capacityTwoFilled = freshWithRunes(CAPACITY_TWO_RUNES, [
      101,
      201,
      null,
    ]);

    expect(
      isDiscordHeroPartyTransition(indexes, base, structuredClone(base)),
    ).toBe(true);
    for (const [previous, targetSlot, selectedHeroKey] of [
      [base, 1, 201],
      [capacityTwo, 2, 201],
      [capacityTwoFilled, 1, 201],
    ] as const) {
      const arranged = arrangePartySlot(
        indexes,
        previous,
        targetSlot,
        selectedHeroKey,
      );
      if (arranged.kind !== "changed") throw new Error("expected transition");
      expect(
        isDiscordHeroPartyTransition(indexes, previous, arranged.state),
      ).toBe(true);
    }
  });

  test("rejects forged multi-step parties and every hero ownership mutation", () => {
    const previous = freshWithRunes(CAPACITY_TWO_RUNES, [101, 201, null]);
    const forged = structuredClone(previous);
    forged.party = [301, 101, null];
    expect(isDiscordHeroPartyTransition(indexes, previous, forged)).toBe(false);

    const ownershipChanged = structuredClone(previous);
    ownershipChanged.heroes = ownershipChanged.heroes.slice(0, 2);
    ownershipChanged.party = [101, 201, null];
    expect(
      isDiscordHeroPartyTransition(indexes, previous, ownershipChanged),
    ).toBe(false);
  });
});
