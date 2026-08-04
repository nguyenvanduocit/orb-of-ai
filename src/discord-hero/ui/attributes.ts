import {
  getCatalogRow,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import {
  projectDiscordHeroAttributeEffect,
  type DiscordHeroAttributeEffectProjection,
  validateDiscordHeroAttributeOwnedHeroes,
} from "../domain/attribute-effects";
import type { PlayerState } from "../domain/player";

const ATTRIBUTE_PAGE_SIZE = 25;
const MAX_CODEC_LENGTH = 64;
const MAX_OPTION_TEXT_LENGTH = 100;

type PassiveSkillRow = DiscordHeroDatasetRow<"passive_skills">;
type ActiveSkillRow = DiscordHeroDatasetRow<"skills">;

export type DiscordHeroAttributeRelation =
  | {
      readonly kind: "passive-skill";
      readonly source: PassiveSkillRow;
    }
  | {
      readonly kind: "active-skill";
      readonly source: ActiveSkillRow;
    };

export interface DiscordHeroAttributeNode {
  readonly AttributeKey: number;
  readonly HeroKey: number;
  readonly GroupKey: number;
  readonly ATTRIBUTETYPE: string;
  readonly Value: number;
  readonly RequiredPoint: number;
  readonly MaxLevel: number;
  readonly AvailableDemo: boolean;
  readonly allocatedLevel: number | null;
  readonly effect: DiscordHeroAttributeEffectProjection;
  readonly target: string;
  readonly relation: DiscordHeroAttributeRelation;
}

export interface DiscordHeroAttributeGroup {
  readonly AttributeGroupKey: number;
  readonly RequiredAllocatedPoint: number;
  readonly nodes: readonly DiscordHeroAttributeNode[];
}

export interface DiscordHeroAttributeTree {
  readonly HeroKey: number;
  readonly heroName: string;
  readonly heroTarget: string;
  readonly owned: boolean;
  readonly heroLevel: number | null;
  readonly pageCount: number;
  readonly groups: readonly DiscordHeroAttributeGroup[];
}

export interface DiscordHeroAttributePageOption {
  readonly target: string;
  readonly AttributeKey: number;
  readonly GroupKey: number;
  readonly label: string;
  readonly description: string;
  readonly allocatedLevel: number | null;
}

export interface DiscordHeroAttributePage {
  readonly HeroKey: number;
  readonly heroName: string;
  readonly heroTarget: string;
  readonly page: number;
  readonly pageCount: number;
  readonly pageTarget: string;
  readonly options: readonly DiscordHeroAttributePageOption[];
}

export interface DecodedDiscordHeroAttributePage {
  readonly heroKey: number;
  readonly page: number;
}

export interface DecodedDiscordHeroAttributeTarget extends DecodedDiscordHeroAttributePage {
  readonly attributeKey: number;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePositiveSafeInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
  return value as number;
}

function requireNonNegativeSafeInteger(
  value: unknown,
  context: string,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
  return value as number;
}

function sourceHero(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
): DiscordHeroDatasetRow<"heroes"> {
  requirePositiveSafeInteger(heroKey, "DiscordHero attribute hero key");
  try {
    return getCatalogRow(indexes, "heroes", heroKey);
  } catch {
    throw new Error(
      `DiscordHero attribute codec has unknown source hero ${heroKey}`,
    );
  }
}

function sourceAttributeKeys(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
): readonly number[] {
  const hero = sourceHero(indexes, heroKey);
  const seen = new Set<number>();
  const keys = hero.attribute_keys.map((value, index) => {
    const key = requirePositiveSafeInteger(
      value,
      `hero ${heroKey} attribute_keys[${index}]`,
    );
    if (seen.has(key)) {
      throw new Error(`hero ${heroKey} repeats attribute key ${key}`);
    }
    seen.add(key);
    return key;
  });
  if (keys.length === 0) {
    throw new Error(`hero ${heroKey} has no source attribute keys`);
  }
  return keys;
}

function requirePage(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  page: number,
): void {
  requireNonNegativeSafeInteger(page, "DiscordHero attribute page");
  const pageCount = discordHeroAttributePageCount(indexes, heroKey);
  if (page >= pageCount) {
    throw new Error(
      `DiscordHero attribute page ${page} is outside 0-${pageCount - 1} for hero ${heroKey}`,
    );
  }
}

function requireTargetLocation(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  page: number,
  attributeKey: number,
): void {
  requirePage(indexes, heroKey, page);
  requirePositiveSafeInteger(attributeKey, "DiscordHero attribute target key");
  let attribute: DiscordHeroDatasetRow<"attributes">;
  try {
    attribute = getCatalogRow(indexes, "attributes", attributeKey);
  } catch {
    throw new Error(
      `DiscordHero attribute target has unknown source attribute ${attributeKey}`,
    );
  }
  if (attribute.HeroKey !== heroKey) {
    throw new Error(
      `attribute ${attributeKey} belongs to hero ${attribute.HeroKey}, not ${heroKey}`,
    );
  }
  const rowIndex = sourceAttributeKeys(indexes, heroKey).indexOf(attributeKey);
  if (rowIndex < 0) {
    throw new Error(
      `hero ${heroKey} attribute_keys omit source attribute ${attributeKey}`,
    );
  }
  const expectedPage = Math.floor(rowIndex / ATTRIBUTE_PAGE_SIZE);
  if (page !== expectedPage) {
    throw new Error(
      `attribute ${attributeKey} is on page ${expectedPage}, not ${page}`,
    );
  }
}

function encodePositive(value: number, context: string): string {
  return requirePositiveSafeInteger(value, context).toString(36);
}

function encodeNonNegative(value: number, context: string): string {
  return requireNonNegativeSafeInteger(value, context).toString(36);
}

function decodeSegment(
  encoded: string,
  context: string,
  allowZero: boolean,
): number {
  if (!/^[0-9a-z]+$/.test(encoded)) {
    throw new Error(`${context} has invalid encoding`);
  }
  const decoded = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(decoded) ||
    decoded < (allowZero ? 0 : 1) ||
    decoded.toString(36) !== encoded
  ) {
    throw new Error(`${context} has non-canonical encoding`);
  }
  return decoded;
}

function requireCodecLength(value: string, context: string): void {
  if (value.length === 0 || value.length > MAX_CODEC_LENGTH) {
    throw new Error(`${context} has invalid encoding`);
  }
}

export function encodeDiscordHeroAttributeHero(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
): string {
  sourceHero(indexes, heroKey);
  return `h-${encodePositive(heroKey, "DiscordHero attribute hero key")}`;
}

export function decodeDiscordHeroAttributeHero(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): number {
  requireCodecLength(value, "DiscordHero attribute hero");
  const match = /^h-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero attribute hero has invalid encoding");
  }
  const heroKey = decodeSegment(match[1]!, "DiscordHero attribute hero", false);
  sourceHero(indexes, heroKey);
  return heroKey;
}

export function discordHeroAttributePageCount(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
): number {
  return Math.ceil(
    sourceAttributeKeys(indexes, heroKey).length / ATTRIBUTE_PAGE_SIZE,
  );
}

export function encodeDiscordHeroAttributePage(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  page: number,
): string {
  requirePage(indexes, heroKey, page);
  return (
    `p-${encodePositive(heroKey, "DiscordHero attribute hero key")}-` +
    encodeNonNegative(page, "DiscordHero attribute page")
  );
}

export function decodeDiscordHeroAttributePage(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DecodedDiscordHeroAttributePage {
  requireCodecLength(value, "DiscordHero attribute page");
  const match = /^p-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero attribute page has invalid encoding");
  }
  const heroKey = decodeSegment(
    match[1]!,
    "DiscordHero attribute page hero",
    false,
  );
  const page = decodeSegment(match[2]!, "DiscordHero attribute page", true);
  requirePage(indexes, heroKey, page);
  return deepFreeze({ heroKey, page });
}

export function encodeDiscordHeroAttributeTarget(
  indexes: DiscordHeroCatalogIndexes,
  heroKey: number,
  page: number,
  attributeKey: number,
): string {
  requireTargetLocation(indexes, heroKey, page, attributeKey);
  return (
    `a-${encodePositive(heroKey, "DiscordHero attribute hero key")}-` +
    `${encodeNonNegative(page, "DiscordHero attribute page")}-` +
    encodePositive(attributeKey, "DiscordHero attribute target key")
  );
}

export function decodeDiscordHeroAttributeTarget(
  indexes: DiscordHeroCatalogIndexes,
  value: string,
): DecodedDiscordHeroAttributeTarget {
  requireCodecLength(value, "DiscordHero attribute target");
  const match = /^a-([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero attribute target has invalid encoding");
  }
  const heroKey = decodeSegment(
    match[1]!,
    "DiscordHero attribute target hero",
    false,
  );
  const page = decodeSegment(
    match[2]!,
    "DiscordHero attribute target page",
    true,
  );
  const attributeKey = decodeSegment(
    match[3]!,
    "DiscordHero attribute target",
    false,
  );
  requireTargetLocation(indexes, heroKey, page, attributeKey);
  return deepFreeze({ heroKey, page, attributeKey });
}

function localizedEnglish(
  values: Readonly<Record<string, unknown>> | undefined,
  context: string,
): string {
  const value = values?.["en-US"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} has no English source text`);
  }
  return value;
}

function validateEmbeddedAttribute(
  embedded: unknown,
  attribute: DiscordHeroDatasetRow<"attributes">,
  group: DiscordHeroDatasetRow<"attribute_groups">,
): void {
  if (!isRecord(embedded)) {
    throw new Error(
      `hero ${attribute.HeroKey} embedded attribute ${attribute.AttributeKey} is not an object`,
    );
  }
  const expected = {
    key: attribute.AttributeKey,
    type: attribute.ATTRIBUTETYPE,
    group: attribute.GroupKey,
    groupReq: group.RequiredAllocatedPoint,
    required: attribute.RequiredPoint,
    maxLevel: attribute.MaxLevel,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (embedded[field] !== value) {
      throw new Error(
        `hero ${attribute.HeroKey} embedded attribute ${attribute.AttributeKey} ${field} diverges from source`,
      );
    }
  }
  if (attribute.ATTRIBUTETYPE === "ACTIVESKILL") {
    const active = embedded.activeSkill;
    if (!isRecord(active) || active.key !== attribute.Value) {
      throw new Error(
        `hero ${attribute.HeroKey} embedded active attribute ${attribute.AttributeKey} diverges from skill ${attribute.Value}`,
      );
    }
  } else {
    const passive = embedded.passive;
    if (!isRecord(passive) || typeof passive.stat !== "string") {
      throw new Error(
        `hero ${attribute.HeroKey} embedded passive attribute ${attribute.AttributeKey} is malformed`,
      );
    }
  }
}

function validateSkillLevels(
  indexes: DiscordHeroCatalogIndexes,
  attributeKey: number,
  skill: ActiveSkillRow,
): void {
  const sourceLevels =
    skill.SkillLevelKey === null
      ? []
      : (indexes.tables.skill_levels.groups.get(skill.SkillLevelKey) ?? []);
  if (sourceLevels.length !== skill.levels.length) {
    throw new Error(
      `attribute ${attributeKey} skill ${String(skill.SkillKey)} levels diverge from source`,
    );
  }
  for (const [index, source] of sourceLevels.entries()) {
    const embedded = skill.levels[index];
    if (
      !isRecord(embedded) ||
      embedded.level !== source.Level ||
      embedded.value !== source.Value
    ) {
      throw new Error(
        `attribute ${attributeKey} skill ${String(skill.SkillKey)} level ${index} diverges from source`,
      );
    }
  }
}

function buildRelation(
  indexes: DiscordHeroCatalogIndexes,
  attribute: DiscordHeroDatasetRow<"attributes">,
): DiscordHeroAttributeRelation {
  if (attribute.ATTRIBUTETYPE === "PASSIVESKILL") {
    const passive = getCatalogRow(indexes, "passive_skills", attribute.Value);
    if (
      typeof passive.PassiveSkillKey !== "number" ||
      passive.PassiveSkillKey !== attribute.Value
    ) {
      throw new Error(
        `attribute ${attribute.AttributeKey} relation expected numeric passive key ${attribute.Value}; received ${JSON.stringify(passive.PassiveSkillKey)}`,
      );
    }
    localizedEnglish(
      passive.SkillNameKey_i18n,
      `passive skill ${passive.PassiveSkillKey}`,
    );
    return {
      kind: "passive-skill",
      source: passive,
    };
  }
  if (attribute.ATTRIBUTETYPE !== "ACTIVESKILL") {
    throw new Error(
      `attribute ${attribute.AttributeKey} has unsupported type ${attribute.ATTRIBUTETYPE}`,
    );
  }
  const skill = getCatalogRow(indexes, "skills", attribute.Value);
  if (
    typeof skill.SkillKey !== "number" ||
    skill.SkillKey !== attribute.Value
  ) {
    throw new Error(
      `attribute ${attribute.AttributeKey} relation expected numeric skill key ${attribute.Value}; received ${JSON.stringify(skill.SkillKey)}`,
    );
  }
  if (skill.AttributeKey !== attribute.AttributeKey) {
    throw new Error(
      `attribute ${attribute.AttributeKey} skill ${skill.SkillKey} points back to attribute ${String(skill.AttributeKey)}`,
    );
  }
  localizedEnglish(skill.SkillNameKey_i18n, `active skill ${skill.SkillKey}`);
  if (skill.SkillDescriptionKey !== null) {
    localizedEnglish(
      skill.SkillDescriptionKey_i18n,
      `active skill ${skill.SkillKey} description`,
    );
  }
  validateSkillLevels(indexes, attribute.AttributeKey, skill);
  return {
    kind: "active-skill",
    source: skill,
  };
}

export function projectDiscordHeroAttributeTrees(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): readonly DiscordHeroAttributeTree[] {
  validateDiscordHeroAttributeOwnedHeroes(indexes, state);
  if (indexes.tables.heroes.rows.length !== 6) {
    throw new Error(
      `DiscordHero attribute browser expected 6 heroes; received ${indexes.tables.heroes.rows.length}`,
    );
  }
  if (indexes.tables.attributes.rows.length !== 132) {
    throw new Error(
      `DiscordHero attribute browser expected 132 attributes; received ${indexes.tables.attributes.rows.length}`,
    );
  }
  if (indexes.tables.attribute_groups.rows.length !== 8) {
    throw new Error(
      `DiscordHero attribute browser expected 8 groups; received ${indexes.tables.attribute_groups.rows.length}`,
    );
  }

  const ownedHeroes = new Map(state.heroes.map((hero) => [hero.heroKey, hero]));
  const trees = indexes.tables.heroes.rows.map(
    (hero): DiscordHeroAttributeTree => {
      const keys = sourceAttributeKeys(indexes, hero.HeroKey);
      const sourceRows = indexes.tables.attributes.rows.filter(
        (attribute) => attribute.HeroKey === hero.HeroKey,
      );
      if (keys.length !== 22 || sourceRows.length !== 22) {
        throw new Error(
          `hero ${hero.HeroKey} must have exactly 22 source attributes`,
        );
      }
      if (
        sourceRows.some(
          (attribute, index) => attribute.AttributeKey !== keys[index],
        )
      ) {
        throw new Error(
          `hero ${hero.HeroKey} attribute_keys diverge from source attribute order`,
        );
      }
      if (hero.attributes.length !== keys.length) {
        throw new Error(
          `hero ${hero.HeroKey} embedded attributes diverge from attribute_keys`,
        );
      }

      const progress = ownedHeroes.get(hero.HeroKey);
      const groupRanks = new Map(
        indexes.tables.attribute_groups.rows.map((group, index) => [
          group.AttributeGroupKey,
          index,
        ]),
      );
      let previousGroupRank = -1;
      const nodes = sourceRows.map(
        (attribute, index): DiscordHeroAttributeNode => {
          requirePositiveSafeInteger(
            attribute.AttributeKey,
            `hero ${hero.HeroKey} attribute key`,
          );
          if (attribute.HeroKey !== hero.HeroKey) {
            throw new Error(
              `attribute ${attribute.AttributeKey} belongs to hero ${attribute.HeroKey}, not ${hero.HeroKey}`,
            );
          }
          const group = getCatalogRow(
            indexes,
            "attribute_groups",
            attribute.GroupKey,
          );
          const groupRank = groupRanks.get(group.AttributeGroupKey);
          if (groupRank === undefined || groupRank < previousGroupRank) {
            throw new Error(
              `hero ${hero.HeroKey} attribute ${attribute.AttributeKey} violates source group order`,
            );
          }
          previousGroupRank = groupRank;
          validateEmbeddedAttribute(hero.attributes[index], attribute, group);
          const relation = buildRelation(indexes, attribute);
          const effect = projectDiscordHeroAttributeEffect(
            indexes,
            state,
            hero.HeroKey,
            attribute.AttributeKey,
          );
          return {
            AttributeKey: attribute.AttributeKey,
            HeroKey: attribute.HeroKey,
            GroupKey: attribute.GroupKey,
            ATTRIBUTETYPE: attribute.ATTRIBUTETYPE,
            Value: attribute.Value,
            RequiredPoint: attribute.RequiredPoint,
            MaxLevel: attribute.MaxLevel,
            AvailableDemo: attribute.AvailableDemo,
            allocatedLevel: effect.allocatedLevel,
            effect,
            target: encodeDiscordHeroAttributeTarget(
              indexes,
              hero.HeroKey,
              Math.floor(index / ATTRIBUTE_PAGE_SIZE),
              attribute.AttributeKey,
            ),
            relation,
          };
        },
      );
      const groups = indexes.tables.attribute_groups.rows.map(
        (source): DiscordHeroAttributeGroup => {
          requireNonNegativeSafeInteger(
            source.RequiredAllocatedPoint,
            `attribute group ${source.AttributeGroupKey} required allocated point`,
          );
          const groupNodes = nodes.filter(
            (node) => node.GroupKey === source.AttributeGroupKey,
          );
          if (groupNodes.length === 0) {
            throw new Error(
              `hero ${hero.HeroKey} has no attributes in source group ${source.AttributeGroupKey}`,
            );
          }
          return {
            AttributeGroupKey: source.AttributeGroupKey,
            RequiredAllocatedPoint: source.RequiredAllocatedPoint,
            nodes: groupNodes,
          };
        },
      );
      if (
        groups.reduce((count, group) => count + group.nodes.length, 0) !==
        nodes.length
      ) {
        throw new Error(
          `hero ${hero.HeroKey} has attributes outside source groups`,
        );
      }
      return {
        HeroKey: hero.HeroKey,
        heroName: getLocalizedCatalogName(
          indexes,
          "heroes",
          hero.HeroKey,
          "en-US",
        ),
        heroTarget: encodeDiscordHeroAttributeHero(indexes, hero.HeroKey),
        owned: progress !== undefined,
        heroLevel: progress?.level ?? null,
        pageCount: discordHeroAttributePageCount(indexes, hero.HeroKey),
        groups,
      };
    },
  );
  return deepFreeze(
    structuredClone(trees),
  ) as readonly DiscordHeroAttributeTree[];
}

function optionText(value: string): string {
  if (value.length <= MAX_OPTION_TEXT_LENGTH) return value;
  const contentBudget = MAX_OPTION_TEXT_LENGTH - 1;
  let contentLength = 0;
  let preview = "";
  for (const codePoint of value) {
    if (contentLength + codePoint.length > contentBudget) break;
    preview += codePoint;
    contentLength += codePoint.length;
  }
  return `${preview}…`;
}

function relationName(relation: DiscordHeroAttributeRelation): string {
  return relation.kind === "passive-skill"
    ? localizedEnglish(
        relation.source.SkillNameKey_i18n,
        `passive skill ${relation.source.PassiveSkillKey}`,
      )
    : localizedEnglish(
        relation.source.SkillNameKey_i18n,
        `active skill ${String(relation.source.SkillKey)}`,
      );
}

function relationDescription(node: DiscordHeroAttributeNode): string {
  if (
    node.relation.kind === "active-skill" &&
    node.relation.source.SkillDescriptionKey !== null
  ) {
    return localizedEnglish(
      node.relation.source.SkillDescriptionKey_i18n,
      `active skill ${String(node.relation.source.SkillKey)} description`,
    );
  }
  return `${node.ATTRIBUTETYPE} · Required ${node.RequiredPoint} · Max ${node.MaxLevel}`;
}

export function discordHeroAttributePage(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  pageTarget: string,
): DiscordHeroAttributePage {
  const decoded = decodeDiscordHeroAttributePage(indexes, pageTarget);
  const tree = projectDiscordHeroAttributeTrees(indexes, state).find(
    (candidate) => candidate.HeroKey === decoded.heroKey,
  );
  if (tree === undefined) {
    throw new Error(
      `DiscordHero attribute page has unresolved hero ${decoded.heroKey}`,
    );
  }
  const nodes = tree.groups
    .flatMap((group) => group.nodes)
    .slice(
      decoded.page * ATTRIBUTE_PAGE_SIZE,
      (decoded.page + 1) * ATTRIBUTE_PAGE_SIZE,
    );
  const options = nodes.map((node): DiscordHeroAttributePageOption => ({
    target: node.target,
    AttributeKey: node.AttributeKey,
    GroupKey: node.GroupKey,
    label: optionText(relationName(node.relation)),
    description: optionText(relationDescription(node)),
    allocatedLevel: node.allocatedLevel,
  }));
  if (options.length === 0 || options.length > ATTRIBUTE_PAGE_SIZE) {
    throw new Error(
      `DiscordHero attribute page ${decoded.page} has invalid option count ${options.length}`,
    );
  }
  return deepFreeze(
    structuredClone({
      HeroKey: tree.HeroKey,
      heroName: tree.heroName,
      heroTarget: tree.heroTarget,
      page: decoded.page,
      pageCount: tree.pageCount,
      pageTarget: encodeDiscordHeroAttributePage(
        indexes,
        tree.HeroKey,
        decoded.page,
      ),
      options,
    }),
  ) as DiscordHeroAttributePage;
}

export function readDiscordHeroAttributeDetail(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  target: string,
): DiscordHeroAttributeNode {
  const decoded = decodeDiscordHeroAttributeTarget(indexes, target);
  const node = projectDiscordHeroAttributeTrees(indexes, state)
    .find((tree) => tree.HeroKey === decoded.heroKey)
    ?.groups.flatMap((group) => group.nodes)
    .find((candidate) => candidate.AttributeKey === decoded.attributeKey);
  if (node === undefined) {
    throw new Error(
      `DiscordHero attribute detail has unresolved attribute ${decoded.attributeKey}`,
    );
  }
  return deepFreeze(structuredClone(node)) as DiscordHeroAttributeNode;
}
