import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  DISCORD_HERO_CONTAINERS,
  unlockContainerSlot,
  type DiscordHeroContainer,
} from "../domain/containers";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import { OutcomeUnsignedIntegerSchema } from "./outcome-schemas";

export interface UnlockContainerSlotInput {
  userId: string;
  interactionId: string;
  expectedRevision: number | null;
  container: DiscordHeroContainer;
  nowMs: number;
}

export type UnlockContainerSlotOutcome =
  | {
      kind: "unlocked";
      container: DiscordHeroContainer;
      slotIndex: number;
      cost: number;
      gold: number;
      unlockedSlots: number;
    }
  | {
      kind: "insufficient-gold";
      container: DiscordHeroContainer;
      slotIndex: number;
      cost: number;
      availableGold: number;
    }
  | {
      kind: "maximum-capacity";
      container: DiscordHeroContainer;
      unlockedSlots: number;
    }
  | { kind: "player-not-found" };

interface ContainerRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const ContainerSchema = z.enum(DISCORD_HERO_CONTAINERS);
const UnlockContainerSlotOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("unlocked"),
      container: ContainerSchema,
      slotIndex: OutcomeUnsignedIntegerSchema,
      cost: OutcomeUnsignedIntegerSchema,
      gold: OutcomeUnsignedIntegerSchema,
      unlockedSlots: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("insufficient-gold"),
      container: ContainerSchema,
      slotIndex: OutcomeUnsignedIntegerSchema,
      cost: OutcomeUnsignedIntegerSchema,
      availableGold: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("maximum-capacity"),
      container: ContainerSchema,
      unlockedSlots: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroUnlockContainerSlotOutcome(
  value: unknown,
): UnlockContainerSlotOutcome {
  return UnlockContainerSlotOutcomeSchema.parse(value);
}

function requireInput(input: UnlockContainerSlotInput): void {
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
  if (!DISCORD_HERO_CONTAINERS.includes(input.container)) {
    throw new Error(`Unknown DiscordHero container ${String(input.container)}`);
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(container: DiscordHeroContainer): string {
  return createHash("sha256")
    .update(`discordhero.unlock-container-slot/v1\ncontainer=${container}`)
    .digest("hex");
}

export function unlockDiscordHeroContainerSlot(
  repository: ContainerRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: UnlockContainerSlotInput,
): PlayerTransactionResult<UnlockContainerSlotOutcome> {
  requireInput(input);
  return repository.transactPlayer<UnlockContainerSlotOutcome>({
    scope: "discordhero.inventory",
    interactionId: input.interactionId,
    operation: "unlock-container-slot",
    requestSha256: requestSha256(input.container),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroUnlockContainerSlotOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = unlockContainerSlot(indexes, current, input.container);
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
          container: result.container,
          slotIndex: result.slotIndex,
          cost: result.cost,
          gold: result.state.gold,
          unlockedSlots:
            result.state.containers[result.container].unlockedSlots,
        },
      };
    },
  });
}
