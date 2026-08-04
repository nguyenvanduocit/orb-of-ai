#!/usr/bin/env bun
/**
 * Clean-JSON trade primitive for the gear-optimizer engine.
 *
 * Why not reuse trade-search.ts? Its client.searchAndFetch GETs 10 items in one
 * call (~20KB), and the playwriter page-context transport truncates its stdout
 * marker line beyond ~8KB — so large fetches return a half-JSON that throws
 * "Unexpected identifier" / "Unterminated string". This script fetches in small
 * batches (default 3, ~5-6KB, verified reliable) straight through poeFetch and
 * emits machine JSON the Python engine can consume without regex-parsing human
 * output.
 *
 * Sequential by construction; poeFetch's O_EXCL lockfile + >=2s spacing also
 * serialises it against any other GGG caller (the account was flagged).
 *
 * Usage:
 *   bun trade-fetch.ts --category accessory.ring --stat "pseudo.pseudo_total_fire_resistance:25" \
 *     --stat "explicit.stat_328541901:15" --price 25 --limit 10 [--type "Gold Ring"] [--batch 3]
 * Output (stdout): { url, total, items: [{ name, price, currency, pob }] }
 */
import { poeFetch } from "../../poe-trade/ggg/transport.ts";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
function args(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${name}`) out.push(process.argv[i + 1]);
  return out;
}

const league = arg("league", "Runes of Aldur")!;
const category = arg("category");
const type = arg("type");
const priceEx = arg("price");
const limit = parseInt(arg("limit", "10")!, 10);
const batch = parseInt(arg("batch", "3")!, 10);

const stats = args("stat").map((s) => {
  const i = s.lastIndexOf(":");
  const id = i >= 0 ? s.slice(0, i) : s;
  const min = i >= 0 ? Number(s.slice(i + 1)) : undefined;
  return min !== undefined && Number.isFinite(min) ? { id, value: { min } } : { id };
});

const query: any = { status: { option: "securable" } };
if (type) query.type = type;
if (stats.length) query.stats = [{ type: "and", filters: stats }];
query.filters = {};
if (category) query.filters.type_filters = { filters: { category: { option: category } } };
if (priceEx) query.filters.trade_filters = { filters: { price: { max: Number(priceEx), option: "exalted" } } };
const body = { query, sort: { price: "asc" } };

function rarityOf(ft: number | undefined): string {
  return ft === 3 ? "UNIQUE" : ft === 2 ? "RARE" : ft === 1 ? "MAGIC" : "NORMAL";
}
function toPob(item: any): string {
  const rarity = rarityOf(item.frameType);
  const lines: string[] = [`Rarity: ${rarity}`];
  if (rarity === "RARE" || rarity === "UNIQUE") {
    if (item.name) lines.push(item.name);
    if (item.typeLine) lines.push(item.typeLine);
  } else if (item.typeLine) lines.push(item.typeLine);
  const lvl = item.requirements?.find((r: any) => r.name === "Level")?.values?.[0]?.[0];
  if (lvl !== undefined) lines.push(`LevelReq: ${lvl}`);
  lines.push(`Implicits: ${item.implicitMods?.length ?? 0}`);
  for (const m of item.implicitMods ?? []) lines.push(m);
  for (const m of item.enchantMods ?? []) lines.push(`{enchant}${m}`);
  for (const m of item.runeMods ?? []) lines.push(`{rune}${m}`);
  for (const m of item.fracturedMods ?? []) lines.push(`{fractured}${m}`);
  for (const m of item.explicitMods ?? []) lines.push(m);
  for (const m of item.craftedMods ?? []) lines.push(`{crafted}${m}`);
  if (item.corrupted) lines.push("Corrupted");
  return lines.join("\n");
}

async function main() {
  const s = await poeFetch("poe2", "POST", `/api/trade2/search/poe2/${encodeURIComponent(league)}`, body);
  const data: any = s.data;
  const url = `https://www.pathofexile.com/trade2/search/poe2/${encodeURIComponent(league)}/${data.id}`;
  const ids: string[] = (data.result || []).slice(0, limit);
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    const r = await poeFetch("poe2", "GET", `/api/trade2/fetch/${chunk.join(",")}?query=${data.id}&realm=poe2`);
    for (const fe of (r.data as any).result || []) {
      if (!fe) continue;
      const price = fe.listing?.price;
      items.push({
        name: (fe.item.name ? fe.item.name + " " : "") + (fe.item.typeLine || ""),
        price: price?.amount ?? null,
        currency: price?.currency ?? null,
        pob: toPob(fe.item),
      });
    }
  }
  console.log(JSON.stringify({ url, total: data.total ?? null, items }));
}
main().catch((e) => {
  console.log(JSON.stringify({ url: null, total: null, items: [], error: String(e?.message || e).slice(0, 300) }));
  process.exit(0);
});
