// World Cup betting engine (/worldcup): fixtures from football-data.org (free tier
// covers competition WC), one global match cache shared by every guild, the
// pure pari-mutuel payout core, and the season scheduler that settles finished
// matches into each guild's coin ledger. It also keeps a live scoreboard fresh
// (once-a-minute) for in-play matches a guild has a book on, finalized into the
// settlement embed when the whistle blows. The betting UX lives in
// src/commands/worldcup.ts; this module owns data + payouts + announcements.

import type { Client, Guild } from "discord.js";
import { ContainerBuilder } from "discord.js";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config";
import { loadBetting, loadCoins, saveBetting, saveCoins, type BetPick, type MatchBook } from "./economy";
import { resolveAnnounceChannel } from "./guilds";
import { forEachGuild, startTicker } from "./scheduler";
import { boardPayload, text } from "./ui";

export interface WorldCupMatch {
  id: number;
  kickoff: number; // epoch ms — betting locks here
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | ... | FINISHED | CANCELLED | AWARDED
  stage: string; // GROUP_STAGE | LAST_16 | ... — a draw is only sellable in the group stage
  home: string;
  away: string;
  winner: BetPick | null; // score.winner — the overall result, incl. extra time & penalties
  score: string | null; // display only, e.g. "2–1 (pen)"
}

interface WorldCupCache {
  updatedAt: number;
  matches: WorldCupMatch[];
}

const CACHE_FILE = fileURLToPath(new URL("../data/worldcup.json", import.meta.url));

// Unlike guild ledgers, the cache is disposable — the next refresh rebuilds
// it — so a missing or corrupt file is just discarded, no quarantine.
let cache: WorldCupCache | null = null;

function getCache(): WorldCupCache {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as WorldCupCache;
    } catch {
      cache = { updatedAt: 0, matches: [] };
    }
  }
  return cache;
}

function saveCache(value: WorldCupCache): void {
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  const tmp = `${CACHE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, CACHE_FILE);
}

export function getMatch(id: number): WorldCupMatch | undefined {
  return getCache().matches.find((m) => m.id === id);
}

// A match takes bets while it's still in the future and not called off.
export function isOpenForBetting(match: WorldCupMatch, now = Date.now()): boolean {
  return (match.status === "SCHEDULED" || match.status === "TIMED") && match.kickoff > now;
}

// The ball is rolling (or halftime) — the window where we keep a live score up.
export function isLive(match: WorldCupMatch): boolean {
  return match.status === "IN_PLAY" || match.status === "PAUSED";
}

export function openMatches(now = Date.now()): WorldCupMatch[] {
  return getCache()
    .matches.filter((m) => isOpenForBetting(m, now))
    .sort((a, b) => a.kickoff - b.kickoff);
}

// --- football-data.org v4 ---

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  homeTeam?: { name: string | null };
  awayTeam?: { name: string | null };
  score?: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime?: { home: number | null; away: number | null };
  };
}

const WINNER_MAP: Record<string, BetPick> = { HOME_TEAM: "HOME", AWAY_TEAM: "AWAY", DRAW: "DRAW" };

function scoreLabel(m: ApiMatch): string | null {
  const ft = m.score?.fullTime;
  if (ft?.home == null || ft?.away == null) return null;
  const suffix =
    m.score?.duration === "PENALTY_SHOOTOUT" ? " (pen)" : m.score?.duration === "EXTRA_TIME" ? " (hiệp phụ)" : "";
  return `${ft.home}–${ft.away}${suffix}`;
}

// One call fetches the whole competition — the 10-minute tick stays far under
// the free tier's 10 requests/minute. Failure keeps the previous cache.
export async function refreshMatches(): Promise<boolean> {
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": config.footballDataToken! },
      // A hung connection would otherwise hold the ticker's overlap guard forever.
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { matches?: ApiMatch[] };
    const matches = (body.matches ?? [])
      // Knockout slots without qualified teams yet have no names — nothing to bet on.
      .filter((m) => m.homeTeam?.name && m.awayTeam?.name)
      .map(
        (m): WorldCupMatch => ({
          id: m.id,
          kickoff: Date.parse(m.utcDate),
          status: m.status,
          stage: m.stage,
          home: m.homeTeam!.name!,
          away: m.awayTeam!.name!,
          winner: (m.score?.winner && WINNER_MAP[m.score.winner]) || null,
          score: scoreLabel(m),
        }),
      );
    cache = { updatedAt: Date.now(), matches };
    saveCache(cache);
    return true;
  } catch (error) {
    console.error("[worldcup] fixture refresh failed — keeping the previous cache:", error);
    return false;
  }
}

// --- Settlement ---

// Pure pari-mutuel core: the pot (every stake ever placed, cancelled tickets
// included) splits among the tickets that picked the result, pro-rata by
// stake — floored per winner, remainder burned. Nobody picked right → every
// active ticket gets its stake back (the ticket fee is gone either way).
export function settleBook(book: MatchBook, result: BetPick): { payouts: Record<string, number>; refunded: boolean } {
  const tickets = Object.entries(book.tickets);
  const winners = tickets.filter(([, t]) => t.pick === result);
  if (winners.length === 0) {
    return { payouts: Object.fromEntries(tickets.map(([id, t]) => [id, t.stake])), refunded: true };
  }
  const winnerStake = winners.reduce((sum, [, t]) => sum + t.stake, 0);
  return {
    payouts: Object.fromEntries(winners.map(([id, t]) => [id, Math.floor((book.pot * t.stake) / winnerStake)])),
    refunded: false,
  };
}

interface Settlement {
  match: WorldCupMatch;
  kind: "won" | "refund" | "void"; // void = called off → stake AND fee come back
  payouts: Record<string, number>;
  pot: number;
  rooms: Record<string, { channelId: string; messageId?: string }>; // servers that played — where to announce, and the in-play message to finalize in place
}

function settlementEmbed(s: Settlement): ContainerBuilder {
  const lines = Object.entries(s.payouts)
    .sort(([, a], [, b]) => b - a)
    .map(([userId, amount]) => `${s.kind === "won" ? "🎉" : "↩️"} <@${userId}> **+${amount}** 🪙`);
  if (s.kind === "void") {
    const body = [
      "## ⚽ Kèo bị hủy",
      `**${s.match.home} vs ${s.match.away}** không diễn ra nữa.`,
      "Hoàn lại cả tiền cược lẫn phí vé:",
      ...lines,
    ].join("\n");
    return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(body));
  }
  const resultLabel =
    s.match.winner === "DRAW" ? "Hòa" : s.match.winner === "HOME" ? s.match.home : s.match.away;
  const body = [
    `## ⚽ ${s.match.home} ${s.match.score ?? "vs"} ${s.match.away}`,
    `Kết quả kèo: **${resultLabel}**`,
    "",
    s.kind === "refund"
      ? lines.length > 0
        ? `Không ai đoán trúng — hoàn tiền cược:\n${lines.join("\n")}`
        : "Không còn vé nào trên kèo này."
      : lines.join("\n"),
    `-# Tổng pot: ${s.pot} coin`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(s.kind === "refund" ? 0x99aab5 : 0x57f287)
    .addTextDisplayComponents(text(body));
}

// The in-play scoreboard we keep fresh each tick. During play football-data
// updates score.fullTime with the running score, so match.score already reads
// e.g. "1–0"; before the first goal it's null → show 0–0.
function liveEmbed(match: WorldCupMatch, book: MatchBook): ContainerBuilder {
  const body = [
    `## ⚽ LIVE — ${match.home} vs ${match.away}`,
    `# ${match.home}  ${match.score ?? "0–0"}  ${match.away}`,
    match.status === "PAUSED" ? "⏸️ Nghỉ giữa hiệp" : "🔴 Đang đá",
    `💰 Pot: **${book.pot}** 🪙 · ${Object.keys(book.tickets).length} vé (kèo đã khóa)`,
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0xed4245).addTextDisplayComponents(text(body));
}

// Edit a message in place; false if the channel/message is gone (deleted, or
// the announce channel moved) so the caller can repost instead.
async function editMessage(
  guild: Guild,
  handle: { channelId: string; messageId: string },
  container: ContainerBuilder,
): Promise<boolean> {
  try {
    const channel = await guild.channels.fetch(handle.channelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    await (await channel.messages.fetch(handle.messageId)).edit(boardPayload(container));
    return true;
  } catch {
    return false;
  }
}

// Keep a live scoreboard fresh in this guild for every in-play match it has a
// bettor on. The book is shared across servers; only the message is per-room,
// so each server follows the same match in its own channel. The first live
// sighting posts it, later ticks edit it in place (id unchanged → no store
// write), and settlement finalizes that same message.
async function updateLiveScores(guild: Guild): Promise<void> {
  const guildId = guild.id;
  const betting = loadBetting();
  for (const [matchId, book] of Object.entries(betting.books)) {
    const room = book.rooms?.[guildId];
    if (!room) continue; // nobody here bet on it — don't spam an uninterested server
    const match = getMatch(Number(matchId));
    if (!match || !isLive(match)) continue;
    const container = liveEmbed(match, book);
    if (room.messageId && (await editMessage(guild, { channelId: room.channelId, messageId: room.messageId }, container))) {
      continue; // refreshed in place
    }
    const channel = await resolveAnnounceChannel(guild, room.channelId);
    if (!channel) continue;
    let messageId: string;
    try {
      messageId = (await channel.send(boardPayload(container))).id;
    } catch (error) {
      console.error(`[worldcup] live score post failed in guild ${guildId}:`, error);
      continue;
    }
    // Persist the handle synchronously (no await between load and save) so a
    // bet/cancel racing during the send above can never be clobbered.
    const fresh = loadBetting();
    const target = fresh.books[matchId];
    if (target) {
      target.rooms = { ...target.rooms, [guildId]: { channelId: channel.id, messageId } };
      saveBetting(fresh);
    }
  }
}

// Settle every finished match, ONCE for the whole system. The book is shared,
// so the payout must happen exactly once no matter how many servers played it —
// settling per guild would pay from the first server's pass and leave every
// other server with a vanished book and no announcement.
//
// All ledger mutations happen in one synchronous block (no await until both
// files are saved) — mirroring bầu cua — so a racing bet/cancel interaction can
// never interleave. Announcements come after, per room that actually played.
async function settleAll(client: Client): Promise<void> {
  const betting = loadBetting();
  const settlements: Settlement[] = [];
  const coins = loadCoins();
  let changed = false;
  for (const [matchId, book] of Object.entries(betting.books)) {
    const match = getMatch(Number(matchId));
    if (!match) {
      // Gone from the fixtures — most likely an upstream data glitch (e.g. a
      // team name transiently null gets filtered out of the cache). Voiding
      // here would mint wrong refunds, so keep the book and make noise; it
      // settles normally once the match reappears.
      console.warn(`[worldcup] match ${matchId} missing from fixtures — keeping its book`);
      continue;
    }
    let settlement: Settlement | null = null;
    if (match.status === "CANCELLED") {
      // Called off — undo each purchase entirely, at the fee actually paid.
      settlement = {
        match,
        kind: "void",
        payouts: Object.fromEntries(Object.entries(book.tickets).map(([id, t]) => [id, t.stake + t.fee])),
        pot: book.pot,
        rooms: book.rooms ?? {},
      };
    } else if (match.winner && (match.status === "FINISHED" || match.status === "AWARDED")) {
      const { payouts, refunded } = settleBook(book, match.winner);
      settlement = { match, kind: refunded ? "refund" : "won", payouts, pot: book.pot, rooms: book.rooms ?? {} };
    }
    if (!settlement) continue; // not decided yet — keep waiting
    for (const [userId, amount] of Object.entries(settlement.payouts)) {
      // Same ghost guard as bầu cua: no payouts for people already forgotten.
      if (amount > 0 && userId in coins) coins[userId] = coins[userId]! + amount;
    }
    delete betting.books[matchId];
    changed = true;
    if (settlement.pot > 0) settlements.push(settlement); // untouched books close silently
  }
  if (!changed) return;
  saveCoins(coins);
  saveBetting(betting);

  // Announcements after the synchronous settle — a send failure never rolls
  // back payouts (same best-effort stance as the Go Live reward summary). In
  // each server that played, a match with a live scoreboard is finalized in
  // place (that message becomes the settlement embed); otherwise it posts fresh
  // in the room the bets came from.
  for (const settlement of settlements) {
    const container = settlementEmbed(settlement);
    for (const [guildId, room] of Object.entries(settlement.rooms)) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      try {
        if (room.messageId && (await editMessage(guild, { channelId: room.channelId, messageId: room.messageId }, container))) {
          continue;
        }
        const channel = await resolveAnnounceChannel(guild, room.channelId);
        if (channel) await channel.send(boardPayload(container));
      } catch (error) {
        console.error(`[worldcup] settlement announce failed in guild ${guildId}:`, error);
      }
    }
  }
}

// The season scheduler: refresh fixtures, settle once for the whole system,
// then refresh each server's live scoreboard. Runs once at startup (catches
// matches finished while the bot was down) and every minute after — a 1-minute
// cadence keeps live scores fresh at just 1 API call/tick, far under the free
// tier's 10 requests/minute. Started by index.ts only when FOOTBALL_DATA_TOKEN
// is set; removing the token after the season turns the whole feature off.
const TICK_MS = 60_000;

export function startFootballScheduler(client: Client): void {
  startTicker("worldcup", TICK_MS, async () => {
    await refreshMatches();
    // Never act against an empty fixture list (first fetch failed and no cache
    // file yet) — "match not found" would wrongly void every open book.
    if (getCache().matches.length === 0) return;
    // Settle first (it finalizes live messages in place), then repaint what's
    // still in play. Settlement is system-wide; only the scoreboards fan out.
    await settleAll(client);
    await forEachGuild(client, "worldcup", (guild) => updateLiveScores(guild));
  });
}
