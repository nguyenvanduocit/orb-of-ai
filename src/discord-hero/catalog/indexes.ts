import {
  EXPECTED_DATASET_ROWS,
  type JsonObject,
  type JsonValue,
} from "./compiler";
import {
  isLoadedDiscordHeroCatalogAuthority,
  type LoadedDiscordHeroCatalog,
  type LoadedJsonObject,
} from "./loader";

type FieldRule =
  | "array"
  | "array|undefined"
  | "boolean"
  | "boolean|null"
  | "boolean|undefined"
  | "null"
  | "number"
  | "number|null"
  | "number|string"
  | "number|string|null"
  | "object"
  | "object|null"
  | "object|undefined"
  | "string"
  | "string|null";

interface TableSpec {
  readonly primary: string;
  /**
   * Omitted means the primary field is a unique key. Only source tables whose
   * primary field intentionally identifies a row group opt in here.
   */
  readonly keyMode?: "grouped";
  readonly fields: Readonly<Record<string, FieldRule>>;
}

const TABLE_SPECS = {
  attribute_groups: {
    primary: "AttributeGroupKey",
    fields: {
      AttributeGroupKey: "number",
      RequiredAllocatedPoint: "number",
    },
  },
  attributes: {
    primary: "AttributeKey",
    fields: {
      AttributeKey: "number",
      HeroKey: "number",
      GroupKey: "number",
      ATTRIBUTETYPE: "string",
      Value: "number",
      RequiredPoint: "number",
      MaxLevel: "number",
      AvailableDemo: "boolean",
    },
  },
  buff_groups: {
    primary: "BuffGroupKey",
    keyMode: "grouped",
    fields: {
      BuffGroupKey: "number",
      BuffKeys: "number|string|null",
    },
  },
  buffs: {
    primary: "BuffKey",
    fields: {
      BuffKey: "number",
      BuffType: "string",
      STATTYPE: "string",
      MODTYPE: "string",
      Value: "number|null",
    },
  },
  crafting_recipes: {
    primary: "CraftingRecipeKey",
    fields: {
      CraftingRecipeKey: "number",
      ItemCraftingType: "string",
      RecipeTier: "number",
      Material: "string",
      MaterialIndex: "number|string",
      DropKey: "number",
    },
  },
  cube_levels: {
    primary: "Level",
    fields: {
      Level: "number",
      ExpForLevelUp: "number",
    },
  },
  cube_recipes: {
    primary: "CubeKey",
    fields: {
      CubeKey: "number",
      RECIPETYPE: "string",
      Index: "number",
      IsDefaultUnlocked: "boolean|null",
      TooltipStringKey: "string",
      TooltipStringKey_i18n: "object",
    },
  },
  cube_sub_recipes: {
    primary: "CubeSubRecipeKey",
    fields: {
      CubeSubRecipeKey: "number",
      RECIPETYPE: "string",
      RecipeTier: "number|null",
      DefaultUnlockWhenMainRecipeOpen: "boolean|null",
      UnlockCubeLevel: "number",
      UnlockCost: "number|null",
      Material: "string|null",
      TriggerGoldCost: "number|null",
      DropKey: "number|null",
      SubRecipeNameStringKey: "string",
      SubRecipeNameStringKey_i18n: "object",
    },
  },
  currencies: {
    primary: "CurrencyKey",
    fields: {
      CurrencyKey: "number",
      CurrencyNameStringKey: "string",
      CurrencyNameStringKey_i18n: "object",
      Description: "string",
      InitialAmount: "number",
      IconPath: "string",
    },
  },
  drops: {
    primary: "DropKey",
    keyMode: "grouped",
    fields: {
      DropKey: "number",
      DropType: "string",
      REWARDTYPE: "string",
      RewardKey: "number",
      HeroKeyCondition: "number|null",
      Weight: "number",
    },
  },
  extraction_costs: {
    primary: "ExtractionKey",
    fields: {
      ExtractionKey: "number",
      GearGroup: "string",
      MATERIALTYPE: "string",
      Tier: "number",
      Cost: "number",
    },
  },
  gear: {
    primary: "GearKey",
    fields: {
      GearKey: "number",
      BaseStat1_Value: "number|string",
      BaseStat2_Value: "number|null",
      InherentStat1_STATTYPE: "string",
      InherentStat1_MODTYPE: "string",
      InherentStat1_Value: "number",
      InherentStat2_STATTYPE: "string",
      InherentStat2_MODTYPE: "string",
      InherentStat2_Value: "number",
      InherentStat3_STATTYPE: "string",
      InherentStat3_MODTYPE: "string",
      InherentStat3_Value: "number",
      UniqueModKey: "number|null",
    },
  },
  gear_type_scales: {
    primary: "GearType",
    fields: {
      GearType: "string",
      AlchemyGoldScale: "number",
      CubeExpScale: "number",
    },
  },
  gear_types: {
    primary: "GearType",
    fields: {
      GearType: "string",
      BaseStat1_STATTYPE: "string",
      BaseStat1_MODTYPE: "string",
      BaseStat2_STATTYPE: "string|null",
      BaseStat2_MODTYPE: "string|null",
    },
  },
  grades: {
    primary: "GRADE",
    fields: {
      GRADE: "string",
      Lower2GradeWeight: "number",
      Lower1GradeWeight: "number",
      SameGradeWeight: "number",
      Higher1GradeWeight: "number",
      Higher2GradeWeight: "number",
      InherentSlotAmount: "number",
      ExtraSlotAmount_Decoration: "number",
      ExtraSlotAmount_Engraving: "number",
      ExtraSlotAmount_Inscription: "number",
      BaseAlchemyGold: "number",
      BaseCubeExp: "number",
    },
  },
  heroes: {
    primary: "HeroKey",
    fields: {
      HeroKey: "number",
      HeroNameKey: "string",
      HeroNameKey_i18n: "object",
      DescriptionKey: "string",
      DescriptionKey_i18n: "object",
      ClassType: "string",
      MainWeaponGearType: "string",
      SubWeaponGearType: "string",
      SkillKey: "number",
      AttackDamage: "number",
      AttackSpeed: "number",
      CastSpeed: "number",
      CriticalChance: "number",
      CriticalDamage: "number",
      MaxHp: "number",
      Armor: "number",
      CooldownReduction: "number",
      MovementSpeed: "number",
      UnlockCost: "number",
      IsAvailable: "boolean",
      IsFirstAvailable: "boolean",
      SelectSoundKey: "number",
      DeadSoundKey: "number",
      DLCAppId: "number",
      DLCBitIndex: "number",
      HasDLCDrop: "boolean",
      IconPath: "string",
      DeadIconPath: "string",
      PrefabPath: "string",
      AnimatorPath: "string",
      icon: "string",
      dead_icon: "string",
      animations_folder: "string",
      skill_name_i18n: "null",
      attribute_keys: "array",
      attributes: "array",
    },
  },
  inventory: {
    primary: "Index",
    fields: {
      Index: "number",
      CostForUnlock: "number",
    },
  },
  item_groups: {
    primary: "ItemGroupKey",
    keyMode: "grouped",
    fields: {
      ItemGroupKey: "number",
      GroupName: "string|null",
      ItemKey: "number",
    },
  },
  item_level_scales: {
    primary: "Level",
    fields: {
      Level: "number",
      AlchemyGoldScale: "number",
      CubeExpScale: "number",
    },
  },
  item_type_scales: {
    primary: "ItemType",
    fields: {
      ItemType: "string",
      AlchemyGoldScale: "number",
      CubeExpScale: "number",
    },
  },
  items: {
    primary: "id",
    fields: {
      id: "number",
      name: "object|null",
      grade: "string",
      type: "string",
      gear: "string|null",
      level: "number|null",
      icon: "string",
      affix: "string|null",
      slug: "string",
      deleted: "boolean|undefined",
      marketable: "boolean|undefined",
    },
  },
  levels: {
    primary: "Level",
    fields: {
      Level: "number",
      ExpForLevelUp: "number",
    },
  },
  materials: {
    primary: "ItemKey",
    fields: {
      ItemKey: "number",
      MATERIALTYPE: "string",
      StatModGroupKey: "number|null",
    },
  },
  monsters: {
    primary: "MonsterKey",
    fields: {
      MonsterKey: "number",
      MonsterNameStringKey: "string",
      MonsterNameStringKey_i18n: "object",
      MONSTERTYPE: "string",
      RewardGold: "number",
      RewardExp: "number",
      SkillKey: "number|string",
      AttackDamage: "number",
      AttackSpeed: "number",
      MaxLife: "number",
      MovementSpeed: "number",
      DeadSoundKey: "number",
      PrefabPath: "string",
      AnimatorPath: "string",
      portrait: "string",
      sprite_folder: "string",
      skill_name_i18n: "null",
      attack: "object|undefined",
      attacks: "array|undefined",
      attackElements: "array|undefined",
      stages: "array",
    },
  },
  offline_rewards: {
    primary: "StageLevel",
    fields: {
      StageLevel: "number",
      BaseGold: "number",
      BaseExp: "number",
      KillCount: "number",
      ClearCount: "number",
    },
  },
  passive_skills: {
    primary: "PassiveSkillKey",
    fields: {
      PassiveSkillKey: "number",
      SkillNameKey: "string",
      SkillNameKey_i18n: "object",
      STATTYPE: "string",
      MODTYPE: "string",
      Value: "number",
    },
  },
  pet_stats: {
    primary: "PetStatKey",
    keyMode: "grouped",
    fields: {
      PetStatKey: "number",
      STATTYPE: "string",
      MODTYPE: "string",
      Value: "number",
    },
  },
  pets: {
    primary: "PetKey",
    fields: {
      PetKey: "number",
      NameKey: "string",
      NameKey_i18n: "object",
      DescriptionKey: "string",
      DescriptionKey_i18n: "object",
      StatDataKey: "number",
      UnlockCondition: "string",
      Param1: "number",
      Param2: "number|null",
    },
  },
  rune_levels: {
    primary: "LevelKey",
    keyMode: "grouped",
    fields: {
      LevelKey: "number",
      Level: "number",
      CostItemKey: "number",
      CostValue: "number",
      STATTYPE: "string",
      Value: "number",
    },
  },
  runes: {
    primary: "RuneKey",
    fields: {
      RuneKey: "number",
      NameKey: "string",
      NameKey_i18n: "object",
      MaxLevel: "number",
      PrevNodeRequiredLevel: "number|null",
      NextRuneKey: "number|string|null",
      PreviewRuneKey: "number|string|null",
      LevelDataKey: "number",
      IconPath: "string",
      icon: "string",
      next_runes: "array",
    },
  },
  skill_levels: {
    primary: "SkillLevelKey",
    keyMode: "grouped",
    fields: {
      SkillLevelKey: "number",
      Level: "number",
      Value: "number",
    },
  },
  skills: {
    primary: "SkillKey",
    fields: {
      SkillKey: "number|string",
      SkillNameKey: "string|null",
      SkillDescriptionKey: "string|null",
      ACTIVATIONTYPE: "string",
      ActivationValue: "number|null",
      SLOTTYPE: "string",
      SkillBuffType: "string",
      BuffGroupKey: "number|null",
      Param1: "number|null",
      Param2: "number|null",
      Param3: "number|null",
      Param4: "number|null",
      Param5: "number|null",
      Range: "number",
      Order: "number|string",
      DamageType: "string",
      DamageDeliveryType: "string|null",
      Value: "number|string|null",
      SkillLevelKey: "number|null",
      AnimClipPath1: "string",
      AnimClipPath2: "string|null",
      AnimClipPath3: "string|null",
      AttributeKey: "number|null",
      SoundKey: "number|null",
      levels: "array",
      SkillNameKey_i18n: "object|undefined",
      SkillDescriptionKey_i18n: "object|undefined",
    },
  },
  skins: {
    primary: "PcSkinKey",
    fields: {
      PcSkinKey: "number",
      PartsCategory: "string",
      DecorableType: "string",
      GroupKeys: "number|string|null",
      Cost: "number",
      HasUpperLayer: "boolean|null",
      IsDefaultUnlocked: "boolean",
      IconPath: "string",
    },
  },
  sounds: {
    primary: "SoundKey",
    fields: {
      SoundKey: "number",
      SoundType: "string",
      Volume: "number",
      AudioClipPath: "string",
    },
  },
  stage_levels: {
    primary: "StageLevel",
    fields: {
      StageLevel: "number",
      MonsterAtkDmgMultiplier: "number",
      MonsterHpMultiplier: "number",
      MonsterGoldMultiplier: "number",
      MonsterExpMultiplier: "number",
    },
  },
  stages: {
    primary: "StageKey",
    fields: {
      StageKey: "number",
      StageNameKey: "string",
      StageNameKey_i18n: "object",
      STAGETYPE: "string",
      STAGEDIFFICULITY: "string",
      Act: "number",
      StageNo: "number",
      StageLevel: "number",
      NextStageKey: "number|null",
      WaveAmount: "number|null",
      WaveMonsterAmount: "number|null",
      Monsters: "string|null",
      MonsterDropItemKey: "number|null",
      MonsterDropItemRate: "number|null",
      BossDropItemKey: "number",
      BossDropItemRate: "number|null",
      FirstClearDropKey: "number|null",
      BossMonsterKey: "number",
      BossDamageMultiplier: "number|null",
      BossHpMultiplier: "number|null",
      BossGoldMultiplier: "number|null",
      BossExpMultiplier: "number|null",
      BossScale: "number|null",
      SoulstoneItemKey: "number|null",
      SoulstoneAmount: "number|null",
      IsDemo: "boolean",
      BGMSoundKey: "number",
    },
  },
  stash: {
    primary: "Index",
    fields: {
      Index: "number",
      CostForUnlock: "number",
    },
  },
  stat_mod_groups: {
    primary: "StatModGroupKey",
    keyMode: "grouped",
    fields: {
      StatModGroupKey: "number",
      GearGroup: "string",
      StatModKey: "number",
      MinTier: "number",
      MaxTier: "number",
    },
  },
  stat_mods: {
    primary: "StatModKey",
    keyMode: "grouped",
    fields: {
      StatModKey: "number",
      Tier: "number",
      STATTYPE: "string",
      MODTYPE: "string",
      MinValue: "number",
      MaxValue: "number",
      Interval: "number",
    },
  },
  status_effects: {
    primary: "StatusEffectKey",
    fields: {
      StatusEffectKey: "number",
      StatusEffectType: "string",
      Duration: "number",
      BuffKeys: "number|string|null",
      OverrideType: "string",
      Param0: "number|null",
      Param1: "number|null",
      Param2: "null",
      Param3: "null",
      buffs: "array",
    },
  },
  storage: {
    primary: "Index",
    fields: {
      Index: "number",
      CostForUnlock: "number",
    },
  },
  synthesis_drops: {
    primary: "SynthesisDropKey",
    fields: {
      SynthesisDropKey: "number",
      ItemLevel: "number",
      RecipeTier: "number",
      ItemSynthesisType: "string",
      GRADE: "string",
      DropKey: "number",
    },
  },
  synthesis_recipes: {
    primary: "SynthesisRecipeKey",
    fields: {
      SynthesisRecipeKey: "number",
      RecipeTier: "number",
      MinMaterialTier: "number",
      MinResultLevel: "number",
      MaxResultLevel: "number",
      ItemSynthesisType: "string",
      GRADE: "string",
      MaterialAmount: "number",
      MinMaterialAverageLevel: "number",
      LevelWeight1: "number",
      LevelWeight2: "number",
      LevelWeight3: "number",
      LevelWeight4: "number",
    },
  },
  trading_stash: {
    primary: "Index",
    fields: {
      Index: "number",
      CostForUnlock: "number",
    },
  },
  unique_mods: {
    primary: "UniqueModKey",
    fields: {
      UniqueModKey: "number",
      UniqueMod: "string",
      Param1ExchangeType: "string|null",
      Param1: "number|null",
      Param2ExchangeType: "string|null",
      Param2: "number|string|null",
      Param3ExchangeType: "null",
      Param3: "null",
      Param4ExchangeType: "null",
      Param4: "null",
      Param5ExchangeType: "null",
      Param5: "null",
    },
  },
} as const satisfies Readonly<Record<string, TableSpec>>;

export type DiscordHeroDatasetName = keyof typeof TABLE_SPECS;

export const DISCORD_HERO_DATASET_NAMES = Object.freeze(
  Object.keys(TABLE_SPECS) as DiscordHeroDatasetName[],
);

type AtomicRuleValue<Rule extends string> = Rule extends "array"
  ? readonly JsonValue[]
  : Rule extends "boolean"
    ? boolean
    : Rule extends "null"
      ? null
      : Rule extends "number"
        ? number
        : Rule extends "object"
          ? JsonObject
          : Rule extends "string"
            ? string
            : Rule extends "undefined"
              ? undefined
              : never;

type RuleValue<Rule extends string> =
  Rule extends `${infer Left}|${infer Right}`
    ? AtomicRuleValue<Left> | RuleValue<Right>
    : AtomicRuleValue<Rule>;

type DatasetSpec<Name extends DiscordHeroDatasetName> =
  (typeof TABLE_SPECS)[Name];

export type DiscordHeroDatasetRow<Name extends DiscordHeroDatasetName> =
  Readonly<{
    [Field in keyof DatasetSpec<Name>["fields"]]: RuleValue<
      DatasetSpec<Name>["fields"][Field] & string
    >;
  }>;

type PrimaryField<Name extends DiscordHeroDatasetName> =
  DatasetSpec<Name>["primary"] & keyof DiscordHeroDatasetRow<Name>;

export type DiscordHeroDatasetKey<Name extends DiscordHeroDatasetName> =
  DiscordHeroDatasetRow<Name>[PrimaryField<Name>] & (number | string);

const NativeArray = Array;
const NativeJSON = JSON;
const NativeMap = Map;
const NativeMath = Math;
const NativeNumber = Number;
const NativeObject = Object;
const NativeRegExp = RegExp;
const NativeReflect = Reflect;
const NativeSet = Set;
const NativeString = String;
const applyIntrinsic = Reflect.apply;
const nativeArrayEvery = Array.prototype.every;
const nativeArrayFilter = Array.prototype.filter;
const nativeArrayFind = Array.prototype.find;
const nativeArrayIncludes = Array.prototype.includes;
const nativeArrayIsArray = Array.isArray;
const nativeArrayMap = Array.prototype.map;
const nativeArrayPush = Array.prototype.push;
const nativeArrayReduce = Array.prototype.reduce;
const nativeArraySome = Array.prototype.some;
const nativeJsonStringify = JSON.stringify;
const nativeMapGet = Map.prototype.get;
const nativeMapSet = Map.prototype.set;
const nativeMapHas = Map.prototype.has;
const nativeMapEntries = Map.prototype.entries;
const nativeMapKeys = Map.prototype.keys;
const nativeMapValues = Map.prototype.values;
const nativeMapForEach = Map.prototype.forEach;
const nativeMapSize = Object.getOwnPropertyDescriptor(
  Map.prototype,
  "size",
)!.get!;
const nativeMathFloor = Math.floor;
const nativeNumberIsFinite = Number.isFinite;
const nativeNumberIsSafeInteger = Number.isSafeInteger;
const nativeObjectEntries = Object.entries;
const nativeObjectFreeze = Object.freeze;
const nativeObjectHasOwn = Object.hasOwn;
const nativeObjectKeys = Object.keys;
const nativeRegExpTest = RegExp.prototype.test;
const nativeReflectDefineProperty = Reflect.defineProperty;
const nativeSetAdd = Set.prototype.add;
const nativeSetHas = Set.prototype.has;
const nativeStringIncludes = String.prototype.includes;
const nativeStringIndexOf = String.prototype.indexOf;
const nativeStringSlice = String.prototype.slice;
const nativeStringSplit = String.prototype.split;
const nativeStringStartsWith = String.prototype.startsWith;
const nativeWeakSetAdd = WeakSet.prototype.add;
const nativeWeakSetHas = WeakSet.prototype.has;
const nativeMapIteratorNext = Object.getPrototypeOf(
  applyIntrinsic(nativeMapEntries, new NativeMap(), []),
).next as (this: MapIterator<unknown>) => IteratorResult<unknown>;

function arrayMap<Value, Result>(
  values: readonly Value[],
  callback: (value: Value, index: number, values: readonly Value[]) => Result,
): Result[] {
  return applyIntrinsic(nativeArrayMap, values, [callback]) as Result[];
}

function freeze<Value>(value: Value): Readonly<Value> {
  return applyIntrinsic(nativeObjectFreeze, Object, [value]) as Readonly<Value>;
}

function weakSetAdd(set: WeakSet<object>, value: object): void {
  applyIntrinsic(nativeWeakSetAdd, set, [value]);
}

function weakSetHas(set: WeakSet<object>, value: object): boolean {
  return applyIntrinsic(nativeWeakSetHas, set, [value]) as boolean;
}

function setAdd<Value>(set: Set<Value>, value: Value): void {
  applyIntrinsic(nativeSetAdd, set, [value]);
}

function setHas<Value>(set: Set<Value>, value: Value): boolean {
  return applyIntrinsic(nativeSetHas, set, [value]) as boolean;
}

function appendArray<Value>(values: Value[], value: Value): void {
  const defined = applyIntrinsic(nativeReflectDefineProperty, NativeReflect, [
    values,
    values.length,
    {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    },
  ]) as boolean;
  if (!defined) {
    throw new Error(
      "catalog index construction could not append an array item",
    );
  }
}

function assertCatalogIndexConstructionIntrinsics(): void {
  if (
    Array !== NativeArray ||
    Array.isArray !== nativeArrayIsArray ||
    Array.prototype.every !== nativeArrayEvery ||
    Array.prototype.filter !== nativeArrayFilter ||
    Array.prototype.find !== nativeArrayFind ||
    Array.prototype.includes !== nativeArrayIncludes ||
    Array.prototype.push !== nativeArrayPush ||
    Array.prototype.reduce !== nativeArrayReduce ||
    Array.prototype.some !== nativeArraySome ||
    JSON !== NativeJSON ||
    JSON.stringify !== nativeJsonStringify ||
    Math !== NativeMath ||
    Math.floor !== nativeMathFloor ||
    Number !== NativeNumber ||
    Number.isFinite !== nativeNumberIsFinite ||
    Number.isSafeInteger !== nativeNumberIsSafeInteger ||
    Object !== NativeObject ||
    Object.entries !== nativeObjectEntries ||
    Object.hasOwn !== nativeObjectHasOwn ||
    Object.keys !== nativeObjectKeys ||
    RegExp !== NativeRegExp ||
    RegExp.prototype.test !== nativeRegExpTest ||
    Reflect !== NativeReflect ||
    Reflect.defineProperty !== nativeReflectDefineProperty ||
    String !== NativeString ||
    String.prototype.includes !== nativeStringIncludes ||
    String.prototype.indexOf !== nativeStringIndexOf ||
    String.prototype.slice !== nativeStringSlice ||
    String.prototype.split !== nativeStringSplit ||
    String.prototype.startsWith !== nativeStringStartsWith
  ) {
    throw new Error(
      "catalog index construction intrinsics changed after import",
    );
  }
}

class RuntimeReadonlyMapIterator<Value> {
  readonly #iterator: MapIterator<Value>;

  constructor(iterator: MapIterator<Value>) {
    this.#iterator = iterator;
    freeze(this);
  }

  next(): IteratorResult<Value> {
    return applyIntrinsic(
      nativeMapIteratorNext,
      this.#iterator,
      [],
    ) as IteratorResult<Value>;
  }

  [Symbol.iterator](): RuntimeReadonlyMapIterator<Value> {
    return this;
  }
}

freeze(RuntimeReadonlyMapIterator.prototype);

function protectMapIterator<Value>(
  iterator: MapIterator<Value>,
): MapIterator<Value> {
  return new RuntimeReadonlyMapIterator(
    iterator,
  ) as unknown as MapIterator<Value>;
}

function mapGet<Key, Value>(map: Map<Key, Value>, key: Key): Value | undefined {
  return applyIntrinsic(nativeMapGet, map, [key]) as Value | undefined;
}

function mapSet<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  value: Value,
): void {
  applyIntrinsic(nativeMapSet, map, [key, value]);
}

function mapHas<Key, Value>(map: Map<Key, Value>, key: Key): boolean {
  return applyIntrinsic(nativeMapHas, map, [key]) as boolean;
}

function mapEntries<Key, Value>(
  map: Map<Key, Value>,
): MapIterator<[Key, Value]> {
  return protectMapIterator(
    applyIntrinsic(nativeMapEntries, map, []) as MapIterator<[Key, Value]>,
  );
}

function mapKeys<Key, Value>(map: Map<Key, Value>): MapIterator<Key> {
  return protectMapIterator(
    applyIntrinsic(nativeMapKeys, map, []) as MapIterator<Key>,
  );
}

function mapValues<Key, Value>(map: Map<Key, Value>): MapIterator<Value> {
  return protectMapIterator(
    applyIntrinsic(nativeMapValues, map, []) as MapIterator<Value>,
  );
}

function mapSize<Key, Value>(map: Map<Key, Value>): number {
  return applyIntrinsic(nativeMapSize, map, []) as number;
}

class RuntimeReadonlyMap<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #entries: Map<Key, Value>;

  constructor(entries: Map<Key, Value>) {
    this.#entries = new NativeMap<Key, Value>();
    applyIntrinsic(nativeMapForEach, entries, [
      (value: Value, key: Key) => {
        mapSet(this.#entries, key, value);
      },
    ]);
    freeze(this);
  }

  get size(): number {
    return mapSize(this.#entries);
  }

  get(key: Key): Value | undefined {
    return mapGet(this.#entries, key);
  }

  has(key: Key): boolean {
    return mapHas(this.#entries, key);
  }

  entries(): MapIterator<[Key, Value]> {
    return mapEntries(this.#entries);
  }

  keys(): MapIterator<Key> {
    return mapKeys(this.#entries);
  }

  values(): MapIterator<Value> {
    return mapValues(this.#entries);
  }

  forEach(
    callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown,
  ): void {
    applyIntrinsic(nativeMapForEach, this.#entries, [
      (value: Value, key: Key) => {
        applyIntrinsic(callback, thisArg, [value, key, this]);
      },
    ]);
  }

  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return mapEntries(this.#entries);
  }
}

freeze(RuntimeReadonlyMap.prototype);

export interface DiscordHeroTableIndex<Name extends DiscordHeroDatasetName> {
  readonly name: Name;
  readonly primaryField: PrimaryField<Name>;
  readonly rows: readonly DiscordHeroDatasetRow<Name>[];
  readonly groups: ReadonlyMap<
    DiscordHeroDatasetKey<Name>,
    readonly DiscordHeroDatasetRow<Name>[]
  >;
}

export type DiscordHeroCatalogTables = {
  readonly [Name in DiscordHeroDatasetName]: DiscordHeroTableIndex<Name>;
};

export type DiscordHeroRelationshipKind = "direct" | "grouped" | "multi-key";

export interface DiscordHeroUnresolvedReference {
  readonly ruleId: string;
  readonly sourceTable: DiscordHeroDatasetName;
  readonly sourceField: string;
  readonly sourceKey: string | number;
  readonly targetTable: DiscordHeroDatasetName;
  readonly targetKey: string | number;
  readonly reason: string;
}

export interface DiscordHeroRelationshipRuleReport {
  readonly id: string;
  readonly kind: DiscordHeroRelationshipKind;
  readonly sourceTable: DiscordHeroDatasetName;
  readonly sourceField: string;
  readonly targetTable: DiscordHeroDatasetName;
  readonly targetField: string;
  readonly checkedReferenceCount: number;
  readonly unresolvedReferenceCount: number;
}

export interface DiscordHeroRelationshipTableReport {
  readonly name: DiscordHeroDatasetName;
  readonly outgoingRuleIds: readonly string[];
  readonly incomingRuleIds: readonly string[];
}

export interface DiscordHeroSemanticRelationshipReport {
  readonly tableCount: number;
  readonly ruleCount: number;
  readonly checkedReferenceCount: number;
  readonly resolvedReferenceCount: number;
  readonly unresolvedReferenceCount: number;
  readonly rules: readonly DiscordHeroRelationshipRuleReport[];
  readonly tables: readonly DiscordHeroRelationshipTableReport[];
  readonly unresolvedReferences: readonly DiscordHeroUnresolvedReference[];
}

export interface DiscordHeroCatalogIndexes {
  readonly catalog: LoadedDiscordHeroCatalog;
  readonly tables: DiscordHeroCatalogTables;
  readonly semanticReport: DiscordHeroSemanticRelationshipReport;
}

const catalogIndexAuthorities = new WeakSet<object>();

export function isDiscordHeroCatalogIndexAuthority(
  value: unknown,
): value is DiscordHeroCatalogIndexes {
  return (
    typeof value === "object" &&
    value !== null &&
    weakSetHas(catalogIndexAuthorities, value)
  );
}

export type DiscordHeroLocale = "vi-VN" | "en-US";

const LOCALIZED_NAME_FIELDS = {
  currencies: "CurrencyNameStringKey_i18n",
  heroes: "HeroNameKey_i18n",
  items: "name",
  monsters: "MonsterNameStringKey_i18n",
  passive_skills: "SkillNameKey_i18n",
  pets: "NameKey_i18n",
  runes: "NameKey_i18n",
  skills: "SkillNameKey_i18n",
  stages: "StageNameKey_i18n",
} as const satisfies Partial<Record<DiscordHeroDatasetName, string>>;

export type LocalizedDiscordHeroDataset = keyof typeof LOCALIZED_NAME_FIELDS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesAtomicRule(value: unknown, rule: string): boolean {
  if (rule === "array") return Array.isArray(value);
  if (rule === "boolean") return typeof value === "boolean";
  if (rule === "null") return value === null;
  if (rule === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (rule === "object") return isRecord(value);
  if (rule === "string") return typeof value === "string";
  if (rule === "undefined") return value === undefined;
  return false;
}

function matchesRule(value: unknown, rule: FieldRule): boolean {
  return rule.split("|").some((atomic) => matchesAtomicRule(value, atomic));
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function formatKey(key: string | number): string {
  return typeof key === "string" ? JSON.stringify(key) : String(key);
}

export function parseCatalogRow<Name extends DiscordHeroDatasetName>(
  name: Name,
  value: unknown,
): DiscordHeroDatasetRow<Name> {
  if (!isRecord(value)) {
    throw new Error(`${name} row must be an object`);
  }

  const fields = TABLE_SPECS[name].fields;
  const valueFields = Object.keys(value);
  for (let index = 0; index < valueFields.length; index += 1) {
    const field = valueFields[index]!;
    if (!Object.hasOwn(fields, field)) {
      throw new Error(`${name} row has unknown field ${field}`);
    }
  }

  const fieldEntries = Object.entries(fields);
  for (let index = 0; index < fieldEntries.length; index += 1) {
    const entry = fieldEntries[index]!;
    const field = entry[0];
    const rule = entry[1];
    if (!Object.hasOwn(value, field) && !rule.includes("undefined")) {
      throw new Error(`${name}.${field} is required`);
    }
    const fieldValue = value[field];
    if (!matchesRule(fieldValue, rule)) {
      throw new Error(`${name}.${field} must be ${rule}`);
    }
  }

  return value as DiscordHeroDatasetRow<Name>;
}

type RelationshipKey = string | number;
type RelationshipRow = Readonly<Record<string, unknown>>;

interface RelationshipRule {
  readonly id: string;
  readonly kind: DiscordHeroRelationshipKind;
  readonly sourceTable: DiscordHeroDatasetName;
  readonly sourceField: string;
  readonly targetTable: DiscordHeroDatasetName;
  readonly targetField: string;
  readonly references: (row: RelationshipRow) => readonly RelationshipKey[];
}

function relationshipKey(value: unknown, context: string): RelationshipKey {
  if (
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && value.length > 0)
  ) {
    return value;
  }
  throw new Error(`${context} must contain a string or safe integer key`);
}

function directReferences(
  field: string,
  include: (row: RelationshipRow) => boolean = (row) => row[field] !== null,
): RelationshipRule["references"] {
  return (row) =>
    include(row)
      ? [relationshipKey(row[field], `relationship field ${field}`)]
      : [];
}

function numberListReferences(field: string): RelationshipRule["references"] {
  return (row) => {
    const value = row[field];
    if (value === null) return [];
    if (typeof value === "number") {
      return [relationshipKey(value, `relationship field ${field}`)];
    }
    if (typeof value !== "string" || !/^[1-9]\d*( [1-9]\d*)*$/.test(value)) {
      throw new Error(
        `${field} has an invalid key list ${JSON.stringify(value)}`,
      );
    }
    return arrayMap(value.split(" "), (key) =>
      relationshipKey(Number(key), `relationship field ${field}`),
    );
  };
}

function arrayReferences(field: string): RelationshipRule["references"] {
  return (row) => {
    const value = row[field];
    if (!Array.isArray(value)) {
      throw new Error(`${field} must be an array of relationship keys`);
    }
    return arrayMap(value, (key) =>
      relationshipKey(key, `relationship field ${field}`),
    );
  };
}

function objectArrayReferences(
  field: string,
  keyField: string,
): RelationshipRule["references"] {
  return (row) => {
    const value = row[field];
    if (!Array.isArray(value)) {
      throw new Error(`${field} must be an array of relationship records`);
    }
    return arrayMap(value, (entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`${field}[${index}] must be a relationship record`);
      }
      return relationshipKey(
        entry[keyField],
        `relationship field ${field}[].${keyField}`,
      );
    });
  };
}

function materialReferences(field: string): RelationshipRule["references"] {
  return (row) => {
    const value = row[field];
    if (value === null) return [];
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*_[1-9]\d*( [1-9]\d*_[1-9]\d*)*$/.test(value)
    ) {
      throw new Error(
        `${field} has invalid material references ${JSON.stringify(value)}`,
      );
    }
    return arrayMap(value.split(" "), (token) =>
      relationshipKey(
        Number(token.slice(0, token.indexOf("_"))),
        `relationship field ${field}`,
      ),
    );
  };
}

function weightedReferences(field: string): RelationshipRule["references"] {
  return (row) => {
    const value = row[field];
    if (value === null) return [];
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*_[1-9]\d*( [1-9]\d*_[1-9]\d*)*$/.test(value)
    ) {
      throw new Error(
        `${field} has invalid weighted references ${JSON.stringify(value)}`,
      );
    }
    return arrayMap(value.split(" "), (token) =>
      relationshipKey(
        Number(token.slice(0, token.indexOf("_"))),
        `relationship field ${field}`,
      ),
    );
  };
}

function rule(
  id: string,
  kind: DiscordHeroRelationshipKind,
  sourceTable: DiscordHeroDatasetName,
  sourceField: string,
  targetTable: DiscordHeroDatasetName,
  references: RelationshipRule["references"] = directReferences(sourceField),
  targetField: string = TABLE_SPECS[targetTable].primary,
): RelationshipRule {
  return freeze({
    id,
    kind,
    sourceTable,
    sourceField,
    targetTable,
    targetField,
    references,
  });
}

const RELATIONSHIP_RULES = freeze([
  rule(
    "attributes.HeroKey->heroes",
    "direct",
    "attributes",
    "HeroKey",
    "heroes",
  ),
  rule(
    "attributes.GroupKey->attribute_groups",
    "direct",
    "attributes",
    "GroupKey",
    "attribute_groups",
  ),
  rule(
    "attributes.Value[ACTIVESKILL]->skills",
    "direct",
    "attributes",
    "Value",
    "skills",
    directReferences("Value", (row) => row.ATTRIBUTETYPE === "ACTIVESKILL"),
  ),
  rule(
    "attributes.Value[PASSIVESKILL]->passive_skills",
    "direct",
    "attributes",
    "Value",
    "passive_skills",
    directReferences("Value", (row) => row.ATTRIBUTETYPE === "PASSIVESKILL"),
  ),
  rule(
    "buff_groups.BuffKeys->buffs",
    "multi-key",
    "buff_groups",
    "BuffKeys",
    "buffs",
    numberListReferences("BuffKeys"),
  ),
  rule(
    "crafting_recipes.Material->items",
    "multi-key",
    "crafting_recipes",
    "Material",
    "items",
    materialReferences("Material"),
  ),
  rule(
    "crafting_recipes.DropKey->drops",
    "grouped",
    "crafting_recipes",
    "DropKey",
    "drops",
  ),
  rule(
    "cube_sub_recipes.UnlockCubeLevel->cube_levels",
    "direct",
    "cube_sub_recipes",
    "UnlockCubeLevel",
    "cube_levels",
  ),
  rule(
    "cube_sub_recipes.RECIPETYPE->cube_recipes.RECIPETYPE",
    "direct",
    "cube_sub_recipes",
    "RECIPETYPE",
    "cube_recipes",
    directReferences("RECIPETYPE"),
    "RECIPETYPE",
  ),
  rule(
    "cube_sub_recipes.Material->items",
    "multi-key",
    "cube_sub_recipes",
    "Material",
    "items",
    materialReferences("Material"),
  ),
  rule(
    "cube_sub_recipes.DropKey->drops",
    "grouped",
    "cube_sub_recipes",
    "DropKey",
    "drops",
  ),
  rule(
    "drops.RewardKey[ITEM]->items",
    "direct",
    "drops",
    "RewardKey",
    "items",
    directReferences("RewardKey", (row) => row.REWARDTYPE === "ITEM"),
  ),
  rule(
    "drops.RewardKey[ITEMGROUP]->item_groups",
    "grouped",
    "drops",
    "RewardKey",
    "item_groups",
    directReferences("RewardKey", (row) => row.REWARDTYPE === "ITEMGROUP"),
  ),
  rule(
    "drops.HeroKeyCondition->heroes",
    "direct",
    "drops",
    "HeroKeyCondition",
    "heroes",
    directReferences(
      "HeroKeyCondition",
      (row) => row.HeroKeyCondition !== null && row.HeroKeyCondition !== 0,
    ),
  ),
  rule(
    "gear.UniqueModKey->unique_mods",
    "direct",
    "gear",
    "UniqueModKey",
    "unique_mods",
    directReferences(
      "UniqueModKey",
      (row) => row.UniqueModKey !== null && row.UniqueModKey !== 0,
    ),
  ),
  rule(
    "heroes.MainWeaponGearType->gear_types",
    "direct",
    "heroes",
    "MainWeaponGearType",
    "gear_types",
  ),
  rule(
    "heroes.SubWeaponGearType->gear_types",
    "direct",
    "heroes",
    "SubWeaponGearType",
    "gear_types",
  ),
  rule("heroes.SkillKey->skills", "direct", "heroes", "SkillKey", "skills"),
  rule(
    "heroes.SelectSoundKey->sounds",
    "direct",
    "heroes",
    "SelectSoundKey",
    "sounds",
  ),
  rule(
    "heroes.DeadSoundKey->sounds",
    "direct",
    "heroes",
    "DeadSoundKey",
    "sounds",
  ),
  rule(
    "heroes.attribute_keys->attributes",
    "multi-key",
    "heroes",
    "attribute_keys",
    "attributes",
    arrayReferences("attribute_keys"),
  ),
  rule(
    "item_groups.ItemKey->items",
    "direct",
    "item_groups",
    "ItemKey",
    "items",
  ),
  rule("items.grade->grades", "direct", "items", "grade", "grades"),
  rule(
    "items.gear->gear_type_scales",
    "direct",
    "items",
    "gear",
    "gear_type_scales",
  ),
  rule(
    "items.level->item_level_scales",
    "direct",
    "items",
    "level",
    "item_level_scales",
  ),
  rule(
    "items.type[GEAR|MATERIAL]->item_type_scales",
    "direct",
    "items",
    "type",
    "item_type_scales",
    directReferences(
      "type",
      (row) => row.type === "GEAR" || row.type === "MATERIAL",
    ),
  ),
  rule(
    "items.id[GEAR]->gear",
    "direct",
    "items",
    "id",
    "gear",
    directReferences("id", (row) => row.type === "GEAR"),
  ),
  rule(
    "items.id[MATERIAL]->materials",
    "direct",
    "items",
    "id",
    "materials",
    directReferences("id", (row) => row.type === "MATERIAL"),
  ),
  rule(
    "materials.StatModGroupKey->stat_mod_groups",
    "grouped",
    "materials",
    "StatModGroupKey",
    "stat_mod_groups",
  ),
  rule(
    "monsters.SkillKey->skills",
    "multi-key",
    "monsters",
    "SkillKey",
    "skills",
    numberListReferences("SkillKey"),
  ),
  rule(
    "monsters.DeadSoundKey->sounds",
    "direct",
    "monsters",
    "DeadSoundKey",
    "sounds",
  ),
  rule(
    "monsters.stages[].key->stages",
    "multi-key",
    "monsters",
    "stages[].key",
    "stages",
    objectArrayReferences("stages", "key"),
  ),
  rule(
    "offline_rewards.StageLevel->stage_levels",
    "direct",
    "offline_rewards",
    "StageLevel",
    "stage_levels",
  ),
  rule(
    "pets.StatDataKey->pet_stats",
    "grouped",
    "pets",
    "StatDataKey",
    "pet_stats",
  ),
  rule(
    "pets.Param1[KillMonster]->monsters",
    "direct",
    "pets",
    "Param1",
    "monsters",
    directReferences("Param1", (row) => row.UnlockCondition === "KillMonster"),
  ),
  rule(
    "rune_levels.CostItemKey->currencies",
    "direct",
    "rune_levels",
    "CostItemKey",
    "currencies",
  ),
  rule(
    "runes.NextRuneKey->runes",
    "multi-key",
    "runes",
    "NextRuneKey",
    "runes",
    numberListReferences("NextRuneKey"),
  ),
  rule(
    "runes.PreviewRuneKey->runes",
    "multi-key",
    "runes",
    "PreviewRuneKey",
    "runes",
    numberListReferences("PreviewRuneKey"),
  ),
  rule(
    "runes.LevelDataKey->rune_levels",
    "grouped",
    "runes",
    "LevelDataKey",
    "rune_levels",
  ),
  rule(
    "skills.BuffGroupKey->buff_groups",
    "grouped",
    "skills",
    "BuffGroupKey",
    "buff_groups",
  ),
  rule(
    "skills.SkillLevelKey->skill_levels",
    "grouped",
    "skills",
    "SkillLevelKey",
    "skill_levels",
  ),
  rule(
    "skills.AttributeKey->attributes",
    "direct",
    "skills",
    "AttributeKey",
    "attributes",
  ),
  rule("skills.SoundKey->sounds", "direct", "skills", "SoundKey", "sounds"),
  rule(
    "skins.GroupKeys->skins",
    "multi-key",
    "skins",
    "GroupKeys",
    "skins",
    numberListReferences("GroupKeys"),
  ),
  rule(
    "stages.StageLevel->stage_levels",
    "direct",
    "stages",
    "StageLevel",
    "stage_levels",
  ),
  rule(
    "stages.NextStageKey->stages",
    "direct",
    "stages",
    "NextStageKey",
    "stages",
  ),
  rule(
    "stages.Monsters->monsters",
    "multi-key",
    "stages",
    "Monsters",
    "monsters",
    weightedReferences("Monsters"),
  ),
  rule(
    "stages.MonsterDropItemKey->items",
    "direct",
    "stages",
    "MonsterDropItemKey",
    "items",
  ),
  rule(
    "stages.BossDropItemKey->items",
    "direct",
    "stages",
    "BossDropItemKey",
    "items",
  ),
  rule(
    "stages.FirstClearDropKey->drops",
    "grouped",
    "stages",
    "FirstClearDropKey",
    "drops",
  ),
  rule(
    "stages.BossMonsterKey->monsters",
    "direct",
    "stages",
    "BossMonsterKey",
    "monsters",
  ),
  rule(
    "stages.SoulstoneItemKey->items",
    "direct",
    "stages",
    "SoulstoneItemKey",
    "items",
  ),
  rule(
    "stages.BGMSoundKey->sounds",
    "direct",
    "stages",
    "BGMSoundKey",
    "sounds",
  ),
  rule(
    "stat_mod_groups.StatModKey->stat_mods",
    "grouped",
    "stat_mod_groups",
    "StatModKey",
    "stat_mods",
  ),
  rule(
    "status_effects.BuffKeys->buffs",
    "multi-key",
    "status_effects",
    "BuffKeys",
    "buffs",
    numberListReferences("BuffKeys"),
  ),
  rule(
    "synthesis_drops.GRADE->grades",
    "direct",
    "synthesis_drops",
    "GRADE",
    "grades",
  ),
  rule(
    "synthesis_drops.DropKey->drops",
    "grouped",
    "synthesis_drops",
    "DropKey",
    "drops",
  ),
  rule(
    "synthesis_recipes.GRADE->grades",
    "direct",
    "synthesis_recipes",
    "GRADE",
    "grades",
  ),
  rule(
    "unique_mods.Param1[Skill*]->skills",
    "direct",
    "unique_mods",
    "Param1",
    "skills",
    directReferences(
      "Param1",
      (row) =>
        typeof row.UniqueMod === "string" && row.UniqueMod.startsWith("Skill"),
    ),
  ),
] satisfies readonly RelationshipRule[]);

const MONSTER_SKILL_SOURCE_LIMITATIONS = [
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

const LEVEL_100_ITEM_SOURCE_LIMITATIONS = [
  300020, 310020, 320020, 330020, 340020, 350020, 400020, 410020, 420020,
  430020, 440020, 450020, 500020, 510020, 520020, 530020,
] as const;

const MISSING_MONSTER_STAGE_SOURCE_LIMITATIONS = [
  1208, 1209, 2208, 2209, 3208, 3209, 4208, 4209,
] as const;

function unresolvedReference(
  reference: DiscordHeroUnresolvedReference,
): DiscordHeroUnresolvedReference {
  return freeze(reference);
}

const EXPECTED_UNRESOLVED_REFERENCES = freeze([
  unresolvedReference({
    ruleId: "buff_groups.BuffKeys->buffs",
    sourceTable: "buff_groups",
    sourceField: "BuffKeys",
    sourceKey: 20601,
    targetTable: "buffs",
    targetKey: 206011,
    reason: "source buff key is absent from the buffs table",
  }),
  ...arrayMap(LEVEL_100_ITEM_SOURCE_LIMITATIONS, (sourceKey) =>
    unresolvedReference({
      ruleId: "items.level->item_level_scales",
      sourceTable: "items",
      sourceField: "level",
      sourceKey,
      targetTable: "item_level_scales",
      targetKey: 100,
      reason:
        "source documentation defines no level-100 scale and uses factor 1",
    }),
  ),
  ...arrayMap(MONSTER_SKILL_SOURCE_LIMITATIONS, ([sourceKey, targetKey]) =>
    unresolvedReference({
      ruleId: "monsters.SkillKey->skills",
      sourceTable: "monsters",
      sourceField: "SkillKey",
      sourceKey,
      targetTable: "skills",
      targetKey,
      reason:
        "exact numeric reference does not match the trailing-space skill key",
    }),
  ),
  ...arrayMap(MISSING_MONSTER_STAGE_SOURCE_LIMITATIONS, (sourceKey) =>
    unresolvedReference({
      ruleId: "stages.Monsters->monsters",
      sourceTable: "stages",
      sourceField: "Monsters",
      sourceKey,
      targetTable: "monsters",
      targetKey: 20101,
      reason: "source stage references absent monster 20101",
    }),
  ),
]);

const EXACT_CONDITIONAL_DISCRIMINATORS = freeze([
  freeze({
    table: "attributes",
    field: "ATTRIBUTETYPE",
    values: freeze(["PASSIVESKILL", "ACTIVESKILL"]),
  }),
  freeze({
    table: "drops",
    field: "REWARDTYPE",
    values: freeze(["ITEMGROUP", "ITEM"]),
  }),
  freeze({
    table: "items",
    field: "type",
    values: freeze(["STAGEBOX", "MATERIAL", "GEAR"]),
  }),
  freeze({
    table: "pets",
    field: "UnlockCondition",
    values: freeze(["KillMonster", "DLC"]),
  }),
] satisfies readonly {
  readonly table: DiscordHeroDatasetName;
  readonly field: string;
  readonly values: readonly string[];
}[]);

function validateConditionalDiscriminators(
  tables: DiscordHeroCatalogTables,
): void {
  for (
    let discriminatorIndex = 0;
    discriminatorIndex < EXACT_CONDITIONAL_DISCRIMINATORS.length;
    discriminatorIndex += 1
  ) {
    const discriminator = EXACT_CONDITIONAL_DISCRIMINATORS[discriminatorIndex]!;
    const rows = tables[discriminator.table].rows as readonly RelationshipRow[];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!;
      const value = row[discriminator.field];
      if (typeof value !== "string" || !discriminator.values.includes(value)) {
        throw new Error(
          `${discriminator.table}.${discriminator.field} has unknown discriminator ${formatKey(
            relationshipKey(
              value,
              `${discriminator.table}.${discriminator.field}`,
            ),
          )}`,
        );
      }
    }
  }
}

interface MonsterStageProjection {
  readonly key: number;
  readonly act: number;
  readonly no: number;
  readonly level: number;
  readonly difficulty: string;
  readonly type: string;
  readonly boss: boolean;
  readonly spawnPct: number;
  readonly perClear: number;
}

const MONSTER_STAGE_PROJECTION_FIELDS = freeze([
  "key",
  "act",
  "no",
  "level",
  "difficulty",
  "type",
  "boss",
  "spawnPct",
  "perClear",
] satisfies readonly (keyof MonsterStageProjection)[]);

function roundHalfToEven(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}

function sameMonsterStageProjection(
  actual: unknown,
  expected: MonsterStageProjection,
): boolean {
  if (!isRecord(actual)) return false;
  const fields = Object.keys(actual);
  return (
    fields.length === MONSTER_STAGE_PROJECTION_FIELDS.length &&
    MONSTER_STAGE_PROJECTION_FIELDS.every(
      (field) =>
        Object.hasOwn(actual, field) && actual[field] === expected[field],
    )
  );
}

function validateMonsterStageReverseProjection(
  tables: DiscordHeroCatalogTables,
): void {
  const monsters = tables.monsters.rows as readonly RelationshipRow[];
  const expectedByMonster = new NativeMap<number, MonsterStageProjection[]>();
  for (
    let monsterIndex = 0;
    monsterIndex < monsters.length;
    monsterIndex += 1
  ) {
    const monster = monsters[monsterIndex]!;
    const monsterKey = relationshipKey(
      monster.MonsterKey,
      "monsters.MonsterKey",
    );
    if (typeof monsterKey !== "number") {
      throw new Error("monsters.MonsterKey must be numeric");
    }
    mapSet(expectedByMonster, monsterKey, []);
  }

  const stages = tables.stages.rows as readonly RelationshipRow[];
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex]!;
    const stageKey = relationshipKey(stage.StageKey, "stages.StageKey");
    if (typeof stageKey !== "number") {
      throw new Error("stages.StageKey must be numeric");
    }
    const value = stage.Monsters;
    if (
      value !== null &&
      (typeof value !== "string" ||
        !/^[1-9]\d*_[1-9]\d*( [1-9]\d*_[1-9]\d*)*$/.test(value))
    ) {
      throw new Error(
        `stages.Monsters has invalid weighted references ${JSON.stringify(value)}`,
      );
    }
    const weightedMonsters =
      value === null
        ? []
        : arrayMap(value.split(" "), (token) => {
            const separator = token.indexOf("_");
            return {
              key: Number(token.slice(0, separator)),
              weight: Number(token.slice(separator + 1)),
            };
          });
    const totalWeight = weightedMonsters.reduce(
      (total, monster) => total + monster.weight,
      0,
    );
    const shared = {
      key: stageKey,
      act: stage.Act as number,
      no: stage.StageNo as number,
      level: stage.StageLevel as number,
      difficulty: stage.STAGEDIFFICULITY as string,
      type: stage.STAGETYPE as string,
    };

    for (
      let weightedIndex = 0;
      weightedIndex < weightedMonsters.length;
      weightedIndex += 1
    ) {
      const monster = weightedMonsters[weightedIndex]!;
      const expected = mapGet(expectedByMonster, monster.key);
      if (expected === undefined) continue;
      appendArray(expected, {
        ...shared,
        boss: false,
        spawnPct: roundHalfToEven((monster.weight / totalWeight) * 1_000) / 10,
        perClear: roundHalfToEven(
          ((stage.WaveAmount as number) *
            (stage.WaveMonsterAmount as number) *
            monster.weight) /
            totalWeight,
        ),
      });
    }

    const bossKey = relationshipKey(
      stage.BossMonsterKey,
      "stages.BossMonsterKey",
    );
    if (typeof bossKey !== "number") {
      throw new Error("stages.BossMonsterKey must be numeric");
    }
    const expectedBossStages = mapGet(expectedByMonster, bossKey);
    if (expectedBossStages !== undefined) {
      appendArray(expectedBossStages, {
        ...shared,
        boss: true,
        spawnPct: 100,
        perClear: 1,
      });
    }
  }

  for (
    let monsterIndex = 0;
    monsterIndex < monsters.length;
    monsterIndex += 1
  ) {
    const monster = monsters[monsterIndex]!;
    const monsterKey = monster.MonsterKey as number;
    const actual = monster.stages;
    const expected = mapGet(expectedByMonster, monsterKey)!;
    if (
      !Array.isArray(actual) ||
      actual.length !== expected.length ||
      !actual.every((entry, index) =>
        sameMonsterStageProjection(entry, expected[index]!),
      )
    ) {
      throw new Error(
        `monsters.stages is not the exact reverse stage projection for monster ${monsterKey}`,
      );
    }
  }
}

function unresolvedSignature(reference: {
  readonly ruleId: string;
  readonly sourceKey: RelationshipKey;
  readonly targetKey: RelationshipKey;
}): string {
  return JSON.stringify([
    reference.ruleId,
    reference.sourceKey,
    reference.targetKey,
  ]);
}

function createSemanticRelationshipReport(
  tables: DiscordHeroCatalogTables,
): DiscordHeroSemanticRelationshipReport {
  validateConditionalDiscriminators(tables);

  const expectedBySignature = new NativeMap<
    string,
    DiscordHeroUnresolvedReference
  >();
  for (
    let expectedIndex = 0;
    expectedIndex < EXPECTED_UNRESOLVED_REFERENCES.length;
    expectedIndex += 1
  ) {
    const reference = EXPECTED_UNRESOLVED_REFERENCES[expectedIndex]!;
    mapSet(expectedBySignature, unresolvedSignature(reference), reference);
  }
  const seenExpected = new NativeSet<string>();
  const unresolvedReferences: DiscordHeroUnresolvedReference[] = [];
  const ruleReports: DiscordHeroRelationshipRuleReport[] = [];
  let checkedReferenceCount = 0;

  for (
    let relationshipIndex = 0;
    relationshipIndex < RELATIONSHIP_RULES.length;
    relationshipIndex += 1
  ) {
    const relationship = RELATIONSHIP_RULES[relationshipIndex]!;
    const sourceRows = tables[relationship.sourceTable]
      .rows as readonly (RelationshipRow & JsonObject)[];
    const targetTable = tables[relationship.targetTable];
    const targetGroups = targetTable.groups as ReadonlyMap<
      RelationshipKey,
      readonly unknown[]
    >;
    const targetUsesPrimaryField =
      relationship.targetField === targetTable.primaryField;
    const targetRows = targetTable.rows as readonly RelationshipRow[];
    const primaryField = TABLE_SPECS[relationship.sourceTable].primary;
    let ruleReferenceCount = 0;
    let ruleUnresolvedCount = 0;

    for (
      let sourceRowIndex = 0;
      sourceRowIndex < sourceRows.length;
      sourceRowIndex += 1
    ) {
      const row = sourceRows[sourceRowIndex]!;
      const sourceKey = relationshipKey(
        row[primaryField],
        `${relationship.sourceTable}.${primaryField}`,
      );
      const targetKeys = relationship.references(row);
      for (
        let targetKeyIndex = 0;
        targetKeyIndex < targetKeys.length;
        targetKeyIndex += 1
      ) {
        const targetKey = targetKeys[targetKeyIndex]!;
        ruleReferenceCount += 1;
        checkedReferenceCount += 1;
        const targetExists = targetUsesPrimaryField
          ? targetGroups.has(targetKey)
          : targetRows.some(
              (targetRow) => targetRow[relationship.targetField] === targetKey,
            );
        if (targetExists) continue;

        const signature = unresolvedSignature({
          ruleId: relationship.id,
          sourceKey,
          targetKey,
        });
        const expected = mapGet(expectedBySignature, signature);
        if (expected === undefined) {
          const targetDescription = targetUsesPrimaryField
            ? `${relationship.targetTable} key`
            : `${relationship.targetTable}.${relationship.targetField} value`;
          throw new Error(
            `${relationship.sourceTable}.${relationship.sourceField} ` +
              `references unknown ${targetDescription} ${formatKey(targetKey)}`,
          );
        }
        if (setHas(seenExpected, signature)) {
          throw new Error(
            `duplicate expected unresolved relationship ${signature}`,
          );
        }
        setAdd(seenExpected, signature);
        appendArray(unresolvedReferences, expected);
        ruleUnresolvedCount += 1;
      }
    }

    appendArray(
      ruleReports,
      freeze({
        id: relationship.id,
        kind: relationship.kind,
        sourceTable: relationship.sourceTable,
        sourceField: relationship.sourceField,
        targetTable: relationship.targetTable,
        targetField: relationship.targetField,
        checkedReferenceCount: ruleReferenceCount,
        unresolvedReferenceCount: ruleUnresolvedCount,
      }),
    );
  }

  const missingExpected = EXPECTED_UNRESOLVED_REFERENCES.find(
    (reference) => !setHas(seenExpected, unresolvedSignature(reference)),
  );
  if (missingExpected !== undefined) {
    throw new Error(
      `expected unresolved relationship changed: ${unresolvedSignature(missingExpected)}`,
    );
  }

  validateMonsterStageReverseProjection(tables);

  const tableReports = arrayMap(DISCORD_HERO_DATASET_NAMES, (name) =>
    freeze({
      name,
      outgoingRuleIds: freeze(
        arrayMap(
          RELATIONSHIP_RULES.filter((value) => value.sourceTable === name),
          (value) => value.id,
        ),
      ),
      incomingRuleIds: freeze(
        arrayMap(
          RELATIONSHIP_RULES.filter((value) => value.targetTable === name),
          (value) => value.id,
        ),
      ),
    }),
  );
  const unresolvedReferenceCount = unresolvedReferences.length;

  return freeze({
    tableCount: DISCORD_HERO_DATASET_NAMES.length,
    ruleCount: RELATIONSHIP_RULES.length,
    checkedReferenceCount,
    resolvedReferenceCount: checkedReferenceCount - unresolvedReferenceCount,
    unresolvedReferenceCount,
    rules: freeze(ruleReports),
    tables: freeze(tableReports),
    unresolvedReferences: freeze(unresolvedReferences),
  });
}

export function buildCatalogIndexes(
  catalog: LoadedDiscordHeroCatalog,
): DiscordHeroCatalogIndexes {
  assertCatalogIndexConstructionIntrinsics();
  const identities = arrayMap(catalog.datasets, (dataset) => dataset.name);
  if (!sameStrings(identities, DISCORD_HERO_DATASET_NAMES)) {
    throw new Error(
      "catalog dataset identities must exactly match all 45 tables",
    );
  }

  const tables = { __proto__: null } as Partial<
    Record<DiscordHeroDatasetName, unknown>
  >;
  for (
    let datasetIndex = 0;
    datasetIndex < catalog.datasets.length;
    datasetIndex += 1
  ) {
    const dataset = catalog.datasets[datasetIndex]!;
    const name = dataset.name as DiscordHeroDatasetName;
    const spec: TableSpec = TABLE_SPECS[name];
    const fields = Object.keys(spec.fields);
    if (!sameStrings(dataset.columns, fields)) {
      throw new Error(`${name} columns do not match its runtime row parser`);
    }
    if (dataset.rows.length !== EXPECTED_DATASET_ROWS[name]) {
      throw new Error(
        `${name} must contain ${EXPECTED_DATASET_ROWS[name]} rows`,
      );
    }

    const rows = arrayMap(dataset.rows, (row) => parseCatalogRow(name, row));
    const groups = new NativeMap<
      string | number,
      DiscordHeroDatasetRow<typeof name>[]
    >();
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!;
      const key = row[spec.primary as keyof typeof row];
      if (
        (typeof key !== "number" || !Number.isSafeInteger(key)) &&
        typeof key !== "string"
      ) {
        throw new Error(
          `${name}.${spec.primary} must be a string or safe integer`,
        );
      }
      const existing = mapGet(groups, key) ?? [];
      if (spec.keyMode !== "grouped" && existing.length > 0) {
        throw new Error(
          `${name}.${spec.primary} must be unique; duplicate key ${formatKey(key)}`,
        );
      }
      appendArray(existing, row);
      mapSet(groups, key, existing);
    }
    for (const group of mapValues(groups)) freeze(group);

    tables[name] = freeze({
      name,
      primaryField: spec.primary,
      rows: freeze(rows),
      groups: new RuntimeReadonlyMap(groups),
    });
  }

  if (!sameStrings(Object.keys(tables), DISCORD_HERO_DATASET_NAMES)) {
    throw new Error(
      "catalog table identities must exactly match all 45 tables",
    );
  }
  const catalogTables = freeze(tables) as DiscordHeroCatalogTables;
  const semanticReport = createSemanticRelationshipReport(catalogTables);

  const indexes = freeze({
    catalog,
    tables: catalogTables,
    semanticReport,
  });
  if (isLoadedDiscordHeroCatalogAuthority(catalog)) {
    weakSetAdd(catalogIndexAuthorities, indexes);
  }
  return indexes;
}

export function getCatalogGroup<Name extends DiscordHeroDatasetName>(
  indexes: DiscordHeroCatalogIndexes,
  name: Name,
  key: DiscordHeroDatasetKey<Name>,
): readonly DiscordHeroDatasetRow<Name>[] {
  const group = indexes.tables[name].groups.get(key);
  if (group === undefined) {
    throw new Error(`${name} has no rows for key ${formatKey(key)}`);
  }
  return group;
}

export function getCatalogRow<Name extends DiscordHeroDatasetName>(
  indexes: DiscordHeroCatalogIndexes,
  name: Name,
  key: DiscordHeroDatasetKey<Name>,
): DiscordHeroDatasetRow<Name> {
  const group = indexes.tables[name].groups.get(key);
  if (group === undefined || group.length !== 1) {
    throw new Error(`${name} has no unique row for key ${formatKey(key)}`);
  }
  return group[0]!;
}

export function getLocalizedCatalogName<
  Name extends LocalizedDiscordHeroDataset,
>(
  indexes: DiscordHeroCatalogIndexes,
  name: Name,
  key: DiscordHeroDatasetKey<Name>,
  locale: DiscordHeroLocale,
): string {
  const row = getCatalogRow(indexes, name, key) as LoadedJsonObject;
  const localized = row[LOCALIZED_NAME_FIELDS[name]];
  const value =
    isRecord(localized) && typeof localized[locale] === "string"
      ? localized[locale]
      : undefined;
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} key ${String(key)} has no ${locale} localized name`,
    );
  }
  return value;
}
