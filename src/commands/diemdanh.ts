import { EmbedBuilder, escapeMarkdown, SlashCommandBuilder } from "discord.js";
import { activeMultiplier, addCoins, loadAttendance, saveAttendance } from "../economy";
import { displayNames } from "../guilds";
import type { Command } from "../types";
import { titleBadge } from "./danhhieu";

// Reward ladder for a repeating check-in cycle. The reward escalates across the
// cycle and the last day is the jackpot; the cycle then loops. A check-in's
// reward is chosen by the streak it produces (day 1 = first day) — miss a day
// and the streak resets to day 1, so the ladder is the retention hook. This one
// table is the entire coin faucet for check-ins; tune it here.
export const CHECKIN_SCHEDULE = [100, 250, 500, 800, 1200, 2000, 5000] as const;
export const CYCLE_LEN = CHECKIN_SCHEDULE.length;

// Big numbers deserve thousands separators — 5000 → "5.000" (vi-VN).
export const fmtCoins = (n: number): string => n.toLocaleString("vi-VN");

// Position within the current cycle (1..CYCLE_LEN) for a given streak.
export function cycleDayOf(streak: number): number {
  return ((streak - 1) % CYCLE_LEN) + 1;
}

// Coins a check-in pays for the streak it produces (1 = first day of a streak).
export function rewardForStreak(streak: number): number {
  return CHECKIN_SCHEDULE[cycleDayOf(streak) - 1]!;
}

// Compact cycle gauge: filled squares for days done (incl. today), the whole
// bar goes gold on the jackpot day. `cycleDay` is today's slot (1..CYCLE_LEN).
export function progressBar(cycleDay: number): string {
  const fill = cycleDay === CYCLE_LEN ? "🟨" : "🟩";
  return fill.repeat(cycleDay) + "⬜".repeat(CYCLE_LEN - cycleDay);
}

// The cycle ladder shown on every check-in: ✅ claimed earlier this cycle,
// 🎯 today, ⬜ still to come, 👑 the jackpot day. `cycleDay` is today's slot.
export function renderRoadmap(cycleDay: number): string {
  return CHECKIN_SCHEDULE.map((reward, i) => {
    const day = i + 1;
    const jackpot = day === CYCLE_LEN;
    const isToday = day === cycleDay;
    const done = day < cycleDay;
    const icon = isToday ? "🎯" : done ? "✅" : jackpot ? "👑" : "⬜";
    const label = isToday || done ? `**Ngày ${day}**` : `Ngày ${day}`;
    const suffix = jackpot
      ? isToday
        ? " — 🎁 ĐẠI THƯỞNG · hôm nay!"
        : " — 🎁 ĐẠI THƯỞNG"
      : isToday
        ? "  ← hôm nay"
        : "";
    return `${icon} ${label} · 🪙 ${fmtCoins(reward)}${suffix}`;
  }).join("\n");
}

// Footer nudge: tomorrow's reward if the streak holds. After the jackpot the
// cycle loops back to day 1.
function nextRewardHint(streak: number): string {
  const nextDay = cycleDayOf(streak + 1);
  const nextReward = fmtCoins(rewardForStreak(streak + 1));
  if (nextDay === 1) return `Mai mở chu kỳ mới — Ngày 1: 🪙 ${nextReward}. Giữ chuỗi nhé bro!`;
  const jackpotTease = nextDay === CYCLE_LEN ? " 👑 ĐẠI THƯỞNG!" : "";
  return `Mai điểm danh tiếp: Ngày ${nextDay} 🪙 ${nextReward}${jackpotTease}`;
}

// "Today" in Asia/Ho_Chi_Minh; en-CA locale yields yyyy-mm-dd.
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

// Consecutive days ending today (or yesterday if today not checked in yet).
// Exported for the agent's bot_leaderboard tool (agent-tools.ts).
export function currentStreak(dates: string[]): number {
  const set = new Set(dates);
  let day = today();
  if (!set.has(day)) day = previousDay(day);
  let streak = 0;
  while (set.has(day)) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Điểm danh một user — dùng chung bởi /diemdanh checkin và tool bot_checkin của
// agent (agent-tools.ts): rule một-lần-mỗi-ngày và mức thưởng theo chuỗi ở đúng
// một chỗ.
export function performCheckin(
  userId: string,
):
  | {
      ok: true;
      day: string;
      streak: number;
      cycleDay: number;
      totalDays: number;
      reward: number;
      multiplier: number;
      balance: number;
    }
  | { ok: false; day: string; streak: number; cycleDay: number } {
  const attendance = loadAttendance();
  const dates = attendance[userId] ?? [];
  const day = today();
  if (dates.includes(day)) {
    const streak = currentStreak(dates);
    return { ok: false, day, streak, cycleDay: cycleDayOf(streak) };
  }
  dates.push(day);
  dates.sort();
  attendance[userId] = dates;
  saveAttendance(attendance);
  const streak = currentStreak(dates);
  // Faucet multiplier (weekend x2 / active event) — checkin is a faucet, so the
  // event boost applies here. Integer schedule × integer multiplier stays whole.
  const multiplier = activeMultiplier("checkin");
  const reward = rewardForStreak(streak) * multiplier;
  const balance = addCoins(userId, reward);
  return { ok: true, day, streak, cycleDay: cycleDayOf(streak), totalDays: dates.length, reward, multiplier, balance };
}

// Top 10 điểm danh (tổng ngày, tie-break chuỗi) — dùng chung bởi /diemdanh bxh
// và tool bot_leaderboard của agent (agent-tools.ts): rule xếp hạng ở đúng một chỗ.
export function attendanceRanking(): { id: string; total: number; streak: number }[] {
  return Object.entries(loadAttendance())
    .map(([id, dates]) => ({ id, total: dates.length, streak: currentStreak(dates) }))
    .sort((a, b) => b.total - a.total || b.streak - a.streak)
    .slice(0, 10);
}

const diemdanh: Command = {
  data: new SlashCommandBuilder()
    .setName("diemdanh")
    .setDescription("Điểm danh hàng ngày với Orb Of AI")
    .addSubcommand((sub) => sub.setName("checkin").setDescription("Điểm danh hôm nay"))
    .addSubcommand((sub) => sub.setName("bxh").setDescription("Bảng xếp hạng điểm danh"))
    .addSubcommand((sub) => sub.setName("stats").setDescription("Xem thống kê của bạn")),
  // Shortcut (/checkin — shortcuts.ts) truyền sẵn `sub`; gọi trực tiếp /diemdanh
  // thì default param tự getSubcommand().
  async execute(interaction, sub = interaction.options.getSubcommand()) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === "checkin") {
      const result = performCheckin(userId);
      if (!result.ok) {
        const embed = new EmbedBuilder()
          .setTitle("📅 Bro điểm danh hôm nay rồi!")
          .setDescription(`Quay lại mai để giữ chuỗi nhé bro 🔥\n${progressBar(result.cycleDay)}`)
          .addFields(
            { name: "🔥 Chuỗi", value: `${result.streak} ngày`, inline: true },
            { name: "📅 Chu kỳ", value: `${result.cycleDay}/${CYCLE_LEN}`, inline: true },
            { name: "🗓️ Lộ trình điểm danh", value: renderRoadmap(result.cycleDay) },
          )
          .setColor(0xfee75c)
          .setFooter({ text: nextRewardHint(result.streak) });
        await interaction.reply({ embeds: [embed] });
        return;
      }
      const badge = titleBadge(userId);
      const jackpot = result.cycleDay === CYCLE_LEN;
      const embed = new EmbedBuilder()
        .setTitle(jackpot ? "👑 ĐẠI THƯỞNG ĐIỂM DANH!" : "✅ Điểm danh thành công!")
        .setDescription(
          `<@${userId}>${badge ? ` · ${badge}` : ""}\n` +
            `## 🪙 +${fmtCoins(result.reward)} coin ${jackpot ? "🎉🎉🎉" : "🎉"}\n` +
            (result.multiplier > 1 ? `⚡ **x${result.multiplier} sự kiện!**\n` : "") +
            `${progressBar(result.cycleDay)}`,
        )
        .addFields(
          { name: "🔥 Chuỗi", value: `${result.streak} ngày`, inline: true },
          { name: "📅 Chu kỳ", value: `${result.cycleDay}/${CYCLE_LEN}`, inline: true },
          { name: "💰 Số dư", value: `${fmtCoins(result.balance)} 🪙`, inline: true },
          { name: "🗓️ Lộ trình điểm danh", value: renderRoadmap(result.cycleDay) },
        )
        .setColor(jackpot ? 0xffd700 : 0x57f287)
        .setFooter({ text: nextRewardHint(result.streak) });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "bxh") {
      const ranking = attendanceRanking();
      if (ranking.length === 0) {
        await interaction.reply("Chưa ai điểm danh cả. Làm người đầu tiên đi bro!");
        return;
      }
      await interaction.deferReply();
      const nameOf = await displayNames(interaction.guild, ranking.map((entry) => entry.id));
      const medals = ["🥇", "🥈", "🥉"];
      const lines = ranking.map(
        (entry, i) =>
          `${medals[i] ?? `${i + 1}.`} **${escapeMarkdown(nameOf(entry.id))}** — ${entry.total} ngày (🔥 ${entry.streak})`,
      );
      const embed = new EmbedBuilder()
        .setTitle("🏆 Bảng xếp hạng điểm danh")
        .setDescription(lines.join("\n"))
        .setColor(0xfee75c);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // stats
    const dates = loadAttendance()[userId] ?? [];
    if (dates.length === 0) {
      await interaction.reply("Bro chưa điểm danh lần nào. Gõ `/diemdanh checkin` đi!");
      return;
    }
    const streak = currentStreak(dates);
    const cycleDay = cycleDayOf(streak);
    const embed = new EmbedBuilder()
      .setTitle("📊 Thống kê điểm danh")
      .setDescription(`<@${userId}>\n${progressBar(cycleDay)}`)
      .addFields(
        { name: "📊 Tổng cộng", value: `${dates.length} ngày`, inline: true },
        { name: "🔥 Chuỗi", value: `${streak} ngày`, inline: true },
        { name: "📅 Chu kỳ", value: `${cycleDay}/${CYCLE_LEN}`, inline: true },
        { name: "🕘 Lần cuối", value: dates[dates.length - 1] ?? "n/a", inline: true },
        { name: "🗓️ Lộ trình điểm danh", value: renderRoadmap(cycleDay) },
      )
      .setColor(0x5865f2)
      .setFooter({ text: nextRewardHint(streak) });
    await interaction.reply({ embeds: [embed] });
  },
};

export default diemdanh;
