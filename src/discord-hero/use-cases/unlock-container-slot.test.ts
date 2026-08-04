import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRepository,
  DiscordHeroRevisionConflictError,
} from "../state/repository";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import { unlockDiscordHeroContainerSlot } from "./unlock-container-slot";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
const temporaryDirectories: string[] = [];
const repositories: DiscordHeroRepository[] = [];

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-container-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    legacyDirectory: directory,
  });
  repositories.push(store);
  return store;
}

function createPlayer(store: DiscordHeroRepository, userId = "123"): void {
  store.transactPlayer({
    scope: "test",
    interactionId: `seed-${userId}`,
    operation: "seed",
    requestSha256: "a".repeat(64),
    userId,
    expectedRevision: null,
    decodeOutcome: () => ({ kind: "seeded" }) as const,
    nowMs: 1_000,
    mutate: () => ({
      kind: "commit",
      state: createFreshPlayerStateFromCatalog(indexes, 101),
      outcome: { kind: "seeded" },
    }),
  });
}

afterEach(() => {
  for (const store of repositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("unlock DiscordHero container slot transaction", () => {
  test("commits exact cost once and replays a duplicate interaction", () => {
    const store = repository();
    createPlayer(store);
    const input = {
      userId: "123",
      interactionId: "unlock-1",
      expectedRevision: 1,
      container: "inventory" as const,
      nowMs: 2_000,
    };

    const applied = unlockDiscordHeroContainerSlot(store, indexes, input);
    const replayed = unlockDiscordHeroContainerSlot(store, indexes, input);

    expect(applied).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "unlocked",
        container: "inventory",
        slotIndex: 20,
        cost: 50,
        gold: 50,
        unlockedSlots: 21,
      },
    });
    expect(replayed).toEqual(applied);
    expect(store.getPlayer("123")).toMatchObject({
      revision: 2,
      state: {
        gold: 50,
        containers: { inventory: { unlockedSlots: 21 } },
      },
    });
  });

  test("persists deterministic rejection without changing revision", () => {
    const store = repository();
    createPlayer(store);

    const rejected = unlockDiscordHeroContainerSlot(store, indexes, {
      userId: "123",
      interactionId: "unlock-trading",
      expectedRevision: 1,
      container: "tradingStash",
      nowMs: 2_000,
    });

    expect(rejected).toEqual({
      status: "rejected",
      revision: 1,
      outcome: {
        kind: "maximum-capacity",
        container: "tradingStash",
        unlockedSlots: 10,
      },
    });
    expect(store.getPlayer("123")?.revision).toBe(1);
  });

  test("rejects stale revision and interaction reuse with changed request", () => {
    const store = repository();
    createPlayer(store);
    unlockDiscordHeroContainerSlot(store, indexes, {
      userId: "123",
      interactionId: "unlock-1",
      expectedRevision: 1,
      container: "inventory",
      nowMs: 2_000,
    });

    expect(() =>
      unlockDiscordHeroContainerSlot(store, indexes, {
        userId: "123",
        interactionId: "unlock-stale",
        expectedRevision: 1,
        container: "storage",
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);
    expect(() =>
      unlockDiscordHeroContainerSlot(store, indexes, {
        userId: "123",
        interactionId: "unlock-1",
        expectedRevision: 1,
        container: "storage",
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
  });

  test("rejects missing players deterministically", () => {
    const store = repository();
    const result = unlockDiscordHeroContainerSlot(store, indexes, {
      userId: "999",
      interactionId: "unlock-missing",
      expectedRevision: null,
      container: "inventory",
      nowMs: 1_000,
    });

    expect(result).toEqual({
      status: "rejected",
      revision: null,
      outcome: { kind: "player-not-found" },
    });
  });
});
