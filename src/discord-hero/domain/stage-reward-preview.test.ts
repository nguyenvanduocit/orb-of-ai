import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";

interface SourceItemRef {
  readonly itemKey: number;
  readonly name: string;
  readonly grade: string;
  readonly itemType: string;
}

interface StageSourceRewardPreview {
  readonly stageKey: number;
  readonly monsterItemRef: Readonly<{
    item: SourceItemRef;
    sourceChancePerThousand: number;
  }> | null;
  readonly bossItemRef: Readonly<{
    item: SourceItemRef;
    sourceChancePerThousand: number | null;
  }>;
  readonly firstClearTableRef: Readonly<{
    dropKey: number;
    sourceRows: readonly Readonly<{
      sourceIndex: number;
      dropTypeRaw: string;
      rewardType: "ITEM" | "ITEMGROUP";
      rewardKey: number;
      heroKeyCondition: number | null;
      weightRaw: number;
      catalogItemRefs: readonly SourceItemRef[];
    }>[];
  }> | null;
  readonly soulstoneItemRef: Readonly<{
    item: SourceItemRef;
    amountRaw: number;
  }> | null;
}

type ProjectStageSourceRewardPreview = (
  indexes: DiscordHeroCatalogIndexes,
  input: Readonly<{
    stageKey: number;
    locale: "en-US";
    [key: string]: unknown;
  }>,
) => StageSourceRewardPreview;

const previewModule = await import("./stage-reward-preview").catch(() => null);
const missingProjector =
  previewModule === null
    ? undefined
    : (
        previewModule as {
          projectStageSourceRewardPreview?: ProjectStageSourceRewardPreview;
        }
      ).projectStageSourceRewardPreview;

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function projectStageSourceRewardPreview(): ProjectStageSourceRewardPreview {
  expect(typeof missingProjector).toBe("function");
  return missingProjector as ProjectStageSourceRewardPreview;
}

function withGroupRows(
  base: DiscordHeroCatalogIndexes,
  dataset: "stages" | "drops" | "items" | "item_groups" | "heroes",
  key: number,
  rows: readonly Readonly<Record<string, unknown>>[],
): DiscordHeroCatalogIndexes {
  const table = base.tables[dataset];
  const groups = new Map<
    string | number,
    readonly Readonly<Record<string, unknown>>[]
  >(
    table.groups as unknown as ReadonlyMap<
      string | number,
      readonly Readonly<Record<string, unknown>>[]
    >,
  );
  groups.set(key, rows);
  return {
    ...base,
    tables: {
      ...base.tables,
      [dataset]: {
        ...table,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withRowPatch(
  base: DiscordHeroCatalogIndexes,
  dataset: "stages" | "drops" | "items" | "item_groups" | "heroes",
  key: number,
  patch: Readonly<Record<string, unknown>>,
): DiscordHeroCatalogIndexes {
  const row = base.tables[dataset].groups.get(key)?.[0];
  if (row === undefined) {
    throw new Error(`${dataset} fixture has no row ${key}`);
  }
  return withGroupRows(base, dataset, key, [
    Object.freeze({ ...row, ...patch }),
  ]);
}

function withoutGroup(
  base: DiscordHeroCatalogIndexes,
  dataset: "stages" | "drops" | "items" | "item_groups" | "heroes",
  key: number,
): DiscordHeroCatalogIndexes {
  const table = base.tables[dataset];
  const groups = new Map<
    string | number,
    readonly Readonly<Record<string, unknown>>[]
  >(
    table.groups as unknown as ReadonlyMap<
      string | number,
      readonly Readonly<Record<string, unknown>>[]
    >,
  );
  groups.delete(key);
  return {
    ...base,
    tables: {
      ...base.tables,
      [dataset]: {
        ...table,
        groups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

describe("DiscordHero source-only stage reward preview", () => {
  test("projects the exact 1101 normal-stage source references without selecting a reward", () => {
    const project = projectStageSourceRewardPreview();

    expect(project(indexes, { stageKey: 1101, locale: "en-US" })).toEqual({
      stageKey: 1101,
      monsterItemRef: {
        item: {
          itemKey: 910011,
          name: "Normal Monster Box 1",
          grade: "COMMON",
          itemType: "STAGEBOX",
        },
        sourceChancePerThousand: 160,
      },
      bossItemRef: {
        item: {
          itemKey: 920011,
          name: "Stage Boss Box 4",
          grade: "RARE",
          itemType: "STAGEBOX",
        },
        sourceChancePerThousand: 1000,
      },
      firstClearTableRef: {
        dropKey: 9200010,
        sourceRows: [
          {
            sourceIndex: 0,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920001,
            heroKeyCondition: 101,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920001,
                name: "Stage Boss Box 1",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
          {
            sourceIndex: 1,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920002,
            heroKeyCondition: 201,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920002,
                name: "Stage Boss Box 2",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
          {
            sourceIndex: 2,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920003,
            heroKeyCondition: 301,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920003,
                name: "Stage Boss Box 3",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
          {
            sourceIndex: 3,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920004,
            heroKeyCondition: 401,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920004,
                name: "Stage Boss Box 3",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
          {
            sourceIndex: 4,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920005,
            heroKeyCondition: 501,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920005,
                name: "Stage Boss Box 3",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
          {
            sourceIndex: 5,
            dropTypeRaw: "SelectOneByClass",
            rewardType: "ITEM",
            rewardKey: 920006,
            heroKeyCondition: 601,
            weightRaw: 10000,
            catalogItemRefs: [
              {
                itemKey: 920006,
                name: "Stage Boss Box 3",
                grade: "RARE",
                itemType: "STAGEBOX",
              },
            ],
          },
        ],
      },
      soulstoneItemRef: null,
    });
  });

  test("projects the exact 1110 act-boss null chance and soulstone source reference", () => {
    const project = projectStageSourceRewardPreview();

    expect(project(indexes, { stageKey: 1110, locale: "en-US" })).toEqual({
      stageKey: 1110,
      monsterItemRef: null,
      bossItemRef: {
        item: {
          itemKey: 930101,
          name: "Act Boss Box 1",
          grade: "LEGENDARY",
          itemType: "STAGEBOX",
        },
        sourceChancePerThousand: null,
      },
      firstClearTableRef: null,
      soulstoneItemRef: {
        item: {
          itemKey: 190001,
          name: "Soulstone - Normal",
          grade: "IMMORTAL",
          itemType: "MATERIAL",
        },
        amountRaw: 1,
      },
    });
  });

  test("projects exact 1208 reward references despite the dangling 20101 wave monster", () => {
    const project = projectStageSourceRewardPreview();

    expect(project(indexes, { stageKey: 1208, locale: "en-US" })).toEqual({
      stageKey: 1208,
      monsterItemRef: {
        item: {
          itemKey: 910201,
          name: "Normal Monster Box Lv20",
          grade: "COMMON",
          itemType: "STAGEBOX",
        },
        sourceChancePerThousand: 20,
      },
      bossItemRef: {
        item: {
          itemKey: 920201,
          name: "Stage Boss Box Lv20",
          grade: "RARE",
          itemType: "STAGEBOX",
        },
        sourceChancePerThousand: 200,
      },
      firstClearTableRef: null,
      soulstoneItemRef: null,
    });
  });

  test("preserves all 120 exact stage references and the measured 45-item source surface", () => {
    const project = projectStageSourceRewardPreview();
    const previews = indexes.tables.stages.rows.map((stage) =>
      project(indexes, { stageKey: stage.StageKey, locale: "en-US" }),
    );
    const directItemKeys = new Set<number>();
    const firstClearTables = new Map<
      number,
      NonNullable<StageSourceRewardPreview["firstClearTableRef"]>
    >();
    let normalCount = 0;
    let actBossCount = 0;
    let normalMonsterRefCount = 0;
    let actBossNullChanceCount = 0;
    let soulstoneRefCount = 0;
    let firstClearStageRefCount = 0;

    for (const preview of previews) {
      const stage = indexes.tables.stages.groups.get(preview.stageKey)?.[0];
      if (stage?.STAGETYPE === "NORMAL") {
        normalCount += 1;
        if (preview.monsterItemRef !== null) normalMonsterRefCount += 1;
      } else if (stage?.STAGETYPE === "ACTBOSS") {
        actBossCount += 1;
        if (preview.bossItemRef.sourceChancePerThousand === null) {
          actBossNullChanceCount += 1;
        }
      }
      if (preview.monsterItemRef !== null) {
        directItemKeys.add(preview.monsterItemRef.item.itemKey);
      }
      directItemKeys.add(preview.bossItemRef.item.itemKey);
      if (preview.soulstoneItemRef !== null) {
        soulstoneRefCount += 1;
        directItemKeys.add(preview.soulstoneItemRef.item.itemKey);
      }
      if (preview.firstClearTableRef !== null) {
        firstClearStageRefCount += 1;
        firstClearTables.set(
          preview.firstClearTableRef.dropKey,
          preview.firstClearTableRef,
        );
      }
    }

    const firstClearItemKeys = new Set(
      [...firstClearTables.values()].flatMap((table) =>
        table.sourceRows.flatMap((row) =>
          row.catalogItemRefs.map((item) => item.itemKey),
        ),
      ),
    );
    const allItemRefs = new Map<number, SourceItemRef>();
    for (const preview of previews) {
      for (const item of [
        preview.monsterItemRef?.item,
        preview.bossItemRef.item,
        preview.soulstoneItemRef?.item,
        ...(preview.firstClearTableRef?.sourceRows.flatMap(
          (row) => row.catalogItemRefs,
        ) ?? []),
      ]) {
        if (item !== undefined) allItemRefs.set(item.itemKey, item);
      }
    }
    const uniqueFirstClearRows = [...firstClearTables.values()].flatMap(
      (table) => table.sourceRows,
    );

    expect(previews).toHaveLength(120);
    expect(normalCount).toBe(108);
    expect(actBossCount).toBe(12);
    expect(normalMonsterRefCount).toBe(108);
    expect(actBossNullChanceCount).toBe(12);
    expect(soulstoneRefCount).toBe(12);
    expect(firstClearStageRefCount).toBe(13);
    expect([...firstClearTables.keys()]).toEqual([
      9200010, 9200220, 9200320, 9200420, 9200520,
    ]);
    expect(uniqueFirstClearRows).toHaveLength(10);
    expect(
      uniqueFirstClearRows.filter(
        (row) => row.dropTypeRaw === "SelectOneByClass",
      ),
    ).toHaveLength(6);
    expect(
      uniqueFirstClearRows.filter(
        (row) => row.dropTypeRaw === "EachDropOneWeight",
      ),
    ).toHaveLength(4);
    expect(uniqueFirstClearRows.every((row) => row.rewardType === "ITEM")).toBe(
      true,
    );
    expect(uniqueFirstClearRows.every((row) => row.weightRaw === 10000)).toBe(
      true,
    );
    expect(directItemKeys.size).toBe(35);
    expect(firstClearItemKeys.size).toBe(10);
    expect(allItemRefs.size).toBe(45);
    expect(
      [...allItemRefs.values()].filter((item) => item.itemType === "STAGEBOX"),
    ).toHaveLength(41);
    expect(
      [...allItemRefs.values()].filter((item) => item.itemType === "MATERIAL"),
    ).toHaveLength(4);
  });

  test("keeps first-clear rows and ITEMGROUP members in exact catalog order", () => {
    const project = projectStageSourceRewardPreview();
    const pasture = project(indexes, {
      stageKey: 1101,
      locale: "en-US",
    });

    expect(
      pasture.firstClearTableRef?.sourceRows.map((row) => [
        row.sourceIndex,
        row.heroKeyCondition,
        row.rewardKey,
      ]),
    ).toEqual([
      [0, 101, 920001],
      [1, 201, 920002],
      [2, 301, 920003],
      [3, 401, 920004],
      [4, 501, 920005],
      [5, 601, 920006],
    ]);

    const itemGroupDrop = withRowPatch(indexes, "drops", 9200220, {
      REWARDTYPE: "ITEMGROUP",
      RewardKey: 1000010,
    });
    expect(
      project(itemGroupDrop, {
        stageKey: 1109,
        locale: "en-US",
      }).firstClearTableRef?.sourceRows[0],
    ).toEqual({
      sourceIndex: 0,
      dropTypeRaw: "EachDropOneWeight",
      rewardType: "ITEMGROUP",
      rewardKey: 1000010,
      heroKeyCondition: null,
      weightRaw: 10000,
      catalogItemRefs: [
        {
          itemKey: 300001,
          name: "Long Sword",
          grade: "COMMON",
          itemType: "GEAR",
        },
        {
          itemKey: 310001,
          name: "Short Bow",
          grade: "COMMON",
          itemType: "GEAR",
        },
        {
          itemKey: 320001,
          name: "Wooden Staff",
          grade: "COMMON",
          itemType: "GEAR",
        },
        {
          itemKey: 330001,
          name: "Novice Scepter",
          grade: "COMMON",
          itemType: "GEAR",
        },
      ],
    });
  });

  test("preserves HeroKeyCondition 0 as a source sentinel without a hero lookup", () => {
    const project = projectStageSourceRewardPreview();
    const sentinelDrop = withRowPatch(indexes, "drops", 9200220, {
      HeroKeyCondition: 0,
    });

    expect(
      project(sentinelDrop, {
        stageKey: 1109,
        locale: "en-US",
      }).firstClearTableRef?.sourceRows[0]?.heroKeyCondition,
    ).toBe(0);
  });

  test("accepts only an exact-own stage key and locale DTO", () => {
    const project = projectStageSourceRewardPreview();
    const nullPrototype = Object.assign(Object.create(null), {
      stageKey: 1101,
      locale: "en-US",
    }) as {
      stageKey: number;
      locale: "en-US";
    };

    expect(project(indexes, nullPrototype).stageKey).toBe(1101);
    for (const input of [
      null,
      [],
      new (class {
        stageKey = 1101;
        locale = "en-US";
      })(),
    ]) {
      expect(() => project(indexes, input as never)).toThrow(
        "stage reward preview input",
      );
    }
    expect(() => project(indexes, { stageKey: 1101 } as never)).toThrow(
      "exactly stageKey and locale",
    );
    expect(() =>
      project(indexes, {
        stageKey: 1101,
        locale: "en-US",
        rng: () => 0,
      }),
    ).toThrow("unknown field rng");
    expect(() =>
      project(
        indexes,
        Object.assign(
          { stageKey: 1101, locale: "en-US" },
          { [Symbol("state")]: {} },
        ) as never,
      ),
    ).toThrow("own string fields");
    for (const stageKey of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => project(indexes, { stageKey, locale: "en-US" })).toThrow(
        "positive safe integer",
      );
    }
    for (const locale of ["vi-VN", "fr-FR"]) {
      expect(() =>
        project(indexes, { stageKey: 1101, locale } as never),
      ).toThrow("locale must be en-US");
    }
  });

  test("rejects forged direct references and source chance or amount pairs", () => {
    const project = projectStageSourceRewardPreview();

    expect(() =>
      project(withoutGroup(indexes, "items", 910011), {
        stageKey: 1101,
        locale: "en-US",
      }),
    ).toThrow("items has no unique row for key 910011");
    expect(() =>
      project(
        withRowPatch(indexes, "items", 910011, {
          id: 910012,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("item key 910011 contains item 910012");
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1101, {
          MonsterDropItemKey: null,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("monster item key and source chance must both be present");
    for (const sourceChance of [-1, 1.5, 1001]) {
      expect(() =>
        project(
          withRowPatch(indexes, "stages", 1101, {
            MonsterDropItemRate: sourceChance,
          }),
          { stageKey: 1101, locale: "en-US" },
        ),
      ).toThrow("between 0 and 1000");
    }
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1101, {
          BossDropItemRate: null,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("normal stage 1101 must have a boss source chance");
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1110, {
          BossDropItemRate: 1000,
        }),
        { stageKey: 1110, locale: "en-US" },
      ),
    ).toThrow("act-boss stage 1110 boss source chance must be null");
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1110, {
          SoulstoneAmount: null,
        }),
        { stageKey: 1110, locale: "en-US" },
      ),
    ).toThrow("soulstone item key and amount must both be present");
  });

  test("enforces exact normal and act-boss soulstone and first-clear topology", () => {
    const project = projectStageSourceRewardPreview();

    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1101, {
          SoulstoneItemKey: 190001,
          SoulstoneAmount: 1,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("normal stage 1101 soulstone item key and amount must be null");
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1110, {
          SoulstoneItemKey: null,
          SoulstoneAmount: null,
        }),
        { stageKey: 1110, locale: "en-US" },
      ),
    ).toThrow(
      "act-boss stage 1110 soulstone item key and amount must both be present",
    );
    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1110, {
          FirstClearDropKey: 9200220,
        }),
        { stageKey: 1110, locale: "en-US" },
      ),
    ).toThrow("act-boss stage 1110 first-clear drop key must be null");
  });

  test("rejects malformed item grade and type with controlled validation", () => {
    const project = projectStageSourceRewardPreview();

    expect(() =>
      project(
        withRowPatch(indexes, "items", 910011, {
          grade: null,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("item 910011 grade must be a non-empty string");
    expect(() =>
      project(
        withRowPatch(indexes, "items", 910011, {
          type: 42,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("item 910011 type must be a non-empty string");
  });

  test("rejects a malformed first-clear DropType with controlled validation", () => {
    const project = projectStageSourceRewardPreview();

    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          DropType: null,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow(
      "first-clear table 9200010 drop type 0 must be a non-empty string",
    );
  });

  test("rejects forged first-clear groups, rows, conditions, weights, and reward types", () => {
    const project = projectStageSourceRewardPreview();
    const input = { stageKey: 1101, locale: "en-US" } as const;

    expect(() =>
      project(withoutGroup(indexes, "drops", 9200010), input),
    ).toThrow("drops has no rows for key 9200010");
    expect(() =>
      project(withGroupRows(indexes, "drops", 9200010, []), input),
    ).toThrow("first-clear table 9200010 must contain at least one row");
    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          DropKey: 9200011,
        }),
        input,
      ),
    ).toThrow("contains drop key 9200011");
    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          HeroKeyCondition: 999999999,
        }),
        input,
      ),
    ).toThrow("heroes has no unique row for key 999999999");
    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          Weight: -1,
        }),
        input,
      ),
    ).toThrow("weight 0 must be a non-negative safe integer");
    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          REWARDTYPE: "GOLD",
        }),
        input,
      ),
    ).toThrow("unsupported reward type GOLD");
    expect(() =>
      project(
        withRowPatch(indexes, "drops", 9200010, {
          RewardKey: 999999999,
        }),
        input,
      ),
    ).toThrow("items has no unique row for key 999999999");

    const itemGroupReward = withRowPatch(indexes, "drops", 9200010, {
      REWARDTYPE: "ITEMGROUP",
      RewardKey: 999999999,
    });
    expect(() => project(itemGroupReward, input)).toThrow(
      "item_groups has no rows for key 999999999",
    );
  });

  test("rejects stage, item-group, and hero primary-key mismatches", () => {
    const project = projectStageSourceRewardPreview();

    expect(() =>
      project(
        withRowPatch(indexes, "stages", 1101, {
          StageKey: 1102,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("stage group 1101 contains stage key 1102");

    const itemGroupDrop = withRowPatch(indexes, "drops", 9200220, {
      REWARDTYPE: "ITEMGROUP",
      RewardKey: 1000010,
    });
    expect(() =>
      project(
        withRowPatch(itemGroupDrop, "item_groups", 1000010, {
          ItemGroupKey: 1000011,
        }),
        { stageKey: 1109, locale: "en-US" },
      ),
    ).toThrow("item group 1000010 contains group key 1000011");

    expect(() =>
      project(
        withRowPatch(indexes, "heroes", 101, {
          HeroKey: 201,
        }),
        { stageKey: 1101, locale: "en-US" },
      ),
    ).toThrow("hero group 101 contains hero 201");
  });

  test("returns detached recursively frozen output without mutating the catalog", () => {
    const project = projectStageSourceRewardPreview();
    const catalogBefore = JSON.stringify(indexes.catalog);
    const stageBefore = JSON.stringify(indexes.tables.stages.groups.get(1101));
    const dropsBefore = JSON.stringify(
      indexes.tables.drops.groups.get(9200010),
    );
    const first = project(indexes, { stageKey: 1101, locale: "en-US" });

    expectDeepFrozen(first);
    expect(first.firstClearTableRef?.sourceRows[0]).not.toBe(
      indexes.tables.drops.groups.get(9200010)?.[0],
    );
    expect(first.monsterItemRef?.item).not.toBe(
      indexes.tables.items.groups.get(910011)?.[0],
    );
    expect(() => {
      (first as { stageKey: number }).stageKey = 999999;
    }).toThrow(TypeError);
    expect(() => {
      (first.firstClearTableRef?.sourceRows as Array<unknown>).push("forged");
    }).toThrow(TypeError);

    expect(project(indexes, { stageKey: 1101, locale: "en-US" })).toEqual(
      first,
    );
    expect(JSON.stringify(indexes.catalog)).toBe(catalogBefore);
    expect(JSON.stringify(indexes.tables.stages.groups.get(1101))).toBe(
      stageBefore,
    );
    expect(JSON.stringify(indexes.tables.drops.groups.get(9200010))).toBe(
      dropsBefore,
    );
  });
});
