#!/usr/bin/env bun
/**
 * Craft of Exile POE2 driver.
 *
 * Translates a human crafting intent (base + desired mods + method + ilvl) into
 * Craft of Exile's own id-space, drives the LIVE craftofexile.com/?game=poe2 page
 * through playwriter, and reads back the probability + cost that CoE's OWN engine
 * computes. The probability math is never recomputed here — CoE is the calculator;
 * this is only the id-mapper + browser driver + result reader.
 *
 * Data: data/craftofexile/poec_data.json (refresh with refresh.sh).
 * Browser: needs Chrome open + Playwriter enabled (same prereq as the /trade skill).
 *
 * Modes:
 *   craft.ts --search-base "spear"            list base ids matching a name
 *   craft.ts --list-methods                   list the craftable methods
 *   craft.ts --base "Ring" --list-mods        list every moddable affix on a base (+ tier ilvls)
 *   craft.ts --base "Ring" --ilvl 84 --method alchemy --mod "maximum Life" --mod "Fire Resistance"
 *                                             drive CoE and print P(hit) + cost + screenshot
 *
 * A --mod may carry a min-tier hint as "name#<tierIlvl>" (e.g. "maximum Life#30").
 * Without it the mod is required at ANY tier (= "this mod present at all").
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// The playwriter sandbox (code running inside Chrome) can only write under /tmp —
// its ScopedFS rejects macOS $TMPDIR (/var/folders/...) with EPERM. So every path
// the sandbox writes (result json, screenshot) lives under /tmp, not os.tmpdir().
const TMP = '/tmp';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '..', '..', 'data', 'craftofexile');
const DATA_FILE = join(DATA_DIR, 'poec_data.json');
const SESSION_FILE = join(homedir(), '.coe-playwriter-session');
const COE_URL = 'https://www.craftofexile.com';

// ---------------------------------------------------------------- data layer

interface Mod { id_modifier: string; name_modifier: string; affix: string; id_mgroup: string; mtypes: string }
interface Base { id_base: string; name_base: string; id_bgroup: string }
interface TierRow { ilvl: string; weighting: string; nvalues: string }

function loadData() {
  if (!existsSync(DATA_FILE)) {
    fail(`No data at ${DATA_FILE}. Run: bash ${join(HERE, 'refresh.sh')}`);
  }
  const d = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const bases: Base[] = d.bases.seq;
  const bgroups: Record<string, string> = {};
  for (const g of d.bgroups.seq) bgroups[String(g.id_bgroup)] = g.name_bgroup;
  const modsById: Record<string, Mod> = {};
  for (const m of d.modifiers.seq) modsById[String(m.id_modifier)] = m;
  const basemods: Record<string, number[]> = d.basemods;        // id_base -> [id_modifier]
  const tiers: Record<string, Record<string, TierRow[]>> = d.tiers; // id_mod -> id_base -> [tier]
  return { d, bases, bgroups, modsById, basemods, tiers };
}

type Data = ReturnType<typeof loadData>;

function resolveBase(data: Data, name: string): Base {
  const q = name.trim().toLowerCase();
  const exact = data.bases.find((b) => b.name_base.toLowerCase() === q);
  if (exact) return exact;
  const hits = data.bases.filter((b) => b.name_base.toLowerCase().includes(q));
  if (hits.length === 0) fail(`No base matches "${name}". Try --search-base "${name}".`);
  if (hits.length > 1) {
    // prefer the shortest name (most generic, e.g. "Ring" over "Ruby Ring")
    hits.sort((a, b) => a.name_base.length - b.name_base.length);
  }
  return hits[0];
}

/** Resolve a "name#tierIlvl" mod spec against the mods legal on this base. */
function resolveMod(data: Data, baseId: string, spec: string) {
  const [namePart, tierPart] = spec.split('#');
  const q = namePart.trim().toLowerCase();
  const legal = (data.basemods[baseId] || []).map(String);
  const matched = legal
    .map((id) => data.modsById[id])
    .filter((m) => m && m.name_modifier.toLowerCase().includes(q));
  if (matched.length === 0) fail(`No mod matching "${namePart}" on this base. Use --list-mods to see options.`);

  // Orb crafting rolls EXPLICIT mods (prefix/suffix). Drop corrupted/implicit/special
  // affixes — they share display names with explicit ones (e.g. "all Elemental Resistances"
  // exists as both a corrupted implicit and a suffix) and orbs can never roll them.
  let cands = matched.filter((m) => m.affix === 'prefix' || m.affix === 'suffix');
  if (cands.length === 0) {
    fail(`"${namePart}" only matches non-craftable affixes on this base (e.g. corrupted/implicit). ` +
      `Orb crafting can't roll it. Matched: ${matched.map((m) => `[${m.affix}] ${m.name_modifier}`).join(' | ')}`);
  }
  // Exact-name match wins outright; otherwise prefer the shortest name (the pure mod over hybrids).
  const exact = cands.filter((m) => m.name_modifier.toLowerCase() === q);
  cands = (exact.length ? exact : cands).sort((a, b) => a.name_modifier.length - b.name_modifier.length);
  const mod = cands[0];
  // Don't silently swallow ambiguity: if other distinct mods also matched, name them on stderr.
  const alts = cands.slice(1).filter((m) => m.name_modifier !== mod.name_modifier);
  if (alts.length) {
    console.error(`  note: "${namePart}" also matched ${alts.map((m) => `[${m.affix}] ${m.name_modifier}`).join(', ')} — using "${mod.name_modifier}". Refine --mod if wrong.`);
  }
  const baseTiers = (data.tiers[mod.id_modifier] || {})[baseId] || [];
  if (baseTiers.length === 0) fail(`Mod "${mod.name_modifier}" has no tiers on this base.`);
  const ilvls = baseTiers.map((t) => Number(t.ilvl)).sort((a, b) => a - b);
  // l = the tier-ilvl we require. Default: lowest (mod present at any tier).
  let l = ilvls[0];
  if (tierPart) {
    const want = Number(tierPart);
    // snap to the highest tier ilvl that is <= requested (that bracket "or better")
    const snapped = ilvls.filter((x) => x <= want).pop();
    l = snapped ?? ilvls[0];
  }
  return { mod, l, ilvls, baseTiers };
}

// ----------------------------------------------------------- playwriter drive

function ensureSession(): string {
  if (existsSync(SESSION_FILE)) {
    const id = readFileSync(SESSION_FILE, 'utf8').trim();
    if (id) return id;
  }
  const r = spawnSync('playwriter', ['session', 'new'], { encoding: 'utf8', timeout: 30000 });
  const m = (r.stdout || '').match(/Session (\d+) created/) || (r.stdout || '').match(/^(\d+)\s*$/m);
  if (!m) fail(`playwriter session new failed.\n${r.stderr || r.stdout}`);
  writeFileSync(SESSION_FILE, m[1]);
  return m[1];
}

function runDrive(url: string, screenshotPath: string) {
  const session = ensureSession();
  const dir = mkdtempSync(join(TMP, 'coe-'));
  const resultPath = join(dir, 'result.json');
  const scriptPath = join(dir, 'drive.js');
  writeFileSync(scriptPath, driveScript(url, screenshotPath, resultPath));

  let r = spawnSync('playwriter', ['-s', session, '-f', scriptPath], { encoding: 'utf8', timeout: 90000 });
  // a stale/closed session → recreate once
  if (!existsSync(resultPath) && /not connected|No session|session .* not found/i.test(r.stderr || r.stdout || '')) {
    const fresh = spawnSync('playwriter', ['session', 'new'], { encoding: 'utf8', timeout: 30000 });
    const m = (fresh.stdout || '').match(/Session (\d+) created/);
    if (m) { writeFileSync(SESSION_FILE, m[1]); r = spawnSync('playwriter', ['-s', m[1], '-f', scriptPath], { encoding: 'utf8', timeout: 90000 }); }
  }
  if (!existsSync(resultPath)) {
    fail(`Drive produced no result.\nstdout: ${r.stdout?.slice(-600)}\nstderr: ${r.stderr?.slice(-600)}\n` +
      `Is Chrome open with the Playwriter extension enabled on a tab?`);
  }
  return JSON.parse(readFileSync(resultPath, 'utf8'));
}

/** The JS executed inside the user's Chrome (playwriter sandbox). Keep the read small. */
function driveScript(url: string, screenshot: string, resultPath: string): string {
  return `
const RESULT = ${JSON.stringify(resultPath)};
const fs = require('node:fs');
const write = (o) => fs.writeFileSync(RESULT, JSON.stringify(o));
try {
  state.page = context.pages().find(p => p.url().includes('craftofexile.com')) ?? (await context.newPage());
  await state.page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded' });
  await waitForPageLoad({ page: state.page, timeout: 12000 });
  // CoE auto-computes on load. Poll for the result — do NOT force poec_computeFinalProbsV2(),
  // it throws for "pre"/additive methods (chaos, exalted, regal, annul, augmentation) because
  // the affix-group setup the page runs on load is skipped.
  let loaded = false;
  try {
    await state.page.waitForFunction(() => {
      const e = document.getElementById('poecConfidenceResult');
      return e && e.innerText.trim().length > 0;
    }, { timeout: 12000 });
    loaded = await state.page.evaluate(() => (typeof poec_cBase !== 'undefined') && poec_cBase !== null);
  } catch (e) {}
  if (!loaded) { write({ error: 'CoE did not load/compute from the URL (no result after 12s). Base or mods may be invalid for this method.' }); }
  else {
    // expand the cost breakdown only if it is collapsed (clicking an open one would toggle it shut)
    const hasCur = await state.page.evaluate(() => { const c = document.getElementById('poecCurrencyOutput'); return !!(c && c.innerText.trim().length > 0); });
    if (!hasCur) { try { await state.page.getByRole('link', { name: /FINAL CALCULATION/i }).first().click({ timeout: 3000 }); await state.page.waitForTimeout(700); } catch (e) {} }
    const data = await state.page.evaluate(() => {
      const T = (id) => { const e = document.getElementById(id); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; };
      const reqMods = Array.from(document.querySelectorAll('#poecAffixes .affix.req')).map(r => ({
        aid: r.getAttribute('aid'), atype: r.getAttribute('atype'),
        name: (r.querySelector('.label>div') && r.querySelector('.label>div').childNodes[0] ? r.querySelector('.label>div').childNodes[0].textContent : '').trim()
      }));
      const cur = document.getElementById('poecCurrencyOutput');
      const outOfLeague = (() => { const m = document.getElementById('outOfLeagueMessage'); return !!(m && m.offsetParent !== null); })();
      return {
        base: (typeof poec_cBase !== 'undefined') ? poec_cBase : null,
        method: (typeof poec_cMethod !== 'undefined') ? poec_cMethod : null,
        ilvl: (typeof poec_cILvl !== 'undefined') ? poec_cILvl : null,
        confidence: T('poecConfidenceResult'),
        currencyRaw: cur ? cur.innerText.replace(/\\s+/g, ' ').trim() : null,
        reqMods, outOfLeague
      };
    });
    await state.page.screenshot({ path: ${JSON.stringify(screenshot)}, scale: 'css' });
    data.screenshot = ${JSON.stringify(screenshot)};
    write(data);
  }
} catch (e) { write({ error: String(e && e.message || e) }); }
console.log('DRIVE_DONE');
`;
}

// ------------------------------------------------------------------- parsing

function parseResult(raw: any) {
  if (raw.error) return raw;
  const txt: string = raw.currencyRaw || '';
  // "... Converted costs for 78 tries 3.963 Chaos Orbs" / "Total 78 Orbs of Alchemy 0.051 3.963"
  const triesM = txt.match(/Converted costs for\s+([\d.,]+)\s+tries/i) || txt.match(/Total\s+([\d.,]+)\b/i);
  const costM = txt.match(/Converted costs for[^]*?([\d.,]+)\s*Chaos/i) || txt.match(/per success\s+([\d.,]+)\s*Chaos/i);
  const num = (s?: string) => (s ? Number(s.replace(/,/g, '')) : null);
  return {
    ...raw,
    avgAttempts: num(triesM?.[1]),
    costChaos: num(costM?.[1]),
    confidencePct: raw.confidence ? Number(String(raw.confidence).replace('%', '')) : null,
  };
}

// ---------------------------------------------------------------------- modes

function fail(msg: string): never { console.error('ERROR: ' + msg); process.exit(1); }

function getArgs() {
  const a = process.argv.slice(2);
  const opt: Record<string, any> = { mod: [] };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--mod') opt.mod.push(a[++i]);
    else if (k.startsWith('--')) {
      const key = k.slice(2);
      const v = (i + 1 < a.length && !a[i + 1].startsWith('--')) ? a[++i] : 'true';
      opt[key] = v;
    }
  }
  return opt;
}

function main() {
  const o = getArgs();
  const data = loadData();

  if (o['search-base']) {
    const q = String(o['search-base']).toLowerCase();
    const hits = data.bases.filter((b) => b.name_base.toLowerCase().includes(q));
    console.log(`Bases matching "${o['search-base']}":`);
    for (const b of hits) console.log(`  id_base=${b.id_base}  ${b.name_base}  [${data.bgroups[b.id_bgroup]}]`);
    return;
  }

  if (o['list-methods']) {
    // method registry is read live by the driver; print the verified static set
    for (const [k, v] of Object.entries(METHODS)) console.log(`  ${k.padEnd(13)} ${v}`);
    return;
  }

  if (o['list-mods']) {
    const base = resolveBase(data, String(o.base));
    console.log(`Moddable affixes on ${base.name_base} (id_base=${base.id_base}):`);
    const legal = (data.basemods[base.id_base] || []).map(String);
    const rows = legal.map((id) => data.modsById[id]).filter(Boolean);
    rows.sort((a, b) => a.affix.localeCompare(b.affix) || a.name_modifier.localeCompare(b.name_modifier));
    for (const m of rows) {
      const bt = (data.tiers[m.id_modifier] || {})[base.id_base] || [];
      const ilvls = bt.map((t) => t.ilvl).join(',');
      console.log(`  [${m.affix[0].toUpperCase()}] id=${m.id_modifier}  ${m.name_modifier}   (tier ilvls: ${ilvls})`);
    }
    return;
  }

  // craft mode
  if (!o.base || !o.method || o.mod.length === 0) {
    fail('Need --base, --method and at least one --mod. See header for usage.');
  }
  const base = resolveBase(data, String(o.base));
  const method = String(o.method).toLowerCase();
  if (!METHODS[method]) fail(`Unknown method "${method}". One of: ${Object.keys(METHODS).join(', ')}`);
  const ilvl = Number(o.ilvl || 84);

  const resolved = o.mod.map((spec: string) => resolveMod(data, base.id_base, spec));
  const req: Record<string, { l: number }> = {};
  for (const r of resolved) req[r.mod.id_modifier] = { l: r.l };

  const params = new URLSearchParams({ game: 'poe2', b: base.id_base, lv: String(ilvl), m: method, req: JSON.stringify(req) });
  const url = `${COE_URL}/?${params.toString()}`;
  const screenshot = join(TMP, `coe-craft-${base.name_base.toLowerCase().replace(/\W+/g, '-')}-${ilvl}.png`);

  console.error(`Driving CoE: ${base.name_base} (ilvl ${ilvl}) via ${METHODS[method]}`);
  console.error(`  target: ${resolved.map((r) => r.mod.name_modifier + (r.l > Math.min(...r.ilvls) ? `#${r.l}` : '')).join('  +  ')}`);

  const result = parseResult(runDrive(url, screenshot));

  const out = {
    base: base.name_base,
    ilvl,
    method: METHODS[method],
    target: resolved.map((r) => ({ mod: r.mod.name_modifier, affix: r.mod.affix, requiredTierIlvl: r.l })),
    avgAttempts: result.avgAttempts,
    costChaos: result.costChaos,
    confidencePct: result.confidencePct,
    outOfLeague: result.outOfLeague,
    screenshot: result.screenshot,
    coeUrl: url,
    error: result.error,
    currencyRaw: result.currencyRaw,
  };
  console.log(JSON.stringify(out, null, 2));
}

// verified live from poec_methods (2026-06-09). pre = adds onto an existing item.
const METHODS: Record<string, string> = {
  transmute: 'Orb of Transmutation',
  augmentation: 'Orb of Augmentation (pre)',
  alchemy: 'Orb of Alchemy',
  regal: 'Regal Orb (pre)',
  exalted: 'Exalted Orb (pre)',
  chaos: 'Chaos Orb',
  annul: 'Orb of Annulment (pre)',
};

main();
