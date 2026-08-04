# T-031: Game item floating card nhỏ lại
> Wiki-link hover popover (WikiPopover) đang chiếm nhiều diện tích — thu nhỏ kích thước card.

- **priority**: low
- **effort**: XS

## Problem
`WikiPopover.vue` render floating card khi hover `:wiki-link`. Card hiện to: base font 15px, header 20px, min-width 220px / max-width 520px ở cả hai render path (`.item-box` wiki-HTML trong `poewiki-itembox.css` + `.poe-box` fallback scoped). Div card riêng một lever `.divicard-wrapper` width 440px.

## Goal
Card hover game item hiển thị gọn hơn, đỡ che nội dung, vẫn đọc rõ mods.

## Requirements
- Thu nhỏ đồng nhất cả hai path (`.item-box` + `.poe-box`) — không lệch.
- Giữ header sprite không vỡ (header font ≥16px, sprite height 28/48px nguyên).
- Div card (`.divicard-wrapper`) cũng nhỏ theo cho đồng bộ.
- Explicit px reduction (theo style code hiện tại), không dùng `zoom`/`transform`.

## Criteria
- [x] base font 15→13, header 20→17, min-width 220→190, max-width 520→430 ở cả hai path
- [x] gem art (220×160→170×120) + item-stats padding (9/22→6/16) + div card width (440→380) thu nhỏ theo
- [x] Screenshot dev `:3000` hover popover: Sylvan's Effigy card 447×482px (cũ cap ~526px), header sprite + mods + art đọc rõ, không vỡ layout
