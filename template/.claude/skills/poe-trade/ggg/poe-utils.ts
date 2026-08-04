/**
 * Pure utility functions for POE character data processing.
 * These are extracted from poe-character.ts to enable unit testing.
 */

import type { Item } from './stash';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Passive tree cache utilities
// ---------------------------------------------------------------------------
//
// Shared canonical cache with `/passive-skill-tree`: patch-versioned poedb.tw mirror at
// <project-root>/data/poedb/<patch>/passive-skill-tree/data_us.json. Schema = grindinggear
// unified export. poedb publishes immutable per-patch snapshots, so staleness here means
// "no patch folder exists yet" rather than "timestamp expired" — refresh by running the
// poedb download script or `/passive-skill-tree --force-update`.
// poe-utils.ts lives in .claude/skills/poe-trade/ggg/ → ../../../../data climbs to project root.
const POEDB_ROOT = new URL('../../../../data/poedb/', import.meta.url).pathname;
const POEDB_URL_TEMPLATE = 'https://poe2db.tw/data/passive-skill-tree/{ver}/data_us.json';
// Fallback patch used when nothing exists under data/poedb/ — current POE2 league. Bump on new league.
const DEFAULT_PATCH = '0.5.0';

// Resolve newest semver patch dir under data/poedb/. Returns null if dir missing or empty.
function findLatestPatch(): string | null {
  if (!fs.existsSync(POEDB_ROOT)) return null;
  const entries = fs.readdirSync(POEDB_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+(\.\d+)?$/.test(e.name))
    .map((e) => e.name);
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return db - da;
    }
    return 0;
  });
  return entries[0];
}

// poedb URL uses X.Y (no patch suffix). "3.28.0" → "3.28".
function patchToUrlVersion(patch: string): string {
  const parts = patch.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : patch;
}

function dataPathForPatch(patch: string): string {
  return POEDB_ROOT + patch + '/passive-skill-tree/data_us.json';
}

export interface PassiveNode {
  skill: number;
  name: string;
  isKeystone?: boolean;
  isNotable?: boolean;
  ascendancyName?: string;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  stats?: string[];
  out?: string[];
  in?: string[];
  classStartIndex?: number;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
}

export interface ClassData {
  name: string;
  base_str: number;
  base_dex: number;
  base_int: number;
  ascendancies?: Array<{ id: string; name: string }>;
}

export interface PassiveTree {
  nodes: Record<string, PassiveNode>;
  classes?: ClassData[];
  groups?: Record<string, { x: number; y: number }>;
}

/**
 * Returns true when no usable passive-tree mirror exists locally.
 * Patch-versioned semantics: poedb publishes immutable per-patch snapshots, so staleness
 * means "no tree data on disk for any patch" rather than "timestamp expired".
 * For explicit refresh, run `./.claude/skills/poedb/scripts/download.sh <patch>`.
 */
export function isCacheStale(): boolean {
  const patch = findLatestPatch();
  if (!patch) return true;
  return !fs.existsSync(dataPathForPatch(patch));
}

/**
 * Ensures a passive-tree mirror exists locally.
 * If nothing is found under data/poedb/, downloads the DEFAULT_PATCH snapshot
 * from poedb.tw and saves it to the canonical patch-versioned path.
 */
export async function checkAndUpdatePassiveCache(): Promise<void> {
  if (!isCacheStale()) {
    return;
  }

  const patch = DEFAULT_PATCH;
  const cachePath = dataPathForPatch(patch);
  const url = POEDB_URL_TEMPLATE.replace('{ver}', patchToUrlVersion(patch));

  console.log(`Downloading passive tree from poedb (${patch}) ...`);
  fs.mkdirSync(POEDB_ROOT + patch + '/passive-skill-tree/', { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download passive tree from ${url}: ${response.statusText}`);
  }

  const text = await response.text();
  fs.writeFileSync(cachePath, text, 'utf-8');
  console.log(`Passive tree data cached at ${cachePath}`);
}

/**
 * Loads the passive tree from disk cache, downloading if necessary.
 * Always reads the newest patch folder under data/poedb/.
 */
export async function loadPassiveTree(): Promise<PassiveTree> {
  await checkAndUpdatePassiveCache();
  const patch = findLatestPatch();
  if (!patch) {
    throw new Error('No passive-tree patch data found under data/poedb/ after cache update.');
  }
  const raw = fs.readFileSync(dataPathForPatch(patch), 'utf-8');
  const parsed = JSON.parse(raw);
  return { nodes: parsed.nodes ?? parsed, classes: parsed.classes, groups: parsed.groups };
}

/**
 * Returns matching PassiveNodes for the given hash IDs.
 * Filters out jewel sockets, mastery nodes, and nodes with empty names.
 */
export function lookupNodes(tree: PassiveTree, hashes: number[]): PassiveNode[] {
  const results: PassiveNode[] = [];
  for (const hash of hashes) {
    const node = tree.nodes[hash.toString()];
    if (!node) continue;
    if (node.isJewelSocket) continue;
    if (node.isMastery) continue;
    if (!node.name) continue;
    results.push(node);
  }
  return results;
}

/**
 * Calculate the maximum number of linked sockets on an item.
 * Links = max number of sockets sharing the same group number.
 */
export function getSocketLinks(sockets: Array<{ group: number; sColour: string }>): number {
  if (!sockets || sockets.length === 0) return 0;
  const groupCounts = sockets.reduce((acc: Record<number, number>, s) => {
    acc[s.group] = (acc[s.group] || 0) + 1;
    return acc;
  }, {});
  return Math.max(...Object.values(groupCounts));
}

/**
 * Format sockets as a display string, e.g. "B-R-R-B (4S4L)"
 * Sockets in the same group are separated by "-", different groups by " ".
 */
export function formatSocketString(sockets: Array<{ group: number; sColour: string }>): string {
  if (!sockets || sockets.length === 0) return '';

  // Build display: sockets in same group linked with "-", groups separated by " "
  const parts: string[] = [];
  let currentGroup = sockets[0].group;
  let groupStr = sockets[0].sColour;

  for (let i = 1; i < sockets.length; i++) {
    const s = sockets[i];
    if (s.group === currentGroup) {
      groupStr += '-' + s.sColour;
    } else {
      parts.push(groupStr);
      currentGroup = s.group;
      groupStr = s.sColour;
    }
  }
  parts.push(groupStr);

  const links = getSocketLinks(sockets);
  return `${parts.join(' ')} (${sockets.length}S${links}L)`;
}

/**
 * Parse resistance values from an array of mod strings.
 * Returns individual resist values plus "all" elemental resist bonus.
 */
export function parseResistFromMods(mods: string[]): { fire: number; cold: number; lightning: number; chaos: number; all: number } {
  let fire = 0, cold = 0, lightning = 0, chaos = 0, all = 0;
  for (const mod of mods) {
    const allMatch = mod.match(/\+(\d+)%\s+to (?:all )?Elemental Resistances/i);
    if (allMatch) { all += parseInt(allMatch[1]); continue; }
    // Dual-element resists
    const fireColdMatch = mod.match(/\+(\d+)%\s+to Fire and Cold Resistances/i);
    if (fireColdMatch) { const v = parseInt(fireColdMatch[1]); fire += v; cold += v; continue; }
    const fireLightMatch = mod.match(/\+(\d+)%\s+to Fire and Lightning Resistances/i);
    if (fireLightMatch) { const v = parseInt(fireLightMatch[1]); fire += v; lightning += v; continue; }
    const coldLightMatch = mod.match(/\+(\d+)%\s+to Cold and Lightning Resistances/i);
    if (coldLightMatch) { const v = parseInt(coldLightMatch[1]); cold += v; lightning += v; continue; }
    // Single-element resists
    const fireMatch = mod.match(/\+(\d+)%\s+to Fire Resistance/i);
    if (fireMatch) { fire += parseInt(fireMatch[1]); continue; }
    const coldMatch = mod.match(/\+(\d+)%\s+to Cold Resistance/i);
    if (coldMatch) { cold += parseInt(coldMatch[1]); continue; }
    const lightMatch = mod.match(/\+(\d+)%\s+to Lightning Resistance/i);
    if (lightMatch) { lightning += parseInt(lightMatch[1]); continue; }
    const chaosMatch = mod.match(/\+(\d+)%\s+to Chaos Resistance/i);
    if (chaosMatch) { chaos += parseInt(chaosMatch[1]); }
  }
  return { fire, cold, lightning, chaos, all };
}

/**
 * Calculate total resistances from gear (excludes passive tree bonuses).
 * "all elemental" is counted towards fire, cold, and lightning.
 */
// ---------------------------------------------------------------------------
// Attribute calculation
// ---------------------------------------------------------------------------

export interface AttributeTotals {
  str: number;
  dex: number;
  int: number;
}

export interface AttributeBreakdown {
  base: AttributeTotals;
  tree: AttributeTotals;
  gear: AttributeTotals;
  total: AttributeTotals;
  treeDetails: Array<{ name: string; stat: string; str: number; dex: number; int: number }>;
  gearDetails: Array<{ slot: string; str: number; dex: number; int: number }>;
}

/**
 * Parse attribute grants from a list of mod strings.
 * Handles: +N to Strength, +N to Dexterity, +N to Intelligence,
 * +N to all Attributes, +N to Str and Int, etc.
 */
export function parseAttributesFromMods(mods: string[]): AttributeTotals {
  let str = 0, dex = 0, int = 0;
  for (const mod of mods) {
    const allMatch = mod.match(/\+(\d+) to all Attributes/);
    if (allMatch) { const v = parseInt(allMatch[1]); str += v; dex += v; int += v; continue; }

    const strIntMatch = mod.match(/\+(\d+) to Strength and Intelligence/);
    if (strIntMatch) { const v = parseInt(strIntMatch[1]); str += v; int += v; continue; }

    const dexIntMatch = mod.match(/\+(\d+) to Dexterity and Intelligence/);
    if (dexIntMatch) { const v = parseInt(dexIntMatch[1]); dex += v; int += v; continue; }

    const strDexMatch = mod.match(/\+(\d+) to Strength and Dexterity/);
    if (strDexMatch) { const v = parseInt(strDexMatch[1]); str += v; dex += v; continue; }

    const strMatch = mod.match(/\+(\d+) to Strength/);
    if (strMatch) str += parseInt(strMatch[1]);

    const dexMatch = mod.match(/\+(\d+) to Dexterity/);
    if (dexMatch) dex += parseInt(dexMatch[1]);

    const intMatch = mod.match(/\+(\d+) to Intelligence/);
    if (intMatch) int += parseInt(intMatch[1]);
  }
  return { str, dex, int };
}

/**
 * Calculate full attribute breakdown: base class + passive tree + gear.
 * Uses the PoB formula: Final = SUM(BASE) * (1 + SUM(INC)/100) * PRODUCT(MORE)
 * (INC/MORE are rare on attributes, so usually just BASE sum)
 */
export function calcAttributes(
  className: string,
  tree: PassiveTree,
  hashes: number[],
  equippedItems: Item[],
): AttributeBreakdown {
  // 1. Base class stats
  const classData = tree.classes?.find(c => c.name === className);
  const base: AttributeTotals = classData
    ? { str: classData.base_str, dex: classData.base_dex, int: classData.base_int }
    : { str: 0, dex: 0, int: 0 };

  // 2. Passive tree grants
  const treeAttrs: AttributeTotals = { str: 0, dex: 0, int: 0 };
  const treeDetails: AttributeBreakdown['treeDetails'] = [];

  for (const hash of hashes) {
    const node = tree.nodes[hash.toString()];
    if (!node || !node.stats) continue;
    const parsed = parseAttributesFromMods(node.stats);
    if (parsed.str || parsed.dex || parsed.int) {
      treeAttrs.str += parsed.str;
      treeAttrs.dex += parsed.dex;
      treeAttrs.int += parsed.int;
      treeDetails.push({ name: node.name, stat: node.stats.join('; '), ...parsed });
    }
  }

  // 3. Gear grants
  const gearAttrs: AttributeTotals = { str: 0, dex: 0, int: 0 };
  const gearDetails: AttributeBreakdown['gearDetails'] = [];

  for (const item of equippedItems) {
    const mods = getAllMods(item);
    const parsed = parseAttributesFromMods(mods);
    if (parsed.str || parsed.dex || parsed.int) {
      gearAttrs.str += parsed.str;
      gearAttrs.dex += parsed.dex;
      gearAttrs.int += parsed.int;
      const slot = item.inventoryId || item.typeLine || 'Unknown';
      gearDetails.push({ slot, ...parsed });
    }
  }

  // 4. Total (BASE only — INC/MORE on attributes are extremely rare)
  const total: AttributeTotals = {
    str: base.str + treeAttrs.str + gearAttrs.str,
    dex: base.dex + treeAttrs.dex + gearAttrs.dex,
    int: base.int + treeAttrs.int + gearAttrs.int,
  };

  return { base, tree: treeAttrs, gear: gearAttrs, total, treeDetails, gearDetails };
}

/**
 * Collect all mod strings from an item (implicit, explicit, crafted, enchant).
 */
export function getAllMods(item: Item): string[] {
  return [
    ...(item.implicitMods || []),
    ...(item.explicitMods || []),
    ...(item.craftedMods || []),
    ...(item.enchantMods || []),
  ];
}

/**
 * Bandit reward bonuses.
 * - 'alira': +15% all elemental resistances, +20% crit multi, 5 mana/s
 * - 'oak': 1% life regen, +2% phys reduction, 20% phys damage
 * - 'kraityn': 6% attack/cast speed, 3% dodge, 6% move speed
 * - 'kill_all': +2 passive points (no resist bonus)
 */
export type BanditChoice = 'alira' | 'oak' | 'kraityn' | 'kill_all';

export interface ResistBreakdown {
  fire: number;
  cold: number;
  lightning: number;
  chaos: number;
  gear: { fire: number; cold: number; lightning: number; chaos: number };
  tree: { fire: number; cold: number; lightning: number; chaos: number };
  bandit: number;
  kitava: number;
}

/**
 * Estimate Kitava resistance penalty based on character level.
 * - Act 5 Kitava (level ~45+): -30% all res
 * - Act 10 Kitava (level ~68+): -30% all res (total -60%)
 * These are heuristics — level thresholds are approximate.
 */
export function estimateKitavaPenalty(level: number): number {
  if (level >= 68) return -60;
  if (level >= 45) return -30;
  return 0;
}

export function calcResistTotals(
  items: Item[],
  tree?: PassiveTree,
  hashes?: number[],
  opts?: { bandit?: BanditChoice; kitavaPenalty?: number; characterLevel?: number },
): ResistBreakdown {
  const gear = { fire: 0, cold: 0, lightning: 0, chaos: 0 };
  for (const item of items) {
    const r = parseResistFromMods(getAllMods(item));
    gear.fire += r.fire + r.all;
    gear.cold += r.cold + r.all;
    gear.lightning += r.lightning + r.all;
    gear.chaos += r.chaos;
  }

  const treeRes = { fire: 0, cold: 0, lightning: 0, chaos: 0 };
  if (tree && hashes) {
    for (const hash of hashes) {
      const node = tree.nodes[hash.toString()];
      if (!node?.stats) continue;
      const r = parseResistFromMods(node.stats);
      treeRes.fire += r.fire + r.all;
      treeRes.cold += r.cold + r.all;
      treeRes.lightning += r.lightning + r.all;
      treeRes.chaos += r.chaos;
    }
  }

  // Bandit bonus (Alira gives +15% all ele res)
  const bandit = opts?.bandit === 'alira' ? 15 : 0;

  // Kitava penalty: use explicit value if provided, otherwise estimate from level
  const kitava = opts?.kitavaPenalty ?? (opts?.characterLevel != null ? estimateKitavaPenalty(opts.characterLevel) : 0);

  const bonus = bandit + kitava;

  return {
    fire: gear.fire + treeRes.fire + bonus,
    cold: gear.cold + treeRes.cold + bonus,
    lightning: gear.lightning + treeRes.lightning + bonus,
    chaos: gear.chaos + treeRes.chaos + kitava,
    gear,
    tree: treeRes,
    bandit,
    kitava,
  };
}

// Ascendancy → base class mapping
export const ASCENDANCY_TO_CLASS: Record<string, string> = {
  Juggernaut: 'Marauder', Berserker: 'Marauder', Chieftain: 'Marauder',
  Deadeye: 'Ranger', Warden: 'Ranger', Pathfinder: 'Ranger',
  Assassin: 'Shadow', Saboteur: 'Shadow', Trickster: 'Shadow',
  Necromancer: 'Witch', Elementalist: 'Witch', Occultist: 'Witch',
  Inquisitor: 'Templar', Hierophant: 'Templar', Guardian: 'Templar',
  Slayer: 'Duelist', Gladiator: 'Duelist', Champion: 'Duelist',
  Ascendant: 'Scion', Reliquarian: 'Scion', Scavenger: 'Scion',
  // Base classes map to themselves
  Marauder: 'Marauder', Ranger: 'Ranger', Shadow: 'Shadow',
  Witch: 'Witch', Templar: 'Templar', Duelist: 'Duelist', Scion: 'Scion',
};
