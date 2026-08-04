import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectOwnedRuneSourceEffects } from "./rune-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

type OwnedRune = Readonly<{ key: number; level: number }>;

function allRunesAtMaximum(): OwnedRune[] {
  return indexes.tables.runes.rows.map((rune) => ({
    key: rune.RuneKey,
    level: rune.MaxLevel,
  }));
}

function representativeOwnedRunes(): OwnedRune[] {
  return [
    { key: 1, level: 1 },
    { key: 10, level: 1 },
    { key: 11, level: 1 },
    { key: 11001, level: 1 },
    { key: 110011, level: 3 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
    { key: 25, level: 1 },
    { key: 301, level: 1 },
    { key: 201, level: 1 },
    { key: 202, level: 1 },
    { key: 203, level: 1 },
    { key: 2031, level: 1 },
    { key: 401, level: 1 },
    { key: 402, level: 3 },
  ];
}

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

function withRuneLevelRow(
  runeKey: number,
  level: number,
  patch: Partial<DiscordHeroDatasetRow<"rune_levels">> &
    Readonly<Record<string, unknown>>,
): DiscordHeroCatalogIndexes {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  const rows = table.rows.map((row) =>
    row.LevelKey === rune.LevelDataKey && row.Level === level
      ? ({ ...row, ...patch } as DiscordHeroDatasetRow<"rune_levels">)
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
  } as unknown as DiscordHeroCatalogIndexes;
}

function withRuneRow(
  runeKey: number,
  patch: Partial<DiscordHeroDatasetRow<"runes">>,
): DiscordHeroCatalogIndexes {
  const table = indexes.tables.runes;
  const rows = table.rows.map((row) =>
    row.RuneKey === runeKey
      ? ({ ...row, ...patch } as DiscordHeroDatasetRow<"runes">)
      : row,
  );
  const groups = new Map<number, readonly DiscordHeroDatasetRow<"runes">[]>();
  for (const row of rows) groups.set(row.RuneKey, [row]);
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      runes: {
        ...table,
        rows,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withPetStatModifier(
  statType: string,
  modifierType: string,
): DiscordHeroCatalogIndexes {
  const table = indexes.tables.pet_stats;
  const rows = table.rows.map((row) =>
    row.STATTYPE === statType ? { ...row, MODTYPE: modifierType } : row,
  );
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      pet_stats: {
        ...table,
        rows,
        groups: groupedRows(rows, "PetStatKey"),
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withCountedRuneRow(runeKey: number): {
  readonly forged: DiscordHeroCatalogIndexes;
  readonly reads: ReadonlyMap<string, number>;
} {
  const table = indexes.tables.runes;
  const reads = new Map<string, number>();
  const rows = table.rows.map((row) => {
    if (row.RuneKey !== runeKey) return row;
    const counted: Record<string, unknown> = {};
    for (const field of Object.keys(row)) {
      Object.defineProperty(counted, field, {
        get() {
          reads.set(field, (reads.get(field) ?? 0) + 1);
          return (row as Readonly<Record<string, unknown>>)[field];
        },
        enumerable: true,
        configurable: true,
      });
    }
    return counted as DiscordHeroDatasetRow<"runes">;
  });
  // Built from the pristine rows so wiring the index never inflates the counts.
  const groups = new Map<number, readonly DiscordHeroDatasetRow<"runes">[]>();
  table.rows.forEach((row, index) => groups.set(row.RuneKey, [rows[index]!]));
  return {
    forged: {
      ...indexes,
      tables: { ...indexes.tables, runes: { ...table, rows, groups } },
    } as unknown as DiscordHeroCatalogIndexes,
    reads,
  };
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

describe("DiscordHero owned Rune source-effect projection", () => {
  test("projects all 197 owned nodes and 658 exact reachable level rows", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: allRunesAtMaximum(),
    });

    expect(indexes.tables.runes.rows).toHaveLength(197);
    expect(indexes.tables.rune_levels.rows).toHaveLength(663);
    expect(projection.sourceEffects).toHaveLength(658);
    expect(projection.sourceLayerModifiers).toHaveLength(211);
    expect(
      projection.sourceEffects.filter(
        (effect) => effect.kind === "offline-source-metadata",
      ),
    ).toHaveLength(43);
    expect(
      projection.sourceEffects.filter(
        (effect) => effect.kind === "alchemy-source-metadata",
      ),
    ).toHaveLength(30);
    expect(
      projection.sourceEffects.filter(
        (effect) => effect.kind === "arrange-slot-source-metadata",
      ),
    ).toHaveLength(2);
    expect(
      projection.sourceEffects.filter(
        (effect) => effect.kind === "unresolved-source-unit",
      ),
    ).toHaveLength(372);

    const sourceCoordinates = new Set(
      projection.sourceEffects.map((effect) =>
        JSON.stringify([effect.runeKey, effect.nodeKey, effect.sourceLevel]),
      ),
    );
    expect(sourceCoordinates.size).toBe(658);
  });

  test("preserves exact owned level joins and source cost progression", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: representativeOwnedRunes(),
    });
    const offlineGold = projection.sourceEffects.filter(
      (effect) => effect.runeKey === 110011,
    );

    expect(offlineGold).toEqual([
      {
        kind: "offline-source-metadata",
        source: "Rune",
        runeKey: 110011,
        nodeKey: 110011,
        ownedLevel: 3,
        sourceLevel: 1,
        statType: "OfflineRewardGoldPercent",
        rawValue: 100,
        consumer: "offline",
        unit: "per-thousand",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 110011,
          levelKey: 110011,
          level: 1,
          costItemKey: 100001,
          costValue: 500,
        },
      },
      {
        kind: "offline-source-metadata",
        source: "Rune",
        runeKey: 110011,
        nodeKey: 110011,
        ownedLevel: 3,
        sourceLevel: 2,
        statType: "OfflineRewardGoldPercent",
        rawValue: 100,
        consumer: "offline",
        unit: "per-thousand",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 110011,
          levelKey: 110011,
          level: 2,
          costItemKey: 100001,
          costValue: 1_000,
        },
      },
      {
        kind: "offline-source-metadata",
        source: "Rune",
        runeKey: 110011,
        nodeKey: 110011,
        ownedLevel: 3,
        sourceLevel: 3,
        statType: "OfflineRewardGoldPercent",
        rawValue: 100,
        consumer: "offline",
        unit: "per-thousand",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 110011,
          levelKey: 110011,
          level: 3,
          costItemKey: 100001,
          costValue: 1_500,
        },
      },
    ]);
  });

  test("proves the source modifier layer only, never the internal scale", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: representativeOwnedRunes(),
    });
    const additionalExperience = projection.sourceLayerModifiers.find(
      (modifier) => modifier.runeKey === 301,
    );

    expect(additionalExperience).toEqual({
      kind: "source-layer-modifier",
      source: "Rune",
      runeKey: 301,
      nodeKey: 301,
      ownedLevel: 1,
      sourceLevel: 1,
      statType: "AdditionalExp",
      rawValue: 1,
      sourceLayer: "FLAT",
      unit: "UNPROVEN",
      modifierEvidence: [{ dataset: "stat_mods", matchingRows: 10 }],
      provenance: {
        runeDataset: "runes",
        runeLevelDataset: "rune_levels",
        levelDataKey: 301,
        levelKey: 301,
        level: 1,
        costItemKey: 100001,
        costValue: 1_000,
      },
    });
    expect(
      projection.sourceEffects.find((effect) => effect.runeKey === 301),
    ).toEqual(additionalExperience);
  });

  test("keeps offline, arrange-slot, and Alchemy effects as typed metadata only", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: representativeOwnedRunes(),
    });

    expect(
      projection.sourceEffects.find(
        (effect) => effect.statType === "UnlockOfflineReward",
      ),
    ).toMatchObject({
      kind: "offline-source-metadata",
      consumer: "offline",
      rawValue: 1,
      unit: "unlock-flag",
    });
    expect(
      projection.sourceEffects.find(
        (effect) => effect.statType === "UnlockArrangeSlotCount",
      ),
    ).toMatchObject({
      kind: "arrange-slot-source-metadata",
      consumer: "arrangement",
      rawValue: 1,
      unit: "slot-count",
    });
    expect(
      projection.sourceEffects.find(
        (effect) => effect.statType === "CubeAlchemyGoldPercent",
      ),
    ).toMatchObject({
      kind: "alchemy-source-metadata",
      consumer: "alchemy",
      rawValue: 100,
      unit: "per-thousand",
    });

    const specializedTypes = new Set([
      "UnlockOfflineReward",
      "OfflineRewardGoldPercent",
      "OfflineRewardExpPercent",
      "UnlockArrangeSlotCount",
      "CubeAlchemyGoldPercent",
      "CubeExpPercent",
    ]);
    expect(
      projection.sourceLayerModifiers.some((modifier) =>
        specializedTypes.has(modifier.statType),
      ),
    ).toBe(false);
  });

  test("retains ambiguous AllHero source rows without leaking them into source-layer modifiers", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: representativeOwnedRunes(),
    });
    const movement = projection.sourceEffects.filter(
      (effect) => effect.runeKey === 402,
    );

    expect(movement).toHaveLength(3);
    expect(movement).toEqual([
      {
        kind: "unresolved-source-unit",
        source: "Rune",
        runeKey: 402,
        nodeKey: 402,
        ownedLevel: 3,
        sourceLevel: 1,
        statType: "AllHeroMoveSpeed",
        rawValue: 30,
        reason: "AllHeroMoveSpeed has no exact source-proven modifier layer",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 402,
          levelKey: 402,
          level: 1,
          costItemKey: 100001,
          costValue: 5_000,
        },
      },
      {
        kind: "unresolved-source-unit",
        source: "Rune",
        runeKey: 402,
        nodeKey: 402,
        ownedLevel: 3,
        sourceLevel: 2,
        statType: "AllHeroMoveSpeed",
        rawValue: 30,
        reason: "AllHeroMoveSpeed has no exact source-proven modifier layer",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 402,
          levelKey: 402,
          level: 2,
          costItemKey: 100001,
          costValue: 5_500,
        },
      },
      {
        kind: "unresolved-source-unit",
        source: "Rune",
        runeKey: 402,
        nodeKey: 402,
        ownedLevel: 3,
        sourceLevel: 3,
        statType: "AllHeroMoveSpeed",
        rawValue: 30,
        reason: "AllHeroMoveSpeed has no exact source-proven modifier layer",
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 402,
          levelKey: 402,
          level: 3,
          costItemKey: 100001,
          costValue: 6_000,
        },
      },
    ]);
    expect(
      projection.sourceLayerModifiers.some(
        (modifier) => String(modifier.statType) === "AllHeroMoveSpeed",
      ),
    ).toBe(false);
  });

  test("rejects duplicate, unknown, unsafe, and structurally forged ownership", () => {
    const project = (ownedRunes: unknown) =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes,
      } as Parameters<typeof projectOwnedRuneSourceEffects>[0]);

    expect(() =>
      project([
        { key: 1, level: 1 },
        { key: 1, level: 1 },
      ]),
    ).toThrow("duplicate owned rune key 1");
    expect(() => project([{ key: 999_999, level: 1 }])).toThrow(
      "owned rune 999999 references unknown source node",
    );
    expect(() => project([{ key: 301, level: 1 }])).toThrow(
      "owned rune 301 requires a predecessor at level 1",
    );
    expect(() => project([{ key: 1, level: 1, heroLevel: 100 }])).toThrow(
      "owned rune input has unknown field heroLevel",
    );
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes: [],
        buffs: [],
      } as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune source-effect input has unknown field buffs");

    for (const key of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => project([{ key, level: 1 }])).toThrow(
        "owned rune key must be a positive safe integer",
      );
    }
    for (const level of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => project([{ key: 1, level }])).toThrow(
        "owned rune 1 level must be a positive safe integer",
      );
    }
    expect(() => project([{ key: 1, level: 2 }])).toThrow(
      "owned rune 1 level 2 exceeds source max 1",
    );
  });

  test("rejects forged node joins, level joins, and decreasing source costs", () => {
    const project = (forged: DiscordHeroCatalogIndexes) =>
      projectOwnedRuneSourceEffects({
        indexes: forged,
        ownedRunes: representativeOwnedRunes(),
      });

    expect(() => project(withRuneRow(301, { LevelDataKey: 110011 }))).toThrow(
      "rune 301 level-data join",
    );
    expect(() =>
      project(withRuneLevelRow(110011, 2, { LevelKey: 999_999 })),
    ).toThrow("rune 110011 level-data join");
    expect(() => project(withRuneLevelRow(110011, 2, { Level: 3 }))).toThrow(
      "rune 110011 reachable row 1 has level 3; expected 2",
    );
    expect(() =>
      project(withRuneLevelRow(110011, 2, { CostValue: 1 })),
    ).toThrow("rune 110011 level 2 cost regresses below level 1");
    expect(() =>
      project(
        withRuneLevelRow(110011, 2, {
          forgedCombatMultiplier: 9_999,
        }),
      ),
    ).toThrow("rune_levels row has unknown field forgedCombatMultiplier");
  });

  test("fails closed when a forged matching catalog loses its exact modifier contract", () => {
    const forged = withPetStatModifier("IncreaseGoldAmount", "ADDITIVE");
    const projection = projectOwnedRuneSourceEffects({
      indexes: forged,
      ownedRunes: [
        { key: 1, level: 1 },
        { key: 20, level: 1 },
        { key: 21, level: 1 },
        { key: 25, level: 1 },
      ],
    });
    const effect = projection.sourceEffects.find(
      (candidate) => candidate.runeKey === 25,
    );

    expect(effect).toMatchObject({
      kind: "unresolved-source-unit",
      statType: "IncreaseGoldAmount",
    });
    expect(
      projection.sourceLayerModifiers.some(
        (modifier) => modifier.runeKey === 25,
      ),
    ).toBe(false);
  });

  test("returns a synchronous deeply frozen projection detached from ownership and catalog rows", () => {
    const ownedRunes = representativeOwnedRunes().map((entry) => ({
      ...entry,
    }));
    const mutable = withRuneLevelRow(110011, 1, {});
    const sourceRow = mutable.tables.rune_levels.rows.find(
      (row) => row.LevelKey === 110011 && row.Level === 1,
    )!;
    const beforeOwned = structuredClone(ownedRunes);
    const beforeSource = { ...sourceRow };

    const projection = projectOwnedRuneSourceEffects({
      indexes: mutable,
      ownedRunes,
    });
    expect(projection).not.toBeInstanceOf(Promise);
    expectDeeplyFrozen(projection);
    expect(ownedRunes).toEqual(beforeOwned);
    expect(sourceRow).toEqual(beforeSource);

    ownedRunes.find((entry) => entry.key === 110011)!.level = 1;
    (sourceRow as { Value: number }).Value = 999_999;
    const projected = projection.sourceEffects.find(
      (effect) => effect.runeKey === 110011 && effect.provenance.level === 1,
    )!;
    expect(projected.ownedLevel).toBe(3);
    expect(projected.rawValue).toBe(100);
    expect(Reflect.set(projected, "rawValue", 0)).toBe(false);
  });

  test("never derives consumer-ready arithmetic from a source-layer row", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: allRunesAtMaximum(),
    });

    // MODTYPE evidence proves which layer the source applies on. It says
    // nothing about whether a stored 100 means 100%, 10.0% or 1.00x, so no
    // scaled or pre-summed value may ever leave this module.
    for (const modifier of projection.sourceLayerModifiers) {
      expect(modifier.sourceLayer).toBe("FLAT");
      expect(modifier.unit).toBe("UNPROVEN");
      expect(Object.hasOwn(modifier, "normalizedValue")).toBe(false);
      expect(Object.hasOwn(modifier, "modifierLayer")).toBe(false);
      expect(Number.isSafeInteger(modifier.rawValue)).toBe(true);
    }
    for (const effect of projection.sourceEffects) {
      expect(Object.hasOwn(effect, "normalizedValue")).toBe(false);
    }
    expect(JSON.stringify(projection).includes("flat-internal-units")).toBe(
      false,
    );
  });

  test("keeps the source-layer unit vocabulary identical to pet_stats provenance", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: allRunesAtMaximum(),
    });
    const petStatProven = projection.sourceLayerModifiers.filter((modifier) =>
      modifier.modifierEvidence.some(
        (evidence) => evidence.dataset === "pet_stats",
      ),
    );

    // pet-effects.ts publishes these exact pet_stats rows as unit UNPROVEN;
    // the same rows must not become "proven" merely by arriving via a Rune.
    expect(petStatProven.length).toBeGreaterThan(0);
    expect(
      petStatProven.every((modifier) => modifier.unit === "UNPROVEN"),
    ).toBe(true);
    expect(new Set(projection.sourceLayerModifiers.map((m) => m.unit))).toEqual(
      new Set(["UNPROVEN"]),
    );
  });

  test("rejects non-enumerable and symbol own keys on ownership entries", () => {
    const nonEnumerable: Record<string, unknown> = { key: 1, level: 1 };
    Object.defineProperty(nonEnumerable, "smuggledScale", {
      value: 1_000,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes: [nonEnumerable],
      } as unknown as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune input has unknown field smuggledScale");

    const symbolKeyed: Record<string | symbol, unknown> = { key: 1, level: 1 };
    symbolKeyed[Symbol("smuggledScale")] = 1_000;
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes: [symbolKeyed],
      } as unknown as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune input has unknown field Symbol(smuggledScale)");

    const forgedInput: Record<string | symbol, unknown> = {
      indexes,
      ownedRunes: [],
    };
    forgedInput[Symbol("buffs")] = [];
    expect(() =>
      projectOwnedRuneSourceEffects(
        forgedInput as unknown as Parameters<
          typeof projectOwnedRuneSourceEffects
        >[0],
      ),
    ).toThrow("owned rune source-effect input has unknown field Symbol(buffs)");
  });

  test("reads every catalog field exactly once into a validated snapshot", () => {
    const { forged, reads } = withCountedRuneRow(1);
    const projection = projectOwnedRuneSourceEffects({
      indexes: forged,
      ownedRunes: [{ key: 1, level: 1 }],
    });

    expect(projection.sourceEffects).toHaveLength(1);
    // Validating a value and then re-reading it lets a forged accessor return
    // one thing to the guard and another to the projection.
    expect([...reads.keys()].sort()).toEqual(
      [
        "IconPath",
        "LevelDataKey",
        "MaxLevel",
        "NameKey",
        "NameKey_i18n",
        "NextRuneKey",
        "PrevNodeRequiredLevel",
        "PreviewRuneKey",
        "RuneKey",
        "icon",
        "next_runes",
      ].sort(),
    );
    for (const [field, count] of reads) {
      expect([field, count]).toEqual([field, 1]);
    }
  });

  test("rejects a missing field on ownership entries and on the input itself", () => {
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
      } as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune source-effect input is missing field ownedRunes");
    expect(() =>
      projectOwnedRuneSourceEffects({
        ownedRunes: [],
      } as unknown as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune source-effect input is missing field indexes");
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes: [Object.create({ key: 1, level: 1 })],
      } as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune input is missing fields key, level");
    expect(() =>
      projectOwnedRuneSourceEffects({
        indexes,
        ownedRunes: [{ key: 1 }],
      } as unknown as Parameters<typeof projectOwnedRuneSourceEffects>[0]),
    ).toThrow("owned rune input is missing field level");
  });

  test("keeps the unresolved row shape durable alongside the source-layer shape", () => {
    const projection = projectOwnedRuneSourceEffects({
      indexes,
      ownedRunes: representativeOwnedRunes(),
    });
    const unresolved = projection.sourceEffects.find(
      (effect) => effect.runeKey === 20,
    );

    expect(unresolved).toEqual({
      kind: "unresolved-source-unit",
      source: "Rune",
      runeKey: 20,
      nodeKey: 20,
      ownedLevel: 1,
      sourceLevel: 1,
      statType: "AdditionalExpStageBoss",
      rawValue: 10,
      reason:
        "AdditionalExpStageBoss has no exact source-proven modifier layer",
      provenance: {
        runeDataset: "runes",
        runeLevelDataset: "rune_levels",
        levelDataKey: 20,
        levelKey: 20,
        level: 1,
        costItemKey: 100001,
        costValue: 200,
      },
    });
    expect(Object.hasOwn(unresolved!, "sourceLayer")).toBe(false);
    expect(Object.hasOwn(unresolved!, "unit")).toBe(false);
  });
});
