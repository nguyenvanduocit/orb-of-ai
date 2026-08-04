// AI-bot players that fill empty multiplayer-minigame seats. Any player adds one
// on demand with the "🤖 Thêm bot" button on a game's lobby/board (up to MAX_BOTS
// per game). A cheap one-shot Haiku call (agent.ts askBot) shapes how each bot
// plays; every decision is wrapped in a deterministic fallback, so a slow,
// aborted or malformed model reply degrades the bot to a heuristic and NEVER
// stalls the game (liveness over cleverness).
//
// Identity — bots use synthetic ids `botai-<n>`, never real Discord snowflakes
// (which are all digits), so `isBotId` cleanly tells them apart everywhere a
// userId flows: rendering (mentionOrName), the coin ledger, and the member prune.
//
// Coins (the house faucet) — the two economies handle bots differently, both
// deliberately NON-zero-sum so humans/hosts can win real coins off bots:
//   • PEER POT (nối từ): bots stay UNFUNDED — never in coins.json. The pot math
//     (STAKE × players) already mints their stake to the human winners, and the
//     ghost-guarded payout burns any bot share. Nothing to fund, nothing to sweep.
//   • HOST-BANKER (blackjack, bầu cua, đua thú, roulette): a bot must be a real
//     ledger participant for the banker settle to win/lose against it, so it is
//     FUNDED from the faucet (mint) before it stakes and SWEPT after settlement
//     (burn residual). `sweepBots` is the GC; game teardown owns calling it, the
//     member prune skips bot ids (so a bot funded mid-game survives a restart
//     until its own game resolves), and coin leaderboards filter them out.

import { askBot } from "./agent";
import { config } from "./config";
import { guildDir } from "./store";
import { loadCoins, saveCoins } from "./economy";

export const MAX_BOTS = 3;
const BOT_ID_PREFIX = "botai-";

// A bot player id is a non-numeric synthetic string; a real Discord id is all
// digits. The prune (guilds.ts) inlines this same prefix check to avoid a
// module cycle — keep the prefix in sync if it ever changes.
export function isBotId(id: string): boolean {
  return id.startsWith(BOT_ID_PREFIX);
}

// Distinct personas so a filled table reads like three different players rather
// than three clones — the `vibe` line is fed to the decision prompt so each bot
// bets/plays in character.
interface BotPersona {
  id: string;
  name: string; // shown in embeds via mentionOrName (bots have no Discord mention)
  vibe: string; // personality hint for the Haiku decision prompt
}

const PERSONAS: BotPersona[] = [
  { id: "botai-1", name: "🤖 Bọt", vibe: "hớn hở, thích chơi tất tay, hay chọc ghẹo" },
  { id: "botai-2", name: "🤖 Kẹo", vibe: "thận trọng, tính toán, ăn chắc mặc bền" },
  { id: "botai-3", name: "🤖 Mực", vibe: "lì lợm, thích doạ, chơi tâm lý" },
];

export const BOT_IDS: string[] = PERSONAS.map((p) => p.id);

const personaById = new Map(PERSONAS.map((p) => [p.id, p]));

export function botPersona(id: string): BotPersona {
  return personaById.get(id) ?? { id, name: "🤖 Bot", vibe: "vui vẻ" };
}

export function botDisplayName(id: string): string {
  return botPersona(id).name;
}

// The one rendering chokepoint the in-scope game files call instead of a raw
// `<@id>`: a real user renders as a Discord mention, a bot as its bold name (an
// unknown snowflake mention would otherwise show as broken literal text).
export function mentionOrName(id: string): string {
  return isBotId(id) ? `**${botDisplayName(id)}**` : `<@${id}>`;
}

// The next unused bot id given who's already in the game, or null once all
// MAX_BOTS are seated — the "Thêm bot" button adds one bot per click up to this
// cap. Pure/testable.
export function nextBotId(existing: string[]): string | null {
  return BOT_IDS.find((id) => !existing.includes(id)) ?? null;
}

// --- House faucet (host-banker games only) ---

// Ensure each bot has a ledger entry (created at 0 if absent) so the banker
// settle counts it as a real participant — settleBankerPayout's ghost guard
// (`userId in coins`) would otherwise drop a bot and leave its board stake as
// fake coins in the pot. The bot's actual stake is MINTED straight into the
// game pot by the caller (not debited from this entry), and any winnings that
// land here are burned by sweepBots at teardown — the deliberate faucet.
export function ensureBotLedger(botIds: string[]): void {
  const coins = loadCoins();
  let changed = false;
  for (const id of botIds) {
    if (!(id in coins)) {
      coins[id] = 0;
      changed = true;
    }
  }
  if (changed) saveCoins(coins);
}

// GC for the faucet: drop every bot ledger entry (residual winnings/funding are
// burned). Idempotent — safe to call at every host-banker game teardown even
// when no bots played. Peer-pot games never fund bots, so this is a no-op there.
export function sweepBots(): void {
  const coins = loadCoins();
  let changed = false;
  for (const id of Object.keys(coins)) {
    if (isBotId(id)) {
      delete coins[id];
      changed = true;
    }
  }
  if (changed) saveCoins(coins);
}

// --- Decisions ---

// Extract the first JSON value from a model reply — Haiku often wraps JSON in
// prose or ```json fences, so a plain JSON.parse of the whole string fails.
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : raw;
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  // Walk to the matching close bracket so trailing prose after the JSON is dropped.
  const open = body[start]!;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// The generic bot-decision primitive every in-scope game calls: build a prompt +
// system persona, hand it to Haiku, parse+validate the JSON reply, and fall back
// to a deterministic default on ANY failure (timeout, quota, malformed reply,
// invalid shape). The model shapes play; the fallback guarantees it. `validate`
// turns the parsed JSON into T (or null to reject → fallback).
export async function decideBot<T>(opts: {
  guildId: string;
  system: string;
  prompt: string;
  fallback: T;
  validate: (parsed: unknown) => T | null;
  maxMs?: number;
}): Promise<T> {
  // AI off (AI_ENABLED=0): skip the Haiku call entirely and use the deterministic
  // fallback — the nối-từ bot plays its heuristic, zero token spend.
  if (!config.aiEnabled) return opts.fallback;
  try {
    const raw = await askBot({
      prompt: opts.prompt,
      system: opts.system,
      cwd: guildDir(opts.guildId),
      maxMs: opts.maxMs,
    });
    const parsed = extractJson(raw);
    if (parsed === null) return opts.fallback;
    const validated = opts.validate(parsed);
    return validated ?? opts.fallback;
  } catch (error) {
    console.warn("[bots] decision fell back to heuristic:", error);
    return opts.fallback;
  }
}

// System prompt shared by every game decision: keep bots terse, in-character, and
// strictly JSON so extractJson always has something to parse.
export function botSystem(persona: BotPersona, rules: string): string {
  return [
    `Bạn là "${botDisplayName(persona.id)}", một người chơi bot vui tính trong một game Discord tiếng Việt.`,
    `Tính cách: ${persona.vibe}.`,
    rules,
    "CHỈ trả lời bằng đúng một object JSON hợp lệ, không giải thích gì thêm.",
  ].join("\n");
}
