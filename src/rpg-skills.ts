// Skill gems + support gems — PoE's identity system, PURE (no Discord, no I/O). A character
// equips ONE skill gem (the main attack/spell) and links SUPPORT gems into its sockets; the
// supports modify the skill. `resolveOffense(skill, supports, ctx)` folds everything into the
// `Offense` that rpg-combat.ts fights with. Gems level with use (gem XP), which scales their
// damage. Catalogs are static (new gem = a new entry). The character layer (rpg.ts / P4)
// builds the SkillContext from the profile and owns the gem instances; this module only
// knows gems.

import {
  DAMAGE_TYPES,
  zeroBundle,
  type Ailment,
  type DamageBundle,
  type DamageType,
  type Elem,
  type Offense,
} from "./rpg-combat";

export type SkillTag = "attack" | "spell" | "melee" | "projectile" | "aoe";

export interface SkillGemDef {
  id: string;
  name: string;
  emoji: string;
  kind: "attack" | "spell"; // attack scales off weapon damage; spell off spell power
  tags: SkillTag[];
  effectiveness: number; // damage effectiveness vs the base (1.2 = 120%)
  split: Partial<Record<DamageType, number>>; // damage type fractions (sum ≈ 1)
  baseCrit: number; // the skill's inherent crit chance
  speedMul: number; // multiplier on the character's base attack speed (big hits are slower)
  ailment: Partial<Record<Ailment, number>>; // inherent ailment chances
  perLevel: number; // fractional damage growth per gem level
  sockets: number; // support-gem slots
  manaCost: number; // mana each swing costs BEFORE support multipliers
  blurb: string;
}

export interface SupportGemDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  tagReq?: SkillTag; // only modifies skills carrying this tag
  moreMult?: number; // "more damage" — multiplicative
  addedFlat?: Partial<Record<DamageType, number>>; // flat added damage (scaled by support level)
  critChance?: number;
  critMulti?: number;
  speedMul?: number;
  ailmentAdd?: Partial<Record<Ailment, number>>;
  pen?: Partial<Record<Elem, number>>; // elemental penetration
  noAilment?: boolean; // trades ailments away (Elemental Focus) — cleared after all supports
  convert?: { from: DamageType; to: DamageType; frac: number }; // convert part of one type to another
  manaMult: number; // multiplies the skill's mana cost (PoE's support mana multiplier)
}

export interface SkillGemInstance {
  defId: string;
  level: number; // 1..MAX_GEM_LEVEL
  xp: number; // toward the next level
}
export interface SupportGemInstance {
  defId: string;
  level: number;
  xp: number;
}
export type GemInstance = SkillGemInstance | SupportGemInstance; // shape-identical; the def decides which

// What the character contributes to a skill (built by the char layer in P4).
export interface SkillContext {
  weaponDamage: number; // base damage for ATTACK skills (from weapon + gear atk)
  spellPower: number; // base damage for SPELL skills (from gear/tree)
  crit: number; // character base crit
  critMulti: number; // character base crit multiplier
  speed: number; // character base attacks/round
  addedFlat: DamageBundle; // flat added damage from gear/tree
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogs
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_GEMS: SkillGemDef[] = [
  {
    id: "chemmanh", name: "Heavy Strike", emoji: "🗡️", kind: "attack", tags: ["attack", "melee"],
    effectiveness: 1.15, split: { phys: 1 }, baseCrit: 0.05, speedMul: 0.8, ailment: { bleed: 0.25 }, perLevel: 0.08, manaCost: 16, sockets: 4,
    blurb: "Nhát chém vật lý nặng, chậm mà đau — dễ gây 🩸 Bleed.",
  },
  {
    id: "vubao", name: "Cyclone", emoji: "🌪️", kind: "attack", tags: ["attack", "melee", "aoe"],
    effectiveness: 0.62, split: { phys: 1 }, baseCrit: 0.05, speedMul: 1.5, ailment: {}, perLevel: 0.07, manaCost: 18, sockets: 5,
    blurb: "Xoáy đòn liên hồi — mỗi hiệp ra nhiều nhát, hợp với đánh nhanh & độc.",
  },
  {
    id: "damxuyen", name: "Puncture", emoji: "🏹", kind: "attack", tags: ["attack", "projectile"],
    effectiveness: 0.85, split: { phys: 0.7, chaos: 0.3 }, baseCrit: 0.08, speedMul: 1.1, ailment: { bleed: 0.2, poison: 0.2 }, perLevel: 0.075, manaCost: 15, sockets: 4,
    blurb: "Mũi xuyên Physical + Chaos — chồng 🩸 & ☠️.",
  },
  {
    id: "caulua", name: "Fireball", emoji: "🔥", kind: "spell", tags: ["spell", "projectile"],
    effectiveness: 1.05, split: { fire: 1 }, baseCrit: 0.06, speedMul: 0.95, ailment: { ignite: 0.4 }, perLevel: 0.085, manaCost: 19, sockets: 4,
    blurb: "Quả cầu lửa nổ — sát thương 🔥 lớn, dễ 🔥 Ignite.",
  },
  {
    id: "tiaset", name: "Arc", emoji: "⚡", kind: "spell", tags: ["spell"],
    effectiveness: 0.52, split: { light: 1 }, baseCrit: 0.08, speedMul: 1.6, ailment: { shock: 0.35 }, perLevel: 0.07, manaCost: 18, sockets: 5,
    blurb: "Tia sét nảy nhanh — nhiều nhát/hiệp, hay ⚡ Shock (địch nhận thêm ST).",
  },
  {
    id: "bangtien", name: "Ice Shot", emoji: "❄️", kind: "spell", tags: ["spell", "projectile"],
    effectiveness: 0.92, split: { cold: 1 }, baseCrit: 0.07, speedMul: 1.0, ailment: { freeze: 0.3 }, perLevel: 0.08, manaCost: 18, sockets: 4,
    blurb: "Mũi băng — ST ❄️ mạnh, có cơ ❄️ Freeze khiến địch lỡ lượt.",
  },
];

export const SUPPORT_GEMS: SupportGemDef[] = [
  { id: "themlua", name: "Added Fire Damage", emoji: "🔥", blurb: "+ST 🔥 phẳng vào đòn", addedFlat: { fire: 14 }, manaMult: 1.2 },
  { id: "thembang", name: "Added Cold Damage", emoji: "❄️", blurb: "+ST ❄️ phẳng vào đòn", addedFlat: { cold: 14 }, manaMult: 1.2 },
  { id: "themset", name: "Added Lightning Damage", emoji: "⚡", blurb: "+ST ⚡ phẳng vào đòn", addedFlat: { light: 14 }, manaMult: 1.2 },
  { id: "tanbao", name: "Melee Physical Damage", emoji: "💢", blurb: "+30% ST (more) nhưng chỉ đòn Physical cận chiến", tagReq: "melee", moreMult: 1.3, manaMult: 1.4 },
  { id: "bùngno", name: "Empower", emoji: "💥", blurb: "+25% ST (more) mọi loại", moreMult: 1.25, manaMult: 1.35 },
  { id: "chimang", name: "Increased Critical Strikes", emoji: "🎯", blurb: "+8% tỉ lệ chí mạng, +40% ST chí mạng", critChance: 0.08, critMulti: 0.4, manaMult: 1.25 },
  { id: "danhnhanh", name: "Faster Attacks", emoji: "💨", blurb: "×1.35 tốc độ đòn", speedMul: 1.35, manaMult: 1.3 },
  { id: "xuyennguyento", name: "Elemental Penetration", emoji: "🌀", blurb: "Xuyên 25% kháng 🔥❄️⚡ của địch", pen: { fire: 0.25, cold: 0.25, light: 0.25 }, manaMult: 1.3 },
  { id: "docto", name: "Added Chaos Damage", emoji: "☠️", blurb: "+30% cơ ☠️ Poison & thêm ST Chaos phẳng", ailmentAdd: { poison: 0.3 }, addedFlat: { chaos: 10 }, manaMult: 1.25 },
  { id: "xuyenpha", name: "Pierce", emoji: "🪡", blurb: "Đòn phóng: +30% ST (more)", tagReq: "projectile", moreMult: 1.3, manaMult: 1.4 },
  { id: "hoitunguyento", name: "Elemental Focus", emoji: "🔆", blurb: "+40% ST (more) nhưng MẤT mọi hiệu ứng ailment", moreMult: 1.4, noAilment: true, manaMult: 1.45 },
  { id: "chuyenlua", name: "Physical to Fire", emoji: "🔁", blurb: "Chuyển 50% ST Physical → 🔥", convert: { from: "phys", to: "fire", frac: 0.5 }, manaMult: 1.15 },
];

export const SKILL_BY_ID: Record<string, SkillGemDef> = Object.fromEntries(SKILL_GEMS.map((g) => [g.id, g]));
export const SUPPORT_BY_ID: Record<string, SupportGemDef> = Object.fromEntries(SUPPORT_GEMS.map((g) => [g.id, g]));

// ─────────────────────────────────────────────────────────────────────────────
// Gem leveling — gems gain XP from expedition floors and level up (more damage).
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_GEM_LEVEL = 20;

// XP needed to go from `level` → `level+1` (steepening curve).
export function gemXpToNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.7));
}

// Add XP to a gem instance, applying as many level-ups as it earns (capped). Mutates the
// instance; returns how many levels it gained (for the log).
export function addGemXp(inst: GemInstance, xp: number): number {
  if (inst.level >= MAX_GEM_LEVEL) return 0;
  inst.xp += Math.max(0, xp);
  let gained = 0;
  while (inst.level < MAX_GEM_LEVEL && inst.xp >= gemXpToNext(inst.level)) {
    inst.xp -= gemXpToNext(inst.level);
    inst.level++;
    gained++;
  }
  if (inst.level >= MAX_GEM_LEVEL) inst.xp = 0;
  return gained;
}

export function newSkillGem(defId: string): SkillGemInstance {
  return { defId, level: 1, xp: 0 };
}
export function newSupportGem(defId: string): SupportGemInstance {
  return { defId, level: 1, xp: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve — the heart: skill gem + linked supports + character context → Offense.
// ─────────────────────────────────────────────────────────────────────────────

function addInto(into: DamageBundle, add: Partial<Record<DamageType, number>>, scale = 1): void {
  for (const t of DAMAGE_TYPES) into[t] += (add[t] ?? 0) * scale;
}

// The supports that ACTUALLY modify a skill: only the first `sockets` link, and a support
// with a tagReq only applies to a matching skill. Shared by damage resolution and mana
// pricing so a support can never cost mana without also doing something.
function activeSupports(gem: SkillGemDef, supports: SupportGemInstance[]) {
  return supports
    .slice(0, gem.sockets)
    .map((s) => ({ inst: s, def: SUPPORT_BY_ID[s.defId] }))
    .filter((x): x is { inst: SupportGemInstance; def: SupportGemDef } => !!x.def && (!x.def.tagReq || gem.tags.includes(x.def.tagReq)));
}

// Mana one swing costs: the skill's base price multiplied by every linked support (PoE's
// mana multiplier). `base` is the same skill with NO supports — what the hero falls back to
// when mana runs short, so a starved build still swings, just without its payload.
export interface ManaCost {
  full: number; // the supported skill
  base: number; // the bare skill
}

export function skillManaCost(skill: SkillGemInstance, supports: SupportGemInstance[]): ManaCost {
  const gem = SKILL_BY_ID[skill.defId];
  if (!gem) return { full: 0, base: 0 };
  let mult = 1;
  for (const { def } of activeSupports(gem, supports)) mult *= def.manaMult;
  return { full: Math.max(1, Math.round(gem.manaCost * mult)), base: Math.max(1, gem.manaCost) };
}

export function resolveOffense(skill: SkillGemInstance, supports: SupportGemInstance[], ctx: SkillContext): Offense {
  const gem = SKILL_BY_ID[skill.defId];
  if (!gem) return { hit: zeroBundle(), crit: ctx.crit, critMulti: ctx.critMulti, speed: ctx.speed, ailment: {} };

  const base = gem.kind === "attack" ? ctx.weaponDamage : ctx.spellPower;
  const scaled = base * gem.effectiveness * (1 + gem.perLevel * (skill.level - 1));
  const hit = zeroBundle();
  addInto(hit, gem.split, scaled);
  addInto(hit, ctx.addedFlat); // flat added damage from gear/tree

  const active = activeSupports(gem, supports);

  // Added flat damage from supports (scaled by the support's own level).
  for (const { inst, def } of active) if (def.addedFlat) addInto(hit, def.addedFlat, 1 + 0.06 * (inst.level - 1));
  // Conversions (order: as listed).
  for (const { def } of active) {
    if (!def.convert) continue;
    const amt = hit[def.convert.from] * def.convert.frac;
    hit[def.convert.from] -= amt;
    hit[def.convert.to] += amt;
  }
  // "more" multipliers stack multiplicatively across all applicable types.
  let more = 1;
  for (const { def } of active) if (def.moreMult) more *= def.moreMult;
  if (more !== 1) for (const t of DAMAGE_TYPES) hit[t] *= more;

  let crit = ctx.crit + gem.baseCrit;
  let critMulti = ctx.critMulti;
  let speed = ctx.speed * gem.speedMul;
  let ailment: Partial<Record<Ailment, number>> = { ...gem.ailment };
  const pen: Partial<Record<Elem, number>> = {};
  let stripAilment = false;
  for (const { def } of active) {
    crit += def.critChance ?? 0;
    critMulti += def.critMulti ?? 0;
    speed *= def.speedMul ?? 1;
    if (def.noAilment) stripAilment = true;
    if (def.ailmentAdd) for (const k of Object.keys(def.ailmentAdd) as Ailment[]) ailment[k] = (ailment[k] ?? 0) + (def.ailmentAdd[k] ?? 0);
    if (def.pen) for (const k of Object.keys(def.pen) as Elem[]) pen[k] = (pen[k] ?? 0) + (def.pen[k] ?? 0);
  }
  if (stripAilment) ailment = {};

  return {
    hit,
    crit: Math.min(1, Math.max(0, crit)),
    critMulti,
    speed: Math.max(0.5, speed),
    ailment,
    pen: Object.keys(pen).length > 0 ? pen : undefined,
  };
}
