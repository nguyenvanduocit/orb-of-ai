import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";
import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";

const SOUND_FIELDS = [
  "SoundKey",
  "SoundType",
  "Volume",
  "AudioClipPath",
] as const;

const HERO_FIELDS = [
  "HeroKey",
  "HeroNameKey",
  "HeroNameKey_i18n",
  "DescriptionKey",
  "DescriptionKey_i18n",
  "ClassType",
  "MainWeaponGearType",
  "SubWeaponGearType",
  "SkillKey",
  "AttackDamage",
  "AttackSpeed",
  "CastSpeed",
  "CriticalChance",
  "CriticalDamage",
  "MaxHp",
  "Armor",
  "CooldownReduction",
  "MovementSpeed",
  "UnlockCost",
  "IsAvailable",
  "IsFirstAvailable",
  "SelectSoundKey",
  "DeadSoundKey",
  "DLCAppId",
  "DLCBitIndex",
  "HasDLCDrop",
  "IconPath",
  "DeadIconPath",
  "PrefabPath",
  "AnimatorPath",
  "icon",
  "dead_icon",
  "animations_folder",
  "skill_name_i18n",
  "attribute_keys",
  "attributes",
] as const;

const MONSTER_FIELDS = [
  "MonsterKey",
  "MonsterNameStringKey",
  "MonsterNameStringKey_i18n",
  "MONSTERTYPE",
  "RewardGold",
  "RewardExp",
  "SkillKey",
  "AttackDamage",
  "AttackSpeed",
  "MaxLife",
  "MovementSpeed",
  "DeadSoundKey",
  "PrefabPath",
  "AnimatorPath",
  "portrait",
  "sprite_folder",
  "skill_name_i18n",
  "attack",
  "attacks",
  "attackElements",
  "stages",
] as const;

const OPTIONAL_MONSTER_FIELDS = new Set([
  "attack",
  "attacks",
  "attackElements",
]);

const SKILL_FIELDS = [
  "SkillKey",
  "SkillNameKey",
  "SkillDescriptionKey",
  "ACTIVATIONTYPE",
  "ActivationValue",
  "SLOTTYPE",
  "SkillBuffType",
  "BuffGroupKey",
  "Param1",
  "Param2",
  "Param3",
  "Param4",
  "Param5",
  "Range",
  "Order",
  "DamageType",
  "DamageDeliveryType",
  "Value",
  "SkillLevelKey",
  "AnimClipPath1",
  "AnimClipPath2",
  "AnimClipPath3",
  "AttributeKey",
  "SoundKey",
  "levels",
  "SkillNameKey_i18n",
  "SkillDescriptionKey_i18n",
] as const;

const OPTIONAL_SKILL_FIELDS = new Set([
  "SkillNameKey_i18n",
  "SkillDescriptionKey_i18n",
]);

const STAGE_FIELDS = [
  "StageKey",
  "StageNameKey",
  "StageNameKey_i18n",
  "STAGETYPE",
  "STAGEDIFFICULITY",
  "Act",
  "StageNo",
  "StageLevel",
  "NextStageKey",
  "WaveAmount",
  "WaveMonsterAmount",
  "Monsters",
  "MonsterDropItemKey",
  "MonsterDropItemRate",
  "BossDropItemKey",
  "BossDropItemRate",
  "FirstClearDropKey",
  "BossMonsterKey",
  "BossDamageMultiplier",
  "BossHpMultiplier",
  "BossGoldMultiplier",
  "BossExpMultiplier",
  "BossScale",
  "SoulstoneItemKey",
  "SoulstoneAmount",
  "IsDemo",
  "BGMSoundKey",
] as const;

const EXPECTED_ROWS = {
  sounds: 312,
  heroes: 6,
  monsters: 61,
  skills: 106,
  stages: 120,
} as const;

const PINNED_SOURCE_SHA256 = {
  sounds: "4e6229859b1a6768634d76ce67dd4bf9b3d032b0f36cc24beb9251c201da2df7",
  heroes: "e1b98b04abb93943f1d32253e5fb0ca4c5bdfda639940fb38863299fd67c07f6",
  monsters: "61a4995eba04d9f5d28e02ca47745379d1348596790998d01cb70cc8a73f5997",
  skills: "9bbefc7a1c12db0641efbf82c371af46d4eee1da1685ee1590d84e78d387b946",
  stages: "34eaf4ab749d7eec088b26483a87803c9b00fe145636b8a84dae54b81a7b6eca",
} as const;

const SOUND_TYPES = new Set(["BattleLog", "BGM", "GameSFX", "UI_SFX"]);

type SourceTable = "heroes" | "monsters" | "skills" | "stages";
type SourceField =
  "SelectSoundKey" | "DeadSoundKey" | "SoundKey" | "BGMSoundKey";

interface TrustedSoundRow {
  readonly SoundKey: number;
  readonly SoundType: string;
}

interface TrustedHeroRow {
  readonly HeroKey: number;
  readonly SelectSoundKey: number;
  readonly DeadSoundKey: number;
}

interface TrustedMonsterRow {
  readonly MonsterKey: number;
  readonly DeadSoundKey: number;
}

interface TrustedSkillRow {
  readonly SkillKey: number | string;
  readonly SoundKey: number | null;
}

interface TrustedStageRow {
  readonly StageKey: number;
  readonly BGMSoundKey: number;
}

export interface SourceSoundTopologyInput {
  readonly indexes: DiscordHeroCatalogIndexes;
}

export interface SourceSoundTopologyCounts {
  readonly sounds: 312;
  readonly soundTypes: Readonly<{
    readonly BattleLog: 2;
    readonly BGM: 17;
    readonly GameSFX: 199;
    readonly UI_SFX: 94;
  }>;
  readonly references: 297;
  readonly heroSelectReferences: 6;
  readonly heroDeadReferences: 6;
  readonly monsterDeadReferences: 61;
  readonly skillReferences: 104;
  readonly stageBgmReferences: 120;
  readonly referencedSounds: 173;
  readonly sourceUnreferencedSounds: 139;
  readonly unresolvedReferences: 0;
}

export interface SourceSoundReference {
  readonly sourceTable: SourceTable;
  readonly sourceField: SourceField;
  readonly sourceRowIndex: number;
  readonly sourceKey: number | string;
  readonly soundKey: number;
  readonly soundTypeRaw: string;
}

export interface SourceSoundProvenance {
  readonly table: "sounds";
  readonly primaryField: "SoundKey";
  readonly primaryKey: number;
  readonly typeField: "SoundType";
  readonly rowIndex: number;
}

export interface SourceSound {
  readonly soundKey: number;
  readonly soundTypeRaw: string;
  readonly referenced: boolean;
  readonly provenance: SourceSoundProvenance;
  readonly incomingReferences: readonly SourceSoundReference[];
}

export interface SourceUnreferencedSound {
  readonly soundKey: number;
  readonly soundTypeRaw: string;
}

export interface SourceSoundTopology {
  readonly counts: SourceSoundTopologyCounts;
  readonly sounds: readonly SourceSound[];
  readonly references: readonly SourceSoundReference[];
  readonly sourceUnreferencedSounds: readonly SourceUnreferencedSound[];
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value);
    }
  }
  return value;
}

function assertNotProxy(value: unknown, label: string): void {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    nodeUtilTypes.isProxy(value)
  ) {
    throw new Error(`${label} must not be a proxy or TOCTOU-capable object`);
  }
}

function snapshotExactOwnDataObject(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Record<string, unknown> {
  assertNotProxy(value, label);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const unknownFields = actualFields.filter(
    (field) => !expectedFields.includes(field),
  );
  if (unknownFields.length > 0) {
    throw new Error(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !actualFields.includes(field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }

  const snapshot: Record<string, unknown> = {};
  for (const field of expectedFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label}.${field} must be an own data property`);
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function snapshotArray(
  value: unknown,
  label: string,
  expectedRows?: Readonly<{
    table: string;
    count: number;
  }>,
): readonly unknown[] {
  assertNotProxy(value, label);
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new Error(`${label} must use Array.prototype`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new Error(`${label}.length must be an own non-negative safe integer`);
  }
  const length = lengthDescriptor.value as number;
  if (expectedRows !== undefined && length !== expectedRows.count) {
    throw new Error(
      `${expectedRows.table} must contain exactly ${expectedRows.count} source rows`,
    );
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const extraKey = (ownKeys as string[]).find((key) => {
    if (key === "length") return false;
    const index = Number(key);
    return (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= length ||
      String(index) !== key
    );
  });
  if (extraKey !== undefined) {
    throw new Error(`${label} has unexpected own key ${extraKey}`);
  }
  if (ownKeys.length !== length + 1) {
    throw new Error(`${label} has one or more sparse holes`);
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      throw new Error(`${label} has a sparse hole at index ${index}`);
    }
    if (
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label}[${index}] must be an own data property`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function deepSnapshotOwnData(
  value: unknown,
  label: string,
  ancestors = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be finite`);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error(`${label} integer must be safe`);
    }
    return value;
  }
  assertNotProxy(value, label);
  if (typeof value !== "object") {
    throw new Error(`${label} must contain JSON own data only`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${label} must not contain cycles`);
  }
  if (depth > 64) {
    throw new Error(`${label} nested depth exceeds 64`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return snapshotArray(value, label).map((entry, index) =>
        deepSnapshotOwnData(entry, `${label}[${index}]`, ancestors, depth + 1),
      );
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        `${label} nested prototype must be Object.prototype or null`,
      );
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      throw new Error(
        `${label} nested object must not contain symbol own keys`,
      );
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        typeof descriptor.get === "function" ||
        typeof descriptor.set === "function"
      ) {
        throw new Error(`${label}.${key} must be a nested own data property`);
      }
      snapshot[key] = deepSnapshotOwnData(
        descriptor.value,
        `${label}.${key}`,
        ancestors,
        depth + 1,
      );
    }
    return snapshot;
  } finally {
    ancestors.delete(value);
  }
}

function snapshotRow(
  value: unknown,
  fields: readonly string[],
  optionalFields: ReadonlySet<string>,
  label: string,
): Record<string, unknown> {
  assertNotProxy(value, label);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} prototype must be Object.prototype or null`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} must not contain symbol own keys`);
  }
  const actualFields = ownKeys as string[];
  const unknownFields = actualFields.filter((field) => !fields.includes(field));
  if (unknownFields.length > 0) {
    throw new Error(`${label} has unknown field ${unknownFields[0]}`);
  }
  const missingFields = fields.filter(
    (field) => !optionalFields.has(field) && !actualFields.includes(field),
  );
  if (missingFields.length > 0) {
    throw new Error(`${label} is missing field ${missingFields[0]}`);
  }

  const snapshot: Record<string, unknown> = {};
  for (const field of fields) {
    if (!actualFields.includes(field)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.get === "function" ||
      typeof descriptor.set === "function"
    ) {
      throw new Error(`${label}.${field} must be an own data property`);
    }
    snapshot[field] = deepSnapshotOwnData(
      descriptor.value,
      `${label}.${field}`,
    );
  }
  return snapshot;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function sourceKey(value: unknown, label: string): number | string {
  if (
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === "string" && value.length > 0)
  ) {
    return value;
  }
  throw new Error(
    `${label} must be a non-empty string or positive safe integer`,
  );
}

function nullablePositiveSafeInteger(
  value: unknown,
  label: string,
): number | null {
  return value === null ? null : positiveSafeInteger(value, label);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertPinned(
  value: unknown,
  table: keyof typeof PINNED_SOURCE_SHA256,
): void {
  if (sha256(value) !== PINNED_SOURCE_SHA256[table]) {
    throw new Error(`${table} do not match the pinned source order and values`);
  }
}

function snapshotTrustedTables(indexesValue: unknown): {
  readonly sounds: readonly TrustedSoundRow[];
  readonly heroes: readonly TrustedHeroRow[];
  readonly monsters: readonly TrustedMonsterRow[];
  readonly skills: readonly TrustedSkillRow[];
  readonly stages: readonly TrustedStageRow[];
} {
  const indexes = snapshotExactOwnDataObject(
    indexesValue,
    ["catalog", "tables", "semanticReport"],
    "source sound topology indexes",
  );
  const tables = snapshotExactOwnDataObject(
    indexes.tables,
    DISCORD_HERO_DATASET_NAMES,
    "source sound topology indexes.tables",
  );

  const snapshotTable = (
    name: keyof typeof EXPECTED_ROWS,
    primaryField: string,
  ): readonly unknown[] => {
    const table = snapshotExactOwnDataObject(
      tables[name],
      ["name", "primaryField", "rows", "groups"],
      `source sound topology indexes.tables.${name}`,
    );
    if (table.name !== name) {
      throw new Error(
        `source sound topology indexes.tables.${name}.name must be ${name}`,
      );
    }
    if (table.primaryField !== primaryField) {
      throw new Error(
        `source sound topology indexes.tables.${name}.primaryField must be ${primaryField}`,
      );
    }
    const rows = snapshotArray(
      table.rows,
      `source sound topology indexes.tables.${name}.rows`,
      { table: name, count: EXPECTED_ROWS[name] },
    );
    return rows;
  };

  const sounds = snapshotTable("sounds", "SoundKey").map(
    (value, rowIndex): TrustedSoundRow => {
      const row = snapshotRow(
        value,
        SOUND_FIELDS,
        new Set(),
        `sounds row ${rowIndex}`,
      );
      const soundType = row.SoundType;
      if (typeof soundType !== "string" || !SOUND_TYPES.has(soundType)) {
        throw new Error(`sounds row ${rowIndex}.SoundType has unknown type`);
      }
      return {
        SoundKey: positiveSafeInteger(
          row.SoundKey,
          `sounds row ${rowIndex}.SoundKey`,
        ),
        SoundType: soundType,
      };
    },
  );
  const heroes = snapshotTable("heroes", "HeroKey").map(
    (value, rowIndex): TrustedHeroRow => {
      const row = snapshotRow(
        value,
        HERO_FIELDS,
        new Set(),
        `heroes row ${rowIndex}`,
      );
      return {
        HeroKey: positiveSafeInteger(
          row.HeroKey,
          `heroes row ${rowIndex}.HeroKey`,
        ),
        SelectSoundKey: positiveSafeInteger(
          row.SelectSoundKey,
          `heroes row ${rowIndex}.SelectSoundKey`,
        ),
        DeadSoundKey: positiveSafeInteger(
          row.DeadSoundKey,
          `heroes row ${rowIndex}.DeadSoundKey`,
        ),
      };
    },
  );
  const monsters = snapshotTable("monsters", "MonsterKey").map(
    (value, rowIndex): TrustedMonsterRow => {
      const row = snapshotRow(
        value,
        MONSTER_FIELDS,
        OPTIONAL_MONSTER_FIELDS,
        `monsters row ${rowIndex}`,
      );
      return {
        MonsterKey: positiveSafeInteger(
          row.MonsterKey,
          `monsters row ${rowIndex}.MonsterKey`,
        ),
        DeadSoundKey: positiveSafeInteger(
          row.DeadSoundKey,
          `monsters row ${rowIndex}.DeadSoundKey`,
        ),
      };
    },
  );
  const skills = snapshotTable("skills", "SkillKey").map(
    (value, rowIndex): TrustedSkillRow => {
      const row = snapshotRow(
        value,
        SKILL_FIELDS,
        OPTIONAL_SKILL_FIELDS,
        `skills row ${rowIndex}`,
      );
      return {
        SkillKey: sourceKey(row.SkillKey, `skills row ${rowIndex}.SkillKey`),
        SoundKey: nullablePositiveSafeInteger(
          row.SoundKey,
          `skills row ${rowIndex}.SoundKey`,
        ),
      };
    },
  );
  const stages = snapshotTable("stages", "StageKey").map(
    (value, rowIndex): TrustedStageRow => {
      const row = snapshotRow(
        value,
        STAGE_FIELDS,
        new Set(),
        `stages row ${rowIndex}`,
      );
      return {
        StageKey: positiveSafeInteger(
          row.StageKey,
          `stages row ${rowIndex}.StageKey`,
        ),
        BGMSoundKey: positiveSafeInteger(
          row.BGMSoundKey,
          `stages row ${rowIndex}.BGMSoundKey`,
        ),
      };
    },
  );

  const seenSoundKeys = new Set<number>();
  for (const row of sounds) {
    if (seenSoundKeys.has(row.SoundKey)) {
      throw new Error(`sounds contains duplicate SoundKey ${row.SoundKey}`);
    }
    seenSoundKeys.add(row.SoundKey);
  }

  assertPinned(sounds, "sounds");

  return { sounds, heroes, monsters, skills, stages };
}

export function projectSourceSoundTopology(
  inputValue: SourceSoundTopologyInput,
): SourceSoundTopology {
  const input = snapshotExactOwnDataObject(
    inputValue,
    ["indexes"],
    "source sound topology input",
  );
  const trusted = snapshotTrustedTables(input.indexes);

  const typeBySoundKey = new Map(
    trusted.sounds.map((sound) => [sound.SoundKey, sound.SoundType] as const),
  );
  const references: SourceSoundReference[] = [];

  const addReference = (
    sourceTable: SourceTable,
    sourceField: SourceField,
    sourceRowIndex: number,
    sourceKeyValue: number | string,
    soundKey: number,
  ): void => {
    const soundTypeRaw = typeBySoundKey.get(soundKey);
    if (soundTypeRaw === undefined) {
      throw new Error(
        `${sourceTable}.${sourceField} row ${sourceRowIndex} has dangling sound reference ${soundKey}`,
      );
    }
    references.push({
      sourceTable,
      sourceField,
      sourceRowIndex,
      sourceKey: sourceKeyValue,
      soundKey,
      soundTypeRaw,
    });
  };

  trusted.heroes.forEach((hero, rowIndex) => {
    addReference(
      "heroes",
      "SelectSoundKey",
      rowIndex,
      hero.HeroKey,
      hero.SelectSoundKey,
    );
  });
  trusted.heroes.forEach((hero, rowIndex) => {
    addReference(
      "heroes",
      "DeadSoundKey",
      rowIndex,
      hero.HeroKey,
      hero.DeadSoundKey,
    );
  });
  assertPinned(trusted.heroes, "heroes");
  trusted.monsters.forEach((monster, rowIndex) => {
    addReference(
      "monsters",
      "DeadSoundKey",
      rowIndex,
      monster.MonsterKey,
      monster.DeadSoundKey,
    );
  });
  assertPinned(trusted.monsters, "monsters");
  trusted.skills.forEach((skill, rowIndex) => {
    if (skill.SoundKey === null) return;
    addReference(
      "skills",
      "SoundKey",
      rowIndex,
      skill.SkillKey,
      skill.SoundKey,
    );
  });
  assertPinned(trusted.skills, "skills");
  trusted.stages.forEach((stage, rowIndex) => {
    addReference(
      "stages",
      "BGMSoundKey",
      rowIndex,
      stage.StageKey,
      stage.BGMSoundKey,
    );
  });
  assertPinned(trusted.stages, "stages");

  if (references.length !== 297) {
    throw new Error(
      "source sound topology must contain exactly 297 references",
    );
  }
  const referencedSoundKeys = new Set(
    references.map((reference) => reference.soundKey),
  );
  if (referencedSoundKeys.size !== 173) {
    throw new Error(
      "source sound topology must contain exactly 173 referenced sounds",
    );
  }

  const soundTypes = {
    BattleLog: trusted.sounds.filter((sound) => sound.SoundType === "BattleLog")
      .length,
    BGM: trusted.sounds.filter((sound) => sound.SoundType === "BGM").length,
    GameSFX: trusted.sounds.filter((sound) => sound.SoundType === "GameSFX")
      .length,
    UI_SFX: trusted.sounds.filter((sound) => sound.SoundType === "UI_SFX")
      .length,
  };
  if (
    soundTypes.BattleLog !== 2 ||
    soundTypes.BGM !== 17 ||
    soundTypes.GameSFX !== 199 ||
    soundTypes.UI_SFX !== 94
  ) {
    throw new Error(
      "source sound topology has an unexpected sound-type census",
    );
  }

  const sounds: SourceSound[] = trusted.sounds.map((sound, rowIndex) => {
    const incomingReferences = references.filter(
      (reference) => reference.soundKey === sound.SoundKey,
    );
    return {
      soundKey: sound.SoundKey,
      soundTypeRaw: sound.SoundType,
      referenced: incomingReferences.length > 0,
      provenance: {
        table: "sounds",
        primaryField: "SoundKey",
        primaryKey: sound.SoundKey,
        typeField: "SoundType",
        rowIndex,
      },
      incomingReferences,
    };
  });
  const sourceUnreferencedSounds = sounds
    .filter((sound) => !sound.referenced)
    .map(({ soundKey, soundTypeRaw }) => ({ soundKey, soundTypeRaw }));
  if (sourceUnreferencedSounds.length !== 139) {
    throw new Error(
      "source sound topology must contain exactly 139 source-unreferenced sounds",
    );
  }

  return deepFreeze({
    counts: {
      sounds: 312,
      soundTypes: {
        BattleLog: 2,
        BGM: 17,
        GameSFX: 199,
        UI_SFX: 94,
      },
      references: 297,
      heroSelectReferences: 6,
      heroDeadReferences: 6,
      monsterDeadReferences: 61,
      skillReferences: 104,
      stageBgmReferences: 120,
      referencedSounds: 173,
      sourceUnreferencedSounds: 139,
      unresolvedReferences: 0,
    },
    sounds,
    references,
    sourceUnreferencedSounds,
  });
}
