---
template: templates/guide-template.md
document_type: guide
title: "Gold: kiếm, tiêu và quản lý tài nguyên respec"
status: draft
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
guide_type: fundamentals
tags:
  - poe2
  - 0-5
  - beginner
  - gold
  - respec
  - vendor
  - currency
---

# Gold: kiếm, tiêu và quản lý tài nguyên respec

:wiki-link{url="https://www.poe2wiki.net/wiki/Gold"} = tài nguyên nền: respec passive tree, mua vendor NPC, đặt lệnh Currency Exchange, gamble ở Gambler.

## Tính chất
- Auto-thu khi di chuyển / dùng movement skill trong tầm → không cần click từng đồng
- KHÔNG chiếm inventory slot; số dư hiện dưới ô item ở màn Inventory; tích không giới hạn
- Account-bound, **shared giữa mọi character cùng league** — tạo char mới vẫn nguyên
- KHÔNG trade/chuyển cho player khác · không drop · không bỏ stash cho bạn lấy

## Respec passive tree
- Cost/node thu hồi tăng theo **character level**, KHÔNG theo loại/vị trí node:

| Level | Gold/node |
|-------|-----------|
| 1 | 15 |
| 50 | ~1,089 |
| 100 | >10,000 |

- Mọi node cùng level char = giá bằng nhau (attribute node = keystone)
- **Attribute travel node** (+30 Str/Dex/Int cho requirement): đổi attribute (vd Str→Dex) = ½ giá respec hoàn toàn
- Respec sai lúc mới chơi ≈ free · respec 20–30 node endgame = đáng kể → plan tree kỹ trước, xem [passive tree](/guides/beginner-passive-tree)

## Vendor + Gambler (đều nhận gold)
- Mỗi town ≥1 :wiki-link{url="https://www.poe2wiki.net/wiki/Vendor"} + 1 :wiki-link{url="https://www.poe2wiki.net/wiki/Gambler"}; cả hai bán đổi lấy gold
- Vendor: base item stat cố định, stock refresh 1 phần mỗi khi lên level → nguồn base tin cậy để craft
- Gambler: gold → item ngẫu nhiên (rarity + stat không cố định), roll may rủi thuần túy, rẻ hơn currency crafting

## Nguồn gold + tích cho respec lớn
- Rơi từ monster, chest, và **item convert**: Normal item drop bị chuyển thành gold thay item vật lý
- Convert rate **nghịch với rarity**: Normal nhiều nhất · Magic/Rare ít hơn · Unique gần như không bao giờ
- Unique monster: hard cap ≤50% drop có thể là gold
- :wiki-link{url="https://www.poe2wiki.net/wiki/Currency_Exchange"} thu 1 khoản gold nhỏ làm phí mỗi lần đặt + hoàn thành lệnh
- Cần respec lớn thiếu gold → clear thêm content pack dày / nhiều chest / item density cao (gold theo về tự nhiên cùng loot)

## Relationships

- **related_guides** [Passive skill tree: cách đọc và phân bổ điểm](/guides/beginner-passive-tree) — respec dùng gold thu hồi node; plan kỹ tránh tốn gold
- **related_guides** [Giao dịch và trading](/guides/beginner-trading) — Currency Exchange nhận gold làm phí đặt lệnh
- **related_guides** [Currency cơ bản: mỗi orb làm gì](/guides/beginner-currency) — gold khác currency orb: không trade, không craft item
