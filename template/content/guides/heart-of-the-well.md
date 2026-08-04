---
template: templates/mechanic-template.md
document_type: mechanic
title: Heart of the Well
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
sub_class: items
tags:
  - item
  - unique
  - jewel
  - desecrated
  - charm
  - poe2
  - mechanic
---

# Heart of the Well

Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Diamond"} jewel, Limited to 1, cắm vào allocated jewel socket. Không mod cố định: luôn drop kèm **4 dòng :wiki-link{url="https://www.poe2wiki.net/wiki/Desecrated_Modifier"} chưa reveal** — 2 prefix + 2 suffix — roll từ pool riêng của item: **73 modifier (35 prefix, 38 suffix)**, phần lớn không roll được trên rare jewel thường. Drop-restricted, không :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"} ra được, chỉ rớt từ Lichborn :wiki-link{url="https://www.poe2wiki.net/wiki/Rogue_exile"} trong :wiki-link{url="https://www.poe2wiki.net/wiki/Abyss"} encounter (ra mắt 0.3, core Abyss drop 0.5). Sample top-XP poe.ninja 0.5: unique slot nhiều nhất — **49,5% character**.

## Item khi chưa reveal

```
Heart of the Well
Diamond
Limited to: 1
--------
<Custom Desecrated prefix>
<Custom Desecrated prefix>
<Custom Desecrated suffix>
<Custom Desecrated suffix>
--------
"Countless souls scream in agonising harmony,
forever sinking under the weight of the newly dead."
```

- 4 slot Desecrated chiếm chỗ ngay cả chưa reveal → copy chưa reveal đã cố định 2 prefix + 2 suffix, chỉ chưa biết mod. Toàn bộ giá trị nằm ở pool reveal, không base stat khác trên Diamond.

## Cơ chế Desecration

- Reveal tại :wiki-link{url="https://www.poe2wiki.net/wiki/Well_of_Souls"} ở Act 2, hoặc the Well of Souls trên Atlas (hiện sau khi hoàn thành Abyss encounter đầu). Mỗi lần reveal 1 slot → game offer **3 lựa chọn mod đúng loại slot** (đều từ pool 73-mod của item), chọn 1.
- Không phải gamble mù. Steer thêm: :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Abyssal_Echoes"} kích trong inventory trước reveal → reroll 3 option **một lần** (1 slot xem tới 6 mod). Atlas passive :wiki-link{url="https://www.poe2wiki.net/wiki/Blessing_of_the_Source"} thêm chance drop với dòng Desecrated thứ 5 → trần 5 mod thay vì 4.
- Reveal xong = **commit**, không desecrate lại được. Workflow: mang tới Well of Souls, reveal từng slot, ngắm 3 option chốt dòng hợp build, dùng Omen cho prefix quan trọng nếu 3 option đầu vô dụng.

## Vì sao ~nửa meta slot nó

- **Pool exclusive** (rare không cho): prefix "Gain (9-15)% of Damage as Extra Fire / Cold / Lightning Damage" và "Gain (7-13)% of Damage as Extra Chaos Damage" — lấy phần damage mỗi hit cộng thành element bất kể build đánh type gì → mọi build hit-based đều ăn. 2 slot prefix → ngắm 2 dòng extra-element khác type cùng lúc. Cùng pool prefix có (40-60)% increased Armour / Energy Shield / Evasion Rating from Equipped Body Armour và (30-50)% chance to :wiki-link{url="https://www.poe2wiki.net/wiki/Pierce"} an Enemy.
- **Reveal agency**: chọn-1-trong-3 + Omen reroll → steer về cụm chase thay vì phó RNG. Tổ hợp scaling-độc-quyền + lái được (không phải bản thân jewel socket) = lý do thống trị.

## Ngắm mod nào khi reveal

- **Hit-based bất kỳ:** 2 prefix extra-element Fire/Cold/Lightning (9-15)% hoặc Chaos (7-13)% — universal nhất, lý do chính 49,5%.
- **Projectile:** (30-50)% chance to Pierce.
- **Body base defense lớn:** (40-60)% increased Armour/ES/Evasion from Equipped Body Armour (% áp lên body base → base to càng đáng).
- **:wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} companion:** prefix "(15-25)% increased Damage while your :wiki-link{url="https://www.poe2wiki.net/wiki/Companion"} is in your :wiki-link{url="https://www.poe2wiki.net/wiki/Presence"}". `Exclusion check:` chết với build không field companion; extra-element prefix vẫn ăn (companion damage cũng hit).
- **:wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} build:** (10-15)% chance dùng Charm → dùng thêm 1 Charm không tốn charge, (15-25)% increased Charm Effect, Recover (5-10)% max Mana mỗi lần dùng Charm.
- **Minion:** Minions gain (10-15)% max Life as Extra ES, +(3-4)% all Elemental Resistances, regen + phys damage reduction.
- **Suffix (2, utility nhỏ):** +1% max Fire/Cold/Lightning Resistance, (4-8)% increased Crit Hit Chance hoặc (6-12)% increased Crit Damage Bonus, (2-3)% increased Attack/Cast Speed, Gain additional Ailment Threshold = (4-10)% max ES. Magnitude thấp — bonus phụ, không gánh damage.

## Ràng buộc & mặt trái

- Pool prefix ~35 dòng, mỗi reveal 3 option → dòng chase không đảm bảo xuất hiện lần đầu. Omen reroll 1 lần tăng cơ hội không bảo đảm; copy "hoàn hảo" 2 extra-element prefix cần may/nhiều copy. Roll sample poe2db: 1 copy ra +1% max Lightning Res, 12% Cooldown Recovery Rate, 14% Mana Cost Efficiency, Debuffs expire 6% faster — 4 dòng utility vặt, đúng giá của reveal không ngắm.
- Reveal = commit; drop-restricted + không chance được, chỉ farm Lichborn exile trong Abyss.
- Nhiều mod conditional: charm/companion/body-armour/minion mod = 0 nếu build không có feature đó. "Gain % as Extra Element" chỉ feed hit-based — DoT/ailment thuần ăn rất ít.
- Khi vào league: log trung bình bao nhiêu reveal + omen để chốt 2 extra-element prefix khác type, và dòng Desecrated thứ 5 từ Blessing of the Source có đáng atlas point không.

## Version History

### Patch 0.3.0 (Rise of the Abyssal)
- Item introduced cùng cơ chế Abyss + Desecrated modifier. Drop từ Lichborn exile, pool Desecrated riêng. Vẫn core Abyss drop trong 0.5 Runes of Aldur, đứng đầu usage jewel slot sample top-XP poe.ninja league 0.5.

## Relationships

- **related** [Unique Items Mới](/guides/0-5-new-unique-items) — thống trị jewel slot dù là item core từ Abyss (0.3), không nằm trong 42 unique mới 0.5.
- **synergizes_with** [Spirit Walker — Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — prefix "increased Damage while Companion in Presence" ngắm thẳng cho companion build.
- **farming_relevance** [Abyss Monster Rarity và Fractured Waystone Farm](/farming/0-5-abyss-monster-rarity-fracture-farm) — jackpot của biến thể faction; strategy này không phụ thuộc.
- **farming_relevance** [Abyss Ulaman và Amanamu Farm](/farming/0-5-abyss-ulaman-amanamu-farm) — unique Diamond jewel rớt từ Lichborn Rogue Exile, jackpot của strategy (49,5% top-XP character đeo).
