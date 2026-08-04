# T-008: Pull POE2 char đầy đủ từ poe.ninja profile API vào skill /pob
> Extend pob skill để fetch full character (PoB export + stats) của char đang chơi qua poe.ninja profile API — không cần OAuth, zero ban risk.
- **priority**: high
- **effort**: S

## Problem
`/pob` chỉ pull được char qua **builds-ladder** API (`poe.ninja/poe2/api/builds/<version>/character?...`) trong `fetch-poeninja.sh:73` — chỉ chứa char đã lên ladder (high-level, opted-in). Char đang chơi của user (ThaoCamVienSaiGon, Lv37 Huntress leveling) **không có trên ladder** → không pull được.

Đã verify live (2026-06-01): GGG web profile là POE1-only (tab "PoE 1 PC/Xbox/Sony", `get-characters?realm=poe2` bỏ qua realm → trả POE1); GGG OAuth `/character/poe2/<name>` cần đăng ký app + token (account từng bị flag → rủi ro). poe.ninja **profile API** trả full data, zero ban risk (poe.ninja tự làm OAuth với GGG). Xem [[reference_poe2_char_stash_api]].

Endpoint chain đã verify (char connected + snapshot hôm nay 04:39Z, model JSON 175KB có `pathOfBuildingExport` 8900 ký tự + `defensiveStats` 49 fields + items/skills/keystones/flasks/jewels/passiveSelection):
1. `GET poe.ninja/poe2/api/events/character/<account>/<leagueUrl>/<charname>` → SSE → `data: {"version":<modelId>}` (modelId đổi mỗi snapshot — KHÔNG hardcode)
2. `GET poe.ninja/poe2/api/profile/characters/<account>/<leagueUrl>/<charname>/model/<modelId>` → `{type, charModel:{pathOfBuildingExport, defensiveStats, items, skills, keystones, flasks, jewels, passiveSelection, passiveTreeName, ...}}`

## Goal
Gõ `/pob` với poe.ninja **profile** char URL (hoặc account+charname) → ra full PoB export + rich stat JSON của char đang chơi, để phân tích build.

## Requirements
- Extend `fetch-poeninja.sh`: detect URL pattern `poe.ninja/poe2/profile/<account>/<league>/character/<charname>` (profile) vs `/builds/` (ladder hiện có) → branch.
- Profile branch: resolve modelId qua events SSE (curl `-sN`, lấy dòng `data:` đầu, parse `version`), không hardcode; rồi fetch model JSON.
- Lưu full model JSON (cho rich stats poe.ninja đã tính sẵn — dùng cho 0.5 vì PoB2 0.4 chưa model Spirit Walker) + extract `charModel.pathOfBuildingExport`.
- Account name trong URL dùng `-` thay `#` (hopthuxacnhan-3062). Snapshot data, không live → log `updatedUtc` timestamp.
- Handle char không public/not-found trên poe.ninja → error rõ ràng.
- **Non-goal**: OAuth client (note future-only trong SKILL.md). **Stash POE2**: doc-note "in-game only, no API" trong `stash` skill — KHÔNG build pull.
- Update `pob` SKILL.md (+ analyze.sh nếu nhẹ) tài liệu profile-URL path.

## Criteria
- [ ] `fetch-poeninja.sh '<profile-url>'` in ra PoB code của ThaoCamVienSaiGon (len ~8900) + lưu model JSON, exit 0
- [ ] modelId resolve động qua events SSE (không có literal `3504018230` trong script)
- [ ] `pob` SKILL.md có section profile-URL pull + caveat snapshot/0.5
- [ ] `stash` SKILL.md có note POE2 stash = in-game only (no API), không claim pull được
