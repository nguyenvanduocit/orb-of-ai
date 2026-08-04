import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
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

afterEach(() => {
  for (const store of openRepositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("open DiscordHero workspace", () => {
  test("creates the exact source-backed player once and reopens it unchanged", () => {
    const store = repository();
    const created = openDiscordHeroWorkspace(store, indexes, {
      userId: "123",
      interactionId: "open-1",
      nowMs: 1_000,
    });
    const reopened = openDiscordHeroWorkspace(store, indexes, {
      userId: "123",
      interactionId: "open-2",
      nowMs: 2_000,
    });
    const repeatedInteraction = openDiscordHeroWorkspace(store, indexes, {
      userId: "123",
      interactionId: "open-1",
      nowMs: 3_000,
    });

    expect(created.created).toBe(true);
    expect(created.revision).toBe(1);
    expect(created.state.gold).toBe(100);
    expect(created.state.party).toEqual([101, 201, 301]);
    expect(reopened).toEqual({
      created: false,
      revision: 1,
      state: created.state,
    });
    expect(repeatedInteraction).toEqual(reopened);
  });

  test("retries one create race and returns the winning state", () => {
    const store = repository();
    let injected = false;
    const racingStore = {
      getPlayer: store.getPlayer.bind(store),
      transactPlayer<TResult>(
        transaction: PlayerTransaction<TResult>,
      ): PlayerTransactionResult<TResult> {
        if (!injected) {
          injected = true;
          store.transactPlayer({
            ...transaction,
            interactionId: "other-interaction",
          });
        }
        return store.transactPlayer(transaction);
      },
    };

    const opened = openDiscordHeroWorkspace(racingStore, indexes, {
      userId: "456",
      interactionId: "open-race",
      nowMs: 3_000,
    });

    expect(opened.created).toBe(false);
    expect(opened.revision).toBe(1);
    expect(opened.state.party).toEqual([101, 201, 301]);
  });

  test("rejects malformed Discord and clock inputs before persistence", () => {
    const store = repository();
    expect(() =>
      openDiscordHeroWorkspace(store, indexes, {
        userId: "not-a-snowflake",
        interactionId: "open",
        nowMs: 1,
      }),
    ).toThrow("snowflake");
    expect(store.getPlayer("123")).toBeNull();
  });
});
