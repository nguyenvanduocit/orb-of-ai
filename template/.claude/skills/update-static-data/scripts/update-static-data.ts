#!/usr/bin/env bun

/**
 * Trade-static datamine — refreshes data/trade-static/ from the trade API.
 *
 * Single source of truth for trade reference data. Pulls every public reference
 * endpoint the trade API exposes (leagues / static / items / stats / filters)
 * via a page-context fetch on a logged-in www.pathofexile.com tab (driven
 * through playwriter — never a direct GGG call), derives a currency id->text
 * map, and writes meta.json with provenance.
 *
 * Needs the user's Chrome open with a logged-in www.pathofexile.com tab
 * (Playwriter enabled) — there is no headless path.
 *
 * Consumed by: poe-trade/ggg/filters.ts (reads stats.json for stat-id lookup).
 *
 * Usage: bun .claude/skills/update-static-data/scripts/update-static-data.ts
 */

import { createTradeClient } from '../../poe-trade/ggg/client';
import { poeFetch } from '../../poe-trade/ggg/transport';

const GAME: 'poe1' | 'poe2' = 'poe2';
const API = GAME === 'poe2' ? '/api/trade2' : '/api/trade';
const REALM = GAME === 'poe2' ? '?realm=poe2' : '';

// scripts/ -> update-static-data -> skills -> .claude -> <workspace root>
const OUT = `${(import.meta as any).dir}/../../../../data/trade-static`;

/** entries across categories (stats/items/static), or result length (leagues), or key count (derived map). */
function count(d: any): number {
  const r = d?.result;
  if (!Array.isArray(r)) return Object.keys(d ?? {}).length;
  const entries = r.reduce((s: number, g: any) => s + (g.entries?.length ?? 0), 0);
  return entries || r.length;
}

async function main() {
  const client = createTradeClient({ league: 'Standard', game: GAME });
  console.log(`Datamine ${GAME} trade-static -> ${OUT}\n`);

  // leagues / static / items / stats go through the client (handles trade vs
  // trade2 path + realm). The transport serializes + enforces ≥2s spacing.
  const leagues = await client.getLeagues();
  const staticData = await client.getStatic();
  const items = await client.getItems();
  const stats = await client.getStats();
  // filters has no client method — call the transport directly.
  const filters = (await poeFetch<{ result: any[] }>(GAME, 'GET', `${API}/data/filters${REALM}`)).data;

  // derived: currency id -> text (handy for exchange / price queries)
  const currencies: Record<string, string> = {};
  for (const g of staticData?.result ?? []) {
    for (const e of g.entries ?? []) {
      if (e.id && e.text) currencies[e.id] = e.text;
    }
  }

  const files: Record<string, any> = {
    'leagues.json': leagues,
    'static.json': staticData,
    'items.json': items,
    'stats.json': stats,
    'filters.json': filters,
    'currencies.json': currencies,
  };

  for (const [name, data] of Object.entries(files)) {
    await Bun.write(`${OUT}/${name}`, JSON.stringify(data)); // Bun.write auto-creates OUT
    const n = name === 'currencies.json' ? Object.keys(data).length : count(data);
    console.log(`  ${name}: ${n} ${name === 'currencies.json' ? 'currencies' : 'entries'}`);
  }

  const meta = {
    datamined_at: new Date().toISOString(),
    game: GAME,
    leagues: (leagues?.result ?? []).map((l: any) => l.id),
    source: 'playwriter page-context fetch on logged-in www.pathofexile.com tab',
    endpoints: {
      'leagues.json': `${API}/data/leagues`,
      'static.json': `${API}/data/static`,
      'items.json': `${API}/data/items`,
      'stats.json': `${API}/data/stats`,
      'filters.json': `${API}/data/filters`,
      'currencies.json': '(derived from static.json)',
    },
  };
  await Bun.write(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
  console.log('  meta.json written\nDone.');
}

main().catch((e) => {
  console.error('Fatal:', e?.message ?? e);
  process.exit(1);
});
