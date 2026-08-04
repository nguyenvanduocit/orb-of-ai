// /worldcup — World Cup coin betting (mùa vui, env-gated on FOOTBALL_DATA_TOKEN).
// Kèo mở tự động cho mọi trận tương lai trong cache (src/football.ts) và khóa
// khi bóng lăn. Mỗi người một vé mỗi trận: phí vé (đốt) + tiền cược (vào pot).
// Vé không sửa được; hủy vé = mất trắng, stake ở lại pot — mua vé mới thoải mái.
// Flow đặt vé: select trận → nút chọn cửa → modal nhập tiền cược. Toàn bộ
// state nằm trong customId, không cần persist gì ngoài betting.json.
// Cược là chuyện công khai: đặt/hủy vé công bố trước kênh, /worldcup list và /worldcup ve
// kê từng vé — chỉ wizard chọn trận/cửa là ephemeral (người khác không bấm ké được).

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { config } from "../config";
import { getMatch, isOpenForBetting, openMatches, type WorldCupMatch } from "../football";
import { loadBetting, loadCoins, saveBetting, saveCoins, type BetPick, type BetTicket } from "../economy";
import { loadSettings, saveSettings } from "../guilds";
import { boardPayload, text } from "../ui";
import type { Command } from "../types";

// Full stage set of the 48-team 2026 format, verified against live API data.
const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: "Vòng bảng",
  LAST_32: "Vòng 1/16",
  LAST_16: "Vòng 1/8",
  QUARTER_FINALS: "Tứ kết",
  SEMI_FINALS: "Bán kết",
  THIRD_PLACE: "Tranh hạng 3",
  FINAL: "Chung kết",
};

// Select-menu labels can't render Discord timestamps — format kickoff in giờ VN.
const VN_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function pickLabel(match: WorldCupMatch, pick: BetPick): string {
  return pick === "DRAW" ? "Hòa" : pick === "HOME" ? match.home : match.away;
}

function ts(match: WorldCupMatch, style: "f" | "R"): string {
  return `<t:${Math.floor(match.kickoff / 1000)}:${style}>`;
}

const PICKS: readonly BetPick[] = ["HOME", "DRAW", "AWAY"];

// --- Exported rule cores (like coin's transfer / xoso's buyLottery) ---
// Shared by the betting wizard's modal/button handlers AND the agent's
// bot_worldcup_* tools (agent-tools.ts). Each is one synchronous
// load→validate→mutate→save block — atomic on the event loop, same invariant
// as every coin move; settlement stays with settleBook in football.ts.

// Mua vé một trận: phí vé (đốt) + tiền cược (vào pot). Một vé/người/trận.
export function placeBet(
  guildId: string,
  userId: string,
  matchId: number,
  pick: BetPick,
  stake: number,
  channelId?: string | null,
):
  | { ok: true; match: WorldCupMatch; pick: BetPick; stake: number; fee: number; pot: number; tickets: number; balance: number }
  | { ok: false; reason: "closed" }
  | { ok: false; reason: "draw-not-allowed" }
  | { ok: false; reason: "exists" }
  | { ok: false; reason: "insufficient"; need: number; balance: number } {
  const match = getMatch(matchId);
  if (!match || !isOpenForBetting(match)) return { ok: false, reason: "closed" };
  // Hòa chỉ bán ở vòng bảng — knockout luôn có kết quả (hiệp phụ/pen). Nút wizard
  // đã lọc, guard này bảo vệ đường agent (tool có thể truyền DRAW cho trận knock-out).
  if (pick === "DRAW" && match.stage !== "GROUP_STAGE") return { ok: false, reason: "draw-not-allowed" };
  const betting = loadBetting();
  const book = (betting.books[String(matchId)] ??= { pot: 0, tickets: {} });
  if (book.tickets[userId]) return { ok: false, reason: "exists" };
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  const cost = stake + config.betTicketFee;
  if (balance < cost) return { ok: false, reason: "insufficient", need: cost, balance };
  coins[userId] = balance - cost;
  saveCoins(coins);
  book.pot += stake;
  book.tickets[userId] = { pick, stake, fee: config.betTicketFee, placedAt: Date.now() };
  // Remember which room this bet came from: the book is shared across servers,
  // so live scores and the settlement need to reach every server that played.
  if (channelId) {
    book.rooms = { ...book.rooms, [guildId]: { ...book.rooms?.[guildId], channelId } };
  }
  saveBetting(betting);
  return {
    ok: true,
    match,
    pick,
    stake,
    fee: config.betTicketFee,
    pot: book.pot,
    tickets: Object.keys(book.tickets).length,
    balance: coins[userId]!,
  };
}

// Hủy vé — mất trắng (stake ở lại pot, phí vé đã đốt). Chỉ khi kèo còn mở.
export function cancelBet(
  userId: string,
  matchId: number,
): { ok: true; match: WorldCupMatch; ticket: BetTicket } | { ok: false; reason: "not-cancellable" } {
  const match = getMatch(matchId);
  const betting = loadBetting();
  const book = betting.books[String(matchId)];
  const ticket = book?.tickets[userId];
  if (!ticket || !match || !isOpenForBetting(match)) return { ok: false, reason: "not-cancellable" };
  delete book!.tickets[userId]; // stake ở lại pot — không hoàn gì cả
  saveBetting(betting);
  return { ok: true, match, ticket };
}

const worldcup: Command = {
  data: new SlashCommandBuilder()
    .setName("worldcup")
    .setDescription("Kèo World Cup — cá cược vui bằng coin")
    .addSubcommand((sub) => sub.setName("list").setDescription("Các trận đang nhận kèo"))
    .addSubcommand((sub) => sub.setName("cuoc").setDescription("Mua vé cược một trận sắp đá"))
    .addSubcommand((sub) => sub.setName("ve").setDescription("Xem các vé đang giữ"))
    .addSubcommand((sub) => sub.setName("huy").setDescription("Hủy một vé — mất tiền, để mua vé mới"))
    .addSubcommand((sub) =>
      sub.setName("kenh").setDescription("Bật/tắt đăng kết quả kèo vào kênh này (cần quyền Manage Server)"),
    ),

  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "kenh") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "Cần quyền **Manage Server** để chọn kênh thông báo kèo nhé bro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // Shared announce channel (also used by /xoso) — manual override of the
      // auto-detected channel. Toggle: same channel again turns it off.
      const settings = loadSettings(guildId);
      settings.announceChannelId = settings.announceChannelId === interaction.channelId ? null : interaction.channelId;
      saveSettings(guildId, settings);
      await interaction.reply(
        settings.announceChannelId
          ? "📣 Ok! Thông báo của mình (kèo World Cup, xổ số…) sẽ được đăng vào kênh này."
          : "🔕 Đã bỏ ghim kênh thông báo — mình sẽ tự chọn kênh phù hợp. Ghim lại bằng `/worldcup kenh` ở kênh bro muốn.",
      );
      return;
    }

    if (sub === "list") {
      const matches = openMatches().slice(0, 10);
      if (matches.length === 0) {
        await interaction.reply({
          content: "Chưa có trận nào đang nhận kèo — lịch sẽ tự cập nhật, quay lại sau nhé bro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const betting = loadBetting();
      const lines = matches.map((m) => {
        const book = betting.books[String(m.id)];
        const tickets = Object.entries(book?.tickets ?? {});
        const tail = book && book.pot > 0 ? ` · pot 🪙 ${book.pot} (${tickets.length} vé)` : "";
        const bettors =
          tickets.length > 0
            ? `\n└ 🎫 ${tickets
                .slice(0, 8)
                .map(([uid, t]) => `<@${uid}> **${pickLabel(m, t.pick)}** ${t.stake}🪙`)
                .join(" · ")}${tickets.length > 8 ? ` … +${tickets.length - 8} vé nữa` : ""}`
            : "";
        return `**${m.home} vs ${m.away}** — ${STAGE_LABEL[m.stage] ?? m.stage}\n└ ${ts(m, "f")} (${ts(m, "R")})${tail}${bettors}`;
      });
      const body = [
        "## ⚽ Kèo World Cup đang mở",
        lines.join("\n"),
        `-# Mua vé: /worldcup cuoc — phí vé ${config.betTicketFee} coin + tiền cược. Kèo tính kết quả chung cuộc (gồm hiệp phụ & pen), khóa vé khi bóng lăn.`,
      ].join("\n\n");
      const container = new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(text(body));
      await interaction.reply(boardPayload(container));
      return;
    }

    if (sub === "cuoc") {
      const betting = loadBetting();
      const open = openMatches();
      const available = open.filter((m) => !betting.books[String(m.id)]?.tickets[userId]).slice(0, 25);
      if (available.length === 0) {
        await interaction.reply({
          content:
            open.length === 0
              ? "Chưa có trận nào đang nhận kèo — quay lại sau nhé bro."
              : "Bro đã có vé ở mọi trận đang mở rồi — xem lại bằng `/worldcup ve` nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId("worldcup:cuoc")
        .setPlaceholder("Chọn trận muốn cược…")
        .addOptions(
          available.map((m) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${m.home} vs ${m.away}`.slice(0, 100))
              .setDescription(`${VN_TIME.format(m.kickoff)} giờ VN · ${STAGE_LABEL[m.stage] ?? m.stage}`.slice(0, 100))
              .setValue(String(m.id)),
          ),
        );
      await interaction.reply({
        content: `🎫 Chọn trận muốn cược nè bro (phí vé ${config.betTicketFee} 🪙 + tiền cược):`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "ve") {
      const betting = loadBetting();
      const mine = Object.entries(betting.books)
        .filter(([, book]) => book.tickets[userId])
        .map(([matchId, book]) => ({ match: getMatch(Number(matchId)), matchId, book, ticket: book.tickets[userId]! }))
        .sort((a, b) => (a.match?.kickoff ?? 0) - (b.match?.kickoff ?? 0));
      if (mine.length === 0) {
        await interaction.reply({
          content: "Bro chưa có vé nào — làm một vé bằng `/worldcup cuoc` đi!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const lines = mine.map(({ match, matchId, book, ticket }) =>
        match
          ? `🎫 **${match.home} vs ${match.away}** — cược **${pickLabel(match, ticket.pick)}** ${ticket.stake} 🪙 · pot ${book.pot} 🪙 · đá ${ts(match, "R")}`
          : `🎫 Trận #${matchId} — cược ${ticket.stake} 🪙 (đang chờ dữ liệu trận)`,
      );
      const veBody = [
        `## 🎫 Vé của ${interaction.member.displayName}`,
        lines.join("\n"),
        "-# Vé không sửa được — muốn đổi cửa thì /worldcup huy (mất tiền) rồi mua vé mới.",
      ].join("\n");
      const veContainer = new ContainerBuilder().setAccentColor(0xfee75c).addTextDisplayComponents(text(veBody));
      await interaction.reply(boardPayload(veContainer));
      return;
    }

    // huy
    const betting = loadBetting();
    const cancellable = Object.entries(betting.books)
      .map(([matchId, book]) => ({ match: getMatch(Number(matchId)), matchId, ticket: book.tickets[userId] }))
      .filter((e): e is { match: WorldCupMatch; matchId: string; ticket: NonNullable<typeof e.ticket> } =>
        Boolean(e.ticket && e.match && isOpenForBetting(e.match)),
      )
      .slice(0, 25);
    if (cancellable.length === 0) {
      await interaction.reply({
        content: "Không có vé nào còn hủy được — vé khóa khi bóng lăn nhé bro.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId("worldcup:huy")
      .setPlaceholder("Chọn vé muốn hủy…")
      .addOptions(
        cancellable.map(({ match, matchId, ticket }) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${match.home} vs ${match.away} — ${pickLabel(match, ticket.pick)} ${ticket.stake}🪙`.slice(0, 100))
            .setDescription(`${VN_TIME.format(match.kickoff)} giờ VN`.slice(0, 100))
            .setValue(matchId),
        ),
      );
    await interaction.reply({
      content: "⚠️ Chọn vé muốn hủy (hủy là **mất trắng** tiền vé + tiền cược đó nha):",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleSelect(interaction) {
    if (!interaction.inCachedGuild()) return;
    const [, action] = interaction.customId.split(":");
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const matchId = Number(interaction.values[0]);
    const match = getMatch(matchId);

    if (action === "cuoc") {
      if (!match || !isOpenForBetting(match)) {
        await interaction.update({ content: "⏱️ Trận này chốt kèo mất rồi bro — chọn trận khác nhé.", components: [] });
        return;
      }
      const book = loadBetting().books[String(matchId)];
      if (book?.tickets[userId]) {
        await interaction.update({ content: "Bro đã có vé trận này rồi — `/worldcup huy` trước nếu muốn đổi.", components: [] });
        return;
      }
      const buttons = PICKS.filter((pick) => pick !== "DRAW" || match.stage === "GROUP_STAGE").map((pick) =>
        new ButtonBuilder()
          .setCustomId(`worldcup:pick:${matchId}:${pick}`)
          .setLabel(pickLabel(match, pick).slice(0, 80))
          .setEmoji(pick === "DRAW" ? "🤝" : pick === "HOME" ? "🏠" : "✈️")
          .setStyle(ButtonStyle.Primary),
      );
      await interaction.update({
        content: [
          `**${match.home} vs ${match.away}** — ${STAGE_LABEL[match.stage] ?? match.stage} · đá ${ts(match, "f")}`,
          `Pot hiện tại: 🪙 ${book?.pot ?? 0} · kèo tính kết quả chung cuộc (gồm hiệp phụ & pen).`,
          "Bro chọn cửa nào?",
        ].join("\n"),
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
      });
      return;
    }

    if (action === "huy") {
      const ticket = loadBetting().books[String(matchId)]?.tickets[userId];
      if (!ticket || !match || !isOpenForBetting(match)) {
        await interaction.update({ content: "Vé này không còn hủy được nữa bro.", components: [] });
        return;
      }
      const total = ticket.stake + ticket.fee;
      await interaction.update({
        content: [
          `⚠️ Hủy vé **${match.home} vs ${match.away}** (cửa **${pickLabel(match, ticket.pick)}**, cược ${ticket.stake} 🪙)?`,
          `Bro sẽ **mất trắng ${total}** 🪙 (cược + phí vé) — ${ticket.stake} 🪙 ở lại pot cho người thắng. Sau đó mua vé mới thoải mái.`,
        ].join("\n"),
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`worldcup:huyok:${matchId}`)
              .setLabel("Hủy vé, chấp nhận mất tiền")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("worldcup:thoi").setLabel("Thôi, giữ vé").setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }
  },

  async handleButton(interaction) {
    if (!interaction.inCachedGuild()) return;
    const [, action, rawMatchId, rawPick] = interaction.customId.split(":");
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (action === "thoi") {
      await interaction.update({ content: "Ok, giữ vé nhé bro 👍", components: [] });
      return;
    }

    const matchId = Number(rawMatchId);
    const match = getMatch(matchId);

    if (action === "pick") {
      const pick = rawPick as BetPick;
      if (!PICKS.includes(pick)) return;
      if (!match || !isOpenForBetting(match)) {
        await interaction.update({ content: "⏱️ Trận này chốt kèo mất rồi bro.", components: [] });
        return;
      }
      const balance = loadCoins()[userId] ?? 0;
      if (balance < config.betTicketFee + 1) {
        await interaction.update({
          content: `Không đủ coin rồi bro — cần ít nhất ${config.betTicketFee + 1} 🪙 (phí vé ${config.betTicketFee} + cược tối thiểu 1), số dư: ${balance}.`,
          components: [],
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`worldcup:stake:${matchId}:${pick}`)
        // Modal title caps at 45 chars — team names can be long.
        .setTitle(`Cược: ${pickLabel(match, pick)}`.slice(0, 45))
        .addLabelComponents(
          new LabelBuilder()
            .setLabel(`Tiền cược (dư ${balance}, phí vé ${config.betTicketFee})`.slice(0, 45))
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("tiencuoc")
                .setPlaceholder("VD: 50")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(9),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    if (action === "huyok") {
      const result = cancelBet(userId, matchId);
      if (!result.ok) {
        await interaction.update({ content: "Vé này không còn hủy được nữa bro.", components: [] });
        return;
      }
      const { match: m, ticket } = result;
      await interaction.update({
        content: `🗑️ Đã hủy vé **${m.home} vs ${m.away}** — mất ${ticket.stake + ticket.fee} 🪙. Mua vé mới bằng \`/worldcup cuoc\` nhé bro.`,
        components: [],
      });
      // Wizard hủy là ephemeral, nhưng vé rời kèo thì cả kênh cần biết — tỉ lệ chia pot đổi theo.
      const huyBody = `🗑️ <@${userId}> vừa hủy vé **${m.home} vs ${m.away}** (cửa **${pickLabel(m, ticket.pick)}**) — ${ticket.stake} 🪙 nằm lại pot cho người thắng.`;
      await interaction.followUp(boardPayload(new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(huyBody))));
    }
  },

  async handleModal(interaction) {
    // worldcup:stake:<matchId>:<pick>
    const [, action, rawMatchId, rawPick] = interaction.customId.split(":");
    if (action !== "stake" || !interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const pick = rawPick as BetPick;
    if (!PICKS.includes(pick)) return;

    const raw = interaction.fields.getTextInputValue("tiencuoc").trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      await interaction.reply({
        content: `"${raw}" không phải tiền cược hợp lệ bro — nhập số nguyên dương nhé (VD: 50).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const stake = Number(raw);

    const result = placeBet(guildId, userId, Number(rawMatchId), pick, stake);
    if (!result.ok) {
      const content =
        result.reason === "closed"
          ? "⏱️ Trận này chốt kèo mất rồi bro — tiền chưa bị trừ."
          : result.reason === "draw-not-allowed"
            ? "Cửa Hòa chỉ có ở vòng bảng thôi bro — chọn đội thắng nhé."
            : result.reason === "exists"
              ? "Bro đã có vé trận này rồi — mỗi người một vé thôi. `/worldcup huy` nếu muốn đổi."
              : `Không đủ coin rồi bro — cần 🪙 ${result.need} (cược ${stake} + phí vé ${config.betTicketFee}), số dư: ${result.balance}.`;
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    // Công bố trước kênh cho máu — số dư còn lại thì tự xem /coin sodu.
    const match = result.match;
    const betBody = [
      "## 🎫 Vé mới vào kèo",
      `<@${userId}> vừa xuống kèo **${match.home} vs ${match.away}** — đá ${ts(match, "f")} (${ts(match, "R")})`,
      `Cửa: **${pickLabel(match, pick)}** · Cược: **${result.stake}** 🪙 (+${result.fee} 🪙 phí vé)`,
      `Pot hiện tại: 🪙 ${result.pot} (${result.tickets} vé)`,
      "-# Vé không sửa được. Người thắng chia pot theo tỉ lệ cược; không ai trúng thì hoàn tiền cược.",
    ].join("\n");
    const betContainer = new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(text(betBody));
    await interaction.reply(boardPayload(betContainer));
  },
};

export default worldcup;
