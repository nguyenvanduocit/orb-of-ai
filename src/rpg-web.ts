// RPG web presentation — the interactive passive-tree + inventory page that the
// /rpg passives Discord panel deep-links to (a Link button, src/commands/rpg.ts).
// This module owns TWO concerns and nothing else:
//   1. the owner-scoped signed link (signLink / verifyLink) — a stateless HMAC bearer
//      token in the URL path, so the page needs no login and survives a Fly redeploy;
//   2. the read-only SNAPSHOT of a profile (buildSnapshot) + the self-contained HTML
//      page that renders it (renderPage) — inline CSS/SVG/JS, no build step. The only
//      external fetch is the Google Fonts stylesheet (Playfair Display + Spectral); a `no-referrer`
//      policy (meta + response header) means NO sub-resource request carries a Referer, so
//      the path-token can't leak. Aesthetic = dark "arcane atlas": obsidian + nebula, gold
//      engraved type, a glowing constellation tree, and rarity-framed item tooltips.
//
// Routing + the WRITE cores live in server.ts (which imports allocateNode / equipCore /
// unequipCore from commands/rpg): this module never imports commands/rpg, so there is
// no import cycle. It reads only the pure domain (rpg, rpg-passives) + config.
//
// SECURITY: the token authorizes a (guild, user) pair for 30 min. The key is HKDF-derived
// from DISCORD_BOT_TOKEN with a distinct info string, mirroring the PoE store (src/poe.ts)
// — and DISCORD_BOT_TOKEN is deliberately NOT in the chat agent's env, so the agent can
// never mint or read one. Request paths land in Fly's access log; a 30-min bearer there is
// an accepted, minor exposure for a game feature.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { STAT_LABEL } from "./rpg-table";
import {
  CLASSES,
  GEAR_BASES,
  GEAR_SLOTS,
  MAX_PLUS,
  RARITIES,
  UNIQUE_BY_ID,
  gearCap,
  gearStats,
  modLabel,
  type GearItem,
  type GearSlot,
  type RpgProfile,
  type StatId,
} from "./rpg";
import {
  NODES_BY_CLUSTER,
  PASSIVE_CLUSTERS,
  aggregatePassives,
  canAllocate,
  canDeallocate,
  passivePointsTotal,
  sanitizePassives,
  treeLayout,
  type PassiveMods,
} from "./rpg-passives";

// ─────────────────────────────────────────────────────────────────────────────
// Signed link — stateless HMAC bearer token, base64url(payload).base64url(sig).
// ─────────────────────────────────────────────────────────────────────────────

const LINK_TTL_MS = 30 * 60 * 1000; // 30 min
const LINK_SANITY_MS = 24 * 60 * 60 * 1000; // reject a token minted more than a day out (bug guard)
const LINK_KEY = Buffer.from(hkdfSync("sha256", config.discordToken, "rpg-web-link", "hmac-sha256", 32));

export function signLink(guildId: string, userId: string): string {
  const payload = `${guildId}.${userId}.${Date.now() + LINK_TTL_MS}`;
  const sig = createHmac("sha256", LINK_KEY).update(payload).digest();
  return `${Buffer.from(payload).toString("base64url")}.${sig.toString("base64url")}`;
}

// Verify signature BEFORE trusting any field: recompute the HMAC over the raw payload
// bytes and constant-time compare, then (only if valid) parse guild/user/exp. Any throw
// (e.g. timingSafeEqual on a length mismatch) is treated as invalid.
export function verifyLink(token: string): { guildId: string; userId: string } | null {
  try {
    if (!token || token.length > 512) return null;
    const dot = token.indexOf(".");
    if (dot <= 0 || dot >= token.length - 1) return null;
    const payloadBuf = Buffer.from(token.slice(0, dot), "base64url");
    const sig = Buffer.from(token.slice(dot + 1), "base64url");
    const expected = createHmac("sha256", LINK_KEY).update(payloadBuf).digest();
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;

    const parts = payloadBuf.toString("utf8").split(".");
    if (parts.length !== 3) return null;
    const [guildId, userId, expStr] = parts;
    if (!guildId || !userId) return null;
    const exp = Number(expStr);
    const now = Date.now();
    if (!Number.isFinite(exp) || exp <= now || exp > now + LINK_SANITY_MS) return null;
    return { guildId, userId };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot — the whole read model the page needs, pure from a profile. A superset
// (tree + inventory) so /state is one endpoint and adding inventory writes later needs
// no reshape. Every mutation endpoint returns a fresh snapshot of this exact shape.
// ─────────────────────────────────────────────────────────────────────────────

export interface WebTreeNode {
  id: string;
  cluster: string;
  name: string;
  detail: string; // upside summary
  downside?: string; // negative mods (keystone cost) — shown red with a ⚠
  notable: boolean;
  keystone: boolean;
  cx: number;
  cy: number;
  r: number;
  state: "owned" | "open" | "locked";
  lock?: string; // reason when locked
  removable?: boolean; // owned + nothing depends on it → can be respec'd individually
}
export interface WebItem {
  id: string;
  slot: GearSlot;
  slotName: string;
  slotEmoji: string;
  name: string;
  rarityName: string;
  color: string; // border color (#rrggbb)
  plus: number;
  star: number; // ⭐ Ghép Sao level
  capNote: string; // Đột Phá — "trần +N" when the enhancement ceiling is below MAX_PLUS, else ""
  art: string; // asset key → /rpg/asset/item/<art>.png
  unique: boolean;
  flavor: string;
  mods: string[]; // rolled affix lines (modLabel)
  stats: string[]; // computed positive stat lines
  downside?: string; // negative stat lines (a unique's trade-off) — shown red with ⚠
}
export interface WebSnapshot {
  cls: string;
  clsName: string;
  clsEmoji: string;
  level: number;
  pointsLeft: number;
  pointsTotal: number;
  tree: { size: number; hub: { cx: number; cy: number; r: number }; edges: { x1: number; y1: number; x2: number; y2: number }[]; nodes: WebTreeNode[]; totals: string[] };
  clusters: { id: string; name: string; emoji: string }[];
  inv: { equipped: WebItem[]; bag: WebItem[]; bagLimit: number };
}

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
const UNIQUE_COLOR = "#af6025"; // 🟤 unique tier — its own colour, not a rarity band

// An item's computed stats split into UPSIDE (positive) and DOWNSIDE (negative) lines — a
// unique's negative stats (its signature trade-off) land in `down` so the card can red them.
function itemStatParts(item: GearItem): { up: string[]; down: string[] } {
  const stats = gearStats(item);
  const up: string[] = [];
  const down: string[] = [];
  for (const key of Object.keys(stats) as StatId[]) {
    const v = stats[key];
    const def = STAT_LABEL[key];
    if (v === undefined || v === 0 || !def) continue;
    const sign = v >= 0 ? "+" : "−";
    const mag = def.pct ? `${Math.abs(Math.round(v * 100))}%` : `${Math.abs(Math.round(v))}`;
    (v >= 0 ? up : down).push(`${def.name} ${sign}${mag}`);
  }
  return { up, down };
}

const ELEM_VI: Record<string, string> = { fire: "Lửa", cold: "Băng", light: "Sét", chaos: "Hỗn mang", phys: "Vật lý" };
const AIL_VI: Record<string, string> = { poison: "Độc", ignite: "Thiêu", bleed: "Chảy máu", freeze: "Đóng băng", shock: "Sốc", chill: "Lạnh" };
const pct = (x: number) => `${Math.round(x * 100)}%`;

// Split a node's mods into human-readable UPSIDE (positive) and DOWNSIDE (negative) lines.
// A keystone's negatives land in `down` so the UI can paint them red with a ⚠. A leading "−"
// is used for negatives (so the renderer can also detect them from the string alone).
function fmtMod(label: string, v: number, flat = false): string {
  const sign = v >= 0 ? "+" : "−";
  const mag = flat ? `${Math.abs(Math.round(v))}` : `${Math.abs(Math.round(v * 100))}%`;
  return `${sign}${mag} ${label}`;
}
export function passiveParts(mods: Partial<PassiveMods>): { up: string[]; down: string[] } {
  const up: string[] = [];
  const down: string[] = [];
  const push = (label: string, v: number | undefined, flat = false) => {
    if (!v) return;
    (v >= 0 ? up : down).push(fmtMod(label, v, flat));
  };
  const flatKeys: [keyof PassiveMods, string][] = [
    ["lifePct", "Máu"],
    ["esPct", "Khiên NL"],
    ["armourPct", "Giáp"],
    ["evasionPct", "Né"],
    ["atkPct", "ST Đánh"],
    ["spellPct", "ST Phép"],
    ["critChance", "Chí mạng"],
    ["critMulti", "ST Chí mạng"],
    ["speedPct", "Tốc đánh"],
    ["resAll", "Kháng nguyên tố"],
    ["resChaos", "Kháng Hỗn mang"],
  ];
  for (const [k, label] of flatKeys) push(label, mods[k] as number | undefined);
  if (mods.elePct) for (const [k, v] of Object.entries(mods.elePct)) push(`ST ${ELEM_VI[k] ?? k}`, v);
  if (mods.addedFlat) for (const [k, v] of Object.entries(mods.addedFlat)) push(`ST ${ELEM_VI[k] ?? k} cộng thẳng`, v, true);
  if (mods.ailmentChance) for (const [k, v] of Object.entries(mods.ailmentChance)) push(`tỉ lệ ${AIL_VI[k] ?? k}`, v);
  return { up, down };
}

function itemView(item: GearItem): WebItem {
  const uniq = item.uniqueId ? UNIQUE_BY_ID[item.uniqueId] : undefined;
  const slotDef = GEAR_SLOTS.find((s) => s.id === item.slot);
  const sp = itemStatParts(item);
  return {
    id: item.id,
    slot: item.slot,
    slotName: slotDef?.name ?? item.slot,
    slotEmoji: slotDef?.emoji ?? "❓",
    name: uniq?.name ?? GEAR_BASES[item.base]?.name ?? item.base,
    rarityName: uniq ? "Unique" : (RARITIES[item.rarity]?.name ?? "Normal"),
    color: uniq ? UNIQUE_COLOR : hex(RARITIES[item.rarity]?.color ?? 0x9aa0a6),
    plus: item.plus,
    star: item.star ?? 0,
    capNote: gearCap(item) < MAX_PLUS ? `trần +${gearCap(item)}` : "",
    art: uniq ? `unique-${uniq.id}` : item.base,
    unique: !!uniq,
    flavor: uniq?.flavor ?? "",
    mods: (item.mods ?? []).map(modLabel),
    stats: sp.up,
    downside: sp.down.length ? sp.down.join(" · ") : undefined,
  };
}

export function buildSnapshot(profile: RpgProfile): WebSnapshot {
  const allocated = sanitizePassives(profile.passives ?? []); // drop stale ids (tree revamp) → correct point count
  const owned = new Set(allocated);
  const pointsTotal = passivePointsTotal(profile.level, profile.prestigeLevel);
  const pointsLeft = pointsTotal - allocated.length;
  const layout = treeLayout();
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  const nodes: WebTreeNode[] = [];
  for (const cluster of PASSIVE_CLUSTERS) {
    for (const node of NODES_BY_CLUSTER[cluster.id] ?? []) {
      const p = pos.get(node.id);
      if (!p) continue;
      let state: WebTreeNode["state"];
      let lock: string | undefined;
      let removable: boolean | undefined;
      if (owned.has(node.id)) {
        state = "owned";
        removable = canDeallocate(allocated, node.id).ok;
      } else {
        const chk = canAllocate(allocated, node.id, pointsLeft);
        if (chk.ok) {
          state = "open";
        } else {
          state = "locked";
          lock = chk.reason;
        }
      }
      const parts = passiveParts(node.mods);
      nodes.push({
        id: node.id,
        cluster: cluster.id,
        name: node.name,
        detail: parts.up.join(" · "),
        downside: parts.down.length ? parts.down.join(" · ") : undefined,
        notable: !!node.notable,
        keystone: !!node.keystone,
        cx: p.cx,
        cy: p.cy,
        r: p.r,
        state,
        lock,
        removable,
      });
    }
  }

  const equipped = GEAR_SLOTS.flatMap((s) => {
    const it = profile.gear[s.id];
    return it ? [itemView(it)] : [];
  });

  return {
    cls: profile.cls,
    clsName: CLASSES[profile.cls]?.name ?? profile.cls,
    clsEmoji: CLASSES[profile.cls]?.emoji ?? "🎮",
    level: profile.level,
    pointsLeft,
    pointsTotal,
    tree: { size: layout.size, hub: layout.hub, edges: layout.edges, nodes, totals: aggregateTotals(allocated) },
    clusters: PASSIVE_CLUSTERS.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    inv: { equipped, bag: profile.bag.map(itemView), bagLimit: 60 },
  };
}

// The allocated tree folded into readable "tổng cộng" lines — upside then downside (the down
// lines keep their "−" prefix so the renderer can paint them red).
function aggregateTotals(allocated: string[]): string[] {
  const p = passiveParts(aggregatePassives(allocated));
  return [...p.up, ...p.down];
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — one self-contained document (dark, Discord-flavoured). Both /rpg/tree and
// /rpg/inv serve it; `tab` just picks the initial view. All CSS + JS inline; the
// snapshot is embedded as JSON so the first paint needs no round-trip, and every
// mutation POSTs to /rpg/act/<token> and swaps in the returned snapshot.
// ─────────────────────────────────────────────────────────────────────────────

function jsonEmbed(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

// Node colours by allocation state (arcane atlas palette) — shared with the client's
// paintTree() repaint. Owned = lit gold, open = mystic emerald, locked = cold obsidian.
const NODE_FILL: Record<string, string> = { owned: "#e9cf86", open: "#2f7d55", locked: "#211f2b" };
const NODE_STROKE: Record<string, string> = { owned: "#f6e7b4", open: "#6ee29a", locked: "#413d52" };
const svgEsc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The tree drawn once, server-side (SSR) — deterministic, so it's what I rasterize in tests
// and what first-paints in the browser. The client never rebuilds it; it only repaints node
// colours + data-s on a mutation (paintTree), which preserves pan/zoom and lets CSS bloom the
// lit nodes. Constellation rings + gold filament edges + a glowing hub give the star-atlas feel.
// Every node carries its cluster emoji (small on entry/mid, big on notables); only NOTABLES get
// a text label — keeps the wheel uncluttered and inside the viewBox margin, so nothing clips.
function treeSvg(snap: WebSnapshot): string {
  const T = snap.tree;
  const emojiOf = (id: string) => snap.clusters.find((c) => c.id === id)?.emoji ?? "";
  const p: string[] = [];
  p.push(
    `<defs>` +
      `<radialGradient id="hubg" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#4a3f6b"/><stop offset="100%" stop-color="#15121e"/></radialGradient>` +
      `<filter id="hubGlow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      `</defs>`,
  );
  // Faint concentric "constellation" rings under the wheel (decorative).
  for (const r of [135, 235, 335]) {
    p.push(`<circle cx="${T.hub.cx}" cy="${T.hub.cy}" r="${r}" fill="none" stroke="rgba(201,164,76,0.09)" stroke-width="1" stroke-dasharray="1 10" pointer-events="none"/>`);
  }
  // Gold filament edges.
  for (const e of T.edges) p.push(`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="rgba(201,164,76,0.30)" stroke-width="3" pointer-events="none"/>`);
  // Glowing hub.
  p.push(`<circle cx="${T.hub.cx}" cy="${T.hub.cy}" r="${T.hub.r}" fill="url(#hubg)" stroke="#c9a44c" stroke-width="3" filter="url(#hubGlow)"/>`);
  p.push(`<text x="${T.hub.cx}" y="${T.hub.cy + 9}" text-anchor="middle" font-size="26" pointer-events="none">⚔️</text>`);
  for (const n of T.nodes) {
    p.push(`<g class="node" data-node="${n.id}">`);
    // Keystones wear a crimson-gold outer ring (the "powerful + costly" marker) around the
    // state-coloured inner circle, so you spot them AND read their allocation state.
    if (n.keystone) p.push(`<circle cx="${n.cx}" cy="${n.cy}" r="${n.r + 6}" fill="none" stroke="#d9863a" stroke-width="2.5" opacity="0.85" pointer-events="none"/>`);
    const emojiFont = n.keystone ? 26 : n.notable ? 20 : 13;
    p.push(`<circle data-c="${n.id}" data-s="${n.state}" cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${NODE_FILL[n.state]}" stroke="${NODE_STROKE[n.state]}" stroke-width="${n.notable || n.keystone ? 4 : 2}"/>`);
    p.push(`<text x="${n.cx}" y="${n.cy + (n.keystone ? 9 : n.notable ? 7 : 5)}" text-anchor="middle" font-size="${emojiFont}" pointer-events="none">${emojiOf(n.cluster)}</text>`);
    // Label notables + keystones (they carry real names); keystones a touch bolder + gold.
    if (n.notable || n.keystone) {
      const fill = n.keystone ? "#f0c070" : "#d8c9a0";
      const fs = n.keystone ? 16 : 14;
      p.push(`<text class="nlabel" x="${n.cx}" y="${n.cy + n.r + 18}" text-anchor="middle" font-size="${fs}" fill="${fill}" pointer-events="none">${svgEsc(n.name)}</text>`);
    }
    p.push(`</g>`);
  }
  return p.join("");
}

export function renderPage(tab: "tree" | "inv", snapshot: WebSnapshot, token: string): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Cửa Ải — Nhân vật</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;900&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>
<header>
  <div class="brand"><span class="orn">✦</span><span class="brand-name">Cửa Ải</span><span class="orn">✦</span></div>
  <nav class="tabs">
    <button class="tab" data-tab="tree">Cây kỹ năng</button>
    <button class="tab" data-tab="inv">Túi đồ</button>
  </nav>
  <div class="points"><span class="pts-cap">Điểm</span><b id="pts">0</b></div>
</header>
<main>
  <section id="view-tree" class="view">
    <div class="tree-wrap">
      <svg id="tree" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${snapshot.tree.size} ${snapshot.tree.size}" preserveAspectRatio="xMidYMid meet"><g id="pz">${treeSvg(snapshot)}</g></svg>
      <div class="legend" id="legend"></div>
    </div>
    <aside class="side">
      <div class="panel charcard" id="charcard"></div>
      <div class="panel totals"><h3>Tổng cộng</h3><ul id="totals"></ul><button class="btn respec" onclick="confirmRespec()">♻ Respec toàn bộ</button></div>
    </aside>
  </section>
  <section id="view-inv" class="view">
    <h3 class="sec">Đang mặc</h3>
    <div class="grid" id="equipped"></div>
    <h3 class="sec">Trong túi · <span id="bagn">0</span></h3>
    <div class="grid" id="bag"></div>
  </section>
</main>
<div id="tip" class="tip hidden"></div>
<div id="action" class="action hidden"></div>
<div id="toast" class="toast hidden"></div>
<script>
const TOKEN = ${JSON.stringify(token)};
let STATE = ${jsonEmbed(snapshot)};
let TAB = ${JSON.stringify(tab)};
${PAGE_JS}
</script>
</body>
</html>`;
}

// A tiny opaque page for a bad/expired token (the GET page routes).
export function expiredPage(): string {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">
<title>Link hết hạn</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Spectral&display=swap" rel="stylesheet">
<style>
body{font-family:'Spectral',Georgia,serif;background:radial-gradient(900px 700px at 50% 30%,#1a1428,#0a0a10);color:#ece2cd;display:grid;place-items:center;min-height:100vh;margin:0}
.c{background:rgba(24,21,32,.8);border:1px solid rgba(201,164,76,.28);border-radius:8px;padding:36px 44px;max-width:440px;text-align:center;box-shadow:0 30px 80px -30px #000}
h1{font-size:44px;margin:0 0 10px}
b{font-family:'Playfair Display','Spectral',serif;color:#ecd493}
p{line-height:1.6;color:#c7bca6}
</style></head>
<body><div class="c"><h1>⏳</h1><p>Link đã hết hạn hoặc không hợp lệ bro. Mở lại <b>/rpg passives</b> trong Discord rồi bấm <b>Mở cây kỹ năng (web)</b> để lấy link mới nhé.</p></div></body></html>`;
}

const PAGE_CSS = `
:root{
  --ink:#0a0a10;--gold:#c9a44c;--gold-hi:#ecd493;--gold-dim:#8a7233;
  --ember:#e07b3a;--arcane:#6ee29a;--ivory:#ece2cd;--muted:#a2957c;
  --edge:rgba(201,164,76,.22);--panel:rgba(26,23,36,.72);
  /* Vietnamese-complete display face: Cinzel ships no vietnamese subset, so every diacritic
     in a heading fell back to a system serif. See the same note in wiki-web.ts. */
  --disp:'Playfair Display','Spectral',Georgia,serif;--dispd:'Playfair Display','Spectral',Georgia,serif;--body:'Spectral',Georgia,serif;
}
*{box-sizing:border-box}
html{scrollbar-color:var(--gold-dim) transparent}
body{margin:0;font-family:var(--body);color:var(--ivory);background:var(--ink);-webkit-tap-highlight-color:transparent;min-height:100vh;position:relative;overflow-x:hidden;text-rendering:optimizeLegibility}
::selection{background:rgba(201,164,76,.32);color:#fff}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;animation:drift 64s ease-in-out infinite alternate;
  background:
    radial-gradient(1100px 820px at 50% 34%,rgba(96,66,150,.30),transparent 60%),
    radial-gradient(760px 640px at 50% 40%,rgba(150,110,48,.14),transparent 56%),
    radial-gradient(2px 2px at 12% 22%,rgba(255,244,214,.7),transparent),
    radial-gradient(1.5px 1.5px at 82% 16%,rgba(255,244,214,.55),transparent),
    radial-gradient(1.5px 1.5px at 68% 68%,rgba(220,210,255,.5),transparent),
    radial-gradient(2px 2px at 28% 74%,rgba(255,244,214,.5),transparent),
    radial-gradient(1px 1px at 44% 12%,rgba(255,255,255,.6),transparent),
    radial-gradient(1px 1px at 90% 60%,rgba(255,255,255,.5),transparent),
    radial-gradient(1.5px 1.5px at 8% 58%,rgba(230,220,255,.45),transparent),
    radial-gradient(1px 1px at 58% 88%,rgba(255,255,255,.45),transparent),
    var(--ink);}
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes drift{from{transform:scale(1) translateY(0)}to{transform:scale(1.06) translateY(-14px)}}

header{display:flex;align-items:center;gap:14px;padding:14px 20px;position:sticky;top:0;z-index:6;flex-wrap:wrap;
  background:linear-gradient(180deg,rgba(12,10,18,.92),rgba(12,10,18,.62));backdrop-filter:blur(8px);
  border-bottom:1px solid var(--edge);box-shadow:0 8px 30px -18px rgba(0,0,0,.9);animation:drop .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes drop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
.brand{display:flex;align-items:center;gap:10px}
.brand-name{font-family:var(--dispd);font-weight:900;font-size:24px;letter-spacing:.04em;background:linear-gradient(180deg,#f4e2ab,#c9a44c 62%,#8a6a26);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 22px rgba(201,164,76,.3)}
.orn{color:var(--gold-dim);font-size:12px}
.tabs{display:flex;gap:8px;margin-left:auto}
.tab{font-family:var(--disp);font-weight:600;letter-spacing:.09em;text-transform:uppercase;font-size:12px;background:rgba(20,18,28,.55);color:var(--muted);border:1px solid var(--edge);border-radius:2px;padding:9px 16px;cursor:pointer;transition:.18s}
.tab:hover{color:var(--gold-hi);border-color:var(--gold-dim)}
.tab.on{color:#1a1206;border-color:var(--gold);background:linear-gradient(180deg,var(--gold-hi),var(--gold));box-shadow:0 0 18px -4px rgba(201,164,76,.6)}
.points{display:flex;align-items:center;gap:8px;font-family:var(--disp);border:1px solid var(--edge);border-radius:2px;padding:7px 14px;background:rgba(20,18,28,.5)}
.pts-cap{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.points b{font-size:16px;color:var(--gold-hi)}

main{padding:20px;max-width:1160px;margin:0 auto}
.view{display:none}
.view.on{display:block;animation:rise .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
#view-tree.on{display:flex;gap:20px;justify-content:center;align-items:flex-start;flex-wrap:wrap}
/* the wheel is the hero: a big TRUE square (width==height) sized to the viewport so the
   square SVG fills it with no letterboxing. Sidebar sits beside it, wraps below when narrow. */
.tree-wrap{position:relative;flex:0 0 auto;width:min(86vh,880px);height:min(86vh,880px);
  border-radius:10px;overflow:hidden;touch-action:none;
  background:radial-gradient(circle at 50% 46%,#1c1728 0%,#0b0910 74%);border:1px solid var(--edge);
  box-shadow:inset 0 0 140px -30px rgba(120,90,180,.45),inset 0 0 0 1px rgba(0,0,0,.5),0 30px 80px -40px rgba(0,0,0,.9)}
.side{flex:0 0 268px;display:flex;flex-direction:column;gap:16px}
@media(max-width:900px){.tree-wrap{width:min(94vw,600px);height:min(94vw,600px)}.side{flex:1 1 100%;width:100%}}
.tree-wrap::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 12px rgba(0,0,0,.55)}
#tree{width:100%;height:100%;display:block;cursor:grab;position:relative;z-index:1}
#tree.drag{cursor:grabbing}
.node{cursor:pointer}
#pz circle{transition:filter .25s,stroke-width .12s}
#pz circle[data-s="owned"]{filter:drop-shadow(0 0 6px rgba(246,231,180,.9))}
#pz circle[data-s="open"]{filter:drop-shadow(0 0 5px rgba(110,226,154,.75))}
.node:hover circle{stroke-width:6}
.nlabel{font-family:var(--disp);letter-spacing:.02em}
.legend{position:absolute;left:12px;bottom:12px;z-index:2;display:flex;flex-wrap:wrap;gap:5px 12px;font-size:11px;color:var(--muted);max-width:66%;background:rgba(10,9,15,.5);border:1px solid var(--edge);border-radius:2px;padding:6px 9px;backdrop-filter:blur(4px)}
.legend span{display:inline-flex;align-items:center;gap:4px}

.panel{background:var(--panel);border:1px solid var(--edge);border-radius:6px;padding:16px 16px 18px;backdrop-filter:blur(6px);box-shadow:0 20px 60px -40px rgba(0,0,0,.9)}
.charcard{padding:18px 16px}
.cc-top{display:flex;align-items:center;gap:13px;margin-bottom:14px}
.cc-emoji{width:52px;height:52px;flex:none;display:grid;place-items:center;font-size:30px;border-radius:8px;background:radial-gradient(circle at 50% 40%,#2a2440,#100e18);border:1px solid var(--edge);box-shadow:inset 0 0 20px -6px rgba(120,90,180,.6)}
.cc-name{font-family:var(--disp);font-size:18px;font-weight:700;letter-spacing:.03em;color:var(--gold-hi)}
.cc-lv{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.cc-bar{height:8px;border-radius:6px;background:rgba(0,0,0,.5);border:1px solid var(--edge);overflow:hidden}
.cc-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-dim),var(--gold-hi))}
.cc-pts{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin:9px 0 5px}
.cc-pts b{color:var(--gold-hi);font-family:var(--disp)}
.totals h3,.sec{font-family:var(--disp);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:var(--gold);margin:0 0 12px;position:relative;padding-bottom:8px}
.totals h3::after,.sec::after{content:"";position:absolute;left:0;bottom:0;width:42px;height:1px;background:linear-gradient(90deg,var(--gold),transparent)}
.totals ul{list-style:none;margin:0;padding:0;font-size:14px;line-height:1.85;color:var(--ivory)}
.totals li{padding-left:16px;position:relative}
.totals li::before{content:"◆";position:absolute;left:0;color:var(--gold-dim);font-size:9px;top:6px}
.totals li.neg{color:#e07a5a}
.totals li.neg::before{content:"▼";color:#b04a2a}

.sec{margin:22px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.card{position:relative;background:linear-gradient(180deg,rgba(26,23,34,.9),rgba(16,14,22,.9));border:1px solid var(--edge);border-left-width:3px;border-radius:5px;padding:12px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:transform .14s,box-shadow .14s}
.card:hover{transform:translateY(-3px);box-shadow:0 16px 34px -20px rgba(0,0,0,.9),0 0 22px -10px var(--rc,rgba(201,164,76,.4))}
.card:active{transform:translateY(-1px) scale(.99)}
.card .top{display:flex;gap:11px;align-items:center}
.card img,.card .emoji{width:52px;height:52px;flex:none;border-radius:4px;background:radial-gradient(circle at 50% 40%,#232030,#0c0a12);border:1px solid rgba(201,164,76,.18)}
.card img{object-fit:contain;padding:3px}
.card .emoji{display:grid;place-items:center;font-size:28px}
.card .nm{font-family:var(--disp);font-size:14px;font-weight:600;line-height:1.15;letter-spacing:.01em}
.card .rr{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.card .st{font-size:12px;color:var(--muted);line-height:1.55;border-top:1px solid rgba(201,164,76,.12);padding-top:7px}
.card .st.down{color:#e07a5a;border-top-color:rgba(224,120,90,.25)}
.card.empty{cursor:default;color:#5c5647;align-items:center;justify-content:center;min-height:80px;border-style:dashed;border-left-width:1px;background:rgba(16,14,22,.4);font-style:italic}

.action{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;width:min(560px,92vw);z-index:12;background:linear-gradient(180deg,rgba(26,22,34,.98),rgba(15,13,21,.98));border:1px solid var(--gold-dim);border-radius:8px;padding:18px 20px;box-shadow:0 30px 80px -30px rgba(0,0,0,.95),0 0 40px -18px rgba(201,164,76,.5);backdrop-filter:blur(8px);animation:sheet .28s cubic-bezier(.2,.9,.2,1) both}
@keyframes sheet{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}
.action h4{margin:0 0 6px;font-family:var(--disp);font-size:17px;letter-spacing:.02em;color:var(--gold-hi)}
.action p{margin:0 0 14px;font-size:14px;color:var(--muted);line-height:1.55}
.action p.down{color:#e88a6a;background:rgba(180,60,30,.12);border:1px solid rgba(224,120,90,.35);border-radius:5px;padding:8px 11px;font-size:13px}
.action .row{display:flex;gap:10px}

.btn{font-family:var(--disp);font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:12px;border:1px solid transparent;border-radius:3px;padding:11px 18px;cursor:pointer;transition:.16s}
.btn.go{background:linear-gradient(180deg,#7fe6a6,#2f9d63);color:#08160d;border-color:#6ee29a;box-shadow:0 0 18px -6px rgba(110,226,154,.6)}
.btn.go:hover{filter:brightness(1.08)}
.btn.warn{background:linear-gradient(180deg,#f0975a,#c85f28);color:#1a0d04;border-color:var(--ember)}
.btn.off{background:rgba(40,36,50,.8);color:var(--muted);border-color:var(--edge)}
.btn.off:hover{color:var(--ivory)}
.btn.respec{margin-top:16px;width:100%;background:rgba(58,32,20,.5);color:#f0a06a;border-color:#6d3a22;font-size:11px;letter-spacing:.1em}
.btn.respec:hover{background:rgba(80,42,24,.6);color:#ffb884}
.btn:disabled{opacity:.45;cursor:default;box-shadow:none;filter:none}

.tip{position:fixed;z-index:30;pointer-events:none;max-width:280px;left:0;top:0;background:rgba(12,10,18,.98);border:1px solid var(--gold-dim);border-radius:6px;padding:10px 13px;box-shadow:0 16px 44px -14px #000}
.tip-t{font-family:var(--disp);font-weight:600;font-size:14px;letter-spacing:.02em;margin-bottom:4px}
.tip-d{color:var(--muted);font-size:13px;line-height:1.5;margin-bottom:6px}
.tip-s{font-size:12px}
.tip-down{color:#e88a6a;font-size:12px;line-height:1.45;margin-bottom:6px;border-top:1px solid rgba(224,120,90,.25);padding-top:5px}
.hidden{display:none!important}
.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:20;max-width:88%;text-align:center;font-size:13px;color:var(--ivory);padding:11px 18px;border-radius:4px;background:rgba(12,10,18,.96);border:1px solid var(--gold-dim);box-shadow:0 0 30px -10px rgba(0,0,0,.9)}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
`;

const PAGE_JS = String.raw`
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NODE_FILL={owned:'#e9cf86',open:'#2f7d55',locked:'#211f2b'};
const NODE_STROKE={owned:'#f6e7b4',open:'#6ee29a',locked:'#413d52'};
let dragged=false;  // a pan happened → suppress the click that follows pointerup (reset on next pointerdown)
let panning=false;  // pointer is actively dragging → suppress hover tooltips
let view={tx:0,ty:0,k:1};

function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(toast._);toast._=setTimeout(()=>t.classList.add('hidden'),2200);}

function setTab(t){TAB=t;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));$('#view-tree').classList.toggle('on',t==='tree');$('#view-inv').classList.toggle('on',t==='inv');hideAction();}

function applyTransform(){$('#pz').setAttribute('transform','translate('+view.tx+' '+view.ty+') scale('+view.k+')');}

function renderAll(){
  $('#pts').textContent=STATE.pointsLeft+'/'+STATE.pointsTotal;
  renderChar();paintTree();renderTotals();renderInv();
}
function renderChar(){
  const el=$('#charcard');if(!el)return;
  const spent=STATE.pointsTotal-STATE.pointsLeft;
  const pct=STATE.pointsTotal?Math.round(spent/STATE.pointsTotal*100):0;
  el.innerHTML='<div class="cc-top"><div class="cc-emoji">'+STATE.clsEmoji+'</div><div><div class="cc-name">'+esc(STATE.clsName)+'</div><div class="cc-lv">Cấp '+STATE.level+'</div></div></div>'
    +'<div class="cc-pts"><span>Điểm passive</span><b>'+STATE.pointsLeft+' / '+STATE.pointsTotal+'</b></div>'
    +'<div class="cc-bar"><i style="width:'+pct+'%"></i></div>';
}

// The tree SVG is server-rendered once; on a mutation we only REPAINT node colours from STATE
// (fast, and preserves the pan/zoom transform on #pz). Clicks are wired once in init.
function paintTree(){
  for(const n of STATE.tree.nodes){
    const c=document.querySelector('circle[data-c="'+CSS.escape(n.id)+'"]');
    if(c){c.setAttribute('fill',NODE_FILL[n.state]);c.setAttribute('stroke',NODE_STROKE[n.state]);c.setAttribute('data-s',n.state);}
  }
}
function wireNodes(){
  document.querySelectorAll('#pz .node').forEach(el=>{
    el.addEventListener('click',ev=>{ev.stopPropagation();if(dragged)return;selectNode(el.dataset.node);});
    el.addEventListener('pointerenter',ev=>{if(ev.pointerType!=='touch')showTip(el.dataset.node);});
    el.addEventListener('pointermove',moveTip);
    el.addEventListener('pointerleave',hideTip);
  });
  $('#legend').innerHTML='<span><b style="color:#e9cf86">●</b> đã học</span><span><b style="color:#6ee29a">●</b> học được</span><span><b style="color:#6d6a58">●</b> khoá</span><span style="opacity:.75">· di chuột / chạm node để xem, bấm để học</span>';
}
// Hover tooltip — shows a node's name + effect + status so you know it before clicking.
function tipStatus(n){
  if(n.state==='open')return '<b style="color:#6ee29a">✦ Bấm để học (−1 điểm)</b>';
  if(n.state==='owned')return n.removable?'<b style="color:#e9cf86">Đã học · bấm để tháo</b>':'<b style="color:#e9cf86">Đã học</b>';
  return '<b style="color:#d98a6a">🔒 '+esc(n.lock||'Khoá')+'</b>';
}
function showTip(id){
  if(panning)return;
  const n=STATE.tree.nodes.find(x=>x.id===id);if(!n)return;
  const c=n.state==='owned'?'#e9cf86':n.state==='open'?'#6ee29a':'#b9ad93';
  const mark=n.keystone?'💠 ':n.notable?'⭐ ':'';
  const down=n.downside?'<div class="tip-down">⚠ '+esc(n.downside)+'</div>':'';
  $('#tip').innerHTML='<div class="tip-t" style="color:'+c+'">'+mark+esc(n.name)+'</div>'+(n.detail?'<div class="tip-d">'+esc(n.detail)+'</div>':'')+down+'<div class="tip-s">'+tipStatus(n)+'</div>';
  $('#tip').classList.remove('hidden');
}
function moveTip(e){
  const t=$('#tip');if(t.classList.contains('hidden'))return;
  const pad=16,r=t.getBoundingClientRect();let x=e.clientX+pad,y=e.clientY+pad;
  if(x+r.width>innerWidth-8)x=e.clientX-r.width-pad;
  if(y+r.height>innerHeight-8)y=e.clientY-r.height-pad;
  t.style.left=Math.max(8,x)+'px';t.style.top=Math.max(8,y)+'px';
}
function hideTip(){$('#tip').classList.add('hidden');}
function renderTotals(){
  const u=$('#totals');
  u.innerHTML=STATE.tree.totals.length?STATE.tree.totals.map(t=>'<li'+(t.trim().charAt(0)==='−'?' class="neg"':'')+'>'+esc(t)+'</li>').join(''):'<li style="color:#6d7178">Chưa học node nào.</li>';
}

function itemCard(it,where){
  const img='<img src="/rpg/asset/item/'+encodeURIComponent(it.art)+'.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'emoji\',textContent:\''+it.slotEmoji+'\'}))">';
  const st=it.stats.slice(0,3).map(esc).join(' · ');
  return '<div class="card" style="border-left-color:'+it.color+';--rc:'+it.color+'" data-'+where+'="'+esc(where==='bag'?it.id:it.slot)+'">'
    +'<div class="top">'+img+'<div><div class="nm" style="color:'+it.color+'">'+esc(it.name)+(it.plus?' <span style="color:var(--gold-hi)">+'+it.plus+'</span>':'')+(it.star?' <span style="color:var(--gold-hi)">'+'★'.repeat(it.star)+'</span>':'')+'</div><div class="rr">'+esc(it.rarityName)+' · '+esc(it.slotName)+'</div></div></div>'
    +(st?'<div class="st">'+st+'</div>':'')
    +(it.downside?'<div class="st down">⚠ '+esc(it.downside)+'</div>':'')+'</div>';
}
function renderInv(){
  const eq=$('#equipped');
  eq.innerHTML=STATE.inv.equipped.length?STATE.inv.equipped.map(it=>itemCard(it,'slot')).join(''):'<div class="card empty">Chưa mặc gì</div>';
  eq.querySelectorAll('[data-slot]').forEach(el=>el.addEventListener('click',()=>selectEquipped(el.dataset.slot)));
  const bag=$('#bag');
  $('#bagn').textContent=STATE.inv.bag.length+'/'+STATE.inv.bagLimit;
  bag.innerHTML=STATE.inv.bag.length?STATE.inv.bag.map(it=>itemCard(it,'bag')).join(''):'<div class="card empty">Túi trống</div>';
  bag.querySelectorAll('[data-bag]').forEach(el=>el.addEventListener('click',()=>selectBag(el.dataset.bag)));
}

function showAction(html){const a=$('#action');a.innerHTML=html;a.classList.remove('hidden');}
function hideAction(){$('#action').classList.add('hidden');SEL=null;}

function selectNode(id){
  const n=STATE.tree.nodes.find(x=>x.id===id);if(!n)return;
  let btn='';
  if(n.state==='open')btn='<button class="btn go" onclick="doAct({op:\'alloc\',nodeId:\''+n.id+'\'})">Học (−1 điểm)</button>';
  else if(n.state==='owned')btn=n.removable
    ?'<button class="btn warn" onclick="doAct({op:\'dealloc\',nodeId:\''+n.id+'\'})">♻️ Tháo (+1 điểm)</button>'
    :'<button class="btn off" disabled>Đã học · tháo node phụ thuộc trước</button>';
  else btn='<button class="btn off" disabled>🔒 '+esc(n.lock||'Khoá')+'</button>';
  const mark=n.keystone?'💠 ':n.notable?'⭐ ':'';
  const down=n.downside?'<p class="down">⚠ Đánh đổi: '+esc(n.downside)+'</p>':'';
  showAction('<h4>'+mark+esc(n.name)+'</h4><p>'+(esc(n.detail)||'—')+'</p>'+down+'<div class="row">'+btn+'<button class="btn off" onclick="hideAction()">Đóng</button></div>');
}
function confirmRespec(){
  const spent=STATE.pointsTotal-STATE.pointsLeft;
  if(spent<=0){toast('Chưa học node nào');return;}
  showAction('<h4>♻️ Respec toàn bộ?</h4><p>Hoàn lại <b>'+spent+'</b> điểm để phân bổ lại. Miễn phí.</p><div class="row"><button class="btn warn" onclick="doAct({op:\'respec\'})">Xác nhận</button><button class="btn off" onclick="hideAction()">Huỷ</button></div>');
}
function selectEquipped(slot){
  const it=STATE.inv.equipped.find(x=>x.slot===slot);if(!it)return;
  showAction(itemDetail(it)+'<div class="row"><button class="btn go" onclick="doAct({op:\'unequip\',slot:\''+slot+'\'})">Tháo ra</button><button class="btn off" onclick="hideAction()">Đóng</button></div>');
}
function selectBag(id){
  const it=STATE.inv.bag.find(x=>x.id===id);if(!it)return;
  showAction(itemDetail(it)+'<div class="row"><button class="btn go" onclick="doAct({op:\'equip\',itemId:\''+id+'\'})">Trang bị</button><button class="btn off" onclick="hideAction()">Đóng</button></div>');
}
function itemDetail(it){
  const lines=[].concat(it.stats,it.mods).map(esc).join('<br>');
  return '<h4 style="color:'+it.color+'">'+esc(it.name)+(it.plus?' +'+it.plus:'')+(it.star?' '+'★'.repeat(it.star):'')+(it.capNote?' <span style="font-size:11px;color:#9aa0a6">🔒 '+esc(it.capNote)+'</span>':'')+' <span style="font-size:12px;color:#9aa0a6">'+esc(it.rarityName)+' · '+esc(it.slotName)+'</span></h4>'
    +'<p>'+(lines||'—')+(it.flavor?'<br><i style="color:#9aa0a6">'+esc(it.flavor)+'</i>':'')+'</p>'
    +(it.downside?'<p class="down">⚠ Đánh đổi: '+esc(it.downside)+'</p>':'');
}

let BUSY=false;
async function doAct(body){
  if(BUSY)return;BUSY=true;
  try{
    const r=await fetch('/rpg/act/'+TOKEN,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if(r.status===401){toast('Link hết hạn — mở /rpg passives lấy link mới');return;}
    const j=await r.json();
    if(!j.ok){toast(j.error||'Không được');return;}
    STATE=j.state;hideAction();renderAll();
  }catch(e){toast('Lỗi mạng');}finally{BUSY=false;}
}

// Pan/zoom. IMPORTANT: do NOT setPointerCapture on the svg — that retargets the click to
// the svg so node clicks never fire. Instead track the drag on window listeners and only
// treat it as a pan once it moves past a small threshold; a pure press-release stays a click.
(function(){
  const svg=$('#tree');let down=null;
  svg.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty};dragged=false;});
  window.addEventListener('pointermove',e=>{
    if(!down)return;
    const dx=e.clientX-down.x,dy=e.clientY-down.y;
    if(!dragged&&Math.abs(dx)+Math.abs(dy)>5){dragged=true;panning=true;svg.classList.add('drag');hideTip();}
    if(panning){view.tx=down.tx+dx;view.ty=down.ty+dy;applyTransform();}
  });
  const end=()=>{down=null;panning=false;svg.classList.remove('drag');};
  window.addEventListener('pointerup',end);
  window.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.12:0.89;const nk=Math.min(4,Math.max(0.5,view.k*f));const rect=svg.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*STATE.tree.size;const my=(e.clientY-rect.top)/rect.height*STATE.tree.size;view.tx=mx-(mx-view.tx)*(nk/view.k);view.ty=my-(my-view.ty)*(nk/view.k);view.k=nk;applyTransform();},{passive:false});
})();

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#tree').addEventListener('click',()=>{if(!dragged)hideAction();});
wireNodes();applyTransform();renderAll();setTab(TAB);
`;
