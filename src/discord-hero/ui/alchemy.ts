import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import type { InventoryDebit } from "../domain/items";
import type { PlayerState } from "../domain/player";
import {
  readDiscordHeroStoredAsset,
  type DiscordHeroStoredAssetView,
} from "./inventory";

export const DISCORD_HERO_ALCHEMY_PAGE_SIZE = 25;

export interface DiscordHeroAlchemyOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly slotIndex: number;
  readonly detail: DiscordHeroStoredAssetView;
}

function occupiedInventorySlots(state: PlayerState) {
  return [...state.containers.inventory.slots].sort(
    (left, right) => left.index - right.index,
  );
}

function requirePage(page: number, pageCount: number): void {
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero Alchemy page ${page} is outside 0-${pageCount - 1}`,
    );
  }
}

function sourceDescription(detail: DiscordHeroStoredAssetView): string {
  const fields = [
    detail.type,
    detail.gearType ?? "—",
    detail.level === null ? "Lv—" : `Lv${detail.level}`,
    detail.grade,
  ];
  if (detail.quantity !== null) {
    fields.push(`${detail.quantity} owned`);
  }
  return fields.join(" · ");
}

export function discordHeroAlchemyPageCount(state: PlayerState): number {
  return Math.max(
    1,
    Math.ceil(
      occupiedInventorySlots(state).length / DISCORD_HERO_ALCHEMY_PAGE_SIZE,
    ),
  );
}

export function discordHeroAlchemyOptions(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  page: number,
): readonly DiscordHeroAlchemyOption[] {
  const slots = occupiedInventorySlots(state);
  const pageCount = discordHeroAlchemyPageCount(state);
  requirePage(page, pageCount);
  const start = page * DISCORD_HERO_ALCHEMY_PAGE_SIZE;
  return Object.freeze(
    slots.slice(start, start + DISCORD_HERO_ALCHEMY_PAGE_SIZE).map((slot) => {
      const detail = readDiscordHeroStoredAsset(indexes, slot.asset);
      return Object.freeze({
        value: String(slot.index),
        label:
          detail.quantity === null
            ? `Slot ${slot.index} · ${detail.name}`
            : `Slot ${slot.index} · 1 unit of ${detail.name}`,
        description: sourceDescription(detail),
        slotIndex: slot.index,
        detail,
      });
    }),
  );
}

export function encodeDiscordHeroAlchemyPage(page: number): string {
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new Error(
      "DiscordHero Alchemy page must be a non-negative safe integer",
    );
  }
  return `a-${page.toString(36)}`;
}

export function decodeDiscordHeroAlchemyPage(value: string): number {
  const match = /^a-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero Alchemy page has invalid encoding");
  }
  const page = Number.parseInt(match[1]!, 36);
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page.toString(36) !== match[1]
  ) {
    throw new Error("DiscordHero Alchemy page has non-canonical encoding");
  }
  return page;
}

export function isDiscordHeroAlchemyUnlocked(state: PlayerState): boolean {
  return (
    state.cube.unlockedRecipes.includes(200001) &&
    state.cube.unlockedSubRecipes.includes(200011)
  );
}

export function discordHeroAlchemyDebits(
  state: PlayerState,
  page: number,
  selectedValues: readonly string[],
): readonly InventoryDebit[] {
  const slots = occupiedInventorySlots(state);
  const pageCount = discordHeroAlchemyPageCount(state);
  requirePage(page, pageCount);
  if (
    !Array.isArray(selectedValues) ||
    selectedValues.length < 1 ||
    selectedValues.length > 9
  ) {
    throw new Error(
      "DiscordHero Alchemy selection must contain between 1 and 9 slots",
    );
  }

  const selectedSlotIndexes = new Set<number>();
  for (const value of selectedValues) {
    if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
      throw new Error(
        `DiscordHero Alchemy slot value ${String(value)} has non-canonical encoding`,
      );
    }
    const slotIndex = Number(value);
    if (!Number.isSafeInteger(slotIndex) || String(slotIndex) !== value) {
      throw new Error(
        `DiscordHero Alchemy slot value ${value} has non-canonical encoding`,
      );
    }
    if (selectedSlotIndexes.has(slotIndex)) {
      throw new Error(
        `DiscordHero Alchemy selection contains duplicate slot ${slotIndex}`,
      );
    }
    selectedSlotIndexes.add(slotIndex);
  }

  const start = page * DISCORD_HERO_ALCHEMY_PAGE_SIZE;
  const pageSlots = slots.slice(start, start + DISCORD_HERO_ALCHEMY_PAGE_SIZE);
  const slotsByIndex = new Map(pageSlots.map((slot) => [slot.index, slot]));
  const selectedSlots = [...selectedSlotIndexes]
    .map((slotIndex) => {
      const slot = slotsByIndex.get(slotIndex);
      if (slot === undefined) {
        throw new Error(
          `DiscordHero Inventory slot ${slotIndex} is not on Alchemy page ${page}`,
        );
      }
      return slot;
    })
    .sort((left, right) => left.index - right.index);

  return Object.freeze(
    selectedSlots.map((slot): InventoryDebit => {
      const debit: InventoryDebit =
        slot.asset.kind === "gear"
          ? { kind: "gear", instanceId: slot.asset.instanceId }
          : { kind: "stack", itemKey: slot.asset.itemKey, quantity: 1 };
      return Object.freeze(debit);
    }),
  );
}
