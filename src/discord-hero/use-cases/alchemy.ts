import { createHash } from "node:crypto";
import { z } from "zod";
import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import {
  advanceCubeLevel,
  createCubeLevelCurve,
  cubeExperienceToReachLevel,
} from "../domain/cube";
import { executeAlchemy } from "../domain/crafting";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type { InventoryDebit } from "../domain/items";
import { resolveRuneLevelRows } from "../domain/rune-levels";
import type {
  PlayerTransaction,
  PlayerTransactionReceiptQuery,
  PlayerTransactionResult,
} from "../state/repository";
import {
  OutcomePositiveIntegerSchema,
  OutcomeUnsignedIntegerSchema,
} from "./outcome-schemas";

export interface AlchemizeItemsInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly expectedRevision: number | null;
  readonly inventorySlotIndexes: readonly number[];
  readonly nowMs: number;
}

export type AlchemizeItemsOutcome =
  | {
      readonly kind: "alchemized";
      readonly consumedItems: number;
      readonly goldGained: number;
      readonly cubeExperienceGained: number;
      readonly gold: number;
      readonly cubeLevel: number;
      readonly cubeXp: number;
    }
  | { readonly kind: "recipe-locked" }
  | { readonly kind: "player-not-found" };

interface AlchemyRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const AlchemizeItemsOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("alchemized"),
      consumedItems: OutcomePositiveIntegerSchema.max(9),
      goldGained: OutcomeUnsignedIntegerSchema,
      cubeExperienceGained: OutcomeUnsignedIntegerSchema,
      gold: OutcomeUnsignedIntegerSchema,
      cubeLevel: OutcomePositiveIntegerSchema,
      cubeXp: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z.object({ kind: z.literal("recipe-locked") }).strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroAlchemyOutcome(
  value: unknown,
): AlchemizeItemsOutcome {
  return AlchemizeItemsOutcomeSchema.parse(value);
}

function safeAdd(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${context} produced an unsafe integer`);
  }
  return result;
}

function normalizeInventorySlotIndexes(
  inventorySlotIndexes: readonly number[],
): readonly number[] {
  if (!Array.isArray(inventorySlotIndexes)) {
    throw new Error(
      "DiscordHero Alchemy Inventory slot indexes must be an array",
    );
  }
  if (inventorySlotIndexes.length < 1 || inventorySlotIndexes.length > 9) {
    throw new Error(
      "DiscordHero Alchemy Inventory slot selection must contain between 1 and 9 indexes",
    );
  }
  const normalized = new Set<number>();
  for (const [position, slotIndex] of inventorySlotIndexes.entries()) {
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) {
      throw new Error(
        `DiscordHero Alchemy Inventory slot index ${position} must be a non-negative safe integer`,
      );
    }
    if (normalized.has(slotIndex)) {
      throw new Error(
        `DiscordHero Alchemy Inventory slot selection repeats index ${slotIndex}`,
      );
    }
    normalized.add(slotIndex);
  }
  return Object.freeze([...normalized].sort((left, right) => left - right));
}

function requireInput(input: AlchemizeItemsInput): readonly number[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("DiscordHero Alchemy input must be an object");
  }
  const allowedFields = new Set([
    "userId",
    "interactionId",
    "expectedRevision",
    "inventorySlotIndexes",
    "nowMs",
  ]);
  const unknownField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField !== undefined) {
    throw new Error(
      `DiscordHero Alchemy input has unknown field ${unknownField}`,
    );
  }
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new Error("DiscordHero userId must be a Discord snowflake");
  }
  if (input.interactionId.length < 1 || input.interactionId.length > 200) {
    throw new Error("DiscordHero interactionId must contain 1-200 characters");
  }
  if (
    input.expectedRevision !== null &&
    (!Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 1)
  ) {
    throw new Error(
      "DiscordHero expectedRevision must be null or a positive safe integer",
    );
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
  return normalizeInventorySlotIndexes(input.inventorySlotIndexes);
}

function requestSha256(inventorySlotIndexes: readonly number[]): string {
  return createHash("sha256")
    .update(
      `discordhero.alchemy/v2\ninventorySlotIndexes=${JSON.stringify(inventorySlotIndexes)}`,
    )
    .digest("hex");
}

export function createDiscordHeroAlchemyReceiptQuery(
  input: AlchemizeItemsInput,
): PlayerTransactionReceiptQuery<AlchemizeItemsOutcome> {
  const inventorySlotIndexes = requireInput(input);
  return Object.freeze({
    scope: "discordhero.cube",
    interactionId: input.interactionId,
    operation: "alchemy",
    requestSha256: requestSha256(inventorySlotIndexes),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroAlchemyOutcome,
  });
}

function runeBonuses(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: readonly Readonly<{ key: number; level: number }>[],
): { cubeExperience: number; alchemyGold: number } {
  let cubeExperience = 0;
  let alchemyGold = 0;
  for (const owned of ownedRunes) {
    const rune = getCatalogRow(indexes, "runes", owned.key);
    const rows = resolveRuneLevelRows(indexes, rune).reachable.slice(
      0,
      owned.level,
    );
    for (const row of rows) {
      if (row.STATTYPE === "CubeExpPercent") {
        cubeExperience = safeAdd(
          cubeExperience,
          row.Value,
          "DiscordHero Alchemy Cube EXP bonus",
        );
      }
      if (row.STATTYPE === "CubeAlchemyGoldPercent") {
        alchemyGold = safeAdd(
          alchemyGold,
          row.Value,
          "DiscordHero Alchemy gold bonus",
        );
      }
    }
  }
  return { cubeExperience, alchemyGold };
}

export function alchemizeDiscordHeroItems(
  repository: AlchemyRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: AlchemizeItemsInput,
): PlayerTransactionResult<AlchemizeItemsOutcome> {
  const inventorySlotIndexes = requireInput(input);
  const receiptQuery = createDiscordHeroAlchemyReceiptQuery(input);
  return repository.transactPlayer<AlchemizeItemsOutcome>({
    ...receiptQuery,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      const state = validatePlayerAgainstCatalog(current, indexes);
      if (
        !state.cube.unlockedRecipes.includes(200001) ||
        !state.cube.unlockedSubRecipes.includes(200011)
      ) {
        return {
          kind: "reject",
          outcome: { kind: "recipe-locked" },
        };
      }
      const slotsByIndex = new Map(
        state.containers.inventory.slots.map((slot) => [slot.index, slot]),
      );
      const materials = inventorySlotIndexes.map(
        (slotIndex): InventoryDebit => {
          const slot = slotsByIndex.get(slotIndex);
          if (slot === undefined) {
            throw new Error(
              `DiscordHero Alchemy Inventory slot ${slotIndex} is not occupied at revision ${input.expectedRevision}`,
            );
          }
          return slot.asset.kind === "gear"
            ? { kind: "gear", instanceId: slot.asset.instanceId }
            : { kind: "stack", itemKey: slot.asset.itemKey, quantity: 1 };
        },
      );

      const curve = createCubeLevelCurve(
        indexes.tables.cube_levels.rows.map((row) => ({
          level: row.Level,
          experienceForLevelUp: row.ExpForLevelUp,
        })),
      );
      const cumulativeBefore = safeAdd(
        cubeExperienceToReachLevel(curve, state.cube.level),
        state.cube.xp,
        "DiscordHero cumulative Cube experience",
      );
      const result = executeAlchemy({
        state: {
          inventory: state.containers.inventory,
          gold: state.gold,
          cubeExperience: cumulativeBefore,
          cubeLevel: state.cube.level,
        },
        materials,
        source: {
          items: indexes.tables.items.rows,
          gear: indexes.tables.gear.rows,
          grades: indexes.tables.grades.rows,
          itemLevelScales: indexes.tables.item_level_scales.rows,
          gearTypeScales: indexes.tables.gear_type_scales.rows,
          itemTypeScales: indexes.tables.item_type_scales.rows,
        },
        bonuses: runeBonuses(indexes, state.runes),
      });
      const cubeProgress = advanceCubeLevel(curve, result.cubeExperience);
      const next = {
        ...state,
        gold: result.gold,
        containers: {
          ...state.containers,
          inventory: result.inventory,
        },
        cube: {
          ...state.cube,
          level: cubeProgress.level,
          xp: cubeProgress.experience,
        },
      };
      validatePlayerAgainstCatalog(next, indexes, state);
      return {
        kind: "commit",
        state: next,
        outcome: {
          kind: "alchemized",
          consumedItems: inventorySlotIndexes.length,
          goldGained: result.gold - state.gold,
          cubeExperienceGained: result.cubeExperience - cumulativeBefore,
          gold: result.gold,
          cubeLevel: cubeProgress.level,
          cubeXp: cubeProgress.experience,
        },
      };
    },
  });
}
