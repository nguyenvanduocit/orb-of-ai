import { createHash } from "node:crypto";
import {
  mkdir,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const SOURCE_MANIFEST_PATH = "preferences/taskbarhero/manifest.json";
export const CURRENT_VERSION_FILE = "current-version";
export const SOURCE_MANIFEST_SHA256 =
  "75b4f2e2643ddc93fc9d0a383b03f8404e6133622be35ed8716bbf3ad4e22be2";
export const SOURCE_CATALOG_SHA256 =
  "186d90e9d1caf1be28d0480e760c082ea434a80588ed76f97c1b4f1fed2b9d12";

// These pins are intentionally updated only after a reviewed source refresh.
export const SOURCE_LOCK_SHA256 =
  "8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1";
export const MONSTER_DETAILS_SHA256 =
  "7211c8fcfda8a82d02f4336dffdf193ed1202c836013e4f398e10f2c67ba3a48";
export const COMPILED_PAYLOAD_SHA256 =
  "6d876909b7df8bac0217a15b98bb11e56c26417b4c3fc5d13d15696bc7719704";
export const COMPILED_FILE_SHA256 =
  "2a046b2b0f5c1ddff451dddadf13a7b9c8d6d112b1c6455ccda59f2af9e879f2";

export const EXPECTED_DATASET_ROWS = {
  attribute_groups: 8,
  attributes: 132,
  buff_groups: 16,
  buffs: 29,
  crafting_recipes: 56,
  cube_levels: 100,
  cube_recipes: 8,
  cube_sub_recipes: 31,
  currencies: 1,
  drops: 6_303,
  extraction_costs: 90,
  gear: 5_760,
  gear_type_scales: 20,
  gear_types: 16,
  grades: 10,
  heroes: 6,
  inventory: 260,
  item_groups: 2_275,
  item_level_scales: 19,
  item_type_scales: 2,
  items: 5_944,
  levels: 100,
  materials: 125,
  monsters: 61,
  offline_rewards: 116,
  passive_skills: 108,
  pet_stats: 11,
  pets: 8,
  rune_levels: 663,
  runes: 197,
  skill_levels: 360,
  skills: 106,
  skins: 100,
  sounds: 312,
  stage_levels: 170,
  stages: 120,
  stash: 131,
  stat_mod_groups: 474,
  stat_mods: 620,
  status_effects: 6,
  storage: 101,
  synthesis_drops: 203,
  synthesis_recipes: 533,
  trading_stash: 10,
  unique_mods: 36,
} as const;

const EXPECTED_DATASETS = 45;
const EXPECTED_ROWS = 25_757;
const EXPECTED_MONSTER_DETAILS = 61;
const EXPECTED_MONSTER_ENRICHMENTS = 33;
const CURATED_ITEMS_COLUMNS = [
  "id",
  "name",
  "grade",
  "type",
  "gear",
  "level",
  "icon",
  "affix",
  "slug",
  "deleted",
  "marketable",
] as const;

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = {
  readonly [key: string]: JsonValue;
};

interface SourceCatalogEntry {
  name: string;
  label: string;
  group: string;
  rows: number;
  columns: string[];
  database_path: string;
  route: string | null;
}

interface SourceDatasetMetadata {
  source_url: string;
  data_url: string;
  rows: number;
  columns: number;
  schema_contract: string;
  declared_columns: number;
  actual_columns: number;
  common_columns: number;
  extra_columns: string[];
  sha256: string;
}

interface SourceManifest {
  catalog_coverage: {
    required: number;
    written: number;
    skipped: number;
    failed: number;
    missing: number;
    terminal_complete: boolean;
    export_complete: boolean;
  };
  catalog_inventory: {
    datasets: number;
    total_rows: number;
    sha256: string;
    entries: SourceCatalogEntry[];
  };
  datasets: SourceDatasetMetadata[];
}

interface RawCatalogEntry {
  name: string;
  label: string;
  group: string;
  rows: number;
  columns: string[];
  route: string | null;
}

export type SourceLockDataset = DeepReadonly<{
  name: string;
  path: string;
  dataUrl: string;
  sha256: string;
  rows: number;
  columns: string[];
  commonColumns: string[];
}>;

export type SourceLockMonsterDetail = DeepReadonly<{
  monsterKey: number;
  path: string;
  sha256: string;
}>;

export type StageBoxKind = "NORMAL" | "STAGE_BOSS" | "ACT_BOSS";

export type StageBoxDropKeyMapping = DeepReadonly<{
  boxKind: StageBoxKind;
  itemId: number;
  dropKey: number;
  sourcePath: string;
  itemRecordSha256: string;
  detailRecordSha256: string;
}>;

export type SourceLockStageBoxDropKeys = DeepReadonly<{
  path: "stage-box-drop-keys.json";
  count: number;
  distinctDropKeyCount: number;
  inventoryAggregateSha256: string;
  mappingAggregateSha256: string;
  sha256: string;
}>;

export type DiscordHeroSourceLock = DeepReadonly<{
  format: "discordhero-source-lock/v1";
  manifestSha256: string;
  catalog: {
    path: "catalog.json";
    sha256: string;
    datasets: number;
  };
  datasets: SourceLockDataset[];
  monsterDetails: {
    count: number;
    aggregateSha256: string;
    files: SourceLockMonsterDetail[];
  };
  // Absent in the reviewed v1 generation, which stays a recovery authority;
  // required in every staged or published v2 generation.
  stageBoxDropKeys?: SourceLockStageBoxDropKeys;
}>;

export type DiscordHeroDataset = DeepReadonly<{
  name: string;
  label: string;
  group: string;
  route: string | null;
  sourceUrl: string;
  dataUrl: string;
  sourceSha256: string;
  schemaContract: string;
  declaredColumns: string[];
  columns: string[];
  commonColumns: string[];
  rows: JsonObject[];
}>;

export type MonsterAttackEnrichment = DeepReadonly<{
  MonsterKey: number;
  sourceSha256: string;
  attack: JsonObject;
  attacks: JsonObject[];
  attackElements: string[];
}>;

export type DiscordHeroCatalog = DeepReadonly<{
  format: "discordhero-catalog/v2";
  provenance: {
    sourceManifest: typeof SOURCE_MANIFEST_PATH;
    sourceManifestSha256: string;
    sourceCatalogSha256: string;
    sourceLockSha256: string;
    compiledSha256: string;
  };
  totals: {
    datasets: number;
    rows: number;
  };
  datasets: DiscordHeroDataset[];
  semantic: {
    monsterAttacks: {
      provenance: {
        sourceCount: number;
        enrichedCount: number;
        sourceAggregateSha256: string;
      };
      enrichments: MonsterAttackEnrichment[];
    };
    stageBoxDropKeys?: {
      provenance: {
        sourceCount: number;
        distinctDropKeyCount: number;
        inventoryAggregateSha256: string;
        sourceAggregateSha256: string;
        sourceArtifactSha256: string;
      };
      mappings: StageBoxDropKeyMapping[];
    };
  };
}>;

type UnsignedDiscordHeroCatalog = Omit<DiscordHeroCatalog, "provenance"> & {
  provenance: Omit<DiscordHeroCatalog["provenance"], "compiledSha256">;
};

interface InspectedRawSource {
  manifest: SourceManifest;
  sourceLock: DiscordHeroSourceLock;
  sourceLockBytes: string;
  rowsByName: Map<string, JsonObject[]>;
  detailByMonsterKey: Map<number, { record: JsonObject; sha256: string }>;
  stageBoxMappings: StageBoxDropKeyMapping[] | null;
}

function fail(message: string): never {
  throw new Error(`DiscordHero catalog: ${message}`);
}

const STAGE_BOX_ARTIFACT_PATH = "stage-box-drop-keys.json";
const STAGE_BOX_KINDS = new Set<string>(["NORMAL", "STAGE_BOSS", "ACT_BOSS"]);

/**
 * Reads the Stage Box aggregate a refresh extracted, and proves it still
 * describes the raw items beside it. A generation without the artifact is the
 * reviewed v1, which stays valid as a recovery authority.
 */
async function inspectStageBoxDropKeys(
  rawDataRoot: string,
  rowsByName: Map<string, JsonObject[]>,
): Promise<{
  field: SourceLockStageBoxDropKeys;
  mappings: StageBoxDropKeyMapping[];
} | null> {
  const artifactPath = join(rawDataRoot, STAGE_BOX_ARTIFACT_PATH);
  let bytes: string;
  try {
    bytes = await readFile(artifactPath, "utf8");
  } catch {
    return null;
  }

  let artifact: unknown;
  try {
    artifact = JSON.parse(bytes);
  } catch (error) {
    fail(`${STAGE_BOX_ARTIFACT_PATH} is invalid JSON: ${String(error)}`);
  }
  requireCondition(
    isRecord(artifact) &&
      artifact.format === "discordhero-stage-box-drop-keys/v1" &&
      typeof artifact.inventoryAggregateSha256 === "string" &&
      Array.isArray(artifact.mappings),
    `${STAGE_BOX_ARTIFACT_PATH} is not a Stage Box aggregate`,
  );
  const record = artifact as {
    inventoryAggregateSha256: string;
    mappings: unknown[];
  };
  requireCondition(
    Object.keys(record).length === 3,
    `${STAGE_BOX_ARTIFACT_PATH} carries unexpected top-level keys`,
  );

  const itemRows = rowsByName.get("items");
  requireCondition(
    itemRows !== undefined,
    "raw items dataset is missing for Stage Box validation",
  );
  const stageBoxItemIds = new Set(
    itemRows!
      .filter((row) => row.type === "STAGEBOX")
      .map((row) => row.id as number),
  );

  const seenItemIds = new Set<number>();
  const mappings: StageBoxDropKeyMapping[] = [];
  for (const [index, entry] of record.mappings.entries()) {
    requireCondition(
      isRecord(entry) && Object.keys(entry).length === 6,
      `${STAGE_BOX_ARTIFACT_PATH} mapping ${index} has unexpected keys`,
    );
    const mapping = entry as unknown as StageBoxDropKeyMapping;
    requireCondition(
      STAGE_BOX_KINDS.has(mapping.boxKind) &&
        Number.isSafeInteger(mapping.itemId) &&
        mapping.itemId > 0 &&
        Number.isSafeInteger(mapping.dropKey) &&
        mapping.dropKey > 0 &&
        typeof mapping.sourcePath === "string" &&
        /^items\/[A-Za-z0-9._-]+\.md$/.test(mapping.sourcePath) &&
        /^[0-9a-f]{64}$/.test(mapping.itemRecordSha256) &&
        /^[0-9a-f]{64}$/.test(mapping.detailRecordSha256),
      `${STAGE_BOX_ARTIFACT_PATH} mapping ${index} is malformed`,
    );
    requireCondition(
      !seenItemIds.has(mapping.itemId),
      `${STAGE_BOX_ARTIFACT_PATH} repeats item ${mapping.itemId}`,
    );
    requireCondition(
      index === 0 ||
        mapping.itemId >
          (record.mappings[index - 1] as StageBoxDropKeyMapping).itemId,
      `${STAGE_BOX_ARTIFACT_PATH} is not sorted by item id`,
    );
    requireCondition(
      stageBoxItemIds.has(mapping.itemId),
      `${STAGE_BOX_ARTIFACT_PATH} names item ${mapping.itemId}, which is not a raw STAGEBOX`,
    );
    seenItemIds.add(mapping.itemId);
    mappings.push(mapping);
  }

  // Bidirectional: every raw STAGEBOX is mapped, and nothing else is.
  requireCondition(
    seenItemIds.size === stageBoxItemIds.size,
    `${STAGE_BOX_ARTIFACT_PATH} covers ${seenItemIds.size} of ${stageBoxItemIds.size} raw STAGEBOX items`,
  );

  const dropKeys = rowsByName.get("drops");
  requireCondition(dropKeys !== undefined, "raw drops dataset is missing");
  const knownDropKeys = new Set(dropKeys!.map((row) => row.DropKey as number));
  for (const mapping of mappings) {
    requireCondition(
      knownDropKeys.has(mapping.dropKey),
      `${STAGE_BOX_ARTIFACT_PATH} names unknown DropKey ${mapping.dropKey}`,
    );
  }

  const field: SourceLockStageBoxDropKeys = {
    path: STAGE_BOX_ARTIFACT_PATH,
    count: mappings.length,
    distinctDropKeyCount: new Set(mappings.map((row) => row.dropKey)).size,
    inventoryAggregateSha256: record.inventoryAggregateSha256,
    mappingAggregateSha256: sha256(JSON.stringify(mappings)),
    sha256: sha256(bytes),
  };
  return { field, mappings };
}

function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value);
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(bytes: string, sourceName: string): unknown {
  try {
    return JSON.parse(bytes);
  } catch (error) {
    fail(
      `${sourceName} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function arraysEqual(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function datasetNameFromDataUrl(dataUrl: string): string {
  return basename(dataUrl, ".json");
}

function inspectSchema(rows: readonly JsonObject[]): {
  columns: string[];
  commonColumns: string[];
} {
  const columns: string[] = [];
  const seen = new Set<string>();
  let commonColumns = rows.length === 0 ? [] : Object.keys(rows[0]!);

  for (const row of rows) {
    const keys = Object.keys(row);
    for (const key of keys) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
    commonColumns = commonColumns.filter((key) => Object.hasOwn(row, key));
  }

  return { columns, commonColumns };
}

async function readPinnedManifest(
  projectRoot: string,
): Promise<SourceManifest> {
  const manifestPath = join(projectRoot, SOURCE_MANIFEST_PATH);
  const bytes = await readFile(manifestPath, "utf8");
  requireCondition(
    sha256(bytes) === SOURCE_MANIFEST_SHA256,
    `source manifest SHA-256 mismatch at ${SOURCE_MANIFEST_PATH}`,
  );
  const value = parseJson(bytes, SOURCE_MANIFEST_PATH);
  requireCondition(isRecord(value), "source manifest must be an object");
  requireCondition(
    isRecord(value.catalog_inventory),
    "source manifest catalog_inventory is missing",
  );
  requireCondition(
    Array.isArray(value.catalog_inventory.entries),
    "source inventory entries are missing",
  );
  requireCondition(
    Array.isArray(value.datasets),
    "source manifest datasets are missing",
  );
  requireCondition(
    isRecord(value.catalog_coverage),
    "source manifest catalog_coverage is missing",
  );
  return value as unknown as SourceManifest;
}

function validateManifest(manifest: SourceManifest): void {
  const inventory = manifest.catalog_inventory;
  const coverage = manifest.catalog_coverage;

  requireCondition(
    inventory.sha256 === SOURCE_CATALOG_SHA256,
    `source catalog SHA-256 changed: ${inventory.sha256}`,
  );
  requireCondition(
    inventory.datasets === EXPECTED_DATASETS &&
      inventory.entries.length === EXPECTED_DATASETS &&
      manifest.datasets.length === EXPECTED_DATASETS,
    `source manifest must declare ${EXPECTED_DATASETS} datasets`,
  );
  requireCondition(
    inventory.total_rows === EXPECTED_ROWS,
    `source manifest must declare ${EXPECTED_ROWS} rows`,
  );
  requireCondition(
    coverage.required === EXPECTED_DATASETS &&
      coverage.written === EXPECTED_DATASETS &&
      coverage.skipped === 0 &&
      coverage.failed === 0 &&
      coverage.missing === 0 &&
      coverage.terminal_complete === true &&
      coverage.export_complete === true,
    "source catalog coverage is not terminal and complete",
  );

  const names = inventory.entries.map((entry) => entry.name);
  requireCondition(
    new Set(names).size === EXPECTED_DATASETS,
    "source manifest dataset names repeat",
  );
  requireCondition(
    arraysEqual(names, Object.keys(EXPECTED_DATASET_ROWS)),
    "source manifest dataset order differs from the pinned inventory",
  );
  for (const entry of inventory.entries) {
    const expectedRows =
      EXPECTED_DATASET_ROWS[entry.name as keyof typeof EXPECTED_DATASET_ROWS];
    requireCondition(
      expectedRows !== undefined,
      `unexpected source dataset ${entry.name}`,
    );
    requireCondition(
      entry.rows === expectedRows,
      `${entry.name} must contain ${expectedRows} rows, not ${entry.rows}`,
    );
  }
}

function validateRawCatalog(
  rawCatalog: unknown,
  manifest: SourceManifest,
): Map<string, RawCatalogEntry> {
  requireCondition(Array.isArray(rawCatalog), "raw catalog must be an array");
  requireCondition(
    rawCatalog.length === EXPECTED_DATASETS,
    "raw catalog must contain 45 entries",
  );
  const catalogByName = new Map<string, RawCatalogEntry>();
  for (const value of rawCatalog) {
    requireCondition(
      isRecord(value),
      "raw catalog contains a non-object entry",
    );
    const entry = value as unknown as RawCatalogEntry;
    requireCondition(
      typeof entry.name === "string",
      "raw catalog entry name is invalid",
    );
    requireCondition(
      !catalogByName.has(entry.name),
      `raw catalog repeats ${entry.name}`,
    );
    catalogByName.set(entry.name, entry);
  }

  for (const inventoryEntry of manifest.catalog_inventory.entries) {
    const rawEntry = catalogByName.get(inventoryEntry.name);
    requireCondition(
      rawEntry !== undefined,
      `raw catalog is missing ${inventoryEntry.name}`,
    );
    requireCondition(
      rawEntry.label === inventoryEntry.label &&
        rawEntry.group === inventoryEntry.group &&
        rawEntry.rows === inventoryEntry.rows &&
        rawEntry.route === inventoryEntry.route &&
        arraysEqual(rawEntry.columns, inventoryEntry.columns),
      `raw catalog metadata differs for ${inventoryEntry.name}`,
    );
  }
  return catalogByName;
}

function validateDatasetSchema(
  name: string,
  schema: { columns: string[]; commonColumns: string[] },
  catalogEntry: RawCatalogEntry,
  metadata: SourceDatasetMetadata,
): void {
  requireCondition(
    schema.columns.length === metadata.actual_columns &&
      schema.commonColumns.length === metadata.common_columns,
    `${name} actual schema counts differ from the pinned manifest`,
  );
  requireCondition(
    catalogEntry.columns.length === metadata.declared_columns,
    `${name} declared schema count differs from the pinned catalog`,
  );

  if (metadata.schema_contract === "catalog_declared_plus") {
    requireCondition(
      arraysEqual(schema.columns, [
        ...catalogEntry.columns,
        ...metadata.extra_columns,
      ]),
      `${name} actual columns differ from catalog_declared_plus`,
    );
    return;
  }

  requireCondition(
    metadata.schema_contract === "curated_route",
    `${name} has unknown schema contract`,
  );
  requireCondition(name === "items", `unexpected curated dataset ${name}`);
  requireCondition(
    arraysEqual(schema.columns, CURATED_ITEMS_COLUMNS),
    "items actual columns differ from the pinned curated schema",
  );
  requireCondition(
    arraysEqual(schema.commonColumns, CURATED_ITEMS_COLUMNS.slice(0, 9)),
    "items common columns differ from the pinned curated schema",
  );
}

function computeMonsterDetailAggregate(
  files: SourceLockMonsterDetail[],
): string {
  return sha256(
    JSON.stringify(
      files.map(({ monsterKey, path, sha256: fileSha256 }) => ({
        monsterKey,
        path,
        sha256: fileSha256,
      })),
    ),
  );
}

async function inspectRawSource(
  projectRoot: string,
  rawDataRoot: string,
): Promise<InspectedRawSource> {
  const manifest = await readPinnedManifest(projectRoot);
  validateManifest(manifest);

  const rawCatalogPath = join(rawDataRoot, "catalog.json");
  const rawCatalogBytes = await readFile(rawCatalogPath, "utf8");
  requireCondition(
    sha256(rawCatalogBytes) === SOURCE_CATALOG_SHA256,
    "raw catalog SHA-256 does not match the pinned catalog",
  );
  const catalogByName = validateRawCatalog(
    parseJson(rawCatalogBytes, "raw catalog"),
    manifest,
  );

  const metadataByName = new Map(
    manifest.datasets.map((metadata) => [
      datasetNameFromDataUrl(metadata.data_url),
      metadata,
    ]),
  );
  requireCondition(
    metadataByName.size === EXPECTED_DATASETS,
    "source dataset metadata names repeat",
  );

  const lockDatasets: SourceLockDataset[] = [];
  const rowsByName = new Map<string, JsonObject[]>();
  for (const entry of manifest.catalog_inventory.entries) {
    const metadata = metadataByName.get(entry.name);
    const catalogEntry = catalogByName.get(entry.name);
    requireCondition(
      metadata !== undefined,
      `source metadata is missing ${entry.name}`,
    );
    requireCondition(
      catalogEntry !== undefined,
      `raw catalog is missing ${entry.name}`,
    );
    requireCondition(
      metadata.rows === entry.rows &&
        metadata.declared_columns === entry.columns.length,
      `${entry.name} manifest row or declared column count differs`,
    );

    const relativePath = `datasets/${entry.name}.json`;
    const rawBytes = await readFile(join(rawDataRoot, relativePath), "utf8");
    requireCondition(
      sha256(rawBytes) === metadata.sha256,
      `${entry.name} raw SHA-256 does not match the pinned manifest`,
    );
    const parsed = parseJson(rawBytes, relativePath);
    requireCondition(
      Array.isArray(parsed),
      `${entry.name} raw dataset must be an array`,
    );
    requireCondition(
      parsed.length === entry.rows,
      `${entry.name} must contain ${entry.rows} rows, not ${parsed.length}`,
    );
    requireCondition(
      parsed.every(isJsonObject),
      `${entry.name} raw dataset must contain only JSON objects`,
    );
    const rows = parsed as JsonObject[];
    const schema = inspectSchema(rows);
    validateDatasetSchema(entry.name, schema, catalogEntry, metadata);
    rowsByName.set(entry.name, rows);
    lockDatasets.push({
      name: entry.name,
      path: relativePath,
      dataUrl: metadata.data_url,
      sha256: metadata.sha256,
      rows: entry.rows,
      columns: schema.columns,
      commonColumns: schema.commonColumns,
    });
  }

  const detailDirectory = join(rawDataRoot, "monster-details");
  const detailFileNames = (await readdir(detailDirectory))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort((left, right) => Number.parseInt(left) - Number.parseInt(right));
  requireCondition(
    detailFileNames.length === EXPECTED_MONSTER_DETAILS,
    `monster detail source must contain ${EXPECTED_MONSTER_DETAILS} JSON appendices`,
  );

  const monsterRows = rowsByName.get("monsters");
  requireCondition(
    monsterRows !== undefined,
    "raw monsters dataset is missing",
  );
  const monsterKeys = new Set(monsterRows.map((row) => row.MonsterKey));
  const detailFiles: SourceLockMonsterDetail[] = [];
  const detailByMonsterKey = new Map<
    number,
    { record: JsonObject; sha256: string }
  >();
  for (const fileName of detailFileNames) {
    const relativePath = `monster-details/${fileName}`;
    const bytes = await readFile(join(rawDataRoot, relativePath), "utf8");
    const record = parseJson(bytes, relativePath);
    requireCondition(
      isJsonObject(record),
      `${relativePath} must contain one JSON object`,
    );
    const monsterKey = record.MonsterKey;
    requireCondition(
      typeof monsterKey === "number" && Number.isInteger(monsterKey),
      `${relativePath} has an invalid MonsterKey`,
    );
    requireCondition(
      fileName === `${monsterKey}.json`,
      `${relativePath} filename does not match MonsterKey`,
    );
    requireCondition(
      monsterKeys.has(monsterKey),
      `${relativePath} is not present in raw monsters`,
    );
    requireCondition(
      !detailByMonsterKey.has(monsterKey),
      `monster detail ${monsterKey} repeats`,
    );
    const fileSha256 = sha256(bytes);
    detailByMonsterKey.set(monsterKey, { record, sha256: fileSha256 });
    detailFiles.push({ monsterKey, path: relativePath, sha256: fileSha256 });
  }
  requireCondition(
    detailByMonsterKey.size === monsterKeys.size,
    "monster detail appendices do not cover all raw monsters",
  );

  const stageBox = await inspectStageBoxDropKeys(rawDataRoot, rowsByName);
  const stageBoxDropKeys = stageBox === null ? null : stageBox.field;

  const sourceLock: DiscordHeroSourceLock = {
    format: "discordhero-source-lock/v1",
    manifestSha256: SOURCE_MANIFEST_SHA256,
    catalog: {
      path: "catalog.json",
      sha256: SOURCE_CATALOG_SHA256,
      datasets: EXPECTED_DATASETS,
    },
    datasets: lockDatasets,
    monsterDetails: {
      count: detailFiles.length,
      aggregateSha256: computeMonsterDetailAggregate(detailFiles),
      files: detailFiles,
    },
    ...(stageBoxDropKeys === null ? {} : { stageBoxDropKeys }),
  };
  const sourceLockBytes = serializeSourceLock(sourceLock);
  return {
    manifest,
    sourceLock,
    sourceLockBytes,
    rowsByName,
    detailByMonsterKey,
    stageBoxMappings: stageBox === null ? null : stageBox.mappings,
  };
}

export function serializeSourceLock(sourceLock: DiscordHeroSourceLock): string {
  return `${JSON.stringify(sourceLock, null, 2)}\n`;
}

export async function createDiscordHeroSourceLock(
  projectRoot: string,
  rawDataRoot: string,
): Promise<DiscordHeroSourceLock> {
  return (await inspectRawSource(projectRoot, rawDataRoot)).sourceLock;
}

export async function validateRawSourceDirectory(
  projectRoot: string,
  rawDataRoot: string,
  options: { requirePinnedLock?: boolean } = {},
): Promise<InspectedRawSource> {
  const inspected = await inspectRawSource(projectRoot, rawDataRoot);
  const lockPath = join(rawDataRoot, "source-lock.json");
  const existingLockBytes = await readFile(lockPath, "utf8");
  requireCondition(
    existingLockBytes === inspected.sourceLockBytes,
    "source-lock.json does not match the pinned manifest and raw bytes",
  );
  if (options.requirePinnedLock !== false) {
    requireCondition(
      sha256(existingLockBytes) === SOURCE_LOCK_SHA256,
      "source lock SHA-256 does not match the reviewed pin",
    );
    requireCondition(
      inspected.sourceLock.monsterDetails.aggregateSha256 ===
        MONSTER_DETAILS_SHA256,
      "monster detail aggregate SHA-256 does not match the reviewed pin",
    );
  }
  return inspected;
}

export async function resolveCurrentRawSource(
  rawDataRoot: string,
): Promise<string> {
  const resolvedRoot = await realpath(rawDataRoot);
  const pointerPath = join(resolvedRoot, CURRENT_VERSION_FILE);
  const pointerStat = await lstat(pointerPath);
  requireCondition(
    pointerStat.isFile() && !pointerStat.isSymbolicLink(),
    "raw source current-version must be a regular non-symlink file",
  );
  const pointerBytes = await readFile(pointerPath, "utf8");
  const pointer = pointerBytes.endsWith("\n")
    ? pointerBytes.slice(0, -1)
    : pointerBytes;
  requireCondition(
    pointerBytes === `${pointer}\n` &&
      /^versions\/[a-z0-9][a-z0-9._-]{0,127}$/.test(pointer),
    `raw source current pointer is not an in-scope immutable version: ${pointer}`,
  );
  const versionPath = join(resolvedRoot, pointer);
  const versionStat = await lstat(versionPath);
  requireCondition(
    versionStat.isDirectory() && !versionStat.isSymbolicLink(),
    "raw source version entry must be a direct non-symlink directory",
  );
  const resolvedVersionPath = await realpath(versionPath);
  requireCondition(
    resolvedVersionPath === versionPath &&
      dirname(resolvedVersionPath) === join(resolvedRoot, "versions"),
    "raw source current pointer escapes its versions directory",
  );
  return resolvedVersionPath;
}

function hasMissingAttackSemantics(row: JsonObject): boolean {
  return (
    row.attack === undefined ||
    row.attack === null ||
    row.attacks === undefined ||
    row.attacks === null ||
    row.attackElements === undefined ||
    row.attackElements === null ||
    (Array.isArray(row.attacks) && row.attacks.length === 0) ||
    (Array.isArray(row.attackElements) && row.attackElements.length === 0)
  );
}

function buildMonsterEnrichments(
  inspected: InspectedRawSource,
): MonsterAttackEnrichment[] {
  const monsters = inspected.rowsByName.get("monsters");
  requireCondition(monsters !== undefined, "raw monsters dataset is missing");
  const missing = monsters.filter(hasMissingAttackSemantics);
  requireCondition(
    missing.length === EXPECTED_MONSTER_ENRICHMENTS,
    `raw monsters must contain ${EXPECTED_MONSTER_ENRICHMENTS} missing attacks, not ${missing.length}`,
  );

  return missing.map((monster) => {
    const monsterKey = monster.MonsterKey;
    requireCondition(
      typeof monsterKey === "number",
      "raw monster has an invalid MonsterKey",
    );
    const detail = inspected.detailByMonsterKey.get(monsterKey);
    requireCondition(
      detail !== undefined,
      `monster detail is missing ${monsterKey}`,
    );
    const attack = detail.record.attack;
    const attacks = detail.record.attacks;
    const attackElements = detail.record.attackElements;
    requireCondition(
      isJsonObject(attack),
      `monster detail ${monsterKey} attack is missing`,
    );
    requireCondition(
      Array.isArray(attacks) &&
        attacks.length > 0 &&
        attacks.every(isJsonObject),
      `monster detail ${monsterKey} attacks are missing`,
    );
    requireCondition(
      Array.isArray(attackElements) &&
        attackElements.length > 0 &&
        attackElements.every((value) => typeof value === "string"),
      `monster detail ${monsterKey} attackElements are missing`,
    );
    return {
      MonsterKey: monsterKey,
      sourceSha256: detail.sha256,
      attack,
      attacks: attacks as JsonObject[],
      attackElements: attackElements as string[],
    };
  });
}

function withoutCompiledSha(
  catalog: DiscordHeroCatalog,
): UnsignedDiscordHeroCatalog {
  return {
    format: catalog.format,
    provenance: {
      sourceManifest: catalog.provenance.sourceManifest,
      sourceManifestSha256: catalog.provenance.sourceManifestSha256,
      sourceCatalogSha256: catalog.provenance.sourceCatalogSha256,
      sourceLockSha256: catalog.provenance.sourceLockSha256,
    },
    totals: catalog.totals,
    datasets: catalog.datasets,
    semantic: catalog.semantic,
  };
}

export function computeDiscordHeroCatalogPayloadSha256(
  catalog: DiscordHeroCatalog,
): string {
  return sha256(JSON.stringify(withoutCompiledSha(catalog)));
}

export async function compileDiscordHeroCatalog(
  projectRoot: string,
  options: { rawDataRoot?: string } = {},
): Promise<DiscordHeroCatalog> {
  const rawDataRoot =
    options.rawDataRoot ??
    join(projectRoot, "preferences/taskbarhero/raw-data");
  const sourceDirectory = await resolveCurrentRawSource(rawDataRoot);
  const inspected = await validateRawSourceDirectory(
    projectRoot,
    sourceDirectory,
  );
  const metadataByName = new Map(
    inspected.manifest.datasets.map((metadata) => [
      datasetNameFromDataUrl(metadata.data_url),
      metadata,
    ]),
  );

  const datasets = inspected.manifest.catalog_inventory.entries.map((entry) => {
    const metadata = metadataByName.get(entry.name);
    const sourceLock = inspected.sourceLock.datasets.find(
      (dataset) => dataset.name === entry.name,
    );
    const rows = inspected.rowsByName.get(entry.name);
    requireCondition(
      metadata !== undefined,
      `source metadata is missing ${entry.name}`,
    );
    requireCondition(
      sourceLock !== undefined,
      `source lock is missing ${entry.name}`,
    );
    requireCondition(rows !== undefined, `raw rows are missing ${entry.name}`);
    return {
      name: entry.name,
      label: entry.label,
      group: entry.group,
      route: entry.route,
      sourceUrl: metadata.source_url,
      dataUrl: metadata.data_url,
      sourceSha256: metadata.sha256,
      schemaContract: metadata.schema_contract,
      declaredColumns: entry.columns,
      columns: sourceLock.columns,
      commonColumns: sourceLock.commonColumns,
      rows,
    };
  });
  const enrichments = buildMonsterEnrichments(inspected);
  const unsigned: UnsignedDiscordHeroCatalog = {
    format: "discordhero-catalog/v2",
    provenance: {
      sourceManifest: SOURCE_MANIFEST_PATH,
      sourceManifestSha256: SOURCE_MANIFEST_SHA256,
      sourceCatalogSha256: SOURCE_CATALOG_SHA256,
      sourceLockSha256: SOURCE_LOCK_SHA256,
    },
    totals: { datasets: datasets.length, rows: EXPECTED_ROWS },
    datasets,
    semantic: {
      monsterAttacks: {
        provenance: {
          sourceCount: inspected.sourceLock.monsterDetails.count,
          enrichedCount: enrichments.length,
          sourceAggregateSha256:
            inspected.sourceLock.monsterDetails.aggregateSha256,
        },
        enrichments,
      },
      ...(inspected.stageBoxMappings === null ||
      inspected.sourceLock.stageBoxDropKeys === undefined
        ? {}
        : {
            stageBoxDropKeys: {
              provenance: {
                sourceCount: inspected.sourceLock.stageBoxDropKeys.count,
                distinctDropKeyCount:
                  inspected.sourceLock.stageBoxDropKeys.distinctDropKeyCount,
                inventoryAggregateSha256:
                  inspected.sourceLock.stageBoxDropKeys
                    .inventoryAggregateSha256,
                sourceAggregateSha256:
                  inspected.sourceLock.stageBoxDropKeys.mappingAggregateSha256,
                sourceArtifactSha256:
                  inspected.sourceLock.stageBoxDropKeys.sha256,
              },
              mappings: inspected.stageBoxMappings,
            },
          }),
    },
  };
  const catalog: DiscordHeroCatalog = {
    ...unsigned,
    provenance: {
      ...unsigned.provenance,
      compiledSha256: sha256(JSON.stringify(unsigned)),
    },
  };
  validateDiscordHeroCatalog(catalog);
  return catalog;
}

function validateDatasetRows(dataset: DiscordHeroDataset): void {
  const expectedRows =
    EXPECTED_DATASET_ROWS[dataset.name as keyof typeof EXPECTED_DATASET_ROWS];
  requireCondition(
    expectedRows !== undefined,
    `compiled catalog has unexpected ${dataset.name}`,
  );
  requireCondition(
    dataset.rows.length === expectedRows,
    `${dataset.name} must contain ${expectedRows} rows, not ${dataset.rows.length}`,
  );
  requireCondition(
    dataset.rows.every(isJsonObject),
    `${dataset.name} compiled rows must remain JSON objects`,
  );
  const schema = inspectSchema(dataset.rows);
  requireCondition(
    arraysEqual(schema.columns, dataset.columns) &&
      arraysEqual(schema.commonColumns, dataset.commonColumns),
    `${dataset.name} compiled schema does not match its rows`,
  );
  if (dataset.name === "items") {
    requireCondition(
      arraysEqual(dataset.columns, CURATED_ITEMS_COLUMNS),
      "items compiled columns differ from the pinned curated schema",
    );
  }
}

export function validateDiscordHeroCatalog(
  value: unknown,
): asserts value is DiscordHeroCatalog {
  requireCondition(isRecord(value), "compiled catalog must be an object");
  requireCondition(
    value.format === "discordhero-catalog/v2",
    "compiled catalog format is invalid",
  );
  requireCondition(
    isRecord(value.provenance),
    "compiled catalog provenance is missing",
  );
  requireCondition(
    isRecord(value.totals),
    "compiled catalog totals are missing",
  );
  requireCondition(
    Array.isArray(value.datasets),
    "compiled catalog datasets are missing",
  );
  requireCondition(
    isRecord(value.semantic),
    "compiled catalog semantic data is missing",
  );
  const catalog = value as unknown as DiscordHeroCatalog;

  requireCondition(
    catalog.provenance.sourceManifest === SOURCE_MANIFEST_PATH &&
      catalog.provenance.sourceManifestSha256 === SOURCE_MANIFEST_SHA256 &&
      catalog.provenance.sourceCatalogSha256 === SOURCE_CATALOG_SHA256 &&
      catalog.provenance.sourceLockSha256 === SOURCE_LOCK_SHA256,
    "compiled source provenance differs from reviewed pins",
  );
  requireCondition(
    catalog.datasets.length === EXPECTED_DATASETS &&
      catalog.totals.datasets === EXPECTED_DATASETS &&
      catalog.totals.rows === EXPECTED_ROWS,
    "compiled catalog totals differ from reviewed pins",
  );
  requireCondition(
    arraysEqual(
      catalog.datasets.map((dataset) => dataset.name),
      Object.keys(EXPECTED_DATASET_ROWS),
    ),
    "compiled dataset order differs from the pinned inventory",
  );

  let totalRows = 0;
  for (const dataset of catalog.datasets) {
    requireCondition(
      isRecord(dataset),
      "compiled catalog contains a non-object dataset",
    );
    validateDatasetRows(dataset);
    totalRows += dataset.rows.length;
  }
  requireCondition(
    totalRows === EXPECTED_ROWS,
    `compiled rows total ${totalRows}, expected ${EXPECTED_ROWS}`,
  );

  const monsterAttacks = catalog.semantic.monsterAttacks;
  requireCondition(
    isRecord(monsterAttacks),
    "monster attack semantics are missing",
  );
  requireCondition(
    monsterAttacks.provenance.sourceCount === EXPECTED_MONSTER_DETAILS &&
      monsterAttacks.provenance.enrichedCount ===
        EXPECTED_MONSTER_ENRICHMENTS &&
      monsterAttacks.provenance.sourceAggregateSha256 ===
        MONSTER_DETAILS_SHA256 &&
      monsterAttacks.enrichments.length === EXPECTED_MONSTER_ENRICHMENTS,
    "monster attack semantic provenance differs from reviewed pins",
  );

  const computedSha256 = computeDiscordHeroCatalogPayloadSha256(catalog);
  requireCondition(
    catalog.provenance.compiledSha256 === computedSha256,
    `compiled SHA-256 mismatch: expected ${computedSha256}`,
  );
  requireCondition(
    catalog.provenance.compiledSha256 === COMPILED_PAYLOAD_SHA256,
    `compiled catalog does not match the pinned compiled payload SHA-256: ${catalog.provenance.compiledSha256}`,
  );
}

export function serializeDiscordHeroCatalog(
  catalog: DiscordHeroCatalog,
): string {
  validateDiscordHeroCatalog(catalog);
  const serialized = `${JSON.stringify(catalog)}\n`;
  requireCondition(
    sha256(serialized) === COMPILED_FILE_SHA256,
    `compiled artifact does not match the pinned artifact file SHA-256: ${sha256(serialized)}`,
  );
  return serialized;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writeDiscordHeroCatalog(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/catalog.json"),
): Promise<{ catalog: DiscordHeroCatalog; changed: boolean }> {
  const catalog = await compileDiscordHeroCatalog(projectRoot);
  const serialized = serializeDiscordHeroCatalog(catalog);
  await mkdir(dirname(outputPath), { recursive: true });

  if (await fileExists(outputPath)) {
    const existing = await readFile(outputPath, "utf8");
    if (existing === serialized) {
      return { catalog, changed: false };
    }
  }

  const temporaryDirectory = await mkdtemp(
    join(dirname(outputPath), ".discordhero-catalog-"),
  );
  const temporaryPath = join(temporaryDirectory, "catalog.json");
  try {
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return { catalog, changed: true };
}

export async function checkDiscordHeroCatalog(
  projectRoot: string,
  outputPath = join(projectRoot, "assets/discordhero/catalog.json"),
): Promise<void> {
  const catalog = await compileDiscordHeroCatalog(projectRoot);
  const expected = serializeDiscordHeroCatalog(catalog);
  const actual = await readFile(outputPath, "utf8");
  requireCondition(
    actual === expected,
    `${outputPath} does not match generated catalog`,
  );
}
