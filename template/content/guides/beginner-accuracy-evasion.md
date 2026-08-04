---
template: templates/guide-template.md
document_type: guide
title: "Accuracy và Evasion: tấn công có chắc trúng không?"
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
  - accuracy
  - evasion
  - dexterity
  - attack
---

# Accuracy và Evasion: tấn công có chắc trúng không?

:wiki-link{url="https://www.poe2wiki.net/wiki/Accuracy_Rating"} quyết định attack có trúng không. Thiếu Accuracy → miss hoàn toàn (tốn mana, 0 damage, không trigger ailment/on-hit), không phải giảm damage từ từ.

## Accuracy chỉ tính cho attack

- Skill tag **Attack** (Whirling Slash, Spear Throw, Boneshatter, bow attack) → cần Accuracy.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Spell"} (Fireball, Lightning Conduit…) → always-hit, bỏ qua hit/miss.
- Minion → always-hit, không cần Accuracy.
- Class cần lo: Ranger, Huntress, Mercenary, mọi attack build.

## Nguồn Accuracy

- +6 Accuracy Rating / character level → lv90 = 540 base từ level.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Dexterity"}: +6 Accuracy / point. 200 Dex → +1.200 Accuracy.
- Flat roll trên gear; Emerald Ring có Accuracy Rating là implicit.
- Passive node.
- Support :wiki-link{url="https://www.poe2wiki.net/wiki/Heightened_Accuracy_I"}: 50% more Accuracy Rating.

## Hit chance = công thức Accuracy vs Evasion

- **Chance to Hit = (Accuracy × 1.25 × 100) / (Accuracy + Evasion × 0.3)** — cap 100%, floor 5%.
- Ví dụ 1.000 Acc vs 2.000 :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion_Rating"}: 125.000 / 1.600 ≈ 78%. Nâng 1.500 Acc → ~83%.
- Diminishing return: thấp→trung nhảy nhiều, trung→cao nhảy ít.

## Evasion dùng entropy, không random thật

- Mỗi hit cộng hit chance vào counter ẩn; đạt 100 → hit trúng, trừ 100, tiếp. Reset random sau 3.33s không bị đánh.
- 50% evade → đúng 2 hit trúng 1, không streak xui/may.
- Boss attack có flash đỏ KHÔNG bị Evasion né → phải dodge roll hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Block"} chủ động.

## Distance penalty (ranged)

- ≤2m: không penalty. >9m: tới 90% less Accuracy.
- 90% less = multiplier: Accuracy thực = base × (1−0.9) = 10%. 1.000 base @9m+ → 100 effective, hit chance tụt thê thảm.
- Bù: đầu tư Accuracy dư, hoặc mod "Accuracy is not reduced at distance" (hiếm).

## Chẩn đoán thiếu Accuracy

- Rule of thumb: Accuracy Rating ≈ 2× character level = an toàn. Lv80 → ~1.600+.
- Dấu hiệu: "Miss" floating text nhiều; single-target DPS thực < paper PoB DPS → check Dex (rẻ nhất để đẩy Accuracy).

## Relationships

- **related_guides** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — Evasion từ góc defender + entropy + Deflection.
- **related_guides** [Damage types trong POE2](/guides/beginner-damage-types) — phân biệt attack vs spell; tag nào cần Accuracy.
- **related** [Ba chỉ số cơ bản: Strength, Dexterity, Intelligence](/guides/beginner-attributes) — Dex là axis chính đẩy Accuracy (+6/point).
- **related_guides** [Kỹ thuật positioning cho bow build](/guides/0-5-bow-positioning) — cơ chế accuracy distance penalty band dựa vào.
