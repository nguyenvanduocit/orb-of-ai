import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetKey,
  type DiscordHeroDatasetName,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { isHeroGearTypeCompatible } from "./equipment";
import {
  deriveDiscordHeroFormationCapacity,
  discordHeroStarterCandidates,
  isDiscordHeroPartyTransition,
  type DiscordHeroStarterKey,
} from "./party";
import { resolveRuneLevelRows } from "./rune-levels";
import {
  PlayerStateSchema,
  type GearAsset,
  type HeroProgress,
  type PlayerState,
  type StoredAsset,
} from "./player";
import { requireSourceRolledStatCandidate } from "./items";

type ContainerName = keyof PlayerState["containers"];

const CONTAINER_DATASETS = {
  inventory: "inventory",
  stash: "stash",
  storage: "storage",
  tradingStash: "trading_stash",
} as const satisfies Record<ContainerName, DiscordHeroDatasetName>;

function invariant(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatKey(key: string | number): string {
  return typeof key === "string" ? JSON.stringify(key) : String(key);
}

function requireCatalogRow<Name extends DiscordHeroDatasetName>(
  indexes: DiscordHeroCatalogIndexes,
  name: Name,
  key: string | number,
  path: string,
): DiscordHeroDatasetRow<Name> {
  try {
    return getCatalogRow(indexes, name, key as DiscordHeroDatasetKey<Name>);
  } catch {
    return invariant(
      `${path} references unknown ${name} key ${formatKey(key)}`,
    );
  }
}

function parseState(
  value: unknown,
  indexes: DiscordHeroCatalogIndexes,
  context: string,
): PlayerState {
  /*
   * These two source-backed checks intentionally precede Zod. Both can make a
   * second-order schema rule fail (party ownership or the static schema cap),
   * but the catalog error is the actionable cause.
   */
  if (isRecord(value) && Array.isArray(value.heroes)) {
    for (const [index, hero] of value.heroes.entries()) {
      if (
        isRecord(hero) &&
        typeof hero.heroKey === "number" &&
        Number.isSafeInteger(hero.heroKey) &&
        !indexes.tables.heroes.groups.has(hero.heroKey)
      ) {
        invariant(
          `heroes[${index}].heroKey references unknown heroes key ${hero.heroKey}`,
        );
      }
    }
  }
  if (isRecord(value) && isRecord(value.containers)) {
    for (const [containerName, datasetName] of Object.entries(
      CONTAINER_DATASETS,
    )) {
      const container = value.containers[containerName];
      if (
        isRecord(container) &&
        typeof container.unlockedSlots === "number" &&
        container.unlockedSlots > indexes.tables[datasetName].rows.length
      ) {
        invariant(
          `${containerName} unlocked capacity exceeds catalog row count ${indexes.tables[datasetName].rows.length}`,
        );
      }
    }
  }

  const parsed = PlayerStateSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || context}: ${issue.message}`)
      .join("; ");
    invariant(`player state does not match schema version 1: ${details}`);
  }
  return parsed.data;
}

function validateRolledStats(
  asset: GearAsset,
  path: string,
  indexes: DiscordHeroCatalogIndexes,
): void {
  for (const [index, rolledStat] of asset.rolledStats.entries()) {
    const sourceRows = indexes.tables.stat_mods.groups.get(
      rolledStat.statModKey,
    );
    if (sourceRows === undefined) {
      invariant(
        `${path}.rolledStats[${index}].statModKey references unknown stat_mods key ${rolledStat.statModKey}`,
      );
    }
    requireSourceRolledStatCandidate({
      sourceRows,
      statModKey: rolledStat.statModKey,
      value: rolledStat.value,
    });
  }
}

function validateStoredAsset(
  asset: StoredAsset,
  path: string,
  indexes: DiscordHeroCatalogIndexes,
): void {
  const item = requireCatalogRow(
    indexes,
    "items",
    asset.itemKey,
    `${path}.itemKey`,
  );
  if (item.deleted === true) {
    invariant(`${path}.itemKey references deleted item ${asset.itemKey}`);
  }

  if (asset.kind === "gear") {
    if (item.type !== "GEAR" || item.gear === null) {
      invariant(`${path} is gear but item ${asset.itemKey} is ${item.type}`);
    }
    requireCatalogRow(indexes, "gear", asset.itemKey, `${path}.itemKey`);
    validateRolledStats(asset, path, indexes);
  } else if (item.type === "GEAR") {
    invariant(`${path} is a stack but item ${asset.itemKey} is GEAR`);
  }
}

function maxNestedLevel(rows: readonly unknown[], path: string): number {
  let maximum = 0;
  for (const [index, value] of rows.entries()) {
    if (
      !isRecord(value) ||
      typeof value.level !== "number" ||
      !Number.isSafeInteger(value.level) ||
      value.level < 1
    ) {
      invariant(`${path}[${index}].level is not a positive safe integer`);
    }
    maximum = Math.max(maximum, value.level);
  }
  return maximum;
}

function validateHero(
  hero: HeroProgress,
  heroIndex: number,
  indexes: DiscordHeroCatalogIndexes,
): void {
  const path = `heroes[${heroIndex}]`;
  const heroRow = requireCatalogRow(
    indexes,
    "heroes",
    hero.heroKey,
    `${path}.heroKey`,
  );
  if (!heroRow.IsAvailable) {
    invariant(`${path}.heroKey references unavailable hero ${hero.heroKey}`);
  }

  const levelRow = requireCatalogRow(
    indexes,
    "levels",
    hero.level,
    `${path}.level`,
  );
  const maxHeroLevel = indexes.tables.levels.rows.at(-1)?.Level;
  if (hero.level !== maxHeroLevel && hero.xp >= levelRow.ExpForLevelUp) {
    invariant(
      `${path}.xp must be below ${levelRow.ExpForLevelUp} at level ${hero.level}`,
    );
  }

  const heroAttributes = indexes.tables.attributes.rows.filter(
    (row) => row.HeroKey === hero.heroKey,
  );
  let spentAttributePoints = 0;
  const allocatedAttributes: {
    readonly index: number;
    readonly groupKey: number;
    readonly spentPoints: number;
  }[] = [];
  for (const [index, progress] of hero.attributes.entries()) {
    const attribute = requireCatalogRow(
      indexes,
      "attributes",
      progress.key,
      `${path}.attributes[${index}].key`,
    );
    if (attribute.HeroKey !== hero.heroKey) {
      invariant(
        `${path}.attributes[${index}].key belongs to hero ${attribute.HeroKey}`,
      );
    }
    if (progress.level > attribute.MaxLevel) {
      invariant(
        `${path}.attributes[${index}].level exceeds attribute max ${attribute.MaxLevel}`,
      );
    }
    if (!Number.isSafeInteger(progress.level) || progress.level < 1) {
      invariant(
        `${path}.attributes[${index}].level must be a positive safe integer`,
      );
    }
    if (
      !Number.isSafeInteger(attribute.RequiredPoint) ||
      attribute.RequiredPoint < 1
    ) {
      invariant(
        `${path}.attributes[${index}].key has invalid RequiredPoint ${attribute.RequiredPoint}`,
      );
    }
    const spent = progress.level * attribute.RequiredPoint;
    if (
      !Number.isSafeInteger(spent) ||
      !Number.isSafeInteger(spentAttributePoints + spent)
    ) {
      invariant(`${path} Attribute spend is not a safe integer`);
    }
    spentAttributePoints += spent;
    allocatedAttributes.push({
      index,
      groupKey: attribute.GroupKey,
      spentPoints: spent,
    });
  }
  if (spentAttributePoints > hero.level) {
    invariant(
      `${path} Attribute spend ${spentAttributePoints} exceeds Hero level budget ${hero.level}`,
    );
  }
  for (const allocated of allocatedAttributes) {
    const group = requireCatalogRow(
      indexes,
      "attribute_groups",
      allocated.groupKey,
      `${path}.attributes[${allocated.index}].GroupKey`,
    );
    if (
      !Number.isSafeInteger(group.RequiredAllocatedPoint) ||
      group.RequiredAllocatedPoint < 0
    ) {
      invariant(
        `${path}.attributes[${allocated.index}] group ${allocated.groupKey} has invalid RequiredAllocatedPoint`,
      );
    }
    let lowerGroupSpend = 0;
    for (const candidate of allocatedAttributes) {
      const candidateGroup = requireCatalogRow(
        indexes,
        "attribute_groups",
        candidate.groupKey,
        `${path}.attributes[${candidate.index}].GroupKey`,
      );
      if (
        candidateGroup.RequiredAllocatedPoint < group.RequiredAllocatedPoint
      ) {
        lowerGroupSpend += candidate.spentPoints;
      }
    }
    if (lowerGroupSpend < group.RequiredAllocatedPoint) {
      invariant(
        `${path}.attributes[${allocated.index}] requires ${group.RequiredAllocatedPoint} points spent in lower Attribute groups`,
      );
    }
  }

  for (const [index, progress] of hero.skills.entries()) {
    const skill = requireCatalogRow(
      indexes,
      "skills",
      progress.key,
      `${path}.skills[${index}].key`,
    );
    const owningAttribute = heroAttributes.find(
      (attribute) =>
        attribute.ATTRIBUTETYPE === "ACTIVESKILL" &&
        attribute.Value === progress.key,
    );
    if (owningAttribute === undefined && heroRow.SkillKey !== progress.key) {
      invariant(
        `${path}.skills[${index}].key does not belong to hero ${hero.heroKey}`,
      );
    }
    const sourceMax =
      owningAttribute?.MaxLevel ??
      maxNestedLevel(
        skill.levels,
        `skills key ${formatKey(skill.SkillKey)}.levels`,
      );
    if (progress.level > sourceMax) {
      invariant(
        `${path}.skills[${index}].level exceeds skill max ${sourceMax}`,
      );
    }
  }

  for (const [index, progress] of hero.passives.entries()) {
    requireCatalogRow(
      indexes,
      "passive_skills",
      progress.key,
      `${path}.passives[${index}].key`,
    );
    const owningAttribute = heroAttributes.find(
      (attribute) =>
        attribute.ATTRIBUTETYPE === "PASSIVESKILL" &&
        attribute.Value === progress.key,
    );
    if (owningAttribute === undefined) {
      invariant(
        `${path}.passives[${index}].key does not belong to hero ${hero.heroKey}`,
      );
    }
    if (progress.level > owningAttribute.MaxLevel) {
      invariant(
        `${path}.passives[${index}].level exceeds passive max ${owningAttribute.MaxLevel}`,
      );
    }
  }

  for (const equipment of hero.equipment) {
    const item = requireCatalogRow(
      indexes,
      "items",
      equipment.asset.itemKey,
      `${path}.equipment.${equipment.slot}.asset.itemKey`,
    );
    if (item.deleted === true || item.type !== "GEAR" || item.gear === null) {
      invariant(
        `${path}.equipment.${equipment.slot} references non-equipment item ${item.id}`,
      );
    }
    if (equipment.slot !== item.gear) {
      invariant(
        `equipment slot ${equipment.slot} does not match item ${item.id} gear type ${item.gear}`,
      );
    }
    if (!isHeroGearTypeCompatible(indexes, hero.heroKey, item.gear)) {
      invariant(
        `item ${item.id} gear type ${item.gear} cannot be equipped by hero ${hero.heroKey}`,
      );
    }
    requireCatalogRow(
      indexes,
      "gear",
      equipment.asset.itemKey,
      `${path}.equipment.${equipment.slot}.asset.itemKey`,
    );
    validateRolledStats(
      equipment.asset,
      `${path}.equipment.${equipment.slot}.asset`,
      indexes,
    );
  }

  for (const [index, equippedSkin] of hero.skins.entries()) {
    const skin = requireCatalogRow(
      indexes,
      "skins",
      equippedSkin.skinKey,
      `${path}.skins[${index}].skinKey`,
    );
    if (skin.PartsCategory !== equippedSkin.partsCategory) {
      invariant(
        `${path}.skins[${index}].partsCategory ${equippedSkin.partsCategory} does not match skin ${skin.PcSkinKey} category ${skin.PartsCategory}`,
      );
    }
  }
}

function parseRuneEdges(
  value: string | number | null,
  runeKey: number,
): number[] {
  if (value === null) return [];
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) {
      return invariant(
        `rune ${runeKey}.NextRuneKey must be a positive safe integer`,
      );
    }
    return [value];
  }
  if (!/^[1-9]\d*( [1-9]\d*)*$/.test(value)) {
    return invariant(
      `rune ${runeKey}.NextRuneKey has invalid key list ${JSON.stringify(value)}`,
    );
  }
  return value.split(" ").map(Number);
}

function validateRunes(
  player: PlayerState,
  indexes: DiscordHeroCatalogIndexes,
): void {
  const owned = new Map(player.runes.map((rune) => [rune.key, rune.level]));
  const predecessors = new Map<number, number[]>();
  for (const row of indexes.tables.runes.rows) {
    for (const nextKey of parseRuneEdges(row.NextRuneKey, row.RuneKey)) {
      const existing = predecessors.get(nextKey) ?? [];
      existing.push(row.RuneKey);
      predecessors.set(nextKey, existing);
    }
  }

  for (const [index, progress] of player.runes.entries()) {
    const rune = requireCatalogRow(
      indexes,
      "runes",
      progress.key,
      `runes[${index}].key`,
    );
    if (progress.level < 1) {
      invariant(`runes[${index}].level must be at least 1`);
    }
    if (progress.level > rune.MaxLevel) {
      invariant(`runes[${index}].level exceeds rune max ${rune.MaxLevel}`);
    }
    resolveRuneLevelRows(indexes, rune);
    const predecessorKeys = predecessors.get(rune.RuneKey) ?? [];
    if (predecessorKeys.length > 0) {
      const requiredLevel = rune.PrevNodeRequiredLevel ?? 1;
      const eligible = predecessorKeys.some(
        (key) => (owned.get(key) ?? 0) >= requiredLevel,
      );
      if (!eligible) {
        invariant(
          `runes[${index}] requires a predecessor at level ${requiredLevel}`,
        );
      }
    } else if (rune.PrevNodeRequiredLevel !== null) {
      invariant(
        `rune ${rune.RuneKey} requires predecessor level ${rune.PrevNodeRequiredLevel} but has no incoming edge`,
      );
    }
  }
}

function stageRewardItems(
  indexes: DiscordHeroCatalogIndexes,
  stageKey: number,
  party: PlayerState["party"],
): ReadonlySet<number> {
  const stage = requireCatalogRow(
    indexes,
    "stages",
    stageKey,
    "stageSession.stageKey",
  );
  const rewards = new Set<number>();
  for (const direct of [
    stage.MonsterDropItemKey,
    stage.BossDropItemKey,
    stage.SoulstoneItemKey,
  ]) {
    if (direct !== null) rewards.add(direct);
  }

  if (stage.FirstClearDropKey !== null) {
    const ownedParty = new Set(
      party.filter((heroKey): heroKey is number => heroKey !== null),
    );
    const drops =
      indexes.tables.drops.groups.get(stage.FirstClearDropKey) ?? [];
    for (const drop of drops) {
      if (
        drop.HeroKeyCondition !== null &&
        !ownedParty.has(drop.HeroKeyCondition)
      ) {
        continue;
      }
      if (drop.REWARDTYPE === "ITEM") {
        rewards.add(drop.RewardKey);
      } else if (drop.REWARDTYPE === "ITEMGROUP") {
        const group =
          indexes.tables.item_groups.groups.get(drop.RewardKey) ?? [];
        for (const item of group) rewards.add(item.ItemKey);
      } else {
        invariant(
          `drops key ${drop.DropKey} has unsupported reward type ${drop.REWARDTYPE}`,
        );
      }
    }
  }
  return rewards;
}

function validateCampaign(
  player: PlayerState,
  indexes: DiscordHeroCatalogIndexes,
): void {
  const stageRank = new Map(
    indexes.tables.stages.rows.map((stage, index) => [stage.StageKey, index]),
  );
  let highestRank = -1;
  if (player.campaign.highestStageKey !== null) {
    requireCatalogRow(
      indexes,
      "stages",
      player.campaign.highestStageKey,
      "campaign.highestStageKey",
    );
    highestRank = stageRank.get(player.campaign.highestStageKey)!;
  }
  for (const [index, stage] of player.campaign.stages.entries()) {
    requireCatalogRow(
      indexes,
      "stages",
      stage.stageKey,
      `campaign.stages[${index}].stageKey`,
    );
    if (
      (stageRank.get(stage.stageKey) ?? Number.POSITIVE_INFINITY) > highestRank
    ) {
      invariant(
        `campaign stage ${stage.stageKey} is beyond highestStageKey ${String(player.campaign.highestStageKey)}`,
      );
    }
  }

  if (player.stageSession === null) return;
  const session = player.stageSession;
  requireCatalogRow(
    indexes,
    "stages",
    session.stageKey,
    "stageSession.stageKey",
  );
  if (session.advancedThroughMs < session.startedAtMs) {
    invariant("stageSession.advancedThroughMs cannot precede startedAtMs");
  }
  if (session.pendingRewards.gold !== 0) {
    invariant(
      "stageSession.pendingRewards.gold must be zero without source-derived provenance",
    );
  }
  if (session.pendingRewards.xp !== 0) {
    invariant(
      "stageSession.pendingRewards.xp must be zero without source-derived provenance",
    );
  }
  const rewardItems = stageRewardItems(
    indexes,
    session.stageKey,
    session.party,
  );
  for (const [index, asset] of session.pendingRewards.items.entries()) {
    if (!rewardItems.has(asset.itemKey)) {
      invariant(
        `stageSession.pendingRewards.items[${index}] item ${asset.itemKey} has no reward origin in stage ${session.stageKey}`,
      );
    }
    validateStoredAsset(
      asset,
      `stageSession.pendingRewards.items[${index}]`,
      indexes,
    );
  }
}

function requireSuperset(
  current: readonly number[],
  previous: readonly number[],
  path: string,
): void {
  const currentKeys = new Set(current);
  for (const key of previous) {
    if (!currentKeys.has(key)) {
      invariant(`${path} cannot lose unlocked key ${key}`);
    }
  }
}

function requireKeyedProgress(
  current: readonly { key: number; level: number }[],
  previous: readonly { key: number; level: number }[],
  heroKey: number,
  collection: "attributes" | "skills" | "passives",
  entryName: "attribute" | "skill" | "passive",
): void {
  const currentLevels = new Map(
    current.map((progress) => [progress.key, progress.level]),
  );
  for (const progress of previous) {
    const currentLevel = currentLevels.get(progress.key);
    if (currentLevel === undefined) {
      invariant(
        `hero ${heroKey} ${collection} cannot lose key ${progress.key}`,
      );
    }
    if (currentLevel < progress.level) {
      invariant(
        `hero ${heroKey} ${entryName} ${progress.key} level cannot regress`,
      );
    }
  }
}

function cumulativeCubeExperience(
  player: PlayerState,
  indexes: DiscordHeroCatalogIndexes,
): number {
  let cumulative = player.cube.xp;
  for (const level of indexes.tables.cube_levels.rows) {
    if (level.Level >= player.cube.level) continue;
    cumulative += level.ExpForLevelUp;
    if (!Number.isSafeInteger(cumulative)) {
      invariant("Cube cumulative XP exceeds the safe-integer range");
    }
  }
  return cumulative;
}

function validateTransition(
  current: PlayerState,
  previous: PlayerState,
  indexes: DiscordHeroCatalogIndexes,
): void {
  const stageRank = new Map(
    indexes.tables.stages.rows.map((stage, index) => [stage.StageKey, index]),
  );
  const previousHighest =
    previous.campaign.highestStageKey === null
      ? -1
      : stageRank.get(previous.campaign.highestStageKey)!;
  const currentHighest =
    current.campaign.highestStageKey === null
      ? -1
      : stageRank.get(current.campaign.highestStageKey)!;
  if (currentHighest < previousHighest) {
    invariant(
      `campaign.highestStageKey cannot regress from ${String(previous.campaign.highestStageKey)} to ${String(current.campaign.highestStageKey)}`,
    );
  }

  const currentStages = new Map(
    current.campaign.stages.map((stage) => [stage.stageKey, stage]),
  );
  for (const priorStage of previous.campaign.stages) {
    const stage = currentStages.get(priorStage.stageKey);
    if (stage === undefined) {
      invariant(`campaign stage ${priorStage.stageKey} cannot disappear`);
    }
    if (stage.clearCount < priorStage.clearCount) {
      invariant(
        `campaign stage ${priorStage.stageKey} clear count cannot decrease`,
      );
    }
    if (priorStage.firstClearClaimed && !stage.firstClearClaimed) {
      invariant(
        `campaign stage ${priorStage.stageKey} first-clear claim cannot regress`,
      );
    }
    if (
      priorStage.bestClearMs !== null &&
      (stage.bestClearMs === null || stage.bestClearMs > priorStage.bestClearMs)
    ) {
      invariant(
        `campaign stage ${priorStage.stageKey} best clear cannot regress`,
      );
    }
  }

  if (
    current.heroes.length !== previous.heroes.length ||
    current.heroes.some(
      (hero, index) => hero.heroKey !== previous.heroes[index]?.heroKey,
    )
  ) {
    invariant(
      "Hero ownership transition is unsupported without source-backed runtime semantics",
    );
  }
  if (!isDiscordHeroPartyTransition(indexes, previous, current)) {
    invariant(
      "Party formation transition is unsupported without source-backed runtime semantics",
    );
  }

  const previousHeroes = new Map(
    previous.heroes.map((hero) => [hero.heroKey, hero]),
  );
  const currentHeroes = new Map(
    current.heroes.map((hero) => [hero.heroKey, hero]),
  );
  for (const [heroKey, priorHero] of previousHeroes) {
    const hero = currentHeroes.get(heroKey);
    if (hero === undefined) invariant(`owned hero ${heroKey} cannot disappear`);
    if (
      hero.level < priorHero.level ||
      (hero.level === priorHero.level && hero.xp < priorHero.xp)
    ) {
      invariant(`hero ${heroKey} progression cannot regress`);
    }
    requireKeyedProgress(
      hero.attributes,
      priorHero.attributes,
      heroKey,
      "attributes",
      "attribute",
    );
    requireKeyedProgress(
      hero.skills,
      priorHero.skills,
      heroKey,
      "skills",
      "skill",
    );
    requireKeyedProgress(
      hero.passives,
      priorHero.passives,
      heroKey,
      "passives",
      "passive",
    );
    if (
      hero.skins.length !== priorHero.skins.length ||
      hero.skins.some(
        (skin, index) =>
          skin.partsCategory !== priorHero.skins[index]?.partsCategory ||
          skin.skinKey !== priorHero.skins[index]?.skinKey,
      )
    ) {
      invariant(
        "equipped Skin transition is unsupported without source-backed runtime semantics",
      );
    }
  }

  const previousCubeExperience = cumulativeCubeExperience(previous, indexes);
  const currentCubeExperience = cumulativeCubeExperience(current, indexes);
  if (currentCubeExperience < previousCubeExperience) {
    invariant(
      `Cube progression cannot regress from ${previousCubeExperience} to ${currentCubeExperience} cumulative XP`,
    );
  }

  const previousRunes = new Map(
    previous.runes.map((rune) => [rune.key, rune.level]),
  );
  const currentRunes = new Map(
    current.runes.map((rune) => [rune.key, rune.level]),
  );
  for (const [key, priorLevel] of previousRunes) {
    if ((currentRunes.get(key) ?? 0) < priorLevel) {
      invariant(`rune ${key} level cannot regress`);
    }
  }

  requireSuperset(
    current.cube.unlockedRecipes,
    previous.cube.unlockedRecipes,
    "cube.unlockedRecipes",
  );
  requireSuperset(
    current.cube.unlockedSubRecipes,
    previous.cube.unlockedSubRecipes,
    "cube.unlockedSubRecipes",
  );
  if (
    current.pets.unlocked.length !== previous.pets.unlocked.length ||
    current.pets.unlocked.some(
      (petKey, index) => petKey !== previous.pets.unlocked[index],
    )
  ) {
    invariant(
      "Pet ownership transition is unsupported without source-backed provenance",
    );
  }
  if (current.pets.active !== previous.pets.active) {
    invariant(
      "arranged Pet transition is unsupported without source-backed runtime semantics",
    );
  }
  if (
    current.skins.unlocked.length !== previous.skins.unlocked.length ||
    current.skins.unlocked.some(
      (skinKey, index) => skinKey !== previous.skins.unlocked[index],
    )
  ) {
    invariant(
      "Skin ownership transition is unsupported without source-backed purchase semantics",
    );
  }
  for (const containerName of Object.keys(
    CONTAINER_DATASETS,
  ) as ContainerName[]) {
    if (
      current.containers[containerName].unlockedSlots <
      previous.containers[containerName].unlockedSlots
    ) {
      invariant(`${containerName} unlocked capacity cannot regress`);
    }
  }
  if (current.offline.accrualCursorMs < previous.offline.accrualCursorMs) {
    invariant("offline.accrualCursorMs cannot decrease");
  }
  const offlineRewardRank = new Map(
    indexes.tables.offline_rewards.rows.map((row, index) => [
      row.StageLevel,
      index,
    ]),
  );
  if (
    offlineRewardRank.get(current.offline.rewardStageLevel)! <
    offlineRewardRank.get(previous.offline.rewardStageLevel)!
  ) {
    invariant(
      `offline.rewardStageLevel cannot regress from ${previous.offline.rewardStageLevel} to ${current.offline.rewardStageLevel}`,
    );
  }

  if (
    current.stageSession !== null &&
    previous.stageSession !== null &&
    current.stageSession.sessionId === previous.stageSession.sessionId
  ) {
    if (
      current.stageSession.stageKey !== previous.stageSession.stageKey ||
      current.stageSession.startedAtMs !== previous.stageSession.startedAtMs ||
      current.stageSession.rngSeed !== previous.stageSession.rngSeed
    ) {
      invariant(
        `stageSession identity cannot change within ${current.stageSession.sessionId}`,
      );
    }
    if (
      current.stageSession.advancedThroughMs <
      previous.stageSession.advancedThroughMs
    ) {
      invariant(
        `stageSession.advancedThroughMs cannot decrease within ${current.stageSession.sessionId}`,
      );
    }
    if (current.stageSession.wave < previous.stageSession.wave) {
      invariant(
        `stageSession.wave cannot decrease within ${current.stageSession.sessionId}`,
      );
    }
    if (current.stageSession.rngCursor < previous.stageSession.rngCursor) {
      invariant(
        `stageSession.rngCursor cannot decrease within ${current.stageSession.sessionId}`,
      );
    }
  }
}

function unlockedCapacity(
  indexes: DiscordHeroCatalogIndexes,
  name: (typeof CONTAINER_DATASETS)[ContainerName],
): number {
  const rows = indexes.tables[name].rows;
  const firstPaid = rows.findIndex((row) => row.CostForUnlock !== 0);
  const unlocked = firstPaid === -1 ? rows.length : firstPaid;
  if (rows.slice(unlocked).some((row) => row.CostForUnlock === 0)) {
    invariant(`${name} zero-cost rows must form one contiguous prefix`);
  }
  return unlocked;
}

export function createFreshPlayerStateFromCatalog(
  indexes: DiscordHeroCatalogIndexes,
  starterHeroKey: DiscordHeroStarterKey,
): PlayerState {
  if (indexes.tables.currencies.rows.length !== 1) {
    invariant("currencies must contain exactly one row for fresh state");
  }
  const currency = indexes.tables.currencies.rows[0]!;
  const starters = discordHeroStarterCandidates(indexes);
  if (!starters.some((hero) => hero.heroKey === starterHeroKey)) {
    invariant(`starter hero ${starterHeroKey} is not a selectable candidate`);
  }
  const starterProgress = starters.map((hero): HeroProgress => ({
    heroKey: hero.heroKey,
    level: indexes.tables.levels.rows[0]!.Level,
    xp: 0,
    attributes: [],
    skills: [],
    passives: [],
    equipment: [],
    skins: [],
  }));
  const unlockedRecipes = indexes.tables.cube_recipes.rows
    .filter((recipe) => recipe.IsDefaultUnlocked === true)
    .map((recipe) => recipe.CubeKey);
  const unlockedRecipeTypes = new Set(
    indexes.tables.cube_recipes.rows
      .filter((recipe) => unlockedRecipes.includes(recipe.CubeKey))
      .map((recipe) => recipe.RECIPETYPE),
  );
  const unlockedSubRecipes = indexes.tables.cube_sub_recipes.rows
    .filter(
      (recipe) =>
        recipe.DefaultUnlockWhenMainRecipeOpen === true &&
        unlockedRecipeTypes.has(recipe.RECIPETYPE),
    )
    .map((recipe) => recipe.CubeSubRecipeKey);

  const fresh = PlayerStateSchema.parse({
    version: 1,
    gold: currency.InitialAmount,
    party: [starterHeroKey, null, null],
    heroes: starterProgress,
    containers: {
      inventory: {
        unlockedSlots: unlockedCapacity(indexes, "inventory"),
        slots: [],
      },
      stash: {
        unlockedSlots: unlockedCapacity(indexes, "stash"),
        slots: [],
      },
      storage: {
        unlockedSlots: unlockedCapacity(indexes, "storage"),
        slots: [],
      },
      tradingStash: {
        unlockedSlots: unlockedCapacity(indexes, "trading_stash"),
        slots: [],
      },
    },
    cube: {
      level: indexes.tables.cube_levels.rows[0]!.Level,
      xp: 0,
      unlockedRecipes,
      unlockedSubRecipes,
    },
    runes: [],
    pets: { unlocked: [], active: null },
    skins: {
      unlocked: indexes.tables.skins.rows
        .filter((skin) => skin.IsDefaultUnlocked)
        .map((skin) => skin.PcSkinKey),
    },
    offline: {
      accrualCursorMs: 0,
      rewardStageLevel: indexes.tables.offline_rewards.rows[0]!.StageLevel,
    },
    campaign: { highestStageKey: null, stages: [] },
    stageSession: null,
  });
  return validatePlayerAgainstCatalog(fresh, indexes);
}

export function validatePlayerAgainstCatalog(
  value: unknown,
  indexes: DiscordHeroCatalogIndexes,
  previousValue?: unknown,
): PlayerState {
  const player = parseState(value, indexes, "player");

  for (const [index, hero] of player.heroes.entries()) {
    validateHero(hero, index, indexes);
  }
  for (const [containerName, datasetName] of Object.entries(
    CONTAINER_DATASETS,
  ) as [ContainerName, (typeof CONTAINER_DATASETS)[ContainerName]][]) {
    const container = player.containers[containerName];
    const rowCount = indexes.tables[datasetName].rows.length;
    if (container.unlockedSlots > rowCount) {
      invariant(
        `${containerName} unlocked capacity exceeds catalog row count ${rowCount}`,
      );
    }
    for (const [slotIndex, slot] of container.slots.entries()) {
      validateStoredAsset(
        slot.asset,
        `containers.${containerName}.slots[${slotIndex}].asset`,
        indexes,
      );
    }
  }

  const cubeLevel = requireCatalogRow(
    indexes,
    "cube_levels",
    player.cube.level,
    "cube.level",
  );
  const maxCubeLevel = indexes.tables.cube_levels.rows.at(-1)?.Level;
  if (
    player.cube.level !== maxCubeLevel &&
    player.cube.xp >= cubeLevel.ExpForLevelUp
  ) {
    invariant(
      `cube.xp must be below ${cubeLevel.ExpForLevelUp} at level ${player.cube.level}`,
    );
  }
  const unlockedRecipeKeys = new Set<number>();
  const unlockedRecipeTypes = new Set<string>();
  for (const [index, recipeKey] of player.cube.unlockedRecipes.entries()) {
    const recipe = requireCatalogRow(
      indexes,
      "cube_recipes",
      recipeKey,
      `cube.unlockedRecipes[${index}]`,
    );
    unlockedRecipeKeys.add(recipe.CubeKey);
    unlockedRecipeTypes.add(recipe.RECIPETYPE);
  }
  for (const recipe of indexes.tables.cube_recipes.rows) {
    if (!recipe.IsDefaultUnlocked) {
      continue;
    }
    if (!unlockedRecipeKeys.has(recipe.CubeKey)) {
      invariant(`Cube default recipe ${recipe.CubeKey} must be unlocked`);
    }
  }
  const unlockedSubRecipeKeys = new Set<number>();
  for (const [
    index,
    subRecipeKey,
  ] of player.cube.unlockedSubRecipes.entries()) {
    const subRecipe = requireCatalogRow(
      indexes,
      "cube_sub_recipes",
      subRecipeKey,
      `cube.unlockedSubRecipes[${index}]`,
    );
    unlockedSubRecipeKeys.add(subRecipe.CubeSubRecipeKey);
    if (!unlockedRecipeTypes.has(subRecipe.RECIPETYPE)) {
      invariant(
        `Cube sub-recipe ${subRecipeKey} requires main recipe type ${subRecipe.RECIPETYPE}`,
      );
    }
    if (player.cube.level < subRecipe.UnlockCubeLevel) {
      invariant(
        `Cube sub-recipe ${subRecipeKey} requires Cube level ${subRecipe.UnlockCubeLevel}`,
      );
    }
  }
  for (const subRecipe of indexes.tables.cube_sub_recipes.rows) {
    if (
      subRecipe.DefaultUnlockWhenMainRecipeOpen &&
      unlockedRecipeTypes.has(subRecipe.RECIPETYPE) &&
      !unlockedSubRecipeKeys.has(subRecipe.CubeSubRecipeKey)
    ) {
      invariant(
        `Cube default sub-recipe ${subRecipe.CubeSubRecipeKey} must be unlocked`,
      );
    }
  }

  validateRunes(player, indexes);
  const formationCapacity = deriveDiscordHeroFormationCapacity(
    indexes,
    player.runes,
  );
  if (player.party[0] === null) {
    invariant("party slot 1 must be occupied");
  }
  let foundEmptySlot = false;
  for (const [index, heroKey] of player.party.entries()) {
    if (index < formationCapacity) {
      if (heroKey === null) {
        foundEmptySlot = true;
      } else if (foundEmptySlot) {
        invariant("party occupied slots must form a prefix");
      }
    } else if (heroKey !== null) {
      invariant(
        `party slot ${index + 1} exceeds formation capacity ${formationCapacity}`,
      );
    }
  }
  for (const [index, petKey] of player.pets.unlocked.entries()) {
    requireCatalogRow(indexes, "pets", petKey, `pets.unlocked[${index}]`);
  }
  for (const [index, skinKey] of player.skins.unlocked.entries()) {
    requireCatalogRow(indexes, "skins", skinKey, `skins.unlocked[${index}]`);
  }
  requireCatalogRow(
    indexes,
    "offline_rewards",
    player.offline.rewardStageLevel,
    "offline.rewardStageLevel",
  );
  validateCampaign(player, indexes);

  if (previousValue !== undefined) {
    const previous = validatePlayerAgainstCatalog(previousValue, indexes);
    validateTransition(player, previous, indexes);
  }
  return player;
}
