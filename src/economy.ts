// The shared economy: ONE wallet, ONE check-in streak, ONE title collection and
// ONE lottery per PERSON, across every server the bot is in. A player who joins
// a second server walks in with everything they earned in the first.
//
// That is also why the faucets live here rather than in a guild folder. The
// moment coins are shared, a per-server faucet is a money printer: check-in
// stored per guild would pay the same person once per server per day, and a
// per-server event multiplier would let anyone shop around for the richest
// server to claim in. Both are global for that reason, and only for that
// reason.
//
// What is deliberately NOT here (see store.ts): anything answering "what is
// happening in this room?" — voice sessions, coin drops, begs, running games,
// the announce channel. Those stay per-guild in guilds.ts.

import { config } from "./config";
import { globalFile, readJsonFile, writeJsonFile } from "./store";

// --- Coins: data/global/coins.json = { [userId]: number } ---

type Coins = Record<string, number>;

export function loadCoins(): Coins {
  return readJsonFile<Coins>(globalFile("coins.json")) ?? {};
}

export function saveCoins(coins: Coins): void {
  writeJsonFile(globalFile("coins.json"), coins);
}

// The starting balance is granted once per PERSON, not once per server —
// otherwise joining N servers would mint N × startingCoins into one wallet.
// Returns false when the player already has a wallet (any server, any time).
export function grantStartingCoins(userId: string): boolean {
  const coins = loadCoins();
  if (userId in coins) return false;
  coins[userId] = config.startingCoins;
  saveCoins(coins);
  return true;
}

export function addCoins(userId: string, amount: number): number {
  const coins = loadCoins();
  const next = (coins[userId] ?? 0) + amount;
  coins[userId] = next;
  saveCoins(coins);
  return next;
}

// --- Attendance: data/global/attendance.json = { [userId]: ISO dates, sorted } ---
// One streak per person. Check-in is a daily faucet, so storing it per guild
// would pay the same person once per server per day.

export type Attendance = Record<string, string[]>;

export function loadAttendance(): Attendance {
  return readJsonFile<Attendance>(globalFile("attendance.json")) ?? {};
}

export function saveAttendance(attendance: Attendance): void {
  writeJsonFile(globalFile("attendance.json"), attendance);
}

// --- Titles: data/global/titles.json = { [userId]: { owned, equipped } } ---
// Danh hiệu mua bằng coin — catalog + UX live in commands/danhhieu.ts; this is
// just the ledger. Bought with the shared wallet, so it displays everywhere the
// player goes.

export interface MemberTitles {
  owned: string[]; // catalog ids
  equipped: string | null; // catalog id currently displayed next to the member's name
}

export type TitlesStore = Record<string, MemberTitles>;

export function loadTitles(): TitlesStore {
  return readJsonFile<TitlesStore>(globalFile("titles.json")) ?? {};
}

export function saveTitles(titles: TitlesStore): void {
  writeJsonFile(globalFile("titles.json"), titles);
}

// --- Lottery: data/global/lottery.json — the shared coin lottery (/xoso) ---
// One jackpot for everyone: a hundred numbers, one owner each, drawn for the
// whole system. Pooling it is the point — a per-server jackpot in a small
// server is a prize nobody crosses the room for.

// One past draw — appended on every real draw, newest-first, kept as a bounded
// ring (the writer in xoso.ts caps the array) so history never grows unbounded.
export interface LotteryDraw {
  n: number; // winning number 0–99
  winnerId: string; // who took the jackpot
  prize: number; // coins won
  numbers: number; // how many numbers the winner held that round
  sold: number; // total numbers in the draw pool (live tickets only)
  at: number; // epoch ms of the draw
}

export interface LotteryStore {
  jackpot: number; // accumulated pot — rolls over when a draw finds no tickets
  drawAt: number; // epoch ms of the next draw; 0 = no round open
  // Where the result posts, per server that had a buyer this round. NOT a
  // mirrored interactive board — just the reveal landing in each room where
  // people actually bought, and cleared on every draw.
  channels: Record<string, string>; // guildId → channelId
  tickets: Record<string, number[]>; // numbers 0–99 claimed per userId, current round only — one owner per number
  history: LotteryDraw[]; // past draws, newest-first, bounded ring (see /xoso lichsu)
}

export function loadLottery(): LotteryStore {
  const raw = readJsonFile<Partial<LotteryStore>>(globalFile("lottery.json"));
  return {
    jackpot: raw?.jackpot ?? 0,
    drawAt: raw?.drawAt ?? 0,
    channels: raw?.channels ?? {},
    tickets: raw?.tickets ?? {},
    history: raw?.history ?? [],
  };
}

export function saveLottery(store: LotteryStore): void {
  writeJsonFile(globalFile("lottery.json"), store);
}

// --- Betting: data/global/betting.json — World Cup coin bets (/worldcup) ---
// Pari-mutuel splits a pot among whoever called it right, so a bigger crowd is
// strictly a better game: one shared book per match instead of a thin book per
// server.

export type BetPick = "HOME" | "DRAW" | "AWAY";

export interface BetTicket {
  pick: BetPick;
  stake: number; // coins already in the pot — forfeited on cancel
  fee: number; // ticket fee burned at purchase — recorded so a voided match refunds what was actually paid
  placedAt: number; // epoch ms
}

export interface MatchBook {
  pot: number; // every stake ever placed on this match; cancels don't shrink it
  tickets: Record<string, BetTicket>; // active tickets by userId — one per user
  // Every server that has a bettor on this match, and where to talk to it:
  // `channelId` is where the betting happened, `messageId` the live-score
  // message once one exists (finalized in place into the settlement embed).
  // The book is shared; only the messages are per-room, so each server follows
  // the same match in its own channel.
  rooms?: Record<string, { channelId: string; messageId?: string }>;
}

export interface BettingStore {
  books: Record<string, MatchBook>; // by football-data match id
}

export function loadBetting(): BettingStore {
  const raw = readJsonFile<Partial<BettingStore>>(globalFile("betting.json"));
  return { books: raw?.books ?? {} };
}

export function saveBetting(store: BettingStore): void {
  writeJsonFile(globalFile("betting.json"), store);
}

// --- Global settings: data/global/settings.json ---
// System-wide knobs that must not differ per server, because coins are shared:
// a faucet multiplier that varied by server would just be an arbitrage the
// whole crowd walks to. The RPG season lives here too — one league, one reset,
// one starting line for everybody.

// Which faucet a Tier-2 event multiplies: a single faucet or "all" of them.
export type EventKind = "checkin" | "stream" | "all";

export interface GlobalSettings {
  weekendDouble: boolean; // Tier-1 auto event: x2 faucet coins on weekends, default on
  activeEvent: {
    kind: EventKind; // which faucet the multiplier applies to
    multiplier: number; // 2, 3, ...
    until: number; // epoch ms — GC anchor: activeMultiplier ignores it past this, the event ticker sweeps it
    startedBy: string; // userId who opened the event
  } | null;
  rpgSeason: number | null; // the season the shared world is on; behind SEASON → wipe-on-startup (fresh league)
}

export function loadGlobalSettings(): GlobalSettings {
  const raw = readJsonFile<Partial<GlobalSettings>>(globalFile("settings.json"));
  return {
    weekendDouble: raw?.weekendDouble ?? true,
    activeEvent: raw?.activeEvent ?? null,
    rpgSeason: raw?.rpgSeason ?? null,
  };
}

export function saveGlobalSettings(settings: GlobalSettings): void {
  writeJsonFile(globalFile("settings.json"), settings);
}

// Weekend (Sat/Sun) in Asia/Ho_Chi_Minh — the Tier-1 x2 window. Pure clock
// derive, zero stored state (so it's always right, even right after a restart).
// Shared by activeMultiplier + the event scheduler (events.ts).
export function isVietnamWeekend(): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(new Date());
  return weekday === "Sat" || weekday === "Sun";
}

// Faucet coin multiplier for right now: the greater of the Tier-1 weekend x2 and
// any Tier-2 activeEvent that applies to this faucet and hasn't expired. Returns
// 1 when nothing is active. FAUCETS ONLY (checkin + voice/Go Live) — never banker/board
// games or the lottery jackpot, whose coins are redistributed, not minted, so
// multiplying them would break coin conservation. Restart-safe: weekend is pure
// clock, and the event self-expires by `until`, so a lost timer can't keep minting.
export function activeMultiplier(kind: "checkin" | "stream"): number {
  const { weekendDouble, activeEvent } = loadGlobalSettings();
  const weekend = weekendDouble && isVietnamWeekend() ? 2 : 1;
  const event =
    activeEvent && Date.now() < activeEvent.until && (activeEvent.kind === "all" || activeEvent.kind === kind)
      ? activeEvent.multiplier
      : 1;
  return Math.max(weekend, event);
}

// Forget a player's economy entirely. Called only when someone shares no server
// with the bot any more — leaving ONE of several servers must never cost them
// their wallet (see forgetIfGone in guilds.ts).
export function removeEconomyData(userId: string): void {
  const coins = loadCoins();
  if (userId in coins) {
    delete coins[userId];
    saveCoins(coins);
  }
  const attendance = loadAttendance();
  if (userId in attendance) {
    delete attendance[userId];
    saveAttendance(attendance);
  }
  const titles = loadTitles();
  if (userId in titles) {
    delete titles[userId];
    saveTitles(titles);
  }
  const lottery = loadLottery();
  if (userId in lottery.tickets) {
    delete lottery.tickets[userId]; // ticket money is already burned/in the jackpot — stays there
    saveLottery(lottery);
  }
  const betting = loadBetting();
  let hadTickets = false;
  for (const book of Object.values(betting.books)) {
    if (userId in book.tickets) {
      delete book.tickets[userId]; // stake stays in the pot, like a cancelled ticket
      hadTickets = true;
    }
  }
  if (hadTickets) saveBetting(betting);
}
