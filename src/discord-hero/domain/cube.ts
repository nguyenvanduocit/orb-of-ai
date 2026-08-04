import type { RandomSource } from "./stats";

export const MAX_CUBE_LEVEL = 100;

export interface CubeLevelEntry {
  level: number;
  experienceForLevelUp: number;
}

export interface CubeLevelCurve {
  entries: readonly CubeLevelEntry[];
}

export interface CubeProgress {
  level: number;
  experience: number;
}

export interface CubeExpFactors {
  gradeBase: number;
  itemLevelScale: number;
  gearTypeScale: number;
  itemTypeScale: number;
  levelMatch: number;
  cubeExpBonus: number;
}

export interface AlchemyGoldFactors {
  gradeBase: number;
  itemLevelScale: number;
  gearTypeScale: number;
  itemTypeScale: number;
  alchemyGoldBonus: number;
}

export interface CubeOperationRequirement {
  recipeType: string;
  unlockCubeLevel: number;
  unlockCost: number;
  defaultUnlocked: boolean;
}

export interface CubeOperationState {
  accessible: boolean;
  eligibleToUnlock: boolean;
  unlockCost: number;
}

export interface SynthesisGradeRule {
  grade: string;
  lower2Weight: number;
  lower1Weight: number;
  sameWeight: number;
  higher1Weight: number;
  higher2Weight: number;
}

export interface CraftingDropRow {
  dropKey: string;
  dropType: string;
  rewardType: string;
  rewardKey: string;
  heroKeyCondition: string;
  weight: number;
}

export interface SynthesisLevelRule {
  min: number;
  max: number;
  weights: readonly [number, number, number, number];
}

function requireFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) throw new Error(`${context} must be finite`);
}

function requireSafeNonNegativeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function finiteResult(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} produced a non-finite result`);
  }
  return value;
}

function safeIntegerResult(value: number, context: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} produced an unsafe integer result`);
  }
  return value;
}

function requireRandom(rng: RandomSource, context: string): number {
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(`${context} RNG must return a value in [0, 1)`);
  }
  return roll;
}

export function createCubeLevelCurve(
  entries: readonly CubeLevelEntry[],
): CubeLevelCurve {
  if (entries.length !== MAX_CUBE_LEVEL) {
    throw new Error(
      `Cube level curve must contain exactly ${MAX_CUBE_LEVEL} rows`,
    );
  }
  const normalized = entries.map((entry, index) => {
    const expectedLevel = index + 1;
    if (entry.level !== expectedLevel) {
      throw new Error(
        `Cube level curve row ${index} has level ${entry.level}; expected ${expectedLevel}`,
      );
    }
    requireSafeNonNegativeInteger(
      entry.experienceForLevelUp,
      `Cube level ${entry.level} experience`,
    );
    return Object.freeze({ ...entry });
  });
  return Object.freeze({ entries: Object.freeze(normalized) });
}

export function advanceCubeLevel(
  curve: CubeLevelCurve,
  totalExperience: number,
): CubeProgress {
  requireSafeNonNegativeInteger(totalExperience, "Cube experience");
  let level = 1;
  let experience = totalExperience;

  while (level < MAX_CUBE_LEVEL) {
    const entry = curve.entries[level - 1];
    if (entry === undefined || entry.level !== level) {
      throw new Error(`Cube level curve is missing level ${level}`);
    }
    if (experience < entry.experienceForLevelUp) break;
    experience -= entry.experienceForLevelUp;
    level += 1;
  }
  return { level, experience };
}

export function cubeExperienceToReachLevel(
  curve: CubeLevelCurve,
  targetLevel: number,
): number {
  if (
    !Number.isSafeInteger(targetLevel) ||
    targetLevel < 1 ||
    targetLevel > MAX_CUBE_LEVEL
  ) {
    throw new Error(
      `target Cube level must be between 1 and ${MAX_CUBE_LEVEL}`,
    );
  }

  let total = 0;
  for (let level = 1; level < targetLevel; level += 1) {
    const entry = curve.entries[level - 1];
    if (entry === undefined || entry.level !== level) {
      throw new Error(`Cube level curve is missing level ${level}`);
    }
    total = safeIntegerResult(
      total + entry.experienceForLevelUp,
      `Cube experience threshold for level ${targetLevel}`,
    );
  }
  return total;
}

function scaledItemBase(
  gradeBase: number,
  itemLevelScale: number,
  gearTypeScale: number,
  itemTypeScale: number,
  context: string,
): number {
  requireSafeNonNegativeInteger(gradeBase, `${context} grade base`);
  requireSafeNonNegativeInteger(itemLevelScale, `${context} item-level scale`);
  requireSafeNonNegativeInteger(gearTypeScale, `${context} gear-type scale`);
  requireSafeNonNegativeInteger(itemTypeScale, `${context} item-type scale`);

  const exactBase =
    (BigInt(gradeBase) *
      BigInt(itemLevelScale) *
      BigInt(gearTypeScale) *
      BigInt(itemTypeScale)) /
    1_000_000_000n;
  if (exactBase > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${context} base produced an unsafe integer result`);
  }
  return Number(exactBase);
}

export function cubeExpForItem(input: CubeExpFactors): number {
  const base = scaledItemBase(
    input.gradeBase,
    input.itemLevelScale,
    input.gearTypeScale,
    input.itemTypeScale,
    "Cube EXP",
  );
  requireFinite(input.levelMatch, "Cube EXP level match");
  requireFinite(input.cubeExpBonus, "Cube EXP bonus");
  if (input.levelMatch < 0) {
    throw new Error("Cube EXP level match must be non-negative");
  }
  if (input.cubeExpBonus < -1_000) {
    throw new Error("Cube EXP bonus cannot reduce the multiplier below zero");
  }
  const afterLevelMatch = finiteResult(
    base * input.levelMatch,
    "Cube EXP after level match",
  );
  const result = Math.floor(
    finiteResult(
      afterLevelMatch * (1 + input.cubeExpBonus / 1_000),
      "Cube EXP",
    ),
  );
  return safeIntegerResult(result, "Cube EXP");
}

export function alchemyGoldForItem(input: AlchemyGoldFactors): number {
  const base = scaledItemBase(
    input.gradeBase,
    input.itemLevelScale,
    input.gearTypeScale,
    input.itemTypeScale,
    "Alchemy gold",
  );
  requireFinite(input.alchemyGoldBonus, "Alchemy gold bonus");
  if (input.alchemyGoldBonus < -1_000) {
    throw new Error("Alchemy gold bonus cannot reduce the multiplier below zero");
  }
  const result = Math.floor(
    finiteResult(
      base * (1 + input.alchemyGoldBonus / 1_000),
      "Alchemy gold",
    ),
  );
  return safeIntegerResult(result, "Alchemy gold");
}

export function cubeOperationState(
  requirement: CubeOperationRequirement,
  cubeLevel: number,
  purchased: boolean,
): CubeOperationState {
  if (!Number.isSafeInteger(cubeLevel) || cubeLevel < 1 || cubeLevel > 100) {
    throw new Error("Cube level must be a safe integer between 1 and 100");
  }
  if (
    !Number.isSafeInteger(requirement.unlockCubeLevel) ||
    requirement.unlockCubeLevel < 1
  ) {
    throw new Error(
      `${requirement.recipeType} unlock level must be a positive safe integer`,
    );
  }
  requireSafeNonNegativeInteger(
    requirement.unlockCost,
    `${requirement.recipeType} unlock cost`,
  );

  const accessible = requirement.defaultUnlocked || purchased;
  return {
    accessible,
    eligibleToUnlock:
      !accessible && cubeLevel >= requirement.unlockCubeLevel,
    unlockCost: requirement.unlockCost,
  };
}

function weightedIndex(
  weights: readonly number[],
  rng: RandomSource,
  context: string,
): number {
  let total = 0;
  for (const [index, weight] of weights.entries()) {
    requireSafeNonNegativeInteger(weight, `${context} weight ${index}`);
    total += weight;
    if (!Number.isSafeInteger(total)) {
      throw new Error(
        `${context} total weight exceeds the safe-integer range`,
      );
    }
  }
  if (total <= 0) throw new Error(`${context} has no positive weight`);

  const target = requireRandom(rng, context) * total;
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index]!;
    if (target < cumulative) return index;
  }
  throw new Error(`${context} weighted selection failed`);
}

export function rollSynthesisGrade(
  rules: readonly SynthesisGradeRule[],
  inputGrade: string,
  rng: RandomSource,
): string {
  const inputIndex = rules.findIndex((rule) => rule.grade === inputGrade);
  if (inputIndex < 0) throw new Error(`unknown synthesis grade ${inputGrade}`);
  const rule = rules[inputIndex]!;
  const weights = [
    rule.lower2Weight,
    rule.lower1Weight,
    rule.sameWeight,
    rule.higher1Weight,
    rule.higher2Weight,
  ] as const;
  if (weights.every((weight) => weight === 0)) {
    throw new Error(`grade ${inputGrade} cannot be synthesized`);
  }

  const offsets = [-2, -1, 0, 1, 2] as const;
  for (const [index, weight] of weights.entries()) {
    const outputIndex = inputIndex + offsets[index]!;
    if (weight > 0 && (outputIndex < 0 || outputIndex >= rules.length)) {
      throw new Error(
        `grade ${inputGrade} has weight for missing grade offset ${offsets[index]}`,
      );
    }
  }

  const selected = weightedIndex(weights, rng, `synthesis grade ${inputGrade}`);
  return rules[inputIndex + offsets[selected]!]!.grade;
}

export function selectCraftingDrop(
  rows: readonly CraftingDropRow[],
  dropKey: string,
  rng: RandomSource,
): CraftingDropRow {
  const matches = rows.filter((row) => row.dropKey === dropKey);
  if (matches.length === 0) {
    throw new Error(`crafting drop table has no rows for ${dropKey}`);
  }
  if (
    matches.some(
      (row) =>
        row.dropType !== "EachDropOneWeight" ||
        row.heroKeyCondition !== "",
    )
  ) {
    throw new Error(`Unsupported crafting drop ${dropKey} semantics`);
  }

  const index = weightedIndex(
    matches.map((row) => row.weight),
    rng,
    `crafting drop ${dropKey}`,
  );
  return { ...matches[index]! };
}

export function synthesisResultLevel(rule: SynthesisLevelRule): number {
  requireSafeNonNegativeInteger(rule.min, "synthesis minimum result level");
  requireSafeNonNegativeInteger(rule.max, "synthesis maximum result level");
  if (rule.min === rule.max) return rule.min;
  throw new Error(
    `Unsupported synthesis result-level semantics for range ${rule.min}-${rule.max}`,
  );
}
