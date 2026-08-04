import {
  SlotContainerSchema,
  StoredAssetSchema,
  type SlotContainer,
  type StoredAsset,
} from "./player";
import { cubeExpForItem } from "./cube";

export type RandomSource = () => number;

export class OracleRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OracleRequiredError";
  }
}

export interface SourceItemRow {
  id: number;
  grade: string;
  type: string;
  gear: string | null;
  level: number | null;
}

export interface SourceGearRow {
  GearKey: number;
  [field: string]: unknown;
}

export interface ResolvedItemDefinition {
  item: SourceItemRow;
  gear: SourceGearRow | null;
}

export interface ItemDefinitionSource {
  items: readonly SourceItemRow[];
  gear: readonly SourceGearRow[];
}

export interface SourceGradeValueRow {
  GRADE: string;
  BaseAlchemyGold: number;
  BaseCubeExp: number;
}

export interface SourceItemLevelScaleRow {
  Level: number;
  AlchemyGoldScale: number;
  CubeExpScale: number;
}

export interface SourceGearTypeScaleRow {
  GearType: string;
  AlchemyGoldScale: number;
  CubeExpScale: number;
}

export interface SourceItemTypeScaleRow {
  ItemType: string;
  AlchemyGoldScale: number;
  CubeExpScale: number;
}

export interface CubeValueSource extends ItemDefinitionSource {
  grades: readonly SourceGradeValueRow[];
  itemLevelScales: readonly SourceItemLevelScaleRow[];
  gearTypeScales: readonly SourceGearTypeScaleRow[];
  itemTypeScales: readonly SourceItemTypeScaleRow[];
}

export interface SourceStatModRow {
  StatModKey: number;
  Tier: number;
  STATTYPE: string;
  MODTYPE: string;
  MinValue: number;
  MaxValue: number;
  Interval: number;
}

export type InventoryDebit =
  | {
      kind: "stack";
      itemKey: number;
      quantity: number;
    }
  | {
      kind: "gear";
      instanceId: string;
    };

export interface InventoryCredit {
  index: number;
  asset: StoredAsset;
}

export interface CubeExperienceBonus {
  cubeExperience: number;
}

export interface AlchemyBonuses extends CubeExperienceBonus {
  alchemyGold: number;
}

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function safeAdd(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${context} produced an unsafe integer`);
  }
  return result;
}

export function requireCanonicalGearInstanceId(
  value: unknown,
  context = "gear instance ID",
): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    throw new Error(`${context} must be a canonical stable instance ID`);
  }
  return value;
}

function validatedInventory(container: SlotContainer): SlotContainer {
  const parsed = SlotContainerSchema.parse(container);
  for (const slot of parsed.slots) {
    if (slot.asset.kind === "gear") {
      requireCanonicalGearInstanceId(
        slot.asset.instanceId,
        `gear asset ${slot.asset.itemKey} instance ID`,
      );
    }
  }
  return parsed;
}

export function createItemIndex(
  items: readonly SourceItemRow[],
  gearRows: readonly SourceGearRow[],
): ReadonlyMap<number, ResolvedItemDefinition> {
  const itemByKey = new Map<number, SourceItemRow>();
  for (const item of items) {
    requirePositiveSafeInteger(item.id, "item key");
    if (itemByKey.has(item.id)) {
      throw new Error(`duplicate item key ${item.id}`);
    }
    itemByKey.set(item.id, item);
  }

  const gearByKey = new Map<number, SourceGearRow>();
  for (const gear of gearRows) {
    requirePositiveSafeInteger(gear.GearKey, "gear key");
    if (!itemByKey.has(gear.GearKey)) {
      throw new Error(`orphan gear row ${gear.GearKey}`);
    }
    if (gearByKey.has(gear.GearKey)) {
      throw new Error(`duplicate gear row ${gear.GearKey}`);
    }
    gearByKey.set(gear.GearKey, gear);
  }

  const index = new Map<number, ResolvedItemDefinition>();
  for (const item of items) {
    const gear = gearByKey.get(item.id) ?? null;
    if (item.type === "GEAR") {
      if (item.gear === null || item.level === null) {
        throw new Error(`gear item ${item.id} is missing gear type or level`);
      }
      if (gear === null) {
        throw new Error(`gear item ${item.id} is missing gear row`);
      }
    } else {
      if (item.gear !== null || item.level !== null) {
        throw new Error(`non-gear item ${item.id} has gear metadata`);
      }
      if (gear !== null) {
        throw new Error(`non-gear item ${item.id} has gear row`);
      }
    }
    index.set(item.id, { item, gear });
  }
  return index;
}

export function resolveSourceItemDefinition(
  source: ItemDefinitionSource,
  itemKey: number,
): ResolvedItemDefinition {
  requirePositiveSafeInteger(itemKey, "item key");
  const itemMatches = source.items.filter((item) => item.id === itemKey);
  if (itemMatches.length !== 1) {
    throw new Error(
      `expected one source item ${itemKey}; found ${itemMatches.length}`,
    );
  }
  const item = itemMatches[0]!;
  const gearMatches = source.gear.filter((gear) => gear.GearKey === itemKey);
  if (item.type === "GEAR") {
    if (item.gear === null || item.level === null) {
      throw new Error(`gear item ${itemKey} is missing gear type or level`);
    }
    if (gearMatches.length !== 1) {
      throw new Error(
        `expected one gear row ${itemKey}; found ${gearMatches.length}`,
      );
    }
    return { item, gear: gearMatches[0]! };
  }

  if (item.gear !== null || item.level !== null) {
    throw new Error(`non-gear item ${itemKey} has gear metadata`);
  }
  if (gearMatches.length !== 0) {
    throw new Error(`non-gear item ${itemKey} has gear row`);
  }
  return { item, gear: null };
}

export function createCanonicalStoredAsset(input: {
  itemKey: number;
  gearInstanceId?: string;
  source: ItemDefinitionSource;
}): StoredAsset {
  const definition = resolveSourceItemDefinition(input.source, input.itemKey);
  if (definition.item.type === "GEAR") {
    const instanceId = requireCanonicalGearInstanceId(
      input.gearInstanceId,
      `gear item ${input.itemKey} instance ID`,
    );
    return {
      kind: "gear",
      instanceId,
      itemKey: input.itemKey,
      rolledStats: [],
    };
  }
  if (input.gearInstanceId !== undefined) {
    throw new Error(
      `stack item ${input.itemKey} does not accept a gear instance ID`,
    );
  }
  return { kind: "stack", itemKey: input.itemKey, quantity: 1 };
}

function exactlyOne<T>(
  rows: readonly T[],
  predicate: (row: T) => boolean,
  context: string,
): T {
  const matches = rows.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`expected one ${context}; found ${matches.length}`);
  }
  return matches[0]!;
}

function requireFiniteBonus(value: number, context: string): void {
  if (!Number.isFinite(value) || value < -1_000) {
    throw new Error(
      `${context} must be finite and cannot reduce its multiplier below zero`,
    );
  }
}

function sourceValueFactors(
  itemKey: number,
  source: CubeValueSource,
): {
  item: SourceItemRow;
  grade: SourceGradeValueRow;
  itemLevelAlchemyScale: number;
  itemLevelCubeScale: number;
  gearAlchemyScale: number;
  gearCubeScale: number;
  itemTypeAlchemyScale: number;
  itemTypeCubeScale: number;
} {
  const { item } = resolveSourceItemDefinition(source, itemKey);
  const grade = exactlyOne(
    source.grades,
    (row) => row.GRADE === item.grade,
    `grade value row ${item.grade}`,
  );
  const itemType = exactlyOne(
    source.itemTypeScales,
    (row) => row.ItemType === item.type,
    `item-type scale ${item.type}`,
  );
  const itemLevelMatches =
    item.level === null
      ? []
      : source.itemLevelScales.filter((row) => row.Level === item.level);
  if (itemLevelMatches.length > 1) {
    throw new Error(
      `expected at most one item-level scale ${item.level}; found ${itemLevelMatches.length}`,
    );
  }
  const itemLevel = itemLevelMatches[0] ?? null;
  const gearType =
    item.gear === null
      ? null
      : exactlyOne(
          source.gearTypeScales,
          (row) => row.GearType === item.gear,
          `gear-type scale ${item.gear}`,
        );

  const factors = {
    item,
    grade,
    itemLevelAlchemyScale: itemLevel?.AlchemyGoldScale ?? 1_000,
    itemLevelCubeScale: itemLevel?.CubeExpScale ?? 1_000,
    gearAlchemyScale: gearType?.AlchemyGoldScale ?? 1_000,
    gearCubeScale: gearType?.CubeExpScale ?? 1_000,
    itemTypeAlchemyScale: itemType.AlchemyGoldScale,
    itemTypeCubeScale: itemType.CubeExpScale,
  };
  for (const [context, value] of [
    [`grade ${item.grade} Alchemy base`, grade.BaseAlchemyGold],
    [`grade ${item.grade} Cube EXP base`, grade.BaseCubeExp],
    [`item ${item.id} level Alchemy scale`, factors.itemLevelAlchemyScale],
    [`item ${item.id} level Cube EXP scale`, factors.itemLevelCubeScale],
    [`item ${item.id} gear Alchemy scale`, factors.gearAlchemyScale],
    [`item ${item.id} gear Cube EXP scale`, factors.gearCubeScale],
    [`item ${item.id} type Alchemy scale`, factors.itemTypeAlchemyScale],
    [`item ${item.id} type Cube EXP scale`, factors.itemTypeCubeScale],
  ] as const) {
    requireNonNegativeSafeInteger(value, context);
  }
  return factors;
}

export function cubeLevelMatch(cubeLevel: number, itemLevel: number): number {
  requirePositiveSafeInteger(cubeLevel, "Cube level");
  requirePositiveSafeInteger(itemLevel, "item level");

  const atOrBelowCubeLevel = itemLevel <= cubeLevel;
  const fullDistanceScale = atOrBelowCubeLevel ? 2 : 5;
  const shoulderDistanceScale = atOrBelowCubeLevel ? 5 : 6;
  const shoulderFloor = atOrBelowCubeLevel ? 0.5 : 0.4;
  const logarithm = Math.log(cubeLevel + 1);
  const fullDistance = Math.trunc((logarithm / 10 + 1) * fullDistanceScale);
  const shoulderWidth = Math.trunc(
    (logarithm / 10 + 1) * shoulderDistanceScale,
  );
  const distance = Math.abs(cubeLevel - itemLevel);
  if (distance <= fullDistance) return 1;

  const tailDistance = distance - fullDistance - shoulderWidth;
  if (tailDistance <= 0) {
    const shoulderProgress = (distance - fullDistance) / shoulderWidth;
    return 1 - (1 - shoulderFloor) * shoulderProgress * shoulderProgress;
  }
  return (
    shoulderFloor *
    (0.01 / shoulderFloor) ** (tailDistance / Math.max(cubeLevel / 3, 3))
  );
}

export function sourceCubeExperience(input: {
  itemKey: number;
  cubeLevel: number;
  source: CubeValueSource;
  cubeExperienceBonus: number;
}): number {
  const factors = sourceValueFactors(input.itemKey, input.source);
  if (factors.item.level === null) {
    throw new OracleRequiredError(
      `item ${input.itemKey} has level:null; Cube EXP level-match semantics require an oracle`,
    );
  }
  return cubeExpForItem({
    gradeBase: factors.grade.BaseCubeExp,
    itemLevelScale: factors.itemLevelCubeScale,
    gearTypeScale: factors.gearCubeScale,
    itemTypeScale: factors.itemTypeCubeScale,
    levelMatch: cubeLevelMatch(input.cubeLevel, factors.item.level),
    cubeExpBonus: input.cubeExperienceBonus,
  });
}

export function sourceAlchemyGold(input: {
  itemKey: number;
  source: CubeValueSource;
  alchemyGoldBonus: number;
}): number {
  const factors = sourceValueFactors(input.itemKey, input.source);
  requireFiniteBonus(input.alchemyGoldBonus, "Alchemy gold bonus");

  const product =
    BigInt(factors.grade.BaseAlchemyGold) *
    BigInt(factors.itemLevelAlchemyScale) *
    BigInt(factors.gearAlchemyScale) *
    BigInt(factors.itemTypeAlchemyScale);
  const roundedBase = (product + 500_000_000n) / 1_000_000_000n;
  if (roundedBase > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Alchemy gold base produced an unsafe integer");
  }
  const result = Math.floor(
    Number(roundedBase) * (1 + input.alchemyGoldBonus / 1_000),
  );
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("Alchemy gold produced an unsafe integer");
  }
  return result;
}

export function sourceIntervalCandidates(
  row: SourceStatModRow,
): readonly number[] {
  if (!Number.isSafeInteger(row.MinValue)) {
    throw new Error(
      `stat mod ${row.StatModKey} minimum must be a safe integer`,
    );
  }
  if (!Number.isSafeInteger(row.MaxValue)) {
    throw new Error(
      `stat mod ${row.StatModKey} maximum must be a safe integer`,
    );
  }
  if (row.MaxValue < row.MinValue) {
    throw new Error(`stat mod ${row.StatModKey} maximum is below minimum`);
  }
  if (!Number.isSafeInteger(row.Interval) || row.Interval <= 0) {
    throw new Error(
      `stat mod ${row.StatModKey} interval must be a positive safe integer`,
    );
  }

  const candidateCount = row.MaxValue - row.MinValue + 1;
  if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0) {
    throw new Error(`stat mod ${row.StatModKey} candidate count is unsafe`);
  }

  return Array.from(
    { length: candidateCount },
    (_, offset) => (row.MinValue + offset) / row.Interval,
  );
}

export function requireSourceRolledStatCandidate(input: {
  sourceRows: readonly SourceStatModRow[];
  statModKey: number;
  value: number;
}): void {
  const matches = input.sourceRows.filter(
    (row) => row.StatModKey === input.statModKey,
  );
  const candidateSets = matches.map((row) => sourceIntervalCandidates(row));
  const isSourceCandidate = candidateSets.some((candidates) =>
    candidates.some((candidate) => candidate === input.value),
  );
  if (!isSourceCandidate) {
    throw new Error(
      `stat mod ${input.statModKey} value ${input.value} is not a source candidate`,
    );
  }
}

export function rollSourceInterval(
  row: SourceStatModRow,
  _rng: RandomSource,
): never {
  sourceIntervalCandidates(row);
  throw new OracleRequiredError(
    `stat mod ${row.StatModKey} roll requires unresolved source RNG oracle`,
  );
}

export function debitInventory(
  container: SlotContainer,
  debits: readonly InventoryDebit[],
): SlotContainer {
  const safeContainer = validatedInventory(container);
  const stackRequirements = new Map<number, number>();
  const gearRequirements = new Set<string>();

  for (const debit of debits) {
    if (typeof debit !== "object" || debit === null) {
      throw new Error("inventory debit must be an object");
    }
    if (debit.kind === "stack") {
      requirePositiveSafeInteger(debit.itemKey, "stack debit item key");
      requirePositiveSafeInteger(
        debit.quantity,
        `stack item ${debit.itemKey} debit`,
      );
      stackRequirements.set(
        debit.itemKey,
        safeAdd(
          stackRequirements.get(debit.itemKey) ?? 0,
          debit.quantity,
          `stack item ${debit.itemKey} debit`,
        ),
      );
      continue;
    }
    if (debit.kind !== "gear") {
      throw new Error("inventory debit has unknown kind");
    }
    const instanceId = requireCanonicalGearInstanceId(
      debit.instanceId,
      "gear debit instance ID",
    );
    if (gearRequirements.has(instanceId)) {
      throw new Error(`duplicate gear debit ${instanceId}`);
    }
    gearRequirements.add(instanceId);
  }

  for (const [itemKey, quantity] of stackRequirements) {
    let available = 0;
    for (const slot of safeContainer.slots) {
      if (slot.asset.kind === "stack" && slot.asset.itemKey === itemKey) {
        available = safeAdd(
          available,
          slot.asset.quantity,
          `stack item ${itemKey} availability`,
        );
      }
    }
    if (available < quantity) {
      throw new Error(
        `insufficient stack item ${itemKey}: need ${quantity}, have ${available}`,
      );
    }
  }

  for (const instanceId of gearRequirements) {
    const matches = safeContainer.slots.filter(
      (slot) =>
        slot.asset.kind === "gear" && slot.asset.instanceId === instanceId,
    );
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `missing gear instance ${instanceId}`
          : `duplicate gear instance ${instanceId}`,
      );
    }
  }

  const remainingStackDebits = new Map(stackRequirements);
  const slots: SlotContainer["slots"] = [];
  for (const slot of safeContainer.slots) {
    if (slot.asset.kind === "gear") {
      if (!gearRequirements.has(slot.asset.instanceId)) {
        slots.push(slot);
      }
      continue;
    }

    const remaining = remainingStackDebits.get(slot.asset.itemKey) ?? 0;
    if (remaining === 0) {
      slots.push(slot);
      continue;
    }
    const consumed = Math.min(remaining, slot.asset.quantity);
    remainingStackDebits.set(slot.asset.itemKey, remaining - consumed);
    if (consumed < slot.asset.quantity) {
      slots.push({
        index: slot.index,
        asset: {
          ...slot.asset,
          quantity: slot.asset.quantity - consumed,
        },
      });
    }
  }

  return { unlockedSlots: safeContainer.unlockedSlots, slots };
}

export function creditInventory(
  container: SlotContainer,
  credits: readonly InventoryCredit[],
): SlotContainer {
  const safeContainer = validatedInventory(container);
  const safeCredits = credits.map((credit, creditIndex) => {
    if (typeof credit !== "object" || credit === null) {
      throw new Error(`inventory credit ${creditIndex} must be an object`);
    }
    const asset = StoredAssetSchema.parse(credit.asset);
    if (asset.kind === "gear") {
      requireCanonicalGearInstanceId(
        asset.instanceId,
        `credit gear ${asset.itemKey} instance ID`,
      );
    }
    return { index: credit.index, asset };
  });
  const stackTotals = new Map<number, number>();
  for (const asset of [
    ...safeContainer.slots.map((slot) => slot.asset),
    ...safeCredits.map((credit) => credit.asset),
  ]) {
    if (asset.kind !== "stack") continue;
    stackTotals.set(
      asset.itemKey,
      safeAdd(
        stackTotals.get(asset.itemKey) ?? 0,
        asset.quantity,
        `stack item ${asset.itemKey} aggregate quantity`,
      ),
    );
  }
  const occupiedSlots = new Set(safeContainer.slots.map((slot) => slot.index));
  const gearInstances = new Set(
    safeContainer.slots.flatMap((slot) =>
      slot.asset.kind === "gear" ? [slot.asset.instanceId] : [],
    ),
  );

  for (const credit of safeCredits) {
    if (
      !Number.isSafeInteger(credit.index) ||
      credit.index < 0 ||
      credit.index >= safeContainer.unlockedSlots
    ) {
      throw new Error(
        `credit slot ${credit.index} is outside unlocked capacity ${safeContainer.unlockedSlots}`,
      );
    }
    if (occupiedSlots.has(credit.index)) {
      throw new Error(`credit slot ${credit.index} is occupied`);
    }
    occupiedSlots.add(credit.index);

    if (credit.asset.kind === "gear") {
      if (gearInstances.has(credit.asset.instanceId)) {
        throw new Error(`duplicate gear instance ${credit.asset.instanceId}`);
      }
      gearInstances.add(credit.asset.instanceId);
    }
  }

  return {
    unlockedSlots: safeContainer.unlockedSlots,
    slots: [
      ...safeContainer.slots,
      ...safeCredits.map((credit) => ({
        index: credit.index,
        asset: credit.asset,
      })),
    ],
  };
}
