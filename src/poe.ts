// Path of Exile integration: OAuth (both PoE1 + PoE2) + agent tools.
//
// One mechanism, two client modes:
//   PUBLIC (default, no GGG registration) — client_id=pob, Path of Building's own
//     public PKCE client that GGG pre-registered with loopback redirects. Zero setup.
//     The loopback redirect can't be caught by a remote bot, so the user pastes the
//     `code` back (the one manual step). Traffic rides PoB's client identity, so we
//     mirror PoB's User-Agent and keep requests single + rate-limited (no retry loops).
//   CONFIDENTIAL (upgrade) — set POE_CLIENT_ID/SECRET/REDIRECT_URI (registered via
//     oauth@grindinggear.com) and the flow switches to a clean HTTPS web callback.
//
// account:characters covers BOTH games: GET /character = PoE1 PC, GET /character/poe2
// = PoE2 (realms pc|xbox|sony|poe2). One connection lists both.
//
// Tokens live in data/poe-accounts.json keyed by Discord user id (user-scoped — a PoE
// account belongs to a person, survives guild wipes), AES-256-GCM encrypted with a key
// HKDF-derived from DISCORD_BOT_TOKEN. That key is NOT in the chat agent's whitelisted
// env (agent.ts), so the agent can read the blob but never decrypt it.

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { asToolResult } from "./agent-tools";
import { config } from "./config";

const OAUTH_BASE = "https://www.pathofexile.com/oauth";
const API_BASE = "https://api.pathofexile.com";
const SCOPES = "account:profile account:characters";
const ACCOUNTS_FILE = fileURLToPath(new URL("../data/poe-accounts.json", import.meta.url));
const PENDING_TTL_MS = 10 * 60_000;

// PoB's public PKCE client — loopback redirect, no secret, no registration.
const PUBLIC_CLIENT_ID = "pob";
const PUBLIC_REDIRECT_URI = "http://localhost:49082";
const PUBLIC_UA = "Path of Building/2.0 (+https://pathofbuilding.community)";

interface OAuthClient {
  id: string;
  secret: string | null;
  redirect: string;
  ua: string;
  kind: "public" | "confidential";
}

// A fully-configured confidential client (own GGG registration) upgrades the flow to
// a web callback; otherwise fall back to PoB's public client.
export function poeConfidential(): boolean {
  return Boolean(config.poeClientId && config.poeClientSecret && config.poeRedirectUri);
}

function oauthClient(): OAuthClient {
  if (poeConfidential()) {
    return {
      id: config.poeClientId!,
      secret: config.poeClientSecret!,
      redirect: config.poeRedirectUri!,
      ua: `OAuth ${config.poeClientId}/1.0.0 (contact: ${config.poeContactEmail ?? "n/a"})`,
      kind: "confidential",
    };
  }
  return { id: PUBLIC_CLIENT_ID, secret: null, redirect: PUBLIC_REDIRECT_URI, ua: PUBLIC_UA, kind: "public" };
}

// server.ts only serves a callback for the confidential web redirect; the public
// loopback lands on the user's own machine (manual code paste instead).
const CALLBACK_PATH = poeConfidential() ? new URL(config.poeRedirectUri!).pathname : null;

export function poeCallbackPath(): string | null {
  return CALLBACK_PATH;
}

// --- Encrypted token store: data/poe-accounts.json, key from the bot token ---

export interface PoeAccount {
  accountName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
  connectedAt: number; // epoch ms
  // The character features default to (build analysis, wealth, ...) when the user
  // doesn't name one. Realm kept alongside so detail fetches hit the right game.
  defaultCharacter?: { name: string; realm: string };
}

function storeKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", config.discordToken, "poe-token-store", "aes-256-gcm", 32));
}

function loadAccounts(): Record<string, PoeAccount> {
  let raw: string;
  try {
    raw = readFileSync(ACCOUNTS_FILE, "utf8");
  } catch {
    return {}; // no store yet
  }
  try {
    const blob = JSON.parse(raw) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv("aes-256-gcm", storeKey(), Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    // File exists but won't decrypt/parse (corrupt, or DISCORD_BOT_TOKEN rotated).
    // Quarantine rather than silently overwrite on the next save — matches the
    // repo-wide store convention (never silently reset a non-empty store).
    try {
      renameSync(ACCOUNTS_FILE, `${ACCOUNTS_FILE}.corrupt-${Date.now()}`);
      console.error("[poe] poe-accounts.json unreadable — quarantined, starting fresh");
    } catch {
      // best-effort
    }
    return {};
  }
}

function saveAccounts(accounts: Record<string, PoeAccount>): void {
  mkdirSync(dirname(ACCOUNTS_FILE), { recursive: true });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", storeKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(accounts), "utf8"), cipher.final()]);
  const payload = JSON.stringify({
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
  // Atomic write: tmp + rename, so a crash mid-write never truncates the store.
  const tmp = `${ACCOUNTS_FILE}.tmp`;
  writeFileSync(tmp, payload);
  renameSync(tmp, ACCOUNTS_FILE);
}

export function getPoeAccount(userId: string): PoeAccount | null {
  return loadAccounts()[userId] ?? null;
}

function deletePoeAccount(userId: string): void {
  const accounts = loadAccounts();
  if (userId in accounts) {
    delete accounts[userId];
    saveAccounts(accounts);
  }
}

export function hasPoeConnection(userId: string): boolean {
  return getPoeAccount(userId) !== null;
}

// Every linked Discord user id — metadata only, for guild-wide features (/flex bxh).
export function listPoeConnections(): string[] {
  return Object.keys(loadAccounts());
}

export function getPoeConnection(userId: string): { accountName: string } | null {
  const account = getPoeAccount(userId);
  return account ? { accountName: account.accountName } : null;
}

export function getDefaultCharacter(userId: string): { name: string; realm: string } | null {
  return getPoeAccount(userId)?.defaultCharacter ?? null;
}

export function setDefaultCharacter(userId: string, name: string, realm: string): void {
  const accounts = loadAccounts();
  const account = accounts[userId];
  if (!account) throw new Error(NOT_LINKED);
  account.defaultCharacter = { name, realm };
  saveAccounts(accounts);
}

const NOT_LINKED = "Bro chưa kết nối PoE — mở /poe rồi bấm nút Kết nối trước nhé.";

// --- OAuth flow: authorize → code exchange → lazy refresh → revoke ---

interface PendingAuth {
  userId: string;
  verifier: string;
  expiresAt: number;
  notify?: (content: string) => Promise<void>;
}

const pendingAuth = new Map<string, PendingAuth>();

// Returns { url, state }. `state` is embedded in the paste-code button (public flow)
// and returned in the web redirect (confidential flow); either way it locates the
// pending PKCE verifier at completeAuth.
export function beginAuth(userId: string, notify?: PendingAuth["notify"]): { url: string; state: string } {
  for (const [state, pending] of pendingAuth) {
    if (pending.expiresAt < Date.now() || pending.userId === userId) pendingAuth.delete(state);
  }
  const client = oauthClient();
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  pendingAuth.set(state, { userId, verifier, expiresAt: Date.now() + PENDING_TTL_MS, notify });
  const params = new URLSearchParams({
    client_id: client.id,
    response_type: "code",
    scope: SCOPES,
    state,
    redirect_uri: client.redirect,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return { url: `${OAUTH_BASE}/authorize?${params}`, state };
}

// Accept a raw code OR the whole redirected URL/query the user copied from the
// address bar (public loopback lands on a blank page, but the URL holds ?code=...).
export function extractCode(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]code=([^&\s]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1]; // malformed %-encoding — use the raw capture, don't crash
    }
  }
  // No query syntax → assume they pasted just the code.
  return /[?&=]/.test(trimmed) ? null : trimmed || null;
}

export async function completeAuth(state: string, code: string): Promise<{ accountName: string }> {
  const pending = pendingAuth.get(state);
  pendingAuth.delete(state); // single-use, kể cả khi exchange fail
  if (!pending || pending.expiresAt < Date.now()) {
    throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn — mở /poe bấm Kết nối lấy link mới nhé.");
  }
  let token: TokenResponse;
  try {
    token = await requestToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthClient().redirect,
      scope: SCOPES,
      code_verifier: pending.verifier,
    });
  } catch (error) {
    console.error("[poe] code exchange failed:", error);
    throw new Error("Đổi code thất bại — code sai/hết hạn hoặc bro dán thiếu. Mở /poe bấm Kết nối thử lại nhé.");
  }
  const profile = (await apiFetch("/profile", token.access_token)) as PoeProfile;
  const accounts = loadAccounts();
  const existing = accounts[pending.userId];
  accounts[pending.userId] = {
    accountName: profile.name,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    connectedAt: Date.now(),
    // Reconnecting the SAME account keeps the chosen default character.
    defaultCharacter: existing?.accountName === profile.name ? existing.defaultCharacter : undefined,
  };
  saveAccounts(accounts);
  pending.notify?.(`✅ Đã kết nối PoE account **${profile.name}**! Mở /poe xem account và chọn character mặc định nhé bro.`).catch(() => {});
  return { accountName: profile.name };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

class PoeTokenError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`PoE token endpoint ${status}: ${body.slice(0, 200)}`);
  }
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const client = oauthClient();
  const body: Record<string, string> = { client_id: client.id, ...params };
  if (client.secret) body.client_secret = client.secret;
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": client.ua },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new PoeTokenError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as TokenResponse;
}

// Single-flight per user so concurrent calls never race the refresh rotation.
const refreshing = new Map<string, Promise<string>>();

async function getAccessToken(userId: string): Promise<string> {
  const account = getPoeAccount(userId);
  if (!account) throw new Error(NOT_LINKED);
  if (account.expiresAt - Date.now() > 60_000) return account.accessToken;
  return forceRefresh(userId);
}

async function forceRefresh(userId: string): Promise<string> {
  const account = getPoeAccount(userId);
  if (!account) throw new Error(NOT_LINKED);
  const inFlight = refreshing.get(userId);
  if (inFlight) return inFlight;
  const run = refreshAccessToken(userId, account.refreshToken).finally(() => refreshing.delete(userId));
  refreshing.set(userId, run);
  return run;
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  let token: TokenResponse;
  try {
    token = await requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  } catch (error) {
    // 4xx = GGG rejected the refresh token (revoked/expired) — the link is dead.
    // Anything else (network, 5xx) is transient: keep the record, let them retry.
    if (error instanceof PoeTokenError && error.status < 500) {
      console.error(`[poe] refresh rejected for ${userId} — unlinking:`, error.message);
      deletePoeAccount(userId);
      throw new Error("Kết nối PoE hết hạn rồi — mở /poe bấm Kết nối đăng nhập lại nhé.");
    }
    throw new Error("Không gọi được PoE API — thử lại sau chút nhé.");
  }
  const accounts = loadAccounts();
  const existing = accounts[userId];
  if (!existing) throw new Error(NOT_LINKED); // disconnected mid-refresh — don't resurrect
  accounts[userId] = {
    ...existing,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
  };
  saveAccounts(accounts);
  return token.access_token;
}

// Local delete always wins; server-side revoke is best-effort.
export async function disconnectPoe(userId: string): Promise<PoeAccount | null> {
  const account = getPoeAccount(userId);
  if (!account) return null;
  deletePoeAccount(userId);
  const client = oauthClient();
  const body: Record<string, string> = { client_id: client.id, token: account.refreshToken };
  if (client.secret) body.client_secret = client.secret;
  try {
    await fetch(`${OAUTH_BASE}/token/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": client.ua },
      body: new URLSearchParams(body),
    });
  } catch {
    // Token expires on its own; local unlink already happened.
  }
  return account;
}

// --- Character / profile API ---

export interface PoeProfile {
  uuid: string;
  name: string;
  realm?: string;
  guild?: { name: string };
  twitch?: { name: string };
}

export interface PoeCharacter {
  id: string;
  name: string;
  realm: string;
  class: string;
  league?: string;
  level: number;
  experience?: number;
  current?: boolean;
}

// Per-user cooldown on the on-demand entry points that hit GGG's OAuth character
// API directly — the flagged, ban-risk path (keep calls single, never spam). The
// batch reader (/flex bxh) already shields GGG with a 30-min wealth cache; this
// guards the two uncached callers a single user can hammer: the /poe panel's Làm
// mới button and /flex nhanvat. In-memory + per-user; a restart clears it (a
// fresh process can't be mid-spam) and arming BEFORE the fetch means even a 429
// or a failed call still has to wait out the cooldown — exactly the courtesy GGG
// wants. Returns 0 when the call may proceed (and arms the timer), else the ms
// left to wait so the caller can tell the user instead of fetching.
const gggCooldownUntil = new Map<string, number>();
const GGG_COOLDOWN_MS = 15_000;

export function throttleGggCall(userId: string): number {
  const now = Date.now();
  const until = gggCooldownUntil.get(userId) ?? 0;
  if (now < until) return until - now;
  gggCooldownUntil.set(userId, now + GGG_COOLDOWN_MS);
  return 0;
}

function apiRequest(path: string, accessToken: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, "user-agent": oauthClient().ua },
  });
}

function checkApiResponse(res: Response, path: string): void {
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    throw new Error(`PoE API đang giới hạn tốc độ — thử lại sau ${retryAfter ?? "vài"} giây nhé.`);
  }
  if (!res.ok) throw new Error(`PoE API trả về lỗi ${res.status} cho ${path}.`);
}

async function apiFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await apiRequest(path, accessToken);
  checkApiResponse(res, path);
  return res.json();
}

async function apiGet(userId: string, path: string): Promise<unknown> {
  let res = await apiRequest(path, await getAccessToken(userId));
  if (res.status === 401) {
    // Local-fresh token rejected → revoked/skewed. One forced refresh arbitrates;
    // still 401 after → unlink.
    console.error(`[poe] ${path} 401 on locally-fresh token for ${userId} — forcing refresh`);
    res = await apiRequest(path, await forceRefresh(userId));
    if (res.status === 401) {
      console.error(`[poe] ${path} still 401 after forced refresh for ${userId} — unlinking`);
      deletePoeAccount(userId);
      throw new Error("Kết nối PoE hết hạn rồi — mở /poe bấm Kết nối đăng nhập lại nhé.");
    }
  }
  checkApiResponse(res, path);
  return res.json();
}

export async function fetchProfileSummaryFor(userId: string): Promise<{
  accountName: string;
  realm?: string;
  guild?: string;
  twitch?: string;
  defaultCharacter?: { name: string; realm: string };
}> {
  const profile = (await apiGet(userId, "/profile")) as PoeProfile;
  return {
    accountName: profile.name,
    realm: profile.realm,
    guild: profile.guild?.name,
    twitch: profile.twitch?.name,
    defaultCharacter: getDefaultCharacter(userId) ?? undefined,
  };
}

// OAuth serves PoE1 and PoE2 as separate realms: GET /character = PoE1 PC,
// GET /character/poe2 = PoE2. Merge both games. The PC call is authoritative for auth
// (its 401 drives refresh/unlink); PoE2 is best-effort so a PoE1-only account still lists.
export async function fetchCharactersFor(userId: string): Promise<PoeCharacter[]> {
  const pc = ((await apiGet(userId, "/character")) as { characters?: PoeCharacter[] }).characters ?? [];
  let poe2: PoeCharacter[] = [];
  try {
    poe2 = ((await apiGet(userId, "/character/poe2")) as { characters?: PoeCharacter[] }).characters ?? [];
  } catch {
    // No PoE2 realm on this account (or a transient PoE2-only hiccup) — keep PoE1.
  }
  return [...pc, ...poe2];
}

interface RawItem {
  inventoryId?: string;
  name?: string;
  typeLine?: string;
  frameType?: number; // 0 normal · 1 magic · 2 rare · 3 unique
  ilvl?: number;
  corrupted?: boolean;
  implicitMods?: string[];
  explicitMods?: string[];
  craftedMods?: string[];
  enchantMods?: string[];
  sockets?: unknown[];
}

interface RawCharacterDetail extends PoeCharacter {
  equipment?: RawItem[];
  skills?: unknown; // gem groups (main skill + supports) — passed through for build analysis
  passives?: { hashes?: number[] };
}

function slimItem(item: RawItem) {
  return {
    slot: item.inventoryId,
    name: item.name || undefined,
    typeLine: item.typeLine,
    ilvl: item.ilvl,
    corrupted: item.corrupted || undefined,
    implicitMods: item.implicitMods,
    explicitMods: item.explicitMods,
    craftedMods: item.craftedMods,
    enchantMods: item.enchantMods,
    socketCount: item.sockets?.length || undefined,
  };
}

function slimCharacter(character: RawCharacterDetail): Record<string, unknown> {
  return {
    name: character.name,
    realm: character.realm,
    class: character.class,
    league: character.league,
    level: character.level,
    experience: character.experience,
    equipment: (character.equipment ?? []).map(slimItem),
    skills: character.skills, // gem setup — lets the agent reason about the build
    passiveCount: character.passives?.hashes?.length,
  };
}

// Detail needs the character's realm in the path (/character/<realm>/<name>).
// name omitted → the user's chosen default character (realm comes with it, no list
// call); otherwise the realm is resolved from the merged character list.
async function fetchRawCharacter(
  userId: string,
  name?: string,
): Promise<{ name: string; character: RawCharacterDetail }> {
  let charName = name;
  let realm: string | undefined;
  if (!charName) {
    const def = getDefaultCharacter(userId);
    if (!def) throw new Error("Chưa chọn character mặc định — mở /poe chọn ở menu, hoặc nói rõ tên character nhé.");
    charName = def.name;
    realm = def.realm;
  }
  if (!realm) {
    realm = (await fetchCharactersFor(userId)).find((c) => c.name === charName)?.realm;
  }
  const suffix = realm && realm !== "pc" ? `/${realm}` : "";
  const data = (await apiGet(userId, `/character${suffix}/${encodeURIComponent(charName)}`)) as {
    character?: RawCharacterDetail;
  };
  if (!data.character) throw new Error(`Không tìm thấy character "${charName}".`);
  return { name: charName, character: data.character };
}

export async function fetchCharacterFor(userId: string, name?: string): Promise<Record<string, unknown>> {
  const { character } = await fetchRawCharacter(userId, name);
  return slimCharacter(character);
}

// Write the FULL character JSON to the workspace in the `pob` skill's format
// (data/character-exports/oauth-<name>.json = {character}), so the agent can run
// PoB's export/calc on it for exact build stats — no separate loopback OAuth needed,
// the character is already fetched with the user's own token.
export async function exportCharacterFor(
  userId: string,
  workspace: string,
  name?: string,
): Promise<{ path: string; name: string; class?: string; level?: number }> {
  const { name: charName, character } = await fetchRawCharacter(userId, name);
  const file = `oauth-${charName.replace(/[^\w.-]/g, "_")}.json`;
  const dir = join(workspace, "data", "character-exports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify({ character }));
  return { path: `data/character-exports/${file}`, name: charName, class: character.class, level: character.level };
}

// --- Wealth estimate: price equipped uniques via poe2scout's public API ---
// A FLOOR, not net worth: only the character's equipped UNIQUES are priced (rares
// are priced by mod-roll, not a catalog, and the currency stash needs a scope the
// public pob client lacks). poe2scout is no-auth JSON and covers both realms
// (pc + poe2); prices are in Exalted, `DivinePrice` converts to Divine.

const SCOUT_BASE = "https://api.poe2scout.com";
const SCOUT_TTL_MS = 30 * 60_000;

interface UniqueCatalog {
  at: number;
  byName: Map<string, number>; // lowercased unique name → price in Exalted
  divinePrice: number; // Exalted per Divine
  leagueName: string;
}

const catalogCache = new Map<string, UniqueCatalog>();

async function scoutGet(path: string): Promise<unknown> {
  const res = await fetch(`${SCOUT_BASE}${path}`, { headers: { accept: "application/json" } });
  if (res.status === 429) throw new Error("poe2scout đang giới hạn tốc độ — thử lại sau nhé.");
  if (!res.ok) throw new Error(`poe2scout trả về lỗi ${res.status}.`);
  return res.json();
}

interface ScoutLeague {
  Value: string;
  ShortName: string;
  IsCurrent: boolean;
  DivinePrice: number;
}

// The league list is needed BEFORE the catalog cache key can be computed, so
// it gets its own cache with the same TTL — a warm wealth call must make zero
// poe2scout requests (/flex bxh runs up to 15 wealth calls back to back).
const leaguesCache = new Map<string, { at: number; leagues: ScoutLeague[] }>();

async function scoutLeagues(realm: string): Promise<ScoutLeague[]> {
  const cached = leaguesCache.get(realm);
  if (cached && Date.now() - cached.at < SCOUT_TTL_MS) return cached.leagues;
  const leagues = (await scoutGet(`/${realm}/Leagues`)) as ScoutLeague[];
  leaguesCache.set(realm, { at: Date.now(), leagues });
  return leagues;
}

async function loadUniqueCatalog(realm: string, leagueField?: string): Promise<UniqueCatalog> {
  const leagues = await scoutLeagues(realm);
  const wanted = leagueField?.toLowerCase();
  const league =
    (wanted && leagues.find((l) => l.Value.toLowerCase() === wanted || l.ShortName.toLowerCase() === wanted)) ||
    leagues.find((l) => l.IsCurrent) ||
    leagues[0];
  if (!league) throw new Error("poe2scout: không tìm thấy league phù hợp.");

  const key = `${realm}:${league.Value}`;
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.at < SCOUT_TTL_MS) return cached;

  const cats = (await scoutGet(`/${realm}/Leagues/${encodeURIComponent(league.Value)}/Items/Categories`)) as {
    UniqueCategories?: { ApiId: string }[];
  };
  const byName = new Map<string, number>();
  for (const cat of cats.UniqueCategories ?? []) {
    let page = 1;
    let pages = 1;
    do {
      const body = (await scoutGet(
        `/${realm}/Leagues/${encodeURIComponent(league.Value)}/Uniques/ByCategory?Category=${encodeURIComponent(cat.ApiId)}&Page=${page}&PerPage=250`,
      )) as { Items?: { Name?: string; CurrentPrice?: number }[]; Pages?: number };
      for (const it of body.Items ?? []) {
        if (it.Name) byName.set(it.Name.trim().toLowerCase(), it.CurrentPrice ?? 0);
      }
      pages = body.Pages ?? 1;
      page++;
    } while (page <= pages && page <= 15); // safety cap
  }

  const entry: UniqueCatalog = { at: Date.now(), byName, divinePrice: league.DivinePrice ?? 0, leagueName: league.Value };
  catalogCache.set(key, entry);
  return entry;
}

// Typed at the boundary so consumers (/flex) never re-declare or force-cast the shape.
export interface WealthEstimate {
  character: string;
  league?: string;
  currency?: string;
  divinePrice?: number;
  priced: { name: string; exalted: number; divine: number | null }[];
  unpricedUniques: string[];
  rareCount: number;
  totalExalted: number;
  totalDivine: number | null;
  note: string;
  nickname?: string; // filled by the poe_wealth tool after reflectWealthNickname
}

export async function estimateWealth(userId: string, name?: string): Promise<WealthEstimate> {
  const { name: charName, character } = await fetchRawCharacter(userId, name);
  const realm = character.realm || "pc";
  const equipment = (character.equipment ?? []) as RawItem[];
  const uniques = equipment.filter((i) => i.frameType === 3 && i.name);
  const rareCount = equipment.filter((i) => i.frameType === 2).length;
  const note =
    "Chỉ tính unique đang MẶC (giá floor poe2scout). Rare đang mặc và currency/đồ trong stash KHÔNG tính (thiếu scope stash) — coi đây là mức SÀN, không phải net worth.";

  if (uniques.length === 0) {
    return { character: charName, league: character.league, priced: [], unpricedUniques: [], rareCount, totalExalted: 0, totalDivine: 0, note };
  }

  const catalog = await loadUniqueCatalog(realm, character.league);
  const round = (n: number) => Math.round(n * 100) / 100;
  const priced: { name: string; exalted: number; divine: number | null }[] = [];
  const unpricedUniques: string[] = [];
  let totalExalted = 0;
  for (const item of uniques) {
    const exalted = catalog.byName.get(item.name!.trim().toLowerCase());
    if (exalted === undefined) {
      unpricedUniques.push(item.name!);
      continue;
    }
    totalExalted += exalted;
    priced.push({ name: item.name!, exalted: round(exalted), divine: catalog.divinePrice ? round(exalted / catalog.divinePrice) : null });
  }
  return {
    character: charName,
    league: catalog.leagueName,
    currency: "Exalted Orb",
    divinePrice: catalog.divinePrice,
    priced,
    unpricedUniques,
    rareCount,
    totalExalted: round(totalExalted),
    totalDivine: catalog.divinePrice ? round(totalExalted / catalog.divinePrice) : null,
    note,
  };
}

// --- Agent tools: one MCP server per message, bound to the sender ---
// The agent only ever reaches the SENDER's linked account — no way to name another
// Discord user — and raw tokens never cross the tool boundary.

// Reflect the wealth floor onto the sender's server nickname (" ⚜~N div" suffix).
// Best-effort: skipped when the bot lacks Manage Nicknames, sits below the member
// in the role hierarchy, or the member owns the server (Discord never allows
// renaming owners). Returns a human-readable status the agent can relay.
const WEALTH_SUFFIX = / ⚜~[\d.]+ div$/;

async function reflectWealthNickname(member: GuildMember | undefined, totalDivine: number | null): Promise<string> {
  if (!member) return "không đổi nickname (không có thông tin server)";
  if (totalDivine === null) return "không đổi nickname (chưa có giá Divine để quy đổi)";
  const me = member.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames) || !member.manageable)
    return "không đổi nickname (bot thiếu quyền Manage Nicknames, role thấp hơn member, hoặc member là chủ server — Discord không cho đổi tên chủ server)";
  const shown = totalDivine >= 10 ? String(Math.round(totalDivine)) : String(Math.round(totalDivine * 10) / 10);
  const suffix = ` ⚜~${shown} div`;
  const base = member.displayName.replace(WEALTH_SUFFIX, "").slice(0, 32 - suffix.length).trimEnd();
  const next = `${base}${suffix}`;
  if (next === member.displayName) return `nickname đã là "${next}" sẵn rồi`;
  try {
    await member.setNickname(next, "Orb Of AI: cập nhật độ giàu PoE");
    return `đã đổi nickname thành "${next}"`;
  } catch (error) {
    return `không đổi được nickname: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function buildPoeMcpServer(discordUserId: string, workspace: string, member?: GuildMember) {
  return createSdkMcpServer({
    name: "poe",
    version: "1.0.0",
    tools: [
      tool(
        "poe_profile",
        "Path of Exile account của người đang nhắn tin: account name, realm, và character mặc định họ đã chọn.",
        {},
        () => asToolResult(() => fetchProfileSummaryFor(discordUserId)),
      ),
      tool(
        "poe_characters",
        "Danh sách character PoE (cả PoE1 + PoE2) của người đang nhắn tin: tên, class, level, league, realm.",
        {},
        () => asToolResult(() => fetchCharactersFor(discordUserId)),
      ),
      tool(
        "poe_character",
        "Chi tiết một character PoE của người đang nhắn tin (bỏ trống name = dùng character mặc định): trang bị + mods, gem/skill setup — đủ để phân tích build định tính (thiếu res, gap, synergy). Muốn số liệu chính xác (DPS/EHP) thì dùng poe_export_character.",
        { name: z.string().optional().describe("Tên character (từ poe_characters); bỏ trống để dùng character mặc định") },
        (args) => asToolResult(() => fetchCharacterFor(discordUserId, args.name)),
      ),
      tool(
        "poe_export_character",
        "Tải FULL dữ liệu character (bỏ trống name = character mặc định) và ghi ra file JSON cho skill /pob. Trả về đường dẫn file (đã ở đúng định dạng skill dùng — KHÔNG cần chạy fetch-oauth.py nữa). Bước tiếp: chạy export-pob của skill /pob trên file này để ra PoB code + tính stat build (DPS, EHP, resistances, keystones).",
        { name: z.string().optional().describe("Tên character; bỏ trống để dùng character mặc định") },
        (args) => asToolResult(() => exportCharacterFor(discordUserId, workspace, args.name)),
      ),
      tool(
        "poe_wealth",
        "Ước tính 'độ giàu' của character qua giá unique đang MẶC (nguồn poe2scout). Bỏ trống name = character mặc định. Trả tổng Exalted/Divine + breakdown từng unique. LƯU Ý QUAN TRỌNG: đây là mức SÀN — chỉ tính unique đang mặc, KHÔNG tính rare hay currency/đồ trong stash. Trình bày cho user đúng như vậy, đừng gọi là tổng tài sản. Bot cũng tự gắn đuôi ⚜~N div vào nickname của user (best-effort — kết quả nằm trong field nickname, nhắc user nếu có đổi).",
        { name: z.string().optional().describe("Tên character; bỏ trống để dùng character mặc định") },
        (args) =>
          asToolResult(async () => {
            const result = await estimateWealth(discordUserId, args.name);
            result.nickname = await reflectWealthNickname(member, result.totalDivine);
            return result;
          }),
      ),
    ],
  });
}
