import { SlashCommandBuilder } from "discord.js";
import { clearSession } from "../agent";
import { ensureWorkspace } from "../guilds";
import type { Command } from "../types";

const clear: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Xoá ngữ cảnh hội thoại với bot trong kênh này"),
  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;
    const workspace = ensureWorkspace(interaction.guildId);
    clearSession(workspace, interaction.channelId);
    await interaction.reply("🧹 Đã xoá ngữ cảnh. Bắt đầu hội thoại mới nhé bro!");
  },
};

export default clear;
