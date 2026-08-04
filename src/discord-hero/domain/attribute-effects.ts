import {
  getCatalogGroup,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import type { PlayerState } from "./player";

type PassiveAttributeEffect = Readonly<{
  kind: "passive-stat";
  passiveSkillKey: number;
  statType: string;
  modifierType: "FLAT" | "ADDITIVE";
  rawValue: number;
  rawTotal: number | null;
  additiveFactor: number | null;
}>;

type ActiveAttributeEffect = Readonly<{
  kind: "active-skill";
  skillKey: number;
  skillLevelKey: number;
  levelRow: Readonly<{
    SkillLevelKey: number;
    Level: number;
    Value: number;
  }> | null;
}>;

export type DiscordHeroAttributeEffectProjection = Readonly<{
  source: "Attribute";
  heroKey: number;
  attributeKey: number;
  allocatedLevel: number | null;
  maximumLevel: number;
  effect: PassiveAttributeEffect | ActiveAttributeEffect;
}>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

export function validateDiscordHeroAttributeOwnedHeroes(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): void {
  const seenHeroKeys = new Set<number>();
  for (const [index, hero] of state.heroes.entries()) {
    if (!Number.isSafeInteger(hero.heroKey) || hero.heroKey < 1) {
      throw new Error(
        `heroes[${index}].heroKey must be a positive safe integer`,
      );
    }
    if (seenHeroKeys.has(hero.heroKey)) {
      throw new Error(`Player state repeats owned Hero ${hero.heroKey}`);
    }
    seenHeroKeys.add(hero.heroKey);
    try {
      const sourceHero = getCatalogRow(indexes, "heroes", hero.heroKey);
      if (sourceHero.HeroKey !== hero.heroKey) {
        throw new Error("mismatched Hero key");
      }
    } catch {
      throw new Error(
        `heroes[${index}].heroKey references unknown heroes key ${hero.heroKey}`,
      );
    }
  }
}

export function projectDiscordHeroAttributeEffect(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
  attributeKey: number,
): DiscordHeroAttributeEffectProjection {
  validateDiscordHeroAttributeOwnedHeroes(indexes, state);
  const hero = state.heroes.find((candidate) => candidate.heroKey === heroKey);
  const attribute = getCatalogRow(indexes, "attributes", attributeKey);
  if (attribute.HeroKey !== heroKey) {
    throw new Error(
      `Attribute ${attributeKey} belongs to Hero ${attribute.HeroKey}, not ${heroKey}`,
    );
  }
  let allocatedLevel: number | null = null;
  if (hero !== undefined) {
    if (!Number.isSafeInteger(hero.level) || hero.level < 1) {
      throw new Error(`Hero ${heroKey} level must be a positive safe integer`);
    }
    let spentAttributePoints = 0;
    const allocatedAttributes: {
      readonly index: number;
      readonly groupKey: number;
      readonly spentPoints: number;
    }[] = [];
    const seenAttributeKeys = new Set<number>();
    for (const [index, progress] of hero.attributes.entries()) {
      if (seenAttributeKeys.has(progress.key)) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes repeats key ${progress.key}`,
        );
      }
      seenAttributeKeys.add(progress.key);
      const progressAttribute = getCatalogRow(
        indexes,
        "attributes",
        progress.key,
      );
      if (progressAttribute.HeroKey !== hero.heroKey) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${index}].key belongs to hero ${progressAttribute.HeroKey}`,
        );
      }
      if (!Number.isSafeInteger(progress.level) || progress.level < 1) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${index}].level must be a positive safe integer`,
        );
      }
      if (progress.level > progressAttribute.MaxLevel) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${index}].level exceeds attribute max ${progressAttribute.MaxLevel}`,
        );
      }
      if (
        !Number.isSafeInteger(progressAttribute.RequiredPoint) ||
        progressAttribute.RequiredPoint < 1
      ) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${index}].key has invalid RequiredPoint ${progressAttribute.RequiredPoint}`,
        );
      }
      const spentPoints = progress.level * progressAttribute.RequiredPoint;
      if (
        !Number.isSafeInteger(spentPoints) ||
        !Number.isSafeInteger(spentAttributePoints + spentPoints)
      ) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}] Attribute spend is not a safe integer`,
        );
      }
      spentAttributePoints += spentPoints;
      allocatedAttributes.push({
        index,
        groupKey: progressAttribute.GroupKey,
        spentPoints,
      });
    }
    if (spentAttributePoints > hero.level) {
      throw new Error(
        `heroes[${state.heroes.indexOf(hero)}] Attribute spend ${spentAttributePoints} exceeds Hero level budget ${hero.level}`,
      );
    }
    for (const allocated of allocatedAttributes) {
      const group = getCatalogRow(
        indexes,
        "attribute_groups",
        allocated.groupKey,
      );
      if (
        !Number.isSafeInteger(group.RequiredAllocatedPoint) ||
        group.RequiredAllocatedPoint < 0
      ) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${allocated.index}] group ${allocated.groupKey} has invalid RequiredAllocatedPoint`,
        );
      }
      let lowerGroupSpend = 0;
      for (const candidate of allocatedAttributes) {
        const candidateGroup = getCatalogRow(
          indexes,
          "attribute_groups",
          candidate.groupKey,
        );
        if (
          candidateGroup.RequiredAllocatedPoint < group.RequiredAllocatedPoint
        ) {
          lowerGroupSpend += candidate.spentPoints;
        }
      }
      if (lowerGroupSpend < group.RequiredAllocatedPoint) {
        throw new Error(
          `heroes[${state.heroes.indexOf(hero)}].attributes[${allocated.index}] requires ${group.RequiredAllocatedPoint} points spent in lower Attribute groups`,
        );
      }
    }
    allocatedLevel =
      hero.attributes.find((progress) => progress.key === attributeKey)
        ?.level ?? 0;
  }

  if (attribute.ATTRIBUTETYPE === "ACTIVESKILL") {
    if (
      attribute.MaxLevel !== 5 ||
      (allocatedLevel !== null && allocatedLevel > 5)
    ) {
      throw new Error(
        `Active Attribute ${attributeKey} supports allocation levels 0-5`,
      );
    }
    const skill = getCatalogRow(indexes, "skills", attribute.Value);
    if (
      typeof skill.SkillKey !== "number" ||
      skill.SkillKey !== attribute.Value ||
      skill.AttributeKey !== attribute.AttributeKey ||
      !Number.isSafeInteger(skill.SkillLevelKey) ||
      (skill.SkillLevelKey ?? 0) < 1
    ) {
      throw new Error(
        `Active Attribute ${attributeKey} has an invalid source Skill relation`,
      );
    }
    const levelRows = getCatalogGroup(
      indexes,
      "skill_levels",
      skill.SkillLevelKey!,
    );
    const levelRow =
      allocatedLevel === null || allocatedLevel === 0
        ? null
        : levelRows.filter((row) => row.Level === allocatedLevel);
    if (Array.isArray(levelRow) && levelRow.length !== 1) {
      throw new Error(
        `Active Attribute ${attributeKey} has no unique source row for level ${allocatedLevel}`,
      );
    }
    const exactLevelRow = Array.isArray(levelRow) ? levelRow[0]! : null;
    return deepFreeze({
      source: "Attribute",
      heroKey,
      attributeKey,
      allocatedLevel,
      maximumLevel: attribute.MaxLevel,
      effect: {
        kind: "active-skill",
        skillKey: skill.SkillKey,
        skillLevelKey: skill.SkillLevelKey!,
        levelRow:
          exactLevelRow === null
            ? null
            : {
                SkillLevelKey: exactLevelRow.SkillLevelKey,
                Level: exactLevelRow.Level,
                Value: exactLevelRow.Value,
              },
      },
    });
  }
  if (attribute.ATTRIBUTETYPE !== "PASSIVESKILL") {
    throw new Error(
      `Attribute ${attributeKey} has unsupported type ${attribute.ATTRIBUTETYPE}`,
    );
  }
  const passive = getCatalogRow(indexes, "passive_skills", attribute.Value);
  if (passive.MODTYPE !== "FLAT" && passive.MODTYPE !== "ADDITIVE") {
    throw new Error(
      `Attribute ${attributeKey} has unsupported passive modifier ${passive.MODTYPE}`,
    );
  }
  const rawTotal =
    allocatedLevel === null ? null : passive.Value * allocatedLevel;

  return deepFreeze({
    source: "Attribute",
    heroKey,
    attributeKey,
    allocatedLevel,
    maximumLevel: attribute.MaxLevel,
    effect: {
      kind: "passive-stat",
      passiveSkillKey: passive.PassiveSkillKey,
      statType: passive.STATTYPE,
      modifierType: passive.MODTYPE,
      rawValue: passive.Value,
      rawTotal,
      additiveFactor:
        passive.MODTYPE === "ADDITIVE" && rawTotal !== null
          ? rawTotal / 1000
          : null,
    },
  });
}
