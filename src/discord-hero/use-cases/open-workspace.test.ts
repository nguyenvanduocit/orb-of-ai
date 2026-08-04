import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import {
  DiscordHeroRepository,
  type PlayerTransaction,
  type PlayerTransactionResult,
} from "../state/repository";
import { openDiscordHeroWorkspace } from "./open-workspace";

const temporaryDirectories: string[] = [];
const openRepositories: DiscordHeroRepository[] = [];
const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-open-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    legacyDirectory: directory,
  });
  openRepositories.push(store);
  return store;
}

function seedPlayer(store: DiscordHeroRepository, userId: string): void {
  store.transactPlayer({
    scope: "test",
    interactionId: `seed-${userId}`,
    operation: "seed",
    requestSha256: "a".repeat(64),
    userId,
    expectedRevision: null,
    decodeOutcome: () => ({ kind: "seeded" }) as const,
    nowMs: 1,
    mutate: () => ({
      kind: "commit",
      state: createFreshPlayerStateFromCatalog(indexes, 201),
      outcome: { kind: "seeded" },
    }),
  });
}

function projection(store: DiscordHeroRepository): {
  players: number;
  idempotency: number;
  integrity: string;
} {
  const database = new Database(store.databasePath, {
    readonly: true,
    strict: true,
  });
  try {
    const count = (table: string) =>
      (
        database.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
          count: number;
        }
      ).count;
    return {
      players: count("players"),
      idempotency: count("idempotency"),
      integrity: (
        database.query("PRAGMA integrity_check").get() as {
          integrity_check: string;
        }
      ).integrity_check,
    };
  } finally {
    database.close();
  }
}

afterEach(() => {
  for (const store of openRepositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("open DiscordHero workspace", () => {
  test("asks a missing player to choose a starter without writing anything", () => {
    const store = repository();
    let transactions = 0;
    const queryOnly = {
      getPlayer: store.getPlayer.bind(store),
      transactPlayer<TResult>(): PlayerTransactionResult<TResult> {
        transactions += 1;
        throw new Error("open must not transact");
      },
    };

    const result = openDiscordHeroWorkspace(queryOnly, indexes, {
      userId: "123",
    });

    expect(result).toEqual({
      status: "starter-required",
      candidates: [
        { heroKey: 101, name: "Knight", classType: "Knight" },
        { heroKey: 201, name: "Ranger", classType: "Ranger" },
        { heroKey: 301, name: "Sorcerer", classType: "Sorcerer" },
      ],
    });
    expect(transactions).toBe(0);
    expect(store.getPlayer("123")).toBeNull();

    // Repeating the query must stay just as inert.
    openDiscordHeroWorkspace(queryOnly, indexes, { userId: "123" });
    expect(transactions).toBe(0);
    expect(projection(store)).toEqual({
      players: 0,
      idempotency: 0,
      integrity: "ok",
    });
  });

  test("returns a detached snapshot of an existing player without writing", () => {
    const store = repository();
    seedPlayer(store, "123");
    const before = projection(store);

    const result = openDiscordHeroWorkspace(store, indexes, { userId: "123" });
    if (result.status !== "ready") {
      throw new Error("expected a ready workspace");
    }
    expect(result.snapshot.revision).toBe(1);
    expect(result.snapshot.state.party).toEqual([201, null, null]);
    expect(result.snapshot.state.heroes.map((hero) => hero.heroKey)).toEqual([
      101, 201, 301,
    ]);
    expect(result.snapshot.state.gold).toBe(100);

    result.snapshot.state.gold = 999_999;
    expect(store.getPlayer("123")?.state.gold).toBe(100);
    expect(projection(store)).toEqual(before);
  });

  test("rejects malformed Discord input before repository access", () => {
    const store = repository();
    let reads = 0;
    const countingStore = {
      getPlayer(userId: string) {
        reads += 1;
        return store.getPlayer(userId);
      },
      transactPlayer<TResult>(
        _transaction: PlayerTransaction<TResult>,
      ): PlayerTransactionResult<TResult> {
        throw new Error("open must not transact");
      },
    };

    expect(() =>
      openDiscordHeroWorkspace(countingStore, indexes, {
        userId: "not-a-snowflake",
      }),
    ).toThrow("snowflake");
    expect(reads).toBe(0);
    expect(projection(store)).toEqual({
      players: 0,
      idempotency: 0,
      integrity: "ok",
    });
  });
});
