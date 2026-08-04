# T-024: price-forecast collect.py dùng endpoint poe.ninja đã chết → 404, không thu được data

> collect.py fetch `economy/stash/current/{item,currency}/overview` (slug) → 404; `data/price-history/` rỗng. Repoint sang endpoint exchange thật + parse schema mới.

- **priority**: medium
- **effort**: S

## Problem
`collect.py:193,247` gọi `https://poe.ninja/poe2/api/economy/stash/current/{item,currency}/overview?league=<slug>&type=...` — endpoint này 404 toàn bộ (verified 2026-06-05). Hệ quả: `data/price-history/{daily,master.json}` rỗng, forecast.py + build.ts không có input. Endpoint poe.ninja POE2 thật là `economy/exchange/current/overview?league=Runes of Aldur&type=Currency` (display-name, không phải slug — leagues.py đã đúng), schema mới hoàn toàn: `core.rates.exalted` (ex/div), `lines[]` {id, primaryValue (giá theo divine), volumePrimaryValue (throughput), sparkline.{totalChange,data}}, `items[]` {id,name}. Endpoint này chỉ phục vụ **Currency** — `type=Fragment/UniqueWeapon` trả HTTP 200 nhưng rỗng.

## Goal
collect.py thu lại được currency price history thật mỗi lần chạy, ghi vào `data/price-history/master.json` đúng schema downstream đang consume.

## Requirements
- Repoint currency fetch sang `exchange/current/overview` + parse schema mới (price_exalted = primaryValue × core.rates.exalted; volume = volumePrimaryValue; history từ sparkline.data qua `derive_history_from_sparkline` sẵn có — cùng dạng cumulative-% như cũ).
- Giữ nguyên merge/dedupe/atomic-write + master.json key (league,item,variant,type,date) để forecast.py + build.ts không gãy.
- ITEM_TYPES (uniques/waystone/…) endpoint exchange KHÔNG phục vụ → để TODO trỏ poe2scout (đừng drop âm thầm). Non-goal: migrate sang poe2scout (việc riêng, cần user quyết — xem note).

## Criteria
- [ ] `python3 .claude/skills/price-forecast/scripts/collect.py --leagues "Runes of Aldur"` chạy không lỗi
- [ ] `data/price-history/master.json` chứa ≥30 currency records thật (Divine/Exalted/Annulment… với price_chaos > 0)
- [ ] `data/price-history/daily/<today>.json` được ghi
- [ ] `python3 -m py_compile collect.py` pass
- [ ] TODO poe2scout cho item/unique types ghi rõ trong file
