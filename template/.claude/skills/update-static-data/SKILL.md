---
skill_name: update-static-data
description: >-
  Datamine the full POE2 trade reference catalog from the API into data/trade-static/
  via playwriter page-context fetch trong tab www.pathofexile.com đã login. Run when
  stat-id lookup, item search, or currency exchange data is missing or stale. Owned by
  this skill — do not pull trade-static manually.
version: 2.0.0
tags: [poe2, trade, static, datamine, stat-id, catalog, update]
---

# update-static-data — POE2 Trade Reference Catalog

Pull toàn bộ dữ liệu tham chiếu từ POE2 trade API vào `data/trade-static/` qua **playwriter page-context fetch trong tab www.pathofexile.com đã login**. Chạy một lần để bootstrap, chạy lại khi patch mới hoặc stat-id lookup bị thiếu.

**Prerequisite:** Chrome mở + đã login `www.pathofexile.com` + Playwriter extension bật — không có headless path. Không cần mở sẵn tab trade: transport tự mở `/trade2/` nếu chưa có tab nào.

## Lệnh chạy

```bash
bun .claude/skills/update-static-data/scripts/update-static-data.ts
```

Không có flag — mỗi lần chạy là full datamine toàn bộ catalog. Transport tự enforce ≥2s spacing giữa các call nên không rủi ro rate-limit account.

## Output — `data/trade-static/`

| File | Nguồn | Nội dung |
|---|---|---|
| `leagues.json` | `/api/trade2/data/leagues` | Trade league ids hiện tại |
| `static.json` | `/api/trade2/data/static` | Currencies, fragments, splinters — `id` + icon |
| `items.json` | `/api/trade2/data/items` | Mọi base type + unique name (10 category); `entries[].flags.unique` marks uniques |
| `stats.json` | `/api/trade2/data/stats` | Mọi mod stat-id (7109+), grouped by type (explicit/implicit/enchant/crafted/pseudo/skill…) |
| `filters.json` | `/api/trade2/data/filters` | Search-form schema: 7 filter groups (status/type/equipment/req/map/misc/trade) và fields |
| `currencies.json` | Derived từ `static.json` | Flat `{id: text}` map — dùng cho exchange want/have và đọc listing price |
| `meta.json` | — | Provenance: timestamp, league, per-file counts |

`data/trade-static/` gitignored — refreshable bất cứ lúc nào.

## Consumed by

`poe-trade/ggg/filters.ts` đọc `data/trade-static/stats.json` để fuzzy search stat-id khi build query. Không có file này → `filters.ts` không chạy được.

## Khi nào cần chạy lại

Chạy lại sau mỗi major patch (stat mới, base type mới, league đổi). POE2 patch nhanh hơn POE1 — nên re-run đầu mỗi league. `meta.json` ghi timestamp lần pull cuối.

## Xem thêm

- Mô tả từng file chi tiết hơn → `data/trade-static/README.md`
- Trade search client dùng catalog này → `poe-trade/ggg/client.ts`, `poe-trade/ggg/filters.ts`
- Playwriter setup → skill `/playwriter`
