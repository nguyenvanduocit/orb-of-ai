import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import {
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import type { LoadedDiscordHeroCommunityAchievements } from "../community-achievements/loader";
import type { DiscordHeroCommunityContentCategory } from "../community-content/compiler";
import type { LoadedDiscordHeroCommunityContent } from "../community-content/loader";
import type { LoadedDiscordHeroCommunityMarket } from "../community-market/loader";
import {
  DISCORD_HERO_CONTAINERS,
  quoteContainerSlotUnlock,
  type DiscordHeroContainer,
} from "../domain/containers";
import {
  quoteAttributeAllocation,
  type AttributeAllocationQuote,
} from "../domain/attributes";
import { quoteCubeRecipeUnlock } from "../domain/cube-unlocks";
import {
  createHeroRoster,
  heroSkillKeys,
  projectDiscordHeroBaseCombatUnits,
  projectDiscordHeroStatPreview,
  quoteHeroUnlock,
  roundDiscordHeroBaseAttackDpsForDisplay,
  type DiscordHeroStatPreview,
} from "../domain/heroes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import { quoteRuneUpgrade } from "../domain/runes";
import { stageEncounter } from "../domain/campaign";
import { projectStageSourceRewardPreview } from "../domain/stage-reward-preview";
import type { PlayerSnapshot } from "../state/repository";
import { divider, text } from "../../ui";
import {
  discordHeroAchievementPage,
  encodeDiscordHeroAchievementPage,
  readDiscordHeroAchievementDetail,
} from "./achievements";
import {
  discordHeroAlchemyOptions,
  discordHeroAlchemyPageCount,
  encodeDiscordHeroAlchemyPage,
  isDiscordHeroAlchemyUnlocked,
} from "./alchemy";
import {
  decodeDiscordHeroAttributeTarget,
  discordHeroAttributePage,
  encodeDiscordHeroAttributePage,
  projectDiscordHeroAttributeTrees,
  readDiscordHeroAttributeDetail,
  type DiscordHeroAttributeNode,
  type DiscordHeroAttributePage,
} from "./attributes";
import {
  discordHeroCollectionPageCount,
  discordHeroCollectionRows,
  encodeDiscordHeroCollectionPage,
  readDiscordHeroPet,
  readDiscordHeroSkin,
  type DiscordHeroCollectionKind,
} from "./collection";
import {
  encodeDiscordHeroContainerPageTarget,
  projectDiscordHeroContainerPage,
  projectDiscordHeroContainerTabs,
  readDiscordHeroContainerSlot,
  type DiscordHeroContainerKind,
  type DiscordHeroContainerPage,
} from "./containers";
import {
  decodeDiscordHeroCubePage,
  decodeDiscordHeroCubeTarget,
  discordHeroCubeMainRecipeOptions,
  discordHeroCubeSubRecipeOptions,
  discordHeroCubeSubRecipePageCount,
  encodeDiscordHeroCubePage,
  resolveDiscordHeroCubeTarget,
  type DiscordHeroCubeMainRecipeDetail,
  type DiscordHeroCubeSubRecipeDetail,
} from "./cube";
import {
  discordHeroCodexDatasetPageCount,
  discordHeroCodexDatasets,
  encodeDiscordHeroCodexDatasetPage,
  encodeDiscordHeroCodexRecordTarget,
  encodeDiscordHeroCodexRowPage,
  readDiscordHeroCodexRecord,
  type DiscordHeroCodexLocation,
} from "./codex";
import {
  DISCORD_HERO_COMMUNITY_CATEGORIES,
  discordHeroCommunityContentPage,
  encodeDiscordHeroCommunityChunkTarget,
  encodeDiscordHeroCommunityListPage,
  readDiscordHeroCommunityContentDocument,
} from "./community-content";
import {
  DISCORD_HERO_VIEWS,
  encodeDiscordHeroCustomId,
  type DiscordHeroView,
} from "./custom-id";
import { discordHeroHeroes } from "./heroes";
import {
  projectDiscordHeroHome,
  type DiscordHeroHomeAlert,
  type DiscordHeroHomeHero,
} from "./home";
import {
  DISCORD_HERO_INVENTORY_ALL_FILTER,
  discordHeroCompatibleEquipHeroes,
  discordHeroEquippedGear,
  discordHeroEquippedGearPageCount,
  discordHeroFreeInventoryPageCount,
  discordHeroFreeInventorySlots,
  discordHeroInventoryFilterGroups,
  discordHeroInventoryFilterLabel,
  discordHeroInventoryMatchCount,
  discordHeroInventoryPageCount,
  discordHeroInventorySlots,
  discordHeroRolledStatPageCount,
  discordHeroRolledStats,
  encodeDiscordHeroInventoryFilter,
  encodeDiscordHeroEquipTarget,
  encodeDiscordHeroItemEffectsPageTarget,
  encodeDiscordHeroItemEffectsSectionTarget,
  encodeDiscordHeroEquipmentPage,
  encodeDiscordHeroEquipmentSelection,
  encodeDiscordHeroInventoryRollPageTarget,
  encodeDiscordHeroInventoryPage,
  encodeDiscordHeroUnequipTarget,
  readDiscordHeroStoredAsset,
  type DiscordHeroEquipmentSelection,
  type DiscordHeroInventoryFilter,
  type DiscordHeroStoredAssetView,
} from "./inventory";
import {
  discordHeroItemEffectsDetail,
  discordHeroItemEffectsPage,
  discordHeroItemEffectsTextRows,
  projectDiscordHeroItemEffectsBrowser,
  type DiscordHeroItemEffectSourceVector,
} from "./item-effects";
import {
  discordHeroRunePageCount,
  discordHeroRunes,
  encodeDiscordHeroRunePage,
} from "./runes";
import {
  decodeDiscordHeroMarketPage,
  discordHeroMarketPage,
  encodeDiscordHeroMarketKind,
  encodeDiscordHeroMarketPage,
  readDiscordHeroMarketDetail,
} from "./market";
import {
  discordHeroSkillPageCount,
  discordHeroSkills,
  encodeDiscordHeroSkillPage,
  encodeDiscordHeroSkillTarget,
  readDiscordHeroSkill,
} from "./skills";
import {
  discordHeroRouteEntry,
  discordHeroStagePageCount,
  discordHeroStages,
  encodeDiscordHeroStagePage,
  projectDiscordHeroMonsterAttackKits,
  projectDiscordHeroSourceRoute,
  projectDiscordHeroStageMonsterSourceRows,
  type DiscordHeroMonsterAttackKit,
} from "./world";

export interface DiscordHeroWorkspaceLocation {
  readonly alchemyPage?: number;
  readonly attributePageTarget?: string;
  readonly attributeTarget?: string;
  readonly codex?: DiscordHeroCodexLocation;
  readonly codexTab?: "source-data" | "community";
  readonly communityCategory?: DiscordHeroCommunityContentCategory;
  readonly communityListPage?: number;
  readonly communityDocumentIndex?: number;
  readonly communityChunkPage?: number;
  readonly collectionKey?: number;
  readonly collectionPage?: number;
  readonly collectionTab?: "pets" | "skins" | "achievements";
  readonly containerPageTarget?: string;
  readonly containerSlotTarget?: string;
  readonly achievementPage?: number;
  readonly achievementRowIndex?: number;
  readonly equipmentPage?: number;
  readonly equipmentSelection?: DiscordHeroEquipmentSelection;
  readonly itemEffects?: {
    readonly sourceVector: DiscordHeroItemEffectSourceVector;
    readonly page: number;
    readonly rowIndex?: number;
  };
  readonly freeInventoryPage?: number;
  readonly inventoryFilter?: DiscordHeroInventoryFilter;
  readonly inventoryPage?: number;
  readonly inventorySlotIndex?: number;
  readonly rollPage?: number;
  readonly runePage?: number;
  readonly runeTab?: "runes" | "skills";
  readonly skillPage?: number;
  readonly skillRowIndex?: number;
  readonly worldPage?: number;
  readonly stageKey?: number;
  readonly heroKey?: number;
  readonly heroTab?: "overview" | "attributes";
  readonly cubePageTarget?: string;
  readonly cubeTab?: "browse" | "alchemy";
  readonly cubeTarget?: string;
  readonly marketPageTarget?: string;
  readonly marketTarget?: string;
}

const CONTAINER_KIND_CODES = {
  inventory: "i",
  stash: "s",
  storage: "o",
  tradingStash: "t",
} as const satisfies Record<DiscordHeroContainerKind, string>;

const CONTAINER_CODE_KINDS = {
  i: "inventory",
  s: "stash",
  o: "storage",
  t: "tradingStash",
} as const satisfies Record<string, DiscordHeroContainerKind>;

export type DiscordHeroContainerUnlockTarget =
  | {
      readonly container: DiscordHeroContainerKind;
      readonly origin: "inventory";
      readonly inventoryPage: number;
      readonly equipmentPage: number;
    }
  | {
      readonly container: DiscordHeroContainerKind;
      readonly origin: "container";
      readonly containerPageTarget: string;
    };

function encodeContextPage(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("DiscordHero Container unlock context has invalid page");
  }
  return value.toString(36);
}

function decodeContextPage(value: string): number {
  if (!/^[0-9a-z]+$/.test(value)) {
    throw new Error("DiscordHero Container unlock context has invalid page");
  }
  const page = Number.parseInt(value, 36);
  if (!Number.isSafeInteger(page) || page < 0 || page.toString(36) !== value) {
    throw new Error(
      "DiscordHero Container unlock context has non-canonical page",
    );
  }
  return page;
}

function containerKindFromCode(code: string): DiscordHeroContainerKind {
  const kind = CONTAINER_CODE_KINDS[code as keyof typeof CONTAINER_CODE_KINDS];
  if (kind === undefined) {
    throw new Error("DiscordHero Container unlock context has unknown kind");
  }
  return kind;
}

function encodeDiscordHeroContainerUnlockTarget(
  container: DiscordHeroContainerKind,
  location: DiscordHeroWorkspaceLocation,
  page: DiscordHeroContainerPage | null,
): string {
  const targetCode = CONTAINER_KIND_CODES[container];
  if (page !== null) {
    return `cu-${targetCode}-c-${CONTAINER_KIND_CODES[page.kind]}-${encodeContextPage(page.page)}`;
  }
  return `cu-${targetCode}-i-${encodeContextPage(location.inventoryPage ?? 0)}-${encodeContextPage(location.equipmentPage ?? 0)}`;
}

export function decodeDiscordHeroContainerUnlockTarget(
  value: string | undefined,
): DiscordHeroContainerUnlockTarget | null {
  const inventoryMatch = /^cu-([isot])-i-([0-9a-z]+)-([0-9a-z]+)$/.exec(
    value ?? "",
  );
  if (inventoryMatch !== null) {
    try {
      return {
        container: containerKindFromCode(inventoryMatch[1]!),
        origin: "inventory",
        inventoryPage: decodeContextPage(inventoryMatch[2]!),
        equipmentPage: decodeContextPage(inventoryMatch[3]!),
      };
    } catch {
      return null;
    }
  }
  const containerMatch = /^cu-([isot])-c-([isot])-([0-9a-z]+)$/.exec(
    value ?? "",
  );
  if (containerMatch === null) return null;
  try {
    const kind = containerKindFromCode(containerMatch[2]!);
    const page = decodeContextPage(containerMatch[3]!);
    return {
      container: containerKindFromCode(containerMatch[1]!),
      origin: "container",
      containerPageTarget: `cp-${CONTAINER_KIND_CODES[kind]}-${page.toString(36)}`,
    };
  } catch {
    return null;
  }
}

function storedAssetSummary(asset: DiscordHeroStoredAssetView): string {
  return [
    asset.type,
    asset.gearType ?? "—",
    asset.level === null ? "Lv—" : `Lv${asset.level}`,
    asset.grade,
    ...(asset.quantity === null ? [] : [`×${asset.quantity}`]),
  ].join(" · ");
}

function storedAssetDetail(
  heading: string,
  asset: DiscordHeroStoredAssetView,
  rollPage: number,
): string[] {
  const rollPageCount = discordHeroRolledStatPageCount(asset);
  const rolledStats = discordHeroRolledStats(asset, rollPage);
  return [
    heading,
    `${asset.name} · #${asset.itemKey} · ${asset.type} · ${asset.gearType ?? "—"} · ${asset.level === null ? "Lv—" : `Lv${asset.level}`} · ${asset.grade}`,
    ...(asset.instanceId === null ? [] : [`Instance: ${asset.instanceId}`]),
    ...(asset.quantity === null ? [] : [`Quantity: ${asset.quantity}`]),
    asset.rolledStats.length === 0
      ? "Rolled stats: —"
      : `Rolled stats · Page ${rollPage + 1}/${rollPageCount}`,
    ...rolledStats.map(
      (stat) =>
        `- #${stat.statModKey} · ${stat.statType} · ${stat.modType} · ${stat.value}`,
    ),
  ];
}

function chunkTextLines(lines: readonly string[]): readonly string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length <= 3_900) {
      current = candidate;
      continue;
    }
    if (current.length > 0) chunks.push(current);
    current = line;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function splitDiscordText(
  value: string,
  maximumLength = 3_900,
): readonly string[] {
  const chunks: string[] = [];
  let current = "";
  for (const codePoint of value) {
    if (current.length + codePoint.length > maximumLength) {
      chunks.push(current);
      current = "";
    }
    current += codePoint;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function inventoryBodySections(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): readonly string[] {
  const state = snapshot.state;
  const inventoryFilter =
    location.inventoryFilter ?? DISCORD_HERO_INVENTORY_ALL_FILTER;
  const inventoryPage = location.inventoryPage ?? 0;
  const equipmentPage = location.equipmentPage ?? 0;
  const rollPage = location.rollPage ?? 0;
  const matching = discordHeroInventoryMatchCount(
    indexes,
    state,
    inventoryFilter,
  );
  const occupiedPageCount = discordHeroInventoryPageCount(
    indexes,
    state,
    inventoryFilter,
  );
  const equipmentPageCount = discordHeroEquippedGearPageCount(state);
  const occupied = discordHeroInventorySlots(
    indexes,
    state,
    inventoryFilter,
    inventoryPage,
  );
  const equipped = discordHeroEquippedGear(state, equipmentPage, indexes);
  const lines = [
    "## 🎒 Inventory",
    `Used: ${state.containers.inventory.slots.length}/${state.containers.inventory.unlockedSlots}`,
    `Filter: ${discordHeroInventoryFilterLabel(inventoryFilter)} · Matching: ${matching}/${state.containers.inventory.slots.length} · Occupied page ${inventoryPage + 1}/${occupiedPageCount}`,
    `Equipped: ${state.heroes.reduce((total, hero) => total + hero.equipment.length, 0)} · Equipment page ${equipmentPage + 1}/${equipmentPageCount}`,
    `Stash: ${state.containers.stash.slots.length}/${state.containers.stash.unlockedSlots} · Storage: ${state.containers.storage.slots.length}/${state.containers.storage.unlockedSlots}`,
    "",
    ...(occupied.length === 0
      ? [
          inventoryFilter.kind === "all"
            ? "No occupied Inventory slots."
            : "No Inventory slots match this filter.",
        ]
      : occupied.map((slot) => {
          const asset = readDiscordHeroStoredAsset(indexes, slot.asset);
          return `Slot ${slot.index} · ${asset.name} (#${asset.itemKey}) · ${asset.type}/${asset.gearType ?? "—"} · ${asset.level === null ? "Lv—" : `Lv${asset.level}`} · ${asset.grade}`;
        })),
  ];
  const detailLines: string[] = [];

  if (location.inventorySlotIndex !== undefined) {
    const selected = occupied.find(
      (slot) => slot.index === location.inventorySlotIndex,
    );
    if (selected === undefined) {
      throw new Error(
        `Inventory slot ${location.inventorySlotIndex} is outside occupied page ${inventoryPage}`,
      );
    }
    detailLines.push(
      ...storedAssetDetail(
        `### Selected Inventory slot ${selected.index}`,
        readDiscordHeroStoredAsset(indexes, selected.asset),
        rollPage,
      ),
    );
  }

  if (location.equipmentSelection !== undefined) {
    const selection = location.equipmentSelection;
    const selected = equipped.find(
      (entry) =>
        entry.heroKey === selection.heroKey &&
        entry.gearType === selection.gearType,
    );
    if (selected === undefined) {
      throw new Error(
        `Equipped gear ${selection.heroKey}/${selection.gearType} is outside equipment page ${equipmentPage}`,
      );
    }
    const heroName = getLocalizedCatalogName(
      indexes,
      "heroes",
      selected.heroKey,
      "en-US",
    );
    if (location.itemEffects === undefined) {
      detailLines.push(
        `### Equipped by ${heroName} (#${selected.heroKey}) · ${selected.gearType}`,
        ...storedAssetDetail(
          "Selected equipped gear",
          readDiscordHeroStoredAsset(indexes, selected.asset),
          rollPage,
        ).slice(1),
      );
    } else {
      const input = {
        indexes,
        state,
        heroKey: selected.heroKey,
        instanceId: selected.asset.instanceId,
      };
      const browser = projectDiscordHeroItemEffectsBrowser(input);
      const pageInput = {
        sourceVector: location.itemEffects.sourceVector,
        page: location.itemEffects.page,
      };
      const page = discordHeroItemEffectsPage(input, pageInput);
      const safeRows = discordHeroItemEffectsTextRows(input, pageInput);
      let selectedRow: (typeof page.rows)[number] | null = null;
      if (location.itemEffects.rowIndex !== undefined) {
        const row = page.rows.find(
          (candidate) => candidate.rowIndex === location.itemEffects!.rowIndex,
        );
        if (row === undefined) {
          throw new Error(
            `Item Effects row ${location.itemEffects.rowIndex} is outside ${location.itemEffects.sourceVector} page ${location.itemEffects.page}`,
          );
        }
        selectedRow = row;
      }
      if (selectedRow !== null) {
        discordHeroItemEffectsDetail(input, {
          sourceVector: location.itemEffects.sourceVector,
          rowIndex: selectedRow.rowIndex,
        });
      }
      const vectorLabel =
        location.itemEffects.sourceVector === "base"
          ? "Base"
          : location.itemEffects.sourceVector === "inherent"
            ? "Inherent"
            : "Rolled";
      detailLines.push(
        `### Equipped by ${heroName} (#${selected.heroKey}) · ${selected.gearType}`,
        `Item Effects · source-proven base, inherent, and rolled values only`,
        `Item #${selected.asset.itemKey} · Instance ${selected.asset.instanceId}`,
        `${vectorLabel} source effects · ${page.rowCount} rows · Page ${page.page + 1}/${page.pageCount}`,
        ...(safeRows.length === 0
          ? [`No source-proven ${location.itemEffects.sourceVector} effects.`]
          : safeRows),
        ...(selectedRow === null
          ? []
          : [
              `Selected effect #${selectedRow.rowIndex}`,
              safeRows[
                page.rows.findIndex(
                  (row) => row.rowIndex === selectedRow.rowIndex,
                )
              ]!,
            ]),
        ...(browser.oracleTextRows.length === 0
          ? []
          : ["Oracle-required source gates:", ...browser.oracleTextRows]),
      );
    }
  }

  return chunkTextLines([...lines, ...detailLines]);
}

function containerBodySections(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): readonly string[] {
  if (location.containerPageTarget === undefined) {
    throw new Error("DiscordHero Container view is missing its bound page");
  }
  const page = projectDiscordHeroContainerPage(
    indexes,
    snapshot.state,
    location.containerPageTarget,
  );
  const lines = [
    `## 🧰 ${page.label} · Page ${page.page + 1}/${page.pageCount}`,
    `Capacity: ${page.capacity} · Unlocked: ${page.unlocked} · Occupied: ${page.occupied} · Free: ${page.free}`,
    "",
    ...page.slots.map((slot) =>
      slot.status === "free"
        ? `Slot #${slot.slotIndex} · Free`
        : `Slot #${slot.slotIndex} · ${slot.label.slice(slot.label.indexOf(" ") + 1)} · ${slot.description}`,
    ),
  ];
  let body = lines.join("\n");

  if (location.containerSlotTarget !== undefined) {
    const detail = readDiscordHeroContainerSlot(
      indexes,
      snapshot.state,
      page,
      location.containerSlotTarget,
    );
    body += `\n\n### ${page.label} slot #${detail.slotIndex}`;
    if (detail.status === "free") {
      body += "\nFree and unlocked";
    } else {
      const { rolledStats, ...identity } = detail.asset;
      const sources = [
        ...new Map(
          rolledStats.map((stat) => [
            stat.statModKey,
            {
              statModKey: stat.statModKey,
              statType: stat.statType,
              modType: stat.modType,
            },
          ]),
        ).values(),
      ];
      const values = rolledStats.map(
        (stat) => [stat.statModKey, stat.value] as const,
      );
      body += [
        "",
        `Asset identity JSON: ${JSON.stringify(identity)}`,
        `Rolled stat sources JSON: ${JSON.stringify(sources)}`,
        `Rolled stat values JSON: ${JSON.stringify(values)}`,
      ].join("\n");
    }
  }

  return splitDiscordText(body, 3_500);
}

const VIEW_LABELS: Record<DiscordHeroView, string> = {
  home: "🏠 Home",
  heroes: "🦸 Heroes",
  party: "⚔️ Party",
  world: "🗺️ World",
  inventory: "🎒 Inventory",
  runes: "🔮 Runes",
  cube: "🧊 Cube",
  collection: "📚 Collection",
  codex: "📖 Codex",
  market: "⚓ Market",
};

const CONTAINER_LABELS: Record<DiscordHeroContainer, string> = {
  inventory: "Inventory",
  stash: "Stash",
  storage: "Storage",
  tradingStash: "Trading Stash",
};

function navigationRows(
  ownerId: string,
  revision: number,
  activeView: DiscordHeroView,
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = DISCORD_HERO_VIEWS.map((view) =>
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view,
          action: "view",
          revision,
        }),
      )
      .setLabel(VIEW_LABELS[view])
      .setStyle(
        view === activeView ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(view === activeView),
  );
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(5, 10)),
  ];
}

function containerActionRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
  page: DiscordHeroContainerPage | null,
): ActionRowBuilder<ButtonBuilder> {
  const buttons = DISCORD_HERO_CONTAINERS.map((container) => {
    const quote = quoteContainerSlotUnlock(indexes, snapshot.state, container);
    const available = quote.kind === "available";
    return new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "inventory",
          action: "unlock",
          revision: snapshot.revision,
          value: encodeDiscordHeroContainerUnlockTarget(
            container,
            location,
            page,
          ),
        }),
      )
      .setLabel(
        available
          ? `${CONTAINER_LABELS[container]} +1 · ${quote.cost}g`
          : `${CONTAINER_LABELS[container]} · MAX`,
      )
      .setStyle(
        available && quote.canAfford
          ? ButtonStyle.Success
          : ButtonStyle.Secondary,
      )
      .setDisabled(!available || !quote.canAfford);
  });
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

function containerTabRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  activeKind: DiscordHeroContainerKind,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    projectDiscordHeroContainerTabs(indexes, snapshot.state).map((tab) =>
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "inventory",
            action:
              tab.kind === activeKind && activeKind !== "inventory"
                ? "view"
                : "page",
            revision: snapshot.revision,
            value: tab.pageTarget,
          }),
        )
        .setLabel(tab.label)
        .setStyle(
          tab.kind === activeKind ? ButtonStyle.Primary : ButtonStyle.Secondary,
        )
        .setDisabled(tab.kind === activeKind),
    ),
  );
}

function boundedPageRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  label: string,
  page: number,
  pageCount: number,
  encodePage: (page: number) => string,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "inventory",
          action: "page",
          revision: snapshot.revision,
          value: encodePage(Math.max(0, page - 1)),
        }),
      )
      .setLabel(`← ${label}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "inventory",
          action: "page",
          revision: snapshot.revision,
          value: encodePage(Math.min(pageCount - 1, page + 1)),
        }),
      )
      .setLabel(`${label} →`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === pageCount - 1),
  );
}

function containerActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  page: DiscordHeroContainerPage,
  selectedTarget: string | undefined,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (page.pageCount > 1) {
    const buttons: ButtonBuilder[] = [];
    if (page.page > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "inventory",
              action: "page",
              revision: snapshot.revision,
              value: `cp-${CONTAINER_KIND_CODES[page.kind]}-${(page.page - 1).toString(36)}`,
            }),
          )
          .setLabel(`← ${page.label}`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    if (page.page + 1 < page.pageCount) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "inventory",
              action: "page",
              revision: snapshot.revision,
              value: `cp-${CONTAINER_KIND_CODES[page.kind]}-${(page.page + 1).toString(36)}`,
            }),
          )
          .setLabel(`${page.label} →`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    if (buttons.length > 0) {
      rows.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          buttons,
        ),
      );
    }
  }
  if (page.slots.length > 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "inventory",
              action: "select",
              revision: snapshot.revision,
              value: page.pageTarget,
            }),
          )
          .setPlaceholder(
            `Inspect ${page.label} · page ${page.page + 1}/${page.pageCount}`,
          )
          .addOptions(
            page.slots.map((slot) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(slot.label)
                .setDescription(slot.description)
                .setValue(slot.target)
                .setDefault(slot.target === selectedTarget),
            ),
          ),
      ),
    );
  }
  return rows;
}

function inventoryActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  const inventoryFilter =
    location.inventoryFilter ?? DISCORD_HERO_INVENTORY_ALL_FILTER;
  const inventoryPage = location.inventoryPage ?? 0;
  const equipmentPage = location.equipmentPage ?? 0;
  const rollPage = location.rollPage ?? 0;
  const inventoryPageCount = discordHeroInventoryPageCount(
    indexes,
    snapshot.state,
    inventoryFilter,
  );
  const equipmentPageCount = discordHeroEquippedGearPageCount(snapshot.state);
  const occupied = discordHeroInventorySlots(
    indexes,
    snapshot.state,
    inventoryFilter,
    inventoryPage,
  );
  const equipped = discordHeroEquippedGear(
    snapshot.state,
    equipmentPage,
    indexes,
  );

  if (location.equipmentSelection === undefined) {
    const filterGroups = discordHeroInventoryFilterGroups(indexes);
    const filterTarget = encodeDiscordHeroInventoryFilter(inventoryFilter);
    for (const [value, placeholder, filters] of [
      ["fp", "Filter by kind, item type, or grade", filterGroups.primary],
      ["fg", "Filter by exact gear type", filterGroups.gearTypes],
    ] as const) {
      rows.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              encodeDiscordHeroCustomId({
                ownerId,
                view: "inventory",
                action: "select",
                revision: snapshot.revision,
                value,
              }),
            )
            .setPlaceholder(placeholder)
            .addOptions(
              filters.map((filter) => {
                const label = discordHeroInventoryFilterLabel(filter);
                const target = encodeDiscordHeroInventoryFilter(filter);
                return new StringSelectMenuOptionBuilder()
                  .setLabel(label)
                  .setDescription(
                    filter.kind === "all"
                      ? "Every occupied Inventory slot"
                      : `${label} source-backed filter`,
                  )
                  .setValue(target)
                  .setDefault(target === filterTarget);
              }),
            ),
        ),
      );
    }
    if (inventoryPageCount > 1) {
      rows.push(
        boundedPageRow(
          ownerId,
          snapshot,
          "Occupied",
          inventoryPage,
          inventoryPageCount,
          (page) => encodeDiscordHeroInventoryPage(inventoryFilter, page),
        ),
      );
    }
    if (occupied.length > 0) {
      rows.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              encodeDiscordHeroCustomId({
                ownerId,
                view: "inventory",
                action: "select",
                revision: snapshot.revision,
                value: encodeDiscordHeroInventoryPage(
                  inventoryFilter,
                  inventoryPage,
                ),
              }),
            )
            .setPlaceholder(
              `Inspect Inventory · page ${inventoryPage + 1}/${inventoryPageCount}`,
            )
            .addOptions(
              occupied.map((slot) => {
                const asset = readDiscordHeroStoredAsset(indexes, slot.asset);
                return new StringSelectMenuOptionBuilder()
                  .setLabel(`Slot ${slot.index} · ${asset.name}`.slice(0, 100))
                  .setDescription(storedAssetSummary(asset).slice(0, 100))
                  .setValue(String(slot.index))
                  .setDefault(slot.index === location.inventorySlotIndex);
              }),
            ),
        ),
      );
    }

    if (location.inventorySlotIndex !== undefined) {
      const selected = occupied.find(
        (slot) => slot.index === location.inventorySlotIndex,
      );
      if (selected === undefined) {
        throw new Error(
          `Inventory slot ${location.inventorySlotIndex} is outside occupied page ${inventoryPage}`,
        );
      }
      if (selected.asset.kind === "gear") {
        const selectedAsset = readDiscordHeroStoredAsset(
          indexes,
          selected.asset,
        );
        const rollPageCount = discordHeroRolledStatPageCount(selectedAsset);
        if (rollPageCount > 1) {
          rows.push(
            boundedPageRow(
              ownerId,
              snapshot,
              "Rolled stats",
              rollPage,
              rollPageCount,
              (page) =>
                encodeDiscordHeroInventoryRollPageTarget(
                  inventoryFilter,
                  inventoryPage,
                  selected.index,
                  page,
                ),
            ),
          );
        }
        const heroes = discordHeroCompatibleEquipHeroes(
          indexes,
          snapshot.state,
          selected.index,
        );
        if (heroes.length > 0) {
          rows.push(
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(
                  encodeDiscordHeroCustomId({
                    ownerId,
                    view: "inventory",
                    action: "equip",
                    revision: snapshot.revision,
                    value: encodeDiscordHeroEquipTarget(
                      inventoryFilter,
                      inventoryPage,
                      selected.index,
                    ),
                  }),
                )
                .setPlaceholder("Equip to a compatible owned Hero")
                .addOptions(
                  heroes.map((hero) =>
                    new StringSelectMenuOptionBuilder()
                      .setLabel(hero.name)
                      .setDescription(
                        `#${hero.heroKey} · ${hero.classType} · ${hero.gearType}`,
                      )
                      .setValue(String(hero.heroKey)),
                  ),
                ),
            ),
          );
        }
      }
    } else {
      if (equipmentPageCount > 1) {
        rows.push(
          boundedPageRow(
            ownerId,
            snapshot,
            "Equipment",
            equipmentPage,
            equipmentPageCount,
            encodeDiscordHeroEquipmentPage,
          ),
        );
      }
      if (equipped.length > 0) {
        rows.push(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                encodeDiscordHeroCustomId({
                  ownerId,
                  view: "inventory",
                  action: "select",
                  revision: snapshot.revision,
                  value: encodeDiscordHeroEquipmentPage(equipmentPage),
                }),
              )
              .setPlaceholder(
                `Inspect equipped gear · page ${equipmentPage + 1}/${equipmentPageCount}`,
              )
              .addOptions(
                equipped.map((entry) => {
                  const heroName = getLocalizedCatalogName(
                    indexes,
                    "heroes",
                    entry.heroKey,
                    "en-US",
                  );
                  const asset = readDiscordHeroStoredAsset(
                    indexes,
                    entry.asset,
                  );
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(
                      `${heroName} · ${entry.gearType} · ${asset.name}`.slice(
                        0,
                        100,
                      ),
                    )
                    .setDescription(
                      `#${entry.heroKey} · ${storedAssetSummary(asset)}`.slice(
                        0,
                        100,
                      ),
                    )
                    .setValue(
                      encodeDiscordHeroEquipmentSelection(
                        entry.heroKey,
                        entry.gearType,
                      ),
                    );
                }),
              ),
          ),
        );
      }
    }
    return rows;
  }
  const equipmentSelection = location.equipmentSelection;

  if (equipmentPageCount > 1) {
    rows.push(
      boundedPageRow(
        ownerId,
        snapshot,
        "Equipment",
        equipmentPage,
        equipmentPageCount,
        encodeDiscordHeroEquipmentPage,
      ),
    );
  }
  if (equipped.length > 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "inventory",
              action: "select",
              revision: snapshot.revision,
              value: encodeDiscordHeroEquipmentPage(equipmentPage),
            }),
          )
          .setPlaceholder(
            `Inspect equipped gear · page ${equipmentPage + 1}/${equipmentPageCount}`,
          )
          .addOptions(
            equipped.map((entry) => {
              const heroName = getLocalizedCatalogName(
                indexes,
                "heroes",
                entry.heroKey,
                "en-US",
              );
              const asset = readDiscordHeroStoredAsset(indexes, entry.asset);
              return new StringSelectMenuOptionBuilder()
                .setLabel(
                  `${heroName} · ${entry.gearType} · ${asset.name}`.slice(
                    0,
                    100,
                  ),
                )
                .setDescription(
                  `#${entry.heroKey} · ${storedAssetSummary(asset)}`.slice(
                    0,
                    100,
                  ),
                )
                .setValue(
                  encodeDiscordHeroEquipmentSelection(
                    entry.heroKey,
                    entry.gearType,
                  ),
                )
                .setDefault(
                  entry.heroKey === equipmentSelection.heroKey &&
                    entry.gearType === equipmentSelection.gearType,
                );
            }),
          ),
      ),
    );
  }

  const selected = equipped.find(
    (entry) =>
      entry.heroKey === equipmentSelection.heroKey &&
      entry.gearType === equipmentSelection.gearType,
  );
  if (selected === undefined) {
    throw new Error(
      `Equipped gear ${equipmentSelection.heroKey}/${equipmentSelection.gearType} is outside equipment page ${equipmentPage}`,
    );
  }
  const equipmentRow = equipped.indexOf(selected);
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "inventory",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroItemEffectsSectionTarget(
              indexes,
              equipmentPage,
              equipmentRow,
              selected.heroKey,
              selected.gearType,
            ),
          }),
        )
        .setPlaceholder("Browse source-proven Item Effects")
        .addOptions(
          [
            ["Summary", "s", "Equipped gear summary"],
            ["Base", "b", "Source base effects"],
            ["Inherent", "i", "Source inherent effects"],
            ["Rolled", "r", "Stored rolled source effects"],
          ].map(([label, value, description]) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(label!)
              .setDescription(description!)
              .setValue(value!)
              .setDefault(
                value ===
                  (location.itemEffects === undefined
                    ? "s"
                    : location.itemEffects.sourceVector === "base"
                      ? "b"
                      : location.itemEffects.sourceVector === "inherent"
                        ? "i"
                        : "r"),
              ),
          ),
        ),
    ),
  );
  if (location.itemEffects !== undefined) {
    const input = {
      indexes,
      state: snapshot.state,
      heroKey: selected.heroKey,
      instanceId: selected.asset.instanceId,
    };
    const pageInput = {
      sourceVector: location.itemEffects.sourceVector,
      page: location.itemEffects.page,
    };
    const page = discordHeroItemEffectsPage(input, pageInput);
    const safeRows = discordHeroItemEffectsTextRows(input, pageInput);
    const encodeEffectPage = (effectPage: number) =>
      encodeDiscordHeroItemEffectsPageTarget(
        indexes,
        equipmentPage,
        equipmentRow,
        selected.heroKey,
        selected.gearType,
        location.itemEffects!.sourceVector,
        effectPage,
      );
    if (page.pageCount > 1) {
      rows.push(
        boundedPageRow(
          ownerId,
          snapshot,
          "Effects",
          page.page,
          page.pageCount,
          encodeEffectPage,
        ),
      );
    }
    if (page.rows.length > 0) {
      rows.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              encodeDiscordHeroCustomId({
                ownerId,
                view: "inventory",
                action: "select",
                revision: snapshot.revision,
                value: encodeEffectPage(page.page),
              }),
            )
            .setPlaceholder(
              `Inspect ${page.sourceVector} effects · page ${page.page + 1}/${page.pageCount}`,
            )
            .addOptions(
              page.rows.map((row, index) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`Effect #${row.rowIndex}`)
                  .setDescription(safeRows[index]!.slice(0, 100))
                  .setValue(String(row.rowIndex))
                  .setDefault(row.rowIndex === location.itemEffects!.rowIndex),
              ),
            ),
        ),
      );
    }
    return rows;
  }
  const freePage = location.freeInventoryPage ?? 0;
  const freePageCount = discordHeroFreeInventoryPageCount(snapshot.state);
  const encodeFreePage = (page: number) =>
    encodeDiscordHeroUnequipTarget(
      equipmentPage,
      selected.heroKey,
      selected.gearType,
      page,
    );
  if (freePageCount > 1) {
    rows.push(
      boundedPageRow(
        ownerId,
        snapshot,
        "Free slots",
        freePage,
        freePageCount,
        encodeFreePage,
      ),
    );
  }
  const freeSlots = discordHeroFreeInventorySlots(snapshot.state, freePage);
  if (freeSlots.length > 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "inventory",
              action: "unequip",
              revision: snapshot.revision,
              value: encodeFreePage(freePage),
            }),
          )
          .setPlaceholder(
            `Choose exact free slot · page ${freePage + 1}/${freePageCount}`,
          )
          .addOptions(
            freeSlots.map((slot) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`Inventory slot ${slot}`)
                .setDescription("Free and unlocked")
                .setValue(String(slot)),
            ),
          ),
      ),
    );
  }
  return rows;
}

function cubeRecipeLabel(recipeType: string): string {
  return `${recipeType.slice(0, 1)}${recipeType.slice(1).toLowerCase()}`;
}

function cubeActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  tab: "browse" | "alchemy",
): ActionRowBuilder<ButtonBuilder>[] {
  const recipes = [...indexes.tables.cube_recipes.rows].sort(
    (left, right) => left.Index - right.Index,
  );
  const buttons = recipes.map((recipe) => {
    const quote = quoteCubeRecipeUnlock(
      indexes,
      snapshot.state,
      recipe.CubeKey,
    );
    const canUnlock = quote.kind === "available" && quote.canAfford;
    const suffix =
      quote.kind === "already-unlocked"
        ? "OPEN"
        : quote.kind === "level-locked"
          ? `Lv${quote.requiredCubeLevel}`
          : `${quote.cost}g`;
    return new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "cube",
          action: "unlock",
          revision: snapshot.revision,
          value: `${tab === "browse" ? "b" : "a"}-${recipe.CubeKey}`,
        }),
      )
      .setLabel(`${cubeRecipeLabel(recipe.RECIPETYPE)} · ${suffix}`)
      .setStyle(canUnlock ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!canUnlock);
  });
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(5)),
  ];
}

function cubeTabRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  tab: "browse" | "alchemy",
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "cube",
          action: "page",
          revision: snapshot.revision,
          value: "t-c-b",
        }),
      )
      .setLabel("Browse")
      .setStyle(tab === "browse" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab === "browse"),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "cube",
          action: "page",
          revision: snapshot.revision,
          value: "t-c-a",
        }),
      )
      .setLabel("Alchemy")
      .setStyle(tab === "alchemy" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab === "alchemy"),
  );
}

function cubeBrowserActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const pageTarget =
    location.cubePageTarget ??
    encodeDiscordHeroCubePage({ kind: "main-recipes", page: 0 });
  const page = decodeDiscordHeroCubePage(pageTarget);
  const mainPage = page.kind === "main-recipes" ? page.page : 0;
  const mainPageTarget = encodeDiscordHeroCubePage({
    kind: "main-recipes",
    page: mainPage,
  });
  const mainOptions = discordHeroCubeMainRecipeOptions(
    indexes,
    snapshot.state,
    mainPage,
  );
  let selectedCubeKey: number | null =
    page.kind === "sub-recipes" ? page.cubeKey : null;
  if (location.cubeTarget !== undefined) {
    const target = decodeDiscordHeroCubeTarget(location.cubeTarget);
    selectedCubeKey = target.cubeKey;
  }
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "cube",
            action: "select",
            revision: snapshot.revision,
            value: mainPageTarget,
          }),
        )
        .setPlaceholder("Inspect one of 8 source Cube main recipes")
        .addOptions(
          mainOptions.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setDescription(option.description)
              .setValue(option.value)
              .setDefault(option.detail.cubeKey === selectedCubeKey),
          ),
        ),
    ),
  ];
  if (page.kind !== "sub-recipes") return rows;

  const pageCount = discordHeroCubeSubRecipePageCount(indexes, page.cubeKey);
  if (pageCount > 1) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "cube",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroCubePage({
                kind: "sub-recipes",
                cubeKey: page.cubeKey,
                page: Math.max(0, page.page - 1),
              }),
            }),
          )
          .setLabel("← Sub-recipes")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === 0),
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "cube",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroCubePage({
                kind: "sub-recipes",
                cubeKey: page.cubeKey,
                page: Math.min(pageCount - 1, page.page + 1),
              }),
            }),
          )
          .setLabel("Sub-recipes →")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === pageCount - 1),
      ),
    );
  }
  const subOptions = discordHeroCubeSubRecipeOptions(
    indexes,
    snapshot.state,
    page.cubeKey,
    page.page,
  );
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "cube",
            action: "select",
            revision: snapshot.revision,
            value: pageTarget,
          }),
        )
        .setPlaceholder(
          `Inspect ${page.cubeKey} sub-recipes · page ${page.page + 1}/${pageCount}`,
        )
        .addOptions(
          subOptions.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setDescription(option.description)
              .setValue(option.value)
              .setDefault(option.value === location.cubeTarget),
          ),
        ),
    ),
  );
  return rows;
}

function alchemyActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  page: number,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (!isDiscordHeroAlchemyUnlocked(snapshot.state)) return [];
  const pageCount = discordHeroAlchemyPageCount(snapshot.state);
  const options = discordHeroAlchemyOptions(indexes, snapshot.state, page);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (pageCount > 1) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "cube",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroAlchemyPage(Math.max(0, page - 1)),
            }),
          )
          .setLabel("← Alchemy")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "cube",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroAlchemyPage(
                Math.min(pageCount - 1, page + 1),
              ),
            }),
          )
          .setLabel("Alchemy →")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pageCount - 1),
      ),
    );
  }
  if (options.length > 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "cube",
              action: "alchemy",
              revision: snapshot.revision,
              value: encodeDiscordHeroAlchemyPage(page),
            }),
          )
          .setPlaceholder(
            `Alchemy 1–9 exact items · page ${page + 1}/${pageCount}`,
          )
          .setMinValues(1)
          .setMaxValues(Math.min(9, options.length))
          .addOptions(
            options.map((option) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option.label.slice(0, 100))
                .setDescription(option.description.slice(0, 100))
                .setValue(option.value),
            ),
          ),
      ),
    );
  }
  return rows;
}

function heroActionRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  heroKey?: number,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const owned = snapshot.state.heroes.map((hero) => hero.heroKey);
  const options = discordHeroHeroes(indexes).map((hero) => {
    const name = hero.HeroNameKey_i18n["en-US"];
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`hero ${hero.HeroKey} has no English source name`);
    }
    const quote = quoteHeroUnlock(indexes, {
      heroKey: hero.HeroKey,
      gold: snapshot.state.gold,
      ownedHeroKeys: owned,
    });
    const status =
      quote.status === "owned" || quote.status === "starter"
        ? "Owned"
        : quote.status === "purchasable"
          ? `${quote.cost}g · initialization oracle required`
          : `${quote.cost}g · insufficient gold`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${hero.HeroKey} · ${name}`)
      .setDescription(`${hero.ClassType} · ${status}`.slice(0, 100))
      .setValue(String(hero.HeroKey))
      .setDefault(hero.HeroKey === heroKey);
  });
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "heroes",
          action: "select",
          revision: snapshot.revision,
        }),
      )
      .setPlaceholder("Inspect one of 6 source heroes")
      .addOptions(options),
  );
}

function heroTabRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  if (location.heroKey === undefined) {
    throw new Error("Hero tabs require a selected source Hero");
  }
  const tree = projectDiscordHeroAttributeTrees(indexes, snapshot.state).find(
    (candidate) => candidate.HeroKey === location.heroKey,
  );
  if (tree === undefined) {
    throw new Error(`Hero tabs have unknown Hero ${location.heroKey}`);
  }
  const activeTab = location.heroTab ?? "overview";
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "heroes",
          action: "page",
          revision: snapshot.revision,
          value: tree.heroTarget,
        }),
      )
      .setLabel("Overview")
      .setStyle(
        activeTab === "overview" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "overview"),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "heroes",
          action: "page",
          revision: snapshot.revision,
          value: encodeDiscordHeroAttributePage(indexes, tree.HeroKey, 0),
        }),
      )
      .setLabel("Attributes")
      .setStyle(
        activeTab === "attributes"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "attributes"),
  );
}

function attributeActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (location.heroKey === undefined) {
    throw new Error("Attribute controls require a selected source Hero");
  }
  const pageTarget =
    location.attributePageTarget ??
    encodeDiscordHeroAttributePage(indexes, location.heroKey, 0);
  const page: DiscordHeroAttributePage = discordHeroAttributePage(
    indexes,
    snapshot.state,
    pageTarget,
  );
  if (page.HeroKey !== location.heroKey) {
    throw new Error(
      `Attribute controls page Hero ${page.HeroKey} does not match selected Hero ${location.heroKey}`,
    );
  }
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (page.pageCount > 1) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "heroes",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroAttributePage(
                indexes,
                page.HeroKey,
                Math.max(0, page.page - 1),
              ),
            }),
          )
          .setLabel("← Attributes")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === 0),
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "heroes",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroAttributePage(
                indexes,
                page.HeroKey,
                Math.min(page.pageCount - 1, page.page + 1),
              ),
            }),
          )
          .setLabel("Attributes →")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === page.pageCount - 1),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "heroes",
            action: "select",
            revision: snapshot.revision,
            value: page.pageTarget,
          }),
        )
        .setPlaceholder(
          `Inspect ${page.heroName} Attributes · page ${page.page + 1}/${page.pageCount}`,
        )
        .addOptions(
          page.options.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setDescription(option.description)
              .setValue(option.target)
              .setDefault(option.target === location.attributeTarget),
          ),
        ),
    ),
  );
  if (
    location.attributeTarget !== undefined &&
    snapshot.state.heroes.some((hero) => hero.heroKey === page.HeroKey)
  ) {
    const decoded = decodeDiscordHeroAttributeTarget(
      indexes,
      location.attributeTarget,
    );
    if (
      decoded.heroKey !== page.HeroKey ||
      decoded.page !== page.page ||
      !page.options.some((option) => option.target === location.attributeTarget)
    ) {
      throw new Error(
        "Attribute allocation target is outside the selected Hero and page",
      );
    }
    const quote = quoteAttributeAllocation(
      indexes,
      snapshot.state,
      decoded.heroKey,
      decoded.attributeKey,
    );
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "heroes",
              action: "upgrade",
              revision: snapshot.revision,
              value: location.attributeTarget,
            }),
          )
          .setLabel(
            `Allocate +1 · ${quote.requiredPoint} ${quote.requiredPoint === 1 ? "point" : "points"}`,
          )
          .setStyle(
            quote.kind === "available"
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setDisabled(quote.kind !== "available"),
      ),
    );
  }
  return rows;
}

function runeStatusDescription(
  quote: ReturnType<typeof quoteRuneUpgrade>,
  maximumLevel: number,
): string {
  switch (quote.kind) {
    case "available":
      return `Lv${quote.currentLevel}→${quote.nextLevel}/${maximumLevel} · ${quote.cost.toLocaleString("en-US")}g${quote.canAfford ? "" : " · insufficient gold"}`;
    case "maximum-level":
      return `Lv${quote.level} · source maximum`;
    case "unsupported-effect":
      return `Lv${quote.currentLevel}→${quote.nextLevel}/${maximumLevel} · ${quote.statType} · oracle-gated`;
    case "prerequisite-locked":
      return `Lv${quote.currentLevel} · requires ${quote.predecessorKeys.map((key) => `#${key}`).join(" or ")} Lv${quote.requiredLevel}`;
  }
}

function runeTabRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const activeTab = location.runeTab ?? "runes";
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "runes",
          action: "page",
          revision: snapshot.revision,
          value: `t-${encodeDiscordHeroRunePage(location.runePage ?? 0)}`,
        }),
      )
      .setLabel("Runes")
      .setStyle(
        activeTab === "runes" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "runes"),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "runes",
          action: "page",
          revision: snapshot.revision,
          value: `t-${encodeDiscordHeroSkillPage(location.skillPage ?? 0)}`,
        }),
      )
      .setLabel("Skills")
      .setStyle(
        activeTab === "skills" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "skills"),
  );
}

function runeActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const page = location.runePage ?? 0;
  const pageCount = discordHeroRunePageCount(indexes);
  const rows = discordHeroRunes(indexes, page);
  const options = rows.map((rune) => {
    const quote = quoteRuneUpgrade(indexes, snapshot.state, rune.RuneKey);
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${rune.RuneKey} · ${quote.name}`.slice(0, 100))
      .setDescription(runeStatusDescription(quote, rune.MaxLevel).slice(0, 100))
      .setValue(String(rune.RuneKey));
  });
  return [
    runeTabRow(ownerId, snapshot, location),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroRunePage(Math.max(0, page - 1)),
          }),
        )
        .setLabel("← Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroRunePage(Math.min(pageCount - 1, page + 1)),
          }),
        )
        .setLabel("Next →")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === pageCount - 1),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "upgrade",
            revision: snapshot.revision,
            value: encodeDiscordHeroRunePage(page),
          }),
        )
        .setPlaceholder(`Upgrade a Rune · page ${page + 1}/${pageCount}`)
        .addOptions(options),
    ),
  ];
}

function skillActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const page = location.skillPage ?? 0;
  const pageCount = discordHeroSkillPageCount(indexes);
  const skills = discordHeroSkills(indexes, page);
  return [
    runeTabRow(ownerId, snapshot, location),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroSkillPage(Math.max(0, page - 1)),
          }),
        )
        .setLabel("← Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroSkillPage(
              Math.min(pageCount - 1, page + 1),
            ),
          }),
        )
        .setLabel("Next →")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === pageCount - 1),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "runes",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroSkillPage(page),
          }),
        )
        .setPlaceholder(`Inspect a Skill · page ${page + 1}/${pageCount}`)
        .addOptions(
          skills.map((skill) => {
            const rowIndex = indexes.tables.skills.rows.indexOf(skill);
            const detail = readDiscordHeroSkill(
              indexes,
              encodeDiscordHeroSkillTarget(rowIndex),
            );
            return new StringSelectMenuOptionBuilder()
              .setLabel(
                `${JSON.stringify(detail.sourceKey)} · ${detail.name}`.slice(
                  0,
                  100,
                ),
              )
              .setDescription(
                `${detail.activationType} · ${detail.slotType} · ${detail.damageType}`.slice(
                  0,
                  100,
                ),
              )
              .setValue(encodeDiscordHeroSkillTarget(rowIndex))
              .setDefault(rowIndex === location.skillRowIndex);
          }),
        ),
    ),
  ];
}

function worldActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  page: number,
  stageKey?: number,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const pageCount = discordHeroStagePageCount(indexes);
  const stages = discordHeroStages(indexes, page);
  const options = stages.map((stage) => {
    const name = stage.StageNameKey_i18n["en-US"];
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`stage ${stage.StageKey} has no English source name`);
    }
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${stage.StageKey} · ${name}`.slice(0, 100))
      .setDescription(
        `Act ${stage.Act} · ${stage.STAGEDIFFICULITY} · source Lv${stage.StageLevel}`.slice(
          0,
          100,
        ),
      )
      .setValue(String(stage.StageKey))
      .setDefault(stage.StageKey === stageKey);
  });
  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "world",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroStagePage(Math.max(0, page - 1)),
          }),
        )
        .setLabel("← Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "world",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroStagePage(
              Math.min(pageCount - 1, page + 1),
            ),
          }),
        )
        .setLabel("Next →")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === pageCount - 1),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "world",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroStagePage(page),
          }),
        )
        .setPlaceholder(`Inspect a stage · page ${page + 1}/${pageCount}`)
        .addOptions(options),
    ),
  ];
}

function codexActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroCodexLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const datasetPages = Array.from(
    { length: discordHeroCodexDatasetPageCount() },
    (_, datasetPage) => {
      const datasets = discordHeroCodexDatasets(datasetPage);
      const first = datasetPage * 25 + 1;
      const last = first + datasets.length - 1;
      return new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCodexDatasetPage(datasetPage),
          }),
        )
        .setLabel(`Datasets ${first}–${last}`)
        .setStyle(
          datasetPage === location.datasetPage
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary,
        )
        .setDisabled(datasetPage === location.datasetPage);
    },
  );
  const datasetOptions = discordHeroCodexDatasets(location.datasetPage).map(
    (datasetName) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(datasetName)
        .setDescription(
          `${indexes.tables[datasetName].rows.length.toLocaleString("en-US")} exact rows`,
        )
        .setValue(datasetName)
        .setDefault(datasetName === location.datasetName),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      datasetPages,
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroCodexDatasetPage(location.datasetPage),
          }),
        )
        .setPlaceholder("Choose a source dataset")
        .addOptions(datasetOptions),
    ),
  ];
  if (location.datasetName === null) {
    return rows;
  }

  const record = readDiscordHeroCodexRecord(
    indexes,
    location.datasetName,
    location.rowIndex,
  );
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCodexRowPage(
              "previous",
              location.datasetName,
              Math.max(0, location.rowIndex - 1),
            ),
          }),
        )
        .setLabel("← Previous row")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(location.rowIndex === 0),
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCodexRowPage(
              "next",
              location.datasetName,
              Math.min(record.rowCount - 1, location.rowIndex + 1),
            ),
          }),
        )
        .setLabel("Next row →")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(location.rowIndex === record.rowCount - 1),
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "export",
            revision: snapshot.revision,
            value: encodeDiscordHeroCodexRecordTarget(
              location.datasetName,
              location.rowIndex,
            ),
          }),
        )
        .setLabel("Download exact JSON")
        .setStyle(ButtonStyle.Primary),
    ),
  );
  return rows;
}

const COMMUNITY_CATEGORY_LABELS = {
  builds: "Builds",
  "tier-lists": "Tier Lists",
  guides: "Guides",
  news: "News",
} as const satisfies Record<DiscordHeroCommunityContentCategory, string>;

function codexTabActionRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  activeTab: "source-data" | "community",
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "codex",
          action: "page",
          revision: snapshot.revision,
          value: "st",
        }),
      )
      .setLabel("Source Data")
      .setStyle(
        activeTab === "source-data"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "source-data"),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "codex",
          action: "page",
          revision: snapshot.revision,
          value: "ct",
        }),
      )
      .setLabel("Community")
      .setStyle(
        activeTab === "community" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "community"),
  );
}

function communityContentActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  content: LoadedDiscordHeroCommunityContent,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const category = location.communityCategory ?? "builds";
  const listPage = location.communityListPage ?? 0;
  const page = discordHeroCommunityContentPage(content, category, listPage);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      DISCORD_HERO_COMMUNITY_CATEGORIES.map((candidate) =>
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "codex",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroCommunityListPage(
                content,
                candidate,
                candidate === category ? listPage : 0,
              ),
            }),
          )
          .setLabel(COMMUNITY_CATEGORY_LABELS[candidate])
          .setStyle(
            candidate === category
              ? ButtonStyle.Primary
              : ButtonStyle.Secondary,
          )
          .setDisabled(candidate === category),
      ),
    ),
  ];
  const paginationButtons: ButtonBuilder[] = [];
  if (listPage > 0) {
    paginationButtons.push(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCommunityListPage(
              content,
              category,
              listPage - 1,
            ),
          }),
        )
        .setLabel("← Previous page")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (listPage < page.pageCount - 1) {
    paginationButtons.push(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCommunityListPage(
              content,
              category,
              listPage + 1,
            ),
          }),
        )
        .setLabel("Next page →")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (paginationButtons.length > 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        paginationButtons,
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroCommunityListPage(
              content,
              category,
              listPage,
            ),
          }),
        )
        .setPlaceholder(
          `Choose a document · page ${listPage + 1}/${page.pageCount}`,
        )
        .addOptions(
          page.options.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setDescription(option.description)
              .setValue(option.value)
              .setDefault(
                option.documentIndex === location.communityDocumentIndex,
              ),
          ),
        ),
    ),
  );
  if (location.communityDocumentIndex === undefined) {
    return rows;
  }
  const detail = readDiscordHeroCommunityContentDocument(
    content,
    category,
    listPage,
    location.communityDocumentIndex,
    location.communityChunkPage ?? 0,
  );
  const documentButtons: ButtonBuilder[] = [];
  if (detail.chunkPage > 0) {
    documentButtons.push(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCommunityChunkTarget(
              content,
              category,
              listPage,
              detail.documentIndex,
              detail.chunkPage - 1,
            ),
          }),
        )
        .setLabel("← Previous chunk")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (detail.chunkPage < detail.chunkCount - 1) {
    documentButtons.push(
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "codex",
            action: "page",
            revision: snapshot.revision,
            value: encodeDiscordHeroCommunityChunkTarget(
              content,
              category,
              listPage,
              detail.documentIndex,
              detail.chunkPage + 1,
            ),
          }),
        )
        .setLabel("Next chunk →")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  documentButtons.push(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "codex",
          action: "export",
          revision: snapshot.revision,
          value: encodeDiscordHeroCommunityChunkTarget(
            content,
            category,
            listPage,
            detail.documentIndex,
            detail.chunkPage,
          ),
        }),
      )
      .setLabel("Download exact Markdown")
      .setStyle(ButtonStyle.Primary),
  );
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      documentButtons,
    ),
  );
  return rows;
}

function communityContentBodySections(
  content: LoadedDiscordHeroCommunityContent,
  location: DiscordHeroWorkspaceLocation,
): string[] {
  const category = location.communityCategory ?? "builds";
  const listPage = location.communityListPage ?? 0;
  const page = discordHeroCommunityContentPage(content, category, listPage);
  if (location.communityDocumentIndex === undefined) {
    const counts = content.provenance.categoryCounts[category];
    return [
      [
        "## 📖 Codex · Community",
        `**${COMMUNITY_CATEGORY_LABELS[category]} · Page ${listPage + 1}/${page.pageCount}**`,
        `${counts.total} documents · ${counts.details} details · ${page.reconciliation.linkedDetails.length} linked · ${page.reconciliation.unlistedDetails.length} unlisted · ${page.reconciliation.reverseLinkedDetails.length} reverse-linked`,
        `Landing: ${page.reconciliation.landingPath} · Reverse mode: ${page.reconciliation.reverseLinkMode}`,
        `Policy: ${content.contentPolicy.classification} · gameplayAuthority: ${String(content.contentPolicy.gameplayAuthority)}`,
        `Capture: ${content.provenance.scrapedAtMin} → ${content.provenance.scrapedAtMax}`,
        `Source: ${content.provenance.sourceRoot} · ${content.provenance.sourceFiles} files`,
        `Source SHA-256: ${content.provenance.sourceAggregateSha256}`,
        `Compiled SHA-256: ${content.provenance.compiledSha256}`,
        "This is an approved time-stamped community snapshot, not gameplay authority.",
      ].join("\n"),
    ];
  }
  const detail = readDiscordHeroCommunityContentDocument(
    content,
    category,
    listPage,
    location.communityDocumentIndex,
    location.communityChunkPage ?? 0,
  );
  return [
    [
      "## 📖 Codex · Community",
      `**${detail.document.frontmatter.title}**`,
      `${detail.document.path} · ${detail.document.kind} · ${COMMUNITY_CATEGORY_LABELS[category]}`,
      `Chunk ${detail.chunkPage + 1}/${detail.chunkCount} · List page ${listPage + 1}/${page.pageCount}`,
      `Document SHA-256: ${detail.document.sha256}`,
      `Policy: ${content.contentPolicy.classification} · gameplayAuthority: ${String(content.contentPolicy.gameplayAuthority)}`,
      `Capture: ${detail.document.frontmatter.scraped_at}`,
      `Source aggregate SHA-256: ${content.provenance.sourceAggregateSha256}`,
      `Frontmatter: ${JSON.stringify(detail.document.frontmatter)}`,
    ].join("\n"),
    detail.chunk,
  ];
}

function collectionBody(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  achievements: LoadedDiscordHeroCommunityAchievements,
  location: DiscordHeroWorkspaceLocation,
): string {
  const tab = location.collectionTab ?? "pets";
  if (tab === "achievements") {
    const page = discordHeroAchievementPage(
      achievements,
      location.achievementPage ?? 0,
    );
    if (location.achievementRowIndex !== undefined) {
      const detail = readDiscordHeroAchievementDetail(
        achievements,
        location.achievementRowIndex,
      );
      return [
        "## 📚 Collection · Achievements",
        `**${detail.title}** · row ${detail.rowIndex + 1}/${page.totalAchievements} · ${detail.rate}`,
        detail.description,
        `Captured: ${detail.provenance.capturedAt}`,
        `Source: ${detail.provenance.sourceUrl}`,
        `Format: ${detail.provenance.exportFormat} · SHA-256: ${detail.provenance.sourceSha256}`,
        `Achievements · Page ${page.page + 1}/${page.pageCount}`,
      ].join("\n");
    }
    return [
      "## 📚 Collection · Achievements",
      `${page.summary} · Achievements · Page ${page.page + 1}/${page.pageCount}`,
      page.footer,
      `Captured: ${page.provenance.capturedAt}`,
      `Source: ${page.provenance.sourceUrl}`,
    ].join("\n");
  }

  const page = location.collectionPage ?? 0;
  const pageCount = discordHeroCollectionPageCount(indexes, tab);
  if (location.collectionKey !== undefined) {
    if (tab === "pets") {
      const pet = readDiscordHeroPet(indexes, location.collectionKey);
      const owned = snapshot.state.pets.unlocked.includes(pet.key);
      const active = snapshot.state.pets.active === pet.key;
      return [
        "## 📚 Collection · Pets",
        `**${pet.name}** · #${pet.key} · ${owned ? "Owned" : "Locked"} · ${active ? "Active" : "Inactive"}`,
        pet.description,
        `${pet.unlockCondition} · ${pet.unlockParam1} · ${pet.unlockParam2 ?? "null"}`,
        ...pet.stats.map(
          (stat) => `${stat.statType} · ${stat.modType} · ${stat.value}`,
        ),
        `Pets · Page ${page + 1}/${pageCount}`,
      ].join("\n");
    }
    const skin = readDiscordHeroSkin(indexes, location.collectionKey);
    const owned = snapshot.state.skins.unlocked.includes(skin.key);
    return [
      "## 📚 Collection · Skins",
      `Skin #${skin.key} · ${owned ? "Owned" : "Locked"}`,
      `${skin.partsCategory} · ${skin.decorableType} · Cost ${skin.cost}`,
      `Groups: ${JSON.stringify(skin.groupKeys)} · Upper layer: ${JSON.stringify(skin.hasUpperLayer)}`,
      `Default unlocked: ${skin.defaultUnlocked}`,
      `Icon: ${skin.iconPath}`,
      `Skins · Page ${page + 1}/${pageCount}`,
    ].join("\n");
  }

  return [
    `## 📚 Collection · ${tab === "pets" ? "Pets" : "Skins"}`,
    tab === "pets"
      ? `Owned ${snapshot.state.pets.unlocked.length}/8 · Active ${snapshot.state.pets.active ?? "—"}`
      : `Owned ${snapshot.state.skins.unlocked.length}/100`,
    `${tab === "pets" ? "Pets" : "Skins"} · Page ${page + 1}/${pageCount}`,
    "Inspect one exact source entry below.",
  ].join("\n");
}

function collectionTabRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const active = location.collectionTab ?? "pets";
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    ...(
      [
        ["pets", "Pets", "t-c-p"],
        ["skins", "Skins", "t-c-s"],
        ["achievements", "Achievements", "t-c-a"],
      ] as const
    ).map(([tab, label, value]) =>
      new ButtonBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "collection",
            action: "page",
            revision: snapshot.revision,
            value,
          }),
        )
        .setLabel(label)
        .setStyle(active === tab ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(active === tab),
    ),
  );
}

function collectionPageRow(
  ownerId: string,
  snapshot: PlayerSnapshot,
  page: number,
  pageCount: number,
  encodePage: (page: number) => string,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "collection",
          action: "page",
          revision: snapshot.revision,
          value: encodePage(Math.max(0, page - 1)),
        }),
      )
      .setLabel("← Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "collection",
          action: "page",
          revision: snapshot.revision,
          value: encodePage(Math.min(pageCount - 1, page + 1)),
        }),
      )
      .setLabel("Next →")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === pageCount - 1),
  );
}

function collectionActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  achievements: LoadedDiscordHeroCommunityAchievements,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows = [collectionTabRow(ownerId, snapshot, location)];
  const tab = location.collectionTab ?? "pets";
  if (tab === "achievements") {
    const page = discordHeroAchievementPage(
      achievements,
      location.achievementPage ?? 0,
    );
    if (page.pageCount > 1) {
      rows.push(
        collectionPageRow(
          ownerId,
          snapshot,
          page.page,
          page.pageCount,
          (targetPage) =>
            encodeDiscordHeroAchievementPage(achievements, targetPage),
        ),
      );
    }
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "collection",
              action: "select",
              revision: snapshot.revision,
              value: page.pageTarget,
            }),
          )
          .setPlaceholder(
            `Inspect an Achievement · page ${page.page + 1}/${page.pageCount}`,
          )
          .addOptions(
            page.achievements.map((achievement) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(achievement.title.slice(0, 100))
                .setDescription(
                  `${achievement.rate} · captured ${page.provenance.capturedAt}`.slice(
                    0,
                    100,
                  ),
                )
                .setValue(achievement.target)
                .setDefault(
                  achievement.rowIndex === location.achievementRowIndex,
                ),
            ),
          ),
      ),
    );
    return rows;
  }

  const kind = tab satisfies DiscordHeroCollectionKind;
  const page = location.collectionPage ?? 0;
  const pageCount = discordHeroCollectionPageCount(indexes, kind);
  if (pageCount > 1) {
    rows.push(
      collectionPageRow(ownerId, snapshot, page, pageCount, (targetPage) =>
        encodeDiscordHeroCollectionPage(kind, targetPage),
      ),
    );
  }
  const options =
    kind === "pets"
      ? discordHeroCollectionRows(indexes, "pets", page).map((sourceRow) => {
          const pet = readDiscordHeroPet(indexes, sourceRow.PetKey);
          const owned = snapshot.state.pets.unlocked.includes(pet.key);
          const active = snapshot.state.pets.active === pet.key;
          return new StringSelectMenuOptionBuilder()
            .setLabel(`#${pet.key} · ${pet.name}`.slice(0, 100))
            .setDescription(
              `${owned ? "Owned" : "Locked"} · ${active ? "Active" : "Inactive"} · ${pet.unlockCondition}`.slice(
                0,
                100,
              ),
            )
            .setValue(String(pet.key))
            .setDefault(pet.key === location.collectionKey);
        })
      : discordHeroCollectionRows(indexes, "skins", page).map((sourceRow) => {
          const skin = readDiscordHeroSkin(indexes, sourceRow.PcSkinKey);
          const owned = snapshot.state.skins.unlocked.includes(skin.key);
          return new StringSelectMenuOptionBuilder()
            .setLabel(
              `#${skin.key} · ${skin.partsCategory}/${skin.decorableType}`.slice(
                0,
                100,
              ),
            )
            .setDescription(
              `${owned ? "Owned" : "Locked"} · ${skin.defaultUnlocked ? "Default" : `Cost ${skin.cost}`}`.slice(
                0,
                100,
              ),
            )
            .setValue(String(skin.key))
            .setDefault(skin.key === location.collectionKey);
        });
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "collection",
            action: "select",
            revision: snapshot.revision,
            value: encodeDiscordHeroCollectionPage(kind, page),
          }),
        )
        .setPlaceholder(
          `Inspect ${kind === "pets" ? "a Pet" : "a Skin"} · page ${page + 1}/${pageCount}`,
        )
        .addOptions(options),
    ),
  );
  return rows;
}

function marketActionRows(
  ownerId: string,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  market: LoadedDiscordHeroCommunityMarket,
  location: DiscordHeroWorkspaceLocation,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const page = marketPageForLocation(market, indexes, location);
  const tabs = (
    [
      ["all", "All"],
      ["confirmed", "Confirmed"],
      ["unconfirmed", "Unconfirmed"],
    ] as const
  ).map(([kind, label]) =>
    new ButtonBuilder()
      .setCustomId(
        encodeDiscordHeroCustomId({
          ownerId,
          view: "market",
          action: "page",
          revision: snapshot.revision,
          value: encodeDiscordHeroMarketKind(market, indexes, kind),
        }),
      )
      .setLabel(label)
      .setStyle(
        page.kind === kind ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(page.kind === kind),
  );
  const options = page.options.map((option) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(option.label)
      .setDescription(option.description)
      .setValue(option.value)
      .setDefault(option.value === location.marketTarget),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...tabs,
    ),
  ];
  if (page.pageCount > 1) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "market",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroMarketPage(
                market,
                indexes,
                page.kind,
                Math.max(0, page.page - 1),
              ),
            }),
          )
          .setLabel("← Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === 0),
        new ButtonBuilder()
          .setCustomId(
            encodeDiscordHeroCustomId({
              ownerId,
              view: "market",
              action: "page",
              revision: snapshot.revision,
              value: encodeDiscordHeroMarketPage(
                market,
                indexes,
                page.kind,
                Math.min(page.pageCount - 1, page.page + 1),
              ),
            }),
          )
          .setLabel("Next →")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page.page === page.pageCount - 1),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "market",
            action: "select",
            revision: snapshot.revision,
            value: page.pageTarget,
          }),
        )
        .setPlaceholder(
          `Inspect a captured listing · page ${page.page + 1}/${page.pageCount}`,
        )
        .addOptions(options),
    ),
  );
  return rows;
}

function homeAlertLine(alert: DiscordHeroHomeAlert): string {
  switch (alert.kind) {
    case "empty-party-slots":
      return `Alert: Empty party slots ${alert.slots.join(", ")}`;
    case "inventory-full":
      return `Alert: Inventory full ${alert.occupiedSlots}/${alert.unlockedSlots}`;
    case "cube-unlock-available":
      return `Alert: ${cubeRecipeLabel(alert.recipeType)} #${alert.cubeKey} unlock available · Cube Lv${alert.requiredCubeLevel} · ${alert.cost}g`;
    case "unresolved-stage-source":
      return `Alert: Stage #${alert.stageKey} has unresolved source monsters ${alert.missingMonsterKeys.join(", ")}`;
  }
}

function homeProgressionLine(
  progression: DiscordHeroHomeHero["progression"],
): string {
  if (progression.status === "max-level") {
    return `Lv${progression.level} · XP ${progression.experience.toLocaleString("en-US")} / ${progression.terminalBarExperience.toLocaleString("en-US")} terminal · ${progression.progressPercent}% · Max level`;
  }
  return `Lv${progression.level} · XP ${progression.experience.toLocaleString("en-US")} / ${progression.experienceForLevelUp.toLocaleString("en-US")} · ${progression.experienceRemaining.toLocaleString("en-US")} XP to Lv${progression.nextLevel} · ${progression.progressPercent}%`;
}

function heroStatPreviewLine(preview: DiscordHeroStatPreview): string {
  const prefix = `${preview.label} [Base, Attribute] · ${preview.units}:`;
  if (preview.projectedStats === null) {
    return `${prefix} Unowned`;
  }
  return `${prefix} ${preview.projectedStats
    .map(({ statType, projectedRaw }) => `${statType} ${projectedRaw}`)
    .join(" · ")}`;
}

function heroBaseCombatLine(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
): string {
  const unit = projectDiscordHeroBaseCombatUnits(indexes).find(
    (candidate) => candidate.heroKey === heroKey,
  );
  if (unit === undefined) {
    throw new Error(
      `base combat projection has unknown source Hero ${heroKey}`,
    );
  }
  const displayDps = roundDiscordHeroBaseAttackDpsForDisplay(
    unit.baseAttackDps,
  ).toFixed(2);
  return (
    `Base-only canonical combat units: attackDamage ${unit.attackDamage}` +
    ` · attackSpeedPerSecond ${unit.attackSpeedPerSecond}` +
    ` · castSpeedMultiplier ${unit.castSpeedMultiplier}` +
    ` · criticalChanceRatio ${unit.criticalChanceRatio}` +
    ` · criticalDamageMultiplier ${unit.criticalDamageMultiplier}` +
    ` · baseAttackDps exact ${unit.baseAttackDps}` +
    ` · baseAttackDpsDisplay2dp ${displayDps}`
  );
}

function homeBody(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
): string {
  const home = projectDiscordHeroHome(snapshot, indexes);
  const statPreviews = new Map(
    home.heroes.map((hero) => [
      hero.heroKey,
      projectDiscordHeroStatPreview(indexes, snapshot.state, hero.heroKey),
    ]),
  );
  const campaign =
    home.campaign.status === "not-started"
      ? `Not started · ${home.campaign.recordedStageCount} recorded stages`
      : `${home.campaign.highestStage.name} (#${home.campaign.highestStage.stageKey}) · Source Lv${home.campaign.highestStage.sourceLevel} · ${home.campaign.highestStage.clearCount} clears · First clear ${home.campaign.highestStage.firstClearClaimed ? "claimed" : "unclaimed"} · Best ${home.campaign.highestStage.bestClearMs === null ? "—" : `${home.campaign.highestStage.bestClearMs}ms`} · ${home.campaign.recordedStageCount} recorded stages`;
  const session =
    home.stageSession.status === "idle"
      ? "Idle"
      : `Active: ${home.stageSession.name} (#${home.stageSession.stageKey}) · Wave ${home.stageSession.wave} · Pending items ${home.stageSession.pendingItemCount} · Started ${home.stageSession.startedAtMs} · Advanced ${home.stageSession.advancedThroughMs} · RNG cursor ${home.stageSession.rngCursor}`;
  const offlineStatus =
    home.offline.status === "locked" ? "Locked" : "Runtime oracle required";
  return [
    "## 🛡️ DiscordHero",
    `**Gold:** ${home.gold.toLocaleString("en-US")} · **Revision:** ${home.revision}`,
    "",
    "### Heroes",
    ...home.heroes.flatMap((hero) => [
      `- ${hero.name} (#${hero.heroKey}) · ${hero.classType} · ${homeProgressionLine(hero.progression)}`,
      `  ${heroStatPreviewLine(statPreviews.get(hero.heroKey)!)}`,
    ]),
    "",
    "### Party",
    ...home.party.map((slot) =>
      slot.status === "empty"
        ? `- Slot ${slot.slot}: Empty`
        : `- Slot ${slot.slot}: ${slot.hero.name} (#${slot.hero.heroKey}) · ${homeProgressionLine(slot.hero.progression)}`,
    ),
    "",
    `**Inventory:** ${home.inventory.occupiedSlots}/${home.inventory.unlockedSlots} occupied · ${home.inventory.freeSlots} free`,
    `**Campaign:** ${campaign}`,
    `**Session:** ${session}`,
    `**Offline:** ${offlineStatus} · credited ${home.offline.creditedGold} gold / ${home.offline.creditedExperience} XP`,
    `Offline source facts: cursor ${home.offline.accrualCursorMs} · reward stage Lv${home.offline.rewardStageLevel} · gold +${home.offline.goldBonusPerThousand}/1000 · XP +${home.offline.experienceBonusPerThousand}/1000`,
    "",
    "### Alerts",
    ...(home.alerts.length === 0
      ? ["- None"]
      : home.alerts.map((alert) => `- ${homeAlertLine(alert)}`)),
  ].join("\n");
}

function attributeBody(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): string {
  if (location.heroKey === undefined) {
    throw new Error("Attribute view requires a selected source Hero");
  }
  const tree = projectDiscordHeroAttributeTrees(indexes, snapshot.state).find(
    (candidate) => candidate.HeroKey === location.heroKey,
  );
  if (tree === undefined) {
    throw new Error(
      `Attribute view has unknown source Hero ${location.heroKey}`,
    );
  }
  const pageTarget =
    location.attributePageTarget ??
    encodeDiscordHeroAttributePage(indexes, tree.HeroKey, 0);
  const page = discordHeroAttributePage(indexes, snapshot.state, pageTarget);
  if (page.HeroKey !== tree.HeroKey) {
    throw new Error(
      `Attribute page Hero ${page.HeroKey} does not match selected Hero ${tree.HeroKey}`,
    );
  }
  let detail: DiscordHeroAttributeNode | null = null;
  if (location.attributeTarget !== undefined) {
    const decoded = decodeDiscordHeroAttributeTarget(
      indexes,
      location.attributeTarget,
    );
    if (
      decoded.heroKey !== page.HeroKey ||
      decoded.page !== page.page ||
      !page.options.some((option) => option.target === location.attributeTarget)
    ) {
      throw new Error("Attribute target is outside the selected Hero and page");
    }
    detail = readDiscordHeroAttributeDetail(
      indexes,
      snapshot.state,
      location.attributeTarget,
    );
  }
  const quote =
    detail !== null && tree.owned
      ? quoteAttributeAllocation(
          indexes,
          snapshot.state,
          tree.HeroKey,
          detail.AttributeKey,
        )
      : null;
  const allocationStatus =
    detail === null
      ? null
      : !tree.owned
        ? "Hero not owned"
        : attributeAllocationStatus(quote!);
  return [
    "## 🧬 Hero Attributes",
    `**${tree.heroName} Attributes · Page ${page.page + 1}/${page.pageCount}**`,
    `Hero #${tree.HeroKey} · ${tree.owned ? `Owned Lv${tree.heroLevel}` : "Locked"} · ${tree.groups.reduce((total, group) => total + group.nodes.length, 0)} exact nodes · ${tree.groups.length} source groups`,
    ...tree.groups.map(
      (group) =>
        `- Group #${group.AttributeGroupKey} · Requires ${group.RequiredAllocatedPoint} · ${group.nodes.length} nodes`,
    ),
    ...(detail === null
      ? [
          "",
          "Select one exact source Attribute below to inspect its point cost and allocation status.",
        ]
      : [
          "",
          `### Attribute #${detail.AttributeKey} · Group #${detail.GroupKey}`,
          `Type ${detail.ATTRIBUTETYPE} · Source value ${detail.Value} · Required points ${detail.RequiredPoint} · Demo ${detail.AvailableDemo}`,
          ...allocatedAttributeEffectLines(detail),
          ...(quote === null
            ? ["Point budget: unavailable · Hero not owned"]
            : [
                `Point budget: ${quote.spentPoints}/${quote.pointBudget} spent · ${quote.remainingPoints} remaining`,
              ]),
          `Required +1: ${detail.RequiredPoint} ${detail.RequiredPoint === 1 ? "point" : "points"} · Group threshold ${
            tree.groups.find(
              (group) => group.AttributeGroupKey === detail.GroupKey,
            )!.RequiredAllocatedPoint
          }`,
          `Allocation status: ${allocationStatus}`,
          `Exact source relation: ${JSON.stringify(detail.relation.source)}`,
        ]),
  ].join("\n");
}

function allocatedAttributeEffectLines(
  detail: DiscordHeroAttributeNode,
): readonly string[] {
  const projection = detail.effect;
  const allocatedLevel =
    projection.allocatedLevel === null
      ? "unavailable"
      : `${projection.allocatedLevel} / ${projection.maximumLevel}`;
  const effect = projection.effect;
  if (effect.kind === "passive-stat") {
    const rawTotal = effect.rawTotal ?? "unavailable";
    const unit =
      effect.modifierType === "ADDITIVE"
        ? `additive factor ${effect.additiveFactor ?? "unavailable"}`
        : "flat internal units";
    return [
      `Allocated level: ${allocatedLevel}`,
      `Allocated effect source: ${projection.source}`,
      `Allocated passive effect: #${effect.passiveSkillKey} · ${effect.statType} · ${effect.modifierType} · raw ${effect.rawValue}/level · raw total ${rawTotal} · ${unit}`,
    ];
  }

  const exactRow =
    effect.levelRow === null
      ? projection.allocatedLevel === null
        ? "exact source row unavailable · Hero not owned"
        : "exact source row unavailable at level 0"
      : `exact source row SkillLevelKey ${effect.levelRow.SkillLevelKey} · Level ${effect.levelRow.Level} · Value ${effect.levelRow.Value}`;
  return [
    `Allocated level: ${allocatedLevel}`,
    `Allocated effect source: ${projection.source}`,
    `Allocated active effect: Skill #${effect.skillKey} · ${exactRow}`,
  ];
}

function attributeAllocationStatus(quote: AttributeAllocationQuote): string {
  switch (quote.kind) {
    case "available":
      return "Available +1";
    case "maximum-level":
      return "Source maximum reached";
    case "group-locked":
      return `Group locked · spend ${
        quote.groupRequiredAllocatedPoint - quote.spentPoints
      } more points`;
    case "insufficient-points":
      return `Insufficient points · need ${quote.requiredPoint}, have ${quote.remainingPoints}`;
  }
}

function cubeQuoteLine(detail: DiscordHeroCubeMainRecipeDetail): string {
  switch (detail.unlockQuote.kind) {
    case "already-unlocked":
      return "Quote: Already unlocked";
    case "level-locked":
      return `Quote: Level locked · Cube Lv${detail.unlockQuote.currentCubeLevel}/${detail.unlockQuote.requiredCubeLevel}`;
    case "available":
      return `Quote: Available · Cube Lv${detail.unlockQuote.requiredCubeLevel} · ${detail.unlockQuote.cost}g · ${detail.unlockQuote.canAfford ? "Affordable" : "Insufficient gold"} · Defaults ${detail.unlockQuote.defaultSubRecipeKeys.join(", ")}`;
  }
}

function cubeMainDetailLines(
  detail: DiscordHeroCubeMainRecipeDetail,
): string[] {
  return [
    `### Main #${detail.cubeKey} · ${detail.recipeType} · Index ${detail.index}`,
    `Status: ${detail.unlocked ? "Unlocked" : "Locked"} · Default ${String(detail.isDefaultUnlocked)} · ${detail.subRecipeCount} sub-recipes`,
    cubeQuoteLine(detail),
    `Exact source description: ${JSON.stringify(detail.description)}`,
  ];
}

function cubeSubDetailLines(detail: DiscordHeroCubeSubRecipeDetail): string[] {
  return [
    `### Sub #${detail.cubeSubRecipeKey} · ${detail.name}`,
    `Main #${detail.cubeKey} · ${detail.recipeType} · ${detail.unlocked ? "Unlocked" : "Locked"}`,
    `Tier ${detail.recipeTier ?? "—"} · Default with main ${String(detail.defaultUnlockWhenMainRecipeOpen)} · Unlock Cube Lv${detail.unlockCubeLevel} · Cost ${detail.unlockCost === null ? "null" : `${detail.unlockCost}g`}`,
    `Exact source description: ${JSON.stringify(detail.description)}`,
  ];
}

function cubeBody(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): string {
  const state = snapshot.state;
  const tab = location.cubeTab ?? "browse";
  const lines = [
    "## 🧊 Cube",
    `Level ${state.cube.level} · EXP ${state.cube.xp.toLocaleString("en-US")}`,
    `Unlocked operations: ${state.cube.unlockedRecipes.length}/8`,
  ];
  if (tab === "alchemy") {
    lines.push(
      isDiscordHeroAlchemyUnlocked(state)
        ? `Alchemy · Page ${(location.alchemyPage ?? 0) + 1}/${discordHeroAlchemyPageCount(state)} · select 1–9 exact occupied Inventory slots`
        : "Alchemy recipe is locked. Browse and unlock its exact source main recipe below.",
    );
    return lines.join("\n");
  }

  const pageTarget =
    location.cubePageTarget ??
    encodeDiscordHeroCubePage({ kind: "main-recipes", page: 0 });
  const page = decodeDiscordHeroCubePage(pageTarget);
  lines.push(
    page.kind === "main-recipes"
      ? `Browse main recipes · Page ${page.page + 1}`
      : `Browse ${page.cubeKey} sub-recipes · Page ${page.page + 1}/${discordHeroCubeSubRecipePageCount(indexes, page.cubeKey)}`,
  );
  if (location.cubeTarget === undefined) {
    lines.push(
      "Select one exact main recipe. Status and quotes are source-backed; no executability is inferred.",
    );
    return lines.join("\n");
  }
  const decodedTarget = decodeDiscordHeroCubeTarget(location.cubeTarget);
  if (
    (decodedTarget.kind === "main-recipe" &&
      page.kind === "sub-recipes" &&
      decodedTarget.cubeKey !== page.cubeKey) ||
    (decodedTarget.kind === "sub-recipe" &&
      (page.kind !== "sub-recipes" ||
        decodedTarget.cubeKey !== page.cubeKey ||
        decodedTarget.page !== page.page))
  ) {
    throw new Error("Cube target is outside the selected page and group");
  }
  const detail = resolveDiscordHeroCubeTarget(
    indexes,
    state,
    location.cubeTarget,
  );
  lines.push(
    ...(detail.kind === "main-recipe"
      ? cubeMainDetailLines(detail)
      : cubeSubDetailLines(detail)),
  );
  return lines.join("\n");
}

function marketPageForLocation(
  market: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
) {
  if (location.marketPageTarget === undefined) {
    return discordHeroMarketPage(market, indexes, "all", 0);
  }
  const decoded = decodeDiscordHeroMarketPage(
    market,
    indexes,
    location.marketPageTarget,
  );
  return discordHeroMarketPage(market, indexes, decoded.kind, decoded.page);
}

function marketBody(
  market: LoadedDiscordHeroCommunityMarket,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
): string {
  const page = marketPageForLocation(market, indexes, location);
  const kindLabel =
    page.kind === "all"
      ? "All"
      : page.kind === "confirmed"
        ? "Confirmed"
        : "Unconfirmed";
  const lines = [
    "## ⚓ Community Market",
    `Captured Community Market snapshot · ${market.reconciliation.pageFiles} All · ${market.reconciliation.confirmedPages} Confirmed · ${market.reconciliation.unconfirmedPages} Unconfirmed`,
    `${kindLabel} · Page ${page.page + 1}/${page.pageCount} · ${page.totalItems} listings`,
    `Captured ${market.provenance.pages.capturedAtMin} → ${market.provenance.pages.capturedAtMax} · ${market.provenance.pages.exportFormat}`,
    `Source aggregate SHA-256: ${market.provenance.sourceAggregateSha256}`,
    `Compiled SHA-256: ${market.provenance.compiledSha256}`,
    "Captured snapshot only; live settlement remains oracle-gated.",
  ];
  if (location.marketTarget === undefined) {
    lines.push(
      "Inspect one exact catalog-linked listing below. This workspace provides no buy, sell, list, cancel, or settle mutation.",
    );
    return lines.join("\n");
  }

  if (!page.options.some((option) => option.value === location.marketTarget)) {
    throw new Error(
      "Market target is outside the bound captured page and filter",
    );
  }
  const detail = readDiscordHeroMarketDetail(
    market,
    indexes,
    location.marketTarget,
  );
  if (detail.kind !== page.kind || detail.page !== page.page) {
    throw new Error(
      "Market detail does not match the bound captured page and filter",
    );
  }
  lines.push(
    "",
    `**${detail.title}** · #${detail.catalogItem.key} · ${detail.status}`,
    `${detail.catalogItem.slug} · ${detail.catalogItem.type} · ${detail.catalogItem.grade}`,
    `Catalog name: ${JSON.stringify(detail.catalogItem.name)}`,
    `Status reason: ${detail.statusReason}`,
    `Stats: ${JSON.stringify(detail.stats)}`,
    `Price history: ${JSON.stringify(detail.priceHistory)}`,
    `Order book: ${JSON.stringify(detail.orderBook)}`,
    `Page captured: ${detail.provenance.page.capturedAt}`,
    `Page source: ${detail.provenance.page.sourceUrl}`,
    `Page format: ${detail.provenance.page.exportFormat}`,
    `Page SHA-256: ${detail.provenance.page.sha256}`,
    `Page provenance JSON: ${JSON.stringify(detail.provenance.page)}`,
    `Artifact provenance JSON: ${JSON.stringify(detail.provenance.artifact)}`,
    "Raw source body (exact):",
    detail.rawBody,
  );
  return lines.join("\n");
}

function sourceRouteLine(
  indexes: DiscordHeroCatalogIndexes,
  stageKey: number,
): string {
  const entry = discordHeroRouteEntry(indexes, stageKey);
  const total = indexes.tables.stages.rows.length;
  // Deliberately terse: the densest stage body already sits within ~40
  // characters of Discord's 4000-character TextDisplay cap once the read-only
  // handler's refresh notice is prepended, so this line is budgeted against
  // that worst case (guarded by the notice-bound test).
  const boundary = entry.isActStart
    ? ` · act ${entry.sourceAct} opens`
    : entry.isActEnd
      ? ` · act ${entry.sourceAct} ends`
      : "";
  return (
    `Source route ${entry.routeIndex + 1}/${total}` +
    ` ←${entry.previousStageKey === null ? "—" : `#${entry.previousStageKey}`}` +
    ` →${entry.nextStageKey === null ? "—" : `#${entry.nextStageKey}`}` +
    boundary
  );
}

/**
 * Index of the projected primaryAttack inside the ordered attack list, or -1
 * when the source designates a primary that is not one of the ordered attacks.
 * The relation is derived, never assumed, so the render stays truthful if the
 * source ever stops putting the primary first.
 */
function primaryAttackIndex(kit: DiscordHeroMonsterAttackKit): number {
  const primary = JSON.stringify(kit.primaryAttack);
  return kit.attacks.findIndex((attack) => JSON.stringify(attack) === primary);
}

/**
 * Only rendered when the primary is absent from the ordered list; otherwise the
 * `[primary]` marker on the ordered attack carries designation and relation
 * together, which keeps the densest stage inside the TextDisplay budget.
 */
function primaryAttackNote(kit: DiscordHeroMonsterAttackKit): string {
  return primaryAttackIndex(kit) >= 0
    ? ""
    : ` · primary ${JSON.stringify(kit.primaryAttack.skillKey)} not in ordered list`;
}

function sourceRouteOverviewLine(indexes: DiscordHeroCatalogIndexes): string {
  const route = projectDiscordHeroSourceRoute(indexes);
  const segments = route.filter((entry) => entry.isActStart).length;
  return (
    `Source route: ${route.length} stages · #${route[0]!.stageKey} → ` +
    `#${route[route.length - 1]!.stageKey} · ${segments} act segments`
  );
}

function bodyForView(
  view: DiscordHeroView,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  location: DiscordHeroWorkspaceLocation,
  communityAchievements?: LoadedDiscordHeroCommunityAchievements,
  communityMarket?: LoadedDiscordHeroCommunityMarket,
): string {
  const catalog = indexes.catalog;
  const state = snapshot.state;
  switch (view) {
    case "home":
      return homeBody(snapshot, indexes);
    case "heroes":
      if (location.heroKey !== undefined && location.heroTab === "attributes") {
        return attributeBody(snapshot, indexes, location);
      }
      if (location.heroKey !== undefined) {
        const row = discordHeroHeroes(indexes).find(
          (hero) => hero.HeroKey === location.heroKey,
        );
        if (row === undefined) {
          throw new Error(`Heroes view has unknown hero ${location.heroKey}`);
        }
        const statPreview = projectDiscordHeroStatPreview(
          indexes,
          state,
          row.HeroKey,
        );
        const definition = createHeroRoster(indexes).find(
          (hero) => hero.heroKey === row.HeroKey,
        )!;
        const skills = heroSkillKeys(indexes, { heroKey: row.HeroKey });
        const progress = state.heroes.find(
          (hero) => hero.heroKey === row.HeroKey,
        );
        const name = row.HeroNameKey_i18n["en-US"];
        if (typeof name !== "string" || name.length === 0) {
          throw new Error(`hero ${row.HeroKey} has no English source name`);
        }
        const quote = quoteHeroUnlock(indexes, {
          heroKey: row.HeroKey,
          gold: state.gold,
          ownedHeroKeys: state.heroes.map((hero) => hero.heroKey),
        });
        return [
          "## 🦸 Heroes",
          `**${name}** · #${row.HeroKey} · ${definition.classType} · ${progress === undefined ? quote.status : `Owned Lv${progress.level}`}`,
          `Gear: ${definition.mainWeaponGearType} + ${definition.subWeaponGearType} · Unlock cost: ${definition.unlockCost}g`,
          heroBaseCombatLine(indexes, row.HeroKey),
          heroStatPreviewLine(statPreview),
          "Base-only units are source-proven; the raw Attribute preview remains separate. Level, caps, equipment, pet, rune, passive, status, buff, account, environment, and campaign contributions remain oracle-gated.",
          `Base skill: ${skills.baseSkillKey} · Active skills: ${skills.activeSkillKeys.join(", ")}`,
          `Attribute tree: ${row.attribute_keys.length} exact nodes`,
          quote.status === "purchasable"
            ? "Purchase is source-eligible, but remains disabled until the post-purchase save fixture proves exact hero initialization."
            : quote.status === "insufficient-gold"
              ? `Need ${quote.cost} gold; purchase initialization also remains oracle-gated.`
              : "This hero is already present in the source-backed save.",
        ].join("\n");
      }
      return [
        "## 🦸 Heroes",
        `Owned: ${state.heroes.map((hero) => `${hero.heroKey} (Lv${hero.level})`).join(", ")}`,
        "Catalog: 6 exact source heroes.",
      ].join("\n");
    case "party":
      return [
        "## ⚔️ Party",
        state.party
          .map((key, index) => `Slot ${index + 1}: ${key ?? "Empty"}`)
          .join("\n"),
        "",
        "Formation mutations remain oracle-gated until source slot/target semantics are proven.",
      ].join("\n");
    case "world":
      if (location.stageKey !== undefined) {
        const stage = indexes.tables.stages.groups.get(location.stageKey)?.[0];
        if (stage === undefined) {
          throw new Error(`world view has unknown stage ${location.stageKey}`);
        }
        const name = stage.StageNameKey_i18n["en-US"];
        if (typeof name !== "string" || name.length === 0) {
          throw new Error(`stage ${stage.StageKey} has no English source name`);
        }
        const encounter = stageEncounter(indexes, {
          stageKey: stage.StageKey,
        });
        const sourceMonsterRows = projectDiscordHeroStageMonsterSourceRows(
          indexes,
          stage.StageKey,
        );
        const sourceAttackKitsByMonsterKey = new Map(
          projectDiscordHeroMonsterAttackKits(indexes).map((kit) => [
            kit.monsterKey,
            kit,
          ]),
        );
        const sourceRewardPreview = projectStageSourceRewardPreview(indexes, {
          stageKey: stage.StageKey,
          locale: "en-US",
        });
        const sourceItemLabel = (
          item: (typeof sourceRewardPreview.bossItemRef)["item"],
        ): string =>
          `${item.name} (#${item.itemKey}, ${item.grade} ${item.itemType})`;
        const sourceRewardLines = ["### Source reward references"];
        sourceRewardLines.push(
          sourceRewardPreview.monsterItemRef === null
            ? "Monster item: —"
            : `Monster item: ${sourceItemLabel(sourceRewardPreview.monsterItemRef.item)} · source chance ${sourceRewardPreview.monsterItemRef.sourceChancePerThousand}/1000`,
        );
        sourceRewardLines.push(
          `Boss item: ${sourceItemLabel(sourceRewardPreview.bossItemRef.item)} · source chance ${
            sourceRewardPreview.bossItemRef.sourceChancePerThousand === null
              ? "unspecified"
              : `${sourceRewardPreview.bossItemRef.sourceChancePerThousand}/1000`
          }`,
        );
        if (sourceRewardPreview.firstClearTableRef === null) {
          sourceRewardLines.push("First-clear source table: —");
        } else {
          sourceRewardLines.push(
            `First-clear source table #${sourceRewardPreview.firstClearTableRef.dropKey}:`,
          );
          for (const row of sourceRewardPreview.firstClearTableRef.sourceRows) {
            sourceRewardLines.push(
              `- ${row.dropTypeRaw} · hero ${row.heroKeyCondition === null || row.heroKeyCondition === 0 ? "—" : `#${row.heroKeyCondition}`} · weight raw ${row.weightRaw} · ${row.rewardType} #${row.rewardKey} -> ${row.catalogItemRefs.map(sourceItemLabel).join(", ")}`,
            );
          }
        }
        sourceRewardLines.push(
          sourceRewardPreview.soulstoneItemRef === null
            ? "Soulstone source ref: —"
            : `Soulstone source ref: ${sourceItemLabel(sourceRewardPreview.soulstoneItemRef.item)} · amount raw ${sourceRewardPreview.soulstoneItemRef.amountRaw}`,
        );
        sourceRewardLines.push(
          "Preview only: exact catalog refs/rates/weights. RNG, class selection, first-clear claim/replay, award timing, pity, and inventory mutation remain unproven.",
        );
        const progress = state.campaign.stages.find(
          (candidate) => candidate.stageKey === stage.StageKey,
        );
        return [
          "## 🗺️ World",
          `**${name}** · #${stage.StageKey} · Act ${stage.Act}-${stage.StageNo} · ${stage.STAGEDIFFICULITY}`,
          `Source level ${stage.StageLevel} · ${encounter.kind === "normal" ? `${encounter.waveAmount} waves × ${encounter.waveMonsterAmount}` : "Act boss"}`,
          `Monsters: ${encounter.waveMonsters.map((entry) => `${entry.monsterKey} (${entry.weight})`).join(", ") || "—"}`,
          `Monster drop: ${encounter.monsterDrop === null ? "—" : `${encounter.monsterDrop.dropKey} @ ${encounter.monsterDrop.chancePerThousand}/1000`}`,
          `Boss: ${encounter.bossMonsterKey} · Drop: ${encounter.bossDrop.dropKey}${encounter.bossDrop.chancePerThousand === null ? "" : ` @ ${encounter.bossDrop.chancePerThousand}/1000`}`,
          `First-clear table: ${encounter.firstClearDropKey ?? "—"}`,
          sourceRouteLine(indexes, stage.StageKey),
          `Progress: ${progress === undefined ? "Not cleared" : `${progress.clearCount} clears${progress.bestClearMs === null ? "" : ` · best ${progress.bestClearMs}ms`}`}`,
          "### Source-scaled monster base stats",
          "Catalog projection only; no combat or rewards were applied.",
          ...sourceMonsterRows.flatMap((row) => {
            if (row.status === "unresolved-source-row") {
              return [
                `Wave #${row.monsterKey} · Weight raw ${row.sourceWeightRaw} · source monster row unresolved; base stats unavailable`,
                `Kit source preview unavailable: unresolved monster #${row.monsterKey}.`,
              ];
            }
            const attackKit = sourceAttackKitsByMonsterKey.get(row.monsterKey);
            if (attackKit === undefined) {
              throw new Error(
                `world view has no Monster Attack-Kit source for monster ${row.monsterKey}`,
              );
            }
            const stats = row.stats;
            const sourceStatLine =
              row.role === "wave"
                ? `Wave #${row.monsterKey} · Weight raw ${row.sourceWeightRaw} · HP ${stats.maxLife} · ATK ${stats.attackDamage} · Source Gold ${stats.sourceRewardGoldPerMonster} · Source EXP ${stats.sourceRewardExpPerMonster} · ASPD raw ${stats.attackSpeedRaw} · Move raw ${stats.movementSpeedRaw}`
                : `Boss #${row.monsterKey} · HP ${stats.maxLife} · ATK ${stats.attackDamage} · Source Gold ${stats.sourceRewardGoldPerMonster} · Source EXP ${stats.sourceRewardExpPerMonster} · ASPD raw ${stats.attackSpeedRaw} · Move raw ${stats.movementSpeedRaw} · Boss scale raw ${stats.bossScaleRaw ?? "—"}`;
            const provenance =
              attackKit.provenance.kind === "raw"
                ? "raw"
                : `pinned-enrichment sha ${attackKit.provenance.sourceSha256}`;
            return [
              sourceStatLine,
              // Labels are abbreviated, never the source facts: provenance,
              // ref status, and every attack value are rendered verbatim. The
              // densest stage must stay under the TextDisplay cap even with the
              // read-only handler's refresh notice prepended.
              `Kit source preview · ${provenance} · elem ${JSON.stringify(attackKit.attackElements)}${primaryAttackNote(attackKit)}`,
              ...attackKit.attacks.map(
                (attack, attackIndex) =>
                  `Atk ${attackIndex + 1}${attackIndex === primaryAttackIndex(attackKit) ? " [primary]" : ""} · skill ${JSON.stringify(attack.skillKey)} [${attack.skillRefStatus}] · activ ${attack.activation} · dmg ${attack.damageType} · deliv ${JSON.stringify(attack.deliveryType)} · range ${attack.range} · val ${JSON.stringify(attack.value)} · snd ${JSON.stringify(attack.sound)}`,
              ),
            ];
          }),
          "Attack cadence, target, cooldown start, buff/status, damage application, death, and RNG remain runtime-oracle-gated.",
          ...sourceRewardLines,
          encounter.unresolvedMonsterKeys.length === 0
            ? "Combat start remains oracle-gated for formation, timing, targeting, death and reward ordering."
            : `Source blocker: missing monster ${encounter.unresolvedMonsterKeys.join(", ")}; this encounter cannot start.`,
        ].join("\n");
      }
      return [
        "## 🗺️ World",
        `Cleared stage records: ${state.campaign.stages.length}/120`,
        sourceRouteOverviewLine(indexes),
        `Active session: ${state.stageSession?.stageKey ?? "None"}`,
        `Browse all source stages · Page ${(location.worldPage ?? 0) + 1}/${discordHeroStagePageCount(indexes)}`,
      ].join("\n");
    case "inventory":
      return inventoryBodySections(snapshot, indexes, location).join("\n\n");
    case "runes": {
      if (location.runeTab === "skills") {
        const page = location.skillPage ?? 0;
        if (location.skillRowIndex !== undefined) {
          const skill = readDiscordHeroSkill(
            indexes,
            encodeDiscordHeroSkillTarget(location.skillRowIndex),
          );
          return [
            "## 🔮 Skills",
            `**${skill.name}** · row ${skill.rowIndex + 1}/${indexes.tables.skills.rows.length}`,
            `Source key: ${JSON.stringify(skill.sourceKey)}`,
            `Description: ${skill.description === null ? "null" : JSON.stringify(skill.description)}`,
            `Activation: ${skill.activationType} · value ${JSON.stringify(skill.activationValue)}`,
            `Slot: ${skill.slotType} · buff ${skill.skillBuffType} · group ${JSON.stringify(skill.buffGroupKey)}`,
            `Params: ${JSON.stringify(skill.params)}`,
            `Range: ${skill.range} · Order: ${JSON.stringify(skill.order)}`,
            `Damage: ${skill.damageType} · delivery ${JSON.stringify(skill.damageDeliveryType)}`,
            `Value: ${JSON.stringify(skill.value)}`,
            `Level key: ${JSON.stringify(skill.skillLevelKey)} · Levels: ${
              skill.levels.length === 0
                ? "—"
                : skill.levels
                    .map((level) => `Lv${level.level}=${level.value}`)
                    .join(", ")
            }`,
            `Animations: ${JSON.stringify(skill.animationPaths)}`,
            `Attribute: ${JSON.stringify(skill.attributeKey)} · Sound: ${JSON.stringify(skill.soundKey)}`,
            `Hero links: ${skill.heroKeys.length === 0 ? "—" : skill.heroKeys.map((heroKey) => `#${heroKey}`).join(", ")}`,
            `Skills · Page ${page + 1}/${discordHeroSkillPageCount(indexes)}`,
          ].join("\n");
        }
        return [
          "## 🔮 Skills",
          `${indexes.tables.skills.rows.length} exact source definitions · Skills · Page ${page + 1}/${discordHeroSkillPageCount(indexes)}`,
          "Inspect one exact row-index target; source whitespace and level links are preserved.",
        ].join("\n");
      }
      return [
        "## 🔮 Runes",
        `Allocated: ${state.runes.length}/197 · Page ${(location.runePage ?? 0) + 1}/${discordHeroRunePageCount(indexes)}`,
        "Only source effects consumed by reachable Alchemy gameplay can upgrade. Other Rune effects remain oracle-gated.",
      ].join("\n");
    }
    case "cube":
      return cubeBody(snapshot, indexes, location);
    case "collection":
      if (communityAchievements === undefined) {
        throw new Error(
          "Collection view requires loaded community achievements",
        );
      }
      return collectionBody(snapshot, indexes, communityAchievements, location);
    case "codex":
      if (location.codex !== undefined && location.codex.datasetName !== null) {
        const record = readDiscordHeroCodexRecord(
          indexes,
          location.codex.datasetName,
          location.codex.rowIndex,
        );
        return [
          "## 📖 Source Codex",
          `**${location.codex.datasetName}** · row ${location.codex.rowIndex + 1}/${record.rowCount.toLocaleString("en-US")}`,
          `Catalog digest: \`${catalog.provenance.compiledSha256.slice(0, 16)}…\``,
          record.previewTruncated
            ? "Preview is shortened for Discord; download returns the exact unmodified row."
            : "Preview contains the complete row.",
          "```json",
          record.preview,
          "```",
        ].join("\n");
      }
      return [
        "## 📖 Source Codex",
        `${catalog.totals.datasets} datasets · ${catalog.totals.rows.toLocaleString("en-US")} exact rows`,
        `Catalog digest: \`${catalog.provenance.compiledSha256.slice(0, 16)}…\``,
        "Choose a dataset, browse every row, then download its exact raw JSON.",
      ].join("\n");
    case "market":
      if (communityMarket === undefined) {
        throw new Error("Market view requires loaded Community Market data");
      }
      return marketBody(communityMarket, indexes, location);
  }
}

export function renderDiscordHeroWorkspace(
  ownerId: string,
  view: DiscordHeroView,
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
  notice?: string,
  location: DiscordHeroWorkspaceLocation = {},
  communityAchievements?: LoadedDiscordHeroCommunityAchievements,
  communityMarket?: LoadedDiscordHeroCommunityMarket,
  communityContent?: LoadedDiscordHeroCommunityContent,
): ContainerBuilder {
  if (view === "runes") {
    validatePlayerAgainstCatalog(snapshot.state, indexes);
  }
  const resolvedCodexLocation =
    location.codex ??
    ({
      datasetPage: 0,
      datasetName: null,
      rowIndex: 0,
    } satisfies DiscordHeroCodexLocation);
  const resolvedLocation = {
    alchemyPage: location.alchemyPage ?? 0,
    cubePageTarget:
      location.cubePageTarget ??
      encodeDiscordHeroCubePage({ kind: "main-recipes", page: 0 }),
    cubeTab:
      location.cubeTab ??
      (location.alchemyPage === undefined ? "browse" : "alchemy"),
    codex: resolvedCodexLocation,
    codexTab: location.codexTab ?? "source-data",
    communityCategory: location.communityCategory ?? "builds",
    communityListPage: location.communityListPage ?? 0,
    communityChunkPage: location.communityChunkPage ?? 0,
    achievementPage: location.achievementPage ?? 0,
    collectionPage: location.collectionPage ?? 0,
    collectionTab: location.collectionTab ?? "pets",
    equipmentPage: location.equipmentPage ?? 0,
    freeInventoryPage: location.freeInventoryPage ?? 0,
    inventoryFilter:
      location.inventoryFilter ?? DISCORD_HERO_INVENTORY_ALL_FILTER,
    inventoryPage: location.inventoryPage ?? 0,
    rollPage: location.rollPage ?? 0,
    runePage: location.runePage ?? 0,
    runeTab: location.runeTab ?? "runes",
    skillPage: location.skillPage ?? 0,
    worldPage: location.worldPage ?? 0,
    heroTab: location.heroTab ?? "overview",
    ...(location.attributePageTarget === undefined
      ? {}
      : { attributePageTarget: location.attributePageTarget }),
    ...(location.attributeTarget === undefined
      ? {}
      : { attributeTarget: location.attributeTarget }),
    ...(location.cubeTarget === undefined
      ? {}
      : { cubeTarget: location.cubeTarget }),
    ...(location.equipmentSelection === undefined
      ? {}
      : { equipmentSelection: location.equipmentSelection }),
    ...(location.itemEffects === undefined
      ? {}
      : { itemEffects: location.itemEffects }),
    ...(location.inventorySlotIndex === undefined
      ? {}
      : { inventorySlotIndex: location.inventorySlotIndex }),
    ...(location.stageKey === undefined ? {} : { stageKey: location.stageKey }),
    ...(location.heroKey === undefined ? {} : { heroKey: location.heroKey }),
    ...(location.achievementRowIndex === undefined
      ? {}
      : { achievementRowIndex: location.achievementRowIndex }),
    ...(location.collectionKey === undefined
      ? {}
      : { collectionKey: location.collectionKey }),
    ...(location.communityDocumentIndex === undefined
      ? {}
      : { communityDocumentIndex: location.communityDocumentIndex }),
    ...(location.containerPageTarget === undefined
      ? {}
      : { containerPageTarget: location.containerPageTarget }),
    ...(location.containerSlotTarget === undefined
      ? {}
      : { containerSlotTarget: location.containerSlotTarget }),
    ...(location.skillRowIndex === undefined
      ? {}
      : { skillRowIndex: location.skillRowIndex }),
    ...(location.marketPageTarget === undefined
      ? {}
      : { marketPageTarget: location.marketPageTarget }),
    ...(location.marketTarget === undefined
      ? {}
      : { marketTarget: location.marketTarget }),
  } satisfies DiscordHeroWorkspaceLocation;
  const activeContainerPage =
    view === "inventory" && resolvedLocation.containerPageTarget !== undefined
      ? projectDiscordHeroContainerPage(
          indexes,
          snapshot.state,
          resolvedLocation.containerPageTarget,
        )
      : null;
  const bodySections =
    view === "codex" && resolvedLocation.codexTab === "community"
      ? communityContent === undefined
        ? (() => {
            throw new Error(
              "Community Codex requires loaded Community content",
            );
          })()
        : communityContentBodySections(communityContent, resolvedLocation)
      : view === "inventory"
        ? activeContainerPage === null
          ? inventoryBodySections(snapshot, indexes, resolvedLocation)
          : containerBodySections(snapshot, indexes, resolvedLocation)
        : (view === "heroes" && resolvedLocation.heroTab === "attributes") ||
            view === "market"
          ? splitDiscordText(
              bodyForView(
                view,
                snapshot,
                indexes,
                resolvedLocation,
                communityAchievements,
                communityMarket,
              ),
              3_500,
            )
          : [
              bodyForView(
                view,
                snapshot,
                indexes,
                resolvedLocation,
                communityAchievements,
                communityMarket,
              ),
            ];
  const container = new ContainerBuilder().setAccentColor(0x5865f2);
  // The notice is caller-supplied and unbounded, so it is budgeted through the
  // same splitter as any other body text and carried in its own TextDisplay(s)
  // instead of being prepended to the first section. That keeps every component
  // inside Discord's cap for any notice length, loses no notice content, and
  // makes the source-detail budget independent of notice length.
  for (const chunk of notice === undefined
    ? []
    : splitDiscordText(`> ${notice}`, 3_500)) {
    container.addTextDisplayComponents(text(chunk));
  }
  for (const section of bodySections) {
    container.addTextDisplayComponents(text(section));
  }
  if (view === "inventory") {
    container.addActionRowComponents(
      containerTabRow(
        ownerId,
        snapshot,
        indexes,
        activeContainerPage?.kind ?? "inventory",
      ),
    );
    const actionRows =
      activeContainerPage === null
        ? inventoryActionRows(ownerId, snapshot, indexes, resolvedLocation)
        : containerActionRows(
            ownerId,
            snapshot,
            activeContainerPage,
            resolvedLocation.containerSlotTarget,
          );
    for (const row of actionRows) {
      container.addActionRowComponents(row);
    }
    container.addActionRowComponents(
      containerActionRow(
        ownerId,
        snapshot,
        indexes,
        resolvedLocation,
        activeContainerPage,
      ),
    );
  }
  if (view === "heroes") {
    container
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        heroActionRow(ownerId, snapshot, indexes, resolvedLocation.heroKey),
      );
    if (resolvedLocation.heroKey !== undefined) {
      container.addActionRowComponents(
        heroTabRow(ownerId, snapshot, indexes, resolvedLocation),
      );
      if (resolvedLocation.heroTab === "attributes") {
        for (const row of attributeActionRows(
          ownerId,
          snapshot,
          indexes,
          resolvedLocation,
        )) {
          container.addActionRowComponents(row);
        }
      }
    }
  }
  if (view === "cube") {
    container.addSeparatorComponents(divider());
    container.addActionRowComponents(
      cubeTabRow(ownerId, snapshot, resolvedLocation.cubeTab ?? "browse"),
    );
    for (const row of cubeActionRows(
      ownerId,
      snapshot,
      indexes,
      resolvedLocation.cubeTab ?? "browse",
    )) {
      container.addActionRowComponents(row);
    }
    const rows =
      resolvedLocation.cubeTab === "alchemy"
        ? alchemyActionRows(
            ownerId,
            snapshot,
            indexes,
            resolvedLocation.alchemyPage ?? 0,
          )
        : cubeBrowserActionRows(ownerId, snapshot, indexes, resolvedLocation);
    for (const row of rows) {
      container.addActionRowComponents(row);
    }
  }
  if (view === "runes") {
    container.addSeparatorComponents(divider());
    const rows =
      resolvedLocation.runeTab === "skills"
        ? skillActionRows(ownerId, snapshot, indexes, resolvedLocation)
        : runeActionRows(ownerId, snapshot, indexes, resolvedLocation);
    for (const row of rows) {
      container.addActionRowComponents(row);
    }
  }
  if (view === "collection") {
    if (communityAchievements === undefined) {
      throw new Error("Collection controls require loaded achievements");
    }
    container.addSeparatorComponents(divider());
    for (const row of collectionActionRows(
      ownerId,
      snapshot,
      indexes,
      communityAchievements,
      resolvedLocation,
    )) {
      container.addActionRowComponents(row);
    }
  }
  if (view === "market") {
    if (communityMarket === undefined) {
      throw new Error("Market controls require loaded Community Market data");
    }
    container.addSeparatorComponents(divider());
    for (const row of marketActionRows(
      ownerId,
      snapshot,
      indexes,
      communityMarket,
      resolvedLocation,
    )) {
      container.addActionRowComponents(row);
    }
  }
  if (view === "world") {
    container.addSeparatorComponents(divider());
    for (const row of worldActionRows(
      ownerId,
      snapshot,
      indexes,
      location.worldPage ?? 0,
      location.stageKey,
    )) {
      container.addActionRowComponents(row);
    }
  }
  if (view === "codex") {
    container.addSeparatorComponents(divider());
    if (communityContent !== undefined) {
      container.addActionRowComponents(
        codexTabActionRow(
          ownerId,
          snapshot,
          resolvedLocation.codexTab ?? "source-data",
        ),
      );
    }
    const rows =
      resolvedLocation.codexTab === "community"
        ? communityContent === undefined
          ? []
          : communityContentActionRows(
              ownerId,
              snapshot,
              communityContent,
              resolvedLocation,
            )
        : codexActionRows(ownerId, snapshot, indexes, resolvedCodexLocation);
    for (const row of rows) {
      container.addActionRowComponents(row);
    }
  }
  container.addSeparatorComponents(divider());
  for (const row of navigationRows(ownerId, snapshot.revision, view)) {
    container.addActionRowComponents(row);
  }
  return container;
}
