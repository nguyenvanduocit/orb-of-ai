// /roulette — vòng quay roulette châu Âu (một số 0 xanh), chủ ván làm nhà cái
// (host-as-banker). Một người mở ván = nhà cái, người khác đặt cửa; thắng thì
// nhà cái chung, thua thì nhà cái ăn — coin luân chuyển chứ không mint/burn,
// đúng mô hình bầu cua/đua thú/blackjack (bankerSettle trong games.ts).
//
// Edge nhà cái = ô 0 xanh: khi bóng dừng ở 0, MỌI cửa ngoài (đỏ/đen, chẵn/lẻ,
// 1–18/19–36, tá, cột) đều thua, chỉ cửa đặt thẳng số 0 mới thắng. Với 37 ô,
// mọi cửa đều gánh đúng 1/37 ≈ 2.70% lợi thế cho nhà cái — đó là phần của cái.
//
// Vì roulette có 37 số + 12 cửa ngoài, không nhét hết vào nút được: cửa ngoài
// là nút (BET_STEP 🪙/lần bấm), đặt thẳng số 0–36 qua modal (tiền tuỳ ý). Cùng
// một kênh/một ván, lưu tại data/guild_<id>/games/<channelId>.json — an toàn qua
// restart bằng deadline persisted + resolve lười + sweeper dọn ván ế.
//
// Bất biến tiền: coin trừ NGAY khi đặt (đồng bộ load→mutate→save), settle cũng
// đồng bộ trước khi chạy animation quay — crash giữa màn diễn không mất coin.
// Nhà cái luôn đủ quỹ: mỗi lần đặt bị chặn nếu ô đắt nhất trong 37 kết quả có
// thể vượt quá quỹ nhà cái + tổng cược (rouletteMaxLiability); capping của
// bankerSettle chỉ là lưới đỡ khi quỹ tụt giữa chừng.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
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
import { againRow, BET_STEP, fetchBoardMessage, settleBankerPayout, type Outcome } from "../games";
import { ensureBotLedger, isBotId, MAX_BOTS, mentionOrName, nextBotId, sweepBots } from "../bots";
import { loadCoins, saveCoins } from "../economy";
import { endGame, loadGame, saveGame, type StoredGame } from "../guilds";
import { boardPayload, divider, text } from "../ui";
import { cancelDeadline, scheduleDeadline, sleep } from "../scheduler";
import type { Command } from "../types";

// Single source of truth for the persisted game tag AND the slash command name —
// the sweeper resolves teardown via commands.get(stored.game).
const GAME = "roulette";
export const BETTING_MS = 60_000;

// AI-bot cược: người chơi tự bấm nút "🤖 Thêm bot" trên bàn để thêm một con (tối
// đa MAX_BOTS). Cược của bot được mint thẳng vào pot từ faucet, ledger residual bị
// sweepBots đốt lúc chốt — nhà cái ăn/chung coin thật với nó (chủ ván lẻ loi vẫn có
// kèo). Xem addRouletteBot ở dưới.

// --- Bàn cược & luật (pure core) ---

// Roulette châu Âu: 1 số 0 xanh + 1–36 chia đỏ/đen. Bảng đỏ chuẩn:
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Thứ tự ô trên vòng quay thật (pocket order) — để animation quay trông như bánh
// xe đang lăn qua từng ô rồi chậm dần chứ không phải số nhảy lung tung.
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

// Nhãn ngắn cho cửa ngoài (dùng khi liệt kê cược). Cửa đặt thẳng số dùng key "s<0..36>".
export const OUTSIDE: Record<string, string> = {
  red: "🔴Đỏ",
  black: "⚫Đen",
  even: "Chẵn",
  odd: "Lẻ",
  low: "1–18",
  high: "19–36",
  d1: "Tá1",
  d2: "Tá2",
  d3: "Tá3",
  c1: "Cột1",
  c2: "Cột2",
  c3: "Cột3",
};

// Nhãn nút bấm — kèm luôn tỉ lệ trả để người chơi thấy kèo ngay trên nút.
const BTN_LABEL: Record<string, string> = {
  red: "🔴 Đỏ 2×",
  black: "⚫ Đen 2×",
  even: "Chẵn 2×",
  odd: "Lẻ 2×",
  low: "1–18 · 2×",
  high: "19–36 · 2×",
  d1: "1–12 · 3×",
  d2: "13–24 · 3×",
  d3: "25–36 · 3×",
  c1: "Cột 1 · 3×",
  c2: "Cột 2 · 3×",
  c3: "Cột 3 · 3×",
};

// Bội số TRẢ VỀ (cược + thắng): cửa ngoài chẵn tiền 2×, tá/cột 3×, đặt thẳng 36×.
export function multiplierOf(key: string): number {
  if (key.startsWith("s")) return 36;
  return key === "d1" || key === "d2" || key === "d3" || key === "c1" || key === "c2" || key === "c3" ? 3 : 2;
}

// Những cửa THẮNG khi bóng dừng ở số n (0–36). Ở n=0 chỉ cửa "s0" thắng — mọi
// cửa ngoài thua, đó chính là edge của nhà cái.
function winningKeys(n: number): Set<string> {
  const keys = new Set<string>([`s${n}`]);
  if (n === 0) return keys;
  keys.add(RED.has(n) ? "red" : "black");
  keys.add(n % 2 === 0 ? "even" : "odd");
  keys.add(n <= 18 ? "low" : "high");
  keys.add(n <= 12 ? "d1" : n <= 24 ? "d2" : "d3");
  keys.add(n % 3 === 1 ? "c1" : n % 3 === 2 ? "c2" : "c3");
  return keys;
}

type Bets = Record<string, Record<string, number>>; // userId → betKey → tổng coin đã đặt

// Pure core: settle mọi cửa so với số n. Cược đã trừ khi đặt, nên `credit` là
// tiền trả lại (cược + thắng), `net` là lời/lỗ để hiển thị.
export function settleRoulette(bets: Bets, n: number): Outcome["results"] {
  const winners = winningKeys(n);
  const results: Outcome["results"] = {};
  for (const [userId, userBets] of Object.entries(bets)) {
    let credit = 0;
    let stake = 0;
    for (const [key, amount] of Object.entries(userBets)) {
      stake += amount;
      if (winners.has(key)) credit += amount * multiplierOf(key);
    }
    results[userId] = { credit, net: credit - stake };
  }
  return results;
}

// Worst-case tiền nhà cái phải chung qua CẢ 37 kết quả, cho trước tổng cược mỗi
// cửa. Chính xác (không ước lượng): thử từng số, cộng payout các cửa thắng, lấy
// max. Engine chặn cược nào khiến kết quả đắt nhất vượt quỹ nhà cái + tổng cược,
// nên nhà cái luôn đủ tiền chung lúc chốt cược.
export function rouletteMaxLiability(totals: Record<string, number>): number {
  let worst = 0;
  for (let n = 0; n <= 36; n++) {
    const winners = winningKeys(n);
    let payout = 0;
    for (const [key, amount] of Object.entries(totals)) {
      if (winners.has(key)) payout += amount * multiplierOf(key);
    }
    if (payout > worst) worst = payout;
  }
  return worst;
}

function potOf(bets: Bets): number {
  let sum = 0;
  for (const userBets of Object.values(bets)) for (const amount of Object.values(userBets)) sum += amount;
  return sum;
}

// Tổng cược gộp theo cửa — đủ để định giá rủi ro của nhà cái (rouletteMaxLiability).
function keyTotals(bets: Bets): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const userBets of Object.values(bets)) {
    for (const [key, amount] of Object.entries(userBets)) totals[key] = (totals[key] ?? 0) + amount;
  }
  return totals;
}

// Các cửa NGOÀI trúng cho số n — để màn kết quả nói rõ "vì sao trúng". Rỗng ở n=0.
function winningCategories(n: number): string[] {
  if (n === 0) return [];
  return [
    RED.has(n) ? "🔴 Đỏ" : "⚫ Đen",
    n % 2 === 0 ? "Chẵn" : "Lẻ",
    n <= 18 ? "1–18" : "19–36",
    n <= 12 ? "Tá 1" : n <= 24 ? "Tá 2" : "Tá 3",
    n % 3 === 1 ? "Cột 1" : n % 3 === 2 ? "Cột 2" : "Cột 3",
  ];
}

// --- State ---

interface RouletteState {
  host: string;
  deadline: number; // epoch ms — chốt cược; persisted nên restart không đóng băng ván
  messageId: string;
  bets: Bets;
}

interface RouletteOutcome extends Outcome {
  n: number; // số thắng
  pot: number;
}

// --- Màu số & render ---

function colorOf(n: number): { emoji: string; name: string; color: number } {
  if (n === 0) return { emoji: "🟢", name: "Xanh", color: 0x2ecc71 };
  return RED.has(n) ? { emoji: "🔴", name: "Đỏ", color: 0xed4245 } : { emoji: "⚫", name: "Đen", color: 0x23272a };
}

function betLabel(key: string): string {
  return key.startsWith("s") ? `🎯${key.slice(1)}` : (OUTSIDE[key] ?? key);
}

// Bảng là MỘT tin Components V2 suốt vòng đời (betting → animation → kết quả).
// Discord KHÔNG cho sửa tin thường thành V2 (và ngược lại) nên MỌI render của
// bảng phải là ContainerBuilder ngay từ lúc mở ván. Helper V2
// (boardPayload/text/divider) dùng chung ở ../ui. Buttons nằm TRONG container.

function renderBoard(state: RouletteState, hostBankroll: number): ContainerBuilder {
  const betLines = Object.entries(state.bets).map(([userId, userBets]) => {
    const parts = Object.entries(userBets).map(([key, amount]) => `${betLabel(key)} **${amount}**`);
    return `${mentionOrName(userId)}: ${parts.join(" · ")}`;
  });
  const betValue = betLines.length > 0 ? betLines.join("\n") : "*Chưa ai đặt cửa — làm phát đi bro!* 🍀";
  const body = [
    "## 🎡 Roulette — mời đặt cửa!",
    `🎲 Bấm nút để đặt cửa (**${BET_STEP}** 🪙/lần) hoặc 🎯 **Đặt số** để chơi thẳng một số.`,
    `⏳ Chốt cược <t:${Math.floor(state.deadline / 1000)}:R> — chủ ván có thể bấm **Quay!** để quay sớm.`,
    "",
    "**💸 Tiền thắng (đã gồm vốn)**",
    "🔴 Đỏ · ⚫ Đen · Chẵn · Lẻ · 1–18 · 19–36 → **2×**\n🔢 Tá (12 số liền) · Cột (hàng dọc) → **3×**\n🎯 Đặt thẳng số 0–36 → **36×** 💥",
    "",
    `**🏦 Nhà cái:** <@${state.host}> · quỹ **${hostBankroll}** 🪙 · Bạn thắng cái chung, bạn thua cái ăn. | **🎰 Tổng cược:** **${potOf(state.bets)}** 🪙`,
    "",
    "**📋 Cược hiện tại**",
    betValue.length > 1000 ? `${betValue.slice(0, 1000)}…` : betValue,
    "-# Số 0 xanh là phần của nhà cái 🍀",
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...boardRows());
}

function renderResult(outcome: RouletteOutcome, bots: number): ContainerBuilder {
  const { n, results, host, pot } = outcome;
  const { emoji, name, color } = colorOf(n);
  const headline =
    n === 0
      ? "## 🟢 0\n**Số 0 xanh — nhà cái ăn trọn mọi cửa ngoài! 😈**"
      : `## ${emoji} ${n} — ${name}\n**Cửa trúng:** ${winningCategories(n).join(" · ")}`;
  const lines = Object.entries(results)
    .sort(([, a], [, b]) => b.net - a.net)
    .map(([userId, { net }]) =>
      net > 0
        ? `🎉 ${mentionOrName(userId)}: **+${net}** 🪙`
        : net < 0
          ? `💸 ${mentionOrName(userId)}: **${net}** 🪙`
          : `🤝 ${mentionOrName(userId)}: hoà`,
    );
  const bankerLines = host
    ? [
        "",
        host.delta >= 0
          ? `🏦 Nhà cái <@${host.id}> ăn **+${host.delta}** 🪙`
          : `🏦 Nhà cái <@${host.id}> chung **${host.delta}** 🪙`,
        ...(host.fee > 0 ? [`🔥 Phí nhà cái: **-${host.fee}** 🪙`] : []),
        ...(host.capped ? ["⚠️ Nhà cái không đủ quỹ — tiền thắng chia theo tỉ lệ."] : []),
      ]
    : [];
  const body = [headline, "", ...lines, ...bankerLines, `-# Tổng cược: ${pot} coin`].join("\n");
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(againRow(GAME, bots));
}

function statusContainer(description: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## 🎡 Roulette\n${description}`));
}

// --- Animation vòng quay (ANSI code block: một dải ô của bánh xe trượt dưới kim
// chỉ, chậm dần rồi dừng đúng ô n). Coin đã settle xong trước khi vào đây —
// crash giữa chừng không mất gì. ---

const ESC = "\x1b";
// Khoảng cách (số ô) từ ô hiện tại tới ô đích ở mỗi frame — giảm dần = chậm dần,
// frame cuối = 0 → dừng đúng số. Delay tăng dần cho cảm giác "rớt" vào ô.
const SPIN_OFFSETS = [46, 33, 23, 15, 9, 5, 2, 0];
const SPIN_DELAYS = [300, 330, 380, 450, 540, 660, 800, 950];

// fg ANSI theo màu ô: 0 xanh (32), đỏ (31), đen → trắng (37) cho dễ đọc.
function ansiFg(n: number): number {
  return n === 0 ? 32 : RED.has(n) ? 31 : 37;
}

function pocket(n: number, center: boolean): string {
  const s = String(n).padStart(2, " ");
  const c = ansiFg(n);
  return center ? `${ESC}[1;4;${c}m[${s}]${ESC}[0m` : `${ESC}[0;${c}m ${s} ${ESC}[0m`;
}

function wheelStrip(centerIdx: number): string {
  const cells: string[] = [];
  for (let d = -2; d <= 2; d++) cells.push(pocket(WHEEL[(((centerIdx + d) % 37) + 37) % 37]!, d === 0));
  return "```ansi\n" + " ".repeat(9) + "▼\n" + cells.join("") + "\n```";
}

type Edit = (payload: ReturnType<typeof boardPayload>) => Promise<unknown>;

function spinFrame(n: number, off: number, landed: boolean): ContainerBuilder {
  const idx = WHEEL.indexOf(n);
  const centerIdx = (((idx - off) % 37) + 37) % 37;
  const { emoji, name, color } = colorOf(n);
  const title = landed ? `## 🎡 Bóng dừng ở ${emoji} ${n} — ${name}!` : "## 🎡 Vòng quay đang lăn...";
  return new ContainerBuilder()
    .setAccentColor(landed ? color : 0x5865f2)
    .addTextDisplayComponents(text(`${title}\n${wheelStrip(centerIdx)}`));
}

async function playAnimation(edit: Edit, outcome: RouletteOutcome): Promise<void> {
  const bots = Object.keys(outcome.results).filter(isBotId).length;
  try {
    for (let i = 0; i < SPIN_OFFSETS.length; i++) {
      const isLast = i === SPIN_OFFSETS.length - 1;
      await edit(boardPayload(spinFrame(outcome.n, SPIN_OFFSETS[i]!, isLast)));
      await sleep(SPIN_DELAYS[i] ?? 950);
    }
    await sleep(350); // beat trên ô thắng trước khi công bố kết quả
    await edit(boardPayload(renderResult(outcome, bots)));
  } catch (error) {
    console.error("[roulette] animation failed:", error);
  }
}

// --- Nút bàn cược ---

function boardRows(): ActionRowBuilder<ButtonBuilder>[] {
  const btn = (key: string, style: ButtonStyle): ButtonBuilder =>
    new ButtonBuilder().setCustomId(`${GAME}:bet:${key}`).setLabel(BTN_LABEL[key]!).setStyle(style);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("red", ButtonStyle.Danger),
      btn("black", ButtonStyle.Secondary),
      btn("even", ButtonStyle.Secondary),
      btn("odd", ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${GAME}:number`).setLabel("Đặt số 36×").setEmoji("🎯").setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(btn("low", ButtonStyle.Secondary), btn("high", ButtonStyle.Secondary)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(btn("d1", ButtonStyle.Secondary), btn("d2", ButtonStyle.Secondary), btn("d3", ButtonStyle.Secondary)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(btn("c1", ButtonStyle.Secondary), btn("c2", ButtonStyle.Secondary), btn("c3", ButtonStyle.Secondary)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${GAME}:spin`).setLabel("Quay!").setEmoji("🎡").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${GAME}:addbot`).setLabel("Thêm bot").setEmoji("🤖").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${GAME}:cancel`).setLabel("Huỷ ván").setStyle(ButtonStyle.Danger),
    ),
  ];
}

// First edit acks the click (interaction.update strips buttons); further edits
// (animation frames) hit the board message directly. Same trick as bầu cua.
function editViaInteraction(interaction: ButtonInteraction): Edit {
  let first = true;
  return async (payload) => {
    if (first) {
      first = false;
      await interaction.update(payload);
    } else {
      await interaction.message.edit(payload);
    }
  };
}

// --- Coin moves & settle (đồng bộ, không await tới lúc endGame) ---

// Ghost guard: bỏ qua người đã rời server (ledger đã xoá) — không hồi sinh số dư.
function refundAll(state: RouletteState): void {
  const coins = loadCoins();
  for (const [userId, userBets] of Object.entries(state.bets)) {
    const total = Object.values(userBets).reduce((sum, amount) => sum + amount, 0);
    if (total > 0 && userId in coins) coins[userId] = coins[userId]! + total;
  }
  saveCoins(coins);
}

// Đồng bộ hoàn toàn: quay → settle → endGame, không await xen giữa, nên timer/nút
// đua nhau cũng không settle trùng một ván.
function settle(guildId: string, channelId: string, state: RouletteState): RouletteOutcome {
  cancelDeadline(`${guildId}:${channelId}`);
  const n = Math.floor(Math.random() * 37);
  const results = settleRoulette(state.bets, n);
  const { delta, fee, capped } = settleBankerPayout(state.host, results);
  endGame(guildId, channelId);
  sweepBots(); // đốt residual ledger của bot — GC của faucet (no-op nếu không có bot)
  return { n, pot: potOf(state.bets), results, host: { id: state.host, delta, fee, capped } };
}

function scheduleAutoResolve(client: Client, guildId: string, channelId: string, delayMs: number): void {
  scheduleDeadline(`${guildId}:${channelId}`, delayMs, async () => {
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) return;
    const state = stored.state as RouletteState;
    try {
      if (Object.keys(state.bets).length === 0) {
        endGame(guildId, channelId);
        sweepBots();
        const message = await fetchBoardMessage(client, channelId, state.messageId);
        await message?.edit(boardPayload(statusContainer("⌛ Hết giờ mà không ai cược — huỷ ván nhé bro.")));
        return;
      }
      const outcome = settle(guildId, channelId, state);
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      if (message) await playAnimation((payload) => message.edit(payload), outcome);
    } catch (error) {
      console.error(`[roulette] auto-resolve failed in ${channelId}:`, error);
    }
  });
}

// Shared round opener — the slash `execute` and the "Ván mới" button both call it.
// `send` posts the board (reply+fetchReply for a slash, followUp for a button);
// `initialBots` pre-seats that many bot bettors (the previous round's count, carried
// by the again button) as instant heuristic bets.
async function startRound(
  client: Client,
  guildId: string,
  channelId: string,
  hostId: string,
  send: (payload: ReturnType<typeof boardPayload>) => Promise<Message>,
  initialBots: number,
): Promise<void> {
  const state: RouletteState = { host: hostId, deadline: Date.now() + BETTING_MS, messageId: "", bets: {} };
  // Reserve the channel slot BEFORE the first await — hai lệnh cùng lúc không được cùng vượt qua check tồn tại.
  saveGame(guildId, channelId, { game: GAME, state });
  try {
    const message = await send(boardPayload(renderBoard(state, loadCoins()[hostId] ?? 0)));
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) {
      const liveState = live.state as RouletteState;
      liveState.messageId = message.id;
      saveGame(guildId, channelId, { game: GAME, state: liveState });
    }
    // Carry over the previous round's bots — instant heuristic bets, solvency-gated.
    let seated = false;
    for (let i = 0; i < Math.min(initialBots, MAX_BOTS); i++) {
      const current = loadGame(guildId, channelId);
      if (!current || current.game !== GAME) break;
      const botId = nextBotId(Object.keys((current.state as RouletteState).bets).filter(isBotId));
      if (!botId || !addRouletteBot(guildId, channelId, botId)) break;
      seated = true;
    }
    if (seated) {
      const after = loadGame(guildId, channelId);
      if (after?.game === GAME) {
        const s = after.state as RouletteState;
        await message.edit(boardPayload(renderBoard(s, loadCoins()[s.host] ?? 0)));
      }
    }
  } catch (error) {
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) refundAll(live.state as RouletteState);
    endGame(guildId, channelId);
    sweepBots();
    throw error;
  }
  scheduleAutoResolve(client, guildId, channelId, BETTING_MS + 1000);
}

const roulette: Command = {
  data: new SlashCommandBuilder()
    .setName(GAME)
    .setDescription("Mở ván Roulette — cược cửa, chủ ván làm nhà cái ôm kèo"),

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
            ? "Kênh này đang có ván roulette rồi — đặt cửa hoặc bấm Quay đi bro!"
            : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await startRound(
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
  },

  // Idle sweeper: ván chết giữa lúc cược (timer mất do restart, không ai bấm lại)
  // → hoàn mọi cược và đóng bàn.
  async handleExpiredGame(client, guildId, channelId, stored: StoredGame) {
    const state = stored.state as RouletteState;
    cancelDeadline(`${guildId}:${channelId}`);
    refundAll(state);
    endGame(guildId, channelId);
    sweepBots();
    try {
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      await message?.edit(boardPayload(statusContainer("⌛ Ván bị huỷ vì im ắng quá lâu — coin đã cược được hoàn lại đầy đủ.")));
    } catch (error) {
      console.error(`[roulette] expire edit failed in ${channelId}:`, error);
    }
  },

  async handleButton(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const [, action, arg] = interaction.customId.split(":");

    // "Ván mới" acts on an ALREADY-ENDED game, so it runs BEFORE the game-exists
    // check below. Its id carries the previous round's bot count to auto-seat.
    if (action === "again") {
      const existing = loadGame(guildId, channelId);
      if (existing) {
        await interaction.reply({
          content:
            existing.game === GAME
              ? "Kênh này đang có ván roulette rồi bro — xong ván đó đã nhé."
              : `Kênh này đang chơi **${existing.game}** — xong ván đó đã bro.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const botCount = Math.min(MAX_BOTS, Math.max(0, Number(arg) || 0));
      await interaction.update(boardPayload(statusContainer("🔄 Ván mới đã mở bên dưới 👇"))); // gỡ nút Ván mới khỏi bảng kết quả cũ
      await startRound(interaction.client, guildId, channelId, userId, (payload) => interaction.followUp(payload), botCount);
      return;
    }

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({
        content: `Ván này kết thúc rồi bro — mở ván mới bằng \`/${GAME}\` nhé.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const state = stored.state as RouletteState;
    const hasBets = Object.keys(state.bets).length > 0;

    if (action === "cancel") {
      if (userId !== state.host) {
        await interaction.reply({ content: `Chỉ chủ ván <@${state.host}> huỷ được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      cancelDeadline(`${guildId}:${channelId}`);
      refundAll(state);
      endGame(guildId, channelId);
      sweepBots();
      await interaction.update(boardPayload(statusContainer("❌ Chủ ván đã huỷ — coin cược đã hoàn lại đầy đủ.")));
      return;
    }

    if (action === "spin") {
      if (!hasBets) {
        await interaction.reply({ content: "Chưa ai cược mà quay gì bro 😅", flags: MessageFlags.Ephemeral });
        return;
      }
      if (userId !== state.host && Date.now() < state.deadline) {
        await interaction.reply({
          content: "Chưa hết giờ cược — chờ chủ ván quay hoặc đợi đếm ngược nhé bro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await playAnimation(editViaInteraction(interaction), settle(guildId, channelId, state));
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
      if (!addRouletteBot(guildId, channelId, botId)) {
        await interaction.reply({
          content: "🏦 Quỹ nhà cái chưa đủ để ôm thêm bot đặt cửa bro — chờ nhà cái nạp thêm nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const live = loadGame(guildId, channelId);
      if (!live || live.game !== GAME) return;
      const liveState = live.state as RouletteState;
      await interaction.update(boardPayload(renderBoard(liveState, loadCoins()[liveState.host] ?? 0)));
      return;
    }

    // Nhà cái không được đặt cửa (cả nút lẫn modal).
    if (userId === state.host) {
      await interaction.reply({
        content: "Bro là nhà cái ván này — nhà cái chỉ ăn/chung chứ không đặt cược nhé 🎰",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Hết giờ cược (kể cả timer mất do restart) → resolve lười ngay tại click.
    if (Date.now() > state.deadline) {
      if (hasBets) {
        await playAnimation(editViaInteraction(interaction), settle(guildId, channelId, state));
      } else {
        endGame(guildId, channelId);
        sweepBots();
        await interaction.update(boardPayload(statusContainer("⌛ Hết giờ mà không ai cược — huỷ ván nhé bro.")));
      }
      return;
    }

    if (action === "number") {
      const balance = loadCoins()[userId] ?? 0;
      if (balance < BET_STEP) {
        await interaction.reply({
          content: `Không đủ coin rồi bro — cần tối thiểu ${BET_STEP} 🪙 để đặt số, số dư: ${balance}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`${GAME}:number`)
        .setTitle("Đặt thẳng số (trả 36×)")
        .addLabelComponents(
          new LabelBuilder()
            .setLabel("Số (0–36)")
            .setTextInputComponent(
              new TextInputBuilder().setCustomId("so").setPlaceholder("VD: 17").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2),
            ),
          new LabelBuilder()
            .setLabel(`Số coin (tối thiểu ${BET_STEP}, số dư ${balance})`.slice(0, 45))
            .setTextInputComponent(
              new TextInputBuilder().setCustomId("tien").setPlaceholder("VD: 50").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    // bet — cửa ngoài, BET_STEP mỗi lần bấm
    if (action !== "bet" || !arg || !(arg in OUTSIDE)) return;
    const key = arg;

    const coins = loadCoins();
    const balance = coins[userId] ?? 0;
    if (balance < BET_STEP) {
      await interaction.reply({
        content: `Không đủ coin rồi bro — cần ${BET_STEP} 🪙 mỗi lần cược, số dư: ${balance}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Chặn solvency nhà cái: không nhận cược nào khiến kết quả đắt nhất trong 37
    // ô vượt quá tổng cược + quỹ nhà cái.
    const gate = solvencyRefusal(state.bets, key, BET_STEP, coins[state.host] ?? 0);
    if (gate) {
      await interaction.reply({ content: gate, flags: MessageFlags.Ephemeral });
      return;
    }

    coins[userId] = balance - BET_STEP;
    saveCoins(coins);
    const userBets = (state.bets[userId] ??= {});
    userBets[key] = (userBets[key] ?? 0) + BET_STEP;
    saveGame(guildId, channelId, { game: GAME, state });
    await interaction.update(boardPayload(renderBoard(state, coins[state.host] ?? 0)));
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    if (!interaction.inGuild()) return;
    const [, action] = interaction.customId.split(":");
    if (action !== "number") return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId!;
    const userId = interaction.user.id;

    const rawNum = interaction.fields.getTextInputValue("so").trim();
    const rawAmt = interaction.fields.getTextInputValue("tien").trim();
    if (!/^\d{1,2}$/.test(rawNum) || Number(rawNum) > 36) {
      await interaction.reply({ content: `"${rawNum}" không phải số roulette hợp lệ bro — nhập số nguyên 0–36 nhé.`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!/^\d+$/.test(rawAmt) || Number(rawAmt) < BET_STEP) {
      await interaction.reply({ content: `"${rawAmt}" không hợp lệ bro — nhập số coin nguyên ≥ ${BET_STEP} nhé (VD: 50).`, flags: MessageFlags.Ephemeral });
      return;
    }
    const num = Number(rawNum);
    const amount = Number(rawAmt);
    const key = `s${num}`;

    // Load → validate → mutate → save, không await xen giữa: atomic trên event loop.
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({ content: "Ván này kết thúc rồi bro — tiền chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    const state = stored.state as RouletteState;
    if (userId === state.host) {
      await interaction.reply({ content: "Bro là nhà cái ván này, không đặt cược được nhé — tiền chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (Date.now() > state.deadline) {
      await interaction.reply({ content: "Hết giờ cược rồi bro — tiền chưa bị trừ. Chờ quay hoặc mở ván mới nhé.", flags: MessageFlags.Ephemeral });
      return;
    }
    const coins = loadCoins();
    const balance = coins[userId] ?? 0;
    if (balance < amount) {
      await interaction.reply({ content: `Không đủ coin bro — đặt ${amount} 🪙 mà số dư chỉ ${balance}.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const gate = solvencyRefusal(state.bets, key, amount, coins[state.host] ?? 0);
    if (gate) {
      await interaction.reply({ content: gate, flags: MessageFlags.Ephemeral });
      return;
    }

    coins[userId] = balance - amount;
    saveCoins(coins);
    const userBets = (state.bets[userId] ??= {});
    userBets[key] = (userBets[key] ?? 0) + amount;
    saveGame(guildId, channelId, { game: GAME, state });

    const { emoji } = colorOf(num);
    await interaction.reply({ content: `✅ Đã đặt **${amount}** 🪙 vào số ${emoji} **${num}** — trúng ăn 36× nhé!`, flags: MessageFlags.Ephemeral });
    const message = await fetchBoardMessage(interaction.client, channelId, state.messageId).catch(() => null);
    await message?.edit(boardPayload(renderBoard(state, coins[state.host] ?? 0))).catch(() => {});
  },
};

// Chặn cược nếu ô đắt nhất trong 37 kết quả vượt quỹ nhà cái + tổng cược. Trả về
// câu từ chối (đã có tiếng Việt) hoặc null nếu nhà cái ôm được. Dùng chung bởi
// nút cửa ngoài và modal đặt số — một chỗ duy nhất tính solvency.
function solvencyRefusal(bets: Bets, key: string, add: number, hostBalance: number): string | null {
  const totals = keyTotals(bets);
  totals[key] = (totals[key] ?? 0) + add;
  const totalStake = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const worstPayout = rouletteMaxLiability(totals);
  if (worstPayout > totalStake + hostBalance) {
    return `🏦 Nhà cái không ôm nổi kèo này bro — quỹ nhà cái đang **${hostBalance}** 🪙, mà lỡ ô đắt nhất trúng thì phải chung tới **${worstPayout - totalStake}** 🪙. Cược nhỏ hơn, chờ người khác cược cho cân kèo, hoặc thử cửa khác nhé.`;
  }
  return null;
}

// --- AI-bot fill (host-banker faucet) ---
//
// Bot là NGƯỜI THAM GIA SETTLE thật để nhà cái ăn/chung với nó (faucet cố ý:
// mint/burn có chủ đích, đúng như bầu cua/đua thú/blackjack). Luồng coin: bot
// quyết cược async (không đụng ví) → đặt ĐỒNG BỘ bằng cách mint thẳng stake vào
// pot (không trừ ví ai) + ensureBotLedger để banker settle tính nó là người chơi
// → sau settle sweepBots đốt phần dư. Tôn trọng đúng solvency gate như người
// thật (solvencyRefusal) nên nhà cái luôn đủ quỹ lúc chốt.

type BotBets = Record<string, number>; // betKey → coin

// Cửa hợp lệ: 12 cửa ngoài hoặc "s0".."s36" (đặt thẳng số).
function isLegalBetKey(key: string): boolean {
  if (key in OUTSIDE) return true;
  if (!key.startsWith("s")) return false;
  const n = Number(key.slice(1));
  return Number.isInteger(n) && n >= 0 && n <= 36;
}

// Fallback tất định: 1–2 cửa, phần lớn là cửa ngoài rẻ (liability thấp, nhà cái
// dễ ôm); thỉnh thoảng phang thẳng một số nhỏ cho vui. Bảo đảm bot luôn có nước
// đi hợp lệ khi model chậm/hỏng.
function randomRouletteBets(): BotBets {
  const outsideKeys = Object.keys(OUTSIDE);
  const bets: BotBets = {};
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.85) {
      const key = outsideKeys[Math.floor(Math.random() * outsideKeys.length)]!;
      bets[key] = (bets[key] ?? 0) + (1 + Math.floor(Math.random() * 4)) * BET_STEP; // 10–40
    } else {
      bets[`s${Math.floor(Math.random() * 37)}`] = BET_STEP; // đặt thẳng nhỏ (36× liability)
    }
  }
  return bets;
}

// Đồng bộ, atomic: mint stake của bot thẳng vào pot (faucet), từng cửa một, bỏ
// qua cược nào gate solvency của nhà cái không ôm nổi — đúng cổng người thật đi
// qua nên nhà cái luôn đủ quỹ. Trả về true nếu có ít nhất một cửa được đặt.
function placeBotBets(guildId: string, channelId: string, botId: string, bets: BotBets): boolean {
  const stored = loadGame(guildId, channelId);
  if (!stored || stored.game !== GAME) return false;
  const state = stored.state as RouletteState;
  if (Date.now() > state.deadline) return false;
  const hostBalance = loadCoins()[state.host] ?? 0;
  let placed = false;
  for (const [key, amount] of Object.entries(bets)) {
    if (solvencyRefusal(state.bets, key, amount, hostBalance)) continue; // nhà cái không ôm nổi — bỏ cửa này
    const userBets = (state.bets[botId] ??= {});
    userBets[key] = (userBets[key] ?? 0) + amount; // mint thẳng vào pot, không trừ ví
    placed = true;
  }
  if (!placed) return false;
  ensureBotLedger([botId]); // đánh dấu bot là người tham gia settle để banker settle ăn/chung với nó
  saveGame(guildId, channelId, { game: GAME, state });
  return true;
}

// Thêm một bot cược trên demand (nút "Thêm bot"). Cược là một cửa random hợp lệ đặt
// ĐỒNG BỘ — chọn cửa thì không cần LLM, mà gọi Haiku async chỉ tổ làm đứng bàn vài
// giây (CLI cold-start vượt luôn timeout của nút trên máy chủ CPU nhỏ). Tức thì +
// gate solvency. Trả true nếu đặt được.
function addRouletteBot(guildId: string, channelId: string, botId: string): boolean {
  return placeBotBets(guildId, channelId, botId, randomRouletteBets());
}

export default roulette;
