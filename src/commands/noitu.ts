import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Client,
  type Message,
} from "discord.js";
import { botDisplayName, botPersona, botSystem, decideBot, isBotId, MAX_BOTS, mentionOrName, nextBotId } from "../bots";
import { againRow, fetchBoardMessage } from "../games";
import { loadCoins, saveCoins } from "../economy";
import { endGame, loadGame, saveGame } from "../guilds";
import { cancelDeadline, scheduleDeadline } from "../scheduler";
import { boardPayload, divider, text } from "../ui";
import type { Command } from "../types";

// Single source of truth for the persisted game tag AND the slash command name
// — the sweeper resolves teardown via commands.get(stored.game).
const GAME = "noitu";

export const STAKE = 20; // coins to join the lobby — payout at the end comes from this pot, nothing is minted mid-game
const BOT_TURN_DELAY_MS = 4000; // bot "suy nghĩ" một nhịp rồi mới nối từ, cho giống người thật

// React failures (usually a missing Add Reactions permission) are this game's
// only feedback channel — log once per channel so a mute game is diagnosable.
const reactWarned = new Set<string>();
function react(message: Message<true>, emoji: string): Promise<unknown> {
  return message.react(emoji).catch((error) => {
    if (reactWarned.has(message.channelId)) return;
    reactWarned.add(message.channelId);
    console.warn(`[noitu] cannot react in ${message.channelId} — missing "Add Reactions"?`, error);
  });
}

const SEED_WORDS = [
  "bầu trời",
  "con đường",
  "học sinh",
  "tình bạn",
  "mùa xuân",
  "cây xanh",
  "dòng sông",
  "ánh sáng",
  "quê hương",
  "biển cả",
];

interface NoiTuState {
  phase: "lobby" | "playing";
  host: string;
  messageId: string;
  players: string[]; // joined + staked STAKE coins each
  current: string; // last accepted word, lowercased
  used: string[];
  lastPlayer: string | null;
  counts: Record<string, number>;
}

// Pure core: validate a candidate against the chain.
// "not-word" means the message isn't a 2-syllable candidate at all — treat as normal chat.
export type WordVerdict = "ok" | "not-word" | "same-player" | "wrong-link" | "used";
export function checkWord(
  state: Pick<NoiTuState, "current" | "lastPlayer" | "used">,
  playerId: string,
  raw: string,
): { verdict: WordVerdict; word: string } {
  const word = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = word.split(" ");
  if (tokens.length !== 2 || !tokens.every((t) => /^\p{L}+$/u.test(t))) {
    return { verdict: "not-word", word };
  }
  if (state.lastPlayer === playerId) return { verdict: "same-player", word };
  const lastSyllable = state.current.split(" ").at(-1);
  if (tokens[0] !== lastSyllable) return { verdict: "wrong-link", word };
  if (state.used.includes(word)) return { verdict: "used", word };
  return { verdict: "ok", word };
}

// Pure core: split the pot (STAKE × joined players) among scorers, proportional
// to words chained. Nobody scored → everyone gets their stake back. Floor
// division always leaves the pot fully distributed by handing the rounding
// remainder to the top scorer instead of leaking coins from the system.
export function settlePot(state: Pick<NoiTuState, "players" | "counts">): {
  payouts: Record<string, number>;
  pot: number;
} {
  const pot = STAKE * state.players.length;
  const entries = Object.entries(state.counts).filter(([, count]) => count > 0);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);
  const payouts: Record<string, number> = {};

  if (totalCount === 0) {
    for (const userId of state.players) payouts[userId] = STAKE;
    return { payouts, pot };
  }

  let distributed = 0;
  for (const [userId, count] of entries) {
    const share = Math.floor((pot * count) / totalCount);
    payouts[userId] = share;
    distributed += share;
  }
  const remainder = pot - distributed;
  if (remainder > 0) {
    const top = entries.slice().sort((a, b) => b[1] - a[1])[0]![0];
    payouts[top] = (payouts[top] ?? 0) + remainder;
  }
  return { payouts, pot };
}

function payOut(payouts: Record<string, number>): void {
  const coins = loadCoins();
  for (const [userId, amount] of Object.entries(payouts)) {
    // Skip ghost entries — member left mid-round and lifecycle cleanup already removed them.
    if (amount > 0 && userId in coins) coins[userId] = coins[userId]! + amount;
  }
  saveCoins(coins);
}

function refundLobby(state: NoiTuState): void {
  const coins = loadCoins();
  for (const userId of state.players) {
    if (userId in coins) coins[userId] = coins[userId]! + STAKE;
  }
  saveCoins(coins);
}

// --- Người chơi bot (AI fill) ---
// Bot nối từ là người chơi PEER-POT: chúng vào `players` nhưng KHÔNG nạp coin —
// pot (STAKE × số người) tự mint phần cược của bot cho người thắng, payOut bỏ qua
// bot (không có trong ví) nên phần của bot tự đốt. Không phải sửa gì phần coin.
// Bot không thể "gõ" tin nhắn mà handleNoiTuMessage xử lý (nó khớp author.id thật),
// nên lượt bot chạy reducer TRỰC TIẾP rồi đăng từ qua tài khoản bot cho người thấy.

// Sinh một từ 2 tiếng nối tiếp bằng Haiku; fallback = null (bot bỏ lượt). Nối từ
// là game tiếng Việt nên Haiku (thạo tiếng Việt) là công cụ đúng; hết quota thì
// bot im lặng chứ không bao giờ treo ván.
async function generateBotWord(
  guildId: string,
  botId: string,
  current: string,
  used: string[],
): Promise<string | null> {
  const lastSyllable = current.split(" ").at(-1) ?? "";
  const persona = botPersona(botId);
  const recent = used.slice(-30).join(", ");
  const system = botSystem(
    persona,
    `Đây là game NỐI TỪ tiếng Việt. Trả về MỘT từ ghép/láy có ĐÚNG 2 tiếng, tiếng đầu bắt buộc là "${lastSyllable}", có nghĩa trong tiếng Việt và chưa từng dùng.`,
  );
  const prompt = `Từ hiện tại: "${current}". Nối một từ 2 tiếng bắt đầu bằng tiếng "${lastSyllable}". Tránh các từ đã dùng: ${recent || "(chưa có)"}. Trả JSON {"word":"<từ 2 tiếng>"}.`;
  return decideBot<string | null>({
    guildId,
    system,
    prompt,
    // Nới rộng timeout: lượt bot chạy nền (không chặn interaction nào) nên cứ cho
    // CLI Haiku đủ thời gian cold-start + suy nghĩ trên CPU nhỏ, thay vì abort sớm
    // rồi bỏ lượt. Đây là game NGÔN NGỮ — không có heuristic thuần toán thay được.
    maxMs: 30_000,
    fallback: null,
    validate: (parsed) => {
      const w = (parsed as { word?: unknown }).word;
      return typeof w === "string" && w.trim().split(/\s+/).length === 2 ? w.trim() : null;
    },
  });
}

// One bot's turn: pick an eligible bot (not the last player), generate a word,
// then validate+apply against FRESH state (a human may have played during the
// model call) so we never clobber a human's word — same atomic load→mutate→save
// invariant as handleNoiTuMessage. Posts the word via the bot account so humans
// see it and chain from it. Best-effort: any failure just skips the turn.
async function botTurn(client: Client, guildId: string, channelId: string): Promise<void> {
  const stored = loadGame(guildId, channelId);
  if (!stored || stored.game !== GAME) return;
  const state = stored.state as NoiTuState;
  if (state.phase !== "playing") return;
  const eligible = state.players.filter((id) => isBotId(id) && id !== state.lastPlayer);
  if (eligible.length === 0) return;
  const botId = eligible[Math.floor(Math.random() * eligible.length)]!;

  let candidate: string | null;
  try {
    candidate = await generateBotWord(guildId, botId, state.current, state.used);
  } catch (error) {
    console.warn(`[noitu] bot word gen failed in ${channelId}:`, error);
    return;
  }
  if (!candidate) return; // couldn't produce a valid word — bot passes this turn

  const fresh = loadGame(guildId, channelId);
  if (!fresh || fresh.game !== GAME) return;
  const s = fresh.state as NoiTuState;
  if (s.phase !== "playing" || s.lastPlayer === botId) return;
  const { verdict, word } = checkWord(s, botId, candidate);
  if (verdict !== "ok") return; // chain moved under us (a human played) — pass
  s.current = word;
  s.used.push(word);
  s.lastPlayer = botId;
  s.counts[botId] = (s.counts[botId] ?? 0) + 1;
  saveGame(guildId, channelId, { game: GAME, state: s });

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased() && !channel.isDMBased()) {
    await channel.send(`🔗 **${botDisplayName(botId)}**: ${word}`).catch(() => {});
  }
}

// One bounded bot response per trigger (game start + each accepted human word) —
// bots never chain among themselves, so no runaway API/spam. Best-effort: a timer
// lost to a restart just means bots stay quiet until the next human word.
function scheduleBotTurn(client: Client, guildId: string, channelId: string): void {
  scheduleDeadline(`${guildId}:${channelId}:botturn`, BOT_TURN_DELAY_MS, () => botTurn(client, guildId, channelId));
}

// Called from the chat lane for every plain (non-mention) guild message.
// Reactions: ✅ accepted · ❌ wrong link · ♻️ already used · 🚫 not your turn.
export async function handleNoiTuMessage(message: Message<true>): Promise<void> {
  const stored = loadGame(message.guildId, message.channelId);
  if (!stored || stored.game !== GAME) return;
  const state = stored.state as NoiTuState;
  if (state.phase !== "playing") return;
  if (!state.players.includes(message.author.id)) return; // didn't stake — chat doesn't score

  const { verdict, word } = checkWord(state, message.author.id, message.content);
  if (verdict === "not-word") return; // normal chatter in the channel
  if (verdict !== "ok") {
    const reaction = { "same-player": "🚫", "wrong-link": "❌", used: "♻️" }[verdict];
    await react(message, reaction);
    return;
  }

  state.current = word;
  state.used.push(word);
  state.lastPlayer = message.author.id;
  state.counts[message.author.id] = (state.counts[message.author.id] ?? 0) + 1;
  saveGame(message.guildId, message.channelId, { game: GAME, state });
  await react(message, "✅");
  // Cho một bot nối lại (nếu sòng có bot) — mỗi từ người chơi được một lượt bot đáp.
  if (state.players.some(isBotId)) scheduleBotTurn(message.client, message.guildId, message.channelId);
}

// --- Render (Components V2) ---
// Mọi board message dùng ContainerBuilder qua boardPayload. Buttons nằm TRONG
// container qua addActionRowComponents. Ephemeral replies là tin riêng biệt —
// giữ nguyên dạng content chuỗi, không chuyển V2.

function lobbyContainer(state: NoiTuState): ContainerBuilder {
  const pot = STAKE * state.players.length;
  const body = [
    "## 🔗 Nối từ — đang gầy sòng!",
    `Chủ sòng: <@${state.host}> — cược **${STAKE}** 🪙 để tham gia.`,
    "",
    state.players.length > 0
      ? `**Đã tham gia (${state.players.length}):** ${state.players.map((id) => mentionOrName(id)).join(", ")}`
      : "*Chưa ai tham gia — bấm Tham gia đi bro!*",
    "",
    "Đủ ít nhất 2 người thì chủ sòng bấm **Bắt đầu**. Không tham gia thì chat không được tính điểm đâu nhé.",
    `-# Pot hiện tại: ${pot} 🪙`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...lobbyRows());
}

function playingContainer(state: NoiTuState): ContainerBuilder {
  const pot = STAKE * state.players.length;
  const body = [
    "## 🔗 Nối từ — bắt đầu!",
    "Luật chơi: gõ thẳng từ **2 tiếng** vào kênh, tiếng đầu phải trùng tiếng cuối của từ trước.",
    "Không lặp từ đã dùng, không đi 2 lượt liên tiếp. Chỉ người đã tham gia (cược coin) mới được tính điểm.",
    `Ai nối được nhiều từ nhất ăn nhiều nhất từ pot **${pot}** 🪙 — không nối được từ nào thì mất cược. Chủ sòng bấm **Kết thúc** để chốt sổ.`,
    "",
    `Từ bắt đầu: **${state.current}** → nối với tiếng "**${state.current.split(" ").at(-1)}**"`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...playingRows());
}

// Shared by the /noitu stop button and the idle sweeper. The againRow is folded
// INSIDE the container so Discord renders it as part of the same V2 message.
function summaryContainer(
  state: NoiTuState,
  payouts: Record<string, number>,
  pot: number,
  note?: string,
): ContainerBuilder {
  const medals = ["🥇", "🥈", "🥉"];
  const ranking = state.players
    .map((userId) => ({ userId, count: state.counts[userId] ?? 0, payout: payouts[userId] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .map(
      ({ userId, count, payout }, i) =>
        `${medals[i] ?? `${i + 1}.`} ${mentionOrName(userId)} — ${count} từ → ${payout > 0 ? `**+${payout}**` : "mất cược"} 🪙`,
    );
  const body = [
    "## 🔗 Nối từ — tổng kết",
    ...(note ? [note, ""] : []),
    `Chuỗi dài **${state.used.length}** từ, kết thúc ở: **${state.current}**`,
    `Pot **${pot}** 🪙 đã chia xong.`,
    "",
    ranking.length > 0 ? ranking.join("\n") : "*Chưa ai tham gia ván này 😅*",
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(againRow(GAME, state.players.filter(isBotId).length));
}

// Used for cancelled/expired-lobby states and the "Ván mới" transition — no action rows.
function statusContainer(body: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## 🔗 Nối từ\n${body}`));
}

function lobbyRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("noitu:join").setLabel("Tham gia").setEmoji("✋").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("noitu:addbot").setLabel("Thêm bot").setEmoji("🤖").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("noitu:start").setLabel("Bắt đầu").setEmoji("▶️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("noitu:cancel").setLabel("Huỷ sòng").setStyle(ButtonStyle.Danger),
    ),
  ];
}

function playingRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("noitu:stop").setLabel("Kết thúc").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
    ),
  ];
}

// Shared lobby opener — the slash `execute` and the "Ván mới" button both call it.
// `send` posts the lobby (reply+fetchReply for a slash, followUp for a button);
// `initialBots` pre-adds that many bot players (the previous round's count, carried
// by the again button) — unfunded peer-pot players, so nothing to mint here.
async function startLobby(
  guildId: string,
  channelId: string,
  hostId: string,
  send: (payload: ReturnType<typeof boardPayload>) => Promise<Message>,
  initialBots: number,
): Promise<void> {
  const state: NoiTuState = {
    phase: "lobby",
    host: hostId,
    messageId: "",
    players: [],
    current: "",
    used: [],
    lastPlayer: null,
    counts: {},
  };
  // Reserve the channel slot BEFORE the first await.
  saveGame(guildId, channelId, { game: GAME, state });
  try {
    const message = await send(boardPayload(lobbyContainer(state)));
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) {
      const liveState = live.state as NoiTuState;
      liveState.messageId = message.id;
      for (let i = 0; i < Math.min(initialBots, MAX_BOTS); i++) {
        const botId = nextBotId(liveState.players.filter(isBotId));
        if (!botId) break;
        liveState.players.push(botId); // unfunded — pot mints their stake to the human winners
      }
      saveGame(guildId, channelId, { game: GAME, state: liveState });
      if (liveState.players.some(isBotId)) {
        await message.edit(boardPayload(lobbyContainer(liveState))).catch(() => {});
      }
    }
  } catch (error) {
    // The lobby may have been live for a moment — refund any stakes joined in that
    // window (from a re-load) before freeing the slot.
    const live = loadGame(guildId, channelId);
    if (live?.game === GAME) refundLobby(live.state as NoiTuState);
    endGame(guildId, channelId);
    throw error;
  }
}

const noitu: Command = {
  data: new SlashCommandBuilder()
    .setName(GAME)
    .setDescription("Mở sòng nối từ — cược coin để chơi, nối giỏi ăn nhiều từ pot"),
  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const existing = loadGame(guildId, channelId);
    if (existing) {
      const hint =
        existing.game === GAME
          ? "Kênh này đang có sòng nối từ rồi — bấm nút trên bảng đi bro."
          : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`;
      await interaction.reply({ content: hint, flags: MessageFlags.Ephemeral });
      return;
    }

    await startLobby(
      guildId,
      channelId,
      interaction.user.id,
      async (payload) => {
        await interaction.reply(payload);
        return interaction.fetchReply();
      },
      0, // fresh slash lobby starts empty; bots come from the button
    );
  },

  // Idle sweeper: nobody acted in time.
  // Lobby idle → refund every stake, nobody played yet.
  // Playing idle → chốt sổ giống nút Kết thúc, chia pot theo hiệu suất.
  async handleExpiredGame(client, guildId, channelId, stored) {
    const state = stored.state as NoiTuState;
    cancelDeadline(`${guildId}:${channelId}:botturn`); // dừng lượt bot đang chờ
    let container: ContainerBuilder;
    if (state.phase === "lobby") {
      refundLobby(state);
      endGame(guildId, channelId);
      container = statusContainer("⌛ Ế quá lâu không ai bắt đầu — huỷ sòng, coin cược đã hoàn lại đầy đủ.");
    } else {
      const { payouts, pot } = settlePot(state);
      payOut(payouts);
      endGame(guildId, channelId);
      container = summaryContainer(state, payouts, pot, "⌛ Im ắng quá lâu nên mình tự kết thúc ván nhé bro.");
    }
    try {
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      await message?.edit(boardPayload(container));
    } catch (error) {
      console.error(`[noitu] expire edit failed in ${channelId}:`, error);
    }
  },

  async handleButton(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const [, action, arg] = interaction.customId.split(":");

    // "Ván mới" acts on an ALREADY-ENDED game, so it runs BEFORE the game-exists
    // check below. Its id carries the previous round's bot count to auto-add.
    if (action === "again") {
      const existing = loadGame(guildId, channelId);
      if (existing) {
        await interaction.reply({
          content:
            existing.game === GAME
              ? "Kênh này đang có sòng nối từ rồi bro — xong sòng đó đã nhé."
              : `Kênh này đang chơi **${existing.game}** — xong ván đó đã bro.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const botCount = Math.min(MAX_BOTS, Math.max(0, Number(arg) || 0));
      // Replace the settled summary board with a status message, then open the new lobby below.
      await interaction.update(boardPayload(statusContainer("🔄 Ván mới đang mở bên dưới 👇")));
      await startLobby(guildId, channelId, interaction.user.id, (payload) => interaction.followUp(payload), botCount);
      return;
    }

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({
        content: "Sòng này kết thúc rồi bro — mở sòng mới bằng `/noitu` nhé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const state = stored.state as NoiTuState;

    if (action === "join") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Sòng đã bắt đầu rồi, không tham gia được nữa bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (state.players.includes(interaction.user.id)) {
        await interaction.reply({ content: "Bro tham gia rồi mà 😄", flags: MessageFlags.Ephemeral });
        return;
      }
      const coins = loadCoins();
      const balance = coins[interaction.user.id] ?? 0;
      if (balance < STAKE) {
        await interaction.reply({
          content: `Không đủ coin rồi bro — cần ${STAKE} 🪙 để tham gia, số dư: ${balance}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      coins[interaction.user.id] = balance - STAKE;
      saveCoins(coins);
      state.players.push(interaction.user.id);
      saveGame(guildId, channelId, { game: GAME, state });
      await interaction.update(boardPayload(lobbyContainer(state)));
      return;
    }

    if (action === "addbot") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Sòng đã bắt đầu rồi, không thêm bot được nữa bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const botId = nextBotId(state.players.filter(isBotId));
      if (!botId) {
        await interaction.reply({ content: `Đủ ${MAX_BOTS} bot rồi bro 🤖`, flags: MessageFlags.Ephemeral });
        return;
      }
      state.players.push(botId); // bot không nạp coin — pot tự mint phần cược của bot cho người thắng
      saveGame(guildId, channelId, { game: GAME, state });
      await interaction.update(boardPayload(lobbyContainer(state)));
      return;
    }

    if (action === "start") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Sòng đã bắt đầu rồi bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (interaction.user.id !== state.host) {
        await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> bắt đầu được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const humans = state.players.filter((id) => !isBotId(id)).length;
      if (humans === 0) {
        await interaction.reply({
          content: "Cần ít nhất 1 người thật tham gia mới bắt đầu được bro — bấm Tham gia đã nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (state.players.length < 2) {
        await interaction.reply({
          content: "Cần ít nhất 2 người chơi bro — bấm **Thêm bot** nếu muốn chơi cùng bot nhé.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const seed = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]!;
      state.phase = "playing";
      state.current = seed;
      state.used = [seed];
      state.lastPlayer = null;
      state.counts = {};
      saveGame(guildId, channelId, { game: GAME, state });
      await interaction.update(boardPayload(playingContainer(state)));
      // Bot mở màn: nối một từ ngay từ seed để sòng có nhịp (nếu có bot).
      if (state.players.some(isBotId)) scheduleBotTurn(interaction.client, guildId, channelId);
      return;
    }

    if (action === "cancel") {
      if (state.phase !== "lobby") {
        await interaction.reply({ content: "Sòng đang chơi rồi, không huỷ được — dùng nút Kết thúc nhé bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (interaction.user.id !== state.host) {
        await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> huỷ được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      refundLobby(state);
      endGame(guildId, channelId);
      await interaction.update(boardPayload(statusContainer("❌ Chủ sòng đã huỷ — coin cược đã hoàn lại đầy đủ.")));
      return;
    }

    if (action === "stop") {
      if (state.phase !== "playing") return;
      if (interaction.user.id !== state.host) {
        await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> kết thúc được nhé bro.`, flags: MessageFlags.Ephemeral });
        return;
      }
      cancelDeadline(`${guildId}:${channelId}:botturn`); // dừng lượt bot đang chờ
      const { payouts, pot } = settlePot(state);
      payOut(payouts);
      endGame(guildId, channelId);
      await interaction.update(boardPayload(summaryContainer(state, payouts, pot)));
      return;
    }
  },
};

export default noitu;
