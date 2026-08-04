# T-002: Leveling tracker — Client.txt auto-advance + Picture-in-Picture overlay
> Interactive POE2 campaign leveling guide tool (giống poeviethoa.net/leveling): checklist từng zone, auto-advance bằng monitor Client.txt qua File System Access API, pop-out overlay bằng Document Picture-in-Picture.

- **priority**: high
- **effort**: L

## Problem
Site chưa có công cụ leveling guide tương tác. Người chơi league-start cần một checklist từng zone (quest / kill / pickup / waypoint / optional) bám sát route campaign, và muốn nó tự nhảy bước theo zone đang đứng trong game thay vì click tay. POE2 client ghi mỗi lần đổi zone vào `…/logs/Client.txt` dạng `: You have entered <Zone>.` (English client) — đọc được file này thì tool auto-advance được. Reference: poeviethoa.net/leveling (SPA client-rendered, giữ zone-name tiếng Anh + hướng dẫn tiếng Việt, có nút Tick + prev/next + overlay PiP nổi trên game).

## Goal
Người chơi mở `/leveling`, chọn file `Client.txt` một lần, pop-out overlay nhỏ luôn-trên-cùng, và overlay tự tick zone + nhảy bước khi họ đi qua campaign — không rời game.

## Requirements
- **Stack**: Nuxt 4 SSG, theo precedent `app/pages/skilltree.vue` — page Vue + composable + typed data file. KHÔNG hardcode hex; dùng theme token `terminal-*` / `primary` / `font-display` / `font-prose`.
- **Data**: `app/composables/data/leveling-poe2-0-5.ts` — typed `Act[] → Zone[]{ clientName exact-verbatim } → Step[]{ type, optional }`. Content scope: **Acts 1-4** (live trong 0.5; Act 5-6 là stub "planned for full release", bỏ qua). Step text tiếng Việt, giữ English game terms. Optional split lấy verbatim từ wiki `(optional)` markers. Mọi zone/boss/quest name verify verbatim từ `data/wiki/`.
- **File System Access API**: `showOpenFilePicker()` lấy handle Client.txt; persist handle vào IndexedDB; reload cần nút **Reconnect** (re-grant permission yêu cầu user gesture, không auto-reattach). Poll `getFile()` theo `lastModified`; đọc incremental theo byte-offset (file dài hàng trăm MB cả league — không re-read toàn bộ); parse `/\] : You have entered (.+)\.\s*$/`.
- **Pointer monotonic-forward**: chỉ advance khi zone vào nằm *phía trước* furthest-reached (không nhảy lùi khi về town / hideout / relog). Lần connect đầu: scan toàn file tìm dòng "entered" cuối → jump tới đó.
- **Document Picture-in-Picture**: `documentPictureInPicture.requestWindow()`; clone stylesheets vào pip document; `append` node overlay sang `pipWindow.document.body`, move lại on `pagehide`. Yêu cầu transient activation (nút bấm).
- **Tick button**: đánh dấu xong toàn bộ step zone hiện tại + advance sang zone kế (khớp nút "✓ Tick" trong screenshot). Prev/next nav thủ công vẫn có.
- **Persistence**: checked steps + furthest pointer + file handle, namespaced `poe2-leveling-0-5`, localStorage + IndexedDB.
- **Graceful degradation**: FS Access API + Document PiP là Chromium-only. Feature-detect; Firefox/Safari → vẫn dùng được checklist + nav tay (ẩn nút auto/PiP, hiện hint). KHÔNG vỡ SSG build (mọi truy cập `window`/`navigator` guard `import.meta.client`, page prerender thành HTML tĩnh).
- **Menu**: thêm `{ name: 'Leveling', url: '/leveling' }` vào `nuxt.config.ts` runtimeConfig.public.menu.

## Criteria
- [x] `bun run generate` pass exit 0 (×4 lần), không lỗi type/SSR; `/leveling` prerender ra HTML tĩnh (42KB). *Lưu ý: vue-tsc/nuxi typecheck của repo crash do version mismatch — generate/esbuild transpile là verification thay thế.*
- [x] `app/composables/data/leveling-poe2-0-5.ts` chứa Acts 1-4 (70 zones, 306 steps), **70/70 `clientName` khớp verbatim** wiki page; adversarial review spot-check ~14 zone clientName/areaLevel + optional flags OK (fix: Clearfell Encampment Lv15, Xyclucian Chimeral, Whakapanu boss).
- [🟡] Chrome connect Client.txt → advance: **matcher logic test 23/23 pass** (parse regex + forward-only) + `requestWindow`/picker API verified hoạt động; nhưng glue đầy đủ picker→handle→poll→readChunk→advance **chỉ review code, chưa chạy với file Client.txt thật** (cần test in-game).
- [x] Re-enter zone cũ → pointer KHÔNG nhảy lùi: **verified qua logic test** (integration case: town backtrack + relog vào zone cũ đều không regress).
- [🟡] Nút Pop-out → PiP: `documentPictureInPicture.requestWindow()` **mở được dưới click** (probe verified, transient activation active); DOM-relocation + style-clone + restore-on-pagehide **đã review code, CHƯA quan sát trực tiếp** (playwriter relay không đọc được cửa sổ PiP riêng).
- [⬜] Firefox/Safari degrade: **CHƯA test** (playwriter chỉ điều khiển Chrome). SSR HTML render cả 2 fallback hint ("cần Chrome/Edge") → gated path render đúng, nhưng "checklist+nav interactive, no console error" trên non-Chromium chưa quan sát. Follow-up: mở Firefox kiểm tra.
- [x] Theme tokens (không hex hardcode mới) + voice tiếng Việt giữ English terms: **verified** (adversarial review + live screenshot — mọi class resolve về andy-note-nuxt token).

## Verification log (observed vs reviewed vs untested)
- **Observed (live Chrome qua playwriter):** hydration sạch (KHÔNG có Vue mismatch warning), fresh-load (localStorage cleared) → overlay = "THE RIVERBANK" idx 0 (no first-run drift bug), feature-detect flip mounted → real buttons xuất hiện, navigator render 70 zones + town badge + Lv đúng, screenshot khớp reference poeviethoa.net.
- **Reviewed-not-observed:** PiP DOM relocation/style-clone (relay không reach PiP window); FS pipeline glue against real Client.txt.
- **Untested:** non-Chromium degradation; in-game auto-advance end-to-end.
- **Throwaway:** matcher logic test sống ở `tmp/leveling-match.test.ts` (gitignored) — pure module `leveling-match.ts` ở repo nên test-able nếu thêm test runner sau.
