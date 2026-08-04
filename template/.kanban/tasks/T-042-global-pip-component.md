# T-042: Global PiP component bọc content bất kỳ ra overlay nổi trên game

> Một component global (`PipPanel`) chạy được Document Picture-in-Picture cho bất kỳ slot content nào (cheatsheet, tracker...) để nổi trên cửa sổ game.

- **priority**: medium
- **effort**: M

## Problem

Logic Document Picture-in-Picture (feature-detect, clone stylesheet vào cửa sổ PiP, di dời DOM node host vào/ra, cleanup) đang nhúng cứng trong `app/composables/useLeveling.ts:375-446` — chỉ dùng được cho leveling overlay. Muốn show thêm bất kỳ thứ gì nổi trên game (cheatsheet boss, danh sách phím, bảng giá...) phải copy lại nguyên khối logic đó vào từng feature. Không có cách tái dùng, và nếu copy thì sinh nhiều bản logic PiP trùng nhau khó sync.

## Goal

Bọc một component bất kỳ trong `<PipPanel>` là pop được nó ra cửa sổ Picture-in-Picture nổi trên game, không cần biết bên trong là gì.

## Requirements

- Component global auto-import (`app/components/PipPanel.vue`), dùng `<PipPanel><AnyComponent/></PipPanel>`.
- Engine PiP tách thành composable dùng chung `app/composables/usePictureInPicture.ts` — single source of truth cho relocate-node + clone-style + lifecycle.
- Slot content giữ reactivity sau khi relocate (di dời chính DOM node Vue đang quản, same-origin, cùng JS realm).
- Feature-detect mounted-gated để `nuxt generate` prerender không vỡ hydration; có fallback UI khi browser không hỗ trợ (chỉ Chromium).
- Style lấy từ andy-note-nuxt theme token, không hardcode hex.
- `useLeveling.ts` delegate sang composable mới, xoá code PiP trùng, giữ nguyên public API → page `leveling.vue` không phải sửa.
- Non-goal: không build sẵn nội dung cheatsheet cụ thể; chỉ là khung tái dùng.

## Criteria

- [x] `app/composables/usePictureInPicture.ts` tồn tại, export `usePictureInPicture()` với surface `{ supported, active, error, host, anchor, open, close, toggle }`.
- [x] `app/components/PipPanel.vue` render slot inline khi chưa PiP, relocate vào cửa sổ PiP khi bật, placeholder khi đang active, hint khi unsupported. Auto-import xác nhận: `.nuxt/components.d.ts` có `PipPanel` + `LazyPipPanel`.
- [x] `useLeveling.ts` không còn `documentPictureInPicture.requestWindow`/`cloneStyles`/`openPip`/`closePip` riêng — delegate sang composable; grep 0 reference mồ côi; public API (`pipSupported/pipActive/pipHost/pipAnchor/togglePip`) giữ nguyên nên `leveling.vue` không sửa.
- [x] `bun run generate` pass: 838 routes prerendered, 0 errors, 0 warnings, link-checker 0/414 fail; không hydration/PiP warning. SFC compile-check PipPanel.vue = OK (component unused nên không vào bundle, validate riêng qua @vue/compiler-sfc).
