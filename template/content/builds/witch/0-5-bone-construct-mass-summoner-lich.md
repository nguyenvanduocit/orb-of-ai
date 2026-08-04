---
template: templates/build-template.md
document_type: build
title: Unearth Bone Construct Mass Summoner
status: draft
author: duocnv
created: '2026-05-29'
updated: '2026-07-03'
class: Witch
ascendancy: Lich
league: '0.5'
patch: 0.5.0
budget_tier: low-budget
confidence_level: LOW
pob_coverage: NA
build_tags:
  primary_skill: Unearth
  damage_type: physical
  playstyle: minion
  content_focus: mapping
tags:
  - witch
  - lich
  - unearth
  - bone-construct
  - minion
  - minion-army
  - summoner
  - mana-stacking
  - life-stacking
  - 0-5
  - poe2
---

# Unearth Bone Construct Mass Summoner

Witch/Lich mass-summoner: thả ~24 :wiki-link{url="https://www.poe2wiki.net/wiki/Bone_Construct"} tạm thời cùng lúc, đứng backline điều cả bầy. Core = :wiki-link{url="https://www.poe2wiki.net/wiki/Unearth"} dựng construct từ xác; tối ưu mapping, không phải Uber bossing.

## Build Overview

- **Damage:** bầy Bone Construct — scale 2 trục tách biệt: **số lượng** (cap bởi tree `+limit`, không phải gem level) × **hit damage mỗi con** (minion gem level của Unearth + global more-multiplier).
- Minion 0.5 ăn thêm *more damage* lên non-unique + unique tự động; 0.5 vá bug khiến bonus không hiện tooltip → DPS thực > số PoB/in-game.
- Đòn bẩy hit damage: `+to Level of Minion Skills` trên gear đẩy Unearth gem level cao. Đòn bẩy quân số: node `+limit` trên tree — gem cap 20 construct, level >20 chỉ thêm damage không thêm bodies.
- **Engine mana:** :wiki-link{url="https://www.poe2wiki.net/wiki/Soulless_Form"} bỏ mana regen mặc định → "hồi mana bằng 6% maximum Life mỗi giây"; Unearth gem cao tốn tới 76 mana/cast → stack **max Life** cấp mana.
- **Engine damage:** :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Conduit"} buff Unholy Might cho mình + allies trong Presence; :wiki-link{url="https://www.poe2wiki.net/wiki/Blackened_Heart"} +4% magnitude Unholy Might per 100 max Mana → stack cả **Life lẫn Mana**.
- Construct là **mana-cast, không reserve Spirit** → Spirit chỉ gating spectre + offering, không gating quân số.
- **Defense:** ES pool Witch + node minion-defensive; đứng backline sau tường construct. Không tanky.
- **Ràng buộc cứng:** corpse — không xác = không construct = không damage.

## Skill Gems & Links

- :wiki-link{url="https://www.poe2wiki.net/wiki/Unearth"}: spell hình nón, Physical damage lên xác, mỗi xác bật 1 (xác lớn → nhiều) Bone Construct. Cap construct 8 @lvl1 → 20 @lvl20; base duration 15s/con. Gem level >20 (gear) chỉ tăng hit damage (range gem 1-20 nên không thêm con). Trần thực Witch/Lich ~24 con.
- **Main (6L):** Unearth + :wiki-link{url="https://www.poe2wiki.net/wiki/Armour_Break"} (Unearth là hit → phá giáp đám đông) + :wiki-link{url="https://www.poe2wiki.net/wiki/Heft"} (more max physical hit damage) + :wiki-link{url="https://www.poe2wiki.net/wiki/Physical_Mastery"} (+1 level Physical) + :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Mastery"} (+1 level Minion) + :wiki-link{url="https://www.poe2wiki.net/wiki/Magnified_Effect"} (mapping) — swap :wiki-link{url="https://www.poe2wiki.net/wiki/Concentrated_Area"} khi boss.
- **Spirit reservation:** :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} (con đẻ-xác) + :wiki-link{url="https://www.poe2wiki.net/wiki/Meat_Shield"} (lì hơn, đổi bớt damage) + :wiki-link{url="https://www.poe2wiki.net/wiki/Corrosion"} (nếu spectre poison → phá giáp) · + :wiki-link{url="https://www.poe2wiki.net/wiki/Sacrifice"} weapon set 2 (opener, xem Leveling).
- **Offerings:** :wiki-link{url="https://www.poe2wiki.net/wiki/Pain_Offering"} (buff minion damage, hi sinh máu) + :wiki-link{url="https://www.poe2wiki.net/wiki/Guatelitzi's_Ablation"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Danse_Macabre"} · :wiki-link{url="https://www.poe2wiki.net/wiki/Bone_Offering"} + Concentrated Area + :wiki-link{url="https://www.poe2wiki.net/wiki/Considered_Casting"}.
- **Utility:** curse :wiki-link{url="https://www.poe2wiki.net/wiki/Vulnerability"} hard-cast — KHÔNG blasphemy aura (Presence range nhỏ ép lại gần → chết).
- Bind Spectre = nguồn xác, không phải damage: chọn monster có sub-minion chết liên tục → mỗi cái chết để lại xác. **Mắt xích yếu nhất khi port 0.5:** con spectre-đẻ-xác mạnh bản trước bị khóa/disable, con tốt nhất 0.5 chưa rõ → test in-league (vấn đề mở).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Instability"} (nổ khi Low Life, 15% max Life as Fire): available nhưng low-value — Bone Construct life pool bé nên 15% không đáng.
- KHÔNG dùng: Faster Attacks (không tồn tại PoE2; Unearth là spell → attack speed vô nghĩa); Rage Fountain / Font of Rage (gỡ ở 0.4).
- Patch 0.5 vá bug support gem trước không gắn được Unearth → test lại combo cũ.
- `Exclusion check:` Soulless Form xoá mana regen → mọi "increased Mana Regeneration" vô dụng; :wiki-link{url="https://www.poe2wiki.net/wiki/Cooldown_Recovery_I"} (Ingenuity) không sửa skill của minion; Guatelitzi's Ablation + Danse Macabre chỉ hỗ trợ Offering, không gắn Unearth.

## Ascendancy

Lich = curse/Unholy-Might/hi-sinh-ES, không có node minion riêng — synergy gián tiếp qua Unholy Might. Lich không rebalance ở 0.5 → wording nguyên vẹn.

- **Soulless Form** (đầu tiên, bắt buộc) — không có nó Unearth gem cao chết vì hết mana. Mặt trái: "10% damage taken bypasses Energy Shield".
- **Necromantic Conduit** — Unholy Might cho mình + allies trong Presence; đổi 5% max mana/giây.
- **Blackened Heart** — mỗi 100 max mana → 4% magnitude Unholy Might.
- 2 điểm cuối linh hoạt: bầy chết nhiều → node phòng thủ/curse; đủ tanky → node khuếch đại debuff.

## Passive Tree & Mastery

- **+limit (quân số):** notable **Expendable Army** "+2 to Limit of Minions summoned" cho temporary minion (Bone Construct sống 15s = temporary) + 20% increased Minion Duration; **Known by All** "+2 to Limit". Đây là toàn bộ nguồn +limit-for-temporary-minion → trần = 20 (gem) + 2 + 2 = **~24**.
- **Duration:** base 15s + 20% (Expendable Army) + quality (max +5s) + node Minion Duration → giữa-20s. Dài hơn → support Prolonged Duration (đổi 1 ô link).
- **Crit minion:** **Necrotic Touch** (40% increased minion critical chance) + **Grip of Evil** (40% increased minion critical damage bonus) + jewel crit socket.
- **Damage nền:** **Comradery**, **Pack Encouragement**, **Lust for Sacrifice**. Pack Encouragement = 5% increased **Attack** Damage/minion trong Presence, cap **80%** — chỉ ăn Attack damage của construct (melee dash attack), không generic. Lust for Sacrifice = 50% increased minion damage khi 2 offering chạy — node generic damage lớn nhất.
- **Reservation:** **Self Sacrificing** = +40% Reservation Efficiency of Minion Skills, kèm 20% reduced Spirit Reservation Efficiency of Skills cho skill không-minion (aura/utility hard-cast).
- **Minion-defensive:** **Fleshcrafting** (minion 15% max life as ES) khi construct bị fry nhanh.
- ~100 điểm main tree; ưu tiên defensive + limit/duration trước damage lẻ.
- **Spirit** (từ gear + tree, KHÔNG từ ascendancy → trần thấp hơn Infernalist/Shaman có node spirit riêng): base sceptre Rattling Sceptre ~100 flat, suffix "Lord's" 20-26% increased Spirit, flat +Spirit, **Profane Commander** (4% increased Spirit + mở Presence area), :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Mantle"} (+75 Spirit @0.5). Life-stack phục vụ Soulless Form (mana) + EHP, không đổi ra spirit.

## Stat Priorities & Defenses

Target giai đoạn budget — mốc tham chiếu (chưa log in-client), sẽ dịch khi 0.5 ổn định:

| Stat | Target | Ghi chú |
|---|---|---|
| Life | ~1,500 | cấp mana (Soulless Form) + EHP |
| Energy Shield | ~4,000 | lớp đệm chính, 10% xuyên qua vì Soulless Form |
| Res F/C/L · Chaos | 76/76/71 · ~36% | cap fire/cold đủ red map cơ bản |
| Unearth gem level | ~36 | nhờ +minion skill level gear; cao hơn = hit damage, không thêm con |
| Construct limit / duration | ~24 con (20+2+2) / giữa-20s | log lại khi vào league |

- ES gánh phần lớn; xuyên 10% → cần res cap + đủ Life. Physical slam / burst lớn chọc thẳng Life (~1.5k) bất kể ES — EHP spreadsheet không phản ánh. Không armour/evasion. Construct làm vật cản vật lý.

### Performance Ratings

| Aspect          | Rating (1-5) |
|-----------------|--------------|
| clear_speed     | 4            |
| boss_damage     | 2            |
| survivability   | 2            |
| mobility        | 2            |
| league_start    | 4            |
| budget_scaling  | 2            |

## Resources

Chưa có PoB riêng (league mới, nhiều số còn target → `pob_coverage: NA`); dựng PoB2 đầu từ Stat Priorities khi vào league.

- **PoB:** chưa có.
- **Video:** https://www.youtube.com/watch?v=t1hCin0Esks — endgame Bone Construct (Unearth) overview; tham khảo playstyle, không phải proof boss-tier.

## Gear Progression

- **Leveling:** minion thường (skeletal warrior/sniper) tới khi vào Lich + Soulless Form; trước đó Considered Casting / node mana gồng cost Unearth. Nhặt base `+to Level of Minion Skills` + max life.
- **Early Mapping:** sceptre :wiki-link{url="https://www.poe2wiki.net/wiki/Rattling_Sceptre"} (~100 spirit, cap +4 minion skill level) + off-hand/focus (spirit + ES). Helmet int ES (:wiki-link{url="https://www.poe2wiki.net/wiki/Jade_Tiara"} / :wiki-link{url="https://www.poe2wiki.net/wiki/Magus_Tiara"}) roll mod `of the Despot` (+2 minion skill level) + spirit reservation efficiency — KHÔNG có base "Sorcerous Tiara", +minion level từ mod. Body :wiki-link{url="https://www.poe2wiki.net/wiki/Vile_Robe"} (ES nền, spirit từ mod % increased Spirit). Slot còn lại: max life, max mana, res, chaos res (2× :wiki-link{url="https://www.poe2wiki.net/wiki/Amethyst_Ring"}), ES.
- **Endgame:** đẩy `+minion skill level` tối đa (sceptre +4, helmet +2, amulet, jewel) → Unearth gem cao (hit damage; số con chốt ~24). Tăng song song spirit + max mana. Weapon thay thế push minion level: mace :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} (+2-3 to Level of all Minion Skills) hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Trenchtimbre"} (+1-2).
- **Mirror Tier:** jewel :wiki-link{url="https://www.poe2wiki.net/wiki/Prism_of_Belief"} roll `+1-3 to Level of all <random> Skills` trúng Unearth — random (không chỉ định), drop từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_Arbiter_of_Ash"} → đắt + hên xui. Double-corrupt gear cho +minion level implicit + max Life/Mana/Spirit. Construct cap ~24 → tiền mirror mua hit damage + survivability, không thêm quân số.

## Flasks

- :wiki-link{url="https://www.poe2wiki.net/wiki/Thawing_Charm"} (chống freeze — đứng cast giữa bầy bị freeze = chết) + :wiki-link{url="https://www.poe2wiki.net/wiki/Staunching_Charm"} (chống bleed).
- Soulless Form cấp mana từ life → mana flask ít cần; ưu tiên flask life/ES instant chữa burst xuyên ES. Slot còn lại theo map mod (granite/quartz).

## Leveling Notes

- Campaign minion mặc định Witch tới Act 2-3, swap dần Unearth khi đủ corpse-generation + vào Lich.
- **Opener weapon-swap:** :wiki-link{url="https://www.poe2wiki.net/wiki/Sacrifice"} (reservation skill, "Must be active in both Weapon Sets") trên set 2 + minion rẻ spirit :wiki-link{url="https://www.poe2wiki.net/wiki/Terracotta_Soldier"} → swap set 2 để Sacrifice cho dùng chính minion làm xác → cast Unearth ra loạt construct → swap về set 1.
- **Snapshot:** Bone Construct mang buff/gem level ở thời điểm summon. Off-hand set 2 yếu hơn set 1 → construct yếu theo. Giữ weapon cũ mỗi lần upgrade nhét vào set 2.

## Budget & Investment

- Floor: rất rẻ — sceptre spirit + gear `+minion skill level` + max life = clear red map cơ bản.
- Divine breakpoint: gom đủ `+minion skill level` (Unearth gem cao) + đủ spirit nuôi bầy spectre + 2 offering.
- Diminishing returns sớm: max minion level + limit chạm ~24 → tiền thêm chỉ mua hit damage lẻ + ES/Life/res; không node nào nâng quân số quá 24.

## Failure Modes

- **Map mod "no corpse / cannot raise"** / mod làm minion chết quá nhanh → engine ngừng: không xác = không construct = không damage. Cách die phổ biến nhất.
- **One-shot xuyên ES:** Soulless Form 10% damage taken bypasses ES → slam boss / burst vật lý chọc thẳng ES, đập Life ~1.5k. Cần Life đệm + tránh ăn đòn.
- **Solo boss cạn corpse:** construct despawn 15s; boss không adds → quân số tụt về 0 khi boss còn nguyên máu. Lý do single-target yếu.
- **Gear floor:** dưới mốc đủ `+minion skill level` + spirit → clear chậm + gãy đà; số DPS "trên giấy" chỉ đúng khi chạm floor.
- **Patch sensitivity:** sống nhờ Unearth gem-level + Soulless Form + global minion damage bonus 0.5 re-tune +25-35% — bonus mới chỉnh = nerf target dễ thấy nhất; mass-minion lag cũng bị GGG nhắm.
- **Corpse-spectre chưa proven 0.5:** con bản trước khóa/disable — risk league-start lớn nhất (lớn hơn gear).

## Verdict

- Mạnh: fantasy RTS + clear mật độ cao, backline an toàn khi bầy đông; core Lich ổn định 0.5, global minion bonus vá 0.5 (~25-35% non-unique), gear rẻ league-start-friendly.
- Yếu: clunky (construct melee dash, không player-follow — traversal xa/chokepoint bỏ đám lại), lag 20+ minion (10-15 FPS, console gần như không nổi), single-target yếu solo boss, corpse-spectre 0.5 chưa chốt.
- Build adapt bản cũ → 0.5: core mechanic verify còn nguyên, nhiều số là target cần log lại. Hợp map/early pinnacle hơn Uber.

## Changelog

### 2026-05-30
- Sửa 2 lỗi mechanic: Beidat's Will là node **Infernalist** (Lich không allocate được), Tribute to Utula là node **Smith of Kitava** — viết lại nguồn spirit = gear + Profane Commander + Soul Mantle + Self Sacrificing.
- Construct count: gem cap 20, `+level` >20 chỉ thêm hit damage; trần thực = 20 + Expendable Army 2 + Known by All 2 = ~24 (thay "~30"). Bỏ "44s duration" cố định → dải từ base 15s + quality + node.
- Qualify: Pack Encouragement = 5% increased Attack Damage/minion cap 80%; Self Sacrificing downside 20% reduced non-minion reservation efficiency; Minion Instability low-value. Thêm Performance Ratings + Bone Construct video.

### 2026-05-29
- Bản nháp đầu, adapt Bone Construct mass-summoner từ patch cũ → 0.5.0. Verify core (Unearth → Bone Construct, Soulless Form, Necromantic Conduit + Blackened Heart) còn nguyên. Gỡ đã chết 0.5: spectre-đẻ-xác bản cũ, Faster Attacks/Haste (không tồn tại PoE2), Rage Fountain (gỡ 0.4). Sửa gear: không có base "Sorcerous Tiara", Prism of Belief = +random skill drop từ Arbiter. Corpse-spectre 0.5 = vấn đề mở.

## Relationships

- **alternative_to** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — hướng summoner Witch khác, spectre vĩnh viễn làm damage thay construct tạm thời.
- **alternative_to** [Plants Lich Abyssal League Starter](/builds/witch/plants-lich-abyssal-league-starter) — cùng Witch Lich league-start rẻ, caster totem/vines thay minion swarm.
- **related_guides** [Minion Army Build Comparison](/guides/0-5-minion-army-build-comparison) — so sánh minion-army 0.5 (construct tạm thời vs spectre vĩnh viễn vs companion).
- **related_mechanics** [Energy Shield recovery](/guides/energy-shield-recovery) — lớp ES mà Soulless Form chọc thủng 10%.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5.0.
- **alternative_to** [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) — mass summoner khác cho ai không muốn phụ thuộc unique farmed.
- **alternative_to** [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) — cùng Lich, minion physical mass-summon; đối trọng spectre swarm.
- **competes_with** [Lich Soul Crystal Undead Companion](/builds/witch/0-5-lich-soul-crystal-undead) — Lich path khác dùng minion thuần thay companion.
