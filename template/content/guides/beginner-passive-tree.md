---
template: templates/guide-template.md
document_type: guide
title: "Passive skill tree: cách đọc và phân bổ điểm"
status: published
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
  - passive-tree
  - build-basics
---

# Passive skill tree: cách đọc và phân bổ điểm

:wiki-link{url="https://www.poe2wiki.net/wiki/Passive_Skill_Tree"} = mạng hàng nghìn node. Đọc trước khi bấm để mỗi điểm đáng.

## 4 loại node

| Loại | Đặc điểm |
|------|----------|
| Small passive | stat nhỏ (5% inc damage / +10 life), làm đường nối; 1 điểm/node, return thấp — đừng lấy chỉ vì "được gì đó" |
| Notable | điểm đến thật của cluster: to hơn, stat lớn, lý do đi vào khu; mỗi cluster có 1+ notable ở trung tâm |
| Keystone | hình thoi, đổi cơ chế chơi hoàn toàn; luôn 2 chiều lợi + đánh đổi → đọc kỹ cả hai |
| Jewel socket | ô tròn gắn :wiki-link{url="https://www.poe2wiki.net/wiki/Jewel"} (stat không có trên tree); tháo tự do → linh hoạt nhất |

- :wiki-link{url="https://www.poe2wiki.net/wiki/Keystone"} ví dụ: **Eldritch Battery** (tiêu ES thay mana trả skill cost) · **Chaos Inoculation** (life về 1, đổi lấy miễn nhiễm chaos hoàn toàn) — có keystone triệt tiêu cả layer phòng thủ nếu build không thiết kế cho nó

## 3 vùng theo attribute

| Vùng | Attribute | Nội dung |
|------|-----------|----------|
| Tây-nam | Strength | fire damage, armour, melee, endurance charge, warcry, block |
| Đông-nam | Dexterity | lightning damage, evasion, ranged, frenzy charge, deflection, accuracy, flask |
| Bắc | Intelligence | cold + chaos damage, energy shield, spell, minion, mana, curse |

- Mỗi class xuất phát ở 1 điểm trên vòng trung tâm, gần vùng attribute chính: Warrior → Strength (tây-nam) · Witch → Intelligence (bắc) · Huntress → Dexterity
- Chọn sai class cho playstyle → tốn 5–10 điểm chỉ để "đi đường" qua small passive không liên quan

## Đường đi > điểm đến
- Không nhảy thẳng tới notable/keystone xa → phải đi qua từng small passive, mỗi cái 1 điểm; notable cần đi qua 6 small = tốn 7 điểm
- So sánh cluster: so cả số small passive phải đi qua, không chỉ stat notable → cluster gần / nằm trên đường thường hiệu quả hơn cluster xa stat cao hơn chút
- Mỗi level = 1 điểm; quest reward thêm → tối đa **124 điểm** ở max level, khi leveling chỉ làm việc với 60–80 điểm

## Plan trong Path of Building
- **PoB** = tool offline simulate build trước khi commit điểm thật: import tree từ pobb.in → allocate thử → PoB tính stat/DPS/defense ngay
- Cách dễ nhất khi mới: import PoB code của build guide công bố → hiểu creator đi đường nào + tại sao (không cần follow y hệt)
- Respec tốn gold, không free → plan sớm = ít respec sau

## Relationships

- **related_guides** [Layered defence cho người mới](/guides/beginner-defence-layers) — node armour/evasion/ES trên tree áp dụng trực tiếp cơ chế defence layers
- **related_guides** [Resistance cho người mới](/guides/beginner-resistances) — resistance node là ưu tiên tree đầu tiên khi vào endgame
- **related_guides** [Gold: kiếm, tiêu và quản lý respec](/guides/beginner-gold) — respec node tốn gold theo level char; plan sớm tiết kiệm
- **related_guides** [Spirit cho người mới](/guides/beginner-spirit) — spirit node trên tree liên kết hệ thống skill reservation
- **related** [Ascendancy: chọn subclass và mở khoá như thế nào](/guides/beginner-ascendancy) — ascendancy tree truy cập từ trung tâm passive tree.
- **related** [Ba chỉ số cơ bản: Strength, Dexterity, Intelligence](/guides/beginner-attributes) — node attribute nguồn tăng Str/Dex/Int cho gear hybrid.
- **related** [Phần thưởng quest vĩnh viễn: Spirit, Life và passive points từ boss](/guides/beginner-quest-rewards) — tree chính, phân biệt với Weapon Set Passive Skill tree riêng
- **related** [Đặc trưng từng class và ascendancy](/guides/beginner-classes) — vị trí start của từng class quyết định node gần nhất.
