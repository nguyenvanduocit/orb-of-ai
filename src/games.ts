// The betting-board game engine — the one shape behind bầu cua and đua thú:
// a channel-locked board message, a catalog of bet buttons (BET_STEP 🪙 per
// click), a betting deadline with best-effort auto-resolve, host-gated early
// resolve / cancel, expiry refunds and ghost-guarded payouts. A game file
// supplies only its catalog, copy, a synchronous `decide` (bets → outcome) and
// a `present` (outcome → board edits); every Discord interaction, coin move
// and timer lives here exactly once. Restart safety is three layers deep: the
// persisted `deadline` is the source of truth, the in-memory timer
// (scheduler.ts) is an optimization, the next click resolves lazily, and the
// idle sweeper (index.ts) eventually refunds boards nobody touches again.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Message,
} from "discord.js";
import { ensureBotLedger, isBotId, MAX_BOTS, mentionOrName, nextBotId, sweepBots } from "./bots";
import { loadCoins, saveCoins } from "./economy";
import { endGame, loadGame, saveGame, type StoredGame } from "./guilds";
import { cancelDeadline, scheduleDeadline } from "./scheduler";
import type { Command } from "./types";
import { boardPayload, divider, text } from "./ui";

export const BET_STEP = 10; // coins per button click
const BETTING_MS = 60_000;

// AI-bot bettors: any player adds one with the board's "🤖 Thêm bot" button (up
// to MAX_BOTS). A bot's stake is minted into the pot from the faucet and its
// ledger residual is burned by sweepBots at teardown, so the host wins/loses real
// coins against it (a lone host who can't attract humans still gets some action).

// Thuế nhà cái: khi người chơi làm cái (baucua/duathu/blackjack/roulette) và cầm
// cái CÓ LÃI, đốt phần này của lãi — sink cho việc làm nhà cái, chỉ thu khi cái
// thắng. Người đặt cửa không mất phí (họ đã ăn thế bất lợi chảy về cái). Trò 1:1
// với bot (oantuti) không đi qua đây — ván công bằng, không thu phí.
export const HOST_RAKE = 0.1;

export interface BoardState<K extends string> {
  host: string;
  deadline: number; // epoch ms — betting closes; persisted so restarts can't freeze a round
  messageId: string;
  bets: Record<string, Partial<Record<K, number>>>;
}

// Every decide() carries the coin credits to pay back (stake + winnings — bets
// were deducted when placed); the rest is presentation data for present().
export interface Outcome {
  results: Record<string, { credit: number; net: number }>;
  // Set by the banker settlement (hostIsBanker specs) so present() can show the
  // house's P/L, the rake burned off a winning house, and whether payouts were
  // capped; undefined for pot-based games. `delta` is the host's NET after the
  // rake (what present() renders as "ăn +delta"); `fee` is the burned rake.
  host?: { id: string; delta: number; fee: number; capped: boolean };
}

// present() builds a V2 ContainerBuilder per frame; the engine wraps it in
// boardPayload before it hits Discord, so game files never touch the V2 flag.
export type EditFn = (container: ContainerBuilder) => Promise<unknown>;

export interface BoardGameSpec<K extends string, R extends Outcome> {
  // Slash command name AND persisted game tag — the sweeper resolves teardown
  // via commands.get(stored.game), so the two must never drift apart.
  game: string;
  description: string;
  // When true the host is the house: losing stakes flow to the host and winning
  // payouts come out of the host's own balance (coins circulate instead of being
  // minted/burned). If the host can't cover a win, payouts are capped to the
  // host's balance and split pro-rata (settleBankerPayout). The host may not bet.
  hostIsBanker?: boolean;
  catalog: Record<K, { label: string; emoji: string }>;
  // `action` is the customId suffix (`baucua:roll`) — it lives on boards
  // already posted to Discord, keep it stable.
  resolveButton: { action: string; label: string; emoji: string };
  copy: {
    title: string; // status embeds (cancel / timeout / expire)
    boardTitle: string;
    intro: string[]; // rule lines at the top of the board
    countdown: { lead: string; early: string }; // "<lead> <t:…:R> — chủ ván <@…> có thể <early>."
    emptyBets: string;
    alreadyRunning: string;
    nobodyBet: string;
    beforeDeadline: string;
  };
  decide: (state: BoardState<K>) => R; // synchronous, no I/O: bets → settled outcome
  // outcome → board edits (an animation of V2 containers). The engine hands in the
  // "Ván mới" row so present() can graft it onto its FINAL frame (a V2 message
  // can't have components tacked on afterward — it must ship in one payload).
  present: (edit: EditFn, outcome: R, again: ActionRowBuilder<ButtonBuilder>) => Promise<void>;
  // For hostIsBanker games: the largest total credit the house could owe across
  // ALL outcomes given the per-key staked totals (a fixed-odds book pays every
  // unit on a key the same, so worst-case depends only on aggregate stake per
  // key, not who bet). The engine refuses a bet that would let some outcome
  // exceed what the host can pay (pot + host balance), so the house is always
  // solvent up front and settle-time capping is only a mid-round-drop backstop.
  maxLiability?: (totals: Partial<Record<K, number>>) => number;
}

const TIMEOUT_NO_BETS = "⌛ Hết giờ mà không ai cược — huỷ ván nhé bro.";
const CANCELLED_BY_HOST = "❌ Chủ ván đã huỷ — coin cược đã hoàn lại đầy đủ.";
const EXPIRED_REFUNDED = "⌛ Ván bị huỷ vì im ắng quá lâu — coin đã cược được hoàn lại đầy đủ.";

export function boardGameCommand<K extends string, R extends Outcome>(spec: BoardGameSpec<K, R>): Command {
  return {
    data: new SlashCommandBuilder().setName(spec.game).setDescription(spec.description),
    execute: (interaction) => openBoard(spec, interaction),
    handleButton: (interaction) => handleBoardButton(spec, interaction),
    handleExpiredGame: (client, guildId, channelId, stored) => expireBoard(spec, client, guildId, channelId, stored),
  };
}

export function potOf<K extends string>(bets: BoardState<K>["bets"]): number {
  return Object.values(bets)
    // Object.values on a generic Partial<Record<K, number>> infers unknown[]
    .flatMap((userBets) => Object.values(userBets) as (number | undefined)[])
    .reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
}

// Collapse the per-user bets into aggregate stake per key — all a fixed-odds
// book needs to price the house's exposure (spec.maxLiability).
export function keyTotals<K extends string>(bets: BoardState<K>["bets"]): Partial<Record<K, number>> {
  const totals: Partial<Record<K, number>> = {};
  for (const userBets of Object.values(bets)) {
    for (const [key, amount] of Object.entries(userBets) as [K, number][]) {
      totals[key] = (totals[key] ?? 0) + (amount ?? 0);
    }
  }
  return totals;
}

function statusContainer(title: string, description: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## ${title}\n${description}`));
}

function renderBoard<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  state: BoardState<K>,
  hostBankroll?: number,
): ContainerBuilder {
  const lines = Object.entries(state.bets).map(([userId, userBets]) => {
    const parts = (Object.entries(userBets) as [K, number][]).map(
      ([key, amount]) => `${spec.catalog[key].emoji} ${amount}`,
    );
    return `${mentionOrName(userId)}: ${parts.join(" · ")}`;
  });
  const bankerLine = spec.hostIsBanker
    ? [`🏦 Nhà cái: <@${state.host}>${hostBankroll !== undefined ? ` · quỹ **${hostBankroll}** 🪙` : ""}`]
    : [];
  const body = [
    `## ${spec.copy.boardTitle}`,
    ...spec.copy.intro,
    ...bankerLine,
    `${spec.copy.countdown.lead} <t:${Math.floor(state.deadline / 1000)}:R> — chủ ván <@${state.host}> có thể ${spec.copy.countdown.early}.`,
    "",
    lines.length > 0 ? `**Cược hiện tại:**\n${lines.join("\n")}` : spec.copy.emptyBets,
    `-# Tổng pot: ${potOf(state.bets)} coin`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...buttonRows(spec));
}

function buttonRows<K extends string, R extends Outcome>(spec: BoardGameSpec<K, R>): ActionRowBuilder<ButtonBuilder>[] {
  const betButtons = (Object.keys(spec.catalog) as K[]).map((key) =>
    new ButtonBuilder()
      .setCustomId(`${spec.game}:bet:${key}`)
      .setLabel(spec.catalog[key].label)
      .setEmoji(spec.catalog[key].emoji)
      .setStyle(ButtonStyle.Secondary),
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < betButtons.length; i += 3) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(betButtons.slice(i, i + 3)));
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${spec.game}:${spec.resolveButton.action}`)
        .setLabel(spec.resolveButton.label)
        .setEmoji(spec.resolveButton.emoji)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${spec.game}:addbot`).setLabel("Thêm bot").setEmoji("🤖").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${spec.game}:cancel`).setLabel("Huỷ ván").setStyle(ButtonStyle.Danger),
    ),
  );
  return rows;
}

// The "🔄 Ván mới" button on a settled game's embed. Its id carries the round's bot
// count so the next round auto-seats the same number of bots (stateless, restart-
// safe — same trick as blackjack's play-again). Shared by every game.
export function againRow(game: string, botCount: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${game}:again:${botCount}`)
      .setLabel("Ván mới")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Success),
  );
}

// Ghost guard on both payout paths: skip users whose ledger entry is gone
// (left the server mid-round) — never resurrect balances lifecycle cleanup
// already removed.
function payout(results: Outcome["results"]): void {
  const coins = loadCoins();
  for (const [userId, { credit }] of Object.entries(results)) {
    if (credit > 0 && userId in coins) coins[userId] = coins[userId]! + credit;
  }
  saveCoins(coins);
}

function refundAll<K extends string>(state: BoardState<K>): void {
  const coins = loadCoins();
  for (const [userId, userBets] of Object.entries(state.bets)) {
    const total = (Object.values(userBets) as (number | undefined)[]).reduce<number>(
      (sum, amount) => sum + (amount ?? 0),
      0,
    );
    if (total > 0 && userId in coins) coins[userId] = coins[userId]! + total;
  }
  saveCoins(coins);
}

// Pure: turn each player's full entitlement (from the game's decide()) into what
// the host-as-banker actually pays. Losing stakes fund winners; the host tops up
// the rest from `hostBalance`. When that isn't enough (need > hostBalance) the
// house is busted — the whole available pool (stakes + host balance) is split
// pro-rata by entitlement and `capped` is true. Coins are conserved exactly:
// Σ(paid credit) + hostDelta == totalStake, with the host keeping any rounding
// dust. `hostDelta` > 0 means the house won (collected more than it paid).
export function bankerSettle(
  results: Outcome["results"],
  totalStake: number,
  hostBalance: number,
): { results: Outcome["results"]; hostDelta: number; capped: boolean } {
  const totalCredit = Object.values(results).reduce((sum, r) => sum + r.credit, 0);
  if (totalCredit - totalStake <= hostBalance) {
    // House can cover the shortfall (or profits): everyone gets full entitlement.
    return { results, hostDelta: totalStake - totalCredit, capped: false };
  }
  // House busted: split the whole pool (stakes + host balance) pro-rata by
  // entitlement; the host empties out and keeps only the rounding remainder.
  const pool = totalStake + hostBalance;
  const capped: Outcome["results"] = {};
  let paid = 0;
  for (const [userId, r] of Object.entries(results)) {
    const stake = r.credit - r.net; // recovers the player's total stake for the round
    const share = totalCredit > 0 ? Math.floor((r.credit * pool) / totalCredit) : 0;
    capped[userId] = { credit: share, net: share - stake };
    paid += share;
  }
  return { results: capped, hostDelta: totalStake - paid, capped: true };
}

// Imperative shell for hostIsBanker settlement: read the live ledger, drop ghosts
// (and the host, who never bets), run the pure bankerSettle, then apply player
// credits + the host delta in one synchronous load→mutate→save. Mutates `results`
// in place so present() renders the (possibly capped) final numbers.
// Exported: /blackjack is a third host-as-banker game with its own (non-board)
// flow, and this is the one place the banker ledger math lives.
export function settleBankerPayout(
  hostId: string,
  results: Outcome["results"],
): { delta: number; fee: number; capped: boolean } {
  const coins = loadCoins();
  const active: Outcome["results"] = {};
  for (const [userId, r] of Object.entries(results)) {
    if (userId in coins && userId !== hostId) active[userId] = r;
  }
  const totalStake = Object.values(active).reduce((sum, r) => sum + (r.credit - r.net), 0);
  const settled = bankerSettle(active, totalStake, coins[hostId] ?? 0);
  for (const [userId, r] of Object.entries(settled.results)) {
    results[userId] = r; // reflect capping in the outcome present() will render
    if (r.credit > 0) coins[userId] = coins[userId]! + r.credit;
  }
  // Rake the house only when it made money this round: burn HOST_RAKE of the
  // gross win (a losing or capped-out host pays nothing). Burning = crediting the
  // host less and paying no one the difference, so circulating coins drop by
  // exactly `fee` — the sink for being the bank. `delta` is the host's net take.
  const grossDelta = settled.hostDelta;
  const fee = grossDelta > 0 ? Math.floor(grossDelta * HOST_RAKE) : 0;
  if (hostId in coins) coins[hostId] = coins[hostId]! + grossDelta - fee;
  saveCoins(coins);
  return { delta: grossDelta - fee, fee, capped: settled.capped };
}

// Fully synchronous: decide → payout → endGame with no await in between, so a
// racing timer/button can never settle the same round twice.
function settleRound<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  guildId: string,
  channelId: string,
  state: BoardState<K>,
): R {
  cancelDeadline(`${guildId}:${channelId}`);
  const outcome = spec.decide(state);
  if (spec.hostIsBanker) {
    const { delta, fee, capped } = settleBankerPayout(state.host, outcome.results);
    outcome.host = { id: state.host, delta, fee, capped };
  } else {
    payout(outcome.results);
  }
  endGame(guildId, channelId);
  sweepBots(); // burn any bot ledger residual — the faucet's GC (no-op if no bots played)
  return outcome;
}

// Also used by nối từ's expiry teardown (commands/noitu.ts).
export async function fetchBoardMessage(client: Client, channelId: string, messageId: string): Promise<Message | null> {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel.messages.fetch(messageId);
}

function scheduleAutoResolve<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  client: Client,
  guildId: string,
  channelId: string,
  delayMs: number,
): void {
  scheduleDeadline(`${guildId}:${channelId}`, delayMs, async () => {
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== spec.game) return;
    const state = stored.state as BoardState<K>;
    try {
      if (Object.keys(state.bets).length === 0) {
        endGame(guildId, channelId);
        const message = await fetchBoardMessage(client, channelId, state.messageId);
        await message?.edit(boardPayload(statusContainer(spec.copy.title, TIMEOUT_NO_BETS)));
        return;
      }
      const outcome = settleRound(spec, guildId, channelId, state);
      const bots = Object.keys(outcome.results).filter(isBotId).length;
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      if (message) {
        // present() grafts the "Ván mới" row onto its final V2 frame in one payload.
        await spec.present((container) => message.edit(boardPayload(container)), outcome, againRow(spec.game, bots));
      }
    } catch (error) {
      console.error(`[${spec.game}] auto-resolve failed in ${channelId}:`, error);
    }
  });
}

// Deterministic fallback bets: 1–2 random symbols, 1–3 units each. Guarantees a
// bot always has a legal move when the model is slow/unavailable.
function randomBoardBets<K extends string>(keys: K[]): Partial<Record<K, number>> {
  const bets: Partial<Record<K, number>> = {};
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const key = keys[Math.floor(Math.random() * keys.length)]!;
    const units = 1 + Math.floor(Math.random() * 3);
    bets[key] = (bets[key] ?? 0) + units * BET_STEP;
  }
  return bets;
}

// Synchronous, atomic: mint the bot's stake straight into the pot (faucet), one
// symbol at a time, skipping any bet the banker solvency gate can't cover — same
// worst-outcome check the human bet path enforces, so the house stays solvent.
function placeBotBoardBets<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  guildId: string,
  channelId: string,
  botId: string,
  bets: Partial<Record<K, number>>,
): boolean {
  const stored = loadGame(guildId, channelId);
  if (!stored || stored.game !== spec.game) return false;
  const state = stored.state as BoardState<K>;
  if (Date.now() > state.deadline) return false;
  const coins = loadCoins();
  const hostBalance = coins[state.host] ?? 0;
  let placed = false;
  for (const [key, amount] of Object.entries(bets) as [K, number][]) {
    if (spec.hostIsBanker && spec.maxLiability) {
      const totals = keyTotals(state.bets);
      totals[key] = (totals[key] ?? 0) + amount;
      const totalStake = (Object.values(totals) as (number | undefined)[]).reduce<number>(
        (sum, a) => sum + (a ?? 0),
        0,
      );
      if (spec.maxLiability(totals) > totalStake + hostBalance) continue; // house couldn't cover — drop this bet
    }
    const userBets = (state.bets[botId] ??= {});
    userBets[key] = (userBets[key] ?? 0) + amount; // minted into the pot, not debited from a wallet
    placed = true;
  }
  if (!placed) return false;
  ensureBotLedger([botId]); // mark the bot as a settlement participant so the banker settle pays/collects it
  saveGame(guildId, channelId, { game: spec.game, state });
  return true;
}

// Add one bot bettor on demand (the "Thêm bot" button). The bet is a quick random
// legal pick placed synchronously — a symbol choice needs no LLM, and going async
// only added a multi-second stall (the Haiku CLI cold-start overruns the button's
// timeout on the shared-cpu host anyway). Instant + solvency-gated. Returns true
// if at least one bet landed.
function addBoardBot<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  guildId: string,
  channelId: string,
  botId: string,
): boolean {
  const keys = Object.keys(spec.catalog) as K[];
  return placeBotBoardBets(spec, guildId, channelId, botId, randomBoardBets(keys));
}

// Shared board opener — both the slash `execute` and the "Ván mới" button call
// this. `send` posts the board message (reply+fetchReply for a slash, followUp
// for a button); `initialBots` pre-seats that many bot bettors (the previous
// round's count, carried by the again button) as instant heuristic bets.
async function startBoard<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  client: Client,
  guildId: string,
  channelId: string,
  hostId: string,
  send: (payload: ReturnType<typeof boardPayload>) => Promise<Message>,
  initialBots: number,
): Promise<void> {
  const state: BoardState<K> = { host: hostId, deadline: Date.now() + BETTING_MS, messageId: "", bets: {} };
  // Reserve the channel slot BEFORE the first await — two board opens in the
  // same window must not both pass the existence check.
  saveGame(guildId, channelId, { game: spec.game, state });
  try {
    const hostBankroll = spec.hostIsBanker ? (loadCoins()[hostId] ?? 0) : undefined;
    const message = await send(boardPayload(renderBoard(spec, state, hostBankroll)));
    // Re-load before patching in the message id: a bet clicked during the
    // roundtrips above already mutated the stored state — overwriting it with
    // our stale local copy would burn that player's deducted coins.
    const live = loadGame(guildId, channelId);
    if (live?.game === spec.game) {
      const liveState = live.state as BoardState<K>;
      liveState.messageId = message.id;
      saveGame(guildId, channelId, { game: spec.game, state: liveState });
    }
    // Carry over the previous round's bots — instant heuristic bets, solvency-gated.
    let seated = false;
    for (let i = 0; i < Math.min(initialBots, MAX_BOTS); i++) {
      const current = loadGame(guildId, channelId);
      if (!current || current.game !== spec.game) break;
      const botId = nextBotId(Object.keys((current.state as BoardState<K>).bets).filter(isBotId));
      if (!botId || !addBoardBot(spec, guildId, channelId, botId)) break;
      seated = true;
    }
    if (seated) {
      const after = loadGame(guildId, channelId);
      if (after?.game === spec.game) {
        const s = after.state as BoardState<K>;
        const hb = spec.hostIsBanker ? (loadCoins()[s.host] ?? 0) : undefined;
        await message.edit(boardPayload(renderBoard(spec, s, hb)));
      }
    }
  } catch (error) {
    // The board may have been live for a moment (post landed, follow-up failed) —
    // bets placed in that window already sit in the STORED state, so refund from a
    // re-load before freeing the slot; deleting the file unrefunded burns stakes.
    const live = loadGame(guildId, channelId);
    if (live?.game === spec.game) refundAll(live.state as BoardState<K>);
    endGame(guildId, channelId);
    sweepBots();
    throw error;
  }
  scheduleAutoResolve(spec, client, guildId, channelId, BETTING_MS + 1000);
}

async function openBoard<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const existing = loadGame(guildId, channelId);
  if (existing) {
    const hint =
      existing.game === spec.game
        ? spec.copy.alreadyRunning
        : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`;
    await interaction.reply({ content: hint, flags: MessageFlags.Ephemeral });
    return;
  }
  await startBoard(
    spec,
    interaction.client,
    guildId,
    channelId,
    interaction.user.id,
    async (payload) => {
      await interaction.reply(payload);
      return interaction.fetchReply();
    },
    0, // fresh slash game starts empty; bots come from the button
  );
}

// Idle sweeper: the round died mid-betting (e.g. timer lost to a restart and
// nobody clicked again) — refund every stake and close the board.
async function expireBoard<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  client: Client,
  guildId: string,
  channelId: string,
  stored: StoredGame,
): Promise<void> {
  const state = stored.state as BoardState<K>;
  // Synchronous teardown first so a racing button click can't double-settle.
  cancelDeadline(`${guildId}:${channelId}`);
  refundAll(state);
  endGame(guildId, channelId);
  sweepBots();
  try {
    const message = await fetchBoardMessage(client, channelId, state.messageId);
    await message?.edit(boardPayload(statusContainer(spec.copy.title, EXPIRED_REFUNDED)));
  } catch (error) {
    console.error(`[${spec.game}] expire edit failed in ${channelId}:`, error);
  }
}

async function handleBoardButton<K extends string, R extends Outcome>(
  spec: BoardGameSpec<K, R>,
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const [, action, arg] = interaction.customId.split(":");

  // "Ván mới" acts on an ALREADY-ENDED game, so it runs BEFORE the game-exists
  // check below. Its id carries the previous round's bot count to auto-seat.
  if (action === "again") {
    const existing = loadGame(guildId, channelId);
    if (existing) {
      await interaction.reply({
        content:
          existing.game === spec.game
            ? spec.copy.alreadyRunning
            : `Kênh này đang chơi **${existing.game}** — xong ván đó đã bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const botCount = Math.min(MAX_BOTS, Math.max(0, Number(arg) || 0));
    await interaction.update(boardPayload(statusContainer(spec.copy.title, "🔄 Ván mới đã mở bên dưới 👇"))); // gỡ nút Ván mới khỏi bảng kết quả cũ
    await startBoard(spec, interaction.client, guildId, channelId, interaction.user.id, (payload) => interaction.followUp(payload), botCount);
    return;
  }

  const stored = loadGame(guildId, channelId);
  if (!stored || stored.game !== spec.game) {
    await interaction.reply({
      content: `Ván này kết thúc rồi bro — mở ván mới bằng \`/${spec.game}\` nhé.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const state = stored.state as BoardState<K>;
  const hasBets = Object.keys(state.bets).length > 0;

  // First edit acks the click (interaction.update strips the buttons); any
  // further edits (animation frames) go to the board message directly.
  let first = true;
  const editViaInteraction: EditFn = async (container) => {
    if (first) {
      first = false;
      await interaction.update(boardPayload(container));
    } else {
      await interaction.message.edit(boardPayload(container));
    }
  };

  if (action === "cancel") {
    if (interaction.user.id !== state.host) {
      await interaction.reply({
        content: `Chỉ chủ ván <@${state.host}> huỷ được nhé bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    cancelDeadline(`${guildId}:${channelId}`);
    refundAll(state);
    endGame(guildId, channelId);
    sweepBots();
    await interaction.update(boardPayload(statusContainer(spec.copy.title, CANCELLED_BY_HOST)));
    return;
  }

  if (action === spec.resolveButton.action) {
    if (!hasBets) {
      await interaction.reply({ content: spec.copy.nobodyBet, flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== state.host && Date.now() < state.deadline) {
      await interaction.reply({ content: spec.copy.beforeDeadline, flags: MessageFlags.Ephemeral });
      return;
    }
    const outcome = settleRound(spec, guildId, channelId, state);
    const bots = Object.keys(outcome.results).filter(isBotId).length;
    await spec.present(editViaInteraction, outcome, againRow(spec.game, bots));
    return;
  }

  if (action === "addbot") {
    if (Date.now() > state.deadline) {
      await interaction.reply({ content: "Hết giờ cược rồi bro — không thêm bot được nữa.", flags: MessageFlags.Ephemeral });
      return;
    }
    const botId = nextBotId(Object.keys(state.bets).filter(isBotId));
    if (!botId) {
      await interaction.reply({ content: `Đủ ${MAX_BOTS} bot rồi bro 🤖`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!addBoardBot(spec, guildId, channelId, botId)) {
      // Solvency gate refused every bet (host too poor to cover) — say so, board unchanged.
      await interaction.reply({
        content: "🏦 Quỹ nhà cái chưa đủ để ôm thêm bot đặt cửa bro — chờ nhà cái nạp thêm nhé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const live = loadGame(guildId, channelId);
    if (!live || live.game !== spec.game) return;
    const liveState = live.state as BoardState<K>;
    const hostBankroll = spec.hostIsBanker ? (loadCoins()[liveState.host] ?? 0) : undefined;
    await interaction.update(boardPayload(renderBoard(spec, liveState, hostBankroll)));
    return;
  }

  // bet
  if (!arg || !(arg in spec.catalog)) return;
  const key = arg as K;
  if (spec.hostIsBanker && interaction.user.id === state.host) {
    await interaction.reply({
      content: "Bro là nhà cái ván này — nhà cái chỉ ăn/chung chứ không đặt cược nhé 🎰",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (Date.now() > state.deadline) {
    // Betting closed — resolve lazily (covers timers lost to a restart).
    if (hasBets) {
      const outcome = settleRound(spec, guildId, channelId, state);
      const bots = Object.keys(outcome.results).filter(isBotId).length;
      await spec.present(editViaInteraction, outcome, againRow(spec.game, bots));
    } else {
      endGame(guildId, channelId);
      await interaction.update(boardPayload(statusContainer(spec.copy.title, TIMEOUT_NO_BETS)));
    }
    return;
  }

  const coins = loadCoins();
  const balance = coins[interaction.user.id] ?? 0;
  if (balance < BET_STEP) {
    await interaction.reply({
      content: `Không đủ coin rồi bro — cần ${BET_STEP} 🪙 mỗi lần cược, số dư: ${balance}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Banker solvency gate: never accept a bet the host couldn't pay in the worst
  // outcome. Price the prospective book (this bet added) and refuse if the
  // largest possible payout would exceed the pot + the host's current balance.
  if (spec.hostIsBanker && spec.maxLiability) {
    const totals = keyTotals(state.bets);
    totals[key] = (totals[key] ?? 0) + BET_STEP;
    const totalStake = (Object.values(totals) as (number | undefined)[]).reduce<number>(
      (sum, amount) => sum + (amount ?? 0),
      0,
    );
    const worstPayout = spec.maxLiability(totals);
    const hostBalance = coins[state.host] ?? 0;
    if (worstPayout > totalStake + hostBalance) {
      await interaction.reply({
        content: `🏦 Nhà cái không ôm nổi kèo này bro — quỹ nhà cái đang **${hostBalance}** 🪙, mà lỡ kèo lớn nhất trúng thì phải chung tới **${worstPayout - totalStake}** 🪙. Chờ người khác cược cho cân kèo, hoặc thử con khác nhé.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  coins[interaction.user.id] = balance - BET_STEP;
  saveCoins(coins);
  const userBets = (state.bets[interaction.user.id] ??= {});
  userBets[key] = (userBets[key] ?? 0) + BET_STEP;
  saveGame(guildId, channelId, { game: spec.game, state });
  const hostBankroll = spec.hostIsBanker ? (coins[state.host] ?? 0) : undefined;
  await interaction.update(boardPayload(renderBoard(spec, state, hostBankroll)));
}
