// The MAPS / Atlas layer — PURE (no Discord, no I/O, no ledger). This sits ON TOP of
// the 5-element combat core (rpg-combat) and the region data in rpg.ts. It answers ONE
// question the expedition asks each floor: "who does the hero fight here?" — turning a
// (region, floor, tier, mapMods) tuple into a `Fighter` the auto-battle can run.
//
// PoE framing: rpg.ts's five STAGES are the five REGIONS (biomes, gated, themed). On top
// of them rides a MAP TIER (T1..T16) — the Atlas knob that scales monster difficulty AND
// loot together (danger↑ → loot↑), plus a small set of rollable MAP MODIFIERS (extra
// monster life, added elemental damage, bigger packs → more loot). Every mod is a pure
// mutator over the monster's `Fighter` and/or a flat loot multiplier, so the expedition
// can fold them in without knowing their internals.
//
// Same functional-core split as the rest of the RPG: this module reasons (region+floor+
// tier → Fighter), the shell (expeditions) owns the store, the roll, and the loot payout.

import {
  RES_CAP,
  zeroBundle,
  type Ailment,
  type DamageBundle,
  type DamageType,
  type Defenses,
  type Elem,
  type Fighter,
  type Offense,
} from "./rpg-combat";
import { isBossFloor, type ArchetypeId, type Stage, type StageTheme } from "./rpg";
import type { EffectRef } from "./rpg-effects";

// ─────────────────────────────────────────────────────────────────────────────
// Map tiers — the Atlas difficulty knob. A tier multiplies BOTH the monster's
// power (via `diff`) and the loot it drops (`loot`), so pushing higher tiers is
// the risk/reward lever. T1 is neutral (×1 / ×1); each tier up bumps both. 16
// tiers mirror PoE's white-map range. New tier = a taller ladder, nothing else.
// ─────────────────────────────────────────────────────────────────────────────

export interface MapTier {
  tier: number; // 1..16
  diff: number; // monster stat multiplier (life/damage/armour/…)
  loot: number; // loot-yield multiplier the expedition applies to this map's drops
}

export const MAX_MAP_TIER = 16;

// Difficulty ramps ~11%/tier (compounding), loot ~14%/tier. Loot MUST outrun difficulty:
// pushing a tier risks the whole run, not just the floor, so a tier is only worth dialing
// when its yield beats that tail risk — reward has to lead by enough to pay for dying.
// At T8 that is +21% yield over T1-difficulty-adjusted, at T16 +49%. Pure, memo-free.
export function mapTier(tier: number): MapTier {
  const t = Math.max(1, Math.min(MAX_MAP_TIER, Math.round(tier)));
  return {
    tier: t,
    diff: Math.pow(1.11, t - 1),
    loot: Math.pow(1.14, t - 1),
  };
}

export const MAP_TIERS: MapTier[] = Array.from({ length: MAX_MAP_TIER }, (_, i) => mapTier(i + 1));

// Per-floor enemy stat multiplier — a POLYNOMIAL curve pinned to each region's `enemyGrowth`
// at the anchor floor (so the early/mid game and every progression gate keep their tuned feel),
// then growing as (floor-1)^pow. Reachable floor ∝ power^(1/pow): more hero power always buys
// meaningfully more depth, with no asymptote and no compounding wall.
//
// Life rides a slightly steeper exponent than damage, so deep monsters get tankier faster
// than they get deadlier — a fight lasts a little longer and the monster gets to swing back.
//
// Damage is deliberately hard: rpg-combat's MAX_HIT_FRAC already caps any single hit to a
// fraction of the hero's life, so a steep damage curve costs a real bite of health per deep
// floor rather than sudden death. That bite IS the run's clock — a hero out-earning the
// between-floor healing pushes on, one falling behind bleeds down over several floors and can
// see it coming (quaff a 🧪, or turn back). Soften this exponent and floor cost collapses to
// ~2% of life, attrition disappears, and runs stop ending at all.
export const FLOOR_ANCHOR = 20;
export const LIFE_POW = 3.0;
export const DMG_POW = 1.5;
export function floorDifficultyMul(enemyGrowth: number, floor: number, pow: number = LIFE_POW): number {
  const anchorMul = Math.pow(1 + enemyGrowth, FLOOR_ANCHOR - 1); // the region's compounding value at the anchor
  const c = (anchorMul - 1) / Math.pow(FLOOR_ANCHOR - 1, pow); // solve so the poly matches at the anchor
  return 1 + c * Math.pow(Math.max(0, floor - 1), pow);
}

// Highest map tier a hero has EARNED access to — gated by their deepest-ever floor so tiers
// are a progression the player unlocks, not a free dial handed out at level 1. 1 tier per 5
// floors of the deepest clear (mirrors the Atlas point cadence), clamped to [1, MAX_MAP_TIER].
// The tier's own difficulty (diff outpaces loot) is the real wall; this gate just keeps a
// fresh hero from dialing T16 and instantly dying. Pure.
export function maxTierFor(deepestFloor: number): number {
  return Math.max(1, Math.min(MAX_MAP_TIER, 1 + Math.floor(Math.max(0, deepestFloor) / 5)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Region theme → element. A region's `StageTheme` decides which element its
// monsters splash onto their phys base — "phys" regions stay pure physical, the
// four elemental themes split their hit phys/element so a mono-resistance hero
// still takes some damage. This is the ONLY place the theme axis becomes real damage.
// ─────────────────────────────────────────────────────────────────────────────

const THEME_ELEM: Record<Exclude<StageTheme, "phys">, Elem> = {
  fire: "fire",
  cold: "cold",
  light: "light",
  chaos: "chaos",
};

// ─────────────────────────────────────────────────────────────────────────────
// Map modifiers — the rollable spice. Each is a pure mutator over the monster
// Fighter (`mutate`) and/or a flat loot multiplier (`loot`). PoE-style: danger↑
// pays loot↑. `rollMapMods` picks a small random subset — keep ~6 in the pool.
// ─────────────────────────────────────────────────────────────────────────────

export interface MapMod {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  mutate?: (f: Fighter) => Fighter; // reshape the monster (life/damage/res/speed…)
  loot?: number; // flat loot-yield multiplier this mod adds (compounds with tier + other mods)
}

// Add a flat amount of a damage type onto a monster's hit bundle (used by "extra
// element" mods). Returns a new Offense (the whole module stays immutable/pure).
function withAddedHit(off: Offense, type: DamageType, amount: number): Offense {
  const hit: DamageBundle = { ...off.hit };
  hit[type] = (hit[type] ?? 0) + amount;
  return { ...off, hit };
}

// The catalog — six PoE-flavour map mods. Life/damage mods pay a modest loot bonus;
// the pack-size mod is pure loot (the expedition reads `loot` and grants more drops).
export const MAP_MODS: MapMod[] = [
  {
    id: "sungmau",
    name: "Overflowing",
    emoji: "❤️",
    blurb: "Quái +40% máu — dai hơn nhưng rơi đồ hậu hĩnh hơn",
    loot: 0.15,
    mutate: (f) => ({ ...f, def: { ...f.def, life: Math.round(f.def.life * 1.4) } }),
  },
  {
    id: "cuongbao",
    name: "Berserk",
    emoji: "💢",
    blurb: "Quái +30% sát thương — đánh đau, nhưng thưởng thêm",
    loot: 0.15,
    mutate: (f) => ({ ...f, off: scaleHit(f.off, 1.3) }),
  },
  {
    id: "boclua",
    name: "Flameshrouded",
    emoji: "🔥",
    blurb: "Quái phun thêm sát thương Fire lên mỗi đòn",
    loot: 0.1,
    mutate: (f) => ({ ...f, off: withAddedHit(f.off, "fire", Math.round(hitTotal(f.off) * 0.35 + 3)) }),
  },
  {
    id: "phongdien",
    name: "Electrified",
    emoji: "⚡",
    blurb: "Quái nhiễm điện — thêm sát thương Lightning & dễ gây Shock",
    loot: 0.1,
    mutate: (f) => ({
      ...f,
      off: {
        ...withAddedHit(f.off, "light", Math.round(hitTotal(f.off) * 0.3 + 2)),
        ailment: { ...f.off.ailment, shock: Math.max(f.off.ailment.shock ?? 0, 0.25) },
      },
    }),
  },
  {
    id: "vugiap",
    name: "Armoured",
    emoji: "🛡️",
    blurb: "Quái +80% giáp & +20% kháng — lì đòn, hạ chậm",
    loot: 0.12,
    mutate: (f) => ({
      ...f,
      def: {
        ...f.def,
        armour: Math.round(f.def.armour * 1.8 + 20),
        res: {
          fire: Math.min(RES_CAP, f.def.res.fire + 0.2),
          cold: Math.min(RES_CAP, f.def.res.cold + 0.2),
          light: Math.min(RES_CAP, f.def.res.light + 0.2),
          chaos: Math.min(RES_CAP, f.def.res.chaos + 0.2),
        },
      },
    }),
  },
  {
    id: "baydan",
    name: "Swarming",
    emoji: "🐺",
    blurb: "Quái đi theo bầy — nhanh nhẹn hơn & rơi đồ nhiều hơn hẳn",
    loot: 0.3,
    mutate: (f) => ({ ...f, off: { ...f.off, speed: f.off.speed + 0.2 } }),
  },
];

export const MAP_MOD_BY_ID: Record<string, MapMod> = Object.fromEntries(MAP_MODS.map((m) => [m.id, m]));

function hitTotal(off: Offense): number {
  let t = 0;
  for (const k of Object.keys(off.hit) as DamageType[]) t += off.hit[k];
  return t;
}

// Scale every damage type of a hit by `mul` (new Offense, pure).
function scaleHit(off: Offense, mul: number): Offense {
  const hit: DamageBundle = { ...off.hit };
  for (const k of Object.keys(hit) as DamageType[]) hit[k] = Math.round(hit[k] * mul);
  return { ...off, hit };
}

// ─────────────────────────────────────────────────────────────────────────────
// rollMapMods — pick a random subset of the catalog for a map instance. Higher
// tiers roll MORE mods (more danger, more loot), 0..3. Pure given rng. The caller
// (expedition) stores the returned ids and re-hydrates via MAP_MOD_BY_ID when it
// generates monsters + tallies loot. `totalLootMult` folds a mod list's loot bonuses.
// ─────────────────────────────────────────────────────────────────────────────

export function rollMapMods(tier: number, rng: () => number): MapMod[] {
  const t = Math.max(1, Math.min(MAX_MAP_TIER, Math.round(tier)));
  // How many mods this map carries: T1-4 → up to 1, T5-9 → up to 2, T10+ → up to 3.
  const cap = t >= 10 ? 3 : t >= 5 ? 2 : 1;
  const count = 1 + Math.floor(rng() * cap); // 1..cap mods (a map always has ≥1)
  const pool = [...MAP_MODS];
  const picked: MapMod[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

// The combined loot multiplier of a set of rolled mods (1 + Σ each mod's loot bonus).
// The expedition multiplies this into `mapTier(tier).loot` for the map's total yield.
export function totalLootMult(mods: MapMod[]): number {
  let m = 1;
  for (const mod of mods) m += mod.loot ?? 0;
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// genMonster — THE monster factory. (region, floor, tier, rng, mapMods) → a
// `Fighter` for rpg-combat.autoBattle. It re-reads the region's enemyBase/
// enemyGrowth/theme/bossEvery (the P5 promise in rpg.ts) into the 5-element combat
// shape: a phys/elemental Offense + a Life/ES/armour/evasion/res Defenses that scale
// with floor (enemyGrowth) and tier (mapTier.diff). Bosses on region.bossEvery
// floors get a stat spike + the region's boss name. Every rolled mapMod is folded
// on top (life/damage/armour/added-element). Pure given rng.
// ─────────────────────────────────────────────────────────────────────────────

// A monster's split of its raw damage into phys + the region's theme element. "phys"
// regions stay 100% phys; elemental regions put ~55% on their element, 45% phys, so a
// hero can't fully wall a region with one resistance.
function themedHit(theme: StageTheme, total: number): DamageBundle {
  const hit = zeroBundle();
  if (theme === "phys") {
    hit.phys = total;
    return hit;
  }
  const elem = THEME_ELEM[theme];
  hit[elem] = Math.round(total * 0.55);
  hit.phys = total - hit[elem];
  return hit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monster archetypes — the PoE role each pool entry (rpg.ts Stage.enemies) tags a
// name with. genMonster picks one kind per non-boss floor and folds its archetype
// onto the region base: a swarmer trades life+armour for speed, a brute the reverse,
// a caster brings a small ES bar + extra ailments, a glass cannon hits hard and dies fast.
// Most fields are a MULTIPLIER over the region base (so archetypes are region-agnostic and
// scale with floor/tier for free). `evasionFlat` is the exception — a FLAT, UNSCALED evasion
// value: dodge% (evasion/(evasion+55), capped 0.6) is inherently scale-free, and there is no
// hero-accuracy stat to scale against, so a depth-scaled evasion would march to the cap and
// make deep skirmishers un-hittable. 10 ≈ a constant ~15% dodge at every depth.
//
// TUNING (drift-tested, do not eyeball): the deviations are DELIBERATELY small because armour
// (DR curve), evasion (dodge) and ES all buy hidden effective-HP that a naive life×damage×speed
// budget can't see — an early bold table (brute 1.7 life ×1.7 armour) made every region ~30 pts
// harder for the hero. These numbers hold a reference hero panel's per-region win-rate within
// ~4 pts of the all-normal baseline. rpg.test.ts guards it with an effective-THREAT metric that
// folds DR/dodge/ES in (not raw stats). `normal` is the identity profile → reproduces the
// pre-archetype monster exactly.
// ─────────────────────────────────────────────────────────────────────────────

export interface Archetype {
  tag: string; // shown after the name in the battle log, e.g. "bầy đàn"
  life: number; // × region base hp
  damage: number; // × region raw per-hit
  speed: number; // × the tier-derived attack speed
  armour: number; // × region base def (phys mitigation)
  evasionFlat?: number; // FLAT (unscaled) evasion → a fixed dodge% at every depth
  crit?: number; // + added crit chance
  esFrac?: number; // fraction of life minted as an ES buffer (a caster's arcane second bar)
  ailmentMul?: number; // × the region's signature-ailment chance
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  normal: { tag: "", life: 1.0, damage: 1.0, speed: 1.0, armour: 1.0 },
  brute: { tag: "hộ vệ", life: 1.18, damage: 0.95, speed: 0.88, armour: 1.1 },
  swarmer: { tag: "bầy đàn", life: 0.85, damage: 0.92, speed: 1.25, armour: 0.9 },
  skirmisher: { tag: "né tránh", life: 0.9, damage: 0.95, speed: 1.08, armour: 0.88, evasionFlat: 10 },
  caster: { tag: "pháp sư", life: 0.9, damage: 1.04, speed: 0.97, armour: 0.92, crit: 0.02, esFrac: 0.05, ailmentMul: 1.15 },
  glasscannon: { tag: "sát thủ", life: 0.8, damage: 1.22, speed: 1.05, armour: 0.8, crit: 0.06 },
};

export function genMonster(
  region: Stage,
  floor: number,
  tier: number,
  rng: () => number,
  mapMods: MapMod[] = [],
): Fighter {
  const base = region.enemyBase;
  const boss = floor > 0 && floor % region.bossEvery === 0;

  // Pick this floor's monster KIND from the region pool (name + combat archetype). A boss
  // is the region's fixed nemesis on the `normal` shape (then spiked below); a normal floor
  // rolls one kind uniformly and its archetype reshapes the region base into a distinct role.
  const kind = region.enemies[Math.floor(rng() * region.enemies.length)];
  const arch = ARCHETYPES[boss ? "normal" : kind?.archetype ?? "normal"];

  // Floor scaling: polynomial (floorDifficultyMul — anchored to the region's enemyGrowth), on
  // TWO curves — a steep one for the monster's durability and a shallow one for its damage (see
  // LIFE_POW/DMG_POW). Tier scaling (mapTier.diff) multiplies both. They coincide at the anchor
  // floor, so early play is untouched and the split only opens up with depth.
  const tierMul = mapTier(tier).diff;
  const scale = floorDifficultyMul(region.enemyGrowth, floor, LIFE_POW) * tierMul; // life/armour/res
  const dmgScale = floorDifficultyMul(region.enemyGrowth, floor, DMG_POW) * tierMul; // the hit

  // Boss spike — fatter life, harder hits, a touch more armour/res, and a name. The DAMAGE
  // spike also grows with depth: a floor-10 boss is a speed bump, a floor-300 one is a wall
  // you prepare for. Capped so it stays a spike rather than an execution — rpg-combat's
  // MAX_HIT_FRAC still guarantees it can never one-shot from full, so this reads as "this
  // fight drains me fast" instead of "I died with no counterplay".
  const bossLife = boss ? 3.2 : 1;
  const bossDmg = boss ? 1.7 + Math.min(1.3, floor * 0.004) : 1;
  const bossArmour = boss ? 1.5 : 1;

  const life = Math.max(1, Math.round(base.hp * scale * bossLife * arch.life));
  // A boss keeps its quarter-life ES bar; a caster archetype mints its own smaller buffer.
  const energyShield = boss ? Math.round(life * 0.25) : Math.round(life * (arch.esFrac ?? 0));

  const armour = Math.max(0, Math.round(base.def * scale * bossArmour * arch.armour));
  // Evasion is FLAT (unscaled): dodge% = evasion/(evasion+55) is scale-free, and there's no
  // hero-accuracy stat to scale against, so a depth-scaled evasion would hit the 0.6 cap and
  // make deep skirmishers un-hittable. base.eva is 0 in every region, so this IS the evasion.
  const evasion = Math.max(0, Math.round(base.eva * scale + (arch.evasionFlat ?? 0)));
  // Per-element resistance grows slowly with depth+tier off the region's flat `res` seed,
  // capped well under RES_CAP so a hero's damage always lands. The region's OWN theme
  // element gets a little extra (a fire region's fiends shrug off some fire).
  const resBase = Math.min(0.5, base.res * 0.01 + (scale - 1) * 0.02);
  const themeElem = region.theme === "phys" ? null : THEME_ELEM[region.theme];
  const res: Record<Elem, number> = {
    fire: resBase,
    cold: resBase,
    light: resBase,
    chaos: Math.max(0, resBase - 0.1), // chaos res is scarce on monsters (PoE convention)
  };
  if (themeElem) res[themeElem] = Math.min(RES_CAP, resBase + 0.2);

  const def: Defenses = { life, energyShield, armour, evasion, res };

  // Raw per-hit damage off the atk seed, on the SHALLOW curve, split by the region's theme element.
  const rawHit = Math.max(1, Math.round(base.atk * dmgScale * bossDmg * arch.damage));
  const hit = themedHit(region.theme, rawHit);

  // Crit + speed carry off the base block; bosses crit a touch harder. Speed gets a light
  // tier nudge so deep maps out-tempo an under-levelled hero, then the archetype scales it.
  const crit = Math.min(0.6, base.crit + (boss ? 0.03 : 0) + (arch.crit ?? 0));
  const critMulti = base.critDmg + (boss ? 0.2 : 0);
  const speed = (1 + Math.min(0.6, (tierMul - 1) * 0.5)) * arch.speed;

  // Ailment threat: an elemental region's monsters can inflict their signature ailment,
  // tilted by the archetype (a caster inflicts more) and capped so it never fully locks a hero.
  const ailMul = arch.ailmentMul ?? 1;
  const ailment: Offense["ailment"] = {};
  if (region.theme === "fire") ailment.ignite = boss ? 0.4 : 0.2;
  else if (region.theme === "cold") ailment.freeze = boss ? 0.3 : 0.15;
  else if (region.theme === "light") ailment.shock = boss ? 0.4 : 0.2;
  else if (region.theme === "chaos") ailment.poison = boss ? 0.4 : 0.2;
  else ailment.bleed = boss ? 0.35 : 0.15; // phys region → bleed
  for (const k of Object.keys(ailment) as Ailment[]) ailment[k] = Math.min(0.8, (ailment[k] ?? 0) * ailMul);

  const off: Offense = { hit, crit, critMulti, speed, ailment };

  // Name: boss → the region nemesis; else the rolled kind + its archetype tag ("Goblin (bầy đàn)").
  const label = boss
    ? `👑 ${region.boss}`
    : `${kind?.name ?? region.name}${arch.tag ? ` (${arch.tag})` : ""}`;

  let fighter: Fighter = { name: label, def, off };

  // Fold every rolled map modifier on top (life/damage/armour/added-element…).
  for (const mod of mapMods) {
    if (mod.mutate) fighter = mod.mutate(fighter);
  }
  return fighter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor kinds — what a floor IS, before we ask who lives there. Without them a run is one
// unbroken conveyor of "fight a monster", and hundreds of floors pass without a single
// decision. Kinds give the walk a rhythm: most floors are still a fight, but a chest, a
// shrine or an elite lands often enough that no two stretches feel the same.
//
// The first few floors stay plain on purpose — a brand-new hero should meet the basic
// loop before it starts throwing variants at them.
// ─────────────────────────────────────────────────────────────────────────────

export type FloorKind = "normal" | "elite" | "chest" | "shrine" | "event" | "boss";

export const PLAIN_UNTIL = 5; // floors 1..5 are always a straight fight

// Per-floor odds of each NON-plain kind, as a table rather than a chain of literals: the
// wiki (src/wiki.ts) publishes these exact numbers to players, so a rate the engine rolls
// and a rate the wiki prints can never disagree. Whatever is left over is a plain fight.
export const FLOOR_KIND_ODDS: { kind: Exclude<FloorKind, "normal" | "boss">; chance: number }[] = [
  { kind: "elite", chance: 0.12 },
  { kind: "chest", chance: 0.07 },
  { kind: "shrine", chance: 0.06 },
  { kind: "event", chance: 0.06 },
];

// Rolled once per floor by the expedition. Boss milestones win outright (they are the
// region's pacing spine and the Trạm Dịch cadence rides on them). Pure given rng.
export function floorKind(region: Stage, floor: number, rng: () => number): FloorKind {
  if (isBossFloor(region, floor)) return "boss";
  if (floor <= PLAIN_UNTIL) return "normal";
  let r = rng();
  for (const odds of FLOOR_KIND_ODDS) {
    if (r < odds.chance) return odds.kind;
    r -= odds.chance;
  }
  return "normal";
}

// ─────────────────────────────────────────────────────────────────────────────
// Elite affixes — the "mini-boss with a gimmick" layer. Each affix asks a DIFFERENT
// question of a build (can you burst? can you sustain? is your damage in many small
// hits or one big one?), so an elite is answered by HOW you built rather than by
// whether your numbers happen to be bigger. Mechanics ride the rpg-effects registry,
// so none of this touches the combat loop.
// ─────────────────────────────────────────────────────────────────────────────

export interface EliteAffix {
  id: string;
  name: string;
  emoji: string;
  blurb: string; // shown in the run log so the player learns what beat them
  fx: EffectRef;
}

export const ELITE_AFFIXES: EliteAffix[] = [
  { id: "taisinh", name: "Tái Sinh", emoji: "💚", blurb: "hồi 12% máu mỗi hiệp — giết chậm là không giết nổi", fx: { id: "regen", mag: 0.12 } },
  { id: "giapgai", name: "Giáp Gai", emoji: "🌵", blurb: "phản 25% sát thương mỗi đòn — đánh nhiều đòn nhỏ là tự thương", fx: { id: "thorns", mag: 0.25 } },
  { id: "voday", name: "Vỏ Dày", emoji: "🪨", blurb: "giảm 45% sát thương khi còn trên nửa máu — cần đòn nặng", fx: { id: "hardened", mag: 0.45 } },
  { id: "cuongno", name: "Cuồng Nộ", emoji: "😤", blurb: "dưới 40% máu thì +60% sát thương — càng thoi thóp càng nguy hiểm", fx: { id: "frenzy", mag: 0.6 } },
];

// An elite is a normal monster made meaningfully tankier + harder-hitting, then handed one
// affix. The stat bump has to be large enough that the fight LASTS, because every affix here
// is a mechanic that only expresses itself over several rounds — regen out-healing your DPS,
// thorns punishing many small hits, frenzy turning on below 40% life. Measured at 2.2×/1.25×,
// elites died inside the same one or two rounds as a trash monster and killed nobody across
// 272 recorded fights: the affix never got a turn to matter. The loot bump pays for the risk.
export const ELITE_LIFE = 3.4;
export const ELITE_DAMAGE = 1.75;
export const ELITE_LOOT = 3; // yield multiplier the expedition pays for clearing one

// Promote a monster to elite with the given affix (pure — returns a new Fighter).
export function makeElite(fighter: Fighter, affix: EliteAffix): Fighter {
  const hit: DamageBundle = { ...fighter.off.hit };
  for (const k of Object.keys(hit) as DamageType[]) hit[k] = Math.round(hit[k] * ELITE_DAMAGE);
  return {
    ...fighter,
    name: `${affix.emoji} ${fighter.name} [${affix.name}]`,
    def: { ...fighter.def, life: Math.max(1, Math.round(fighter.def.life * ELITE_LIFE)) },
    off: { ...fighter.off, hit },
    fx: [...(fighter.fx ?? []), affix.fx],
  };
}

// Pick this floor's affix. Pure given rng.
export function rollEliteAffix(rng: () => number): EliteAffix {
  return ELITE_AFFIXES[Math.floor(rng() * ELITE_AFFIXES.length)] ?? ELITE_AFFIXES[0]!;
}

// Convenience: elements used by a region (its theme element, or none for phys). Handy
// for panels that want to hint "quái ở đây thiên về Hỏa". Pure.
export function regionElement(region: Stage): Elem | null {
  return region.theme === "phys" ? null : THEME_ELEM[region.theme];
}
