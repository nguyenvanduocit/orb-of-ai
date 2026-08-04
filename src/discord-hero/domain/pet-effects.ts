import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";

/**
 * Pure, synchronous projection of the source-backed Pet corpus.
 *
 * This module reports what the pinned catalog says about pets and what the
 * caller's existing ownership state says about them. It deliberately does NOT
 * apply anything: no kill-counter authority, no DLC entitlement, no unlock
 * timing, no percent/unit normalisation, no drop RNG, no gold/exp arithmetic,
 * no stacking and no caps. Every numeric that the source does not prove a unit
 * for is carried as a raw source value tagged UNPROVEN, and there is no
 * normalised or applied total anywhere in the returned shape.
 */

const PET_FIELDS = [
  "PetKey",
  "NameKey",
  "NameKey_i18n",
  "DescriptionKey",
  "DescriptionKey_i18n",
  "StatDataKey",
  "UnlockCondition",
  "Param1",
  "Param2",
] as const;

const PET_STAT_FIELDS = ["PetStatKey", "STATTYPE", "MODTYPE", "Value"] as const;

const UNLOCK_CONDITIONS = new Set(["KillMonster", "DLC"]);

/**
 * FLAT only, on purpose. All 11 pinned pet_stats rows carry MODTYPE=FLAT and
 * the source proves no other pet stat modifier. ADDITIVE and MULTIPLICATIVE
 * are real MODTYPEs on the `buffs` table, so widening this set by analogy is
 * the tempting mistake -- but it would let the projection certify a pet stat
 * combination rule the source never states. A new MODTYPE must fail closed
 * here and be an explicit decision, not an inherited assumption.
 *
 * This pins the column VALUE, not a scale: FLAT still says nothing about
 * whether 100 means 100%, 10.0% or 1.00x, which is why every projected effect
 * stays `unit: "UNPROVEN"` and keeps its untouched raw source value.
 */
const PET_STAT_MOD_TYPES = new Set(["FLAT"]);

const EXPECTED_PETS = 8;
const EXPECTED_PET_STAT_ROWS = 11;
const EXPECTED_KILL_MONSTER_PETS = 5;
const EXPECTED_DLC_PETS = 3;

export interface PetOwnershipState {
  readonly unlocked: readonly number[];
  readonly active: number | null;
}

export interface PetEffectInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly state: PetOwnershipState;
}

export interface PetEffectCounts {
  readonly pets: 8;
  readonly petStatRows: 11;
  readonly killMonsterPets: 5;
  readonly dlcPets: 3;
}

export interface PetEffectProvenance {
  readonly table: "pet_stats";
  readonly primaryField: "PetStatKey";
  readonly statDataKey: number;
  readonly rowIndex: number;
  readonly groupIndex: number;
}

/**
 * A raw pet_stats row. `unit` is UNPROVEN because the source never states
 * whether e.g. DropChanceNormalChestPercent 100 means 100%, 10.0% or 1.00x.
 * Callers must not fold these into a normalised or applied total.
 */
export interface PetSourceEffect {
  readonly petStatKey: number;
  readonly statType: string;
  readonly modType: string;
  readonly value: number;
  readonly unit: "UNPROVEN";
  readonly provenance: PetEffectProvenance;
}

export type PetUnlockCondition =
  | {
      readonly kind: "kill-monster";
      readonly rawParam1: number;
      readonly rawParam2: number;
      readonly monsterReference: {
        readonly kind: "resolved";
        readonly monsterKey: number;
      };
    }
  | {
      readonly kind: "dlc";
      readonly rawParam1: number;
      readonly rawParam2: null;
    };

export type PetOwnership =
  | { readonly kind: "owned"; readonly arranged: boolean }
  | { readonly kind: "not-owned" };

export interface PetCatalogEntry {
  readonly rowIndex: number;
  readonly petKey: number;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly statDataKey: number;
  readonly unlock: PetUnlockCondition;
  readonly ownership: PetOwnership;
  readonly effects: readonly PetSourceEffect[];
}

export interface PetEffectProjection {
  readonly counts: PetEffectCounts;
  readonly pets: readonly PetCatalogEntry[];
  readonly owned: readonly number[];
  readonly arranged: number | null;
}

/**
 * Freezes through Reflect.ownKeys so a non-enumerable or symbol-keyed child
 * cannot slip out unfrozen. Object.values would silently skip both.
 */
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

function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function snapshotOwnDataProperty(
  value: unknown,
  field: string,
  label: string,
): unknown {
  assertRecord(value, label);
  if (!Object.hasOwn(value, field)) {
    throw new Error(`${label} is missing field ${field}`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (
    descriptor === undefined ||
    typeof descriptor.get === "function" ||
    typeof descriptor.set === "function" ||
    !("value" in descriptor)
  ) {
    throw new Error(`${label}.${field} must be an own data property`);
  }
  return descriptor.value;
}

/**
 * Requires the declared fields to be present as OWN properties and rejects any
 * other own key, including non-enumerable and symbol keys. Reading through a
 * prototype or smuggling a hidden key is therefore impossible.
 */
function assertExactOwnFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertRecord(value, label);
  const unknownFields = Reflect.ownKeys(value)
    .filter((key) => typeof key !== "string" || !expectedFields.includes(key))
    .map((key) => String(key))
    .sort();
  if (unknownFields.length > 0) {
    throw new Error(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !Object.hasOwn(value, field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `${label} is missing own field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function knownString(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
): string {
  const result = nonemptyString(value, label);
  if (!allowed.has(result)) {
    throw new Error(`${label} has unknown value ${JSON.stringify(result)}`);
  }
  return result;
}

function assertUnique(keys: readonly number[], label: string): void {
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} must be unique`);
  }
}

/** One captured pet_stats row: every field read exactly once. */
interface CapturedPetStat {
  readonly petStatKey: number;
  readonly statType: string;
  readonly modType: string;
  readonly value: number;
  readonly rowIndex: number;
}

function capturePetStats(
  rows: readonly DiscordHeroDatasetRow<"pet_stats">[],
): readonly CapturedPetStat[] {
  if (rows.length !== EXPECTED_PET_STAT_ROWS) {
    throw new Error(
      `pet_stats must contain exactly ${EXPECTED_PET_STAT_ROWS} rows`,
    );
  }
  return rows.map((row, rowIndex) => {
    assertExactOwnFields(row, PET_STAT_FIELDS, "pet_stats row");
    const petStatKey = row.PetStatKey;
    const statType = row.STATTYPE;
    const modType = row.MODTYPE;
    const value = row.Value;
    return {
      petStatKey: positiveSafeInteger(petStatKey, "pet_stats.PetStatKey"),
      statType: nonemptyString(statType, "pet_stats.STATTYPE"),
      modType: knownString(modType, PET_STAT_MOD_TYPES, "pet_stats.MODTYPE"),
      value: finiteNumber(value, "pet_stats.Value"),
      rowIndex,
    };
  });
}

/** One captured pets row: every field read exactly once. */
interface CapturedPet {
  readonly rowIndex: number;
  readonly petKey: number;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly statDataKey: number;
  readonly unlockCondition: string;
  readonly param1: number;
  readonly param2: number | null;
}

function capturePets(
  rows: readonly DiscordHeroDatasetRow<"pets">[],
): readonly CapturedPet[] {
  if (rows.length !== EXPECTED_PETS) {
    throw new Error(`pets must contain exactly ${EXPECTED_PETS} rows`);
  }
  const captured = rows.map((row, rowIndex) => {
    assertExactOwnFields(row, PET_FIELDS, "pets row");
    const petKey = row.PetKey;
    const nameKey = row.NameKey;
    const descriptionKey = row.DescriptionKey;
    const statDataKey = row.StatDataKey;
    const unlockCondition = row.UnlockCondition;
    const param1 = row.Param1;
    const param2 = row.Param2;

    const condition = knownString(
      unlockCondition,
      UNLOCK_CONDITIONS,
      "pets.UnlockCondition",
    );
    let capturedParam2: number | null;
    if (condition === "DLC") {
      if (param2 !== null) {
        throw new Error("pets.Param2 must be null when UnlockCondition is DLC");
      }
      capturedParam2 = null;
    } else {
      if (param2 === null) {
        throw new Error(
          "pets.Param2 must be a finite number when UnlockCondition is KillMonster",
        );
      }
      capturedParam2 = finiteNumber(param2, "pets.Param2");
    }

    return {
      rowIndex,
      petKey: positiveSafeInteger(petKey, "pets.PetKey"),
      nameKey: nonemptyString(nameKey, "pets.NameKey"),
      descriptionKey: nonemptyString(descriptionKey, "pets.DescriptionKey"),
      statDataKey: positiveSafeInteger(statDataKey, "pets.StatDataKey"),
      unlockCondition: condition,
      param1: positiveSafeInteger(param1, "pets.Param1"),
      param2: capturedParam2,
    };
  });
  assertUnique(
    captured.map((pet) => pet.petKey),
    "pets.PetKey",
  );
  return captured;
}

function captureState(value: unknown): {
  readonly unlocked: readonly number[];
  readonly active: number | null;
} {
  assertExactOwnFields(value, ["unlocked", "active"], "pet state");
  const rawUnlocked = value.unlocked;
  const rawActive = value.active;
  if (!Array.isArray(rawUnlocked)) {
    throw new Error("pet state unlocked must be an array");
  }
  const unlocked = rawUnlocked.map((entry, index) =>
    positiveSafeInteger(entry, `pet state unlocked[${index}]`),
  );
  if (new Set(unlocked).size !== unlocked.length) {
    throw new Error("pet state unlocked must not contain duplicate pet keys");
  }
  const active =
    rawActive === null
      ? null
      : typeof rawActive === "number" &&
          Number.isSafeInteger(rawActive) &&
          rawActive > 0
        ? rawActive
        : (() => {
            throw new Error(
              "pet state active must be a positive safe integer or null",
            );
          })();
  return { unlocked, active };
}

export function projectPetEffects(input: PetEffectInput): PetEffectProjection {
  assertExactOwnFields(input, ["indexes", "state"], "pet-effect input");
  const { indexes } = input;
  assertRecord(indexes, "pet-effect input indexes");
  assertRecord(indexes.tables, "pet-effect input indexes.tables");
  for (const name of ["pets", "pet_stats", "monsters"] as const) {
    const table: unknown = indexes.tables[name];
    assertRecord(table, `pet-effect input indexes.tables.${name}`);
    if (!Array.isArray((table as { rows?: unknown }).rows)) {
      throw new Error(
        `pet-effect input indexes.tables.${name} must be a canonical table index`,
      );
    }
  }
  const monsterGroups = snapshotOwnDataProperty(
    indexes.tables.monsters,
    "groups",
    "pet-effect input indexes.tables.monsters",
  );
  if (
    typeof monsterGroups !== "object" ||
    monsterGroups === null ||
    typeof (monsterGroups as { has?: unknown }).has !== "function"
  ) {
    throw new Error(
      "pet-effect input indexes.tables.monsters must expose a groups index",
    );
  }

  const pets = capturePets(indexes.tables.pets.rows);
  const petStats = capturePetStats(indexes.tables.pet_stats.rows);

  // Group the captured stat rows by PetStatKey, preserving source row order
  // inside each group. Grouping the CAPTURED rows (never the raw ones) keeps
  // the single-read guarantee intact.
  const statsByKey = new Map<number, CapturedPetStat[]>();
  for (const stat of petStats) {
    const group = statsByKey.get(stat.petStatKey) ?? [];
    group.push(stat);
    statsByKey.set(stat.petStatKey, group);
  }

  // Every captured source row must be consumed exactly once. A shared
  // StatDataKey would duplicate one source group in the projection, while an
  // unreferenced group would silently disappear behind the pinned row count.
  const consumedStatDataKeys = new Set<number>();
  let consumedPetStatRows = 0;
  for (const pet of pets) {
    if (consumedStatDataKeys.has(pet.statDataKey)) {
      throw new Error(
        `pets.StatDataKey group ${pet.statDataKey} must be consumed by exactly one pet`,
      );
    }
    const group = statsByKey.get(pet.statDataKey);
    if (group === undefined) {
      throw new Error(
        `pets.StatDataKey references unknown pet_stats group ${pet.statDataKey}`,
      );
    }
    consumedStatDataKeys.add(pet.statDataKey);
    consumedPetStatRows += group.length;
  }
  if (consumedPetStatRows !== petStats.length) {
    throw new Error(
      `pet_stats rows must be consumed exactly once by pets; consumed ${consumedPetStatRows} of ${petStats.length}`,
    );
  }

  const state = captureState(input.state);
  const petKeys = new Set(pets.map((pet) => pet.petKey));
  state.unlocked.forEach((petKey, index) => {
    if (!petKeys.has(petKey)) {
      throw new Error(
        `pet state unlocked[${index}] references unknown pet ${petKey}`,
      );
    }
  });
  if (state.active !== null && !state.unlocked.includes(state.active)) {
    throw new Error(`pet state active pet ${state.active} is not unlocked`);
  }

  const owned = new Set(state.unlocked);
  let killMonsterPets = 0;

  const projectedPets: PetCatalogEntry[] = pets.map((pet) => {
    const group = statsByKey.get(pet.statDataKey)!;

    let unlock: PetUnlockCondition;
    if (pet.unlockCondition === "KillMonster") {
      if (
        !(monsterGroups as ReadonlyMap<number, readonly unknown[]>).has(
          pet.param1,
        )
      ) {
        throw new Error(`pets.Param1 references unknown monster ${pet.param1}`);
      }
      killMonsterPets += 1;
      unlock = {
        kind: "kill-monster",
        rawParam1: pet.param1,
        rawParam2: pet.param2 as number,
        monsterReference: { kind: "resolved", monsterKey: pet.param1 },
      };
    } else {
      unlock = {
        kind: "dlc",
        rawParam1: pet.param1,
        rawParam2: null,
      };
    }

    return {
      rowIndex: pet.rowIndex,
      petKey: pet.petKey,
      nameKey: pet.nameKey,
      descriptionKey: pet.descriptionKey,
      statDataKey: pet.statDataKey,
      unlock,
      ownership: owned.has(pet.petKey)
        ? { kind: "owned", arranged: state.active === pet.petKey }
        : { kind: "not-owned" },
      effects: group.map((stat, groupIndex) => ({
        petStatKey: stat.petStatKey,
        statType: stat.statType,
        modType: stat.modType,
        value: stat.value,
        unit: "UNPROVEN" as const,
        provenance: {
          table: "pet_stats" as const,
          primaryField: "PetStatKey" as const,
          statDataKey: pet.statDataKey,
          rowIndex: stat.rowIndex,
          groupIndex,
        },
      })),
    };
  });

  // UnlockCondition is a closed binary discriminant and the corpus is pinned
  // at EXPECTED_PETS rows, so guarding the KillMonster count also pins the DLC
  // count: 8 rows - 5 KillMonster leaves exactly 3 DLC. A second guard on
  // dlcPets would be unreachable by construction.
  if (killMonsterPets !== EXPECTED_KILL_MONSTER_PETS) {
    throw new Error(
      `pets must contain exactly ${EXPECTED_KILL_MONSTER_PETS} KillMonster pets`,
    );
  }

  return deepFreeze({
    counts: {
      pets: EXPECTED_PETS,
      petStatRows: EXPECTED_PET_STAT_ROWS,
      killMonsterPets: EXPECTED_KILL_MONSTER_PETS,
      dlcPets: EXPECTED_DLC_PETS,
    },
    pets: projectedPets,
    owned: [...state.unlocked],
    arranged: state.active,
  });
}
