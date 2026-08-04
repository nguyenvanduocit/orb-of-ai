import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import {
  requireCanonicalGearInstanceId,
  sourceIntervalCandidates,
} from "./items";
import { validatePlayerAgainstCatalog } from "./invariants";
import type { PlayerState } from "./player";

export type ItemEffectUnit = "RAW" | "RAW_PER_THOUSAND" | "UNPROVEN";

export type ItemEffectProvenance =
  | Readonly<{
      kind: "gear-base";
      gearKey: number;
      gearType: string;
      slot: 1 | 2;
      statTypeField: "BaseStat1_STATTYPE" | "BaseStat2_STATTYPE";
      modifierTypeField: "BaseStat1_MODTYPE" | "BaseStat2_MODTYPE";
      valueField: "BaseStat1_Value" | "BaseStat2_Value";
      sourceValue: number | string;
    }>
  | Readonly<{
      kind: "gear-inherent";
      gearKey: number;
      slot: 1 | 2 | 3;
      statTypeField:
        | "InherentStat1_STATTYPE"
        | "InherentStat2_STATTYPE"
        | "InherentStat3_STATTYPE";
      modifierTypeField:
        | "InherentStat1_MODTYPE"
        | "InherentStat2_MODTYPE"
        | "InherentStat3_MODTYPE";
      valueField:
        "InherentStat1_Value" | "InherentStat2_Value" | "InherentStat3_Value";
    }>
  | Readonly<{
      kind: "rolled-stat";
      statePath: string;
      table: "stat_mods";
      statModKey: number;
      storedValue: number;
      sourceRows: readonly Readonly<{
        tier: number;
        minRawValue: number;
        maxRawValue: number;
        interval: number;
      }>[];
    }>;

export type ItemEffect =
  | Readonly<{
      kind: "stat-modifier";
      statType: string;
      modifierType: string;
      rawValue: number;
      unit: Exclude<ItemEffectUnit, "UNPROVEN">;
      provenance: ItemEffectProvenance;
    }>
  | Readonly<{
      kind: "unsupported-source";
      statType: string;
      modifierType: string;
      rawValue: number;
      unit: ItemEffectUnit;
      reasons: readonly string[];
      provenance: ItemEffectProvenance;
    }>;

export interface EquippedGearItemEffectProjection {
  readonly source: "Item";
  readonly heroKey: number;
  readonly instanceId: string;
  readonly itemKey: number;
  readonly gearType: string;
  readonly itemLevel: number;
  readonly provenance: Readonly<{
    item: Readonly<{ table: "items"; itemKey: number }>;
    gear: Readonly<{ table: "gear"; gearKey: number }>;
    gearType: Readonly<{
      table: "gear_type_scales";
      gearType: string;
    }>;
    itemLevel:
      | Readonly<{
          kind: "catalog-row";
          table: "item_level_scales";
          level: number;
        }>
      | Readonly<{
          kind: "source-limitation";
          ruleId: "items.level->item_level_scales";
          level: 100;
          reason: string;
        }>;
  }>;
  readonly effects: readonly ItemEffect[];
  readonly oracleGates: readonly Readonly<{
    kind: "unique-mod";
    uniqueModKey: number;
    reason: string;
  }>[];
}

export interface EquippedGearItemEffectsInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly state: PlayerState;
  readonly heroKey: number;
  readonly instanceId: string;
}

export class DiscordHeroUnknownItemEffectSourceError extends Error {
  readonly statePath: string;
  readonly statModKey: number;

  constructor(statePath: string, statModKey: number) {
    super(
      `${statePath}.statModKey references unknown stat_mods key ${statModKey}`,
    );
    this.name = "DiscordHeroUnknownItemEffectSourceError";
    this.statePath = statePath;
    this.statModKey = statModKey;
  }
}

const BASE_FIELDS = [
  {
    slot: 1,
    statTypeField: "BaseStat1_STATTYPE",
    modifierTypeField: "BaseStat1_MODTYPE",
    valueField: "BaseStat1_Value",
  },
  {
    slot: 2,
    statTypeField: "BaseStat2_STATTYPE",
    modifierTypeField: "BaseStat2_MODTYPE",
    valueField: "BaseStat2_Value",
  },
] as const;

const INHERENT_FIELDS = [
  {
    slot: 1,
    statTypeField: "InherentStat1_STATTYPE",
    modifierTypeField: "InherentStat1_MODTYPE",
    valueField: "InherentStat1_Value",
  },
  {
    slot: 2,
    statTypeField: "InherentStat2_STATTYPE",
    modifierTypeField: "InherentStat2_MODTYPE",
    valueField: "InherentStat2_Value",
  },
  {
    slot: 3,
    statTypeField: "InherentStat3_STATTYPE",
    modifierTypeField: "InherentStat3_MODTYPE",
    valueField: "InherentStat3_Value",
  },
] as const;

const PROVEN_STAT_TYPES = new Set([
  "AddAllSkillLevel",
  "AddHpPerHit",
  "AddHpPerKill",
  "AdditionalExp",
  "AllElementalResistance",
  "AreaOfEffect",
  "Armor",
  "AttackDamage",
  "AttackSpeed",
  "BaseAttackCountReduction",
  "CastSpeed",
  "ChaosDamageAddition",
  "ChaosDamagePercent",
  "ChaosDamageReduction",
  "ChaosResistance",
  "ColdDamageAddition",
  "ColdDamagePercent",
  "ColdDamageReduction",
  "ColdResistance",
  "CooldownReduction",
  "CriticalChance",
  "CriticalDamage",
  "DamageAbsorption",
  "DamageAddition",
  "DamageReduction",
  "DodgeChance",
  "FireDamageAddition",
  "FireDamagePercent",
  "FireDamageReduction",
  "FireResistance",
  "HpLeech",
  "HpRegenPerSec",
  "IncreaseAreaOfEffectDamage",
  "IncreaseExpAmount",
  "IncreaseMeleeDamage",
  "IncreaseProjectileDamage",
  "IncreaseSummonDamage",
  "LightningDamageAddition",
  "LightningDamagePercent",
  "LightningDamageReduction",
  "LightningResistance",
  "MaxBlockChance",
  "MaxChaosResistance",
  "MaxColdResistance",
  "MaxDodgeChance",
  "MaxFireResistance",
  "MaxHp",
  "MaxLightningResistance",
  "MovementSpeed",
  "Multistrike",
  "PhysicalDamageAddition",
  "PhysicalDamagePercent",
  "PhysicalDamageReduction",
  "ProjectileCount",
  "SkillDurationIncrease",
  "SkillHealIncrease",
  "SkillRangeExpansion",
]);

const ACCESSORY_GEAR_TYPES = new Set(["AMULET", "EARING", "RING", "BRACER"]);

const LEVEL_100_ITEM_KEYS = new Set([
  300020, 310020, 320020, 330020, 340020, 350020, 400020, 410020, 420020,
  430020, 440020, 450020, 500020, 510020, 520020, 530020,
]);

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requirePositiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireNonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireNonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function sourceNumber(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d* $/.test(value)) {
    const parsed = Number(value.slice(0, -1));
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`${label} must be a source-proven safe integer`);
}

function unitFor(modifierType: string): ItemEffectUnit {
  if (modifierType === "FLAT") return "RAW";
  if (modifierType === "ADDITIVE" || modifierType === "MULTIPLICATIVE") {
    return "RAW_PER_THOUSAND";
  }
  return "UNPROVEN";
}

function projectEffect(
  statType: string,
  modifierType: string,
  rawValue: number,
  provenance: ItemEffectProvenance,
): ItemEffect {
  const unit = unitFor(modifierType);
  const reasons: string[] = [];
  if (statType === "BlockChance") {
    reasons.push(
      "BlockChance application requires the unresolved combat oracle",
    );
  } else if (!PROVEN_STAT_TYPES.has(statType)) {
    reasons.push(`unproven stat type ${statType}`);
  }
  if (unit === "UNPROVEN") {
    reasons.push(`unproven modifier type ${modifierType}`);
  }
  if (reasons.length > 0) {
    return {
      kind: "unsupported-source",
      statType,
      modifierType,
      rawValue,
      unit,
      reasons,
      provenance,
    };
  }
  if (unit === "UNPROVEN") {
    throw new Error(`unproven modifier type ${modifierType}`);
  }
  return {
    kind: "stat-modifier",
    statType,
    modifierType,
    rawValue,
    unit,
    provenance,
  };
}

function validateRowsAndGroups<Name extends DiscordHeroDatasetName>(
  indexes: DiscordHeroCatalogIndexes,
  name: Name,
  expectedPrimaryField: string,
  expectedRowCount: number,
): void {
  const table = indexes.tables[name];
  if (
    table.name !== name ||
    table.primaryField !== expectedPrimaryField ||
    !Array.isArray(table.rows)
  ) {
    throw new Error(`${name} must be a canonical table index`);
  }
  if (table.rows.length !== expectedRowCount) {
    throw new Error(
      `${name} must contain exactly ${expectedRowCount} source rows`,
    );
  }
  const expectedGroups = new Map<unknown, unknown[]>();
  for (const row of table.rows) {
    const key = (row as Record<string, unknown>)[expectedPrimaryField];
    const group = expectedGroups.get(key) ?? [];
    group.push(row);
    expectedGroups.set(key, group);
  }
  if (table.groups.size !== expectedGroups.size) {
    throw new Error(`${name} rows/groups disagree`);
  }
  for (const [key, expected] of expectedGroups) {
    const actual = table.groups.get(key as never);
    if (
      actual === undefined ||
      actual.length !== expected.length ||
      actual.some((row, index) => row !== expected[index])
    ) {
      throw new Error(`${name} rows/groups disagree for key ${String(key)}`);
    }
  }
}

function uniqueRows<Key extends string | number>(
  keys: readonly Key[],
  label: string,
): void {
  const seen = new Set<Key>();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`duplicate ${label} ${String(key)}`);
    seen.add(key);
  }
}

function validateItemEffectCatalog(indexes: DiscordHeroCatalogIndexes): void {
  validateRowsAndGroups(indexes, "items", "id", 5_944);
  validateRowsAndGroups(indexes, "gear", "GearKey", 5_760);
  validateRowsAndGroups(indexes, "gear_type_scales", "GearType", 20);
  validateRowsAndGroups(indexes, "gear_types", "GearType", 16);
  validateRowsAndGroups(indexes, "item_level_scales", "Level", 19);
  validateRowsAndGroups(indexes, "stat_mods", "StatModKey", 620);

  const gearTypeScales = new Map<
    string,
    DiscordHeroDatasetRow<"gear_type_scales">
  >();
  for (const row of indexes.tables.gear_type_scales.rows) {
    const gearType = requireNonemptyString(
      row.GearType,
      "gear_type_scales.GearType",
    );
    requireNonNegativeSafeInteger(
      row.AlchemyGoldScale,
      `gear type scale ${gearType} AlchemyGoldScale`,
    );
    requireNonNegativeSafeInteger(
      row.CubeExpScale,
      `gear type scale ${gearType} CubeExpScale`,
    );
    if (gearTypeScales.has(gearType)) {
      throw new Error(`duplicate gear type scale ${gearType}`);
    }
    gearTypeScales.set(gearType, row);
  }

  const gearTypes = new Map<string, DiscordHeroDatasetRow<"gear_types">>();
  for (const row of indexes.tables.gear_types.rows) {
    const gearType = requireNonemptyString(row.GearType, "gear_types.GearType");
    if (!gearTypeScales.has(gearType)) {
      throw new Error(`gear type ${gearType} has no gear type scale`);
    }
    if (gearTypes.has(gearType)) {
      throw new Error(`duplicate gear type ${gearType}`);
    }
    requireNonemptyString(
      row.BaseStat1_STATTYPE,
      `gear type ${gearType} BaseStat1_STATTYPE`,
    );
    requireNonemptyString(
      row.BaseStat1_MODTYPE,
      `gear type ${gearType} BaseStat1_MODTYPE`,
    );
    if (
      (row.BaseStat2_STATTYPE === null) !==
      (row.BaseStat2_MODTYPE === null)
    ) {
      throw new Error(`gear type ${gearType} base slot 2 is incomplete`);
    }
    if (row.BaseStat2_STATTYPE !== null) {
      requireNonemptyString(
        row.BaseStat2_STATTYPE,
        `gear type ${gearType} BaseStat2_STATTYPE`,
      );
      requireNonemptyString(
        row.BaseStat2_MODTYPE,
        `gear type ${gearType} BaseStat2_MODTYPE`,
      );
    }
    gearTypes.set(gearType, row);
  }
  const missingBaseDefinitions = [...gearTypeScales.keys()]
    .filter((gearType) => !gearTypes.has(gearType))
    .sort();
  const expectedAccessories = [...ACCESSORY_GEAR_TYPES].sort();
  if (
    missingBaseDefinitions.length !== expectedAccessories.length ||
    missingBaseDefinitions.some(
      (gearType, index) => gearType !== expectedAccessories[index],
    )
  ) {
    throw new Error(
      "gear base definitions must omit exactly the four zero-base accessories",
    );
  }

  const itemLevelScales = new Map<
    number,
    DiscordHeroDatasetRow<"item_level_scales">
  >();
  for (const row of indexes.tables.item_level_scales.rows) {
    const level = requirePositiveSafeInteger(
      row.Level,
      "item_level_scales.Level",
    );
    requireNonNegativeSafeInteger(
      row.AlchemyGoldScale,
      `item level ${level} AlchemyGoldScale`,
    );
    requireNonNegativeSafeInteger(
      row.CubeExpScale,
      `item level ${level} CubeExpScale`,
    );
    if (itemLevelScales.has(level)) {
      throw new Error(`duplicate item level scale ${level}`);
    }
    itemLevelScales.set(level, row);
  }

  const items = new Map<number, DiscordHeroDatasetRow<"items">>();
  const gearItemKeys: number[] = [];
  for (const row of indexes.tables.items.rows) {
    const itemKey = requirePositiveSafeInteger(row.id, "items.id");
    if (items.has(itemKey)) throw new Error(`duplicate item key ${itemKey}`);
    items.set(itemKey, row);
    if (row.type === "GEAR") {
      const gearType = requireNonemptyString(
        row.gear,
        `gear item ${itemKey} gear type`,
      );
      const level = requirePositiveSafeInteger(
        row.level,
        `gear item ${itemKey} level`,
      );
      if (!gearTypeScales.has(gearType)) {
        throw new Error(
          `gear item ${itemKey} references unknown gear type scale ${gearType}`,
        );
      }
      if (
        !itemLevelScales.has(level) &&
        (level !== 100 || !LEVEL_100_ITEM_KEYS.has(itemKey))
      ) {
        throw new Error(
          `gear item ${itemKey} references unknown item level scale ${level}`,
        );
      }
      gearItemKeys.push(itemKey);
    } else if (row.gear !== null || row.level !== null) {
      throw new Error(`non-gear item ${itemKey} has gear metadata`);
    }
  }

  const level100Keys = gearItemKeys.filter(
    (itemKey) => items.get(itemKey)!.level === 100,
  );
  uniqueRows(level100Keys, "level-100 item key");
  if (
    level100Keys.length !== LEVEL_100_ITEM_KEYS.size ||
    level100Keys.some((itemKey) => !LEVEL_100_ITEM_KEYS.has(itemKey))
  ) {
    throw new Error(
      "level-100 item limitations do not match the pinned source corpus",
    );
  }
  const levelLimitations = indexes.semanticReport.unresolvedReferences.filter(
    (reference) => reference.ruleId === "items.level->item_level_scales",
  );
  if (
    levelLimitations.length !== LEVEL_100_ITEM_KEYS.size ||
    levelLimitations.some(
      (reference) =>
        !LEVEL_100_ITEM_KEYS.has(Number(reference.sourceKey)) ||
        reference.targetKey !== 100 ||
        reference.reason !==
          "source documentation defines no level-100 scale and uses factor 1",
    )
  ) {
    throw new Error(
      "item level source limitations do not match the pinned corpus",
    );
  }

  const gearKeys: number[] = [];
  for (const row of indexes.tables.gear.rows) {
    const gearKey = requirePositiveSafeInteger(row.GearKey, "gear.GearKey");
    gearKeys.push(gearKey);
    const item = items.get(gearKey);
    if (item?.type !== "GEAR" || item.gear === null) {
      throw new Error(`orphan gear row ${gearKey}`);
    }
    sourceNumber(row.BaseStat1_Value, `gear ${gearKey} BaseStat1_Value`);
    if (row.BaseStat2_Value !== null) {
      sourceNumber(row.BaseStat2_Value, `gear ${gearKey} BaseStat2_Value`);
    }
    const gearType = gearTypes.get(item.gear);
    if (gearType === undefined) {
      if (
        !ACCESSORY_GEAR_TYPES.has(item.gear) ||
        row.BaseStat1_Value !== 0 ||
        (row.BaseStat2_Value !== null && row.BaseStat2_Value !== 0)
      ) {
        throw new Error(
          `gear type ${item.gear} has no base definition but gear ${gearKey} has base values`,
        );
      }
    } else {
      if (
        gearType.BaseStat2_STATTYPE === null &&
        row.BaseStat2_Value !== null &&
        row.BaseStat2_Value !== 0
      ) {
        throw new Error(`gear ${gearKey} has an unexpected base slot 2 value`);
      }
    }
    for (const fields of INHERENT_FIELDS) {
      const statType = requireNonemptyString(
        row[fields.statTypeField],
        `gear ${gearKey} ${fields.statTypeField}`,
      );
      const modifierType = requireNonemptyString(
        row[fields.modifierTypeField],
        `gear ${gearKey} ${fields.modifierTypeField}`,
      );
      const value = requireNonNegativeSafeInteger(
        row[fields.valueField],
        `gear ${gearKey} ${fields.valueField}`,
      );
      if (statType === "NONE" && (modifierType !== "FLAT" || value !== 0)) {
        throw new Error(
          `gear ${gearKey} inherent slot ${fields.slot} has a malformed NONE sentinel`,
        );
      }
    }
    if (row.UniqueModKey !== null) {
      requireNonNegativeSafeInteger(
        row.UniqueModKey,
        `gear ${gearKey} UniqueModKey`,
      );
    }
  }
  uniqueRows(gearKeys, "gear key");
  const gearKeySet = new Set(gearKeys);
  if (
    gearItemKeys.length !== gearKeys.length ||
    gearItemKeys.some((itemKey) => !gearKeySet.has(itemKey))
  ) {
    throw new Error("items and gear rows do not form an exact corpus join");
  }

  const statModGroups = new Map<number, DiscordHeroDatasetRow<"stat_mods">[]>();
  for (const row of indexes.tables.stat_mods.rows) {
    const statModKey = requirePositiveSafeInteger(
      row.StatModKey,
      "stat_mods.StatModKey",
    );
    requirePositiveSafeInteger(row.Tier, `stat mod ${statModKey} tier`);
    requireNonemptyString(row.STATTYPE, `stat mod ${statModKey} STATTYPE`);
    requireNonemptyString(row.MODTYPE, `stat mod ${statModKey} MODTYPE`);
    sourceIntervalCandidates(row);
    const group = statModGroups.get(statModKey) ?? [];
    group.push(row);
    statModGroups.set(statModKey, group);
  }
  if (statModGroups.size !== 62) {
    throw new Error("stat_mods must contain exactly 62 source groups");
  }
  for (const [statModKey, rows] of statModGroups) {
    const tiers = rows.map((row) => row.Tier);
    uniqueRows(tiers, `stat mod ${statModKey} tier`);
    if (
      rows.length !== 10 ||
      [...tiers]
        .sort((left, right) => left - right)
        .some((tier, index) => tier !== index + 1)
    ) {
      throw new Error(`stat mod ${statModKey} must contain tiers 1-10`);
    }
    if (
      new Set(rows.map((row) => row.STATTYPE)).size !== 1 ||
      new Set(rows.map((row) => row.MODTYPE)).size !== 1
    ) {
      throw new Error(`stat mod ${statModKey} has ambiguous source type`);
    }
    if (new Set(rows.map((row) => row.Interval)).size !== 1) {
      throw new Error(`stat mod ${statModKey} has ambiguous source Interval`);
    }
  }
}

function matchingSourceRows(
  rows: readonly DiscordHeroDatasetRow<"stat_mods">[],
  statModKey: number,
  storedValue: number,
): {
  readonly statType: string;
  readonly modifierType: string;
  readonly rawValue: number;
  readonly rows: readonly Readonly<{
    tier: number;
    minRawValue: number;
    maxRawValue: number;
    interval: number;
  }>[];
} {
  const statTypes = new Set(rows.map((row) => row.STATTYPE));
  const modifierTypes = new Set(rows.map((row) => row.MODTYPE));
  const intervals = new Set(rows.map((row) => row.Interval));
  for (const row of rows) sourceIntervalCandidates(row);
  if (statTypes.size !== 1 || modifierTypes.size !== 1) {
    throw new Error(`stat mod ${statModKey} has ambiguous source type`);
  }
  if (intervals.size !== 1) {
    throw new Error(`stat mod ${statModKey} has ambiguous source Interval`);
  }

  const matches = rows.filter((row) =>
    sourceIntervalCandidates(row).includes(storedValue),
  );
  if (matches.length === 0) {
    throw new Error(
      `stat mod ${statModKey} value ${storedValue} is not a source candidate`,
    );
  }
  const interval = matches[0]!.Interval;
  const rawValue = storedValue * interval;
  if (!Number.isSafeInteger(rawValue)) {
    throw new Error(`stat mod ${statModKey} raw value is unsafe`);
  }
  return {
    statType: matches[0]!.STATTYPE,
    modifierType: matches[0]!.MODTYPE,
    rawValue,
    rows: matches.map((row) => ({
      tier: row.Tier,
      minRawValue: row.MinValue,
      maxRawValue: row.MaxValue,
      interval: row.Interval,
    })),
  };
}

function storedGearSources(state: PlayerState): Array<{
  readonly path: string;
  readonly asset: PlayerState["heroes"][number]["equipment"][number]["asset"];
}> {
  const sources: Array<{
    readonly path: string;
    readonly asset: PlayerState["heroes"][number]["equipment"][number]["asset"];
  }> = [];
  for (const [heroIndex, hero] of state.heroes.entries()) {
    for (const [equipmentIndex, equipment] of hero.equipment.entries()) {
      sources.push({
        path: `heroes[${heroIndex}].equipment[${equipmentIndex}].asset`,
        asset: equipment.asset,
      });
    }
  }
  for (const [containerName, container] of Object.entries(state.containers)) {
    for (const [slotIndex, slot] of container.slots.entries()) {
      if (slot.asset.kind === "gear") {
        sources.push({
          path: `containers.${containerName}.slots[${slotIndex}].asset`,
          asset: slot.asset,
        });
      }
    }
  }
  for (const [rewardIndex, asset] of (
    state.stageSession?.pendingRewards.items ?? []
  ).entries()) {
    if (asset.kind === "gear") {
      sources.push({
        path: `stageSession.pendingRewards.items[${rewardIndex}]`,
        asset,
      });
    }
  }
  return sources;
}

export function assertDiscordHeroItemEffectSourcesKnown(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): void {
  for (const { path, asset } of storedGearSources(state)) {
    for (const [rolledIndex, rolledStat] of asset.rolledStats.entries()) {
      if (
        indexes.tables.stat_mods.groups.get(rolledStat.statModKey) === undefined
      ) {
        throw new DiscordHeroUnknownItemEffectSourceError(
          `${path}.rolledStats[${rolledIndex}]`,
          rolledStat.statModKey,
        );
      }
    }
  }
}

function validateStoredGearSources(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): void {
  for (const { path, asset } of storedGearSources(state)) {
    requireCanonicalGearInstanceId(asset.instanceId, `${path}.instanceId`);
    const seenStatMods = new Set<number>();
    for (const [rolledIndex, rolledStat] of asset.rolledStats.entries()) {
      if (seenStatMods.has(rolledStat.statModKey)) {
        throw new Error(
          `${path}.rolledStats repeats stat mod ${rolledStat.statModKey}`,
        );
      }
      seenStatMods.add(rolledStat.statModKey);
      const rows = indexes.tables.stat_mods.groups.get(rolledStat.statModKey);
      if (rows === undefined) {
        throw new DiscordHeroUnknownItemEffectSourceError(
          `${path}.rolledStats[${rolledIndex}]`,
          rolledStat.statModKey,
        );
      }
      matchingSourceRows(rows, rolledStat.statModKey, rolledStat.value);
    }
  }
}

export function projectEquippedGearItemEffects(
  input: EquippedGearItemEffectsInput,
): EquippedGearItemEffectProjection {
  const heroKey = requirePositiveSafeInteger(input.heroKey, "hero key");
  const instanceId = requireCanonicalGearInstanceId(
    input.instanceId,
    "equipped gear instance ID",
  );
  validateItemEffectCatalog(input.indexes);
  getCatalogRow(input.indexes, "heroes", heroKey);
  const state = validatePlayerAgainstCatalog(input.state, input.indexes);
  validateStoredGearSources(input.indexes, state);
  const hero = state.heroes.find((candidate) => candidate.heroKey === heroKey);
  if (hero === undefined) {
    throw new Error(`hero ${heroKey} is not owned`);
  }
  const matches = hero.equipment
    .map((equipment, equipmentIndex) => ({ equipment, equipmentIndex }))
    .filter(({ equipment }) => equipment.asset.instanceId === instanceId);
  if (matches.length !== 1) {
    throw new Error(
      `expected one equipped gear instance ${instanceId} for hero ${heroKey}; found ${matches.length}`,
    );
  }
  const { equipment, equipmentIndex } = matches[0]!;
  const { asset } = equipment;
  const item = getCatalogRow(input.indexes, "items", asset.itemKey);
  if (
    item.deleted === true ||
    item.type !== "GEAR" ||
    item.gear === null ||
    item.level === null
  ) {
    throw new Error(`item ${asset.itemKey} is not active source gear`);
  }
  if (equipment.slot !== item.gear) {
    throw new Error(
      `equipment slot ${equipment.slot} does not match item ${item.id} gear type ${item.gear}`,
    );
  }
  getCatalogRow(input.indexes, "gear_type_scales", item.gear);
  const gear = getCatalogRow(input.indexes, "gear", asset.itemKey);
  if (gear.GearKey !== item.id) {
    throw new Error(`gear row ${gear.GearKey} does not match item ${item.id}`);
  }

  const effects: ItemEffect[] = [];
  const gearTypeRows = input.indexes.tables.gear_types.groups.get(item.gear);
  if (gearTypeRows !== undefined) {
    if (gearTypeRows.length !== 1) {
      throw new Error(`gear type ${item.gear} has no unique base definition`);
    }
    const gearType = gearTypeRows[0]!;
    for (const fields of BASE_FIELDS) {
      const statType = gearType[fields.statTypeField];
      const modifierType = gearType[fields.modifierTypeField];
      const sourceValue = gear[fields.valueField];
      if (
        statType === null &&
        modifierType === null &&
        (sourceValue === null || sourceValue === 0)
      ) {
        continue;
      }
      if (
        typeof statType !== "string" ||
        typeof modifierType !== "string" ||
        sourceValue === null
      ) {
        throw new Error(
          `gear type ${item.gear} base slot ${fields.slot} is incomplete`,
        );
      }
      effects.push(
        projectEffect(
          statType,
          modifierType,
          sourceNumber(
            sourceValue,
            `gear ${gear.GearKey} ${fields.valueField}`,
          ),
          {
            kind: "gear-base",
            gearKey: gear.GearKey,
            gearType: item.gear,
            slot: fields.slot,
            statTypeField: fields.statTypeField,
            modifierTypeField: fields.modifierTypeField,
            valueField: fields.valueField,
            sourceValue,
          },
        ),
      );
    }
  } else if (
    gear.BaseStat1_Value !== 0 ||
    (gear.BaseStat2_Value !== null && gear.BaseStat2_Value !== 0)
  ) {
    throw new Error(
      `gear type ${item.gear} has no base definition but gear ${gear.GearKey} has base values`,
    );
  }

  for (const fields of INHERENT_FIELDS) {
    const statType = gear[fields.statTypeField];
    const modifierType = gear[fields.modifierTypeField];
    const rawValue = gear[fields.valueField];
    if (statType === "NONE") {
      if (modifierType !== "FLAT" || rawValue !== 0) {
        throw new Error(
          `gear ${gear.GearKey} inherent slot ${fields.slot} has a malformed NONE sentinel`,
        );
      }
      continue;
    }
    effects.push(
      projectEffect(statType, modifierType, rawValue, {
        kind: "gear-inherent",
        gearKey: gear.GearKey,
        slot: fields.slot,
        statTypeField: fields.statTypeField,
        modifierTypeField: fields.modifierTypeField,
        valueField: fields.valueField,
      }),
    );
  }

  for (const [rolledIndex, rolledStat] of asset.rolledStats.entries()) {
    const rows = input.indexes.tables.stat_mods.groups.get(
      rolledStat.statModKey,
    );
    if (rows === undefined) {
      throw new Error(
        `rolled stat ${rolledStat.statModKey} has no source rows`,
      );
    }
    const source = matchingSourceRows(
      rows,
      rolledStat.statModKey,
      rolledStat.value,
    );
    effects.push(
      projectEffect(source.statType, source.modifierType, source.rawValue, {
        kind: "rolled-stat",
        statePath: `heroes[${state.heroes.indexOf(hero)}].equipment[${equipmentIndex}].asset.rolledStats[${rolledIndex}]`,
        table: "stat_mods",
        statModKey: rolledStat.statModKey,
        storedValue: rolledStat.value,
        sourceRows: source.rows,
      }),
    );
  }

  const itemLevel = input.indexes.tables.item_level_scales.groups.has(
    item.level,
  )
    ? {
        kind: "catalog-row" as const,
        table: "item_level_scales" as const,
        level: item.level,
      }
    : {
        kind: "source-limitation" as const,
        ruleId: "items.level->item_level_scales" as const,
        level: item.level as 100,
        reason:
          "source documentation defines no level-100 scale and uses factor 1",
      };
  const oracleGates =
    gear.UniqueModKey !== null && gear.UniqueModKey !== 0
      ? [
          {
            kind: "unique-mod" as const,
            uniqueModKey: getCatalogRow(
              input.indexes,
              "unique_mods",
              gear.UniqueModKey,
            ).UniqueModKey,
            reason:
              "unique-mod runtime semantics are outside the source-proven stat projection",
          },
        ]
      : [];

  return deepFreeze({
    source: "Item",
    heroKey,
    instanceId,
    itemKey: item.id,
    gearType: item.gear,
    itemLevel: item.level,
    provenance: {
      item: { table: "items", itemKey: item.id },
      gear: { table: "gear", gearKey: gear.GearKey },
      gearType: {
        table: "gear_type_scales",
        gearType: item.gear,
      },
      itemLevel,
    },
    effects,
    oracleGates,
  });
}
