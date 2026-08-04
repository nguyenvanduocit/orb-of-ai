import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  projectSourceEffectTopology,
  type SourceBuffEffect,
  type SourceBuffGroupRow,
  type SourceBuffReference,
  type SourceBuffRuntimeValue,
  type SourceEffectTopology,
  type SourceEffectTopologyCounts,
  type SourceMonsterSkillReference,
  type SourceSkillBuffGroupReference,
  type SourceSkillEffect,
  type SourceStatusEffect,
} from "../domain/source-effects";

export const DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE = 25;

export const DISCORD_HERO_SOURCE_EFFECTS_SECTIONS = [
  "skills",
  "buff-groups",
  "buffs",
  "status-effects",
  "monster-skill-references",
] as const;

export type DiscordHeroSourceEffectsSection =
  (typeof DISCORD_HERO_SOURCE_EFFECTS_SECTIONS)[number];

export type DiscordHeroSourceEffectsResolutionLabel =
  "resolved" | "unresolved-source" | "runtime-value-unresolved";

export interface DiscordHeroSourceEffectsSkillRow {
  readonly section: "skills";
  readonly rowIndex: number;
  readonly skillKey: number | string;
  readonly activationType: string;
  readonly activationValue: number | null;
  readonly skillBuffType: string;
  readonly buffGroupKey: number | null;
  readonly damageType: string;
  readonly deliveryType: string | null;
  readonly range: number;
  readonly value: number | string | null;
  readonly buffGroupReference: SourceSkillBuffGroupReference;
  readonly resolutionLabel: "resolved";
}

export interface DiscordHeroSourceEffectsBuffGroupRow {
  readonly section: "buff-groups";
  readonly rowIndex: number;
  readonly buffGroupKey: number;
  readonly rawBuffKeys: number | string | null;
  readonly buffReferences: readonly SourceBuffReference[];
  readonly resolutionLabel: "resolved" | "unresolved-source";
}

export interface DiscordHeroSourceEffectsBuffRow {
  readonly section: "buffs";
  readonly rowIndex: number;
  readonly buffKey: number;
  readonly buffType: string;
  readonly statType: string;
  readonly modType: string;
  readonly value: number | null;
  readonly runtimeValue: SourceBuffRuntimeValue;
  readonly resolutionLabel: "resolved" | "runtime-value-unresolved";
}

export interface DiscordHeroSourceEffectsStatusRow {
  readonly section: "status-effects";
  readonly rowIndex: number;
  readonly statusEffectKey: number;
  readonly statusEffectType: string;
  readonly duration: number;
  readonly rawBuffKeys: number | string | null;
  readonly overrideType: string;
  readonly params: readonly [number | null, number | null, null, null];
  readonly buffReferences: readonly {
    readonly kind: "resolved";
    readonly buffKey: number;
  }[];
  readonly resolutionLabel: "resolved";
}

export type DiscordHeroSourceEffectsMonsterSkillRow =
  | {
      readonly section: "monster-skill-references";
      readonly rowIndex: number;
      readonly kind: "resolved";
      readonly monsterKey: number;
      readonly rawSkillKeys: number | string;
      readonly referenceIndex: number;
      readonly skillKey: number;
      readonly resolutionLabel: "resolved";
    }
  | {
      readonly section: "monster-skill-references";
      readonly rowIndex: number;
      readonly kind: "unresolved-source";
      readonly monsterKey: number;
      readonly rawSkillKeys: number | string;
      readonly referenceIndex: number;
      readonly skillKey: number;
      readonly apparentSkillKey: string;
      readonly ruleId: "monsters.SkillKey->skills";
      readonly reason: string;
      readonly resolutionLabel: "unresolved-source";
    };

export type DiscordHeroSourceEffectsRow =
  | DiscordHeroSourceEffectsSkillRow
  | DiscordHeroSourceEffectsBuffGroupRow
  | DiscordHeroSourceEffectsBuffRow
  | DiscordHeroSourceEffectsStatusRow
  | DiscordHeroSourceEffectsMonsterSkillRow;

export interface DiscordHeroSourceEffectsSectionMeta {
  readonly section: DiscordHeroSourceEffectsSection;
  readonly rowCount: number;
  readonly pageCount: number;
}

export interface DiscordHeroSourceEffectsBrowser {
  readonly counts: SourceEffectTopologyCounts;
  readonly sections: readonly DiscordHeroSourceEffectsSectionMeta[];
}

export interface DiscordHeroSourceEffectsPage {
  readonly section: DiscordHeroSourceEffectsSection;
  readonly page: number;
  readonly pageCount: number;
  readonly rowCount: number;
  readonly rows: readonly DiscordHeroSourceEffectsRow[];
}

export interface DiscordHeroSourceEffectsFilterPage extends DiscordHeroSourceEffectsPage {
  readonly resolutionLabel: DiscordHeroSourceEffectsResolutionLabel;
  readonly totalMatching: number;
}

export interface DiscordHeroSourceEffectsSectionSummary {
  readonly section: DiscordHeroSourceEffectsSection;
  readonly rowCount: number;
  readonly pageCount: number;
  readonly resolvedCount: number;
  readonly unresolvedSourceCount: number;
  readonly runtimeValueUnresolvedCount: number;
}

interface PageInput {
  readonly section: DiscordHeroSourceEffectsSection;
  readonly page: number;
}

interface FilterInput extends PageInput {
  readonly resolutionLabel: DiscordHeroSourceEffectsResolutionLabel;
}

interface DetailInput {
  readonly section: DiscordHeroSourceEffectsSection;
  readonly rowIndex: number;
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
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
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

function requireSection(
  value: unknown,
  label: string,
): DiscordHeroSourceEffectsSection {
  if (
    typeof value !== "string" ||
    !(DISCORD_HERO_SOURCE_EFFECTS_SECTIONS as readonly string[]).includes(value)
  ) {
    fail(
      `${label} must be a known section string; received ${describeValueType(value)}`,
    );
  }
  return value as DiscordHeroSourceEffectsSection;
}

function requireNonNegativePage(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(
      `${label} must be a non-negative safe integer; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function requireResolutionLabel(
  value: unknown,
  label: string,
): DiscordHeroSourceEffectsResolutionLabel {
  if (
    value !== "resolved" &&
    value !== "unresolved-source" &&
    value !== "runtime-value-unresolved"
  ) {
    fail(
      `${label} must be a known resolution label string; received ${describeValueType(value)}`,
    );
  }
  return value;
}

function loadTopology(
  indexes: DiscordHeroCatalogIndexes,
): SourceEffectTopology {
  return projectSourceEffectTopology({ indexes });
}

function skillRow(
  skill: SourceSkillEffect,
  rowIndex: number,
): DiscordHeroSourceEffectsSkillRow {
  return Object.freeze({
    section: "skills",
    rowIndex,
    skillKey: skill.skillKey,
    activationType: skill.activationType,
    activationValue: skill.activationValue,
    skillBuffType: skill.skillBuffType,
    buffGroupKey: skill.buffGroupKey,
    damageType: skill.damageType,
    deliveryType: skill.deliveryType,
    range: skill.range,
    value: skill.value,
    buffGroupReference: skill.buffGroupReference,
    resolutionLabel: "resolved",
  });
}

function buffGroupRow(
  row: SourceBuffGroupRow,
): DiscordHeroSourceEffectsBuffGroupRow {
  const hasUnresolved = row.buffReferences.some(
    (reference) => reference.kind === "unresolved-source",
  );
  return Object.freeze({
    section: "buff-groups",
    rowIndex: row.rowIndex,
    buffGroupKey: row.buffGroupKey,
    rawBuffKeys: row.rawBuffKeys,
    buffReferences: row.buffReferences,
    resolutionLabel: hasUnresolved ? "unresolved-source" : "resolved",
  });
}

function buffRow(
  buff: SourceBuffEffect,
  rowIndex: number,
): DiscordHeroSourceEffectsBuffRow {
  return Object.freeze({
    section: "buffs",
    rowIndex,
    buffKey: buff.buffKey,
    buffType: buff.buffType,
    statType: buff.statType,
    modType: buff.modType,
    value: buff.value,
    runtimeValue: buff.runtimeValue,
    resolutionLabel:
      buff.runtimeValue.kind === "runtime-value-unresolved"
        ? "runtime-value-unresolved"
        : "resolved",
  });
}

function statusRow(
  status: SourceStatusEffect,
  rowIndex: number,
): DiscordHeroSourceEffectsStatusRow {
  return Object.freeze({
    section: "status-effects",
    rowIndex,
    statusEffectKey: status.statusEffectKey,
    statusEffectType: status.statusEffectType,
    duration: status.duration,
    rawBuffKeys: status.rawBuffKeys,
    overrideType: status.overrideType,
    params: status.params,
    buffReferences: status.buffReferences,
    resolutionLabel: "resolved",
  });
}

function monsterSkillRow(
  reference: SourceMonsterSkillReference,
  rowIndex: number,
): DiscordHeroSourceEffectsMonsterSkillRow {
  if (reference.kind === "resolved") {
    return Object.freeze({
      section: "monster-skill-references",
      rowIndex,
      kind: "resolved",
      monsterKey: reference.monsterKey,
      rawSkillKeys: reference.rawSkillKeys,
      referenceIndex: reference.referenceIndex,
      skillKey: reference.skillKey,
      resolutionLabel: "resolved",
    });
  }
  return Object.freeze({
    section: "monster-skill-references",
    rowIndex,
    kind: "unresolved-source",
    monsterKey: reference.monsterKey,
    rawSkillKeys: reference.rawSkillKeys,
    referenceIndex: reference.referenceIndex,
    skillKey: reference.skillKey,
    apparentSkillKey: reference.apparentSkillKey,
    ruleId: reference.ruleId,
    reason: reference.reason,
    resolutionLabel: "unresolved-source",
  });
}

function sectionRows(
  topology: SourceEffectTopology,
  section: DiscordHeroSourceEffectsSection,
): readonly DiscordHeroSourceEffectsRow[] {
  switch (section) {
    case "skills":
      return Object.freeze(
        topology.skills.map((skill, rowIndex) => skillRow(skill, rowIndex)),
      );
    case "buff-groups":
      return Object.freeze(
        topology.buffGroupRows.map((row) => buffGroupRow(row)),
      );
    case "buffs":
      return Object.freeze(
        topology.buffs.map((buff, rowIndex) => buffRow(buff, rowIndex)),
      );
    case "status-effects":
      return Object.freeze(
        topology.statusEffects.map((status, rowIndex) =>
          statusRow(status, rowIndex),
        ),
      );
    case "monster-skill-references":
      return Object.freeze(
        topology.monsterSkillReferences.map((reference, rowIndex) =>
          monsterSkillRow(reference, rowIndex),
        ),
      );
  }
}

function pageCountFor(rowCount: number): number {
  return Math.max(
    1,
    Math.ceil(rowCount / DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE),
  );
}

function slicePage<T>(
  rows: readonly T[],
  page: number,
  pageCount: number,
  label: string,
): readonly T[] {
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    fail(`${label} page ${page} is outside 0-${pageCount - 1}`);
  }
  const start = page * DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE;
  return Object.freeze(
    rows.slice(start, start + DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE),
  );
}

function parsePageInput(value: unknown): PageInput {
  assertExactOwnFields(value, ["section", "page"], "source-effects page input");
  return {
    section: requireSection(value.section, "source-effects page input.section"),
    page: requireNonNegativePage(value.page, "source-effects page input.page"),
  };
}

function parseFilterInput(value: unknown): FilterInput {
  assertExactOwnFields(
    value,
    ["section", "page", "resolutionLabel"],
    "source-effects filter input",
  );
  return {
    section: requireSection(
      value.section,
      "source-effects filter input.section",
    ),
    page: requireNonNegativePage(
      value.page,
      "source-effects filter input.page",
    ),
    resolutionLabel: requireResolutionLabel(
      value.resolutionLabel,
      "source-effects filter input.resolutionLabel",
    ),
  };
}

function parseDetailInput(value: unknown): DetailInput {
  assertExactOwnFields(
    value,
    ["section", "rowIndex"],
    "source-effects detail input",
  );
  return {
    section: requireSection(
      value.section,
      "source-effects detail input.section",
    ),
    rowIndex: requireNonNegativePage(
      value.rowIndex,
      "source-effects detail input.rowIndex",
    ),
  };
}

export function projectDiscordHeroSourceEffectsBrowser(
  indexes: DiscordHeroCatalogIndexes,
): DiscordHeroSourceEffectsBrowser {
  const topology = loadTopology(indexes);
  const sections = DISCORD_HERO_SOURCE_EFFECTS_SECTIONS.map((section) => {
    const rows = sectionRows(topology, section);
    return Object.freeze({
      section,
      rowCount: rows.length,
      pageCount: pageCountFor(rows.length),
    });
  });
  return deepFreeze({
    counts: topology.counts,
    sections: Object.freeze(sections),
  });
}

export function discordHeroSourceEffectsPageCount(
  indexes: DiscordHeroCatalogIndexes,
  section: DiscordHeroSourceEffectsSection,
): number {
  requireSection(section, "source-effects section");
  const rows = sectionRows(loadTopology(indexes), section);
  return pageCountFor(rows.length);
}

export function discordHeroSourceEffectsPage(
  indexes: DiscordHeroCatalogIndexes,
  input: PageInput,
): DiscordHeroSourceEffectsPage {
  const { section, page } = parsePageInput(input);
  const rows = sectionRows(loadTopology(indexes), section);
  const pageCount = pageCountFor(rows.length);
  return deepFreeze({
    section,
    page,
    pageCount,
    rowCount: rows.length,
    rows: slicePage(rows, page, pageCount, `source-effects ${section}`),
  });
}

export function filterDiscordHeroSourceEffectsPage(
  indexes: DiscordHeroCatalogIndexes,
  input: FilterInput,
): DiscordHeroSourceEffectsFilterPage {
  const { section, page, resolutionLabel } = parseFilterInput(input);
  const rows = sectionRows(loadTopology(indexes), section).filter(
    (row) => row.resolutionLabel === resolutionLabel,
  );
  const pageCount = pageCountFor(rows.length);
  return deepFreeze({
    section,
    page,
    pageCount,
    rowCount: rows.length,
    totalMatching: rows.length,
    resolutionLabel,
    rows: slicePage(
      rows,
      page,
      pageCount,
      `source-effects ${section} filter ${resolutionLabel}`,
    ),
  });
}

export function discordHeroSourceEffectsDetail(
  indexes: DiscordHeroCatalogIndexes,
  input: DetailInput,
): DiscordHeroSourceEffectsRow {
  const { section, rowIndex } = parseDetailInput(input);
  const rows = sectionRows(loadTopology(indexes), section);
  if (rowIndex >= rows.length) {
    fail(
      `source-effects ${section} row ${rowIndex} is outside 0-${rows.length - 1}`,
    );
  }
  return deepFreeze(rows[rowIndex]!);
}

export function discordHeroSourceEffectsSectionSummary(
  indexes: DiscordHeroCatalogIndexes,
  section: DiscordHeroSourceEffectsSection,
): DiscordHeroSourceEffectsSectionSummary {
  requireSection(section, "source-effects section");
  const rows = sectionRows(loadTopology(indexes), section);
  let resolvedCount = 0;
  let unresolvedSourceCount = 0;
  let runtimeValueUnresolvedCount = 0;
  for (const row of rows) {
    if (row.resolutionLabel === "resolved") resolvedCount += 1;
    else if (row.resolutionLabel === "unresolved-source")
      unresolvedSourceCount += 1;
    else runtimeValueUnresolvedCount += 1;
  }
  return deepFreeze({
    section,
    rowCount: rows.length,
    pageCount: pageCountFor(rows.length),
    resolvedCount,
    unresolvedSourceCount,
    runtimeValueUnresolvedCount,
  });
}

function formatSkillKey(skillKey: number | string): string {
  return typeof skillKey === "string"
    ? JSON.stringify(skillKey)
    : String(skillKey);
}

export function discordHeroSourceEffectsTextRows(
  indexes: DiscordHeroCatalogIndexes,
  input: PageInput,
): readonly string[] {
  const page = discordHeroSourceEffectsPage(indexes, input);
  return Object.freeze(
    page.rows.map((row) => {
      let text: string;
      switch (row.section) {
        case "skills":
          text = `#${row.rowIndex} skill ${formatSkillKey(row.skillKey)} · ${row.activationType} · ${row.damageType} · [${row.resolutionLabel}]`;
          break;
        case "buff-groups":
          text = `#${row.rowIndex} buff-group ${row.buffGroupKey} · refs ${row.buffReferences.length} · [${row.resolutionLabel}]`;
          break;
        case "buffs":
          text = `#${row.rowIndex} buff ${row.buffKey} · ${row.statType}/${row.modType} · [${row.resolutionLabel}]`;
          break;
        case "status-effects":
          text = `#${row.rowIndex} status ${row.statusEffectKey} · ${row.statusEffectType} · duration ${row.duration} · [${row.resolutionLabel}]`;
          break;
        case "monster-skill-references":
          text = `#${row.rowIndex} monster ${row.monsterKey} · skill ${row.skillKey} · [${row.resolutionLabel}]`;
          break;
      }
      return formatDiscordSafePlainText(text);
    }),
  );
}
