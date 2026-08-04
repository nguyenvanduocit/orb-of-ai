// Combat EFFECTS — the generic, data-driven mechanic layer. PURE (no Discord/I/O). This is
// what makes the battle engine extensible: a "mechanic" (life leech, block, on-kill recovery,
// culling, ailment immunity, …) is ONE entry in the EFFECTS registry, not a new branch welded
// into the round loop. A Fighter carries `fx: EffectRef[]` — plain serialisable data (id + a
// magnitude), safe to freeze into PvP snapshots / in-flight expedition JSON — and rpg-combat
// dispatches the matching hooks at fixed points in the fight.
//
// Effects never touch rpg-combat's private runtime. They see a combatant only through the
// small `FxUnit` view (hp / maxLife / heal / damage / status guard) and mutate an in-flight
// hit only through `HitView`. That decoupling is the whole point: adding a mechanic can't
// destabilise the loop, and the loop never grows a new `if` per mechanic.
//
// Determinism: hooks run in `fx` array order and only draw rng when their effect is present,
// so a fighter with no fx consumes rng identically to the pre-effects engine (behaviour is
// preserved bit-for-bit for all existing content — verified by the drift sim).

import type { DamageBundle } from "./rpg-combat";

// A combatant as an effect sees it — enough to heal/execute/inspect, nothing more.
export interface FxUnit {
  name: string;
  hp: number; // current Life (mutate via heal/damage, not directly)
  maxLife: number;
  heal(n: number): void; // recover Life, clamped to maxLife
  damage(n: number): void; // lose Life (bypasses ES/mitigation — a raw drain)
  hasStatus(id: string): boolean;
}

// The in-flight hit, mutable by outgoing/incoming hooks BEFORE mitigation resolves.
export interface HitView {
  bundle: DamageBundle; // per-type damage of this hit (pre-mitigation)
  crit: boolean;
  negated: boolean; // set true to fully avoid the hit (block / parry)
  moreDealt: number; // += a MORE multiplier as the attacker (0.2 = +20% more)
  moreTaken: number; // += a MORE multiplier as the defender
}

export interface FxCtx {
  rng: () => number;
  log: string[];
}

// A mechanic = the subset of these hooks it implements. `mag` is the effect's magnitude
// (the number in the EffectRef), so one registry entry serves every tier of the same mechanic.
export interface EffectHooks {
  // As the ATTACKER, reshape the outgoing hit (more damage, added, conversion…).
  outgoing?(hit: HitView, self: FxUnit, foe: FxUnit, mag: number, ctx: FxCtx): void;
  // As the DEFENDER, reshape the incoming hit (block → negate, fortify → less taken…).
  incoming?(hit: HitView, self: FxUnit, foe: FxUnit, mag: number, ctx: FxCtx): void;
  // After the hit's damage lands: self = attacker, dmg = damage dealt (leech, culling…).
  onHitLanded?(self: FxUnit, foe: FxUnit, dmg: number, mag: number, ctx: FxCtx): void;
  // The attacker just killed the foe (on-kill recovery, rampage…).
  onKill?(self: FxUnit, foe: FxUnit, mag: number, ctx: FxCtx): void;
  // Start of each of self's rounds (regen, decaying buffs…).
  onRoundStart?(self: FxUnit, foe: FxUnit, mag: number, ctx: FxCtx): void;
  // Gate a status about to be applied to self — return false to block it (immunity).
  statusGuard?(status: string, mag: number): boolean;
}

// Every effect the game can express. New mechanic = a new id here + a registry entry below +
// (optionally) a producer that grants it. NOTHING in rpg-combat changes.
export type EffectId =
  | "freezeImmune"
  | "lifeLeech"
  | "block"
  | "onKillHeal"
  | "culling"
  // Elite-monster affixes (rpg-maps ELITE_AFFIXES). Each one asks a DIFFERENT question of a
  // build, which is the point: an elite should be answered by how you built, not by whether
  // your numbers are bigger. All four are STATELESS — they read only current hp/maxLife, so
  // they need no per-fight bookkeeping and stay safe to freeze into expedition JSON.
  | "regen"
  | "thorns"
  | "hardened"
  | "frenzy";

// The data a Fighter carries. `mag` meaning is per-effect (leech fraction, block chance, …).
export interface EffectRef {
  id: EffectId;
  mag: number;
  status?: string; // optional target (e.g. which status an immunity guards)
}

export const EFFECTS: Record<EffectId, EffectHooks> = {
  // Juggernaut's Bất Khuất — can never suffer a Freeze (and, generically, any named status
  // this ref guards; defaults to freeze).
  freezeImmune: {
    statusGuard: (status) => status !== "freeze",
  },

  // Life leech — recover `mag` fraction of the damage this hit dealt (Berserker's blood price).
  lifeLeech: {
    onHitLanded: (self, _foe, dmg, mag) => self.heal(Math.round(dmg * mag)),
  },

  // Block — `mag` chance to fully negate an incoming hit. Draws rng ONLY when present, so it
  // never perturbs the no-fx rng stream.
  block: {
    incoming: (hit, self, _foe, mag, ctx) => {
      if (!hit.negated && ctx.rng() < mag) {
        hit.negated = true;
        ctx.log.push(`🛡️ ${self.name} đỡ trọn đòn (block)`);
      }
    },
  },

  // On-kill recovery — heal `mag` fraction of max Life when you drop the foe (Occultist sustain).
  onKillHeal: {
    onKill: (self, _foe, mag, ctx) => {
      const heal = Math.round(self.maxLife * mag);
      self.heal(heal);
      ctx.log.push(`💚 ${self.name} hồi ${heal} máu sau khi hạ mục tiêu`);
    },
  },

  // Culling Strike — execute a foe left at or below `mag` of its max Life after a hit
  // (Deadeye's finisher). A no-rng, deterministic threshold.
  culling: {
    onHitLanded: (_self, foe, _dmg, mag, ctx) => {
      if (foe.hp > 0 && foe.hp <= foe.maxLife * mag) {
        foe.damage(foe.hp); // drain the sliver → dead
        ctx.log.push(`🎯 ${foe.name} bị chặt hạ (culling ≤${Math.round(mag * 100)}%)`);
      }
    },
  },

  // ── Elite affixes ───────────────────────────────────────────────────────────
  // Tái Sinh — heals `mag` of max life every round. A pure DPS CHECK: out-damage the
  // regen or the fight never ends (combat's MAX_ROUNDS eventually calls it on HP).
  regen: {
    onRoundStart: (self, _foe, mag) => self.heal(Math.round(self.maxLife * mag)),
  },

  // Giáp Gai — reflects `mag` of an incoming hit's raw damage back at the attacker. Taxes
  // MANY-SMALL-HITS builds (attack speed) far more than one big hit, so it is the natural
  // counter-question to a speed build. Sums the bundle inline rather than importing
  // bundleTotal — rpg-combat imports THIS module, so a value import would be a cycle.
  thorns: {
    incoming: (hit, self, foe, mag, ctx) => {
      if (hit.negated) return;
      let raw = 0;
      for (const t of Object.keys(hit.bundle) as (keyof typeof hit.bundle)[]) raw += hit.bundle[t];
      const back = Math.round(raw * mag);
      if (back <= 0) return;
      foe.damage(back);
      ctx.log.push(`🌵 ${self.name} phản ${back} sát thương lên ${foe.name}`);
    },
  },

  // Vỏ Dày — takes `mag` LESS damage while above half life. Rewards burst (blow through the
  // threshold in one hit) and punishes chip damage. Stateless: reads current hp only.
  hardened: {
    incoming: (hit, self, _foe, mag) => {
      if (self.hp > self.maxLife * 0.5) hit.moreTaken -= mag;
    },
  },

  // Cuồng Nộ — deals `mag` MORE damage once below 40% life. A wounded elite is the dangerous
  // one, so "almost dead" stops being a safe place to coast.
  frenzy: {
    outgoing: (hit, self, _foe, mag) => {
      if (self.hp < self.maxLife * 0.4) hit.moreDealt += mag;
    },
  },
};

// Whether EVERY effect on `refs` permits a status to land (all guards must agree). Used by the
// combat core before applying an ailment.
export function statusAllowed(refs: EffectRef[] | undefined, status: string): boolean {
  if (!refs) return true;
  for (const ref of refs) {
    const guard = EFFECTS[ref.id]?.statusGuard;
    if (guard && !guard(status, ref.mag)) return false;
  }
  return true;
}
