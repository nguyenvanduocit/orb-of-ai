# T-013: /pob live equipment fetch từ pathofexile2.com internal-api (playwriter)
> Thêm đường pull LIVE equipment của char POE2 vào /pob qua playwriter intercept internal-api (DPoP), không replay token.

- **priority**: high
- **effort**: M

## Problem
poe.ninja là snapshot (re-crawl theo lịch riêng, có thể trễ 6h+). Char POE2 không có đường OAuth-free nào lấy LIVE equipment. Vừa phát hiện endpoint website POE2 mới: `pathofexile2.com/internal-api/my-account/character/<id>?realm=poe2` (auth bằng DPoP session token của browser) trả LIVE equipment đầy đủ raw mods — giàu hơn defensiveStats computed của poe.ninja. Lấy an toàn bằng cách để tab đã login tự bắn request (xem character page của mình), playwriter intercept response — KHÔNG cầm/replay token (token short-lived ~1.5 ngày + DPoP-bound + replay thủ công = "direct GGG API call" mà rule cấm, account từng bị flag).

## Goal
`/pob` pull được equipment LIVE của char POE2 bất kỳ thuộc account, qua playwriter, lưu `data/character-exports/live-<name>.json` — không OAuth, không replay token.

## Requirements
- Transport = playwriter intercept (navigate page đã login → đọc response). KHÔNG curl/fetch thẳng GGG, KHÔNG paste/replay token.
- Resolve name→id qua `internal-api/my-account/characters` (list) — id là opaque (vd `72d64c2c`). DOM fallback nếu list không bắn JSON.
- Output JSON raw GGG shape về `data/character-exports/live-<name>.json` (absolute path qua sandbox fs).
- Script sống trong skill dir; temp run-file ở `tmp/`; exit non-zero khi fail.
- SKILL.md: usage + caveat scope (CHỈ equipment — passives/skills/quest-stats vẫn lấy từ poe.ninja, internal-api không expose) + token-safety note + "tạm playwriter, sau reimplement trong extension".

## Criteria
- [x] `fetch-live.sh ThaoCamVienSaiGon` → ghi `live-ThaoCamVienSaiGon.json`, parse được, items>0, class/level/league khớp char thật (verified 2× repeatable, items=16, full mods)
- [x] name→id resolve tự động (không hardcode id) — từ localStorage `common.characters-pcache` roster
- [x] Fail rõ ràng + exit≠0 khi: chưa login / extension chưa enable / char không tồn tại (not-found → EXIT=1 verified; login/extension paths có error message + hint)
- [x] SKILL.md updated (usage + caveat scope + token-safety) — v2.5.0
