---
template: templates/guide-template.md
document_type: guide
title: "Skill gem và Support gem: hệ thống Uncut Gem của POE2"
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
  - skill-gem
  - support-gem
  - uncut-gem
  - fundamentals
---

# Skill gem và Support gem: hệ thống Uncut Gem của POE2

POE2 bỏ socket màu trên item: skill gắn thẳng vào character qua Skill Gem, support gắn vào gem đó — item đang cầm không ảnh hưởng số support slot.

## 3 loại Uncut Gem
- :wiki-link{url="https://www.poe2wiki.net/wiki/Uncut_Skill_Gem"} → skill chủ động thường
- :wiki-link{url="https://www.poe2wiki.net/wiki/Uncut_Spirit_Gem"} → persistent buff skill (aura + minion thường trực, cần Spirit duy trì)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Uncut_Support_Gem"} → support
- Cả 3 drop tự nhiên từ monster + chest; **gem level = area level nơi rớt** (gem lv20 xuất hiện ở map tier cao cuối game)

## Tạo Skill Gem
- Right-click Uncut Skill Gem → màn chọn skill → toàn bộ skill của class hiện ra → chọn 1 → gem thành :wiki-link{url="https://www.poe2wiki.net/wiki/Skill_gem"} ở level của Uncut Gem
- **Lựa chọn KHÔNG đổi lại được** → muốn skill khác cần Uncut Gem mới; Uncut Support Gem giống hệt (right-click → chọn :wiki-link{url="https://www.poe2wiki.net/wiki/Support_gem"})

## Gắn Support Gem
- Gắn thẳng vào Skill Gem trong **Skills Panel**, không qua item; mỗi Skill Gem bắt đầu **2 support slot**, mở thêm 3 bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Jeweller's_Orb"} → tối đa **5**
- Support slot theo attribute: Strength → support đỏ · Dexterity → xanh lá · Intelligence → xanh dương; cứ 5 điểm attribute → cắm được 1 support tương ứng
- Thiếu attribute → support bị disable nhưng skill vẫn dùng (khác POE1 khóa cả skill)
- KHÔNG cắm 2 support cùng category trên 1 skill (vd 2 support Fire)

## Level gem
- Gem lên level khi char nhận XP → **phải đang gắn trong Skills Panel** mới hấp thu XP; cất inventory không level dù đang grind
- Đẩy gem lên cao hơn: right-click 1 Uncut Skill Gem → chọn nâng gem hiện có (Uncut Gem phải level cao hơn gem đang dùng)
- Max level **20**, hoặc **21 nếu corrupt**
- Skill cấp từ ascendancy: support slot tự tăng theo level char, không cần Jeweller's Orb

## Pitfalls
- ✗ Engrave khi chưa chắc muốn chơi skill đó → quyết định không đổi, cần Uncut Gem mới để thử skill khác
- ✗ Uncut Spirit Gem dùng cho skill thường → chỉ dùng cho persistent buff; skill thường dùng Uncut Skill Gem, không lẫn
- Uncut Gem level thấp vẫn tạo gem mới (gem start thấp rồi level dần theo XP)

## Relationships

- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — Uncut Spirit Gem tạo skill persistent tiêu Spirit; hiểu Spirit trước khi dùng
- **related** [Increased vs More: quy tắc tính damage](/guides/beginner-increased-vs-more) — support gem là nguồn More multiplier chính
- **related** [Weapon set và weapon swap](/guides/beginner-weapon-swap) — cách assign gem cho từng weapon set
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — chuỗi support gem cho companion (Pain Offering package)
- **related** [Ba chỉ số cơ bản: Strength, Dexterity, Intelligence](/guides/beginner-attributes) — gem có attribute requirement, thiếu thì không active.
- **related_guides** [Độ hiếm item: Normal, Magic, Rare, Unique và prefix/suffix](/guides/beginner-item-rarity) — gem hoạt động độc lập rarity của item
