import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import {
  arrangePartySlot,
  type DiscordHeroFormationCapacity,
  type DiscordHeroPartySlot,
} from "../domain/party";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import { OutcomePositiveIntegerSchema } from "./outcome-schemas";

export interface ArrangePartyInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly expectedRevision: number;
  readonly targetSlot: number;
  readonly selectedHeroKey: number;
  readonly nowMs: number;
}

export type ArrangePartyOutcome =
  | Readonly<{
      kind: "arranged";
      transition: "fill" | "replace" | "swap";
      targetSlot: DiscordHeroPartySlot;
      selectedHeroKey: number;
      previousHeroKey: number | null;
      sourceSlot: DiscordHeroPartySlot | null;
    }>
  | Readonly<{ kind: "unchanged" }>
  | Readonly<{ kind: "slot-locked"; capacity: DiscordHeroFormationCapacity }>
  | Readonly<{ kind: "hero-not-owned" }>
  | Readonly<{ kind: "stage-active" }>
  | Readonly<{ kind: "invalid-target" }>;

interface PartyRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const PartySlotSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const ArrangePartyOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("arranged"),
      transition: z.union([
        z.literal("fill"),
        z.literal("replace"),
        z.literal("swap"),
      ]),
      targetSlot: PartySlotSchema,
      selectedHeroKey: OutcomePositiveIntegerSchema,
      previousHeroKey: OutcomePositiveIntegerSchema.nullable(),
      sourceSlot: PartySlotSchema.nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("unchanged") }).strict(),
  z
    .object({ kind: z.literal("slot-locked"), capacity: PartySlotSchema })
    .strict(),
  z.object({ kind: z.literal("hero-not-owned") }).strict(),
  z.object({ kind: z.literal("stage-active") }).strict(),
  z.object({ kind: z.literal("invalid-target") }).strict(),
]);

export function decodeDiscordHeroArrangePartyOutcome(
  value: unknown,
): ArrangePartyOutcome {
  return ArrangePartyOutcomeSchema.parse(value) as ArrangePartyOutcome;
}

function requireInput(input: ArrangePartyInput): void {
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new Error("DiscordHero userId must be a Discord snowflake");
  }
  if (input.interactionId.length < 1 || input.interactionId.length > 200) {
    throw new Error("DiscordHero interactionId must contain 1-200 characters");
  }
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    throw new Error(
      "DiscordHero expectedRevision must be a positive safe integer",
    );
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(targetSlot: number, selectedHeroKey: number): string {
  return createHash("sha256")
    .update(
      `discordhero.arrange-party/v1\ntargetSlot=${targetSlot}\nselectedHeroKey=${selectedHeroKey}`,
    )
    .digest("hex");
}

/**
 * The transaction shell around the pure formation transition. Only a "changed"
 * result commits; every deterministic refusal is recorded as a replayable
 * rejection that leaves the revision alone.
 */
export function arrangeDiscordHeroParty(
  repository: PartyRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: ArrangePartyInput,
): PlayerTransactionResult<ArrangePartyOutcome> {
  requireInput(input);

  return repository.transactPlayer<ArrangePartyOutcome>({
    scope: "discordhero.party",
    interactionId: input.interactionId,
    operation: "arrange-party",
    requestSha256: requestSha256(input.targetSlot, input.selectedHeroKey),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroArrangePartyOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      // Defensive invariant, not a domain outcome: with a positive
      // expectedRevision the repository compares the absent row's null
      // revision first and throws before ever calling this.
      if (current === null) {
        throw new Error("arrange-party mutation requires an existing player");
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = arrangePartySlot(
        indexes,
        current,
        input.targetSlot,
        input.selectedHeroKey,
      );
      if (result.kind !== "changed") {
        return { kind: "reject", outcome: result };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      return {
        kind: "commit",
        state: result.state,
        outcome: {
          kind: "arranged",
          transition: result.transition,
          targetSlot: result.targetSlot,
          selectedHeroKey: result.selectedHeroKey,
          previousHeroKey: result.previousHeroKey,
          sourceSlot: result.sourceSlot,
        },
      };
    },
  });
}
