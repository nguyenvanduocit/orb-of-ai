// The generic modifier system — PoE's three-layer stat math, PURE (no I/O). Every build stat
// resolves as  base × (1 + increased) × more  — the exact shape PoE uses:
//   • base      — flat added pools/damage (life, armour, weapon damage, added fire, …), summed.
//   • increased — additive "+X% increased/reduced" percentages, summed then applied once.
//   • more      — multiplicative "X% more/less" multipliers, each folded in as its own factor.
//
// A `ModBag` is just a map of Stat → {base, inc, more}. Producers (class/gear/passives/auras/
// ascendancy/flasks) contribute into one bag; `resolve` reads a finished stat. This replaces
// the old fixed RawBuild accumulator: adding a NEW stat is a new `Stat` key + one resolve call,
// and the `more` layer is available to every
// producer for free. The build layer (rpg-build.ts) maps its authoring dialect into this and
// resolves the two combat shapes out the far end.

export type Stat =
  // Defensive pools (base+inc+more).
  | "life"
  | "es"
  | "armour"
  | "evasion"
  // Resource pools: Spirit reserves auras, Mana + its regen fuel each swing.
  | "spirit"
  | "mana"
  | "manaRegen"
  // Offensive bases (base+inc+more): weapon-damage seed and spell-power seed.
  | "atk"
  | "spell"
  // Flat added damage of each type (base).
  | "addPhys"
  | "addFire"
  | "addCold"
  | "addLight"
  | "addChaos"
  // +% / more damage of each type, applied to the resolved hit (inc+more).
  | "dmgPhys"
  | "dmgFire"
  | "dmgCold"
  | "dmgLight"
  | "dmgChaos"
  // Crit + speed.
  | "crit" // flat crit chance (base)
  | "critMulti" // flat crit multiplier over the 1.5 base (base)
  | "speed" // attacks/round (base+inc+more)
  // Resistances (base; capped at resolve time by the caller).
  | "resFire"
  | "resCold"
  | "resLight"
  | "resChaos"
  // Ailment chances (base).
  | "ailIgnite"
  | "ailShock"
  | "ailFreeze"
  | "ailPoison"
  | "ailBleed";

// One stat's three layers. `more` is the running PRODUCT of every (1 + m) factor (identity 1),
// so folding two bags multiplies their `more` and sums base/inc.
export interface ModLayer {
  base: number;
  inc: number;
  more: number;
}

export type ModBag = Partial<Record<Stat, ModLayer>>;

function layer(bag: ModBag, stat: Stat): ModLayer {
  let l = bag[stat];
  if (!l) {
    l = { base: 0, inc: 0, more: 1 };
    bag[stat] = l;
  }
  return l;
}

// Contribute to a stat. `base`/`inc` add; `more` is a percentage (0.25 = +25% more) folded in
// multiplicatively. Any subset of the three may be given.
export function addMod(bag: ModBag, stat: Stat, mod: { base?: number; inc?: number; more?: number }): void {
  const l = layer(bag, stat);
  if (mod.base) l.base += mod.base;
  if (mod.inc) l.inc += mod.inc;
  if (mod.more) l.more *= 1 + mod.more;
}

// Resolve a stat to its final number:  base × (1 + inc) × more.  Absent stat → 0.
export function resolve(bag: ModBag, stat: Stat): number {
  const l = bag[stat];
  return l ? l.base * (1 + l.inc) * l.more : 0;
}

// The additive "+% increased" portion alone (no base) — for stats applied as a multiplier onto
// an already-resolved value, e.g. +% elemental damage onto the skill's resolved hit.
export function incMoreOf(bag: ModBag, stat: Stat): number {
  const l = bag[stat];
  return l ? (1 + l.inc) * l.more : 1;
}

export function newBag(): ModBag {
  return {};
}
