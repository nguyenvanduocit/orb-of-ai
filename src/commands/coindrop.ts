// /coindrop — admin thả coin cho cả kênh nhặt, kích thích tương tác. KHÔNG đúc
// coin mới: tiền lấy thẳng từ ví người thả (zero-sum, như host-as-banker của bầu
// cua / đua thú) — phần chưa ai nhặt hoàn lại cho người thả khi hết giờ. Chia
// kiểu lì xì: soluong coin thành soluot phần hên xui, mỗi người nhặt một lần.
// Một kênh tối đa một drop đang mở (key theo channelId, state ở drops.json).
// Coin settle đồng bộ TRƯỚC mọi await hiển thị — crash giữa chừng không mất coin.
// Scheduler (startCoinDropScheduler) đóng + hoàn phần dư của drop hết giờ mỗi
// phút; index.ts gọi lúc startup nên drop lỡ hạn khi bot down cũng được chốt.

import type { Client, Guild } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { loadCoins, saveCoins } from "../economy";
import { type CoinDrop, loadDrops, saveDrops } from "../guilds";
import { forEachGuild, startTicker } from "../scheduler";
import type { Command } from "../types";
import { boardPayload, divider, text } from "../ui";

export const DROP_DURATION_MS = 5 * 60_000; // drop mở 5 phút — chỉnh ở đây
export const DEFAULT_PACKETS = 5;
export const MAX_PACKETS = 20; // giữ embed gọn + số lượt hợp lý

// Pure core: chia `total` thành đúng `packets` phần, mỗi phần ≥ 1, tổng == total
// (kiểu lì xì — người nhiều người ít). Yêu cầu total ≥ packets ≥ 1. Trần "gấp
// đôi trung bình" cho cảm giác hên xui mà không ai bị 0; phần cuối ôm phần dư.
export function splitLixi(total: number, packets: number): number[] {
  const shares: number[] = [];
  let coinsLeft = total;
  let packetsLeft = packets;
  while (packetsLeft > 1) {
    const maxShare = coinsLeft - (packetsLeft - 1); // chừa ≥1 cho mỗi phần còn lại
    const cap = Math.max(1, Math.min(maxShare, Math.floor((coinsLeft / packetsLeft) * 2)));
    const share = 1 + Math.floor(Math.random() * cap); // 1..cap
    shares.push(share);
    coinsLeft -= share;
    packetsLeft -= 1;
  }
  shares.push(coinsLeft); // phần cuối ôm trọn phần dư
  return shares;
}

function relTs(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

// Mention trong embed KHÔNG ping — an toàn để liệt kê người nhặt mà không spam.
function grabberLines(grabs: Record<string, number>): string {
  const entries = Object.entries(grabs).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "*chưa ai nhặt — nhanh tay!*";
  return entries.map(([id, amt]) => `<@${id}> — **${amt}** 🪙`).join("\n");
}

function grabRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("coindrop:grab").setLabel("Nhặt 🧧").setStyle(ButtonStyle.Success),
  );
}

function liveContainer(drop: CoinDrop): ContainerBuilder {
  const total = Object.keys(drop.grabs).length + drop.remaining.length;
  const body = [
    `## 🧧 Có người thả coin!`,
    `<@${drop.hostId}> vừa thả **${drop.total}** 🪙 thành **${total}** phần lì xì!`,
    `🎁 Còn **${drop.remaining.length}**/${total} phần — nhanh tay nhặt, hên xui!`,
    `⏰ Đóng ${relTs(drop.deadline)}`,
    "",
    grabberLines(drop.grabs),
    "",
    `-# Mỗi người nhặt 1 lần · coin lấy từ ví người thả · phần dư hoàn lại khi hết giờ`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(grabRow());
}

function closedContainer(drop: CoinDrop, remainder: number): ContainerBuilder {
  const distributed = Object.values(drop.grabs).reduce((sum, amt) => sum + amt, 0);
  const grabbers = Object.keys(drop.grabs).length;
  const body = [
    remainder > 0 ? `## 🧧 Hết giờ — chốt sổ` : `## 🧧 Đã nhặt sạch!`,
    `<@${drop.hostId}> thả **${drop.total}** 🪙 · **${grabbers}** người nhặt **${distributed}** 🪙`,
    remainder > 0 ? `↩️ **${remainder}** 🪙 chưa ai nhặt — hoàn lại cho <@${drop.hostId}>` : "",
    "",
    grabberLines(drop.grabs),
  ]
    .filter(Boolean)
    .join("\n");
  return new ContainerBuilder()
    .setAccentColor(remainder > 0 ? 0x99aab5 : 0x57f287)
    .addTextDisplayComponents(text(body));
}

function cancelledContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0x99aab5)
    .addTextDisplayComponents(
      text("## 🧧 Huỷ thả coin\nSố dư vừa thay đổi, không đủ coin để thả nữa — thử lại nha bro."),
    );
}

const coindrop: Command = {
  data: new SlashCommandBuilder()
    .setName("coindrop")
    .setDescription("Thả coin cho cả kênh nhặt — kích thích tương tác (chỉ admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt
        .setName("soluong")
        .setDescription("Tổng số coin muốn thả (lấy từ ví của bạn)")
        .setMinValue(1)
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("soluot")
        .setDescription(`Số phần chia ra (mặc định ${DEFAULT_PACKETS}, tối đa ${MAX_PACKETS})`)
        .setMinValue(1)
        .setMaxValue(MAX_PACKETS),
    ),

  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const hostId = interaction.user.id;

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "Chỉ admin (quyền **Manage Server**) mới thả coin được nha bro.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const total = interaction.options.getInteger("soluong", true);
    const packets = interaction.options.getInteger("soluot") ?? DEFAULT_PACKETS;
    if (total < packets) {
      await interaction.reply({
        content: `Mỗi phần cần ít nhất 1 🪙 — thả **${packets}** phần thì cần tối thiểu **${packets}** 🪙, hoặc giảm số phần lại bro.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Một kênh chỉ một drop đang mở — drop cũ hết hạn sẽ được scheduler dọn.
    const existing = loadDrops(guildId).drops[channelId];
    if (existing && Date.now() <= existing.deadline) {
      await interaction.reply({
        content: "Kênh này đang có drop mở rồi — nhặt xong cái đó đã bro 🧧",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const balance = loadCoins()[hostId] ?? 0;
    if (balance < total) {
      await interaction.reply({
        content: `Ví bro chỉ có **${balance}** 🪙, thả **${total}** không nổi — coin thả lấy từ ví của bro mà 😅`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Đăng drop công khai TRƯỚC (reply lỗi thì chưa trừ coin, không mất gì), rồi
    // escrow + ghi sổ đồng bộ.
    const drop: CoinDrop = {
      channelId,
      messageId: "",
      hostId,
      total,
      remaining: splitLixi(total, packets),
      grabs: {},
      deadline: Date.now() + DROP_DURATION_MS,
    };
    await interaction.reply(boardPayload(liveContainer(drop)));
    let message;
    try {
      message = await interaction.fetchReply();
    } catch (error) {
      console.error(`[coindrop] fetchReply failed in ${channelId}:`, error);
      await interaction.editReply(boardPayload(cancelledContainer())).catch(() => {});
      return;
    }

    // Escrow + persist: đọc→trừ→ghi đồng bộ, không await xen giữa. Re-check số dư
    // vì có await (reply/fetch) ở trên — host có thể vừa tiêu coin chỗ khác.
    const coins = loadCoins();
    const bal = coins[hostId] ?? 0;
    if (bal < total) {
      await interaction.editReply(boardPayload(cancelledContainer())).catch(() => {});
      return;
    }
    coins[hostId] = bal - total;
    saveCoins(coins);
    const drops = loadDrops(guildId);
    drop.messageId = message.id;
    drops.drops[channelId] = drop;
    saveDrops(guildId, drops);
    console.log(`[coindrop] ${hostId} dropped ${total} into ${packets} packets in ${guildId}/${channelId}`);
  },

  async handleButton(interaction) {
    if (interaction.customId !== "coindrop:grab" || !interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;

    const drops = loadDrops(guildId);
    const drop = drops.drops[channelId];
    // Guards đọc-thuần: reply ephemeral + return, chưa đụng vào state.
    if (!drop || drop.messageId !== interaction.message.id) {
      await interaction.reply({ content: "Drop này đóng rồi bro 🧧", flags: MessageFlags.Ephemeral });
      return;
    }
    if (Date.now() > drop.deadline) {
      await interaction.reply({
        content: "Hết giờ nhặt rồi bro — chờ mình chốt sổ chút nha ⏰",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (userId === drop.hostId) {
      await interaction.reply({ content: "Bro là người thả mà 😄 để anh em nhặt chứ!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (userId in drop.grabs) {
      await interaction.reply({
        content: `Bro nhặt **${drop.grabs[userId]}** 🪙 rồi, tham gì 😜`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (drop.remaining.length === 0) {
      await interaction.reply({ content: "Hết phần mất rồi bro, chậm tay quá 😅", flags: MessageFlags.Ephemeral });
      return;
    }

    // Guards qua hết → mutate + save ĐỒNG BỘ (không await xen giữa) nên hai cú
    // click không thể nhặt hai lần: click sau load lại thấy state đã cập nhật.
    const share = drop.remaining.pop()!;
    drop.grabs[userId] = share;
    const claimedAll = drop.remaining.length === 0;
    if (claimedAll) delete drops.drops[channelId]; // hết phần → drop đóng, không còn dư để hoàn
    saveDrops(guildId, drops);
    const coins = loadCoins();
    const newBalance = (coins[userId] ?? 0) + share;
    coins[userId] = newBalance;
    saveCoins(coins);

    // Coin đã vào ví + ghi sổ (crash-safe) rồi mới tới hiển thị.
    try {
      await interaction.update(boardPayload(claimedAll ? closedContainer(drop, 0) : liveContainer(drop)));
    } catch (error) {
      // Coin đã trả rồi — update fail chỉ làm bảng cũ, lần nhặt sau vẽ lại từ state.
      console.error(`[coindrop] grab recorded but update failed in ${channelId}:`, error);
    }
    await interaction
      .followUp({ content: `🎉 Bro nhặt được **${share}** 🪙! Số dư: ${newBalance} 🪙`, flags: MessageFlags.Ephemeral })
      .catch(() => {});
  },
};

// Đóng drop hết giờ: gỡ khỏi store + hoàn phần dư cho host (ghost-guarded) ĐỒNG
// BỘ trước khi sửa message, nên crash lúc announce không hoàn hai lần. Chỉ dùng
// cho đường hết-giờ; đường nhặt-sạch tự đóng trong handleButton.
async function closeDrop(client: Client, guildId: string, channelId: string): Promise<void> {
  const drops = loadDrops(guildId);
  const drop = drops.drops[channelId];
  if (!drop) return;
  const remainder = drop.remaining.reduce((sum, amt) => sum + amt, 0);
  delete drops.drops[channelId];
  saveDrops(guildId, drops);
  if (remainder > 0) {
    const coins = loadCoins();
    // Ghost guard: host còn trong ledger mới hoàn — rời server rồi thì phần dư
    // coi như mất, không hồi sinh ví đã bị lifecycle cleanup xoá.
    if (drop.hostId in coins) {
      coins[drop.hostId] = (coins[drop.hostId] ?? 0) + remainder;
      saveCoins(coins);
    }
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      const message = await channel.messages.fetch(drop.messageId).catch(() => null);
      if (message) await message.edit(boardPayload(closedContainer(drop, remainder)));
    }
  } catch (error) {
    console.error(`[coindrop] close announce failed in ${channelId}:`, error);
  }
}

// Ticker mỗi phút: chốt sổ mọi drop đã hết giờ. startTicker chạy một lần lúc
// startup nên drop lỡ hạn khi bot down cũng được hoàn phần dư; forEachGuild cô
// lập lỗi từng guild.
export function startCoinDropScheduler(client: Client): void {
  startTicker("coindrop", 60_000, () => forEachGuild(client, "coindrop", (guild) => closeExpiredDrops(client, guild)));
}

async function closeExpiredDrops(client: Client, guild: Guild): Promise<void> {
  const now = Date.now();
  for (const [channelId, drop] of Object.entries(loadDrops(guild.id).drops)) {
    if (now < drop.deadline) continue;
    await closeDrop(client, guild.id, channelId);
  }
}

export default coindrop;
