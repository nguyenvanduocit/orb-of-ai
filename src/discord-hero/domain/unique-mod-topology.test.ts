import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  projectSourceUniqueModTopology,
  type UniqueModTopology,
} from "./unique-mod-topology";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TypeError);
    return (error as Error).message;
  }
  throw new Error("expected operation to reject");
}

interface ProxyTrapCounts {
  apply: number;
  get: number;
  getOwnPropertyDescriptor: number;
  getPrototypeOf: number;
  has: number;
  ownKeys: number;
  set: number;
  callerCode: number;
}

function trackedProxy<T extends object>(
  target: T,
  forgeGet?: (
    property: PropertyKey,
  ) =>
    | { readonly handled: true; readonly value: unknown }
    | { readonly handled: false },
): { proxy: T; traps: ProxyTrapCounts } {
  const traps: ProxyTrapCounts = {
    apply: 0,
    get: 0,
    getOwnPropertyDescriptor: 0,
    getPrototypeOf: 0,
    has: 0,
    ownKeys: 0,
    set: 0,
    callerCode: 0,
  };
  return {
    proxy: new Proxy(target, {
      apply(current, thisArg, argumentsList) {
        traps.apply += 1;
        traps.callerCode += 1;
        return Reflect.apply(current as never, thisArg, argumentsList);
      },
      get(current, property, receiver) {
        traps.get += 1;
        traps.callerCode += 1;
        const forged = forgeGet?.(property);
        if (forged?.handled === true) return forged.value;
        return Reflect.get(current, property, receiver);
      },
      getOwnPropertyDescriptor(current, property) {
        traps.getOwnPropertyDescriptor += 1;
        traps.callerCode += 1;
        return Reflect.getOwnPropertyDescriptor(current, property);
      },
      getPrototypeOf(current) {
        traps.getPrototypeOf += 1;
        traps.callerCode += 1;
        return Reflect.getPrototypeOf(current);
      },
      has(current, property) {
        traps.has += 1;
        traps.callerCode += 1;
        return Reflect.has(current, property);
      },
      ownKeys(current) {
        traps.ownKeys += 1;
        traps.callerCode += 1;
        return Reflect.ownKeys(current);
      },
      set(current, property, value, receiver) {
        traps.set += 1;
        traps.callerCode += 1;
        return Reflect.set(current, property, value, receiver);
      },
    }),
    traps,
  };
}

function rebuildGroupsFromRows(
  rows: readonly Record<string, unknown>[],
  primary: string,
): Map<number | string, Record<string, unknown>[]> {
  const groups = new Map<number | string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = row[primary] as number | string;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return groups;
}

function withGearRows(
  source: DiscordHeroCatalogIndexes,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables.gear.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      gear: {
        ...source.tables.gear,
        rows,
        groups: rebuildGroupsFromRows(rows, "GearKey"),
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withUniqueModRows(
  source: DiscordHeroCatalogIndexes,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables.unique_mods.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      unique_mods: {
        ...source.tables.unique_mods,
        rows,
        groups: rebuildGroupsFromRows(rows, "UniqueModKey"),
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function forbiddenHits(text: string): string[] {
  const lower = text.toLowerCase();
  return [
    "applied",
    "eligible",
    "owned",
    "purchased",
    "inert",
    "runtime effect",
    "guaranteed",
  ].filter((token) => lower.includes(token));
}

/** Census derived from the SOURCE rows, never from the projection's output. */
function measureGearCensus(source: DiscordHeroCatalogIndexes): {
  nullCount: number;
  zeroCount: number;
  positiveCount: number;
  positiveKeys: Set<number>;
  tally: { nullCount: number; zeroCount: number; positiveCount: number };
} {
  let nullCount = 0;
  let zeroCount = 0;
  let positiveCount = 0;
  const positiveKeys = new Set<number>();
  for (const row of source.tables.gear.rows) {
    const key = row.UniqueModKey;
    if (key === null) nullCount += 1;
    else if (key === 0) zeroCount += 1;
    else {
      positiveCount += 1;
      positiveKeys.add(key as number);
    }
  }
  return {
    nullCount,
    zeroCount,
    positiveCount,
    positiveKeys,
    tally: { nullCount, zeroCount, positiveCount },
  };
}

function measureUniqueModSplit(source: DiscordHeroCatalogIndexes): {
  skill: number;
  nonSkill: number;
} {
  let skill = 0;
  for (const row of source.tables.unique_mods.rows) {
    if (String(row.UniqueMod).startsWith("Skill")) skill += 1;
  }
  return { skill, nonSkill: source.tables.unique_mods.rows.length - skill };
}

/** Replaces one table wholesale (rows / groups / name / primaryField). */
function withTable(
  source: DiscordHeroCatalogIndexes,
  name: "gear" | "unique_mods" | "skills",
  patch: Record<string, unknown>,
): DiscordHeroCatalogIndexes {
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: { ...source.tables[name], ...patch },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function gearRowsCopy(
  source: DiscordHeroCatalogIndexes,
): Record<string, unknown>[] {
  return source.tables.gear.rows.map((row) => ({ ...row })) as Record<
    string,
    unknown
  >[];
}

function uniqueModRowsCopy(
  source: DiscordHeroCatalogIndexes,
): Record<string, unknown>[] {
  return source.tables.unique_mods.rows.map((row) => ({ ...row })) as Record<
    string,
    unknown
  >[];
}

describe("DiscordHero source unique-mod topology", () => {
  test("projects 5760 gear relations with exact null/zero/positive UniqueModKey identity and 36 unique mods", () => {
    const topology = projectSourceUniqueModTopology({ indexes });

    // `counts` is emitted from module constants, so comparing it to another
    // hardcoded literal proves nothing. Derive the census from the source rows
    // first and assert the reported counts against THAT, then pin the absolute
    // corpus separately. If the two ever disagree, counts is misreporting.
    const census = measureGearCensus(indexes);
    const measuredSplit = measureUniqueModSplit(indexes);
    // Widened to plain numbers on purpose: `counts` carries literal types, and
    // comparing literal against literal is what made this assertion vacuous.
    const reported: Record<string, number> = {
      gearRows: topology.counts.gearRows,
      uniqueModRows: topology.counts.uniqueModRows,
      uniqueModKeyNull: topology.counts.uniqueModKeyNull,
      uniqueModKeyZero: topology.counts.uniqueModKeyZero,
      uniqueModKeyPositive: topology.counts.uniqueModKeyPositive,
      positiveUniqueModKeysCovered:
        topology.counts.positiveUniqueModKeysCovered,
      skillPrefixedUniqueMods: topology.counts.skillPrefixedUniqueMods,
      nonSkillUniqueMods: topology.counts.nonSkillUniqueMods,
    };
    expect(reported).toEqual({
      gearRows: indexes.tables.gear.rows.length,
      uniqueModRows: indexes.tables.unique_mods.rows.length,
      uniqueModKeyNull: census.nullCount,
      uniqueModKeyZero: census.zeroCount,
      uniqueModKeyPositive: census.positiveCount,
      positiveUniqueModKeysCovered: census.positiveKeys.size,
      skillPrefixedUniqueMods: measuredSplit.skill,
      nonSkillUniqueMods: measuredSplit.nonSkill,
    });
    // absolute corpus pin, independent of the module's own constants
    expect({
      gear: indexes.tables.gear.rows.length,
      mods: indexes.tables.unique_mods.rows.length,
      ...census.tally,
      covered: census.positiveKeys.size,
      skill: measuredSplit.skill,
      nonSkill: measuredSplit.nonSkill,
    }).toEqual({
      gear: 5_760,
      mods: 36,
      nullCount: 5_612,
      zeroCount: 21,
      positiveCount: 127,
      covered: 36,
      skill: 19,
      nonSkill: 17,
    });
    expect(topology.gearRelations).toHaveLength(5_760);
    expect(topology.uniqueMods).toHaveLength(36);

    expect(topology.gearRelations.map((relation) => relation.gearKey)).toEqual(
      indexes.tables.gear.rows.map((row) => row.GearKey),
    );
    expect(
      topology.gearRelations.map((relation) => relation.uniqueModKey),
    ).toEqual(indexes.tables.gear.rows.map((row) => row.UniqueModKey));

    let nullCount = 0;
    let zeroCount = 0;
    let positiveCount = 0;
    const positiveKeys = new Set<number>();
    for (const relation of topology.gearRelations) {
      if (relation.identity === "null") {
        expect(relation.uniqueModKey).toBeNull();
        nullCount += 1;
      } else if (relation.identity === "zero") {
        expect(relation.uniqueModKey).toBe(0);
        zeroCount += 1;
      } else {
        expect(relation.identity).toBe("positive");
        expect(relation.uniqueModKey).toBeGreaterThan(0);
        positiveKeys.add(relation.uniqueModKey as number);
        positiveCount += 1;
      }
    }
    expect({ nullCount, zeroCount, positiveCount }).toEqual({
      nullCount: 5_612,
      zeroCount: 21,
      positiveCount: 127,
    });
    expect(positiveKeys.size).toBe(36);
    expect([...positiveKeys].sort((a, b) => a - b)).toEqual(
      [...topology.uniqueMods.map((mod) => mod.uniqueModKey)].sort(
        (a, b) => a - b,
      ),
    );

    expect(topology.uniqueMods.map((mod) => mod.uniqueModKey)).toEqual(
      indexes.tables.unique_mods.rows.map((row) => row.UniqueModKey),
    );
    expectDeeplyFrozen(topology);
  });

  test("emits full five-parameter vectors, Skill-prefixed Param1 skill links, and not-source-linked for the rest", () => {
    const topology = projectSourceUniqueModTopology({ indexes });
    const skillMods = topology.uniqueMods.filter((mod) =>
      mod.uniqueMod.startsWith("Skill"),
    );
    const otherMods = topology.uniqueMods.filter(
      (mod) => !mod.uniqueMod.startsWith("Skill"),
    );
    expect(skillMods).toHaveLength(19);
    expect(otherMods).toHaveLength(17);

    for (const [index, source] of indexes.tables.unique_mods.rows.entries()) {
      const mod = topology.uniqueMods[index]!;
      expect(mod.rowIndex).toBe(index);
      expect(mod.uniqueModKey).toBe(source.UniqueModKey);
      expect(mod.uniqueMod).toBe(source.UniqueMod);
      expect(mod.parameters).toEqual({
        param1: {
          exchangeType: source.Param1ExchangeType,
          value: source.Param1,
        },
        param2: {
          exchangeType: source.Param2ExchangeType,
          value: source.Param2,
        },
        param3: {
          exchangeType: source.Param3ExchangeType,
          value: source.Param3,
        },
        param4: {
          exchangeType: source.Param4ExchangeType,
          value: source.Param4,
        },
        param5: {
          exchangeType: source.Param5ExchangeType,
          value: source.Param5,
        },
      });
      expect(mod.provenance).toEqual({
        table: "unique_mods",
        primaryField: "UniqueModKey",
        rowIndex: index,
      });

      if (source.UniqueMod.startsWith("Skill")) {
        expect(typeof source.Param1).toBe("number");
        expect(mod.skillParam1).toEqual({
          kind: "resolved-skill",
          skillKey: source.Param1 as number,
          sourceField: "Param1",
          ruleId: "unique_mods.Param1[Skill*]->skills",
        });
      } else {
        expect(mod.skillParam1).toEqual({
          kind: "not-source-linked",
          reason:
            "UniqueMod does not use the Skill-prefixed source skill relation",
        });
      }
    }

    const serialized = JSON.stringify(topology).toLowerCase();
    expect(forbiddenHits(serialized)).toEqual([]);
  });

  test("returns detached frozen projections and leaves input unchanged without RNG/time", () => {
    let randomCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    const originalNow = Date.now;
    let dateCalls = 0;
    Date.now = () => {
      dateCalls += 1;
      return 0;
    };
    try {
      const input = { indexes };
      const before = JSON.stringify({
        gear: indexes.tables.gear.rows.length,
        unique: indexes.tables.unique_mods.rows.length,
        firstGear: indexes.tables.gear.rows[0]!.UniqueModKey,
      });
      const first = projectSourceUniqueModTopology(input);
      const second = projectSourceUniqueModTopology(input);
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
      expect(first.gearRelations[0]).not.toBe(
        indexes.tables.gear.rows[0] as unknown,
      );
      expect(first.uniqueMods[0]).not.toBe(
        indexes.tables.unique_mods.rows[0] as unknown,
      );
      expect(
        JSON.stringify({
          gear: indexes.tables.gear.rows.length,
          unique: indexes.tables.unique_mods.rows.length,
          firstGear: indexes.tables.gear.rows[0]!.UniqueModKey,
        }),
      ).toBe(before);
      expect(() => {
        (first.gearRelations as unknown as unknown[]).push({});
      }).toThrow(TypeError);
      expect(randomCalls).toBe(0);
      expect(dateCalls).toBe(0);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
  });

  test("fails closed on exact-own, prototype, accessor, symbol, and one-read UniqueModKey TOCTOU", () => {
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: {
            ...indexes,
            tables: Object.assign(
              Object.create({ hostile: true }),
              indexes.tables,
            ),
          } as never,
        }),
      ),
    ).toMatch(/prototype|own data|accessor/i);

    const withSymbol = { indexes: { ...indexes } } as Record<
      string | symbol,
      unknown
    >;
    (withSymbol.indexes as Record<string | symbol, unknown>)[Symbol("x")] =
      true;
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology(
          withSymbol as unknown as { indexes: DiscordHeroCatalogIndexes },
        ),
      ),
    ).toMatch(/symbol|own|field|prototype/i);

    let tablesReads = 0;
    const host = { ...indexes };
    const realTables = indexes.tables;
    Object.defineProperty(host, "tables", {
      enumerable: true,
      configurable: true,
      get() {
        tablesReads += 1;
        return realTables;
      },
    });
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: host as unknown as DiscordHeroCatalogIndexes,
        }),
      ),
    ).toMatch(/own data property|accessor/i);
    // Exactly zero: the accessor is rejected from its descriptor, never invoked.
    expect(tablesReads).toBe(0);

    // One-read: an accessor row would answer null on the first read and a
    // forged positive key afterwards. The contract is stronger than "read it
    // once" - such a row is rejected outright from its descriptor, so the
    // getter never runs at all. Both halves below are reachable and exact.
    let reads = 0;
    const sourceGear = indexes.tables.gear.rows[0]!;
    const hostileGear = { ...sourceGear };
    Object.defineProperty(hostileGear, "UniqueModKey", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return reads === 1 ? null : 10001;
      },
    });
    const rows = indexes.tables.gear.rows.map((row, index) =>
      index === 0 ? hostileGear : { ...row },
    );
    const accessorIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        gear: {
          ...indexes.tables.gear,
          rows,
          groups: rebuildGroupsFromRows(
            rows as unknown as Record<string, unknown>[],
            "GearKey",
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    // Reachable and non-vacuous: assert the actual contract directly instead
    // of branching on it. A dead `if` branch would prove nothing.
    let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({ indexes: accessorIndexes });
      }),
    ).toMatch(/own data property|accessor/i);
    expect(escaped).toBe("SENTINEL");
    expect(reads).toBe(0);

    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes,
          applied: true,
        } as never),
      ),
    ).toMatch(/unknown field/i);
  });

  test("rejects Proxy gear rows before get traps can swap null and zero identities", () => {
    const rows = gearRowsCopy(indexes);
    const nullIndex = rows.findIndex((row) => row.UniqueModKey === null);
    const zeroIndex = rows.findIndex((row) => row.UniqueModKey === 0);
    expect(nullIndex).toBeGreaterThanOrEqual(0);
    expect(zeroIndex).toBeGreaterThanOrEqual(0);
    const nullTarget = rows[nullIndex]!;
    const zeroTarget = rows[zeroIndex]!;
    const before = JSON.stringify([nullTarget, zeroTarget]);
    const nullProxy = trackedProxy(nullTarget, (property) =>
      property === "UniqueModKey"
        ? { handled: true, value: 0 }
        : { handled: false },
    );
    const zeroProxy = trackedProxy(zeroTarget, (property) =>
      property === "UniqueModKey"
        ? { handled: true, value: null }
        : { handled: false },
    );
    rows[nullIndex] = nullProxy.proxy;
    rows[zeroIndex] = zeroProxy.proxy;

    let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({
          indexes: withTable(indexes, "gear", { rows }),
        });
      }),
    ).toMatch(/proxy/i);
    expect(escaped).toBe("SENTINEL");
    expect(nullProxy.traps).toEqual({
      apply: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
      set: 0,
      callerCode: 0,
    });
    expect(zeroProxy.traps).toEqual({
      apply: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
      set: 0,
      callerCode: 0,
    });
    expect(JSON.stringify([nullTarget, zeroTarget])).toBe(before);
  });

  test("rejects a reachable zero-identity Proxy gear row independently", () => {
    const rows = gearRowsCopy(indexes);
    const zeroIndex = rows.findIndex((row) => row.UniqueModKey === 0);
    expect(zeroIndex).toBeGreaterThanOrEqual(0);
    const target = rows[zeroIndex]!;
    const before = JSON.stringify(target);
    const hostile = trackedProxy(target, (property) =>
      property === "UniqueModKey"
        ? { handled: true, value: null }
        : { handled: false },
    );
    rows[zeroIndex] = hostile.proxy;

    let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({
          indexes: withTable(indexes, "gear", { rows }),
        });
      }),
    ).toMatch(/proxy/i);
    expect(escaped).toBe("SENTINEL");
    expect(hostile.traps).toEqual({
      apply: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
      set: 0,
      callerCode: 0,
    });
    expect(JSON.stringify(target)).toBe(before);
  });

  test("rejects Proxy unique_mods rows before get traps can forge raw vectors", () => {
    const rows = uniqueModRowsCopy(indexes);
    const target = rows.find(
      (row) =>
        row.UniqueMod === "ShieldChargeKillCooldown" && row.Param1 === null,
    )!;
    const before = JSON.stringify(target);
    const hostile = trackedProxy(target, (property) => {
      if (property === "UniqueMod") {
        return { handled: true, value: "ForgedButNonSkill" };
      }
      if (property === "Param1") return { handled: true, value: 999 };
      return { handled: false };
    });
    rows[rows.indexOf(target)] = hostile.proxy;

    let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({
          indexes: withTable(indexes, "unique_mods", { rows }),
        });
      }),
    ).toMatch(/proxy/i);
    expect(escaped).toBe("SENTINEL");
    expect(hostile.traps).toEqual({
      apply: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
      set: 0,
      callerCode: 0,
    });
    expect(JSON.stringify(target)).toBe(before);
  });

  test("rejects a Proxy skills row before metadata inspection", () => {
    const rows = indexes.tables.skills.rows.map((row) => ({ ...row }));
    const target = rows[0]!;
    const before = JSON.stringify(target);
    const hostile = trackedProxy(target, (property) =>
      property === "SkillKey"
        ? { handled: true, value: 9_999_999 }
        : { handled: false },
    );
    rows[0] = hostile.proxy;

    let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({
          indexes: withTable(indexes, "skills", { rows }),
        });
      }),
    ).toMatch(/proxy/i);
    expect(escaped).toBe("SENTINEL");
    expect(hostile.traps).toEqual({
      apply: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
      set: 0,
      callerCode: 0,
    });
    expect(JSON.stringify(target)).toBe(before);
  });

  test("rejects Proxy row arrays for gear, unique_mods, and skills before all traps", () => {
    for (const table of ["gear", "unique_mods", "skills"] as const) {
      const sourceRows = indexes.tables[table].rows;
      const before = JSON.stringify(sourceRows);
      const hostile = trackedProxy(sourceRows);
      let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
      expect(
        errorMessage(() => {
          escaped = projectSourceUniqueModTopology({
            indexes: withTable(indexes, table, { rows: hostile.proxy }),
          });
        }),
      ).toMatch(/proxy/i);
      expect(escaped).toBe("SENTINEL");
      expect(hostile.traps).toEqual({
        apply: 0,
        get: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
        has: 0,
        ownKeys: 0,
        set: 0,
        callerCode: 0,
      });
      expect(indexes.tables[table].rows).toBe(sourceRows);
      expect(JSON.stringify(sourceRows)).toBe(before);
    }
  });

  test("rejects symbol, non-enumerable, and enumerable extra catalog table keys", () => {
    const variants = [
      {
        label: "symbol",
        expected: /symbol own keys/i,
        add(tables: Record<PropertyKey, unknown>) {
          const key = Symbol("extra-table");
          tables[key] = indexes.tables.gear;
          return key;
        },
      },
      {
        label: "non-enumerable",
        expected: /unknown field hidden-extra-table/i,
        add(tables: Record<PropertyKey, unknown>) {
          Object.defineProperty(tables, "hidden-extra-table", {
            configurable: true,
            enumerable: false,
            value: indexes.tables.gear,
          });
          return "hidden-extra-table";
        },
      },
      {
        label: "enumerable",
        expected: /unknown field extra-table/i,
        add(tables: Record<PropertyKey, unknown>) {
          tables["extra-table"] = indexes.tables.gear;
          return "extra-table";
        },
      },
    ] as const;

    for (const variant of variants) {
      const tables = { ...indexes.tables } as Record<PropertyKey, unknown>;
      const extraKey = variant.add(tables);
      const beforeKeys = Reflect.ownKeys(tables);
      const beforeDescriptor = Object.getOwnPropertyDescriptor(
        tables,
        extraKey,
      );
      let escaped: UniqueModTopology | "SENTINEL" = "SENTINEL";
      expect(
        errorMessage(() => {
          escaped = projectSourceUniqueModTopology({
            indexes: { ...indexes, tables } as never,
          });
        }),
        variant.label,
      ).toMatch(variant.expected);
      expect(escaped, variant.label).toBe("SENTINEL");
      expect(Reflect.ownKeys(tables), variant.label).toEqual(beforeKeys);
      expect(
        Object.getOwnPropertyDescriptor(tables, extraKey),
        variant.label,
      ).toEqual(beforeDescriptor);
    }
  });

  test("fails closed on duplicate unique_mod keys, orphan positive gear refs, reorder, and reverse coverage", () => {
    const duplicate = withUniqueModRows(indexes, (rows) => {
      rows[1] = { ...rows[1]!, UniqueModKey: rows[0]!.UniqueModKey };
    });
    expect(() =>
      projectSourceUniqueModTopology({ indexes: duplicate }),
    ).toThrow(/unique|duplicate/i);

    const orphan = withGearRows(indexes, (rows) => {
      const target = rows.find((row) => row.UniqueModKey === null)!;
      target.UniqueModKey = 9_999_999;
    });
    expect(() => projectSourceUniqueModTopology({ indexes: orphan })).toThrow(
      /missing|orphan|unique_mods|9999999/i,
    );

    const reversedUnique = {
      ...indexes,
      tables: {
        ...indexes.tables,
        unique_mods: {
          ...indexes.tables.unique_mods,
          rows: [...indexes.tables.unique_mods.rows].reverse(),
          groups: rebuildGroupsFromRows(
            [...indexes.tables.unique_mods.rows]
              .reverse()
              .map((row) => ({ ...row })) as Record<string, unknown>[],
            "UniqueModKey",
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    // Source order is authoritative from rows array: reversed rows means reversed output keys.
    const reversedTopology = projectSourceUniqueModTopology({
      indexes: reversedUnique,
    });
    expect(reversedTopology.uniqueMods.map((mod) => mod.uniqueModKey)).toEqual(
      [...indexes.tables.unique_mods.rows]
        .reverse()
        .map((row) => row.UniqueModKey),
    );
    // Counts still hold (same multiset of positive gear refs).
    expect(reversedTopology.counts.uniqueModKeyPositive).toBe(127);
    expect(reversedTopology.counts.positiveUniqueModKeysCovered).toBe(36);

    // Reorder gear rows changes relation order to match source array (still 5760).
    const reorderedRows = [
      indexes.tables.gear.rows[1]!,
      indexes.tables.gear.rows[0]!,
      ...indexes.tables.gear.rows.slice(2),
    ];
    const reorderedIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        gear: {
          ...indexes.tables.gear,
          rows: reorderedRows,
          groups: rebuildGroupsFromRows(
            reorderedRows.map((row) => ({ ...row })) as Record<
              string,
              unknown
            >[],
            "GearKey",
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    const reorderedTopology = projectSourceUniqueModTopology({
      indexes: reorderedIndexes,
    });
    expect(reorderedTopology.gearRelations[0]!.gearKey).toBe(
      indexes.tables.gear.rows[1]!.GearKey,
    );
    expect(reorderedTopology.gearRelations[1]!.gearKey).toBe(
      indexes.tables.gear.rows[0]!.GearKey,
    );
    expect(reorderedTopology.counts.gearRows).toBe(5_760);
  });

  test("never claims applied/eligible/owned/purchased semantics in the projection surface", () => {
    const topology = projectSourceUniqueModTopology({ indexes });
    expect(topology).not.toHaveProperty("applied");
    expect(topology).not.toHaveProperty("eligible");
    expect(topology).not.toHaveProperty("owned");
    expect(topology).not.toHaveProperty("purchased");
    for (const mod of topology.uniqueMods) {
      expect(mod).not.toHaveProperty("effect");
      expect(mod).not.toHaveProperty("runtime");
      expect(
        mod.skillParam1.kind === "not-source-linked" ||
          mod.skillParam1.kind === "resolved-skill",
      ).toBe(true);
    }
    // Positive gear relations resolve to catalog unique mods only as identity refs.
    const positive = topology.gearRelations.filter(
      (relation) => relation.identity === "positive",
    );
    expect(positive).toHaveLength(127);
    for (const relation of positive) {
      expect(typeof relation.uniqueModKey).toBe("number");
      expect(relation.uniqueModKey).toBeGreaterThan(0);
      expect(relation.uniqueModResolution).toEqual({
        kind: "resolved",
        uniqueModKey: relation.uniqueModKey as number,
      });
    }
  });

  test("rejects hostile Proxy groups on gear, unique_mods, and skills with zero trap fire", () => {
    for (const tableName of ["gear", "unique_mods", "skills"] as const) {
      const traps = {
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        get: 0,
        has: 0,
        set: 0,
        apply: 0,
      };
      const target = indexes.tables[tableName].groups;
      const hostileGroups = new Proxy(target, {
        ownKeys(t) {
          traps.ownKeys += 1;
          return Reflect.ownKeys(t);
        },
        getOwnPropertyDescriptor(t, prop) {
          traps.getOwnPropertyDescriptor += 1;
          return Reflect.getOwnPropertyDescriptor(t, prop);
        },
        get(t, prop, receiver) {
          traps.get += 1;
          return Reflect.get(t, prop, receiver);
        },
        has(t, prop) {
          traps.has += 1;
          return Reflect.has(t, prop);
        },
        set(t, prop, value, receiver) {
          traps.set += 1;
          return Reflect.set(t, prop, value, receiver);
        },
        apply(t, thisArg, argArray) {
          traps.apply += 1;
          return Reflect.apply(t as never, thisArg, argArray);
        },
      });
      const hostileIndexes = {
        ...indexes,
        tables: {
          ...indexes.tables,
          [tableName]: {
            ...indexes.tables[tableName],
            groups: hostileGroups,
          },
        },
      } as unknown as DiscordHeroCatalogIndexes;

      let escaped: unknown = "SENTINEL";
      const message = errorMessage(() => {
        escaped = projectSourceUniqueModTopology({ indexes: hostileIndexes });
      });
      expect(message).toMatch(/proxy/i);
      expect(escaped).toBe("SENTINEL");
      expect(traps).toEqual({
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        get: 0,
        has: 0,
        set: 0,
        apply: 0,
      });
    }

    // Normal RuntimeReadonlyMap groups remain accepted (and ignored as authority).
    const healthy = projectSourceUniqueModTopology({ indexes });
    expect(healthy.counts.gearRows).toBe(5_760);
    expect(healthy.uniqueMods).toHaveLength(36);
  });
});

/**
 * Falsifiers: each case removes exactly one guarantee from the catalog and
 * requires the projection to reject it. If the corresponding runtime guard were
 * deleted, the matching case here stops throwing and this suite goes red -- so
 * every guard below is pinned by an independent, checked-in adversary rather
 * than by a hardcoded constant comparing to itself.
 */
describe("DiscordHero unique-mod topology guard falsifiers", () => {
  test("identity census: a single null flipped to zero is rejected, never misreported", () => {
    const rows = gearRowsCopy(indexes);
    const target = rows.findIndex((row) => row.UniqueModKey === null);
    expect(target).toBeGreaterThanOrEqual(0);
    rows[target]!.UniqueModKey = 0;

    // reality after the flip, derived independently
    const mutated = withTable(indexes, "gear", { rows });
    const census = measureGearCensus(mutated);
    expect(census.tally).toEqual({
      nullCount: 5_611,
      zeroCount: 22,
      positiveCount: 127,
    });

    // the projection must refuse rather than report the pinned 5612/21
    let escaped: unknown = "SENTINEL";
    expect(
      errorMessage(() => {
        escaped = projectSourceUniqueModTopology({ indexes: mutated });
      }),
    ).toMatch(/identity counts diverge/i);
    expect(escaped).toBe("SENTINEL");
  });

  test("identity census: a single zero flipped to null is rejected", () => {
    const rows = gearRowsCopy(indexes);
    const target = rows.findIndex((row) => row.UniqueModKey === 0);
    expect(target).toBeGreaterThanOrEqual(0);
    rows[target]!.UniqueModKey = null;
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "gear", { rows }),
        }),
      ),
    ).toMatch(/identity counts diverge/i);
  });

  test("positive coverage: retargeting the sole reference to a mod drops coverage to 35", () => {
    const rows = gearRowsCopy(indexes);
    const frequency = new Map<number, number>();
    for (const row of rows) {
      const key = row.UniqueModKey;
      if (typeof key === "number" && key > 0) {
        frequency.set(key, (frequency.get(key) ?? 0) + 1);
      }
    }
    const soleKey = [...frequency].find(([, count]) => count === 1)?.[0];
    const sharedKey = [...frequency].find(([, count]) => count > 1)?.[0];
    expect(soleKey).toBeDefined();
    expect(sharedKey).toBeDefined();
    const target = rows.findIndex((row) => row.UniqueModKey === soleKey);
    rows[target]!.UniqueModKey = sharedKey!;

    const mutated = withTable(indexes, "gear", { rows });
    // identity counts are untouched, so only the coverage guard can fire
    expect(measureGearCensus(mutated).tally).toEqual({
      nullCount: 5_612,
      zeroCount: 21,
      positiveCount: 127,
    });
    expect(measureGearCensus(mutated).positiveKeys.size).toBe(35);
    expect(
      errorMessage(() => projectSourceUniqueModTopology({ indexes: mutated })),
    ).toMatch(/coverage/i);
  });

  test("Skill split: renaming a Skill mod to a non-Skill name is rejected", () => {
    const rows = uniqueModRowsCopy(indexes);
    const target = rows.findIndex((row) =>
      String(row.UniqueMod).startsWith("Skill"),
    );
    expect(target).toBeGreaterThanOrEqual(0);
    rows[target]!.UniqueMod = "RenamedAwayFromSkill";
    const mutated = withTable(indexes, "unique_mods", { rows });
    expect(measureUniqueModSplit(mutated)).toEqual({ skill: 18, nonSkill: 18 });
    expect(
      errorMessage(() => projectSourceUniqueModTopology({ indexes: mutated })),
    ).toMatch(/skill-prefix split/i);
  });

  test("Skill split: renaming a non-Skill mod into Skill* is rejected", () => {
    const rows = uniqueModRowsCopy(indexes);
    const target = rows.findIndex(
      (row) => !String(row.UniqueMod).startsWith("Skill"),
    );
    rows[target]!.UniqueMod = "SkillForgedName";
    expect(() =>
      projectSourceUniqueModTopology({
        indexes: withTable(indexes, "unique_mods", { rows }),
      }),
    ).toThrow(Error);
  });

  test("gear row count: dropping one gear row is rejected", () => {
    const rows = gearRowsCopy(indexes).slice(0, -1);
    expect(rows).toHaveLength(5_759);
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "gear", { rows }),
        }),
      ),
    ).toMatch(/gear must contain exactly 5760 rows/i);
  });

  test("unique_mods row count: dropping one mod row is rejected", () => {
    const rows = uniqueModRowsCopy(indexes).slice(0, -1);
    expect(rows).toHaveLength(35);
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "unique_mods", { rows }),
        }),
      ),
    ).toMatch(/unique_mods must contain exactly 36 rows/i);
  });

  test("Param3-5 must stay null in source", () => {
    for (const field of [
      "Param3",
      "Param3ExchangeType",
      "Param4",
      "Param4ExchangeType",
      "Param5",
      "Param5ExchangeType",
    ]) {
      const rows = uniqueModRowsCopy(indexes);
      rows[0]![field] = field.endsWith("ExchangeType") ? "Forged" : 1;
      expect(
        errorMessage(() =>
          projectSourceUniqueModTopology({
            indexes: withTable(indexes, "unique_mods", { rows }),
          }),
        ),
      ).toMatch(/params 3-5 must be null/i);
    }
  });

  test("Skill Param1 must join skills by exact key", () => {
    const unknownKey = uniqueModRowsCopy(indexes);
    const skillRow = unknownKey.findIndex((row) =>
      String(row.UniqueMod).startsWith("Skill"),
    );
    unknownKey[skillRow]!.Param1 = 9_999_999;
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "unique_mods", { rows: unknownKey }),
        }),
      ),
    ).toMatch(/is missing from skills/i);

    // stringified key must not coerce into a match
    const stringified = uniqueModRowsCopy(indexes);
    const original = stringified[skillRow]!.Param1;
    stringified[skillRow]!.Param1 = String(original);
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "unique_mods", { rows: stringified }),
        }),
      ),
    ).toMatch(/must be a positive safe integer/i);

    // deleting the joined skills row must break the join
    const skills = indexes.tables.skills.rows.filter(
      (row) => row.SkillKey !== original,
    );
    expect(skills.length).toBeLessThan(indexes.tables.skills.rows.length);
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "skills", { rows: skills }),
        }),
      ),
    ).toMatch(/is missing from skills/i);
  });

  test("duplicate unique_mods key is rejected", () => {
    const rows = uniqueModRowsCopy(indexes);
    rows[1]!.UniqueModKey = rows[0]!.UniqueModKey;
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "unique_mods", { rows }),
        }),
      ),
    ).toMatch(/UniqueModKey must be unique/i);
  });

  test("duplicate gear key is rejected", () => {
    const rows = gearRowsCopy(indexes);
    rows[1]!.GearKey = rows[0]!.GearKey;
    expect(
      errorMessage(() =>
        projectSourceUniqueModTopology({
          indexes: withTable(indexes, "gear", { rows }),
        }),
      ),
    ).toMatch(/GearKey must be unique/i);
  });

  test("groups inertness: own accessors and own callables are rejected uninvoked", () => {
    for (const table of ["gear", "unique_mods", "skills"] as const) {
      // accessor-only: no own callable, so only the accessor rule can fire
      let sizeReads = 0;
      const accessorOnly = {} as Record<string, unknown>;
      Object.defineProperty(accessorOnly, "size", {
        enumerable: true,
        configurable: true,
        get() {
          sizeReads += 1;
          return 0;
        },
      });
      expect(
        errorMessage(() =>
          projectSourceUniqueModTopology({
            indexes: withTable(indexes, table, { groups: accessorOnly }),
          }),
        ),
      ).toMatch(/accessor/i);
      expect(sizeReads).toBe(0);

      // callable-only: no own accessor, so only the callable rule can fire
      let calls = 0;
      const callableOnly = {
        get() {
          calls += 1;
        },
        entries() {
          calls += 1;
        },
        forEach() {
          calls += 1;
        },
      };
      expect(
        errorMessage(() =>
          projectSourceUniqueModTopology({
            indexes: withTable(indexes, table, { groups: callableOnly }),
          }),
        ),
      ).toMatch(/callable/i);
      expect(calls).toBe(0);
    }
  });

  test("exact primaryField per table", () => {
    for (const [table, forged] of [
      ["gear", "UniqueModKey"],
      ["unique_mods", "UniqueMod"],
      ["skills", "SkillNameKey"],
    ] as const) {
      expect(
        errorMessage(() =>
          projectSourceUniqueModTopology({
            indexes: withTable(indexes, table, { primaryField: forged }),
          }),
        ),
      ).toMatch(/primaryField must be/i);
    }
  });

  test("exact table.name per table", () => {
    for (const table of ["gear", "unique_mods", "skills"] as const) {
      expect(
        errorMessage(() =>
          projectSourceUniqueModTopology({
            indexes: withTable(indexes, table, { name: "monsters" }),
          }),
        ),
      ).toMatch(/name must be/i);
    }
  });
});
