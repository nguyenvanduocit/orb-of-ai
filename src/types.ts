import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";
import type { StoredGame } from "./guilds";

// Contract for every slash command module in src/commands/.
// Each file exports `default: Command`. The registry (commands/index.ts)
// collects them; register.ts pushes `data` (and `contextMenus` when present)
// to Discord; index.ts dispatches interactions to `execute`, context menus
// (by the menu's own name) to `handleContextMenu` (user) or
// `handleMessageContextMenu` (message), and button clicks / modal submits
// whose customId starts with "<commandName>:" to `handleButton` / `handleModal`.
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    // Shortcut commands (shortcuts.ts) dựng JSON từ subcommand của lệnh gốc thay
    // vì builder — registry/help/register chỉ cần { name, toJSON() }.
    | { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  // One command can own several menus (e.g. coin: "Chuyển coin" + "Đòi nợ");
  // handleContextMenu branches on interaction.commandName.
  contextMenus?: ContextMenuCommandBuilder[];
  // `sub`: shortcuts.ts forward một subcommand cụ thể (/anxin → /coin anxin);
  // lệnh được gọi trực tiếp thì bỏ qua tham số này và tự getSubcommand().
  execute(interaction: ChatInputCommandInteraction, sub?: string): Promise<void>;
  handleButton?(interaction: ButtonInteraction): Promise<void>;
  handleContextMenu?(interaction: UserContextMenuCommandInteraction): Promise<void>;
  handleMessageContextMenu?(interaction: MessageContextMenuCommandInteraction): Promise<void>;
  handleModal?(interaction: ModalSubmitInteraction): Promise<void>;
  handleSelect?(interaction: StringSelectMenuInteraction): Promise<void>;
  // Called by the global idle sweeper (index.ts) when this command's persisted
  // game sat untouched past the idle limit. Tear down state synchronously
  // (refund/endGame) before any await, then do Discord messaging.
  handleExpiredGame?(client: Client, guildId: string, channelId: string, stored: StoredGame): Promise<void>;
}
