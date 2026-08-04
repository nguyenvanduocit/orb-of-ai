import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { requireSourceRolledStatCandidate } from "./items";
import { PlayerStateSchema, type GearAsset, type PlayerState } from "./player";

export type EquipGearResult =
  | Readonly<{
      kind: "equipped";
      heroKey: number;
      gearType: string;
      inventorySlotIndex: number;
      instanceId: string;
      itemKey: number;
      state: PlayerState;
    }>
  | Readonly<{
      kind: "hero-not-owned";
      heroKey: number;
    }>
  | Readonly<{
      kind: "inventory-slot-locked";
      inventorySlotIndex: number;
      unlockedSlots: number;
    }>
  | Readonly<{
      kind: "inventory-slot-empty";
      inventorySlotIndex: number;
    }>
  | Readonly<{
      kind: "inventory-slot-not-gear";
      inventorySlotIndex: number;
      itemKey: number;
    }>
  | Readonly<{
      kind: "incompatible-gear";
      heroKey: number;
      gearType: string;
      itemKey: number;
    }>
  | Readonly<{
      kind: "equipment-slot-occupied";
      heroKey: number;
      gearType: string;
      instanceId: string;
    }>;

export type UnequipGearResult =
  | Readonly<{
      kind: "unequipped";
      heroKey: number;
      gearType: string;
      inventorySlotIndex: number;
      instanceId: string;
      itemKey: number;
      state: PlayerState;
    }>
  | Readonly<{
      kind: "hero-not-owned";
      heroKey: number;
    }>
  | Readonly<{
      kind: "inventory-slot-locked";
      inventorySlotIndex: number;
      unlockedSlots: number;
    }>
  | Readonly<{
      kind: "inventory-slot-occupied";
      inventorySlotIndex: number;
    }>
  | Readonly<{
      kind: "equipment-slot-empty";
      heroKey: number;
      gearType: string;
    }>;

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function equipmentCategoryOrder(
  indexes: DiscordHeroCatalogIndexes,
): readonly string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const item of indexes.tables.items.rows) {
    if (item.type !== "GEAR" || item.gear === null || seen.has(item.gear)) {
      continue;
    }
    seen.add(item.gear);
    categories.push(item.gear);
  }
  if (categories.length !== 20) {
    throw new Error(
      `items catalog has ${categories.length} equipment categories; expected 20`,
    );
  }
  return categories;
}

function requireEquipmentCategory(
  indexes: DiscordHeroCatalogIndexes,
  gearType: string,
): string {
  const categories = new Set(equipmentCategoryOrder(indexes));
  if (
    typeof gearType !== "string" ||
    gearType.length === 0 ||
    !categories.has(gearType)
  ) {
    throw new Error(`unknown equipment category ${String(gearType)}`);
  }
  return gearType;
}

function requireInventorySlotIndex(
  indexes: DiscordHeroCatalogIndexes,
  inventorySlotIndex: number,
): void {
  requireNonNegativeSafeInteger(inventorySlotIndex, "inventory slot index");
  getCatalogRow(indexes, "inventory", inventorySlotIndex);
}

function requireCanonicalGearAsset(
  indexes: DiscordHeroCatalogIndexes,
  asset: GearAsset,
  context: string,
): string {
  const item = getCatalogRow(indexes, "items", asset.itemKey);
  if (item.deleted === true || item.type !== "GEAR" || item.gear === null) {
    throw new Error(
      `${context} references non-equipment item ${asset.itemKey}`,
    );
  }
  getCatalogRow(indexes, "gear", asset.itemKey);
  for (const [index, rolledStat] of asset.rolledStats.entries()) {
    const sourceRows = indexes.tables.stat_mods.groups.get(
      rolledStat.statModKey,
    );
    if (sourceRows === undefined) {
      throw new Error(
        `${context}.rolledStats[${index}] references unknown stat mod ${rolledStat.statModKey}`,
      );
    }
    requireSourceRolledStatCandidate({
      sourceRows,
      statModKey: rolledStat.statModKey,
      value: rolledStat.value,
    });
  }
  return requireEquipmentCategory(indexes, item.gear);
}

export function isHeroGearTypeCompatible(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  gearType: string,
): boolean {
  requirePositiveSafeInteger(heroKey, "hero key");
  const hero = getCatalogRow(indexes, "heroes", heroKey);
  const categories = new Set(equipmentCategoryOrder(indexes));
  if (
    typeof gearType !== "string" ||
    gearType.length === 0 ||
    !categories.has(gearType)
  ) {
    throw new Error(`unknown equipment category ${String(gearType)}`);
  }
  const specialized = new Set(
    indexes.tables.heroes.rows.flatMap((sourceHero) => [
      sourceHero.MainWeaponGearType,
      sourceHero.SubWeaponGearType,
    ]),
  );
  if (specialized.size !== 12) {
    throw new Error(
      `heroes catalog has ${specialized.size} specialized equipment categories; expected 12`,
    );
  }
  for (const specializedType of specialized) {
    if (!categories.has(specializedType)) {
      throw new Error(
        `hero affinity references unknown equipment category ${specializedType}`,
      );
    }
  }
  return (
    !specialized.has(gearType) ||
    gearType === hero.MainWeaponGearType ||
    gearType === hero.SubWeaponGearType
  );
}

function sortEquipment(
  indexes: DiscordHeroCatalogIndexes,
  equipment: PlayerState["heroes"][number]["equipment"],
): void {
  const order = new Map(
    equipmentCategoryOrder(indexes).map((gearType, index) => [gearType, index]),
  );
  equipment.sort(
    (left, right) => order.get(left.slot)! - order.get(right.slot)!,
  );
}

function sortInventory(state: PlayerState): void {
  state.containers.inventory.slots.sort(
    (left, right) => left.index - right.index,
  );
}

export function equipGear(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
  inventorySlotIndex: number,
): EquipGearResult {
  requirePositiveSafeInteger(heroKey, "hero key");
  getCatalogRow(indexes, "heroes", heroKey);
  requireInventorySlotIndex(indexes, inventorySlotIndex);
  const next = PlayerStateSchema.parse(state);
  const hero = next.heroes.find((candidate) => candidate.heroKey === heroKey);
  if (hero === undefined) {
    return Object.freeze({ kind: "hero-not-owned", heroKey });
  }

  const inventory = next.containers.inventory;
  if (inventorySlotIndex >= inventory.unlockedSlots) {
    return Object.freeze({
      kind: "inventory-slot-locked",
      inventorySlotIndex,
      unlockedSlots: inventory.unlockedSlots,
    });
  }
  const position = inventory.slots.findIndex(
    (slot) => slot.index === inventorySlotIndex,
  );
  if (position === -1) {
    return Object.freeze({
      kind: "inventory-slot-empty",
      inventorySlotIndex,
    });
  }
  const selected = inventory.slots[position]!;
  if (selected.asset.kind !== "gear") {
    return Object.freeze({
      kind: "inventory-slot-not-gear",
      inventorySlotIndex,
      itemKey: selected.asset.itemKey,
    });
  }

  const gearType = requireCanonicalGearAsset(
    indexes,
    selected.asset,
    `inventory slot ${inventorySlotIndex}`,
  );
  if (!isHeroGearTypeCompatible(indexes, heroKey, gearType)) {
    return Object.freeze({
      kind: "incompatible-gear",
      heroKey,
      gearType,
      itemKey: selected.asset.itemKey,
    });
  }
  const occupied = hero.equipment.find(
    (equipment) => equipment.slot === gearType,
  );
  if (occupied !== undefined) {
    return Object.freeze({
      kind: "equipment-slot-occupied",
      heroKey,
      gearType,
      instanceId: occupied.asset.instanceId,
    });
  }

  inventory.slots.splice(position, 1);
  hero.equipment.push({ slot: gearType, asset: selected.asset });
  sortInventory(next);
  sortEquipment(indexes, hero.equipment);
  return Object.freeze({
    kind: "equipped",
    heroKey,
    gearType,
    inventorySlotIndex,
    instanceId: selected.asset.instanceId,
    itemKey: selected.asset.itemKey,
    state: next,
  });
}

export function unequipGear(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
  gearType: string,
  inventorySlotIndex: number,
): UnequipGearResult {
  requirePositiveSafeInteger(heroKey, "hero key");
  getCatalogRow(indexes, "heroes", heroKey);
  const category = requireEquipmentCategory(indexes, gearType);
  requireInventorySlotIndex(indexes, inventorySlotIndex);
  const next = PlayerStateSchema.parse(state);
  const hero = next.heroes.find((candidate) => candidate.heroKey === heroKey);
  if (hero === undefined) {
    return Object.freeze({ kind: "hero-not-owned", heroKey });
  }

  const inventory = next.containers.inventory;
  if (inventorySlotIndex >= inventory.unlockedSlots) {
    return Object.freeze({
      kind: "inventory-slot-locked",
      inventorySlotIndex,
      unlockedSlots: inventory.unlockedSlots,
    });
  }
  if (inventory.slots.some((slot) => slot.index === inventorySlotIndex)) {
    return Object.freeze({
      kind: "inventory-slot-occupied",
      inventorySlotIndex,
    });
  }
  const position = hero.equipment.findIndex(
    (equipment) => equipment.slot === category,
  );
  if (position === -1) {
    return Object.freeze({
      kind: "equipment-slot-empty",
      heroKey,
      gearType: category,
    });
  }

  const selected = hero.equipment[position]!;
  const sourceGearType = requireCanonicalGearAsset(
    indexes,
    selected.asset,
    `hero ${heroKey} equipment ${category}`,
  );
  if (sourceGearType !== category) {
    throw new Error(
      `hero ${heroKey} equipment slot ${category} does not match item gear type ${sourceGearType}`,
    );
  }
  if (!isHeroGearTypeCompatible(indexes, heroKey, category)) {
    throw new Error(`hero ${heroKey} cannot equip source category ${category}`);
  }

  hero.equipment.splice(position, 1);
  inventory.slots.push({
    index: inventorySlotIndex,
    asset: selected.asset,
  });
  sortEquipment(indexes, hero.equipment);
  sortInventory(next);
  return Object.freeze({
    kind: "unequipped",
    heroKey,
    gearType: category,
    inventorySlotIndex,
    instanceId: selected.asset.instanceId,
    itemKey: selected.asset.itemKey,
    state: next,
  });
}
