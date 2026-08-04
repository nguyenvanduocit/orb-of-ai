/**
 * POE Trade Filter Builder
 *
 * Fluent API for building complex trade search queries with Fuse.js search
 *
 * @example Search for stats
 * ```ts
 * import { searchStats } from './poe-trade-filters';
 *
 * // Search for resistance stats
 * const stats = await searchStats('fire resistance', 5);
 * console.log(stats);
 * ```
 *
 * @example Build a trade search with stat search
 * ```ts
 * import { createSearch } from './poe-trade-filters';
 *
 * const search = createSearch()
 *   .type('Body Armour')
 *   .minLinks(6)
 *   .maxPrice(100, 'chaos');
 *
 * // Use search() to find stats by text
 * await search.stats().and()
 *   .search('life', 80)
 *   .search('fire resistance', 30)
 *   .done();
 *
 * const request = search.build();
 * ```
 *
 * @example Direct stat ID usage (no search needed)
 * ```ts
 * import { createSearch } from './poe-trade-filters';
 *
 * const search = createSearch()
 *   .type('Helmet')
 *   .stats().and()
 *     .add('pseudo.pseudo_total_life', 70)
 *     .add('pseudo.pseudo_total_elemental_resistance', 80)
 *     .done();
 * ```
 */

import type { SearchRequest, SearchQuery, StatCategory as APIStatCategory } from './client';
import Fuse from 'fuse.js';

// Type declarations for Bun globals
declare const Bun: {
  file(path: string): { text(): Promise<string>; exists(): Promise<boolean> };
  write(path: string, content: string): Promise<void>;
  env: Record<string, string | undefined>;
  argv: string[];
};

// Stat catalog comes from the datamined trade-static dataset (refreshed by the
// update-static-data skill). ggg/ -> poe-trade -> skills -> .claude -> root.
const STATS_FILE = `${(import.meta as any).dir}/../../../../data/trade-static/stats.json`;

export interface StatEntry {
  id: string;
  text: string;
  type?: string;
}

export interface StatCategory {
  id?: string;
  label: string;
  entries: StatEntry[];
}

let statsCache: StatCategory[] | null = null;
let fuseInstance: Fuse<StatEntry> | null = null;

// ==========================================================================
// Stats Data Loading & Caching
// ==========================================================================

async function loadStats(): Promise<StatCategory[]> {
  if (statsCache) {
    return statsCache;
  }

  // Load from the datamined trade-static dataset (stats.json = { result: StatCategory[] }).
  try {
    const content = await Bun.file(STATS_FILE).text();
    const data = JSON.parse(content);
    statsCache = data.result as StatCategory[];
    return statsCache;
  } catch {
    const msg = `${STATS_FILE} not found. Refresh it with:\n  bun .claude/skills/update-static-data/scripts/update-static-data.ts`;
    console.error(msg);
    throw new Error(msg);
  }
}

async function getFuseInstance(): Promise<Fuse<StatEntry>> {
  if (fuseInstance) {
    return fuseInstance;
  }

  const categories = await loadStats();
  const allStats: StatEntry[] = categories.flatMap((cat) => cat.entries);

  fuseInstance = new Fuse(allStats, {
    keys: ['text', 'id', 'type'],
    threshold: 0.3,
    includeScore: true,
  });

  return fuseInstance;
}

// ==========================================================================
// Stat Search Functions
// ==========================================================================

export async function searchStats(query: string, limit = 10): Promise<StatEntry[]> {
  const fuse = await getFuseInstance();
  const results = fuse.search(query, { limit });
  return results.map((result) => result.item);
}

export async function findStatById(id: string): Promise<StatEntry | undefined> {
  const categories = await loadStats();
  for (const category of categories) {
    const stat = category.entries.find((entry) => entry.id === id);
    if (stat) return stat;
  }
  return undefined;
}

export async function findStatByText(text: string): Promise<StatEntry | undefined> {
  const categories = await loadStats();
  const normalized = text.toLowerCase();
  for (const category of categories) {
    const stat = category.entries.find((entry) => entry.text.toLowerCase() === normalized);
    if (stat) return stat;
  }
  return undefined;
}

export async function getStatsByCategory(categoryId: string): Promise<StatEntry[]> {
  const categories = await loadStats();
  const category = categories.find((cat) => cat.id === categoryId);
  return category?.entries || [];
}

export async function getAllCategories(): Promise<StatCategory[]> {
  return loadStats();
}

// ==========================================================================
// Trade Search Builder
// ==========================================================================

export class TradeSearchBuilder {
  private searchRequest: SearchRequest = {
    query: {
      stats: [],
    },
  };

  // ==========================================================================
  // Basic Item Filters
  // ==========================================================================

  name(name: string): this {
    this.searchRequest.query.name = name;
    return this;
  }

  type(type: string): this {
    this.searchRequest.query.type = type;
    return this;
  }

  term(term: string): this {
    this.searchRequest.query.term = term;
    return this;
  }

  // ==========================================================================
  // Status Filters
  // ==========================================================================

  onlineOnly(): this {
    this.searchRequest.query.status = { option: 'online' };
    return this;
  }

  includeOffline(): this {
    this.searchRequest.query.status = { option: 'any' };
    return this;
  }

  // ==========================================================================
  // Price Filters
  // ==========================================================================

  price(min?: number, max?: number, currency?: string): this {
    this.ensureTradeFilters();
    this.searchRequest.query.filters!.trade_filters!.filters = {
      ...this.searchRequest.query.filters!.trade_filters!.filters,
      price: {
        min,
        max,
        option: currency,
      },
    };
    return this;
  }

  minPrice(amount: number, currency?: string): this {
    return this.price(amount, undefined, currency);
  }

  maxPrice(amount: number, currency?: string): this {
    return this.price(undefined, amount, currency);
  }

  priceRange(min: number, max: number, currency?: string): this {
    return this.price(min, max, currency);
  }

  // ==========================================================================
  // Socket/Link Filters
  // ==========================================================================

  sockets(min?: number, max?: number): this {
    this.ensureSocketFilters();
    this.searchRequest.query.filters!.socket_filters!.filters = {
      ...this.searchRequest.query.filters!.socket_filters!.filters,
      sockets: { min, max },
    };
    return this;
  }

  links(min?: number, max?: number): this {
    this.ensureSocketFilters();
    this.searchRequest.query.filters!.socket_filters!.filters = {
      ...this.searchRequest.query.filters!.socket_filters!.filters,
      links: { min, max },
    };
    return this;
  }

  minLinks(count: number): this {
    return this.links(count);
  }

  socketColors(r?: number, g?: number, b?: number, w?: number): this {
    this.ensureSocketFilters();
    this.searchRequest.query.filters!.socket_filters!.filters = {
      ...this.searchRequest.query.filters!.socket_filters!.filters,
      sockets: {
        ...this.searchRequest.query.filters!.socket_filters!.filters?.sockets,
        r,
        g,
        b,
        w,
      },
    };
    return this;
  }

  // ==========================================================================
  // Requirement Filters
  // ==========================================================================

  levelRequirement(min?: number, max?: number): this {
    this.ensureReqFilters();
    this.searchRequest.query.filters!.req_filters!.filters = {
      ...this.searchRequest.query.filters!.req_filters!.filters,
      lvl: { min, max },
    };
    return this;
  }

  dexRequirement(min?: number, max?: number): this {
    this.ensureReqFilters();
    this.searchRequest.query.filters!.req_filters!.filters = {
      ...this.searchRequest.query.filters!.req_filters!.filters,
      dex: { min, max },
    };
    return this;
  }

  strRequirement(min?: number, max?: number): this {
    this.ensureReqFilters();
    this.searchRequest.query.filters!.req_filters!.filters = {
      ...this.searchRequest.query.filters!.req_filters!.filters,
      str: { min, max },
    };
    return this;
  }

  intRequirement(min?: number, max?: number): this {
    this.ensureReqFilters();
    this.searchRequest.query.filters!.req_filters!.filters = {
      ...this.searchRequest.query.filters!.req_filters!.filters,
      int: { min, max },
    };
    return this;
  }

  // ==========================================================================
  // Armour Filters
  // ==========================================================================

  armour(min?: number, max?: number): this {
    this.ensureArmourFilters();
    this.searchRequest.query.filters!.armour_filters!.filters = {
      ...this.searchRequest.query.filters!.armour_filters!.filters,
      ar: { min, max },
    };
    return this;
  }

  evasion(min?: number, max?: number): this {
    this.ensureArmourFilters();
    this.searchRequest.query.filters!.armour_filters!.filters = {
      ...this.searchRequest.query.filters!.armour_filters!.filters,
      ev: { min, max },
    };
    return this;
  }

  energyShield(min?: number, max?: number): this {
    this.ensureArmourFilters();
    this.searchRequest.query.filters!.armour_filters!.filters = {
      ...this.searchRequest.query.filters!.armour_filters!.filters,
      es: { min, max },
    };
    return this;
  }

  ward(min?: number, max?: number): this {
    this.ensureArmourFilters();
    this.searchRequest.query.filters!.armour_filters!.filters = {
      ...this.searchRequest.query.filters!.armour_filters!.filters,
      ward: { min, max },
    };
    return this;
  }

  block(min?: number, max?: number): this {
    this.ensureArmourFilters();
    this.searchRequest.query.filters!.armour_filters!.filters = {
      ...this.searchRequest.query.filters!.armour_filters!.filters,
      block: { min, max },
    };
    return this;
  }

  // ==========================================================================
  // Weapon Filters
  // ==========================================================================

  damage(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      damage: { min, max },
    };
    return this;
  }

  aps(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      aps: { min, max },
    };
    return this;
  }

  critChance(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      crit: { min, max },
    };
    return this;
  }

  dps(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      dps: { min, max },
    };
    return this;
  }

  pdps(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      pdps: { min, max },
    };
    return this;
  }

  edps(min?: number, max?: number): this {
    this.ensureWeaponFilters();
    this.searchRequest.query.filters!.weapon_filters!.filters = {
      ...this.searchRequest.query.filters!.weapon_filters!.filters,
      edps: { min, max },
    };
    return this;
  }

  // ==========================================================================
  // Map Filters
  // ==========================================================================

  mapTier(min?: number, max?: number): this {
    this.ensureMapFilters();
    this.searchRequest.query.filters!.map_filters!.filters = {
      ...this.searchRequest.query.filters!.map_filters!.filters,
      map_tier: { min, max },
    };
    return this;
  }

  mapIiq(min?: number, max?: number): this {
    this.ensureMapFilters();
    this.searchRequest.query.filters!.map_filters!.filters = {
      ...this.searchRequest.query.filters!.map_filters!.filters,
      map_iiq: { min, max },
    };
    return this;
  }

  mapPackSize(min?: number, max?: number): this {
    this.ensureMapFilters();
    this.searchRequest.query.filters!.map_filters!.filters = {
      ...this.searchRequest.query.filters!.map_filters!.filters,
      map_packsize: { min, max },
    };
    return this;
  }

  // ==========================================================================
  // Misc Filters
  // ==========================================================================

  quality(min?: number, max?: number): this {
    this.ensureMiscFilters();
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      quality: { min, max },
    };
    return this;
  }

  itemLevel(min?: number, max?: number): this {
    this.ensureMiscFilters();
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      ilvl: { min, max },
    };
    return this;
  }

  gemLevel(min?: number, max?: number): this {
    this.ensureMiscFilters();
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      gem_level: { min, max },
    };
    return this;
  }

  corrupted(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      corrupted: { option },
    };
    return this;
  }

  identified(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      identified: { option },
    };
    return this;
  }

  crafted(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      crafted: { option },
    };
    return this;
  }

  enchanted(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      enchanted: { option },
    };
    return this;
  }

  mirrored(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      mirrored: { option },
    };
    return this;
  }

  influenceShaper(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      shaper_item: { option },
    };
    return this;
  }

  influenceElder(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      elder_item: { option },
    };
    return this;
  }

  influenceCrusader(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      crusader_item: { option },
    };
    return this;
  }

  influenceRedeemer(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      redeemer_item: { option },
    };
    return this;
  }

  influenceHunter(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      hunter_item: { option },
    };
    return this;
  }

  influenceWarlord(value: boolean | 'any' = true): this {
    this.ensureMiscFilters();
    const option = value === 'any' ? 'any' : value ? 'true' : 'false';
    this.searchRequest.query.filters!.misc_filters!.filters = {
      ...this.searchRequest.query.filters!.misc_filters!.filters,
      warlord_item: { option },
    };
    return this;
  }

  // ==========================================================================
  // Stat Filters
  // ==========================================================================

  /**
   * Add a stat filter
   * Use stats().and() or stats().count() to start a stat group
   */
  stats(): StatFilterBuilder {
    return new StatFilterBuilder(this.searchRequest, this);
  }

  /**
   * Add a raw stat filter (advanced usage)
   */
  addStatFilter(filter: NonNullable<SearchQuery['stats']>[0]): this {
    if (!this.searchRequest.query.stats) {
      this.searchRequest.query.stats = [];
    }
    this.searchRequest.query.stats.push(filter);
    return this;
  }

  // ==========================================================================
  // Sorting
  // ==========================================================================

  sortByPrice(order: 'asc' | 'desc' = 'asc'): this {
    if (!this.searchRequest.sort) {
      this.searchRequest.sort = {};
    }
    this.searchRequest.sort.price = order;
    return this;
  }

  sortBy(field: string, order: 'asc' | 'desc' = 'asc'): this {
    if (!this.searchRequest.sort) {
      this.searchRequest.sort = {};
    }
    this.searchRequest.sort[field] = order;
    return this;
  }

  // ==========================================================================
  // Build
  // ==========================================================================

  build(): SearchRequest {
    return this.searchRequest;
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  private ensureTradeFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.trade_filters) {
      this.searchRequest.query.filters.trade_filters = {
        filters: {},
      };
    }
  }

  private ensureSocketFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.socket_filters) {
      this.searchRequest.query.filters.socket_filters = {
        filters: {},
      };
    }
  }

  private ensureReqFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.req_filters) {
      this.searchRequest.query.filters.req_filters = {
        filters: {},
      };
    }
  }

  private ensureArmourFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.armour_filters) {
      this.searchRequest.query.filters.armour_filters = {
        filters: {},
      };
    }
  }

  private ensureWeaponFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.weapon_filters) {
      this.searchRequest.query.filters.weapon_filters = {
        filters: {},
      };
    }
  }

  private ensureMapFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.map_filters) {
      this.searchRequest.query.filters.map_filters = {
        filters: {},
      };
    }
  }

  private ensureMiscFilters(): void {
    if (!this.searchRequest.query.filters) {
      this.searchRequest.query.filters = {};
    }
    if (!this.searchRequest.query.filters.misc_filters) {
      this.searchRequest.query.filters.misc_filters = {
        filters: {},
      };
    }
  }
}

// ============================================================================
// Stat Filter Builder
// ============================================================================

export class StatFilterBuilder {
  private parentBuilder: TradeSearchBuilder;
  private searchRequest: SearchRequest;
  private currentGroup?: NonNullable<SearchQuery['stats']>[0];

  constructor(searchRequest: SearchRequest, parentBuilder: TradeSearchBuilder) {
    this.searchRequest = searchRequest;
    this.parentBuilder = parentBuilder;
  }

  /**
   * Start an AND stat group (all stats must match)
   */
  and(): this {
    this.currentGroup = {
      type: 'and',
      filters: [],
    };
    return this;
  }

  /**
   * Start a COUNT stat group (minimum number of stats must match)
   */
  count(min: number, max?: number): this {
    this.currentGroup = {
      type: 'count',
      filters: [],
      value: { min, max },
    };
    return this;
  }

  /**
   * Start a NOT stat group (none of the stats should match)
   */
  not(): this {
    this.currentGroup = {
      type: 'not',
      filters: [],
    };
    return this;
  }

  /**
   * Add a stat to the current group
   */
  add(statId: string, min?: number, max?: number): this {
    if (!this.currentGroup) {
      throw new Error('Must call and(), count(), or not() before adding stats');
    }

    this.currentGroup.filters.push({
      id: statId,
      value: min !== undefined || max !== undefined ? { min, max } : undefined,
    });

    return this;
  }

  /**
   * Search and add a stat by text query
   * Uses Fuse.js to find the best matching stat
   */
  async search(query: string, min?: number, max?: number): Promise<this> {
    const results = await searchStats(query, 1);
    if (results.length === 0) {
      throw new Error(`No stat found matching: "${query}"`);
    }
    return this.add(results[0].id, min, max);
  }

  /**
   * Finish the current stat group and return to the main builder
   */
  done(): TradeSearchBuilder {
    if (this.currentGroup) {
      if (!this.searchRequest.query.stats) {
        this.searchRequest.query.stats = [];
      }
      this.searchRequest.query.stats.push(this.currentGroup);
      this.currentGroup = undefined;
    }
    return this.parentBuilder;
  }
}

// ============================================================================
// Convenience Factory
// ============================================================================

export function createSearch(): TradeSearchBuilder {
  return new TradeSearchBuilder();
}

// ============================================================================
// CLI Interface
// ============================================================================

if ((import.meta as any).main) {
  const args = Bun.argv.slice(2);
  const command = args[0];

  async function runCLI() {
    if (!command || command === 'help') {
      console.log(`
POE Trade Filters - Stat Search

Usage:
  bun .claude/skills/poe-trade/ggg/filters.ts search <query> [limit]    Search for stats by text
  bun .claude/skills/poe-trade/ggg/filters.ts id <stat-id>              Get stat by ID
  bun .claude/skills/poe-trade/ggg/filters.ts categories                List all categories
  bun .claude/skills/poe-trade/ggg/filters.ts category <id>             List stats in category

Examples:
  bun .claude/skills/poe-trade/ggg/filters.ts search "fire resistance" 10
  bun .claude/skills/poe-trade/ggg/filters.ts id pseudo.pseudo_total_life
  bun .claude/skills/poe-trade/ggg/filters.ts categories

Note:
  Stats are loaded from ${STATS_FILE}
  To refresh: bun .claude/skills/update-static-data/scripts/update-static-data.ts
      `);
      return;
    }

    if (command === 'search') {
      const query = args[1];
      const limit = parseInt(args[2] || '10');

      if (!query) {
        console.error('Error: Please provide a search query');
        return;
      }

      console.log(`Searching for: "${query}"\n`);
      const results = await searchStats(query, limit);

      if (results.length === 0) {
        console.log('No results found');
        return;
      }

      console.log(`Found ${results.length} result(s):\n`);
      for (const stat of results) {
        console.log(`ID:   ${stat.id}`);
        console.log(`Text: ${stat.text}`);
        if (stat.type) console.log(`Type: ${stat.type}`);
        console.log('');
      }
    } else if (command === 'id') {
      const id = args[1];

      if (!id) {
        console.error('Error: Please provide a stat ID');
        return;
      }

      const stat = await findStatById(id);

      if (!stat) {
        console.log(`Stat not found: ${id}`);
        return;
      }

      console.log(`ID:   ${stat.id}`);
      console.log(`Text: ${stat.text}`);
      if (stat.type) console.log(`Type: ${stat.type}`);
    } else if (command === 'categories') {
      const categories = await getAllCategories();

      console.log(`Total categories: ${categories.length}\n`);
      for (const cat of categories) {
        console.log(`${cat.id || 'unknown'}: ${cat.label} (${cat.entries.length} stats)`);
      }
    } else if (command === 'category') {
      const categoryId = args[1];

      if (!categoryId) {
        console.error('Error: Please provide a category ID');
        return;
      }

      const stats = await getStatsByCategory(categoryId);

      if (stats.length === 0) {
        console.log(`Category not found: ${categoryId}`);
        return;
      }

      console.log(`Stats in category "${categoryId}":\n`);
      for (const stat of stats) {
        console.log(`${stat.id}`);
        console.log(`  ${stat.text}`);
      }
      console.log(`\nTotal: ${stats.length} stats`);
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Run "bun .claude/skills/poe-trade/ggg/filters.ts help" for usage');
    }
  }

  runCLI().catch((error) => {
    console.error('Error:', error.message);
    (globalThis as any).process?.exit(1);
  });
}
