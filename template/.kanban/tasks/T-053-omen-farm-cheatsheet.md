# T-053: Cheatsheet farm Rite of the Nameless Omen (overlay PiP)
> Component cheatsheet themed + content farming doc cho strat omen-volume farm (Head of the King city-map chain + deferred-omen item-filter tech)

- **priority**: medium
- **effort**: M

## Problem
Strat "Rite of the Nameless omen farm" (nguồn XTheFarmerX 2026-06-23) là một góc khác của Ritual so với belt-hunting đã có: juice **pack size → tribute → max reroll volume** để farm omen làm nền, belt là jackpot; cộng **deferred-omen via item filter** (`production_config: apply item filter to ritual = true`). Chưa có doc/cheatsheet nào trong vault cho góc này. User muốn nó thành "một trang trong nuxt" dạng cheat sheet (content doc + component PiP), đơn giản ngắn gọn trực tiếp.

## Goal
Có một content/farming page đọc như cheat sheet (ngắn, scannable) + cheatsheet component nổi PiP overlay được trên game, đúng pattern RitualCheatsheet/ExpeditionCheatsheet.

## Requirements
- Component `app/components/OmenFarmCheatsheet.vue` theo pattern `RitualCheatsheet.vue`: tabbed, data inline, wrap `<PipPanel>`, **chỉ dùng theme token** (terminal/coral), monochrome glyph + pattern (no hardcode hex, no red/green).
- Nhúng `::omen-farm-cheatsheet` vào `content/farming/0-5-rite-of-nameless-omen-farm.md`.
- Doc concise: cross-link sang [Ritual guide] + [belt-hunting] cho cơ chế chung, KHÔNG re-explain Head of the King / defer / Freedom of Faith.
- Có `## Failure Modes` + `## Version History` + `## Relationships`. Voice rule + wiki-link cho game term.
- Drop entity không verify được (Palm of the Dreamer = caption garble, không có trong wiki mirror). Giá dùng poe2scout 2026-06-18 (trong belt doc) + throughput strat ghi nguồn/timestamp.

## Criteria
- [x] `OmenFarmCheatsheet.vue` render inline + pop PiP, token-only (grep 0 hardcode hex mới)
- [x] `::omen-farm-cheatsheet` resolve trong content doc (dev-server SSR: che-tabs/pip-frame render)
- [~] `bun run generate` green — KHÔNG chạy được: nuxt dev (PID 94010) giữ build lock. Thay bằng: live SSR render đủ + 5/5 cross-link target tồn tại + content parse 0-err. Chạy lại khi dev server free.
- [x] `content-voice-lint.sh` warning sạch
- [x] Doc có Failure Modes + Version History + Relationships, cross-link belt-hunting + ritual guide
