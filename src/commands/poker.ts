// /poker — Texas Hold'em (No-Limit) cho 2–8 người, cùng một sòng peer-pot: coin
// của mỗi người đổi thành "chip" khi vào bàn, chip chỉ chạy giữa ví-tạm và pot
// trong ván, cuối ván trả hết về ví — zero-sum, KHÔNG nhà cái, không đốt/mint,
// không phí (giống /masoi, /noitu). Không có bot (poker cần người thật đấu nhau).
//
// Lõi luật + chia pot nằm ở ../poker (thuần, test ở poker.test.ts). File này là
// vỏ Discord: một bảng sòng DUY NHẤT được vẽ lại mỗi lượt, hàng nút hành động
// thuộc về ĐÚNG người tới lượt (người khác bấm bị chặn — như /blackjack), bài
// tẩy riêng tư qua reply ephemeral (👁️ Bài của tôi — như /masoi), nút 📋 Luật
// cho người mới. Bất biến tiền: mọi thao tác coin đồng bộ (load→mutate→save)
// trước await; settle showdown chạy trước khi vẽ — crash giữa chừng không mất coin.
//
// An toàn khi restart ba lớp như các game khác: deadline lượt được lưu → click kế
// tiếp tự xử lý (autoAct người treo) → idle sweeper VOID ván và hoàn đủ buy-in.

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
import { mentionOrName } from "../bots";
import { cardEmoji, type Card } from "../cards";
import { againRow, fetchBoardMessage } from "../games";
import { boardPayload, divider, text } from "../ui";
import { loadCoins, saveCoins } from "../economy";
import { endGame, loadGame, saveGame, type StoredGame } from "../guilds";
import {
  act,
  autoAct,
  best7,
  betPresets,
  BIG_BLIND,
  finalStacks,
  handName,
  isBettingPhase,
  legalMoves,
  potTotal,
  SMALL_BLIND,
  startHand,
  type PokerState,
} from "../poker";
import { cancelDeadline, scheduleDeadline } from "../scheduler";
import type { Command } from "../types";

const GAME = "poker";
export const MIN_BUYIN = 50; // ≥ 5 lần big blind — đủ để chơi có nghĩa
export const MAX_SEATS = 8;
export const MIN_PLAYERS = 2;
const TURN_MS = 60_000; // hết giờ MỘT LƯỢT → người tới lượt tự "bỏ qua" (nếu được) hoặc "bỏ bài"

function key(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

function newLobby(hostId: string): PokerState {
  return {
    phase: "lobby",
    host: hostId,
    messageId: "",
    deadline: 0,
    order: [],
    seats: {},
    buttonIndex: 0,
    buyins: {},
    deck: [],
    board: [],
    currentBet: 0,
    lastRaiseSize: 0,
    toAct: null,
  };
}

// --- Render ---
// Bảng poker là MỘT tin Components V2 suốt vòng đời (lobby → các vòng cược → kết
// quả) qua `boardPayload` — buttons nằm TRONG container, dòng "dành cho @X" ngay
// trên chúng (giống /blackjack). Helper V2 (boardPayload/text/divider) dùng chung ở ../ui.

const STREET_LABEL: Record<string, string> = { preflop: "Tẩy (chưa lật)", flop: "Flop", turn: "Turn", river: "River", showdown: "Ngã bài" };

function cardsStr(cards: Card[]): string {
  return cards.map((c) => cardEmoji(c.rank, c.suit)).join(" ");
}

// Bài chung: các lá đã lật + ô trống cho lá chưa tới (tổng 5).
function boardStr(state: PokerState): string {
  const dealt = state.board.map((c) => cardEmoji(c.rank, c.suit));
  const blanks = Array.from({ length: 5 - state.board.length }, () => "▢");
  return [...dealt, ...blanks].join(" ");
}

function seatLine(state: PokerState, id: string): string {
  const seat = state.seats[id]!;
  const n = state.order.length;
  const idx = state.order.indexOf(id);
  const isButton = idx === state.buttonIndex;
  const sbIndex = n === 2 ? state.buttonIndex : (state.buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (state.buttonIndex + 1) % n : (state.buttonIndex + 2) % n;
  const pos = isButton ? " 🔘D" : idx === sbIndex ? " ·SB" : idx === bbIndex ? " ·BB" : "";
  const isTurn = state.toAct === id;
  let status: string;
  if (seat.folded) status = "🚪 bỏ bài";
  else if (seat.allIn) status = "🔥 tất tay";
  else if (isTurn) status = "👉 **đang nghĩ**";
  else if (seat.committedRound > 0) status = `đặt ${seat.committedRound}`;
  else status = "·";
  const icon = seat.folded ? "▫️" : isTurn ? "👉" : "▪️";
  return `${icon} ${mentionOrName(id)}${pos} — 🪙 **${seat.stack}**${seat.committedTotal > 0 ? ` · pot ${seat.committedTotal}` : ""} · ${status}`;
}

function tableContainer(state: PokerState): ContainerBuilder {
  const turn = state.toAct;
  const lm = turn ? legalMoves(state, turn) : null;
  const header = [
    "## 🃏 Poker — Tố xì (Texas Hold'em)",
    `🎴 **Bài chung** (${STREET_LABEL[state.phase] ?? state.phase}): ${boardStr(state)}`,
    `💰 Pot: **${potTotal(state)}** 🪙 · mù nhỏ/lớn ${SMALL_BLIND}/${BIG_BLIND}`,
  ].join("\n");
  const seatsBlock = state.order.map((id) => seatLine(state, id)).join("\n");
  // Dòng NGAY TRÊN hàng nút: hành động này dành cho ai (mention hiện đúng tên).
  const actionLine = turn
    ? `👉 **Hành động dành cho ${mentionOrName(turn)}** — ${lm && lm.toCall > 0 ? `cần theo **${lm.toCall}** 🪙` : "có thể **Bỏ qua** (check)"} · chỉ ${mentionOrName(turn)} bấm được · còn <t:${Math.floor(state.deadline / 1000)}:R>.`
    : "🃏 Hết lượt — đang lật bài...";
  return new ContainerBuilder()
    .setAccentColor(0x1f8b4c)
    .addTextDisplayComponents(text(header))
    .addTextDisplayComponents(text(seatsBlock))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(actionLine))
    .addActionRowComponents(...tableRows(state))
    .addTextDisplayComponents(
      text("-# 👁️ **Bài của tôi** = xem 2 lá tẩy · 📋 **Luật** · Xếp hạng: Thùng phá sảnh › Tứ quý › Cù lũ › Thùng › Sảnh › Sám › Hai đôi › Đôi › Mậu thầu."),
    );
}

// Hàng nút hành động: thuộc về người tới lượt (người khác bấm bị chặn). Chỉ hiện
// nút hợp lệ — nhãn mang sẵn số coin để người mới không phải nhẩm.
function tableRows(state: PokerState): ActionRowBuilder<ButtonBuilder>[] {
  const turn = state.toAct;
  const actions = new ActionRowBuilder<ButtonBuilder>();
  if (turn) {
    const lm = legalMoves(state, turn);
    actions.addComponents(
      new ButtonBuilder().setCustomId("poker:fold").setLabel("Bỏ bài").setEmoji("🚪").setStyle(ButtonStyle.Danger),
    );
    if (lm.canCheck) {
      actions.addComponents(
        new ButtonBuilder().setCustomId("poker:check").setLabel("Bỏ qua").setEmoji("✅").setStyle(ButtonStyle.Secondary),
      );
    } else {
      actions.addComponents(
        new ButtonBuilder().setCustomId("poker:call").setLabel(`Theo ${lm.toCall}`).setEmoji("✅").setStyle(ButtonStyle.Success),
      );
    }
    for (const p of betPresets(state, turn)) {
      const label = p.allIn ? `🔥 Tất tay ${p.to}` : p.key === "half" ? `Tố ½ (+${p.add})` : `Tố pot (+${p.add})`;
      actions.addComponents(
        new ButtonBuilder().setCustomId(`poker:raise:${p.key}`).setLabel(label).setStyle(ButtonStyle.Primary),
      );
    }
  }
  const info = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("poker:cards").setLabel("Bài của tôi").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("poker:rules").setLabel("Luật").setEmoji("📋").setStyle(ButtonStyle.Secondary),
  );
  return turn ? [actions, info] : [info];
}

function lobbyContainer(state: PokerState): ContainerBuilder {
  const seats = state.order.map((id, i) => `\`${i + 1}.\` ${mentionOrName(id)} — mua **${state.buyins[id]}** 🪙`);
  const body = [
    "## 🃏 Poker — đang gọi bàn!",
    `Chủ bàn: <@${state.host}> · Texas Hold'em, mù ${SMALL_BLIND}/${BIG_BLIND} 🪙 — ai thắng ăn pot, **không nhà cái, không phí**.`,
    "",
    seats.length > 0 ? `**Đã vào bàn (${seats.length}/${MAX_SEATS}):**\n${seats.join("\n")}` : "*Chưa ai vào bàn — bấm Vào bàn đi bro!*",
    "",
    `Bấm **Vào bàn** để mua chip (tối thiểu ${MIN_BUYIN} 🪙, bạn mua bao nhiêu là stack bấy nhiêu). Đủ **${MIN_PLAYERS}+** người thì chủ bàn bấm **Chia bài**.`,
    `-# Tổng chip trên bàn: ${Object.values(state.buyins).reduce((s, v) => s + v, 0)} 🪙 · 📋 Chưa biết chơi? Bấm **Luật** — poker cực dễ khi có nút bấm sẵn.`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...lobbyRows());
}

function lobbyRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("poker:join").setLabel("Vào bàn").setEmoji("🪙").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("poker:start").setLabel("Chia bài").setEmoji("🎴").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("poker:rules").setLabel("Luật").setEmoji("📋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("poker:cancel").setLabel("Huỷ bàn").setStyle(ButtonStyle.Danger),
    ),
  ];
}

function rulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📋 Luật Poker (Texas Hold'em)")
    .setDescription(
      [
        "🎯 **Mục tiêu:** ghép **5 lá mạnh nhất** từ 2 lá tẩy riêng của bạn + 5 lá chung giữa bàn. Ai bài to nhất (hoặc khiến mọi người bỏ bài) thì ăn pot.",
        "",
        "🔄 **Diễn tiến:** chia 2 lá tẩy → vòng cược → lật 3 lá chung (Flop) → cược → 1 lá (Turn) → cược → 1 lá (River) → cược → **ngã bài**.",
        "",
        "🎮 **Tới lượt bạn có các nút:**",
        "• 🚪 **Bỏ bài** — bỏ, mất phần đã đặt, chờ ván sau.",
        "• ✅ **Bỏ qua (check)** — không ai cược thì xem bài tiếp miễn phí.",
        "• ✅ **Theo N** — bỏ N chip cho bằng cửa đang có.",
        "• **Tố ½ / Tố pot** — cược thêm để ép đối thủ; số trong ngoặc là chip bạn bỏ ra.",
        "• 🔥 **Tất tay** — dồn hết chip. Ai theo ít hơn thì tách **pot phụ** (side pot) tự động.",
        "",
        "🏆 **Xếp hạng bài (cao → thấp):** Thùng phá sảnh › Tứ quý › Cù lũ › Thùng › Sảnh › Sám cô › Hai đôi › Đôi › Mậu thầu.",
        "",
        "💰 **Tiền:** vào bàn mua chip bằng coin; cuối ván chip còn lại (+ pot thắng) đổi lại thành coin. Zero-sum — không nhà cái, không phí.",
      ].join("\n"),
    )
    .setColor(0x2ecc71);
}

function statusContainer(body: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## 🃏 Poker\n${body}`));
}

// Ephemeral "Bài của tôi": 2 lá tẩy + gợi ý bài mạnh nhất hiện có (từ flop trở đi).
function holeContent(state: PokerState, id: string): string {
  const seat = state.seats[id];
  if (!seat) return "Bro không ở bàn này 🤔";
  if (seat.hole.length === 0) return "Chưa chia bài bro — chờ chủ bàn bấm Chia bài nhé.";
  const lines = [`🃏 Bài tẩy của bạn: **${cardsStr(seat.hole)}**`];
  if (seat.folded) lines.push("🚪 Bạn đã bỏ bài ván này.");
  else if (state.board.length >= 3) lines.push(`💪 Đang mạnh nhất: **${handName(best7([...seat.hole, ...state.board]))}** (kèm bài chung ${cardsStr(state.board)}).`);
  else if (seat.hole[0]!.rank === seat.hole[1]!.rank) lines.push(`💪 Bạn có sẵn **đôi ${seat.hole[0]!.rank}** ngay từ đầu!`);
  return lines.join("\n");
}

function showdownContainer(state: PokerState): ContainerBuilder {
  const payouts = state.payouts ?? {};
  const rows = state.order.map((id) => {
    const seat = state.seats[id]!;
    const won = payouts[id] ?? 0;
    const showCards = state.reveal && !seat.folded;
    const hand = showCards ? ` ${cardsStr(seat.hole)} → **${handName(best7([...seat.hole, ...state.board]))}**` : seat.folded ? " 🚪 bỏ bài" : "";
    const tail = won > 0 ? ` → 🎉 **+${won}** 🪙` : "";
    return `${won > 0 ? "🏆" : "▫️"} ${mentionOrName(id)}${hand}${tail}`;
  });
  const body = [
    "## 🃏 Kết quả Poker",
    `🎴 Bài chung: ${boardStr(state)}`,
    `💰 Tổng pot: **${potTotal(state)}** 🪙`,
    ...(state.potsInfo && state.potsInfo.length > 1 ? [`🍰 Có **${state.potsInfo.length}** pot (pot chính + pot phụ do tất tay).`] : []),
    "",
    rows.join("\n"),
    "-# Chip còn lại đã đổi về coin cho mọi người. Bấm **Ván mới** để chơi ván nữa!",
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0x9b59b6)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(againRow(GAME, 0));
}

// --- Ledger + tiến trình ---

// Void an toàn: hoàn đủ buy-in cho mọi ghế (ghost-guard). Dùng khi huỷ lobby hoặc
// idle sweeper giết ván đang chơi — không ai thắng/thua trên ván bot khai tử.
function refundBuyins(state: PokerState): void {
  const coins = loadCoins();
  for (const id of state.order) {
    if (id in coins) coins[id] = coins[id]! + (state.buyins[id] ?? 0);
  }
  saveCoins(coins);
}

// Showdown: đổi chip còn lại (đã gồm pot thắng cộng ở endHand) về coin. Đồng bộ,
// chạy TRƯỚC mọi await/animation. endGame xoá file → click trùng không settle 2 lần.
function settleShowdown(guildId: string, channelId: string, state: PokerState): void {
  cancelDeadline(key(guildId, channelId));
  const coins = loadCoins();
  for (const [id, amount] of Object.entries(finalStacks(state))) {
    if (id in coins && amount > 0) coins[id] = coins[id]! + amount;
  }
  saveCoins(coins);
  endGame(guildId, channelId);
}

// Hẹn giờ LƯỢT hiện tại. Hết giờ mà chưa bấm → autoAct người tới lượt (bỏ qua nếu
// được, không thì bỏ bài), rồi settle hoặc vẽ lại + hẹn tiếp. scheduleDeadline
// thay-thế theo key nên mỗi lượt mới tự huỷ timer cũ.
function scheduleTurnTimeout(client: Client, guildId: string, channelId: string): void {
  scheduleDeadline(key(guildId, channelId), TURN_MS + 1000, async () => {
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) return;
    const state = stored.state as PokerState;
    if (!isBettingPhase(state.phase) || !state.toAct) return;
    if (Date.now() <= state.deadline) return; // lượt mới đã hẹn lại — bỏ qua timer cũ
    try {
      autoAct(state, state.toAct); // đồng bộ: hành động + tự sang lượt/ngã bài
      if (state.phase === "showdown") {
        settleShowdown(guildId, channelId, state);
        const message = await fetchBoardMessage(client, channelId, state.messageId);
        await message?.edit(boardPayload(showdownContainer(state)));
      } else {
        state.deadline = Date.now() + TURN_MS;
        saveGame(guildId, channelId, { game: GAME, state });
        scheduleTurnTimeout(client, guildId, channelId);
        const message = await fetchBoardMessage(client, channelId, state.messageId);
        await message?.edit(boardPayload(tableContainer(state)));
      }
    } catch (error) {
      console.error(`[poker] turn timeout failed in ${channelId}:`, error);
    }
  });
}

// Sau một hành động đã mutate + save: ngã bài → settle + hiện kết quả; còn lượt →
// đặt deadline mới, hẹn timer, vẽ lại bảng. Đồng bộ (deadline + saveGame + settle)
// trước await để bất biến tiền không vỡ khi crash.
async function progress(interaction: ButtonInteraction, guildId: string, channelId: string, state: PokerState): Promise<void> {
  if (state.phase === "showdown") {
    settleShowdown(guildId, channelId, state);
    await interaction.update(boardPayload(showdownContainer(state)));
  } else {
    state.deadline = Date.now() + TURN_MS;
    saveGame(guildId, channelId, { game: GAME, state });
    scheduleTurnTimeout(interaction.client, guildId, channelId);
    await interaction.update(boardPayload(tableContainer(state)));
  }
}

// Mở lobby: giữ chỗ kênh TRƯỚC await đầu tiên, post bảng, rồi vá messageId từ bản
// re-load (một cú vào bàn trong lúc roundtrip đã kịp mutate state đã lưu).
async function openLobby(
  guildId: string,
  channelId: string,
  hostId: string,
  send: (payload: ReturnType<typeof boardPayload>) => Promise<Message>,
): Promise<void> {
  const state = newLobby(hostId);
  saveGame(guildId, channelId, { game: GAME, state });
  try {
    const message = await send(boardPayload(lobbyContainer(state)));
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) {
      const liveState = live.state as PokerState;
      liveState.messageId = message.id;
      saveGame(guildId, channelId, { game: GAME, state: liveState });
    }
  } catch (error) {
    // Fresh lobby has no stakes yet, but a join may have landed mid-roundtrip —
    // refund from a re-load before freeing the slot.
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) refundBuyins(live.state as PokerState);
    endGame(guildId, channelId);
    throw error;
  }
}

// --- Command ---

const poker: Command = {
  data: new SlashCommandBuilder().setName(GAME).setDescription("Mở sòng Poker (Texas Hold'em) — 2–8 người, ai thắng ăn pot"),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const existing = loadGame(guildId, channelId);
    if (existing) {
      await interaction.reply({
        content:
          existing.game === GAME
            ? "Kênh này đang có sòng poker rồi — bấm nút trên bảng đi bro."
            : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await openLobby(guildId, channelId, interaction.user.id, async (payload) => {
      await interaction.reply(payload);
      return interaction.fetchReply();
    });
  },

  // Idle sweeper: VOID ván (lobby ế hoặc ván đang chơi bị bỏ) → hoàn đủ buy-in.
  async handleExpiredGame(client, guildId, channelId, stored: StoredGame) {
    const state = stored.state as PokerState;
    cancelDeadline(key(guildId, channelId));
    refundBuyins(state);
    endGame(guildId, channelId);
    try {
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      await message?.edit(boardPayload(statusContainer("⌛ Sòng im ắng quá lâu — mình huỷ ván, chip đã đổi lại thành coin đầy đủ.")));
    } catch (error) {
      console.error(`[poker] expire edit failed in ${channelId}:`, error);
    }
  },

  async handleButton(interaction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const [, action, arg] = interaction.customId.split(":");

    // Ván mới: chạy TRƯỚC kiểm tra game-tồn-tại (ván cũ đã settle xong).
    if (action === "again") {
      const existing = loadGame(guildId, channelId);
      if (existing) {
        await interaction.reply({ content: "Kênh này đang có ván rồi bro — chơi cho xong đã nhé.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.update(boardPayload(statusContainer("🔄 Ván mới đã mở bên dưới 👇")));
      await openLobby(guildId, channelId, userId, (payload) => interaction.followUp(payload));
      return;
    }

    // Luật — không đụng state, xem được cả khi bàn đã tàn.
    if (action === "rules") {
      await interaction.reply({ embeds: [rulesEmbed()], flags: MessageFlags.Ephemeral });
      return;
    }

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({ content: "Sòng này kết thúc rồi bro — mở sòng mới bằng `/poker` nhé.", flags: MessageFlags.Ephemeral });
      return;
    }
    const state = stored.state as PokerState;

    switch (action) {
      case "join":
        return joinLobby(interaction, state);
      case "cancel":
        return cancelLobby(interaction, guildId, channelId, state);
      case "start":
        return startTable(interaction, guildId, channelId, state);
      case "cards":
        await interaction.reply({ content: holeContent(state, userId), flags: MessageFlags.Ephemeral });
        return;
      case "fold":
      case "check":
      case "call":
      case "raise":
        return handleAction(interaction, guildId, channelId, state, action, arg);
    }
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    if (!interaction.inGuild()) return;
    const [, action] = interaction.customId.split(":");
    if (action !== "buyin") return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId!;
    const userId = interaction.user.id;

    const raw = interaction.fields.getTextInputValue("tiencuoc").trim();
    if (!/^\d+$/.test(raw) || Number(raw) < MIN_BUYIN) {
      await interaction.reply({ content: `"${raw}" không hợp lệ bro — nhập số nguyên ≥ ${MIN_BUYIN} nhé (VD: 200).`, flags: MessageFlags.Ephemeral });
      return;
    }
    const amount = Number(raw);

    // Load → validate → mutate → save, không await xen giữa: atomic trên event loop.
    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({ content: "Bàn này kết thúc rồi bro — coin chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    const state = stored.state as PokerState;
    if (state.phase !== "lobby") {
      await interaction.reply({ content: "Đã chia bài rồi, không vào bàn được nữa bro — coin chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.order.includes(userId)) {
      await interaction.reply({ content: "Bro vào bàn rồi mà 😄 — coin chưa bị trừ.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.order.length >= MAX_SEATS) {
      await interaction.reply({ content: `Bàn đầy ${MAX_SEATS} người rồi bro.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const coins = loadCoins();
    const balance = coins[userId] ?? 0;
    if (balance < amount) {
      await interaction.reply({ content: `Không đủ coin bro — mua ${amount} 🪙 mà số dư chỉ ${balance}.`, flags: MessageFlags.Ephemeral });
      return;
    }
    coins[userId] = balance - amount;
    saveCoins(coins);
    state.order.push(userId);
    state.buyins[userId] = amount;
    saveGame(guildId, channelId, { game: GAME, state });

    await interaction.reply({ content: `✅ Đã vào bàn với **${amount}** 🪙 chip — chờ chủ bàn chia bài nhé!`, flags: MessageFlags.Ephemeral });
    const message = await fetchBoardMessage(interaction.client, channelId, state.messageId).catch(() => null);
    await message?.edit(boardPayload(lobbyContainer(state))).catch(() => {});
  },
};

// --- Lobby handlers ---

async function joinLobby(interaction: ButtonInteraction, state: PokerState): Promise<void> {
  const userId = interaction.user.id;
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Đã chia bài rồi, không vào bàn được nữa bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.order.includes(userId)) {
    await interaction.reply({ content: "Bro vào bàn rồi mà 😄", flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.order.length >= MAX_SEATS) {
    await interaction.reply({ content: `Bàn đầy ${MAX_SEATS} người rồi bro — chờ ván sau nhé.`, flags: MessageFlags.Ephemeral });
    return;
  }
  const balance = loadCoins()[userId] ?? 0;
  if (balance < MIN_BUYIN) {
    await interaction.reply({ content: `Không đủ coin bro — cần tối thiểu ${MIN_BUYIN} 🪙 để vào bàn, số dư: ${balance}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId("poker:buyin")
    .setTitle("Vào bàn Poker")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(`Mua chip (tối thiểu ${MIN_BUYIN}, số dư ${balance})`.slice(0, 45))
        .setTextInputComponent(
          new TextInputBuilder().setCustomId("tiencuoc").setPlaceholder("VD: 200").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9),
        ),
    );
  await interaction.showModal(modal);
}

async function cancelLobby(interaction: ButtonInteraction, guildId: string, channelId: string, state: PokerState): Promise<void> {
  if (interaction.user.id !== state.host) {
    await interaction.reply({ content: `Chỉ chủ bàn <@${state.host}> huỷ được nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Đã chia bài rồi, không huỷ được — chơi cho xong ván nhé bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  refundBuyins(state);
  endGame(guildId, channelId);
  await interaction.update(boardPayload(statusContainer("❌ Chủ bàn đã huỷ — chip đã đổi lại thành coin đầy đủ.")));
}

async function startTable(interaction: ButtonInteraction, guildId: string, channelId: string, state: PokerState): Promise<void> {
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Đã chia bài rồi bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== state.host) {
    await interaction.reply({ content: `Chỉ chủ bàn <@${state.host}> chia bài được nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.order.length < MIN_PLAYERS) {
    await interaction.reply({ content: `Cần tối thiểu ${MIN_PLAYERS} người vào bàn mới chia được bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  state.buttonIndex = Math.floor(Math.random() * state.order.length); // nút chia ngẫu nhiên cho công bằng
  startHand(state);
  saveGame(guildId, channelId, { game: GAME, state });
  // startHand có thể đi thẳng showdown nếu mọi người all-in từ mù (buy-in < BB) —
  // MIN_BUYIN ≥ BB nên gần như không xảy ra, nhưng vẫn xử lý cho chắc.
  await progress(interaction, guildId, channelId, state);
}

// --- Hành động cược (fold/check/call/raise) — CHỈ người tới lượt ---

async function handleAction(
  interaction: ButtonInteraction,
  guildId: string,
  channelId: string,
  state: PokerState,
  action: string,
  arg: string | undefined,
): Promise<void> {
  const userId = interaction.user.id;
  if (!isBettingPhase(state.phase)) {
    await interaction.reply({ content: "Chưa tới lúc cược bro — chờ diễn biến trên bảng nhé.", flags: MessageFlags.Ephemeral });
    return;
  }
  // Lượt hiện tại hết giờ (kể cả timer mất sau restart) → cho người treo tự xử lý,
  // rồi báo người bấm phiên đã sang lượt. Bất kỳ ai bấm cũng gỡ kẹt được.
  if (Date.now() > state.deadline && state.toAct) {
    autoAct(state, state.toAct);
    await progress(interaction, guildId, channelId, state);
    return;
  }
  const seat = state.seats[userId];
  if (!seat) {
    await interaction.reply({ content: "Bro không ngồi ở bàn này — chờ ván sau vào nhé.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.toAct !== userId) {
    await interaction.reply({
      content: state.toAct ? `Chưa tới lượt bro — đang chờ ${mentionOrName(state.toAct)} quyết đã 🃏` : "Chưa tới lượt bro 🃏",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lm = legalMoves(state, userId);
  if (action === "fold") {
    act(state, userId, { type: "fold" });
  } else if (action === "check") {
    if (!lm.canCheck) {
      await interaction.reply({ content: `Đang có cửa **${lm.toCall}** 🪙 — phải Theo hoặc Bỏ bài chứ không bỏ qua được bro.`, flags: MessageFlags.Ephemeral });
      return;
    }
    act(state, userId, { type: "check" });
  } else if (action === "call") {
    if (!lm.canCall) {
      await interaction.reply({ content: "Không có gì để theo — bấm Bỏ qua nhé bro.", flags: MessageFlags.Ephemeral });
      return;
    }
    act(state, userId, { type: "call" });
  } else {
    // raise: arg = half|pot|allin — tính lại preset tại thời điểm bấm (state có thể đổi)
    const preset = betPresets(state, userId).find((p) => p.key === arg);
    if (!preset) {
      await interaction.reply({ content: "Mức tố này không còn hợp lệ bro — xem lại bảng rồi bấm lại nhé.", flags: MessageFlags.Ephemeral });
      return;
    }
    act(state, userId, { type: "raise", to: preset.to });
  }

  saveGame(guildId, channelId, { game: GAME, state });
  await progress(interaction, guildId, channelId, state);
}

export default poker;
