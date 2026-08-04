#!/usr/bin/env bun
/**
 * requirements.ts — extract + compute attribute/level requirements from a POE2 character export JSON.
 *
 * Reads ONLY the export (poe.ninja model produced by the pob fetch scripts). All raw requirements
 * already live in the file; the value-add is the EFFECTIVE requirement the export does not precompute:
 *
 *   - Giant's Blood keystone → TRIPLE the attribute requirement of Martial Weapons (the wielded weapon).
 *   - "#% reduced Attribute Requirements" is ALWAYS LOCAL — it only lowers the item it sits on, never
 *     another item's requirement, and never a socketed gem's requirement (verified: wiki Explicit_modifier).
 *   - The only character-wide reduction is worded "Equipment and Skill Gems have #% reduced Attribute
 *     Requirements" (passive notables / some uniques). Pass --global-reduced N to supply a tree value the
 *     export does not carry as text.
 *
 * Usage:
 *   bun requirements.ts <export.json>
 *   bun requirements.ts <export.json> --candidate "str:114,martial"   # what-if a candidate item's raw req
 *   bun requirements.ts <export.json> --global-reduced 8              # add 8% global reduced-attr-req
 *   bun requirements.ts <export.json> --json
 */

import { readFileSync } from "node:fs";

type AttrKey = "str" | "dex" | "int";
const ATTRS: AttrKey[] = ["str", "dex", "int"];
const ATTR_LABEL: Record<AttrKey, string> = { str: "Str", dex: "Dex", int: "Int" };

// Martial weapon types (Giant's Blood triples these). Caster weapons (Wand/Sceptre/Focus) are excluded.
const MARTIAL = ["mace", "axe", "sword", "spear", "quarterstaff", "flail", "crossbow", "bow", "claw", "dagger", "warstaff", "trident", "greathammer"];
const CASTER = ["wand", "sceptre", "focus"];

interface Req { source: string; slot: string; martial: boolean; level: number; str: number; dex: number; int: number; localReducedPct: number; }
interface EffReq { source: string; note: string; str: number; dex: number; int: number; level: number; }

const asArray = (x: any): any[] => Array.isArray(x) ? x : [];
const num = (v: any): number => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : 0; };

function classifyAttr(name: string): AttrKey | "level" | null {
  const s = name.toLowerCase();
  if (s.includes("strength")) return "str";
  if (s.includes("dexterity")) return "dex";
  if (s.includes("intelligence")) return "int";
  if (s.includes("level")) return "level";
  return null;
}

function parseRequirements(reqList: any): { level: number; str: number; dex: number; int: number } {
  const out = { level: 0, str: 0, dex: 0, int: 0 };
  for (const r of asArray(reqList)) {
    const kind = classifyAttr(r?.name || "");
    const val = num(r?.values?.[0]?.[0]);
    if (kind && val) (out as any)[kind] = Math.max((out as any)[kind], val);
  }
  return out;
}

// Walk every mod string on an item (explicit/implicit/rune/desecrated/crafted/enchant + bondedMods + canonical mods[]).
function* modStrings(itemData: any): Generator<string> {
  const fields = ["explicitMods", "implicitMods", "runeMods", "desecratedMods", "craftedMods", "enchantMods", "fracturedMods", "utilityMods", "bondedMods"];
  for (const f of fields) for (const m of asArray(itemData?.[f])) if (typeof m === "string") yield m;
  for (const m of asArray(itemData?.mods)) {
    if (typeof m === "string") yield m;
    else if (m && typeof m === "object") for (const v of Object.values(m)) if (typeof v === "string") yield v;
  }
}

function localReducedPct(itemData: any): number {
  let pct = 0;
  for (const s of modStrings(itemData)) {
    const low = s.toLowerCase();
    if (low.includes("reduced") && low.includes("attribute") && low.includes("requirement") && !low.includes("equipment and skill gems")) {
      const m = s.match(/(\d+)\s*%/);
      if (m) pct += num(m[1]);
      else {
        const t = s.match(/ReducedLocalAttributeRequirements(\d+)/i); // canonical name: tier 1..6 = 15/20/25/30/35/40
        if (t) pct += [0, 15, 20, 25, 30, 35, 40][num(t[1])] || 0;
      }
    }
  }
  return pct;
}

function globalReducedPct(cm: any): number {
  let pct = 0;
  const texts: string[] = [];
  for (const k of asArray(cm.keystones)) for (const s of asArray(k?.stats)) texts.push(s);
  for (const it of asArray(cm.items)) for (const s of modStrings(it.itemData || it)) texts.push(s);
  for (const j of asArray(cm.jewels)) for (const s of modStrings(j.itemData || j)) texts.push(s);
  for (const t of texts) if (/equipment and skill gems have\s+\d+%\s+reduced attribute requirement/i.test(t)) {
    const m = t.match(/(\d+)\s*%/); if (m) pct += num(m[1]);
  }
  return pct;
}

function isMartialWeapon(itemData: any): boolean {
  const slot = (itemData?.inventoryId || "").toLowerCase();
  if (!slot.includes("weapon") && slot !== "offhand") return false;
  const ptype = ((itemData?.properties?.[0]?.name) || itemData?.typeLine || itemData?.baseType || "").toLowerCase();
  if (CASTER.some(c => ptype.includes(c))) return false;
  return MARTIAL.some(m => ptype.includes(m));
}

function collectItem(itemData: any, out: Req[]) {
  const reqs = parseRequirements(itemData?.requirements);
  const name = itemData?.name || itemData?.typeLine || itemData?.baseType || "?";
  const slot = itemData?.inventoryId || "";
  if (reqs.str || reqs.dex || reqs.int || reqs.level)
    out.push({ source: name, slot, martial: isMartialWeapon(itemData), ...reqs, localReducedPct: localReducedPct(itemData) });
  // socketed gems carry their own requirements (NOT affected by the weapon's Giant's Blood or local reduced-req)
  for (const g of asArray(itemData?.socketedItems)) {
    const gd = g?.itemData || g;
    const gr = parseRequirements(gd?.requirements);
    if (gr.str || gr.dex || gr.int || gr.level)
      out.push({ source: `↳ ${gd?.name || gd?.typeLine || "gem"}`, slot: `${slot} (gem)`, martial: false, ...gr, localReducedPct: 0 });
    for (const sg of asArray(gd?.socketedItems)) collectItem(sg?.itemData || sg, out);
  }
}

function effective(r: Req, giantsBlood: boolean, globalPct: number): EffReq {
  const triple = giantsBlood && r.martial ? 3 : 1;
  const factor = triple * (1 - r.localReducedPct / 100) * (1 - globalPct / 100);
  const note = [triple === 3 ? "×3 GiantsBlood" : null, r.localReducedPct ? `-${r.localReducedPct}% local` : null].filter(Boolean).join(" ");
  const ap = (v: number) => v ? Math.ceil(v * factor) : 0;
  return { source: r.source, note, str: ap(r.str), dex: ap(r.dex), int: ap(r.int), level: r.level };
}

// ---- main ----
const args = process.argv.slice(2);
const flagVal = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const wantJson = args.includes("--json");
const candidate = flagVal("--candidate");
const globalOverride = flagVal("--global-reduced");
const path = args.find(a => !a.startsWith("--") && a !== globalOverride && a !== candidate);
if (!path) { console.error('usage: bun requirements.ts <export.json> [--candidate "str:114,martial"] [--global-reduced N] [--json]'); process.exit(1); }

const data = JSON.parse(readFileSync(path, "utf8"));
const cm = data.charModel ?? data;
const ds = cm.defensiveStats || {};
const have: Record<AttrKey, number> = { str: num(ds.strength), dex: num(ds.dexterity), int: num(ds.intelligence) };
const charLevel = num(cm.level);
const giantsBlood = asArray(cm.keystones).some((k: any) => String(k?.name ?? k).includes("Giant's Blood"));
const globalPct = globalReducedPct(cm) + num(globalOverride);

const reqs: Req[] = [];
for (const it of asArray(cm.items)) collectItem(it.itemData || it, reqs);
const eff = reqs.map(r => effective(r, giantsBlood, globalPct));

const binding: Record<AttrKey, { val: number; source: string }> = { str: { val: 0, source: "" }, dex: { val: 0, source: "" }, int: { val: 0, source: "" } };
for (const e of eff) for (const a of ATTRS) if (e[a] > binding[a].val) binding[a] = { val: e[a], source: e.source };
const bindingLevel = Math.max(charLevel, ...eff.map(e => e.level), 0);

let candidateResult: any = null;
if (candidate) {
  const parts = candidate.split(",").map(s => s.trim());
  const martial = parts.includes("martial");
  const [k, v] = parts[0].split(":");
  const attr = k.toLowerCase() as AttrKey; const base = num(v);
  const triple = giantsBlood && martial ? 3 : 1;
  const effReq = Math.ceil(base * triple * (1 - globalPct / 100));
  candidateResult = { attr, base, martial, triple, globalPct, effReq, have: have[attr] ?? 0, gap: Math.max(0, effReq - (have[attr] ?? 0)) };
}

if (wantJson) {
  console.log(JSON.stringify({ char: { level: charLevel, ...have }, giantsBlood, globalReducedPct: globalPct, binding, bindingLevel, requirements: eff, candidate: candidateResult }, null, 2));
} else {
  console.log(`\nCharacter: Lv${charLevel}  Str ${have.str}  Dex ${have.dex}  Int ${have.int}`);
  console.log(`Giant's Blood: ${giantsBlood ? "YES (martial weapon attr req ×3)" : "no"}   global reduced-attr-req: ${globalPct}%`);
  console.log(`\nEffective requirements by source:`);
  for (const e of eff.sort((a, b) => Math.max(b.str, b.dex, b.int) - Math.max(a.str, a.dex, a.int))) {
    const parts = ATTRS.filter(a => e[a]).map(a => `${ATTR_LABEL[a]} ${e[a]}`);
    if (!parts.length && !e.level) continue;
    console.log(`  ${e.source.padEnd(34)} ${parts.join("  ") || "(level only)"}${e.note ? "   [" + e.note + "]" : ""}`);
  }
  console.log(`\nBinding requirement vs character:`);
  console.log(`  Level  need ${bindingLevel.toString().padStart(4)}   have ${charLevel}   ${charLevel >= bindingLevel ? "OK" : "UNMET"}`);
  for (const a of ATTRS) {
    const b = binding[a]; const ok = have[a] >= b.val;
    console.log(`  ${ATTR_LABEL[a]}    need ${b.val.toString().padStart(4)}   have ${have[a].toString().padStart(4)}   ${ok ? "OK" : `UNMET (short ${b.val - have[a]})`}   ${b.source ? "← " + b.source : ""}`);
  }
  if (candidateResult) {
    const c = candidateResult;
    console.log(`\nWhat-if candidate: ${ATTR_LABEL[c.attr as AttrKey]} base ${c.base}${c.martial ? " (martial)" : ""}`);
    console.log(`  effective = ${c.base} ×${c.triple}${c.globalPct ? ` ×(1-${c.globalPct}%)` : ""} = ${c.effReq}   have ${c.have}   ${c.gap ? `SHORT ${c.gap}` : "OK"}`);
  }
  console.log();
}
