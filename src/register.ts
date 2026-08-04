import { REST, Routes } from "discord.js";
import { commandData } from "./commands/index";
import { config } from "./config";

const rest = new REST().setToken(config.discordToken);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.applicationId, config.guildId)
  : Routes.applicationCommands(config.applicationId);

try {
  await rest.put(route, { body: commandData });
  const names = commandData.map((c) => c.name).join(", ");
  const scope = config.guildId
    ? `guild ${config.guildId}`
    : "global — có thể mất tới 1 giờ để hiện";
  console.log(`Registered ${commandData.length} commands (${names}) — scope: ${scope}`);
  process.exit(0);
} catch (error) {
  console.error("Failed to register commands:", error);
  process.exit(1);
}
