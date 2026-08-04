import {
  getCatalogRow,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { isHeroGearTypeCompatible } from "../domain/equipment";
import type { GearAsset, PlayerState, StoredAsset } from "../domain/player";
import type { DiscordHeroItemEffectSourceVector } from "./item-effects";

const PAGE_SIZE = 25;
const ROLLED_STAT_PAGE_SIZE = 25;
const SOURCE_FILTER_VALUE = /^[A-Z][A-Z0-9_]{0,15}$/;

export type DiscordHeroInventoryFilter =
  | { readonly kind: "all" }
  | {
      readonly kind: "stored-kind";
      readonly value: StoredAsset["kind"];
    }
  | {
      readonly kind: "item-type" | "gear-type" | "grade";
      readonly value: string;
    };

export const DISCORD_HERO_INVENTORY_ALL_FILTER: DiscordHeroInventoryFilter =
  Object.freeze({ kind: "all" });

export interface DiscordHeroInventoryFilterGroups {
  readonly primary: readonly DiscordHeroInventoryFilter[];
  readonly gearTypes: readonly DiscordHeroInventoryFilter[];
}

export interface DiscordHeroInventoryPageTarget {
  readonly inventoryFilter: DiscordHeroInventoryFilter;
  readonly inventoryPage: number;
}

export interface DiscordHeroStoredAssetView {
  readonly itemKey: number;
  readonly name: string;
  readonly type: string;
  readonly gearType: string | null;
  readonly level: number | null;
  readonly grade: string;
  readonly quantity: number | null;
  readonly instanceId: string | null;
  readonly rolledStats: readonly {
    readonly statModKey: number;
    readonly statType: string;
    readonly modType: string;
    readonly value: number;
  }[];
}

export interface DiscordHeroEquipHero {
  readonly heroKey: number;
  readonly name: string;
  readonly classType: string;
  readonly gearType: string;
}

export interface DiscordHeroEquippedGear {
  readonly heroKey: number;
  readonly gearType: string;
  readonly asset: GearAsset;
}

export interface DiscordHeroEquipTarget {
  readonly inventoryFilter: DiscordHeroInventoryFilter;
  readonly inventoryPage: number;
  readonly inventorySlotIndex: number;
}

export interface DiscordHeroEquipmentSelection {
  readonly heroKey: number;
  readonly gearType: string;
}

export interface DiscordHeroItemEffectsSectionTarget extends DiscordHeroEquipmentSelection {
  readonly equipmentPage: number;
  readonly equipmentRow: number;
}

export interface DiscordHeroItemEffectsPageTarget extends DiscordHeroItemEffectsSectionTarget {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly effectPage: number;
}

export interface DiscordHeroUnequipTarget extends DiscordHeroEquipmentSelection {
  readonly equipmentPage: number;
  readonly freeInventoryPage: number;
}

export type DiscordHeroRollPageTarget =
  | {
      readonly kind: "inventory";
      readonly inventoryFilter: DiscordHeroInventoryFilter;
      readonly inventoryPage: number;
      readonly inventorySlotIndex: number;
      readonly rollPage: number;
    }
  | {
      readonly kind: "equipment";
      readonly equipmentPage: number;
      readonly heroKey: number;
      readonly gearType: string;
      readonly rollPage: number;
    };

function pageCount(length: number): number {
  return Math.max(1, Math.ceil(length / PAGE_SIZE));
}

function requirePage(page: number, count: number, label: string): void {
  if (!Number.isSafeInteger(page) || page < 0 || page >= count) {
    throw new Error(
      `DiscordHero ${label} page ${page} is outside 0-${count - 1}`,
    );
  }
}

function encodeNonNegative(value: number, label: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value.toString(36);
}

function decodeNonNegative(value: string, label: string): number {
  if (!/^[0-9a-z]+$/.test(value)) {
    throw new Error(`${label} has invalid encoding`);
  }
  const decoded = Number.parseInt(value, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < 0 ||
    decoded.toString(36) !== value
  ) {
    throw new Error(`${label} has non-canonical encoding`);
  }
  return decoded;
}

function requireGearType(value: string): string {
  if (!/^[A-Z][A-Z0-9_]{0,15}$/.test(value)) {
    throw new Error("DiscordHero equipment gear type has invalid encoding");
  }
  return value;
}

function requireKnownItemEffectsIdentity(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  gearType: string,
): void {
  if (!indexes.tables.heroes.rows.some((hero) => hero.HeroKey === heroKey)) {
    throw new Error(`DiscordHero Item Effects has unknown Hero ${heroKey}`);
  }
  if (
    !indexes.tables.gear_type_scales.rows.some(
      (gearTypeScale) => gearTypeScale.GearType === gearType,
    )
  ) {
    throw new Error(
      `DiscordHero Item Effects has unknown gear type ${gearType}`,
    );
  }
}

function requireEquipmentRow(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= PAGE_SIZE) {
    throw new Error(
      `DiscordHero Item Effects equipment row must be inside 0-${PAGE_SIZE - 1}`,
    );
  }
  return value;
}

function requireItemEffectsTargetLength(value: string): string {
  if (value.length > 32) {
    throw new Error("DiscordHero Item Effects target exceeds 32 characters");
  }
  return value;
}

function encodeItemEffectSourceVector(
  sourceVector: DiscordHeroItemEffectSourceVector,
): string {
  switch (sourceVector) {
    case "base":
      return "b";
    case "inherent":
      return "i";
    case "rolled":
      return "r";
    default:
      throw new Error("DiscordHero Item Effects has unknown source vector");
  }
}

function decodeItemEffectSourceVector(
  value: string,
): DiscordHeroItemEffectSourceVector {
  switch (value) {
    case "b":
      return "base";
    case "i":
      return "inherent";
    case "r":
      return "rolled";
    default:
      throw new Error("DiscordHero Item Effects has unknown source vector");
  }
}

export function decodeDiscordHeroItemEffectsSectionChoice(
  value: string,
): "summary" | DiscordHeroItemEffectSourceVector {
  if (value === "s") return "summary";
  return decodeItemEffectSourceVector(value);
}

export function decodeDiscordHeroItemEffectsRowIndex(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(
      "DiscordHero Item Effects row must be a canonical non-negative integer",
    );
  }
  const rowIndex = Number(value);
  if (!Number.isSafeInteger(rowIndex) || String(rowIndex) !== value) {
    throw new Error("DiscordHero Item Effects row must be a safe integer");
  }
  return rowIndex;
}

function equipmentCategoryOrder(
  indexes: DiscordHeroCatalogIndexes,
): ReadonlyMap<string, number> {
  const categories = new Map<string, number>();
  for (const item of indexes.tables.items.rows) {
    if (
      item.type === "GEAR" &&
      item.gear !== null &&
      !categories.has(item.gear)
    ) {
      categories.set(item.gear, categories.size);
    }
  }
  return categories;
}

function uniqueSourceValues(
  values: readonly (string | null)[],
): readonly string[] {
  return Object.freeze(
    values.filter(
      (value, index): value is string =>
        value !== null && values.indexOf(value) === index,
    ),
  );
}

function sourceItemTypes(
  indexes: DiscordHeroCatalogIndexes,
): readonly string[] {
  return uniqueSourceValues(indexes.tables.items.rows.map((item) => item.type));
}

function sourceGearTypes(
  indexes: DiscordHeroCatalogIndexes,
): readonly string[] {
  return uniqueSourceValues(indexes.tables.items.rows.map((item) => item.gear));
}

function sourceGrades(indexes: DiscordHeroCatalogIndexes): readonly string[] {
  return Object.freeze(indexes.tables.grades.rows.map((grade) => grade.GRADE));
}

function sourceFilter(
  kind: "item-type" | "gear-type" | "grade",
  value: string,
): DiscordHeroInventoryFilter {
  return Object.freeze({ kind, value });
}

export function discordHeroInventoryFilterGroups(
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroInventoryFilterGroups {
  return Object.freeze({
    primary: Object.freeze([
      DISCORD_HERO_INVENTORY_ALL_FILTER,
      Object.freeze({ kind: "stored-kind", value: "gear" as const }),
      Object.freeze({ kind: "stored-kind", value: "stack" as const }),
      ...sourceItemTypes(indexes).map((value) =>
        sourceFilter("item-type", value),
      ),
      ...sourceGrades(indexes).map((value) => sourceFilter("grade", value)),
    ]),
    gearTypes: Object.freeze(
      sourceGearTypes(indexes).map((value) => sourceFilter("gear-type", value)),
    ),
  });
}

function requireSourceFilterValue(value: string): string {
  if (!SOURCE_FILTER_VALUE.test(value)) {
    throw new Error("DiscordHero Inventory filter has invalid source value");
  }
  return value;
}

export function encodeDiscordHeroInventoryFilter(
  filter: DiscordHeroInventoryFilter,
): string {
  switch (filter.kind) {
    case "all":
      return "a";
    case "stored-kind":
      return filter.value === "gear" ? "kgear" : "kstack";
    case "item-type":
      return `t${requireSourceFilterValue(filter.value)}`;
    case "gear-type":
      return `g${requireSourceFilterValue(filter.value)}`;
    case "grade":
      return `r${requireSourceFilterValue(filter.value)}`;
  }
}

export function decodeDiscordHeroInventoryFilter(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroInventoryFilter {
  if (value === "a") return DISCORD_HERO_INVENTORY_ALL_FILTER;
  if (value === "kgear") {
    return Object.freeze({ kind: "stored-kind", value: "gear" });
  }
  if (value === "kstack") {
    return Object.freeze({ kind: "stored-kind", value: "stack" });
  }
  const sourceValue = requireSourceFilterValue(value.slice(1));
  if (value.startsWith("t") && sourceItemTypes(indexes).includes(sourceValue)) {
    return sourceFilter("item-type", sourceValue);
  }
  if (value.startsWith("g") && sourceGearTypes(indexes).includes(sourceValue)) {
    return sourceFilter("gear-type", sourceValue);
  }
  if (value.startsWith("r") && sourceGrades(indexes).includes(sourceValue)) {
    return sourceFilter("grade", sourceValue);
  }
  throw new Error(`DiscordHero Inventory has unknown filter ${value}`);
}

export function discordHeroInventoryFilterLabel(
  filter: DiscordHeroInventoryFilter,
): string {
  switch (filter.kind) {
    case "all":
      return "All";
    case "stored-kind":
      return filter.value === "gear" ? "Stored kind Gear" : "Stored kind Stack";
    case "item-type":
      return `Item type ${filter.value}`;
    case "gear-type":
      return `Gear type ${filter.value}`;
    case "grade":
      return `Grade ${filter.value}`;
  }
}

function filteredInventorySlots(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  filter: DiscordHeroInventoryFilter,
): readonly PlayerState["containers"]["inventory"]["slots"][number][] {
  return [...state.containers.inventory.slots]
    .filter((slot) => {
      if (filter.kind === "all") return true;
      if (filter.kind === "stored-kind") {
        return slot.asset.kind === filter.value;
      }
      const item = getCatalogRow(indexes, "items", slot.asset.itemKey);
      if (filter.kind === "item-type") return item.type === filter.value;
      if (filter.kind === "gear-type") return item.gear === filter.value;
      return item.grade === filter.value;
    })
    .sort((left, right) => left.index - right.index);
}

export function discordHeroInventoryPageCount(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  filter: DiscordHeroInventoryFilter,
): number {
  return pageCount(filteredInventorySlots(indexes, state, filter).length);
}

export function discordHeroInventoryMatchCount(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  filter: DiscordHeroInventoryFilter,
): number {
  return filteredInventorySlots(indexes, state, filter).length;
}

export function discordHeroInventorySlots(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  filter: DiscordHeroInventoryFilter,
  page: number,
): readonly PlayerState["containers"]["inventory"]["slots"][number][] {
  const slots = filteredInventorySlots(indexes, state, filter);
  requirePage(page, pageCount(slots.length), "Inventory");
  const start = page * PAGE_SIZE;
  return slots.slice(start, start + PAGE_SIZE);
}

export function discordHeroEquippedGearPageCount(state: PlayerState): number {
  return pageCount(
    state.heroes.reduce((total, hero) => total + hero.equipment.length, 0),
  );
}

export function discordHeroEquippedGear(
  state: PlayerState,
  page: number,
  indexes?: DiscordHeroCatalogIndexes,
): readonly DiscordHeroEquippedGear[] {
  const order = indexes === undefined ? null : equipmentCategoryOrder(indexes);
  const equipped = state.heroes
    .flatMap((hero) =>
      hero.equipment.map((equipment) => ({
        heroKey: hero.heroKey,
        gearType: equipment.slot,
        asset: equipment.asset,
      })),
    )
    .sort(
      (left, right) =>
        left.heroKey - right.heroKey ||
        (order?.get(left.gearType) ?? left.gearType.charCodeAt(0)) -
          (order?.get(right.gearType) ?? right.gearType.charCodeAt(0)) ||
        left.gearType.localeCompare(right.gearType),
    );
  requirePage(page, pageCount(equipped.length), "equipped gear");
  const start = page * PAGE_SIZE;
  return equipped.slice(start, start + PAGE_SIZE);
}

export function discordHeroFreeInventoryPageCount(state: PlayerState): number {
  return pageCount(
    state.containers.inventory.unlockedSlots -
      state.containers.inventory.slots.length,
  );
}

export function discordHeroFreeInventorySlots(
  state: PlayerState,
  page: number,
): readonly number[] {
  const occupied = new Set(
    state.containers.inventory.slots.map((slot) => slot.index),
  );
  const free = Array.from(
    { length: state.containers.inventory.unlockedSlots },
    (_, index) => index,
  ).filter((index) => !occupied.has(index));
  requirePage(page, pageCount(free.length), "free Inventory");
  const start = page * PAGE_SIZE;
  return free.slice(start, start + PAGE_SIZE);
}

export function readDiscordHeroStoredAsset(
  indexes: DiscordHeroCatalogIndexes,
  asset: StoredAsset,
): DiscordHeroStoredAssetView {
  const item = getCatalogRow(indexes, "items", asset.itemKey);
  const name = getLocalizedCatalogName(
    indexes,
    "items",
    asset.itemKey,
    "en-US",
  );
  const rolledStats =
    asset.kind === "gear"
      ? asset.rolledStats.map((rolledStat) => {
          const sourceRows = indexes.tables.stat_mods.groups.get(
            rolledStat.statModKey,
          );
          if (sourceRows === undefined || sourceRows.length === 0) {
            throw new Error(
              `gear ${asset.instanceId} references unknown stat mod ${rolledStat.statModKey}`,
            );
          }
          const source = sourceRows[0]!;
          if (
            sourceRows.some(
              (row) =>
                row.STATTYPE !== source.STATTYPE ||
                row.MODTYPE !== source.MODTYPE,
            )
          ) {
            throw new Error(
              `stat mod ${rolledStat.statModKey} has inconsistent source semantics`,
            );
          }
          return Object.freeze({
            statModKey: rolledStat.statModKey,
            statType: source.STATTYPE,
            modType: source.MODTYPE,
            value: rolledStat.value,
          });
        })
      : [];
  return Object.freeze({
    itemKey: item.id,
    name,
    type: item.type,
    gearType: item.gear,
    level: item.level,
    grade: item.grade,
    quantity: asset.kind === "stack" ? asset.quantity : null,
    instanceId: asset.kind === "gear" ? asset.instanceId : null,
    rolledStats: Object.freeze(rolledStats),
  });
}

export function discordHeroRolledStatPageCount(
  asset: Pick<DiscordHeroStoredAssetView, "rolledStats">,
): number {
  return Math.max(
    1,
    Math.ceil(asset.rolledStats.length / ROLLED_STAT_PAGE_SIZE),
  );
}

export function discordHeroRolledStats(
  asset: Pick<DiscordHeroStoredAssetView, "rolledStats">,
  page: number,
): DiscordHeroStoredAssetView["rolledStats"] {
  requirePage(
    page,
    discordHeroRolledStatPageCount(asset),
    "rolled-stat detail",
  );
  const start = page * ROLLED_STAT_PAGE_SIZE;
  return asset.rolledStats.slice(start, start + ROLLED_STAT_PAGE_SIZE);
}

export function discordHeroCompatibleEquipHeroes(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  inventorySlotIndex: number,
): readonly DiscordHeroEquipHero[] {
  const selected = state.containers.inventory.slots.find(
    (slot) => slot.index === inventorySlotIndex,
  );
  if (selected === undefined) {
    throw new Error(
      `DiscordHero Inventory has no occupied slot ${inventorySlotIndex}`,
    );
  }
  if (selected.asset.kind !== "gear") {
    throw new Error(
      `DiscordHero Inventory slot ${inventorySlotIndex} is not gear`,
    );
  }
  const item = getCatalogRow(indexes, "items", selected.asset.itemKey);
  if (item.type !== "GEAR" || item.gear === null) {
    throw new Error(
      `DiscordHero Inventory item ${item.id} is not source equipment`,
    );
  }
  const gearType = item.gear;
  const owned = new Map(state.heroes.map((hero) => [hero.heroKey, hero]));
  return Object.freeze(
    indexes.tables.heroes.rows.flatMap((hero) => {
      const progress = owned.get(hero.HeroKey);
      if (
        progress === undefined ||
        !isHeroGearTypeCompatible(indexes, hero.HeroKey, gearType) ||
        progress.equipment.some((equipment) => equipment.slot === gearType)
      ) {
        return [];
      }
      return [
        Object.freeze({
          heroKey: hero.HeroKey,
          name: getLocalizedCatalogName(
            indexes,
            "heroes",
            hero.HeroKey,
            "en-US",
          ),
          classType: hero.ClassType,
          gearType,
        }),
      ];
    }),
  );
}

export function encodeDiscordHeroInventoryPage(
  filter: DiscordHeroInventoryFilter,
  page: number,
): string {
  return `i-${encodeDiscordHeroInventoryFilter(filter)}-${encodeNonNegative(
    page,
    "DiscordHero Inventory page",
  )}`;
}

export function decodeDiscordHeroInventoryPage(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroInventoryPageTarget {
  const match = /^i-([A-Za-z0-9_]+)-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero Inventory page has invalid encoding");
  }
  return Object.freeze({
    inventoryFilter: decodeDiscordHeroInventoryFilter(indexes, match[1]!),
    inventoryPage: decodeNonNegative(match[2]!, "DiscordHero Inventory page"),
  });
}

export function encodeDiscordHeroEquipmentPage(page: number): string {
  return `q-${encodeNonNegative(page, "DiscordHero equipment page")}`;
}

export function decodeDiscordHeroEquipmentPage(value: string): number {
  const match = /^q-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero equipment page has invalid encoding");
  }
  return decodeNonNegative(match[1]!, "DiscordHero equipment page");
}

export function encodeDiscordHeroInventoryRollPageTarget(
  filter: DiscordHeroInventoryFilter,
  inventoryPage: number,
  inventorySlotIndex: number,
  rollPage: number,
): string {
  return `ri-${encodeDiscordHeroInventoryFilter(filter)}-${encodeNonNegative(
    inventoryPage,
    "DiscordHero Inventory page",
  )}-${encodeNonNegative(
    inventorySlotIndex,
    "DiscordHero Inventory slot index",
  )}-${encodeNonNegative(rollPage, "DiscordHero rolled-stat page")}`;
}

export function encodeDiscordHeroEquipmentRollPageTarget(
  equipmentPage: number,
  heroKey: number,
  gearType: string,
  rollPage: number,
): string {
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  return `rq-${encodeNonNegative(
    equipmentPage,
    "DiscordHero equipment page",
  )}-${encodeNonNegative(heroKey, "DiscordHero hero key")}-${requireGearType(
    gearType,
  )}-${encodeNonNegative(rollPage, "DiscordHero rolled-stat page")}`;
}

export function decodeDiscordHeroRollPageTarget(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroRollPageTarget {
  const inventoryMatch =
    /^ri-([A-Za-z0-9_]+)-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (inventoryMatch !== null) {
    return Object.freeze({
      kind: "inventory",
      inventoryFilter: decodeDiscordHeroInventoryFilter(
        indexes,
        inventoryMatch[1]!,
      ),
      inventoryPage: decodeNonNegative(
        inventoryMatch[2]!,
        "DiscordHero Inventory page",
      ),
      inventorySlotIndex: decodeNonNegative(
        inventoryMatch[3]!,
        "DiscordHero Inventory slot index",
      ),
      rollPage: decodeNonNegative(
        inventoryMatch[4]!,
        "DiscordHero rolled-stat page",
      ),
    });
  }

  const equipmentMatch =
    /^rq-([0-9a-z]+)-([0-9a-z]+)-([A-Z][A-Z0-9_]{0,15})-([0-9a-z]+)$/.exec(
      value,
    );
  if (equipmentMatch === null) {
    throw new Error("DiscordHero rolled-stat page target has invalid encoding");
  }
  const heroKey = decodeNonNegative(equipmentMatch[2]!, "DiscordHero hero key");
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  return Object.freeze({
    kind: "equipment",
    equipmentPage: decodeNonNegative(
      equipmentMatch[1]!,
      "DiscordHero equipment page",
    ),
    heroKey,
    gearType: requireGearType(equipmentMatch[3]!),
    rollPage: decodeNonNegative(
      equipmentMatch[4]!,
      "DiscordHero rolled-stat page",
    ),
  });
}

export function encodeDiscordHeroEquipTarget(
  filter: DiscordHeroInventoryFilter,
  inventoryPage: number,
  inventorySlotIndex: number,
): string {
  return `e-${encodeDiscordHeroInventoryFilter(filter)}-${encodeNonNegative(
    inventoryPage,
    "DiscordHero Inventory page",
  )}-${encodeNonNegative(
    inventorySlotIndex,
    "DiscordHero Inventory slot index",
  )}`;
}

export function decodeDiscordHeroEquipTarget(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroEquipTarget {
  const match = /^e-([A-Za-z0-9_]+)-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero equip target has invalid encoding");
  }
  return Object.freeze({
    inventoryFilter: decodeDiscordHeroInventoryFilter(indexes, match[1]!),
    inventoryPage: decodeNonNegative(match[2]!, "DiscordHero Inventory page"),
    inventorySlotIndex: decodeNonNegative(
      match[3]!,
      "DiscordHero Inventory slot index",
    ),
  });
}

export function encodeDiscordHeroEquipmentSelection(
  heroKey: number,
  gearType: string,
): string {
  return `g-${encodeNonNegative(heroKey, "DiscordHero hero key")}-${requireGearType(
    gearType,
  )}`;
}

export function decodeDiscordHeroEquipmentSelection(
  value: string,
): DiscordHeroEquipmentSelection {
  const match = /^g-([0-9a-z]+)-([A-Z][A-Z0-9_]{0,15})$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero equipment selection has invalid encoding");
  }
  const heroKey = decodeNonNegative(match[1]!, "DiscordHero hero key");
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  return Object.freeze({
    heroKey,
    gearType: requireGearType(match[2]!),
  });
}

export function encodeDiscordHeroItemEffectsSectionTarget(
  indexes: DiscordHeroCatalogIndexes,
  equipmentPage: number,
  equipmentRow: number,
  heroKey: number,
  gearType: string,
): string {
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  const canonicalGearType = requireGearType(gearType);
  requireKnownItemEffectsIdentity(indexes, heroKey, canonicalGearType);
  return requireItemEffectsTargetLength(
    `es-${encodeNonNegative(
      equipmentPage,
      "DiscordHero equipment page",
    )}-${encodeNonNegative(
      requireEquipmentRow(equipmentRow),
      "DiscordHero equipment row",
    )}-${encodeNonNegative(heroKey, "DiscordHero hero key")}-${canonicalGearType}`,
  );
}

export function decodeDiscordHeroItemEffectsSectionTarget(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroItemEffectsSectionTarget {
  requireItemEffectsTargetLength(value);
  const match =
    /^es-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)-([A-Z][A-Z0-9_]{0,15})$/.exec(
      value,
    );
  if (match === null) {
    throw new Error(
      "DiscordHero Item Effects section target has invalid encoding",
    );
  }
  const heroKey = decodeNonNegative(match[3]!, "DiscordHero hero key");
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  const gearType = requireGearType(match[4]!);
  requireKnownItemEffectsIdentity(indexes, heroKey, gearType);
  return Object.freeze({
    equipmentPage: decodeNonNegative(match[1]!, "DiscordHero equipment page"),
    equipmentRow: requireEquipmentRow(
      decodeNonNegative(match[2]!, "DiscordHero equipment row"),
    ),
    heroKey,
    gearType,
  });
}

export function encodeDiscordHeroItemEffectsPageTarget(
  indexes: DiscordHeroCatalogIndexes,
  equipmentPage: number,
  equipmentRow: number,
  heroKey: number,
  gearType: string,
  sourceVector: DiscordHeroItemEffectSourceVector,
  effectPage: number,
): string {
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  const canonicalGearType = requireGearType(gearType);
  requireKnownItemEffectsIdentity(indexes, heroKey, canonicalGearType);
  return requireItemEffectsTargetLength(
    `ef-${encodeNonNegative(
      equipmentPage,
      "DiscordHero equipment page",
    )}-${encodeNonNegative(
      requireEquipmentRow(equipmentRow),
      "DiscordHero equipment row",
    )}-${encodeNonNegative(heroKey, "DiscordHero hero key")}-${canonicalGearType}-${encodeItemEffectSourceVector(
      sourceVector,
    )}-${encodeNonNegative(effectPage, "DiscordHero Item Effects page")}`,
  );
}

export function decodeDiscordHeroItemEffectsPageTarget(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DiscordHeroItemEffectsPageTarget {
  requireItemEffectsTargetLength(value);
  const match =
    /^ef-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)-([A-Z][A-Z0-9_]{0,15})-([bir])-([0-9a-z]+)$/.exec(
      value,
    );
  if (match === null) {
    throw new Error(
      "DiscordHero Item Effects page target has invalid encoding",
    );
  }
  const heroKey = decodeNonNegative(match[3]!, "DiscordHero hero key");
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  const gearType = requireGearType(match[4]!);
  requireKnownItemEffectsIdentity(indexes, heroKey, gearType);
  return Object.freeze({
    equipmentPage: decodeNonNegative(match[1]!, "DiscordHero equipment page"),
    equipmentRow: requireEquipmentRow(
      decodeNonNegative(match[2]!, "DiscordHero equipment row"),
    ),
    heroKey,
    gearType,
    sourceVector: decodeItemEffectSourceVector(match[5]!),
    effectPage: decodeNonNegative(match[6]!, "DiscordHero Item Effects page"),
  });
}

export function encodeDiscordHeroUnequipTarget(
  equipmentPage: number,
  heroKey: number,
  gearType: string,
  freeInventoryPage: number,
): string {
  return `u-${encodeNonNegative(
    equipmentPage,
    "DiscordHero equipment page",
  )}-${encodeNonNegative(heroKey, "DiscordHero hero key")}-${requireGearType(
    gearType,
  )}-${encodeNonNegative(
    freeInventoryPage,
    "DiscordHero free Inventory page",
  )}`;
}

export function decodeDiscordHeroUnequipTarget(
  value: string,
): DiscordHeroUnequipTarget {
  const match =
    /^u-([0-9a-z]+)-([0-9a-z]+)-([A-Z][A-Z0-9_]{0,15})-([0-9a-z]+)$/.exec(
      value,
    );
  if (match === null) {
    throw new Error("DiscordHero unequip target has invalid encoding");
  }
  const heroKey = decodeNonNegative(match[2]!, "DiscordHero hero key");
  if (heroKey < 1) {
    throw new Error("DiscordHero hero key must be positive");
  }
  return Object.freeze({
    equipmentPage: decodeNonNegative(match[1]!, "DiscordHero equipment page"),
    heroKey,
    gearType: requireGearType(match[3]!),
    freeInventoryPage: decodeNonNegative(
      match[4]!,
      "DiscordHero free Inventory page",
    ),
  });
}

export function decodeDiscordHeroInventorySlot(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(
      "DiscordHero Inventory slot must be a canonical non-negative integer",
    );
  }
  const slot = Number(value);
  if (!Number.isSafeInteger(slot) || String(slot) !== value) {
    throw new Error("DiscordHero Inventory slot must be a safe integer");
  }
  return slot;
}
