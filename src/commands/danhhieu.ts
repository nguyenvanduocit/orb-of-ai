import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { loadCoins, loadTitles, saveCoins, saveTitles, type MemberTitles } from "../economy";
import type { Command } from "../types";

// Catalog cứng — danh hiệu là coin SINK thuần: giá đốt 100%, không vào túi ai.
export const TITLES: { id: string; label: string; price: number; blurb: string }[] = [
  { id: "ga-mo", label: "🐣 Gà Mờ", price: 100, blurb: "Mới vào server, gõ lệnh còn run tay." },
  { id: "dan-choi", label: "😎 Dân Chơi Xóm", price: 250, blurb: "Coin chưa nhiều nhưng thái độ thì dư." },
  { id: "than-noi-tu", label: "⚔️ Thần Nối Từ", price: 400, blurb: "Nối từ tới mức từ điển phải xin thua." },
  { id: "cao-thu-bau-cua", label: "🎲 Cao Thủ Bầu Cua", price: 400, blurb: "Lắc đâu trúng đó, nhà cái thấy là né." },
  { id: "thanh-diem-danh", label: "📿 Thánh Điểm Danh", price: 500, blurb: "Mưa bão động đất gì cũng có mặt điểm danh." },
  { id: "streamer-chan-chinh", label: "📺 Streamer Chân Chính", price: 800, blurb: "Bật Go Live nhiều hơn bật đèn nhà." },
  { id: "de-ruot-orb", label: "🔮 Đệ Ruột Orb", price: 1500, blurb: "Orb nhận làm đệ, hỏi gì cũng được trả lời trước (đùa đấy)." },
  { id: "dai-gia", label: "💎 Đại Gia Phố Coin", price: 2500, blurb: "Mở bảng số dư ra là server lag nhẹ." },
  { id: "trum-server", label: "👑 Trùm Server", price: 5000, blurb: "Đứng trên vạn coin, admin thấy còn phải chào." },
];

const TITLE_CHOICES = TITLES.map((t) => ({ name: `${t.label} — ${t.price} 🪙`, value: t.id }));

// Label của danh hiệu đang đeo (vd "👑 Trùm Server") hoặc "" — /diemdanh
// checkin prepend cái này trước tên member. Đồng bộ, đọc file một lần mỗi lượt
// gọi là ổn vì titles.json rất nhỏ.
export function titleBadge(userId: string): string {
  const equipped = loadTitles()[userId]?.equipped;
  if (!equipped) return "";
  return TITLES.find((t) => t.id === equipped)?.label ?? "";
}

// Bản bulk cho leaderboard (/coin bxh): một lần đọc titles.json cho cả bảng
// thay vì một lần mỗi dòng.
export function titleBadges(userIds: string[]): Map<string, string> {
  const titles = loadTitles();
  const badges = new Map<string, string>();
  for (const userId of userIds) {
    const equipped = titles[userId]?.equipped;
    if (!equipped) continue;
    const label = TITLES.find((t) => t.id === equipped)?.label;
    if (label) badges.set(userId, label);
  }
  return badges;
}

// --- Exported rule cores (like coin's transfer / diemdanh's performCheckin) ---
// Shared by the slash subcommands AND the agent's bot_title_* tools
// (agent-tools.ts) so the buy/equip rules live in exactly one place. Every
// mutation is a synchronous load→check→save block (no await in between) —
// atomic on the event loop, same invariant as every other coin move.

// Shop view: the catalog + this member's ownership/equipped + their balance.
export function titlesShop(
  userId: string,
): { balance: number; titles: { id: string; label: string; price: number; blurb: string; owned: boolean; equipped: boolean }[] } {
  const mine: MemberTitles = loadTitles()[userId] ?? { owned: [], equipped: null };
  const balance = loadCoins()[userId] ?? 0;
  return {
    balance,
    titles: TITLES.map((t) => ({ ...t, owned: mine.owned.includes(t.id), equipped: mine.equipped === t.id })),
  };
}

// A member's own collection — for /danhhieu xem and the agent's view tool.
export function memberTitles(
  userId: string,
): { equipped: { id: string; label: string } | null; owned: { id: string; label: string }[] } {
  const theirs: MemberTitles = loadTitles()[userId] ?? { owned: [], equipped: null };
  const labelOf = (id: string) => TITLES.find((t) => t.id === id)?.label ?? id;
  return {
    equipped: theirs.equipped ? { id: theirs.equipped, label: labelOf(theirs.equipped) } : null,
    owned: theirs.owned.map((id) => ({ id, label: labelOf(id) })),
  };
}

// Mua danh hiệu — giá đốt 100%, không vào túi ai. Auto-đeo nếu chưa đeo gì.
export function buyTitle(
  userId: string,
  id: string,
):
  | { ok: true; id: string; label: string; price: number; balance: number; autoEquipped: boolean }
  | { ok: false; reason: "unknown" }
  | { ok: false; reason: "owned"; label: string }
  | { ok: false; reason: "insufficient"; label: string; price: number; balance: number } {
  const title = TITLES.find((t) => t.id === id);
  if (!title) return { ok: false, reason: "unknown" };
  const titles = loadTitles();
  const mine: MemberTitles = titles[userId] ?? { owned: [], equipped: null };
  if (mine.owned.includes(title.id)) return { ok: false, reason: "owned", label: title.label };
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  if (balance < title.price)
    return { ok: false, reason: "insufficient", label: title.label, price: title.price, balance };
  coins[userId] = balance - title.price; // giá đốt 100% — không cộng cho ai
  mine.owned.push(title.id);
  const autoEquipped = !mine.equipped;
  if (autoEquipped) mine.equipped = title.id;
  titles[userId] = mine;
  saveCoins(coins);
  saveTitles(titles);
  return { ok: true, id: title.id, label: title.label, price: title.price, balance: coins[userId]!, autoEquipped };
}

// Đeo một danh hiệu đã sở hữu.
export function equipTitle(
  userId: string,
  id: string,
):
  | { ok: true; label: string }
  | { ok: false; reason: "unknown" }
  | { ok: false; reason: "not-owned"; label: string } {
  const title = TITLES.find((t) => t.id === id);
  if (!title) return { ok: false, reason: "unknown" };
  const titles = loadTitles();
  const mine: MemberTitles = titles[userId] ?? { owned: [], equipped: null };
  if (!mine.owned.includes(title.id)) return { ok: false, reason: "not-owned", label: title.label };
  mine.equipped = title.id;
  titles[userId] = mine;
  saveTitles(titles);
  return { ok: true, label: title.label };
}

// Tháo danh hiệu đang đeo.
export function unequipTitle(
  userId: string,
): { ok: true; label: string } | { ok: false; reason: "none-equipped" } {
  const titles = loadTitles();
  const mine = titles[userId];
  if (!mine?.equipped) return { ok: false, reason: "none-equipped" };
  const label = TITLES.find((t) => t.id === mine.equipped)?.label ?? mine.equipped;
  mine.equipped = null;
  saveTitles(titles);
  return { ok: true, label };
}

const danhhieu: Command = {
  data: new SlashCommandBuilder()
    .setName("danhhieu")
    .setDescription("Mua & đeo danh hiệu bằng coin — đốt coin lấy số má")
    .addSubcommand((sub) => sub.setName("shop").setDescription("Xem shop danh hiệu"))
    .addSubcommand((sub) =>
      sub
        .setName("mua")
        .setDescription("Mua danh hiệu — coin đốt luôn, không hoàn")
        .addStringOption((opt) =>
          opt
            .setName("danhhieu")
            .setDescription("Danh hiệu muốn mua")
            .setRequired(true)
            .addChoices(...TITLE_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("deo")
        .setDescription("Đeo một danh hiệu đã sở hữu")
        .addStringOption((opt) =>
          opt
            .setName("danhhieu")
            .setDescription("Danh hiệu muốn đeo")
            .setRequired(true)
            .addChoices(...TITLE_CHOICES),
        ),
    )
    .addSubcommand((sub) => sub.setName("thao").setDescription("Tháo danh hiệu đang đeo"))
    .addSubcommand((sub) =>
      sub
        .setName("xem")
        .setDescription("Xem danh hiệu của một người")
        .addUserOption((opt) => opt.setName("user").setDescription("Người muốn xem (bỏ trống = chính bro)")),
    ),
  async execute(interaction, sub = interaction.options.getSubcommand()) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === "shop") {
      const lines = titlesShop(userId).titles.map((t) => {
        const status = t.equipped ? " · 🎯 đang đeo" : t.owned ? " · ✅ đã sở hữu" : "";
        return `**${t.label}** — ${t.price} 🪙${status}\n-# ${t.blurb}`;
      });
      const embed = new EmbedBuilder()
        .setTitle("🏷️ Shop danh hiệu")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Coin đốt luôn, không vào túi ai — flex là chính. Mua bằng /danhhieu mua" })
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "mua") {
      const result = buyTitle(userId, interaction.options.getString("danhhieu", true));
      if (!result.ok) {
        const content =
          result.reason === "unknown"
            ? "Danh hiệu này không tồn tại bro 🤔"
            : result.reason === "owned"
              ? `Bro sở hữu **${result.label}** rồi mà — đeo luôn bằng \`/danhhieu deo\` đi!`
              : `Chưa đủ tiền bro 😅 **${result.label}** giá ${result.price} 🪙 mà ví chỉ có ${result.balance} 🪙.`;
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        return;
      }
      const equippedNote = result.autoEquipped ? "\n-# Chưa đeo gì nên mình đeo luôn cho bro 🎯" : "";
      await interaction.reply(
        `🎉 <@${userId}> vừa đốt ${result.price} 🪙 tậu danh hiệu **${result.label}**!${equippedNote}`,
      );
      return;
    }

    if (sub === "deo") {
      const result = equipTitle(userId, interaction.options.getString("danhhieu", true));
      if (!result.ok) {
        await interaction.reply({
          content:
            result.reason === "unknown"
              ? "Danh hiệu này không tồn tại bro 🤔"
              : `Bro chưa sở hữu **${result.label}** — ghé \`/danhhieu shop\` tậu trước đã!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply(`✨ <@${userId}> giờ là **${result.label}**!`);
      return;
    }

    if (sub === "thao") {
      const result = unequipTitle(userId);
      if (!result.ok) {
        await interaction.reply({
          content: "Bro có đeo danh hiệu nào đâu mà tháo 😅",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `🫥 Đã tháo **${result.label}** — giờ bro là thường dân ẩn danh.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // xem
    const target = interaction.options.getUser("user") ?? interaction.user;
    const theirs = memberTitles(target.id);
    if (theirs.owned.length === 0) {
      await interaction.reply(
        `<@${target.id}> chưa có danh hiệu nào — thường dân chính hiệu 🙂 Ghé \`/danhhieu shop\` đi!`,
      );
      return;
    }
    const equippedLabel = theirs.equipped ? theirs.equipped.label : "(không đeo gì)";
    const ownedLines = theirs.owned.map(({ id, label }) =>
      id === theirs.equipped?.id ? `🎯 ${label}` : `• ${label}`,
    );
    const embed = new EmbedBuilder()
      .setTitle("🏷️ Danh hiệu")
      .setDescription(`<@${target.id}>`)
      .addFields(
        { name: "Đang đeo", value: equippedLabel, inline: false },
        { name: `Bộ sưu tập (${theirs.owned.length})`, value: ownedLines.join("\n"), inline: false },
      )
      .setColor(0xfee75c);
    await interaction.reply({ embeds: [embed] });
  },
};

export default danhhieu;
