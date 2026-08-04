// Chợ đồ — the player↔player gear marketplace behind `/rpg market`. An item is escrowed
// out of the seller's bag at LIST time and lands in the buyer's bag at BUY time. On a
// sale the coin flow is CIRCULATION + a small burn: the buyer pays the full price, the
// seller nets floor(price × (1 − MARKET_TAX)), and the 5% difference is BURNED (a sink)
// — the RPG never mints coin, coins are conserved everywhere except this deliberate tax.
// Every mutation is a synchronous load → validate → mutate → save with NO await in
// between, so two racing buyers can never both take one listing and coins can't
// double-spend. Ghost-guarded: a seller who left the server is never paid (their whole
// share burns with them) and a leaver's listings are dropped in guilds.removeMemberData.
// Rendering (embeds/buttons) stays in commands/rpg.ts; this module owns the rule cores.

import { BAG_LIMIT, type GearItem } from "./rpg";
import { loadCoins, saveCoins } from "./economy";
import { loadCharacters, loadMarket, saveCharacters, saveMarket, type MarketListing } from "./rpg-store";

export const MARKET_TAX = 0.05; // 5% of the sale price is burned; the rest circulates to the seller
const MAX_PRICE = 1_000_000; // sanity cap so a fat-fingered price can't overflow the ledger

// Listing id — the customId arg + store key. base36 only (no ":" so it can't break the
// customId split); not security-sensitive, same note as rpg.ts's gear ids.
function newListingId(): string {
  return `L${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// Sorted newest-first for the browse view.
export function browseListings(): MarketListing[] {
  return Object.values(loadMarket().listings).sort((a, b) => b.listedAt - a.listedAt);
}

// Rao bán — escrow a bag item out of the seller's bag into a listing. Only bag items are
// sellable (an equipped piece is never in the bag → always safe). Synchronous.
export function listItem(
  sellerId: string,
  itemId: string,
  price: number,
): { ok: true; listing: MarketListing } | { ok: false; reason: "gone" | "price" } {
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) return { ok: false, reason: "price" };
  const chars = loadCharacters();
  const profile = chars[sellerId];
  if (!profile) return { ok: false, reason: "gone" };
  const idx = profile.bag.findIndex((g) => g.id === itemId);
  if (idx < 0) return { ok: false, reason: "gone" };
  const market = loadMarket();
  const [item] = profile.bag.splice(idx, 1); // escrow out of the bag
  const listing: MarketListing = { id: newListingId(), sellerId, item: item!, price, listedAt: Date.now() };
  market.listings[listing.id] = listing;
  saveCharacters(chars); // two-store mutation, one synchronous block — no await between
  saveMarket(market);
  return { ok: true, listing };
}

// Gỡ tin — the seller reclaims their own listing; the escrowed item returns to their bag.
export function cancelListing(
  userId: string,
  listingId: string,
): { ok: true; item: GearItem } | { ok: false; reason: "gone" | "notyours" | "full" } {
  const market = loadMarket();
  const listing = market.listings[listingId];
  if (!listing) return { ok: false, reason: "gone" };
  if (listing.sellerId !== userId) return { ok: false, reason: "notyours" };
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "gone" };
  if (profile.bag.length >= BAG_LIMIT) return { ok: false, reason: "full" };
  delete market.listings[listingId];
  profile.bag.push(listing.item); // item returns to the seller's bag
  saveMarket(market);
  saveCharacters(chars);
  return { ok: true, item: listing.item };
}

export interface BuyResult {
  item: GearItem;
  price: number; // what the buyer paid in full
  sellerId: string;
  sellerGot: number; // floor(price × 0.95), or 0 if the seller has left (their share burns)
  burned: number; // price − sellerGot (the 5% tax, plus a departed seller's whole share)
  buyerBalance: number;
}

// Mua — coin circulation buyer→seller minus the burn tax, item bag→bag, listing dropped.
// One synchronous block. Refuses if the buyer's bag is full (never silently salvage a
// purchase). Ghost-guarded: a departed seller is not credited.
export function buyListing(buyerId: string, listingId: string): BuyResult | { error: string } {
  const market = loadMarket();
  const listing = market.listings[listingId];
  if (!listing) return { error: "Món này không còn trên chợ nữa bro (chắc vừa có người mua hoặc người bán gỡ rồi)." };
  if (listing.sellerId === buyerId) return { error: "Đồ của chính bro mà — muốn lấy lại thì bấm nút Gỡ nhe." };
  const chars = loadCharacters();
  const buyer = chars[buyerId];
  if (!buyer) return { error: "Bro chưa có nhân vật — `/rpg create` trước đã nhe." };
  if (buyer.bag.length >= BAG_LIMIT) return { error: `Túi bro đầy (${BAG_LIMIT}) — phân rã bớt rồi mua nhe, tránh mất đồ.` };
  const coins = loadCoins();
  const balance = coins[buyerId] ?? 0;
  if (balance < listing.price) return { error: `Không đủ coin — cần **${listing.price}** 🪙, ví có **${balance}**.` };

  // Ghost guard: only pay a seller who still has a ledger entry (never resurrect a leaver).
  const sellerPresent = listing.sellerId in coins;
  const sellerGot = sellerPresent ? Math.floor(listing.price * (1 - MARKET_TAX)) : 0;
  const burned = listing.price - sellerGot;
  coins[buyerId] = balance - listing.price;
  if (sellerPresent) coins[listing.sellerId] = (coins[listing.sellerId] ?? 0) + sellerGot;
  buyer.bag.push(listing.item);
  delete market.listings[listingId];
  saveCoins(coins); // coins + characters + market, one synchronous block — no await between
  saveCharacters(chars);
  saveMarket(market);
  return { item: listing.item, price: listing.price, sellerId: listing.sellerId, sellerGot, burned, buyerBalance: coins[buyerId]! };
}
