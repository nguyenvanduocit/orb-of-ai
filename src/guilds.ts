// Per-server state and lifecycle: what belongs to ONE room rather than to a
// person. The agent workspace + personality, the announce channel, voice reward
// sessions, coin drops, begs, and the games running in each channel.
//
// The player's own life — wallet, check-in streak, titles, hero, market
// listings, lottery tickets — lives in economy.ts and rpg-store.ts, shared
// across every server. That split is why leaving one server no longer costs
// anyone anything: this module deletes only the room-shaped state, and a person
// is forgotten entirely (forgetIfGone) exactly when they share no server with
// the bot any more.

import { PermissionFlagsBits } from "discord.js";
import type { Client, Guild, GuildBasedChannel, GuildTextBasedChannel } from "discord.js";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { grantStartingCoins, loadAttendance, loadCoins, loadTitles, removeEconomyData } from "./economy";
import { loadCharacters, removeRpgData } from "./rpg-store";
import { DATA_DIR, guildDir, liveGuildDir, readJsonFile, TEMPLATE_DIR, writeJsonFile } from "./store";

export { guildDir, liveGuildDir, listGuildIds, readJsonFile, writeJsonFile } from "./store";

// Copy the full template (personality, knowledge dir) if the workspace doesn't
// exist yet. Idempotent — safe to call before every access.
export function ensureWorkspace(guildId: string): string {
  const dir = guildDir(guildId);
  if (!existsSync(dir)) {
    cpSync(TEMPLATE_DIR, dir, { recursive: true });
    console.log(`[guilds] provisioned workspace ${dir}`);
  }
  return dir;
}

// Skills are bot-managed prompt/code, not per-guild data — refresh them from the
// template on every sync so skill updates reach EXISTING servers too (the initial
// template copy only runs once, at first provision, so a new/updated skill would
// otherwise never ship to servers that were provisioned earlier). Overlay-only:
// cpSync overwrites/adds files under .claude/skills and touches nothing else —
// the personality CLAUDE.md and the agent's data/ dir are left alone. Called
// from syncGuild (startup + guildCreate), not per-message.
function refreshSkills(guildId: string): void {
  const dir = liveGuildDir(guildId);
  if (!dir) return;
  const src = join(TEMPLATE_DIR, ".claude", "skills");
  if (!existsSync(src)) return;
  cpSync(src, join(dir, ".claude", "skills"), { recursive: true });
}

// Install a GENERATED skill into the template, so the existing refreshSkills overlay ships
// it to every workspace on the next sync. Takes the files as an argument rather than
// importing the generator: guilds.ts is imported by every command, and reaching the other
// way (guilds → wiki → commands/* → guilds) would be an evaluation cycle. The composition
// happens in src/index.ts, which already owns both halves.
//
// The target directory is REPLACED wholesale, so a reference file dropped from the
// generator leaves no stale copy behind on the volume.
export function installGeneratedSkill(name: string, files: Record<string, string>): void {
  const dir = join(TEMPLATE_DIR, ".claude", "skills", name);
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  console.log(`[guilds] generated skill "${name}" (${Object.keys(files).length} files)`);
}

// Server removed the app → wipe the room-shaped state it owned. Players keep
// their wallets and heroes: they may well be playing in another server, and
// even if they aren't, forgetIfGone is the one place allowed to decide that.
export function removeGuildData(guildId: string): void {
  rmSync(guildDir(guildId), { recursive: true, force: true });
}

// --- Guild settings: data/guild_<guildId>/settings.json ---
// Genuinely per-room: where announcements post, and whether this server has
// been welcomed. The economy knobs (weekend x2, active event) and the RPG
// season are system-wide and live in economy.ts — a faucet multiplier that
// differed per server would just be an arbitrage, now that coins are shared.

export interface GuildSettings {
  announceChannelId: string | null; // manual override (/xoso kenh, /worldcup kenh); null → resolveAnnounceChannel auto-detects
  onboardedAt: number | null; // guildCreate posted the welcome once — never re-post on restart
  lastWeekendAnnounced: string | null; // ISO week ("2026-W27") the weekend x2 was announced here — once per week per server
}

export function loadSettings(guildId: string): GuildSettings {
  const raw = readJsonFile<Partial<GuildSettings>>(join(guildDir(guildId), "settings.json"));
  return {
    announceChannelId: raw?.announceChannelId ?? null,
    onboardedAt: raw?.onboardedAt ?? null,
    lastWeekendAnnounced: raw?.lastWeekendAnnounced ?? null,
  };
}

export function saveSettings(guildId: string, settings: GuildSettings): void {
  const dir = liveGuildDir(guildId);
  if (dir) writeJsonFile(join(dir, "settings.json"), settings);
}

// --- Voice reward: data/guild_<guildId>/streams.json = { [userId]: in-progress voice session } ---
// One session per member while they sit in a voice channel (opened on JOIN, not on
// Go Live). Each completed block pays at the live rate when they're streaming, else
// the low idle rate — the ticker picks the tier per block. Because there is a SINGLE
// monotonic paidBlocks counter per session, a block is always paid exactly once: the
// tier only changes coins-per-block, never which block is paid, so streaming can
// never be double-counted against idle voice presence.
//
// Stays per-guild because a voice session IS a room: it belongs to a channel, and a
// person can only sit in one voice channel at a time, so there is nothing to farm by
// being in many servers.

export interface StreamSession {
  channelId: string; // voice channel the session opened in — the live message + summary post here
  startedAt: number; // epoch ms
  paidBlocks?: number; // full blocks the ticker has already consumed (restart-safe; absent = 0)
  paidReward?: number; // coins credited so far this session (tier + event multiplier vary per block)
  rate?: number; // coins-per-block the ticker last observed — settle pays the trailing block at this tier
  messageId?: string; // the live-updating message to edit each block (absent until the first paid block)
  bonusApplied?: boolean; // true once any block was paid under an event multiplier > 1
}

export type StreamSessions = Record<string, StreamSession>;

export function loadStreamSessions(guildId: string): StreamSessions {
  return readJsonFile<StreamSessions>(join(guildDir(guildId), "streams.json")) ?? {};
}

export function saveStreamSessions(guildId: string, sessions: StreamSessions): void {
  const dir = liveGuildDir(guildId);
  if (dir) writeJsonFile(join(dir, "streams.json"), sessions);
}

// --- Coin drops: data/guild_<guildId>/drops.json — admin coin drops (/coindrop) ---
// Một kênh tối đa một drop đang mở, key theo channelId. Coin escrow từ ví người
// thả lúc tạo; phần chưa nhặt hoàn lại khi hết giờ. State transient (đóng sau
// vài phút, hoặc lúc startup qua scheduler) — drop tự dọn, nên grab của người
// rời server chỉ là lịch sử.

export interface CoinDrop {
  channelId: string;
  messageId: string; // để scheduler sửa message khi đóng
  hostId: string; // người thả — trừ coin lúc tạo, nhận hoàn phần dư, không được nhặt
  total: number; // tổng đã thả
  remaining: number[]; // các phần chưa nhặt (pop khi có người nhặt); [] = đã nhặt sạch
  grabs: Record<string, number>; // userId → số coin đã nhặt (mỗi người một lần)
  deadline: number; // epoch ms — hết giờ thì đóng + hoàn phần dư
}

export interface DropStore {
  drops: Record<string, CoinDrop>; // theo channelId
}

export function loadDrops(guildId: string): DropStore {
  const raw = readJsonFile<Partial<DropStore>>(join(guildDir(guildId), "drops.json"));
  return { drops: raw?.drops ?? {} };
}

export function saveDrops(guildId: string, store: DropStore): void {
  const dir = liveGuildDir(guildId);
  if (dir) writeJsonFile(join(dir, "drops.json"), store);
}

// --- Ăn xin: data/guild_<guildId>/begs.json — lời xin coin theo mốc (/coin anxin) ---
// Một kênh tối đa một lời xin đang mở, key theo channelId. KHÔNG escrow: mỗi lượt
// cho chuyển coin thẳng người-cho → người-xin, nên hết giờ chẳng hoàn gì (quà đã
// trao là xong). State transient — tự dọn qua startBegScheduler, cùng khuôn với drops.

export interface Beg {
  channelId: string;
  messageId: string; // để scheduler sửa message khi đóng
  beggarId: string; // người xin — nhận mọi lượt cho, không được tự cho mình
  goal: number; // mốc coin cần gom
  collected: number; // đã gom được — đủ goal là khoá
  reason: string | null; // lời năn nỉ (không bắt buộc)
  contributors: Record<string, number>; // userId → tổng đã cho
  deadline: number; // epoch ms — chưa đủ goal mà quá hạn thì đóng
}

export interface BegStore {
  begs: Record<string, Beg>; // theo channelId
}

export function loadBegs(guildId: string): BegStore {
  const raw = readJsonFile<Partial<BegStore>>(join(guildDir(guildId), "begs.json"));
  return { begs: raw?.begs ?? {} };
}

export function saveBegs(guildId: string, store: BegStore): void {
  const dir = liveGuildDir(guildId);
  if (dir) writeJsonFile(join(dir, "begs.json"), store);
}

// --- Games: data/guild_<guildId>/games/<channelId>.json — one active game per channel ---
// A live table is a room, not a person: it is the one message everyone at that
// table is looking at. It stays per-channel — the shared part of playing across
// servers is the wallet you bring and the hero you built, not a board kept in
// sync across rooms.

export interface StoredGame {
  game: string;
  state: unknown;
  updatedAt?: number; // epoch ms, stamped by saveGame — drives the idle sweeper
}

function gameFile(guildId: string, channelId: string): string {
  return join(guildDir(guildId), "games", `${channelId}.json`);
}

export function loadGame(guildId: string, channelId: string): StoredGame | null {
  return readJsonFile<StoredGame>(gameFile(guildId, channelId));
}

export function saveGame(guildId: string, channelId: string, stored: StoredGame): void {
  const dir = liveGuildDir(guildId);
  if (!dir) return;
  mkdirSync(join(dir, "games"), { recursive: true });
  writeJsonFile(gameFile(guildId, channelId), { ...stored, updatedAt: Date.now() });
}

export function endGame(guildId: string, channelId: string): void {
  rmSync(gameFile(guildId, channelId), { force: true });
}

// Teardown failed mid-cleanup — the game file may be the only record of who
// staked what, so park it as .failed-<timestamp> (invisible to the sweeper,
// which only lists *.json) instead of deleting the evidence.
export function quarantineGame(guildId: string, channelId: string): void {
  const file = gameFile(guildId, channelId);
  if (existsSync(file)) renameSync(file, `${file}.failed-${Date.now()}`);
}

// Every persisted game across all guilds — input for the global idle sweeper.
export function listGameChannels(): { guildId: string; channelId: string }[] {
  const entries: { guildId: string; channelId: string }[] = [];
  if (!existsSync(DATA_DIR)) return entries;
  for (const dir of readdirSync(DATA_DIR)) {
    if (!dir.startsWith("guild_")) continue;
    const gamesDir = join(DATA_DIR, dir, "games");
    if (!existsSync(gamesDir)) continue;
    for (const file of readdirSync(gamesDir)) {
      if (!file.endsWith(".json")) continue;
      entries.push({ guildId: dir.slice("guild_".length), channelId: file.slice(0, -".json".length) });
    }
  }
  return entries;
}

// --- Announcing ---

// Can the bot actually post in this channel? Text-based + View + Send perms.
function canAnnounceIn(guild: Guild, channel: GuildBasedChannel | null | undefined): channel is GuildTextBasedChannel {
  if (!channel || !channel.isTextBased()) return false;
  const me = guild.members.me;
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  return Boolean(perms?.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages));
}

// Where guild-wide announcements post (lottery draw, worldcup settlement,
// weekend events). Priority: the manual /xoso|/worldcup kenh override → a
// caller-supplied preferred channel (e.g. the channel the lottery round was
// opened from, so the result lands where people actually played) → the system
// channel → the first text channel the bot can post in; null if nowhere is
// sendable (caller stays silent). Each step is gated on the bot still being
// able to post there.
export async function resolveAnnounceChannel(
  guild: Guild,
  preferredChannelId?: string | null,
): Promise<GuildTextBasedChannel | null> {
  const { announceChannelId } = loadSettings(guild.id);
  if (announceChannelId) {
    const override = await guild.channels.fetch(announceChannelId).catch(() => null);
    if (canAnnounceIn(guild, override)) return override;
  }
  if (preferredChannelId) {
    const preferred = await guild.channels.fetch(preferredChannelId).catch(() => null);
    if (canAnnounceIn(guild, preferred)) return preferred;
  }
  const system = guild.systemChannel;
  if (canAnnounceIn(guild, system)) return system;
  for (const channel of guild.channels.cache.values()) {
    if (canAnnounceIn(guild, channel)) return channel;
  }
  return null;
}

// --- Lifecycle ---

// Provision a server: template workspace + a starting wallet for every human
// member who doesn't have one yet. Idempotent — runs on every startup and on
// guildCreate.
//
// It no longer prunes anybody. Leaving a server used to mean deleting that
// member's ledgers, which was right when each server had its own economy; now
// a wallet spans servers, so only sweepOrphans (below) may delete one, and only
// after confirming the person is in NO server with the bot.
export async function syncGuild(guild: Guild): Promise<void> {
  ensureWorkspace(guild.id);
  refreshSkills(guild.id);
  try {
    const members = await guild.members.fetch();
    let granted = 0;
    for (const member of members.values()) {
      if (member.user.bot) continue;
      if (grantStartingCoins(member.id)) granted++;
    }
    console.log(`[guilds] synced ${guild.name} (${guild.id}): ${members.size} members, ${granted} new wallets`);
  } catch (error) {
    // Only point at the intent when the error actually says so — a timeout or
    // network blip labeled as a portal misconfiguration sends debugging astray.
    const hint =
      error instanceof Error && /disallowed intents|GuildMembers/i.test(`${error.name} ${error.message}`)
        ? ' — is "Server Members Intent" enabled in the Developer Portal?'
        : "";
    console.warn(`[guilds] cannot fetch members of ${guild.id}${hint}`, error);
  }
}

// Room-shaped state for one member of one server. Called on GuildMemberRemove:
// an in-progress voice session in a server they just left can never complete,
// so it goes. Everything else they own is theirs to keep.
export function removeGuildMemberState(guildId: string, userId: string): void {
  const sessions = loadStreamSessions(guildId);
  if (userId in sessions) {
    delete sessions[userId];
    saveStreamSessions(guildId, sessions);
  }
}

// Does this person still share ANY server with the bot? Authoritative (a fetch,
// not the cache) because the answer decides whether their wallet and hero are
// deleted. Errs toward "yes": a failed lookup must never be read as absence.
export async function sharesAnyGuild(client: Client, userId: string): Promise<boolean> {
  for (const guild of client.guilds.cache.values()) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) return true;
  }
  return false;
}

// The one place a person is forgotten. Their wallet, streak, titles, hero,
// listings and tickets are deleted ONLY once they share no server with the bot.
export async function forgetIfGone(client: Client, userId: string): Promise<boolean> {
  if (userId.startsWith("botai-")) return false; // AI game bots are game state, swept by their own game
  if (await sharesAnyGuild(client, userId)) return false;
  removeEconomyData(userId);
  removeRpgData(userId);
  console.log(`[guilds] ${userId} shares no server with the bot — forgotten`);
  return true;
}

// GC for the shared stores: anyone holding global state who is no longer in any
// server the bot is in. GuildMemberRemove handles the common case immediately;
// this catches what it can't — members who left during downtime, and everyone in
// a server that removed the app.
//
// SAFETY: it deletes nothing unless EVERY guild's member list was fetched in
// full. A partial fetch would look exactly like "everybody left", and this
// function's whole job is deleting wallets.
export async function sweepOrphans(client: Client): Promise<number> {
  const known = new Set<string>();
  for (const guild of client.guilds.cache.values()) {
    try {
      // syncGuild has already fetched every member, so the cache is normally
      // complete — reuse it. Asking the gateway again right after that trips its
      // member-request rate limit (opcode 8), and since a failed fetch aborts the
      // sweep, re-fetching meant the GC never actually ran.
      const members =
        guild.members.cache.size >= guild.memberCount ? guild.members.cache : await guild.members.fetch();
      for (const id of members.keys()) known.add(id);
    } catch (error) {
      console.warn(`[guilds] orphan sweep aborted — cannot fetch members of ${guild.id}:`, error);
      return 0;
    }
  }
  // No guilds at all (or none readable) means no evidence of anything, not
  // evidence that everyone is gone.
  if (known.size === 0) return 0;
  const holders = new Set<string>([
    ...Object.keys(loadCoins()),
    ...Object.keys(loadAttendance()),
    ...Object.keys(loadTitles()),
    ...Object.keys(loadCharacters()),
  ]);
  let forgotten = 0;
  for (const userId of holders) {
    if (known.has(userId) || userId.startsWith("botai-")) continue;
    removeEconomyData(userId);
    removeRpgData(userId);
    forgotten++;
  }
  if (forgotten > 0) console.log(`[guilds] orphan sweep forgot ${forgotten} player(s) in no shared server`);
  return forgotten;
}

// Resolve display names for leaderboard rendering. The boards are system-wide
// now, so they routinely list people who are not in the server doing the
// looking: a guild member fetch gives the nicest name (server nickname), and
// anyone it misses falls back to their global Discord name rather than being
// rendered as a ghost. Best-effort — a failed lookup degrades to a placeholder
// instead of failing the render.
export async function displayNames(guild: Guild, userIds: string[]): Promise<(userId: string) => string> {
  if (userIds.length === 0) return () => "(không rõ)";
  const members = await guild.members.fetch({ user: userIds }).catch(() => null);
  const missing = userIds.filter((id) => !members?.has(id));
  const outside = new Map<string, string>();
  for (const id of missing) {
    const user = await guild.client.users.fetch(id).catch(() => null);
    if (user) outside.set(id, user.displayName ?? user.username);
  }
  return (userId) => members?.get(userId)?.displayName ?? outside.get(userId) ?? "(không rõ)";
}
