import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroUnresolvedReference,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectDropTopology } from "./drop-topology";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function counts(values: readonly unknown[]): Record<string, number> {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = String(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...result].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function rebuildGroupedRows<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  primary: string,
): Map<number | string, Row[]> {
  const groups = new Map<number | string, Row[]>();
  for (const row of rows) {
    const key = row[primary] as number | string;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return groups;
}

function withDropRows(
  source: DiscordHeroCatalogIndexes,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables.drops.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      drops: {
        ...source.tables.drops,
        rows,
        groups: rebuildGroupedRows(rows, "DropKey"),
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withItemGroupRows(
  source: DiscordHeroCatalogIndexes,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables.item_groups.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      item_groups: {
        ...source.tables.item_groups,
        rows,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withItemRows(
  source: DiscordHeroCatalogIndexes,
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables.items.rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      items: {
        ...source.tables.items,
        rows,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withUnresolvedReference(
  source: DiscordHeroCatalogIndexes,
  reference: DiscordHeroUnresolvedReference,
): DiscordHeroCatalogIndexes {
  return {
    ...source,
    semanticReport: {
      ...source.semanticReport,
      unresolvedReferences: Object.freeze([
        ...source.semanticReport.unresolvedReferences,
        reference,
      ]),
      unresolvedReferenceCount:
        source.semanticReport.unresolvedReferenceCount + 1,
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

describe("DiscordHero drop topology projection", () => {
  test("projects the exact pinned corpus counts, taxonomy, and pure classifier", () => {
    const topology = projectDropTopology({ indexes });

    expect(topology.counts).toEqual({
      dropRows: 6_303,
      dropKeyGroups: 245,
      itemGroupRows: 2_275,
      itemGroupKeys: 1_118,
      items: 5_944,
      pureWeightedGroups: 157,
      mixedOrConditionalGroups: 88,
    });
    expect(topology.taxonomy.rewardTypes).toEqual({
      ITEMGROUP: 6_147,
      ITEM: 156,
    });
    expect(topology.taxonomy.dropTypes).toEqual({
      EachDropOneWeight_DLCVariant: 5_257,
      EachDropOneWeight: 1_040,
      SelectOneByClass: 6,
    });
    expect(topology.taxonomy.heroKeyConditions).toEqual({
      null: 3_849,
      zero: 496,
      positive: 1_958,
    });
    expect(topology.groups).toHaveLength(245);
    expect(
      topology.groups.reduce((total, group) => total + group.rows.length, 0),
    ).toBe(6_303);
    expect(
      topology.groups.filter((group) => group.classifier === "pure-weighted"),
    ).toHaveLength(157);
    expect(
      topology.groups.filter(
        (group) => group.classifier === "mixed-or-conditional",
      ),
    ).toHaveLength(88);
  });

  test("preserves source DropKey first-appearance order and in-group row order", () => {
    const topology = projectDropTopology({ indexes });
    const firstAppearance: number[] = [];
    const seen = new Set<number>();
    for (const row of indexes.tables.drops.rows) {
      if (!seen.has(row.DropKey)) {
        seen.add(row.DropKey);
        firstAppearance.push(row.DropKey);
      }
    }
    expect(topology.groups.map((group) => group.dropKey)).toEqual(
      firstAppearance,
    );

    for (const group of topology.groups) {
      const sourceRows = indexes.tables.drops.groups.get(group.dropKey)!;
      expect(group.rows.map((row) => row.globalRowIndex)).toEqual(
        sourceRows.map((row) => indexes.tables.drops.rows.indexOf(row)),
      );
      expect(
        group.rows.map((row) => ({
          DropKey: row.dropKey,
          DropType: row.dropTypeRaw,
          REWARDTYPE: row.rewardType,
          RewardKey: row.rewardKey,
          HeroKeyCondition: row.heroKeyCondition,
          Weight: row.weightRaw,
        })),
      ).toEqual(
        sourceRows.map((row) => ({
          DropKey: row.DropKey,
          DropType: row.DropType,
          REWARDTYPE: row.REWARDTYPE as "ITEM" | "ITEMGROUP",
          RewardKey: row.RewardKey,
          HeroKeyCondition: row.HeroKeyCondition,
          Weight: row.Weight,
        })),
      );
    }
  });

  test("preserves raw hero null and zero sentinels without normalizing eligibility", () => {
    const topology = projectDropTopology({ indexes });
    const heroCounts = counts(
      topology.groups.flatMap((group) =>
        group.rows.map((row) =>
          row.heroKeyCondition === null
            ? "null"
            : row.heroKeyCondition === 0
              ? "zero"
              : "positive",
        ),
      ),
    );
    expect(heroCounts).toEqual({ null: 3_849, positive: 1_958, zero: 496 });

    const zeroRow = topology.groups
      .flatMap((group) => group.rows)
      .find((row) => row.heroKeyCondition === 0);
    expect(zeroRow).toBeDefined();
    expect(zeroRow!.heroKeyCondition).toBe(0);
    expect(zeroRow!.heroKeyCondition).not.toBeNull();
  });

  test("resolves ITEM by exact items key and ITEMGROUP members in exact source order", () => {
    const topology = projectDropTopology({ indexes });
    const itemRows = topology.groups.flatMap((group) =>
      group.rows.filter((row) => row.rewardType === "ITEM"),
    );
    const groupRows = topology.groups.flatMap((group) =>
      group.rows.filter((row) => row.rewardType === "ITEMGROUP"),
    );
    expect(itemRows).toHaveLength(156);
    expect(groupRows).toHaveLength(6_147);

    for (const row of itemRows) {
      expect(row.reward.kind).toBe("resolved-item");
      if (row.reward.kind !== "resolved-item") continue;
      expect(row.reward.itemKey).toBe(row.rewardKey);
      const item = indexes.tables.items.groups.get(row.rewardKey)?.[0];
      expect(item).toBeDefined();
      expect(row.reward.item).toEqual({
        itemKey: item!.id,
        grade: item!.grade,
        itemType: item!.type,
      });
    }

    for (const row of groupRows) {
      expect(row.reward.kind).toBe("resolved-item-group");
      if (row.reward.kind !== "resolved-item-group") continue;
      expect(row.reward.itemGroupKey).toBe(row.rewardKey);
      const members = indexes.tables.item_groups.groups.get(row.rewardKey)!;
      expect(row.reward.members).toHaveLength(members.length);
      row.reward.members.forEach((member, index) => {
        expect(member.itemGroupKey).toBe(row.rewardKey);
        expect(member.itemKey).toBe(members[index]!.ItemKey);
        expect(member.groupName).toBe(members[index]!.GroupName);
        expect(member.item.kind).toBe("resolved-item");
        if (member.item.kind !== "resolved-item") return;
        const item = indexes.tables.items.groups.get(member.itemKey)?.[0];
        expect(member.item.item).toEqual({
          itemKey: item!.id,
          grade: item!.grade,
          itemType: item!.type,
        });
      });
    }
  });

  test("classifies pure-weighted only when every row is EachDropOneWeight with null hero condition", () => {
    const topology = projectDropTopology({ indexes });
    for (const group of topology.groups) {
      const sourceRows = indexes.tables.drops.groups.get(group.dropKey)!;
      const pure = sourceRows.every(
        (row) =>
          row.DropType === "EachDropOneWeight" && row.HeroKeyCondition === null,
      );
      expect(group.classifier).toBe(
        pure ? "pure-weighted" : "mixed-or-conditional",
      );
    }
    const pureKeys = topology.groups
      .filter((group) => group.classifier === "pure-weighted")
      .map((group) => group.dropKey);
    for (const dropKey of pureKeys) {
      const rows = indexes.tables.drops.groups.get(dropKey)!;
      expect(
        rows.every(
          (row) =>
            row.DropType === "EachDropOneWeight" &&
            row.HeroKeyCondition === null,
        ),
      ).toBe(true);
    }
  });

  test("returns detached deeply frozen topology without aliasing source rows", () => {
    const first = projectDropTopology({ indexes });
    const second = projectDropTopology({ indexes });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.groups).not.toBe(second.groups);
    expect(first.groups[0]).not.toBe(second.groups[0]);
    expect(first.groups[0]!.rows).not.toBe(second.groups[0]!.rows);
    expectDeeplyFrozen(first);

    const sourceRow = indexes.tables.drops.rows[0]!;
    const projected = first.groups[0]!.rows[0]!;
    expect(projected.dropKey).toBe(sourceRow.DropKey);
    expect(projected).not.toBe(sourceRow as unknown as typeof projected);
  });

  test("fails closed on unknown input fields, partial own data, prototypes, symbols, and accessors", () => {
    expect(() =>
      projectDropTopology({
        indexes,
        rng: () => 0,
      } as never),
    ).toThrow("unknown field");

    expect(() => projectDropTopology({} as never)).toThrow("missing field");

    const proto = Object.create({ indexes });
    expect(() => projectDropTopology(proto as never)).toThrow("prototype");

    const withSymbol = {
      indexes,
      [Symbol("secret")]: true,
    };
    expect(() => projectDropTopology(withSymbol as never)).toThrow();

    let reads = 0;
    const accessor = {
      get indexes() {
        reads += 1;
        return indexes;
      },
    };
    expect(() => projectDropTopology(accessor as never)).toThrow();
    expect(reads).toBe(0);

    const partialDrop = withDropRows(indexes, (rows) => {
      const { Weight: _weight, ...rest } = rows[0]!;
      rows[0] = rest;
    });
    expect(() => projectDropTopology({ indexes: partialDrop })).toThrow(
      "missing field",
    );
  });

  test("fails closed on missing joins unless they match a catalog-declared unresolved limitation", () => {
    const ghostItemKey = 9_999_999;
    const groupKey = indexes.tables.drops.rows.find(
      (row) => row.REWARDTYPE === "ITEMGROUP",
    )!.RewardKey;
    const poisonedGroups = withItemGroupRows(indexes, (rows) => {
      const member = rows.find((row) => row.ItemGroupKey === groupKey);
      expect(member).toBeDefined();
      member!.ItemKey = ghostItemKey;
    });
    const poisonedGroupRows = poisonedGroups.tables.item_groups.rows;
    const rebuiltGroups = new Map<
      number,
      Array<(typeof poisonedGroupRows)[number]>
    >();
    for (const row of poisonedGroupRows) {
      const bucket = rebuiltGroups.get(row.ItemGroupKey) ?? [];
      bucket.push(row);
      rebuiltGroups.set(row.ItemGroupKey, bucket);
    }
    const missingJoinIndexes = {
      ...poisonedGroups,
      tables: {
        ...poisonedGroups.tables,
        item_groups: {
          ...poisonedGroups.tables.item_groups,
          groups: rebuiltGroups,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: missingJoinIndexes })).toThrow(
      /item|items/i,
    );

    // A fully matching forged tuple must NOT rescue the missing join. The
    // pinned catalog declares zero topology-relevant unresolved references, so
    // an entry naming one of those rules is caller-supplied authority and is
    // rejected outright rather than emitted as provenance.
    const declared: DiscordHeroUnresolvedReference = Object.freeze({
      ruleId: "item_groups.ItemKey->items",
      sourceTable: "item_groups",
      sourceField: "ItemKey",
      sourceKey: groupKey,
      targetTable: "items",
      targetKey: ghostItemKey,
      reason: "test-injected catalog limitation",
    });
    const withLimitation = withUnresolvedReference(
      missingJoinIndexes,
      declared,
    );

    let escaped: unknown = "SENTINEL";
    expect(() => {
      escaped = projectDropTopology({ indexes: withLimitation });
    }).toThrow(/topology-relevant unresolved reference/i);
    expect(escaped).toBe("SENTINEL");
  });

  test("fails closed on duplicate DropKey corruption, wrong primary, and unsupported reward types", () => {
    const wrongPrimary = withDropRows(indexes, (rows) => {
      rows[0] = { ...rows[0]!, DropKey: -1 };
    });
    expect(() => projectDropTopology({ indexes: wrongPrimary })).toThrow(
      /positive safe integer|DropKey/i,
    );

    const badReward = withDropRows(indexes, (rows) => {
      rows[0] = { ...rows[0]!, REWARDTYPE: "CURRENCY" };
    });
    expect(() => projectDropTopology({ indexes: badReward })).toThrow(
      /reward type|REWARDTYPE|unknown value/i,
    );

    const ghostGroupKey = 8_888_888;
    const missingGroup = withDropRows(indexes, (rows) => {
      const target = rows.find((row) => row.REWARDTYPE === "ITEMGROUP");
      expect(target).toBeDefined();
      target!.RewardKey = ghostGroupKey;
    });
    expect(() => projectDropTopology({ indexes: missingGroup })).toThrow(
      /item group|ITEMGROUP/i,
    );

    const itemOnly = indexes.tables.drops.rows.find(
      (row) => row.REWARDTYPE === "ITEM",
    )!;
    const missingItemReward = withDropRows(indexes, (rows) => {
      const target = rows.find(
        (row) =>
          row.DropKey === itemOnly.DropKey &&
          row.RewardKey === itemOnly.RewardKey,
      );
      expect(target).toBeDefined();
      target!.RewardKey = 9_999_998;
    });
    expect(() => projectDropTopology({ indexes: missingItemReward })).toThrow(
      /item|items/i,
    );
  });

  test("exposes provenance-only facts and never invents selection, odds, or inventory outcomes", () => {
    const topology = projectDropTopology({ indexes });
    const serialized = JSON.stringify(topology).toLowerCase();
    for (const forbidden of [
      "guaranteed",
      "probability",
      "pity",
      "eligible",
      "selected",
      "awarded",
      "inventory",
      "rng",
      "stagebox open",
      "class choice",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(topology).not.toHaveProperty("selectedReward");
    expect(topology).not.toHaveProperty("probabilities");
  });

  test("reviewer PoCs: primaryField, ghost groups, duplicate ids, reversed group order, nested getters", () => {
    const wrongPrimaryField = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: {
          ...indexes.tables.drops,
          primaryField: "RewardKey",
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: wrongPrimaryField })).toThrow(
      /primaryField must be DropKey/,
    );

    // Ghost/replaced groups at same size: claim only a rotated key set while rows stay complete.
    const realKeys = [...indexes.tables.drops.groups.keys()] as number[];
    const ghostGroups = new Map(indexes.tables.drops.groups);
    const firstKey = realKeys[0]!;
    const firstRows = indexes.tables.drops.groups.get(firstKey)!;
    ghostGroups.delete(firstKey);
    ghostGroups.set(9_000_001, firstRows);
    const ghostIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: {
          ...indexes.tables.drops,
          groups: ghostGroups,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    // groups is a derived index, never authority: a rotated/ghosted key set
    // cannot influence the projection at all, which is strictly stronger than
    // detecting it. Output must be byte-identical to the clean projection.
    expect(JSON.stringify(projectDropTopology({ indexes: ghostIndexes }))).toBe(
      JSON.stringify(projectDropTopology({ indexes })),
    );

    const duplicateItem = withItemRows(indexes, (rows) => {
      rows[1] = { ...rows[1]!, id: rows[0]!.id };
    });
    const duplicateItemIndexes = {
      ...duplicateItem,
      tables: {
        ...duplicateItem.tables,
        items: {
          ...duplicateItem.tables.items,
          groups: rebuildGroupedRows(
            duplicateItem.tables.items.rows as unknown as Record<
              string,
              unknown
            >[],
            "id",
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() =>
      projectDropTopology({ indexes: duplicateItemIndexes }),
    ).toThrow(/unique/i);

    // Reverse claimed group membership for one multi-member item group without
    // mutating the rows array; output must not silently follow the hostile map.
    const multiGroupKey = indexes.tables.item_groups.rows.find(
      (row, _index, all) =>
        all.filter((candidate) => candidate.ItemGroupKey === row.ItemGroupKey)
          .length > 1,
    )!.ItemGroupKey;
    const originalMembers = [
      ...indexes.tables.item_groups.groups.get(multiGroupKey)!,
    ];
    expect(originalMembers.length).toBeGreaterThan(1);
    const reversedMembers = [...originalMembers].reverse();
    const reversedGroups = new Map(indexes.tables.item_groups.groups);
    reversedGroups.set(multiGroupKey, reversedMembers);
    const reversedIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        item_groups: {
          ...indexes.tables.item_groups,
          groups: reversedGroups,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    // Member order comes from the captured rows, so a reversed claimed map
    // cannot reorder anything: the projection is byte-identical to the clean
    // one and still lists this group's members in true source order.
    const reversedTopology = projectDropTopology({ indexes: reversedIndexes });
    expect(JSON.stringify(reversedTopology)).toBe(
      JSON.stringify(projectDropTopology({ indexes })),
    );
    const sourceOrder = indexes.tables.item_groups.rows
      .filter((row) => row.ItemGroupKey === multiGroupKey)
      .map((row) => row.ItemKey);
    const projectedOrder = reversedTopology.groups
      .flatMap((group) => group.rows)
      .filter(
        (row) =>
          row.rewardType === "ITEMGROUP" && row.rewardKey === multiGroupKey,
      )
      .flatMap((row) =>
        row.reward.kind === "resolved-item-group"
          ? row.reward.members.map((member) => member.itemKey)
          : [],
      );
    if (projectedOrder.length > 0) {
      expect(projectedOrder.slice(0, sourceOrder.length)).toEqual(sourceOrder);
    }

    // Nested tables.drops getter must not be polled repeatedly after snapshot.
    let dropsReads = 0;
    const nestedTables = { ...indexes.tables };
    const realDrops = indexes.tables.drops;
    Object.defineProperty(nestedTables, "drops", {
      enumerable: true,
      configurable: true,
      get() {
        dropsReads += 1;
        return realDrops;
      },
    });
    const nestedIndexes = {
      ...indexes,
      tables: nestedTables,
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: nestedIndexes })).toThrow(
      /own data property|accessor/i,
    );
    expect(dropsReads).toBe(0);
  });

  test("reviewer PoCs: hostile prototypes, semanticReport accessor, forged unresolved identity", () => {
    const customProtoTables = Object.assign(
      Object.create({ hostile: true }),
      indexes.tables,
    );
    const customProtoIndexes = {
      ...indexes,
      tables: customProtoTables,
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: customProtoIndexes })).toThrow(
      /prototype/i,
    );

    const hostileRows = indexes.tables.drops.rows.slice() as unknown[];
    Object.setPrototypeOf(hostileRows, {
      ...Array.prototype,
      map: () => {
        throw new Error("hostile map");
      },
    });
    const hostileArrayIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: {
          ...indexes.tables.drops,
          rows: hostileRows,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: hostileArrayIndexes })).toThrow(
      /Array\.prototype/i,
    );

    let semanticReads = 0;
    const semanticHost = { ...indexes };
    const realSemantic = indexes.semanticReport;
    Object.defineProperty(semanticHost, "semanticReport", {
      enumerable: true,
      configurable: true,
      get() {
        semanticReads += 1;
        return realSemantic;
      },
    });
    expect(() =>
      projectDropTopology({
        indexes: semanticHost as unknown as DiscordHeroCatalogIndexes,
      }),
    ).toThrow(/own data property|accessor/i);
    expect(semanticReads).toBe(0);

    const ghostItemKey = 9_777_777;
    const groupKey = indexes.tables.drops.rows.find(
      (row) => row.REWARDTYPE === "ITEMGROUP",
    )!.RewardKey;
    const poisoned = withItemGroupRows(indexes, (rows) => {
      const member = rows.find((row) => row.ItemGroupKey === groupKey)!;
      member.ItemKey = ghostItemKey;
    });
    const rebuilt = rebuildGroupedRows(
      poisoned.tables.item_groups.rows as unknown as Record<string, unknown>[],
      "ItemGroupKey",
    );
    const poisonedIndexes = {
      ...poisoned,
      tables: {
        ...poisoned.tables,
        item_groups: {
          ...poisoned.tables.item_groups,
          groups: rebuilt,
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    let reasonReads = 0;
    const forged = {
      ruleId: "item_groups.ItemKey->items",
      sourceTable: "drops",
      sourceField: "RewardKey",
      sourceKey: groupKey,
      targetTable: "item_groups",
      targetKey: ghostItemKey,
      get reason() {
        reasonReads += 1;
        return "forged accessor reason";
      },
    };
    const forgedIndexes = {
      ...poisonedIndexes,
      semanticReport: {
        ...poisonedIndexes.semanticReport,
        unresolvedReferences: [
          ...poisonedIndexes.semanticReport.unresolvedReferences,
          forged,
        ],
        unresolvedReferenceCount:
          poisonedIndexes.semanticReport.unresolvedReferenceCount + 1,
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: forgedIndexes })).toThrow();
    expect(reasonReads).toBe(0);

    // Wrong relation identity even with data properties must not authenticate.
    const wrongIdentity: DiscordHeroUnresolvedReference = Object.freeze({
      ruleId: "item_groups.ItemKey->items",
      sourceTable: "drops",
      sourceField: "RewardKey",
      sourceKey: groupKey,
      targetTable: "item_groups",
      targetKey: ghostItemKey,
      reason: "wrong tables/fields",
    });
    const wrongIdentityIndexes = withUnresolvedReference(
      poisonedIndexes,
      wrongIdentity,
    );
    // Still must not authenticate. It is now rejected even earlier: naming a
    // topology-relevant rule at all is caller authority, regardless of whether
    // the rest of the tuple matches.
    expect(() =>
      projectDropTopology({ indexes: wrongIdentityIndexes }),
    ).toThrow(
      /topology-relevant unresolved reference|not a catalog-declared unresolved limitation/i,
    );
  });

  test("reviewer PoCs: unreferenced item corruption, snapshot stability, Math.random silence", () => {
    // Corrupt an item that no drop/item_group references by using a high-id row
    // that is not RewardKey of any ITEM drop and not any ItemGroup ItemKey —
    // still must validate all item rows.
    const referenced = new Set<number>();
    for (const row of indexes.tables.drops.rows) {
      if (row.REWARDTYPE === "ITEM") referenced.add(row.RewardKey);
    }
    for (const row of indexes.tables.item_groups.rows) {
      referenced.add(row.ItemKey);
    }
    const unreferenced = indexes.tables.items.rows.find(
      (row) => !referenced.has(row.id),
    );
    expect(unreferenced).toBeDefined();
    const badGrade = withItemRows(indexes, (rows) => {
      const target = rows.find((row) => row.id === unreferenced!.id)!;
      target.grade = "";
    });
    const badGradeIndexes = {
      ...badGrade,
      tables: {
        ...badGrade.tables,
        items: {
          ...badGrade.tables.items,
          groups: rebuildGroupedRows(
            badGrade.tables.items.rows as unknown as Record<string, unknown>[],
            "id",
          ),
        },
      },
    } as unknown as DiscordHeroCatalogIndexes;
    expect(() => projectDropTopology({ indexes: badGradeIndexes })).toThrow(
      /grade|non-empty/i,
    );

    const input = { indexes };
    const beforeIndexes = JSON.stringify({
      drops: indexes.tables.drops.rows.length,
      item_groups: indexes.tables.item_groups.rows.length,
      items: indexes.tables.items.rows.length,
      unresolved: indexes.semanticReport.unresolvedReferences.length,
    });
    const topology = projectDropTopology(input);
    expect(
      JSON.stringify({
        drops: indexes.tables.drops.rows.length,
        item_groups: indexes.tables.item_groups.rows.length,
        items: indexes.tables.items.rows.length,
        unresolved: indexes.semanticReport.unresolvedReferences.length,
      }),
    ).toBe(beforeIndexes);

    const firstGroup = topology.groups[0]!;
    expect(() => {
      (firstGroup.rows as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (topology.groups as unknown as unknown[]).push({});
    }).toThrow(TypeError);

    let randomCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      randomCalls += 1;
      return 0;
    };
    try {
      projectDropTopology({ indexes });
      expect(randomCalls).toBe(0);
    } finally {
      Math.random = originalRandom;
    }
  });
});

/**
 * Builds a `groups` value whose ordinary APIs and own accessor carry
 * caller-supplied executable code. Every entry point records and sabotages if
 * invoked. The test below proves descriptor rejection invokes none of these
 * APIs or values; Proxy metaobject-trap capture ordering is tested separately.
 */
function hostileGroups(
  onCall: (api: string) => void,
  sabotage: () => void,
): unknown {
  const real = new Map<number, unknown[]>();
  const hostile = {
    get(key: number) {
      onCall("get");
      sabotage();
      return real.get(key);
    },
    has(key: number) {
      onCall("has");
      sabotage();
      return real.has(key);
    },
    entries() {
      onCall("entries");
      sabotage();
      return real.entries();
    },
    keys() {
      onCall("keys");
      sabotage();
      return real.keys();
    },
    values() {
      onCall("values");
      sabotage();
      return real.values();
    },
    forEach(callback: (value: unknown, key: number) => void) {
      onCall("forEach");
      sabotage();
      real.forEach(callback);
    },
  };
  Object.defineProperty(hostile, "size", {
    enumerable: true,
    configurable: true,
    get() {
      onCall("size");
      sabotage();
      return real.size;
    },
  });
  return hostile;
}

function deepSnapshot(source: DiscordHeroCatalogIndexes): string {
  return JSON.stringify({
    drops: source.tables.drops.rows,
    itemGroups: source.tables.item_groups.rows,
    items: source.tables.items.rows,
    unresolved: source.semanticReport.unresolvedReferences,
  });
}

describe("DiscordHero drop topology trust boundary", () => {
  test("invokes no ordinary group API or own accessor/callable value, and rejects them", () => {
    for (const table of ["drops", "item_groups", "items"] as const) {
      const calls: string[] = [];
      const liveRows = indexes.tables.items.rows.map((row) => ({
        ...row,
      })) as Record<string, unknown>[];
      const hostile = {
        ...indexes,
        tables: {
          ...indexes.tables,
          items: { ...indexes.tables.items, rows: liveRows },
          [table]: {
            ...indexes.tables[table],
            groups: hostileGroups(
              (api) => calls.push(`${table}.${api}`),
              () => {
                // would corrupt caller-owned input if an ordinary API ran
                liveRows[0]!.grade = "FORGED";
              },
            ),
          },
        },
      } as unknown as DiscordHeroCatalogIndexes;

      const before = deepSnapshot(hostile);
      let escaped: unknown = "SENTINEL";
      let caught: unknown = null;
      try {
        escaped = projectDropTopology({ indexes: hostile });
      } catch (error) {
        caught = error;
      }

      // 1. zero ordinary group API/accessor code executed
      expect(`${table}:${calls.join(",")}`).toBe(`${table}:`);
      // 2. throws, with no output escaping
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(TypeError);
      expect(escaped).toBe("SENTINEL");
      // 3. inputs untouched, byte for byte
      expect(deepSnapshot(hostile)).toBe(before);
      expect(liveRows[0]!.grade).not.toBe("FORGED");
    }
  });

  test("captures every authoritative row before a Proxy groups trap can run", () => {
    // A Proxy trap runs on Reflect.ownKeys and
    // Object.getOwnPropertyDescriptor, which is exactly how the inert-groups
    // gate inspects the value. The guarantee is capture ORDERING: every
    // authoritative drops/item_groups/items row is snapshotted by value before
    // any derived container is inspected, so whatever the trap rewrites
    // afterwards is already too late to reach the output.
    const benign = JSON.stringify(projectDropTopology({ indexes }));

    for (const proxiedTable of ["drops", "item_groups", "items"] as const) {
      let trapRuns = 0;
      const dropRows = indexes.tables.drops.rows.map((row) => ({ ...row }));
      const itemGroupRows = indexes.tables.item_groups.rows.map((row) => ({
        ...row,
      }));
      const itemRows = indexes.tables.items.rows.map((row) => ({
        ...row,
      })) as Record<string, unknown>[];

      // A grade passes every validator, so unsafe capture ordering would let a
      // forged one reach output rather than trip an unrelated fail-closed path.
      // This isolates capture ordering from every other guard.
      const proxiedGroups = new Proxy(
        {},
        {
          ownKeys(target) {
            trapRuns += 1;
            for (const row of itemRows) row.grade = "FORGED_GRADE";
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor(target, key) {
            trapRuns += 1;
            for (const row of itemRows) row.grade = "FORGED_GRADE";
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        },
      );

      const tables: Record<string, unknown> = { ...indexes.tables };
      tables.drops = {
        name: "drops",
        primaryField: "DropKey",
        rows: dropRows,
        groups: proxiedTable === "drops" ? proxiedGroups : {},
      };
      tables.item_groups = {
        name: "item_groups",
        primaryField: "ItemGroupKey",
        rows: itemGroupRows,
        groups: proxiedTable === "item_groups" ? proxiedGroups : {},
      };
      tables.items = {
        name: "items",
        primaryField: "id",
        rows: itemRows,
        groups: proxiedTable === "items" ? proxiedGroups : {},
      };
      const hostile = {
        catalog: indexes.catalog,
        tables,
        semanticReport: indexes.semanticReport,
      } as unknown as DiscordHeroCatalogIndexes;

      let escaped: unknown = "SENTINEL";
      let caught: unknown = null;
      try {
        escaped = projectDropTopology({ indexes: hostile });
      } catch (error) {
        caught = error;
      }

      // 1. caller code really did run, making the Proxy assertion active
      expect(`${proxiedTable}:${trapRuns > 0}`).toBe(`${proxiedTable}:true`);
      // 2. input-mutation accounting: caller-owned rows contain the sabotage
      expect(`${proxiedTable}:${itemRows[0]!.grade}`).toBe(
        `${proxiedTable}:FORGED_GRADE`,
      );
      // 3. the sabotage never reached the captured rows or the output
      expect(`${proxiedTable}:${caught === null}`).toBe(`${proxiedTable}:true`);
      expect(escaped).not.toBe("SENTINEL");
      expect(`${proxiedTable}:${JSON.stringify(escaped) === benign}`).toBe(
        `${proxiedTable}:true`,
      );
      expect(JSON.stringify(escaped)).not.toContain("FORGED_GRADE");
    }
  });

  test("rejects own callables on groups even with no accessor present", () => {
    // Isolates the callable rule: this hostile map has NO own accessor, so only
    // the "own executable code" check can reject it.
    let calls = 0;
    const real = new Map<number, unknown[]>();
    const callableOnly = {
      get(key: number) {
        calls += 1;
        return real.get(key);
      },
      entries() {
        calls += 1;
        return real.entries();
      },
      forEach() {
        calls += 1;
      },
    };
    expect(
      Reflect.ownKeys(callableOnly).every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(callableOnly, key)!;
        return descriptor.get === undefined && descriptor.set === undefined;
      }),
    ).toBe(true);

    const hostile = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: { ...indexes.tables.drops, groups: callableOnly },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: hostile })).toThrow(
      /executable code/i,
    );
    expect(calls).toBe(0);
  });

  test("rejects a custom semanticReport prototype that carries own data fields", () => {
    // Isolates the prototype rule: unresolvedReferences IS an own data
    // property here, so the own-property check cannot reject it and only the
    // prototype check can.
    const customProto = { poisoned: true };
    const report = Object.assign(Object.create(customProto), {
      unresolvedReferences: [] as unknown[],
      unresolvedReferenceCount: 0,
    });
    expect(Object.hasOwn(report, "unresolvedReferences")).toBe(true);
    expect(Object.getPrototypeOf(report)).toBe(customProto);

    const hostile = {
      ...indexes,
      semanticReport: report,
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: hostile })).toThrow(
      /prototype must be Object\.prototype or null/i,
    );
  });

  test("rejects an own accessor on groups even with no callable present", () => {
    // Isolates the accessor rule: this hostile map has NO own callable, so only
    // the "no caller-supplied accessors" check can reject it.
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
      Reflect.ownKeys(accessorOnly).every(
        (key) =>
          typeof Object.getOwnPropertyDescriptor(accessorOnly, key)!.value !==
          "function",
      ),
    ).toBe(true);

    const hostile = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: { ...indexes.tables.drops, groups: accessorOnly },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: hostile })).toThrow(
      /accessor/i,
    );
    expect(sizeReads).toBe(0);
  });

  test("rejects a semanticReport accessor on any field, not just the one it reads", () => {
    // Isolates the semanticReport accessor sweep: unresolvedReferences stays a
    // clean own data property, and the accessor hides on an unrelated key that
    // the projection never reads, so only the sweep can reject it.
    let ruleReads = 0;
    const report = {
      unresolvedReferences: [] as unknown[],
      unresolvedReferenceCount: 0,
    } as Record<string, unknown>;
    Object.defineProperty(report, "rules", {
      enumerable: true,
      configurable: true,
      get() {
        ruleReads += 1;
        return [];
      },
    });

    const hostile = {
      ...indexes,
      semanticReport: report,
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: hostile })).toThrow(
      /own data properties without accessors/i,
    );
    expect(ruleReads).toBe(0);
  });

  test("accepts the genuine derived index, which carries no own executable code", () => {
    // The real RuntimeReadonlyMap keeps its API on a frozen prototype and has
    // zero own keys, so the contract is "no own accessors or own callables at
    // this boundary" - not a prototype-name check and not duck typing.
    for (const table of ["drops", "item_groups", "items"] as const) {
      expect(Reflect.ownKeys(indexes.tables[table].groups)).toEqual([]);
    }
    expect(() => projectDropTopology({ indexes })).not.toThrow();
  });

  test("rejects a semanticReport with a custom prototype or accessor, calling no getter", () => {
    let getterCalls = 0;
    const accessorReport = {} as Record<string, unknown>;
    Object.defineProperty(accessorReport, "unresolvedReferences", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return [];
      },
    });
    const withAccessor = {
      ...indexes,
      semanticReport: accessorReport,
    } as unknown as DiscordHeroCatalogIndexes;

    let escaped: unknown = "SENTINEL";
    expect(() => {
      escaped = projectDropTopology({ indexes: withAccessor });
    }).toThrow(Error);
    expect(getterCalls).toBe(0);
    expect(escaped).toBe("SENTINEL");

    const hostileProto = Object.create(null) as Record<string, unknown>;
    let protoGetterCalls = 0;
    Object.defineProperty(hostileProto, "unresolvedReferences", {
      get() {
        protoGetterCalls += 1;
        return [];
      },
    });
    const withProto = {
      ...indexes,
      semanticReport: Object.assign(Object.create(hostileProto), {
        unresolvedReferenceCount: 0,
      }),
    } as unknown as DiscordHeroCatalogIndexes;

    expect(() => projectDropTopology({ indexes: withProto })).toThrow(Error);
    expect(protoGetterCalls).toBe(0);
  });

  test("rejects any topology-relevant unresolved reference as caller authority", () => {
    const relevantRules = [
      ["drops.RewardKey[ITEM]->items", "drops", "RewardKey", "items"],
      [
        "drops.RewardKey[ITEMGROUP]->item_groups",
        "drops",
        "RewardKey",
        "item_groups",
      ],
      ["item_groups.ItemKey->items", "item_groups", "ItemKey", "items"],
    ] as const;

    // the pinned catalog declares none of them
    for (const [ruleId] of relevantRules) {
      expect(
        indexes.semanticReport.unresolvedReferences.filter(
          (reference) => reference.ruleId === ruleId,
        ),
      ).toHaveLength(0);
    }

    for (const [
      ruleId,
      sourceTable,
      sourceField,
      targetTable,
    ] of relevantRules) {
      const forged = withUnresolvedReference(indexes, {
        ruleId,
        sourceTable,
        sourceField,
        sourceKey: 1,
        targetTable,
        targetKey: 9_999_999,
        reason: "forged caller authority",
      } as unknown as DiscordHeroUnresolvedReference);

      let escaped: unknown = "SENTINEL";
      expect(() => {
        escaped = projectDropTopology({ indexes: forged });
      }).toThrow(/topology-relevant unresolved reference/i);
      expect(escaped).toBe("SENTINEL");
    }
  });

  test("stays detached and deeply frozen when source rows mutate after projection", () => {
    const liveDrops = indexes.tables.drops.rows.map((row) => ({
      ...row,
    })) as Record<string, unknown>[];
    const liveItems = indexes.tables.items.rows.map((row) => ({
      ...row,
    })) as Record<string, unknown>[];
    const live = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: {
          ...indexes.tables.drops,
          rows: liveDrops,
          groups: rebuildGroupedRows(liveDrops, "DropKey"),
        },
        items: { ...indexes.tables.items, rows: liveItems },
      },
    } as unknown as DiscordHeroCatalogIndexes;

    const topology = projectDropTopology({ indexes: live });
    const before = JSON.stringify(topology);

    for (const row of liveDrops) {
      row.Weight = 999_999;
      row.DropType = "FORGED";
    }
    for (const row of liveItems) {
      row.grade = "FORGED";
      row.type = "FORGED";
    }

    expect(JSON.stringify(topology)).toBe(before);
    expectDeeplyFrozen(topology);
  });

  test("preserves the pinned corpus, classifier split and taxonomy after hardening", () => {
    const topology = projectDropTopology({ indexes });

    expect(topology.counts.dropRows).toBe(6_303);
    expect(topology.counts.dropKeyGroups).toBe(245);
    expect(topology.counts.itemGroupRows).toBe(2_275);
    expect(topology.counts.itemGroupKeys).toBe(1_118);
    expect(topology.counts.items).toBe(5_944);
    expect(
      topology.groups.filter((group) => group.classifier === "pure-weighted"),
    ).toHaveLength(157);
    expect(
      topology.groups.filter(
        (group) => group.classifier === "mixed-or-conditional",
      ),
    ).toHaveLength(88);
    expect(topology.groups).toHaveLength(245);
  });
});
