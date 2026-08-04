import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { resolveRuneLevelRows } from "./rune-levels";

const RUNE_ROW_FIELDS = [
  "RuneKey",
  "NameKey",
  "NameKey_i18n",
  "MaxLevel",
  "PrevNodeRequiredLevel",
  "NextRuneKey",
  "PreviewRuneKey",
  "LevelDataKey",
  "IconPath",
  "icon",
  "next_runes",
] as const;

const RUNE_LEVEL_ROW_FIELDS = [
  "LevelKey",
  "Level",
  "CostItemKey",
  "CostValue",
  "STATTYPE",
  "Value",
] as const;

const MODIFIER_EVIDENCE_TABLES = [
  "buffs",
  "passive_skills",
  "pet_stats",
  "stat_mods",
] as const;

/**
 * Cross-table MODTYPE agreement proves which layer a source stat applies on.
 * It proves nothing about internal scale: pet-effects.ts publishes these same
 * pet_stats rows as unit UNPROVEN because the source never states whether a
 * stored 100 means 100%, 10.0% or 1.00x. Arriving via a Rune does not make the
 * scale knowable, so no contract here carries a unit or a derived value.
 */
const GENERAL_MODIFIER_CONTRACTS = {
  AdditionalExp: {
    sourceLayer: "FLAT",
    requiredDatasets: ["stat_mods"],
  },
  DropChanceNormalChestPercent: {
    sourceLayer: "FLAT",
    requiredDatasets: ["pet_stats"],
  },
  DropChanceStageBossChestPercent: {
    sourceLayer: "FLAT",
    requiredDatasets: ["pet_stats"],
  },
  IncreaseExpAmount: {
    sourceLayer: "FLAT",
    requiredDatasets: ["pet_stats", "stat_mods"],
  },
  IncreaseGoldAmount: {
    sourceLayer: "FLAT",
    requiredDatasets: ["pet_stats"],
  },
} as const;

type ModifierEvidenceDataset = (typeof MODIFIER_EVIDENCE_TABLES)[number];
type GeneralModifierStatType = keyof typeof GENERAL_MODIFIER_CONTRACTS;

export interface OwnedRuneAllocation {
  readonly key: number;
  readonly level: number;
}

export interface OwnedRuneSourceEffectsInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly ownedRunes: readonly OwnedRuneAllocation[];
  readonly [key: string]: unknown;
}

export interface RuneSourceEffectProvenance {
  readonly runeDataset: "runes";
  readonly runeLevelDataset: "rune_levels";
  readonly levelDataKey: number;
  readonly levelKey: number;
  readonly level: number;
  readonly costItemKey: number;
  readonly costValue: number;
}

export interface RuneModifierEvidence {
  readonly dataset: ModifierEvidenceDataset;
  readonly matchingRows: number;
}

interface RuneSourceEffectBase {
  readonly source: "Rune";
  readonly runeKey: number;
  readonly nodeKey: number;
  readonly ownedLevel: number;
  readonly sourceLevel: number;
  readonly statType: string;
  readonly rawValue: number;
  readonly provenance: RuneSourceEffectProvenance;
}

/**
 * A source row whose modifier LAYER is proven by cross-table MODTYPE agreement.
 * `rawValue` is carried verbatim and `unit` stays UNPROVEN, so consumers cannot
 * fold these into an applied total without first proving the scale elsewhere.
 */
export interface SourceLayerRuneModifier extends RuneSourceEffectBase {
  readonly kind: "source-layer-modifier";
  readonly statType: GeneralModifierStatType;
  readonly sourceLayer: "FLAT";
  readonly unit: "UNPROVEN";
  readonly modifierEvidence: readonly RuneModifierEvidence[];
}

export type OfflineRuneSourceMetadata = RuneSourceEffectBase &
  (
    | Readonly<{
        kind: "offline-source-metadata";
        statType: "UnlockOfflineReward";
        consumer: "offline";
        unit: "unlock-flag";
      }>
    | Readonly<{
        kind: "offline-source-metadata";
        statType: "OfflineRewardGoldPercent" | "OfflineRewardExpPercent";
        consumer: "offline";
        unit: "per-thousand";
      }>
  );

export type AlchemyRuneSourceMetadata = RuneSourceEffectBase &
  Readonly<{
    kind: "alchemy-source-metadata";
    statType: "CubeAlchemyGoldPercent" | "CubeExpPercent";
    consumer: "alchemy";
    unit: "per-thousand";
  }>;

export type ArrangeSlotRuneSourceMetadata = RuneSourceEffectBase &
  Readonly<{
    kind: "arrange-slot-source-metadata";
    statType: "UnlockArrangeSlotCount";
    consumer: "arrangement";
    unit: "slot-count";
  }>;

export interface UnresolvedRuneSourceEffect extends RuneSourceEffectBase {
  readonly kind: "unresolved-source-unit";
  readonly reason: string;
}

export type RuneSourceEffect =
  | SourceLayerRuneModifier
  | OfflineRuneSourceMetadata
  | AlchemyRuneSourceMetadata
  | ArrangeSlotRuneSourceMetadata
  | UnresolvedRuneSourceEffect;

export interface OwnedRuneSourceEffectProjection {
  readonly sourceEffects: readonly RuneSourceEffect[];
  readonly sourceLayerModifiers: readonly SourceLayerRuneModifier[];
}

type RuneRow = DiscordHeroDatasetRow<"runes">;
type RuneLevelRow = DiscordHeroDatasetRow<"rune_levels">;

interface ValidatedRuneCorpus {
  readonly runesByKey: ReadonlyMap<number, RuneRow>;
  readonly levelsByRuneKey: ReadonlyMap<number, readonly RuneLevelRow[]>;
  readonly predecessors: ReadonlyMap<number, readonly number[]>;
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
  context: string,
): asserts value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
}

/**
 * Validates exact own membership over Reflect.ownKeys — so a non-enumerable or
 * symbol-keyed own field cannot slip past Object.keys — and returns a frozen
 * snapshot whose values were each read exactly ONCE. Everything downstream must
 * use the snapshot: validating a live row and then re-reading it would let a
 * forged accessor answer the guard and the projection differently.
 */
function readExactOwnFields<Row>(
  value: unknown,
  expected: readonly string[],
  context: string,
): Row {
  assertRecord(value, context);
  const unknown = Reflect.ownKeys(value)
    .filter((field) => typeof field === "symbol" || !expected.includes(field))
    .map((field) => (typeof field === "symbol" ? field.toString() : field))
    .sort();
  if (unknown.length > 0) {
    throw new Error(
      `${context} has unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`,
    );
  }
  const missing = expected.filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) {
    throw new Error(
      `${context} is missing field${missing.length === 1 ? "" : "s"} ${missing.join(", ")}`,
    );
  }
  const snapshot: Record<string, unknown> = {};
  for (const field of expected) snapshot[field] = value[field];
  return Object.freeze(snapshot) as Row;
}

function positiveSafeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
  return value;
}

function nonemptyString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

function parseRuneEdges(
  value: string | number | null,
  runeKey: number,
): readonly number[] {
  if (value === null) return [];
  if (typeof value === "number") {
    return [positiveSafeInteger(value, `rune ${runeKey}.NextRuneKey`)];
  }
  if (!/^[1-9]\d*( [1-9]\d*)*$/.test(value)) {
    throw new Error(
      `rune ${runeKey}.NextRuneKey has invalid key list ${JSON.stringify(value)}`,
    );
  }
  const keys = value.split(" ").map(Number);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`rune ${runeKey}.NextRuneKey repeats a source node`);
  }
  return keys;
}

function requireTable(
  indexes: DiscordHeroCatalogIndexes,
  name: keyof DiscordHeroCatalogIndexes["tables"],
): void {
  const table = indexes.tables[name];
  if (
    typeof table !== "object" ||
    table === null ||
    !Array.isArray(table.rows) ||
    typeof table.groups !== "object" ||
    table.groups === null ||
    typeof table.groups.get !== "function" ||
    !Number.isSafeInteger(table.groups.size)
  ) {
    throw new Error(`${name} must be a canonical catalog table index`);
  }
}

function validateRuneCorpus(
  indexes: DiscordHeroCatalogIndexes,
): ValidatedRuneCorpus {
  assertRecord(indexes, "owned rune source-effect indexes");
  assertRecord(indexes.tables, "owned rune source-effect indexes.tables");
  requireTable(indexes, "runes");
  requireTable(indexes, "rune_levels");
  requireTable(indexes, "currencies");

  const runeTable = indexes.tables.runes;
  const levelTable = indexes.tables.rune_levels;
  if (runeTable.rows.length !== 197) {
    throw new Error(
      `runes must contain exactly 197 rows; received ${runeTable.rows.length}`,
    );
  }
  if (levelTable.rows.length !== 663) {
    throw new Error(
      `rune_levels must contain exactly 663 rows; received ${levelTable.rows.length}`,
    );
  }

  // Snapshot both source tables ONCE, before any graph validation or output.
  const levelRows = levelTable.rows.map((row) =>
    readExactOwnFields<RuneLevelRow>(
      row,
      RUNE_LEVEL_ROW_FIELDS,
      "rune_levels row",
    ),
  );
  for (const row of levelRows) {
    positiveSafeInteger(row.LevelKey, "rune_levels.LevelKey");
    positiveSafeInteger(row.Level, "rune_levels.Level");
    positiveSafeInteger(row.CostItemKey, "rune_levels.CostItemKey");
    positiveSafeInteger(row.CostValue, "rune_levels.CostValue");
    nonemptyString(row.STATTYPE, "rune_levels.STATTYPE");
    positiveSafeInteger(row.Value, "rune_levels.Value");
  }
  const runeRows = runeTable.rows.map((row) =>
    readExactOwnFields<RuneRow>(row, RUNE_ROW_FIELDS, "runes row"),
  );

  const levelIndicesByKey = new Map<number, number[]>();
  levelRows.forEach((row, index) => {
    const group = levelIndicesByKey.get(row.LevelKey) ?? [];
    group.push(index);
    levelIndicesByKey.set(row.LevelKey, group);
  });
  const snapshotLevelGroups = new Map<number, readonly RuneLevelRow[]>();
  for (const [key, group] of levelIndicesByKey) {
    snapshotLevelGroups.set(
      key,
      Object.freeze(group.map((index) => levelRows[index]!)),
    );
  }
  // resolveRuneLevelRows re-reads the row it is handed, so hand it the snapshot.
  const snapshotIndexes = {
    ...indexes,
    tables: {
      ...indexes.tables,
      rune_levels: {
        ...levelTable,
        rows: levelRows,
        groups: snapshotLevelGroups,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;

  const runesByKey = new Map<number, RuneRow>();
  const levelsByRuneKey = new Map<number, readonly RuneLevelRow[]>();
  const levelDataKeys = new Set<number>();
  let reachableRows = 0;
  let unreachableRows = 0;
  for (const [index, rune] of runeRows.entries()) {
    const runeKey = positiveSafeInteger(rune.RuneKey, "runes.RuneKey");
    positiveSafeInteger(rune.MaxLevel, `rune ${runeKey} max level`);
    positiveSafeInteger(rune.LevelDataKey, `rune ${runeKey} level data key`);
    if (runesByKey.has(runeKey)) {
      throw new Error(`runes repeats source node ${runeKey}`);
    }
    const indexedNode = runeTable.groups.get(runeKey);
    if (
      indexedNode === undefined ||
      indexedNode.length !== 1 ||
      indexedNode[0] !== runeTable.rows[index]
    ) {
      throw new Error(`rune ${runeKey} node join does not match runes rows`);
    }
    if (levelDataKeys.has(rune.LevelDataKey)) {
      throw new Error(
        `rune ${runeKey} level-data join repeats key ${rune.LevelDataKey}`,
      );
    }
    levelDataKeys.add(rune.LevelDataKey);

    const indexedLevels = levelTable.groups.get(rune.LevelDataKey);
    const sourceIndices = levelIndicesByKey.get(rune.LevelDataKey) ?? [];
    if (
      indexedLevels === undefined ||
      indexedLevels.length !== sourceIndices.length ||
      indexedLevels.some(
        (row, position) => row !== levelTable.rows[sourceIndices[position]!],
      )
    ) {
      throw new Error(
        `rune ${runeKey} level-data join does not match rune_levels rows`,
      );
    }
    if (sourceIndices.length < rune.MaxLevel) {
      throw new Error(
        `rune ${runeKey} level-data join has ${sourceIndices.length} rows; expected at least ${rune.MaxLevel}`,
      );
    }

    const resolved = resolveRuneLevelRows(snapshotIndexes, rune);
    let previousCost = 0;
    for (const row of resolved.reachable) {
      if (row.LevelKey !== rune.LevelDataKey) {
        throw new Error(
          `rune ${runeKey} level-data join returned key ${row.LevelKey}; expected ${rune.LevelDataKey}`,
        );
      }
      if (row.CostValue < previousCost) {
        throw new Error(
          `rune ${runeKey} level ${row.Level} cost regresses below level ${row.Level - 1}`,
        );
      }
      previousCost = row.CostValue;
    }
    runesByKey.set(runeKey, rune);
    levelsByRuneKey.set(runeKey, resolved.reachable);
    reachableRows += resolved.reachable.length;
    unreachableRows += resolved.unreachable.length;
  }
  if (
    runeTable.groups.size !== 197 ||
    levelTable.groups.size !== 197 ||
    levelDataKeys.size !== 197
  ) {
    throw new Error("Rune source indexes must contain exactly 197 node joins");
  }
  if (reachableRows !== 658 || unreachableRows !== 5) {
    throw new Error(
      `Rune source levels must contain 658 reachable and 5 trailing rows; received ${reachableRows} and ${unreachableRows}`,
    );
  }

  const predecessors = new Map<number, number[]>();
  for (const rune of runeRows) {
    if (rune.PrevNodeRequiredLevel !== null) {
      positiveSafeInteger(
        rune.PrevNodeRequiredLevel,
        `rune ${rune.RuneKey} predecessor requirement`,
      );
    }
    for (const nextKey of parseRuneEdges(rune.NextRuneKey, rune.RuneKey)) {
      if (!runesByKey.has(nextKey)) {
        throw new Error(
          `rune ${rune.RuneKey}.NextRuneKey references unknown source node ${nextKey}`,
        );
      }
      const sourceNodes = predecessors.get(nextKey) ?? [];
      sourceNodes.push(rune.RuneKey);
      predecessors.set(nextKey, sourceNodes);
    }
  }

  return {
    runesByKey,
    levelsByRuneKey,
    predecessors,
  };
}

function validateOwnedRunes(
  ownedRunes: unknown,
  corpus: ValidatedRuneCorpus,
): readonly Readonly<{
  allocation: OwnedRuneAllocation;
  rune: RuneRow;
  levels: readonly RuneLevelRow[];
}>[] {
  if (!Array.isArray(ownedRunes)) {
    throw new Error("ownedRunes must be an array");
  }
  if (ownedRunes.length > 197) {
    throw new Error("ownedRunes contains more than 197 source nodes");
  }

  const seen = new Set<number>();
  const ownedLevels = new Map<number, number>();
  const validated: Array<{
    allocation: OwnedRuneAllocation;
    rune: RuneRow;
    levels: readonly RuneLevelRow[];
  }> = [];
  for (const entry of ownedRunes) {
    const owned = readExactOwnFields<Readonly<Record<string, unknown>>>(
      entry,
      ["key", "level"],
      "owned rune input",
    );
    const key = positiveSafeInteger(owned.key, "owned rune key");
    const level = positiveSafeInteger(owned.level, `owned rune ${key} level`);
    if (seen.has(key)) {
      throw new Error(`duplicate owned rune key ${key}`);
    }
    seen.add(key);
    const rune = corpus.runesByKey.get(key);
    if (rune === undefined) {
      throw new Error(`owned rune ${key} references unknown source node`);
    }
    if (level > rune.MaxLevel) {
      throw new Error(
        `owned rune ${key} level ${level} exceeds source max ${rune.MaxLevel}`,
      );
    }
    ownedLevels.set(key, level);
    validated.push({
      allocation: { key, level },
      rune,
      levels: corpus.levelsByRuneKey.get(key)!,
    });
  }

  for (const { allocation, rune } of validated) {
    const sourceNodes = corpus.predecessors.get(rune.RuneKey) ?? [];
    if (sourceNodes.length === 0) {
      if (rune.PrevNodeRequiredLevel !== null) {
        throw new Error(
          `rune ${rune.RuneKey} requires predecessor level ${rune.PrevNodeRequiredLevel} but has no incoming edge`,
        );
      }
      continue;
    }
    const requiredLevel = rune.PrevNodeRequiredLevel ?? 1;
    if (
      !sourceNodes.some(
        (sourceNode) => (ownedLevels.get(sourceNode) ?? 0) >= requiredLevel,
      )
    ) {
      throw new Error(
        `owned rune ${allocation.key} requires a predecessor at level ${requiredLevel}`,
      );
    }
  }
  return validated;
}

function modifierEvidence(
  indexes: DiscordHeroCatalogIndexes,
  statType: string,
): readonly RuneModifierEvidence[] | null {
  if (!Object.hasOwn(GENERAL_MODIFIER_CONTRACTS, statType)) return null;
  const contract =
    GENERAL_MODIFIER_CONTRACTS[statType as GeneralModifierStatType];
  const evidence: RuneModifierEvidence[] = [];
  for (const dataset of MODIFIER_EVIDENCE_TABLES) {
    requireTable(indexes, dataset);
    const matchingRows = indexes.tables[dataset].rows.filter(
      (row) => row.STATTYPE === statType,
    );
    if (matchingRows.length === 0) continue;
    if (matchingRows.some((row) => row.MODTYPE !== contract.sourceLayer)) {
      return null;
    }
    evidence.push({ dataset, matchingRows: matchingRows.length });
  }
  if (
    contract.requiredDatasets.some(
      (dataset) => !evidence.some((candidate) => candidate.dataset === dataset),
    )
  ) {
    return null;
  }
  return evidence;
}

/**
 * The evidence for a stat type is identical for every level row that carries
 * it, so resolve each one once per projection instead of per row. Lazy, so a
 * catalog whose evidence tables are never consulted still is never inspected.
 */
function createModifierEvidenceResolver(
  indexes: DiscordHeroCatalogIndexes,
): (statType: string) => readonly RuneModifierEvidence[] | null {
  const resolved = new Map<string, readonly RuneModifierEvidence[] | null>();
  return (statType) => {
    if (resolved.has(statType)) return resolved.get(statType)!;
    const evidence = modifierEvidence(indexes, statType);
    resolved.set(statType, evidence);
    return evidence;
  };
}

function provenance(
  rune: RuneRow,
  level: RuneLevelRow,
): RuneSourceEffectProvenance {
  return {
    runeDataset: "runes",
    runeLevelDataset: "rune_levels",
    levelDataKey: rune.LevelDataKey,
    levelKey: level.LevelKey,
    level: level.Level,
    costItemKey: level.CostItemKey,
    costValue: level.CostValue,
  };
}

function projectSourceEffect(
  resolveEvidence: (statType: string) => readonly RuneModifierEvidence[] | null,
  allocation: OwnedRuneAllocation,
  rune: RuneRow,
  level: RuneLevelRow,
): RuneSourceEffect {
  const base = {
    source: "Rune" as const,
    runeKey: allocation.key,
    nodeKey: rune.RuneKey,
    ownedLevel: allocation.level,
    sourceLevel: level.Level,
    statType: level.STATTYPE,
    rawValue: level.Value,
    provenance: provenance(rune, level),
  };

  switch (level.STATTYPE) {
    case "UnlockOfflineReward":
      return {
        ...base,
        kind: "offline-source-metadata",
        statType: level.STATTYPE,
        consumer: "offline",
        unit: "unlock-flag",
      };
    case "OfflineRewardGoldPercent":
    case "OfflineRewardExpPercent":
      return {
        ...base,
        kind: "offline-source-metadata",
        statType: level.STATTYPE,
        consumer: "offline",
        unit: "per-thousand",
      };
    case "CubeAlchemyGoldPercent":
    case "CubeExpPercent":
      return {
        ...base,
        kind: "alchemy-source-metadata",
        statType: level.STATTYPE,
        consumer: "alchemy",
        unit: "per-thousand",
      };
    case "UnlockArrangeSlotCount":
      return {
        ...base,
        kind: "arrange-slot-source-metadata",
        statType: level.STATTYPE,
        consumer: "arrangement",
        unit: "slot-count",
      };
  }

  const evidence = resolveEvidence(level.STATTYPE);
  if (evidence !== null) {
    return {
      ...base,
      kind: "source-layer-modifier",
      statType: level.STATTYPE as GeneralModifierStatType,
      sourceLayer: "FLAT",
      unit: "UNPROVEN",
      modifierEvidence: evidence,
    };
  }
  return {
    ...base,
    kind: "unresolved-source-unit",
    reason: `${level.STATTYPE} has no exact source-proven modifier layer`,
  };
}

function detachedModifier(
  effect: SourceLayerRuneModifier,
): SourceLayerRuneModifier {
  return {
    ...effect,
    modifierEvidence: effect.modifierEvidence.map((entry) => ({ ...entry })),
    provenance: { ...effect.provenance },
  };
}

export function projectOwnedRuneSourceEffects(
  input: OwnedRuneSourceEffectsInput,
): OwnedRuneSourceEffectProjection {
  const request = readExactOwnFields<{
    readonly indexes: DiscordHeroCatalogIndexes;
    readonly ownedRunes: unknown;
  }>(input, ["indexes", "ownedRunes"], "owned rune source-effect input");
  const corpus = validateRuneCorpus(request.indexes);
  const owned = validateOwnedRunes(request.ownedRunes, corpus);
  const resolveEvidence = createModifierEvidenceResolver(request.indexes);
  const sourceEffects: RuneSourceEffect[] = [];
  const sourceLayerModifiers: SourceLayerRuneModifier[] = [];

  for (const { allocation, rune, levels } of owned) {
    for (const level of levels.slice(0, allocation.level)) {
      const effect = projectSourceEffect(
        resolveEvidence,
        allocation,
        rune,
        level,
      );
      sourceEffects.push(effect);
      if (effect.kind === "source-layer-modifier") {
        sourceLayerModifiers.push(detachedModifier(effect));
      }
    }
  }

  return deepFreeze({
    sourceEffects,
    sourceLayerModifiers,
  });
}
