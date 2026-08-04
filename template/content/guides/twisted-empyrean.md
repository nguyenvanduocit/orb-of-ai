---
template: templates/mechanic-template.md
document_type: mechanic
title: Twisted Empyrean
status: published
author: duocnv
created: '2026-05-25'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: items
tags:
  - twisted-empyrean
  - unique
  - two-hand-mace
  - cold-conversion
  - mana-before-life
  - glory
  - starborn-onslaught
  - poe2
  - mechanic
---

# Twisted Empyrean

Unique Two Hand Mace trên base Aberrant Sledge (:wiki-link{url="https://www.poe2wiki.net/wiki/Twisted_Empyrean"}), Req Level 78, 163 Str. Grant Starborn Onslaught L18 — slam cold gated bởi Glory, nhảy lùi rồi phóng búa xuống như sao băng. Ba mod đặc trưng cùng phục vụ trục **mana**: "+319 maximum Mana", "Added Cold Damage = 6–10% of maximum Mana", "10% of Damage taken from Mana before Life"; cộng "Convert 100% Fire→Cold with Mace Skills" ép toàn bộ output về cold, commit hết vào mana thay life/str thuần.

## Stats

```
Twisted Empyrean
Aberrant Sledge — Two Hand Mace
Physical Damage: 144–299
Cold Damage: 166–372
Critical Hit Chance: 9.43%
Attacks per Second: 1.20
Weapon Range: 1.3 metres
Requires: Level 78, 163 Str
──────────────────────────────────────────────
Grants Skill: Level 18 Starborn Onslaught
94% increased Physical Damage
Adds 166 to 372 Cold Damage
+319 to maximum Mana
+4.43% to Critical Hit Chance
10% of Damage is taken from Mana before Life
Attacks with this Weapon have Added Cold Damage equal to 6% to 10% of maximum Mana
Convert 100% of Fire Damage with Mace Skills to Cold Damage
──────────────────────────────────────────────
"Infinite mutations over endless eons borne upon it in a singular moment."
```

## Mana làm cả damage lẫn EHP

- **Damage**: "Added Cold 6–10% of max Mana"/attack. Pool 2.000 → +120–200 cold/đòn, cộng flat cold 166–372 (Adds) = total flat cold 286–572/đòn ở pool 2.000. Pool 3.000 → riêng trục mana đã 180–300 — scale tuyến tính theo mana.
- **EHP**: "10% of Damage taken from Mana before Life" = partial :wiki-link{url="https://www.poe2wiki.net/wiki/Mind_Over_Matter"}. Hit 3.000 damage chỉ drain 300 mana. Pool mana kiêm cushion không đánh đổi offensive stat nào. Không phải full MoM 30% keystone, nhưng pool lớn thì lớp đệm đáng kể.

## Starborn Onslaught + Glory

- Cần 20 Glory để kích. Glory tích bằng Chill/Freeze enemy — mỗi lần = Power của enemy, tối đa 1 lần/0.5s/enemy. Normal ~1 Power, Unique luôn 20 Power.
- Pack: flat cold 166–372/đòn + trục mana chill nhiều enemy một swing; pack 10 = 10 Glory một đòn; APS 1.20 → đủ 20 Glory sau 2–3s. Không bottleneck.
- Boss: Unique 20 Power cố định → chill lần đầu = 20 Glory ngay, vào fight với Starborn sẵn sau một hit mở. Glory decay 2/giây nếu không tích trong 15s, nhưng đánh liên tục thì không rơi idle decay.
- Kích hoạt: Impact nhảy lùi rồi đập, +1.2s Total Attack Time, radius 2.5m, 3 Fissure kéo 8s (Fissure branch 2 lần, limit 8) + 20 Stars rơi (Star Fall = 294% Attack Damage, convert 100% phys→cold, 2m radius/star). Impact convert 70% phys→cold; Star Fall 100%. Weapon mod convert 100% fire→cold mọi mace skill → gần như toàn output là cold.

## Cold lock-in

- "Convert 100% Fire→Cold" gom mọi fire (support/passive) về cold trước khi áp → Fire Penetration, node "increased Fire Damage", support fire-tag đều vô nghĩa.
- Scale đúng: cold res reduction (:wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"}, Cold Exposure) + cold multiplier support. Starborn Onslaught tag Cold → ăn mọi modifier cold.
- Vòng tự reinforcing: cold chill → chill tích Glory → Starborn → thêm cold. Không cần nguồn Glory riêng.

## Mana sustain (mana gánh 3 việc)

- Sustain in-combat không phải vấn đề: 10% damage-taken-from-mana nhỏ (hit 500 → drain 50 mana), Int regen bù đủ.
- Áp lực thật = **reservation**: pool 2.000 reserve 30% → effective 1.400, flat cold/đòn tụt 84–140, EHP cushion giảm theo. Tính reservation như hard constraint, không afterthought.

## Anti-patterns

- ✗ Đọc "Requires: Level 1" từ datamine phụ poedb → item dùng từ Level 1. Data block gốc ghi Level 78, 163 Str (khớp req Starborn Onslaught); Level 1 là artifact data block riêng.
- ✗ Stack fire damage node vì thấy fire→cold. Convert 100% → không còn fire scale; đổ hết sang cold multiplier + cold res reduction.
- ✗ Bỏ qua reservation. Mana = offensive + defensive + resource pool đồng thời; mọi reservation cắt cả ba.
- ✗ Vào boss với 0 Glory do idle decay (2/giây sau 15s không tích). Chill một mob ngoài portal trước khi vào = 20 Glory từ đầu.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Item giới thiệu. Drop từ Expedition pinnacle boss, exclusive cho Runes of Aldur league. Drop-restricted — không chance được bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"}.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — Expedition rework tạo Expedition pinnacle boss là nguồn drop.
- **related_mechanics** [The Auspex](/guides/the-auspex) — unique cùng patch, cùng design một item gánh nhiều layer.
- **synergizes_with** [Liminal Coil](/guides/liminal-coil) — cùng nhóm unique build-enabling 0.5.
