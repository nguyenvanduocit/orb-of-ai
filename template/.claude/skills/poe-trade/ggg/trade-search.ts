#!/usr/bin/env bun

/**
 * POE Trade Search CLI
 *
 * Reusable CLI for searching the PoE trade API with stat filters,
 * price caps, and whisper support. Replaces the pattern of one-off
 * tmp/search-*.ts and tmp/trade-*.ts scripts.
 *
 * Usage:
 *   bun .claude/skills/poe-trade/ggg/trade-search.ts --type "Ghastly Eye Jewel" --stat "minion cold damage" --price 2c
 *   bun .claude/skills/poe-trade/ggg/trade-search.ts --category armour.boots --stat "total life:80" --stat "movement speed:25" --price 20c
 *   bun .claude/skills/poe-trade/ggg/trade-search.ts --term "Goldrim" --price 5c --instant
 *   bun .claude/skills/poe-trade/ggg/trade-search.ts --type "Bone Ring" --stat "life:60" --price 5c --whisper 1
 */

import { createTradeClient } from './client.ts';
import type { FetchedItem } from './client.ts';
import { searchStats, createSearch } from './filters.ts';

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string | string[] | boolean> {
  const result: Record<string, string | string[] | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result['help'] = true;
      i++;
    } else if (arg === '--instant') {
      result['instant'] = true;
      i++;
    } else if (arg === '--corrupted') {
      result['corrupted'] = true;
      i++;
    } else if (arg === '--json') {
      result['json'] = true;
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (key === 'stat') {
        // --stat can be repeated
        const existing = result['stat'];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result['stat'] = [value];
        }
        i += 2;
      } else {
        result[key] = value ?? '';
        i += 2;
      }
    } else {
      i++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
POE Trade Search CLI

USAGE:
  bun .claude/skills/poe-trade/ggg/trade-search.ts [options]

OPTIONS:
  --stat "text:min"        Stat filter (fuzzy text -> stat ID). Repeatable.
                           Value: ":80" or ":80-100" or omit for any value.
  --category cat           Item category (e.g. armour.boots, jewel.abyss)
  --type "Type Name"       Item base type (e.g. "Ghastly Eye Jewel")
  --term "text"            General search term (fuzzy)
  --name "text"            Exact item name
  --price 20c|5d           Max price. c=chaos, d=divine
  --min-price 1c           Min price
  --status online|instant|any  Trade status (default: online)
  --instant                Shorthand for --status instant
  --limit N                Max results to fetch (default: 10)
  --json                   Output as JSON array
  --league NAME            Override league (default: Mirage)
  --game poe1|poe2         Game version (default: poe1)
  --links N                Min linked sockets
  --sockets N              Min sockets
  --ilvl N                 Min item level
  --corrupted              Only corrupted items
  --sort price|stat        Sort order (default: price asc)
  --help                   Show this help

EXAMPLES:
  bun .claude/skills/poe-trade/ggg/trade-search.ts \\
    --category armour.boots \\
    --stat "total life:80" \\
    --stat "movement speed:25" \\
    --price 20c \\
    --limit 10

  bun .claude/skills/poe-trade/ggg/trade-search.ts --type "Ghastly Eye Jewel" --stat "minion cold damage" --price 2c

  bun .claude/skills/poe-trade/ggg/trade-search.ts --term "Goldrim" --price 5c

  bun .claude/skills/poe-trade/ggg/trade-search.ts --type "Bone Ring" --stat "life:60" --price 5c --instant

NOTES:
  - Trade calls run as a page-context fetch in the logged-in www.pathofexile.com tab (via playwriter) — no POESESSID needed
  - Stat text is fuzzy-searched; resolved stat ID is printed for verification
  - Read-only: to buy, open the printed Trade URL and whisper in-game
`);
}

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

function parsePrice(raw: string): { amount: number; currency: string } {
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(c|d|chaos|divine|ex|exalt)$/i);
  if (!m) {
    throw new Error(`Cannot parse price "${raw}". Use format like "20c" or "5d".`);
  }
  const amount = parseFloat(m[1]);
  const suffix = m[2].toLowerCase();
  const currency =
    suffix === 'c' || suffix === 'chaos' ? 'chaos' :
    suffix === 'd' || suffix === 'divine' ? 'divine' :
    suffix === 'ex' || suffix === 'exalt' ? 'exalted' :
    suffix;
  return { amount, currency };
}

// ---------------------------------------------------------------------------
// Stat resolution
// ---------------------------------------------------------------------------

interface ResolvedStat {
  id: string;
  text: string;
  min?: number;
  max?: number;
}

async function resolveStat(rawStat: string): Promise<ResolvedStat> {
  // Split "text:min" or "text:min-max"
  // But be careful: stat IDs contain dots like "pseudo.pseudo_total_life:80"
  // Strategy: split on LAST colon, then check if value part is numeric
  const colonIdx = rawStat.lastIndexOf(':');
  let query: string;
  let min: number | undefined;
  let max: number | undefined;

  if (colonIdx !== -1) {
    const potentialValue = rawStat.slice(colonIdx + 1).trim();
    // Only treat as value if it looks numeric (digit or digit-digit)
    if (/^\d/.test(potentialValue)) {
      query = rawStat.slice(0, colonIdx).trim();
      const dashIdx = potentialValue.indexOf('-');
      if (dashIdx !== -1) {
        min = parseFloat(potentialValue.slice(0, dashIdx));
        max = parseFloat(potentialValue.slice(dashIdx + 1));
      } else {
        min = parseFloat(potentialValue);
      }
    } else {
      query = rawStat.trim();
    }
  } else {
    query = rawStat.trim();
  }

  // If query looks like a stat ID (contains a dot + underscore pattern), use it directly
  if (/^(pseudo|explicit|implicit|crafted|fractured|enchant|crucible|scourge)\.\w+/.test(query)) {
    const { findStatById } = await import('./filters.ts');
    const stat = await findStatById(query);
    return { id: query, text: stat?.text ?? query, min, max };
  }

  const results = await searchStats(query, 3);
  if (results.length === 0) {
    throw new Error(`No stat found matching: "${query}". Run: bun .claude/skills/poe-trade/ggg/filters.ts search "${query}"`);
  }

  const best = results[0];
  return { id: best.id, text: best.text, min, max };
}

// ---------------------------------------------------------------------------
// PoB item text conversion
// ---------------------------------------------------------------------------

function frameTypeToRarity(frameType: number | undefined, name: string, typeLine: string): string {
  if (frameType === 3) return 'UNIQUE';
  if (frameType === 2) return 'RARE';
  if (frameType === 1) return 'MAGIC';
  // Fallback heuristic: both name and typeLine non-empty and different => RARE
  if (name && typeLine && name !== typeLine) return 'RARE';
  return 'NORMAL';
}

function toPobText(fetched: FetchedItem): string {
  const { item } = fetched;
  const rarity = frameTypeToRarity((item as any).frameType, item.name, item.typeLine);

  const lines: string[] = [];
  lines.push(`Rarity: ${rarity}`);

  if (rarity === 'RARE' || rarity === 'UNIQUE') {
    if (item.name) lines.push(item.name);
    if (item.typeLine) lines.push(item.typeLine);
  } else if (rarity === 'MAGIC') {
    if (item.typeLine) lines.push(item.typeLine);
  } else {
    if (item.typeLine) lines.push(item.typeLine);
  }

  // Level requirement
  const levelReq = item.requirements?.find(r => r.name === 'Level');
  if (levelReq) {
    const val = levelReq.values?.[0]?.[0];
    if (val !== undefined) lines.push(`LevelReq: ${val}`);
  }

  // Implicits
  const implicitCount = item.implicitMods?.length ?? 0;
  lines.push(`Implicits: ${implicitCount}`);
  if (item.implicitMods) {
    for (const mod of item.implicitMods) {
      lines.push(mod);
    }
  }

  // Enchants
  if (item.enchantMods) {
    for (const mod of item.enchantMods) {
      lines.push(`{enchant}${mod}`);
    }
  }

  // Fractured mods
  if (item.fracturedMods) {
    for (const mod of item.fracturedMods) {
      lines.push(`{fractured}${mod}`);
    }
  }

  // Explicit mods
  if (item.explicitMods) {
    for (const mod of item.explicitMods) {
      lines.push(mod);
    }
  }

  // Crafted mods
  if (item.craftedMods) {
    for (const mod of item.craftedMods) {
      lines.push(`{crafted}${mod}`);
    }
  }

  if (item.corrupted) lines.push('Corrupted');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

function formatPrice(listing: FetchedItem['listing']): string {
  if (!listing.price) return 'unpriced';
  const { amount, currency } = listing.price;
  const short = currency === 'chaos' ? 'c' : currency === 'divine' ? 'd' : currency;
  return `${amount} ${short}`;
}

function formatSockets(sockets: FetchedItem['item']['sockets']): string {
  if (!sockets || sockets.length === 0) return '';
  // Group by group number, sort within group
  const groups: Record<number, string[]> = {};
  for (const s of sockets) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s.sColour ?? s.attr ?? '?');
  }
  return Object.values(groups).map(g => g.join('')).join('-');
}

function formatItem(index: number, fetched: FetchedItem): string {
  const { item, listing } = fetched;
  const displayName = item.name ? `${item.name} ${item.typeLine}` : item.typeLine;
  const price = formatPrice(listing);
  const instantTag = listing.hideout_token ? ' [INSTANT]' : '';

  // Collect notable mods for the summary line
  const allMods = [
    ...(item.implicitMods ?? []),
    ...(item.explicitMods ?? []),
    ...(item.craftedMods ?? []),
    ...(item.fracturedMods ?? []),
  ];

  // Extract a few readable values
  const modSummary = allMods
    .slice(0, 6)
    .map(m => m.replace(/\n/g, ' ').trim())
    .join(' | ');

  const sockStr = formatSockets(item.sockets);
  const ilvlStr = item.ilvl ? ` iLvl:${item.ilvl}` : '';
  const corrStr = item.corrupted ? ' [CORRUPTED]' : '';

  const lines: string[] = [];
  lines.push(`#${index + 1} ${displayName.trim()} — ${price}${instantTag}${corrStr}${ilvlStr}`);
  if (modSummary) lines.push(`   ${modSummary}`);
  if (sockStr) lines.push(`   Sockets: ${sockStr}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    printHelp();
    process.exit(0);
  }

  // Config — auth comes from the logged-in browser session (page-context fetch), no POESESSID here.
  const league = (args['league'] as string) || 'Runes of Aldur';
  const game = ((args['game'] as string) || 'poe2') as 'poe1' | 'poe2';
  const limit = parseInt((args['limit'] as string) || '10', 10);
  const outputJson = args['json'] === true;
  const sortMode = (args['sort'] as string) || 'price';

  // Status
  let statusOption: 'online' | 'any' | 'securable' | 'available' = 'online';
  if (args['instant']) {
    statusOption = 'securable';
  } else if (args['status']) {
    const s = args['status'] as string;
    if (s === 'instant') statusOption = 'securable';
    else if (s === 'any') statusOption = 'any';
    else if (s === 'online') statusOption = 'online';
    else statusOption = s as any;
  }

  // Resolve stats
  const rawStats = Array.isArray(args['stat']) ? args['stat'] : (args['stat'] ? [args['stat'] as string] : []);
  const resolvedStats: ResolvedStat[] = [];

  if (rawStats.length > 0) {
    console.log('Resolving stats...');
    for (const rawStat of rawStats) {
      try {
        const resolved = await resolveStat(rawStat);
        resolvedStats.push(resolved);
        const valueStr = resolved.min !== undefined
          ? (resolved.max !== undefined ? ` [${resolved.min}-${resolved.max}]` : ` [min:${resolved.min}]`)
          : '';
        console.log(`  "${rawStat}" -> ${resolved.id} ("${resolved.text}")${valueStr}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    }
    console.log('');
  }

  // Build search request
  const builder = createSearch();

  // Item identity
  if (args['name']) builder.name(args['name'] as string);
  if (args['type']) builder.type(args['type'] as string);
  if (args['term']) builder.term(args['term'] as string);

  // Status
  if (statusOption === 'online') builder.onlineOnly();
  else if (statusOption === 'any') builder.includeOffline();
  // 'securable' and 'available' are set via addStatFilter raw path below

  // Price
  if (args['price']) {
    try {
      const { amount, currency } = parsePrice(args['price'] as string);
      builder.maxPrice(amount, currency);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  if (args['min-price']) {
    try {
      const { amount, currency } = parsePrice(args['min-price'] as string);
      builder.minPrice(amount, currency);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  // Misc filters
  if (args['ilvl']) builder.itemLevel(parseInt(args['ilvl'] as string, 10));
  if (args['links']) builder.minLinks(parseInt(args['links'] as string, 10));
  if (args['sockets']) builder.sockets(parseInt(args['sockets'] as string, 10));
  if (args['corrupted']) builder.corrupted(true);

  // Sort
  if (sortMode === 'price') builder.sortByPrice('asc');

  // Stats
  if (resolvedStats.length > 0) {
    const statGroup = builder.stats().and();
    for (const s of resolvedStats) {
      statGroup.add(s.id, s.min, s.max);
    }
    statGroup.done();
  }

  // Build raw request and patch status for securable/available
  const searchRequest = builder.build();
  if (statusOption === 'securable' || statusOption === 'available') {
    searchRequest.query.status = { option: statusOption };
  }

  // Category filter — not a standard builder method, patch directly
  if (args['category']) {
    if (!searchRequest.query.filters) searchRequest.query.filters = {};
    // type_filters.category is the PoE trade API field for item category
    (searchRequest.query.filters as any).type_filters = {
      filters: {
        category: { option: args['category'] as string },
      },
    };
  }

  // Execute search
  const client = createTradeClient({ league, game });

  console.log(`Searching on ${league} (${game})...`);

  let sr: Awaited<ReturnType<typeof client.search>>;
  let items: FetchedItem[];
  try {
    const result = await client.searchAndFetch(searchRequest, limit);
    sr = result.searchResult;
    items = result.items;
  } catch (err) {
    console.error('Search failed:', (err as Error).message);
    process.exit(1);
  }

  // Trade URL
  const tradeUrl =
    game === 'poe2'
      ? `https://www.pathofexile.com/trade2/search/poe2/${encodeURIComponent(league)}/${sr.id}`
      : `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}/${sr.id}`;
  console.log(`Trade URL: ${tradeUrl}`);
  console.log(`Total matches: ${sr.total} | Fetched: ${items.length}\n`);

  if (items.length === 0) {
    console.log('No items found.');
    process.exit(0);
  }

  // Output
  if (outputJson) {
    console.log(JSON.stringify(items, null, 2));
    process.exit(0);
  }

  for (let i = 0; i < items.length; i++) {
    const fetched = items[i];
    console.log(formatItem(i, fetched));
    console.log('--- PoB Item Text ---');
    console.log(toPobText(fetched));
    console.log('--- End ---\n');
  }

  // To buy: open the Trade URL above and whisper in-game. The transport is read-only
  // (account safety), so it never sends whispers or makes purchases.
}

main().catch(err => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
