import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import type { PlayerState } from "./player";
import { projectOwnedRuneSourceEffects } from "./rune-effects";

export const DISCORD_HERO_STARTER_KEYS = [101, 201, 301] as const;
export type DiscordHeroStarterKey = (typeof DISCORD_HERO_STARTER_KEYS)[number];
export type DiscordHeroFormationCapacity = 1 | 2 | 3;
export type DiscordHeroPartySlot = 1 | 2 | 3;

export interface DiscordHeroStarterCandidate {
  readonly heroKey: DiscordHeroStarterKey;
  readonly name: string;
  readonly classType: string;
}

export function discordHeroStarterCandidates(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroStarterCandidate[] {
  const starters = indexes.tables.heroes.rows.filter(
    (hero) => hero.IsFirstAvailable,
  );
  if (starters.length !== 3) {
    throw new Error("heroes must contain exactly three first-available rows");
  }
  for (const hero of starters) {
    if (!hero.IsAvailable) {
      throw new Error(`first-available hero ${hero.HeroKey} must be available`);
    }
  }
  if (
    starters.some(
      (hero, index) => hero.HeroKey !== DISCORD_HERO_STARTER_KEYS[index],
    )
  ) {
    throw new Error("starter heroes must use canonical order 101,201,301");
  }

  return Object.freeze(
    starters.map((hero) => {
      const name = hero.HeroNameKey_i18n["en-US"];
      if (typeof name !== "string" || name.length === 0) {
        throw new Error(`starter hero ${hero.HeroKey} name must be non-empty`);
      }
      if (typeof hero.ClassType !== "string" || hero.ClassType.length === 0) {
        throw new Error(
          `starter hero ${hero.HeroKey} class type must be non-empty`,
        );
      }
      return Object.freeze({
        heroKey: hero.HeroKey as DiscordHeroStarterKey,
        name,
        classType: hero.ClassType,
      });
    }),
  );
}

export function deriveDiscordHeroFormationCapacity(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: PlayerState["runes"],
): DiscordHeroFormationCapacity {
  let capacity = 1;
  for (const effect of projectOwnedRuneSourceEffects({ indexes, ownedRunes })
    .sourceEffects) {
    if (
      effect.kind !== "arrange-slot-source-metadata" ||
      effect.statType !== "UnlockArrangeSlotCount"
    ) {
      continue;
    }
    if (!Number.isSafeInteger(effect.rawValue) || effect.rawValue < 1) {
      throw new Error(
        "formation slot contribution must be a positive safe integer",
      );
    }
    capacity += effect.rawValue;
  }
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 3) {
    throw new Error(
      `formation capacity ${capacity} exceeds the three-slot party`,
    );
  }
  return capacity as DiscordHeroFormationCapacity;
}

export type ArrangePartySlotResult =
  | Readonly<{
      kind: "changed";
      transition: "fill" | "replace" | "swap";
      targetSlot: DiscordHeroPartySlot;
      selectedHeroKey: number;
      previousHeroKey: number | null;
      sourceSlot: DiscordHeroPartySlot | null;
      state: PlayerState;
    }>
  | Readonly<{ kind: "unchanged" }>
  | Readonly<{ kind: "slot-locked"; capacity: DiscordHeroFormationCapacity }>
  | Readonly<{ kind: "hero-not-owned" }>
  | Readonly<{ kind: "stage-active" }>
  | Readonly<{ kind: "invalid-target" }>;

export function arrangePartySlot(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  targetSlot: number,
  selectedHeroKey: number,
): ArrangePartySlotResult {
  if (
    !Number.isSafeInteger(targetSlot) ||
    targetSlot < 1 ||
    targetSlot > 3 ||
    !Number.isSafeInteger(selectedHeroKey) ||
    selectedHeroKey < 1
  ) {
    return Object.freeze({ kind: "invalid-target" });
  }
  if (state.stageSession !== null) {
    return Object.freeze({ kind: "stage-active" });
  }

  const capacity = deriveDiscordHeroFormationCapacity(indexes, state.runes);
  const partyIndex = targetSlot - 1;
  const previousHeroKey = state.party[partyIndex]!;
  if (previousHeroKey === selectedHeroKey) {
    return Object.freeze({ kind: "unchanged" });
  }
  if (targetSlot > capacity) {
    return Object.freeze({ kind: "slot-locked", capacity });
  }
  if (!state.heroes.some((hero) => hero.heroKey === selectedHeroKey)) {
    return Object.freeze({ kind: "hero-not-owned" });
  }

  const sourceIndex = state.party.indexOf(selectedHeroKey);
  if (previousHeroKey === null) {
    if (sourceIndex !== -1) {
      return Object.freeze({ kind: "invalid-target" });
    }
    const next = structuredClone(state);
    next.party[partyIndex] = selectedHeroKey;
    return Object.freeze({
      kind: "changed",
      transition: "fill",
      targetSlot: targetSlot as DiscordHeroPartySlot,
      selectedHeroKey,
      previousHeroKey,
      sourceSlot: null,
      state: next,
    });
  }

  if (sourceIndex === -1) {
    const next = structuredClone(state);
    next.party[partyIndex] = selectedHeroKey;
    return Object.freeze({
      kind: "changed",
      transition: "replace",
      targetSlot: targetSlot as DiscordHeroPartySlot,
      selectedHeroKey,
      previousHeroKey,
      sourceSlot: null,
      state: next,
    });
  }

  const next = structuredClone(state);
  next.party[partyIndex] = selectedHeroKey;
  next.party[sourceIndex] = previousHeroKey;
  return Object.freeze({
    kind: "changed",
    transition: "swap",
    targetSlot: targetSlot as DiscordHeroPartySlot,
    selectedHeroKey,
    previousHeroKey,
    sourceSlot: (sourceIndex + 1) as DiscordHeroPartySlot,
    state: next,
  });
}

export function isDiscordHeroPartyTransition(
  indexes: DiscordHeroCatalogIndexes,
  previous: PlayerState,
  current: PlayerState,
): boolean {
  if (
    current.heroes.length !== previous.heroes.length ||
    current.heroes.some(
      (hero, index) => hero.heroKey !== previous.heroes[index]?.heroKey,
    )
  ) {
    return false;
  }
  if (
    current.party.every((heroKey, index) => heroKey === previous.party[index])
  ) {
    return true;
  }

  for (const [index, selectedHeroKey] of current.party.entries()) {
    if (selectedHeroKey === null) continue;
    const result = arrangePartySlot(
      indexes,
      previous,
      index + 1,
      selectedHeroKey,
    );
    if (
      result.kind === "changed" &&
      result.state.party.every(
        (heroKey, partyIndex) => heroKey === current.party[partyIndex],
      )
    ) {
      return true;
    }
  }
  return false;
}
