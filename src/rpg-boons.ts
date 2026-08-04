// ÂN HUỆ — the per-run build layer. PURE (no Discord, no I/O, no ledger).
//
// The problem this exists to solve: a hero's power was decided entirely BEFORE a run
// started (gear, tree, gems), so every expedition with the same character played out
// identically and there was nothing to decide once underway. Ân huệ move part of the
// build INTO the run: at each Trạm Dịch the player picks 1 of 3, the pick lasts only
// for that expedition, and the combination is different every time.
//
// Design rules for the catalog:
//   • Most carry a real COST, so a pick is a decision and not just a free upgrade.
//   • NONE of them touch max life. The expedition rebuilds the hero each floor with
//     `life` = current hp against a frozen `combat.maxLife` (which the one-shot cap and
//     the flask heal both key off), so a boon that moved the ceiling would desync all
//     three. Costs are expressed as damage-taken / armour / speed instead.
//   • Behavioural ones reuse the rpg-effects registry rather than inventing mechanics.
//
// The expedition owns which boons are held; this module only says what they DO.

import type { EffectRef } from "./rpg-effects";
import type { Fighter } from "./rpg-combat";

export interface Boon {
  id: string;
  name: string;
  emoji: string;
  blurb: string; // player-facing, states the cost too — a pick should never surprise
  mutate?: (f: Fighter) => Fighter; // reshape the hero for the rest of the run
  fx?: EffectRef; // behavioural mechanic, dispatched by rpg-combat
  loot?: number; // + this fraction of loot yield
  heal?: number; // + this fraction of max life, healed between floors
}

// Scale a hero's whole hit bundle (every damage type) by one multiplier.
function scaleHit(f: Fighter, mul: number): Fighter {
  const hit = { ...f.off.hit };
  for (const k of Object.keys(hit) as (keyof typeof hit)[]) hit[k] = Math.round(hit[k] * mul);
  return { ...f, off: { ...f.off, hit } };
}

export const BOONS: Boon[] = [
  {
    id: "cuonghuyet",
    name: "Cuồng Huyết",
    emoji: "🩸",
    blurb: "+35% sát thương, nhưng nhận thêm 15% sát thương",
    mutate: (f) => {
      const boosted = scaleHit(f, 1.35);
      return { ...boosted, def: { ...boosted.def, moreTaken: (boosted.def.moreTaken ?? 0) + 0.15 } };
    },
  },
  {
    id: "khientotien",
    name: "Khiên Tổ Tiên",
    emoji: "🛡️",
    blurb: "25% cơ hội đỡ trọn một đòn",
    fx: { id: "block", mag: 0.25 },
  },
  {
    id: "thamlam",
    name: "Tham Lam",
    emoji: "💰",
    blurb: "+45% chiến lợi phẩm, nhưng nhận thêm 20% sát thương",
    loot: 0.45,
    mutate: (f) => ({ ...f, def: { ...f.def, moreTaken: (f.def.moreTaken ?? 0) + 0.2 } }),
  },
  {
    id: "sacben",
    name: "Sắc Bén",
    emoji: "🗡️",
    blurb: "+18% tỉ lệ chí mạng và +35% sát thương chí mạng",
    mutate: (f) => ({ ...f, off: { ...f.off, crit: Math.min(0.95, f.off.crit + 0.18), critMulti: f.off.critMulti + 0.35 } }),
  },
  {
    id: "suoinguon",
    name: "Suối Nguồn",
    emoji: "💚",
    blurb: "hồi thêm 7% máu tối đa sau mỗi tầng",
    heal: 0.07,
  },
  {
    id: "thantoc",
    name: "Thần Tốc",
    emoji: "⚡",
    blurb: "+25% tốc đánh",
    mutate: (f) => ({ ...f, off: { ...f.off, speed: f.off.speed * 1.25 } }),
  },
  {
    id: "hutmau",
    name: "Hút Máu",
    emoji: "🧛",
    blurb: "hồi 8% sát thương gây ra thành máu",
    fx: { id: "lifeLeech", mag: 0.08 },
  },
  {
    id: "ketlieu",
    name: "Kết Liễu",
    emoji: "🎯",
    blurb: "hạ gục ngay mục tiêu còn dưới 12% máu",
    fx: { id: "culling", mag: 0.12 },
  },
  {
    id: "dada",
    name: "Da Đá",
    emoji: "🪨",
    blurb: "+60% giáp, nhưng −12% tốc đánh",
    mutate: (f) => ({
      ...f,
      def: { ...f.def, armour: Math.round(f.def.armour * 1.6) },
      off: { ...f.off, speed: Math.max(0.5, f.off.speed * 0.88) },
    }),
  },
  {
    id: "khangthe",
    name: "Kháng Thể",
    emoji: "🔮",
    blurb: "+12% kháng mọi nguyên tố",
    mutate: (f) => ({
      ...f,
      def: {
        ...f.def,
        res: {
          fire: f.def.res.fire + 0.12,
          cold: f.def.res.cold + 0.12,
          light: f.def.res.light + 0.12,
          chaos: f.def.res.chaos + 0.12,
        },
      },
    }),
  },
  {
    id: "menhthu",
    name: "Mệnh Thú",
    emoji: "🐺",
    blurb: "hồi 10% máu tối đa mỗi khi hạ được kẻ địch",
    fx: { id: "onKillHeal", mag: 0.1 },
  },
  {
    id: "notham",
    name: "Nộ Thâm",
    emoji: "🔥",
    blurb: "+55% sát thương, nhưng −35% giáp",
    mutate: (f) => {
      const boosted = scaleHit(f, 1.55);
      return { ...boosted, def: { ...boosted.def, armour: Math.round(boosted.def.armour * 0.65) } };
    },
  },
];

export const BOON_BY_ID: Record<string, Boon> = Object.fromEntries(BOONS.map((b) => [b.id, b]));

// Offer `count` distinct boons the player does not already hold. Pure given rng. When the
// pool runs dry (a very deep run holding nearly everything) the offer simply shrinks —
// duplicates would be a dead pick.
export function rollBoonOffer(held: string[], rng: () => number, count = 3): string[] {
  const pool = BOONS.filter((b) => !held.includes(b.id)).map((b) => b.id);
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

// Fold every held boon onto the hero Fighter. Applied fresh each floor by the expedition
// (the hero is rebuilt per floor anyway), so this must stay pure and order-independent
// enough that re-applying never compounds — each mutate reads the CURRENT fighter and
// returns a new one, and the expedition always starts from the frozen snapshot.
export function applyBoons(hero: Fighter, held: string[]): Fighter {
  let out = hero;
  const fx: EffectRef[] = [...(hero.fx ?? [])];
  for (const id of held) {
    const boon = BOON_BY_ID[id];
    if (!boon) continue;
    if (boon.mutate) out = boon.mutate(out);
    if (boon.fx) fx.push(boon.fx);
  }
  return fx.length === (hero.fx?.length ?? 0) ? out : { ...out, fx };
}

// Total extra loot multiplier from held boons (1 = none).
export function boonLootMul(held: string[]): number {
  let mul = 1;
  for (const id of held) mul += BOON_BY_ID[id]?.loot ?? 0;
  return mul;
}

// Extra between-floor healing from held boons, as a fraction of max life.
export function boonHealFrac(held: string[]): number {
  let frac = 0;
  for (const id of held) frac += BOON_BY_ID[id]?.heal ?? 0;
  return frac;
}
