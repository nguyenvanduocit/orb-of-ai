// Auras & Curses — PoE's reserved-buff auras + the enemy-debuffing curse. PURE (no
// Discord, no I/O, no ledger). Two independent loadout slices tied to the character:
//
//   AURAS — a small set of standing self-buffs the hero runs. Each is a themed
//   Partial<RawBuild> slice folded into the build accumulator (rpg-build.ts) exactly
//   like an ascendancy's `effects` or a utility flask's `buff`. A hero runs up to
//   AURA_SLOTS at once (PoE's reservation cap, minified to a flat slot count).
//
//   CURSES — a single hex laid on the ENEMY. Each is a pure mutator over the monster's
//   `Fighter` (same shape as a MapMod in rpg-maps.ts), applied to every floor's monster
//   at combat time. One curse equipped at a time (PoE's "one curse limit" default).
//
// New aura / curse = a new catalog entry — nothing else to touch. The build folds auras,
// the expedition folds the curse; both survive a Tái Sinh (the loadout is the character's).

import type { RawBuild } from "./rpg-build";
import { RES_CAP, type Fighter } from "./rpg-combat";

// ─────────────────────────────────────────────────────────────────────────────
// Auras — standing self-buffs. `effects` is a RawBuild slice (same vocabulary a
// gear mod / ascendancy uses), folded into the accumulator up to AURA_SLOTS.
// ─────────────────────────────────────────────────────────────────────────────

// Auras RESERVE Spirit. There is no slot count any more: how many auras a hero runs is
// decided entirely by how much Spirit they have (baseSpirit from levelling + the scarce
// gear affix), which turns "run a third aura" into a gearing goal. Costs are flat numbers
// scaled to usefulness — the three elemental damage auras are the strongest single-stat
// swing in the game and are priced accordingly.
export interface AuraDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  spirit: number; // Spirit reserved while this aura is active
  effects: Partial<RawBuild>; // the standing build slice this aura contributes
}

// Seven PoE-classic auras, one per offence/defence axis so any build finds two that fit.
// Numbers sit around a strong gear-mod's worth — meaningful but not build-warping alone.
export const AURAS: AuraDef[] = [
  // The three offence auras carry an ailment RIDER matched to their element, so the pick is
  // "element + on-hit effect" (a real second axis), not just "match my damage type" — feeding
  // the ailment build path that support-gem drops now unlock.
  {
    id: "hatred",
    name: "Hatred",
    emoji: "❄️",
    blurb: "+35% sát thương Băng · +8% cơ Freeze — hào quang giá lạnh phủ vũ khí.",
    spirit: 35,
    effects: { elePct: { cold: 0.35 }, ailment: { freeze: 0.08 } },
  },
  {
    id: "wrath",
    name: "Wrath",
    emoji: "⚡",
    blurb: "+35% sát thương Sét · +10% cơ Shock — sấm sét chực chờ trong mỗi đòn.",
    spirit: 35,
    effects: { elePct: { light: 0.35 }, ailment: { shock: 0.1 } },
  },
  {
    id: "anger",
    name: "Anger",
    emoji: "🔥",
    blurb: "+35% sát thương Lửa · +10% cơ Ignite — cơn thịnh nộ bốc cháy quanh hero.",
    spirit: 35,
    effects: { elePct: { fire: 0.35 }, ailment: { ignite: 0.1 } },
  },
  {
    id: "determination",
    name: "Determination",
    emoji: "🛡️",
    blurb: "+40% Giáp — lì đòn vật lý, đứng vững giữa bầy quái.",
    spirit: 25,
    effects: { armourPct: 0.4 },
  },
  {
    id: "grace",
    name: "Grace",
    emoji: "💨",
    blurb: "+40% Né — lướt qua đòn đánh như bóng ma.",
    spirit: 25,
    effects: { evasionPct: 0.4 },
  },
  {
    id: "discipline",
    name: "Discipline",
    emoji: "🔷",
    blurb: "+45% Khiên Năng Lượng — lớp đệm ES dày thêm hẳn.",
    spirit: 28,
    effects: { esPct: 0.45 },
  },
  {
    id: "precision",
    name: "Precision",
    emoji: "🎯",
    blurb: "+5% chí mạng & +25% sát thương chí mạng — mỗi đòn nhắm chuẩn hơn.",
    spirit: 30,
    effects: { crit: 0.05, critMulti: 0.25 },
  },
];

export const AURA_BY_ID: Record<string, AuraDef> = Object.fromEntries(AURAS.map((a) => [a.id, a]));

// The auras actually RUNNING: walk the equipped list in order and keep each one the hero
// can still afford, skipping any that would overrun the Spirit budget. Order matters, so a
// player controls priority by the order they equip. Pure — the caller (effectiveBuild) folds
// each `effects` slice and reports the reservation.
export function equippedAuras(auraIds: string[] | undefined, spirit: number): AuraDef[] {
  const out: AuraDef[] = [];
  const seen = new Set<string>();
  let left = spirit;
  for (const id of auraIds ?? []) {
    const def = AURA_BY_ID[id];
    if (!def || seen.has(id)) continue;
    if (def.spirit > left) continue; // can't afford it — a cheaper later aura still may fit
    seen.add(id);
    left -= def.spirit;
    out.push(def);
  }
  return out;
}

// Total Spirit reserved by a set of running auras.
export function reservedSpirit(auras: AuraDef[]): number {
  return auras.reduce((n, a) => n + a.spirit, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Curses — a hex laid on the enemy. Each `mutate` is a pure monster-Fighter mutator
// (same contract as rpg-maps.ts's MapMod.mutate). `applyCurse` folds the equipped
// curse onto a generated monster each floor. One curse equipped at a time.
// ─────────────────────────────────────────────────────────────────────────────

export interface CurseDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  mutate: (f: Fighter) => Fighter; // reshape the cursed monster (res/damage/speed…)
}

// Lower a monster's three elemental resistances by `amount` (can go below 0 → the hero's
// elemental hits over-penetrate). Returns a new Fighter (pure/immutable).
function lowerEleRes(f: Fighter, amount: number): Fighter {
  return {
    ...f,
    def: {
      ...f.def,
      res: {
        fire: Math.min(RES_CAP, f.def.res.fire - amount),
        cold: Math.min(RES_CAP, f.def.res.cold - amount),
        light: Math.min(RES_CAP, f.def.res.light - amount),
        chaos: f.def.res.chaos,
      },
    },
  };
}

// Scale every damage type of the monster's hit by `mul` (new Fighter, pure).
function scaleMonsterHit(f: Fighter, mul: number): Fighter {
  const hit = { ...f.off.hit };
  for (const k of Object.keys(hit) as (keyof typeof hit)[]) hit[k] = Math.round(hit[k] * mul);
  return { ...f, off: { ...f.off, hit } };
}

// Five PoE-classic curses, each a pure debuff on the monster Fighter.
export const CURSES: CurseDef[] = [
  {
    id: "eleweakness",
    name: "Elemental Weakness",
    emoji: "🔻",
    blurb: "Kẻ địch −25% kháng Lửa/Băng/Sét — đòn nguyên tố xuyên sâu hơn hẳn.",
    mutate: (f) => lowerEleRes(f, 0.25),
  },
  {
    id: "vulnerability",
    name: "Vulnerability",
    emoji: "💥",
    blurb: "Kẻ địch nhận +20% MỌI sát thương — vết thương phơi bày trần trụi.",
    mutate: (f) => ({ ...f, def: { ...f.def, moreTaken: (f.def.moreTaken ?? 0) + 0.2 } }),
  },
  {
    id: "enfeeble",
    name: "Enfeeble",
    emoji: "🦴",
    blurb: "Kẻ địch −25% sát thương gây ra — đòn đánh yếu ớt, run rẩy.",
    mutate: (f) => scaleMonsterHit(f, 0.75),
  },
  {
    id: "tempchains",
    name: "Temporal Chains",
    emoji: "⏳",
    blurb: "Kẻ địch −30% tốc đánh — thời gian trói chân, ra đòn chậm chạp.",
    mutate: (f) => ({ ...f, off: { ...f.off, speed: Math.max(0.5, f.off.speed * 0.7) } }),
  },
  {
    id: "despair",
    name: "Despair",
    emoji: "☠️",
    blurb: "Kẻ địch −25% kháng Chaos & nhận +15% sát thương — tuyệt vọng bào mòn.",
    mutate: (f) => ({
      ...f,
      def: {
        ...f.def,
        res: { ...f.def.res, chaos: Math.min(RES_CAP, f.def.res.chaos - 0.25) },
        moreTaken: (f.def.moreTaken ?? 0) + 0.15,
      },
    }),
  },
];

export const CURSE_BY_ID: Record<string, CurseDef> = Object.fromEntries(CURSES.map((c) => [c.id, c]));

// Apply the equipped curse (by id) to a monster Fighter — the expedition calls this on
// every floor's generated monster. An empty/unknown id returns the Fighter unchanged
// (forward-safe against a removed catalog entry). Pure.
export function applyCurse(fighter: Fighter, curseId: string | undefined): Fighter {
  if (!curseId) return fighter;
  const def = CURSE_BY_ID[curseId];
  return def ? def.mutate(fighter) : fighter;
}
