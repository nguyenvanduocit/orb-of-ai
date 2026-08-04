/**
 * PoE GGG transport — playwriter page-context fetch
 *
 * Every GGG API call runs as a `fetch()` inside the page-context of a
 * logged-in www.pathofexile.com tab, driven through the `playwriter` CLI
 * (which controls the user's own Chrome). The browser fills cookies / Origin
 * / Referer / UA, so the traffic is same-origin and indistinguishable from the
 * user clicking around the trade site — the account was previously flagged, so
 * no direct curl/fetch to GGG is ever used.
 *
 * There is no external daemon. The safety the daemon used to provide is
 * reproduced locally, in this one file:
 *   - >=2s minimum spacing between calls, persisted across CLI invocations
 *     (a single skill run is many separate processes).
 *   - x-rate-limit-* / x-rate-limit-account-state read straight off the
 *     same-origin response and surfaced in `ratelimit`.
 *   - adaptive backoff: a 429 or a non-zero account-state penalty parks the
 *     next call until the restriction clears.
 *   - a lockfile serialises calls so two skill runs never hit GGG in parallel.
 *
 * Prerequisite: the user's Chrome is open and logged into pathofexile.com with
 * the Playwriter extension enabled on a tab. If no www.pathofexile.com tab is
 * open, the transport opens a /trade2/ one itself (session cookies keep it
 * logged-in). There is no headless path.
 *
 * Config (all optional):
 *   POE_PLAYWRITER_BIN       playwriter launcher (default: `playwriter`,
 *                            falls back to `bunx playwriter@latest`)
 *   POE_PLAYWRITER_SESSION   reuse a fixed playwriter session id
 *   POE_PLAYWRITER_SPACING   min spacing ms between calls (default 2000)
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE_FILE = join(homedir(), '.poe-playwriter-state.json');
const LOCK_FILE = join(homedir(), '.poe-playwriter.lock');
const MIN_SPACING_MS = Number(process.env.POE_PLAYWRITER_SPACING) || 2000;
const MAX_BLOCK_WAIT_MS = 90_000; // refuse to silently sleep longer than this on a penalty

export type Game = 'poe1' | 'poe2';
export type Method = 'GET' | 'POST';

/** Wrapper returned for every forwarded request. `data` is parsed JSON (or raw text). */
export interface PoeFetchResponse<T = any> {
  status: number;                       // GGG HTTP status
  ratelimit: Record<string, string>;    // x-rate-limit-* headers (+ retry-after)
  data: T;
}

interface TransportState {
  sessionId?: string;
  lastCallMs?: number;
  blockedUntilMs?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function readState(): TransportState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as TransportState;
  } catch {
    return {};
  }
}

function writeState(patch: Partial<TransportState>): TransportState {
  const next = { ...readState(), ...patch };
  writeFileSync(STATE_FILE, JSON.stringify(next), 'utf8');
  return next;
}

/** Resolve the playwriter launcher. Prefer a real binary, fall back to bunx. */
function playwriterArgs(rest: string[]): { cmd: string; args: string[] } {
  const bin = process.env.POE_PLAYWRITER_BIN;
  if (bin) return { cmd: bin, args: rest };
  // `playwriter` if on PATH, else `bunx playwriter@latest`
  const probe = spawnSync('playwriter', ['--version'], { stdio: 'ignore' });
  if (probe.status === 0 || probe.error == null) return { cmd: 'playwriter', args: rest };
  return { cmd: 'bunx', args: ['playwriter@latest', ...rest] };
}

function runPlaywriter(rest: string[], timeoutMs = 60_000): { stdout: string; stderr: string; status: number | null } {
  const { cmd, args } = playwriterArgs(rest);
  const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs });
  return { stdout: res.stdout ?? '', stderr: res.stderr ?? '', status: res.status };
}

/** Get a persisted playwriter session id, creating one on first use. */
function ensureSession(): string {
  if (process.env.POE_PLAYWRITER_SESSION) return process.env.POE_PLAYWRITER_SESSION.trim();
  const state = readState();
  if (state.sessionId) return state.sessionId;
  const { stdout, stderr, status } = runPlaywriter(['session', 'new'], 20_000);
  // First run prints connection chatter before the id; prefer the explicit
  // "Session N created" line, else a line that is purely a number.
  const id =
    stdout.match(/Session\s+(\d+)\s+created/i)?.[1] ??
    stdout.match(/^\s*(\d+)\s*$/m)?.[1] ??
    '';
  if (status !== 0 || !/^\d+$/.test(id)) {
    throw new Error(
      `playwriter session new failed (status ${status}). Is the playwriter CLI installed?\n${stderr || stdout}`
    );
  }
  writeState({ sessionId: id });
  return id;
}

/** Cross-process serialisation. Exclusive-create a lockfile, steal if stale (>2min). */
async function acquireLock(): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const fd = openSync(LOCK_FILE, 'wx'); // O_CREAT | O_EXCL
      writeFileSync(fd, `${process.pid}:${Date.now()}`);
      closeSync(fd);
      return;
    } catch {
      // lock held — steal if the holder is older than 2 minutes
      try {
        const [, tsRaw] = readFileSync(LOCK_FILE, 'utf8').split(':');
        if (Date.now() - Number(tsRaw) > 120_000) { unlinkSync(LOCK_FILE); continue; }
      } catch { /* lock vanished — retry */ }
      if (Date.now() - start > 120_000) throw new Error('Timed out waiting for the playwriter lock.');
      await sleep(250);
    }
  }
}

function releaseLock(): void {
  try { unlinkSync(LOCK_FILE); } catch { /* already gone */ }
}

/**
 * The script run inside playwriter's sandbox. Reuses a logged-in
 * www.pathofexile.com tab — or opens a /trade2/ one itself if none exists — and
 * runs the fetch in its page-context, writing {status, rate-limit headers, body}
 * as JSON to `resultPath` (playwriter caps console.log at ~10KB, too small for a
 * full fetch-detail body, so the result travels by file, not stdout).
 */
function buildScript(req: { method: Method; path: string; body?: unknown }, resultPath: string): string {
  return `
const __req = ${JSON.stringify(req)};
let __out;
try {
  const __tabs = context.pages().filter((p) => {
    try { return new URL(p.url()).hostname === 'www.pathofexile.com'; } catch { return false; }
  });
  let __page = __tabs[0];
  if (!__page) {
    // No www.pathofexile.com tab is open, but the playwriter sandbox is running
    // — the extension IS attached to Chrome — so open a /trade2/ tab ourselves.
    // The user's session cookies make it logged-in. Leave it open so later calls
    // find it via context.pages() (one tab, no repeat opens).
    try {
      __page = await context.newPage();
      await __page.goto('https://www.pathofexile.com/trade2/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      __page = undefined;
      __out = { status: 0, ratelimit: {}, data: '__NO_POE_TAB__', error: 'No www.pathofexile.com tab open and auto-open failed (' + String(e && e.message || e) + '). Open Chrome, log into www.pathofexile.com, and click the Playwriter extension icon on a tab.' };
    }
  }
  if (__page && __out === undefined) {
    __out = await __page.evaluate(async (req) => {
      const init = { method: req.method, credentials: 'include', headers: {} };
      // The site's own trade calls go through an XHR wrapper that sets
      // X-Requested-With; a raw page-context fetch() omits it and GGG 403s the
      // /search POST without it (the bridge had to inject this too). Sec-Fetch-*
      // are browser-controlled and already correct because we are same-origin.
      init.headers['x-requested-with'] = 'XMLHttpRequest';
      if (req.body !== undefined && req.body !== null) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(req.body);
      }
      let resp;
      try {
        resp = await fetch('https://www.pathofexile.com' + req.path, init);
      } catch (e) {
        return { status: 0, ratelimit: {}, data: String(e && e.message || e), error: 'fetch threw in page-context (cross-origin? tab not on www.pathofexile.com?)' };
      }
      const rl = {};
      resp.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk.indexOf('x-rate-limit') === 0 || lk === 'retry-after') rl[k] = v;
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: resp.status, ratelimit: rl, data };
    }, __req);
  }
} catch (e) {
  __out = { status: 0, ratelimit: {}, data: String(e && e.message || e), error: 'playwriter sandbox error' };
}
require('fs').writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify(__out));
`.trim();
}

/**
 * Parse GGG's x-rate-limit-account-state into a backoff window.
 * Format is one-or-more `hits:period:restricted` triples, comma-separated.
 * A non-zero `restricted` (seconds) means the account is currently parked.
 */
function penaltyMs(ratelimit: Record<string, string>): number {
  const state = ratelimit['x-rate-limit-account-state'] || ratelimit['X-Rate-Limit-Account-State'];
  if (!state) return 0;
  let worst = 0;
  for (const triple of state.split(',')) {
    const parts = triple.split(':').map((n) => Number(n.trim()));
    if (parts.length === 3 && Number.isFinite(parts[2]) && parts[2] > worst) worst = parts[2];
  }
  return worst * 1000;
}

function retryAfterMs(ratelimit: Record<string, string>): number {
  const ra = ratelimit['retry-after'] || ratelimit['Retry-After'];
  const secs = Number(ra);
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : 0;
}

/**
 * Forward a raw GGG request through a page-context fetch in the logged-in tab.
 * @param path GGG path beginning with `/` (e.g. `/api/trade2/search/poe2/...`)
 *             — the page-context fetch prepends `https://www.pathofexile.com`.
 */
export async function poeFetch<T = any>(
  game: Game,
  method: Method,
  path: string,
  body?: unknown,
): Promise<PoeFetchResponse<T>> {
  // `game` is part of the call contract (callers pass it) but the path already
  // carries the /api/trade vs /api/trade2 split, so the page-context fetch
  // needs only the path; the param is kept for signature stability.
  void game;

  await acquireLock();
  try {
    // --- spacing + penalty gate (persisted across processes) ---
    const state = readState();
    const now = Date.now();
    if (state.blockedUntilMs && state.blockedUntilMs > now) {
      const waitBlock = state.blockedUntilMs - now;
      if (waitBlock > MAX_BLOCK_WAIT_MS) {
        throw new Error(
          `GGG rate-limit penalty active for ${Math.ceil(waitBlock / 1000)}s ` +
          `(account previously flagged — refusing to hammer). Retry later.`
        );
      }
      await sleep(waitBlock);
    }
    const sinceLast = Date.now() - (state.lastCallMs || 0);
    if (sinceLast < MIN_SPACING_MS) await sleep(MIN_SPACING_MS - sinceLast);

    // --- run the fetch in the logged-in tab ---
    const session = ensureSession();
    // Under /tmp, not os.tmpdir(): playwriter's ScopedFS always allows /tmp but
    // its os.tmpdir() resolves to /tmp too (TMPDIR unset in its process), so the
    // sandbox cannot write into the macOS per-user $TMPDIR (/var/folders/...).
    const dir = mkdtempSync(join('/tmp', 'poefetch-'));
    const scriptPath = join(dir, 'call.js');
    const resultPath = join(dir, 'result.json');
    writeFileSync(scriptPath, buildScript({ method, path, body }, resultPath), 'utf8');

    // The sandbox writes its JSON result to `resultPath` via fs — playwriter caps
    // console.log output at ~10KB, so stdout can't carry a full fetch-detail body.
    let stdout = '', stderr = '', status: number | null = null;
    let rawResult = '';
    try {
      ({ stdout, stderr, status } = runPlaywriter(['-s', session, '-f', scriptPath]));
      try { rawResult = readFileSync(resultPath, 'utf8'); } catch { rawResult = ''; }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    writeState({ lastCallMs: Date.now() });

    if (!rawResult) {
      const hint = /not connected|no browser tabs|enable/i.test(stderr + stdout)
        ? '\nPlaywriter extension not connected. Open Chrome, log into www.pathofexile.com, and click the Playwriter extension icon on that tab.'
        : '';
      throw new Error(`playwriter returned no result (status ${status}).${hint}\n${stderr || stdout}`.trim());
    }
    const parsed = JSON.parse(rawResult) as PoeFetchResponse<T> & { error?: string };

    // --- adaptive backoff on penalty / 429 ---
    const penalty = Math.max(penaltyMs(parsed.ratelimit || {}), parsed.status === 429 ? retryAfterMs(parsed.ratelimit || {}) || 10_000 : 0);
    if (penalty > 0) writeState({ blockedUntilMs: Date.now() + penalty });

    if (parsed.status === 0 && parsed.error) {
      throw new Error(`page-context fetch failed: ${parsed.error}\n${typeof parsed.data === 'string' ? parsed.data : ''}`.trim());
    }
    if (parsed.status === 429) {
      throw new Error(
        `GGG rate-limited (429). Backed off ${Math.ceil(penalty / 1000)}s. ` +
        `account-state=${parsed.ratelimit?.['x-rate-limit-account-state'] ?? 'n/a'}`
      );
    }

    return { status: parsed.status, ratelimit: parsed.ratelimit || {}, data: parsed.data };
  } finally {
    releaseLock();
  }
}
