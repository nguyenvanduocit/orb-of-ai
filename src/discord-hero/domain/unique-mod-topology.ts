import { types as nodeUtilTypes } from "node:util";
import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

const EXPECTED = {
  gearRows: 5_760,
  uniqueModRows: 36,
  uniqueModKeyNull: 5_612,
  uniqueModKeyZero: 21,
  uniqueModKeyPositive: 127,
  skillPrefixedUniqueMods: 19,
  nonSkillUniqueMods: 17,
  positiveUniqueModKeysCovered: 36,
} as const;

const UNIQUE_MOD_FIELDS = [
  "UniqueModKey",
  "UniqueMod",
  "Param1ExchangeType",
  "Param1",
  "Param2ExchangeType",
  "Param2",
  "Param3ExchangeType",
  "Param3",
  "Param4ExchangeType",
  "Param4",
  "Param5ExchangeType",
  "Param5",
] as const;

const GEAR_CORE_FIELDS = ["GearKey", "UniqueModKey"] as const;

export interface UniqueModTopologyInput {
  readonly indexes: DiscordHeroCatalogIndexes;
}

export interface UniqueModTopologyCounts {
  readonly gearRows: 5760;
  readonly uniqueModRows: 36;
  readonly uniqueModKeyNull: 5612;
  readonly uniqueModKeyZero: 21;
  readonly uniqueModKeyPositive: 127;
  readonly skillPrefixedUniqueMods: 19;
  readonly nonSkillUniqueMods: 17;
  readonly positiveUniqueModKeysCovered: 36;
}

export interface UniqueModParameterSlot {
  readonly exchangeType: string | null;
  readonly value: number | string | null;
}

export interface UniqueModParameters {
  readonly param1: UniqueModParameterSlot;
  readonly param2: UniqueModParameterSlot;
  readonly param3: UniqueModParameterSlot;
  readonly param4: UniqueModParameterSlot;
  readonly param5: UniqueModParameterSlot;
}

export type UniqueModSkillParam1 =
  | {
      readonly kind: "resolved-skill";
      readonly skillKey: number;
      readonly sourceField: "Param1";
      readonly ruleId: "unique_mods.Param1[Skill*]->skills";
    }
  | {
      readonly kind: "not-source-linked";
      readonly reason: "UniqueMod does not use the Skill-prefixed source skill relation";
    };

export interface UniqueModProvenance {
  readonly table: "unique_mods";
  readonly primaryField: "UniqueModKey";
  readonly rowIndex: number;
}

export interface UniqueModDefinition {
  readonly rowIndex: number;
  readonly uniqueModKey: number;
  readonly uniqueMod: string;
  readonly parameters: UniqueModParameters;
  readonly skillParam1: UniqueModSkillParam1;
  readonly provenance: UniqueModProvenance;
}

export type GearUniqueModIdentity = "null" | "zero" | "positive";

export type GearUniqueModResolution =
  | {
      readonly kind: "resolved";
      readonly uniqueModKey: number;
    }
  | {
      readonly kind: "none";
    };

export interface GearUniqueModRelation {
  readonly rowIndex: number;
  readonly gearKey: number;
  readonly uniqueModKey: number | null;
  readonly identity: GearUniqueModIdentity;
  readonly uniqueModResolution: GearUniqueModResolution;
}

export interface UniqueModTopology {
  readonly counts: UniqueModTopologyCounts;
  readonly gearRelations: readonly GearUniqueModRelation[];
  readonly uniqueMods: readonly UniqueModDefinition[];
}

interface TrustedUniqueModRow {
  readonly UniqueModKey: number;
  readonly UniqueMod: string;
  readonly Param1ExchangeType: string | null;
  readonly Param1: number | string | null;
  readonly Param2ExchangeType: string | null;
  readonly Param2: number | string | null;
  readonly Param3ExchangeType: null;
  readonly Param3: null;
  readonly Param4ExchangeType: null;
  readonly Param4: null;
  readonly Param5ExchangeType: null;
  readonly Param5: null;
  readonly rowIndex: number;
}

interface TrustedGearRow {
  readonly GearKey: number;
  readonly UniqueModKey: number | null;
  readonly rowIndex: number;
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

function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (
    ((typeof value === "object" && value !== null) ||
      typeof value === "function") &&
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function snapshotExactOwnFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  assertRecord(value, label);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const unknownFields = actualFields
    .filter((field) => !expectedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    throw new Error(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !actualFields.includes(field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of actualFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      throw new Error(
        `${label} must use enumerable own data properties without accessors`,
      );
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function snapshotRequiredOwnFields(
  value: unknown,
  requiredFields: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  assertRecord(value, label);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const missingFields = requiredFields.filter(
    (field) => !actualFields.includes(field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of requiredFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      throw new Error(
        `${label}.${field} must be an enumerable own data property`,
      );
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function snapshotArray(value: unknown, label: string): readonly unknown[] {
  if (
    ((typeof value === "object" && value !== null) ||
      typeof value === "function") &&
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype) {
    throw new Error(`${label} must use Array.prototype`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new Error(`${label}.length must be a non-negative safe integer`);
  }
  const length = lengthDescriptor.value as number;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (descriptor === undefined) {
      throw new Error(`${label} has a sparse hole at index ${index}`);
    }
    if (
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      throw new Error(`${label}[${index}] must be an own data property`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

/**
 * Groups are a derived index, never join authority. Reject Proxy wrappers
 * trap-free (node:util.types.isProxy) before any Reflect/meta walk that would
 * fire ownKeys/getOwnPropertyDescriptor traps; then reject own accessors /
 * callables without invoking them. The value is discarded afterwards — normal
 * RuntimeReadonlyMap instances are accepted but never used as join authority.
 */
function assertInertGroupsIndex(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} must be an object`);
  }
  // Trap-free Proxy detection MUST run before Reflect.ownKeys / GOPD.
  if (nodeUtilTypes.isProxy(value)) {
    throw new Error(
      `${label} must not be a Proxy; groups are not join authority`,
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label} must not expose own accessors`);
    }
    if ("value" in descriptor && typeof descriptor.value === "function") {
      throw new Error(`${label} must not expose own callable ${String(key)}`);
    }
  }
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null`);
  }
  return value;
}

function nullableNumberOrString(
  value: unknown,
  label: string,
): number | string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a number, string, or null`);
}

function captureUniqueModRow(
  row: unknown,
  rowIndex: number,
): TrustedUniqueModRow {
  const snapshot = snapshotExactOwnFields(
    row,
    UNIQUE_MOD_FIELDS,
    "unique_mods row",
  );
  const param3Exchange = snapshot.Param3ExchangeType;
  const param3 = snapshot.Param3;
  const param4Exchange = snapshot.Param4ExchangeType;
  const param4 = snapshot.Param4;
  const param5Exchange = snapshot.Param5ExchangeType;
  const param5 = snapshot.Param5;
  if (
    param3Exchange !== null ||
    param3 !== null ||
    param4Exchange !== null ||
    param4 !== null ||
    param5Exchange !== null ||
    param5 !== null
  ) {
    throw new Error(
      `unique_mods row ${rowIndex} params 3-5 must be null in source`,
    );
  }
  return {
    UniqueModKey: positiveSafeInteger(
      snapshot.UniqueModKey,
      "unique_mods.UniqueModKey",
    ),
    UniqueMod: nonemptyString(snapshot.UniqueMod, "unique_mods.UniqueMod"),
    Param1ExchangeType: nullableString(
      snapshot.Param1ExchangeType,
      "unique_mods.Param1ExchangeType",
    ),
    Param1: nullableNumberOrString(snapshot.Param1, "unique_mods.Param1"),
    Param2ExchangeType: nullableString(
      snapshot.Param2ExchangeType,
      "unique_mods.Param2ExchangeType",
    ),
    Param2: nullableNumberOrString(snapshot.Param2, "unique_mods.Param2"),
    Param3ExchangeType: null,
    Param3: null,
    Param4ExchangeType: null,
    Param4: null,
    Param5ExchangeType: null,
    Param5: null,
    rowIndex,
  };
}

function captureGearRow(row: unknown, rowIndex: number): TrustedGearRow {
  const snapshot = snapshotRequiredOwnFields(row, GEAR_CORE_FIELDS, "gear row");
  const gearKey = positiveSafeInteger(snapshot.GearKey, "gear.GearKey");
  const uniqueModKeyRaw = snapshot.UniqueModKey;
  let uniqueModKey: number | null;
  if (uniqueModKeyRaw === null) {
    uniqueModKey = null;
  } else if (uniqueModKeyRaw === 0) {
    uniqueModKey = 0;
  } else {
    uniqueModKey = positiveSafeInteger(uniqueModKeyRaw, "gear.UniqueModKey");
  }
  return { GearKey: gearKey, UniqueModKey: uniqueModKey, rowIndex };
}

function captureSkillKeys(
  rows: readonly unknown[],
): ReadonlySet<number | string> {
  const keys = new Set<number | string>();
  for (const [rowIndex, row] of rows.entries()) {
    const snapshot = snapshotRequiredOwnFields(
      row,
      ["SkillKey"],
      `skills row ${rowIndex}`,
    );
    const value = snapshot.SkillKey;
    // Source skills mix positive numeric keys with a minority of string keys
    // (trailing-space monster skill ids). Capture both; Skill-prefixed unique
    // mods only resolve Param1 against exact captured keys (numeric in corpus).
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      keys.add(value);
    } else if (typeof value === "string" && value.length > 0) {
      keys.add(value);
    } else {
      throw new Error(
        `skills.SkillKey at row ${rowIndex} must be a positive safe integer or non-empty string`,
      );
    }
  }
  return keys;
}

function snapshotTable(
  table: unknown,
  name: "gear" | "unique_mods" | "skills",
  primaryField: string,
): { rows: readonly unknown[] } {
  const snapshot = snapshotExactOwnFields(
    table,
    ["name", "primaryField", "rows", "groups"],
    `unique-mod topology indexes.tables.${name}`,
  );
  const tableName = snapshot.name;
  const primary = snapshot.primaryField;
  if (tableName !== name) {
    throw new Error(
      `unique-mod topology indexes.tables.${name}.name must be ${name}`,
    );
  }
  if (primary !== primaryField) {
    throw new Error(
      `unique-mod topology indexes.tables.${name}.primaryField must be ${primaryField}`,
    );
  }
  // Capture groups only to prove inertness — never walk it for joins.
  assertInertGroupsIndex(
    snapshot.groups,
    `unique-mod topology indexes.tables.${name}.groups`,
  );
  const rows = snapshotArray(
    snapshot.rows,
    `unique-mod topology indexes.tables.${name}.rows`,
  );
  return { rows };
}

function projectUniqueModDefinition(
  row: TrustedUniqueModRow,
  skillKeys: ReadonlySet<number | string>,
): UniqueModDefinition {
  const parameters: UniqueModParameters = Object.freeze({
    param1: Object.freeze({
      exchangeType: row.Param1ExchangeType,
      value: row.Param1,
    }),
    param2: Object.freeze({
      exchangeType: row.Param2ExchangeType,
      value: row.Param2,
    }),
    param3: Object.freeze({
      exchangeType: row.Param3ExchangeType,
      value: row.Param3,
    }),
    param4: Object.freeze({
      exchangeType: row.Param4ExchangeType,
      value: row.Param4,
    }),
    param5: Object.freeze({
      exchangeType: row.Param5ExchangeType,
      value: row.Param5,
    }),
  });

  let skillParam1: UniqueModSkillParam1;
  if (row.UniqueMod.startsWith("Skill")) {
    const skillKey = positiveSafeInteger(
      row.Param1,
      `unique_mods ${row.UniqueModKey} Skill Param1`,
    );
    if (!skillKeys.has(skillKey)) {
      throw new Error(
        `unique_mods ${row.UniqueModKey} Param1 skill ${skillKey} is missing from skills`,
      );
    }
    skillParam1 = Object.freeze({
      kind: "resolved-skill" as const,
      skillKey,
      sourceField: "Param1" as const,
      ruleId: "unique_mods.Param1[Skill*]->skills" as const,
    });
  } else {
    skillParam1 = Object.freeze({
      kind: "not-source-linked" as const,
      reason:
        "UniqueMod does not use the Skill-prefixed source skill relation" as const,
    });
  }

  return Object.freeze({
    rowIndex: row.rowIndex,
    uniqueModKey: row.UniqueModKey,
    uniqueMod: row.UniqueMod,
    parameters,
    skillParam1,
    provenance: Object.freeze({
      table: "unique_mods" as const,
      primaryField: "UniqueModKey" as const,
      rowIndex: row.rowIndex,
    }),
  });
}

export function projectSourceUniqueModTopology(
  input: UniqueModTopologyInput,
): UniqueModTopology {
  const inputSnapshot = snapshotExactOwnFields(
    input,
    ["indexes"],
    "unique-mod topology input",
  );

  const indexesSnapshot = snapshotExactOwnFields(
    inputSnapshot.indexes,
    ["catalog", "tables", "semanticReport"],
    "unique-mod topology indexes",
  );
  // catalog and semanticReport are captured to authenticate the exact indexes
  // shape, but canonical rows remain the only join authority.
  const tablesSnapshot = snapshotExactOwnFields(
    indexesSnapshot.tables,
    DISCORD_HERO_DATASET_NAMES,
    "unique-mod topology indexes.tables",
  );

  const gearTable = snapshotTable(tablesSnapshot.gear, "gear", "GearKey");
  const uniqueTable = snapshotTable(
    tablesSnapshot.unique_mods,
    "unique_mods",
    "UniqueModKey",
  );
  const skillsTable = snapshotTable(
    tablesSnapshot.skills,
    "skills",
    "SkillKey",
  );

  if (gearTable.rows.length !== EXPECTED.gearRows) {
    throw new Error(
      `gear must contain exactly ${EXPECTED.gearRows} rows; received ${gearTable.rows.length}`,
    );
  }
  if (uniqueTable.rows.length !== EXPECTED.uniqueModRows) {
    throw new Error(
      `unique_mods must contain exactly ${EXPECTED.uniqueModRows} rows; received ${uniqueTable.rows.length}`,
    );
  }

  const uniqueModsCaptured = uniqueTable.rows.map((row, index) =>
    captureUniqueModRow(row, index),
  );
  const uniqueModByKey = new Map<number, TrustedUniqueModRow>();
  for (const row of uniqueModsCaptured) {
    if (uniqueModByKey.has(row.UniqueModKey)) {
      throw new Error(
        `unique_mods.UniqueModKey must be unique; duplicate ${row.UniqueModKey}`,
      );
    }
    uniqueModByKey.set(row.UniqueModKey, row);
  }

  const skillKeys = captureSkillKeys(skillsTable.rows);
  const gearRows = gearTable.rows.map((row, index) =>
    captureGearRow(row, index),
  );
  const gearKeys = new Set<number>();
  for (const row of gearRows) {
    if (gearKeys.has(row.GearKey)) {
      throw new Error(`gear.GearKey must be unique; duplicate ${row.GearKey}`);
    }
    gearKeys.add(row.GearKey);
  }

  let uniqueModKeyNull = 0;
  let uniqueModKeyZero = 0;
  let uniqueModKeyPositive = 0;
  const positiveKeysSeen = new Set<number>();

  const gearRelations = gearRows.map((row): GearUniqueModRelation => {
    if (row.UniqueModKey === null) {
      uniqueModKeyNull += 1;
      return Object.freeze({
        rowIndex: row.rowIndex,
        gearKey: row.GearKey,
        uniqueModKey: null,
        identity: "null" as const,
        uniqueModResolution: Object.freeze({ kind: "none" as const }),
      });
    }
    if (row.UniqueModKey === 0) {
      uniqueModKeyZero += 1;
      return Object.freeze({
        rowIndex: row.rowIndex,
        gearKey: row.GearKey,
        uniqueModKey: 0,
        identity: "zero" as const,
        uniqueModResolution: Object.freeze({ kind: "none" as const }),
      });
    }
    uniqueModKeyPositive += 1;
    positiveKeysSeen.add(row.UniqueModKey);
    if (!uniqueModByKey.has(row.UniqueModKey)) {
      throw new Error(
        `gear ${row.GearKey} UniqueModKey ${row.UniqueModKey} is missing from unique_mods (orphan positive ref)`,
      );
    }
    return Object.freeze({
      rowIndex: row.rowIndex,
      gearKey: row.GearKey,
      uniqueModKey: row.UniqueModKey,
      identity: "positive" as const,
      uniqueModResolution: Object.freeze({
        kind: "resolved" as const,
        uniqueModKey: row.UniqueModKey,
      }),
    });
  });

  if (
    uniqueModKeyNull !== EXPECTED.uniqueModKeyNull ||
    uniqueModKeyZero !== EXPECTED.uniqueModKeyZero ||
    uniqueModKeyPositive !== EXPECTED.uniqueModKeyPositive
  ) {
    throw new Error(
      `gear UniqueModKey identity counts diverge: null=${uniqueModKeyNull} zero=${uniqueModKeyZero} positive=${uniqueModKeyPositive}`,
    );
  }
  if (positiveKeysSeen.size !== EXPECTED.positiveUniqueModKeysCovered) {
    throw new Error(
      `positive UniqueModKey coverage expected ${EXPECTED.positiveUniqueModKeysCovered} keys; received ${positiveKeysSeen.size}`,
    );
  }
  // No reverse-coverage loop here: it would be unreachable. The orphan guard
  // above forces positiveKeysSeen to be a subset of the unique_mods keys, the
  // coverage guard forces its size to EXPECTED.positiveUniqueModKeysCovered,
  // and uniqueness over EXPECTED.uniqueModRows rows gives the key set the same
  // size -- a subset of equal finite cardinality IS the whole set, so every
  // unique_mods key is already proven to be referenced.

  const uniqueMods = uniqueModsCaptured.map((row) =>
    projectUniqueModDefinition(row, skillKeys),
  );
  const skillPrefixed = uniqueMods.filter((mod) =>
    mod.uniqueMod.startsWith("Skill"),
  ).length;
  const nonSkill = uniqueMods.length - skillPrefixed;
  if (
    skillPrefixed !== EXPECTED.skillPrefixedUniqueMods ||
    nonSkill !== EXPECTED.nonSkillUniqueMods
  ) {
    throw new Error(
      `unique_mods Skill-prefix split expected ${EXPECTED.skillPrefixedUniqueMods}/${EXPECTED.nonSkillUniqueMods}; received ${skillPrefixed}/${nonSkill}`,
    );
  }

  return deepFreeze({
    counts: {
      gearRows: EXPECTED.gearRows,
      uniqueModRows: EXPECTED.uniqueModRows,
      uniqueModKeyNull: EXPECTED.uniqueModKeyNull,
      uniqueModKeyZero: EXPECTED.uniqueModKeyZero,
      uniqueModKeyPositive: EXPECTED.uniqueModKeyPositive,
      skillPrefixedUniqueMods: EXPECTED.skillPrefixedUniqueMods,
      nonSkillUniqueMods: EXPECTED.nonSkillUniqueMods,
      positiveUniqueModKeysCovered: EXPECTED.positiveUniqueModKeysCovered,
    },
    gearRelations: Object.freeze(gearRelations),
    uniqueMods: Object.freeze(uniqueMods),
  });
}
