---
template: templates/item-template.md
document_type: item
title: Facebreaker
status: published
author: duocnv
created: '2026-05-19'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
rarity: unique
item_class: Gloves
level_requirement: 38
sub_class: items
item_tags:
- gloves
- unique
- unarmed
- mace-skills
- strength-stacking
- boss-tracking
- remake
tags:
- item
- unique
- gloves
- 0-5
- return-of-the-ancients
- facebreaker
- unarmed
- mace
- strength
---

# Facebreaker

:wiki-link{url="https://www.poe2wiki.net/wiki/Facebreaker"} = gloves unique Stocky Mitts (0.5.0), Level 38, 48 Strength. Hai mechanic core: **mace skill access khi tay không** (cả 2 hand slot trống → dùng toàn bộ One Hand Mace skill pool) + **boss teeth tracker** (mỗi world boss campaign kill cộng added physical damage tích lũy). Strength double-duty: damage qua "1% more Unarmed Damage per 5 Strength" + phòng thủ qua "+1 to Armour per Strength".

## Item Stats

```
Facebreaker
Stocky Mitts
Armour: ~15 (tăng theo Strength qua +1 to Armour per Strength)
Requires Level 38, 48 Str

Has 8 to 12 Physical damage, +3 to +4 per Boss's Face Broken
(30–50)% increased Stun Buildup
1% more Unarmed Damage per 5 Strength
+0.3 metres to Melee Strike Range while Unarmed
+1 to Armour per Strength
Can Attack as though using a One Handed Mace while both of your hand slots are empty
Unarmed Attacks that would use an Equipped One Hand Mace's damage use this Item's damage

"You think us savages?" mused the Red Wolf, as
he pulled teeth from the Eternal's skull. "I will
show your kind the way of tooth and claw."
```

Drop: The Market.

## Why it matters

- **Boss teeth**: "Boss's Face Broken" = counter world boss pulverised trong campaign. Mỗi kill +3 đến +4 added physical damage lên base 8–12. Counter **per character** (không phải account) — char mới farm lại. Map boss Endgame **không count**. Đây là con số mọi mace skill scale từ khi tay không (từ item, không từ weapon).
- **Offensive — 1% more Unarmed Damage per 5 Strength**: "more" nhân tử riêng, không gộp pool "increased" tree. @300 Str: 60% more = ×1.60; @500 Str: 100% more = ×2.0 lên toàn bộ unarmed damage, trên nền boss teeth.
- **Defensive — +1 to Armour per Strength**: flat Armour thêm trước % increased tree. @500 Str: +500 Armour ngoài base ~15. :wiki-link{url="https://www.poe2wiki.net/wiki/Titan"} Titan (nhiều node Armour% increased) nhân flat này lên.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Strength"} POE2 tự base 2 max life + 0.2% melee damage/điểm → + 2 mod Facebreaker = triple-dip stat.
- **Mace skill access unarmed**: POE2 gate mace skill theo weapon class — :wiki-link{url="https://www.poe2wiki.net/wiki/Hammer_of_the_Gods"} Hammer of the Gods, :wiki-link{url="https://www.poe2wiki.net/wiki/Sunder"} Sunder, :wiki-link{url="https://www.poe2wiki.net/wiki/Boneshatter"} Boneshatter, :wiki-link{url="https://www.poe2wiki.net/wiki/Earthshatter"} Earthshatter, :wiki-link{url="https://www.poe2wiki.net/wiki/Leap_Slam"} Leap Slam đều require mace equipped. Facebreaker xóa requirement khi 2 hand slot trống. "weapon damage" lấy từ số Facebreaker (8–12 + boss teeth), không phải mace thật → skill scale theo Facebreaker flat × Strength multiplier, độc lập weapon item level/quality (không cần chase mirror-tier mace).
- `Exclusion check:` cả 2 hand slot phải trống — bất kỳ weapon (bow, 2H staff, dual-wield) → mất toàn bộ cơ chế.

## Way of the Stonefist → Fists of Stone

:wiki-link{url="https://www.poe2wiki.net/wiki/Way_of_the_Stonefist"} (Martial Artist ascendancy notable) **KHÔNG** amplify Facebreaker mà **chuyển đổi hoàn toàn** base type gloves đang mang sang Fists of Stone — bộ mod khác:

- Damage Physical → Fire, base cao hơn Facebreaker gốc.
- Scaling stat Strength → Intelligence ("more" per 5 Int thay per 5 Str).
- Thêm increased Area of Effect for Unarmed Attacks per Intelligence.
- Evasion + ES scale theo player level, không cần gear.
- Grant thêm skill Smash to Smithereens.
- Stun Buildup mod + "+1 to Armour per Strength" biến mất — không còn defensive layer từ Strength.
- Boss teeth counter + mace access clause **giữ nguyên** qua transformation.

## Tương tác Hollow Palm Technique

- :wiki-link{url="https://www.poe2wiki.net/wiki/Hollow_Palm_Technique"} keystone cho dùng quarterstaff skill khi tay không, base damage riêng. Coexist: Facebreaker cấp base cho One Hand Mace skill; Hollow Palm cấp base cho Quarterstaff skill.
- Skill dùng được cả mace lẫn quarterstaff → **Facebreaker's flat damage ưu tiên**, Hollow Palm flat không áp. Attack speed + crit chance từ Hollow Palm (qua Evasion Rating) vẫn hoạt động. Phải phân biệt skill nào qua mace-gate, skill nào qua quarterstaff-gate.

## Build usage

- **Warrior / Titan strength-stacking** (Facebreaker gốc): max Strength (tree/gear/jewel). Mace pool: Hammer of the Gods / Sunder cho AOE, Boneshatter single target. Titan có node Strength → Area of Effect. Defense từ +1 Armour/Str tự grow.
- **Monk / Martial Artist (Stonefist)**: Way of the Stonefist transform → Fists of Stone; mace pool vẫn mở nhưng damage fire scale Intelligence. Evasion/ES tự tăng theo level (mạnh phase leveling không cần gear). Transformation → mất stun buildup + str-armour mod.

## Common Mistakes

- ✗ Boss teeth count map boss Endgame → chỉ campaign boss, per character.
- ✗ Đặt weapon vào 1 hand slot mong mace skill chạy → cần cả 2 hand slot trống, không exception.
- ✗ Nghĩ Way of the Stonefist "mạnh hơn Facebreaker gốc" → không cường hóa, biến thành bộ mod khác (Str→Int, physical→fire). Two separate archetypes, không phải upgrade path.
- ✗ Nhầm "1% more per 5 Strength" với "increased" → more là nhân tử riêng; @500 Str = ×2.0 nhân với mọi "increased".

## Version History

### Patch 0.5.1
- Fixed a bug where Attack Damage gained as extra Physical Damage Modifiers on Fists of Stone were not functioning unless the gloves also had an Attack Damage gained as extra Lightning Damage Modifier.

### Patch 0.5.0 (Return of the Ancients)
- New Unique item: Facebreaker. POE2 remake từ POE1 — thay flat unarmed damage multiplier bằng mace skill access + boss teeth progression tracker + strength double-duty. Đi kèm Way of the Stonefist (Martial Artist) transform item thành Fists of Stone cho Intelligence archetype.

## Relationships

- **synergizes_with** [The Auspex](/guides/the-auspex) — body slot unique cùng patch, synergy qua Monk Martial Artist Stonefist path.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview patch 0.5.0, các unique mới.
