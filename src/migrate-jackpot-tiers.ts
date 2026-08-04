// ONE-TIME MIGRATION — retier the pre-perfected 🌟 jackpot items already sitting in players' bags.
//
// The 🌟 chấn động drop used to roll `perfect`: a guaranteed Huyền Thoại whose EVERY affix was
// forced to T1 at max value. Measured on the live volume, that made 55-60% of all Huyền Thoại in
// play a finished item, put the whole tier ladder out of reach of mattering, and left the player
// market with nothing worth listing. The engine no longer rolls that way — a jackpot now grants
// the CANVAS (top rarity, full affix count, deep ilvl) and rolls its tiers off the same weighted
// pool as any other drop.
//
// That fix only governs FUTURE drops, so this script settles the ones already banked. It keeps
// the item, its slot, its base, its ⭐/+N, and the exact affix FAMILIES the player has been
// building around — it re-rolls only the TIER (and the value inside that tier's band), against
// the item's own ilvl. Nobody loses a character, a level, or a piece of gear; what goes away is
// the perfection that a design fault handed out for free.
//
// Identification is safe by construction: a naturally-rolled 8-affix Huyền Thoại comes out
// entirely T1 with probability ~1e-11, so "top rarity + full affix count + every affix T1" can
// only be a legacy jackpot. Idempotent — after a run nothing matches the predicate any more.
//
//   bun run rpg:retier --dry-run     # print what would change, write nothing
//   bun run rpg:retier               # apply
//
// On prod:  fly ssh console -C "sh -c 'cd /app && bun run rpg:retier --dry-run'"

import { loadCharacters, saveCharacters } from "./rpg-store";
import { JACKPOT_ILVL, MOD_CAP, MOD_POOL, modLabel, type GearItem, type Mod } from "./rpg";

const MOD_BY_GROUP = Object.fromEntries(MOD_POOL.map((d) => [d.group, d]));
const FULL_LEGENDARY = MOD_CAP[4].pre + MOD_CAP[4].suf;

// A legacy pre-perfected jackpot: top rarity, not a Unique, its whole canvas filled, and every
// single affix at T1. Nothing the current engine can produce satisfies this.
function isLegacyPerfect(item: GearItem): boolean {
  if (item.rarity !== 4 || item.uniqueId) return false;
  const mods = item.mods ?? [];
  return mods.length >= FULL_LEGENDARY && mods.every((m) => m.tier === 1);
}

// Re-roll ONE affix's tier, keeping its family. Draws from the family's own tiers weighted the
// way the drop table weights them, gated by the item's ilvl — so a shallow item cannot land the
// deep tiers, exactly as a fresh drop could not.
function retierMod(mod: Mod, ilvl: number, rng: () => number): Mod {
  const def = MOD_BY_GROUP[mod.group];
  if (!def) return mod;
  const open = def.tiers.map((t, i) => ({ t, i })).filter(({ t }) => t.ilvl <= ilvl);
  const pool = open.length > 0 ? open : [{ t: def.tiers[def.tiers.length - 1]!, i: def.tiers.length - 1 }];
  const total = pool.reduce((a, e) => a + e.t.weight, 0);
  let r = rng() * total;
  let pick = pool[pool.length - 1]!;
  for (const e of pool) {
    r -= e.t.weight;
    if (r <= 0) {
      pick = e;
      break;
    }
  }
  const band = pick.t;
  const raw = band.min + rng() * (band.max - band.min);
  return { ...mod, tier: pick.i + 1, value: def.pctLike ? Math.round(raw * 1000) / 1000 : Math.round(raw) };
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const rng = Math.random;
  const characters = loadCharacters();

  let scanned = 0;
  let touched = 0;
  const owners = new Set<string>();

  for (const [userId, profile] of Object.entries(characters)) {
    const slots = Object.values(profile.gear ?? {}).filter(Boolean) as GearItem[];
    const bag = (profile.bag ?? []) as GearItem[];
    for (const item of [...slots, ...bag]) {
      scanned++;
      if (!isLegacyPerfect(item)) continue;
      const before = (item.mods ?? []).map(modLabel);
      // These items ARE jackpots, and the current rules drop a jackpot at JACKPOT_ILVL — so they
      // are re-rolled at that depth rather than at the shallower ilvl the old jackpot stamped.
      // Anything less would deny them the T1 band entirely, which is a harsher outcome than the
      // rules they are being migrated onto would ever produce.
      item.ilvl = Math.max(item.ilvl ?? 1, JACKPOT_ILVL);
      // Mutating the item in place is what carries the change into both `gear` and `bag`, since
      // those arrays hold the same object references this loop is walking.
      item.mods = (item.mods ?? []).map((m) => retierMod(m, item.ilvl!, rng));
      const after = item.mods.map(modLabel);
      touched++;
      owners.add(userId);
      const worn = slots.includes(item) ? " [ĐANG ĐEO]" : "";
      console.log(`\n  ${userId.slice(0, 8)}… · ${item.base} (ilvl ${item.ilvl})${worn}`);
      for (let i = 0; i < after.length; i++) console.log(`      ${before[i]}  →  ${after[i]}`);
    }
  }

  const verb = dryRun ? "sẽ đổi" : "đã đổi";
  console.log(
    `\n[retier] quét ${scanned} món của ${Object.keys(characters).length} nhân vật · ${verb} ${touched} món jackpot cũ của ${owners.size} người chơi`,
  );
  if (touched === 0) {
    console.log("[retier] không còn món nào toàn T1 — không có gì để làm.");
    return;
  }
  if (dryRun) {
    console.log("[retier] --dry-run: KHÔNG ghi gì cả.");
    return;
  }
  saveCharacters(characters);
  console.log("[retier] đã lưu characters.json.");
}

main();
