// RPG balance report — turns the raw telemetry journal (src/rpg-telemetry.ts) into the
// tuning answers. Run:  bun run rpg:stats  [--guild <id>] [--since YYYY-MM-DD] [--json]
//
// Reads every guild's rpg-telemetry-*.jsonl (or one guild), then prints difficulty,
// drops, enhance odds, currency flow, progression, passive pick-rates, build power, and
// PvP — each an empirical rate the design constants can be tuned against. On production:
//   fly ssh -C "cd /app && bun run rpg:stats"
//
// Pure read-only: it never writes, never touches game state.

import { readAllTelemetry, type RpgEvent, type RpgEventKind } from "./rpg-telemetry";
import { ASCENDANCY_FLOOR, CLASSES, ENHANCE_TABLE, MAX_LEVEL, PRESTIGE_FLOOR, RARITIES, STAGE_BY_ID } from "./rpg";
import { NODE_BY_ID, PASSIVE_NODES } from "./rpg-passives";
import { ATLAS_NODES } from "./rpg-atlas";

// Designed drop chances mirror the private consts in rpg.ts (rollFloorLoot) — kept here as
// the tuning baseline the observed rates are compared against. Update together.
const DESIGNED = { uniqueBase: 0.002, uniqueBoss: 0.05, jackpotBase: 0.004 };

// ── tiny helpers ──────────────────────────────────────────────────────────────
type Ev<K extends RpgEventKind> = Extract<RpgEvent, { kind: K }>;
function pick<K extends RpgEventKind>(events: RpgEvent[], kind: K): Ev<K>[] {
  return events.filter((e): e is Ev<K> => e.kind === kind);
}
const pct = (n: number, d: number): string => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : "—");
const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[i]!;
}
function inc<T extends string | number>(map: Map<T, number>, key: T, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}
function sortDesc(map: Map<string, number>): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

// ── metrics ─────────────────────────────────────────────────────────────────
function computeMetrics(events: RpgEvent[]) {
  const floors = pick(events, "floor_resolved");
  const ends = pick(events, "expedition_end");
  const starts = pick(events, "expedition_start");

  // Overview
  const byKind = new Map<string, number>();
  const players = new Set<string>();
  const guilds = new Set<string>();
  for (const e of events) {
    inc(byKind, e.kind);
    players.add(e.userId);
    guilds.add(e.guildId);
  }
  const at = events.map((e) => e.at);
  const spanMs = at.length ? Math.max(...at) - Math.min(...at) : 0;
  const spanHours = spanMs / 3_600_000;

  // Difficulty — per tier & per stage from floor grain
  const tier = new Map<number, { floors: number; fights: number; deaths: number; rounds: number[]; hpEnd: number[]; spikes: number }>();
  const stage = new Map<string, { floors: number; deaths: number }>();
  // A chest / shrine / event floor is a real floor (it counts for depth and drop rates) but
  // it is NOT a fight — folding its rounds:0 into the combat averages would quietly drag
  // "rounds per fight" toward zero and understate spike rates.
  const isFight = (f: Ev<"floor_resolved">) => f.floorKind !== "chest" && f.floorKind !== "shrine" && f.floorKind !== "event";
  for (const f of floors) {
    const t = tier.get(f.tier) ?? { floors: 0, fights: 0, deaths: 0, rounds: [], hpEnd: [], spikes: 0 };
    t.floors++;
    if (f.died) t.deaths++;
    if (isFight(f)) {
      t.fights++;
      t.rounds.push(f.rounds);
      if (!f.died) t.hpEnd.push(f.hpPct);
      if (f.maxHp > 0 && f.biggestHitTaken >= 0.35 * f.maxHp) t.spikes++; // ≥35% max life in one hit
    }
    tier.set(f.tier, t);
    const s = stage.get(f.stageId) ?? { floors: 0, deaths: 0 };
    s.floors++;
    if (f.died) s.deaths++;
    stage.set(f.stageId, s);
  }
  const deathFloorHist = new Map<string, number>();
  const endReasons = new Map<string, number>();
  for (const e of ends) {
    inc(endReasons, e.reason);
    if (e.reason === "death") {
      const b = e.deathFloor <= 10 ? "1-10" : e.deathFloor <= 20 ? "11-20" : e.deathFloor <= 30 ? "21-30" : "31+";
      inc(deathFloorHist, b);
    }
  }

  // Drops
  let uFloors = 0,
    uniques = 0,
    bossFloors = 0,
    bossUniques = 0,
    jackpots = 0,
    gearSum = 0,
    coinSum = 0;
  for (const f of floors) {
    uFloors++;
    if (f.boss) bossFloors++;
    if (f.unique) {
      uniques++;
      if (f.boss) bossUniques++;
    }
    if (f.jackpot) jackpots++;
    gearSum += f.gearDrops;
    coinSum += f.coins;
  }

  // Enhance odds vs designed
  const enhBy = new Map<number, { attempts: number; up: number; down: number; brk: number; stay: number; charm: number }>();
  for (const e of pick(events, "enhance")) {
    const r = enhBy.get(e.from) ?? { attempts: 0, up: 0, down: 0, brk: 0, stay: 0, charm: 0 };
    r.attempts++;
    if (e.result === "up") r.up++;
    else if (e.result === "down") r.down++;
    else if (e.result === "break") r.brk++;
    else r.stay++;
    if (e.charmUsed) r.charm++;
    enhBy.set(e.from, r);
  }

  // Economy
  const expeditionGold = ends.reduce((a, e) => a + e.gold, 0);
  const vendorCoins = pick(events, "vendor_sell").reduce((a, e) => a + e.coins, 0);
  const supplyCost = pick(events, "supply_buy").reduce((a, e) => a + e.cost, 0);
  const merges = pick(events, "merge");
  const mergeCoins = merges.reduce((a, e) => a + e.coins, 0);
  const mergeFodder = merges.reduce((a, e) => a + e.fodder, 0);
  const buys = pick(events, "market_buy");
  const marketTax = buys.reduce((a, e) => a + e.tax, 0);
  const faucet = expeditionGold + vendorCoins;
  const sink = supplyCost + marketTax + mergeCoins;
  const priceByRarity = new Map<number, number[]>();
  for (const b of buys) {
    const list = priceByRarity.get(b.rarity) ?? [];
    list.push(b.price);
    priceByRarity.set(b.rarity, list);
  }

  // Progression
  const createdByClass = new Map<string, number>();
  for (const e of pick(events, "character_created")) inc(createdByClass, e.cls);
  const ascByChoice = new Map<string, number>();
  for (const e of pick(events, "ascendancy_chosen")) inc(ascByChoice, e.ascendancy);
  const prestiges = pick(events, "prestige");
  const maxFloorByPlayer = new Map<string, number>();
  for (const f of floors) maxFloorByPlayer.set(f.userId, Math.max(maxFloorByPlayer.get(f.userId) ?? 0, f.floor));
  const maxLevelByPlayer = new Map<string, number>();
  for (const e of pick(events, "level_up")) maxLevelByPlayer.set(e.userId, Math.max(maxLevelByPlayer.get(e.userId) ?? 0, e.to));
  const reachPlayers = players.size;
  const reachedAsc = [...maxFloorByPlayer.values()].filter((f) => f >= ASCENDANCY_FLOOR).length;
  const reachedPrestige = [...maxFloorByPlayer.values()].filter((f) => f >= PRESTIGE_FLOOR).length;
  const reachedMaxLevel = [...maxLevelByPlayer.values()].filter((l) => l >= MAX_LEVEL).length;

  // Run shape — the mechanics that turn a walk into decisions (floor kinds, elites and
  // their affixes, ân huệ, and how much the Trạm Dịch risk actually costs).
  const kindCount = new Map<string, number>();
  const affixFights = new Map<string, { n: number; deaths: number }>();
  let eliteFights = 0,
    eliteDeaths = 0;
  for (const f of floors) {
    inc(kindCount, f.floorKind ?? (f.boss ? "boss" : "normal"));
    if (f.affix) {
      eliteFights++;
      if (f.died) eliteDeaths++;
      const a = affixFights.get(f.affix) ?? { n: 0, deaths: 0 };
      a.n++;
      if (f.died) a.deaths++;
      affixFights.set(f.affix, a);
    }
  }
  const boonPick = new Map<string, number>();
  for (const e of ends) for (const b of e.boons ?? []) inc(boonPick, b);
  const deathEnds = ends.filter((e) => e.reason === "death");
  const lostGear = deathEnds.reduce((a, e) => a + (e.lostGear ?? 0), 0);
  const lostCoins = deathEnds.reduce((a, e) => a + (e.lostCoins ?? 0), 0);
  const reachedStation = ends.filter((e) => (e.checkpoint ?? 0) > 0).length;

  // Passives / atlas
  const passivePick = new Map<string, number>();
  for (const e of pick(events, "passive_alloc")) inc(passivePick, e.node);
  const atlasPick = new Map<string, number>();
  for (const e of pick(events, "atlas_alloc")) inc(atlasPick, e.node);
  const neverPicked = PASSIVE_NODES.filter((n) => !passivePick.has(n.id));
  const keystonePicks = PASSIVE_NODES.filter((n) => n.keystone).map((n) => ({ id: n.id, name: n.name, count: passivePick.get(n.id) ?? 0 }));
  const respecs = pick(events, "passive_respec").length;

  // Builds (from dispatch snapshots)
  const dps = starts.map((s) => s.dps).sort((a, b) => a - b);
  const ehp = starts.map((s) => s.ehp).sort((a, b) => a - b);
  const skillPop = new Map<string, number>();
  for (const s of starts) if (s.skillGem) inc(skillPop, s.skillGem);

  // PvP
  const invades = pick(events, "pvp_invade");
  const atkWins = invades.filter((i) => i.win).length;
  const powerGaps = invades.map((i) => (i.targetPower > 0 ? Math.abs(i.attackerPower - i.targetPower) / i.targetPower : 0));

  return {
    overview: {
      totalEvents: events.length,
      players: players.size,
      guilds: guilds.size,
      spanHours: round(spanHours),
      from: at.length ? new Date(Math.min(...at)).toISOString() : null,
      to: at.length ? new Date(Math.max(...at)).toISOString() : null,
      byKind: Object.fromEntries(sortDesc(byKind)),
    },
    difficulty: {
      byTier: [...tier.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, v]) => ({
          tier: t,
          floors: v.floors,
          deathRate: round((100 * v.deaths) / v.floors, 2),
          avgRounds: round(avg(v.rounds)),
          avgEndHpPct: round(100 * avg(v.hpEnd)),
          spikeFloorPct: round((100 * v.spikes) / Math.max(1, v.fights)),
        })),
      byStage: [...stage.entries()].map(([id, v]) => ({
        stage: STAGE_BY_ID[id]?.name ?? id,
        floors: v.floors,
        deathRate: round((100 * v.deaths) / v.floors, 2),
      })),
      endReasons: Object.fromEntries(endReasons),
      deathFloorHist: Object.fromEntries(deathFloorHist),
      avgFloorsPerRun: round(avg(ends.map((e) => e.floorsCleared))),
      avgDurationMin: round(avg(ends.map((e) => e.durationMs / 60000))),
      runs: ends.length,
    },
    drops: {
      floors: uFloors,
      uniqueRate: round((100 * uniques) / Math.max(1, uFloors), 3),
      designedUniqueBase: 100 * DESIGNED.uniqueBase,
      bossUniqueRate: round((100 * bossUniques) / Math.max(1, bossFloors), 2),
      designedUniqueBoss: 100 * DESIGNED.uniqueBoss,
      nonBossUniqueRate: round((100 * (uniques - bossUniques)) / Math.max(1, uFloors - bossFloors), 3),
      jackpotRate: round((100 * jackpots) / Math.max(1, uFloors), 3),
      designedJackpotBase: 100 * DESIGNED.jackpotBase,
      gearPerFloor: round(gearSum / Math.max(1, uFloors), 2),
      coinsPerFloor: round(coinSum / Math.max(1, uFloors)),
    },
    enhance: [...enhBy.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([from, r]) => ({
        transition: `+${from}→+${from + 1}`,
        attempts: r.attempts,
        upRate: round((100 * r.up) / r.attempts, 1),
        designedUp: (ENHANCE_TABLE[from]?.up ?? 1) * 100,
        downRate: round((100 * r.down) / r.attempts, 1),
        breakRate: round((100 * r.brk) / r.attempts, 1),
        charmRate: round((100 * r.charm) / r.attempts, 1),
      })),
    economy: {
      faucet,
      sink,
      net: faucet - sink,
      faucetPerHour: round(faucet / Math.max(1, spanHours)),
      sinkPerHour: round(sink / Math.max(1, spanHours)),
      inflationPct: sink > 0 ? round((100 * (faucet - sink)) / sink) : null,
      breakdown: { expeditionGold, vendorCoins, supplyCost, marketTax, mergeCoins },
      merge: { count: merges.length, gearFodderSunk: mergeFodder, coinsSunk: mergeCoins },
      market: {
        listings: pick(events, "market_list").length,
        buys: buys.length,
        taxBurned: marketTax,
        avgPriceByRarity: Object.fromEntries([...priceByRarity.entries()].map(([r, xs]) => [RARITIES[r]?.name ?? r, round(avg(xs))])),
      },
    },
    progression: {
      createdByClass: Object.fromEntries([...createdByClass.entries()].map(([c, n]) => [CLASSES[c as keyof typeof CLASSES]?.name ?? c, n])),
      ascendancyByChoice: Object.fromEntries(sortDesc(ascByChoice)),
      prestiges: prestiges.length,
      avgPrestigeFloor: round(avg(prestiges.map((p) => p.floor))),
      avgPrestigePower: round(avg(prestiges.map((p) => p.power ?? 0))),
      avgPrestigeReward: round(avg(prestiges.map((p) => p.coNgoc))),
      funnel: {
        players: reachPlayers,
        reachedAscendancyFloor: `${reachedAsc}/${reachPlayers} (${pct(reachedAsc, reachPlayers)})`,
        reachedPrestigeFloor: `${reachedPrestige}/${reachPlayers} (${pct(reachedPrestige, reachPlayers)})`,
        reachedMaxLevel: `${reachedMaxLevel}/${reachPlayers} (${pct(reachedMaxLevel, reachPlayers)})`,
      },
    },
    runShape: {
      floorKinds: Object.fromEntries(sortDesc(kindCount)),
      eliteFights,
      eliteDeathRate: pct(eliteDeaths, eliteFights),
      byAffix: Object.fromEntries([...affixFights.entries()].map(([id, v]) => [id, `${v.n} trận · chết ${pct(v.deaths, v.n)}`])),
      boonPicks: Object.fromEntries(sortDesc(boonPick)),
      deathsPastAStation: `${deathEnds.length} lượt chết · mất ${lostGear} món + ${lostCoins} 🪙`,
      avgLostGearPerDeath: round(lostGear / Math.max(1, deathEnds.length), 2),
      runsReachingAStation: `${reachedStation}/${ends.length} (${pct(reachedStation, ends.length)})`,
    },
    passives: {
      totalAllocations: [...passivePick.values()].reduce((a, b) => a + b, 0),
      neverPicked: neverPicked.map((n) => `${n.name} (${n.id})`),
      neverPickedCount: `${neverPicked.length}/${PASSIVE_NODES.length}`,
      topPicked: sortDesc(passivePick)
        .slice(0, 10)
        .map(([id, n]) => ({ node: NODE_BY_ID[id]?.name ?? id, count: n })),
      keystones: keystonePicks.sort((a, b) => b.count - a.count),
      respecs,
      atlas: {
        allocated: [...atlasPick.values()].reduce((a, b) => a + b, 0),
        neverPicked: ATLAS_NODES.filter((n) => !atlasPick.has(n.id)).map((n) => n.name),
      },
    },
    builds: {
      dispatches: dps.length,
      dps: { p50: quantile(dps, 0.5), p90: quantile(dps, 0.9), p99: quantile(dps, 0.99), max: dps.at(-1) ?? 0 },
      ehp: { p50: quantile(ehp, 0.5), p90: quantile(ehp, 0.9), p99: quantile(ehp, 0.99), max: ehp.at(-1) ?? 0 },
      skillGemPopularity: Object.fromEntries(sortDesc(skillPop)),
    },
    pvp: {
      invades: invades.length,
      attackerWinRate: pct(atkWins, invades.length),
      avgPowerGapPct: round(100 * avg(powerGaps)),
    },
  };
}

// ── render ────────────────────────────────────────────────────────────────────
function render(m: ReturnType<typeof computeMetrics>): void {
  const h = (s: string) => console.log(`\n\x1b[1m\x1b[36m━━ ${s} ━━\x1b[0m`);
  const row = (label: string, val: unknown) => console.log(`  ${label.padEnd(26)} ${String(val)}`);

  h("OVERVIEW");
  row("Events", m.overview.totalEvents);
  row("Players", m.overview.players);
  row("Guilds", m.overview.guilds);
  row("Window (h)", m.overview.spanHours);
  row("From → To", `${m.overview.from ?? "—"} → ${m.overview.to ?? "—"}`);
  console.log("  By kind:", m.overview.byKind);

  if (m.overview.totalEvents === 0) {
    console.log("\n\x1b[33m(no telemetry yet — play some /rpg then re-run. On prod: fly ssh -C \"cd /app && bun run rpg:stats\")\x1b[0m");
    return;
  }

  h(`DIFFICULTY  (${m.difficulty.runs} runs · avg ${m.difficulty.avgFloorsPerRun} floors / ${m.difficulty.avgDurationMin} min)`);
  console.log("  tier | floors | death% | avgRnds | endHP% | spike%");
  for (const t of m.difficulty.byTier)
    console.log(`  ${String(t.tier).padStart(4)} | ${String(t.floors).padStart(6)} | ${String(t.deathRate).padStart(6)} | ${String(t.avgRounds).padStart(7)} | ${String(t.avgEndHpPct).padStart(6)} | ${t.spikeFloorPct}`);
  console.log("  end reasons:", m.difficulty.endReasons, "· death floors:", m.difficulty.deathFloorHist);
  for (const s of m.difficulty.byStage) row(s.stage, `${s.floors} floors · death ${s.deathRate}%`);

  h("DROPS  (actual vs designed)");
  row("Unique / floor", `${m.drops.uniqueRate}%  (design ${m.drops.designedUniqueBase}%)`);
  row("Unique / boss floor", `${m.drops.bossUniqueRate}%  (design ${m.drops.designedUniqueBoss}%)`);
  row("Unique / non-boss", `${m.drops.nonBossUniqueRate}%`);
  row("Jackpot / floor", `${m.drops.jackpotRate}%  (design ${m.drops.designedJackpotBase}%)`);
  row("Gear / floor", m.drops.gearPerFloor);
  row("Coins / floor", m.drops.coinsPerFloor);

  h("ENHANCE  (đập đồ — actual up% vs designed)");
  console.log("  transition | tries | up% (design) | down% | break% | charm%");
  for (const e of m.enhance)
    console.log(`  ${e.transition.padEnd(10)} | ${String(e.attempts).padStart(5)} | ${String(e.upRate).padStart(5)} (${e.designedUp}) | ${String(e.downRate).padStart(5)} | ${String(e.breakRate).padStart(6)} | ${e.charmRate}`);

  h("ECONOMY  (coin faucet vs sink)");
  row("⭐ Ghép Sao", `${m.economy.merge.count} lần · ${m.economy.merge.gearFodderSunk} đồ nung · ${m.economy.merge.coinsSunk} 🪙 sink`);
  row("Faucet / hour", m.economy.faucetPerHour);
  row("Sink / hour", m.economy.sinkPerHour);
  row("Net (faucet-sink)", `${m.economy.net}  (inflation ${m.economy.inflationPct ?? "—"}%)`);
  console.log("  breakdown:", m.economy.breakdown);
  console.log("  market:", m.economy.market);

  h("PROGRESSION");
  console.log("  created:", m.progression.createdByClass);
  console.log("  ascendancy:", m.progression.ascendancyByChoice);
  row("Prestiges", `${m.progression.prestiges} (avg floor ${m.progression.avgPrestigeFloor} · avg power ${m.progression.avgPrestigePower} → +${m.progression.avgPrestigeReward} 🔮)`);
  row("→ ascendancy floor", m.progression.funnel.reachedAscendancyFloor);
  row("→ prestige floor", m.progression.funnel.reachedPrestigeFloor);
  row("→ max level", m.progression.funnel.reachedMaxLevel);

  h("RUN SHAPE  (Trạm Dịch · ân huệ · tinh anh)");
  console.log("  floor kinds:", m.runShape.floorKinds);
  row("Trận tinh anh", `${m.runShape.eliteFights} · chết ${m.runShape.eliteDeathRate}`);
  console.log("  theo affix:", m.runShape.byAffix);
  console.log("  ân huệ được chọn:", m.runShape.boonPicks);
  row("Chết sau trạm", m.runShape.deathsPastAStation);
  row("Mất TB mỗi lần chết", `${m.runShape.avgLostGearPerDeath} món`);
  row("Run tới được trạm", m.runShape.runsReachingAStation);

  h("PASSIVES");
  row("Allocations", m.passives.totalAllocations);
  row("Never picked", m.passives.neverPickedCount);
  if (m.passives.neverPicked.length) console.log("   ", m.passives.neverPicked.join(", "));
  console.log("  top:", m.passives.topPicked.map((p) => `${p.node}×${p.count}`).join(", ") || "—");
  console.log("  keystones:", m.passives.keystones.map((k) => `${k.name}×${k.count}`).join(", ") || "—");
  row("Respecs", m.passives.respecs);
  console.log("  atlas:", m.passives.atlas);

  h("BUILDS  (dispatch snapshots)");
  row("Dispatches", m.builds.dispatches);
  console.log("  DPS:", m.builds.dps);
  console.log("  EHP:", m.builds.ehp);
  console.log("  skill gems:", m.builds.skillGemPopularity);

  h("PVP");
  row("Invades", m.pvp.invades);
  row("Attacker win rate", m.pvp.attackerWinRate);
  row("Avg power gap", `${m.pvp.avgPowerGapPct}%`);
  console.log("");
}

// ── entry ───────────────────────────────────────────────────────────────────
function main(): void {
  const argv = process.argv.slice(2);
  const guildArg = argv[argv.indexOf("--guild") + 1];
  const guild = argv.includes("--guild") ? guildArg : undefined;
  const sinceArg = argv.includes("--since") ? argv[argv.indexOf("--since") + 1] : undefined;
  const asJson = argv.includes("--json");

  let events = readAllTelemetry(guild);
  if (sinceArg) {
    const since = Date.parse(sinceArg);
    if (Number.isFinite(since)) events = events.filter((e) => e.at >= since);
  }
  const metrics = computeMetrics(events);
  if (asJson) console.log(JSON.stringify(metrics, null, 2));
  else render(metrics);
}

main();
