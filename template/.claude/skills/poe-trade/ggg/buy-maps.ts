#!/usr/bin/env bun

/**
 * Buy Maps Script
 *
 * Searches PoE trade for maps (single or multiple) and groups by seller
 * Uses the regular trade search API instead of bulk exchange
 *
 * Usage:
 *   bun .claude/skills/poe-trade/ggg/buy-maps.ts "Beach"
 *   bun .claude/skills/poe-trade/ggg/buy-maps.ts "Beach" "Strand" "Cemetery"
 *   bun .claude/skills/poe-trade/ggg/buy-maps.ts --currency divine "Beach" "Strand"
 *   bun .claude/skills/poe-trade/ggg/buy-maps.ts --tier 16 "Beach" "Strand"
 */

import { createTradeClient, detectCurrentLeague, type FetchedItem } from './client';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OUTPUT_FILE = 'outputs/map-purchases.json';

interface SearchOptions {
  currency?: string; // Currency to filter by
  league?: string;
  tier?: number; // Specific tier
  maxResults: number;
  onlineOnly: boolean;
  instantTrade: boolean; // Instant trade (securable) option
  outputFile: string;
}

interface SellerOffer {
  mapName: string;
  tier: number;
  price: number;
  priceType: string;
  currency: string;
  whisper?: string;
  listingId: string;
  hideoutToken?: string; // For instant trade
  whisperToken?: string; // For regular whisper API
  isInstantTrade: boolean;
  fee?: number; // Fee for instant trade
}

interface SellerGroup {
  seller: string;
  character: string;
  totalMaps: number;
  offers: SellerOffer[];
  whispers: string[];
}

interface PurchaseOutput {
  generatedAt: string;
  league: string;
  currency?: string;
  requestedMaps: string[];
  foundMaps: string[];
  totalSellers: number;
  queryId: string;
  sellers: SellerGroup[];
}

// ============================================================================
// Main Logic
// ============================================================================

async function searchMaps(
  mapNames: string[],
  options: SearchOptions
): Promise<PurchaseOutput> {
  const league = options.league || await getCurrentLeague();

  console.log(`\n🔍 Searching for maps...`);
  console.log(`   Maps: ${mapNames.join(', ')}`);
  console.log(`   League: ${league}`);
  if (options.tier) console.log(`   Tier: ${options.tier}`);
  if (options.currency) console.log(`   Currency filter: ${options.currency}`);
  console.log(`   Instant trade: ${options.instantTrade ? 'Yes' : 'No'}\n`);

  const client = createTradeClient({
    league,
    game: 'poe2',
  });

  // Search for each map
  const allItems: FetchedItem[] = [];
  const foundMaps = new Set<string>();

  for (const mapName of mapNames) {
    console.log(`Searching for "${mapName}"...`);

    const searchRequest = client.createMapSearch(mapName, {
      onlineOnly: options.onlineOnly,
      instantTrade: options.instantTrade,
      tier: options.tier,
      currency: options.currency,
      sortByPrice: true,
    });

    try {
      const { searchResult, items } = await client.searchAndFetch(
        searchRequest,
        options.maxResults
      );

      console.log(`   Found ${searchResult.total} total, fetched ${items.length}`);

      if (items.length > 0) {
        foundMaps.add(mapName);
        allItems.push(...items);
      }
    } catch (error) {
      console.error(`   Error searching for ${mapName}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n📊 Total items found: ${allItems.length}`);

  // Group by seller
  const sellerMap = new Map<string, SellerGroup>();

  for (const item of allItems) {
    const sellerKey = item.listing.account.name;

    if (!sellerMap.has(sellerKey)) {
      sellerMap.set(sellerKey, {
        seller: item.listing.account.name,
        character: item.listing.account.lastCharacterName || 'Unknown',
        totalMaps: 0,
        offers: [],
        whispers: [],
      });
    }

    const sellerGroup = sellerMap.get(sellerKey)!;

    // Extract map info from item
    const mapName = item.item.typeLine || item.item.name;
    const tierProp = item.item.properties?.find(p => p.name === 'Map Tier');
    const tier = tierProp ? parseInt(tierProp.values[0][0]) : 0;

    const offer: SellerOffer = {
      mapName,
      tier,
      price: item.listing.price?.amount || 0,
      priceType: item.listing.price?.type || 'unknown',
      currency: item.listing.price?.currency || 'unknown',
      listingId: item.id,
      isInstantTrade: !!item.listing.hideout_token,
      fee: item.listing.fee,
      hideoutToken: item.listing.hideout_token,
      whisperToken: item.listing.whisper_token,
      whisper: item.listing.whisper,
    };

    sellerGroup.offers.push(offer);
    sellerGroup.totalMaps += 1;

    if (offer.whisper) {
      sellerGroup.whispers.push(offer.whisper);
    }
  }

  // Convert to array and sort by total maps
  const sellers = Array.from(sellerMap.values())
    .sort((a, b) => b.totalMaps - a.totalMaps);

  // Display summary
  console.log(`\n📋 Summary:`);
  console.log(`   Total sellers: ${sellers.length}`);
  console.log(`   Maps found: ${Array.from(foundMaps).join(', ')}\n`);

  console.log(`🏆 Top sellers by inventory:\n`);
  sellers.slice(0, 5).forEach((seller, i) => {
    console.log(`   ${i + 1}. ${seller.seller} (@${seller.character})`);
    console.log(`      Total listings: ${seller.totalMaps}`);

    // Group offers by map name
    const offersByMap = new Map<string, SellerOffer[]>();
    for (const offer of seller.offers) {
      if (!offersByMap.has(offer.mapName)) {
        offersByMap.set(offer.mapName, []);
      }
      offersByMap.get(offer.mapName)!.push(offer);
    }

    offersByMap.forEach((offers, mapName) => {
      const prices = offers.map(o => `${o.price} ${o.currency}`).join(', ');
      const instantCount = offers.filter(o => o.isInstantTrade).length;
      const instantLabel = instantCount > 0 ? ` [${instantCount} instant]` : '';
      console.log(`      - ${mapName}: ${offers.length}x at ${prices}${instantLabel}`);
    });

    console.log('');
  });

  return {
    generatedAt: new Date().toISOString(),
    league,
    currency: options.currency,
    requestedMaps: mapNames,
    foundMaps: Array.from(foundMaps),
    totalSellers: sellers.length,
    queryId: '', // Not applicable for regular trade API
    sellers,
  };
}

async function getCurrentLeague(): Promise<string> {
  console.log('Detecting current league...');
  const league = await detectCurrentLeague('poe2');
  console.log(`Using league: ${league}\n`);
  return league;
}

async function saveOutput(data: PurchaseOutput, filename: string): Promise<void> {
  // Ensure output directory exists
  const dir = filename.split('/').slice(0, -1).join('/');
  if (dir) {
    await Bun.write(Bun.file(dir + '/.gitkeep'), '');
  }

  await Bun.write(filename, JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved results to: ${filename}`);
  console.log(`   Total sellers: ${data.totalSellers}`);
  console.log(`   Total maps found: ${data.foundMaps.length}/${data.requestedMaps.length}`);
}

function parseArgs(args: string[]): {
  mapNames: string[];
  options: SearchOptions;
} {
  const mapNames: string[] = [];
  const options: SearchOptions = {
    maxResults: 50,
    onlineOnly: true,
    instantTrade: false,
    outputFile: DEFAULT_OUTPUT_FILE,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--currency':
      case '-c':
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.currency = args[++i];
        }
        break;
      case '--league':
      case '-l':
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.league = args[++i];
        }
        break;
      case '--tier':
      case '-t':
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.tier = parseInt(args[++i]);
        }
        break;
      case '--max-results':
      case '-n':
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.maxResults = parseInt(args[++i]);
        }
        break;
      case '--output':
      case '-o':
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.outputFile = args[++i];
        }
        break;
      case '--offline':
        options.onlineOnly = false;
        break;
      case '--instant-trade':
      case '--instant':
        options.instantTrade = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          mapNames.push(arg);
        }
    }
  }

  return { mapNames, options };
}

function showHelp(): void {
  console.log(`
Buy Maps Script

USAGE:
  bun .claude/skills/poe-trade/ggg/buy-maps.ts [options] <map1> [map2] [map3] ...

ARGUMENTS:
  <mapN>                   Map names to search for (e.g., "Beach" or "Pit")
                           Works with 1 or more maps

OPTIONS:
  --currency, -c <type>    Currency to filter by (default: all currencies)
                           Examples: chaos, divine, chisel
  --league, -l <name>      League name (default: auto-detect)
  --tier, -t <number>      Specific map tier (default: all tiers)
  --max-results, -n <n>    Max results per map (default: 50)
  --output, -o <file>      Output JSON file (default: ${DEFAULT_OUTPUT_FILE})
  --offline                Include offline sellers
  --instant-trade, --instant
                           Search only instant trade (securable) listings
  --help                   Show this help

FEATURES:
  ✓ Search single or multiple maps using trade search API
  ✓ Group results by seller (buy multiple maps from same person)
  ✓ Shows all listings per seller
  ✓ Support for instant trade (hideout_token) listings
  ✓ Support for whisper API tokens

EXAMPLES:
  # Search for single map
  bun .claude/skills/poe-trade/ggg/buy-maps.ts "Pit"

  # Search for multiple maps
  bun .claude/skills/poe-trade/ggg/buy-maps.ts "Beach" "Strand" "Cemetery"

  # Search specific tier
  bun .claude/skills/poe-trade/ggg/buy-maps.ts --tier 16 "Strand" "Mesa"

  # Filter by currency
  bun .claude/skills/poe-trade/ggg/buy-maps.ts --currency chisel "Pit" "Strand"

  # Get more results
  bun .claude/skills/poe-trade/ggg/buy-maps.ts -n 100 "Beach" "Strand" "Cemetery"

  # Search only instant trade listings
  bun .claude/skills/poe-trade/ggg/buy-maps.ts --instant-trade "Beach" "Strand"

OUTPUT:
  Generates a JSON file with sellers grouped by account.
  Each seller shows all maps they have from your search.
  Use with whisper script to contact sellers.
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const { mapNames, options } = parseArgs(args);

  if (mapNames.length === 0) {
    console.error('❌ Error: No map names provided');
    console.log('Run "bun .claude/skills/poe-trade/ggg/buy-maps.ts --help" for usage');
    process.exit(1);
  }

  try {
    const data = await searchMaps(mapNames, options);
    await saveOutput(data, options.outputFile);

    console.log(`\n📋 Next step: open a seller's listing in-game and whisper`);
    console.log(`   (read-only — it finds listings; you complete the trade in the client)`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
