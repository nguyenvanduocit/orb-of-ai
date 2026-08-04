import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import {
  AgentLimitError,
  AI_DISABLED_MESSAGE,
  buildAgentMcpServers,
  chunkForDiscord,
  collectImageCandidates,
  downloadImages,
  runAgent,
  type ImageCandidate,
} from "../agent";
import { config } from "../config";
import { ensureWorkspace } from "../guilds";
import type { Command } from "../types";

// A "burst" = the run of consecutive messages by the same author around the
// clicked one, each gap ≤ BURST_GAP_MS — users often split one thought across
// several quick messages, so "Hỏi AI" quotes the whole run, not just one line.
export const BURST_GAP_MS = 5 * 60 * 1000;
export const BURST_MAX_CHARS = 2000;

type BurstMessage = {
  id: string;
  authorId: string;
  createdTimestamp: number;
  content: string;
};

export function collectBurst(pool: BurstMessage[], targetId: string): BurstMessage[] {
  const sorted = [...pool].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const at = sorted.findIndex((m) => m.id === targetId);
  if (at === -1) return [];
  const author = sorted[at]!.authorId;
  let start = at;
  while (
    start > 0 &&
    sorted[start - 1]!.authorId === author &&
    sorted[start]!.createdTimestamp - sorted[start - 1]!.createdTimestamp <= BURST_GAP_MS
  ) {
    start--;
  }
  let end = at;
  while (
    end < sorted.length - 1 &&
    sorted[end + 1]!.authorId === author &&
    sorted[end + 1]!.createdTimestamp - sorted[end]!.createdTimestamp <= BURST_GAP_MS
  ) {
    end++;
  }
  return sorted.slice(start, end + 1);
}

type HoiInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

// Session shared with the mention-chat lane: keyed by channel, and the same
// [Name]: speaker format the system prompt promises Claude.
function senderNameOf(interaction: HoiInteraction): string {
  return interaction.inCachedGuild() ? interaction.member.displayName : interaction.user.displayName;
}

// Shared tail of both lanes (/hoi and the "Hỏi AI" menu): run the agent in the
// server's workspace with sender-bound tools, then stream the chunked answer
// through editReply/followUp. `senderText` feeds the transfer tool's
// recipient-in-message guard — "" when the invoker typed nothing (the menu
// lane), which makes coin transfers mechanically impossible there.
async function askAgent(
  interaction: HoiInteraction,
  prompt: string,
  senderText: string,
  imageCandidates: ImageCandidate[] = [],
): Promise<void> {
  if (!interaction.inGuild()) return;
  // AI off (AI_ENABLED=0): both /hoi and the "Hỏi AI" menu funnel through here
  // after deferReply, so this one gate covers both without spending tokens.
  if (!config.aiEnabled) {
    await interaction.editReply(AI_DISABLED_MESSAGE);
    return;
  }
  let cleanupImages = () => {};
  try {
    const workspace = ensureWorkspace(interaction.guildId);
    // Download any quoted images so the agent's Read tool can open them, then
    // point Claude at them in the prompt — no-op when the lane carries none.
    const { promptLines, cleanup } = await downloadImages(workspace, imageCandidates, interaction.id);
    cleanupImages = cleanup;
    const result = await runAgent({
      sessionKey: interaction.channelId,
      prompt: [prompt, ...promptLines].join("\n"),
      cwd: workspace,
      mcpServers: buildAgentMcpServers({
        senderId: interaction.user.id,
        senderText,
        workspace,
        guild: interaction.inCachedGuild() ? interaction.guild : null,
        // `member` carries the admin event tools (agent-tools.ts). Expose it
        // ONLY in the /hoi lane, never in the "Hỏi AI" context menu: there
        // senderText is "" and the sole actionable content is an untrusted
        // quoted message, so dropping member (no member ⇒ no admin tools)
        // keeps that injection-prone lane tool-free mechanically instead of
        // relying on model obedience.
        member:
          interaction.isChatInputCommand() && interaction.inCachedGuild()
            ? interaction.member
            : undefined,
        channelId: interaction.channelId,
      }),
    });

    const chunks = chunkForDiscord(result.text);
    if (chunks.length === 0) chunks.push("😶 Mình không có gì để trả lời luôn.");

    await interaction.editReply(chunks[0]!);
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp(chunk);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply(
      error instanceof AgentLimitError ? message : `😵 Có lỗi rồi bro: ${message.slice(0, 200)}`,
    );
  } finally {
    cleanupImages();
  }
}

const hoi: Command = {
  data: new SlashCommandBuilder()
    .setName("hoi")
    .setDescription("Hỏi Orb Of AI bất cứ điều gì")
    .addStringOption((opt) =>
      opt.setName("cauhoi").setDescription("Câu hỏi của bạn").setRequired(true),
    ),
  // Right-click a message → Apps → "Hỏi AI": ask the agent about that message.
  contextMenus: [
    new ContextMenuCommandBuilder().setName("Hỏi AI").setType(ApplicationCommandType.Message),
  ],
  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;
    await interaction.deferReply();
    const question = interaction.options.getString("cauhoi", true);
    const prompt = `[${senderNameOf(interaction)}]: ${question}`;
    await askAgent(interaction, prompt, question);
  },
  async handleMessageContextMenu(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;

    const target = interaction.targetMessage;
    const botId = interaction.client.user.id;
    const stripBotMention = (content: string) =>
      content.replaceAll(`<@${botId}>`, "").replaceAll(`<@!${botId}>`, "").trim();
    const text = stripBotMention(target.content);
    const targetImages = collectImageCandidates([target]);
    if (!text && targetImages.length === 0) {
      await interaction.reply({
        content: "😅 Tin nhắn này trống trơn — không có chữ hay ảnh nào để mình đọc bro.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    // Quote the whole same-author burst around the clicked message, both
    // directions — users click the first or the last line of their run.
    // Best-effort: a failed fetch (missing Read Message History) falls back
    // to the clicked message alone.
    let quoted = text;
    let quotedCount = 1;
    // Images ride along the same burst the text quote does; fall back to just
    // the clicked message's own images if the neighbour fetch fails.
    let imageCandidates = targetImages;
    try {
      const [before, after] = await Promise.all([
        target.channel.messages.fetch({ before: target.id, limit: 10 }),
        target.channel.messages.fetch({ after: target.id, limit: 10 }),
      ]);
      const realPool = [...before.values(), target, ...after.values()];
      const pool = realPool.map((m) => ({
        id: m.id,
        authorId: m.author.id,
        createdTimestamp: m.createdTimestamp,
        content: m.content,
      }));
      const burst = collectBurst(pool, target.id);
      const burstIds = new Set(burst.map((m) => m.id));
      imageCandidates = collectImageCandidates(realPool.filter((m) => burstIds.has(m.id)));
      const texts = burst.map((m) => stripBotMention(m.content)).filter(Boolean);
      if (texts.length > 1) {
        quotedCount = texts.length;
        quoted = texts.join("\n");
        if (quoted.length > BURST_MAX_CHARS) quoted = `${quoted.slice(0, BURST_MAX_CHARS)}…`;
      }
    } catch {
      // Single-message fallback already in `quoted` + `imageCandidates`.
    }

    // Same session + speaker format as /hoi and the mention-chat lane; the
    // quoted-message framing mirrors the reply-to-bot prompt in chat.ts.
    const authorName = target.member?.displayName ?? target.author.displayName;
    const quoteLabel =
      quotedCount > 1
        ? `[Trích dẫn — ${quotedCount} tin nhắn liên tiếp của ${authorName}]`
        : `[Trích dẫn — tin nhắn của ${authorName}]`;
    const prompt = [
      `${quoteLabel}: ${quoted || "(chỉ có ảnh đính kèm)"}`,
      `[${senderNameOf(interaction)}]: (bấm "Hỏi AI" trên tin nhắn trích dẫn) Hãy trả lời hoặc giải thích tin nhắn trên.`,
    ].join("\n");
    // senderText "" — the invoker typed nothing here, so coin transfers are
    // mechanically impossible from this lane.
    await askAgent(interaction, prompt, "", imageCandidates);
  },
};

export default hoi;
