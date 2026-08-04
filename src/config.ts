// Explicit env parsing — fail fast on missing required values and malformed numbers.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// A typo'd numeric env var must die here, not flow as NaN into every coin ledger.
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid number for env var ${name}: "${raw}"`);
  return value;
}

export const config = {
  discordToken: required("DISCORD_BOT_TOKEN"),
  applicationId: required("DISCORD_APPLICATION_ID"),
  guildId: process.env.DISCORD_GUILD_ID || null,
  claudeOAuthToken: required("CLAUDE_CODE_OAUTH_TOKEN"),
  claudePath: process.env.CLAUDE_PATH || null,
  model: process.env.MODEL || "claude-sonnet-5",
  // Cheap, fast model for game AI-bot players (fills empty minigame seats). One
  // batched one-shot per decision point via agent.ts `askBot`; every call is
  // wrapped in a deterministic fallback so a slow/failed model never stalls a game.
  botModel: process.env.BOT_MODEL || "claude-haiku-4-5",
  // Global kill switch for the token-burning AI lanes: agentic chat (mention/reply),
  // /hoi + the "Hỏi AI" menu, and the nối-từ bot's LLM move. On by default; set
  // AI_ENABLED=0 to stop all Claude spend — those lanes then reply with the "AI tạm
  // nghỉ" notice and the bot degrades to its deterministic heuristic. Everything
  // non-AI (games, coin, điểm danh, RPG, PoE, World Cup) is unaffected.
  aiEnabled: process.env.AI_ENABLED !== "0",
  botUsername: process.env.BOT_USERNAME || "Orb Of AI",
  installUrl: process.env.DISCORD_INSTALL_URL || null,
  // Public origin the bot is reachable at — the base for the /rpg web links (the
  // passive-tree / inventory page served by src/server.ts). Overridable to
  // http://localhost:8080 for local browser testing.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://orb-of-ai.fly.dev",
  // The public wiki (src/wiki.ts → GET /wiki). Lives here rather than in wiki.ts so the
  // places that only need the LINK (/help, the agent prompt) can cite it without importing
  // the wiki module — config imports nothing, so it is always cycle-free.
  get wikiUrl(): string {
    return `${this.publicBaseUrl}/wiki`;
  },
  startingCoins: num("STARTING_COINS", 100),
  // Voice reward — two tiers over one shared block length. Go Live pays the full
  // rate (you're broadcasting); just sitting in a voice channel pays much less
  // (so weak-machine members can still cày coin by hanging out with others).
  streamCoinsPerBlock: num("STREAM_COINS_PER_BLOCK", 10), // live tier: coins per block while Go Live
  voiceCoinsPerBlock: num("VOICE_COINS_PER_BLOCK", 2), // idle tier: coins per block just being in voice
  streamBlockMinutes: num("STREAM_BLOCK_MINUTES", 5), // shared block length for both tiers
  port: num("PORT", 8080),
  // World Cup betting (/worldcup) — the whole feature (command + scheduler) stays
  // off until the token is set. Free tier at football-data.org covers the
  // FIFA World Cup (competition code WC).
  footballDataToken: process.env.FOOTBALL_DATA_TOKEN || null,
  betTicketFee: num("BET_TICKET_FEE", 10),
  // Path of Exile OAuth (confidential client, registered via oauth@grindinggear.com).
  // The /poe feature stays off until all three are set.
  poeClientId: process.env.POE_CLIENT_ID || null,
  poeClientSecret: process.env.POE_CLIENT_SECRET || null,
  poeRedirectUri: process.env.POE_REDIRECT_URI || null,
  poeContactEmail: process.env.POE_CONTACT_EMAIL || null,
  // RPG telemetry — an append-only JSONL journal per guild (rpg-telemetry-<date>.jsonl)
  // that captures every floor/expedition/economy/progression event for offline balance
  // tuning (read by `bun run rpg:stats`). On by default; set RPG_TELEMETRY=0 to silence
  // the emit path entirely. Files older than the retention window are pruned by the
  // telemetry scheduler so the Fly volume never grows unbounded.
  rpgTelemetry: process.env.RPG_TELEMETRY !== "0",
  rpgTelemetryRetentionDays: num("RPG_TELEMETRY_RETENTION_DAYS", 60),
};
