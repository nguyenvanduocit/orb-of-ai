// Pure-core proof for the RPG coin faucet + item/QoL selectors. Run: `bun test src/rpg.test.ts`.
// Covers the money-critical bits: NPC-sell pricing, floor gold scaling, best-in-slot
// auto-equip, and bulk selection. Combat itself is proven in rpg-combat / rpg-build.

import { describe, expect, test } from "bun:test";
import {
  applyPrestige,
  ascendancyUnlocked,
  ASCENDANCY_FLOOR,
  ASCENDANCY_LEVEL,
  bagItemsUpToRarity,
  BREAK_CAP_BASE,
  BREAK_CAP_STEP,
  breakthroughCost,
  breakthroughItem,
  canBreakthrough,
  canPrestige,
  CLASSES,
  enhanceAttempt,
  gearCap,
  MAX_PLUS,
  floorGold,
  GEAR_SLOTS,
  DEATH_XP_PENALTY_MAX,
  deathEssencePenalty,
  isBossFloor,
  levelUpCost,
  LEGENDARY_FULL_ILVL,
  JACKPOT_ILVL,
  MERGE_BEST_TIER,
  mapLevel,
  rewardMultiplier,
  MOD_CAP,
  MOD_POOL,
  GEAR_BASES,
  gearStats,
  MAX_LEVEL,
  MAX_STAR,
  mergeCoinCost,
  mergeFodderNeeded,
  newProfile,
  npcSellPrice,
  PRESTIGE_FLOOR,
  prestigeReward,
  rollFloorLoot,
  rollGear,
  rollUnique,
  SEASON,
  STAGE_BY_ID,
  starUpItem,
  type ClassId,
  type GearItem,
  type Mod,
  type Rarity,
  type RpgProfile,
} from "./rpg";
import { newSkillGem, newSupportGem, skillManaCost, SUPPORT_BY_ID, SKILL_BY_ID } from "./rpg-skills";
import { autoEquipBest, effectiveBuild, powerScore } from "./rpg-build";
import { ASCENDANCIES } from "./rpg-ascendancy";
import { AURAS, AURA_BY_ID, CURSES, applyCurse, equippedAuras, reservedSpirit } from "./rpg-auras";
import {
  ARCHETYPES,
  ELITE_AFFIXES,
  MAX_MAP_TIER,
  DMG_POW,
  FLOOR_ANCHOR,
  LIFE_POW,
  floorDifficultyMul,
  floorKind,
  genMonster,
  makeElite,
  mapTier,
  maxTierFor,
} from "./rpg-maps";
import { BOONS, applyBoons, boonHealFrac, boonLootMul, rollBoonOffer } from "./rpg-boons";
import { EFFECTS } from "./rpg-effects";
import { DAILY_COUNT, QUESTS, QUEST_BY_ID, boardFor, claimable, creditRun, dayKey, rollBoard } from "./rpg-quests";
import { STAGES } from "./rpg";
import { MAX_HIT_FRAC, armourDR, autoBattle, bundleTotal, evadeChance, mitigatedHit, zeroBundle, type Defenses, type Fighter, type Offense } from "./rpg-combat";
import { ATLAS_NODES, aggregateAtlas, atlasPointsSpendable, atlasPointsTotal, canAllocateAtlas, ownedAtlasKeystone } from "./rpg-atlas";
import { addMod, newBag, resolve } from "./rpg-mods";

// Deterministic PRNG (mulberry32) — seeded so statistical assertions are reproducible.
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let idc = 0;
function mk(base: string, rarity: Rarity, plus = 0): GearItem {
  return { id: `${base}-${rarity}-${plus}-${idc++}`, base, slot: GEAR_BASES[base]!.slot, rarity, roll: 1.0, plus };
}
function profile(over: Partial<RpgProfile> = {}): RpgProfile {
  const cls: ClassId = over.cls ?? "chien";
  return {
    cls, level: 5, gear: {}, bag: [], materials: {}, bestFloor: {},
    createdAt: 0,
    // a starter skill gem so weapon damage actually converts to offense — without a
    // socketed skill the build has zero hit, so gear rarity wouldn't move power at all.
    // Use the class's OWN starter gem so a phap/cung profile resolves to real spell/attack.
    skillGem: newSkillGem(CLASSES[cls].starterGem), supports: [], gemBag: [], passives: [], flasks: [], season: SEASON,
    coNgoc: 0, prestigeLevel: 0, bestFloorThisLife: 0, perks: {}, auras: [], tutorial: 0, atlasNodes: [],
    ...over,
  };
}

describe("npcSellPrice", () => {
  test("scales by rarity then enhancement", () => {
    expect(npcSellPrice(mk("kiem", 0, 0))).toBe(60);
    expect(npcSellPrice(mk("kiem", 4, 0))).toBe(3500);
    expect(npcSellPrice(mk("kiem", 2, 10))).toBe(1250); // 500 × (1 + 10×0.15) = 500 × 2.5
    // rarer always ≥ commoner at the same plus
    expect(npcSellPrice(mk("kiem", 3, 0))).toBeGreaterThan(npcSellPrice(mk("kiem", 1, 0)));
  });
});

describe("floorGold", () => {
  const rung = STAGE_BY_ID.rungma!;
  const vuc = STAGE_BY_ID.vuctham!;
  const r = () => 0.5; // deterministic mid-roll

  test("positive, scales with depth, boss pays a big multiple", () => {
    const f5 = floorGold(rung, 5, r);
    const f10boss = floorGold(rung, 10, r); // floor 10 is a boss (bossEvery 10)
    expect(f5).toBeGreaterThan(0);
    expect(f10boss).toBeGreaterThan(f5 * 3); // boss ×3 plus deeper-floor depth scaling
  });

  test("richer stage pays more at the same floor", () => {
    expect(floorGold(vuc, 8, r)).toBeGreaterThan(floorGold(rung, 8, r));
  });

  test("stays modest at shallow starter floors (self-balancing vs 15/floor rations)", () => {
    // floor 3 rừng ma ≈ (10 + 2.4·√3)·√1·1.0 ≈ 14 — near ration cost, not a printer
    expect(floorGold(rung, 3, r)).toBeLessThan(40);
  });

  test("deep NON-boss floors in the RICHEST stage stay bounded (not a coin printer)", () => {
    // Old formula: floor 30 × lootMult 4.5 ≈ 390 coins/floor (a coin printer into the shared
    // ledger). √floor × √lootMult keeps a deep non-boss floor well under ~60 even at the
    // richest region (bosses, floors %10==0, pay 3× on top — a milestone, still bounded).
    const richest = STAGES.reduce((a, b) => (b.lootMult > a.lootMult ? b : a));
    expect(floorGold(richest, 33, r)).toBeLessThan(65);
    expect(floorGold(richest, 49, r)).toBeLessThan(65);
  });
});


describe("isBossFloor — the one boss-milestone rule", () => {
  const rung = STAGE_BY_ID.rungma!; // bossEvery 10

  test("marks every bossEvery milestone and nothing between them", () => {
    for (const f of [10, 20, 30, 100]) expect(isBossFloor(rung, f)).toBe(true);
    for (const f of [1, 9, 11, 19, 99]) expect(isBossFloor(rung, f)).toBe(false);
  });

  test("floor 0 is the pre-run state, never a boss", () => {
    // 0 % bossEvery === 0, so an unguarded rule would call the starting position a boss and
    // hand out boss gold/loot for it.
    expect(isBossFloor(rung, 0)).toBe(false);
  });
});

describe("map tier access gate (maxTierFor) — the T1..T16 ladder unlock", () => {
  test("fresh hero capped at T1; +1 tier per 5 floors of deepest clear, clamped to MAX", () => {
    expect(maxTierFor(0)).toBe(1);
    expect(maxTierFor(4)).toBe(1);
    expect(maxTierFor(5)).toBe(2);
    expect(maxTierFor(25)).toBe(6);
    expect(maxTierFor(10_000)).toBe(MAX_MAP_TIER); // clamped, never past the top tier
    expect(maxTierFor(-9)).toBe(1); // guards a negative / missing bestFloor
  });
});

describe("per-level %-growth (leveling stays relevant to cap)", () => {
  test("lifePct growth scales the WHOLE life pool, not just the flat per-level add", () => {
    // chien: base life 120 + flat growth 24/level. Flat-only at L50 = 120 + 24·49 = 1296.
    const flatOnlyL50 = 120 + 24 * 49;
    const life50 = effectiveBuild(profile({ cls: "chien", level: 50 })).def.life;
    // The lifePct growth (0.006 · 49 ≈ +29%) multiplies the whole pool on top of the flat
    // growth, so a capped hero's life clearly exceeds the flat-growth-only sum.
    expect(life50).toBeGreaterThan(flatOnlyL50 * 1.2);
  });

  test("a late level-up still adds felt power (not a shrinking flat sliver)", () => {
    const p49 = powerScore(profile({ cls: "cung", level: 49 }));
    const p50 = powerScore(profile({ cls: "cung", level: 50 }));
    expect(p50).toBeGreaterThan(p49); // atkPct/lifePct growth keeps the last level meaningful
  });
});

describe("unique roll ranges (perfect-roll chase)", () => {
  test("rollUnique stamps roll in [0.82, 1); upsides scale by roll, signature downsides stay fixed", () => {
    for (let i = 0; i < 300; i++) {
      const u = rollUnique(20, Math.random);
      expect(u.roll).toBeGreaterThanOrEqual(0.82);
      expect(u.roll).toBeLessThan(1);
    }
    // Starforge: atk 54 (+ upside), atkPct 0.42 (+ upside), spellPct −0.4 + resFire −0.15 (downsides).
    const mk = (roll: number): GearItem => ({ id: "x", base: "kiem", slot: "vukhi", rarity: 4, roll, plus: 0, ilvl: 20, uniqueId: "starforge" });
    const lo = gearStats(mk(0.5));
    const hi = gearStats(mk(1));
    expect(lo.atk!).toBeCloseTo(54 * 0.5, 5); // flat upside scaled by roll
    expect(hi.atk!).toBeCloseTo(54, 5);
    expect(lo.atkPct!).toBeCloseTo(0.42 * 0.5, 5); // %-upside scaled by roll too
    expect(lo.spellPct!).toBe(hi.spellPct!); // downside is roll-invariant
    expect(lo.spellPct!).toBeLessThan(0); // still the signature downside
    expect(lo.resFire!).toBe(hi.resFire!);
  });
});

describe("on-tree behavioural fx (leech makes glass keystones sustainable)", () => {
  test("allocating Khát Máu (Bloodthirst) grants a lifeLeech fx in the resolved build", () => {
    const leech = effectiveBuild(profile({ cls: "chien", passives: ["cuong_e", "cuong_a1", "cuong_na"] }));
    expect(leech.fx.some((e) => e.id === "lifeLeech")).toBe(true);
    const none = effectiveBuild(profile({ cls: "chien", passives: [] }));
    expect(none.fx.some((e) => e.id === "lifeLeech")).toBe(false);
  });
});

describe("support-gem drops (the build-transformation loot axis)", () => {
  const rung = STAGE_BY_ID.rungma!;
  // Deterministic PRNG (mulberry32) so the statistical assertions are reproducible.
  const seeded = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  test("gems drop, and are ALWAYS valid support gems (never skill gems)", () => {
    const rng = seeded(7);
    let count = 0;
    for (let i = 0; i < 4000; i++) {
      const drops = rollFloorLoot(rung, 8, rng);
      if (drops.gem) {
        count++;
        expect(SUPPORT_BY_ID[drops.gem.inst.defId]).toBeTruthy(); // it's a SUPPORT
        expect(SKILL_BY_ID[drops.gem.inst.defId]).toBeUndefined(); // never a skill (no cross-class dead weight)
        expect(drops.gem.inst.level).toBe(1);
        expect(drops.gem.name.length).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(0); // the drop roll actually fires
  });

  test("boss floors pay a fatter gem shot than normal floors", () => {
    const rng = seeded(99);
    let normal = 0;
    let boss = 0;
    for (let i = 0; i < 6000; i++) {
      if (rollFloorLoot(rung, 8, rng).gem) normal++; // floor 8 — non-boss
      if (rollFloorLoot(rung, 10, rng).gem) boss++; // floor 10 — boss (bossEvery 10)
    }
    expect(boss).toBeGreaterThan(normal); // GEM_BOSS_CHANCE(0.12) >> GEM_DROP_CHANCE(0.02)
  });
});

describe("autoEquipBest", () => {
  test("equips the stronger bag item, benches the weak one, no dupes", () => {
    const weak = mk("kiem", 0);
    const strong = mk("kiem", 4);
    const p = profile({ gear: { vukhi: weak }, bag: [strong] });
    const out = autoEquipBest(p);
    expect(out.gear.vukhi!.id).toBe(strong.id); // higher rarity → more power → equipped
    expect(out.changed).toContain("vukhi");
    expect(out.bag.map((g) => g.id)).toContain(weak.id);
    // every item accounted for exactly once (equipped ∪ bag = pool, disjoint)
    const all = [...Object.values(out.gear).map((g) => g!.id), ...out.bag.map((g) => g.id)].sort();
    expect(all).toEqual([weak.id, strong.id].sort());
    // and the swap is real: power went up
    expect(powerScore({ ...p, gear: out.gear })).toBeGreaterThan(powerScore(p));
  });

  test("leaves an already-optimal loadout unchanged", () => {
    const best = mk("kiem", 4);
    const p = profile({ gear: { vukhi: best }, bag: [mk("kiem", 1)] });
    expect(autoEquipBest(p).changed).toHaveLength(0);
  });
});

describe("bagItemsUpToRarity", () => {
  test("selects only bag items at or below the rarity threshold", () => {
    const bag = [mk("kiem", 0), mk("kiem", 1), mk("kiem", 2), mk("kiem", 4)];
    const junk = bagItemsUpToRarity(bag, 1);
    expect(junk.map((g) => g.rarity).sort()).toEqual([0, 1]);
  });
});

describe("ascendancy", () => {
  // A profile with a class-appropriate weapon equipped so the build has a real hit.
  const WEAPON: Record<ClassId, string> = { chien: "kiem", phap: "truong", cung: "cungten" };
  function withClass(cls: ClassId, over: Partial<RpgProfile> = {}): RpgProfile {
    return profile({ cls, gear: { vukhi: mk(WEAPON[cls], 2) }, ...over });
  }

  test("catalog has exactly 2 ascendancies per class (6 total)", () => {
    expect(ASCENDANCIES).toHaveLength(6);
    for (const cls of ["chien", "phap", "cung"] as ClassId[]) {
      expect(ASCENDANCIES.filter((a) => a.cls === cls)).toHaveLength(2);
    }
  });

  test("ascendancyUnlocked: false for a fresh Lv1 profile, true at floor≥15 or level≥20", () => {
    expect(ascendancyUnlocked(profile({ level: 1, bestFloor: {} }))).toBe(false);
    // floor gate
    expect(ascendancyUnlocked(profile({ level: 1, bestFloor: { rungma: ASCENDANCY_FLOOR } }))).toBe(true);
    expect(ascendancyUnlocked(profile({ level: 1, bestFloor: { rungma: ASCENDANCY_FLOOR - 1 } }))).toBe(false);
    // level gate
    expect(ascendancyUnlocked(profile({ level: ASCENDANCY_LEVEL, bestFloor: {} }))).toBe(true);
    expect(ascendancyUnlocked(profile({ level: ASCENDANCY_LEVEL - 1, bestFloor: {} }))).toBe(false);
  });

  test("no effect when locked (fresh Lv1) even if an ascendancy id is set", () => {
    const locked = withClass("chien", { level: 1, bestFloor: {}, ascendancy: "juggernaut" });
    const none = withClass("chien", { level: 1, bestFloor: {} });
    expect(effectiveBuild(locked).def.life).toBe(effectiveBuild(none).def.life);
    expect(effectiveBuild(locked).fx).toHaveLength(0); // locked → no keystone effects
  });

  // All direction checks use an UNLOCKED profile (level ≥ 20).
  const base = (cls: ClassId, ascendancy?: string) => withClass(cls, { level: ASCENDANCY_LEVEL, ascendancy });

  test("Juggernaut raises Life and grants freeze immunity + block (fx)", () => {
    const none = effectiveBuild(base("chien"));
    const jug = effectiveBuild(base("chien", "juggernaut"));
    expect(jug.def.life).toBeGreaterThan(none.def.life);
    expect(jug.def.armour).toBeGreaterThan(none.def.armour);
    expect(none.fx.map((e) => e.id)).not.toContain("freezeImmune");
    expect(jug.fx.map((e) => e.id)).toContain("freezeImmune");
    expect(jug.fx.map((e) => e.id)).toContain("block");
  });

  test("Berserker raises damage/power and adds the more-damage-taken cost", () => {
    const none = effectiveBuild(base("chien"));
    const ber = effectiveBuild(base("chien", "berserker"));
    expect(ber.power).toBeGreaterThan(none.power); // atk%/crit slice moves power
    expect(ber.off.moreMulti ?? 0).toBeGreaterThan(0); // deals MORE
    expect(ber.def.moreTaken ?? 0).toBeGreaterThan(0); // takes MORE
    expect(none.off.moreMulti).toBeUndefined();
    expect(none.def.moreTaken).toBeUndefined();
  });

  test("Elementalist adds elemental penetration and lifts elemental damage/power", () => {
    const none = effectiveBuild(base("phap"));
    const ele = effectiveBuild(base("phap", "elementalist"));
    expect(ele.off.pen?.fire ?? 0).toBeGreaterThan(0);
    expect(ele.off.pen?.cold ?? 0).toBeGreaterThan(0);
    expect(ele.off.pen?.light ?? 0).toBeGreaterThan(0);
    expect(none.off.pen).toBeUndefined();
    expect(ele.power).toBeGreaterThan(none.power); // big elePct slice
  });

  test("Occultist lifts Energy Shield and chaos res", () => {
    const none = effectiveBuild(base("phap"));
    const occ = effectiveBuild(base("phap", "occultist"));
    expect(occ.def.energyShield).toBeGreaterThan(none.def.energyShield);
    expect(occ.def.res.chaos).toBeGreaterThan(none.def.res.chaos);
  });

  test("Deadeye raises attack/crit power; Pathfinder raises evasion", () => {
    const none = effectiveBuild(base("cung"));
    const deadeye = effectiveBuild(base("cung", "deadeye"));
    const pathfinder = effectiveBuild(base("cung", "pathfinder"));
    expect(deadeye.power).toBeGreaterThan(none.power);
    expect(deadeye.off.critMulti).toBeGreaterThan(none.off.critMulti);
    expect(pathfinder.def.evasion).toBeGreaterThan(none.def.evasion);
  });

  test("a chosen ascendancy survives applyPrestige (tied to the persisting class)", () => {
    const p = profile({ cls: "chien", ascendancy: "berserker", level: ASCENDANCY_LEVEL, bestFloor: { rungma: 25 } });
    const reborn = applyPrestige(p, powerScore(p), () => 0.5);
    expect(reborn.cls).toBe("chien");
    expect(reborn.ascendancy).toBe("berserker");
  });
});

describe("auras & curses", () => {
  // A maxed Warrior with a real weapon AND a spirit ring — auras reserve Spirit now, so a
  // fixture without any would simply run none of them.
  const spiritRing = (): GearItem => ({
    ...mk("nhanchimang", 3),
    mods: [{ group: "spirit", kind: "prefix", stat: "spirit", tier: 1, value: 60 }],
  });
  const withGear = (over: Partial<RpgProfile> = {}) =>
    profile({ cls: "chien", level: MAX_LEVEL, gear: { vukhi: mk("kiem", 2), nhan: spiritRing() }, ...over });

  test("catalogs exist and every aura is priced in Spirit", () => {
    expect(AURAS.length).toBeGreaterThanOrEqual(6);
    expect(CURSES.length).toBeGreaterThanOrEqual(5);
    expect(AURAS.every((a) => a.spirit > 0)).toBe(true);
  });

  test("an aura does NOT run without the Spirit to reserve it", () => {
    // Same hero, no spirit gear and low level → the budget can't cover Determination.
    const broke = profile({ cls: "chien", level: 1, gear: { vukhi: mk("kiem", 2) }, auras: ["determination"] });
    const build = effectiveBuild(broke);
    expect(build.spirit.running).toHaveLength(0);
    expect(build.def.armour).toBe(effectiveBuild({ ...broke, auras: [] }).def.armour);
  });

  test("equipping Determination raises armour (aura folds into the build)", () => {
    const none = effectiveBuild(withGear({ auras: [] }));
    const det = effectiveBuild(withGear({ auras: ["determination"] }));
    expect(det.def.armour).toBeGreaterThan(none.def.armour);
  });

  test("equipping Hatred folds +cold% into the build (and multiplies existing cold hits)", () => {
    const none = effectiveBuild(withGear({ auras: [] }));
    const hatred = effectiveBuild(withGear({ auras: ["hatred"] }));
    // The aura's +cold% lands in the modifier bag regardless of the skill's element…
    expect(hatred.raw.dmgCold?.inc ?? 0).toBeGreaterThan(none.raw.dmgCold?.inc ?? 0);
    // …and a build that already deals cold sees a bigger cold hit under the aura.
    // Hatred reserves 45 Spirit, so this caster needs the budget for it to run at all.
    const coldGear = {
      level: MAX_LEVEL,
      auras: [] as string[],
      gear: { vukhi: mk("kiem", 2), non: mk("monao", 1), nhan: spiritRing() },
    };
    const coldNone = effectiveBuild(profile({ cls: "phap", ...coldGear, skillGem: newSkillGem("bangtien") }));
    const coldHatred = effectiveBuild(profile({ cls: "phap", ...coldGear, auras: ["hatred"], skillGem: newSkillGem("bangtien") }));
    expect(coldHatred.spirit.running.map((a) => a.id)).toEqual(["hatred"]);
    expect(coldHatred.off.hit.cold).toBeGreaterThan(coldNone.off.hit.cold);
  });

  test("the Spirit budget, not a slot count, decides how many auras run", () => {
    // Precision (crit) + Determination (armour) fit; a 3rd aura (Grace, evasion) must not apply.
    const two = effectiveBuild(withGear({ auras: ["precision", "determination"] }));
    const three = effectiveBuild(withGear({ auras: ["precision", "determination", "grace"] }));
    // Read the prices from the catalog so this stays true through any rebalance.
    const cost = (id: string) => AURA_BY_ID[id]!.spirit;
    const pair = cost("precision") + cost("determination");

    const bothFit = equippedAuras(["precision", "determination", "grace"], pair);
    expect(bothFit.map((a) => a.id)).toEqual(["precision", "determination"]);
    expect(reservedSpirit(bothFit)).toBe(pair);

    // One point short of the pair: the first pick wins and the rest are skipped — order IS
    // the player's priority list.
    expect(equippedAuras(["precision", "determination", "grace"], pair - 1).map((a) => a.id)).toEqual(["precision"]);
    expect(equippedAuras(["precision", "determination"], 0)).toHaveLength(0);

    // An unaffordable aura is skipped and a cheaper one BEHIND it still runs.
    expect(equippedAuras(["hatred", "grace"], cost("grace")).map((a) => a.id)).toEqual(["grace"]);
    expect(three.def.evasion).toBe(two.def.evasion); // the 3rd (Grace) never lifted evasion
    // the first two still apply
    expect(two.def.armour).toBeGreaterThan(effectiveBuild(withGear({ auras: [] })).def.armour);
  });

  test("applyCurse eleweakness lowers the monster's elemental resistances", () => {
    const rung = STAGE_BY_ID.rungma!;
    // A deep floor so the monster carries some elemental res to shave off.
    const mob = genMonster(rung, 40, 8, () => 0.5);
    const cursed = applyCurse(mob, "eleweakness");
    expect(cursed.def.res.fire).toBeLessThan(mob.def.res.fire);
    expect(cursed.def.res.cold).toBeLessThan(mob.def.res.cold);
    expect(cursed.def.res.light).toBeLessThan(mob.def.res.light);
  });

  test("applyCurse vulnerability sets moreTaken on the monster; unknown/empty is a no-op", () => {
    const mob = genMonster(STAGE_BY_ID.rungma!, 5, 1, () => 0.5);
    expect(mob.def.moreTaken ?? 0).toBe(0);
    const vuln = applyCurse(mob, "vulnerability");
    expect(vuln.def.moreTaken ?? 0).toBeGreaterThan(0);
    expect(applyCurse(mob, undefined)).toBe(mob); // no curse → unchanged reference
    expect(applyCurse(mob, "nonsense")).toBe(mob); // unknown id → unchanged reference
  });

  test("auras + curse survive applyPrestige (loadout tied to the persisting class)", () => {
    const p = profile({ cls: "chien", auras: ["determination", "precision"], curse: "vulnerability", level: ASCENDANCY_LEVEL, bestFloor: { rungma: 25 } });
    const reborn = applyPrestige(p, powerScore(p), () => 0.5);
    expect(reborn.auras).toEqual(["determination", "precision"]);
    expect(reborn.curse).toBe("vulnerability");
  });
});

describe("monster archetypes", () => {
  // Deterministic pool pick: land Math.floor(rng()*len) exactly on index `i`.
  const atIndex = (i: number, len: number) => () => (i + 0.5) / len;

  // Effective THREAT of an archetype relative to `normal`, at a region's reference scale.
  // A hero fight's difficulty tracks (damage the monster deals before it dies) ≈
  //   damage × speed × EHP,  EHP = life×(1+ES) / ((1−armourDR) × (1−dodge)).
  // Raw life×damage×speed is a Goodhart trap — it ignores armour/evasion/ES, which buy huge
  // hidden EHP (an early brute at 1.7 life × 1.7 armour made every region ~30 pts harder for
  // the hero while scoring ~1.0 on the naive metric). This folds them in with the SAME combat
  // constants (armourDR/evadeChance) the engine uses, so the guard sees what the hero sees.
  const relThreat = (region: (typeof STAGES)[number], archId: keyof typeof ARCHETYPES, floor = 12, tier = 4) => {
    const a = ARCHETYPES[archId];
    const n = ARCHETYPES.normal;
    const scale = Math.pow(1 + region.enemyGrowth, floor - 1) * mapTier(tier).diff;
    const ehp = (m: typeof a) => {
      const dr = armourDR(region.enemyBase.def * scale * m.armour);
      const dodge = evadeChance(region.enemyBase.eva * scale + (m.evasionFlat ?? 0));
      return (m.life * (1 + (m.esFrac ?? 0))) / ((1 - dr) * (1 - dodge));
    };
    const dmg = (m: typeof a) => m.damage * m.speed * (1 + (m.crit ?? 0)); // light crit term
    return (ehp(a) * dmg(a)) / (ehp(n) * dmg(n));
  };

  test("every region pool holds its effective-threat mean ≈ 1 (difficulty invariant)", () => {
    // Each floor rolls ONE kind uniformly, so a region's expected difficulty is the pool mean
    // of effective threat. Freeze it near the all-normal baseline (1.0) so adding variety shifts
    // the *variance* of a fight, never the region's average difficulty — verified end-to-end by
    // the hero-panel drift sim (worst region ~4 pts of win-rate from baseline).
    for (const region of STAGES) {
      const ts = region.enemies.map((k) => relThreat(region, k.archetype));
      // no single kind is a pushover or a wall vs the baseline monster
      for (const t of ts) {
        expect(t).toBeGreaterThanOrEqual(0.6);
        expect(t).toBeLessThanOrEqual(1.6);
      }
      const mean = ts.reduce((s, t) => s + t, 0) / ts.length;
      expect(mean).toBeGreaterThanOrEqual(0.85);
      expect(mean).toBeLessThanOrEqual(1.15);
    }
  });

  test("`normal` archetype reproduces the pre-archetype monster exactly", () => {
    // Ice Bear (hangbang[0]) is `normal`: on floor 1 / tier 1 the block is the raw enemyBase,
    // speed 1, no ES — identical to what genMonster produced before archetypes existed.
    const region = STAGE_BY_ID.hangbang!;
    const mob = genMonster(region, 1, 1, atIndex(0, region.enemies.length));
    expect(mob.def.life).toBe(region.enemyBase.hp);
    expect(mob.off.speed).toBe(1);
    expect(mob.def.energyShield).toBe(0);
    expect(mob.name).not.toContain("("); // normal → no tag suffix
  });

  test("archetypes reshape the same region base into distinct roles", () => {
    const region = STAGE_BY_ID.rungma!; // [swarmer, skirmisher, caster, glasscannon, brute]
    const len = region.enemies.length;
    const swarmer = genMonster(region, 5, 3, atIndex(0, len));
    const brute = genMonster(region, 5, 3, atIndex(4, len));

    // brute = fat/slow, swarmer = frail/fast — the trade PoE monster types make.
    expect(brute.def.life).toBeGreaterThan(swarmer.def.life);
    expect(brute.def.armour).toBeGreaterThan(swarmer.def.armour);
    expect(swarmer.off.speed).toBeGreaterThan(brute.off.speed);
    expect(swarmer.name).toContain("bầy đàn"); // the archetype tag rides in the name
  });

  test("skirmisher gets flat evasion even though base.eva is 0", () => {
    const region = STAGE_BY_ID.rungma!;
    const len = region.enemies.length;
    const skirmisher = genMonster(region, 1, 1, atIndex(1, len));
    const brute = genMonster(region, 1, 1, atIndex(4, len));
    expect(region.enemyBase.eva).toBe(0); // the gotcha: a pure multiplier couldn't evade
    expect(skirmisher.def.evasion).toBeGreaterThan(0);
    expect(brute.def.evasion).toBe(0);
  });

  test("caster mints an ES buffer on a normal (non-boss) floor; swarmer does not", () => {
    const region = STAGE_BY_ID.rungma!;
    const len = region.enemies.length;
    const caster = genMonster(region, 3, 1, atIndex(2, len));
    const swarmer = genMonster(region, 3, 1, atIndex(0, len));
    expect(caster.def.energyShield).toBeGreaterThan(0);
    expect(swarmer.def.energyShield).toBe(0);
  });

  test("a boss ignores the pool archetype and carries no tag", () => {
    const region = STAGE_BY_ID.rungma!; // bossEvery 10
    const boss = genMonster(region, 10, 1, () => 0.5);
    expect(boss.name.startsWith("👑")).toBe(true);
    expect(boss.name).not.toContain("("); // boss uses the `normal` shape → no archetype tag
  });
});

// The generic effect engine (rpg-effects.ts): each mechanic is a data EffectRef the combat
// core dispatches, added with ZERO changes to the round loop. These prove the four demo
// mechanics actually fire in autoBattle. rng 0.99 disables crit/evade/ailment rolls so damage
// is deterministic; block (mag 1) still fires because its own roll is 0.99 < 1.
describe("combat effects (generic mechanic engine)", () => {
  const hi = () => 0.99; // no crit / no evade / no ailment; block(1.0) still triggers
  const def = (over: Partial<Defenses> = {}): Defenses => ({ life: 100, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 }, ...over });
  const off = (phys: number, over: Partial<Offense> = {}): Offense => ({ hit: { ...zeroBundle(), phys }, crit: 0, critMulti: 1.5, speed: 1, ailment: {}, ...over });
  const F = (name: string, d: Defenses, o: Offense, fx?: Fighter["fx"]): Fighter => ({ name, def: d, off: o, fx });

  test("lifeLeech heals the attacker for a fraction of damage dealt", () => {
    // Same fight, with vs without leech — the leeching attacker ends with more Life.
    const bag = () => F("Bag", def({ life: 60 }), off(15)); // deals enough to matter, dies in ~4 hits
    const plain = autoBattle(F("A", def(), off(20)), bag(), hi);
    const leech = autoBattle(F("A", def(), off(20), [{ id: "lifeLeech", mag: 0.5 }]), bag(), hi);
    expect(plain.winner).toBe("a");
    expect(leech.winner).toBe("a");
    expect(leech.aHpAfter).toBeGreaterThan(plain.aHpAfter);
  });

  test("block negates incoming hits (100% block → defender is never touched)", () => {
    const attacker = F("A", def(), off(20));
    const blocker = F("D", def(), off(20), [{ id: "block", mag: 1 }]);
    const r = autoBattle(attacker, blocker, hi); // A acts first, every hit blocked
    expect(r.winner).toBe("b");
    expect(r.bHpAfter).toBe(100); // full life — nothing landed
  });

  test("onKillHeal recovers a slice of max Life on the killing blow", () => {
    const foe = () => F("Foe", def({ life: 60 }), off(15)); // A takes ~30 before the kill
    const plain = autoBattle(F("A", def(), off(20)), foe(), hi);
    const healer = autoBattle(F("A", def(), off(20), [{ id: "onKillHeal", mag: 0.5 }]), foe(), hi);
    expect(healer.winner).toBe("a");
    expect(healer.aHpAfter).toBeGreaterThan(plain.aHpAfter); // +50% max Life on kill
  });

  test("culling executes a foe left at or below the threshold — killing it sooner", () => {
    const foe = () => F("Foe", def({ life: 100 }), off(3)); // 20/hit → 5 hits normally
    const plain = autoBattle(F("A", def(), off(20)), foe(), hi);
    const cull = autoBattle(F("A", def(), off(20), [{ id: "culling", mag: 0.3 }]), foe(), hi);
    expect(plain.winner).toBe("a");
    expect(cull.winner).toBe("a");
    expect(cull.rounds).toBeLessThan(plain.rounds); // execute at ≤30% instead of grinding to 0
  });

  test("freezeImmune blocks Freeze but a normal fighter still gets frozen", () => {
    const cold: Offense = { hit: { ...zeroBundle(), cold: 20 }, crit: 0, critMulti: 1.5, speed: 1, ailment: { freeze: 1 } };
    const always = () => 0; // guarantee the freeze roll lands
    const normal = autoBattle(F("A", def(), cold), F("D", def({ life: 500 }), off(1)), always);
    const immune = autoBattle(F("A", def(), cold), F("D", def({ life: 500 }), off(1), [{ id: "freezeImmune", mag: 1 }]), always);
    expect(normal.log.join("\n")).toContain("Freeze");
    expect(immune.log.join("\n")).not.toContain("Freeze");
  });
});

describe("ailment stacking & ES recharge (Phase B balance fixes)", () => {
  const def = (over: Partial<Defenses> = {}): Defenses => ({ life: 100, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 }, ...over });
  const off = (over: Partial<Offense> = {}): Offense => ({ hit: zeroBundle(), crit: 0, critMulti: 1.5, speed: 1, ailment: {}, ...over });
  const F = (name: string, d: Defenses, o: Offense): Fighter => ({ name, def: d, off: o });
  const always = () => 0; // every ailment roll lands; no crit / no evade

  test("ignite is strongest-only — DoT does NOT scale with attack speed (was an unbounded .push)", () => {
    const fire = (speed: number) => off({ hit: { ...zeroBundle(), fire: 10 }, speed, ailment: { ignite: 1 } });
    const tank = () => F("Tank", def({ life: 5000 }), off()); // huge life, deals nothing → both run to MAX_ROUNDS
    const slow = autoBattle(F("A", def(), fire(1)), tank(), always);
    const fast = autoBattle(F("A", def(), fire(4)), tank(), always); // 4 hits/round
    // 4× the HITS, but ignite is ONE refreshed instance → identical ignite DoT. The old
    // per-hit .push would have made fast's ignite DoT ~4× slow's.
    expect(fast.bTakenDot).toBe(slow.bTakenDot);
    expect(fast.bTakenDot).toBeGreaterThan(0);
  });

  test("poison stacks are capped — 10× attack speed does NOT give ~10× poison DoT", () => {
    const psn = (speed: number) => off({ hit: { ...zeroBundle(), phys: 10 }, speed, ailment: { poison: 1 } });
    const tank = () => F("Tank", def({ life: 100000 }), off());
    const s2 = autoBattle(F("A", def(), psn(2)), tank(), always);
    const s20 = autoBattle(F("A", def(), psn(20)), tank(), always);
    expect(s20.bTakenDot).toBeGreaterThanOrEqual(s2.bTakenDot); // ramps to the cap a touch faster
    expect(s20.bTakenDot).toBeLessThan(s2.bTakenDot * 1.5); // bounded by POISON_MAX_STACKS, NOT ~10×
  });

  test("ES does not recharge while hit every round (no-recent-hit gate)", () => {
    const hi = () => 0.99;
    const attacker = F("A", def(), off({ hit: { ...zeroBundle(), phys: 20 } })); // 20/round, always lands
    const esTank = F("D", def({ life: 100, energyShield: 100 }), off({ hit: { ...zeroBundle(), phys: 1 } }));
    const r = autoBattle(attacker, esTank, hi);
    expect(r.winner).toBe("a");
    // 200 effective HP / 20 ≈ 10 rounds. The old unconditional 15%/round ES recharge would
    // let the tank outlast ~20+ rounds; the gate keeps it near the un-recharged floor.
    expect(r.rounds).toBeLessThanOrEqual(14);
  });
});

// The generic modifier bag (rpg-mods.ts): PoE's base × (1 + increased) × more three-layer
// resolution that now backs every build stat. New stats are a key + one resolve; the `more`
// layer is available to any producer.
describe("modifier bag (base / increased / more)", () => {
  test("resolves base × (1 + Σincreased) × Πmore, each layer stacking correctly", () => {
    const bag = newBag();
    addMod(bag, "life", { base: 100 });
    addMod(bag, "life", { base: 20 }); // base sums → 120
    addMod(bag, "life", { inc: 0.5 });
    addMod(bag, "life", { inc: 0.25 }); // increased sums → +75%
    addMod(bag, "life", { more: 0.2 });
    addMod(bag, "life", { more: 0.1 }); // more multiplies → ×1.2 ×1.1
    expect(resolve(bag, "life")).toBeCloseTo(120 * 1.75 * 1.2 * 1.1, 6);
    expect(resolve(bag, "armour")).toBe(0); // an absent stat resolves to 0
  });

  test("the `more` layer is wired end-to-end — a Cổ Ngọc life perk lifts final Life", () => {
    const plain = effectiveBuild(profile({ perks: {} }));
    const perked = effectiveBuild(profile({ perks: { hp: 5 } }));
    expect(perked.def.life).toBeGreaterThan(plain.def.life); // perk applies as a MORE multiplier
  });
});

describe("atlas tree (endgame farming meta)", () => {
  test("points scale with the deepest floor — 1 per 5 floors (floor 25 → 5)", () => {
    expect(atlasPointsTotal(profile({ bestFloor: {} }))).toBe(0);
    expect(atlasPointsTotal(profile({ bestFloor: { rungma: 25 } }))).toBe(5);
    // takes the DEEPEST across all regions, floored
    expect(atlasPointsTotal(profile({ bestFloor: { rungma: 12, hangbang: 27 } }))).toBe(5);
    expect(atlasPointsTotal(profile({ bestFloor: { rungma: 4 } }))).toBe(0);
  });

  test("spendable = total earned − nodes allocated", () => {
    const p = profile({ bestFloor: { rungma: 25 }, atlasNodes: ["abundance", "fortune"] });
    expect(atlasPointsTotal(p)).toBe(5);
    expect(atlasPointsSpendable(p)).toBe(3);
  });

  test("aggregateAtlas is the product of chosen nodes' effects; empty = all 1", () => {
    expect(aggregateAtlas([])).toEqual({ lootMul: 1, uniqueMul: 1, shardMul: 1, goldMul: 1 });
    // 'abundance' is +15% loot → lootMul rises above 1
    const one = aggregateAtlas(["abundance"]);
    expect(one.lootMul).toBeCloseTo(1.15, 5);
    expect(one.uniqueMul).toBe(1);
    // two loot nodes multiply
    const two = aggregateAtlas(["abundance", "plentiful"]);
    expect(two.lootMul).toBeCloseTo(1.15 * 1.2, 5);
    // per-lever knobs stay on their own lever
    const uniq = aggregateAtlas(["fortune", "forge", "greed"]);
    expect(uniq.uniqueMul).toBeCloseTo(1.6, 5);
    expect(uniq.shardMul).toBeCloseTo(1.4, 5);
    expect(uniq.goldMul).toBeCloseTo(1.12, 5);
    expect(uniq.lootMul).toBe(1);
  });

  test("total aggregate loot × gold stays modest (no runaway inflation)", () => {
    // Even every node at once must not explode the coin faucet — goldMul kept ≤ ~1.5.
    const all = aggregateAtlas(ATLAS_NODES.map((n) => n.id));
    expect(all.goldMul).toBeLessThanOrEqual(1.5);
  });

  test("canAllocateAtlas: gated on free points, no re-pick, real node only", () => {
    const rich = profile({ bestFloor: { rungma: 25 }, atlasNodes: [] }); // 5 points free
    expect(canAllocateAtlas(rich, "abundance")).toBe(true);
    expect(canAllocateAtlas(rich, "nonsense-node")).toBe(false); // unknown id
    const owned = profile({ bestFloor: { rungma: 25 }, atlasNodes: ["abundance"] });
    expect(canAllocateAtlas(owned, "abundance")).toBe(false); // already allocated
    const broke = profile({ bestFloor: { rungma: 4 }, atlasNodes: [] }); // 0 points
    expect(canAllocateAtlas(broke, "abundance")).toBe(false);
  });

  test("keystones: endgame-gated, mutually exclusive (pick ONE), downside aggregates", () => {
    const low = profile({ bestFloor: { rungma: 20 }, atlasNodes: [] }); // 4 points < 5 → keystone locked
    expect(canAllocateAtlas(low, "ks_hoard")).toBe(false);
    const deep = profile({ bestFloor: { rungma: 60 }, atlasNodes: [] }); // 12 points
    expect(canAllocateAtlas(deep, "ks_hoard")).toBe(true);
    expect(canAllocateAtlas(deep, "ks_hunter")).toBe(true);
    const chosen = profile({ bestFloor: { rungma: 60 }, atlasNodes: ["ks_hoard"] });
    expect(ownedAtlasKeystone(chosen)?.id).toBe("ks_hoard");
    expect(canAllocateAtlas(chosen, "ks_hunter")).toBe(false); // one keystone identity only
    expect(canAllocateAtlas(chosen, "abundance")).toBe(true); // regular nodes unaffected
    const agg = aggregateAtlas(["ks_hoard"]);
    expect(agg.lootMul).toBeCloseTo(1.6, 5); // upside
    expect(agg.uniqueMul).toBeCloseTo(0.6, 5); // downside folds in (< 1)
  });

  test("atlasNodes survive applyPrestige (account-wide endgame meta)", () => {
    const p = profile({ cls: "chien", bestFloor: { rungma: 25 }, atlasNodes: ["abundance", "fortune"], level: 20 });
    const reborn = applyPrestige(p, powerScore(p), () => 0.5);
    expect(reborn.atlasNodes).toEqual(["abundance", "fortune"]);
    // bestFloor also survives → points are preserved through the rebirth
    expect(atlasPointsTotal(reborn)).toBe(5);
  });
});

describe("prestige (Season 2 — power-based reward, per-life eligibility)", () => {
  test("prestigeReward is ≥1, monotonic in power, +A per doubling", () => {
    expect(prestigeReward(1000)).toBe(1); // at base power → floor(log2(1))=0 → clamped to 1
    expect(prestigeReward(500)).toBe(1); // below base still floors to ≥1 (never 0 → never locks)
    const a = prestigeReward(50_000);
    const b = prestigeReward(100_000); // one doubling
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBe(2); // A=2 Cổ Ngọc per doubling
    expect(prestigeReward(684_000)).toBeGreaterThanOrEqual(18); // a maxed build ≈ the old +18
  });

  test("eligibility uses THIS-LIFE progress, not persistent bestFloor (spam-proof)", () => {
    const fresh = profile({ level: 1, bestFloorThisLife: 0 });
    expect(canPrestige(fresh)).toBe(false);
    expect(canPrestige(profile({ bestFloorThisLife: PRESTIGE_FLOOR }))).toBe(true);
    expect(canPrestige(profile({ level: MAX_LEVEL, bestFloorThisLife: 0 }))).toBe(true);
    // The old wall: a hero who reached the gate but was RESET is NOT eligible again despite
    // bestFloor persisting — the whole point of the per-life tracker.
    const reborn = applyPrestige(profile({ level: MAX_LEVEL, bestFloor: { rungma: 80 }, bestFloorThisLife: 80 }), 300_000, () => 0.5);
    expect(reborn.bestFloor.rungma).toBe(80); // all-time record survives
    expect(reborn.bestFloorThisLife).toBe(0); // per-life resets
    expect(canPrestige(reborn)).toBe(false); // → must re-climb, no free re-prestige
  });

  test("applyPrestige banks the power reward into Cổ Ngọc", () => {
    const p = profile({ coNgoc: 5, bestFloorThisLife: 25 });
    const reborn = applyPrestige(p, 100_000, () => 0.5);
    expect(reborn.coNgoc).toBe(5 + prestigeReward(100_000));
    expect(reborn.prestigeLevel).toBe(1);
    expect(reborn.level).toBe(1); // build wiped
  });

  test("a fresh character is stamped with the current season", () => {
    // The season gate is a league reset (guilds.rollRpgSeason wipes stale-season stores), so a
    // profile only ever needs to carry the season it was born in.
    expect(newProfile("cung", 0, () => 0.5).season).toBe(SEASON);
  });
});

describe("⭐ Ghép Sao (star merge)", () => {
  const withMods = (mods: Mod[], star = 0): GearItem => ({
    id: `star-${idc++}`,
    base: "kiem",
    slot: "vukhi",
    rarity: 2,
    roll: 1,
    plus: 0,
    ilvl: 20,
    mods,
    star,
  });

  test("fodder count + coin cost escalate per star (the sink)", () => {
    expect([0, 1, 2, 3, 4].map(mergeFodderNeeded)).toEqual([1, 2, 4, 6, 9]); // 22 total for ⭐5
    expect(mergeCoinCost(0)).toBeLessThan(mergeCoinCost(4)); // coins scale up too
    // The last star must dominate the climb, or ⭐5 becomes something every drop passes through
    // on its way past rather than a decision about one chosen item.
    const firstThree = [0, 1, 2].reduce((a, s) => a + mergeCoinCost(s), 0);
    expect(mergeCoinCost(4)).toBeGreaterThan(firstThree);
  });

  test("crafting stops one band short of T1 — the top tier is drop-only", () => {
    // A mod sitting at T2 is already at the crafting ceiling: merging may still add the star
    // (and its +7% base stats), but it cannot buy the last tier.
    const item = withMods([{ group: "resfire", kind: "suffix", stat: "resFire", tier: 2, value: 0.12 }]);
    const { item: up, upgraded } = starUpItem(item, () => 0.99);
    expect(up.star).toBe(1);
    expect(upgraded).toBeNull();
    expect(up.mods!.find((m) => m.group === "resfire")!.tier).toBe(2);

    // And walking an item all the way up lands on T2 across the board, never T1.
    let walked = withMods([
      { group: "life", kind: "prefix", stat: "life", tier: 4, value: 12 },
      { group: "resfire", kind: "suffix", stat: "resFire", tier: 4, value: 0.04 },
    ]);
    for (let i = 0; i < MAX_STAR; i++) walked = starUpItem(walked, () => 0.5).item;
    expect(walked.mods!.every((m) => m.tier >= MERGE_BEST_TIER)).toBe(true);
  });

  test("starUpItem raises star and upgrades the WORST mod one tier", () => {
    const item = withMods([
      { group: "life", kind: "prefix", stat: "life", tier: 1, value: 80 },
      { group: "resfire", kind: "suffix", stat: "resFire", tier: 4, value: 0.04 }, // worst → gets upgraded
    ]);
    const { item: up, upgraded } = starUpItem(item, () => 0.99);
    expect(up.star).toBe(1);
    expect(upgraded?.group).toBe("resfire");
    const res = up.mods!.find((m) => m.group === "resfire")!;
    expect(res.tier).toBe(3); // T4 → T3
    expect(res.value).toBeGreaterThan(0.04); // re-rolled in the better band
    expect(up.mods!.find((m) => m.group === "life")!.tier).toBe(1); // best mod untouched
  });

  test("star adds +7% base stats per star in gearStats (mods unaffected by the % — they get the tier bump)", () => {
    const bare = rollGear("kiem", 2, () => 0.5, 20, { full: true });
    const base = gearStats({ ...bare, star: 0 });
    const starred = gearStats({ ...bare, star: 3 });
    // A flat base stat (weapon atk implicit) scales ×(1+0.07*3)=1.21.
    const atk0 = base.atk ?? 0;
    const atk3 = starred.atk ?? 0;
    expect(atk0).toBeGreaterThan(0);
    expect(atk3 / atk0).toBeCloseTo(1.21, 1);
  });

  test("all-T1 (or no) mods → star still applies, no mod change", () => {
    const item = withMods([{ group: "life", kind: "prefix", stat: "life", tier: 1, value: 80 }]);
    const { item: up, upgraded } = starUpItem(item, () => 0.5);
    expect(up.star).toBe(1);
    expect(upgraded).toBeNull();
  });
});

describe("🔶 Đột Phá (breakthrough cap gate)", () => {
  const mk = (plus: number, capPlus?: number): GearItem => ({
    id: `br-${idc++}`,
    base: "kiem",
    slot: "vukhi",
    rarity: 2,
    roll: 1,
    plus,
    ilvl: 20,
    ...(capPlus === undefined ? {} : { capPlus }),
  });

  test("gearCap defaults to BREAK_CAP_BASE, respects capPlus, clamps to MAX_PLUS", () => {
    expect(gearCap(mk(0))).toBe(BREAK_CAP_BASE); // legacy item with no capPlus
    expect(gearCap(mk(0, 6))).toBe(6);
    expect(gearCap(mk(0, 99))).toBe(MAX_PLUS); // never above the absolute ceiling
    expect(BREAK_CAP_BASE).toBe(3);
    expect(BREAK_CAP_STEP).toBe(3);
  });

  test("canBreakthrough only when standing AT the ceiling and ceiling < MAX_PLUS", () => {
    expect(canBreakthrough(mk(0))).toBe(false); // +0, cap 3 — not at the wall yet
    expect(canBreakthrough(mk(2))).toBe(false); // +2, cap 3 — still below
    expect(canBreakthrough(mk(3))).toBe(true); // +3, cap 3 — at the wall
    expect(canBreakthrough(mk(6, 6))).toBe(true); // +6, cap 6 — next wall
    expect(canBreakthrough(mk(MAX_PLUS, MAX_PLUS))).toBe(false); // fully unlocked → no more Đột Phá
  });

  test("breakthroughItem raises the ceiling one step, clamped at MAX_PLUS (plus untouched)", () => {
    const a = breakthroughItem(mk(3)); // cap 3 → 6
    expect(gearCap(a)).toBe(6);
    expect(a.plus).toBe(3); // Đột Phá only lifts the ceiling, not the enhancement level
    const b = breakthroughItem(breakthroughItem(breakthroughItem(mk(3)))); // 3→6→9→12
    expect(gearCap(b)).toBe(MAX_PLUS);
    expect(gearCap(breakthroughItem(b))).toBe(MAX_PLUS); // idempotent at the top
  });

  test("breakthroughCost escalates per mốc (the pacing wall)", () => {
    const c3 = breakthroughCost(3);
    const c6 = breakthroughCost(6);
    const c9 = breakthroughCost(9);
    expect(c3.fodder).toBeLessThan(c9.fodder);
    expect(c3.dotpha).toBeLessThan(c9.dotpha);
    expect(c3.coins).toBeLessThan(c6.coins);
    expect(c6.coins).toBeLessThan(c9.coins);
    // A full climb 3→12 costs a bounded, known pile (guards silent balance drift).
    const total = [3, 6, 9].map(breakthroughCost);
    expect(total.reduce((s, c) => s + c.fodder, 0)).toBe(6);
    expect(total.reduce((s, c) => s + c.dotpha, 0)).toBe(7);
  });

  test("enhanceAttempt honours the ceiling — at cap it stays; below cap it can climb", () => {
    // +3 with cap 3: the +3 table entry (down-band) exists, but the ceiling blocks it → stay, no charm burnt.
    const atCap = enhanceAttempt(3, false, () => 0, 3);
    expect(atCap.result).toBe("stay");
    expect(atCap.newPlus).toBe(3);
    // Same +3 with a raised ceiling (cap 6) → the normal gamble runs (rng 0 < 0.9 up-chance → up).
    const raised = enhanceAttempt(3, false, () => 0, 6);
    expect(raised.result).toBe("up");
    expect(raised.newPlus).toBe(4);
    // Default cap == MAX_PLUS keeps every pre-Đột Phá call unchanged.
    expect(enhanceAttempt(0, false, () => 0).result).toBe("up");
  });

  test("boss floors can drop 🔶 Đá Đột Phá; non-boss floors never do", () => {
    const stage = STAGE_BY_ID["rungthieng"] ?? STAGES[0]!;
    // Force every rng() low so the boss 🔶 branch (rng < 0.5) fires.
    const bossFloor = stage.bossEvery;
    const drop = rollFloorLoot(stage, bossFloor, () => 0.01);
    expect(drop.materials.dotpha).toBeGreaterThanOrEqual(1);
    // A non-boss floor never mints the breakthrough stone, no matter the rng.
    let seen = 0;
    for (let f = 1; f < stage.bossEvery; f++) {
      let r = 0;
      const rng = () => (r = (r + 0.017) % 1); // sweep the unit interval deterministically
      if ((rollFloorLoot(stage, f, rng).materials.dotpha ?? 0) > 0) seen++;
    }
    expect(seen).toBe(0);
  });
});

describe("difficulty curve (polynomial, two exponents)", () => {
  const g = 0.1; // rungma's enemyGrowth
  test("=1 at floor 1 and matches the compounding curve at the anchor floor (early game unchanged)", () => {
    expect(floorDifficultyMul(g, 1)).toBeCloseTo(1, 5);
    const compoundingAtAnchor = Math.pow(1 + g, FLOOR_ANCHOR - 1);
    expect(floorDifficultyMul(g, FLOOR_ANCHOR)).toBeCloseTo(compoundingAtAnchor, 5);
    // Both curves are pinned to the same anchor, so they only diverge with depth — which is
    // what keeps a newcomer's experience identical no matter how LIFE_POW is tuned.
    expect(floorDifficultyMul(g, FLOOR_ANCHOR, DMG_POW)).toBeCloseTo(compoundingAtAnchor, 5);
  });

  test("DAMAGE stays far softer than compounding deep — that is the curve that kills", () => {
    const compoundingAt100 = Math.pow(1 + g, 99);
    expect(floorDifficultyMul(g, 100, DMG_POW)).toBeLessThan(compoundingAt100 / 20);
    expect(floorDifficultyMul(g, 100, DMG_POW)).toBeGreaterThan(floorDifficultyMul(g, 73, DMG_POW));
  });

  test("LIFE outruns DAMAGE with depth, so deep fights last rounds instead of ending in one hit", () => {
    expect(LIFE_POW).toBeGreaterThan(DMG_POW);
    for (const floor of [50, 100, 200]) {
      expect(floorDifficultyMul(g, floor, LIFE_POW)).toBeGreaterThan(floorDifficultyMul(g, floor, DMG_POW));
    }
    // …and life never runs away into a compounding wall either.
    expect(floorDifficultyMul(g, 100, LIFE_POW)).toBeLessThan(Math.pow(1 + g, 99));
  });

  test("a harder region stays harder at every depth", () => {
    expect(floorDifficultyMul(0.12, 50)).toBeGreaterThan(floorDifficultyMul(0.1, 50));
  });
});

describe("one-shot protection (MAX_HIT_FRAC)", () => {
  const bigHit: Offense = {
    hit: { phys: 100_000, fire: 0, cold: 0, light: 0, chaos: 0 },
    crit: 0, critMulti: 1.5, speed: 1, ailment: {},
  };
  const bare = (life: number, maxHit?: number): Defenses => ({
    life, energyShield: 0, armour: 0, evasion: 0,
    res: { fire: 0, cold: 0, light: 0, chaos: 0 },
    ...(maxHit === undefined ? {} : { maxHit }),
  });

  test("a hero never takes more than MAX_HIT_FRAC of max life from one hit", () => {
    const life = 4000;
    const cap = Math.round(life * MAX_HIT_FRAC);
    const { dmg } = mitigatedHit(bigHit, bare(life, cap), () => 0.99);
    expect(dmg).toBeLessThanOrEqual(cap);
    // Surviving a hit that would otherwise be ~25× the life pool is the whole point.
    expect(dmg).toBeLessThan(life);
  });

  test("monsters carry NO cap, so hero DPS is never clipped and building damage still pays", () => {
    const { dmg } = mitigatedHit(bigHit, bare(4000), () => 0.99);
    expect(dmg).toBeGreaterThan(4000);
  });

  test("the cap is pinned to MAX life, so it does not shrink as the hero gets hurt", () => {
    const maxLife = 4000;
    const cap = Math.round(maxLife * MAX_HIT_FRAC);
    // The expedition rebuilds the hero each floor with `life` = CURRENT hp; the cap must not
    // follow it down, or protection would weaken exactly when the hero is most vulnerable.
    const hurt = { ...bare(200, cap) };
    const { dmg } = mitigatedHit(bigHit, hurt, () => 0.99);
    expect(dmg).toBe(cap);
  });

  test("effectiveBuild stamps the cap on every hero", () => {
    const p = newProfile("chien", 0, () => 0.5);
    const build = effectiveBuild(p);
    expect(build.def.maxHit).toBe(Math.max(1, Math.round(build.def.life * MAX_HIT_FRAC)));
  });
});

describe("floor kinds (the run's rhythm)", () => {
  const rung = STAGE_BY_ID.rungma!;

  test("boss milestones always win, and the opening floors stay a plain fight", () => {
    for (const f of [10, 20, 30]) expect(floorKind(rung, f, () => 0.99)).toBe("boss");
    // A brand-new hero should meet the basic loop before it starts throwing variants.
    for (let f = 1; f <= 5; f++) expect(floorKind(rung, f, () => 0.0)).toBe("normal");
  });

  test("past the opening, the roll spreads across every kind and stays majority-normal", () => {
    const seen = new Map<string, number>();
    const rng = mulberry(99);
    let n = 0;
    for (let f = 6; f < 3000; f++) {
      if (f % rung.bossEvery === 0) continue; // boss floors aren't rolled
      const k = floorKind(rung, f, rng);
      seen.set(k, (seen.get(k) ?? 0) + 1);
      n++;
    }
    for (const kind of ["normal", "elite", "chest", "shrine", "event"]) expect(seen.get(kind) ?? 0).toBeGreaterThan(0);
    // Fights must remain the backbone — variants are seasoning, not the meal.
    expect((seen.get("normal") ?? 0) / n).toBeGreaterThan(0.6);
  });
});

describe("elite affixes", () => {
  const base = (): Fighter => ({
    name: "Quái",
    def: { life: 1000, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 } },
    off: { hit: { phys: 100, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1.5, speed: 1, ailment: {} },
  });

  test("makeElite adds life, damage and exactly one affix effect", () => {
    const affix = ELITE_AFFIXES[0]!;
    const elite = makeElite(base(), affix);
    expect(elite.def.life).toBeGreaterThan(1000);
    expect(elite.off.hit.phys).toBeGreaterThan(100);
    expect(elite.fx).toHaveLength(1);
    expect(elite.fx![0]!.id).toBe(affix.fx.id);
    expect(elite.name).toContain(affix.name);
  });

  test("makeElite is pure — the source fighter is untouched", () => {
    const src = base();
    makeElite(src, ELITE_AFFIXES[1]!);
    expect(src.def.life).toBe(1000);
    expect(src.off.hit.phys).toBe(100);
    expect(src.fx).toBeUndefined();
  });

  test("every affix is a real registered mechanic (no dangling ids)", () => {
    for (const a of ELITE_AFFIXES) expect(EFFECTS[a.fx.id]).toBeDefined();
  });

  // Each affix is compared against the SAME monster without it, on the same seed. The
  // attacker is a deliberate PUNCHING BAG (huge life, no crit): with two evenly-matched
  // fighters the hero simply dies first and every fight ends on the same round, which
  // measures nothing. A bag that cannot die makes fight length depend only on the affix.
  const withAffix = (id: string): Fighter => {
    const a = ELITE_AFFIXES.find((x) => x.id === id)!;
    return { ...base(), fx: [a.fx] };
  };
  const bag = (): Fighter => ({
    name: "Bao cát",
    def: { life: 5_000_000, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 } },
    off: { hit: { phys: 100, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1.5, speed: 1, ailment: {} },
  });

  test("Vỏ Dày makes a healthy elite take longer to kill", () => {
    const plain = autoBattle(bag(), base(), mulberry(3));
    const tough = autoBattle(bag(), withAffix("voday"), mulberry(3));
    expect(tough.rounds).toBeGreaterThan(plain.rounds);
  });

  test("Tái Sinh heals the elite every round, stretching the fight", () => {
    const plain = autoBattle(bag(), base(), mulberry(8));
    const regen = autoBattle(bag(), withAffix("taisinh"), mulberry(8));
    expect(regen.rounds).toBeGreaterThan(plain.rounds);
  });

  test("Giáp Gai costs the attacker life it would not otherwise lose", () => {
    const plain = autoBattle(bag(), base(), mulberry(12));
    const thorns = autoBattle(bag(), withAffix("giapgai"), mulberry(12));
    // Measured via remaining life, NOT aTaken: reflected damage is a raw drain through
    // FxUnit.damage, which deliberately bypasses the hit pipeline (and its counters).
    expect(thorns.aHpAfter).toBeLessThan(plain.aHpAfter);
  });

  test("Cuồng Nộ makes a dying elite hit harder, never softer", () => {
    const plain = autoBattle(bag(), base(), mulberry(21));
    const frenzy = autoBattle(bag(), withAffix("cuongno"), mulberry(21));
    expect(frenzy.aHpAfter).toBeLessThan(plain.aHpAfter);
  });
});

describe("ân huệ (run-scoped build)", () => {
  const hero = (): Fighter => ({
    name: "Hero",
    def: { life: 2000, energyShield: 0, armour: 100, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 }, maxHit: 700 },
    off: { hit: { phys: 200, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0.1, critMulti: 1.5, speed: 1, ailment: {} },
  });

  test("an offer never repeats what you already hold", () => {
    const held = BOONS.slice(0, 4).map((b) => b.id);
    const offer = rollBoonOffer(held, mulberry(11));
    expect(offer).toHaveLength(3);
    for (const id of offer) expect(held).not.toContain(id);
    expect(new Set(offer).size).toBe(offer.length); // no dupes within the offer either
  });

  test("the offer shrinks rather than duplicating once the pool runs dry", () => {
    const all = BOONS.map((b) => b.id);
    expect(rollBoonOffer(all, mulberry(5))).toHaveLength(0);
    expect(rollBoonOffer(all.slice(0, all.length - 2), mulberry(5))).toHaveLength(2);
  });

  test("applyBoons folds stats and stacks fx without touching the source", () => {
    const src = hero();
    const out = applyBoons(src, ["cuonghuyet", "khientotien"]);
    expect(out.off.hit.phys).toBeGreaterThan(200); // Cuồng Huyết damage
    expect(out.def.moreTaken).toBeCloseTo(0.15, 5); // …and its cost
    expect(out.fx?.some((f) => f.id === "block")).toBe(true); // Khiên Tổ Tiên
    expect(src.off.hit.phys).toBe(200); // source untouched
    expect(src.fx).toBeUndefined();
  });

  test("NO boon moves max life — the run's hp/maxLife/one-shot-cap contract depends on it", () => {
    for (const b of BOONS) {
      expect(applyBoons(hero(), [b.id]).def.life).toBe(2000);
    }
  });

  test("re-applying the same boons is idempotent (the engine re-folds every floor)", () => {
    const once = applyBoons(hero(), ["notham", "dada"]);
    const twice = applyBoons(hero(), ["notham", "dada"]);
    expect(twice.off.hit.phys).toBe(once.off.hit.phys);
    expect(twice.def.armour).toBe(once.def.armour);
    expect(twice.fx?.length ?? 0).toBe(once.fx?.length ?? 0);
  });

  test("loot and heal boons aggregate", () => {
    expect(boonLootMul(["thamlam"])).toBeCloseTo(1.45, 5);
    expect(boonLootMul([])).toBe(1);
    expect(boonHealFrac(["suoinguon"])).toBeCloseTo(0.07, 5);
    expect(boonHealFrac(["cuonghuyet"])).toBe(0);
  });

  test("every boon's fx is a registered mechanic", () => {
    for (const b of BOONS) if (b.fx) expect(EFFECTS[b.fx.id]).toBeDefined();
  });
});

describe("nhiệm vụ hằng ngày", () => {
  test("a board holds DAILY_COUNT distinct quests with real targets", () => {
    const b = rollBoard(Date.parse("2026-07-22T10:00:00Z"), mulberry(4));
    expect(b.quests).toHaveLength(DAILY_COUNT);
    expect(new Set(b.quests.map((q) => q.id)).size).toBe(DAILY_COUNT);
    for (const q of b.quests) {
      expect(QUEST_BY_ID[q.id]!.targets).toContain(q.target);
      expect(q.progress).toBe(0);
      expect(q.claimed).toBe(false);
    }
  });

  test("the board rerolls when the UTC day turns, and is kept within the same day", () => {
    const mon = Date.parse("2026-07-22T23:00:00Z");
    const first = rollBoard(mon, mulberry(1));
    expect(boardFor(first, mon + 30 * 60_000, mulberry(2)).rolled).toBe(false); // same day
    expect(boardFor(first, mon + 2 * 3_600_000, mulberry(2)).rolled).toBe(true); // crossed UTC midnight
  });

  test("counting metrics accumulate but depth is a high-water mark", () => {
    const board = { day: dayKey(0), quests: [
      { id: "dicho", target: 100, progress: 0, claimed: false },
      { id: "xuongsau", target: 60, progress: 0, claimed: false },
    ] };
    creditRun(board, { floors: 40, elites: 0, bosses: 0, depth: 40, chests: 0 });
    creditRun(board, { floors: 40, elites: 0, bosses: 0, depth: 25, chests: 0 });
    expect(board.quests[0]!.progress).toBe(80); // floors add up across runs
    expect(board.quests[1]!.progress).toBe(40); // a shallower run must not lower best depth
  });

  test("a quest becomes claimable once, and claiming is what stops it repaying", () => {
    const board = { day: dayKey(0), quests: [{ id: "dicho", target: 40, progress: 0, claimed: false }] };
    creditRun(board, { floors: 45, elites: 0, bosses: 0, depth: 45, chests: 0 });
    expect(claimable(board)).toHaveLength(1);
    board.quests[0]!.claimed = true;
    expect(claimable(board)).toHaveLength(0);
    creditRun(board, { floors: 99, elites: 0, bosses: 0, depth: 99, chests: 0 });
    expect(claimable(board)).toHaveLength(0); // stays paid
  });

  test("every quest rewards something and names a metric the engine reports", () => {
    for (const q of QUESTS) {
      expect(["floors", "elites", "bosses", "depth", "chests"]).toContain(q.metric);
      const r = q.reward;
      expect((r.coins ?? 0) > 0 || Object.keys(r.materials ?? {}).length > 0).toBe(true);
      expect(q.targets.length).toBeGreaterThan(0);
    }
  });
});

describe("spirit affix rolling", () => {
  test("spirit only ever rolls on weapon / body / ring", () => {
    const allowed = new Set(["vukhi", "giap", "nhan"]);
    const rng = mulberry(31);
    let spiritRolls = 0;
    for (const slot of GEAR_SLOTS) {
      const base = Object.entries(GEAR_BASES).find(([, b]) => b.slot === slot.id)![0];
      for (let i = 0; i < 400; i++) {
        const item = rollGear(base, 3, rng, 60);
        for (const m of item.mods ?? []) {
          if (m.stat !== "spirit") continue;
          spiritRolls++;
          expect(allowed.has(slot.id)).toBe(true);
        }
      }
    }
    expect(spiritRolls).toBeGreaterThan(0); // it must actually be reachable
  });

  test("mana and its regen stay rollable on every slot", () => {
    const rng = mulberry(77);
    const seen = new Set<string>();
    for (const slot of GEAR_SLOTS) {
      const base = Object.entries(GEAR_BASES).find(([, b]) => b.slot === slot.id)![0];
      for (let i = 0; i < 400; i++) {
        for (const m of rollGear(base, 3, rng, 60).mods ?? []) {
          if (m.stat === "mana" || m.stat === "manaRegen") seen.add(slot.id);
        }
      }
    }
    expect(seen.size).toBe(GEAR_SLOTS.length);
  });
});

describe("mana cost (supports have to be paid for)", () => {
  const skill = () => newSkillGem("caulua"); // manaCost 12, spell/projectile

  test("each linked support multiplies the cost; the bare skill is the floor", () => {
    const bare = skillManaCost(skill(), []);
    expect(bare.full).toBe(bare.base);
    const one = skillManaCost(skill(), [newSupportGem("bùngno")]); // ×1.35
    expect(one.full).toBeGreaterThan(bare.full);
    const two = skillManaCost(skill(), [newSupportGem("bùngno"), newSupportGem("chimang")]); // ×1.35×1.25
    expect(two.full).toBeGreaterThan(one.full);
    expect(two.base).toBe(bare.base); // the fallback swing never gets pricier
  });

  test("a support that does nothing costs nothing — tag mismatch is not billed", () => {
    // Melee Physical Damage on a spell: it can't apply, so it must not raise the bill.
    const mismatched = skillManaCost(skill(), [newSupportGem("tanbao")]);
    expect(mismatched.full).toBe(skillManaCost(skill(), []).full);
  });

  test("supports past the socket count are neither applied nor billed", () => {
    const gem = SKILL_BY_ID.caulua!;
    const many = Array.from({ length: gem.sockets + 3 }, () => newSupportGem("bùngno"));
    const capped = Array.from({ length: gem.sockets }, () => newSupportGem("bùngno"));
    expect(skillManaCost(skill(), many).full).toBe(skillManaCost(skill(), capped).full);
  });
});

describe("the per-swing mana gate", () => {
  const foe = (): Fighter => ({
    name: "Bia",
    def: { life: 5_000_000, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 } },
    off: { hit: { phys: 0, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1, speed: 1, ailment: {} },
  });
  // Full swing hits for 100, the bare fallback for 10 — so the log of damage dealt tells us
  // exactly which swing the mana gate allowed.
  const hero = (mana: { max: number; regen: number; cost: { full: number; base: number } }): Fighter => ({
    name: "Hero",
    def: { life: 10_000, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 } },
    off: { hit: { phys: 100, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1, speed: 1, ailment: {} },
    basic: { hit: { phys: 10, fire: 0, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1, speed: 1, ailment: {} },
    mana,
  });

  test("a full pool pays full price and swings the supported skill", () => {
    const r = autoBattle(hero({ max: 1000, regen: 1000, cost: { full: 50, base: 10 } }), foe(), mulberry(5), { maxRounds: 3 });
    expect(r.bTaken).toBe(300); // 3 rounds × the 100-damage swing
  });

  test("too poor for the full skill but not for the bare one → the fallback swings", () => {
    // The pool starts FULL, so cap it below the full price: 12 max never reaches 50,
    // but always covers the 10-cost fallback.
    const r = autoBattle(hero({ max: 12, regen: 12, cost: { full: 50, base: 10 } }), foe(), mulberry(5), { maxRounds: 3 });
    expect(r.bTaken).toBe(30); // 3 × the 10-damage fallback
  });

  test("below even the bare cost the swing does not happen at all", () => {
    const r = autoBattle(hero({ max: 5, regen: 0, cost: { full: 50, base: 10 } }), foe(), mulberry(5), { maxRounds: 3 });
    expect(r.bTaken).toBe(0);
  });

  test("a fighter with no mana budget is unaffected (monsters never pay)", () => {
    const free: Fighter = { ...hero({ max: 0, regen: 0, cost: { full: 999, base: 999 } }) };
    delete (free as { mana?: unknown }).mana;
    const r = autoBattle(free, foe(), mulberry(5), { maxRounds: 3 });
    expect(r.bTaken).toBe(300);
  });

  test("regen refills between rounds, so a big pool sustains bursts", () => {
    // Pool 50 → round 1 affords the full swing, then regen 50 restores it each round.
    const r = autoBattle(hero({ max: 50, regen: 50, cost: { full: 50, base: 10 } }), foe(), mulberry(5), { maxRounds: 3 });
    expect(r.bTaken).toBe(300);
  });
});

// The statistical tests below sample tens of thousands of rolls to say anything meaningful about
// a distribution. They finish in well under a second on an idle machine, but they sit close
// enough to bun's 5s default that a loaded CI box (or anything else heavy running alongside)
// turns them into false failures. The generous ceiling buys determinism without weakening a
// single assertion — the sample sizes are what make these tests worth having.
const HEAVY_STAT_TIMEOUT = 60_000;

describe("affix RNG integrity", () => {
  const baseFor = (slot: string) => Object.entries(GEAR_BASES).find(([, b]) => b.slot === slot)![0];
  const SPIRIT_SLOTS = new Set(["vukhi", "giap", "nhan"]);

  test("structural invariants hold across every rarity and slot", () => {
    const rng = mulberry(2024);
    for (const { id: slot } of GEAR_SLOTS) {
      for (const rarity of [0, 1, 2, 3, 4] as const) {
        for (let i = 0; i < 400; i++) {
          const mods = rollGear(baseFor(slot), rarity, rng, 80).mods ?? [];
          // one mod per group
          const groups = mods.map((m) => m.group);
          expect(new Set(groups).size).toBe(groups.length);
          // never over the prefix/suffix cap
          expect(mods.filter((m) => m.kind === "prefix").length).toBeLessThanOrEqual(MOD_CAP[rarity].pre);
          expect(mods.filter((m) => m.kind === "suffix").length).toBeLessThanOrEqual(MOD_CAP[rarity].suf);
          // slot-restricted affixes never escape their slots
          if (mods.some((m) => m.group === "spirit")) expect(SPIRIT_SLOTS.has(slot)).toBe(true);
        }
      }
    }
  });

  test("a modded rarity always rolls at least one mod", () => {
    const rng = mulberry(4242);
    for (const rarity of [1, 2, 3, 4] as const) {
      for (let i = 0; i < 500; i++) {
        expect((rollGear("kiem", rarity, rng, 40).mods ?? []).length).toBeGreaterThan(0);
      }
    }
    expect(rollGear("kiem", 0, mulberry(1), 40).mods ?? []).toHaveLength(0); // Normal has none
  });

  test("how often a family rolls tracks its spawn weight, not 1/N", () => {
    // At a high ilvl every tier is unlocked, so each family contributes the same tier-weight
    // sum and its share of the pool should land in proportion to `def.weight`.
    const rng = mulberry(1234);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      for (const m of rollGear(baseFor("vukhi"), 3, rng, 80).mods ?? []) {
        counts.set(m.group, (counts.get(m.group) ?? 0) + 1);
      }
    }
    for (const kind of ["prefix", "suffix"] as const) {
      const defs = MOD_POOL.filter((d) => d.kind === kind && (!d.slots || d.slots.includes("vukhi")));
      const weightTotal = defs.reduce((a, d) => a + d.weight, 0);
      const observedTotal = defs.reduce((a, d) => a + (counts.get(d.group) ?? 0), 0);
      for (const d of defs) {
        const wantPct = (100 * d.weight) / weightTotal;
        const gotPct = (100 * (counts.get(d.group) ?? 0)) / observedTotal;
        // One mod per group per item skews shares slightly toward rarer families (a common
        // one is more often already taken), so allow a modest band around the target.
        expect(Math.abs(gotPct - wantPct)).toBeLessThan(2.5);
      }
    }
  });

  test("a staple outrolls a niche affix by roughly their weight ratio", () => {
    const rng = mulberry(808);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      for (const m of rollGear(baseFor("giap"), 3, rng, 80).mods ?? []) {
        counts.set(m.group, (counts.get(m.group) ?? 0) + 1);
      }
    }
    const life = counts.get("life") ?? 0;
    const spirit = counts.get("spirit") ?? 0;
    expect(spirit).toBeGreaterThan(0); // still reachable
    const wantRatio = MOD_POOL.find((d) => d.group === "life")!.weight / MOD_POOL.find((d) => d.group === "spirit")!.weight;
    expect(life / spirit).toBeGreaterThan(wantRatio * 0.6);
    expect(life / spirit).toBeLessThan(wantRatio * 1.6);
  });

  test("tier odds follow the shared weight curve — including the slot-restricted spirit affix", () => {
    const rng = mulberry(555);
    const perGroup = new Map<string, number[]>();
    for (const { id: slot } of GEAR_SLOTS) {
      for (let i = 0; i < 6000; i++) {
        for (const m of rollGear(baseFor(slot), 4, rng, 80).mods ?? []) {
          const arr = perGroup.get(m.group) ?? [0, 0, 0, 0];
          arr[m.tier - 1]!++;
          perGroup.set(m.group, arr);
        }
      }
    }
    // weights 3/22/55/100 → 1.67 / 12.22 / 30.56 / 55.56 %
    const expected = [1.67, 12.22, 30.56, 55.56];
    for (const [group, arr] of perGroup) {
      const total = arr.reduce((a, b) => a + b, 0);
      if (total < 2000) continue; // too small a sample to assert on
      arr.forEach((n, i) => {
        expect(Math.abs((100 * n) / total - expected[i]!)).toBeLessThan(2.5);
      });
      expect(group).toBeTruthy();
    }
  }, HEAVY_STAT_TIMEOUT);

  test("Huyền Thoại out-rolls Sử Thi, and its last affix slot is earned by depth", () => {
    const rng = mulberry(31337);
    const N = 1200;
    let epicTotal = 0;
    for (let i = 0; i < N; i++) {
      epicTotal += (rollGear("kiem", 3, rng, 80).mods ?? []).length;

      // Deep enough: the top rarity fills its whole (larger) canvas.
      const deep = rollGear("kiem", 4, rng, LEGENDARY_FULL_ILVL).mods ?? [];
      expect(deep).toHaveLength(MOD_CAP[4].pre + MOD_CAP[4].suf);

      // Shallow: still the best rarity, but one affix per side short of its maximum shape.
      const shallow = rollGear("kiem", 4, rng, LEGENDARY_FULL_ILVL - 1).mods ?? [];
      expect(shallow).toHaveLength(MOD_CAP[4].pre + MOD_CAP[4].suf - 2);
      expect(shallow.length).toBeGreaterThan(MOD_CAP[3].pre + MOD_CAP[3].suf - 2); // still beats a typical Sử Thi
    }
    // Legendary's cap is genuinely wider, not just more reliably filled.
    expect(MOD_CAP[4].pre).toBeGreaterThan(MOD_CAP[3].pre);
    expect(MOD_CAP[4].suf).toBeGreaterThan(MOD_CAP[3].suf);
    expect((MOD_CAP[4].pre + MOD_CAP[4].suf) * N).toBeGreaterThan(epicTotal);
  });

  test("perfection is a long tail, not a wall — each extra T1 is harder but reachable", () => {
    const rng = mulberry(4242);
    const N = 40000;
    const hist = new Array(9).fill(0);
    for (let i = 0; i < N; i++) {
      const mods = rollGear("kiem", 4, rng, 80).mods ?? [];
      hist[mods.filter((m) => m.tier === 1).length]!++;
    }
    const atLeast = (k: number) => hist.slice(k).reduce((a, b) => a + b, 0) / N;
    // A T1 shows up often enough to chase…
    expect(atLeast(1)).toBeGreaterThan(0.08);
    // …two is a real prize, three a rarity — strictly decreasing, none of them impossible.
    expect(atLeast(2)).toBeLessThan(atLeast(1) / 3);
    expect(atLeast(3)).toBeLessThan(atLeast(2) / 3);
    expect(atLeast(3)).toBeGreaterThan(0); // still attainable, not a hard wall
    // The tail must STAY a tail: a fully-T1 item is not something the drop table hands out.
    expect(hist[MOD_CAP[4].pre + MOD_CAP[4].suf]).toBe(0);
  }, HEAVY_STAT_TIMEOUT);

  test("a jackpot grants slots and depth — never rolled quality", () => {
    // The 🌟 chấn động drop is the best CANVAS in the game: guaranteed Huyền Thoại, full affix
    // count, deep ilvl. What it must never be is a finished item — when it forced every affix
    // to T1, jackpots became the source of most Huyền Thoại in play and the whole tier ladder
    // (and the player market with it) stopped meaning anything.
    const rng = mulberry(9182);
    const stage = STAGES[0]!;
    const floor = 41 % stage.bossEvery === 0 ? 42 : 41; // jackpots are a NON-boss floor event
    let rolled = 0;
    let allT1 = 0;
    for (let i = 0; i < 20000; i++) {
      const d = rollFloorLoot(stage, floor, rng, undefined, 1);
      if (!d.jackpot) continue;
      const item = d.gear.find((g) => g.rarity === 4 && !g.uniqueId);
      if (!item) continue;
      rolled++;
      const mods = item.mods ?? [];
      expect(mods).toHaveLength(MOD_CAP[4].pre + MOD_CAP[4].suf); // the full canvas is the prize
      expect(item.ilvl).toBe(JACKPOT_ILVL);
      if (mods.length > 0 && mods.every((m) => m.tier === 1)) allT1++;
    }
    expect(rolled).toBeGreaterThan(0); // the sample actually saw jackpots
    expect(allT1).toBe(0); // …and not one of them arrived pre-perfected
  }, HEAVY_STAT_TIMEOUT);

  test("ilvl gates a tier off entirely — deep tiers cannot drop shallow", () => {
    const rng = mulberry(77);
    for (const [ilvl, worstAllowedTier] of [[1, 4], [8, 3], [20, 2]] as const) {
      let best = 9;
      for (const { id: slot } of GEAR_SLOTS) {
        for (let i = 0; i < 1500; i++) {
          for (const m of rollGear(baseFor(slot), 4, rng, ilvl).mods ?? []) best = Math.min(best, m.tier);
        }
      }
      expect(best).toBeGreaterThanOrEqual(worstAllowedTier);
    }
  });
});

describe("progression curves (geometric, PoE-shaped)", () => {
  test("each level costs meaningfully more than the last — a true growth curve", () => {
    for (let lv = 1; lv < MAX_LEVEL - 1; lv++) {
      expect(levelUpCost(lv + 1).tinhchat).toBeGreaterThanOrEqual(levelUpCost(lv).tinhchat);
    }
    // The late game must be an order of magnitude harsher than the early game, not a
    // slightly steeper line.
    expect(levelUpCost(MAX_LEVEL - 1).tinhchat).toBeGreaterThan(levelUpCost(10).tinhchat * 50);
    // …while the first levels stay cheap enough to fly through.
    expect(levelUpCost(1).tinhchat).toBeLessThan(6);
  });

  test("the whole climb is a season-long goal, not an afternoon's", () => {
    let total = 0;
    for (let lv = 1; lv < MAX_LEVEL; lv++) total += levelUpCost(lv).tinhchat;
    // A linear 2+level curve totalled ~1.3k; the geometric one must be far beyond that.
    expect(total).toBeGreaterThan(8000);
    // The final level alone should cost more than the first twenty combined.
    let firstTwenty = 0;
    for (let lv = 1; lv <= 20; lv++) firstTwenty += levelUpCost(lv).tinhchat;
    expect(levelUpCost(MAX_LEVEL - 1).tinhchat).toBeGreaterThan(firstTwenty);
  });

  test("dying costs Essence, scaled by level — free early, brutal at cap", () => {
    expect(deathEssencePenalty(5, 1000)).toBe(0); // early deaths are a shrug
    expect(deathEssencePenalty(8, 1000)).toBe(0); // still inside the grace band
    // Strictly increasing with level through the ramp.
    const at20 = deathEssencePenalty(20, 1000);
    const at35 = deathEssencePenalty(35, 1000);
    const atCap = deathEssencePenalty(MAX_LEVEL, 1000);
    expect(at20).toBeGreaterThan(0);
    expect(at35).toBeGreaterThan(at20);
    expect(atCap).toBeGreaterThan(at35);
    // Capped at the documented maximum, and never able to take what isn't there.
    expect(atCap).toBe(Math.floor(1000 * DEATH_XP_PENALTY_MAX));
    expect(deathEssencePenalty(MAX_LEVEL, 0)).toBe(0);
    expect(deathEssencePenalty(MAX_LEVEL, 3)).toBeLessThanOrEqual(3);
  });

  test("bosses hit harder the deeper you meet them, but stay a spike not an execution", () => {
    const stage = STAGE_BY_ID.rungma!;
    const dmgAt = (floor: number) => {
      let total = 0;
      for (let i = 0; i < 200; i++) total += bundleTotal(genMonster(stage, floor, 1, mulberry(i + 1), []).off.hit);
      return total / 200;
    };
    // A boss's multiplier over the ordinary monster beside it grows with depth…
    const shallowRatio = dmgAt(10) / dmgAt(11);
    const deepRatio = dmgAt(300) / dmgAt(301);
    expect(deepRatio).toBeGreaterThan(shallowRatio);
    // …but the multiplier is bounded, so depth never turns a boss into an unavoidable death.
    expect(deepRatio).toBeLessThan(4);
  });
});

describe("out-levelling penalty (anti low-tier farming)", () => {
  const first = STAGES[0]!; // opening region, lowest area level
  const last = STAGES[STAGES.length - 1]!;

  test("area level rises with both region and tier", () => {
    expect(mapLevel(last, 1)).toBeGreaterThan(mapLevel(first, 1));
    expect(mapLevel(first, 8)).toBeGreaterThan(mapLevel(first, 1));
  });

  test("newcomers are never penalised anywhere", () => {
    for (const st of STAGES) {
      expect(rewardMultiplier(1, st, 1)).toBe(1);
      expect(rewardMultiplier(10, st, 1)).toBe(1);
    }
  });

  test("a capped hero farming the opening region at T1 is cut hard", () => {
    const cut = rewardMultiplier(MAX_LEVEL, first, 1);
    expect(cut).toBeLessThan(0.5);
    expect(cut).toBeGreaterThanOrEqual(0.2); // never zero — farming is throttled, not banned
  });

  test("there is always a way out: raise the tier or go to a deeper region", () => {
    const cut = rewardMultiplier(MAX_LEVEL, first, 1);
    expect(rewardMultiplier(MAX_LEVEL, first, 16)).toBeGreaterThan(cut); // push tier
    expect(rewardMultiplier(MAX_LEVEL, last, 1)).toBeGreaterThan(cut); // or push region
    expect(rewardMultiplier(MAX_LEVEL, last, 8)).toBe(1); // appropriate content pays in full
  });

  test("there is a WIDE middle band — pushing a tier or two visibly pays", () => {
    // The failure this guards against: an exponent steep enough that everything below the
    // safe zone slams onto the floor, so a player who did climb tiers sees no reward for it.
    const mid = STAGES[1]!;
    const band = [1, 4, 8, 12, 16].map((t) => rewardMultiplier(MAX_LEVEL, mid, t));
    // Strictly improving as tiers rise…
    for (let i = 1; i < band.length; i++) expect(band[i]!).toBeGreaterThanOrEqual(band[i - 1]!);
    // …and at least one rung lands strictly between the floor and full pay, i.e. a real
    // gradient rather than an on/off switch.
    expect(band.some((m) => m > 0.3 && m < 0.99)).toBe(true);
  });

  test("running content ABOVE your level is never penalised", () => {
    for (const lv of [10, 30, MAX_LEVEL]) {
      expect(rewardMultiplier(lv, last, 16)).toBe(1);
    }
  });

  test("the safe zone widens with level, so normal play never trips it", () => {
    // A hero is never punished for the region that matches their own progression stage.
    for (const [lv, st] of [[10, STAGES[0]!], [25, STAGES[2]!], [40, STAGES[4]!]] as const) {
      expect(rewardMultiplier(lv, st, 4)).toBe(1);
    }
  });
});
