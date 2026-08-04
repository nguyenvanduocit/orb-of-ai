import {
  AttachmentBuilder,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../discord-hero/catalog/indexes";
import { validatePlayerAgainstCatalog } from "../discord-hero/domain/invariants";
import type { PlayerState } from "../discord-hero/domain/player";
import { quoteRuneUpgrade } from "../discord-hero/domain/runes";
import {
  getDiscordHeroRuntime,
  type DiscordHeroRuntime,
} from "../discord-hero/runtime";
import { OracleRequiredError as ItemOracleRequiredError } from "../discord-hero/domain/items";
import {
  DiscordHeroRevisionConflictError,
  type PlayerSnapshot,
} from "../discord-hero/state/repository";
import {
  assertDiscordHeroComponentOwner,
  decodeDiscordHeroCustomId,
  type DiscordHeroView,
} from "../discord-hero/ui/custom-id";
import {
  decodeDiscordHeroCodexDatasetPage,
  decodeDiscordHeroCodexRecordTarget,
  decodeDiscordHeroCodexRowPage,
  discordHeroCodexDatasets,
  isDiscordHeroDatasetName,
  readDiscordHeroCodexRecord,
  type DiscordHeroCodexLocation,
} from "../discord-hero/ui/codex";
import {
  decodeDiscordHeroCommunityChunkTarget,
  decodeDiscordHeroCommunityDocumentTarget,
  decodeDiscordHeroCommunityListPage,
  readDiscordHeroCommunityContentDocument,
} from "../discord-hero/ui/community-content";
import {
  decodeDiscordHeroAchievementPage,
  decodeDiscordHeroAchievementTarget,
  readDiscordHeroAchievementDetail,
} from "../discord-hero/ui/achievements";
import {
  decodeDiscordHeroAlchemyPage,
  discordHeroAlchemyDebits,
  discordHeroAlchemyOptions,
  discordHeroAlchemyPageCount,
  isDiscordHeroAlchemyUnlocked,
} from "../discord-hero/ui/alchemy";
import {
  decodeDiscordHeroAttributeHero,
  decodeDiscordHeroAttributeTarget,
  discordHeroAttributePage,
  encodeDiscordHeroAttributePage,
  readDiscordHeroAttributeDetail,
} from "../discord-hero/ui/attributes";
import {
  decodeDiscordHeroCollectionKey,
  decodeDiscordHeroCollectionPage,
  discordHeroCollectionRows,
} from "../discord-hero/ui/collection";
import {
  projectDiscordHeroContainerPage,
  readDiscordHeroContainerSlot,
} from "../discord-hero/ui/containers";
import {
  decodeDiscordHeroCubePage,
  decodeDiscordHeroCubeTarget,
  discordHeroCubeMainRecipeOptions,
  discordHeroCubeSubRecipeOptions,
  encodeDiscordHeroCubePage,
  resolveDiscordHeroCubeTarget,
} from "../discord-hero/ui/cube";
import {
  decodeDiscordHeroHeroKey,
  discordHeroHeroes,
} from "../discord-hero/ui/heroes";
import {
  DISCORD_HERO_INVENTORY_ALL_FILTER,
  decodeDiscordHeroEquipmentPage,
  decodeDiscordHeroEquipmentSelection,
  decodeDiscordHeroEquipTarget,
  decodeDiscordHeroItemEffectsPageTarget,
  decodeDiscordHeroItemEffectsRowIndex,
  decodeDiscordHeroItemEffectsSectionChoice,
  decodeDiscordHeroItemEffectsSectionTarget,
  decodeDiscordHeroInventoryFilter,
  decodeDiscordHeroInventoryPage,
  decodeDiscordHeroInventorySlot,
  decodeDiscordHeroRollPageTarget,
  decodeDiscordHeroUnequipTarget,
  discordHeroCompatibleEquipHeroes,
  discordHeroEquippedGear,
  discordHeroFreeInventorySlots,
  discordHeroInventoryPageCount,
  discordHeroInventorySlots,
  discordHeroRolledStatPageCount,
  discordHeroRolledStats,
  readDiscordHeroStoredAsset,
} from "../discord-hero/ui/inventory";
import {
  assertDiscordHeroItemEffectSourcesKnown,
  DiscordHeroUnknownItemEffectSourceError,
} from "../discord-hero/domain/item-effects";
import {
  discordHeroItemEffectsDetail,
  discordHeroItemEffectsPage,
} from "../discord-hero/ui/item-effects";
import {
  decodeDiscordHeroRuneKey,
  decodeDiscordHeroRunePage,
  discordHeroRunes,
} from "../discord-hero/ui/runes";
import {
  decodeDiscordHeroMarketKind,
  decodeDiscordHeroMarketPage,
  discordHeroMarketPage,
  encodeDiscordHeroMarketPage,
  readDiscordHeroMarketDetail,
} from "../discord-hero/ui/market";
import {
  decodeDiscordHeroSkillPage,
  decodeDiscordHeroSkillTarget,
  discordHeroSkills,
  encodeDiscordHeroSkillTarget,
  readDiscordHeroSkill,
} from "../discord-hero/ui/skills";
import {
  decodeDiscordHeroStageKey,
  decodeDiscordHeroStagePage,
  discordHeroStages,
} from "../discord-hero/ui/world";
import {
  decodeDiscordHeroContainerUnlockTarget,
  renderDiscordHeroWorkspace,
  type DiscordHeroWorkspaceLocation,
} from "../discord-hero/ui/workspace";
import {
  allocateDiscordHeroAttributePoint,
  type AllocateAttributePointOutcome,
} from "../discord-hero/use-cases/allocate-attribute-point";
import {
  alchemizeDiscordHeroItems,
  createDiscordHeroAlchemyReceiptQuery,
  type AlchemizeItemsOutcome,
} from "../discord-hero/use-cases/alchemy";
import {
  equipDiscordHeroGear,
  type EquipGearOutcome,
} from "../discord-hero/use-cases/equip-gear";
import { openDiscordHeroWorkspace } from "../discord-hero/use-cases/open-workspace";
import {
  unlockDiscordHeroCubeRecipe,
  type UnlockCubeRecipeOutcome,
} from "../discord-hero/use-cases/unlock-cube-recipe";
import {
  unlockDiscordHeroContainerSlot,
  type UnlockContainerSlotOutcome,
} from "../discord-hero/use-cases/unlock-container-slot";
import {
  unequipDiscordHeroGear,
  type UnequipGearOutcome,
} from "../discord-hero/use-cases/unequip-gear";
import {
  upgradeDiscordHeroRune,
  type UpgradeRuneOutcome,
} from "../discord-hero/use-cases/upgrade-rune";
import { boardPayload } from "../ui";
import type { Command } from "../types";

const data = new SlashCommandBuilder()
  .setName("discordhero")
  .setDescription("Mở workspace DiscordHero riêng của bạn");

type DiscordHeroRuntimeProvider = () => Promise<DiscordHeroRuntime>;

export async function execute(
  interaction: ChatInputCommandInteraction,
  runtimeProviderOrSub:
    DiscordHeroRuntimeProvider | string = getDiscordHeroRuntime,
  now: () => number = Date.now,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const runtimeProvider =
    typeof runtimeProviderOrSub === "function"
      ? runtimeProviderOrSub
      : getDiscordHeroRuntime;
  let runtime: DiscordHeroRuntime;
  try {
    runtime = await runtimeProvider();
  } catch {
    await interaction.editReply(
      boardPayload(
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "DiscordHero is temporarily unavailable; please try again.",
          ),
        ),
      ),
    );
    return;
  }
  const opened = openDiscordHeroWorkspace(runtime.repository, runtime.indexes, {
    userId: interaction.user.id,
    interactionId: interaction.id,
    nowMs: now(),
  });
  await interaction.editReply(
    boardPayload(
      renderDiscordHeroWorkspace(
        interaction.user.id,
        "home",
        { revision: opened.revision, state: opened.state },
        runtime.indexes,
        opened.created ? "Fresh source-backed save created." : undefined,
      ),
    ),
  );
}

function unlockNotice(outcome: UnlockContainerSlotOutcome): string {
  switch (outcome.kind) {
    case "unlocked":
      return `${outcome.container} slot ${outcome.slotIndex} unlocked for ${outcome.cost} gold.`;
    case "insufficient-gold":
      return `Need ${outcome.cost} gold to unlock ${outcome.container}; you have ${outcome.availableGold}.`;
    case "maximum-capacity":
      return `${outcome.container} is already at source maximum capacity (${outcome.unlockedSlots}).`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function resolveContainerUnlockLocation(
  target: ReturnType<typeof decodeDiscordHeroContainerUnlockTarget>,
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): DiscordHeroWorkspaceLocation | null {
  if (target === null) return null;
  try {
    if (target.origin === "inventory") {
      discordHeroInventorySlots(
        indexes,
        state,
        DISCORD_HERO_INVENTORY_ALL_FILTER,
        target.inventoryPage,
      );
      discordHeroEquippedGear(state, target.equipmentPage, indexes);
      return {
        inventoryPage: target.inventoryPage,
        equipmentPage: target.equipmentPage,
      };
    }
    const page = projectDiscordHeroContainerPage(
      indexes,
      state,
      target.containerPageTarget,
    );
    if (page.kind === "inventory") {
      throw new Error("Inventory Container origin must use its legacy context");
    }
    return { containerPageTarget: page.pageTarget };
  } catch {
    return null;
  }
}

function decodeCubeUnlockTarget(
  value: string | undefined,
): { cubeKey: number; cubeTab: "browse" | "alchemy" } | null {
  const match = /^([ab])-([1-9]\d*)$/.exec(value ?? "");
  if (match === null) return null;
  const cubeKey = Number(match[2]);
  if (!Number.isSafeInteger(cubeKey) || String(cubeKey) !== match[2]) {
    return null;
  }
  return {
    cubeKey,
    cubeTab: match[1] === "b" ? "browse" : "alchemy",
  };
}

function cubeUnlockNotice(outcome: UnlockCubeRecipeOutcome): string {
  switch (outcome.kind) {
    case "unlocked":
      return `${outcome.recipeType} unlocked for ${outcome.cost} gold.`;
    case "insufficient-gold":
      return `Need ${outcome.cost} gold to unlock ${outcome.recipeType}; you have ${outcome.availableGold}.`;
    case "already-unlocked":
      return `${outcome.recipeType} is already unlocked.`;
    case "level-locked":
      return `${outcome.recipeType} requires Cube level ${outcome.requiredCubeLevel}; current level is ${outcome.currentCubeLevel}.`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function alchemyNotice(outcome: AlchemizeItemsOutcome): string {
  switch (outcome.kind) {
    case "alchemized":
      return `Alchemy consumed ${outcome.consumedItems} item${outcome.consumedItems === 1 ? "" : "s"} for ${outcome.goldGained} gold and ${outcome.cubeExperienceGained} Cube EXP. Gold ${outcome.gold}; Cube Lv${outcome.cubeLevel} EXP ${outcome.cubeXp}.`;
    case "recipe-locked":
      return "Alchemy recipe is locked.";
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function runeUpgradeNotice(outcome: UpgradeRuneOutcome): string {
  switch (outcome.kind) {
    case "upgraded":
      return `${outcome.name} upgraded to level ${outcome.level} for ${outcome.cost.toLocaleString("en-US")} gold.`;
    case "insufficient-gold":
      return `Need ${outcome.cost.toLocaleString("en-US")} gold to upgrade ${outcome.name}; you have ${outcome.availableGold.toLocaleString("en-US")}.`;
    case "maximum-level":
      return `${outcome.name} is already at source maximum level ${outcome.level}.`;
    case "unsupported-effect":
      return `${outcome.statType} is oracle-gated; ${outcome.name} cannot upgrade until that source effect has a reachable gameplay consumer.`;
    case "prerequisite-locked":
      return `${outcome.name} requires ${outcome.predecessorKeys.map((key) => `Rune #${key}`).join(" or ")} at level ${outcome.requiredLevel}.`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function attributeAllocationNotice(
  outcome: AllocateAttributePointOutcome,
): string {
  switch (outcome.kind) {
    case "allocated":
      return `Attribute #${outcome.attributeKey} allocated to level ${outcome.level} for ${outcome.requiredPoint} ${outcome.requiredPoint === 1 ? "point" : "points"}.`;
    case "maximum-level":
      return `Attribute #${outcome.attributeKey} is already at source maximum level ${outcome.level}.`;
    case "group-locked":
      return `Attribute #${outcome.attributeKey} needs ${
        outcome.groupRequiredAllocatedPoint - outcome.spentPoints
      } more spent points to unlock group #${outcome.groupKey}.`;
    case "insufficient-points":
      return `Attribute #${outcome.attributeKey} needs ${outcome.requiredPoint} ${outcome.requiredPoint === 1 ? "point" : "points"}; ${outcome.remainingPoints} remain.`;
    case "hero-not-owned":
      return `Hero #${outcome.heroKey} is not owned.`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function equipGearNotice(
  runtime: DiscordHeroRuntime,
  outcome: EquipGearOutcome,
): string {
  switch (outcome.kind) {
    case "equipped":
      return `${getLocalizedCatalogName(
        runtime.indexes,
        "items",
        outcome.itemKey,
        "en-US",
      )} equipped to ${getLocalizedCatalogName(
        runtime.indexes,
        "heroes",
        outcome.heroKey,
        "en-US",
      )}.`;
    case "hero-not-owned":
      return `Hero #${outcome.heroKey} is not owned.`;
    case "inventory-slot-locked":
      return `Inventory slot ${outcome.inventorySlotIndex} is locked.`;
    case "inventory-slot-empty":
      return `Inventory slot ${outcome.inventorySlotIndex} is empty.`;
    case "inventory-slot-not-gear":
      return `Inventory slot ${outcome.inventorySlotIndex} is not gear.`;
    case "incompatible-gear":
      return `Hero #${outcome.heroKey} cannot equip ${outcome.gearType}.`;
    case "equipment-slot-occupied":
      return `Hero #${outcome.heroKey} already has ${outcome.gearType} equipped.`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function unequipGearNotice(
  runtime: DiscordHeroRuntime,
  outcome: UnequipGearOutcome,
): string {
  switch (outcome.kind) {
    case "unequipped":
      return `${getLocalizedCatalogName(
        runtime.indexes,
        "items",
        outcome.itemKey,
        "en-US",
      )} unequipped from ${getLocalizedCatalogName(
        runtime.indexes,
        "heroes",
        outcome.heroKey,
        "en-US",
      )} to Inventory slot ${outcome.inventorySlotIndex}.`;
    case "hero-not-owned":
      return `Hero #${outcome.heroKey} is not owned.`;
    case "inventory-slot-locked":
      return `Inventory slot ${outcome.inventorySlotIndex} is locked.`;
    case "inventory-slot-occupied":
      return `Inventory slot ${outcome.inventorySlotIndex} is occupied.`;
    case "equipment-slot-empty":
      return `Hero #${outcome.heroKey} has no ${outcome.gearType} equipped.`;
    case "player-not-found":
      return "No DiscordHero save exists. Run /discordhero again.";
  }
}

function decodeCodexPageLocation(
  value: string | undefined,
): DiscordHeroCodexLocation | null {
  if (value === undefined) return null;
  try {
    const datasetPage = decodeDiscordHeroCodexDatasetPage(value);
    return { datasetPage, datasetName: null, rowIndex: 0 };
  } catch {
    try {
      const target = decodeDiscordHeroCodexRowPage(value);
      return {
        datasetPage: 0,
        datasetName: target.datasetName,
        rowIndex: target.rowIndex,
      };
    } catch {
      return null;
    }
  }
}

function renderCodexWorkspace(
  runtime: DiscordHeroRuntime,
  ownerId: string,
  snapshot: PlayerSnapshot,
  notice?: string,
  location: DiscordHeroWorkspaceLocation = {},
) {
  return renderDiscordHeroWorkspace(
    ownerId,
    "codex",
    snapshot,
    runtime.indexes,
    notice,
    location,
    undefined,
    undefined,
    runtime.communityContent,
  );
}

function resolveDiscordHeroItemEffectsTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  target: {
    readonly equipmentPage: number;
    readonly equipmentRow: number;
    readonly heroKey: number;
    readonly gearType: string;
  },
) {
  const entry = discordHeroEquippedGear(state, target.equipmentPage, indexes)[
    target.equipmentRow
  ];
  if (
    entry === undefined ||
    entry.heroKey !== target.heroKey ||
    entry.gearType !== target.gearType
  ) {
    throw new Error(
      "Item Effects target is outside the bound equipment page and row",
    );
  }
  return {
    input: {
      indexes,
      state,
      heroKey: entry.heroKey,
      instanceId: entry.asset.instanceId,
    },
    equipmentSelection: {
      heroKey: entry.heroKey,
      gearType: entry.gearType,
    },
  };
}

function renderDiscordHeroReadOnlyWorkspace(
  ownerId: string,
  view: DiscordHeroView,
  snapshot: PlayerSnapshot,
  runtime: DiscordHeroRuntime,
  notice: string | undefined,
  location: DiscordHeroWorkspaceLocation | null,
) {
  let renderedView = view;
  let recoveringUnknownItemEffectSource = false;
  if (location === null) {
    try {
      assertDiscordHeroItemEffectSourcesKnown(runtime.indexes, snapshot.state);
    } catch (error) {
      if (!(error instanceof DiscordHeroUnknownItemEffectSourceError)) {
        throw error;
      }
      renderedView = "codex";
      recoveringUnknownItemEffectSource = true;
    }
  }
  return renderDiscordHeroWorkspace(
    ownerId,
    renderedView,
    snapshot,
    runtime.indexes,
    notice,
    location ?? {},
    renderedView === "collection" ? runtime.communityAchievements : undefined,
    renderedView === "market" ? runtime.communityMarket : undefined,
    renderedView === "codex" && !recoveringUnknownItemEffectSource
      ? runtime.communityContent
      : undefined,
  );
}

export async function handleButton(
  interaction: ButtonInteraction,
  runtimeProvider: DiscordHeroRuntimeProvider = getDiscordHeroRuntime,
  now: () => number = Date.now,
): Promise<void> {
  const customId = decodeDiscordHeroCustomId(interaction.customId);
  try {
    assertDiscordHeroComponentOwner(customId, interaction.user.id);
  } catch {
    await interaction.reply({
      content: "Workspace này thuộc về người chơi khác.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const runtime = await runtimeProvider();
  const snapshot = runtime.repository.getPlayer(interaction.user.id);
  if (snapshot === null) {
    throw new Error("DiscordHero workspace owner has no player state");
  }
  const stale = customId.revision !== snapshot.revision;

  if (customId.view === "market" && customId.action === "page") {
    let marketPageTarget: string | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing captured Market page");
      }
      if (customId.value.startsWith("k-")) {
        const kind = decodeDiscordHeroMarketKind(
          runtime.communityMarket,
          runtime.indexes,
          customId.value,
        );
        marketPageTarget = encodeDiscordHeroMarketPage(
          runtime.communityMarket,
          runtime.indexes,
          kind,
          0,
        );
      } else {
        const page = decodeDiscordHeroMarketPage(
          runtime.communityMarket,
          runtime.indexes,
          customId.value,
        );
        discordHeroMarketPage(
          runtime.communityMarket,
          runtime.indexes,
          page.kind,
          page.page,
        );
        marketPageTarget = encodeDiscordHeroMarketPage(
          runtime.communityMarket,
          runtime.indexes,
          page.kind,
          page.page,
        );
      }
    } catch {
      marketPageTarget = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "market",
          snapshot,
          runtime.indexes,
          marketPageTarget === null
            ? "This component does not name a valid captured Market page or filter."
            : stale
              ? "State changed; the read-only captured Market page was refreshed."
              : undefined,
          marketPageTarget === null ? {} : { marketPageTarget },
          undefined,
          runtime.communityMarket,
        ),
      ),
    );
    return;
  }

  if (customId.view === "heroes" && customId.action === "page") {
    let location:
      | {
          heroKey: number;
          heroTab: "overview";
        }
      | {
          heroKey: number;
          heroTab: "attributes";
          attributePageTarget: string;
        }
      | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing Hero tab target");
      }
      if (customId.value.startsWith("h-")) {
        location = {
          heroKey: decodeDiscordHeroAttributeHero(
            runtime.indexes,
            customId.value,
          ),
          heroTab: "overview",
        };
      } else {
        const page = discordHeroAttributePage(
          runtime.indexes,
          snapshot.state,
          customId.value,
        );
        location = {
          heroKey: page.HeroKey,
          heroTab: "attributes",
          attributePageTarget: page.pageTarget,
        };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "heroes",
          snapshot,
          runtime.indexes,
          location === null
            ? "This component does not name a valid Hero tab or Attribute page."
            : stale
              ? location.heroTab === "attributes"
                ? "State changed; the read-only Attribute page was refreshed."
                : "State changed; the read-only Hero overview was refreshed."
              : undefined,
          location ?? {},
        ),
      ),
    );
    return;
  }

  if (customId.view === "inventory" && customId.action === "page") {
    if (customId.value?.startsWith("ef-")) {
      if (stale) {
        await interaction.update(
          boardPayload(
            renderDiscordHeroReadOnlyWorkspace(
              interaction.user.id,
              "inventory",
              snapshot,
              runtime,
              "State changed; Item Effects were closed before resolving equipped gear.",
              null,
            ),
          ),
        );
        return;
      }
      let location: DiscordHeroWorkspaceLocation | null = null;
      try {
        const target = decodeDiscordHeroItemEffectsPageTarget(
          runtime.indexes,
          customId.value,
        );
        const resolved = resolveDiscordHeroItemEffectsTarget(
          runtime.indexes,
          snapshot.state,
          target,
        );
        discordHeroItemEffectsPage(resolved.input, {
          sourceVector: target.sourceVector,
          page: target.effectPage,
        });
        location = {
          equipmentPage: target.equipmentPage,
          equipmentSelection: resolved.equipmentSelection,
          itemEffects: {
            sourceVector: target.sourceVector,
            page: target.effectPage,
          },
        };
      } catch {
        location = null;
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroReadOnlyWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime,
            location === null
              ? "This component does not name Item Effects on the bound equipment page and source page."
              : undefined,
            location,
          ),
        ),
      );
      return;
    }

    if (customId.value?.startsWith("cp-")) {
      let containerPage: ReturnType<
        typeof projectDiscordHeroContainerPage
      > | null = null;
      try {
        containerPage = projectDiscordHeroContainerPage(
          runtime.indexes,
          snapshot.state,
          customId.value,
        );
        if (containerPage.kind === "inventory" && containerPage.page !== 0) {
          throw new Error("Inventory tab must open the legacy root");
        }
      } catch {
        containerPage = null;
      }
      const location: DiscordHeroWorkspaceLocation =
        containerPage === null || containerPage.kind === "inventory"
          ? {}
          : { containerPageTarget: containerPage.pageTarget };
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            containerPage === null
              ? "This component does not name a valid bound Container page."
              : stale
                ? `State changed; the read-only ${containerPage.label} page was refreshed.`
                : undefined,
            location,
          ),
        ),
      );
      return;
    }

    let location: {
      inventoryPage?: number;
      inventoryFilter?: ReturnType<typeof decodeDiscordHeroInventoryFilter>;
      equipmentPage?: number;
      equipmentSelection?: { heroKey: number; gearType: string };
      freeInventoryPage?: number;
      inventorySlotIndex?: number;
      rollPage?: number;
    } | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing Inventory page");
      }
      if (
        customId.value.startsWith("ri-") ||
        customId.value.startsWith("rq-")
      ) {
        const target = decodeDiscordHeroRollPageTarget(
          runtime.indexes,
          customId.value,
        );
        if (target.kind === "inventory") {
          const selected = discordHeroInventorySlots(
            runtime.indexes,
            snapshot.state,
            target.inventoryFilter,
            target.inventoryPage,
          ).find((slot) => slot.index === target.inventorySlotIndex);
          if (selected?.asset.kind !== "gear") {
            throw new Error("gear is outside the bound Inventory page");
          }
          const asset = readDiscordHeroStoredAsset(
            runtime.indexes,
            selected.asset,
          );
          if (discordHeroRolledStatPageCount(asset) < 2) {
            throw new Error("asset has no rolled-stat pagination control");
          }
          discordHeroRolledStats(asset, target.rollPage);
          location = {
            inventoryFilter: target.inventoryFilter,
            inventoryPage: target.inventoryPage,
            inventorySlotIndex: target.inventorySlotIndex,
            rollPage: target.rollPage,
          };
        } else {
          const selected = discordHeroEquippedGear(
            snapshot.state,
            target.equipmentPage,
            runtime.indexes,
          ).find(
            (entry) =>
              entry.heroKey === target.heroKey &&
              entry.gearType === target.gearType,
          );
          if (selected === undefined) {
            throw new Error("gear is outside the bound equipment page");
          }
          const asset = readDiscordHeroStoredAsset(
            runtime.indexes,
            selected.asset,
          );
          if (discordHeroRolledStatPageCount(asset) < 2) {
            throw new Error("asset has no rolled-stat pagination control");
          }
          discordHeroRolledStats(asset, target.rollPage);
          location = {
            equipmentPage: target.equipmentPage,
            equipmentSelection: {
              heroKey: target.heroKey,
              gearType: target.gearType,
            },
            rollPage: target.rollPage,
          };
        }
      } else if (customId.value.startsWith("i-")) {
        const target = decodeDiscordHeroInventoryPage(
          runtime.indexes,
          customId.value,
        );
        discordHeroInventorySlots(
          runtime.indexes,
          snapshot.state,
          target.inventoryFilter,
          target.inventoryPage,
        );
        location = target;
      } else if (customId.value.startsWith("q-")) {
        const equipmentPage = decodeDiscordHeroEquipmentPage(customId.value);
        discordHeroEquippedGear(snapshot.state, equipmentPage, runtime.indexes);
        location = { equipmentPage };
      } else {
        const target = decodeDiscordHeroUnequipTarget(customId.value);
        const equipped = discordHeroEquippedGear(
          snapshot.state,
          target.equipmentPage,
          runtime.indexes,
        );
        if (
          !equipped.some(
            (entry) =>
              entry.heroKey === target.heroKey &&
              entry.gearType === target.gearType,
          )
        ) {
          throw new Error("equipment is outside the bound page");
        }
        discordHeroFreeInventorySlots(snapshot.state, target.freeInventoryPage);
        location = {
          equipmentPage: target.equipmentPage,
          equipmentSelection: {
            heroKey: target.heroKey,
            gearType: target.gearType,
          },
          freeInventoryPage: target.freeInventoryPage,
        };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "inventory",
          snapshot,
          runtime.indexes,
          location === null
            ? customId.value?.startsWith("r")
              ? "This component does not name rolled stats on the bound selection page."
              : "This component does not name a valid bound Inventory page."
            : stale
              ? customId.value?.startsWith("r")
                ? "State changed; the read-only rolled-stat page was refreshed."
                : "State changed; the read-only Inventory page was refreshed."
              : undefined,
          location ?? {},
        ),
      ),
    );
    return;
  }

  if (customId.view === "world" && customId.action === "page") {
    let worldPage: number | null = null;
    try {
      if (customId.value === undefined) throw new Error("missing stage page");
      worldPage = decodeDiscordHeroStagePage(customId.value);
      discordHeroStages(runtime.indexes, worldPage);
    } catch {
      worldPage = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "world",
          snapshot,
          runtime.indexes,
          worldPage === null
            ? "This component does not name a valid World page."
            : stale
              ? "State changed; the read-only World page was refreshed."
              : undefined,
          { worldPage: worldPage ?? 0 },
        ),
      ),
    );
    return;
  }

  if (customId.view === "runes" && customId.action === "page") {
    let runePage: number | null = null;
    let skillPage: number | null = null;
    try {
      if (customId.value === undefined) throw new Error("missing Rune page");
      if (
        customId.value.startsWith("s-") ||
        customId.value.startsWith("t-s-")
      ) {
        skillPage = decodeDiscordHeroSkillPage(
          customId.value.startsWith("t-")
            ? customId.value.slice(2)
            : customId.value,
        );
        discordHeroSkills(runtime.indexes, skillPage);
      } else {
        runePage = decodeDiscordHeroRunePage(
          customId.value.startsWith("t-")
            ? customId.value.slice(2)
            : customId.value,
        );
        discordHeroRunes(runtime.indexes, runePage);
      }
    } catch {
      runePage = null;
      skillPage = null;
    }
    const isSkillPage =
      customId.value?.startsWith("s-") ||
      customId.value?.startsWith("t-s-") ||
      false;
    const validPage = isSkillPage ? skillPage !== null : runePage !== null;
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "runes",
          snapshot,
          runtime.indexes,
          !validPage
            ? `This component does not name a valid ${isSkillPage ? "Skill" : "Rune"} page.`
            : stale
              ? `State changed; the read-only ${isSkillPage ? "Skill" : "Rune"} page was refreshed.`
              : undefined,
          isSkillPage
            ? { runeTab: "skills", skillPage: skillPage ?? 0 }
            : { runeTab: "runes", runePage: runePage ?? 0 },
        ),
      ),
    );
    return;
  }

  if (customId.view === "collection" && customId.action === "page") {
    let location:
      | {
          collectionTab: "pets" | "skins";
          collectionPage: number;
        }
      | {
          collectionTab: "achievements";
          achievementPage: number;
        }
      | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing Collection page");
      }
      if (customId.value === "t-c-p" || customId.value === "t-c-s") {
        location = {
          collectionTab: customId.value === "t-c-p" ? "pets" : "skins",
          collectionPage: 0,
        };
      } else if (customId.value === "t-c-a") {
        location = { collectionTab: "achievements", achievementPage: 0 };
      } else if (customId.value.startsWith("c-")) {
        const page = decodeDiscordHeroCollectionPage(customId.value);
        if (page.kind === "pets") {
          discordHeroCollectionRows(runtime.indexes, "pets", page.page);
        } else {
          discordHeroCollectionRows(runtime.indexes, "skins", page.page);
        }
        location = {
          collectionTab: page.kind,
          collectionPage: page.page,
        };
      } else {
        const achievementPage = decodeDiscordHeroAchievementPage(
          runtime.communityAchievements,
          customId.value,
        );
        location = { collectionTab: "achievements", achievementPage };
      }
    } catch {
      location = null;
    }
    const pageName =
      location?.collectionTab === "skins"
        ? "Skins"
        : location?.collectionTab === "achievements"
          ? "Achievements"
          : "Pets";
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "collection",
          snapshot,
          runtime.indexes,
          location === null
            ? "This component does not name a valid Collection page."
            : stale
              ? `State changed; the read-only ${pageName} page was refreshed.`
              : undefined,
          location ?? {},
          runtime.communityAchievements,
        ),
      ),
    );
    return;
  }

  if (customId.view === "cube" && customId.action === "page") {
    let location:
      | {
          cubeTab: "browse";
          cubePageTarget: string;
        }
      | {
          cubeTab: "alchemy";
          alchemyPage: number;
        }
      | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("Cube page is missing");
      }
      if (customId.value === "t-c-b") {
        location = {
          cubeTab: "browse",
          cubePageTarget: encodeDiscordHeroCubePage({
            kind: "main-recipes",
            page: 0,
          }),
        };
      } else if (customId.value === "t-c-a") {
        location = { cubeTab: "alchemy", alchemyPage: 0 };
      } else if (
        customId.value.startsWith("m-") ||
        customId.value.startsWith("s-")
      ) {
        const page = decodeDiscordHeroCubePage(customId.value);
        if (page.kind === "main-recipes") {
          discordHeroCubeMainRecipeOptions(
            runtime.indexes,
            snapshot.state,
            page.page,
          );
        } else {
          discordHeroCubeSubRecipeOptions(
            runtime.indexes,
            snapshot.state,
            page.cubeKey,
            page.page,
          );
        }
        location = {
          cubeTab: "browse",
          cubePageTarget: encodeDiscordHeroCubePage(page),
        };
      } else {
        if (!isDiscordHeroAlchemyUnlocked(snapshot.state)) {
          throw new Error("Alchemy page is unavailable");
        }
        const alchemyPage = decodeDiscordHeroAlchemyPage(customId.value);
        discordHeroAlchemyOptions(runtime.indexes, snapshot.state, alchemyPage);
        location = { cubeTab: "alchemy", alchemyPage };
      }
    } catch {
      location = null;
    }
    const requestedAlchemy =
      customId.value === "t-c-a" || customId.value?.startsWith("a-") || false;
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "cube",
          snapshot,
          runtime.indexes,
          location === null
            ? requestedAlchemy
              ? isDiscordHeroAlchemyUnlocked(snapshot.state)
                ? "This component does not name a valid Alchemy page."
                : "Alchemy recipe is locked."
              : "This component does not name a valid Cube Browse page."
            : stale
              ? location.cubeTab === "alchemy"
                ? "State changed; the read-only Alchemy page was refreshed."
                : "State changed; the read-only Cube Browse page was refreshed."
              : location.cubeTab === "alchemy" &&
                  !isDiscordHeroAlchemyUnlocked(snapshot.state)
                ? "Alchemy recipe is locked."
                : undefined,
          location ??
            (requestedAlchemy
              ? { cubeTab: "alchemy", alchemyPage: 0 }
              : {
                  cubeTab: "browse",
                  cubePageTarget: encodeDiscordHeroCubePage({
                    kind: "main-recipes",
                    page: 0,
                  }),
                }),
        ),
      ),
    );
    return;
  }

  if (customId.view === "codex" && customId.action === "page") {
    const communityRequested =
      customId.value === "ct" ||
      customId.value?.startsWith("cl-") ||
      customId.value?.startsWith("cc-") ||
      false;
    let workspaceLocation: DiscordHeroWorkspaceLocation | null = null;
    if (customId.value === "ct") {
      workspaceLocation = {
        codexTab: "community",
        communityCategory: "builds",
        communityListPage: 0,
      };
    } else if (customId.value?.startsWith("cl-")) {
      try {
        const location = decodeDiscordHeroCommunityListPage(
          runtime.communityContent,
          customId.value,
        );
        workspaceLocation = {
          codexTab: "community",
          communityCategory: location.category,
          communityListPage: location.listPage,
        };
      } catch {
        workspaceLocation = null;
      }
    } else if (customId.value?.startsWith("cc-")) {
      try {
        const location = decodeDiscordHeroCommunityChunkTarget(
          runtime.communityContent,
          customId.value,
        );
        readDiscordHeroCommunityContentDocument(
          runtime.communityContent,
          location.category,
          location.listPage,
          location.documentIndex,
          location.chunkPage,
        );
        workspaceLocation = {
          codexTab: "community",
          communityCategory: location.category,
          communityListPage: location.listPage,
          communityDocumentIndex: location.documentIndex,
          communityChunkPage: location.chunkPage,
        };
      } catch {
        workspaceLocation = null;
      }
    } else {
      let location =
        customId.value === "st"
          ? ({
              datasetPage: 0,
              datasetName: null,
              rowIndex: 0,
            } satisfies DiscordHeroCodexLocation)
          : decodeCodexPageLocation(customId.value);
      if (location !== null && location.datasetName !== null) {
        try {
          const record = readDiscordHeroCodexRecord(
            runtime.indexes,
            location.datasetName,
            location.rowIndex,
          );
          location = record.location;
        } catch {
          await interaction.update(
            boardPayload(
              renderCodexWorkspace(
                runtime,
                interaction.user.id,
                snapshot,
                "This component does not name a valid source row.",
              ),
            ),
          );
          return;
        }
      }
      if (location !== null) {
        workspaceLocation = { codexTab: "source-data", codex: location };
      }
    }
    if (workspaceLocation === null) {
      await interaction.update(
        boardPayload(
          renderCodexWorkspace(
            runtime,
            interaction.user.id,
            snapshot,
            communityRequested
              ? "This component does not name a valid Community page."
              : "This component does not name a valid Codex page.",
            {},
          ),
        ),
      );
      return;
    }
    await interaction.update(
      boardPayload(
        renderCodexWorkspace(
          runtime,
          interaction.user.id,
          snapshot,
          stale
            ? communityRequested
              ? "State changed; the read-only Community view was refreshed."
              : "State changed; the read-only Codex view was refreshed."
            : undefined,
          workspaceLocation,
        ),
      ),
    );
    return;
  }

  if (customId.view === "codex" && customId.action === "export") {
    if (customId.value?.startsWith("cc-")) {
      let detail;
      try {
        const target = decodeDiscordHeroCommunityChunkTarget(
          runtime.communityContent,
          customId.value,
        );
        detail = readDiscordHeroCommunityContentDocument(
          runtime.communityContent,
          target.category,
          target.listPage,
          target.documentIndex,
          target.chunkPage,
        );
      } catch {
        await interaction.update(
          boardPayload(
            renderCodexWorkspace(
              runtime,
              interaction.user.id,
              snapshot,
              "This component does not name a valid Community document.",
            ),
          ),
        );
        return;
      }
      const location = {
        codexTab: "community",
        communityCategory: detail.category,
        communityListPage: detail.listPage,
        communityDocumentIndex: detail.documentIndex,
        communityChunkPage: detail.chunkPage,
      } as const;
      if (stale) {
        await interaction.update(
          boardPayload(
            renderCodexWorkspace(
              runtime,
              interaction.user.id,
              snapshot,
              "State changed; refresh before exporting this Community document.",
              location,
            ),
          ),
        );
        return;
      }
      await interaction.reply({
        content: `${detail.document.frontmatter.title} · ${detail.document.path}`,
        files: [
          new AttachmentBuilder(Buffer.from(detail.document.markdown, "utf8"), {
            name: detail.exportFilename,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let record;
    try {
      if (customId.value === undefined) throw new Error("missing target");
      const target = decodeDiscordHeroCodexRecordTarget(customId.value);
      record = readDiscordHeroCodexRecord(
        runtime.indexes,
        target.datasetName,
        target.rowIndex,
      );
    } catch {
      await interaction.update(
        boardPayload(
          renderCodexWorkspace(
            runtime,
            interaction.user.id,
            snapshot,
            "This component does not name a valid source row.",
          ),
        ),
      );
      return;
    }
    if (stale) {
      await interaction.update(
        boardPayload(
          renderCodexWorkspace(
            runtime,
            interaction.user.id,
            snapshot,
            "State changed; refresh before exporting this source row.",
            { codex: record.location },
          ),
        ),
      );
      return;
    }
    await interaction.reply({
      content: `${record.location.datasetName} row ${record.location.rowIndex + 1}/${record.rowCount}`,
      files: [
        new AttachmentBuilder(Buffer.from(record.rawJson, "utf8"), {
          name: record.exportFilename,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.view === "heroes" && customId.action === "upgrade") {
    let location: {
      heroKey: number;
      heroTab: "attributes";
      attributePageTarget: string;
      attributeTarget: string;
    } | null = null;
    let target: ReturnType<typeof decodeDiscordHeroAttributeTarget> | null =
      null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing Attribute allocation target");
      }
      target = decodeDiscordHeroAttributeTarget(
        runtime.indexes,
        customId.value,
      );
      if (
        !snapshot.state.heroes.some((hero) => hero.heroKey === target!.heroKey)
      ) {
        throw new Error("Attribute Hero is not owned");
      }
      const attributePageTarget = encodeDiscordHeroAttributePage(
        runtime.indexes,
        target.heroKey,
        target.page,
      );
      const page = discordHeroAttributePage(
        runtime.indexes,
        snapshot.state,
        attributePageTarget,
      );
      if (!page.options.some((option) => option.target === customId.value)) {
        throw new Error("Attribute target is outside its bound Hero page");
      }
      readDiscordHeroAttributeDetail(
        runtime.indexes,
        snapshot.state,
        customId.value,
      );
      location = {
        heroKey: target.heroKey,
        heroTab: "attributes",
        attributePageTarget,
        attributeTarget: customId.value,
      };
    } catch {
      target = null;
      location = null;
    }
    if (target === null || location === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "heroes",
            snapshot,
            runtime.indexes,
            "This component does not name an owned Attribute on its bound Hero page.",
          ),
        ),
      );
      return;
    }
    if (stale) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "heroes",
            snapshot,
            runtime.indexes,
            "State changed; the Attribute quote was refreshed without allocating a point.",
            location,
          ),
        ),
      );
      return;
    }
    try {
      const result = allocateDiscordHeroAttributePoint(
        runtime.repository,
        runtime.indexes,
        {
          userId: interaction.user.id,
          interactionId: interaction.id,
          expectedRevision: customId.revision,
          heroKey: target.heroKey,
          attributeKey: target.attributeKey,
          nowMs: now(),
        },
      );
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) {
        throw new Error(
          "DiscordHero Attribute transaction lost its player state",
        );
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "heroes",
            after,
            runtime.indexes,
            attributeAllocationNotice(result.outcome),
            location,
          ),
        ),
      );
      return;
    } catch (error) {
      if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) throw error;
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "heroes",
            after,
            runtime.indexes,
            "Another action committed first; the Attribute quote was refreshed without allocating a point.",
            location,
          ),
        ),
      );
      return;
    }
  }

  if (customId.action === "unlock") {
    if (customId.view === "inventory") {
      const target = decodeDiscordHeroContainerUnlockTarget(customId.value);
      const originLocation = resolveContainerUnlockLocation(
        target,
        runtime.indexes,
        snapshot.state,
      );
      if (target !== null && originLocation !== null) {
        if (stale) {
          await interaction.update(
            boardPayload(
              renderDiscordHeroWorkspace(
                interaction.user.id,
                "inventory",
                snapshot,
                runtime.indexes,
                "State changed; this source quote was refreshed without spending gold.",
                originLocation,
              ),
            ),
          );
          return;
        }
        try {
          const result = unlockDiscordHeroContainerSlot(
            runtime.repository,
            runtime.indexes,
            {
              userId: interaction.user.id,
              interactionId: interaction.id,
              expectedRevision: customId.revision,
              container: target.container,
              nowMs: now(),
            },
          );
          const after = runtime.repository.getPlayer(interaction.user.id);
          if (after === null) {
            throw new Error(
              "DiscordHero container transaction lost its player state",
            );
          }
          await interaction.update(
            boardPayload(
              renderDiscordHeroWorkspace(
                interaction.user.id,
                "inventory",
                after,
                runtime.indexes,
                unlockNotice(result.outcome),
                resolveContainerUnlockLocation(
                  target,
                  runtime.indexes,
                  after.state,
                ) ?? originLocation,
              ),
            ),
          );
          return;
        } catch (error) {
          if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
          const after = runtime.repository.getPlayer(interaction.user.id);
          if (after === null) throw error;
          await interaction.update(
            boardPayload(
              renderDiscordHeroWorkspace(
                interaction.user.id,
                "inventory",
                after,
                runtime.indexes,
                "Another action committed first; the capacity quote was refreshed without spending gold.",
                resolveContainerUnlockLocation(
                  target,
                  runtime.indexes,
                  after.state,
                ) ?? originLocation,
              ),
            ),
          );
          return;
        }
      }
    }

    if (stale) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            customId.view,
            snapshot,
            runtime.indexes,
            "State changed; this source quote was refreshed without spending gold.",
          ),
        ),
      );
      return;
    }

    if (customId.view === "cube") {
      const cubeTarget = decodeCubeUnlockTarget(customId.value);
      if (cubeTarget !== null) {
        const cubeLocation =
          cubeTarget.cubeTab === "alchemy"
            ? ({ cubeTab: "alchemy", alchemyPage: 0 } as const)
            : ({
                cubeTab: "browse",
                cubePageTarget: encodeDiscordHeroCubePage({
                  kind: "main-recipes",
                  page: 0,
                }),
              } as const);
        try {
          const result = unlockDiscordHeroCubeRecipe(
            runtime.repository,
            runtime.indexes,
            {
              userId: interaction.user.id,
              interactionId: interaction.id,
              expectedRevision: customId.revision,
              cubeKey: cubeTarget.cubeKey,
              nowMs: now(),
            },
          );
          const after = runtime.repository.getPlayer(interaction.user.id);
          if (after === null) {
            throw new Error(
              "DiscordHero Cube transaction lost its player state",
            );
          }
          await interaction.update(
            boardPayload(
              renderDiscordHeroWorkspace(
                interaction.user.id,
                "cube",
                after,
                runtime.indexes,
                cubeUnlockNotice(result.outcome),
                cubeLocation,
              ),
            ),
          );
          return;
        } catch (error) {
          if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
          const after = runtime.repository.getPlayer(interaction.user.id);
          if (after === null) throw error;
          await interaction.update(
            boardPayload(
              renderDiscordHeroWorkspace(
                interaction.user.id,
                "cube",
                after,
                runtime.indexes,
                "Another action committed first; the Cube quote was refreshed without spending gold.",
                cubeLocation,
              ),
            ),
          );
          return;
        }
      }
    }

    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          customId.view,
          snapshot,
          runtime.indexes,
          "This component does not name a valid source-backed unlock action.",
        ),
      ),
    );
    return;
  }

  const unsupported = customId.action !== "view";
  const viewNotice = unsupported
    ? "This gameplay action remains oracle-gated and was not applied."
    : stale
      ? "State changed; this view was refreshed before accepting another action."
      : undefined;
  await interaction.update(
    boardPayload(
      renderDiscordHeroReadOnlyWorkspace(
        interaction.user.id,
        customId.view,
        snapshot,
        runtime,
        viewNotice,
        null,
      ),
    ),
  );
}

export async function handleSelect(
  interaction: StringSelectMenuInteraction,
  runtimeProvider: DiscordHeroRuntimeProvider = getDiscordHeroRuntime,
  now: () => number = Date.now,
): Promise<void> {
  const customId = decodeDiscordHeroCustomId(interaction.customId);
  try {
    assertDiscordHeroComponentOwner(customId, interaction.user.id);
  } catch {
    await interaction.reply({
      content: "Workspace này thuộc về người chơi khác.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const runtime = await runtimeProvider();
  const snapshot = runtime.repository.getPlayer(interaction.user.id);
  if (snapshot === null) {
    throw new Error("DiscordHero workspace owner has no player state");
  }
  const stale = customId.revision !== snapshot.revision;

  if (customId.view === "market" && customId.action === "select") {
    let location: {
      marketPageTarget: string;
      marketTarget: string;
    } | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid captured Market selection");
      }
      const decodedPage = decodeDiscordHeroMarketPage(
        runtime.communityMarket,
        runtime.indexes,
        customId.value,
      );
      const page = discordHeroMarketPage(
        runtime.communityMarket,
        runtime.indexes,
        decodedPage.kind,
        decodedPage.page,
      );
      const marketTarget = interaction.values[0]!;
      if (!page.options.some((option) => option.value === marketTarget)) {
        throw new Error(
          "Market target is outside the bound captured page and filter",
        );
      }
      const detail = readDiscordHeroMarketDetail(
        runtime.communityMarket,
        runtime.indexes,
        marketTarget,
      );
      if (
        detail.kind !== page.kind ||
        detail.page !== page.page ||
        detail.target !== marketTarget
      ) {
        throw new Error(
          "Market detail does not match the bound captured page and filter",
        );
      }
      location = {
        marketPageTarget: page.pageTarget,
        marketTarget,
      };
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "market",
          snapshot,
          runtime.indexes,
          location === null
            ? "This selection does not name a Market listing on the bound captured page and filter."
            : customId.revision !== snapshot.revision
              ? "State changed; the read-only captured Market inspection was refreshed."
              : undefined,
          location ?? {},
          undefined,
          runtime.communityMarket,
        ),
      ),
    );
    return;
  }

  if (
    customId.view === "cube" &&
    customId.action === "select" &&
    (customId.value?.startsWith("m-") || customId.value?.startsWith("s-"))
  ) {
    let location: {
      cubeTab: "browse";
      cubePageTarget: string;
      cubeTarget: string;
    } | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid Cube browser selection");
      }
      const page = decodeDiscordHeroCubePage(customId.value);
      const selectedValue = interaction.values[0]!;
      const target = decodeDiscordHeroCubeTarget(selectedValue);
      if (page.kind === "main-recipes") {
        if (target.kind !== "main-recipe" || target.page !== page.page) {
          throw new Error("Cube main target is outside the bound page");
        }
        const present = discordHeroCubeMainRecipeOptions(
          runtime.indexes,
          snapshot.state,
          page.page,
        ).some((option) => option.value === selectedValue);
        if (!present) {
          throw new Error("Cube main target is outside the bound page");
        }
        resolveDiscordHeroCubeTarget(
          runtime.indexes,
          snapshot.state,
          selectedValue,
        );
        location = {
          cubeTab: "browse",
          cubePageTarget: encodeDiscordHeroCubePage({
            kind: "sub-recipes",
            cubeKey: target.cubeKey,
            page: 0,
          }),
          cubeTarget: selectedValue,
        };
      } else {
        if (
          target.kind !== "sub-recipe" ||
          target.cubeKey !== page.cubeKey ||
          target.page !== page.page
        ) {
          throw new Error(
            "Cube sub-recipe target is outside the bound page and group",
          );
        }
        const present = discordHeroCubeSubRecipeOptions(
          runtime.indexes,
          snapshot.state,
          page.cubeKey,
          page.page,
        ).some((option) => option.value === selectedValue);
        if (!present) {
          throw new Error(
            "Cube sub-recipe target is outside the bound page and group",
          );
        }
        resolveDiscordHeroCubeTarget(
          runtime.indexes,
          snapshot.state,
          selectedValue,
        );
        location = {
          cubeTab: "browse",
          cubePageTarget: encodeDiscordHeroCubePage(page),
          cubeTarget: selectedValue,
        };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "cube",
          snapshot,
          runtime.indexes,
          location === null
            ? "This selection does not name a Cube recipe on the bound source page and group."
            : customId.revision !== snapshot.revision
              ? "State changed; the read-only Cube recipe inspection was refreshed."
              : undefined,
          location ?? {
            cubeTab: "browse",
            cubePageTarget: encodeDiscordHeroCubePage({
              kind: "main-recipes",
              page: 0,
            }),
          },
        ),
      ),
    );
    return;
  }

  if (customId.view === "cube" && customId.action === "alchemy") {
    let alchemyPage: number | null = null;
    let inventorySlotIndexes: readonly number[] | null = null;
    try {
      if (customId.value === undefined) {
        throw new Error("missing Alchemy page");
      }
      alchemyPage = decodeDiscordHeroAlchemyPage(customId.value);
      inventorySlotIndexes = interaction.values.map((value) =>
        decodeDiscordHeroInventorySlot(value),
      );
      if (inventorySlotIndexes.length < 1 || inventorySlotIndexes.length > 9) {
        throw new Error("invalid Alchemy selection size");
      }
    } catch {
      alchemyPage = null;
      inventorySlotIndexes = null;
    }

    if (alchemyPage === null || inventorySlotIndexes === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            "This selection does not name 1–9 unique items on the bound Alchemy page.",
            { alchemyPage: 0 },
          ),
        ),
      );
      return;
    }

    const input = {
      userId: interaction.user.id,
      interactionId: interaction.id,
      expectedRevision: customId.revision,
      inventorySlotIndexes,
      nowMs: now(),
    } as const;
    let receiptQuery;
    try {
      receiptQuery = createDiscordHeroAlchemyReceiptQuery(input);
    } catch {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            "This selection does not name 1–9 unique items on the bound Alchemy page.",
            { alchemyPage },
          ),
        ),
      );
      return;
    }
    const receipt =
      runtime.repository.getPlayerTransactionReceipt<AlchemizeItemsOutcome>(
        receiptQuery,
      );
    if (receipt !== null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            alchemyNotice(receipt.outcome),
            {
              alchemyPage: Math.min(
                alchemyPage,
                discordHeroAlchemyPageCount(snapshot.state) - 1,
              ),
            },
          ),
        ),
      );
      return;
    }

    if (!isDiscordHeroAlchemyUnlocked(snapshot.state)) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            "Alchemy recipe is locked.",
            { alchemyPage: 0 },
          ),
        ),
      );
      return;
    }

    try {
      discordHeroAlchemyDebits(snapshot.state, alchemyPage, interaction.values);
    } catch {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            "This selection does not name 1–9 unique items on the bound Alchemy page.",
            { alchemyPage: 0 },
          ),
        ),
      );
      return;
    }

    if (customId.revision !== snapshot.revision) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            snapshot,
            runtime.indexes,
            "State changed; the Alchemy selection was refreshed without consuming items.",
            { alchemyPage },
          ),
        ),
      );
      return;
    }

    try {
      const result = alchemizeDiscordHeroItems(
        runtime.repository,
        runtime.indexes,
        input,
      );
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) {
        throw new Error(
          "DiscordHero Alchemy transaction lost its player state",
        );
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            after,
            runtime.indexes,
            alchemyNotice(result.outcome),
            { alchemyPage: 0 },
          ),
        ),
      );
      return;
    } catch (error) {
      if (error instanceof ItemOracleRequiredError) {
        const after = runtime.repository.getPlayer(interaction.user.id);
        if (after === null) throw error;
        await interaction.update(
          boardPayload(
            renderDiscordHeroWorkspace(
              interaction.user.id,
              "cube",
              after,
              runtime.indexes,
              "Alchemy needs a source oracle for level:null material value; no items, gold, or Cube EXP changed.",
              { alchemyPage },
            ),
          ),
        );
        return;
      }
      if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) throw error;
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "cube",
            after,
            runtime.indexes,
            "Another action committed first; the Alchemy selection was refreshed without consuming items.",
            { alchemyPage: 0 },
          ),
        ),
      );
      return;
    }
  }

  if (customId.view === "inventory" && customId.action === "select") {
    if (
      customId.value?.startsWith("es-") ||
      customId.value?.startsWith("ef-")
    ) {
      if (stale) {
        await interaction.update(
          boardPayload(
            renderDiscordHeroReadOnlyWorkspace(
              interaction.user.id,
              "inventory",
              snapshot,
              runtime,
              "State changed; Item Effects were closed before resolving equipped gear.",
              null,
            ),
          ),
        );
        return;
      }
      let location: DiscordHeroWorkspaceLocation | null = null;
      try {
        if (interaction.values.length !== 1) {
          throw new Error("Item Effects selection must name exactly one value");
        }
        if (customId.value.startsWith("es-")) {
          const target = decodeDiscordHeroItemEffectsSectionTarget(
            runtime.indexes,
            customId.value,
          );
          const resolved = resolveDiscordHeroItemEffectsTarget(
            runtime.indexes,
            snapshot.state,
            target,
          );
          const section = decodeDiscordHeroItemEffectsSectionChoice(
            interaction.values[0]!,
          );
          if (section !== "summary") {
            discordHeroItemEffectsPage(resolved.input, {
              sourceVector: section,
              page: 0,
            });
          }
          location = {
            equipmentPage: target.equipmentPage,
            equipmentSelection: resolved.equipmentSelection,
            ...(section === "summary"
              ? {}
              : {
                  itemEffects: {
                    sourceVector: section,
                    page: 0,
                  },
                }),
          };
        } else {
          const target = decodeDiscordHeroItemEffectsPageTarget(
            runtime.indexes,
            customId.value,
          );
          const resolved = resolveDiscordHeroItemEffectsTarget(
            runtime.indexes,
            snapshot.state,
            target,
          );
          const page = discordHeroItemEffectsPage(resolved.input, {
            sourceVector: target.sourceVector,
            page: target.effectPage,
          });
          const rowIndex = decodeDiscordHeroItemEffectsRowIndex(
            interaction.values[0]!,
          );
          if (!page.rows.some((row) => row.rowIndex === rowIndex)) {
            throw new Error(
              "Item Effects row is outside the bound source page",
            );
          }
          discordHeroItemEffectsDetail(resolved.input, {
            sourceVector: target.sourceVector,
            rowIndex,
          });
          location = {
            equipmentPage: target.equipmentPage,
            equipmentSelection: resolved.equipmentSelection,
            itemEffects: {
              sourceVector: target.sourceVector,
              page: target.effectPage,
              rowIndex,
            },
          };
        }
      } catch {
        location = null;
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroReadOnlyWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime,
            location === null
              ? "This selection does not name an Item Effect on the bound equipment page and source page."
              : undefined,
            location,
          ),
        ),
      );
      return;
    }

    if (customId.value?.startsWith("cp-")) {
      let page: ReturnType<typeof projectDiscordHeroContainerPage> | null =
        null;
      let containerSlotTarget: string | null = null;
      try {
        if (interaction.values.length !== 1) {
          throw new Error("Container selection must name exactly one slot");
        }
        page = projectDiscordHeroContainerPage(
          runtime.indexes,
          snapshot.state,
          customId.value,
        );
        if (page.kind === "inventory") {
          throw new Error("Inventory uses its legacy occupied-slot selector");
        }
        containerSlotTarget = interaction.values[0]!;
        readDiscordHeroContainerSlot(
          runtime.indexes,
          snapshot.state,
          page,
          containerSlotTarget,
        );
      } catch {
        containerSlotTarget = null;
      }
      const location: DiscordHeroWorkspaceLocation =
        page === null || page.kind === "inventory"
          ? {}
          : {
              containerPageTarget: page.pageTarget,
              ...(containerSlotTarget === null ? {} : { containerSlotTarget }),
            };
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            containerSlotTarget === null
              ? "This selection does not name a Container slot on the bound source page and kind."
              : stale
                ? `State changed; the read-only ${page!.label} slot inspection was refreshed.`
                : undefined,
            location,
          ),
        ),
      );
      return;
    }

    if (customId.value === "fp" || customId.value === "fg") {
      let inventoryFilter: ReturnType<
        typeof decodeDiscordHeroInventoryFilter
      > | null = null;
      try {
        if (interaction.values.length !== 1) {
          throw new Error("Inventory filter must name exactly one value");
        }
        inventoryFilter = decodeDiscordHeroInventoryFilter(
          runtime.indexes,
          interaction.values[0]!,
        );
        if (
          (customId.value === "fg") !==
          (inventoryFilter.kind === "gear-type")
        ) {
          throw new Error("Inventory filter is outside the bound filter group");
        }
      } catch {
        inventoryFilter = null;
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            inventoryFilter === null
              ? "This selection does not name a source-backed Inventory filter."
              : stale
                ? "State changed; the read-only Inventory filter was refreshed."
                : undefined,
            {
              inventoryFilter:
                inventoryFilter ?? DISCORD_HERO_INVENTORY_ALL_FILTER,
              inventoryPage: 0,
            },
          ),
        ),
      );
      return;
    }

    let location: {
      inventoryFilter?: ReturnType<typeof decodeDiscordHeroInventoryFilter>;
      inventoryPage?: number;
      inventorySlotIndex?: number;
      equipmentPage?: number;
      equipmentSelection?: { heroKey: number; gearType: string };
    } | null = null;
    let invalidNotice = customId.value?.startsWith("i-")
      ? "This selection does not name an occupied slot on the bound Inventory page."
      : customId.value?.startsWith("q-")
        ? "This selection does not name equipped gear on the bound page."
        : "This selection does not name a bound Inventory item.";
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid Inventory selection");
      }
      if (customId.value.startsWith("i-")) {
        const target = decodeDiscordHeroInventoryPage(
          runtime.indexes,
          customId.value,
        );
        const slots = discordHeroInventorySlots(
          runtime.indexes,
          snapshot.state,
          target.inventoryFilter,
          target.inventoryPage,
        );
        const inventorySlotIndex = decodeDiscordHeroInventorySlot(
          interaction.values[0]!,
        );
        if (!slots.some((slot) => slot.index === inventorySlotIndex)) {
          throw new Error("slot is outside the bound page");
        }
        location = { ...target, inventorySlotIndex };
      } else {
        const equipmentPage = decodeDiscordHeroEquipmentPage(customId.value);
        const equipped = discordHeroEquippedGear(
          snapshot.state,
          equipmentPage,
          runtime.indexes,
        );
        const equipmentSelection = decodeDiscordHeroEquipmentSelection(
          interaction.values[0]!,
        );
        if (
          !equipped.some(
            (entry) =>
              entry.heroKey === equipmentSelection.heroKey &&
              entry.gearType === equipmentSelection.gearType,
          )
        ) {
          throw new Error("equipment is outside the bound page");
        }
        location = { equipmentPage, equipmentSelection };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "inventory",
          snapshot,
          runtime.indexes,
          location === null
            ? invalidNotice
            : stale
              ? "State changed; the Inventory selection was refreshed without moving gear."
              : undefined,
          location === null || stale ? {} : location,
        ),
      ),
    );
    return;
  }

  if (customId.view === "inventory" && customId.action === "equip") {
    let target: ReturnType<typeof decodeDiscordHeroEquipTarget> | null = null;
    let heroKey: number | null = null;
    let targetIsBound = false;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid equip selection");
      }
      const decodedTarget = decodeDiscordHeroEquipTarget(
        runtime.indexes,
        customId.value,
      );
      target = decodedTarget;
      const slots = discordHeroInventorySlots(
        runtime.indexes,
        snapshot.state,
        decodedTarget.inventoryFilter,
        decodedTarget.inventoryPage,
      );
      if (
        !slots.some((slot) => slot.index === decodedTarget.inventorySlotIndex)
      ) {
        throw new Error("gear is outside the bound Inventory page");
      }
      targetIsBound = true;
      heroKey = decodeDiscordHeroHeroKey(interaction.values[0]!);
    } catch {
      if (!targetIsBound) target = null;
      heroKey = null;
    }
    if (target === null || heroKey === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            "This selection does not name a compatible owned Hero for gear on the bound Inventory page.",
            target === null
              ? {}
              : {
                  inventoryFilter: target.inventoryFilter,
                  inventoryPage: target.inventoryPage,
                  inventorySlotIndex: target.inventorySlotIndex,
                },
          ),
        ),
      );
      return;
    }
    if (customId.revision !== snapshot.revision) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            "State changed; the Inventory action was refreshed without moving gear.",
          ),
        ),
      );
      return;
    }
    if (
      !discordHeroCompatibleEquipHeroes(
        runtime.indexes,
        snapshot.state,
        target.inventorySlotIndex,
      ).some((hero) => hero.heroKey === heroKey)
    ) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            "This selection does not name a compatible owned Hero for gear on the bound Inventory page.",
            {
              inventoryFilter: target.inventoryFilter,
              inventoryPage: target.inventoryPage,
              inventorySlotIndex: target.inventorySlotIndex,
            },
          ),
        ),
      );
      return;
    }
    try {
      const result = equipDiscordHeroGear(runtime.repository, runtime.indexes, {
        userId: interaction.user.id,
        interactionId: interaction.id,
        expectedRevision: customId.revision,
        heroKey,
        inventorySlotIndex: target.inventorySlotIndex,
        nowMs: now(),
      });
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) {
        throw new Error("DiscordHero equip transaction lost its player state");
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            after,
            runtime.indexes,
            equipGearNotice(runtime, result.outcome),
            {
              inventoryFilter: target.inventoryFilter,
              inventoryPage: Math.min(
                target.inventoryPage,
                discordHeroInventoryPageCount(
                  runtime.indexes,
                  after.state,
                  target.inventoryFilter,
                ) - 1,
              ),
            },
          ),
        ),
      );
      return;
    } catch (error) {
      if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) throw error;
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            after,
            runtime.indexes,
            "Another action committed first; the Inventory action was refreshed without moving gear.",
          ),
        ),
      );
      return;
    }
  }

  if (customId.view === "inventory" && customId.action === "unequip") {
    let target: ReturnType<typeof decodeDiscordHeroUnequipTarget> | null = null;
    let inventorySlotIndex: number | null = null;
    let targetIsBound = false;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid unequip selection");
      }
      const decodedTarget = decodeDiscordHeroUnequipTarget(customId.value);
      target = decodedTarget;
      const equipped = discordHeroEquippedGear(
        snapshot.state,
        decodedTarget.equipmentPage,
        runtime.indexes,
      );
      if (
        !equipped.some(
          (entry) =>
            entry.heroKey === decodedTarget.heroKey &&
            entry.gearType === decodedTarget.gearType,
        )
      ) {
        throw new Error("equipment is outside the bound page");
      }
      const freeSlots = discordHeroFreeInventorySlots(
        snapshot.state,
        decodedTarget.freeInventoryPage,
      );
      targetIsBound = true;
      inventorySlotIndex = decodeDiscordHeroInventorySlot(
        interaction.values[0]!,
      );
      if (!freeSlots.includes(inventorySlotIndex)) {
        throw new Error("Inventory slot is outside the bound free page");
      }
    } catch {
      if (!targetIsBound) target = null;
      inventorySlotIndex = null;
    }
    if (target === null || inventorySlotIndex === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            "This selection does not name a free Inventory slot on the bound page.",
            target === null
              ? {}
              : {
                  equipmentPage: target.equipmentPage,
                  equipmentSelection: {
                    heroKey: target.heroKey,
                    gearType: target.gearType,
                  },
                  freeInventoryPage: target.freeInventoryPage,
                },
          ),
        ),
      );
      return;
    }
    if (customId.revision !== snapshot.revision) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            snapshot,
            runtime.indexes,
            "State changed; the Inventory action was refreshed without moving gear.",
          ),
        ),
      );
      return;
    }
    try {
      const result = unequipDiscordHeroGear(
        runtime.repository,
        runtime.indexes,
        {
          userId: interaction.user.id,
          interactionId: interaction.id,
          expectedRevision: customId.revision,
          heroKey: target.heroKey,
          gearType: target.gearType,
          inventorySlotIndex,
          nowMs: now(),
        },
      );
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) {
        throw new Error(
          "DiscordHero unequip transaction lost its player state",
        );
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            after,
            runtime.indexes,
            unequipGearNotice(runtime, result.outcome),
          ),
        ),
      );
      return;
    } catch (error) {
      if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) throw error;
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "inventory",
            after,
            runtime.indexes,
            "Another action committed first; the Inventory action was refreshed without moving gear.",
          ),
        ),
      );
      return;
    }
  }

  if (customId.view === "heroes" && customId.action === "select") {
    let location:
      | {
          heroKey: number;
          heroTab: "overview";
        }
      | {
          heroKey: number;
          heroTab: "attributes";
          attributePageTarget: string;
          attributeTarget: string;
        }
      | null = null;
    const attributeSelection = customId.value !== undefined;
    try {
      if (interaction.values.length !== 1) {
        throw new Error("invalid Hero selection");
      }
      if (customId.value === undefined) {
        const heroKey = decodeDiscordHeroHeroKey(interaction.values[0]!);
        if (
          !discordHeroHeroes(runtime.indexes).some(
            (hero) => hero.HeroKey === heroKey,
          )
        ) {
          throw new Error("Hero key is absent from the source roster");
        }
        location = { heroKey, heroTab: "overview" };
      } else {
        const page = discordHeroAttributePage(
          runtime.indexes,
          snapshot.state,
          customId.value,
        );
        const attributeTarget = interaction.values[0]!;
        if (!page.options.some((option) => option.target === attributeTarget)) {
          throw new Error("Attribute target is outside the bound Hero page");
        }
        readDiscordHeroAttributeDetail(
          runtime.indexes,
          snapshot.state,
          attributeTarget,
        );
        location = {
          heroKey: page.HeroKey,
          heroTab: "attributes",
          attributePageTarget: page.pageTarget,
          attributeTarget,
        };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "heroes",
          snapshot,
          runtime.indexes,
          location === null
            ? attributeSelection
              ? "This selection does not name an Attribute on the bound Hero page."
              : "This selection does not name a source Hero."
            : customId.revision !== snapshot.revision
              ? location.heroTab === "attributes"
                ? "State changed; the read-only Attribute inspection was refreshed."
                : "State changed; the read-only Hero inspection was refreshed."
              : undefined,
          location ?? {},
        ),
      ),
    );
    return;
  }

  if (customId.view === "world" && customId.action === "select") {
    let worldPage: number | null = null;
    let stageKey: number | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid stage selection");
      }
      worldPage = decodeDiscordHeroStagePage(customId.value);
      const pageRows = discordHeroStages(runtime.indexes, worldPage);
      stageKey = decodeDiscordHeroStageKey(interaction.values[0]!);
      if (!pageRows.some((stage) => stage.StageKey === stageKey)) {
        throw new Error("stage key is outside the selected page");
      }
    } catch {
      worldPage = null;
      stageKey = null;
    }
    if (worldPage === null || stageKey === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "world",
            snapshot,
            runtime.indexes,
            "This selection does not name a stage on the bound source page.",
            { worldPage: 0 },
          ),
        ),
      );
      return;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "world",
          snapshot,
          runtime.indexes,
          customId.revision !== snapshot.revision
            ? "State changed; the read-only stage inspection was refreshed."
            : undefined,
          { worldPage, stageKey },
        ),
      ),
    );
    return;
  }

  if (customId.view === "collection" && customId.action === "select") {
    let location:
      | {
          collectionTab: "pets" | "skins";
          collectionPage: number;
          collectionKey: number;
        }
      | {
          collectionTab: "achievements";
          achievementPage: number;
          achievementRowIndex: number;
        }
      | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid Collection selection");
      }
      if (customId.value.startsWith("c-")) {
        const page = decodeDiscordHeroCollectionPage(customId.value);
        const collectionKey = decodeDiscordHeroCollectionKey(
          page.kind,
          interaction.values[0]!,
        );
        const targetIsPresent =
          page.kind === "pets"
            ? discordHeroCollectionRows(
                runtime.indexes,
                "pets",
                page.page,
              ).some((row) => row.PetKey === collectionKey)
            : discordHeroCollectionRows(
                runtime.indexes,
                "skins",
                page.page,
              ).some((row) => row.PcSkinKey === collectionKey);
        if (!targetIsPresent) {
          throw new Error("Collection key is outside the selected page");
        }
        location = {
          collectionTab: page.kind,
          collectionPage: page.page,
          collectionKey,
        };
      } else {
        const achievementPage = decodeDiscordHeroAchievementPage(
          runtime.communityAchievements,
          customId.value,
        );
        const achievementRowIndex = decodeDiscordHeroAchievementTarget(
          runtime.communityAchievements,
          interaction.values[0]!,
        );
        const detail = readDiscordHeroAchievementDetail(
          runtime.communityAchievements,
          achievementRowIndex,
        );
        if (detail.page !== achievementPage) {
          throw new Error("Achievement is outside the selected page");
        }
        location = {
          collectionTab: "achievements",
          achievementPage,
          achievementRowIndex,
        };
      }
    } catch {
      location = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "collection",
          snapshot,
          runtime.indexes,
          location === null
            ? "This selection does not name a Collection entry on the bound source page."
            : customId.revision !== snapshot.revision
              ? "State changed; the read-only Collection inspection was refreshed."
              : undefined,
          location ?? {},
          runtime.communityAchievements,
        ),
      ),
    );
    return;
  }

  if (customId.view === "runes" && customId.action === "select") {
    let skillPage: number | null = null;
    let skillRowIndex: number | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid Skill selection");
      }
      skillPage = decodeDiscordHeroSkillPage(customId.value);
      const pageRows = discordHeroSkills(runtime.indexes, skillPage);
      skillRowIndex = decodeDiscordHeroSkillTarget(interaction.values[0]!);
      readDiscordHeroSkill(
        runtime.indexes,
        encodeDiscordHeroSkillTarget(skillRowIndex),
      );
      if (
        !pageRows.some(
          (skill) =>
            runtime.indexes.tables.skills.rows.indexOf(skill) === skillRowIndex,
        )
      ) {
        throw new Error("Skill row is outside the selected page");
      }
    } catch {
      skillPage = null;
      skillRowIndex = null;
    }
    await interaction.update(
      boardPayload(
        renderDiscordHeroWorkspace(
          interaction.user.id,
          "runes",
          snapshot,
          runtime.indexes,
          skillPage === null || skillRowIndex === null
            ? "This selection does not name a Skill on the bound source page."
            : customId.revision !== snapshot.revision
              ? "State changed; the read-only Skill inspection was refreshed."
              : undefined,
          {
            runeTab: "skills",
            skillPage: skillPage ?? 0,
            ...(skillRowIndex === null ? {} : { skillRowIndex }),
          },
        ),
      ),
    );
    return;
  }

  if (customId.view === "runes" && customId.action === "upgrade") {
    validatePlayerAgainstCatalog(snapshot.state, runtime.indexes);
    let runePage: number | null = null;
    let runeKey: number | null = null;
    try {
      if (customId.value === undefined || interaction.values.length !== 1) {
        throw new Error("invalid Rune selection");
      }
      runePage = decodeDiscordHeroRunePage(customId.value);
      const pageRows = discordHeroRunes(runtime.indexes, runePage);
      runeKey = decodeDiscordHeroRuneKey(interaction.values[0]!);
      if (!pageRows.some((rune) => rune.RuneKey === runeKey)) {
        throw new Error("Rune key is outside the selected page");
      }
    } catch {
      runePage = null;
      runeKey = null;
    }
    if (runePage === null || runeKey === null) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "runes",
            snapshot,
            runtime.indexes,
            "This selection does not name a Rune on the bound source page.",
            { runePage: 0 },
          ),
        ),
      );
      return;
    }
    if (customId.revision !== snapshot.revision) {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "runes",
            snapshot,
            runtime.indexes,
            "State changed; the Rune quote was refreshed without spending gold.",
            { runePage },
          ),
        ),
      );
      return;
    }
    const quote = quoteRuneUpgrade(runtime.indexes, snapshot.state, runeKey);
    if (quote.kind === "unsupported-effect") {
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "runes",
            snapshot,
            runtime.indexes,
            `${quote.statType} is oracle-gated; ${quote.name} cannot upgrade until that source effect has a reachable gameplay consumer.`,
            { runePage },
          ),
        ),
      );
      return;
    }
    try {
      const result = upgradeDiscordHeroRune(
        runtime.repository,
        runtime.indexes,
        {
          userId: interaction.user.id,
          interactionId: interaction.id,
          expectedRevision: customId.revision,
          runeKey,
          nowMs: now(),
        },
      );
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) {
        throw new Error("DiscordHero Rune transaction lost its player state");
      }
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "runes",
            after,
            runtime.indexes,
            runeUpgradeNotice(result.outcome),
            { runePage },
          ),
        ),
      );
      return;
    } catch (error) {
      if (!(error instanceof DiscordHeroRevisionConflictError)) throw error;
      const after = runtime.repository.getPlayer(interaction.user.id);
      if (after === null) throw error;
      await interaction.update(
        boardPayload(
          renderDiscordHeroWorkspace(
            interaction.user.id,
            "runes",
            after,
            runtime.indexes,
            "Another action committed first; the Rune quote was refreshed without spending gold.",
            { runePage },
          ),
        ),
      );
      return;
    }
  }

  if (
    customId.view === "codex" &&
    customId.action === "select" &&
    customId.value?.startsWith("cl-")
  ) {
    let listLocation: ReturnType<
      typeof decodeDiscordHeroCommunityListPage
    > | null = null;
    let documentLocation: ReturnType<
      typeof decodeDiscordHeroCommunityDocumentTarget
    > | null = null;
    try {
      listLocation = decodeDiscordHeroCommunityListPage(
        runtime.communityContent,
        customId.value,
      );
      if (interaction.values.length !== 1) {
        throw new Error("Community document selection must contain one value");
      }
      documentLocation = decodeDiscordHeroCommunityDocumentTarget(
        runtime.communityContent,
        interaction.values[0]!,
      );
      if (
        documentLocation.category !== listLocation.category ||
        documentLocation.listPage !== listLocation.listPage
      ) {
        throw new Error("Community document is outside the bound page");
      }
      readDiscordHeroCommunityContentDocument(
        runtime.communityContent,
        documentLocation.category,
        documentLocation.listPage,
        documentLocation.documentIndex,
        0,
      );
    } catch {
      documentLocation = null;
    }
    if (documentLocation === null) {
      await interaction.update(
        boardPayload(
          renderCodexWorkspace(
            runtime,
            interaction.user.id,
            snapshot,
            "This selection does not name a valid Community document.",
          ),
        ),
      );
      return;
    }
    await interaction.update(
      boardPayload(
        renderCodexWorkspace(
          runtime,
          interaction.user.id,
          snapshot,
          customId.revision !== snapshot.revision
            ? "State changed; the read-only Community view was refreshed."
            : undefined,
          {
            codexTab: "community",
            communityCategory: documentLocation.category,
            communityListPage: documentLocation.listPage,
            communityDocumentIndex: documentLocation.documentIndex,
            communityChunkPage: 0,
          },
        ),
      ),
    );
    return;
  }

  let location: DiscordHeroCodexLocation | null = null;
  try {
    if (
      customId.view !== "codex" ||
      customId.action !== "select" ||
      customId.value === undefined ||
      interaction.values.length !== 1
    ) {
      throw new Error("invalid Codex select");
    }
    const datasetPage = decodeDiscordHeroCodexDatasetPage(customId.value);
    const datasetName = interaction.values[0]!;
    if (
      !isDiscordHeroDatasetName(datasetName) ||
      !discordHeroCodexDatasets(datasetPage).includes(datasetName)
    ) {
      throw new Error("dataset is outside the selected page");
    }
    readDiscordHeroCodexRecord(runtime.indexes, datasetName, 0);
    location = { datasetPage, datasetName, rowIndex: 0 };
  } catch {
    location = null;
  }
  if (location === null) {
    await interaction.update(
      boardPayload(
        renderCodexWorkspace(
          runtime,
          interaction.user.id,
          snapshot,
          "This selection does not name a valid source dataset.",
        ),
      ),
    );
    return;
  }
  await interaction.update(
    boardPayload(
      renderCodexWorkspace(
        runtime,
        interaction.user.id,
        snapshot,
        customId.revision !== snapshot.revision
          ? "State changed; the read-only Codex view was refreshed."
          : undefined,
        { codex: location },
      ),
    ),
  );
}

export default {
  data,
  execute,
  handleButton,
  handleSelect,
} satisfies Command;
