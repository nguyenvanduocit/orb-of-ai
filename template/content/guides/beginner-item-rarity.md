---
template: templates/guide-template.md
document_type: guide
title: "Độ hiếm item: Normal, Magic, Rare, Unique và prefix/suffix"
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
  - item-rarity
  - crafting
  - affix
---

# Độ hiếm item: Normal, Magic, Rare, Unique và prefix/suffix

4 rarity; rarity quyết định số modifier item mang.

| Rarity | Màu | Mod tối đa | Craft lên |
|--------|-----|-----------|-----------|
| Normal | xám | 0 explicit (implicit của base vẫn có) | Transmutation→Magic · Alchemy→Rare · Chance→Unique |
| Magic | xanh dương | 1 prefix + 1 suffix | Regal Orb→Rare |
| Rare | vàng | 3 prefix + 3 suffix (6) | — |
| Unique | nâu/cam | cố định, không đổi | — |

## Normal
- Không có explicit mod; một số base có **implicit** sẵn (vd ring +resist) = đặc tính base, không craft/gỡ được
- = nguyên liệu craft: :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Transmutation"} → Magic · :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Alchemy"} → thẳng Rare · :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"} → Unique
- Chance chỉ dùng được nếu base đó CÓ bản Unique; base không có Unique → orb không dùng được, không tiêu hao. Thành công → Unique HOẶC phá hủy (không trung gian)

## Magic
- Transmutation → 1 mod (prefix hoặc suffix); :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Augmentation"} → thêm mod còn thiếu
- Công dụng chính = bước đệm: có mod đúng ý → :wiki-link{url="https://www.poe2wiki.net/wiki/Regal_Orb"} → Rare (giữ mod cũ + thêm 1 mod) → craft Rare kiểm soát hơn Alchemy

## Prefix vs suffix
- Không khác về sức mạnh, chỉ để giới hạn số mod tối đa mỗi loại
- Một số mod chỉ prefix (flat phys, life...) · số khác chỉ suffix (resist, attribute, speed)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Exalted_Orb"} chỉ thêm khi còn slot trống (<3 prefix hoặc <3 suffix) · :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Annulment"} xóa random không phân loại

## Rare
- Gear chính endgame; drop trên sàn thường 4–5 mod, ~10% ra đủ 6 mod
- :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Orb"} POE2 = xóa 1 mod random + thêm 1 mod mới (KHÔNG reroll toàn bộ như POE1)
- Flask + charm không thể ở rarity Rare

## Unique
- Cùng base type với Normal, tên/artwork/bộ mod cố định; orb không thêm/bớt/reroll được
- Mạnh vì cơ chế đặc thù Rare không có: :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan%27s_Effigy"} mở trần companion · :wiki-link{url="https://www.poe2wiki.net/wiki/The_Catha%27s_Balance"} feed flat damage vào companion theo main hand
- Một số Unique drop-restricted → không tạo bằng Orb of Chance

## Identify
- Magic/Rare/Unique nhặt trên sàn = **unidentified** (ẩn stat, chỉ hiện base + rarity)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Scroll_of_Wisdom"}: right-click Scroll → left-click item → hiện mod; drop rất nhiều, không tiết kiệm
- Normal không cần identify (không có explicit mod)

## Relationships

- **related_guides** [Currency cơ bản: mỗi orb làm gì](/guides/beginner-currency) — vai trò từng orb craft (Transmutation, Alchemy, Regal, Chaos, Exalted)
- **related_guides** [Crafting cơ bản](/guides/beginner-crafting-basics) — quy trình craft item theo rarity sau khi hiểu affix
- **related_guides** [Skill gem cơ bản](/guides/beginner-skill-gem) — gem hoạt động độc lập rarity của item
- **related_guides** [Defence layers: cách POE2 tính phòng thủ](/guides/beginner-defence-layers) — khi nào Rare item thật sự cần cho defense
- **related_builds** [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) — IIR bucket system (player vs area), area IIR từ waystone nhân độc lập, không diminishing.
- **related_guides** [Corrupted item: tại sao không craft được và xử lý như thế nào](/guides/beginner-corrupted-items) — nền hiểu tại sao Corrupted lock vĩnh viễn.
