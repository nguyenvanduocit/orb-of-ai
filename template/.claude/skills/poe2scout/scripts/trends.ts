#!/usr/bin/env bun
/**
 * poe2scout.com opt-in trends compute — pull DailyStatsHistory cho TẤT CẢ items
 * trong catalog, cache vào items/<id>.json, compute multi-window trends.
 *
 * SLOW (~15 min cho ~1000 items với 250ms pacing) — chỉ chạy khi user explicit
 * yêu cầu cross-item trend analysis. Default workflow (`api.sh item`) là lazy
 * fetch + cache 24h, không cần bulk pull.
 *
 * Output:
 *   data/poe2scout/<league>/items/<itemId>.json   — cached history (TTL-respected)
 *   data/poe2scout/<league>/trends.json           — top gainers/losers per window
 *
 * Usage:
 *   bun trends.ts --realm pc   --league mirage --data <dataRoot>
 *   bun trends.ts --realm poe2 --league vaal   --data <dataRoot>
 */

import { mkdir, readFile, writeFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BASE_URL = "https://api.poe2scout.com"
const REQUEST_GAP_MS = 250 // Conservative — full bulk hits rate limit at 100ms when 2 procs parallel
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
// data root resolves from arg if passed, else fallback walk-up
const ARG_DATA_DIR = (() => {
  const a = process.argv.slice(2)
  const i = a.indexOf("--data")
  return i >= 0 ? a[i + 1] : undefined
})()
const DATA_BASE = ARG_DATA_DIR ?? join(SCRIPT_DIR, "..", "..", "..", "..", "data", "poe2scout")

// ---------- types ----------

interface DailyStat {
  Time: string
  Open: number
  High: number
  Low: number
  Close: number
  Average: number
  Volume: number
}

interface DailyStatsHistoryResponse {
  DailyStats: DailyStat[]
  HasMore: boolean
  BaseCurrencyApiId: string
  BaseCurrencyText: string
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
  name?: string
  type?: string
}

interface Catalog {
  realm: string
  league: string
  fetched_at: string
  total_items: number
  items: Record<string, CatalogItem>
}

interface WrappedItem {
  itemId: number
  apiId: string
  text: string
  categoryApiId: string
  kind: "Currency" | "Unique"
  currentPrice: number
  currentQuantity: number
  baseCurrencyApiId: string
  baseCurrencyText: string
  fetched_at: string
  dailyStats: DailyStat[]
}

interface TrendEntry {
  itemId: number
  apiId: string
  text: string
  category: string
  kind: "Currency" | "Unique"
  currentPrice: number
  oldestPrice: number
  deltaPct: number
  windowDays: number
  avgVolume: number
}

interface Trends {
  league: string
  computed_at: string
  base_currency: { apiId: string; text: string } | null
  by_window: {
    "7d": { top_gainers: TrendEntry[]; top_losers: TrendEntry[] }
    "30d": { top_gainers: TrendEntry[]; top_losers: TrendEntry[] }
    league: { top_gainers: TrendEntry[]; top_losers: TrendEntry[] }
  }
  liquidity: { top_liquid: TrendEntry[]; low_liquid: TrendEntry[] }
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
    console.error("Usage: bun trends.ts --realm <pc|poe2> --league <slug> [--data <root>]")
    process.exit(1)
  }
  return { realm, league }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson<T>(url: string, retries = 4): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } })
      if (r.status === 429) {
        // Exponential back-off: 2s, 4s, 8s, 16s
        const wait = 2000 * Math.pow(2, i)
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

async function fetchOrCached(
  realm: string,
  league: string,
  itemsDir: string,
  cat: CatalogItem,
): Promise<WrappedItem | null> {
  const cachePath = join(itemsDir, `${cat.itemId}.json`)

  if (existsSync(cachePath)) {
    try {
      const st = await stat(cachePath)
      if (Date.now() - st.mtimeMs < CACHE_TTL_MS) {
        const cached = JSON.parse(await readFile(cachePath, "utf-8")) as WrappedItem
        // Refresh dynamic fields from catalog
        cached.currentPrice = cat.currentPrice
        cached.currentQuantity = cat.currentQuantity
        return cached
      }
    } catch {
      // cache corrupt, refetch
    }
  }

  try {
    const url = `${BASE_URL}/${realm}/Leagues/${league}/Items/${cat.itemId}/DailyStatsHistory?DayCount=365`
    const body = await getJson<DailyStatsHistoryResponse>(url)
    const wrapped: WrappedItem = {
      itemId: cat.itemId,
      apiId: cat.apiId,
      text: cat.text,
      categoryApiId: cat.categoryApiId,
      kind: cat.kind,
      currentPrice: cat.currentPrice,
      currentQuantity: cat.currentQuantity,
      baseCurrencyApiId: body.BaseCurrencyApiId,
      baseCurrencyText: body.BaseCurrencyText,
      fetched_at: new Date().toISOString(),
      dailyStats: body.DailyStats ?? [],
    }
    await writeFile(cachePath, JSON.stringify(wrapped, null, 2))
    return wrapped
  } catch (e) {
    return null
  }
}

// ---------- trend computation ----------

function computeWindow(
  items: WrappedItem[],
  windowDays: number | "league",
): { gainers: TrendEntry[]; losers: TrendEntry[] } {
  const entries: TrendEntry[] = []
  for (const it of items) {
    const stats = it.dailyStats
    if (stats.length < 2) continue

    let oldIdx: number
    if (windowDays === "league") {
      oldIdx = 0
    } else {
      const recentTime = new Date(stats[stats.length - 1].Time + "T00:00:00Z").getTime()
      const targetTime = recentTime - windowDays * 86400_000
      const oldestTime = new Date(stats[0].Time + "T00:00:00Z").getTime()
      if (oldestTime > targetTime) continue
      oldIdx = 0
      for (let i = stats.length - 1; i >= 0; i--) {
        const t = new Date(stats[i].Time + "T00:00:00Z").getTime()
        if (t <= targetTime) {
          oldIdx = i
          break
        }
      }
    }

    const newRow = stats[stats.length - 1]
    const oldRow = stats[oldIdx]
    const cur = newRow.Average ?? newRow.Close
    const old = oldRow.Average ?? oldRow.Close
    if (!cur || !old || cur <= 0 || old <= 0) continue

    const deltaPct = ((cur - old) / old) * 100
    const recent = stats.slice(-Math.min(stats.length, 7))
    const avgVolume = recent.reduce((s, d) => s + (d.Volume ?? 0), 0) / recent.length
    const days =
      windowDays === "league"
        ? Math.round(
            (new Date(newRow.Time).getTime() - new Date(stats[0].Time).getTime()) / 86400_000,
          )
        : windowDays

    entries.push({
      itemId: it.itemId,
      apiId: it.apiId,
      text: it.text,
      category: it.categoryApiId,
      kind: it.kind,
      currentPrice: cur,
      oldestPrice: old,
      deltaPct,
      windowDays: days,
      avgVolume,
    })
  }

  const cleaned = entries.filter(
    (e) =>
      e.avgVolume >= 5 &&
      e.oldestPrice >= 1 &&
      e.currentPrice >= 1 &&
      Math.abs(e.deltaPct) < 10000,
  )

  const ranked = [...cleaned].sort((a, b) => b.deltaPct - a.deltaPct)
  return { gainers: ranked.slice(0, 20), losers: ranked.slice(-20).reverse() }
}

function computeLiquidity(items: WrappedItem[]): {
  top_liquid: TrendEntry[]
  low_liquid: TrendEntry[]
} {
  const entries: TrendEntry[] = []
  for (const it of items) {
    if (it.dailyStats.length < 1) continue
    const recent = it.dailyStats.slice(-Math.min(it.dailyStats.length, 7))
    const avgVolume = recent.reduce((s, d) => s + (d.Volume ?? 0), 0) / recent.length
    if (!it.currentPrice || it.currentPrice <= 0) continue
    entries.push({
      itemId: it.itemId,
      apiId: it.apiId,
      text: it.text,
      category: it.categoryApiId,
      kind: it.kind,
      currentPrice: it.currentPrice,
      oldestPrice: it.currentPrice,
      deltaPct: 0,
      windowDays: recent.length,
      avgVolume,
    })
  }
  return {
    top_liquid: [...entries].sort((a, b) => b.avgVolume - a.avgVolume).slice(0, 20),
    low_liquid: [...entries].sort((a, b) => a.avgVolume - b.avgVolume).slice(0, 20),
  }
}

// ---------- main ----------

async function main() {
  const { realm, league } = parseArgs()
  const t0 = Date.now()

  const leagueDir = join(DATA_BASE, league)
  const catalogPath = join(leagueDir, "catalog.json")
  if (!existsSync(catalogPath)) {
    console.error(`No catalog at ${catalogPath} — run \`api.sh snapshot\` first.`)
    process.exit(1)
  }

  const catalog = JSON.parse(await readFile(catalogPath, "utf-8")) as Catalog
  const itemsDir = join(leagueDir, "items")
  await mkdir(itemsDir, { recursive: true })

  const cats = Object.values(catalog.items)
  console.log(
    `Fetching DailyStatsHistory for ${cats.length} items (cache TTL 24h, ${REQUEST_GAP_MS}ms pacing)...`,
  )
  console.log(
    `  estimated worst-case ~${Math.round((cats.length * REQUEST_GAP_MS) / 1000 / 60)} min if 0% cache hit`,
  )

  const fetched: WrappedItem[] = []
  let baseCurrency: { apiId: string; text: string } | null = null
  let cacheHits = 0
  let liveFetches = 0
  let errors = 0

  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]
    if ((i + 1) % 25 === 0 || i + 1 === cats.length) {
      process.stdout.write(
        `  ${i + 1}/${cats.length}  cache=${cacheHits}  live=${liveFetches}  err=${errors}\r`,
      )
    }
    const before = liveFetches
    const cachePath = join(itemsDir, `${cat.itemId}.json`)
    const isCacheFresh =
      existsSync(cachePath) && Date.now() - (await stat(cachePath)).mtimeMs < CACHE_TTL_MS
    const w = await fetchOrCached(realm, league, itemsDir, cat)
    if (!w) {
      errors += 1
      continue
    }
    if (isCacheFresh) cacheHits += 1
    else liveFetches += 1
    if (!baseCurrency) {
      baseCurrency = { apiId: w.baseCurrencyApiId, text: w.baseCurrencyText }
    }
    fetched.push(w)
    if (liveFetches > before) await sleep(REQUEST_GAP_MS)
  }
  console.log(`\n  done — ${fetched.length}/${cats.length} (${errors} errors)`)

  console.log("\nComputing trends...")
  const trends: Trends = {
    league,
    computed_at: new Date().toISOString(),
    base_currency: baseCurrency,
    by_window: {
      "7d": (() => {
        const r = computeWindow(fetched, 7)
        return { top_gainers: r.gainers, top_losers: r.losers }
      })(),
      "30d": (() => {
        const r = computeWindow(fetched, 30)
        return { top_gainers: r.gainers, top_losers: r.losers }
      })(),
      league: (() => {
        const r = computeWindow(fetched, "league")
        return { top_gainers: r.gainers, top_losers: r.losers }
      })(),
    },
    liquidity: computeLiquidity(fetched),
  }
  const trendsPath = join(leagueDir, "trends.json")
  await writeFile(trendsPath, JSON.stringify(trends, null, 2))

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`\nDone in ${elapsed}s`)
  console.log(`  trends:    ${trendsPath}`)
  console.log(`  items/:    ${itemsDir}/ (${fetched.length} files, ${cacheHits} from cache)`)

  for (const w of ["7d", "30d", "league"] as const) {
    const g = trends.by_window[w].top_gainers.slice(0, 5)
    if (g.length === 0) continue
    console.log(`\nTop 5 gainers ${w}:`)
    for (const t of g) {
      console.log(`  +${t.deltaPct.toFixed(1).padStart(7)}%  ${t.text}  (${t.category}, vol ${t.avgVolume.toFixed(0)})`)
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
