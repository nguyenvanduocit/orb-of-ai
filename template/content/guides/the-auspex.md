---
template: templates/mechanic-template.md
document_type: mechanic
title: The Auspex
status: published
author: duocnv
created: '2026-05-19'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: items
tags:
  - item
  - unique
  - body-armour
  - mist-raven
  - gruelling-madness
  - deflect
  - low-life
  - evasion
  - delirium
  - poe2
  - mechanic
---

# The Auspex

Unique Exquisite Vest từ loot pool Delirium, grouped với :wiki-link{url="https://www.poe2wiki.net/wiki/Sadist%27s_Mercy"} Sadist's Mercy, :wiki-link{url="https://www.poe2wiki.net/wiki/Horror%27s_Flight"} Horror's Flight, :wiki-link{url="https://www.poe2wiki.net/wiki/Veilpiercer"} Veilpiercer — đều gắn The Raven Trickster, boss Delirium mới 0.5.0. Bốn cơ chế độc lập: Mist Raven đơn với vòng cull-frenzy, :wiki-link{url="https://www.poe2wiki.net/wiki/Presence"} Presence áp Gruelling Madness/giây, :wiki-link{url="https://www.poe2wiki.net/wiki/Deflect"} Deflect thành Lucky khi :wiki-link{url="https://www.poe2wiki.net/wiki/Low_Life"} Low Life, và attribute requirements nhân đôi toàn gear. Phục vụ archetype evasion-deflect chạy low life.

## Chỉ số

```
The Auspex
Exquisite Vest
Requires Level 65

Grants Skill: Level 18 Mist Raven
(210–240)% increased Evasion Rating
+(70–120) to maximum Life
100% increased Attribute Requirements
Chance to Deflect is Lucky while on Low Life
Enemies in your Presence gain 1 Gruelling Madness each second

"The boy is a bad omen," he cried. "Ravens gather
before him!" That night, a new raven appeared, and
shadowed the Auspex for the rest of his days.
```

## Mist Raven + vòng cull-frenzy

- Mist Raven = companion đơn granted trực tiếp (không swarm/skeleton/spectre slot). Command skill dive: player ra lệnh lao vào target → burst tập trung.
- Enemy bị Mist Raven cull → grant player :wiki-link{url="https://www.poe2wiki.net/wiki/Frenzy_Charge"} Frenzy Charge (POE2: 4% more damage + 4% attack/cast speed per charge). Class không có Frenzy tự nhiên (Huntress, Ranger, một số Warrior) dùng Raven làm passive charge generator.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Cull"} Cull kích ở 35% HP còn lại (enemy thường). Loop: Raven dive → enemy low HP → cull → player Frenzy → Frenzy buff Raven damage → cull nhanh hơn.

## Gruelling Madness tích trong Presence

- Mỗi giây enemy trong Presence +1 stack — slow debuff stacking không giới hạn theo thời gian đứng gần. 10s → 10 stacks, 20s → 20.
- Amplify các slow source khác cùng lúc (chill, freeze threshold, Temporal Chains, slow effect) mạnh hơn khi stacks cao.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Sadist%27s_Mercy"} Sadist's Mercy dùng Gruelling Madness ngược: apply 2–5 stacks/đòn rồi convert stacks thành Power của enemy → cơ chế đối nghịch (Auspex muốn enemy chậm hơn). KHÔNG dùng cả hai.

## Lucky Deflect khi Low Life

- Low Life POE2 = ≤35% max HP. Ở Low Life mỗi roll Deflect thành Lucky (roll 2× lấy cao hơn). Effective = 1 − (1 − p)².
  - Base 40% → **64%**
  - Base 50% → **75%**
  - Base 60% → **84%**
- Evasion cao (chest + gear) → build Deflect đạt base 40–50% dễ. Pin Low Life permanent qua reservation aura (hoặc CI 1 HP) → lucky always-on: 64–75% deflect + evasion cao = lớp thủ vững với hit nhỏ/mid.

## Attribute requirements nhân đôi (drawback thật)

- 100% increased Attribute Requirements → gấp đôi req mọi gear. Weapon 120 Dex → 240; helmet 80 Str → 160; item mixed Str/Int đòi rất nhiều.
- Hệ quả: gần như buộc thuần Dex gear — evasion armour toàn thân, weapon Dex-based (bow/dagger/claw/spear cho Huntress), ring/amulet Dex hoặc resist/life. Str/Int bị doubled req nuốt.
- Class hợp nhất = Huntress (Ranger) cap Dex tự nhiên. Str/Int class (Warrior, Witch) đầu tư attribute rất nặng.

## Build archetypes

- Core: evasion-deflect Huntress/Ranger — cap Dex, gear thuần evasion dễ, Deflect dễ đầu tư từ tree, low-life qua reservation aura sẵn pattern. Raven cull-frenzy hợp attack build (Frenzy buff cả attack speed + damage).
- Monk Martial Artist + [Facebreaker](/guides/facebreaker): concept hợp nhưng Monk = Str/Int → doubled req taxing nặng, kể cả Facebreaker (có Str req). Khả thi nhưng attribute cao hơn nhiều.
- ✗ Swarm minion build (grant đúng 1 companion). ✗ Kiter xa (mất Gruelling Madness vì không gần enemy).

## Failure modes

- **Attribute trap khi gear lên**: doubled req làm phần lớn BiS rare roll khó pass, đặc biệt weapon phys cao thường Dex+Str mixed req.
- **Low life = ngưỡng nguy hiểm**: 35% HP một hit lớn có thể one-shot. Lucky deflect giảm xác suất bị hit, không loại trừ. EHP không đủ → low-life permanent rủi ro cao T15+/Pinnacle.
- **Gruelling Madness không stack vs boss mobile**: boss teleport/rush/di chuyển liên tục thoát Presence → stacks reset/không kịp tích. Chỉ mạnh với boss đứng yên (Simulacrum Scions, Pinnacle melee-range).
- **Mist Raven cạnh tranh Spirit**: nhiều aura reservation + Trusted Kinship, thêm Raven cắt Spirit budget → tính trước reservation.
- **No Regen map mod**: nếu dựa life flask maintain low life → No Regen làm vòng lặp bất ổn.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Item giới thiệu. Loot pool Delirium, grouped với The Raven Trickster boss — cùng nhóm Sadist's Mercy, Horror's Flight, Veilpiercer.

## Relationships

- **synergizes_with** [Facebreaker](/guides/facebreaker) — unique gloves cùng patch 0.5.0, GGG reveal cùng lúc; synergy concept với Monk Martial Artist Stonefist path.
- **competes_with** [Sylvan's Effigy](/guides/sylvans-effigy) — Auspex ép single-minion (Mist Raven), Sylvan's Effigy thưởng cả bầy companion — hai triết lý ngược.
- **alternative_to** [Liminal Coil](/guides/liminal-coil) — cùng thiết kế "một mod bỏ giới hạn, một mod khai thác việc bỏ đó".
- **related_mechanics** [Twisted Empyrean](/guides/twisted-empyrean) — unique cùng patch, cùng design một item gánh nhiều layer.
