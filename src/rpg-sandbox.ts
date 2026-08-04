// RPG SANDBOX — a headless, self-contained driver for the Cửa Ải RPG so the whole game can be
// PLAYED (and audited) with zero Discord / config / token, straight over the pure engine cores.
//
// Two ways to use it:
//   1. Play it like a person, one action per CLI call — state persists to a save file, so each
//      command mirrors issuing one `/rpg` slash command:
//        bun run src/rpg-sandbox.ts new phap
//        bun run src/rpg-sandbox.ts supply luongthuc 40
//        bun run src/rpg-sandbox.ts dispatch rungma
//        bun run src/rpg-sandbox.ts levelup
//        bun run src/rpg-sandbox.ts passives           # list the tree
//        bun run src/rpg-sandbox.ts passive thechat_e  # allocate a node
//        bun run src/rpg-sandbox.ts status
//   2. Audits — statistical, deterministic (seeded), no save touched:
//        bun run src/rpg-sandbox.ts audit-drops
//        bun run src/rpg-sandbox.ts audit-passives
//        bun run src/rpg-sandbox.ts autoplay phap --sessions 60 --seed 7
//
// The combat + loot loop below is a faithful transcription of expeditions.ts `advanceExpedition`
// (genMonster → autoBattle → rollFloorLoot → mergeLoot → recover), minus the store/time-gating and
// with weekly-modifier / map-mods / curse OFF so we measure the honest baseline the DESIGNED
// constants were tuned for. It reuses the exact pure cores — no game rule is re-implemented, only
// the trivial orchestration (which floor to run next, when to bank) is inlined here.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  BAG_LIMIT, CLASSES, ENHANCE_TABLE, GEAR_SLOTS, GEM_BAG_LIMIT, GEM_SALVAGE_SHARDS, MAX_LEVEL, MAX_PLUS, PERKS, RARITIES, STAGES, STAGE_BY_ID,
  GEM_BOSS_CHANCE, GEM_DROP_CHANCE, JACKPOT_BASE_CHANCE, UNIQUE_BASE_CHANCE, UNIQUE_BOSS_CHANCE,
  ascendancyUnlocked, canPrestige, enhanceAttempt, enhanceCost, perkCost, prestigeReward,
  levelUpCost, levelUpsAffordable, lootBonus, newProfile, npcSellPrice, rollFloorLoot,
  salvageYield, stageUnlocked, applyPrestige, type ClassId, type GearItem, type GearSlot,
  type MaterialId, type PerkId, type Rarity, type RpgProfile, type Stage,
} from "./rpg";
import { effectiveBuild, powerScore, autoEquipBest, flaskHeal, FLASKS, FLASK_BY_ID } from "./rpg-build";
import { addGemXp, newSupportGem, SKILL_BY_ID, SUPPORT_BY_ID, SUPPORT_GEMS, type SupportGemInstance } from "./rpg-skills";
import { ascendanciesForClass, chosenAscendancy } from "./rpg-ascendancy";
import { genMonster, mapTier } from "./rpg-maps";
import { autoBattle, bundleTotal, armourDR, evadeChance, cappedRes, mitigatedHit, type Fighter, type Offense, type Defenses } from "./rpg-combat";
import {
  PASSIVE_CLUSTERS, PASSIVE_NODES, NODE_BY_ID, NODES_BY_CLUSTER, canAllocate,
  passivePointsTotal,
} from "./rpg-passives";

const isSkillGem = (g: { defId: string }) => !!SKILL_BY_ID[g.defId];

// ── deterministic RNG (mulberry32) — audits seed it; live play uses Math.random ────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GEM_XP_PER_FLOOR = 12; // mirror expeditions.ts
const SHOP_PRICES: Record<string, number> = { luongthuc: 15, thuoc: 40, bua: 250 };
const STARTING_COINS = 100;

// ── save state (so play can span many CLI calls) ────────────────────────────────────────────
interface Save { profile: RpgProfile; coins: number; runs: number; log: string[] }
const SAVE = process.env.SANDBOX_SAVE ??
  "/private/tmp/claude-501/-Users-firegroup-projects-discord-claude-bot/df86bf77-0d64-4eb1-aeae-dee27f42fad3/scratchpad/rpg-logs/sandbox-save.json";

function loadSave(): Save {
  if (!existsSync(SAVE)) { console.error("No character. Run:  bun run src/rpg-sandbox.ts new <chien|phap|cung>"); process.exit(1); }
  return JSON.parse(readFileSync(SAVE, "utf8")) as Save;
}
function writeSave(s: Save): void {
  mkdirSync(dirname(SAVE), { recursive: true });
  writeFileSync(SAVE, JSON.stringify(s, null, 1));
}

// ── formatting helpers ──────────────────────────────────────────────────────────────────────
const bar = (s: string) => console.log(`\n\x1b[1m\x1b[36m━━ ${s} ━━\x1b[0m`);
const row = (l: string, v: unknown) => console.log(`  ${l.padEnd(22)} ${v}`);
function itemStr(g: GearItem): string {
  const uni = g.uniqueId ? ` «${g.uniqueId}»` : "";
  return `${RARITIES[g.rarity].emoji}${g.plus ? `+${g.plus}` : ""} ${g.base}${uni} (ilvl${g.ilvl}, ${g.mods?.length ?? 0}mods)`;
}

function summarize(s: Save): void {
  const p = s.profile;
  const b = effectiveBuild(p);
  const dps = Math.round(bundleTotal(b.off.hit) * b.off.speed * (1 + b.off.crit * (b.off.critMulti - 1)));
  const deepest = Object.values(p.bestFloor).reduce((m, f) => Math.max(m, f), 0);
  const ptsTot = passivePointsTotal(p.level, p.prestigeLevel);
  bar(`${CLASSES[p.cls].emoji} ${CLASSES[p.cls].name}  Lv${p.level}  (prestige ${p.prestigeLevel})`);
  row("Power", powerScore(p));
  row("Life / ES", `${b.def.life} / ${b.def.energyShield}`);
  row("DPS (proxy)", dps);
  row("Armour / Evasion", `${b.def.armour} / ${b.def.evasion}`);
  row("Res f/c/l/ch", Object.values(b.def.res).map((r) => `${Math.round(r * 100)}%`).join(" "));
  row("Coins", s.coins);
  row("Deepest floor", `${deepest}  ${ascendancyUnlocked(p) ? "(asc unlocked)" : ""}${canPrestige(p) ? " (can prestige)" : ""}`);
  row("bestFloor/stage", JSON.stringify(p.bestFloor));
  row("Materials", JSON.stringify(p.materials));
  row("Passives", `${(p.passives ?? []).length} allocated / ${ptsTot} points`);
  row("Skill gem", `${p.skillGem?.defId} L${p.skillGem?.level}  supports:[${(p.supports ?? []).map((x) => x.defId).join(",")}]`);
  row("Ascendancy", p.ascendancy ?? "—");
  row("Gear", "");
  for (const slot of GEAR_SLOTS) {
    const g = p.gear[slot.id as GearSlot];
    console.log(`    ${slot.emoji} ${slot.name.padEnd(12)} ${g ? itemStr(g) : "—"}`);
  }
  row("Bag", `${p.bag.length}/${BAG_LIMIT}  ·  gemBag ${(p.gemBag ?? []).length}`);
}

// ── the faithful expedition runner (mirrors advanceExpedition; no mods/curse/weekly-modifier) ──
interface RunResult { floors: number; deathFloor: number; log: string[]; loot: { gear: GearItem[]; materials: Partial<Record<MaterialId, number>>; coins: number; gems: SupportGemInstance[] }; uniques: number; jackpots: number }

function runExpedition(p: RpgProfile, stageId: string, tier: number, stopAt: number | null, rng: () => number, verbose: boolean): RunResult | { error: string } {
  const stage = STAGE_BY_ID[stageId];
  if (!stage) return { error: `unknown stage ${stageId}` };
  if (!stageUnlocked(p, stage)) return { error: `${stage.name} chưa mở khoá (cần ${JSON.stringify(stage.unlockAt)})` };
  let rations = p.materials.luongthuc ?? 0;
  let potions = p.materials.thuoc ?? 0;
  if (rations < 1) return { error: "hết 🍖 lương thực — supply luongthuc <n>" };
  p.materials.luongthuc = 0; p.materials.thuoc = 0;

  const build = effectiveBuild(p);
  const maxHp = build.def.life;
  let hp = maxHp, floor = 0, deathFloor = 0;
  const lootMul = lootBonus(p) * mapTier(tier).loot;
  const loot = { gear: [] as GearItem[], materials: {} as Partial<Record<MaterialId, number>>, coins: 0, gems: [] as SupportGemInstance[] };
  let uniques = 0, jackpots = 0;
  const log: string[] = [];

  while (rations > 0 && (stopAt === null || floor < stopAt)) {
    const target = floor + 1;
    rations -= 1;
    const hero: Fighter = {
      name: "hero",
      off: build.off,
      def: { ...build.def, life: hp },
      fx: build.fx,
      // Mirror expeditions.ts: the mana gate and the bare-skill fallback are part of the
      // fight now, so a sandbox that omitted them would report damage nobody can afford.
      mana: build.mana.cost.full > 0 ? { max: build.mana.max, regen: build.mana.regen, cost: build.mana.cost } : undefined,
      basic: build.basicOff,
    };
    const monster = genMonster(stage, target, tier, rng, []);
    const result = autoBattle(hero, monster, rng);
    if (result.winner === "b") { deathFloor = target; if (verbose) log.push(`💀 F${target}: chết bởi ${monster.name} (đánh ${result.rounds} hiệp, cú đau nhất ${Math.round(result.aBiggest)})`); break; }
    floor = target; hp = result.aHpAfter;
    // gem xp
    const xp = GEM_XP_PER_FLOOR + Math.round(target * 1.5);
    if (p.skillGem) addGemXp(p.skillGem, xp);
    for (const sup of p.supports ?? []) addGemXp(sup, Math.round(xp * 0.6));
    // loot (uniqueMul=1, no modifier)
    const drops = rollFloorLoot(stage, target, rng, undefined, 1);
    for (const g of drops.gear) loot.gear.push(g);
    if (drops.gem) loot.gems.push(drops.gem.inst);
    if (drops.unique) uniques++;
    if (drops.jackpot) jackpots++;
    for (const [id, n] of Object.entries(drops.materials) as [MaterialId, number][]) {
      if (!n) continue;
      loot.materials[id] = (loot.materials[id] ?? 0) + (lootMul !== 1 ? Math.round(n * lootMul) : n);
    }
    if (drops.coins) loot.coins += Math.round(drops.coins * lootMul);
    p.bestFloor[stageId] = Math.max(p.bestFloor[stageId] ?? 0, target);
    p.bestFloorThisLife = Math.max(p.bestFloorThisLife ?? 0, target); // per-life prestige gate (mirrors expeditions.ts)
    // recover: flask heal then potion top-up
    const flaskGain = flaskHeal(p.flasks ?? [], maxHp);
    if (flaskGain > 0) hp = Math.min(maxHp, hp + flaskGain);
    if (hp < maxHp * 0.5 && potions > 0) { hp = Math.min(maxHp, hp + Math.round(maxHp * 0.4)); potions -= 1; }
    if (verbose && (drops.unique || drops.jackpot || target % 5 === 0)) log.push(`⚔️ F${target}: hạ ${monster.name} (❤️${hp}/${maxHp})${drops.unique ? ` 🟤${drops.unique.name}` : ""}${drops.jackpot ? " 🌟JACKPOT" : ""}`);
  }

  // bank loot (mirror bankLoot): materials add; gear → bag up to BAG_LIMIT else salvage to manh
  for (const [id, n] of Object.entries(loot.materials) as [MaterialId, number][]) if (n) p.materials[id] = (p.materials[id] ?? 0) + n;
  let salvaged = 0;
  for (const g of loot.gear) { if (p.bag.length < BAG_LIMIT) p.bag.push(g); else salvaged += salvageYield(g).manh; }
  // Dropped support gems bank into gemBag up to GEM_BAG_LIMIT; overflow auto-salvages (mirror bankLoot).
  for (const gem of loot.gems) { if ((p.gemBag ??= []).length < GEM_BAG_LIMIT) p.gemBag.push(gem); else salvaged += GEM_SALVAGE_SHARDS; }
  if (salvaged > 0) p.materials.manh = (p.materials.manh ?? 0) + salvaged;
  // refund unused fuel
  p.materials.luongthuc = (p.materials.luongthuc ?? 0) + rations;
  p.materials.thuoc = (p.materials.thuoc ?? 0) + potions;

  return { floors: floor, deathFloor, log, loot, uniques, jackpots };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT 1 — DROPS: sample rollFloorLoot heavily per stage and compare to the DESIGNED constants.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function auditDrops(nPerCell: number, seed: number): void {
  const rng = mulberry32(seed);
  bar(`DROP AUDIT — ${nPerCell.toLocaleString()} floors sampled per (stage × band)`);
  // Read the design targets off the engine constants themselves, so this line can never drift
  // from what the game actually rolls (the same anti-drift rule /help and the wiki follow).
  const dpc = (n: number) => `${(n * 100).toFixed(2)}%`;
  console.log(
    `  Designed: unique/floor ${dpc(UNIQUE_BASE_CHANCE)} · unique/boss ${dpc(UNIQUE_BOSS_CHANCE)}` +
      ` · jackpot/floor ${dpc(JACKPOT_BASE_CHANCE)}→${dpc(JACKPOT_BASE_CHANCE * 2)} (depth)` +
      ` · gem/floor ${dpc(GEM_DROP_CHANCE)} · gem/boss ${dpc(GEM_BOSS_CHANCE)}`,
  );
  console.log("  Bands are cleanly separated: NORMAL = only non-boss floors (skip multiples of bossEvery); BOSS = boss floors.\n");
  console.log("  stage            band   floors   gear%   uniq%    jack%    gem%    coins/f   rarity mix (N/M/R/E/L %)");
  for (const stage of STAGES) {
    for (const band of ["normal", "boss"] as const) {
      let gear = 0, uniq = 0, jack = 0, gem = 0, coin = 0;
      const rar = [0, 0, 0, 0, 0];
      let gearItems = 0;
      for (let i = 0; i < nPerCell; i++) {
        // NORMAL: floors 3..24 that are NOT boss floors. BOSS: multiples of bossEvery.
        let floor: number;
        if (band === "boss") floor = stage.bossEvery * (1 + (i % 4));
        else { floor = 3 + (i % 22); if (floor % stage.bossEvery === 0) floor += 1; }
        const d = rollFloorLoot(stage, floor, rng, undefined, 1);
        if (d.gear.length) gear++;
        for (const g of d.gear) { gearItems++; rar[g.rarity]++; }
        if (d.unique) uniq++;
        if (d.jackpot) jack++;
        if (d.gem) gem++;
        coin += d.coins;
      }
      const pc = (n: number) => ((100 * n) / nPerCell).toFixed(2);
      const rmix = rar.map((n) => ((100 * n) / Math.max(1, gearItems)).toFixed(0)).join("/");
      console.log(`  ${stage.id.padEnd(9)} ${(stage.name.slice(0, 6)).padEnd(6)} ${band.padEnd(6)} ${String(nPerCell).padStart(6)}  ${pc(gear).padStart(6)} ${pc(uniq).padStart(7)} ${pc(jack).padStart(7)} ${pc(gem).padStart(7)}  ${String(Math.round(coin / nPerCell)).padStart(7)}   ${rmix}`);
    }
  }
  console.log(
    `\n  Reads: normal uniq% ↔ ${dpc(UNIQUE_BASE_CHANCE)} · boss uniq% ↔ ${dpc(UNIQUE_BOSS_CHANCE)}` +
      ` · normal jack% ↔ ${dpc(JACKPOT_BASE_CHANCE)}–${dpc(JACKPOT_BASE_CHANCE * 2)} (depth)` +
      ` · gem% ↔ ${dpc(GEM_DROP_CHANCE)}/${dpc(GEM_BOSS_CHANCE)}.`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT 2 — PASSIVES: point economy, per-node build impact on a reference hero, and dead-node scan.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function refHero(cls: ClassId, level: number): RpgProfile {
  const p = newProfile(cls, 0, mulberry32(99));
  p.level = level;
  // give it a mid-game weapon so % mods have a base to scale (else atkPct on 0 = 0)
  return p;
}

function metricsOf(p: RpgProfile) {
  const b = effectiveBuild(p);
  const dps = bundleTotal(b.off.hit) * b.off.speed * (1 + b.off.crit * (b.off.critMulti - 1));
  return { power: b.power, life: b.def.life, es: b.def.energyShield, armour: b.def.armour, evasion: b.def.evasion, dps, crit: b.off.crit, critMulti: b.off.critMulti, speed: b.off.speed };
}

function auditPassives(): void {
  bar("PASSIVE AUDIT — point economy");
  console.log("  passivePointsTotal(level, prestige) = max(0, level-1) + prestige*3");
  for (const lv of [1, 10, 20, 30, 40, 50]) console.log(`    Lv${String(lv).padStart(2)}  → ${passivePointsTotal(lv, 0)} pts (prestige 0)   ${passivePointsTotal(lv, 2)} pts (prestige 2)`);
  console.log(`  Total nodes in tree: ${PASSIVE_NODES.length}  (a Lv50/p0 hero can afford ${passivePointsTotal(50, 0)} of them)`);

  bar("PASSIVE AUDIT — per-node build impact (reference: fresh phap & chien, Lv40)");
  console.log("  For each node, allocate ONLY that node (+ its prereq chain, deltas attributed to the leaf) on a");
  console.log("  reference hero and measure the change vs bare build. A node with ZERO effect on every metric is DEAD.\n");
  const dead: string[] = [];
  const weak: string[] = [];
  for (const cls of ["chien", "phap"] as ClassId[]) {
    console.log(`  ── ${CLASSES[cls].name} Lv40 ──   node                         ΔPower  Δlife  Δdps   Δarm  Δeva  Δcrit`);
    for (const node of PASSIVE_NODES) {
      const base = refHero(cls, 40);
      // allocate prereq chain then the node
      const chain: string[] = [];
      let cur: string | undefined = node.id;
      while (cur) { chain.unshift(cur); cur = NODE_BY_ID[cur]?.requires; }
      base.passives = chain;
      const b1 = metricsOf(base);
      // isolate THIS node vs its prereq-only chain (so shared prereqs aren't double-blamed)
      const prereqOnly = chain.slice(0, -1);
      base.passives = prereqOnly;
      const bp = metricsOf(base);
      const nodeDelta = { power: b1.power - bp.power, life: b1.life - bp.life, dps: b1.dps - bp.dps, arm: b1.armour - bp.armour, eva: b1.evasion - bp.evasion, crit: b1.crit - bp.crit };
      const allZero = Object.values(nodeDelta).every((v) => Math.abs(v) < 1e-6);
      const tag = node.keystone ? "★K" : node.notable ? "◆N" : "  ";
      console.log(`  ${tag} ${node.id.padEnd(12)} ${node.name.slice(0, 16).padEnd(16)} ${fmt(nodeDelta.power)} ${fmt(nodeDelta.life)} ${fmt(nodeDelta.dps)} ${fmt(nodeDelta.arm)} ${fmt(nodeDelta.eva)} ${nodeDelta.crit ? nodeDelta.crit.toFixed(3) : "  ·  "}`);
      if (cls === "phap") { if (allZero) dead.push(node.id); else if (Math.abs(nodeDelta.power) < 1 && Math.abs(nodeDelta.dps) < 1 && Math.abs(nodeDelta.life) < 1) weak.push(node.id); }
    }
    console.log("");
  }
  bar("PASSIVE AUDIT — verdict");
  row("Dead nodes (phap, 0 effect)", dead.length ? dead.join(", ") : "none ✅");
  row("Near-zero (phap)", weak.length ? weak.join(", ") : "none");
  console.log("  NOTE: a node is 'dead' for a class only if its stat is irrelevant to that class's damage type");
  console.log("  (e.g. spell% on a pure-attack hero). Cross-check the same node on the class that USES it.");
}
function fmt(n: number): string {
  const s = n === 0 ? "·" : (n > 0 ? "+" : "") + (Number.isInteger(n) ? n : n.toFixed(1));
  return s.padStart(6);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AUTOPLAY — an optimal-ish bot loops the game and reports the progression curve. This is the
// "play it end to end" objective run: it buys fuel, dives the deepest unlocked stage, banks, levels,
// spends passives greedily down its best cluster, auto-equips, and enhances — many sessions.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function greedyPassive(p: RpgProfile): boolean {
  let pts = passivePointsTotal(p.level, p.prestigeLevel) - (p.passives ?? []).length;
  if (pts < 1) return false;
  // priority clusters by class
  const pref: Record<ClassId, string[]> = {
    chien: ["cuongchien", "thechat", "giaptru", "satthu"],
    phap: ["phaythuat", "nguyento", "satthu", "thechat"],
    cung: ["satthu", "cuongchien", "bongma", "thechat"],
  };
  let allocated = false;
  for (const cl of pref[p.cls]) {
    for (const node of NODES_BY_CLUSTER[cl] ?? []) {
      if (pts < 1) return allocated;
      if ((p.passives ?? []).includes(node.id)) continue;
      const ok = canAllocate(p.passives ?? [], node.id, pts);
      if (ok.ok) { (p.passives ??= []).push(node.id); pts--; allocated = true; }
    }
  }
  return allocated;
}

function deepestUnlocked(p: RpgProfile): Stage {
  let best = STAGES[0]!;
  for (const s of STAGES) if (stageUnlocked(p, s)) best = s;
  return best;
}

function autoplay(cls: ClassId, sessions: number, seed: number): void {
  const rng = mulberry32(seed);
  const p = newProfile(cls, 0, rng);
  let coins = STARTING_COINS;
  bar(`AUTOPLAY — ${CLASSES[cls].name}, ${sessions} sessions, seed ${seed}`);
  console.log("  sess  Lv  pts→used  power   life    dps    deepest  coins   uniq  jack  event");
  let totUniq = 0, totJack = 0, deaths = 0;
  for (let s = 1; s <= sessions; s++) {
    // shop: buy as much fuel as coins allow (keep it simple: spend ~half coins on luongthuc, some thuoc)
    const buyFood = Math.min(60, Math.floor((coins * 0.6) / SHOP_PRICES.luongthuc));
    if (buyFood > 0) { coins -= buyFood * SHOP_PRICES.luongthuc; p.materials.luongthuc = (p.materials.luongthuc ?? 0) + buyFood; }
    const buyPot = Math.min(10, Math.floor((coins * 0.3) / SHOP_PRICES.thuoc));
    if (buyPot > 0) { coins -= buyPot * SHOP_PRICES.thuoc; p.materials.thuoc = (p.materials.thuoc ?? 0) + buyPot; }
    if ((p.materials.luongthuc ?? 0) < 1) { p.materials.luongthuc = 5; } // never fully stuck (mirror early trickle)

    const stage = deepestUnlocked(p);
    const before = { lv: p.level, pts: (p.passives ?? []).length };
    const r = runExpedition(p, stage.id, 1, null, rng, false);
    if ("error" in r) { console.log(`  ${String(s).padStart(4)}  err: ${r.error}`); continue; }
    coins += r.loot.coins;
    totUniq += r.uniques; totJack += r.jackpots;
    if (r.deathFloor) deaths++;

    // post-run housekeeping (mirror a smart player): level up, auto-equip, spend passives, vendor junk
    while (levelUpsAffordable(p) > 0) {
      const cost = levelUpCost(p.level);
      p.materials.tinhchat = (p.materials.tinhchat ?? 0) - cost.tinhchat;
      p.level++;
    }
    const eq = autoEquipBest(p); p.gear = eq.gear; p.bag = eq.bag;
    greedyPassive(p);
    // vendor everything ≤ Rare left in bag for coins, keep Epic+
    const keep: GearItem[] = []; let sold = 0;
    for (const g of p.bag) { if (g.rarity <= 2 && !g.uniqueId) { coins += npcSellPrice(g); sold++; } else keep.push(g); }
    p.bag = keep;

    const b = effectiveBuild(p);
    const dps = Math.round(bundleTotal(b.off.hit) * b.off.speed * (1 + b.off.crit * (b.off.critMulti - 1)));
    const deepest = Object.values(p.bestFloor).reduce((m, f) => Math.max(m, f), 0);
    const ev = r.deathFloor ? `💀F${r.deathFloor}` : `cleared F${r.floors}`;
    const usedPts = (p.passives ?? []).length;
    if (s <= 12 || s % 5 === 0 || s === sessions) {
      console.log(`  ${String(s).padStart(4)}  ${String(p.level).padStart(2)}  ${String(before.pts).padStart(3)}→${String(usedPts).padStart(3)}  ${String(powerScore(p)).padStart(6)}  ${String(b.def.life).padStart(5)}  ${String(dps).padStart(5)}  ${(stage.id.slice(0, 4) + " F" + deepest).padStart(8)}  ${String(coins).padStart(6)}  ${String(totUniq).padStart(4)}  ${String(totJack).padStart(4)}  ${ev}`);
    }
  }
  bar("AUTOPLAY — summary");
  row("Final level", `${p.level}${p.level >= MAX_LEVEL ? " (MAX)" : ""}`);
  row("Final power", powerScore(p));
  row("Deepest floor", Object.values(p.bestFloor).reduce((m, f) => Math.max(m, f), 0));
  row("bestFloor/stage", JSON.stringify(p.bestFloor));
  row("Passives used", `${(p.passives ?? []).length} / ${passivePointsTotal(p.level, p.prestigeLevel)}`);
  row("Deaths", `${deaths}/${sessions}`);
  row("Uniques found", totUniq);
  row("Jackpots found", totJack);
  row("Coins", coins);
  row("Ascendancy unlocked", ascendancyUnlocked(p));
  row("Can prestige", canPrestige(p));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT 3 — ENHANCE (đập đồ): hammer enhanceAttempt at each +level vs ENHANCE_TABLE, then simulate
// the real grind of pushing ONE item +0→+12 (attempts + shards + breaks) with and without charms.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function auditEnhance(nPer: number, seed: number): void {
  const rng = mulberry32(seed);
  bar(`ENHANCE AUDIT — ${nPer.toLocaleString()} attempts per +level (no charm)`);
  console.log("  +lvl  designed-up  observed-up  onFail   down%   break%   stay%");
  for (let plus = 0; plus < MAX_PLUS; plus++) {
    let up = 0, down = 0, brk = 0, stay = 0;
    for (let i = 0; i < nPer; i++) {
      const r = enhanceAttempt(plus, false, rng);
      if (r.result === "up") up++; else if (r.result === "down") down++; else if (r.result === "break") brk++; else stay++;
    }
    const od = ENHANCE_TABLE[plus]!;
    const pc = (n: number) => ((100 * n) / nPer).toFixed(1).padStart(5);
    console.log(`  +${String(plus).padStart(2)}   ${String((od.up * 100).toFixed(0) + "%").padStart(9)}   ${pc(up)}%      ${od.onFail.padEnd(6)}  ${pc(down)}  ${pc(brk)}  ${pc(stay)}`);
  }

  // Grind simulation: how much does it cost to get ONE item to +12?
  bar("ENHANCE GRIND — Monte Carlo: push one item +0→+12 (10k trials each)");
  for (const charm of [false, true]) {
    let totAttempts = 0, totShards = 0, totCoins = 0, totBreaks = 0, reached = 0;
    const TRIALS = 10000;
    for (let t = 0; t < TRIALS; t++) {
      let plus = 0, attempts = 0, breaks = 0, shards = 0, coins = 0;
      while (plus < MAX_PLUS && attempts < 100000) {
        const c = enhanceCost(plus); shards += c.manh; coins += c.coins; attempts++;
        const r = enhanceAttempt(plus, charm, rng);
        if (r.result === "break") { breaks++; plus = 0; } // item vỡ → start over from a fresh +0
        else plus = r.newPlus;
      }
      totAttempts += attempts; totShards += shards; totCoins += coins; totBreaks += breaks; if (plus >= MAX_PLUS) reached++;
    }
    console.log(`  charm=${charm ? "YES (1 bùa/fail, 250🪙 each)" : "no "}  → avg ${Math.round(totAttempts / TRIALS)} attempts · ${Math.round(totShards / TRIALS)}🔩 · ${Math.round(totCoins / TRIALS)}🪙 · ${(totBreaks / TRIALS).toFixed(1)} breaks/item`);
  }
  console.log("  (a broken item resets to +0 — the classic đập-đồ heartbreak; charm converts every fail to a harmless stay)");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT 4 — DAMAGE ENGINE: prove each mitigation lever responds, then break down a real fight.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function auditDamage(): void {
  bar("DAMAGE ENGINE — armour → phys damage reduction (DR = armour/(armour+120), cap 85%)");
  console.log("  armour:   " + [0, 60, 120, 300, 600, 1200, 3000, 8000].map((a) => String(a).padStart(6)).join(""));
  console.log("  DR%:      " + [0, 60, 120, 300, 600, 1200, 3000, 8000].map((a) => (`${(armourDR(a) * 100).toFixed(0)}%`).padStart(6)).join(""));
  bar("DAMAGE ENGINE — evasion → dodge chance (evasion/(evasion+55), cap 60%)");
  console.log("  evasion:  " + [0, 30, 55, 110, 220, 440, 900].map((a) => String(a).padStart(6)).join(""));
  console.log("  dodge%:   " + [0, 30, 55, 110, 220, 440, 900].map((a) => (`${(evadeChance(a) * 100).toFixed(0)}%`).padStart(6)).join(""));
  bar("DAMAGE ENGINE — resistance & penetration (elemental, cap 75%)");
  for (const res of [0, 0.25, 0.5, 0.75, 0.9]) for (const pen of [0, 0.25]) {
    console.log(`  res ${String(Math.round(res * 100)).padStart(3)}% (cap→${Math.round(cappedRes(res) * 100)}%) − pen ${Math.round(pen * 100)}%  → takes ${Math.round((1 - (cappedRes(res) - pen)) * 100)}% of fire damage`);
  }

  bar("DAMAGE ENGINE — single-lever response (100 phys/fire hit vs a fixed defender)");
  const baseOff: Offense = { hit: { phys: 100, fire: 100, cold: 0, light: 0, chaos: 0 }, crit: 0, critMulti: 1.5, speed: 1, ailment: {} };
  const baseDef: Defenses = { life: 9999, energyShield: 0, armour: 0, evasion: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 } };
  const avg100 = (off: Offense, def: Defenses) => { let s = 0; for (let i = 0; i < 20000; i++) s += mitigatedHit(off, def, mulberry32(i + 1)).dmg; return Math.round(s / 20000); };
  console.log(`  baseline (0 armour/res):                 ${avg100(baseOff, baseDef)} dmg`);
  console.log(`  +600 armour (phys −${Math.round(armourDR(600) * 100)}%):               ${avg100(baseOff, { ...baseDef, armour: 600 })} dmg`);
  console.log(`  +50% fire res:                           ${avg100(baseOff, { ...baseDef, res: { ...baseDef.res, fire: 0.5 } })} dmg`);
  console.log(`  attacker +25% fire pen vs 50% res:       ${avg100({ ...baseOff, pen: { fire: 0.25 } }, { ...baseDef, res: { ...baseDef.res, fire: 0.5 } })} dmg`);
  console.log(`  attacker 100% crit (×1.5):               ${avg100({ ...baseOff, crit: 1 }, baseDef)} dmg`);
  console.log(`  attacker +30% moreMulti:                 ${avg100({ ...baseOff, moreMulti: 0.3 }, baseDef)} dmg`);
  console.log(`  defender moreTaken +18% (Berserker):     ${avg100(baseOff, { ...baseDef, moreTaken: 0.18 })} dmg`);
  console.log("  (each lever moves the number the expected direction ⇒ mitigation/crit/pen/more pipeline is wired)");

  bar("DAMAGE ENGINE — a real fight: Lv30 Sorceress vs rungma floor-10 boss");
  const p = newProfile("phap", 0, mulberry32(3)); p.level = 30;
  const b = effectiveBuild(p);
  const hero: Fighter = {
    name: "Sorc L30",
    off: b.off,
    def: b.def,
    fx: b.fx,
    mana: b.mana.cost.full > 0 ? { max: b.mana.max, regen: b.mana.regen, cost: b.mana.cost } : undefined,
    basic: b.basicOff,
  };
  const stage = STAGE_BY_ID["rungma"]!;
  const boss = genMonster(stage, 10, 1, mulberry32(5), []);
  console.log(`  hero:  ${b.def.life} life +${b.def.energyShield} ES · hit ${Math.round(bundleTotal(b.off.hit))} · crit ${Math.round(b.off.crit * 100)}%/${b.off.critMulti}× · speed ${b.off.speed.toFixed(2)}`);
  console.log(`  boss:  ${boss.def.life} life +${boss.def.energyShield} ES · armour ${boss.def.armour} · hit ${Math.round(bundleTotal(boss.off.hit))} · res ${JSON.stringify(Object.fromEntries(Object.entries(boss.def.res).map(([k, v]) => [k, Math.round((v as number) * 100)])))}`);
  let win = 0; const rounds: number[] = [];
  for (let i = 0; i < 2000; i++) { const r = autoBattle({ ...hero, def: { ...hero.def } }, { ...boss, def: { ...boss.def } }, mulberry32(i + 100)); if (r.winner === "a") win++; rounds.push(r.rounds); }
  console.log(`  → hero wins ${((100 * win) / 2000).toFixed(1)}% of 2000 sims, avg ${Math.round(rounds.reduce((a, c) => a + c, 0) / rounds.length)} rounds`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function flag(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
}

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case "new": {
    const cls = (arg ?? "phap") as ClassId;
    if (!CLASSES[cls]) { console.error("class must be chien|phap|cung"); process.exit(1); }
    const seed = flag("seed", Math.floor(Math.random() * 1e9));
    const profile = newProfile(cls, 0, mulberry32(seed));
    const save: Save = { profile, coins: STARTING_COINS, runs: 0, log: [] };
    writeSave(save);
    console.log(`Created ${CLASSES[cls].name} (seed ${seed}).`);
    summarize(save);
    break;
  }
  case "status": case "hero": { summarize(loadSave()); break; }
  case "supply": {
    const s = loadSave();
    const item = arg as "luongthuc" | "thuoc" | "bua";
    const qty = Number(process.argv[4] ?? 1);
    if (!SHOP_PRICES[item]) { console.error("item must be luongthuc|thuoc|bua"); process.exit(1); }
    const cost = SHOP_PRICES[item] * qty;
    if (cost > s.coins) { console.error(`cần ${cost} coin, có ${s.coins}`); process.exit(1); }
    s.coins -= cost; s.profile.materials[item] = (s.profile.materials[item] ?? 0) + qty;
    writeSave(s);
    console.log(`Mua ${qty}× ${item} (−${cost} coin). Còn ${s.coins} coin, ${item}=${s.profile.materials[item]}.`);
    break;
  }
  case "dispatch": case "map": {
    const s = loadSave();
    const stageId = arg ?? "rungma";
    const tier = flag("tier", 1);
    const stopAt = process.argv.includes("--stop") ? flag("stop", 0) || null : null;
    const r = runExpedition(s.profile, stageId, tier, stopAt, Math.random, true);
    if ("error" in r) { console.error(r.error); process.exit(1); }
    s.coins += r.loot.coins; s.runs++;
    writeSave(s);
    bar(`EXPEDITION ${STAGE_BY_ID[stageId]!.name} T${tier}`);
    for (const l of r.log) console.log("  " + l);
    row("Floors cleared", r.floors);
    row("Died on floor", r.deathFloor || "—");
    row("Gear looted", r.loot.gear.length);
    row("Uniques / jackpots", `${r.uniques} / ${r.jackpots}`);
    row("💠 Support gems dropped", `${r.loot.gems.length}${r.loot.gems.length ? ` → gemBag (link at /skills): ${r.loot.gems.map((g) => g.defId).join(", ")}` : ""}`);
    row("Coins gained", r.loot.coins);
    row("Materials", JSON.stringify(r.loot.materials));
    console.log("\n  (auto-equip / levelup / passive not applied — do them as separate actions)");
    break;
  }
  case "levelup": {
    const s = loadSave(); const p = s.profile; let n = 0;
    while (levelUpsAffordable(p) > 0) { const c = levelUpCost(p.level); p.materials.tinhchat = (p.materials.tinhchat ?? 0) - c.tinhchat; p.level++; n++; }
    writeSave(s);
    console.log(`Lên ${n} cấp → Lv${p.level}. tinhchat còn ${p.materials.tinhchat ?? 0}. Điểm passive: ${passivePointsTotal(p.level, p.prestigeLevel) - (p.passives ?? []).length} chưa dùng.`);
    break;
  }
  case "passives": {
    const s = loadSave(); const p = s.profile;
    const pts = passivePointsTotal(p.level, p.prestigeLevel) - (p.passives ?? []).length;
    bar(`PASSIVE TREE — ${pts} điểm chưa dùng`);
    for (const c of PASSIVE_CLUSTERS) {
      console.log(`  ${c.emoji} ${c.name} (${c.id})`);
      for (const n of NODES_BY_CLUSTER[c.id] ?? []) {
        const has = (p.passives ?? []).includes(n.id);
        const can = canAllocate(p.passives ?? [], n.id, pts);
        const mark = has ? "✅" : can.ok ? "🟢" : "🔒";
        const tag = n.keystone ? "★" : n.notable ? "◆" : " ";
        console.log(`    ${mark}${tag} ${n.id.padEnd(12)} ${n.name}${!has && !can.ok ? `  (${can.reason})` : ""}`);
      }
    }
    break;
  }
  case "passive": {
    const s = loadSave(); const p = s.profile;
    const pts = passivePointsTotal(p.level, p.prestigeLevel) - (p.passives ?? []).length;
    const ok = canAllocate(p.passives ?? [], arg!, pts);
    if (!ok.ok) { console.error(ok.reason); process.exit(1); }
    (p.passives ??= []).push(arg!);
    writeSave(s);
    console.log(`Học "${NODE_BY_ID[arg!]!.name}". Còn ${pts - 1} điểm.`);
    summarize(s);
    break;
  }
  case "respec": {
    const s = loadSave(); const refunded = (s.profile.passives ?? []).length; s.profile.passives = [];
    writeSave(s); console.log(`Respec: hoàn ${refunded} điểm.`);
    break;
  }
  case "auto-equip": {
    const s = loadSave(); const eq = autoEquipBest(s.profile); s.profile.gear = eq.gear; s.profile.bag = eq.bag;
    writeSave(s); console.log(`Đổi ${eq.changed.length} slot: ${eq.changed.join(", ") || "none"}.`); summarize(s);
    break;
  }
  case "inventory": {
    const s = loadSave();
    bar(`INVENTORY (${s.profile.bag.length}/${BAG_LIMIT})`);
    s.profile.bag.slice().sort((a, b) => b.rarity - a.rarity).forEach((g, i) => console.log(`  ${String(i).padStart(2)} ${itemStr(g)}`));
    break;
  }
  case "enhance": {
    const s = loadSave(); const p = s.profile; const slot = arg as GearSlot;
    const g = p.gear[slot];
    if (!g) { console.error(`no gear in ${slot}`); process.exit(1); }
    if (g.plus >= MAX_PLUS) { console.error("đã max +12"); process.exit(1); }
    const cost = enhanceCost(g.plus);
    if ((p.materials.manh ?? 0) < cost.manh || s.coins < cost.coins) { console.error(`cần ${cost.manh}🔩 + ${cost.coins}🪙`); process.exit(1); }
    const hasCharm = process.argv.includes("--charm") && (p.materials.bua ?? 0) > 0;
    p.materials.manh = (p.materials.manh ?? 0) - cost.manh; s.coins -= cost.coins;
    const res = enhanceAttempt(g.plus, hasCharm, Math.random);
    if (res.charmConsumed) p.materials.bua = (p.materials.bua ?? 0) - 1;
    if (res.result === "break") delete p.gear[slot]; else g.plus = res.newPlus;
    writeSave(s);
    console.log(`Đập ${slot}: ${res.result.toUpperCase()} → +${res.newPlus}${res.result === "break" ? " (VỠ, mất đồ)" : ""}. -${cost.manh}🔩 -${cost.coins}🪙${res.charmConsumed ? " (dùng bùa)" : ""}`);
    break;
  }
  case "salvage": {
    const s = loadSave(); const p = s.profile; const maxR = Number(arg ?? 1) as Rarity;
    let manh = 0, n = 0; const keep: GearItem[] = [];
    for (const g of p.bag) { if (g.rarity <= maxR && !g.uniqueId) { manh += salvageYield(g).manh; n++; } else keep.push(g); }
    p.bag = keep; p.materials.manh = (p.materials.manh ?? 0) + manh;
    writeSave(s); console.log(`Salvage ${n} món ≤ ${RARITIES[maxR].name} → +${manh}🔩.`);
    break;
  }
  case "vendor": {
    const s = loadSave(); const p = s.profile; const maxR = Number(arg ?? 1) as Rarity;
    let coin = 0, n = 0; const keep: GearItem[] = [];
    for (const g of p.bag) { if (g.rarity <= maxR && !g.uniqueId) { coin += npcSellPrice(g); n++; } else keep.push(g); }
    p.bag = keep; s.coins += coin;
    writeSave(s); console.log(`Bán ${n} món ≤ ${RARITIES[maxR].name} → +${coin}🪙. Coins=${s.coins}.`);
    break;
  }
  case "prestige": {
    const s = loadSave(); const p = s.profile;
    if (!canPrestige(p)) { console.error("Chưa đủ điều kiện Prestige — cần đạt floor 20 kể từ lần prestige gần nhất (HOẶC lên cấp tối đa 50)."); process.exit(1); }
    s.profile = applyPrestige(p, powerScore(p), Math.random);
    writeSave(s); console.log(`Prestige → level ${s.profile.prestigeLevel}. coNgoc=${s.profile.coNgoc}.`); summarize(s);
    break;
  }
  case "skills": {
    const s = loadSave(); const p = s.profile;
    const sk = SKILL_BY_ID[p.skillGem?.defId ?? ""];
    bar("SKILL GEMS");
    row("Main skill", `${sk?.name ?? "—"} (${p.skillGem?.defId}) L${p.skillGem?.level} · ${sk?.sockets ?? 0} sockets`);
    row("Linked supports", `${(p.supports ?? []).length}/${sk?.sockets ?? 0}: ${(p.supports ?? []).map((x) => SUPPORT_BY_ID[x.defId]?.name ?? x.defId).join(", ") || "none"}`);
    console.log("  gemBag (dropped, unlinked):");
    for (const g of p.gemBag ?? []) console.log(`    ${isSkillGem(g) ? "🔵skill" : "💠supp "} ${g.defId.padEnd(14)} ${SKILL_BY_ID[g.defId]?.name ?? SUPPORT_BY_ID[g.defId]?.name ?? ""}`);
    console.log("  (link one:  link <supportId> [--give to synth for testing])   all: " + SUPPORT_GEMS.map((x) => x.id).join(", "));
    break;
  }
  case "link": {
    const s = loadSave(); const p = s.profile;
    const sk = SKILL_BY_ID[p.skillGem?.defId ?? ""];
    if (!sk) { console.error("chưa có skill gem chính"); process.exit(1); }
    if ((p.supports ?? []).length >= sk.sockets) { console.error(`hết socket (${sk.sockets})`); process.exit(1); }
    const bag = p.gemBag ?? [];
    let idx = bag.findIndex((g) => g.defId === arg && !isSkillGem(g));
    if (idx < 0) {
      if (process.argv.includes("--give") && SUPPORT_BY_ID[arg!]) { bag.push(newSupportGem(arg!)); idx = bag.length - 1; }
      else { console.error(`không có support ${arg} trong gemBag (thêm --give để synth khi test)`); process.exit(1); }
    }
    const [chosen] = bag.splice(idx, 1);
    (p.supports ??= []).push(chosen as (typeof p.supports)[number]);
    p.gemBag = bag;
    writeSave(s);
    console.log(`Gắn ${SUPPORT_BY_ID[arg!]?.name ?? arg}. Supports: [${p.supports.map((x) => x.defId).join(", ")}]`);
    summarize(s);
    break;
  }
  case "unlink": {
    const s = loadSave(); const p = s.profile; const slot = Number(arg ?? 0);
    const removed = (p.supports ?? []).splice(slot, 1)[0];
    if (removed) (p.gemBag ??= []).push(removed);
    writeSave(s); console.log(`Tháo ${removed?.defId ?? "—"}.`);
    break;
  }
  case "ascendancy": {
    const s = loadSave(); const p = s.profile;
    if (!arg) {
      bar(`ASCENDANCY (${ascendancyUnlocked(p) ? "unlocked" : "LOCKED — cần floor 15 / level 20"})`);
      for (const a of ascendanciesForClass(p.cls)) {
        console.log(`  ${a.emoji} ${a.id.padEnd(14)} ${a.name}`);
        console.log(`     ${a.blurb}`);
        console.log(`     🔑 ${a.keystoneName} — ${a.keystoneText}`);
      }
      break;
    }
    if (!ascendancyUnlocked(p)) { console.error("chưa mở ascendancy (cần floor 15 / level 20)"); process.exit(1); }
    const def = chosenAscendancy(p.cls, arg);
    if (!def) { console.error(`ascendancy ${arg} không hợp lệ cho ${p.cls}`); process.exit(1); }
    p.ascendancy = arg;
    writeSave(s); console.log(`Chọn ascendancy: ${def.name}.`); summarize(s);
    break;
  }
  case "flask": {
    const s = loadSave(); const p = s.profile;
    if (!arg) { bar("FLASKS"); for (const f of FLASKS) console.log(`  ${f.id.padEnd(14)} ${f.name} — ${f.blurb}`); break; }
    if (!FLASK_BY_ID[arg]) { console.error("flask không tồn tại"); process.exit(1); }
    (p.flasks ??= []).push({ defId: arg });
    writeSave(s); console.log(`Mang ${FLASK_BY_ID[arg].name}. flasks: [${p.flasks.map((f) => f.defId).join(", ")}]`);
    break;
  }
  case "equip": {
    const s = loadSave(); const p = s.profile; const i = Number(arg);
    const item = p.bag[i]; if (!item) { console.error("bag index sai (xem inventory)"); process.exit(1); }
    const slot = item.slot; const prev = p.gear[slot];
    p.gear[slot] = item; p.bag.splice(i, 1); if (prev) p.bag.push(prev);
    writeSave(s); console.log(`Mặc ${itemStr(item)} vào ${slot}.`); summarize(s);
    break;
  }
  case "perk": {
    const s = loadSave(); const p = s.profile; const id = arg as PerkId;
    if (!PERKS[id]) { console.error("perk phải atk|hp|loot"); process.exit(1); }
    const lvl = p.perks?.[id] ?? 0;
    if (lvl >= PERKS[id].maxLevel) { console.error("perk đã max"); process.exit(1); }
    const cost = perkCost(id, lvl);
    if ((p.coNgoc ?? 0) < cost) { console.error(`cần ${cost} coNgoc, có ${p.coNgoc ?? 0}`); process.exit(1); }
    p.coNgoc = (p.coNgoc ?? 0) - cost; (p.perks ??= {})[id] = lvl + 1;
    writeSave(s); console.log(`Perk ${PERKS[id].name} → L${lvl + 1} (−${cost} coNgoc). prestigeReward hiện tại: ${prestigeReward(powerScore(p))}`); summarize(s);
    break;
  }
  case "give": {
    const s = loadSave(); const p = s.profile; const what = arg; const qty = Number(process.argv[4] ?? 1);
    if (what === "coins") s.coins += qty;
    else p.materials[what as MaterialId] = (p.materials[what as MaterialId] ?? 0) + qty;
    writeSave(s); console.log(`(debug) +${qty} ${what}. coins=${s.coins} materials=${JSON.stringify(p.materials)}`);
    break;
  }
  case "audit-drops": auditDrops(flag("n", 200000), flag("seed", 12345)); break;
  case "audit-passives": auditPassives(); break;
  case "audit-enhance": auditEnhance(flag("n", 200000), flag("seed", 999)); break;
  case "audit-damage": auditDamage(); break;
  case "autoplay": autoplay((arg ?? "phap") as ClassId, flag("sessions", 50), flag("seed", 7)); break;
  default:
    console.log(`RPG sandbox — actions:
  new <chien|phap|cung> [--seed N]     create character
  status                                show hero sheet
  supply <luongthuc|thuoc|bua> <qty>    buy consumables
  dispatch <stageId> [--tier N] [--stop N]   run an expedition
  levelup                               spend essence to level up
  passives                              list the passive tree
  passive <nodeId>                      allocate a node
  respec                                clear passives
  auto-equip | inventory | equip <i>    gear
  enhance <slot> [--charm]              gamble-enhance equipped gear
  salvage <rarity> | vendor <rarity>    clear the bag
  skills | link <sup> [--give] | unlink <slot>   skill + support gems
  ascendancy [id] | flask [id] | perk <atk|hp|loot>   build levers
  prestige                              reset for coNgoc (trùng sinh)
  give <material|coins> <qty>           (debug) inject resources
  ── audits (no save) ──
  audit-drops [--n 200000] [--seed]     drop-rate vs designed
  audit-passives                        point economy + dead-node scan
  audit-enhance [--n]                   đập-đồ odds vs ENHANCE_TABLE + grind cost
  audit-damage                          mitigation / crit / pen / more pipeline probe
  autoplay <class> [--sessions N] [--seed S]   bot plays end-to-end
  stages: ${STAGES.map((s) => s.id).join(", ")}`);
}
