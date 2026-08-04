/**
 * Path of Exile Trade API Client
 *
 * Provides comprehensive access to the official POE trade API:
 * - Item search with extensive filters
 * - Result fetching with whisper messages
 * - Rate limiting and request management
 * - League, item, and stat data retrieval
 */

import { poeFetch } from './transport';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TradeConfig {
  league: string;
  game?: 'poe1' | 'poe2';
}

export interface SearchQuery {
  // Item identification
  name?: string;
  type?: string | { option: string; discriminator?: string };
  term?: string; // General search term

  // Status filters
  status?: {
    option: 'online' | 'any' | 'securable' | 'available'; // 'online' = in-person only, 'securable' = instant only, 'available' = both, 'any' = all including offline
  };

  // Stats filters
  stats?: Array<{
    type: 'and' | 'if' | 'count' | 'not' | 'weight';
    filters: Array<{
      id: string;
      value?: {
        min?: number;
        max?: number;
        option?: string | number;
      };
      disabled?: boolean;
    }>;
    disabled?: boolean;
    value?: {
      min?: number;
      max?: number;
    };
  }>;

  // Trade filters
  filters?: {
    trade_filters?: {
      disabled?: boolean;
      filters?: {
        price?: {
          min?: number;
          max?: number;
          option?: string; // currency type
        };
        sale_type?: {
          option?: 'priced' | 'unpriced';
        };
        account?: {
          input?: string;
        };
        collapse?: boolean;
      };
    };
    socket_filters?: {
      disabled?: boolean;
      filters?: {
        sockets?: {
          min?: number;
          max?: number;
          r?: number; // red
          g?: number; // green
          b?: number; // blue
          w?: number; // white
        };
        links?: {
          min?: number;
          max?: number;
          r?: number;
          g?: number;
          b?: number;
          w?: number;
        };
      };
    };
    req_filters?: {
      disabled?: boolean;
      filters?: {
        lvl?: {
          min?: number;
          max?: number;
        };
        dex?: {
          min?: number;
          max?: number;
        };
        str?: {
          min?: number;
          max?: number;
        };
        int?: {
          min?: number;
          max?: number;
        };
      };
    };
    armour_filters?: {
      disabled?: boolean;
      filters?: {
        ar?: { min?: number; max?: number };
        es?: { min?: number; max?: number };
        ev?: { min?: number; max?: number };
        ward?: { min?: number; max?: number };
        block?: { min?: number; max?: number };
      };
    };
    weapon_filters?: {
      disabled?: boolean;
      filters?: {
        damage?: { min?: number; max?: number };
        aps?: { min?: number; max?: number };
        crit?: { min?: number; max?: number };
        dps?: { min?: number; max?: number };
        edps?: { min?: number; max?: number };
        pdps?: { min?: number; max?: number };
      };
    };
    map_filters?: {
      disabled?: boolean;
      filters?: {
        map_tier?: { min?: number; max?: number };
        map_iiq?: { min?: number; max?: number };
        map_iir?: { min?: number; max?: number };
        map_packsize?: { min?: number; max?: number };
      };
    };
    misc_filters?: {
      disabled?: boolean;
      filters?: {
        quality?: { min?: number; max?: number };
        ilvl?: { min?: number; max?: number };
        gem_level?: { min?: number; max?: number };
        corrupted?: { option?: 'true' | 'false' | 'any' };
        identified?: { option?: 'true' | 'false' | 'any' };
        crafted?: { option?: 'true' | 'false' | 'any' };
        enchanted?: { option?: 'true' | 'false' | 'any' };
        mirrored?: { option?: 'true' | 'false' | 'any' };
        shaper_item?: { option?: 'true' | 'false' | 'any' };
        elder_item?: { option?: 'true' | 'false' | 'any' };
        crusader_item?: { option?: 'true' | 'false' | 'any' };
        redeemer_item?: { option?: 'true' | 'false' | 'any' };
        hunter_item?: { option?: 'true' | 'false' | 'any' };
        warlord_item?: { option?: 'true' | 'false' | 'any' };
      };
    };
  };
}

export interface SearchRequest {
  query: SearchQuery;
  sort?: {
    price?: 'asc' | 'desc';
    [key: string]: 'asc' | 'desc' | undefined;
  };
}

export interface SearchResult {
  id: string; // Search session ID
  result: string[]; // Array of item IDs
  total: number;
  complexity?: number;
}

export interface FetchedItem {
  id: string;
  listing: {
    indexed: string;
    method?: string; // e.g., "psapi"
    fee?: number; // Fee for instant trade
    account: {
      name: string;
      online?: {
        league?: string;
        status?: string;
      } | null;
      lastCharacterName?: string;
      language?: string;
    };
    price?: {
      type: string;
      amount: number;
      currency: string;
    };
    stash?: {
      name: string;
      x: number;
      y: number;
    };
    whisper?: string; // Pre-formatted whisper text (copy-paste into game)
    whisper_token?: string; // Online (in-person) trades — transport is read-only; whisper manually via the trade URL
    hideout_token?: string; // Securable (instant buy) trades — transport is read-only; whisper manually via the trade URL
  };
  item: {
    verified: boolean;
    w: number;
    h: number;
    icon: string;
    league: string;
    name: string;
    typeLine: string;
    baseType?: string;
    identified: boolean;
    ilvl?: number;
    properties?: Array<{
      name: string;
      values: Array<[string, number]>;
      displayMode?: number;
      type?: number;
    }>;
    requirements?: Array<{
      name: string;
      values: Array<[string, number]>;
      displayMode?: number;
    }>;
    implicitMods?: string[];
    explicitMods?: string[];
    craftedMods?: string[];
    enchantMods?: string[];
    fracturedMods?: string[];
    corrupted?: boolean;
    cosmetic?: string[];
    sockets?: Array<{
      group: number;
      attr: string;
      sColour: string;
    }>;
    extended?: {
      category?: string;
      subcategories?: string[];
      prefixes?: number;
      suffixes?: number;
      mods?: {
        explicit?: Array<{
          name: string;
          tier: string;
          level: number;
          magnitudes?: Array<{
            hash: string;
            min: number;
            max: number;
          }>;
        }>;
        implicit?: Array<any>;
        crafted?: Array<any>;
        fractured?: Array<any>;
        enchant?: Array<any>;
      };
      hashes?: {
        explicit?: Array<[string, number[]]>;
        implicit?: Array<[string, number[]]>;
        crafted?: Array<[string, number[]]>;
      };
      text?: string;
    };
  };
}

export interface FetchResult {
  result: FetchedItem[];
}

export interface League {
  id: string;
  realm?: string;
  text: string;
}

export interface ItemCategory {
  id: string;
  label: string;
  entries?: Array<{
    name?: string;
    type?: string;
    text: string;
    flags?: {
      unique?: boolean;
    };
  }>;
}

export interface StatEntry {
  id: string;
  text: string;
  type?: string;
  option?: {
    options?: Array<{
      id: number;
      text: string;
    }>;
  };
}

export interface StatCategory {
  label: string;
  entries: StatEntry[];
}

// ============================================================================
// Trade Client Class
// ============================================================================

interface InternalTradeConfig {
  league: string;
  game: 'poe1' | 'poe2';
}

export class PoeTradeClient {
  private config: InternalTradeConfig;

  constructor(config: TradeConfig) {
    this.config = {
      league: config.league,
      game: config.game || 'poe1',
    };
  }

  /**
   * Get API path prefix based on game version
   * POE1: /api/trade
   * POE2: /api/trade2
   */
  private get apiPath(): string {
    return this.config.game === 'poe2' ? '/api/trade2' : '/api/trade';
  }

  /**
   * Get league path for search/fetch endpoints
   * POE1: /{league}
   * POE2: /poe2/{league}
   */
  private get leaguePath(): string {
    return this.config.game === 'poe2'
      ? `/poe2/${encodeURIComponent(this.config.league)}`
      : `/${encodeURIComponent(this.config.league)}`;
  }

  /**
   * Forward a request to the GGG API via a page-context fetch in the logged-in
   * www.pathofexile.com tab (driven through playwriter). The transport is the
   * single funnel enforcing rate-limiting (≥2s spacing + header backoff), so
   * there is no local delay, cookie, or header handling here — the browser
   * supplies all of that.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any
  ): Promise<T> {
    const wrapped = await poeFetch<T>(this.config.game, method, endpoint, body);
    if (wrapped.status >= 400) {
      const detail = typeof wrapped.data === 'string' ? wrapped.data : JSON.stringify(wrapped.data);
      throw new Error(`POE API ${wrapped.status} for ${endpoint}\n${detail}`);
    }
    return wrapped.data;
  }

  // ==========================================================================
  // Data API Methods
  // ==========================================================================

  /** POE2 data endpoints require the realm query param; POE1 does not. */
  private get dataRealm(): string {
    return this.config.game === 'poe2' ? '?realm=poe2' : '';
  }

  /**
   * Get available leagues
   */
  async getLeagues(): Promise<{ result: League[] }> {
    return this.request<{ result: League[] }>('GET', `${this.apiPath}/data/leagues${this.dataRealm}`);
  }

  /**
   * Get item categories and types
   */
  async getItems(): Promise<{ result: ItemCategory[] }> {
    return this.request<{ result: ItemCategory[] }>('GET', `${this.apiPath}/data/items${this.dataRealm}`);
  }

  /**
   * Get available stat filters
   */
  async getStats(): Promise<{ result: StatCategory[] }> {
    return this.request<{ result: StatCategory[] }>('GET', `${this.apiPath}/data/stats${this.dataRealm}`);
  }

  /**
   * Get static trade data (currencies, etc.)
   */
  async getStatic(): Promise<any> {
    return this.request('GET', `${this.apiPath}/data/static${this.dataRealm}`);
  }

  // ==========================================================================
  // Search API Methods
  // ==========================================================================

  /**
   * Search for items with filters
   */
  async search(searchRequest: SearchRequest): Promise<SearchResult> {
    const endpoint = `${this.apiPath}/search${this.leaguePath}`;
    return this.request<SearchResult>('POST', endpoint, searchRequest);
  }

  /**
   * Fetch detailed results for item IDs
   * @param itemIds Array of item IDs from search results (max 10 at a time)
   * @param queryId Search session ID from search results
   */
  async fetch(itemIds: string[], queryId?: string): Promise<FetchResult> {
    // POE API allows max 10 items per fetch request
    const ids = itemIds.slice(0, 10).join(',');
    let endpoint = `${this.apiPath}/fetch/${ids}`;

    if (queryId) {
      endpoint += `?query=${queryId}`;
      // POE2 needs realm parameter
      if (this.config.game === 'poe2') {
        endpoint += '&realm=poe2';
      }
    } else if (this.config.game === 'poe2') {
      endpoint += '?realm=poe2';
    }

    return this.request<FetchResult>('GET', endpoint);
  }

  /**
   * Execute a complete search and fetch cycle
   * @param searchRequest Search parameters
   * @param maxResults Maximum number of results to fetch (default: 10, max: 100)
   */
  async searchAndFetch(
    searchRequest: SearchRequest,
    maxResults: number = 10
  ): Promise<{
    searchResult: SearchResult;
    items: FetchedItem[];
  }> {
    // Execute search
    const searchResult = await this.search(searchRequest);

    if (searchResult.result.length === 0) {
      return {
        searchResult,
        items: [],
      };
    }

    // Fetch results in batches of 10
    const items: FetchedItem[] = [];
    const fetchLimit = Math.min(maxResults, searchResult.result.length, 100);

    for (let i = 0; i < fetchLimit; i += 10) {
      const batch = searchResult.result.slice(i, i + 10);
      const fetchResult = await this.fetch(batch, searchResult.id);
      items.push(...fetchResult.result);
    }

    return {
      searchResult,
      items,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Extract whisper messages from fetched items
   */
  extractWhispers(items: FetchedItem[]): Array<{
    whisper?: string;
    itemName: string;
    price?: string;
    seller: string;
  }> {
    return items.map(item => ({
      whisper: item.listing.whisper,
      itemName: item.item.name || item.item.typeLine,
      price: item.listing.price
        ? `${item.listing.price.amount} ${item.listing.price.currency}`
        : undefined,
      seller: item.listing.account.name,
    }));
  }

  /**
   * Create a simple search for an item by name/term
   * POE2 uses 'term' for searching, POE1 can use both 'name' (exact) or 'term' (fuzzy)
   */
  createSimpleSearch(
    itemName: string,
    options?: {
      onlineOnly?: boolean;
      tradeMode?: 'available' | 'securable' | 'online'; // 'available' = both, 'securable' = instant only, 'online' = in-person only
      minPrice?: number;
      maxPrice?: number;
      currency?: string;
      sortByPrice?: boolean;
      exactMatch?: boolean; // Use 'name' instead of 'term' for exact matching
    }
  ): SearchRequest {
    // tradeMode takes priority; fall back to onlineOnly for backwards compat
    const statusOption = options?.tradeMode
      ?? (options?.onlineOnly === false ? 'any' : 'available');
    const searchRequest: SearchRequest = {
      query: {
        // Use 'term' for fuzzy search (works for both POE1 and POE2)
        // Use 'name' only for exact matching in POE1
        ...(options?.exactMatch && this.config.game === 'poe1'
          ? { name: itemName }
          : { term: itemName }),
        status: {
          option: statusOption,
        },
      },
    };

    // Add price filter
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      searchRequest.query.filters = {
        trade_filters: {
          filters: {
            price: {
              min: options?.minPrice,
              max: options?.maxPrice,
              option: options?.currency,
            },
          },
        },
      };
    }

    // Add sorting
    if (options?.sortByPrice) {
      searchRequest.sort = { price: 'asc' };
    }

    return searchRequest;
  }

  /**
   * Create a search by base type
   * Use this when searching for items by their base type (e.g., "Spirits Shield", "Jewelled Dagger")
   */
  createTypeSearch(
    baseType: string,
    options?: {
      onlineOnly?: boolean;
      tradeMode?: 'available' | 'securable' | 'online'; // 'available' = both, 'securable' = instant only, 'online' = in-person only
      minPrice?: number;
      maxPrice?: number;
      currency?: string;
      sortByPrice?: boolean;
    }
  ): SearchRequest {
    // tradeMode takes priority; fall back to onlineOnly for backwards compat
    const statusOption = options?.tradeMode
      ?? (options?.onlineOnly === false ? 'any' : 'available');
    const searchRequest: SearchRequest = {
      query: {
        type: baseType,
        status: {
          option: statusOption,
        },
      },
    };

    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      searchRequest.query.filters = {
        trade_filters: {
          filters: {
            price: {
              min: options?.minPrice,
              max: options?.maxPrice,
              option: options?.currency,
            },
          },
        },
      };
    }

    if (options?.sortByPrice) {
      searchRequest.sort = { price: 'asc' };
    }

    return searchRequest;
  }

  /**
   * Update the league
   */
  setLeague(league: string): void {
    this.config.league = league;
  }

  /**
   * Get current configuration
   */
  getConfig(): InternalTradeConfig {
    return { ...this.config };
  }

  /**
   * Create a map search query
   * Maps use a special discriminator in the type filter
   */
  createMapSearch(
    mapNames: string | string[],
    options?: {
      onlineOnly?: boolean;
      instantTrade?: boolean; // Only show instant-buyable listings
      tier?: number;
      minPrice?: number;
      maxPrice?: number;
      currency?: string;
      sortByPrice?: boolean;
    }
  ): SearchRequest {
    const maps = Array.isArray(mapNames) ? mapNames : [mapNames];

    let statusOption: 'online' | 'any' | 'securable' = 'online';
    if (options?.instantTrade) {
      statusOption = 'securable';
    } else if (options?.onlineOnly === false) {
      statusOption = 'any';
    }

    // For maps, we need to use the type filter with discriminator
    // Format: "MapName Map" (e.g., "Pit Map", "Beach Map")
    const mapType = maps.length === 1
      ? (maps[0].endsWith(' Map') ? maps[0] : `${maps[0]} Map`)
      : undefined;

    const searchRequest: SearchRequest = {
      query: {
        status: {
          option: statusOption,
        },
        // Use type with discriminator for maps (War for the Atlas)
        type: mapType
          ? {
              option: mapType,
              discriminator: 'warfortheatlas',
            } as any
          : undefined,
        term: maps.length > 1 ? maps.join(' ') : undefined,
        filters: {},
      },
    };

    // Add map-specific discriminator (for War for the Atlas maps)
    if (!searchRequest.query.filters) {
      searchRequest.query.filters = {};
    }

    // Add map tier filter
    if (options?.tier !== undefined) {
      if (!searchRequest.query.filters.map_filters) {
        searchRequest.query.filters.map_filters = {
          disabled: false,
          filters: {},
        };
      }
      searchRequest.query.filters.map_filters.filters!.map_tier = {
        min: options.tier,
        max: options.tier,
      };
    }

    // Add price filter
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      if (!searchRequest.query.filters.trade_filters) {
        searchRequest.query.filters.trade_filters = {
          disabled: false,
          filters: {},
        };
      }
      searchRequest.query.filters.trade_filters.filters!.price = {
        min: options?.minPrice,
        max: options?.maxPrice,
        option: options?.currency,
      };
    }

    // Add sorting
    if (options?.sortByPrice) {
      searchRequest.sort = { price: 'asc' };
    }

    return searchRequest;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new POE Trade Client instance
 */
export function createTradeClient(config: TradeConfig): PoeTradeClient {
  return new PoeTradeClient(config);
}

/**
 * Detect the current active softcore league
 * Returns the first non-hardcore, non-ruthless, non-SSF league
 */
export async function detectCurrentLeague(
  game: 'poe1' | 'poe2' = 'poe1'
): Promise<string> {
  const client = createTradeClient({
    league: 'Standard', // Temporary, just to fetch leagues
    game,
  });

  const { result: leagues } = await client.getLeagues();

  // Filter for current league (not Standard, not Hardcore variants)
  const currentLeague = leagues.find(league => {
    const id = league.id.toLowerCase();
    const text = league.text.toLowerCase();

    // Exclude these patterns
    const excluded = [
      'standard',
      'hardcore',
      'ruthless',
      'ssf',
      'solo self-found',
    ];

    // Check if any excluded pattern is in the league name
    const isExcluded = excluded.some(pattern =>
      id.includes(pattern) || text.includes(pattern)
    );

    // We want the main current league (not standard, not variants)
    return !isExcluded;
  });

  if (!currentLeague) {
    console.warn('Could not detect current league, falling back to Standard');
    return 'Standard';
  }

  return currentLeague.id;
}

/**
 * Quick search helper
 */
export async function quickSearch(
  league: string,
  itemName: string,
  options?: {
    onlineOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
    maxResults?: number;
    game?: 'poe1' | 'poe2';
  }
): Promise<FetchedItem[]> {
  const client = createTradeClient({ league, game: options?.game });
  const searchRequest = client.createSimpleSearch(itemName, options);
  const { items } = await client.searchAndFetch(searchRequest, options?.maxResults);
  return items;
}
