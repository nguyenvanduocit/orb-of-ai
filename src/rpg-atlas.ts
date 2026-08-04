// Atlas Tree — the endgame FARMING meta-tree. A flat, account-wide list of pickable
// nodes (no prereq chain) that multiply an expedition's loot yield: total loot, the
// unique-drop chance, the shard/mảnh drops, and floor gold. It bolts onto the loot
// side of the expedition engine (rpg.ts's rollFloorLoot output, folded in expeditions.ts)
// WITHOUT touching combat — same split as the Cổ Ngọc loot perk, just a wider meta knob.
//
// Points are DERIVED from the deepest floor ever cleared (never stored) so they can't
// drift: 1 atlas point per 5 floors of the deepest bestFloor. The allocation itself
// (atlasNodes: string[]) lives on the profile and SURVIVES a Tái Sinh (prestige) — the
// Atlas is account-wide meta, like Cổ Ngọc perks, not per-run progress.
//
// PURE module: no Discord, no I/O, no ledger. New node = a new entry.

import type { RpgProfile } from "./rpg";

// A multiplicative farming bonus. Every field defaults to 1 (no bonus); a node folds in
// one or more of them, and aggregateAtlas multiplies every allocated node's effect.
export interface AtlasEffect {
  lootMul?: number; // × material yield (🔩/✨/🧪) + floor gold rides the same lootMul in mergeLoot
  uniqueMul?: number; // × the 🟤 Unique-drop chance
  shardMul?: number; // × the 🔩 Enhancement Shard (mảnh) drops specifically
  goldMul?: number; // × floor gold specifically (on top of lootMul)
}

export interface AtlasNodeDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  effect: AtlasEffect;
  keystone?: boolean; // a build-defining FARMER archetype: big upside + a real downside, PICK ONE
}

// Derived-points knob: 1 atlas point per this many floors of the deepest bestFloor.
const FLOORS_PER_POINT = 5;

// The flat catalog — ~10 pickable nodes, no chain. Each is a modest multiplicative farm
// bonus; goldMul stays deliberately small (the aggregate stays ≤ ~1.5 in practice) so the
// coin faucet never runs away. New node = a new entry.
export const ATLAS_NODES: AtlasNodeDef[] = [
  { id: "abundance", name: "Abundance", emoji: "📦", blurb: "+15% tổng loot rơi ra", effect: { lootMul: 1.15 } },
  { id: "plentiful", name: "Plentiful Harvest", emoji: "🌾", blurb: "+20% tổng loot rơi ra", effect: { lootMul: 1.2 } },
  { id: "shaping", name: "Shaping the World", emoji: "🌐", blurb: "+25% tổng loot rơi ra", effect: { lootMul: 1.25 } },
  { id: "fortune", name: "Fortune Favours", emoji: "🍀", blurb: "×1.6 tỉ lệ rơi 🟤 Unique", effect: { uniqueMul: 1.6 } },
  { id: "chance", name: "Chance to Shine", emoji: "🎲", blurb: "×2.2 tỉ lệ rơi 🟤 Unique", effect: { uniqueMul: 2.2 } },
  { id: "forge", name: "Forge Bounty", emoji: "🔩", blurb: "+40% 🔩 Enhancement Shard", effect: { shardMul: 1.4 } },
  { id: "anvil", name: "Anvil's Grace", emoji: "⚒️", blurb: "+65% 🔩 Enhancement Shard", effect: { shardMul: 1.65 } },
  { id: "greed", name: "Boundless Greed", emoji: "💰", blurb: "+12% vàng mỗi floor", effect: { goldMul: 1.12 } },
  { id: "avarice", name: "Avarice", emoji: "🪙", blurb: "+18% vàng mỗi floor", effect: { goldMul: 1.18 } },
  { id: "conqueror", name: "Conqueror's Trove", emoji: "👑", blurb: "+10% loot · +10% vàng", effect: { lootMul: 1.1, goldMul: 1.1 } },
  // ── KEYSTONES — the "what kind of farmer am I?" fork. PICK ONE (mutually exclusive). Each is
  // a big upside PAID FOR by a real downside on a different loot axis, so the choice is a real
  // trade-off, not a strict upgrade. Gated behind KEYSTONE_MIN_POINTS (an endgame commitment).
  { id: "ks_hoard", name: "Kho Vô Tận", emoji: "📦", blurb: "KEYSTONE · +60% tổng loot, nhưng −40% cơ rơi 🟤 Unique", effect: { lootMul: 1.6, uniqueMul: 0.6 }, keystone: true },
  { id: "ks_hunter", name: "Thợ Săn Sử Thi", emoji: "🍀", blurb: "KEYSTONE · ×3 cơ rơi 🟤 Unique, nhưng −30% tổng loot", effect: { uniqueMul: 3.0, lootMul: 0.7 }, keystone: true },
  { id: "ks_forge", name: "Bễ Lò Rèn", emoji: "🔩", blurb: "KEYSTONE · +90% 🔩 Shard · +15% loot, nhưng −50% cơ rơi 🟤 Unique", effect: { shardMul: 1.9, lootMul: 1.15, uniqueMul: 0.5 }, keystone: true },
];

export const ATLAS_BY_ID: Record<string, AtlasNodeDef> = Object.fromEntries(ATLAS_NODES.map((n) => [n.id, n]));

// The deepest floor ever cleared across every region — the Atlas point source (same metric
// prestige/ascendancy read). bestFloor survives a rebirth, so points are permanent. Exported
// so the map-tier gate (maxTierFor) reads the SAME metric, not a divergent copy.
export function deepestFloor(profile: RpgProfile): number {
  return Object.values(profile.bestFloor ?? {}).reduce((m, f) => Math.max(m, f), 0);
}

// Total atlas points earned = deepest floor / 5, floored (floor 25 → 5 points). Derived,
// never stored, so it can never drift from the actual progress.
export function atlasPointsTotal(profile: RpgProfile): number {
  return Math.floor(deepestFloor(profile) / FLOORS_PER_POINT);
}

// Points still free to spend = total earned − nodes already allocated.
export function atlasPointsSpendable(profile: RpgProfile): number {
  return atlasPointsTotal(profile) - (profile.atlasNodes ?? []).length;
}

// Keystones are an endgame commitment — you need this many earned points before one is
// pickable, so a player learns the flat nodes first and the big fork is a considered choice.
const KEYSTONE_MIN_POINTS = 5;

// The single keystone the profile currently owns (its farmer identity), or null. Used to
// enforce the pick-ONE rule + surfaced in the panel.
export function ownedAtlasKeystone(profile: RpgProfile): AtlasNodeDef | null {
  for (const id of profile.atlasNodes ?? []) if (ATLAS_BY_ID[id]?.keystone) return ATLAS_BY_ID[id]!;
  return null;
}

// Can the profile allocate this node right now? A real node, not already owned, with a free
// point. A keystone additionally needs KEYSTONE_MIN_POINTS earned AND no other keystone owned
// (pick one). Pure — the imperative allocate (command glue) re-checks this post-load.
export function canAllocateAtlas(profile: RpgProfile, nodeId: string): boolean {
  const def = ATLAS_BY_ID[nodeId];
  if (!def) return false;
  if ((profile.atlasNodes ?? []).includes(nodeId)) return false;
  if (atlasPointsSpendable(profile) < 1) return false;
  if (def.keystone) {
    if (atlasPointsTotal(profile) < KEYSTONE_MIN_POINTS) return false; // endgame gate
    if (ownedAtlasKeystone(profile)) return false; // one farmer identity at a time
  }
  return true;
}

// Fold every allocated node's effect into one multiplier bundle (product of all chosen
// nodes; the empty set → all 1). The expedition loot side reads this live from the profile.
export function aggregateAtlas(nodeIds: string[]): Required<AtlasEffect> {
  const out = { lootMul: 1, uniqueMul: 1, shardMul: 1, goldMul: 1 };
  for (const id of nodeIds) {
    const def = ATLAS_BY_ID[id];
    if (!def) continue;
    if (def.effect.lootMul) out.lootMul *= def.effect.lootMul;
    if (def.effect.uniqueMul) out.uniqueMul *= def.effect.uniqueMul;
    if (def.effect.shardMul) out.shardMul *= def.effect.shardMul;
    if (def.effect.goldMul) out.goldMul *= def.effect.goldMul;
  }
  return out;
}
