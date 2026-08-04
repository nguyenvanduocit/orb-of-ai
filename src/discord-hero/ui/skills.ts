import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { heroSkillKeys } from "../domain/heroes";

const SKILL_PAGE_SIZE = 25;

export type DiscordHeroSkillRow = DiscordHeroDatasetRow<"skills">;

export interface DiscordHeroSkillLevel {
  readonly level: number;
  readonly value: number;
}

export interface DiscordHeroSkill {
  readonly rowIndex: number;
  readonly sourceKey: number | string;
  readonly name: string;
  readonly description: string | null;
  readonly activationType: string;
  readonly activationValue: number | null;
  readonly slotType: string;
  readonly skillBuffType: string;
  readonly buffGroupKey: number | null;
  readonly params: readonly (number | null)[];
  readonly range: number;
  readonly order: number | string;
  readonly damageType: string;
  readonly damageDeliveryType: string | null;
  readonly value: number | string | null;
  readonly skillLevelKey: number | null;
  readonly animationPaths: readonly (string | null)[];
  readonly attributeKey: number | null;
  readonly soundKey: number | null;
  readonly levels: readonly DiscordHeroSkillLevel[];
  readonly heroKeys: readonly number[];
}

export function discordHeroSkillPageCount(
  indexes: DiscordHeroCatalogIndexes,
): number {
  return Math.ceil(indexes.tables.skills.rows.length / SKILL_PAGE_SIZE);
}

export function discordHeroSkills(
  indexes: DiscordHeroCatalogIndexes,
  page: number,
): readonly DiscordHeroSkillRow[] {
  const pageCount = discordHeroSkillPageCount(indexes);
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero skill page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * SKILL_PAGE_SIZE;
  return Object.freeze(
    indexes.tables.skills.rows.slice(start, start + SKILL_PAGE_SIZE),
  );
}

function encodeNonNegative(value: number, context: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
  return value.toString(36);
}

function decodeNonNegative(
  value: string,
  prefix: string,
  context: string,
): number {
  const pattern = new RegExp(`^${prefix}-([0-9a-z]+)$`);
  const match = pattern.exec(value);
  if (match === null) {
    throw new Error(`${context} has invalid encoding`);
  }
  const encoded = match[1]!;
  const decoded = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < 0 ||
    decoded.toString(36) !== encoded
  ) {
    throw new Error(`${context} has non-canonical encoding`);
  }
  return decoded;
}

export function encodeDiscordHeroSkillPage(page: number): string {
  return `s-${encodeNonNegative(page, "DiscordHero skill page")}`;
}

export function decodeDiscordHeroSkillPage(value: string): number {
  return decodeNonNegative(value, "s", "DiscordHero skill page");
}

export function encodeDiscordHeroSkillTarget(rowIndex: number): string {
  return `k-${encodeNonNegative(rowIndex, "DiscordHero skill row index")}`;
}

export function decodeDiscordHeroSkillTarget(value: string): number {
  return decodeNonNegative(value, "k", "DiscordHero skill target");
}

function localizedEnglish(
  values: Readonly<Record<string, unknown>> | undefined,
): string | null {
  const value = values?.["en-US"];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function fallbackSkillName(sourceKey: number | string): string {
  return `Source Skill ${typeof sourceKey === "string" ? JSON.stringify(sourceKey) : sourceKey}`;
}

function exactLevels(
  indexes: DiscordHeroCatalogIndexes,
  skill: DiscordHeroSkillRow,
): readonly DiscordHeroSkillLevel[] {
  const sourceRows =
    skill.SkillLevelKey === null
      ? []
      : (indexes.tables.skill_levels.groups.get(skill.SkillLevelKey) ?? []);
  const levels = sourceRows.map((row) => ({
    level: row.Level,
    value: row.Value,
  }));
  if (JSON.stringify(levels) !== JSON.stringify(skill.levels)) {
    throw new Error(
      `DiscordHero skill ${JSON.stringify(skill.SkillKey)} embedded levels diverge from source skill_levels ${skill.SkillLevelKey}`,
    );
  }
  return Object.freeze(levels.map((level) => Object.freeze(level)));
}

function linkedHeroKeys(
  indexes: DiscordHeroCatalogIndexes,
  skillKey: number | string,
): readonly number[] {
  if (typeof skillKey !== "number") return Object.freeze([]);
  const linked = indexes.tables.heroes.rows
    .filter((hero) => {
      const keys = heroSkillKeys(indexes, { heroKey: hero.HeroKey });
      return (
        keys.baseSkillKey === skillKey ||
        keys.activeSkillKeys.includes(skillKey)
      );
    })
    .map((hero) => hero.HeroKey);
  return Object.freeze(linked);
}

export function readDiscordHeroSkill(
  indexes: DiscordHeroCatalogIndexes,
  target: string,
): DiscordHeroSkill {
  const rowIndex = decodeDiscordHeroSkillTarget(target);
  const skill = indexes.tables.skills.rows[rowIndex];
  if (skill === undefined) {
    throw new Error(
      `DiscordHero skill row ${rowIndex} is outside 0-${indexes.tables.skills.rows.length - 1}`,
    );
  }
  return Object.freeze({
    rowIndex,
    sourceKey: skill.SkillKey,
    name:
      localizedEnglish(skill.SkillNameKey_i18n) ??
      fallbackSkillName(skill.SkillKey),
    description: localizedEnglish(skill.SkillDescriptionKey_i18n),
    activationType: skill.ACTIVATIONTYPE,
    activationValue: skill.ActivationValue,
    slotType: skill.SLOTTYPE,
    skillBuffType: skill.SkillBuffType,
    buffGroupKey: skill.BuffGroupKey,
    params: Object.freeze([
      skill.Param1,
      skill.Param2,
      skill.Param3,
      skill.Param4,
      skill.Param5,
    ]),
    range: skill.Range,
    order: skill.Order,
    damageType: skill.DamageType,
    damageDeliveryType: skill.DamageDeliveryType,
    value: skill.Value,
    skillLevelKey: skill.SkillLevelKey,
    animationPaths: Object.freeze([
      skill.AnimClipPath1,
      skill.AnimClipPath2,
      skill.AnimClipPath3,
    ]),
    attributeKey: skill.AttributeKey,
    soundKey: skill.SoundKey,
    levels: exactLevels(indexes, skill),
    heroKeys: linkedHeroKeys(indexes, skill.SkillKey),
  });
}
