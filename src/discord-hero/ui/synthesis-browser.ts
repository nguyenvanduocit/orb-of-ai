import { types as nodeUtilTypes } from "node:util";
import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

export const DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE = 25;
export const DISCORD_HERO_SYNTHESIS_RECIPE_COUNT = 533;
export const DISCORD_HERO_SYNTHESIS_DROP_COUNT = 203;

export const DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER =
  "Source preview only: exact synthesis_recipes and synthesis_drops rows. " +
  "Result-level choice within a ranged span, drop-table member choice, " +
  "material suitability and any result outcome are runtime-oracle-gated.";

const SYNTHESIS_RECIPE_FIELDS = [
  "SynthesisRecipeKey",
  "RecipeTier",
  "MinMaterialTier",
  "MinResultLevel",
  "MaxResultLevel",
  "ItemSynthesisType",
  "GRADE",
  "MaterialAmount",
  "MinMaterialAverageLevel",
  "LevelWeight1",
  "LevelWeight2",
  "LevelWeight3",
  "LevelWeight4",
] as const;

const SYNTHESIS_DROP_FIELDS = [
  "SynthesisDropKey",
  "ItemLevel",
  "RecipeTier",
  "ItemSynthesisType",
  "GRADE",
  "DropKey",
] as const;

const GRADE_FIELDS = [
  "GRADE",
  "Lower2GradeWeight",
  "Lower1GradeWeight",
  "SameGradeWeight",
  "Higher1GradeWeight",
  "Higher2GradeWeight",
  "InherentSlotAmount",
  "ExtraSlotAmount_Decoration",
  "ExtraSlotAmount_Engraving",
  "ExtraSlotAmount_Inscription",
  "BaseAlchemyGold",
  "BaseCubeExp",
] as const;

const DROP_FIELDS = [
  "DropKey",
  "DropType",
  "REWARDTYPE",
  "RewardKey",
  "HeroKeyCondition",
  "Weight",
] as const;

const TABLE_FIELDS = ["name", "primaryField", "rows", "groups"] as const;

export type DiscordHeroSynthesisSection = "recipes" | "drops";

export interface DiscordHeroSynthesisResultLevelSpan {
  readonly kind: "ranged" | "exact";
  readonly minResultLevel: number;
  readonly maxResultLevel: number;
  readonly selectionStatus: "runtime-oracle-gated";
}

export interface DiscordHeroSynthesisGradeReference {
  readonly kind: "resolved";
  readonly grade: string;
}

export interface DiscordHeroSynthesisDropReference {
  readonly kind: "source-drop-reference";
  readonly dropKey: number;
  readonly selectionStatus: "runtime-oracle-gated";
  readonly sourceRowCount: number;
  readonly rewardKeys: readonly number[];
  readonly rewardTypes: readonly string[];
  readonly dropTypes: readonly string[];
}

export interface DiscordHeroSynthesisRecipeEntry {
  readonly section: "recipes";
  readonly rowIndex: number;
  readonly synthesisRecipeKey: number;
  readonly recipeTier: number;
  readonly minMaterialTier: number;
  readonly minResultLevel: number;
  readonly maxResultLevel: number;
  readonly itemSynthesisType: string;
  readonly grade: string;
  readonly materialAmount: number;
  readonly minMaterialAverageLevel: number;
  readonly levelWeights: readonly number[];
  readonly resultLevelSpan: DiscordHeroSynthesisResultLevelSpan;
  readonly gradeReference: DiscordHeroSynthesisGradeReference;
}

export interface DiscordHeroSynthesisDropEntry {
  readonly section: "drops";
  readonly rowIndex: number;
  readonly synthesisDropKey: number;
  readonly itemLevel: number;
  readonly recipeTier: number;
  readonly itemSynthesisType: string;
  readonly grade: string;
  readonly dropKey: number;
  readonly gradeReference: DiscordHeroSynthesisGradeReference;
  readonly dropReference: DiscordHeroSynthesisDropReference;
}

export interface DiscordHeroSynthesisBrowser {
  readonly recipeCount: number;
  readonly dropCount: number;
  readonly pageSize: number;
  readonly recipePageCount: number;
  readonly dropPageCount: number;
  readonly disclaimer: string;
}

export interface DiscordHeroSynthesisPage {
  readonly section: DiscordHeroSynthesisSection;
  readonly page: number;
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rows: readonly (
    DiscordHeroSynthesisRecipeEntry | DiscordHeroSynthesisDropEntry
  )[];
}

function formatDiscordSafePlainText(
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
  throw new Error(formatDiscordSafePlainText(message, 400));
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

function snapshotExactOwnDataObject(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
  alternativeExpectedFields: readonly (readonly string[])[] = [],
): Readonly<Record<string, unknown>> {
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
  const expectedShapes = [expectedFields, ...alternativeExpectedFields];
  const expectedShape = expectedShapes.find(
    (shape) =>
      shape.length === actualFields.length &&
      shape.every((field) => actualFields.includes(field)),
  );
  const allowedFields = new Set(expectedShapes.flat());
  const unknownFields = actualFields
    .filter((field) => !allowedFields.has(field))
    .sort();
  if (unknownFields.length > 0) {
    fail(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  if (expectedShape === undefined) {
    const missingFields = expectedFields.filter(
      (field) => !actualFields.includes(field),
    );
    fail(
      missingFields.length > 0
        ? `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`
        : `${label} fields must exactly match an allowed shape`,
    );
  }

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of expectedShape) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
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

function snapshotExactOwnDataArray(
  value: unknown,
  label: string,
): readonly unknown[] {
  if (nodeUtilTypes.isProxy(value)) {
    fail(`${label} must not be a Proxy`);
  }
  if (!Array.isArray(value)) {
    fail(`${label} must be an array; received ${describeValueType(value)}`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype) {
    fail(`${label} must use Array.prototype`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail(`${label} must not contain symbol own keys`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    fail(`${label}.length must be an own non-negative safe integer`);
  }
  const length = lengthDescriptor.value;
  const expectedKeys = new Set<string>(["length"]);
  for (let index = 0; index < length; index += 1) {
    expectedKeys.add(String(index));
  }
  const unexpectedKeys = (ownKeys as string[]).filter(
    (key) => !expectedKeys.has(key),
  );
  if (unexpectedKeys.length > 0) {
    fail(`${label} has unexpected own key ${unexpectedKeys[0]}`);
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      fail(`${label} has a sparse hole at index ${index}`);
    }
    if (
      descriptor.enumerable !== true ||
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

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function snapshotTableRows(
  tables: Readonly<Record<string, unknown>>,
  dataset: string,
  primaryField: string,
  label: string,
): readonly unknown[] {
  const table = snapshotExactOwnDataObject(
    tables[dataset],
    TABLE_FIELDS,
    `${label}.${dataset}`,
  );
  const name = table.name;
  const actualPrimary = table.primaryField;
  if (name !== dataset) {
    fail(`${label}.${dataset} name must be ${dataset}`);
  }
  if (actualPrimary !== primaryField) {
    fail(`${label}.${dataset}.primaryField must be ${primaryField}`);
  }
  // Groups are derived indexes, so their captured descriptor value is ignored.
  // All join authority is rebuilt from the exact rows snapshot below.
  return snapshotExactOwnDataArray(table.rows, `${label}.${dataset}.rows`);
}

function snapshotRecipeRow(row: unknown, rowIndex: number): TrustedRecipeRow {
  const label = `synthesis_recipes row ${rowIndex}`;
  const snapshot = snapshotExactOwnDataObject(
    row,
    SYNTHESIS_RECIPE_FIELDS,
    label,
  );
  return {
    rowIndex,
    SynthesisRecipeKey: positiveSafeInteger(
      snapshot.SynthesisRecipeKey,
      `${label} SynthesisRecipeKey`,
    ),
    RecipeTier: positiveSafeInteger(snapshot.RecipeTier, `${label} RecipeTier`),
    MinMaterialTier: positiveSafeInteger(
      snapshot.MinMaterialTier,
      `${label} MinMaterialTier`,
    ),
    MinResultLevel: positiveSafeInteger(
      snapshot.MinResultLevel,
      `${label} MinResultLevel`,
    ),
    MaxResultLevel: positiveSafeInteger(
      snapshot.MaxResultLevel,
      `${label} MaxResultLevel`,
    ),
    ItemSynthesisType: nonemptyString(
      snapshot.ItemSynthesisType,
      `${label} ItemSynthesisType`,
    ),
    GRADE: nonemptyString(snapshot.GRADE, `${label} GRADE`),
    MaterialAmount: positiveSafeInteger(
      snapshot.MaterialAmount,
      `${label} MaterialAmount`,
    ),
    MinMaterialAverageLevel: nonNegativeSafeInteger(
      snapshot.MinMaterialAverageLevel,
      `${label} MinMaterialAverageLevel`,
    ),
    LevelWeight1: nonNegativeSafeInteger(
      snapshot.LevelWeight1,
      `${label} LevelWeight1`,
    ),
    LevelWeight2: nonNegativeSafeInteger(
      snapshot.LevelWeight2,
      `${label} LevelWeight2`,
    ),
    LevelWeight3: nonNegativeSafeInteger(
      snapshot.LevelWeight3,
      `${label} LevelWeight3`,
    ),
    LevelWeight4: nonNegativeSafeInteger(
      snapshot.LevelWeight4,
      `${label} LevelWeight4`,
    ),
  };
}

function snapshotDropRow(row: unknown, rowIndex: number): TrustedDropRow {
  const label = `synthesis_drops row ${rowIndex}`;
  const snapshot = snapshotExactOwnDataObject(
    row,
    SYNTHESIS_DROP_FIELDS,
    label,
  );
  return {
    rowIndex,
    SynthesisDropKey: positiveSafeInteger(
      snapshot.SynthesisDropKey,
      `${label} SynthesisDropKey`,
    ),
    ItemLevel: positiveSafeInteger(snapshot.ItemLevel, `${label} ItemLevel`),
    RecipeTier: positiveSafeInteger(snapshot.RecipeTier, `${label} RecipeTier`),
    ItemSynthesisType: nonemptyString(
      snapshot.ItemSynthesisType,
      `${label} ItemSynthesisType`,
    ),
    GRADE: nonemptyString(snapshot.GRADE, `${label} GRADE`),
    DropKey: positiveSafeInteger(snapshot.DropKey, `${label} DropKey`),
  };
}

function snapshotGrade(row: unknown, rowIndex: number): string {
  const label = `grades row ${rowIndex}`;
  const snapshot = snapshotExactOwnDataObject(row, GRADE_FIELDS, label);
  return nonemptyString(snapshot.GRADE, `${label} GRADE`);
}

interface TrustedDropJoinRow {
  readonly DropKey: number;
  readonly RewardKey: number;
  readonly REWARDTYPE: string;
  readonly DropType: string;
}

function snapshotDropJoinRow(
  row: unknown,
  rowIndex: number,
): TrustedDropJoinRow {
  const label = `drops row ${rowIndex}`;
  const snapshot = snapshotExactOwnDataObject(row, DROP_FIELDS, label);
  return {
    DropKey: positiveSafeInteger(snapshot.DropKey, `${label} DropKey`),
    RewardKey: positiveSafeInteger(snapshot.RewardKey, `${label} RewardKey`),
    REWARDTYPE: nonemptyString(snapshot.REWARDTYPE, `${label} REWARDTYPE`),
    DropType: nonemptyString(snapshot.DropType, `${label} DropType`),
  };
}

interface TrustedRecipeRow {
  readonly rowIndex: number;
  readonly SynthesisRecipeKey: number;
  readonly RecipeTier: number;
  readonly MinMaterialTier: number;
  readonly MinResultLevel: number;
  readonly MaxResultLevel: number;
  readonly ItemSynthesisType: string;
  readonly GRADE: string;
  readonly MaterialAmount: number;
  readonly MinMaterialAverageLevel: number;
  readonly LevelWeight1: number;
  readonly LevelWeight2: number;
  readonly LevelWeight3: number;
  readonly LevelWeight4: number;
}

interface TrustedDropRow {
  readonly rowIndex: number;
  readonly SynthesisDropKey: number;
  readonly ItemLevel: number;
  readonly RecipeTier: number;
  readonly ItemSynthesisType: string;
  readonly GRADE: string;
  readonly DropKey: number;
}

interface TrustedSynthesisCatalog {
  readonly recipes: readonly TrustedRecipeRow[];
  readonly drops: readonly TrustedDropRow[];
  readonly dropReferences: ReadonlyMap<
    number,
    DiscordHeroSynthesisDropReference
  >;
}

function requireUniqueKeys(keys: readonly number[], dataset: string): void {
  const seen = new Set<number>();
  for (const [index, key] of keys.entries()) {
    if (seen.has(key)) {
      fail(`${dataset} has a duplicate primary key ${key} at row ${index}`);
    }
    seen.add(key);
  }
}

function loadTrustedCatalog(
  indexes: DiscordHeroCatalogIndexes,
): TrustedSynthesisCatalog {
  const indexSnapshot = snapshotExactOwnDataObject(
    indexes,
    ["catalog", "tables", "semanticReport"],
    "synthesis browser indexes",
  );
  const label = "synthesis browser indexes.tables";
  const tables = snapshotExactOwnDataObject(
    indexSnapshot.tables,
    DISCORD_HERO_DATASET_NAMES,
    label,
  );
  const recipeRows = snapshotTableRows(
    tables,
    "synthesis_recipes",
    "SynthesisRecipeKey",
    label,
  );
  if (recipeRows.length !== DISCORD_HERO_SYNTHESIS_RECIPE_COUNT) {
    fail(
      `synthesis_recipes must contain exactly ${DISCORD_HERO_SYNTHESIS_RECIPE_COUNT} rows; received ${recipeRows.length}`,
    );
  }
  const dropRows = snapshotTableRows(
    tables,
    "synthesis_drops",
    "SynthesisDropKey",
    label,
  );
  if (dropRows.length !== DISCORD_HERO_SYNTHESIS_DROP_COUNT) {
    fail(
      `synthesis_drops must contain exactly ${DISCORD_HERO_SYNTHESIS_DROP_COUNT} rows; received ${dropRows.length}`,
    );
  }

  const recipes = recipeRows.map((row, rowIndex) =>
    snapshotRecipeRow(row, rowIndex),
  );
  const drops = dropRows.map((row, rowIndex) => snapshotDropRow(row, rowIndex));
  requireUniqueKeys(
    recipes.map((recipe) => recipe.SynthesisRecipeKey),
    "synthesis_recipes",
  );
  requireUniqueKeys(
    drops.map((drop) => drop.SynthesisDropKey),
    "synthesis_drops",
  );

  // Grade authority is recomputed from the grades rows, never from a caller
  // group index or the semantic report.
  const gradeRows = snapshotTableRows(tables, "grades", "GRADE", label);
  const knownGrades = new Set<string>();
  for (const [rowIndex, row] of gradeRows.entries()) {
    knownGrades.add(snapshotGrade(row, rowIndex));
  }
  for (const recipe of recipes) {
    if (!knownGrades.has(recipe.GRADE)) {
      fail(
        `synthesis_recipes row ${recipe.rowIndex} references unknown grade ${recipe.GRADE}`,
      );
    }
  }
  for (const drop of drops) {
    if (!knownGrades.has(drop.GRADE)) {
      fail(
        `synthesis_drops row ${drop.rowIndex} references unknown grade ${drop.GRADE}`,
      );
    }
  }

  // The DropKey join is recomputed here in exact catalog row order.
  const dropTableRows = snapshotTableRows(tables, "drops", "DropKey", label);
  const dropIndex = new Map<
    number,
    { rewardKeys: number[]; rewardTypes: Set<string>; dropTypes: Set<string> }
  >();
  for (const [rowIndex, row] of dropTableRows.entries()) {
    const snapshot = snapshotDropJoinRow(row, rowIndex);
    const bucket = dropIndex.get(snapshot.DropKey) ?? {
      rewardKeys: [],
      rewardTypes: new Set<string>(),
      dropTypes: new Set<string>(),
    };
    bucket.rewardKeys.push(snapshot.RewardKey);
    bucket.rewardTypes.add(snapshot.REWARDTYPE);
    bucket.dropTypes.add(snapshot.DropType);
    dropIndex.set(snapshot.DropKey, bucket);
  }

  const dropReferences = new Map<number, DiscordHeroSynthesisDropReference>();
  for (const drop of drops) {
    if (dropReferences.has(drop.DropKey)) continue;
    const bucket = dropIndex.get(drop.DropKey);
    if (bucket === undefined || bucket.rewardKeys.length === 0) {
      fail(
        `synthesis_drops row ${drop.rowIndex} references dangling DropKey ${drop.DropKey}`,
      );
    }
    dropReferences.set(
      drop.DropKey,
      Object.freeze({
        kind: "source-drop-reference" as const,
        dropKey: drop.DropKey,
        selectionStatus: "runtime-oracle-gated" as const,
        sourceRowCount: bucket.rewardKeys.length,
        rewardKeys: Object.freeze([...bucket.rewardKeys]),
        rewardTypes: Object.freeze([...bucket.rewardTypes].sort()),
        dropTypes: Object.freeze([...bucket.dropTypes].sort()),
      }),
    );
  }

  return { recipes, drops, dropReferences };
}

function projectRecipeEntry(
  recipe: TrustedRecipeRow,
): DiscordHeroSynthesisRecipeEntry {
  return {
    section: "recipes",
    rowIndex: recipe.rowIndex,
    synthesisRecipeKey: recipe.SynthesisRecipeKey,
    recipeTier: recipe.RecipeTier,
    minMaterialTier: recipe.MinMaterialTier,
    minResultLevel: recipe.MinResultLevel,
    maxResultLevel: recipe.MaxResultLevel,
    itemSynthesisType: recipe.ItemSynthesisType,
    grade: recipe.GRADE,
    materialAmount: recipe.MaterialAmount,
    minMaterialAverageLevel: recipe.MinMaterialAverageLevel,
    levelWeights: [
      recipe.LevelWeight1,
      recipe.LevelWeight2,
      recipe.LevelWeight3,
      recipe.LevelWeight4,
    ],
    // The span is labelled from the raw bounds; no level inside the span is
    // chosen here, because that choice is a runtime behaviour.
    resultLevelSpan: {
      kind:
        recipe.MinResultLevel === recipe.MaxResultLevel ? "exact" : "ranged",
      minResultLevel: recipe.MinResultLevel,
      maxResultLevel: recipe.MaxResultLevel,
      selectionStatus: "runtime-oracle-gated",
    },
    gradeReference: { kind: "resolved", grade: recipe.GRADE },
  };
}

function projectDropEntry(
  drop: TrustedDropRow,
  catalog: TrustedSynthesisCatalog,
): DiscordHeroSynthesisDropEntry {
  const dropReference = catalog.dropReferences.get(drop.DropKey);
  if (dropReference === undefined) {
    fail(
      `synthesis_drops row ${drop.rowIndex} references dangling DropKey ${drop.DropKey}`,
    );
  }
  return {
    section: "drops",
    rowIndex: drop.rowIndex,
    synthesisDropKey: drop.SynthesisDropKey,
    itemLevel: drop.ItemLevel,
    recipeTier: drop.RecipeTier,
    itemSynthesisType: drop.ItemSynthesisType,
    grade: drop.GRADE,
    dropKey: drop.DropKey,
    gradeReference: { kind: "resolved", grade: drop.GRADE },
    dropReference,
  };
}

function parseSection(
  value: unknown,
  label: string,
): DiscordHeroSynthesisSection {
  if (value !== "recipes" && value !== "drops") {
    fail(`${label} must be "recipes" or "drops"`);
  }
  return value;
}

function sectionPageCount(section: DiscordHeroSynthesisSection): number {
  const rowCount =
    section === "recipes"
      ? DISCORD_HERO_SYNTHESIS_RECIPE_COUNT
      : DISCORD_HERO_SYNTHESIS_DROP_COUNT;
  return Math.ceil(rowCount / DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE);
}

export function projectDiscordHeroSynthesisBrowser(
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroSynthesisBrowser {
  loadTrustedCatalog(indexes);
  return deepFreeze({
    recipeCount: DISCORD_HERO_SYNTHESIS_RECIPE_COUNT,
    dropCount: DISCORD_HERO_SYNTHESIS_DROP_COUNT,
    pageSize: DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE,
    recipePageCount: sectionPageCount("recipes"),
    dropPageCount: sectionPageCount("drops"),
    disclaimer: DISCORD_HERO_SYNTHESIS_BROWSER_DISCLAIMER,
  });
}

export function discordHeroSynthesisPageCount(
  indexes: DiscordHeroCatalogIndexes,
  section: DiscordHeroSynthesisSection,
): number {
  loadTrustedCatalog(indexes);
  return sectionPageCount(parseSection(section, "synthesis browser section"));
}

export function discordHeroSynthesisPage(
  indexes: DiscordHeroCatalogIndexes,
  input: {
    readonly section: DiscordHeroSynthesisSection;
    readonly page: number;
  },
): DiscordHeroSynthesisPage {
  const inputSnapshot = snapshotExactOwnDataObject(
    input,
    ["section", "page"],
    "synthesis browser page input",
  );
  const section = parseSection(
    inputSnapshot.section,
    "synthesis browser page input.section",
  );
  const page = nonNegativeSafeInteger(
    inputSnapshot.page,
    "synthesis browser page input.page",
  );
  const pageCount = sectionPageCount(section);
  if (page >= pageCount) {
    fail(`synthesis browser page ${page} is outside 0-${pageCount - 1}`);
  }

  const catalog = loadTrustedCatalog(indexes);
  const start = page * DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE;
  const end = start + DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE;
  const rows =
    section === "recipes"
      ? catalog.recipes.slice(start, end).map(projectRecipeEntry)
      : catalog.drops
          .slice(start, end)
          .map((drop) => projectDropEntry(drop, catalog));
  if (rows.length > DISCORD_HERO_SYNTHESIS_BROWSER_PAGE_SIZE) {
    fail("synthesis browser page exceeded page size 25");
  }

  return deepFreeze({
    section,
    page,
    pageCount,
    rowCount:
      section === "recipes"
        ? DISCORD_HERO_SYNTHESIS_RECIPE_COUNT
        : DISCORD_HERO_SYNTHESIS_DROP_COUNT,
    // Handed to deepFreeze unfrozen on purpose: pre-freezing the array would
    // trip deepFreeze's already-frozen short circuit and leave each row
    // object mutable.
    rows,
  });
}

export function discordHeroSynthesisDetail(
  indexes: DiscordHeroCatalogIndexes,
  input:
    | {
        readonly section: "recipes";
        readonly synthesisRecipeKey: number;
      }
    | {
        readonly section: "drops";
        readonly synthesisDropKey: number;
      },
): DiscordHeroSynthesisRecipeEntry | DiscordHeroSynthesisDropEntry {
  const inputSnapshot = snapshotExactOwnDataObject(
    input,
    ["section", "synthesisRecipeKey"],
    "synthesis browser detail input",
    [["section", "synthesisDropKey"]],
  );
  const section = parseSection(
    inputSnapshot.section,
    "synthesis browser detail input.section",
  );

  if (section === "recipes") {
    if (!Object.hasOwn(inputSnapshot, "synthesisRecipeKey")) {
      fail("recipes detail input must use synthesisRecipeKey");
    }
    const key = positiveSafeInteger(
      inputSnapshot.synthesisRecipeKey,
      "synthesis browser detail input.synthesisRecipeKey",
    );
    const catalog = loadTrustedCatalog(indexes);
    const recipe = catalog.recipes.find(
      (candidate) => candidate.SynthesisRecipeKey === key,
    );
    if (recipe === undefined) {
      fail(
        `synthesis browser detail references unknown SynthesisRecipeKey ${key}`,
      );
    }
    return deepFreeze(projectRecipeEntry(recipe));
  }

  if (!Object.hasOwn(inputSnapshot, "synthesisDropKey")) {
    fail("drops detail input must use synthesisDropKey");
  }
  const key = positiveSafeInteger(
    inputSnapshot.synthesisDropKey,
    "synthesis browser detail input.synthesisDropKey",
  );
  const catalog = loadTrustedCatalog(indexes);
  const drop = catalog.drops.find(
    (candidate) => candidate.SynthesisDropKey === key,
  );
  if (drop === undefined) {
    fail(`synthesis browser detail references unknown SynthesisDropKey ${key}`);
  }
  return deepFreeze(projectDropEntry(drop, catalog));
}

export function discordHeroSynthesisTextRows(
  indexes: DiscordHeroCatalogIndexes,
  input: {
    readonly section: DiscordHeroSynthesisSection;
    readonly page: number;
  },
): readonly string[] {
  const projected = discordHeroSynthesisPage(indexes, input);
  return Object.freeze(
    projected.rows.map((row) => {
      if (row.section === "recipes") {
        const span =
          row.resultLevelSpan.kind === "exact"
            ? `Lv${row.minResultLevel}`
            : `Lv${row.minResultLevel}-${row.maxResultLevel}`;
        return formatDiscordSafePlainText(
          `#${row.rowIndex} recipe ${row.synthesisRecipeKey} - ${row.itemSynthesisType} ${row.grade} T${row.recipeTier} - ` +
            `matTier>=${row.minMaterialTier} amount ${row.materialAmount} avgLv>=${row.minMaterialAverageLevel} - ` +
            `result ${span} [${row.resultLevelSpan.kind}] - weights ${row.levelWeights.join("/")} - source preview`,
        );
      }
      return formatDiscordSafePlainText(
        `#${row.rowIndex} drop ${row.synthesisDropKey} - ${row.itemSynthesisType} ${row.grade} T${row.recipeTier} ilvl ${row.itemLevel} - ` +
          `table ${row.dropKey} rows ${row.dropReference.sourceRowCount} [${row.dropReference.selectionStatus}] - source preview`,
      );
    }),
  );
}
