import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../domain/invariants";
import {
  discordHeroStarterCandidates,
  DISCORD_HERO_STARTER_KEYS,
  type DiscordHeroStarterKey,
} from "../domain/party";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";

export interface SelectStarterInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly starterHeroKey: number;
  readonly nowMs: number;
}

export interface SelectStarterOutcome {
  readonly kind: "selected";
  readonly starterHeroKey: DiscordHeroStarterKey;
}

interface StarterRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const SelectStarterOutcomeSchema = z
  .object({
    kind: z.literal("selected"),
    // A receipt naming anything but a source starter is a corrupt record,
    // not a value to be honoured.
    starterHeroKey: z.union(
      DISCORD_HERO_STARTER_KEYS.map((key) => z.literal(key)),
    ),
  })
  .strict();

export function decodeDiscordHeroSelectStarterOutcome(
  value: unknown,
): SelectStarterOutcome {
  return SelectStarterOutcomeSchema.parse(value);
}

function requireInput(input: SelectStarterInput): void {
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new Error("DiscordHero userId must be a Discord snowflake");
  }
  if (input.interactionId.length < 1 || input.interactionId.length > 200) {
    throw new Error("DiscordHero interactionId must contain 1-200 characters");
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(starterHeroKey: number): string {
  return createHash("sha256")
    .update(`discordhero.select-starter/v1\nstarterHeroKey=${starterHeroKey}`)
    .digest("hex");
}

/**
 * The one path that brings a player into existence. It commits revision 1
 * atomically, so a rejected or forged choice leaves no row and no receipt
 * behind.
 */
export function selectDiscordHeroStarter(
  repository: StarterRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: SelectStarterInput,
): PlayerTransactionResult<SelectStarterOutcome> {
  requireInput(input);

  const candidates = discordHeroStarterCandidates(indexes);
  const chosen = candidates.find(
    (candidate) => candidate.heroKey === input.starterHeroKey,
  );
  if (chosen === undefined) {
    throw new Error(
      `DiscordHero starter ${input.starterHeroKey} is not a selectable candidate`,
    );
  }
  const starterHeroKey = chosen.heroKey;

  return repository.transactPlayer<SelectStarterOutcome>({
    scope: "discordhero.starter",
    interactionId: input.interactionId,
    operation: "select-starter",
    requestSha256: requestSha256(starterHeroKey),
    userId: input.userId,
    expectedRevision: null,
    decodeOutcome: decodeDiscordHeroSelectStarterOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current !== null) {
        throw new Error("starter selection expected a missing player");
      }
      const state = createFreshPlayerStateFromCatalog(indexes, starterHeroKey);
      validatePlayerAgainstCatalog(state, indexes);
      return {
        kind: "commit",
        state,
        outcome: { kind: "selected", starterHeroKey },
      };
    },
  });
}
