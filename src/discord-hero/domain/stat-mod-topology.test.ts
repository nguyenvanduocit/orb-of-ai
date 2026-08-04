import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  projectSourceStatModTopology,
  type SourceStatModTopology,
} from "./stat-mod-topology";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

const REFERENCED_STAT_MOD_KEYS = [
  102501, 101201, 100101, 102601, 100601, 100302, 102701, 100602, 104901,
  100201, 104001, 100801, 102401, 100501, 100701, 101701, 100102, 103301,
  102301, 102101, 101601, 100401, 100502, 100901, 101301, 101401, 101501,
  103401, 105201, 102001, 101001, 102201, 100301, 105301, 105401, 105501,
  105601, 105701, 105801, 105901, 105202,
] as const;

const SOURCE_UNREFERENCED_STAT_MOD_KEYS = [
  101101, 101801, 101901, 102801, 102901, 103001, 103101, 103201, 103501,
  103601, 103701, 103801, 103901, 104101, 104201, 104301, 104401, 104501,
  104601, 104701, 104801,
] as const;

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

function withRows(
  source: DiscordHeroCatalogIndexes,
  tableName: "materials" | "stat_mod_groups" | "stat_mods",
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables[tableName].rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      [tableName]: {
        ...source.tables[tableName],
        rows,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withRelevantMutableRows(
  source: DiscordHeroCatalogIndexes,
): DiscordHeroCatalogIndexes {
  let result = source;
  for (const tableName of [
    "materials",
    "stat_mod_groups",
    "stat_mods",
  ] as const) {
    result = withRows(result, tableName, () => {});
  }
  return result;
}

function relevantInputSnapshot(source: DiscordHeroCatalogIndexes): string {
  return JSON.stringify({
    materials: source.tables.materials.rows,
    statModGroups: source.tables.stat_mod_groups.rows,
    statMods: source.tables.stat_mods.rows,
  });
}

function relevantRows(
  topology: SourceStatModTopology,
): SourceStatModTopology["statModGroups"][number]["rows"][number][] {
  return topology.statModGroups.flatMap((group) => [...group.rows]);
}

function projectedPropertyNames(value: unknown, names = new Set<string>()) {
  if (typeof value !== "object" || value === null) return names;
  for (const key of Object.keys(value)) {
    names.add(key.toLowerCase());
    projectedPropertyNames((value as Record<string, unknown>)[key], names);
  }
  return names;
}

function hostileGroups(
  onCall: (name: string) => void,
): Record<string, unknown> {
  const value = {
    get() {
      onCall("get");
      return undefined;
    },
    has() {
      onCall("has");
      return false;
    },
    entries() {
      onCall("entries");
      return [][Symbol.iterator]();
    },
    keys() {
      onCall("keys");
      return [][Symbol.iterator]();
    },
    values() {
      onCall("values");
      return [][Symbol.iterator]();
    },
    forEach() {
      onCall("forEach");
    },
  } as Record<string, unknown>;
  Object.defineProperty(value, "size", {
    enumerable: true,
    configurable: true,
    get() {
      onCall("size");
      return 0;
    },
  });
  return value;
}

describe("DiscordHero source stat-mod topology", () => {
  test("projects the exact pinned corpus counts and ordered key coverage", () => {
    const topology = projectSourceStatModTopology({ indexes });

    expect(topology.counts).toEqual({
      materialRows: 125,
      materialsWithoutStatModGroup: 46,
      materialsWithStatModGroup: 79,
      statModGroupKeys: 79,
      statModGroupRows: 474,
      statModKeys: 62,
      statModRows: 620,
      tiersPerStatMod: 10,
      referencedStatModKeys: 41,
      sourceUnreferencedStatModKeys: 21,
    });
    expect(topology.materials).toHaveLength(125);
    expect(topology.statModGroups).toHaveLength(79);
    expect(relevantRows(topology)).toHaveLength(474);
    expect(topology.statMods).toHaveLength(62);
    expect(topology.statMods.flatMap((group) => group.rows)).toHaveLength(620);
    expect(topology.referencedStatModKeys).toEqual(REFERENCED_STAT_MOD_KEYS);
    expect(topology.sourceUnreferencedStatModKeys).toEqual(
      SOURCE_UNREFERENCED_STAT_MOD_KEYS,
    );

    expect(topology.materials.map((material) => material.itemKey)).toEqual(
      indexes.tables.materials.rows.map((row) => row.ItemKey),
    );
    expect(
      topology.statModGroups.map((group) => group.statModGroupKey),
    ).toEqual([
      ...new Set(
        indexes.tables.stat_mod_groups.rows.map((row) => row.StatModGroupKey),
      ),
    ]);
    expect(topology.statMods.map((group) => group.statModKey)).toEqual([
      ...new Set(indexes.tables.stat_mods.rows.map((row) => row.StatModKey)),
    ]);
  });

  test("preserves every source row, group index, reverse edge, and join exactly once", () => {
    const topology = projectSourceStatModTopology({ indexes });
    const sourceMaterials = indexes.tables.materials.rows;
    const sourceGroupRows = indexes.tables.stat_mod_groups.rows;
    const sourceStatRows = indexes.tables.stat_mods.rows;

    topology.materials.forEach((material, rowIndex) => {
      const source = sourceMaterials[rowIndex]!;
      expect(material).toMatchObject({
        provenance: { table: "materials", rowIndex },
        itemKey: source.ItemKey,
        materialTypeRaw: source.MATERIALTYPE,
      });
      if (source.StatModGroupKey === null) {
        expect(material.statModGroup).toEqual({
          kind: "none",
          rawStatModGroupKey: null,
        });
        return;
      }
      const groupIndex = topology.statModGroups.findIndex(
        (group) => group.statModGroupKey === source.StatModGroupKey,
      );
      expect(groupIndex).toBeGreaterThanOrEqual(0);
      expect(material.statModGroup).toEqual({
        kind: "resolved",
        rawStatModGroupKey: source.StatModGroupKey,
        statModGroupIndex: groupIndex,
        statModGroupRowIndexes: topology.statModGroups[groupIndex]!.rows.map(
          (row) => row.provenance.rowIndex,
        ),
      });
      expect(topology.statModGroups[groupIndex]!.materialSourceRowIndex).toBe(
        rowIndex,
      );
    });

    const projectedGroupRows = relevantRows(topology);
    projectedGroupRows.forEach((row, rowIndex) => {
      const source = sourceGroupRows[rowIndex]!;
      expect(row).toMatchObject({
        provenance: { table: "stat_mod_groups", rowIndex },
        statModGroupKey: source.StatModGroupKey,
        gearGroupRaw: source.GearGroup,
        statModKey: source.StatModKey,
        minTierRaw: source.MinTier,
        maxTierRaw: source.MaxTier,
      });
      const statModGroupIndex = topology.statMods.findIndex(
        (group) => group.statModKey === source.StatModKey,
      );
      expect(row.statMod).toEqual({
        kind: "resolved",
        statModKey: source.StatModKey,
        statModGroupIndex,
        statModRowIndexes: topology.statMods[statModGroupIndex]!.rows.map(
          (statRow) => statRow.provenance.rowIndex,
        ),
      });
      expect(
        topology.statMods[
          statModGroupIndex
        ]!.referencedByStatModGroupRowIndexes.includes(rowIndex),
      ).toBe(true);
    });
    expect(projectedGroupRows.map((row) => row.provenance.rowIndex)).toEqual(
      sourceGroupRows.map((_row, rowIndex) => rowIndex),
    );

    const projectedStatRows = topology.statMods.flatMap((group) => group.rows);
    projectedStatRows.forEach((row, rowIndex) => {
      const source = sourceStatRows[rowIndex]!;
      expect(row).toEqual({
        provenance: {
          table: "stat_mods",
          rowIndex,
          groupIndex: Math.floor(rowIndex / 10),
          rowIndexInGroup: rowIndex % 10,
        },
        statModKey: source.StatModKey,
        tierRaw: source.Tier,
        statTypeRaw: source.STATTYPE,
        modTypeRaw: source.MODTYPE,
        minValueRaw: source.MinValue,
        maxValueRaw: source.MaxValue,
        intervalRaw: source.Interval,
      });
    });
    for (const group of topology.statMods) {
      expect(group.rows).toHaveLength(10);
      expect(group.rows.map((row) => row.tierRaw)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
      expect(group.referenced).toBe(
        group.referencedByStatModGroupRowIndexes.length > 0,
      );
    }
    expect(
      topology.statMods
        .flatMap((group) => group.referencedByStatModGroupRowIndexes)
        .sort((left, right) => left - right),
    ).toEqual(sourceGroupRows.map((_row, rowIndex) => rowIndex));
  });

  test("pins representative full source vectors without deriving them from implementation groups", () => {
    const topology = projectSourceStatModTopology({ indexes });

    expect(topology.materials[0]).toEqual({
      provenance: { table: "materials", rowIndex: 0 },
      itemKey: 110001,
      materialTypeRaw: "DECORATION",
      statModGroup: {
        kind: "resolved",
        rawStatModGroupKey: 1100011,
        statModGroupIndex: 0,
        statModGroupRowIndexes: [0, 1, 2],
      },
    });
    expect(topology.materials[79]).toEqual({
      provenance: { table: "materials", rowIndex: 79 },
      itemKey: 140001,
      materialTypeRaw: "CRAFTING",
      statModGroup: {
        kind: "none",
        rawStatModGroupKey: null,
      },
    });
    expect(topology.materials[124]).toEqual({
      provenance: { table: "materials", rowIndex: 124 },
      itemKey: 190004,
      materialTypeRaw: "SOULSTONE",
      statModGroup: {
        kind: "none",
        rawStatModGroupKey: null,
      },
    });

    expect(topology.statModGroups[0]).toEqual({
      statModGroupKey: 1100011,
      groupIndex: 0,
      materialSourceRowIndex: 0,
      rows: [
        {
          provenance: {
            table: "stat_mod_groups",
            rowIndex: 0,
            groupIndex: 0,
            rowIndexInGroup: 0,
          },
          statModGroupKey: 1100011,
          gearGroupRaw: "WEAPON",
          statModKey: 102501,
          minTierRaw: 2,
          maxTierRaw: 2,
          statMod: {
            kind: "resolved",
            statModKey: 102501,
            statModGroupIndex: 27,
            statModRowIndexes: [
              270, 271, 272, 273, 274, 275, 276, 277, 278, 279,
            ],
          },
        },
        {
          provenance: {
            table: "stat_mod_groups",
            rowIndex: 1,
            groupIndex: 0,
            rowIndexInGroup: 1,
          },
          statModGroupKey: 1100011,
          gearGroupRaw: "ARMOR",
          statModKey: 101201,
          minTierRaw: 1,
          maxTierRaw: 1,
          statMod: {
            kind: "resolved",
            statModKey: 101201,
            statModGroupIndex: 14,
            statModRowIndexes: [
              140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
            ],
          },
        },
        {
          provenance: {
            table: "stat_mod_groups",
            rowIndex: 2,
            groupIndex: 0,
            rowIndexInGroup: 2,
          },
          statModGroupKey: 1100011,
          gearGroupRaw: "ACCESSORY",
          statModKey: 100101,
          minTierRaw: 1,
          maxTierRaw: 1,
          statMod: {
            kind: "resolved",
            statModKey: 100101,
            statModGroupIndex: 0,
            statModRowIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      ],
    });

    const eighteenRowGroup = topology.statModGroups[72]!;
    expect(eighteenRowGroup.statModGroupKey).toBe(1330011);
    expect(eighteenRowGroup.materialSourceRowIndex).toBe(72);
    expect(
      eighteenRowGroup.rows.map((row) => [
        row.provenance.rowIndex,
        row.statModKey,
        row.gearGroupRaw,
        row.minTierRaw,
        row.maxTierRaw,
      ]),
    ).toEqual([
      [354, 100101, "COMMON", 4, 6],
      [355, 100102, "COMMON", 4, 6],
      [356, 100601, "COMMON", 4, 6],
      [357, 100602, "COMMON", 4, 6],
      [358, 101601, "COMMON", 4, 6],
      [359, 101701, "COMMON", 4, 6],
      [360, 100501, "COMMON", 4, 6],
      [361, 100701, "COMMON", 4, 6],
      [362, 100302, "COMMON", 4, 6],
      [363, 100401, "COMMON", 4, 6],
      [364, 102401, "COMMON", 4, 6],
      [365, 102501, "COMMON", 4, 6],
      [366, 102601, "COMMON", 4, 6],
      [367, 102701, "COMMON", 4, 6],
      [368, 101201, "COMMON", 4, 6],
      [369, 101301, "COMMON", 4, 6],
      [370, 101401, "COMMON", 4, 6],
      [371, 102301, "COMMON", 4, 6],
    ]);

    expect(topology.statMods[0]).toEqual({
      statModKey: 100101,
      groupIndex: 0,
      referenced: true,
      referencedByStatModGroupRowIndexes: [
        2, 15, 29, 42, 54, 74, 81, 121, 131, 142, 149, 161, 184, 199, 229, 235,
        257, 277, 295, 299, 306, 322, 338, 354, 372, 387, 405, 422, 439, 456,
      ],
      rows: [
        [1, 1, 2],
        [2, 2, 3],
        [3, 3, 6],
        [4, 6, 10],
        [5, 10, 15],
        [6, 15, 30],
        [7, 30, 50],
        [8, 50, 100],
        [9, 100, 150],
        [10, 150, 300],
      ].map(([tierRaw, minValueRaw, maxValueRaw], rowIndexInGroup) => ({
        provenance: {
          table: "stat_mods",
          rowIndex: rowIndexInGroup,
          groupIndex: 0,
          rowIndexInGroup,
        },
        statModKey: 100101,
        tierRaw,
        statTypeRaw: "AttackDamage",
        modTypeRaw: "FLAT",
        minValueRaw,
        maxValueRaw,
        intervalRaw: 1,
      })),
    });

    const unreferenced = topology.statMods[13]!;
    expect(unreferenced.statModKey).toBe(101101);
    expect(unreferenced.referenced).toBe(false);
    expect(unreferenced.referencedByStatModGroupRowIndexes).toEqual([]);
    expect(
      unreferenced.rows.map((row) => [
        row.provenance.rowIndex,
        row.tierRaw,
        row.statTypeRaw,
        row.modTypeRaw,
        row.minValueRaw,
        row.maxValueRaw,
        row.intervalRaw,
      ]),
    ).toEqual([
      [130, 1, "SkillRangeExpansion", "FLAT", 30, 40, 1],
      [131, 2, "SkillRangeExpansion", "FLAT", 40, 50, 1],
      [132, 3, "SkillRangeExpansion", "FLAT", 50, 70, 1],
      [133, 4, "SkillRangeExpansion", "FLAT", 70, 90, 1],
      [134, 5, "SkillRangeExpansion", "FLAT", 90, 110, 1],
      [135, 6, "SkillRangeExpansion", "FLAT", 110, 130, 1],
      [136, 7, "SkillRangeExpansion", "FLAT", 130, 150, 1],
      [137, 8, "SkillRangeExpansion", "FLAT", 150, 170, 1],
      [138, 9, "SkillRangeExpansion", "FLAT", 170, 190, 1],
      [139, 10, "SkillRangeExpansion", "FLAT", 190, 210, 1],
    ]);
  });

  test("returns detached deeply frozen source facts with no runtime semantics or side effects", () => {
    const mutable = withRelevantMutableRows(indexes);
    const before = relevantInputSnapshot(mutable);
    let randomCalls = 0;
    let timeCalls = 0;
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    Date.now = () => {
      timeCalls += 1;
      return 0;
    };

    let topology: SourceStatModTopology;
    try {
      topology = projectSourceStatModTopology({ indexes: mutable });
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
    expect(randomCalls).toBe(0);
    expect(timeCalls).toBe(0);
    expect(relevantInputSnapshot(mutable)).toBe(before);
    expectDeeplyFrozen(topology!);

    const serializedBefore = JSON.stringify(topology!);
    const mutableFirstMaterial = mutable.tables.materials
      .rows[0] as unknown as Record<string, unknown>;
    const mutableFirstGroup = mutable.tables.stat_mod_groups
      .rows[0] as unknown as Record<string, unknown>;
    const mutableFirstStat = mutable.tables.stat_mods
      .rows[0] as unknown as Record<string, unknown>;
    mutableFirstMaterial.MATERIALTYPE = "FORGED";
    mutableFirstGroup.GearGroup = "FORGED";
    mutableFirstStat.MinValue = 999_999;
    expect(JSON.stringify(topology!)).toBe(serializedBefore);

    expect(() => {
      (topology!.materials as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (topology!.statModGroups[0]!.rows as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (topology!.statMods[0]!.rows[0] as { tierRaw: number }).tierRaw = 99;
    }).toThrow(TypeError);

    const forbiddenProperties = [
      "eligible",
      "candidate",
      "selected",
      "appliedvalue",
      "rolled",
      "playerstate",
      "rng",
      "random",
      "owner",
      "inventory",
      "probability",
    ];
    const propertyNames = projectedPropertyNames(topology!);
    for (const property of forbiddenProperties) {
      expect(propertyNames.has(property)).toBe(false);
    }
  });

  test("rejects non-exact roots, tables, rows, symbols, prototypes, and accessors without calling getters", () => {
    expect(() =>
      projectSourceStatModTopology({ indexes, rng: () => 0 } as never),
    ).toThrow(/unknown field/i);
    expect(() => projectSourceStatModTopology({} as never)).toThrow(
      /missing field/i,
    );
    expect(() =>
      projectSourceStatModTopology(
        Object.assign(Object.create({ hostile: true }), { indexes }) as never,
      ),
    ).toThrow(/prototype/i);
    expect(() =>
      projectSourceStatModTopology({
        indexes,
        [Symbol("hidden")]: true,
      } as never),
    ).toThrow(/symbol/i);

    let inputReads = 0;
    const accessorInput = {} as Record<string, unknown>;
    Object.defineProperty(accessorInput, "indexes", {
      enumerable: true,
      get() {
        inputReads += 1;
        return indexes;
      },
    });
    expect(() => projectSourceStatModTopology(accessorInput as never)).toThrow(
      /accessor|data property/i,
    );
    expect(inputReads).toBe(0);

    let tableReads = 0;
    const accessorTables = { ...indexes.tables };
    Object.defineProperty(accessorTables, "materials", {
      enumerable: true,
      get() {
        tableReads += 1;
        return indexes.tables.materials;
      },
    });
    expect(() =>
      projectSourceStatModTopology({
        indexes: {
          ...indexes,
          tables: accessorTables,
        } as DiscordHeroCatalogIndexes,
      }),
    ).toThrow(/accessor|data property/i);
    expect(tableReads).toBe(0);

    for (const tableName of [
      "materials",
      "stat_mod_groups",
      "stat_mods",
    ] as const) {
      const wrongPrimary = {
        ...indexes,
        tables: {
          ...indexes.tables,
          [tableName]: {
            ...indexes.tables[tableName],
            primaryField: "WrongPrimary",
          },
        },
      } as unknown as DiscordHeroCatalogIndexes;
      expect(() =>
        projectSourceStatModTopology({ indexes: wrongPrimary }),
      ).toThrow(/primaryField/i);
    }

    let rowReads = 0;
    const accessorRow = {
      ItemKey: 110001,
      get MATERIALTYPE() {
        rowReads += 1;
        return "DECORATION";
      },
      StatModGroupKey: 1100011,
    };
    const accessorRows = withRows(indexes, "materials", (rows) => {
      rows[0] = accessorRow;
    });
    expect(() =>
      projectSourceStatModTopology({ indexes: accessorRows }),
    ).toThrow(/accessor|data property/i);
    expect(rowReads).toBe(0);

    const customRowPrototype = withRows(indexes, "stat_mods", (rows) => {
      rows[0] = Object.assign(Object.create({ hostile: true }), rows[0]);
    });
    expect(() =>
      projectSourceStatModTopology({ indexes: customRowPrototype }),
    ).toThrow(/prototype/i);

    const rowSymbol = withRows(indexes, "stat_mod_groups", (rows) => {
      Object.defineProperty(rows[0]!, Symbol("hidden"), {
        enumerable: true,
        value: true,
      });
    });
    expect(() => projectSourceStatModTopology({ indexes: rowSymbol })).toThrow(
      /symbol/i,
    );

    const extraRowField = withRows(indexes, "materials", (rows) => {
      rows[0]!.Eligible = true;
    });
    expect(() =>
      projectSourceStatModTopology({ indexes: extraRowField }),
    ).toThrow(/unknown field/i);
  });

  test("rejects sparse and hostile arrays, caller group APIs, and semantic-report code with zero calls", () => {
    const sparseRows = indexes.tables.stat_mods.rows.slice() as unknown[];
    delete sparseRows[10];
    const sparse = {
      ...indexes,
      tables: {
        ...indexes.tables,
        stat_mods: {
          ...indexes.tables.stat_mods,
          rows: sparseRows,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectSourceStatModTopology({ indexes: sparse })).toThrow(
      /sparse|hole/i,
    );

    const hostileRows = indexes.tables.materials.rows.slice() as unknown[];
    Object.setPrototypeOf(hostileRows, Object.create(Array.prototype));
    const hostileArray = {
      ...indexes,
      tables: {
        ...indexes.tables,
        materials: {
          ...indexes.tables.materials,
          rows: hostileRows,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() =>
      projectSourceStatModTopology({ indexes: hostileArray }),
    ).toThrow(/Array\.prototype|prototype/i);

    for (const tableName of [
      "materials",
      "stat_mod_groups",
      "stat_mods",
    ] as const) {
      const calls: string[] = [];
      const hostile = {
        ...indexes,
        tables: {
          ...indexes.tables,
          [tableName]: {
            ...indexes.tables[tableName],
            groups: hostileGroups((name) => calls.push(name)),
          },
        },
      } as unknown as DiscordHeroCatalogIndexes;
      let escaped: unknown = "SENTINEL";
      expect(() => {
        escaped = projectSourceStatModTopology({ indexes: hostile });
      }).toThrow(/groups|accessor|executable/i);
      expect(calls).toEqual([]);
      expect(escaped).toBe("SENTINEL");
    }

    const poisonedGroups = new Map(indexes.tables.stat_mod_groups.groups);
    poisonedGroups.clear();
    poisonedGroups.set(9_999_999, []);
    const ignoredDerivedMap = {
      ...indexes,
      tables: {
        ...indexes.tables,
        stat_mod_groups: {
          ...indexes.tables.stat_mod_groups,
          groups: poisonedGroups,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(
      JSON.stringify(
        projectSourceStatModTopology({ indexes: ignoredDerivedMap }),
      ),
    ).toBe(JSON.stringify(projectSourceStatModTopology({ indexes })));

    let semanticReads = 0;
    const semanticReport = { ...indexes.semanticReport };
    Object.defineProperty(semanticReport, "rules", {
      enumerable: true,
      get() {
        semanticReads += 1;
        return [];
      },
    });
    const semanticHostile = {
      ...indexes,
      semanticReport,
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() =>
      projectSourceStatModTopology({ indexes: semanticHostile }),
    ).toThrow(/semanticReport|accessor|data property/i);
    expect(semanticReads).toBe(0);
  });

  test("rejects duplicate, reordered, orphaned, unsafe, or same-count forged source rows before output", () => {
    const cases: Array<{
      name: string;
      value: DiscordHeroCatalogIndexes;
      message: RegExp;
    }> = [
      {
        name: "reordered materials",
        value: withRows(indexes, "materials", (rows) => {
          [rows[0], rows[1]] = [rows[1]!, rows[0]!];
        }),
        message: /order|pinned|materials/i,
      },
      {
        name: "duplicate material primary",
        value: withRows(indexes, "materials", (rows) => {
          rows[1]!.ItemKey = rows[0]!.ItemKey;
        }),
        message: /duplicate|order|pinned/i,
      },
      {
        name: "material references a group twice while orphaning another",
        value: withRows(indexes, "materials", (rows) => {
          rows[1]!.StatModGroupKey = rows[0]!.StatModGroupKey;
        }),
        message: /group|join|pinned/i,
      },
      {
        name: "material references a ghost group",
        value: withRows(indexes, "materials", (rows) => {
          rows[0]!.StatModGroupKey = 9_999_999;
        }),
        message: /group|join|pinned/i,
      },
      {
        name: "reordered stat-mod groups",
        value: withRows(indexes, "stat_mod_groups", (rows) => {
          [rows[0], rows[3]] = [rows[3]!, rows[0]!];
        }),
        message: /order|pinned|stat_mod_groups/i,
      },
      {
        name: "duplicate stat-mod-group row",
        value: withRows(indexes, "stat_mod_groups", (rows) => {
          rows[1] = { ...rows[0]! };
        }),
        message: /duplicate|group|pinned/i,
      },
      {
        name: "orphan stat key",
        value: withRows(indexes, "stat_mod_groups", (rows) => {
          rows[0]!.StatModKey = 9_999_999;
        }),
        message: /stat mod|join|pinned/i,
      },
      {
        name: "unsafe tier",
        value: withRows(indexes, "stat_mod_groups", (rows) => {
          rows[0]!.MinTier = Number.MAX_SAFE_INTEGER + 1;
        }),
        message: /tier|safe integer|pinned/i,
      },
      {
        name: "reordered stat rows",
        value: withRows(indexes, "stat_mods", (rows) => {
          [rows[0], rows[1]] = [rows[1]!, rows[0]!];
        }),
        message: /tier|order|pinned/i,
      },
      {
        name: "duplicate stat tier",
        value: withRows(indexes, "stat_mods", (rows) => {
          rows[1] = { ...rows[0]! };
        }),
        message: /duplicate|tier|pinned/i,
      },
      {
        name: "invalid interval",
        value: withRows(indexes, "stat_mods", (rows) => {
          rows[0]!.Interval = 0;
        }),
        message: /Interval|positive|pinned/i,
      },
      {
        name: "same-count unreferenced-row forgery",
        value: withRows(indexes, "stat_mods", (rows) => {
          const target = rows.find(
            (row) => row.StatModKey === 101101 && row.Tier === 1,
          )!;
          target.MinValue = 31;
        }),
        message: /pinned|source rows/i,
      },
    ];

    for (const attack of cases) {
      let escaped: unknown = "SENTINEL";
      expect(() => {
        escaped = projectSourceStatModTopology({ indexes: attack.value });
      }, attack.name).toThrow(attack.message);
      expect(escaped, attack.name).toBe("SENTINEL");
    }
  });

  test("does not let a forged semantic report authenticate a missing relation", () => {
    const orphaned = withRows(indexes, "stat_mod_groups", (rows) => {
      rows[0]!.StatModKey = 9_999_999;
    });
    const forged = {
      ...orphaned,
      semanticReport: {
        ...orphaned.semanticReport,
        unresolvedReferences: [
          ...orphaned.semanticReport.unresolvedReferences,
          {
            ruleId: "stat_mod_groups.StatModKey->stat_mods",
            sourceTable: "stat_mod_groups" as DiscordHeroDatasetName,
            sourceField: "StatModKey",
            sourceKey: 1100011,
            targetTable: "stat_mods" as DiscordHeroDatasetName,
            targetKey: 9_999_999,
            reason: "forged full relation identity and reason",
          },
        ],
        unresolvedReferenceCount:
          orphaned.semanticReport.unresolvedReferenceCount + 1,
      },
    } as unknown as DiscordHeroCatalogIndexes;

    let escaped: unknown = "SENTINEL";
    expect(() => {
      escaped = projectSourceStatModTopology({ indexes: forged });
    }).toThrow(/pinned|join|stat mod/i);
    expect(escaped).toBe("SENTINEL");
  });
});
