import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiểm tra độ trễ của bot"),
  async execute(interaction) {
    const ms = interaction.client.ws.ping;
    await interaction.reply(`🏓 Pong! ${ms === -1 ? "n/a" : `${ms}ms`}`);
  },
};

export default ping;
