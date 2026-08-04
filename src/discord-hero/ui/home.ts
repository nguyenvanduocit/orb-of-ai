import {
  getCatalogRow,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { stageEncounter } from "../domain/campaign";
import { quoteCubeRecipeUnlock } from "../domain/cube-unlocks";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import { deriveDiscordHeroFormationCapacity } from "../domain/party";
import { resolveOfflineRuneState } from "../domain/offline";
import {
  createLevelCurve,
  summarizeLevelProgress,
  type LevelProgressSummary,
} from "../domain/progression";
import type { PlayerSnapshot } from "../state/repository";

export interface DiscordHeroHomeHero {
  readonly heroKey: number;
  readonly name: string;
  readonly classType: string;
  readonly progression: LevelProgressSummary;
}

export type DiscordHeroHomePartySlot =
  | {
      readonly slot: number;
      readonly status: "empty";
      readonly hero: null;
    }
  | {
      readonly slot: number;
      readonly status: "locked";
      readonly hero: null;
    }
  | {
      readonly slot: number;
      readonly status: "occupied";
      readonly hero: DiscordHeroHomeHero;
    };

export interface DiscordHeroHomeInventory {
  readonly occupiedSlots: number;
  readonly unlockedSlots: number;
  readonly freeSlots: number;
}

export interface DiscordHeroHomeHighestStage {
  readonly stageKey: number;
  readonly name: string;
  readonly sourceLevel: number;
  readonly clearCount: number;
  readonly firstClearClaimed: boolean;
  readonly bestClearMs: number | null;
}

export type DiscordHeroHomeCampaign =
  | {
      readonly status: "not-started";
      readonly highestStage: null;
      readonly recordedStageCount: number;
    }
  | {
      readonly status: "progressed";
      readonly highestStage: DiscordHeroHomeHighestStage;
      readonly recordedStageCount: number;
    };

export type DiscordHeroHomeStageSession =
  | { readonly status: "idle" }
  | {
      readonly status: "active";
      readonly stageKey: number;
      readonly name: string;
      readonly wave: number;
      readonly startedAtMs: number;
      readonly advancedThroughMs: number;
      readonly rngCursor: number;
      readonly pendingItemCount: number;
    };

export interface DiscordHeroHomeOffline {
  readonly status: "locked" | "requires-runtime-oracle";
  readonly accrualCursorMs: number;
  readonly rewardStageLevel: number;
  readonly goldBonusPerThousand: number;
  readonly experienceBonusPerThousand: number;
  readonly creditedGold: 0;
  readonly creditedExperience: 0;
}

export type DiscordHeroHomeAlert =
  | {
      readonly kind: "empty-party-slots";
      readonly slots: readonly number[];
    }
  | {
      readonly kind: "inventory-full";
      readonly occupiedSlots: number;
      readonly unlockedSlots: number;
    }
  | {
      readonly kind: "cube-unlock-available";
      readonly cubeKey: number;
      readonly recipeType: string;
      readonly requiredCubeLevel: number;
      readonly cost: number;
    }
  | {
      readonly kind: "unresolved-stage-source";
      readonly stageKey: number;
      readonly missingMonsterKeys: readonly number[];
    };

export interface DiscordHeroHome {
  readonly revision: number;
  readonly gold: number;
  readonly heroes: readonly DiscordHeroHomeHero[];
  readonly party: readonly DiscordHeroHomePartySlot[];
  readonly inventory: DiscordHeroHomeInventory;
  readonly campaign: DiscordHeroHomeCampaign;
  readonly stageSession: DiscordHeroHomeStageSession;
  readonly offline: DiscordHeroHomeOffline;
  readonly alerts: readonly DiscordHeroHomeAlert[];
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function requireSnapshot(snapshot: PlayerSnapshot): void {
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new Error("Home snapshot must be an object");
  }
  const unknownField = Object.keys(snapshot).find(
    (field) => field !== "revision" && field !== "state",
  );
  if (unknownField !== undefined) {
    throw new Error(`Home snapshot has unknown field ${unknownField}`);
  }
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1) {
    throw new Error("Home snapshot revision must be a positive safe integer");
  }
  if (!Object.hasOwn(snapshot, "state")) {
    throw new Error("Home snapshot is missing state");
  }
}

export function projectDiscordHeroHome(
  snapshot: PlayerSnapshot,
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroHome {
  requireSnapshot(snapshot);
  const state = validatePlayerAgainstCatalog(snapshot.state, indexes);
  const ownedProgress = new Map(
    state.heroes.map((hero) => [hero.heroKey, hero]),
  );
  const levelCurve = createLevelCurve(
    indexes.tables.levels.rows.map((row) => ({
      level: row.Level,
      experienceForLevelUp: row.ExpForLevelUp,
    })),
  );
  const heroes = indexes.tables.heroes.rows.flatMap(
    (source): DiscordHeroHomeHero[] => {
      const progress = ownedProgress.get(source.HeroKey);
      if (progress === undefined) return [];
      if (source.ClassType.length === 0) {
        throw new Error(`hero ${source.HeroKey} has an empty source class`);
      }
      return [
        {
          heroKey: source.HeroKey,
          name: getLocalizedCatalogName(
            indexes,
            "heroes",
            source.HeroKey,
            "en-US",
          ),
          classType: source.ClassType,
          progression: summarizeLevelProgress(levelCurve, {
            level: progress.level,
            experience: progress.xp,
          }),
        },
      ];
    },
  );
  if (heroes.length !== state.heroes.length) {
    throw new Error("owned heroes do not resolve uniquely to source rows");
  }
  const heroModels = new Map(heroes.map((hero) => [hero.heroKey, hero]));

  const capacity = deriveDiscordHeroFormationCapacity(indexes, state.runes);
  const party = state.party.map((heroKey, index): DiscordHeroHomePartySlot => {
    const slot = index + 1;
    if (heroKey === null) {
      return slot <= capacity
        ? { slot, status: "empty", hero: null }
        : { slot, status: "locked", hero: null };
    }
    const hero = heroModels.get(heroKey);
    if (hero === undefined) {
      throw new Error(
        `party slot ${slot} has unresolved owned hero ${heroKey}`,
      );
    }
    return {
      slot,
      status: "occupied",
      hero: { ...hero, progression: { ...hero.progression } },
    };
  });

  const inventory: DiscordHeroHomeInventory = {
    occupiedSlots: state.containers.inventory.slots.length,
    unlockedSlots: state.containers.inventory.unlockedSlots,
    freeSlots:
      state.containers.inventory.unlockedSlots -
      state.containers.inventory.slots.length,
  };

  let campaign: DiscordHeroHomeCampaign;
  if (state.campaign.highestStageKey === null) {
    campaign = {
      status: "not-started",
      highestStage: null,
      recordedStageCount: state.campaign.stages.length,
    };
  } else {
    const stageKey = state.campaign.highestStageKey;
    const progress = state.campaign.stages.find(
      (stage) => stage.stageKey === stageKey,
    );
    if (progress === undefined) {
      throw new Error(
        `campaign highestStageKey ${stageKey} has no progress record`,
      );
    }
    const source = getCatalogRow(indexes, "stages", stageKey);
    campaign = {
      status: "progressed",
      highestStage: {
        stageKey,
        name: getLocalizedCatalogName(indexes, "stages", stageKey, "en-US"),
        sourceLevel: source.StageLevel,
        clearCount: progress.clearCount,
        firstClearClaimed: progress.firstClearClaimed,
        bestClearMs: progress.bestClearMs,
      },
      recordedStageCount: state.campaign.stages.length,
    };
  }

  let stageSession: DiscordHeroHomeStageSession;
  if (state.stageSession === null) {
    stageSession = { status: "idle" };
  } else {
    stageSession = {
      status: "active",
      stageKey: state.stageSession.stageKey,
      name: getLocalizedCatalogName(
        indexes,
        "stages",
        state.stageSession.stageKey,
        "en-US",
      ),
      wave: state.stageSession.wave,
      startedAtMs: state.stageSession.startedAtMs,
      advancedThroughMs: state.stageSession.advancedThroughMs,
      rngCursor: state.stageSession.rngCursor,
      pendingItemCount: state.stageSession.pendingRewards.items.length,
    };
  }

  const offlineRuneState = resolveOfflineRuneState(indexes, state.runes);
  const offline: DiscordHeroHomeOffline = {
    status: offlineRuneState.unlocked ? "requires-runtime-oracle" : "locked",
    accrualCursorMs: state.offline.accrualCursorMs,
    rewardStageLevel: state.offline.rewardStageLevel,
    goldBonusPerThousand: offlineRuneState.goldBonusPerThousand,
    experienceBonusPerThousand: offlineRuneState.experienceBonusPerThousand,
    creditedGold: 0,
    creditedExperience: 0,
  };

  const alerts: DiscordHeroHomeAlert[] = [];
  const emptySlots = party
    .filter((slot) => slot.status === "empty")
    .map((slot) => slot.slot);
  if (emptySlots.length > 0) {
    alerts.push({ kind: "empty-party-slots", slots: emptySlots });
  }
  if (inventory.freeSlots === 0) {
    alerts.push({
      kind: "inventory-full",
      occupiedSlots: inventory.occupiedSlots,
      unlockedSlots: inventory.unlockedSlots,
    });
  }
  for (const source of indexes.tables.cube_recipes.rows) {
    const quote = quoteCubeRecipeUnlock(indexes, state, source.CubeKey);
    if (quote.kind === "available" && quote.canAfford) {
      alerts.push({
        kind: "cube-unlock-available",
        cubeKey: quote.cubeKey,
        recipeType: quote.recipeType,
        requiredCubeLevel: quote.requiredCubeLevel,
        cost: quote.cost,
      });
    }
  }
  if (state.stageSession !== null) {
    const encounter = stageEncounter(indexes, {
      stageKey: state.stageSession.stageKey,
    });
    if (encounter.unresolvedMonsterKeys.length > 0) {
      alerts.push({
        kind: "unresolved-stage-source",
        stageKey: encounter.stageKey,
        missingMonsterKeys: [...encounter.unresolvedMonsterKeys].sort(
          (left, right) => left - right,
        ),
      });
    }
  }

  const projection: DiscordHeroHome = {
    revision: snapshot.revision,
    gold: state.gold,
    heroes,
    party,
    inventory,
    campaign,
    stageSession,
    offline,
    alerts,
  };
  return deepFreeze(structuredClone(projection)) as DiscordHeroHome;
}
