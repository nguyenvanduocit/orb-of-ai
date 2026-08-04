// Cửa Ải's shared world: ONE hero per person, ONE marketplace, ONE PvP pool and
// ONE season for every server the bot is in.
//
// The RPG is the part of the bot that most needs a crowd — a marketplace with
// one seller has nothing to buy, a PvP pool with one fighter has nobody to
// invade, and a ladder with one name is a blank board. Splitting players across
// servers is what starves all three, so the whole world is stored once here and
// every server is a window onto it.
//
// The stores split by authority, and that decides how each is cleaned up:
//   characters.json — the authoritative per-player ledger (level, gear, meta).
//   expeditions.json / expedition-results.json / market.json / pvp.json —
//   in-flight or derived state that settles, expires or can be regenerated.

import type { ClassId, GearItem, MaterialId, RpgProfile } from "./rpg";
import { SEASON } from "./rpg";
import type { Defenses, Offense } from "./rpg-combat";
import type { EffectRef } from "./rpg-effects";
import type { SkillGemInstance, SupportGemInstance } from "./rpg-skills";
import type { FlaskInstance } from "./rpg-build";
import type { ExpeditionStatus } from "./expeditions";
import { loadGlobalSettings, saveGlobalSettings } from "./economy";
import { globalFile, readJsonFile, writeJsonFile } from "./store";

// characters.json = { [userId]: RpgProfile } — the authoritative RPG state.
export type Characters = Record<string, RpgProfile>;

export function loadCharacters(): Characters {
  return readJsonFile<Characters>(globalFile("characters.json")) ?? {};
}

export function saveCharacters(characters: Characters): void {
  writeJsonFile(globalFile("characters.json"), characters);
}

// expeditions.json = { [userId]: in-flight ải run } — the over-time engine's
// restart-safe state (streams.ts-style: a startedAt clock + persisted floor/hp/
// paidFloors + accrued loot). The `combat` block is a snapshot frozen at dispatch so
// a mid-run gear/gem/tree swap never changes the ongoing run: it holds the resolved
// PoE-combat shapes autoBattle fights with (the hero's Offense + Defenses), the
// hero's display name + max life (life pool cap; the flask heal % keys off it), the
// carried flasks (the between-floor life-flask heal reads these), and the run's gem
// snapshot (skillGem + supports) so gem XP accrues on the frozen copies and is
// persisted back onto the live profile only at settle. Transient — it settles/dies on
// its own; a run is dropped when its owner is forgotten entirely.
export interface Expedition {
  guildId: string; // server the run was dispatched from — where its snapshot/refresh interactions live
  channelId: string; // interaction channel context; retained for legacy message cleanup
  stageId: string;
  tier: number; // map tier (1..MAX_MAP_TIER) frozen at dispatch — scales monster difficulty + loot
  mapMods: string[]; // rolled map-mod ids (rpg-maps MAP_MOD_BY_ID) frozen at dispatch — restart-safe like the rest of the snapshot
  startedAt: number; // epoch ms — restart-safe clock (mirror StreamSession.startedAt)
  combat: {
    name: string; // hero display name for the battle log
    off: Offense; // resolved offence frozen at dispatch — what the hero's hit does
    def: Defenses; // resolved defences frozen — how monster hits land on the hero
    fx?: EffectRef[]; // behavioural effects frozen at dispatch (rpg-effects) — optional, old runs default to none
    maxLife: number; // life pool cap (def.life at dispatch) — HP ceiling + flask-heal base
    // Mana budget + the bare-skill swing, frozen like everything else so a mid-run gear swap
    // can't change the ongoing run. Optional: a run dispatched before mana existed simply
    // fights without a mana gate.
    mana?: { max: number; regen: number; cost: { full: number; base: number } };
    basic?: Offense;
    skillGem: SkillGemInstance | null; // gem snapshot — gains XP per cleared floor, persisted to the profile on settle
    supports: SupportGemInstance[]; // support-gem snapshot — same XP-on-settle path
    flasks: FlaskInstance[]; // carried flasks — the life flask heals between floors
    curse?: string; // equipped curse id (rpg-auras) frozen at dispatch — applied to each floor's monster
  };
  hp: number; // current Life (persisted → survives restart)
  mana?: number; // current Nộ Khí, carried between floors like hp (absent = start full)
  floor: number; // current floor, 0 before the first tick (persisted)
  paidFloors: number; // floors already resolved by the ticker (mirror StreamSession.paidBlocks)
  rations: number; // remaining lương thực loaded for THIS run
  potions: number; // remaining thuốc loaded for THIS run
  stopAtFloor: number | null; // auto-retreat cap (user-chosen)
  // Loot is held in TWO pools, and that split is the whole risk model of a run:
  //   `loot`    — already sent home at a Trạm Dịch. SAFE: banked even on death.
  //   `carried` — earned since the last Trạm Dịch. LOST if the hero dies.
  // Everything else (recall / stopAtFloor / out of rations) banks both, so retreating
  // is always the safe play and pushing on is always the gamble.
  loot: { gear: GearItem[]; gems?: SupportGemInstance[]; materials: Partial<Record<MaterialId, number>>; coins?: number };
  carried: { gear: GearItem[]; gems?: SupportGemInstance[]; materials: Partial<Record<MaterialId, number>>; coins?: number };
  checkpoint: number; // deepest floor whose loot has been sent home (0 = nothing banked yet)
  // Running counters for the daily quest board, credited once at settle (never per floor,
  // so a lazy resolve or a reconcile can't double-count them).
  tally?: { elites: number; bosses: number; chests: number };
  boons: string[]; // ân huệ picked this run (rpg-boons ids) — run-scoped build
  // A pending 1-of-3 offer at a Trạm Dịch. The run does NOT pause for it (idle-first):
  // `deadline` is when the engine auto-picks so an away player never stalls or loses out.
  boonOffer?: { ids: string[]; deadline: number } | null;
  log: string[]; // last ~6 battle-log lines for private snapshots (ring)
  // The private snapshot the ticker keeps fresh, as the interaction token that
  // produced it. A run outlives the token (Discord expires it ~15 min after the
  // interaction), so this is best-effort BY DESIGN: the ticker edits while it
  // can, drops the handle the first time Discord refuses, and the run carries on
  // regardless. Every new interaction (Làm mới, /rpg status) replaces it with a
  // fresh token, which is what extends the live window.
  live?: { token: string; at: number };
  messageId?: string; // legacy public board handle; startup clears it before cleanup awaits
  done?: boolean; // set on the final settle, just before delete
}

export type Expeditions = Record<string, Expedition>;

export function loadExpeditions(): Expeditions {
  return readJsonFile<Expeditions>(globalFile("expeditions.json")) ?? {};
}

export function saveExpeditions(expeditions: Expeditions): void {
  writeJsonFile(globalFile("expeditions.json"), expeditions);
}

// expedition-results.json = { [userId]: latest finished run }. Only the latest
// result is retained: `/rpg status` can still show a run settled by the silent
// scheduler, and starting the next run clears it.
export type ExpeditionResults = Record<string, ExpeditionStatus>;

export function loadExpeditionResults(): ExpeditionResults {
  return readJsonFile<ExpeditionResults>(globalFile("expedition-results.json")) ?? {};
}

export function saveExpeditionResults(results: ExpeditionResults): void {
  writeJsonFile(globalFile("expedition-results.json"), results);
}

// market.json = { listings: { [listingId]: MarketListing } } — player→player gear
// marketplace, shared by everyone. The item is escrowed out of the seller's bag at
// LIST time and lands in the buyer's bag at BUY time (buyer pays full price, seller
// nets price×0.95, the 5% is BURNED — coin circulation + a sink, never a mint).
export interface MarketListing {
  id: string; // listingId — also the customId arg + Map key
  sellerId: string;
  item: GearItem; // the escrowed item (removed from the seller's bag at list-time)
  price: number; // coin price the buyer pays in full
  listedAt: number; // epoch ms
}

export interface MarketStore {
  listings: Record<string, MarketListing>; // by listing id
}

export function loadMarket(): MarketStore {
  const raw = readJsonFile<Partial<MarketStore>>(globalFile("market.json"));
  return { listings: raw?.listings ?? {} };
}

export function saveMarket(store: MarketStore): void {
  writeJsonFile(globalFile("market.json"), store);
}

// pvp.json — Ải Tử Chiến (full-loot PvP). Two userId-keyed maps: `snapshots` are the
// PvP-on players available to be async-invaded (regenerable from characters.json —
// a frozen Offense/Defenses build + a power bracket key) and `sessions` hold each
// participant's UNBANKED haul (the escrowed bag gear at risk — the equipped build
// always stays safe). A resolved duel banks the loser's haul into the winner's
// inventory. Restart-safe by construction: plain persisted JSON resolved lazily on
// the next interaction — no timers.
export interface PvpSnapshot {
  name: string; // displayName frozen at entry
  level: number;
  cls: ClassId;
  off: Offense; // resolved offence frozen at entry — what the defender's hits do
  def: Defenses; // resolved defences frozen — how hits land on the defender an invader fights
  fx?: EffectRef[]; // behavioural effects frozen at entry (rpg-effects) — optional, old snapshots default to none
  power: number; // powerOf(off, def) — the bracket key
  updatedAt: number; // epoch ms
}

export interface PvpSession {
  startedAt: number; // epoch ms — when the player entered the zone / staked
  haul: { gear: GearItem[]; materials: Partial<Record<MaterialId, number>> }; // UNBANKED — dropped to the winner on a loss
}

export interface PvpStore {
  snapshots: Record<string, PvpSnapshot>; // PvP-on players available to be invaded
  sessions: Record<string, PvpSession>; // active extraction runs holding unbanked haul
}

export function loadPvp(): PvpStore {
  const raw = readJsonFile<Partial<PvpStore>>(globalFile("pvp.json"));
  return { snapshots: raw?.snapshots ?? {}, sessions: raw?.sessions ?? {} };
}

export function savePvp(store: PvpStore): void {
  writeJsonFile(globalFile("pvp.json"), store);
}

// Season rollover — when the stored season is behind the current SEASON, the RPG starts
// FRESH: every character, in-flight run, market listing and PvP snapshot is cleared so
// everyone re-climbs the new balance from the same starting line (a league reset).
//
// One world, one league: the roll happens ONCE at startup for the whole system, not
// once per server, so two servers can never sit on different seasons of the same
// shared characters.
//
// What SURVIVES, deliberately:
//   • coins.json — the shared wallet, spent by /diemdanh, /coin and every minigame.
//     The RPG is one of many spenders; wiping it would erase unrelated progress.
//   • rpg-telemetry-*.jsonl — each event carries its own `season`, so the old journals
//     stay readable and cross-season tuning comparisons remain possible.
//   • attendance / titles / lottery / betting — nothing to do with the RPG.
// Idempotent: once stamped, later calls are no-ops. Returns whether anyone was actually
// playing, so the caller only announces where the reset was felt.
export function rollRpgSeason(): { rolled: boolean; players: number } {
  const settings = loadGlobalSettings();
  if ((settings.rpgSeason ?? null) === SEASON) return { rolled: false, players: 0 };
  const players = Object.keys(loadCharacters()).length;
  saveCharacters({});
  saveExpeditions({});
  saveExpeditionResults({});
  saveMarket({ listings: {} });
  savePvp({ snapshots: {}, sessions: {} });
  settings.rpgSeason = SEASON;
  saveGlobalSettings(settings);
  console.log(`[rpg-store] season roll → Season ${SEASON} (wiped ${players} character(s))`);
  return { rolled: true, players };
}

// Forget a player's whole RPG life. Called only when they share no server with the
// bot any more — leaving ONE of several servers must never cost them their hero.
export function removeRpgData(userId: string): void {
  const characters = loadCharacters();
  if (userId in characters) {
    delete characters[userId];
    saveCharacters(characters);
  }
  const expeditions = loadExpeditions();
  if (userId in expeditions) {
    delete expeditions[userId]; // in-flight run dropped — accrued loot dies with them, never resurrected
    saveExpeditions(expeditions);
  }
  const results = loadExpeditionResults();
  if (userId in results) {
    delete results[userId];
    saveExpeditionResults(results);
  }
  const market = loadMarket();
  let removedListing = false;
  for (const [id, listing] of Object.entries(market.listings)) {
    if (listing.sellerId === userId) {
      delete market.listings[id]; // escrowed item vanishes with them — no coin returned
      removedListing = true;
    }
  }
  if (removedListing) saveMarket(market);
  const pvp = loadPvp();
  let pvpChanged = false;
  if (userId in pvp.snapshots) {
    delete pvp.snapshots[userId]; // no one can invade a ghost
    pvpChanged = true;
  }
  if (userId in pvp.sessions) {
    delete pvp.sessions[userId]; // staked haul dies with them — never resurrected
    pvpChanged = true;
  }
  if (pvpChanged) savePvp(pvp);
}
