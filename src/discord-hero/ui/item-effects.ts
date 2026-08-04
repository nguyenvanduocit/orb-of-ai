import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  projectEquippedGearItemEffects,
  type EquippedGearItemEffectProjection,
  type EquippedGearItemEffectsInput,
  type ItemEffect,
} from "../domain/item-effects";
import type { PlayerState } from "../domain/player";

export const DISCORD_HERO_ITEM_EFFECTS_PAGE_SIZE = 25;

export const DISCORD_HERO_ITEM_EFFECT_SOURCE_VECTORS = [
  "base",
  "inherent",
  "rolled",
] as const;

export type DiscordHeroItemEffectSourceVector =
  (typeof DISCORD_HERO_ITEM_EFFECT_SOURCE_VECTORS)[number];

export interface DiscordHeroItemEffectsInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly state: PlayerState;
  readonly heroKey: number;
  readonly instanceId: string;
}

export interface DiscordHeroItemEffectPageInput {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly page: number;
}

export interface DiscordHeroItemEffectDetailInput {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly rowIndex: number;
}

export interface DiscordHeroItemEffectRow {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly rowIndex: number;
  readonly effect: ItemEffect;
}

export interface DiscordHeroItemEffectVectorMeta {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly rowCount: number;
  readonly pageCount: number;
}

export interface DiscordHeroItemEffectsBrowser {
  readonly source: "Item";
  readonly heroKey: number;
  readonly instanceId: string;
  readonly itemKey: number;
  readonly gearType: string;
  readonly itemLevel: number;
  readonly provenance: EquippedGearItemEffectProjection["provenance"];
  readonly vectors: readonly DiscordHeroItemEffectVectorMeta[];
  readonly oracleGates: EquippedGearItemEffectProjection["oracleGates"];
  readonly oracleTextRows: readonly string[];
}

export interface DiscordHeroItemEffectsPage {
  readonly sourceVector: DiscordHeroItemEffectSourceVector;
  readonly page: number;
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rows: readonly DiscordHeroItemEffectRow[];
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

function fail(message: string): never {
  throw new Error(formatDiscordSafePlainText(message));
}

function describeValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value);
    }
  }
  return Object.freeze(value);
}

function detachedFrozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function snapshotExactOwnFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
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
  const fields = ownKeys as string[];
  const descriptors = new Map(
    fields.map((field) => [
      field,
      Object.getOwnPropertyDescriptor(value, field),
    ]),
  );
  if (
    [...descriptors.values()].some(
      (descriptor) =>
        descriptor === undefined ||
        typeof descriptor.get === "function" ||
        typeof descriptor.set === "function",
    )
  ) {
    fail(`${label} must use own data properties without accessors`);
  }
  const unknownFields = fields
    .filter((field) => !expectedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    fail(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !descriptors.has(field),
  );
  if (missingFields.length > 0) {
    fail(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const field of expectedFields) {
    snapshot[field] = descriptors.get(field)!.value;
  }
  return Object.freeze(snapshot);
}

function requirePositiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fail(
      `${label} must be a positive safe integer; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function requireNonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(
      `${label} must be a non-negative safe integer; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function requireInstanceId(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    fail(`${label} must be a canonical stable instance ID`);
  }
  return value;
}

function requireSourceVector(
  value: unknown,
  label: string,
): DiscordHeroItemEffectSourceVector {
  if (
    typeof value !== "string" ||
    !(DISCORD_HERO_ITEM_EFFECT_SOURCE_VECTORS as readonly string[]).includes(
      value,
    )
  ) {
    fail(
      `${label} must be a known source vector string; received ${describeValueType(value)}`,
    );
  }
  return value as DiscordHeroItemEffectSourceVector;
}

function parseProjectionInput(value: unknown): EquippedGearItemEffectsInput {
  const snapshot = snapshotExactOwnFields(
    value,
    ["indexes", "state", "heroKey", "instanceId"],
    "item-effects input",
  );
  return Object.freeze({
    indexes: snapshot.indexes as DiscordHeroCatalogIndexes,
    state: snapshot.state as PlayerState,
    heroKey: requirePositiveSafeInteger(
      snapshot.heroKey,
      "item-effects input.heroKey",
    ),
    instanceId: requireInstanceId(
      snapshot.instanceId,
      "item-effects input.instanceId",
    ),
  });
}

function parsePageInput(value: unknown): DiscordHeroItemEffectPageInput {
  const snapshot = snapshotExactOwnFields(
    value,
    ["sourceVector", "page"],
    "item-effects page input",
  );
  return Object.freeze({
    sourceVector: requireSourceVector(
      snapshot.sourceVector,
      "item-effects page input.sourceVector",
    ),
    page: requireNonNegativeSafeInteger(
      snapshot.page,
      "item-effects page input.page",
    ),
  });
}

function parseDetailInput(value: unknown): DiscordHeroItemEffectDetailInput {
  const snapshot = snapshotExactOwnFields(
    value,
    ["sourceVector", "rowIndex"],
    "item-effects detail input",
  );
  return Object.freeze({
    sourceVector: requireSourceVector(
      snapshot.sourceVector,
      "item-effects detail input.sourceVector",
    ),
    rowIndex: requireNonNegativeSafeInteger(
      snapshot.rowIndex,
      "item-effects detail input.rowIndex",
    ),
  });
}

function project(
  input: EquippedGearItemEffectsInput,
): EquippedGearItemEffectProjection {
  try {
    return detachedFrozen(projectEquippedGearItemEffects(input));
  } catch (error) {
    if (error instanceof Error) fail(error.message);
    fail(`item-effects projection failed with ${describeValueType(error)}`);
  }
}

function sourceVectorFor(
  effect: ItemEffect,
): DiscordHeroItemEffectSourceVector {
  switch (effect.provenance.kind) {
    case "gear-base":
      return "base";
    case "gear-inherent":
      return "inherent";
    case "rolled-stat":
      return "rolled";
  }
}

function rowsFor(
  projection: EquippedGearItemEffectProjection,
  sourceVector: DiscordHeroItemEffectSourceVector,
): readonly DiscordHeroItemEffectRow[] {
  return Object.freeze(
    projection.effects
      .filter((effect) => sourceVectorFor(effect) === sourceVector)
      .map((effect, rowIndex) =>
        Object.freeze({
          sourceVector,
          rowIndex,
          effect,
        }),
      ),
  );
}

function pageCountFor(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / DISCORD_HERO_ITEM_EFFECTS_PAGE_SIZE));
}

function oracleTextRows(
  projection: EquippedGearItemEffectProjection,
): readonly string[] {
  return Object.freeze(
    projection.oracleGates.map((gate) =>
      formatDiscordSafePlainText(
        `unique-mod ${gate.uniqueModKey} · [oracle-required] · ${gate.reason}`,
      ),
    ),
  );
}

export function projectDiscordHeroItemEffectsBrowser(
  input: DiscordHeroItemEffectsInput,
): DiscordHeroItemEffectsBrowser {
  const projection = project(parseProjectionInput(input));
  const vectors = DISCORD_HERO_ITEM_EFFECT_SOURCE_VECTORS.map(
    (sourceVector) => {
      const rowCount = rowsFor(projection, sourceVector).length;
      return {
        sourceVector,
        rowCount,
        pageCount: pageCountFor(rowCount),
      };
    },
  );
  return deepFreeze({
    source: projection.source,
    heroKey: projection.heroKey,
    instanceId: projection.instanceId,
    itemKey: projection.itemKey,
    gearType: projection.gearType,
    itemLevel: projection.itemLevel,
    provenance: projection.provenance,
    vectors,
    oracleGates: projection.oracleGates,
    oracleTextRows: oracleTextRows(projection),
  });
}

export function discordHeroItemEffectsPageCount(
  input: DiscordHeroItemEffectsInput,
  sourceVector: DiscordHeroItemEffectSourceVector,
): number {
  const parsedInput = parseProjectionInput(input);
  const parsedSourceVector = requireSourceVector(
    sourceVector,
    "item-effects source vector",
  );
  return pageCountFor(rowsFor(project(parsedInput), parsedSourceVector).length);
}

export function discordHeroItemEffectsPage(
  input: DiscordHeroItemEffectsInput,
  pageInput: DiscordHeroItemEffectPageInput,
): DiscordHeroItemEffectsPage {
  const parsedInput = parseProjectionInput(input);
  const { sourceVector, page } = parsePageInput(pageInput);
  const rows = rowsFor(project(parsedInput), sourceVector);
  const pageCount = pageCountFor(rows.length);
  if (page >= pageCount) {
    fail(
      `item-effects ${sourceVector} page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * DISCORD_HERO_ITEM_EFFECTS_PAGE_SIZE;
  return deepFreeze({
    sourceVector,
    page,
    pageCount,
    rowCount: rows.length,
    rows: rows.slice(start, start + DISCORD_HERO_ITEM_EFFECTS_PAGE_SIZE),
  });
}

export function discordHeroItemEffectsDetail(
  input: DiscordHeroItemEffectsInput,
  detailInput: DiscordHeroItemEffectDetailInput,
): DiscordHeroItemEffectRow {
  const parsedInput = parseProjectionInput(input);
  const { sourceVector, rowIndex } = parseDetailInput(detailInput);
  const rows = rowsFor(project(parsedInput), sourceVector);
  if (rowIndex >= rows.length) {
    fail(
      `item-effects ${sourceVector} row ${rowIndex} is outside 0-${rows.length - 1}`,
    );
  }
  return detachedFrozen(rows[rowIndex]!);
}

export function discordHeroItemEffectsTextRows(
  input: DiscordHeroItemEffectsInput,
  pageInput: DiscordHeroItemEffectPageInput,
): readonly string[] {
  const page = discordHeroItemEffectsPage(input, pageInput);
  return Object.freeze(
    page.rows.map((row) => {
      const { effect } = row;
      const reasons =
        effect.kind === "unsupported-source"
          ? ` · ${effect.reasons.join("; ")}`
          : "";
      return formatDiscordSafePlainText(
        `#${row.rowIndex} ${row.sourceVector} · ${effect.statType}/${effect.modifierType} · raw ${effect.rawValue} ${effect.unit} · [${effect.kind}]${reasons}`,
      );
    }),
  );
}
