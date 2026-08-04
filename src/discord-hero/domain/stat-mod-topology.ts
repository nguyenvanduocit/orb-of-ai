import { createHash } from "node:crypto";
import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

const MATERIAL_FIELDS = ["ItemKey", "MATERIALTYPE", "StatModGroupKey"] as const;

const STAT_MOD_GROUP_FIELDS = [
  "StatModGroupKey",
  "GearGroup",
  "StatModKey",
  "MinTier",
  "MaxTier",
] as const;

const STAT_MOD_FIELDS = [
  "StatModKey",
  "Tier",
  "STATTYPE",
  "MODTYPE",
  "MinValue",
  "MaxValue",
  "Interval",
] as const;

const SEMANTIC_REPORT_FIELDS = [
  "tableCount",
  "ruleCount",
  "checkedReferenceCount",
  "resolvedReferenceCount",
  "unresolvedReferenceCount",
  "rules",
  "tables",
  "unresolvedReferences",
] as const;

const MATERIAL_TYPES: ReadonlySet<string> = new Set([
  "DECORATION",
  "ENGRAVING",
  "INSCRIPTION",
  "CRAFTING",
  "OFFERING",
  "SOULSTONE",
]);

const GEAR_GROUPS: ReadonlySet<string> = new Set([
  "COMMON",
  "WEAPON",
  "ARMOR",
  "ACCESSORY",
]);

const MOD_TYPES: ReadonlySet<string> = new Set(["FLAT", "ADDITIVE"]);

const EXPECTED = {
  materialRows: 125,
  materialsWithoutStatModGroup: 46,
  materialsWithStatModGroup: 79,
  statModGroupKeys: 79,
  statModGroupRows: 474,
  statModKeys: 62,
  statModRows: 620,
  tiersPerStatMod: 10,
  referencedStatModKeys: 41,
  sourceUnreferencedStatModKeys: 21,
} as const;

const PINNED_ROW_SHA256 = {
  materials: "86e478fa8563026cc39ad5227ff9eb2b2e847e235e676056ae4129a902980baa",
  stat_mod_groups:
    "f3a768b2ac1f4a50d0316688a2ff4b2c21430a1ac592a8d223530c85e2622bd8",
  stat_mods: "76df0657b34bcd8dc8780c8d739e0f616fecd5103a8118f43040e651f9075965",
} as const;

type SourceTable = "materials" | "stat_mod_groups" | "stat_mods";

interface TrustedMaterialRow {
  readonly ItemKey: number;
  readonly MATERIALTYPE: string;
  readonly StatModGroupKey: number | null;
}

interface TrustedStatModGroupRow {
  readonly StatModGroupKey: number;
  readonly GearGroup: string;
  readonly StatModKey: number;
  readonly MinTier: number;
  readonly MaxTier: number;
}

interface TrustedStatModRow {
  readonly StatModKey: number;
  readonly Tier: number;
  readonly STATTYPE: string;
  readonly MODTYPE: string;
  readonly MinValue: number;
  readonly MaxValue: number;
  readonly Interval: number;
}

export interface SourceStatModTopologyInput {
  readonly indexes: DiscordHeroCatalogIndexes;
}

export interface SourceStatModTopologyCounts {
  readonly materialRows: 125;
  readonly materialsWithoutStatModGroup: 46;
  readonly materialsWithStatModGroup: 79;
  readonly statModGroupKeys: 79;
  readonly statModGroupRows: 474;
  readonly statModKeys: 62;
  readonly statModRows: 620;
  readonly tiersPerStatMod: 10;
  readonly referencedStatModKeys: 41;
  readonly sourceUnreferencedStatModKeys: 21;
}

export interface SourceMaterialProvenance {
  readonly table: "materials";
  readonly rowIndex: number;
}

export interface SourceGroupedRowProvenance {
  readonly table: "stat_mod_groups" | "stat_mods";
  readonly rowIndex: number;
  readonly groupIndex: number;
  readonly rowIndexInGroup: number;
}

export type SourceMaterialStatModGroup =
  | {
      readonly kind: "none";
      readonly rawStatModGroupKey: null;
    }
  | {
      readonly kind: "resolved";
      readonly rawStatModGroupKey: number;
      readonly statModGroupIndex: number;
      readonly statModGroupRowIndexes: readonly number[];
    };

export interface SourceStatModMaterial {
  readonly provenance: SourceMaterialProvenance;
  readonly itemKey: number;
  readonly materialTypeRaw: string;
  readonly statModGroup: SourceMaterialStatModGroup;
}

export interface SourceStatModResolution {
  readonly kind: "resolved";
  readonly statModKey: number;
  readonly statModGroupIndex: number;
  readonly statModRowIndexes: readonly number[];
}

export interface SourceStatModGroupRow {
  readonly provenance: SourceGroupedRowProvenance & {
    readonly table: "stat_mod_groups";
  };
  readonly statModGroupKey: number;
  readonly gearGroupRaw: string;
  readonly statModKey: number;
  readonly minTierRaw: number;
  readonly maxTierRaw: number;
  readonly statMod: SourceStatModResolution;
}

export interface SourceStatModGroup {
  readonly statModGroupKey: number;
  readonly groupIndex: number;
  readonly materialSourceRowIndex: number;
  readonly rows: readonly SourceStatModGroupRow[];
}

export interface SourceStatModRow {
  readonly provenance: SourceGroupedRowProvenance & {
    readonly table: "stat_mods";
  };
  readonly statModKey: number;
  readonly tierRaw: number;
  readonly statTypeRaw: string;
  readonly modTypeRaw: string;
  readonly minValueRaw: number;
  readonly maxValueRaw: number;
  readonly intervalRaw: number;
}

export interface SourceStatMod {
  readonly statModKey: number;
  readonly groupIndex: number;
  readonly referenced: boolean;
  readonly referencedByStatModGroupRowIndexes: readonly number[];
  readonly rows: readonly SourceStatModRow[];
}

export interface SourceStatModTopology {
  readonly counts: SourceStatModTopologyCounts;
  readonly materials: readonly SourceStatModMaterial[];
  readonly statModGroups: readonly SourceStatModGroup[];
  readonly statMods: readonly SourceStatMod[];
  readonly referencedStatModKeys: readonly number[];
  readonly sourceUnreferencedStatModKeys: readonly number[];
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value);
    }
  }
  return value;
}

function snapshotExactObject(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} prototype must be Object.prototype or null`);
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const unknownFields = actualFields.filter(
    (field) => !expectedFields.includes(field),
  );
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

  const snapshot: Record<string, unknown> = {};
  for (const field of expectedFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label}.${field} must be an own data property`);
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function snapshotArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new Error(`${label} must use Array.prototype`);
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new Error(`${label}.length must be an own non-negative integer`);
  }
  const length = lengthDescriptor.value;
  const expectedKeys = new Set([
    ...Array.from({ length }, (_unused, index) => String(index)),
    "length",
  ]);
  const extraKeys = (ownKeys as string[]).filter(
    (key) => !expectedKeys.has(key),
  );
  if (extraKeys.length > 0) {
    throw new Error(`${label} has unexpected own key ${extraKeys[0]}`);
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      throw new Error(`${label} has a sparse hole at index ${index}`);
    }
    if (
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label}[${index}] must be an own data property`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function assertInertGroups(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an inert derived index object`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length > 0) {
    for (const key of ownKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor !== undefined &&
        (typeof descriptor.get === "function" ||
          typeof descriptor.set === "function")
      ) {
        throw new Error(`${label} must not expose caller-supplied accessors`);
      }
      if (
        descriptor !== undefined &&
        "value" in descriptor &&
        typeof descriptor.value === "function"
      ) {
        throw new Error(
          `${label} must not expose caller-supplied executable code`,
        );
      }
    }
    throw new Error(`${label} must not contain caller-owned state`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== Map.prototype &&
    (typeof prototype !== "object" ||
      prototype === null ||
      !Object.isFrozen(prototype))
  ) {
    throw new Error(`${label} prototype is not a trusted inert map prototype`);
  }
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function tier(value: unknown, label: string): number {
  const result = positiveSafeInteger(value, label);
  if (result > EXPECTED.tiersPerStatMod) {
    throw new Error(`${label} must be between 1 and 10`);
  }
  return result;
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

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function captureMaterialRow(value: unknown): TrustedMaterialRow {
  const row = snapshotExactObject(value, MATERIAL_FIELDS, "materials row");
  const statModGroupKey =
    row.StatModGroupKey === null
      ? null
      : positiveSafeInteger(row.StatModGroupKey, "materials.StatModGroupKey");
  return {
    ItemKey: positiveSafeInteger(row.ItemKey, "materials.ItemKey"),
    MATERIALTYPE: knownString(
      row.MATERIALTYPE,
      MATERIAL_TYPES,
      "materials.MATERIALTYPE",
    ),
    StatModGroupKey: statModGroupKey,
  };
}

function captureStatModGroupRow(value: unknown): TrustedStatModGroupRow {
  const row = snapshotExactObject(
    value,
    STAT_MOD_GROUP_FIELDS,
    "stat_mod_groups row",
  );
  const minTier = tier(row.MinTier, "stat_mod_groups.MinTier");
  const maxTier = tier(row.MaxTier, "stat_mod_groups.MaxTier");
  if (minTier > maxTier) {
    throw new Error("stat_mod_groups.MinTier must not be greater than MaxTier");
  }
  return {
    StatModGroupKey: positiveSafeInteger(
      row.StatModGroupKey,
      "stat_mod_groups.StatModGroupKey",
    ),
    GearGroup: knownString(
      row.GearGroup,
      GEAR_GROUPS,
      "stat_mod_groups.GearGroup",
    ),
    StatModKey: positiveSafeInteger(
      row.StatModKey,
      "stat_mod_groups.StatModKey",
    ),
    MinTier: minTier,
    MaxTier: maxTier,
  };
}

function captureStatModRow(value: unknown): TrustedStatModRow {
  const row = snapshotExactObject(value, STAT_MOD_FIELDS, "stat_mods row");
  const minValue = positiveSafeInteger(row.MinValue, "stat_mods.MinValue");
  const maxValue = positiveSafeInteger(row.MaxValue, "stat_mods.MaxValue");
  if (minValue > maxValue) {
    throw new Error("stat_mods.MinValue must not be greater than MaxValue");
  }
  return {
    StatModKey: positiveSafeInteger(row.StatModKey, "stat_mods.StatModKey"),
    Tier: tier(row.Tier, "stat_mods.Tier"),
    STATTYPE: nonemptyString(row.STATTYPE, "stat_mods.STATTYPE"),
    MODTYPE: knownString(row.MODTYPE, MOD_TYPES, "stat_mods.MODTYPE"),
    MinValue: minValue,
    MaxValue: maxValue,
    Interval: positiveSafeInteger(row.Interval, "stat_mods.Interval"),
  };
}

function assertStrictlyIncreasing(
  values: readonly number[],
  label: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! <= values[index - 1]!) {
      throw new Error(`${label} must preserve strict canonical order`);
    }
  }
}

function assertNoDuplicateRows(rows: readonly unknown[], label: string): void {
  const signatures = new Set<string>();
  for (const row of rows) {
    const signature = JSON.stringify(row);
    if (signatures.has(signature)) {
      throw new Error(`${label} must not contain duplicate source rows`);
    }
    signatures.add(signature);
  }
}

function assertPinnedRows(rows: readonly unknown[], table: SourceTable): void {
  if (sha256(rows) !== PINNED_ROW_SHA256[table]) {
    throw new Error(`${table} rows do not match the pinned source rows`);
  }
}

function buildOrderedGroups<Row>(
  rows: readonly Row[],
  keyFor: (row: Row) => number,
  label: string,
): {
  readonly keys: readonly number[];
  readonly groups: ReadonlyMap<number, readonly Row[]>;
  readonly rowIndexes: ReadonlyMap<number, readonly number[]>;
} {
  const keys: number[] = [];
  const groups = new Map<number, Row[]>();
  const rowIndexes = new Map<number, number[]>();
  let previousKey: number | undefined;

  rows.forEach((row, rowIndex) => {
    const key = keyFor(row);
    if (previousKey !== key) {
      if (groups.has(key)) {
        throw new Error(`${label} key ${key} is split across source rows`);
      }
      keys.push(key);
      groups.set(key, []);
      rowIndexes.set(key, []);
      previousKey = key;
    }
    groups.get(key)!.push(row);
    rowIndexes.get(key)!.push(rowIndex);
  });
  return { keys, groups, rowIndexes };
}

function snapshotRelevantTables(indexesValue: unknown): {
  readonly materials: readonly TrustedMaterialRow[];
  readonly statModGroupRows: readonly TrustedStatModGroupRow[];
  readonly statModRows: readonly TrustedStatModRow[];
} {
  const indexes = snapshotExactObject(
    indexesValue,
    ["catalog", "tables", "semanticReport"],
    "source stat-mod topology indexes",
  );
  const tables = snapshotExactObject(
    indexes.tables,
    DISCORD_HERO_DATASET_NAMES,
    "source stat-mod topology indexes.tables",
  );

  const snapshotTable = (
    name: SourceTable,
    primaryField: string,
    expectedRows: number,
  ): readonly unknown[] => {
    const table = snapshotExactObject(
      tables[name],
      ["name", "primaryField", "rows", "groups"],
      `source stat-mod topology indexes.tables.${name}`,
    );
    if (table.name !== name) {
      throw new Error(
        `source stat-mod topology indexes.tables.${name}.name must be ${name}`,
      );
    }
    if (table.primaryField !== primaryField) {
      throw new Error(
        `source stat-mod topology indexes.tables.${name}.primaryField must be ${primaryField}`,
      );
    }
    const rows = snapshotArray(
      table.rows,
      `source stat-mod topology indexes.tables.${name}.rows`,
    );
    if (rows.length !== expectedRows) {
      throw new Error(
        `${name} must contain exactly ${expectedRows} source rows`,
      );
    }
    assertInertGroups(
      table.groups,
      `source stat-mod topology indexes.tables.${name}.groups`,
    );
    return rows;
  };

  const materialRows = snapshotTable(
    "materials",
    "ItemKey",
    EXPECTED.materialRows,
  ).map(captureMaterialRow);
  const statModGroupRows = snapshotTable(
    "stat_mod_groups",
    "StatModGroupKey",
    EXPECTED.statModGroupRows,
  ).map(captureStatModGroupRow);
  const statModRows = snapshotTable(
    "stat_mods",
    "StatModKey",
    EXPECTED.statModRows,
  ).map(captureStatModRow);

  snapshotExactObject(
    indexes.semanticReport,
    SEMANTIC_REPORT_FIELDS,
    "source stat-mod topology indexes.semanticReport",
  );

  assertStrictlyIncreasing(
    materialRows.map((row) => row.ItemKey),
    "materials.ItemKey",
  );
  assertNoDuplicateRows(materialRows, "materials");
  assertNoDuplicateRows(statModGroupRows, "stat_mod_groups");
  assertNoDuplicateRows(statModRows, "stat_mods");
  assertPinnedRows(materialRows, "materials");
  assertPinnedRows(statModGroupRows, "stat_mod_groups");
  assertPinnedRows(statModRows, "stat_mods");

  return { materials: materialRows, statModGroupRows, statModRows };
}

export function projectSourceStatModTopology(
  inputValue: SourceStatModTopologyInput,
): SourceStatModTopology {
  const input = snapshotExactObject(
    inputValue,
    ["indexes"],
    "source stat-mod topology input",
  );
  const trusted = snapshotRelevantTables(input.indexes);

  const statModGroupSource = buildOrderedGroups(
    trusted.statModGroupRows,
    (row) => row.StatModGroupKey,
    "stat_mod_groups",
  );
  if (statModGroupSource.keys.length !== EXPECTED.statModGroupKeys) {
    throw new Error(
      `stat_mod_groups must contain exactly ${EXPECTED.statModGroupKeys} groups`,
    );
  }

  const statModSource = buildOrderedGroups(
    trusted.statModRows,
    (row) => row.StatModKey,
    "stat_mods",
  );
  if (statModSource.keys.length !== EXPECTED.statModKeys) {
    throw new Error(
      `stat_mods must contain exactly ${EXPECTED.statModKeys} groups`,
    );
  }

  const statModGroupIndexByKey = new Map<number, number>();
  statModSource.keys.forEach((key, groupIndex) => {
    statModGroupIndexByKey.set(key, groupIndex);
    const rows = statModSource.groups.get(key)!;
    if (rows.length !== EXPECTED.tiersPerStatMod) {
      throw new Error(`stat mod ${key} must contain exactly tiers 1-10`);
    }
    rows.forEach((row, rowIndexInGroup) => {
      if (row.Tier !== rowIndexInGroup + 1) {
        throw new Error(
          `stat mod ${key} tiers must preserve exact source order 1-10`,
        );
      }
      if (
        row.STATTYPE !== rows[0]!.STATTYPE ||
        row.MODTYPE !== rows[0]!.MODTYPE ||
        row.Interval !== rows[0]!.Interval
      ) {
        throw new Error(
          `stat mod ${key} has ambiguous source type or Interval`,
        );
      }
    });
  });

  const materialSourceRowByGroupKey = new Map<number, number>();
  let materialsWithoutStatModGroup = 0;
  trusted.materials.forEach((row, rowIndex) => {
    if (row.StatModGroupKey === null) {
      materialsWithoutStatModGroup += 1;
      return;
    }
    if (materialSourceRowByGroupKey.has(row.StatModGroupKey)) {
      throw new Error(
        `stat mod group ${row.StatModGroupKey} has duplicate material joins`,
      );
    }
    if (!statModGroupSource.groups.has(row.StatModGroupKey)) {
      throw new Error(
        `material ${row.ItemKey} references missing stat mod group ${row.StatModGroupKey}`,
      );
    }
    materialSourceRowByGroupKey.set(row.StatModGroupKey, rowIndex);
  });
  if (
    materialsWithoutStatModGroup !== EXPECTED.materialsWithoutStatModGroup ||
    materialSourceRowByGroupKey.size !== EXPECTED.materialsWithStatModGroup
  ) {
    throw new Error(
      "materials null/resolved stat mod group joins diverge from the pinned corpus",
    );
  }
  for (const groupKey of statModGroupSource.keys) {
    if (!materialSourceRowByGroupKey.has(groupKey)) {
      throw new Error(
        `stat mod group ${groupKey} has no exact reverse material join`,
      );
    }
  }

  const referencedByStatModGroupRowIndexes = new Map<number, number[]>();
  const referencedStatModKeys: number[] = [];
  trusted.statModGroupRows.forEach((row, rowIndex) => {
    if (!statModSource.groups.has(row.StatModKey)) {
      throw new Error(
        `stat mod group row ${rowIndex} references missing stat mod ${row.StatModKey}`,
      );
    }
    let reverse = referencedByStatModGroupRowIndexes.get(row.StatModKey);
    if (reverse === undefined) {
      reverse = [];
      referencedByStatModGroupRowIndexes.set(row.StatModKey, reverse);
      referencedStatModKeys.push(row.StatModKey);
    }
    reverse.push(rowIndex);
  });
  if (referencedStatModKeys.length !== EXPECTED.referencedStatModKeys) {
    throw new Error(
      `stat_mod_groups must reference exactly ${EXPECTED.referencedStatModKeys} stat keys`,
    );
  }
  const sourceUnreferencedStatModKeys = statModSource.keys.filter(
    (key) => !referencedByStatModGroupRowIndexes.has(key),
  );
  if (
    sourceUnreferencedStatModKeys.length !==
    EXPECTED.sourceUnreferencedStatModKeys
  ) {
    throw new Error(
      `stat_mods must contain exactly ${EXPECTED.sourceUnreferencedStatModKeys} source-unreferenced keys`,
    );
  }

  const statMods: SourceStatMod[] = statModSource.keys.map(
    (statModKey, groupIndex) => {
      const sourceRows = statModSource.groups.get(statModKey)!;
      const sourceRowIndexes = statModSource.rowIndexes.get(statModKey)!;
      const referencedRows =
        referencedByStatModGroupRowIndexes.get(statModKey) ?? [];
      return {
        statModKey,
        groupIndex,
        referenced: referencedRows.length > 0,
        referencedByStatModGroupRowIndexes: [...referencedRows],
        rows: sourceRows.map((row, rowIndexInGroup) => ({
          provenance: {
            table: "stat_mods",
            rowIndex: sourceRowIndexes[rowIndexInGroup]!,
            groupIndex,
            rowIndexInGroup,
          },
          statModKey: row.StatModKey,
          tierRaw: row.Tier,
          statTypeRaw: row.STATTYPE,
          modTypeRaw: row.MODTYPE,
          minValueRaw: row.MinValue,
          maxValueRaw: row.MaxValue,
          intervalRaw: row.Interval,
        })),
      };
    },
  );

  const statModGroups: SourceStatModGroup[] = statModGroupSource.keys.map(
    (statModGroupKey, groupIndex) => {
      const sourceRows = statModGroupSource.groups.get(statModGroupKey)!;
      const sourceRowIndexes =
        statModGroupSource.rowIndexes.get(statModGroupKey)!;
      const materialSourceRowIndex =
        materialSourceRowByGroupKey.get(statModGroupKey);
      if (materialSourceRowIndex === undefined) {
        throw new Error(
          `stat mod group ${statModGroupKey} has no material reverse join`,
        );
      }
      return {
        statModGroupKey,
        groupIndex,
        materialSourceRowIndex,
        rows: sourceRows.map((row, rowIndexInGroup) => {
          const statModGroupIndex = statModGroupIndexByKey.get(row.StatModKey);
          const statModRowIndexes = statModSource.rowIndexes.get(
            row.StatModKey,
          );
          if (
            statModGroupIndex === undefined ||
            statModRowIndexes === undefined
          ) {
            throw new Error(
              `stat mod group row references missing stat mod ${row.StatModKey}`,
            );
          }
          return {
            provenance: {
              table: "stat_mod_groups",
              rowIndex: sourceRowIndexes[rowIndexInGroup]!,
              groupIndex,
              rowIndexInGroup,
            },
            statModGroupKey: row.StatModGroupKey,
            gearGroupRaw: row.GearGroup,
            statModKey: row.StatModKey,
            minTierRaw: row.MinTier,
            maxTierRaw: row.MaxTier,
            statMod: {
              kind: "resolved",
              statModKey: row.StatModKey,
              statModGroupIndex,
              statModRowIndexes: [...statModRowIndexes],
            },
          };
        }),
      };
    },
  );

  const statModGroupIndexBySourceKey = new Map<number, number>();
  statModGroups.forEach((group) => {
    statModGroupIndexBySourceKey.set(group.statModGroupKey, group.groupIndex);
  });
  const materials: SourceStatModMaterial[] = trusted.materials.map(
    (row, rowIndex) => {
      if (row.StatModGroupKey === null) {
        return {
          provenance: { table: "materials", rowIndex },
          itemKey: row.ItemKey,
          materialTypeRaw: row.MATERIALTYPE,
          statModGroup: {
            kind: "none",
            rawStatModGroupKey: null,
          },
        };
      }
      const statModGroupIndex = statModGroupIndexBySourceKey.get(
        row.StatModGroupKey,
      );
      const statModGroupRowIndexes = statModGroupSource.rowIndexes.get(
        row.StatModGroupKey,
      );
      if (
        statModGroupIndex === undefined ||
        statModGroupRowIndexes === undefined
      ) {
        throw new Error(
          `material ${row.ItemKey} references missing stat mod group ${row.StatModGroupKey}`,
        );
      }
      return {
        provenance: { table: "materials", rowIndex },
        itemKey: row.ItemKey,
        materialTypeRaw: row.MATERIALTYPE,
        statModGroup: {
          kind: "resolved",
          rawStatModGroupKey: row.StatModGroupKey,
          statModGroupIndex,
          statModGroupRowIndexes: [...statModGroupRowIndexes],
        },
      };
    },
  );

  return deepFreeze({
    counts: {
      materialRows: EXPECTED.materialRows,
      materialsWithoutStatModGroup: EXPECTED.materialsWithoutStatModGroup,
      materialsWithStatModGroup: EXPECTED.materialsWithStatModGroup,
      statModGroupKeys: EXPECTED.statModGroupKeys,
      statModGroupRows: EXPECTED.statModGroupRows,
      statModKeys: EXPECTED.statModKeys,
      statModRows: EXPECTED.statModRows,
      tiersPerStatMod: EXPECTED.tiersPerStatMod,
      referencedStatModKeys: EXPECTED.referencedStatModKeys,
      sourceUnreferencedStatModKeys: EXPECTED.sourceUnreferencedStatModKeys,
    },
    materials,
    statModGroups,
    statMods,
    referencedStatModKeys,
    sourceUnreferencedStatModKeys,
  });
}
