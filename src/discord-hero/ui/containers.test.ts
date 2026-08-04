import { beforeAll, describe, expect, test } from "bun:test";
import { StringSelectMenuOptionBuilder } from "discord.js";
import {
  buildCatalogIndexes,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { GearAsset, PlayerState } from "../domain/player";
import * as containers from "./containers";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function fresh(): PlayerState {
  return structuredClone(createFreshPlayerStateFromCatalog(indexes, 101));
}

function firstStackItemKey(): number {
  const source = indexes.tables.items.rows.find(
    (item) => item.deleted !== true && item.type !== "GEAR",
  );
  if (source === undefined) throw new Error("test catalog has no stack item");
  return source.id;
}

function stack(quantity = Number.MAX_SAFE_INTEGER) {
  return { kind: "stack" as const, itemKey: firstStackItemKey(), quantity };
}

function gear(instanceId: string, rolledStatCount = 1): GearAsset {
  const sourceRows = indexes.tables.stat_mods.rows.slice(0, rolledStatCount);
  if (sourceRows.length !== rolledStatCount) {
    throw new Error(`test catalog has fewer than ${rolledStatCount} stat mods`);
  }
  return {
    kind: "gear",
    instanceId,
    itemKey: 300001,
    rolledStats: sourceRows.map((source) => ({
      statModKey: source.StatModKey,
      value: source.MinValue / source.Interval,
    })),
  };
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function hasValidUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function withItemName(
  sourceIndexes: DiscordHeroCatalogIndexes,
  itemKey: number,
  name: string,
): DiscordHeroCatalogIndexes {
  const sourceTable = sourceIndexes.tables.items;
  const sourceItem = getCatalogRow(sourceIndexes, "items", itemKey);
  const forgedItem = {
    ...sourceItem,
    name: { ...sourceItem.name, "en-US": name },
  };
  const rows = sourceTable.rows.map((row) =>
    row.id === itemKey ? forgedItem : row,
  );
  const groups = new Map(sourceTable.groups);
  groups.set(itemKey, [forgedItem]);
  return {
    ...sourceIndexes,
    tables: {
      ...sourceIndexes.tables,
      items: { ...sourceTable, rows, groups },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function withInventorySourceIndex(
  sourceIndexes: DiscordHeroCatalogIndexes,
  rowIndex: number,
  sourceIndex: number,
): DiscordHeroCatalogIndexes {
  const sourceTable = sourceIndexes.tables.inventory;
  const rows = [...sourceTable.rows];
  rows[rowIndex] = { ...rows[rowIndex]!, Index: sourceIndex };
  return {
    ...sourceIndexes,
    tables: {
      ...sourceIndexes.tables,
      inventory: { ...sourceTable, rows },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

type ContainerDataset = "inventory" | "stash" | "storage" | "trading_stash";

interface TestContainerSourceRow {
  readonly Index: number;
  readonly CostForUnlock: number;
}

function withContainerGroupMutation(
  sourceIndexes: DiscordHeroCatalogIndexes,
  dataset: ContainerDataset,
  mutate: (
    groups: Map<number, readonly TestContainerSourceRow[]>,
    rows: readonly TestContainerSourceRow[],
  ) => void,
): DiscordHeroCatalogIndexes {
  const sourceTable = sourceIndexes.tables[dataset];
  const rows = sourceTable.rows as readonly TestContainerSourceRow[];
  const groups = new Map<number, readonly TestContainerSourceRow[]>(
    sourceTable.groups as ReadonlyMap<
      number,
      readonly TestContainerSourceRow[]
    >,
  );
  mutate(groups, rows);
  return {
    ...sourceIndexes,
    tables: {
      ...sourceIndexes.tables,
      [dataset]: { ...sourceTable, groups },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

describe("DiscordHero container browser projection", () => {
  test("exposes stable source-backed tabs and paid unlock quotes", () => {
    expect(containers.DISCORD_HERO_CONTAINER_KINDS).toEqual([
      "inventory",
      "stash",
      "storage",
      "tradingStash",
    ]);

    expect(
      containers.projectDiscordHeroContainerTabs(indexes, fresh()),
    ).toEqual([
      {
        kind: "inventory",
        label: "Inventory",
        capacity: 260,
        unlocked: 20,
        occupied: 0,
        free: 20,
        pageCount: 1,
        pageTarget: "cp-i-0",
        unlockQuote: {
          kind: "available",
          slotIndex: 20,
          cost: 50,
          canAfford: true,
          source: { Index: 20, CostForUnlock: 50 },
        },
      },
      {
        kind: "stash",
        label: "Stash",
        capacity: 131,
        unlocked: 41,
        occupied: 0,
        free: 41,
        pageCount: 2,
        pageTarget: "cp-s-0",
        unlockQuote: {
          kind: "available",
          slotIndex: 41,
          cost: 100,
          canAfford: true,
          source: { Index: 41, CostForUnlock: 100 },
        },
      },
      {
        kind: "storage",
        label: "Storage",
        capacity: 101,
        unlocked: 39,
        occupied: 0,
        free: 39,
        pageCount: 2,
        pageTarget: "cp-o-0",
        unlockQuote: {
          kind: "available",
          slotIndex: 39,
          cost: 50,
          canAfford: true,
          source: { Index: 39, CostForUnlock: 50 },
        },
      },
      {
        kind: "tradingStash",
        label: "Trading Stash",
        capacity: 10,
        unlocked: 10,
        occupied: 0,
        free: 10,
        pageCount: 1,
        pageTarget: "cp-t-0",
        unlockQuote: {
          kind: "maximum-capacity",
          unlockedSlots: 10,
        },
      },
    ]);
  });

  test("makes every occupied item and free unlocked slot reachable in exact 25-slot pages", () => {
    const state = fresh();
    const expected = [
      ["inventory", 260, 11],
      ["stash", 131, 6],
      ["storage", 101, 5],
      ["tradingStash", 10, 1],
    ] as const;

    for (const [kind, capacity] of expected) {
      state.containers[kind] = {
        unlockedSlots: capacity,
        slots: Array.from(
          { length: capacity },
          (_, offset) => capacity - 1 - offset,
        )
          .filter((slotIndex) => slotIndex % 2 === 0)
          .map((index) => ({ index, asset: stack(index + 1) })),
      };
    }

    const tabs = containers.projectDiscordHeroContainerTabs(indexes, state);
    for (const [kind, capacity, pageCount] of expected) {
      const tab = tabs.find((candidate) => candidate.kind === kind)!;
      expect(tab).toMatchObject({
        kind,
        capacity,
        unlocked: capacity,
        occupied: Math.ceil(capacity / 2),
        free: Math.floor(capacity / 2),
        pageCount,
        unlockQuote: {
          kind: "maximum-capacity",
          unlockedSlots: capacity,
        },
      });

      const slots = Array.from({ length: pageCount }, (_, page) =>
        containers.projectDiscordHeroContainerPage(
          indexes,
          state,
          containers.encodeDiscordHeroContainerPageTarget(
            indexes,
            state,
            kind,
            page,
          ),
        ),
      ).flatMap((projection) => {
        expect(projection.slots.length).toBeLessThanOrEqual(25);
        return projection.slots;
      });

      expect(slots.map((slot) => slot.slotIndex)).toEqual(
        Array.from({ length: capacity }, (_, index) => index),
      );
      expect(
        slots
          .filter((slot) => slot.status === "occupied")
          .map((slot) => slot.slotIndex),
      ).toEqual(
        Array.from({ length: capacity }, (_, index) => index).filter(
          (index) => index % 2 === 0,
        ),
      );
      expect(
        slots
          .filter((slot) => slot.status === "free")
          .map((slot) => slot.slotIndex),
      ).toEqual(
        Array.from({ length: capacity }, (_, index) => index).filter(
          (index) => index % 2 === 1,
        ),
      );
    }
  });

  test("represents locked, empty, and completely full containers without inventing slots", () => {
    const locked = fresh();
    for (const kind of containers.DISCORD_HERO_CONTAINER_KINDS) {
      locked.containers[kind] = { unlockedSlots: 0, slots: [] };
    }
    const lockedTabs = containers.projectDiscordHeroContainerTabs(
      indexes,
      locked,
    );
    expect(
      lockedTabs.map(
        ({ kind, unlocked, occupied, free, pageCount, unlockQuote }) => ({
          kind,
          unlocked,
          occupied,
          free,
          pageCount,
          unlockQuote,
        }),
      ),
    ).toEqual([
      {
        kind: "inventory",
        unlocked: 0,
        occupied: 0,
        free: 0,
        pageCount: 1,
        unlockQuote: null,
      },
      {
        kind: "stash",
        unlocked: 0,
        occupied: 0,
        free: 0,
        pageCount: 1,
        unlockQuote: null,
      },
      {
        kind: "storage",
        unlocked: 0,
        occupied: 0,
        free: 0,
        pageCount: 1,
        unlockQuote: null,
      },
      {
        kind: "tradingStash",
        unlocked: 0,
        occupied: 0,
        free: 0,
        pageCount: 1,
        unlockQuote: null,
      },
    ]);
    expect(
      containers.projectDiscordHeroContainerPage(indexes, locked, "cp-i-0")
        .slots,
    ).toEqual([]);

    const full = fresh();
    for (const [kind, capacity] of [
      ["inventory", 260],
      ["stash", 131],
      ["storage", 101],
      ["tradingStash", 10],
    ] as const) {
      full.containers[kind] = {
        unlockedSlots: capacity,
        slots: Array.from({ length: capacity }, (_, index) => ({
          index,
          asset: stack(7),
        })),
      };
    }
    expect(
      containers
        .projectDiscordHeroContainerTabs(indexes, full)
        .map(({ kind, occupied, free }) => ({ kind, occupied, free })),
    ).toEqual([
      { kind: "inventory", occupied: 260, free: 0 },
      { kind: "stash", occupied: 131, free: 0 },
      { kind: "storage", occupied: 101, free: 0 },
      { kind: "tradingStash", occupied: 10, free: 0 },
    ]);
    expect(
      containers.projectDiscordHeroContainerPage(indexes, full, "cp-i-a").slots,
    ).toHaveLength(10);
  });

  test("retains exact source asset identity, stack quantity, gear instance ID, and all 620 rolls", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    state.containers.inventory.slots = [
      { index: 259, asset: gear("gear-instance-259", 620) },
      { index: 25, asset: stack(Number.MAX_SAFE_INTEGER) },
    ];

    const page = containers.projectDiscordHeroContainerPage(
      indexes,
      state,
      "cp-i-a",
    );
    expect(page.slots.map((slot) => slot.slotIndex)).toEqual([
      250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
    ]);
    expect(page.slots.at(-1)).toMatchObject({
      status: "occupied",
      slotIndex: 259,
      target: "cs-i-a-77",
      assetKind: "gear",
      itemKey: 300001,
      instanceId: "gear-instance-259",
      quantity: null,
    });

    const gearDetail = containers.readDiscordHeroContainerSlot(
      indexes,
      state,
      page,
      "cs-i-a-77",
    );
    expect(gearDetail).toMatchObject({
      kind: "inventory",
      page: 10,
      slotIndex: 259,
      status: "occupied",
      target: "cs-i-a-77",
      asset: {
        itemKey: 300001,
        name: "Long Sword",
        type: "GEAR",
        gearType: "SWORD",
        instanceId: "gear-instance-259",
        quantity: null,
      },
    });
    expect(
      gearDetail.status === "occupied" && gearDetail.asset.rolledStats,
    ).toHaveLength(620);
    expect(
      gearDetail.status === "occupied" && gearDetail.asset.rolledStats[619],
    ).toEqual({
      statModKey: 105901,
      statType: "SkillHealIncrease",
      modType: "ADDITIVE",
      value: 453,
    });

    const stackPage = containers.projectDiscordHeroContainerPage(
      indexes,
      state,
      "cp-i-1",
    );
    const stackDetail = containers.readDiscordHeroContainerSlot(
      indexes,
      state,
      stackPage,
      "cs-i-1-p",
    );
    expect(stackDetail).toMatchObject({
      kind: "inventory",
      page: 1,
      slotIndex: 25,
      status: "occupied",
      asset: {
        itemKey: firstStackItemKey(),
        quantity: Number.MAX_SAFE_INTEGER,
        instanceId: null,
        rolledStats: [],
      },
    });
  });

  test("bounds Unicode option strings by UTF-16 units while retaining full detail", () => {
    const state = fresh();
    const unicodeName = "🚀".repeat(50);
    const unicodeInstance = `${"b".repeat(91)}🚀tail`;
    state.containers.inventory.slots = [
      { index: 0, asset: gear(unicodeInstance, 620) },
    ];
    const forgedIndexes = withItemName(indexes, 300001, unicodeName);

    const page = containers.projectDiscordHeroContainerPage(
      forgedIndexes,
      state,
      "cp-i-0",
    );
    const option = page.slots[0]!;
    expect(option).toMatchObject({
      status: "occupied",
      label: `#0 ${"🚀".repeat(48)}…`,
      description: `Gear · ${"b".repeat(91)}…`,
    });
    expect(option.label.length).toBe(100);
    expect(option.description.length).toBe(99);
    expect(hasValidUtf16(option.label)).toBe(true);
    expect(hasValidUtf16(option.description)).toBe(true);
    expect(
      new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setDescription(option.description)
        .setValue(option.target)
        .toJSON(),
    ).toMatchObject({
      label: option.label,
      description: option.description,
      value: option.target,
    });

    const detail = containers.readDiscordHeroContainerSlot(
      forgedIndexes,
      state,
      page,
      option.target,
    );
    expect(detail.status === "occupied" && detail.asset.name).toBe(unicodeName);
    expect(detail.status === "occupied" && detail.asset.instanceId).toBe(
      unicodeInstance,
    );
    expect(
      detail.status === "occupied" && detail.asset.rolledStats,
    ).toHaveLength(620);
  });

  test("round-trips only canonical bounded kind, page, and strictly page-bound slot targets", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    state.containers.stash.unlockedSlots = 131;
    state.containers.storage.unlockedSlots = 101;

    expect(
      containers.decodeDiscordHeroContainerPageTarget(
        indexes,
        state,
        containers.encodeDiscordHeroContainerPageTarget(
          indexes,
          state,
          "inventory",
          10,
        ),
      ),
    ).toEqual({ kind: "inventory", page: 10 });
    expect(
      containers.decodeDiscordHeroContainerSlotTarget(
        indexes,
        state,
        containers.encodeDiscordHeroContainerSlotTarget(
          indexes,
          state,
          "storage",
          4,
          100,
        ),
      ),
    ).toEqual({ kind: "storage", page: 4, slotIndex: 100 });

    for (const value of [
      "",
      "cp-x-0",
      "cp-i-00",
      "cp-i--1",
      "cp-I-0",
      "cp-i-b",
      "cp-t-1",
      `cp-i-${"a".repeat(65)}`,
    ]) {
      expect(() =>
        containers.decodeDiscordHeroContainerPageTarget(indexes, state, value),
      ).toThrow();
    }
    for (const value of [
      "cs-x-0-0",
      "cs-i-00-0",
      "cs-i-0-00",
      "cs-i-0-p",
      "cs-i-1-o",
      "cs-t-0-a",
      "cs-s-5-3n",
      "cs-o-4-2t",
      "cs-i-a-78",
      `cs-i-0-${"a".repeat(65)}`,
    ]) {
      expect(() =>
        containers.decodeDiscordHeroContainerSlotTarget(indexes, state, value),
      ).toThrow();
    }
    expect(() =>
      containers.encodeDiscordHeroContainerSlotTarget(
        indexes,
        state,
        "inventory",
        0,
        25,
      ),
    ).toThrow("slot 25 is on page 1, not 0");
  });

  test("requires the exact originating page before resolving free or occupied slot details", () => {
    const state = fresh();
    state.containers.inventory.unlockedSlots = 260;
    for (const [
      offset,
      kind,
    ] of containers.DISCORD_HERO_CONTAINER_KINDS.entries()) {
      state.containers[kind].slots = [{ index: 0, asset: stack(offset + 1) }];
    }
    const pages = containers.DISCORD_HERO_CONTAINER_KINDS.map((kind) =>
      containers.projectDiscordHeroContainerPage(
        indexes,
        state,
        containers.encodeDiscordHeroContainerPageTarget(
          indexes,
          state,
          kind,
          0,
        ),
      ),
    );

    for (const [index, page] of pages.entries()) {
      const occupiedTarget = page.slots[0]!.target;
      const freeTarget = page.slots[1]!.target;
      expect(
        containers.readDiscordHeroContainerSlot(
          indexes,
          state,
          page,
          occupiedTarget,
        ).status,
      ).toBe("occupied");
      expect(
        containers.readDiscordHeroContainerSlot(
          indexes,
          state,
          page,
          freeTarget,
        ).status,
      ).toBe("free");

      const alternatePage = pages[(index + 1) % pages.length]!;
      expect(() =>
        containers.readDiscordHeroContainerSlot(
          indexes,
          state,
          page,
          alternatePage.slots[0]!.target,
        ),
      ).toThrow(
        `belongs to ${alternatePage.label} page 0, not ${page.label} page 0`,
      );
      expect(() =>
        containers.readDiscordHeroContainerSlot(
          indexes,
          state,
          page,
          alternatePage.slots[1]!.target,
        ),
      ).toThrow(
        `belongs to ${alternatePage.label} page 0, not ${page.label} page 0`,
      );
    }

    const inventoryPage = pages[0]!;
    expect(() =>
      containers.readDiscordHeroContainerSlot(
        indexes,
        state,
        { ...inventoryPage, kind: "stash" },
        inventoryPage.slots[0]!.target,
      ),
    ).toThrow("page context kind stash does not match target kind inventory");
    expect(() =>
      containers.readDiscordHeroContainerSlot(
        indexes,
        state,
        {
          ...inventoryPage,
          page: 1,
          pageTarget: "cp-i-1",
        },
        inventoryPage.slots[0]!.target,
      ),
    ).toThrow("belongs to Inventory page 0, not Inventory page 1");
  });

  test("returns fresh deeply frozen projections without input aliases or mutation", () => {
    const state = fresh();
    state.containers.inventory.slots = [
      { index: 0, asset: gear("frozen-instance", 2) },
    ];
    const frozenState = deepFreeze(state) as PlayerState;
    const before = JSON.stringify(frozenState);

    const first = containers.projectDiscordHeroContainerPage(
      indexes,
      frozenState,
      "cp-i-0",
    );
    const second = containers.projectDiscordHeroContainerPage(
      indexes,
      frozenState,
      "cp-i-0",
    );
    const detail = containers.readDiscordHeroContainerSlot(
      indexes,
      frozenState,
      first,
      "cs-i-0-0",
    );
    const originalAsset = frozenState.containers.inventory.slots[0]!.asset;
    if (originalAsset.kind !== "gear") {
      throw new Error("test fixture slot 0 must contain gear");
    }

    expect(first).not.toBe(second);
    expect(first.slots).not.toBe(second.slots);
    expect(first.slots[0]).not.toBe(second.slots[0]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.slots)).toBe(true);
    expect(Object.isFrozen(first.slots[0])).toBe(true);
    expect(Object.isFrozen(detail)).toBe(true);
    expect(detail.status === "occupied" && Object.isFrozen(detail.asset)).toBe(
      true,
    );
    expect(
      detail.status === "occupied" && Object.isFrozen(detail.asset.rolledStats),
    ).toBe(true);
    expect(
      detail.status === "occupied" &&
        !Object.is(detail.asset.rolledStats, originalAsset.rolledStats),
    ).toBe(true);
    expect(() => {
      (first.slots as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (first.slots[0] as { label: string }).label = "forged";
    }).toThrow(TypeError);
    expect(JSON.stringify(frozenState)).toBe(before);
  });

  test("fails closed on malformed state and mismatched source identity", () => {
    const duplicate = fresh();
    duplicate.containers.inventory.slots = [
      { index: 0, asset: stack() },
      { index: 0, asset: stack() },
    ];
    expect(() =>
      containers.projectDiscordHeroContainerTabs(indexes, duplicate),
    ).toThrow("container repeats slot 0");

    const outside = fresh();
    outside.containers.inventory.slots = [{ index: 20, asset: stack() }];
    expect(() =>
      containers.projectDiscordHeroContainerTabs(indexes, outside),
    ).toThrow("slot 20 is outside unlocked capacity 20");

    const wrongIdentity = fresh();
    wrongIdentity.containers.inventory.slots = [
      { index: 0, asset: { kind: "stack", itemKey: 300001, quantity: 1 } },
    ];
    expect(() =>
      containers.projectDiscordHeroContainerTabs(indexes, wrongIdentity),
    ).toThrow("is a stack but item 300001 is GEAR");

    expect(() =>
      containers.projectDiscordHeroContainerTabs(
        withInventorySourceIndex(indexes, 20, 21),
        fresh(),
      ),
    ).toThrow("inventory source row 21 does not match slot index 20");
  });

  test("rejects rows and indexed groups that disagree in any container source table", () => {
    const inventoryCost = withContainerGroupMutation(
      indexes,
      "inventory",
      (groups, rows) => {
        groups.set(20, [{ ...rows[20]!, CostForUnlock: 51 }]);
      },
    );
    expect(() =>
      containers.projectDiscordHeroContainerTabs(inventoryCost, fresh()),
    ).toThrow("inventory indexed source key 20 disagrees with row 20");

    const stashIndex = withContainerGroupMutation(
      indexes,
      "stash",
      (groups, rows) => {
        groups.set(41, [{ ...rows[41]!, Index: 42 }]);
      },
    );
    expect(() =>
      containers.projectDiscordHeroContainerTabs(stashIndex, fresh()),
    ).toThrow("stash indexed source key 41 disagrees with row 41");

    const storageDuplicate = withContainerGroupMutation(
      indexes,
      "storage",
      (groups, rows) => {
        groups.set(39, [rows[39]!, { ...rows[39]! }]);
      },
    );
    expect(() =>
      containers.projectDiscordHeroContainerTabs(storageDuplicate, fresh()),
    ).toThrow("storage indexed source key 39 has 2 rows");

    const tradingMissing = withContainerGroupMutation(
      indexes,
      "trading_stash",
      (groups) => {
        groups.delete(9);
      },
    );
    expect(() =>
      containers.projectDiscordHeroContainerTabs(tradingMissing, fresh()),
    ).toThrow("trading_stash source index has 9 keys for 10 rows");
  });
});
