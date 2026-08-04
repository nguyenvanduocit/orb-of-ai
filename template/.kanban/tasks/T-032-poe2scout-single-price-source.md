# T-032: poe2scout thành nguồn giá/economy DUY NHẤT

> Migrate toàn bộ lớp price/economy data sang poe2scout public API; cắt poe.ninja khỏi mọi đường giá (giữ cho build/meta), bỏ poe.watch.

- **priority**: high
- **effort**: L

## Problem

Lớp giá hiện phân mảnh 3 nguồn, mỗi nguồn một điểm gãy:
- **poe.ninja exchange** (`price-forecast/collect.py` sau T-024) — chỉ phục vụ `type=Currency`, uniques/fragments trả `lines` rỗng; history chỉ 7d sparkline; giá denominated theo divine cần convert `primaryValue × ex_rate`.
- **poe.watch** (`economy-scan` watchLane) — Cloudflare-gated, browser-only, redundant, hay fail.
- **poe2scout** (`poe2scout` skill) — đã có catalog + per-item OHLC nhưng chưa được dùng làm nguồn chính; collect.py vẫn để TODO chưa migrate.

poe2scout là registered partner GGG (OAuth scope `service:cxapi`) nên re-publish data Currency Exchange (volume trade THẬT, volume-weighted) + trade2 unique floor-ask ra API công khai `api.poe2scout.com` — no-auth, MIT. Mình không thể tự làm partner nhưng consume được toàn bộ downstream.

**Foundation verified (2026-06-09):** league hiện tại `Runes of Aldur` slug=`runes` `IsCurrent:true`, data tươi tới hôm nay (Mirror DailyStats last=2026-06-09, 10 ngày từ start 2026-05-29). `BaseCurrencyApiId=exalted` → `price_chaos` map thẳng từ `Average`/`Close`, bỏ được conversion. Bulk `/Items/PriceHistory` = 1 call/1.9s/1079 items; per-item `DailyStatsHistory` cho OHLC+Volume sạch. Config `SCOUT_LEAGUE='runes'` + `leagues.py` đã khớp.

## Goal

Mọi con số GIÁ/VOLUME trong workspace đến từ một nguồn nhất quán (poe2scout), không còn endpoint chết / Cloudflare-gated / 7d-sparkline; pipeline forecast + economy-scan + farming chạy lại bằng data thật, full-league history.

## Requirements

- poe2scout = single price source. poe.ninja **chỉ** còn vai trò build/meta (poe-ninja skill, pob import, build-creator). poe.watch bỏ hẳn.
- Giữ nguyên contract `master.json` của price-forecast (`price_chaos`=Exalted, `listings`=volume, dedupe key `(league,item,variant,type,date)`) để `forecast.py`/`build.ts` không gãy.
- Chronos ML giữ nguyên (user chọn) — chỉ đổi nguồn input.
- collect.py fetch TRỰC TIẾP poe2scout (không đọc lazy cache `items/*.json` — incomplete by design); chỉ fetch history cho item ≥ MIN_EXALTED để giảm số call.
- Data-access layer (`api.sh`) implement + verify FRESH current-league data TRƯỚC khi build downstream.
- Cache structure: `data/poe-ninja/`=builds only · `data/poe2scout/`=canonical price · `data/price-history/`=Chronos master (poe2scout-derived). Không tạo dir poe.watch.

## Non-goals / tradeoffs đã chấp nhận

- **economy-scan mất cross-source price validation** — chỉ còn 1 nguồn giá, không fallback nếu poe2scout lag/đổi API. User đã được offer "giữ poe.ninja-price làm fallback" và chọn cắt. Single-source chỉ sound vì foundation-check pass (league tươi).
- Không tự scrape GGG cxapi / không apply partner (bất khả thi).
- Không migrate build/meta analytics (poe2scout không có).

## Build order (advisor-gated)

1. **Data layer** — `api.sh` thêm `pairs` (SnapshotPairs) + `ticks` (raw Items/{id}/History); verify trả fresh `runes` data.
2. **collect.py** rewrite — nguồn poe2scout DailyStatsHistory (currency + uniques + 24 cat, full-league), giữ contract.
3. **economy-scan.js** — bỏ watchLane + ninja price role; poe2scout = sole price; update VOL_SEMANTICS/source-list/report.
4. **Reference repoints** — farming-strategy (+README), write-farming, write-mechanic, poe-ninja SKILL.md note.
5. **Memory** — update `reference_poe2_economy_endpoints.md`.

## Criteria

- [x] `api.sh pairs runes` trả ≥1 cặp với volume_traded thật (Divine⇄Exalted vol 9.5M, rel ~103); `api.sh ticks 295 runes 8` trả tick timestamp 2026-06-09; help + dispatcher cập nhật.
- [x] `collect.py` rewrite: `--leagues "Runes of Aldur"` → master.json 4156 rec cả currency LẪN unique (Weapons/Armour/...), `price_chaos` Exalted (Mirror ~11k, Hinekora ~24k), date tới hôm nay, history days 0→11 (>7); py_compile pass; forecast.py đọc + Chronos 5 BUY OK.
- [x] collect.py không còn import/gọi `poe.ninja`; SKILL.md mô tả nguồn = poe2scout.
- [x] `economy-scan.js`: không còn `watchLane`/poe.watch/`WATCH_LEAGUE`/`NINJA_LG_ENC`; poe.ninja chỉ còn demandLane (builds); VOL_SEMANTICS + method section single-source; parse clean (vm async-wrap).
- [x] farming-strategy/SKILL.md + scripts/README.md + write-farming + write-mechanic: ref giá trỏ poe2scout; poe.ninja còn lại = build-adoption only (hợp lệ).
- [x] poe-ninja/SKILL.md ghi rõ: builds/meta only, không phải price source.
- [x] Memory `reference_poe2_economy_endpoints.md` + MEMORY.md cập nhật endpoint map + single-source decision.
