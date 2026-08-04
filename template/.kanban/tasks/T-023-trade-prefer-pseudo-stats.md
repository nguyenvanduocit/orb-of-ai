# T-023: /trade ưu tiên pseudo stat trong search

> Mọi search /trade prefer `pseudo.pseudo_total_*` cho Life/Res/Attribute thay vì `explicit.stat_*` — pool securable rộng hơn, dễ ra hàng.

- **priority**: medium
- **effort**: XS

## Problem
`/trade` hiện cache + ví dụ search toàn dùng `explicit.stat_*` (vd Fire Res `explicit.stat_3372524247`). Explicit chỉ match đúng MỘT mod, bỏ sót item có stat đó từ nguồn khác (all-elemental-res, hybrid co-roll, implicit) → pool securable hẹp, khó siết `total` xuống 10-15, hay báo "hết hàng" giả. User feedback (2026-06-04): tìm theo pseudo dễ ra hàng hơn.

## Goal
Search `/trade` mặc định prefer pseudo cho Life/Res/Attribute → user mở URL ra nhiều hàng đúng hơn, dễ mua.

## Requirements
- Thêm rule "prefer pseudo" vào `## Result Workflow` (đặt TRƯỚC securable/narrow/rank vì là bước chọn stat-id).
- Thêm pseudo id (verified từ `data/trade-static/stats.json`) vào reference cache; giữ explicit cho mục đích target-1-mod-cụ-thể.
- KHÔNG bịa id — mọi pseudo id verify từ trade-static snapshot.
- Non-goal: không sửa engine TS (gear-optimize.py đã dùng pseudo sẵn).

## Criteria
- [ ] Result Workflow có rule pseudo-priority kèm lý do (gom mọi nguồn → pool rộng).
- [ ] Reference cache liệt kê pseudo id cho Life/ES/4-res/all-ele-res/total-res/Str-Dex-Int/all-attr, verify trade-static.
- [ ] Explicit cache giữ lại, ghi rõ "dùng khi cần đúng 1 mod cụ thể".
