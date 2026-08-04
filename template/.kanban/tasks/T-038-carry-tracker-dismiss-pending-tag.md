# T-038: Carry tracker — tắt tag "📩 chờ" thủ công

> Cho phép bấm vào tag whisper-pending để tự tắt, không phải đợi buyer join hay xoá cả row.

- **priority**: low
- **effort**: XS

## Problem

Tag "📩 chờ" (T-036) hiện khi row tạo từ whisper mà buyer chưa join (`request && !present`). Nó chỉ tự tắt khi buyer join hoặc khi xoá nguyên row — không có cách tắt thủ công riêng nếu người bán muốn ẩn marker (vd buyer đã vào qua đường khác mà present chưa bắt được, hoặc chỉ muốn dọn cho gọn).

## Goal

Bấm vào tag "📩 chờ" là nó tắt ngay, giữ nguyên row + Start/Target đã pre-fill.

Kèm visual fix: emoji 📩 render kèm mũi tên nằm phía-trên-giữa nhìn lệch; đổi sang envelope monochrome + dot badge ở góc trên-trái đè lên envelope (đúng kiểu notification badge), khớp theme coral.

## Requirements

- Thêm action `clearRequest(name)` trong `useCarryTracker.ts` → set `request = null`, trigger reactivity.
- Tag trong `CarryTracker.vue` thành nút bấm được, tooltip nói rõ "bấm để tắt".
- Không đụng startLevel/targetLevel/level/paid — chỉ ẩn marker.
- Đổi 📩 → envelope `✉` monochrome (`font-variant-emoji: text`, inherit coral) + dot CSS góc top-left đè lên.
- `request` persist localStorage (note đơn không mất khi reload).

## Criteria

- [x] `bun run generate` pass.
- [x] Bấm tag → tag biến mất, row + Start/Target còn nguyên (`clearRequest` chỉ set request=null).
- [x] Dot nằm góc trên-trái đè lên envelope, không còn nổi phía-trên-giữa (verified screenshot live).
