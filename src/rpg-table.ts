// Monospace TABLE rendering for the RPG's stat-bearing surfaces (items, character sheet,
// inventory, market) — PURE (no Discord types, no I/O). Discord only aligns text inside a
// ``` code block (monospace), so every "table" here is plain padded text the caller wraps in
// `codeBlock`. Two hard rules that keep columns straight:
//   1. NO emoji inside the aligned region — emoji render ~2 cells wide but count as 1 char, so
//      they shear the columns. Emoji (rarity/slot/element) live in the title/aside lines the
//      caller puts OUTSIDE the block.
//   2. Width is measured in NFC code points (`w`), so Vietnamese diacritics — precomposed to a
//      single code point + single monospace cell — align correctly.
// This is the one home for the StatId→label vocabulary + the padding helpers; commands/rpg.ts
// and rpg-web.ts both read the labels from here so the Discord and web views never drift.

import { GEAR_BASES, GEAR_SLOTS, RARITIES, UNIQUE_BY_ID, type GearItem, type StatId } from "./rpg";

// StatId → Vietnamese label (matches the Discord xưng hô). `pct` ids render as percentages.
export const STAT_LABEL: Record<StatId, { name: string; pct?: boolean }> = {
  life: { name: "Máu" },
  es: { name: "Khiên NL" },
  armour: { name: "Giáp" },
  evasion: { name: "Né" },
  atk: { name: "Công" },
  spell: { name: "Phép" },
  addPhys: { name: "+ST Vật lý" },
  addFire: { name: "+ST Lửa" },
  addCold: { name: "+ST Băng" },
  addLight: { name: "+ST Sét" },
  addChaos: { name: "+ST Hỗn mang" },
  atkPct: { name: "ST Đánh", pct: true },
  spellPct: { name: "ST Phép", pct: true },
  speedPct: { name: "Tốc đánh", pct: true },
  crit: { name: "Chí mạng", pct: true },
  critMulti: { name: "ST Chí mạng", pct: true },
  resFire: { name: "Kháng Lửa", pct: true },
  resCold: { name: "Kháng Băng", pct: true },
  resLight: { name: "Kháng Sét", pct: true },
  resChaos: { name: "Kháng Hỗn mang", pct: true },
  spirit: { name: "Linh Lực" },
  mana: { name: "Nộ Khí" },
  manaRegen: { name: "Hồi Nộ/hiệp" },
};

// Display width in monospace cells — NFC code points (Vietnamese diacritics collapse to 1).
export function w(s: string): number {
  return [...s.normalize("NFC")].length;
}
function padR(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - w(s)));
}
function padL(s: string, n: number): string {
  return " ".repeat(Math.max(0, n - w(s))) + s;
}
const rstrip = (s: string) => s.replace(/[ ]+$/, "");

// Wrap a rendered table in a fenced code block so Discord renders it monospace (aligned).
export function codeBlock(s: string): string {
  return "```\n" + s + "\n```";
}

// A 2-column stat table: label left-aligned, value right-aligned. `[["Công","120"],…]`.
export function statTable(rows: [string, string][]): string {
  if (rows.length === 0) return "—";
  const lw = Math.max(...rows.map((r) => w(r[0])));
  const vw = Math.max(...rows.map((r) => w(r[1])));
  return rows.map(([k, v]) => `${padR(k, lw)}  ${padL(v, vw)}`).join("\n");
}

// Two stat groups side by side (character sheet: TẤN CÔNG | PHÒNG THỦ). Each group is a title
// line + its own label/value rows; the shorter group is padded with blanks so both align.
export function twoColumn(title1: string, rows1: [string, string][], title2: string, rows2: [string, string][]): string {
  const group = (title: string, rows: [string, string][]): string[] => {
    const lw = Math.max(w(title), ...rows.map((r) => w(r[0])), 0);
    const vw = rows.length ? Math.max(...rows.map((r) => w(r[1]))) : 0;
    return [title, ...rows.map(([k, v]) => `${padR(k, lw)}  ${padL(v, vw)}`)];
  };
  const A = group(title1, rows1);
  const B = group(title2, rows2);
  const aw = Math.max(...A.map(w));
  const n = Math.max(A.length, B.length);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(rstrip(`${padR(A[i] ?? "", aw)}   ${B[i] ?? ""}`));
  return out.join("\n");
}

// A header + rows list table (inventory, market). `align[i]="r"` right-aligns column i.
export function listTable(headers: string[], rows: string[][], align: ("l" | "r")[] = []): string {
  const widths = headers.map((h, i) => Math.max(w(h), ...rows.map((r) => w(r[i] ?? "")), 0));
  const line = (cells: string[]): string => rstrip(cells.map((c, i) => (align[i] === "r" ? padL : padR)(c ?? "", widths[i]!)).join("  "));
  return [line(headers), ...rows.map(line)].join("\n");
}

// Format one StatId value for a table cell: percentage vs flat, always signed (gear stats are
// bonuses). e.g. addFire 8 → "+8", crit 0.05 → "+5.0%", a negative → "-3".
export function statCell(key: StatId, v: number): string {
  const sign = v >= 0 ? "+" : "";
  return STAT_LABEL[key].pct ? `${sign}${(v * 100).toFixed(1)}%` : `${sign}${Math.round(v)}`;
}

// Item name + tier as table-safe strings (NO emoji — kept out of aligned columns). `gearName`
// (commands/rpg.ts) keeps the emoji/rarity-word one-liner for prose; these feed the tables.
export function itemName(item: GearItem): string {
  if (item.uniqueId) return UNIQUE_BY_ID[item.uniqueId]?.name ?? item.uniqueId;
  return GEAR_BASES[item.base]?.name ?? item.base;
}
export function itemTier(item: GearItem): string {
  const plus = item.plus > 0 ? ` +${item.plus}` : "";
  return `${item.uniqueId ? "Unique" : RARITIES[item.rarity].name}${plus}`;
}

// A plain Tên | Ô | Cấp table for a list of gear (loot reveal, PvP haul/spoils). Shared so the
// expedition summary and the PvP surfaces render drops the same way as the inventory.
export function gearTable(items: GearItem[]): string {
  if (items.length === 0) return "—";
  return codeBlock(
    listTable(
      ["Tên", "Ô", "Cấp"],
      items.map((it) => [itemName(it), GEAR_SLOTS.find((s) => s.id === it.slot)?.name ?? it.slot, itemTier(it)]),
    ),
  );
}
