import {
  getCatalogGroup,
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { OracleRequiredError } from "./combat";
import type { RandomSource } from "./stats";

export type SourceStageRow = DiscordHeroDatasetRow<"stages">;

export interface CampaignGraph {
  readonly stages: readonly SourceStageRow[];
  readonly rootStageKey: number;
  readonly finalStageKey: number;
}

export interface StageEncounter {
  readonly stageKey: number;
  readonly stageLevel: number;
  readonly kind: "normal" | "act-boss";
  readonly waveAmount: number | null;
  readonly waveMonsterAmount: number | null;
  readonly waveMonsters: readonly Readonly<{
    monsterKey: number;
    weight: number;
  }>[];
  readonly unresolvedMonsterKeys: readonly number[];
  readonly bossMonsterKey: number;
  readonly monsterDrop: Readonly<{
    dropKey: number;
    chancePerThousand: number;
  }> | null;
  readonly bossDrop: Readonly<{
    dropKey: number;
    chancePerThousand: number | null;
  }>;
  readonly firstClearDropKey: number | null;
}

const SOURCE_DANGLING_MONSTER_REFERENCES = Object.freeze([
  Object.freeze({ stageKey: 1208, monsterKey: 20101 }),
  Object.freeze({ stageKey: 1209, monsterKey: 20101 }),
  Object.freeze({ stageKey: 2208, monsterKey: 20101 }),
  Object.freeze({ stageKey: 2209, monsterKey: 20101 }),
  Object.freeze({ stageKey: 3208, monsterKey: 20101 }),
  Object.freeze({ stageKey: 3209, monsterKey: 20101 }),
  Object.freeze({ stageKey: 4208, monsterKey: 20101 }),
  Object.freeze({ stageKey: 4209, monsterKey: 20101 }),
]);

export function createCampaignGraph(
  indexes: DiscordHeroCatalogIndexes,
): CampaignGraph {
  const rows = indexes.tables.stages.rows;
  if (rows.length !== 120) {
    throw new Error(
      `campaign graph must contain exactly 120 stages; received ${rows.length}`,
    );
  }

  const byKey = new Map<number, SourceStageRow>();
  const danglingReferences: Array<{ stageKey: number; monsterKey: number }> = [];
  for (const row of rows) {
    requirePositiveSafeInteger(row.StageKey, "stage key");
    if (byKey.has(row.StageKey)) {
      throw new Error(`duplicate stage key ${row.StageKey}`);
    }
    const encounter = stageEncounter(indexes, { stageKey: row.StageKey });
    for (const monsterKey of encounter.unresolvedMonsterKeys) {
      danglingReferences.push({ stageKey: row.StageKey, monsterKey });
    }
    byKey.set(row.StageKey, row);
  }
  if (
    JSON.stringify(danglingReferences) !==
    JSON.stringify(SOURCE_DANGLING_MONSTER_REFERENCES)
  ) {
    throw new Error(
      `campaign dangling monster references changed: ${JSON.stringify(danglingReferences)}`,
    );
  }

  const incoming = new Map<number, number>();
  for (const row of rows) incoming.set(row.StageKey, 0);
  for (const row of rows) {
    if (row.NextStageKey === null) continue;
    requirePositiveSafeInteger(
      row.NextStageKey,
      `stage ${row.StageKey} next stage key`,
    );
    if (!byKey.has(row.NextStageKey)) {
      throw new Error(
        `stage ${row.StageKey} references unknown next stage ${row.NextStageKey}`,
      );
    }
    incoming.set(row.NextStageKey, incoming.get(row.NextStageKey)! + 1);
  }
  const roots = rows.filter((row) => incoming.get(row.StageKey) === 0);
  const tails = rows.filter((row) => row.NextStageKey === null);
  if (roots.length !== 1) {
    throw new Error(`campaign graph must have one root; received ${roots.length}`);
  }
  if (tails.length !== 1) {
    throw new Error(`campaign graph must have one final stage; received ${tails.length}`);
  }

  const visited = new Set<number>();
  let cursor: SourceStageRow | undefined = roots[0];
  while (cursor !== undefined) {
    if (visited.has(cursor.StageKey)) {
      throw new Error(`campaign graph contains a cycle at stage ${cursor.StageKey}`);
    }
    visited.add(cursor.StageKey);
    cursor =
      cursor.NextStageKey === null ? undefined : byKey.get(cursor.NextStageKey);
  }
  if (visited.size !== rows.length) {
    throw new Error(
      `campaign graph reaches ${visited.size} of ${rows.length} source stages`,
    );
  }

  const stages = rows.map((row) => deepFreeze(structuredClone(row)));
  return Object.freeze({
    stages: Object.freeze(stages),
    rootStageKey: roots[0]!.StageKey,
    finalStageKey: tails[0]!.StageKey,
  });
}

export function getCampaignStage(
  graph: CampaignGraph,
  stageKey: number,
): SourceStageRow {
  requirePositiveSafeInteger(stageKey, "campaign stage key");
  const matches = graph.stages.filter((stage) => stage.StageKey === stageKey);
  if (matches.length !== 1) {
    throw new Error(`campaign graph has no unique stage ${stageKey}`);
  }
  return deepFreeze(structuredClone(matches[0]!));
}

interface StageEncounterInput {
  readonly stageKey: number;
  readonly [key: string]: unknown;
}

export function stageEncounter(
  indexes: DiscordHeroCatalogIndexes,
  input: StageEncounterInput,
): StageEncounter {
  rejectUnknownFields(input, ["stageKey"], "stage encounter input");
  requirePositiveSafeInteger(input.stageKey, "stage key");
  const stage = getCatalogRow(indexes, "stages", input.stageKey);
  requirePositiveSafeInteger(stage.StageLevel, `stage ${stage.StageKey} level`);
  requirePositiveSafeInteger(
    stage.BossMonsterKey,
    `stage ${stage.StageKey} boss monster key`,
  );
  getCatalogRow(indexes, "monsters", stage.BossMonsterKey);
  requirePositiveSafeInteger(
    stage.BossDropItemKey,
    `stage ${stage.StageKey} boss drop key`,
  );
  getCatalogRow(indexes, "items", stage.BossDropItemKey);
  requireOptionalPositiveSafeInteger(
    stage.FirstClearDropKey,
    `stage ${stage.StageKey} first-clear drop key`,
  );
  if (stage.FirstClearDropKey !== null) {
    getCatalogGroup(indexes, "drops", stage.FirstClearDropKey);
  }
  requireOptionalPerThousand(
    stage.BossDropItemRate,
    `stage ${stage.StageKey} boss drop chance`,
  );

  if (stage.STAGETYPE === "ACTBOSS") {
    if (
      stage.WaveAmount !== null ||
      stage.WaveMonsterAmount !== null ||
      stage.Monsters !== null ||
      stage.MonsterDropItemKey !== null ||
      stage.MonsterDropItemRate !== null
    ) {
      throw new Error(`act-boss stage ${stage.StageKey} has normal-wave data`);
    }
    if (stage.BossDropItemRate !== null) {
      throw new Error(
        `act-boss stage ${stage.StageKey} must not have a boss drop chance`,
      );
    }
    return Object.freeze({
      stageKey: stage.StageKey,
      stageLevel: stage.StageLevel,
      kind: "act-boss",
      waveAmount: null,
      waveMonsterAmount: null,
      waveMonsters: Object.freeze([]),
      unresolvedMonsterKeys: Object.freeze([]),
      bossMonsterKey: stage.BossMonsterKey,
      monsterDrop: null,
      bossDrop: Object.freeze({
        dropKey: stage.BossDropItemKey,
        chancePerThousand: stage.BossDropItemRate,
      }),
      firstClearDropKey: stage.FirstClearDropKey,
    });
  }
  if (stage.STAGETYPE !== "NORMAL") {
    throw new Error(`stage ${stage.StageKey} has unsupported type ${stage.STAGETYPE}`);
  }
  if (stage.BossDropItemRate === null) {
    throw new Error(`normal stage ${stage.StageKey} must have a boss drop chance`);
  }
  requirePositiveSafeInteger(
    stage.WaveAmount,
    `stage ${stage.StageKey} wave amount`,
  );
  requirePositiveSafeInteger(
    stage.WaveMonsterAmount,
    `stage ${stage.StageKey} wave monster amount`,
  );
  if (
    stage.Monsters === null ||
    !/^[1-9]\d*_[1-9]\d*( [1-9]\d*_[1-9]\d*)*$/.test(stage.Monsters)
  ) {
    throw new Error(`stage ${stage.StageKey} has invalid monster weights`);
  }
  requirePositiveSafeInteger(
    stage.MonsterDropItemKey,
    `stage ${stage.StageKey} monster drop key`,
  );
  getCatalogRow(indexes, "items", stage.MonsterDropItemKey);
  requirePerThousand(
    stage.MonsterDropItemRate,
    `stage ${stage.StageKey} monster drop chance`,
  );
  const unresolvedMonsterKeys: number[] = [];
  const waveMonsters = stage.Monsters.split(" ").map((entry) => {
    const [monsterKeyText, weightText] = entry.split("_");
    const monsterKey = Number(monsterKeyText);
    const weight = Number(weightText);
    requirePositiveSafeInteger(
      monsterKey,
      `stage ${stage.StageKey} wave monster key`,
    );
    requirePositiveSafeInteger(
      weight,
      `stage ${stage.StageKey} wave monster weight`,
    );
    if (!indexes.tables.monsters.groups.has(monsterKey)) {
      unresolvedMonsterKeys.push(monsterKey);
    }
    return Object.freeze({ monsterKey, weight });
  });

  return Object.freeze({
    stageKey: stage.StageKey,
    stageLevel: stage.StageLevel,
    kind: "normal",
    waveAmount: stage.WaveAmount,
    waveMonsterAmount: stage.WaveMonsterAmount,
    waveMonsters: Object.freeze(waveMonsters),
    unresolvedMonsterKeys: Object.freeze([...new Set(unresolvedMonsterKeys)]),
    bossMonsterKey: stage.BossMonsterKey,
    monsterDrop: Object.freeze({
      dropKey: stage.MonsterDropItemKey,
      chancePerThousand: stage.MonsterDropItemRate,
    }),
    bossDrop: Object.freeze({
      dropKey: stage.BossDropItemKey,
      chancePerThousand: stage.BossDropItemRate,
    }),
    firstClearDropKey: stage.FirstClearDropKey,
  });
}

export function rollPerThousand(chance: number, rng: RandomSource): boolean {
  requirePerThousand(chance, "chance");
  if (chance === 0) return false;
  if (chance === 1000) return true;
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error("chance RNG must return a value in [0, 1)");
  }
  return roll * 1000 < chance;
}

interface CampaignSimulationInput {
  readonly indexes: DiscordHeroCatalogIndexes;
  readonly stageKey: number;
  readonly state: Readonly<unknown>;
  readonly rng: RandomSource;
  readonly [key: string]: unknown;
}

export function simulateCampaignStage(input: CampaignSimulationInput): never {
  rejectUnknownFields(
    input,
    ["indexes", "stageKey", "state", "rng"],
    "campaign simulation input",
  );
  const encounter = stageEncounter(input.indexes, {
    stageKey: input.stageKey,
  });
  if (encounter.unresolvedMonsterKeys.length > 0) {
    throw new OracleRequiredError(
      `stage ${encounter.stageKey} references unresolved source monster key ` +
        encounter.unresolvedMonsterKeys.join(", "),
    );
  }
  throw new OracleRequiredError(
    "formation, target/status order, combat cadence, death/revive, and " +
      "reward choice require a runtime oracle",
  );
}

function rejectUnknownFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unknown !== undefined) {
    throw new Error(`${context} has unknown field ${unknown}`);
  }
}

function requirePositiveSafeInteger(
  value: number | null,
  context: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireOptionalPositiveSafeInteger(
  value: number | null,
  context: string,
): void {
  if (value !== null) requirePositiveSafeInteger(value, context);
}

function requirePerThousand(
  value: number | null,
  context: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0 || (value ?? 1001) > 1000) {
    throw new Error(`${context} must be a safe integer between 0 and 1000`);
  }
}

function requireOptionalPerThousand(
  value: number | null,
  context: string,
): void {
  if (value !== null) requirePerThousand(value, context);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
