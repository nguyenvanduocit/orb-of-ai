---
template: templates/guide-template.md
document_type: guide
title: "Ba chỉ số cơ bản: Strength, Dexterity, Intelligence"
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
  - attributes
  - stat-requirements
---

# Ba chỉ số cơ bản: Strength, Dexterity, Intelligence

Ba attribute quyết định gear/gem nào dùng được + cho bonus tự động theo point. Tìm item xịn nhưng mặc không lên = thiếu attribute.

## Bonus tự động mỗi attribute

- :wiki-link{url="https://www.poe2wiki.net/wiki/Strength"}: **+2 maximum :wiki-link{url="https://www.poe2wiki.net/wiki/Life"} / point** (150 Str → +300 Life, độc lập gear/tree) → melee stack Str = Life gián tiếp.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Dexterity"}: **+6 :wiki-link{url="https://www.poe2wiki.net/wiki/Accuracy_Rating"} / point**. (Riêng +6 Accuracy/level đến từ level up, không liên quan Dex.)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Intelligence"}: **+2 maximum :wiki-link{url="https://www.poe2wiki.net/wiki/Mana"} / point**.
- Attribute CHỈ cho 3 bonus trên. Str ≠ melee damage, Dex ≠ dodge chance, Int ≠ spell damage/cast speed — mấy cái đó từ gear mod + passive riêng.

## Attribute = requirement gear/skill

- **Str** → gear :wiki-link{url="https://www.poe2wiki.net/wiki/Armour"} (body/helm/gloves/boots Armour/hybrid) + melee weapon (sword/axe/mace/spear) + melee skill. Warrior/Marauder base Str cao nhất.
- **Dex** → gear :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion_Rating"} + ranged weapon (bow/crossbow) + ranged skill. Ranger/Huntress base Dex cao nhất.
- **Int** → gear :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} (circlet, ES body, wand, sceptre, staff). Witch/Sorceress base Int cao.
- Gear hybrid yêu cầu cả 2 attribute; một số gear endgame yêu cầu cả 3.

## Thiếu attribute → không dùng được

- Item thiếu req → highlight đỏ inventory, không kéo vào slot; tooltip dòng requirement đỏ chỉ stat thiếu.
- Gem thiếu req → gem không active dù socket đúng. Hay gặp khi lên level equip gem req cao hơn, hoặc swap gear làm attribute tụt dưới threshold.
- **Cascade unequip**: tháo item cho attribute (vd ring +30 Str) → attribute tụt → body armour hết đáp ứng req → game tự unequip → mất stat body armour.

## Tăng attribute

- Passive tree: node nhỏ +5 Str/Dex/Int hoặc +5 all Attributes; notable/keystone area +10 → +30.
- **Ring** + **amulet** dễ lấy nhất: mod `+X to Strength/Dexterity/Intelligence/all Attributes`.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Stellar_Amulet"}: **+(5-7) to all Attributes** implicit.
- Ring +30 Str thường đủ mở khóa hầu hết gear Armour endgame không cần đổi tree.

## Relationships

- **related** [Ba lớp phòng thủ: Armour, Evasion, Energy Shield](/guides/beginner-defence-layers) — mỗi attribute là req của một loại defence.
- **related** [Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — Str +2 Life/point, Int +2 Mana/point.
- **related** [Passive tree: cách phân bổ point](/guides/beginner-passive-tree) — node attribute nguồn tăng Str/Dex/Int cho gear hybrid.
- **related** [Skill gem: cách lấy và dùng](/guides/beginner-skill-gem) — gem có attribute requirement, thiếu thì không active.
- **related** [Accuracy và Evasion](/guides/beginner-accuracy-evasion) — Dex +6 Accuracy/point là axis chính của attack build.
- **related** [Đặc trưng từng class và ascendancy](/guides/beginner-classes) — attribute nào định hình class nào.
