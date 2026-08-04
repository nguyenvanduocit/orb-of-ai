// Ascendancy subclasses — PoE's build-defining second class choice, minified. PURE (no
// Discord, no I/O, no ledger). Each class picks ONE of two ascendancies; the choice folds a
// themed stat slice into the build (a Partial<RawBuild>) plus at most one KEYSTONE — a
// mechanic the plain stat vocabulary can't express (elemental penetration, a global
// more-damage/more-damage-taken swing, freeze immunity). Keystones are tiny flags the build
// layer (rpg-build.ts) reads and threads into the two combat shapes; the combat core
// (rpg-combat.ts) applies them. New ascendancy = a new entry here — nothing else to touch.
//
// Ascendancy is tied to the CLASS, which persists across a Tái Sinh (prestige), so the choice
// survives applyPrestige. It's re-pickable freely once unlocked (a mind-change, not a sink).

import type { RawBuild } from "./rpg-build";
import type { ClassId } from "./rpg";
import type { Elem } from "./rpg-combat";
import type { EffectRef } from "./rpg-effects";

// The keystone half — the mechanics the flat RawBuild slice can't say. All optional; an
// ascendancy carries at most one or two. Read by effectiveBuild (rpg-build.ts):
//   pen        → Offense.pen (elemental penetration — cuts the target's res, can go < 0).
//   moreMulti  → a global ×(1+m) MORE multiplier on the resolved hit (multiplicative, stacks
//                after every additive %). Berserker's aggro upside.
//   moreTaken  → a global ×(1+m) MORE multiplier on damage the hero TAKES. Berserker's cost.
//   fx         → behavioural EffectRefs (rpg-effects.ts) granted to the hero — freeze immunity,
//                life leech, block, on-kill recovery, culling, … Each is data (id + magnitude),
//                dispatched by the combat core's hook points. New mechanic = a new EffectRef,
//                no combat-loop change.
export interface AscendancyKeystone {
  pen?: Partial<Record<Elem, number>>;
  moreMulti?: number; // e.g. 0.25 = deal 25% MORE damage
  moreTaken?: number; // e.g. 0.15 = take 15% MORE damage
  fx?: EffectRef[]; // behavioural effects (rpg-effects.ts)
}

export interface AscendancyDef {
  id: string;
  cls: ClassId;
  name: string;
  emoji: string;
  blurb: string;
  keystoneName: string; // the keystone's short flavour title (rendered on the panel)
  keystoneText: string; // one line describing what the keystone does
  effects: Partial<RawBuild>; // the themed stat slice folded into the build
  keystone: AscendancyKeystone; // the mechanical half (empty {} if pure-stat)
}

// Exactly 2 per class (6 total). Numbers sit around a strong notable-cluster's worth of a
// single identity — a real power spike that defines the build, not a full second character.
export const ASCENDANCIES: AscendancyDef[] = [
  // ─── 🛡️ Warrior (chien) ──────────────────────────────────────────────────────
  {
    id: "juggernaut",
    cls: "chien",
    name: "Juggernaut",
    emoji: "🦾",
    blurb: "Cỗ xe tăng bất khả xâm phạm — máu dày, giáp cứng, kháng nguyên tố.",
    keystoneName: "Bất Khuất",
    keystoneText: "🧊 Miễn nhiễm Freeze + 🛡️ 20% đỡ trọn đòn (block) — bức tường không thể lay chuyển.",
    effects: { lifePct: 0.4, armourPct: 0.6, resFire: 0.1, resCold: 0.1, resLight: 0.1 },
    keystone: { fx: [{ id: "freezeImmune", mag: 1 }, { id: "block", mag: 0.2 }] },
  },
  {
    id: "berserker",
    cls: "chien",
    name: "Berserker",
    emoji: "🔥",
    blurb: "Cuồng chiến đổi mạng lấy sát thương — đánh nhanh, chí mạng nặng, liều mạng.",
    keystoneName: "Cuồng Nộ",
    keystoneText: "⚔️ +25% sát thương & 🩸 hút 8% máu từ sát thương gây ra, NHƯNG nhận +18% sát thương — đao kề cổ.",
    effects: { atkPct: 0.5, speedPct: 0.15, crit: 0.05, critMulti: 0.3 },
    keystone: { moreMulti: 0.25, moreTaken: 0.18, fx: [{ id: "lifeLeech", mag: 0.08 }] },
  },
  // ─── 🔮 Sorceress (phap) ─────────────────────────────────────────────────────
  {
    id: "elementalist",
    cls: "phap",
    name: "Elementalist",
    emoji: "🌈",
    blurb: "Bậc thầy tam nguyên tố — lửa/băng/sét bùng nổ, dễ gây hiệu ứng.",
    keystoneName: "Xuyên Nguyên Tố",
    keystoneText: "🔺 Xuyên 20% kháng Lửa/Băng/Sét của kẻ địch (bỏ qua phòng ngự nguyên tố).",
    effects: {
      elePct: { fire: 0.35, cold: 0.35, light: 0.35 },
      ailment: { ignite: 0.25, shock: 0.25, freeze: 0.25 },
    },
    keystone: { pen: { fire: 0.2, cold: 0.2, light: 0.2 } },
  },
  {
    id: "occultist",
    cls: "phap",
    name: "Occultist",
    emoji: "🕷️",
    blurb: "Pháp sư hỗn mang — khiên năng lượng dày, sát thương phép & hỗn mang cao.",
    keystoneName: "Hư Không",
    keystoneText: "☠️ +40% ST Chaos, +20% kháng Chaos & 💚 hồi 12% máu mỗi khi hạ gục — nuốt chửng linh hồn.",
    effects: { esPct: 0.6, spellPct: 0.4, elePct: { chaos: 0.4 }, resChaos: 0.2, addChaos: 12 },
    keystone: { fx: [{ id: "onKillHeal", mag: 0.12 }] },
  },
  // ─── 🏹 Ranger (cung) ────────────────────────────────────────────────────────
  {
    id: "deadeye",
    cls: "cung",
    name: "Deadeye",
    emoji: "🎯",
    blurb: "Xạ thủ thần sầu — đòn nhanh, chí mạng bội, mũi tên không trượt.",
    keystoneName: "Mắt Đại Bàng",
    keystoneText: "💥 +50% ST chí mạng & 🎯 chặt hạ ngay mục tiêu còn ≤12% máu (culling) — không nhân nhượng.",
    effects: { atkPct: 0.4, speedPct: 0.2, crit: 0.06, critMulti: 0.5 },
    keystone: { fx: [{ id: "culling", mag: 0.12 }] },
  },
  {
    id: "pathfinder",
    cls: "cung",
    name: "Pathfinder",
    emoji: "🧪",
    blurb: "Kẻ lữ hành tẩm độc — né cao, lướt nhanh, mũi tên rỉ độc.",
    keystoneName: "Nọc Độc",
    keystoneText: "☠️ +60% cơ hội gây Poison — đòn độc ăn mòn theo thời gian.",
    effects: { evasionPct: 0.5, speedPct: 0.15, addChaos: 8, ailment: { poison: 0.6 } },
    keystone: {},
  },
];

export const ASCENDANCY_BY_ID: Record<string, AscendancyDef> = Object.fromEntries(
  ASCENDANCIES.map((a) => [a.id, a]),
);

// The 2 ascendancies available to a class, in catalog order.
export function ascendanciesForClass(cls: ClassId): AscendancyDef[] {
  return ASCENDANCIES.filter((a) => a.cls === cls);
}

// The chosen ascendancy for a profile, ONLY if it's valid for the class (a class-swap can't
// happen, but a corrupt/stale id is ignored — forward-safe). Null if none chosen or invalid.
export function chosenAscendancy(cls: ClassId, ascendancyId: string | undefined): AscendancyDef | null {
  if (!ascendancyId) return null;
  const def = ASCENDANCY_BY_ID[ascendancyId];
  return def && def.cls === cls ? def : null;
}
