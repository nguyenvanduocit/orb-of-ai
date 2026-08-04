# T-026: Transport tự mở tab pathofexile.com khi chưa có tab nào
> poeFetch auto-open /trade2/ tab nếu Playwriter connected nhưng chưa có tab PoE — khỏi bắt user mở tay

- **priority**: high
- **effort**: S

## Problem

`poe-trade/ggg/transport.ts` `buildScript()` — nhánh `if (__tabs.length === 0)` trả thẳng
`__NO_POE_TAB__` và làm fail nguyên call khi không có tab `www.pathofexile.com` nào đang mở.
Nhưng nhánh này CHỈ chạy khi sandbox playwriter đã execute — tức **Playwriter đã connect tới
Chrome rồi**, chỉ là chưa có tab PoE. Hệ quả: mọi `/trade`, `/gear-upgrade`, `/stash`, `/pob`
live đều chết ngay câu đầu, bắt user mở tay một tab `/trade2/` + login + click extension trước
khi làm được gì. Lặp lại mỗi session.

Evidence: `bun .claude/skills/poe-trade/ggg/trade-search.ts --name "Sylvan's Effigy"` →
`page-context fetch failed: No logged-in www.pathofexile.com tab ... __NO_POE_TAB__`.

## Goal

Khi Playwriter connect được Chrome nhưng chưa có tab PoE, transport **tự mở** một tab
`www.pathofexile.com/trade2/` (cookie session làm nó logged-in nếu user còn session hợp lệ)
rồi chạy fetch trên đó — trade call work mà không cần user mở tab tay.

## Requirements

- Chỉ auto-open khi sandbox chạy được (Playwriter reachable). Extension KHÔNG connect → giữ
  nguyên error rõ ràng (không có gì để mở).
- Mở bằng `context.newPage()` → `goto https://www.pathofexile.com/trade2/`
  (`waitUntil: domcontentloaded`) → settle ~2s cho cookie/cf. Fallback: nếu newPage không
  dùng được, navigate một controlled page sẵn có.
- Tab mở xong được **reuse** ở call sau (không mở lặp lại; để tab đó sống).
- User chưa login → 401/403 thật surface (không auto-login — ngoài scope).
- An toàn account đã-flag: mở đúng một tab = một DOM nav, không hammer; giữ nguyên ≥2s spacing.
- Path cũ (đã có tab PoE) giữ nguyên hành vi, không mở thêm tab.

## Criteria

- [x] Playwriter connected + KHÔNG có tab PoE: `trade-search.ts --name "Sylvan's Effigy"` mở
      tab `/trade2/` và trả `{total, id, ...}` thay vì `__NO_POE_TAB__`.
- [x] Đã có tab PoE sẵn: hành vi không đổi (không tạo tab thừa).
- [x] Playwriter KHÔNG connect: vẫn báo lỗi rõ ràng, không crash.
- [x] Tab auto-open được reuse ở call kế (chỉ một tab được tạo).
- [x] `bun -e 'import("./.claude/skills/poe-trade/ggg/transport.ts")'` load sạch (no syntax error).
