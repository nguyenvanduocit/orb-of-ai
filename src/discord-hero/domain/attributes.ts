import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import type { PlayerState } from "./player";

interface AttributeAllocationFacts {
  readonly heroKey: number;
  readonly attributeKey: number;
  readonly groupKey: number;
  readonly maximumLevel: number;
  readonly requiredPoint: number;
  readonly spentPoints: number;
  readonly pointBudget: number;
  readonly remainingPoints: number;
  readonly groupRequiredAllocatedPoint: number;
}

export type AttributeAllocationQuote =
  | Readonly<
      AttributeAllocationFacts & {
        readonly kind: "available";
        readonly currentLevel: number;
        readonly nextLevel: number;
      }
    >
  | Readonly<
      AttributeAllocationFacts & {
        readonly kind: "maximum-level";
        readonly level: number;
      }
    >
  | Readonly<
      AttributeAllocationFacts & {
        readonly kind: "group-locked";
        readonly currentLevel: number;
      }
    >
  | Readonly<
      AttributeAllocationFacts & {
        readonly kind: "insufficient-points";
        readonly currentLevel: number;
        readonly nextLevel: number;
      }
    >;

export type AttributeAllocationResult =
  | Readonly<{
      readonly kind: "allocated";
      readonly heroKey: number;
      readonly attributeKey: number;
      readonly groupKey: number;
      readonly level: number;
      readonly maximumLevel: number;
      readonly requiredPoint: number;
      readonly spentPoints: number;
      readonly pointBudget: number;
      readonly remainingPoints: number;
      readonly groupRequiredAllocatedPoint: number;
      readonly state: PlayerState;
    }>
  | Exclude<AttributeAllocationQuote, { kind: "available" }>;

function requirePositiveSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

export function quoteAttributeAllocation(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
  attributeKey: number,
): AttributeAllocationQuote {
  requirePositiveSafeInteger(heroKey, "Hero key");
  requirePositiveSafeInteger(attributeKey, "Attribute key");
  const matchingHeroes = state.heroes.filter(
    (candidate) => candidate.heroKey === heroKey,
  );
  if (matchingHeroes.length === 0) {
    throw new Error(`Hero ${heroKey} is not owned`);
  }
  if (matchingHeroes.length !== 1) {
    throw new Error(`Hero ${heroKey} ownership is duplicated`);
  }
  const hero = matchingHeroes[0]!;
  requirePositiveSafeInteger(hero.level, `Hero ${heroKey} level`);

  const attribute = getCatalogRow(indexes, "attributes", attributeKey);
  if (attribute.HeroKey !== heroKey) {
    throw new Error(
      `Attribute ${attributeKey} belongs to Hero ${attribute.HeroKey}, not ${heroKey}`,
    );
  }
  requirePositiveSafeInteger(
    attribute.RequiredPoint,
    `Attribute ${attributeKey} RequiredPoint`,
  );
  requirePositiveSafeInteger(
    attribute.MaxLevel,
    `Attribute ${attributeKey} MaxLevel`,
  );
  const group = getCatalogRow(indexes, "attribute_groups", attribute.GroupKey);
  requireNonNegativeSafeInteger(
    group.RequiredAllocatedPoint,
    `Attribute group ${attribute.GroupKey} RequiredAllocatedPoint`,
  );

  let spentPoints = 0;
  let currentLevel = 0;
  const seen = new Set<number>();
  const progressSources: {
    readonly key: number;
    readonly groupKey: number;
    readonly spentPoints: number;
  }[] = [];
  for (const progress of hero.attributes) {
    requirePositiveSafeInteger(
      progress.key,
      `Hero ${heroKey} Attribute progress key`,
    );
    requirePositiveSafeInteger(
      progress.level,
      `Hero ${heroKey} Attribute ${progress.key} level`,
    );
    if (seen.has(progress.key)) {
      throw new Error(`Hero ${heroKey} duplicates Attribute ${progress.key}`);
    }
    seen.add(progress.key);
    const source = getCatalogRow(indexes, "attributes", progress.key);
    if (source.HeroKey !== heroKey) {
      throw new Error(
        `Attribute ${progress.key} belongs to Hero ${source.HeroKey}, not ${heroKey}`,
      );
    }
    requirePositiveSafeInteger(
      source.RequiredPoint,
      `Attribute ${progress.key} RequiredPoint`,
    );
    requirePositiveSafeInteger(
      source.MaxLevel,
      `Attribute ${progress.key} MaxLevel`,
    );
    if (progress.level > source.MaxLevel) {
      throw new Error(
        `Hero ${heroKey} Attribute ${progress.key} level exceeds source max ${source.MaxLevel}`,
      );
    }
    const cost = progress.level * source.RequiredPoint;
    if (
      !Number.isSafeInteger(cost) ||
      !Number.isSafeInteger(spentPoints + cost)
    ) {
      throw new Error(`Hero ${heroKey} Attribute spend is not a safe integer`);
    }
    spentPoints += cost;
    progressSources.push({
      key: progress.key,
      groupKey: source.GroupKey,
      spentPoints: cost,
    });
    if (progress.key === attributeKey) currentLevel = progress.level;
  }
  if (spentPoints > hero.level) {
    throw new Error(
      `Hero ${heroKey} Attribute spend ${spentPoints} exceeds level budget ${hero.level}`,
    );
  }
  for (const progress of progressSources) {
    const progressGroup = getCatalogRow(
      indexes,
      "attribute_groups",
      progress.groupKey,
    );
    requireNonNegativeSafeInteger(
      progressGroup.RequiredAllocatedPoint,
      `Attribute group ${progress.groupKey} RequiredAllocatedPoint`,
    );
    let lowerGroupSpend = 0;
    for (const candidate of progressSources) {
      const candidateGroup = getCatalogRow(
        indexes,
        "attribute_groups",
        candidate.groupKey,
      );
      if (
        candidateGroup.RequiredAllocatedPoint <
        progressGroup.RequiredAllocatedPoint
      ) {
        lowerGroupSpend += candidate.spentPoints;
      }
    }
    if (lowerGroupSpend < progressGroup.RequiredAllocatedPoint) {
      throw new Error(
        `Attribute ${progress.key} requires ${progressGroup.RequiredAllocatedPoint} points spent in lower Attribute groups`,
      );
    }
  }

  const facts: AttributeAllocationFacts = {
    heroKey,
    attributeKey,
    groupKey: attribute.GroupKey,
    maximumLevel: attribute.MaxLevel,
    requiredPoint: attribute.RequiredPoint,
    spentPoints,
    // Captured Hero planners define one Attribute point per Hero level.
    pointBudget: hero.level,
    remainingPoints: hero.level - spentPoints,
    groupRequiredAllocatedPoint: group.RequiredAllocatedPoint,
  };
  if (currentLevel === attribute.MaxLevel) {
    return Object.freeze({
      kind: "maximum-level",
      ...facts,
      level: currentLevel,
    });
  }
  if (spentPoints < group.RequiredAllocatedPoint) {
    return Object.freeze({ kind: "group-locked", ...facts, currentLevel });
  }
  const nextLevel = currentLevel + 1;
  if (facts.remainingPoints < attribute.RequiredPoint) {
    return Object.freeze({
      kind: "insufficient-points",
      ...facts,
      currentLevel,
      nextLevel,
    });
  }
  return Object.freeze({
    kind: "available",
    ...facts,
    currentLevel,
    nextLevel,
  });
}

export function allocateAttributePoint(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  heroKey: number,
  attributeKey: number,
): AttributeAllocationResult {
  const quote = quoteAttributeAllocation(indexes, state, heroKey, attributeKey);
  if (quote.kind !== "available") return quote;

  const next = structuredClone(state);
  const hero = next.heroes.find((candidate) => candidate.heroKey === heroKey)!;
  const progress = hero.attributes.find(
    (candidate) => candidate.key === attributeKey,
  );
  if (progress === undefined) {
    hero.attributes.push({ key: attributeKey, level: quote.nextLevel });
  } else {
    progress.level = quote.nextLevel;
  }
  const sourceHero = getCatalogRow(indexes, "heroes", heroKey);
  const sourceRanks = new Map(
    sourceHero.attribute_keys.map((key, index) => [key, index]),
  );
  hero.attributes.sort((left, right) => {
    const leftRank = sourceRanks.get(left.key);
    const rightRank = sourceRanks.get(right.key);
    if (leftRank === undefined || rightRank === undefined) {
      throw new Error(
        `Hero ${heroKey} Attribute progress is outside source order`,
      );
    }
    return leftRank - rightRank;
  });
  return Object.freeze({
    kind: "allocated",
    heroKey,
    attributeKey,
    groupKey: quote.groupKey,
    level: quote.nextLevel,
    maximumLevel: quote.maximumLevel,
    requiredPoint: quote.requiredPoint,
    spentPoints: quote.spentPoints + quote.requiredPoint,
    pointBudget: quote.pointBudget,
    remainingPoints: quote.remainingPoints - quote.requiredPoint,
    groupRequiredAllocatedPoint: quote.groupRequiredAllocatedPoint,
    state: next,
  });
}
