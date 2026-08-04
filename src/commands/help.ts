import {
  ApplicationCommandType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "../config";
import type { Command } from "../types";
import { CHECKIN_SCHEDULE, CYCLE_LEN, fmtCoins } from "./diemdanh";
// Import cycle with the registry (index.ts imports help, help reads it) is
// safe: the catalogs are only called inside execute(), after both modules
// have finished evaluating.
import { commandCatalog, contextMenuCatalog } from "./index";

// The /help embed, built from the live registry so the list never drifts:
// seasonal commands (/worldcup) only show while enabled, new commands appear
// automatically. Exported so the onboarding welcome's 📖 button (onboarding.ts)
// renders the exact same help without hand-duplicating the command list.
export function buildHelpEmbed(): EmbedBuilder {
  const lines = commandCatalog().map(({ usage, description }) => `\`${usage}\` — ${description}`);

  const embed = new EmbedBuilder()
    .setTitle(`📖 Hướng dẫn ${config.botUsername}`)
    .setColor(0x5865f2)
    .setDescription(
      [
        `📚 **[Cẩm nang đầy đủ](${config.wikiUrl})** — luật chơi mọi minigame, tỉ lệ trả thưởng, và toàn bộ Cửa Ải (tỉ lệ rơi đồ, bậc dòng phụ, tỉ lệ cường hóa). Không giấu con số nào.`,
        "",
        "💬 **Chat với AI** — mention mình hoặc reply tin nhắn của mình là mình trả lời. Mỗi kênh là một cuộc hội thoại riêng, dùng `/clear` để làm mới.",
        "",
        "⌨️ **Lệnh**",
        ...lines,
      ].join("\n"),
    );

  const names = (type: ApplicationCommandType) =>
    contextMenuCatalog(type).map((name) => `**${name}**`).join(" / ");
  const userMenus = names(ApplicationCommandType.User);
  const messageMenus = names(ApplicationCommandType.Message);
  const appLines = [
    ...(userMenus ? [`Chuột phải một thành viên → Apps → ${userMenus}.`] : []),
    ...(messageMenus ? [`Chuột phải một tin nhắn → Apps → ${messageMenus}.`] : []),
  ];
  if (appLines.length > 0) {
    embed.addFields({ name: "🖱️ Apps", value: appLines.join("\n") });
  }

  embed.addFields({
    name: "🪙 Kiếm coin",
    value: `Ví của bro dùng chung ở mọi server có mình — cày bên này tiêu bên kia • lần đầu gặp mình có sẵn ${config.startingCoins} 🪙 (một lần thôi) • điểm danh mỗi ngày thưởng tăng theo chuỗi (🪙 ${fmtCoins(CHECKIN_SCHEDULE[0])} → ${fmtCoins(CHECKIN_SCHEDULE[CYCLE_LEN - 1])}, ngày ${CYCLE_LEN} 👑 đại thưởng, đứt chuỗi về ngày 1) • Go Live +${config.streamCoinsPerBlock} 🪙, ngồi voice cùng người khác +${config.voiceCoinsPerBlock} 🪙 mỗi ${config.streamBlockMinutes} phút • thắng minigame cũng có thưởng.`,
  });

  return embed;
}

const help: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Xem hướng dẫn: các lệnh và tính năng của bot"),
  async execute(interaction) {
    await interaction.reply({ embeds: [buildHelpEmbed()], flags: MessageFlags.Ephemeral });
  },
};

export default help;
