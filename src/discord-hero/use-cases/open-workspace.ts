import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import {
  discordHeroStarterCandidates,
  type DiscordHeroStarterCandidate,
} from "../domain/party";
import type { PlayerSnapshot } from "../state/repository";

interface WorkspaceRepository {
  getPlayer(userId: string): PlayerSnapshot | null;
}

export interface OpenWorkspaceInput {
  readonly userId: string;
}

export type OpenWorkspaceResult =
  | Readonly<{ status: "ready"; snapshot: PlayerSnapshot }>
  | Readonly<{
      status: "starter-required";
      candidates: readonly DiscordHeroStarterCandidate[];
    }>;

/**
 * Opening the workspace answers "who is this player?" and nothing else. A
 * missing player stays missing until they pick a starter, so no row and no
 * idempotency receipt may exist before that choice.
 */
export function openDiscordHeroWorkspace(
  repository: WorkspaceRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: OpenWorkspaceInput,
): OpenWorkspaceResult {
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new Error("DiscordHero userId must be a Discord snowflake");
  }

  const snapshot = repository.getPlayer(input.userId);
  if (snapshot === null) {
    return Object.freeze({
      status: "starter-required",
      candidates: discordHeroStarterCandidates(indexes),
    });
  }

  validatePlayerAgainstCatalog(snapshot.state, indexes);
  return Object.freeze({
    status: "ready",
    snapshot: structuredClone(snapshot),
  });
}
