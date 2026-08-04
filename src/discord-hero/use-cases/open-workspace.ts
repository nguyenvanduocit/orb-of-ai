import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  DiscordHeroRevisionConflictError,
  type PlayerSnapshot,
  type PlayerTransaction,
  type PlayerTransactionResult,
} from "../state/repository";

const OPEN_REQUEST_SHA256 = createHash("sha256")
  .update("discordhero.open-workspace/v1")
  .digest("hex");

interface WorkspaceRepository {
  getPlayer(userId: string): PlayerSnapshot | null;
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

export interface OpenWorkspaceInput {
  userId: string;
  interactionId: string;
  nowMs: number;
}

export interface OpenWorkspaceResult {
  created: boolean;
  revision: number;
  state: PlayerState;
}

const OpenWorkspaceOutcomeSchema = z
  .object({ created: z.literal(true) })
  .strict();

export function decodeDiscordHeroOpenWorkspaceOutcome(value: unknown): {
  readonly created: true;
} {
  return OpenWorkspaceOutcomeSchema.parse(value);
}

function requireInteractionInput(input: OpenWorkspaceInput): void {
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

export function openDiscordHeroWorkspace(
  repository: WorkspaceRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: OpenWorkspaceInput,
): OpenWorkspaceResult {
  requireInteractionInput(input);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = repository.getPlayer(input.userId);
    if (before !== null) {
      validatePlayerAgainstCatalog(before.state, indexes);
      return {
        created: false,
        revision: before.revision,
        state: before.state,
      };
    }
    const fresh = createFreshPlayerStateFromCatalog(indexes);
    try {
      const transaction = repository.transactPlayer({
        scope: "discordhero.workspace",
        interactionId: input.interactionId,
        operation: "open-workspace",
        requestSha256: OPEN_REQUEST_SHA256,
        userId: input.userId,
        expectedRevision: null,
        decodeOutcome: decodeDiscordHeroOpenWorkspaceOutcome,
        nowMs: input.nowMs,
        mutate: (current) => {
          if (current !== null) {
            throw new Error(
              "DiscordHero create mutation received an existing player",
            );
          }
          return {
            kind: "commit",
            state: fresh,
            outcome: { created: true },
          };
        },
      });

      if (transaction.status === "committed") {
        return {
          created: transaction.outcome.created,
          revision: transaction.revision,
          state: fresh,
        };
      }
      throw new Error(
        "DiscordHero create transaction was deterministically rejected",
      );
    } catch (error) {
      if (error instanceof DiscordHeroRevisionConflictError && attempt === 0) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("DiscordHero workspace could not converge after one retry");
}
