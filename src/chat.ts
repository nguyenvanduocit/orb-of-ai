// Agentic chat lane: mentions, DMs, and replies to the bot go to Claude.

import type { Message } from "discord.js";
import {
  AgentLimitError,
  AI_DISABLED_MESSAGE,
  buildAgentMcpServers,
  chunkForDiscord,
  clearSession,
  collectImageCandidates,
  downloadImages,
  runAgent,
  type AgentProgressEvent,
} from "./agent";
import { handleNoiTuMessage } from "./commands/noitu";
import { config } from "./config";
import { ensureWorkspace } from "./guilds";

// Friendly Vietnamese status per tool — raw names like "mcp__poe__poe_wealth"
// or a bare "Skill" mean nothing to chat users. Uses the tool_use input for
// specifics (file name, skill name, search query) when available.
function toolActivity(name: string, input?: Record<string, unknown>): string {
  const str = (key: string) => (typeof input?.[key] === "string" ? (input[key] as string) : undefined);
  const file = str("file_path")?.split("/").pop();
  switch (name) {
    case "Read":
      return file ? `📖 đang đọc \`${file}\`` : "📖 đang đọc file";
    case "Write":
    case "Edit":
      return file ? `✏️ đang viết \`${file}\`` : "✏️ đang viết file";
    case "Bash":
      return "💻 đang chạy lệnh";
    case "Grep":
    case "Glob":
      return "🔍 đang lục tìm";
    case "WebSearch": {
      const query = str("query");
      return query ? `🌐 đang tìm "${query.slice(0, 60)}"` : "🌐 đang tìm trên mạng";
    }
    case "WebFetch":
      return "🌐 đang đọc trang web";
    case "Skill": {
      const skill = str("skill") ?? str("command");
      return skill ? `✨ đang dùng skill \`${skill}\`` : "✨ đang dùng skill";
    }
    case "Task":
      return "🤖 đang nhờ agent phụ";
    case "TodoWrite":
      return "📝 đang lên kế hoạch";
  }
  if (name.startsWith("mcp__bot__")) return "🛠️ đang chạy chức năng bot";
  if (name.startsWith("mcp__poe__")) return "🎮 đang soi Path of Exile";
  const mcp = name.match(/^mcp__.+?__(.+)$/);
  return `🔧 đang dùng \`${mcp?.[1] ?? name}\``;
}

export async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  // Bot server-only: DM intent đã tắt nên message DM không tới đây — guard phòng hờ.
  if (!message.inGuild()) return;

  const botId = message.client.user.id;
  const isMentioned = message.mentions.users.has(botId);
  // The replied-to message decides the reply-to-bot lane AND feeds the quote
  // text + quoted images into the prompt, so fetch it whenever there is one.
  let referenced: Message | null = null;
  if (message.reference?.messageId) {
    try {
      referenced = await message.fetchReference();
    } catch {
      // Referenced message deleted or inaccessible.
    }
  }
  const isReplyToBot = referenced?.author.id === botId;
  if (!isMentioned && !isReplyToBot) {
    // A plain message might be a move in the channel's word-chain game.
    await handleNoiTuMessage(message);
    return;
  }

  // AI lanes off (AI_ENABLED=0): answer the mention/reply with a friendly notice
  // instead of spending Claude tokens. Non-AI features stay untouched.
  if (!config.aiEnabled) {
    await message.reply(AI_DISABLED_MESSAGE);
    return;
  }

  const content = message.content
    .replaceAll(`<@${botId}>`, "")
    .replaceAll(`<@!${botId}>`, "")
    .trim();

  // Claude only reads images from disk, so collect image attachments from this
  // message and the quoted one — they get downloaded into the workspace below.
  const imageCandidates = collectImageCandidates([message, referenced]);

  if (!content && imageCandidates.length === 0) {
    await message.reply("👋 Gọi mình hả bro? Nhắn gì đó đi, mình nghe nè.");
    return;
  }

  // Each server chats inside its own workspace.
  const workspace = ensureWorkspace(message.guildId);

  if (content === "clear" || content === "/clear") {
    clearSession(workspace, message.channelId);
    await message.reply("🧹 Đã xoá ngữ cảnh hội thoại. Bắt đầu lại từ đầu nhé bro.");
    return;
  }

  // Reply before the downloads so slow CDN fetches never look like silence.
  const placeholder = await message.reply("⏳ Đang suy nghĩ...");

  const { promptLines: imageLines, cleanup: cleanupImages } = await downloadImages(
    workspace,
    imageCandidates,
    message.id,
  );

  const senderName = message.member?.displayName ?? message.author.displayName;
  const promptParts: string[] = [];
  if (referenced) {
    const quotedName = referenced.member?.displayName ?? referenced.author.displayName;
    const quotedText = referenced.content
      .replaceAll(`<@${botId}>`, "")
      .replaceAll(`<@!${botId}>`, "")
      .trim();
    const quoted = quotedText.length > 500 ? `${quotedText.slice(0, 500)}…` : quotedText;
    promptParts.push(
      `[Trích dẫn — tin nhắn của ${quotedName} đang được trả lời]: ${quoted || "(chỉ có ảnh/file đính kèm)"}`,
    );
  }
  promptParts.push(`[${senderName}]: ${content || "(gửi ảnh, không có text)"}`);
  promptParts.push(...imageLines);
  const prompt = promptParts.join("\n");

  let inProgress = true;
  let streamedText = "";
  let activity: string | null = null; // current tool/thinking status, cleared when text resumes
  let dirty = false;
  // Serialize edits so a late progress edit never overwrites the final text.
  let editChain: Promise<unknown> = Promise.resolve();
  const queueEdit = (text: string) => {
    editChain = editChain
      .then(() => (inProgress ? placeholder.edit(text) : null))
      .catch(() => {}); // placeholder may have been deleted
  };

  // Live preview: the answer streamed so far (tail-cropped so it keeps moving),
  // with the current activity as a small subtext line underneath.
  const render = (): string => {
    const status = activity ? `-# ${activity}` : null;
    const text = streamedText.trim();
    if (!text) return status ?? "⏳ Đang suy nghĩ...";
    let preview = text.length > 1500 ? `…${text.slice(-1500)}` : text;
    // An unclosed ``` fence would swallow everything after it, status line included.
    if ((preview.match(/```/g)?.length ?? 0) % 2 === 1) preview += "\n```";
    return status ? `${preview}\n\n${status}` : preview;
  };

  const onEvent = (event: AgentProgressEvent) => {
    if (event.type === "text") {
      // Text resuming after a tool/thinking pause is a new assistant turn —
      // separate it from the previous one instead of gluing sentences together.
      if (activity !== null && streamedText) streamedText += "\n\n";
      streamedText += event.content;
      activity = null;
    } else if (event.type === "tool") {
      activity = toolActivity(event.content, event.input);
    } else {
      activity = "🧠 đang suy nghĩ…";
    }
    dirty = true;
  };

  // One edit per tick, only when something changed. Unlike a per-event
  // throttle, the last event before a long tool run still lands.
  const ticker = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    queueEdit(render());
  }, 1500);

  try {
    const { text } = await runAgent({
      sessionKey: message.channelId,
      prompt,
      cwd: workspace,
      onEvent,
      // Bot self-service (coin/điểm danh) + PoE tools, both bound to THIS
      // sender — the agent can only act on the account/money of whoever is
      // talking, never other members' data. `content` is sender-typed text
      // only (quotes excluded) — see buildAgentMcpServers.
      mcpServers: buildAgentMcpServers({
        senderId: message.author.id,
        senderText: content,
        workspace,
        guild: message.guild,
        member: message.member ?? undefined,
        channelId: message.channelId,
      }),
    });
    inProgress = false;
    await editChain;

    const final = text.trim() || "🤔 Mình xong việc rồi mà không có gì để nói luôn á.";
    const chunks = chunkForDiscord(final);

    await placeholder.edit(chunks[0] ?? final);
    for (const chunk of chunks.slice(1)) {
      if (message.channel.isSendable()) await message.channel.send(chunk);
      else await message.reply(chunk);
    }
  } catch (error) {
    console.error(`[chat] error in channel ${message.channelId}:`, error);
    inProgress = false;
    await editChain;
    const detail = error instanceof Error ? error.message : String(error);
    await placeholder
      .edit(
        error instanceof AgentLimitError
          ? detail
          : `😵 Có lỗi rồi bro: ${detail.slice(0, 200)}. Thử lại nhé.`,
      )
      .catch(() => {});
  } finally {
    clearInterval(ticker);
    cleanupImages();
  }
}
