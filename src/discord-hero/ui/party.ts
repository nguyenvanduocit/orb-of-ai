import {
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import {
  deriveDiscordHeroFormationCapacity,
  type DiscordHeroFormationCapacity,
  type DiscordHeroPartySlot,
} from "../domain/party";
import type { PlayerState } from "../domain/player";

export type DiscordHeroPartySlotStatus = "occupied" | "empty" | "locked";

export interface DiscordHeroPartyOption {
  readonly heroKey: number;
  readonly label: string;
  readonly value: string;
}

export interface DiscordHeroPartySlotProjection {
  readonly slot: DiscordHeroPartySlot;
  readonly status: DiscordHeroPartySlotStatus;
  readonly heroKey: number | null;
  readonly heroName: string | null;
  readonly options: readonly DiscordHeroPartyOption[];
}

export interface DiscordHeroPartyProjection {
  readonly capacity: DiscordHeroFormationCapacity;
  readonly occupied: number;
  readonly slots: readonly DiscordHeroPartySlotProjection[];
}

const SLOT_PREFIX = "s-";

export function encodeDiscordHeroPartySlot(slot: DiscordHeroPartySlot): string {
  if (slot !== 1 && slot !== 2 && slot !== 3) {
    throw new Error(
      `DiscordHero party slot ${slot} is outside the three-slot party`,
    );
  }
  return `${SLOT_PREFIX}${slot}`;
}

export function decodeDiscordHeroPartySlot(
  value: string,
): DiscordHeroPartySlot {
  if (value !== "s-1" && value !== "s-2" && value !== "s-3") {
    throw new Error(`DiscordHero party slot token ${value} is not canonical`);
  }
  return Number(value.slice(SLOT_PREFIX.length)) as DiscordHeroPartySlot;
}

/**
 * What each formation slot may legally do right now. Options are the whole
 * point: an occupied slot can be replaced or swapped with any owned hero, the
 * first empty unlocked slot can only be filled by an undeployed one, and a
 * later empty slot offers nothing because filling it would leave a hole.
 */
export function projectDiscordHeroParty(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): DiscordHeroPartyProjection {
  const capacity = deriveDiscordHeroFormationCapacity(indexes, state.runes);
  const heroName = (heroKey: number) =>
    getLocalizedCatalogName(indexes, "heroes", heroKey, "en-US");

  const owned = state.heroes.map((hero) => ({
    heroKey: hero.heroKey,
    label: heroName(hero.heroKey),
    value: String(hero.heroKey),
  }));
  const deployed = new Set(
    state.party.filter((heroKey): heroKey is number => heroKey !== null),
  );
  const firstEmptyUnlocked = state.party.findIndex(
    (heroKey, index) => heroKey === null && index + 1 <= capacity,
  );

  const slots = state.party.map(
    (heroKey, index): DiscordHeroPartySlotProjection => {
      const slot = (index + 1) as DiscordHeroPartySlot;
      if (heroKey !== null) {
        return {
          slot,
          status: "occupied",
          heroKey,
          heroName: heroName(heroKey),
          options: Object.freeze(owned.map((option) => ({ ...option }))),
        };
      }
      if (slot > capacity) {
        return {
          slot,
          status: "locked",
          heroKey: null,
          heroName: null,
          options: Object.freeze([]),
        };
      }
      return {
        slot,
        status: "empty",
        heroKey: null,
        heroName: null,
        options: Object.freeze(
          index === firstEmptyUnlocked
            ? owned
                .filter((option) => !deployed.has(option.heroKey))
                .map((option) => ({ ...option }))
            : [],
        ),
      };
    },
  );

  return Object.freeze({
    capacity,
    occupied: deployed.size,
    slots: Object.freeze(slots),
  });
}
