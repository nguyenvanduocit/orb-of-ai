import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  escapeMarkdown,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
  TimestampStyles,
} from "discord.js";
import {
  beginAuth,
  completeAuth,
  disconnectPoe,
  extractCode,
  fetchCharactersFor,
  fetchProfileSummaryFor,
  getDefaultCharacter,
  getPoeAccount,
  type PoeCharacter,
  poeConfidential,
  setDefaultCharacter,
  throttleGggCall,
} from "../poe";
import { divider, text } from "../ui";
import type { Command } from "../types";

const POE_ORANGE = 0xaf6025;

// The /poe panel is an EPHEMERAL Components V2 dashboard, updated in place. Unlike
// the game boards (public, boardPayload), it needs BOTH the Ephemeral and the V2
// flag together at CREATE. `editReply`/`update` typings reject the Ephemeral flag
// (you can't toggle ephemeral on an edit), so cast the OR'd value to the single
// IsComponentsV2 member (same trick as boardPayload) — the type stays assignable
// everywhere while the Ephemeral bit rides along at runtime, honored only on the
// first reply and harmlessly ignored on later edits/updates.
function panelPayload(container: ContainerBuilder) {
  return {
    flags: (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2) as MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { parse: [] as [] },
  };
}

function connectButtonRow(label = "🔗 Kết nối Path of Exile"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("poe:connect").setStyle(ButtonStyle.Success).setLabel(label),
  );
}

function notConnectedContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(POE_ORANGE)
    .addTextDisplayComponents(
      text(
        "## 🔮 Path of Exile — chưa kết nối\n" +
          "Kết nối account để mình xem được character (PoE1 + PoE2), phân tích build, tính độ giàu... cho bro.\n" +
          "Bấm nút bên dưới để đăng nhập qua Path of Exile.",
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(connectButtonRow());
}

function expiredContainer(message: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(POE_ORANGE)
    .addTextDisplayComponents(text(`## 🔮 Path of Exile — kết nối hết hạn\n${message}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(connectButtonRow("🔗 Kết nối lại"));
}

function characterSelectRow(
  characters: PoeCharacter[],
  current: { name: string; realm: string } | null,
): ActionRowBuilder<StringSelectMenuBuilder> {
  // Discord caps a select at 25 options; show the highest-level characters.
  const options = [...characters]
    .sort((a, b) => b.level - a.level)
    .slice(0, 25)
    .map((c) => {
      // value = "<realm>:<name>" — PoE names have no colon, so first-colon split is safe.
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(c.name.slice(0, 100))
        .setDescription(`Lv${c.level} ${c.class}${c.realm === "poe2" ? " · PoE2" : ""}`.slice(0, 100))
        .setValue(`${c.realm}:${c.name}`.slice(0, 100));
      if (current && current.name === c.name && current.realm === c.realm) option.setDefault(true);
      return option;
    });
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("poe:default")
      .setPlaceholder("🎯 Đặt character mặc định")
      .addOptions(options),
  );
}

function controlRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("poe:refresh").setStyle(ButtonStyle.Secondary).setLabel("🔄 Làm mới"),
    new ButtonBuilder().setCustomId("poe:disconnect").setStyle(ButtonStyle.Danger).setLabel("🔌 Ngắt kết nối"),
  );
}

// The connected settings dashboard: rich account info + inline default picker + disconnect.
async function connectedContainer(userId: string): Promise<ContainerBuilder> {
  const account = getPoeAccount(userId);
  if (!account) return notConnectedContainer();

  let realm: string | undefined;
  let guild: string | undefined;
  let twitch: string | undefined;
  try {
    const summary = await fetchProfileSummaryFor(userId);
    realm = summary.realm;
    guild = summary.guild;
    twitch = summary.twitch;
  } catch (error) {
    // Token expired mid-render → the account was unlinked; offer reconnect.
    if (!getPoeAccount(userId)) {
      return expiredContainer(`${error instanceof Error ? error.message : "Token hết hạn."}`);
    }
    // Transient — show what we have from storage.
  }

  let characters: PoeCharacter[] = [];
  try {
    characters = await fetchCharactersFor(userId);
  } catch {
    // Listing hiccuped — the panel still shows account info + controls.
  }

  const def = getDefaultCharacter(userId);
  const top = [...characters]
    .sort((a, b) => b.level - a.level)
    .slice(0, 10)
    .map((c) => {
      const isDefault = def && def.name === c.name && def.realm === c.realm;
      return (
        `${isDefault ? "🎯 " : ""}**${escapeMarkdown(c.name)}** — Lv${c.level} ${c.class}` +
        (c.league ? ` (${escapeMarkdown(c.league)})` : "") +
        (c.realm === "poe2" ? " · PoE2" : "")
      );
    });

  const header = [
    `## 🔮 ${escapeMarkdown(account.accountName)}`,
    `🎯 **Character mặc định:** ${
      def ? `${escapeMarkdown(def.name)}${def.realm === "poe2" ? " (PoE2)" : ""}` : "_chưa chọn — chọn ở menu dưới_"
    }`,
  ].join("\n");

  const facts = [
    ...(realm ? [`📖 Realm: ${realm}`] : []),
    `🧙 Characters: ${characters.length}`,
    ...(guild ? [`🏰 Guild: ${escapeMarkdown(guild)}`] : []),
    ...(twitch ? [`🎮 Twitch: ${escapeMarkdown(twitch)}`] : []),
  ].join(" · ");
  const meta = [
    `-# ${facts}`,
    `-# 🔗 Kết nối ${time(new Date(account.connectedAt), TimestampStyles.RelativeTime)} · ⏳ Token hết hạn ${time(
      new Date(account.expiresAt),
      TimestampStyles.RelativeTime,
    )}`,
  ].join("\n");

  const container = new ContainerBuilder().setAccentColor(POE_ORANGE).addTextDisplayComponents(text(header));
  if (top.length > 0) {
    container.addTextDisplayComponents(
      text(`🧙 **Character:**\n${top.join("\n")}${characters.length > 10 ? `\n_…và ${characters.length - 10} nữa_` : ""}`),
    );
  }
  container.addTextDisplayComponents(text(meta)).addSeparatorComponents(divider());
  if (characters.length > 0) container.addActionRowComponents(characterSelectRow(characters, def));
  container.addActionRowComponents(controlRow());
  return container;
}

const poe: Command = {
  data: new SlashCommandBuilder()
    .setName("poe")
    .setDescription("Kết nối & quản lý Path of Exile (PoE1 + PoE2) của bạn"),
  async execute(interaction) {
    const userId = interaction.user.id;
    if (!getPoeAccount(userId)) {
      // First reply establishes the message as ephemeral V2 — every later update must match.
      await interaction.reply(panelPayload(notConnectedContainer()));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(panelPayload(await connectedContainer(userId)));
  },
  async handleButton(interaction) {
    const [, action, state] = interaction.customId.split(":");
    const userId = interaction.user.id;

    if (action === "connect") {
      // Confidential mode finishes via the web callback (out-of-band → notify); the
      // public PoB client redirects to the user's own loopback, so hand them a paste step.
      if (poeConfidential()) {
        const { url } = beginAuth(userId, async (content) => {
          await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        });
        await interaction.update(
          panelPayload(
            new ContainerBuilder()
              .setAccentColor(POE_ORANGE)
              .addTextDisplayComponents(
                text(
                  "## 🔮 Kết nối Path of Exile\n" +
                    "Bấm **Đăng nhập** rồi chọn **Authorize** — mình sẽ báo khi xong (link sống 10 phút).",
                ),
              )
              .addSeparatorComponents(divider())
              .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Đăng nhập Path of Exile").setURL(url),
                ),
              ),
          ),
        );
        return;
      }
      const { url, state: pkceState } = beginAuth(userId);
      await interaction.update(
        panelPayload(
          new ContainerBuilder()
            .setAccentColor(POE_ORANGE)
            .addTextDisplayComponents(
              text(
                "## 🔮 Kết nối Path of Exile\n" +
                  "1. Bấm **Đăng nhập**, chọn **Authorize**.\n" +
                  "2. Trình duyệt nhảy tới một trang `localhost` trắng hoặc báo lỗi — **bình thường**.\n" +
                  "3. Copy **toàn bộ đường link** trên thanh địa chỉ (có `?code=...`).\n" +
                  "4. Bấm **Dán code** rồi dán vào. Xong!",
              ),
            )
            .addSeparatorComponents(divider())
            .addActionRowComponents(
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("1. Đăng nhập").setURL(url),
                new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("2. Dán code").setCustomId(`poe:code:${pkceState}`),
              ),
            ),
        ),
      );
      return;
    }

    if (action === "code" && state) {
      const modal = new ModalBuilder()
        .setCustomId(`poe:code:${state}`)
        .setTitle("Dán code Path of Exile")
        .addLabelComponents(
          new LabelBuilder()
            .setLabel("Link hoặc code")
            .setDescription("Dán toàn bộ link localhost (có ?code=...) hoặc riêng đoạn code.")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("code")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("http://localhost:49082/?code=...&state=...")
                .setRequired(true)
                .setMaxLength(2000),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    if (action === "refresh") {
      const wait = throttleGggCall(userId);
      if (wait > 0) {
        await interaction.reply({
          content: `⏳ Từ từ thôi bro — chờ ${Math.ceil(wait / 1000)}s nữa rồi làm mới nhé (tránh spam API PoE).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferUpdate();
      await interaction.editReply(panelPayload(await connectedContainer(userId)));
      return;
    }

    if (action === "disconnect") {
      await interaction.deferUpdate();
      await disconnectPoe(userId);
      await interaction.editReply(
        panelPayload(
          new ContainerBuilder()
            .setAccentColor(POE_ORANGE)
            .addTextDisplayComponents(
              text("## 👋 Đã ngắt kết nối Path of Exile\nToken đã bị xoá. Muốn dùng lại thì kết nối nhé bro."),
            )
            .addSeparatorComponents(divider())
            .addActionRowComponents(connectButtonRow("🔗 Kết nối lại")),
        ),
      );
    }
  },
  async handleModal(interaction) {
    const [, action, state] = interaction.customId.split(":");
    if (action !== "code" || !state) return;
    const code = extractCode(interaction.fields.getTextInputValue("code"));
    if (!code) {
      await interaction.reply({
        content: "Không tìm thấy `code` trong nội dung bro dán — copy lại link localhost (có `?code=...`) nhé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await completeAuth(state, code);
      // Land on the settings panel — the character select there picks the default.
      await interaction.editReply(panelPayload(await connectedContainer(interaction.user.id)));
    } catch (error) {
      await interaction.editReply(`😵 ${error instanceof Error ? error.message : "Kết nối thất bại."}`);
    }
  },
  async handleSelect(interaction) {
    if (interaction.customId !== "poe:default") return;
    const value = interaction.values[0] ?? "";
    const idx = value.indexOf(":");
    if (idx < 0) return;
    const realm = value.slice(0, idx);
    const name = value.slice(idx + 1);
    await interaction.deferUpdate();
    try {
      setDefaultCharacter(interaction.user.id, name, realm);
    } catch (error) {
      await interaction.followUp({
        content: `😵 ${error instanceof Error ? error.message : "Không đặt được character mặc định."}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Re-render so the picked character shows as 🎯 and the menu highlights it.
    await interaction.editReply(panelPayload(await connectedContainer(interaction.user.id)));
  },
};

export default poe;
