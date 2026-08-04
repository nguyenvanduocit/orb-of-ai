---
template: templates/mechanic-template.md
document_type: mechanic
title: Amor Mandragora
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
  - talisman
  - poe2
  - mechanic
---

# Amor Mandragora

Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Changeling_Talisman"} Changeling Talisman — 2H weapon Druid-only, Level 1 (equip từ đầu campaign). Trục = :wiki-link{url="https://www.poe2wiki.net/wiki/Druidic_Prowess"} loop Rage ↔ Skill Speed. User chính: Shaman + Druid spell/Rage hybrid, campaign → early endgame.

## Chỉ số

```
Amor Mandragora
Changeling Talisman
Physical Damage: (25-29) to (38-42)
Critical Hit Chance: 8%
Attacks per Second: 1.25
Weapon Range: 1.2 metres
Requires: Level 1
──────────────────────────────────────────────
Adds (16-20) to (23-27) Physical Damage
+(8-15) to Intelligence
(10-15)% increased Skill Effect Duration
Enemies in your Presence are Hindered
Gain 1 Druidic Prowess for every 20 total Rage spent
──────────────────────────────────────────────
"A sensitive few among the first settlers of Ezomyr
followed the wisps by canoe. On a misty forested
island, Cirel of Tarth stood waiting to greet them."
```

## Druidic Prowess loop

- Stacking buff, cap **3 lớp**, mỗi lớp timer 10s độc lập. Mỗi 20 total Rage spent (skill/warcry/passive cost) → +1 lớp.
- 1 lớp: +10% :wiki-link{url="https://www.poe2wiki.net/wiki/Skill_Speed"} Skill Speed · spell hit grant 3 Rage
- 2 lớp: +20% Skill Speed · spell hit grant 6 Rage tổng
- 3 lớp: +30% Skill Speed · spell hit grant 9 Rage tổng
- Buff xuyên weapon swap. Skill Speed POE2 = attack + cast + warcry speed cùng lúc (một multiplier chung, không tách loại) → build mix slam+warcry+spell ăn cả ba.
- Self-sustain = spend Rage + cast spell đều. Vd Shaman + :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Cry"} Infernal Cry: warcry tiêu Rage qua :wiki-link{url="https://www.poe2wiki.net/wiki/Furious_Wellspring"} Furious Wellspring (Skills have +5 to Rage cost) → 60 Rage spent = 3 lớp → cast spell → mỗi hit trả 3 Rage/lớp (9 tại 3 lớp).
- Rate-limit: **1 hit / 0.5s** mới trigger Rage gain — luật Rage cơ bản, áp mọi nguồn Rage-from-hit kể cả Prowess. Cast speed thường vẫn đủ gom 20 Rage/10s → loop giữ, nhưng phải hit bằng spell đều (không tự nạp passive).
- Cap 3 lớp; lớp chỉ refresh khi tiếp tục spend Rage; ngưng spend → mất lớp sau 10s.

## Hinder / Duration / Int

- "Enemies in your :wiki-link{url="https://www.poe2wiki.net/wiki/Presence"} Presence are :wiki-link{url="https://www.poe2wiki.net/wiki/Hinder"} Hindered" → 30% reduced movement speed mọi enemy trong Presence, passive không trigger. Chỉ movement, không đụng attack/cast speed enemy.
- (10–15)% increased Skill Effect Duration → dài buff/debuff/duration skill (shapeshift form, warcry uptime, :wiki-link{url="https://www.poe2wiki.net/wiki/Temporal_Chains"} Temporal Chains). KHÔNG kéo timer Prowess 10s (buff mechanic ≠ "skill effect").
- +(8–15) Int → stat cho tree + gem req (Discipline, spell gem, curse), không dead slot.

## Build usage

- Shaman = user rõ nhất: :wiki-link{url="https://www.poe2wiki.net/wiki/Commanding_Rage"} Commanding Rage (mỗi 5 Rage → 2% increased Minion Attack Speed) + :wiki-link{url="https://www.poe2wiki.net/wiki/Druidic_Champion"} Druidic Champion (Every 2 Rage → 1% more Spell damage) → Rage = stat offensive.
- Bear/Werewolf shapeshifter phys: 30% Skill Speed scale slam/strike (Skill Speed→attack speed); Hinder QoL khi melee sát boss.
- Base không endgame: :wiki-link{url="https://www.poe2wiki.net/wiki/Maji_Talisman"} Maji Talisman (Lv79) là đích pDPS endgame. Amor tốt nhất campaign → maps thấp/mid. Chanceable từ mọi Changeling Talisman (drop anywhere).
- Watch: broad attack/cast/warcry multiplier = GGG dễ để mắt adjust.

## Version History

### Patch 0.4.0
- Ra mắt. Drop anywhere, chanceable.

## Relationships

- **related_mechanics** [Talisman crafting](/crafting/talisman-crafting) — weapon class Talisman cho Druid, base tier hierarchy, Runeforging workflow.
- **related_builds** [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) — Shaman Rage + warcry, user chính của Amor ở meta 0.5.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5, Runeforging.
