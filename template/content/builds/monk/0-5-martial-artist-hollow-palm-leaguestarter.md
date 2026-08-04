---
title: "Martial Artist Hollow Palm Leaguestarter"
template: templates/build-template.md
document_type: build
status: draft
created: 2026-05-28
updated: 2026-07-03
class: Monk
ascendancy: Martial Artist
league: 0.5
patch: 0.5.0
budget_tier: league-starter
confidence_level: MEDIUM
pob_coverage: PARTIAL
---

# Martial Artist Hollow Palm Leaguestarter

Monk league-start ít phụ thuộc gear nhất ở 0.5. Core: **Hollow Palm Technique** (flat physical theo gem level) + **Hollow Form Technique** (clone melee Martial Artist) cho single target + **Runic Meridians** + **Way of the Mountain** (Remnant + Rune league).

## Build Overview

- **Damage:** Hollow Palm (flat phys theo level skill) × more multiplier (tree + support + **Mountain's Teaching** stack)
- **Clear:** Wind Blast hoặc Whirling Assault (test cái nào mượt hơn)
- **Single target:** channel Hollow Form → clone đánh Rolling Slam hoặc Forge Hammer
- **Defense:** Evasion/ES từ 4 món armour (scale attack speed + crit cho Hollow Palm) + Way of the Mountain (giảm damage hit nhỏ 70%, +50% stun threshold, consume stack lấy 20% more damage)
- **Movement:** Whirling Assault hoặc dash cơ bản
- Build chạy vì Hollow Palm loại bỏ vấn đề vũ khí rác đầu league; Hollow Form + Runic Meridians là hai thứ mới nhất 0.5 cho Monk
- Mạnh: league start cực dễ. Yếu: single target cần test clone AI + channel time in-client

## Skill Gems & Links

- **Main Clear (6L):** :wiki-link{url="https://www.poe2wiki.net/wiki/Wind_Blast"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Impact_Shockwave_Support"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ash"} + Brutality + Magnified Area + Rapid Attacks (hoặc Armour Break khi có gear)
  - Wind Blast: 150% more stun buildup + Daze + Knockback; + Impact Shockwave = "một nút xóa màn" ở khoảng cách an toàn. Herald of Ash dọn con sót
- **Alternative Clear (test sau Act 3-4):** :wiki-link{url="https://www.poe2wiki.net/wiki/Whirling_Assault"} nếu AoE đủ lớn — nhiều khả năng là clear chính cho mapping nhanh, test cadence sau khi pivot
- **Single Target:** :wiki-link{url="https://www.poe2wiki.net/wiki/Forge_Hammer"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Cry"} + link vào Hollow Form. Rolling Slam cũng test (attack time penalty bị clone bỏ qua một phần)
- **Pre-Ascendancy (đến Lab 1):** :wiki-link{url="https://www.poe2wiki.net/wiki/Tempest_Bell"} (hoặc Hollow Focus sau khi có) + :wiki-link{url="https://www.poe2wiki.net/wiki/Tempest_Flurry"} generate combo
- **Movement:** Whirling Assault hoặc dash + :wiki-link{url="https://www.poe2wiki.net/wiki/Staggering_Palm"} (buff 0.5: 25% increased Physical + 10% chance to Daze)
- **Aura & Utility:** Herald of Ash (main) + một aura life/ES cơ bản + CWDT setup rẻ đầu league

## Ascendancy

Thứ tự lab (0.5):

- **Lab 1 — Hollow Form Technique:** signature skill mới, channel tạo clone đánh melee skill link. Nguồn single target chính → ưu tiên
- **Lab 2 — Hollow Focus Technique:** summon illusory bell → đánh vào heavy stun + shockwave. Nâng cấp trực tiếp từ Tempest Bell, an toàn + dễ dùng hơn
- **Lab 3 — Runic Meridians:** 5 rune socket cố định (1 helm + 2 body + 1 gloves + 1 boots). **Bắt buộc** cho Martial Artist mạnh 0.5 — league mechanic xoay Remnant → Rune → Runic Ward
- **Uber Lab — Way of the Mountain:** Immobilise → stack Mountain's Teaching. Consume stack 20% more damage (cả clone Hollow Form), hit nhỏ giảm 70% damage, +50% stun threshold. Vừa tank vừa damage
- Còn lại: Hollow Resonance Technique + Way of the Stonefist là lựa chọn sau (glove transform / crit bell)

## Passive Tree & Mastery

- Hollow Palm ở tây-bắc Monk tree. Path qua cluster Physical Damage, Attack Speed, Stun Buildup, Evasion/ES trên armour
- Cluster nhắm: Staggering Palm cluster (buff 0.5) · evasion + ES trên body/helmet/gloves/boots (scale Hollow Palm AS + crit) · attack speed + physical leech / life on hit (sustain) · stun/daze/knockback cho Wind Blast + Hollow Form
- PoB link cập nhật khi PoB2 fork hỗ trợ đầy đủ Martial Artist 0.5. Tree hiện ở 0.4 → chỉ tham khảo allocation lớn

## Stat Priorities & Defenses

Evasion / Energy Shield hybrid (Hollow Palm thưởng attack speed theo Evasion, crit theo ES trên 4 món armour).

- **ES / Life:** ES trước (scale crit + Runic Ward), sau bổ sung life
- **Armour / Evasion:** Evasion cao trên armour bắt buộc; armour phụ tank phys hit
- **Block / Spell Block:** ưu tiên nếu gear tốt, không core
- **Resistances:** cap 75% tất cả, chaos res càng cao càng tốt đầu league
- **Movement Speed:** 30%+ từ boot + tree + flask
- **Runic Ward:** lớp phòng thủ mới 0.5, cần stack rune phù hợp

### Performance Ratings

(đánh giá chủ quan tuần 1 league)

| Aspect          | Rating (1-5) | Ghi chú |
|-----------------|--------------|---------|
| clear_speed     | 4            | Wind Blast / Whirling rất mượt campaign |
| boss_damage     | 3            | Phụ thuộc Hollow Form clone, cần test thêm |
| survivability   | 4            | Way of the Mountain + Evasion/ES mạnh |
| mobility        | 4            | Dash + Staggering Palm thoải mái |
| league_start    | 5            | Hollow Palm gần như không cần vũ khí |
| budget_scaling  | 4            | Runic Meridians + rune tốt scale rất tốt |

## Gear Progression

- **Leveling:** 4 món armour (helmet, body, gloves, boots) Evasion + ES + Life, không cần vũ khí tốt · gloves trắng/rẻ đủ (Hollow Palm thay base damage) · jewelry Life + res + ít attack speed/phys · weapon bỏ trống hoặc quarterstaff rẻ để có skill
- **Early Mapping:** body Evasion/ES cao + life/spell suppression · boots MS + Evasion/ES + res · helmet & gloves Evasion/ES maximize Hollow Palm bonus · jewels Life + phys + attack speed + stun chance
- **Endgame:** 4 món armour tier cao Evasion/ES + life + mod mới 0.5 (rune synergy). Unique cân nhắc: :wiki-link{url="https://www.poe2wiki.net/wiki/The_Hollow_Mask"} (nếu mạnh với Remnant), item hỗ trợ physical attack / evasion
- **Mirror Tier (BiS):** armour mirror perfect Evasion/ES + life + new 0.5 mods · cluster jewel physical/attack speed/stun · Runic Meridians + rune BiS (tùy meta sau khi craft xong)

## Flasks

- 1 Life flask (instant hoặc high recovery)
- 2-3 Utility: Quicksilver (movement), Jade/Diamond (evasion/crit), Basalt hoặc Granite (phys reduction)
- Một flask curse removal hoặc bleed immunity
- Có Mageblood → ưu tiên flask tăng evasion, ES recovery, hoặc attack speed

## Leveling Notes

- **Act 1-2 (Lv 1-15):** Lightning combo hoặc Falling Thunder ban đầu → Wind Blast ngay khi có (Lv6). Hollow Palm cấp flat phys theo gem level → clear ổn với gear rác
- **Đến Lab 1 (~Lv 25-30):** Tempest Bell single target; clear một nút Wind Blast + Impact + Herald
- **Sau Lab 1:** channel Hollow Form link Rolling Slam hoặc Forge Hammer → nguồn single target chính
- **Giữa Act 3 trở đi:** nhắm Runic Meridians + Way of the Mountain, thu Remnant craft rune sớm

## Budget & Investment

- **League start (0-10 divine):** 4 món armour Evasion/ES decent + life trên tree/jewel, không cần unique đắt
- **Early mapping (10-50 divine):** upgrade 4 món armour + vài cluster jewel tốt
- **T16+ (50+ divine):** Runic Meridians + rune chất lượng cao + Way of the Mountain fully online. Mirror = perfect armour + cluster BiS
- Scale tốt với currency vì rune socket cho power spike không cần mirror gear

## Failure Modes

- **Map mod hostile:** reflect (nếu thiếu mitigation), reduced recovery, no leech — leech từ tree không core → reroll khi gặp
- **One-shot encounter:** boss slam nặng lúc chưa maintain Mountain's Teaching stack, hoặc clone Hollow Form không đánh trúng boss → mất nguồn single target
- **Gear floor:** cần ít nhất 4 món armour Evasion + ES đáng kể mới ra số Hollow Palm như paper; mặc rác vẫn chơi được nhưng damage thấp hơn nhiều
- **Patch sensitivity:** nerf Hollow Form spawn rate hoặc Rolling Slam interaction → cắt mạnh single target; phụ thuộc rune craft từ Remnant → league mechanic yếu hơn dự kiến = mất một nguồn power lớn
- **League start viability:** rất cao — chạy được với gear trắng từ Act 2, không cần vũ khí cố định
- **Bị vượt mặt:** clear có thể thua Whirling Assault hoặc cold variant nếu meta phát triển theo hướng đó

## Verdict

Hướng Monk league-start ít phụ thuộc gear nhất 0.5: Hollow Palm bỏ qua vũ khí rác, Wind Blast/Whirling Assault clear một nút, Hollow Form gánh single target sau Lab 1. Runic Meridians + Way of the Mountain là hai node phải lấy để scale theo league mechanic. Hợp người thích style đơn giản, stun nhiều, maps mượt. Điểm còn mở: single-target output thật của clone Hollow Form — đo channel time + clone AI khi vào league để chốt Rolling Slam vs Forge Hammer.

## Changelog

### 2026-05-28
- Initial draft cho 0.5 Martial Artist Hollow Palm league-starter; ưu tiên Runic Meridians + Way of the Mountain thay vì dồn hết vào Hollow Form
- Ghi nhận Hollow Palm fix từ patch notes 0.5

## Resources

- **Video:** [Leveling Tips for ANY Monk build & MARTIALBREAKER Update](https://www.youtube.com/watch?v=76rt_Mm1Pg4) (Woolie)
- **Build gốc:** https://mobalytics.gg/poe-2/builds/martialbreaker-monk-leaguestarter (có .build file export)
- **PoB:** sẽ cập nhật khi PoB2 fork hỗ trợ đầy đủ 0.5 Martial Artist

## Relationships

- **synergizes_with** :wiki-link{url="https://www.poe2wiki.net/wiki/Hollow_Palm_Technique"} — nền tảng weapon-independent scaling của toàn bộ build
- **requires** :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Meridians"} — bắt buộc để tận dụng Remnant + Rune league mechanic 0.5
- **synergizes_with** :wiki-link{url="https://www.poe2wiki.net/wiki/Way_of_the_Mountain"} — cung cấp cả damage (20% more) lẫn defense (70% less on small hits)
- **alternative_to** Cold Monk Glacial Cascade — Wind Blast + stun playstyle thoải mái hơn theo kinh nghiệm thực tế
- **related_builds** [Flicker Strike Martial Artist](/builds/monk/0-5-flicker-strike-martial-artist) — bản Martial Artist high-budget elemental crit Flicker, cùng ascendancy
