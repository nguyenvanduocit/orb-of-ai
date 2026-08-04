---
template: templates/mechanic-template.md
document_type: mechanic
title: Flux resistance conversion
status: published
author: duocnv
created: '2026-06-12'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: crafting
tags:
  - flux
  - crafting
  - resistance
  - chaos-resistance
  - remnant
  - runes-of-aldur
  - poe2
  - mechanic
---

# Flux resistance conversion

:wiki-link{url="https://www.poe2wiki.net/wiki/Flux"} = họ currency 0.5.0, đập 1 lần lên magic/rare → đổi loại resistance của mọi explicit mod sang element khác. Dùng cân res lệch element + mở chaos res một slot mà roll tự nhiên không cho.

## Cơ chế

- Stackable currency (stack 10), drop level 65, exclusive Runes of Aldur. Right-click Flux → left-click magic/rare item; no bench, no NPC.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Blazing_Flux"} → mọi Cold+Lightning Res mod → Fire Res
- :wiki-link{url="https://www.poe2wiki.net/wiki/Chilling_Flux"} → mọi Fire+Lightning Res → Cold Res
- :wiki-link{url="https://www.poe2wiki.net/wiki/Crackling_Flux"} → mọi Fire+Cold Res → Lightning Res
- :wiki-link{url="https://www.poe2wiki.net/wiki/Void_Flux"} → mọi Fire+Cold+Lightning Res → Chaos Res

Luật transform (4 điểm):
1. Chỉ **explicit modifier** bị đổi — implicit (ring/amulet) đứng yên.
2. Đổi sang tier tương đương nhưng giá trị **reroll trong band tier mới** (không copy số cũ) → Divine lại nếu cần đỉnh band.
3. Item ra lò có thể mang **nhiều mod cùng loại res**: 2 suffix (T3 cold + T3 lightning) + Blazing → 2 suffix T3 fire cùng item (roll tự nhiên cấm).
4. **Hybrid mod đổi phần element, giữ phần còn lại**: "Fire and Chaos Res" + Chilling → "Cold and Chaos Res".

Ví dụ:
- Amulet fire→cold (Chilling): chỉ dòng fire→cold, roll lại band 31-35 (34→33); life/mana/spirit không đổi.
- Sapphire Ring (implicit cold 25%) + suffix fire 39 (band 36-40) / lightning 44 (41-45) + Chilling → cold 38 + cold 43 + implicit = **106% cold res một slot**.
- Boots cold 27 (26-30) / lightning 36 (36-40) + Void → chaos 18 (16-19) + chaos 22 (20-23) = **+40% chaos một slot, mất 63 ele res** (đập gear đang đeo = thủng cap).

## Bảng equivalency

- **ele → ele**: band giữ nguyên 1-1 (6-10→6-10, 21-25→21-25, 41-45→41-45).
- **ele → chaos** (Void), band rớt ~1/3:

| ele res | → chaos res |
|---|---|
| +(6-10)% | +(4-7)% |
| +(16-20)% | +(12-15)% |
| +(31-35)% | +(20-23)% |
| +(41-45)% | +(24-27)% |

- +1/2/3% to Maximum Resistance đổi 1-1 (kể cả sang Maximum Chaos Resistance).
- Jewel mod "Notable Passive Skills in Radius also grant +(5-7)% to X Resistance" nằm trong bảng → flux dùng được trên jewel magic/rare.

## Đập an toàn

- Flux chỉ chạm explicit resistance mod → life/ES/damage/MS không bao giờ bay.
- Mất 3 chỗ: (1) roll lại trong band mới, có thể về đáy — cứu bằng Divine Orb; (2) mất element cũ, một chiều không undo — đập gear đang gánh res = thủng cap; (3) đổi tất cả res mod cùng element, không chọn lọc dòng.
- Quy trình: test viên rẻ lên item rác trước → cộng trừ delta res trên giấy trước khi đập gear đang đeo → ưu tiên đập item mới mua lệch element rồi mới lắp.
- Char: chaos ~25 là lỗ res duy nhất còn lại trên [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack); Void Flux mở đường mua ring/boots ele-res rẻ → tự đổi chaos thay vì trả premium.

## Craft từ Remnant + giá

- Nguồn duy nhất = Runic Recipe trên Remnant, area level 70+, khắc combo 6 rune, thắng encounter = 1 viên. Cần Remnant ≥6 slot (hiếm hơn 2-3 slot) → tự craft chỉ đáng khi đằng nào cũng farm Remnant.
- Blazing = Fire + Earth + Prismatic + Soul + Rage + Rebirth Rune
- Chilling = Cold + Cyclonic + Prismatic + Death + Tidal + Moon Rune
- Crackling = Lightning + Celestial + Prismatic + Electrocuting + Oath + Tempest Rune
- Void = Toxic + Time + Adaptive + Soul + Power + Death Rune (3 ele Flux ăn Prismatic + rune đúng element; Void đi rune riêng chaos).
- Giá poe2scout 2026-06-12: Blazing 6.4 ex (537 listing) · Chilling 6.2 ex (586) · Crackling 3.1 ex (609) · Void 19.3 ex (438). Currency Exchange volume 24h: ~16,000 Blazing, ~11,000 Void. Void đắt 3-6× (chaos res là lỗ phổ quát); Crackling rẻ nhất (lightning res dễ cap).

## Anti-patterns

- ✗ "+#% to all Elemental Resistances" — miễn nhiễm, không trong bảng, flux bỏ qua.
- ✗ Implicit không đổi (Ruby/Sapphire/Topaz Ring implicit không flux được).
- ✗ Unique item không nhận flux — chỉ magic/rare.
- ⚠ Fractured res mod hiện VẪN bị flux đổi (ngược định nghĩa fractured, nhiều khả năng bug) — đừng xây plan quanh nó, đừng flux item có fractured res muốn giữ.

Verdict: **EXPLOITABLE**. 4 viên 3-19 ex giải cân res lệch + stack nhiều suffix cùng res (chaos 100%+ một slot). Trần = bảng equivalency (ele→ele giữ band, ele→chaos discount 1/3). Open: fractured tương tác bug/intended (theo dõi GGG known issues); Flux có đi core sau Runes of Aldur? Chưa test corrupted item.

## Version History

### Patch 0.5.0
- Flux ra mắt cùng Runes of Aldur (21/05/2026). Patch note ghi "3 Fluxes" (ba ele); in-game thêm Void Flux = bốn. 0.5.1/0.5.2 không đụng Flux.

## Relationships

- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Flux craft từ Remnant, nhánh crafting Verisium league.
- **references** [Patch Notes 0.5.0](/guides/0-5-0-patch-notes) — dòng patch note gốc giới thiệu họ Flux.
- **used_by** [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack) — Void Flux vá lỗ chaos res ~25 của char.
