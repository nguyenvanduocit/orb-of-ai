import {
  preflightWeightedDrop,
  rewardItemCandidates,
  selectPreflightedWeightedDrop,
  type PreflightedWeightedDrop,
  type SourceDropRow,
  type SourceItemGroupRow,
} from "./drops";
import {
  OracleRequiredError,
  createCanonicalStoredAsset,
  creditInventory,
  debitInventory,
  resolveSourceItemDefinition,
  sourceAlchemyGold,
  sourceCubeExperience,
  sourceIntervalCandidates,
  type AlchemyBonuses,
  type CubeExperienceBonus,
  type CubeValueSource,
  type InventoryDebit,
  type RandomSource,
  type SourceItemRow,
  type SourceStatModRow,
} from "./items";
import type { GearAsset, SlotContainer } from "./player";
import { rollSynthesisGrade, type SynthesisGradeRule } from "./cube";

export interface CubeInventoryState {
  inventory: SlotContainer;
  gold: number;
  cubeExperience: number;
  cubeLevel: number;
}

export interface CraftingRecipeRow {
  CraftingRecipeKey: number;
  ItemCraftingType: string;
  RecipeTier: number;
  Material: string;
  MaterialIndex: number;
  DropKey: number;
}

export interface CubeSubRecipeRow {
  CubeSubRecipeKey: number;
  RECIPETYPE: string;
  RecipeTier: number | null;
  DefaultUnlockWhenMainRecipeOpen: boolean | null;
  UnlockCubeLevel: number;
  UnlockCost: number;
  Material: string | null;
  TriggerGoldCost: number | null;
  DropKey: number | null;
}

export interface GradeRow {
  GRADE: string;
  Lower2GradeWeight: number;
  Lower1GradeWeight: number;
  SameGradeWeight: number;
  Higher1GradeWeight: number;
  Higher2GradeWeight: number;
  ExtraSlotAmount_Decoration: number;
  ExtraSlotAmount_Engraving: number;
  ExtraSlotAmount_Inscription: number;
  BaseAlchemyGold: number;
  BaseCubeExp: number;
}

export interface CubeDomainSource extends CubeValueSource {
  grades: readonly GradeRow[];
}

export interface SynthesisRecipeRow {
  SynthesisRecipeKey: number;
  RecipeTier: number;
  MinMaterialTier: number;
  MinResultLevel: number;
  MaxResultLevel: number;
  ItemSynthesisType: string;
  GRADE: string;
  MaterialAmount: number;
  MinMaterialAverageLevel: number;
  LevelWeight1: number;
  LevelWeight2: number;
  LevelWeight3: number;
  LevelWeight4: number;
}

export interface SynthesisDropRow {
  SynthesisDropKey: number;
  ItemLevel: number;
  RecipeTier: number;
  ItemSynthesisType: string;
  GRADE: string;
  DropKey: number;
}

export interface MaterialRow {
  ItemKey: number;
  MATERIALTYPE: string;
  StatModGroupKey: number;
}

export interface StatModGroupRow {
  StatModGroupKey: number;
  GearGroup: string;
  StatModKey: number;
  MinTier: number;
  MaxTier: number;
}

export interface ExtractionCostRow {
  ExtractionKey: number;
  GearGroup: string;
  MATERIALTYPE: string;
  Tier: number;
  Cost: number;
}

export type EnchantmentOperation = "DECORATION" | "ENGRAVING" | "INSCRIPTION";

interface DropOperationInput {
  state: CubeInventoryState;
  drops: readonly SourceDropRow[];
  itemGroups: readonly SourceItemGroupRow[];
  source: CubeDomainSource;
  bonuses: CubeExperienceBonus;
  destinationIndex: number;
  outputGearInstanceId?: string;
  rng: RandomSource;
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function safeAdd(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${context} produced an unsafe integer`);
  }
  return result;
}

function safeMultiply(left: number, right: number, context: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${context} produced an unsafe integer`);
  }
  return result;
}

function debitQuantity(debit: InventoryDebit): number {
  return debit.kind === "stack" ? debit.quantity : 1;
}

function rowsForDrop(
  drops: readonly SourceDropRow[],
  dropKey: number,
): readonly SourceDropRow[] {
  const rows = drops.filter((row) => row.DropKey === dropKey);
  if (rows.length === 0) {
    throw new Error(`missing drop table ${dropKey}`);
  }
  return rows;
}

function preflightDeterministicItemDrop(
  rows: readonly SourceDropRow[],
  itemGroups: readonly SourceItemGroupRow[],
): {
  weighted: PreflightedWeightedDrop;
  itemKeys: readonly number[];
} {
  const weighted = preflightWeightedDrop(rows);
  const dropKey = rows[0]!.DropKey;
  const output: number[] = [];
  for (const row of weighted.rows) {
    const candidates = rewardItemCandidates(row, itemGroups);
    if (candidates.length !== 1) {
      throw new OracleRequiredError(
        `drop ${dropKey} item group ${row.RewardKey} has unresolved member selection`,
      );
    }
    output.push(candidates[0]!);
  }
  return { weighted, itemKeys: output };
}

function selectedDropItem(
  prepared: ReturnType<typeof preflightDeterministicItemDrop>,
  rng: RandomSource,
): number {
  const selected = selectPreflightedWeightedDrop(prepared.weighted, rng);
  const index = prepared.weighted.rows.indexOf(selected);
  const itemKey = prepared.itemKeys[index];
  if (itemKey === undefined) {
    throw new Error(
      `drop ${prepared.weighted.dropKey} selection was not preflighted`,
    );
  }
  return itemKey;
}

function rejectOwnProperty(
  input: object,
  property: string,
  context: string,
): void {
  if (Object.prototype.hasOwnProperty.call(input, property)) {
    throw new Error(`caller-supplied ${context} is forbidden`);
  }
}

function rejectCallerYields(materials: readonly InventoryDebit[]): void {
  for (const material of materials) {
    for (const property of [
      "goldPerItem",
      "cubeExperiencePerItem",
      "goldYield",
      "cubeExperienceYield",
    ]) {
      if (Object.prototype.hasOwnProperty.call(material, property)) {
        throw new Error("caller-supplied yield is forbidden");
      }
    }
  }
}

function stableGearIdCollision(
  inventory: SlotContainer,
  instanceId: string,
): void {
  if (
    inventory.slots.some(
      (slot) =>
        slot.asset.kind === "gear" && slot.asset.instanceId === instanceId,
    )
  ) {
    throw new Error(`duplicate gear instance ${instanceId}`);
  }
}

function canonicalOutputCredit(input: {
  state: CubeInventoryState;
  source: CubeValueSource;
  destinationIndex: number;
  outputGearInstanceId?: string;
  itemKey: number;
}): {
  index: number;
  asset: ReturnType<typeof createCanonicalStoredAsset>;
} {
  const definition = resolveSourceItemDefinition(input.source, input.itemKey);
  const gearInstanceId =
    definition.item.type === "GEAR" ? input.outputGearInstanceId : undefined;
  if (definition.item.type === "GEAR") {
    if (gearInstanceId !== undefined) {
      stableGearIdCollision(input.state.inventory, gearInstanceId);
    }
  } else if (input.outputGearInstanceId !== undefined) {
    throw new Error(
      `stack item ${input.itemKey} does not accept a gear instance ID`,
    );
  }
  return {
    index: input.destinationIndex,
    asset: createCanonicalStoredAsset({
      itemKey: input.itemKey,
      gearInstanceId,
      source: input.source,
    }),
  };
}

function preflightOutputCredits(input: {
  state: CubeInventoryState;
  debitedInventory: SlotContainer;
  source: CubeValueSource;
  destinationIndex: number;
  outputGearInstanceId?: string;
  itemKeys: readonly number[];
  validateItem: (item: SourceItemRow) => void;
}): ReadonlyMap<number, ReturnType<typeof canonicalOutputCredit>> {
  const output = new Map<number, ReturnType<typeof canonicalOutputCredit>>();
  for (const itemKey of input.itemKeys) {
    const definition = resolveSourceItemDefinition(input.source, itemKey);
    input.validateItem(definition.item);
    const credit = canonicalOutputCredit({
      state: input.state,
      source: input.source,
      destinationIndex: input.destinationIndex,
      outputGearInstanceId: input.outputGearInstanceId,
      itemKey,
    });
    creditInventory(input.debitedInventory, [credit]);
    output.set(itemKey, credit);
  }
  return output;
}

function consumedItemKeys(input: {
  inventory: SlotContainer;
  debits: readonly InventoryDebit[];
  source: CubeValueSource;
}): readonly { itemKey: number; quantity: number }[] {
  return input.debits.map((debit) => {
    if (debit.kind === "stack") {
      const definition = resolveSourceItemDefinition(
        input.source,
        debit.itemKey,
      );
      if (definition.item.type === "GEAR") {
        throw new Error(
          `stack debit ${debit.itemKey} resolves to authoritative gear`,
        );
      }
      return { itemKey: debit.itemKey, quantity: debit.quantity };
    }
    const stored = gearSlot(input.inventory, debit.instanceId);
    const definition = resolveSourceItemDefinition(
      input.source,
      stored.asset.itemKey,
    );
    if (definition.item.type !== "GEAR") {
      throw new Error(
        `gear debit ${debit.instanceId} resolves to authoritative ${definition.item.type}`,
      );
    }
    return { itemKey: stored.asset.itemKey, quantity: 1 };
  });
}

function consumedCubeExperience(input: {
  items: readonly { itemKey: number; quantity: number }[];
  state: CubeInventoryState;
  source: CubeValueSource;
  bonuses: CubeExperienceBonus;
  context: string;
}): number {
  let total = 0;
  for (const item of input.items) {
    requirePositiveSafeInteger(item.quantity, `${input.context} quantity`);
    const perItem = sourceCubeExperience({
      itemKey: item.itemKey,
      cubeLevel: input.state.cubeLevel,
      source: input.source,
      cubeExperienceBonus: input.bonuses.cubeExperience,
    });
    total = safeAdd(
      total,
      safeMultiply(perItem, item.quantity, `${input.context} Cube EXP`),
      `${input.context} Cube EXP`,
    );
  }
  safeAdd(
    input.state.cubeExperience,
    total,
    `${input.context} Cube EXP balance`,
  );
  return total;
}

function withCubeExperience(state: CubeInventoryState, earned: number): number {
  return safeAdd(state.cubeExperience, earned, "Cube EXP balance");
}

const CRAFTING_GEAR_TYPES: Readonly<Record<string, ReadonlySet<string>>> = {
  MainWeapon: new Set(["SWORD", "BOW", "STAFF", "SCEPTER", "CROSSBOW", "AXE"]),
  SubWeapon: new Set(["SHIELD", "ARROW", "ORB", "TOME", "BOLT", "HATCHET"]),
  Helmet: new Set(["HELMET"]),
  Armor: new Set(["ARMOR"]),
  Gloves: new Set(["GLOVES"]),
  Boots: new Set(["BOOTS"]),
  Accessory: new Set(["AMULET", "EARING", "RING", "BRACER"]),
};

function validateCraftingOutput(
  item: SourceItemRow,
  recipe: CraftingRecipeRow,
  source: CubeValueSource,
): void {
  const allowed = CRAFTING_GEAR_TYPES[recipe.ItemCraftingType];
  if (allowed === undefined) {
    throw new OracleRequiredError(
      `crafting category ${recipe.ItemCraftingType} requires an oracle`,
    );
  }
  if (item.type !== "GEAR" || item.gear === null || !allowed.has(item.gear)) {
    throw new Error(
      `crafting output ${item.id} does not match ${recipe.ItemCraftingType}`,
    );
  }
  if (item.level === null) {
    throw new Error(`crafting output ${item.id} is missing level`);
  }
  if (!source.grades.some((grade) => grade.GRADE === item.grade)) {
    throw new Error(
      `crafting output ${item.id} has unknown grade ${item.grade}`,
    );
  }
  if (!source.itemLevelScales.some((scale) => scale.Level === item.level)) {
    throw new Error(
      `crafting output ${item.id} has unknown level ${item.level}`,
    );
  }
}

function gearSlot(
  inventory: SlotContainer,
  instanceId: string,
): { position: number; index: number; asset: GearAsset } {
  const matches = inventory.slots.flatMap((slot, position) =>
    slot.asset.kind === "gear" && slot.asset.instanceId === instanceId
      ? [{ position, index: slot.index, asset: slot.asset }]
      : [],
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `missing gear instance ${instanceId}`
        : `duplicate gear instance ${instanceId}`,
    );
  }
  return matches[0]!;
}

function replaceGear(
  inventory: SlotContainer,
  position: number,
  index: number,
  asset: GearAsset,
): SlotContainer {
  return {
    unlockedSlots: inventory.unlockedSlots,
    slots: inventory.slots.map((slot, slotPosition) =>
      slotPosition === position ? { index, asset } : slot,
    ),
  };
}

export function parseMaterialRequirements(
  material: string,
): readonly Extract<InventoryDebit, { kind: "stack" }>[] {
  if (material.trim().length === 0) {
    throw new Error("material requirements must not be empty");
  }
  return material
    .trim()
    .split(/\s+/)
    .map((token) => {
      const match = /^([1-9]\d*)_([1-9]\d*)$/.exec(token);
      if (match === null) {
        throw new Error(`invalid material token ${token}`);
      }
      const itemKey = Number(match[1]);
      const quantity = Number(match[2]);
      requirePositiveSafeInteger(itemKey, `material ${token} item key`);
      requirePositiveSafeInteger(quantity, `material ${token} quantity`);
      return { kind: "stack" as const, itemKey, quantity };
    });
}

export function executeAlchemy(input: {
  state: CubeInventoryState;
  materials: readonly InventoryDebit[];
  source: CubeValueSource;
  bonuses: AlchemyBonuses;
}): CubeInventoryState {
  rejectCallerYields(input.materials);
  let itemCount = 0;
  let goldYield = 0;

  for (const material of input.materials) {
    const quantity = debitQuantity(material);
    requirePositiveSafeInteger(quantity, "Alchemy material quantity");
    itemCount = safeAdd(itemCount, quantity, "Alchemy item count");
  }
  if (itemCount < 1 || itemCount > 9) {
    throw new Error("Alchemy item count must be between 1 and 9");
  }

  const inventory = debitInventory(input.state.inventory, input.materials);
  const consumed = consumedItemKeys({
    inventory: input.state.inventory,
    debits: input.materials,
    source: input.source,
  });
  for (const item of consumed) {
    const perItem = sourceAlchemyGold({
      itemKey: item.itemKey,
      source: input.source,
      alchemyGoldBonus: input.bonuses.alchemyGold,
    });
    goldYield = safeAdd(
      goldYield,
      safeMultiply(perItem, item.quantity, "Alchemy gold yield"),
      "Alchemy gold yield",
    );
  }
  const cubeExperienceYield = consumedCubeExperience({
    items: consumed,
    state: input.state,
    source: input.source,
    bonuses: input.bonuses,
    context: "Alchemy",
  });
  const gold = safeAdd(input.state.gold, goldYield, "Alchemy gold balance");
  const cubeExperience = withCubeExperience(input.state, cubeExperienceYield);
  return { ...input.state, inventory, gold, cubeExperience };
}

export function executeCrafting(
  input: DropOperationInput & {
    recipe: CraftingRecipeRow;
  },
): CubeInventoryState {
  rejectOwnProperty(input, "output", "output");
  const requirements = parseMaterialRequirements(input.recipe.Material);
  const dropRows = rowsForDrop(input.drops, input.recipe.DropKey);
  const debited = debitInventory(input.state.inventory, requirements);
  const preparedDrop = preflightDeterministicItemDrop(
    dropRows,
    input.itemGroups,
  );
  const credits = preflightOutputCredits({
    state: input.state,
    debitedInventory: debited,
    source: input.source,
    destinationIndex: input.destinationIndex,
    outputGearInstanceId: input.outputGearInstanceId,
    itemKeys: preparedDrop.itemKeys,
    validateItem: (item) =>
      validateCraftingOutput(item, input.recipe, input.source),
  });
  const consumed = consumedItemKeys({
    inventory: input.state.inventory,
    debits: requirements,
    source: input.source,
  });
  const earned = consumedCubeExperience({
    items: consumed,
    state: input.state,
    source: input.source,
    bonuses: input.bonuses,
    context: "Crafting",
  });

  const itemKey = selectedDropItem(preparedDrop, input.rng);
  const credit = credits.get(itemKey);
  if (credit === undefined) {
    throw new Error(`selected crafting item ${itemKey} was not preflighted`);
  }
  const inventory = creditInventory(debited, [credit]);
  return {
    ...input.state,
    inventory,
    cubeExperience: withCubeExperience(input.state, earned),
  };
}

function gradeRules(
  grades: readonly GradeRow[],
): readonly SynthesisGradeRule[] {
  return grades.map((grade) => ({
    grade: grade.GRADE,
    lower2Weight: grade.Lower2GradeWeight,
    lower1Weight: grade.Lower1GradeWeight,
    sameWeight: grade.SameGradeWeight,
    higher1Weight: grade.Higher1GradeWeight,
    higher2Weight: grade.Higher2GradeWeight,
  }));
}

function possibleSynthesisGrades(
  grades: readonly GradeRow[],
  inputGrade: string,
): readonly string[] {
  const index = grades.findIndex((grade) => grade.GRADE === inputGrade);
  if (index < 0) throw new Error(`unknown synthesis grade ${inputGrade}`);
  const row = grades[index]!;
  const weights = [
    row.Lower2GradeWeight,
    row.Lower1GradeWeight,
    row.SameGradeWeight,
    row.Higher1GradeWeight,
    row.Higher2GradeWeight,
  ] as const;
  const offsets = [-2, -1, 0, 1, 2] as const;
  const output: string[] = [];
  let totalWeight = 0;
  for (const [weightIndex, weight] of weights.entries()) {
    requireNonNegativeSafeInteger(
      weight,
      `synthesis grade ${inputGrade} weight ${weightIndex}`,
    );
    totalWeight = safeAdd(
      totalWeight,
      weight,
      `synthesis grade ${inputGrade} total weight`,
    );
    if (weight === 0) continue;
    const outputGrade = grades[index + offsets[weightIndex]!];
    if (outputGrade === undefined) {
      throw new Error(
        `synthesis grade ${inputGrade} has weight for missing output grade`,
      );
    }
    output.push(outputGrade.GRADE);
  }
  if (output.length === 0) {
    throw new Error(`grade ${inputGrade} cannot be synthesized`);
  }
  return output;
}

function synthesisDropRow(
  rows: readonly SynthesisDropRow[],
  recipe: SynthesisRecipeRow,
  itemLevel: number,
  outputGrade: string,
): SynthesisDropRow {
  const matches = rows.filter(
    (row) =>
      row.ItemLevel === itemLevel &&
      row.RecipeTier === recipe.RecipeTier &&
      row.ItemSynthesisType === recipe.ItemSynthesisType &&
      row.GRADE === outputGrade,
  );
  if (matches.length !== 1) {
    if (matches.length === 0) {
      throw new OracleRequiredError(
        `synthesis output path ${recipe.RecipeTier} ${recipe.ItemSynthesisType} level ${itemLevel} ${outputGrade} is absent from source`,
      );
    }
    throw new Error(
      `expected one synthesis drop for tier ${recipe.RecipeTier} ${recipe.ItemSynthesisType} level ${itemLevel} ${outputGrade}; found ${matches.length}`,
    );
  }
  return matches[0]!;
}

function materialMatchesSynthesisType(
  item: SourceItemRow,
  synthesisType: string,
): boolean {
  if (synthesisType === "Material") return item.type === "MATERIAL";
  if (item.type !== "GEAR" || item.gear === null) return false;
  const accessories = new Set(["AMULET", "EARING", "RING", "BRACER"]);
  return synthesisType === "Accessory"
    ? accessories.has(item.gear)
    : synthesisType === "Gear" && !accessories.has(item.gear);
}

function validateSynthesisOutput(
  item: SourceItemRow,
  recipe: SynthesisRecipeRow,
  outputGrade: string,
): void {
  if (!materialMatchesSynthesisType(item, recipe.ItemSynthesisType)) {
    throw new Error(
      `synthesis output ${item.id} does not match ${recipe.ItemSynthesisType}`,
    );
  }
  if (item.grade !== outputGrade) {
    throw new Error(
      `synthesis output ${item.id} grade ${item.grade} does not match ${outputGrade}`,
    );
  }
  if (item.level !== recipe.MinResultLevel) {
    throw new Error(
      `synthesis output ${item.id} level ${item.level} does not match ${recipe.MinResultLevel}`,
    );
  }
}

function validateSynthesisMaterials(
  inventory: SlotContainer,
  recipe: SynthesisRecipeRow,
  materialDebits: readonly InventoryDebit[],
  source: CubeValueSource,
): readonly { itemKey: number; quantity: number }[] {
  let count = 0;
  let levelTotal = 0;
  for (const debit of materialDebits) {
    const quantity = debitQuantity(debit);
    requirePositiveSafeInteger(quantity, "synthesis material quantity");
    count = safeAdd(count, quantity, "synthesis material count");
  }
  if (count !== recipe.MaterialAmount) {
    throw new Error(
      `synthesis requires ${recipe.MaterialAmount} items; received ${count}`,
    );
  }
  for (const debit of materialDebits) {
    if (debit.kind !== "gear") continue;
    const matches = inventory.slots.filter(
      (slot) =>
        slot.asset.kind === "gear" &&
        slot.asset.instanceId === debit.instanceId,
    );
    if (matches.length === 0) {
      throw new Error(
        `synthesis requires ${recipe.MaterialAmount} items; missing gear instance ${debit.instanceId}`,
      );
    }
    if (matches.length > 1) {
      throw new Error(`duplicate gear instance ${debit.instanceId}`);
    }
  }

  const consumed = consumedItemKeys({
    inventory,
    debits: materialDebits,
    source,
  });
  for (const { itemKey, quantity } of consumed) {
    const item = resolveSourceItemDefinition(source, itemKey).item;
    if (item.grade !== recipe.GRADE) {
      throw new Error(
        `synthesis material ${item.id} grade ${item.grade} does not match ${recipe.GRADE}`,
      );
    }
    if (!materialMatchesSynthesisType(item, recipe.ItemSynthesisType)) {
      throw new Error(
        `synthesis material ${item.id} does not match ${recipe.ItemSynthesisType}`,
      );
    }
    const level = item.level ?? 0;
    requireNonNegativeSafeInteger(level, `synthesis item ${item.id} level`);
    levelTotal = safeAdd(
      levelTotal,
      safeMultiply(level, quantity, "synthesis material level"),
      "synthesis material level total",
    );
  }
  if (levelTotal / count < recipe.MinMaterialAverageLevel) {
    throw new Error(
      `synthesis material average level is below ${recipe.MinMaterialAverageLevel}`,
    );
  }
  return consumed;
}

export function executeSynthesis(
  input: DropOperationInput & {
    recipe: SynthesisRecipeRow;
    materials: readonly InventoryDebit[];
    synthesisDrops: readonly SynthesisDropRow[];
  },
): CubeInventoryState {
  rejectOwnProperty(input, "output", "output");
  if (input.recipe.MinResultLevel !== input.recipe.MaxResultLevel) {
    throw new OracleRequiredError(
      `synthesis recipe ${input.recipe.SynthesisRecipeKey} has unresolved result-level range ${input.recipe.MinResultLevel}-${input.recipe.MaxResultLevel}`,
    );
  }
  requireNonNegativeSafeInteger(
    input.recipe.MinResultLevel,
    "synthesis result level",
  );
  const itemLevel = input.recipe.MinResultLevel;
  if (
    !input.source.items.some(
      (item) =>
        item.grade === input.recipe.GRADE &&
        materialMatchesSynthesisType(item, input.recipe.ItemSynthesisType),
    )
  ) {
    throw new Error(
      `synthesis recipe ${input.recipe.SynthesisRecipeKey} has no source material candidates`,
    );
  }
  const outputGrades = possibleSynthesisGrades(
    input.source.grades,
    input.recipe.GRADE,
  );

  const outputCredits = new Map<
    string,
    ReadonlyMap<number, ReturnType<typeof canonicalOutputCredit>>
  >();
  const preparedDrops = new Map<
    string,
    ReturnType<typeof preflightDeterministicItemDrop>
  >();
  for (const outputGrade of outputGrades) {
    const synthesisDrop = synthesisDropRow(
      input.synthesisDrops,
      input.recipe,
      itemLevel,
      outputGrade,
    );
    const dropRows = rowsForDrop(input.drops, synthesisDrop.DropKey);
    const preparedDrop = preflightDeterministicItemDrop(
      dropRows,
      input.itemGroups,
    );
    preparedDrops.set(outputGrade, preparedDrop);
    for (const itemKey of preparedDrop.itemKeys) {
      validateSynthesisOutput(
        resolveSourceItemDefinition(input.source, itemKey).item,
        input.recipe,
        outputGrade,
      );
    }
  }

  const consumed = validateSynthesisMaterials(
    input.state.inventory,
    input.recipe,
    input.materials,
    input.source,
  );
  const debited = debitInventory(input.state.inventory, input.materials);
  for (const outputGrade of outputGrades) {
    const preparedDrop = preparedDrops.get(outputGrade);
    if (preparedDrop === undefined) {
      throw new Error(`synthesis grade ${outputGrade} was not preflighted`);
    }
    outputCredits.set(
      outputGrade,
      preflightOutputCredits({
        state: input.state,
        debitedInventory: debited,
        source: input.source,
        destinationIndex: input.destinationIndex,
        outputGearInstanceId: input.outputGearInstanceId,
        itemKeys: preparedDrop.itemKeys,
        validateItem: (item) =>
          validateSynthesisOutput(item, input.recipe, outputGrade),
      }),
    );
  }
  const earned = consumedCubeExperience({
    items: consumed,
    state: input.state,
    source: input.source,
    bonuses: input.bonuses,
    context: "Synthesis",
  });

  const outputGrade = rollSynthesisGrade(
    gradeRules(input.source.grades),
    input.recipe.GRADE,
    input.rng,
  );
  const preparedDrop = preparedDrops.get(outputGrade);
  if (preparedDrop === undefined) {
    throw new Error(
      `selected synthesis grade ${outputGrade} was not preflighted`,
    );
  }
  const itemKey = selectedDropItem(preparedDrop, input.rng);
  const credit = outputCredits.get(outputGrade)?.get(itemKey);
  if (credit === undefined) {
    throw new Error(
      `selected synthesis output ${outputGrade}/${itemKey} was not preflighted`,
    );
  }
  const inventory = creditInventory(debited, [credit]);
  return {
    ...input.state,
    inventory,
    cubeExperience: withCubeExperience(input.state, earned),
  };
}

export function executeEnchantment(input: {
  state: CubeInventoryState;
  operation: EnchantmentOperation;
  gearInstanceId: string;
  gearGroup: string;
  gearTier: number;
  occupiedSlotCount: number;
  availableSlotCount: number;
  materialItemKey: number;
  materials: readonly MaterialRow[];
  statModGroups: readonly StatModGroupRow[];
  statMods: readonly SourceStatModRow[];
  rng: RandomSource;
}): CubeInventoryState {
  requireNonNegativeSafeInteger(
    input.occupiedSlotCount,
    "occupied enchantment slots",
  );
  requireNonNegativeSafeInteger(
    input.availableSlotCount,
    "available enchantment slots",
  );
  if (input.occupiedSlotCount >= input.availableSlotCount) {
    throw new Error(`${input.operation} has no available slot`);
  }
  requirePositiveSafeInteger(input.gearTier, "gear tier");

  const materialMatches = input.materials.filter(
    (material) => material.ItemKey === input.materialItemKey,
  );
  if (materialMatches.length !== 1) {
    throw new Error(
      `expected one material row for ${input.materialItemKey}; found ${materialMatches.length}`,
    );
  }
  const material = materialMatches[0]!;
  if (material.MATERIALTYPE !== input.operation) {
    throw new Error(
      `material ${input.materialItemKey} is ${material.MATERIALTYPE}, not ${input.operation}`,
    );
  }

  const groupMatches = input.statModGroups.filter(
    (group) =>
      group.StatModGroupKey === material.StatModGroupKey &&
      group.GearGroup === input.gearGroup &&
      input.gearTier >= group.MinTier &&
      input.gearTier <= group.MaxTier,
  );
  if (groupMatches.length === 0) {
    throw new Error(
      `material ${input.materialItemKey} has no ${input.gearGroup} tier ${input.gearTier} stat`,
    );
  }
  if (groupMatches.length !== 1) {
    throw new OracleRequiredError(
      `${input.operation} material ${input.materialItemKey} has multiple eligible stat mods`,
    );
  }
  const group = groupMatches[0]!;
  const statMatches = input.statMods.filter(
    (stat) =>
      stat.StatModKey === group.StatModKey && stat.Tier === input.gearTier,
  );
  if (statMatches.length !== 1) {
    throw new Error(
      `expected one stat row ${group.StatModKey} tier ${input.gearTier}; found ${statMatches.length}`,
    );
  }
  const stat = statMatches[0]!;
  const values = sourceIntervalCandidates(stat);
  if (values.length !== 1) {
    throw new OracleRequiredError(
      `${input.operation} stat ${stat.StatModKey} has unresolved random value`,
    );
  }

  const storedGear = gearSlot(input.state.inventory, input.gearInstanceId);
  const debited = debitInventory(input.state.inventory, [
    { kind: "stack", itemKey: input.materialItemKey, quantity: 1 },
  ]);
  const updatedGear = gearSlot(debited, input.gearInstanceId);
  const asset: GearAsset = {
    ...storedGear.asset,
    rolledStats: [
      ...storedGear.asset.rolledStats,
      { statModKey: stat.StatModKey, value: values[0]! },
    ],
  };
  const inventory = replaceGear(
    debited,
    updatedGear.position,
    updatedGear.index,
    asset,
  );
  return { ...input.state, inventory };
}

export function executeOffering(
  input: DropOperationInput & {
    recipe: CubeSubRecipeRow;
  },
): CubeInventoryState {
  rejectOwnProperty(input, "output", "output");
  if (
    input.recipe.RECIPETYPE !== "OFFERING" ||
    input.recipe.Material === null ||
    input.recipe.TriggerGoldCost === null ||
    input.recipe.DropKey === null
  ) {
    throw new Error(
      `Cube sub-recipe ${input.recipe.CubeSubRecipeKey} is not a complete Offering`,
    );
  }
  requireNonNegativeSafeInteger(
    input.recipe.TriggerGoldCost,
    "Offering gold cost",
  );
  const requirements = parseMaterialRequirements(input.recipe.Material);
  const dropRows = rowsForDrop(input.drops, input.recipe.DropKey);
  if (input.state.gold < input.recipe.TriggerGoldCost) {
    throw new Error("insufficient gold for Offering");
  }

  const debited = debitInventory(input.state.inventory, requirements);
  const preparedDrop = preflightDeterministicItemDrop(
    dropRows,
    input.itemGroups,
  );
  const credits = preflightOutputCredits({
    state: input.state,
    debitedInventory: debited,
    source: input.source,
    destinationIndex: input.destinationIndex,
    outputGearInstanceId: input.outputGearInstanceId,
    itemKeys: preparedDrop.itemKeys,
    validateItem: () => {},
  });
  const consumed = consumedItemKeys({
    inventory: input.state.inventory,
    debits: requirements,
    source: input.source,
  });
  const earned = consumedCubeExperience({
    items: consumed,
    state: input.state,
    source: input.source,
    bonuses: input.bonuses,
    context: "Offering",
  });

  const itemKey = selectedDropItem(preparedDrop, input.rng);
  const credit = credits.get(itemKey);
  if (credit === undefined) {
    throw new Error(`selected Offering item ${itemKey} was not preflighted`);
  }
  const inventory = creditInventory(debited, [credit]);
  return {
    ...input.state,
    inventory,
    gold: input.state.gold - input.recipe.TriggerGoldCost,
    cubeExperience: withCubeExperience(input.state, earned),
  };
}

export function executeExtraction(input: {
  state: CubeInventoryState;
  gearInstanceId: string;
  rolledStatIndex: number;
}): CubeInventoryState {
  requireNonNegativeSafeInteger(input.rolledStatIndex, "rolled stat index");
  const stored = gearSlot(input.state.inventory, input.gearInstanceId);
  if (stored.asset.rolledStats[input.rolledStatIndex] === undefined) {
    throw new Error(
      `rolled stat index ${input.rolledStatIndex} is outside gear stat count ${stored.asset.rolledStats.length}`,
    );
  }
  throw new OracleRequiredError(
    "source-backed applied-stat material type and tier provenance is required for Extraction",
  );
}
