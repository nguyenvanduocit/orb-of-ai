// The BUILD layer — PURE (no Discord, no I/O, no ledger). This is where the whole
// PoE-style character is folded into the two combat shapes the sim fights with:
// an `Offense` (what one hit does) + `Defenses` (how hits land). It sits ON TOP of
// the four green modules (rpg-combat, rpg-skills, rpg-passives) and rpg.ts's item
// layer, and is the ONE place the class base + level growth + every equipped gear
// item + the allocated passive tree + flask buffs are summed.
//
// The accumulation happens in a flat additive struct — `RawBuild` — where every
// contributor just adds its slice (class base, per-level growth, gear stats,
// passive mods, flask buffs). Only at the very end are the additive numbers turned
// into finals (life×(1+lifePct), weaponDamage = atk×(1+atkPct), …) and handed to
// resolveOffense / assembled into Defenses. Same functional-core split as the rest
// of the RPG: this module reasons, the shell (expeditions/commands) owns the store.

import {
  ELEMS,
  RES_CAP,
  MAX_HIT_FRAC,
  powerOf,
  zeroBundle,
  type Ailment,
  type DamageBundle,
  type DamageType,
  type Defenses,
  type Elem,
  type Offense,
} from "./rpg-combat";
import { resolveOffense, skillManaCost, type ManaCost, type SkillContext } from "./rpg-skills";
import { aggregatePassives, passiveFx } from "./rpg-passives";
import { baseSpirit, gearStats, GEAR_SLOTS, PERKS, ascendancyUnlocked, type ClassId, type GearItem, type GearSlot, type RpgProfile } from "./rpg";
import { chosenAscendancy, type AscendancyKeystone } from "./rpg-ascendancy";
import { equippedAuras, reservedSpirit, type AuraDef } from "./rpg-auras";
import type { EffectRef } from "./rpg-effects";
import { addMod, incMoreOf, newBag, resolve, type ModBag, type Stat } from "./rpg-mods";

// ─────────────────────────────────────────────────────────────────────────────
// RawBuild — the readable AUTHORING DIALECT catalogs are written in (a `life`/`lifePct`
// pair, `elePct`, `ailment`…). It is the authoring surface only: `foldRaw` maps each slice
// into the generic ModBag (rpg-mods.ts), where `X`+`Xpct` collapse into one stat's base +
// increased layers and a `more` layer joins them. Keeping the dialect means gear/passive/
// aura/ascendancy catalogs stay legible while the resolution engine underneath is generic.
// ─────────────────────────────────────────────────────────────────────────────

export interface RawBuild {
  // Defence pools + their % scalars.
  life: number;
  lifePct: number;
  es: number; // energy shield
  esPct: number;
  armour: number;
  armourPct: number;
  evasion: number;
  evasionPct: number;
  // Elemental + chaos resistances (flat fractions, 0..1; capped to RES_CAP at the end
  // for the three elements, chaos stays uncapped-ish per gear terms).
  resFire: number;
  resCold: number;
  resLight: number;
  resChaos: number;
  // Offence bases + their % scalars — atk feeds ATTACK skills, spell feeds SPELL skills.
  atk: number; // weapon / attack base damage (flat)
  atkPct: number;
  spell: number; // spell power (flat)
  spellPct: number;
  // Flat added damage of each type, threaded into the skill's hit as SkillContext.addedFlat.
  addPhys: number;
  addFire: number;
  addCold: number;
  addLight: number;
  addChaos: number;
  // +% damage of a given element, applied to the resolved hit per-element at the end.
  elePct: Partial<Record<Elem, number>>;
  // Crit + speed — crit/critMulti are additive onto the bases (0.05 / 1.5), speed is a base.
  crit: number; // flat added crit chance
  critMulti: number; // flat added onto the base 1.5
  speed: number; // base attacks per round
  speedPct: number;
  // + ailment chance, merged into the resolved offense's per-hit ailment map.
  ailment: Partial<Record<Ailment, number>>;
  // Resource pools — Spirit reserves auras, Mana + regen pay for swings.
  spirit: number;
  mana: number;
  manaPct: number;
  manaRegen: number;
}

// Base crit chance / multiplier / attacks-per-round every hero starts from (before the
// class block, gear, and tree add onto them). The skill gem adds its own baseCrit on top.
const BASE_CRIT = 0.05;
const BASE_CRIT_MULTI = 1.5;
const BASE_SPEED = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// CLASS_BUILD — the three archetypes re-expressed in PoE terms. `base` is the
// level-1 contribution, `growth` is added per level beyond 1. These replace the old
// Stats-based CLASSES base/growth; the class name/emoji/skill flavour stays in rpg.ts.
//   Chiến Binh — high life + armour + attack, low ES/crit (the bruiser).
//   Pháp Sư    — ES + spell + crit, low life/armour (the glass caster).
//   Cung Thủ   — evasion + attack + crit + speed (the nimble striker).
// Mana is a fourth axis: Pháp Sư carries the deepest pool and best regen (spells cost the
// most), Chiến Binh the shallowest — so "how many supports can I actually fuel" differs by
// class before a single item drops.
// Level-1 numbers land near the old block (life ~80-120, atk ~14-22) so early
// floors clear and scaling stays smooth.
// ─────────────────────────────────────────────────────────────────────────────

export const CLASS_BUILD: Record<ClassId, { base: Partial<RawBuild>; growth: Partial<RawBuild> }> = {
  // The %-scalars (lifePct/atkPct/…) are the per-level "increased" growth: foldRaw scales them
  // by steps=level-1, so they multiply the WHOLE pool (flat growth + gear) — this is what keeps
  // a level-up felt to the cap (a bare flat +life/level is a shrinking % of a large geared pool).
  // Kept modest (~0.006 → +29% at L50) and matched to each class's identity; compounds with
  // gear/passives/perks, so re-check PvP bracket + BXH sanity when tuning up.
  chien: {
    base: { life: 120, armour: 20, atk: 16, resFire: 0.02, resCold: 0.02, resLight: 0.02, mana: 40, manaRegen: 5 },
    growth: { life: 24, armour: 4, atk: 3, lifePct: 0.006, armourPct: 0.006, atkPct: 0.005, mana: 3, manaRegen: 0.25 },
  },
  phap: {
    base: { life: 78, es: 40, spell: 20, crit: 0.05, critMulti: 0.1, resFire: 0.02, resCold: 0.02, resLight: 0.02, mana: 75, manaRegen: 7 },
    growth: { life: 13, es: 8, spell: 4.5, esPct: 0.006, spellPct: 0.006, lifePct: 0.004, mana: 6, manaRegen: 0.4 },
  },
  cung: {
    base: { life: 92, evasion: 30, atk: 15, crit: 0.08, speed: 0.1, resFire: 0.02, resCold: 0.02, resLight: 0.02, mana: 55, manaRegen: 6 },
    growth: { life: 17, evasion: 5, atk: 3.5, crit: 0.002, atkPct: 0.006, evasionPct: 0.005, lifePct: 0.004, mana: 4.5, manaRegen: 0.3 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Flasks — PoE's consumable buffs. MINIFIED: a hero carries a small set of flask
// instances; between floors the LIFE flask heals a % of max life, and the UTILITY
// flasks contribute a flat build buff for the whole expedition (kept simple — a
// standing buff, not a timed charge economy). New flask = a new catalog entry.
// ─────────────────────────────────────────────────────────────────────────────

export interface FlaskDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  healPct?: number; // life flask: restores this fraction of max life between floors
  buff?: Partial<RawBuild>; // utility flask: a standing contribution folded into the build
  cleanse?: boolean; // clears ailments on use (flavour flag the expedition may read)
}

export const FLASKS: FlaskDef[] = [
  {
    id: "binhmau", name: "Life Flask", emoji: "🧪", healPct: 0.06,
    blurb: "Hồi 6% máu tối đa giữa các tầng.",
  },
  {
    id: "binhgiap", name: "Granite Flask", emoji: "🛡️", buff: { armourPct: 0.25 },
    blurb: "+25% giáp suốt chuyến đi.",
  },
  {
    id: "binhne", name: "Quicksilver Flask", emoji: "💨", buff: { evasionPct: 0.2, speedPct: 0.08 },
    blurb: "+20% né & +8% tốc đánh suốt chuyến đi.",
  },
  {
    id: "binhthanhtay", name: "Cleansing Flask", emoji: "🌿", cleanse: true,
    blurb: "Giải hiệu ứng bất lợi (ignite/poison/bleed) khi dùng.",
  },
];

export const FLASK_BY_ID: Record<string, FlaskDef> = Object.fromEntries(FLASKS.map((f) => [f.id, f]));

export interface FlaskInstance {
  defId: string;
}

// The life-flask heal a hero gets between floors = the biggest healPct among carried
// flasks × maxLife. Returns the flat HP to restore (0 if no life flask). Pure.
export function flaskHeal(flasks: FlaskInstance[], maxLife: number): number {
  let best = 0;
  for (const fi of flasks) {
    const def = FLASK_BY_ID[fi.defId];
    if (def?.healPct && def.healPct > best) best = def.healPct;
  }
  return Math.round(maxLife * best);
}

// Whether any carried flask cleanses ailments (the expedition can quaff it to shed DoTs).
export function flaskCleanses(flasks: FlaskInstance[]): boolean {
  return flasks.some((fi) => FLASK_BY_ID[fi.defId]?.cleanse);
}

// ─────────────────────────────────────────────────────────────────────────────
// ModBag folding — every contributor is authored in the readable RawBuild dialect
// (a `life`/`lifePct` pair, `elePct`, `ailment`…) and mapped into the generic ModBag
// (rpg-mods.ts) where `X`+`Xpct` collapse into one stat's base+increased layers and a
// `more` layer becomes available to any producer. `foldRaw` is the ONE bridge, so a new
// stat is a key here + one resolve at finalise. Numbers are preserved exactly — the bag
// resolves each contribution to the same value the old flat accumulator did.
// ─────────────────────────────────────────────────────────────────────────────

// RawBuild flat/pct field → (Stat, layer). `X` feeds base, `Xpct` feeds increased.
const RAW_BASE: Partial<Record<keyof RawBuild, Stat>> = {
  life: "life", es: "es", armour: "armour", evasion: "evasion", atk: "atk", spell: "spell",
  addPhys: "addPhys", addFire: "addFire", addCold: "addCold", addLight: "addLight", addChaos: "addChaos",
  crit: "crit", critMulti: "critMulti", speed: "speed",
  resFire: "resFire", resCold: "resCold", resLight: "resLight", resChaos: "resChaos",
  spirit: "spirit", mana: "mana", manaRegen: "manaRegen",
};
const RAW_INC: Partial<Record<keyof RawBuild, Stat>> = {
  lifePct: "life", esPct: "es", armourPct: "armour", evasionPct: "evasion", atkPct: "atk", spellPct: "spell", speedPct: "speed",
  manaPct: "mana",
};
const DMG_STAT: Record<Elem, Stat> = { fire: "dmgFire", cold: "dmgCold", light: "dmgLight", chaos: "dmgChaos" };
const ADD_STAT: Record<DamageType, Stat> = { phys: "addPhys", fire: "addFire", cold: "addCold", light: "addLight", chaos: "addChaos" };
const AIL_STAT: Record<Ailment, Stat> = { ignite: "ailIgnite", shock: "ailShock", freeze: "ailFreeze", poison: "ailPoison", bleed: "ailBleed" };

// Fold a RawBuild-dialect slice into the bag, scaled by `scale` (used for per-level growth).
function foldRaw(bag: ModBag, raw: Partial<RawBuild>, scale = 1): void {
  for (const k of Object.keys(RAW_BASE) as (keyof RawBuild)[]) {
    const v = raw[k];
    if (typeof v === "number" && v) addMod(bag, RAW_BASE[k]!, { base: v * scale });
  }
  for (const k of Object.keys(RAW_INC) as (keyof RawBuild)[]) {
    const v = raw[k];
    if (typeof v === "number" && v) addMod(bag, RAW_INC[k]!, { inc: v * scale });
  }
  if (raw.elePct) for (const e of Object.keys(raw.elePct) as Elem[]) { const v = raw.elePct[e]; if (v) addMod(bag, DMG_STAT[e], { inc: v * scale }); }
  if (raw.ailment) for (const a of Object.keys(raw.ailment) as Ailment[]) { const v = raw.ailment[a]; if (v) addMod(bag, AIL_STAT[a], { base: v * scale }); }
}

// Class block: base + (level-1) copies of its per-level growth.
function foldClass(bag: ModBag, cls: ClassId, level: number): void {
  const cb = CLASS_BUILD[cls];
  foldRaw(bag, cb.base);
  const steps = Math.max(0, level - 1);
  if (steps > 0) foldRaw(bag, cb.growth, steps);
}

// The allocated passive tree (its PassiveMods bundle) → bag. Same vocabulary, different field
// names, so it gets its own thin mapping rather than routing through the RawBuild dialect.
function foldPassives(bag: ModBag, pm: ReturnType<typeof aggregatePassives>): void {
  addMod(bag, "life", { inc: pm.lifePct });
  addMod(bag, "es", { inc: pm.esPct });
  addMod(bag, "armour", { inc: pm.armourPct });
  addMod(bag, "evasion", { inc: pm.evasionPct });
  addMod(bag, "atk", { inc: pm.atkPct });
  addMod(bag, "spell", { inc: pm.spellPct });
  addMod(bag, "crit", { base: pm.critChance });
  addMod(bag, "critMulti", { base: pm.critMulti });
  addMod(bag, "speed", { inc: pm.speedPct });
  addMod(bag, "resFire", { base: pm.resAll });
  addMod(bag, "resCold", { base: pm.resAll });
  addMod(bag, "resLight", { base: pm.resAll });
  addMod(bag, "resChaos", { base: pm.resAll + pm.resChaos });
  for (const e of Object.keys(pm.elePct) as Elem[]) addMod(bag, DMG_STAT[e], { inc: pm.elePct[e] ?? 0 });
  for (const t of Object.keys(pm.addedFlat) as DamageType[]) addMod(bag, ADD_STAT[t], { base: pm.addedFlat[t] ?? 0 });
  for (const a of Object.keys(pm.ailmentChance) as Ailment[]) addMod(bag, AIL_STAT[a], { base: pm.ailmentChance[a] ?? 0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// effectiveBuild — THE fold. Class base+growth → every equipped gear item's stat
// contribution → the allocated passive tree → carried flask buffs, all summed into
// one RawBuild, then turned into the final Offense + Defenses + a power scalar.
// ─────────────────────────────────────────────────────────────────────────────

export interface EffectiveBuild {
  off: Offense;
  def: Defenses;
  fx: EffectRef[]; // behavioural effects (rpg-effects.ts) the Fighter carries into combat
  power: number;
  raw: ModBag; // the resolved modifier bag (base/inc/more per stat) — handy for panels/debug
  // Spirit: the aura budget. `running` is what actually fits inside `total`.
  spirit: { total: number; reserved: number; running: AuraDef[] };
  // Mana: the per-swing fuel. `off` is the supported skill and costs `cost.full`; when the
  // pool can't pay that, combat falls back to `basicOff` at `cost.base` (see rpg-combat).
  mana: { max: number; regen: number; cost: ManaCost };
  basicOff: Offense; // the same skill with no supports linked
}

export function effectiveBuild(profile: RpgProfile): EffectiveBuild {
  const bag = newBag();
  addMod(bag, "crit", { base: BASE_CRIT });
  addMod(bag, "critMulti", { base: BASE_CRIT_MULTI });
  addMod(bag, "speed", { base: BASE_SPEED });

  // 1) Class base + per-level growth.
  foldClass(bag, profile.cls, profile.level);

  // 2) Every equipped gear item's contribution (a Partial<Record<StatId, number>> slice).
  for (const item of Object.values(profile.gear)) {
    if (item) foldRaw(bag, gearStats(item));
  }

  // 3) The allocated passive tree.
  foldPassives(bag, aggregatePassives(profile.passives ?? []));

  // 4) Utility flask standing buffs.
  for (const fi of profile.flasks ?? []) {
    const def = FLASK_BY_ID[fi.defId];
    if (def?.buff) foldRaw(bag, def.buff);
  }

  // 4b) Running auras (rpg-auras.ts). Auras RESERVE Spirit, so the budget has to be known
  // before we know which ones run — hence this sits after gear/tree/flasks (every spirit
  // source) and before the aura slices fold in. No aura grants spirit, so there is no
  // circularity here.
  const spiritTotal = baseSpirit(profile.level) + Math.max(0, Math.round(resolve(bag, "spirit")));
  const running = equippedAuras(profile.auras, spiritTotal);
  for (const aura of running) foldRaw(bag, aura.effects);

  // 5) Cổ Ngọc perks — permanent MORE multipliers on the attack + life pools. The `more`
  // layer is now first-class: any producer can grant "X% more", not just this perk.
  addMod(bag, "atk", { more: PERKS.atk.step * (profile.perks?.atk ?? 0) });
  addMod(bag, "life", { more: PERKS.hp.step * (profile.perks?.hp ?? 0) });

  // 6) Ascendancy (subclass) — only once unlocked. Its stat slice folds in like any other
  // contributor; its KEYSTONE (pen / more-damage / more-taken / behavioural fx) is threaded
  // into the finalised Offense/Defenses below.
  const asc = ascendancyUnlocked(profile) ? chosenAscendancy(profile.cls, profile.ascendancy) : null;
  if (asc) foldRaw(bag, asc.effects);

  return finalize(bag, profile, asc?.keystone ?? null, spiritTotal, running);
}

// Turn the additive accumulator into the combat shapes. Offense is built through the
// skill layer (weaponDamage/spellPower/crit/speed/addedFlat context), then the per-
// element %damage is multiplied onto the resolved hit and raw ailments merged in.
function finalize(
  bag: ModBag,
  profile: RpgProfile,
  keystone: AscendancyKeystone | null,
  spiritTotal: number,
  running: AuraDef[],
): EffectiveBuild {
  const addedFlat: DamageBundle = zeroBundle();
  addedFlat.phys = resolve(bag, "addPhys");
  addedFlat.fire = resolve(bag, "addFire");
  addedFlat.cold = resolve(bag, "addCold");
  addedFlat.light = resolve(bag, "addLight");
  addedFlat.chaos = resolve(bag, "addChaos");

  const ctx: SkillContext = {
    weaponDamage: resolve(bag, "atk"), // base × (1 + increased atk) × more atk
    spellPower: resolve(bag, "spell"),
    crit: resolve(bag, "crit"),
    critMulti: resolve(bag, "critMulti"),
    speed: resolve(bag, "speed"),
    addedFlat,
  };

  const bare: Offense = { hit: zeroBundle(), crit: ctx.crit, critMulti: ctx.critMulti, speed: Math.max(0.5, ctx.speed), ailment: {} };
  let off: Offense = bare;
  // The same skill resolved WITHOUT supports — the swing a mana-starved hero falls back to.
  let basicOff: Offense = bare;
  let cost: ManaCost = { full: 0, base: 0 };
  if (profile.skillGem) {
    off = resolveOffense(profile.skillGem, profile.supports ?? [], ctx);
    basicOff = resolveOffense(profile.skillGem, [], ctx);
    cost = skillManaCost(profile.skillGem, profile.supports ?? []);
  }

  // +% (and any `more`) damage of each element lands on the resolved hit, per element.
  for (const e of ELEMS) {
    const mul = incMoreOf(bag, DMG_STAT[e]);
    if (mul !== 1) {
      off.hit[e] *= mul;
      basicOff.hit[e] *= mul;
    }
  }
  // Merge the accumulated (gear/tree/class) ailment chances onto the skill's own.
  const ailment: Partial<Record<Ailment, number>> = { ...off.ailment };
  for (const a of Object.keys(AIL_STAT) as Ailment[]) {
    const v = resolve(bag, AIL_STAT[a]);
    if (v) ailment[a] = (ailment[a] ?? 0) + v;
  }
  off = { ...off, ailment };

  // Ascendancy offense keystones — elemental penetration (Elementalist) + a global MORE
  // damage multiplier (Berserker/Deadeye). Both feed rpg-combat's mitigatedHit.
  if (keystone?.pen) off = { ...off, pen: { ...(off.pen ?? {}), ...keystone.pen } };
  if (keystone?.moreMulti) off = { ...off, moreMulti: (off.moreMulti ?? 0) + keystone.moreMulti };

  const life = Math.max(1, Math.round(resolve(bag, "life")));
  const def: Defenses = {
    life,
    energyShield: Math.max(0, Math.round(resolve(bag, "es"))),
    armour: Math.max(0, Math.round(resolve(bag, "armour"))),
    evasion: Math.max(0, Math.round(resolve(bag, "evasion"))),
    res: {
      fire: Math.min(RES_CAP, resolve(bag, "resFire")),
      cold: Math.min(RES_CAP, resolve(bag, "resCold")),
      light: Math.min(RES_CAP, resolve(bag, "resLight")),
      chaos: Math.min(RES_CAP, resolve(bag, "resChaos")),
    },
    // One-shot protection, pinned to the FULL life pool here (the expedition rebuilds the
    // hero Fighter each floor with `life` set to current hp, so deriving it there would
    // shrink the cap as the hero got hurt). Monsters never get one — hero DPS stays uncapped.
    maxHit: Math.max(1, Math.round(life * MAX_HIT_FRAC)),
    // Ascendancy defense keystone — Berserker's more-damage-taken cost (optional).
    ...(keystone?.moreTaken ? { moreTaken: keystone.moreTaken } : {}),
  };

  // Behavioural effects (freeze immunity, block, leech, on-kill, culling) ride as `fx` data
  // the combat core dispatches — no combat-shape field per mechanic. They come from BOTH the
  // ascendancy keystone AND the passive tree (on-tree leech makes a glass keystone sustainable).
  const fx: EffectRef[] = [...(keystone?.fx ?? []), ...passiveFx(profile.passives ?? [])];

  return {
    off,
    def,
    fx,
    power: powerOf(off, def),
    raw: bag,
    spirit: { total: spiritTotal, reserved: reservedSpirit(running), running },
    mana: {
      max: Math.max(0, Math.round(resolve(bag, "mana"))),
      regen: Math.max(0, Math.round(resolve(bag, "manaRegen"))),
      cost,
    },
    basicOff: { ...basicOff, ailment: { ...basicOff.ailment } },
  };
}

// A hero's max life (finals) — the between-floor heal + panels want it without the
// full Offense/Defenses build. Thin wrapper so the life math lives in one place.
export function buildMaxLife(profile: RpgProfile): number {
  return effectiveBuild(profile).def.life;
}

// Alias kept for callers that used the old name.
export const maxHp = buildMaxLife;

// The single power scalar for BXH + PvP bracketing — the build's finalised power.
export function powerScore(profile: RpgProfile): number {
  return effectiveBuild(profile).power;
}

// ─────────────────────────────────────────────────────────────────────────────
// Best-in-slot auto-equip. For each slot pick the item (from equipped + bag) that
// maximizes build power, equip it, the rest to the bag. Greedy per slot is optimal
// because slots contribute additively. Lives here (not rpg.ts) because it scores with
// the build layer. Pure — the shell saves the returned shapes.
// ─────────────────────────────────────────────────────────────────────────────

export function autoEquipBest(p: RpgProfile): { gear: Partial<Record<GearSlot, GearItem>>; bag: GearItem[]; changed: GearSlot[] } {
  const pool: GearItem[] = [...(Object.values(p.gear).filter(Boolean) as GearItem[]), ...p.bag];
  const gear: Partial<Record<GearSlot, GearItem>> = {};
  const changed: GearSlot[] = [];
  const used = new Set<string>();
  for (const { id: slot } of GEAR_SLOTS) {
    const cands = pool.filter((it) => it.slot === slot);
    if (cands.length === 0) continue;
    let best = cands[0]!;
    let bestPow = effectiveBuild({ ...p, gear: { ...gear, [slot]: best } }).power;
    for (const it of cands.slice(1)) {
      const pow = effectiveBuild({ ...p, gear: { ...gear, [slot]: it } }).power;
      if (pow > bestPow) {
        best = it;
        bestPow = pow;
      }
    }
    gear[slot] = best;
    used.add(best.id);
    if (p.gear[slot]?.id !== best.id) changed.push(slot);
  }
  const bag = pool.filter((it) => !used.has(it.id));
  return { gear, bag, changed };
}
