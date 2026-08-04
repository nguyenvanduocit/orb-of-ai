// Components V2 message helpers — the ONE home for the "container + V2 flag +
// no-ping" payload every game board / interactive panel renders. Keeping it here
// means the idiom can't drift across command files.
//
// Discord forbids editing a classic (embeds) message into a V2 one and vice
// versa, so a surface that sends `boardPayload` once must use it for its WHOLE
// lifecycle (every edit/update of that message). Ephemeral side-replies (rules,
// errors, private role actions) are SEPARATE messages and may stay classic.
//
// Mentions inside a V2 TextDisplay notify by default (unlike embeds), so
// boardPayload disables all pinging (`parse: []`) — names render, nobody gets
// pinged by a board repaint.

import { ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from "discord.js";

export function boardPayload(container: ContainerBuilder) {
  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2, // giữ đúng member, đừng để suy rộng thành MessageFlags
    components: [container],
    allowedMentions: { parse: [] as [] },
  };
}

// Single-player boards use the same V2/no-ping contract plus Discord's
// interaction-only Ephemeral flag. Keep this at the shared payload boundary so
// RPG panels and snapshots cannot accidentally drift back to public messages.
export function privateBoardPayload(container: ContainerBuilder) {
  return {
    flags: (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2) as MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { parse: [] as [] },
  };
}

export function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

export function divider(): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(true);
}
