# T-048: WikiLink trade affordance — icon + popover button thay plain `[trade]` link

> Trade link trong content render thành chữ "trade" đỏ chen giữa prose, nhìn rối và không rõ là cái gì; đưa trade vào WikiLink component như một affordance gọn, có icon + nút trong popover giá.

- **priority**: medium
- **effort**: S

## Problem

Trong `content/mechanics/spirit-and-spirit-reservation.md` mình gắn 27 trade link dạng markdown `:wiki-link{...} [trade](url)`. Render ra: ngay sau lime chip item là một chữ "trade" màu coral (default external-link style) — user phản hồi "nhìn gớm", "đọc vào không hiểu". Plain markdown link không style được per-instance, không có ngữ cảnh, làm prose dày đặc thành rối. WikiLink (`app/components/WikiLink.vue`) đã có sẵn chip + hover popover giá (`WikiPopover.vue`) — đó mới là chỗ đúng để gắn trade.

## Goal

Item nào trade được thì có một affordance trade gọn, đẹp, rõ nghĩa — không phá flow đọc — và một nút "Mở trade" trong popover giá đã có sẵn.

## Requirements

- `WikiLink.vue` nhận thêm prop optional `trade` (URL trade2). Khi có:
  - Render một icon trade compact ngay sau tên item (icon-only, không phải chữ "trade"), mở tab mới (`getExternalLinkAttrs`), có `title`/`aria-label` cho a11y.
  - Truyền `trade` xuống `WikiPopover` để render nút "Mở trade ↗" ở đáy popover.
- Dùng theme token (`--c-primary`, `--c-muted`, `--c-faint`…), KHÔNG hardcode hex mới.
- Rewrite 27 link trong doc từ `:wiki-link{url="X"} [trade](Y)` sang `:wiki-link{url="X" trade="Y"}`. Không chữ "trade" lủng lẳng còn sót.
- Không đổi behavior khi `trade` vắng (mọi wiki-link khác giữ nguyên).

## Criteria

- [x] `WikiLink` render icon trade chỉ khi có prop `trade`; click mở đúng URL tab mới.
- [x] Popover hiện nút "Mở trade" khi có `trade`.
- [x] 27 occurrence trong doc dùng attribute form; `grep -c "\[trade\](" doc` = 0.
- [x] `bun run generate` exit 0, doc render không lỗi MDC.
- [x] Không hardcode hex mới trong component (chỉ token hiện có).
