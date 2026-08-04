import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

export type StageMonsterRole = "wave" | "boss";

export interface StageMonsterScalingInput {
  readonly stageKey: number;
  readonly monsterKey: number;
  readonly role: StageMonsterRole;
  readonly [key: string]: unknown;
}

export interface StageMonsterMultipliersPerThousand {
  readonly attackDamage: number;
  readonly maxLife: number;
  readonly sourceRewardGoldPerMonster: number;
  readonly sourceRewardExpPerMonster: number;
}

export interface StageMonsterBaseStats {
  readonly stageKey: number;
  readonly stageLevel: number;
  readonly monsterKey: number;
  readonly role: StageMonsterRole;
  readonly maxLife: number;
  readonly attackDamage: number;
  readonly sourceRewardGoldPerMonster: number;
  readonly sourceRewardExpPerMonster: number;
  readonly attackSpeedRaw: number;
  readonly movementSpeedRaw: number;
  readonly stageMultipliersPerThousand: StageMonsterMultipliersPerThousand;
  readonly bossMultipliersPerThousand: StageMonsterMultipliersPerThousand | null;
  readonly bossScaleRaw: number | null;
}

function validateStageMonsterScalingInput(
  value: unknown,
): asserts value is StageMonsterScalingInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("monster scaling input must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(
      "monster scaling input prototype must be Object.prototype or null",
    );
  }

  const allowedFields = new Set(["stageKey", "monsterKey", "role"]);
  const ownKeys = Reflect.ownKeys(value);
  const unknownStringField = ownKeys.find(
    (key): key is string => typeof key === "string" && !allowedFields.has(key),
  );
  if (unknownStringField !== undefined) {
    throw new Error(
      `monster scaling input has unknown field ${unknownStringField}`,
    );
  }
  if (
    ownKeys.length !== allowedFields.size ||
    ownKeys.some((key) => typeof key !== "string") ||
    [...allowedFields].some((field) => !Object.hasOwn(value, field))
  ) {
    throw new Error(
      "monster scaling input must contain exactly stageKey, monsterKey, and role as own string fields",
    );
  }
}

function requirePositiveSafeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
  return value;
}

function roundHalfEvenPerThousand(
  value: number,
  multiplier: number,
  context: string,
): number {
  if (value > Math.floor(Number.MAX_SAFE_INTEGER / multiplier)) {
    throw new Error(`${context} product exceeds the safe-integer range`);
  }
  const product = value * multiplier;
  const quotient = Math.floor(product / 1000);
  const remainder = product % 1000;
  if (remainder < 500) return quotient;
  if (remainder > 500) return quotient + 1;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

function parseWaveMonsterKeys(stageKey: number, source: unknown): number[] {
  if (
    typeof source !== "string" ||
    !/^[1-9]\d*_[1-9]\d*( [1-9]\d*_[1-9]\d*)*$/.test(source)
  ) {
    throw new Error(`normal stage ${stageKey} has invalid monster weights`);
  }
  const seen = new Set<number>();
  const monsterKeys: number[] = [];
  for (const token of source.split(" ")) {
    const [monsterKeyText, weightText] = token.split("_");
    const monsterKey = requirePositiveSafeInteger(
      Number(monsterKeyText),
      `stage ${stageKey} wave monster key`,
    );
    requirePositiveSafeInteger(
      Number(weightText),
      `stage ${stageKey} wave monster weight`,
    );
    if (seen.has(monsterKey)) {
      throw new Error(
        `stage ${stageKey} has duplicate wave monster ${monsterKey}`,
      );
    }
    seen.add(monsterKey);
    monsterKeys.push(monsterKey);
  }
  return monsterKeys;
}

export function projectStageMonsterBaseStats(
  indexes: DiscordHeroCatalogIndexes,
  input: StageMonsterScalingInput,
): StageMonsterBaseStats {
  validateStageMonsterScalingInput(input);
  const stageKey = requirePositiveSafeInteger(input.stageKey, "stage key");
  const monsterKey = requirePositiveSafeInteger(
    input.monsterKey,
    "monster key",
  );
  if (input.role !== "wave" && input.role !== "boss") {
    throw new Error("monster role must be wave or boss");
  }

  const stage = getCatalogRow(indexes, "stages", stageKey);
  if (stage.StageKey !== stageKey) {
    throw new Error(
      `stage group ${stageKey} contains stage key ${stage.StageKey}`,
    );
  }
  const stageLevelKey = requirePositiveSafeInteger(
    stage.StageLevel,
    `stage ${stageKey} level`,
  );
  const stageLevel = getCatalogRow(indexes, "stage_levels", stageLevelKey);
  if (stageLevel.StageLevel !== stageLevelKey) {
    throw new Error(
      `stage-level group ${stageLevelKey} contains stage level ${stageLevel.StageLevel}`,
    );
  }
  const monster = getCatalogRow(indexes, "monsters", monsterKey);
  if (monster.MonsterKey !== monsterKey) {
    throw new Error(
      `monster group ${monsterKey} contains monster key ${monster.MonsterKey}`,
    );
  }

  const maxLife = requirePositiveSafeInteger(
    monster.MaxLife,
    `monster ${monsterKey} MaxLife`,
  );
  const attackDamage = requirePositiveSafeInteger(
    monster.AttackDamage,
    `monster ${monsterKey} AttackDamage`,
  );
  const rewardGold = requirePositiveSafeInteger(
    monster.RewardGold,
    `monster ${monsterKey} RewardGold`,
  );
  const rewardExp = requirePositiveSafeInteger(
    monster.RewardExp,
    `monster ${monsterKey} RewardExp`,
  );
  const attackSpeed = requirePositiveSafeInteger(
    monster.AttackSpeed,
    `monster ${monsterKey} AttackSpeed`,
  );
  const movementSpeed = requirePositiveSafeInteger(
    monster.MovementSpeed,
    `monster ${monsterKey} MovementSpeed`,
  );

  const stageMultipliersPerThousand = Object.freeze({
    attackDamage: requirePositiveSafeInteger(
      stageLevel.MonsterAtkDmgMultiplier,
      `stage level ${stageLevelKey} MonsterAtkDmgMultiplier`,
    ),
    maxLife: requirePositiveSafeInteger(
      stageLevel.MonsterHpMultiplier,
      `stage level ${stageLevelKey} MonsterHpMultiplier`,
    ),
    sourceRewardGoldPerMonster: requirePositiveSafeInteger(
      stageLevel.MonsterGoldMultiplier,
      `stage level ${stageLevelKey} MonsterGoldMultiplier`,
    ),
    sourceRewardExpPerMonster: requirePositiveSafeInteger(
      stageLevel.MonsterExpMultiplier,
      `stage level ${stageLevelKey} MonsterExpMultiplier`,
    ),
  });

  let bossMultipliersPerThousand: StageMonsterMultipliersPerThousand | null =
    null;
  let bossScaleRaw: number | null = null;
  if (stage.STAGETYPE === "ACTBOSS") {
    for (const [field, value] of [
      ["BossDamageMultiplier", stage.BossDamageMultiplier],
      ["BossHpMultiplier", stage.BossHpMultiplier],
      ["BossGoldMultiplier", stage.BossGoldMultiplier],
      ["BossExpMultiplier", stage.BossExpMultiplier],
      ["BossScale", stage.BossScale],
    ] as const) {
      if (value !== null) {
        throw new Error(`act-boss stage ${stageKey} ${field} must be null`);
      }
    }
    if (input.role === "wave") {
      throw new Error(`act-boss stage ${stageKey} has no wave monsters`);
    }
    if (stage.BossMonsterKey !== monsterKey) {
      throw new Error(
        `monster ${monsterKey} does not match boss monster ${stage.BossMonsterKey}`,
      );
    }
  } else if (stage.STAGETYPE === "NORMAL") {
    const normalBossScale = requirePositiveSafeInteger(
      stage.BossScale,
      `stage ${stageKey} BossScale`,
    );
    if (input.role === "wave") {
      const waveMonsterKeys = parseWaveMonsterKeys(stageKey, stage.Monsters);
      const membershipCount = waveMonsterKeys.filter(
        (key) => key === monsterKey,
      ).length;
      if (membershipCount !== 1) {
        throw new Error(
          `monster ${monsterKey} is not one exact wave monster in stage ${stageKey}`,
        );
      }
    } else {
      if (stage.BossMonsterKey !== monsterKey) {
        throw new Error(
          `monster ${monsterKey} does not match boss monster ${stage.BossMonsterKey}`,
        );
      }
      bossMultipliersPerThousand = Object.freeze({
        attackDamage: requirePositiveSafeInteger(
          stage.BossDamageMultiplier,
          `stage ${stageKey} BossDamageMultiplier`,
        ),
        maxLife: requirePositiveSafeInteger(
          stage.BossHpMultiplier,
          `stage ${stageKey} BossHpMultiplier`,
        ),
        sourceRewardGoldPerMonster: requirePositiveSafeInteger(
          stage.BossGoldMultiplier,
          `stage ${stageKey} BossGoldMultiplier`,
        ),
        sourceRewardExpPerMonster: requirePositiveSafeInteger(
          stage.BossExpMultiplier,
          `stage ${stageKey} BossExpMultiplier`,
        ),
      });
      bossScaleRaw = normalBossScale;
    }
  } else {
    throw new Error(
      `stage ${stageKey} has unsupported type ${stage.STAGETYPE}`,
    );
  }

  const scaledMaxLife = roundHalfEvenPerThousand(
    maxLife,
    stageMultipliersPerThousand.maxLife,
    "monster max life stage",
  );
  const scaledAttackDamage = roundHalfEvenPerThousand(
    attackDamage,
    stageMultipliersPerThousand.attackDamage,
    "monster attack damage stage",
  );
  const scaledRewardGold = roundHalfEvenPerThousand(
    rewardGold,
    stageMultipliersPerThousand.sourceRewardGoldPerMonster,
    "monster reward gold stage",
  );
  const scaledRewardExp = roundHalfEvenPerThousand(
    rewardExp,
    stageMultipliersPerThousand.sourceRewardExpPerMonster,
    "monster reward EXP stage",
  );

  return Object.freeze({
    stageKey,
    stageLevel: stageLevelKey,
    monsterKey,
    role: input.role,
    maxLife:
      bossMultipliersPerThousand === null
        ? scaledMaxLife
        : roundHalfEvenPerThousand(
            scaledMaxLife,
            bossMultipliersPerThousand.maxLife,
            "monster max life boss",
          ),
    attackDamage:
      bossMultipliersPerThousand === null
        ? scaledAttackDamage
        : roundHalfEvenPerThousand(
            scaledAttackDamage,
            bossMultipliersPerThousand.attackDamage,
            "monster attack damage boss",
          ),
    sourceRewardGoldPerMonster:
      bossMultipliersPerThousand === null
        ? scaledRewardGold
        : roundHalfEvenPerThousand(
            scaledRewardGold,
            bossMultipliersPerThousand.sourceRewardGoldPerMonster,
            "monster reward gold boss",
          ),
    sourceRewardExpPerMonster:
      bossMultipliersPerThousand === null
        ? scaledRewardExp
        : roundHalfEvenPerThousand(
            scaledRewardExp,
            bossMultipliersPerThousand.sourceRewardExpPerMonster,
            "monster reward EXP boss",
          ),
    attackSpeedRaw: attackSpeed,
    movementSpeedRaw: movementSpeed,
    stageMultipliersPerThousand,
    bossMultipliersPerThousand,
    bossScaleRaw,
  });
}
