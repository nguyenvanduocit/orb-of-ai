import { Buffer } from "node:buffer";
import { beforeAll, describe, expect, test } from "bun:test";
import {
  getDiscordHeroDataset,
  isLoadedDiscordHeroCatalogAuthority,
  loadDiscordHeroCatalog,
  type LoadedDiscordHeroCatalog,
} from "./loader";
import {
  buildCatalogIndexes,
  getCatalogGroup,
  getCatalogRow,
  getLocalizedCatalogName,
  isDiscordHeroCatalogIndexAuthority,
  parseCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "./indexes";

const EXPECTED_DATASETS = [
  "attribute_groups",
  "attributes",
  "buff_groups",
  "buffs",
  "crafting_recipes",
  "cube_levels",
  "cube_recipes",
  "cube_sub_recipes",
  "currencies",
  "drops",
  "extraction_costs",
  "gear",
  "gear_type_scales",
  "gear_types",
  "grades",
  "heroes",
  "inventory",
  "item_groups",
  "item_level_scales",
  "item_type_scales",
  "items",
  "levels",
  "materials",
  "monsters",
  "offline_rewards",
  "passive_skills",
  "pet_stats",
  "pets",
  "rune_levels",
  "runes",
  "skill_levels",
  "skills",
  "skins",
  "sounds",
  "stage_levels",
  "stages",
  "stash",
  "stat_mod_groups",
  "stat_mods",
  "status_effects",
  "storage",
  "synthesis_drops",
  "synthesis_recipes",
  "trading_stash",
  "unique_mods",
] as const satisfies readonly DiscordHeroDatasetName[];

type MutableCatalog = {
  datasets: Array<{
    name: string;
    rows: Array<Record<string, unknown>>;
  }>;
};

interface RelationshipMutation {
  readonly id: string;
  readonly mutate: (catalog: MutableCatalog) => void;
  readonly expectedError: string;
}

interface ExpectedRelationshipLimitationMutation {
  readonly id: string;
  readonly mutate: (catalog: MutableCatalog) => void;
  readonly expectedSignature: string;
}

function mutateRow(
  catalog: MutableCatalog,
  datasetName: string,
  predicate: (row: Record<string, unknown>) => boolean,
  field: string,
  value: unknown,
): void {
  const dataset = catalog.datasets.find(
    (candidate) => candidate.name === datasetName,
  );
  const row = dataset?.rows.find(predicate);
  if (row === undefined) {
    throw new Error(
      `relationship mutation fixture has no ${datasetName}.${field} row`,
    );
  }
  row[field] = value;
}

const UNKNOWN_KEY = 999_999_999;

const RELATIONSHIP_MUTATIONS = [
  {
    id: "attributes.HeroKey->heroes",
    mutate: (value) =>
      mutateRow(value, "attributes", () => true, "HeroKey", UNKNOWN_KEY),
    expectedError: "attributes.HeroKey references unknown heroes key 999999999",
  },
  {
    id: "attributes.GroupKey->attribute_groups",
    mutate: (value) =>
      mutateRow(value, "attributes", () => true, "GroupKey", UNKNOWN_KEY),
    expectedError:
      "attributes.GroupKey references unknown attribute_groups key 999999999",
  },
  {
    id: "attributes.Value[ACTIVESKILL]->skills",
    mutate: (value) =>
      mutateRow(
        value,
        "attributes",
        (row) => row.ATTRIBUTETYPE === "ACTIVESKILL",
        "Value",
        UNKNOWN_KEY,
      ),
    expectedError: "attributes.Value references unknown skills key 999999999",
  },
  {
    id: "attributes.Value[PASSIVESKILL]->passive_skills",
    mutate: (value) =>
      mutateRow(
        value,
        "attributes",
        (row) => row.ATTRIBUTETYPE === "PASSIVESKILL",
        "Value",
        UNKNOWN_KEY,
      ),
    expectedError:
      "attributes.Value references unknown passive_skills key 999999999",
  },
  {
    id: "buff_groups.BuffKeys->buffs",
    mutate: (value) =>
      mutateRow(
        value,
        "buff_groups",
        (row) => row.BuffGroupKey === 10501,
        "BuffKeys",
        UNKNOWN_KEY,
      ),
    expectedError:
      "buff_groups.BuffKeys references unknown buffs key 999999999",
  },
  {
    id: "crafting_recipes.Material->items",
    mutate: (value) =>
      mutateRow(
        value,
        "crafting_recipes",
        () => true,
        "Material",
        `${UNKNOWN_KEY}_1`,
      ),
    expectedError:
      "crafting_recipes.Material references unknown items key 999999999",
  },
  {
    id: "crafting_recipes.DropKey->drops",
    mutate: (value) =>
      mutateRow(value, "crafting_recipes", () => true, "DropKey", UNKNOWN_KEY),
    expectedError:
      "crafting_recipes.DropKey references unknown drops key 999999999",
  },
  {
    id: "cube_sub_recipes.UnlockCubeLevel->cube_levels",
    mutate: (value) =>
      mutateRow(
        value,
        "cube_sub_recipes",
        () => true,
        "UnlockCubeLevel",
        UNKNOWN_KEY,
      ),
    expectedError:
      "cube_sub_recipes.UnlockCubeLevel references unknown cube_levels key 999999999",
  },
  {
    id: "cube_sub_recipes.RECIPETYPE->cube_recipes.RECIPETYPE",
    mutate: (value) =>
      mutateRow(value, "cube_sub_recipes", () => true, "RECIPETYPE", "UNKNOWN"),
    expectedError:
      'cube_sub_recipes.RECIPETYPE references unknown cube_recipes.RECIPETYPE value "UNKNOWN"',
  },
  {
    id: "cube_sub_recipes.Material->items",
    mutate: (value) =>
      mutateRow(
        value,
        "cube_sub_recipes",
        (row) => row.Material !== null,
        "Material",
        `${UNKNOWN_KEY}_1`,
      ),
    expectedError:
      "cube_sub_recipes.Material references unknown items key 999999999",
  },
  {
    id: "cube_sub_recipes.DropKey->drops",
    mutate: (value) =>
      mutateRow(
        value,
        "cube_sub_recipes",
        (row) => row.DropKey !== null,
        "DropKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "cube_sub_recipes.DropKey references unknown drops key 999999999",
  },
  {
    id: "drops.RewardKey[ITEM]->items",
    mutate: (value) =>
      mutateRow(
        value,
        "drops",
        (row) => row.REWARDTYPE === "ITEM",
        "RewardKey",
        UNKNOWN_KEY,
      ),
    expectedError: "drops.RewardKey references unknown items key 999999999",
  },
  {
    id: "drops.RewardKey[ITEMGROUP]->item_groups",
    mutate: (value) =>
      mutateRow(
        value,
        "drops",
        (row) => row.REWARDTYPE === "ITEMGROUP",
        "RewardKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "drops.RewardKey references unknown item_groups key 999999999",
  },
  {
    id: "drops.HeroKeyCondition->heroes",
    mutate: (value) =>
      mutateRow(
        value,
        "drops",
        (row) => row.HeroKeyCondition !== null && row.HeroKeyCondition !== 0,
        "HeroKeyCondition",
        UNKNOWN_KEY,
      ),
    expectedError:
      "drops.HeroKeyCondition references unknown heroes key 999999999",
  },
  {
    id: "gear.UniqueModKey->unique_mods",
    mutate: (value) =>
      mutateRow(
        value,
        "gear",
        (row) => typeof row.UniqueModKey === "number" && row.UniqueModKey > 0,
        "UniqueModKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "gear.UniqueModKey references unknown unique_mods key 999999999",
  },
  {
    id: "heroes.MainWeaponGearType->gear_types",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "MainWeaponGearType", "UNKNOWN"),
    expectedError:
      'heroes.MainWeaponGearType references unknown gear_types key "UNKNOWN"',
  },
  {
    id: "heroes.SubWeaponGearType->gear_types",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "SubWeaponGearType", "UNKNOWN"),
    expectedError:
      'heroes.SubWeaponGearType references unknown gear_types key "UNKNOWN"',
  },
  {
    id: "heroes.SkillKey->skills",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "SkillKey", UNKNOWN_KEY),
    expectedError: "heroes.SkillKey references unknown skills key 999999999",
  },
  {
    id: "heroes.SelectSoundKey->sounds",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "SelectSoundKey", UNKNOWN_KEY),
    expectedError:
      "heroes.SelectSoundKey references unknown sounds key 999999999",
  },
  {
    id: "heroes.DeadSoundKey->sounds",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "DeadSoundKey", UNKNOWN_KEY),
    expectedError:
      "heroes.DeadSoundKey references unknown sounds key 999999999",
  },
  {
    id: "heroes.attribute_keys->attributes",
    mutate: (value) =>
      mutateRow(value, "heroes", () => true, "attribute_keys", [UNKNOWN_KEY]),
    expectedError:
      "heroes.attribute_keys references unknown attributes key 999999999",
  },
  {
    id: "item_groups.ItemKey->items",
    mutate: (value) =>
      mutateRow(value, "item_groups", () => true, "ItemKey", UNKNOWN_KEY),
    expectedError: "item_groups.ItemKey references unknown items key 999999999",
  },
  {
    id: "items.grade->grades",
    mutate: (value) =>
      mutateRow(value, "items", () => true, "grade", "UNKNOWN"),
    expectedError: 'items.grade references unknown grades key "UNKNOWN"',
  },
  {
    id: "items.gear->gear_type_scales",
    mutate: (value) =>
      mutateRow(value, "items", (row) => row.gear !== null, "gear", "UNKNOWN"),
    expectedError:
      'items.gear references unknown gear_type_scales key "UNKNOWN"',
  },
  {
    id: "items.level->item_level_scales",
    mutate: (value) =>
      mutateRow(
        value,
        "items",
        (row) => row.level !== null && row.level !== 100,
        "level",
        UNKNOWN_KEY,
      ),
    expectedError:
      "items.level references unknown item_level_scales key 999999999",
  },
  {
    id: "items.type[GEAR|MATERIAL]->item_type_scales",
    mutate: (value) =>
      mutateRow(
        value,
        "item_type_scales",
        (row) => row.ItemType === "GEAR",
        "ItemType",
        "UNKNOWN",
      ),
    expectedError: 'items.type references unknown item_type_scales key "GEAR"',
  },
  {
    id: "items.id[GEAR]->gear",
    mutate: (value) =>
      mutateRow(value, "gear", () => true, "GearKey", UNKNOWN_KEY),
    expectedError: "items.id references unknown gear key 300001",
  },
  {
    id: "items.id[MATERIAL]->materials",
    mutate: (value) =>
      mutateRow(value, "materials", () => true, "ItemKey", UNKNOWN_KEY),
    expectedError: "items.id references unknown materials key 110001",
  },
  {
    id: "materials.StatModGroupKey->stat_mod_groups",
    mutate: (value) =>
      mutateRow(
        value,
        "materials",
        (row) => row.StatModGroupKey !== null,
        "StatModGroupKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "materials.StatModGroupKey references unknown stat_mod_groups key 999999999",
  },
  {
    id: "monsters.SkillKey->skills",
    mutate: (value) =>
      mutateRow(value, "monsters", () => true, "SkillKey", UNKNOWN_KEY),
    expectedError: "monsters.SkillKey references unknown skills key 999999999",
  },
  {
    id: "monsters.DeadSoundKey->sounds",
    mutate: (value) =>
      mutateRow(value, "monsters", () => true, "DeadSoundKey", UNKNOWN_KEY),
    expectedError:
      "monsters.DeadSoundKey references unknown sounds key 999999999",
  },
  {
    id: "monsters.stages[].key->stages",
    mutate: (value) => {
      const monsters = value.datasets.find(
        (dataset) => dataset.name === "monsters",
      )!;
      const stages = monsters.rows[0]!.stages as Array<Record<string, unknown>>;
      stages[0]!.key = UNKNOWN_KEY;
    },
    expectedError:
      "monsters.stages[].key references unknown stages key 999999999",
  },
  {
    id: "offline_rewards.StageLevel->stage_levels",
    mutate: (value) =>
      mutateRow(
        value,
        "offline_rewards",
        () => true,
        "StageLevel",
        UNKNOWN_KEY,
      ),
    expectedError:
      "offline_rewards.StageLevel references unknown stage_levels key 999999999",
  },
  {
    id: "pets.StatDataKey->pet_stats",
    mutate: (value) =>
      mutateRow(value, "pets", () => true, "StatDataKey", UNKNOWN_KEY),
    expectedError:
      "pets.StatDataKey references unknown pet_stats key 999999999",
  },
  {
    id: "pets.Param1[KillMonster]->monsters",
    mutate: (value) =>
      mutateRow(
        value,
        "pets",
        (row) => row.UnlockCondition === "KillMonster",
        "Param1",
        UNKNOWN_KEY,
      ),
    expectedError: "pets.Param1 references unknown monsters key 999999999",
  },
  {
    id: "rune_levels.CostItemKey->currencies",
    mutate: (value) =>
      mutateRow(value, "rune_levels", () => true, "CostItemKey", UNKNOWN_KEY),
    expectedError:
      "rune_levels.CostItemKey references unknown currencies key 999999999",
  },
  {
    id: "runes.NextRuneKey->runes",
    mutate: (value) =>
      mutateRow(
        value,
        "runes",
        (row) => row.NextRuneKey !== null,
        "NextRuneKey",
        UNKNOWN_KEY,
      ),
    expectedError: "runes.NextRuneKey references unknown runes key 999999999",
  },
  {
    id: "runes.PreviewRuneKey->runes",
    mutate: (value) =>
      mutateRow(
        value,
        "runes",
        (row) => row.PreviewRuneKey !== null,
        "PreviewRuneKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "runes.PreviewRuneKey references unknown runes key 999999999",
  },
  {
    id: "runes.LevelDataKey->rune_levels",
    mutate: (value) =>
      mutateRow(value, "runes", () => true, "LevelDataKey", UNKNOWN_KEY),
    expectedError:
      "runes.LevelDataKey references unknown rune_levels key 999999999",
  },
  {
    id: "skills.BuffGroupKey->buff_groups",
    mutate: (value) =>
      mutateRow(
        value,
        "skills",
        (row) => row.BuffGroupKey !== null,
        "BuffGroupKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "skills.BuffGroupKey references unknown buff_groups key 999999999",
  },
  {
    id: "skills.SkillLevelKey->skill_levels",
    mutate: (value) =>
      mutateRow(
        value,
        "skills",
        (row) => row.SkillLevelKey !== null,
        "SkillLevelKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "skills.SkillLevelKey references unknown skill_levels key 999999999",
  },
  {
    id: "skills.AttributeKey->attributes",
    mutate: (value) =>
      mutateRow(
        value,
        "skills",
        (row) => row.AttributeKey !== null,
        "AttributeKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "skills.AttributeKey references unknown attributes key 999999999",
  },
  {
    id: "skills.SoundKey->sounds",
    mutate: (value) =>
      mutateRow(
        value,
        "skills",
        (row) => row.SoundKey !== null,
        "SoundKey",
        UNKNOWN_KEY,
      ),
    expectedError: "skills.SoundKey references unknown sounds key 999999999",
  },
  {
    id: "skins.GroupKeys->skins",
    mutate: (value) =>
      mutateRow(
        value,
        "skins",
        (row) => row.GroupKeys !== null,
        "GroupKeys",
        UNKNOWN_KEY,
      ),
    expectedError: "skins.GroupKeys references unknown skins key 999999999",
  },
  {
    id: "stages.StageLevel->stage_levels",
    mutate: (value) =>
      mutateRow(value, "stages", () => true, "StageLevel", UNKNOWN_KEY),
    expectedError:
      "stages.StageLevel references unknown stage_levels key 999999999",
  },
  {
    id: "stages.NextStageKey->stages",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.NextStageKey !== null,
        "NextStageKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "stages.NextStageKey references unknown stages key 999999999",
  },
  {
    id: "stages.Monsters->monsters",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.Monsters !== null,
        "Monsters",
        `${UNKNOWN_KEY}_1`,
      ),
    expectedError: "stages.Monsters references unknown monsters key 999999999",
  },
  {
    id: "stages.MonsterDropItemKey->items",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.MonsterDropItemKey !== null,
        "MonsterDropItemKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "stages.MonsterDropItemKey references unknown items key 999999999",
  },
  {
    id: "stages.BossDropItemKey->items",
    mutate: (value) =>
      mutateRow(value, "stages", () => true, "BossDropItemKey", UNKNOWN_KEY),
    expectedError:
      "stages.BossDropItemKey references unknown items key 999999999",
  },
  {
    id: "stages.FirstClearDropKey->drops",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.FirstClearDropKey !== null,
        "FirstClearDropKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "stages.FirstClearDropKey references unknown drops key 999999999",
  },
  {
    id: "stages.BossMonsterKey->monsters",
    mutate: (value) =>
      mutateRow(value, "stages", () => true, "BossMonsterKey", UNKNOWN_KEY),
    expectedError:
      "stages.BossMonsterKey references unknown monsters key 999999999",
  },
  {
    id: "stages.SoulstoneItemKey->items",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.SoulstoneItemKey !== null,
        "SoulstoneItemKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "stages.SoulstoneItemKey references unknown items key 999999999",
  },
  {
    id: "stages.BGMSoundKey->sounds",
    mutate: (value) =>
      mutateRow(value, "stages", () => true, "BGMSoundKey", UNKNOWN_KEY),
    expectedError: "stages.BGMSoundKey references unknown sounds key 999999999",
  },
  {
    id: "stat_mod_groups.StatModKey->stat_mods",
    mutate: (value) =>
      mutateRow(
        value,
        "stat_mod_groups",
        () => true,
        "StatModKey",
        UNKNOWN_KEY,
      ),
    expectedError:
      "stat_mod_groups.StatModKey references unknown stat_mods key 999999999",
  },
  {
    id: "status_effects.BuffKeys->buffs",
    mutate: (value) =>
      mutateRow(
        value,
        "status_effects",
        (row) => row.BuffKeys !== null,
        "BuffKeys",
        UNKNOWN_KEY,
      ),
    expectedError:
      "status_effects.BuffKeys references unknown buffs key 999999999",
  },
  {
    id: "synthesis_drops.GRADE->grades",
    mutate: (value) =>
      mutateRow(value, "synthesis_drops", () => true, "GRADE", "UNKNOWN"),
    expectedError:
      'synthesis_drops.GRADE references unknown grades key "UNKNOWN"',
  },
  {
    id: "synthesis_drops.DropKey->drops",
    mutate: (value) =>
      mutateRow(value, "synthesis_drops", () => true, "DropKey", UNKNOWN_KEY),
    expectedError:
      "synthesis_drops.DropKey references unknown drops key 999999999",
  },
  {
    id: "synthesis_recipes.GRADE->grades",
    mutate: (value) =>
      mutateRow(value, "synthesis_recipes", () => true, "GRADE", "UNKNOWN"),
    expectedError:
      'synthesis_recipes.GRADE references unknown grades key "UNKNOWN"',
  },
  {
    id: "unique_mods.Param1[Skill*]->skills",
    mutate: (value) =>
      mutateRow(
        value,
        "unique_mods",
        (row) =>
          typeof row.UniqueMod === "string" &&
          row.UniqueMod.startsWith("Skill"),
        "Param1",
        UNKNOWN_KEY,
      ),
    expectedError: "unique_mods.Param1 references unknown skills key 999999999",
  },
] as const satisfies readonly RelationshipMutation[];

const EXPECTED_RELATIONSHIP_REFERENCE_COUNTS = [
  132, 132, 36, 96, 24, 78, 56, 31, 31, 10, 10, 156, 6147, 1958, 127, 6, 6, 6,
  6, 6, 132, 2275, 5944, 5760, 5760, 5885, 5760, 125, 79, 91, 61, 614, 116, 8,
  5, 663, 195, 11, 197, 12, 36, 36, 104, 38, 120, 119, 502, 108, 120, 13, 120,
  12, 120, 474, 6, 203, 203, 533, 19,
] as const;

const EXPECTED_RELATIONSHIP_UNRESOLVED_COUNTS = [
  0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0,
  0, 0, 0, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
] as const;

const EXPECTED_RELATIONSHIP_RULE_METADATA = [
  [
    "attributes.HeroKey->heroes",
    "direct",
    "attributes",
    "HeroKey",
    "heroes",
    "HeroKey",
  ],
  [
    "attributes.GroupKey->attribute_groups",
    "direct",
    "attributes",
    "GroupKey",
    "attribute_groups",
    "AttributeGroupKey",
  ],
  [
    "attributes.Value[ACTIVESKILL]->skills",
    "direct",
    "attributes",
    "Value",
    "skills",
    "SkillKey",
  ],
  [
    "attributes.Value[PASSIVESKILL]->passive_skills",
    "direct",
    "attributes",
    "Value",
    "passive_skills",
    "PassiveSkillKey",
  ],
  [
    "buff_groups.BuffKeys->buffs",
    "multi-key",
    "buff_groups",
    "BuffKeys",
    "buffs",
    "BuffKey",
  ],
  [
    "crafting_recipes.Material->items",
    "multi-key",
    "crafting_recipes",
    "Material",
    "items",
    "id",
  ],
  [
    "crafting_recipes.DropKey->drops",
    "grouped",
    "crafting_recipes",
    "DropKey",
    "drops",
    "DropKey",
  ],
  [
    "cube_sub_recipes.UnlockCubeLevel->cube_levels",
    "direct",
    "cube_sub_recipes",
    "UnlockCubeLevel",
    "cube_levels",
    "Level",
  ],
  [
    "cube_sub_recipes.RECIPETYPE->cube_recipes.RECIPETYPE",
    "direct",
    "cube_sub_recipes",
    "RECIPETYPE",
    "cube_recipes",
    "RECIPETYPE",
  ],
  [
    "cube_sub_recipes.Material->items",
    "multi-key",
    "cube_sub_recipes",
    "Material",
    "items",
    "id",
  ],
  [
    "cube_sub_recipes.DropKey->drops",
    "grouped",
    "cube_sub_recipes",
    "DropKey",
    "drops",
    "DropKey",
  ],
  [
    "drops.RewardKey[ITEM]->items",
    "direct",
    "drops",
    "RewardKey",
    "items",
    "id",
  ],
  [
    "drops.RewardKey[ITEMGROUP]->item_groups",
    "grouped",
    "drops",
    "RewardKey",
    "item_groups",
    "ItemGroupKey",
  ],
  [
    "drops.HeroKeyCondition->heroes",
    "direct",
    "drops",
    "HeroKeyCondition",
    "heroes",
    "HeroKey",
  ],
  [
    "gear.UniqueModKey->unique_mods",
    "direct",
    "gear",
    "UniqueModKey",
    "unique_mods",
    "UniqueModKey",
  ],
  [
    "heroes.MainWeaponGearType->gear_types",
    "direct",
    "heroes",
    "MainWeaponGearType",
    "gear_types",
    "GearType",
  ],
  [
    "heroes.SubWeaponGearType->gear_types",
    "direct",
    "heroes",
    "SubWeaponGearType",
    "gear_types",
    "GearType",
  ],
  [
    "heroes.SkillKey->skills",
    "direct",
    "heroes",
    "SkillKey",
    "skills",
    "SkillKey",
  ],
  [
    "heroes.SelectSoundKey->sounds",
    "direct",
    "heroes",
    "SelectSoundKey",
    "sounds",
    "SoundKey",
  ],
  [
    "heroes.DeadSoundKey->sounds",
    "direct",
    "heroes",
    "DeadSoundKey",
    "sounds",
    "SoundKey",
  ],
  [
    "heroes.attribute_keys->attributes",
    "multi-key",
    "heroes",
    "attribute_keys",
    "attributes",
    "AttributeKey",
  ],
  [
    "item_groups.ItemKey->items",
    "direct",
    "item_groups",
    "ItemKey",
    "items",
    "id",
  ],
  ["items.grade->grades", "direct", "items", "grade", "grades", "GRADE"],
  [
    "items.gear->gear_type_scales",
    "direct",
    "items",
    "gear",
    "gear_type_scales",
    "GearType",
  ],
  [
    "items.level->item_level_scales",
    "direct",
    "items",
    "level",
    "item_level_scales",
    "Level",
  ],
  [
    "items.type[GEAR|MATERIAL]->item_type_scales",
    "direct",
    "items",
    "type",
    "item_type_scales",
    "ItemType",
  ],
  ["items.id[GEAR]->gear", "direct", "items", "id", "gear", "GearKey"],
  [
    "items.id[MATERIAL]->materials",
    "direct",
    "items",
    "id",
    "materials",
    "ItemKey",
  ],
  [
    "materials.StatModGroupKey->stat_mod_groups",
    "grouped",
    "materials",
    "StatModGroupKey",
    "stat_mod_groups",
    "StatModGroupKey",
  ],
  [
    "monsters.SkillKey->skills",
    "multi-key",
    "monsters",
    "SkillKey",
    "skills",
    "SkillKey",
  ],
  [
    "monsters.DeadSoundKey->sounds",
    "direct",
    "monsters",
    "DeadSoundKey",
    "sounds",
    "SoundKey",
  ],
  [
    "monsters.stages[].key->stages",
    "multi-key",
    "monsters",
    "stages[].key",
    "stages",
    "StageKey",
  ],
  [
    "offline_rewards.StageLevel->stage_levels",
    "direct",
    "offline_rewards",
    "StageLevel",
    "stage_levels",
    "StageLevel",
  ],
  [
    "pets.StatDataKey->pet_stats",
    "grouped",
    "pets",
    "StatDataKey",
    "pet_stats",
    "PetStatKey",
  ],
  [
    "pets.Param1[KillMonster]->monsters",
    "direct",
    "pets",
    "Param1",
    "monsters",
    "MonsterKey",
  ],
  [
    "rune_levels.CostItemKey->currencies",
    "direct",
    "rune_levels",
    "CostItemKey",
    "currencies",
    "CurrencyKey",
  ],
  [
    "runes.NextRuneKey->runes",
    "multi-key",
    "runes",
    "NextRuneKey",
    "runes",
    "RuneKey",
  ],
  [
    "runes.PreviewRuneKey->runes",
    "multi-key",
    "runes",
    "PreviewRuneKey",
    "runes",
    "RuneKey",
  ],
  [
    "runes.LevelDataKey->rune_levels",
    "grouped",
    "runes",
    "LevelDataKey",
    "rune_levels",
    "LevelKey",
  ],
  [
    "skills.BuffGroupKey->buff_groups",
    "grouped",
    "skills",
    "BuffGroupKey",
    "buff_groups",
    "BuffGroupKey",
  ],
  [
    "skills.SkillLevelKey->skill_levels",
    "grouped",
    "skills",
    "SkillLevelKey",
    "skill_levels",
    "SkillLevelKey",
  ],
  [
    "skills.AttributeKey->attributes",
    "direct",
    "skills",
    "AttributeKey",
    "attributes",
    "AttributeKey",
  ],
  [
    "skills.SoundKey->sounds",
    "direct",
    "skills",
    "SoundKey",
    "sounds",
    "SoundKey",
  ],
  [
    "skins.GroupKeys->skins",
    "multi-key",
    "skins",
    "GroupKeys",
    "skins",
    "PcSkinKey",
  ],
  [
    "stages.StageLevel->stage_levels",
    "direct",
    "stages",
    "StageLevel",
    "stage_levels",
    "StageLevel",
  ],
  [
    "stages.NextStageKey->stages",
    "direct",
    "stages",
    "NextStageKey",
    "stages",
    "StageKey",
  ],
  [
    "stages.Monsters->monsters",
    "multi-key",
    "stages",
    "Monsters",
    "monsters",
    "MonsterKey",
  ],
  [
    "stages.MonsterDropItemKey->items",
    "direct",
    "stages",
    "MonsterDropItemKey",
    "items",
    "id",
  ],
  [
    "stages.BossDropItemKey->items",
    "direct",
    "stages",
    "BossDropItemKey",
    "items",
    "id",
  ],
  [
    "stages.FirstClearDropKey->drops",
    "grouped",
    "stages",
    "FirstClearDropKey",
    "drops",
    "DropKey",
  ],
  [
    "stages.BossMonsterKey->monsters",
    "direct",
    "stages",
    "BossMonsterKey",
    "monsters",
    "MonsterKey",
  ],
  [
    "stages.SoulstoneItemKey->items",
    "direct",
    "stages",
    "SoulstoneItemKey",
    "items",
    "id",
  ],
  [
    "stages.BGMSoundKey->sounds",
    "direct",
    "stages",
    "BGMSoundKey",
    "sounds",
    "SoundKey",
  ],
  [
    "stat_mod_groups.StatModKey->stat_mods",
    "grouped",
    "stat_mod_groups",
    "StatModKey",
    "stat_mods",
    "StatModKey",
  ],
  [
    "status_effects.BuffKeys->buffs",
    "multi-key",
    "status_effects",
    "BuffKeys",
    "buffs",
    "BuffKey",
  ],
  [
    "synthesis_drops.GRADE->grades",
    "direct",
    "synthesis_drops",
    "GRADE",
    "grades",
    "GRADE",
  ],
  [
    "synthesis_drops.DropKey->drops",
    "grouped",
    "synthesis_drops",
    "DropKey",
    "drops",
    "DropKey",
  ],
  [
    "synthesis_recipes.GRADE->grades",
    "direct",
    "synthesis_recipes",
    "GRADE",
    "grades",
    "GRADE",
  ],
  [
    "unique_mods.Param1[Skill*]->skills",
    "direct",
    "unique_mods",
    "Param1",
    "skills",
    "SkillKey",
  ],
] as const;

const EXPECTED_RELATIONSHIP_LIMITATION_MUTATIONS = [
  {
    id: "missing buff 206011",
    mutate: (value) =>
      mutateRow(
        value,
        "buff_groups",
        (row) => row.BuffGroupKey === 20601,
        "BuffKeys",
        1011,
      ),
    expectedSignature: '["buff_groups.BuffKeys->buffs",20601,206011]',
  },
  {
    id: "missing level-100 item scale",
    mutate: (value) =>
      mutateRow(value, "items", (row) => row.id === 300020, "level", 90),
    expectedSignature: '["items.level->item_level_scales",300020,100]',
  },
  {
    id: "numeric monster skill with a trailing-space catalog key",
    mutate: (value) =>
      mutateRow(
        value,
        "monsters",
        (row) => row.MonsterKey === 20011,
        "SkillKey",
        10001,
      ),
    expectedSignature: '["monsters.SkillKey->skills",20011,200111]',
  },
  {
    id: "missing stage monster 20101",
    mutate: (value) =>
      mutateRow(
        value,
        "stages",
        (row) => row.StageKey === 1208,
        "Monsters",
        "20061_1000 20062_1000 20091_200 20061_1000 20071_1000",
      ),
    expectedSignature: '["stages.Monsters->monsters",1208,20101]',
  },
] as const satisfies readonly ExpectedRelationshipLimitationMutation[];

const CONDITIONAL_DISCRIMINATOR_MUTATIONS = [
  ["attributes", "ATTRIBUTETYPE"],
  ["drops", "REWARDTYPE"],
  ["items", "type"],
  ["pets", "UnlockCondition"],
] as const;

let catalog: LoadedDiscordHeroCatalog;
let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  catalog = await loadDiscordHeroCatalog();
  indexes = buildCatalogIndexes(catalog);
});

describe("DiscordHero typed catalog indexes", () => {
  test("makes all 45 datasets and every source row reachable", () => {
    expect(Object.keys(indexes.tables)).toEqual([...EXPECTED_DATASETS]);
    expect(indexes.tables.heroes.rows).toHaveLength(6);
    expect(indexes.tables.stages.rows).toHaveLength(120);
    expect(indexes.tables.items.rows).toHaveLength(5_944);
    expect(indexes.tables.drops.rows).toHaveLength(6_303);
    expect(indexes.tables.runes.rows).toHaveLength(197);

    for (const name of EXPECTED_DATASETS) {
      const source = getDiscordHeroDataset(catalog, name);
      const lastSourceRow = source.rows.at(-1)!;
      const sourcePrimaryField = source.columns[0]!;
      const sourceKey = lastSourceRow[sourcePrimaryField];
      if (typeof sourceKey !== "number" && typeof sourceKey !== "string") {
        throw new Error(`${name} test fixture has a non-indexable primary key`);
      }

      expect(getCatalogGroup(indexes, name, sourceKey as never)).toContain(
        lastSourceRow,
      );
    }
  });

  test("reaches representative tail keys without numeric or whitespace coercion", () => {
    expect(getCatalogRow(indexes, "heroes", 601).HeroKey).toBe(601);
    expect(getCatalogRow(indexes, "stages", 4310).StageKey).toBe(4310);
    expect(getCatalogRow(indexes, "items", 638112).id).toBe(638112);
    expect(getCatalogGroup(indexes, "drops", 3607007).at(-1)?.RewardKey).toBe(
      1613800,
    );
    expect(getCatalogRow(indexes, "runes", 4101).RuneKey).toBe(4101);
    expect(getCatalogRow(indexes, "skills", "301111 ").SkillKey).toBe(
      "301111 ",
    );
    expect(() => getCatalogRow(indexes, "skills", 301111)).toThrow(
      "skills has no unique row for key 301111",
    );
  });

  test("provides exact Vietnamese and English names with no locale fallback", () => {
    expect(getLocalizedCatalogName(indexes, "heroes", 601, "vi-VN")).toBe(
      "Sát Thủ",
    );
    expect(getLocalizedCatalogName(indexes, "heroes", 601, "en-US")).toBe(
      "Slayer",
    );
    expect(getLocalizedCatalogName(indexes, "stages", 4310, "vi-VN")).toBe(
      "Phòng Chỉ huy Địa ngục",
    );
    expect(getLocalizedCatalogName(indexes, "items", 638111, "en-US")).toBe(
      "Emerald Bracer",
    );
    expect(() =>
      getLocalizedCatalogName(indexes, "skills", 10001, "vi-VN"),
    ).toThrow("skills key 10001 has no vi-VN localized name");
  });

  test("strict parsers reject missing, unknown, and wrongly typed fields", () => {
    const sourceHero = getDiscordHeroDataset(catalog, "heroes").rows[0]!;

    expect(() =>
      parseCatalogRow("heroes", { ...sourceHero, HeroKey: "101" }),
    ).toThrow("heroes.HeroKey must be number");
    const { HeroKey: _heroKey, ...withoutHeroKey } = sourceHero;
    expect(() => parseCatalogRow("heroes", withoutHeroKey)).toThrow(
      "heroes.HeroKey is required",
    );
    expect(() =>
      parseCatalogRow("heroes", { ...sourceHero, invented: true }),
    ).toThrow("heroes row has unknown field invented");
  });

  test("rejects a catalog with duplicate or missing dataset identities", () => {
    const cloned = structuredClone(catalog) as unknown as {
      datasets: LoadedDiscordHeroCatalog["datasets"][number][];
    };
    cloned.datasets[44] = cloned.datasets[0]!;

    expect(() =>
      buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
    ).toThrow("catalog dataset identities must exactly match all 45 tables");
  });

  test("rejects duplicate unique keys while preserving declared grouped keys", () => {
    const cloned = structuredClone(catalog) as unknown as {
      datasets: Array<{
        name: string;
        rows: Array<Record<string, unknown>>;
      }>;
    };
    const heroes = cloned.datasets.find(
      (dataset) => dataset.name === "heroes",
    )!;
    heroes.rows[5] = structuredClone(heroes.rows[0]!);

    expect(() =>
      buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
    ).toThrow("heroes.HeroKey must be unique; duplicate key 101");

    expect(getCatalogGroup(indexes, "drops", 3111011)).toHaveLength(7);
    expect(getCatalogGroup(indexes, "stat_mods", 100101)).toHaveLength(10);
  });

  test("rejects a schema-valid skill sound reference that is not in the sound catalog", () => {
    const cloned = structuredClone(catalog) as unknown as {
      datasets: Array<{
        name: string;
        rows: Array<Record<string, unknown>>;
      }>;
    };
    const skills = cloned.datasets.find(
      (dataset) => dataset.name === "skills",
    )!;
    const skill = skills.rows.find((row) => row.SoundKey !== null)!;
    skill.SoundKey = 999_999;

    expect(() =>
      buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
    ).toThrow("skills.SoundKey references unknown sounds key 999999");
  });

  for (const [datasetName, field] of CONDITIONAL_DISCRIMINATOR_MUTATIONS) {
    test(`rejects unknown conditional discriminator ${datasetName}.${field}`, () => {
      const cloned = structuredClone(catalog) as unknown as MutableCatalog;
      mutateRow(cloned, datasetName, () => true, field, "UNKNOWN");

      expect(() =>
        buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
      ).toThrow(`${datasetName}.${field} has unknown discriminator "UNKNOWN"`);
    });
  }

  test("rejects a mismatched embedded monster stage projection", () => {
    const cloned = structuredClone(catalog) as unknown as MutableCatalog;
    const monsters = cloned.datasets.find(
      (dataset) => dataset.name === "monsters",
    )!;
    const stages = monsters.rows[0]!.stages as Array<Record<string, unknown>>;
    stages[0]!.act = UNKNOWN_KEY;

    expect(() =>
      buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
    ).toThrow("monsters.stages is not the exact reverse stage projection");
  });

  test("returns the exact canonical semantic relationship report for all 45 tables", () => {
    const expectedMonsterSkillReferences = [
      [20011, 200111],
      [20021, 200211],
      [20022, 200221],
      [20023, 200231],
      [20024, 200241],
      [20031, 200311],
      [20041, 200411],
      [20042, 200421],
      [20051, 200511],
      [20061, 200611],
      [20062, 200621],
      [20071, 200711],
      [20081, 200811],
      [20091, 200911],
      [20111, 201111],
      [30011, 300111],
      [30012, 300121],
      [30013, 300131],
      [30021, 300211],
      [30031, 300311],
      [30041, 300411],
      [30042, 300421],
      [30043, 300431],
      [30044, 300441],
      [30051, 300511],
      [30061, 300611],
      [30071, 300711],
      [30081, 300811],
      [30082, 300821],
      [30083, 300831],
      [30084, 300841],
      [30091, 300911],
      [30111, 301111],
    ] as const;
    const expectedLevelScaleReferences = [
      300020, 310020, 320020, 330020, 340020, 350020, 400020, 410020, 420020,
      430020, 440020, 450020, 500020, 510020, 520020, 530020,
    ] as const;
    const expectedStageMonsterReferences = [
      1208, 1209, 2208, 2209, 3208, 3209, 4208, 4209,
    ] as const;

    expect(indexes.semanticReport.tableCount).toBe(45);
    expect(indexes.semanticReport.ruleCount).toBe(59);
    expect(indexes.semanticReport.checkedReferenceCount).toBe(45_633);
    expect(indexes.semanticReport.resolvedReferenceCount).toBe(45_575);
    expect(indexes.semanticReport.unresolvedReferenceCount).toBe(58);
    expect(indexes.semanticReport.tables).toEqual(
      EXPECTED_DATASETS.map((name) => ({
        name,
        outgoingRuleIds: EXPECTED_RELATIONSHIP_RULE_METADATA.filter(
          (rule) => rule[2] === name,
        ).map((rule) => rule[0]),
        incomingRuleIds: EXPECTED_RELATIONSHIP_RULE_METADATA.filter(
          (rule) => rule[4] === name,
        ).map((rule) => rule[0]),
      })),
    );
    expect(indexes.semanticReport.rules.map((rule) => rule.id)).toEqual(
      RELATIONSHIP_MUTATIONS.map((mutation) => mutation.id),
    );
    expect(
      indexes.semanticReport.rules.map((rule) => [
        rule.id,
        rule.kind,
        rule.sourceTable,
        rule.sourceField,
        rule.targetTable,
        rule.targetField,
      ]),
    ).toEqual(EXPECTED_RELATIONSHIP_RULE_METADATA.map((rule) => [...rule]));
    expect(
      indexes.semanticReport.rules.map((rule) => rule.checkedReferenceCount),
    ).toEqual([...EXPECTED_RELATIONSHIP_REFERENCE_COUNTS]);
    expect(
      indexes.semanticReport.rules.map((rule) => rule.unresolvedReferenceCount),
    ).toEqual([...EXPECTED_RELATIONSHIP_UNRESOLVED_COUNTS]);
    expect(
      indexes.semanticReport.rules.reduce(
        (counts, rule) => ({
          ...counts,
          [rule.kind]: counts[rule.kind] + 1,
        }),
        { direct: 0, grouped: 0, "multi-key": 0 },
      ),
    ).toEqual({ direct: 37, grouped: 11, "multi-key": 11 });

    expect(indexes.semanticReport.unresolvedReferences).toEqual([
      {
        ruleId: "buff_groups.BuffKeys->buffs",
        sourceTable: "buff_groups",
        sourceField: "BuffKeys",
        sourceKey: 20601,
        targetTable: "buffs",
        targetKey: 206011,
        reason: "source buff key is absent from the buffs table",
      },
      ...expectedLevelScaleReferences.map((sourceKey) => ({
        ruleId: "items.level->item_level_scales",
        sourceTable: "items" as const,
        sourceField: "level",
        sourceKey,
        targetTable: "item_level_scales" as const,
        targetKey: 100,
        reason:
          "source documentation defines no level-100 scale and uses factor 1",
      })),
      ...expectedMonsterSkillReferences.map(([sourceKey, targetKey]) => ({
        ruleId: "monsters.SkillKey->skills",
        sourceTable: "monsters" as const,
        sourceField: "SkillKey",
        sourceKey,
        targetTable: "skills" as const,
        targetKey,
        reason:
          "exact numeric reference does not match the trailing-space skill key",
      })),
      ...expectedStageMonsterReferences.map((sourceKey) => ({
        ruleId: "stages.Monsters->monsters",
        sourceTable: "stages" as const,
        sourceField: "Monsters",
        sourceKey,
        targetTable: "monsters" as const,
        targetKey: 20101,
        reason: "source stage references absent monster 20101",
      })),
    ]);
  });

  for (const { id, mutate, expectedError } of RELATIONSHIP_MUTATIONS) {
    test(`rejects one schema-valid dangling mutation for ${id}`, () => {
      const cloned = structuredClone(catalog) as unknown as MutableCatalog;
      mutate(cloned);

      expect(() =>
        buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
      ).toThrow(expectedError);
    });
  }

  for (const {
    id,
    mutate,
    expectedSignature,
  } of EXPECTED_RELATIONSHIP_LIMITATION_MUTATIONS) {
    test(`rejects a stale exact limitation for ${id}`, () => {
      const cloned = structuredClone(catalog) as unknown as MutableCatalog;
      mutate(cloned);

      expect(() =>
        buildCatalogIndexes(cloned as unknown as LoadedDiscordHeroCatalog),
      ).toThrow(
        `expected unresolved relationship changed: ${expectedSignature}`,
      );
    });
  }

  test("does not mutate the catalog while producing the semantic report", () => {
    const cloned = structuredClone(catalog);
    const before = JSON.stringify(cloned);

    buildCatalogIndexes(cloned as LoadedDiscordHeroCatalog);

    expect(JSON.stringify(cloned)).toBe(before);
  });

  test("keeps every runtime group index and source row immutable", () => {
    expect(Object.isFrozen(indexes.semanticReport)).toBe(true);
    expect(Object.isFrozen(indexes.semanticReport.rules)).toBe(true);
    expect(Object.isFrozen(indexes.semanticReport.tables)).toBe(true);
    expect(Object.isFrozen(indexes.semanticReport.unresolvedReferences)).toBe(
      true,
    );
    for (const rule of indexes.semanticReport.rules) {
      expect(Object.isFrozen(rule)).toBe(true);
    }
    for (const table of indexes.semanticReport.tables) {
      expect(Object.isFrozen(table)).toBe(true);
      expect(Object.isFrozen(table.outgoingRuleIds)).toBe(true);
      expect(Object.isFrozen(table.incomingRuleIds)).toBe(true);
    }
    for (const unresolved of indexes.semanticReport.unresolvedReferences) {
      expect(Object.isFrozen(unresolved)).toBe(true);
    }

    for (const name of EXPECTED_DATASETS) {
      const groups = indexes.tables[name].groups;
      expect(Object.isFrozen(groups)).toBe(true);
      expect(Object.isFrozen(Object.getPrototypeOf(groups))).toBe(true);
      expect((groups as unknown as { set?: unknown }).set).toBeUndefined();
      expect(
        (groups as unknown as { delete?: unknown }).delete,
      ).toBeUndefined();
      expect((groups as unknown as { clear?: unknown }).clear).toBeUndefined();
      expect(() => Map.prototype.set.call(groups, "__forged__", [])).toThrow();
      for (const rows of groups.values()) {
        expect(Object.isFrozen(rows)).toBe(true);
        for (const row of rows) {
          expect(Object.isFrozen(row)).toBe(true);
        }
      }
    }

    const originalCost = getCatalogRow(indexes, "heroes", 401).UnlockCost;
    expect(() => {
      (
        getCatalogRow(indexes, "heroes", 401) as {
          UnlockCost: number;
        }
      ).UnlockCost = 0;
    }).toThrow();
    expect(getCatalogRow(indexes, "heroes", 401).UnlockCost).toBe(originalCost);
  });

  test("keeps canonical authority deeply immutable when Object.freeze is replaced after import", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, "freeze")!;
    let loaded: LoadedDiscordHeroCatalog | undefined;

    try {
      Object.defineProperty(Object, "freeze", {
        ...descriptor,
        value: <Value>(value: Value): Value => value,
      });
      loaded = await loadDiscordHeroCatalog();
    } finally {
      Object.defineProperty(Object, "freeze", descriptor);
    }

    expect(loaded).toBeDefined();
    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    const built = buildCatalogIndexes(loaded!);
    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);

    const row = getCatalogRow(built, "extraction_costs", 10101);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded!.datasets)).toBe(true);
    expect(Object.isFrozen(row)).toBe(true);
    expect(() => {
      (row as { Cost: number }).Cost = 777_777;
    }).toThrow();
    expect(getCatalogRow(built, "extraction_costs", 10101).Cost).toBe(100);
  });

  test("does not retain a caller row returned by a replaced Array.prototype.map", () => {
    const extractionRows = getDiscordHeroDataset(
      catalog,
      "extraction_costs",
    ).rows;
    const callerRow = { ...extractionRows[0]! };
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "map")!;
    const nativeMap = descriptor.value as (
      this: readonly unknown[],
      callback: (
        value: unknown,
        index: number,
        values: readonly unknown[],
      ) => unknown,
    ) => unknown[];
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(Array.prototype, "map", {
        ...descriptor,
        value: function (
          this: readonly unknown[],
          callback: (
            value: unknown,
            index: number,
            values: readonly unknown[],
          ) => unknown,
        ): unknown[] {
          if (this === extractionRows) {
            const poisonedRows = [...extractionRows];
            poisonedRows[0] = callerRow;
            return poisonedRows;
          }
          return Reflect.apply(nativeMap, this, [callback]);
        },
      });
      built = buildCatalogIndexes(catalog);
    } finally {
      Object.defineProperty(Array.prototype, "map", descriptor);
    }

    expect(built).toBeDefined();
    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);
    const indexedRow = getCatalogRow(built!, "extraction_costs", 10101);
    expect(indexedRow).not.toBe(callerRow);
    callerRow.Cost = 777_777;
    expect(getCatalogRow(built!, "extraction_costs", 10101).Cost).toBe(100);
  });

  test("uses the imported JSON parser when loading canonical authority", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(JSON, "parse")!;
    let loaded: LoadedDiscordHeroCatalog | undefined;

    try {
      Object.defineProperty(JSON, "parse", {
        ...descriptor,
        value: () => {
          throw new Error("replaced JSON.parse reached");
        },
      });
      loaded = await loadDiscordHeroCatalog();
    } finally {
      Object.defineProperty(JSON, "parse", descriptor);
    }

    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    expect(getDiscordHeroDataset(loaded!, "extraction_costs").rows[0]).toEqual({
      ExtractionKey: 10101,
      GearGroup: "WEAPON",
      MATERIALTYPE: "DECORATION",
      Tier: 1,
      Cost: 100,
    });
  });

  test("uses the imported UTF-8 decoder for the pinned catalog bytes", async () => {
    const forged = structuredClone(catalog) as unknown as MutableCatalog;
    mutateRow(
      forged,
      "extraction_costs",
      (row) => row.ExtractionKey === 10101,
      "Cost",
      777_777,
    );
    const forgedText = JSON.stringify(forged);
    const descriptor = Object.getOwnPropertyDescriptor(
      Buffer.prototype,
      "toString",
    )!;
    let loaded: LoadedDiscordHeroCatalog | undefined;

    try {
      Object.defineProperty(Buffer.prototype, "toString", {
        ...descriptor,
        value: () => forgedText,
      });
      loaded = await loadDiscordHeroCatalog();
    } finally {
      Object.defineProperty(Buffer.prototype, "toString", descriptor);
    }

    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    expect(
      getDiscordHeroDataset(loaded!, "extraction_costs").rows[0]!.Cost,
    ).toBe(100);
  });

  test("uses imported object traversal to freeze every loaded descendant", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, "values")!;
    let loaded: LoadedDiscordHeroCatalog | undefined;

    try {
      Object.defineProperty(Object, "values", {
        ...descriptor,
        value: () => [],
      });
      loaded = await loadDiscordHeroCatalog();
    } finally {
      Object.defineProperty(Object, "values", descriptor);
    }

    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded!.datasets)).toBe(true);
    expect(
      Object.isFrozen(
        getDiscordHeroDataset(loaded!, "extraction_costs").rows[0],
      ),
    ).toBe(true);
  });

  test("does not let a replaced Array iterator skip loaded descendants", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    )!;
    const nativeIterator = descriptor.value as (
      this: readonly unknown[],
    ) => ArrayIterator<unknown>;
    let loaded: LoadedDiscordHeroCatalog | undefined;

    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...descriptor,
        value: function (this: readonly unknown[]): ArrayIterator<unknown> {
          for (let index = 0; index < this.length; index += 1) {
            const value = this[index];
            if (
              Array.isArray(value) &&
              (value[0] as { name?: unknown } | undefined)?.name ===
                "attribute_groups"
            ) {
              return Reflect.apply(nativeIterator, [], []);
            }
          }
          return Reflect.apply(nativeIterator, this, []);
        },
      });
      loaded = await loadDiscordHeroCatalog();
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
    }

    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded!.datasets)).toBe(true);
    expect(
      Object.isFrozen(
        getDiscordHeroDataset(loaded!, "extraction_costs").rows[0],
      ),
    ).toBe(true);
  });

  test("uses imported WeakSet operations for loader and index authority", async () => {
    const addDescriptor = Object.getOwnPropertyDescriptor(
      WeakSet.prototype,
      "add",
    )!;
    let loaded: LoadedDiscordHeroCatalog | undefined;
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(WeakSet.prototype, "add", {
        ...addDescriptor,
        value: function (this: WeakSet<object>): WeakSet<object> {
          return this;
        },
      });
      loaded = await loadDiscordHeroCatalog();
      built = buildCatalogIndexes(catalog);
    } finally {
      Object.defineProperty(WeakSet.prototype, "add", addDescriptor);
    }

    expect(isLoadedDiscordHeroCatalogAuthority(loaded)).toBe(true);
    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);

    const hasDescriptor = Object.getOwnPropertyDescriptor(
      WeakSet.prototype,
      "has",
    )!;
    try {
      Object.defineProperty(WeakSet.prototype, "has", {
        ...hasDescriptor,
        value: () => true,
      });
      expect(
        isLoadedDiscordHeroCatalogAuthority(structuredClone(catalog)),
      ).toBe(false);
      expect(isDiscordHeroCatalogIndexAuthority(structuredClone(indexes))).toBe(
        false,
      );
    } finally {
      Object.defineProperty(WeakSet.prototype, "has", hasDescriptor);
    }
  });

  test("uses the imported freezer before granting index authority", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, "freeze")!;
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(Object, "freeze", {
        ...descriptor,
        value: <Value>(value: Value): Value => value,
      });
      built = buildCatalogIndexes(catalog);
    } finally {
      Object.defineProperty(Object, "freeze", descriptor);
    }

    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);
    expect(Object.isFrozen(built)).toBe(true);
    expect(Object.isFrozen(built!.tables)).toBe(true);
    expect(Object.isFrozen(built!.tables.extraction_costs.rows)).toBe(true);
    expect(Object.isFrozen(built!.semanticReport)).toBe(true);
  });

  test("does not retain a caller row returned by a replaced catalog Array iterator", () => {
    const extractionDataset = getDiscordHeroDataset(
      catalog,
      "extraction_costs",
    );
    const callerRow = { ...extractionDataset.rows[0]! };
    const poisonedRows = [...extractionDataset.rows];
    poisonedRows[0] = callerRow;
    const poisonedDatasets = catalog.datasets.map((dataset) =>
      dataset === extractionDataset
        ? { ...extractionDataset, rows: poisonedRows }
        : dataset,
    );
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    )!;
    const nativeIterator = descriptor.value as (
      this: readonly unknown[],
    ) => ArrayIterator<unknown>;
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...descriptor,
        value: function (this: readonly unknown[]): ArrayIterator<unknown> {
          return Reflect.apply(
            nativeIterator,
            this === catalog.datasets ? poisonedDatasets : this,
            [],
          );
        },
      });
      built = buildCatalogIndexes(catalog);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
    }

    expect(built).toBeDefined();
    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);
    const indexedRow = getCatalogRow(built!, "extraction_costs", 10101);
    expect(indexedRow).not.toBe(callerRow);
    callerRow.Cost = 777_777;
    expect(getCatalogRow(built!, "extraction_costs", 10101).Cost).toBe(100);
  });

  for (const [owner, property, replacement] of [
    [Object, "keys", () => []],
    [Array.prototype, "filter", () => []],
  ] as const) {
    test(`fails closed before branding when ${property} changes after import`, () => {
      const descriptor = Object.getOwnPropertyDescriptor(owner, property)!;
      let error: unknown;

      try {
        Object.defineProperty(owner, property, {
          ...descriptor,
          value: replacement,
        });
        try {
          buildCatalogIndexes(catalog);
        } catch (caught) {
          error = caught;
        }
      } finally {
        Object.defineProperty(owner, property, descriptor);
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "catalog index construction intrinsics changed after import",
      );
    });
  }

  test("builds every table as an own property without inherited setter dispatch", () => {
    const property = "extraction_costs";
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      property,
    );
    let setterCalls = 0;
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(Object.prototype, property, {
        configurable: true,
        get: () => undefined,
        set: () => {
          setterCalls += 1;
        },
      });
      built = buildCatalogIndexes(catalog);
    } finally {
      if (descriptor === undefined) {
        delete (Object.prototype as Record<string, unknown>)[property];
      } else {
        Object.defineProperty(Object.prototype, property, descriptor);
      }
    }

    expect(setterCalls).toBe(0);
    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);
    expect(Object.hasOwn(built!.tables, property)).toBe(true);
    expect(Object.keys(built!.tables)).toEqual([...EXPECTED_DATASETS]);
    expect(getCatalogRow(built!, "extraction_costs", 10101).Cost).toBe(100);
  });

  test("keeps the branded relationship report exact without inherited numeric setter dispatch", () => {
    const indexDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "0",
    );
    const filterDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "filter",
    )!;
    let setterCalls = 0;
    let poisonedFilterCalls = 0;
    let built: DiscordHeroCatalogIndexes | undefined;

    try {
      Object.defineProperty(Array.prototype, "0", {
        configurable: true,
        set: function (this: unknown[], value: unknown): void {
          setterCalls += 1;
          Object.defineProperty(this, "0", {
            configurable: true,
            enumerable: true,
            value,
            writable: true,
          });
          Object.defineProperty(Array.prototype, "filter", {
            ...filterDescriptor,
            value: function (): unknown[] {
              poisonedFilterCalls += 1;
              return [];
            },
          });
        },
      });
      built = buildCatalogIndexes(catalog);
    } finally {
      Object.defineProperty(Array.prototype, "filter", filterDescriptor);
      if (indexDescriptor === undefined) {
        delete Array.prototype[0];
      } else {
        Object.defineProperty(Array.prototype, "0", indexDescriptor);
      }
    }

    expect(isDiscordHeroCatalogIndexAuthority(built)).toBe(true);
    expect(built!.semanticReport.ruleCount).toBe(59);
    expect(built!.semanticReport.rules).toHaveLength(59);
    expect(
      built!.semanticReport.tables.reduce(
        (total, table) => total + table.outgoingRuleIds.length,
        0,
      ),
    ).toBe(59);
    expect(
      built!.semanticReport.tables.reduce(
        (total, table) => total + table.incomingRuleIds.length,
        0,
      ),
    ).toBe(59);
    expect(setterCalls).toBe(0);
    expect(poisonedFilterCalls).toBe(0);
  });

  test("keeps canonical lookups stable when native Map.prototype.get is poisoned", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, "get")!;
    const source = getCatalogRow(indexes, "heroes", 401);
    const forgedGroup = [{ ...source, UnlockCost: 0 }];
    let observedCost: number | undefined;

    try {
      Object.defineProperty(Map.prototype, "get", {
        ...descriptor,
        value: () => forgedGroup,
      });
      observedCost = getCatalogRow(indexes, "heroes", 401).UnlockCost;
    } finally {
      Object.defineProperty(Map.prototype, "get", descriptor);
    }

    expect(observedCost).toBe(500);
    expect(getCatalogRow(indexes, "heroes", 401).UnlockCost).toBe(500);
  });

  test("keeps enumeration stable when the native Map iterator is poisoned", () => {
    const iteratorPrototype = Object.getPrototypeOf(new Map().entries());
    const descriptor = Object.getOwnPropertyDescriptor(
      iteratorPrototype,
      "next",
    )!;
    const groups = indexes.tables.heroes.groups;
    let entries: Array<readonly [number | string, readonly unknown[]]> = [];
    let keys: Array<number | string> = [];
    let values: Array<readonly unknown[]> = [];

    try {
      Object.defineProperty(iteratorPrototype, "next", {
        ...descriptor,
        value: () => ({ done: true, value: undefined }),
      });
      entries = [...groups];
      keys = [...groups.keys()];
      values = [...groups.values()];
    } finally {
      Object.defineProperty(iteratorPrototype, "next", descriptor);
    }

    expect(entries).toHaveLength(6);
    expect(keys).toEqual([101, 201, 301, 401, 501, 601]);
    expect(values).toHaveLength(6);
    expect(entries[3]![1][0]).toMatchObject({
      HeroKey: 401,
      UnlockCost: 500,
    });
  });

  test("keeps forEach stable when Function.prototype.call is poisoned", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Function.prototype,
      "call",
    )!;
    const canonical = [...indexes.tables.heroes.groups].map(
      ([key, rows]) => [key, rows[0]!.UnlockCost] as const,
    );
    const observed: Array<readonly [number | string, number]> = [];

    try {
      Object.defineProperty(Function.prototype, "call", {
        ...descriptor,
        value: () => undefined,
      });
      indexes.tables.heroes.groups.forEach((rows, key) => {
        observed.push([key, rows[0]!.UnlockCost]);
      });
    } finally {
      Object.defineProperty(Function.prototype, "call", descriptor);
    }

    expect(observed).toEqual(canonical);
  });
});
