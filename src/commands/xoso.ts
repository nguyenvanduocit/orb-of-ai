// /xoso — xổ số coin, coin SINK có chủ đích: mỗi số 10 🪙 thì chỉ 7 vào hũ,
// 3 bị ĐỐT vĩnh viễn. Vé = GIÀNH một số 00–99, mỗi số đúng một chủ mỗi vòng
// — số đẹp là của hiếm, ai nhanh tay thì được. Vòng mở khi có vé đầu tiên và
// quay sau đúng DRAW_DELAY_MS (1 tiếng): rút một số ĐÃ BÁN nên vòng nào có vé
// là chắc chắn có người ôm trọn hũ. Kết quả đăng lại ở CHÍNH kênh mở vòng (nơi
// có vé đầu, lưu ở lottery.channelId) để đúng chỗ mọi người chơi — trừ khi admin
// ghim kênh khác bằng /xoso kenh. Không ai mua (hoặc chỉ toàn số của người
// đã rời server) → hũ dồn qua vòng sau, drawAt về 0 chờ vé kế. Store per-guild:
// lottery.json (loadLottery/saveLottery trong ../guilds); mọi coin move là load
// → mutate → save đồng bộ, không await xen giữa — atomic trên event loop như
// mọi nơi khác. Scheduler (startLotteryScheduler) được index.ts gọi lúc
// startup, tick mỗi phút.

import type { Client, Guild, Message } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { loadCoins, loadLottery, saveCoins, saveLottery, type LotteryDraw, type LotteryStore } from "../economy";
import { loadSettings, resolveAnnounceChannel, saveSettings } from "../guilds";
import { forEachGuild, sleep, startTicker } from "../scheduler";
import type { Command } from "../types";

export const TICKET_PRICE = 10; // mỗi số: 7 vào hũ, 3 đốt — đó là điểm sink
export const JACKPOT_CUT = 7;
export const MAX_NUMBERS_PER_ROUND = 10;
const NUMBER_POOL = 100; // 00–99
export const DRAW_DELAY_MS = 60 * 60_000; // vòng quay 1 tiếng sau vé đầu tiên — chỉnh ở đây
const HISTORY_LIMIT = 20; // giữ 20 kỳ quay gần nhất — ring có cận, không phình vô hạn
const HISTORY_SHOWN = 10; // /xoso lichsu hiển thị tối đa 10 kỳ mới nhất

function drawTs(drawAt: number, style: "f" | "R"): string {
  return `<t:${Math.floor(drawAt / 1000)}:${style}>`;
}

// Pure core: "68 07", "68,7", "8" → [68, 7] (dedup); ký tự lạ/ngoài 0–99 → null.
export function parseNumbers(input: string): number[] | null {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,2}$/.test(part)) return null;
    nums.push(Number(part));
  }
  return [...new Set(nums)];
}

function fmt(n: number): string {
  return String(n).padStart(2, "0");
}

const DIGIT_EMOJI = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

function emojiNumber(n: number): string {
  return [...fmt(n)].map((d) => DIGIT_EMOJI[Number(d)]).join("");
}

// Màn quay số kiểu máy slot: bi lăn qua vài số ngẫu nhiên, chậm dần rồi dừng
// ở số trúng. Thuần theater — winner đã được trả & vòng đã reset đồng bộ trước
// khi announce, nên hiccup giữa chừng không mất gì.
const SPIN_DELAYS = [350, 400, 480, 600, 780]; // chậm dần → cảm giác bi đang dừng
function spinEmbed(n: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🎰 Đang quay số...")
    .setDescription([`# 🎰 ${emojiNumber(n)} 🎰`, "*bi lăn... bi lăn...*"].join("\n"))
    .setColor(0xed4245);
}
const randNumber = (): number => Math.floor(Math.random() * NUMBER_POOL);

function ownerOf(tickets: LotteryStore["tickets"], n: number): string | null {
  for (const [uid, nums] of Object.entries(tickets)) if (nums.includes(n)) return uid;
  return null;
}

function soldNumbers(tickets: LotteryStore["tickets"]): number {
  return Object.values(tickets).reduce((sum, nums) => sum + nums.length, 0);
}

// --- Exported rule cores (like coin's transfer / diemdanh's performCheckin) ---
// Shared by the /xoso subcommands AND the agent's bot_lottery_* tools
// (agent-tools.ts). buyLottery is one synchronous load→validate→mutate→save
// block — atomic on the event loop, identical invariant to every coin move.

// Giành số: opts.numbers = số cụ thể (đã parse), opts.count = mua N số ngẫu nhiên.
// channelId = kênh mở vòng (nơi đăng kết quả) — bỏ trống thì scheduler tự chọn kênh.
export function buyLottery(
  guildId: string,
  userId: string,
  opts: { numbers?: number[]; count?: number },
  channelId?: string | null,
):
  | { ok: true; wanted: number[]; held: number[]; jackpot: number; drawAt: number; cost: number }
  | { ok: false; reason: "taken"; takenByOthers: number[]; alreadyMine: number[] }
  | { ok: false; reason: "sold-out" }
  | { ok: false; reason: "max"; held: number; canBuy: number }
  | { ok: false; reason: "insufficient"; count: number; need: number; balance: number } {
  const lottery = loadLottery();
  const mine = lottery.tickets[userId] ?? [];

  let wanted: number[];
  if (opts.numbers && opts.numbers.length > 0) {
    const parsed = opts.numbers;
    const alreadyMine = parsed.filter((n) => mine.includes(n));
    const takenByOthers = parsed.filter((n) => !mine.includes(n) && ownerOf(lottery.tickets, n) !== null);
    if (alreadyMine.length > 0 || takenByOthers.length > 0) return { ok: false, reason: "taken", takenByOthers, alreadyMine };
    wanted = parsed;
  } else {
    const free: number[] = [];
    for (let n = 0; n < NUMBER_POOL; n++) if (ownerOf(lottery.tickets, n) === null) free.push(n);
    if (free.length === 0) return { ok: false, reason: "sold-out" };
    wanted = [];
    for (let i = 0; i < (opts.count ?? 1) && free.length > 0; i++) {
      wanted.push(free.splice(Math.floor(Math.random() * free.length), 1)[0]!);
    }
  }

  if (mine.length + wanted.length > MAX_NUMBERS_PER_ROUND) {
    return { ok: false, reason: "max", held: mine.length, canBuy: MAX_NUMBERS_PER_ROUND - mine.length };
  }
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  const cost = wanted.length * TICKET_PRICE;
  if (balance < cost) return { ok: false, reason: "insufficient", count: wanted.length, need: cost, balance };

  coins[userId] = balance - cost;
  lottery.jackpot += wanted.length * JACKPOT_CUT;
  lottery.tickets[userId] = [...mine, ...wanted].sort((a, b) => a - b);
  if (lottery.drawAt === 0) lottery.drawAt = Date.now() + DRAW_DELAY_MS; // vé đầu mở vòng, đếm ngược 1 tiếng
  // Hũ là của chung mọi server, nên màn lật phải tới đúng những phòng đã bỏ
  // tiền: mỗi server có người mua tự ghi tên kênh của mình vào đây.
  if (channelId) lottery.channels[guildId] = channelId;
  saveCoins(coins);
  saveLottery(lottery);
  return { ok: true, wanted, held: lottery.tickets[userId]!, jackpot: lottery.jackpot, drawAt: lottery.drawAt, cost };
}

// Trạng thái vòng hiện tại cho một người (hũ, giờ quay, số của họ).
export function lotteryInfo(
  guildId: string,
  userId: string,
): { jackpot: number; drawAt: number; mine: number[]; sold: number; players: number; announceChannelId: string | null } {
  const lottery = loadLottery();
  return {
    jackpot: lottery.jackpot,
    drawAt: lottery.drawAt,
    mine: lottery.tickets[userId] ?? [],
    sold: soldNumbers(lottery.tickets),
    players: Object.keys(lottery.tickets).length,
    announceChannelId: loadSettings(guildId).announceChannelId,
  };
}

// Các kỳ quay gần nhất (newest-first).
export function lotteryHistory(limit = HISTORY_SHOWN): LotteryDraw[] {
  return loadLottery().history.slice(0, limit);
}

const xoso: Command = {
  data: new SlashCommandBuilder()
    .setName("xoso")
    .setDescription("Xổ số coin — giành số 00–99, quay sau 1 tiếng, trúng ăn cả hũ")
    .addSubcommand((sub) =>
      sub
        .setName("mua")
        .setDescription(`Giành số 00–99 — ${TICKET_PRICE} 🪙/số, mỗi số một chủ, tối đa ${MAX_NUMBERS_PER_ROUND} số/vòng`)
        .addStringOption((opt) =>
          opt
            .setName("so")
            .setDescription('Số muốn giành, nhiều số cách nhau dấu cách (vd "68 07") — bỏ trống = số ngẫu nhiên'),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("so_luong")
            .setDescription("Mua N số ngẫu nhiên (chỉ dùng khi không nhập số cụ thể)")
            .setMinValue(1)
            .setMaxValue(MAX_NUMBERS_PER_ROUND),
        ),
    )
    .addSubcommand((sub) => sub.setName("thongtin").setDescription("Xem hũ, giờ quay và các số của bro vòng này"))
    .addSubcommand((sub) => sub.setName("lichsu").setDescription("Xem kết quả các kỳ quay gần đây"))
    .addSubcommand((sub) =>
      sub.setName("kenh").setDescription("Bật/tắt đăng kết quả xổ số vào kênh này (cần quyền Manage Server)"),
    ),

  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "kenh") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "Cần quyền **Manage Server** để chọn kênh thông báo xổ số nhé bro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // Shared announce channel (also used by /worldcup) — manual override of
      // the auto-detected channel. Toggle: same channel again turns it off.
      const settings = loadSettings(guildId);
      settings.announceChannelId = settings.announceChannelId === interaction.channelId ? null : interaction.channelId;
      saveSettings(guildId, settings);
      await interaction.reply(
        settings.announceChannelId
          ? "📣 Ok! Thông báo của mình (xổ số, kèo…) sẽ được đăng vào kênh này."
          : "🔕 Đã bỏ ghim kênh thông báo — mình sẽ tự chọn kênh phù hợp. Ghim lại bằng `/xoso kenh` ở kênh bro muốn.",
      );
      return;
    }

    if (sub === "thongtin") {
      const info = lotteryInfo(guildId, userId);
      const mine = info.mine.map(fmt).join(", ");
      const embed = new EmbedBuilder()
        .setTitle("🎰 Xổ số coin")
        .setDescription(
          [
            `💰 Hũ hiện tại: **${info.jackpot}** 🪙`,
            info.drawAt === 0
              ? "⏰ Quay số: chưa mở vòng — giành số để bắt đầu (quay sau 1 tiếng)"
              : `⏰ Quay số: ${drawTs(info.drawAt, "f")} (${drawTs(info.drawAt, "R")})`,
            `🎟️ Số của bro vòng này: ${mine || "*chưa có — giành lẹ kẻo hết số đẹp*"}`,
            `👥 Đã bán **${info.sold}**/${NUMBER_POOL} số cho **${info.players}** người chơi`,
            info.announceChannelId
              ? `📣 Kết quả đăng ở <#${info.announceChannelId}>`
              : "📣 Kết quả đăng ở kênh mình tự chọn — ghim kênh khác bằng `/xoso kenh`",
          ].join("\n"),
        )
        .setFooter({
          text: `Số ${TICKET_PRICE} 🪙 — ${JACKPOT_CUT} vào hũ, ${TICKET_PRICE - JACKPOT_CUT} đốt; mỗi số một chủ, tối đa ${MAX_NUMBERS_PER_ROUND} số/vòng; quay rút một số ĐÃ BÁN nên chắc chắn có người trúng; không ai mua → hũ dồn.`,
        })
        .setColor(0xfee75c);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "lichsu") {
      const history = lotteryHistory();
      const embed = new EmbedBuilder()
        .setTitle("🎰 Lịch sử xổ số")
        .setDescription(
          history.length === 0
            ? "Chưa có kỳ quay nào — giành số để mở vòng đầu tiên nhé bro! `/xoso mua`"
            : history
                .map(
                  (d) =>
                    `${emojiNumber(d.n)} · <@${d.winnerId}> ăn **${d.prize}** 🪙 (${d.numbers}/${d.sold} số) · ${drawTs(d.at, "R")}`,
                )
                .join("\n"),
        )
        .setFooter({ text: `Lưu ${HISTORY_LIMIT} kỳ gần nhất — quay rút một số ĐÃ BÁN nên kỳ nào có vé là có người trúng.` })
        .setColor(0xfee75c);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // mua — parse số cụ thể (nếu có) rồi để buyLottery lo cả block đồng bộ.
    const rawSo = interaction.options.getString("so");
    let parsed: number[] | undefined;
    if (rawSo) {
      const p = parseNumbers(rawSo);
      if (!p) {
        await interaction.reply({
          content: 'Số không hợp lệ bro — nhập 0–99, nhiều số thì cách nhau dấu cách, vd `so: 68 07`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      parsed = p;
    }
    const result = buyLottery(
      guildId,
      userId,
      parsed ? { numbers: parsed } : { count: interaction.options.getInteger("so_luong") ?? 1 },
      interaction.channelId,
    );
    if (!result.ok) {
      let content: string;
      if (result.reason === "taken") {
        const bits: string[] = [];
        if (result.takenByOthers.length > 0) bits.push(`số ${result.takenByOthers.map(fmt).join(", ")} có chủ rồi`);
        if (result.alreadyMine.length > 0) bits.push(`số ${result.alreadyMine.map(fmt).join(", ")} bro đang giữ sẵn`);
        content = `Không mua được: ${bits.join("; ")} — chọn số khác nhé bro (xem \`/xoso thongtin\`).`;
      } else if (result.reason === "sold-out") {
        content = "Cả 100 số đều có chủ rồi bro — vòng này cháy vé, mai quay lại sớm nhé! 🔥";
      } else if (result.reason === "max") {
        content = `Tối đa ${MAX_NUMBERS_PER_ROUND} số/vòng thôi bro — bro đang giữ ${result.held} số, chỉ giành thêm được ${result.canBuy} số nữa.`;
      } else {
        content = `Không đủ coin rồi bro — ${result.count} số cần 🪙 ${result.need}, số dư: ${result.balance}.`;
      }
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    // Mua số là chuyện công khai — như kèo World Cup, cả kênh cùng máu.
    const embed = new EmbedBuilder()
      .setTitle("🎟️ Có người giành số!")
      .setDescription(
        [
          `<@${userId}> vừa giành số ${result.wanted.map((n) => `**${fmt(n)}**`).join(", ")}` +
            ` (giữ ${result.held.length}/${MAX_NUMBERS_PER_ROUND} số: ${result.held.map(fmt).join(", ")})`,
          `💰 Hũ hiện tại: **${result.jackpot}** 🪙`,
          `⏰ Quay số ${drawTs(result.drawAt, "R")} — rút một số đã bán, trúng ăn CẢ hũ!`,
        ].join("\n"),
      )
      .setFooter({ text: `Số ${TICKET_PRICE} 🪙 — ${JACKPOT_CUT} vào hũ, ${TICKET_PRICE - JACKPOT_CUT} đốt. Giành số: /xoso mua` })
      .setColor(0x57f287);
    await interaction.reply({ embeds: [embed] });
  },
};

// Scheduler quay số: startTicker chạy một lần lúc startup rồi mỗi phút.
// MỘT vòng cho cả hệ thống — hũ chung thì cũng chỉ có một lần quay, rồi kết
// quả được đăng ở mọi server đã có người mua. Mọi mutation ledger đồng bộ,
// announce best-effort sau.
export function startLotteryScheduler(client: Client): void {
  startTicker("xoso", 60_000, () => drawRound(client));
}

async function drawRound(client: Client): Promise<void> {
  const lottery = loadLottery();
  if (lottery.drawAt === 0) return; // chưa có vòng nào mở — chờ vé đầu tiên
  if (Date.now() < lottery.drawAt) return;

  // Đến giờ quay. Ghost guard như bầu cua: chỉ số của người còn ví mới dự
  // thưởng — số của người đã rời hết mọi server bị loại.
  const coins = loadCoins();
  const sold: { n: number; uid: string }[] = [];
  for (const [uid, nums] of Object.entries(lottery.tickets)) {
    if (!(uid in coins)) continue;
    for (const n of nums) sold.push({ n, uid });
  }
  if (sold.length === 0) {
    // Không ai dự (hoặc chỉ toàn ghost) → hũ dồn qua vòng sau, drawAt về 0 chờ vé kế.
    lottery.tickets = {};
    lottery.drawAt = 0;
    lottery.channels = {}; // vòng đóng — quên kênh cũ, vé đầu vòng sau sẽ đặt lại
    saveLottery(lottery);
    return;
  }

  const winning = sold[Math.floor(Math.random() * sold.length)]!;
  const winnerNumbers = sold.filter((s) => s.uid === winning.uid).length;
  const prize = lottery.jackpot;
  const playChannels = { ...lottery.channels }; // nơi đăng kết quả, giữ lại trước khi reset

  // Log ý định → reset vòng → trả thưởng, tất cả trong một block đồng bộ.
  // Thứ tự này để crash giữa hai lần ghi chỉ có thể LÀM MẤT một giải (đã
  // log, đền tay được) chứ không bao giờ để tick sau quay lại và trả CẢ
  // hũ lần nữa.
  console.log(
    `[xoso] draw: số ${fmt(winning.n)} → winner ${winning.uid} (${winnerNumbers}/${sold.length} số), prize ${prize}`,
  );
  const draw: LotteryDraw = { n: winning.n, winnerId: winning.uid, prize, numbers: winnerNumbers, sold: sold.length, at: Date.now() };
  lottery.history = [draw, ...lottery.history].slice(0, HISTORY_LIMIT); // newest-first, bounded ring — /xoso lichsu
  lottery.tickets = {};
  lottery.jackpot = 0;
  lottery.drawAt = 0; // vòng đóng — chờ vé đầu của vòng kế mở đếm ngược mới
  lottery.channels = {}; // vòng kế sẽ đặt lại theo các kênh mua vé của nó
  saveLottery(lottery);
  coins[winning.uid] = (coins[winning.uid] ?? 0) + prize;
  saveCoins(coins);

  // Kết quả đã chốt — giờ mới đi loan tin, từng server một, lỗi phòng này
  // không chặn phòng kia.
  for (const [guildId, channelId] of Object.entries(playChannels)) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    await announceDraw(guild, channelId, winning, winnerNumbers, sold.length, prize).catch((error) => {
      console.error(`[xoso] draw announce failed in guild ${guildId}:`, error);
    });
  }
}

async function announceDraw(
  guild: Guild,
  playChannelId: string,
  winning: { n: number; uid: string },
  winnerNumbers: number,
  sold: number,
  prize: number,
): Promise<void> {
  // Đăng ở kênh mua vé; ghim /xoso kenh vẫn thắng, rồi mới auto-detect. null = quay lặng lẽ.
  const channel = await resolveAnnounceChannel(guild, playChannelId);
  if (!channel) return;
  try {
    const resultEmbed = new EmbedBuilder()
      .setTitle("🎰 Kết quả xổ số hôm nay!")
      .setDescription(
        [
          `# ${emojiNumber(winning.n)}`,
          `🎉 Số **${fmt(winning.n)}** trúng — chúc mừng <@${winning.uid}> ôm trọn hũ **${prize}** 🪙!`,
          `🎟️ Cầm ${winnerNumbers}/${sold} số đã bán`,
          "⏰ Vòng mới mở — giành số để bắt đầu đếm ngược 1 tiếng: `/xoso mua`",
        ].join("\n"),
      )
      .setColor(0xfee75c);
    // Quay số trước, chốt ở số trúng. Spin bọc try riêng: hiccup khi bi lăn
    // không được chặn màn lật — reveal luôn cố hiển thị bằng số thật.
    let msg: Message | undefined;
    try {
      msg = await channel.send({ embeds: [spinEmbed(randNumber())] });
      for (const delay of SPIN_DELAYS) {
        await sleep(delay);
        await msg.edit({ embeds: [spinEmbed(randNumber())] });
      }
      await sleep(700);
    } catch (error) {
      console.error(`[xoso] spin animation hiccup in guild ${guild.id}:`, error);
    }
    if (msg) await msg.edit({ embeds: [resultEmbed] });
    else await channel.send({ embeds: [resultEmbed] });
  } catch (error) {
    console.error(`[xoso] draw announce failed in guild ${guild.id}:`, error);
  }
}

export default xoso;
