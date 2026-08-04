// Idle-RPG / "Cửa Ải" pure domain core — the functional heart of the character +
// auto-expedition feature. Everything here is PURE (no Discord, no I/O, no coin
// ledger): stat math, gear generation, the seeded auto-battle simulation, loot
// rolling, and upgrade/salvage costs. The Discord glue (the /cuaai live-message
// engine, the /nhanvat & /tuido commands) and the coin ledger wiring live
// elsewhere and import from here — same split as games.ts's pure decide() vs its
// imperative shell, and streams.ts's engine importing pure helpers.
//
// RNG is always an injected `rng: () => number` (defaults to Math.random) so a
// battle is reproducible given a seed — the same convention as duathu's
// simulateRace(Math.random). All tunables sit at the top: this block is the
// entire balance surface, tune it here.

import type { SkillGemInstance, SupportGemInstance } from "./rpg-skills";
import { newSkillGem, newSupportGem, SUPPORT_GEMS } from "./rpg-skills";
import type { FlaskInstance } from "./rpg-build";
import type { QuestBoard } from "./rpg-quests";

// ─────────────────────────────────────────────────────────────────────────────
// Balance constants — the whole knob board
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_LEVEL = 50;

// Spirit a hero has purely from levelling, before any gear. Auras reserve Spirit, so this
// floor is what guarantees a levelled character can always run ONE cheap aura — gear-borne
// spirit (a narrow, deliberately scarce affix) is what buys the second and third.
export const SPIRIT_PER_LEVEL = 0.6; // → 30 spirit at MAX_LEVEL
export function baseSpirit(level: number): number {
  return Math.floor(Math.max(1, level) * SPIRIT_PER_LEVEL);
}
export const BAG_LIMIT = 60; // unequipped gear cap; a full bag must salvage before looting more
export const GEM_BAG_LIMIT = 40; // owned-but-unlinked gem cap; overflow auto-salvages to 🔩 (same anti-dead-weight rule as gear)
export const GEM_SALVAGE_SHARDS = 4; // 🔩 refunded when an overflow gem is auto-salvaged at bank time

// Support-gem drops — the build-transformation loot chase. A cleared floor has a small
// shot at a random SUPPORT gem (the linkable modifiers: Empower, Elemental Focus, Added
// Fire, …); skill gems are NOT dropped (a cross-class skill is dead weight, so the starter
// skill + the gem-XP system carry the skill axis). Rates are deliberately low — a lucky
// early Empower is a real power spike — and tuned via rpg-telemetry after deploy.
export const GEM_DROP_CHANCE = 0.02; // per cleared non-boss floor
export const GEM_BOSS_CHANCE = 0.12; // a boss floor pays a much fatter shot (milestone reward)

// Between-floor recovery is the pacing valve of a whole run. Free healing must stay BELOW what
// a deep floor costs, or life stops being a resource entirely: raise this much and the hero
// re-enters every single floor at ~100% life, no run can end by attrition, and every death
// becomes a single fight that kills from full with zero warning. The free trickle is therefore
// small and the real recovery is the 🧪 potion (bought, finite, auto-quaffed in the red) —
// deep floors out-cost the trickle, life grinds down across many floors, and the player
// watches it happen with time to quaff or turn back.
export const REGEN_FRAC = 0.02; // hero heals 2% of maxHP between cleared floors
export const POTION_THRESHOLD = 0.35; // auto-quaff a potion when HP dips below 35% maxHP after a floor
export const POTION_HEAL_FRAC = 0.55; // a potion restores 55% of maxHP

export const ENHANCE_PER_PLUS = 0.08; // each +1 enhancement adds 8% of an item's own stats
export const MAX_PLUS = 12; // enhancement cap per item

// Gear roll variance fixed at drop-time — the single "is this one better?" knob.
export const ROLL_MIN = 0.85;
export const ROLL_MAX = 1.15;

// ─── PoE-style item mods — the "godroll" chase ────────────────────────────────
// An item carries prefix/suffix MODS (like Path of Exile). Rarity caps the slots
// (Thường 0 · Khá 1p/1s · Hiếm 2p/2s · Sử Thi & Huyền 3p/3s), and each mod rolls from a
// weighted TIER table gated by the item's ilvl (the floor it dropped on — deeper floor
// unlocks the top tiers, the whole reason to farm deep). Mods fold into gearStats on top
// of the scaled base, so power / auto-equip see them for free. The full MOD_POOL sits
// below the gear bases; the tunables here are the whole balance surface.
export const MOD_CAP: Record<Rarity, { pre: number; suf: number }> = {
  0: { pre: 0, suf: 0 }, // ⚪ Thường (Normal)
  1: { pre: 1, suf: 1 }, // 🟢 Khá (Magic)
  2: { pre: 2, suf: 2 }, // 🔵 Hiếm (Rare-lite)
  3: { pre: 3, suf: 3 }, // 🟣 Sử Thi
  4: { pre: 4, suf: 4 }, // 🟠 Huyền Thoại — two more affix slots than anything else
};

// 🌟 Jackpot — a rare "chấn động" floor drop: a guaranteed Huyền Thoại rolled at JACKPOT_ILVL
// with its full affix canvas. What it grants is SLOTS AND DEPTH, never rolled quality: the
// tiers still come off the same weighted pool every other drop uses, so a jackpot is the best
// CANVAS in the game and nothing more. It used to roll `perfect` (every affix forced to T1 at
// max value), and the measured consequence was the whole reason this section was retuned:
// 55–60% of every Huyền Thoại in play was a jackpot, i.e. the perfect-item chase resolved
// itself roughly twice per hour and the player market had nothing left to sell.
export const JACKPOT_ILVL = 45; // rolls as if dropped deep → the full canvas, every tier gate open
export const JACKPOT_BASE_CHANCE = 0.002; // per cleared non-boss floor, nudged up a little with depth
export const TREASURE_CHANCE = 0.05; // 🏛️ kho báu floor — fat material + coin bonus
export const ELITE_CHANCE = 0.04; // 💎 quái tinh floor — a bonus ≥ Hiếm gear drop
// 🟤 Unique drop — a fixed-stat, build-defining item. Rarer than a jackpot on a normal
// floor; a boss floor pays a much fatter shot at one (the reward for clearing a milestone).
// Halved against the first tuning: with a catalogue this size the old rate had players
// holding duplicates of half the list inside three days, which is a collection with no chase.
export const UNIQUE_BASE_CHANCE = 0.001; // per cleared non-boss floor
export const UNIQUE_BOSS_CHANCE = 0.025; // on a boss floor

// Endgame / meta knobs — Tái Sinh (prestige), Cổ Ngọc perks, the weekly-modifier
// rotation, and the Ải Tử Chiến (PvP) power bracket. All bolt onto the combat core
// without touching it.
export const PRESTIGE_FLOOR = 20; // reach this floor THIS LIFE (or hit MAX_LEVEL) → eligible to rebirth
export const ASCENDANCY_FLOOR = 15; // reach this floor in ANY stage (or ASCENDANCY_LEVEL) → unlock subclass
export const ASCENDANCY_LEVEL = 20; // the alternate ascendancy gate — hit this level → unlock subclass
// Cổ Ngọc reward = A · log2(power / base) — scales with the POWER you built THIS life (farmed gear +
// enhancement + stars + level), never a floor-delta. Log-shaped so a permanent meta-currency can't
// runaway-inflate: every doubling of power pays a flat +A. `A=2` reproduces the old ~+18 at a maxed
// build (~684k power) while guaranteeing ≥1 per rebirth — the endless loop never hard-locks. See the
// eligibility note on canPrestige for why this needs bestFloorThisLife (bestFloor persists → spam).
const PRESTIGE_REWARD_A = 2; // Cổ Ngọc per doubling of built power
const PRESTIGE_POWER_BASE = 1000; // reference power (~a fresh starter) — the log's origin
const PERK_COST_BASE = 2; // Cổ Ngọc for a perk's first level
const PERK_COST_STEP = 2; // added per already-owned level (escalating)
export const PVP_BRACKET = 0.35; // Tử Chiến only matches within |ln(powerA / powerB)| ≤ this
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000; // weekly-modifier rotation period (biweekly)

// ─────────────────────────────────────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────────────────────────────────────

export type ClassId = "chien" | "phap" | "cung";
export type GearSlot = "vukhi" | "non" | "giap" | "gang" | "giay" | "nhan";
export type Rarity = 0 | 1 | 2 | 3 | 4;

// Season — bumped on a rebalance. newProfile stamps it; when a guild's stored season falls
// behind, the store layer (rollRpgSeason) resets the league: characters, in-flight runs, the
// market and PvP all start over, while coins and the telemetry journals survive.
// Season 3 is a combat rebalance: monster life and damage ride separate curves
// (rpg-maps LIFE_POW/DMG_POW), a single hit can never exceed MAX_HIT_FRAC of a hero's life,
// between-floor healing is a fraction of what it was, and map tiers finally pay to push.
export const SEASON = 3;

// The farmable currencies. luongthuc + thuoc are the run's consumables (bought with
// coins — the coin SINK); manh + tinhchat are the progression materials looted in the
// ải; bùa is the enhancement-insurance charm (bought with coins or dropped rarely).
// None of these ever mint coins — the RPG economy is self-contained. Gear power comes
// from dropped mods + the risky +N enhance system (đập đồ) that burns manh + coins.
export type MaterialId = "luongthuc" | "thuoc" | "manh" | "tinhchat" | "bua" | "dotpha";

// Cổ Ngọc perks — permanent multipliers bought with the prestige meta-currency, folded
// into the build (atk/hp) and read by the engine (loot).
export type PerkId = "atk" | "hp" | "loot";

// The PoE stat vocabulary gear can grant — each id names a field the build layer
// (rpg-build.ts RawBuild) accumulates. Gear base implicit stats + rolled mods both
// target these. Flat pools (life/es/armour/evasion/atk/spell/added-damage) scale with
// rarity×roll×enhancement; the %-like ids (atkPct/spellPct/speedPct/crit/critMulti/res*)
// are added flat (mods only). This is the whole item→build bridge.
export type StatId =
  | "life"
  | "es"
  | "armour"
  | "evasion"
  | "atk"
  | "spell"
  | "addPhys"
  | "addFire"
  | "addCold"
  | "addLight"
  | "addChaos"
  | "atkPct"
  | "spellPct"
  | "speedPct"
  | "crit"
  | "critMulti"
  | "resFire"
  | "resCold"
  | "resLight"
  | "resChaos"
  // Spirit RESERVES persistent buffs (auras). Mana + its regen FUEL each blow — see
  // rpg-combat's per-hit mana gate. All three are gear-borne resources, not damage.
  | "spirit"
  | "mana"
  | "manaRegen";

// The %-like stats are added flat (never scaled by rarity/roll/enhancement) and render
// as percentages; every other StatId is a flat pool that scales.
const PCT_STATS: ReadonlySet<StatId> = new Set<StatId>(["atkPct", "spellPct", "speedPct", "crit", "critMulti", "resFire", "resCold", "resLight", "resChaos"]);

export type ModKind = "prefix" | "suffix";

// A rolled MOD on an item (PoE prefix/suffix). `group` is the mutual-exclusion family (an
// item never carries two mods of the same group), `tier` is 1-based with 1 = best (T1),
// `value` is the rolled number folded into gearStats. Rolled once at drop and frozen —
// gear power then comes from the risky +N enhance system (đập đồ), not mod crafting.
export interface Mod {
  group: string;
  kind: ModKind;
  stat: StatId;
  tier: number;
  value: number;
}

export interface GearItem {
  id: string; // unique instance id
  base: string; // GEAR_BASES key
  slot: GearSlot;
  rarity: Rarity;
  roll: number; // ROLL_MIN..ROLL_MAX, frozen at drop — the base-stat quality
  plus: number; // enhancement level 0..MAX_PLUS
  ilvl?: number; // item level = the floor it dropped on; gates mod tiers (absent on legacy items → treated as 1)
  mods?: Mod[]; // rolled prefix/suffix mods (absent on legacy/starter items → treated as none)
  uniqueId?: string; // a UNIQUES entry id → this item is a fixed-stat Unique (absent on normal items → a normal item)
  star?: number; // ⭐ Ghép Sao level 0..MAX_STAR — folds +STAR_MORE/star into base stats AND upgrades a mod tier each star (absent → 0)
  capPlus?: number; // Đột Phá — the current enhancement CEILING (absent → BREAK_CAP_BASE = 3); each breakthrough raises it +3 up to MAX_PLUS
}

export interface RpgProfile {
  cls: ClassId;
  level: number;
  gear: Partial<Record<GearSlot, GearItem>>; // equipped
  bag: GearItem[]; // unequipped, bounded by BAG_LIMIT
  materials: Partial<Record<MaterialId, number>>;
  bestFloor: Record<string, number>; // stageId → deepest floor ever cleared (the flex + gate metric)
  createdAt: number;
  // PoE build layer (v2) — the equipped skill gem + its linked supports, the loose
  // gem bag, the allocated passive-tree node ids, and carried flasks. The build layer
  // (rpg-build.ts) folds these into the combat Offense/Defenses.
  skillGem: SkillGemInstance | null; // the main attack/spell
  supports: SupportGemInstance[]; // linked into the skill's sockets, in order
  gemBag: (SkillGemInstance | SupportGemInstance)[]; // owned but not linked
  passives: string[]; // allocated PASSIVE_NODES ids
  flasks: FlaskInstance[]; // carried flasks
  season: number; // the season this profile was created in (SEASON); a wipe resets stale ones
  // Endgame / meta — these survive a Tái Sinh (prestige) reset.
  coNgoc: number; // meta-currency earned on prestige
  prestigeLevel: number; // number of times reborn
  // Deepest floor reached SINCE the last Tái Sinh — RESETS to 0 on rebirth. This is the eligibility
  // gate (bestFloor persists across rebirth, so gating on it would let a just-reset hero re-prestige
  // for free; a per-life tracker forces a real re-climb each time). Reward itself is power-based.
  bestFloorThisLife: number;
  perks: Partial<Record<PerkId, number>>; // purchased perk levels (folded into stats/loot/rations)
  // Ascendancy — the chosen subclass id (ASCENDANCIES in rpg-ascendancy.ts). Tied to the class
  // → survives a Tái Sinh. Undefined = none chosen yet; re-pickable freely once unlocked.
  ascendancy?: string;
  // Auras & Curses (rpg-auras.ts) — the loadout tied to the character (survives a Tái Sinh).
  // `auras` = the running self-buff aura ids (folded into the build, capped at AURA_SLOTS);
  // `curse` = the single hex laid on the enemy (applied to each floor's monster). Both default
  // empty/undefined; re-pickable freely.
  auras: string[];
  curse?: string;
  // Atlas Tree (rpg-atlas.ts) — the account-wide endgame farming meta. Allocated node ids
  // multiply expedition loot yield; points are DERIVED from the deepest floor (never stored).
  // Survives a Tái Sinh, like Cổ Ngọc perks. Defaults empty.
  atlasNodes: string[];
  // Onboarding — bitmask of completed TutorialStep (see the tutorial helpers below).
  tutorial: number;
  // Daily quest board (rpg-quests). Optional: an older save simply rolls one on next play.
  // Survives Tái Sinh — a daily is an account-level "reason to log in", not run progress.
  quests?: QuestBoard;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogs — classes, rarities, gear bases, stages. All static; new content = a
// new entry, exactly like the games' symbol/animal catalogs.
// ─────────────────────────────────────────────────────────────────────────────

// Each class = a name/emoji/flavour skill line + a starter skill gem. The stat
// identity (base + per-level growth) now lives in CLASS_BUILD (rpg-build.ts), folded
// into the build there. The `starterGem` is the skill gem newProfile grants so a
// fresh hero can fight immediately: Chiến → Chém Mạnh, Pháp → Cầu Lửa, Cung → Đâm Xuyên.
export const CLASSES: Record<
  ClassId,
  { name: string; emoji: string; skill: string; starterGem: string }
> = {
  chien: {
    name: "Warrior",
    emoji: "🛡️",
    skill: "Iron Guard: máu dày + giáp cao, đòn Physical nặng",
    starterGem: "chemmanh",
  },
  phap: {
    name: "Sorceress",
    emoji: "🔮",
    skill: "Arcane Fury: khiên năng lượng + sát thương phép & chí mạng",
    starterGem: "caulua",
  },
  cung: {
    name: "Ranger",
    emoji: "🏹",
    skill: "Deadeye: né cao, đòn nhanh, chí mạng ổn định",
    starterGem: "damxuyen",
  },
};

// mult widens the stat-roll band per rarity; weightByFloor governs drop odds
// (deeper floors tilt toward the top tiers). Index === Rarity.
export const RARITIES = [
  { name: "Normal", emoji: "⚪", mult: 1.0, color: 0x9aa0a6 },
  { name: "Magic", emoji: "🟢", mult: 1.35, color: 0x57f287 },
  { name: "Rare", emoji: "🔵", mult: 1.75, color: 0x5865f2 },
  { name: "Epic", emoji: "🟣", mult: 2.3, color: 0x9b59b6 },
  { name: "Legendary", emoji: "🟠", mult: 3.2, color: 0xe67e22 },
] as const;

export const GEAR_SLOTS: { id: GearSlot; name: string; emoji: string }[] = [
  { id: "vukhi", name: "Weapon", emoji: "⚔️" },
  { id: "non", name: "Helmet", emoji: "🪖" },
  { id: "giap", name: "Body Armour", emoji: "🛡️" },
  { id: "gang", name: "Gloves", emoji: "🧤" },
  { id: "giay", name: "Boots", emoji: "🥾" },
  { id: "nhan", name: "Ring", emoji: "💍" },
];

// A gear base = a slot + which build stats it implicitly contributes (StatId keys).
// Rarity × roll × enhancement scale the FLAT pools at compute time; %-like implicits
// (crit/critMulti/speedPct/res*) are rare on bases and stay flat. Weapons grant `atk`
// (attack base damage) + sometimes an elemental flourish; armour pieces grant defence
// pools (life/armour/es/evasion); the ring grants resistances + crit. Keep raw numbers
// small — the multipliers do the growing.
export const GEAR_BASES: Record<string, { name: string; slot: GearSlot; stats: Partial<Record<StatId, number>> }> = {
  // ⚔️ Weapons — the attack-base-damage source (spell heroes still use one; their skill
  // reads spell power, but the weapon's atk feeds attack supports/hybrid).
  kiem: { name: "Sword", slot: "vukhi", stats: { atk: 14 } },
  truong: { name: "Staff", slot: "vukhi", stats: { atk: 9, spell: 10, crit: 0.03 } },
  cungten: { name: "Bow", slot: "vukhi", stats: { atk: 13, critMulti: 0.12 } },
  riu: { name: "Axe", slot: "vukhi", stats: { atk: 16, addPhys: 3 } },
  quyentruong: { name: "Flame Sceptre", slot: "vukhi", stats: { atk: 11, addFire: 6 } },
  // 🪖 Helmet — evasion/ES leaning defence.
  nonda: { name: "Leather Cap", slot: "non", stats: { life: 28, evasion: 18 } },
  nonsat: { name: "Iron Helm", slot: "non", stats: { life: 34, armour: 16 } },
  monao: { name: "Mage Hood", slot: "non", stats: { life: 18, es: 22 } },
  // 🛡️ Body Armour — the big life/defence chunk.
  giapda: { name: "Leather Armour", slot: "giap", stats: { life: 55, evasion: 24 } },
  giaptam: { name: "Plate Armour", slot: "giap", stats: { life: 70, armour: 28 } },
  aophep: { name: "Arcane Robe", slot: "giap", stats: { life: 34, es: 40 } },
  // 🧤 Gloves — small defence + an offence flourish.
  gangda: { name: "Leather Gloves", slot: "gang", stats: { life: 24, evasion: 14, crit: 0.03 } },
  gangsat: { name: "Iron Gauntlets", slot: "gang", stats: { life: 30, armour: 14, addPhys: 3 } },
  // 🥾 Boots — defence + speed.
  giayda: { name: "Leather Boots", slot: "giay", stats: { life: 24, evasion: 14, speedPct: 0.05 } },
  giaysat: { name: "Iron Greaves", slot: "giay", stats: { life: 30, armour: 14 } },
  giayphep: { name: "Arcane Slippers", slot: "giay", stats: { life: 16, es: 20, speedPct: 0.04 } },
  // 💍 Ring — the resistance + crit jewellery.
  nhanlua: { name: "Ruby Ring", slot: "nhan", stats: { resFire: 0.12, life: 14 } },
  nhanbang: { name: "Sapphire Ring", slot: "nhan", stats: { resCold: 0.12, life: 14 } },
  nhanset: { name: "Topaz Ring", slot: "nhan", stats: { resLight: 0.12, life: 14 } },
  nhanchimang: { name: "Assassin's Ring", slot: "nhan", stats: { crit: 0.05, critMulti: 0.15 } },
};

const GEAR_BY_SLOT: Record<GearSlot, string[]> = {
  vukhi: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "vukhi"),
  non: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "non"),
  giap: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "giap"),
  gang: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "gang"),
  giay: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "giay"),
  nhan: Object.keys(GEAR_BASES).filter((k) => GEAR_BASES[k]!.slot === "nhan"),
};

// ─────────────────────────────────────────────────────────────────────────────
// UNIQUE ITEMS — PoE's build-defining named gear. A Unique is a fixed-stat item: it
// ignores rarity band, drop roll, and rolled mods entirely — its `stats` are the whole
// contribution, scaled ONLY by the +N enhance system (same ENHANCE_PER_PLUS the enhance
// gamble uses). Numbers sit a touch above a good Rare's budget, and a few carry a
// signature trade-off (huge life but no armour, big damage but low resist) so a Unique
// is a real build decision, not a strict upgrade. They render as their OWN 🟤 tier (not
// a rarity label), never bulk-salvage/sell, and drop rarely (rarer than a jackpot, more
// likely on boss floors). New unique = a new entry.
// ─────────────────────────────────────────────────────────────────────────────

export interface UniqueDef {
  id: string;
  name: string;
  emoji: string;
  slot: GearSlot;
  base: string; // a GEAR_BASES key of the same slot — the item's silhouette
  flavor: string; // one-line PoE-style flavour
  stats: Partial<Record<StatId, number>>; // FIXED contribution (scaled only by enhancement)
}

// Every Unique carries a SIGNATURE DOWNSIDE — one or more NEGATIVE stats (a PoE unique is a
// build decision, never a strict upgrade). The upside is pushed above a good Rare's budget so
// the item ENABLES a build; the negative (usually −resistance = you take more damage, or −spell
// on a pure brawler) is the cost you build around. gearStats folds the negatives straight in.
export const UNIQUES: UniqueDef[] = [
  // ⚔️ Weapons
  {
    id: "starforge",
    name: "Starforge",
    emoji: "🌟",
    slot: "vukhi",
    base: "kiem",
    flavor: "Rèn từ lõi một vì sao chết — nhưng mọi phép thuật héo tàn trong tay ngươi.",
    // Pure physical monster; magic withers in your hands.
    stats: { atk: 54, addPhys: 14, atkPct: 0.42, critMulti: 0.45, spellPct: -0.4, resFire: -0.15 },
  },
  {
    id: "voidbringer",
    name: "Void Bringer",
    emoji: "🌀",
    slot: "vukhi",
    base: "truong",
    flavor: "Cây trượng hút cạn ánh sáng — pháp lực bùng nổ, phòng ngự nguyên tố tan biến.",
    // Huge spell power, but every elemental resistance is stripped away.
    stats: { spell: 48, spellPct: 0.55, addChaos: 12, crit: 0.06, resFire: -0.4, resCold: -0.4, resLight: -0.4 },
  },
  {
    id: "windripper",
    name: "Windripper",
    emoji: "🏹",
    slot: "vukhi",
    base: "cungten",
    flavor: "Mũi tên rời dây nhanh hơn gió giật — chí mạng tới tấp, nhưng thân băng giá mong manh.",
    stats: { atk: 44, addLight: 16, crit: 0.09, critMulti: 0.45, speedPct: 0.16, resCold: -0.3, resFire: -0.2 },
  },
  {
    id: "bloodseeker",
    name: "Bloodseeker",
    emoji: "🪓",
    slot: "vukhi",
    base: "riu",
    flavor: "Lưỡi rìu đòi máu của chính kẻ cầm nó — mỗi nhát chém là một phần sinh mệnh đánh đổi.",
    // Brutal physical output bought with a gutted life pool: the glass-cannon axe.
    stats: { atk: 58, addPhys: 18, atkPct: 0.5, critMulti: 0.35, life: -120, resChaos: -0.2 },
  },
  {
    id: "tempestcaller",
    name: "Tempest Caller",
    emoji: "🌩️",
    slot: "vukhi",
    base: "quyentruong",
    flavor: "Trượng gọi giông — sét và băng tuôn ra không ngớt, còn thân chủ đứng trần giữa bão.",
    // Dual-element spell weapon; you pay for it with the two resistances it spits out.
    stats: { spell: 42, addLight: 18, addCold: 18, spellPct: 0.38, resLight: -0.35, resCold: -0.35 },
  },
  {
    id: "whisperingblade",
    name: "Whispering Blade",
    emoji: "🗡️",
    slot: "vukhi",
    base: "kiem",
    flavor: "Nhẹ tới mức không nghe thấy tiếng rút kiếm — nhưng cũng nhẹ tới mức chẳng đỡ nổi gì.",
    // Speed/crit engine with almost no base damage: it only pays off on a built-up hit.
    stats: { atk: 22, crit: 0.12, critMulti: 0.5, speedPct: 0.28, life: -70, armour: -40 },
  },
  // 🪖 Helmet
  {
    id: "abyssusveil",
    name: "Abyssus",
    emoji: "💀",
    slot: "non",
    base: "nonsat",
    flavor: "Sát thương tăng vọt — nhưng mọi đòn giáng xuống ngươi đều đau gấp bội.",
    // Massive added phys + crit multi, but every resistance craters (you take far more damage).
    stats: { life: 40, addPhys: 18, atkPct: 0.35, critMulti: 0.6, resFire: -0.25, resCold: -0.25, resLight: -0.25 },
  },
  {
    id: "crownofeyes",
    name: "Crown of Eyes",
    emoji: "👁️",
    slot: "non",
    base: "monao",
    flavor: "Trăm con mắt dõi theo — hộ mệnh năng lượng phủ kín, nhưng tâm trí phơi trước hỗn mang.",
    stats: { life: 50, es: 90, spellPct: 0.28, resChaos: -0.3 },
  },
  {
    id: "crimsonvisor",
    name: "Crimson Visor",
    emoji: "🔺",
    slot: "non",
    base: "nonsat",
    flavor: "Sắt dày tới mức nhìn ra ngoài chỉ còn một khe hẹp — an toàn, và chậm chạp.",
    // The tank helm: real armour and fire resistance, paid for in attack speed.
    stats: { life: 85, armour: 70, resFire: 0.22, speedPct: -0.12 },
  },
  {
    id: "mindflayercirclet",
    name: "Mindflayer Circlet",
    emoji: "🧠",
    slot: "non",
    base: "monao",
    flavor: "Vòng nguyệt quế của kẻ ăn trí nhớ — linh lực tràn trề, thân xác teo lại.",
    // The aura-enabler: a big Spirit block (a third aura outright) at the cost of the life pool.
    stats: { spirit: 45, mana: 60, manaRegen: 6, es: 45, life: -80 },
  },
  // 🛡️ Body Armour
  {
    id: "kaomsheart",
    name: "Kaom's Heart",
    emoji: "❤️‍🔥",
    slot: "giap",
    base: "giaptam",
    flavor: "Trái tim thủ lĩnh bất tử — máu cuồn cuộn, nhưng không một khe giáp, không một lá chắn hỗn mang.",
    // Enormous life, ZERO armour (the classic Kaom's), and a gaping chaos hole.
    stats: { life: 300, atkPct: 0.22, resChaos: -0.35 },
  },
  {
    id: "cloakofdefiance",
    name: "Cloak of Defiance",
    emoji: "🧥",
    slot: "giap",
    base: "aophep",
    flavor: "Tấm áo choàng khước từ sát thương — khiên năng lượng phủ toàn thân, nhưng dẫn sét thẳng vào tim.",
    stats: { life: 95, es: 110, resChaos: 0.25, resLight: -0.3 },
  },
  {
    id: "bramblecarapace",
    name: "Bramble Carapace",
    emoji: "🌵",
    slot: "giap",
    base: "giaptam",
    flavor: "Vỏ gai mọc xuyên qua giáp — không ai tới gần được, và ngươi cũng chẳng đi đâu nhanh.",
    // Fortress armour with a chaos plug; it makes you slow and easy to hit.
    stats: { life: 130, armour: 150, resChaos: 0.3, evasion: -60, speedPct: -0.15 },
  },
  {
    id: "voidshroud",
    name: "Void Shroud",
    emoji: "🕳️",
    slot: "giap",
    base: "aophep",
    flavor: "Tấm vải dệt từ khoảng trống giữa các vì sao — khiên năng lượng vô tận, máu thịt thì không.",
    // The ES-stacker's chest: an enormous shield built on a hollowed-out life pool.
    stats: { es: 260, spirit: 30, resChaos: 0.2, life: -150 },
  },
  {
    id: "ancestralhide",
    name: "Ancestral Hide",
    emoji: "🦬",
    slot: "giap",
    base: "giapda",
    flavor: "Da thú tổ tiên đã chạy suốt một đời không dừng — nhẹ, nhanh, và không che nổi mũi giáo.",
    // The evasion/speed chest: everything defensive that isn't armour.
    stats: { life: 120, evasion: 130, speedPct: 0.14, armour: -50, resFire: -0.2 },
  },
  // 🧤 Gloves
  {
    id: "facebreaker",
    name: "Facebreaker",
    emoji: "🥊",
    slot: "gang",
    base: "gangsat",
    flavor: "Nắm đấm trần vỡ đá — sức vật lý thô bạo dồn hết vào cú đấm, phép thuật là thứ xa xỉ.",
    stats: { life: 50, addPhys: 20, atkPct: 0.48, spellPct: -0.4, resCold: -0.15 },
  },
  {
    id: "stormgrip",
    name: "Stormgrip",
    emoji: "⚡",
    slot: "gang",
    base: "gangda",
    flavor: "Sét chạy dọc mười ngón — đánh nhanh như chớp giật, và chớp không tha cả chủ nhân.",
    stats: { life: 40, addLight: 20, crit: 0.07, speedPct: 0.16, resLight: -0.35 },
  },
  {
    id: "titanembrace",
    name: "Titan's Embrace",
    emoji: "🗿",
    slot: "gang",
    base: "gangsat",
    flavor: "Găng của người khổng lồ — mỗi cú vung là một tảng đá rơi, chậm và không cần chính xác.",
    // Raw damage + armour for a build that has given up on crit entirely.
    stats: { life: 70, armour: 60, atkPct: 0.4, addPhys: 10, crit: -0.06, speedPct: -0.1 },
  },
  {
    id: "soulthief",
    name: "Soulthief",
    emoji: "👻",
    slot: "gang",
    base: "gangda",
    flavor: "Mỗi linh hồn chạm vào đều để lại chút phép — đổi lại, thân xác cứ mỏng dần.",
    // The caster's mana engine: keeps supported skills firing deep into a run.
    stats: { spell: 26, mana: 90, manaRegen: 9, spellPct: 0.22, life: -60 },
  },
  // 🥾 Boots
  {
    id: "seventeaguestep",
    name: "Seven-League Step",
    emoji: "👟",
    slot: "giay",
    base: "giayda",
    flavor: "Mỗi bước là bảy dặm — lướt nhanh như chớp, nhưng gót chân hở trước băng giá.",
    stats: { life: 55, evasion: 48, speedPct: 0.3, resCold: -0.25 },
  },
  {
    id: "bulwarksabatons",
    name: "Bulwark Sabatons",
    emoji: "🧱",
    slot: "giay",
    base: "giaysat",
    flavor: "Đóng đinh xuống đất là đứng yên tại đó — không ai đẩy nổi, và ngươi cũng không chạy nổi.",
    stats: { life: 90, armour: 80, resFire: 0.2, resCold: 0.2, speedPct: -0.18 },
  },
  {
    id: "phaseslippers",
    name: "Phase Slippers",
    emoji: "🌫️",
    slot: "giay",
    base: "giayphep",
    flavor: "Nửa bước ở đây, nửa bước ở cõi khác — đòn đánh xuyên qua, và giáp cũng vậy.",
    stats: { es: 70, spirit: 25, evasion: 60, speedPct: 0.18, armour: -45 },
  },
  {
    id: "graveboundgreaves",
    name: "Gravebound Greaves",
    emoji: "⚰️",
    slot: "giay",
    base: "giayda",
    flavor: "Xích mộ kéo lê sau gót — kẻ nào đứng vững trong bùn tử khí thì đi đâu cũng vững.",
    stats: { life: 100, resChaos: 0.3, armour: 40, speedPct: -0.08, evasion: -30 },
  },
  // 💍 Ring
  {
    id: "calloftheempire",
    name: "Call of the Void",
    emoji: "💍",
    slot: "nhan",
    base: "nhanchimang",
    flavor: "Chiếc nhẫn vọng về từ hư không — thuần phục nguyên tố, nhưng mở toang cánh cửa hỗn mang.",
    stats: { life: 45, resFire: 0.18, resCold: 0.18, resLight: 0.18, critMulti: 0.3, resChaos: -0.35 },
  },
  {
    id: "emberloop",
    name: "Emberloop",
    emoji: "🔥",
    slot: "nhan",
    base: "nhanlua",
    flavor: "Vòng than không bao giờ nguội — lửa là bạn, băng giá thành kẻ thù không đội trời chung.",
    stats: { resFire: 0.35, addFire: 14, life: 30, resCold: -0.3 },
  },
  {
    id: "frostbite",
    name: "Frostbite",
    emoji: "❄️",
    slot: "nhan",
    base: "nhanbang",
    flavor: "Ngón đeo nhẫn đã mất cảm giác từ lâu — đòn lạnh buốt hơn, và lửa thì thiêu tận xương.",
    stats: { resCold: 0.35, addCold: 14, crit: 0.05, resFire: -0.3 },
  },
  {
    id: "thunderband",
    name: "Thunderband",
    emoji: "🌀",
    slot: "nhan",
    base: "nhanset",
    flavor: "Điện chạy vòng quanh ngón tay, hối thúc từng nhịp — nhanh hơn, nhưng hồn phách hở toang.",
    stats: { resLight: 0.35, addLight: 14, speedPct: 0.12, resChaos: -0.3 },
  },
  {
    id: "mortalcoil",
    name: "Mortal Coil",
    emoji: "☠️",
    slot: "nhan",
    base: "nhanchimang",
    flavor: "Đeo vào là ký một khế ước: mỗi đòn chí mạng tàn khốc gấp bội, đổi bằng tuổi thọ.",
    // The highest crit multiplier in the game, sold at a genuinely dangerous price.
    stats: { crit: 0.08, critMulti: 0.75, life: -100, resFire: -0.15, resCold: -0.15, resLight: -0.15 },
  },
];

export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

// ─────────────────────────────────────────────────────────────────────────────
// Mod pool (PoE prefix/suffix) — the whole affix surface. Each family is a `group`
// (one mod per group per item), a prefix or suffix, and a TIER table best-first
// (T1 strongest). A tier carries a value band, a spawn `weight`, and an `ilvl` gate:
// only tiers with ilvl ≤ the item's ilvl can roll, and among those the weight picks
// (top tiers are rarer AND deep-locked → the reason to farm deep). Attribute names use
// the datamine's xianxia vocabulary (Công/Sinh Lực/Vật Phòng/Pháp Phòng/Bạo…), re-skinned
// generic per the datamine's IP note. New mod = a new entry.
export interface ModTier {
  min: number;
  max: number;
  weight: number;
  ilvl: number;
}
export interface ModDef {
  group: string;
  kind: ModKind;
  stat: StatId;
  emoji: string;
  name: string; // affix flavour name (prefix = adjective, suffix reads "của X")
  pctLike: boolean; // renders as a percentage; also drives the rounding precision
  tiers: ModTier[]; // best (T1) first
  // Slots this mod may roll on. Absent = any slot. Spirit is deliberately narrow (PoE2 puts
  // it on sceptres / body armour / amulets), which is what makes a spirit roll a find rather
  // than a given — and what makes running many auras a gearing GOAL.
  slots?: GearSlot[];
  // SPAWN WEIGHT, PoE-style: how often this affix family is even considered, relative to
  // every other family. Without it every affix is equally likely, so adding one silently
  // rarefies all the others — a staple like Máu should not get rarer because a niche
  // resource affix was introduced. Bread-and-butter mods sit high, niche ones low.
  weight: number;
}

// Shared 4-tier shape so the table stays readable — same weight/ilvl skeleton, only the
// value band per stat differs.
// T1's weight and ilvl gate are the scarcity dial for the entire item chase: at weight 8 /
// ilvl 26 a single T1 landed on ~4.3% of rolls, which put ~30% of full Huyền Thoại on at least
// one — common enough that no roll was worth trading for. At weight 3 / ilvl 40 a T1 lands on
// ~1.6% of rolls, T1 becomes something depth earns rather than something the first deep map
// hands out, and each additional T1 on one item stays the ~7-12× step the curve was designed
// around. Tier VALUES are untouched — what changed is how often the top band is reached.
const flatTiers = (t1: [number, number], t2: [number, number], t3: [number, number], t4: [number, number]): ModTier[] => [
  { min: t1[0], max: t1[1], weight: 3, ilvl: 40 },
  { min: t2[0], max: t2[1], weight: 22, ilvl: 20 },
  { min: t3[0], max: t3[1], weight: 55, ilvl: 6 },
  { min: t4[0], max: t4[1], weight: 100, ilvl: 1 },
];

// The PoE affix surface, re-skinned generic per the datamine's IP note.
//   Prefixes — life / added flat damage (phys + 4 elements) / %attack | %spell / armour | ES.
//   Suffixes — the four elemental resistances / crit chance / crit multi / attack speed / evasion.
export const MOD_POOL: ModDef[] = [
  // ── Prefixes ────────────────────────────────────────────────────────────────
  { group: "life", kind: "prefix", stat: "life", emoji: "❤️", name: "Healthy", pctLike: false, weight: 1000, tiers: flatTiers([70, 100], [40, 58], [22, 34], [10, 18]) },
  { group: "armour", kind: "prefix", stat: "armour", emoji: "🛡️", name: "Reinforced", pctLike: false, weight: 620, tiers: flatTiers([40, 56], [24, 34], [12, 20], [5, 10]) },
  { group: "es", kind: "prefix", stat: "es", emoji: "🔷", name: "Radiant", pctLike: false, weight: 620, tiers: flatTiers([34, 48], [20, 30], [10, 18], [4, 9]) },
  { group: "addphys", kind: "prefix", stat: "addPhys", emoji: "⚔️", name: "Sharp", pctLike: false, weight: 450, tiers: flatTiers([10, 14], [6, 9], [3, 5], [1, 2]) },
  { group: "addfire", kind: "prefix", stat: "addFire", emoji: "🔥", name: "Flaming", pctLike: false, weight: 430, tiers: flatTiers([12, 17], [7, 11], [4, 6], [1, 3]) },
  { group: "addcold", kind: "prefix", stat: "addCold", emoji: "❄️", name: "Frozen", pctLike: false, weight: 430, tiers: flatTiers([12, 17], [7, 11], [4, 6], [1, 3]) },
  { group: "addlight", kind: "prefix", stat: "addLight", emoji: "⚡", name: "Crackling", pctLike: false, weight: 430, tiers: flatTiers([12, 17], [7, 11], [4, 6], [1, 3]) },
  { group: "atkpct", kind: "prefix", stat: "atkPct", emoji: "🗡️", name: "Vicious", pctLike: true, weight: 520, tiers: flatTiers([0.28, 0.4], [0.18, 0.26], [0.1, 0.16], [0.05, 0.09]) },
  { group: "spellpct", kind: "prefix", stat: "spellPct", emoji: "🔮", name: "Mystic", pctLike: true, weight: 520, tiers: flatTiers([0.28, 0.4], [0.18, 0.26], [0.1, 0.16], [0.05, 0.09]) },
  // ── Suffixes ────────────────────────────────────────────────────────────────
  { group: "resfire", kind: "suffix", stat: "resFire", emoji: "🔥", name: "of Fire", pctLike: true, weight: 800, tiers: flatTiers([0.16, 0.22], [0.1, 0.14], [0.06, 0.09], [0.03, 0.05]) },
  { group: "rescold", kind: "suffix", stat: "resCold", emoji: "❄️", name: "of Cold", pctLike: true, weight: 800, tiers: flatTiers([0.16, 0.22], [0.1, 0.14], [0.06, 0.09], [0.03, 0.05]) },
  { group: "reslight", kind: "suffix", stat: "resLight", emoji: "⚡", name: "of Lightning", pctLike: true, weight: 800, tiers: flatTiers([0.16, 0.22], [0.1, 0.14], [0.06, 0.09], [0.03, 0.05]) },
  // ── Resource affixes ────────────────────────────────────────────────────────
  // Spirit reserves auras. Confined to weapon / body / ring (PoE2's sceptre-body-amulet
  // shape) and given a LOW top-tier weight, so a big spirit roll is a genuine find and
  // "how many auras can I run" stays a gearing goal rather than a level-up freebie.
  {
    group: "spirit", kind: "prefix", stat: "spirit", emoji: "🕯️", name: "Spirited", pctLike: false,
    slots: ["vukhi", "giap", "nhan"],
    // Every tier is sized to actually CROSS an aura threshold on top of the levelling floor
    // — a small spirit roll that unlocks nothing would be a dead mod, which is worse than
    // not rolling at all. T4 buys a second aura, T1 buys a third.
    //
    // Weights match the shared `flatTiers` curve so spirit's tier odds are identical to
    // every other affix; only the ilvl GATES are stricter (T1 at 50 vs the usual 40), which
    // is the intended part — a big spirit roll is something you farm depth for.
    weight: 320, tiers: [
      { min: 55, max: 70, weight: 3, ilvl: 50 },
      { min: 40, max: 54, weight: 22, ilvl: 28 },
      { min: 30, max: 39, weight: 55, ilvl: 10 },
      { min: 20, max: 29, weight: 100, ilvl: 1 },
    ],
  },
  // Mana + its regen fuel every blow. Rollable anywhere and on the normal weight curve — every
  // build needs some, unlike spirit which only matters if you want auras.
  { group: "mana", kind: "prefix", stat: "mana", emoji: "🔵", name: "Furious", pctLike: false, weight: 500, tiers: flatTiers([55, 80], [34, 52], [18, 32], [8, 17]) },
  { group: "manaregen", kind: "suffix", stat: "manaRegen", emoji: "♾️", name: "of Focus", pctLike: false, weight: 380, tiers: flatTiers([9, 13], [6, 8], [3, 5], [1, 2]) },
  { group: "reschaos", kind: "suffix", stat: "resChaos", emoji: "☠️", name: "of Warding", pctLike: true, weight: 260, tiers: flatTiers([0.12, 0.18], [0.08, 0.11], [0.04, 0.07], [0.02, 0.04]) },
  { group: "crit", kind: "suffix", stat: "crit", emoji: "🎯", name: "of Precision", pctLike: true, weight: 340, tiers: flatTiers([0.06, 0.08], [0.04, 0.055], [0.025, 0.035], [0.01, 0.02]) },
  { group: "critmulti", kind: "suffix", stat: "critMulti", emoji: "💥", name: "of Ruthlessness", pctLike: true, weight: 340, tiers: flatTiers([0.28, 0.4], [0.18, 0.24], [0.1, 0.15], [0.04, 0.08]) },
  { group: "speed", kind: "suffix", stat: "speedPct", emoji: "💨", name: "of Haste", pctLike: true, weight: 320, tiers: flatTiers([0.1, 0.14], [0.06, 0.09], [0.035, 0.05], [0.015, 0.03]) },
  { group: "evasion", kind: "suffix", stat: "evasion", emoji: "🌫️", name: "of the Assassin", pctLike: false, weight: 620, tiers: flatTiers([34, 48], [20, 30], [10, 18], [4, 9]) },
];

const MOD_BY_GROUP: Record<string, ModDef> = Object.fromEntries(MOD_POOL.map((d) => [d.group, d]));

export function itemIlvl(item: GearItem): number {
  return item.ilvl ?? 1;
}
function roundVal(def: ModDef, raw: number): number {
  return def.pctLike ? Math.round(raw * 1000) / 1000 : Math.round(raw);
}

// Build the Mod a (def, tier) pair describes. `x` is the roll position inside the tier band.
function makeMod(def: ModDef, idx: number, rng: () => number, perfect = false): Mod {
  const t = def.tiers[idx]!;
  const x = perfect ? 1 : rng();
  return { group: def.group, kind: def.kind, stat: def.stat, tier: idx + 1, value: roundVal(def, t.min + x * (t.max - t.min)) };
}

// Roll ONE mod of a kind. PoE's model: every ELIGIBLE (affix family × tier) pair goes into a
// single flat pool weighted by `def.weight × tier.weight`, and one entry is drawn from it.
//
// Why not "pick a family, then pick its tier": that makes every family equally likely, so a
// staple like Máu gets rarer purely because a niche affix was added, and a family whose top
// tiers are still ilvl-locked stays as common as one fully unlocked. Weighting the flat pool
// fixes both — depth genuinely widens the pool, and a family's share is what we designed it
// to be rather than 1/N.
//
// Families already on the item are excluded (one mod per group), as are affixes restricted
// to other slots. Returns null when nothing is eligible. Pure given rng.
function rollOneMod(kind: ModKind, existing: Mod[], ilvl: number, rng: () => number, perfect = false, slot?: GearSlot): Mod | null {
  const used = new Set(existing.map((m) => m.group));
  const cands = MOD_POOL.filter((d) => d.kind === kind && !used.has(d.group) && (!d.slots || !slot || d.slots.includes(slot)));
  if (cands.length === 0) return null;

  // `perfect` (jackpot/box crafting) forces T1, so the pool is one entry per family.
  if (perfect) {
    const entries = cands.map((def) => ({ def, idx: 0, w: def.weight }));
    const total = entries.reduce((a, e) => a + e.w, 0);
    let r = rng() * total;
    for (const e of entries) {
      r -= e.w;
      if (r <= 0) return makeMod(e.def, e.idx, rng, true);
    }
    return makeMod(entries[entries.length - 1]!.def, 0, rng, true);
  }

  const entries: { def: ModDef; idx: number; w: number }[] = [];
  for (const def of cands) {
    // A family whose every tier is ilvl-locked still offers its lowest tier, so a low-level
    // drop is never left with an empty pool.
    const open = def.tiers.map((t, i) => ({ t, i })).filter(({ t }) => t.ilvl <= ilvl);
    const tiers = open.length > 0 ? open : [{ t: def.tiers[def.tiers.length - 1]!, i: def.tiers.length - 1 }];
    for (const { t, i } of tiers) entries.push({ def, idx: i, w: def.weight * t.weight });
  }
  const total = entries.reduce((a, e) => a + e.w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return makeMod(e.def, e.idx, rng);
  }
  return makeMod(entries[entries.length - 1]!.def, entries[entries.length - 1]!.idx, rng);
}

// Item level at which a 🟠 Huyền Thoại rolls its FOURTH affix on each side. Below it the top
// rarity is still the best thing you can find, just not yet its maximum shape — the last
// slot is something depth grants, so a perfect item stays a long-run goal instead of a
// lucky first-hour drop.
export const LEGENDARY_FULL_ILVL = 40;

// How many pre/suf slots a fresh drop fills (leaves crafting room; `full` = fill the cap).
// 🟠 Huyền Thoại always fills what it is allowed — the top rarity is never short-changed —
// but how much it is ALLOWED depends on the depth it dropped at (LEGENDARY_FULL_ILVL).
function fillCount(cap: number, rng: () => number, rarity?: Rarity, ilvl = 1): number {
  if (cap <= 0) return 0;
  if (rarity === 4) return ilvl >= LEGENDARY_FULL_ILVL ? cap : cap - 1;
  if (cap === 1) return rng() < 0.65 ? 1 : 0; // magic slot: usually filled
  return cap - (rng() < 0.4 ? 1 : 0); // rare/epic: mostly full, sometimes one open
}

// Roll a fresh mod set for a drop of this rarity at this ilvl. `full` fills the caps
// (box/jackpot); `perfect` forces every mod to T1-max. At least 1 mod on any modded rarity.
export function rollMods(rarity: Rarity, ilvl: number, rng: () => number, opts: { full?: boolean; perfect?: boolean; slot?: GearSlot } = {}): Mod[] {
  const cap = MOD_CAP[rarity];
  if (cap.pre + cap.suf === 0) return [];
  let preN = opts.full || opts.perfect ? cap.pre : fillCount(cap.pre, rng, rarity, ilvl);
  let sufN = opts.full || opts.perfect ? cap.suf : fillCount(cap.suf, rng, rarity, ilvl);
  if (preN + sufN === 0) {
    if (cap.pre >= cap.suf) preN = 1;
    else sufN = 1;
  }
  const mods: Mod[] = [];
  for (let i = 0; i < preN; i++) {
    const m = rollOneMod("prefix", mods, ilvl, rng, opts.perfect, opts.slot);
    if (m) mods.push(m);
  }
  for (let i = 0; i < sufN; i++) {
    const m = rollOneMod("suffix", mods, ilvl, rng, opts.perfect, opts.slot);
    if (m) mods.push(m);
  }
  return mods;
}

// A one-line render of a mod for panels/logs (e.g. "⚔️ Sắc Bén: Công +7 (T2)").
export function modLabel(m: Mod): string {
  const def = MOD_BY_GROUP[m.group];
  const emoji = def?.emoji ?? "•";
  const name = def?.name ?? m.group;
  const val = def?.pctLike ? `${(m.value * 100).toFixed(1)}%` : `${m.value}`;
  const sign = def?.pctLike || m.value >= 0 ? "+" : "";
  return `${emoji} ${name}: ${sign}${val} (T${m.tier})`;
}

// The floor-1 enemy stat block a stage carries. Kept as a self-contained shape (the old
// combat `Stats` type is gone) — P5 (maps) rebuilds enemy generation onto the 5-element
// combat core; the loot/gate half of Stage (below) is what the shipped engine still uses.
export interface EnemyBase {
  hp: number;
  atk: number;
  def: number;
  res: number;
  eva: number;
  crit: number;
  critDmg: number;
}

// The elemental theme an ải leans toward — replaces the old physical/magic axis. Enemy
// generation (P5) maps this to the 5-element combat model; for now it's stage flavour.
export type StageTheme = "phys" | "fire" | "cold" | "light" | "chaos";

// A monster's combat ARCHETYPE — the PoE-style role that reshapes the region's average
// enemy into a distinct fight (a swarmer trades life for speed, a brute the reverse). The
// numeric profile lives in ARCHETYPES (rpg-maps.ts, next to genMonster); here it's just the
// tag the region pool stamps each name with. "normal" = the region base untouched.
export type ArchetypeId = "normal" | "brute" | "swarmer" | "skirmisher" | "caster" | "glasscannon";

// One entry in a region's monster pool: a flavour name + the archetype that reshapes the
// region base when this kind is rolled. genMonster picks one uniformly per non-boss floor.
export interface MonsterKind {
  name: string;
  archetype: ArchetypeId;
}

export interface Stage {
  id: string;
  name: string;
  emoji: string;
  order: number;
  unlockAt: { stage: string; floor: number } | null; // gate: need bestFloor[stage] ≥ floor; null = open
  enemyBase: EnemyBase; // floor-1 enemy; scaled by enemyGrowth each floor
  enemyGrowth: number; // per-floor stat multiplier increment
  theme: StageTheme; // the ải's elemental flavour (enemy generation reads it in P5)
  bossEvery: number; // milestone floors (bosses) — richer, guaranteed drop
  lootMult: number; // flat multiplier on material yield for this stage
  rarityBias: number; // added to floor-based rarity weighting (deeper stages drop better)
  enemies: MonsterKind[]; // flavour name + combat archetype pool
  boss: string; // milestone enemy name
  materialBias?: Partial<Record<MaterialId, number>>; // per-material yield tilt (default ×1) — each ải's signature farm
}

// Five tiers, each gated behind reaching floor 15 of the prior one, each with a
// harsher enemy curve and a fatter loot multiplier. Endless — there is no floor
// cap, difficulty just ramps until the hero dies or runs out of lương thực; the
// deepest-floor number is the score. New tier = new entry.
export const STAGES: Stage[] = [
  {
    id: "rungma",
    name: "Haunted Forest",
    emoji: "🌲",
    order: 1,
    unlockAt: null,
    enemyBase: { hp: 48, atk: 8, def: 2, res: 2, eva: 0, crit: 0.02, critDmg: 1.4 },
    enemyGrowth: 0.1,
    theme: "phys",
    bossEvery: 10,
    lootMult: 1,
    rarityBias: 0,
    enemies: [
      { name: "Goblin", archetype: "swarmer" },
      { name: "Grey Wolf", archetype: "skirmisher" },
      { name: "Venom Spider", archetype: "caster" },
      { name: "Wraith", archetype: "glasscannon" },
      { name: "Giant Centipede", archetype: "brute" },
    ],
    boss: "Lord of the Haunted Forest",
    materialBias: { manh: 1.4 }, // lò cày 🔩 Enhancement Shard
  },
  {
    id: "hangbang",
    name: "Frozen Cavern",
    emoji: "❄️",
    order: 2,
    unlockAt: { stage: "rungma", floor: 15 },
    enemyBase: { hp: 108, atk: 16, def: 6, res: 5, eva: 0, crit: 0.03, critDmg: 1.5 },
    enemyGrowth: 0.11,
    theme: "cold",
    bossEvery: 10,
    lootMult: 1.5,
    rarityBias: 0.05,
    enemies: [
      { name: "Ice Bear", archetype: "normal" },
      { name: "Snow Sprite", archetype: "caster" },
      { name: "Frost Golem", archetype: "brute" },
      { name: "Frost Wyrmling", archetype: "skirmisher" },
    ],
    boss: "Queen of Frost",
    materialBias: { tinhchat: 1.5 }, // lò cày ✨ Essence
  },
  {
    id: "samac",
    name: "Cinder Desert",
    emoji: "🏜️",
    order: 3,
    unlockAt: { stage: "hangbang", floor: 15 },
    enemyBase: { hp: 205, atk: 26, def: 9, res: 7, eva: 0, crit: 0.04, critDmg: 1.5 },
    enemyGrowth: 0.12,
    theme: "fire",
    bossEvery: 10,
    lootMult: 2.2,
    rarityBias: 0.1,
    enemies: [
      { name: "Fire Scorpion", archetype: "skirmisher" },
      { name: "Sand Golem", archetype: "brute" },
      { name: "Mummy", archetype: "caster" },
      { name: "Flame Wisp", archetype: "glasscannon" },
    ],
    boss: "Undying Pharaoh",
    materialBias: { manh: 1.3 }, // 🔩 + gear (gear tilt qua rarityBias)
  },
  {
    id: "thapco",
    name: "Forgotten Spire",
    emoji: "🗼",
    order: 4,
    unlockAt: { stage: "samac", floor: 15 },
    enemyBase: { hp: 430, atk: 47, def: 15, res: 13, eva: 0, crit: 0.05, critDmg: 1.6 },
    enemyGrowth: 0.12,
    theme: "light",
    bossEvery: 10,
    lootMult: 3.2,
    rarityBias: 0.16,
    enemies: [
      { name: "Ghost Knight", archetype: "brute" },
      { name: "Stone Fiend", archetype: "swarmer" },
      { name: "Dark Mage", archetype: "caster" },
      { name: "Gargoyle", archetype: "skirmisher" },
    ],
    boss: "Warden of the Spire",
  },
  {
    id: "vuctham",
    name: "The Abyss",
    emoji: "🌌",
    order: 5,
    unlockAt: { stage: "thapco", floor: 15 },
    enemyBase: { hp: 880, atk: 90, def: 24, res: 22, eva: 0, crit: 0.06, critDmg: 1.7 },
    enemyGrowth: 0.12,
    theme: "chaos",
    bossEvery: 10,
    lootMult: 4.5,
    rarityBias: 0.24,
    enemies: [
      { name: "Abyss Demon", archetype: "brute" },
      { name: "Living Shadow", archetype: "skirmisher" },
      { name: "Dread Drake", archetype: "glasscannon" },
      { name: "Soul Devourer", archetype: "caster" },
    ],
    boss: "Demon Lord of the Abyss",
    materialBias: { tinhchat: 1.3 }, // Legendary gear (rarityBias) + ✨
  },
];

export const STAGE_BY_ID: Record<string, Stage> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const MATERIALS: Record<MaterialId, { name: string; emoji: string; kind: string }> = {
  luongthuc: { name: "Provision", emoji: "🍖", kind: "Nhiên liệu — 1 cái/tầng, hết là về" },
  thuoc: { name: "Life Potion", emoji: "🧪", kind: "Tự uống khi máu nguy hiểm" },
  manh: { name: "Enhancement Shard", emoji: "🔩", kind: "Cường hóa trang bị" },
  tinhchat: { name: "Essence", emoji: "✨", kind: "Lên cấp nhân vật" },
  bua: { name: "Blessed Charm", emoji: "🛡️", kind: "Chống vỡ khi cường hóa (fail chỉ đứng yên)" },
  dotpha: { name: "Đá Đột Phá", emoji: "🔶", kind: "Phá trần cường hóa — dùng khi món chạm trần (Đột Phá)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Gear → build stat contribution. One item folds into a Partial<RawBuild>-shaped
// map keyed by StatId; the build layer (rpg-build.ts) sums every equipped item into
// its accumulator. FLAT pools (life/es/armour/evasion/atk/spell/added-damage) scale
// with rarity band × drop roll × enhancement; %-like stats (atkPct/res*/crit/…) fold
// in flat — enhancement scales the base only, mods are the drop/craft's frozen luck.
// ─────────────────────────────────────────────────────────────────────────────

export function gearStats(item: GearItem): Partial<Record<StatId, number>> {
  // Uniques are FIXED: their catalog stats are the whole contribution, scaled ONLY by the
  // +N enhance system — no rarity mult, no drop roll, no rolled mods (fixed by design).
  if (item.uniqueId) {
    const uniq = UNIQUE_BY_ID[item.uniqueId];
    if (uniq) {
      const scale = (1 + item.plus * ENHANCE_PER_PLUS) * (1 + STAR_MORE * (item.star ?? 0));
      const rollMul = item.roll ?? 1; // upside quality roll (legacy uniques = 1 = perfect)
      const out: Partial<Record<StatId, number>> = {};
      for (const key of Object.keys(uniq.stats) as StatId[]) {
        const v = uniq.stats[key];
        if (v === undefined) continue;
        const rolled = v > 0 ? v * rollMul : v; // band the UPSIDES; signature downsides stay fixed
        out[key] = PCT_STATS.has(key) ? rolled : rolled * scale; // %-like stats stay flat, like normal implicits
      }
      return out;
    }
    // Unknown uniqueId (legacy/removed catalog entry) → fall through to the normal path.
  }
  const base = GEAR_BASES[item.base];
  if (!base) return {};
  // ⭐ Ghép Sao folds a +STAR_MORE/star "more" into the SAME multiplier as enhancement (so it lifts base
  // implicits, not the %-like mods or the rolled-mod values — those get their own per-star tier upgrade).
  const mult = RARITIES[item.rarity].mult * item.roll * (1 + item.plus * ENHANCE_PER_PLUS) * (1 + STAR_MORE * (item.star ?? 0));
  const out: Partial<Record<StatId, number>> = {};
  for (const key of Object.keys(base.stats) as StatId[]) {
    const v = base.stats[key];
    if (v === undefined) continue;
    out[key] = (out[key] ?? 0) + (PCT_STATS.has(key) ? v : v * mult); // %-like implicits stay flat
  }
  if (item.mods) for (const m of item.mods) out[m.stat] = (out[m.stat] ?? 0) + m.value;
  return out;
}

// Whether a floor is one of a stage's boss milestones. Floor 0 is the pre-run state, not a
// boss — the guard matters because the Trạm Dịch cadence and the loot/gold multipliers all
// key off this one rule.
export function isBossFloor(stage: Stage, floor: number): boolean {
  return floor > 0 && floor % stage.bossEvery === 0;
}

// Between-floor recovery: passive regen, then an auto-potion if still in the red.
// Returns the hero's HP going into the next floor and whether a potion was spent.
export function recover(hpAfter: number, maxHp: number, potions: number): { hp: number; potionUsed: boolean } {
  let hp = Math.min(maxHp, hpAfter + Math.round(maxHp * REGEN_FRAC));
  let potionUsed = false;
  if (potions > 0 && hp < maxHp * POTION_THRESHOLD) {
    hp = Math.min(maxHp, hp + Math.round(maxHp * POTION_HEAL_FRAC));
    potionUsed = true;
  }
  return { hp, potionUsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loot — what a cleared floor drops. Materials scale with depth × stage.lootMult;
// gear drops on a floor-scaled chance with a floor+stage-biased rarity, and every
// boss floor guarantees a gear drop of at least Hiếm. Salvage keeps every drop
// meaningful, so nothing is dead weight (genre anti-pattern #4).
// ─────────────────────────────────────────────────────────────────────────────

export interface FloorDrops {
  gear: GearItem[];
  materials: Partial<Record<MaterialId, number>>;
  coins: number; // gold dropped this floor — the expedition faucet (see floorGold)
  event?: { emoji: string; label: string }; // rare floor flavour (kho báu / quái tinh / chấn động) for the log
  jackpot?: boolean; // a "chấn động" godroll dropped this floor — the engine announces it
  unique?: { name: string }; // a 🟤 Unique dropped this floor — the engine logs it distinctly
  gem?: { inst: SupportGemInstance; name: string }; // a 💠 support gem dropped — inst banked into gemBag, name logged
}

function newId(rng: () => number): string {
  // Instance id — not security-sensitive (matches masoi.ts's Math.random note).
  return `g${Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`;
}

// Weighted rarity pick: deeper floor + richer stage push probability mass up the
// tiers. floorScale ramps ~0→0.3 over the first ~30 floors.
function rollRarity(stage: Stage, floor: number, rng: () => number, minRarity = 0): Rarity {
  const bias = stage.rarityBias + Math.min(0.3, floor * 0.008);
  const weights = [
    Math.max(0.05, 1 - bias * 2), // Thường
    0.6 + bias, // Khá
    0.28 + bias, // Hiếm
    0.055 + bias * 0.45, // Sử Thi
    0.0018 + bias * 0.03, // Huyền Thoại — the long tail's prize, deliberately scarce
  ];
  for (let i = 0; i < minRarity; i++) weights[i] = 0;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i as Rarity;
  }
  return (weights.length - 1) as Rarity;
}

export function rollGear(
  baseId: string,
  rarity: Rarity,
  rng: () => number,
  ilvl = 1,
  modOpts: { full?: boolean; perfect?: boolean } = {},
): GearItem {
  const base = GEAR_BASES[baseId]!;
  return {
    id: newId(rng),
    base: baseId,
    slot: base.slot,
    rarity,
    roll: ROLL_MIN + rng() * (ROLL_MAX - ROLL_MIN),
    plus: 0,
    ilvl,
    mods: rollMods(rarity, ilvl, rng, { ...modOpts, slot: base.slot }),
  };
}

// A gear item of any slot at a fixed rarity/ilvl — the jackpot helper (no stage bias).
function anyGearDrop(rarity: Rarity, ilvl: number, rng: () => number, modOpts: { full?: boolean; perfect?: boolean } = {}): GearItem {
  const slot = GEAR_SLOTS[Math.floor(rng() * GEAR_SLOTS.length)]!.id;
  const bases = GEAR_BY_SLOT[slot];
  return rollGear(bases[Math.floor(rng() * bases.length)]!, rarity, rng, ilvl, modOpts);
}

// Roll a random Unique item as a fresh GearItem — a fixed-stat drop keyed to a UNIQUES
// entry. Its slot/base come from the catalog; rarity is stamped Legendary (its display is
// the 🟤 Unique tier, but a real Rarity keeps NPC-sell/salvage math well-defined). `plus`
// starts 0 like any drop, so enhancement can still climb it. `floor` is the ilvl for
// bookkeeping only — Unique stats ignore ilvl. Pure given rng.
// A Unique's UPSIDE stats roll a quality % in [UNIQUE_ROLL_MIN, 1] (its signature DOWNSIDE
// stays fixed), stored in the existing `roll` field — so re-drops aren't byte-identical and a
// "perfect roll" is a long-tail chase. Legacy uniques carry roll:1 (a grandfathered 100%), so
// no migration is needed. gearStats folds `roll` into the positive stats only.
const UNIQUE_ROLL_MIN = 0.82;

export function rollUnique(floor: number, rng: () => number): GearItem {
  const uniq = UNIQUES[Math.floor(rng() * UNIQUES.length)]!;
  return {
    id: newId(rng),
    base: uniq.base,
    slot: uniq.slot,
    rarity: 4,
    roll: UNIQUE_ROLL_MIN + rng() * (1 - UNIQUE_ROLL_MIN), // upside quality roll
    plus: 0,
    ilvl: floor,
    uniqueId: uniq.id,
  };
}

function randomGearDrop(stage: Stage, floor: number, rng: () => number, minRarity = 0): GearItem {
  const slot = GEAR_SLOTS[Math.floor(rng() * GEAR_SLOTS.length)]!.id;
  const bases = GEAR_BY_SLOT[slot];
  const baseId = bases[Math.floor(rng() * bases.length)]!;
  return rollGear(baseId, rollRarity(stage, floor, rng, minRarity), rng, floor); // ilvl = floor
}

// `uniqueMul` (default 1) scales ONLY the 🟤 Unique-drop chance — the Atlas Tree's
// uniqueMul knob, fed live from the profile by the expedition engine. Every other yield
// (materials/gold/shard) is scaled by the caller (mergeLoot) after this, so the loot-side
// meta stays in one place per lever.
export function rollFloorLoot(stage: Stage, floor: number, rng: () => number, modifier?: WeeklyModifier, uniqueMul = 1): FloorDrops {
  const materials: Partial<Record<MaterialId, number>> = {};
  const boss = isBossFloor(stage, floor);

  // Enhancement shards — the reliable trickle, scales with depth.
  const shards = Math.round((1 + floor * 0.4) * stage.lootMult * (0.7 + rng() * 0.6));
  if (shards > 0) materials.manh = shards;

  // Growth essence — rarer, chunkier on deeper floors.
  if (rng() < 0.4 + Math.min(0.4, floor * 0.01)) {
    materials.tinhchat = Math.max(1, Math.round((1 + floor * 0.12) * stage.lootMult * (0.6 + rng() * 0.8)));
  }

  // Potion — occasional top-up so a run can self-sustain a little.
  if (rng() < 0.06) materials.thuoc = 1;

  // Boss milestones dump a bonus pile.
  if (boss) {
    materials.manh = (materials.manh ?? 0) + Math.round(6 * stage.lootMult);
    materials.tinhchat = (materials.tinhchat ?? 0) + Math.round(3 * stage.lootMult);
    materials.thuoc = (materials.thuoc ?? 0) + 1;
    // 🔶 Đá Đột Phá — the breakthrough gate's material, boss-gated so clearing bosses is the
    // free path to phá trần (the /rpg supply buy is the coin-sink alternative).
    if (rng() < 0.5) materials.dotpha = (materials.dotpha ?? 0) + 1;
  }

  const gear: GearItem[] = [];
  const gearChance = 0.1 + Math.min(0.12, floor * 0.004);
  if (boss) gear.push(randomGearDrop(stage, floor, rng, 2)); // boss guarantees ≥ Hiếm
  else if (rng() < gearChance) gear.push(randomGearDrop(stage, floor, rng));

  // 🟤 Unique drop — a rare fixed-stat, build-defining item. Boss floors pay a much fatter
  // shot at one; it stacks on top of the normal gear drop (it's not one of the tiers).
  let unique: FloorDrops["unique"];
  if (rng() < (boss ? UNIQUE_BOSS_CHANCE : UNIQUE_BASE_CHANCE) * uniqueMul) {
    const item = rollUnique(floor, rng);
    gear.push(item);
    unique = { name: UNIQUE_BY_ID[item.uniqueId!]?.name ?? "Unique" };
  }

  let coins = floorGold(stage, floor, rng);

  // Rare floor events — the RNG spice, non-boss floors only, mutually exclusive and checked
  // rarest-first (a boss floor is already its own event). Each mutates the pile + flags a log.
  let event: FloorDrops["event"];
  let jackpot = false;
  if (!boss) {
    // Depth nudges the odds, but never dwarfs the base — the bonus caps at one extra base's
    // worth, so a deep floor is twice as likely to pay out, not five times.
    const jackpotChance = JACKPOT_BASE_CHANCE + Math.min(JACKPOT_BASE_CHANCE, floor * 0.00005);
    if (rng() < jackpotChance) {
      gear.push(anyGearDrop(4, JACKPOT_ILVL, rng, { full: true })); // guaranteed Huyền Thoại, full canvas — tiers still rolled
      jackpot = true;
      event = { emoji: "🌟", label: "CHẤN ĐỘNG — rơi đồ Huyền Thoại full dòng!" };
    } else if (rng() < TREASURE_CHANCE) {
      materials.tinhchat = (materials.tinhchat ?? 0) + Math.max(2, Math.round((2 + floor * 0.3) * stage.lootMult));
      materials.manh = (materials.manh ?? 0) + Math.round(8 * stage.lootMult);
      coins = Math.round(coins * 3);
      event = { emoji: "🏛️", label: "Tầng kho báu — nguyên liệu + vàng gấp bội!" };
    } else if (rng() < ELITE_CHANCE) {
      gear.push(randomGearDrop(stage, floor, rng, 2)); // quái tinh drops a bonus ≥ Hiếm
      event = { emoji: "💎", label: "Quái tinh xuất hiện — rơi thêm trang bị quý!" };
    }
  }

  // A few bonus Enhancement Shards on most floors — the extra đập-đồ fuel that keeps a
  // cleared floor feeling rewarding (bosses give a fatter handful). Coin-neutral.
  if (boss || rng() < 0.5) {
    materials.manh = (materials.manh ?? 0) + Math.round((boss ? 5 : 2) * stage.lootMult);
  }

  // Per-stage material bias — each ải leans toward its signature material (captures the
  // boss pile + treasure bonus too, since it's applied after every material is tallied).
  if (stage.materialBias) {
    for (const key of Object.keys(materials) as MaterialId[]) {
      const bias = stage.materialBias[key];
      if (bias && bias !== 1) materials[key] = Math.round((materials[key] ?? 0) * bias);
    }
  }

  // 💠 Support-gem drop — the build-transformation loot chase. Support-only: a random
  // support gem the player can link into their skill. Skills are never dropped (a
  // cross-class skill gem is dead weight), so this activates the deepest build axis
  // without the archer-loots-Fireball problem. Independent of the gear/event rolls.
  let gem: FloorDrops["gem"];
  if (rng() < (boss ? GEM_BOSS_CHANCE : GEM_DROP_CHANCE)) {
    const def = SUPPORT_GEMS[Math.floor(rng() * SUPPORT_GEMS.length)]!;
    gem = { inst: newSupportGem(def.id), name: def.name };
  }

  const drops: FloorDrops = { gear, materials, coins, event, jackpot, unique, gem };
  return modifier?.mutateLoot?.(drops) ?? drops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade / salvage economics — pure cost + apply. Coins are external (the
// command deducts them via the guild ledger); these own the material side.
// ─────────────────────────────────────────────────────────────────────────────

// Character level-up: ✨ Essence ONLY — deliberately NO coin cost. Players drown in
// materials and starve for coin, so levelling drains the abundant currency and never the
// scarce one. Coins keep their sinks elsewhere (consumables, enhance, market tax).
//
// The curve is GEOMETRIC (PoE's shape): each level costs LEVEL_GROWTH× the one before, so the
// early game flies and the last stretch is a genuine commitment.
//
// The growth rate is set against MEASURED income, not a guess: the journal shows real players
// banking ~1,772 ✨ per expedition (~27.5k a day). At 1.14 the whole climb came to 12.5k —
// seven runs, half a day, i.e. no curve at all. At 1.20 it totals ~114k: level 10 still costs
// ~15 ✨ (instant), while level 49 alone costs ~19k, about ten expeditions for that single
// level. That is what makes max level a season goal and gives the death penalty something to
// bite into. Re-derive this if loot rates ever move.
const LEVEL_COST_BASE = 2.5;
const LEVEL_GROWTH = 1.2;

export function levelUpCost(level: number): { tinhchat: number } {
  return { tinhchat: Math.max(1, Math.round(LEVEL_COST_BASE * Math.pow(LEVEL_GROWTH, level))) };
}

// Essence forfeited for dying, as a fraction of what the hero is carrying. Ramps with level
// so an early death is a shrug and a late one really hurts — the deeper you are, the more a
// careless push costs. Mirrors PoE's "no penalty early, 10% in maps" shape.
export const DEATH_XP_PENALTY_MAX = 0.12;
export const DEATH_PENALTY_FREE_LEVEL = 8; // below this, dying costs no Essence at all

export function deathEssencePenalty(level: number, essence: number): number {
  if (level <= DEATH_PENALTY_FREE_LEVEL || essence <= 0) return 0;
  const ramp = Math.min(1, (level - DEATH_PENALTY_FREE_LEVEL) / (MAX_LEVEL - DEATH_PENALTY_FREE_LEVEL));
  return Math.floor(essence * DEATH_XP_PENALTY_MAX * ramp);
}

// How many levels the profile can afford RIGHT NOW from its ✨ tinh chất — powers the
// bulk "Nâng tối đa" path (loop the single-level rule so the number can never drift).
export function levelUpsAffordable(p: RpgProfile): number {
  let n = 0;
  let tinh = p.materials.tinhchat ?? 0;
  let level = p.level;
  while (level < MAX_LEVEL) {
    const cost = levelUpCost(level);
    if (tinh < cost.tinhchat) break;
    tinh -= cost.tinhchat;
    level++;
    n++;
  }
  return n;
}

// Gear enhancement: +plus → +(plus+1). Costs scale with the target level.
export function enhanceCost(plus: number): { manh: number; coins: number } {
  return { manh: 3 + plus * 2, coins: 20 * (plus + 1) };
}

// Salvaging gear yields shards by rarity + enhancement sunk in — lossy vs having
// kept it, but nothing is ever pure trash.
export function salvageYield(item: GearItem): { manh: number } {
  const byRarity = [2, 4, 8, 16, 32];
  return { manh: byRarity[item.rarity]! + item.plus * 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ Ghép Sao (star merge) — the item DEPTH axis, distinct from +N enhance. Fusing same-slot
// fodder into a piece raises its ⭐ 0→MAX_STAR. Each star does TWO things enhance can't: a flat
// +STAR_MORE "more" on the item's base stats (folded into gearStats' scale), AND it upgrades the
// item's single WORST rolled mod one tier (T4→T3→T2) — the only way to improve a frozen-at-drop mod.
// The escalating fodder count (mergeFodderNeeded) is the sink that eats the gear-drop surplus, and
// the coin cost is a deliberate coin sink. Pure — the command/agent shell owns bag + ledger writes.
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_STAR = 5;
export const STAR_MORE = 0.07; // +7% item base stats per ⭐

// Same-slot fodder items consumed to go currentStar → currentStar+1 (1,2,4,6,9 → 22 total for ⭐5).
export function mergeFodderNeeded(currentStar: number): number {
  return [1, 2, 4, 6, 9][currentStar] ?? 9;
}
// Coin cost of that merge — a coin SINK to cool the RPG's faucet-heavy economy. Quadratic, so
// the last star costs more than the first four together (12.5k of the 21.5k total): star 5 is
// meant to be a decision about one chosen item, not something every drop gets on the way past.
export function mergeCoinCost(currentStar: number): number {
  return 500 * (currentStar + 1) * (currentStar + 1);
}

// The tier ⭐ merging can lift a mod TO. Crafting stops one band short of the top: T1 is the
// one thing only a drop can grant. Without this floor, merging was a deterministic, coin-priced
// route to a full T1 item — it made the drop table's whole top band decorative, since any item
// could be walked up to the same place for a predictable price.
export const MERGE_BEST_TIER = 2;

// Upgrade the single worst (highest tier number) rolled mod one tier, re-rolling its value in the
// better band. No-op once every mod has reached MERGE_BEST_TIER (crafting cannot reach T1). Pure
// given rng. Returns a NEW mods array + what changed.
function upgradeWorstMod(mods: Mod[], rng: () => number): { mods: Mod[]; upgraded: Mod | null } {
  let worstIdx = -1;
  for (let i = 0; i < mods.length; i++) {
    if (mods[i]!.tier > MERGE_BEST_TIER && (worstIdx < 0 || mods[i]!.tier > mods[worstIdx]!.tier)) worstIdx = i;
  }
  if (worstIdx < 0) return { mods, upgraded: null };
  const m = mods[worstIdx]!;
  const def = MOD_BY_GROUP[m.group];
  if (!def) return { mods, upgraded: null };
  const newTier = m.tier - 1; // 1-based, lower = better
  const band = def.tiers[newTier - 1]!; // tiers[] is 0-based (index 0 = T1)
  const upgraded: Mod = { ...m, tier: newTier, value: roundVal(def, band.min + rng() * (band.max - band.min)) };
  const next = mods.slice();
  next[worstIdx] = upgraded;
  return { mods: next, upgraded };
}

// Add one ⭐ to an item: +1 star and its worst mod upgraded a tier. Caller gates star < MAX_STAR and
// pays the fodder + coins. Pure given rng.
export function starUpItem(item: GearItem, rng: () => number): { item: GearItem; upgraded: Mod | null } {
  const up = item.mods && item.mods.length ? upgradeWorstMod(item.mods, rng) : { mods: item.mods, upgraded: null };
  return { item: { ...item, star: (item.star ?? 0) + 1, mods: up.mods }, upgraded: up.upgraded };
}

// ─────────────────────────────────────────────────────────────────────────────
// Coin faucet — the ONLY place the RPG mints coin: expedition floor gold + the NPC
// quick-sell. The sinks (rations/enhance/level/market tax) are unchanged, so the
// RPG stays net-sink for a progressing player and net-faucet for a maxed one.
// Pure math; the imperative shell (expeditions / commands) owns the coin ledger.
// ─────────────────────────────────────────────────────────────────────────────

// NPC vendor floor price of a gear item, by rarity, scaled by enhancement.
// Deliberately LOW (vendor-trash) so the player marketplace still beats it for good
// gear — this is a guaranteed liquidity floor for junk, not the best price.
export const NPC_SELL_BASE = [60, 180, 500, 1400, 3500] as const; // index === Rarity
export function npcSellPrice(item: GearItem): number {
  return Math.round(NPC_SELL_BASE[item.rarity]! * (1 + item.plus * 0.15));
}

// Gold dropped on clearing a floor — the expedition faucet, tuned NET-NEUTRAL: gold hovers
// around the ration cost (15/floor) at your clear depth and only pulls MILDLY ahead when
// farming below your ceiling, so the RPG funds its OWN consumables (rations/potions/enhance)
// without exporting a coin surplus into the SHARED server ledger that /baucua, /coin, /xoso
// depend on. Depth scales as √floor and stage richness as √lootMult, so a deep run in the
// richest region stays bounded (was linear×lootMult → ~390/floor deep, a runaway faucet).
// Bosses pay 3×. Under-nerfed on purpose (players were coin-starved) — tune vs rpg-telemetry.
export function floorGold(stage: Stage, floor: number, rng: () => number): number {
  const base = (10 + 2.4 * Math.sqrt(floor)) * Math.sqrt(stage.lootMult) * (0.85 + rng() * 0.3);
  return Math.round(base * (isBossFloor(stage, floor) ? 3 : 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Map level & the reward penalty for farming beneath yourself (PoE's XP-penalty shape).
//
// The problem: a maxed hero could sit in the opening region at tier 1 forever — trivially
// safe, and still paying full gold + Essence. The fix is PoE's: rewards scale down with the
// gap between the CHARACTER's level and the AREA's level, softened by a "safe zone" that
// widens as you level, so nobody is punished for normal play.
//
// The area's level is derived from what the player CHOOSES — region + map tier — and never
// from the floor they happen to be standing on. Every expedition starts at floor 1, so a
// floor-based penalty would tax the opening stretch of every run for no reason.
// ─────────────────────────────────────────────────────────────────────────────

// Region 5 is worth 45 area levels so a capped hero running the deepest region is never
// penalised at any tier — the endgame region IS appropriate content for the level cap.
const STAGE_LEVEL_STEP = 9; // each region is worth this much "area level"
const TIER_LEVEL_STEP = 3; // each map tier above T1 adds this much
const REWARD_PENALTY_FLOOR = 0.25; // rewards never fall below this fraction
// PoE's 2.5 exponent assumes its 1-100 level scale; ours tops out at 50, so the same gap is
// twice as "deep" here and 2.5 slammed almost everything straight onto the floor — the
// journal showed even a hero who HAD climbed to tier 5 getting the maximum cut. A gentler
// exponent keeps a wide middle band where pushing one or two tiers visibly pays.
const REWARD_PENALTY_EXP = 1.6;

// The effective level of a map: which region, dialled up by its tier.
export function mapLevel(stage: Stage, tier: number): number {
  return stage.order * STAGE_LEVEL_STEP + (Math.max(1, tier) - 1) * TIER_LEVEL_STEP;
}

// PoE's safe zone: no penalty at all inside it, and it widens every 16 levels so a veteran
// has more room than a newcomer.
function safeZone(level: number): number {
  return 3 + Math.floor(level / 16);
}

// Reward multiplier on gold + Essence for a hero of `level` running this map. 1 = untouched.
// Only ever penalises farming BELOW your level — out-levelling content is the abuse being
// discouraged; running something harder than you is already its own risk and pays in full.
export function rewardMultiplier(level: number, stage: Stage, tier: number): number {
  const diff = Math.max(0, level - mapLevel(stage, tier) - safeZone(level));
  if (diff <= 0) return 1;
  const mult = Math.pow((level + 5) / (level + 5 + Math.pow(diff, REWARD_PENALTY_EXP)), 1.5);
  return Math.max(REWARD_PENALTY_FLOOR, mult);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loadout / bag QoL — pure selection helpers. `autoEquipBest` / `maxHp` need the
// build math and live in rpg-build.ts (to keep this module free of the build layer
// it feeds). This one is pure item-list filtering, so it stays here.
// ─────────────────────────────────────────────────────────────────────────────

// Bag items at or below `maxRarity` — the selection for bulk salvage / bulk NPC-sell.
// Equipped gear is not in the bag, so it is inherently safe; Uniques are excluded here
// too (like Epic/Legendary they never get a bulk button — build-defining loot must not be
// fat-fingered away; a single-item salvage/sell of a unique is still allowed elsewhere).
export function bagItemsUpToRarity(bag: GearItem[], maxRarity: Rarity): GearItem[] {
  return bag.filter((it) => !it.uniqueId && it.rarity <= maxRarity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Progression helpers
// ─────────────────────────────────────────────────────────────────────────────

// Is a stage unlocked for this profile? First stage always; others need the
// gate floor reached in the prior stage.
export function stageUnlocked(p: RpgProfile, stage: Stage): boolean {
  if (!stage.unlockAt) return true;
  return (p.bestFloor[stage.unlockAt.stage] ?? 0) >= stage.unlockAt.floor;
}

export function materialCount(p: RpgProfile, id: MaterialId): number {
  return p.materials[id] ?? 0;
}

// Is the ascendancy (subclass) choice unlocked? Gated on the deepest floor ever cleared in
// ANY stage reaching ASCENDANCY_FLOOR, OR the hero hitting ASCENDANCY_LEVEL — an early-mid
// milestone (well before Prestige) so a committed player picks a subclass mid-climb.
export function ascendancyUnlocked(p: RpgProfile): boolean {
  const deepest = Object.values(p.bestFloor).reduce((m, f) => Math.max(m, f), 0);
  return deepest >= ASCENDANCY_FLOOR || p.level >= ASCENDANCY_LEVEL;
}

// A fresh character: level 1, a starter weapon + the class's starter skill gem
// equipped, an empty supports/gemBag/passives/flasks, and a few rations so a new
// player can send an expedition immediately without shopping. Stamped with SEASON.
export function newProfile(cls: ClassId, now: number, rng: () => number): RpgProfile {
  const weapon = rollGear(STARTER_WEAPON[cls], 0, rng);
  return {
    cls,
    level: 1,
    gear: { vukhi: weapon },
    bag: [],
    materials: { luongthuc: 12, thuoc: 2 },
    bestFloor: {},
    createdAt: now,
    skillGem: newSkillGem(CLASSES[cls].starterGem),
    supports: [newSupportGem(STARTER_SUPPORT[cls])],
    gemBag: [],
    passives: [],
    flasks: [],
    season: SEASON,
    coNgoc: 0,
    prestigeLevel: 0,
    bestFloorThisLife: 0,
    perks: {},
    auras: [],
    atlasNodes: [],
    tutorial: 0,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Risky enhancement — the "đập đồ bị rớt" gamble. Three bands: a safe floor
// (+0..+2 always succeeds → +3 guaranteed), a downgrade band (fail drops one plus,
// item survives), and a break band (fail destroys the item). A 🛡️ Bùa Hộ Mệnh
// converts any fail — break OR downgrade — into a harmless "stay". Cost
// (enhanceCost, above) is burned whether the attempt lands or not. Pure given rng.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnhanceOdds {
  up: number; // success probability at this plus
  onFail: "down" | "break" | "stay"; // what a fail does without a charm
}

// Index = current plus (0..MAX_PLUS-1); enhancing goes plus → plus+1.
export const ENHANCE_TABLE: Record<number, EnhanceOdds> = {
  0: { up: 1, onFail: "stay" },
  1: { up: 1, onFail: "stay" },
  2: { up: 1, onFail: "stay" },
  3: { up: 0.9, onFail: "down" },
  4: { up: 0.82, onFail: "down" },
  5: { up: 0.74, onFail: "down" },
  6: { up: 0.66, onFail: "down" },
  7: { up: 0.55, onFail: "break" },
  8: { up: 0.46, onFail: "break" },
  9: { up: 0.37, onFail: "break" },
  10: { up: 0.28, onFail: "break" },
  11: { up: 0.2, onFail: "break" },
};

export function enhanceAttempt(
  plus: number,
  hasCharm: boolean,
  rng: () => number,
  cap: number = MAX_PLUS,
): { result: "up" | "down" | "break" | "stay"; newPlus: number; charmConsumed: boolean } {
  const ceiling = Math.min(cap, MAX_PLUS); // Đột Phá ceiling — never above the absolute MAX_PLUS
  const odds = ENHANCE_TABLE[plus];
  // At the ceiling (or off-table) → nothing happens, no charm spent. Reaching the ceiling means
  // the next step is a Đột Phá (breakthroughItem), not an đập.
  if (!odds || plus >= ceiling) return { result: "stay", newPlus: plus, charmConsumed: false };

  if (rng() < odds.up) return { result: "up", newPlus: plus + 1, charmConsumed: false };

  // Failed. A plain "stay" band never risks anything, so a charm is not spent there.
  if (odds.onFail === "stay") return { result: "stay", newPlus: plus, charmConsumed: false };
  // A charm turns a downgrade or a break into a harmless stay (item unchanged).
  if (hasCharm) return { result: "stay", newPlus: plus, charmConsumed: true };
  if (odds.onFail === "down") return { result: "down", newPlus: Math.max(0, plus - 1), charmConsumed: false };
  return { result: "break", newPlus: plus, charmConsumed: false }; // caller deletes the item
}

// ─────────────────────────────────────────────────────────────────────────────
// Đột Phá (breakthrough) — the enhancement CEILING gate. Every item can only be đập
// up to a cap; the cap starts at +3 (the end of the safe band) and each Đột Phá raises
// it +3 (→ +6 → +9 → +12 = MAX_PLUS). The risky +N gamble is UNTOUCHED — Đột Phá is a
// separate, guaranteed gate you pay at the wall with same-slot fodder + 🔶 Đá Đột Phá +
// coins. Pure — the command shell owns the bag/material/coin writes.
// ─────────────────────────────────────────────────────────────────────────────
export const BREAK_CAP_BASE = 3; // starting enhancement ceiling on every item (== end of the safe band)
export const BREAK_CAP_STEP = 3; // each Đột Phá raises the ceiling by this much (3→6→9→12)

// An item's current enhancement ceiling. Legacy items with no capPlus → BREAK_CAP_BASE.
export function gearCap(item: GearItem): number {
  return Math.min(MAX_PLUS, item.capPlus ?? BREAK_CAP_BASE);
}
// Đột Phá is allowed only when standing AT the ceiling and the ceiling is still below
// MAX_PLUS — "chạm trần mới đột phá được".
export function canBreakthrough(item: GearItem): boolean {
  return gearCap(item) < MAX_PLUS && item.plus >= gearCap(item);
}
// Cost of raising a ceiling FROM `cap` (3/6/9) to the next mốc. Escalates per mốc — the
// deeper the ceiling, the harder the wall.
export function breakthroughCost(cap: number): { fodder: number; dotpha: number; coins: number } {
  const step = Math.max(0, Math.round((cap - BREAK_CAP_BASE) / BREAK_CAP_STEP)); // 0,1,2 for cap 3,6,9
  return { fodder: [1, 2, 3][step] ?? 3, dotpha: [1, 2, 4][step] ?? 4, coins: [800, 2000, 5000][step] ?? 5000 };
}
// Raise an item's ceiling one mốc (pure). Caller gates canBreakthrough + pays the cost.
export function breakthroughItem(item: GearItem): GearItem {
  return { ...item, capPlus: Math.min(MAX_PLUS, gearCap(item) + BREAK_CAP_STEP) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tái Sinh (Prestige) — the personal endless engine. Reach the floor gate THIS LIFE
// (or MAX_LEVEL) → reset progress for permanent Cổ Ngọc that buys perks. The reward
// scales with the POWER you built this life (log-shaped, always ≥1) so the loop never
// hard-locks — re-building power (farm gear + enhance + ⭐ + level) IS the sink. What
// carries over: class, Cổ Ngọc, prestige count, bestFloor, perks, tutorial. What wipes:
// level, gear (→ starter weapon), bag, farmable materials, and bestFloorThisLife.
// ─────────────────────────────────────────────────────────────────────────────

// Eligible = reached the gate SINCE the last rebirth. bestFloorThisLife + level BOTH reset on
// prestige, so neither can be satisfied by a just-reset hero — a real re-climb is forced each time
// (bestFloor persists across rebirth, so gating on it would mint Cổ Ngọc on every re-click).
export function canPrestige(p: RpgProfile): boolean {
  return p.level >= MAX_LEVEL || (p.bestFloorThisLife ?? 0) >= PRESTIGE_FLOOR;
}

// Cổ Ngọc gained on a rebirth = A · log2(power / base), floored, min 1. Power = the finalised build
// power (powerScore) at reset — passed in by the shell (which owns the build layer; rpg.ts can't
// import it without a cycle). Every doubling of power pays a flat +A; a fresh-eligible hero still
// banks ≥1, so the endless loop never dead-ends the way the old floor-delta reward did.
export function prestigeReward(power: number): number {
  return Math.max(1, Math.floor(PRESTIGE_REWARD_A * Math.log2(Math.max(1, power) / PRESTIGE_POWER_BASE)));
}

const STARTER_WEAPON: Record<ClassId, string> = { chien: "kiem", phap: "truong", cung: "cungten" };

// One support gem pre-socketed on a fresh (or reborn) hero — matched to the class's starter
// skill so it actually fires: chien/cung get a +more support their melee/projectile skill can use,
// phap gets the tagless Empower. This makes every player MEET the support-gem system on turn 1
// (a build-defining +25-30% lever) instead of never discovering it — telemetry showed live players
// running 0 supports because support gems only ever came from a rare drop.
const STARTER_SUPPORT: Record<ClassId, string> = { chien: "tanbao", phap: "bùngno", cung: "xuyenpha" };

// Tái Sinh — resets progress for permanent Cổ Ngọc. Wipes level, gear (→ starter
// weapon), bag, farmable materials, and the whole build (gems/supports/gemBag/
// passives/flasks → the starter skill gem, empty rest) — the passive tree is refunded
// by wiping the allocation, matching PoE's rebirth-respec. What carries over: class,
// Cổ Ngọc, prestige count, bestFloor, perks, tutorial, season.
export function applyPrestige(p: RpgProfile, power: number, rng: () => number = Math.random): RpgProfile {
  const weapon = rollGear(STARTER_WEAPON[p.cls], 0, rng);
  return {
    cls: p.cls,
    level: 1,
    gear: { vukhi: weapon },
    bag: [],
    materials: { luongthuc: 12, thuoc: 2 },
    bestFloor: p.bestFloor,
    createdAt: p.createdAt,
    skillGem: newSkillGem(CLASSES[p.cls].starterGem),
    supports: [newSupportGem(STARTER_SUPPORT[p.cls])],
    gemBag: [],
    passives: [], // Tái Sinh refunds every allocated node
    flasks: [],
    season: p.season ?? SEASON,
    coNgoc: (p.coNgoc ?? 0) + prestigeReward(power),
    prestigeLevel: (p.prestigeLevel ?? 0) + 1,
    // The per-life climb resets → the next rebirth must re-reach the gate to be eligible again.
    bestFloorThisLife: 0,
    perks: p.perks ?? {},
    // Ascendancy is tied to the class, which persists across rebirth → preserve it.
    ascendancy: p.ascendancy,
    // Auras & curse are the character's loadout — tied to the persisting class → preserve both.
    auras: p.auras ?? [],
    curse: p.curse,
    // Atlas Tree is account-wide endgame meta (like Cổ Ngọc) → survives the rebirth intact.
    atlasNodes: p.atlasNodes ?? [],
    // Dailies are account-level, not part of the run/build that a rebirth wipes.
    quests: p.quests,
    tutorial: p.tutorial ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cổ Ngọc perks — permanent multipliers. atk/hp fold into the build (rpg-build.ts);
// loot multiplies material yield. Cost escalates with the level already owned.
// ─────────────────────────────────────────────────────────────────────────────

export const PERKS: Record<PerkId, { name: string; emoji: string; blurb: string; step: number; maxLevel: number }> = {
  atk: { name: "Jewel of Slaughter", emoji: "🗡️", blurb: "+5% ATK mỗi cấp", step: 0.05, maxLevel: 20 },
  hp: { name: "Jewel of Fortitude", emoji: "❤️", blurb: "+5% HP mỗi cấp", step: 0.05, maxLevel: 20 },
  loot: { name: "Jewel of Greed", emoji: "💰", blurb: "+8% loot mỗi cấp", step: 0.08, maxLevel: 20 },
};

// Cổ Ngọc to buy the next level of a perk you currently own `currentLevel` of.
export function perkCost(_id: PerkId, currentLevel: number): number {
  return PERK_COST_BASE + currentLevel * PERK_COST_STEP;
}

// Loot yield multiplier from the loot perk (1 = no bonus).
export function lootBonus(p: RpgProfile): number {
  return 1 + PERKS.loot.step * (p.perks?.loot ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly modifiers — a rotating "rule of the fortnight" that twists the sim so the
// same content plays differently and rewards a build swap. Purely a function of the
// epoch (no stored state, like isVietnamWeekend). Each modifier mutates only the
// enemy and/or the floor loot — the combat core stays untouched. A stacking note:
// mutateLoot runs AFTER the per-stage material bias, so the two multiply.
// ─────────────────────────────────────────────────────────────────────────────

// A named floor-1 enemy the weekly modifier may twist (P5's enemy generation builds
// these from Stage.enemyBase). Kept minimal so the modifier data still typechecks.
export type ModEnemy = EnemyBase & { name: string };

export interface WeeklyModifier {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  mutateEnemy?: (c: ModEnemy) => ModEnemy;
  mutateLoot?: (d: FloorDrops) => FloorDrops;
}

export const MODIFIERS: WeeklyModifier[] = [
  {
    id: "none",
    name: "Normal",
    emoji: "⚪",
    blurb: "Không có luật đặc biệt tuần này",
  },
  {
    id: "huyetnguyet",
    name: "Blood Moon",
    emoji: "🌑",
    blurb: "Quái +40% HP, nhưng ×2 🔩 Enhancement Shard",
    mutateEnemy: (c) => ({ ...c, hp: Math.round(c.hp * 1.4) }),
    mutateLoot: (d) => ({ ...d, materials: { ...d.materials, manh: Math.round((d.materials.manh ?? 0) * 2) } }),
  },
  {
    id: "vochi",
    name: "Dulled Edge",
    emoji: "🚫",
    blurb: "Quái mất chí mạng nhưng +25% HP — an toàn mà dai",
    mutateEnemy: (c) => ({ ...c, crit: 0, critDmg: 1, hp: Math.round(c.hp * 1.25) }),
  },
  {
    id: "cuongno",
    name: "Frenzy",
    emoji: "🔥",
    blurb: "Quái +25% ATK, −30% DEF — đua sát thương, hạ nhanh hoặc gục",
    mutateEnemy: (c) => ({ ...c, atk: Math.round(c.atk * 1.25), def: Math.round(c.def * 0.7) }),
  },
  {
    id: "suongdoc",
    name: "Toxic Mist",
    emoji: "☠️",
    blurb: "Quái +50% DEF (đánh dai, hao Provision) nhưng +50% ✨ Essence",
    mutateEnemy: (c) => ({ ...c, def: Math.round(c.def * 1.5) }),
    mutateLoot: (d) => ({
      ...d,
      materials: { ...d.materials, tinhchat: Math.round((d.materials.tinhchat ?? 0) * 1.5) },
    }),
  },
];

// Biweekly rotation. `now` is epoch ms (defaults to the wall clock) — pure otherwise.
export function currentModifier(now: number = Date.now()): WeeklyModifier {
  return MODIFIERS[Math.floor(now / TWO_WEEKS_MS) % MODIFIERS.length]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// PvP — "Ải Tử Chiến" bracketing. The hero-vs-hero duel itself runs through the
// shared combat core (autoBattle in rpg-combat.ts) fed by effectiveBuild — that
// wiring lives in the PvP shell (rpg-pvp.ts, P-later). This module keeps only the
// pure power-bracket predicate the matchmaker gates on.
// ─────────────────────────────────────────────────────────────────────────────

// Only match when the two powers are within PVP_BRACKET on a log scale (symmetric).
export function inBracket(aPower: number, bPower: number): boolean {
  if (aPower <= 0 || bPower <= 0) return false;
  return Math.abs(Math.log(aPower / bPower)) <= PVP_BRACKET;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tutorial — a bitmask of completed onboarding steps stored on the profile. The
// basics are gated by these bits; advanced features (chợ / tái sinh / tử chiến) are
// surfaced by live condition in the command, not by a bit.
// ─────────────────────────────────────────────────────────────────────────────

export const enum TutorialStep {
  Create = 1,
  Expedition = 2,
  Equip = 4,
  Enhance = 8,
  LevelUp = 16,
}

export const TUTORIAL_ALL = 31; // Create | Expedition | Equip | Enhance | LevelUp

export function tutorialDone(mask: number, step: TutorialStep): boolean {
  return (mask & step) !== 0;
}

export function markTutorial(mask: number, step: TutorialStep): number {
  return mask | step;
}

const TUTORIAL_HINTS: { step: TutorialStep; text: string }[] = [
  { step: TutorialStep.Create, text: "Tạo nhân vật với `/rpg create` để bắt đầu nhe bro." },
  { step: TutorialStep.Expedition, text: "Gửi nhân vật đi ải bằng `/rpg map` — nó tự đánh, mình nhặt loot." },
  { step: TutorialStep.Equip, text: "Nhặt được đồ ngon thì `/rpg equip` để mặc, mạnh lên liền." },
  { step: TutorialStep.Enhance, text: "Dùng 🔩 Enhancement Shard để `/rpg enhance` cường hóa trang bị (+0→+3 an toàn tuyệt đối)." },
  { step: TutorialStep.LevelUp, text: "Dồn ✨ Essence vào `/rpg levelup` để lên cấp nhân vật." },
];

// First unfinished step's advice, or null once every basic step is done.
export function nextTutorialHint(p: RpgProfile): { step: TutorialStep; text: string } | null {
  const mask = p.tutorial ?? 0;
  if ((mask & TUTORIAL_ALL) === TUTORIAL_ALL) return null;
  for (const hint of TUTORIAL_HINTS) if (!tutorialDone(mask, hint.step)) return hint;
  return null;
}
