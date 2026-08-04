import { describe, expect, test } from "bun:test";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { loadDiscordHeroCommunityAchievements } from "../community-achievements/loader";
import { loadDiscordHeroCommunityContent } from "../community-content/loader";
import { loadDiscordHeroCommunityMarket } from "../community-market/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../domain/invariants";
import { sourceIntervalCandidates } from "../domain/items";
import { DISCORD_HERO_VIEWS, decodeDiscordHeroCustomId } from "./custom-id";
import {
  encodeDiscordHeroAchievementPage,
  encodeDiscordHeroAchievementTarget,
} from "./achievements";
import {
  discordHeroAttributePage,
  encodeDiscordHeroAttributePage,
  encodeDiscordHeroAttributeTarget,
  projectDiscordHeroAttributeTrees,
  readDiscordHeroAttributeDetail,
} from "./attributes";
import { encodeDiscordHeroCollectionPage } from "./collection";
import {
  encodeDiscordHeroContainerPageTarget,
  projectDiscordHeroContainerPage,
  readDiscordHeroContainerSlot,
  type DiscordHeroContainerKind,
} from "./containers";
import {
  discordHeroCubeMainRecipeOptions,
  discordHeroCubeSubRecipeOptions,
  encodeDiscordHeroCubePage,
} from "./cube";
import {
  DISCORD_HERO_COMMUNITY_CATEGORIES,
  discordHeroCommunityContentPage,
  discordHeroCommunityContentPageCount,
  encodeDiscordHeroCommunityChunkTarget,
  encodeDiscordHeroCommunityDocumentTarget,
  readDiscordHeroCommunityContentDocument,
} from "./community-content";
import {
  DISCORD_HERO_INVENTORY_ALL_FILTER,
  decodeDiscordHeroItemEffectsPageTarget,
  decodeDiscordHeroItemEffectsSectionTarget,
  encodeDiscordHeroEquipTarget,
  encodeDiscordHeroEquipmentPage,
  encodeDiscordHeroEquipmentSelection,
  encodeDiscordHeroInventoryPage,
  encodeDiscordHeroUnequipTarget,
} from "./inventory";
import {
  discordHeroItemEffectsPage,
  discordHeroItemEffectsTextRows,
} from "./item-effects";
import {
  encodeDiscordHeroSkillPage,
  encodeDiscordHeroSkillTarget,
} from "./skills";
import {
  discordHeroMarketPage,
  discordHeroMarketPageCount,
  readDiscordHeroMarketDetail,
  type DiscordHeroMarketViewKind,
} from "./market";
import {
  projectDiscordHeroMonsterAttackKits,
  projectDiscordHeroStageMonsterSourceRows,
} from "./world";
import { renderDiscordHeroWorkspace } from "./workspace";

function collectCustomIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectCustomIds);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.custom_id === "string" ? [record.custom_id] : []),
    ...Object.values(record).flatMap(collectCustomIds),
  ];
}

function countDiscordComponents(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => total + countDiscordComponents(item),
      0,
    );
  }
  if (typeof value !== "object" || value === null) return 0;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.type === "number" ? 1 : 0) +
    Object.values(record).reduce<number>(
      (total, item) => total + countDiscordComponents(item),
      0,
    )
  );
}

function collectTextDisplayContents(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectTextDisplayContents);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(record.type === 10 && typeof record.content === "string"
      ? [record.content]
      : []),
    ...Object.values(record).flatMap(collectTextDisplayContents),
  ];
}

function readCanonicalJsonLine(renderedText: string, prefix: string): string {
  const line = renderedText
    .split("\n")
    .find((candidate) => candidate.startsWith(prefix));
  if (line === undefined) {
    throw new Error(`rendered text has no ${prefix} line`);
  }
  return line.slice(prefix.length);
}

function collectSelectMenus(value: unknown): Array<{
  customId: string;
  options: Array<Record<string, unknown>>;
  minValues?: number;
  maxValues?: number;
}> {
  if (Array.isArray(value)) return value.flatMap(collectSelectMenus);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(record.type === 3 &&
    typeof record.custom_id === "string" &&
    Array.isArray(record.options)
      ? [
          {
            customId: record.custom_id,
            options: record.options as Array<Record<string, unknown>>,
            ...(typeof record.min_values === "number"
              ? { minValues: record.min_values }
              : {}),
            ...(typeof record.max_values === "number"
              ? { maxValues: record.max_values }
              : {}),
          },
        ]
      : []),
    ...Object.values(record).flatMap(collectSelectMenus),
  ];
}

function assertDiscordComponentBounds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertDiscordComponentBounds(entry);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (typeof record.custom_id === "string") {
    expect(record.custom_id.length).toBeLessThanOrEqual(100);
  }
  for (const field of [
    "label",
    "description",
    "placeholder",
    "value",
  ] as const) {
    if (typeof record[field] === "string") {
      expect(record[field].length).toBeLessThanOrEqual(100);
    }
  }
  if (record.type === 10 && typeof record.content === "string") {
    expect(record.content.length).toBeLessThanOrEqual(4_000);
  }
  if (Array.isArray(record.options)) {
    expect(record.options.length).toBeLessThanOrEqual(25);
  }
  for (const entry of Object.values(record)) {
    assertDiscordComponentBounds(entry);
  }
}

function assertDiscordHeroCommunityRenderBounds(value: unknown): void {
  const customIds = collectCustomIds(value);
  expect(new Set(customIds).size).toBe(customIds.length);
  expect(countDiscordComponents(value)).toBeLessThanOrEqual(40);
  assertDiscordComponentBounds(value);
}

function stateWithTwentySixEquippedItems(
  indexes: ReturnType<typeof buildCatalogIndexes>,
) {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  const itemKeys = {
    SWORD: 300001,
    BOW: 310001,
    STAFF: 320001,
    SHIELD: 400001,
    ARROW: 410001,
    ORB: 420001,
    HELMET: 500001,
    ARMOR: 510001,
    GLOVES: 520001,
    BOOTS: 530001,
    AMULET: 601011,
    EARING: 611011,
    RING: 621011,
    BRACER: 631011,
  } as const;
  const categories = {
    101: [
      "SWORD",
      "SHIELD",
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ],
    201: [
      "BOW",
      "ARROW",
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ],
    301: ["STAFF", "ORB", "HELMET", "ARMOR", "GLOVES", "BOOTS"],
  } as const;
  for (const hero of state.heroes) {
    const heroCategories = categories[hero.heroKey as keyof typeof categories];
    if (heroCategories === undefined) continue;
    hero.equipment.push(
      ...heroCategories.map((gearType, index) => ({
        slot: gearType,
        asset: {
          kind: "gear" as const,
          instanceId: `equipped-${hero.heroKey}-${gearType}`,
          itemKey: itemKeys[gearType],
          rolledStats:
            hero.heroKey === 301 && gearType === "BOOTS"
              ? Array.from({ length: 620 }, () => ({
                  statModKey: 105401,
                  value: 100,
                }))
              : [],
        },
      })),
    );
  }
  validatePlayerAgainstCatalog(state, indexes);
  return state;
}

function stateWithAllReachableItemEffects(
  indexes: ReturnType<typeof buildCatalogIndexes>,
  itemKey = 300001,
  instanceId = "workspace-item-effects",
) {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  const item = indexes.tables.items.groups.get(itemKey)?.[0];
  if (item?.type !== "GEAR" || item.gear === null) {
    throw new Error(`Item Effects workspace fixture ${itemKey} is not gear`);
  }
  const rolledStats = [...indexes.tables.stat_mods.groups]
    .sort(([left], [right]) => left - right)
    .map(([statModKey, rows]) => ({
      statModKey,
      value: sourceIntervalCandidates(rows[0]!)[0]!,
    }));
  expect(rolledStats).toHaveLength(62);
  state.heroes[0]!.equipment.push({
    slot: item.gear,
    asset: {
      kind: "gear",
      instanceId,
      itemKey,
      rolledStats,
    },
  });
  validatePlayerAgainstCatalog(state, indexes);
  return state;
}

describe("DiscordHero private workspace", () => {
  test("renders every view with owner/revision-bound navigation and source actions", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const achievements = await loadDiscordHeroCommunityAchievements();
    const market = await loadDiscordHeroCommunityMarket();
    const snapshot = {
      revision: 17,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };

    for (const view of DISCORD_HERO_VIEWS) {
      const rendered = renderDiscordHeroWorkspace(
        "123",
        view,
        snapshot,
        indexes,
        undefined,
        {},
        achievements,
        market,
      );
      const customIds = collectCustomIds(rendered.toJSON());
      const expectedControlCount =
        view === "inventory"
          ? 20
          : view === "heroes"
            ? 11
            : view === "cube"
              ? 21
              : view === "runes"
                ? 15
                : view === "world"
                  ? 13
                  : view === "collection"
                    ? 14
                    : view === "codex"
                      ? 13
                      : view === "market"
                        ? 16
                        : // A fresh player has capacity 1, so Party emits one
                          // menu for the single occupied slot.
                          view === "party"
                          ? 11
                          : 10;
      expect(customIds).toHaveLength(expectedControlCount);
      expect(new Set(customIds).size).toBe(expectedControlCount);
      expect(customIds.slice(-10).map(decodeDiscordHeroCustomId)).toEqual(
        DISCORD_HERO_VIEWS.map((targetView) => ({
          ownerId: "123",
          view: targetView,
          action: "view",
          revision: 17,
        })),
      );
    }
  });

  test("renders all 1,890 captured Market journeys with exact detail and Discord-safe controls", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const market = await loadDiscordHeroCommunityMarket();
    const snapshot = {
      revision: 17,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const kinds = [
      "all",
      "confirmed",
      "unconfirmed",
    ] as const satisfies readonly DiscordHeroMarketViewKind[];
    const expectedCounts = {
      all: 945,
      confirmed: 935,
      unconfirmed: 10,
    } as const;
    let renderedTargets = 0;

    for (const kind of kinds) {
      const pageCount = discordHeroMarketPageCount(market, indexes, kind);
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const page = discordHeroMarketPage(market, indexes, kind, pageIndex);
        const pageBoard = renderDiscordHeroWorkspace(
          "123",
          "market",
          snapshot,
          indexes,
          undefined,
          { marketPageTarget: page.pageTarget },
          undefined,
          market,
        ).toJSON();
        const pageText = collectTextDisplayContents(pageBoard).join("");
        const select = collectSelectMenus(pageBoard).find(
          (menu) => decodeDiscordHeroCustomId(menu.customId).view === "market",
        );

        expect(page.totalItems).toBe(expectedCounts[kind]);
        expect(pageText).toContain(
          "Captured Community Market snapshot · 945 All · 935 Confirmed · 10 Unconfirmed",
        );
        expect(pageText).toContain(
          `Captured ${market.provenance.pages.capturedAtMin} → ${market.provenance.pages.capturedAtMax}`,
        );
        expect(pageText).toContain(market.provenance.sourceAggregateSha256);
        expect(pageText).toContain(market.provenance.compiledSha256);
        expect(select?.options.map((option) => option.value)).toEqual(
          page.options.map((option) => option.value),
        );
        expect(countDiscordComponents(pageBoard)).toBeLessThanOrEqual(40);
        assertDiscordComponentBounds(pageBoard);

        for (const option of page.options) {
          const detail = readDiscordHeroMarketDetail(
            market,
            indexes,
            option.value,
          );
          const detailBoard = renderDiscordHeroWorkspace(
            "123",
            "market",
            snapshot,
            indexes,
            undefined,
            {
              marketPageTarget: page.pageTarget,
              marketTarget: option.value,
            },
            undefined,
            market,
          ).toJSON();
          const detailChunks = collectTextDisplayContents(detailBoard);
          const detailText = detailChunks.join("");
          const detailSelect = collectSelectMenus(detailBoard).find(
            (menu) =>
              decodeDiscordHeroCustomId(menu.customId).view === "market",
          );
          const detailCustomIds = collectCustomIds(detailBoard);

          expect(detailText).toContain(
            `**${detail.title}** · #${detail.catalogItem.key} · ${detail.status}`,
          );
          expect(detailText).toContain(
            `${detail.catalogItem.slug} · ${detail.catalogItem.type} · ${detail.catalogItem.grade}`,
          );
          expect(detailText).toContain(JSON.stringify(detail.stats));
          expect(detailText).toContain(JSON.stringify(detail.priceHistory));
          expect(detailText).toContain(JSON.stringify(detail.orderBook));
          expect(detailText).toContain(detail.rawBody);
          expect(detailText).toContain(detail.provenance.page.capturedAt);
          expect(detailText).toContain(detail.provenance.page.sourceUrl);
          expect(detailText).toContain(detail.provenance.page.sha256);
          expect(detailText).toContain(
            detail.provenance.artifact.sourceAggregateSha256,
          );
          expect(detailText).toContain(
            detail.provenance.artifact.compiledSha256,
          );
          const pageProvenanceJson = readCanonicalJsonLine(
            detailText,
            "Page provenance JSON: ",
          );
          const artifactProvenanceJson = readCanonicalJsonLine(
            detailText,
            "Artifact provenance JSON: ",
          );
          expect(pageProvenanceJson).toBe(
            JSON.stringify(detail.provenance.page),
          );
          expect(JSON.parse(pageProvenanceJson)).toEqual(
            detail.provenance.page,
          );
          expect(artifactProvenanceJson).toBe(
            JSON.stringify(detail.provenance.artifact),
          );
          expect(JSON.parse(artifactProvenanceJson)).toEqual(
            detail.provenance.artifact,
          );
          expect(detailText).toContain(
            "Captured snapshot only; live settlement remains oracle-gated.",
          );
          expect(
            detailChunks.every(
              (chunk) =>
                !/[\uD800-\uDBFF]$/.test(chunk) &&
                !/^[\uDC00-\uDFFF]/.test(chunk),
            ),
          ).toBe(true);
          expect(
            detailSelect?.options.find(
              (candidate) => candidate.value === option.value,
            )?.default,
          ).toBe(true);
          expect(
            detailCustomIds
              .map(decodeDiscordHeroCustomId)
              .every((control) =>
                ["view", "page", "select"].includes(control.action),
              ),
          ).toBe(true);
          expect(new Set(detailCustomIds).size).toBe(detailCustomIds.length);
          expect(countDiscordComponents(detailBoard)).toBeLessThanOrEqual(40);
          assertDiscordComponentBounds(detailBoard);
          renderedTargets += 1;
        }
      }
    }

    expect(renderedTargets).toBe(1_890);
  }, 60_000);

  test("renders exact capacity costs and disables unaffordable or maximum actions", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 9,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    snapshot.state.gold = 50;

    const rendered = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      snapshot,
      indexes,
    ).toJSON();
    const json = JSON.stringify(rendered);
    const decoded = collectCustomIds(rendered)
      .map(decodeDiscordHeroCustomId)
      .filter((customId) => customId.action === "unlock");

    expect(decoded).toEqual([
      {
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 9,
        value: "cu-i-i-0-0",
      },
      {
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 9,
        value: "cu-s-i-0-0",
      },
      {
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 9,
        value: "cu-o-i-0-0",
      },
      {
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 9,
        value: "cu-t-i-0-0",
      },
    ]);
    expect(json).toContain("Inventory +1 · 50g");
    expect(json).toContain("Stash +1 · 100g");
    expect(json).toContain("Storage +1 · 50g");
    expect(json).toContain("Trading Stash · MAX");
    expect(
      (rendered.components as unknown as Array<Record<string, unknown>>).some(
        (component) => JSON.stringify(component).includes('"disabled":true'),
      ),
    ).toBe(true);
  });

  test("traverses every max Container identity and renders lossless occupied or free detail within Discord bounds", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const stackItem = indexes.tables.items.rows.find(
      (item) => item.deleted !== true && item.type !== "GEAR",
    );
    if (stackItem === undefined) {
      throw new Error("test catalog has no stack item");
    }
    state.containers.inventory = { unlockedSlots: 260, slots: [] };
    state.containers.stash = {
      unlockedSlots: 131,
      slots: [
        {
          index: 130,
          asset: {
            kind: "gear",
            instanceId: "stash-max-rolls",
            itemKey: 300001,
            rolledStats: Array.from({ length: 620 }, () => ({
              statModKey: 100101,
              value: 1,
            })),
          },
        },
      ],
    };
    state.containers.storage = {
      unlockedSlots: 101,
      slots: [
        {
          index: 100,
          asset: {
            kind: "stack",
            itemKey: stackItem.id,
            quantity: Number.MAX_SAFE_INTEGER,
          },
        },
      ],
    };
    state.containers.tradingStash = { unlockedSlots: 10, slots: [] };
    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "inventory-free-slot-origin",
        itemKey: 300001,
        rolledStats: [],
      },
    });
    validatePlayerAgainstCatalog(state, indexes);
    const snapshot = { revision: 31, state };
    const defaultBoard = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "inventory",
      snapshot,
      indexes,
    ).toJSON();
    const tabTargets = collectCustomIds(defaultBoard)
      .map(decodeDiscordHeroCustomId)
      .filter(
        (customId) =>
          customId.view === "inventory" &&
          customId.action === "page" &&
          customId.value?.startsWith("cp-"),
      )
      .slice(0, 4)
      .map((customId) => customId.value);
    expect(tabTargets).toEqual(["cp-i-0", "cp-s-0", "cp-o-0", "cp-t-0"]);

    const inventoryFreeSlots: number[] = [];
    for (let page = 0; page < 11; page += 1) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "inventory",
        snapshot,
        indexes,
        undefined,
        {
          equipmentPage: 0,
          equipmentSelection: { heroKey: 101, gearType: "SWORD" },
          freeInventoryPage: page,
        },
      ).toJSON();
      const freeMenu = collectSelectMenus(rendered).find(
        (menu) => decodeDiscordHeroCustomId(menu.customId).action === "unequip",
      );
      if (freeMenu === undefined) {
        throw new Error(`Inventory free page ${page} has no selector`);
      }
      inventoryFreeSlots.push(
        ...freeMenu.options.map((option) => Number(option.value)),
      );
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
    }
    expect(inventoryFreeSlots).toEqual(
      Array.from({ length: 260 }, (_, index) => index),
    );

    const expected = [
      ["stash", 131, 6],
      ["storage", 101, 5],
      ["tradingStash", 10, 1],
    ] as const satisfies readonly [DiscordHeroContainerKind, number, number][];
    let reachableContainerSlots = 0;
    for (const [kind, capacity, pageCount] of expected) {
      const reached: number[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageTarget = encodeDiscordHeroContainerPageTarget(
          indexes,
          state,
          kind,
          pageIndex,
        );
        const page = projectDiscordHeroContainerPage(
          indexes,
          state,
          pageTarget,
        );
        const pageBoard = renderDiscordHeroWorkspace(
          "12345678901234567890",
          "inventory",
          snapshot,
          indexes,
          undefined,
          { containerPageTarget: pageTarget },
        ).toJSON();
        const selector = collectSelectMenus(pageBoard).find(
          (menu) =>
            decodeDiscordHeroCustomId(menu.customId).value === pageTarget,
        );
        expect(selector?.options.map((option) => option.value)).toEqual(
          page.slots.map((slot) => slot.target),
        );
        expect(countDiscordComponents(pageBoard)).toBeLessThanOrEqual(40);
        assertDiscordComponentBounds(pageBoard);
        expect(new Set(collectCustomIds(pageBoard)).size).toBe(
          collectCustomIds(pageBoard).length,
        );

        for (const slot of page.slots) {
          const detail = readDiscordHeroContainerSlot(
            indexes,
            state,
            page,
            slot.target,
          );
          const detailBoard = renderDiscordHeroWorkspace(
            "12345678901234567890",
            "inventory",
            snapshot,
            indexes,
            undefined,
            {
              containerPageTarget: pageTarget,
              containerSlotTarget: slot.target,
            },
          ).toJSON();
          const detailText = collectTextDisplayContents(detailBoard).join("");
          expect(detailText).toContain(`${page.label} slot #${slot.slotIndex}`);
          if (detail.status === "free") {
            expect(detailText).toContain("Free and unlocked");
          } else {
            const identityJson = readCanonicalJsonLine(
              detailText,
              "Asset identity JSON: ",
            );
            const sourceJson = readCanonicalJsonLine(
              detailText,
              "Rolled stat sources JSON: ",
            );
            const valuesJson = readCanonicalJsonLine(
              detailText,
              "Rolled stat values JSON: ",
            );
            const identity = JSON.parse(identityJson) as Omit<
              typeof detail.asset,
              "rolledStats"
            >;
            const sources = new Map<
              number,
              { statType: string; modType: string }
            >(
              (
                JSON.parse(sourceJson) as Array<{
                  statModKey: number;
                  statType: string;
                  modType: string;
                }>
              ).map(({ statModKey, statType, modType }) => [
                statModKey,
                { statType, modType },
              ]),
            );
            const rolledStats = (
              JSON.parse(valuesJson) as Array<[number, number]>
            ).map(([statModKey, value]) => ({
              statModKey,
              ...sources.get(statModKey)!,
              value,
            }));
            expect({
              ...identity,
              rolledStats,
            } as typeof detail.asset).toEqual(detail.asset);
          }
          expect(countDiscordComponents(detailBoard)).toBeLessThanOrEqual(40);
          assertDiscordComponentBounds(detailBoard);
          const detailIds = collectCustomIds(detailBoard);
          expect(new Set(detailIds).size).toBe(detailIds.length);
          reached.push(slot.slotIndex);
          reachableContainerSlots += 1;
        }
      }
      expect(reached).toEqual(
        Array.from({ length: capacity }, (_, index) => index),
      );
    }
    expect(inventoryFreeSlots.length + reachableContainerSlots).toBe(502);
  }, 30_000);

  test("renders the exact projected Home dashboard without raw party IDs or session secrets", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    // Rune 21 buys the second slot, so slot 2 is empty and slot 3 stays locked.
    state.runes = [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 21, level: 1 },
    ];
    state.party = [101, null, null];
    state.heroes[0]!.level = 10;
    state.heroes[0]!.xp = 7;
    state.heroes[2]!.level = 30;
    state.heroes[2]!.xp = 9;
    state.gold = Number.MAX_SAFE_INTEGER;
    state.campaign = {
      highestStageKey: 1208,
      stages: [
        {
          stageKey: 1208,
          clearCount: 7,
          firstClearClaimed: true,
          bestClearMs: 1_234,
        },
      ],
    };
    state.stageSession = {
      sessionId: "secret-session-id",
      stageKey: 1208,
      party: [101, null, 301],
      startedAtMs: 10,
      advancedThroughMs: 20,
      wave: 5,
      rngSeed: "secret-rng-seed",
      rngCursor: 9,
      pendingRewards: { gold: 0, xp: 0, items: [] },
    };
    const before = structuredClone(state);

    const rendered = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "home",
      { revision: Number.MAX_SAFE_INTEGER, state },
      indexes,
    ).toJSON();
    const content = collectTextDisplayContents(rendered).join("\n");

    expect(content).toContain(
      "Knight (#101) · Knight · Lv10 · XP 7 / 74,880 · 74,873 XP to Lv11 · 0%",
    );
    expect(content).toContain(
      "Base + allocated Attributes [Base, Attribute] · uncapped and unrounded raw source units: Armor 45 · AttackDamage 2 · AttackSpeed 90 · CastSpeed 100 · CooldownReduction 0 · CriticalChance 25 · CriticalDamage 1400 · MaxHp 130 · MovementSpeed 950",
    );
    expect(content).toContain(
      "Sorcerer (#301) · Sorcerer · Lv30 · XP 9 / 15,618,450 · 15,618,441 XP to Lv31 · 0%",
    );
    expect(content).toContain(
      "Slot 1: Knight (#101) · Lv10 · XP 7 / 74,880 · 74,873 XP to Lv11 · 0%",
    );
    expect(content).toContain("Slot 2: Empty");
    expect(content).toContain("Sacred Tomb (#1208) · Source Lv20 · 7 clears");
    expect(content).toContain(
      "Active: Sacred Tomb (#1208) · Wave 5 · Pending items 0",
    );
    expect(content).toContain("**Offline:** Locked · credited 0 gold / 0 XP");
    expect(content).toContain("Alert: Empty party slots 2");
    expect(content).toContain(
      "Alert: Stage #1208 has unresolved source monsters 20101",
    );
    expect(content).not.toContain("secret-session-id");
    expect(content).not.toContain("secret-rng-seed");
    expect(content).not.toContain("**Party:** 101 ·");
    expect(state).toEqual(before);
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(rendered);
    const customIds = collectCustomIds(rendered);
    expect(new Set(customIds).size).toBe(customIds.length);

    const oracleState = structuredClone(state);
    oracleState.runes = [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 11, level: 1 },
      { key: 11001, level: 1 },
    ];
    const oracleBoard = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "home",
      { revision: Number.MAX_SAFE_INTEGER, state: oracleState },
      indexes,
    ).toJSON();
    const oracleContent = collectTextDisplayContents(oracleBoard).join("\n");
    expect(oracleContent).toContain(
      "**Offline:** Runtime oracle required · credited 0 gold / 0 XP",
    );
    expect(countDiscordComponents(oracleBoard)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(oracleBoard);
  });

  test("renders the terminal level-100 bar without implying level 101", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.level = 100;
    state.heroes[0]!.xp = 1_997_771_835;
    const before = structuredClone(state);

    const rendered = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "home",
      { revision: 7, state },
      indexes,
    ).toJSON();
    const content = collectTextDisplayContents(rendered).join("\n");

    expect(content).toContain(
      "Knight (#101) · Knight · Lv100 · XP 1,997,771,835 / 1,997,771,834 terminal · 100% · Max level",
    );
    expect(content).toContain(
      "Slot 1: Knight (#101) · Lv100 · XP 1,997,771,835 / 1,997,771,834 terminal · 100% · Max level",
    );
    expect(content).not.toContain("Lv101");
    expect(content).not.toContain("XP to Lv101");
    expect(state).toEqual(before);
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(rendered);
  });

  test("renders every occupied Inventory slot in bounded source-exact pages", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.containers.inventory.unlockedSlots = 30;
    state.containers.inventory.slots.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        index,
        asset: {
          kind: "gear" as const,
          instanceId: `paged-sword-${index}`,
          itemKey: 300001,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      })),
    );
    const snapshot = { revision: 21, state };

    const first = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      snapshot,
      indexes,
      undefined,
      { inventoryPage: 0 },
    ).toJSON();
    const last = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      snapshot,
      indexes,
      undefined,
      { inventoryPage: 1 },
    ).toJSON();
    const firstMenus = collectSelectMenus(first);
    const lastMenus = collectSelectMenus(last);
    const firstInventory = firstMenus.find(
      (menu) =>
        decodeDiscordHeroCustomId(menu.customId).value ===
        encodeDiscordHeroInventoryPage(DISCORD_HERO_INVENTORY_ALL_FILTER, 0),
    )!;
    const lastInventory = lastMenus.find(
      (menu) =>
        decodeDiscordHeroCustomId(menu.customId).value ===
        encodeDiscordHeroInventoryPage(DISCORD_HERO_INVENTORY_ALL_FILTER, 1),
    )!;

    expect(firstInventory.options).toHaveLength(25);
    expect(lastInventory.options).toHaveLength(1);
    expect(firstInventory.options[0]).toMatchObject({
      label: "Slot 0 · Long Sword",
      description: "GEAR · SWORD · Lv1 · COMMON",
      value: "0",
    });
    expect(lastInventory.options[0]).toMatchObject({
      label: "Slot 25 · Long Sword",
      value: "25",
    });
    expect(JSON.stringify(first)).toContain(
      "Slot 0 · Long Sword (#300001) · GEAR/SWORD · Lv1 · COMMON",
    );
    expect(JSON.stringify(last)).toContain("Occupied page 2/2");
    expect(
      Math.max(...collectCustomIds(first).map((customId) => customId.length)),
    ).toBeLessThanOrEqual(100);
    expect(countDiscordComponents(first)).toBeLessThanOrEqual(40);
    expect(countDiscordComponents(last)).toBeLessThanOrEqual(40);
  });

  test("renders source-backed Inventory filters with filtered pages and filter-bound item actions", async () => {
    type InventoryFilter = {
      readonly kind: "gear-type";
      readonly value: "SWORD";
    };
    const filter = { kind: "gear-type", value: "SWORD" } as const;
    const encodePage = encodeDiscordHeroInventoryPage as unknown as (
      filter: InventoryFilter,
      page: number,
    ) => string;
    const encodeEquip = encodeDiscordHeroEquipTarget as unknown as (
      filter: InventoryFilter,
      page: number,
      slot: number,
    ) => string;
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.containers.inventory.unlockedSlots = 60;
    for (let index = 25; index >= 0; index -= 1) {
      state.containers.inventory.slots.push({
        index,
        asset: {
          kind: "gear",
          instanceId: `filtered-workspace-sword-${index}`,
          itemKey: 300001,
          rolledStats: Array.from({ length: 26 }, () => ({
            statModKey: 100101,
            value: index + 1,
          })),
        },
      });
    }
    state.containers.inventory.slots.push({
      index: 59,
      asset: { kind: "stack", itemKey: 140001, quantity: 2 },
    });
    const snapshot = { revision: 24, state };

    const rendered = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      snapshot,
      indexes,
      undefined,
      {
        inventoryFilter: filter,
        inventoryPage: 1,
        inventorySlotIndex: 25,
        rollPage: 1,
      } as never,
    ).toJSON();
    const textContent = collectTextDisplayContents(rendered).join("\n");
    const menus = collectSelectMenus(rendered);
    const primaryFilters = menus.find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).value === "fp",
    )!;
    const gearFilters = menus.find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).value === "fg",
    )!;
    const inventoryMenu = menus.find(
      (menu) =>
        decodeDiscordHeroCustomId(menu.customId).value ===
        encodePage(filter, 1),
    )!;
    const equipMenu = menus.find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).action === "equip",
    )!;

    expect(textContent).toContain(
      "Filter: Gear type SWORD · Matching: 26/27 · Occupied page 2/2",
    );
    expect(textContent).toContain("Slot 25 · Long Sword");
    expect(textContent).not.toContain("Slot 59 · Wood");
    expect(primaryFilters.options.length).toBeLessThanOrEqual(25);
    expect(primaryFilters.options).toContainEqual(
      expect.objectContaining({ label: "All", value: "a" }),
    );
    expect(primaryFilters.options).toContainEqual(
      expect.objectContaining({ label: "Grade RARE", value: "rRARE" }),
    );
    expect(gearFilters.options).toHaveLength(20);
    expect(gearFilters.options).toContainEqual(
      expect.objectContaining({
        label: "Gear type SWORD",
        value: "gSWORD",
        default: true,
      }),
    );
    expect(inventoryMenu.options).toEqual([
      expect.objectContaining({ label: "Slot 25 · Long Sword", value: "25" }),
    ]);
    expect(decodeDiscordHeroCustomId(equipMenu.customId)).toMatchObject({
      ownerId: "123",
      view: "inventory",
      action: "equip",
      revision: 24,
      value: encodeEquip(filter, 1, 25),
    });
    expect(
      collectCustomIds(rendered).some(
        (customId) =>
          decodeDiscordHeroCustomId(customId).value === "ri-gSWORD-1-p-1",
      ),
    ).toBe(true);
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(rendered);
    const customIds = collectCustomIds(rendered);
    expect(new Set(customIds).size).toBe(customIds.length);
  });

  test("renders exact selected gear and only compatible equip hero choices", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.containers.inventory.slots.push({
      index: 4,
      asset: {
        kind: "gear",
        instanceId: "selected-sword",
        itemKey: 300001,
        rolledStats: [
          { statModKey: 100101, value: 1 },
          { statModKey: 100201, value: 40 },
        ],
      },
    });

    const rendered = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      { revision: 22, state },
      indexes,
      undefined,
      { inventoryPage: 0, inventorySlotIndex: 4 },
    ).toJSON();
    const json = JSON.stringify(rendered);
    const equipMenu = collectSelectMenus(rendered).find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).action === "equip",
    )!;

    expect(decodeDiscordHeroCustomId(equipMenu.customId)).toEqual({
      ownerId: "123",
      view: "inventory",
      action: "equip",
      revision: 22,
      value: encodeDiscordHeroEquipTarget(
        DISCORD_HERO_INVENTORY_ALL_FILTER,
        0,
        4,
      ),
    });
    expect(equipMenu.options).toEqual([
      expect.objectContaining({
        label: "Knight",
        description: "#101 · Knight · SWORD",
        value: "101",
      }),
    ]);
    expect(json).toContain(
      "Long Sword · #300001 · GEAR · SWORD · Lv1 · COMMON",
    );
    expect(json).toContain("Instance: selected-sword");
    expect(json).toContain("#100101 · AttackDamage · FLAT · 1");
    expect(json).toContain("#100201 · AttackSpeed · ADDITIVE · 40");
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
  });

  test("binds equipped gear to a bounded explicit free-slot unequip picker", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.containers.inventory.unlockedSlots = 30;
    state.containers.inventory.slots.push({
      index: 0,
      asset: { kind: "stack", itemKey: 910011, quantity: 2 },
    });
    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "equipped-sword",
        itemKey: 300001,
        rolledStats: [{ statModKey: 100101, value: 2 }],
      },
    });

    const rendered = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      { revision: 23, state },
      indexes,
      undefined,
      {
        equipmentPage: 0,
        equipmentSelection: { heroKey: 101, gearType: "SWORD" },
        freeInventoryPage: 0,
      },
    ).toJSON();
    const menus = collectSelectMenus(rendered);
    const equipmentMenu = menus.find(
      (menu) =>
        decodeDiscordHeroCustomId(menu.customId).value ===
        encodeDiscordHeroEquipmentPage(0),
    )!;
    const unequipMenu = menus.find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).action === "unequip",
    )!;

    expect(equipmentMenu.options[0]).toMatchObject({
      value: encodeDiscordHeroEquipmentSelection(101, "SWORD"),
    });
    expect(decodeDiscordHeroCustomId(unequipMenu.customId)).toEqual({
      ownerId: "123",
      view: "inventory",
      action: "unequip",
      revision: 23,
      value: encodeDiscordHeroUnequipTarget(0, 101, "SWORD", 0),
    });
    expect(unequipMenu.options).toHaveLength(25);
    expect(unequipMenu.options.map((option) => option.value)).toEqual(
      Array.from({ length: 25 }, (_, index) => String(index + 1)),
    );
    expect(JSON.stringify(rendered)).toContain(
      "Equipped by Knight (#101) · SWORD",
    );
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
  });

  test("renders all 62 exact equipped Item Effects in source-ordered pages of 25, 25, and 12", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = stateWithAllReachableItemEffects(indexes);
    const snapshot = { revision: 31, state };
    const input = {
      indexes,
      state,
      heroKey: 101,
      instanceId: "workspace-item-effects",
    };
    const renderedPages = [0, 1, 2].map((page) =>
      renderDiscordHeroWorkspace(
        "12345678901234567890",
        "inventory",
        snapshot,
        indexes,
        undefined,
        {
          equipmentPage: 0,
          equipmentSelection: { heroKey: 101, gearType: "SWORD" },
          itemEffects: { sourceVector: "rolled", page },
        },
      ).toJSON(),
    );

    expect(
      renderedPages.map((rendered) => {
        const detailMenu = collectSelectMenus(rendered).find((menu) => {
          const customId = decodeDiscordHeroCustomId(menu.customId);
          if (customId.value === undefined) return false;
          try {
            return (
              decodeDiscordHeroItemEffectsPageTarget(indexes, customId.value)
                .sourceVector === "rolled"
            );
          } catch {
            return false;
          }
        });
        return detailMenu?.options.map((option) => option.value);
      }),
    ).toEqual([
      Array.from({ length: 25 }, (_, index) => String(index)),
      Array.from({ length: 25 }, (_, index) => String(index + 25)),
      Array.from({ length: 12 }, (_, index) => String(index + 50)),
    ]);

    for (const [page, rendered] of renderedPages.entries()) {
      const textContent = collectTextDisplayContents(rendered).join("\n");
      const expectedRows = discordHeroItemEffectsTextRows(input, {
        sourceVector: "rolled",
        page,
      });
      // Source-order identity: reverse(safeRows) alone must fail — each option
      // description and the page body row text stay bound to the exact global
      // source row at that option's index (not mere membership).
      const detailMenu = collectSelectMenus(rendered).find((menu) => {
        const customId = decodeDiscordHeroCustomId(menu.customId);
        if (customId.value === undefined) return false;
        try {
          return (
            decodeDiscordHeroItemEffectsPageTarget(indexes, customId.value)
              .sourceVector === "rolled" &&
            decodeDiscordHeroItemEffectsPageTarget(indexes, customId.value)
              .effectPage === page
          );
        } catch {
          return false;
        }
      });
      expect(detailMenu).toBeDefined();
      expect(detailMenu!.options).toHaveLength(expectedRows.length);
      for (const [index, expectedRow] of expectedRows.entries()) {
        expect(textContent).toContain(expectedRow);
        expect(detailMenu!.options[index]!.value).toBe(
          String(page < 2 ? index + page * 25 : index + 50),
        );
        expect(detailMenu!.options[index]!.description).toBe(
          expectedRow.slice(0, 100),
        );
        if (index > 0) {
          expect(textContent.indexOf(expectedRow)).toBeGreaterThan(
            textContent.indexOf(expectedRows[index - 1]!),
          );
        }
      }
      expect(textContent).toContain(
        `Rolled source effects · 62 rows · Page ${page + 1}/3`,
      );
      expect(textContent).not.toContain("Rolled stats · Page");
      expect(JSON.stringify(rendered)).not.toContain("Choose exact free slot");
      expect(
        collectCustomIds(rendered).some((customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          return decoded.action === "unequip";
        }),
      ).toBe(false);
      expect(
        discordHeroItemEffectsPage(input, {
          sourceVector: "rolled",
          page,
        }).rows.map((row) => row.rowIndex),
      ).toEqual(
        page < 2
          ? Array.from({ length: 25 }, (_, index) => index + page * 25)
          : Array.from({ length: 12 }, (_, index) => index + 50),
      );
      assertDiscordHeroCommunityRenderBounds(rendered);
    }

    // Selected detail on page 1 (global row 25) must bind the exact page-1 index-0
    // source row text — not a reversed or off-by-one safeRows association.
    const selectedPageOne = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "inventory",
      snapshot,
      indexes,
      undefined,
      {
        equipmentPage: 0,
        equipmentSelection: { heroKey: 101, gearType: "SWORD" },
        itemEffects: { sourceVector: "rolled", page: 1, rowIndex: 25 },
      },
    ).toJSON();
    const pageOneRows = discordHeroItemEffectsTextRows(input, {
      sourceVector: "rolled",
      page: 1,
    });
    const selectedText = collectTextDisplayContents(selectedPageOne).join("\n");
    expect(selectedText).toContain("Selected effect #25");
    expect(selectedText).toContain(pageOneRows[0]!);
    const selectedMenu = collectSelectMenus(selectedPageOne).find((menu) => {
      const customId = decodeDiscordHeroCustomId(menu.customId);
      if (customId.value === undefined) return false;
      try {
        const target = decodeDiscordHeroItemEffectsPageTarget(
          indexes,
          customId.value,
        );
        return target.sourceVector === "rolled" && target.effectPage === 1;
      } catch {
        return false;
      }
    });
    expect(selectedMenu).toBeDefined();
    expect(selectedMenu!.options[0]!.description).toBe(
      pageOneRows[0]!.slice(0, 100),
    );
    expect(selectedMenu!.options[0]!.value).toBe("25");
    // Reversed association would still contain both ends of the page as membership;
    // require the selected detail block to follow the page header and use index-0 text.
    const headerAt = selectedText.indexOf(
      "Rolled source effects · 62 rows · Page 2/3",
    );
    const selectedAt = selectedText.indexOf("Selected effect #25");
    const detailRowAt = selectedText.indexOf(pageOneRows[0]!, selectedAt);
    expect(headerAt).toBeGreaterThanOrEqual(0);
    expect(selectedAt).toBeGreaterThan(headerAt);
    expect(detailRowAt).toBeGreaterThan(selectedAt);
    expect(selectedMenu!.options[24]!.description).toBe(
      pageOneRows[24]!.slice(0, 100),
    );
    expect(selectedMenu!.options[24]!.description).not.toBe(
      pageOneRows[0]!.slice(0, 100),
    );

    const sectionTargets = collectSelectMenus(renderedPages[0]!).filter(
      (menu) => {
        const value = decodeDiscordHeroCustomId(menu.customId).value;
        if (value === undefined) return false;
        try {
          decodeDiscordHeroItemEffectsSectionTarget(indexes, value);
          return true;
        } catch {
          return false;
        }
      },
    );
    expect(sectionTargets).toHaveLength(1);
    expect(sectionTargets[0]!.options.map((option) => option.value)).toEqual([
      "s",
      "b",
      "i",
      "r",
    ]);
  });

  test("renders an equipped Item Effect detail only when its vector-global row belongs to the current page", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = stateWithAllReachableItemEffects(indexes);
    const snapshot = { revision: 32, state };
    const valid = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      snapshot,
      indexes,
      undefined,
      {
        equipmentPage: 0,
        equipmentSelection: { heroKey: 101, gearType: "SWORD" },
        itemEffects: { sourceVector: "rolled", page: 0, rowIndex: 24 },
      },
    ).toJSON();

    expect(collectTextDisplayContents(valid).join("\n")).toContain(
      "Selected effect #24",
    );
    expect(() =>
      renderDiscordHeroWorkspace(
        "123",
        "inventory",
        snapshot,
        indexes,
        undefined,
        {
          equipmentPage: 0,
          equipmentSelection: { heroKey: 101, gearType: "SWORD" },
          itemEffects: { sourceVector: "rolled", page: 0, rowIndex: 25 },
        },
      ),
    ).toThrow("Item Effects row 25 is outside rolled page 0");
  });

  test("renders unsupported Item Effects and unique-mod oracle gates without application or mutation claims", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const shieldState = createFreshPlayerStateFromCatalog(indexes, 101);
    shieldState.heroes[0]!.equipment.push({
      slot: "SHIELD",
      asset: {
        kind: "gear",
        instanceId: "workspace-unsupported-shield",
        itemKey: 400001,
        rolledStats: [],
      },
    });
    const shield = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      { revision: 33, state: shieldState },
      indexes,
      undefined,
      {
        equipmentPage: 0,
        equipmentSelection: { heroKey: 101, gearType: "SHIELD" },
        itemEffects: { sourceVector: "base", page: 0 },
      },
    ).toJSON();
    expect(collectTextDisplayContents(shield).join("\n")).toContain(
      "#0 base · BlockChance/FLAT · raw 50 RAW · [unsupported-source] · BlockChance application requires the unresolved combat oracle",
    );

    const uniqueState = createFreshPlayerStateFromCatalog(indexes, 101);
    uniqueState.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "workspace-unique-sword",
        itemKey: 309171,
        rolledStats: [],
      },
    });
    const unique = renderDiscordHeroWorkspace(
      "123",
      "inventory",
      { revision: 34, state: uniqueState },
      indexes,
      undefined,
      {
        equipmentPage: 0,
        equipmentSelection: { heroKey: 101, gearType: "SWORD" },
        itemEffects: { sourceVector: "base", page: 0 },
      },
    ).toJSON();
    const uniqueText = collectTextDisplayContents(unique).join("\n");
    expect(uniqueText).toContain(
      "unique-mod 10001 · [oracle-required] · unique-mod runtime semantics are outside the source-proven stat projection",
    );
    expect(uniqueText).not.toMatch(/final combat|final stat|applied effect/i);
    expect(
      collectCustomIds(unique)
        .map(decodeDiscordHeroCustomId)
        .some((customId) =>
          ["equip", "unequip", "buy", "craft"].includes(customId.action ?? ""),
        ),
    ).toBe(false);
  });

  test("keeps empty accessory vectors explicit, unequipped detail legacy, and all inputs unchanged without RNG or time", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.equipment.push({
      slot: "AMULET",
      asset: {
        kind: "gear",
        instanceId: "workspace-empty-amulet",
        itemKey: 601011,
        rolledStats: [],
      },
    });
    state.containers.inventory.slots.push({
      index: 4,
      asset: {
        kind: "gear",
        instanceId: "workspace-legacy-inventory-sword",
        itemKey: 300001,
        rolledStats: [{ statModKey: 100101, value: 1 }],
      },
    });
    const snapshot = { revision: 35, state };
    const stateBefore = JSON.stringify(state);
    const indexesBefore = JSON.stringify(indexes);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error("Item Effects workspace must not use RNG");
    };
    Date.now = () => {
      throw new Error("Item Effects workspace must not read time");
    };
    try {
      const empty = renderDiscordHeroWorkspace(
        "123",
        "inventory",
        snapshot,
        indexes,
        undefined,
        {
          equipmentPage: 0,
          equipmentSelection: { heroKey: 101, gearType: "AMULET" },
          itemEffects: { sourceVector: "base", page: 0 },
        },
      ).toJSON();
      const emptyText = collectTextDisplayContents(empty).join("\n");
      expect(emptyText).toContain("Base source effects · 0 rows · Page 1/1");
      expect(emptyText).toContain("No source-proven base effects.");
      expect(
        collectSelectMenus(empty).some((menu) =>
          decodeDiscordHeroCustomId(menu.customId).value?.startsWith("ef-"),
        ),
      ).toBe(false);

      const legacyLocation = { inventoryPage: 0, inventorySlotIndex: 4 };
      const legacy = renderDiscordHeroWorkspace(
        "123",
        "inventory",
        snapshot,
        indexes,
        undefined,
        legacyLocation,
      ).toJSON();
      const forgedUnequippedEffects = renderDiscordHeroWorkspace(
        "123",
        "inventory",
        snapshot,
        indexes,
        undefined,
        {
          ...legacyLocation,
          itemEffects: { sourceVector: "rolled", page: 0 },
        },
      ).toJSON();
      expect(forgedUnequippedEffects).toEqual(legacy);
      expect(collectTextDisplayContents(legacy).join("\n")).toContain(
        "#100101 · AttackDamage · FLAT · 1",
      );
      expect(
        collectCustomIds(legacy).some(
          (customId) =>
            decodeDiscordHeroCustomId(customId).value?.startsWith("es-") ??
            false,
        ),
      ).toBe(false);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(indexes)).toBe(indexesBefore);
  });

  test("keeps every Inventory mode within actual Components V2 budgets including dense details and notices", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const fresh = createFreshPlayerStateFromCatalog(indexes, 101);
    const denseEquipment = stateWithTwentySixEquippedItems(indexes);
    const effectGear = denseEquipment.heroes
      .flatMap((hero) => hero.equipment)
      .find(
        (equipment) => equipment.asset.instanceId === "equipped-301-BOOTS",
      )!;
    effectGear.asset.rolledStats = [...indexes.tables.stat_mods.groups]
      .sort(([left], [right]) => left - right)
      .map(([statModKey, rows]) => ({
        statModKey,
        value: sourceIntervalCandidates(rows[0]!)[0]!,
      }));
    validatePlayerAgainstCatalog(denseEquipment, indexes);
    const selectedInventory = createFreshPlayerStateFromCatalog(indexes, 101);
    selectedInventory.containers.inventory.unlockedSlots = 260;
    selectedInventory.containers.inventory.slots.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        index,
        asset: {
          kind: "gear" as const,
          instanceId: `workspace-budget-legacy-${index}`,
          itemKey: 300001,
          rolledStats:
            index === 25
              ? Array.from({ length: 620 }, () => ({
                  statModKey: 105401,
                  value: 100,
                }))
              : [],
        },
      })),
    );
    validatePlayerAgainstCatalog(selectedInventory, indexes);

    const cases = [
      {
        label: "fresh root",
        state: fresh,
        location: {},
        notice: undefined,
      },
      {
        label: "selected Inventory stale notice",
        state: selectedInventory,
        location: {
          inventoryPage: 1,
          inventorySlotIndex: 25,
          rollPage: 24,
        },
        notice: "State changed; the read-only rolled-stat page was refreshed.",
      },
      {
        label: "26th equipped stale summary",
        state: denseEquipment,
        location: {
          equipmentPage: 1,
          equipmentSelection: { heroKey: 301, gearType: "BOOTS" },
        },
        notice:
          "State changed; the Inventory selection was refreshed without moving gear.",
      },
      {
        label: "rolled effects current detail",
        state: denseEquipment,
        location: {
          equipmentPage: 1,
          equipmentSelection: { heroKey: 301, gearType: "BOOTS" },
          itemEffects: {
            sourceVector: "rolled" as const,
            page: 2,
            rowIndex: 61,
          },
        },
        notice: undefined,
      },
      {
        label: "rolled effects malformed notice",
        state: denseEquipment,
        location: {},
        notice:
          "This selection does not name an Item Effect on the bound equipment page and source page.",
      },
      {
        label: "rolled effects stale notice",
        state: denseEquipment,
        location: {},
        notice:
          "State changed; Item Effects were closed before resolving equipped gear.",
      },
    ] as const;

    const counts = new Map<string, number>();
    for (const candidate of cases) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "inventory",
        { revision: Number.MAX_SAFE_INTEGER, state: candidate.state },
        indexes,
        candidate.notice,
        candidate.location,
      ).toJSON();
      counts.set(candidate.label, countDiscordComponents(rendered));
      assertDiscordHeroCommunityRenderBounds(rendered);
      for (const content of collectTextDisplayContents(rendered)) {
        expect(content.length).toBeLessThanOrEqual(3_900);
      }
    }
    expect(counts.get("selected Inventory stale notice")).toBeLessThanOrEqual(
      40,
    );
    expect(counts.get("rolled effects current detail")).toBeGreaterThan(30);
  });

  test("makes all 620 rolls on the 26th equipped item reachable within Discord bounds", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = stateWithTwentySixEquippedItems(indexes);
    const exactRoll = "#105401 · IncreaseAreaOfEffectDamage · ADDITIVE · 100";
    let reachableRolls = 0;

    for (let rollPage = 0; rollPage < 25; rollPage += 1) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "inventory",
        { revision: Number.MAX_SAFE_INTEGER, state },
        indexes,
        undefined,
        {
          equipmentPage: 1,
          equipmentSelection: { heroKey: 301, gearType: "BOOTS" },
          freeInventoryPage: 0,
          rollPage,
        },
      ).toJSON();
      const textContent = collectTextDisplayContents(rendered).join("\n");
      const pageRolls = textContent.split(exactRoll).length - 1;

      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      expect(pageRolls).toBe(rollPage === 24 ? 20 : 25);
      expect(textContent).toContain(`Rolled stats · Page ${rollPage + 1}/25`);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
      reachableRolls += pageRolls;
    }

    expect(reachableRolls).toBe(620);
  });

  test("makes all 620 rolls on selected Inventory gear reachable within Discord bounds", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.containers.inventory.slots.push({
      index: 4,
      asset: {
        kind: "gear",
        instanceId: "inventory-max-rolls",
        itemKey: 300001,
        rolledStats: Array.from({ length: 620 }, () => ({
          statModKey: 105401,
          value: 100,
        })),
      },
    });
    validatePlayerAgainstCatalog(state, indexes);
    const exactRoll = "#105401 · IncreaseAreaOfEffectDamage · ADDITIVE · 100";
    let reachableRolls = 0;

    for (let rollPage = 0; rollPage < 25; rollPage += 1) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "inventory",
        { revision: Number.MAX_SAFE_INTEGER, state },
        indexes,
        undefined,
        { inventoryPage: 0, inventorySlotIndex: 4, rollPage },
      ).toJSON();
      const textContent = collectTextDisplayContents(rendered).join("\n");
      const pageRolls = textContent.split(exactRoll).length - 1;

      expect(pageRolls).toBe(rollPage === 24 ? 20 : 25);
      expect(textContent).toContain(`Rolled stats · Page ${rollPage + 1}/25`);
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
      reachableRolls += pageRolls;
    }

    expect(reachableRolls).toBe(620);
  });

  test("renders all six Heroes and exact selected source detail without a purchase mutation", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 15,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    snapshot.state.gold = 500;
    const rendered = renderDiscordHeroWorkspace(
      "123",
      "heroes",
      snapshot,
      indexes,
      undefined,
      { heroKey: 401 },
    ).toJSON();
    const json = JSON.stringify(rendered);
    const ids = collectCustomIds(rendered).map(decodeDiscordHeroCustomId);

    expect(ids[0]).toEqual({
      ownerId: "123",
      view: "heroes",
      action: "select",
      revision: 15,
    });
    expect(json).toContain("Inspect one of 6 source heroes");
    expect(json).toContain("**Priest** · #401 · Priest · purchasable");
    expect(json).toContain("Gear: SCEPTER + TOME · Unlock cost: 500g");
    expect(json).toContain("Base skill: 40001");
    expect(json).toContain(
      "Active skills: 40101, 40201, 40301, 40401, 40501, 40601",
    );
    expect(json).toContain("Attribute tree: 22 exact nodes");
    expect(json).toContain(
      "Base + allocated Attributes [Base, Attribute] · uncapped and unrounded raw source units: Unowned",
    );
    expect(json).toContain("post-purchase save fixture");
    expect(json).not.toContain('"action":"unlock"');
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
  });

  test("renders all six selected Heroes with exact base-only canonical combat units and display rounding", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 16,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const expectedLines = [
      [
        101,
        "Base-only canonical combat units: attackDamage 2 · attackSpeedPerSecond 0.9 · castSpeedMultiplier 1 · criticalChanceRatio 0.025 · criticalDamageMultiplier 1.4 · baseAttackDps exact 1.818 · baseAttackDpsDisplay2dp 1.82",
      ],
      [
        201,
        "Base-only canonical combat units: attackDamage 1 · attackSpeedPerSecond 1 · castSpeedMultiplier 1 · criticalChanceRatio 0.04 · criticalDamageMultiplier 1.5 · baseAttackDps exact 1.02 · baseAttackDpsDisplay2dp 1.02",
      ],
      [
        301,
        "Base-only canonical combat units: attackDamage 2 · attackSpeedPerSecond 0.55 · castSpeedMultiplier 1 · criticalChanceRatio 0.05 · criticalDamageMultiplier 1.65 · baseAttackDps exact 1.13575 · baseAttackDpsDisplay2dp 1.14",
      ],
      [
        401,
        "Base-only canonical combat units: attackDamage 1 · attackSpeedPerSecond 0.9 · castSpeedMultiplier 1 · criticalChanceRatio 0.02 · criticalDamageMultiplier 1.4 · baseAttackDps exact 0.9072 · baseAttackDpsDisplay2dp 0.91",
      ],
      [
        501,
        "Base-only canonical combat units: attackDamage 2 · attackSpeedPerSecond 0.7 · castSpeedMultiplier 1 · criticalChanceRatio 0.045 · criticalDamageMultiplier 1.55 · baseAttackDps exact 1.43465 · baseAttackDpsDisplay2dp 1.43",
      ],
      [
        601,
        "Base-only canonical combat units: attackDamage 2 · attackSpeedPerSecond 0.7 · castSpeedMultiplier 1 · criticalChanceRatio 0.025 · criticalDamageMultiplier 1.8 · baseAttackDps exact 1.428 · baseAttackDpsDisplay2dp 1.43",
      ],
    ] as const;

    for (const [heroKey, expectedLine] of expectedLines) {
      const rendered = renderDiscordHeroWorkspace(
        "123",
        "heroes",
        snapshot,
        indexes,
        undefined,
        { heroKey },
      ).toJSON();
      const lines = collectTextDisplayContents(rendered).join("\n").split("\n");

      expect(lines, `Hero ${heroKey}`).toContain(expectedLine);
      expect(
        lines.some((line) =>
          line.startsWith(
            "Base + allocated Attributes [Base, Attribute] · uncapped and unrounded raw source units:",
          ),
        ),
        `Hero ${heroKey}`,
      ).toBe(true);
      expect(lines, `Hero ${heroKey}`).toContain(
        "Base-only units are source-proven; the raw Attribute preview remains separate. Level, caps, equipment, pet, rune, passive, status, buff, account, environment, and campaign contributions remain oracle-gated.",
      );
      expect(lines.join("\n").toLowerCase()).not.toContain(
        "final combat total",
      );
      expect(lines.join("\n").toLowerCase()).not.toContain("combat outcome");
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
    }
  });

  test("renders an owned Hero raw stat preview without mutating state or revision", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.level = 2;
    state.heroes[0]!.attributes = [{ key: 101001, level: 2 }];
    const snapshot = { revision: 16, state };
    const before = structuredClone(snapshot);

    const rendered = renderDiscordHeroWorkspace(
      "123",
      "heroes",
      snapshot,
      indexes,
      undefined,
      { heroKey: 101 },
    ).toJSON();
    const content = collectTextDisplayContents(rendered).join("\n");

    expect(content).toContain(
      "Base + allocated Attributes [Base, Attribute] · uncapped and unrounded raw source units: Armor 45 · AttackDamage 4 · AttackSpeed 90 · CastSpeed 100 · CooldownReduction 0 · CriticalChance 25 · CriticalDamage 1400 · MaxHp 130 · MovementSpeed 950",
    );
    expect(content).toContain(
      "Base-only units are source-proven; the raw Attribute preview remains separate. Level, caps, equipment, pet, rune, passive, status, buff, account, environment, and campaign contributions remain oracle-gated.",
    );
    expect(snapshot).toEqual(before);
    expect(snapshot.revision).toBe(16);
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(rendered);
  });

  test("fails before rendering selected-Hero text for an invalid Attribute gate", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.attributes = [{ key: 101032, level: 1 }];
    const before = structuredClone(state);

    expect(() =>
      renderDiscordHeroWorkspace(
        "123",
        "heroes",
        { revision: 17, state },
        indexes,
        undefined,
        { heroKey: 401 },
      ),
    ).toThrow("requires 30 points spent in lower Attribute groups");
    expect(state).toEqual(before);
  });

  test("makes every exact Attribute node and all eight groups reachable through selected-Hero tabs", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.level = 2;
    state.heroes[0]!.attributes.push({ key: 101001, level: 2 });
    state.heroes[0]!.passives.push({ key: 101001, level: 3 });
    validatePlayerAgainstCatalog(state, indexes);
    const snapshot = {
      revision: Number.MAX_SAFE_INTEGER,
      state,
    };
    const trees = projectDiscordHeroAttributeTrees(indexes, state);
    let reachableNodes = 0;

    for (const tree of trees) {
      const page = discordHeroAttributePage(
        indexes,
        state,
        encodeDiscordHeroAttributePage(indexes, tree.HeroKey, 0),
      );
      expect(page.options).toHaveLength(22);
      for (const option of page.options) {
        const detail = readDiscordHeroAttributeDetail(
          indexes,
          state,
          option.target,
        );
        const rendered = renderDiscordHeroWorkspace(
          "12345678901234567890",
          "heroes",
          snapshot,
          indexes,
          undefined,
          {
            heroKey: tree.HeroKey,
            heroTab: "attributes",
            attributePageTarget: page.pageTarget,
            attributeTarget: option.target,
          },
        ).toJSON();
        const textSections = collectTextDisplayContents(rendered);
        const content = textSections.join("\n");
        const exactContent = textSections.join("");
        const attributeMenu = collectSelectMenus(rendered).find(
          (menu) =>
            decodeDiscordHeroCustomId(menu.customId).value === page.pageTarget,
        );

        expect(attributeMenu?.options).toHaveLength(22);
        expect(content).toContain(
          `Attribute #${detail.AttributeKey} · Group #${detail.GroupKey}`,
        );
        expect(content).toContain(
          `Allocated level: ${
            detail.allocatedLevel === null
              ? "unavailable"
              : `${detail.allocatedLevel} / ${detail.MaxLevel}`
          }`,
        );
        expect(content).toContain("Allocated effect source: Attribute");
        if (detail.effect.effect.kind === "passive-stat") {
          expect(content).toContain(
            `Allocated passive effect: #${detail.effect.effect.passiveSkillKey} · ${detail.effect.effect.statType} · ${detail.effect.effect.modifierType} · raw ${detail.effect.effect.rawValue}/level · raw total ${detail.effect.effect.rawTotal ?? "unavailable"}`,
          );
        } else {
          expect(content).toContain(
            `Allocated active effect: Skill #${detail.effect.effect.skillKey}`,
          );
        }
        expect(exactContent).toContain(JSON.stringify(detail.relation.source));
        for (const group of tree.groups) {
          expect(content).toContain(
            `Group #${group.AttributeGroupKey} · Requires ${group.RequiredAllocatedPoint} · ${group.nodes.length} nodes`,
          );
        }
        expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
        assertDiscordComponentBounds(rendered);
        const customIds = collectCustomIds(rendered);
        expect(new Set(customIds).size).toBe(customIds.length);
        reachableNodes += 1;
      }
    }

    expect(trees).toHaveLength(6);
    expect(reachableNodes).toBe(132);
  });

  test("renders exact Attribute point budget, source gate, outcome reason, and bound +1 control", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const cases = [
      {
        name: "available",
        state: createFreshPlayerStateFromCatalog(indexes, 101),
        heroKey: 101,
        attributeKey: 101001,
        expected: [
          "Allocated level: 0 / 3",
          "Allocated effect source: Attribute",
          "Allocated passive effect: #101001 · AttackDamage · FLAT · raw 1/level · raw total 0 · flat internal units",
          "Point budget: 0/1 spent · 1 remaining",
          "Required +1: 1 point · Group threshold 0",
          "Allocation status: Available +1",
        ],
        enabled: true,
      },
      {
        name: "group locked",
        state: (() => {
          const state = createFreshPlayerStateFromCatalog(indexes, 101);
          state.heroes[0]!.level = 10;
          state.heroes[0]!.attributes = [{ key: 101001, level: 1 }];
          return validatePlayerAgainstCatalog(state, indexes);
        })(),
        heroKey: 101,
        attributeKey: 101011,
        expected: [
          "Allocated level: 0 / 8",
          "Point budget: 1/10 spent · 9 remaining",
          "Required +1: 1 point · Group threshold 10",
          "Allocation status: Group locked · spend 9 more points",
        ],
        enabled: false,
      },
      {
        name: "insufficient",
        state: (() => {
          const state = createFreshPlayerStateFromCatalog(indexes, 101);
          state.heroes[0]!.level = 10;
          state.heroes[0]!.attributes = [
            { key: 101001, level: 3 },
            { key: 101002, level: 7 },
          ];
          return validatePlayerAgainstCatalog(state, indexes);
        })(),
        heroKey: 101,
        attributeKey: 101011,
        expected: [
          "Point budget: 10/10 spent · 0 remaining",
          "Allocation status: Insufficient points · need 1, have 0",
        ],
        enabled: false,
      },
      {
        name: "maximum",
        state: (() => {
          const state = createFreshPlayerStateFromCatalog(indexes, 101);
          state.heroes[0]!.level = 3;
          state.heroes[0]!.attributes = [{ key: 101001, level: 3 }];
          return validatePlayerAgainstCatalog(state, indexes);
        })(),
        heroKey: 101,
        attributeKey: 101001,
        expected: [
          "Allocated level: 3 / 3",
          "Allocated passive effect: #101001 · AttackDamage · FLAT · raw 1/level · raw total 3 · flat internal units",
          "Allocation status: Source maximum reached",
        ],
        enabled: false,
      },
      {
        name: "unowned",
        state: createFreshPlayerStateFromCatalog(indexes, 101),
        heroKey: 401,
        attributeKey: 401001,
        expected: [
          "Allocated level: unavailable",
          "Allocated effect source: Attribute",
          "Allocated passive effect: #401001 · AttackDamage · FLAT · raw 1/level · raw total unavailable · flat internal units",
          "Point budget: unavailable · Hero not owned",
          "Allocation status: Hero not owned",
        ],
        enabled: false,
        noButton: true,
      },
    ] as const;

    for (const candidate of cases) {
      const pageTarget = encodeDiscordHeroAttributePage(
        indexes,
        candidate.heroKey,
        0,
      );
      const attributeTarget = encodeDiscordHeroAttributeTarget(
        indexes,
        candidate.heroKey,
        0,
        candidate.attributeKey,
      );
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "heroes",
        { revision: 17, state: candidate.state },
        indexes,
        undefined,
        {
          heroKey: candidate.heroKey,
          heroTab: "attributes",
          attributePageTarget: pageTarget,
          attributeTarget,
        },
      ).toJSON();
      const content = collectTextDisplayContents(rendered).join("");
      for (const expected of candidate.expected) {
        expect(content, candidate.name).toContain(expected);
      }
      const allocationIds = collectCustomIds(rendered)
        .map(decodeDiscordHeroCustomId)
        .filter((customId) => customId.action === "upgrade");
      if ("noButton" in candidate && candidate.noButton) {
        expect(allocationIds, candidate.name).toEqual([]);
      } else {
        expect(allocationIds, candidate.name).toEqual([
          {
            ownerId: "12345678901234567890",
            view: "heroes",
            action: "upgrade",
            revision: 17,
            value: attributeTarget,
          },
        ]);
      }
      const serialized = JSON.stringify(rendered);
      expect(
        serialized.includes('"label":"Allocate +1 · 1 point"'),
        candidate.name,
      ).toBe(!("noButton" in candidate && candidate.noButton));
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const ids = collectCustomIds(rendered);
      expect(new Set(ids).size, candidate.name).toBe(ids.length);
    }
  });

  test("renders exact active rows and additive factors from Attribute allocation", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const activeState = createFreshPlayerStateFromCatalog(indexes, 101);
    activeState.heroes[0]!.level = 2;
    activeState.heroes[0]!.attributes = [{ key: 101003, level: 2 }];
    activeState.heroes[0]!.skills = [{ key: 10101, level: 5 }];
    const additiveState = createFreshPlayerStateFromCatalog(indexes, 101);
    additiveState.heroes[0]!.level = 33;
    additiveState.heroes[0]!.attributes = [
      { key: 101001, level: 3 },
      { key: 101002, level: 8 },
      { key: 101003, level: 5 },
      { key: 101004, level: 5 },
      { key: 101011, level: 8 },
      { key: 101012, level: 1 },
      { key: 101032, level: 3 },
    ];

    const fixtures = [
      {
        name: "active exact level row ignores mirror level",
        state: activeState,
        attributeKey: 101003,
        expected:
          "Allocated active effect: Skill #10101 · exact source row SkillLevelKey 10101 · Level 2 · Value 2700",
      },
      {
        name: "additive raw units and normalized factor",
        state: additiveState,
        attributeKey: 101032,
        expected:
          "Allocated passive effect: #101032 · MaxHp · ADDITIVE · raw 50/level · raw total 150 · additive factor 0.15",
      },
    ] as const;

    for (const fixture of fixtures) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "heroes",
        { revision: 23, state: fixture.state },
        indexes,
        undefined,
        {
          heroKey: 101,
          heroTab: "attributes",
          attributePageTarget: encodeDiscordHeroAttributePage(indexes, 101, 0),
          attributeTarget: encodeDiscordHeroAttributeTarget(
            indexes,
            101,
            0,
            fixture.attributeKey,
          ),
        },
      ).toJSON();
      const content = collectTextDisplayContents(rendered).join("");

      expect(content, fixture.name).toContain(
        "Allocated effect source: Attribute",
      );
      expect(content, fixture.name).toContain(fixture.expected);
      assertDiscordComponentBounds(rendered);
    }
  });

  test("renders all eight Cube operation gates in exact source order", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 11,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const rendered = renderDiscordHeroWorkspace(
      "123",
      "cube",
      snapshot,
      indexes,
    ).toJSON();
    const customIds = collectCustomIds(rendered).filter(
      (customId) =>
        decodeDiscordHeroCustomId(customId).view === "cube" &&
        decodeDiscordHeroCustomId(customId).action === "unlock",
    );

    expect(customIds.map(decodeDiscordHeroCustomId)).toEqual(
      [100001, 200001, 600001, 300001, 400001, 500001, 900001, 700001].map(
        (cubeKey) => ({
          ownerId: "123",
          view: "cube",
          action: "unlock",
          revision: 11,
          value: `b-${cubeKey}`,
        }),
      ),
    );
    const json = JSON.stringify(rendered);
    expect(json).toContain("Synthesis · OPEN");
    expect(json).toContain("Alchemy · 10g");
    expect(json).toContain("Crafting · Lv5");
    expect(json).toContain("Decoration · Lv8");
    expect(json).toContain("Extraction · Lv10");
    expect(json).toContain("Offering · Lv20");
  });

  test("makes all 8 main and 31 grouped Cube rows reachable through canonical Browse targets", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    const snapshot = {
      revision: Number.MAX_SAFE_INTEGER,
      state,
    };
    const mains = discordHeroCubeMainRecipeOptions(indexes, state, 0);
    const mainPageTarget = encodeDiscordHeroCubePage({
      kind: "main-recipes",
      page: 0,
    });
    let reachableRows = 0;

    const defaultBoard = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "cube",
      snapshot,
      indexes,
      undefined,
      { cubeTab: "browse", cubePageTarget: mainPageTarget },
    ).toJSON();
    const defaultMainMenu = collectSelectMenus(defaultBoard).find(
      (menu) =>
        decodeDiscordHeroCustomId(menu.customId).value === mainPageTarget,
    );
    expect(defaultMainMenu?.options.map((option) => option.value)).toEqual(
      mains.map((main) => main.value),
    );

    for (const main of mains) {
      const subPageTarget = encodeDiscordHeroCubePage({
        kind: "sub-recipes",
        cubeKey: main.detail.cubeKey,
        page: 0,
      });
      const mainBoard = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "cube",
        snapshot,
        indexes,
        undefined,
        {
          cubeTab: "browse",
          cubePageTarget: subPageTarget,
          cubeTarget: main.value,
        },
      ).toJSON();
      const mainText = collectTextDisplayContents(mainBoard).join("\n");
      expect(mainText).toContain(
        `Main #${main.detail.cubeKey} · ${main.detail.recipeType} · Index ${main.detail.index}`,
      );
      expect(mainText).toContain(JSON.stringify(main.detail.description));
      const subRecipes = discordHeroCubeSubRecipeOptions(
        indexes,
        state,
        main.detail.cubeKey,
        0,
      );
      const subMenu = collectSelectMenus(mainBoard).find(
        (menu) =>
          decodeDiscordHeroCustomId(menu.customId).value === subPageTarget,
      );
      expect(subMenu?.options.map((option) => option.value)).toEqual(
        subRecipes.map((subRecipe) => subRecipe.value),
      );
      expect(countDiscordComponents(mainBoard)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(mainBoard);
      reachableRows += 1;

      for (const subRecipe of subRecipes) {
        const subBoard = renderDiscordHeroWorkspace(
          "12345678901234567890",
          "cube",
          snapshot,
          indexes,
          undefined,
          {
            cubeTab: "browse",
            cubePageTarget: subPageTarget,
            cubeTarget: subRecipe.value,
          },
        ).toJSON();
        const subText = collectTextDisplayContents(subBoard).join("\n");
        expect(subText).toContain(
          `Sub #${subRecipe.detail.cubeSubRecipeKey} · ${subRecipe.detail.name}`,
        );
        expect(subText).toContain(
          `Main #${subRecipe.detail.cubeKey} · ${subRecipe.detail.recipeType}`,
        );
        expect(subText).not.toContain("executable");
        expect(countDiscordComponents(subBoard)).toBeLessThanOrEqual(40);
        assertDiscordComponentBounds(subBoard);
        const customIds = collectCustomIds(subBoard);
        expect(new Set(customIds).size).toBe(customIds.length);
        reachableRows += 1;
      }
    }

    expect(reachableRows).toBe(39);
  });

  test("renders all 197 Runes in eight Discord-bounded source pages", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 12,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const first = renderDiscordHeroWorkspace(
      "123",
      "runes",
      snapshot,
      indexes,
      undefined,
      { runePage: 0 },
    ).toJSON();
    const last = renderDiscordHeroWorkspace(
      "123",
      "runes",
      snapshot,
      indexes,
      undefined,
      { runePage: 7 },
    ).toJSON();
    const firstJson = JSON.stringify(first);
    const lastJson = JSON.stringify(last);
    const firstIds = collectCustomIds(first).map(decodeDiscordHeroCustomId);
    const lastIds = collectCustomIds(last).map(decodeDiscordHeroCustomId);

    expect(firstIds.slice(0, 5)).toEqual([
      {
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: "t-r-0",
      },
      {
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: "t-s-0",
      },
      {
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: "r-0",
      },
      {
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: "r-1",
      },
      {
        ownerId: "123",
        view: "runes",
        action: "upgrade",
        revision: 12,
        value: "r-0",
      },
    ]);
    expect(lastIds[4]).toEqual({
      ownerId: "123",
      view: "runes",
      action: "upgrade",
      revision: 12,
      value: "r-7",
    });
    expect(firstJson.match(/"type":3/g) ?? []).toHaveLength(1);
    expect((firstJson.match(/"value":"/g) ?? []).length).toBeGreaterThanOrEqual(
      25,
    );
    expect(firstJson).toContain("Upgrade a Rune · page 1/8");
    expect(lastJson).toContain("Upgrade a Rune · page 8/8");
    expect(countDiscordComponents(first)).toBeLessThanOrEqual(40);
    expect(countDiscordComponents(last)).toBeLessThanOrEqual(40);

    const browsedRuneKeys = Array.from({ length: 8 }, (_, runePage) => {
      const page = renderDiscordHeroWorkspace(
        "123",
        "runes",
        snapshot,
        indexes,
        undefined,
        { runePage },
      ).toJSON();
      const menu = collectSelectMenus(page).find(
        (candidate) =>
          decodeDiscordHeroCustomId(candidate.customId).action === "upgrade",
      );
      expect(menu).toBeDefined();
      assertDiscordComponentBounds(page);
      return menu!.options.map((option) => Number(option.value));
    }).flat();
    expect(browsedRuneKeys).toHaveLength(197);
    expect(new Set(browsedRuneKeys).size).toBe(197);

    const gatedState = createFreshPlayerStateFromCatalog(indexes, 101);
    gatedState.gold = 1_000;
    gatedState.runes = [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
    ];
    const gated = renderDiscordHeroWorkspace(
      "123",
      "runes",
      { revision: 13, state: gatedState },
      indexes,
      undefined,
      { runePage: 2 },
    ).toJSON();
    const gatedMenu = collectSelectMenus(gated).find(
      (candidate) =>
        decodeDiscordHeroCustomId(candidate.customId).action === "upgrade",
    );
    // The arrangement Rune is purchasable; the Skill-slot Rune is not.
    const command = gatedMenu?.options.find((option) => option.value === "21");
    expect(command?.description).toContain("1,000g");
    expect(command?.description).not.toContain("oracle-gated");

    const awakeningState = createFreshPlayerStateFromCatalog(indexes, 101);
    awakeningState.gold = 50_000;
    awakeningState.runes = [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 25, level: 1 },
      { key: 26, level: 1 },
      { key: 21, level: 1 },
    ];
    const awakening = Array.from({ length: 8 }, (_, runePage) => {
      const page = renderDiscordHeroWorkspace(
        "123",
        "runes",
        { revision: 13, state: awakeningState },
        indexes,
        undefined,
        { runePage },
      ).toJSON();
      return collectSelectMenus(page)
        .filter(
          (candidate) =>
            decodeDiscordHeroCustomId(candidate.customId).action === "upgrade",
        )
        .flatMap((menu) => menu.options)
        .find((option) => option.value === "27");
    }).find((option) => option !== undefined);
    expect(awakening?.description).toContain(
      "UnlockSkillSlotCount · oracle-gated",
    );
    expect(collectTextDisplayContents(gated).join("\n")).toContain(
      "Only source effects consumed by reachable Alchemy gameplay can upgrade.",
    );
  });

  test("rejects a catalog-invalid Rune snapshot before rendering UI", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.heroes[0]!.heroKey = 999999;

    expect(() =>
      renderDiscordHeroWorkspace(
        "123",
        "runes",
        { revision: 12, state },
        indexes,
        undefined,
        { runePage: 0 },
      ),
    ).toThrow("heroes[0].heroKey references unknown heroes key 999999");
  });

  test("renders every Skill page and exact row-index detail without losing source identity", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: Number.MAX_SAFE_INTEGER,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const pageSizes: number[] = [];

    for (let skillPage = 0; skillPage < 5; skillPage += 1) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "runes",
        snapshot,
        indexes,
        undefined,
        { runeTab: "skills", skillPage } as never,
      ).toJSON();
      const menu = collectSelectMenus(rendered).find(
        (candidate) =>
          decodeDiscordHeroCustomId(candidate.customId).value ===
          encodeDiscordHeroSkillPage(skillPage),
      );
      expect(menu).toBeDefined();
      pageSizes.push(menu!.options.length);
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
    }

    expect(pageSizes).toEqual([25, 25, 25, 25, 6]);

    const trailingKey = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "runes",
      snapshot,
      indexes,
      undefined,
      {
        runeTab: "skills",
        skillPage: 2,
        skillRowIndex: 68,
      } as never,
    ).toJSON();
    const trailingText = collectTextDisplayContents(trailingKey).join("\n");
    expect(trailingText).toContain('Source key: "200111 "');
    expect(trailingText).toContain('Order: "999 "');
    expect(trailingText).toContain('Value: "1000 "');
    expect(trailingText).toContain("Levels: —");
    expect(trailingText).toContain("Hero links: —");

    const heroSkill = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "runes",
      snapshot,
      indexes,
      undefined,
      {
        runeTab: "skills",
        skillPage: 0,
        skillRowIndex: 1,
      } as never,
    ).toJSON();
    const heroText = collectTextDisplayContents(heroSkill).join("\n");
    expect(heroText).toContain("Piercing Thrust");
    expect(heroText).toContain("Levels: Lv1=2500");
    expect(heroText).toContain("Lv10=4300");
    expect(heroText).toContain("Hero links: #101");
    expect(JSON.stringify(heroSkill)).toContain(
      encodeDiscordHeroSkillTarget(1),
    );
  });

  test("renders bounded Pets, Skins, and captured Achievements with exact read-only detail", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const achievements = await loadDiscordHeroCommunityAchievements();
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.pets.unlocked = [1001];
    state.pets.active = 1001;
    const snapshot = { revision: Number.MAX_SAFE_INTEGER, state };
    const cases = [
      {
        location: {
          collectionTab: "pets",
          collectionPage: 0,
          collectionKey: 1001,
        },
        pageTarget: encodeDiscordHeroCollectionPage("pets", 0),
        optionCount: 8,
        exactText: [
          "**Bat** · #1001 · Owned · Active",
          "KillMonster · 10031 · 5000",
          "DropChanceNormalChestPercent · FLAT · 100",
          "IncreaseExpAmount · FLAT · 150",
        ],
      },
      {
        location: {
          collectionTab: "skins",
          collectionPage: 3,
          collectionKey: 25003,
        },
        pageTarget: encodeDiscordHeroCollectionPage("skins", 3),
        optionCount: 25,
        exactText: [
          "Skin #25003 · Locked",
          "Clothing · Accessory2 · Cost 80",
          "Default unlocked: false",
          "Sprites/Icon/PcSkin/Accessory2_25003",
        ],
      },
      {
        location: {
          collectionTab: "achievements",
          achievementPage: 2,
          achievementRowIndex: 53,
        },
        pageTarget: encodeDiscordHeroAchievementPage(achievements, 2),
        optionCount: 6,
        exactText: [
          "...Wait, I'm the Only One Left?",
          "5.4%",
          "Clear Normal 3-10 act boss with 2 party members dead in a 3-player party.",
          "Captured: 2026-07-28T14:15:14Z",
          "https://taskbarhero.wiki/achievements",
        ],
      },
    ] as const;

    for (const candidate of cases) {
      const rendered = renderDiscordHeroWorkspace(
        "12345678901234567890",
        "collection",
        snapshot,
        indexes,
        undefined,
        candidate.location as never,
        achievements,
      ).toJSON();
      const menu = collectSelectMenus(rendered).find(
        (entry) =>
          decodeDiscordHeroCustomId(entry.customId).value ===
          candidate.pageTarget,
      );
      expect(menu?.options).toHaveLength(candidate.optionCount);
      const renderedText = collectTextDisplayContents(rendered).join("\n");
      for (const exactText of candidate.exactText) {
        expect(renderedText).toContain(exactText);
      }
      if ("achievementRowIndex" in candidate.location) {
        expect(menu?.options).toContainEqual(
          expect.objectContaining({
            value: encodeDiscordHeroAchievementTarget(
              achievements,
              candidate.location.achievementRowIndex,
            ),
          }),
        );
      }
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
    }
  });

  test("keeps all Cube unlock controls while exposing bounded page-bound Alchemy selection", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const state = createFreshPlayerStateFromCatalog(indexes, 101);
    state.cube.unlockedRecipes.push(200001);
    state.cube.unlockedSubRecipes.push(200011);
    state.containers.inventory.unlockedSlots = 30;
    state.containers.inventory.slots.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        index,
        asset: {
          kind: "gear" as const,
          instanceId: `alchemy-ui-${index}`,
          itemKey: 300001,
          rolledStats: [],
        },
      })),
    );
    const rendered = renderDiscordHeroWorkspace(
      "12345678901234567890",
      "cube",
      { revision: Number.MAX_SAFE_INTEGER, state },
      indexes,
      undefined,
      { cubeTab: "alchemy", alchemyPage: 0 },
    ).toJSON();
    const decoded = collectCustomIds(rendered).map(decodeDiscordHeroCustomId);
    const alchemyMenu = collectSelectMenus(rendered).find(
      (menu) => decodeDiscordHeroCustomId(menu.customId).action === "alchemy",
    );

    expect(
      decoded.filter(
        (customId) => customId.view === "cube" && customId.action === "unlock",
      ),
    ).toHaveLength(8);
    expect(
      decoded
        .filter(
          (customId) =>
            customId.view === "cube" && customId.action === "unlock",
        )
        .every((customId) => customId.value?.startsWith("a-")),
    ).toBe(true);
    expect(alchemyMenu?.options).toHaveLength(25);
    expect(alchemyMenu?.options[0]).toEqual(
      expect.objectContaining({
        value: "0",
        label: "Slot 0 · Long Sword",
        description: "GEAR · SWORD · Lv1 · COMMON",
      }),
    );
    expect(alchemyMenu?.minValues).toBe(1);
    expect(alchemyMenu?.maxValues).toBe(9);
    expect(JSON.stringify(rendered)).toContain("Alchemy · Page 1/2");
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    assertDiscordComponentBounds(rendered);
    const customIds = collectCustomIds(rendered);
    expect(new Set(customIds).size).toBe(customIds.length);
  });

  test("renders all 120 stages and exact encounter metadata in five bounded pages", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const selected = renderDiscordHeroWorkspace(
      "123",
      "world",
      snapshot,
      indexes,
      undefined,
      { worldPage: 0, stageKey: 1101 },
    ).toJSON();
    const last = renderDiscordHeroWorkspace(
      "123",
      "world",
      snapshot,
      indexes,
      undefined,
      { worldPage: 4 },
    ).toJSON();
    const actBoss = renderDiscordHeroWorkspace(
      "123",
      "world",
      snapshot,
      indexes,
      undefined,
      { worldPage: 0, stageKey: 1110 },
    ).toJSON();
    const blocked = renderDiscordHeroWorkspace(
      "123",
      "world",
      snapshot,
      indexes,
      undefined,
      { worldPage: 1, stageKey: 1208 },
    ).toJSON();
    const selectedIds = collectCustomIds(selected).map(
      decodeDiscordHeroCustomId,
    );
    const selectedJson = JSON.stringify(selected);
    const lastJson = JSON.stringify(last);
    const actBossJson = JSON.stringify(actBoss);
    const blockedJson = JSON.stringify(blocked);

    expect(selectedIds.slice(0, 3)).toEqual([
      {
        ownerId: "123",
        view: "world",
        action: "page",
        revision: 14,
        value: "w-0",
      },
      {
        ownerId: "123",
        view: "world",
        action: "page",
        revision: 14,
        value: "w-1",
      },
      {
        ownerId: "123",
        view: "world",
        action: "select",
        revision: 14,
        value: "w-0",
      },
    ]);
    expect(selectedJson).toContain("**Pasture** · #1101 · Act 1-1 · NORMAL");
    expect(selectedJson).toContain("10 waves × 1");
    expect(selectedJson).toContain("10011 (1000), 10021 (1000)");
    expect(selectedJson).toContain("Monster drop: 910011 @ 160/1000");
    expect(selectedJson).toContain("Boss: 10022");
    expect(selectedJson).toContain("First-clear table: 9200010");
    expect(actBossJson).toContain("Monster drop: —");
    expect(blockedJson).toContain("Monster drop: 910201 @ 20/1000");
    expect(blockedJson).toContain("Source blocker: missing monster 20101");
    expect(lastJson).toContain("Inspect a stage · page 5/5");
    expect(countDiscordComponents(selected)).toBeLessThanOrEqual(40);
    expect(countDiscordComponents(last)).toBeLessThanOrEqual(40);
  });

  test("renders source-scaled monster base stats in the existing bounded stage detail", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const renderStage = (
      stageKey: number,
      sourceIndexes: typeof indexes = indexes,
    ) => {
      const stageIndex = sourceIndexes.tables.stages.rows.findIndex(
        (stage) => stage.StageKey === stageKey,
      );
      if (stageIndex < 0) throw new Error(`missing stage fixture ${stageKey}`);
      return renderDiscordHeroWorkspace(
        "123",
        "world",
        snapshot,
        sourceIndexes,
        undefined,
        { worldPage: Math.floor(stageIndex / 25), stageKey },
      ).toJSON();
    };

    const pasture = renderStage(1101);
    const pastureText = collectTextDisplayContents(pasture).join("\n");
    expect(pastureText).toContain("### Source-scaled monster base stats");
    expect(pastureText).toContain(
      "Catalog projection only; no combat or rewards were applied.",
    );
    expect(pastureText).toContain(
      "Wave #10011 · Weight raw 1000 · HP 5 · ATK 1 · Source Gold 1 · Source EXP 1 · ASPD raw 40 · Move raw 110",
    );
    expect(pastureText).toContain(
      "Wave #10021 · Weight raw 1000 · HP 4 · ATK 2 · Source Gold 1 · Source EXP 1 · ASPD raw 50 · Move raw 170",
    );
    expect(pastureText).toContain(
      "Boss #10022 · HP 12 · ATK 2 · Source Gold 4 · Source EXP 6 · ASPD raw 110 · Move raw 280 · Boss scale raw 3",
    );
    expect(pastureText).toContain(
      'Kit source preview · raw · elem ["Physical"]',
    );
    expect(pastureText).toContain(
      'Atk 1 [primary] · skill 100111 [resolved-exact] · activ BASEATTACK · dmg Physical · deliv "" · range 200 · val 1000 · snd "11001111"',
    );
    expect(pastureText).toContain("### Source reward references");
    expect(pastureText).toContain(
      "Monster item: Normal Monster Box 1 (#910011, COMMON STAGEBOX) · source chance 160/1000",
    );
    expect(pastureText).toContain(
      "Boss item: Stage Boss Box 4 (#920011, RARE STAGEBOX) · source chance 1000/1000",
    );
    expect(pastureText).toContain("First-clear source table #9200010:");
    const pastureFirstClearRows = [
      "SelectOneByClass · hero #101 · weight raw 10000 · ITEM #920001 -> Stage Boss Box 1 (#920001, RARE STAGEBOX)",
      "SelectOneByClass · hero #201 · weight raw 10000 · ITEM #920002 -> Stage Boss Box 2 (#920002, RARE STAGEBOX)",
      "SelectOneByClass · hero #301 · weight raw 10000 · ITEM #920003 -> Stage Boss Box 3 (#920003, RARE STAGEBOX)",
      "SelectOneByClass · hero #401 · weight raw 10000 · ITEM #920004 -> Stage Boss Box 3 (#920004, RARE STAGEBOX)",
      "SelectOneByClass · hero #501 · weight raw 10000 · ITEM #920005 -> Stage Boss Box 3 (#920005, RARE STAGEBOX)",
      "SelectOneByClass · hero #601 · weight raw 10000 · ITEM #920006 -> Stage Boss Box 3 (#920006, RARE STAGEBOX)",
    ];
    let priorFirstClearIndex = -1;
    for (const row of pastureFirstClearRows) {
      const rowIndex = pastureText.indexOf(row);
      expect(rowIndex).toBeGreaterThan(priorFirstClearIndex);
      priorFirstClearIndex = rowIndex;
    }
    expect(pastureText).toContain("Soulstone source ref: —");
    expect(pastureText).toContain(
      "Preview only: exact catalog refs/rates/weights. RNG, class selection, first-clear claim/replay, award timing, pity, and inventory mutation remain unproven.",
    );
    expect(pastureText.toLowerCase()).not.toContain("guaranteed");
    expect(pastureText.toLowerCase()).not.toContain("probability");
    expect(pastureText.toLowerCase()).not.toContain("awarded");

    const firstClearRows = indexes.tables.drops.groups.get(9200010);
    if (firstClearRows === undefined) {
      throw new Error("missing first-clear fixture 9200010");
    }
    const sentinelDropGroups = new Map(indexes.tables.drops.groups);
    sentinelDropGroups.set(9200010, [
      Object.freeze({
        ...firstClearRows[0]!,
        HeroKeyCondition: 0,
      }),
    ]);
    const sentinelIndexes = {
      ...indexes,
      tables: {
        ...indexes.tables,
        drops: {
          ...indexes.tables.drops,
          groups: sentinelDropGroups,
        },
      },
    } as typeof indexes;
    const sentinelText = collectTextDisplayContents(
      renderStage(1101, sentinelIndexes),
    ).join("\n");
    expect(sentinelText).toContain(
      "SelectOneByClass · hero — · weight raw 10000 · ITEM #920001",
    );
    expect(sentinelText).not.toContain("hero #0");

    const actBossText = collectTextDisplayContents(renderStage(1110)).join(
      "\n",
    );
    expect(actBossText).not.toContain("Wave #");
    expect(actBossText).toContain(
      "Boss #10901 · HP 1544 · ATK 24 · Source Gold 325 · Source EXP 133 · ASPD raw 115 · Move raw 110 · Boss scale raw —",
    );
    expect(actBossText).toContain("Monster item: —");
    expect(actBossText).toContain(
      "Boss item: Act Boss Box 1 (#930101, LEGENDARY STAGEBOX) · source chance unspecified",
    );
    expect(actBossText).toContain("First-clear source table: —");
    expect(actBossText).toContain(
      "Soulstone source ref: Soulstone - Normal (#190001, IMMORTAL MATERIAL) · amount raw 1",
    );

    const finalActBossText = collectTextDisplayContents(renderStage(4110)).join(
      "\n",
    );
    const finalActBossAttackSequence = [
      "Boss #10904 ·",
      'Kit source preview · raw · elem ["Physical"]',
      'Atk 1 [primary] · skill 109011 [resolved-exact] · activ BASEATTACK · dmg Physical · deliv "" · range 300 · val 1000 · snd "11090111"',
      'Atk 2 · skill 109021 [resolved-exact] · activ BASEATTACK_COUNT · dmg Physical · deliv "" · range 450 · val 1500 · snd "11090211"',
      'Atk 3 · skill 109031 [resolved-exact] · activ COOLDOWN · dmg Physical · deliv "" · range 700 · val 1500 · snd "11090311"',
      'Atk 4 · skill 109041 [resolved-exact] · activ COOLDOWN · dmg Physical · deliv "" · range 300 · val 1500 · snd "11090411"',
      'Atk 5 · skill 109051 [resolved-exact] · activ COOLDOWN · dmg Physical · deliv "" · range 700 · val 1500 · snd "11090511"',
    ];
    let finalActBossCursor = 0;
    for (const sourceFact of finalActBossAttackSequence) {
      const sourceFactIndex = finalActBossText.indexOf(
        sourceFact,
        finalActBossCursor,
      );
      expect(sourceFactIndex).toBeGreaterThanOrEqual(finalActBossCursor);
      finalActBossCursor = sourceFactIndex + sourceFact.length;
    }

    const blocked = renderStage(1208);
    const blockedText = collectTextDisplayContents(blocked).join("\n");
    const blockedRows = [
      "Wave #20061 ·",
      'Kit source preview · pinned-enrichment sha 6b8a37c69f49b4e6405489fa7afbbe64c81d6b071a179d20de5f5da447708950 · elem ["Physical"]',
      'Atk 1 [primary] · skill 200611 [unresolved-exact-source-ref] · activ BASEATTACK · dmg Physical · deliv "" · range 170 · val 1000 · snd "12006111"',
      "Wave #20062 ·",
      "Wave #20091 ·",
      "Wave #20101 · Weight raw 1000 · source monster row unresolved; base stats unavailable",
      "Kit source preview unavailable: unresolved monster #20101.",
      "Wave #20071 ·",
      "Boss #20061 ·",
      'Kit source preview · pinned-enrichment sha 6b8a37c69f49b4e6405489fa7afbbe64c81d6b071a179d20de5f5da447708950 · elem ["Physical"]',
      'Atk 1 [primary] · skill 200611 [unresolved-exact-source-ref] · activ BASEATTACK · dmg Physical · deliv "" · range 170 · val 1000 · snd "12006111"',
    ];
    let priorIndex = -1;
    for (const row of blockedRows) {
      const rowIndex = blockedText.indexOf(row, priorIndex + 1);
      expect(rowIndex).toBeGreaterThan(priorIndex);
      priorIndex = rowIndex;
    }
    expect(blockedText).toContain(
      "Attack cadence, target, cooldown start, buff/status, damage application, death, and RNG remain runtime-oracle-gated.",
    );
    expect(blockedText).toContain(
      "Source blocker: missing monster 20101; this encounter cannot start.",
    );
    expect(blockedText).toContain(
      "Monster item: Normal Monster Box Lv20 (#910201, COMMON STAGEBOX) · source chance 20/1000",
    );
    expect(blockedText).toContain(
      "Boss item: Stage Boss Box Lv20 (#920201, RARE STAGEBOX) · source chance 200/1000",
    );
    expect(blockedText).toContain("First-clear source table: —");
    expect(blockedText).toContain("Soulstone source ref: —");
    for (const sourceOnlyText of [actBossText, blockedText]) {
      const normalized = sourceOnlyText.toLowerCase();
      for (const forbidden of [
        "guaranteed",
        "probability",
        "awarded",
        "selected",
        "eligible",
      ]) {
        expect(normalized).not.toContain(forbidden);
      }
    }

    let maxTextLength = 0;
    const attackKitsByMonsterKey = new Map(
      projectDiscordHeroMonsterAttackKits(indexes).map((kit) => [
        kit.monsterKey,
        kit,
      ]),
    );
    for (const stage of indexes.tables.stages.rows) {
      const rendered = renderStage(stage.StageKey);
      const renderedText = collectTextDisplayContents(rendered).join("\n");
      const resolvedMonsterRows = projectDiscordHeroStageMonsterSourceRows(
        indexes,
        stage.StageKey,
      ).filter((row) => row.status === "resolved");
      const expectedAttackCount = resolvedMonsterRows.reduce(
        (total, row) =>
          total +
          (attackKitsByMonsterKey.get(row.monsterKey)?.attacks.length ?? 0),
        0,
      );
      expect(renderedText.match(/Kit source preview ·/g) ?? []).toHaveLength(
        resolvedMonsterRows.length,
      );
      expect(
        renderedText.match(/^Atk \d+( \[primary\])? ·/gm) ?? [],
      ).toHaveLength(expectedAttackCount);
      // Exactly one ordered attack per kit carries the primary designation.
      expect(renderedText.match(/^Atk \d+ \[primary\] ·/gm) ?? []).toHaveLength(
        resolvedMonsterRows.length,
      );
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      maxTextLength = Math.max(
        maxTextLength,
        ...collectTextDisplayContents(rendered).map(
          (content) => content.length,
        ),
      );
    }
    expect(countDiscordComponents(pasture)).toBe(21);
    expect(maxTextLength).toBeLessThanOrEqual(4_000);
  });

  test("renders exact source route position and neighbours in the World views", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const renderStage = (stageKey: number | undefined) => {
      const stageIndex =
        stageKey === undefined
          ? 0
          : indexes.tables.stages.rows.findIndex(
              (stage) => stage.StageKey === stageKey,
            );
      if (stageIndex < 0) throw new Error(`missing stage fixture ${stageKey}`);
      return renderDiscordHeroWorkspace(
        "123",
        "world",
        snapshot,
        indexes,
        undefined,
        { worldPage: Math.floor(stageIndex / 25), stageKey },
      ).toJSON();
    };
    const textOf = (stageKey: number | undefined) =>
      collectTextDisplayContents(renderStage(stageKey)).join("\n");

    // Break caught: route position/neighbours derived from the page index or
    // the stage-key prefix instead of the source NextStageKey chain.
    expect(textOf(1101)).toContain(
      "Source route 1/120 ←— →#1102 · act 1 opens",
    );
    expect(textOf(1110)).toContain(
      "Source route 10/120 ←#1109 →#1201 · act 1 ends",
    );
    expect(textOf(1208)).toContain("Source route 18/120 ←#1207 →#1209");
    expect(textOf(4310)).toContain(
      "Source route 120/120 ←#4309 →— · act 3 ends",
    );

    // Break caught: the old trailing "Next: <key>" text surviving alongside the
    // route line, which would double-report the neighbour and grow every stage.
    expect(textOf(1101)).toContain("First-clear table: 9200010");
    expect(textOf(1101)).not.toContain("Next: 1102");
    expect(textOf(4310)).not.toContain("Next: Final");

    // Break caught: overview losing the exact route endpoints/segment count.
    expect(textOf(undefined)).toContain(
      "Source route: 120 stages · #1101 → #4310 · 12 act segments",
    );

    // Break caught: preserved neighbouring lines regressing.
    expect(textOf(1101)).toContain("### Source-scaled monster base stats");
    expect(textOf(1101)).toContain("### Source reward references");
    expect(textOf(1208)).toContain(
      "Source blocker: missing monster 20101; this encounter cannot start.",
    );
    expect(textOf(1208)).toContain(
      "Wave #20101 · Weight raw 1000 · source monster row unresolved; base stats unavailable",
    );

    // Break caught: route wording drifting into progression semantics. Scoped
    // to the route line itself; the pre-existing "Progress: Not cleared" line
    // reports stored progress and is not this feature's wording.
    let maxTextLength = 0;
    let routeLineCount = 0;
    for (const stage of indexes.tables.stages.rows) {
      const rendered = renderStage(stage.StageKey);
      const contents = collectTextDisplayContents(rendered);
      const routeLine = contents
        .join("\n")
        .split("\n")
        .find((line) => line.startsWith("Source route "));
      expect(routeLine).toBeDefined();
      routeLineCount += 1;
      const normalizedRoute = routeLine!.toLowerCase();
      for (const forbidden of [
        "unlock",
        "clear",
        "start",
        "eligib",
        "claim",
        "guaranteed",
        "probability",
        "awarded",
      ]) {
        expect(normalizedRoute).not.toContain(forbidden);
      }
      expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
      assertDiscordComponentBounds(rendered);
      const customIds = collectCustomIds(rendered);
      expect(new Set(customIds).size).toBe(customIds.length);
      maxTextLength = Math.max(
        maxTextLength,
        ...contents.map((content) => content.length),
      );
    }
    expect(routeLineCount).toBe(120);
    expect(maxTextLength).toBeLessThanOrEqual(4_000);
  });

  // Break caught: a stage body that only fits while no notice is present. The
  // real read-only handler ALWAYS renders a notice on the stale-refresh and
  // fail-closed paths, so the 4000-char TextDisplay cap must hold WITH the
  // longest notice — otherwise setContent throws and the interaction dies.
  test("keeps every stage detail within the TextDisplay cap while a refresh notice is shown", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const notice =
      "State changed; the read-only stage inspection was refreshed.";

    let worstStageKey = 0;
    let worstLength = 0;
    for (const [index, stage] of indexes.tables.stages.rows.entries()) {
      const rendered = renderDiscordHeroWorkspace(
        "123",
        "world",
        snapshot,
        indexes,
        notice,
        { worldPage: Math.floor(index / 25), stageKey: stage.StageKey },
      ).toJSON();
      assertDiscordComponentBounds(rendered);
      for (const content of collectTextDisplayContents(rendered)) {
        if (content.length > worstLength) {
          worstLength = content.length;
          worstStageKey = stage.StageKey;
        }
      }
    }

    expect({ worstStageKey, within: worstLength <= 4_000 }).toEqual({
      worstStageKey,
      within: true,
    });
    // Iterative-safety ceiling, not just Discord's hard cap: leaves room for
    // future source-detail growth before an interaction can start throwing.
    expect(worstLength).toBeLessThanOrEqual(3_800);
  });

  // Break caught: compaction that buys headroom by dropping a source fact.
  // Every attack value, ref status, provenance and element list must still be
  // rendered verbatim for all 120 stages, and the oracle disclaimers must stay.
  test("keeps every attack-kit source fact rendered while the detail stays compact", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const kitsByMonsterKey = new Map(
      projectDiscordHeroMonsterAttackKits(indexes).map((kit) => [
        kit.monsterKey,
        kit,
      ]),
    );

    let checkedAttacks = 0;
    let checkedKits = 0;
    for (const [index, stage] of indexes.tables.stages.rows.entries()) {
      const text = collectTextDisplayContents(
        renderDiscordHeroWorkspace(
          "123",
          "world",
          snapshot,
          indexes,
          "State changed; the read-only stage inspection was refreshed.",
          { worldPage: Math.floor(index / 25), stageKey: stage.StageKey },
        ).toJSON(),
      ).join("\n");

      expect(text).toContain(
        "Attack cadence, target, cooldown start, buff/status, damage application, death, and RNG remain runtime-oracle-gated.",
      );
      for (const row of projectDiscordHeroStageMonsterSourceRows(
        indexes,
        stage.StageKey,
      )) {
        if (row.status === "unresolved-source-row") {
          // Review finding 1: the unavailable line must carry its own explicit
          // source-preview label, not generic "Kit" wording.
          expect(text).toContain(
            `Kit source preview unavailable: unresolved monster #${row.monsterKey}.`,
          );
          continue;
        }
        const kit = kitsByMonsterKey.get(row.monsterKey)!;
        checkedKits += 1;
        // Review finding 1: every resolved block keeps a local explicit
        // source-preview label.
        expect(text).toContain(`Kit source preview · `);
        expect(text).toContain(JSON.stringify(kit.attackElements));
        if (kit.provenance.kind === "pinned-enrichment") {
          expect(text).toContain(kit.provenance.sourceSha256);
        }
        // Review finding 2: the projected primaryAttack designation and its
        // relation to the ordered list must be rendered, without collapsing
        // the ordered attacks. The marker sits on the ordered attack it
        // designates, so designation and relation are one unambiguous fact.
        const primaryIndex = kit.attacks.findIndex(
          (attack) =>
            JSON.stringify(attack) === JSON.stringify(kit.primaryAttack),
        );
        expect(primaryIndex).toBeGreaterThanOrEqual(0);
        expect(text).toContain(
          `Atk ${primaryIndex + 1} [primary] · skill ${JSON.stringify(kit.primaryAttack.skillKey)} `,
        );
        for (const [attackIndex, attack] of kit.attacks.entries()) {
          checkedAttacks += 1;
          expect(text).toContain(JSON.stringify(attack.skillKey));
          expect(text).toContain(`[${attack.skillRefStatus}]`);
          expect(text).toContain(`· activ ${attack.activation} ·`);
          expect(text).toContain(`· dmg ${attack.damageType} ·`);
          // Review finding 3: deliveryType is a source fact and must be
          // asserted exactly, like every other attack field.
          expect(text).toContain(
            `· deliv ${JSON.stringify(attack.deliveryType)} ·`,
          );
          expect(text).toContain(`· range ${attack.range} ·`);
          expect(text).toContain(`· val ${JSON.stringify(attack.value)} ·`);
          expect(text).toContain(`· snd ${JSON.stringify(attack.sound)}`);
          expect(
            text.includes(`Atk ${attackIndex + 1} · `) ||
              text.includes(`Atk ${attackIndex + 1} [primary] · `),
          ).toBe(true);
        }
        // Ordered attacks and duplicates are preserved, not de-duplicated.
        expect(
          text.match(/^Atk \d+( \[primary\])? · /gm)?.length ?? 0,
        ).toBeGreaterThanOrEqual(kit.attacks.length);
      }
    }
    expect(checkedKits).toBeGreaterThan(120);
    expect(checkedAttacks).toBeGreaterThan(120);
  });

  // Review finding 4: the refresh notice is caller-supplied and was prepended
  // to the first body section with no budget accounting, so a long but
  // legitimate notice pushed the TextDisplay past Discord's 4000 cap and made
  // setContent throw. The notice must be budgeted like any other text, with no
  // notice content dropped.
  test("keeps long refresh notices whole and bounded on the densest stage", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    // 4304 is the densest source stage body in the corpus.
    const stageIndex = indexes.tables.stages.rows.findIndex(
      (stage) => stage.StageKey === 4304,
    );
    expect(stageIndex).toBeGreaterThanOrEqual(0);

    for (const noticeLength of [195, 395, 1200, 3900]) {
      const notice = `State changed; ${"x".repeat(noticeLength)}`.slice(
        0,
        noticeLength,
      );
      expect(notice).toHaveLength(noticeLength);

      const rendered = renderDiscordHeroWorkspace(
        "123",
        "world",
        snapshot,
        indexes,
        notice,
        { worldPage: Math.floor(stageIndex / 25), stageKey: 4304 },
      ).toJSON();
      const contents = collectTextDisplayContents(rendered);

      // No notice content is lost. A notice longer than one component is
      // split across TextDisplays, so contiguity is checked by concatenating
      // the components rather than by a newline-joined substring.
      expect(contents.join("")).toContain(notice);
      // Every TextDisplay stays inside the project ceiling and Discord's cap.
      for (const content of contents) {
        expect(content.length).toBeLessThanOrEqual(3_800);
        expect(content.length).toBeLessThanOrEqual(4_000);
      }
      assertDiscordComponentBounds(rendered);
      // Source facts survive alongside the notice.
      expect(contents.join("\n")).toContain("Kit source preview · ");
      expect(contents.join("\n")).toContain(
        "Attack cadence, target, cooldown start, buff/status, damage application, death, and RNG remain runtime-oracle-gated.",
      );
    }
  });

  // Break caught: any future attempt to add interactive route navigation as
  // extra select options. Pages 0-3 are already saturated at Discord's 25
  // option cap, so a 26th option makes Discord reject the whole message; and
  // making room by dropping stage options would lose direct access to stages.
  // This guard is what defers interactive Prev/Next to an approved
  // handler/action change rather than letting it leak in here.
  test("keeps the world stage selector at exactly the 120 source stages within the 25-option cap", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const snapshot = {
      revision: 14,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };

    const perPage = Array.from({ length: 5 }, (_, page) => {
      const rendered = renderDiscordHeroWorkspace(
        "123",
        "world",
        snapshot,
        indexes,
        undefined,
        { worldPage: page },
      ).toJSON();
      const menus = collectSelectMenus(rendered).filter((menu) =>
        menu.customId.includes(":world:select:"),
      );
      expect(menus).toHaveLength(1);
      return menus[0]!.options;
    });

    expect(perPage.map((options) => options.length)).toEqual([
      25, 25, 25, 25, 20,
    ]);
    expect(perPage.every((options) => options.length <= 25)).toBe(true);
    const optionValues = perPage.flat().map((option) => option.value);
    expect(optionValues).toEqual(
      indexes.tables.stages.rows.map((stage) => String(stage.StageKey)),
    );
    expect(new Set(optionValues).size).toBe(120);
  });

  test("renders a bounded Codex browser and exact-record export control", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const communityContent = await loadDiscordHeroCommunityContent();
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const rendered = renderDiscordHeroWorkspace(
      "123",
      "codex",
      snapshot,
      indexes,
      undefined,
      {
        codex: {
          datasetPage: 0,
          datasetName: "heroes",
          rowIndex: 0,
        },
      },
      undefined,
      undefined,
      communityContent,
    ).toJSON();
    const customIds = collectCustomIds(rendered);
    const decoded = customIds.map(decodeDiscordHeroCustomId);
    const json = JSON.stringify(rendered);

    expect(customIds).toHaveLength(18);
    expect(new Set(customIds).size).toBe(18);
    expect(decoded.slice(0, 2)).toEqual([
      {
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 13,
        value: "st",
      },
      {
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 13,
        value: "ct",
      },
    ]);
    expect(decoded.slice(2, 4)).toEqual([
      {
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 13,
        value: "d-0",
      },
      {
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 13,
        value: "d-1",
      },
    ]);
    expect(decoded[4]).toEqual({
      ownerId: "123",
      view: "codex",
      action: "select",
      revision: 13,
      value: "d-0",
    });
    expect(decoded.slice(5, 8).map((control) => control.action)).toEqual([
      "page",
      "page",
      "export",
    ]);
    expect(json).toContain("**heroes** · row 1/6");
    expect(json).toContain("Preview is shortened for Discord");
    expect(json).toContain("Download exact JSON");
    expect(json).toContain("Source Data");
    expect(json).toContain("Community");
    expect(countDiscordComponents(rendered)).toBe(28);
    expect(countDiscordComponents(rendered)).toBeLessThanOrEqual(40);
    expect(
      Math.max(
        ...collectTextDisplayContents(rendered).map(
          (content) => content.length,
        ),
      ),
    ).toBeLessThanOrEqual(4_000);
  });

  test("renders every Community census field and a lossless document chunk within Discord bounds", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const communityContent = await loadDiscordHeroCommunityContent();
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    const list = renderDiscordHeroWorkspace(
      "123",
      "codex",
      snapshot,
      indexes,
      undefined,
      {
        codexTab: "community",
        communityCategory: "builds",
        communityListPage: 0,
      },
      undefined,
      undefined,
      communityContent,
    ).toJSON();
    const listIds = collectCustomIds(list);
    const listText = collectTextDisplayContents(list).join("\n");
    const listMenus = collectSelectMenus(list);

    expect(new Set(listIds).size).toBe(listIds.length);
    expect(listMenus).toHaveLength(1);
    expect(listMenus[0]!.options).toHaveLength(25);
    expect(listMenus[0]!.options[0]!.value).toBe(
      encodeDiscordHeroCommunityDocumentTarget(
        communityContent,
        "builds",
        0,
        0,
      ),
    );
    expect(listText).toContain("## 📖 Codex · Community");
    expect(listText).toContain("gameplayAuthority: false");
    expect(listText).toContain(
      "84 documents · 83 details · 24 linked · 59 unlisted · 83 reverse-linked",
    );
    expect(listText).toContain("Reverse mode: markdown-link");
    expect(listText).toContain(
      communityContent.provenance.sourceAggregateSha256,
    );
    assertDiscordComponentBounds(list);
    expect(countDiscordComponents(list)).toBeLessThanOrEqual(40);

    const document = communityContent.documents[0]!;
    const detail = renderDiscordHeroWorkspace(
      "123",
      "codex",
      snapshot,
      indexes,
      undefined,
      {
        codexTab: "community",
        communityCategory: "builds",
        communityListPage: 0,
        communityDocumentIndex: 0,
        communityChunkPage: 0,
      },
      undefined,
      undefined,
      communityContent,
    ).toJSON();
    const detailIds = collectCustomIds(detail);
    const detailText = collectTextDisplayContents(detail);

    expect(new Set(detailIds).size).toBe(detailIds.length);
    expect(detailIds.map(decodeDiscordHeroCustomId)).toContainEqual({
      ownerId: "123",
      view: "codex",
      action: "export",
      revision: 13,
      value: encodeDiscordHeroCommunityChunkTarget(
        communityContent,
        "builds",
        0,
        0,
        0,
      ),
    });
    expect(detailText.join("\n")).toContain(document.sha256);
    expect(detailText.join("\n")).toContain(
      JSON.stringify(document.frontmatter),
    );
    expect(detailText).toContain(document.markdown.slice(0, 3_500));
    assertDiscordComponentBounds(detail);
    expect(countDiscordComponents(detail)).toBeLessThanOrEqual(40);
  });

  test("renders every Community list page, document, and chunk with unique bounded Discord components", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const communityContent = await loadDiscordHeroCommunityContent();
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(indexes, 101),
    };
    let renderedLists = 0;
    let renderedDocuments = 0;
    let renderedChunks = 0;

    for (const category of DISCORD_HERO_COMMUNITY_CATEGORIES) {
      const pageCount = discordHeroCommunityContentPageCount(
        communityContent,
        category,
      );
      for (let listPage = 0; listPage < pageCount; listPage += 1) {
        const page = discordHeroCommunityContentPage(
          communityContent,
          category,
          listPage,
        );
        const list = renderDiscordHeroWorkspace(
          "123",
          "codex",
          snapshot,
          indexes,
          undefined,
          {
            codexTab: "community",
            communityCategory: category,
            communityListPage: listPage,
          },
          undefined,
          undefined,
          communityContent,
        ).toJSON();
        assertDiscordHeroCommunityRenderBounds(list);
        renderedLists += 1;

        for (const option of page.options) {
          const first = readDiscordHeroCommunityContentDocument(
            communityContent,
            category,
            listPage,
            option.documentIndex,
            0,
          );
          renderedDocuments += 1;
          for (
            let chunkPage = 0;
            chunkPage < first.chunkCount;
            chunkPage += 1
          ) {
            const detail = renderDiscordHeroWorkspace(
              "123",
              "codex",
              snapshot,
              indexes,
              undefined,
              {
                codexTab: "community",
                communityCategory: category,
                communityListPage: listPage,
                communityDocumentIndex: option.documentIndex,
                communityChunkPage: chunkPage,
              },
              undefined,
              undefined,
              communityContent,
            ).toJSON();
            assertDiscordHeroCommunityRenderBounds(detail);
            renderedChunks += 1;
          }
        }
      }
    }

    expect(renderedLists).toBe(9);
    expect(renderedDocuments).toBe(153);
    expect(renderedChunks).toBeGreaterThan(153);
  });

  test("emits one Party menu per actionable slot and none for locked or hole-making slots", async () => {
    const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
    const CAPACITY_RUNES = {
      1: [],
      2: [
        { key: 1, level: 1 },
        { key: 20, level: 1 },
        { key: 21, level: 1 },
      ],
      3: [
        { key: 1, level: 1 },
        { key: 20, level: 1 },
        { key: 21, level: 1 },
        { key: 22, level: 1 },
        { key: 23, level: 1 },
        { key: 24, level: 1 },
      ],
    } as const;

    function partyBoard(
      capacity: 1 | 2 | 3,
      party: readonly (number | null)[],
    ) {
      const state = createFreshPlayerStateFromCatalog(indexes, 101);
      state.runes = CAPACITY_RUNES[capacity].map((rune) => ({ ...rune }));
      state.party = [...party] as typeof state.party;
      return renderDiscordHeroWorkspace(
        "123",
        "party",
        { revision: 41, state },
        indexes,
      ).toJSON();
    }

    const slotTargets = (board: unknown) =>
      collectSelectMenus(board)
        .map((menu) => decodeDiscordHeroCustomId(menu.customId))
        .filter((id) => id.view === "party" && id.action === "select")
        .map((id) => id.value);

    expect(slotTargets(partyBoard(1, [101, null, null]))).toEqual(["s-1"]);
    expect(slotTargets(partyBoard(2, [101, null, null]))).toEqual([
      "s-1",
      "s-2",
    ]);
    // Slot 3 stays silent until slot 2 is filled: offering it would leave a hole.
    expect(slotTargets(partyBoard(3, [101, null, null]))).toEqual([
      "s-1",
      "s-2",
    ]);
    expect(slotTargets(partyBoard(3, [101, 201, null]))).toEqual([
      "s-1",
      "s-2",
      "s-3",
    ]);

    const board = partyBoard(2, [101, null, null]);
    const body = collectTextDisplayContents(board).join("\n");
    expect(body).toContain("Formation 2/3");
    expect(body).toContain("Slot 1: Knight · Occupied");
    expect(body).toContain("Slot 2: Empty (unlocked)");
    expect(body).toContain("Slot 3: Locked");
    expect(body).not.toContain("Slot 1: 101");

    const menus = collectSelectMenus(board).filter((menu) =>
      menu.customId.includes(":party:select:"),
    );
    expect(
      menus.map((menu) => menu.options.map((option) => option.value)),
    ).toEqual([
      ["101", "201", "301"],
      ["201", "301"],
    ]);
    for (const menu of menus) {
      expect(decodeDiscordHeroCustomId(menu.customId)).toMatchObject({
        ownerId: "123",
        revision: 41,
      });
    }
    const ids = collectCustomIds(board);
    expect(new Set(ids).size).toBe(ids.length);
    assertDiscordComponentBounds(board);
  });
});
