# T-035: Carry tracker — editable level, tiered pricing tab, Discord message tab

> Mở rộng carry tracker (T-034): cho sửa tay current level, thêm tab config giá theo range level, thêm tab generate message WTS copy lên Discord.

- **priority**: medium
- **effort**: M

## Problem

Carry tracker hiện tại (T-034) đủ để theo dõi level live nhưng thiếu ba thứ khi bán dịch vụ thật:

1. **Current level chưa sửa được.** Buyer mới vào team đang ở level 80 nhưng level-up event chưa fire (chỉ fire khi LÊN level), nên cột Lv trống tới khi họ lên 81. Người bán phải tự nhập level hiện tại lúc buyer vào.
2. **Giá phẳng một mức.** Một buyer đăng ký mua nhiều level bắc qua nhiều range giá khác nhau (vd 78→90 = 78-80 ở 1 div/lvl + 80-85 ở 2 + 85-88 ở 3 + 88-90 ở 5). Cột giá/level đơn không tính được tổng đúng.
3. **Không có message để đăng.** Người bán phải tự gõ tay bài WTS mỗi lần đăng Discord, dễ sai giá so với config.

## Goal

Người bán cấu hình bảng giá theo range level một lần, nhập tay level buyer khi họ vào team, rồi tiền mỗi đơn tự tính qua các tier, và copy được một bài WTS chuẩn để đăng Discord — tất cả trong cùng component inline, chia tab.

## Requirements

- Component chia 3 tab: **Party** (tracker), **Giá** (tier config), **Discord** (message generator).
- Tab Party: mỗi buyer có Start (sửa) → Target (sửa) định nghĩa đơn, Lv hiện tại sửa tay được + vẫn cập nhật live từ Client.txt; tiền tính qua tier table; level-up event ghi đè Lv, không đụng Start/Target/paid người dùng nhập.
- Tab Giá: danh sách tier {từ level, tới level, div/level}, thêm/sửa/xoá; seed mặc định theo cấu trúc chợ (55-80/80-85/85-88/88-90). Persist localStorage.
- Tab Discord: render bài WTS từ tier + service info (realm, IGN, title) sửa được; nút Copy (navigator.clipboard, user gesture, localhost secure context).
- Pricing engine THUẦN (no Vue) trong `app/composables/carry-pricing.ts` + test `tmp/carry-pricing.test.ts`: `priceForRange(tiers, from, to)` đi từng level, mỗi band L→L+1 ăn giá tier chứa L; `buildDiscordMessage(opts)`.
- Persist: Start/Target/Lv/paid/isSelf per buyer + tiers + service info qua reload.
- Giữ theme `terminal-*`, ClientOnly, không hardcode hex.

## Criteria

- [x] `bun run tmp/carry-pricing.test.ts` pass — `priceForRange` đúng cho range bắc nhiều tier, range trong 1 tier, range rỗng, level ngoài mọi tier. (24 assertions)
- [x] `bun run generate` pass (type + SSR prerender, no hydration mismatch). (exit 0, 484 routes, 0 errors, 3 tab baked vào HTML)
- [x] 3 tab chuyển qua lại được; Party hiện cột Start/Lv/Target/Còn/Tiền/Trả, tiền khớp tier table. (live: Start=80 Target=90 → Tiền=29 = 10+9+10 khớp priceForRange)
- [x] Current level + Start + Target sửa tay được; level-up event live ghi đè Lv mà không mất field người dùng nhập. (applyEvent chỉ set level/class/startLevel-if-null/present, không đụng target/paid)
- [x] Tab Discord render bài WTS từ tier, nút Copy bỏ vào clipboard đúng nội dung. (message render đủ 4 tier + IGN; Copy → writeText resolve → nút đổi "✓ Đã copy")
- [x] Tiers + service info + per-buyer fields persist qua reload. (localStorage poe2-carry-roster/tiers/service; startLevel giờ persist làm billing anchor)

## Notes

- NEW pure module `app/composables/carry-pricing.ts` (priceForRange tier-walk + buildDiscordMessage) + test `tmp/carry-pricing.test.ts`.
- `useCarryTracker.ts` rewrite: bỏ per-buyer pricePerLevel → global tiers; thêm setLevel/setStart editors, tiers + service state, discordMessage computed; persist startLevel.
- `CarryTracker.vue` rewrite: 3 tab (Party/Giá/Discord), editable Start·Lv·Target, tier editor, message + Copy (clipboard.writeText, secure-context localhost).
