---
template: templates/guide-template.md
document_type: guide
title: "Flask: cách dùng bình hồi và hệ thống charge"
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
  - flask
  - charm
  - survival
  - life-flask
  - mana-flask
---

# Flask: cách dùng bình hồi và hệ thống charge

:wiki-link{url="https://www.poe2wiki.net/wiki/Flask"} = bình hồi tái sử dụng chạy trên charge (không phải potion 1 lần). Quản charge = kỹ năng sống sót đầu tiên.

## Charge chỉ nạp từ kill
- Charge KHÔNG regen theo thời gian → chỉ nạp khi giết quái
- Quái thường: ít nhất · magic: nhiều hơn · rare/unique: nhiều nhất (1 rare ≈ hàng chục quái thường)
- **Well** (town) + **Checkpoint** (dungeon) → nạp đầy flask khi kích hoạt
- Vào boss room charge cạn = tay không → clear pack trước boss để nạp; wipe → về checkpoint nạp lại trước khi vào lại

## Đổi flask base mỗi vài act
- :wiki-link{url="https://www.poe2wiki.net/wiki/Life_flask"} có tier theo level, tier sau hồi nhiều Life hơn; đủ level cho tier mới → ghé vendor đổi ngay (base rẻ, không cần chờ drop)

| Tier | Level | Tier | Level |
|------|-------|------|-------|
| Lesser | 1 | Colossal | 30 |
| Medium | 4 | Gargantuan | 40 |
| Greater | 10 | Transcendent | 50 |
| Grand | 16 | Ultimate | 60 |
| Giant | 23 | | |

- :wiki-link{url="https://www.poe2wiki.net/wiki/Mana_flask"}: đổi nếu build tiêu mana nhiều · spellcaster cần · physical/minion ít cần

## Roll modifier bằng orb
- Flask chỉ 3 rarity: normal (trắng) · magic (xanh) · unique — KHÔNG có rare flask
- Normal không có mod → :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Transmutation"} → magic (1 mod); magic 1 mod → :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Augmentation"} → thêm mod 2
- Mod đáng chú ý: **increased Amount Recovered** · **reduced Charges per use** (dùng nhiều lần hơn) · **Instant Recovery** (hồi tức thì — mạnh nhất cho boss khi bị hit liên tục)
- Roll xấu → mua normal base mới từ vendor rồi Transmute lại (base rẻ ≈ free)

## Charm = hệ riêng, không phải flask
- :wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} KHÔNG kích hoạt tay → tự bật khi trúng điều kiện: Ruby Charm ↔ ăn fire damage · Thawing Charm ↔ freeze · Stone Charm ↔ stun
- Charm slot từ **belt**, tách biệt slot flask: belt ilvl <30 → 1 slot · 30–59 → 1–2 · 60+ → tối đa 3
- Quest **Ancient Vows** → +1 charm slot
- Charge charm nạp từ kill + Well/Checkpoint như flask

## Relationships

- **related** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — flask là một lớp phòng thủ trong bức tranh toàn cảnh
- **related** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — resource mà flask đang hồi
- **related** [Ailment và status effect trong POE2](/guides/beginner-ailments) — charm chặn freeze/shock/bleed; biết ailment nào cần charm nào
- **related** [Charms cho người mới](/guides/beginner-charms) — charm system chi tiết: auto-trigger, unique charm, slot scaling
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — Ruby/Sapphire/Topaz Charm cho resistance tạm thời khi ăn hit
- **related** [Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint](/guides/beginner-campaign-structure) — Checkpoint refill Flask + Charm.
