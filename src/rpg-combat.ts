// PoE2-style combat core — PURE (no Discord, no I/O, no ledger). This is the functional
// heart of the Season-1 rewrite: elemental damage (phys/fire/cold/light/chaos), armour +
// evasion + per-element resistances, ailments (ignite/shock/freeze/poison/bleed), and the
// seeded auto-battle round loop. RNG is always injected (() => number) so a fight is
// reproducible from a seed — same convention as the old fightFloor.
//
// Every hero and monster is reduced to a resolved `Offense` (what one hit does) + `Defenses`
// (how hits land on them) + `fx` (behavioural mechanics — see rpg-effects.ts). The character/
// skill/passive layers build those shapes and hand them here — the same functional-core /
// imperative-shell split as the rest of the RPG. This module knows nothing about gear, gems,
// or the passive tree; it only fights.
//
// EXTENSIBILITY: numeric modifiers live in Offense/Defenses (resolved once by the build layer);
// BEHAVIOURAL mechanics (leech, block, on-kill, culling, immunities, …) are data `EffectRef`s
// dispatched through the EFFECTS registry at the hook points below. Adding a mechanic is a
// registry entry — the round loop never grows a branch. Hooks only draw rng when their effect
// is present, so a fighter with no fx fights bit-for-bit identically to the pre-effects engine.

import {
  EFFECTS,
  statusAllowed,
  type EffectRef,
  type FxCtx,
  type FxUnit,
  type HitView,
} from "./rpg-effects";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Elem = "fire" | "cold" | "light" | "chaos";
export type DamageType = "phys" | Elem;
export const ELEMS: Elem[] = ["fire", "cold", "light", "chaos"];
export const DAMAGE_TYPES: DamageType[] = ["phys", ...ELEMS];

export type Ailment = "ignite" | "shock" | "freeze" | "poison" | "bleed";

// The PoE-English labels the log/panels render (PoE mechanics, bot's own voice).
export const DAMAGE_LABEL: Record<DamageType, { name: string; emoji: string }> = {
  phys: { name: "Physical", emoji: "⚔️" },
  fire: { name: "Fire", emoji: "🔥" },
  cold: { name: "Cold", emoji: "❄️" },
  light: { name: "Lightning", emoji: "⚡" },
  chaos: { name: "Chaos", emoji: "☠️" },
};
export const AILMENT_LABEL: Record<Ailment, { name: string; emoji: string }> = {
  ignite: { name: "Ignite", emoji: "🔥" },
  shock: { name: "Shock", emoji: "⚡" },
  freeze: { name: "Freeze", emoji: "❄️" },
  poison: { name: "Poison", emoji: "☠️" },
  bleed: { name: "Bleed", emoji: "🩸" },
};

export type DamageBundle = Record<DamageType, number>;
export function zeroBundle(): DamageBundle {
  return { phys: 0, fire: 0, cold: 0, light: 0, chaos: 0 };
}
export function bundleTotal(b: DamageBundle): number {
  return b.phys + b.fire + b.cold + b.light + b.chaos;
}

export interface Defenses {
  life: number;
  energyShield: number; // ES buffer — hit BEFORE life, recharges fast (PoE2's second health pool)
  armour: number; // reduces PHYS hits (armour curve, capped)
  evasion: number; // → chance to dodge an incoming hit (capped)
  res: Record<Elem, number>; // 0..RES_CAP fraction; chaos usually lower/uncapped in gear terms
  moreTaken?: number; // ×(1+m) MORE damage taken (Berserker's cost / Vulnerability); undefined = 0
  // One-shot protection: the ABSOLUTE ceiling on a single incoming hit (MAX_HIT_FRAC × max
  // life). Held as a flat number, not a fraction, because `life` carries the hero's CURRENT
  // hp between floors — a fraction of that would shrink as the hero got hurt, capping least
  // exactly when protection matters most. Only heroes carry it; monsters leave it undefined
  // so hero damage stays uncapped and DPS keeps paying.
  maxHit?: number;
}

export interface Offense {
  hit: DamageBundle; // damage of each type in ONE hit (post added/converted, pre-mitigation)
  crit: number; // crit chance 0..1
  critMulti: number; // crit multiplier, e.g. 1.5 = +50%
  speed: number; // hits per round (≥ ~0.5); fractional part = chance of an extra hit
  ailment: Partial<Record<Ailment, number>>; // per-hit chance to inflict each ailment
  pen?: Partial<Record<Elem, number>>; // elemental penetration — subtracts from the target's res (can push it below 0)
  moreMulti?: number; // ×(1+m) MORE damage dealt (Berserker/Deadeye keystone); undefined = 0
}

export interface Fighter {
  name: string;
  def: Defenses;
  off: Offense;
  fx?: EffectRef[]; // behavioural mechanics (rpg-effects.ts) — serialisable data, optional
  // Mana budget. Absent = unlimited (monsters never pay for their swings), so every existing
  // fighter behaves exactly as before. When present, each swing is paid for out of the pool:
  // full price buys the supported skill, the base price buys `basic`, and below that the
  // hero simply cannot swing. This is what stops "link every support" from being free.
  mana?: { max: number; regen: number; cost: { full: number; base: number }; current?: number };
  basic?: Offense; // the same skill with no supports — the mana-starved fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Tunables — the whole combat balance surface
// ─────────────────────────────────────────────────────────────────────────────

export const RES_CAP = 0.75; // max useful elemental resistance
const ARMOUR_K = 120; // phys mitigation: DR = armour / (armour + K)
const ARMOUR_DR_CAP = 0.85;
const EVASION_K = 55; // dodge: chance = evasion / (evasion + K)
const EVASION_CAP = 0.6;

// One-shot protection — the fraction of a hero's MAX life any single hit may take. A hero
// carries `def.maxHit` (see buildDefenses); monsters do not, so the hero's own damage is
// never capped and building DPS still pays. Without a cap, a deep floor's hit lands at >100%
// of the life pool and kills from full HP with no counterplay. With it, dying takes at least
// MAX_HIT_FRAC⁻¹ hits, so a run is lost by attrition the player can see coming (and answer
// with 🧪 potions / retreat).
export const MAX_HIT_FRAC = 0.35;

// Ailment shapes. DoT ailments deal a fraction of the triggering hit's relevant damage per
// round for N rounds; shock amplifies damage taken; freeze skips an action.
// Ailment stacking rules (three distinct identities):
//   • ignite / bleed — ONE instance: the STRONGEST applies, each fresh proc refreshes its
//     duration (and upgrades the magnitude if bigger). fracs bumped up vs the old stacking
//     model so a single instance still bites.
//   • poison — STACKS, but bounded by POISON_MAX_STACKS (was unbounded → a fast attacker
//     piled unlimited full-damage stacks, super-linear with attack speed = OP exploit).
const IGNITE = { frac: 0.5, rounds: 3 }; // % of the fire portion, per round (strongest-only)
const POISON = { frac: 0.3, rounds: 3 }; // % of (phys+chaos), stacks up to POISON_MAX_STACKS
const POISON_MAX_STACKS = 6; // hard cap on concurrent poison stacks — the exploit fence
const BLEED = { frac: 0.55, rounds: 3 }; // % of the phys portion (strongest-only)
const SHOCK = { inc: 0.2, rounds: 3 }; // +20% damage taken while shocked
const FREEZE = { rounds: 1 }; // skip 1 action
const ES_RECHARGE = 0.25; // ES refills this fraction of max per round, ONCE the no-hit delay elapses
const ES_RECHARGE_DELAY = 2; // rounds without taking a HIT before ES starts recharging (PoE "no recent hit")
const MAX_ROUNDS = 80; // safety bound; min-1 damage guarantees a winner well before this
const LOG_TAIL = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Mitigation helpers (pure, exported for tests + display)
// ─────────────────────────────────────────────────────────────────────────────

export function armourDR(armour: number): number {
  if (armour <= 0) return 0;
  return Math.min(ARMOUR_DR_CAP, armour / (armour + ARMOUR_K));
}
export function evadeChance(evasion: number): number {
  if (evasion <= 0) return 0;
  return Math.min(EVASION_CAP, evasion / (evasion + EVASION_K));
}
export function cappedRes(r: number): number {
  return Math.min(RES_CAP, r);
}

// Mitigate a raw damage bundle through a defender's armour (phys) + resistances (elements,
// cut by the attacker's penetration). Returns the pre-multiplier damage sum. Pure — the one
// place the armour/res arithmetic lives, shared by the round loop and `mitigatedHit`.
function mitigate(bundle: DamageBundle, def: Defenses, pen?: Partial<Record<Elem, number>>): number {
  let dmg = 0;
  for (const t of DAMAGE_TYPES) {
    const raw = bundle[t];
    if (!raw) continue;
    if (t === "phys") dmg += raw * (1 - armourDR(def.armour));
    else dmg += raw * (1 - (cappedRes(def.res[t]) - (pen?.[t] ?? 0))); // pen cuts res (can go < 0 → bonus)
  }
  return dmg;
}

// Fold the multiplicative layers onto a mitigated sum: crit × shock × more-dealt × more-taken,
// floored at 1, then clipped by the defender's one-shot protection (`maxHit`, absent on
// monsters). The shared finaliser so the loop and `mitigatedHit` never diverge.
function amplify(base: number, crit: boolean, critMulti: number, shockInc: number, moreDealt: number, moreTaken: number, maxHit?: number): number {
  const critMul = crit ? critMulti : 1;
  const dmg = base * critMul * (1 + shockInc) * (1 + moreDealt) * (1 + moreTaken);
  const capped = maxHit !== undefined ? Math.min(dmg, maxHit) : dmg;
  return Math.max(1, Math.round(capped));
}

// One hit's damage to a defender, post-mitigation (crit rolled here). Kept exported for tests
// + display; the round loop uses the staged pipeline in `strike` so effect hooks can inject.
export function mitigatedHit(off: Offense, def: Defenses, rng: () => number, shockInc = 0): { dmg: number; crit: boolean } {
  const crit = rng() < off.crit;
  const dmg = amplify(mitigate(off.hit, def, off.pen), crit, off.critMulti, shockInc, off.moreMulti ?? 0, def.moreTaken ?? 0, def.maxHit);
  return { dmg, crit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-battle — the seeded round loop
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveDot {
  ail: "ignite" | "poison" | "bleed";
  dmg: number; // per round
  rounds: number;
}
interface RT {
  f: Fighter;
  hp: number; // remaining Life — hitting 0 ends the fight
  es: number; // remaining Energy Shield — absorbs hits before Life
  esMax: number;
  esCd: number; // rounds of "recent hit" left before ES may recharge again (0 = may recharge)
  freeze: number; // rounds of frozen (skips actions)
  shock: number; // rounds of shock remaining
  dots: ActiveDot[];
  fx: EffectRef[]; // behavioural effects (empty when the fighter carries none)
  view: FxUnit; // the effect-facing adapter (built once, reads live runtime state)
  // Telemetry bookkeeping — pure counters, never touch rng or the fight outcome. They
  // record the gross damage THIS fighter received so the tuning log gets per-fight
  // dealt/taken/spike numbers (see CombatResult) without a second combat pass.
  mana: number; // remaining mana (Infinity when the fighter has no mana budget)
  taken: number; // gross damage received (hits + DoTs), pre-ES-absorption
  takenDot: number; // portion of `taken` from DoT ticks
  biggest: number; // biggest single hit received (spike detection)
  evaded: number; // incoming hits this fighter dodged
}

function newRT(f: Fighter): RT {
  const rt: RT = {
    f,
    hp: f.def.life,
    es: f.def.energyShield,
    esMax: f.def.energyShield,
    esCd: 0,
    freeze: 0,
    shock: 0,
    dots: [],
    mana: f.mana ? (f.mana.current ?? f.mana.max) : Infinity,
    fx: f.fx ?? [],
    view: null as unknown as FxUnit,
    taken: 0,
    takenDot: 0,
    biggest: 0,
    evaded: 0,
  };
  rt.view = {
    name: f.name,
    get hp() {
      return rt.hp;
    },
    maxLife: f.def.life,
    heal(n: number) {
      rt.hp = Math.min(f.def.life, rt.hp + Math.max(0, n));
    },
    damage(n: number) {
      rt.hp -= Math.max(0, n);
    },
    hasStatus(id: string) {
      return id === "freeze" ? rt.freeze > 0 : id === "shock" ? rt.shock > 0 : rt.dots.some((d) => d.ail === id);
    },
  };
  return rt;
}

// Route incoming damage through Energy Shield first, then Life (PoE2 layering).
function takeDamage(rt: RT, dmg: number): void {
  if (rt.es > 0) {
    const absorbed = Math.min(rt.es, dmg);
    rt.es -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) rt.hp -= dmg;
}

// ES recharges a fraction of its max each round, but ONLY after ES_RECHARGE_DELAY rounds
// with no incoming HIT (PoE's "no recent hit" gate — DoT ticks don't stop it, only hits do,
// via the esCd reset in strike). So ES is a fast-refilling BUFFER between packs, not a free
// second life pool that heals through sustained fire.
function rechargeEs(rt: RT): void {
  if (rt.esCd > 0) rt.esCd--; // burn down the no-recent-hit timer
  if (rt.esCd === 0 && rt.es < rt.esMax) rt.es = Math.min(rt.esMax, rt.es + rt.esMax * ES_RECHARGE);
}

// Mana ticks back up each round. A fighter with no mana budget sits at Infinity and is
// untouched, so this is a no-op for every monster.
function regenMana(rt: RT): void {
  const budget = rt.f.mana;
  if (!budget) return;
  rt.mana = Math.min(budget.max, rt.mana + budget.regen);
}

export interface CombatResult {
  winner: "a" | "b";
  rounds: number;
  aHpAfter: number;
  bHpAfter: number;
  aCrits: number;
  bCrits: number;
  log: string[];
  // Per-fight telemetry (gross, pre-ES). aTaken = damage A received, so from the hero's
  // seat (hero is always `a`) heroDealt = bTaken, heroTaken = aTaken. Pure bookkeeping —
  // adding these never shifts an outcome. Feeds the tuning log's floor combat summary.
  aTaken: number;
  bTaken: number;
  aTakenDot: number;
  bTakenDot: number;
  aManaAfter: number; // A's remaining mana (Infinity when it has no budget) — carried between floors
  aBiggest: number; // biggest single hit A received (incoming spike)
  bBiggest: number;
  aEvaded: number; // hits A dodged
  bEvaded: number;
}

// How many hits a fighter lands this round from its `speed` (fractional part = chance of the
// extra hit). At least 1 so a fight always progresses.
function hitsThisRound(speed: number, rng: () => number): number {
  const whole = Math.floor(speed);
  const extra = rng() < speed - whole ? 1 : 0;
  return Math.max(1, whole + extra);
}

// Apply a rolled DoT with the correct stacking rule (the fence against the old unbounded
// .push that let a fast attacker pile limitless full-damage DoTs). Draws NO rng — the roll
// already happened at the call site — so the pre-effects rng-consumption invariant holds.
//   • ignite / bleed — ONE instance: strongest magnitude wins, every proc refreshes duration.
//   • poison — STACKS up to POISON_MAX_STACKS; at the cap a bigger proc upgrades the weakest.
function applyDot(target: RT, ail: ActiveDot["ail"], dmg: number, rounds: number): void {
  if (ail === "poison") {
    const stacks = target.dots.filter((d) => d.ail === "poison");
    if (stacks.length < POISON_MAX_STACKS) {
      target.dots.push({ ail, dmg, rounds });
    } else {
      const weakest = stacks.reduce((lo, d) => (d.dmg < lo.dmg ? d : lo));
      if (dmg > weakest.dmg) {
        weakest.dmg = dmg;
        weakest.rounds = rounds;
      }
    }
    return;
  }
  const cur = target.dots.find((d) => d.ail === ail); // ignite / bleed → single instance
  if (cur) {
    if (dmg > cur.dmg) cur.dmg = dmg;
    cur.rounds = rounds; // refresh duration every proc
  } else {
    target.dots.push({ ail, dmg, rounds });
  }
}

// Roll this hit's ailments against the defender and apply them to its runtime state. `portion`
// is the per-type damage of the hit (pre-mitigation) so DoTs scale with the element that
// caused them. Each ailment is gated by the defender's status guards (immunities), which draw
// no rng — so a defender with no immunity fx rolls exactly as the pre-effects engine did.
function applyAilments(attacker: Offense, dmgHit: DamageBundle, target: RT, rng: () => number, log: string[], tname: string): void {
  const a = attacker.ailment;
  const allow = (s: Ailment) => statusAllowed(target.fx, s);
  if (a.ignite && dmgHit.fire > 0 && allow("ignite") && rng() < a.ignite) {
    applyDot(target, "ignite", Math.max(1, Math.round(dmgHit.fire * IGNITE.frac)), IGNITE.rounds);
    log.push(`🔥 ${tname} bị **Ignite**`);
  }
  if (a.poison && dmgHit.phys + dmgHit.chaos > 0 && allow("poison") && rng() < a.poison) {
    applyDot(target, "poison", Math.max(1, Math.round((dmgHit.phys + dmgHit.chaos) * POISON.frac)), POISON.rounds);
  }
  if (a.bleed && dmgHit.phys > 0 && allow("bleed") && rng() < a.bleed) {
    applyDot(target, "bleed", Math.max(1, Math.round(dmgHit.phys * BLEED.frac)), BLEED.rounds);
  }
  if (a.shock && dmgHit.light > 0 && allow("shock") && rng() < a.shock) {
    target.shock = Math.max(target.shock, SHOCK.rounds);
    log.push(`⚡ ${tname} bị **Shock** (+${Math.round(SHOCK.inc * 100)}% ST nhận)`);
  }
  if (a.freeze && dmgHit.cold > 0 && allow("freeze") && rng() < a.freeze) {
    target.freeze = Math.max(target.freeze, FREEZE.rounds);
    log.push(`❄️ ${tname} bị **Freeze** — lỡ 1 lượt`);
  }
}

// Tick a fighter's DoTs at round start (through ES then Life).
function tickDots(rt: RT): void {
  let total = 0;
  for (const d of rt.dots) {
    total += d.dmg;
    d.rounds--;
  }
  rt.dots = rt.dots.filter((d) => d.rounds > 0);
  if (total > 0) {
    takeDamage(rt, total);
    rt.taken += total;
    rt.takenDot += total;
  }
}

// Resolve ONE hit through the staged pipeline: crit → outgoing hooks → incoming hooks →
// mitigation → onHitLanded hooks → ailments. Effect hooks (rpg-effects.ts) inject at the marked
// points; when a fighter carries no fx the pipeline draws rng in the same order (evade already
// rolled by the caller, then crit, then ailments) as the pre-effects engine.
function strike(atk: RT, def: RT, off: Offense, rng: () => number, log: string[], crackCount: { n: number }, ctx: FxCtx): void {
  const hit: HitView = {
    bundle: { ...off.hit },
    crit: rng() < off.crit,
    negated: false,
    moreDealt: off.moreMulti ?? 0,
    moreTaken: def.f.def.moreTaken ?? 0,
  };
  // Attacker reshapes the outgoing hit (more damage, added, conversion…).
  for (const ref of atk.fx) EFFECTS[ref.id]?.outgoing?.(hit, atk.view, def.view, ref.mag, ctx);
  // Defender reshapes the incoming hit (block → negate, fortify → less taken…).
  for (const ref of def.fx) EFFECTS[ref.id]?.incoming?.(hit, def.view, atk.view, ref.mag, ctx);
  if (hit.negated) return; // fully avoided — no damage, no ailments

  const shockInc = def.shock > 0 ? SHOCK.inc : 0;
  const dmg = amplify(mitigate(hit.bundle, def.f.def, off.pen), hit.crit, off.critMulti, shockInc, hit.moreDealt, hit.moreTaken, def.f.def.maxHit);
  if (hit.crit) crackCount.n++;
  takeDamage(def, dmg);
  def.esCd = ES_RECHARGE_DELAY; // a hit landed → restart the no-recent-hit timer (blocks ES recharge)
  def.taken += dmg;
  if (dmg > def.biggest) def.biggest = dmg;
  const shield = def.es > 0 ? ` 🛡️${Math.round(def.es)}` : "";
  log.push(`${hit.crit ? "💥" : "⚔️"} ${atk.f.name} → ${dmg} (${def.f.name} còn ${Math.max(0, Math.round(def.hp))}${shield})`);

  // After the hit lands: attacker effects (leech, culling…) — culling may drop the foe here.
  for (const ref of atk.fx) EFFECTS[ref.id]?.onHitLanded?.(atk.view, def.view, dmg, ref.mag, ctx);
  applyAilments(off, off.hit, def, rng, log, def.f.name);
  if (def.hp <= 0) for (const ref of atk.fx) EFFECTS[ref.id]?.onKill?.(atk.view, def.view, ref.mag, ctx);
}

// One fighter's whole action (all its hits this round) against the defender. Frozen → skip.
function act(atk: RT, def: RT, rng: () => number, log: string[], crackCount: { n: number }, ctx: FxCtx): void {
  if (atk.freeze > 0) {
    atk.freeze--;
    return;
  }
  const hits = hitsThisRound(atk.f.off.speed, rng);
  for (let i = 0; i < hits && def.hp > 0; i++) {
    // Pay for the swing FIRST — an unaffordable swing never happens, so it can't consume an
    // evade roll either (keeping the rng stream identical for mana-less fighters).
    const budget = atk.f.mana;
    let off = atk.f.off;
    if (budget) {
      if (atk.mana >= budget.cost.full) {
        atk.mana -= budget.cost.full;
      } else if (atk.mana >= budget.cost.base) {
        atk.mana -= budget.cost.base;
        off = atk.f.basic ?? atk.f.off; // starved: the bare skill still swings
        log.push(`🔵 ${atk.f.name} thiếu nộ khí — đánh đòn cơ bản`);
      } else {
        log.push(`🔵 ${atk.f.name} cạn nộ khí, lỡ nhịp đánh`);
        continue;
      }
    }
    if (rng() < evadeChance(def.f.def.evasion)) {
      def.evaded++;
      log.push(`💨 ${def.f.name} né đòn ${atk.f.name}`);
      continue;
    }
    strike(atk, def, off, rng, log, crackCount, ctx);
  }
}

function decayShock(rt: RT): void {
  if (rt.shock > 0) rt.shock--;
}

// Resolve a full hero-vs-monster (or hero-vs-hero) fight. `a` strikes first each round. Pure
// given rng. Returns the winner + end HP for both + a tail of the battle log.
export function autoBattle(a: Fighter, b: Fighter, rng: () => number, opts: { maxRounds?: number } = {}): CombatResult {
  const A = newRT(a);
  const B = newRT(b);
  const log: string[] = [];
  const ctx: FxCtx = { rng, log };
  const aCrit = { n: 0 };
  const bCrit = { n: 0 };
  const max = opts.maxRounds ?? MAX_ROUNDS;
  let round = 0;

  while (A.hp > 0 && B.hp > 0 && round < max) {
    round++;
    // Round-start effects (regen, decaying buffs…) then ES recharge + DoT ticks.
    for (const ref of A.fx) EFFECTS[ref.id]?.onRoundStart?.(A.view, B.view, ref.mag, ctx);
    for (const ref of B.fx) EFFECTS[ref.id]?.onRoundStart?.(B.view, A.view, ref.mag, ctx);
    rechargeEs(A);
    rechargeEs(B);
    regenMana(A);
    regenMana(B);
    tickDots(A);
    tickDots(B);
    if (A.hp <= 0 || B.hp <= 0) break;
    act(A, B, rng, log, aCrit, ctx);
    if (B.hp <= 0) break;
    act(B, A, rng, log, bCrit, ctx);
    if (A.hp <= 0) break;
    decayShock(A);
    decayShock(B);
  }

  // min-1 damage guarantees a KO well before max; HP tiebreak is the safety net.
  const winner: "a" | "b" = B.hp <= 0 ? "a" : A.hp <= 0 ? "b" : A.hp >= B.hp ? "a" : "b";
  return {
    winner,
    rounds: round,
    aHpAfter: Math.max(0, Math.round(A.hp)),
    bHpAfter: Math.max(0, Math.round(B.hp)),
    aCrits: aCrit.n,
    bCrits: bCrit.n,
    log: log.slice(-LOG_TAIL),
    aTaken: Math.round(A.taken),
    bTaken: Math.round(B.taken),
    aTakenDot: Math.round(A.takenDot),
    bTakenDot: Math.round(B.takenDot),
    aManaAfter: A.mana,
    aBiggest: Math.round(A.biggest),
    bBiggest: Math.round(B.biggest),
    aEvaded: A.evaded,
    bEvaded: B.evaded,
  };
}

// A single power scalar for BXH + PvP bracketing (not used inside combat). Effective DPS
// (hit × speed × crit expectation) × sqrt(effective life vs an average defence layer).
export function powerOf(off: Offense, def: Defenses): number {
  const perHit = bundleTotal(off.hit) * (1 + off.crit * (off.critMulti - 1));
  const dps = perHit * Math.max(0.5, off.speed);
  const avgRes = (def.res.fire + def.res.cold + def.res.light) / 3;
  const mitig = 1 - (armourDR(def.armour) + cappedRes(avgRes)) / 2;
  const ehp = (def.life + def.energyShield) / (Math.max(0.15, mitig) * (1 - evadeChance(def.evasion)));
  return Math.round((dps * Math.sqrt(Math.max(1, ehp))) / 6);
}
