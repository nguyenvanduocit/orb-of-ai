import {
  ActionRowBuilder,
  ContainerBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { text } from "../../ui";
import type { DiscordHeroStarterCandidate } from "../domain/party";
import { encodeDiscordHeroCustomId } from "./custom-id";

export const DISCORD_HERO_STARTER_VALUE = "starter";

/**
 * The board a player sees before they own anything. It carries the one control
 * that can bring a player row into existence, and no navigation: there is no
 * workspace to navigate to yet.
 */
export function renderDiscordHeroStarter(
  ownerId: string,
  candidates: readonly DiscordHeroStarterCandidate[],
  notice?: string,
): ContainerBuilder {
  if (candidates.length === 0) {
    throw new Error(
      "DiscordHero starter board requires at least one candidate",
    );
  }

  const container = new ContainerBuilder().setAccentColor(0x5865f2);
  container.addTextDisplayComponents(
    text(
      [
        "## 🛡️ Choose your first hero",
        "Choose your first deployed hero. Knight, Ranger, and Sorcerer all remain available in Formation.",
        ...(notice === undefined ? [] : [`-# ${notice}`]),
      ].join("\n"),
    ),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          encodeDiscordHeroCustomId({
            ownerId,
            view: "party",
            action: "select",
            revision: null,
            value: DISCORD_HERO_STARTER_VALUE,
          }),
        )
        .setPlaceholder("Pick a starting class")
        .addOptions(
          candidates.map((candidate) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(candidate.name)
              .setDescription(candidate.classType)
              .setValue(String(candidate.heroKey)),
          ),
        ),
    ),
  );
  return container;
}
