---
skill_name: poe2scout
description: Fetch POE2 market data from poe2scout.com — fast catalog + lazy per-item OHLC history cache cho Currency + Unique. Realm=poe2 (POE2 workspace). Use when user asks giá/price/volume/history items.
version: 3.0.0
tags: [economy, poe2scout, api, price, history, volume, ohlc, poe2]
---

# poe2scout — POE2 market data (lazy-cached per-item history)

API: `https://api.poe2scout.com` — public REST, **no auth**, JSON, CORS-enabled. Site track cả POE1 lẫn POE2 (realm `pc` vs `poe2`).

**Đây là nguồn GIÁ duy nhất của workspace.** poe2scout là registered GGG partner (OAuth scope `service:cxapi`) nên re-publish data Currency Exchange (currency = volume-weighted, volume trade thật) + trade2 floor-ask (uniques) ra API công khai — mình consume free, không cần partner. Mọi price/volume/history (chat, content, `/price-forecast`, `/economy-scan`, `/farming-strategy`) đến từ đây. poe.ninja CHỈ còn cho build/meta.

**Realm constants for this workspace:**
- Realm: `poe2`
- Auto-detected default league: current softcore (vd `vaal`). Override env `POE2SCOUT_LEAGUE=<slug>`.
- Coverage: 15 Currency categories + 7 Unique categories.

> **Scope**: poe2scout = interactive lookup tay (catalog + per-item OHLC + raw ticks + exchange pairs). Cho ML 7-day forecast / BUY-SELL-HOLD — dùng [`/price-forecast`](../price-forecast/SKILL.md), nó ăn cùng data poe2scout này (collect.py kéo DailyStatsHistory) rồi chạy Chronos. Cùng nguồn, khác lớp: skill này lookup ngay, price-forecast là pipeline tự động.

## Architecture (v3 — lazy cache)

Skill có 2 layer:

1. **Catalog** (`catalog.json`) — manifest tất cả items + current price/volume. Fast snapshot (~10s, không rate-limit). Build qua `api.sh snapshot`.
2. **Per-item history** (`items/<itemId>.json`) — lazy cache OHLC + Volume history per item. **Chỉ fetch khi user lookup** item đó qua `api.sh item`. Cache TTL 24h.

Trends.json (cross-item ranking) là **opt-in** — chạy `api.sh trends` khi cần (~15 phút full pull). Default workflow không động đến.

**Vì sao thay đổi từ v2**: bulk-pulling all-items history hit HTTP 429 rate limit (parallel pulls trên 2 workspace). v3 lazy cache tôn trọng server + match actual use case (user lookup 1-10 items, không phải tất cả 1000).

## Endpoint reference

Base: `https://api.poe2scout.com`, realm path = `poe2`.

| Endpoint | Used by |
|---|---|
| `GET /poe2/Leagues` | `cmd_leagues`, `resolve_league` |
| `GET /poe2/Leagues/{league}/Items/Categories` | `cmd_categories`, snapshot |
| `GET /poe2/Leagues/{league}/{Currencies\|Uniques}/ByCategory?Category=...&Page=...&PerPage=...` | snapshot, list, item-fallback |
| `GET /poe2/Leagues/{league}/Items/{itemId}/DailyStatsHistory?DayCount=365` | **lazy item history fetch** |
| `GET /poe2/Leagues/{league}/Items/{itemId}/History?LogCount=N` | `cmd_ticks` — raw per-tick (Price/Time/Quantity, N÷4) |
| `GET /poe2/Leagues/{league}/SnapshotPairs` | `cmd_pairs` — Currency Exchange, real traded volume |
| `GET /poe2/Leagues/{league}/ReferenceCurrencies` | `cmd_reference` |

DailyStatsHistory response (raw):
```jsonc
{
  "DailyStats": [
    { "Time": "2025-12-14", "Open": ..., "High": ..., "Low": ..., "Close": ..., "Average": ..., "Volume": ... }
  ],
  "HasMore": false,
  "BaseCurrencyApiId": "exalted",
  "BaseCurrencyText": "Exalted Orb"
}
```

`DayCount=365` đảm bảo `HasMore=false` (exhaust hết data có thể có).

## Quick start

```bash
# Setup once
.claude/skills/poe2scout/scripts/api.sh snapshot          # ~10s catalog

# Daily lookups
.claude/skills/poe2scout/scripts/api.sh leagues
.claude/skills/poe2scout/scripts/api.sh categories
.claude/skills/poe2scout/scripts/api.sh list currency
.claude/skills/poe2scout/scripts/api.sh list weapon vaal 10

# Item lookup — 0.6s cold (live fetch + cache), 0.1s warm (cache hit)
.claude/skills/poe2scout/scripts/api.sh item "mirror"
.claude/skills/poe2scout/scripts/api.sh item "the auspex"

# Force refresh single item (bypass 24h cache)
.claude/skills/poe2scout/scripts/api.sh history "mirror"

# Reference rates
.claude/skills/poe2scout/scripts/api.sh reference

# Currency Exchange pairs — REAL traded volume + ex/div (cxapi-derived)
.claude/skills/poe2scout/scripts/api.sh pairs runes 30

# Raw per-tick price history (ML / fine-grain) — name or numeric ItemId, count÷4
.claude/skills/poe2scout/scripts/api.sh ticks "mirror" runes 40
.claude/skills/poe2scout/scripts/api.sh ticks 295 runes 8

# Opt-in: full multi-item trends (slow ~15 min, hits rate limit risk)
.claude/skills/poe2scout/scripts/api.sh trends
```

## Subcommands

| Cmd | Latency | What |
|---|---|---|
| `snapshot` | ~10s | Build `catalog.json` only — no per-item history |
| `item <name>` | 0.6s cold / 0.1s warm | Catalog lookup → live DailyStatsHistory (cache 24h) |
| `history <name>` | 0.6s | Force refresh single item (TTL=0, write fresh cache) |
| `trends` | ~15 min | OPT-IN: pull all items' history + multi-window ranking → `trends.json` |
| `list <cat> [n]` | 0.5s | Top N items by current price (7d Δ via ByCategory) |
| `pairs [n]` | 0.4s | Currency Exchange pairs — REAL traded volume + ex/div |
| `ticks <name-or-id> [n]` | 0.4s | Raw per-tick price history (Price/Time/Quantity, n÷4) |
| `leagues` | 0.2s | List leagues with current marker |
| `categories` | 0.3s | List currency + unique categories for league |
| `reference` | 0.3s | Chaos/Divine/Exalted rates |

## Data layout

```
data/poe2scout/<league>/
├── catalog.json          # Manifest — overwritten by snapshot, ~3-5 MB
├── trends.json           # OPT-IN multi-window ranking (only if `trends` ran)
└── items/<itemId>.json   # Lazy-cached per-item history. Grows on demand.
                          # Files older than 24h are refetched on next lookup.
```

**`catalog.json`** schema:
```jsonc
{
  "realm": "poe2", "league": "vaal", "fetched_at": "...",
  "categories": {
    "currency": ["currency", "fragments", ...],
    "unique": ["weapon", "armour", ...]
  },
  "total_items": 838,
  "items": {
    "10654": {
      "itemId": 10654, "apiId": "mirror", "text": "Mirror of Kalandra",
      "categoryApiId": "currency", "kind": "Currency",
      "currentPrice": 1519375, "currentQuantity": 2,
      "iconUrl": "...", "metadata": { ... }
    }
  }
}
```

**`items/<itemId>.json`** schema (wrapped — written lazily on first lookup):
```jsonc
{
  "itemId": 10654, "apiId": "mirror", "text": "Mirror of Kalandra",
  "categoryApiId": "currency", "kind": "Currency",
  "currentPrice": 1519375, "currentQuantity": 2,
  "baseCurrencyApiId": "exalted", "baseCurrencyText": "Exalted Orb",
  "fetched_at": "...",
  "dailyStats": [
    { "Time": "2025-12-14", "Open": ..., "High": ..., "Low": ..., "Close": ..., "Average": ..., "Volume": ... }
    // ...full league (up to ~160 entries cho actively-traded items)
  ]
}
```

`currentPrice`/`currentQuantity` được patch từ catalog mỗi lần read (catalog tươi hơn TTL của items/).

## Item lookup output

```
- **Mirror of Kalandra** (`mirror`)
  - Category: currency (Currency)
  - Current: **1519375** Exalted Orb · listed now: 2
  - History: 163 days, 2025-12-14 → 2026-05-25
  - Δ league (163d): 8846.13%
  - Δ 7d:  -15.313%
  - Δ 30d: -19.576%
  - Volume avg (last 7d): 718.5714
  - Recent OHLC (last 10d):
    · 2026-05-25  avg 1529000.36  H 1830204.91  L 1236280.47  vol 892
    ...
```

`⚠️ last data Nd ago (stale)` xuất hiện khi dailyStats[-1].Time > 7d cũ — báo item không trade gần đây.

## Confidence labels

- **HIGH** — `currentPrice` từ catalog < 24h, item không stale.
- **HIGH** — `dailyStats[-1].Average` cho actively-traded items.
- **MEDIUM** — Δ7d/Δ30d patterns OK cho trend, không OK cho quote giá thực.
- **LOW** — items stale > 7 days hoặc `avgVolume < 5`. Báo giá có thể out-of-date.

Quote giá trong content note → kèm `fetched_at` (catalog) + `dailyStats[-1].Time` (last trade day).

## Workflow

### Quick price check
```bash
.claude/skills/poe2scout/scripts/api.sh item "X"
```
→ Full league OHLC + multi-window Δ + freshness signal. Lần đầu 0.6s, lần sau 0.1s.

### Build / gear cost estimate

> **CẢNH BÁO floor trap — `currentPrice` = listing RẺ NHẤT = roll THẤP NHẤT.** Chỉ đúng cho unique **mod cố định**. Sai 8-25× (có khi ×1000) cho unique roll-biến-thiên (The Adorned `#% effect`, Chober `+# minion level`), rare nhiều mod, và magic corrupted. Đọc mod thật của item từ `export-<char>.json` rồi quyết: floor được hay phải search combo. Quy trình định giá theo roll thật + lọc rarity/corrupted nằm ở `/trade` skill `## Định giá item đang đeo`.

1. `api.sh snapshot` (~10s, mỗi ngày 1 lần) — refresh catalog.
2. `api.sh item <gear>` cho mỗi gear piece — instant lookup.
3. Sum `currentPrice` **CHỈ cho phần unique mod-cố-định**. Mọi unique roll-cao / rare / magic corrupted → định giá qua `/trade` (search đúng combo mod ở roll thật), KHÔNG lấy floor. Convert qua `reference` cho cross-currency.

Mỗi item lần đầu lookup = 1 API call → cache. 10-item build = 10 calls = ~6s, lần sau instant.

### Detect economy shift
Workflow A (light): `api.sh history <item>` daily cho key items, watch Δ7d trong output.

Workflow B (heavy, opt-in): `api.sh trends` chạy 1 lần/tuần → `trends.json` có gainers/losers cross-item.

### Programmatic access từ Nuxt site
`catalog.json` (~3-5 MB) là static JSON — fetch directly từ Nuxt server route hoặc build-time pre-render. Items cache có thể fetch on-demand từ same dir.

## Caveats

- **Rate limit**: bulk-pull all 1000+ items đồng thời sẽ HTTP 429. `trends` opt-in có 250ms pacing + exponential backoff cho 429. Lazy lookup workflow không bị problem này.
- **Item stale flag**: low-circulation items có thể last trade > 7d cũ → `⚠️` flag, confidence drops LOW.
- **DailyStats granularity**: daily aggregate (OHLC + Average + Volume). Không có intraday data.
- **Migration từ v2**: v3 snapshot.ts auto-delete legacy `latest.json` + `snapshots/<date>.json` khi chạy.
- **`history` cache layers**: bash `http_get` có 5-min HTTP cache. `history` force refresh items/<id>.json nhưng nếu URL DailyStatsHistory đã cached trong tmp/poe2scout-cache trong 5 phút trước → vẫn dùng cached. Set `POE2SCOUT_NOCACHE=1 api.sh history ...` để bypass cả 2 cache.

## File structure

```
.claude/skills/poe2scout/
├── SKILL.md           # this file
└── scripts/
    ├── api.sh         # bash CLI dispatcher
    ├── snapshot.ts    # bun TS — catalog only (~10s, no rate limit)
    └── trends.ts      # bun TS — opt-in heavy: pull all + compute trends (~15 min)
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `curl ... HTTP 404` | Check league slug bằng `api.sh leagues`. Case-sensitive. |
| `bun: command not found` | `brew install oven-sh/bun/bun` |
| `trends` báo HTTP 429 lặp lại | Server overloaded — wait 1 hour, retry. Hoặc tăng `REQUEST_GAP_MS` trong trends.ts từ 250 → 500. |
| Item lookup ra `⚠️ stale` | Item không trade gần đây. Confidence LOW — verify bằng GGG trade. |
| `api.sh item` ra `apiId: (4007)` | Item là Unique → poe2scout không có ApiId slug, fallback ItemId numeric. |
| Cache stale | `rm -rf data/poe2scout/<league>/items/` hoặc dùng `api.sh history <name>` cho 1 item. |
