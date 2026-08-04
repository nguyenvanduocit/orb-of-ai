// Ma sói (Werewolf) — the one game that needs people TALKING, so it lives in a
// voice channel's built-in text chat and only enrolls members currently sitting
// in that voice room. Same persisted-game skeleton as the board games
// (loadGame/saveGame/endGame per channel, best-effort deadline timers + lazy
// resolve + idle sweeper), but its own lobby → (đêm → ngày → vote)* → kết thúc
// state machine. Private role actions ride on EPHEMERAL replies because the bot
// has no DM channel (DM intent is off): one public "Hành động đêm" button opens
// a reply only the clicker sees, tailored to their role.
//
// Coin model: zero-sum peer pot like /noitu — everyone stakes, the winning
// faction (alive or dead) splits the pot evenly, nothing minted or burned.
//
// Pure core (assignRoles / winnerOf / countVotes / settlePayout) is exported and
// testable; everything with Discord or the ledger in it is the imperative shell.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type StringSelectMenuInteraction,
} from "discord.js";
import { fetchBoardMessage } from "../games";
import { boardPayload, divider, text } from "../ui";
import { loadCoins, saveCoins } from "../economy";
import { endGame, loadGame, saveGame, type StoredGame } from "../guilds";
import { cancelDeadline, scheduleDeadline } from "../scheduler";
import type { Command } from "../types";

const GAME = "masoi";

export const STAKE = 50; // coins into the pot to join — the winning faction splits it, nothing minted/burned
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20; // a Discord select menu holds 25 options; a 20-player ma sói is already huge

export const NIGHT_MS = 90_000;
export const DAY_MS = 120_000; // discussion window; the host can cut it short with "Bỏ phiếu"
export const VOTE_MS = 60_000;
const HUNTER_MS = 45_000; // a dying hunter's window to shoot before it auto-skips

type Role = "soi" | "tien_tri" | "bao_ve" | "phu_thuy" | "tho_san" | "dan";
type Team = "soi" | "dan";
type Phase = "lobby" | "night" | "day" | "vote" | "hunter" | "ended";

export const ROLE_META: Record<Role, { label: string; emoji: string; team: Team; blurb: string }> = {
  soi: { label: "Sói", emoji: "🐺", team: "soi", blurb: "Đêm cùng bầy chọn một người để ăn thịt. Thắng khi sói ≥ phe còn lại." },
  tien_tri: { label: "Tiên tri", emoji: "🔮", team: "dan", blurb: "Mỗi đêm soi một người để biết họ là Sói hay phe Dân." },
  bao_ve: { label: "Bảo vệ", emoji: "🛡️", team: "dan", blurb: "Mỗi đêm che chở một người khỏi bị sói cắn." },
  phu_thuy: { label: "Phù thuỷ", emoji: "🧪", team: "dan", blurb: "Có một bình CỨU và một bình ĐỘC, mỗi loại dùng đúng một lần cả ván." },
  tho_san: { label: "Thợ săn", emoji: "🏹", team: "dan", blurb: "Khi chết (bị cắn hoặc bị treo) được bắn theo một người." },
  dan: { label: "Dân làng", emoji: "👤", team: "dan", blurb: "Không có kỹ năng đêm — ban ngày dùng lý lẽ và lá phiếu để tìm sói." },
};

function teamOf(role: Role): Team {
  return role === "soi" ? "soi" : "dan";
}

interface NightActions {
  wolfVotes: Record<string, string>; // wolfId -> targetId (last pick wins per wolf)
  seerUsed: boolean;
  guardTarget: string | null;
  witchWillSave: boolean; // heals whoever the pack bites tonight (potion consumed only if there IS a victim)
  witchPoisonTarget: string | null;
}

interface MaSoiState {
  phase: Phase;
  host: string;
  voiceChannelId: string; // the voice channel this game is bound to (== the text-chat channelId)
  messageId: string; // the one board message we keep editing across phases
  deadline: number; // epoch ms for the current timed phase — persisted so a restart resolves lazily
  round: number; // 1-based đêm/ngày cycle
  players: string[];
  roles: Record<string, Role>;
  alive: Record<string, boolean>;
  night: NightActions;
  votes: Record<string, string>; // voterId -> targetId, reset each vote phase
  witchSave: boolean; // save potion still available (game-long)
  witchPoison: boolean; // poison potion still available (game-long)
  pendingHunter: string | null; // a dead hunter owes a shot before play continues
  huntersResolved: string[]; // hunters whose shot (or timeout) is already spent
  resolving: "night" | "vote" | null; // which resolution a hunter gate is interrupting
  log: string[]; // narration, newest last
  winnerTeam?: Team; // set on end for the final embed
  payouts?: Record<string, number>; // set on end for the final embed
}

function freshNight(): NightActions {
  return { wolfVotes: {}, seerUsed: false, guardTarget: null, witchWillSave: false, witchPoisonTarget: null };
}

function key(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

// ---------- Pure core (exported, testable) ----------

// Deterministic-free shuffle for role dealing — mirrors how the other games use
// Math.random (baucua dice, noitu seed). Not security-sensitive.
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Deal roles for n players: ~1 wolf per 4, then hand out each special once (in a
// fixed priority) while keeping at least one plain Dân, then fill the rest with Dân.
export function assignRoles(players: string[]): Record<string, Role> {
  const n = players.length;
  const wolves = Math.min(4, Math.max(1, Math.floor(n / 4)));
  const deck: Role[] = Array.from({ length: wolves }, () => "soi");
  for (const special of ["tien_tri", "bao_ve", "phu_thuy", "tho_san"] as const) {
    if (deck.length < n - 1) deck.push(special); // n-1 keeps ≥1 Dân
  }
  while (deck.length < n) deck.push("dan");

  const dealtRoles = shuffle(deck);
  const dealtPlayers = shuffle(players);
  const roles: Record<string, Role> = {};
  dealtPlayers.forEach((p, i) => (roles[p] = dealtRoles[i]!));
  return roles;
}

// Winner from the living: village wins with no wolves left; wolves win once they
// equal or outnumber the rest (they can't be voted out anymore). null = play on.
export function winnerOf(state: Pick<MaSoiState, "players" | "roles" | "alive">): Team | null {
  const living = state.players.filter((p) => state.alive[p]);
  const wolves = living.filter((p) => state.roles[p] === "soi").length;
  const others = living.length - wolves;
  if (wolves === 0) return "dan";
  if (wolves >= others) return "soi";
  return null;
}

// Tally a {voterId: targetId} map into the leading target(s). `top` holds every
// target tied for the most votes — callers decide what a tie means (wolves pick
// one at random and still kill; a village lynch tie spares everyone).
export function countVotes(votes: Record<string, string>): { top: string[]; max: number } {
  const counts: Record<string, number> = {};
  for (const target of Object.values(votes)) counts[target] = (counts[target] ?? 0) + 1;
  let max = 0;
  for (const c of Object.values(counts)) if (c > max) max = c;
  const top = Object.entries(counts)
    .filter(([, c]) => c === max)
    .map(([id]) => id);
  return { top, max };
}

// The winning faction (alive OR dead — you win if your team wins) splits the pot
// evenly; floor division hands the rounding remainder to the first winner so the
// pot never leaks coins.
export function settlePayout(
  players: string[],
  roles: Record<string, Role>,
  winner: Team,
  stake: number,
): Record<string, number> {
  const winners = players.filter((p) => teamOf(roles[p]!) === winner);
  const payouts: Record<string, number> = {};
  if (winners.length === 0) return payouts;
  const pot = stake * players.length;
  const share = Math.floor(pot / winners.length);
  let distributed = 0;
  for (const w of winners) {
    payouts[w] = share;
    distributed += share;
  }
  const remainder = pot - distributed;
  if (remainder > 0 && winners[0]) payouts[winners[0]] += remainder;
  return payouts;
}

// ---------- Ledger shell ----------

function refundStakes(players: string[]): void {
  const coins = loadCoins();
  for (const userId of players) {
    if (userId in coins) coins[userId] = coins[userId]! + STAKE; // ghost-guard: skip members who left
  }
  saveCoins(coins);
}

function applyPayout(payouts: Record<string, number>): void {
  const coins = loadCoins();
  for (const [userId, amount] of Object.entries(payouts)) {
    if (amount > 0 && userId in coins) coins[userId] = coins[userId]! + amount;
  }
  saveCoins(coins);
}

// ---------- Rendering ----------

function nameOf(guild: Guild | null, id: string): string {
  return guild?.members.cache.get(id)?.displayName ?? "Người chơi";
}

function livingIds(state: MaSoiState): string[] {
  return state.players.filter((p) => state.alive[p]);
}

function rosterLines(state: MaSoiState, revealDead: boolean): string {
  return state.players
    .map((p) => {
      if (state.alive[p]) return `• <@${p}>`;
      const role = state.roles[p]!;
      return revealDead ? `• ~~<@${p}>~~ ☠️ (${ROLE_META[role].emoji} ${ROLE_META[role].label})` : `• ~~<@${p}>~~ ☠️`;
    })
    .join("\n");
}

function tailLog(state: MaSoiState, n = 8): string {
  return state.log.slice(-n).join("\n");
}

// The board is ONE public Components V2 message across its whole lifecycle (lobby
// → đêm → ngày → vote → hunter → kết thúc). Discord forbids editing a classic
// message into V2 (and back), so every phase renders a ContainerBuilder and the
// board's buttons live INSIDE the container (via boardContainer below). `## `
// titles / `-# ` subtext / setAccentColor mirror the old embed title/footer/color.
// Helper V2 (boardPayload/text/divider) is shared from ../ui.

function lobbyContainer(state: MaSoiState): ContainerBuilder {
  const pot = STAKE * state.players.length;
  const body = [
    "## 🐺 Ma Sói — đang gầy sòng!",
    `Chủ sòng: <@${state.host}> · cược **${STAKE}** 🪙 để tham gia (phe thắng chia đều pot).`,
    `Chỉ ai **đang trong kênh voice này** mới vào được — cần tối thiểu **${MIN_PLAYERS}** người.`,
    "",
    state.players.length > 0
      ? `**Đã vào (${state.players.length}/${MAX_PLAYERS}):** ${state.players.map((id) => `<@${id}>`).join(", ")}`
      : "*Chưa ai vào — bấm Tham gia đi bro!*",
    "",
    `-# Pot hiện tại: ${pot} 🪙`,
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0x5865f2).addTextDisplayComponents(text(body));
}

function nightContainer(state: MaSoiState): ContainerBuilder {
  const body = [
    `## 🌙 Đêm ${state.round} — cả làng nhắm mắt`,
    "Ai có vai đêm bấm **🌙 Hành động đêm** để ra tay (kín — chỉ mình bạn thấy).",
    "Dân làng cứ ngủ ngon, chờ trời sáng 😴",
    "",
    `**Còn sống (${livingIds(state).length}):**`,
    rosterLines(state, true),
    "",
    "-# Đêm sẽ khép lại khi hết giờ",
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0x2b2d42).addTextDisplayComponents(text(body));
}

function dayContainer(state: MaSoiState): ContainerBuilder {
  const body = [
    `## ☀️ Ngày ${state.round} — trời sáng`,
    tailLog(state),
    "",
    "Cả làng thảo luận (nói chuyện trong voice), rồi chủ sòng bấm **🗳️ Bỏ phiếu** để mở phiên treo cổ.",
    "",
    `**Còn sống (${livingIds(state).length}):**`,
    rosterLines(state, true),
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0xfaa61a).addTextDisplayComponents(text(body));
}

function voteContainer(state: MaSoiState): ContainerBuilder {
  const body = [
    `## 🗳️ Ngày ${state.round} — bỏ phiếu treo cổ`,
    "Mỗi người còn sống bấm **🗳️ Bỏ phiếu** rồi chọn người muốn treo. Nhiều phiếu nhất bị treo, hoà thì không ai chết.",
    `Đã bỏ phiếu: **${Object.keys(state.votes).length}/${livingIds(state).length}**`,
    "",
    "**Còn sống:**",
    rosterLines(state, true),
    "",
    "-# Hết giờ sẽ tự chốt theo số phiếu hiện có",
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0xed4245).addTextDisplayComponents(text(body));
}

function hunterContainer(state: MaSoiState): ContainerBuilder {
  const body = [
    "## 🏹 Thợ săn ngã xuống!",
    tailLog(state),
    "",
    `**<@${state.pendingHunter}>** là Thợ săn — bấm **🏹 Bắn** để kéo theo một người trước khi nhắm mắt (hết giờ thì thôi).`,
  ].join("\n");
  return new ContainerBuilder().setAccentColor(0x8b0000).addTextDisplayComponents(text(body));
}

function endContainer(state: MaSoiState): ContainerBuilder {
  const win = state.winnerTeam!;
  const payouts = state.payouts ?? {};
  const roster = state.players
    .map((p) => {
      const role = state.roles[p]!;
      const won = teamOf(role) === win;
      const paid = payouts[p] ?? 0;
      const status = state.alive[p] ? "sống sót" : "đã chết";
      return `${ROLE_META[role].emoji} <@${p}> — ${ROLE_META[role].label} · ${status}${won ? ` → **+${paid}** 🪙` : ""}`;
    })
    .join("\n");
  const body = [
    win === "soi" ? "## 🐺 Bầy Sói toàn thắng!" : "## 🎉 Dân làng chiến thắng!",
    tailLog(state, 4),
    "",
    win === "soi" ? "Bóng tối nuốt trọn ngôi làng 🌑" : "Ánh sáng đã quét sạch lũ sói ☀️",
    "",
    "**Lộ vai — kết quả:**",
    roster,
    "",
    `-# Pot ${STAKE * state.players.length} 🪙 đã chia cho phe thắng`,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(win === "soi" ? 0x992d22 : 0x57f287)
    .addTextDisplayComponents(text(body));
}

// Status card for lobby cancel / idle expire — a plain grey container with no buttons.
function statusContainer(body: string): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x99aab5).addTextDisplayComponents(text(`## 🐺 Ma Sói\n${body}`));
}

function componentsFor(state: MaSoiState): ActionRowBuilder<ButtonBuilder>[] {
  const roleBtn = new ButtonBuilder().setCustomId("masoi:role").setLabel("Xem vai").setEmoji("🎭").setStyle(ButtonStyle.Secondary);
  switch (state.phase) {
    case "lobby":
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("masoi:join").setLabel("Tham gia").setEmoji("✋").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("masoi:start").setLabel("Bắt đầu").setEmoji("▶️").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("masoi:cancel").setLabel("Huỷ sòng").setStyle(ButtonStyle.Danger),
        ),
      ];
    case "night":
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("masoi:night").setLabel("Hành động đêm").setEmoji("🌙").setStyle(ButtonStyle.Primary),
          roleBtn,
        ),
      ];
    case "day":
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("masoi:vote_open").setLabel("Bỏ phiếu").setEmoji("🗳️").setStyle(ButtonStyle.Danger),
          roleBtn,
        ),
      ];
    case "vote":
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("masoi:vote").setLabel("Bỏ phiếu").setEmoji("🗳️").setStyle(ButtonStyle.Primary),
          roleBtn,
        ),
      ];
    case "hunter":
      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("masoi:hunter").setLabel("Bắn").setEmoji("🏹").setStyle(ButtonStyle.Danger),
        ),
      ];
    default:
      return [];
  }
}

// Build an ephemeral target picker over the living, optionally excluding one id
// (e.g. the actor themselves) and prepending a "clear" option.
function targetSelect(
  state: MaSoiState,
  guild: Guild | null,
  customId: string,
  placeholder: string,
  opts: { exclude?: string[]; clearLabel?: string } = {},
): ActionRowBuilder<StringSelectMenuBuilder> {
  const exclude = new Set(opts.exclude ?? []);
  const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);
  if (opts.clearLabel) menu.addOptions({ label: opts.clearLabel, value: "none" });
  for (const id of livingIds(state)) {
    if (exclude.has(id)) continue;
    menu.addOptions({ label: nameOf(guild, id), value: id });
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

// ---------- Board delivery + scheduling ----------

async function editBoard(client: Client, state: MaSoiState, channelId: string): Promise<void> {
  try {
    const message = await fetchBoardMessage(client, channelId, state.messageId);
    if (message) await message.edit(boardPayload(boardContainer(state)));
  } catch (error) {
    console.error(`[masoi] board edit failed in ${channelId}:`, error);
  }
}

// The phase's container WITH its buttons attached — the one thing every board
// send/edit renders through boardPayload. The `ended` phase has no buttons
// (componentsFor returns []), so the rows are appended only when present.
function boardContainer(state: MaSoiState): ContainerBuilder {
  let container: ContainerBuilder;
  switch (state.phase) {
    case "lobby":
      container = lobbyContainer(state);
      break;
    case "night":
      container = nightContainer(state);
      break;
    case "day":
      container = dayContainer(state);
      break;
    case "vote":
      container = voteContainer(state);
      break;
    case "hunter":
      container = hunterContainer(state);
      break;
    default:
      container = endContainer(state);
  }
  const rows = componentsFor(state);
  if (rows.length > 0) container.addSeparatorComponents(divider()).addActionRowComponents(...rows);
  return container;
}

const TIMED: Phase[] = ["night", "day", "vote", "hunter"];

// Persist state, (re)arm the deadline timer for timed phases, then repaint the
// board. Ledger writes already happened synchronously in the caller.
async function commit(client: Client, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase === "ended") {
    cancelDeadline(key(guildId, channelId));
    endGame(guildId, channelId);
  } else {
    saveGame(guildId, channelId, { game: GAME, state });
    if (TIMED.includes(state.phase)) {
      scheduleDeadline(key(guildId, channelId), Math.max(0, state.deadline - Date.now()) + 250, () =>
        onDeadline(client, guildId, channelId),
      );
    }
  }
  await editBoard(client, state, channelId);
}

// ---------- Phase transitions (synchronous state mutation) ----------

function toNight(state: MaSoiState): void {
  state.round += 1;
  state.phase = "night";
  state.night = freshNight();
  state.votes = {};
  state.deadline = Date.now() + NIGHT_MS;
}

function toDay(state: MaSoiState): void {
  state.phase = "day";
  state.deadline = Date.now() + DAY_MS;
}

function toVote(state: MaSoiState): void {
  state.phase = "vote";
  state.votes = {};
  state.deadline = Date.now() + VOTE_MS;
}

// Apply a set of deaths, then decide what happens next. Returns after mutating
// `state` into its next phase (night/day/vote/hunter/ended). A freshly-dead
// Thợ săn gates everything into a "hunter" phase until their shot is spent; only
// once no un-resolved dead hunter remains do we run the win check and advance
// along the current `resolving` context (night→day, vote→night).
function applyDeathsAndAdvance(state: MaSoiState, deaths: Iterable<string>): void {
  for (const id of deaths) {
    if (state.alive[id]) {
      state.alive[id] = false;
      const role = state.roles[id]!;
      state.log.push(`☠️ <@${id}> đã chết — là ${ROLE_META[role].emoji} **${ROLE_META[role].label}**.`);
    }
  }
  advance(state);
}

function advance(state: MaSoiState): void {
  const deadHunter = state.players.find(
    (p) => state.roles[p] === "tho_san" && !state.alive[p] && !state.huntersResolved.includes(p),
  );
  if (deadHunter) {
    state.pendingHunter = deadHunter;
    state.phase = "hunter";
    state.deadline = Date.now() + HUNTER_MS;
    state.log.push(`🏹 <@${deadHunter}> là Thợ săn — được bắn theo một người!`);
    return;
  }
  const winner = winnerOf(state);
  if (winner) {
    state.winnerTeam = winner;
    state.phase = "ended";
    return;
  }
  if (state.resolving === "night") toDay(state);
  else toNight(state); // after a vote (or a lynch-triggered hunter chain)
  state.resolving = null;
}

// Resolve the night's actions into deaths, then advance. Synchronous.
function resolveNight(state: MaSoiState): void {
  state.resolving = "night";
  const deaths = new Set<string>();

  // Wolf victim: the pack's majority target (ties → one at random) among living non-wolves.
  const { top } = countVotes(state.night.wolfVotes);
  const victim = top.length > 0 ? top[Math.floor(Math.random() * top.length)]! : null;

  if (victim && state.alive[victim]) {
    const guardSaved = state.night.guardTarget === victim;
    const witchSaved = state.night.witchWillSave && state.witchSave;
    if (witchSaved) state.witchSave = false; // potion spent only because there WAS a victim to save
    if (guardSaved || witchSaved) {
      state.log.push("🛡️ Sói ra tay trong đêm, nhưng có người được che chở — không ai chết vì sói.");
    } else {
      deaths.add(victim);
    }
  } else {
    state.log.push("🌙 Đêm qua bầy sói không hạ được ai.");
  }

  // Witch poison bypasses guard/save — a separate kill.
  const poison = state.night.witchPoisonTarget;
  if (poison && state.witchPoison && state.alive[poison]) {
    state.witchPoison = false;
    deaths.add(poison);
  }

  if (deaths.size === 0 && !state.log[state.log.length - 1]?.startsWith("🛡️")) {
    state.log.push("🌅 Trời sáng, đêm qua yên bình — không ai thiệt mạng.");
  }
  applyDeathsAndAdvance(state, deaths);
}

// Tally the lynch vote into at most one death, then advance. Synchronous.
function resolveVote(state: MaSoiState): void {
  state.resolving = "vote";
  const { top, max } = countVotes(state.votes);
  if (max > 0 && top.length === 1) {
    const lynched = top[0]!;
    state.log.push(`🪢 Cả làng đã treo cổ <@${lynched}>.`);
    applyDeathsAndAdvance(state, [lynched]);
  } else {
    state.log.push("🤷 Phiếu không tập trung — hôm nay không ai bị treo.");
    applyDeathsAndAdvance(state, []);
  }
}

// A hunter's shot (or their timeout) resolves, then play continues.
function resolveHunterShot(state: MaSoiState, target: string | null): void {
  const hunter = state.pendingHunter;
  if (!hunter) return;
  state.huntersResolved.push(hunter);
  state.pendingHunter = null;
  if (target && state.alive[target]) {
    state.log.push(`🏹 Thợ săn bắn hạ <@${target}> trước khi ngã xuống!`);
    applyDeathsAndAdvance(state, [target]);
  } else {
    state.log.push("🏹 Thợ săn không kịp bắn ai.");
    advance(state);
  }
}

// End-of-game side effects: pay the winning faction and stamp the payouts for
// the final embed. Synchronous ledger write.
function finalizeIfEnded(state: MaSoiState): void {
  if (state.phase !== "ended" || !state.winnerTeam) return;
  const payouts = settlePayout(state.players, state.roles, state.winnerTeam, STAKE);
  applyPayout(payouts);
  state.payouts = payouts;
}

// The single deadline handler: reload, verify the phase is still the timed one,
// resolve it synchronously (ledger writes before any await), then commit.
async function onDeadline(client: Client, guildId: string, channelId: string): Promise<void> {
  const stored = loadGame(guildId, channelId);
  if (!stored || stored.game !== GAME) return;
  const state = stored.state as MaSoiState;
  if (!TIMED.includes(state.phase)) return;
  if (Date.now() < state.deadline - 1000) return; // superseded by a newer phase — its own timer will fire

  if (state.phase === "night") resolveNight(state);
  else if (state.phase === "day") toVote(state);
  else if (state.phase === "vote") resolveVote(state);
  else if (state.phase === "hunter") resolveHunterShot(state, null);

  finalizeIfEnded(state);
  await commit(client, guildId, channelId, state);
}

// ---------- Command ----------

const masoi: Command = {
  data: new SlashCommandBuilder()
    .setName(GAME)
    .setDescription("Mở sòng Ma Sói trong kênh voice — cược coin, phe thắng chia pot"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    // Ma sói lives in a voice channel's built-in text chat — that's where the
    // players sit and talk. Refuse anywhere else.
    if (interaction.channel?.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "Ma Sói phải chơi trong khung chat của một **kênh voice** bro — vào kênh voice rồi gõ `/masoi` ngay trong đó nhé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const inThisVoice = interaction.guild?.voiceStates.cache.get(interaction.user.id)?.channelId === channelId;
    if (!inThisVoice) {
      await interaction.reply({
        content: "Bro phải đang ngồi trong kênh voice này mới mở sòng được nhé 🎙️",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = loadGame(guildId, channelId);
    if (existing) {
      const hint =
        existing.game === GAME
          ? "Kênh này đang có sòng Ma Sói rồi — bấm nút trên bảng đi bro."
          : `Kênh này đang chơi **${existing.game}** — kết thúc game đó trước đã bro.`;
      await interaction.reply({ content: hint, flags: MessageFlags.Ephemeral });
      return;
    }

    // Host joins + stakes on open. Synchronous check→deduct→save.
    const coins = loadCoins();
    if ((coins[interaction.user.id] ?? 0) < STAKE) {
      await interaction.reply({
        content: `Cần ${STAKE} 🪙 để mở sòng bro — số dư: ${coins[interaction.user.id] ?? 0}. Điểm danh /diemdanh kiếm coin nhé!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    coins[interaction.user.id] = coins[interaction.user.id]! - STAKE;
    saveCoins(coins);

    const state: MaSoiState = {
      phase: "lobby",
      host: interaction.user.id,
      voiceChannelId: channelId,
      messageId: "",
      deadline: 0,
      round: 0,
      players: [interaction.user.id],
      roles: {},
      alive: {},
      night: freshNight(),
      votes: {},
      witchSave: true,
      witchPoison: true,
      pendingHunter: null,
      huntersResolved: [],
      resolving: null,
      log: [],
    };
    // Reserve the channel slot BEFORE the first await so two /masoi in the same
    // window can't both pass the existence check.
    saveGame(guildId, channelId, { game: GAME, state });
    try {
      await interaction.reply(boardPayload(boardContainer(state)));
      const message = await interaction.fetchReply();
      const live = loadGame(guildId, channelId);
      if (live?.game === GAME) {
        const liveState = live.state as MaSoiState;
        liveState.messageId = message.id;
        saveGame(guildId, channelId, { game: GAME, state: liveState });
      }
    } catch (error) {
      const live = loadGame(guildId, channelId);
      if (live?.game === GAME) refundStakes((live.state as MaSoiState).players);
      endGame(guildId, channelId);
      throw error;
    }
  },

  // Idle sweeper: a sòng nobody touched for too long — refund every stake and close.
  async handleExpiredGame(client, guildId, channelId, stored: StoredGame) {
    const state = stored.state as MaSoiState;
    cancelDeadline(key(guildId, channelId));
    refundStakes(state.players);
    endGame(guildId, channelId);
    try {
      const message = await fetchBoardMessage(client, channelId, state.messageId);
      await message?.edit(boardPayload(statusContainer("⌛ Im ắng quá lâu nên mình huỷ ván — coin cược đã hoàn lại đầy đủ.")));
    } catch (error) {
      console.error(`[masoi] expire edit failed in ${channelId}:`, error);
    }
  },

  async handleButton(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const action = interaction.customId.split(":")[1]!;

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.reply({ content: "Sòng này kết thúc rồi bro — mở sòng mới bằng `/masoi` nhé.", flags: MessageFlags.Ephemeral });
      return;
    }
    const state = stored.state as MaSoiState;

    // Lazy resolve for timers lost to a restart: if this timed phase is overdue,
    // settle it first and tell the clicker the phase moved on.
    if (TIMED.includes(state.phase) && Date.now() > state.deadline + 1000) {
      await onDeadline(interaction.client, guildId, channelId);
      await interaction.reply({ content: "⏱️ Pha vừa kết thúc — xem bảng để theo diễn biến mới nhé bro.", flags: MessageFlags.Ephemeral });
      return;
    }

    switch (action) {
      case "join":
        return joinLobby(interaction, guildId, channelId, state);
      case "start":
        return startGame(interaction, guildId, channelId, state);
      case "cancel":
        return cancelLobby(interaction, guildId, channelId, state);
      case "role":
        return showRole(interaction, state);
      case "night":
        return openNightAction(interaction, state);
      case "save":
        return toggleWitchSave(interaction, guildId, channelId, state);
      case "vote_open":
        return openVotePhase(interaction, guildId, channelId, state);
      case "vote":
        return openVoteAction(interaction, state);
      case "hunter":
        return openHunterShot(interaction, state);
    }
  },

  async handleSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const action = interaction.customId.split(":")[1]!;

    const stored = loadGame(guildId, channelId);
    if (!stored || stored.game !== GAME) {
      await interaction.update({ content: "Ván đã kết thúc rồi bro.", components: [] });
      return;
    }
    const state = stored.state as MaSoiState;
    const choice = interaction.values[0]!;

    switch (action) {
      case "kill":
        return recordKill(interaction, guildId, channelId, state, choice);
      case "seer":
        return recordSeer(interaction, guildId, channelId, state, choice);
      case "guard":
        return recordGuard(interaction, guildId, channelId, state, choice);
      case "poison":
        return recordPoison(interaction, guildId, channelId, state, choice);
      case "vote":
        return recordVote(interaction, guildId, channelId, state, choice);
      case "huntershot":
        return recordHunterShot(interaction, guildId, channelId, state, choice);
    }
  },
};

// ---------- Lobby handlers ----------

async function joinLobby(interaction: ButtonInteraction, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Sòng đã bắt đầu rồi, không vào được nữa bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.players.includes(interaction.user.id)) {
    await interaction.reply({ content: "Bro vào rồi mà 😄", flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.players.length >= MAX_PLAYERS) {
    await interaction.reply({ content: `Sòng đã đủ ${MAX_PLAYERS} người rồi bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.guild?.voiceStates.cache.get(interaction.user.id)?.channelId !== channelId) {
    await interaction.reply({ content: "Phải đang ngồi trong kênh voice này mới tham gia được nhé bro 🎙️", flags: MessageFlags.Ephemeral });
    return;
  }
  const coins = loadCoins();
  if ((coins[interaction.user.id] ?? 0) < STAKE) {
    await interaction.reply({
      content: `Không đủ coin bro — cần ${STAKE} 🪙, số dư: ${coins[interaction.user.id] ?? 0}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  coins[interaction.user.id] = coins[interaction.user.id]! - STAKE;
  saveCoins(coins);
  state.players.push(interaction.user.id);
  saveGame(guildId, channelId, { game: GAME, state });
  await interaction.update(boardPayload(boardContainer(state)));
}

async function startGame(interaction: ButtonInteraction, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Sòng đã bắt đầu rồi bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== state.host) {
    await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> bắt đầu được nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  // Drop + refund anyone who wandered out of the voice channel before start.
  const voiceStates = interaction.guild?.voiceStates.cache;
  const present = state.players.filter((p) => voiceStates?.get(p)?.channelId === channelId);
  const dropped = state.players.filter((p) => !present.includes(p));
  if (dropped.length > 0) {
    refundStakes(dropped);
    state.players = present;
  }
  if (state.players.length < MIN_PLAYERS) {
    saveGame(guildId, channelId, { game: GAME, state });
    await interaction.update(boardPayload(boardContainer(state)));
    const note = dropped.length > 0 ? ` (đã loại ${dropped.length} người rời voice và hoàn coin)` : "";
    await interaction.followUp({
      content: `Cần tối thiểu ${MIN_PLAYERS} người đang trong voice mới bắt đầu được bro${note}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  state.roles = assignRoles(state.players);
  for (const p of state.players) state.alive[p] = true;
  state.log = ["🌑 Màn đêm buông xuống ngôi làng..."];
  toNight(state); // round 0 → 1
  saveGame(guildId, channelId, { game: GAME, state });
  scheduleDeadline(key(guildId, channelId), NIGHT_MS + 250, () => onDeadline(interaction.client, guildId, channelId));
  await interaction.update(boardPayload(boardContainer(state)));
}

async function cancelLobby(interaction: ButtonInteraction, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase !== "lobby") {
    await interaction.reply({ content: "Ván đang chơi rồi, không huỷ được bro — cứ chơi cho hết nhé.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== state.host) {
    await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> huỷ được nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  refundStakes(state.players);
  endGame(guildId, channelId);
  await interaction.update(boardPayload(statusContainer("❌ Chủ sòng đã huỷ — coin cược đã hoàn lại đầy đủ.")));
}

// ---------- Shared guards ----------

function ensurePlayer(state: MaSoiState, userId: string): string | null {
  if (!state.players.includes(userId)) return "Bro không ở trong ván này — hóng thôi nhé 👀";
  if (!state.alive[userId]) return "Bro chết rồi 👻 — người chết không hành động được nữa.";
  return null;
}

async function showRole(interaction: ButtonInteraction, state: MaSoiState): Promise<void> {
  if (!state.players.includes(interaction.user.id)) {
    await interaction.reply({ content: "Bro không ở trong ván này nên không có vai nhé.", flags: MessageFlags.Ephemeral });
    return;
  }
  const role = state.roles[interaction.user.id];
  if (!role) {
    await interaction.reply({ content: "Vai chưa được chia — chờ chủ sòng bấm Bắt đầu nhé bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  const meta = ROLE_META[role];
  const lines = [`Vai của bạn: ${meta.emoji} **${meta.label}**`, meta.blurb];
  if (role === "soi") {
    const pack = state.players.filter((p) => p !== interaction.user.id && state.roles[p] === "soi");
    lines.push(pack.length > 0 ? `\n🐺 Đồng bọn: ${pack.map((id) => `<@${id}>`).join(", ")}` : "\n🐺 Bạn là sói đơn độc.");
  }
  if (role === "phu_thuy") {
    lines.push(`\n🧪 Bình cứu: ${state.witchSave ? "còn" : "đã dùng"} · ☠️ Bình độc: ${state.witchPoison ? "còn" : "đã dùng"}`);
  }
  await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
}

// ---------- Night action handlers (ephemeral, private) ----------

async function openNightAction(interaction: ButtonInteraction, state: MaSoiState): Promise<void> {
  if (state.phase !== "night") {
    await interaction.reply({ content: "Chưa tới đêm bro — chờ diễn biến trên bảng nhé.", flags: MessageFlags.Ephemeral });
    return;
  }
  const guard = ensurePlayer(state, interaction.user.id);
  if (guard) {
    await interaction.reply({ content: guard, flags: MessageFlags.Ephemeral });
    return;
  }
  const role = state.roles[interaction.user.id]!;
  const guildRef = interaction.guild;

  switch (role) {
    case "soi": {
      const current = state.night.wolfVotes[interaction.user.id];
      await interaction.reply({
        content: `🐺 Chọn con mồi đêm nay.${current ? ` Đang nhắm: <@${current}> (chọn lại để đổi).` : ""}`,
        components: [targetSelect(state, guildRef, "masoi:kill", "Ăn thịt ai...", { exclude: wolves(state) })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case "tien_tri": {
      if (state.night.seerUsed) {
        await interaction.reply({ content: "🔮 Đêm nay bạn đã soi rồi — chờ đêm sau nhé.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        content: "🔮 Soi một người để biết họ thuộc phe nào:",
        components: [targetSelect(state, guildRef, "masoi:seer", "Soi ai...", { exclude: [interaction.user.id] })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case "bao_ve": {
      const current = state.night.guardTarget;
      await interaction.reply({
        content: `🛡️ Chọn người để che chở đêm nay.${current ? ` Đang che: <@${current}>.` : ""}`,
        components: [targetSelect(state, guildRef, "masoi:guard", "Che chở ai...")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case "phu_thuy":
      await interaction.reply({ content: witchPanelText(state), components: witchPanelComponents(state, guildRef), flags: MessageFlags.Ephemeral });
      return;
    default:
      await interaction.reply({ content: "😴 Bạn là Dân — đêm nay ngủ ngon, chờ trời sáng nhé bro.", flags: MessageFlags.Ephemeral });
  }
}

function wolves(state: MaSoiState): string[] {
  return state.players.filter((p) => state.roles[p] === "soi");
}

function witchPanelText(state: MaSoiState): string {
  const lines = ["🧪 **Phù thuỷ** — chọn hành động đêm nay (có thể dùng cả hai, hoặc bỏ qua):"];
  lines.push(state.witchSave ? `• Bình CỨU: ${state.night.witchWillSave ? "✅ sẽ cứu người bị sói cắn đêm nay" : "chưa dùng"}` : "• Bình CỨU: đã dùng hết");
  lines.push(
    state.witchPoison
      ? `• Bình ĐỘC: ${state.night.witchPoisonTarget ? `☠️ đầu độc <@${state.night.witchPoisonTarget}>` : "chưa chọn"}`
      : "• Bình ĐỘC: đã dùng hết",
  );
  return lines.join("\n");
}

function witchPanelComponents(
  state: MaSoiState,
  guild: Guild | null,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {
  const rows: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = [];
  if (state.witchSave) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("masoi:save")
          .setLabel(state.night.witchWillSave ? "Huỷ dùng bình cứu" : "Dùng bình cứu đêm nay")
          .setEmoji("🧪")
          .setStyle(state.night.witchWillSave ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    );
  }
  if (state.witchPoison) {
    rows.push(targetSelect(state, guild, "masoi:poison", "Đầu độc ai...", { clearLabel: "— Không đầu độc —" }));
  }
  return rows;
}

async function recordKill(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "night" || state.roles[interaction.user.id] !== "soi" || !state.alive[interaction.user.id]) {
    await interaction.update({ content: "Không hợp lệ nữa bro.", components: [] });
    return;
  }
  state.night.wolfVotes[interaction.user.id] = target;
  saveGame(guildId, channelId, { game: GAME, state });
  await interaction.update({ content: `🐺 Đã nhắm <@${target}>. Đợi trời sáng để biết kết quả.`, components: [] });
}

async function recordSeer(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "night" || state.roles[interaction.user.id] !== "tien_tri" || state.night.seerUsed || !state.alive[interaction.user.id]) {
    await interaction.update({ content: "Không hợp lệ nữa bro.", components: [] });
    return;
  }
  state.night.seerUsed = true;
  saveGame(guildId, channelId, { game: GAME, state });
  const isWolf = state.roles[target] === "soi";
  await interaction.update({
    content: isWolf ? `🔮 <@${target}> là 🐺 **SÓI**!` : `🔮 <@${target}> thuộc **phe Dân** 👤.`,
    components: [],
  });
}

async function recordGuard(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "night" || state.roles[interaction.user.id] !== "bao_ve" || !state.alive[interaction.user.id]) {
    await interaction.update({ content: "Không hợp lệ nữa bro.", components: [] });
    return;
  }
  state.night.guardTarget = target;
  saveGame(guildId, channelId, { game: GAME, state });
  await interaction.update({ content: `🛡️ Đêm nay bạn che chở cho <@${target}>.`, components: [] });
}

async function recordPoison(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "night" || state.roles[interaction.user.id] !== "phu_thuy" || !state.witchPoison || !state.alive[interaction.user.id]) {
    await interaction.update({ content: "Không hợp lệ nữa bro.", components: [] });
    return;
  }
  state.night.witchPoisonTarget = target === "none" ? null : target;
  saveGame(guildId, channelId, { game: GAME, state });
  await interaction.update({ content: witchPanelText(state), components: witchPanelComponents(state, interaction.guild) });
}

// Witch's save toggle is a button, not a select — route it here from handleButton
// via a dedicated case. (Declared below and wired into the switch.)
async function toggleWitchSave(interaction: ButtonInteraction, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase !== "night" || state.roles[interaction.user.id] !== "phu_thuy" || !state.witchSave || !state.alive[interaction.user.id]) {
    await interaction.reply({ content: "Không hợp lệ nữa bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  state.night.witchWillSave = !state.night.witchWillSave;
  saveGame(guildId, channelId, { game: GAME, state });
  await interaction.update({ content: witchPanelText(state), components: witchPanelComponents(state, interaction.guild) });
}

// ---------- Day → vote → lynch ----------

async function openVotePhase(interaction: ButtonInteraction, guildId: string, channelId: string, state: MaSoiState): Promise<void> {
  if (state.phase !== "day") {
    await interaction.reply({ content: "Chưa tới lúc bỏ phiếu bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== state.host) {
    await interaction.reply({ content: `Chỉ chủ sòng <@${state.host}> mở phiên bỏ phiếu được nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  toVote(state);
  saveGame(guildId, channelId, { game: GAME, state });
  scheduleDeadline(key(guildId, channelId), VOTE_MS + 250, () => onDeadline(interaction.client, guildId, channelId));
  await interaction.update(boardPayload(boardContainer(state)));
}

async function openVoteAction(interaction: ButtonInteraction, state: MaSoiState): Promise<void> {
  if (state.phase !== "vote") {
    await interaction.reply({ content: "Chưa tới phiên bỏ phiếu bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  const guard = ensurePlayer(state, interaction.user.id);
  if (guard) {
    await interaction.reply({ content: guard, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: "🗳️ Chọn người bạn muốn treo cổ:",
    components: [targetSelect(state, interaction.guild, "masoi:vote", "Treo cổ ai...", { clearLabel: "— Bỏ phiếu trắng —" })],
    flags: MessageFlags.Ephemeral,
  });
}

async function recordVote(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "vote" || !state.alive[interaction.user.id]) {
    await interaction.update({ content: "Phiên bỏ phiếu đã khép lại bro.", components: [] });
    return;
  }
  if (target === "none") delete state.votes[interaction.user.id];
  else state.votes[interaction.user.id] = target;

  // Everyone alive has voted → chốt sớm.
  const living = livingIds(state);
  const allVoted = living.every((p) => p in state.votes);
  if (allVoted) {
    resolveVote(state);
    finalizeIfEnded(state);
    await commit(interaction.client, guildId, channelId, state);
    await interaction.update({ content: "🗳️ Đã ghi phiếu — cả làng đã bỏ xong, đang chốt!", components: [] });
    return;
  }
  saveGame(guildId, channelId, { game: GAME, state });
  await editBoard(interaction.client, state, channelId); // refresh the live vote counter
  await interaction.update({
    content: target === "none" ? "🗳️ Bạn đã bỏ phiếu trắng." : `🗳️ Đã bỏ phiếu treo <@${target}>.`,
    components: [],
  });
}

// ---------- Hunter shot ----------

async function openHunterShot(interaction: ButtonInteraction, state: MaSoiState): Promise<void> {
  if (state.phase !== "hunter") {
    await interaction.reply({ content: "Chưa tới lượt thợ săn bro.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== state.pendingHunter) {
    await interaction.reply({ content: `Chờ thợ săn <@${state.pendingHunter}> ra tay nhé bro.`, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: "🏹 Bắn theo một người trước khi ngã xuống:",
    components: [targetSelect(state, interaction.guild, "masoi:huntershot", "Bắn ai...", { clearLabel: "— Không bắn ai —" })],
    flags: MessageFlags.Ephemeral,
  });
}

async function recordHunterShot(
  interaction: StringSelectMenuInteraction,
  guildId: string,
  channelId: string,
  state: MaSoiState,
  target: string,
): Promise<void> {
  if (state.phase !== "hunter" || interaction.user.id !== state.pendingHunter) {
    await interaction.update({ content: "Không hợp lệ nữa bro.", components: [] });
    return;
  }
  resolveHunterShot(state, target === "none" ? null : target);
  finalizeIfEnded(state);
  await commit(interaction.client, guildId, channelId, state);
  await interaction.update({ content: target === "none" ? "🏹 Bạn không bắn ai." : `🏹 Đã bắn <@${target}>.`, components: [] });
}

export default masoi;
