---
skill_name: poe-trade
description: >-
  playwriter page-context transport Path of Exile 2 trade-API client library
  (search/fetch/stash/stat-filters — no POESESSID). Use when running trade searches,
  fetching listings, or looking up stat-ids for POE2. Underlying library used by /trade skill.
version: 2.0.0
tags: [poe2, trade, search, stash, stat-id]
---

# poe-trade — POE2 Trade API Client (playwriter page-context transport)

Thư viện TypeScript gọi Path of Exile 2 trade API qua **page-context fetch trong tab www.pathofexile.com đã login (playwriter)**. Không cần POESESSID, không cần cf_clearance — transport dùng session của Chrome tab đang mở.

## Thư viện — `ggg/`

| File | Vai trò |
|---|---|
| `transport.ts` | `poeFetch()` — page-context fetch trong tab đã login, trả `{status, ratelimit, data}` |
| `client.ts` | `PoeTradeClient` — high-level methods: `search()`, `fetch()`, `exchange()`, `data()` qua poeFetch; không nhận POESESSID |
| `stash.ts` | Đọc stash tab qua poeFetch |
| `trade-search.ts` | CLI wrapper cho `client.ts` — chạy search và in kết quả |
| `buy-maps.ts` | CLI tìm waystones/maps theo tier/name |
| `filters.ts` | Fuzzy search stat-id từ `data/trade-static/stats.json`; dùng để build query `stats[].filters[].id` |
| `poe-stash.ts` | CLI stash viewer |
| `poe-graph.ts` | Phân tích subgraph passive-tree (classify allocated node leaf/bridge/interior) — test-only, không có CLI/production consumer |
| `poe-utils.ts` | Tiện ích chung (parse listing price, format output) |

## Prerequisite — Chrome đã login + Playwriter bật

Transport chạy trong page-context của Chrome thật — **không có headless path**.

- Chrome phải mở và **đã login** `www.pathofexile.com` (session cookie còn tươi)
- Playwriter extension phải được bật trên một tab bất kỳ trong Chrome đó
- KHÔNG cần mở sẵn tab trade: nếu chưa có tab `www.pathofexile.com`, transport tự `context.newPage()` → goto `/trade2/` rồi reuse cho mọi call sau
- Env optional: `POE_PLAYWRITER_BIN`, `POE_PLAYWRITER_SESSION`, `POE_PLAYWRITER_SPACING` (đều có sane defaults)

Transport tự enforce ≥2s spacing (persisted qua lockfile), đọc `x-rate-limit-*` headers, tự back-off khi gặp 429.

## Chạy CLI

```bash
# Trade search POE2 — Runes of Aldur league
bun .claude/skills/poe-trade/ggg/trade-search.ts --game poe2 --league "Runes of Aldur"

# Tìm waystones tier 15+
bun .claude/skills/poe-trade/ggg/buy-maps.ts --tier 15 --game poe2

# Fuzzy search stat-id (đọc data/trade-static/stats.json)
bun .claude/skills/poe-trade/ggg/filters.ts "maximum life"
```

## Gọi từ code

```typescript
import { PoeTradeClient } from ".claude/skills/poe-trade/ggg/client.ts";

const client = new PoeTradeClient({ game: "poe2" });
const results = await client.search({
  query: {
    filters: { type_filters: { filters: { category: { option: "armour.chest" } } } },
    stats: [{ type: "and", filters: [{ id: "explicit.stat_3299347043", value: { min: 80 } }] }]
  },
  sort: { price: "asc" }
});
```

POE2 dùng endpoint `/api/trade2/search/<league>` và `/api/trade2/fetch/<ids>`. League hiện tại: **Runes of Aldur**.

Một số stat-id POE2 hay dùng (đã tra, đỡ tốn call):
- `explicit.stat_3299347043` = `# to maximum Life`
- `explicit.stat_1671376347` = `#% to Lightning Resistance`
- `explicit.stat_2901986750` = `#% to all Elemental Resistances`
- `explicit.stat_2144192055` = `# to Evasion Rating`

## Stat-id lookup

`filters.ts` đọc `data/trade-static/stats.json` (pull bởi skill `update-static-data`). Nếu file chưa có hoặc stale, chạy `update-static-data` trước:

```bash
bun .claude/skills/update-static-data/scripts/update-static-data.ts
```

## Xem thêm

- Đầy đủ usage, gotchas, ví dụ query phức tạp → skill `/trade`
- Catalog stat-id, items, currencies → `data/trade-static/` (xem `README.md` cạnh đó)
