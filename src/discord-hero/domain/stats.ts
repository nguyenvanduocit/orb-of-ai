export const MODIFIER_SOURCE_ORDER = [
  "Base",
  "Item",
  "Attribute",
  "Passive",
  "AccountStatus",
  "StatusEffect",
  "BuffSkill",
  "Environment",
] as const;

export type ModifierSource = (typeof MODIFIER_SOURCE_ORDER)[number];
export type ModifierLayer = "FLAT" | "ADDITIVE" | "MULTIPLICATIVE";

export interface StatModifier {
  source: ModifierSource;
  layer: ModifierLayer;
  value: number;
}

export type RandomSource = () => number;

function requireFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
}

function finiteResult(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} produced a non-finite result`);
  }
  return value;
}

function requireNonNegative(value: number, context: string): void {
  requireFinite(value, context);
  if (value < 0) {
    throw new Error(`${context} must be non-negative`);
  }
}

export function applyStatModifiers(
  base: number,
  modifiers: readonly StatModifier[],
): number {
  requireFinite(base, "base stat");

  const sourceSet = new Set<string>(MODIFIER_SOURCE_ORDER);
  for (const modifier of modifiers) {
    if (!sourceSet.has(modifier.source)) {
      throw new Error(`unsupported modifier source ${String(modifier.source)}`);
    }
    if (
      modifier.layer !== "FLAT" &&
      modifier.layer !== "ADDITIVE" &&
      modifier.layer !== "MULTIPLICATIVE"
    ) {
      throw new Error(`unsupported modifier layer ${String(modifier.layer)}`);
    }
    requireFinite(
      modifier.value,
      `modifier ${modifier.source}/${modifier.layer}`,
    );
  }

  let flat = 0;
  let additive = 0;
  let multiplicative = 1;

  for (const source of MODIFIER_SOURCE_ORDER) {
    for (const modifier of modifiers) {
      if (modifier.source !== source) continue;
      if (modifier.layer === "FLAT") {
        flat = finiteResult(flat + modifier.value, "flat stat accumulation");
      }
      if (modifier.layer === "ADDITIVE") {
        additive = finiteResult(
          additive + modifier.value,
          "additive stat accumulation",
        );
      }
      if (modifier.layer === "MULTIPLICATIVE") {
        const factor = finiteResult(
          1 + modifier.value,
          "multiplicative stat factor",
        );
        multiplicative = finiteResult(
          multiplicative * factor,
          "multiplicative stat accumulation",
        );
      }
    }
  }

  const baseWithFlat = finiteResult(base + flat, "base plus flat stat");
  const additiveFactor = finiteResult(
    1 + additive,
    "additive stat multiplier",
  );
  const afterAdditive = finiteResult(
    baseWithFlat * additiveFactor,
    "stat after additive modifiers",
  );
  return finiteResult(afterAdditive * multiplicative, "final modified stat");
}

export interface DpsInput {
  attackSpeed: number;
  attackDamage: number;
  criticalChance: number;
  criticalDamage: number;
  deliveryIncrease?: number;
}

export function effectiveDps(input: DpsInput): number {
  requireNonNegative(input.attackSpeed, "attack speed");
  requireNonNegative(input.attackDamage, "attack damage");
  requireNonNegative(input.criticalChance, "critical chance");
  requireNonNegative(input.criticalDamage, "critical damage");
  const deliveryIncrease = input.deliveryIncrease ?? 0;
  requireFinite(deliveryIncrease, "delivery increase");

  return finiteResult(
    input.attackSpeed *
      input.attackDamage *
      (1 + input.criticalChance * (input.criticalDamage - 1)) *
      (1 + deliveryIncrease),
    "DPS",
  );
}

export interface CriticalDamageResult {
  damage: number;
  critical: boolean;
  roll: number;
}

export function rollCriticalDamage(
  damage: number,
  criticalChance: number,
  criticalDamage: number,
  rng: RandomSource,
): CriticalDamageResult {
  requireNonNegative(damage, "damage");
  requireNonNegative(criticalChance, "critical chance");
  requireNonNegative(criticalDamage, "critical damage");

  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error("critical RNG must return a value in [0, 1)");
  }

  const critical = roll < criticalChance;
  return {
    damage: critical
      ? finiteResult(damage * criticalDamage, "critical damage")
      : damage,
    critical,
    roll,
  };
}
