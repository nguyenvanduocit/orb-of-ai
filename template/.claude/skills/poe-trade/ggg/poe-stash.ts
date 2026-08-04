#!/usr/bin/env bun

/**
 * POE Stash CLI
 *
 * Fetch stash tab contents and list characters
 *
 * Usage:
 *   bun run stash:list                              # List all characters
 *   bun run stash:stash <league>                    # List stash tabs
 *   bun run stash:stash <league> <tabIndex>         # Get stash tab contents
 *   bun run stash:stash <league> --name "Tab"       # Get stash by name
 */

import { createStashClient, type Item } from './stash';
import { detectCurrentLeague } from './client';
import { formatSocketString } from './poe-utils';

// Type declarations for Bun globals
declare const Bun: {
  argv: string[];
  env: Record<string, string | undefined>;
};

const args = Bun.argv.slice(2);
const command = args[0];

const ACCOUNT_NAME = Bun.env.POE_ACCOUNT_NAME || '';

// Cache for detected league
let cachedLeague: string | null = null;

/**
 * Get the current league (with caching to avoid repeated API calls)
 */
async function getCurrentLeague(): Promise<string> {
  if (cachedLeague) {
    return cachedLeague;
  }

  console.log('Detecting current league...');
  cachedLeague = await detectCurrentLeague('poe2');
  console.log(`Using league: ${cachedLeague}\n`);

  return cachedLeague;
}

// Show help without requiring session ID
if (!command || command === 'help') {
  console.log(`
POE Stash CLI

Usage:
  bun run stash:list                              # List all characters
  bun run stash:stash [league]                    # List stash tabs (auto-detects league)
  bun run stash:stash [league] <tabIndex>         # Get stash tab contents
  bun run stash:stash [league] --name "Tab"       # Get stash by name

Environment:
  POE_ACCOUNT_NAME   - Your account name (optional; inferred from the browser session)

Stash reads run as a page-context fetch in the logged-in www.pathofexile.com tab (via playwriter) — no POESESSID needed.

Examples:
  bun run stash:list
  bun run stash:stash                    # Auto-detects current league
  bun run stash:stash "Settlers"         # Specify league
  bun run stash:stash 0                  # Auto-detects league, tab index 0
  bun run stash:stash --name "Currency"  # Auto-detects league, tab by name
  `);
  (globalThis as any).process?.exit(0);
}

const client = createStashClient({
  accountName: ACCOUNT_NAME,
  game: 'poe2',
});

function formatItem(item: Item, indent = '') {
  const name = item.name || item.typeLine;
  const corrupted = item.corrupted ? ' [CORRUPTED]' : '';
  const ilvl = `iLvl: ${item.ilvl}`;

  console.log(`${indent}${name}${corrupted}`);
  console.log(`${indent}  ${item.typeLine} (${ilvl})`);

  if (item.properties) {
    for (const prop of item.properties) {
      const values = prop.values.map((v: any) => v[0]).join(', ');
      console.log(`${indent}  ${prop.name}: ${values}`);
    }
  }

  if (item.requirements) {
    const reqs = item.requirements
      .map((r: any) => `${r.name}: ${r.values[0][0]}`)
      .join(', ');
    console.log(`${indent}  Requirements: ${reqs}`);
  }

  if (item.sockets && item.sockets.length > 0) {
    const socketStr = formatSocketString(item.sockets);
    console.log(`${indent}  Sockets: ${socketStr}`);
  }

  if (item.implicitMods) {
    console.log(`${indent}  Implicit:`);
    for (const mod of item.implicitMods) {
      console.log(`${indent}    ${mod}`);
    }
  }

  if (item.explicitMods) {
    console.log(`${indent}  Explicit:`);
    for (const mod of item.explicitMods) {
      console.log(`${indent}    ${mod}`);
    }
  }

  if (item.craftedMods) {
    console.log(`${indent}  Crafted:`);
    for (const mod of item.craftedMods) {
      console.log(`${indent}    ${mod}`);
    }
  }

  if (item.enchantMods) {
    console.log(`${indent}  Enchant:`);
    for (const mod of item.enchantMods) {
      console.log(`${indent}    ${mod}`);
    }
  }

  console.log('');
}

async function listStashTabs(league: string) {
  const tabs = await client.getAllStashTabs(league);

  console.log(`\nStash tabs in ${league}:\n`);

  for (const tab of tabs) {
    const hidden = tab.hidden ? ' [HIDDEN]' : '';
    const color = tab.colour ? ` (RGB: ${tab.colour.r},${tab.colour.g},${tab.colour.b})` : '';
    console.log(`[${tab.i}] ${tab.n}${hidden} - ${tab.type}${color}`);
  }

  console.log(`\nTotal: ${tabs.length} tabs`);
}

async function getStashContents(league: string, tabIndex: number) {
  const stash = await client.getStashTabs(league, tabIndex);
  const tab = stash.tabs.find(t => t.i === tabIndex);

  if (!tab) {
    console.error(`Tab index ${tabIndex} not found. Available tabs: 0-${stash.tabs.length - 1}`);
    return;
  }

  console.log(`\nStash Tab: ${tab.n} (${tab.type})`);
  console.log(`Items: ${stash.items.length}\n`);

  if (stash.items.length === 0) {
    console.log('(Empty)');
    return;
  }

  for (const item of stash.items) {
    formatItem(item);
  }
}

async function getStashByName(league: string, tabName: string) {
  const stash = await client.getStashTabByName(league, tabName);

  if (!stash) {
    console.error(`Stash tab "${tabName}" not found in league ${league}`);
    return;
  }

  const tab = stash.tabs.find((t) => t.n === tabName);
  if (!tab) {
    console.error(`Tab "${tabName}" not found in stash response`);
    return;
  }

  console.log(`\nStash Tab: ${tab.n} (${tab.type})`);
  console.log(`Items: ${stash.items.length}\n`);

  if (stash.items.length === 0) {
    console.log('(Empty)');
    return;
  }

  for (const item of stash.items) {
    formatItem(item);
  }
}

async function main() {
  if (command === 'stash') {
    // Parse arguments - league is optional, can auto-detect
    let league: string | null = null;
    let tabIndex: number | null = null;
    let tabName: string | null = null;

    // Check for --name flag
    const nameIndex = args.indexOf('--name');
    if (nameIndex !== -1) {
      tabName = args[nameIndex + 1];
      // League might be before --name
      if (args[1] && args[1] !== '--name') {
        league = args[1];
      }
    } else {
      // No --name flag, parse positional args
      if (args[1]) {
        // Could be league or tab index
        const parsed = parseInt(args[1]);
        if (isNaN(parsed)) {
          // It's a league name
          league = args[1];
          if (args[2]) {
            tabIndex = parseInt(args[2]);
          }
        } else {
          // It's a tab index, auto-detect league
          tabIndex = parsed;
        }
      }
    }

    // Auto-detect league if not provided
    if (!league) {
      league = await getCurrentLeague();
    }

    // Execute appropriate command
    if (tabName) {
      await getStashByName(league, tabName);
    } else if (tabIndex !== null) {
      await getStashContents(league, tabIndex);
    } else {
      await listStashTabs(league);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "bun .claude/skills/poe-trade/ggg/poe-stash.ts help" for usage');
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  (globalThis as any).process?.exit(1);
});
