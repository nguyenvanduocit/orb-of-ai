# T-045: Cheatsheet farm Ritual Belt Hunting (overlay PiP)

> Cheatsheet pop-out qua `<PipPanel>` cho farm Ritual Belt Hunting: thứ tự altar trong map, luật defer/tribute ở màn reward, tablet loadout, Rite of the Nameless — liếc nhanh khi đang chơi.

- **priority**: medium
- **effort**: S

## Problem

Luật chơi ritual nằm dạng prose dài trong `content/farming/0-5-ritual-belt-hunting.md`. Quyết định ở màn reward (defer trước hay quay, chừa bao nhiêu tribute) là quyết định tích tắc — quay nhầm khi belt đang hiện là mất vĩnh viễn, không kịp mở doc đọc lại. Khung cheatsheet overlay đã có (T-042 `PipPanel` + T-043 `ExpeditionCheatsheet`) nhưng chưa có bản cho Ritual.

## Goal

Đang farm ritual, mở một overlay nổi trên game liếc phát ra ngay thứ tự altar / luật defer / tablet cắm gì / Rite chạy sao cho khỏi mất chuỗi.

## Requirements

- Đúng MỘT component `app/components/RitualCheatsheet.vue`, data inline (không file data TS riêng), tự bọc `<PipPanel>` → markdown chỉ cần `::ritual-cheatsheet`. Pattern y hệt `ExpeditionCheatsheet.vue`.
- Tab: Map (thứ tự altar + abyss trên đường + chỗ chết người) · Reward (luật defer/tribute + giá bán nhanh) · Setup (tablet + waystone + atlas node + master) · Rite (Head of the King + luật chuỗi).
- Tag BUILD cho entry giết đúng build Spirit Walker companion đang chơi (evasion thuần + chaos res ~25).
- Style chỉ dùng andy-note-nuxt theme token; good/avoid phân biệt bằng glyph + pattern (theme đơn sắc, không red/green).
- Nhúng `::ritual-cheatsheet` vào `content/farming/0-5-ritual-belt-hunting.md` sau intro — không page route mới.
- Mọi số/cơ chế lấy từ doc đã verify (giá poe2scout 2026-06-10) — không fetch live, refresh tay khi giá/patch đổi.
- Row Setup (tablet mua) + row giá bán đính trade2 link live từ section "Mua gì và bán ở đâu" của doc (tạo 2026-06-10, hết hạn sang league mới) — mở tab mới, không fabricate link.

## Criteria

- [x] `app/components/RitualCheatsheet.vue` data inline, tự bọc `<PipPanel>`, 4 tab chuyển mục (Map/Reward/Setup/Rite), entry build-killer có tag BUILD, chỉ dùng theme token.
- [x] `::ritual-cheatsheet` nhúng trong farming doc sau intro, không tạo page route mới.
- [x] `bun run generate` pass: 840 routes, 0 errors, 0 warnings, link checker 0/415 failing (baseline run); run cuối với trade link hoàn tất end-to-end — 417 HTML + sitemap ghi mới, HTML tĩnh farming doc chứa che-tabs + 4 BUILD tag + pip markup + đủ 9 trade link unique.
