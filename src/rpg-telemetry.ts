// RPG telemetry — the append-only tuning journal. Every meaningful thing the game
// engine does (a floor resolved, an item enhanced, a prestige, a PvP invade) is emitted
// here as one JSON line so the balance of the whole system can be measured from real
// play instead of guessed at. Read back by `bun run rpg:stats` (src/rpg-telemetry-report.ts).
//
// Design:
//   • ONE line per event, appended (never rewritten) — O(1) per event, unlike the
//     load→mutate→save whole-array stores. High-volume floor events would choke a JSON
//     array; JSONL streams.
//   • Files are date-named `rpg-telemetry-<YYYY-MM-DD>.jsonl` per guild folder → free
//     daily rotation with zero bookkeeping, and the report just globs them.
//   • DURABLE across a season wipe (each event carries `season`, so cross-season tuning
//     is possible) and across a member leaving (aggregate mechanics don't care who) —
//     the ONLY reclaim is retention-based file pruning (pruneTelemetry), which is the GC
//     that keeps the Fly volume bounded.
//   • BEST-EFFORT: telemetry must never break gameplay, so every write is wrapped and
//     swallows its own errors. A dropped line is a lost data point, never a crash.
//
// The domain cores stay pure — they return richer data (e.g. CombatResult's per-fight
// counters) and the imperative shells (expeditions.ts, commands/rpg.ts, rpg-pvp.ts) call
// logRpgEvent AFTER their synchronous ledger save, so a telemetry hiccup can't corrupt state.

import { appendFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import type { Client } from "discord.js";

import { config } from "./config";
import { guildDir, listGuildIds, liveGuildDir } from "./store";
import { SEASON } from "./rpg";
import type { ClassId, MaterialId, Rarity } from "./rpg";
import { forEachGuild, startTicker } from "./scheduler";

// Why a run ended (the "active" state never reaches the log — only settled runs do).
export type EndedReason = "death" | "rations" | "stop" | "recall";

// A material bag delta, e.g. { manh: 12, tinhchat: 3 }.
type MaterialBag = Partial<Record<MaterialId, number>>;

// ─────────────────────────────────────────────────────────────────────────────
// The event union — every field a designer would tune against. Callers pass one of
// these (the `kind` + payload); the logger stamps `at`/`season`/`guildId`. Add a
// variant here and the report can mine it — this union is the single source of truth
// for what the game records.
// ─────────────────────────────────────────────────────────────────────────────
export type RpgEventInput =
  // ── Expeditions (the over-time engine) ──────────────────────────────────────
  | {
      kind: "expedition_start";
      userId: string;
      cls: ClassId;
      level: number;
      stageId: string;
      tier: number;
      mapMods: string[];
      dps: number; // resolved powerOf offence proxy at dispatch
      ehp: number; // effective HP (life + ES, pre-mitigation) at dispatch
      life: number;
      es: number;
      rations: number; // fuel committed to the run
      potions: number;
      ascendancy?: string;
      auras: string[];
      curse?: string;
      passives: number; // allocated passive-node count
      skillGem?: string;
      supports: string[];
    }
  | {
      kind: "floor_resolved";
      userId: string;
      stageId: string;
      tier: number;
      mapMods: string[];
      floor: number;
      boss: boolean;
      // What KIND of floor this was (rpg-maps FloorKind) and, on an elite, which affix —
      // so the report can ask whether elites are killing people and which affix is hardest.
      floorKind?: string;
      affix?: string;
      monster: string;
      monsterHp: number; // resolved monster life (post tier/mods/curse)
      monsterDmg: number; // resolved monster per-hit total
      // Combat summary (hero's seat) from the fight's CombatResult — the whole point of
      // the per-floor grain: realized DPS, incoming threat, spikes, fight length.
      dmgDealt: number;
      dmgTaken: number;
      dmgTakenDot: number;
      biggestHitTaken: number;
      rounds: number;
      crits: number;
      heroDodges: number;
      monsterDodges: number;
      hpAfter: number;
      maxHp: number;
      hpPct: number; // hpAfter / maxHp, 0..1
      died: boolean;
      // Loot this floor (drop-rate mining).
      gearDrops: number;
      unique?: string;
      jackpot: boolean;
      coins: number;
      materials: MaterialBag;
      gemLevels: number; // gem levels gained this floor
    }
  | {
      kind: "expedition_end";
      userId: string;
      stageId: string;
      tier: number;
      reason: EndedReason;
      floor: number; // deepest floor reached this run
      deathFloor: number; // 0 if survived
      newRecord: boolean;
      durationMs: number;
      floorsCleared: number; // floors resolved this run
      gold: number; // floor gold banked
      gemLevels: number; // total gem levels this run
      gearKept: number; // gear banked to bag
      materials: MaterialBag; // total materials banked
      // The new run shape: which ân huệ were held, how the Trạm Dịch risk actually played
      // out, and how much variety the run met. This is what the next balance pass reads.
      boons?: string[];
      checkpoint?: number; // last floor banked (0 = never reached a station)
      lostGear?: number; // gear forfeited by dying past the last station
      lostCoins?: number;
      elites?: number;
      chests?: number;
    }
  // ── Character & progression ─────────────────────────────────────────────────
  | { kind: "character_created"; userId: string; cls: ClassId }
  | { kind: "level_up"; userId: string; from: number; to: number; cost?: MaterialBag }
  | { kind: "ascendancy_chosen"; userId: string; cls: ClassId; ascendancy: string }
  | { kind: "prestige"; userId: string; prestigeLevel: number; coNgoc: number; floor: number; power: number }
  | { kind: "passive_alloc"; userId: string; node: string; cluster?: string; keystone: boolean }
  | { kind: "passive_dealloc"; userId: string; node: string }
  | { kind: "passive_respec"; userId: string; refunded: number }
  | { kind: "atlas_alloc"; userId: string; node: string }
  | { kind: "gem_equip"; userId: string; skillGem?: string; supports: string[] }
  // ── Gear economy (faucets, sinks, gamble) ───────────────────────────────────
  | {
      kind: "enhance";
      userId: string;
      base: string;
      rarity: Rarity;
      slot?: string;
      from: number; // plus before
      to: number; // plus after
      result: "up" | "down" | "break" | "stay";
      charmUsed: boolean;
    }
  | { kind: "salvage"; userId: string; rarity: Rarity; plus: number; manh: number }
  // Gem duplicates traded for 🔩 — separate from gear `salvage` because a gem has no
  // rarity/plus, and how much of the gem bag is dead weight is its own balance question.
  | { kind: "gem_salvage"; userId: string; defId: string; count: number; manh: number }
  | { kind: "merge"; userId: string; base: string; slot: string; fromStar: number; toStar: number; fodder: number; coins: number; modUpgraded?: string }
  | { kind: "breakthrough"; userId: string; base: string; slot: string; rarity: Rarity; fromCap: number; toCap: number; fodder: number; dotpha: number; coins: number }
  | { kind: "vendor_sell"; userId: string; rarity: Rarity; plus: number; coins: number }
  | { kind: "supply_buy"; userId: string; item: MaterialId; qty: number; cost: number }
  // ── Player market ───────────────────────────────────────────────────────────
  | { kind: "market_list"; userId: string; rarity: Rarity; base: string; price: number }
  | { kind: "market_buy"; userId: string; sellerId: string; rarity: Rarity; base: string; price: number; tax: number }
  // ── PvP ─────────────────────────────────────────────────────────────────────
  | {
      kind: "pvp_invade";
      userId: string;
      attackerCls: ClassId;
      attackerPower: number;
      targetId: string;
      targetCls?: ClassId;
      targetPower: number;
      win: boolean;
      rounds: number;
      spoils: number; // gear pieces that changed hands
    };

// What actually lands on disk — the caller's event plus the stamped envelope.
export type RpgEvent = RpgEventInput & { at: number; season: number; guildId: string };

// The `kind` discriminator, handy for report filters.
export type RpgEventKind = RpgEventInput["kind"];

// ─────────────────────────────────────────────────────────────────────────────
// Writer
// ─────────────────────────────────────────────────────────────────────────────

function dayStamp(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function fileFor(dir: string, at: number): string {
  return join(dir, `rpg-telemetry-${dayStamp(at)}.jsonl`);
}

// Append one event. Best-effort: a telemetry failure logs and returns, never throws
// into the game loop. Skips silently when RPG_TELEMETRY=0 or the guild folder is gone.
export function logRpgEvent(guildId: string, event: RpgEventInput): void {
  if (!config.rpgTelemetry) return;
  try {
    const dir = liveGuildDir(guildId);
    if (!dir) return;
    const at = Date.now();
    const line = JSON.stringify({ at, season: SEASON, guildId, ...event }) + "\n";
    appendFileSync(fileFor(dir, at), line);
  } catch (err) {
    console.error(`[telemetry] append failed for guild ${guildId}:`, err);
  }
}

// Append many events in one write (one fsync) — the expedition tick emits several floor
// events plus an end event per settled run. All share one timestamp (they resolved in the
// same tick); ordering within the batch is preserved by the array + each event's `floor`.
export function logRpgEvents(guildId: string, events: RpgEventInput[]): void {
  if (!config.rpgTelemetry || events.length === 0) return;
  try {
    const dir = liveGuildDir(guildId);
    if (!dir) return;
    const at = Date.now();
    const body = events.map((e) => JSON.stringify({ at, season: SEASON, guildId, ...e })).join("\n") + "\n";
    appendFileSync(fileFor(dir, at), body);
  } catch (err) {
    console.error(`[telemetry] batch append failed for guild ${guildId}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reader (for the report script) — tolerant: a truncated tail line (crash mid-append)
// is skipped, never fatal.
// ─────────────────────────────────────────────────────────────────────────────

const FILE_RE = /^rpg-telemetry-(\d{4})-(\d{2})-(\d{2})\.jsonl$/;

export function readTelemetry(guildId: string): RpgEvent[] {
  const dir = guildDir(guildId);
  if (!existsSync(dir)) return [];
  const out: RpgEvent[] = [];
  for (const name of readdirSync(dir)) {
    if (!FILE_RE.test(name)) continue;
    let raw: string;
    try {
      raw = readFileSync(join(dir, name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as RpgEvent);
      } catch {
        // truncated/partial line — skip, don't abort the file
      }
    }
  }
  return out;
}

// Every guild's journal (default) or a single guild (--guild filter). Sorted by time so
// the report can compute rates/flows in order.
export function readAllTelemetry(guildId?: string): RpgEvent[] {
  const ids = guildId ? [guildId] : listGuildIds();
  const out: RpgEvent[] = [];
  for (const id of ids) out.push(...readTelemetry(id));
  out.sort((a, b) => a.at - b.at);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// GC — the retention prune. Date-named files older than the window are unlinked, so an
// append-only journal still honours "every persistent state has a way to be reclaimed".
// ─────────────────────────────────────────────────────────────────────────────

export function pruneTelemetry(guildId: string, retentionDays = config.rpgTelemetryRetentionDays): number {
  try {
    const dir = guildDir(guildId);
    if (!existsSync(dir)) return 0;
    const cutoff = Date.now() - retentionDays * 86_400_000;
    let removed = 0;
    for (const name of readdirSync(dir)) {
      const m = FILE_RE.exec(name);
      if (!m) continue;
      const day = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
      if (Number.isFinite(day) && day < cutoff) {
        unlinkSync(join(dir, name));
        removed++;
      }
    }
    return removed;
  } catch (err) {
    console.error(`[telemetry] prune failed for guild ${guildId}:`, err);
    return 0;
  }
}

// The retention GC ticker — prunes date-named files past the window every 6h (and once
// at startup, so a restart reclaims immediately). This is what keeps the append-only
// journal bounded on the Fly volume. No-op when telemetry is disabled.
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startTelemetryScheduler(client: Client): void {
  if (!config.rpgTelemetry) return;
  startTicker("rpg-telemetry-prune", PRUNE_INTERVAL_MS, async () => {
    await forEachGuild(client, "rpg-telemetry-prune", async (guild) => {
      const removed = pruneTelemetry(guild.id);
      if (removed > 0) console.log(`[telemetry] pruned ${removed} old file(s) for guild ${guild.id}`);
    });
  });
}
