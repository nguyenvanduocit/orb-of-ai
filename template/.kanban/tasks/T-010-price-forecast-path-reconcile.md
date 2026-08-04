# T-010: price-forecast ghi data vào `.claude/skills/data/` + lệch path với nuxt build
> Reconcile path resolution của price-forecast collect.py + forecast.py về canonical `data/price-history/`
- **priority**: medium
- **effort**: S

## Problem
Twin bug cùng class với [T-009], nhưng ở skill `price-forecast` và lan 3 file:
- `collect.py`: `DATA_DIR = dirname(__file__)/../../data/price-history/poe2` → resolve `.claude/skills/data/price-history/poe2` (climb `../..` chỉ tới `.claude/skills`) + segment `poe2/` vestigial.
- `forecast.py`: `DATA_FILE = dirname(__file__)/../../data/price-history/poe2/master.json` → cùng climb sai + cùng `poe2/`.
- `nuxt/scripts/build-prices/build.ts`: đọc `data/price-history/master.json` qua REPO_ROOT — **không** `poe2/`, đúng project root.

collect.py + forecast.py đồng ý với nhau (cùng sai) nên skill vẫn chạy được, nhưng (a) đặt data vào `.claude/skills/data/` — vi phạm "skill folder không giữ data/ con", (b) build.ts nuxt đọc `data/price-history/master.json` → site không thấy data forecast tạo ra. Canonical CLAUDE.md: `data/price-history/{daily/,master.json}` (không poe2 subpath).

## Goal
collect.py ghi và forecast.py đọc cùng `data/price-history/master.json` mà build.ts đã expect → một nguồn sự thật, đặt đúng `data/`, site thấy data.

## Requirements
- Climb tới project root đúng (dùng `Path(__file__).resolve().parents[4]` hoặc tương đương cho cả 2 file).
- Bỏ segment `poe2/` (workspace đã game-specific; không có POE1 master.json để đụng).
- Đồng bộ docstring + comment "lives in price-history/poe2/" → `price-history/`.
- Chưa có data tracked ở `data/price-history/` (verify: empty) → không cần migrate; nếu có blob lạc ở `.claude/skills/data/price-history/` lúc fix thì move về canonical.

## Criteria
- [x] collect.py DATA_DIR resolve == `<root>/data/price-history`
- [x] forecast.py DATA_FILE resolve == `<root>/data/price-history/master.json` (== build.ts SOURCE)
- [x] Bỏ `poe2/` segment + update comment ở cả 2 file
- [x] `python3 -m py_compile` pass cả 2
- [x] `.claude/skills/data/` không tái sinh sau khi chạy collect.py (smoke: resolve-only hoặc dry run)
