// Cửa Ải auto-expedition engine — the realtime "đi ải" loop, a structural mirror
// of streams.ts. A dispatched run (Expedition, persisted in expeditions.json) has
// a startedAt clock; each floor takes FLOOR_MS of real time, so the number of
// floors "due" at any moment is floor((now - startedAt) / FLOOR_MS) capped by the
// remaining lương thực. A once-a-minute ticker resolves every newly-due floor for
// every active run — SYNCHRONOUS load → mutate → save (no await in between) so a
// duplicate tick, a racing lazy-resolve, or a reconcile can never double-simulate
// or double-bank. A run ends on death / no lương thực / stopAtFloor / manual
// recall; on end its private final snapshot is persisted and the accrued loot
// (+ the gem XP earned this run) is banked in the same synchronous block.
//
// Combat = the PoE-style core: at dispatch we snapshot effectiveBuild(profile) into
// the run's frozen Offense + Defenses, and each floor pits autoBattle(heroFighter,
// genMonster(...)) with the hero's CURRENT life carried between floors (a life flask
// heals a % of max life between floors; the 🧪 thuốc stock still tops up when low).
// The combat block is frozen at dispatch, so a mid-run gear/gem/tree swap never
// changes the ongoing run; the run's gem snapshot gains XP per cleared floor and is
// written back onto the live profile only at settle.
//
// Restart-safe THREE layers, exactly like streams.ts: the persisted startedAt/floor/
// hp/rations/paidFloors/loot survive a restart → a lazy resolve on the next `/rpg
// chuyen-di`|`rut-ve` catches a run up → reconcileGuildExpeditions on ClientReady
// settles any run that finished during downtime and resumes the rest.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  Routes,
  type Client,
  type Guild,
} from "discord.js";
import { loadCoins, saveCoins } from "./economy";
import { loadCharacters, loadExpeditionResults, loadExpeditions, saveCharacters, saveExpeditionResults, saveExpeditions, type Expedition } from "./rpg-store";
import {
  BAG_LIMIT,
  GEM_BAG_LIMIT,
  GEM_SALVAGE_SHARDS,
  CLASSES,
  MATERIALS,
  RARITIES,
  STAGE_BY_ID,
  currentModifier,
  DEATH_XP_PENALTY_MAX,
  deathEssencePenalty,
  rewardMultiplier,
  isBossFloor,
  lootBonus,
  recover,
  rollFloorLoot,
  salvageYield,
  stageUnlocked,
  type GearItem,
  type MaterialId,
  type RpgProfile,
  type Stage,
  type WeeklyModifier,
} from "./rpg";
import {
  AILMENT_LABEL,
  autoBattle,
  bundleTotal,
  type Ailment,
  type CombatResult,
  type DamageBundle,
  type DamageType,
  type Defenses,
  type Elem,
  type Fighter,
} from "./rpg-combat";
import {
  ELITE_LOOT,
  MAP_MOD_BY_ID,
  MAX_MAP_TIER,
  floorKind,
  genMonster,
  makeElite,
  mapTier,
  rollEliteAffix,
  rollMapMods,
  totalLootMult,
  type MapMod,
} from "./rpg-maps";
import { BOON_BY_ID, applyBoons, boonHealFrac, boonLootMul, rollBoonOffer } from "./rpg-boons";
import { QUEST_BY_ID, boardFor, claimable, creditRun, type RunTally } from "./rpg-quests";
import { aggregateAtlas } from "./rpg-atlas";
import { CURSE_BY_ID, applyCurse } from "./rpg-auras";
import { addGemXp, type SupportGemInstance } from "./rpg-skills";
import { effectiveBuild, flaskHeal } from "./rpg-build";
import { gearTable, itemName } from "./rpg-table";
import { forEachGuild, startTicker } from "./scheduler";
import { logRpgEvent, logRpgEvents, type EndedReason, type RpgEventInput } from "./rpg-telemetry";
import { privateBoardPayload, text } from "./ui";

// ─────────────────────────────────────────────────────────────────────────────
// Tunables — the pacing knobs. FLOOR_MS is the real-time cost of one floor; the
// ticker fires every TICK_MS, so ~TICK_MS/FLOOR_MS floors resolve per pass.
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 60_000; // ticker cadence (mirror streams' minute tick)
export const FLOOR_MS = 25_000; // real time per floor → ~2-3 floors per live-message edit
const LOG_LIMIT = 6; // battle-log ring kept on the run for private snapshots
const GEM_XP_PER_FLOOR = 12; // base gem XP a cleared floor grants (scaled by depth below)
// Fraction of the mana pool restored between floors. Mana is carried across a whole run
// (like life), so this is the valve that decides whether a support-heavy build can keep
// paying full price deep into an expedition or starts dropping to bare swings.
export const MANA_FLOOR_RECOVERY = 0.08;

// Bonus on gold + Essence for floors DEEPER than this stage's previous record. The
// out-levelling penalty is the stick; this is the carrot beside it — pushing into new ground
// is where the game wants you, so it should pay better than any farm route, and a player who
// keeps advancing never feels the penalty at all.
export const NEW_GROUND_BONUS = 0.35;

// Why a run ended — drives the summary wording. "active" = still going (live).
type EndReason = "active" | "death" | "rations" | "stop" | "recall";

// What active and final private snapshots render.
export interface ExpeditionStatus {
  channelId: string;
  stageId: string;
  stageName: string;
  stageEmoji: string;
  floor: number; // deepest floor cleared this run
  deathFloor: number; // floor the hero fell on (0 = didn't die)
  finished: boolean;
  reason: EndReason;
  newRecord: boolean; // this run pushed the stage's deepest-ever floor
  hp: number; // current Life
  maxHp: number; // max Life (the life pool)
  rations: number;
  potions: number;
  gemLevels: number; // gem levels gained this run (for the summary)
  loot: { gear: GearItem[]; gems?: SupportGemInstance[]; materials: Partial<Record<MaterialId, number>>; coins?: number };
  // The at-risk half of the haul + where it was last made safe. Rendered prominently while
  // a run is live: seeing what you stand to lose is what makes "push or pull out" a choice.
  carried: { gear: GearItem[]; gems?: SupportGemInstance[]; materials: Partial<Record<MaterialId, number>>; coins?: number };
  checkpoint: number;
  boons: string[];
  boonOffer?: { ids: string[]; deadline: number } | null;
  log: string[];
  bestFloor: number; // stage's deepest floor ever (post-run)
  messageId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly-modifier enemy adapter. rpg-maps' genMonster already builds the full
// PoE-shaped monster Fighter (tier + map-mods folded in); the weekly modifier still
// twists enemies through its ModEnemy shape (a flat {hp,atk,def,res,eva,crit,critDmg}
// block). We bridge the two: distil the Fighter into a rough ModEnemy, run
// modifier.mutateEnemy, then fold the deltas back onto the Fighter — hp/atk as ratios
// (so the phys/elemental damage split is preserved), armour/evasion/crit/critMulti
// directly. This keeps weekly modifiers affecting map monsters (the dropped crit/eva
// bug the old placeholder introduced). Pure; divide-by-zero guarded.
// ─────────────────────────────────────────────────────────────────────────────
function applyModifierEnemy(fighter: Fighter, modifier: WeeklyModifier): Fighter {
  if (!modifier.mutateEnemy) return fighter;
  const hp = fighter.def.life;
  const atk = bundleTotal(fighter.off.hit);
  const m = modifier.mutateEnemy({
    name: fighter.name,
    hp,
    atk: Math.round(atk),
    def: fighter.def.armour,
    res: 0,
    eva: fighter.def.evasion,
    crit: fighter.off.crit,
    critDmg: fighter.off.critMulti,
  });

  // Fold the ModEnemy deltas back. hp/atk scale by ratio so the phys/elemental split
  // survives; armour/evasion/crit/critMulti land directly. Guard both ratios.
  const hpRatio = hp > 0 ? m.hp / hp : 1;
  const atkRatio = atk > 0 ? m.atk / atk : 1;
  const hit: DamageBundle = { ...fighter.off.hit };
  for (const k of Object.keys(hit) as DamageType[]) hit[k] = Math.round(hit[k] * atkRatio);

  return {
    ...fighter,
    def: {
      ...fighter.def,
      life: Math.max(1, Math.round(fighter.def.life * hpRatio)),
      energyShield: Math.round(fighter.def.energyShield * hpRatio),
      armour: Math.max(0, m.def),
      evasion: Math.max(0, m.eva),
    },
    off: { ...fighter.off, hit, crit: m.crit, critMulti: m.critDmg },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-ish loot helpers (operate on the run's mutable state — no I/O)
// ─────────────────────────────────────────────────────────────────────────────

function pushLog(session: Expedition, line: string): void {
  session.log.push(line);
  if (session.log.length > LOG_LIMIT) session.log.splice(0, session.log.length - LOG_LIMIT);
}

// Fold one floor's drops into the run's accrued loot; the loot perk multiplies
// materials (richer piles, not extra distinct items). `shardMul`/`goldMul` are the Atlas
// Tree's per-lever knobs — 🔩 Enhancement Shard (manh) and floor gold each get their extra
// multiplier ON TOP of the general lootMul (default 1 = no extra).
function mergeLoot(
  loot: { gear: GearItem[]; gems?: SupportGemInstance[]; materials: Partial<Record<MaterialId, number>>; coins?: number },
  drops: { gear: GearItem[]; gem?: { inst: SupportGemInstance; name: string }; materials: Partial<Record<MaterialId, number>>; coins?: number },
  lootMul: number,
  shardMul = 1,
  goldMul = 1,
  // Out-levelling penalty (rpg.ts rewardMultiplier). Applies ONLY to gold and ✨ Essence —
  // the two currencies you could otherwise farm forever in a trivial map. Gear is left
  // alone because item level already caps what a shallow map can give you.
  rewardMul = 1,
): void {
  for (const g of drops.gear) loot.gear.push(g);
  if (drops.gem) (loot.gems ??= []).push(drops.gem.inst);
  for (const [id, n] of Object.entries(drops.materials) as [MaterialId, number][]) {
    if (!n) continue;
    const mul = (id === "manh" ? lootMul * shardMul : lootMul) * (id === "tinhchat" ? rewardMul : 1);
    const amount = mul !== 1 ? Math.round(n * mul) : n;
    if (amount <= 0) continue;
    loot.materials[id] = (loot.materials[id] ?? 0) + amount;
  }
  // Floor gold — the loot perk boosts it like materials, with the Atlas goldMul on top
  // (credited at settlement).
  if (drops.coins) loot.coins = (loot.coins ?? 0) + Math.round(drops.coins * lootMul * goldMul * rewardMul);
}

// An empty loot pool — the shape both `loot` (banked) and `carried` (at risk) use.
function emptyLoot(): Expedition["loot"] {
  return { gear: [], materials: {} };
}

// Pour one loot pool into another (carried → banked at a Trạm Dịch). Amounts are already
// multiplied at merge time, so this is a straight fold with no scaling.
function foldLoot(dst: Expedition["loot"], src: Expedition["loot"]): void {
  for (const g of src.gear) dst.gear.push(g);
  for (const gem of src.gems ?? []) (dst.gems ??= []).push(gem);
  for (const [id, n] of Object.entries(src.materials) as [MaterialId, number][]) {
    if (!n) continue;
    dst.materials[id] = (dst.materials[id] ?? 0) + n;
  }
  if (src.coins) dst.coins = (dst.coins ?? 0) + src.coins;
}

// ── Trạm Dịch (checkpoints) ───────────────────────────────────────────────────
// The run's risk clock. Every CHECKPOINT_EVERY floors the carried loot is sent home and
// can no longer be lost; between two stations everything earned is on the line. Because
// every region's `bossEvery` is 10, a station lands right after a boss — clear the boss,
// bank the haul, take an ân huệ, decide whether to push. That is the beat of the run.
//
// 20 is simulated, not guessed: at 10 a death cost only ~6% of a run's haul, which is far
// too cheap to make "push or pull out" a real question; 25 pushed the loss past ~19% and
// started to feel punishing. 20 lands a death at ~15% of the haul — enough to hurt, never
// enough to erase an evening. Keep it a multiple of bossEvery so the beat stays aligned.
export const CHECKPOINT_EVERY = 20;
const BOON_PICK_MS = 90_000; // how long an offer waits before the engine picks for you

function reachedCheckpoint(floor: number): boolean {
  return floor > 0 && floor % CHECKPOINT_EVERY === 0;
}

// Send the carried loot home and open a fresh ân huệ offer. Mutates the session; the
// caller persists it in the same synchronous block as everything else.
function bankAtCheckpoint(session: Expedition, floor: number, now: number): void {
  const carried = session.carried ?? emptyLoot();
  const haul = carried.gear.length + Object.keys(carried.materials).length + (carried.coins ? 1 : 0);
  foldLoot(session.loot, carried);
  session.carried = emptyLoot();
  session.checkpoint = floor;
  if (haul > 0) pushLog(session, `🏕️ **Trạm Dịch tầng ${floor}** — chiến lợi phẩm đã gửi về kho, không mất nữa`);
  // One pending offer at a time: a player who ignored the last one shouldn't stack two.
  if (!session.boonOffer) {
    const ids = rollBoonOffer(session.boons ?? [], Math.random);
    if (ids.length > 0) {
      session.boonOffer = { ids, deadline: now + BOON_PICK_MS };
      pushLog(session, `✨ Chọn **ân huệ** ở trạm — bấm nút trên tin nhắn (tự chọn sau ${Math.round(BOON_PICK_MS / 1000)}s)`);
    }
  }
}

// Grant a boon and clear the offer. Shared by the button handler and the auto-pick.
function grantBoon(session: Expedition, boonId: string): boolean {
  const boon = BOON_BY_ID[boonId];
  if (!boon) return false;
  (session.boons ??= []).push(boonId);
  session.boonOffer = null;
  pushLog(session, `✨ Nhận ân huệ ${boon.emoji} **${boon.name}** — ${boon.blurb}`);
  return true;
}

// An offer left to expire resolves itself, so being away costs you the CHOICE but never
// the benefit — the idle promise stays intact.
function autoPickExpiredBoon(session: Expedition, now: number): void {
  const offer = session.boonOffer;
  if (!offer || now < offer.deadline || offer.ids.length === 0) return;
  grantBoon(session, offer.ids[Math.floor(Math.random() * offer.ids.length)]!);
}

// ── Non-combat floors ─────────────────────────────────────────────────────────
// A chest / shrine / event resolves without a fight. Each returns the hero's hp going
// forward, an optional drop bundle, and the line to show in the run log. Pure given rng
// (it only reads the session for flavour), so the caller stays the one doing I/O.
export const CHEST_ROLLS = 3; // a chest is worth roughly three floors' worth of drops
export const SHRINE_HEAL = 0.4; // fraction of max life a shrine restores

function resolveNonCombatFloor(
  kind: "chest" | "shrine" | "event",
  stage: Stage,
  floor: number,
  hp: number,
  maxHp: number,
  modifier: WeeklyModifier,
  atlas: { uniqueMul: number },
  rng: () => number,
): { hp: number; drops?: ReturnType<typeof rollFloorLoot>; line: string } {
  if (kind === "shrine") {
    const heal = Math.round(maxHp * SHRINE_HEAL);
    const healed = Math.min(maxHp, hp + heal);
    return { hp: healed, line: `⛲ Floor ${floor}: **Suối Thiêng** — hồi ${healed - hp} máu (❤️ ${healed}/${maxHp})` };
  }

  if (kind === "chest") {
    // Fold several floor-loot rolls into one bundle so a chest feels like a haul rather
    // than another ordinary drop.
    const merged = rollFloorLoot(stage, floor, rng, modifier, atlas.uniqueMul);
    for (let i = 1; i < CHEST_ROLLS; i++) {
      const extra = rollFloorLoot(stage, floor, rng, modifier, atlas.uniqueMul);
      merged.gear.push(...extra.gear);
      if (extra.gem && !merged.gem) merged.gem = extra.gem;
      if (extra.unique && !merged.unique) merged.unique = extra.unique;
      for (const [id, n] of Object.entries(extra.materials) as [MaterialId, number][]) {
        if (n) merged.materials[id] = (merged.materials[id] ?? 0) + n;
      }
      merged.coins = (merged.coins ?? 0) + (extra.coins ?? 0);
    }
    const note = merged.gear.length > 0 ? ` (${merged.gear.length} món)` : "";
    return { hp, drops: merged, line: `🎁 Floor ${floor}: **Rương Cổ**${note}` };
  }

  // Event — a gamble with a stated price. Kept auto-resolving (the run must not stall for
  // an away player); the real decisions live at the Trạm Dịch and in whether to push on.
  const roll = rng();
  if (roll < 0.4) {
    const cost = Math.round(hp * 0.15);
    const drops = rollFloorLoot(stage, floor, rng, modifier, atlas.uniqueMul * 3);
    drops.coins = (drops.coins ?? 0) * 2;
    return { hp: Math.max(1, hp - cost), drops, line: `🩸 Floor ${floor}: **Bàn Thờ Máu** — hiến ${cost} máu, đổi lấy một mẻ lớn` };
  }
  if (roll < 0.75) {
    const drops = rollFloorLoot(stage, floor, rng, modifier, atlas.uniqueMul);
    drops.coins = (drops.coins ?? 0) + 20 + floor * 3;
    return { hp, drops, line: `💰 Floor ${floor}: **Kho Bỏ Hoang** — vơ được một túi tiền` };
  }
  const heal = Math.round(maxHp * 0.2);
  const healed = Math.min(maxHp, hp + heal);
  return { hp: healed, line: `🕯️ Floor ${floor}: **Lữ Quán Hoang** — nghỉ tạm, hồi ${healed - hp} máu` };
}

// ── Daily quests ──────────────────────────────────────────────────────────────
// Credit a finished run against the player's daily board and pay out anything that just
// completed. Mutates `profile` (board + reward materials); coins are NOT touched here —
// the caller owns the coin ledger and adds quest coins alongside the run's floor gold.
// Returns the lines to show, and stashes coins owed on the returned tuple via `questCoins`.
function creditDailies(profile: RpgProfile, tally: RunTally): { lines: string[]; coins: number } {
  const { board } = boardFor(profile.quests, Date.now(), Math.random);
  creditRun(board, tally);
  const lines: string[] = [];
  let coins = 0;
  for (const q of claimable(board)) {
    const def = QUEST_BY_ID[q.id];
    if (!def) continue;
    q.claimed = true;
    for (const [id, n] of Object.entries(def.reward.materials ?? {}) as [MaterialId, number][]) {
      if (n) profile.materials[id] = (profile.materials[id] ?? 0) + n;
    }
    coins += def.reward.coins ?? 0;
    const mats = Object.entries(def.reward.materials ?? {})
      .map(([id, n]) => `${MATERIALS[id as MaterialId].emoji} ${n}`)
      .join(" ");
    lines.push(`✅ **Nhiệm vụ xong:** ${def.emoji} ${def.label(q.target)} → ${mats}${def.reward.coins ? ` · ${def.reward.coins} 🪙` : ""}`);
  }
  profile.quests = board;
  return { lines, coins };
}

// Bank the accrued loot into the profile: materials add straight up, gear fills the
// bag up to BAG_LIMIT and any overflow is auto-salvaged to 🔩 (nothing is dead
// weight, genre anti-pattern #4). Mutates `profile` — the caller saves it.
function bankLoot(profile: RpgProfile, loot: ExpeditionStatus["loot"]): void {
  for (const [id, n] of Object.entries(loot.materials) as [MaterialId, number][]) {
    if (!n) continue;
    profile.materials[id] = (profile.materials[id] ?? 0) + n;
  }
  let salvaged = 0;
  for (const g of loot.gear) {
    if (profile.bag.length < BAG_LIMIT) profile.bag.push(g);
    else salvaged += salvageYield(g).manh;
  }
  // Dropped support gems bank into gemBag up to GEM_BAG_LIMIT; overflow auto-salvages to
  // 🔩 (same anti-dead-weight rule as gear — this is the GC that keeps gemBag bounded).
  for (const gem of loot.gems ?? []) {
    if ((profile.gemBag ??= []).length < GEM_BAG_LIMIT) profile.gemBag.push(gem);
    else salvaged += GEM_SALVAGE_SHARDS;
  }
  if (salvaged > 0) profile.materials.manh = (profile.materials.manh ?? 0) + salvaged;
}

// Persist the run's gem-XP progress back onto the live profile. The run fought with a
// frozen gem SNAPSHOT (session.combat.skillGem/supports) whose levels/xp advanced as
// floors cleared; on settle we copy that progress onto the matching profile gems
// (matched by defId, so a mid-run gem swap in the profile is respected — we only
// bump the gem the run actually used). Returns nothing; mutates `profile`.
function bankGemProgress(profile: RpgProfile, combat: Expedition["combat"]): void {
  if (combat.skillGem && profile.skillGem && profile.skillGem.defId === combat.skillGem.defId) {
    profile.skillGem.level = combat.skillGem.level;
    profile.skillGem.xp = combat.skillGem.xp;
  }
  for (const snap of combat.supports) {
    const live = profile.supports.find((s) => s.defId === snap.defId);
    if (live) {
      live.level = snap.level;
      live.xp = snap.xp;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The one synchronous advance — resolve every floor due since the last pass. When
// the run ends (death / no rations / stopAtFloor / forceClose) the loot + gem XP are
// banked and the session deleted in the SAME synchronous block, so a second
// interleaved firing can never re-run a floor or bank twice. Returns the status to
// render, or null when there is nothing new to show (dueFloors ≤ 0 and not forcing).
// ─────────────────────────────────────────────────────────────────────────────
function advanceExpedition(guildId: string, userId: string, forceClose: boolean): ExpeditionStatus | null {
  const expeditions = loadExpeditions();
  const session = expeditions[userId];
  if (!session || session.done) return null;

  // Normalise a run persisted by an OLDER build before anything reads it. `carried` in
  // particular is written to unguarded below, so a run that was in flight across a deploy
  // that introduced it would throw on every tick. Restart-safety has to survive schema
  // drift, not just process restarts.
  session.carried ??= emptyLoot();
  session.loot ??= emptyLoot();
  session.boons ??= [];
  session.checkpoint ??= 0;
  session.tally ??= { elites: 0, bosses: 0, chests: 0 };

  const now = Date.now();
  const elapsedFloors = Math.floor((now - session.startedAt) / FLOOR_MS);
  const dueFloors = Math.max(0, elapsedFloors - session.paidFloors);
  if (dueFloors <= 0 && !forceClose) return null; // persisted state is already current

  const stage = STAGE_BY_ID[session.stageId];
  const characters = loadCharacters();
  const profile = characters[userId]; // may be gone (leaver) — then loot dies, no crash
  const mods = session.mapMods.map((id) => MAP_MOD_BY_ID[id]).filter((m): m is MapMod => Boolean(m));
  // Atlas Tree — the account-wide endgame farming meta, read LIVE from the profile (loot
  // side, so no run snapshot needed). Its lootMul folds into the general multiplier; the
  // per-lever knobs (uniqueMul → rollFloorLoot, shardMul/goldMul → mergeLoot) apply separately.
  const atlas = aggregateAtlas(profile?.atlasNodes ?? []);
  // Loot multiplier folds the character perk with the map's risk/reward levers (tier +
  // rolled mods) and the Atlas loot node — higher tier / more mods / more atlas = more loot.
  const lootMul =
    (profile ? lootBonus(profile) : 1) * mapTier(session.tier).loot * totalLootMult(mods) * atlas.lootMul * boonLootMul(session.boons ?? []);
  // How far the hero has out-levelled the map they chose — scales gold + Essence only.
  const rewardMul = profile && stage ? rewardMultiplier(profile.level, stage, session.tier) : 1;
  const modifier = currentModifier(now);
  const startBest = profile ? (profile.bestFloor[session.stageId] ?? 0) : 0;

  const combat = session.combat;
  const maxHpValue = combat.maxLife;
  let { hp, floor, rations, potions } = session;
  let mana = session.mana ?? combat.mana?.max ?? 0;
  let gemLevelsGained = 0;
  let simulated = 0;
  let finished = false;
  let deathFloor = 0;
  let questCoins = 0; // paid out by dailies completing on this settle
  let reason: EndReason = "active";
  // Telemetry buffer — one floor_resolved per fight + one expedition_end on settle, flushed
  // in a single append after the ledger saves below (never mid-mutation).
  const events: RpgEventInput[] = [];

  // A corrupt/removed stage can't be simulated — close the run out and bank what's there.
  if (!stage) {
    finished = true;
    reason = "recall";
  } else {
    for (let i = 0; i < dueFloors; i++) {
      if (rations <= 0) {
        finished = true;
        reason = "rations";
        break;
      }
      if (session.stopAtFloor !== null && floor >= session.stopAtFloor) {
        finished = true;
        reason = "stop";
        break;
      }
      const target = floor + 1;
      rations -= 1;
      simulated++;

      // What kind of floor is this? Most are a fight, but a chest / shrine / event breaks
      // the conveyor. These resolve WITHOUT combat and then continue to the next floor.
      const kind = floorKind(stage, target, Math.random);
      if (kind === "chest" || kind === "shrine" || kind === "event") {
        const outcome = resolveNonCombatFloor(kind, stage, target, hp, maxHpValue, modifier, atlas, Math.random);
        hp = outcome.hp;
        floor = target;
        if (outcome.drops)
          mergeLoot(session.carried, outcome.drops, lootMul, atlas.shardMul, atlas.goldMul, target > startBest ? rewardMul * (1 + NEW_GROUND_BONUS) : rewardMul);
        if (kind === "chest") session.tally!.chests++;
        // Depth counts no matter HOW a floor was cleared — a chest floor is still progress,
        // and skipping this stranded records, the prestige gate and the map-tier unlock.
        if (profile) {
          profile.bestFloor[session.stageId] = Math.max(profile.bestFloor[session.stageId] ?? 0, target);
          profile.bestFloorThisLife = Math.max(profile.bestFloorThisLife ?? 0, target);
        }
        // Telemetry gets a row for these too, or the report's per-floor rates would divide
        // by a floor count that silently omits ~1 in 5 floors.
        events.push({
          kind: "floor_resolved",
          userId,
          stageId: session.stageId,
          tier: session.tier,
          mapMods: session.mapMods,
          floor: target,
          boss: false,
          floorKind: kind,
          monster: outcome.line.replace(/\*/g, "").slice(0, 60),
          monsterHp: 0,
          monsterDmg: 0,
          dmgDealt: 0,
          dmgTaken: 0,
          dmgTakenDot: 0,
          biggestHitTaken: 0,
          rounds: 0,
          crits: 0,
          heroDodges: 0,
          monsterDodges: 0,
          hpAfter: Math.round(hp),
          maxHp: maxHpValue,
          hpPct: maxHpValue > 0 ? Math.max(0, Math.min(1, hp / maxHpValue)) : 0,
          died: false,
          gearDrops: outcome.drops?.gear.length ?? 0,
          unique: outcome.drops?.unique?.name,
          jackpot: outcome.drops?.jackpot ?? false,
          coins: outcome.drops?.coins ?? 0,
          materials: outcome.drops?.materials ?? {},
          gemLevels: 0,
        });
        pushLog(session, outcome.line);
        if (reachedCheckpoint(target)) bankAtCheckpoint(session, target, now);
        continue;
      }

      // Build the hero Fighter from the frozen snapshot, but with the CURRENT life pool
      // so partial HP carries between floors; ES resets to its snapshot max each floor
      // (PoE ES recharges fast between packs). The run's ân huệ are folded on top — they
      // are re-applied from the frozen snapshot every floor, so they never compound.
      const hero: Fighter = applyBoons(
        {
          name: combat.name,
          off: combat.off,
          def: { ...combat.def, life: hp },
          fx: combat.fx,
          mana: combat.mana ? { ...combat.mana, current: mana } : undefined,
          basic: combat.basic,
        },
        session.boons ?? [],
      );
      // Monster = generated → weekly-modifier twist → the hero's equipped CURSE hex. The
      // curse is frozen on the run's combat snapshot, so it debuffs every floor's monster.
      // An elite floor then promotes it: tankier, hits a bit harder, and carries one affix
      // that asks a build question (see rpg-maps ELITE_AFFIXES).
      const affix = kind === "elite" ? rollEliteAffix(Math.random) : null;
      const base = applyCurse(applyModifierEnemy(genMonster(stage, target, session.tier, Math.random, mods), modifier), combat.curse);
      const monster = affix ? makeElite(base, affix) : base;
      if (affix) pushLog(session, `💀 Floor ${target}: **tinh anh** ${affix.emoji} ${affix.name} — ${affix.blurb}`);
      const result = autoBattle(hero, monster, Math.random);

      if (result.winner === "b") {
        hp = 0;
        deathFloor = target;
        finished = true;
        reason = "death";
        events.push({
          kind: "floor_resolved",
          userId,
          stageId: session.stageId,
          tier: session.tier,
          mapMods: session.mapMods,
          floor: target,
          boss: isBossFloor(stage, target),
          monster: monster.name,
          monsterHp: Math.round(monster.def.life),
          monsterDmg: Math.round(bundleTotal(monster.off.hit)),
          dmgDealt: result.bTaken,
          dmgTaken: result.aTaken,
          dmgTakenDot: result.aTakenDot,
          biggestHitTaken: result.aBiggest,
          rounds: result.rounds,
          crits: result.aCrits,
          heroDodges: result.aEvaded,
          monsterDodges: result.bEvaded,
          hpAfter: 0,
          maxHp: maxHpValue,
          hpPct: 0,
          died: true,
          gearDrops: 0,
          jackpot: false,
          coins: 0,
          materials: {},
          gemLevels: 0,
        });
        pushLog(session, `💀 Floor ${target}: gục dưới tay ${monster.name}`);
        // Post-mortem — what killed the hero + the single best fix. Pushed LAST so it
        // survives the log-tail crop and lands in the finalized summary (the teaching moment).
        for (const line of deathReport(result, monster, combat.def)) pushLog(session, line);
        break;
      }

      // Survived — carry the hero's remaining life AND mana forward.
      floor = target;
      hp = result.aHpAfter;
      if (combat.mana) mana = Math.min(combat.mana.max, Number.isFinite(result.aManaAfter) ? result.aManaAfter : combat.mana.max);
      const tally = (session.tally ??= { elites: 0, bosses: 0, chests: 0 });
      if (affix) tally.elites++;
      if (kind === "boss") tally.bosses++;

      // Gem XP: the run's frozen gems advance per cleared floor (deeper = more).
      const gemBefore = gemLevelsGained;
      const xp = GEM_XP_PER_FLOOR + Math.round(target * 1.5);
      if (combat.skillGem) gemLevelsGained += addGemXp(combat.skillGem, xp);
      for (const s of combat.supports) gemLevelsGained += addGemXp(s, Math.round(xp * 0.6));

      // Loot lands in the CARRIED pool — at risk until the next Trạm Dịch sends it home.
      // An elite pays extra TWO ways, because mergeLoot's multiplier only scales materials
      // and gold — passing a bigger number would never yield a single extra item, and gear
      // is the reward people actually chase. So an elite also gets a second independent
      // loot roll (its own gear/unique/gem chance) on top of the multiplied materials.
      const drops = rollFloorLoot(stage, target, Math.random, modifier, atlas.uniqueMul);
      const groundMul = target > startBest ? rewardMul * (1 + NEW_GROUND_BONUS) : rewardMul;
      mergeLoot(session.carried, drops, lootMul * (affix ? ELITE_LOOT : 1), atlas.shardMul, atlas.goldMul, groundMul);
      if (affix) {
        const bonus = rollFloorLoot(stage, target, Math.random, modifier, atlas.uniqueMul);
        mergeLoot(session.carried, bonus, lootMul, atlas.shardMul, atlas.goldMul, groundMul);
        for (const g of bonus.gear) drops.gear.push(g); // so the log + telemetry see them
        if (bonus.unique && !drops.unique) drops.unique = bonus.unique;
      }
      if (profile) {
        profile.bestFloor[session.stageId] = Math.max(profile.bestFloor[session.stageId] ?? 0, target);
        // Per-life deepest — the Tái Sinh eligibility gate (resets on rebirth, unlike bestFloor).
        profile.bestFloorThisLife = Math.max(profile.bestFloorThisLife ?? 0, target);
      }

      // Between-floor recovery: the life flask heals a % of max life, any healing ân huệ
      // adds on top, then the 🧪 thuốc stock tops up when still low (auto-quaff). Flask +
      // boon healing is free; a potion is consumed from the run's stock.
      const flaskGain = flaskHeal(combat.flasks, maxHpValue) + Math.round(maxHpValue * boonHealFrac(session.boons ?? []));
      if (flaskGain > 0) hp = Math.min(maxHpValue, hp + flaskGain);
      const rec = recover(hp, maxHpValue, potions);
      hp = rec.hp;
      if (rec.potionUsed) potions -= 1;
      // Resting between floors restores a slice of the pool on top of in-fight regen.
      if (combat.mana) mana = Math.min(combat.mana.max, mana + Math.round(combat.mana.max * MANA_FLOOR_RECOVERY));

      // Log the win, noting any ailment the hero inflicted this fight + a loot flag.
      const gearNote = drops.gear.length > 0 ? " 🎁" : "";
      const ailNote = ailmentNote(combat.off.ailment);
      pushLog(session, `⚔️ Floor ${target}: hạ ${monster.name}${ailNote} (❤️ ${hp}/${maxHpValue})${gearNote}`);
      // A 🟤 Unique drop gets its OWN dopamine line so it never hides in the generic 🎁 flag.
      if (drops.unique) pushLog(session, `🟤 UNIQUE DROP: ${drops.unique.name}!`);
      // A 💠 support-gem drop gets its own line too — a new build lever the player can link.
      if (drops.gem) pushLog(session, `💠 GEM DROP: ${drops.gem.name} — gắn ở \`/rpg skills\`!`);
      // Rare+ (Sử Thi / Huyền Thoại) gear gets a named line — the "ooh, is this the one?"
      // moment. Uniques already have their own line above; kept to rarity ≥ 3 so the 25s
      // ticker log doesn't churn on common drops.
      for (const g of drops.gear) {
        if (g.rarity >= 3 && !g.uniqueId) pushLog(session, `${RARITIES[g.rarity].emoji} RƠI ĐỒ XỊN: ${itemName(g)}!`);
      }

      // Telemetry: the resolved floor with its combat + loot summary (drops recorded RAW,
      // pre-lootMul, so drop-RATE analysis isn't skewed by the loot multipliers). hp/hpPct
      // are end-of-floor (post-recovery).
      events.push({
        kind: "floor_resolved",
        userId,
        stageId: session.stageId,
        tier: session.tier,
        mapMods: session.mapMods,
        floor: target,
        boss: isBossFloor(stage, target),
        floorKind: kind,
        affix: affix?.id,
        monster: monster.name,
        monsterHp: Math.round(monster.def.life),
        monsterDmg: Math.round(bundleTotal(monster.off.hit)),
        dmgDealt: result.bTaken,
        dmgTaken: result.aTaken,
        dmgTakenDot: result.aTakenDot,
        biggestHitTaken: result.aBiggest,
        rounds: result.rounds,
        crits: result.aCrits,
        heroDodges: result.aEvaded,
        monsterDodges: result.bEvaded,
        hpAfter: Math.round(hp),
        maxHp: maxHpValue,
        hpPct: maxHpValue > 0 ? Math.max(0, Math.min(1, hp / maxHpValue)) : 0,
        died: false,
        gearDrops: drops.gear.length,
        unique: drops.unique?.name,
        jackpot: drops.jackpot ?? false,
        coins: drops.coins ?? 0,
        materials: drops.materials,
        gemLevels: gemLevelsGained - gemBefore,
      });

      // Trạm Dịch — every CHECKPOINT_EVERY floors (which lands right after a boss, since
      // bossEvery matches) the carried loot is sent home for good and a fresh 1-of-3 ân huệ
      // offer opens. This is the beat the whole run is paced around: bank, pick, push on.
      if (reachedCheckpoint(target)) bankAtCheckpoint(session, target, now);

      if (session.stopAtFloor !== null && floor >= session.stopAtFloor) {
        finished = true;
        reason = "stop";
        break;
      }
    }
  }

  // An ân huệ offer the player let expire auto-picks, so an away player is never punished
  // for being away and the run keeps its build momentum either way.
  autoPickExpiredBoon(session, now);

  // A forced recall (`/rpg recall`) ends any run still standing after the catch-up.
  if (forceClose && !finished) {
    finished = true;
    reason = "recall";
  }

  // Write the progress back onto the session (gem snapshot already mutated in place).
  session.hp = hp;
  session.mana = mana;
  session.floor = floor;
  session.rations = rations;
  session.potions = potions;
  session.paidFloors += simulated;

  if (finished) {
    // THE risk rule: dying forfeits everything carried since the last Trạm Dịch. Every
    // other ending (recall / stopAtFloor / out of rations) brings the carried pool home
    // too — so retreating is always safe and pushing deeper is always the bet.
    const carried = session.carried ?? emptyLoot();
    const lostGear = carried.gear.length;
    const lostCoins = carried.coins ?? 0;
    if (reason === "death") {
      if (lostGear > 0 || lostCoins > 0) {
        pushLog(session, `💸 Mất ${lostGear} món + ${lostCoins} 🪙 chưa kịp gửi (từ Trạm Dịch tầng ${session.checkpoint ?? 0})`);
      }
      // …and the Essence toll. Taken from the profile's banked stock BEFORE this run's loot
      // is banked, so a hero cannot dodge it by dying with a full haul.
      if (profile) {
        const toll = deathEssencePenalty(profile.level, profile.materials.tinhchat ?? 0);
        if (toll > 0) {
          profile.materials.tinhchat = (profile.materials.tinhchat ?? 0) - toll;
          pushLog(session, `💀 Mất **${toll}** ✨ Essence vì gục ngã (${Math.round(100 * DEATH_XP_PENALTY_MAX)}% ở cấp tối đa)`);
        }
      }
    } else {
      foldLoot(session.loot, carried);
    }
    session.carried = emptyLoot();
    if (profile) {
      // Daily quests are credited HERE, once, off the run's own totals — never per floor,
      // so a lazy resolve or a reconcile can't pay the same run twice. Rewards are handed
      // out immediately (no claim button): a daily should feel like a pat on the back on
      // the way out, not another chore.
      const dailies = creditDailies(profile, {
        floors: floor,
        elites: session.tally?.elites ?? 0,
        bosses: session.tally?.bosses ?? 0,
        depth: floor,
        chests: session.tally?.chests ?? 0,
      });
      questCoins = dailies.coins;
      for (const line of dailies.lines) pushLog(session, line);
      bankLoot(profile, session.loot);
      bankGemProgress(profile, combat);
      // Return the unused fuel: only floors actually travelled spend rations/potions, so
      // leftovers on death/recall/stop go back to the bag. Potions especially — the run
      // auto-loads the whole 🧪 stock, the player never chose to commit all of it.
      profile.materials.luongthuc = (profile.materials.luongthuc ?? 0) + rations;
      profile.materials.thuoc = (profile.materials.thuoc ?? 0) + potions;
      // Credit the accrued floor gold — the RPG faucet. Synchronous load→mutate→save,
      // no await, same block as the character/expedition writes.
      const gold = (session.loot.coins ?? 0) + questCoins;
      if (gold > 0) {
        const coins = loadCoins();
        coins[userId] = (coins[userId] ?? 0) + gold;
        saveCoins(coins);
      }
    }
    // Telemetry: the run's outcome (why it ended, how deep, what it yielded). reason is
    // never "active" here (finished ⇒ death/rations/stop/recall) — the cast is safe.
    events.push({
      kind: "expedition_end",
      userId,
      stageId: session.stageId,
      tier: session.tier,
      reason: reason as EndedReason,
      floor,
      deathFloor,
      newRecord: floor > startBest,
      durationMs: now - session.startedAt,
      floorsCleared: floor,
      gold: session.loot.coins ?? 0,
      gemLevels: gemLevelsGained,
      gearKept: session.loot.gear.length,
      boons: session.boons ?? [],
      checkpoint: session.checkpoint ?? 0,
      lostGear: reason === "death" ? lostGear : 0,
      lostCoins: reason === "death" ? lostCoins : 0,
      elites: session.tally?.elites ?? 0,
      chests: session.tally?.chests ?? 0,
      materials: session.loot.materials,
    });
    session.done = true;
    delete expeditions[userId];
  }

  const postBest = profile ? (profile.bestFloor[session.stageId] ?? floor) : floor;
  const status: ExpeditionStatus = {
    channelId: session.channelId,
    stageId: session.stageId,
    stageName: stage?.name ?? session.stageId,
    stageEmoji: stage?.emoji ?? "🗺️",
    floor,
    deathFloor,
    finished,
    reason,
    newRecord: floor > startBest,
    hp,
    maxHp: maxHpValue,
    rations,
    potions,
    gemLevels: gemLevelsGained,
    loot: session.loot,
    carried: session.carried ?? { gear: [], materials: {} },
    checkpoint: session.checkpoint ?? 0,
    boons: session.boons ?? [],
    boonOffer: session.boonOffer ?? null,
    log: [...session.log],
    bestFloor: postBest,
    messageId: session.messageId,
  };

  // Persist the player ledger, active-run ledger, and latest private final snapshot
  // without yielding. Once a finished run is removed, later ticks can only read its
  // result — they cannot simulate or bank it again.
  if (profile) saveCharacters(characters);
  saveExpeditions(expeditions);
  if (finished) {
    const results = loadExpeditionResults();
    results[userId] = status;
    saveExpeditionResults(results);
  }
  // Flush this pass's telemetry in one append, AFTER the ledger saves (best-effort — a
  // telemetry failure never touches game state).
  logRpgEvents(guildId, events);

  return status;
}

// A short "· 🔥 Thiêu Đốt" note if the hero's build carries a meaningful ailment chance,
// so the log surfaces the elemental identity of the build. Picks the highest-chance one.
function ailmentNote(ailment: Partial<Record<Ailment, number>>): string {
  let bestAil: Ailment | null = null;
  let bestChance = 0.15; // only surface a real chance
  for (const a of Object.keys(ailment) as Ailment[]) {
    const c = ailment[a] ?? 0;
    if (c > bestChance) {
      bestChance = c;
      bestAil = a;
    }
  }
  return bestAil ? ` · ${AILMENT_LABEL[bestAil].emoji} ${AILMENT_LABEL[bestAil].name}` : "";
}

const ELEM_ICON: Record<DamageType, string> = { phys: "⚔️", fire: "🔥", cold: "❄️", light: "⚡", chaos: "☠️" };
const ELEM_VI: Record<DamageType, string> = { phys: "Vật lý", fire: "Lửa", cold: "Băng", light: "Sét", chaos: "Hỗn Độn" };

// A short, actionable death post-mortem: WHAT killed the hero + the single highest-value
// fix. Reads only the fatal fight's CombatResult, the killer's damage split, and the hero's
// resistances — no extra combat pass. This closes the ARPG hypothesis loop ("died to fire →
// chase fire res") that a bare "gục dưới tay X" line can't. Presentation lives here in the
// shell; the numbers all come from the pure core.
function deathReport(result: CombatResult, monster: Fighter, heroDef: Defenses): string[] {
  const lines: string[] = [];
  const dotShare = result.aTaken > 0 ? result.aTakenDot / result.aTaken : 0;
  // How it died — a slow bleed (DoT/ailment) vs a big blow.
  if (dotShare >= 0.4) {
    lines.push(`☠️ Chết chủ yếu vì **hiệu ứng kéo dài** (DoT nhận ${result.aTakenDot}) — tăng **Kháng** + **Máu** để trụ qua ignite/độc/chảy máu.`);
  } else {
    const pctLife = heroDef.life > 0 ? Math.round((result.aBiggest / heroDef.life) * 100) : 0;
    lines.push(`💥 Cú đau nhất ăn **${result.aBiggest}** (~${pctLife}% máu).`);
  }
  // The single highest-value fix — the killer's dominant damage type vs the hero's matching defence.
  const [topType, topVal] = (Object.entries(monster.off.hit) as [DamageType, number][]).sort((a, b) => b[1] - a[1])[0]!;
  if (topType === "phys") {
    lines.push(`⚔️ ${monster.name} đánh chủ yếu **Vật lý** — lên **Giáp** hoặc **Né** để chịu đòn.`);
  } else if (topVal > 0) {
    const res = heroDef.res[topType as Elem] ?? 0;
    if (res < 0.5) lines.push(`${ELEM_ICON[topType]} ${monster.name} nện chủ yếu **${ELEM_VI[topType]}** mà Kháng ${ELEM_VI[topType]} của bro chỉ **${Math.round(res * 100)}%** — kiếm gear **+Kháng ${ELEM_VI[topType]}**.`);
    else lines.push(`${ELEM_ICON[topType]} Sát thương chính là **${ELEM_VI[topType]}** — Kháng ${Math.round(res * 100)}% đã ổn, cần thêm **Máu/Giáp** hoặc build sát thương để hạ nhanh hơn.`);
  }
  return lines;
}

// Current status without advancing — for a lazy read where nothing new is due.
function currentStatus(userId: string): ExpeditionStatus | null {
  const session = loadExpeditions()[userId];
  if (!session || session.done) return null;
  const stage = STAGE_BY_ID[session.stageId];
  const best = loadCharacters()[userId]?.bestFloor[session.stageId] ?? session.floor;
  return {
    channelId: session.channelId,
    stageId: session.stageId,
    stageName: stage?.name ?? session.stageId,
    stageEmoji: stage?.emoji ?? "🗺️",
    floor: session.floor,
    deathFloor: 0,
    finished: false,
    reason: "active",
    newRecord: false,
    hp: session.hp,
    maxHp: session.combat.maxLife,
    rations: session.rations,
    potions: session.potions,
    gemLevels: 0,
    loot: session.loot,
    carried: session.carried ?? { gear: [], materials: {} },
    checkpoint: session.checkpoint ?? 0,
    boons: session.boons ?? [],
    boonOffer: session.boonOffer ?? null,
    log: [...session.log],
    bestFloor: best,
    messageId: session.messageId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry points
// ─────────────────────────────────────────────────────────────────────────────

// The non-ration dispatch guards, in ONE place: no character, already on a run, stage
// missing/locked. startExpedition calls this (single source of truth, messages never
// drift), and the command calls it FIRST so it can bail BEFORE any coin/ration burn.
// Returns the Vietnamese reason a start would fail for, or null when the run may proceed
// past these checks (the ration check stays inside startExpedition — it touches the store).
export function expeditionBlockReason(userId: string, stageId: string): string | null {
  const profile = loadCharacters()[userId];
  if (!profile) return "Bro chưa có nhân vật — tạo bằng `/rpg create` trước nhe.";

  if (loadExpeditions()[userId]) return "Nhân vật của bro đang đi ải rồi — `/rpg status` để coi hoặc `/rpg recall` để rút.";

  const stage = STAGE_BY_ID[stageId];
  if (!stage) return "Không có ải này bro.";
  if (!stageUnlocked(profile, stage)) {
    const gate = stage.unlockAt;
    return gate
      ? `Ải ${stage.emoji} ${stage.name} chưa mở — cần đạt tầng ${gate.floor} ở ải trước đã bro.`
      : `Ải ${stage.name} chưa mở bro.`;
  }
  return null;
}

// Dispatch a run. Đi ải là NẠP SẠCH KHO — không có bước chọn loadout: tự ôm hết 🍖
// lương thực + 🧪 thuốc đang có rồi snapshot effectiveBuild. All SYNCHRONOUS (load →
// validate → mutate → save) so a double-tap can't spend the materials twice. Đồ thừa
// được hoàn khi chết/rút/dừng nên "đem hết" không bao giờ phí. Returns the created
// Expedition, or { error } with a Vietnamese reason the command relays.
export function startExpedition(
  guildId: string,
  userId: string,
  channelId: string,
  stageId: string,
  stopAtFloor: number | null,
  tier = 1,
): Expedition | { error: string } {
  const block = expeditionBlockReason(userId, stageId);
  if (block) return { error: block };

  const characters = loadCharacters();
  const profile = characters[userId]!; // expeditionBlockReason already proved it exists
  const expeditions = loadExpeditions();

  // Nạp sạch kho — toàn bộ lương thực + thuốc đang có, không giới hạn số tầng mỗi chuyến.
  const rations = profile.materials.luongthuc ?? 0;
  if (rations < 1) return { error: "Bro hết 🍖 lương thực rồi — mua thêm ở `/rpg supply` rồi đi tiếp nhe." };
  const potions = profile.materials.thuoc ?? 0;

  if (stopAtFloor !== null && stopAtFloor < 1) stopAtFloor = null;

  // Freeze the map instance for the whole run: clamp the tier and roll its map-mods once
  // at dispatch (the risk/reward levers), so a mid-run reroll can never change the map.
  const mapTierValue = Math.max(1, Math.min(MAX_MAP_TIER, Math.round(tier)));
  const mapMods = rollMapMods(mapTierValue, Math.random).map((m) => m.id);

  // Empty the fuel stores into the run and snapshot the resolved build (leftovers refund
  // on end). The gem snapshot is a DEEP COPY so per-floor XP gains stay on the run until
  // settle and never touch the live profile mid-run.
  profile.materials.luongthuc = 0;
  profile.materials.thuoc = 0;
  const build = effectiveBuild(profile);

  const session: Expedition = {
    guildId,
    channelId,
    stageId,
    tier: mapTierValue,
    mapMods,
    startedAt: Date.now(),
    combat: {
      name: `${CLASSES[profile.cls].emoji} ${CLASSES[profile.cls].name} Lv${profile.level}`,
      off: build.off,
      def: build.def,
      fx: build.fx,
      maxLife: build.def.life,
      mana: build.mana.cost.full > 0 ? { max: build.mana.max, regen: build.mana.regen, cost: build.mana.cost } : undefined,
      basic: build.basicOff,
      skillGem: profile.skillGem ? { ...profile.skillGem } : null,
      supports: (profile.supports ?? []).map((s) => ({ ...s })),
      flasks: (profile.flasks ?? []).map((f) => ({ ...f })),
      curse: profile.curse,
    },
    hp: build.def.life,
    mana: build.mana.max,
    floor: 0,
    paidFloors: 0,
    rations,
    potions,
    stopAtFloor,
    loot: { gear: [], gems: [], materials: {}, coins: 0 },
    carried: { gear: [], gems: [], materials: {}, coins: 0 },
    checkpoint: 0,
    tally: { elites: 0, bosses: 0, chests: 0 },
    boons: [],
    boonOffer: null,
    // Seed the log with the equipped curse note so the first snapshot shows the hex.
    log: profile.curse && CURSE_BY_ID[profile.curse] ? [`🔮 Curse: ${CURSE_BY_ID[profile.curse]!.name}`] : [],
  };
  expeditions[userId] = session;

  // A new run supersedes the retained final snapshot. Keep only one finished result
  // per player so the store is bounded without a separate retention job.
  const results = loadExpeditionResults();
  const hadPreviousResult = userId in results;
  if (hadPreviousResult) delete results[userId];

  // Store mutation, one synchronous block — no await between the deducts and the writes.
  saveCharacters(characters);
  saveExpeditions(expeditions);
  if (hadPreviousResult) saveExpeditionResults(results);

  // Telemetry: snapshot the build the player is dispatching with (class/level, realized
  // DPS + effective HP, fuel committed, tree/gem loadout) so the tuning report can bucket
  // outcomes by power. Best-effort, after the saves. dps = avg hit × speed × crit-EV.
  const off = build.off;
  logRpgEvent(guildId, {
    kind: "expedition_start",
    userId,
    cls: profile.cls,
    level: profile.level,
    stageId,
    tier: mapTierValue,
    mapMods,
    dps: Math.round(bundleTotal(off.hit) * off.speed * (1 + off.crit * (off.critMulti - 1))),
    ehp: Math.round(build.def.life + build.def.energyShield),
    life: Math.round(build.def.life),
    es: Math.round(build.def.energyShield),
    rations,
    potions,
    ascendancy: profile.ascendancy,
    auras: profile.auras ?? [],
    curse: profile.curse,
    passives: profile.passives?.length ?? 0,
    skillGem: profile.skillGem?.defId,
    supports: (profile.supports ?? []).map((s) => s.defId),
  });
  return session;
}

// Lazy resolve for `/rpg status`: catch the run up to now (settling it if it
// finished), else return its current state, else the latest retained final result.
export function syncExpedition(guildId: string, userId: string): ExpeditionStatus | null {
  return advanceExpedition(guildId, userId, false) ?? currentStatus(userId) ?? loadExpeditionResults()[userId] ?? null;
}

// `/rpg recall`: force the run closed now — catch up due floors, bank the haul, delete
// the session. Returns the final private snapshot, or null when there was no active run.
export function recallExpedition(guildId: string, userId: string): ExpeditionStatus | null {
  return advanceExpedition(guildId, userId, true);
}

// Take one of the ân huệ currently on offer. Synchronous load → validate → mutate → save,
// so a double-tap can't bank two boons off one offer (the second finds the offer cleared).
// Returns the refreshed private snapshot, or an error string to show.
export function chooseBoon(guildId: string, userId: string, boonId: string): { status: ExpeditionStatus } | { error: string } {
  // Catch the run up first — the offer may already have auto-picked or the run may have
  // ended while the player sat on the button.
  const advanced = advanceExpedition(guildId, userId, false);
  const expeditions = loadExpeditions();
  const session = expeditions[userId];
  if (!session) {
    const finishedStatus = advanced?.finished ? advanced : loadExpeditionResults()[userId];
    return finishedStatus ? { status: finishedStatus } : { error: "Chuyến đi kết thúc rồi bro." };
  }
  const offer = session.boonOffer;
  if (!offer || !offer.ids.includes(boonId)) return { error: "Ân huệ này hết hiệu lực rồi — chắc đã chọn hoặc hết giờ." };
  if (!grantBoon(session, boonId)) return { error: "Không nhận được ân huệ này." };
  saveExpeditions(expeditions);
  const status = currentStatus(userId);
  return status ? { status } : { error: "Chuyến đi kết thúc rồi bro." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private pull-based snapshot view
// ─────────────────────────────────────────────────────────────────────────────

function lootSummary(loot: ExpeditionStatus["loot"]): string {
  const parts: string[] = [];
  for (const id of ["manh", "tinhchat", "thuoc", "bua", "dotpha"] as MaterialId[]) {
    const n = loot.materials[id];
    if (n) parts.push(`${MATERIALS[id].emoji} ${n}`);
  }
  if (loot.gear.length > 0) parts.push(`🎁 ${loot.gear.length} gear`);
  if (loot.gems && loot.gems.length > 0) parts.push(`💠 ${loot.gems.length} gem`);
  return parts.length > 0 ? parts.join(" · ") : "chưa nhặt được gì";
}

const FINAL_HEADLINE: Record<Exclude<EndReason, "active">, (s: ExpeditionStatus) => string> = {
  death: (s) => `💀 Gục ngã ở floor ${s.deathFloor}`,
  rations: () => "🍖 Hết Provision — về nghỉ",
  stop: (s) => `🛑 Dừng đúng floor ${s.floor} như đã đặt`,
  recall: () => "🏳️ Rút lui sớm",
};

// Slash commands and private component clicks render this snapshot on demand.
// The scheduler only advances state; it never owns a Discord message or token.
export function expeditionContainer(userId: string, status: ExpeditionStatus): ContainerBuilder {
  const logText = status.log.length > 0 ? status.log.join("\n") : "_đang khởi hành..._";
  const footer = `-# ${status.stageEmoji} ${status.stageName}`;

  if (!status.finished) {
    const nextStation = (Math.floor(status.floor / CHECKPOINT_EVERY) + 1) * CHECKPOINT_EVERY;
    const carriedRisk = status.carried.gear.length > 0 || (status.carried.coins ?? 0) > 0 || Object.keys(status.carried.materials).length > 0;
    const boonLine =
      status.boons.length > 0 ? `✨ **Ân huệ:** ${status.boons.map((id) => `${BOON_BY_ID[id]?.emoji ?? ""}${BOON_BY_ID[id]?.name ?? id}`).join(" · ")}` : null;
    const body = [
      `## 🗺️ ${status.stageEmoji} ${status.stageName} — Floor ${status.floor}`,
      `<@${userId}> đang chinh chiến, cứ để hero tự cày nhe bro!`,
      "",
      `❤️ **Life:** ${status.hp}/${status.maxHp} · 🍖 **Provision:** ${status.rations} · 🧪 **Life Potion:** ${status.potions}`,
      `🔒 **Đã gửi về kho:** ${lootSummary(status.loot)} · ${status.loot.coins ?? 0} 🪙`,
      // The at-risk line is the tension: it names exactly what a death would cost right now.
      carriedRisk
        ? `⚠️ **Đang mang (mất nếu chết):** ${lootSummary(status.carried)} · ${status.carried.coins ?? 0} 🪙`
        : "⚠️ **Đang mang:** chưa có gì",
      `🏕️ **Trạm Dịch kế:** tầng ${nextStation}${status.checkpoint > 0 ? ` (trạm gần nhất: ${status.checkpoint})` : ""}`,
      ...(boonLine ? [boonLine] : []),
      "**📜 Nhật ký:**",
      logText,
      footer,
    ].join("\n");
    const container = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(text(body));
    // A pending ân huệ offer turns the snapshot into a decision surface; otherwise the
    // only action is the retreat that now actually protects something.
    const offer = status.boonOffer;
    if (offer && offer.ids.length > 0) {
      container.addTextDisplayComponents(text(`👉 **Chọn ân huệ** — dành cho <@${userId}>, tự chọn <t:${Math.round(offer.deadline / 1000)}:R>`));
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...offer.ids.map((id) =>
            new ButtonBuilder()
              .setCustomId(`rpg:boon:${id}:${userId}`)
              .setLabel(`${BOON_BY_ID[id]?.name ?? id}`)
              .setEmoji(BOON_BY_ID[id]?.emoji ?? "✨")
              .setStyle(ButtonStyle.Primary),
          ),
        ),
      );
      container.addTextDisplayComponents(
        text(offer.ids.map((id) => `${BOON_BY_ID[id]?.emoji ?? "✨"} **${BOON_BY_ID[id]?.name ?? id}** — ${BOON_BY_ID[id]?.blurb ?? ""}`).join("\n")),
      );
    }
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`rpg:expedition:refresh:${userId}`).setLabel("Làm mới").setEmoji("🔄").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rpg:recall:${userId}`).setLabel("Rút về (giữ trọn loot)").setEmoji("🏳️").setStyle(ButtonStyle.Secondary),
      ),
    );
    return container;
  }

  const reason = status.reason === "active" ? "recall" : status.reason;
  const gemLine = status.gemLevels > 0 ? `\n💠 **Skill gem lên ${status.gemLevels} cấp!**` : "";
  const body = [
    `## ${FINAL_HEADLINE[reason](status)}`,
    `<@${userId}> khép lại chuyến đi.` + (status.newRecord ? `\n▲ **Record mới ở region này — floor ${status.floor}!**` : "") + gemLine,
    "",
    `🏛️ **Floor sâu nhất chuyến:** ${status.floor} · 🏆 **Region record:** ${status.bestFloor} · ❤️ **Life còn:** ${status.hp}/${status.maxHp}`,
    `🎒 **Đã ôm về bag:** ${lootSummary(status.loot)}`,
    ...(status.loot.gear.length > 0 ? [gearTable(status.loot.gear)] : []),
    `💰 **Gold nhận:** ${status.loot.coins ?? 0} 🪙`,
    footer,
  ].join("\n");
  return new ContainerBuilder()
    .setAccentColor(status.reason === "death" ? 0xe74c3c : 0x9b59b6)
    .addTextDisplayComponents(text(body));
}

export function expeditionPayload(userId: string, status: ExpeditionStatus) {
  return privateBoardPayload(expeditionContainer(userId, status));
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler + startup reconcile
// ─────────────────────────────────────────────────────────────────────────────

// Remember the private snapshot a player is currently looking at, so the ticker
// can keep it fresh. Called from every place that renders one; the newest
// interaction wins, which is what extends the live window each time they click.
// Synchronous load→mutate→save like every other store touch here.
export function trackExpeditionSnapshot(userId: string, token: string): void {
  const expeditions = loadExpeditions();
  const session = expeditions[userId];
  if (!session) return; // run already settled — nothing left to keep fresh
  session.live = { token, at: Date.now() };
  saveExpeditions(expeditions);
}

// Discord expires an interaction token ~15 minutes after the interaction. Stop
// trying a little before that rather than spending a request to be told no.
const LIVE_WINDOW_MS = 14 * 60_000;

// Push the current state into the player's own snapshot message. Best-effort in
// the strongest sense: ANY refusal (expired token, dismissed message, network)
// permanently drops the handle for this run — the expedition itself is untouched
// and keeps running either way. Returns whether the handle survived.
async function pushSnapshot(client: Client, userId: string, token: string, status: ExpeditionStatus): Promise<boolean> {
  // Returns whether the HANDLE is still worth keeping, so "client not ready yet"
  // is a true — nothing is wrong with the token, there is just nobody to ask.
  const applicationId = client.application?.id;
  if (!applicationId) return true;
  const payload = expeditionPayload(userId, status);
  try {
    await client.rest.patch(Routes.webhookMessage(applicationId, token, "@original"), {
      body: {
        // The message is already ephemeral; re-declaring V2 is required for an
        // edit that carries components, and mentions stay silent as on create.
        flags: MessageFlags.IsComponentsV2,
        components: payload.components.map((component) => component.toJSON()),
        allowed_mentions: { parse: [] },
      },
    });
    return true;
  } catch {
    return false;
  }
}

// Once-a-minute tick: advance every active run by its due floors, then refresh
// the snapshot of anyone still holding a live one. The ledger work is
// synchronous and happens first — the message is decoration, so a failed edit
// can never cost a floor or a drop.
export function startExpeditionScheduler(client: Client): void {
  startTicker("expeditions", TICK_MS, () =>
    forEachGuild(client, "expeditions", async (guild) => {
      for (const userId of Object.keys(loadExpeditions())) {
        // Read the handle BEFORE advancing: a run that settles this tick is
        // removed from the store, and that final result is the one update
        // players most want to see.
        const before = loadExpeditions()[userId];
        const live = before?.live;
        const floorBefore = before?.floor ?? 0;
        const status = advanceExpedition(guild.id, userId, false);
        if (!status || !live) continue;
        if (Date.now() - live.at > LIVE_WINDOW_MS) continue; // token is past its life — let it lapse quietly
        if (!status.finished && status.floor === floorBefore) continue; // nothing new to show
        const kept = await pushSnapshot(client, userId, live.token, status);
        if (!kept) {
          // Drop the dead handle so the next tick doesn't retry a doomed edit.
          const expeditions = loadExpeditions();
          if (expeditions[userId]?.live?.token === live.token) {
            delete expeditions[userId]!.live;
            saveExpeditions(expeditions);
          }
        }
      }
    }),
  );
}

// ClientReady catch-up: first detach every legacy public board handle in one
// synchronous store write, then settle/resume runs, then delete the old messages
// best-effort. Clearing before the first await makes the migration restart-safe:
// a failed delete is never treated as a reason to post or track another board.
export async function reconcileGuildExpeditions(client: Client, guild: Guild): Promise<void> {
  const expeditions = loadExpeditions();
  const legacyBoards: { channelId: string; messageId: string }[] = [];
  for (const session of Object.values(expeditions)) {
    if (!session.messageId) continue;
    legacyBoards.push({ channelId: session.channelId, messageId: session.messageId });
    delete session.messageId;
  }
  if (legacyBoards.length > 0) saveExpeditions(expeditions);

  for (const userId of Object.keys(expeditions)) {
    advanceExpedition(guild.id, userId, false);
  }

  for (const legacy of legacyBoards) {
    try {
      const channel = await client.channels.fetch(legacy.channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) continue;
      const message = await channel.messages.fetch(legacy.messageId).catch(() => null);
      if (message) await message.delete().catch(() => {});
    } catch {
      // Best-effort migration cleanup. State was detached before this await.
    }
  }
}
