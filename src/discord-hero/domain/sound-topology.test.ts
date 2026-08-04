import { beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  projectSourceSoundTopology,
  type SourceSoundReference,
  type SourceSoundTopology,
} from "./sound-topology";

const RELEVANT_TABLES = [
  "sounds",
  "heroes",
  "monsters",
  "skills",
  "stages",
] as const;

const SOURCE_VECTOR_SHA256 =
  "4e6229859b1a6768634d76ce67dd4bf9b3d032b0f36cc24beb9251c201da2df7";
const REFERENCE_VECTOR_SHA256 =
  "116be3f78b876b1281731764ba7dfb1dfe1857505ac02defd2d92cb311616957";
const UNREFERENCED_KEY_SHA256 =
  "ace3586147393fd84670caff9af5a022f732642cc6af173bfa41c1eb3ce652d7";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function project(
  input: { readonly indexes: DiscordHeroCatalogIndexes } = { indexes },
): SourceSoundTopology {
  return projectSourceSoundTopology(input);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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

function cloneWithRows(
  source: DiscordHeroCatalogIndexes,
  tableName: (typeof RELEVANT_TABLES)[number],
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = structuredClone(
    source.tables[tableName].rows,
  ) as unknown as Record<string, unknown>[];
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

function cloneRelevantRows(
  source: DiscordHeroCatalogIndexes,
): DiscordHeroCatalogIndexes {
  let result = source;
  for (const tableName of RELEVANT_TABLES) {
    result = cloneWithRows(result, tableName, () => {});
  }
  return result;
}

function descriptorFingerprint(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  return Reflect.ownKeys(value).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return {
      key: typeof key === "symbol" ? String(key) : key,
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      writable: "writable" in descriptor ? descriptor.writable : undefined,
      accessor:
        "get" in descriptor || "set" in descriptor
          ? [typeof descriptor.get, typeof descriptor.set]
          : undefined,
      value:
        "value" in descriptor
          ? descriptorFingerprint(descriptor.value)
          : undefined,
    };
  });
}

function relevantFingerprint(source: DiscordHeroCatalogIndexes): string {
  return JSON.stringify(
    RELEVANT_TABLES.map((tableName) => ({
      tableName,
      table: descriptorFingerprint(source.tables[tableName]),
    })),
  );
}

function canonicalReferencedSoundKeys(
  source: DiscordHeroCatalogIndexes,
): ReadonlySet<number> {
  return new Set([
    ...source.tables.heroes.rows.flatMap((row) => [
      row.SelectSoundKey,
      row.DeadSoundKey,
    ]),
    ...source.tables.monsters.rows.map((row) => row.DeadSoundKey),
    ...source.tables.skills.rows.flatMap((row) =>
      row.SoundKey === null ? [] : [row.SoundKey],
    ),
    ...source.tables.stages.rows.map((row) => row.BGMSoundKey),
  ]);
}

function canonicalSoundReferences(
  source: DiscordHeroCatalogIndexes,
): readonly SourceSoundReference[] {
  const typeBySoundKey = new Map(
    source.tables.sounds.rows.map(
      (row) => [row.SoundKey, row.SoundType] as const,
    ),
  );
  const reference = (
    sourceTable: SourceSoundReference["sourceTable"],
    sourceField: SourceSoundReference["sourceField"],
    sourceRowIndex: number,
    sourceKey: number | string,
    soundKey: number,
  ): SourceSoundReference => {
    const soundTypeRaw = typeBySoundKey.get(soundKey);
    if (soundTypeRaw === undefined) {
      throw new Error(`canonical reference ${soundKey} is dangling`);
    }
    return {
      sourceTable,
      sourceField,
      sourceRowIndex,
      sourceKey,
      soundKey,
      soundTypeRaw,
    };
  };
  return [
    ...source.tables.heroes.rows.map((row, rowIndex) =>
      reference(
        "heroes",
        "SelectSoundKey",
        rowIndex,
        row.HeroKey,
        row.SelectSoundKey,
      ),
    ),
    ...source.tables.heroes.rows.map((row, rowIndex) =>
      reference(
        "heroes",
        "DeadSoundKey",
        rowIndex,
        row.HeroKey,
        row.DeadSoundKey,
      ),
    ),
    ...source.tables.monsters.rows.map((row, rowIndex) =>
      reference(
        "monsters",
        "DeadSoundKey",
        rowIndex,
        row.MonsterKey,
        row.DeadSoundKey,
      ),
    ),
    ...source.tables.skills.rows.flatMap((row, rowIndex) =>
      row.SoundKey === null
        ? []
        : [
            reference(
              "skills",
              "SoundKey",
              rowIndex,
              row.SkillKey,
              row.SoundKey,
            ),
          ],
    ),
    ...source.tables.stages.rows.map((row, rowIndex) =>
      reference(
        "stages",
        "BGMSoundKey",
        rowIndex,
        row.StageKey,
        row.BGMSoundKey,
      ),
    ),
  ];
}

function projectedPropertyNames(
  value: unknown,
  names = new Set<string>(),
): Set<string> {
  if (typeof value !== "object" || value === null) return names;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") continue;
    names.add(key.toLowerCase());
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      projectedPropertyNames(descriptor.value, names);
    }
  }
  return names;
}

function replaceTable(
  source: DiscordHeroCatalogIndexes,
  tableName: (typeof RELEVANT_TABLES)[number],
  table: Record<string, unknown>,
): DiscordHeroCatalogIndexes {
  return {
    ...source,
    tables: {
      ...source.tables,
      [tableName]: table,
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function hostileProxy<T extends object>(
  target: T,
): {
  readonly proxy: T;
  readonly trapCalls: string[];
} {
  const trapCalls: string[] = [];
  const fail = (trap: string): never => {
    trapCalls.push(trap);
    throw new Error(`hostile ${trap} trap was invoked`);
  };
  return {
    proxy: new Proxy(target, {
      apply: () => fail("apply"),
      construct: () => fail("construct"),
      defineProperty: () => fail("defineProperty"),
      deleteProperty: () => fail("deleteProperty"),
      get: () => fail("get"),
      getOwnPropertyDescriptor: () => fail("getOwnPropertyDescriptor"),
      getPrototypeOf: () => fail("getPrototypeOf"),
      has: () => fail("has"),
      isExtensible: () => fail("isExtensible"),
      ownKeys: () => fail("ownKeys"),
      preventExtensions: () => fail("preventExtensions"),
      set: () => fail("set"),
      setPrototypeOf: () => fail("setPrototypeOf"),
    }),
    trapCalls,
  };
}

function ownDescriptorSnapshot(
  value: object,
): ReadonlyMap<string | symbol, PropertyDescriptor> {
  return new Map(
    Reflect.ownKeys(value).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(value, key)!,
    ]),
  );
}

function expectOwnDescriptorsUnchanged(
  value: object,
  before: ReadonlyMap<string | symbol, PropertyDescriptor>,
): void {
  expect(Reflect.ownKeys(value)).toEqual([...before.keys()]);
  for (const [key, expected] of before) {
    const actual = Object.getOwnPropertyDescriptor(value, key);
    expect(actual).toBeDefined();
    expect(actual!.configurable).toBe(expected.configurable);
    expect(actual!.enumerable).toBe(expected.enumerable);
    if ("value" in expected) {
      expect("value" in actual!).toBe(true);
      expect((actual as PropertyDescriptor & { value: unknown }).value).toBe(
        expected.value,
      );
      expect(actual!.writable).toBe(expected.writable);
    } else {
      expect(actual!.get).toBe(expected.get);
      expect(actual!.set).toBe(expected.set);
    }
  }
}

function expectExactDenseArrayOwnKeys(value: readonly unknown[]): void {
  expect(Reflect.ownKeys(value)).toEqual([
    ...value.map((_, index) => String(index)),
    "length",
  ]);
}

describe("DiscordHero source sound topology", () => {
  test("pins all 312 source sounds in order with exact raw types and provenance", () => {
    const topology = project();

    expect(topology.counts).toEqual({
      sounds: 312,
      soundTypes: {
        BattleLog: 2,
        BGM: 17,
        GameSFX: 199,
        UI_SFX: 94,
      },
      references: 297,
      heroSelectReferences: 6,
      heroDeadReferences: 6,
      monsterDeadReferences: 61,
      skillReferences: 104,
      stageBgmReferences: 120,
      referencedSounds: 173,
      sourceUnreferencedSounds: 139,
      unresolvedReferences: 0,
    });
    expect(
      sha256(
        topology.sounds.map(({ soundKey, soundTypeRaw }) => ({
          SoundKey: soundKey,
          SoundType: soundTypeRaw,
        })),
      ),
    ).toBe(SOURCE_VECTOR_SHA256);
    expect(
      topology.sounds.map(({ soundKey, soundTypeRaw, provenance }) => ({
        soundKey,
        soundTypeRaw,
        provenance: {
          table: provenance.table,
          primaryField: provenance.primaryField,
          typeField: provenance.typeField,
          rowIndex: provenance.rowIndex,
          primaryKey: provenance.primaryKey,
        },
      })),
    ).toEqual(
      indexes.tables.sounds.rows.map((row, rowIndex) => ({
        soundKey: row.SoundKey,
        soundTypeRaw: row.SoundType,
        provenance: {
          table: indexes.tables.sounds.name,
          primaryField: indexes.tables.sounds.primaryField,
          typeField: "SoundType",
          rowIndex,
          primaryKey: row.SoundKey,
        },
      })),
    );
    expect(topology.sounds.slice(0, 3)).toEqual([
      {
        soundKey: 10001,
        soundTypeRaw: "BGM",
        referenced: false,
        provenance: {
          table: "sounds",
          primaryField: "SoundKey",
          primaryKey: 10001,
          typeField: "SoundType",
          rowIndex: 0,
        },
        incomingReferences: [],
      },
      {
        soundKey: 11011,
        soundTypeRaw: "BGM",
        referenced: true,
        provenance: {
          table: "sounds",
          primaryField: "SoundKey",
          primaryKey: 11011,
          typeField: "SoundType",
          rowIndex: 1,
        },
        incomingReferences: expect.any(Array),
      },
      {
        soundKey: 11031,
        soundTypeRaw: "BGM",
        referenced: true,
        provenance: {
          table: "sounds",
          primaryField: "SoundKey",
          primaryKey: 11031,
          typeField: "SoundType",
          rowIndex: 2,
        },
        incomingReferences: expect.any(Array),
      },
    ]);
    expect(
      topology.sounds
        .slice(-3)
        .map(({ soundKey, soundTypeRaw, provenance }) => [
          soundKey,
          soundTypeRaw,
          provenance.rowIndex,
        ]),
    ).toEqual([
      [23010411, "GameSFX", 309],
      [23011111, "GameSFX", 310],
      [23090111, "GameSFX", 311],
    ]);
  });

  test("recomputes every incoming source backlink and source-unreferenced identity", () => {
    const topology = project();
    const expectedReferences = canonicalSoundReferences(indexes);

    expect(expectedReferences).toHaveLength(297);
    expect(topology.references).toEqual(expectedReferences);
    expect(sha256(topology.references)).toBe(REFERENCE_VECTOR_SHA256);
    expect(topology.references.slice(0, 2)).toEqual([
      {
        sourceTable: "heroes",
        sourceField: "SelectSoundKey",
        sourceRowIndex: 0,
        sourceKey: 101,
        soundKey: 30501,
        soundTypeRaw: "UI_SFX",
      },
      {
        sourceTable: "heroes",
        sourceField: "SelectSoundKey",
        sourceRowIndex: 1,
        sourceKey: 201,
        soundKey: 30502,
        soundTypeRaw: "UI_SFX",
      },
    ]);
    expect(topology.references.slice(-2)).toEqual([
      {
        sourceTable: "stages",
        sourceField: "BGMSoundKey",
        sourceRowIndex: 118,
        sourceKey: 4309,
        soundKey: 13081,
        soundTypeRaw: "BGM",
      },
      {
        sourceTable: "stages",
        sourceField: "BGMSoundKey",
        sourceRowIndex: 119,
        sourceKey: 4310,
        soundKey: 13101,
        soundTypeRaw: "BGM",
      },
    ]);

    const flattenedBacklinks = topology.sounds.flatMap(
      (sound) => sound.incomingReferences,
    );
    expect(flattenedBacklinks).toHaveLength(297);
    expect(
      new Set(topology.references.map((reference) => reference.soundKey)).size,
    ).toBe(173);
    for (const sound of topology.sounds) {
      const expectedIncoming = expectedReferences.filter(
        (reference) => reference.soundKey === sound.soundKey,
      );
      expect(sound.incomingReferences).toEqual(expectedIncoming);
      expect(sound.referenced).toBe(expectedIncoming.length > 0);
    }
    for (const reference of topology.references) {
      const sound = topology.sounds.find(
        (candidate) => candidate.soundKey === reference.soundKey,
      );
      expect(sound).toBeDefined();
      expect(sound!.soundTypeRaw).toBe(reference.soundTypeRaw);
      expect(sound!.incomingReferences).toContainEqual(reference);
    }
    expect(
      sha256(topology.sourceUnreferencedSounds.map((sound) => sound.soundKey)),
    ).toBe(UNREFERENCED_KEY_SHA256);
    const canonicalReferenced = canonicalReferencedSoundKeys(indexes);
    const expectedSourceUnreferenced = indexes.tables.sounds.rows
      .filter((row) => !canonicalReferenced.has(row.SoundKey))
      .map((row) => ({
        soundKey: row.SoundKey,
        soundTypeRaw: row.SoundType,
      }));
    expect(expectedSourceUnreferenced).toHaveLength(139);
    expect(topology.sourceUnreferencedSounds).toEqual(
      expectedSourceUnreferenced,
    );
    expect(
      topology.sourceUnreferencedSounds.every(
        (sound) =>
          topology.sounds.find(
            (candidate) => candidate.soundKey === sound.soundKey,
          )?.referenced === false,
      ),
    ).toBe(true);
  });

  test("exposes source facts only and adds no playback or gameplay semantics", () => {
    const topology = project();
    expect(Reflect.ownKeys(topology)).toEqual([
      "counts",
      "sounds",
      "references",
      "sourceUnreferencedSounds",
    ]);
    expect(Reflect.ownKeys(topology.counts)).toEqual([
      "sounds",
      "soundTypes",
      "references",
      "heroSelectReferences",
      "heroDeadReferences",
      "monsterDeadReferences",
      "skillReferences",
      "stageBgmReferences",
      "referencedSounds",
      "sourceUnreferencedSounds",
      "unresolvedReferences",
    ]);
    expect(Reflect.ownKeys(topology.counts.soundTypes)).toEqual([
      "BattleLog",
      "BGM",
      "GameSFX",
      "UI_SFX",
    ]);
    expectExactDenseArrayOwnKeys(topology.sounds);
    expectExactDenseArrayOwnKeys(topology.references);
    expectExactDenseArrayOwnKeys(topology.sourceUnreferencedSounds);
    for (const sound of topology.sounds) {
      expect(Reflect.ownKeys(sound)).toEqual([
        "soundKey",
        "soundTypeRaw",
        "referenced",
        "provenance",
        "incomingReferences",
      ]);
      expect(Reflect.ownKeys(sound.provenance)).toEqual([
        "table",
        "primaryField",
        "primaryKey",
        "typeField",
        "rowIndex",
      ]);
      expectExactDenseArrayOwnKeys(sound.incomingReferences);
    }
    for (const reference of topology.references) {
      expect(Reflect.ownKeys(reference)).toEqual([
        "sourceTable",
        "sourceField",
        "sourceRowIndex",
        "sourceKey",
        "soundKey",
        "soundTypeRaw",
      ]);
    }
    for (const sound of topology.sourceUnreferencedSounds) {
      expect(Reflect.ownKeys(sound)).toEqual(["soundKey", "soundTypeRaw"]);
    }

    const names = projectedPropertyNames(topology);
    for (const forbidden of [
      "playback",
      "playing",
      "mixing",
      "timing",
      "duration",
      "volume",
      "audioclippath",
      "asset",
      "assetexists",
      "owner",
      "ownership",
      "eligible",
      "eligibility",
      "effect",
      "effects",
      "applied",
      "campaign",
      "random",
      "rng",
    ]) {
      expect(names.has(forbidden), forbidden).toBe(false);
    }
  });

  test("is pure, detached, recursively frozen, and leaves caller descriptors unchanged", () => {
    const mutable = cloneRelevantRows(indexes);
    const before = relevantFingerprint(mutable);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    let randomCalls = 0;
    let dateCalls = 0;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    Date.now = () => {
      dateCalls += 1;
      return 0;
    };

    let topology: SourceSoundTopology;
    try {
      topology = project({ indexes: mutable });
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }

    expect(randomCalls).toBe(0);
    expect(dateCalls).toBe(0);
    expect(relevantFingerprint(mutable)).toBe(before);
    expectDeeplyFrozen(topology!);
    expect(topology!.sounds[0]).not.toBe(
      mutable.tables.sounds.rows[0] as unknown,
    );
    expect(topology!.references).not.toBe(
      mutable.tables.heroes.rows as unknown,
    );

    const serialized = JSON.stringify(topology!);
    (
      mutable.tables.sounds.rows[0] as unknown as Record<string, unknown>
    ).SoundType = "FORGED";
    (
      mutable.tables.heroes.rows[0] as unknown as Record<string, unknown>
    ).SelectSoundKey = 9_999_999;
    expect(JSON.stringify(topology!)).toBe(serialized);
    expect(() => {
      (topology!.sounds as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (
        topology!.sounds[0]!.provenance as {
          rowIndex: number;
        }
      ).rowIndex = 99;
    }).toThrow(TypeError);
  });

  test("rejects non-exact roots, indexes, tables, and metadata without invoking accessors", () => {
    expect(() => project({ indexes, extra: true } as never)).toThrow(
      /unknown field/i,
    );
    expect(() => project({} as never)).toThrow(/missing field/i);
    expect(() =>
      project(
        Object.assign(Object.create({ hostile: true }), { indexes }) as never,
      ),
    ).toThrow(/prototype/i);
    expect(() =>
      project({ indexes, [Symbol("hidden")]: true } as never),
    ).toThrow(/symbol/i);

    let indexReads = 0;
    const accessorInput = {} as Record<string, unknown>;
    Object.defineProperty(accessorInput, "indexes", {
      enumerable: true,
      get() {
        indexReads += 1;
        return indexes;
      },
    });
    expect(() => project(accessorInput as never)).toThrow(
      /accessor|data property/i,
    );
    expect(indexReads).toBe(0);

    for (const [tableName, primaryField] of [
      ["sounds", "SoundKey"],
      ["heroes", "HeroKey"],
      ["monsters", "MonsterKey"],
      ["skills", "SkillKey"],
      ["stages", "StageKey"],
    ] as const) {
      expect(() =>
        project({
          indexes: replaceTable(indexes, tableName, {
            ...indexes.tables[tableName],
            primaryField: `${primaryField}Forged`,
          }),
        }),
      ).toThrow(/primaryField/i);
      expect(() =>
        project({
          indexes: replaceTable(indexes, tableName, {
            ...indexes.tables[tableName],
            name: tableName === "sounds" ? "heroes" : "sounds",
          }),
        }),
      ).toThrow(/name|table/i);
      expect(() =>
        project({
          indexes: cloneWithRows(indexes, tableName, (rows) => {
            rows.pop();
          }),
        }),
      ).toThrow(/rows|contain/i);
    }
  });

  test("rejects row, nested, and array accessors, symbols, prototypes, and sparse data", () => {
    let rowReads = 0;
    const accessorRow = cloneWithRows(indexes, "sounds", (rows) => {
      const row = rows[0]!;
      Object.defineProperty(row, "SoundKey", {
        enumerable: true,
        get() {
          rowReads += 1;
          return 10001;
        },
      });
    });
    expect(() => project({ indexes: accessorRow })).toThrow(
      /accessor|data property/i,
    );
    expect(rowReads).toBe(0);

    let nestedReads = 0;
    const nestedAccessor = cloneWithRows(indexes, "heroes", (rows) => {
      const localization = rows[0]!.HeroNameKey_i18n as Record<string, unknown>;
      const field = Object.keys(localization)[0]!;
      Object.defineProperty(localization, field, {
        enumerable: true,
        get() {
          nestedReads += 1;
          return "forged";
        },
      });
    });
    expect(() => project({ indexes: nestedAccessor })).toThrow(
      /nested|accessor|data property/i,
    );
    expect(nestedReads).toBe(0);

    const cyclicNested = cloneWithRows(indexes, "heroes", (rows) => {
      const cycle: Record<string, unknown> = {};
      cycle.self = cycle;
      rows[0]!.HeroNameKey_i18n = cycle;
    });
    const cycleSentinel = {};
    let cycleEscaped: unknown = cycleSentinel;
    let cycleError: unknown;
    try {
      cycleEscaped = project({ indexes: cyclicNested });
    } catch (error) {
      cycleError = error;
    }
    expect(cycleError).toBeInstanceOf(Error);
    expect(cycleError).not.toBeInstanceOf(TypeError);
    expect(cycleError).not.toBeInstanceOf(RangeError);
    expect((cycleError as Error).message).toBe(
      "heroes row 0.HeroNameKey_i18n.self must not contain cycles",
    );
    expect(cycleEscaped).toBe(cycleSentinel);

    const overdeepNested = cloneWithRows(indexes, "heroes", (rows) => {
      const root: Record<string, unknown> = {};
      let cursor = root;
      for (let depth = 0; depth < 66; depth += 1) {
        const next: Record<string, unknown> = {};
        cursor.next = next;
        cursor = next;
      }
      rows[0]!.HeroNameKey_i18n = root;
    });
    const depthSentinel = {};
    let depthEscaped: unknown = depthSentinel;
    let depthError: unknown;
    try {
      depthEscaped = project({ indexes: overdeepNested });
    } catch (error) {
      depthError = error;
    }
    expect(depthError).toBeInstanceOf(Error);
    expect(depthError).not.toBeInstanceOf(TypeError);
    expect(depthError).not.toBeInstanceOf(RangeError);
    expect((depthError as Error).message).toMatch(/nested depth exceeds 64/);
    expect(depthEscaped).toBe(depthSentinel);

    const nestedSymbol = cloneWithRows(indexes, "monsters", (rows) => {
      const localization = rows[0]!.MonsterNameStringKey_i18n as Record<
        string | symbol,
        unknown
      >;
      localization[Symbol("hidden")] = true;
    });
    expect(() => project({ indexes: nestedSymbol })).toThrow(/symbol/i);

    const nestedPrototype = cloneWithRows(indexes, "skills", (rows) => {
      Object.setPrototypeOf(
        rows[0]!.levels as object,
        Object.create(Array.prototype),
      );
    });
    expect(() => project({ indexes: nestedPrototype })).toThrow(/prototype/i);

    const sparseNested = cloneWithRows(indexes, "heroes", (rows) => {
      const values = rows[0]!.attribute_keys as unknown[];
      delete values[0];
    });
    expect(() => project({ indexes: sparseNested })).toThrow(/sparse|hole/i);

    const rowSymbol = cloneWithRows(indexes, "stages", (rows) => {
      rows[0]![Symbol("hidden") as never] = true;
    });
    expect(() => project({ indexes: rowSymbol })).toThrow(/symbol/i);

    const customRowPrototype = cloneWithRows(indexes, "sounds", (rows) => {
      rows[0] = Object.assign(Object.create({ hostile: true }), rows[0]);
    });
    expect(() => project({ indexes: customRowPrototype })).toThrow(
      /prototype/i,
    );

    const sparseRows = indexes.tables.sounds.rows.slice() as unknown[];
    delete sparseRows[10];
    expect(() =>
      project({
        indexes: replaceTable(indexes, "sounds", {
          ...indexes.tables.sounds,
          rows: sparseRows,
        }),
      }),
    ).toThrow(/sparse|hole/i);

    const hostileRows = indexes.tables.stages.rows.slice() as unknown[];
    Object.setPrototypeOf(hostileRows, Object.create(Array.prototype));
    expect(() =>
      project({
        indexes: replaceTable(indexes, "stages", {
          ...indexes.tables.stages,
          rows: hostileRows,
        }),
      }),
    ).toThrow(/Array\\.prototype|prototype/i);

    let proxyTraps = 0;
    const proxyRows = new Proxy(indexes.tables.sounds.rows.slice(), {
      getOwnPropertyDescriptor(target, key) {
        proxyTraps += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        proxyTraps += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        proxyTraps += 1;
        return Reflect.ownKeys(target);
      },
    });
    expect(() =>
      project({
        indexes: replaceTable(indexes, "sounds", {
          ...indexes.tables.sounds,
          rows: proxyRows,
        }),
      }),
    ).toThrow(/proxy|hostile|TOCTOU/i);
    expect(proxyTraps).toBe(0);
  });

  test("rejects proxies at every caller boundary with zero traps or input mutation", () => {
    const attacks: Array<{
      readonly name: string;
      readonly input: unknown;
      readonly target: object;
      readonly trapCalls: readonly string[];
    }> = [];
    const addAttack = (
      name: string,
      target: object,
      buildInput: (proxy: object) => unknown,
    ): void => {
      const hostile = hostileProxy(target);
      attacks.push({
        name,
        input: buildInput(hostile.proxy),
        target,
        trapCalls: hostile.trapCalls,
      });
    };

    const inputTarget = { indexes };
    addAttack("input", inputTarget, (proxy) => proxy);
    const callableTarget = (): void => {};
    addAttack("callable input", callableTarget, (proxy) => proxy);
    addAttack("indexes", indexes, (proxy) => ({ indexes: proxy }));
    addAttack("tables", indexes.tables, (proxy) => ({
      indexes: { ...indexes, tables: proxy },
    }));
    addAttack("table", indexes.tables.sounds, (proxy) => ({
      indexes: replaceTable(
        indexes,
        "sounds",
        proxy as Record<string, unknown>,
      ),
    }));

    const rowsTarget = indexes.tables.sounds.rows.slice();
    addAttack("rows", rowsTarget, (proxy) => ({
      indexes: replaceTable(indexes, "sounds", {
        ...indexes.tables.sounds,
        rows: proxy,
      }),
    }));

    const rowRows = structuredClone(
      indexes.tables.sounds.rows,
    ) as unknown as Record<string, unknown>[];
    const rowTarget = rowRows[0]!;
    addAttack("row", rowTarget, (proxy) => {
      rowRows[0] = proxy as Record<string, unknown>;
      return {
        indexes: replaceTable(indexes, "sounds", {
          ...indexes.tables.sounds,
          rows: rowRows,
        }),
      };
    });

    const nestedRows = structuredClone(
      indexes.tables.heroes.rows,
    ) as unknown as Record<string, unknown>[];
    const nestedTarget = nestedRows[0]!.HeroNameKey_i18n as object;
    addAttack("nested object", nestedTarget, (proxy) => {
      nestedRows[0]!.HeroNameKey_i18n = proxy;
      return {
        indexes: replaceTable(indexes, "heroes", {
          ...indexes.tables.heroes,
          rows: nestedRows,
        }),
      };
    });

    const revokedRows = structuredClone(
      indexes.tables.sounds.rows,
    ) as unknown as Record<string, unknown>[];
    const revokedTarget = revokedRows[0]!;
    const revoked = Proxy.revocable(revokedTarget, {});
    revoked.revoke();
    revokedRows[0] = revoked.proxy;
    attacks.push({
      name: "revoked row",
      input: {
        indexes: replaceTable(indexes, "sounds", {
          ...indexes.tables.sounds,
          rows: revokedRows,
        }),
      },
      target: revokedTarget,
      trapCalls: [],
    });

    const revokedCallableTarget = (): void => {};
    const revokedCallable = Proxy.revocable(revokedCallableTarget, {});
    revokedCallable.revoke();
    attacks.push({
      name: "revoked callable input",
      input: revokedCallable.proxy,
      target: revokedCallableTarget,
      trapCalls: [],
    });

    const canonicalBefore = relevantFingerprint(indexes);
    for (const attack of attacks) {
      const descriptorsBefore = ownDescriptorSnapshot(attack.target);
      const sentinel = {};
      let escaped: unknown = sentinel;
      let thrown: unknown;
      try {
        escaped = project(attack.input as never);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, attack.name).toBeInstanceOf(Error);
      expect(thrown, attack.name).not.toBeInstanceOf(TypeError);
      expect((thrown as Error).message, attack.name).toContain(
        "must not be a proxy or TOCTOU-capable object",
      );
      expect(escaped, attack.name).toBe(sentinel);
      expect(attack.trapCalls, attack.name).toEqual([]);
      expectOwnDescriptorsUnchanged(attack.target, descriptorsBefore);
    }
    expect(relevantFingerprint(indexes)).toBe(canonicalBefore);
  });

  test("rejects every canonical table row-count overflow at its exact limit", () => {
    for (const [tableName, expectedRows] of [
      ["sounds", 312],
      ["heroes", 6],
      ["monsters", 61],
      ["skills", 106],
      ["stages", 120],
    ] as const) {
      const oversized = indexes.tables[tableName].rows.slice() as unknown[];
      oversized.push(structuredClone(oversized.at(-1)!));
      let escaped: unknown = "SENTINEL";
      let thrown: unknown;
      try {
        escaped = project({
          indexes: replaceTable(indexes, tableName, {
            ...indexes.tables[tableName],
            rows: oversized,
          }),
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown, tableName).toBeInstanceOf(Error);
      expect(thrown, tableName).not.toBeInstanceOf(TypeError);
      expect((thrown as Error).message, tableName).toBe(
        `${tableName} must contain exactly ${expectedRows} source rows`,
      );
      expect(escaped, tableName).toBe("SENTINEL");
      expect(oversized).toHaveLength(expectedRows + 1);
    }
  });

  test("rejects oversized sparse rows before Array.from/Set amplification, enumeration, or index reads", () => {
    for (const [tableName, expectedRows] of [
      ["sounds", 312],
      ["heroes", 6],
      ["monsters", 61],
      ["skills", 106],
      ["stages", 120],
    ] as const) {
      const hostileRows: unknown[] = [];
      hostileRows.length = 1_000_000;
      let indexReads = 0;
      Object.defineProperty(hostileRows, "0", {
        configurable: true,
        enumerable: true,
        get() {
          indexReads += 1;
          return indexes.tables[tableName].rows[0];
        },
      });
      const indexDescriptor = Object.getOwnPropertyDescriptor(hostileRows, "0");
      const mutableArray = Array as unknown as {
        from: (...arguments_: unknown[]) => unknown[];
      };
      const mutableGlobal = globalThis as unknown as {
        Set: SetConstructor;
      };
      const mutableReflect = Reflect as {
        ownKeys: (target: object) => (string | symbol)[];
      };
      const originalArrayFrom = mutableArray.from;
      const OriginalSet = mutableGlobal.Set;
      const originalOwnKeys = mutableReflect.ownKeys;
      let arrayFromCalls = 0;
      let iterableSetConstructionCalls = 0;
      let rowOwnKeysCalls = 0;
      mutableArray.from = (...arguments_: unknown[]) => {
        arrayFromCalls += 1;
        return Reflect.apply(originalArrayFrom, Array, arguments_) as unknown[];
      };
      class CountingSet<T> extends OriginalSet<T> {
        constructor(iterable?: Iterable<T> | null) {
          if (iterable !== undefined && iterable !== null) {
            iterableSetConstructionCalls += 1;
          }
          super(iterable);
        }
      }
      mutableGlobal.Set = CountingSet as SetConstructor;
      mutableReflect.ownKeys = (target: object) => {
        if (target === hostileRows) rowOwnKeysCalls += 1;
        return originalOwnKeys(target);
      };

      let escaped: unknown = "SENTINEL";
      let thrown: unknown;
      try {
        escaped = project({
          indexes: replaceTable(indexes, tableName, {
            ...indexes.tables[tableName],
            rows: hostileRows,
          }),
        });
      } catch (error) {
        thrown = error;
      } finally {
        mutableArray.from = originalArrayFrom;
        mutableGlobal.Set = OriginalSet;
        mutableReflect.ownKeys = originalOwnKeys;
      }

      expect(thrown, tableName).toBeInstanceOf(Error);
      expect(thrown, tableName).not.toBeInstanceOf(TypeError);
      expect((thrown as Error).message, tableName).toBe(
        `${tableName} must contain exactly ${expectedRows} source rows`,
      );
      expect(escaped, tableName).toBe("SENTINEL");
      expect(arrayFromCalls, tableName).toBe(0);
      expect(iterableSetConstructionCalls, tableName).toBe(0);
      expect(rowOwnKeysCalls, tableName).toBe(0);
      expect(indexReads, tableName).toBe(0);
      expect(hostileRows, tableName).toHaveLength(1_000_000);
      expect(
        Object.getOwnPropertyDescriptor(hostileRows, "0"),
        tableName,
      ).toEqual(indexDescriptor);
    }
  });

  test("never calls caller groups or semanticReport and rejects wrapper accessors with zero reads", () => {
    let derivedCalls = 0;
    const hostileDerivedValue = new Proxy(
      {},
      {
        get() {
          derivedCalls += 1;
          throw new Error("derived value was invoked");
        },
        ownKeys() {
          derivedCalls += 1;
          throw new Error("derived value was inspected");
        },
      },
    );
    let hostile = {
      ...indexes,
      semanticReport: hostileDerivedValue,
      tables: { ...indexes.tables },
    } as unknown as DiscordHeroCatalogIndexes;
    for (const tableName of RELEVANT_TABLES) {
      hostile = replaceTable(hostile, tableName, {
        ...hostile.tables[tableName],
        groups: hostileDerivedValue,
      });
    }
    expect(project({ indexes: hostile })).toEqual(project());
    expect(derivedCalls).toBe(0);

    let groupReads = 0;
    const accessorTable = {
      ...indexes.tables.sounds,
    } as Record<string, unknown>;
    Object.defineProperty(accessorTable, "groups", {
      enumerable: true,
      get() {
        groupReads += 1;
        return indexes.tables.sounds.groups;
      },
    });
    expect(() =>
      project({
        indexes: replaceTable(indexes, "sounds", accessorTable),
      }),
    ).toThrow(/groups|accessor|data property/i);
    expect(groupReads).toBe(0);

    let semanticReads = 0;
    const accessorIndexes = { ...indexes };
    Object.defineProperty(accessorIndexes, "semanticReport", {
      enumerable: true,
      get() {
        semanticReads += 1;
        return indexes.semanticReport;
      },
    });
    expect(() =>
      project({
        indexes: accessorIndexes as DiscordHeroCatalogIndexes,
      }),
    ).toThrow(/semanticReport|accessor|data property/i);
    expect(semanticReads).toBe(0);
  });

  test("rejects duplicate, reordered, ghost, nonfinite, unsafe, and same-count forged source vectors", () => {
    const attacks: Array<{
      readonly name: string;
      readonly value: DiscordHeroCatalogIndexes;
    }> = [
      {
        name: "duplicate sound key",
        value: cloneWithRows(indexes, "sounds", (rows) => {
          rows[1]!.SoundKey = rows[0]!.SoundKey;
        }),
      },
      {
        name: "reordered sound rows",
        value: cloneWithRows(indexes, "sounds", (rows) => {
          [rows[0], rows[1]] = [rows[1]!, rows[0]!];
        }),
      },
      {
        name: "ghost sound key",
        value: cloneWithRows(indexes, "sounds", (rows) => {
          rows[0]!.SoundKey = 9_999_999;
        }),
      },
      {
        name: "forged sound type",
        value: cloneWithRows(indexes, "sounds", (rows) => {
          rows[0]!.SoundType = "Voice";
        }),
      },
      {
        name: "nonfinite relation",
        value: cloneWithRows(indexes, "monsters", (rows) => {
          rows[0]!.DeadSoundKey = Number.NaN;
        }),
      },
      {
        name: "unsafe relation",
        value: cloneWithRows(indexes, "stages", (rows) => {
          rows[0]!.BGMSoundKey = Number.MAX_SAFE_INTEGER + 1;
        }),
      },
      {
        name: "same-count sound forgery",
        value: cloneWithRows(indexes, "sounds", (rows) => {
          rows[100]!.SoundKey = 9_000_001;
        }),
      },
      {
        name: "reordered relation source rows",
        value: cloneWithRows(indexes, "heroes", (rows) => {
          [rows[0], rows[1]] = [rows[1]!, rows[0]!];
        }),
      },
      {
        name: "forged nullable skill relation",
        value: cloneWithRows(indexes, "skills", (rows) => {
          const row = rows.find((candidate) => candidate.SoundKey === null)!;
          row.SoundKey = 10001;
        }),
      },
    ];

    for (const attack of attacks) {
      let escaped: unknown = "SENTINEL";
      expect(() => {
        escaped = project({ indexes: attack.value });
      }, attack.name).toThrow(
        /pinned|source|order|duplicate|safe|finite|type|key/i,
      );
      expect(escaped, attack.name).toBe("SENTINEL");
    }
  });

  test("rejects count-preserving canonical relation swaps at the exact table SHA pin", () => {
    for (const [tableName, field] of [
      ["monsters", "DeadSoundKey"],
      ["skills", "SoundKey"],
      ["stages", "BGMSoundKey"],
    ] as const) {
      const forged = cloneWithRows(indexes, tableName, (rows) => {
        const otherIndex = rows.findIndex(
          (row, index) => index > 0 && row[field] !== rows[0]![field],
        );
        expect(otherIndex, `${tableName} fixture`).toBeGreaterThan(0);
        [rows[0]![field], rows[otherIndex]![field]] = [
          rows[otherIndex]![field],
          rows[0]![field],
        ];
      });
      const before = relevantFingerprint(forged);
      const sentinel = {};
      let escaped: unknown = sentinel;
      let thrown: unknown;
      try {
        escaped = project({ indexes: forged });
      } catch (error) {
        thrown = error;
      }
      expect(thrown, tableName).toBeInstanceOf(Error);
      expect(thrown, tableName).not.toBeInstanceOf(TypeError);
      expect((thrown as Error).message, tableName).toBe(
        `${tableName} do not match the pinned source order and values`,
      );
      expect(escaped, tableName).toBe(sentinel);
      expect(relevantFingerprint(forged), tableName).toBe(before);
    }
  });

  test("recomputes joins and reaches the dangling guard for every sound relation", () => {
    for (const [tableName, field] of [
      ["heroes", "SelectSoundKey"],
      ["heroes", "DeadSoundKey"],
      ["monsters", "DeadSoundKey"],
      ["skills", "SoundKey"],
      ["stages", "BGMSoundKey"],
    ] as const) {
      const forged = cloneWithRows(indexes, tableName, (rows) => {
        rows[0]![field] = 9_999_999;
      });
      const before = relevantFingerprint(forged);
      const sentinel = {};
      let escaped: unknown = sentinel;
      let thrown: unknown;
      try {
        escaped = project({ indexes: forged });
      } catch (error) {
        thrown = error;
      }
      expect(thrown, `${tableName}.${field}`).toBeInstanceOf(Error);
      expect(thrown, `${tableName}.${field}`).not.toBeInstanceOf(TypeError);
      expect((thrown as Error).message, `${tableName}.${field}`).toBe(
        `${tableName}.${field} row 0 has dangling sound reference 9999999`,
      );
      expect(escaped, `${tableName}.${field}`).toBe(sentinel);
      expect(relevantFingerprint(forged), `${tableName}.${field}`).toBe(before);
    }
  });
});
