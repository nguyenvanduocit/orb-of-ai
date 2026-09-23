// Voice rewards: pay coins for time spent in a voice channel, two tiers over one
// shared block length (floor(minutes / streamBlockMinutes) blocks, leftover
// discarded):
//   • Go Live (VoiceState.streaming)      → streamCoinsPerBlock (the full rate)
//   • just sitting in voice with others   → voiceCoinsPerBlock (much lower)
// so a weak machine that can't stream still cày coin by hanging out. The idle tier
// needs ≥2 humans in the channel and skips the AFK channel (no solo 24/7 farming);
// Go Live earns regardless (you're broadcasting), and a member alone / in AFK burns
// the block without pay.
//
// ONE session per member exists WHILE THEY'RE IN VOICE (opened on join, not on Go
// Live), keyed by userId in streams.json. A once-a-minute ticker credits each newly
// completed block at whichever tier is live AT PAYOUT TIME and keeps ONE message in
// the voice channel's text chat (first paid block posts it, later blocks edit it,
// the leave finalizes it into a summary). The single monotonic paidBlocks counter is
// the whole anti-double-count guarantee: a block is paid exactly once, and the tier
// only changes coins-per-block — never which block is paid — so a streaming member is
// never counted by both tiers. Fed raw gateway events + a scheduler tick by index.ts.

import { EmbedBuilder, escapeMarkdown, type Client, type Guild, type VoiceState } from "discord.js";
import { config } from "./config";
import { activeMultiplier, addCoins } from "./economy";
import { displayNames, loadStreamSessions, saveStreamSessions } from "./guilds";
import { forEachGuild, startTicker } from "./scheduler";

// What to render for a session — cumulative totals so the live message and the
// final summary both read the same running numbers.
interface StreamStatus {
  channelId: string;
  minutes: number;
  reward: number; // coins credited so far this session
  balance: number;
  bonusApplied: boolean;
  live: boolean; // current tier is the Go Live rate — drives the ongoing title only
  messageId?: string;
}

function fmtDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

// Humans (not bots) currently sitting in a given voice channel.
function humansIn(guild: Guild, channelId: string): number {
  let count = 0;
  for (const voiceState of guild.voiceStates.cache.values()) {
    if (voiceState.channelId !== channelId) continue;
    if (voiceState.member?.user.bot) continue;
    count++;
  }
  return count;
}

// The idle (non-streaming) tier only pays when the member is genuinely hanging out
// WITH others: at least one other human present and not parked in the AFK channel.
function idleEligible(guild: Guild, channelId: string): boolean {
  if (guild.afkChannelId && channelId === guild.afkChannelId) return false; // parked away — not farmable
  return humansIn(guild, channelId) >= 2; // themselves + ≥1 other → "chơi chung với người khác"
}

// The coins-per-block for a member right now: full rate while Go Live (any audience),
// the low rate while idle-with-others, else 0 (alone / AFK — the block is burned).
function tierFor(guild: Guild, voiceState: VoiceState): { perBlock: number; live: boolean } {
  if (voiceState.streaming) return { perBlock: config.streamCoinsPerBlock, live: true };
  if (voiceState.channelId && idleEligible(guild, voiceState.channelId)) {
    return { perBlock: config.voiceCoinsPerBlock, live: false };
  }
  return { perBlock: 0, live: false };
}

function streamEmbed(name: string, status: StreamStatus, ongoing: boolean): EmbedBuilder {
  const who = `**${escapeMarkdown(name)}**`;
  const embed = new EmbedBuilder()
    .setColor(0x593695)
    .setFooter({
      text:
        `${config.streamCoinsPerBlock} 🪙/${config.streamBlockMinutes} phút khi Go Live · ` +
        `${config.voiceCoinsPerBlock} 🪙/${config.streamBlockMinutes} phút khi ngồi voice`,
    })
    .addFields(
      { name: "Thời lượng", value: `⏱️ ${fmtDuration(status.minutes)}`, inline: true },
      { name: ongoing ? "Đã kiếm" : "Thưởng", value: `🪙 +${status.reward}`, inline: true },
      { name: "Số dư", value: `🪙 ${status.balance}`, inline: true },
    );
  const bonus = status.bonusApplied ? `\n⚡ **Đang có sự kiện nhân thưởng!**` : "";
  if (ongoing && status.live) {
    embed.setTitle("🎥 Đang Go Live").setDescription(
      `${who} đang phát sóng — cứ live tiếp là coin chảy về đều bro!${bonus}`,
    );
  } else if (ongoing) {
    embed.setTitle("🔊 Đang cày trong voice").setDescription(
      `${who} ngồi voice với anh em cũng có coin nhè nhẹ — Go Live để ăn rate cao hơn nha bro!${bonus}`,
    );
  } else {
    embed.setTitle("👋 Buổi voice đã kết thúc").setDescription(
      `${who} cày cuốc quá trời, chiến tiếp nha bro!` +
        (status.bonusApplied ? `\n⚡ **Đã được nhân thưởng sự kiện trong buổi!**` : ""),
    );
  }
  return embed;
}

// Credit every full block completed since the last payout, at the tier passed in.
// Synchronous (persist paidBlocks BEFORE crediting, no await in between) so a
// duplicate tick, a racing stop edge, or a reconcile can never pay the same block
// twice — and a crash between the two file writes under-pays (loses a block) rather
// than double-paying. Returns the running status to render, or null when nothing was
// credited (no new block, an ineligible/0-rate block, or the session is gone).
function accrueBlocks(guildId: string, userId: string, perBlock: number, live: boolean): StreamStatus | null {
  const sessions = loadStreamSessions(guildId);
  const session = sessions[userId];
  if (!session) return null;

  const minutes = Math.floor((Date.now() - session.startedAt) / 60_000);
  const elapsedBlocks = Math.floor(minutes / config.streamBlockMinutes);
  const newBlocks = elapsedBlocks - (session.paidBlocks ?? 0);

  // Remember the tier we're seeing now — settle (on leave / restart) pays the
  // trailing block at this rate, since the member is already gone by then.
  const rateChanged = session.rate !== perBlock;
  session.rate = perBlock;

  if (newBlocks <= 0) {
    if (rateChanged) saveStreamSessions(guildId, sessions); // persist the tier switch; nothing to pay
    return null;
  }

  // Advance the counter for EVERY completed block, even at rate 0 (alone in voice /
  // AFK) — the block is consumed without pay, so becoming eligible later can never
  // retroactively back-pay the blocks spent ineligible.
  session.paidBlocks = elapsedBlocks;
  if (perBlock <= 0) {
    saveStreamSessions(guildId, sessions);
    return null;
  }

  // Faucet multiplier (weekend x2 / active event) applied at payout — all integers.
  const multiplier = activeMultiplier("stream");
  const reward = newBlocks * perBlock * multiplier;
  session.paidReward = (session.paidReward ?? 0) + reward;
  if (multiplier > 1) session.bonusApplied = true;
  saveStreamSessions(guildId, sessions); // mark consumed first
  const balance = addCoins(userId, reward); // then credit

  return {
    channelId: session.channelId,
    minutes,
    reward: session.paidReward,
    balance,
    bonusApplied: session.bonusApplied ?? false,
    live,
    messageId: session.messageId,
  };
}

// Settle on the stop edge (leave voice) or on reconcile: pay any block completed
// since the last tick at the tier the ticker last observed, then drop the session.
// Synchronous (drop the session BEFORE crediting, no await in between) so a duplicate
// stop or a racing reconcile can never double-pay, and a crash under-pays rather than
// double-pays. Returns the final status to render, or null when nothing was earned.
function settleSession(guildId: string, userId: string): StreamStatus | null {
  const sessions = loadStreamSessions(guildId);
  const session = sessions[userId];
  if (!session) return null;

  const minutes = Math.floor((Date.now() - session.startedAt) / 60_000);
  const remaining = Math.floor(minutes / config.streamBlockMinutes) - (session.paidBlocks ?? 0);

  // The member is gone, so we can't read a live tier — use the last one the ticker
  // recorded. rate 0 (they were alone / AFK) → nothing owed for the trailing block.
  const perBlock = session.rate ?? config.voiceCoinsPerBlock;
  let trailing = 0;
  let bonusApplied = session.bonusApplied ?? false;
  if (remaining > 0 && perBlock > 0) {
    const multiplier = activeMultiplier("stream");
    trailing = remaining * perBlock * multiplier;
    if (multiplier > 1) bonusApplied = true;
  }

  const reward = (session.paidReward ?? 0) + trailing;
  const channelId = session.channelId;
  const messageId = session.messageId;
  const live = perBlock === config.streamCoinsPerBlock; // last tier was the Go Live rate

  delete sessions[userId];
  saveStreamSessions(guildId, sessions); // drop the session first
  const balance = addCoins(userId, trailing); // trailing 0 → atomic no-op read

  if (reward <= 0) return null; // never earned anything — stay silent
  return { channelId, minutes, reward, balance, bonusApplied, live, messageId };
}

// Fetch the voice channel's text chat and either edit the tracked message or
// send a fresh one. Returns the delivered message id (for the caller to
// persist), or null on any failure — best-effort, the coins are already
// credited. The member is named in plain text, never mentioned — a voice
// session is ambient, and a ping per session is noise.
async function deliver(
  guild: Guild,
  channelId: string,
  messageId: string | undefined,
  embed: EmbedBuilder,
): Promise<string | null> {
  const channel = await guild.client.channels.fetch(channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  if (messageId) {
    const existing = await channel.messages.fetch(messageId).catch(() => null);
    if (existing) {
      await existing.edit({ content: null, embeds: [embed] });
      return existing.id;
    }
    // message vanished — fall through and post a fresh one
  }
  const sent = await channel.send({ embeds: [embed] });
  return sent.id;
}

// Members in voice are always cached; the fetch fallback covers a settle for
// someone who already left the server.
async function memberName(guild: Guild, userId: string): Promise<string> {
  return guild.members.cache.get(userId)?.displayName ?? (await displayNames(guild, [userId]))(userId);
}

// Post the live message on the first paid block, then edit that same message every
// block after (report once, then update in place).
async function renderLive(guild: Guild, userId: string, status: StreamStatus): Promise<void> {
  const guildId = guild.id;
  try {
    const embed = streamEmbed(await memberName(guild, userId), status, true);
    const id = await deliver(guild, status.channelId, status.messageId, embed);
    if (id && id !== status.messageId) {
      // First post (or a re-post after the old message vanished): remember the
      // id — but only if the session still exists, since a stop edge may have
      // settled and deleted it while we awaited, and we must never resurrect it.
      const sessions = loadStreamSessions(guildId);
      if (sessions[userId]) {
        sessions[userId].messageId = id;
        saveStreamSessions(guildId, sessions);
      }
    }
  } catch (error) {
    console.error(`[streams] live render failed in ${status.channelId}:`, error);
  }
}

// Finalize into the wrap-up summary — edits the live message when there is one,
// otherwise sends a fresh summary (a session that ended before the first tick).
async function renderFinal(guild: Guild, userId: string, status: StreamStatus): Promise<void> {
  try {
    const embed = streamEmbed(await memberName(guild, userId), status, false);
    await deliver(guild, status.channelId, status.messageId, embed);
  } catch (error) {
    console.error(`[streams] final render failed in ${status.channelId}:`, error);
  }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (member?.user.bot) return;

  const before = oldState.channelId;
  const after = newState.channelId;
  // Same channel (mute / deafen / camera / Go Live toggle) — no session lifecycle
  // change; the ticker reads the streaming state live to pick the tier each block.
  if (before === after) return;

  const guildId = newState.guild.id;
  const userId = newState.id;

  if (!before && after) {
    // Joined voice → open a session. The tier (Go Live vs idle) is decided per
    // block by the ticker; the session is just the clock while they're connected.
    const sessions = loadStreamSessions(guildId);
    if (userId in sessions) return; // already tracking — keep the original clock
    sessions[userId] = { channelId: after, startedAt: Date.now() };
    saveStreamSessions(guildId, sessions);
    return;
  }

  if (before && !after) {
    // Left voice entirely → settle + close, posting the summary to the channel the
    // session opened in.
    const result = settleSession(guildId, userId);
    if (result) await renderFinal(newState.guild, userId, result);
    return;
  }

  // Channel switch (both set, different): keep the session + clock running. The live
  // message stays in the channel the session opened in; the ticker reads the member's
  // CURRENT channel for tier/eligibility, so moving to an empty or AFK channel stops
  // the idle payout on its own.
}

// Once-a-minute tick: pay each newly-completed block for everyone still in a voice
// channel, at their current tier, and keep their live message updated. Members no
// longer in voice are left to the leave edge / reconcile to settle.
export function startStreamScheduler(client: Client): void {
  startTicker("streams", 60_000, () =>
    forEachGuild(client, "streams", async (guild) => {
      for (const userId of Object.keys(loadStreamSessions(guild.id))) {
        const voiceState = guild.voiceStates.cache.get(userId);
        if (!voiceState?.channelId) continue; // no longer in voice — leave edge / reconcile settles it
        const { perBlock, live } = tierFor(guild, voiceState);
        const status = accrueBlocks(guild.id, userId, perBlock, live);
        if (status) await renderLive(guild, userId, status);
      }
    }),
  );
}

// ClientReady catch-up: settle persisted sessions whose owner is no longer in voice
// (the true leave time is unknowable, so "now" slightly overpays across the downtime
// window), and start tracking anyone found in voice with no record (their pre-restart
// minutes are lost — the safer direction). All mutations run before the first await,
// so a queued VoiceStateUpdate can never see — and revive the old clock of — a stale
// pre-restart record.
export async function reconcileGuildStreams(guild: Guild): Promise<void> {
  const settled: { userId: string; result: StreamStatus }[] = [];
  for (const userId of Object.keys(loadStreamSessions(guild.id))) {
    if (guild.voiceStates.cache.get(userId)?.channelId) continue; // still in voice — keep the clock
    const result = settleSession(guild.id, userId);
    if (result) settled.push({ userId, result });
  }

  const sessions = loadStreamSessions(guild.id); // re-load: settling above rewrote the file
  let changed = false;
  for (const voiceState of guild.voiceStates.cache.values()) {
    if (!voiceState.channelId || voiceState.member?.user.bot) continue;
    if (voiceState.id in sessions) continue;
    sessions[voiceState.id] = { channelId: voiceState.channelId, startedAt: Date.now() };
    changed = true;
  }
  if (changed) saveStreamSessions(guild.id, sessions);

  for (const { userId, result } of settled) {
    await renderFinal(guild, userId, result);
  }
}
