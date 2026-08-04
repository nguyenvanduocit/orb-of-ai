import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import { unlockCubeRecipe } from "../domain/cube-unlocks";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import {
  OutcomeNonEmptyStringSchema,
  OutcomePositiveIntegerSchema,
  OutcomeUnsignedIntegerSchema,
} from "./outcome-schemas";

export interface UnlockCubeRecipeInput {
  userId: string;
  interactionId: string;
  expectedRevision: number | null;
  cubeKey: number;
  nowMs: number;
}

export type UnlockCubeRecipeOutcome =
  | {
      kind: "unlocked";
      cubeKey: number;
      defaultSubRecipeKeys: readonly number[];
      recipeType: string;
      cost: number;
      gold: number;
    }
  | {
      kind: "insufficient-gold";
      cubeKey: number;
      recipeType: string;
      requiredCubeLevel: number;
      cost: number;
      availableGold: number;
    }
  | {
      kind: "already-unlocked";
      cubeKey: number;
      recipeType: string;
    }
  | {
      kind: "level-locked";
      cubeKey: number;
      recipeType: string;
      requiredCubeLevel: number;
      currentCubeLevel: number;
    }
  | { kind: "player-not-found" };

interface CubeUnlockRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const CubeRecipeKeySchema = OutcomePositiveIntegerSchema;
const CubeRecipeTypeSchema = OutcomeNonEmptyStringSchema;
const DefaultSubRecipeKeysSchema = z
  .array(CubeRecipeKeySchema)
  .max(100)
  .refine(
    (keys) => new Set(keys).size === keys.length,
    "default sub-recipe keys must be unique",
  );
const UnlockCubeRecipeOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("unlocked"),
      cubeKey: CubeRecipeKeySchema,
      defaultSubRecipeKeys: DefaultSubRecipeKeysSchema,
      recipeType: CubeRecipeTypeSchema,
      cost: OutcomeUnsignedIntegerSchema,
      gold: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("insufficient-gold"),
      cubeKey: CubeRecipeKeySchema,
      recipeType: CubeRecipeTypeSchema,
      requiredCubeLevel: OutcomePositiveIntegerSchema,
      cost: OutcomeUnsignedIntegerSchema,
      availableGold: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("already-unlocked"),
      cubeKey: CubeRecipeKeySchema,
      recipeType: CubeRecipeTypeSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("level-locked"),
      cubeKey: CubeRecipeKeySchema,
      recipeType: CubeRecipeTypeSchema,
      requiredCubeLevel: OutcomePositiveIntegerSchema,
      currentCubeLevel: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroUnlockCubeRecipeOutcome(
  value: unknown,
): UnlockCubeRecipeOutcome {
  return UnlockCubeRecipeOutcomeSchema.parse(value);
}

function requireInput(input: UnlockCubeRecipeInput): void {
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
  if (!Number.isSafeInteger(input.cubeKey) || input.cubeKey < 1) {
    throw new Error("DiscordHero cubeKey must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(cubeKey: number): string {
  return createHash("sha256")
    .update(`discordhero.unlock-cube-recipe/v1\ncubeKey=${cubeKey}`)
    .digest("hex");
}

export function unlockDiscordHeroCubeRecipe(
  repository: CubeUnlockRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: UnlockCubeRecipeInput,
): PlayerTransactionResult<UnlockCubeRecipeOutcome> {
  requireInput(input);
  return repository.transactPlayer<UnlockCubeRecipeOutcome>({
    scope: "discordhero.cube",
    interactionId: input.interactionId,
    operation: "unlock-cube-recipe",
    requestSha256: requestSha256(input.cubeKey),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroUnlockCubeRecipeOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = unlockCubeRecipe(indexes, current, input.cubeKey);
      if (result.kind !== "unlocked") {
        return {
          kind: "reject",
          outcome: result,
        };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      return {
        kind: "commit",
        state: result.state,
        outcome: {
          kind: "unlocked",
          cubeKey: result.cubeKey,
          defaultSubRecipeKeys: result.defaultSubRecipeKeys,
          recipeType: result.recipeType,
          cost: result.cost,
          gold: result.state.gold,
        },
      };
    },
  });
}
