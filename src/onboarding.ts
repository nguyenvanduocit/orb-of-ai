// Onboarding: the one-time welcome a server sees right after install, plus the
// buttons/wizard it carries. The whole design is "auto by default — AI/admin
// tweaks only if wanted": the bot already runs fully on sensible defaults (coins
// on, weekend x2 on, announce channel auto-detected), so onboarding is a
// convenience shortcut, never a required setup step.
//
// INVARIANT: handleGuildCreate is called ONLY from the real guildCreate event
// (install), never from the ClientReady startup sync — both currently call
// syncGuild, but the welcome must post exactly once. settings.onboardedAt is the
// hard guard so a restart (or a double guildCreate) never re-posts.
//
// INVARIANT: every onboard:* action that changes config re-reads the CLICKER's
// LIVE ManageGuild permission and refuses non-admins (ensureAdmin). The buttons
// live in a public message anyone can click — model/UI visibility is not the
// security boundary, the permission check is.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ButtonInteraction, Guild, GuildTextBasedChannel, StringSelectMenuInteraction } from "discord.js";
import { buildHelpEmbed } from "./commands/help";
import { config } from "./config";
import { loadGlobalSettings, saveGlobalSettings } from "./economy";
import { announceEverywhere, startEvent } from "./events";
import { loadSettings, resolveAnnounceChannel, saveSettings } from "./guilds";

const HAPPY_HOUR_HOURS = 1;
const HAPPY_HOUR_MULTIPLIER = 2;

// Fired from the guildCreate handler AFTER syncGuild (workspace + settings.json
// provisioned). Posts the welcome once and best-effort DMs the owner. The
// onboardedAt flag is stamped BEFORE the send (like the xoso/events dedup): a
// send hiccup can then only drop the welcome, never make a restart re-post it.
// If nowhere is postable the whole thing degrades silently — the bot still runs.
export async function handleGuildCreate(guild: Guild): Promise<void> {
  const settings = loadSettings(guild.id);
  if (settings.onboardedAt !== null) return; // đã chào rồi — restart không post lại
  settings.onboardedAt = Date.now();
  saveSettings(guild.id, settings);

  const channel = await resolveAnnounceChannel(guild);
  if (channel) {
    await channel.send({ embeds: [welcomeEmbed()], components: welcomeRows() }).catch((error) => {
      console.error(`[onboarding] welcome post failed in guild ${guild.id}:`, error);
    });
  }

  // Courtesy only — Discord often blocks bot→user DMs, so any failure is fine.
  try {
    const owner = await guild.fetchOwner();
    await owner.send({ embeds: [ownerDmEmbed(guild)] });
  } catch {
    // swallow — the welcome message (if any) is the primary channel
  }
}

function welcomeEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✨ ${config.botUsername} đã sẵn sàng!`)
    .setColor(0x5865f2)
    .setDescription(
      [
        "Chào cả nhà! Mình là bot AI + kinh tế coin cho server này.",
        "",
        "🚀 **Không cần cài gì cả — mình chạy luôn.** Điểm danh, ngồi voice / Go Live nhận coin, minigame, chat với AI... tất cả bật sẵn với thiết lập mặc định hợp lý. Kênh thông báo mình cũng **tự dò**.",
        "",
        "Muốn tùy chỉnh (chọn kênh thông báo, sự kiện x2...)? Admin bấm nút bên dưới, hoặc cứ **@mình nói tiếng Việt** là mình làm hộ.",
        "",
        "Gõ `/help` bất cứ lúc nào để xem đầy đủ tính năng nhé!",
      ].join("\n"),
    );
}

function ownerDmEmbed(guild: Guild): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✨ Cảm ơn đã thêm ${config.botUsername} vào ${guild.name}!`)
    .setColor(0x5865f2)
    .setDescription(
      [
        "Mình đã chạy luôn, **không cần cài gì cả** — mọi tính năng đều bật sẵn với mặc định hợp lý.",
        "",
        "Mình vừa gửi một tin chào kèm nút cấu hình nhanh vào server. Muốn tùy chỉnh thì bấm nút đó, hoặc @mình trong server nói tiếng Việt là mình làm hộ nhé bro.",
      ].join("\n"),
    );
}

function welcomeRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("onboard:wizard")
        .setEmoji("⚡")
        .setLabel("Cấu hình nhanh với AI")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("onboard:setchannel")
        .setEmoji("📣")
        .setLabel("Đặt kênh thông báo ở đây")
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("onboard:createchannel")
        .setEmoji("🏠")
        .setLabel("Tạo kênh riêng cho Orb")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("onboard:help").setEmoji("📖").setLabel("Hướng dẫn").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// --- Component routing (index.ts dispatches customId prefix "onboard:") ---

export async function handleOnboardButton(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.split(":")[1];
  // 📖 Hướng dẫn — read-only, open to everyone, no guild/admin needed.
  if (action === "help") {
    await interaction.reply({ embeds: [buildHelpEmbed()], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.inCachedGuild()) return;
  switch (action) {
    case "wizard": {
      // The wizard itself only exposes config controls, so gate it like the rest.
      if (!(await ensureAdmin(interaction))) return;
      await interaction.reply({
        embeds: [wizardEmbed(interaction.guild)],
        components: wizardComponents(interaction.guild),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case "setchannel": {
      if (!(await ensureAdmin(interaction))) return;
      const settings = loadSettings(interaction.guildId);
      settings.announceChannelId = interaction.channelId;
      saveSettings(interaction.guildId, settings);
      await interaction.reply({
        content: `📣 Ok! Từ giờ mình đăng thông báo chung (xổ số, World Cup, sự kiện...) ở <#${interaction.channelId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case "createchannel": {
      if (!(await ensureAdmin(interaction))) return;
      await createOrbChannel(interaction);
      return;
    }
    case "togglewk": {
      if (!(await ensureAdmin(interaction))) return;
      // Weekend x2 is system-wide (the wallet is), so this toggle moves it for
      // every server at once — same knob, one economy.
      const settings = loadGlobalSettings();
      saveGlobalSettings({ ...settings, weekendDouble: !settings.weekendDouble });
      await interaction.update({
        embeds: [wizardEmbed(interaction.guild)],
        components: wizardComponents(interaction.guild),
      });
      return;
    }
    case "happyhour": {
      if (!(await ensureAdmin(interaction))) return;
      await openHappyHour(interaction);
      return;
    }
  }
}

export async function handleOnboardSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId !== "onboard:wizchannel" || !interaction.inCachedGuild()) return;
  if (!(await ensureAdmin(interaction))) return;
  const channelId = interaction.values[0];
  if (!channelId) return;
  const settings = loadSettings(interaction.guildId);
  settings.announceChannelId = channelId;
  saveSettings(interaction.guildId, settings);
  await interaction.update({
    embeds: [wizardEmbed(interaction.guild)],
    components: wizardComponents(interaction.guild),
  });
}

// Mechanical ManageGuild gate — reads the caller's LIVE permission every click
// (perms revoked between opening the wizard and clicking are honored). Refuses
// non-admins ephemerally and tells the caller so.
async function ensureAdmin(
  interaction: ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached">,
): Promise<boolean> {
  if (interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return true;
  await interaction.reply({
    content: "Chỉ admin (quyền **Manage Server**) mới chỉnh được cái này nha bro.",
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

// 🏠 create #orb-of-ai and set it as the announce channel. Needs the bot's
// Manage Channels; without it (or on any create failure) degrade softly — point
// the admin at "Đặt kênh thông báo ở đây" on an existing channel instead.
async function createOrbChannel(interaction: ButtonInteraction<"cached">): Promise<void> {
  const guild = interaction.guild;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({
      content:
        "Mình chưa có quyền **Manage Channels** để tạo kênh — bro dùng kênh sẵn có rồi bấm **📣 Đặt kênh thông báo ở đây** nhé.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  try {
    const channel = await guild.channels.create({
      name: "orb-of-ai",
      type: ChannelType.GuildText,
      topic: `Kênh thông báo & chat với ${config.botUsername}`,
      reason: `Onboarding ${config.botUsername}`,
    });
    const settings = loadSettings(guild.id);
    settings.announceChannelId = channel.id;
    saveSettings(guild.id, settings);
    await interaction.reply({
      content: `🏠 Đã tạo <#${channel.id}> và đặt làm kênh thông báo chung. Xong!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(`[onboarding] create channel failed in ${guild.id}:`, error);
    await interaction.reply({
      content:
        "Tạo kênh không thành công (có thể do phân quyền) — bro dùng kênh sẵn có rồi bấm **📣 Đặt kênh thông báo ở đây** nhé.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ⚡ "Mở thử happy hour" — a one-tap preset x2 event on all faucets for an hour,
// the same Tier-2 activeEvent the admin AI tool opens (self-expires by `until`,
// GC'd by the event ticker). Announces best-effort, then confirms in the wizard.
async function openHappyHour(interaction: ButtonInteraction<"cached">): Promise<void> {
  const guild = interaction.guild;
  const until = Date.now() + HAPPY_HOUR_HOURS * 3_600_000;
  saveGlobalSettings(
    startEvent(loadGlobalSettings(), {
      kind: "all",
      multiplier: HAPPY_HOUR_MULTIPLIER,
      until,
      by: interaction.user.id,
    }),
  );
  await interaction.update({ embeds: [wizardEmbed(guild)], components: wizardComponents(guild) });
  // The multiplier applies to everyone's wallet, so every server hears about it.
  const embed = new EmbedBuilder()
    .setTitle(`🎉 Happy hour x${HAPPY_HOUR_MULTIPLIER} coin!`)
    .setDescription(
      `Từ giờ tới <t:${Math.floor(until / 1000)}:R>, **điểm danh & coin voice/Go Live** nhân **x${HAPPY_HOUR_MULTIPLIER}** coin. Cày lẹ đi bro! 🔥`,
    )
    .setColor(0xffd700);
  const announced = await announceEverywhere(guild.client, embed);
  await interaction
    .followUp({
      content: `⚡ Đã mở happy hour **x${HAPPY_HOUR_MULTIPLIER}** trong **${HAPPY_HOUR_HOURS} giờ** cho điểm danh & coin voice/Go Live — áp cho mọi server${
        announced > 0 ? `, đã báo ở ${announced} nơi` : ""
      }.`,
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

// --- Wizard (ephemeral, admin-only) ---

function wizardEmbed(guild: Guild): EmbedBuilder {
  const settings = loadSettings(guild.id);
  const economy = loadGlobalSettings();
  const channelLine = settings.announceChannelId ? `<#${settings.announceChannelId}>` : "🔍 tự động dò (chưa đặt cố định)";
  const event =
    economy.activeEvent && Date.now() < economy.activeEvent.until
      ? `x${economy.activeEvent.multiplier} tới <t:${Math.floor(economy.activeEvent.until / 1000)}:R>`
      : "không có";
  return new EmbedBuilder()
    .setTitle("⚡ Cấu hình nhanh")
    .setColor(0x5865f2)
    .setDescription(
      [
        "Chỉnh nhanh mấy thứ hay dùng — mọi thứ đều có mặc định hợp lý, không đụng cũng chạy tốt.",
        "",
        `📣 **Kênh thông báo:** ${channelLine}`,
        `📅 **Cuối tuần x2:** ${economy.weekendDouble ? "đang BẬT" : "đang TẮT"}`,
        `🎉 **Sự kiện đang chạy:** ${event}`,
      ].join("\n"),
    )
    .setFooter({ text: "Chỉ admin (Manage Server) chỉnh được" });
}

function wizardComponents(guild: Guild): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const settings = loadSettings(guild.id);
  const { weekendDouble } = loadGlobalSettings();
  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

  // Discord caps a string select at 25 options — list the channels the bot can
  // actually post in, marking the current announce channel as selected.
  const options = postableTextChannels(guild)
    .slice(0, 25)
    .map((ch) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`#${ch.name}`.slice(0, 100))
        .setValue(ch.id)
        .setDefault(ch.id === settings.announceChannelId),
    );
  if (options.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("onboard:wizchannel")
          .setPlaceholder("📣 Chọn kênh thông báo")
          .addOptions(options),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("onboard:togglewk")
        .setLabel(weekendDouble ? "Cuối tuần x2: BẬT ✅" : "Cuối tuần x2: TẮT ❌")
        .setStyle(weekendDouble ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("onboard:happyhour")
        .setEmoji("⚡")
        .setLabel("Mở thử happy hour (x2, 1h)")
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return rows;
}

// Text channels the bot may post in (View + Send) — the wizard's channel picker.
function postableTextChannels(guild: Guild): GuildTextBasedChannel[] {
  const me = guild.members.me;
  if (!me) return [];
  const result: GuildTextBasedChannel[] = [];
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased() || channel.isThread()) continue;
    const perms = channel.permissionsFor(me);
    if (perms?.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
      result.push(channel);
    }
  }
  return result;
}
