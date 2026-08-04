---
template: templates/guide-template.md
document_type: guide
title: "Salvage Bench và Disenchant: cách thu hồi currency từ item cũ"
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
  - crafting
  - currency
  - salvage
---

# Salvage Bench và Disenchant: cách thu hồi currency từ item cũ

2 cơ chế thu currency từ equipment cũ: **salvage** (quality currency + Artificer's Shard), **disenchant** (orb shard theo rarity).

## Salvage Bench
- :wiki-link{url="https://www.poe2wiki.net/wiki/Salvage_Bench"} mở sau quest **Finding the Forge** (Act 1): giao **Smithing Tools** cho Renly (NPC weapon/armour @ Clearfell Encampment) — side quest sớm nhất, thường nửa đầu Act 1
- Mở xong → tồn tại vĩnh viễn mọi town + hideout, không cần làm lại
- Salvage được: equipment có quality hoặc rune socket. KHÔNG salvage được: **gem** + **jewellery** (ring/amulet/belt) dù có quality; Normal không quality/socket → 0 currency

## Salvage cho currency gì

| Loại item | Currency |
|-----------|----------|
| Martial weapon (sword/axe/mace/spear/bow/crossbow...) | :wiki-link{url="https://www.poe2wiki.net/wiki/Blacksmith%27s_Whetstone"} |
| Wand / staff / sceptre | :wiki-link{url="https://www.poe2wiki.net/wiki/Arcanist%27s_Etcher"} |
| Armour + off-hand (helm/chest/gloves/boots/shield/focus/quiver) | :wiki-link{url="https://www.poe2wiki.net/wiki/Armourer%27s_Scrap"} |
| Flask + charm | :wiki-link{url="https://www.poe2wiki.net/wiki/Glassblower%27s_Bauble"} |

- Whetstone/Etcher/Scrap tăng quality cho đúng loại item tương ứng; Bauble cho flask + charm
- Số lượng: **5% quality → 1x currency** (20% = 4x, 15% = 3x); phần lẻ giữa mốc 5% có xác suất thêm 1x (17% → 3x hoặc 4x)
- Mỗi **rune socket** → +1x :wiki-link{url="https://www.poe2wiki.net/wiki/Artificer%27s_Shard"} (10 shard = :wiki-link{url="https://www.poe2wiki.net/wiki/Artificer%27s_Orb"}) → item có socket luôn đáng salvage dù quality 0

## ✗ Rune trong socket bị phá hủy khi salvage
- Bất kỳ :wiki-link{url="https://www.poe2wiki.net/wiki/Rune"} đang cắm sẽ **phá hủy hoàn toàn** khi salvage, bench không hỏi lại
- ✓ Trước khi salvage: right-click item → Remove Rune (tốn phí nhỏ, giữ rune nguyên) — quên gỡ = lỗi tốn tiền nhất

## Disenchant (bán vendor lấy orb shard)
- Bán vào **vendor Disenchanter** (caster/trinket vendor mỗi town: Una @ Act 1, Zarka @ Act 2, Servi @ Act 3...) → nhận shard theo rarity:

| Rarity | Shard |
|--------|-------|
| Magic | 1x :wiki-link{url="https://www.poe2wiki.net/wiki/Transmutation_Shard"} (10 = Orb of Transmutation) |
| Rare | 1x :wiki-link{url="https://www.poe2wiki.net/wiki/Regal_Shard"} (2x nếu item ≥6 mod; 10 = Regal Orb) |
| Unique | 1x :wiki-link{url="https://www.poe2wiki.net/wiki/Chance_Shard"} (10 = Orb of Chance) |

- Normal không disenchant được → bán Gold

## Khi nào dùng cái nào
- Item, quality >0% HOẶC ≥1 socket → **Salvage Bench** (Scrap/Whetstone + Artificer's Shard)
- Magic/Rare/Unique không quality + không socket → **disenchant** (Regal Shard vẫn hơn Gold)
- Normal → bán **Gold**

## Relationships

- **related** [Currency cơ bản của POE2](/guides/beginner-currency) — Transmutation/Regal/Chance Shard tích từ disenchant dùng vào crafting
- **related** [Rune và augment socket](/guides/beginner-runes) — Artificer's Shard từ salvage → Artificer's Orb thêm socket; nhớ gỡ rune trước khi salvage
- **related** [Crafting cơ bản](/guides/beginner-crafting-basics) — quy trình dùng Whetstone/Scrap/Etcher/Bauble khi craft
