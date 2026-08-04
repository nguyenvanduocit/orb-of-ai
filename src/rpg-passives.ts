// Passive tree — PoE's build-defining node graph, minified for Discord and PURE (no I/O).
// Each of the 9 themed CLUSTERS is a small BRANCHING tree: entry → small → a fork into two
// notables, one of which leads to a KEYSTONE. A keystone is a build-defining node with a big
// upside AND a real downside (negative mods) — the PoE trade-off. Reaching one costs deep
// investment in that cluster (opportunity cost) PLUS accepting its downside, and points are
// scarce, so you specialise into 2-3 keystones rather than grabbing everything.
//
// A profile stores allocated node ids; `aggregatePassives(ids)` folds them into one
// `PassiveMods` bundle the build layer (rpg-build.ts) applies — negatives included. Points come
// from character level (+ prestige). `treeLayout()` lays each cluster's node-tree out as a
// radial fan (tidy-tree in polar coords) so the whole thing reads as a constellation wheel.

import type { Ailment, DamageType, Elem } from "./rpg-combat";
import type { EffectRef } from "./rpg-effects";

// Everything a node (or the whole allocation) can grant. All optional; aggregation sums them.
// Values may be NEGATIVE (keystone downsides): the build layer folds them as PoE "increased"
// modifiers, so −lifePct shrinks life, −resAll makes you take more elemental damage, etc.
export interface PassiveMods {
  lifePct: number; // +% max life
  esPct: number; // +% energy shield
  armourPct: number;
  evasionPct: number;
  atkPct: number; // +% attack (weapon) damage
  spellPct: number; // +% spell damage
  critChance: number; // + flat crit chance
  critMulti: number; // + crit multiplier
  speedPct: number; // +% attack speed
  resAll: number; // + all elemental resistance (flat fraction; can go negative → more dmg taken)
  resChaos: number;
  elePct: Partial<Record<Elem, number>>; // +% damage of a given element
  addedFlat: Partial<Record<DamageType, number>>; // flat added damage
  ailmentChance: Partial<Record<Ailment, number>>; // + ailment chance
}

export function zeroPassiveMods(): PassiveMods {
  return { lifePct: 0, esPct: 0, armourPct: 0, evasionPct: 0, atkPct: 0, spellPct: 0, critChance: 0, critMulti: 0, speedPct: 0, resAll: 0, resChaos: 0, elePct: {}, addedFlat: {}, ailmentChance: {} };
}

export interface PassiveNode {
  id: string;
  cluster: string;
  name: string;
  notable?: boolean; // a cluster capstone (bigger)
  keystone?: boolean; // build-defining node — big upside + a real downside (negative mods)
  requires?: string; // prerequisite node id — must be allocated first
  mods: Partial<PassiveMods>;
  fx?: EffectRef[]; // behavioural effects (leech/block/…) the node grants — folded into the Fighter's fx by the build layer, so a deep-invested glass build can buy sustain
}

export interface PassiveCluster {
  id: string;
  name: string;
  emoji: string;
}

export const PASSIVE_CLUSTERS: PassiveCluster[] = [
  { id: "thechat", name: "Constitution", emoji: "❤️" },
  { id: "cuongchien", name: "Berserking", emoji: "⚔️" },
  { id: "nguyento", name: "Elementalist", emoji: "🌈" },
  { id: "satthu", name: "Assassination", emoji: "🎯" },
  { id: "giaptru", name: "Fortitude", emoji: "🛡️" },
  { id: "bongma", name: "Evasion", emoji: "💨" },
  { id: "khang", name: "Resistances", emoji: "🔰" },
  { id: "daudoc", name: "Toxicity", emoji: "☠️" },
  { id: "phaythuat", name: "Arcanist", emoji: "🔮" },
];

// Node catalog. Every cluster shares the same BRANCHING shape (6 nodes):
//   entry(_e) → small(_a1) → ┬─ notableA(_na) → KEYSTONE(_k)
//                            └─ small(_b1) → notableB(_nb)
// The fork is at _a1: the A-branch commits toward the keystone (deep + downside), the B-branch
// is a clean alternative notable. New content = a new cluster block of the same shape.
export const PASSIVE_NODES: PassiveNode[] = [
  // ❤️ Constitution — life / phys defence
  { id: "thechat_e", cluster: "thechat", name: "+8% Máu", mods: { lifePct: 0.08 } },
  { id: "thechat_a1", cluster: "thechat", name: "+12% Máu", requires: "thechat_e", mods: { lifePct: 0.12 } },
  { id: "thechat_na", cluster: "thechat", name: "Sinh Lực Dồi Dào", notable: true, requires: "thechat_a1", mods: { lifePct: 0.15, armourPct: 0.1 } },
  { id: "thechat_k", cluster: "thechat", name: "Máu Thịt Thuần Khiết", keystone: true, requires: "thechat_na", mods: { lifePct: 0.6, armourPct: -0.4, evasionPct: -0.45 } },
  { id: "thechat_b1", cluster: "thechat", name: "+10% Máu · +8% Giáp", requires: "thechat_a1", mods: { lifePct: 0.1, armourPct: 0.08 } },
  { id: "thechat_nb", cluster: "thechat", name: "Thành Trì Sống", notable: true, requires: "thechat_b1", mods: { lifePct: 0.18, armourPct: 0.15 } },

  // ⚔️ Berserking — attack damage / speed
  { id: "cuong_e", cluster: "cuongchien", name: "+10% ST Đánh", mods: { atkPct: 0.1 } },
  { id: "cuong_a1", cluster: "cuongchien", name: "+8% Tốc đánh", requires: "cuong_e", mods: { speedPct: 0.08 } },
  { id: "cuong_na", cluster: "cuongchien", name: "Khát Máu", notable: true, requires: "cuong_a1", mods: { atkPct: 0.18, speedPct: 0.06 }, fx: [{ id: "lifeLeech", mag: 0.06 }] },
  { id: "cuong_k", cluster: "cuongchien", name: "Cuồng Nộ Vô Độ", keystone: true, requires: "cuong_na", mods: { atkPct: 0.5, speedPct: 0.2, resAll: -0.2 } },
  { id: "cuong_b1", cluster: "cuongchien", name: "+12% ST Đánh", requires: "cuong_a1", mods: { atkPct: 0.12 } },
  { id: "cuong_nb", cluster: "cuongchien", name: "Đồ Tể", notable: true, requires: "cuong_b1", mods: { atkPct: 0.22, critChance: 0.03 } },

  // 🌈 Elementalist — elemental damage
  { id: "nguyento_e", cluster: "nguyento", name: "+12% ST Lửa", mods: { elePct: { fire: 0.12 } } },
  { id: "nguyento_a1", cluster: "nguyento", name: "+10% ST Nguyên tố", requires: "nguyento_e", mods: { elePct: { fire: 0.1, cold: 0.1, light: 0.1 } } },
  { id: "nguyento_na", cluster: "nguyento", name: "Tinh Thông Nguyên Tố", notable: true, requires: "nguyento_a1", mods: { elePct: { fire: 0.15, cold: 0.15, light: 0.15 } } },
  { id: "nguyento_k", cluster: "nguyento", name: "Quá Tải Nguyên Tố", keystone: true, requires: "nguyento_na", mods: { elePct: { fire: 0.45, cold: 0.45, light: 0.45 }, critMulti: -0.5 } },
  { id: "nguyento_b1", cluster: "nguyento", name: "+16% ST Lửa", requires: "nguyento_a1", mods: { elePct: { fire: 0.16 } } },
  { id: "nguyento_nb", cluster: "nguyento", name: "Cuồng Nhiệt", notable: true, requires: "nguyento_b1", mods: { elePct: { fire: 0.3 }, ailmentChance: { ignite: 0.2 } } },

  // 🎯 Assassination — crit
  { id: "satthu_e", cluster: "satthu", name: "+4% Chí mạng", mods: { critChance: 0.04 } },
  { id: "satthu_a1", cluster: "satthu", name: "+25% ST Chí mạng", requires: "satthu_e", mods: { critMulti: 0.25 } },
  { id: "satthu_na", cluster: "satthu", name: "Điểm Yếu", notable: true, requires: "satthu_a1", mods: { critChance: 0.06, critMulti: 0.35 } },
  { id: "satthu_k", cluster: "satthu", name: "Lưỡi Dao Thủy Tinh", keystone: true, requires: "satthu_na", mods: { critChance: 0.08, critMulti: 1.0, lifePct: -0.25 } },
  { id: "satthu_b1", cluster: "satthu", name: "+30% ST Chí mạng", requires: "satthu_a1", mods: { critMulti: 0.3 } },
  { id: "satthu_nb", cluster: "satthu", name: "Mắt Tử Thần", notable: true, requires: "satthu_b1", mods: { critChance: 0.05, critMulti: 0.4 } },

  // 🛡️ Fortitude — armour
  { id: "giap_e", cluster: "giaptru", name: "+15% Giáp", mods: { armourPct: 0.15 } },
  { id: "giap_a1", cluster: "giaptru", name: "+18% Giáp", requires: "giap_e", mods: { armourPct: 0.18 } },
  { id: "giap_na", cluster: "giaptru", name: "Lũy Thép", notable: true, requires: "giap_a1", mods: { armourPct: 0.25, lifePct: 0.08 } },
  { id: "giap_k", cluster: "giaptru", name: "Pháo Đài Bất Động", keystone: true, requires: "giap_na", mods: { armourPct: 0.6, lifePct: 0.25, atkPct: -0.45, spellPct: -0.45 } },
  { id: "giap_b1", cluster: "giaptru", name: "+12% Giáp · +6% Máu", requires: "giap_a1", mods: { armourPct: 0.12, lifePct: 0.06 } },
  { id: "giap_nb", cluster: "giaptru", name: "Giáp Trụ", notable: true, requires: "giap_b1", mods: { armourPct: 0.22, lifePct: 0.1 } },

  // 💨 Evasion
  { id: "bongma_e", cluster: "bongma", name: "+15% Né", mods: { evasionPct: 0.15 } },
  { id: "bongma_a1", cluster: "bongma", name: "+18% Né", requires: "bongma_e", mods: { evasionPct: 0.18 } },
  { id: "bongma_na", cluster: "bongma", name: "Chạy Gió", notable: true, requires: "bongma_a1", mods: { evasionPct: 0.25, speedPct: 0.05 } },
  { id: "bongma_k", cluster: "bongma", name: "Bóng Ma Bất Diệt", keystone: true, requires: "bongma_na", mods: { evasionPct: 0.65, speedPct: 0.18, armourPct: -0.4, esPct: -0.35 } },
  { id: "bongma_b1", cluster: "bongma", name: "+14% Né · +5% Tốc", requires: "bongma_a1", mods: { evasionPct: 0.14, speedPct: 0.05 } },
  { id: "bongma_nb", cluster: "bongma", name: "Lướt Bóng", notable: true, requires: "bongma_b1", mods: { evasionPct: 0.22, speedPct: 0.08 } },

  // 🔰 Resistances
  { id: "khang_e", cluster: "khang", name: "+6% Kháng nguyên tố", mods: { resAll: 0.06 } },
  { id: "khang_a1", cluster: "khang", name: "+6% Kháng nguyên tố", requires: "khang_e", mods: { resAll: 0.06 } },
  { id: "khang_na", cluster: "khang", name: "Hộ Thân", notable: true, requires: "khang_a1", mods: { resAll: 0.08, resChaos: 0.15 } },
  { id: "khang_k", cluster: "khang", name: "Thánh Khiên", keystone: true, requires: "khang_na", mods: { resAll: 0.18, resChaos: 0.5, atkPct: -0.25, spellPct: -0.25 } },
  { id: "khang_b1", cluster: "khang", name: "+8% Kháng nguyên tố", requires: "khang_a1", mods: { resAll: 0.08 } },
  { id: "khang_nb", cluster: "khang", name: "Bất Khả Xâm", notable: true, requires: "khang_b1", mods: { resAll: 0.12, lifePct: 0.06 } },

  // ☠️ Toxicity — chaos / ailments
  { id: "doc_e", cluster: "daudoc", name: "+14% ST Hỗn mang", mods: { elePct: { chaos: 0.14 } } },
  { id: "doc_a1", cluster: "daudoc", name: "+20% Tỉ lệ độc", requires: "doc_e", mods: { ailmentChance: { poison: 0.2 } } },
  { id: "doc_na", cluster: "daudoc", name: "Kịch Độc", notable: true, requires: "doc_a1", mods: { elePct: { chaos: 0.2 }, ailmentChance: { poison: 0.2 }, addedFlat: { chaos: 8 } } },
  { id: "doc_k", cluster: "daudoc", name: "Nọc Độc Chí Tử", keystone: true, requires: "doc_na", mods: { elePct: { chaos: 0.4 }, ailmentChance: { poison: 0.4 }, addedFlat: { chaos: 14 }, resAll: -0.35 } },
  { id: "doc_b1", cluster: "daudoc", name: "+18% ST Hỗn mang", requires: "doc_a1", mods: { elePct: { chaos: 0.18 } } },
  { id: "doc_nb", cluster: "daudoc", name: "Ôn Dịch", notable: true, requires: "doc_b1", mods: { elePct: { chaos: 0.25 }, ailmentChance: { poison: 0.15 } } },

  // 🔮 Arcanist — spell damage
  { id: "phap_e", cluster: "phaythuat", name: "+12% ST Phép", mods: { spellPct: 0.12 } },
  { id: "phap_a1", cluster: "phaythuat", name: "+14% ST Phép", requires: "phap_e", mods: { spellPct: 0.14 } },
  { id: "phap_na", cluster: "phaythuat", name: "Hiền Triết", notable: true, requires: "phap_a1", mods: { spellPct: 0.2, critChance: 0.03 } },
  { id: "phap_k", cluster: "phaythuat", name: "Hiến Tế Huyết Ma", keystone: true, requires: "phap_na", mods: { spellPct: 0.6, critChance: 0.06, lifePct: -0.5 } },
  { id: "phap_b1", cluster: "phaythuat", name: "+16% ST Phép", requires: "phap_a1", mods: { spellPct: 0.16 } },
  { id: "phap_nb", cluster: "phaythuat", name: "Đại Pháp Sư", notable: true, requires: "phap_b1", mods: { spellPct: 0.24, critMulti: 0.2 } },
];

export const NODE_BY_ID: Record<string, PassiveNode> = Object.fromEntries(PASSIVE_NODES.map((n) => [n.id, n]));
export const NODES_BY_CLUSTER: Record<string, PassiveNode[]> = Object.fromEntries(
  PASSIVE_CLUSTERS.map((c) => [c.id, PASSIVE_NODES.filter((n) => n.cluster === c.id)]),
);

// Points available from character level (1 point per level after 1) + a prestige bonus.
export function passivePointsTotal(level: number, prestigeLevel: number): number {
  return Math.max(0, level - 1) + prestigeLevel * 3;
}

// Drop allocated ids that no longer exist in the catalog (e.g. after a tree revamp), so point
// counting stays correct and the tree self-heals on the next write. Pure.
export function sanitizePassives(allocated: string[]): string[] {
  return allocated.filter((id) => NODE_BY_ID[id]);
}

// Can this node be allocated given what's already allocated + remaining points? (Prereq must
// be allocated first; not already taken; a point to spend.)
export function canAllocate(allocated: string[], nodeId: string, pointsLeft: number): { ok: boolean; reason?: string } {
  const node = NODE_BY_ID[nodeId];
  if (!node) return { ok: false, reason: "Node không tồn tại." };
  if (allocated.includes(nodeId)) return { ok: false, reason: "Đã học node này rồi." };
  if (pointsLeft < 1) return { ok: false, reason: "Hết passive point — lên cấp để có thêm." };
  if (node.requires && !allocated.includes(node.requires)) {
    return { ok: false, reason: `Cần học "${NODE_BY_ID[node.requires]?.name ?? node.requires}" trước.` };
  }
  return { ok: true };
}

// Respec one node: allowed only if no still-allocated node depends on it (its prereq chain
// must stay intact). Refunds the point; costs nothing. Pure.
export function canDeallocate(allocated: string[], nodeId: string): { ok: boolean; reason?: string } {
  if (!allocated.includes(nodeId)) return { ok: false, reason: "Chưa học node này." };
  const dependents = allocated.filter((id) => NODE_BY_ID[id]?.requires === nodeId);
  if (dependents.length > 0) {
    const names = dependents.map((id) => NODE_BY_ID[id]?.name ?? id).join(", ");
    return { ok: false, reason: `Phải tháo "${names}" trước — node đó đang cần node này.` };
  }
  return { ok: true };
}

// Fold every allocated node into one PassiveMods bundle. Unknown ids are ignored (forward-safe
// if a node is ever removed from the catalog). Negatives sum in like any other value.
export function aggregatePassives(allocated: string[]): PassiveMods {
  const out = zeroPassiveMods();
  for (const id of allocated) {
    const node = NODE_BY_ID[id];
    if (!node) continue;
    const m = node.mods;
    out.lifePct += m.lifePct ?? 0;
    out.esPct += m.esPct ?? 0;
    out.armourPct += m.armourPct ?? 0;
    out.evasionPct += m.evasionPct ?? 0;
    out.atkPct += m.atkPct ?? 0;
    out.spellPct += m.spellPct ?? 0;
    out.critChance += m.critChance ?? 0;
    out.critMulti += m.critMulti ?? 0;
    out.speedPct += m.speedPct ?? 0;
    out.resAll += m.resAll ?? 0;
    out.resChaos += m.resChaos ?? 0;
    if (m.elePct) for (const k of Object.keys(m.elePct) as Elem[]) out.elePct[k] = (out.elePct[k] ?? 0) + (m.elePct[k] ?? 0);
    if (m.addedFlat) for (const k of Object.keys(m.addedFlat) as DamageType[]) out.addedFlat[k] = (out.addedFlat[k] ?? 0) + (m.addedFlat[k] ?? 0);
    if (m.ailmentChance) for (const k of Object.keys(m.ailmentChance) as Ailment[]) out.ailmentChance[k] = (out.ailmentChance[k] ?? 0) + (m.ailmentChance[k] ?? 0);
  }
  return out;
}

// Behavioural effects (leech/block/…) granted by the allocated nodes — collected separately
// from the scalar PassiveMods because fx are data refs, not summable numbers. The build layer
// merges these into the Fighter's fx alongside the ascendancy's, so on-tree sustain (leech on
// the Bloodthirst notable) can keep a glass keystone build alive.
export function passiveFx(allocated: string[]): EffectRef[] {
  const out: EffectRef[] = [];
  for (const id of allocated) {
    const node = NODE_BY_ID[id];
    if (node?.fx) out.push(...node.fx);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure tree geometry — the spatial layout the web page (src/rpg-web.ts) draws as an SVG.
// Lives here (not the renderer) so it stays in lockstep with the catalog. Each cluster occupies
// an angular SECTOR of the wheel; within the sector its node-tree is laid out as a radial
// tidy-tree: depth → radius (outward), and the branches fan across the sector (leaves get evenly
// spaced angular slots, each parent sits at the mean angle of its children). So a keystone at
// depth 3 sits far out on one fork, its notableB sibling on the other. Geometry ONLY — the
// owned/open/locked colouring is the renderer's job.
// ─────────────────────────────────────────────────────────────────────────────

export interface TreeNodeLayout {
  id: string;
  cluster: string;
  cx: number;
  cy: number;
  r: number;
  notable: boolean;
  keystone: boolean;
}
export interface TreeEdgeLayout {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface TreeLayout {
  nodes: TreeNodeLayout[];
  edges: TreeEdgeLayout[];
  hub: { cx: number; cy: number; r: number };
  size: number; // the square viewBox side (0 0 size size)
}

export function treeLayout(): TreeLayout {
  const SIZE = 1000;
  const c = SIZE / 2;
  const HUB_R = 30;
  const SMALL_R = 17;
  const NOTABLE_R = 24;
  const KEY_R = 32;
  const INNER = 120; // radius of a depth-0 (entry) node
  const GAP = 96; // radius added per depth level (max depth 3 → 120+288 = 408)
  const SPREAD = 0.46; // total angular spread (rad, ~26°) for a cluster's leaves — < 2π/9 so clusters don't collide

  const clusters = PASSIVE_CLUSTERS;
  const nCl = clusters.length;
  const nodes: TreeNodeLayout[] = [];
  const edges: TreeEdgeLayout[] = [];

  clusters.forEach((cluster, i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / nCl; // 12 o'clock, clockwise
    const clNodes = NODES_BY_CLUSTER[cluster.id] ?? [];
    if (clNodes.length === 0) return;
    const byId = new Map(clNodes.map((n) => [n.id, n]));
    const childrenOf = (id: string) => clNodes.filter((n) => n.requires === id);
    const root = clNodes.find((n) => !n.requires || !byId.has(n.requires)) ?? clNodes[0]!;

    // depth (BFS from root)
    const depth = new Map<string, number>([[root.id, 0]]);
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const ch of childrenOf(id)) {
        depth.set(ch.id, (depth.get(id) ?? 0) + 1);
        queue.push(ch.id);
      }
    }

    // tidy angular offset: leaves get evenly-spaced slots across the sector; parent = mean(children)
    const totalLeaves = Math.max(1, clNodes.filter((n) => childrenOf(n.id).length === 0).length);
    let leafSeen = 0;
    const angleOff = new Map<string, number>();
    const assign = (id: string): number => {
      const kids = childrenOf(id);
      let off: number;
      if (kids.length === 0) {
        off = totalLeaves <= 1 ? 0 : (leafSeen / (totalLeaves - 1) - 0.5) * SPREAD;
        leafSeen++;
      } else {
        const a = kids.map((k) => assign(k.id));
        off = a.reduce((s, x) => s + x, 0) / a.length;
      }
      angleOff.set(id, off);
      return off;
    };
    assign(root.id);

    const posOf = (id: string) => {
      const ang = theta + (angleOff.get(id) ?? 0);
      const rad = INNER + (depth.get(id) ?? 0) * GAP;
      return { x: c + Math.cos(ang) * rad, y: c + Math.sin(ang) * rad };
    };

    // hub → root stub (aim at the root's angle)
    const rootAng = theta + (angleOff.get(root.id) ?? 0);
    const rp = posOf(root.id);
    edges.push({ x1: c + Math.cos(rootAng) * HUB_R, y1: c + Math.sin(rootAng) * HUB_R, x2: rp.x, y2: rp.y });

    for (const node of clNodes) {
      const p = posOf(node.id);
      const r = node.keystone ? KEY_R : node.notable ? NOTABLE_R : SMALL_R;
      nodes.push({ id: node.id, cluster: cluster.id, cx: p.x, cy: p.y, r, notable: !!node.notable, keystone: !!node.keystone });
      if (node.requires && byId.has(node.requires)) {
        const pp = posOf(node.requires);
        edges.push({ x1: pp.x, y1: pp.y, x2: p.x, y2: p.y });
      }
    }
  });

  return { nodes, edges, hub: { cx: c, cy: c, r: HUB_R }, size: SIZE };
}

// Respec-all: PoE lets you refund; here Tái Sinh (prestige) auto-refunds by wiping allocation.
// A profile that somehow allocated more than its points (catalog change) is truncated valid.
export function validAllocation(allocated: string[], pointsTotal: number): string[] {
  const seen: string[] = [];
  // Keep only nodes whose prereq chain is satisfied within the kept set, up to the point cap.
  for (const id of allocated) {
    if (seen.length >= pointsTotal) break;
    const node = NODE_BY_ID[id];
    if (!node || seen.includes(id)) continue;
    if (node.requires && !seen.includes(node.requires)) continue;
    seen.push(id);
  }
  return seen;
}
