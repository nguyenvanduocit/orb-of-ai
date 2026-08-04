import {
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { parseMaterialRequirements } from "../domain/crafting";

export const DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE = 25;
export const DISCORD_HERO_CRAFTING_RECIPE_COUNT = 56;

/** Provenance-only disclaimer — never implies craftability or inventory credit. */
export const DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER =
  "Source preview of crafting_recipes only. Execution remains oracle-gated; this view does not craft, select drops, or credit inventory.";

const CRAFTING_RECIPE_FIELDS = [
  "CraftingRecipeKey",
  "ItemCraftingType",
  "RecipeTier",
  "Material",
  "MaterialIndex",
  "DropKey",
] as const;

export type DiscordHeroCraftingMaterialItem =
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

export interface DiscordHeroCraftingParsedMaterial {
  readonly itemKey: number;
  readonly quantity: number;
  readonly item: DiscordHeroCraftingMaterialItem;
}

export interface DiscordHeroCraftingDropReference {
  readonly kind: "source-drop-reference";
  readonly dropKey: number;
  readonly selectionStatus: "unresolved-reference";
  readonly sourceRowCount: number;
  readonly rewardEntryCount: number;
  readonly dropTypes: readonly string[];
  readonly multiMemberRewardCount: number;
  readonly heroConditionRowCount: number;
  readonly classifierHint: "mixed-or-conditional" | "pure-weighted-candidate";
}

export interface DiscordHeroCraftingRecipeEntry {
  readonly rowIndex: number;
  readonly craftingRecipeKey: number;
  readonly itemCraftingType: string;
  readonly recipeTier: number;
  readonly materialIndex: number | string;
  readonly rawMaterial: string;
  readonly parsedMaterials: readonly DiscordHeroCraftingParsedMaterial[];
  readonly dropKey: number;
  readonly dropReference: DiscordHeroCraftingDropReference;
}

export interface DiscordHeroCraftingBrowser {
  readonly recipeCount: 56;
  readonly pageCount: 3;
  readonly pageSize: 25;
  readonly disclaimer: typeof DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER;
}

export interface DiscordHeroCraftingRecipePage {
  readonly page: number;
  readonly pageCount: 3;
  readonly rowCount: 56;
  readonly rows: readonly DiscordHeroCraftingRecipeEntry[];
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
  throw new Error(formatDiscordSafePlainText(message));
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
    fail(`${label} must be an object; received ${describeValueType(value)}`);
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
    fail(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail(`${label} must not contain symbol own keys`);
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
    fail(`${label} must use own data properties without accessors`);
  }
  const unknownFields = actualFields
    .filter((field) => !expectedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    fail(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !Object.hasOwn(value, field),
  );
  if (missingFields.length > 0) {
    fail(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
}

function snapshotOwnDataProperty(
  value: unknown,
  field: string,
  label: string,
): unknown {
  assertRecord(value, label);
  if (!Object.hasOwn(value, field)) {
    fail(`${label} is missing field ${field}`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (
    descriptor === undefined ||
    typeof descriptor.get === "function" ||
    typeof descriptor.set === "function" ||
    !("value" in descriptor)
  ) {
    fail(`${label}.${field} must be an own data property`);
  }
  return descriptor.value;
}

function snapshotArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype) {
    fail(`${label} must use Array.prototype`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      fail(`${label} has a sparse hole at index ${index}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (
      descriptor === undefined ||
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

function snapshotCraftingRecipeRow(
  row: unknown,
  rowIndex: number,
): {
  readonly CraftingRecipeKey: number;
  readonly ItemCraftingType: string;
  readonly RecipeTier: number;
  readonly Material: string;
  readonly MaterialIndex: number | string;
  readonly DropKey: number;
  readonly rowIndex: number;
} {
  assertExactOwnFields(row, CRAFTING_RECIPE_FIELDS, "crafting_recipes row");
  const materialIndexRaw = row.MaterialIndex;
  if (!(
    (typeof materialIndexRaw === "number" &&
      Number.isSafeInteger(materialIndexRaw) &&
      materialIndexRaw >= 0) ||
    (typeof materialIndexRaw === "string" && materialIndexRaw.length > 0)
  )) {
    fail(
      `crafting_recipes row ${rowIndex} MaterialIndex must be a non-negative safe integer or non-empty string`,
    );
  }
  return {
    CraftingRecipeKey: positiveSafeInteger(
      row.CraftingRecipeKey,
      "crafting_recipes.CraftingRecipeKey",
    ),
    ItemCraftingType: nonemptyString(
      row.ItemCraftingType,
      "crafting_recipes.ItemCraftingType",
    ),
    RecipeTier: positiveSafeInteger(
      row.RecipeTier,
      "crafting_recipes.RecipeTier",
    ),
    Material: nonemptyString(row.Material, "crafting_recipes.Material"),
    MaterialIndex: materialIndexRaw as number | string,
    DropKey: positiveSafeInteger(row.DropKey, "crafting_recipes.DropKey"),
    rowIndex,
  };
}

interface TrustedCraftingCatalog {
  readonly recipes: readonly ReturnType<typeof snapshotCraftingRecipeRow>[];
  readonly indexes: DiscordHeroCatalogIndexes;
}

function loadTrustedCatalog(
  indexes: DiscordHeroCatalogIndexes,
): TrustedCraftingCatalog {
  assertExactOwnFields(
    indexes,
    ["catalog", "tables", "semanticReport"],
    "crafting browser indexes",
  );
  const tables = snapshotOwnDataProperty(
    indexes,
    "tables",
    "crafting browser indexes",
  );
  assertRecord(tables, "crafting browser indexes.tables");
  const tablesPrototype = Object.getPrototypeOf(tables);
  if (tablesPrototype !== Object.prototype && tablesPrototype !== null) {
    fail(
      "crafting browser indexes.tables prototype must be Object.prototype or null",
    );
  }

  const craftingTable = snapshotOwnDataProperty(
    tables,
    "crafting_recipes",
    "crafting browser indexes.tables",
  );
  assertExactOwnFields(
    craftingTable,
    ["name", "primaryField", "rows", "groups"],
    "crafting browser indexes.tables.crafting_recipes",
  );
  const name = snapshotOwnDataProperty(
    craftingTable,
    "name",
    "crafting browser indexes.tables.crafting_recipes",
  );
  const primaryField = snapshotOwnDataProperty(
    craftingTable,
    "primaryField",
    "crafting browser indexes.tables.crafting_recipes",
  );
  if (name !== "crafting_recipes") {
    fail("crafting_recipes table name must be crafting_recipes");
  }
  if (primaryField !== "CraftingRecipeKey") {
    fail("crafting_recipes.primaryField must be CraftingRecipeKey");
  }
  const rows = snapshotArray(
    snapshotOwnDataProperty(
      craftingTable,
      "rows",
      "crafting browser indexes.tables.crafting_recipes",
    ),
    "crafting_recipes.rows",
  );
  if (rows.length !== DISCORD_HERO_CRAFTING_RECIPE_COUNT) {
    fail(
      `crafting_recipes must contain exactly ${DISCORD_HERO_CRAFTING_RECIPE_COUNT} rows; received ${rows.length}`,
    );
  }

  const recipes = rows.map((row, rowIndex) =>
    snapshotCraftingRecipeRow(row, rowIndex),
  );
  const seen = new Set<number>();
  for (const recipe of recipes) {
    if (seen.has(recipe.CraftingRecipeKey)) {
      fail(`duplicate CraftingRecipeKey ${recipe.CraftingRecipeKey}`);
    }
    seen.add(recipe.CraftingRecipeKey);
  }

  return { recipes, indexes };
}

function resolveMaterialItem(
  indexes: DiscordHeroCatalogIndexes,
  itemKey: number,
): DiscordHeroCraftingMaterialItem {
  const group = indexes.tables.items.groups.get(itemKey);
  if (group === undefined || group.length === 0) {
    return Object.freeze({
      kind: "unresolved-source" as const,
      itemKey,
      reason: `items key ${itemKey} is missing from the source catalog`,
    });
  }
  const row = group[0]!;
  try {
    const name = getLocalizedCatalogName(indexes, "items", itemKey, "en-US");
    const type = nonemptyString(
      (row as { type?: unknown }).type,
      `items ${itemKey} type`,
    );
    const grade = nonemptyString(
      (row as { grade?: unknown }).grade,
      `items ${itemKey} grade`,
    );
    return Object.freeze({
      kind: "resolved" as const,
      itemKey,
      name,
      type,
      grade,
    });
  } catch (error) {
    return Object.freeze({
      kind: "unresolved-source" as const,
      itemKey,
      reason:
        error instanceof Error
          ? error.message
          : `items key ${itemKey} could not be resolved`,
    });
  }
}

function projectDropReference(
  indexes: DiscordHeroCatalogIndexes,
  dropKey: number,
): DiscordHeroCraftingDropReference {
  const group = indexes.tables.drops.groups.get(dropKey);
  if (group === undefined || group.length === 0) {
    return Object.freeze({
      kind: "source-drop-reference" as const,
      dropKey,
      selectionStatus: "unresolved-reference" as const,
      sourceRowCount: 0,
      rewardEntryCount: 0,
      dropTypes: Object.freeze([] as string[]),
      multiMemberRewardCount: 0,
      heroConditionRowCount: 0,
      classifierHint: "mixed-or-conditional" as const,
    });
  }

  // One snapshot of row fields for counts only — never select a reward.
  const dropTypes = new Set<string>();
  let multiMemberRewardCount = 0;
  let heroConditionRowCount = 0;
  let pureCandidate = true;
  for (const row of group) {
    const dropType = String(
      (row as { DropType?: unknown }).DropType ?? "unknown",
    );
    dropTypes.add(dropType);
    const hero = (row as { HeroKeyCondition?: unknown }).HeroKeyCondition;
    if (hero !== null && hero !== 0) {
      heroConditionRowCount += 1;
      pureCandidate = false;
    }
    if (dropType !== "EachDropOneWeight") {
      pureCandidate = false;
    }
    const rewardType = (row as { REWARDTYPE?: unknown }).REWARDTYPE;
    const rewardKey = (row as { RewardKey?: unknown }).RewardKey;
    if (rewardType === "ITEMGROUP" && typeof rewardKey === "number") {
      const members = indexes.tables.item_groups.groups.get(rewardKey);
      const memberCount = members?.length ?? 0;
      if (memberCount !== 1) {
        multiMemberRewardCount += 1;
        pureCandidate = false;
      }
    }
  }

  return Object.freeze({
    kind: "source-drop-reference" as const,
    dropKey,
    selectionStatus: "unresolved-reference" as const,
    sourceRowCount: group.length,
    rewardEntryCount: group.length,
    dropTypes: Object.freeze([...dropTypes].sort()),
    multiMemberRewardCount,
    heroConditionRowCount,
    classifierHint: pureCandidate
      ? ("pure-weighted-candidate" as const)
      : ("mixed-or-conditional" as const),
  });
}

function projectEntry(
  indexes: DiscordHeroCatalogIndexes,
  recipe: ReturnType<typeof snapshotCraftingRecipeRow>,
): DiscordHeroCraftingRecipeEntry {
  // Material is already snapshotted once on the trusted recipe.
  const requirements = parseMaterialRequirements(recipe.Material);
  const parsedMaterials = requirements.map((requirement) =>
    Object.freeze({
      itemKey: requirement.itemKey,
      quantity: requirement.quantity,
      item: resolveMaterialItem(indexes, requirement.itemKey),
    }),
  );

  return Object.freeze({
    rowIndex: recipe.rowIndex,
    craftingRecipeKey: recipe.CraftingRecipeKey,
    itemCraftingType: recipe.ItemCraftingType,
    recipeTier: recipe.RecipeTier,
    materialIndex: recipe.MaterialIndex,
    rawMaterial: recipe.Material,
    parsedMaterials: Object.freeze(parsedMaterials),
    dropKey: recipe.DropKey,
    dropReference: projectDropReference(indexes, recipe.DropKey),
  });
}

function parsePageInput(pageOrInput: unknown): number {
  if (typeof pageOrInput === "number") {
    return nonNegativeSafeInteger(pageOrInput, "crafting browser page");
  }
  assertExactOwnFields(pageOrInput, ["page"], "crafting browser page input");
  return nonNegativeSafeInteger(
    pageOrInput.page,
    "crafting browser page input.page",
  );
}

function parseDetailInput(input: unknown): number {
  assertExactOwnFields(
    input,
    ["craftingRecipeKey"],
    "crafting browser detail input",
  );
  return positiveSafeInteger(
    input.craftingRecipeKey,
    "crafting browser detail input.craftingRecipeKey",
  );
}

export function projectDiscordHeroCraftingBrowser(
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroCraftingBrowser {
  loadTrustedCatalog(indexes);
  return deepFreeze({
    recipeCount: DISCORD_HERO_CRAFTING_RECIPE_COUNT,
    pageCount: 3 as const,
    pageSize: DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE,
    disclaimer: DISCORD_HERO_CRAFTING_BROWSER_DISCLAIMER,
  });
}

export function discordHeroCraftingRecipePageCount(
  indexes: DiscordHeroCatalogIndexes,
): number {
  loadTrustedCatalog(indexes);
  return 3;
}

export function discordHeroCraftingRecipePage(
  indexes: DiscordHeroCatalogIndexes,
  pageOrInput: number | { readonly page: number },
): DiscordHeroCraftingRecipePage {
  const catalog = loadTrustedCatalog(indexes);
  const page = parsePageInput(pageOrInput);
  const pageCount = 3;
  if (page >= pageCount) {
    fail(`crafting browser page ${page} is outside 0-${pageCount - 1}`);
  }
  const start = page * DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE;
  const slice = catalog.recipes.slice(
    start,
    start + DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE,
  );
  if (slice.length > DISCORD_HERO_CRAFTING_BROWSER_PAGE_SIZE) {
    fail("crafting browser page exceeded page size 25");
  }
  const rows = slice.map((recipe) => projectEntry(catalog.indexes, recipe));
  return deepFreeze({
    page,
    pageCount: 3 as const,
    rowCount: DISCORD_HERO_CRAFTING_RECIPE_COUNT,
    rows: Object.freeze(rows),
  });
}

export function discordHeroCraftingRecipeDetail(
  indexes: DiscordHeroCatalogIndexes,
  input: { readonly craftingRecipeKey: number },
): DiscordHeroCraftingRecipeEntry {
  const catalog = loadTrustedCatalog(indexes);
  const craftingRecipeKey = parseDetailInput(input);
  const recipe = catalog.recipes.find(
    (candidate) => candidate.CraftingRecipeKey === craftingRecipeKey,
  );
  if (recipe === undefined) {
    fail(
      `crafting browser detail references unknown CraftingRecipeKey ${craftingRecipeKey}`,
    );
  }
  return deepFreeze(projectEntry(catalog.indexes, recipe));
}

export function discordHeroCraftingRecipeTextRows(
  indexes: DiscordHeroCatalogIndexes,
  pageOrInput: number | { readonly page: number },
): readonly string[] {
  const page = discordHeroCraftingRecipePage(indexes, pageOrInput);
  return Object.freeze(
    page.rows.map((row) => {
      const materials = row.parsedMaterials
        .map((material) => {
          const label =
            material.item.kind === "resolved"
              ? material.item.name
              : `item#${material.itemKey}`;
          return `${label} x${material.quantity}`;
        })
        .join(", ");
      const line = formatDiscordSafePlainText(
        `#${row.rowIndex} recipe ${row.craftingRecipeKey} · ${row.itemCraftingType} T${row.recipeTier} · mats ${materials} · drop ${row.dropKey} [${row.dropReference.selectionStatus}] · source preview`,
      );
      return line;
    }),
  );
}
