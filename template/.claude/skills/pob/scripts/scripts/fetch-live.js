// fetch-live.js — pull LIVE POE2 character equipment from pathofexile2.com internal-api.
//
// Driven by fetch-live.sh: the placeholders __POB_NAME__ / __POB_EXPORT_DIR__ /
// __POB_REALM__ are substituted before this runs via `playwriter -s <id> -f`.
//
// Strategy (two reliable steps):
//   1. name -> opaque id : read the SPA's own roster from localStorage
//      ('common.characters-pcache'). The list network call only fires on the FIRST
//      visit (the SPA client-caches it), so intercepting it is unreliable — but the
//      localStorage roster is always present once the page has loaded.
//   2. live equipment     : navigate to the character page. The SPA re-fetches the
//      character/<id> endpoint on EVERY visit, so we intercept that fresh response.
//
// Tab reuse: fetch-live.sh persists one Playwriter session across runs, so state.page
// survives and the SAME tab is reused. If the session was recreated (relay restart),
// we grab a pathofexile2.com tab a prior run left behind before opening a new one —
// no more one-tab-per-run.
//
// We never read, store, or replay the DPoP token — the logged-in browser makes its
// own same-origin request and we only read the response. Same same-origin
// safety model.
//
// Scope: EQUIPMENT ONLY (raw mods/runes/sockets/gems/flasks). Passives, skills and
// quest stats are NOT exposed by this endpoint — get those from poe.ninja
// (fetch-poeninja.sh's computed model).
//
// stdout contract (lines the wrapper greps):
//   POB_LIVE_CHARS: <json array {id,name,level,class,league}>
//   POB_LIVE_OK: <json {name,class,level,league,lastLoginTime,items,source,out}>
//   POB_LIVE_LISTONLY: <msg>
//   POB_LIVE_ERROR: <msg>

const TARGET = "__POB_NAME__";
const EXPORT_DIR = "__POB_EXPORT_DIR__";
const REALM = "__POB_REALM__" || "poe2";
const BASE = "https://pathofexile2.com";
const fs = require('node:fs');

const run = async () => {
  state.cap = { char: null };

  // Reuse our tab across runs (avoids spawning a fresh tab every invocation).
  let pg = (state.page && !state.page.isClosed()) ? state.page : null;
  if (!pg) pg = context.pages().find(p => p.url().includes('pathofexile2.com/my-account'));
  if (!pg) pg = context.pages().find(p => p.url() === 'about:blank');
  if (!pg) pg = await context.newPage();
  state.page = pg;
  state.page.removeAllListeners('response'); // drop any stale listener from a prior run

  // Force network so the char-detail request always hits the wire (not HTTP cache).
  try {
    const cdp = await getCDPSession({ page: state.page });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  } catch (e) {}

  state.page.on('response', async (res) => {
    if (res.url().includes('/internal-api/my-account/character/')) {
      try { state.cap.char = await res.text(); } catch (e) {}
    }
  });

  const waitFor = async (pred, tries) => {
    for (let i = 0; i < tries; i++) { if (pred()) return true; await state.page.waitForTimeout(300); }
    return pred();
  };
  const readRoster = async () => {
    if (!state.page.url().includes('pathofexile2.com')) return [];
    const raw = await state.page.evaluate(() => localStorage.getItem('common.characters-pcache'));
    if (!raw) return [];
    try {
      const pc = JSON.parse(raw);
      const arr = (pc.currentCharacters && pc.currentCharacters.value) || pc.value || pc;
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  };

  // Resolve name -> opaque id from the SPA's localStorage roster. If the reused tab
  // already sits on the site, this needs ZERO navigation; only load the list page
  // when the roster isn't cached yet.
  let roster = await readRoster();
  if (!roster.length) {
    await state.page.goto(`${BASE}/my-account/characters`, { waitUntil: 'domcontentloaded' });
    if (!state.page.url().includes('/my-account/characters')) {
      console.log('POB_LIVE_ERROR: redirected to ' + state.page.url() + ' — not logged in to pathofexile2.com in this Chrome profile.');
      state.page.removeAllListeners('response');
      return;
    }
    for (let i = 0; i < 20; i++) { roster = await readRoster(); if (roster.length) break; await state.page.waitForTimeout(300); }
  }
  if (!roster.length) {
    console.log('POB_LIVE_ERROR: character roster not found (not logged in, or the site changed its cache key).');
    state.page.removeAllListeners('response');
    return;
  }

  console.log('POB_LIVE_CHARS: ' + JSON.stringify(roster.map(c => ({ id: c.id, name: c.name, level: c.level, class: c.class, league: c.league }))));

  if (!TARGET) {
    console.log('POB_LIVE_LISTONLY: no character name given; listed ' + roster.length + ' character(s).');
    state.page.removeAllListeners('response');
    return;
  }

  const t = TARGET.toLowerCase();
  const match = roster.find(c => (c.name || '').toLowerCase() === t)
             || roster.find(c => (c.name || '').toLowerCase().includes(t));
  if (!match) {
    console.log('POB_LIVE_ERROR: character "' + TARGET + '" not found among ' + roster.length + ' character(s).');
    state.page.removeAllListeners('response');
    return;
  }

  // Character page → the SPA re-fetches equipment each visit; intercept it.
  state.cap.char = null;
  await state.page.goto(`${BASE}/my-account/characters/${match.id}?realm=${REALM}`, { waitUntil: 'domcontentloaded' });
  await waitFor(() => state.cap.char, 24);
  state.page.removeAllListeners('response');

  let payload = state.cap.char;
  let source = 'live';
  // Fallback: if the live intercept missed but the roster cache already holds this
  // character's equipment, use it — but flag it 'cache' so stale gear can't pass as
  // fresh (the whole point of this tool is freshness).
  if (!payload && (match.equipment || []).length) { payload = JSON.stringify({ data: match }); source = 'cache'; }
  if (!payload) {
    console.log('POB_LIVE_ERROR: equipment not captured for ' + match.name + ' (id ' + match.id + ').');
    return;
  }

  let cd;
  try { cd = JSON.parse(payload).data; } catch (e) {
    console.log('POB_LIVE_ERROR: equipment response is not valid JSON.');
    return;
  }

  const out = EXPORT_DIR + '/live-' + cd.name + '.json';
  fs.writeFileSync(out, payload);
  console.log('POB_LIVE_OK: ' + JSON.stringify({
    name: cd.name, class: cd.class, level: cd.level, league: cd.league,
    lastLoginTime: cd.lastLoginTime, items: (cd.equipment || []).length, source, out
  }));
};

await run();
