import type { RandomSource } from "./stats";

/** Runtime-frozen authority list — callers cannot push/splice new types into validation. */
export const DAMAGE_TYPES = Object.freeze([
  "Physical",
  "Fire",
  "Cold",
  "Lightning",
  "Chaos",
] as const);

export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Module-private membership set, built once from the frozen export at load. */
const DAMAGE_TYPE_SET: ReadonlySet<string> = new Set(DAMAGE_TYPES);

/** Inclusive upper bound for combat per-thousand chance/reduction inputs (100%). */
export const COMBAT_PER_THOUSAND_MAX = 1000;

export interface ArmorInput {
  armor: number;
  damage: number;
  stageLevel: number;
}

/**
 * Canonical combat-unit mitigation input (not a universal raw-source dump).
 *
 * Combat per-thousand (`*PerThousand`, 0…1000 inclusive):
 * - Gear catalog values are already combat units: gear Dodge 30 → 30‰ (3%),
 *   gear DamageReduction 200 → 200‰ (20%).
 * - Passive-style percent *points* are NOT accepted here. A passive "Dodge 30"
 *   (30pp) or "DR 20" (20pp) must be converted by a future source adapter to
 *   300‰ / 200‰ before calling `mitigateHit`. Passing 30 as dodgePerThousand
 *   means 3%, never 30%.
 *
 * Other units:
 * - Resistance fields are percentage points (60 → 60%). `resistancePercent`
 *   and the explicit per-type `maxResistancePercent` apply to
 *   Fire/Cold/Lightning/Chaos. `allElementalResistancePercent` is required for
 *   Fire/Cold/Lightning and rejected for Chaos; Physical ignores resistance
 *   fields because resistance does not participate in its pipeline.
 * - Negative effective resistance is legal. Effective resistance at or above
 *   100% is oracle-gated; no numeric cap or default maximum is invented here.
 * - `damageAbsorptionFlat` is flat damage (gear absorption 32 → 32).
 * - `damage` / `armor` remain raw magnitudes.
 *
 * Converted to roll fractions exactly once inside `mitigateHit` (`/1000`).
 * Values above 1000 are rejected — >100% behavior is unproven.
 *
 * `mitigateHit` snapshots every scalar and the rng reference during preflight,
 * and proves every deterministic post-block branch (blocked and unblocked)
 * through resistance → armor → DR → absorption **before** any RNG call.
 * After validation, the pipeline never re-reads live `input.*` fields.
 */
export interface MitigationInput extends ArmorInput {
  damageType: DamageType | (string & {});
  resistancePercent?: number;
  allElementalResistancePercent?: number;
  maxResistancePercent?: number;
  dodgePerThousand: number;
  maxDodgePerThousand: number;
  elementalDodgePerThousand: number;
  maxElementalDodgePerThousand: number;
  blockPerThousand: number;
  maxBlockPerThousand: number;
  elementalBlockPerThousand: number;
  maxElementalBlockPerThousand: number;
  damageReductionPerThousand: number;
  damageAbsorptionFlat: number;
  rng: RandomSource;
}

export interface MitigationAvoidance {
  readonly genericDodgePerThousand: number;
  readonly maxGenericDodgePerThousand: number;
  readonly elementalDodgePerThousand: number;
  readonly maxElementalDodgePerThousand: number;
  readonly genericBlockPerThousand: number;
  readonly maxGenericBlockPerThousand: number;
  readonly elementalBlockPerThousand: number;
  readonly maxElementalBlockPerThousand: number;
}

export interface MitigationTrace {
  readonly dodged: boolean;
  readonly blocked: boolean;
  readonly avoidance: MitigationAvoidance;
  readonly afterBlock: number;
  readonly effectiveResistancePercent: number | null;
  readonly afterResistance: number;
  readonly armorReduction: number;
  readonly afterArmor: number;
  readonly afterReduction: number;
  readonly afterAbsorption: number;
  readonly damageTaken: number;
}

export class OracleRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OracleRequiredError";
  }
}

/** Immutable preflight snapshot — all scalars captured once before any RNG. */
interface MitigationSnapshot {
  readonly damageType: DamageType;
  readonly damage: number;
  readonly armor: number;
  readonly stageLevel: number;
  readonly dodge: {
    readonly effectivePerThousand: number;
    readonly maximum: number;
  };
  readonly elementalDodge: {
    readonly effectivePerThousand: number;
    readonly maximum: number;
  };
  readonly block: {
    readonly effectivePerThousand: number;
    readonly maximum: number;
  };
  readonly elementalBlock: {
    readonly effectivePerThousand: number;
    readonly maximum: number;
  };
  readonly damageReductionPerThousand: number;
  readonly damageAbsorptionFlat: number;
  readonly resistance: {
    readonly effective: number;
  } | null;
  readonly rng: RandomSource;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) continue;
    deepFreeze(descriptor.value);
  }
  return value;
}

function requireFinite(value: number, context: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
}

function requireNonNegative(value: number, context: string): void {
  requireFinite(value, context);
  if (value < 0) {
    throw new Error(`${context} must be non-negative`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, context: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireCombatPerThousand(value: number, context: string): void {
  requireNonNegativeSafeInteger(value, context);
  if (value > COMBAT_PER_THOUSAND_MAX) {
    throw new Error(
      `${context} must be at most ${COMBAT_PER_THOUSAND_MAX} (100%); values above 100% are unproven`,
    );
  }
}

function finiteResult(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} produced a non-finite result`);
  }
  return value;
}

function requirePerThousandPair(
  raw: number,
  maximum: number,
  context: string,
): { readonly effectivePerThousand: number; readonly maximum: number } {
  requireCombatPerThousand(raw, `${context} per-thousand`);
  requireCombatPerThousand(maximum, `max ${context} per-thousand`);
  return {
    effectivePerThousand: Math.min(raw, maximum),
    maximum,
  };
}

function perThousandToChance(perThousand: number): number {
  return perThousand / COMBAT_PER_THOUSAND_MAX;
}

function rollChance(
  chance: number,
  rng: RandomSource,
  context: string,
): boolean {
  if (chance <= 0) return false;
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(`${context} RNG must return a value in [0, 1)`);
  }
  return roll < chance;
}

function isDamageType(value: unknown): value is DamageType {
  return typeof value === "string" && DAMAGE_TYPE_SET.has(value);
}

function requireArmorStageThreshold(stageLevel: number): number {
  requirePositiveSafeInteger(stageLevel, "stage level");
  const stageThreshold = 14 * stageLevel + 12;
  if (!Number.isSafeInteger(stageThreshold)) {
    throw new Error("armor stage threshold exceeds the safe-integer range");
  }
  return stageThreshold;
}

/**
 * Pure armor math over already-snapshotted scalars (no input re-reads).
 * Callers must have validated non-negative armor/damage and stage threshold.
 */
function armorReductionFromScalars(
  armor: number,
  damage: number,
  stageLevel: number,
): number {
  if (armor === 0) return 0;
  const stageThreshold = 14 * stageLevel + 12;
  const stageToArmor = stageThreshold / armor;
  const damageToArmor = damage / armor;
  const denominatorTerm = stageToArmor * (1 + 0.4 * damageToArmor);
  if (denominatorTerm === Number.POSITIVE_INFINITY) return 0;
  const recoveredReduction = finiteResult(
    1 / (1 + denominatorTerm),
    "armor reduction",
  );
  return finiteResult(
    Math.min(0.75, recoveredReduction),
    "capped armor reduction",
  );
}

/**
 * Exported armor helper: each expected field is read exactly once into locals;
 * subsequent math uses only those snapshots (poison getters cannot retarget).
 */
export function armorReduction(input: ArmorInput): number {
  const armor = input.armor;
  const damage = input.damage;
  const stageLevel = input.stageLevel;
  requireNonNegative(armor, "armor");
  requireNonNegative(damage, "damage");
  requireArmorStageThreshold(stageLevel);
  return armorReductionFromScalars(armor, damage, stageLevel);
}

/**
 * Prove one post-block pipeline (resistance → armor → DR → absorption) stays
 * finite. Used for both blocked and unblocked afterBlock values before RNG.
 */
function provePostBlockPipeline(input: {
  readonly afterBlock: number;
  readonly damageType: DamageType;
  readonly armor: number;
  readonly stageLevel: number;
  readonly damageReduction: number;
  readonly damageAbsorptionFlat: number;
  readonly resistance: MitigationSnapshot["resistance"];
}): void {
  const afterBlock = finiteResult(input.afterBlock, "damage after block");
  let afterResistance = afterBlock;
  if (input.resistance !== null) {
    afterResistance = finiteResult(
      afterBlock * (1 - input.resistance.effective / 100),
      "damage after resistance",
    );
  }
  const physicalArmorReduction =
    input.damageType === "Physical"
      ? armorReductionFromScalars(
          input.armor,
          afterResistance,
          input.stageLevel,
        )
      : 0;
  const afterArmor = finiteResult(
    afterResistance * (1 - physicalArmorReduction),
    "damage after armor",
  );
  const afterReduction = finiteResult(
    afterArmor * (1 - input.damageReduction),
    "damage after reduction",
  );
  finiteResult(
    afterReduction - input.damageAbsorptionFlat,
    "damage after absorption",
  );
}

/**
 * Validate every field that can affect this hit, capture every scalar + rng
 * once, and precompute every deterministic post-block branch **before** any
 * RNG call. The returned snapshot is the only data `mitigateHit` may consume.
 */
function validateMitigationInput(input: MitigationInput): MitigationSnapshot {
  // Capture every consumed field once up front (no later re-read of input.*).
  const damageTypeRaw = input.damageType;
  const damage = input.damage;
  const armor = input.armor;
  const stageLevel = input.stageLevel;
  const dodgePerThousand = input.dodgePerThousand;
  const maxDodgePerThousand = input.maxDodgePerThousand;
  const elementalDodgePerThousand = input.elementalDodgePerThousand;
  const maxElementalDodgePerThousand = input.maxElementalDodgePerThousand;
  const blockPerThousand = input.blockPerThousand;
  const maxBlockPerThousand = input.maxBlockPerThousand;
  const elementalBlockPerThousand = input.elementalBlockPerThousand;
  const maxElementalBlockPerThousand = input.maxElementalBlockPerThousand;
  const damageReductionPerThousand = input.damageReductionPerThousand;
  const damageAbsorptionFlat = input.damageAbsorptionFlat;
  const rng = input.rng;

  if (!isDamageType(damageTypeRaw)) {
    throw new Error(
      `unknown damage type ${JSON.stringify(damageTypeRaw)}; expected one of ${DAMAGE_TYPES.join(", ")}`,
    );
  }
  const damageType: DamageType = damageTypeRaw;

  requireNonNegative(damage, "damage");
  requireNonNegative(armor, "armor");
  requirePositiveSafeInteger(stageLevel, "stage level");

  const dodge = requirePerThousandPair(
    dodgePerThousand,
    maxDodgePerThousand,
    "dodge",
  );
  const elementalDodge = requirePerThousandPair(
    elementalDodgePerThousand,
    maxElementalDodgePerThousand,
    "elemental dodge",
  );
  const block = requirePerThousandPair(
    blockPerThousand,
    maxBlockPerThousand,
    "block",
  );
  const elementalBlock = requirePerThousandPair(
    elementalBlockPerThousand,
    maxElementalBlockPerThousand,
    "elemental block",
  );
  requireCombatPerThousand(
    damageReductionPerThousand,
    "damage reduction per-thousand",
  );
  requireNonNegative(damageAbsorptionFlat, "damage absorption flat");

  // Physical hits always validate the armor stage threshold — including
  // armor === 0 — so acceptance cannot depend on whether dodge short-circuits
  // before the armor formula would run.
  if (damageType === "Physical") {
    requireArmorStageThreshold(stageLevel);
  }

  let resistance: MitigationSnapshot["resistance"] = null;
  if (damageType !== "Physical") {
    const resistancePercent = input.resistancePercent;
    const allElementalResistancePercent = input.allElementalResistancePercent;
    const maxResistancePercent = input.maxResistancePercent;
    if (resistancePercent === undefined || maxResistancePercent === undefined) {
      throw new Error(
        `${damageType} damage requires resistancePercent and maxResistancePercent`,
      );
    }
    requireFinite(resistancePercent, "per-type resistance percent");
    requireNonNegative(maxResistancePercent, "max resistance percent");
    let allElemental = 0;
    if (damageType === "Chaos") {
      if (allElementalResistancePercent !== undefined) {
        throw new Error(
          "Chaos damage does not accept all-elemental resistance",
        );
      }
    } else {
      if (allElementalResistancePercent === undefined) {
        throw new Error(
          `${damageType} damage requires allElementalResistancePercent`,
        );
      }
      requireFinite(
        allElementalResistancePercent,
        "all-elemental resistance percent",
      );
      allElemental = allElementalResistancePercent;
    }
    const combined = resistancePercent + allElemental;
    if (!Number.isFinite(combined)) {
      throw new Error("combined elemental resistance must be finite");
    }
    const effectiveResistance = Math.min(combined, maxResistancePercent);
    if (effectiveResistance >= 100) {
      throw new OracleRequiredError(
        "effective resistance at or above 100% requires an oracle",
      );
    }
    resistance = {
      effective: effectiveResistance,
    };
  }

  // Raw nonzero elemental dodge/block intent still needs an oracle even when
  // the max clamps the effective chance to 0 — do not infer roll ordering.
  if (
    damageType !== "Physical" &&
    (elementalDodgePerThousand > 0 || elementalBlockPerThousand > 0)
  ) {
    throw new OracleRequiredError(
      "elemental-specific dodge/block combination and roll order require an oracle",
    );
  }

  if (typeof rng !== "function") {
    throw new Error("rng must be a function");
  }

  // Prove BOTH blocked and unblocked post-block pipelines before any roll.
  // Dodge must not swallow non-finite DR/absorption intermediates.
  const damageReduction = perThousandToChance(damageReductionPerThousand);
  for (const afterBlock of [damage, damage * 0.5]) {
    provePostBlockPipeline({
      afterBlock,
      damageType,
      armor,
      stageLevel,
      damageReduction,
      damageAbsorptionFlat,
      resistance,
    });
  }

  return {
    damageType,
    damage,
    armor,
    stageLevel,
    dodge,
    elementalDodge,
    block,
    elementalBlock,
    damageReductionPerThousand,
    damageAbsorptionFlat,
    resistance,
    rng,
  };
}

export function mitigateHit(input: MitigationInput): MitigationTrace {
  // After this line the pipeline must not touch `input` again — only `snap`.
  const snap = validateMitigationInput(input);

  const dodgeChance = perThousandToChance(snap.dodge.effectivePerThousand);
  const blockChance = perThousandToChance(snap.block.effectivePerThousand);
  // Convert reduction once from combat per-thousand → fraction.
  const damageReduction = perThousandToChance(snap.damageReductionPerThousand);

  const avoidance: MitigationAvoidance = {
    genericDodgePerThousand: snap.dodge.effectivePerThousand,
    maxGenericDodgePerThousand: snap.dodge.maximum,
    elementalDodgePerThousand: snap.elementalDodge.effectivePerThousand,
    maxElementalDodgePerThousand: snap.elementalDodge.maximum,
    genericBlockPerThousand: snap.block.effectivePerThousand,
    maxGenericBlockPerThousand: snap.block.maximum,
    elementalBlockPerThousand: snap.elementalBlock.effectivePerThousand,
    maxElementalBlockPerThousand: snap.elementalBlock.maximum,
  };

  if (rollChance(dodgeChance, snap.rng, "dodge")) {
    return deepFreeze({
      dodged: true,
      blocked: false,
      avoidance,
      afterBlock: 0,
      effectiveResistancePercent: null,
      afterResistance: 0,
      armorReduction: 0,
      afterArmor: 0,
      afterReduction: 0,
      afterAbsorption: 0,
      damageTaken: 0,
    });
  }

  const blocked = rollChance(blockChance, snap.rng, "block");
  const afterBlock = finiteResult(
    blocked ? snap.damage * 0.5 : snap.damage,
    "damage after block",
  );

  let effectiveResistancePercent: number | null = null;
  let afterResistance = afterBlock;
  if (snap.resistance !== null) {
    effectiveResistancePercent = snap.resistance.effective;
    afterResistance = finiteResult(
      afterResistance * (1 - effectiveResistancePercent / 100),
      "damage after resistance",
    );
  }

  const physicalArmorReduction =
    snap.damageType === "Physical"
      ? armorReductionFromScalars(snap.armor, afterResistance, snap.stageLevel)
      : 0;
  const afterArmor = finiteResult(
    afterResistance * (1 - physicalArmorReduction),
    "damage after armor",
  );
  const afterReduction = finiteResult(
    afterArmor * (1 - damageReduction),
    "damage after reduction",
  );
  const afterAbsorption = finiteResult(
    afterReduction - snap.damageAbsorptionFlat,
    "damage after absorption",
  );
  const damageTaken = finiteResult(
    Math.max(1, afterAbsorption),
    "damage taken",
  );

  return deepFreeze({
    dodged: false,
    blocked,
    avoidance,
    afterBlock,
    effectiveResistancePercent,
    afterResistance,
    armorReduction: physicalArmorReduction,
    afterArmor,
    afterReduction,
    afterAbsorption,
    damageTaken,
  });
}
