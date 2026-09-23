// Entry point: Discord client, slash command dispatch, chat lane, shutdown.

import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  type RepliableInteraction,
} from "discord.js";
import { initCardEmojis } from "./cards";
import { handleMessage } from "./chat";
import { commands, contextMenuCommands } from "./commands/index";
import { config } from "./config";
import { grantStartingCoins } from "./economy";
import {
  endGame,
  forgetIfGone,
  installGeneratedSkill,
  listGameChannels,
  loadGame,
  quarantineGame,
  removeGuildData,
  removeGuildMemberState,
  sweepOrphans,
  syncGuild,
} from "./guilds";
import { migrateToGlobal } from "./migrate-global";
import { rollRpgSeason } from "./rpg-store";
import { wikiSkillFiles } from "./wiki";
import { startBegScheduler } from "./commands/coin";
import { startCoinDropScheduler } from "./commands/coindrop";
import { startLotteryScheduler } from "./commands/xoso";
import { startEventScheduler } from "./events";
import { reconcileGuildExpeditions, startExpeditionScheduler } from "./expeditions";
import { startFootballScheduler } from "./football";
import { closeDiscordHeroRuntime } from "./discord-hero/runtime";
import { handleGuildCreate, handleOnboardButton, handleOnboardSelect } from "./onboarding";
import { startTelemetryScheduler } from "./rpg-telemetry";
import { startTicker } from "./scheduler";
import { startStatusServer } from "./server";
import { handleVoiceStateUpdate, reconcileGuildStreams, startStreamScheduler } from "./streams";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  // Partials.Message so GuildMessageReactions fire on uncached messages;
  // Partials.GuildMember so GuildMemberRemove fires for uncached members.
  partials: [Partials.Message, Partials.GuildMember],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log(`   Model: ${config.model} | Commands: ${commands.size}`);
  // Load the uploaded card emojis (blackjack render); best-effort, text fallback.
  void initCardEmojis(readyClient);
  // Regenerate the agent's orb-bot skill from the same model the public wiki renders, BEFORE
  // the sync loop below — syncGuild's refreshSkills is what carries it into each workspace,
  // so the agent's reference and the wiki page can never describe different bots.
  try {
    installGeneratedSkill("orb-bot", wikiSkillFiles());
  } catch (error) {
    console.error("[wiki] could not write the orb-bot skill:", error);
  }
  // Fold any surviving per-server ledgers into the shared world BEFORE anything
  // reads a wallet. No-op once done (and on a fresh install); the old files are
  // renamed, never deleted.
  try {
    migrateToGlobal();
  } catch (error) {
    console.error("[migrate] could not merge the per-server ledgers:", error);
  }
  // One world, one league: the season rolls once for the whole system rather
  // than once per server, so no two servers can sit on different seasons of the
  // same shared characters.
  try {
    rollRpgSeason();
  } catch (error) {
    console.error("[rpg] season roll failed:", error);
  }
  // Provision workspaces + backfill wallets for servers joined while offline.
  // Sequential on purpose: one full-member fetch at a time instead of a
  // gateway rate-limit storm once the bot sits in many guilds.
  (async () => {
    for (const guild of readyClient.guilds.cache.values()) {
      await syncGuild(guild).catch(console.error);
      await reconcileGuildStreams(guild).catch(console.error);
      await reconcileGuildExpeditions(readyClient, guild).catch(console.error);
    }
    // GC for the shared stores — the safety net behind GuildMemberRemove, and
    // the catch-up for anyone who left during downtime. Started HERE, after the
    // sync loop, for two reasons: it reads the member cache that loop fills,
    // and running it alongside those fetches trips the gateway's member-request
    // rate limit (startTicker's own catch-up run covers the startup pass, so
    // there is no separate call to make).
    startTicker("orphans", ORPHAN_SWEEP_INTERVAL_MS, () => sweepOrphans(readyClient).then(() => undefined));
  })().catch(console.error);
  startTicker("games", GAME_SWEEP_INTERVAL_MS, sweepIdleGames);
  // World Cup betting season: fixture refresh + settlement, off without the token.
  if (config.footballDataToken) startFootballScheduler(readyClient);
  // Daily coin lottery (/xoso): always on — a per-guild feature with no external API.
  startLotteryScheduler(readyClient);
  // Coin drops (/coindrop): always on — closes + refunds expired drops per guild.
  startCoinDropScheduler(readyClient);
  // Ăn xin (/coin anxin): always on — closes expired goal-based begs per guild.
  startBegScheduler(readyClient);
  // Auto economy events: weekend x2 announce + expired-event GC, always on.
  startEventScheduler(readyClient);
  // Go Live rewards: pay each completed block live + keep the stream message updated.
  startStreamScheduler(readyClient);
  // Cửa Ải (/rpg): advance active auto-expeditions per minute + keep their live message fresh.
  startExpeditionScheduler(readyClient);
  // RPG telemetry: prune journal files past the retention window (GC for the tuning log).
  startTelemetryScheduler(readyClient);
});

// The one global scheduler for persisted games: any game idle past the limit
// is torn down via its command's handleExpiredGame (refund/summary), or its
// file is deleted when the command has no handler. Also mops up rounds whose
// in-memory timers were lost to a restart.
const GAME_IDLE_MS = 20 * 60_000;
const GAME_SWEEP_INTERVAL_MS = 5 * 60_000;
// Wallets now outlive any single server, so the only thing that may delete one
// is "shares no server with the bot". GuildMemberRemove catches that live; this
// slow sweep catches what it can't (downtime, a server removing the app).
const ORPHAN_SWEEP_INTERVAL_MS = 6 * 60 * 60_000;

async function sweepIdleGames(): Promise<void> {
  for (const { guildId, channelId } of listGameChannels()) {
    // Re-load per iteration: earlier awaits may have let this game progress.
    const stored = loadGame(guildId, channelId);
    if (!stored) continue;
    if (Date.now() - (stored.updatedAt ?? 0) < GAME_IDLE_MS) continue;
    console.log(`[games] sweeping idle ${stored.game} in ${guildId}/${channelId}`);
    const command = commands.get(stored.game);
    try {
      if (command?.handleExpiredGame) {
        await command.handleExpiredGame(client, guildId, channelId, stored);
      } else {
        console.warn(`[games] no handleExpiredGame for "${stored.game}" — deleting its file without teardown`);
        endGame(guildId, channelId);
      }
    } catch (error) {
      console.error(`[games] cleanup of ${stored.game} in ${channelId} failed:`, error);
      // The file may be the only record of players' stakes — park it as
      // .failed-<ts> instead of deleting the evidence with the failure.
      quarantineGame(guildId, channelId);
    }
  }
}

client.on(Events.GuildCreate, (guild) => {
  console.log(`[guilds] installed on ${guild.name} (${guild.id})`);
  // Onboarding fires ONLY here (real install), never in the ClientReady startup
  // sync loop — both call syncGuild, but the welcome must post exactly once.
  // handleGuildCreate runs after syncGuild so the workspace + settings.json exist,
  // and its onboardedAt guard makes a double guildCreate a no-op.
  syncGuild(guild)
    .then(() => handleGuildCreate(guild))
    .catch(console.error);
});

client.on(Events.GuildDelete, (guild) => {
  console.log(`[guilds] removed from ${guild.name} (${guild.id}) — wiping its room data`);
  // Only the room-shaped state goes. Its members keep their wallets and heroes:
  // most of them are probably playing elsewhere, and the orphan sweep is the one
  // thing allowed to decide otherwise.
  removeGuildData(guild.id);
  void sweepOrphans(client).catch(console.error);
});

client.on(Events.GuildMemberAdd, (member) => {
  if (member.user.bot) return;
  // Once per person, not once per server — someone joining their second server
  // walks in with the wallet they already have.
  if (grantStartingCoins(member.id)) {
    console.log(`[guilds] granted starting coins to ${member.id} (first server: ${member.guild.id})`);
  }
});

client.on(Events.GuildMemberRemove, (member) => {
  if (member.id === member.client.user.id) return; // bot itself — GuildDelete cleans up
  // Leaving ONE server costs only what belonged to that room (an in-progress
  // voice session). The wallet and hero survive — unless this was their last
  // server with the bot, which forgetIfGone checks before deleting anything.
  removeGuildMemberState(member.guild.id, member.id);
  console.log(`[guilds] member ${member.id} left ${member.guild.id}`);
  void forgetIfGone(member.client, member.id).catch(console.error);
});

startStatusServer(client);

// Best-effort ephemeral error reply for a failed handler, acknowledged or not.
async function replyWithError(interaction: RepliableInteraction, content: string, tag: string): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (replyError) {
    console.error(`[${tag}] failed to send error reply:`, replyError);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  // Buttons, select menus and modal submits route by customId prefix:
  // "<commandName>:...". A missing handler stays silent on purpose:
  // collector-based commands (oantuti) receive those clicks through their own
  // collector, not this router.
  if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
    const name = interaction.customId.split(":")[0];
    // Onboarding lives outside the commands Map (it's install-time, not a slash
    // command), so route its buttons/selects explicitly. No modals to route.
    if (name === "onboard") {
      try {
        if (interaction.isButton()) await handleOnboardButton(interaction);
        else if (interaction.isStringSelectMenu()) await handleOnboardSelect(interaction);
      } catch (error) {
        console.error(`[onboard] ${interaction.customId} failed:`, error);
        await replyWithError(interaction, "😵 Có lỗi khi xử lý rồi bro. Thử lại nhé.", "onboard");
      }
      return;
    }
    const command = name ? commands.get(name) : undefined;
    try {
      if (interaction.isButton()) await command?.handleButton?.(interaction);
      else if (interaction.isStringSelectMenu()) await command?.handleSelect?.(interaction);
      else await command?.handleModal?.(interaction);
    } catch (error) {
      console.error(`[component] ${interaction.customId} failed:`, error);
      await replyWithError(interaction, "😵 Có lỗi khi xử lý rồi bro. Thử lại nhé.", "component");
    }
    return;
  }

  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

  // Bot server-only: lệnh đã khai báo guild-only (commandData) nên Discord ẩn
  // chúng khỏi DM. Guard này bắc cầu trong lúc registration mới lan tới Discord.
  if (!interaction.inGuild()) {
    await interaction
      .reply({
        content: "Mình chỉ hoạt động trong server thôi bro — vào server gọi mình nhé!",
        flags: MessageFlags.Ephemeral,
      })
      .catch(console.error);
    return;
  }

  // Slash commands dispatch by command name; context menus by menu name.
  const command = interaction.isChatInputCommand()
    ? commands.get(interaction.commandName)
    : contextMenuCommands.get(interaction.commandName);
  if (!command) {
    await interaction
      .reply({ content: "🤔 Mình không biết lệnh này bro.", flags: MessageFlags.Ephemeral })
      .catch(console.error);
    return;
  }

  try {
    if (interaction.isChatInputCommand()) {
      await command.execute(interaction);
    } else if (interaction.isUserContextMenuCommand()) {
      await command.handleContextMenu?.(interaction);
    } else {
      await command.handleMessageContextMenu?.(interaction);
    }
  } catch (error) {
    console.error(`[command] ${interaction.commandName} failed:`, error);
    await replyWithError(interaction, "😵 Có lỗi khi chạy lệnh rồi bro. Thử lại nhé.", "command");
  }
});

client.on(Events.MessageCreate, (message) => {
  handleMessage(message).catch(console.error);
});

// Go Live rewards: streams.ts tracks streaming edges and pays coins on stream end.
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState).catch(console.error);
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    await closeDiscordHeroRuntime().catch((error) => {
      console.error("[discordhero] repository close failed:", error);
    });
    client.destroy();
    process.exit(0);
  });
}

client.login(config.discordToken).catch((error) => {
  console.error("Login failed:", error);
  process.exit(1);
});
