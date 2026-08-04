import { types as nodeUtilTypes } from "node:util";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  projectOwnedRuneSourceEffects,
  type OwnedRuneAllocation,
  type RuneSourceEffect,
} from "../domain/rune-effects";

export const DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE = 25;

/**
 * Canonical rune-node ceiling for a caller-supplied owned set.
 *
 * The source catalog pins exactly 197 rune rows (`EXPECTED_DATASET_ROWS.runes`
 * in ../catalog/compiler) and the domain projection already refuses owned sets
 * larger than that. Neither exposes an importable constant, so the cap is named
 * here and must stay in step with those two authorities. It is enforced before
 * any per-index materialization so a caller cannot force an oversized
 * allocation from a merely-declared array length.
 */
const MAX_OWNED_RUNE_NODES = 197;

export interface DiscordHeroRuneEffectRow {
  readonly rowIndex: number;
  readonly effect: RuneSourceEffect;
}

export interface DiscordHeroRuneEffectsBrowser {
  readonly effectCount: number;
  readonly pageCount: number;
  readonly pageSize: 25;
}

export interface DiscordHeroRuneEffectsPage {
  readonly page: number;
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rows: readonly DiscordHeroRuneEffectRow[];
}

export interface DiscordHeroRuneEffectsPageInput {
  readonly page: number;
}

export interface DiscordHeroRuneEffectDetailInput {
  readonly rowIndex: number;
  readonly runeKey: number;
  readonly sourceLevel: number;
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
  if (
    ((typeof value === "object" && value !== null) ||
      typeof value === "function") &&
    nodeUtilTypes.isProxy(value)
  ) {
    fail(`${label} must not be a proxy or TOCTOU-capable object`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object; received ${describeValueType(value)}`);
  }
}

function readExactOwnDataFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
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
  const descriptors = new Map(
    actualFields.map((field) => [
      field,
      Object.getOwnPropertyDescriptor(value, field),
    ]),
  );
  if (
    [...descriptors.values()].some(
      (descriptor) =>
        descriptor === undefined ||
        typeof descriptor.get === "function" ||
        typeof descriptor.set === "function" ||
        !("value" in descriptor),
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
    (field) => !descriptors.has(field),
  );
  if (missingFields.length > 0) {
    fail(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }

  const snapshot: Record<string, unknown> = {};
  for (const field of expectedFields) {
    const descriptor = descriptors.get(field)!;
    snapshot[field] = (
      descriptor as PropertyDescriptor & { value: unknown }
    ).value;
  }
  return Object.freeze(snapshot);
}

function snapshotOwnedRunes(value: unknown): readonly OwnedRuneAllocation[] {
  if (
    typeof value === "object" &&
    value !== null &&
    nodeUtilTypes.isProxy(value)
  ) {
    fail("ownedRunes must not be a proxy or TOCTOU-capable object");
  }
  if (!Array.isArray(value)) {
    fail(`ownedRunes must be an array; received ${describeValueType(value)}`);
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    fail("ownedRunes must use Array.prototype");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.get === "function" ||
    typeof lengthDescriptor.set === "function" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    fail("ownedRunes length must be a non-negative safe integer");
  }
  const length = lengthDescriptor.value as number;
  // Cap before any materialization: the allowedFields Set below expands to one
  // entry per declared index, so an oversized length must be refused here
  // rather than after the allocation.
  if (length > MAX_OWNED_RUNE_NODES) {
    throw new Error(
      `ownedRunes must not exceed the canonical ${MAX_OWNED_RUNE_NODES} source rune nodes; received ${length}`,
    );
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    fail("ownedRunes must not contain symbol own keys");
  }
  const allowedFields = new Set([
    "length",
    ...Array.from({ length }, (_, index) => String(index)),
  ]);
  const unknownFields = (ownKeys as string[])
    .filter((field) => !allowedFields.has(field))
    .sort();
  if (unknownFields.length > 0) {
    fail(
      `ownedRunes has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }

  const snapshot: OwnedRuneAllocation[] = [];
  for (let index = 0; index < length; index += 1) {
    const field = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (descriptor === undefined) {
      fail(`ownedRunes has a sparse hole at index ${index}`);
    }
    if (
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      fail(`ownedRunes[${index}] must be an own data property`);
    }
    const entry = readExactOwnDataFields(
      descriptor.value,
      ["key", "level"],
      `ownedRunes[${index}]`,
    );
    snapshot.push(
      Object.freeze({
        key: entry.key as number,
        level: entry.level as number,
      }),
    );
  }
  return Object.freeze(snapshot);
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(
      `${label} must be a non-negative safe integer; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fail(
      `${label} must be a positive safe integer; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function parsePageInput(value: unknown): number {
  const snapshot = readExactOwnDataFields(
    value,
    ["page"],
    "rune-effects page input",
  );
  return nonNegativeSafeInteger(snapshot.page, "rune-effects page input.page");
}

function parseDetailInput(value: unknown): DiscordHeroRuneEffectDetailInput {
  const snapshot = readExactOwnDataFields(
    value,
    ["rowIndex", "runeKey", "sourceLevel"],
    "rune-effects detail input",
  );
  return {
    rowIndex: nonNegativeSafeInteger(
      snapshot.rowIndex,
      "rune-effects detail input.rowIndex",
    ),
    runeKey: positiveSafeInteger(
      snapshot.runeKey,
      "rune-effects detail input.runeKey",
    ),
    sourceLevel: positiveSafeInteger(
      snapshot.sourceLevel,
      "rune-effects detail input.sourceLevel",
    ),
  };
}

function cloneSourceEffect(effect: RuneSourceEffect): RuneSourceEffect {
  if (effect.kind === "source-layer-modifier") {
    return {
      ...effect,
      provenance: { ...effect.provenance },
      modifierEvidence: effect.modifierEvidence.map((entry) => ({ ...entry })),
    };
  }
  return {
    ...effect,
    provenance: { ...effect.provenance },
  };
}

function loadRows(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: unknown,
): readonly DiscordHeroRuneEffectRow[] {
  const ownedSnapshot = snapshotOwnedRunes(ownedRunes);
  const projection = projectOwnedRuneSourceEffects({
    indexes,
    ownedRunes: ownedSnapshot,
  });
  return deepFreeze(
    projection.sourceEffects.map((effect, rowIndex) => ({
      rowIndex,
      effect: cloneSourceEffect(effect),
    })),
  );
}

function pageCountFor(rowCount: number): number {
  return Math.ceil(rowCount / DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE);
}

function requireAvailablePage(
  page: number,
  pageCount: number,
  rowCount: number,
): void {
  if (pageCount === 0) {
    fail(
      `rune-effects page ${page} is unavailable because the owned source row count is ${rowCount}`,
    );
  }
  if (page >= pageCount) {
    fail(`rune-effects page ${page} is outside 0-${pageCount - 1}`);
  }
}

function sourceMetadata(effect: RuneSourceEffect): string {
  switch (effect.kind) {
    case "source-layer-modifier":
      return `${effect.sourceLayer}/${effect.unit}`;
    case "offline-source-metadata":
    case "alchemy-source-metadata":
    case "arrange-slot-source-metadata":
      return `${effect.consumer}/${effect.unit}`;
    case "unresolved-source-unit":
      return `unresolved-source · ${effect.reason}`;
  }
}

export function projectDiscordHeroRuneEffectsBrowser(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly OwnedRuneAllocation[],
): DiscordHeroRuneEffectsBrowser {
  const rows = loadRows(indexes, ownedRunes);
  return deepFreeze({
    effectCount: rows.length,
    pageCount: pageCountFor(rows.length),
    pageSize: DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE,
  });
}

export function discordHeroRuneEffectsPageCount(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly OwnedRuneAllocation[],
): number {
  return pageCountFor(loadRows(indexes, ownedRunes).length);
}

export function discordHeroRuneEffectsPage(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly OwnedRuneAllocation[],
  input: DiscordHeroRuneEffectsPageInput,
): DiscordHeroRuneEffectsPage {
  const page = parsePageInput(input);
  const rows = loadRows(indexes, ownedRunes);
  const pageCount = pageCountFor(rows.length);
  requireAvailablePage(page, pageCount, rows.length);
  const start = page * DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE;
  return deepFreeze({
    page,
    pageCount,
    rowCount: rows.length,
    rows: rows.slice(start, start + DISCORD_HERO_RUNE_EFFECTS_PAGE_SIZE),
  });
}

export function discordHeroRuneEffectDetail(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly OwnedRuneAllocation[],
  input: DiscordHeroRuneEffectDetailInput,
): DiscordHeroRuneEffectRow {
  const { rowIndex, runeKey, sourceLevel } = parseDetailInput(input);
  const rows = loadRows(indexes, ownedRunes);
  if (rowIndex >= rows.length) {
    fail(`rune-effects detail row ${rowIndex} is outside 0-${rows.length - 1}`);
  }
  const row = rows[rowIndex]!;
  if (
    row.effect.runeKey !== runeKey ||
    row.effect.sourceLevel !== sourceLevel
  ) {
    fail(
      `rune-effects detail row ${rowIndex} identity mismatch; expected rune ${runeKey} source level ${sourceLevel}, received rune ${row.effect.runeKey} source level ${row.effect.sourceLevel}`,
    );
  }
  return deepFreeze(row);
}

export function discordHeroRuneEffectsTextRows(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly OwnedRuneAllocation[],
  input: DiscordHeroRuneEffectsPageInput,
): readonly string[] {
  const page = discordHeroRuneEffectsPage(indexes, ownedRunes, input);
  return Object.freeze(
    page.rows.map(({ rowIndex, effect }) =>
      formatDiscordSafePlainText(
        `#${rowIndex} rune ${effect.runeKey} · level ${effect.sourceLevel}/${effect.ownedLevel} · ${effect.statType} · raw ${effect.rawValue} · ${sourceMetadata(effect)}`,
      ),
    ),
  );
}
