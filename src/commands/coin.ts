import {
  ActionRowBuilder,
  ApplicationCommandType,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  ContainerBuilder,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  escapeMarkdown,
  type Guild,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalMessageModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { isBotId } from "../bots";
import { loadCoins, saveCoins } from "../economy";
import { type Beg, displayNames, loadBegs, saveBegs } from "../guilds";
import { forEachGuild, startTicker } from "../scheduler";
import type { Command } from "../types";
import { boardPayload, divider, text } from "../ui";
import { titleBadges } from "./danhhieu";

// Synchronous load→mutate→save — no await in between, so the move is atomic
// on the single-threaded event loop. Shared by /coin tang, the context menu,
// and the agent's bot_coin_transfer tool (agent-tools.ts).
export function transfer(
  fromId: string,
  toId: string,
  amount: number,
):
  | { ok: true; fromBalance: number; toBalance: number }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "recipient-gone" } {
  const coins = loadCoins();
  // Ghost guard, same rule as every payout path (games, nối từ, football, xoso):
  // a recipient without a ledger entry left the server — never resurrect an
  // entry lifecycle cleanup already removed, the coins would be unreachable.
  if (!(toId in coins)) return { ok: false, reason: "recipient-gone" };
  const balance = coins[fromId] ?? 0;
  if (balance < amount) return { ok: false, reason: "insufficient", balance };
  const fromBalance = balance - amount;
  const toBalance = coins[toId]! + amount;
  coins[fromId] = fromBalance;
  coins[toId] = toBalance;
  saveCoins(coins);
  return { ok: true, fromBalance, toBalance };
}

const RECIPIENT_GONE = "Người nhận không còn ví coin ở server này (chắc rời server rồi) — không chuyển được nữa bro.";

// Top 10 số dư — dùng chung bởi /coin bxh và tool bot_leaderboard của agent
// (agent-tools.ts): rule xếp hạng ở đúng một chỗ.
export function coinRanking(): { id: string; balance: number }[] {
  return Object.entries(loadCoins())
    .filter(([id]) => !isBotId(id)) // AI-bot players (src/bots.ts) never rank on the leaderboard
    .map(([id, balance]) => ({ id, balance }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
}

function transferEmbed(
  fromId: string,
  toId: string,
  toName: string,
  amount: number,
  fromBalance: number,
  toBalance: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("💸 Chuyển coin thành công")
    .setDescription(`<@${fromId}> đã tặng **${amount}** coin cho <@${toId}>`)
    .addFields(
      { name: "Số dư của bạn", value: `🪙 ${fromBalance}`, inline: true },
      { name: `Số dư ${toName}`, value: `🪙 ${toBalance}`, inline: true },
    )
    .setColor(0x57f287);
}

// --- Đòi nợ: A ping một người cụ thể kèm số coin, người đó bấm Đồng ý → coin
// chuyển họ → A (có check số dư), Từ chối → đóng. Toàn bộ state nằm trong customId
// nên request sống qua restart, không cần persist. (Ăn xin đi đường riêng bên dưới:
// xin chung theo mốc, ai cũng cho được — không nhắm một người nên không đụng đòi nợ.)
const DOINO = {
  ping: (targetId: string) => `<@${targetId}> ơi, có người đòi nợ nè!`,
  title: "📜 Đòi nợ",
  ask: (requesterId: string, targetId: string, amount: number) =>
    `<@${requesterId}> đòi <@${targetId}> trả **${amount}** coin`,
  reasonPrefix: "Lý do",
  footer: "Chỉ người bị đòi bấm được nút nhé",
  color: 0xed4245,
  acceptLabel: "Đồng ý trả 💸",
  declineLabel: "Từ chối",
  notYourButton: (targetId: string) => `Nợ này của <@${targetId}>, bro không bấm hộ được đâu 😅`,
  settled: "Vụ nợ này xử lý xong rồi bro.",
  declineTitle: "🙅 Từ chối trả nợ",
  declined: (requesterId: string, targetId: string, amount: number) =>
    `<@${targetId}> đã từ chối trả **${amount}** coin cho <@${requesterId}>.`,
  broke: (balance: number, amount: number) =>
    `Bro chỉ còn 🪙 ${balance}, chưa đủ ${amount} để trả. Kiếm thêm coin rồi quay lại bấm nhé!`,
  doneTitle: "💸 Đã trả nợ",
  done: (requesterId: string, targetId: string, amount: number) =>
    `<@${targetId}> đã trả **${amount}** coin cho <@${requesterId}>`,
  requesterBalanceLabel: "Số dư chủ nợ",
};

// Bảng đòi nợ là MỘT tin Components V2 suốt vòng đời (ping → Đồng ý/Từ chối →
// chốt) — nút nằm TRONG container, helper V2 (boardPayload/text/divider) ở ../ui.
function requestContainer(requesterId: string, targetId: string, amount: number, reason: string | null): ContainerBuilder {
  const body = [
    `## ${DOINO.title}`,
    DOINO.ping(targetId),
    DOINO.ask(requesterId, targetId, amount) + (reason ? `\n💬 ${DOINO.reasonPrefix}: ${escapeMarkdown(reason)}` : ""),
    "",
    `-# ${DOINO.footer}`,
  ].join("\n");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`coin:doino:ok:${requesterId}:${targetId}:${amount}`)
      .setLabel(DOINO.acceptLabel)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`coin:doino:no:${requesterId}:${targetId}:${amount}`)
      .setLabel(DOINO.declineLabel)
      .setStyle(ButtonStyle.Danger),
  );
  return new ContainerBuilder()
    .setAccentColor(DOINO.color)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(row);
}

// Payload create cho slash + context menu: V2 message không có field content nên
// mention nằm trong TextDisplay; boardPayload tắt mọi ping (parse: []) nên create
// mở allowedMentions đúng người bị đòi để họ vẫn được nhắc (edit về sau vẫn dùng
// boardPayload thuần → chốt lại không re-ping ai).
function requestPayload(requesterId: string, targetId: string, amount: number, reason: string | null) {
  return {
    ...boardPayload(requestContainer(requesterId, targetId, amount, reason)),
    allowedMentions: { users: [targetId] },
  };
}

// Vẽ kết quả một vụ đòi nợ đã chốt (từ chối / chủ nợ rời server / đã trả) — không nút.
function doinoResultContainer(title: string, body: string, color: number): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(text(`## ${title}\n${body}`));
}

// Message id của các vụ đòi nợ đã chốt. Check + add đồng bộ trước mọi await nên
// hai cú click liên tiếp không thể chuyển tiền hai lần. Chỉ sống trong process —
// an toàn qua restart vì nút của vụ đã chốt luôn bị gỡ khỏi message.
const settledRequests = new Set<string>();

// --- Ăn xin: lời xin coin công khai theo mốc. Người xin đặt goal, AI cũng cho
// được (nút cho nhanh + nút cho tuỳ tâm), đủ mốc là khoá. Mỗi lượt cho chuyển coin
// thẳng người-cho → người-xin (không escrow), state ở begs.json — đọc→trừ→ghi đồng
// bộ nên hai người cho cùng lúc không đua, restart-safe qua deadline + scheduler.
const BEG_QUICK_STEP = 10; // nút "Cho nhanh" cho mỗi lần
const BEG_DURATION_MS = 60 * 60_000; // lời xin mở 1 tiếng — chưa đủ mốc thì scheduler đóng

function relTs(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

// Thanh tiến độ 10 ô. Mention trong embed KHÔNG ping nên liệt kê người cho thoải mái.
function begProgress(collected: number, goal: number): string {
  const slots = 10;
  const filled = goal <= 0 ? slots : Math.max(0, Math.min(slots, Math.round((collected / goal) * slots)));
  return "▰".repeat(filled) + "▱".repeat(slots - filled);
}

function contributorLines(contributors: Record<string, number>): string {
  const entries = Object.entries(contributors).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "*chưa ai cho — làm phước đi bro 🙏*";
  return entries.map(([id, amt]) => `🎁 <@${id}> — **${amt}** 🪙`).join("\n");
}

function begRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("coin:anxin:quick").setLabel(`Cho ${BEG_QUICK_STEP} 🪙`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("coin:anxin:custom").setLabel("Cho tuỳ tâm 💰").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("coin:anxin:close").setLabel("Đóng nón").setStyle(ButtonStyle.Secondary),
  );
}

// Bảng ăn xin là MỘT tin Components V2 suốt vòng đời (mở lời → mỗi lượt cho → khoá/
// đóng) — nút nằm TRONG container, helper V2 (boardPayload/text/divider) ở ../ui.
function begContainer(beg: Beg): ContainerBuilder {
  const pct = beg.goal > 0 ? Math.min(100, Math.floor((beg.collected / beg.goal) * 100)) : 100;
  const body = [
    "## 🥺 Ăn xin coin",
    `<@${beg.beggarId}> đang ngửa nón xin **${beg.goal}** 🪙` + (beg.reason ? `\n💬 ${escapeMarkdown(beg.reason)}` : ""),
    "",
    `${begProgress(beg.collected, beg.goal)}  **${beg.collected}/${beg.goal}** 🪙 (${pct}%)`,
    `⏰ Đóng ${relTs(beg.deadline)}`,
    "",
    contributorLines(beg.contributors),
    "",
    "-# Ai cũng cho được · coin trừ thẳng từ ví người cho · đủ mốc là khoá",
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xeb459e)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(begRow());
}

function begClosedContainer(beg: Beg, outcome: "filled" | "expired" | "closed" | "beggar-gone"): ContainerBuilder {
  const givers = Object.keys(beg.contributors).length;
  const head =
    outcome === "beggar-gone"
      ? `<@${beg.beggarId}> đã rời server — khép lại vụ xin này.`
      : `<@${beg.beggarId}> xin được **${beg.collected}**/${beg.goal} 🪙 từ **${givers}** người hảo tâm.`;
  const title = {
    filled: "🎉 Xin đủ mốc rồi!",
    expired: "⌛ Hết giờ xin",
    closed: "🙏 Đã đóng nón",
    "beggar-gone": "🚪 Người xin rời server",
  }[outcome];
  const body = [`## ${title}`, head, "", contributorLines(beg.contributors)].join("\n");
  return new ContainerBuilder()
    .setAccentColor(outcome === "filled" ? 0x57f287 : 0x99aab5)
    .addTextDisplayComponents(text(body));
}

function begCancelledContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0x99aab5)
    .addTextDisplayComponents(text("## 🥺 Huỷ ăn xin\nCó trục trặc lúc mở lời xin — thử lại nha bro."));
}

// Một lượt cho: đọc→trừ→ghi ĐỒNG BỘ (không await xen giữa) nên hai người cho cùng
// lúc không đua — người sau load lại thấy state đã cập nhật. Cho tối đa phần còn
// thiếu (dư thì bỏ), đủ mốc thì gỡ khỏi store (khoá). Người xin rời server → transfer
// báo recipient-gone → đóng lời xin.
type GiveResult =
  | { ok: true; beg: Beg; given: number; filled: boolean; giverBalance: number; capped: boolean }
  | { ok: false; reason: "gone" | "expired" | "self" }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "beggar-gone"; beg: Beg };

function giveToBeg(guildId: string, channelId: string, messageId: string, giverId: string, requested: number): GiveResult {
  const begs = loadBegs(guildId);
  const beg = begs.begs[channelId];
  if (!beg || beg.messageId !== messageId) return { ok: false, reason: "gone" };
  if (Date.now() > beg.deadline) return { ok: false, reason: "expired" };
  if (giverId === beg.beggarId) return { ok: false, reason: "self" };
  const remaining = beg.goal - beg.collected;
  if (remaining <= 0) return { ok: false, reason: "gone" }; // đã đủ (không nên còn trong store) — guard
  const give = Math.min(requested, remaining);
  const result = transfer(giverId, beg.beggarId, give);
  if (!result.ok) {
    if (result.reason === "recipient-gone") {
      delete begs.begs[channelId];
      saveBegs(guildId, begs);
      return { ok: false, reason: "beggar-gone", beg };
    }
    return { ok: false, reason: "insufficient", balance: result.balance };
  }
  beg.collected += give;
  beg.contributors[giverId] = (beg.contributors[giverId] ?? 0) + give;
  const filled = beg.collected >= beg.goal;
  if (filled) delete begs.begs[channelId]; // đủ mốc → khoá, không còn gì để cho
  saveBegs(guildId, begs);
  return { ok: true, beg, given: give, filled, giverBalance: result.fromBalance, capped: give < requested };
}

// Vẽ kết quả một lượt cho — dùng chung nút "Cho nhanh" (button) và "Cho tuỳ tâm"
// (modal mở từ button, nên interaction.update sửa được ngay message lời xin).
async function renderGive(
  interaction: ButtonInteraction<"cached"> | ModalMessageModalSubmitInteraction<"cached">,
  r: GiveResult,
): Promise<void> {
  if (!r.ok) {
    if (r.reason === "beggar-gone") {
      await interaction.update(boardPayload(begClosedContainer(r.beg, "beggar-gone"))).catch(() => {});
      return;
    }
    const msg =
      r.reason === "self"
        ? "Xin ai chứ tự cho mình chi bro 🤨"
        : r.reason === "expired"
          ? "Hết giờ xin rồi bro ⏰"
          : r.reason === "insufficient"
            ? `Bro chỉ còn 🪙 ${r.balance}, chưa đủ để cho. Kiếm thêm coin đã nhé!`
            : "Vụ xin này đóng rồi bro.";
    await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    return;
  }
  // Coin đã chuyển + ghi sổ (đồng bộ trong giveToBeg) rồi mới tới hiển thị.
  try {
    await interaction.update(boardPayload(r.filled ? begClosedContainer(r.beg, "filled") : begContainer(r.beg)));
  } catch (error) {
    console.error(`[coin] beg give recorded but update failed:`, error);
  }
  const note = r.capped
    ? `🎁 Chỉ cần **${r.given}** nữa là đủ nên mình lấy **${r.given}** 🪙 thôi. Số dư: ${r.giverBalance} 🪙`
    : `🎁 Bro cho **${r.given}** 🪙! Số dư: ${r.giverBalance} 🪙`;
  await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function handleBegButton(interaction: ButtonInteraction<"cached">): Promise<void> {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const sub = interaction.customId.split(":")[2]; // quick | custom | close

  if (sub === "close") {
    const begs = loadBegs(guildId);
    const beg = begs.begs[channelId];
    if (!beg || beg.messageId !== interaction.message.id) {
      await interaction.reply({ content: "Vụ xin này đóng rồi bro.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== beg.beggarId) {
      await interaction.reply({ content: "Chỉ người xin mới đóng nón được nha bro 😅", flags: MessageFlags.Ephemeral });
      return;
    }
    delete begs.begs[channelId];
    saveBegs(guildId, begs);
    await interaction.update(boardPayload(begClosedContainer(beg, "closed")));
    return;
  }

  if (sub === "custom") {
    const beg = loadBegs(guildId).begs[channelId];
    if (!beg || beg.messageId !== interaction.message.id || Date.now() > beg.deadline) {
      await interaction.reply({ content: "Vụ xin này đóng rồi bro.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id === beg.beggarId) {
      await interaction.reply({ content: "Xin ai chứ tự cho mình chi bro 🤨", flags: MessageFlags.Ephemeral });
      return;
    }
    const remaining = beg.goal - beg.collected;
    const modal = new ModalBuilder()
      .setCustomId("coin:anxingive")
      .setTitle("Cho coin")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(`Số coin muốn cho (còn thiếu ${remaining})`.slice(0, 45))
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("soluong")
              .setPlaceholder(`VD: ${remaining}`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(9),
          ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (sub !== "quick") return;
  await renderGive(interaction, giveToBeg(guildId, channelId, interaction.message.id, interaction.user.id, BEG_QUICK_STEP));
}

const coin: Command = {
  data: new SlashCommandBuilder()
    .setName("coin")
    .setDescription("Hệ thống coin của server")
    .addSubcommand((sub) => sub.setName("sodu").setDescription("Xem số dư coin của bạn"))
    .addSubcommand((sub) => sub.setName("bxh").setDescription("Bảng xếp hạng coin"))
    .addSubcommand((sub) =>
      sub
        .setName("tang")
        .setDescription("Tặng coin cho người khác")
        .addUserOption((opt) =>
          opt.setName("nguoinhan").setDescription("Người nhận").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt.setName("soluong").setDescription("Số coin muốn tặng").setMinValue(1).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("doino")
        .setDescription("Đòi nợ người khác — họ bấm Đồng ý là coin tự chuyển")
        .addUserOption((opt) =>
          opt.setName("nguoino").setDescription("Người đang nợ bạn").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt.setName("soluong").setDescription("Số coin đòi").setMinValue(1).setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("lydo").setDescription("Nợ vụ gì").setMaxLength(200),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("anxin")
        .setDescription("Ăn xin coin — đặt mốc, ai cũng cho được, đủ mốc là khoá")
        .addIntegerOption((opt) =>
          opt.setName("soluong").setDescription("Mốc coin muốn xin").setMinValue(1).setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("lydo").setDescription("Lời năn nỉ").setMaxLength(200),
        ),
    ),
  // Right-click a member → Apps → "Chuyển coin" (modal asks the amount) or
  // "Đòi nợ" (modal asks amount + reason, then posts the request). Ăn xin không
  // còn context menu — nó xin chung theo mốc, không nhắm một người cụ thể.
  contextMenus: [
    new ContextMenuCommandBuilder().setName("Chuyển coin").setType(ApplicationCommandType.User),
    new ContextMenuCommandBuilder().setName("Đòi nợ").setType(ApplicationCommandType.User),
  ],
  // Shortcut (/anxin, /tang, ... — shortcuts.ts) truyền sẵn `sub`; gọi trực tiếp
  // /coin thì default param tự getSubcommand().
  async execute(interaction, sub = interaction.options.getSubcommand()) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === "sodu") {
      const balance = loadCoins()[userId] ?? 0;
      const embed = new EmbedBuilder()
        .setTitle("🪙 Số dư coin")
        .setDescription(`<@${userId}> đang có **${balance}** coin`)
        .setColor(0xfee75c);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "bxh") {
      const ranking = coinRanking();
      if (ranking.length === 0) {
        await interaction.reply("Chưa ai có coin cả. Điểm danh kiếm coin đi bro!");
        return;
      }
      await interaction.deferReply();
      const nameOf = await displayNames(interaction.guild, ranking.map((entry) => entry.id));
      const badges = titleBadges(ranking.map((entry) => entry.id));
      const medals = ["🥇", "🥈", "🥉"];
      const lines = ranking.map((entry, i) => {
        const badge = badges.get(entry.id);
        return `${medals[i] ?? `${i + 1}.`} **${escapeMarkdown(nameOf(entry.id))}**${badge ? ` · ${badge}` : ""} — 🪙 ${entry.balance}`;
      });
      const embed = new EmbedBuilder()
        .setTitle("🏆 Bảng xếp hạng coin")
        .setDescription(lines.join("\n"))
        .setColor(0xfee75c);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "doino") {
      const target = interaction.options.getUser("nguoino", true);
      const amount = interaction.options.getInteger("soluong", true);
      const reason = interaction.options.getString("lydo");
      if (target.bot) {
        await interaction.reply({ content: "Bot không nợ ai đâu bro 😅", flags: MessageFlags.Ephemeral });
        return;
      }
      if (target.id === userId) {
        await interaction.reply({ content: "Tự đòi nợ mình chi bro 🤨", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply(requestPayload(userId, target.id, amount, reason));
      return;
    }

    if (sub === "anxin") {
      const goal = interaction.options.getInteger("soluong", true);
      const reason = interaction.options.getString("lydo");
      const channelId = interaction.channelId;

      // Một kênh chỉ một lời xin đang mở — lời xin cũ hết hạn để scheduler dọn.
      const existing = loadBegs(guildId).begs[channelId];
      if (existing && Date.now() <= existing.deadline) {
        await interaction.reply({
          content: "Kênh này đang có người ngửa nón rồi — cho đủ cái đó đã bro 🥺",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Đăng công khai TRƯỚC (reply lỗi thì chưa ghi gì), rồi ghi sổ đồng bộ.
      const beg: Beg = {
        channelId,
        messageId: "",
        beggarId: userId,
        goal,
        collected: 0,
        reason: reason ?? null,
        contributors: {},
        deadline: Date.now() + BEG_DURATION_MS,
      };
      await interaction.reply(boardPayload(begContainer(beg)));
      let message;
      try {
        message = await interaction.fetchReply();
      } catch (error) {
        console.error(`[coin] anxin fetchReply failed in ${channelId}:`, error);
        await interaction.editReply(boardPayload(begCancelledContainer())).catch(() => {});
        return;
      }
      const begs = loadBegs(guildId);
      beg.messageId = message.id;
      begs.begs[channelId] = beg;
      saveBegs(guildId, begs);
      console.log(`[coin] ${userId} opened a beg for ${goal} in ${guildId}/${channelId}`);
      return;
    }

    // tang
    const target = interaction.options.getUser("nguoinhan", true);
    const amount = interaction.options.getInteger("soluong", true);
    if (target.bot) {
      await interaction.reply({ content: "Bot không xài coin đâu bro 😅", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.id === userId) {
      await interaction.reply({ content: "Tự tặng mình chi bro 🤨", flags: MessageFlags.Ephemeral });
      return;
    }

    const result = transfer(userId, target.id, amount);
    if (!result.ok) {
      await interaction.reply({
        content:
          result.reason === "recipient-gone"
            ? RECIPIENT_GONE
            : `Không đủ coin rồi bro — số dư hiện tại: 🪙 ${result.balance}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        transferEmbed(userId, target.id, target.displayName, amount, result.fromBalance, result.toBalance),
      ],
    });
  },
  async handleButton(interaction) {
    if (!interaction.inCachedGuild()) return;
    const parts = interaction.customId.split(":");

    // Ăn xin: coin:anxin:<quick|custom|close>
    if (parts[1] === "anxin") {
      await handleBegButton(interaction);
      return;
    }

    // Đòi nợ: coin:doino:<ok|no>:<requesterId>:<targetId>:<amount>
    const [, action, decision, requesterId, targetId, rawAmount] = parts;
    if (action !== "doino" || !requesterId || !targetId) return;
    const amount = Number(rawAmount);
    if (!Number.isInteger(amount) || amount < 1) return;

    if (interaction.user.id !== targetId) {
      await interaction.reply({ content: DOINO.notYourButton(targetId), flags: MessageFlags.Ephemeral });
      return;
    }
    if (settledRequests.has(interaction.message.id)) {
      await interaction.reply({ content: DOINO.settled, flags: MessageFlags.Ephemeral });
      return;
    }

    if (decision === "no") {
      settledRequests.add(interaction.message.id);
      await interaction.update(
        boardPayload(doinoResultContainer(DOINO.declineTitle, DOINO.declined(requesterId, targetId, amount), 0x99aab5)),
      );
      return;
    }
    if (decision !== "ok") return;

    // Balance check tại thời điểm bấm — transfer() từ chối khi không đủ, không bao giờ âm số dư.
    const result = transfer(targetId, requesterId, amount);
    if (!result.ok) {
      if (result.reason === "recipient-gone") {
        // Chủ nợ rời server rồi — request không thể hoàn thành, khép lại luôn.
        settledRequests.add(interaction.message.id);
        await interaction.update(
          boardPayload(
            doinoResultContainer(
              DOINO.title,
              `🚪 <@${requesterId}> đã rời server — vụ này khép lại, không chuyển coin.`,
              0x99aab5,
            ),
          ),
        );
        return;
      }
      // Chưa đủ tiền thì giữ request mở — kiếm thêm coin rồi bấm lại.
      await interaction.reply({ content: DOINO.broke(result.balance, amount), flags: MessageFlags.Ephemeral });
      return;
    }
    settledRequests.add(interaction.message.id);
    const settledPayload = boardPayload(
      doinoResultContainer(
        DOINO.doneTitle,
        `${DOINO.done(requesterId, targetId, amount)}\n\nSố dư của bạn: 🪙 ${result.fromBalance} · ${DOINO.requesterBalanceLabel}: 🪙 ${result.toBalance}`,
        0x57f287,
      ),
    );
    try {
      await interaction.update(settledPayload);
    } catch {
      // Coin đã chuyển nhưng update fail — nút phải rời khỏi message, không thì
      // sau restart (settledRequests trống) bấm lại là trả tiền LẦN HAI. Edit
      // thẳng message là đường dự phòng; fail nữa thì log để còn dấu vết.
      await interaction.message.edit(settledPayload).catch((error) => {
        console.error(
          `[coin] settled doino ${interaction.message.id} but could not remove buttons — double-accept possible after restart:`,
          error,
        );
      });
    }
  },
  async handleContextMenu(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;

    const isDoino = interaction.commandName === "Đòi nợ";
    const target = interaction.targetUser;
    if (target.bot) {
      await interaction.reply({
        content: isDoino ? "Bot không nợ ai đâu bro 😅" : "Bot không xài coin đâu bro 😅",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: isDoino ? "Tự đòi nợ mình chi bro 🤨" : "Tự tặng mình chi bro 🤨",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (isDoino) {
      const targetName = interaction.targetMember?.displayName ?? target.displayName;
      const modal = new ModalBuilder()
        // Modal title caps at 45 chars — display names can be up to 32.
        .setCustomId(`coin:doino:${target.id}`)
        .setTitle(`Đòi nợ ${targetName}`.slice(0, 45))
        .addLabelComponents(
          new LabelBuilder()
            .setLabel("Số coin đòi")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("soluong")
                .setPlaceholder("VD: 50")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(9),
            ),
          new LabelBuilder()
            .setLabel("Nợ vụ gì (không bắt buộc)")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("lydo")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(200),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    const balance = loadCoins()[interaction.user.id] ?? 0;
    if (balance < 1) {
      await interaction.reply({
        content: "Bạn chưa có coin nào để chuyển — điểm danh kiếm coin đi bro!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetName = interaction.targetMember?.displayName ?? target.displayName;
    const modal = new ModalBuilder()
      // Modal title caps at 45 chars — display names can be up to 32.
      .setCustomId(`coin:transfer:${target.id}`)
      .setTitle(`Chuyển coin cho ${targetName}`.slice(0, 45))
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(`Số coin muốn chuyển (số dư: ${balance})`)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("soluong")
              .setPlaceholder("VD: 50")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(9),
          ),
      );
    await interaction.showModal(modal);
  },
  async handleModal(interaction) {
    if (!interaction.inCachedGuild()) return;
    const parts = interaction.customId.split(":");
    const action = parts[1];

    // Ăn xin — cho tuỳ tâm: coin:anxingive (modal mở từ nút trên chính message lời xin).
    if (action === "anxingive") {
      if (!interaction.isFromMessage()) return; // phải mở từ message mới sửa được nó
      const raw = interaction.fields.getTextInputValue("soluong").trim();
      if (!/^\d+$/.test(raw) || Number(raw) < 1) {
        await interaction.reply({
          content: `"${raw}" không phải số coin hợp lệ bro — nhập số nguyên dương nhé (VD: 50).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await renderGive(
        interaction,
        giveToBeg(interaction.guildId, interaction.channelId, interaction.message.id, interaction.user.id, Number(raw)),
      );
      return;
    }

    // coin:transfer:<targetId> (Chuyển coin) | coin:doino:<targetId> (Đòi nợ)
    const targetId = parts[2];
    if ((action !== "transfer" && action !== "doino") || !targetId) return;

    const raw = interaction.fields.getTextInputValue("soluong").trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      await interaction.reply({
        content: `"${raw}" không phải số coin hợp lệ bro — nhập số nguyên dương nhé (VD: 50).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const amount = Number(raw);

    if (action === "doino") {
      const reason = interaction.fields.getTextInputValue("lydo").trim();
      await interaction.reply(requestPayload(interaction.user.id, targetId, amount, reason || null));
      return;
    }

    const result = transfer(interaction.user.id, targetId, amount);
    if (!result.ok) {
      await interaction.reply({
        content:
          result.reason === "recipient-gone"
            ? RECIPIENT_GONE
            : `Không đủ coin rồi bro — số dư hiện tại: 🪙 ${result.balance}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    await interaction.reply({
      embeds: [
        transferEmbed(
          interaction.user.id,
          targetId,
          member?.displayName ?? "người nhận",
          amount,
          result.fromBalance,
          result.toBalance,
        ),
      ],
    });
  },
};

// Ticker mỗi phút: đóng mọi lời xin đã hết giờ mà chưa đủ mốc (không hoàn gì — quà
// đã trao là xong). startTicker chạy một lần lúc startup nên lời xin lỡ hạn khi bot
// down cũng được chốt; forEachGuild cô lập lỗi từng guild.
export function startBegScheduler(client: Client): void {
  startTicker("begs", 60_000, () => forEachGuild(client, "begs", (guild) => closeExpiredBegs(client, guild)));
}

async function closeExpiredBegs(client: Client, guild: Guild): Promise<void> {
  const now = Date.now();
  for (const [channelId, beg] of Object.entries(loadBegs(guild.id).begs)) {
    if (now <= beg.deadline) continue;
    await closeBeg(client, guild.id, channelId);
  }
}

// Gỡ khỏi store ĐỒNG BỘ trước khi sửa message, nên crash lúc announce không đóng
// hai lần. Chỉ dùng cho đường hết-giờ; đủ mốc / đóng nón tự khép trong handler.
async function closeBeg(client: Client, guildId: string, channelId: string): Promise<void> {
  const begs = loadBegs(guildId);
  const beg = begs.begs[channelId];
  if (!beg) return;
  delete begs.begs[channelId];
  saveBegs(guildId, begs);
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      const message = await channel.messages.fetch(beg.messageId).catch(() => null);
      if (message) await message.edit(boardPayload(begClosedContainer(beg, "expired")));
    }
  } catch (error) {
    console.error(`[coin] beg close announce failed in ${channelId}:`, error);
  }
}

export default coin;
