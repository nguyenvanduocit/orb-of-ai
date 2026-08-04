// The invariants that only exist because the wallet is shared. Each one guards
// a way real coins could be minted or destroyed, so they are worth a test even
// though the code they cover is short.

import { beforeEach, describe, expect, test } from "bun:test";
import type { Client } from "discord.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addCoins,
  grantStartingCoins,
  loadAttendance,
  loadCoins,
  loadGlobalSettings,
  saveAttendance,
  saveCoins,
  saveTitles,
} from "./economy";
import { performCheckin } from "./commands/diemdanh";
import { sweepOrphans } from "./guilds";
import { loadCharacters, rollRpgSeason, saveCharacters } from "./rpg-store";
import { newProfile, SEASON } from "./rpg";
import { config } from "./config";
import { DATA_DIR, globalFile, guildDir } from "./store";

beforeEach(() => {
  saveCoins({});
  saveAttendance({});
  saveTitles({});
  saveCharacters({});
});

describe("shared wallet", () => {
  test("the starting balance is granted once per person, not once per server", () => {
    expect(grantStartingCoins("u1")).toBe(true);
    expect(loadCoins().u1).toBe(config.startingCoins);

    // Joining a second (and third) server must not top the wallet up again —
    // otherwise every extra server is free money.
    expect(grantStartingCoins("u1")).toBe(false);
    expect(grantStartingCoins("u1")).toBe(false);
    expect(loadCoins().u1).toBe(config.startingCoins);
  });

  test("a spent-down wallet is still not re-granted", () => {
    grantStartingCoins("u1");
    addCoins("u1", -config.startingCoins);
    expect(loadCoins().u1).toBe(0);
    // A zero balance is not "no wallet" — re-granting here would be an infinite
    // faucet for anyone willing to hop servers.
    expect(grantStartingCoins("u1")).toBe(false);
    expect(loadCoins().u1).toBe(0);
  });

  test("check-in pays once per day for the whole system", () => {
    grantStartingCoins("u1");
    const opening = loadCoins().u1!;

    const first = performCheckin("u1");
    expect(first.ok).toBe(true);
    const afterFirst = loadCoins().u1!;
    expect(afterFirst).toBeGreaterThan(opening);

    // The same person checking in again — from any server — is the same day.
    const second = performCheckin("u1");
    expect(second.ok).toBe(false);
    expect(loadCoins().u1).toBe(afterFirst);
  });

  test("check-in streak is one streak per person", () => {
    grantStartingCoins("u1");
    // Two days already claimed, then today: the streak continues to 3 rather
    // than restarting per server.
    const todayInGameTime = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
    const day = (offset: number) => {
      const value = new Date(`${todayInGameTime}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() - offset);
      return value.toISOString().slice(0, 10);
    };
    saveAttendance({ u1: [day(2), day(1)] });
    const result = performCheckin("u1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.streak).toBe(3);
    expect(loadAttendance().u1).toHaveLength(3);
  });
});

describe("forgetting people", () => {
  // A fake client whose guild has an empty member cache and fails to fetch. This
  // is the dangerous case: "cannot fetch" must never read as "everybody left".
  const brokenClient = {
    guilds: {
      cache: new Map([
        [
          "g1",
          {
            id: "g1",
            memberCount: 5,
            members: {
              cache: new Map(),
              fetch: async () => {
                throw new Error("gateway down");
              },
            },
          },
        ],
      ]),
    },
  } as unknown as Client;

  // `cached: false` empties the member cache so the sweep has to fall back to a
  // gateway fetch; the default mirrors the real post-syncGuild state, where the
  // cache is already complete.
  const clientWith = (memberIds: string[], opts: { cached?: boolean; onFetch?: () => void } = {}) => {
    const members = new Map(memberIds.map((id) => [id, { id }]));
    return {
      guilds: {
        cache: new Map([
          [
            "g1",
            {
              id: "g1",
              memberCount: memberIds.length,
              members: {
                cache: opts.cached === false ? new Map() : members,
                fetch: async () => {
                  opts.onFetch?.();
                  return members;
                },
              },
            },
          ],
        ]),
      },
    } as unknown as Client;
  };

  test("a failed member fetch deletes nobody", async () => {
    saveCoins({ u1: 5_000, u2: 10 });
    expect(await sweepOrphans(brokenClient)).toBe(0);
    expect(loadCoins()).toEqual({ u1: 5_000, u2: 10 });
  });

  test("an empty member list deletes nobody", async () => {
    saveCoins({ u1: 5_000 });
    // No members anywhere is no evidence of anything — not proof they all left.
    expect(await sweepOrphans(clientWith([]))).toBe(0);
    expect(loadCoins().u1).toBe(5_000);
  });

  test("someone still in a server keeps their wallet; someone in none loses it", async () => {
    saveCoins({ staying: 5_000, gone: 900 });
    expect(await sweepOrphans(clientWith(["staying"]))).toBe(1);
    expect(loadCoins()).toEqual({ staying: 5_000 });
  });

  test("a complete member cache is reused instead of re-fetched", async () => {
    // Regression: syncGuild fetches every member, then this sweep ran moments
    // later and asked the gateway again — which rate-limits member requests
    // (opcode 8). A failed fetch aborts the sweep, so the GC never ran at all.
    saveCoins({ staying: 100, gone: 50 });
    let fetches = 0;
    const client = clientWith(["staying"], { onFetch: () => fetches++ });
    expect(await sweepOrphans(client)).toBe(1);
    expect(fetches).toBe(0);
  });

  test("an incomplete cache still falls back to a fetch", async () => {
    saveCoins({ staying: 100, gone: 50 });
    let fetches = 0;
    const client = clientWith(["staying"], { cached: false, onFetch: () => fetches++ });
    expect(await sweepOrphans(client)).toBe(1);
    expect(fetches).toBe(1);
  });

  test("AI game bots are left to their own game's teardown", async () => {
    saveCoins({ staying: 100, "botai-1": 250 });
    expect(await sweepOrphans(clientWith(["staying"]))).toBe(0);
    expect(loadCoins()["botai-1"]).toBe(250);
  });
});

describe("migration to the shared world", () => {
  test("wallets merge by MAX, and collections by union", async () => {
    // Build two legacy server folders by hand, then run the merge in-process.
    const ids = ["mig-a", "mig-b"];
    for (const id of ids) rmSync(guildDir(id), { recursive: true, force: true });
    rmSync(globalFile(".migrated-to-global"), { force: true });
    saveCoins({});
    saveAttendance({});

    mkdirSync(guildDir("mig-a"), { recursive: true });
    mkdirSync(guildDir("mig-b"), { recursive: true });
    writeFileSync(join(guildDir("mig-a"), "coins.json"), JSON.stringify({ p1: 1_000, p2: 40 }));
    writeFileSync(join(guildDir("mig-b"), "coins.json"), JSON.stringify({ p1: 300 }));
    writeFileSync(join(guildDir("mig-a"), "attendance.json"), JSON.stringify({ p1: ["2026-07-01"] }));
    writeFileSync(join(guildDir("mig-b"), "attendance.json"), JSON.stringify({ p1: ["2026-07-02"] }));

    const { migrateToGlobal } = await import("./migrate-global");
    const report = migrateToGlobal();
    expect(report).not.toBeNull();
    if (!report) throw new Error("unreachable");

    // MAX, not sum: p1 keeps their best balance (1000), never 1300.
    expect(loadCoins().p1).toBe(1_000);
    expect(loadCoins().p2).toBe(40);
    expect(report.coinsBefore).toBe(1_340);
    expect(report.coinsAfter).toBe(1_040);

    // Check-in days union, so the longest streak actually earned survives.
    expect(loadAttendance().p1).toEqual(["2026-07-01", "2026-07-02"]);

    // Idempotent: a second run is a no-op rather than a second merge.
    expect(migrateToGlobal()).toBeNull();

    for (const id of ids) rmSync(guildDir(id), { recursive: true, force: true });
    rmSync(globalFile(".migrated-to-global"), { force: true });
    void DATA_DIR;
  });

  test("the season stamp comes across, so the startup roll does not wipe migrated heroes", async () => {
    // Regression: startup runs migrateToGlobal() then rollRpgSeason(). The season
    // used to live in each guild's settings.json; if the merge left it behind,
    // the shared world read season `null`, called it a new league, and deleted
    // every hero the merge had just rescued.
    const id = "mig-season";
    rmSync(guildDir(id), { recursive: true, force: true });
    rmSync(globalFile(".migrated-to-global"), { force: true });
    rmSync(globalFile("settings.json"), { force: true });
    saveCoins({});
    saveCharacters({});

    mkdirSync(guildDir(id), { recursive: true });
    const hero = newProfile("chien", 0, () => 0.5);
    writeFileSync(join(guildDir(id), "characters.json"), JSON.stringify({ veteran: hero }));
    writeFileSync(join(guildDir(id), "settings.json"), JSON.stringify({ announceChannelId: null, rpgSeason: SEASON }));

    const { migrateToGlobal } = await import("./migrate-global");
    expect(migrateToGlobal()).not.toBeNull();
    expect(loadGlobalSettings().rpgSeason).toBe(SEASON);

    // The startup's very next step — it must find the world already on this
    // season and leave the hero alone.
    const rolled = rollRpgSeason();
    expect(rolled.rolled).toBe(false);
    expect(Object.keys(loadCharacters())).toEqual(["veteran"]);

    rmSync(guildDir(id), { recursive: true, force: true });
    rmSync(globalFile(".migrated-to-global"), { force: true });
  });
});
