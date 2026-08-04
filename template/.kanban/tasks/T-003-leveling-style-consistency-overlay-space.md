# T-003: Leveling tracker — style không đồng nhất + overlay chiếm quá nhiều space
> Trang /leveling: thống nhất ngôn ngữ brutalist giữa các card, và bỏ void rỗng trong overlay frame (fixed 560px).

- **priority**: medium
- **effort**: S

## Problem
Trang `/leveling` (`app/pages/leveling.vue` + `app/components/LevelingOverlay.vue`) có hai vấn đề thị giác:

1. **Overlay frame chiếm quá nhiều space** — `.lvl-overlay-frame` và `.lvl-pip-placeholder` đều fixed `height: 560px` (leveling.vue:310-311). Zone ngắn (vd Act 1 Riverbank, 4 step) chỉ lấp ~45% chiều cao → phần còn lại là một hộp viền **coral rỗng** to đùng, cả trên desktop lẫn mobile. Cảm giác "dư thừa".
2. **Style không đồng nhất** — 3 card cùng cấp dùng 3 treatment khác nhau:
   - Hộp overall `%` (`.lvl-overall`, leveling.vue:229): `border-strong` (xám đậm) + stamp 4px.
   - Act card (`.lvl-act`, leveling.vue:262): `border` (xám nhạt) + stamp 4px.
   - Overlay frame (`.lvl-overlay-frame`, leveling.vue:310): `primary` (coral) + stamp **6px**.
   → ba màu border + hai cỡ shadow lệch nhau, coral perimeter quanh hộp rỗng khuếch đại cảm giác lệch.

## Goal
Trang leveling đọc như một hệ brutalist nhất quán: card xám = thông tin tĩnh, coral = hero sống; và overlay frame ôm sát nội dung (không void) ở mọi zone, vẫn lấp đầy cửa sổ Picture-in-Picture khi pop-out.

## Requirements
- Giữ phân cấp: overlay VẪN là hero (coral signal) — không flatten về xám hết.
- Thống nhất stamp shadow về 4px; rationalize token `border` vs `border-strong` giữa các card cùng cấp.
- Overlay frame on-page: `height: auto` + `max-height` (hug content, scroll khi dài). `.lvl-pip-placeholder` đổi đồng bộ để không tạo void mới khi PiP active.
- PiP fill phải tường minh: set inline style trong `openPip` (`height:100vh; maxHeight:none; border:0; boxShadow:none`) và clear trong `closePip` — không đánh cược vào CSS specificity giữa scoped + global. PiP API cần user gesture nên không screenshot headless được → fill phải guaranteed bằng JS.
- Không hardcode hex; dùng theme token (`theme('colors.primary')` = coral `#ff7b6b`, `terminal.*`).

## Criteria
- [x] Zone ngắn (Riverbank, 4 step): overlay frame ôm sát, không còn void coral rỗng — frameH **358px** (trước fixed 560px), `stepsScrolls=false`. Screenshot xác nhận coral border wrap đúng nội dung.
- [x] Zone dài: steps scroll trong frame, frame cap ở `max-height` — case viewport 1440×440 (Vastiri 7 step): frameH=408 = maxAllowed, `stepsScroll 411 > stepsClient 254` → scroll OK.
- [x] 3 card cùng cấp dùng treatment nhất quán: stamp đồng nhất 4px; `.lvl-overall` đổi `border-strong`→`border` khớp `.lvl-act`; overlay giữ coral border (hero), shadow 6px→4px. Screenshot xác nhận hệ 2-tier (xám tĩnh / coral hero).
- [x] `openPip`/`closePip` set + clear inline style (`height:100vh; maxHeight:none; border:0; boxShadow:none`) để PiP lấp đầy cửa sổ + revert hug-content khi đóng (useLeveling.ts:410-416, 433). PiP API cần user gesture → không screenshot headless được; cơ chế fill = flex-scroll giống case capped đã verify.
- [x] `bun run generate` pass — exit 0, prerender 533 routes, không error/hydration warning; `/leveling` + `/en/leveling` prerendered, `max-height:calc(100vh - 32px)` compiled vào bundle.

## Refinement (user feedback round 2 — xem ảnh PiP thật)
TICK + 2 mũi tên to + band riêng chiếm chỗ; user muốn thu nhỏ, đưa vào header bên trái, bỏ BOSS.
- Bỏ band `.lvo-nav` riêng (border-bottom + padding) → gộp cụm control compact vào trong `.lvo-hero`, left-aligned dưới zone name.
- Thu nhỏ: arrow 40px→34px (border 3→2px), TICK full-width band → pill `min-width:132px` height 34px (border 3→2px, shadow 4→2px, font 14→12px); bỏ chữ "XONG —" thừa.
- Xoá hẳn `.lvo-boss` + `.lvo-boss-tag` (boss vẫn còn ở nav spine của page). Verify: `bossExists:false`, `navInHero:true`, `tickH:34 tickW:132`, heroH 117px.

## Refinement (user feedback round 3 — overlay nổi trên game che mất tầm nhìn)
Overlay là PiP floating trên game → phải minimal, dày đặc, ăn ít chiều dọc. Rewrite `LevelingOverlay`:
- Header gộp thành **1 dòng**: controls (‹ ✓TICK › ở 28px) bên trái + cột id (zonename 15px ellipsis + meta line 9px `AUTO · ACT · LV · count`) bên phải. Bỏ chips row + h2 26px riêng. Hero **117px → 45px**.
- Steps **dày đặc**: padding 10→4px, checkbox 20→15px, tag 9→8px, text 14→13px line-height 1.45→1.28, bỏ `lvo-rise` animation (nhiễu trong overlay). Verify (PiP 380×520, Riverbank): step 1-dòng 33px / 2-dòng 57px, contentH 4 step = **249px** (đủ thấy trọn trong cửa sổ + dư).
- `bun run generate` exit 0, /leveling prerendered, CSS minimal (`lvo-id`/`lvo-meta`) compiled.

## Verification log
- Screenshot harness (playwright headless, isolated trong tmp/): short zone hug (no void), capped viewport scroll OK, mobile hug; round 2 PiP-like 380×520 confirm header compact + controls left + no boss.
- Residual (follow-up): PiP window thật không screenshot headless được (Document PiP cần user gesture) — fill verified bằng code + cơ chế flex tương đương; nên log mắt thường khi vào league.
