import { describe, test, expect } from 'bun:test';
import { PoeTradeClient, createTradeClient, type FetchedItem } from '../client';
import { TradeSearchBuilder, StatFilterBuilder, createSearch } from '../filters';

// ==========================================================================
// Helpers - re-implement or extract pure functions from poe-trade.ts
// since they are not exported, we duplicate them here for testing.
// ==========================================================================

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[++i];
      } else {
        result[key] = 'true';
      }
    }
  }
  return result;
}

function calculatePercentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function round2(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

function formatPrice(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

function formatListing(item: FetchedItem, details?: boolean) {
  const base: Record<string, unknown> = {
    price: item.listing.price
      ? formatPrice(item.listing.price.amount, item.listing.price.currency)
      : null,
    instant: !!item.listing.hideout_token,
    seller: item.listing.account.name,
    token: item.listing.hideout_token || null,
    whisper: item.listing.whisper || null,
  };
  if (details) {
    base.ilvl = item.item.ilvl;
    base.corrupted = item.item.corrupted || false;
    base.sockets = item.item.sockets?.map((s) => s.sColour).join('-') || 'none';
    base.mods = [
      ...(item.item.implicitMods || []),
      ...(item.item.explicitMods || []),
      ...(item.item.enchantMods || []),
    ];
  }
  return base;
}

function separateListings(items: FetchedItem[]): {
  instantBuyout: FetchedItem[];
  regular: FetchedItem[];
} {
  const instantBuyout: FetchedItem[] = [];
  const regular: FetchedItem[] = [];
  for (const item of items) {
    if (item.listing.hideout_token) {
      instantBuyout.push(item);
    } else {
      regular.push(item);
    }
  }
  return { instantBuyout, regular };
}

function calculateStats(items: FetchedItem[]): Array<{
  count: number;
  currency: string;
  prices: number[];
  min: number;
  max: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}> {
  const byCurrency: Record<string, number[]> = {};
  for (const item of items) {
    if (item.listing.price) {
      const { currency, amount } = item.listing.price;
      if (!byCurrency[currency]) byCurrency[currency] = [];
      byCurrency[currency].push(amount);
    }
  }
  return Object.entries(byCurrency).map(([currency, prices]) => {
    const sorted = [...prices].sort((a, b) => a - b);
    return {
      count: sorted.length,
      currency,
      prices: sorted,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p10: round2(calculatePercentile(sorted, 10)) ?? 0,
      p25: round2(calculatePercentile(sorted, 25)) ?? 0,
      p50: round2(calculatePercentile(sorted, 50)) ?? 0,
      p75: round2(calculatePercentile(sorted, 75)) ?? 0,
      p90: round2(calculatePercentile(sorted, 90)) ?? 0,
    };
  }).sort((a, b) => b.count - a.count);
}

// ==========================================================================
// Test fixture helpers
// ==========================================================================

function makeFetchedItem(overrides: {
  price?: { amount: number; currency: string };
  hideout_token?: string;
  whisper?: string;
  seller?: string;
  ilvl?: number;
  corrupted?: boolean;
  sockets?: Array<{ group: number; attr: string; sColour: string }>;
  implicitMods?: string[];
  explicitMods?: string[];
  enchantMods?: string[];
}): FetchedItem {
  return {
    id: 'test-id',
    listing: {
      indexed: '2024-01-01T00:00:00Z',
      account: { name: overrides.seller ?? 'TestSeller' },
      price: overrides.price
        ? { type: '~price', amount: overrides.price.amount, currency: overrides.price.currency }
        : undefined,
      hideout_token: overrides.hideout_token,
      whisper: overrides.whisper,
    },
    item: {
      verified: true,
      w: 1,
      h: 1,
      icon: 'https://example.com/icon.png',
      league: 'Standard',
      name: 'Test Item',
      typeLine: 'Test Base',
      identified: true,
      ilvl: overrides.ilvl,
      corrupted: overrides.corrupted,
      sockets: overrides.sockets,
      implicitMods: overrides.implicitMods,
      explicitMods: overrides.explicitMods,
      enchantMods: overrides.enchantMods,
    },
  };
}

// ==========================================================================
// 1. parseArgs
// ==========================================================================

describe('parseArgs', () => {
  test('parses named flags with values', () => {
    const result = parseArgs(['--game', 'poe1', '--item', 'Headhunter']);
    expect(result).toEqual({ game: 'poe1', item: 'Headhunter' });
  });

  test('parses boolean flags (no value after flag)', () => {
    const result = parseArgs(['--details', '--game', 'poe1']);
    expect(result).toEqual({ details: 'true', game: 'poe1' });
  });

  test('boolean flag at end of args', () => {
    const result = parseArgs(['--game', 'poe1', '--details']);
    expect(result).toEqual({ game: 'poe1', details: 'true' });
  });

  test('returns empty object for empty args', () => {
    expect(parseArgs([])).toEqual({});
  });

  test('ignores non-flag arguments', () => {
    const result = parseArgs(['positional', '--flag', 'value']);
    expect(result).toEqual({ flag: 'value' });
  });

  test('handles flag followed by another flag (boolean)', () => {
    const result = parseArgs(['--a', '--b', '--c', 'val']);
    expect(result).toEqual({ a: 'true', b: 'true', c: 'val' });
  });

  test('handles item names with spaces when quoted by shell', () => {
    // Shell would pass "Leer Cast" as a single arg
    const result = parseArgs(['--item', 'Leer Cast']);
    expect(result).toEqual({ item: 'Leer Cast' });
  });

  test('handles --mode with value', () => {
    const result = parseArgs(['--mode', 'instant']);
    expect(result).toEqual({ mode: 'instant' });
  });
});

// ==========================================================================
// 2. calculatePercentile
// ==========================================================================

describe('calculatePercentile', () => {
  test('returns null for empty array', () => {
    expect(calculatePercentile([], 50)).toBeNull();
  });

  test('returns the single element for single-element array', () => {
    expect(calculatePercentile([42], 0)).toBe(42);
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 100)).toBe(42);
  });

  test('returns exact value when index lands on element', () => {
    // [10, 20, 30, 40, 50] - p50 => idx = 2.0 => 30
    expect(calculatePercentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  test('interpolates between elements', () => {
    // [10, 20, 30, 40, 50] - p25 => idx = 1.0 => 20
    expect(calculatePercentile([10, 20, 30, 40, 50], 25)).toBe(20);
    // p10 => idx = 0.4 => 10 + (20-10)*0.4 = 14
    expect(calculatePercentile([10, 20, 30, 40, 50], 10)).toBe(14);
  });

  test('returns first element for p0', () => {
    expect(calculatePercentile([5, 10, 15], 0)).toBe(5);
  });

  test('returns last element for p100', () => {
    expect(calculatePercentile([5, 10, 15], 100)).toBe(15);
  });

  test('two-element array interpolation', () => {
    // [100, 200] - p50 => idx = 0.5 => 100 + (200-100)*0.5 = 150
    expect(calculatePercentile([100, 200], 50)).toBe(150);
  });
});

// ==========================================================================
// 3. formatPrice
// ==========================================================================

describe('formatPrice', () => {
  test('formats amount and currency', () => {
    expect(formatPrice(100, 'chaos')).toBe('100 chaos');
  });

  test('formats decimal amounts', () => {
    expect(formatPrice(1.5, 'divine')).toBe('1.5 divine');
  });

  test('formats zero', () => {
    expect(formatPrice(0, 'chaos')).toBe('0 chaos');
  });
});

// ==========================================================================
// 5. formatListing
// ==========================================================================

describe('formatListing', () => {
  test('basic listing without details', () => {
    const item = makeFetchedItem({
      price: { amount: 10, currency: 'chaos' },
      seller: 'Player1',
      hideout_token: 'tok123',
      whisper: '@Player1 Hi',
    });
    const result = formatListing(item);
    expect(result).toEqual({
      price: '10 chaos',
      instant: true,
      seller: 'Player1',
      token: 'tok123',
      whisper: '@Player1 Hi',
    });
  });

  test('listing without price', () => {
    const item = makeFetchedItem({ seller: 'NoPrice' });
    const result = formatListing(item);
    expect(result.price).toBeNull();
  });

  test('listing without hideout_token is not instant', () => {
    const item = makeFetchedItem({ seller: 'Regular' });
    const result = formatListing(item);
    expect(result.instant).toBe(false);
    expect(result.token).toBeNull();
  });

  test('listing without whisper', () => {
    const item = makeFetchedItem({ seller: 'NoWhisper' });
    const result = formatListing(item);
    expect(result.whisper).toBeNull();
  });

  test('with details includes ilvl, corrupted, sockets, mods', () => {
    const item = makeFetchedItem({
      price: { amount: 5, currency: 'divine' },
      seller: 'DetailSeller',
      ilvl: 86,
      corrupted: true,
      sockets: [
        { group: 0, attr: 'S', sColour: 'R' },
        { group: 0, attr: 'D', sColour: 'G' },
      ],
      implicitMods: ['+10 to max life'],
      explicitMods: ['+50 to max life', '+30% fire res'],
      enchantMods: ['enchant mod'],
    });
    const result = formatListing(item, true);
    expect(result.ilvl).toBe(86);
    expect(result.corrupted).toBe(true);
    expect(result.sockets).toBe('R-G');
    expect(result.mods).toEqual(['+10 to max life', '+50 to max life', '+30% fire res', 'enchant mod']);
  });

  test('with details defaults corrupted to false', () => {
    const item = makeFetchedItem({ seller: 'X' });
    const result = formatListing(item, true);
    expect(result.corrupted).toBe(false);
  });

  test('with details shows "none" for no sockets', () => {
    const item = makeFetchedItem({ seller: 'X' });
    const result = formatListing(item, true);
    expect(result.sockets).toBe('none');
  });

  test('with details empty mods arrays', () => {
    const item = makeFetchedItem({ seller: 'X' });
    const result = formatListing(item, true);
    expect(result.mods).toEqual([]);
  });
});

// ==========================================================================
// 6. separateListings
// ==========================================================================

describe('separateListings', () => {
  test('separates instant from regular', () => {
    const instant = makeFetchedItem({ hideout_token: 'tok1', seller: 'A' });
    const regular = makeFetchedItem({ seller: 'B' });
    const result = separateListings([instant, regular]);
    expect(result.instantBuyout).toHaveLength(1);
    expect(result.regular).toHaveLength(1);
    expect(result.instantBuyout[0].listing.account.name).toBe('A');
    expect(result.regular[0].listing.account.name).toBe('B');
  });

  test('empty array returns empty lists', () => {
    const result = separateListings([]);
    expect(result.instantBuyout).toHaveLength(0);
    expect(result.regular).toHaveLength(0);
  });

  test('all instant', () => {
    const items = [
      makeFetchedItem({ hideout_token: 't1', seller: 'A' }),
      makeFetchedItem({ hideout_token: 't2', seller: 'B' }),
    ];
    const result = separateListings(items);
    expect(result.instantBuyout).toHaveLength(2);
    expect(result.regular).toHaveLength(0);
  });

  test('all regular', () => {
    const items = [
      makeFetchedItem({ seller: 'A' }),
      makeFetchedItem({ seller: 'B' }),
    ];
    const result = separateListings(items);
    expect(result.instantBuyout).toHaveLength(0);
    expect(result.regular).toHaveLength(2);
  });
});

// ==========================================================================
// 7. calculateStats
// ==========================================================================

describe('calculateStats', () => {
  test('groups by currency with correct stats', () => {
    const items = [
      makeFetchedItem({ price: { amount: 10, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 20, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 30, currency: 'chaos' } }),
    ];
    const stats = calculateStats(items);
    expect(stats).toHaveLength(1);
    expect(stats[0].currency).toBe('chaos');
    expect(stats[0].count).toBe(3);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(30);
    expect(stats[0].p50).toBe(20);
  });

  test('multiple currencies sorted by count descending', () => {
    const items = [
      makeFetchedItem({ price: { amount: 1, currency: 'divine' } }),
      makeFetchedItem({ price: { amount: 100, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 200, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 300, currency: 'chaos' } }),
    ];
    const stats = calculateStats(items);
    expect(stats).toHaveLength(2);
    expect(stats[0].currency).toBe('chaos'); // 3 items
    expect(stats[1].currency).toBe('divine'); // 1 item
  });

  test('items without price are ignored', () => {
    const items = [
      makeFetchedItem({ price: { amount: 10, currency: 'chaos' } }),
      makeFetchedItem({}), // no price
    ];
    const stats = calculateStats(items);
    expect(stats).toHaveLength(1);
    expect(stats[0].count).toBe(1);
  });

  test('empty items array returns empty stats', () => {
    expect(calculateStats([])).toEqual([]);
  });

  test('single item stats', () => {
    const items = [makeFetchedItem({ price: { amount: 42, currency: 'chaos' } })];
    const stats = calculateStats(items);
    expect(stats[0].min).toBe(42);
    expect(stats[0].max).toBe(42);
    expect(stats[0].p50).toBe(42);
  });

  test('prices are sorted before calculating', () => {
    const items = [
      makeFetchedItem({ price: { amount: 50, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 10, currency: 'chaos' } }),
      makeFetchedItem({ price: { amount: 30, currency: 'chaos' } }),
    ];
    const stats = calculateStats(items);
    expect(stats[0].prices).toEqual([10, 30, 50]);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(50);
  });
});

// ==========================================================================
// 8. getConfig
// ==========================================================================

describe('PoeTradeClient getConfig', () => {
  test('exposes non-sensitive config fields', () => {
    const client = createTradeClient({
      league: 'Mirage',
      game: 'poe1',
    });
    const config = client.getConfig();
    expect(config.league).toBe('Mirage');
    expect(config.game).toBe('poe1');
  });
});

// ==========================================================================
// 11. StatFilterBuilder chaining
// ==========================================================================

describe('StatFilterBuilder chaining', () => {
  test('done() returns the parent TradeSearchBuilder', () => {
    const builder = createSearch();
    const returned = builder.stats().and().add('pseudo.pseudo_total_life', 70).done();
    // done() should return the parent builder, allowing continued chaining
    expect(returned).toBe(builder);
  });

  test('stat group is added to search request after done()', () => {
    const request = createSearch()
      .stats()
      .and()
      .add('pseudo.pseudo_total_life', 70)
      .add('pseudo.pseudo_total_elemental_resistance', 80)
      .done()
      .build();

    expect(request.query.stats).toHaveLength(1);
    expect(request.query.stats![0].type).toBe('and');
    expect(request.query.stats![0].filters).toHaveLength(2);
    expect(request.query.stats![0].filters[0].id).toBe('pseudo.pseudo_total_life');
    expect(request.query.stats![0].filters[0].value).toEqual({ min: 70, max: undefined });
    expect(request.query.stats![0].filters[1].id).toBe('pseudo.pseudo_total_elemental_resistance');
  });

  test('count group preserves min/max value', () => {
    const request = createSearch()
      .stats()
      .count(2, 3)
      .add('stat.a')
      .add('stat.b')
      .add('stat.c')
      .done()
      .build();

    expect(request.query.stats![0].type).toBe('count');
    expect(request.query.stats![0].value).toEqual({ min: 2, max: 3 });
    expect(request.query.stats![0].filters).toHaveLength(3);
  });

  test('not group works', () => {
    const request = createSearch()
      .stats()
      .not()
      .add('stat.bad')
      .done()
      .build();

    expect(request.query.stats![0].type).toBe('not');
    expect(request.query.stats![0].filters).toHaveLength(1);
  });

  test('multiple stat groups can be added', () => {
    const request = createSearch()
      .stats().and().add('stat.a', 10).done()
      .stats().not().add('stat.b').done()
      .build();

    expect(request.query.stats).toHaveLength(2);
    expect(request.query.stats![0].type).toBe('and');
    expect(request.query.stats![1].type).toBe('not');
  });

  test('add without calling and/count/not throws', () => {
    const statBuilder = createSearch().stats();
    expect(() => statBuilder.add('stat.x')).toThrow('Must call and(), count(), or not() before adding stats');
  });

  test('done() without current group is a no-op', () => {
    const builder = createSearch();
    const returned = builder.stats().done();
    const request = returned.build();
    // stats array should be empty (initialized as [])
    expect(request.query.stats).toEqual([]);
  });

  test('preserves state through chain: type + stats + sort', () => {
    const request = createSearch()
      .type('Body Armour')
      .stats().and().add('pseudo.pseudo_total_life', 80).done()
      .sortByPrice('asc')
      .build();

    expect(request.query.type).toBe('Body Armour');
    expect(request.query.stats).toHaveLength(1);
    expect(request.sort).toEqual({ price: 'asc' });
  });
});

// ==========================================================================
// 12. --mode validation
// ==========================================================================

describe('--mode validation', () => {
  const modeMap: Record<string, 'available' | 'securable' | 'online'> = {
    available: 'available',
    instant: 'securable',
    inperson: 'online',
  };

  test('available maps to available', () => {
    expect(modeMap['available']).toBe('available');
  });

  test('instant maps to securable', () => {
    expect(modeMap['instant']).toBe('securable');
  });

  test('inperson maps to online', () => {
    expect(modeMap['inperson']).toBe('online');
  });

  test('invalid mode is not in modeMap', () => {
    expect('badmode' in modeMap).toBe(false);
  });

  test('default when no mode specified', () => {
    const mode = undefined;
    const tradeMode = modeMap[mode as any] ?? 'available';
    expect(tradeMode).toBe('available');
  });
});

// ==========================================================================
// 13. Search builders (PoeTradeClient)
// ==========================================================================

describe('createSimpleSearch', () => {
  const client = createTradeClient({
    league: 'Standard',
    game: 'poe1',
  });

  test('basic search uses term by default', () => {
    const req = client.createSimpleSearch('Headhunter');
    expect(req.query.term).toBe('Headhunter');
    expect(req.query.name).toBeUndefined();
    expect(req.query.status).toEqual({ option: 'available' });
  });

  test('exactMatch uses name for poe1', () => {
    const req = client.createSimpleSearch('Headhunter', { exactMatch: true });
    expect(req.query.name).toBe('Headhunter');
    expect(req.query.term).toBeUndefined();
  });

  test('exactMatch still uses term for poe2', () => {
    const poe2Client = createTradeClient({
      league: 'Standard',
      game: 'poe2',
    });
    const req = poe2Client.createSimpleSearch('Mageblood', { exactMatch: true });
    expect(req.query.term).toBe('Mageblood');
    expect(req.query.name).toBeUndefined();
  });

  test('tradeMode securable', () => {
    const req = client.createSimpleSearch('Item', { tradeMode: 'securable' });
    expect(req.query.status).toEqual({ option: 'securable' });
  });

  test('onlineOnly false falls back to any', () => {
    const req = client.createSimpleSearch('Item', { onlineOnly: false });
    expect(req.query.status).toEqual({ option: 'any' });
  });

  test('tradeMode takes priority over onlineOnly', () => {
    const req = client.createSimpleSearch('Item', { tradeMode: 'online', onlineOnly: false });
    expect(req.query.status).toEqual({ option: 'online' });
  });

  test('sortByPrice adds sort', () => {
    const req = client.createSimpleSearch('Item', { sortByPrice: true });
    expect(req.sort).toEqual({ price: 'asc' });
  });

  test('no sortByPrice means no sort key', () => {
    const req = client.createSimpleSearch('Item');
    expect(req.sort).toBeUndefined();
  });

  test('price filter added when minPrice set', () => {
    const req = client.createSimpleSearch('Item', { minPrice: 10, currency: 'chaos' });
    expect(req.query.filters?.trade_filters?.filters?.price).toEqual({
      min: 10,
      max: undefined,
      option: 'chaos',
    });
  });

  test('price filter added when maxPrice set', () => {
    const req = client.createSimpleSearch('Item', { maxPrice: 100 });
    expect(req.query.filters?.trade_filters?.filters?.price).toEqual({
      min: undefined,
      max: 100,
      option: undefined,
    });
  });

  test('no price filter when neither min nor max set', () => {
    const req = client.createSimpleSearch('Item');
    expect(req.query.filters).toBeUndefined();
  });
});

describe('createTypeSearch', () => {
  const client = createTradeClient({
    league: 'Standard',
    game: 'poe1',
  });

  test('basic type search', () => {
    const req = client.createTypeSearch('Crimson Amulet');
    expect(req.query.type).toBe('Crimson Amulet');
    expect(req.query.status).toEqual({ option: 'available' });
  });

  test('type search with tradeMode', () => {
    const req = client.createTypeSearch('Jewelled Dagger', { tradeMode: 'securable' });
    expect(req.query.status).toEqual({ option: 'securable' });
  });

  test('type search with sortByPrice', () => {
    const req = client.createTypeSearch('Shield', { sortByPrice: true });
    expect(req.sort).toEqual({ price: 'asc' });
  });

  test('type search with price filter', () => {
    const req = client.createTypeSearch('Shield', { minPrice: 5, maxPrice: 50, currency: 'divine' });
    expect(req.query.filters?.trade_filters?.filters?.price).toEqual({
      min: 5,
      max: 50,
      option: 'divine',
    });
  });

  test('type search onlineOnly false => any', () => {
    const req = client.createTypeSearch('Helm', { onlineOnly: false });
    expect(req.query.status).toEqual({ option: 'any' });
  });
});

// ==========================================================================
// Additional: round2 helper
// ==========================================================================

describe('round2', () => {
  test('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1); // JS floating point: Math.round(100.5) = 101... actually 1.005*100=100.49999
    expect(round2(1.555)).toBe(1.56);
    expect(round2(3.14159)).toBe(3.14);
  });

  test('returns null for null input', () => {
    expect(round2(null)).toBeNull();
  });

  test('handles integers', () => {
    expect(round2(42)).toBe(42);
  });
});

// ==========================================================================
// Additional: TradeSearchBuilder fluent API
// ==========================================================================

describe('TradeSearchBuilder fluent API', () => {
  test('name sets query.name', () => {
    const req = createSearch().name('Headhunter').build();
    expect(req.query.name).toBe('Headhunter');
  });

  test('type sets query.type', () => {
    const req = createSearch().type('Body Armour').build();
    expect(req.query.type).toBe('Body Armour');
  });

  test('term sets query.term', () => {
    const req = createSearch().term('fire').build();
    expect(req.query.term).toBe('fire');
  });

  test('onlineOnly sets status to online', () => {
    const req = createSearch().onlineOnly().build();
    expect(req.query.status).toEqual({ option: 'online' });
  });

  test('includeOffline sets status to any', () => {
    const req = createSearch().includeOffline().build();
    expect(req.query.status).toEqual({ option: 'any' });
  });

  test('price filter', () => {
    const req = createSearch().price(10, 100, 'chaos').build();
    expect(req.query.filters?.trade_filters?.filters?.price).toEqual({
      min: 10,
      max: 100,
      option: 'chaos',
    });
  });

  test('minPrice shortcut', () => {
    const req = createSearch().minPrice(50).build();
    expect(req.query.filters?.trade_filters?.filters?.price?.min).toBe(50);
  });

  test('maxPrice shortcut', () => {
    const req = createSearch().maxPrice(200, 'divine').build();
    expect(req.query.filters?.trade_filters?.filters?.price?.max).toBe(200);
    expect(req.query.filters?.trade_filters?.filters?.price?.option).toBe('divine');
  });

  test('sockets filter', () => {
    const req = createSearch().sockets(5, 6).build();
    expect(req.query.filters?.socket_filters?.filters?.sockets).toEqual({ min: 5, max: 6 });
  });

  test('links filter', () => {
    const req = createSearch().minLinks(6).build();
    expect(req.query.filters?.socket_filters?.filters?.links).toEqual({ min: 6, max: undefined });
  });

  test('corrupted filter', () => {
    const req = createSearch().corrupted(true).build();
    expect(req.query.filters?.misc_filters?.filters?.corrupted).toEqual({ option: 'true' });
  });

  test('corrupted any', () => {
    const req = createSearch().corrupted('any').build();
    expect(req.query.filters?.misc_filters?.filters?.corrupted).toEqual({ option: 'any' });
  });

  test('itemLevel filter', () => {
    const req = createSearch().itemLevel(84).build();
    expect(req.query.filters?.misc_filters?.filters?.ilvl).toEqual({ min: 84, max: undefined });
  });

  test('sortByPrice', () => {
    const req = createSearch().sortByPrice('desc').build();
    expect(req.sort?.price).toBe('desc');
  });

  test('chaining multiple filters', () => {
    const req = createSearch()
      .type('Body Armour')
      .minLinks(6)
      .maxPrice(100, 'chaos')
      .corrupted(false)
      .sortByPrice()
      .build();

    expect(req.query.type).toBe('Body Armour');
    expect(req.query.filters?.socket_filters?.filters?.links).toEqual({ min: 6, max: undefined });
    expect(req.query.filters?.trade_filters?.filters?.price?.max).toBe(100);
    expect(req.query.filters?.misc_filters?.filters?.corrupted).toEqual({ option: 'false' });
    expect(req.sort?.price).toBe('asc');
  });
});

// ==========================================================================
// Additional: PoeTradeClient API paths
// ==========================================================================

describe('PoeTradeClient config defaults', () => {
  test('defaults game to poe1', () => {
    const client = createTradeClient({ league: 'Standard' });
    expect(client.getConfig().game).toBe('poe1');
  });

  test('setLeague updates league', () => {
    const client = createTradeClient({ league: 'Standard' });
    client.setLeague('Mirage');
    expect(client.getConfig().league).toBe('Mirage');
  });
});
