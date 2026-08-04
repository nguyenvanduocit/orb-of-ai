import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRepository,
  DiscordHeroRevisionConflictError,
  type PlayerTransaction,
  type PlayerTransactionResult,
} from "../state/repository";
import { arrangeDiscordHeroParty } from "./arrange-party";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
const temporaryDirectories: string[] = [];
const repositories: DiscordHeroRepository[] = [];

/** Owned Runes that unlock each formation capacity, straight off the source graph. */
const CAPACITY_RUNES = {
  1: [],
  2: [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
  ],
  3: [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
    { key: 22, level: 1 },
    { key: 23, level: 1 },
    { key: 24, level: 1 },
  ],
} as const;

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-party-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    legacyDirectory: directory,
  });
  repositories.push(store);
  return store;
}

function seed(
  store: DiscordHeroRepository,
  capacity: 1 | 2 | 3,
  party: PlayerState["party"],
): void {
  store.transactPlayer({
    scope: "test",
    interactionId: "seed",
    operation: "seed",
    requestSha256: "a".repeat(64),
    userId: "123",
    expectedRevision: null,
    decodeOutcome: () => ({ kind: "seeded" }) as const,
    nowMs: 1,
    mutate: () => {
      const state = createFreshPlayerStateFromCatalog(indexes, 101);
      state.runes = CAPACITY_RUNES[capacity].map((rune) => ({ ...rune }));
      state.party = [...party] as PlayerState["party"];
      return { kind: "commit", state, outcome: { kind: "seeded" } };
    },
  });
}

function receipts(store: DiscordHeroRepository): number {
  const database = new Database(store.databasePath, {
    readonly: true,
    strict: true,
  });
  try {
    return (
      database.query("SELECT COUNT(*) AS count FROM idempotency").get() as {
        count: number;
      }
    ).count;
  } finally {
    database.close();
  }
}

afterEach(() => {
  for (const store of repositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("arrange DiscordHero party transaction", () => {
  test("replaces the only deployed hero at capacity one", () => {
    const store = repository();
    seed(store, 1, [101, null, null]);

    const result = arrangeDiscordHeroParty(store, indexes, {
      userId: "123",
      interactionId: "replace",
      expectedRevision: 1,
      targetSlot: 1,
      selectedHeroKey: 201,
      nowMs: 2,
    });

    expect(result).toMatchObject({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "arranged",
        transition: "replace",
        targetSlot: 1,
        selectedHeroKey: 201,
        previousHeroKey: 101,
        sourceSlot: null,
      },
    });
    const stored = store.getPlayer("123");
    expect(stored?.state.party).toEqual([201, null, null]);
    expect(stored?.state.heroes.map((hero) => hero.heroKey)).toEqual([
      101, 201, 301,
    ]);
  });

  test("fills, replaces and swaps at capacity two", () => {
    const store = repository();
    seed(store, 2, [101, null, null]);

    expect(
      arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: "fill",
        expectedRevision: 1,
        targetSlot: 2,
        selectedHeroKey: 201,
        nowMs: 2,
      }),
    ).toMatchObject({
      status: "committed",
      revision: 2,
      outcome: { kind: "arranged", transition: "fill", targetSlot: 2 },
    });
    expect(store.getPlayer("123")?.state.party).toEqual([101, 201, null]);

    expect(
      arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: "swap",
        expectedRevision: 2,
        targetSlot: 1,
        selectedHeroKey: 201,
        nowMs: 3,
      }),
    ).toMatchObject({
      status: "committed",
      revision: 3,
      outcome: {
        kind: "arranged",
        transition: "swap",
        targetSlot: 1,
        selectedHeroKey: 201,
        previousHeroKey: 101,
        sourceSlot: 2,
      },
    });
    expect(store.getPlayer("123")?.state.party).toEqual([201, 101, null]);

    expect(
      arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: "replace-2",
        expectedRevision: 3,
        targetSlot: 2,
        selectedHeroKey: 301,
        nowMs: 4,
      }),
    ).toMatchObject({
      status: "committed",
      revision: 4,
      outcome: {
        kind: "arranged",
        transition: "replace",
        targetSlot: 2,
        previousHeroKey: 101,
      },
    });
    expect(store.getPlayer("123")?.state.party).toEqual([201, 301, null]);
  });

  test("fills the third slot only once capacity three is unlocked", () => {
    const store = repository();
    seed(store, 3, [101, 201, null]);

    expect(
      arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: "fill-3",
        expectedRevision: 1,
        targetSlot: 3,
        selectedHeroKey: 301,
        nowMs: 2,
      }),
    ).toMatchObject({
      status: "committed",
      revision: 2,
      outcome: { kind: "arranged", transition: "fill", targetSlot: 3 },
    });
    expect(store.getPlayer("123")?.state.party).toEqual([101, 201, 301]);
  });

  test("records every deterministic refusal without moving the revision", () => {
    const store = repository();
    seed(store, 2, [101, null, null]);
    const before = store.getPlayer("123");

    const refusals = [
      {
        interactionId: "no-op",
        targetSlot: 1,
        selectedHeroKey: 101,
        outcome: { kind: "unchanged" },
      },
      {
        interactionId: "locked",
        targetSlot: 3,
        selectedHeroKey: 201,
        outcome: { kind: "slot-locked", capacity: 2 },
      },
      {
        interactionId: "unowned",
        targetSlot: 2,
        selectedHeroKey: 401,
        outcome: { kind: "hero-not-owned" },
      },
      {
        interactionId: "malformed-slot",
        targetSlot: 4,
        selectedHeroKey: 201,
        outcome: { kind: "invalid-target" },
      },
      {
        interactionId: "malformed-hero",
        targetSlot: 2,
        selectedHeroKey: 1.5,
        outcome: { kind: "invalid-target" },
      },
    ] as const;

    for (const refusal of refusals) {
      const first = arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: refusal.interactionId,
        expectedRevision: 1,
        targetSlot: refusal.targetSlot,
        selectedHeroKey: refusal.selectedHeroKey,
        nowMs: 2,
      });
      const replay = arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: refusal.interactionId,
        expectedRevision: 1,
        targetSlot: refusal.targetSlot,
        selectedHeroKey: refusal.selectedHeroKey,
        nowMs: 99,
      });

      expect(first).toEqual({
        status: "rejected",
        revision: 1,
        outcome: refusal.outcome,
      });
      expect(replay).toEqual(first);
    }

    expect(store.getPlayer("123")).toEqual(before);
  });

  test("refuses an absent player before the mutation and leaves no trace", () => {
    const store = repository();
    let mutations = 0;
    const spy = {
      transactPlayer<TResult>(
        transaction: PlayerTransaction<TResult>,
      ): PlayerTransactionResult<TResult> {
        return store.transactPlayer({
          ...transaction,
          mutate: (current) => {
            mutations += 1;
            return transaction.mutate(current);
          },
        });
      },
    };

    expect(() =>
      arrangeDiscordHeroParty(spy, indexes, {
        userId: "123",
        interactionId: "ghost",
        expectedRevision: 1,
        targetSlot: 1,
        selectedHeroKey: 201,
        nowMs: 2,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);

    expect(mutations).toBe(0);
    expect(store.getPlayer("123")).toBeNull();
    expect(receipts(store)).toBe(0);
  });

  test("rejects a stale revision and binds slot and hero into request identity", () => {
    const store = repository();
    seed(store, 2, [101, null, null]);
    arrangeDiscordHeroParty(store, indexes, {
      userId: "123",
      interactionId: "bound",
      expectedRevision: 1,
      targetSlot: 2,
      selectedHeroKey: 201,
      nowMs: 2,
    });

    expect(() =>
      arrangeDiscordHeroParty(store, indexes, {
        userId: "123",
        interactionId: "stale",
        expectedRevision: 1,
        targetSlot: 2,
        selectedHeroKey: 301,
        nowMs: 3,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);

    for (const forged of [
      { targetSlot: 1, selectedHeroKey: 201 },
      { targetSlot: 2, selectedHeroKey: 301 },
    ]) {
      expect(() =>
        arrangeDiscordHeroParty(store, indexes, {
          userId: "123",
          interactionId: "bound",
          expectedRevision: 1,
          ...forged,
          nowMs: 4,
        }),
      ).toThrow(DiscordHeroIdempotencyConflictError);
    }

    expect(store.getPlayer("123")?.state.party).toEqual([101, 201, null]);
    expect(store.getPlayer("123")?.revision).toBe(2);
  });

  test("rejects malformed Discord, revision and clock input before any write", () => {
    const store = repository();
    seed(store, 2, [101, null, null]);

    for (const input of [
      { userId: "nope", interactionId: "x", expectedRevision: 1, nowMs: 1 },
      { userId: "123", interactionId: "", expectedRevision: 1, nowMs: 1 },
      { userId: "123", interactionId: "x", expectedRevision: 0, nowMs: 1 },
      { userId: "123", interactionId: "x", expectedRevision: 1.5, nowMs: 1 },
      { userId: "123", interactionId: "x", expectedRevision: 1, nowMs: -1 },
    ]) {
      expect(() =>
        arrangeDiscordHeroParty(store, indexes, {
          ...input,
          targetSlot: 2,
          selectedHeroKey: 201,
        }),
      ).toThrow();
    }

    expect(store.getPlayer("123")?.revision).toBe(1);
    expect(receipts(store)).toBe(1);
  });
});
