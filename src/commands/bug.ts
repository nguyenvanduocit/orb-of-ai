// /bug — người chơi báo lỗi của bot, dev đọc lại ở cùng một chỗ.
//
// Ba mặt: `baocao` mở modal (tiêu đề + mô tả + bước tái hiện — modal vì mô tả
// lỗi cần ô nhiều dòng, option của slash command thì không), `list` liệt kê,
// `xem` mở chi tiết một mã. Ai cũng gửi và xem được — báo trùng một lỗi là thứ
// duy nhất cần tránh, mà muốn tránh thì danh sách phải công khai; chỉ việc ĐỔI
// TRẠNG THÁI mới cần quyền Manage Server (chặn cả ở lúc vẽ nút lẫn lúc bấm).
//
// Sổ nằm ở src/bugs.ts (global, tự dọn khi ghi). File này chỉ lo hiển thị.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  type BugFilter,
  type BugReport,
  type BugStatus,
  bugCounts,
  DETAIL_MAX,
  findBug,
  listBugs,
  MAX_OPEN_PER_USER,
  reportBug,
  STEPS_MAX,
  TITLE_MAX,
  updateBugStatus,
} from "../bugs";
import type { Command } from "../types";
import { divider, privateBoardPayload, text } from "../ui";

const LIST_LIMIT = 10; // /bug list hiển thị tối đa 10 báo cáo mới nhất

const STATUS: Record<BugStatus, { emoji: string; label: string; color: number }> = {
  moi: { emoji: "🆕", label: "Mới", color: 0xfee75c },
  dangxem: { emoji: "🔎", label: "Đang xem", color: 0x5865f2 },
  dasua: { emoji: "✅", label: "Đã sửa", color: 0x57f287 },
  boqua: { emoji: "🚫", label: "Bỏ qua", color: 0x99aab5 },
};

// Mọi trạng thái trừ cái đang mang → tối đa 3 nút, vừa một hàng. "Mở lại" có mặt
// để một bản vá hụt không kẹt cái lỗi ở trạng thái đã sửa.
const ACTIONS: { status: BugStatus; label: string; style: ButtonStyle }[] = [
  { status: "dangxem", label: "🔎 Đang xem", style: ButtonStyle.Primary },
  { status: "dasua", label: "✅ Đã sửa", style: ButtonStyle.Success },
  { status: "boqua", label: "🚫 Bỏ qua", style: ButtonStyle.Secondary },
  { status: "moi", label: "🆕 Mở lại", style: ButtonStyle.Secondary },
];

function code(id: number): string {
  return `BUG-${String(id).padStart(3, "0")}`;
}

// Modal báo lỗi. Mô tả + bước tái hiện là ô nhiều dòng (Paragraph) — thứ mà
// option của slash command không làm được, và cũng là lý do lệnh này đi qua modal.
// Exported để smoke-test dựng được nó ngoài Discord: modal dựng sai thì chỉ vỡ
// đúng lúc người ta bấm nút, không test nào khác bắt kịp.
export function reportModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("bug:new")
    .setTitle("Báo lỗi cho dev")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Lỗi gì (một câu ngắn)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("tieude")
            .setPlaceholder("VD: /baucua không trả coin khi thắng")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(TITLE_MAX),
        ),
      new LabelBuilder()
        .setLabel("Mô tả — bro thấy gì, đáng lẽ phải thế nào")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("mota")
            .setPlaceholder("Cược 30 🪙 vào con cua, ra 2 con cua mà số dư không đổi.")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(DETAIL_MAX),
        ),
      new LabelBuilder()
        .setLabel("Bước tái hiện (không bắt buộc)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("taihien")
            .setPlaceholder("1. /baucua\n2. Bấm 🦀 ba lần\n3. Chủ bàn bấm Xóc")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(STEPS_MAX),
        ),
    );
}

function ts(ms: number, style: "f" | "R"): string {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

function adminRow(report: BugReport): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ACTIONS.filter((action) => action.status !== report.status).map((action) =>
      new ButtonBuilder()
        .setCustomId(`bug:status:${report.id}:${action.status}`)
        .setLabel(action.label)
        .setStyle(action.style),
    ),
  );
}

// Thẻ chi tiết. Mention trong V2 TextDisplay vốn ping, nhưng privateBoardPayload
// đã tắt sạch (parse: []) nên gọi tên người báo thoải mái.
function detailContainer(report: BugReport, isAdmin: boolean): ContainerBuilder {
  const meta = STATUS[report.status];
  const body = [
    `## ${meta.emoji} ${code(report.id)} — ${report.title}`,
    `**Trạng thái:** ${meta.emoji} ${meta.label}${
      report.handledBy ? ` — <@${report.handledBy}> cập nhật ${ts(report.handledAt ?? report.at, "R")}` : ""
    }`,
    `**Người báo:** <@${report.reporterId}> · ${ts(report.at, "f")}`,
    "",
    "### 📝 Mô tả",
    report.detail,
    ...(report.steps ? ["", "### 🔁 Bước tái hiện", report.steps] : []),
    ...(report.channelId ? ["", `-# Phát hiện tại <#${report.channelId}>`] : []),
  ].join("\n");

  const container = new ContainerBuilder().setAccentColor(meta.color).addTextDisplayComponents(text(body));
  if (isAdmin) container.addSeparatorComponents(divider()).addActionRowComponents(adminRow(report));
  return container;
}

function listEmbed(reports: BugReport[], filter: BugFilter): EmbedBuilder {
  const counts = bugCounts();
  const titles: Record<BugFilter, string> = {
    mo: "🐛 Lỗi đang mở",
    dasua: "✅ Lỗi đã sửa",
    boqua: "🚫 Lỗi bỏ qua",
    tatca: "🐛 Tất cả báo cáo lỗi",
  };
  const lines = reports
    .slice(0, LIST_LIMIT)
    .map(
      (report) =>
        `${STATUS[report.status].emoji} \`${code(report.id)}\` **${report.title}** — <@${report.reporterId}> · ${ts(report.at, "R")}`,
    );
  if (reports.length > LIST_LIMIT) lines.push(`-# …và ${reports.length - LIST_LIMIT} báo cáo nữa`);

  return new EmbedBuilder()
    .setTitle(titles[filter])
    .setColor(0xed4245)
    .setDescription(lines.join("\n"))
    .setFooter({
      text: `🆕 ${counts.moi} mới · 🔎 ${counts.dangxem} đang xem · ✅ ${counts.dasua} đã sửa · 🚫 ${counts.boqua} bỏ qua — xem chi tiết: /bug xem ma:<số>`,
    });
}

const bug: Command = {
  data: new SlashCommandBuilder()
    .setName("bug")
    .setDescription("Báo lỗi của bot cho dev, và xem các lỗi đã được báo")
    .addSubcommand((sub) => sub.setName("baocao").setDescription("Báo một lỗi bạn gặp phải"))
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Xem danh sách lỗi đã báo")
        .addStringOption((opt) =>
          opt
            .setName("trangthai")
            .setDescription("Lọc theo trạng thái (mặc định: đang mở)")
            .addChoices(
              { name: "Đang mở", value: "mo" },
              { name: "Đã sửa", value: "dasua" },
              { name: "Bỏ qua", value: "boqua" },
              { name: "Tất cả", value: "tatca" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("xem")
        .setDescription("Xem chi tiết một báo cáo lỗi")
        .addIntegerOption((opt) =>
          opt.setName("ma").setDescription("Mã báo cáo, VD: 14 (lấy từ /bug list)").setMinValue(1).setRequired(true),
        ),
    ),

  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "baocao") {
      await interaction.showModal(reportModal());
      return;
    }

    if (sub === "list") {
      const filter = (interaction.options.getString("trangthai") ?? "mo") as BugFilter;
      const reports = listBugs(filter);
      if (reports.length === 0) {
        await interaction.reply({
          content:
            filter === "mo"
              ? "🎉 Không có lỗi nào đang mở — bot đang ngon lành. Gặp lỗi thì `/bug baocao` nha bro."
              : "Chưa có báo cáo nào ở mục này bro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ embeds: [listEmbed(reports, filter)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub !== "xem") return;
    const id = interaction.options.getInteger("ma", true);
    const report = findBug(id);
    if (!report) {
      await interaction.reply({
        content: `Không tìm thấy \`${code(id)}\` — xem mã đúng ở \`/bug list\` nha bro. (Báo cáo đã đóng lâu ngày sẽ được dọn đi.)`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
    await interaction.reply(privateBoardPayload(detailContainer(report, isAdmin)));
  },

  async handleModal(interaction) {
    if (interaction.customId !== "bug:new" || !interaction.inCachedGuild()) return;
    const steps = interaction.fields.getTextInputValue("taihien").trim();
    const result = reportBug({
      reporterId: interaction.user.id,
      guildId: interaction.guildId,
      // Modal submit về lý thuyết có thể không mang kênh; thiếu thì bỏ trống và
      // thẻ chi tiết giấu luôn dòng "phát hiện tại" thay vì vẽ link kênh rỗng.
      channelId: interaction.channelId ?? "",
      title: interaction.fields.getTextInputValue("tieude").trim(),
      detail: interaction.fields.getTextInputValue("mota").trim(),
      steps: steps || null,
    });

    if (!result.ok) {
      await interaction.reply({
        content:
          result.reason === "cooldown"
            ? `Từ từ thôi bro 😅 gửi báo cáo tiếp theo được ${ts(result.retryAt, "R")}.`
            : `Bro đang có **${result.open}** báo cáo chưa xử lý (tối đa ${MAX_OPEN_PER_USER}) — chờ dev ngó qua đã nha.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { report } = result;
    // Log ra stdout luôn: `bun run logs` là đường ngắn nhất để dev thấy lỗi mới
    // ngay khi nó vừa được báo, khỏi phải đi hỏi sổ.
    console.log(
      `[bug] ${code(report.id)} from ${report.reporterId} in ${report.guildId}/${report.channelId}: ${report.title}`,
    );
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🐛 Đã ghi nhận ${code(report.id)}`)
          .setColor(0x57f287)
          .setDescription(
            [
              `**${report.title}**`,
              "",
              "Cảm ơn bro! Dev sẽ đọc báo cáo này.",
              `Theo dõi bằng \`/bug xem ma:${report.id}\` — trạng thái đổi khi dev xử lý.`,
            ].join("\n"),
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction) {
    const [, action, rawId, status] = interaction.customId.split(":");
    if (action !== "status" || !rawId || !status || !interaction.inCachedGuild()) return;

    // Nút chỉ được vẽ cho admin, nhưng vẫn chặn lại ở đây: message ephemeral cũ
    // vẫn còn nút sau khi quyền bị gỡ.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "Cần quyền **Manage Server** để đổi trạng thái báo cáo nha bro.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const report = updateBugStatus(Number(rawId), status as BugStatus, interaction.user.id);
    if (!report) {
      await interaction.reply({ content: "Báo cáo này không còn trong sổ nữa bro.", flags: MessageFlags.Ephemeral });
      return;
    }
    console.log(`[bug] ${code(report.id)} → ${report.status} by ${interaction.user.id}`);
    await interaction.update(privateBoardPayload(detailContainer(report, true)));
  },
};

export default bug;
