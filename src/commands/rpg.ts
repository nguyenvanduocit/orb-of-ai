// /rpg — "Cửa Ải" idle-RPG, PoE-2-minified (Season 1). One umbrella command with FLAT
//   subcommands (no groups). The character is now a full PoE-style build — Life + Energy
//   Shield defence, armour/evasion, four elemental + chaos resistances, a main SKILL GEM
//   with linked SUPPORT gems, an allocated PASSIVE TREE, carried FLASKS, and gear that
//   rolls PoE prefix/suffix MODS, upgraded by the risky +N enhance system (đập đồ).
//
// This file is only the Discord glue + a few exported rule cores the agent tools reuse.
// The build fold lives in ../rpg-build (effectiveBuild / powerScore / buildMaxLife); the
// pure item/economy math in ../rpg; skills in ../rpg-skills; the tree in ../rpg-passives;
// the over-time expedition engine in ../expeditions; per-guild stores in ../guilds.
//
// Coin flow: the sinks BURN (buy lương thực/thuốc/bùa, cường hóa, market tax); the only
// faucet is NPC-sell + expedition floor gold. Loot (🔩/✨/gear) is a separate
// currency. Every coin/material/item move is a synchronous load→validate→mutate→save with
// NO await in between, so a double-click or an interleaved expedition tick can never
// double-spend.
//
// customId scheme: every component id starts with "rpg:" (the router in index.ts dispatches
// by customId.split(":")[0]) → "rpg:<area>:<action>[:<arg>...]".

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  escapeMarkdown,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { loadCoins, saveCoins } from "../economy";
import { loadCharacters, loadExpeditions, saveCharacters } from "../rpg-store";
import { displayNames } from "../guilds";
import {
  chooseBoon,
  expeditionBlockReason,
  expeditionPayload,
  trackExpeditionSnapshot,
  recallExpedition,
  startExpedition,
  syncExpedition,
} from "../expeditions";
import { MAX_MAP_TIER, genMonster, mapTier, maxTierFor } from "../rpg-maps";
import { QUEST_BY_ID, dayKey } from "../rpg-quests";
import {
  BAG_LIMIT,
  CLASSES,
  ENHANCE_TABLE,
  GEAR_BASES,
  GEAR_SLOTS,
  GEM_BAG_LIMIT,
  GEM_SALVAGE_SHARDS,
  MATERIALS,
  MAX_LEVEL,
  MAX_PLUS,
  PERKS,
  PRESTIGE_FLOOR,
  ASCENDANCY_FLOOR,
  ASCENDANCY_LEVEL,
  ascendancyUnlocked,
  RARITIES,
  STAGES,
  type Stage,
  STAGE_BY_ID,
  TutorialStep,
  applyPrestige,
  bagItemsUpToRarity,
  canPrestige,
  currentModifier,
  enhanceAttempt,
  enhanceCost,
  gearCap,
  canBreakthrough,
  breakthroughCost,
  breakthroughItem,
  gearStats,
  levelUpCost,
  levelUpsAffordable,
  markTutorial,
  MAX_STAR,
  mergeCoinCost,
  mergeFodderNeeded,
  modLabel,
  newProfile,
  nextTutorialHint,
  npcSellPrice,
  perkCost,
  prestigeReward,
  salvageYield,
  stageUnlocked,
  rewardMultiplier,
  starUpItem,
  UNIQUE_BY_ID,
  type ClassId,
  type GearItem,
  type Mod,
  type GearSlot,
  type MaterialId,
  type PerkId,
  type Rarity,
  type RpgProfile,
  type StatId,
} from "../rpg";
import {
  autoEquipBest,
  effectiveBuild,
  FLASKS,
  FLASK_BY_ID,
  powerScore,
} from "../rpg-build";
import {
  SKILL_BY_ID,
  SUPPORT_BY_ID,
  type SkillGemInstance,
  type SupportGemInstance,
} from "../rpg-skills";
import {
  NODES_BY_CLUSTER,
  NODE_BY_ID,
  PASSIVE_CLUSTERS,
  canAllocate,
  canDeallocate,
  passivePointsTotal,
  sanitizePassives,
} from "../rpg-passives";
import {
  ATLAS_NODES,
  ATLAS_BY_ID,
  aggregateAtlas,
  atlasPointsSpendable,
  atlasPointsTotal,
  canAllocateAtlas,
  deepestFloor,
  ownedAtlasKeystone,
} from "../rpg-atlas";
import { config } from "../config";
import { passiveParts, signLink } from "../rpg-web";
import {
  ASCENDANCY_BY_ID,
  ascendanciesForClass,
  chosenAscendancy,
  type AscendancyDef,
} from "../rpg-ascendancy";
import {
  AURAS,
  AURA_BY_ID,
  CURSES,
  CURSE_BY_ID,
  equippedAuras,
} from "../rpg-auras";
import { ELEMS, bundleTotal, powerOf, type Elem } from "../rpg-combat";
import { MARKET_TAX, browseListings, buyListing, cancelListing, listItem, type BuyResult } from "../rpg-market";
import { logRpgEvent } from "../rpg-telemetry";
import { enterZone, extractZone, invade, pvpLadder, pvpStatus, type InvadeResult, type PvpStatus } from "../rpg-pvp";
import { boardPayload, divider, privateBoardPayload, text } from "../ui";
import { STAT_LABEL, codeBlock, gearTable, itemName, itemTier, listTable, statCell, statTable } from "../rpg-table";
import type { Command } from "../types";

// Coin SINK prices — buying run consumables burns coins straight out of the ledger.
export const SHOP_PRICES: Record<"luongthuc" | "thuoc" | "bua" | "dotpha", number> = {
  luongthuc: 15,
  thuoc: 40,
  bua: 200,
  dotpha: 400, // 🔶 Đá Đột Phá — the coin-sink path to phá trần (bosses drop it for free)
};

// A small burn on NPC gear sales — the second RPG coin faucet (after floorGold). The seller
// receives the net; the burned fraction is never minted, so vendoring junk stops leaking a
// coin surplus into the shared server ledger. Mirrors the market's 5% burn.
const NPC_SELL_BURN = 0.05;

// Đi ải tự nạp lương thực tới mốc này (nếu kho dưới mốc) — bỏ ma sát "phải tiếp tế trước".
const RATION_AUTO_TARGET = 20;

const CLASS_COLOR: Record<ClassId, number> = { chien: 0x5865f2, phap: 0x9b59b6, cung: 0x2ecc71 };
const RPG_COLOR = 0x8e44ad;

// A one-line notice as a V2 container — the terminal state a picker/panel collapses into
// after its action (must be V2 to update an already-V2 message in place).
function noticeContainer(body: string, accent = RPG_COLOR): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(text(body));
}

// A prompt + a single select menu, as a V2 container — the gear/market/pvp pickers whose
// in-place update later folds them into a panel or a notice.
function pickerContainer(prompt: string, row: ActionRowBuilder<StringSelectMenuBuilder>): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(RPG_COLOR).addTextDisplayComponents(text(prompt)).addActionRowComponents(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small display helpers
// ─────────────────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

const ELEM_EMOJI: Record<Elem, string> = { fire: "🔥", cold: "❄️", light: "⚡", chaos: "☠️" };

function gearName(item: GearItem): string {
  const plus = item.plus > 0 ? ` **+${item.plus}**` : "";
  const star = (item.star ?? 0) > 0 ? ` ${"⭐".repeat(item.star!)}` : "";
  // A Unique renders as its OWN 🟤 tier + its named title, not a base-rarity label. A rolled
  // unique shows its upside quality %; legacy perfect (roll:1) uniques show no tag.
  if (item.uniqueId) {
    const uniq = UNIQUE_BY_ID[item.uniqueId];
    if (uniq) {
      const rollTag = item.roll < 1 ? ` \`${Math.round(item.roll * 100)}%\`` : "";
      return `🟤 ${uniq.emoji} ${uniq.name}${rollTag}${plus}${star}`;
    }
  }
  const base = GEAR_BASES[item.base];
  return `${RARITIES[item.rarity].emoji} ${base?.name ?? item.base}${plus}${star}`;
}

// A plain-text (no markdown) name for a gear item — used in select-menu option labels,
// which can't render markdown. Mirrors gearName's Unique-vs-rarity branch.
function gearPlainName(item: GearItem): string {
  const plus = item.plus > 0 ? ` +${item.plus}` : "";
  const star = (item.star ?? 0) > 0 ? ` ${(item.star ?? 0)}⭐` : "";
  if (item.uniqueId) {
    const uniq = UNIQUE_BY_ID[item.uniqueId];
    if (uniq) return `🟤 ${uniq.name}${plus}${star}`;
  }
  return `${RARITIES[item.rarity].name} ${GEAR_BASES[item.base]?.name ?? item.base}${plus}${star}`;
}

// The emoji + rounding for one gear StatId, compacted for a single line.
const STAT_ICON: Partial<Record<StatId, string>> = {
  life: "❤️", es: "🔷", armour: "🛡️", evasion: "💨", atk: "⚔️", spell: "🔮",
  addPhys: "⚔️", addFire: "🔥", addCold: "❄️", addLight: "⚡", addChaos: "☠️",
  atkPct: "🗡️", spellPct: "🔮", speedPct: "💨", crit: "🎯", critMulti: "💥",
  resFire: "🔥", resCold: "❄️", resLight: "⚡", resChaos: "☠️",
};
const PCT_STAT: ReadonlySet<StatId> = new Set<StatId>(["atkPct", "spellPct", "speedPct", "crit", "critMulti", "resFire", "resCold", "resLight", "resChaos"]);

// One item's stat contribution, compacted for a single line (reads the new StatId map).
function gearStatLine(item: GearItem): string {
  const s = gearStats(item);
  const parts: string[] = [];
  for (const key of Object.keys(s) as StatId[]) {
    const v = s[key];
    if (!v) continue;
    const icon = STAT_ICON[key] ?? "•";
    parts.push(PCT_STAT.has(key) ? `${icon}${pct(v)}` : `${icon}${Math.round(v)}`);
  }
  return parts.join(" ") || "—";
}

// Thousands-separated integer for stat tables (1200 → "1,200").
function num(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// One item's stats as aligned table rows (label → signed value), for single-item detail blocks.
function gearStatRows(item: GearItem): [string, string][] {
  const s = gearStats(item);
  const rows: [string, string][] = [];
  for (const key of Object.keys(s) as StatId[]) {
    const v = s[key];
    if (v) rows.push([STAT_LABEL[key].name, statCell(key, v)]);
  }
  return rows;
}

// A single item's full stats as a monospace table (enhance panel, purchase confirm, drops).
function gearStatBlock(item: GearItem): string {
  const rows = gearStatRows(item);
  return rows.length ? codeBlock(statTable(rows)) : "*(không có chỉ số)*";
}

// The item's ROLLED affixes as free-text lines carrying their TIER (T1 = best), e.g.
// "❤️ Máu: +92 (T1)". This is the whole godroll chase: the folded stat block above shows
// only totals, so a T1 and a T4 of the same mod read identically there — the tier lives
// ONLY here. Rendered as free text OUTSIDE the aligned monospace table (rpg-table bans
// emoji in aligned regions). Empty for Normals / Uniques (no rolled mods).
function gearModBlock(item: GearItem): string {
  if (!item.mods || item.mods.length === 0) return "";
  return `**✨ Dòng ngọc** (T1 = xịn nhất):\n${item.mods.map((m) => modLabel(m)).join("\n")}`;
}

// Compact power-delta cell for list tables (▲/▼ sit in the final right-aligned column).
function deltaCell(delta: number): string {
  return delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : "≈";
}

// How much power the profile would gain (▲) / lose (▼) if this item were equipped in its
// slot vs the item currently there — the genre's #1 readability ask. Uses the build fold.
function equipDelta(profile: RpgProfile, item: GearItem): number {
  const cur = powerScore(profile);
  const preview: RpgProfile = { ...profile, gear: { ...profile.gear, [item.slot]: item } };
  return powerScore(preview) - cur;
}

function deltaTag(delta: number): string {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return "≈ ngang";
}

function hpBar(hp: number, max: number): string {
  const slots = 12;
  const filled = max <= 0 ? 0 : Math.max(0, Math.min(slots, Math.round((hp / max) * slots)));
  return "🟥".repeat(filled) + "⬛".repeat(slots - filled);
}

// Find an item by instance id anywhere on the profile (equipped or bag).
function findItem(profile: RpgProfile, itemId: string): { item: GearItem; inBag: boolean } | null {
  for (const slot of GEAR_SLOTS) {
    const it = profile.gear[slot.id];
    if (it && it.id === itemId) return { item: it, inBag: false };
  }
  const bagItem = profile.bag.find((g) => g.id === itemId);
  if (bagItem) return { item: bagItem, inBag: true };
  return null;
}

// The label a gem instance renders with (skill or support), tolerant of an unknown defId.
function gemLabel(inst: SkillGemInstance | SupportGemInstance): string {
  const def = SKILL_BY_ID[inst.defId] ?? SUPPORT_BY_ID[inst.defId];
  return def ? `${def.emoji} ${def.name} Lv${inst.level}` : `❔ ${inst.defId}`;
}
function isSkillGem(inst: SkillGemInstance | SupportGemInstance): boolean {
  return inst.defId in SKILL_BY_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tutorial nudge — one contextual next-step line appended to result embeds; goes silent
// once every basic step is learned (never nags veterans).
// ─────────────────────────────────────────────────────────────────────────────

function markStep(userId: string, step: TutorialStep): void {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return;
  const next = markTutorial(profile.tutorial ?? 0, step);
  if (next === profile.tutorial) return;
  profile.tutorial = next;
  saveCharacters(chars);
}

function hintLine(profile: RpgProfile | null): string {
  if (!profile) return "";
  const hint = nextTutorialHint(profile);
  return hint ? `\n-# 👉 ${hint.text}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — the class-pick create screen. Any /rpg subcommand invoked without a
// character (except `tao-nhan-vat` and `huong-dan`) lands here instead of an error.
// ─────────────────────────────────────────────────────────────────────────────

function createScreen(): ContainerBuilder {
  const lines = (Object.keys(CLASSES) as ClassId[]).map((id) => {
    const c = CLASSES[id];
    return `${c.emoji} **${c.name}**\n-# ${c.skill}`;
  });
  const body = [
    "## 🗺️ Cửa Ải — chọn class để bắt đầu!",
    "Chào mừng tới **Cửa Ải** — xây hero kiểu Path of Exile, chạy map, nó **tự đánh** từng floor, mình nhặt loot, ghép skill gem, mở passive tree nhe bro!",
    "",
    ...lines,
    "",
    "Chọn một class bên dưới. Mỗi class có lối chơi riêng — chọn xong là chơi liền.",
  ].join("\n");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(Object.keys(CLASSES) as ClassId[]).map((id) =>
      new ButtonBuilder()
        .setCustomId(`rpg:create:${id}`)
        .setLabel(CLASSES[id].name)
        .setEmoji(CLASSES[id].emoji)
        .setStyle(ButtonStyle.Primary),
    ),
  );
  return new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(row);
}

// Exported core: create a hero for a member. Guards against an existing character. One
// synchronous load→mutate→save.
export function createCharacter(guildId: string, userId: string, cls: ClassId): RpgProfile | { error: string } {
  const chars = loadCharacters();
  const existing = chars[userId];
  if (existing)
    return {
      error: `Bro có nhân vật rồi (${CLASSES[existing.cls].emoji} ${CLASSES[existing.cls].name} Lv${existing.level}) — xem bằng /rpg hero nhe.`,
    };
  const profile = newProfile(cls, Date.now(), Math.random);
  profile.tutorial = markTutorial(profile.tutorial, TutorialStep.Create);
  chars[userId] = profile;
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "character_created", userId, cls });
  return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character sheet — the resolved PoE build: Life + Energy Shield, armour/evasion, the four
// elemental resistances (+ chaos), main skill gem + linked supports, power, allocated
// passive count. Built entirely from effectiveBuild.
// ─────────────────────────────────────────────────────────────────────────────

function skillLine(profile: RpgProfile): string {
  if (!profile.skillGem) return "*(chưa gắn skill gem)* — `/rpg skills`";
  const skill = SKILL_BY_ID[profile.skillGem.defId];
  const head = skill ? `${skill.emoji} **${skill.name}** Lv${profile.skillGem.level}` : `❔ ${profile.skillGem.defId}`;
  const sockets = skill?.sockets ?? 0;
  const supports = (profile.supports ?? []).slice(0, sockets);
  const supLine = supports.length > 0 ? supports.map((s) => gemLabel(s)).join(", ") : "*chưa có support*";
  return `${head}\n-# 🔗 ${supports.length}/${sockets} support gem: ${supLine}`;
}

// The character sheet is a CLASSIC embed (not Components V2) so the stat groups can be native
// inline fields — Tấn công | Phòng thủ | Kháng render as three side-by-side columns (stacking on
// mobile), which reads cleaner than a monospace block. Lists that need cross-row alignment (gear)
// stay a monospace table inside their field. Returns a ready reply payload; it's posted fresh
// each `/rpg hero` (never edited in place), so there's no V2↔classic edit-lock to worry about.
function characterSheetReply(
  profile: RpgProfile,
  name: string,
  opts: { intro?: string; owner: boolean },
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; flags: MessageFlags.Ephemeral } {
  const c = CLASSES[profile.cls];
  const build = effectiveBuild(profile);
  const power = build.power;
  const stars = profile.prestigeLevel > 0 ? ` · 🌟×${profile.prestigeLevel}` : "";
  const maxLife = build.def.life;
  const asc = ascendancyUnlocked(profile) ? chosenAscendancy(profile.cls, profile.ascendancy) : null;
  const ascBadge = asc ? ` · ${asc.emoji} ${asc.name}` : "";
  const ascLine = ascendancyUnlocked(profile)
    ? asc
      ? `${asc.emoji} **${asc.name}** — ${asc.keystoneName} · \`/rpg hero\` → nút Ascendancy để đổi`
      : "✨ **Ascendancy đã mở khoá** — chọn subclass ở nút Ascendancy dưới đây!"
    : `🔒 Ascendancy khoá — cần floor ${ASCENDANCY_FLOOR} (bất kỳ region) hoặc Lv${ASCENDANCY_LEVEL}`;

  const gearBlock = codeBlock(
    listTable(
      ["Ô", "Trang bị", "Cấp"],
      GEAR_SLOTS.map((slot) => {
        const item = profile.gear[slot.id];
        return item ? [slot.name, itemName(item), itemTier(item)] : [slot.name, "— trống —", ""];
      }),
    ),
  );

  const mats = (["luongthuc", "thuoc", "manh", "tinhchat", "bua", "dotpha"] as MaterialId[])
    .map((id) => `${MATERIALS[id].emoji} ${profile.materials[id] ?? 0}`)
    .join(" · ");

  const best = STAGES.filter((s) => (profile.bestFloor[s.id] ?? 0) > 0)
    .map((s) => `${s.emoji} ${s.name}: floor ${profile.bestFloor[s.id]}`)
    .join("\n");

  const pointsTotal = passivePointsTotal(profile.level, profile.prestigeLevel);
  const allocated = (profile.passives ?? []).length;

  const activeAuras = build.spirit.running;
  const auraLine = activeAuras.length > 0 ? activeAuras.map((a) => `${a.emoji} ${a.name}`).join(" · ") : "*chưa bật aura nào*";
  const curseDef = profile.curse ? CURSE_BY_ID[profile.curse] : undefined;
  const curseLine = curseDef ? `${curseDef.emoji} ${curseDef.name}` : "*chưa yểm curse*";

  // A still-onboarding hero keeps its next-step hint on EVERY sheet view (not just right
  // after create), so a returning new player is never left staring at a dense sheet with
  // no idea what to do. Auto-vanishes once the tutorial is complete. An explicit intro wins.
  const hint = nextTutorialHint(profile);
  const embed = new EmbedBuilder()
    .setColor(CLASS_COLOR[profile.cls])
    .setTitle(`${c.emoji} ${name} — Lv${profile.level}/${MAX_LEVEL}${stars}`)
    .setDescription(
      [
        ...(opts.intro ? [opts.intro, ""] : hint ? [`👉 ${hint.text}`, ""] : []),
        `-# ${c.name}${ascBadge}`,
        `⚔️ **Power: ${power}**`,
        hpBar(maxLife + build.def.energyShield, maxLife + build.def.energyShield),
      ].join("\n"),
    )
    .addFields(
      {
        name: "⚔️ Tấn công",
        value: [
          `Sát thương **${num(bundleTotal(build.off.hit))}**`,
          `Chí mạng ${pct(build.off.crit)}`,
          `ST Crit ×${build.off.critMulti.toFixed(2)}`,
          `Tốc đánh ${build.off.speed.toFixed(2)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🛡️ Phòng thủ",
        value: [
          `Máu **${num(maxLife)}**`,
          `Khiên NL ${num(build.def.energyShield)}`,
          `Giáp ${num(build.def.armour)}`,
          `Né ${num(build.def.evasion)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🔰 Kháng",
        value: ELEMS.map((e) => `${ELEM_EMOJI[e]} ${pct(build.def.res[e])}`).join("\n"),
        inline: true,
      },
      { name: "⭐ Ascendancy", value: ascLine, inline: false },
      {
        name: "🔮 Auras & Curses",
        value: `🕯️ Linh Lực: **${build.spirit.reserved}/${build.spirit.total}** đã dùng\n✨ Aura: ${auraLine}\n🎯 Curse: ${curseLine}`,
        inline: false,
      },
      {
        name: "🔵 Nộ Khí",
        value:
          build.mana.cost.full > 0
            ? `Bể **${build.mana.max}** · hồi **${build.mana.regen}**/hiệp\nMỗi đòn tốn **${build.mana.cost.full}** (đòn cơ bản **${build.mana.cost.base}**)`
            : "*chưa gắn skill gem*",
        inline: false,
      },
      { name: "🗡️ Skill", value: `${skillLine(profile)}\n🌳 Passives: **${allocated}/${pointsTotal}** điểm — \`/rpg passives\``, inline: false },
      { name: "🎒 Gear", value: gearBlock, inline: false },
      { name: "📦 Stash", value: `${mats}\n🧰 Bag: ${profile.bag.length}/${BAG_LIMIT} · 🔮 Jewel: ${profile.coNgoc}`, inline: false },
    );
  if (best) embed.addFields({ name: "🏆 Region records", value: best, inline: false });
  // Dailies are shown on the sheet the owner already opens every session — a short,
  // finishable goal list right where they decide what to do next. Read-only: the board
  // rolls and pays out inside the expedition settle, never from a render.
  if (opts.owner) {
    const board = profile.quests;
    const today = board && board.day === dayKey(Date.now()) ? board : null;
    embed.addFields({
      name: "📋 Nhiệm vụ hôm nay",
      value: today
        ? today.quests
            .map((q) => {
              const def = QUEST_BY_ID[q.id];
              if (!def) return null;
              const done = q.progress >= q.target;
              return `${done ? "✅" : def.emoji} ${def.label(q.target)} — **${Math.min(q.progress, q.target)}/${q.target}**${done ? " (đã nhận thưởng)" : ""}`;
            })
            .filter(Boolean)
            .join("\n")
        : "*Đi ải một chuyến để nhận bảng nhiệm vụ hôm nay.*",
      inline: false,
    });
  }

  return { embeds: [embed], components: opts.owner ? sheetButtons(profile) : [], flags: MessageFlags.Ephemeral };
}

function sheetButtons(profile: RpgProfile): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("rpg:char:levelup").setLabel("Level Up").setEmoji("⬆️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("rpg:skill:open").setLabel("Skill Gem").setEmoji("🗡️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("rpg:tree:open").setLabel("Passives").setEmoji("🌳").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("rpg:asc:open").setLabel("Ascendancy").setEmoji("⭐").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("rpg:guide:open").setLabel("Guide").setEmoji("📖").setStyle(ButtonStyle.Secondary),
  );
  rows.push(row1);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    // The "just play" CTA — one tap dispatches to the deepest unlocked region so a new
    // player sees a floor resolve without hunting for /rpg map + a region argument.
    new ButtonBuilder().setCustomId("rpg:go:quick").setLabel("Đi ải ngay").setEmoji("🗺️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("rpg:aura:open").setLabel("Auras & Curses").setEmoji("🔮").setStyle(ButtonStyle.Primary),
  );
  if (canPrestige(profile)) {
    row2.addComponents(
      new ButtonBuilder().setCustomId("rpg:char:prestige").setLabel("Prestige").setEmoji("🌟").setStyle(ButtonStyle.Primary),
    );
  }
  rows.push(row2);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level up (len-cap) — spend ✨ tinh chất ONLY (no coins). Single + bulk "Nâng tối đa".
// ─────────────────────────────────────────────────────────────────────────────

type LevelUpResult =
  | { ok: true; levels: number; level: number; spent: number; tinhchat: number }
  | { ok: false; reason: "maxed" }
  | { ok: false; reason: "tinhchat"; need: number; have: number };

// Level-up costs ✨ tinh chất ONLY (see levelUpCost in rpg.ts). `bulk` loops the single-level
// rule via levelUpsAffordable so the number can never drift; a single step is bulk with a
// cap of 1. Synchronous load→mutate→save.
function doLevelUp(guildId: string, userId: string, bulk = false): LevelUpResult {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  if (profile.level >= MAX_LEVEL) return { ok: false, reason: "maxed" };
  const affordable = levelUpsAffordable(profile);
  if (affordable < 1) {
    const cost = levelUpCost(profile.level);
    return { ok: false, reason: "tinhchat", need: cost.tinhchat, have: profile.materials.tinhchat ?? 0 };
  }
  const steps = bulk ? affordable : 1;
  const fromLevel = profile.level;
  let spent = 0;
  let levels = 0;
  for (let i = 0; i < steps; i++) {
    if (profile.level >= MAX_LEVEL) break;
    const cost = levelUpCost(profile.level);
    if ((profile.materials.tinhchat ?? 0) < cost.tinhchat) break;
    profile.materials.tinhchat = (profile.materials.tinhchat ?? 0) - cost.tinhchat;
    profile.level += 1;
    spent += cost.tinhchat;
    levels += 1;
  }
  profile.tutorial = markTutorial(profile.tutorial ?? 0, TutorialStep.LevelUp);
  saveCharacters(chars);
  if (levels > 0)
    logRpgEvent(guildId, { kind: "level_up", userId, from: fromLevel, to: profile.level, cost: { tinhchat: spent } });
  return { ok: true, levels, level: profile.level, spent, tinhchat: profile.materials.tinhchat ?? 0 };
}

function levelUpParts(userId: string, result: LevelUpResult, profile: RpgProfile): { title: string; body: string; color: number } {
  if (!result.ok) {
    const msg =
      result.reason === "maxed"
        ? `Hero đã đạt cấp tối đa **${MAX_LEVEL}** — mở cổng Prestige (\`/rpg prestige\`) để đi tiếp bro 🌟`
        : `Chưa đủ ✨ Essence bro — cần **${result.need}**, đang có **${result.have}**. Chạy map cày thêm nhe.`;
    return { title: "⬆️ Level Up", body: msg, color: 0x99aab5 };
  }
  const body =
    `<@${userId}> giờ là **Lv${result.level}** ${CLASSES[profile.cls].emoji}${result.levels > 1 ? ` (+${result.levels} cấp)` : ""}\n` +
    `Tốn ${MATERIALS.tinhchat.emoji} ${result.spent} ✨ (miễn phí coin)\n` +
    `Còn lại: ✨ ${result.tinhchat}` +
    (result.level < MAX_LEVEL ? `\n-# Lần sau: ${levelUpCost(result.level).tinhchat} ✨ · nút **Nâng tối đa** dồn hết Essence` : "") +
    hintLine(profile);
  return { title: "⬆️ Lên cấp!", body, color: 0x2ecc71 };
}

// Ephemeral char-sheet button path stays classic — an embed built from the shared parts.
function levelUpEmbed(userId: string, result: LevelUpResult, profile: RpgProfile): EmbedBuilder {
  const p = levelUpParts(userId, result, profile);
  return new EmbedBuilder().setTitle(p.title).setDescription(p.body).setColor(p.color);
}

// Public /rpg levelup path — V2 container, carrying the sheet quick-actions + a "Nâng tối đa"
// button on success.
function levelUpContainer(userId: string, result: LevelUpResult, profile: RpgProfile): ContainerBuilder {
  const p = levelUpParts(userId, result, profile);
  const container = new ContainerBuilder().setAccentColor(p.color).addTextDisplayComponents(text(`## ${p.title}\n${p.body}`));
  const canMore = profile.level < MAX_LEVEL && levelUpsAffordable(profile) > 0;
  if (result.ok || canMore) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rpg:char:levelmax").setLabel("Nâng tối đa").setEmoji("⏫").setStyle(ButtonStyle.Success).setDisabled(!canMore),
    );
    container.addSeparatorComponents(divider()).addActionRowComponents(row);
  }
  return container;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ngọc kỹ năng (skill + support gems) — pick the main skill from the owned gemBag skill
// gems, then socket/unsocket support gems into its sockets (respecting the skill's socket
// count). All state on the profile: skillGem, supports[], gemBag[].
// ─────────────────────────────────────────────────────────────────────────────

// One select option per gem TYPE, offering that type's best copy (highest level, then xp).
// Discord caps a select at 25 options while the gem bag holds up to GEM_BAG_LIMIT (40), so
// one-option-per-instance silently dropped everything past the 25th — and since unsocket
// pushes the gem to the END of the bag, a player with a full bag watched the gem they just
// removed disappear from the panel for good ("tháo gem ra là mất": still owned, unreachable).
// Grouping by defId bounds the list by the CATALOG (6 skills / 12 supports), never the bag.
// Returns each group's bag index, so the value still resolves one exact instance.
export function gemGroups<T extends { defId: string; level: number; xp: number }>(
  bag: (SkillGemInstance | SupportGemInstance)[],
  gems: T[],
): { inst: T; count: number; bagIndex: number }[] {
  const byType = new Map<string, T[]>();
  for (const g of gems) {
    const list = byType.get(g.defId);
    if (list) list.push(g);
    else byType.set(g.defId, [g]);
  }
  return [...byType.values()].map((list) => {
    const inst = list.reduce((best, g) => (g.level > best.level || (g.level === best.level && g.xp > best.xp) ? g : best));
    return { inst, count: list.length, bagIndex: bag.indexOf(inst) };
  });
}

function skillPanel(profile: RpgProfile): ContainerBuilder {
  const skill = profile.skillGem ? SKILL_BY_ID[profile.skillGem.defId] : null;
  const sockets = skill?.sockets ?? 0;
  const linked = (profile.supports ?? []).slice(0, sockets);
  const loose = profile.gemBag ?? [];
  const skillGemsInBag = loose.filter((g) => isSkillGem(g)) as SkillGemInstance[];
  const supportsInBag = loose.filter((g) => !isSkillGem(g)) as SupportGemInstance[];

  const head = profile.skillGem
    ? skill
      ? `${skill.emoji} **${skill.name}** Lv${profile.skillGem.level} — ${skill.blurb}`
      : `❔ ${profile.skillGem.defId}`
    : "*(chưa gắn skill gem chính)*";

  const linkedBlock = sockets > 0
    ? Array.from({ length: sockets }, (_, i) => {
        const s = linked[i];
        return s ? `🔗 Socket ${i + 1}: ${gemLabel(s)} — ${SUPPORT_BY_ID[s.defId]?.blurb ?? ""}` : `⬜ Socket ${i + 1}: *trống*`;
      }).join("\n")
    : "-# Gắn một skill gem chính để mở socket support.";

  const body = [
    "## 🗡️ Skill Gem",
    `**Skill chính:** ${head}`,
    "",
    `**Support gem đã gắn (${linked.length}/${sockets}):**`,
    linkedBlock,
    "",
    // A full bag auto-salvages every further gem drop (bankLoot's rule) — say so, or the
    // player keeps looting gems that quietly turn into 🔩 without ever reaching them.
    loose.length >= GEM_BAG_LIMIT
      ? `-# 🎒 Gem bag ĐẦY: ${loose.length}/${GEM_BAG_LIMIT} (${skillGemsInBag.length} skill · ${supportsInBag.length} support) · 🔩 ${profile.materials.manh ?? 0} — gem rơi thêm sẽ tự phân rã thành 🔩. Phân rã bản trùng để lấy chỗ đi bro.`
      : `-# 🎒 Trong gem bag: ${skillGemsInBag.length} skill · ${supportsInBag.length} support (${loose.length}/${GEM_BAG_LIMIT}) · 🔩 ${profile.materials.manh ?? 0}.`,
  ].join("\n");

  const container = new ContainerBuilder().setAccentColor(CLASS_COLOR[profile.cls]).addTextDisplayComponents(text(body)).addSeparatorComponents(divider());

  // Set-main-skill select (from owned skill gems in the bag).
  if (skillGemsInBag.length > 0) {
    const options = gemGroups(loose, skillGemsInBag).map(({ inst, count, bagIndex }) => {
      const def = SKILL_BY_ID[inst.defId]!;
      // Value = the gem's ABSOLUTE index in gemBag (unique per option). Using defId would collide
      // when the bag holds duplicate gem types → Discord rejects the whole message
      // (COMPONENT_OPTION_VALUE_DUPLICATED); the index also resolves the EXACT instance (right Lv).
      return new StringSelectMenuOptionBuilder().setLabel(`${def.name} Lv${inst.level}${count > 1 ? ` ×${count}` : ""}`.slice(0, 100)).setEmoji(def.emoji).setDescription((def.blurb ?? "").slice(0, 100)).setValue(String(bagIndex));
    });
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:skill:setmain").setPlaceholder("🗡️ Đặt skill gem chính").addOptions(options),
      ),
    );
  }

  // Socket-a-support select (only when a main skill has an open socket + a loose support exists).
  if (skill && linked.length < sockets && supportsInBag.length > 0) {
    const options = gemGroups(loose, supportsInBag).map(({ inst, count, bagIndex }) => {
      const def = SUPPORT_BY_ID[inst.defId]!;
      // Value = absolute gemBag index (unique) — see the skill select above; duplicate support
      // types in the bag would otherwise collide on defId and crash the whole panel render.
      return new StringSelectMenuOptionBuilder().setLabel(`${def.name} Lv${inst.level}${count > 1 ? ` ×${count}` : ""}`.slice(0, 100)).setEmoji(def.emoji).setDescription((def.blurb ?? "").slice(0, 100)).setValue(String(bagIndex));
    });
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:skill:socket").setPlaceholder("🔗 Gắn support gem vào socket trống").addOptions(options),
      ),
    );
  }

  // Unsocket-a-support select (when there is at least one linked support).
  if (linked.length > 0) {
    const options = linked.map((g, i) => {
      const def = SUPPORT_BY_ID[g.defId];
      return new StringSelectMenuOptionBuilder().setLabel(`Gỡ socket ${i + 1}: ${def?.name ?? g.defId} Lv${g.level}`.slice(0, 100)).setEmoji("↩️").setValue(String(i));
    });
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:skill:unsocket").setPlaceholder("↩️ Gỡ support gem về bag").addOptions(options),
      ),
    );
  }

  // Salvage duplicates — the only way to free gem-bag space, so a full bag stops silently
  // auto-salvaging every new drop. One option per type that HAS duplicates; value = defId.
  const dupes = gemGroups(loose, loose).filter((g) => g.count > 1);
  if (dupes.length > 0) {
    const options = dupes.slice(0, 25).map(({ inst, count }) => {
      const def = SUPPORT_BY_ID[inst.defId] ?? SKILL_BY_ID[inst.defId];
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${def?.name ?? inst.defId} ×${count} → phân rã ${count - 1}`.slice(0, 100))
        .setEmoji("🔩")
        .setDescription(`Giữ bản Lv${inst.level}, nhận ${(count - 1) * GEM_SALVAGE_SHARDS} 🔩`.slice(0, 100))
        .setValue(inst.defId);
    });
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:skill:salvage").setPlaceholder("🔩 Phân rã bản trùng (giữ bản xịn nhất)").addOptions(options),
      ),
    );
  }
  return container;
}

// Set the main skill gem from an owned skill gem in gemBag; the previous main goes back to
// the bag, and its linked supports return to the bag too (a new skill has its own sockets).
// Synchronous.
function setMainSkill(guildId: string, userId: string, bagIndex: number): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const bag = profile.gemBag ?? [];
  const chosen = bag[bagIndex];
  if (!chosen || !isSkillGem(chosen)) return { ok: false, reason: "Skill gem này không còn trong bag bro (chắc bag vừa đổi) — mở lại `/rpg skills` nhe." };
  bag.splice(bagIndex, 1);
  // Old main + its linked supports return to the bag.
  if (profile.skillGem) bag.push(profile.skillGem);
  for (const s of profile.supports ?? []) bag.push(s);
  profile.skillGem = chosen as SkillGemInstance;
  profile.supports = [];
  profile.gemBag = bag;
  saveCharacters(chars);
  logRpgEvent(guildId, {
    kind: "gem_equip",
    userId,
    skillGem: profile.skillGem?.defId,
    supports: (profile.supports ?? []).map((s) => s.defId),
  });
  return { ok: true, name: SKILL_BY_ID[chosen.defId]?.name ?? chosen.defId };
}

// Socket a support gem from the bag into the main skill's next open socket. Synchronous.
function socketSupport(guildId: string, userId: string, bagIndex: number): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  if (!profile.skillGem) return { ok: false, reason: "Chưa có skill gem chính bro — đặt một skill gem trước." };
  const skill = SKILL_BY_ID[profile.skillGem.defId];
  if (!skill) return { ok: false, reason: "Skill gem chính không hợp lệ." };
  const supports = profile.supports ?? [];
  if (supports.length >= skill.sockets) return { ok: false, reason: `Ngọc **${skill.name}** đã kín ${skill.sockets} socket support rồi bro.` };
  const bag = profile.gemBag ?? [];
  const chosen = bag[bagIndex];
  if (!chosen || isSkillGem(chosen)) return { ok: false, reason: "Support gem này không còn trong bag bro (chắc bag vừa đổi) — mở lại `/rpg skills` nhe." };
  bag.splice(bagIndex, 1);
  supports.push(chosen as SupportGemInstance);
  profile.supports = supports;
  profile.gemBag = bag;
  saveCharacters(chars);
  logRpgEvent(guildId, {
    kind: "gem_equip",
    userId,
    skillGem: profile.skillGem?.defId,
    supports: (profile.supports ?? []).map((s) => s.defId),
  });
  return { ok: true, name: SUPPORT_BY_ID[chosen.defId]?.name ?? chosen.defId };
}

// Unsocket the support at index `slot` back to the bag. Synchronous.
function unsocketSupport(guildId: string, userId: string, slot: number): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const supports = profile.supports ?? [];
  if (slot < 0 || slot >= supports.length) return { ok: false, reason: "Ô đó trống bro." };
  const [removed] = supports.splice(slot, 1);
  // Deliberately NOT gated on GEM_BAG_LIMIT: that cap exists to auto-salvage new DROPS, and
  // burning a gem the player already owns because they moved it is never the right trade.
  (profile.gemBag ??= []).push(removed!);
  profile.supports = supports;
  saveCharacters(chars);
  logRpgEvent(guildId, {
    kind: "gem_equip",
    userId,
    skillGem: profile.skillGem?.defId,
    supports: (profile.supports ?? []).map((s) => s.defId),
  });
  return { ok: true, name: SUPPORT_BY_ID[removed!.defId]?.name ?? removed!.defId };
}

// Trade the DUPLICATE copies of one gem type in the bag for 🔩, keeping that type's best
// copy (highest level, then xp). Per-type on purpose: linking two of the same support DOES
// stack (activeSupports never dedupes by defId), so a blanket "clear all duplicates" would
// quietly delete power a build might be using. The last copy of a type is never salvageable
// — losing a gem type outright is not something one click should be able to do. Synchronous.
export function salvageGemDuplicates(
  guildId: string,
  userId: string,
  defId: string,
): { ok: true; name: string; count: number; manh: number; total: number } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const bag = profile.gemBag ?? [];
  const copies = bag.filter((g) => g.defId === defId);
  if (copies.length < 2) return { ok: false, reason: "Loại gem đó không còn bản trùng trong bag bro — mở lại `/rpg skills` nhe." };
  const keep = copies.reduce((best, g) => (g.level > best.level || (g.level === best.level && g.xp > best.xp) ? g : best));
  profile.gemBag = bag.filter((g) => g === keep || g.defId !== defId);
  const count = copies.length - 1;
  const manh = count * GEM_SALVAGE_SHARDS;
  profile.materials.manh = (profile.materials.manh ?? 0) + manh;
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "gem_salvage", userId, defId, count, manh });
  return { ok: true, name: SUPPORT_BY_ID[defId]?.name ?? SKILL_BY_ID[defId]?.name ?? defId, count, manh, total: profile.materials.manh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cây tiềm năng (passive tree) — browse the clusters, allocate one point at a time.
// Points = passivePointsTotal(level, prestige) − allocated. A cluster is a short chain
// (entry → mid → notable); canAllocate enforces the prereq chain + point budget.
// ─────────────────────────────────────────────────────────────────────────────

function treePanel(profile: RpgProfile, guildId: string, userId: string, clusterId?: string): ContainerBuilder {
  const allocated = sanitizePassives(profile.passives ?? []);
  const total = passivePointsTotal(profile.level, profile.prestigeLevel);
  const left = total - allocated.length;
  const container = new ContainerBuilder().setAccentColor(CLASS_COLOR[profile.cls]);

  if (!clusterId) {
    // Cluster overview: each cluster with how many of its nodes are allocated.
    const lines = PASSIVE_CLUSTERS.map((c) => {
      const nodes = NODES_BY_CLUSTER[c.id] ?? [];
      const got = nodes.filter((n) => allocated.includes(n.id)).length;
      return `${c.emoji} **${c.name}** — ${got}/${nodes.length} node`;
    });
    container.addTextDisplayComponents(
      text(
        [
          "## 🌳 Passive Tree",
          `🔹 Điểm còn lại: **${left}** / ${total} (mỗi cấp +1 điểm; mỗi lần Prestige +3)`,
          "",
          ...lines,
          "",
          "-# Chọn một cluster bên dưới để xem & học node, hoặc mở web để pan/zoom cả cây + xem túi đồ. Prestige sẽ hoàn lại toàn bộ điểm.",
        ].join("\n"),
      ),
    ).addSeparatorComponents(divider());
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:tree:cluster").setPlaceholder("🌳 Chọn cluster để xem").addOptions(
          PASSIVE_CLUSTERS.map((c) => new StringSelectMenuOptionBuilder().setLabel(c.name).setEmoji(c.emoji).setValue(c.id)),
        ),
      ),
    );
    // Web view (fresh 30-min owner-scoped link) + Respec (only when there's something to refund).
    const webRow = new ActionRowBuilder<ButtonBuilder>();
    if (allocated.length > 0) {
      webRow.addComponents(
        new ButtonBuilder().setCustomId("rpg:tree:respec").setStyle(ButtonStyle.Danger).setEmoji("♻️").setLabel("Respec"),
      );
    }
    webRow.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setEmoji("🌳")
        .setLabel("Mở cây kỹ năng (web)")
        .setURL(`${config.publicBaseUrl}/rpg/tree/${signLink(guildId, userId)}`),
    );
    container.addActionRowComponents(webRow);
    return container;
  }

  // Cluster detail: list the nodes in chain order, mark allocated / available / locked.
  const cluster = PASSIVE_CLUSTERS.find((c) => c.id === clusterId) ?? PASSIVE_CLUSTERS[0]!;
  const nodes = NODES_BY_CLUSTER[cluster.id] ?? [];
  const nodeLines = nodes.map((n) => {
    const owned = allocated.includes(n.id);
    const check = canAllocate(allocated, n.id, left);
    const tag = owned ? "✅ đã học" : check.ok ? "🔓 học được" : `🔒 ${check.reason ?? "khoá"}`;
    const mark = n.keystone ? "💠 " : n.notable ? "⭐ " : "";
    const down = n.keystone ? passiveParts(n.mods).down : [];
    const downLine = down.length ? `\n　⚠️ Đánh đổi: ${down.join(" · ")}` : "";
    return `${mark}**${n.name}** — ${tag}${downLine}`;
  });
  container.addTextDisplayComponents(
    text(
      [
        `## 🌳 ${cluster.emoji} ${cluster.name}`,
        `🔹 Điểm còn lại: **${left}** / ${total}`,
        "",
        ...nodeLines,
      ].join("\n"),
    ),
  ).addSeparatorComponents(divider());

  // Allocate select — only the nodes that can be allocated right now.
  const allocatable = nodes.filter((n) => canAllocate(allocated, n.id, left).ok);
  if (allocatable.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:tree:alloc").setPlaceholder("🔓 Học một node").addOptions(
          allocatable.slice(0, 25).map((n) => new StringSelectMenuOptionBuilder().setLabel(n.name.slice(0, 100)).setEmoji(n.keystone ? "💠" : n.notable ? "⭐" : "🔹").setValue(n.id)),
        ),
      ),
    );
  }
  // Back-to-overview button.
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rpg:tree:back").setLabel("Xem toàn tree").setEmoji("↩️").setStyle(ButtonStyle.Secondary),
    ),
  );
  return container;
}

// Allocate one node. Re-validates against canAllocate with the freshly-loaded profile so a
// double-click can't overspend. Synchronous. Exported: the web page (src/rpg-web.ts, via
// server.ts) reuses this exact path so Discord and the browser share one source of truth.
// Guards a missing profile — the web link can be minted then the profile wiped (season
// reset / left server) before it's opened, and a bare `chars[userId]!` would crash here.
export function allocateNode(guildId: string, userId: string, nodeId: string): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "Chưa có nhân vật — dùng /rpg create trước nhe." };
  const allocated = sanitizePassives(profile.passives ?? []);
  const total = passivePointsTotal(profile.level, profile.prestigeLevel);
  const left = total - allocated.length;
  const check = canAllocate(allocated, nodeId, left);
  if (!check.ok) return { ok: false, reason: check.reason ?? "Không học được nút này." };
  allocated.push(nodeId);
  profile.passives = allocated;
  saveCharacters(chars);
  logRpgEvent(guildId, {
    kind: "passive_alloc",
    userId,
    node: nodeId,
    cluster: NODE_BY_ID[nodeId]?.cluster,
    keystone: !!NODE_BY_ID[nodeId]?.keystone,
  });
  return { ok: true, name: NODE_BY_ID[nodeId]?.name ?? nodeId };
}

// Respec ONE node (refund its point) — blocked if a still-allocated node depends on it.
// Free, synchronous; shared by the web page + the Discord panel. Same guard shape as allocate.
export function deallocateNode(guildId: string, userId: string, nodeId: string): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "Chưa có nhân vật — dùng /rpg create trước nhe." };
  const allocated = sanitizePassives(profile.passives ?? []);
  const check = canDeallocate(allocated, nodeId);
  if (!check.ok) return { ok: false, reason: check.reason ?? "Không tháo được node này." };
  profile.passives = allocated.filter((id) => id !== nodeId);
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "passive_dealloc", userId, node: nodeId });
  return { ok: true, name: NODE_BY_ID[nodeId]?.name ?? nodeId };
}

// Respec EVERYTHING — refund all allocated points (free; the points come back from level/prestige
// so nothing is minted). Returns how many were refunded.
export function respecPassives(guildId: string, userId: string): { ok: true; refunded: number } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "Chưa có nhân vật — dùng /rpg create trước nhe." };
  const refunded = (profile.passives ?? []).length;
  profile.passives = [];
  saveCharacters(chars);
  if (refunded > 0) logRpgEvent(guildId, { kind: "passive_respec", userId, refunded });
  return { ok: true, refunded };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bình (flasks) — equip/unequip flasks from the FLASKS catalog. Minimal: every flask is
// freely available (not looted), so this is a straightforward carried-set toggle.
// ─────────────────────────────────────────────────────────────────────────────

function flaskPanel(profile: RpgProfile): ContainerBuilder {
  const carried = profile.flasks ?? [];
  const carriedIds = new Set(carried.map((f) => f.defId));
  const lines = FLASKS.map((f) => {
    const on = carriedIds.has(f.id);
    return `${on ? "✅" : "⬜"} ${f.emoji} **${f.name}** — ${f.blurb}`;
  });
  const container = new ContainerBuilder()
    .setAccentColor(CLASS_COLOR[profile.cls])
    .addTextDisplayComponents(
      text(
        [
          "## 🧪 Flask",
          "Life Flask hồi máu giữa các floor, utility flask cho buff suốt map. Chọn flask để mang theo (bật/tắt).",
          "",
          ...lines,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("rpg:flask:toggle")
          .setPlaceholder("🧪 Chọn flask mang theo")
          .setMinValues(0)
          .setMaxValues(FLASKS.length)
          .addOptions(
            FLASKS.map((f) =>
              new StringSelectMenuOptionBuilder().setLabel(f.name).setEmoji(f.emoji).setDescription(f.blurb.slice(0, 100)).setValue(f.id).setDefault(carriedIds.has(f.id)),
            ),
          ),
      ),
    );
  return container;
}

// Set the carried flask set to exactly the chosen defIds (order preserved by FLASKS). Ignores
// unknown ids. Synchronous.
function setFlasks(userId: string, defIds: string[]): void {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const chosen = new Set(defIds.filter((id) => FLASK_BY_ID[id]));
  profile.flasks = FLASKS.filter((f) => chosen.has(f.id)).map((f) => ({ defId: f.id }));
  saveCharacters(chars);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bàn đồ (map device) — the stage list + weekly rule + a 🔺 tier select + a region select that
// đi ải. The tier select re-renders the panel; the region select value carries the chosen tier
// as "<regionId>:<tier>" into dispatch. The map tier + rollable map-mods (rpg-maps.ts) are then
// frozen at dispatch inside startExpedition; the panel is the whole "where do I go" surface.
// ─────────────────────────────────────────────────────────────────────────────

const THEME_LABEL: Record<string, string> = {
  phys: "⚔️ Physical",
  fire: "🔥 Fire",
  cold: "❄️ Cold",
  light: "⚡ Lightning",
  chaos: "☠️ Chaos",
};

// The hero's earned map-tier cap — 1 tier per 5 floors of their deepest-ever clear (see
// maxTierFor). The one chokepoint the panel, its tier select, and the /rpg map slash all read.
function heroMaxTier(profile: RpgProfile): number {
  return maxTierFor(deepestFloor(profile)); // same "deepest floor" metric the Atlas points read
}

function mapPanel(profile: RpgProfile, tier = 1): ContainerBuilder {
  const maxTier = heroMaxTier(profile);
  const t = Math.max(1, Math.min(maxTier, Math.round(tier))); // clamp the chosen tier to what's earned
  const mt = mapTier(t);
  const mod = currentModifier();
  const lines = STAGES.map((s) => {
    const unlocked = stageUnlocked(profile, s);
    const best = profile.bestFloor[s.id] ?? 0;
    const bias = s.materialBias
      ? Object.keys(s.materialBias)
          .map((id) => MATERIALS[id as MaterialId].emoji)
          .join("")
      : "🎁";
    const gate = unlocked
      ? `✅ Đã mở${best > 0 ? ` · record floor ${best}` : ""}`
      : `🔒 Cần floor ${s.unlockAt?.floor} ở ${STAGE_BY_ID[s.unlockAt?.stage ?? ""]?.name ?? "region trước"}`;
    // Show what this region+tier actually pays a hero of THIS level, so the out-levelling
    // penalty is a visible choice rather than a silent tax discovered after the run.
    const pay = rewardMultiplier(profile.level, s, t);
    const payNote =
      pay >= 0.999
        ? "💰 thưởng đầy đủ"
        : `⚠️ chỉ **${Math.round(pay * 100)}%** 🪙/✨ (dưới tầm bro — lên Tier hoặc chọn ải sâu hơn để ăn đủ)`;
    return `${s.emoji} **${s.name}** — farm ${bias} · theme ${THEME_LABEL[s.theme] ?? s.theme}\n-# ${gate} · ${payNote}`;
  });
  const atlasSpend = atlasPointsSpendable(profile);
  const atlasTotal = atlasPointsTotal(profile);
  const body = [
    "## 🗺️ Atlas (Map Device)",
    `📜 **Luật tuần này:** ${mod.emoji} ${mod.name} — ${mod.blurb}`,
    `🗺️ **Atlas point:** ${atlasSpend} rảnh / ${atlasTotal} tổng${atlasSpend > 0 ? " — có điểm chưa tiêu, mở Atlas Tree đi bro!" : ""}`,
    `🔺 **Map Tier T${t}** — quái mạnh ×${mt.diff.toFixed(2)} · loot ×${mt.loot.toFixed(2)} (tối đa T${maxTier}, mở thêm bằng cách cày sâu)`,
    "",
    ...lines,
    "",
    "-# Chọn Tier (khó hơn = loot cao hơn) rồi chọn region để chạy. Hero tự đem hết 🍖 + 🧪. Mỗi region mở khi đạt floor 15 region trước.",
    "-# 💡 Cày ải quá dễ so với cấp thì 🪙 vàng & ✨ Essence bị cắt; đi sâu hơn record cũ thì được **+35%** hai thứ đó.",
  ].join("\n");
  const unlocked = STAGES.filter((s) => stageUnlocked(profile, s));
  const container = new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider());
  // Tier select — only when the hero has earned more than T1 (else it's noise). Re-renders the
  // panel with the chosen tier; the region select below carries that tier into the dispatch.
  if (maxTier > 1) {
    const tierOpts = Array.from({ length: maxTier }, (_, i) => i + 1).map((n) => {
      const mti = mapTier(n);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`Tier ${n} — quái ×${mti.diff.toFixed(2)} · loot ×${mti.loot.toFixed(2)}`.slice(0, 100))
        .setEmoji("🔺")
        .setValue(String(n))
        .setDefault(n === t);
    });
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:map:tier").setPlaceholder(`🔺 Map Tier (đang T${t})`).addOptions(tierOpts.slice(0, 25)),
      ),
    );
  }
  if (unlocked.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("rpg:map:region").setPlaceholder(`🗺️ Chọn region để chạy (T${t})`).addOptions(
          // value = "<regionId>:<tier>" so the region pick carries the chosen tier into dispatch.
          unlocked.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.name).setEmoji(s.emoji).setValue(`${s.id}:${t}`)),
        ),
      ),
    );
  }
  // 🗺️ Atlas Tree — the endgame farming meta-tree, opened in place from this surface.
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rpg:atlas:open").setLabel("Atlas Tree").setEmoji("🗺️").setStyle(ButtonStyle.Primary),
    ),
  );
  return container;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atlas Tree — the endgame farming meta-tree (rpg-atlas.ts). A flat pickable list of
// loot-multiplier nodes; points are DERIVED from the deepest floor (1 per 5 floors) and
// survive a Prestige. Each node shows allocated ✅ / available 🔓 / need-more-points 🔒;
// an allocate select fires rpg:atlas:alloc:<id>. Mirrors the passive-tree panel.
// ─────────────────────────────────────────────────────────────────────────────

function atlasTreePanel(profile: RpgProfile): ContainerBuilder {
  const allocated = profile.atlasNodes ?? [];
  const total = atlasPointsTotal(profile);
  const spendable = atlasPointsSpendable(profile);
  const agg = aggregateAtlas(allocated);
  const nodeLines = ATLAS_NODES.map((n) => {
    const owned = allocated.includes(n.id);
    const tag = owned ? "✅ đã học" : canAllocateAtlas(profile, n.id) ? "🔓 học được" : "🔒 chưa đủ điểm";
    return `${n.emoji} **${n.name}** — ${n.blurb}\n-# ${tag}`;
  });
  const bonusLine = [
    `📦 loot ×${agg.lootMul.toFixed(2)}`,
    `🟤 unique ×${agg.uniqueMul.toFixed(2)}`,
    `🔩 shard ×${agg.shardMul.toFixed(2)}`,
    `🪙 gold ×${agg.goldMul.toFixed(2)}`,
  ].join(" · ");
  const ks = ownedAtlasKeystone(profile);
  const ksLine = ks
    ? `🌟 **Farmer identity:** ${ks.emoji} ${ks.name} — ${ks.blurb.replace("KEYSTONE · ", "")}`
    : `🌟 **Keystone:** chưa chọn — pick 1 trong 3 hướng farmer (mở khi có ≥5 điểm). Đổi hướng = Respec.`;
  const body = [
    "## 🗺️ Atlas Tree",
    `🔹 Điểm còn lại: **${spendable}** / ${total} (cứ mỗi 5 floor sâu nhất = +1 điểm; sống qua mọi lần Prestige)`,
    `📈 **Bonus hiện tại:** ${bonusLine}`,
    ksLine,
    "",
    ...nodeLines,
    "",
    "-# Chọn node bên dưới để học — tăng loot farm khi đi ải. Keystone chỉ chọn được MỘT (đánh đổi thật). Đi sâu hơn để mở thêm điểm nhe bro.",
  ].join("\n");
  const container = new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider());
  const allocatable = ATLAS_NODES.filter((n) => canAllocateAtlas(profile, n.id));
  if (allocatable.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("rpg:atlas:alloc")
          .setPlaceholder("🔓 Học một node Atlas")
          .addOptions(
            allocatable
              .slice(0, 25)
              .map((n) => new StringSelectMenuOptionBuilder().setLabel(n.name.slice(0, 100)).setEmoji(n.emoji).setDescription(n.blurb.slice(0, 100)).setValue(n.id)),
          ),
      ),
    );
  }
  // Respec — clear the whole allocation (points refund to spendable) for a coin burn, so a
  // farmer can switch keystone/identity. Only offered once something is allocated.
  if (allocated.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("rpg:atlas:respec").setLabel(`Respec Atlas (−${ATLAS_RESPEC_COST} 🪙)`).setEmoji("♻️").setStyle(ButtonStyle.Secondary),
      ),
    );
  }
  return container;
}

const ATLAS_RESPEC_COST = 500; // coin burn to wipe the atlas allocation (a sink; the points themselves refund)

// Respec the whole Atlas allocation for a coin burn — clears atlasNodes (points return to
// spendable) so a player can switch farmer keystone/identity. Synchronous load→mutate→save;
// the coins are BURNED (never re-minted), the allocation just resets. Pure-ish imperative shell.
function respecAtlasCore(guildId: string, userId: string): { ok: true; refunded: number; balance: number } | { ok: false; reason: string } {
  const profile = loadCharacters()[userId];
  if (!profile) return { ok: false, reason: NO_CHARACTER };
  const allocated = (profile.atlasNodes ?? []).length;
  if (allocated === 0) return { ok: false, reason: "Chưa học node Atlas nào để respec bro." };
  const coins = loadCoins();
  const bal = coins[userId] ?? 0;
  if (bal < ATLAS_RESPEC_COST) return { ok: false, reason: `Cần **${ATLAS_RESPEC_COST}** 🪙 để respec — ví có ${bal}.` };
  // Coins first (burn), then clear — a crash between leaves points un-refunded rather than free.
  coins[userId] = bal - ATLAS_RESPEC_COST;
  saveCoins(coins);
  const chars = loadCharacters();
  chars[userId]!.atlasNodes = [];
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "atlas_alloc", userId, node: "respec" });
  return { ok: true, refunded: allocated, balance: coins[userId]! };
}

// Allocate one Atlas node. Re-validates against canAllocateAtlas with the freshly-loaded
// profile so a double-click can't overspend the derived points. Synchronous load→mutate→save.
function allocateAtlasNode(guildId: string, userId: string, nodeId: string): { ok: true; name: string } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { ok: false, reason: "Chưa có nhân vật — dùng /rpg create trước nhe." };
  if (!canAllocateAtlas(profile, nodeId)) {
    const owned = (profile.atlasNodes ?? []).includes(nodeId);
    return { ok: false, reason: owned ? "Node này học rồi bro." : "Chưa đủ Atlas point — đi ải sâu hơn để mở thêm điểm nhe." };
  }
  profile.atlasNodes = [...(profile.atlasNodes ?? []), nodeId];
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "atlas_alloc", userId, node: nodeId });
  return { ok: true, name: ATLAS_BY_ID[nodeId]?.name ?? nodeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tái Sinh (prestige) + the Cổ Ngọc perk shop — the meta screen.
// ─────────────────────────────────────────────────────────────────────────────

function taisinhPanel(profile: RpgProfile): ContainerBuilder {
  const eligible = canPrestige(profile);
  const power = powerScore(profile);
  const reward = prestigeReward(power);
  const perkLines = (Object.keys(PERKS) as PerkId[]).map((id) => {
    const perk = PERKS[id];
    const level = profile.perks?.[id] ?? 0;
    const maxed = level >= perk.maxLevel;
    return `${perk.emoji} **${perk.name}** — Lv${level}/${perk.maxLevel} · ${perk.blurb}\n-# ${maxed ? "đã tối đa" : `nâng: ${perkCost(id, level)} 🔮`}`;
  });

  const body = [
    "## 🌟 Prestige & Jewel",
    `🔮 Jewel đang có: **${profile.coNgoc}** · Đã prestige: **${profile.prestigeLevel}** lần`,
    "",
    `💪 Power hiện tại: **${power.toLocaleString()}** → thưởng prestige **+${reward}** 🔮 (càng mạnh càng nhiều Jewel).`,
    eligible
      ? `✅ Đủ điều kiện Prestige — reset cấp/gear/material/passive tree để nhận **+${reward}** 🔮 Jewel (giữ class, Jewel, perk, region records).`
      : `🔒 Chưa đủ điều kiện — cần đạt **floor ${PRESTIGE_FLOOR}** kể từ lần prestige gần nhất (hoặc lên cấp tối đa ${MAX_LEVEL}).`,
    "",
    "**Perk vĩnh viễn** (mua bằng Jewel, sống qua mọi lần prestige):",
    ...perkLines,
  ].join("\n");

  const perkIds = Object.keys(PERKS) as PerkId[];
  const container = new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...perkIds.map((id) =>
          new ButtonBuilder()
            .setCustomId(`rpg:char:perk:${id}`)
            .setLabel(PERKS[id].name.replace(/^Jewel of /, ""))
            .setEmoji(PERKS[id].emoji)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((profile.perks?.[id] ?? 0) >= PERKS[id].maxLevel || profile.coNgoc < perkCost(id, profile.perks?.[id] ?? 0)),
        ),
      ),
    );
  if (eligible) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("rpg:char:prestige_confirm").setLabel(`Prestige ngay (+${reward} 🔮)`).setEmoji("🌟").setStyle(ButtonStyle.Danger),
      ),
    );
  }
  return container;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ascendancy (subclass) — the PoE second-class choice. Unlocked by ASCENDANCY_FLOOR /
// ASCENDANCY_LEVEL; the panel shows the 2 options for the class + a pick button each
// (re-pickable freely). Reached from the hero sheet (rpg:asc:open); pick = rpg:asc:pick:<id>.
// ─────────────────────────────────────────────────────────────────────────────

// A compact one-line render of an ascendancy's RawBuild effect slice (the panel's "what it
// does" summary). Reads the same %-vs-flat convention as the gear stat line.
function ascEffectLine(def: AscendancyDef): string {
  const e = def.effects;
  const parts: string[] = [];
  if (e.lifePct) parts.push(`❤️+${pct(e.lifePct)} Life`);
  if (e.esPct) parts.push(`🔷+${pct(e.esPct)} ES`);
  if (e.armourPct) parts.push(`🛡️+${pct(e.armourPct)} Armour`);
  if (e.evasionPct) parts.push(`💨+${pct(e.evasionPct)} Evasion`);
  if (e.atkPct) parts.push(`🗡️+${pct(e.atkPct)} Attack`);
  if (e.spellPct) parts.push(`🔮+${pct(e.spellPct)} Spell`);
  if (e.speedPct) parts.push(`⚡+${pct(e.speedPct)} Speed`);
  if (e.crit) parts.push(`🎯+${pct(e.crit)} Crit`);
  if (e.critMulti) parts.push(`💥+${pct(e.critMulti)} Crit DMG`);
  if (e.elePct) {
    for (const el of ELEMS) {
      const v = e.elePct[el];
      if (v) parts.push(`${ELEM_EMOJI[el]}+${pct(v)}`);
    }
  }
  if (e.addChaos) parts.push(`☠️+${Math.round(e.addChaos)} Chaos`);
  if (e.resChaos) parts.push(`☠️+${pct(e.resChaos)} Chaos Res`);
  const anyRes = (e.resFire ?? 0) || (e.resCold ?? 0) || (e.resLight ?? 0);
  if (anyRes) parts.push(`🔰+${pct(anyRes)} Ele Res`);
  if (e.ailment) {
    const ail = Object.entries(e.ailment).filter(([, v]) => v);
    if (ail.length) parts.push(`✨+ ailment chance`);
  }
  return parts.join(" · ") || "—";
}

function ascendancyPanel(profile: RpgProfile): ContainerBuilder {
  const unlocked = ascendancyUnlocked(profile);
  const options = ascendanciesForClass(profile.cls);
  const chosen = chosenAscendancy(profile.cls, profile.ascendancy);
  const container = new ContainerBuilder().setAccentColor(CLASS_COLOR[profile.cls]);

  const head = [
    "## ⭐ Ascendancy — Chọn phân nhánh (subclass)",
    unlocked
      ? chosen
        ? `Đang chọn: ${chosen.emoji} **${chosen.name}**. Đổi tự do bất cứ lúc nào nhe bro.`
        : "Đã mở khoá — chọn 1 trong 2 nhánh dưới đây. Đổi lại lúc nào cũng được."
      : `🔒 Chưa mở khoá — cần đạt **floor ${ASCENDANCY_FLOOR}** (bất kỳ region) hoặc lên **Lv${ASCENDANCY_LEVEL}**. Cày thêm rồi quay lại nhe bro.`,
  ];

  const optBlocks = options.map((def) => {
    const active = chosen?.id === def.id;
    return [
      `${active ? "✅ " : ""}${def.emoji} **${def.name}**${active ? " *(đang chọn)*" : ""}`,
      `-# ${def.blurb}`,
      `📊 ${ascEffectLine(def)}`,
      `🔑 **${def.keystoneName}** — ${def.keystoneText}`,
    ].join("\n");
  });

  container.addTextDisplayComponents(text([...head, "", optBlocks.join("\n\n")].join("\n")));

  if (unlocked) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...options.map((def) =>
          new ButtonBuilder()
            .setCustomId(`rpg:asc:pick:${def.id}`)
            .setLabel(chosen?.id === def.id ? `${def.name} ✓` : `Chọn ${def.name}`)
            .setEmoji(def.emoji)
            .setStyle(chosen?.id === def.id ? ButtonStyle.Success : ButtonStyle.Primary),
        ),
      ),
    );
  }
  return container;
}

// Set the chosen ascendancy — re-validated against the unlock gate + class match with the
// freshly-loaded profile (so a click can't slip a locked/wrong-class pick through). Synchronous.
function pickAscendancy(guildId: string, userId: string, ascId: string): { ok: true; def: AscendancyDef } | { ok: false; reason: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  if (!ascendancyUnlocked(profile)) {
    return { ok: false, reason: `Ascendancy chưa mở khoá — cần floor ${ASCENDANCY_FLOOR} hoặc Lv${ASCENDANCY_LEVEL} bro.` };
  }
  const def = ASCENDANCY_BY_ID[ascId];
  if (!def || def.cls !== profile.cls) return { ok: false, reason: "Nhánh này không thuộc class của bro." };
  profile.ascendancy = ascId;
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "ascendancy_chosen", userId, cls: profile.cls, ascendancy: ascId });
  return { ok: true, def };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auras & Curses (rpg-auras) — the Spirit-reserved self-buff loadout + the single enemy hex.
// Reached from the hero sheet (rpg:aura:open). Both are freely swappable select menus:
// rpg:aura:set (multi, bounded by the Spirit budget) and rpg:aura:curse (single). No unlock gate —
// a fresh hero can run auras/curse from the start (they're part of the base kit).
// ─────────────────────────────────────────────────────────────────────────────

// A compact one-line render of an aura's RawBuild effect slice (same %-vs-flat convention
// as the ascendancy effect line).
function auraEffectLine(id: string): string {
  const e = AURA_BY_ID[id]?.effects;
  if (!e) return "—";
  const parts: string[] = [];
  if (e.armourPct) parts.push(`🛡️+${pct(e.armourPct)} Armour`);
  if (e.evasionPct) parts.push(`💨+${pct(e.evasionPct)} Evasion`);
  if (e.esPct) parts.push(`🔷+${pct(e.esPct)} ES`);
  if (e.atkPct) parts.push(`🗡️+${pct(e.atkPct)} Attack`);
  if (e.spellPct) parts.push(`🔮+${pct(e.spellPct)} Spell`);
  if (e.speedPct) parts.push(`⚡+${pct(e.speedPct)} Speed`);
  if (e.crit) parts.push(`🎯+${pct(e.crit)} Crit`);
  if (e.critMulti) parts.push(`💥+${pct(e.critMulti)} Crit DMG`);
  if (e.elePct) {
    for (const el of ELEMS) {
      const v = e.elePct[el];
      if (v) parts.push(`${ELEM_EMOJI[el]}+${pct(v)}`);
    }
  }
  return parts.join(" · ") || "—";
}

function aurasCursesPanel(profile: RpgProfile): ContainerBuilder {
  const spirit = effectiveBuild(profile).spirit;
  const spiritTotal = spirit.total;
  const reserved = spirit.reserved;
  // Highlight what the player SELECTED, not just what fits — an aura queued beyond the
  // current budget should still show as chosen so they can see what gearing would unlock.
  const activeIds = new Set(profile.auras ?? []);
  const curseId = profile.curse;

  const auraBlocks = AURAS.map((a) => {
    const on = activeIds.has(a.id);
    return [`${on ? "✅" : "⬜"} ${a.emoji} **${a.name}** 🕯️${a.spirit} — ${a.blurb}`, `-# 📊 ${auraEffectLine(a.id)}`].join("\n");
  });
  const curseBlocks = CURSES.map((c) => {
    const on = curseId === c.id;
    return `${on ? "✅" : "⬜"} ${c.emoji} **${c.name}** — ${c.blurb}`;
  });

  const body = [
    "## 🔮 Auras & Curses",
    `**✨ Auras** — mỗi aura **giữ Linh Lực** 🕯️. Bro đang có **${spiritTotal}** (dùng **${reserved}**). Bật bao nhiêu là tuỳ Linh Lực, không giới hạn số lượng.`,
    ...auraBlocks,
    "",
    "**🎯 Curse** — yểm 1 lời nguyền lên MỌI quái trong chuyến đi (chọn khi đi ải mới có hiệu lực).",
    ...curseBlocks,
  ].join("\n");

  return new ContainerBuilder()
    .setAccentColor(CLASS_COLOR[profile.cls])
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("rpg:aura:set")
          .setPlaceholder("✨ Chọn aura mang theo (tuỳ Linh Lực)")
          .setMinValues(0)
          .setMaxValues(AURAS.length)
          .addOptions(
            AURAS.map((a) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${a.name} — 🕯️${a.spirit}`)
                .setEmoji(a.emoji)
                .setDescription(a.blurb.slice(0, 100))
                .setValue(a.id)
                .setDefault(activeIds.has(a.id)),
            ),
          ),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("rpg:aura:curse")
          .setPlaceholder("🎯 Chọn curse yểm lên quái (0-1)")
          .setMinValues(0)
          .setMaxValues(1)
          .addOptions(
            CURSES.map((c) =>
              new StringSelectMenuOptionBuilder().setLabel(c.name).setEmoji(c.emoji).setDescription(c.blurb.slice(0, 100)).setValue(c.id).setDefault(curseId === c.id),
            ),
          ),
      ),
    );
}

// Store exactly the chosen aura ids (order preserved by AURAS). There is no cap here on
// purpose: the Spirit budget decides which of them actually run (effectiveBuild), so a
// player can queue an expensive aura and have it switch on the moment gear affords it.
function setAuras(userId: string, auraIds: string[]): void {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const chosen = new Set(auraIds.filter((id) => AURA_BY_ID[id]));
  profile.auras = AURAS.filter((a) => chosen.has(a.id)).map((a) => a.id);
  saveCharacters(chars);
}

// Set (or clear) the equipped curse to a single chosen id. An empty selection or unknown id
// clears the curse. Synchronous.
function setCurse(userId: string, curseId: string | undefined): void {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  profile.curse = curseId && CURSE_BY_ID[curseId] ? curseId : undefined;
  saveCharacters(chars);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gear management cores (equip / unequip / salvage) — synchronous, coin-free.
// ─────────────────────────────────────────────────────────────────────────────

function equipItem(
  userId: string,
  itemId: string,
): { ok: true; item: GearItem; replaced: GearItem | null } | { ok: false; reason: "gone" | "already" } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const idx = profile.bag.findIndex((g) => g.id === itemId);
  if (idx < 0) {
    if (findItem(profile, itemId)?.inBag === false) return { ok: false, reason: "already" };
    return { ok: false, reason: "gone" };
  }
  const [item] = profile.bag.splice(idx, 1);
  const replaced = profile.gear[item!.slot] ?? null;
  profile.gear[item!.slot] = item!;
  if (replaced) profile.bag.push(replaced); // swap the old piece back to the bag (count neutral)
  profile.tutorial = markTutorial(profile.tutorial ?? 0, TutorialStep.Equip);
  saveCharacters(chars);
  return { ok: true, item: item!, replaced };
}

function unequipSlot(
  userId: string,
  slot: GearSlot,
): { ok: true; item: GearItem } | { ok: false; reason: "empty" | "bagfull" } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const item = profile.gear[slot];
  if (!item) return { ok: false, reason: "empty" };
  if (profile.bag.length >= BAG_LIMIT) return { ok: false, reason: "bagfull" };
  delete profile.gear[slot];
  profile.bag.push(item);
  saveCharacters(chars);
  return { ok: true, item };
}

function salvageItem(
  guildId: string,
  userId: string,
  itemId: string,
): { ok: true; item: GearItem; manh: number; total: number } | { ok: false; reason: "gone" } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const idx = profile.bag.findIndex((g) => g.id === itemId);
  if (idx < 0) return { ok: false, reason: "gone" }; // only bag items are salvageable
  const [item] = profile.bag.splice(idx, 1);
  const manh = salvageYield(item!).manh;
  profile.materials.manh = (profile.materials.manh ?? 0) + manh;
  saveCharacters(chars);
  logRpgEvent(guildId, { kind: "salvage", userId, rarity: item!.rarity, plus: item!.plus, manh });
  return { ok: true, item: item!, manh, total: profile.materials.manh };
}

// A select menu over gear items for an action; each option's value is the item id.
function gearSelectRow(
  action: "selequip" | "selenh" | "selsalv" | "selghep",
  placeholder: string,
  items: { item: GearItem; desc: string }[],
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = items.slice(0, 25).map(({ item, desc }) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(gearPlainName(item).slice(0, 100))
      .setDescription(desc.slice(0, 100))
      .setValue(item.id),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(`rpg:do:${action}`).setPlaceholder(placeholder).addOptions(options),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Farm-gold / cut-friction UI — the NPC bán-rác panel, one-click best-in-slot, bulk
// phân-rã. The three "trở xuống" rarity tiers are the ONLY bulk selectors: Sử Thi/Huyền
// (rarity ≥ 3) never get a bulk button, so top gear can't be fat-fingered away.
// ─────────────────────────────────────────────────────────────────────────────

const BULK_RARITY_TIERS: { rarity: Rarity; label: string; emoji: string }[] = [
  { rarity: 0, label: "Normal trở xuống", emoji: "⚪" },
  { rarity: 1, label: "Magic trở xuống", emoji: "🟢" },
  { rarity: 2, label: "Rare trở xuống", emoji: "🔵" },
];

function bulkRarityRow(prefix: string, verb: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...BULK_RARITY_TIERS.map((t) =>
      new ButtonBuilder()
        .setCustomId(`${prefix}:${t.rarity}`)
        .setLabel(`${verb} ${t.label}`)
        .setEmoji(t.emoji)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

function banSellRow(bag: GearItem[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = bag.slice(0, 25).map((it) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(gearPlainName(it).slice(0, 100))
      .setDescription(`💰 ${npcSellPrice(it)} 🪙 · ${GEAR_SLOTS.find((s) => s.id === it.slot)?.name}`.slice(0, 100))
      .setValue(it.id),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId("rpg:ban:one").setPlaceholder("🏷️ Bán một món cụ thể").addOptions(options),
  );
}

function banShopPanel(profile: RpgProfile): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0xf1c40f);
  if (profile.bag.length === 0) {
    container.addTextDisplayComponents(text("## 🏪 Bán rác cho NPC\nBag trống trơn bro — `/rpg map` cày đồ đã nhe."));
    return container;
  }
  const body = [
    "## 🏪 Bán rác cho NPC",
    "Bán nhanh gear thừa lấy coin liền. Bấm nút để **bán hàng loạt** theo rarity, hoặc chọn từng món ở menu (đồ đang mặc luôn an toàn; đồ xịn 🟣 Epic / 🟠 Legendary không bán hàng loạt để khỏi lỡ tay).",
    `-# 💰 Giá NPC thấp hơn market người chơi — chỉ để thanh lý rác.`,
  ].join("\n");
  container
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(banSellRow(profile.bag))
    .addActionRowComponents(bulkRarityRow("rpg:ban:sell", "Bán"));
  return container;
}

function salvagePanel(profile: RpgProfile): ContainerBuilder {
  const items = profile.bag.map((it) => ({
    item: it,
    desc: `${it.uniqueId ? "🟤 Unique" : RARITIES[it.rarity].name} → ${MATERIALS.manh.emoji} ${salvageYield(it).manh}`,
  }));
  return new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(
      text(
        "## ♻️ Salvage đồ thừa\nChọn một món để salvage lấy 🔩 Shard, hoặc **Salvage rác** hàng loạt theo rarity (đồ đang mặc luôn an toàn; đồ 🟣 Epic / 🟠 Legendary không salvage hàng loạt).",
      ),
    )
    .addActionRowComponents(gearSelectRow("selsalv", "♻️ Chọn đồ để salvage", items))
    .addSeparatorComponents(divider())
    .addActionRowComponents(bulkRarityRow("rpg:do:bulksalv", "Salvage"));
}

function sellResultNotice(r: SellResult): string {
  if (r.sold.length === 0) return "## 🏪 Bán rác\nKhông có món nào ở mức đó để bán bro.";
  const lines = r.sold.slice(0, 10).map((s) => `• ${s.name} — 💰 ${s.price} 🪙`);
  const more = r.sold.length > 10 ? `\n-# …và ${r.sold.length - 10} món nữa` : "";
  return [
    `## 🏪 Đã bán ${r.sold.length} món cho NPC`,
    lines.join("\n") + more,
    `💰 Tổng nhận **${r.coinsPaid}** 🪙${r.burned > 0 ? ` · 🔥 đốt ${r.burned} (phí)` : ""} · ví còn **${r.balance}** 🪙`,
  ].join("\n");
}

function autoEquipContainer(userId: string, r: AutoEquipView): ContainerBuilder {
  if (r.changed.length === 0) {
    return new ContainerBuilder()
      .setAccentColor(RPG_COLOR)
      .addTextDisplayComponents(
        text(`## 🎽 Auto-Equip\n<@${userId}> đã tối ưu gear sẵn rồi bro — không có gì để đổi. ⚔️ Power: **${r.after}**.`),
      );
  }
  const lines = r.changed.map((c) => {
    const slot = GEAR_SLOTS.find((s) => s.id === c.slot);
    return `${slot?.emoji} ${slot?.name}: **${c.name}**`;
  });
  return new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(
    text(
      [
        "## 🎽 Đã auto-equip!",
        `<@${userId}> tự mặc gear mạnh nhất trong bag:`,
        lines.join("\n"),
        `⚔️ Power: **${r.before} → ${r.after}** (${deltaTag(r.after - r.before)})`,
      ].join("\n"),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cường hóa (risky enhancement) — the gamble.
// ─────────────────────────────────────────────────────────────────────────────

const FAIL_WORD: Record<"down" | "break" | "stay", string> = {
  stay: "✅ An toàn tuyệt đối — fail chỉ đứng yên",
  down: "❗ Fail → **tụt 1 cấp** (đồ vẫn còn)",
  break: "💥 Fail → **VỠ, mất đồ luôn**",
};

function enhancePanel(profile: RpgProfile, item: GearItem, intro?: string): ContainerBuilder {
  if (item.plus >= MAX_PLUS) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22);
    if (intro) c.addTextDisplayComponents(text(intro)).addSeparatorComponents(divider());
    c.addTextDisplayComponents(text(`## 🔨 Enhance\n${gearName(item)} đã đạt **+${MAX_PLUS}** — kịch trần tuyệt đối rồi bro 🏆`));
    return c;
  }
  // Standing AT the ceiling (but not maxed) → the next step is a Đột Phá, not an đập.
  if (canBreakthrough(item)) return breakthroughPanel(profile, item, intro);

  const container = new ContainerBuilder().setAccentColor(0xe67e22);
  if (intro) container.addTextDisplayComponents(text(intro)).addSeparatorComponents(divider());
  const cap = gearCap(item);
  const odds = ENHANCE_TABLE[item.plus]!;
  const cost = enhanceCost(item.plus);
  const charms = profile.materials.bua ?? 0;
  const risky = odds.onFail !== "stay";
  const body = [
    "## 🔨 Enhance gear",
    `**${gearName(item)}**`,
    gearStatBlock(item),
    gearModBlock(item),
    `**+${item.plus} → +${item.plus + 1}**  ·  🔒 Trần hiện tại: **+${cap}**`,
    "",
    `🎲 Tỉ lệ thành công: **${pct(odds.up)}**`,
    FAIL_WORD[odds.onFail],
    `💸 Chi phí (đốt dù thắng/thua): ${MATERIALS.manh.emoji} ${cost.manh} + 🔥 ${cost.coins} 🪙`,
    `${MATERIALS.bua.emoji} Blessed Charm đang có: **${charms}**${risky ? " — dùng charm thì fail chỉ đứng yên" : ""}`,
    cap < MAX_PLUS ? `-# Chạm **+${cap}** thì phải **Đột Phá** (mồi + ${MATERIALS.dotpha.emoji} Đá Đột Phá + coin) mới đập tiếp.` : "",
  ].filter(Boolean).join("\n");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rpg:do:enhgo:${item.id}:plain`).setLabel("Đập tay không").setEmoji("🔨").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rpg:do:enhgo:${item.id}:charm`)
      .setLabel("Đập có charm")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!risky || charms <= 0),
    new ButtonBuilder().setCustomId("rpg:do:enhcancel").setLabel("Huỷ").setStyle(ButtonStyle.Secondary),
  );
  container.addTextDisplayComponents(text(body)).addSeparatorComponents(divider()).addActionRowComponents(row);
  return container;
}

// ─────────────────────────────────────────────────────────────────────────────
// Đột Phá (breakthrough) — the ceiling gate. Shown by enhancePanel when the item is
// standing at its cap; pay same-slot fodder + 🔶 Đá Đột Phá + coins to raise the cap +3.
// The pure gate/cost/apply live in ../rpg (canBreakthrough/breakthroughCost/breakthroughItem).
// ─────────────────────────────────────────────────────────────────────────────
function breakthroughPanel(profile: RpgProfile, item: GearItem, intro?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0xf39c12);
  if (intro) container.addTextDisplayComponents(text(intro)).addSeparatorComponents(divider());
  const cap = gearCap(item);
  if (!canBreakthrough(item)) {
    container.addTextDisplayComponents(
      text(`## 🔶 Đột Phá\n${gearName(item)} chưa chạm trần (+${item.plus}/+${cap}) — đập lên +${cap} đã rồi Đột Phá nhe bro.`),
    );
    return container;
  }
  const cost = breakthroughCost(cap);
  const next = Math.min(MAX_PLUS, cap + 3);
  const slotName = GEAR_SLOTS.find((s) => s.id === item.slot)?.name ?? item.slot;
  const stones = profile.materials.dotpha ?? 0;
  const available = profile.bag.filter((it) => it.id !== item.id && it.slot === item.slot).length;
  const enough = available >= cost.fodder && stones >= cost.dotpha;
  const body = [
    "## 🔶 Đột Phá — phá trần cường hóa",
    `**${gearName(item)}**`,
    gearStatBlock(item),
    `🔒 Trần **+${cap}** đã kịch — Đột Phá để mở trần lên **+${next}** (rồi đập tiếp bằng \`/rpg enhance\`).`,
    "",
    "Chi phí Đột Phá:",
    `• 🧩 **${cost.fodder}** món cùng ô **${slotName}** làm mồi (ăn đồ yếu nhất trong túi trước) — đang có **${available}**`,
    `• ${MATERIALS.dotpha.emoji} **${cost.dotpha}** Đá Đột Phá — đang có **${stones}**`,
    `• 🔥 **${cost.coins}** 🪙`,
    enough ? "" : `-# ⚠️ Chưa đủ nguyên liệu — hạ boss để rơi ${MATERIALS.dotpha.emoji}, mua thêm ở \`/rpg supply\`, hoặc cày đồ ${slotName} làm mồi.`,
  ]
    .filter(Boolean)
    .join("\n");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rpg:do:breakgo:${item.id}`)
      .setLabel(`Đột Phá +${cap}→+${next}`)
      .setEmoji("🔶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!enough),
    new ButtonBuilder().setCustomId("rpg:do:enhcancel").setLabel("Huỷ").setStyle(ButtonStyle.Secondary),
  );
  container.addTextDisplayComponents(text(body)).addSeparatorComponents(divider()).addActionRowComponents(row);
  return container;
}

export interface BreakthroughOutcome {
  name: string;
  fromCap: number;
  toCap: number;
  fodder: number;
  dotpha: number;
  coins: number;
  balance: number;
}

function attemptBreakthrough(guildId: string, userId: string, itemId: string): BreakthroughOutcome | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { error: NO_CHARACTER };
  const found = findItem(profile, itemId);
  if (!found) return { error: "Món này không còn trong hành trang bro." };
  const item = found.item;
  const cap = gearCap(item);
  if (cap >= MAX_PLUS) return { error: `${gearName(item)} đã phá hết trần (+${MAX_PLUS}) rồi bro.` };
  if (item.plus < cap) return { error: `${gearName(item)} chưa chạm trần — đập lên +${cap} đã rồi Đột Phá nhe (đang +${item.plus}).` };

  const cost = breakthroughCost(cap);
  const slotName = GEAR_SLOTS.find((s) => s.id === item.slot)?.name ?? item.slot;
  const stones = profile.materials.dotpha ?? 0;
  if (stones < cost.dotpha)
    return { error: `Chưa đủ ${MATERIALS.dotpha.emoji} Đá Đột Phá — cần ${cost.dotpha}, đang có ${stones}. Hạ boss hoặc mua ở \`/rpg supply\` nhe.` };
  const pool = profile.bag.filter((it) => it.id !== itemId && it.slot === item.slot).sort((a, b) => fodderScore(a) - fodderScore(b));
  if (pool.length < cost.fodder)
    return { error: `Cần **${cost.fodder}** món cùng ô **${slotName}** làm mồi — đang có ${pool.length}. Cày thêm đồ cùng loại nhe bro.` };
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  if (balance < cost.coins) return { error: `Chưa đủ coin — cần ${cost.coins} 🪙, ví có ${balance}.` };

  // Burn synchronously: eat the N weakest same-slot fodder + 🔶 + coins, then raise the ceiling.
  const fodderIds = new Set(pool.slice(0, cost.fodder).map((it) => it.id));
  profile.bag = profile.bag.filter((it) => !fodderIds.has(it.id));
  profile.materials.dotpha = stones - cost.dotpha;
  coins[userId] = balance - cost.coins;
  const upped = breakthroughItem(item);
  if (found.inBag) {
    const i = profile.bag.findIndex((g) => g.id === itemId);
    if (i >= 0) profile.bag[i] = upped;
  } else {
    profile.gear[item.slot] = upped;
  }
  saveCharacters(chars);
  saveCoins(coins);
  logRpgEvent(guildId, {
    kind: "breakthrough",
    userId,
    base: item.base,
    slot: item.slot,
    rarity: item.rarity,
    fromCap: cap,
    toCap: gearCap(upped),
    fodder: cost.fodder,
    dotpha: cost.dotpha,
    coins: cost.coins,
  });
  return {
    name: gearName(upped),
    fromCap: cap,
    toCap: gearCap(upped),
    fodder: cost.fodder,
    dotpha: cost.dotpha,
    coins: cost.coins,
    balance: coins[userId]!,
  };
}

function breakthroughResultText(o: BreakthroughOutcome): string {
  return `## 🔶 Đột Phá thành công!\n${o.name} phá trần **+${o.fromCap} → +${o.toCap}** — đập tiếp được rồi bro! 🎉\n-# 🔥 Tốn ${o.fodder} món cùng ô + ${MATERIALS.dotpha.emoji} ${o.dotpha} + ${o.coins} 🪙 · ví còn ${o.balance} 🪙`;
}

export interface EnhanceOutcome {
  result: "up" | "down" | "break" | "stay";
  fromPlus: number;
  newPlus: number;
  charmConsumed: boolean;
  cost: { manh: number; coins: number };
  name: string;
  balance: number;
}

function attemptEnhance(
  guildId: string,
  userId: string,
  itemId: string,
  useCharm: boolean,
): EnhanceOutcome | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId]!;
  const found = findItem(profile, itemId);
  if (!found) return { error: "Món này không còn trong hành trang bro (chắc vỡ hoặc bán rồi)." };
  const item = found.item;
  if (item.plus >= MAX_PLUS) return { error: `${gearName(item)} đã +${MAX_PLUS} tối đa rồi bro.` };
  if (canBreakthrough(item))
    return { error: `${gearName(item)} đã chạm trần +${gearCap(item)} — cần **Đột Phá** (mồi + ${MATERIALS.dotpha.emoji} Đá Đột Phá + coin) mới đập tiếp được bro.` };

  const cost = enhanceCost(item.plus);
  const haveManh = profile.materials.manh ?? 0;
  if (haveManh < cost.manh) return { error: `Chưa đủ ${MATERIALS.manh.emoji} mảnh — cần ${cost.manh}, đang có ${haveManh}.` };
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  if (balance < cost.coins) return { error: `Chưa đủ coin — cần ${cost.coins} 🪙, ví có ${balance}.` };

  const hasCharm = useCharm && (profile.materials.bua ?? 0) > 0;
  if (useCharm && !hasCharm) return { error: `Bro không còn ${MATERIALS.bua.emoji} Blessed Charm — mua thêm ở \`/rpg supply\` nhe.` };

  // Burn the cost up front (mảnh + coins) — spent whether the attempt lands or not.
  profile.materials.manh = haveManh - cost.manh;
  coins[userId] = balance - cost.coins;

  const fromPlus = item.plus;
  const res = enhanceAttempt(fromPlus, hasCharm, Math.random, gearCap(item));
  if (res.charmConsumed) profile.materials.bua = (profile.materials.bua ?? 0) - 1;
  if (res.result === "up" || res.result === "down") {
    item.plus = res.newPlus;
  } else if (res.result === "break") {
    if (found.inBag) profile.bag = profile.bag.filter((g) => g.id !== itemId);
    else delete profile.gear[item.slot];
  }
  profile.tutorial = markTutorial(profile.tutorial ?? 0, TutorialStep.Enhance);

  saveCharacters(chars);
  saveCoins(coins);
  logRpgEvent(guildId, {
    kind: "enhance",
    userId,
    base: item.base,
    rarity: item.rarity,
    slot: item.slot,
    from: fromPlus,
    to: res.newPlus,
    result: res.result,
    charmUsed: res.charmConsumed,
  });
  return {
    result: res.result,
    fromPlus,
    newPlus: res.newPlus,
    charmConsumed: res.charmConsumed,
    cost,
    name: gearName(item),
    balance: coins[userId]!,
  };
}

function enhanceResultLine(o: EnhanceOutcome): string {
  switch (o.result) {
    case "up":
      return `⬆️ **Thành công!** ${o.name} lên **+${o.newPlus}** 🎉`;
    case "down":
      return `⬇️ Thất bại — tụt xuống **+${o.newPlus}** 😩`;
    case "break":
      return `💥 **VỠ!** ${o.name} tan tành, mất luôn 😱`;
    case "stay":
      return o.charmConsumed
        ? `🛡️ **Bùa cứu mạng!** ${o.name} đứng yên ở +${o.fromPlus}, tốn 1 bùa.`
        : `⏸️ ${o.name} đứng yên ở +${o.fromPlus}.`;
  }
}

function enhanceResultText(o: EnhanceOutcome): string {
  return `## 🔨 Kết quả Enhance\n${enhanceResultLine(o)}\n-# 🔥 Tốn ${MATERIALS.manh.emoji} ${o.cost.manh} + ${o.cost.coins} 🪙 · ví còn ${o.balance} 🪙`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ Ghép Sao (star merge) — fuse same-slot fodder + coins into a target for +1 ⭐ (starUpItem in
// ../rpg). Auto-eats the WEAKEST same-slot bag items so good gear is kept. Synchronous ledger (bag
// splice + coin deduct) before any render — crash-safe like enhance. The gear-drop + coin sink.
// ─────────────────────────────────────────────────────────────────────────────

// Cheap "keep my good stuff" ordering — fodder is consumed weakest-first by this proxy (no build calc).
function fodderScore(it: GearItem): number {
  return it.rarity * 1000 + it.plus * 40 + (it.star ?? 0) * 300 + (it.uniqueId ? 5000 : 0);
}

export interface MergeOutcome {
  name: string;
  fromStar: number;
  toStar: number;
  fodder: number;
  coins: number;
  upgraded: Mod | null;
  balance: number;
}

export function mergeCore(guildId: string, userId: string, itemId: string): MergeOutcome | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { error: NO_CHARACTER };
  const found = findItem(profile, itemId);
  if (!found) return { error: "Món này không còn trong hành trang bro." };
  const target = found.item;
  const star = target.star ?? 0;
  if (star >= MAX_STAR) return { error: `${gearName(target)} đã đạt ${MAX_STAR}⭐ tối đa rồi bro.` };
  const slotName = GEAR_SLOTS.find((s) => s.id === target.slot)?.name ?? target.slot;
  const needed = mergeFodderNeeded(star);
  const pool = profile.bag
    .filter((it) => it.id !== itemId && it.slot === target.slot)
    .sort((a, b) => fodderScore(a) - fodderScore(b));
  if (pool.length < needed)
    return { error: `Cần **${needed}** món cùng ô **${slotName}** làm nguyên liệu — đang có ${pool.length}. Cày thêm đồ cùng loại rồi ghép nhe bro.` };
  const coinsCost = mergeCoinCost(star);
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  if (balance < coinsCost) return { error: `Chưa đủ coin — cần ${coinsCost} 🪙, ví có ${balance}.` };

  // Burn the cost synchronously: eat the N weakest same-slot fodder + coins, then ⭐ the target.
  const fodderIds = new Set(pool.slice(0, needed).map((it) => it.id));
  profile.bag = profile.bag.filter((it) => !fodderIds.has(it.id));
  coins[userId] = balance - coinsCost;
  const { item: upped, upgraded } = starUpItem(target, Math.random);
  if (found.inBag) {
    const i = profile.bag.findIndex((g) => g.id === itemId);
    if (i >= 0) profile.bag[i] = upped;
  } else {
    profile.gear[target.slot] = upped;
  }
  saveCharacters(chars);
  saveCoins(coins);
  logRpgEvent(guildId, {
    kind: "merge",
    userId,
    base: target.base,
    slot: target.slot,
    fromStar: star,
    toStar: star + 1,
    fodder: needed,
    coins: coinsCost,
    modUpgraded: upgraded?.group,
  });
  return { name: gearName(upped), fromStar: star, toStar: star + 1, fodder: needed, coins: coinsCost, upgraded, balance: coins[userId]! };
}

// Items eligible for ⭐ (not yet maxed), equipped + bag — the /rpg ghep picker source.
function starableItems(profile: RpgProfile): GearItem[] {
  return [...GEAR_SLOTS.map((s) => profile.gear[s.id]).filter((it): it is GearItem => !!it), ...profile.bag].filter(
    (it) => (it.star ?? 0) < MAX_STAR,
  );
}

function ghepPanel(profile: RpgProfile, item: GearItem, intro?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0xf1c40f);
  if (intro) container.addTextDisplayComponents(text(intro)).addSeparatorComponents(divider());
  const star = item.star ?? 0;
  if (star >= MAX_STAR) {
    container.addTextDisplayComponents(text(`## ⭐ Ghép Sao\n${gearName(item)} đã đạt **${MAX_STAR}⭐** — kịch trần rồi bro 🏆`));
    return container;
  }
  const slotName = GEAR_SLOTS.find((s) => s.id === item.slot)?.name ?? item.slot;
  const needed = mergeFodderNeeded(star);
  const coinsCost = mergeCoinCost(star);
  const available = profile.bag.filter((it) => it.id !== item.id && it.slot === item.slot).length;
  const enough = available >= needed;
  const body = [
    "## ⭐ Ghép Sao",
    `**${gearName(item)}**`,
    gearStatBlock(item),
    gearModBlock(item),
    `⭐ **${star} → ${star + 1}** (tối đa ${MAX_STAR}⭐)`,
    "",
    "Mỗi sao: **+7% chỉ số nền** của món + **nâng dòng mod dở nhất lên 1 tier** (T4→…→T1 — cách duy nhất cải thiện mod).",
    `🧩 Nguyên liệu: **${needed}** món cùng ô **${slotName}** (ăn đồ yếu nhất trong túi trước) — đang có **${available}**.`,
    `💸 Chi phí: 🔥 **${coinsCost}** 🪙${enough ? "" : `\n-# ⚠️ Chưa đủ nguyên liệu — cày thêm đồ ${slotName} rồi ghép nhe.`}`,
  ]
    .filter(Boolean)
    .join("\n");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rpg:do:ghepgo:${item.id}`)
      .setLabel(`Ghép +1 ⭐ (${needed} món + ${coinsCost} 🪙)`)
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!enough),
    new ButtonBuilder().setCustomId("rpg:do:ghepcancel").setLabel("Huỷ").setStyle(ButtonStyle.Secondary),
  );
  container.addTextDisplayComponents(text(body)).addSeparatorComponents(divider()).addActionRowComponents(row);
  return container;
}

function mergeResultText(o: MergeOutcome): string {
  const modLine = o.upgraded ? `\n🔧 Nâng mod: ${modLabel(o.upgraded)}` : "";
  return `## ⭐ Ghép Sao thành công!\n${o.name} lên **${o.toStar}⭐** 🎉${modLine}\n-# 🔥 Tốn ${o.fodder} món cùng ô + ${o.coins} 🪙 · ví còn ${o.balance} 🪙`;
}

function enhanceResultColor(result: EnhanceOutcome["result"]): number {
  return result === "up" ? 0x2ecc71 : result === "break" ? 0xe74c3c : 0xe67e22;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cửa ải — stage list, buy consumables (coin sink), dispatch, status, recall.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_CHOICES = STAGES.map((s) => ({ name: `${s.emoji} ${s.name}`, value: s.id }));

function buyMaterial(
  userId: string,
  loai: "luongthuc" | "thuoc" | "bua" | "dotpha",
  qty: number,
): { ok: true; qty: number; price: number; balance: number; total: number } | { ok: false; need: number; have: number } {
  // Defense-in-depth: a negative/fractional qty would make price negative and CREDIT coins.
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, need: 0, have: 0 };
  const price = SHOP_PRICES[loai] * qty;
  const coins = loadCoins();
  const balance = coins[userId] ?? 0;
  if (balance < price) return { ok: false, need: price, have: balance };
  const chars = loadCharacters();
  const profile = chars[userId]!;
  coins[userId] = balance - price; // burned — coin sink
  profile.materials[loai] = (profile.materials[loai] ?? 0) + qty;
  saveCharacters(chars);
  saveCoins(coins);
  return { ok: true, qty, price, balance: coins[userId]!, total: profile.materials[loai]! };
}

// Đi ải QoL: top the run's 🍖 lương thực up to RATION_AUTO_TARGET before dispatch. Pure SINK.
function autoRefillRations(userId: string): { bought: number; spent: number } | null {
  const profile = loadCharacters()[userId];
  if (!profile) return null;
  const have = profile.materials.luongthuc ?? 0;
  if (have >= RATION_AUTO_TARGET) return null;
  const balance = loadCoins()[userId] ?? 0;
  const affordable = Math.floor(balance / SHOP_PRICES.luongthuc);
  const qty = Math.min(RATION_AUTO_TARGET - have, affordable);
  if (qty < 1) return null;
  const r = buyMaterial(userId, "luongthuc", qty);
  return r.ok ? { bought: r.qty, spent: r.price } : null;
}

// The shared dispatch used by slash, quick-go, and the map-device select. Pre-checks
// before any coin/ration burn, starts the run, then returns its latest private snapshot
// through the interaction. The scheduler owns state only; no channel message is tracked.
// Which region the one-tap "Đi ải ngay" button targets: the DEEPEST unlocked region the
// hero can actually clear at the entrance (power ≥ the floor-1 monster's), else the
// shallowest unlocked. `stageUnlocked` rides on bestFloor, which SURVIVES a Tái Sinh, so a
// freshly-prestiged Lv1 hero keeps every region unlocked but not the power — without this
// the button would one-tap them into a region-5 wall and a floor-1 death. powerScore and
// powerOf share one scale (both fold through powerOf), so the compare is honest.
function quickGoRegion(profile: RpgProfile): Stage {
  const unlocked = STAGES.filter((s) => stageUnlocked(profile, s));
  const heroPow = powerScore(profile);
  let target = unlocked[0] ?? STAGES[0]!;
  for (const s of unlocked) {
    const m = genMonster(s, 1, 1, () => 0.5, []); // deterministic floor-1 monster, tier 1, no map mods
    if (heroPow >= powerOf(m.off, m.def)) target = s; // strongest region whose entrance the hero out-powers
  }
  return target;
}

async function dispatchExpedition(
  interaction: ChatInputCommandInteraction<"cached"> | StringSelectInteractionLike,
  guildId: string,
  userId: string,
  channelId: string,
  stageId: string,
  stopAtFloor: number | null,
  tier = 1,
): Promise<{ error: string } | null> {
  // Bail on the non-ration guards (đã đi ải / ải khoá / chưa có nhân vật) BEFORE spending
  // any coins on rations — autoRefillRations burns coins, so it must run only once the run
  // is guaranteed to start (a rejected startExpedition otherwise burns coins for nothing).
  const block = expeditionBlockReason(userId, stageId);
  if (block) return { error: block };

  autoRefillRations(userId);
  const result = startExpedition(guildId, userId, channelId, stageId, stopAtFloor, tier);
  if ("error" in result) return { error: result.error };
  markStep(userId, TutorialStep.Expedition);
  const status = syncExpedition(guildId, userId);
  if (!status) return { error: "Không đọc được trạng thái chuyến đi vừa tạo — dùng `/rpg status` để kiểm tra nhe." };
  // Hand the ticker this interaction's token so it can keep the snapshot fresh
  // while the token lives (see trackExpeditionSnapshot).
  trackExpeditionSnapshot(userId, interaction.token);
  if (interaction.replied === false && interaction.deferred === false) {
    await interaction.reply(expeditionPayload(userId, status));
  } else {
    await interaction.editReply(expeditionPayload(userId, status));
  }
  return null;
}

// A minimal structural type for the two interaction shapes dispatchExpedition accepts.
interface StringSelectInteractionLike {
  replied: boolean;
  deferred: boolean;
  token: string; // handed to the ticker so it can keep this snapshot fresh
  reply(payload: unknown): Promise<unknown>;
  editReply(payload: unknown): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chợ đồ (/rpg market · rao-ban) — Discord glue over ../rpg-market cores. Buying rides the
// per-listing Mua button in the browse view (no separate mua-o-cho subcommand).
// ─────────────────────────────────────────────────────────────────────────────

const MARKET_PAGE = 5;

function marketSellRow(bag: GearItem[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = bag.slice(0, 25).map((it) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(gearPlainName(it).slice(0, 100))
      .setDescription(`${GEAR_SLOTS.find((s) => s.id === it.slot)?.name} · ${gearStatLine(it)}`.slice(0, 100))
      .setValue(it.id),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId("rpg:cho:chosell").setPlaceholder("🏪 Chọn đồ để rao bán").addOptions(options),
  );
}

// The "Rao bán món" button that opens the sell picker (rpg:cho:sellopen) from the market panel.
function marketSellButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("rpg:cho:sellopen").setLabel("Rao bán món").setEmoji("🏷️").setStyle(ButtonStyle.Primary),
  );
}

function marketBrowse(userId: string, page: number): ContainerBuilder {
  const listings = browseListings();
  if (listings.length === 0) {
    return new ContainerBuilder()
      .setAccentColor(RPG_COLOR)
      .addTextDisplayComponents(text("## 🏪 Chợ đồ\nChợ đang trống bro — bấm **Rao bán món** để rao món đầu tiên nhe!"))
      .addSeparatorComponents(divider())
      .addActionRowComponents(marketSellButtonRow());
  }
  const pages = Math.ceil(listings.length / MARKET_PAGE);
  const cur = Math.max(0, Math.min(page, pages - 1));
  const slice = listings.slice(cur * MARKET_PAGE, cur * MARKET_PAGE + MARKET_PAGE);
  const table = codeBlock(
    listTable(
      ["#", "Tên", "Ô", "Cấp", "Giá"],
      slice.map((l, i) => [
        String(cur * MARKET_PAGE + i + 1),
        itemName(l.item),
        GEAR_SLOTS.find((s) => s.id === l.item.slot)?.name ?? l.item.slot,
        itemTier(l.item),
        num(l.price),
      ]),
      ["l", "l", "l", "l", "r"],
    ),
  );
  // Seller mentions live OUTSIDE the code block (mentions don't render inside ```), keyed by #.
  const sellers = slice
    .map((l, i) => `**${cur * MARKET_PAGE + i + 1}.** <@${l.sellerId}>${l.sellerId === userId ? " *(bro)*" : ""}`)
    .join(" · ");
  const body = [
    `## 🏪 Chợ đồ — trang ${cur + 1}/${pages}`,
    table,
    `-# 💰 Giá tính bằng 🪙 · người bán: ${sellers}`,
    "-# Mua: bấm nút bên dưới · Bán: nút **Rao bán món** · Thuế 5% đốt · Đồ đang mặc không bán được",
  ].join("\n");
  const buyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...slice.map((l, i) => {
      const n = cur * MARKET_PAGE + i + 1;
      const own = l.sellerId === userId;
      return new ButtonBuilder()
        .setCustomId(`rpg:cho:${own ? "cancel" : "buy"}:${l.id}`)
        .setLabel(`${own ? "Gỡ" : "Mua"} #${n}`)
        .setEmoji(own ? "↩️" : "🛒")
        .setStyle(own ? ButtonStyle.Secondary : ButtonStyle.Success);
    }),
  );
  const container = new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(text(body))
    .addSeparatorComponents(divider())
    .addActionRowComponents(buyRow);
  if (pages > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`rpg:cho:page:${cur - 1}`).setLabel("Trước").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(cur === 0),
        new ButtonBuilder().setCustomId(`rpg:cho:page:${cur + 1}`).setLabel("Sau").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(cur >= pages - 1),
      ),
    );
  }
  container.addActionRowComponents(marketSellButtonRow());
  return container;
}

function marketBoughtContainer(userId: string, r: BuyResult): ContainerBuilder {
  const body = [
    "## 🛒 Mua gear thành công",
    `<@${userId}> mua **${gearName(r.item)}**`,
    gearStatBlock(r.item),
    gearModBlock(r.item),
    `💰 Trả **${r.price}** 🪙 → người bán <@${r.sellerId}> nhận **${r.sellerGot}** 🪙 · 🔥 đốt ${r.burned} (thuế)`,
    `Ví bro còn: 🪙 ${r.buyerBalance}`,
    "-# Món đã vào bag — `/rpg equip` để mặc nhe.",
  ].filter(Boolean).join("\n");
  return new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(text(body));
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide (huong-dan) — paginated ephemeral help, a select over sections.
// ─────────────────────────────────────────────────────────────────────────────

const GUIDE: { id: string; label: string; emoji: string; body: string }[] = [
  {
    id: "tongquan",
    label: "Tổng quan",
    emoji: "🗺️",
    body: "Cửa Ải là game nhập vai nhàn tay kiểu Path of Exile: create hero → chạy map → nó **tự đánh** từng floor. Mình nhặt gear + material, ghép **skill gem**, mở **passive tree**, **đập đồ** (`/rpg enhance`) để build mạnh hơn. Coin chỉ dùng **mua consumable** (Provision/Life Potion/Charm) — loot là tiền tệ riêng.",
  },
  {
    id: "class",
    label: "Class",
    emoji: "⚔️",
    body:
      "3 class: 🛡️ **Warrior** (máu dày + armour + đòn Physical), 🔮 **Sorceress** (Energy Shield + spell & crit), 🏹 **Ranger** (evasion cao, đòn nhanh, crit ổn). " +
      "Đòn đánh scale theo **weapon** (attack) hoặc **spell power** (spell). Chọn lúc `/rpg create`.\n" +
      "✨ **Lên cấp** ở `/rpg levelup`, tốn Essence, không tốn coin. Giá **nhân lên mỗi cấp**: cấp 10 chỉ vài ✨, nhưng cấp 50 ngốn hơn 1.500 ✨ — " +
      "lên cấp tối đa là mục tiêu cả mùa chứ không phải một buổi tối.\n" +
      "💀 **Chết bị trừ Essence**: dưới cấp 8 thì miễn, càng cao phạt càng nặng, tối đa **12%** số ✨ đang giữ ở cấp 50. Đi sâu nhớ liệu đường lui.",
  },
  {
    id: "kynang",
    label: "Skill Gem",
    emoji: "🗡️",
    body: "`/rpg skills` — gắn một **skill gem chính** (Heavy Strike, Fireball, Ice Shot…) rồi cắm **support gem** vào socket của nó. Skill trần trụi đánh khá nhẹ — **support mới là thứ làm nó mạnh**, nhưng mỗi support **nhân giá 🔵 Nộ Khí** của mỗi đòn. Hết Nộ Khí thì hero tụt xuống **đòn cơ bản** (không support), cạn hẳn thì lỡ luôn nhịp đánh. Muốn ôm nhiều support thì phải săn dòng **Nộ Khí / Hồi Nộ** trên đồ. Gem lên cấp theo XP khi chạy map.",
  },
  {
    id: "tainguyen",
    label: "Linh Lực & Nộ Khí",
    emoji: "🕯️",
    body:
      "Hai tài nguyên quyết định build:\n" +
      "🕯️ **Linh Lực (Spirit)** — *giữ chỗ* cho aura. Mỗi aura ăn một lượng Linh Lực cố định (aura tấn công đắt nhất). Lên cấp cho một ít Linh Lực nền, còn lại phải săn dòng **Linh Lực** trên ⚔️ vũ khí / 🛡️ giáp / 💍 nhẫn — dòng này hiếm và chỉ rơi ở 3 ô đó. Có bao nhiêu Linh Lực thì bật được bấy nhiêu aura, không giới hạn số lượng.\n" +
      "🔵 **Nộ Khí (Mana)** — trả cho *từng đòn đánh*. Support gem càng nhiều thì mỗi đòn càng đắt. Nộ Khí mang theo suốt chuyến đi (nghỉ giữa tầng chỉ hồi một ít), nên build ôm 4 support mà không có đồ Nộ Khí sẽ đuối dần ở tầng sâu.",
  },
  {
    id: "tiemnang",
    label: "Passive Tree",
    emoji: "🌳",
    body: "`/rpg passives` — mỗi cấp +1 passive point (Prestige +3). Học node theo cluster (Constitution, Berserking, Elementalist, Assassination…): mỗi cluster là một chuỗi node nhỏ → node lớn (notable). Học theo thứ tự trong cluster. Prestige hoàn lại toàn bộ điểm để build lại.",
  },
  {
    id: "trangbi",
    label: "Gear & Enhance",
    emoji: "🎒",
    body: "6 slot: ⚔️ Weapon · 🪖 Helmet · 🛡️ Body Armour · 🧤 Gloves · 🥾 Boots · 💍 Ring. 5 rarity (⚪→🟠). Gear rơi kèm sẵn **mod** (prefix/suffix) theo kiểu Path of Exile. Xem inventory `/rpg inventory`, mặc `/rpg equip`, tháo `/rpg unequip`, salvage `/rpg salvage`. Mạnh hơn thì **đập đồ** `/rpg enhance` (+N) — đốt 🔩 Enhancement Shard + coin.",
  },
  {
    id: "binh",
    label: "Flask",
    emoji: "🧪",
    body: "`/rpg flask` — mang theo flask: 🧪 Life Flask hồi máu giữa các floor, utility flask (🛡️ armour, 💨 evasion/speed) cho buff suốt map. Chọn flask rồi chạy map là tự áp dụng.",
  },
  {
    id: "dapdo",
    label: "Enhance",
    emoji: "🔨",
    body: "`/rpg enhance` — +0→+3 an toàn tuyệt đối. +4→+7 fail thì **tụt cấp**. +8→+12 fail thì **VỠ mất đồ**. 🛡️ Blessed Charm biến mọi fail thành đứng yên (mua ở `/rpg supply`). Chi phí 🔩 Shard + coin bị đốt dù thắng hay thua. **🔶 Đột Phá:** mỗi món có **trần** cường hóa, khởi điểm +3; chạm trần thì phải Đột Phá (mồi cùng ô + 🔶 Đá Đột Phá + coin) để nâng trần +3 (→+6→+9→+12) mới đập tiếp. 🔶 rơi từ boss hoặc mua ở `/rpg supply`.",
  },
  {
    id: "ghep",
    label: "Ghép Sao",
    emoji: "⭐",
    body: `\`/rpg ghep\` — nung đồ **cùng ô trang bị** (fodder) vào một món để lên **⭐ (tối đa ${MAX_STAR}⭐)**. Mỗi sao cho **+7% chỉ số nền** + **nâng 1 dòng mod dở nhất lên 1 tier** (T4→…→T1 — cách DUY NHẤT cải thiện mod đã rơi). Số món cần tăng dần theo sao (1,2,3,4,5) và tốn coin — ăn đồ yếu nhất trong túi trước nên đồ xịn luôn an toàn. Đây là chỗ tiêu đồ thừa + coin.`,
  },
  {
    id: "ai",
    label: "Region & Atlas",
    emoji: "🏛️",
    body: "5 region, mỗi region mở khi đạt floor 15 region trước, càng sâu càng khó (endless). `/rpg map` hoặc `/rpg atlas` chọn region → hero tự đem hết Provision + Life Potion. `/rpg status` coi tiến độ, `/rpg recall` rút sớm (giữ loot). Có **luật tuần** đổi định kỳ, xem ở `/rpg atlas`. Nút **🗺️ Atlas Tree** trong `/rpg atlas` để học node tăng loot farm — mỗi 5 floor sâu nhất tặng 1 điểm, sống qua mọi lần Prestige.",
  },
  {
    id: "cho",
    label: "Market",
    emoji: "🏪",
    body: "Chợ người-với-người ở `/rpg market`: duyệt + **bấm nút Mua** ngay trên tin rao, hoặc bấm **Rao bán món** để rao đồ của mình lấy coin. Coin chuyển thẳng người bán, thu **5% thuế đốt**. Bán rác cho NPC: `/rpg vendor`.",
  },
  {
    id: "taisinh",
    label: "Prestige",
    emoji: "🌟",
    body: `Đạt floor ${PRESTIGE_FLOOR} **kể từ lần prestige gần nhất** (hoặc cấp tối đa) → \`/rpg prestige\` reset để nhận 🔮 Jewel. Số Jewel **theo sức mạnh (power)** lúc reset — càng mạnh càng nhiều, luôn ≥1 nên không bao giờ bị kẹt. Jewel mua perk **vĩnh viễn** (+ATK/+HP/+loot) sống qua mọi lần prestige. Prestige cũng hoàn lại toàn bộ passive point để build lại.`,
  },
  {
    id: "tuchien",
    label: "PvP (Tử Chiến)",
    emoji: "⚔️",
    body: "Ải Tử Chiến full-loot: `/rpg arena` để **cược haul** (vài món trong túi) rồi đứng vùng — đồ đang mặc thì LUÔN an toàn. `/rpg invade` xâm lăng một đối thủ **cùng tầm sức mạnh** (bracket chống bắt nạt): thắng ôm haul đối thủ, thua mất haul mình. Rút lui bất cứ lúc nào để ôm haul về túi. BXH ở `/rpg ladder` (nút chuyển PvE ⇄ PvP).",
  },
];

function guideContainer(id: string): ContainerBuilder {
  const section = GUIDE.find((g) => g.id === id) ?? GUIDE[0]!;
  return new ContainerBuilder()
    .setAccentColor(RPG_COLOR)
    .addTextDisplayComponents(text(`## 📖 Hướng dẫn — ${section.emoji} ${section.label}\n${section.body}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(guideRow(id));
}

function guideRow(currentId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId("rpg:guide:page").setPlaceholder("📖 Chọn mục").addOptions(
      GUIDE.map((g) =>
        new StringSelectMenuOptionBuilder().setLabel(g.label).setEmoji(g.emoji).setValue(g.id).setDefault(g.id === currentId),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported rule core for the agent (bot_rpg_status) — a read-only profile summary.
// ─────────────────────────────────────────────────────────────────────────────

export interface RpgStatusView {
  cls: ClassId;
  className: string;
  level: number;
  power: number;
  life: number;
  energyShield: number;
  armour: number;
  evasion: number;
  res: Record<Elem, number>;
  crit: number;
  critMulti: number;
  skill: string | null;
  supports: string[];
  passivesAllocated: number;
  passivesTotal: number;
  coNgoc: number;
  prestigeLevel: number;
  ascendancy: { id: string; name: string; keystone: string } | null; // chosen subclass (null = none/locked)
  ascendancyUnlocked: boolean;
  auras: { id: string; name: string }[]; // auras actually running inside the Spirit budget
  curse: { id: string; name: string } | null; // equipped enemy hex (null = none)
  bagCount: number;
  materials: Partial<Record<MaterialId, number>>;
  bestFloors: { stageId: string; stageName: string; floor: number }[];
  expedition: { stageId: string; stageName: string; floor: number; hp: number; rations: number } | null;
}

export function rpgStatus(userId: string): RpgStatusView | null {
  const profile = loadCharacters()[userId];
  if (!profile) return null;
  const build = effectiveBuild(profile);
  const exp = loadExpeditions()[userId] ?? null;
  const skillDef = profile.skillGem ? SKILL_BY_ID[profile.skillGem.defId] : null;
  return {
    cls: profile.cls,
    className: CLASSES[profile.cls].name,
    level: profile.level,
    power: build.power,
    life: build.def.life,
    energyShield: build.def.energyShield,
    armour: build.def.armour,
    evasion: build.def.evasion,
    res: { ...build.def.res },
    crit: build.off.crit,
    critMulti: build.off.critMulti,
    skill: skillDef ? skillDef.name : null,
    supports: (profile.supports ?? []).map((s) => SUPPORT_BY_ID[s.defId]?.name ?? s.defId),
    passivesAllocated: (profile.passives ?? []).length,
    passivesTotal: passivePointsTotal(profile.level, profile.prestigeLevel),
    coNgoc: profile.coNgoc,
    prestigeLevel: profile.prestigeLevel,
    ascendancy: (() => {
      const a = ascendancyUnlocked(profile) ? chosenAscendancy(profile.cls, profile.ascendancy) : null;
      return a ? { id: a.id, name: a.name, keystone: a.keystoneName } : null;
    })(),
    ascendancyUnlocked: ascendancyUnlocked(profile),
    auras: effectiveBuild(profile).spirit.running.map((a) => ({ id: a.id, name: a.name })),
    curse: (() => {
      const c = profile.curse ? CURSE_BY_ID[profile.curse] : undefined;
      return c ? { id: c.id, name: c.name } : null;
    })(),
    bagCount: profile.bag.length,
    materials: { ...profile.materials },
    bestFloors: STAGES.filter((s) => (profile.bestFloor[s.id] ?? 0) > 0).map((s) => ({
      stageId: s.id,
      stageName: s.name,
      floor: profile.bestFloor[s.id]!,
    })),
    expedition: exp
      ? {
          stageId: exp.stageId,
          stageName: STAGE_BY_ID[exp.stageId]?.name ?? exp.stageId,
          floor: exp.floor,
          hp: exp.hp,
          rations: exp.rations,
        }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported rule cores for the chat agent's mcp__bot__ tools (agent-tools.ts). Each is
// self-contained on (guildId, userId, ...), reuses the exact same mutation code the slash
// handlers call, and returns plain DATA or { error } — never an EmbedBuilder.
// ─────────────────────────────────────────────────────────────────────────────

const NO_CHARACTER = "Bro chưa có nhân vật Cửa Ải — tạo bằng /rpg create trước nhe.";

// Lên cấp — reuse doLevelUp (single step), map its refusal reasons to Vietnamese strings.
export function levelUpCore(
  guildId: string,
  userId: string,
): { level: number; levels: number; spent: number; tinhchat: number } | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  const r = doLevelUp(guildId, userId);
  if (r.ok) return { level: r.level, levels: r.levels, spent: r.spent, tinhchat: r.tinhchat };
  if (r.reason === "maxed") return { error: `Hero đã đạt cấp tối đa ${MAX_LEVEL} — mở cổng Prestige (/rpg prestige) để đi tiếp bro.` };
  return { error: `Chưa đủ ✨ tinh chất — cần ${r.need}, đang có ${r.have}. Đi ải cày thêm nhe.` };
}

// Tái Sinh — mirror the prestige_confirm button.
export function prestigeCore(
  guildId: string,
  userId: string,
): { gained: number; coNgoc: number; level: number } | { error: string } {
  const chars = loadCharacters();
  const p = chars[userId];
  if (!p) return { error: NO_CHARACTER };
  // A running expedition must be settled FIRST. It writes its cleared floors onto whatever
  // profile is on disk, so rebirthing mid-run let the old run's floors land on the freshly
  // reset hero — re-opening the prestige gate within minutes and paying out on a level-1
  // power score (a real player lost 20 Cổ Ngọc to exactly this).
  if (loadExpeditions()[userId])
    return { error: "Bro đang đi ải — `/rpg recall` để rút về (hoặc chờ chuyến này xong) rồi mới Tái Sinh được nhe." };
  if (!canPrestige(p))
    return {
      error: `Chưa đủ điều kiện Prestige — cần đạt floor ${PRESTIGE_FLOOR} kể từ lần prestige gần nhất (hoặc lên cấp tối đa ${MAX_LEVEL}).`,
    };
  const power = powerScore(p);
  const gained = prestigeReward(power);
  const deepest = Object.values(p.bestFloor).reduce((m, f) => Math.max(m, f), 0);
  chars[userId] = applyPrestige(p, power, Math.random);
  saveCharacters(chars);
  logRpgEvent(guildId, {
    kind: "prestige",
    userId,
    prestigeLevel: chars[userId]!.prestigeLevel,
    coNgoc: gained,
    floor: deepest,
    power,
  });
  return { gained, coNgoc: chars[userId]!.coNgoc, level: chars[userId]!.level };
}

export interface InventoryItemView {
  slot: GearSlot;
  slotName: string;
  id: string;
  name: string;
  rarity: string;
  plus: number;
  mods: string[]; // one line per rolled mod (modLabel), so the agent can read the gear's dòng
  stats: Partial<Record<StatId, number>>;
}

// Túi đồ — the equipped build + the bag, each item with its instance id.
export function inventoryCore(
  userId: string,
): { equipped: InventoryItemView[]; bag: InventoryItemView[] } | null {
  const profile = loadCharacters()[userId];
  if (!profile) return null;
  const view = (it: GearItem): InventoryItemView => {
    const uniq = it.uniqueId ? UNIQUE_BY_ID[it.uniqueId] : undefined;
    return {
      slot: it.slot,
      slotName: GEAR_SLOTS.find((s) => s.id === it.slot)?.name ?? it.slot,
      id: it.id,
      name: uniq?.name ?? GEAR_BASES[it.base]?.name ?? it.base,
      rarity: uniq ? "Unique" : RARITIES[it.rarity].name,
      plus: it.plus,
      mods: (it.mods ?? []).map((m) => modLabel(m)), // uniques carry no rolled mods → empty
      stats: gearStats(it),
    };
  };
  const equipped = GEAR_SLOTS.flatMap((slot) => {
    const it = profile.gear[slot.id];
    return it ? [view(it)] : [];
  });
  return { equipped, bag: profile.bag.map(view) };
}

export function equipCore(
  userId: string,
  itemId: string,
): { name: string; replaced: string | null } | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  const r = equipItem(userId, itemId);
  if (r.ok) return { name: gearName(r.item), replaced: r.replaced ? gearName(r.replaced) : null };
  return {
    error:
      r.reason === "already"
        ? "Món này đang mặc rồi bro."
        : "Món này không còn trong túi bro — kiểm tra lại id món trong túi trước nhe.",
  };
}

export function unequipCore(
  userId: string,
  slot: GearSlot,
): { name: string } | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  const r = unequipSlot(userId, slot);
  if (r.ok) return { name: gearName(r.item) };
  return { error: r.reason === "empty" ? "Ô đó đang trống bro." : `Túi đầy (${BAG_LIMIT}) rồi — phân rã bớt đã nhe.` };
}

export function enhanceCore(
  guildId: string,
  userId: string,
  itemId: string,
  useCharm: boolean,
): EnhanceOutcome | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  return attemptEnhance(guildId, userId, itemId, useCharm);
}

export function salvageCore(
  guildId: string,
  userId: string,
  itemId: string,
): { name: string; manh: number; total: number } | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  const r = salvageItem(guildId, userId, itemId);
  if (r.ok) return { name: gearName(r.item), manh: r.manh, total: r.total };
  return { error: "Món này không còn trong túi bro — chỉ phân rã được đồ trong túi, kiểm tra lại id nhe." };
}

export function buySupplyCore(
  guildId: string,
  userId: string,
  kind: "luongthuc" | "thuoc" | "bua" | "dotpha",
  qty: number,
): { kind: string; qty: number; price: number; balance: number; total: number } | { error: string } {
  if (!loadCharacters()[userId]) return { error: NO_CHARACTER };
  const r = buyMaterial(userId, kind, qty);
  if (r.ok) {
    logRpgEvent(guildId, { kind: "supply_buy", userId, item: kind, qty: r.qty, cost: r.price });
    return { kind, qty: r.qty, price: r.price, balance: r.balance, total: r.total };
  }
  return { error: `Chưa đủ coin — cần ${r.need} 🪙, ví có ${r.have}.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Farm-gold cores — the money-critical NPC-sell (mints the NET after a 5% burn), one-click
// best-in-slot, and bulk salvage. All are the exact rule the slash panels AND the agent tools run.
// ─────────────────────────────────────────────────────────────────────────────

export interface SellResult {
  sold: { name: string; price: number }[];
  coinsPaid: number; // NET credited to the seller (after NPC_SELL_BURN)
  burned: number; // fraction burned out of the gross (never minted)
  balance: number;
}

export function sellItemsCore(
  guildId: string,
  userId: string,
  itemIds: string[],
): SellResult | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { error: NO_CHARACTER };

  const sold: { name: string; price: number }[] = [];
  const soldItems: { rarity: Rarity; plus: number; price: number }[] = [];
  let coinsPaid = 0;

  for (const id of itemIds) {
    const idx = profile.bag.findIndex((g) => g.id === id); // bag only → equipped gear can never be sold
    if (idx < 0) continue;
    const item = profile.bag[idx]!;
    profile.bag.splice(idx, 1);
    const price = npcSellPrice(item);
    coinsPaid += price;
    sold.push({ name: gearName(item), price });
    soldItems.push({ rarity: item.rarity, plus: item.plus, price });
  }

  // Persist the bag FIRST, then credit — a crash between under-pays rather than double-pays.
  saveCharacters(chars);
  let balance = loadCoins()[userId] ?? 0;
  const burned = coinsPaid > 0 ? Math.round(coinsPaid * NPC_SELL_BURN) : 0;
  const credited = coinsPaid - burned; // seller nets this; the burn is never minted (a sink)
  if (credited > 0) {
    const coins = loadCoins();
    coins[userId] = (coins[userId] ?? 0) + credited; // net minted — the RPG faucet, minus the burn
    saveCoins(coins);
    balance = coins[userId]!;
  }
  for (const s of soldItems)
    logRpgEvent(guildId, { kind: "vendor_sell", userId, rarity: s.rarity, plus: s.plus, coins: s.price });
  return { sold, coinsPaid: credited, burned, balance };
}

export function sellJunkCore(guildId: string, userId: string, maxRarity: Rarity): SellResult | { error: string } {
  const profile = loadCharacters()[userId];
  if (!profile) return { error: NO_CHARACTER };
  const ids = bagItemsUpToRarity(profile.bag, maxRarity).map((it) => it.id);
  return sellItemsCore(guildId, userId, ids);
}

export interface AutoEquipView {
  changed: { slot: GearSlot; name: string }[];
  before: number;
  after: number;
}

// Trang bị tốt nhất — one-click best-in-slot via autoEquipBest, saved.
export function autoEquipBestCore(userId: string): AutoEquipView | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { error: NO_CHARACTER };
  const before = powerScore(profile);
  const { gear, bag, changed } = autoEquipBest(profile);
  const changedView = changed.map((slot) => ({ slot, name: gearName(gear[slot]!) }));
  if (changed.length === 0) return { changed: changedView, before, after: before }; // already optimal — no write
  profile.gear = gear;
  profile.bag = bag;
  profile.tutorial = markTutorial(profile.tutorial ?? 0, TutorialStep.Equip);
  saveCharacters(chars);
  return { changed: changedView, before, after: powerScore(profile) };
}

export function bulkSalvageCore(
  userId: string,
  maxRarity: Rarity,
): { count: number; manh: number; total: number } | { error: string } {
  const chars = loadCharacters();
  const profile = chars[userId];
  if (!profile) return { error: NO_CHARACTER };
  const targets = bagItemsUpToRarity(profile.bag, maxRarity);
  if (targets.length === 0) return { count: 0, manh: 0, total: profile.materials.manh ?? 0 };
  const ids = new Set(targets.map((it) => it.id));
  const manh = targets.reduce((sum, it) => sum + salvageYield(it).manh, 0);
  profile.bag = profile.bag.filter((g) => !ids.has(g.id));
  profile.materials.manh = (profile.materials.manh ?? 0) + manh;
  saveCharacters(chars);
  return { count: targets.length, manh, total: profile.materials.manh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bảng xếp hạng (ladder) — one board with a PvE ⇄ PvP toggle. PvE ranks every hero by
// build Power; PvP ranks the Ải Tử Chiến zone by snapshot power (with each one's at-risk
// haul). The toggle button flips the mode in place on the same message.
// ─────────────────────────────────────────────────────────────────────────────

type LadderMode = "pve" | "pvp";

function ladderToggleRow(mode: LadderMode): ActionRowBuilder<ButtonBuilder> {
  const next: LadderMode = mode === "pve" ? "pvp" : "pve";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rpg:ladder:${next}`)
      .setLabel(next === "pvp" ? "Xem BXH PvP (Tử Chiến)" : "Xem BXH Power (PvE)")
      .setEmoji(next === "pvp" ? "⚔️" : "🏆")
      .setStyle(ButtonStyle.Secondary),
  );
}

async function ladderContainer(guild: Guild, mode: LadderMode): Promise<ContainerBuilder> {
  const medals = ["🥇", "🥈", "🥉"];
  const container = new ContainerBuilder().setAccentColor(RPG_COLOR);

  if (mode === "pvp") {
    const entries = pvpLadder();
    if (entries.length === 0) {
      container.addTextDisplayComponents(
        text("## ⚔️ BXH Tử Chiến (PvP)\nChưa ai vào vùng Tử Chiến — `/rpg arena` để cược haul rồi xâm lăng nhe bro!"),
      );
      return container.addSeparatorComponents(divider()).addActionRowComponents(ladderToggleRow(mode));
    }
    const nameOf = await displayNames(guild, entries.map((e) => e.userId));
    const lines = entries.map(
      (e, i) => `${medals[i] ?? `${i + 1}.`} **${escapeMarkdown(nameOf(e.userId))}** — ⚔️ ${e.power} · 🎒 ${e.haulSize} món cược`,
    );
    container.addTextDisplayComponents(text(`## ⚔️ BXH Tử Chiến (PvP)\n${lines.join("\n")}`));
    return container.addSeparatorComponents(divider()).addActionRowComponents(ladderToggleRow(mode));
  }

  const chars = loadCharacters();
  const ranking = Object.entries(chars)
    .map(([id, prof]) => ({ id, power: powerScore(prof), level: prof.level, cls: prof.cls }))
    .sort((a, b) => b.power - a.power)
    .slice(0, 10);
  if (ranking.length === 0) {
    container.addTextDisplayComponents(text("## 🏆 BXH Power Cửa Ải (PvE)\nChưa ai chơi Cửa Ải cả — `/rpg create` mở màn đi bro!"));
    return container.addSeparatorComponents(divider()).addActionRowComponents(ladderToggleRow(mode));
  }
  const nameOf = await displayNames(guild, ranking.map((r) => r.id));
  const lines = ranking.map(
    (r, i) => `${medals[i] ?? `${i + 1}.`} **${escapeMarkdown(nameOf(r.id))}** ${CLASSES[r.cls].emoji} Lv${r.level} — ⚔️ ${r.power}`,
  );
  container.addTextDisplayComponents(text(`## 🏆 BXH Power Cửa Ải (PvE)\n${lines.join("\n")}`));
  return container.addSeparatorComponents(divider()).addActionRowComponents(ladderToggleRow(mode));
}

// ─────────────────────────────────────────────────────────────────────────────
// Ải Tử Chiến (full-loot PvP) — the /rpg arena zone panel + /rpg invade duel result.
// The cores live in ../rpg-pvp (enterZone/extractZone/invade/pvpStatus). Full-loot rule:
// equipped gear is ALWAYS safe; only the staked haul (bag gear) is at risk. When NOT in
// the zone the panel offers a gear multi-select to stake as the haul (rpg:arena:stake);
// once staked it shows the haul + an Extract button (rpg:arena:extract). Every render is
// V2 (privateBoardPayload) so it can update in place, mirroring the gear/market pickers.
// ─────────────────────────────────────────────────────────────────────────────

// The gear multi-select to stake bag gear as the at-risk haul. Empty bag → null (no menu).
function pvpStakeRow(bag: GearItem[]): ActionRowBuilder<StringSelectMenuBuilder> | null {
  if (bag.length === 0) return null;
  const options = bag.slice(0, 25).map((it) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(gearPlainName(it).slice(0, 100))
      .setDescription(`${GEAR_SLOTS.find((s) => s.id === it.slot)?.name} · ${gearStatLine(it)}`.slice(0, 100))
      .setValue(it.id),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("rpg:arena:stake")
      .setPlaceholder("🎒 Chọn đồ cược làm haul (đồ đang mặc luôn an toàn)")
      .setMinValues(1)
      .setMaxValues(Math.min(bag.length, 25))
      .addOptions(options),
  );
}

// The Ải Tử Chiến zone panel — status when staked (haul + Extract), stake picker when not.
function pvpZonePanel(profile: RpgProfile, status: PvpStatus | null): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0xc0392b);
  if (status) {
    // Already in the zone — show the at-risk haul + how to leave / hunt.
    const haulLines = status.haulGear.length > 0 ? gearTable(status.haulGear) : "_không cược món nào — chỉ đứng vùng để xâm lăng_";
    const body = [
      "## ⚔️ Ải Tử Chiến — đang trong vùng",
      `🎒 **Haul đang cược (${status.haulGear.length} món):**`,
      haulLines,
      "",
      `⚔️ **Power:** ${status.power} · thắng thì ôm haul đối thủ, thua thì mất haul này (đồ đang mặc luôn an toàn).`,
      "-# `/rpg invade` để xâm lăng một đối thủ cùng tầm sức mạnh, hoặc Rút lui để ôm haul về túi.",
    ].join("\n");
    container.addTextDisplayComponents(text(body)).addSeparatorComponents(divider());
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("rpg:arena:extract").setLabel("Rút lui (ôm haul về)").setEmoji("🏳️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rpg:arena:invade").setLabel("Xâm lăng").setEmoji("🗡️").setStyle(ButtonStyle.Danger),
      ),
    );
    return container;
  }
  // Not in the zone — stake bag gear to enter.
  const body = [
    "## ⚔️ Ải Tử Chiến (full-loot PvP)",
    `⚔️ **Power của bro:** ${powerScore(profile)} — chỉ đấu người cùng tầm sức mạnh (bracket).`,
    "Cược vài món trong túi làm **haul**, rồi xâm lăng người khác. **Thắng ôm haul đối thủ, thua mất haul mình** — đồ đang mặc thì luôn an toàn.",
    "",
    profile.bag.length === 0 ? "_Túi trống — đi ải `/rpg map` cày đồ để có gì mà cược nhe bro._" : "-# Chọn đồ cược bên dưới để vào vùng. Không cược cũng vào được để đi săn, nhưng cược mới có cái để bị cướp/cướp.",
  ].join("\n");
  container.addTextDisplayComponents(text(body)).addSeparatorComponents(divider());
  const stakeRow = pvpStakeRow(profile.bag);
  if (stakeRow) container.addActionRowComponents(stakeRow);
  return container;
}

// Render an invasion result (the duel log from autoBattle + the spoils moved).
function invadeContainer(userId: string, result: InvadeResult): ContainerBuilder {
  const logText = result.log.length > 0 ? result.log.slice(-8).join("\n") : "_trận đấu diễn ra chớp nhoáng_";
  const head = result.win ? "🏆 THẮNG" : "💀 THUA";
  const spoilsLine = result.win
    ? result.emptyHaul
      ? "Đối thủ không cược gì — thắng nhưng chưa ôm được món nào bro."
      : `🎒 Cướp được **${result.spoils.length}** món từ ${escapeMarkdown(result.targetName)}:\n${gearTable(result.spoils)}`
    : result.spoils.length > 0
      ? `🩸 Mất **${result.spoils.length}** món haul vào tay ${escapeMarkdown(result.targetName)}:\n${gearTable(result.spoils)}`
      : "Thua nhưng bro không cược haul nên chẳng mất gì.";
  const body = [
    `## ${head} — Ải Tử Chiến`,
    `<@${userId}> (⚔️ ${result.yourPower}) đối đầu **${escapeMarkdown(result.targetName)}** (⚔️ ${result.targetPower})`,
    "",
    "**📜 Diễn biến:**",
    logText,
    "",
    spoilsLine,
  ].join("\n");
  return new ContainerBuilder().setAccentColor(result.win ? 0x2ecc71 : 0xe74c3c).addTextDisplayComponents(text(body));
}

// ─────────────────────────────────────────────────────────────────────────────
// The Command
// ─────────────────────────────────────────────────────────────────────────────

const rpg: Command = {
  data: new SlashCommandBuilder()
    .setName("rpg")
    .setDescription("PoE-style idle RPG: build a hero, run maps, enhance gear, farm loot. Guide: /rpg guide")
    .addSubcommand((sub) => sub.setName("guide").setDescription("Hướng dẫn chơi (phân trang)"))
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Tạo hero (chọn class)")
        .addStringOption((opt) =>
          opt
            .setName("class")
            .setDescription("Class muốn chơi")
            .addChoices(
              { name: "🛡️ Warrior", value: "chien" },
              { name: "🔮 Sorceress", value: "phap" },
              { name: "🏹 Ranger", value: "cung" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("hero")
        .setDescription("Xem character sheet (build đầy đủ)")
        .addUserOption((opt) => opt.setName("cua").setDescription("Xem hero của ai (bỏ trống = mình)")),
    )
    .addSubcommand((sub) => sub.setName("levelup").setDescription("Lên cấp bằng ✨ Essence (nút Nâng tối đa dồn hết)"))
    .addSubcommand((sub) => sub.setName("skills").setDescription("Skill gem — đặt skill chính + gắn support gem"))
    .addSubcommand((sub) => sub.setName("passives").setDescription("Passive tree — học node theo nhánh"))
    .addSubcommand((sub) => sub.setName("flask").setDescription("Flask — chọn flask mang theo"))
    .addSubcommand((sub) => sub.setName("prestige").setDescription("Prestige & shop Jewel"))
    .addSubcommand((sub) => sub.setName("ladder").setDescription("Bảng xếp hạng — Power PvE / Tử Chiến PvP (nút chuyển)"))
    .addSubcommand((sub) => sub.setName("arena").setDescription("Ải Tử Chiến — cược haul gear rồi rút lui (full-loot PvP)"))
    .addSubcommand((sub) => sub.setName("invade").setDescription("Xâm lăng một đối thủ cùng tầm sức mạnh trong Ải Tử Chiến"))
    .addSubcommand((sub) => sub.setName("inventory").setDescription("Xem inventory"))
    .addSubcommand((sub) => sub.setName("equip").setDescription("Mặc một món trong inventory"))
    .addSubcommand((sub) =>
      sub
        .setName("unequip")
        .setDescription("Tháo gear ở một slot")
        .addStringOption((opt) =>
          opt
            .setName("slot")
            .setDescription("Slot muốn tháo")
            .setRequired(true)
            .addChoices(...GEAR_SLOTS.map((s) => ({ name: `${s.emoji} ${s.name}`, value: s.id }))),
        ),
    )
    .addSubcommand((sub) => sub.setName("enhance").setDescription("Enhance gear (may rủi — đập đồ)"))
    .addSubcommand((sub) => sub.setName("ghep").setDescription("⭐ Ghép Sao — nung đồ cùng loại vào 1 món để lên sao + nâng mod"))
    .addSubcommand((sub) => sub.setName("salvage").setDescription("Salvage đồ thừa lấy 🔩 Shard (lẻ hoặc hàng loạt)"))
    .addSubcommand((sub) => sub.setName("auto-equip").setDescription("Tự mặc gear mạnh nhất trong inventory (1 chạm)"))
    .addSubcommand((sub) => sub.setName("vendor").setDescription("Bán rác cho NPC lấy coin (lẻ hoặc hàng loạt)"))
    .addSubcommand((sub) => sub.setName("atlas").setDescription("Atlas — danh sách region + luật tuần, chọn region rồi map"))
    .addSubcommand((sub) =>
      sub
        .setName("supply")
        .setDescription("Mua Provision/Life Potion/Charm bằng coin (đốt coin)")
        .addStringOption((opt) =>
          opt
            .setName("loai")
            .setDescription("Loại muốn mua")
            .setRequired(true)
            .addChoices(
              { name: `🍖 Provision (${SHOP_PRICES.luongthuc} 🪙)`, value: "luongthuc" },
              { name: `🧪 Life Potion (${SHOP_PRICES.thuoc} 🪙)`, value: "thuoc" },
              { name: `🛡️ Blessed Charm (${SHOP_PRICES.bua} 🪙)`, value: "bua" },
              { name: `🔶 Đá Đột Phá (${SHOP_PRICES.dotpha} 🪙)`, value: "dotpha" },
            ),
        )
        .addIntegerOption((opt) => opt.setName("soluong").setDescription("Số lượng").setRequired(true).setMinValue(1).setMaxValue(999)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("map")
        .setDescription("Chạy map (tự đem hết Provision + Life Potion trong kho)")
        .addStringOption((opt) => opt.setName("ai").setDescription("Region muốn đi").setRequired(true).addChoices(...STAGE_CHOICES))
        .addIntegerOption((opt) => opt.setName("dungtang").setDescription("Tự dừng khi đạt floor này (không bắt buộc)").setMinValue(1))
        .addIntegerOption((opt) => opt.setName("tier").setDescription("Map Tier (khó hơn = loot cao hơn; mở thêm bằng cày sâu)").setMinValue(1).setMaxValue(MAX_MAP_TIER)),
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Xem map run hiện tại"))
    .addSubcommand((sub) => sub.setName("recall").setDescription("Recall về sớm (giữ loot đã farm)"))
    .addSubcommand((sub) => sub.setName("market").setDescription("Chợ đồ — duyệt & mua gear, hoặc rao bán món của mình")),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    // huong-dan — no character needed.
    if (sub === "guide") {
      await interaction.reply(privateBoardPayload(guideContainer("tongquan")));
      return;
    }

    const profile = loadCharacters()[userId] ?? null;

    // First-touch onboarding: any /rpg (except tao-nhan-vat) with no character → create screen.
    if (!profile && sub !== "tao-nhan-vat") {
      await interaction.reply(privateBoardPayload(createScreen()));
      return;
    }

    // --- nhân vật ---
    if (sub === "create") {
      if (profile) {
        await interaction.reply({
          content: `Bro có nhân vật rồi (${CLASSES[profile.cls].emoji} ${CLASSES[profile.cls].name} Lv${profile.level}) — xem bằng \`/rpg hero\` nhe.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const cls = interaction.options.getString("class") as ClassId | null;
      if (!cls) {
        await interaction.reply(privateBoardPayload(createScreen()));
        return;
      }
      const created = createCharacter(guildId, userId, cls);
      if ("error" in created) {
        await interaction.reply({ content: created.error, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply(
        characterSheetReply(created, interaction.member.displayName, {
          intro: `🎉 Đã tạo **${CLASSES[cls].name}**! Bắt đầu hành trình đi bro.${hintLine(created)}`,
          owner: true,
        }),
      );
      return;
    }

    const p = profile!;

    if (sub === "hero") {
      const target = interaction.options.getUser("cua") ?? interaction.user;
      const targetProfile = loadCharacters()[target.id];
      if (!targetProfile) {
        await interaction.reply({
          content: target.id === userId ? "Bro chưa có nhân vật — tạo bằng `/rpg create` nhe." : `<@${target.id}> chưa chơi Cửa Ải bro.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      const name = member?.displayName ?? target.displayName;
      await interaction.reply(characterSheetReply(targetProfile, name, { owner: target.id === userId }));
      return;
    }

    if (sub === "levelup") {
      const result = doLevelUp(guildId, userId);
      const after = loadCharacters()[userId]!;
      await interaction.reply(privateBoardPayload(levelUpContainer(userId, result, after)));
      return;
    }

    if (sub === "skills" || sub === "ngoc") {
      await interaction.reply(privateBoardPayload(skillPanel(p)));
      return;
    }

    if (sub === "passives") {
      await interaction.reply(privateBoardPayload(treePanel(p, guildId, userId)));
      return;
    }

    if (sub === "flask") {
      await interaction.reply(privateBoardPayload(flaskPanel(p)));
      return;
    }

    if (sub === "prestige") {
      await interaction.reply(privateBoardPayload(taisinhPanel(p)));
      return;
    }

    if (sub === "ladder") {
      await interaction.deferReply();
      await interaction.editReply(boardPayload(await ladderContainer(interaction.guild, "pve")));
      return;
    }

    // --- Ải Tử Chiến (PvP) ---
    if (sub === "arena") {
      await interaction.reply(privateBoardPayload(pvpZonePanel(p, pvpStatus(userId))));
      return;
    }

    if (sub === "invade") {
      const name = interaction.member.displayName;
      const result = invade(guildId, userId, name, Math.random);
      if ("error" in result) {
        await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        return;
      }
      // Public duel result — everyone sees who raided whom (PvP is public by design, like WC bets).
      await interaction.reply(boardPayload(invadeContainer(userId, result)));
      return;
    }

    // --- trang bị ---
    if (sub === "inventory") {
      if (p.bag.length === 0) {
        await interaction.reply({ content: "Túi trống trơn bro — đi ải `/rpg map` cày đồ đã nhe.", flags: MessageFlags.Ephemeral });
        return;
      }
      const shown = p.bag.slice(0, 15);
      const table = codeBlock(
        listTable(
          ["#", "Tên", "Ô", "Cấp", "ΔSM"],
          shown.map((it, i) => [
            String(i + 1),
            itemName(it),
            GEAR_SLOTS.find((s) => s.id === it.slot)?.name ?? it.slot,
            itemTier(it),
            deltaCell(equipDelta(p, it)),
          ]),
          ["l", "l", "l", "l", "r"],
        ),
      );
      const embed = new EmbedBuilder()
        .setTitle(`🎒 Inventory (${p.bag.length}/${BAG_LIMIT})`)
        .setColor(RPG_COLOR)
        .setDescription(table + (p.bag.length > 15 ? `\n-# …và ${p.bag.length - 15} món nữa` : ""))
        .setFooter({ text: "Equip: /rpg equip · Enhance: /rpg enhance · Salvage: /rpg salvage · ▲/▼ so với đồ đang mặc" });
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "equip") {
      if (p.bag.length === 0) {
        await interaction.reply({ content: "Túi trống — không có gì để mặc bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const items = p.bag.map((it) => ({
        item: it,
        desc: `${GEAR_SLOTS.find((s) => s.id === it.slot)?.name} · ${deltaTag(equipDelta(p, it))}`,
      }));
      await interaction.reply(
        privateBoardPayload(pickerContainer("Chọn món muốn mặc:", gearSelectRow("selequip", "🎽 Chọn đồ để mặc", items))),
      );
      return;
    }

    if (sub === "unequip") {
      const slot = interaction.options.getString("slot", true) as GearSlot;
      const result = unequipSlot(userId, slot);
      if (!result.ok) {
        await interaction.reply({
          content: result.reason === "empty" ? "Ô đó đang trống bro." : `Túi đầy (${BAG_LIMIT}) rồi — phân rã bớt đã nhe.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ content: `🫳 Đã tháo ${gearName(result.item)} về túi.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "enhance") {
      const pool = [
        ...GEAR_SLOTS.map((s) => p.gear[s.id]).filter((it): it is GearItem => !!it),
        ...p.bag,
      ].filter((it) => it.plus < MAX_PLUS);
      if (pool.length === 0) {
        await interaction.reply({ content: "Không có món nào để cường hóa (hoặc tất cả đã +12) bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const items = pool.map((it) => ({
        item: it,
        desc: canBreakthrough(it)
          ? `🔒 +${it.plus} chạm trần · cần Đột Phá 🔶`
          : `+${it.plus}→+${it.plus + 1} · ${pct(ENHANCE_TABLE[it.plus]!.up)}`,
      }));
      await interaction.reply(
        privateBoardPayload(pickerContainer("Chọn món muốn cường hóa:", gearSelectRow("selenh", "🔨 Chọn đồ để cường hóa", items))),
      );
      return;
    }

    if (sub === "ghep") {
      const pool = starableItems(p);
      if (pool.length === 0) {
        await interaction.reply({ content: "Không có món nào để ghép sao (tất cả đã 5⭐, hoặc chưa có gear) bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const items = pool.map((it) => {
        const star = it.star ?? 0;
        const have = p.bag.filter((b) => b.id !== it.id && b.slot === it.slot).length;
        return { item: it, desc: `${star}⭐→${star + 1}⭐ · cần ${mergeFodderNeeded(star)} món cùng ô (có ${have})` };
      });
      await interaction.reply(
        privateBoardPayload(pickerContainer("Chọn món muốn ghép sao:", gearSelectRow("selghep", "⭐ Chọn đồ để ghép sao", items))),
      );
      return;
    }

    if (sub === "salvage") {
      if (p.bag.length === 0) {
        await interaction.reply({ content: "Túi trống — không có đồ thừa để phân rã bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply(privateBoardPayload(salvagePanel(p)));
      return;
    }

    if (sub === "auto-equip") {
      const result = autoEquipBestCore(userId);
      if ("error" in result) {
        await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply(privateBoardPayload(autoEquipContainer(userId, result)));
      return;
    }

    if (sub === "vendor") {
      await interaction.reply(privateBoardPayload(banShopPanel(p)));
      return;
    }

    // --- cửa ải ---
    if (sub === "atlas") {
      await interaction.reply(privateBoardPayload(mapPanel(p)));
      return;
    }

    if (sub === "supply") {
      const loai = interaction.options.getString("loai", true) as "luongthuc" | "thuoc" | "bua" | "dotpha";
      const qty = interaction.options.getInteger("soluong", true);
      const result = buyMaterial(userId, loai, qty);
      const mat = MATERIALS[loai];
      if (!result.ok) {
        await interaction.reply({
          content: `Chưa đủ coin bro — cần **${result.need}** 🪙 mua ${qty} ${mat.emoji}, ví có **${result.have}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      logRpgEvent(guildId, { kind: "supply_buy", userId, item: loai, qty: result.qty, cost: result.price });
      await interaction.reply({
        content: `🛒 Mua **${qty}** ${mat.emoji} ${mat.name} — 🔥 đốt ${result.price} 🪙. Đang có: ${mat.emoji} ${result.total} · 🪙 ${result.balance}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "map") {
      const stageId = interaction.options.getString("ai", true);
      const stopAtFloor = interaction.options.getInteger("dungtang");
      // Clamp the requested tier to what the hero has EARNED (deepest-floor gate) — the option
      // caps at MAX_MAP_TIER but a low-progress hero can't dial a tier they haven't unlocked.
      const reqTier = interaction.options.getInteger("tier");
      const prof = loadCharacters()[userId];
      const tier = reqTier ? Math.max(1, Math.min(prof ? heroMaxTier(prof) : 1, reqTier)) : 1;
      const err = await dispatchExpedition(interaction, guildId, userId, interaction.channelId, stageId, stopAtFloor ?? null, tier);
      if (err) {
        await interaction.reply({ content: err.error, flags: MessageFlags.Ephemeral });
        return;
      }
      const after = loadCharacters()[userId];
      const hint = hintLine(after);
      if (hint) await interaction.followUp({ content: hint.trim(), flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }

    if (sub === "status") {
      const status = syncExpedition(guildId, userId);
      if (!status) {
        await interaction.reply({ content: "Bro chưa có kết quả chuyến đi nào — `/rpg map` lên đường nhe.", flags: MessageFlags.Ephemeral });
        return;
      }
      trackExpeditionSnapshot(userId, interaction.token);
      await interaction.reply(expeditionPayload(userId, status));
      return;
    }

    if (sub === "recall") {
      const status = recallExpedition(guildId, userId);
      if (!status) {
        await interaction.reply({ content: "Không có chuyến nào để rút bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      trackExpeditionSnapshot(userId, interaction.token);
      await interaction.reply(expeditionPayload(userId, status));
      return;
    }

    // --- chợ đồ ---
    if (sub === "market") {
      await interaction.reply(privateBoardPayload(marketBrowse(userId, 0)));
      return;
    }
  },

  async handleButton(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const [, area, action, arg, arg2] = interaction.customId.split(":");

    // Create screen buttons work without a profile; everything else needs one.
    if (area === "create") {
      const cls = action as ClassId;
      if (!CLASSES[cls]) return;
      if (loadCharacters()[userId]) {
        await interaction.reply({ content: "Bro có nhân vật rồi mà 😄 — `/rpg hero` nhe.", flags: MessageFlags.Ephemeral });
        return;
      }
      const created = createCharacter(guildId, userId, cls);
      if ("error" in created) {
        await interaction.reply({ content: created.error, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply(
        characterSheetReply(created, interaction.member.displayName, {
          intro: `🎉 <@${userId}> đã tạo **${CLASSES[cls].name}**!${hintLine(created)}`,
          owner: true,
        }),
      );
      return;
    }

    const profile = loadCharacters()[userId] ?? null;
    if (!profile) {
      await interaction.reply(privateBoardPayload(createScreen()));
      return;
    }

    // guide open (from the sheet)
    if (area === "guide" && action === "open") {
      await interaction.reply(privateBoardPayload(guideContainer("tongquan")));
      return;
    }

    // ── Private expedition snapshot buttons ───────────────────────────────────
    // Every custom id carries the owner id even though the ephemeral message is
    // visible only to that owner. The check also protects a stale legacy board.
    if (area === "expedition" && action === "refresh") {
      if (arg && arg !== userId) {
        await interaction.reply({ content: "Chuyến đi này không phải của bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const status = syncExpedition(guildId, userId);
      if (!status) {
        await interaction.update(privateBoardPayload(noticeContainer("Bro chưa có kết quả chuyến đi nào — `/rpg map` lên đường nhe.")));
        return;
      }
      trackExpeditionSnapshot(userId, interaction.token);
      await interaction.update(expeditionPayload(userId, status));
      return;
    }

    if (area === "boon") {
      if (arg && arg !== userId) {
        await interaction.reply({ content: "Ân huệ này của chuyến đi người khác nhe bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const picked = chooseBoon(guildId, userId, action ?? "");
      if ("error" in picked) {
        await interaction.reply({ content: picked.error, flags: MessageFlags.Ephemeral });
        return;
      }
      trackExpeditionSnapshot(userId, interaction.token);
      await interaction.update(expeditionPayload(userId, picked.status));
      return;
    }

    if (area === "recall") {
      if (action && action !== userId) {
        await interaction.reply({ content: "Chuyến đi này không phải của bro.", flags: MessageFlags.Ephemeral });
        return;
      }
      const status = recallExpedition(guildId, userId) ?? syncExpedition(guildId, userId);
      if (!status) {
        await interaction.reply({ content: "Bro đâu có đang đi ải.", flags: MessageFlags.Ephemeral });
        return;
      }
      trackExpeditionSnapshot(userId, interaction.token);
      await interaction.update(expeditionPayload(userId, status));
      return;
    }

    // One-tap dispatch from the hero sheet — the "just play" button. Sends the hero to the
    // deepest unlocked region so a new player sees a floor resolve immediately (and a veteran
    // taps straight to their frontier). Reuses the vetted dispatchExpedition (guard-first +
    // auto-ration), so an already-running run is refused in place with an ephemeral notice.
    if (area === "go" && action === "quick") {
      const target = quickGoRegion(profile);
      const res = await dispatchExpedition(interaction, guildId, userId, interaction.channelId, target.id, null, 1);
      if (res) await interaction.reply({ content: res.error, flags: MessageFlags.Ephemeral });
      return;
    }

    // skill / tree open (from the sheet)
    if (area === "skill" && action === "open") {
      await interaction.reply(privateBoardPayload(skillPanel(profile)));
      return;
    }
    if (area === "tree" && action === "open") {
      await interaction.reply(privateBoardPayload(treePanel(profile, guildId, userId)));
      return;
    }
    if (area === "tree" && action === "back") {
      await interaction.update(privateBoardPayload(treePanel(loadCharacters()[userId]!, guildId, userId)));
      return;
    }
    if (area === "tree" && action === "respec") {
      const allocated = (loadCharacters()[userId]?.passives ?? []).length;
      if (allocated === 0) {
        await interaction.update(privateBoardPayload(treePanel(loadCharacters()[userId]!, guildId, userId)));
        return;
      }
      const confirm = new ContainerBuilder()
        .setAccentColor(CLASS_COLOR[profile.cls])
        .addTextDisplayComponents(
          text(`## ♻️ Respec toàn bộ?\nHoàn lại **${allocated}** điểm passive để phân bổ lại từ đầu. Miễn phí — điểm không mất đi, chỉ cần học lại.`),
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("rpg:tree:respecyes").setStyle(ButtonStyle.Danger).setEmoji("♻️").setLabel("Xác nhận respec"),
            new ButtonBuilder().setCustomId("rpg:tree:back").setStyle(ButtonStyle.Secondary).setEmoji("↩️").setLabel("Huỷ"),
          ),
        );
      await interaction.update(privateBoardPayload(confirm));
      return;
    }
    if (area === "tree" && action === "respecyes") {
      respecPassives(guildId, userId);
      await interaction.update(privateBoardPayload(treePanel(loadCharacters()[userId]!, guildId, userId)));
      return;
    }

    // atlas tree open (from the /rpg atlas map panel) — a fresh ephemeral panel.
    if (area === "atlas" && action === "open") {
      await interaction.reply(privateBoardPayload(atlasTreePanel(profile)));
      return;
    }

    if (area === "atlas" && action === "respec") {
      const r = respecAtlasCore(guildId, userId);
      if (!r.ok) {
        await interaction.reply({ content: r.reason, flags: MessageFlags.Ephemeral });
        return;
      }
      // Re-render the panel in place (points free again), plus a short ephemeral confirmation.
      await interaction.update(privateBoardPayload(atlasTreePanel(loadCharacters()[userId]!)));
      await interaction
        .followUp({ content: `♻️ Đã respec Atlas — trả lại **${r.refunded}** điểm, đốt ${ATLAS_RESPEC_COST} 🪙 (ví còn ${r.balance}).`, flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    // Ải Tử Chiến buttons — extract (rút lui) collapses the panel; invade posts a public duel.
    if (area === "arena") {
      if (action === "extract") {
        const r = extractZone(userId);
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(r.reason === "notin" ? "Bro chưa vào vùng Tử Chiến nhe." : "Không tìm thấy nhân vật của bro.")));
          return;
        }
        const back = r.banked.length > 0 ? `ôm ${r.banked.length} món haul về túi` : "rời vùng (không có haul)";
        await interaction.update(privateBoardPayload(noticeContainer(`🏳️ Đã rút lui — ${back}.`)));
        return;
      }
      if (action === "invade") {
        const result = invade(guildId, userId, interaction.member.displayName, Math.random);
        if ("error" in result) {
          await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
          return;
        }
        // Collapse the ephemeral panel, then post the duel result publicly (PvP is public).
        await interaction.update(privateBoardPayload(noticeContainer(result.win ? "🗡️ Xâm lăng thắng lợi — coi kết quả bên dưới nhe!" : "🗡️ Xâm lăng thất bại — coi kết quả bên dưới nhe.")));
        await interaction.followUp(boardPayload(invadeContainer(userId, result)));
        return;
      }
      return;
    }

    // auras & curses — open the loadout panel from the sheet (the equip/unequip itself
    // rides the two select menus in handleSelect).
    if (area === "aura" && action === "open") {
      await interaction.reply(privateBoardPayload(aurasCursesPanel(profile)));
      return;
    }

    // ascendancy (subclass) — open the panel from the sheet, or pick a subclass in place.
    if (area === "asc") {
      if (action === "open") {
        await interaction.reply(privateBoardPayload(ascendancyPanel(profile)));
        return;
      }
      if (action === "pick" && arg) {
        const r = pickAscendancy(guildId, userId, arg);
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(`⭐ ${r.reason}`)));
          return;
        }
        await interaction.update(privateBoardPayload(ascendancyPanel(loadCharacters()[userId]!)));
        return;
      }
      return;
    }

    // char actions
    if (area === "char") {
      if (action === "levelup") {
        const result = doLevelUp(guildId, userId);
        const after = loadCharacters()[userId]!;
        await interaction.reply({ embeds: [levelUpEmbed(userId, result, after)], flags: MessageFlags.Ephemeral });
        return;
      }
      if (action === "levelmax") {
        const result = doLevelUp(guildId, userId, true);
        const after = loadCharacters()[userId]!;
        await interaction.update(privateBoardPayload(levelUpContainer(userId, result, after)));
        return;
      }
      if (action === "prestige") {
        await interaction.reply(privateBoardPayload(taisinhPanel(profile)));
        return;
      }
      if (action === "prestige_confirm") {
        const result = prestigeCore(guildId, userId);
        if ("error" in result) {
          await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(
          privateBoardPayload(
            noticeContainer(
              `## 🌟 Prestige thành công!\nNhận **+${result.gained}** 🔮 Jewel (tổng ${result.coNgoc}). Hero về Lv1, passive tree hoàn lại điểm — đầu region giờ lướt nhanh, tiến xa hơn nhe bro!`,
              0xf1c40f,
            ),
          ),
        );
        return;
      }
      if (action === "perk" && arg) {
        const perkId = arg as PerkId;
        if (!PERKS[perkId]) return;
        const chars = loadCharacters();
        const p = chars[userId]!;
        const level = p.perks?.[perkId] ?? 0;
        if (level >= PERKS[perkId].maxLevel) {
          await interaction.reply({ content: "Perk này đã tối đa rồi bro.", flags: MessageFlags.Ephemeral });
          return;
        }
        const cost = perkCost(perkId, level);
        if (p.coNgoc < cost) {
          await interaction.reply({ content: `Chưa đủ Jewel — cần ${cost} 🔮, đang có ${p.coNgoc}.`, flags: MessageFlags.Ephemeral });
          return;
        }
        p.coNgoc -= cost;
        p.perks = { ...p.perks, [perkId]: level + 1 };
        saveCharacters(chars);
        await interaction.update(privateBoardPayload(taisinhPanel(p)));
        return;
      }
      return;
    }

    // ladder toggle (PvE ⇄ PvP) — flip the board in place.
    if (area === "ladder" && (action === "pve" || action === "pvp")) {
      await interaction.update(boardPayload(await ladderContainer(interaction.guild, action)));
      return;
    }

    // do (enhance gamble / bulk salvage / ⭐ ghép sao) buttons
    if (area === "do") {
      if (action === "enhcancel" || action === "ghepcancel") {
        await interaction.update(privateBoardPayload(noticeContainer(action === "ghepcancel" ? "Đã huỷ ghép sao." : "Đã huỷ cường hóa.")));
        return;
      }
      if (action === "ghepgo" && arg) {
        const outcome = mergeCore(guildId, userId, arg);
        if ("error" in outcome) {
          await interaction.reply({ content: outcome.error, flags: MessageFlags.Ephemeral });
          return;
        }
        const after = loadCharacters()[userId]!;
        const survived = findItem(after, arg);
        if (survived && (survived.item.star ?? 0) < MAX_STAR) {
          await interaction.update(privateBoardPayload(ghepPanel(after, survived.item, mergeResultText(outcome))));
        } else {
          await interaction.update(privateBoardPayload(noticeContainer(mergeResultText(outcome), 0xf1c40f)));
        }
        return;
      }
      if (action === "bulksalv" && arg !== undefined) {
        const maxRarity = Number(arg) as Rarity;
        const result = bulkSalvageCore(userId, maxRarity);
        if ("error" in result) {
          await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(
          privateBoardPayload(
            noticeContainer(
              result.count === 0
                ? "Không có món nào ở mức đó để phân rã bro."
                : `♻️ Đã phân rã **${result.count}** món → +${result.manh} ${MATERIALS.manh.emoji} mảnh (tổng ${result.total}).`,
            ),
          ),
        );
        return;
      }
      if (action === "enhgo" && arg) {
        const outcome = attemptEnhance(guildId, userId, arg, arg2 === "charm");
        if ("error" in outcome) {
          await interaction.reply({ content: outcome.error, flags: MessageFlags.Ephemeral });
          return;
        }
        const after = loadCharacters()[userId]!;
        const survived = findItem(after, arg);
        if (survived && survived.item.plus < MAX_PLUS) {
          await interaction.update(privateBoardPayload(enhancePanel(after, survived.item, enhanceResultText(outcome))));
        } else {
          await interaction.update(privateBoardPayload(noticeContainer(enhanceResultText(outcome), enhanceResultColor(outcome.result))));
        }
        return;
      }
      if (action === "breakgo" && arg) {
        const outcome = attemptBreakthrough(guildId, userId, arg);
        if ("error" in outcome) {
          await interaction.reply({ content: outcome.error, flags: MessageFlags.Ephemeral });
          return;
        }
        const after = loadCharacters()[userId]!;
        const survived = findItem(after, arg);
        // The item is now below its new ceiling → drop back into the enhance panel to keep đập-ing.
        if (survived && survived.item.plus < MAX_PLUS) {
          await interaction.update(privateBoardPayload(enhancePanel(after, survived.item, breakthroughResultText(outcome))));
        } else {
          await interaction.update(privateBoardPayload(noticeContainer(breakthroughResultText(outcome), 0xf39c12)));
        }
        return;
      }
      return;
    }

    // ban (NPC quick-sell) bulk buttons
    if (area === "ban") {
      if (action === "sell" && arg !== undefined) {
        const maxRarity = Number(arg) as Rarity;
        const result = sellJunkCore(guildId, userId, maxRarity);
        if ("error" in result) {
          await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(privateBoardPayload(noticeContainer(sellResultNotice(result), 0xf1c40f)));
        return;
      }
      return;
    }

    // cho (marketplace) buttons
    if (area === "cho") {
      if (action === "page") {
        const page = Number(arg ?? "0") || 0;
        await interaction.update(privateBoardPayload(marketBrowse(userId, page)));
        return;
      }
      if (action === "sellopen") {
        if (profile.bag.length === 0) {
          await interaction.reply({ content: "Túi trống — không có gì để bán bro. Đi ải `/rpg map` cày đồ đã nhe.", flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.update(
          privateBoardPayload(pickerContainer("Chọn món muốn rao bán (bước sau nhập giá):", marketSellRow(profile.bag))),
        );
        return;
      }
      if (action === "buy" && arg) {
        const result = buyListing(userId, arg);
        await interaction.update(privateBoardPayload(marketBrowse(userId, 0)));
        if ("error" in result) await interaction.followUp({ content: result.error, flags: MessageFlags.Ephemeral });
        else {
          logRpgEvent(guildId, {
            kind: "market_buy",
            userId,
            sellerId: result.sellerId,
            rarity: result.item.rarity,
            base: result.item.base,
            price: result.price,
            tax: result.burned,
          });
          await interaction.followUp(privateBoardPayload(marketBoughtContainer(userId, result)));
        }
        return;
      }
      if (action === "cancel" && arg) {
        const result = cancelListing(userId, arg);
        await interaction.update(privateBoardPayload(marketBrowse(userId, 0)));
        if (!result.ok) {
          const msg =
            result.reason === "notyours"
              ? "Đây không phải tin của bro."
              : result.reason === "full"
                ? `Túi đầy (${BAG_LIMIT}) — phân rã bớt rồi gỡ nhe.`
                : "Tin này không còn nữa bro.";
          await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.followUp({ content: `↩️ Đã gỡ ${gearName(result.item)} khỏi chợ, món về túi.`, flags: MessageFlags.Ephemeral });
        }
        return;
      }
      return;
    }

  },

  async handleSelect(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const [, area, action] = interaction.customId.split(":");

    if (area === "guide" && action === "page") {
      const id = interaction.values[0] ?? "tongquan";
      await interaction.update(privateBoardPayload(guideContainer(id)));
      return;
    }

    const profile = loadCharacters()[userId] ?? null;
    if (!profile) {
      await interaction.reply(privateBoardPayload(createScreen()));
      return;
    }

    // skill: set main / socket / unsocket → refresh the skill panel in place.
    if (area === "skill") {
      if (action === "setmain") {
        const r = setMainSkill(guildId, userId, Number(interaction.values[0]));
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(r.reason)));
          return;
        }
        await interaction.update(privateBoardPayload(skillPanel(loadCharacters()[userId]!)));
        return;
      }
      if (action === "socket") {
        const r = socketSupport(guildId, userId, Number(interaction.values[0]));
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(r.reason)));
          return;
        }
        await interaction.update(privateBoardPayload(skillPanel(loadCharacters()[userId]!)));
        return;
      }
      if (action === "unsocket") {
        const r = unsocketSupport(guildId, userId, Number(interaction.values[0]));
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(r.reason)));
          return;
        }
        await interaction.update(privateBoardPayload(skillPanel(loadCharacters()[userId]!)));
        return;
      }
      if (action === "salvage") {
        const r = salvageGemDuplicates(guildId, userId, interaction.values[0]!);
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(r.reason)));
          return;
        }
        // The panel repaints with the new ×N and 🔩 count; the follow-up says what was traded,
        // because the number of shards earned is the one thing the board can't show by itself.
        await interaction.update(privateBoardPayload(skillPanel(loadCharacters()[userId]!)));
        await interaction.followUp({ content: `🔩 Phân rã **${r.count}** bản **${r.name}** → **+${r.manh}** 🔩 (tổng ${r.total}).`, flags: MessageFlags.Ephemeral });
        return;
      }
      return;
    }

    // tree: pick a cluster to view / allocate a node.
    if (area === "tree") {
      if (action === "cluster") {
        await interaction.update(privateBoardPayload(treePanel(profile, guildId, userId, interaction.values[0]!)));
        return;
      }
      if (action === "alloc") {
        const nodeId = interaction.values[0]!;
        const r = allocateNode(guildId, userId, nodeId);
        if (!r.ok) {
          await interaction.update(privateBoardPayload(noticeContainer(`🌳 ${r.reason}`)));
          return;
        }
        const after = loadCharacters()[userId]!;
        const cluster = NODE_BY_ID[nodeId]?.cluster;
        await interaction.update(privateBoardPayload(treePanel(after, guildId, userId, cluster)));
        return;
      }
      return;
    }

    // atlas: allocate one Atlas node → refresh the Atlas Tree panel in place.
    if (area === "atlas" && action === "alloc") {
      const r = allocateAtlasNode(guildId, userId, interaction.values[0]!);
      if (!r.ok) {
        await interaction.update(privateBoardPayload(noticeContainer(`🗺️ ${r.reason}`)));
        return;
      }
      await interaction.update(privateBoardPayload(atlasTreePanel(loadCharacters()[userId]!)));
      return;
    }

    // arena: stake the chosen bag gear as the at-risk haul → enter the zone, refresh in place.
    if (area === "arena" && action === "stake") {
      const r = enterZone(userId, interaction.values, interaction.member.displayName);
      if (!r.ok) {
        const msg =
          r.reason === "already"
            ? "Bro đang trong vùng rồi — rút lui trước đã nhe."
            : r.reason === "nochar"
              ? "Bro chưa có nhân vật nhe."
              : r.reason === "empty"
                ? "Chưa chọn món nào để cược bro."
                : "Mấy món đó không còn trong túi (chắc vừa dùng rồi).";
        await interaction.update(privateBoardPayload(noticeContainer(`⚔️ ${msg}`)));
        return;
      }
      await interaction.update(privateBoardPayload(pvpZonePanel(loadCharacters()[userId]!, pvpStatus(userId))));
      return;
    }

    // flask: set the carried flask set.
    if (area === "flask" && action === "toggle") {
      setFlasks(userId, interaction.values);
      await interaction.update(privateBoardPayload(flaskPanel(loadCharacters()[userId]!)));
      return;
    }

    // aura: set the running aura set (multi) / set-or-clear the curse (single) → refresh in place.
    if (area === "aura") {
      if (action === "set") {
        setAuras(userId, interaction.values);
        await interaction.update(privateBoardPayload(aurasCursesPanel(loadCharacters()[userId]!)));
        return;
      }
      if (action === "curse") {
        setCurse(userId, interaction.values[0]);
        await interaction.update(privateBoardPayload(aurasCursesPanel(loadCharacters()[userId]!)));
        return;
      }
      return;
    }

    // map: picked a region → dispatch the expedition on the same interaction.
    if (area === "map" && action === "tier") {
      // Re-render the panel at the chosen tier; the region select below carries it into dispatch.
      const profile = loadCharacters()[userId]!;
      const chosen = Number(interaction.values[0]) || 1;
      await interaction.update(privateBoardPayload(mapPanel(profile, chosen)));
      return;
    }

    if (area === "map" && action === "region") {
      // value = "<regionId>:<tier>" — split off the tier the panel baked in (clamped again to
      // what the hero has earned, so a stale/forged value can't dial past the cap).
      const [stageId, tierStr] = interaction.values[0]!.split(":");
      const tier = Math.max(1, Math.min(heroMaxTier(loadCharacters()[userId]!), Number(tierStr) || 1));
      // Pre-check BEFORE collapsing the panel — a blocked start (đã đi ải / ải khoá / chưa
      // có nhân vật) must NOT leave a false "đang lên đường" notice, so surface it in place.
      const block = expeditionBlockReason(userId, stageId!);
      if (block) {
        await interaction.update(privateBoardPayload(noticeContainer(block)));
        return;
      }
      // Cleared the gate → show a short private transition while the run is created.
      await interaction.update(privateBoardPayload(noticeContainer(`🗺️ Đang lên đường... (T${tier})`)));
      const err = await dispatchExpedition(interaction, guildId, userId, interaction.channelId, stageId!, null, tier);
      if (err) {
        // A rare post-refill ration failure: replace the "đang lên đường" notice with the real reason.
        await interaction.editReply(privateBoardPayload(noticeContainer(err.error))).catch(() => {});
      }
      return;
    }

    // cho: picked an item to sell → open the price modal.
    if (area === "cho" && action === "chosell") {
      const chosenId = interaction.values[0]!;
      const found = profile.bag.find((g) => g.id === chosenId);
      if (!found) {
        await interaction.update(privateBoardPayload(noticeContainer("Món này không còn trong túi bro.")));
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`rpg:cho:price:${chosenId}`)
        .setTitle("Rao bán trang bị")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("gia")
              .setLabel(`Giá bán (coin) — ${GEAR_BASES[found.base]?.name ?? found.base}`.slice(0, 45))
              .setPlaceholder("VD: 500")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(9),
          ),
        );
      await interaction.showModal(modal);
      return;
    }

    // ban: picked one item to NPC-sell → cap-safe sell just that id.
    if (area === "ban" && action === "one") {
      const result = sellItemsCore(guildId, userId, [interaction.values[0]!]);
      if ("error" in result) {
        await interaction.update(privateBoardPayload(noticeContainer(result.error)));
        return;
      }
      await interaction.update(privateBoardPayload(noticeContainer(sellResultNotice(result), 0xf1c40f)));
      return;
    }

    if (area !== "do") return;
    const itemId = interaction.values[0]!;

    if (action === "selequip") {
      const result = equipItem(userId, itemId);
      if (!result.ok) {
        await interaction.update(
          privateBoardPayload(
            noticeContainer(result.reason === "already" ? "Món này đang mặc rồi bro." : "Món này không còn trong túi (chắc vừa dùng rồi)."),
          ),
        );
        return;
      }
      const after = loadCharacters()[userId]!;
      await interaction.update(
        privateBoardPayload(
          noticeContainer(
            `🎽 Đã mặc ${gearName(result.item)}${result.replaced ? ` (tháo ${gearName(result.replaced)} về túi)` : ""}.` + hintLine(after),
          ),
        ),
      );
      return;
    }

    if (action === "selsalv") {
      const result = salvageItem(guildId, userId, itemId);
      if (!result.ok) {
        await interaction.update(privateBoardPayload(noticeContainer("Món này không còn trong túi bro.")));
        return;
      }
      await interaction.update(
        privateBoardPayload(
          noticeContainer(`♻️ Phân rã ${gearName(result.item)} → +${result.manh} ${MATERIALS.manh.emoji} mảnh (tổng ${result.total}).`),
        ),
      );
      return;
    }

    if (action === "selenh") {
      const found = findItem(profile, itemId);
      if (!found) {
        await interaction.update(privateBoardPayload(noticeContainer("Món này không còn trong hành trang bro.")));
        return;
      }
      await interaction.update(privateBoardPayload(enhancePanel(profile, found.item)));
      return;
    }

    if (action === "selghep") {
      const found = findItem(profile, itemId);
      if (!found) {
        await interaction.update(privateBoardPayload(noticeContainer("Món này không còn trong hành trang bro.")));
        return;
      }
      await interaction.update(privateBoardPayload(ghepPanel(profile, found.item)));
      return;
    }
  },

  async handleModal(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const [, area, action, arg] = interaction.customId.split(":");

    // cho: price modal → create the listing (escrows the item out of the bag).
    if (area === "cho" && action === "price" && arg) {
      const raw = interaction.fields.getTextInputValue("gia").trim();
      if (!/^\d+$/.test(raw) || Number(raw) < 1) {
        await interaction.reply({ content: `"${raw}" không hợp lệ bro — nhập giá là số nguyên ≥ 1 nhe (VD: 500).`, flags: MessageFlags.Ephemeral });
        return;
      }
      const price = Number(raw);
      const result = listItem(userId, arg, price);
      if (!result.ok) {
        await interaction.reply({
          content: result.reason === "price" ? "Giá không hợp lệ bro." : "Món này không còn trong túi (chắc vừa mặc/bán rồi).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      logRpgEvent(guildId, {
        kind: "market_list",
        userId,
        rarity: result.listing.item.rarity,
        base: result.listing.item.base,
        price,
      });
      const nets = Math.floor(price * (1 - MARKET_TAX));
      await interaction.reply({
        content: `🏪 Đã rao bán ${gearName(result.listing.item)} giá **${price}** 🪙 (mã \`${result.listing.id}\`). Bán được thì bro nhận **${nets}** 🪙 (thuế 5% đốt). Ai cũng mua ở \`/rpg market\` nhe.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  },
};

export default rpg;
