import type {
  DiscordHeroCatalogIndexes,
  DiscordHeroDatasetRow,
} from "../catalog/indexes";
import { createCampaignGraph, stageEncounter } from "../domain/campaign";
import {
  projectStageMonsterBaseStats,
  type StageMonsterBaseStats,
} from "../domain/monster-scaling";

const STAGE_PAGE_SIZE = 25;

export type DiscordHeroStageRow = DiscordHeroDatasetRow<"stages">;

export type DiscordHeroStageMonsterSourceRow =
  | Readonly<{
      status: "resolved";
      role: "wave";
      monsterKey: number;
      sourceWeightRaw: number;
      stats: StageMonsterBaseStats;
    }>
  | Readonly<{
      status: "unresolved-source-row";
      role: "wave";
      monsterKey: number;
      sourceWeightRaw: number;
      stats: null;
    }>
  | Readonly<{
      status: "resolved";
      role: "boss";
      monsterKey: number;
      sourceWeightRaw: null;
      stats: StageMonsterBaseStats;
    }>;

export type DiscordHeroMonsterAttackSource = Readonly<{
  skillKey: number | string;
  skillRefStatus: "resolved-exact" | "unresolved-exact-source-ref";
  activation: string;
  damageType: string;
  deliveryType: string;
  range: number;
  value: number | string;
  sound: number | string;
}>;

export type DiscordHeroMonsterAttackKit = Readonly<{
  monsterKey: number;
  provenance:
    | Readonly<{ kind: "raw" }>
    | Readonly<{
        kind: "pinned-enrichment";
        sourceSha256: string;
      }>;
  primaryAttack: DiscordHeroMonsterAttackSource;
  attacks: readonly DiscordHeroMonsterAttackSource[];
  attackElements: readonly string[];
}>;

function projectMonsterAttackSource(
  indexes: DiscordHeroCatalogIndexes,
  monsterKey: number,
  position: "primary" | number,
  source: unknown,
): DiscordHeroMonsterAttackSource {
  const label =
    position === "primary" ? "primary" : `ordered attack ${position + 1}`;
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(
      `DiscordHero monster ${monsterKey} has malformed attack at ${label}`,
    );
  }
  const attack = source as Record<string, unknown>;
  const skillKey = attack.skillKey;
  const value = attack.value;
  const sound = attack.sound;
  if (
    !(
      (typeof skillKey === "number" &&
        Number.isSafeInteger(skillKey) &&
        skillKey > 0) ||
      (typeof skillKey === "string" && skillKey.trim().length > 0)
    ) ||
    !["BASEATTACK", "BASEATTACK_COUNT", "COOLDOWN"].includes(
      String(attack.activation),
    ) ||
    !["Physical", "Chaos", "Fire", "Cold", "Lightning"].includes(
      String(attack.damageType),
    ) ||
    typeof attack.deliveryType !== "string" ||
    typeof attack.range !== "number" ||
    !Number.isFinite(attack.range) ||
    attack.range < 0 ||
    !(
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.trim().length > 0)
    ) ||
    !(
      (typeof sound === "number" &&
        Number.isSafeInteger(sound) &&
        sound >= 0) ||
      (typeof sound === "string" && sound.trim().length > 0)
    )
  ) {
    throw new Error(
      `DiscordHero monster ${monsterKey} has malformed attack at ${label}`,
    );
  }
  return Object.freeze({
    skillKey,
    skillRefStatus:
      indexes.tables.skills.groups.get(skillKey) === undefined
        ? "unresolved-exact-source-ref"
        : "resolved-exact",
    activation: attack.activation as string,
    damageType: attack.damageType as string,
    deliveryType: attack.deliveryType,
    range: attack.range,
    value,
    sound,
  });
}

export function projectDiscordHeroMonsterAttackKits(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroMonsterAttackKit[] {
  if (indexes.tables.monsters.rows.length !== 61) {
    throw new Error(
      `DiscordHero Monster Attack-Kit source expected 61 monsters, received ${indexes.tables.monsters.rows.length}`,
    );
  }

  const rawMonsterKeys = new Set<number>();
  const enrichmentMonsterKeys = new Set<number>();
  for (const monster of indexes.tables.monsters.rows) {
    const hasAttack = monster.attack !== undefined;
    const hasAttacks = monster.attacks !== undefined;
    const hasAttackElements = monster.attackElements !== undefined;
    const rawFieldCount =
      Number(hasAttack) + Number(hasAttacks) + Number(hasAttackElements);
    if (rawFieldCount === 3) {
      rawMonsterKeys.add(monster.MonsterKey);
    } else if (rawFieldCount === 0) {
      enrichmentMonsterKeys.add(monster.MonsterKey);
    } else {
      throw new Error(
        `DiscordHero monster ${monster.MonsterKey} has partial raw attack-kit`,
      );
    }
  }
  if (rawMonsterKeys.size !== 28 || enrichmentMonsterKeys.size !== 33) {
    throw new Error(
      `DiscordHero Monster Attack-Kit source expected 28 raw and 33 enrichment rows, received ${rawMonsterKeys.size} raw and ${enrichmentMonsterKeys.size} enrichment`,
    );
  }

  const enrichments = indexes.catalog.semantic.monsterAttacks.enrichments;
  if (enrichments.length !== 33) {
    throw new Error(
      `DiscordHero Monster Attack-Kit source expected 33 pinned enrichments, received ${enrichments.length}`,
    );
  }
  const enrichmentByMonsterKey = new Map<
    number,
    (typeof enrichments)[number]
  >();
  for (const enrichment of enrichments) {
    if (
      !Number.isSafeInteger(enrichment.MonsterKey) ||
      !enrichmentMonsterKeys.has(enrichment.MonsterKey) ||
      enrichmentByMonsterKey.has(enrichment.MonsterKey)
    ) {
      throw new Error(
        `DiscordHero Monster Attack-Kit enrichment primary key ${enrichment.MonsterKey} does not match one missing raw monster row`,
      );
    }
    if (!/^[a-f0-9]{64}$/.test(enrichment.sourceSha256)) {
      throw new Error(
        `DiscordHero monster ${enrichment.MonsterKey} has malformed enrichment source SHA`,
      );
    }
    enrichmentByMonsterKey.set(enrichment.MonsterKey, enrichment);
  }

  let attackCount = 0;
  const kits = indexes.tables.monsters.rows.map((monster) => {
    const source = rawMonsterKeys.has(monster.MonsterKey)
      ? {
          provenance: Object.freeze({ kind: "raw" as const }),
          attack: monster.attack,
          attacks: monster.attacks,
          attackElements: monster.attackElements,
        }
      : (() => {
          const enrichment = enrichmentByMonsterKey.get(monster.MonsterKey);
          if (enrichment === undefined) {
            throw new Error(
              `DiscordHero Monster Attack-Kit enrichment primary key is missing monster ${monster.MonsterKey}`,
            );
          }
          return {
            provenance: Object.freeze({
              kind: "pinned-enrichment" as const,
              sourceSha256: enrichment.sourceSha256,
            }),
            attack: enrichment.attack,
            attacks: enrichment.attacks,
            attackElements: enrichment.attackElements,
          };
        })();
    if (!Array.isArray(source.attacks) || source.attacks.length === 0) {
      throw new Error(
        `DiscordHero monster ${monster.MonsterKey} has malformed attack list`,
      );
    }
    if (
      !Array.isArray(source.attackElements) ||
      source.attackElements.length === 0 ||
      source.attackElements.some(
        (element) => typeof element !== "string" || element.trim().length === 0,
      )
    ) {
      throw new Error(
        `DiscordHero monster ${monster.MonsterKey} has malformed attack elements`,
      );
    }
    const attacks = source.attacks.map((attack, index) =>
      projectMonsterAttackSource(indexes, monster.MonsterKey, index, attack),
    );
    attackCount += attacks.length;
    return Object.freeze({
      monsterKey: monster.MonsterKey,
      provenance: source.provenance,
      primaryAttack: projectMonsterAttackSource(
        indexes,
        monster.MonsterKey,
        "primary",
        source.attack,
      ),
      attacks: Object.freeze(attacks),
      attackElements: Object.freeze([...source.attackElements]),
    });
  });
  if (attackCount !== 91) {
    throw new Error(
      `DiscordHero Monster Attack-Kit source expected 91 ordered attacks, received ${attackCount}`,
    );
  }
  return Object.freeze(kits);
}

export function projectDiscordHeroStageMonsterSourceRows(
  indexes: DiscordHeroCatalogIndexes,
  stageKey: number,
): readonly DiscordHeroStageMonsterSourceRow[] {
  const encounter = stageEncounter(indexes, { stageKey });
  const unresolvedMonsterKeys = new Set(encounter.unresolvedMonsterKeys);
  const rows: DiscordHeroStageMonsterSourceRow[] = encounter.waveMonsters.map(
    (monster) => {
      if (unresolvedMonsterKeys.has(monster.monsterKey)) {
        return Object.freeze({
          status: "unresolved-source-row",
          role: "wave",
          monsterKey: monster.monsterKey,
          sourceWeightRaw: monster.weight,
          stats: null,
        });
      }
      return Object.freeze({
        status: "resolved",
        role: "wave",
        monsterKey: monster.monsterKey,
        sourceWeightRaw: monster.weight,
        stats: projectStageMonsterBaseStats(indexes, {
          stageKey,
          monsterKey: monster.monsterKey,
          role: "wave",
        }),
      });
    },
  );
  rows.push(
    Object.freeze({
      status: "resolved",
      role: "boss",
      monsterKey: encounter.bossMonsterKey,
      sourceWeightRaw: null,
      stats: projectStageMonsterBaseStats(indexes, {
        stageKey,
        monsterKey: encounter.bossMonsterKey,
        role: "boss",
      }),
    }),
  );
  return Object.freeze(rows);
}

export type DiscordHeroRouteEntry = Readonly<{
  stageKey: number;
  routeIndex: number;
  previousStageKey: number | null;
  nextStageKey: number | null;
  sourceAct: number;
  sourceStageNo: number;
  isRouteStart: boolean;
  isRouteEnd: boolean;
  isActStart: boolean;
  isActEnd: boolean;
}>;

export function projectDiscordHeroSourceRoute(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroRouteEntry[] {
  // The source campaign graph already proves exactly 120 stages, one root,
  // one final stage, no cycle, and full reachability. Reuse it rather than
  // re-deriving a second graph model here.
  const graph = createCampaignGraph(indexes);
  const byKey = new Map(graph.stages.map((stage) => [stage.StageKey, stage]));
  const chain: DiscordHeroStageRow[] = [];
  let cursor = byKey.get(graph.rootStageKey);
  while (cursor !== undefined) {
    chain.push(cursor);
    cursor =
      cursor.NextStageKey === null ? undefined : byKey.get(cursor.NextStageKey);
  }
  if (chain.length !== graph.stages.length) {
    throw new Error(
      `DiscordHero source route walked ${chain.length} of ${graph.stages.length} stages`,
    );
  }

  const route = Object.freeze(
    chain.map((stage, routeIndex): DiscordHeroRouteEntry => {
      const previous = routeIndex === 0 ? null : chain[routeIndex - 1]!;
      const next =
        routeIndex === chain.length - 1 ? null : chain[routeIndex + 1]!;
      return Object.freeze({
        stageKey: stage.StageKey,
        routeIndex,
        previousStageKey: previous === null ? null : previous.StageKey,
        nextStageKey: next === null ? null : next.StageKey,
        sourceAct: stage.Act,
        sourceStageNo: stage.StageNo,
        isRouteStart: previous === null,
        isRouteEnd: next === null,
        isActStart: previous === null || previous.Act !== stage.Act,
        isActEnd: next === null || next.Act !== stage.Act,
      });
    }),
  );
  return route;
}

export function discordHeroRouteEntry(
  indexes: DiscordHeroCatalogIndexes,
  stageKey: number,
): DiscordHeroRouteEntry {
  const entry = projectDiscordHeroSourceRoute(indexes).find(
    (candidate) => candidate.stageKey === stageKey,
  );
  if (entry === undefined) {
    throw new Error(`DiscordHero stage ${stageKey} is not on the source route`);
  }
  return entry;
}

export function discordHeroStagePageCount(
  indexes: DiscordHeroCatalogIndexes,
): number {
  return Math.ceil(indexes.tables.stages.rows.length / STAGE_PAGE_SIZE);
}

export function discordHeroStages(
  indexes: DiscordHeroCatalogIndexes,
  page: number,
): readonly DiscordHeroStageRow[] {
  const pageCount = discordHeroStagePageCount(indexes);
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(
      `DiscordHero stage page ${page} is outside 0-${pageCount - 1}`,
    );
  }
  const start = page * STAGE_PAGE_SIZE;
  return indexes.tables.stages.rows.slice(start, start + STAGE_PAGE_SIZE);
}

export function encodeDiscordHeroStagePage(page: number): string {
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new Error(
      "DiscordHero stage page must be a non-negative safe integer",
    );
  }
  return `w-${page.toString(36)}`;
}

export function decodeDiscordHeroStagePage(value: string): number {
  if (!/^w-[0-9a-z]+$/.test(value)) {
    throw new Error("DiscordHero stage page has invalid encoding");
  }
  const encoded = value.slice(2);
  const page = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page.toString(36) !== encoded
  ) {
    throw new Error("DiscordHero stage page has non-canonical encoding");
  }
  return page;
}

export function decodeDiscordHeroStageKey(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      "DiscordHero stage key must be a canonical positive integer",
    );
  }
  const stageKey = Number(value);
  if (!Number.isSafeInteger(stageKey) || String(stageKey) !== value) {
    throw new Error("DiscordHero stage key must be a safe canonical integer");
  }
  return stageKey;
}
