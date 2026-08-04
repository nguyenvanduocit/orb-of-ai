import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import {
  projectDiscordHeroAttributeEffect,
  validateDiscordHeroAttributeOwnedHeroes,
} from "./attribute-effects";
import { OracleRequiredError } from "./combat";
import type { PlayerState } from "./player";
import { effectiveDps } from "./stats";

export interface HeroDefinition {
  readonly heroKey: number;
  readonly classType: string;
  readonly mainWeaponGearType: string;
  readonly subWeaponGearType: string;
  readonly baseSkillKey: number;
  readonly unlockCost: number;
  readonly isAvailable: boolean;
  readonly isFirstAvailable: boolean;
  readonly stats: Readonly<{
    attackDamage: number;
    attackSpeed: number;
    castSpeed: number;
    criticalChance: number;
    criticalDamage: number;
    maxHp: number;
    armor: number;
    cooldownReduction: number;
    movementSpeed: number;
  }>;
}

const HERO_RAW_STATS = [
  { statType: "Armor", field: "armor" },
  { statType: "AttackDamage", field: "attackDamage" },
  { statType: "AttackSpeed", field: "attackSpeed" },
  { statType: "CastSpeed", field: "castSpeed" },
  { statType: "CooldownReduction", field: "cooldownReduction" },
  { statType: "CriticalChance", field: "criticalChance" },
  { statType: "CriticalDamage", field: "criticalDamage" },
  { statType: "MaxHp", field: "maxHp" },
  { statType: "MovementSpeed", field: "movementSpeed" },
] as const;

export type DiscordHeroRawStatType =
  (typeof HERO_RAW_STATS)[number]["statType"];

export type DiscordHeroStatPreviewRow = Readonly<{
  statType: DiscordHeroRawStatType;
  baseRaw: number;
  flatAttributeRaw: number;
  additiveAttributeRaw: number;
  projectedRaw: number;
  provenance: readonly ["Base", "Attribute"];
}>;

export type DiscordHeroStatPreview = Readonly<{
  status: "owned" | "unowned";
  heroKey: number;
  label: "Base + allocated Attributes";
  units: "uncapped and unrounded raw source units";
  projectedStats: readonly DiscordHeroStatPreviewRow[] | null;
}>;

const CANONICAL_HERO_KEYS = [101, 201, 301, 401, 501, 601] as const;

/**
 * A source row is inert JSON, but nothing in the type system guarantees the
 * object handed to us is. Reading a field twice opens a time-of-check /
 * time-of-use window an accessor-backed row can drive: it can answer the
 * canonical HeroKey during validation and a forged one during projection.
 * Every field is therefore sampled exactly ONCE into this own-data snapshot,
 * and every later check, comparison and arithmetic reads only the snapshot.
 */
function snapshotHeroRow(row: unknown): HeroDefinition {
  if (typeof row !== "object" || row === null) {
    throw new Error("hero row must be an object");
  }
  const source = row as Record<string, unknown>;

  // --- one read per field, no exceptions ---
  const heroKey = source.HeroKey;
  const classType = source.ClassType;
  const mainWeaponGearType = source.MainWeaponGearType;
  const subWeaponGearType = source.SubWeaponGearType;
  const baseSkillKey = source.SkillKey;
  const unlockCost = source.UnlockCost;
  const isAvailable = source.IsAvailable;
  const isFirstAvailable = source.IsFirstAvailable;
  const stats = {
    attackDamage: source.AttackDamage,
    attackSpeed: source.AttackSpeed,
    castSpeed: source.CastSpeed,
    criticalChance: source.CriticalChance,
    criticalDamage: source.CriticalDamage,
    maxHp: source.MaxHp,
    armor: source.Armor,
    cooldownReduction: source.CooldownReduction,
    movementSpeed: source.MovementSpeed,
  };

  // --- every check below reads only the snapshot ---
  requirePositiveSafeInteger(heroKey, "hero key");
  requirePositiveSafeInteger(baseSkillKey, `hero ${heroKey} base skill key`);
  requireNonNegativeSafeInteger(unlockCost, `hero ${heroKey} unlock cost`);
  if (
    typeof isAvailable !== "boolean" ||
    typeof isFirstAvailable !== "boolean"
  ) {
    throw new Error(`hero ${heroKey} availability flags must be boolean`);
  }
  const validatedStats: Record<string, number> = {};
  for (const [name, value] of Object.entries(stats)) {
    requireNonNegativeSafeInteger(value, `hero ${heroKey} ${name}`);
    validatedStats[name] = value as number;
  }

  return Object.freeze({
    heroKey: heroKey as number,
    classType: requireNonEmptyString(classType, `hero ${heroKey} class type`),
    mainWeaponGearType: requireNonEmptyString(
      mainWeaponGearType,
      `hero ${heroKey} main weapon gear type`,
    ),
    subWeaponGearType: requireNonEmptyString(
      subWeaponGearType,
      `hero ${heroKey} sub weapon gear type`,
    ),
    baseSkillKey: baseSkillKey as number,
    unlockCost: unlockCost as number,
    isAvailable,
    isFirstAvailable,
    stats: Object.freeze(validatedStats as unknown as HeroDefinition["stats"]),
  });
}

export function createHeroRoster(
  indexes: DiscordHeroCatalogIndexes,
): readonly HeroDefinition[] {
  const rows = indexes.tables.heroes.rows;
  if (rows.length !== 6) {
    throw new Error(
      `hero roster must contain exactly 6 rows; received ${rows.length}`,
    );
  }

  const roster = rows.map((row) => snapshotHeroRow(row));

  // Canonical key/order comparison runs against the snapshots, so the keys
  // compared here are byte-identical to the keys emitted below.
  if (
    roster.some((hero, index) => hero.heroKey !== CANONICAL_HERO_KEYS[index])
  ) {
    throw new Error(
      "hero roster must use canonical HeroKey order 101,201,301,401,501,601",
    );
  }
  const seen = new Set<number>();
  for (const hero of roster) {
    if (seen.has(hero.heroKey)) {
      throw new Error(`duplicate hero key ${hero.heroKey}`);
    }
    seen.add(hero.heroKey);
    getCatalogRow(indexes, "skills", hero.baseSkillKey);
  }

  const starterCount = roster.filter((hero) => hero.isFirstAvailable).length;
  if (starterCount !== 3) {
    throw new Error(
      "hero roster must contain exactly 3 first-available heroes",
    );
  }
  return deepFreeze(roster);
}

export type DiscordHeroBaseCombatUnit = Readonly<{
  heroKey: number;
  classType: string;
  attackDamage: number;
  attackSpeedPerSecond: number;
  castSpeedMultiplier: number;
  criticalChanceRatio: number;
  criticalDamageMultiplier: number;
  baseAttackDps: number;
}>;

export function projectDiscordHeroBaseCombatUnits(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroBaseCombatUnit[] {
  const roster = createHeroRoster(indexes);
  for (const hero of roster) {
    requirePositiveSafeInteger(
      hero.stats.attackDamage,
      `Hero ${hero.heroKey} base AttackDamage`,
    );
    requirePositiveSafeInteger(
      hero.stats.attackSpeed,
      `Hero ${hero.heroKey} base AttackSpeed`,
    );
    requirePositiveSafeInteger(
      hero.stats.castSpeed,
      `Hero ${hero.heroKey} base CastSpeed`,
    );
    requirePositiveSafeInteger(
      hero.stats.criticalChance,
      `Hero ${hero.heroKey} base CriticalChance`,
    );
    requirePositiveSafeInteger(
      hero.stats.criticalDamage,
      `Hero ${hero.heroKey} base CriticalDamage`,
    );
  }

  return deepFreeze(
    roster.map((hero): DiscordHeroBaseCombatUnit => {
      const attackSpeedPerSecond = hero.stats.attackSpeed / 100;
      const castSpeedMultiplier = hero.stats.castSpeed / 100;
      const criticalChanceRatio = hero.stats.criticalChance / 1000;
      const criticalDamageMultiplier = hero.stats.criticalDamage / 1000;
      const baseAttackDps = effectiveDps({
        attackDamage: hero.stats.attackDamage,
        attackSpeed: attackSpeedPerSecond,
        criticalChance: criticalChanceRatio,
        criticalDamage: criticalDamageMultiplier,
      });
      if (
        !Number.isFinite(baseAttackDps) ||
        baseAttackDps < 0 ||
        baseAttackDps > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error(
          `Hero ${hero.heroKey} base attack DPS must be finite and within safe range`,
        );
      }

      return Object.freeze({
        heroKey: hero.heroKey,
        classType: hero.classType,
        attackDamage: hero.stats.attackDamage,
        attackSpeedPerSecond,
        castSpeedMultiplier,
        criticalChanceRatio,
        criticalDamageMultiplier,
        baseAttackDps,
      });
    }),
  );
}

export function roundDiscordHeroBaseAttackDpsForDisplay(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      "base attack DPS display value must be finite, non-negative, and within safe range",
    );
  }
  return Number(value.toFixed(2));
}

export function projectDiscordHeroStatPreview(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
): DiscordHeroStatPreview {
  requirePositiveSafeInteger(heroKey, "stat preview hero key");
  const roster = createHeroRoster(indexes);
  const definition = roster.find((hero) => hero.heroKey === heroKey);
  if (definition === undefined) {
    throw new Error(`stat preview references unknown Hero ${heroKey}`);
  }

  validateDiscordHeroAttributeOwnedHeroes(indexes, state);
  const allocatedEffectsByHero = new Map<
    number,
    ReturnType<typeof projectDiscordHeroAttributeEffect>[]
  >();
  for (const ownedHero of state.heroes) {
    if (!Number.isSafeInteger(ownedHero.level) || ownedHero.level < 1) {
      throw new Error(
        `Hero ${ownedHero.heroKey} level must be a positive safe integer`,
      );
    }
    const allocatedEffects: ReturnType<
      typeof projectDiscordHeroAttributeEffect
    >[] = [];
    for (const progress of ownedHero.attributes) {
      const projection = projectDiscordHeroAttributeEffect(
        indexes,
        state,
        ownedHero.heroKey,
        progress.key,
      );
      const effect = projection.effect;
      if (effect.kind === "active-skill") {
        if (effect.levelRow === null) {
          throw new Error(
            `Hero ${ownedHero.heroKey} Attribute ${progress.key} has no active source row for its allocated level`,
          );
        }
        if (
          !Number.isFinite(effect.levelRow.Value) ||
          effect.levelRow.Value < 0 ||
          effect.levelRow.Value > Number.MAX_SAFE_INTEGER
        ) {
          throw new Error(
            `Hero ${ownedHero.heroKey} Attribute ${progress.key} active source Value must be finite, non-negative, and within safe range`,
          );
        }
      } else {
        const rawTotal = effect.rawTotal;
        if (
          rawTotal === null ||
          !Number.isSafeInteger(rawTotal) ||
          rawTotal < 0
        ) {
          throw new Error(
            `Hero ${ownedHero.heroKey} Attribute ${effect.statType} raw total must be a non-negative safe integer`,
          );
        }
        if (
          !Number.isFinite(effect.rawValue) ||
          effect.rawValue < 0 ||
          effect.rawValue > Number.MAX_SAFE_INTEGER
        ) {
          throw new Error(
            `Hero ${ownedHero.heroKey} Attribute ${effect.statType} raw value must be finite, non-negative, and within safe range`,
          );
        }
        if (
          effect.additiveFactor !== null &&
          (!Number.isFinite(effect.additiveFactor) ||
            effect.additiveFactor < 0 ||
            effect.additiveFactor > Number.MAX_SAFE_INTEGER)
        ) {
          throw new Error(
            `Hero ${ownedHero.heroKey} Attribute ${effect.statType} additive factor must be finite, non-negative, and within safe range`,
          );
        }
      }
      allocatedEffects.push(projection);
    }
    allocatedEffectsByHero.set(ownedHero.heroKey, allocatedEffects);
  }

  const ownedHero = state.heroes.find(
    (candidate) => candidate.heroKey === heroKey,
  );
  if (ownedHero === undefined) {
    return Object.freeze({
      status: "unowned",
      heroKey,
      label: "Base + allocated Attributes",
      units: "uncapped and unrounded raw source units",
      projectedStats: null,
    });
  }

  const accumulated = new Map<
    DiscordHeroRawStatType,
    { flat: number; additive: number }
  >(HERO_RAW_STATS.map(({ statType }) => [statType, { flat: 0, additive: 0 }]));
  for (const projection of allocatedEffectsByHero.get(heroKey)!) {
    const effect = projection.effect;
    if (effect.kind !== "passive-stat") continue;
    const rawTotal = effect.rawTotal!;
    const statType = HERO_RAW_STATS.find(
      (stat) => stat.statType === effect.statType,
    )?.statType;
    if (statType === undefined) continue;
    const totals = accumulated.get(statType)!;
    if (effect.modifierType === "FLAT") {
      const flat = totals.flat + rawTotal;
      if (!Number.isSafeInteger(flat) || flat < 0) {
        throw new Error(
          `Hero ${heroKey} Attribute ${statType} flat accumulation must be a non-negative safe integer`,
        );
      }
      totals.flat = flat;
    } else {
      const additive = totals.additive + rawTotal;
      if (!Number.isSafeInteger(additive) || additive < 0) {
        throw new Error(
          `Hero ${heroKey} Attribute ${statType} additive accumulation must be a non-negative safe integer`,
        );
      }
      totals.additive = additive;
    }
  }

  const projectedStats = HERO_RAW_STATS.map(
    ({ statType, field }): DiscordHeroStatPreviewRow => {
      const baseRaw = definition.stats[field];
      const totals = accumulated.get(statType)!;
      const basePlusFlat = baseRaw + totals.flat;
      if (!Number.isSafeInteger(basePlusFlat) || basePlusFlat < 0) {
        throw new Error(
          `Hero ${heroKey} ${statType} base plus flat total must be a non-negative safe integer`,
        );
      }
      const additiveFactor = 1 + totals.additive / 1000;
      if (
        !Number.isFinite(additiveFactor) ||
        additiveFactor < 0 ||
        additiveFactor > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error(
          `Hero ${heroKey} ${statType} additive factor must be finite, non-negative, and within safe range`,
        );
      }
      const projectedRaw = basePlusFlat * additiveFactor;
      if (
        !Number.isFinite(projectedRaw) ||
        projectedRaw < 0 ||
        projectedRaw > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error(
          `Hero ${heroKey} ${statType} projected raw total must be finite, non-negative, and within safe range`,
        );
      }
      return Object.freeze({
        statType,
        baseRaw,
        flatAttributeRaw: totals.flat,
        additiveAttributeRaw: totals.additive,
        projectedRaw,
        provenance: Object.freeze(["Base", "Attribute"] as const),
      });
    },
  );

  return Object.freeze({
    status: "owned",
    heroKey,
    label: "Base + allocated Attributes",
    units: "uncapped and unrounded raw source units",
    projectedStats: Object.freeze(projectedStats),
  });
}

interface HeroSkillInput {
  readonly heroKey: number;
  readonly [key: string]: unknown;
}

export function heroSkillKeys(
  indexes: DiscordHeroCatalogIndexes,
  input: HeroSkillInput,
): Readonly<{ baseSkillKey: number; activeSkillKeys: readonly number[] }> {
  rejectUnknownFields(input, ["heroKey"], "hero skill input");
  requirePositiveSafeInteger(input.heroKey, "hero skill hero key");
  const hero = getCatalogRow(indexes, "heroes", input.heroKey);
  // One reading each: the key used to select attribute rows and the skill key
  // that is emitted must both be the values that were validated.
  const sourceHeroKey = hero.HeroKey;
  const baseSkillKey = hero.SkillKey;
  requirePositiveSafeInteger(sourceHeroKey, "hero key");
  requirePositiveSafeInteger(
    baseSkillKey,
    `hero ${sourceHeroKey} base skill key`,
  );
  getCatalogRow(indexes, "skills", baseSkillKey);
  const heroAttributes = indexes.tables.attributes.rows.filter(
    (attribute) => attribute.HeroKey === sourceHeroKey,
  );
  if (heroAttributes.length !== 22) {
    throw new Error(
      `hero ${sourceHeroKey} must have exactly 22 attribute rows; received ${heroAttributes.length}`,
    );
  }

  const seenAttributes = new Set<number>();
  const activeSkillKeys: number[] = [];
  for (const attribute of heroAttributes) {
    requirePositiveSafeInteger(
      attribute.AttributeKey,
      `hero ${sourceHeroKey} attribute key`,
    );
    if (seenAttributes.has(attribute.AttributeKey)) {
      throw new Error(
        `hero ${sourceHeroKey} has duplicate attribute key ${attribute.AttributeKey}`,
      );
    }
    seenAttributes.add(attribute.AttributeKey);
    if (
      attribute.ATTRIBUTETYPE !== "ACTIVESKILL" &&
      attribute.ATTRIBUTETYPE !== "PASSIVESKILL"
    ) {
      throw new Error(
        `hero ${sourceHeroKey} has unsupported attribute type ${attribute.ATTRIBUTETYPE}`,
      );
    }
    if (attribute.ATTRIBUTETYPE === "ACTIVESKILL") {
      requirePositiveSafeInteger(
        attribute.Value,
        `hero ${sourceHeroKey} active skill key`,
      );
      getCatalogRow(indexes, "skills", attribute.Value);
      activeSkillKeys.push(attribute.Value);
    }
  }
  if (activeSkillKeys.length !== 6) {
    throw new Error(
      `hero ${sourceHeroKey} must have exactly 6 active skills; received ${activeSkillKeys.length}`,
    );
  }

  return Object.freeze({
    baseSkillKey,
    activeSkillKeys: Object.freeze([...activeSkillKeys]),
  });
}

export type HeroUnlockQuote = Readonly<{
  status: "starter" | "owned" | "insufficient-gold" | "purchasable";
  heroKey: number;
  cost: number;
}>;

interface HeroUnlockInput {
  readonly heroKey: number;
  readonly gold: number;
  readonly ownedHeroKeys: readonly number[];
  readonly [key: string]: unknown;
}

export function quoteHeroUnlock(
  indexes: DiscordHeroCatalogIndexes,
  input: HeroUnlockInput,
): HeroUnlockQuote {
  rejectUnknownFields(
    input,
    ["heroKey", "gold", "ownedHeroKeys"],
    "hero unlock input",
  );
  requirePositiveSafeInteger(input.heroKey, "unlock hero key");
  requireNonNegativeSafeInteger(input.gold, "unlock gold");
  const owned = new Set<number>();
  for (const key of input.ownedHeroKeys) {
    requirePositiveSafeInteger(key, "owned hero key");
    if (owned.has(key)) throw new Error(`duplicate owned hero key ${key}`);
    getCatalogRow(indexes, "heroes", key);
    owned.add(key);
  }

  const hero = getCatalogRow(indexes, "heroes", input.heroKey);
  // One reading each: the cost that is validated must be the same cost that is
  // compared against gold and the same cost that is quoted back.
  const heroKey = hero.HeroKey;
  const unlockCost = hero.UnlockCost;
  const isAvailable = hero.IsAvailable;
  const isFirstAvailable = hero.IsFirstAvailable;

  requirePositiveSafeInteger(heroKey, "hero key");
  requireNonNegativeSafeInteger(unlockCost, `hero ${heroKey} unlock cost`);
  if (
    typeof isAvailable !== "boolean" ||
    typeof isFirstAvailable !== "boolean"
  ) {
    throw new Error(`hero ${heroKey} availability flags must be boolean`);
  }
  if (!isAvailable) {
    throw new Error(`hero ${heroKey} is unavailable`);
  }
  if (owned.has(heroKey)) {
    return Object.freeze({ status: "owned", heroKey, cost: 0 });
  }
  if (isFirstAvailable) {
    return Object.freeze({ status: "starter", heroKey, cost: 0 });
  }
  if (input.gold < unlockCost) {
    return Object.freeze({
      status: "insufficient-gold",
      heroKey,
      cost: unlockCost,
    });
  }
  return Object.freeze({
    status: "purchasable",
    heroKey,
    cost: unlockCost,
  });
}

export function materializeHeroUnlock(
  indexes: DiscordHeroCatalogIndexes,
  state: Readonly<{ gold: number; ownedHeroKeys: readonly number[] }>,
  heroKey: number,
): never {
  const quote = quoteHeroUnlock(indexes, {
    heroKey,
    gold: state.gold,
    ownedHeroKeys: state.ownedHeroKeys,
  });
  if (quote.status !== "purchasable") {
    throw new Error(`hero ${heroKey} cannot be unlocked: ${quote.status}`);
  }
  throw new OracleRequiredError(
    "new-hero state initialization requires a runtime oracle",
  );
}

function rejectUnknownFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unknown !== undefined) {
    throw new Error(`${context} has unknown field ${unknown}`);
  }
}

/**
 * Accepts `unknown` on purpose: these run against snapshot values whose runtime
 * type is not guaranteed by the catalog types, and `Number.isSafeInteger`
 * already rejects strings, objects, null, NaN and out-of-range values. Taking
 * `number` here would let a forged non-number reach the check untyped.
 */
function requirePositiveSafeInteger(value: unknown, context: string): void {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: unknown, context: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

/**
 * A bare `.length === 0` probe is not a string check: `{ length: 1 }` passes it
 * while being an object that would then be aliased straight into the output.
 */
function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

/** Freezes through Reflect.ownKeys so no reachable node stays mutable. */
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
