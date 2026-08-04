import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  projectEquippedGearItemEffects,
  type EquippedGearItemEffectsInput,
} from "../domain/item-effects";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import { sourceIntervalCandidates } from "../domain/items";
import type { GearAsset, PlayerState } from "../domain/player";

const ITEM_EFFECTS_UI_MODULE = "./item-effects";

type ItemEffectsUiModule = typeof import("./item-effects");

let indexes: DiscordHeroCatalogIndexes;
let ui: ItemEffectsUiModule;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
  ui = (await import(ITEM_EFFECTS_UI_MODULE)) as ItemEffectsUiModule;
});

function heroKeyForItem(
  sourceIndexes: DiscordHeroCatalogIndexes,
  itemKey: number,
): number {
  const item = sourceIndexes.tables.items.groups.get(itemKey)?.[0];
  if (item?.type !== "GEAR" || item.gear === null) {
    throw new Error(`test item ${itemKey} must be gear`);
  }
  return (
    sourceIndexes.tables.heroes.rows.find(
      (hero) =>
        hero.MainWeaponGearType === item.gear ||
        hero.SubWeaponGearType === item.gear,
    )?.HeroKey ?? 101
  );
}

function equippedState(
  sourceIndexes: DiscordHeroCatalogIndexes,
  itemKey: number,
  instanceId: string,
  rolledStats: GearAsset["rolledStats"] = [],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(sourceIndexes, 101);
  const item = sourceIndexes.tables.items.groups.get(itemKey)?.[0];
  if (item?.type !== "GEAR" || item.gear === null) {
    throw new Error(`test item ${itemKey} must be gear`);
  }
  const heroKey = heroKeyForItem(sourceIndexes, itemKey);
  let hero = state.heroes.find((candidate) => candidate.heroKey === heroKey);
  if (hero === undefined) {
    hero = {
      heroKey,
      level: 1,
      xp: 0,
      attributes: [],
      skills: [],
      passives: [],
      equipment: [],
      skins: [],
    };
    state.heroes.push(hero);
  }
  hero.equipment.push({
    slot: item.gear,
    asset: {
      kind: "gear",
      instanceId,
      itemKey,
      rolledStats: [...rolledStats],
    },
  });
  return state;
}

function projectionInput(
  sourceIndexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  itemKey: number,
  instanceId: string,
): EquippedGearItemEffectsInput {
  return {
    indexes: sourceIndexes,
    state,
    heroKey: heroKeyForItem(sourceIndexes, itemKey),
    instanceId,
  };
}

function withRows<Name extends DiscordHeroDatasetName>(
  source: DiscordHeroCatalogIndexes,
  name: Name,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const table = source.tables[name];
  const rows = table.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  const groups = new Map<unknown, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = row[table.primaryField];
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: {
        ...table,
        rows,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function allReachableRolledStats(): GearAsset["rolledStats"] {
  return [...indexes.tables.stat_mods.groups]
    .sort(([left], [right]) => left - right)
    .map(([statModKey, rows]) => ({
      statModKey,
      value: sourceIntervalCandidates(rows[0]!)[0]!,
    }));
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectDeeplyFrozen(descriptor.value);
    }
  }
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected operation to fail");
}

describe("DiscordHero equipped Item effects browser", () => {
  test("keeps base, inherent, and rolled source vectors separate and source-exact", () => {
    const state = equippedState(indexes, 301011, "exact-ui-sword", [
      { statModKey: 100102, value: 10 },
      { statModKey: 100201, value: 40 },
      { statModKey: 100401, value: 10 },
      { statModKey: 101701, value: 25 },
    ]);
    const input = projectionInput(indexes, state, 301011, "exact-ui-sword");
    const source = projectEquippedGearItemEffects(input);

    const browser = ui.projectDiscordHeroItemEffectsBrowser(input);
    const pages = ui.DISCORD_HERO_ITEM_EFFECT_SOURCE_VECTORS.map(
      (sourceVector) =>
        ui.discordHeroItemEffectsPage(input, { sourceVector, page: 0 }),
    );
    const rows = pages.flatMap((page) => page.rows);

    expect(browser).toMatchObject({
      source: "Item",
      heroKey: 101,
      instanceId: "exact-ui-sword",
      itemKey: 301011,
      gearType: "SWORD",
      itemLevel: 1,
      vectors: [
        { sourceVector: "base", rowCount: 2, pageCount: 1 },
        { sourceVector: "inherent", rowCount: 1, pageCount: 1 },
        { sourceVector: "rolled", rowCount: 4, pageCount: 1 },
      ],
      oracleGates: [],
      oracleTextRows: [],
    });
    expect(rows.map((row) => row.effect)).toEqual([...source.effects]);
    expect(rows.map((row) => row.sourceVector)).toEqual([
      "base",
      "base",
      "inherent",
      "rolled",
      "rolled",
      "rolled",
      "rolled",
    ]);
    expect(
      pages[0]!.rows.map(({ effect }) => [
        effect.statType,
        effect.modifierType,
        effect.rawValue,
        effect.unit,
        effect.provenance.kind,
      ]),
    ).toEqual([
      ["AttackDamage", "FLAT", 2, "RAW", "gear-base"],
      ["AttackSpeed", "FLAT", 10, "RAW", "gear-base"],
    ]);
    expect(pages[2]!.rows[0]!.effect.provenance).toEqual({
      kind: "rolled-stat",
      statePath: "heroes[0].equipment[0].asset.rolledStats[0]",
      table: "stat_mods",
      statModKey: 100102,
      storedValue: 10,
      sourceRows: [
        { tier: 1, minRawValue: 50, maxRawValue: 100, interval: 10 },
        { tier: 2, minRawValue: 100, maxRawValue: 150, interval: 10 },
      ],
    });
    expect(Reflect.ownKeys(rows[0]!)).toEqual([
      "sourceVector",
      "rowIndex",
      "effect",
    ]);
    expect(JSON.stringify({ browser, pages }).toLowerCase()).not.toContain(
      "dps",
    );
    expect(JSON.stringify({ browser, pages }).toLowerCase()).not.toContain(
      "total",
    );

    const detail = ui.discordHeroItemEffectsDetail(input, {
      sourceVector: "rolled",
      rowIndex: 0,
    });
    expect(detail).toEqual(pages[2]!.rows[0]);
    expect(detail).not.toBe(pages[2]!.rows[0]);
    expect(detail.effect).not.toBe(pages[2]!.rows[0]!.effect);
    expect(
      ui.discordHeroItemEffectsTextRows(input, {
        sourceVector: "rolled",
        page: 0,
      }),
    ).toEqual([
      "#0 rolled · AttackDamage/ADDITIVE · raw 100 RAW_PER_THOUSAND · [stat-modifier]",
      "#1 rolled · AttackSpeed/ADDITIVE · raw 40 RAW_PER_THOUSAND · [stat-modifier]",
      "#2 rolled · CriticalDamage/FLAT · raw 100 RAW · [stat-modifier]",
      "#3 rolled · BlockChance/FLAT · raw 25 RAW · [unsupported-source] · BlockChance application requires the unresolved combat oracle",
    ]);
  });

  test("paginates the 62 reachable unique rolled sources as 25, 25, and 12 without a fixed page cap", () => {
    expect(ui.DISCORD_HERO_ITEM_EFFECTS_PAGE_SIZE).toBeLessThanOrEqual(25);
    const allRolls = allReachableRolledStats();
    expect(allRolls).toHaveLength(62);

    for (const [count, expectedPages] of [
      [0, 1],
      [1, 1],
      [25, 1],
      [26, 2],
      [62, 3],
    ] as const) {
      const instanceId = `roll-boundary-${count}`;
      const state = equippedState(
        indexes,
        300001,
        instanceId,
        allRolls.slice(0, count),
      );
      const input = projectionInput(indexes, state, 300001, instanceId);
      expect(ui.discordHeroItemEffectsPageCount(input, "rolled")).toBe(
        expectedPages,
      );
    }

    const state = equippedState(
      indexes,
      300001,
      "all-reachable-rolls",
      allRolls,
    );
    const input = projectionInput(
      indexes,
      state,
      300001,
      "all-reachable-rolls",
    );
    const pages = [0, 1, 2].map((page) =>
      ui.discordHeroItemEffectsPage(input, {
        sourceVector: "rolled",
        page,
      }),
    );
    expect(pages.map(({ rows }) => rows.length)).toEqual([25, 25, 12]);
    expect(
      pages.flatMap(({ rows }) =>
        rows.map((row) =>
          row.effect.provenance.kind === "rolled-stat"
            ? row.effect.provenance.statModKey
            : null,
        ),
      ),
    ).toEqual(allRolls.map(({ statModKey }) => statModKey));
    expect(() =>
      ui.discordHeroItemEffectsPage(input, {
        sourceVector: "rolled",
        page: 3,
      }),
    ).toThrow("page 3 is outside 0-2");
  });

  test("preserves all 20 source gear categories including zero-base accessories", () => {
    const representatives = [
      ["SWORD", 300001, 2],
      ["BOW", 310001, 2],
      ["STAFF", 320001, 2],
      ["SCEPTER", 330001, 2],
      ["CROSSBOW", 340001, 2],
      ["AXE", 350001, 2],
      ["SHIELD", 400001, 1],
      ["ARROW", 410001, 1],
      ["ORB", 420001, 1],
      ["TOME", 430001, 1],
      ["BOLT", 440001, 1],
      ["HATCHET", 450001, 1],
      ["HELMET", 500001, 1],
      ["ARMOR", 510001, 1],
      ["GLOVES", 520001, 1],
      ["BOOTS", 530001, 1],
      ["AMULET", 601011, 0],
      ["EARING", 611011, 0],
      ["RING", 621011, 0],
      ["BRACER", 631011, 0],
    ] as const;

    expect(
      representatives.map(([gearType, itemKey, baseCount]) => {
        const instanceId = `ui-${gearType.toLowerCase()}`;
        const state = equippedState(indexes, itemKey, instanceId);
        const input = projectionInput(indexes, state, itemKey, instanceId);
        const browser = ui.projectDiscordHeroItemEffectsBrowser(input);
        return [
          browser.gearType,
          browser.vectors.find((vector) => vector.sourceVector === "base")!
            .rowCount,
          baseCount,
        ];
      }),
    ).toEqual(
      representatives.map(([gearType, _itemKey, baseCount]) => [
        gearType,
        baseCount,
        baseCount,
      ]),
    );
  });

  test("exposes unsupported-source rows and unique-mod oracle gates without applying them", () => {
    const shieldState = equippedState(indexes, 400001, "unsupported-shield");
    const shieldInput = projectionInput(
      indexes,
      shieldState,
      400001,
      "unsupported-shield",
    );
    expect(
      ui.discordHeroItemEffectsDetail(shieldInput, {
        sourceVector: "base",
        rowIndex: 0,
      }).effect,
    ).toEqual({
      kind: "unsupported-source",
      statType: "BlockChance",
      modifierType: "FLAT",
      rawValue: 50,
      unit: "RAW",
      reasons: [
        "BlockChance application requires the unresolved combat oracle",
      ],
      provenance: {
        kind: "gear-base",
        gearKey: 400001,
        gearType: "SHIELD",
        slot: 1,
        statTypeField: "BaseStat1_STATTYPE",
        modifierTypeField: "BaseStat1_MODTYPE",
        valueField: "BaseStat1_Value",
        sourceValue: 50,
      },
    });

    const uniqueState = equippedState(indexes, 309171, "unique-ui-sword");
    const uniqueInput = projectionInput(
      indexes,
      uniqueState,
      309171,
      "unique-ui-sword",
    );
    const browser = ui.projectDiscordHeroItemEffectsBrowser(uniqueInput);
    expect(browser.oracleGates).toEqual([
      {
        kind: "unique-mod",
        uniqueModKey: 10001,
        reason:
          "unique-mod runtime semantics are outside the source-proven stat projection",
      },
    ]);
    expect(browser.oracleTextRows).toEqual([
      "unique-mod 10001 · [oracle-required] · unique-mod runtime semantics are outside the source-proven stat projection",
    ]);
    expect(
      [browser, ...browser.vectors].some((value) =>
        Reflect.ownKeys(value).some((key) =>
          /applied|combat|dps|total/i.test(String(key)),
        ),
      ),
    ).toBe(false);
  });

  test("sanitizes only presentation text and truncates complete code points within 200 UTF-16 units", () => {
    const unsafeStatType =
      "@everyone <#123> `code`\u0000\u001f\u007f\u009f\u2028\u2029" +
      "😀".repeat(120) +
      "\ud800";
    const unsafeIndexes = withRows(indexes, "stat_mods", (rows) => {
      for (const row of rows) {
        if (row.StatModKey === 100101) row.STATTYPE = unsafeStatType;
      }
    });
    const state = equippedState(unsafeIndexes, 300001, "unsafe-ui-text", [
      { statModKey: 100101, value: 1 },
    ]);
    const input = projectionInput(
      unsafeIndexes,
      state,
      300001,
      "unsafe-ui-text",
    );

    const raw = ui.discordHeroItemEffectsDetail(input, {
      sourceVector: "rolled",
      rowIndex: 0,
    });
    const [text] = ui.discordHeroItemEffectsTextRows(input, {
      sourceVector: "rolled",
      page: 0,
    });

    expect(raw.effect.statType).toBe(unsafeStatType);
    if (raw.effect.kind !== "unsupported-source") {
      throw new Error("unsafe source must remain unsupported");
    }
    expect(raw.effect.reasons).toEqual([
      `unproven stat type ${unsafeStatType}`,
    ]);
    expect(text).toBeDefined();
    expect(text!.length).toBeLessThanOrEqual(200);
    expect(text!.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/[@`\u0000-\u001f\u007f-\u009f\u2028\u2029]/u);
    expect(text).not.toContain("<#");
    expect(
      Array.from(text!).some((codePoint) => {
        const value = codePoint.codePointAt(0)!;
        return value >= 0xd800 && value <= 0xdfff;
      }),
    ).toBe(false);
  });

  test("fails closed on empty, unknown, unowned, unequipped, and forged state before presentation", () => {
    const state = equippedState(indexes, 300001, "owned-ui-sword");
    const input = projectionInput(indexes, state, 300001, "owned-ui-sword");

    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({} as never),
    ).toThrow();
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        state: {},
      } as never),
    ).toThrow();
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        heroKey: 401,
      }),
    ).toThrow("hero 401 is not owned");
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        instanceId: "not-equipped",
      }),
    ).toThrow("found 0");
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        instanceId: "",
      }),
    ).toThrow("canonical stable instance ID");

    const forged = structuredClone(state);
    forged.heroes[0]!.equipment[0]!.asset.itemKey = 999_999;
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        state: forged,
      }),
    ).toThrow();
  });

  test("rejects prototypes, symbols, accessors, unknown fields, and hostile coercion before reading selectors", () => {
    const state = equippedState(indexes, 300001, "hardened-ui-sword");
    const input = projectionInput(indexes, state, 300001, "hardened-ui-sword");
    let accessorReads = 0;
    const accessorInput = {
      indexes,
      state,
      instanceId: "hardened-ui-sword",
    } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "heroKey", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 101;
      },
    });
    const accessorPage = { sourceVector: "base" } as Record<string, unknown>;
    Object.defineProperty(accessorPage, "page", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 0;
      },
    });
    const accessorDetail = {
      sourceVector: "base",
    } as Record<string, unknown>;
    Object.defineProperty(accessorDetail, "rowIndex", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 0;
      },
    });

    for (const run of [
      () => ui.projectDiscordHeroItemEffectsBrowser(accessorInput as never),
      () => ui.discordHeroItemEffectsPage(input, accessorPage as never),
      () => ui.discordHeroItemEffectsDetail(input, accessorDetail as never),
    ]) {
      expect(run).toThrow(/own data properties without accessors/i);
    }
    expect(accessorReads).toBe(0);

    const symbolInput = { ...input } as Record<string | symbol, unknown>;
    symbolInput[Symbol("forged")] = true;
    const symbolPage = {
      sourceVector: "base",
      page: 0,
      [Symbol("forged")]: true,
    };
    const symbolDetail = {
      sourceVector: "base",
      rowIndex: 0,
      [Symbol("forged")]: true,
    };
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser(symbolInput as never),
    ).toThrow(/symbol own keys/i);
    expect(() =>
      ui.discordHeroItemEffectsPage(input, symbolPage as never),
    ).toThrow(/symbol own keys/i);
    expect(() =>
      ui.discordHeroItemEffectsDetail(input, symbolDetail as never),
    ).toThrow(/symbol own keys/i);
    expect(() =>
      ui.discordHeroItemEffectsPage(input, {
        sourceVector: "base",
        page: 0,
        extra: true,
      } as never),
    ).toThrow(/unknown field extra/i);
    expect(() =>
      ui.discordHeroItemEffectsDetail(input, {
        sourceVector: "base",
        rowIndex: 0,
        extra: true,
      } as never),
    ).toThrow(/unknown field extra/i);
    expect(() =>
      ui.discordHeroItemEffectsPage(input, {
        sourceVector: "future",
        page: 0,
      } as never),
    ).toThrow(/known source vector string/i);
    expect(() =>
      ui.discordHeroItemEffectsDetail(input, {
        sourceVector: "future",
        rowIndex: 0,
      } as never),
    ).toThrow(/known source vector string/i);

    const inherited = Object.create({ forged: true }) as Record<
      string,
      unknown
    >;
    Object.assign(inherited, input);
    expect(() =>
      ui.projectDiscordHeroItemEffectsBrowser(inherited as never),
    ).toThrow(/prototype/i);
    expect(() =>
      ui.discordHeroItemEffectsPage(
        input,
        Object.assign(Object.create({ forged: true }), {
          sourceVector: "base",
          page: 0,
        }),
      ),
    ).toThrow(/prototype/i);
    expect(() =>
      ui.discordHeroItemEffectsDetail(
        input,
        Object.assign(Object.create({ forged: true }), {
          sourceVector: "base",
          rowIndex: 0,
        }),
      ),
    ).toThrow(/prototype/i);

    const unsafeField = "bad@everyone`field\u0000";
    const unsafeError = errorMessage(() =>
      ui.projectDiscordHeroItemEffectsBrowser({
        ...input,
        [unsafeField]: true,
      } as never),
    );
    expect(unsafeError).not.toMatch(/[@`\u0000]/u);
    expect(unsafeError).toContain("bad＠everyone'field ");

    let coercionCalls = 0;
    const hostile = {
      valueOf() {
        coercionCalls += 1;
        throw new Error("hostile coercion executed");
      },
      toString() {
        coercionCalls += 1;
        throw new Error("hostile coercion executed");
      },
    };
    expect(() =>
      ui.discordHeroItemEffectsPage(input, {
        sourceVector: "base",
        page: hostile,
      } as never),
    ).toThrow("non-negative safe integer");
    expect(() =>
      ui.discordHeroItemEffectsDetail(input, {
        sourceVector: "base",
        rowIndex: hostile,
      } as never),
    ).toThrow("non-negative safe integer");
    expect(coercionCalls).toBe(0);
  });

  test("snapshots each exact-own input field once without direct property reads", () => {
    function tracked<Value extends object>(value: Value) {
      let directReads = 0;
      const descriptorReads = new Map<PropertyKey, number>();
      return {
        proxy: new Proxy(value, {
          get() {
            directReads += 1;
            throw new Error("direct property read escaped the snapshot");
          },
          getOwnPropertyDescriptor(target, key) {
            descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1);
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        }),
        descriptorReads,
        directReads: () => directReads,
      };
    }

    const state = equippedState(indexes, 300001, "single-read-ui");
    const input = tracked(
      projectionInput(indexes, state, 300001, "single-read-ui"),
    );
    const page = tracked({ sourceVector: "base" as const, page: 0 });
    const detail = tracked({ sourceVector: "base" as const, rowIndex: 0 });

    ui.projectDiscordHeroItemEffectsBrowser(input.proxy);
    ui.discordHeroItemEffectsPage(
      projectionInput(indexes, state, 300001, "single-read-ui"),
      page.proxy,
    );
    ui.discordHeroItemEffectsDetail(
      projectionInput(indexes, state, 300001, "single-read-ui"),
      detail.proxy,
    );

    expect(input.directReads()).toBe(0);
    expect(page.directReads()).toBe(0);
    expect(detail.directReads()).toBe(0);
    expect([...input.descriptorReads.values()]).toEqual([1, 1, 1, 1]);
    expect([...page.descriptorReads.values()]).toEqual([1, 1]);
    expect([...detail.descriptorReads.values()]).toEqual([1, 1]);
  });

  test("returns detached deeply frozen values without RNG, Date, input mutation, or shared reads", () => {
    const mutableIndexes = withRows(indexes, "gear", () => {});
    const state = equippedState(mutableIndexes, 301011, "pure-ui-sword", [
      { statModKey: 100102, value: 10 },
    ]);
    const input = projectionInput(
      mutableIndexes,
      state,
      301011,
      "pure-ui-sword",
    );
    const stateBefore = JSON.stringify(state);
    const rowsBefore = JSON.stringify(mutableIndexes.tables.gear.rows);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error("item-effects UI used RNG");
    };
    Date.now = () => {
      throw new Error("item-effects UI used Date");
    };

    let browser: ReturnType<
      ItemEffectsUiModule["projectDiscordHeroItemEffectsBrowser"]
    >;
    let page: ReturnType<ItemEffectsUiModule["discordHeroItemEffectsPage"]>;
    let detail: ReturnType<ItemEffectsUiModule["discordHeroItemEffectsDetail"]>;
    let textRows: ReturnType<
      ItemEffectsUiModule["discordHeroItemEffectsTextRows"]
    >;
    try {
      browser = ui.projectDiscordHeroItemEffectsBrowser(input);
      page = ui.discordHeroItemEffectsPage(input, {
        sourceVector: "rolled",
        page: 0,
      });
      detail = ui.discordHeroItemEffectsDetail(input, {
        sourceVector: "rolled",
        rowIndex: 0,
      });
      textRows = ui.discordHeroItemEffectsTextRows(input, {
        sourceVector: "rolled",
        page: 0,
      });
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }

    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(mutableIndexes.tables.gear.rows)).toBe(rowsBefore);
    expectDeeplyFrozen(browser!);
    expectDeeplyFrozen(page!);
    expectDeeplyFrozen(detail!);
    expectDeeplyFrozen(textRows!);

    const secondPage = ui.discordHeroItemEffectsPage(input, {
      sourceVector: "rolled",
      page: 0,
    });
    expect(secondPage).not.toBe(page!);
    expect(secondPage.rows[0]).not.toBe(page!.rows[0]);
    expect(secondPage.rows[0]!.effect).not.toBe(page!.rows[0]!.effect);

    state.heroes[0]!.equipment[0]!.asset.rolledStats[0]!.value = 15;
    (
      mutableIndexes.tables.gear.rows.find((row) => row.GearKey === 301011) as {
        BaseStat1_Value: number;
      }
    ).BaseStat1_Value = 999;
    expect(page!.rows[0]!.effect.rawValue).toBe(100);
    expect(detail!.effect.rawValue).toBe(100);
    expect(browser!.vectors).toEqual([
      { sourceVector: "base", rowCount: 2, pageCount: 1 },
      { sourceVector: "inherent", rowCount: 1, pageCount: 1 },
      { sourceVector: "rolled", rowCount: 1, pageCount: 1 },
    ]);
  });
});
