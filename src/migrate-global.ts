// One-time migration: per-server ledgers → the shared data/global/ world.
//
// Runs automatically at startup and is a no-op once done, so a deploy carries
// it without anyone running a script on the volume. It is also safe to run by
// hand: `bun run src/migrate-global.ts` (add --dry-run to only print the plan).
//
// Merge rule for wallets is MAX, not sum: a person who played in three servers
// keeps their best balance rather than having three economies added together.
// Everything else merges by what loses the least — a union for collections
// (check-in days, titles owned), newest-wins for snapshots, and the strongest
// hero for characters.
//
// Nothing is deleted. Each migrated per-guild file is renamed in place to
// <file>.migrated-<timestamp>, so the old state is still on disk to inspect or
// roll back to, while no longer being a second source of truth.

import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGlobalSettings, saveGlobalSettings } from "./economy";
import type { Attendance, BettingStore, GlobalSettings, LotteryStore, TitlesStore } from "./economy";
import type { Characters, Expeditions, ExpeditionResults, MarketStore, PvpStore } from "./rpg-store";
import type { RpgProfile } from "./rpg";
import { globalDir, globalFile, guildDir, listGuildIds, readJsonFile, writeJsonFile } from "./store";

// Files the migration consumes from every data/guild_<id>/ folder. Anything not
// listed here is genuinely per-server and stays where it is (settings.json,
// streams.json, drops.json, begs.json, games/, the agent workspace).
const MIGRATED_FILES = [
  "coins.json",
  "attendance.json",
  "titles.json",
  "lottery.json",
  "betting.json",
  "characters.json",
  "expeditions.json",
  "expedition-results.json",
  "market.json",
  "pvp.json",
] as const;

const MARKER = ".migrated-to-global";

export function alreadyMigrated(): boolean {
  return existsSync(join(globalDir(), MARKER));
}

// Is there anything to migrate at all? A fresh install has guild folders with
// no ledgers (or no guild folders), and must not be marked as migrated — the
// marker would then hide a real migration if data showed up later.
function hasLegacyData(): boolean {
  return listGuildIds().some((id) => MIGRATED_FILES.some((file) => existsSync(join(guildDir(id), file))));
}

// A hero is "stronger" by rebirths first (they survive everything else), then
// level, then how much gear they're carrying. Used only when the same person
// somehow has a character in more than one server.
function strongerProfile(a: RpgProfile, b: RpgProfile): RpgProfile {
  if ((a.prestigeLevel ?? 0) !== (b.prestigeLevel ?? 0)) return (a.prestigeLevel ?? 0) > (b.prestigeLevel ?? 0) ? a : b;
  if ((a.level ?? 0) !== (b.level ?? 0)) return (a.level ?? 0) > (b.level ?? 0) ? a : b;
  const gearOf = (p: RpgProfile) => Object.keys(p.gear ?? {}).length + (p.bag?.length ?? 0);
  return gearOf(a) >= gearOf(b) ? a : b;
}

export interface MigrationReport {
  guilds: number;
  wallets: number;
  coinsBefore: number; // total coins across every per-guild ledger
  coinsAfter: number; // total in the merged wallet — lower than before whenever anyone played in 2+ servers
  characters: number;
  titles: number;
  listings: number;
  jackpot: number;
}

// Merge every per-guild ledger into one world. Pure-ish: with `dryRun` it reads
// and reports without writing anything.
export function migrateToGlobal(options: { dryRun?: boolean } = {}): MigrationReport | null {
  const { dryRun = false } = options;
  if (alreadyMigrated()) return null;
  if (!hasLegacyData()) {
    // Fresh install: nothing to merge. Don't stamp the marker — leave the door
    // open in case a volume with real data is attached later.
    return null;
  }

  const guildIds = listGuildIds();
  const coins: Record<string, number> = {};
  let coinsBefore = 0;
  const attendance: Attendance = {};
  const titles: TitlesStore = {};
  const characters: Characters = {};
  const expeditions: Expeditions = {};
  const results: ExpeditionResults = {};
  const market: MarketStore = { listings: {} };
  const pvp: PvpStore = { snapshots: {}, sessions: {} };
  const lottery: LotteryStore = { jackpot: 0, drawAt: 0, channels: {}, tickets: {}, history: [] };
  const betting: BettingStore = { books: {} };
  // The RPG season must come across with the characters. It used to live in each
  // guild's settings.json, and the startup sequence runs rollRpgSeason() right
  // after this merge: without carrying the stamp over, the shared world would
  // read season `null`, decide a new league had started, and wipe every hero
  // this migration just rescued.
  let rpgSeason: number | null = null;
  let weekendDouble = true;
  let activeEvent: GlobalSettings["activeEvent"] = null;

  const read = <T>(guildId: string, file: string): T | null => readJsonFile<T>(join(guildDir(guildId), file));

  for (const guildId of guildIds) {
    // Economy knobs that used to be per-server, now system-wide. settings.json
    // is NOT retired (it still holds the announce channel and onboarding flag) —
    // only these three fields move out of it.
    const legacySettings = read<{ rpgSeason?: number | null; weekendDouble?: boolean; activeEvent?: GlobalSettings["activeEvent"] }>(
      guildId,
      "settings.json",
    );
    if (typeof legacySettings?.rpgSeason === "number") {
      rpgSeason = rpgSeason === null ? legacySettings.rpgSeason : Math.max(rpgSeason, legacySettings.rpgSeason);
    }
    if (legacySettings?.weekendDouble === false) weekendDouble = false;
    if (legacySettings?.activeEvent && legacySettings.activeEvent.until > (activeEvent?.until ?? 0)) {
      activeEvent = legacySettings.activeEvent;
    }

    // Wallets: MAX per person (the user's chosen rule) — never a sum.
    for (const [userId, balance] of Object.entries(read<Record<string, number>>(guildId, "coins.json") ?? {})) {
      if (userId.startsWith("botai-")) continue; // transient game bots, not people
      coinsBefore += balance;
      coins[userId] = Math.max(coins[userId] ?? 0, balance);
    }

    // Check-in days: union, so the longest streak anyone actually earned survives.
    for (const [userId, dates] of Object.entries(read<Attendance>(guildId, "attendance.json") ?? {})) {
      attendance[userId] = [...new Set([...(attendance[userId] ?? []), ...dates])].sort();
    }

    // Titles: union of what they own; keep the first equipped choice found.
    for (const [userId, owned] of Object.entries(read<TitlesStore>(guildId, "titles.json") ?? {})) {
      const prev = titles[userId];
      titles[userId] = {
        owned: [...new Set([...(prev?.owned ?? []), ...(owned.owned ?? [])])],
        equipped: prev?.equipped ?? owned.equipped ?? null,
      };
    }

    // Heroes: strongest wins.
    for (const [userId, profile] of Object.entries(read<Characters>(guildId, "characters.json") ?? {})) {
      const prev = characters[userId];
      characters[userId] = prev ? strongerProfile(prev, profile) : profile;
    }

    // In-flight runs + last results: newest wins, and the run remembers the
    // server it was dispatched from (the field is new — backfill it here).
    for (const [userId, run] of Object.entries(read<Expeditions>(guildId, "expeditions.json") ?? {})) {
      const stamped = { ...run, guildId: run.guildId ?? guildId };
      const prev = expeditions[userId];
      if (!prev || stamped.startedAt > prev.startedAt) expeditions[userId] = stamped;
    }
    for (const [userId, result] of Object.entries(read<ExpeditionResults>(guildId, "expedition-results.json") ?? {})) {
      if (!results[userId]) results[userId] = result;
    }

    // Market listings: all of them, into one shared shop. Ids are random enough
    // to collide only by accident — prefix on collision rather than drop an item.
    for (const [id, listing] of Object.entries(read<MarketStore>(guildId, "market.json")?.listings ?? {})) {
      const key = id in market.listings ? `${guildId}-${id}` : id;
      market.listings[key] = { ...listing, id: key };
    }

    // PvP: newest snapshot/session per player.
    const guildPvp = read<PvpStore>(guildId, "pvp.json");
    for (const [userId, snapshot] of Object.entries(guildPvp?.snapshots ?? {})) {
      const prev = pvp.snapshots[userId];
      if (!prev || snapshot.updatedAt > prev.updatedAt) pvp.snapshots[userId] = snapshot;
    }
    for (const [userId, session] of Object.entries(guildPvp?.sessions ?? {})) {
      const prev = pvp.sessions[userId];
      if (!prev || session.startedAt > prev.startedAt) pvp.sessions[userId] = session;
    }

    // Lottery: jackpots ADD up — that money was already taken out of wallets, so
    // dropping it would burn coins players actually paid. Numbers are claimed
    // first-come across the merge; a number already taken is released (its buyer
    // keeps the coins they spent in the jackpot, same as any losing ticket).
    const guildLottery = read<LotteryStore>(guildId, "lottery.json");
    if (guildLottery) {
      lottery.jackpot += guildLottery.jackpot ?? 0;
      const taken = new Set(Object.values(lottery.tickets).flat());
      for (const [userId, numbers] of Object.entries(guildLottery.tickets ?? {})) {
        const free = numbers.filter((n) => !taken.has(n));
        for (const n of free) taken.add(n);
        if (free.length > 0) lottery.tickets[userId] = [...(lottery.tickets[userId] ?? []), ...free];
      }
      lottery.history.push(...(guildLottery.history ?? []));
      lottery.drawAt = Math.max(lottery.drawAt, guildLottery.drawAt ?? 0);
    }

    // World Cup books: pots add, tickets merge (one per person per match — the
    // bigger stake wins, since both were already paid into the pot).
    for (const [matchId, book] of Object.entries(read<BettingStore>(guildId, "betting.json")?.books ?? {})) {
      const merged = (betting.books[matchId] ??= { pot: 0, tickets: {} });
      merged.pot += book.pot ?? 0;
      for (const [userId, ticket] of Object.entries(book.tickets ?? {})) {
        const prev = merged.tickets[userId];
        if (!prev || ticket.stake > prev.stake) merged.tickets[userId] = ticket;
      }
    }
  }

  lottery.history.sort((a, b) => b.at - a.at);
  lottery.history = lottery.history.slice(0, 20);

  const report: MigrationReport = {
    guilds: guildIds.length,
    wallets: Object.keys(coins).length,
    coinsBefore,
    coinsAfter: Object.values(coins).reduce((sum, n) => sum + n, 0),
    characters: Object.keys(characters).length,
    titles: Object.keys(titles).length,
    listings: Object.keys(market.listings).length,
    jackpot: lottery.jackpot,
  };

  if (dryRun) return report;

  writeJsonFile(globalFile("coins.json"), coins);
  writeJsonFile(globalFile("attendance.json"), attendance);
  writeJsonFile(globalFile("titles.json"), titles);
  writeJsonFile(globalFile("lottery.json"), lottery);
  writeJsonFile(globalFile("betting.json"), betting);
  writeJsonFile(globalFile("characters.json"), characters);
  writeJsonFile(globalFile("expeditions.json"), expeditions);
  writeJsonFile(globalFile("expedition-results.json"), results);
  writeJsonFile(globalFile("market.json"), market);
  writeJsonFile(globalFile("pvp.json"), pvp);
  // Written LAST but before the marker: the season stamp is what stops the
  // startup's rollRpgSeason() from mistaking a migrated world for a new league.
  saveGlobalSettings({ ...loadGlobalSettings(), rpgSeason, weekendDouble, activeEvent });

  // Retire the old ledgers in place: renamed, never deleted. They stop being a
  // second source of truth but remain on the volume to inspect or roll back to.
  const stamp = Date.now();
  for (const guildId of guildIds) {
    for (const file of MIGRATED_FILES) {
      const path = join(guildDir(guildId), file);
      if (existsSync(path)) renameSync(path, `${path}.migrated-${stamp}`);
    }
  }

  writeFileSync(join(globalDir(), MARKER), `${new Date(stamp).toISOString()}\n${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `[migrate] merged ${report.guilds} server(s) → global: ${report.wallets} wallets ` +
      `(${report.coinsBefore} → ${report.coinsAfter} 🪙), ${report.characters} heroes, ` +
      `${report.listings} listings, ${report.jackpot} 🪙 jackpot`,
  );
  return report;
}

// Direct run: `bun run src/migrate-global.ts [--dry-run]`
if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  if (alreadyMigrated()) {
    console.log(`[migrate] already done — see data/global/${MARKER}`);
  } else {
    const report = migrateToGlobal({ dryRun });
    if (!report) console.log("[migrate] nothing to migrate");
    else if (dryRun) console.log("[migrate] dry run —", JSON.stringify(report, null, 2));
  }
}
