import { EmbedBuilder, escapeMarkdown, MessageFlags, SlashCommandBuilder } from "discord.js";
import { displayNames } from "../guilds";
import {
  estimateWealth,
  fetchCharactersFor,
  getDefaultCharacter,
  hasPoeConnection,
  listPoeConnections,
  type PoeCharacter,
  throttleGggCall,
  type WealthEstimate,
} from "../poe";
import type { Command } from "../types";

const POE_ORANGE = 0xaf6025;

const FLOOR_CAVEAT = "Chỉ tính unique đang mặc — mức SÀN, không phải net worth";
const BXH_CAP = 15;

// In-memory wealth cache so repeated /flex bxh doesn't hammer GGG (their rate
// limits are dynamic — one sequential pass per 30 min per user is plenty).
// Single-flight: the PROMISE is cached, so concurrent /flex calls share one
// GGG fetch per user; a rejected fetch evicts itself instead of poisoning the
// cache for 30 minutes. Keyed by userId + default char so a reconnect or a
// default-character change never serves the previous account's floor.
const WEALTH_TTL_MS = 30 * 60_000;
const wealthCache = new Map<string, { at: number; wealth: Promise<WealthEstimate> }>();

function wealthFor(userId: string, name?: string): Promise<WealthEstimate> {
  // Named lookups bypass the cache (the cache only holds the default character's floor).
  if (name) return estimateWealth(userId, name);
  const key = `${userId}:${getDefaultCharacter(userId)?.name ?? ""}`;
  const cached = wealthCache.get(key);
  if (cached && Date.now() - cached.at < WEALTH_TTL_MS) return cached.wealth;
  const wealth = estimateWealth(userId);
  wealthCache.set(key, { at: Date.now(), wealth });
  wealth.catch(() => wealthCache.delete(key));
  return wealth;
}

function moneyLine(wealth: WealthEstimate): string {
  return wealth.totalDivine !== null
    ? `**${wealth.totalDivine} Divine** (${wealth.totalExalted} Exalted)`
    : `**${wealth.totalExalted} Exalted**`;
}

const flex: Command = {
  data: new SlashCommandBuilder()
    .setName("flex")
    .setDescription("Khoe của Path of Exile — BXH độ giàu & character card")
    .addSubcommand((sub) => sub.setName("bxh").setDescription("Bảng xếp hạng độ giàu PoE của server"))
    .addSubcommand((sub) =>
      sub
        .setName("nhanvat")
        .setDescription("Khoe character card PoE của bro")
        .addStringOption((opt) =>
          opt.setName("ten").setDescription("Tên character (bỏ trống = character mặc định)"),
        ),
    ),
  async execute(interaction, sub) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inCachedGuild()) return;

    const subcommand = sub ?? interaction.options.getSubcommand();

    if (subcommand === "bxh") {
      const candidates = listPoeConnections().filter((id) => interaction.guild.members.cache.has(id));
      if (candidates.length === 0) {
        await interaction.reply(
          "Chưa ai trong server kết nối Path of Exile cả — dùng `/poe` để kết nối rồi quay lại flex nhé bro! 🔮",
        );
        return;
      }

      await interaction.deferReply();
      const capped = candidates.length > BXH_CAP;
      const picked = candidates.slice(0, BXH_CAP);

      // SEQUENTIAL on purpose — GGG rate-limit courtesy, never Promise.all here.
      // No default character = nothing to price: skip WITHOUT a GGG call and
      // report it as its own class, not as an API failure (retrying can't help).
      const rows: { userId: string; wealth: WealthEstimate }[] = [];
      let failed = 0;
      let noDefault = 0;
      for (const userId of picked) {
        if (!getDefaultCharacter(userId)) {
          noDefault++;
          continue;
        }
        try {
          rows.push({ userId, wealth: await wealthFor(userId) });
        } catch {
          failed++;
        }
      }

      if (rows.length === 0) {
        await interaction.editReply(
          failed === 0 && noDefault > 0
            ? "Ai kết nối rồi cũng chưa chọn character mặc định cả — mở `/poe` chọn char ở menu rồi quay lại flex nhé bro! 🎯"
            : "😵 Không lấy được dữ liệu của ai cả (API PoE/poe2scout đang lỗi hoặc giới hạn tốc độ) — thử lại sau nhé bro.",
        );
        return;
      }

      rows.sort((a, b) => b.wealth.totalExalted - a.wealth.totalExalted);
      const nameOf = await displayNames(interaction.guild, rows.map((r) => r.userId));
      const medals = ["🥇", "🥈", "🥉"];
      const lines = rows.map(
        ({ userId, wealth }, i) =>
          `${medals[i] ?? `${i + 1}.`} **${escapeMarkdown(nameOf(userId))}** — ${moneyLine(wealth)} · ${escapeMarkdown(wealth.character)}`,
      );

      const league = rows.find(({ wealth }) => wealth.league)?.wealth.league;
      const footerParts = [FLOOR_CAVEAT];
      if (league) footerParts.push(`League: ${league}`);
      if (capped) footerParts.push(`Chỉ tính ${BXH_CAP} người kết nối đầu tiên (server có ${candidates.length} người liên kết)`);
      if (noDefault > 0) footerParts.push(`${noDefault} người chưa chọn char mặc định (/poe)`);
      if (failed > 0) footerParts.push(`${failed} người lỗi API, thử lại sau`);

      const embed = new EmbedBuilder()
        .setTitle("💎 BXH độ giàu Path of Exile")
        .setDescription(lines.join("\n"))
        .setFooter({ text: footerParts.join(" · ") })
        .setColor(POE_ORANGE);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === "nhanvat") {
      const userId = interaction.user.id;
      if (!hasPoeConnection(userId)) {
        await interaction.reply("Bro chưa kết nối Path of Exile — dùng `/poe` để kết nối trước nhé! 🔮");
        return;
      }

      // nhanvat hits GGG twice (char list + wealth) and named lookups skip the
      // cache — the one /flex path a user can spam, so gate it per-user.
      const wait = throttleGggCall(userId);
      if (wait > 0) {
        await interaction.reply({
          content: `⏳ Từ từ thôi bro — chờ ${Math.ceil(wait / 1000)}s nữa rồi flex tiếp nhé (tránh spam API PoE).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();

      let characters: PoeCharacter[] = [];
      try {
        characters = await fetchCharactersFor(userId);
      } catch (error) {
        await interaction.editReply(`😵 ${error instanceof Error ? error.message : "Không lấy được danh sách character."}`);
        return;
      }

      const requested = interaction.options.getString("ten");
      const name =
        requested ??
        getDefaultCharacter(userId)?.name ??
        [...characters].sort((a, b) => b.level - a.level)[0]?.name;
      if (!name) {
        await interaction.editReply("Account của bro chưa có character nào để flex cả 😅");
        return;
      }

      let wealth: WealthEstimate;
      try {
        // No default character → pass the resolved fallback (highest level) so
        // the card still renders; named lookups bypass the cache by design.
        const hasDefault = getDefaultCharacter(userId) !== null;
        wealth = await wealthFor(userId, requested ?? (hasDefault ? undefined : name));
      } catch (error) {
        await interaction.editReply(`😵 ${error instanceof Error ? error.message : "Không tính được độ giàu."}`);
        return;
      }

      // Meta (level/class/league/realm) from the character list — match by the
      // name estimateWealth actually resolved (it may differ from `name` casing).
      const meta = characters.find((c) => c.name === wealth.character) ?? characters.find((c) => c.name === name);
      const poe2 = meta?.realm === "poe2";
      const title =
        `🔮 ${wealth.character}` +
        (meta ? ` — Lv${meta.level} ${meta.class}` : "") +
        (poe2 ? " · PoE2" : "");

      const topPriced = [...wealth.priced]
        .sort((a, b) => b.exalted - a.exalted)
        .slice(0, 8)
        .map((item) =>
          item.divine !== null
            ? `• ${escapeMarkdown(item.name)} — ${item.divine} Divine`
            : `• ${escapeMarkdown(item.name)} — ${item.exalted} Exalted`,
        );

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(POE_ORANGE)
        .addFields(
          ...(wealth.league || meta?.league
            ? [{ name: "🏟️ League", value: escapeMarkdown(wealth.league ?? meta?.league ?? ""), inline: true }]
            : []),
          { name: "💰 Tổng floor", value: moneyLine(wealth), inline: true },
          ...(wealth.unpricedUniques.length > 0
            ? [{ name: "❓ Unique chưa có giá", value: String(wealth.unpricedUniques.length), inline: true }]
            : []),
        )
        .setFooter({ text: FLOOR_CAVEAT });
      if (topPriced.length > 0) {
        embed.setDescription(`**💎 Unique đáng giá nhất:**\n${topPriced.join("\n")}`);
      } else {
        embed.setDescription("*Chưa có unique nào định giá được — mặc đồ xịn vào rồi flex tiếp bro!*");
      }
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default flex;
