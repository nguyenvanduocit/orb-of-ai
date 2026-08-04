import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "../catalog/indexes";

const SOURCE_TABLES = ["drops", "item_groups", "items"] as const;

const PRIMARY_FIELDS = {
  drops: "DropKey",
  item_groups: "ItemGroupKey",
  items: "id",
} as const;

const DROP_ROW_FIELDS = [
  "DropKey",
  "DropType",
  "REWARDTYPE",
  "RewardKey",
  "HeroKeyCondition",
  "Weight",
] as const;

const ITEM_GROUP_ROW_FIELDS = ["ItemGroupKey", "GroupName", "ItemKey"] as const;

const ITEM_CORE_FIELDS = ["id", "grade", "type"] as const;

const UNRESOLVED_REFERENCE_FIELDS = [
  "ruleId",
  "sourceTable",
  "sourceField",
  "sourceKey",
  "targetTable",
  "targetKey",
  "reason",
] as const;

const DROP_TYPES = new Set([
  "EachDropOneWeight",
  "EachDropOneWeight_DLCVariant",
  "SelectOneByClass",
]);

const REWARD_TYPES = new Set(["ITEM", "ITEMGROUP"]);

const EXPECTED = {
  dropRows: 6_303,
  dropKeyGroups: 245,
  itemGroupRows: 2_275,
  itemGroupKeys: 1_118,
  items: 5_944,
  pureWeightedGroups: 157,
  mixedOrConditionalGroups: 88,
  rewardTypes: {
    ITEMGROUP: 6_147,
    ITEM: 156,
  },
  dropTypes: {
    EachDropOneWeight_DLCVariant: 5_257,
    EachDropOneWeight: 1_040,
    SelectOneByClass: 6,
  },
  heroKeyConditions: {
    null: 3_849,
    zero: 496,
    positive: 1_958,
  },
} as const;

export interface DropTopologyInput {
  readonly indexes: DiscordHeroCatalogIndexes;
}

export interface DropTopologyCounts {
  readonly dropRows: 6303;
  readonly dropKeyGroups: 245;
  readonly itemGroupRows: 2275;
  readonly itemGroupKeys: 1118;
  readonly items: 5944;
  readonly pureWeightedGroups: 157;
  readonly mixedOrConditionalGroups: 88;
}

export interface DropTopologyTaxonomy {
  readonly rewardTypes: Readonly<{ ITEMGROUP: 6147; ITEM: 156 }>;
  readonly dropTypes: Readonly<{
    EachDropOneWeight_DLCVariant: 5257;
    EachDropOneWeight: 1040;
    SelectOneByClass: 6;
  }>;
  readonly heroKeyConditions: Readonly<{
    null: 3849;
    zero: 496;
    positive: 1958;
  }>;
}

export interface DropTopologyItemFacts {
  readonly itemKey: number;
  readonly grade: string;
  readonly itemType: string;
}

export type DropTopologyItemResolution =
  | {
      readonly kind: "resolved-item";
      readonly itemKey: number;
      readonly item: DropTopologyItemFacts;
    }
  | {
      readonly kind: "unresolved-source";
      readonly itemKey: number;
      readonly ruleId: string;
      readonly sourceKey: number;
      readonly targetKey: number;
      readonly reason: string;
    };

export interface DropTopologyItemGroupMember {
  readonly itemGroupKey: number;
  readonly groupName: string | null;
  readonly itemKey: number;
  readonly item: DropTopologyItemResolution;
}

export type DropTopologyRewardResolution =
  | {
      readonly kind: "resolved-item";
      readonly itemKey: number;
      readonly item: DropTopologyItemFacts;
    }
  | {
      readonly kind: "resolved-item-group";
      readonly itemGroupKey: number;
      readonly members: readonly DropTopologyItemGroupMember[];
    }
  | {
      readonly kind: "unresolved-source";
      readonly rewardType: "ITEM" | "ITEMGROUP";
      readonly rewardKey: number;
      readonly ruleId: string;
      readonly sourceKey: number;
      readonly targetKey: number;
      readonly reason: string;
    };

export interface DropTopologyRow {
  readonly globalRowIndex: number;
  readonly sourceIndex: number;
  readonly dropKey: number;
  readonly dropTypeRaw: string;
  readonly rewardType: "ITEM" | "ITEMGROUP";
  readonly rewardKey: number;
  readonly heroKeyCondition: number | null;
  readonly weightRaw: number;
  readonly reward: DropTopologyRewardResolution;
}

export type DropGroupClassifier = "pure-weighted" | "mixed-or-conditional";

export interface DropTopologyGroup {
  readonly dropKey: number;
  readonly classifier: DropGroupClassifier;
  readonly rows: readonly DropTopologyRow[];
}

export interface DropTopology {
  readonly counts: DropTopologyCounts;
  readonly taxonomy: DropTopologyTaxonomy;
  readonly groups: readonly DropTopologyGroup[];
}

interface TrustedDropRow {
  readonly DropKey: number;
  readonly DropType: string;
  readonly REWARDTYPE: "ITEM" | "ITEMGROUP";
  readonly RewardKey: number;
  readonly HeroKeyCondition: number | null;
  readonly Weight: number;
  readonly globalRowIndex: number;
}

interface TrustedItemGroupRow {
  readonly ItemGroupKey: number;
  readonly GroupName: string | null;
  readonly ItemKey: number;
}

interface TrustedItemRow {
  readonly id: number;
  readonly grade: string;
  readonly type: string;
}

interface TrustedUnresolvedReference {
  readonly ruleId: string;
  readonly sourceTable: string;
  readonly sourceField: string;
  readonly sourceKey: number;
  readonly targetTable: string;
  readonly targetKey: number;
  readonly reason: string;
}

interface TrustedDropCatalog {
  readonly drops: readonly TrustedDropRow[];
  readonly dropGroups: ReadonlyMap<number, readonly TrustedDropRow[]>;
  readonly dropGroupOrder: readonly number[];
  readonly itemGroups: readonly TrustedItemGroupRow[];
  readonly itemGroupMaps: ReadonlyMap<number, readonly TrustedItemGroupRow[]>;
  readonly items: ReadonlyMap<number, TrustedItemRow>;
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactOwnFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
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
  const descriptors = actualFields.map((field) =>
    Object.getOwnPropertyDescriptor(value, field),
  );
  if (
    descriptors.some(
      (descriptor) =>
        descriptor === undefined ||
        typeof descriptor.get === "function" ||
        typeof descriptor.set === "function",
    )
  ) {
    throw new Error(`${label} must use own data properties without accessors`);
  }
  const unknownFields = actualFields
    .filter((field) => !expectedFields.includes(field))
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
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
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

function snapshotArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype) {
    throw new Error(`${label} must use Array.prototype`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new Error(`${label} has a sparse hole at index ${index}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (
      descriptor === undefined ||
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
 * A table's `groups` value is a DERIVED index, never authority. The projection
 * captures every authoritative drops/item_groups/items row by value before
 * this gate and rebuilds every group and order from those captured rows.
 *
 * Reflect.ownKeys and Object.getOwnPropertyDescriptor may execute a Proxy's
 * metaobject traps. Those traps may force rejection, but any caller-input
 * mutation they perform happens after capture and cannot affect returned
 * output. The descriptor walk invokes none of the ordinary group APIs
 * (get/has/size/entries/keys/values/forEach), own accessors, or own callable
 * values. It rejects own accessors and callables, then discards the derived
 * value. The genuine index keeps its API on a frozen prototype with zero own
 * keys. This boundary validates descriptors rather than prototype identity or
 * duck type.
 */
function assertInertGroupsIndex(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} must be an object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(
        `${label} must not expose caller-supplied accessors; own accessor ${String(key)} found`,
      );
    }
    if (typeof descriptor.value === "function") {
      throw new Error(
        `${label} must not expose caller-supplied executable code; own callable ${String(key)} found`,
      );
    }
  }
}

function captureDropRow(row: unknown, globalRowIndex: number): TrustedDropRow {
  assertExactOwnFields(row, DROP_ROW_FIELDS, "drops row");
  const dropKey = positiveSafeInteger(row.DropKey, "drops.DropKey");
  const dropTypeRaw = knownString(row.DropType, DROP_TYPES, "drops.DropType");
  const rewardType = knownString(
    row.REWARDTYPE,
    REWARD_TYPES,
    "drops.REWARDTYPE",
  ) as "ITEM" | "ITEMGROUP";
  const rewardKey = positiveSafeInteger(row.RewardKey, "drops.RewardKey");
  let heroKeyCondition: number | null;
  if (row.HeroKeyCondition === null) {
    heroKeyCondition = null;
  } else if (row.HeroKeyCondition === 0) {
    heroKeyCondition = 0;
  } else {
    heroKeyCondition = positiveSafeInteger(
      row.HeroKeyCondition,
      "drops.HeroKeyCondition",
    );
  }
  const weight = nonNegativeSafeInteger(row.Weight, "drops.Weight");
  return {
    DropKey: dropKey,
    DropType: dropTypeRaw,
    REWARDTYPE: rewardType,
    RewardKey: rewardKey,
    HeroKeyCondition: heroKeyCondition,
    Weight: weight,
    globalRowIndex,
  };
}

function captureItemGroupRow(row: unknown): TrustedItemGroupRow {
  assertExactOwnFields(row, ITEM_GROUP_ROW_FIELDS, "item_groups row");
  return {
    ItemGroupKey: positiveSafeInteger(
      row.ItemGroupKey,
      "item_groups.ItemGroupKey",
    ),
    GroupName:
      row.GroupName === null
        ? null
        : nonemptyString(row.GroupName, "item_groups.GroupName"),
    ItemKey: positiveSafeInteger(row.ItemKey, "item_groups.ItemKey"),
  };
}

function captureItemRow(row: unknown): TrustedItemRow {
  assertRecord(row, "items row");
  const prototype = Object.getPrototypeOf(row);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("items row prototype must be Object.prototype or null");
  }
  const ownKeys = Reflect.ownKeys(row);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error("items row must not contain symbol own keys");
  }
  for (const field of ITEM_CORE_FIELDS) {
    if (!Object.hasOwn(row, field)) {
      throw new Error(`items row is missing field ${field}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(row, field);
    if (
      descriptor === undefined ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`items row.${field} must be an own data property`);
    }
  }
  return {
    id: positiveSafeInteger(row.id, "items.id"),
    grade: nonemptyString(row.grade, "items.grade"),
    type: nonemptyString(row.type, "items.type"),
  };
}

/**
 * The pinned catalog declares ZERO unresolved references for the three joins
 * this projection depends on. An entry naming one of them is therefore not
 * catalog provenance -- it is caller-supplied authority that would let a forged
 * tuple plus a forged reason turn a missing join into an "explained" output.
 * Any such entry is rejected, so a missing relevant join always fails closed.
 */
const TOPOLOGY_RELEVANT_RULE_IDS: ReadonlySet<string> = new Set([
  "drops.RewardKey[ITEM]->items",
  "drops.RewardKey[ITEMGROUP]->item_groups",
  "item_groups.ItemKey->items",
]);

function captureUnresolvedReference(
  value: unknown,
): TrustedUnresolvedReference {
  assertExactOwnFields(
    value,
    UNRESOLVED_REFERENCE_FIELDS,
    "unresolved reference",
  );
  const sourceTable = nonemptyString(
    value.sourceTable,
    "unresolved reference sourceTable",
  );
  const targetTable = nonemptyString(
    value.targetTable,
    "unresolved reference targetTable",
  );
  if (
    !(DISCORD_HERO_DATASET_NAMES as readonly string[]).includes(sourceTable) ||
    !(DISCORD_HERO_DATASET_NAMES as readonly string[]).includes(targetTable)
  ) {
    throw new Error(
      "unresolved reference tables must be catalog dataset names",
    );
  }
  const ruleId = nonemptyString(value.ruleId, "unresolved reference ruleId");
  if (TOPOLOGY_RELEVANT_RULE_IDS.has(ruleId)) {
    throw new Error(
      `topology-relevant unresolved reference ${ruleId} is not caller authority and is rejected`,
    );
  }
  return {
    ruleId,
    sourceTable,
    sourceField: nonemptyString(
      value.sourceField,
      "unresolved reference sourceField",
    ),
    sourceKey: positiveSafeInteger(
      value.sourceKey,
      "unresolved reference sourceKey",
    ),
    targetTable,
    targetKey: positiveSafeInteger(
      value.targetKey,
      "unresolved reference targetKey",
    ),
    reason: nonemptyString(value.reason, "unresolved reference reason"),
  };
}

function rebuildGroupsFromRows<Row>(
  rows: readonly Row[],
  primary: (row: Row) => number,
  label: string,
  expectedGroupCount: number,
): {
  readonly order: readonly number[];
  readonly groups: ReadonlyMap<number, readonly Row[]>;
} {
  const order: number[] = [];
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const key = primary(row);
    let bucket = groups.get(key);
    if (bucket === undefined) {
      bucket = [];
      groups.set(key, bucket);
      order.push(key);
    }
    bucket.push(row);
  }
  if (groups.size !== expectedGroupCount) {
    throw new Error(
      `${label} must contain exactly ${expectedGroupCount} groups, received ${groups.size}`,
    );
  }
  return { order, groups };
}

function buildTrustedCatalog(
  indexes: DiscordHeroCatalogIndexes,
): TrustedDropCatalog {
  assertExactOwnFields(
    indexes,
    ["catalog", "tables", "semanticReport"],
    "drop topology indexes",
  );
  const tables = snapshotOwnDataProperty(
    indexes,
    "tables",
    "drop topology indexes",
  );
  assertRecord(tables, "drop topology indexes.tables");
  const tablesPrototype = Object.getPrototypeOf(tables);
  if (tablesPrototype !== Object.prototype && tablesPrototype !== null) {
    throw new Error(
      "drop topology indexes.tables prototype must be Object.prototype or null",
    );
  }
  const tableNames = Object.keys(tables).sort();
  const expectedNames = [...DISCORD_HERO_DATASET_NAMES].sort();
  if (
    tableNames.length !== expectedNames.length ||
    tableNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new Error(
      "drop topology indexes.tables must contain exactly the canonical 45 tables",
    );
  }

  /**
   * Phase 1 -- read one AUTHORITATIVE table's scalars and its row array. The
   * derived `groups` value stays untouched because inspection may execute Proxy
   * metaobject traps. All three row arrays are snapshotted first, then every row
   * is captured by value before Phase 2 inspects any derived container.
   */
  const readAuthoritativeTable = (name: (typeof SOURCE_TABLES)[number]) => {
    const table = snapshotOwnDataProperty(
      tables,
      name,
      "drop topology indexes.tables",
    );
    assertExactOwnFields(
      table,
      ["name", "primaryField", "rows", "groups"],
      `drop topology indexes.tables.${name}`,
    );
    const tableName = snapshotOwnDataProperty(
      table,
      "name",
      `drop topology indexes.tables.${name}`,
    );
    const primaryField = snapshotOwnDataProperty(
      table,
      "primaryField",
      `drop topology indexes.tables.${name}`,
    );
    if (tableName !== name) {
      throw new Error(
        `drop topology indexes.tables.${name}.name must be ${name}`,
      );
    }
    if (primaryField !== PRIMARY_FIELDS[name]) {
      throw new Error(
        `drop topology indexes.tables.${name}.primaryField must be ${PRIMARY_FIELDS[name]}`,
      );
    }
    const rows = snapshotArray(
      snapshotOwnDataProperty(
        table,
        "rows",
        `drop topology indexes.tables.${name}`,
      ),
      `drop topology indexes.tables.${name}.rows`,
    );
    return { table, rows };
  };

  const dropsTable = readAuthoritativeTable("drops");
  const itemGroupsTable = readAuthoritativeTable("item_groups");
  const itemsTable = readAuthoritativeTable("items");

  if (dropsTable.rows.length !== EXPECTED.dropRows) {
    throw new Error(
      `drops must contain exactly ${EXPECTED.dropRows} rows, received ${dropsTable.rows.length}`,
    );
  }
  if (itemGroupsTable.rows.length !== EXPECTED.itemGroupRows) {
    throw new Error(
      `item_groups must contain exactly ${EXPECTED.itemGroupRows} rows, received ${itemGroupsTable.rows.length}`,
    );
  }
  if (itemsTable.rows.length !== EXPECTED.items) {
    throw new Error(
      `items must contain exactly ${EXPECTED.items} rows, received ${itemsTable.rows.length}`,
    );
  }

  const drops = dropsTable.rows.map((row, index) => captureDropRow(row, index));
  const itemGroups = itemGroupsTable.rows.map((row) =>
    captureItemGroupRow(row),
  );
  const itemList = itemsTable.rows.map((row) => captureItemRow(row));
  const itemIds = itemList.map((item) => item.id);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("items.id must be unique");
  }

  /**
   * Phase 2 -- only now inspect the DERIVED groups indexes.
   *
   * The descriptor walk may run a Proxy's ownKeys and
   * getOwnPropertyDescriptor traps. Every authoritative drops/item_groups/items
   * row above is already captured by value, so caller-input mutations are too
   * late to affect returned output. Ordinary group APIs and own
   * accessor/callable values remain uninvoked. `groups` is validated for the
   * rejection it performs and then discarded; every group and order below is
   * rebuilt from the captured rows.
   */
  for (const [name, table] of [
    ["drops", dropsTable.table],
    ["item_groups", itemGroupsTable.table],
    ["items", itemsTable.table],
  ] as const) {
    assertInertGroupsIndex(
      snapshotOwnDataProperty(
        table,
        "groups",
        `drop topology indexes.tables.${name}`,
      ),
      `drop topology indexes.tables.${name}.groups`,
    );
  }

  const rebuiltDrops = rebuildGroupsFromRows(
    drops,
    (row) => row.DropKey,
    "drops",
    EXPECTED.dropKeyGroups,
  );

  const rebuiltItemGroups = rebuildGroupsFromRows(
    itemGroups,
    (row) => row.ItemGroupKey,
    "item_groups",
    EXPECTED.itemGroupKeys,
  );

  const items = new Map<number, TrustedItemRow>();
  for (const item of itemList) {
    items.set(item.id, item);
  }

  const semanticReport = snapshotOwnDataProperty(
    indexes,
    "semanticReport",
    "drop topology indexes",
  );
  assertRecord(semanticReport, "drop topology indexes.semanticReport");
  const reportPrototype = Object.getPrototypeOf(semanticReport);
  if (reportPrototype !== Object.prototype && reportPrototype !== null) {
    throw new Error(
      "drop topology indexes.semanticReport prototype must be Object.prototype or null",
    );
  }
  for (const key of Reflect.ownKeys(semanticReport)) {
    const descriptor = Object.getOwnPropertyDescriptor(semanticReport, key);
    if (
      descriptor !== undefined &&
      (typeof descriptor.get === "function" ||
        typeof descriptor.set === "function")
    ) {
      throw new Error(
        `drop topology indexes.semanticReport must use own data properties without accessors; own accessor ${String(key)} found`,
      );
    }
  }
  const unresolvedRaw = snapshotArray(
    snapshotOwnDataProperty(
      semanticReport,
      "unresolvedReferences",
      "drop topology indexes.semanticReport",
    ),
    "drop topology indexes.semanticReport.unresolvedReferences",
  );
  // Validated for the rejection it performs, not for a value we keep: any
  // topology-relevant entry throws here, and nothing else is consulted.
  for (const reference of unresolvedRaw) captureUnresolvedReference(reference);

  return {
    drops,
    dropGroups: rebuiltDrops.groups,
    dropGroupOrder: rebuiltDrops.order,
    itemGroups,
    itemGroupMaps: rebuiltItemGroups.groups,
    items,
  };
}

function classifyGroup(rows: readonly TrustedDropRow[]): DropGroupClassifier {
  const pure = rows.every(
    (row) =>
      row.DropType === "EachDropOneWeight" && row.HeroKeyCondition === null,
  );
  return pure ? "pure-weighted" : "mixed-or-conditional";
}

function resolveItemFacts(
  catalog: TrustedDropCatalog,
  itemKey: number,
  ruleId: string,
  sourceTable: DiscordHeroDatasetName,
  sourceField: string,
  sourceKey: number,
): Extract<DropTopologyItemResolution, { kind: "resolved-item" }> {
  const item = catalog.items.get(itemKey);
  if (item === undefined) {
    // Fails closed: the catalog declares no unresolved reference for this
    // join, and a caller-supplied one is rejected before we get here.
    throw new Error(
      `items key ${itemKey} is missing and is not a catalog-declared unresolved limitation (rule ${ruleId} from ${sourceTable}.${sourceField} ${sourceKey})`,
    );
  }
  return Object.freeze({
    kind: "resolved-item" as const,
    itemKey,
    item: Object.freeze({
      itemKey: item.id,
      grade: item.grade,
      itemType: item.type,
    }),
  });
}

function resolveReward(
  catalog: TrustedDropCatalog,
  dropKey: number,
  rewardType: "ITEM" | "ITEMGROUP",
  rewardKey: number,
): DropTopologyRewardResolution {
  if (rewardType === "ITEM") {
    const resolution = resolveItemFacts(
      catalog,
      rewardKey,
      "drops.RewardKey[ITEM]->items",
      "drops",
      "RewardKey",
      dropKey,
    );
    return Object.freeze({
      kind: "resolved-item" as const,
      itemKey: resolution.itemKey,
      item: resolution.item,
    });
  }

  const members = catalog.itemGroupMaps.get(rewardKey);
  if (members === undefined || members.length === 0) {
    // Fails closed for the same reason as the ITEM join above.
    throw new Error(
      `item group ${rewardKey} is missing and is not a catalog-declared unresolved limitation (drop ${dropKey})`,
    );
  }

  const projectedMembers = members.map((member) => {
    if (member.ItemGroupKey !== rewardKey) {
      throw new Error(
        `item group ${rewardKey} contains group key ${member.ItemGroupKey}`,
      );
    }
    return Object.freeze({
      itemGroupKey: member.ItemGroupKey,
      groupName: member.GroupName,
      itemKey: member.ItemKey,
      item: resolveItemFacts(
        catalog,
        member.ItemKey,
        "item_groups.ItemKey->items",
        "item_groups",
        "ItemKey",
        member.ItemGroupKey,
      ),
    });
  });

  return Object.freeze({
    kind: "resolved-item-group" as const,
    itemGroupKey: rewardKey,
    members: Object.freeze(projectedMembers),
  });
}

export function projectDropTopology(input: DropTopologyInput): DropTopology {
  assertExactOwnFields(input, ["indexes"], "drop topology input");
  const indexes = snapshotOwnDataProperty(
    input,
    "indexes",
    "drop topology input",
  ) as DiscordHeroCatalogIndexes;
  const catalog = buildTrustedCatalog(indexes);

  const taxonomy = {
    rewardTypes: { ITEMGROUP: 0, ITEM: 0 },
    dropTypes: {
      EachDropOneWeight_DLCVariant: 0,
      EachDropOneWeight: 0,
      SelectOneByClass: 0,
    },
    heroKeyConditions: { null: 0, zero: 0, positive: 0 },
  };

  let pureWeightedGroups = 0;
  let mixedOrConditionalGroups = 0;

  const groups: DropTopologyGroup[] = catalog.dropGroupOrder.map((dropKey) => {
    const sourceRows = catalog.dropGroups.get(dropKey);
    if (sourceRows === undefined) {
      throw new Error(`drops group ${dropKey} is missing from trusted map`);
    }
    const classifier = classifyGroup(sourceRows);
    if (classifier === "pure-weighted") pureWeightedGroups += 1;
    else mixedOrConditionalGroups += 1;

    const rows = sourceRows.map((row, sourceIndex) => {
      taxonomy.rewardTypes[row.REWARDTYPE] += 1;
      taxonomy.dropTypes[row.DropType as keyof typeof taxonomy.dropTypes] += 1;
      if (row.HeroKeyCondition === null) taxonomy.heroKeyConditions.null += 1;
      else if (row.HeroKeyCondition === 0) taxonomy.heroKeyConditions.zero += 1;
      else taxonomy.heroKeyConditions.positive += 1;

      return Object.freeze({
        globalRowIndex: row.globalRowIndex,
        sourceIndex,
        dropKey: row.DropKey,
        dropTypeRaw: row.DropType,
        rewardType: row.REWARDTYPE,
        rewardKey: row.RewardKey,
        heroKeyCondition: row.HeroKeyCondition,
        weightRaw: row.Weight,
        reward: resolveReward(
          catalog,
          row.DropKey,
          row.REWARDTYPE,
          row.RewardKey,
        ),
      });
    });

    return Object.freeze({
      dropKey,
      classifier,
      rows: Object.freeze(rows),
    });
  });

  if (
    pureWeightedGroups !== EXPECTED.pureWeightedGroups ||
    mixedOrConditionalGroups !== EXPECTED.mixedOrConditionalGroups
  ) {
    throw new Error(
      `drop topology classifier expected ${EXPECTED.pureWeightedGroups} pure and ${EXPECTED.mixedOrConditionalGroups} mixed groups`,
    );
  }
  if (
    taxonomy.rewardTypes.ITEM !== EXPECTED.rewardTypes.ITEM ||
    taxonomy.rewardTypes.ITEMGROUP !== EXPECTED.rewardTypes.ITEMGROUP ||
    taxonomy.dropTypes.EachDropOneWeight !==
      EXPECTED.dropTypes.EachDropOneWeight ||
    taxonomy.dropTypes.EachDropOneWeight_DLCVariant !==
      EXPECTED.dropTypes.EachDropOneWeight_DLCVariant ||
    taxonomy.dropTypes.SelectOneByClass !==
      EXPECTED.dropTypes.SelectOneByClass ||
    taxonomy.heroKeyConditions.null !== EXPECTED.heroKeyConditions.null ||
    taxonomy.heroKeyConditions.zero !== EXPECTED.heroKeyConditions.zero ||
    taxonomy.heroKeyConditions.positive !== EXPECTED.heroKeyConditions.positive
  ) {
    throw new Error("drop topology taxonomy diverges from the pinned corpus");
  }

  return deepFreeze({
    counts: {
      dropRows: EXPECTED.dropRows,
      dropKeyGroups: EXPECTED.dropKeyGroups,
      itemGroupRows: EXPECTED.itemGroupRows,
      itemGroupKeys: EXPECTED.itemGroupKeys,
      items: EXPECTED.items,
      pureWeightedGroups: EXPECTED.pureWeightedGroups,
      mixedOrConditionalGroups: EXPECTED.mixedOrConditionalGroups,
    },
    taxonomy: {
      rewardTypes: {
        ITEMGROUP: EXPECTED.rewardTypes.ITEMGROUP,
        ITEM: EXPECTED.rewardTypes.ITEM,
      },
      dropTypes: {
        EachDropOneWeight_DLCVariant:
          EXPECTED.dropTypes.EachDropOneWeight_DLCVariant,
        EachDropOneWeight: EXPECTED.dropTypes.EachDropOneWeight,
        SelectOneByClass: EXPECTED.dropTypes.SelectOneByClass,
      },
      heroKeyConditions: {
        null: EXPECTED.heroKeyConditions.null,
        zero: EXPECTED.heroKeyConditions.zero,
        positive: EXPECTED.heroKeyConditions.positive,
      },
    },
    groups: Object.freeze(groups),
  });
}
