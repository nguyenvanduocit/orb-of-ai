import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";
import {
  DISCORD_HERO_DATASET_NAMES,
  isDiscordHeroCatalogIndexAuthority,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import {
  projectSourceStatModTopology,
  type SourceMaterialStatModGroup,
  type SourceMaterialProvenance,
} from "../domain/stat-mod-topology";

export const DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE = 25;

export const DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS = [
  "materials",
  "extraction",
] as const;

export type DiscordHeroMaterialsExtractionSection =
  (typeof DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS)[number];

/** Provenance-only: Extraction execution lacks applied-stat material type/tier authority. */
export const DISCORD_HERO_MATERIALS_EXTRACTION_DISCLAIMER =
  "Source preview of materials and extraction_costs only. Extraction execution remains oracle-gated because executeExtraction lacks proven material type and tier provenance from gear rolls; this view does not debit costs, choose materials, or grant extraction outcomes.";

const EXPECTED = {
  materials: 125,
  materialsNone: 46,
  materialsResolved: 79,
  extraction: 90,
  materialsPageCount: 5,
  extractionPageCount: 4,
} as const;

const EXTRACTION_FIELDS = [
  "ExtractionKey",
  "GearGroup",
  "MATERIALTYPE",
  "Tier",
  "Cost",
] as const;

const SOURCE_TOPOLOGY_TABLES = [
  {
    name: "materials",
    fields: ["ItemKey", "MATERIALTYPE", "StatModGroupKey"],
  },
  {
    name: "stat_mod_groups",
    fields: [
      "StatModGroupKey",
      "GearGroup",
      "StatModKey",
      "MinTier",
      "MaxTier",
    ],
  },
  {
    name: "stat_mods",
    fields: [
      "StatModKey",
      "Tier",
      "STATTYPE",
      "MODTYPE",
      "MinValue",
      "MaxValue",
      "Interval",
    ],
  },
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

const ITEM_ROW_FIELD_PATTERNS = [
  ["id", "name", "grade", "type", "gear", "level", "icon", "affix", "slug"],
  [
    "id",
    "name",
    "grade",
    "type",
    "gear",
    "level",
    "icon",
    "affix",
    "deleted",
    "slug",
  ],
  [
    "id",
    "name",
    "grade",
    "type",
    "gear",
    "level",
    "icon",
    "affix",
    "marketable",
    "slug",
  ],
] as const;

const PINNED_ROW_SHA256 = {
  extraction:
    "8e0f56bbb6fde00a113d3758a5c6dd9d5508b939fc4ac7f959d8aebce32d4ba0",
  items: "6559ad9a7289554c48bd3fef7aed5f8db01fee8f9d18de9f6330a59c4fb7f9a1",
} as const;

export type DiscordHeroMaterialItemResolution =
  | {
      readonly kind: "resolved";
      readonly itemKey: number;
      readonly name: string;
      readonly type: string;
      readonly grade: string;
    }
  | {
      readonly kind: "unresolved-source";
      readonly itemKey: number;
      readonly reason: string;
    };

export interface DiscordHeroMaterialsBrowserRow {
  readonly section: "materials";
  readonly rowIndex: number;
  readonly itemKey: number;
  readonly materialType: string;
  readonly statModGroup: SourceMaterialStatModGroup;
  readonly topologyProvenance: SourceMaterialProvenance;
  readonly item: DiscordHeroMaterialItemResolution;
}

export interface DiscordHeroExtractionBrowserRow {
  readonly section: "extraction";
  readonly rowIndex: number;
  readonly extractionKey: number;
  readonly gearGroup: string;
  readonly materialType: string;
  readonly tier: number;
  readonly cost: number;
  readonly provenance: {
    readonly table: "extraction_costs";
    readonly primaryField: "ExtractionKey";
    readonly rowIndex: number;
  };
}

export type DiscordHeroMaterialsExtractionRow =
  DiscordHeroMaterialsBrowserRow | DiscordHeroExtractionBrowserRow;

export interface DiscordHeroMaterialsExtractionSectionMeta {
  readonly section: DiscordHeroMaterialsExtractionSection;
  readonly rowCount: number;
  readonly pageCount: number;
}

export interface DiscordHeroMaterialsExtractionBrowser {
  readonly sections: readonly DiscordHeroMaterialsExtractionSectionMeta[];
  readonly disclaimer: typeof DISCORD_HERO_MATERIALS_EXTRACTION_DISCLAIMER;
}

export interface DiscordHeroMaterialsExtractionPage {
  readonly section: DiscordHeroMaterialsExtractionSection;
  readonly page: number;
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rows: readonly DiscordHeroMaterialsExtractionRow[];
}

export function formatDiscordHeroMaterialsExtractionSafeText(
  value: string,
  maxUtf16Units = 200,
): string {
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ")
    .replaceAll("`", "'")
    .replaceAll("@", "＠")
    .replaceAll("<#", "<＃");
  const validUnicode = Array.from(sanitized, (codePoint) => {
    const codePointValue = codePoint.codePointAt(0)!;
    return codePointValue >= 0xd800 && codePointValue <= 0xdfff
      ? "\ufffd"
      : codePoint;
  }).join("");
  if (validUnicode.length <= maxUtf16Units) return validUnicode;
  let truncated = "";
  for (const codePoint of validUnicode) {
    if (truncated.length + codePoint.length > maxUtf16Units - 1) break;
    truncated += codePoint;
  }
  return `${truncated}…`;
}

function describeValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function fail(message: string): never {
  throw new Error(formatDiscordHeroMaterialsExtractionSafeText(message));
}

/**
 * Error paths are built from caller keys, so every append stays bounded: a deep
 * or wide caller graph must not grow the label past a fixed size, or the bound
 * that actually fired gets truncated out of the message.
 */
const LABEL_MAX_LENGTH = 120;

function childLabel(label: string, segment: string): string {
  const next = `${label}${segment}`;
  return next.length <= LABEL_MAX_LENGTH
    ? next
    : `${next.slice(0, LABEL_MAX_LENGTH)}…`;
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

function snapshotExactObject(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (nodeUtilTypes.isProxy(value)) {
    fail(`${label} must not be a Proxy`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object; received ${describeValueType(value)}`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const unknownFields = actualFields
    .filter((field) => !expectedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    fail(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !actualFields.includes(field),
  );
  if (missingFields.length > 0) {
    fail(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const field of expectedFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      fail(`${label}.${field} must be an enumerable own data property`);
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

/** Traversal bounds: caller catalogs are adversarial, so every descent is capped. */
const SNAPSHOT_MAX_DEPTH = 64;
const SNAPSHOT_MAX_ARRAY_LENGTH = 65_536;
const SNAPSHOT_MAX_NODES = 1_048_576;

interface SnapshotBounds {
  readonly activePath: WeakSet<object>;
  remaining: number;
}

function snapshotBounds(): SnapshotBounds {
  return { activePath: new WeakSet<object>(), remaining: SNAPSHOT_MAX_NODES };
}

function spendSnapshotBudget(
  bounds: SnapshotBounds,
  cost: number,
  label: string,
): void {
  if (cost > bounds.remaining) {
    fail(`${label} exceeds the ${SNAPSHOT_MAX_NODES} node/key snapshot budget`);
  }
  bounds.remaining -= cost;
}

function snapshotArray(
  value: unknown,
  label: string,
  bounds: SnapshotBounds = snapshotBounds(),
): readonly unknown[] {
  if (nodeUtilTypes.isProxy(value)) {
    fail(`${label} must not be a Proxy`);
  }
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    fail(`${label} must use Array.prototype`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    fail(`${label}.length must be an own non-negative integer`);
  }
  const length = lengthDescriptor.value;
  // Cap the declared length before any length-proportional work.
  if (length > SNAPSHOT_MAX_ARRAY_LENGTH) {
    fail(
      `${label}.length must not exceed ${SNAPSHOT_MAX_ARRAY_LENGTH} entries`,
    );
  }
  spendSnapshotBudget(bounds, length + 1, label);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail(`${label} must not contain symbol own keys`);
  }
  const unexpectedKey = (ownKeys as string[]).find((key) => {
    if (key === "length") return false;
    const index = Number(key);
    return (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= length ||
      String(index) !== key
    );
  });
  if (unexpectedKey !== undefined) {
    fail(`${label} has unexpected own key ${unexpectedKey}`);
  }
  if (ownKeys.length !== length + 1) {
    fail(`${label} has one or more sparse holes`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      fail(`${label}[${index}] must be an own data property`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function snapshotJsonValue(
  value: unknown,
  label: string,
  bounds: SnapshotBounds = snapshotBounds(),
  depth = 0,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (nodeUtilTypes.isProxy(value)) {
    fail(`${label} must not be a Proxy`);
  }
  if (typeof value !== "object" || value === null) {
    fail(`${label} must contain only JSON data`);
  }
  if (bounds.activePath.has(value)) {
    fail(`${label} must not contain cycles`);
  }
  if (depth > SNAPSHOT_MAX_DEPTH) {
    fail(`${label} nested depth exceeds ${SNAPSHOT_MAX_DEPTH}`);
  }
  spendSnapshotBudget(bounds, 1, label);
  bounds.activePath.add(value);
  try {
    if (Array.isArray(value)) {
      return snapshotArray(value, label, bounds).map((entry, index) =>
        snapshotJsonValue(
          entry,
          childLabel(label, `[${index}]`),
          bounds,
          depth + 1,
        ),
      );
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(`${label} prototype must be Object.prototype or null`);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      fail(`${label} must not contain symbol own keys`);
    }
    spendSnapshotBudget(bounds, ownKeys.length, label);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of ownKeys as string[]) {
      const keyLabel = childLabel(label, `.${key}`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        typeof descriptor.get === "function" ||
        typeof descriptor.set === "function" ||
        !("value" in descriptor)
      ) {
        fail(`${keyLabel} must be an enumerable own data property`);
      }
      snapshot[key] = snapshotJsonValue(
        descriptor.value,
        keyLabel,
        bounds,
        depth + 1,
      );
    }
    return snapshot;
  } finally {
    bounds.activePath.delete(value);
  }
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSection(
  value: unknown,
  label: string,
): DiscordHeroMaterialsExtractionSection {
  if (
    typeof value !== "string" ||
    !(DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS as readonly string[]).includes(
      value,
    )
  ) {
    fail(
      `${label} must be a known section string; received ${describeValueType(value)}`,
    );
  }
  return value as DiscordHeroMaterialsExtractionSection;
}

function parsePageInput(value: unknown): {
  section: DiscordHeroMaterialsExtractionSection;
  page: number;
} {
  const input = snapshotExactObject(
    value,
    ["section", "page"],
    "materials-extraction page input",
  );
  return {
    section: requireSection(
      input.section,
      "materials-extraction page input.section",
    ),
    page: nonNegativeSafeInteger(
      input.page,
      "materials-extraction page input.page",
    ),
  };
}

function parseDetailInput(value: unknown): {
  section: DiscordHeroMaterialsExtractionSection;
  rowIndex: number;
} {
  const input = snapshotExactObject(
    value,
    ["section", "rowIndex"],
    "materials-extraction detail input",
  );
  return {
    section: requireSection(
      input.section,
      "materials-extraction detail input.section",
    ),
    rowIndex: nonNegativeSafeInteger(
      input.rowIndex,
      "materials-extraction detail input.rowIndex",
    ),
  };
}

/**
 * One authority snapshot per top-level operation. The construction-time brand
 * guarantees that every descendant came from the pinned loader and index
 * builder; consumers still snapshot their schema-specific fields below.
 */
interface TrustedAuthority {
  readonly catalog: unknown;
  readonly tables: Record<string, unknown>;
  readonly semanticReport: unknown;
}

function snapshotAuthority(indexesValue: unknown): TrustedAuthority {
  const indexes = snapshotExactObject(
    indexesValue,
    ["catalog", "tables", "semanticReport"],
    "materials-extraction indexes",
  );
  return {
    catalog: indexes.catalog,
    tables: snapshotExactObject(
      indexes.tables,
      DISCORD_HERO_DATASET_NAMES,
      "materials-extraction indexes.tables",
    ),
    semanticReport: indexes.semanticReport,
  };
}

function projectTrustedSourceStatModTopology(
  authority: TrustedAuthority,
): ReturnType<typeof projectSourceStatModTopology> {
  const { tables: sourceTables } = authority;
  const trustedTables: Record<string, unknown> = Object.create(null);
  for (const name of DISCORD_HERO_DATASET_NAMES) {
    trustedTables[name] = sourceTables[name];
  }

  for (const definition of SOURCE_TOPOLOGY_TABLES) {
    const label = `materials-extraction topology indexes.tables.${definition.name}`;
    const table = snapshotExactObject(
      sourceTables[definition.name],
      ["name", "primaryField", "rows", "groups"],
      label,
    );
    const rows = snapshotArray(table.rows, `${label}.rows`).map((row, index) =>
      snapshotExactObject(row, definition.fields, `${label}.rows[${index}]`),
    );
    trustedTables[definition.name] = {
      name: table.name,
      primaryField: table.primaryField,
      rows,
      groups: new Map(),
    };
  }

  const semanticReport = snapshotExactObject(
    authority.semanticReport,
    SEMANTIC_REPORT_FIELDS,
    "materials-extraction topology indexes.semanticReport",
  );
  return projectSourceStatModTopology({
    indexes: {
      catalog: authority.catalog,
      tables: trustedTables,
      semanticReport,
    } as unknown as DiscordHeroCatalogIndexes,
  });
}

interface TrustedItemRow {
  readonly id: number;
  readonly name: unknown;
  readonly type: string;
  readonly grade: string;
  readonly slug: string;
}

function snapshotItemRow(
  value: unknown,
  rowIndex: number,
): Record<string, unknown> {
  if (nodeUtilTypes.isProxy(value)) {
    fail(`items row ${rowIndex} must not be a Proxy`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`items row ${rowIndex} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`items row ${rowIndex} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail(`items row ${rowIndex} must not contain symbol own keys`);
  }
  const fields = ownKeys as string[];
  const matchesReviewedPattern = ITEM_ROW_FIELD_PATTERNS.some(
    (pattern) =>
      pattern.length === fields.length &&
      pattern.every((field, index) => field === fields[index]),
  );
  if (!matchesReviewedPattern) {
    fail(`items row ${rowIndex} fields do not match the pinned source row`);
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function" ||
      !("value" in descriptor)
    ) {
      fail(
        `items row ${rowIndex}.${field} must be an enumerable own data property`,
      );
    }
    snapshot[field] = snapshotJsonValue(
      descriptor.value,
      `items row ${rowIndex}.${field}`,
    );
  }
  return snapshot;
}

function captureItemRow(
  row: Record<string, unknown>,
  rowIndex: number,
): TrustedItemRow {
  return {
    id: positiveSafeInteger(row.id, `items row ${rowIndex}.id`),
    name: row.name,
    type: nonemptyString(row.type, `items row ${rowIndex}.type`),
    grade: nonemptyString(row.grade, `items row ${rowIndex}.grade`),
    slug: nonemptyString(row.slug, `items row ${rowIndex}.slug`),
  };
}

function loadItemRows(
  authority: TrustedAuthority,
): ReadonlyMap<number, TrustedItemRow> {
  const { tables } = authority;
  const table = snapshotExactObject(
    tables.items,
    ["name", "primaryField", "rows", "groups"],
    "materials-extraction indexes.tables.items",
  );
  if (table.name !== "items") {
    fail("items.name must be items");
  }
  if (table.primaryField !== "id") {
    fail("items.primaryField must be id");
  }
  const sourceRows = snapshotArray(table.rows, "items.rows");
  const rowSnapshots = sourceRows.map(snapshotItemRow);
  if (sha256(rowSnapshots) !== PINNED_ROW_SHA256.items) {
    fail("items rows do not match the pinned source rows");
  }

  const rowsById = new Map<number, TrustedItemRow>();
  rowSnapshots.forEach((row, rowIndex) => {
    const captured = captureItemRow(row, rowIndex);
    if (rowsById.has(captured.id)) {
      fail(`items.id must be unique; duplicate ${captured.id}`);
    }
    rowsById.set(captured.id, captured);
  });
  return rowsById;
}

function resolveItem(
  itemsById: ReadonlyMap<number, TrustedItemRow>,
  itemKey: number,
): DiscordHeroMaterialItemResolution {
  const row = itemsById.get(itemKey);
  if (row === undefined) {
    return Object.freeze({
      kind: "unresolved-source" as const,
      itemKey,
      reason: `items key ${itemKey} is missing from the source catalog`,
    });
  }

  let localizedName: string | undefined;
  if (typeof row.name === "object" && row.name !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(row.name, "en-US");
    if (
      descriptor !== undefined &&
      "value" in descriptor &&
      typeof descriptor.value === "string" &&
      descriptor.value.length > 0
    ) {
      localizedName = descriptor.value;
    }
  }
  const name = localizedName ?? row.slug;
  if (name.length === 0) {
    return Object.freeze({
      kind: "unresolved-source" as const,
      itemKey,
      reason: `items key ${itemKey} has no en-US localized name or source slug`,
    });
  }
  return Object.freeze({
    kind: "resolved" as const,
    itemKey,
    name,
    type: row.type,
    grade: row.grade,
  });
}

interface TrustedExtractionRow {
  readonly ExtractionKey: number;
  readonly GearGroup: string;
  readonly MATERIALTYPE: string;
  readonly Tier: number;
  readonly Cost: number;
  readonly rowIndex: number;
}

function captureExtractionRow(
  row: unknown,
  rowIndex: number,
): TrustedExtractionRow {
  const snapshot = snapshotExactObject(
    row,
    EXTRACTION_FIELDS,
    `extraction_costs row ${rowIndex}`,
  );
  return {
    ExtractionKey: positiveSafeInteger(
      snapshot.ExtractionKey,
      "extraction_costs.ExtractionKey",
    ),
    GearGroup: nonemptyString(snapshot.GearGroup, "extraction_costs.GearGroup"),
    MATERIALTYPE: nonemptyString(
      snapshot.MATERIALTYPE,
      "extraction_costs.MATERIALTYPE",
    ),
    Tier: positiveSafeInteger(snapshot.Tier, "extraction_costs.Tier"),
    Cost: positiveSafeInteger(snapshot.Cost, "extraction_costs.Cost"),
    rowIndex,
  };
}

function loadExtractionRows(
  authority: TrustedAuthority,
): readonly TrustedExtractionRow[] {
  const { tables } = authority;
  const table = snapshotExactObject(
    tables.extraction_costs,
    ["name", "primaryField", "rows", "groups"],
    "materials-extraction indexes.tables.extraction_costs",
  );
  if (table.name !== "extraction_costs") {
    fail("extraction_costs.name must be extraction_costs");
  }
  if (table.primaryField !== "ExtractionKey") {
    fail("extraction_costs.primaryField must be ExtractionKey");
  }
  const rows = snapshotArray(table.rows, "extraction_costs.rows");
  if (rows.length !== EXPECTED.extraction) {
    fail(
      `extraction_costs must contain exactly ${EXPECTED.extraction} rows; received ${rows.length}`,
    );
  }
  const captured = rows.map((row, index) => captureExtractionRow(row, index));
  const seen = new Set<number>();
  for (const row of captured) {
    if (seen.has(row.ExtractionKey)) {
      fail(
        `extraction_costs.ExtractionKey must be unique; duplicate ${row.ExtractionKey}`,
      );
    }
    seen.add(row.ExtractionKey);
  }
  const normalized = captured.map((row) => ({
    ExtractionKey: row.ExtractionKey,
    GearGroup: row.GearGroup,
    MATERIALTYPE: row.MATERIALTYPE,
    Tier: row.Tier,
    Cost: row.Cost,
  }));
  if (sha256(normalized) !== PINNED_ROW_SHA256.extraction) {
    fail("extraction_costs rows do not match the pinned source rows");
  }
  return captured;
}

function materialRows(
  authority: TrustedAuthority,
): readonly DiscordHeroMaterialsBrowserRow[] {
  const topology = projectTrustedSourceStatModTopology(authority);
  if (topology.materials.length !== EXPECTED.materials) {
    fail(
      `materials topology must contain exactly ${EXPECTED.materials} rows; received ${topology.materials.length}`,
    );
  }
  const itemsById = loadItemRows(authority);
  let none = 0;
  let resolved = 0;
  const rows = topology.materials.map((material, rowIndex) => {
    if (material.statModGroup.kind === "none") none += 1;
    else resolved += 1;
    return Object.freeze({
      section: "materials" as const,
      rowIndex,
      itemKey: material.itemKey,
      materialType: material.materialTypeRaw,
      statModGroup: material.statModGroup,
      topologyProvenance: material.provenance,
      item: resolveItem(itemsById, material.itemKey),
    });
  });
  if (
    none !== EXPECTED.materialsNone ||
    resolved !== EXPECTED.materialsResolved
  ) {
    fail(
      `materials none/resolved split expected ${EXPECTED.materialsNone}/${EXPECTED.materialsResolved}; received ${none}/${resolved}`,
    );
  }
  return Object.freeze(rows);
}

function extractionBrowserRows(
  authority: TrustedAuthority,
): readonly DiscordHeroExtractionBrowserRow[] {
  return Object.freeze(
    loadExtractionRows(authority).map((row) =>
      Object.freeze({
        section: "extraction" as const,
        rowIndex: row.rowIndex,
        extractionKey: row.ExtractionKey,
        gearGroup: row.GearGroup,
        materialType: row.MATERIALTYPE,
        tier: row.Tier,
        cost: row.Cost,
        provenance: Object.freeze({
          table: "extraction_costs" as const,
          primaryField: "ExtractionKey" as const,
          rowIndex: row.rowIndex,
        }),
      }),
    ),
  );
}

const materialRowsCache = new WeakMap<
  object,
  readonly DiscordHeroMaterialsBrowserRow[]
>();
const extractionRowsCache = new WeakMap<
  object,
  readonly DiscordHeroExtractionBrowserRow[]
>();

/**
 * The index builder brands only an exact identity constructed from the pinned,
 * loader-owned catalog. Rejecting before cache lookup keeps caller objects out
 * of both the authority walk and the cache.
 */
function sectionRows(
  indexes: DiscordHeroCatalogIndexes,
  section: DiscordHeroMaterialsExtractionSection,
): readonly DiscordHeroMaterialsExtractionRow[] {
  if (!isDiscordHeroCatalogIndexAuthority(indexes)) {
    fail(
      "materials-extraction requires module-produced trusted catalog indexes",
    );
  }
  const cache =
    section === "materials" ? materialRowsCache : extractionRowsCache;
  const cached = cache.get(indexes);
  if (cached !== undefined) return cached;

  const authority = snapshotAuthority(indexes);
  const rows =
    section === "materials"
      ? materialRows(authority)
      : extractionBrowserRows(authority);
  (cache as WeakMap<object, typeof rows>).set(indexes, rows);
  return rows;
}

function pageCountFor(rowCount: number): number {
  return Math.max(
    1,
    Math.ceil(rowCount / DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE),
  );
}

export function projectDiscordHeroMaterialsExtractionBrowser(
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroMaterialsExtractionBrowser {
  // Touch extraction authority path first so primary/count failures surface.
  sectionRows(indexes, "extraction");
  const materials = sectionRows(indexes, "materials");
  if (materials.length !== EXPECTED.materials) {
    fail(`materials topology must contain exactly ${EXPECTED.materials} rows`);
  }
  const sections = DISCORD_HERO_MATERIALS_EXTRACTION_SECTIONS.map((section) => {
    const rowCount =
      section === "materials" ? EXPECTED.materials : EXPECTED.extraction;
    return Object.freeze({
      section,
      rowCount,
      pageCount: pageCountFor(rowCount),
    });
  });
  if (
    sections[0]!.pageCount !== EXPECTED.materialsPageCount ||
    sections[1]!.pageCount !== EXPECTED.extractionPageCount
  ) {
    fail("materials-extraction page counts diverge from the pinned corpus");
  }
  return deepFreeze({
    sections: Object.freeze(sections),
    disclaimer: DISCORD_HERO_MATERIALS_EXTRACTION_DISCLAIMER,
  });
}

export function discordHeroMaterialsExtractionPageCount(
  indexes: DiscordHeroCatalogIndexes,
  section: DiscordHeroMaterialsExtractionSection,
): number {
  requireSection(section, "materials-extraction section");
  return pageCountFor(sectionRows(indexes, section).length);
}

export function discordHeroMaterialsExtractionPage(
  indexes: DiscordHeroCatalogIndexes,
  pageInput: {
    readonly section: DiscordHeroMaterialsExtractionSection;
    readonly page: number;
  },
): DiscordHeroMaterialsExtractionPage {
  const { section, page } = parsePageInput(pageInput);
  const rows = sectionRows(indexes, section);
  const pageCount = pageCountFor(rows.length);
  if (page >= pageCount) {
    fail(
      `materials-extraction ${section} page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE;
  const slice = rows.slice(
    start,
    start + DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE,
  );
  if (slice.length > DISCORD_HERO_MATERIALS_EXTRACTION_PAGE_SIZE) {
    fail("materials-extraction page exceeded page size 25");
  }
  return deepFreeze({
    section,
    page,
    pageCount,
    rowCount: rows.length,
    rows: Object.freeze([...slice]),
  });
}

export function discordHeroMaterialsExtractionDetail(
  indexes: DiscordHeroCatalogIndexes,
  detailInput: {
    readonly section: DiscordHeroMaterialsExtractionSection;
    readonly rowIndex: number;
  },
): DiscordHeroMaterialsExtractionRow {
  const { section, rowIndex } = parseDetailInput(detailInput);
  const rows = sectionRows(indexes, section);
  if (rowIndex >= rows.length) {
    fail(
      `materials-extraction ${section} row ${rowIndex} is outside 0-${rows.length - 1}`,
    );
  }
  return deepFreeze(structuredClone(rows[rowIndex]!));
}

export function discordHeroMaterialsExtractionTextRows(
  indexes: DiscordHeroCatalogIndexes,
  pageInput: {
    readonly section: DiscordHeroMaterialsExtractionSection;
    readonly page: number;
  },
): readonly string[] {
  const page = discordHeroMaterialsExtractionPage(indexes, pageInput);
  return Object.freeze(
    page.rows.map((row) => {
      if (row.section === "materials") {
        const groupLabel =
          row.statModGroup.kind === "none"
            ? "no-stat-mod-group"
            : `group ${row.statModGroup.rawStatModGroupKey}`;
        const name =
          row.item.kind === "resolved" ? row.item.name : `item#${row.itemKey}`;
        return formatDiscordHeroMaterialsExtractionSafeText(
          `#${row.rowIndex} material ${row.itemKey} · ${name} · ${row.materialType} · ${groupLabel} · source preview`,
        );
      }
      return formatDiscordHeroMaterialsExtractionSafeText(
        `#${row.rowIndex} extraction ${row.extractionKey} · ${row.gearGroup}/${row.materialType} T${row.tier} · cost ${row.cost} · source preview · oracle-gated`,
      );
    }),
  );
}
