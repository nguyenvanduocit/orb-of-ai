import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE,
  discordHeroRuneEffectDetail,
  discordHeroRuneEffectsPage,
  discordHeroRuneEffectsPageCount,
  discordHeroRuneEffectsTextRows,
  projectDiscordHeroRuneEffectsBrowser,
} from "./rune-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

type OwnedRune = Readonly<{ key: number; level: number }>;

const REPRESENTATIVE_OWNED_RUNES = [
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
] as const;

function allRunesAtMaximum(): OwnedRune[] {
  return indexes.tables.runes.rows.map((rune) => ({
    key: rune.RuneKey,
    level: rune.MaxLevel,
  }));
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

function withRuneLevelStatType(
  runeKey: number,
  level: number,
  statType: string,
): {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly row: DiscordHeroDatasetRow<"rune_levels">;
} {
  const rune = indexes.tables.runes.groups.get(runeKey)![0]!;
  const table = indexes.tables.rune_levels;
  let target: DiscordHeroDatasetRow<"rune_levels"> | undefined;
  const rows = table.rows.map((row) => {
    if (row.LevelKey !== rune.LevelDataKey || row.Level !== level) return row;
    target = { ...row, STATTYPE: statType };
    return target;
  });
  if (target === undefined) throw new Error("expected target Rune level row");
  return {
    indexes: {
      ...indexes,
      tables: {
        ...indexes.tables,
        rune_levels: {
          ...table,
          rows,
          groups: groupedRows(rows, "LevelKey"),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes,
    row: target,
  };
}

function expectDeeplyFrozen(value: unknown, path = "$"): void {
  if (typeof value !== "object" || value === null) return;
  expect(`${path}:${Object.isFrozen(value)}`).toBe(`${path}:true`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(descriptor?.get).toBeUndefined();
    expect(descriptor?.set).toBeUndefined();
    if (descriptor !== undefined && "value" in descriptor) {
      expectDeeplyFrozen(descriptor.value, `${path}.${String(key)}`);
    }
  }
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function expectDiscordSafePlainText(value: string): void {
  expect(value.length).toBeLessThanOrEqual(200);
  expect(value).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u);
  expect(value).not.toContain("`");
  expect(value).not.toMatch(/@(?:everyone|here)|<@!?\d+>|<@&\d+>|<#\d+>/iu);
  expect(hasLoneSurrogate(value)).toBe(false);
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return (error as Error).message;
  }
  throw new Error("expected operation to reject");
}

describe("DiscordHero owned Rune source-effect browser", () => {
  test("returns a frozen empty browser with zero pages for no owned Runes", () => {
    const ownedRunes: OwnedRune[] = [];
    const before = JSON.stringify(ownedRunes);
    const browser = projectDiscordHeroRuneEffectsBrowser(indexes, ownedRunes);

    expect(DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE).toBeLessThanOrEqual(25);
    expect(browser).toEqual({
      effectCount: 0,
      pageCount: 0,
      pageSize: 25,
    });
    expect(discordHeroRuneEffectsPageCount(indexes, ownedRunes)).toBe(0);
    expectDeeplyFrozen(browser);
    expect(JSON.stringify(ownedRunes)).toBe(before);
  });

  test("pages all 658 owned source rows in exact order without exceeding owned levels", () => {
    const ownedRunes = allRunesAtMaximum();
    const ownedLevels = new Map(
      ownedRunes.map((owned) => [owned.key, owned.level]),
    );
    const browser = projectDiscordHeroRuneEffectsBrowser(indexes, ownedRunes);

    expect(browser).toEqual({
      effectCount: 658,
      pageCount: 27,
      pageSize: 25,
    });
    expect(discordHeroRuneEffectsPageCount(indexes, ownedRunes)).toBe(27);

    const pages = Array.from({ length: 27 }, (_, page) =>
      discordHeroRuneEffectsPage(indexes, ownedRunes, { page }),
    );
    expect(pages.map((page) => page.rows.length)).toEqual([
      25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
      25, 25, 25, 25, 25, 25, 25, 25, 8,
    ]);
    const rows = pages.flatMap((page) => page.rows);
    expect(rows).toHaveLength(658);
    expect(rows.map((row) => row.rowIndex)).toEqual(
      Array.from({ length: 658 }, (_, index) => index),
    );
    expect(
      new Set(
        rows.map((row) =>
          JSON.stringify([
            row.effect.runeKey,
            row.effect.nodeKey,
            row.effect.sourceLevel,
          ]),
        ),
      ).size,
    ).toBe(658);
    expect(
      rows.every(
        (row) =>
          row.effect.sourceLevel <=
          (ownedLevels.get(row.effect.runeKey) ?? Number.NaN),
      ),
    ).toBe(true);
    expect(
      [rows[0], rows[328], rows[657]].map((row) => [
        row?.rowIndex,
        row?.effect.runeKey,
        row?.effect.sourceLevel,
        row?.effect.statType,
        row?.effect.rawValue,
        row?.effect.kind,
      ]),
    ).toEqual([
      [0, 1, 1, "AllHeroAttackDamage", 1, "unresolved-source-unit"],
      [
        328,
        1053,
        1,
        "DropChanceNormalChestPercent",
        70,
        "source-layer-modifier",
      ],
      [657, 4101, 5, "AllHeroMoveSpeed", 20, "unresolved-source-unit"],
    ]);
  });

  test("preserves exact raw modifier, specialized, and unresolved metadata in detail rows", () => {
    const sourceLayer = discordHeroRuneEffectDetail(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      { rowIndex: 9, runeKey: 25, sourceLevel: 1 },
    );
    expect(sourceLayer).toEqual({
      rowIndex: 9,
      effect: {
        source: "Rune",
        runeKey: 25,
        nodeKey: 25,
        ownedLevel: 1,
        sourceLevel: 1,
        statType: "IncreaseGoldAmount",
        rawValue: 50,
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 25,
          levelKey: 25,
          level: 1,
          costItemKey: 100001,
          costValue: 500,
        },
        kind: "source-layer-modifier",
        sourceLayer: "FLAT",
        unit: "UNPROVEN",
        modifierEvidence: [{ dataset: "pet_stats", matchingRows: 3 }],
      },
    });

    const rows = discordHeroRuneEffectsPage(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      { page: 0 },
    ).rows;
    expect(rows).toHaveLength(19);
    expect(
      [rows[3], rows[4], rows[8], rows[14]].map((row) => row?.effect),
    ).toEqual([
      expect.objectContaining({
        kind: "offline-source-metadata",
        statType: "UnlockOfflineReward",
        rawValue: 1,
        consumer: "offline",
        unit: "unlock-flag",
      }),
      expect.objectContaining({
        kind: "offline-source-metadata",
        statType: "OfflineRewardGoldPercent",
        rawValue: 100,
        consumer: "offline",
        unit: "per-thousand",
      }),
      expect.objectContaining({
        kind: "arrange-slot-source-metadata",
        statType: "UnlockArrangeSlotCount",
        rawValue: 1,
        consumer: "arrangement",
        unit: "slot-count",
      }),
      expect.objectContaining({
        kind: "alchemy-source-metadata",
        statType: "CubeAlchemyGoldPercent",
        rawValue: 100,
        consumer: "alchemy",
        unit: "per-thousand",
      }),
    ]);
    expect(rows[16]).toEqual({
      rowIndex: 16,
      effect: {
        source: "Rune",
        runeKey: 402,
        nodeKey: 402,
        ownedLevel: 3,
        sourceLevel: 1,
        statType: "AllHeroMoveSpeed",
        rawValue: 30,
        provenance: {
          runeDataset: "runes",
          runeLevelDataset: "rune_levels",
          levelDataKey: 402,
          levelKey: 402,
          level: 1,
          costItemKey: 100001,
          costValue: 5_000,
        },
        kind: "unresolved-source-unit",
        reason: "AllHeroMoveSpeed has no exact source-proven modifier layer",
      },
    });
  });

  test("rejects a stale row after an owned Rune level inserts a new source effect", () => {
    const selectedOwnership = [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 11, level: 1 },
      { key: 11001, level: 1 },
      { key: 110011, level: 1 },
      { key: 20, level: 1 },
    ] as const;
    const browser = projectDiscordHeroRuneEffectsBrowser(
      indexes,
      selectedOwnership,
    );
    const page = discordHeroRuneEffectsPage(indexes, selectedOwnership, {
      page: 0,
    });
    const selected = page.rows[5]!;

    expect(browser).toEqual({
      effectCount: 6,
      pageCount: 1,
      pageSize: 25,
    });
    expect([
      selected.rowIndex,
      selected.effect.runeKey,
      selected.effect.sourceLevel,
      selected.effect.statType,
    ]).toEqual([5, 20, 1, "AdditionalExpStageBoss"]);

    const upgradedOwnership = selectedOwnership.map((owned) =>
      owned.key === 110011 ? { ...owned, level: 2 } : { ...owned },
    );
    let staleReturned: unknown = "SENTINEL";
    let staleError: unknown = null;
    try {
      staleReturned = discordHeroRuneEffectDetail(indexes, upgradedOwnership, {
        rowIndex: 5,
      } as never);
    } catch (error) {
      staleError = error;
    }
    expect(staleReturned).toBe("SENTINEL");
    expect(staleError).toBeInstanceOf(Error);
    expect((staleError as Error).message).toBe(
      "rune-effects detail input is missing fields runeKey, sourceLevel",
    );

    expect(
      discordHeroRuneEffectDetail(indexes, selectedOwnership, {
        rowIndex: 5,
        runeKey: 20,
        sourceLevel: 1,
      }),
    ).toEqual(selected);
    expect(() =>
      discordHeroRuneEffectDetail(indexes, upgradedOwnership, {
        rowIndex: 5,
        runeKey: 20,
        sourceLevel: 1,
      }),
    ).toThrow(
      "rune-effects detail row 5 identity mismatch; expected rune 20 source level 1, received rune 110011 source level 2",
    );
  });

  test("rejects stale semantic identity after reorder or insertion without fallback search", () => {
    const target = { rowIndex: 5, runeKey: 20, sourceLevel: 1 } as const;
    const reordered = [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 11, level: 1 },
      { key: 11001, level: 1 },
      { key: 20, level: 1 },
      { key: 110011, level: 1 },
    ] as const;
    const inserted = [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 11, level: 1 },
      { key: 11001, level: 1 },
      { key: 110011, level: 1 },
      { key: 21, level: 1 },
      { key: 20, level: 1 },
    ] as const;

    expect(() =>
      discordHeroRuneEffectDetail(indexes, reordered, target),
    ).toThrow(
      "rune-effects detail row 5 identity mismatch; expected rune 20 source level 1, received rune 110011 source level 1",
    );
    expect(() =>
      discordHeroRuneEffectDetail(indexes, inserted, target),
    ).toThrow(
      "rune-effects detail row 5 identity mismatch; expected rune 20 source level 1, received rune 21 source level 1",
    );
    expect(
      discordHeroRuneEffectsPage(indexes, reordered, { page: 0 }).rows.some(
        (row) =>
          row.effect.runeKey === target.runeKey &&
          row.effect.sourceLevel === target.sourceLevel,
      ),
    ).toBe(true);
    expect(
      discordHeroRuneEffectsPage(indexes, inserted, { page: 0 }).rows.some(
        (row) =>
          row.effect.runeKey === target.runeKey &&
          row.effect.sourceLevel === target.sourceLevel,
      ),
    ).toBe(true);
  });

  test("keeps DTOs provenance-only without normalized, applied, payout, or craftability claims", () => {
    const page = discordHeroRuneEffectsPage(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      { page: 0 },
    );
    const serialized = JSON.stringify(page).toLowerCase();

    for (const forbidden of [
      "normalizedvalue",
      "appliedvalue",
      "totalvalue",
      "payout",
      "craftable",
      "damagevalue",
      "damagetotal",
      "targetselection",
      "stacking",
      "expiry",
      "probability",
      "rng",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    for (const row of page.rows) {
      expect(Object.hasOwn(row.effect, "normalizedValue")).toBe(false);
      expect(Object.hasOwn(row.effect, "appliedValue")).toBe(false);
    }
  });

  test("sanitizes presentation text while preserving the exact raw DTO string", () => {
    const unsafe =
      "@everyone @here <@123> <@!456> <@&789> <#101112>\n\r```tick` \u0000\u0001\u001f\u007f\u0085\u2028\u2029\ud83d";
    const forged = withRuneLevelStatType(1, 1, unsafe);
    const ownedRunes = [{ key: 1, level: 1 }] as const;
    const text = discordHeroRuneEffectsTextRows(forged.indexes, ownedRunes, {
      page: 0,
    })[0]!;
    const detail = discordHeroRuneEffectDetail(forged.indexes, ownedRunes, {
      rowIndex: 0,
      runeKey: 1,
      sourceLevel: 1,
    });

    expectDiscordSafePlainText(text);
    expect(text).toBe(
      discordHeroRuneEffectsTextRows(forged.indexes, ownedRunes, {
        page: 0,
      })[0],
    );
    expect(detail.effect.statType).toBe(unsafe);
    expect(detail.effect.kind).toBe("unresolved-source-unit");
    if (detail.effect.kind !== "unresolved-source-unit") {
      throw new Error("expected unresolved source row");
    }
    expect(detail.effect.reason).toBe(
      `${unsafe} has no exact source-proven modifier layer`,
    );
  });

  test("truncates at a complete astral code point within 200 UTF-16 units", () => {
    const boundary = `${"a".repeat(174)}😀${"b".repeat(40)}`;
    const forged = withRuneLevelStatType(1, 1, boundary);
    const ownedRunes = [{ key: 1, level: 1 }] as const;
    const first = discordHeroRuneEffectsTextRows(forged.indexes, ownedRunes, {
      page: 0,
    })[0]!;
    const second = discordHeroRuneEffectsTextRows(forged.indexes, ownedRunes, {
      page: 0,
    })[0]!;

    expect(first).toBe(second);
    expect(first).toEndWith("…");
    expectDiscordSafePlainText(first);
    expect(
      discordHeroRuneEffectDetail(forged.indexes, ownedRunes, {
        rowIndex: 0,
        runeKey: 1,
        sourceLevel: 1,
      }).effect.statType,
    ).toBe(boundary);
  });

  test("rejects forged page and detail inputs before access or coercion", () => {
    let accessorReads = 0;
    let coercionCalls = 0;
    const pageAccessor: Record<string, unknown> = {};
    Object.defineProperty(pageAccessor, "page", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 0;
      },
    });
    const detailAccessors = ["rowIndex", "runeKey", "sourceLevel"].map(
      (accessorField) => {
        const detail: Record<string, unknown> = {
          rowIndex: 0,
          runeKey: 1,
          sourceLevel: 1,
        };
        Object.defineProperty(detail, accessorField, {
          enumerable: true,
          get() {
            accessorReads += 1;
            return accessorField === "rowIndex" ? 0 : 1;
          },
        });
        return detail;
      },
    );
    const hostile = {
      toString() {
        coercionCalls += 1;
        throw new Error("hostile toString invoked");
      },
      valueOf() {
        coercionCalls += 1;
        throw new Error("hostile valueOf invoked");
      },
    };

    for (const run of [
      () =>
        discordHeroRuneEffectsPage(
          indexes,
          REPRESENTATIVE_OWNED_RUNES,
          pageAccessor as never,
        ),
      ...detailAccessors.map(
        (detail) => () =>
          discordHeroRuneEffectDetail(
            indexes,
            REPRESENTATIVE_OWNED_RUNES,
            detail as never,
          ),
      ),
    ]) {
      expect(run).toThrow(/own data properties without accessors/i);
    }
    expect(accessorReads).toBe(0);

    const pageError = errorMessage(() =>
      discordHeroRuneEffectsPage(indexes, REPRESENTATIVE_OWNED_RUNES, {
        page: hostile,
      } as never),
    );
    const detailError = errorMessage(() =>
      discordHeroRuneEffectDetail(indexes, REPRESENTATIVE_OWNED_RUNES, {
        rowIndex: hostile,
        runeKey: 1,
        sourceLevel: 1,
      } as never),
    );
    const runeKeyError = errorMessage(() =>
      discordHeroRuneEffectDetail(indexes, REPRESENTATIVE_OWNED_RUNES, {
        rowIndex: 0,
        runeKey: hostile,
        sourceLevel: 1,
      } as never),
    );
    const sourceLevelError = errorMessage(() =>
      discordHeroRuneEffectDetail(indexes, REPRESENTATIVE_OWNED_RUNES, {
        rowIndex: 0,
        runeKey: 1,
        sourceLevel: hostile,
      } as never),
    );
    expect(coercionCalls).toBe(0);
    expect(pageError).toBe(
      "rune-effects page input.page must be a non-negative safe integer; received object",
    );
    expect(detailError).toBe(
      "rune-effects detail input.rowIndex must be a non-negative safe integer; received object",
    );
    expect(runeKeyError).toBe(
      "rune-effects detail input.runeKey must be a positive safe integer; received object",
    );
    expect(sourceLevelError).toBe(
      "rune-effects detail input.sourceLevel must be a positive safe integer; received object",
    );
    expectDiscordSafePlainText(pageError);
    expectDiscordSafePlainText(detailError);

    for (const run of [
      () =>
        discordHeroRuneEffectsPage(
          indexes,
          REPRESENTATIVE_OWNED_RUNES,
          Object.assign(Object.create({ inherited: true }), { page: 0 }),
        ),
      () =>
        discordHeroRuneEffectDetail(
          indexes,
          REPRESENTATIVE_OWNED_RUNES,
          Object.assign(Object.create({ inherited: true }), {
            rowIndex: 0,
            runeKey: 1,
            sourceLevel: 1,
          }),
        ),
      () =>
        discordHeroRuneEffectsPage(indexes, REPRESENTATIVE_OWNED_RUNES, {
          page: 0,
          [Symbol("page")]: true,
        } as never),
      () =>
        discordHeroRuneEffectDetail(indexes, REPRESENTATIVE_OWNED_RUNES, {
          rowIndex: 0,
          runeKey: 1,
          sourceLevel: 1,
          [Symbol("detail")]: true,
        } as never),
      () =>
        discordHeroRuneEffectsPage(indexes, REPRESENTATIVE_OWNED_RUNES, {
          page: 0,
          extra: true,
        } as never),
      () =>
        discordHeroRuneEffectDetail(indexes, REPRESENTATIVE_OWNED_RUNES, {
          rowIndex: 19,
          runeKey: 402,
          sourceLevel: 3,
        }),
    ]) {
      expect(run).toThrow();
    }
  });

  test("rejects revoked page and detail proxies as plain Errors before Array.isArray", () => {
    const revokedPage = Proxy.revocable({ page: 0 }, {});
    const revokedDetail = Proxy.revocable(
      { rowIndex: 0, runeKey: 1, sourceLevel: 1 },
      {},
    );
    revokedPage.revoke();
    revokedDetail.revoke();

    const originalArrayIsArray = Array.isArray;
    let hostileArrayChecks = 0;
    Reflect.set(Array, "isArray", (value: unknown) => {
      if (value === revokedPage.proxy || value === revokedDetail.proxy) {
        hostileArrayChecks += 1;
      }
      return originalArrayIsArray(value);
    });

    const outcomes: Array<{
      returned: unknown;
      error: unknown;
    }> = [];
    try {
      for (const run of [
        () =>
          discordHeroRuneEffectsPage(
            indexes,
            REPRESENTATIVE_OWNED_RUNES,
            revokedPage.proxy,
          ),
        () =>
          discordHeroRuneEffectDetail(
            indexes,
            REPRESENTATIVE_OWNED_RUNES,
            revokedDetail.proxy,
          ),
      ]) {
        let returned: unknown = "SENTINEL";
        let error: unknown = null;
        try {
          returned = run();
        } catch (caught) {
          error = caught;
        }
        outcomes.push({ returned, error });
      }
    } finally {
      Reflect.set(Array, "isArray", originalArrayIsArray);
    }

    expect(outcomes.map(({ returned }) => returned)).toEqual([
      "SENTINEL",
      "SENTINEL",
    ]);
    for (const { error } of outcomes) {
      expect(Object.getPrototypeOf(error) === Error.prototype).toBe(true);
      expect(error instanceof TypeError).toBe(false);
    }
    expect(outcomes.map(({ error }) => (error as Error).message)).toEqual([
      "rune-effects page input must not be a proxy or TOCTOU-capable object",
      "rune-effects detail input must not be a proxy or TOCTOU-capable object",
    ]);
    expect(hostileArrayChecks).toBe(0);
  });

  test("rejects every page and detail proxy shape without traps or partial output", () => {
    const trapCounts = {
      apply: 0,
      construct: 0,
      defineProperty: 0,
      deleteProperty: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      isExtensible: 0,
      ownKeys: 0,
      preventExtensions: 0,
      set: 0,
      setPrototypeOf: 0,
    };
    const trapHandler: ProxyHandler<object> = {
      apply() {
        trapCounts.apply += 1;
        throw new Error("proxy apply trap invoked");
      },
      construct() {
        trapCounts.construct += 1;
        throw new Error("proxy construct trap invoked");
      },
      defineProperty() {
        trapCounts.defineProperty += 1;
        throw new Error("proxy defineProperty trap invoked");
      },
      deleteProperty() {
        trapCounts.deleteProperty += 1;
        throw new Error("proxy deleteProperty trap invoked");
      },
      get() {
        trapCounts.get += 1;
        throw new Error("proxy get trap invoked");
      },
      getOwnPropertyDescriptor() {
        trapCounts.getOwnPropertyDescriptor += 1;
        throw new Error("proxy getOwnPropertyDescriptor trap invoked");
      },
      getPrototypeOf() {
        trapCounts.getPrototypeOf += 1;
        throw new Error("proxy getPrototypeOf trap invoked");
      },
      has() {
        trapCounts.has += 1;
        throw new Error("proxy has trap invoked");
      },
      isExtensible() {
        trapCounts.isExtensible += 1;
        throw new Error("proxy isExtensible trap invoked");
      },
      ownKeys() {
        trapCounts.ownKeys += 1;
        throw new Error("proxy ownKeys trap invoked");
      },
      preventExtensions() {
        trapCounts.preventExtensions += 1;
        throw new Error("proxy preventExtensions trap invoked");
      },
      set() {
        trapCounts.set += 1;
        throw new Error("proxy set trap invoked");
      },
      setPrototypeOf() {
        trapCounts.setPrototypeOf += 1;
        throw new Error("proxy setPrototypeOf trap invoked");
      },
    };
    const bodyCounts = {
      page: 0,
      detail: 0,
    };
    const callablePageTarget = () => {
      bodyCounts.page += 1;
      return { page: 0 };
    };
    const callableDetailTarget = () => {
      bodyCounts.detail += 1;
      return { rowIndex: 0, runeKey: 1, sourceLevel: 1 };
    };
    const pageArrayTarget = Object.assign([], { page: 0 });
    const detailArrayTarget = Object.assign([], {
      rowIndex: 0,
      runeKey: 1,
      sourceLevel: 1,
    });
    const pageInputs = [
      new Proxy({ page: 0 }, {}),
      new Proxy(
        callablePageTarget,
        trapHandler as ProxyHandler<typeof callablePageTarget>,
      ),
      new Proxy(pageArrayTarget, trapHandler),
      new Proxy({ page: 0 }, trapHandler),
      new Proxy(new Proxy({ page: 0 }, trapHandler), {}),
    ] as const;
    const detailInputs = [
      new Proxy({ rowIndex: 0, runeKey: 1, sourceLevel: 1 }, {}),
      new Proxy(
        callableDetailTarget,
        trapHandler as ProxyHandler<typeof callableDetailTarget>,
      ),
      new Proxy(detailArrayTarget, trapHandler),
      new Proxy({ rowIndex: 0, runeKey: 1, sourceLevel: 1 }, trapHandler),
      new Proxy(
        new Proxy({ rowIndex: 0, runeKey: 1, sourceLevel: 1 }, trapHandler),
        {},
      ),
    ] as const;
    const hostileInputs: readonly unknown[] = [...pageInputs, ...detailInputs];
    const ordinaryPageInput = { page: 0 };
    const ordinaryDetailInput = {
      rowIndex: 0,
      runeKey: 1,
      sourceLevel: 1,
    };
    const ordinaryPageBefore = discordHeroRuneEffectsPage(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      ordinaryPageInput,
    );
    const ordinaryTextBefore = discordHeroRuneEffectsTextRows(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      ordinaryPageInput,
    );
    const ordinaryDetailBefore = discordHeroRuneEffectDetail(
      indexes,
      REPRESENTATIVE_OWNED_RUNES,
      ordinaryDetailInput,
    );
    const ordinaryInputsBefore = [
      Object.getOwnPropertyDescriptors(ordinaryPageInput),
      Object.getOwnPropertyDescriptors(ordinaryDetailInput),
    ];

    const originalArrayIsArray = Array.isArray;
    let hostileArrayChecks = 0;
    Reflect.set(Array, "isArray", (value: unknown) => {
      if (hostileInputs.includes(value)) hostileArrayChecks += 1;
      return originalArrayIsArray(value);
    });

    const outcomes: Array<{
      returned: unknown;
      error: unknown;
      expectedMessage: string;
    }> = [];
    try {
      for (const input of pageInputs) {
        for (const run of [
          () =>
            discordHeroRuneEffectsPage(
              indexes,
              REPRESENTATIVE_OWNED_RUNES,
              input as never,
            ),
          () =>
            discordHeroRuneEffectsTextRows(
              indexes,
              REPRESENTATIVE_OWNED_RUNES,
              input as never,
            ),
        ]) {
          let returned: unknown = "SENTINEL";
          let error: unknown = null;
          try {
            returned = run();
          } catch (caught) {
            error = caught;
          }
          outcomes.push({
            returned,
            error,
            expectedMessage:
              "rune-effects page input must not be a proxy or TOCTOU-capable object",
          });
        }
      }
      for (const input of detailInputs) {
        let returned: unknown = "SENTINEL";
        let error: unknown = null;
        try {
          returned = discordHeroRuneEffectDetail(
            indexes,
            REPRESENTATIVE_OWNED_RUNES,
            input as never,
          );
        } catch (caught) {
          error = caught;
        }
        outcomes.push({
          returned,
          error,
          expectedMessage:
            "rune-effects detail input must not be a proxy or TOCTOU-capable object",
        });
      }
    } finally {
      Reflect.set(Array, "isArray", originalArrayIsArray);
    }

    expect(outcomes).toHaveLength(15);
    for (const { returned, error, expectedMessage } of outcomes) {
      expect(returned).toBe("SENTINEL");
      expect(Object.getPrototypeOf(error) === Error.prototype).toBe(true);
      expect(error instanceof TypeError).toBe(false);
      expect((error as Error).message).toBe(expectedMessage);
      expectDiscordSafePlainText((error as Error).message);
    }
    expect(hostileArrayChecks).toBe(0);
    expect(trapCounts).toEqual({
      apply: 0,
      construct: 0,
      defineProperty: 0,
      deleteProperty: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      isExtensible: 0,
      ownKeys: 0,
      preventExtensions: 0,
      set: 0,
      setPrototypeOf: 0,
    });
    expect(bodyCounts).toEqual({ page: 0, detail: 0 });
    expect(
      discordHeroRuneEffectsPage(
        indexes,
        REPRESENTATIVE_OWNED_RUNES,
        ordinaryPageInput,
      ),
    ).toEqual(ordinaryPageBefore);
    expect(
      discordHeroRuneEffectsTextRows(
        indexes,
        REPRESENTATIVE_OWNED_RUNES,
        ordinaryPageInput,
      ),
    ).toEqual(ordinaryTextBefore);
    expect(
      discordHeroRuneEffectDetail(
        indexes,
        REPRESENTATIVE_OWNED_RUNES,
        ordinaryDetailInput,
      ),
    ).toEqual(ordinaryDetailBefore);
    expect([
      Object.getOwnPropertyDescriptors(ordinaryPageInput),
      Object.getOwnPropertyDescriptors(ordinaryDetailInput),
    ]).toEqual(ordinaryInputsBefore);
  });

  test("snapshots only canonical exact-own ownership arrays and entries", () => {
    let accessorReads = 0;
    const accessorEntry: Record<string, unknown> = { level: 1 };
    Object.defineProperty(accessorEntry, "key", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 1;
      },
    });
    const symbolEntry = {
      key: 1,
      level: 1,
      [Symbol("state")]: true,
    };
    const prototypeEntry = Object.assign(Object.create({ inherited: true }), {
      key: 1,
      level: 1,
    });
    const arrayWithSymbol = [{ key: 1, level: 1 }];
    (arrayWithSymbol as Array<OwnedRune> & Record<symbol, unknown>)[
      Symbol("rng")
    ] = true;
    const sparse = new Array<OwnedRune>(1);

    for (const ownedRunes of [
      [accessorEntry],
      [symbolEntry],
      [prototypeEntry],
      [{ key: 1, level: 1, heroLevel: 99 }],
      arrayWithSymbol,
      sparse,
    ]) {
      expect(() =>
        projectDiscordHeroRuneEffectsBrowser(
          indexes,
          ownedRunes as readonly OwnedRune[],
        ),
      ).toThrow();
    }
    expect(accessorReads).toBe(0);
  });

  test("returns deterministic deeply frozen detached rows without mutating source snapshots", () => {
    const ownedRunes: Array<{ key: number; level: number }> =
      REPRESENTATIVE_OWNED_RUNES.map((entry) => ({ ...entry }));
    const forged = withRuneLevelStatType(1, 1, "DetachedSourceStat");
    const ownedBefore = JSON.stringify(ownedRunes);
    const rowBefore = { ...forged.row };
    const first = discordHeroRuneEffectsPage(forged.indexes, ownedRunes, {
      page: 0,
    });
    const second = discordHeroRuneEffectsPage(forged.indexes, ownedRunes, {
      page: 0,
    });
    const detail = discordHeroRuneEffectDetail(forged.indexes, ownedRunes, {
      rowIndex: 0,
      runeKey: 1,
      sourceLevel: 1,
    });

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.rows).not.toBe(second.rows);
    expect(first.rows[0]).not.toBe(second.rows[0]);
    expectDeeplyFrozen(first);
    expectDeeplyFrozen(detail);
    expect(JSON.stringify(ownedRunes)).toBe(ownedBefore);
    expect(forged.row).toEqual(rowBefore);

    ownedRunes[0]!.level = 99;
    (forged.row as { STATTYPE: string }).STATTYPE = "MutatedAfterProjection";
    expect(first.rows[0]!.effect.ownedLevel).toBe(1);
    expect(first.rows[0]!.effect.statType).toBe("DetachedSourceStat");
    expect(Reflect.set(first.rows[0]!.effect, "rawValue", 999)).toBe(false);
  });

  // HIGH/MAJOR regression: an oversized dense Array used to reach
  // Reflect.ownKeys before the canonical cap. A deterministic trap is the
  // resource discriminator here: timing alone would let the same proportional
  // enumeration regress on a faster machine.
  test("rejects oversized dense and sparse ownership before enumeration or index inspection", () => {
    const dense = new Array<OwnedRune>(50_000).fill(
      Object.freeze({ key: 1, level: 1 }),
    );
    const sparse: OwnedRune[] = [];
    sparse.length = 5_000_000;
    let indexGetterReads = 0;
    Object.defineProperty(sparse, "0", {
      enumerable: true,
      configurable: true,
      get() {
        indexGetterReads += 1;
        return { key: 1, level: 1 };
      },
    });

    const hostileInputs = new Set<object>([dense, sparse]);
    const originalReflectOwnKeys = Reflect.ownKeys;
    const originalObjectKeys = Object.keys;
    const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
    const originalGetOwnPropertySymbols = Object.getOwnPropertySymbols;
    const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const descriptorsBefore = [dense, sparse].map((value) => ({
      length: originalGetOwnPropertyDescriptor(value, "length"),
      zero: originalGetOwnPropertyDescriptor(value, "0"),
    }));
    const resourceAttempts: string[] = [];
    let indexDescriptorReads = 0;

    const rejectEnumeration = (operation: string): never => {
      resourceAttempts.push(operation);
      throw new Error(`resource discriminator: ${operation}`);
    };

    Reflect.set(Reflect, "ownKeys", (value: object) => {
      if (hostileInputs.has(value)) return rejectEnumeration("Reflect.ownKeys");
      return originalReflectOwnKeys(value);
    });
    Reflect.set(Object, "keys", (value: object) => {
      if (hostileInputs.has(value)) return rejectEnumeration("Object.keys");
      return originalObjectKeys(value);
    });
    Reflect.set(Object, "getOwnPropertyNames", (value: object) => {
      if (hostileInputs.has(value)) {
        return rejectEnumeration("Object.getOwnPropertyNames");
      }
      return originalGetOwnPropertyNames(value);
    });
    Reflect.set(Object, "getOwnPropertySymbols", (value: object) => {
      if (hostileInputs.has(value)) {
        return rejectEnumeration("Object.getOwnPropertySymbols");
      }
      return originalGetOwnPropertySymbols(value);
    });
    Reflect.set(
      Object,
      "getOwnPropertyDescriptor",
      (value: object, key: PropertyKey) => {
        if (hostileInputs.has(value) && key !== "length") {
          indexDescriptorReads += 1;
          return rejectEnumeration(
            `Object.getOwnPropertyDescriptor(${String(key)})`,
          );
        }
        return originalGetOwnPropertyDescriptor(value, key);
      },
    );

    const messages: string[] = [];
    try {
      for (const hostile of [dense, sparse]) {
        messages.push(
          errorMessage(() =>
            projectDiscordHeroRuneEffectsBrowser(
              indexes,
              hostile as readonly OwnedRune[],
            ),
          ),
        );
      }
    } finally {
      Reflect.set(Reflect, "ownKeys", originalReflectOwnKeys);
      Reflect.set(Object, "keys", originalObjectKeys);
      Reflect.set(Object, "getOwnPropertyNames", originalGetOwnPropertyNames);
      Reflect.set(
        Object,
        "getOwnPropertySymbols",
        originalGetOwnPropertySymbols,
      );
      Reflect.set(
        Object,
        "getOwnPropertyDescriptor",
        originalGetOwnPropertyDescriptor,
      );
    }

    expect(messages).toEqual([
      "ownedRunes must not exceed the canonical 197 source rune nodes; received 50000",
      "ownedRunes must not exceed the canonical 197 source rune nodes; received 5000000",
    ]);
    expect(resourceAttempts).toEqual([]);
    expect(indexDescriptorReads).toBe(0);
    expect(indexGetterReads).toBe(0);
    expect(
      [dense, sparse].map((value) => ({
        length: Object.getOwnPropertyDescriptor(value, "length"),
        zero: Object.getOwnPropertyDescriptor(value, "0"),
      })),
    ).toEqual(descriptorsBefore);
  });

  // Break caught: the cap moved after Array.from/Set materialization. These
  // guards reject every such call during the oversized-input decision,
  // including error formatting, so the cap cannot move while the test stays
  // green.
  test("rejects oversized dense and sparse ownership before Array.from or Set materialization", () => {
    const dense = new Array<OwnedRune>(50_000).fill(
      Object.freeze({ key: 1, level: 1 }),
    );
    const sparse: OwnedRune[] = [];
    sparse.length = 5_000_000;
    const hostileInputs = [dense, sparse] as const;
    const originalArrayFrom = Array.from;
    const OriginalSet = globalThis.Set;
    const resourceAttempts: string[] = [];

    Reflect.set(Array, "from", () => {
      resourceAttempts.push("Array.from before oversized rejection");
      throw new Error(
        "resource discriminator: Array.from before oversized rejection",
      );
    });
    Reflect.set(
      globalThis,
      "Set",
      new Proxy(OriginalSet, {
        construct(target, args, newTarget) {
          resourceAttempts.push("Set before oversized rejection");
          throw new Error(
            "resource discriminator: Set before oversized rejection",
          );
        },
      }),
    );

    const messages: string[] = [];
    const heapBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    try {
      for (const hostile of hostileInputs) {
        let thrown: unknown;
        try {
          projectDiscordHeroRuneEffectsBrowser(indexes, hostile);
        } catch (error) {
          thrown = error;
        }
        messages.push(
          thrown instanceof Error
            ? thrown.message
            : `non-Error outcome: ${String(thrown)}`,
        );
      }
    } finally {
      Reflect.set(Array, "from", originalArrayFrom);
      Reflect.set(globalThis, "Set", OriginalSet);
    }
    const elapsedMs = performance.now() - startedAt;
    const heapGrowthBytes = process.memoryUsage().heapUsed - heapBefore;

    expect(
      messages,
      "outcome discriminator: exact dense/sparse canonical-cap errors",
    ).toEqual([
      "ownedRunes must not exceed the canonical 197 source rune nodes; received 50000",
      "ownedRunes must not exceed the canonical 197 source rune nodes; received 5000000",
    ]);
    expect(
      resourceAttempts,
      "resource discriminator: no Array.from or Set before oversized rejection",
    ).toEqual([]);
    expect(
      elapsedMs,
      "bounded-time outcome: constant-work rejection",
    ).toBeLessThan(1_000);
    expect(
      heapGrowthBytes,
      "bounded-memory outcome: no length-proportional materialization",
    ).toBeLessThan(16 * 1024 * 1024);
  });

  test("rejects ownership proxies before invoking any proxy trap", () => {
    const trapAttempts: string[] = [];
    const proxied = new Proxy([{ key: 1, level: 1 }], {
      get() {
        trapAttempts.push("get");
        throw new Error("resource discriminator: proxy get trap");
      },
      getOwnPropertyDescriptor() {
        trapAttempts.push("getOwnPropertyDescriptor");
        throw new Error(
          "resource discriminator: proxy getOwnPropertyDescriptor trap",
        );
      },
      getPrototypeOf() {
        trapAttempts.push("getPrototypeOf");
        throw new Error("resource discriminator: proxy getPrototypeOf trap");
      },
      ownKeys() {
        trapAttempts.push("ownKeys");
        throw new Error("resource discriminator: proxy ownKeys trap");
      },
    });

    expect(
      errorMessage(() =>
        projectDiscordHeroRuneEffectsBrowser(indexes, proxied),
      ),
    ).toBe("ownedRunes must not be a proxy or TOCTOU-capable object");
    expect(trapAttempts).toEqual([]);
  });

  // Break caught: an off-by-one cap. 197 is the canonical rune-node ceiling and
  // must remain accepted; 198 must be rejected.
  test("accepts exactly 197 owned runes and rejects 198", () => {
    const maximum = allRunesAtMaximum();
    expect(maximum).toHaveLength(197);
    expect(
      projectDiscordHeroRuneEffectsBrowser(indexes, maximum).effectCount,
    ).toBe(658);

    const overByOne = [...maximum, { key: maximum[0]!.key, level: 1 }];
    expect(overByOne).toHaveLength(198);
    let thrown: unknown;
    try {
      projectDiscordHeroRuneEffectsBrowser(indexes, overByOne);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    // Assert the UI cap's own wording, not merely any message containing 197:
    // the downstream domain guard also mentions 197, so a cap set to 198 here
    // would still "pass" a looser assertion while leaving the allocation open.
    expect(
      (thrown as Error).message,
      "outcome discriminator: 198 is rejected by the UI canonical cap",
    ).toBe(
      "ownedRunes must not exceed the canonical 197 source rune nodes; received 198",
    );
  });
});
