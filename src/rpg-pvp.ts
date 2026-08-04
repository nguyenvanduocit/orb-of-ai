// Ải Tử Chiến — the full-loot PvP arena behind `/rpg arena`. Extraction model: entering
// the zone (`vao`) escrows a HAUL of bag gear (the equipped build always stays safe) and
// publishes an async SNAPSHOT others can invade without you being online. An invasion
// (`xamlang`) resolves a hero-vs-hero autoBattle against the target's frozen snapshot; the
// LOSER's unbanked haul is banked into the WINNER's inventory. The anti-grief guardrail
// is a POWER BRACKET enforced mechanically — you can only match snapshots within
// ±PVP_BRACKET on a log scale, so sharks can't farm newbies. Every item move is
// synchronous (load → mutate → save, no await between) and ghost-guarded (a leaver is
// never handed a haul; their staked gear dies with them, cleaned in removeMemberData).
// Restart-safe by construction: all state is persisted JSON resolved lazily on the next
// interaction — no timers. No coins move here; the haul (loot) is a separate currency.
//
// The snapshot freezes the full PoE build (resolved Offense + Defenses) at entry, so an
// invasion fights the target exactly as they stood when they staked — a mid-run gear/tree
// change never rewrites a live snapshot (the defender must re-enter to refresh it).

import {
  BAG_LIMIT,
  inBracket,
  salvageYield,
  type GearItem,
  type MaterialId,
  type RpgProfile,
} from "./rpg";
import { effectiveBuild } from "./rpg-build";
import { autoBattle, type Defenses, type Fighter, type Offense } from "./rpg-combat";
import type { EffectRef } from "./rpg-effects";
import { loadCharacters, loadPvp, saveCharacters, savePvp, type PvpSnapshot } from "./rpg-store";
import { logRpgEvent } from "./rpg-telemetry";

type Haul = { gear: GearItem[]; materials: Partial<Record<MaterialId, number>> };

// Rebuild a Fighter from a frozen snapshot — the defender an invader autoBattles against.
function fighterFrom(shot: { name: string; off: Offense; def: Defenses; fx?: EffectRef[] }): Fighter {
  return { name: shot.name, off: shot.off, def: shot.def, fx: shot.fx };
}

// Bank a haul into a profile: materials add straight up, gear fills the bag up to
// BAG_LIMIT and any overflow is auto-salvaged to 🔩 (nothing is dead weight — same rule
// as the expedition banker). Mutates `profile`; the caller saves it.
function bankHaul(profile: RpgProfile, haul: Haul): void {
  for (const [id, n] of Object.entries(haul.materials) as [MaterialId, number][]) {
    if (n) profile.materials[id] = (profile.materials[id] ?? 0) + n;
  }
  let salvaged = 0;
  for (const g of haul.gear) {
    if (profile.bag.length < BAG_LIMIT) profile.bag.push(g);
    else salvaged += salvageYield(g).manh;
  }
  if (salvaged > 0) profile.materials.manh = (profile.materials.manh ?? 0) + salvaged;
}

// Freeze a profile's current build into a storable PvP snapshot (the defender others invade).
function snapshotFor(profile: RpgProfile, name: string): PvpSnapshot {
  const build = effectiveBuild(profile);
  return {
    name,
    level: profile.level,
    cls: profile.cls,
    off: build.off,
    def: build.def,
    fx: build.fx,
    power: build.power,
    updatedAt: Date.now(),
  };
}

export interface PvpStatus {
  power: number;
  haulGear: GearItem[];
  startedAt: number;
}

// The caller's current zone state, or null when they're not in the arena.
export function pvpStatus(userId: string): PvpStatus | null {
  const store = loadPvp();
  const session = store.sessions[userId];
  if (!session) return null;
  return { power: store.snapshots[userId]?.power ?? 0, haulGear: session.haul.gear, startedAt: session.startedAt };
}

// Vào vùng — stake the chosen bag gear as the at-risk haul and publish a fresh snapshot.
// Synchronous: the staked items leave the bag, the session + snapshot are written in one
// block. Equipped gear can't be staked (it's never in the bag → always safe).
export function enterZone(
  userId: string,
  itemIds: string[],
  name: string,
): { ok: true; power: number; staked: GearItem[] } | { ok: false; reason: "nochar" | "already" | "empty" | "gone" } {
  const store = loadPvp();
  if (store.sessions[userId]) return { ok: false, reason: "already" };
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "nochar" };
  if (itemIds.length === 0) return { ok: false, reason: "empty" };
  const staked: GearItem[] = [];
  for (const id of itemIds) {
    const idx = profile.bag.findIndex((g) => g.id === id);
    if (idx >= 0) staked.push(profile.bag.splice(idx, 1)[0]!);
  }
  if (staked.length === 0) return { ok: false, reason: "gone" };
  const shot = snapshotFor(profile, name);
  store.sessions[userId] = { startedAt: Date.now(), haul: { gear: staked, materials: {} } };
  store.snapshots[userId] = shot;
  saveCharacters(chars); // characters + pvp, one synchronous block — no await between
  savePvp(store);
  return { ok: true, power: shot.power, staked };
}

// Rút lui — safely extract: bank the at-risk haul back to the bag and leave the zone.
export function extractZone(
  userId: string,
): { ok: true; banked: GearItem[] } | { ok: false; reason: "notin" | "nochar" } {
  const store = loadPvp();
  const session = store.sessions[userId];
  if (!session) return { ok: false, reason: "notin" };
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "nochar" };
  const banked = session.haul.gear;
  bankHaul(profile, session.haul);
  delete store.sessions[userId];
  delete store.snapshots[userId];
  saveCharacters(chars);
  savePvp(store);
  return { ok: true, banked };
}

export interface InvadeResult {
  targetId: string;
  targetName: string;
  win: boolean;
  log: string[];
  spoils: GearItem[]; // gear that moved: won FROM the target (win) or lost TO the defender (loss)
  emptyHaul: boolean; // won, but the target had staked nothing → nothing gained
  yourPower: number;
  targetPower: number;
}

// Xâm lăng — invade a bracketed random target and resolve the fight synchronously. On a
// win the target's haul is banked into the invader; on a loss the invader's own haul is
// banked into the defender. Both transfers are ghost-guarded (a departed player is never
// handed a haul — it evaporates). The invader must themselves be in the zone (they too
// have a haul at risk), the symmetry that keeps hunting honest. The invader strikes first
// (autoBattle's `a` acts first each round), a small edge that rewards taking the risk.
export function invade(
  guildId: string,
  userId: string,
  yourName: string,
  rng: () => number = Math.random,
): InvadeResult | { error: string } {
  const store = loadPvp();
  const mine = store.sessions[userId];
  if (!mine) return { error: "Bro chưa vào vùng Tử Chiến — `/rpg arena` (cược haul) trước đã nhe." };
  const myShot = store.snapshots[userId];
  if (!myShot) return { error: "Không tìm thấy hồ sơ chiến của bro — vào lại vùng bằng `/rpg arena` nhe." };

  // Eligible = other zone members with a snapshot inside the power bracket.
  const candidates = Object.keys(store.sessions).filter(
    (id) => id !== userId && store.snapshots[id] && inBracket(myShot.power, store.snapshots[id]!.power),
  );
  if (candidates.length === 0) return { error: "Không có đối thủ nào trong tầm sức mạnh của bro lúc này — quay lại sau nhe." };
  // Prefer targets that actually have a haul to fight over; fall back to any in-bracket.
  const withHaul = candidates.filter((id) => store.sessions[id]!.haul.gear.length > 0);
  const pool = withHaul.length > 0 ? withHaul : candidates;
  const targetId = pool[Math.floor(rng() * pool.length)]!;
  const targetShot = store.snapshots[targetId]!;
  const targetSession = store.sessions[targetId]!;

  const result = autoBattle(
    fighterFrom({ ...myShot, name: yourName }),
    fighterFrom(targetShot),
    rng,
  );
  const win = result.winner === "a";

  const chars = loadCharacters();
  let spoils: GearItem[];
  let emptyHaul = false;
  if (win) {
    // Steal the target's haul → banked into the invader (ghost guard: only if invader present).
    spoils = targetSession.haul.gear;
    emptyHaul = spoils.length === 0;
    const me = chars[userId];
    if (me) bankHaul(me, targetSession.haul);
    targetSession.haul = { gear: [], materials: {} };
  } else {
    // Invader dropped their haul → banked into the defender (ghost guard: only if present).
    spoils = mine.haul.gear;
    const defender = chars[targetId];
    if (defender) bankHaul(defender, mine.haul);
    mine.haul = { gear: [], materials: {} };
  }
  saveCharacters(chars); // characters + pvp, one synchronous block — no await between
  savePvp(store);
  logRpgEvent(guildId, {
    kind: "pvp_invade",
    userId,
    attackerCls: myShot.cls,
    attackerPower: myShot.power,
    targetId,
    targetCls: targetShot.cls,
    targetPower: targetShot.power,
    win,
    rounds: result.rounds,
    spoils: spoils.length,
  });
  return { targetId, targetName: targetShot.name, win, log: result.log, spoils, emptyHaul, yourPower: myShot.power, targetPower: targetShot.power };
}

export interface PvpLadderEntry {
  userId: string;
  name: string;
  power: number;
  haulSize: number;
}

// Zone participants ranked by snapshot power (top 10), with each one's at-risk haul size.
export function pvpLadder(): PvpLadderEntry[] {
  const store = loadPvp();
  return Object.keys(store.sessions)
    .map((id) => ({
      userId: id,
      name: store.snapshots[id]?.name ?? "?",
      power: store.snapshots[id]?.power ?? 0,
      haulSize: store.sessions[id]!.haul.gear.length,
    }))
    .sort((a, b) => b.power - a.power)
    .slice(0, 10);
}
