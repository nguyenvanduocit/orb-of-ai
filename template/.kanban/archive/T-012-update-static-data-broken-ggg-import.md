# T-012: update-static-data script — broken ggg/client import path

> Script `/update-static-data` crash ngay khi load vì import sai đường dẫn tới ggg client sau refactor bridge transport (T-011 fallout).

- **priority**: medium
- **effort**: XS

## Problem

`.claude/skills/update-static-data/scripts/update-static-data.ts:20` import `'../ggg/client'`, resolve thành `.claude/skills/update-static-data/ggg/client` — đường này **không tồn tại**. Module `ggg/` sống ở `.claude/skills/poe-auth/ggg/`. Chạy script báo `error: Cannot find module '../ggg/client'` và exit 1 trước khi tới network layer.

Root cause: refactor T-011 (trade chuyển sang poe-bridge làm transport duy nhất) sửa nội dung script (comment "via the bridge daemon") nhưng để sót import path cũ. `update-static-data.ts` là cross-skill consumer **duy nhất** của ggg ngoài chính folder `poe-auth/ggg/`, nên dễ bị bỏ quên. Đường đúng: `'../../poe-auth/ggg/client'` (verified resolve tới file thật từ `scripts/`).

Sau khi fix import, verify lộ thêm 2 bug cùng script (cùng goal "regen 2 file" nên fix gộp trong card này):

1. **Maps category POE1 schema** — `updateMapsCache` tìm `cat.id === 'Maps'` + parse tier từ `entry.subtext`. Đây là schema POE1 War-for-the-Atlas. POE2 trade2 static không có `'Maps'`; endgame maps = `'Waystones'` (16 entries), tier nằm trong `text` `"Waystone (Tier N)"` không phải `subtext`. → `poe-static-cache.json` luôn fail. Fix: `'Waystones'` + `parseInt(entry.text?.match(/Tier (\d+)/)?.[1] || '0')`.
2. **Reporting bug (correctness)** — hàm update trả `boolean` (false = skip-or-fail), nên maps FAIL bị đếm là "skipped (fresh)" và in `✓ Done` exit 0 dù deliverable chết. Fix: type `UpdateResult = 'updated' | 'fresh' | 'failed'`, exit non-zero khi có `failed`.

Lưu ý divergence cố ý: `'Waystones'` chỉ đúng cho POE2 — KHÔNG sync ngược poe1 (poe1 dùng `'Maps'`).

Quan sát phụ (ngoài scope, không tự xử): `poe-static-cache.json` hiện không có consumer nào trong repo (chỉ updater ghi nó; buy-maps.ts gọi `createMapSearch` trực tiếp + đọc tier từ item property). Cân nhắc prune sau nếu xác nhận không skill nào sẽ wire vào.

## Goal

Chạy được `/update-static-data` để regen `poe-static-cache.json` + `poe-filters.json` (cả hai hiện ABSENT) qua poe-bridge transport.

## Requirements

- Sửa đúng 1 import path, không đổi logic transport (đã đúng — route qua `bridgeRaw`).
- Không tạo `ggg/` trùng lặp dưới `update-static-data/`; dùng canonical `poe-auth/ggg/`.
- Non-goal: blocker runtime `tab_ready: false` của bridge daemon (cần browser mở tab pathofexile.com đã login) — đó là env setup, không thuộc card này.

## Criteria

- [x] `bun .claude/skills/update-static-data/scripts/update-static-data.ts --all` không còn lỗi `Cannot find module` — import resolve qua `poe-auth/ggg/client`.
- [x] Script chạy tới network/bridge layer (fetch thật chạy qua bridge; `tab_ready: false` KHÔNG chặn data endpoint).
- [x] Hai file `poe-static-cache.json` (16 waystones, tier 1–16, tier=0 count 0) + `poe-filters.json` (7109 stats, 10 items) được ghi với `fetchedAt` mới; `--all` re-run báo cả hai fresh, EXIT=0.
