---
template: templates/guide-template.md
document_type: guide
title: "Rune và augment socket: cách socket stat vào gear"
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
  - rune
  - augment
  - crafting
---

# Rune và augment socket: cách socket stat vào gear

Rune = augment item cắm vào **augment socket** trên weapon/armour để thêm stat, độc lập prefix/suffix. Cắm ngay từ khi nhặt, kể cả gear campaign tạm.

## Effect đổi theo slot
- :wiki-link{url="https://www.poe2wiki.net/wiki/Rune"} Ezomyte có 2 lớp stat: lớp chính (theo loại item) + lớp **Bonded** (phụ, kích khi item được trang bị)
- Ví dụ :wiki-link{url="https://www.poe2wiki.net/wiki/Lesser_Iron_Rune"}:

| Slot cắm | Effect chính |
|----------|--------------|
| Martial weapon (axe/sword/spear/mace...) | 14% increased Physical Damage |
| Wand / staff | 20% increased Spell Damage |
| Armour (body/helm/gloves/boots) | 14% increased Armour, Evasion và Energy Shield |

- **Bonded** (kích khi trang bị): Iron Rune trên armour = +10 life + +10 mana · trên martial weapon = 20% increased effect of Fully Broken Armour — nhỏ hơn lớp chính nhưng cộng dồn đáng kể
- Chọn theo build priority: damage → Iron/Desert/Glacial/Storm vào weapon · sống bền → Desert/Glacial/Storm (resistance) vào armour · leech → Body Rune vào weapon

## Cắm xong không lấy lại được
- Tooltip: *"Once socketed it cannot be retrieved but can be replaced by other Augment items"* → cắm rune mới vào cùng socket = rune cũ tự phá hủy, không cần currency clear
- :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Extraction"} giữ được rune nhưng **phá hủy item chứa nó** thay vì phá rune; hiếm + đắt, campaign khỏi lo → cứ cắm rune tốt nhất, gear ngon hơn thì bỏ cả item thay

## Socket ở đâu + Artificer's Orb
- Phần lớn item campaign có 0 socket. Item tự sinh socket khi drop: body armour + 2H weapon tối đa 2 · slot khác (helm/gloves/boots/1H/shield) tối đa 1; item map cao có thể có socket "Exceptional" extra
- Không có socket → :wiki-link{url="https://www.poe2wiki.net/wiki/Artificer%27s_Orb"} thêm 1 socket (limit theo loại vẫn giữ: body/2H max 2, còn lại max 1)
- Artificer's Orb ghép từ **10 :wiki-link{url="https://www.poe2wiki.net/wiki/Artificer%27s_Shard"}** (từ salvage gear tại Salvage Bench) → thứ tự: salvage tích 10 shard → craft orb → thêm socket → cắm rune. Chi tiết [salvage](/guides/beginner-salvage-disenchant)

## Tier rune + upgrade ở Reforging Bench

| Tier | Level req | Effect (Iron Rune) | Drop |
|------|-----------|--------------------|------|
| Lesser | 0 | 14% inc Phys | nhiều nhất, Act 1-2 |
| Regular | 15 | 16% inc Phys | mid-campaign+ |
| Greater | 30 | mạnh nhất | tier map cao |

- Ngoài 3 tier trên có **Endgame rune** (drop ở map, không upgrade lên nữa, limit 1/char mỗi loại — equip trùng loại thì cái sau disabled)
- Leo tier nhanh: mang 3 rune cùng loại ra :wiki-link{url="https://www.poe2wiki.net/wiki/Reforging_Bench"} → 3 Lesser Iron → 1 Iron; 3 Iron → 1 Greater Iron

## Ezomyte Rune ≠ Aldur Rune ≠ Runic Ward
- **Ezomyte Rune**: drop tự nhiên từ đầu game, bỏ vào socket (phần trên)
- **Aldur Rune** (= Ancient Rune): chỉ từ Remnant encounter + Runic Recipe unlock @ Act 4, không drop tự nhiên/không ghép shard, effect endgame-specific riêng
- **Runic Ward**: defensive layer từ Verisium Runeforging (không phải item socket), kích ở 1 life, hồi độc lập — trùng tên, không chung cơ chế

## Relationships

- **related** [Salvage và disenchant](/guides/beginner-salvage-disenchant) — nguồn Artificer's Shard để craft Artificer's Orb thêm socket
- **related** [Currency cơ bản trong POE2](/guides/beginner-currency) — Aldur Rune (Ancient Rune 0.5) là loại currency đặc biệt riêng
- **related** [Crafting cơ bản](/guides/beginner-crafting-basics) — các phương pháp craft item khác ngoài rune socket
