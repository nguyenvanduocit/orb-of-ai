import {
  getCatalogGroup,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { OracleRequiredError } from "./combat";
import type { RandomSource } from "./stats";

type SourceSkillRow = DiscordHeroDatasetRow<"skills">;

export type SkillActivationDescriptor =
  | Readonly<{ kind: "base-attack"; skillKey: number | string }>
  | Readonly<{
      kind: "base-attack-count";
      skillKey: number | string;
      attackCount: number;
    }>
  | Readonly<{ kind: "aura"; skillKey: number | string; immediate: true }>
  | Readonly<{
      kind: "cooldown";
      skillKey: number | string;
      baseSeconds: number;
    }>;

export function describeSkillActivation(
  indexes: DiscordHeroCatalogIndexes,
  skillKey: number | string,
): SkillActivationDescriptor {
  requireSkillKey(skillKey);
  return describeCanonicalSkill(getCatalogRow(indexes, "skills", skillKey));
}

function describeCanonicalSkill(row: SourceSkillRow): SkillActivationDescriptor {
  requireSkillKey(row.SkillKey);
  if (row.ACTIVATIONTYPE === "BASEATTACK") {
    if (row.ActivationValue !== 0) {
      throw new Error("base-attack activation value must be 0");
    }
    if (row.SLOTTYPE !== "BASEATTACK") {
      throw new Error("base-attack skill must use the BASEATTACK slot");
    }
    return Object.freeze({ kind: "base-attack", skillKey: row.SkillKey });
  }
  if (row.ACTIVATIONTYPE === "BASEATTACK_COUNT") {
    requirePositiveSafeInteger(
      row.ActivationValue,
      "base-attack-count activation value",
    );
    return Object.freeze({
      kind: "base-attack-count",
      skillKey: row.SkillKey,
      attackCount: row.ActivationValue,
    });
  }
  if (row.ACTIVATIONTYPE === "CONTINUOUS") {
    if (row.ActivationValue !== null) {
      throw new Error("continuous activation value must be null");
    }
    return Object.freeze({
      kind: "aura",
      skillKey: row.SkillKey,
      immediate: true,
    });
  }
  if (row.ACTIVATIONTYPE === "COOLDOWN") {
    requirePositiveSafeInteger(
      row.ActivationValue,
      "cooldown activation value",
    );
    return Object.freeze({
      kind: "cooldown",
      skillKey: row.SkillKey,
      baseSeconds: row.ActivationValue,
    });
  }
  throw new Error(`unsupported skill activation type ${row.ACTIVATIONTYPE}`);
}

interface SkillLevelInput {
  readonly skillKey: number | string;
  readonly level: number;
  readonly [key: string]: unknown;
}

export function resolveSkillLevelValue(
  indexes: DiscordHeroCatalogIndexes,
  input: SkillLevelInput,
): number {
  rejectUnknownFields(input, ["skillKey", "level"], "skill level input");
  requireSkillKey(input.skillKey);
  requirePositiveSafeInteger(input.level, "skill level");
  const skill = getCatalogRow(indexes, "skills", input.skillKey);
  if (skill.SkillLevelKey === null) {
    throw new Error(`skill ${String(skill.SkillKey)} has no level table`);
  }
  requirePositiveSafeInteger(skill.SkillLevelKey, "skill level key");

  const group = getCatalogGroup(indexes, "skill_levels", skill.SkillLevelKey);
  const seenLevels = new Set<number>();
  for (const row of group) {
    requirePositiveSafeInteger(row.Level, `skill ${String(skill.SkillKey)} level`);
    if (!Number.isFinite(row.Value)) {
      throw new Error(`skill ${String(skill.SkillKey)} level value must be finite`);
    }
    if (seenLevels.has(row.Level)) {
      throw new Error(
        `skill ${String(skill.SkillKey)} has duplicate level ${row.Level}`,
      );
    }
    seenLevels.add(row.Level);
  }
  const matches = group.filter((row) => row.Level === input.level);
  if (matches.length !== 1) {
    throw new Error(
      `skill ${String(skill.SkillKey)} has no unique value for level ${input.level}`,
    );
  }
  return matches[0]!.Value;
}

interface SkillExecutionInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly skillKey: number | string;
  readonly state: Readonly<unknown>;
  readonly rng: RandomSource;
  readonly [key: string]: unknown;
}

export function executeSourceSkill(input: SkillExecutionInput): never {
  rejectUnknownFields(
    input,
    ["indexes", "skillKey", "state", "rng"],
    "skill execution input",
  );
  describeSkillActivation(input.indexes, input.skillKey);
  throw new OracleRequiredError(
    "skill cadence, target selection, status application, and death " +
      "interaction require a runtime oracle",
  );
}

function rejectUnknownFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unknown !== undefined) {
    throw new Error(`${context} has unknown field ${unknown}`);
  }
}

function requireSkillKey(value: number | string): void {
  if (typeof value === "number") {
    requirePositiveSafeInteger(value, "skill key");
    return;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("skill key must not be empty");
  }
}

function requirePositiveSafeInteger(
  value: number | null,
  context: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}
