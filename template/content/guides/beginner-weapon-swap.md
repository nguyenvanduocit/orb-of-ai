---
template: templates/guide-template.md
document_type: guide
title: Weapon set và weapon swap trong POE2
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
  - weapon-set
  - weapon-swap
  - skill-gem
  - persistent-skill
---

# Weapon set và weapon swap trong POE2

2 weapon set độc lập — mỗi set cầm vũ khí riêng, skill riêng, swap 1 nút. Không có trong POE1; nhiều build phụ thuộc hoàn toàn.

## 2 slot vũ khí
- Inventory (`I`) → phần vũ khí trái: hàng trên = **Weapon Set 1** (active, sáng), hàng dưới = **Weapon Set 2** (tối, trống mặc định); mỗi set 2 slot (main + off hand)
- **X** (mặc định) = swap giữa 2 set trong combat, **instant, không delay**
- Gắn vũ khí Set 2: kéo item vào hàng dưới; right-click nút weapon set = dùng chung 1 vũ khí cho cả 2 set (khi muốn skill khác nhưng gear giống)

## Gem assign theo set
- Skill gem mặc định hoạt động ở **cả 2 set** nếu weapon phù hợp; chỉ định riêng Set 1 hoặc Set 2 qua info panel của skill (hover → mở)
- Bấm skill assign cho set không active → game **auto-swap** sang set cần rồi dùng (tắt được trong info panel)
- Ví dụ: Blink @ Set 1, aura @ Set 2 → Blink chỉ dùng khi cầm Set 1; muốn cả 2 phải assign cả 2

## Persistent skill KHÔNG tắt khi swap
- Cơ chế quan trọng nhất: **aura + persistent skill chạy tiếp cả khi swap set kia** (Discipline/herald @ Set 1, bật rồi swap Set 2 → buff vẫn còn)
- Chỉ active skill (bấm nút) mới cần đúng weapon set; persistent chạy độc lập
- ⚠ **Spirit pool tính lại theo set active**: Set 1 ít Spirit hơn Set 2 (vd Set 2 cầm sceptre) → swap về Set 1 trần Spirit giảm → persistent skill vượt trần bị tắt → giữ Spirit 2 set xấp xỉ nếu cần persistent chạy liên tục

## Use case
- **Snapshot debuff boss**: Spirit Walker companion carry dùng Set 2 buckler grant **Parry** áp debuff "+50% more Attack Damage taken" lên boss → swap Set 1 (spear + sceptre) cho companion gánh; debuff đã áp vẫn hiệu lực sau swap
- **Buff bot set**: Set 2 stack buff 1 lần rồi swap Set 1 chơi thường (persistent không tắt)
- **Hai bộ skill khác nhau**: Set 1 spear melee, Set 2 bow ranged — 1 char 2 vai trò
- ⚠ Build minion/companion: swap set **gọi lại companion + minion**, một số desync Spirit không resummon hết map → khớp Spirit 2 set để tránh companion tắt khi swap

## Relationships

- **related_guides** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — Spirit pool thay đổi theo set active; prerequisite để setup dual-set an toàn
- **related_guides** [Skill gem và Support gem: hệ thống Uncut Gem của POE2](/guides/beginner-skill-gem) — cơ chế gắn gem vào equipment, cần biết trước khi assign gem cho từng set
- **related_guides** [Phần thưởng quest vĩnh viễn](/guides/beginner-quest-rewards) — 24 Weapon Set Passive Skill Points từ campaign, mỗi set active riêng cây node
- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build giữ Parry setup ở set 2 nhưng chơi no-swap vì swap làm cả đàn despawn
