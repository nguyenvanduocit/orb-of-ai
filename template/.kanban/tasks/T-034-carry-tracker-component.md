# T-034: Carry/party tracker inline component

> Inline content component đọc Client.txt live, hiện bảng người chơi trong party — level hiện tại, đã trả tiền chưa, đặt tới level mấy — phục vụ bán dịch vụ leveling carry.

- **priority**: medium
- **effort**: M

## Problem

Khi chạy dịch vụ leveling carry (kéo nhiều buyer cùng lúc trong một party), người bán phải tự nhớ trong đầu: ai đang trong party, họ level mấy rồi, đã trả tiền chưa, đặt kéo tới level nào. Năm người một lúc thì không nhớ nổi, dễ kéo lố/kéo thiếu hoặc quên thu tiền.

POE2 Client.txt đã log đủ tín hiệu để tự động hoá phần "ai + level mấy":
- `… [INFO Client n] : <name> (<class>) is now level <N>` — chỉ broadcast cho party member, cho luôn tên + class + level (verified từ fixture Exiled-Exchange-2 `client-log.test.ts` + regex `client_strings.js:162`).
- `… : <name> has joined/left the area.` — presence in/out.
- `… : <name> has been slain.` — chết (mất 10% XP, đáng cảnh báo).

Hạ tầng đọc Client.txt qua File System Access API đã có sẵn trong `app/composables/useLeveling.ts` (IDB handle persist, tail 4MB, byte-offset incremental poll, epoch teardown) — tái dùng pattern này, chỉ thay parser.

## Goal

Người bán mở một bảng live ngay trong bài farming guide, chọn Client.txt một lần, rồi thấy realtime ai trong party đang level mấy, tự đánh dấu đã trả tiền + đặt target level, để không bao giờ kéo lố hay quên thu tiền.

## Requirements

- Component dùng được **inline trong content markdown** qua MDC (`::carry-tracker`) — resolve theo kebab-name từ `app/components/`.
- Client-only cho phần live (wrap `<ClientOnly>`), SSR/`nuxt generate` prerender ra placeholder tĩnh, không truy cập `window`/IDB lúc render server.
- Parser **thuần** (no Vue import) trong `app/composables/carry-match.ts` + test `tmp/carry-match.test.ts` (node:assert, chạy `bun run`).
- Level + roster lấy từ dòng level-up (nguồn tin cậy); join/leave là presence best-effort; slain là death counter.
- State người dùng nhập (paid, target level, price/level, đánh dấu "là mình") **persist localStorage**, merge với level/presence live (Client.txt là nguồn sự thật cho level).
- Theme: chỉ dùng token `terminal-*` + `primary` qua `theme()` trong `<style scoped>` — không hardcode hex.
- Tái dùng monitor pattern của `useLeveling` (File System Access + IDB + tail + epoch), không gọi GGG API, không network.

## Criteria

- [x] `bun run tmp/carry-match.test.ts` pass — parse đúng level-up/join/leave/slain, bỏ qua dòng rác. (15 assertions pass; +sim round-trip 45/45 lines parse, 0 unparsed)
- [x] `::carry-tracker` render được trong `content/farming/0-5-leveling-carry-service.md`. (verified live qua playwriter — component hydrate ra toolbar + table 8 cột)
- [x] `bun run generate` pass (type + SSR prerender, không hydration mismatch). (exit 0, 484 routes, 0 link errors, component + ClientOnly fallback baked vào HTML)
- [x] Bảng hiện cột: tên · class · level live · level đã lên (gained) · target · còn lại · đã trả · ghi chú giá; có dòng tổng thu. (snapshot xác nhận đủ cột + tfoot tổng)
- [x] Paid + target + price persist qua reload (localStorage); level cập nhật live từ Client.txt. (user confirm "test ok"; paid "✓ rồi" giữ qua reload)

## Notes

- Files: `app/composables/carry-match.ts` (pure parser, verified format từ Exiled-Exchange-2 fixture) + `app/composables/useCarryTracker.ts` (monitor tái dùng pattern useLeveling, IDB namespace riêng `poe2-carry`) + `app/components/CarryTracker.vue` (MDC `::carry-tracker`, ClientOnly, theme `terminal-*`).
- Test helper: `tmp/sim-client-txt.ts` — sim Client.txt append events live để test không cần game.

