/**
 * Path of Exile Stash API Client
 *
 * Reads stash tabs via a page-context `fetch()` in the logged-in
 * www.pathofexile.com tab (driven through playwriter). No POESESSID/cookies
 * here — the browser supplies auth. The transport enforces rate-limiting, so no
 * local cooldown.
 *
 * get-stash-items is called as GET with query params (the browser's same-origin
 * request carries the session), which the page-context fetch sends verbatim.
 */

import { poeFetch, type Game } from './transport';

export interface StashClientConfig {
  accountName?: string;
  game?: Game;
}

export interface Item {
  id: string;
  name: string;
  typeLine: string;
  baseType: string;
  ilvl: number;
  corrupted?: boolean;
  identified?: boolean;
  requirements?: Array<{ name: string; values: string[][] }>;
  sockets?: Array<{ group: number; attr: string; sColour: string }>;
  properties?: Array<{ name: string; values: any[][] }>;
  explicitMods?: string[];
  implicitMods?: string[];
  craftedMods?: string[];
  enchantMods?: string[];
  frameType: number;
  x?: number;
  y?: number;
  inventoryId?: string;
  socketedItems?: Item[];
}

export interface StashTab {
  n: string; // name
  i: number; // index
  id: string;
  type: string;
  hidden?: boolean;
  selected?: boolean;
  colour?: { r: number; g: number; b: number };
}

export interface StashTabContents {
  numTabs: number;
  tabs: StashTab[];
  items: Item[];
}

export class StashClient {
  private accountName?: string;
  private game: Game;

  constructor(config: StashClientConfig) {
    this.accountName = config.accountName;
    this.game = config.game ?? 'poe1';
  }

  /**
   * The POE API infers the account from the browser session when accountName is
   * absent, so it is only added when explicitly provided.
   */
  async getStashTabs(league: string, tabIndex = 0): Promise<StashTabContents> {
    const params = new URLSearchParams({
      realm: 'pc',
      league,
      tabIndex: tabIndex.toString(),
      tabs: '1',
    });
    if (this.accountName) params.set('accountName', this.accountName);

    const wrapped = await poeFetch<StashTabContents>(
      this.game,
      'GET',
      `/character-window/get-stash-items?${params}`,
    );
    if (wrapped.status >= 400) {
      const detail = typeof wrapped.data === 'string' ? wrapped.data : JSON.stringify(wrapped.data);
      throw new Error(`Failed to fetch stash: ${wrapped.status}\n${detail}`);
    }
    return wrapped.data;
  }

  async getAllStashTabs(league: string): Promise<StashTab[]> {
    const firstTab = await this.getStashTabs(league, 0);
    return firstTab.tabs;
  }

  async getStashTabByName(league: string, tabName: string): Promise<StashTabContents | null> {
    // First call: get all tab metadata (index 0 returns all tabs in the tabs array)
    const firstTab = await this.getStashTabs(league, 0);
    const tab = firstTab.tabs.find((t) => t.n === tabName);
    if (!tab) return null;
    if (tab.i === 0) return firstTab; // already have this tab's contents
    return this.getStashTabs(league, tab.i);
  }
}

export function createStashClient(config: StashClientConfig): StashClient {
  return new StashClient(config);
}
