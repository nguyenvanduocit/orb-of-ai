import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import { upgradeRune } from "../domain/runes";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import {
  OutcomeNonEmptyStringSchema,
  OutcomePositiveIntegerSchema,
  OutcomeUnsignedIntegerSchema,
} from "./outcome-schemas";

export interface UpgradeRuneInput {
  userId: string;
  interactionId: string;
  expectedRevision: number | null;
  runeKey: number;
  nowMs: number;
}

export type UpgradeRuneOutcome =
  | {
      kind: "upgraded";
      runeKey: number;
      name: string;
      level: number;
      cost: number;
      gold: number;
      statType: string;
      value: number;
    }
  | {
      kind: "insufficient-gold";
      runeKey: number;
      name: string;
      nextLevel: number;
      cost: number;
      availableGold: number;
    }
  | {
      kind: "maximum-level";
      runeKey: number;
      name: string;
      level: number;
    }
  | {
      kind: "unsupported-effect";
      runeKey: number;
      name: string;
      currentLevel: number;
      nextLevel: number;
      cost: number;
      statType: string;
      value: number;
    }
  | {
      kind: "prerequisite-locked";
      runeKey: number;
      name: string;
      currentLevel: number;
      requiredLevel: number;
      predecessorKeys: readonly number[];
    }
  | { kind: "player-not-found" };

interface RuneRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const PredecessorKeysSchema = z
  .array(OutcomePositiveIntegerSchema)
  .min(1)
  .max(197)
  .refine(
    (keys) => new Set(keys).size === keys.length,
    "predecessor Rune keys must be unique",
  );
const UpgradeRuneOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("upgraded"),
      runeKey: OutcomePositiveIntegerSchema,
      name: OutcomeNonEmptyStringSchema,
      level: OutcomePositiveIntegerSchema,
      cost: OutcomeUnsignedIntegerSchema,
      gold: OutcomeUnsignedIntegerSchema,
      statType: OutcomeNonEmptyStringSchema,
      value: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("insufficient-gold"),
      runeKey: OutcomePositiveIntegerSchema,
      name: OutcomeNonEmptyStringSchema,
      nextLevel: OutcomePositiveIntegerSchema,
      cost: OutcomeUnsignedIntegerSchema,
      availableGold: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("maximum-level"),
      runeKey: OutcomePositiveIntegerSchema,
      name: OutcomeNonEmptyStringSchema,
      level: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("unsupported-effect"),
      runeKey: OutcomePositiveIntegerSchema,
      name: OutcomeNonEmptyStringSchema,
      currentLevel: OutcomeUnsignedIntegerSchema,
      nextLevel: OutcomePositiveIntegerSchema,
      cost: OutcomePositiveIntegerSchema,
      statType: OutcomeNonEmptyStringSchema,
      value: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("prerequisite-locked"),
      runeKey: OutcomePositiveIntegerSchema,
      name: OutcomeNonEmptyStringSchema,
      currentLevel: OutcomeUnsignedIntegerSchema,
      requiredLevel: OutcomePositiveIntegerSchema,
      predecessorKeys: PredecessorKeysSchema,
    })
    .strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroUpgradeRuneOutcome(
  value: unknown,
): UpgradeRuneOutcome {
  return UpgradeRuneOutcomeSchema.parse(value);
}

function requireInput(input: UpgradeRuneInput): void {
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
  if (!Number.isSafeInteger(input.runeKey) || input.runeKey < 1) {
    throw new Error("DiscordHero runeKey must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(runeKey: number): string {
  return createHash("sha256")
    .update(`discordhero.upgrade-rune/v1\nruneKey=${runeKey}`)
    .digest("hex");
}

export function upgradeDiscordHeroRune(
  repository: RuneRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: UpgradeRuneInput,
): PlayerTransactionResult<UpgradeRuneOutcome> {
  requireInput(input);
  return repository.transactPlayer<UpgradeRuneOutcome>({
    scope: "discordhero.runes",
    interactionId: input.interactionId,
    operation: "upgrade-rune",
    requestSha256: requestSha256(input.runeKey),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroUpgradeRuneOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = upgradeRune(indexes, current, input.runeKey);
      if (result.kind !== "upgraded") {
        return { kind: "reject", outcome: result };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      return {
        kind: "commit",
        state: result.state,
        outcome: {
          kind: "upgraded",
          runeKey: result.runeKey,
          name: result.name,
          level: result.level,
          cost: result.cost,
          gold: result.state.gold,
          statType: result.statType,
          value: result.value,
        },
      };
    },
  });
}
