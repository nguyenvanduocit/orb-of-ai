import {
  getCatalogGroup,
  getCatalogRow,
  getLocalizedCatalogName,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

export interface StageSourceRewardPreviewInput {
  readonly stageKey: number;
  readonly locale: "en-US";
  readonly [key: string]: unknown;
}

export interface StageSourceItemRef {
  readonly itemKey: number;
  readonly name: string;
  readonly grade: string;
  readonly itemType: string;
}

export interface StageSourceFirstClearRow {
  readonly sourceIndex: number;
  readonly dropTypeRaw: string;
  readonly rewardType: "ITEM" | "ITEMGROUP";
  readonly rewardKey: number;
  readonly heroKeyCondition: number | null;
  readonly weightRaw: number;
  readonly catalogItemRefs: readonly StageSourceItemRef[];
}

export interface StageSourceRewardPreview {
  readonly stageKey: number;
  readonly monsterItemRef: Readonly<{
    item: StageSourceItemRef;
    sourceChancePerThousand: number;
  }> | null;
  readonly bossItemRef: Readonly<{
    item: StageSourceItemRef;
    sourceChancePerThousand: number | null;
  }>;
  readonly firstClearTableRef: Readonly<{
    dropKey: number;
    sourceRows: readonly StageSourceFirstClearRow[];
  }> | null;
  readonly soulstoneItemRef: Readonly<{
    item: StageSourceItemRef;
    amountRaw: number;
  }> | null;
}

function validateInput(
  value: unknown,
): asserts value is StageSourceRewardPreviewInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("stage reward preview input must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(
      "stage reward preview input prototype must be Object.prototype or null",
    );
  }

  const allowedFields = new Set(["stageKey", "locale"]);
  const ownKeys = Reflect.ownKeys(value);
  const unknownStringField = ownKeys.find(
    (key): key is string => typeof key === "string" && !allowedFields.has(key),
  );
  if (unknownStringField !== undefined) {
    throw new Error(
      `stage reward preview input has unknown field ${unknownStringField}`,
    );
  }
  if (
    ownKeys.length !== allowedFields.size ||
    ownKeys.some((key) => typeof key !== "string") ||
    [...allowedFields].some((field) => !Object.hasOwn(value, field))
  ) {
    throw new Error(
      "stage reward preview input must contain exactly stageKey and locale as own string fields",
    );
  }
}

function requirePositiveSafeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
  return value;
}

function requireNonNegativeSafeInteger(
  value: unknown,
  context: string,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
  return value;
}

function requireSourceChance(value: unknown, context: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 1000
  ) {
    throw new Error(`${context} must be a safe integer between 0 and 1000`);
  }
  return value;
}

function projectItem(
  indexes: DiscordHeroCatalogIndexes,
  itemKeySource: unknown,
  locale: "en-US",
): StageSourceItemRef {
  const itemKey = requirePositiveSafeInteger(itemKeySource, "item key");
  const item = getCatalogRow(indexes, "items", itemKey);
  if (item.id !== itemKey) {
    throw new Error(`item key ${itemKey} contains item ${item.id}`);
  }
  if (typeof item.grade !== "string" || item.grade.length === 0) {
    throw new Error(`item ${itemKey} grade must be a non-empty string`);
  }
  if (typeof item.type !== "string" || item.type.length === 0) {
    throw new Error(`item ${itemKey} type must be a non-empty string`);
  }
  return Object.freeze({
    itemKey,
    name: getLocalizedCatalogName(indexes, "items", itemKey, locale),
    grade: item.grade,
    itemType: item.type,
  });
}

function projectFirstClearTable(
  indexes: DiscordHeroCatalogIndexes,
  dropKeySource: unknown,
  locale: "en-US",
): NonNullable<StageSourceRewardPreview["firstClearTableRef"]> {
  const dropKey = requirePositiveSafeInteger(
    dropKeySource,
    "first-clear drop key",
  );
  const rows = getCatalogGroup(indexes, "drops", dropKey);
  if (rows.length === 0) {
    throw new Error(
      `first-clear table ${dropKey} must contain at least one row`,
    );
  }

  const sourceRows = rows.map((row, sourceIndex): StageSourceFirstClearRow => {
    if (row.DropKey !== dropKey) {
      throw new Error(
        `first-clear table ${dropKey} contains drop key ${row.DropKey}`,
      );
    }
    if (typeof row.DropType !== "string" || row.DropType.length === 0) {
      throw new Error(
        `first-clear table ${dropKey} drop type ${sourceIndex} must be a non-empty string`,
      );
    }
    const rewardKey = requirePositiveSafeInteger(
      row.RewardKey,
      `first-clear table ${dropKey} reward key ${sourceIndex}`,
    );
    const weightRaw = requireNonNegativeSafeInteger(
      row.Weight,
      `first-clear table ${dropKey} weight ${sourceIndex}`,
    );
    if (row.HeroKeyCondition !== null && row.HeroKeyCondition !== 0) {
      const heroKey = requirePositiveSafeInteger(
        row.HeroKeyCondition,
        `first-clear table ${dropKey} hero condition ${sourceIndex}`,
      );
      const hero = getCatalogRow(indexes, "heroes", heroKey);
      if (hero.HeroKey !== heroKey) {
        throw new Error(`hero group ${heroKey} contains hero ${hero.HeroKey}`);
      }
    }

    let rewardType: StageSourceFirstClearRow["rewardType"];
    let catalogItemRefs: readonly StageSourceItemRef[];
    if (row.REWARDTYPE === "ITEM") {
      rewardType = "ITEM";
      catalogItemRefs = Object.freeze([
        projectItem(indexes, rewardKey, locale),
      ]);
    } else if (row.REWARDTYPE === "ITEMGROUP") {
      rewardType = "ITEMGROUP";
      const itemGroupRows = getCatalogGroup(indexes, "item_groups", rewardKey);
      if (itemGroupRows.length === 0) {
        throw new Error(
          `item group ${rewardKey} must contain at least one row`,
        );
      }
      catalogItemRefs = Object.freeze(
        itemGroupRows.map((itemGroupRow) => {
          if (itemGroupRow.ItemGroupKey !== rewardKey) {
            throw new Error(
              `item group ${rewardKey} contains group key ${itemGroupRow.ItemGroupKey}`,
            );
          }
          return projectItem(indexes, itemGroupRow.ItemKey, locale);
        }),
      );
    } else {
      throw new Error(
        `first-clear table ${dropKey} has unsupported reward type ${row.REWARDTYPE}`,
      );
    }

    return Object.freeze({
      sourceIndex,
      dropTypeRaw: row.DropType,
      rewardType,
      rewardKey,
      heroKeyCondition: row.HeroKeyCondition,
      weightRaw,
      catalogItemRefs,
    });
  });

  return Object.freeze({
    dropKey,
    sourceRows: Object.freeze(sourceRows),
  });
}

export function projectStageSourceRewardPreview(
  indexes: DiscordHeroCatalogIndexes,
  input: StageSourceRewardPreviewInput,
): StageSourceRewardPreview {
  validateInput(input);
  const stageKey = requirePositiveSafeInteger(input.stageKey, "stage key");
  const locale = input.locale;
  if (locale !== "en-US") {
    throw new Error("stage reward preview locale must be en-US");
  }

  const stage = getCatalogRow(indexes, "stages", stageKey);
  if (stage.StageKey !== stageKey) {
    throw new Error(
      `stage group ${stageKey} contains stage key ${stage.StageKey}`,
    );
  }
  if (stage.STAGETYPE !== "NORMAL" && stage.STAGETYPE !== "ACTBOSS") {
    throw new Error(
      `stage ${stageKey} has unsupported type ${stage.STAGETYPE}`,
    );
  }

  const hasMonsterItem = stage.MonsterDropItemKey !== null;
  const hasMonsterChance = stage.MonsterDropItemRate !== null;
  if (hasMonsterItem !== hasMonsterChance) {
    throw new Error(
      `stage ${stageKey} monster item key and source chance must both be present or both be null`,
    );
  }
  if (stage.STAGETYPE === "NORMAL" && !hasMonsterItem) {
    throw new Error(
      `normal stage ${stageKey} monster item key and source chance must both be present`,
    );
  }
  if (stage.STAGETYPE === "ACTBOSS" && hasMonsterItem) {
    throw new Error(
      `act-boss stage ${stageKey} monster item key and source chance must both be null`,
    );
  }

  const monsterItemRef =
    stage.MonsterDropItemKey === null || stage.MonsterDropItemRate === null
      ? null
      : Object.freeze({
          item: projectItem(indexes, stage.MonsterDropItemKey, locale),
          sourceChancePerThousand: requireSourceChance(
            stage.MonsterDropItemRate,
            `stage ${stageKey} monster source chance`,
          ),
        });

  const bossItem = projectItem(indexes, stage.BossDropItemKey, locale);
  let bossSourceChance: number | null;
  if (stage.STAGETYPE === "NORMAL") {
    if (stage.BossDropItemRate === null) {
      throw new Error(
        `normal stage ${stageKey} must have a boss source chance`,
      );
    }
    bossSourceChance = requireSourceChance(
      stage.BossDropItemRate,
      `stage ${stageKey} boss source chance`,
    );
  } else {
    if (stage.BossDropItemRate !== null) {
      throw new Error(
        `act-boss stage ${stageKey} boss source chance must be null`,
      );
    }
    bossSourceChance = null;
  }
  const bossItemRef = Object.freeze({
    item: bossItem,
    sourceChancePerThousand: bossSourceChance,
  });

  if (stage.STAGETYPE === "ACTBOSS" && stage.FirstClearDropKey !== null) {
    throw new Error(
      `act-boss stage ${stageKey} first-clear drop key must be null`,
    );
  }

  const hasSoulstoneItem = stage.SoulstoneItemKey !== null;
  const hasSoulstoneAmount = stage.SoulstoneAmount !== null;
  if (hasSoulstoneItem !== hasSoulstoneAmount) {
    throw new Error(
      `stage ${stageKey} soulstone item key and amount must both be present or both be null`,
    );
  }
  if (stage.STAGETYPE === "NORMAL" && hasSoulstoneItem) {
    throw new Error(
      `normal stage ${stageKey} soulstone item key and amount must be null`,
    );
  }
  if (stage.STAGETYPE === "ACTBOSS" && !hasSoulstoneItem) {
    throw new Error(
      `act-boss stage ${stageKey} soulstone item key and amount must both be present`,
    );
  }

  const firstClearTableRef =
    stage.FirstClearDropKey === null
      ? null
      : projectFirstClearTable(indexes, stage.FirstClearDropKey, locale);
  const soulstoneItemRef =
    stage.SoulstoneItemKey === null || stage.SoulstoneAmount === null
      ? null
      : Object.freeze({
          item: projectItem(indexes, stage.SoulstoneItemKey, locale),
          amountRaw: requirePositiveSafeInteger(
            stage.SoulstoneAmount,
            `stage ${stageKey} soulstone amount`,
          ),
        });

  return Object.freeze({
    stageKey,
    monsterItemRef,
    bossItemRef,
    firstClearTableRef,
    soulstoneItemRef,
  });
}
