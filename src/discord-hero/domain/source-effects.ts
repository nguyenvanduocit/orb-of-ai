import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
  type DiscordHeroUnresolvedReference,
} from "../catalog/indexes";

const SOURCE_TABLES = [
  "buff_groups",
  "buffs",
  "monsters",
  "skills",
  "status_effects",
] as const;

const ROW_FIELDS = {
  buff_groups: ["BuffGroupKey", "BuffKeys"],
  buffs: ["BuffKey", "BuffType", "STATTYPE", "MODTYPE", "Value"],
  monsters: [
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
  ],
  skills: [
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
  ],
  status_effects: [
    "StatusEffectKey",
    "StatusEffectType",
    "Duration",
    "BuffKeys",
    "OverrideType",
    "Param0",
    "Param1",
    "Param2",
    "Param3",
    "buffs",
  ],
} as const;

const SKILL_ACTIVATION_TYPES = new Set([
  "BASEATTACK",
  "BASEATTACK_COUNT",
  "CONTINUOUS",
  "COOLDOWN",
]);
const SKILL_BUFF_TYPES = new Set(["Buff", "Normal"]);
const SKILL_DAMAGE_TYPES = new Set([
  "Chaos",
  "Cold",
  "Fire",
  "Lightning",
  "Physical",
]);
const SKILL_DELIVERY_TYPES = new Set([
  "AOE",
  "Melee",
  "Melee, AOE",
  "Projectile",
  "Projectile, AOE",
  "Projectile, Summon",
  "Trap",
]);
const BUFF_TYPES = new Set(["Buff", "Debuff"]);
const BUFF_MOD_TYPES = new Set(["ADDITIVE", "FLAT", "MULTIPLICATIVE"]);
const STATUS_OVERRIDE_TYPES = new Set(["InitDuration", "NotOverride"]);

const EXPECTED_ROWS = {
  buff_groups: 16,
  buffs: 29,
  monsters: 61,
  skills: 106,
  status_effects: 6,
} as const;

type RawReferenceList = number | string | null;

export interface SourceEffectTopologyInput {
  readonly indexes: DiscordHeroCatalogIndexes;
}

export interface SourceEffectTopologyCounts {
  readonly skills: 106;
  readonly buffGroupRows: 16;
  readonly uniqueBuffGroupKeys: 15;
  readonly buffs: 29;
  readonly statusEffects: 6;
  readonly monsterSkillReferences: 91;
}

export type SourceBuffReference =
  | {
      readonly kind: "resolved";
      readonly buffKey: number;
    }
  | {
      readonly kind: "unresolved-source";
      readonly source: "buff-group";
      readonly sourceKey: number;
      readonly buffKey: number;
      readonly ruleId: "buff_groups.BuffKeys->buffs";
      readonly reason: string;
    };

export interface SourceBuffGroupRow {
  readonly rowIndex: number;
  readonly buffGroupKey: number;
  readonly rawBuffKeys: RawReferenceList;
  readonly buffReferences: readonly SourceBuffReference[];
}

export type SourceBuffRuntimeValue =
  | {
      readonly kind: "source-value";
      readonly value: number;
    }
  | {
      readonly kind: "runtime-value-unresolved";
      readonly reason: "source buff Value is null";
    };

export interface SourceBuffEffect {
  readonly buffKey: number;
  readonly buffType: string;
  readonly statType: string;
  readonly modType: string;
  readonly value: number | null;
  readonly runtimeValue: SourceBuffRuntimeValue;
}

export type SourceSkillBuffGroupReference =
  | {
      readonly kind: "none";
    }
  | {
      readonly kind: "resolved";
      readonly buffGroupKey: number;
      readonly rowIndexes: readonly number[];
    };

export interface SourceSkillEffect {
  readonly skillKey: number | string;
  readonly activationType: string;
  readonly activationValue: number | null;
  readonly skillBuffType: string;
  readonly buffGroupKey: number | null;
  readonly damageType: string;
  readonly deliveryType: string | null;
  readonly range: number;
  readonly value: number | string | null;
  readonly buffGroupReference: SourceSkillBuffGroupReference;
}

export interface SourceStatusEffect {
  readonly statusEffectKey: number;
  readonly statusEffectType: string;
  readonly duration: number;
  readonly rawBuffKeys: RawReferenceList;
  readonly overrideType: string;
  readonly params: readonly [number | null, number | null, null, null];
  readonly buffReferences: readonly {
    readonly kind: "resolved";
    readonly buffKey: number;
  }[];
}

export type SourceMonsterSkillReference =
  | {
      readonly kind: "resolved";
      readonly source: "monster";
      readonly monsterKey: number;
      readonly rawSkillKeys: number | string;
      readonly referenceIndex: number;
      readonly skillKey: number;
    }
  | {
      readonly kind: "unresolved-source";
      readonly source: "monster";
      readonly monsterKey: number;
      readonly rawSkillKeys: number | string;
      readonly referenceIndex: number;
      readonly skillKey: number;
      readonly apparentSkillKey: string;
      readonly ruleId: "monsters.SkillKey->skills";
      readonly reason: string;
    };

export interface SourceEffectTopology {
  readonly counts: SourceEffectTopologyCounts;
  readonly skills: readonly SourceSkillEffect[];
  readonly buffGroupRows: readonly SourceBuffGroupRow[];
  readonly buffs: readonly SourceBuffEffect[];
  readonly statusEffects: readonly SourceStatusEffect[];
  readonly monsterSkillReferences: readonly SourceMonsterSkillReference[];
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactOwnFields(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertRecord(value, label);
  const actualFields = Object.keys(value);
  const unknownFields = actualFields
    .filter((field) => !expectedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    throw new Error(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
  const missingFields = expectedFields.filter(
    (field) => !Object.hasOwn(value, field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `${label} is missing field${missingFields.length === 1 ? "" : "s"} ${missingFields.join(", ")}`,
    );
  }
}

function assertAllowedOwnFields(
  value: unknown,
  allowedFields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertRecord(value, label);
  const unknownFields = Object.keys(value)
    .filter((field) => !allowedFields.includes(field))
    .sort();
  if (unknownFields.length > 0) {
    throw new Error(
      `${label} has unknown field${unknownFields.length === 1 ? "" : "s"} ${unknownFields.join(", ")}`,
    );
  }
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  return finiteNumber(value, label);
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function knownString(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
): string {
  const result = nonemptyString(value, label);
  if (!allowed.has(result)) {
    throw new Error(`${label} has unknown value ${JSON.stringify(result)}`);
  }
  return result;
}

function parseReferenceList(
  value: RawReferenceList,
  label: string,
): readonly number[] {
  if (value === null) return [];
  if (typeof value === "number") {
    return [positiveSafeInteger(value, label)];
  }
  if (!/^[1-9]\d*( [1-9]\d*)*$/.test(value)) {
    throw new Error(`${label} must be a canonical positive-integer list`);
  }
  const references = value.split(" ").map((token) => Number(token));
  if (new Set(references).size !== references.length) {
    throw new Error(`${label} must not contain duplicate references`);
  }
  return references;
}

function skillPrimary(value: unknown): number | string {
  if (typeof value === "number") {
    return positiveSafeInteger(value, "skills.SkillKey");
  }
  if (typeof value !== "string" || !/^[1-9]\d* $/.test(value)) {
    throw new Error(
      "skills.SkillKey must be a positive safe integer or source trailing-space key",
    );
  }
  return value;
}

function assertUnique<Key extends string | number>(
  keys: readonly Key[],
  label: string,
): void {
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} must be unique`);
  }
}

function limitationFor(
  indexes: DiscordHeroCatalogIndexes,
  ruleId: string,
  sourceKey: number,
  targetKey: number,
): DiscordHeroUnresolvedReference | undefined {
  const matches = indexes.semanticReport.unresolvedReferences.filter(
    (reference) =>
      reference.ruleId === ruleId &&
      reference.sourceKey === sourceKey &&
      reference.targetKey === targetKey,
  );
  if (matches.length > 1) {
    throw new Error(
      `${ruleId} has duplicate source limitation ${sourceKey}->${targetKey}`,
    );
  }
  return matches[0];
}

function limitationSignature(
  reference: Pick<
    DiscordHeroUnresolvedReference,
    "ruleId" | "sourceKey" | "targetKey"
  >,
): string {
  return JSON.stringify([
    reference.ruleId,
    reference.sourceKey,
    reference.targetKey,
  ]);
}

function assertCanonicalIndexes(indexes: DiscordHeroCatalogIndexes): void {
  assertExactOwnFields(
    indexes,
    ["catalog", "tables", "semanticReport"],
    "source-effect topology indexes",
  );
  assertRecord(indexes.tables, "source-effect topology indexes.tables");
  const tableNames = Object.keys(indexes.tables).sort();
  const expectedNames = [...DISCORD_HERO_DATASET_NAMES].sort();
  if (
    tableNames.length !== expectedNames.length ||
    tableNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new Error(
      "source-effect topology indexes.tables must contain exactly the canonical 45 tables",
    );
  }
  for (const name of SOURCE_TABLES) {
    const table = indexes.tables[name];
    assertExactOwnFields(
      table,
      ["name", "primaryField", "rows", "groups"],
      `source-effect topology indexes.tables.${name}`,
    );
    if (table.name !== name || !Array.isArray(table.rows)) {
      throw new Error(
        `source-effect topology indexes.tables.${name} must be a canonical table index`,
      );
    }
  }
}

function validateBuffGroups(
  rows: readonly DiscordHeroDatasetRow<"buff_groups">[],
): {
  readonly keys: readonly number[];
  readonly references: readonly (readonly number[])[];
  readonly rowIndexesByKey: ReadonlyMap<number, readonly number[]>;
} {
  if (rows.length !== EXPECTED_ROWS.buff_groups) {
    throw new Error("buff_groups must contain exactly 16 rows");
  }
  const keys: number[] = [];
  const references: number[][] = [];
  const rowIndexesByKey = new Map<number, number[]>();
  rows.forEach((row, rowIndex) => {
    assertAllowedOwnFields(row, ROW_FIELDS.buff_groups, "buff_groups row");
    const key = positiveSafeInteger(
      row.BuffGroupKey,
      "buff_groups.BuffGroupKey",
    );
    const rawBuffKeys = row.BuffKeys;
    if (
      rawBuffKeys !== null &&
      typeof rawBuffKeys !== "number" &&
      typeof rawBuffKeys !== "string"
    ) {
      throw new Error("buff_groups.BuffKeys must be a number, string, or null");
    }
    keys.push(key);
    references.push([
      ...parseReferenceList(rawBuffKeys, "buff_groups.BuffKeys"),
    ]);
    const indexes = rowIndexesByKey.get(key) ?? [];
    indexes.push(rowIndex);
    rowIndexesByKey.set(key, indexes);
  });
  const duplicateGroups = [...rowIndexesByKey.entries()].filter(
    ([, rowIndexes]) => rowIndexes.length > 1,
  );
  if (
    rowIndexesByKey.size !== 15 ||
    duplicateGroups.length !== 1 ||
    duplicateGroups[0]![0] !== 60601 ||
    duplicateGroups[0]![1].join(",") !== "10,11"
  ) {
    throw new Error(
      "buff_groups duplicate topology must be exactly 60601 at rows 10,11",
    );
  }
  return { keys, references, rowIndexesByKey };
}

function validateBuffs(
  rows: readonly DiscordHeroDatasetRow<"buffs">[],
): ReadonlyMap<number, DiscordHeroDatasetRow<"buffs">> {
  if (rows.length !== EXPECTED_ROWS.buffs) {
    throw new Error("buffs must contain exactly 29 rows");
  }
  const keys: number[] = [];
  const byKey = new Map<number, DiscordHeroDatasetRow<"buffs">>();
  for (const row of rows) {
    assertAllowedOwnFields(row, ROW_FIELDS.buffs, "buffs row");
    const key = positiveSafeInteger(row.BuffKey, "buffs.BuffKey");
    knownString(row.BuffType, BUFF_TYPES, "buffs.BuffType");
    nonemptyString(row.STATTYPE, "buffs.STATTYPE");
    knownString(row.MODTYPE, BUFF_MOD_TYPES, "buffs.MODTYPE");
    nullableFiniteNumber(row.Value, "buffs.Value");
    keys.push(key);
    byKey.set(key, row);
  }
  assertUnique(keys, "buffs.BuffKey");
  return byKey;
}

function validateSkills(
  rows: readonly DiscordHeroDatasetRow<"skills">[],
  buffGroupRowIndexes: ReadonlyMap<number, readonly number[]>,
): ReadonlyMap<number | string, DiscordHeroDatasetRow<"skills">> {
  if (rows.length !== EXPECTED_ROWS.skills) {
    throw new Error("skills must contain exactly 106 rows");
  }
  const keys: Array<number | string> = [];
  const byKey = new Map<number | string, DiscordHeroDatasetRow<"skills">>();
  for (const row of rows) {
    assertAllowedOwnFields(row, ROW_FIELDS.skills, "skills row");
    const key = skillPrimary(row.SkillKey);
    knownString(
      row.ACTIVATIONTYPE,
      SKILL_ACTIVATION_TYPES,
      "skills.ACTIVATIONTYPE",
    );
    nullableFiniteNumber(row.ActivationValue, "skills.ActivationValue");
    knownString(row.SkillBuffType, SKILL_BUFF_TYPES, "skills.SkillBuffType");
    if (
      row.BuffGroupKey !== null &&
      !buffGroupRowIndexes.has(
        positiveSafeInteger(row.BuffGroupKey, "skills.BuffGroupKey"),
      )
    ) {
      throw new Error(
        `skills.BuffGroupKey references unknown buff group ${row.BuffGroupKey}`,
      );
    }
    knownString(row.DamageType, SKILL_DAMAGE_TYPES, "skills.DamageType");
    if (row.DamageDeliveryType !== null) {
      knownString(
        row.DamageDeliveryType,
        SKILL_DELIVERY_TYPES,
        "skills.DamageDeliveryType",
      );
    }
    finiteNumber(row.Range, "skills.Range");
    if (
      row.Value !== null &&
      typeof row.Value !== "number" &&
      (typeof row.Value !== "string" || !/^[1-9]\d* $/.test(row.Value))
    ) {
      throw new Error(
        "skills.Value must be a finite number, source trailing-space value, or null",
      );
    }
    if (typeof row.Value === "number") finiteNumber(row.Value, "skills.Value");
    keys.push(key);
    byKey.set(key, row);
  }
  assertUnique(keys, "skills.SkillKey");
  return byKey;
}

function validateMonsters(
  rows: readonly DiscordHeroDatasetRow<"monsters">[],
): readonly (readonly number[])[] {
  if (rows.length !== EXPECTED_ROWS.monsters) {
    throw new Error("monsters must contain exactly 61 rows");
  }
  const keys: number[] = [];
  const references: number[][] = [];
  for (const row of rows) {
    assertAllowedOwnFields(row, ROW_FIELDS.monsters, "monsters row");
    keys.push(positiveSafeInteger(row.MonsterKey, "monsters.MonsterKey"));
    if (typeof row.SkillKey !== "number" && typeof row.SkillKey !== "string") {
      throw new Error("monsters.SkillKey must be a number or string");
    }
    references.push([...parseReferenceList(row.SkillKey, "monsters.SkillKey")]);
  }
  assertUnique(keys, "monsters.MonsterKey");
  return references;
}

function validateStatuses(
  rows: readonly DiscordHeroDatasetRow<"status_effects">[],
  buffsByKey: ReadonlyMap<number, DiscordHeroDatasetRow<"buffs">>,
): readonly (readonly number[])[] {
  if (rows.length !== EXPECTED_ROWS.status_effects) {
    throw new Error("status_effects must contain exactly 6 rows");
  }
  const keys: number[] = [];
  const references: number[][] = [];
  for (const row of rows) {
    assertAllowedOwnFields(
      row,
      ROW_FIELDS.status_effects,
      "status_effects row",
    );
    keys.push(
      positiveSafeInteger(
        row.StatusEffectKey,
        "status_effects.StatusEffectKey",
      ),
    );
    nonemptyString(row.StatusEffectType, "status_effects.StatusEffectType");
    finiteNumber(row.Duration, "status_effects.Duration");
    knownString(
      row.OverrideType,
      STATUS_OVERRIDE_TYPES,
      "status_effects.OverrideType",
    );
    nullableFiniteNumber(row.Param0, "status_effects.Param0");
    nullableFiniteNumber(row.Param1, "status_effects.Param1");
    if (row.Param2 !== null || row.Param3 !== null) {
      throw new Error("status_effects.Param2 and Param3 must remain null");
    }
    const buffKeys = parseReferenceList(
      row.BuffKeys,
      "status_effects.BuffKeys",
    );
    for (const buffKey of buffKeys) {
      if (!buffsByKey.has(buffKey)) {
        throw new Error(
          `status_effects.BuffKeys references unknown buff ${buffKey}`,
        );
      }
    }
    if (row.buffs.length !== buffKeys.length) {
      throw new Error(
        `status_effects ${row.StatusEffectKey} embedded buffs do not match BuffKeys`,
      );
    }
    row.buffs.forEach((embedded, index) => {
      assertExactOwnFields(
        embedded,
        ROW_FIELDS.buffs,
        `status_effects ${row.StatusEffectKey} embedded buff`,
      );
      const source = buffsByKey.get(buffKeys[index]!);
      if (
        source === undefined ||
        embedded.BuffKey !== source.BuffKey ||
        embedded.BuffType !== source.BuffType ||
        embedded.STATTYPE !== source.STATTYPE ||
        embedded.MODTYPE !== source.MODTYPE ||
        embedded.Value !== source.Value
      ) {
        throw new Error(
          `status_effects ${row.StatusEffectKey} embedded buffs do not match the buff registry`,
        );
      }
    });
    references.push([...buffKeys]);
  }
  assertUnique(keys, "status_effects.StatusEffectKey");
  return references;
}

export function projectSourceEffectTopology(
  input: SourceEffectTopologyInput,
): SourceEffectTopology {
  assertExactOwnFields(input, ["indexes"], "source-effect topology input");
  const { indexes } = input;
  assertCanonicalIndexes(indexes);

  const buffGroupRows = indexes.tables.buff_groups.rows;
  const buffRows = indexes.tables.buffs.rows;
  const monsterRows = indexes.tables.monsters.rows;
  const skillRows = indexes.tables.skills.rows;
  const statusRows = indexes.tables.status_effects.rows;

  const validatedGroups = validateBuffGroups(buffGroupRows);
  const buffsByKey = validateBuffs(buffRows);
  const skillsByKey = validateSkills(
    skillRows,
    validatedGroups.rowIndexesByKey,
  );
  const statusBuffReferences = validateStatuses(statusRows, buffsByKey);
  const monsterSkillReferences = validateMonsters(monsterRows);

  const encounteredLimitations: DiscordHeroUnresolvedReference[] = [];
  validatedGroups.references.forEach((references, rowIndex) => {
    for (const buffKey of references) {
      if (buffsByKey.has(buffKey)) continue;
      const sourceKey = validatedGroups.keys[rowIndex]!;
      const limitation = limitationFor(
        indexes,
        "buff_groups.BuffKeys->buffs",
        sourceKey,
        buffKey,
      );
      if (limitation === undefined) {
        throw new Error(
          `buff_groups.BuffKeys references undeclared missing buff ${buffKey}`,
        );
      }
      encounteredLimitations.push(limitation);
    }
  });

  let monsterReferenceCount = 0;
  monsterSkillReferences.forEach((references, rowIndex) => {
    const monsterKey = monsterRows[rowIndex]!.MonsterKey;
    for (const skillKey of references) {
      monsterReferenceCount += 1;
      if (skillsByKey.has(skillKey)) continue;
      const limitation = limitationFor(
        indexes,
        "monsters.SkillKey->skills",
        monsterKey,
        skillKey,
      );
      const apparentSkillKey = `${skillKey} `;
      if (
        limitation === undefined ||
        !skillsByKey.has(apparentSkillKey) ||
        skillsByKey.has(skillKey)
      ) {
        throw new Error(
          `monsters.SkillKey references undeclared missing skill ${skillKey}`,
        );
      }
      encounteredLimitations.push(limitation);
    }
  });
  if (monsterReferenceCount !== 91) {
    throw new Error("monsters.SkillKey must contain exactly 91 references");
  }

  const declaredLimitations = indexes.semanticReport.unresolvedReferences
    .filter(
      (reference) =>
        reference.ruleId === "buff_groups.BuffKeys->buffs" ||
        reference.ruleId === "monsters.SkillKey->skills",
    )
    .map(limitationSignature)
    .sort();
  const encounteredSignatures = encounteredLimitations
    .map(limitationSignature)
    .sort();
  if (
    declaredLimitations.length !== 34 ||
    encounteredSignatures.length !== declaredLimitations.length ||
    declaredLimitations.some(
      (signature, index) => signature !== encounteredSignatures[index],
    )
  ) {
    throw new Error(
      "source-effect source limitations must be exactly one buff and 33 monster-skill references",
    );
  }

  const projectedBuffs: SourceBuffEffect[] = buffRows.map((buff) => ({
    buffKey: buff.BuffKey,
    buffType: buff.BuffType,
    statType: buff.STATTYPE,
    modType: buff.MODTYPE,
    value: buff.Value,
    runtimeValue:
      buff.Value === null
        ? {
            kind: "runtime-value-unresolved",
            reason: "source buff Value is null",
          }
        : {
            kind: "source-value",
            value: buff.Value,
          },
  }));

  const projectedBuffGroups: SourceBuffGroupRow[] = buffGroupRows.map(
    (row, rowIndex) => ({
      rowIndex,
      buffGroupKey: row.BuffGroupKey,
      rawBuffKeys: row.BuffKeys,
      buffReferences: validatedGroups.references[rowIndex]!.map((buffKey) => {
        if (buffsByKey.has(buffKey)) {
          return { kind: "resolved" as const, buffKey };
        }
        const limitation = limitationFor(
          indexes,
          "buff_groups.BuffKeys->buffs",
          row.BuffGroupKey,
          buffKey,
        )!;
        return {
          kind: "unresolved-source" as const,
          source: "buff-group" as const,
          sourceKey: row.BuffGroupKey,
          buffKey,
          ruleId: "buff_groups.BuffKeys->buffs" as const,
          reason: limitation.reason,
        };
      }),
    }),
  );

  const projectedSkills: SourceSkillEffect[] = skillRows.map((skill) => ({
    skillKey: skill.SkillKey,
    activationType: skill.ACTIVATIONTYPE,
    activationValue: skill.ActivationValue,
    skillBuffType: skill.SkillBuffType,
    buffGroupKey: skill.BuffGroupKey,
    damageType: skill.DamageType,
    deliveryType: skill.DamageDeliveryType,
    range: skill.Range,
    value: skill.Value,
    buffGroupReference:
      skill.BuffGroupKey === null
        ? { kind: "none" }
        : {
            kind: "resolved",
            buffGroupKey: skill.BuffGroupKey,
            rowIndexes: [
              ...validatedGroups.rowIndexesByKey.get(skill.BuffGroupKey)!,
            ],
          },
  }));

  const projectedStatuses: SourceStatusEffect[] = statusRows.map(
    (status, rowIndex) => ({
      statusEffectKey: status.StatusEffectKey,
      statusEffectType: status.StatusEffectType,
      duration: status.Duration,
      rawBuffKeys: status.BuffKeys,
      overrideType: status.OverrideType,
      params: [status.Param0, status.Param1, status.Param2, status.Param3],
      buffReferences: statusBuffReferences[rowIndex]!.map((buffKey) => ({
        kind: "resolved",
        buffKey,
      })),
    }),
  );

  const projectedMonsterReferences: SourceMonsterSkillReference[] = [];
  monsterRows.forEach((monster, rowIndex) => {
    monsterSkillReferences[rowIndex]!.forEach((skillKey, referenceIndex) => {
      if (skillsByKey.has(skillKey)) {
        projectedMonsterReferences.push({
          kind: "resolved",
          source: "monster",
          monsterKey: monster.MonsterKey,
          rawSkillKeys: monster.SkillKey,
          referenceIndex,
          skillKey,
        });
        return;
      }
      const limitation = limitationFor(
        indexes,
        "monsters.SkillKey->skills",
        monster.MonsterKey,
        skillKey,
      )!;
      projectedMonsterReferences.push({
        kind: "unresolved-source",
        source: "monster",
        monsterKey: monster.MonsterKey,
        rawSkillKeys: monster.SkillKey,
        referenceIndex,
        skillKey,
        apparentSkillKey: `${skillKey} `,
        ruleId: "monsters.SkillKey->skills",
        reason: limitation.reason,
      });
    });
  });

  return deepFreeze({
    counts: {
      skills: 106,
      buffGroupRows: 16,
      uniqueBuffGroupKeys: 15,
      buffs: 29,
      statusEffects: 6,
      monsterSkillReferences: 91,
    },
    skills: projectedSkills,
    buffGroupRows: projectedBuffGroups,
    buffs: projectedBuffs,
    statusEffects: projectedStatuses,
    monsterSkillReferences: projectedMonsterReferences,
  });
}
