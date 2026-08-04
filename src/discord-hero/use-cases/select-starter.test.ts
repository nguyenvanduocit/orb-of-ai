import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRepository,
  DiscordHeroRevisionConflictError,
  type PlayerTransaction,
  type PlayerTransactionResult,
} from "../state/repository";
import { selectDiscordHeroStarter } from "./select-starter";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
const temporaryDirectories: string[] = [];
const repositories: DiscordHeroRepository[] = [];

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-starter-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    legacyDirectory: directory,
  });
  repositories.push(store);
  return store;
}

function withHeroRows(
  map: (
    rows: readonly DiscordHeroCatalogIndexes["tables"]["heroes"]["rows"][number][],
  ) => readonly DiscordHeroCatalogIndexes["tables"]["heroes"]["rows"][number][],
): DiscordHeroCatalogIndexes {
  return {
    ...indexes,
    tables: {
      ...indexes.tables,
      heroes: {
        ...indexes.tables.heroes,
        rows: map(indexes.tables.heroes.rows),
      },
    },
  } as DiscordHeroCatalogIndexes;
}

afterEach(() => {
  for (const store of repositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("select DiscordHero starter transaction", () => {
  test("creates revision 1 owning all three starters and deploying only the chosen one", () => {
    for (const starterHeroKey of [101, 201, 301] as const) {
      const store = repository();
      const result = selectDiscordHeroStarter(store, indexes, {
        userId: "123",
        interactionId: `starter-${starterHeroKey}`,
        starterHeroKey,
        nowMs: 1_000,
      });

      expect(result).toMatchObject({
        status: "committed",
        revision: 1,
        outcome: { kind: "selected", starterHeroKey },
      });

      const stored = store.getPlayer("123");
      expect(stored?.revision).toBe(1);
      expect(stored?.state.heroes.map((hero) => hero.heroKey)).toEqual([
        101, 201, 301,
      ]);
      expect(stored?.state.party).toEqual([starterHeroKey, null, null]);
      expect(stored?.state.gold).toBe(100);
      expect(stored?.state.runes).toEqual([]);
    }
  });

  test("replays one interaction without a second revision", () => {
    const store = repository();
    const first = selectDiscordHeroStarter(store, indexes, {
      userId: "123",
      interactionId: "starter",
      starterHeroKey: 201,
      nowMs: 1_000,
    });
    const replay = selectDiscordHeroStarter(store, indexes, {
      userId: "123",
      interactionId: "starter",
      starterHeroKey: 201,
      nowMs: 9_000,
    });

    expect(replay).toEqual(first);
    expect(store.getPlayer("123")?.revision).toBe(1);
    expect(store.getPlayer("123")?.state.party).toEqual([201, null, null]);
  });

  test("refuses forged starters before reaching the repository", () => {
    const store = repository();
    let transactions = 0;
    const spy = {
      getPlayer: store.getPlayer.bind(store),
      transactPlayer<TResult>(
        transaction: PlayerTransaction<TResult>,
      ): PlayerTransactionResult<TResult> {
        transactions += 1;
        return store.transactPlayer(transaction);
      },
    };

    for (const starterHeroKey of [401, 100, 0, -1, 1.5, Number.NaN]) {
      expect(() =>
        selectDiscordHeroStarter(spy, indexes, {
          userId: "123",
          interactionId: "invalid",
          starterHeroKey,
          nowMs: 1,
        }),
      ).toThrow(/starter/i);
    }

    expect(transactions).toBe(0);
    expect(store.getPlayer("123")).toBeNull();
  });

  test("refuses a catalog whose starter rows are not the exact source three", () => {
    const store = repository();

    const flipped = withHeroRows((rows) =>
      rows.map((row) =>
        row.HeroKey === 201
          ? Object.freeze({ ...row, IsFirstAvailable: false })
          : row,
      ),
    );
    const duplicated = withHeroRows((rows) => [
      ...rows,
      Object.freeze({
        ...rows.find((row) => row.HeroKey === 101)!,
      }),
    ]);
    const unavailable = withHeroRows((rows) =>
      rows.map((row) =>
        row.HeroKey === 101
          ? Object.freeze({ ...row, IsAvailable: false })
          : row,
      ),
    );

    for (const catalog of [flipped, duplicated, unavailable]) {
      expect(() =>
        selectDiscordHeroStarter(store, catalog, {
          userId: "123",
          interactionId: "catalog",
          starterHeroKey: 101,
          nowMs: 1,
        }),
      ).toThrow();
    }
    expect(store.getPlayer("123")).toBeNull();
  });

  test("lets exactly one racing interaction create the player", () => {
    const store = repository();
    selectDiscordHeroStarter(store, indexes, {
      userId: "123",
      interactionId: "winner",
      starterHeroKey: 101,
      nowMs: 1,
    });

    expect(() =>
      selectDiscordHeroStarter(store, indexes, {
        userId: "123",
        interactionId: "loser",
        starterHeroKey: 301,
        nowMs: 2,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);

    // The winner still replays from its receipt now that the row exists,
    // because receipt lookup precedes revision comparison.
    expect(
      selectDiscordHeroStarter(store, indexes, {
        userId: "123",
        interactionId: "winner",
        starterHeroKey: 101,
        nowMs: 3,
      }),
    ).toMatchObject({ status: "committed", revision: 1 });
    expect(store.getPlayer("123")?.state.party).toEqual([101, null, null]);
  });

  test("binds the chosen starter into the request identity", () => {
    const store = repository();
    selectDiscordHeroStarter(store, indexes, {
      userId: "123",
      interactionId: "bound",
      starterHeroKey: 101,
      nowMs: 1,
    });

    expect(() =>
      selectDiscordHeroStarter(store, indexes, {
        userId: "123",
        interactionId: "bound",
        starterHeroKey: 301,
        nowMs: 2,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(store.getPlayer("123")?.state.party).toEqual([101, null, null]);
  });

  test("rejects malformed Discord and clock input", () => {
    const store = repository();
    for (const input of [
      { userId: "not-a-snowflake", interactionId: "x", nowMs: 1 },
      { userId: "123", interactionId: "", nowMs: 1 },
      { userId: "123", interactionId: "x", nowMs: -1 },
      { userId: "123", interactionId: "x", nowMs: 1.5 },
    ]) {
      expect(() =>
        selectDiscordHeroStarter(store, indexes, {
          ...input,
          starterHeroKey: 101,
        }),
      ).toThrow();
    }
    expect(store.getPlayer("123")).toBeNull();
  });
});
