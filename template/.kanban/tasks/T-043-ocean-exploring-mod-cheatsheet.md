# T-043: Cheatsheet chọn mod khi farm Ocean Exploring (overlay PiP)

> Một cheatsheet pop-out qua `<PipPanel>` để khi đang farm Ocean Exploring/Grand Expedition, liếc là biết remnant nào chain, prefix nào tránh, tablet roll gì, rumour ra biome nào.

- **priority**: medium
- **effort**: M

## Problem

Quyết định "mod nào tốt" khi farm Ocean Exploring là quyết định trong tích tắc lúc hover remnant trước khi nối chain: suffix nào đáng nối, prefix nào giết build, slot mấy thì chạy. Kiến thức đó đang nằm dạng prose dài trong `content/guides/0-5-ocean-exploring.md` + `content/farming/0-5-grand-expedition-farming.md` — không liếc nhanh được khi đang chơi, và không nổi trên cửa sổ game được.

## Goal

Khi đang chơi, mở một overlay nổi trên game liếc phát ra ngay nên chain mod nào / tránh mod nào / tablet roll gì.

## Requirements

- Đúng MỘT component cho cheatsheet, nhúng thẳng vào content markdown — không tạo page route mới, không file data TS riêng (data inline trong component).
- Component `app/components/ExpeditionCheatsheet.vue` tự bọc `<PipPanel>` (T-042) bên trong → markdown chỉ cần `::expedition-cheatsheet`. Tab-based, liếc nhanh: Remnant (triage slot + chain suffix + avoid prefix), Tablet (roll priority), Atlas (tree 8 pt + Masters), Rumour (biome map).
- Đánh dấu riêng entry giết đúng build đang chơi (Spirit Walker companion: phys damage + evasion thuần + chaos res chưa cap) để liếc ra "killer của mình".
- Style chỉ dùng andy-note-nuxt theme token (không hardcode hex); phân biệt good/avoid bằng glyph + pattern (theme đơn sắc, không có red/green token).
- Nhúng `::expedition-cheatsheet` vào guide có sẵn `content/guides/0-5-ocean-exploring.md` (pattern `::carry-tracker`).
- Non-goal: không tự fetch live data; nội dung tĩnh từ doc đã verify, refresh tay khi patch đổi.

## Criteria

- [x] `app/components/ExpeditionCheatsheet.vue` data inline (không file TS riêng), tự bọc `<PipPanel>`, tab chuyển mục, entry build-killer có tag BUILD, chỉ dùng theme token.
- [x] Không tạo page route mới — nhúng `::expedition-cheatsheet` vào `content/guides/0-5-ocean-exploring.md` sau intro.
- [x] `bun run generate` pass: 840 routes, 0 errors, 0 warnings, 0/415 failing pages; không hydration/pip warning. HTML tĩnh guide chứa che-tabs + active tab + headings + 4 BUILD tag + pip-frame (nút Pop-out mounted-gated → SSR render hint "PiP cần Chrome/Edge", hydrate thành nút client-side).
