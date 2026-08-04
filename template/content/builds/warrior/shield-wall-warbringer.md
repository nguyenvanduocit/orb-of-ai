---
document_type: build
title: Shield Wall Warbringer
class: Warrior
ascendancy: Warbringer
league: '0.5'
patch: 0.5.0
status: published
author: duocnv
created: '2025-12-14'
updated: '2026-07-03'
budget_tier: league-starter
pob_coverage: NA
build_tags:
  primary_skill: Shield Wall
  damage_type: Physical
  playstyle: Melee
  content_focus: Campaign / Early Endgame
tags:
- poe2
- warrior
- warbringer
- shield-wall
- boneshatter
- armour
- block
- warcry
- campaign
template: templates/build-template.md
---

# Shield Wall Warbringer

:wiki-link{url="https://www.poe2wiki.net/wiki/Shield_Wall"} như vũ khí — đặt tường đất, kích nổ bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Fortifying_Cry"} / :wiki-link{url="https://www.poe2wiki.net/wiki/Seismic_Cry"} / :wiki-link{url="https://www.poe2wiki.net/wiki/Shield_Charge"}. Damage từ armour trên shield: mỗi explosion +5–7 flat physical per 15 Armour on Shield (0.5.0), không phụ thuộc weapon/stat khác. :wiki-link{url="https://www.poe2wiki.net/wiki/Warbringer"} Warcaller's Bellow xoá cooldown warcry → vòng đặt→nổ→đặt liên tục. Mạnh nhất campaign + early endgame.

## Cơ chế shield-as-weapon

- Mỗi lần Shield Wall bị phá bởi skill mình (slam, warcry, Shield Charge): explosion +**100% more Damage** + flat phys theo armour. Công thức: `flat_added = (Armour on Shield / 15) × (5–7)`
- Ví dụ lv28 với :wiki-link{url="https://www.poe2wiki.net/wiki/Rampart_Tower_Shield"} ~450 armour: 450/15 × 6 trung bình = 180 flat phys added per explosion. + base attack damage Shield Wall (100% lv1 → 235% lv20) + multiplier 100% more khi destroyed by skills. Mỗi lần nâng shield base / roll armour = DPS lên thẳng
- **0.5.0 net effect:** cắt multiplier 6–8 → 5–7 NHƯNG buff armour từ item ~33% ở lv65 (tapering 15% lv80+). Shield 2000 armour trong 0.5.0 (thay 1500 ở 0.4.0) → 2000/15 × 6 ≈ 800 flat phys so với 1500/15 × 7 = 700 flat phys cũ → **mạnh hơn nhẹ** ở endgame dù per-armour nhìn nerf. Nâng armour trên shield vẫn là trục đúng
- Fortifying Cry Shield Wave cũng scaling 5–7 per 15 armour — mỗi Shield Wave trigger (hit enemy sau khi Fortifying Cry active) đóng góp thêm một explosion damage từ armour. Warcaller's Bellow không cooldown → Fortifying Cry luôn sẵn, Shield Wave chạy liên tục

## Act 1 → lv28 (Boneshatter mace, chưa cần shield)

- :wiki-link{url="https://www.poe2wiki.net/wiki/Boneshatter"}: Tier 1, attack speed 60% base, attack damage 100–312%. Cần enemy Primed for Stun trước → Heavy Stun + trigger Shockwave 250–780% damage trong 2m radius. :wiki-link{url="https://www.poe2wiki.net/wiki/Rolling_Slam"} hoặc Seismic Cry làm stun primer. :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Cry"} thêm sớm nhất (pop corpse + clear pack)
- Giữ Boneshatter không overlevel quá — chạy tốt khi stun buildup đủ prime enemy, không overkill trước khi stun xảy ra
- Boneshatter quality 0.5.0: 0–20% increased Attack Speed (trước 0.4.0 là 0–30%). Không ảnh hưởng nhiều ở campaign

## Transition lv28 + gem setup

- Equip Rampart Tower Shield đúng lv28 (requirement lv28, 42 Str), swap main skill sang Shield Wall, thêm warcry package ngay
- **Shield Wall:** + Brutality I/II (25–30% more physical damage) + Melee Physical Damage support. Limit 2 walls active, wall tồn tại 6 giây → đặt cả hai trước boss rồi kích nổ bằng warcry. Boss: swap một support sang Concentrated Effect hoặc Close Combat II (30% more attack damage với enemy trong 1m)
- **Warcry package:**
  - Fortifying Cry — Guard + Shield Wave per hit. Bypass cooldown bằng Endurance Charge khi chưa có Warcaller's Bellow
  - Seismic Cry — Heavy Stun enemy Primed for Stun, empower slam aftershocks. Bypass cooldown bằng Endurance Charge
  - Infernal Cry — Corpse explosion (25% corpse life as phys khi có Warcaller's Bellow). Giữ từ phase Boneshatter, dùng xuyên suốt
- **Movement:** Shield Charge = di chuyển chính + detonator (charge qua shield wall kích nổ ngay). Rhythm: đặt wall → Shield Charge qua → wall nổ sau lưng

## Ascendancy

Warbringer = ascendancy duy nhất biến warcry thành engine liên tục thay cooldown-gated utility. Thứ tự unlock:

- :wiki-link{url="https://www.poe2wiki.net/wiki/Warcaller%27s_Bellow"} — Ignore Warcry Cooldowns + Warcries Explode Corpses (25% corpse life as physical damage). Define build (spam warcry + AoE clear thứ hai không setup riêng). Unlock trước tất cả
- :wiki-link{url="https://www.poe2wiki.net/wiki/Renly%27s_Training"} → :wiki-link{url="https://www.poe2wiki.net/wiki/Turtle_Charm"} — Renly's Training cho 35% base block từ shield (thay roll block), Turtle Charm đẩy maximum block lên 75% nhưng nhận 20% damage từ blocked hit. Block cap sớm không phải hunt block rolls → shield ưu tiên hết cho armour
- :wiki-link{url="https://www.poe2wiki.net/wiki/Anvil%27s_Weight"} → :wiki-link{url="https://www.poe2wiki.net/wiki/Imploding_Impacts"} — Anvil's Weight break armour = 10% hit damage, Imploding Impacts cho break xuống dưới 0 + Fully Broken Armour tăng all damage taken từ hits. Tuyến damage amplification thứ hai qua armour break. Unlock sau Warcaller's Bellow + Renly's Training
- :wiki-link{url="https://www.poe2wiki.net/wiki/Jade_Heritage"} (optional) — Encase in Jade skill + passive 1 Jade per second. Defensive layer bossing, stack tự động

## Gear

- **Shield = weapon.** Lên base type / craft armour = DPS đổi tức thì. Rampart Tower Shield (lv28, base 96 armour) là điểm bắt đầu → hunt base tier cao hơn theo act + craft flat armour + percent armour
- **Main-hand:** 1H Mace flat physical damage cao. "+levels to Melee Skills" premium, không bắt buộc. Đủ Strength cho gem requirement là đủ
- **Jewelry bắt buộc Mana Leech:** Shield Wall mana cost 13 (lv1) → 92 (lv20), không leech = không spam. Life Leech trên jewelry thứ hai sustain defence. Resistance + Life bù qua jewelry + armour pieces
- Endgame ổn muốn đẩy tiếp: Titan + Smith of Kitava tree phù hợp hơn physical melee scaling → respec ascendancy thay vì cố scale Shield Wall lên T16

## Failure Modes

- **Không có Mana Leech** (gãy phổ biến nhất): mana cost climb nhanh, thiếu leech = vỡ toàn bộ rhythm spam. Mana Leech trước bất kỳ upgrade nào khác
- **Shield armour thấp:** không có fallback damage source. Cầm shield yếu = damage yếu tuyến tính. Không upgrade shield theo act = hit bằng bông
- **Physical damage reduction cao:** all-physical không convert / elemental bypass. Map mod "Monsters have high Physical Damage Reduction" / boss phys mitigation cắt thẳng. Chỉ Imploding Impacts + Fully Broken Armour bù trừ
- **Corpse-clear encounter:** Warcaller's Bellow corpse explosion mất giá trị khi encounter consume corpse (boss arena không wave) / map mod remove corpse. Pack clear chậm; damage boss từ shield explosion không đổi
- **Không tự đứng ở endgame:** campaign mạnh + early endgame mượt, không phải T16/pinnacle. Scaling không đủ deep endgame nếu không respec Titan / Smith of Kitava

## Verdict

Build campaign + early-endgame mạnh nhất của Warbringer: shield armour = damage source, warcry engine không cooldown (Warcaller's Bellow), block cap sớm qua Turtle Charm. Trần rõ: KHÔNG tự đứng T16/pinnacle → respec Titan hoặc Smith of Kitava khi vào deep endgame. Hợp league-start / người mới lên Warrior muốn một nút clear an toàn qua campaign.

## Version History

### Patch 0.5.0 (Return of the Ancients)

- Shield Wall: Added Physical Damage per 15 Armour on Shield 6–8 → 5–7
- Fortifying Cry Shield Wave: Added Physical Damage per 15 Armour on Shield 6–8 → 5–7. Nay chỉ consume 1 stack khi detonate shield wall; Shield Wave từ 1 Shield Wall không hit cùng 1 enemy 2 lần
- Boneshatter quality: 0–20% increased Attack Speed (trước 0–30%)
- Armour từ item + modifier buff ~33% ở lv65, tapering ~15% lv80+. Bù phần lớn damage nerf; net lv65+ shield wall damage xấp xỉ / nhỉnh hơn 0.4.0 với shield cùng tier

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview 0.5.0, gồm armour system overhaul + warcry balance
- **related_guides** [Challenge Guide](/guides/challenge-guide) — campaign completion unlock endgame cho 0.5
- **related_builds** [Titan Bear Slam](/builds/warrior/0-5-titan-bear-slam) — Warrior slam còn lại; muốn shapeshift armour tank thay block thì xem cái này
