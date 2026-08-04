#!/usr/bin/env bun
/**
 * poe2scout.com lightweight catalog snapshot.
 *
 * Builds *only* `catalog.json` — manifest of all items in league + current price/quantity.
 * Per-item DailyStatsHistory được fetch LAZY qua `api.sh item <name>` và cache vào
 * `items/<id>.json` khi user thực sự lookup. Tránh bulk-pull bị API rate-limit.
 *
 * Output:
 *   data/poe2scout/<league>/catalog.json    — manifest (override mỗi run)
 *
 * Usage:
 *   bun snapshot.ts --realm pc   --league mirage
 *   bun snapshot.ts --realm poe2 --league vaal
 *
 * For full history archive + trends: `api.sh trends` (opt-in, slow).
 */

import { mkdir, writeFile, rm, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BASE_URL = "https://api.poe2scout.com"
const PER_PAGE = 100
const REQUEST_GAP_MS = 100

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = join(SCRIPT_DIR, "..", "..", "..", "..")
const DATA_BASE = join(WORKSPACE_DIR, "data", "poe2scout")

// ---------- types ----------

interface CategoriesResponse {
  CurrencyCategories: { ApiId: string; Label: string }[]
  UniqueCategories: { ApiId: string; Label: string }[]
}

interface ScoutListItem {
  ItemId: number
  ApiId?: string
  Text: string
  CategoryApiId: string
  IconUrl: string
  ItemMetadata?: unknown
  CurrentPrice: number | null
  CurrentQuantity: number | null
  Name?: string
  Type?: string
  IsChanceable?: boolean
}

interface CategoryListResponse {
  CurrentPage: number
  Pages: number
  Total: number
  Items: ScoutListItem[]
}

interface CatalogItem {
  itemId: number
  apiId: string
  text: string
  categoryApiId: string
  kind: "Currency" | "Unique"
  iconUrl: string
  currentPrice: number
  currentQuantity: number
  metadata?: unknown
  name?: string
  type?: string
}

interface Catalog {
  realm: string
  league: string
  fetched_at: string
  categories: { currency: string[]; unique: string[] }
  total_items: number
  items: Record<string, CatalogItem>
}

// ---------- helpers ----------

function parseArgs(): { realm: string; league: string } {
  const a = process.argv.slice(2)
  const get = (k: string) => {
    const i = a.indexOf(k)
    return i >= 0 ? a[i + 1] : undefined
  }
  const realm = get("--realm")
  const league = get("--league")
  if (!realm || !league) {
    console.error("Usage: bun snapshot.ts --realm <pc|poe2> --league <slug>")
    process.exit(1)
  }
  return { realm, league }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } })
      if (r.status === 429) {
        // Rate-limited — back off harder
        const wait = 2000 * (i + 1)
        await sleep(wait)
        continue
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return (await r.json()) as T
    } catch (e) {
      if (i === retries) throw new Error(`GET ${url} → ${e}`)
      await sleep(500 * (i + 1))
    }
  }
  throw new Error("unreachable")
}

async function fetchCategoryItems(
  realm: string,
  league: string,
  kind: "Currencies" | "Uniques",
  category: string,
): Promise<ScoutListItem[]> {
  const all: ScoutListItem[] = []
  let page = 1
  while (true) {
    const url = `${BASE_URL}/${realm}/Leagues/${league}/${kind}/ByCategory?Category=${encodeURIComponent(category)}&Page=${page}&PerPage=${PER_PAGE}`
    const body = await getJson<CategoryListResponse>(url)
    for (const it of body.Items) {
      if (!it.CategoryApiId) it.CategoryApiId = category
      all.push(it)
    }
    if (page >= body.Pages) break
    page += 1
    await sleep(REQUEST_GAP_MS)
  }
  return all
}

// ---------- main ----------

async function main() {
  const { realm, league } = parseArgs()
  const t0 = Date.now()

  console.log(`Building catalog for realm=${realm} league=${league}...`)
  const cats = await getJson<CategoriesResponse>(
    `${BASE_URL}/${realm}/Leagues/${league}/Items/Categories`,
  )
  console.log(`  currency=${cats.CurrencyCategories.length}  unique=${cats.UniqueCategories.length}`)

  const items: ScoutListItem[] = []
  const kinds: Record<number, "Currency" | "Unique"> = {}

  for (const c of cats.CurrencyCategories) {
    process.stdout.write(`  Currencies/${c.ApiId}... `)
    const chunk = await fetchCategoryItems(realm, league, "Currencies", c.ApiId)
    console.log(`${chunk.length}`)
    for (const it of chunk) kinds[it.ItemId] = "Currency"
    items.push(...chunk)
    await sleep(REQUEST_GAP_MS)
  }
  for (const c of cats.UniqueCategories) {
    process.stdout.write(`  Uniques/${c.ApiId}... `)
    const chunk = await fetchCategoryItems(realm, league, "Uniques", c.ApiId)
    console.log(`${chunk.length}`)
    for (const it of chunk) kinds[it.ItemId] = "Unique"
    items.push(...chunk)
    await sleep(REQUEST_GAP_MS)
  }

  // Dedupe by ItemId
  const seen = new Set<number>()
  const deduped = items.filter((it) => {
    if (seen.has(it.ItemId)) return false
    seen.add(it.ItemId)
    return true
  })

  const catalogItems: Record<string, CatalogItem> = {}
  for (const it of deduped) {
    const kind = kinds[it.ItemId] ?? "Currency"
    catalogItems[String(it.ItemId)] = {
      itemId: it.ItemId,
      apiId: it.ApiId ?? String(it.ItemId),
      text: it.Text,
      categoryApiId: it.CategoryApiId,
      kind,
      iconUrl: it.IconUrl,
      currentPrice: it.CurrentPrice ?? 0,
      currentQuantity: it.CurrentQuantity ?? 0,
      metadata: it.ItemMetadata ?? undefined,
      name: it.Name,
      type: it.Type,
    }
  }

  const catalog: Catalog = {
    realm,
    league,
    fetched_at: new Date().toISOString(),
    categories: {
      currency: cats.CurrencyCategories.map((c) => c.ApiId),
      unique: cats.UniqueCategories.map((c) => c.ApiId),
    },
    total_items: deduped.length,
    items: catalogItems,
  }

  const leagueDir = join(DATA_BASE, league)
  await mkdir(leagueDir, { recursive: true })
  await writeFile(join(leagueDir, "catalog.json"), JSON.stringify(catalog, null, 2))

  // Cleanup legacy v1/v2 artifacts that no longer fit v3
  for (const f of ["latest.json", "trends.json"]) {
    const p = join(leagueDir, f)
    if (existsSync(p)) await unlink(p)
  }
  const legacySnapshots = join(leagueDir, "snapshots")
  if (existsSync(legacySnapshots)) await rm(legacySnapshots, { recursive: true, force: true })

  // Note: items/ dir is preserved — it holds lazy-cached history files.
  // Stale entries (item removed from API) are pruned on next `api.sh trends` run.

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\nCatalog written in ${elapsed}s — ${deduped.length} items`)
  console.log(`  ${join(leagueDir, "catalog.json")}`)
  console.log(``)
  console.log(`Next:`)
  console.log(`  api.sh item <name>       → lookup single item (live DailyStatsHistory + cache)`)
  console.log(`  api.sh trends [window]   → opt-in: pull all histories + compute trends (slow ~15 min)`)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
