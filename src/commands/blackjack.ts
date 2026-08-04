// /blackjack — bàn xì dách nhiều người, chủ bàn làm nhà cái (host-as-banker).
// Một người mở bàn = nhà cái, người khác vào cược. Ai cũng đấu MỘT tay nhà cái
// (luật cố định: rút tới 17). Thắng nhà cái chung, thua nhà cái ăn — coin luân
// chuyển chứ không mint/burn, đúng mô hình bầu cua/đua thú (bankerSettle).
//
// Ba pha, một file/kênh (data/guild_<id>/games/<channelId>.json):
//   lobby   — vào bàn qua modal nhập tiền, chủ bàn Chia bài / Huỷ.
//   playing — CHƠI THEO LƯỢT: đánh lần lượt theo thứ tự vào bàn. Lượt hiện tại =
//             người đầu tiên trong `order` còn status "playing" (`currentTurn`) —
//             không cần con trỏ lượt riêng. CHỈ người tới lượt bấm được Rút/Dừng/
//             Gấp đôi; người khác bấm bị từ chối "chưa tới lượt". Khi một tay chốt
//             (dừng/quắc/blackjack/gấp đôi), lượt tự nhảy sang người kế còn playing.
//   → hết người còn playing (currentTurn == null) → nhà cái lật bài rút tới 17,
//     settle tất cả. Mỗi lượt có deadline riêng (TURN_MS): tới lượt mà treo thì
//     tự Dừng rồi nhảy lượt — một người AFK không kẹt cả bàn.
//
// Bot chơi tức thì ngay khi chia bài (playBots, thuần toán) nên lượt chỉ dừng ở
// người thật; ghế bot đã chốt sẵn được currentTurn bỏ qua.
//
// Bất biến tiền: coin trừ NGAY khi vào bàn/gấp đôi (đồng bộ load→mutate→save),
// settle cũng đồng bộ trước khi chạy animation lật bài — crash giữa màn diễn
// không mất coin. Nhà cái luôn đủ quỹ: mỗi lần vào bàn chặn nếu quỹ nhà cái <
// 2× tổng tiền cược (đủ ôm cả trường hợp mọi người gấp đôi rồi thắng); capping
// của bankerSettle chỉ là lưới đỡ khi quỹ tụt giữa chừng.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { ensureBotLedger, isBotId, MAX_BOTS, mentionOrName, nextBotId, sweepBots } from "../bots";
import { RANKS, SUITS, cardBack, cardEmoji, type Card, type Rank } from "../cards";
import { againRow, fetchBoardMessage, settleBankerPayout, type Outcome } from "../games";
import { boardPayload, divider, text } from "../ui";
import { loadCoins, saveCoins } from "../economy";
import { endGame, loadGame, saveGame } from "../guilds";
import { cancelDeadline, scheduleDeadline, sleep } from "../scheduler";
import type { Command } from "../types";

// Single source of truth for the persisted game tag AND the slash command name —
// the sweeper resolves teardown via commands.get(stored.game).
const GAME = "blackjack";

export const MIN_BUYIN = 10; // tiền cược tối thiểu khi vào bàn
export const MAX_SEATS = 7; // số người chơi tối đa (nhà cái không tính)
export const DECKS = 4; // 4 bộ bài trộn mới mỗi ván → không đếm bài được, không bao giờ cạn
const TURN_MS = 60_000; // hết giờ MỘT LƯỢT → người tới lượt coi như Dừng, nhảy lượt

// --- Bài & bộ bài (pure core) ---
// Deck primitives (RANKS/SUITS/Card) + the emoji render live in ../cards — the
// single source shared with the card-emoji asset pipeline.

const VALUE: Record<Rank, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
};

// Một shoe DECKS bộ, trộn Fisher-Yates. Rút = pop từ cuối.
export function freshShoe(decks = DECKS): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const rank of RANKS) for (const suit of SUITS) shoe.push({ rank, suit });
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j]!, shoe[i]!];
  }
  return shoe;
}

function draw(state: BlackjackState): Card {
  // Phòng hờ shoe cạn (không xảy ra với 4 bộ + cap 7 ghế): trộn shoe mới.
  if (state.deck.length === 0) state.deck = freshShoe();
  return state.deck.pop()!;
}

// Tổng điểm tốt nhất: Át = 11 rồi hạ xuống 1 khi quá 21. `soft` = còn Át tính 11.
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += VALUE[c.rank];
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

// --- Settle một tay so với nhà cái (pure) ---
// credit = tiền trả lại (cược + thắng), net = lời/lỗ. Bài đã trừ cược khi đặt.
// Blackjack tự nhiên trả 3:2; tay quắc (>21) thua ngay kể cả nhà cái cũng quắc.
export function settleHand(player: Card[], committed: number, dealer: Card[]): { credit: number; net: number } {
  const pv = handValue(player).total;
  const dv = handValue(dealer).total;
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(dealer);

  let outcome: "win" | "lose" | "push" | "blackjack";
  if (pv > 21) outcome = "lose";
  else if (pBJ && dBJ) outcome = "push";
  else if (pBJ) outcome = "blackjack";
  else if (dBJ) outcome = "lose";
  else if (dv > 21) outcome = "win";
  else if (pv > dv) outcome = "win";
  else if (pv < dv) outcome = "lose";
  else outcome = "push";

  switch (outcome) {
    case "lose":
      return { credit: 0, net: -committed };
    case "push":
      return { credit: committed, net: 0 };
    case "win":
      return { credit: committed * 2, net: committed };
    case "blackjack": {
      const profit = Math.floor((committed * 3) / 2); // 3:2, làm tròn xuống về số nguyên
      return { credit: committed + profit, net: profit };
    }
  }
}

// --- State ---

type HandStatus = "playing" | "stand" | "bust" | "blackjack" | "double";

interface Seat {
  buyin: number; // tiền cược gốc
  committed: number; // buyin, hoặc 2×buyin sau khi gấp đôi
  cards: Card[];
  status: HandStatus;
}

interface BlackjackState {
  phase: "lobby" | "playing";
  host: string;
  messageId: string;
  deadline: number; // epoch ms — hết giờ ra quyết định (pha playing); 0 ở lobby
  deck: Card[];
  dealer: Card[]; // [lá ngửa, lá úp, ...] — lá úp giấu tới khi nhà cái lật
  seats: Record<string, Seat>; // theo userId
  order: string[]; // thứ tự vào bàn (userId số bị object sắp lại nên phải giữ riêng)
}

function totalBuyin(state: BlackjackState): number {
  return state.order.reduce((sum, id) => sum + (state.seats[id]?.buyin ?? 0), 0);
}

// Lượt hiện tại = người ĐẦU TIÊN trong thứ tự vào bàn còn đang chơi. Vì một tay
// chỉ rời "playing" khi lượt của nó kết thúc, người này chính là người tới lượt;
// mọi người trước đã chốt, mọi người sau đang chờ. null = hết người → nhà cái lật.
export function currentTurn(state: BlackjackState): string | null {
  return state.order.find((id) => state.seats[id]?.status === "playing") ?? null;
}

// --- Nhà cái chơi + settle (đồng bộ, không await tới lúc endGame) ---

interface Resolved {
  state: BlackjackState;
  results: Outcome["results"]; // sau capping (settleBankerPayout mutate tại chỗ)
  hostDelta: number; // net nhà cái sau khi trừ phí
  fee: number; // phí nhà cái bị đốt (0 nếu cái không có lãi)
  capped: boolean;
}

// Nhà cái rút tới khi ≥ 17 (dừng ở MỌI 17, kể cả 17 mềm — luật gọn nhất).
function playDealer(state: BlackjackState): void {
  while (handValue(state.dealer).total < 17) state.dealer.push(draw(state));
}

function resolveTable(guildId: string, channelId: string, state: BlackjackState): Resolved {
  cancelDeadline(`${guildId}:${channelId}`);
  playDealer(state);
  const results: Outcome["results"] = {};
  for (const id of state.order) {
    const seat = state.seats[id];
    if (seat) results[id] = settleHand(seat.cards, seat.committed, state.dealer);
  }
  const { delta, fee, capped } = settleBankerPayout(state.host, results);
  endGame(guildId, channelId);
  sweepBots(); // đốt ledger residual của bot — GC của faucet (no-op nếu không có bot)
  return { state, results, hostDelta: delta, fee, capped };
}

// Hết giờ một lượt (hoặc timer mất sau restart): người tới lượt coi như Dừng rồi
// nhảy lượt. Trả về Resolved nếu bàn đã hết người chơi (caller lo animation lật
// bài); trả null nếu còn lượt kế (đã đặt deadline mới + saveGame, caller vẽ lại
// bảng + hẹn timer). Đồng bộ tới lúc trả — không await.
function expireTurn(guildId: string, channelId: string, state: BlackjackState): Resolved | null {
  const turn = currentTurn(state);
  const seat = turn ? state.seats[turn] : undefined;
  if (seat && seat.status === "playing") seat.status = "stand";
  if (currentTurn(state) === null) return resolveTable(guildId, channelId, state);
  state.deadline = Date.now() + TURN_MS;
  saveGame(guildId, channelId, { game: GAME, state });
  return null;
}

// --- Chia bài mở ván ---

function deal(state: BlackjackState): void {
  state.deck = freshShoe();
  state.dealer = [draw(state), draw(state)];
  for (const id of state.order) {
    const seat = state.seats[id]!;
    seat.cards = [draw(state), draw(state)];
    seat.status = isBlackjack(seat.cards) ? "blackjack" : "playing";
  }
}

// --- Người chơi bot (AI fill) ---
// Bàn thiếu người thì xếp bot vào cho đủ. Bot là người chơi thật về mặt tiền:
// cược của bot được MINT vào bàn từ "quỹ nhà cái ảo" (faucet) và ledger của bot
// bị đốt sạch khi settle (sweepBots) — nhà cái ăn/chung thật với bot. Nước đi
// mở màn do Haiku quyết (decideBotOpenings), phần còn lại chơi theo chiến thuật
// cơ bản; mọi thứ có fallback tất định nên model chậm/lỗi không bao giờ treo ván.

// Chiến thuật cơ bản rút gọn: đủ tốt cho một con bot vui, không cần bảng tra đầy đủ.
function botBasicAction(cards: Card[], dealerUp: Card): "hit" | "stand" | "double" {
  const { total, soft } = handValue(cards);
  const up = VALUE[dealerUp.rank]; // A = 11
  if (cards.length === 2 && !soft && (total === 10 || total === 11) && total > up) return "double";
  if (soft) return total <= 17 ? "hit" : "stand"; // tay mềm: rút tới soft 17
  if (total <= 11) return "hit";
  if (total >= 17) return "stand";
  return up >= 7 ? "hit" : "stand"; // hard 12–16: nhà cái mạnh thì rút, yếu thì dừng
}

// Thêm MỘT ghế bot vào lobby (nút "Thêm bot"), trong hạn mức solvency của nhà cái
// (quỹ ≥ 2× tổng cược, gồm cả bot). Cược của bot mint vào committed (không trừ ví
// ai); ledger entry đánh dấu bot là bên settle thật. Trả về id bot vừa ngồi, hoặc
// null nếu đã đủ MAX_BOTS / nhà cái không ôm nổi thêm ghế. Không saveGame — caller lo.
function addBotSeat(state: BlackjackState): string | null {
  const botId = nextBotId(state.order.filter(isBotId));
  if (!botId || state.order.length >= MAX_SEATS) return null;
  const hostBalance = loadCoins()[state.host] ?? 0;
  const headroom = Math.floor(hostBalance / 2) - totalBuyin(state); // quỹ còn ôm được bao nhiêu cược nữa
  if (headroom < MIN_BUYIN) return null; // nhà cái hết quỹ để ôm thêm ghế
  const buyin = Math.min(headroom, MIN_BUYIN + Math.floor(Math.random() * 5) * 10); // 10–60, chặn theo headroom
  state.seats[botId] = { buyin, committed: buyin, cards: [], status: "playing" }; // buyin mint vào bàn
  state.order.push(botId);
  ensureBotLedger([botId]);
  return botId;
}

// Sau khi chia bài: cho mọi bot chơi hết tay của nó theo chiến thuật cơ bản —
// THUẦN TOÁN, không LLM (xì dách chỉ có hit/stand/double, model chẳng thêm gì mà
// còn làm đứng bàn). Đồng bộ, tức thì; chỉ mutate `state`, caller lo saveGame.
// Double của bot mint thêm committed, không trừ ví ai.
function playBots(state: BlackjackState): void {
  const botSeats = state.order.filter((id) => isBotId(id) && state.seats[id]?.status === "playing");
  if (botSeats.length === 0) return;
  const dealerUp = state.dealer[0]!;
  for (const id of botSeats) {
    const seat = state.seats[id]!;
    while (seat.status === "playing") {
      const act = botBasicAction(seat.cards, dealerUp);
      if (act === "double" && seat.cards.length === 2) {
        seat.committed += seat.buyin; // mint thêm cược, bot không trả từ ví
        seat.cards.push(draw(state));
        seat.status = handValue(seat.cards).total > 21 ? "bust" : "double";
      } else if (act === "hit") {
        seat.cards.push(draw(state));
        const { total } = handValue(seat.cards);
        if (total > 21) seat.status = "bust";
        else if (total === 21) seat.status = "stand";
      } else {
        seat.status = "stand";
      }
    }
  }
}

// --- Render ---

// Icon đứng đầu dòng mỗi tay + chữ mô tả trạng thái (tách riêng để lượt hiện tại
// override thành 👉 "đang đánh", tay chờ thành ⬜ "chờ lượt").
const STATUS_ICON: Record<HandStatus, string> = {
  playing: "🎴",
  stand: "✋",
  bust: "💥",
  blackjack: "✨",
  double: "⏫",
};
const STATUS_TEXT: Record<HandStatus, string> = {
  playing: "đang chơi",
  stand: "dừng",
  bust: "quắc",
  blackjack: "Blackjack!",
  double: "gấp đôi",
};

function cardsStr(cards: Card[]): string {
  return cards.map((c) => cardEmoji(c.rank, c.suit)).join(" ");
}

function handLabel(cards: Card[]): string {
  const { total, soft } = handValue(cards);
  if (total > 21) return `${total} 💥`;
  return soft ? `${total} (mềm)` : `${total}`;
}

// Luật đầy đủ — dùng cho nút "Luật" (ephemeral) và nhúng gọn vào bảng lobby.
function rulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📋 Luật Blackjack (xì dách)")
    .setDescription(
      [
        "🎯 **Mục tiêu:** điểm gần **21** nhất mà không vượt — hơn điểm nhà cái là thắng.",
        "🔢 **Điểm bài:** A = 1 hoặc 11 (tự chọn có lợi nhất) · J/Q/K = 10 · còn lại tính theo số.",
        "",
        "💰 **Tiền thưởng:**",
        "• ✨ **Blackjack** (2 lá đầu = 21) → trả **3:2**.",
        "• Thắng thường → trả **1:1**.",
        "• 🤝 Hoà (bằng điểm nhà cái) → hoàn cược.",
        "• 💥 **Quắc** (quá 21) → thua ngay, kể cả khi nhà cái cũng quắc.",
        "",
        "🎮 **Cách chơi:** đánh **lần lượt theo thứ tự vào bàn** — tới lượt bạn mới bấm được:",
        "• 🃏 **Rút thêm** — bốc 1 lá (đủ 21 thì tự dừng, quá 21 thì quắc).",
        "• ✋ **Dừng** — giữ điểm, kết thúc lượt.",
        "• ⏫ **Gấp đôi** — chỉ khi còn đúng 2 lá: cược thêm bằng cược gốc, rút **đúng 1 lá** rồi dừng.",
        "",
        "🎩 **Nhà cái:** lật bài úp sau cùng, **rút tới khi đạt 17** (dừng ở mọi 17, kể cả 17 mềm).",
      ].join("\n"),
    )
    .setColor(0x2ecc71);
}

// Bảng là MỘT tin Components V2 suốt vòng đời (lobby → chơi → kết quả). Discord
// KHÔNG cho sửa một tin thường thành V2 (và ngược lại) nên MỌI render của bảng
// phải là V2 ngay từ lúc mở lobby. Helper V2 (boardPayload/text/divider) dùng chung ở ../ui.

function renderLobby(state: BlackjackState, hostBankroll: number): ContainerBuilder {
  const seats = state.order.map((id, i) => `\`${i + 1}.\` ${mentionOrName(id)} — cược **${state.seats[id]!.buyin}** 🪙`);
  const body = [
    "## 🃏 Blackjack — nhà cái đang gọi bàn!",
    `🏦 Nhà cái: <@${state.host}> · quỹ **${hostBankroll}** 🪙 — bạn thắng nhà cái chung, bạn thua nhà cái ăn.`,
    "",
    seats.length > 0
      ? `**Người chơi (${seats.length}/${MAX_SEATS}) — đánh theo thứ tự này:**\n${seats.join("\n")}`
      : "*Chưa ai vào bàn — bấm Vào bàn đi bro!*",
    "",
    `Bấm **Vào bàn** để nhập tiền cược (tối thiểu ${MIN_BUYIN} 🪙). Đủ người thì chủ bàn bấm **Chia bài**.`,
    "",
    "📋 **Luật gọn:** gần 21 nhất mà không quá → thắng · Blackjack **3:2** · thắng thường **1:1** · hoà hoàn cược · chơi **theo lượt** — bấm **Luật** xem chi tiết.",
    `-# Tổng cược trên bàn: ${totalBuyin(state)} coin`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...lobbyRows());
}

export function renderPlaying(state: BlackjackState, hostBankroll: number): ContainerBuilder {
  const turn = currentTurn(state);
  const up = state.dealer[0]!;
  const upValue = handValue([up]).total; // A hiện 11
  const rows = state.order.map((id, i) => {
    const seat = state.seats[id]!;
    const isTurn = id === turn;
    const waiting = seat.status === "playing" && !isTurn;
    const icon = isTurn ? "👉" : waiting ? "⬜" : STATUS_ICON[seat.status];
    const label = isTurn ? "**đang đánh**" : waiting ? "chờ lượt" : STATUS_TEXT[seat.status];
    return `${icon} \`${i + 1}.\` ${mentionOrName(id)} — ${cardsStr(seat.cards)} → **${handLabel(seat.cards)}** · ${label} · cược ${seat.committed} 🪙`;
  });
  const header = [
    "## 🃏 Bàn Blackjack — đang chơi theo lượt",
    `🏦 Nhà cái <@${state.host}> (quỹ **${hostBankroll}** 🪙)`,
    `🎩 Bài nhà cái: ${cardsStr([up])} ${cardBack()} · lá ngửa **${upValue}** (lá úp giấu tới cuối)`,
  ].join("\n");
  // Dòng NGAY TRÊN hàng nút: hành động này dành cho ai (mention hiện đúng tên).
  const actionLine = turn
    ? `👉 **Hành động dành cho ${mentionOrName(turn)}** — chỉ ${mentionOrName(turn)} bấm được · còn <t:${Math.floor(state.deadline / 1000)}:R> để quyết.`
    : "🎩 Hết lượt — nhà cái đang lật bài...";
  return new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(text(header))
    .addTextDisplayComponents(text(rows.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(actionLine))
    .addActionRowComponents(...playingRows())
    .addTextDisplayComponents(
      text("-# 📋 BJ **3:2** · thắng **1:1** · hoà hoàn cược · 💥 quá 21 = quắc · cái rút tới 17 · ⏫ gấp đôi chỉ khi 2 lá · bấm **Luật** xem đầy đủ."),
    );
}

function renderSummary(resolved: Resolved): ContainerBuilder {
  const { state, results, hostDelta, fee, capped } = resolved;
  const rows = state.order.map((id) => {
    const seat = state.seats[id]!;
    const net = results[id]?.net ?? 0;
    const icon = net > 0 ? "🎉" : net < 0 ? "💸" : "🤝";
    const tail = net > 0 ? `**+${net}**` : net < 0 ? `**${net}**` : "hoà **+0**";
    const bj = seat.status === "blackjack" ? " ✨" : "";
    return `${icon} ${mentionOrName(id)} ${cardsStr(seat.cards)} → ${handLabel(seat.cards)}${bj} → ${tail} 🪙`;
  });
  const bankerLine =
    hostDelta >= 0
      ? `🏦 Nhà cái <@${state.host}> ăn **+${hostDelta}** 🪙`
      : `🏦 Nhà cái <@${state.host}> chung **${hostDelta}** 🪙`;
  const body = [
    "## 🃏 Kết quả Blackjack",
    `🎩 Nhà cái: ${cardsStr(state.dealer)} → **${handLabel(state.dealer)}**`,
    "",
    rows.join("\n"),
    "",
    bankerLine,
    ...(fee > 0 ? [`🔥 Phí nhà cái: **-${fee}** 🪙`] : []),
    ...(capped ? ["⚠️ Nhà cái không đủ quỹ — tiền thắng chia theo tỉ lệ."] : []),
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0x9b59b6)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(againRow(GAME, state.order.filter(isBotId).length));
}

function statusContainer(body: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## 🃏 Blackjack\n${body}`));
}

// --- Animation lật bài nhà cái ---

const REVEAL_MS = 800;
const DRAW_MS = 650;
type BoardEdit = (payload: ReturnType<typeof boardPayload>) => Promise<unknown>;

function dealerFrame(dealer: Card[], shown: number, title: string): ContainerBuilder {
  const cards = dealer.slice(0, shown);
  return new ContainerBuilder()
    .setAccentColor(0xfaa61a)
    .addTextDisplayComponents(text(`## ${title}\n🎩 ${cardsStr(cards)} → **${handLabel(cards)}**`));
}

// Coin đã settle xong trước khi vào đây — crash giữa chừng không mất gì.
async function animateResolve(edit: BoardEdit, resolved: Resolved): Promise<void> {
  const dealer = resolved.state.dealer;
  try {
    await edit(boardPayload(dealerFrame(dealer, 2, "🃏 Nhà cái lật bài...")));
    await sleep(REVEAL_MS);
    for (let shown = 3; shown <= dealer.length; shown++) {
      await edit(boardPayload(dealerFrame(dealer, shown, "🎴 Nhà cái rút thêm...")));
      await sleep(DRAW_MS);
    }
    await edit(boardPayload(renderSummary(resolved)));
  } catch (error) {
    console.error("[blackjack] animation failed:", error);
  }
}

// --- Nút ---

function lobbyRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("blackjack:join").setLabel("Vào bàn").setEmoji("🪙").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("blackjack:addbot").setLabel("Thêm bot").setEmoji("🤖").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("blackjack:start").setLabel("Chia bài").setEmoji("🎴").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("blackjack:rules").setLabel("Luật").setEmoji("📋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("blackjack:cancel").setLabel("Huỷ bàn").setStyle(ButtonStyle.Danger),
    ),
  ];
}

function playingRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("blackjack:hit").setLabel("Rút thêm").setEmoji("🃏").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("blackjack:stand").setLabel("Dừng").setEmoji("✋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("blackjack:double").setLabel("Gấp đôi").setEmoji("⏫").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("blackjack:rules").setLabel("Luật").setEmoji("📋").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// First edit acks the click (interaction.update strips buttons); further edits
// (animation frames) hit the board message directly. Same trick as bầu cua.
function editViaInteraction(interaction: ButtonInteraction): BoardEdit {
  let first = true;
  return async (options) => {
    if (first) {
      first = false;
      await interaction.update(options);
    } else {
      await interaction.message.edit(options);
    }
  };
}

function newLobby(hostId: string): BlackjackState {
  return { phase: "lobby", host: hostId, messageId: "", deadline: 0, deck: [], dealer: [], seats: {}, order: [] };
}

// Reserve the channel slot BEFORE the first await, post the board, then patch in
// the message id from a re-load (a join during the roundtrip already mutated the
// stored state). No stakes exist yet in a fresh lobby, so failure just frees the slot.
async function openLobby(
  guildId: string,
  channelId: string,
  hostId: string,
  send: (payload: ReturnType<typeof boardPayload>) => Promise<Message>,
  hostBankroll: number,
  initialBots = 0,
): Promise<void> {
  const state = newLobby(hostId);
  saveGame(guildId, channelId, { game: GAME, state });
  try {
    const message = await send(boardPayload(renderLobby(state, hostBankroll)));
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) {
      const liveState = live.state as BlackjackState;
      liveState.messageId = message.id;
      // Carry over the previous round's bots — seat up to initialBots, solvency-permitting.
      let seated = false;
      for (let i = 0; i < Math.min(initialBots, MAX_BOTS); i++) {
        if (!addBotSeat(liveState)) break;
        seated = true;
      }
      saveGame(guildId, channelId, { game: GAME, state: liveState });
      if (seated) {
        await message.edit(boardPayload(renderLobby(liveState, loadCoins()[hostId] ?? 0))).catch(() => {});
      }
    }
  } catch (error) {
    endGame(guildId, channelId);
    throw error;
  }
}

// Hẹn giờ cho LƯỢT hiện tại (TURN_MS + đệm). scheduleDeadline thay-thế theo key
// nên mỗi lượt mới tự huỷ timer lượt cũ. Hết giờ mà chưa bấm → expireTurn cho tự
// Dừng rồi nhảy lượt (hoặc lật bài nếu hết người), chỉnh sửa thẳng bảng.
function scheduleTurnTimeout(client: Client, guildId: string, channelId: string): void {
  scheduleDeadline(`${guildId}:${channelId}`, TURN_MS + 1000, async () => {
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) return;
    const state = stored.state as BlackjackState;
    if (state.phase !== "playing") return;
    if (Date.now() <= state.deadline) return; // một lượt mới đã hẹn lại — bỏ qua timer cũ
    try {
      const resolved = expireTurn(guildId, channelId, state);
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      if (resolved) {
        if (message) await animateResolve((options) => message.edit(options), resolved);
      } else {
        scheduleTurnTimeout(client, guildId, channelId); // hẹn tiếp cho người kế
        const hostBankroll = loadCoins()[state.host] ?? 0;
        if (message) await message.edit(boardPayload(renderPlaying(state, hostBankroll)));
      }
    } catch (error) {
      console.error(`[blackjack] turn timeout failed in ${channelId}:`, error);
    }
  });
}

// Sau khi một tay mutate + save: hết người còn chơi → nhà cái lật bài + settle;
// còn lượt kế → đặt deadline lượt mới, hẹn timer, vẽ lại bảng. Đồng bộ (đặt
// deadline + saveGame) trước await để bất biến tiền/state không vỡ khi crash.
async function progress(
  interaction: ButtonInteraction,
  guildId: string,
  channelId: string,
  state: BlackjackState,
): Promise<void> {
  if (currentTurn(state) === null) {
    const resolved = resolveTable(guildId, channelId, state);
    await animateResolve(editViaInteraction(interaction), resolved);
  } else {
    state.deadline = Date.now() + TURN_MS;
    saveGame(guildId, channelId, { game: GAME, state });
    scheduleTurnTimeout(interaction.client, guildId, channelId);
    const hostBankroll = loadCoins()[state.host] ?? 0;
    await interaction.update(boardPayload(renderPlaying(state, hostBankroll)));
  }
}

const blackjack: Command = {
  data: new SlashCommandBuilder()
    .setName(GAME)
    .setDescription("Mở bàn xì dách — chủ bàn làm nhà cái, nhiều người vào cược"),

  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    const existing = loadGame(guildId, channelId);
    if (existing) {
      await interaction.reply({
        content:
          existing.game === GAME
            ? "Kênh này đang có bàn blackjack rồi — bấm nút trên bảng đi bro."
            : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const hostBankroll = loadCoins()[interaction.user.id] ?? 0;
    await openLobby(
      guildId,
      channelId,
      interaction.user.id,
      async (payload) => {
        await interaction.reply(payload);
        return interaction.fetchReply();
      },
      hostBankroll,
    );
  },

  // Idle sweeper: lobby ế → hoàn cược; đang chơi im ắng → nhà cái lật bài, settle.
  async handleExpiredGame(client, guildId, channelId, stored) {
    const state = stored.state as BlackjackState;
    cancelDeadline(`${guildId}:${channelId}`);
    let container: ContainerBuilder;
    if (state.phase === "lobby") {
      refundLobby(state);
      endGame(guildId, channelId);
      sweepBots(); // bot có thể đã được thêm vào lobby qua nút — đốt ledger residual của nó
      container = statusContainer("⌛ Ế quá lâu không ai vào bàn — huỷ bàn, coin cược đã hoàn lại đầy đủ.");
    } else {
      container = renderSummary(resolveTable(guildId, channelId, state)); // đã kèm nút Ván mới
    }
    try {
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      await message?.edit(boardPayload(container));
    } catch (error) {
      console.error(`[blackjack] expire edit failed in ${channelId}:`, error);
    }
  },

  async handleButton(interaction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const [, action, arg] = interaction.customId.split(":");

    if (action === "again") {
      const existing = loadGame(guildId, channelId);
      if (existing) {
        await interaction.reply({
          content: "Kênh này đang có ván rồi bro — chơi cho xong đã nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const botCount = Math.min(MAX_BOTS, Math.max(0, Number(arg) || 0)); // carried from the settled round
      await interaction.update(boardPayload(statusContainer("🔄 Ván mới đã mở bên dưới 👇"))); // gỡ nút Ván mới khỏi bảng cũ
      const hostBankroll = loadCoins()[userId] ?? 0;
      await openLobby(guildId, channelId, userId, (payload) => interaction.followUp(payload), hostBankroll, botCount);
      return;
    }

    // Luật — không đụng state, xem được cả khi bàn đã tàn.
    if (action === "rules") {
      await interaction.reply({ embeds: [rulesEmbed()], flags: MessageFlags.Ephemeral });
      return;
    }

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({
        content: "Bàn này kết thúc rồi bro — mở bàn mới bằng `/blackjack` nhé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const state = stored.state as BlackjackState;

    if (action === "join") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Đã chia bài rồi, không vào bàn được nữa bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (userId === state.host) {
        await interaction.reply({ content: "Bro là nhà cái ván này — nhà cái ăn/chung chứ không tự chơi nhé 🎩", flags: MessageFlags.Ephemeral });
        return;
      }
      if (state.seats[userId]) {
        await interaction.reply({ content: "Bro vào bàn rồi mà 😄", flags: MessageFlags.Ephemeral });
        return;
      }
      if (state.order.length >= MAX_SEATS) {
        await interaction.reply({ content: `Bàn đầy ${MAX_SEATS} người rồi bro — chờ ván sau nhé.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const balance = loadCoins()[userId] ?? 0;
      if (balance < MIN_BUYIN) {
        await interaction.reply({
          content: `Không đủ coin rồi bro — cần tối thiểu ${MIN_BUYIN} 🪙 để vào bàn, số dư: ${balance}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId("blackjack:buyin")
        .setTitle("Vào bàn Blackjack")
        .addLabelComponents(
          new LabelBuilder()
            .setLabel(`Tiền cược (tối thiểu ${MIN_BUYIN}, số dư ${balance})`.slice(0, 45))
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("tiencuoc")
                .setPlaceholder("VD: 100")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(9),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    if (action === "addbot") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Đã chia bài rồi, không thêm bot được nữa bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const botId = addBotSeat(state);
      if (!botId) {
        const full = state.order.filter(isBotId).length >= MAX_BOTS;
        await interaction.reply({
          content: full
            ? `Đủ ${MAX_BOTS} bot rồi bro 🤖`
            : "🏦 Quỹ nhà cái chưa đủ để ôm thêm bot vào bàn bro — nạp thêm quỹ nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      saveGame(guildId, channelId, { game: GAME, state });
      const hostBankroll = loadCoins()[state.host] ?? 0;
      await interaction.update(boardPayload(renderLobby(state, hostBankroll)));
      return;
    }

    if (action === "cancel") {
      if (interaction.user.id !== state.host) {
        await interaction.reply({ content: `Chỉ chủ bàn <@${state.host}> huỷ được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Đã chia bài rồi, không huỷ được — chơi cho xong ván nhé bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      refundLobby(state);
      endGame(guildId, channelId);
      sweepBots(); // bot có thể đã được thêm vào lobby qua nút — đốt ledger residual của nó
      await interaction.update(boardPayload(statusContainer("❌ Chủ bàn đã huỷ — coin cược đã hoàn lại đầy đủ.")));
      return;
    }

    if (action === "start") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Đã chia bài rồi bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (interaction.user.id !== state.host) {
        await interaction.reply({ content: `Chỉ chủ bàn <@${state.host}> chia bài được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (state.order.length === 0) {
        await interaction.reply({
          content: "Chưa ai vào bàn mà chia gì bro 😅 — bấm **Thêm bot** nếu muốn chơi với bot nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      state.phase = "playing";
      deal(state);
      playBots(state); // bot chơi hết tay của nó ngay (thuần toán, tức thì) → lượt chỉ dừng ở người thật
      saveGame(guildId, channelId, { game: GAME, state });
      // progress lo cả hai: hết người còn chơi (kể cả bàn toàn bot) → lật bài settle;
      // còn lượt → đặt deadline lượt đầu + hẹn timer + hiện bảng cho người tới lượt.
      await progress(interaction, guildId, channelId, state);
      return;
    }

    // hit / stand / double — CHỈ người tới lượt bấm được (chơi theo lượt)
    if (action === "hit" || action === "stand" || action === "double") {
      if (state.phase !== "playing") {
        await interaction.reply({ content: "Chưa chia bài mà bro — chờ chủ bàn nhé.", flags: MessageFlags.Ephemeral });
        return;
      }
      // Lượt hiện tại hết giờ (kể cả timer mất do restart) → cho người đó tự Dừng,
      // nhảy lượt (hoặc lật bài nếu hết người). Bất kỳ ai bấm cũng gỡ kẹt được;
      // người bấm cứ bấm lại khi tới lượt mình.
      if (Date.now() > state.deadline) {
        const resolved = expireTurn(guildId, channelId, state);
        if (resolved) {
          await animateResolve(editViaInteraction(interaction), resolved);
        } else {
          scheduleTurnTimeout(interaction.client, guildId, channelId);
          const hostBankroll = loadCoins()[state.host] ?? 0;
          await interaction.update(boardPayload(renderPlaying(state, hostBankroll)));
        }
        return;
      }
      const seat = state.seats[userId];
      if (!seat) {
        await interaction.reply({ content: "Bro không ở trong bàn này — chờ ván sau vào nhé.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (seat.status !== "playing") {
        await interaction.reply({ content: "Tay của bro chốt rồi — chờ mọi người xong nhé 😎", flags: MessageFlags.Ephemeral });
        return;
      }
      // Chưa tới lượt: tay của bro vẫn đang chờ nhưng người khác đang đánh.
      const turn = currentTurn(state);
      if (turn !== userId) {
        await interaction.reply({
          content: turn ? `Chưa tới lượt bro — đang chờ ${mentionOrName(turn)} đánh xong đã 🎴` : "Chưa tới lượt bro 🎴",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (action === "hit") {
        seat.cards.push(draw(state));
        const { total } = handValue(seat.cards);
        if (total > 21) seat.status = "bust";
        else if (total === 21) seat.status = "stand"; // 21 rồi thì chốt luôn cho gọn
      } else if (action === "stand") {
        seat.status = "stand";
      } else {
        // double: chỉ khi còn đúng 2 lá, đủ coin cược thêm bằng cược gốc
        if (seat.cards.length !== 2) {
          await interaction.reply({ content: "Chỉ gấp đôi khi đang có đúng 2 lá thôi bro.", flags: MessageFlags.Ephemeral });
          return;
        }
        const coins = loadCoins();
        const balance = coins[userId] ?? 0;
        if (balance < seat.buyin) {
          await interaction.reply({
            content: `Không đủ coin để gấp đôi bro — cần thêm ${seat.buyin} 🪙, số dư: ${balance}.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        coins[userId] = balance - seat.buyin; // trừ đồng bộ, giống mọi coin move
        saveCoins(coins);
        seat.committed += seat.buyin;
        seat.cards.push(draw(state));
        seat.status = handValue(seat.cards).total > 21 ? "bust" : "double";
      }

      saveGame(guildId, channelId, { game: GAME, state });
      await progress(interaction, guildId, channelId, state);
    }
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    // blackjack:buyin
    if (!interaction.inGuild()) return;
    const [, action] = interaction.customId.split(":");
    if (action !== "buyin") return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId!;
    const userId = interaction.user.id;

    const raw = interaction.fields.getTextInputValue("tiencuoc").trim();
    if (!/^\d+$/.test(raw) || Number(raw) < MIN_BUYIN) {
      await interaction.reply({
        content: `"${raw}" không hợp lệ bro — nhập số nguyên ≥ ${MIN_BUYIN} nhé (VD: 100).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const amount = Number(raw);

    // Load → validate → mutate → save, không await xen giữa: atomic trên event loop.
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({ content: "Bàn này kết thúc rồi bro — tiền chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    const state = stored.state as BlackjackState;
    if (state.phase !== "lobby") {
      await interaction.reply({ content: "Đã chia bài rồi, không vào bàn được nữa bro — tiền chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (userId === state.host) {
      await interaction.reply({ content: "Bro là nhà cái ván này, không tự chơi được nhé.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.seats[userId]) {
      await interaction.reply({ content: "Bro vào bàn rồi mà 😄 — tiền chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.order.length >= MAX_SEATS) {
      await interaction.reply({ content: `Bàn đầy ${MAX_SEATS} người rồi bro.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const coins = loadCoins();
    const balance = coins[userId] ?? 0;
    if (balance < amount) {
      await interaction.reply({ content: `Không đủ coin bro — cược ${amount} 🪙 mà số dư chỉ ${balance}.`, flags: MessageFlags.Ephemeral });
      return;
    }
    // Chặn solvency nhà cái: quỹ nhà cái phải ≥ 2× tổng cược (ôm được cả khi mọi
    // người gấp đôi rồi thắng). Bảo đảm "nhà cái luôn đủ quỹ khi chốt bàn".
    const hostBalance = coins[state.host] ?? 0;
    const newTotal = totalBuyin(state) + amount;
    if (hostBalance < newTotal * 2) {
      await interaction.reply({
        content: `🏦 Nhà cái không ôm nổi mức này bro — quỹ nhà cái đang **${hostBalance}** 🪙, mà để chắc chung đủ thì cần ôm tới **${newTotal * 2}** 🪙 (2× tổng cược). Vào cược nhỏ hơn, hoặc chờ nhà cái nạp quỹ nhé.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    coins[userId] = balance - amount;
    saveCoins(coins);
    state.seats[userId] = { buyin: amount, committed: amount, cards: [], status: "playing" };
    state.order.push(userId);
    saveGame(guildId, channelId, { game: GAME, state });

    // Cập nhật bảng lobby công khai + ack riêng cho người vừa vào.
    await interaction.reply({ content: `✅ Đã vào bàn với **${amount}** 🪙 — chờ chủ bàn chia bài nhé!`, flags: MessageFlags.Ephemeral });
    const message = await fetchBoardMessage(interaction.client, channelId, state.messageId).catch(() => null);
    await message?.edit(boardPayload(renderLobby(state, hostBalance))).catch(() => {});
  },
};

// Hoàn cược cho mọi ghế khi huỷ/ế ở lobby. Ghost guard: bỏ qua người đã rời server.
function refundLobby(state: BlackjackState): void {
  const coins = loadCoins();
  for (const id of state.order) {
    const seat = state.seats[id];
    if (seat && id in coins) coins[id] = coins[id]! + seat.committed;
  }
  saveCoins(coins);
}

export default blackjack;
