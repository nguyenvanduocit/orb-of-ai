---
template: templates/build-template.md
document_type: build
title: Spear Twister Ritualist và Amazon
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
class: Huntress
ascendancy: Ritualist / Amazon
league: '0.5'
patch: 0.5.0
budget_tier: medium-budget
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Twister
  damage_type: elemental
  playstyle: projectile
  content_focus: all-content
tags:
  - huntress
  - ritualist
  - amazon
  - twister
  - whirling-slash
  - spear
  - projectile
  - crit
  - freeze
  - 0-5
  - poe2
---

# Spear Twister Ritualist và Amazon

Self-cast Twister trên 2 nhánh ascendancy đông nhất Huntress meta: Ritualist và Amazon. Engine giống nhau — :wiki-link{url="https://www.poe2wiki.net/wiki/Whirling_Slash"} tích Whirlwind, :wiki-link{url="https://www.poe2wiki.net/wiki/Twister"} bắn xuyên qua consume, mỗi stage 80% more damage. Nhánh đẩy DPS thật cao nhất của mẫu poe.ninja: Twister lọt top-10 DPS toàn ladder 3 lần (~427k–480k), con cao nhất là Ritualist 480k. KHÔNG phải build companion — damage từ chính mình.

## Build Overview

- **Damage = chain consume:** Whirling Slash set 1 tích Whirlwind tối đa 3 stage; Twister set 2 bay xuyên, mỗi stage consume sinh 1 twister phụ + 80% more damage. Cú swap đầy đủ = Twister ăn nhiều lần base damage trước mọi multiplier → không cần stack projectile để cày boss, chỉ stack scaling element + crit + uptime. Whirling Slash collapse cho 150% more damage mỗi stage phụ khi rời vùng.
- **Scale theo 3 element cùng lúc:** :wiki-link{url="https://www.poe2wiki.net/wiki/Ice-Tipped_Arrows"} convert toàn bộ physical → cold; sceptre cho extra fire; flat lightning trên spear + ring nuôi dòng thứ ba. 3 dòng element nuôi :wiki-link{url="https://www.poe2wiki.net/wiki/Trinity"} (more elemental damage theo Resonance) + apply đủ 3 ailment để :wiki-link{url="https://www.poe2wiki.net/wiki/The_Taming"} cộng increased damage per ground type. Twister có sẵn mod "Elemental twisters gain 50% of damage as the corresponding Type" → mỗi nguồn element nhân đôi khi đi qua ground effect tương ứng.
- **Defense = evasion + energy shield hybrid** với freeze-lock lớp kép: enemy freeze vừa ngừng đánh vừa ăn nhiều damage hơn nếu chạy Heavy Frost qua :wiki-link{url="https://www.poe2wiki.net/wiki/From_Nothing"}. Mobility = Whirling Slash tự đẩy người về trước theo attack speed + dodge roll né.
- Cùng engine có 3 cách ráp theo ascendancy: Ritualist (proven top DPS, gear-efficiency + sustain), Amazon (crit/accuracy/elemental, ceiling cao hơn nhưng cần accuracy), và bản :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} self-cast viết riêng. 2 nhánh trong doc khác ở ascendancy + cách bù frenzy/charge, skill core chung.

## Skill Gems & Links

Tay set 1 spear attack-speed cao (target ≥2.36 APS); set 2 spear damage + sceptre. Ice-Tipped Arrows phải set 2 cùng Twister — sai set convert đôi khi không apply, gem bug âm thầm. Whirling Slash bind set 1, Twister bind set 2, swap thật (2 pool weapon-set conditional point tách biệt).

- **Whirling Slash (set 1):** :wiki-link{url="https://www.poe2wiki.net/wiki/Rapid_Attack"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Rage"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Magnified_Area"} + crit/fire support. Rapid Attack đẩy APS tích 3 stage; Magnified Area mở vùng quét. Whirlwind cap 3 stage, mỗi stage +150% more collapse damage + +0.3m radius.
- **Twister (set 2):** :wiki-link{url="https://www.poe2wiki.net/wiki/Projectile_Acceleration"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Armament"} + Prolonged Duration + Concentrated Aura + crit support. Projectile Acceleration biến projectile speed thành damage; Elemental Armament flat elemental; Prolonged Duration kéo 3s base. Concentrated Aura 10% more thay :wiki-link{url="https://www.poe2wiki.net/wiki/Deliberation"} (twister move erratic).
- **Ice-Tipped Arrows (set 2):** Elemental Armament + Cooldown Recovery + Cold Attunement. 2 vai: convert toàn bộ phys → cold (lý do dùng dù không cầm bow) + spawn Ice Fragments clear. Cooldown Recovery + frenzy charge bypass = gần always-on khi cày map.
- **Marks:** :wiki-link{url="https://www.poe2wiki.net/wiki/Freezing_Mark"} + Prolonged Duration (more Freeze buildup + buff cold khi target frozen); :wiki-link{url="https://www.poe2wiki.net/wiki/Sniper's_Mark"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Eternal_Mark"} bù frenzy nhánh không tự sinh charge (Ritualist) — Sniper's Mark grant 1 frenzy khi activate, Eternal Mark khiến mark không consume lần đầu → mỗi cast hiệu lực 2 lần.
- **Heralds + buff:** :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ice"} (shatter pack + flat cold) + :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Thunder"} (flat lightning + shock-on-hit nuôi Shocked Ground). Trinity giữ 100 spirit persistent, chỉ cắm +1 level support. :wiki-link{url="https://www.poe2wiki.net/wiki/Ghost_Dance"} (ưu tiên quality cho reservation efficiency) + :wiki-link{url="https://www.poe2wiki.net/wiki/Wind_Dancer"}.
- `Exclusion check`: Trinity scale elemental không scale physical → Ice-Tipped Arrows convert bắt buộc, phần phys không convert nằm ngoài Trinity. The Taming "count as boosted by ground" chỉ apply Wind Skill (Twister có tag Wind; Whirling Slash là Strike+Wind nhưng collapse không phải projectile twister nên không hưởng phần ground-gain element). Heavy Frost chỉ ignore resistance khi dương — boss res âm tự nhiên hiếm nên thực tế luôn trigger.

## Ascendancy

Engine giống nhau, hai ascendancy cho Twister hai thứ khác hẳn. Ritualist thiên gear-efficiency + sustain, Amazon thiên crit + accuracy + elemental.

### Ritualist

:wiki-link{url="https://www.poe2wiki.net/wiki/Ritualist"} ăn notable theo nhu cầu: **Unfurled Finger** (+1 Ring Slot), **Mystic Attunement** (25% increased bonuses từ Rings và Amulets), **Corrupted Lifeforce** (grant Blood Boil, 15% more Damage lên enemy dính Blood Boil), **Wildwood Persistence** (10% increased Life Recovery rate per 5% missing Unreserved Life) + cụm charm (**Intricate Sigils** +1 charm slot, **Mind Phylacteries** tiêu mana bật charm khi hết charge).

- Ritualist top DPS không phải một more-multiplier to, mà là **ring economy**: Twister sống nhờ stat trên ring (flat elemental cho 3 dòng Trinity, resistance cap, attribute mở support tier cao). Unfurled Finger cho ring thứ 3, Mystic Attunement nhân 25% cả 3 ring + amulet. Corrupted Lifeforce thêm 15% more (điều kiện: enemy dính Blood Boil, apply qua skill granted). Cụm charm + Wildwood Persistence = lý do Ritualist sống dai dù pool nhỏ.
- Mặt trái: tree Ritualist có minor node âm — **−20% all Elemental Resistance, 25% reduced Spirit, 30% reduced Mana**. Tính res âm vào res floor, spirit hụt → ưu tiên reservation efficiency (Ghost Dance quality, Rabbit Idol trên sceptre) cho đủ Trinity + 2 herald + Ghost Dance + Wind Dancer.

### Amazon

:wiki-link{url="https://www.poe2wiki.net/wiki/Amazon"} ăn cụm crit + accuracy + elemental: **Predatory Instinct** (Reveal Weaknesses lên rare/unique, 50% more damage lên enemy có Open Weakness), **Critical Strike** (chance to Hit vượt 100% được, phần dư đổi 25% thành crit chance), **Penetrate** (added Physical damage = 25% Accuracy Rating trên weapon), **Elemental Surge** + **Surging Avatar** (consume charge → trigger Elemental Surge sinh Cold/Fire/Lightning Surge), **Stalking Panther** (double evasion từ helm/glove/boot, halve từ body).

- Amazon ceiling cao. Predatory Instinct 50% more lên boss (rare/unique luôn Open Weakness sau Reveal) = multiplier lớn nhất giữa 2 ascendancy; **In for the Kill** thêm 40% increased Skill Speed khi enemy Open Weakness trong Presence (Skill Speed là axis riêng 0.5). Critical Strike + Penetrate biến accuracy thành crit chance dư + flat phys. Đổi lại cần đầu tư accuracy (Penetrate vô nghĩa nếu accuracy thấp) + nguồn charge ổn định cho Elemental Surge consume.
- Thứ tự ascend cả 2 nhánh: lab 1 notable enabler (Ritualist → Corrupted Lifeforce hoặc Unfurled Finger; Amazon → Predatory Instinct), lab 2-3 mở rộng cụm chính, lab 4 hoàn thiện. Không có node companion.

## Ritualist hay Amazon

- **Ritualist** an toàn, gear-efficient, DPS thật cao nhất đo được (480k, con #1). Mạnh vì ring thứ 3 + 25% jewelry effect giải bài toán Twister (cap res, balance flat ele 3 dòng) + sustain charm + life recovery. Yếu ở −20% all ele res tree + spirit hụt, more-multiplier chủ động chỉ 15% Corrupted Lifeforce (điều kiện). Population **13.0% (16,185 char)** nhưng giảm mạnh nhất ladder, **−5.1pt** so tuần đầu.
- **Amazon** ceiling cao, scaling crit/accuracy. Predatory Instinct 50% more lên boss là lớn nhất, In for the Kill skill speed, Elemental Surge nuôi thêm element. Cần accuracy stacking + nguồn charge → gear floor cao hơn. Population **5.4% (6,668 char)** đang lên đều, **+2.6pt**.
- Tóm gọn: dễ ráp + sustain + top DPS proven → **Ritualist**. Ceiling cao cho boss + sẵn sàng đầu tư accuracy + charge → **Amazon**. Chung skill setup, swap nhánh chỉ đổi ascendancy point + phần gear (accuracy Amazon, ring thứ 3 Ritualist).

## Passive Tree & Mastery

- Crit-heavy + projectile + freeze + weapon-set conditional, chung cả 2 nhánh. Cụm chính nhánh huntress trung tâm: javelin (inc damage + crit chance), crit cluster (struck through, moment of truth, true strike, deadly force), killer instinct (inc attack damage khi at Full Life — gần như luôn full nhờ ES pool), 10fold attacks (attack speed set 1).
- **Freeze/cold:** Hail (freeze buildup), Crushing Wave (inc damage on crit hit), Deep Freeze qua From Nothing (freeze buildup + frozen enemy −8 cold res). Harness the Elements (inc damage per element type — 3 element 60% inc).
- **Defense:** Subdivision Mask (eva per ES trên helmet), Mindful Awareness (eva + ES), Trained Deflection (push deflection cap). Amazon thêm accuracy cluster nuôi Critical Strike + Penetrate; Ritualist bỏ phần đó, dồn jewel socket cho ring/jewelry scaling.
- **Weapon-set conditional:** set 1 attack speed (nuôi Whirling Slash APS), set 2 crit/damage (nuôi Twister). 2 pool tách biệt, swap thật.
- Heavy Frost qua From Nothing Diamond jewel allocate quanh keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"} late endgame (passive trong radius allocate không cần connect) → mở Heavy Frost + Thin Ice (50% increased damage against frozen). Anoint amulet endgame cụm 60% inc damage per elemental type khi đủ 3 element.

## Stats & Defenses

EHP layer order theo 0.5: evasion → block khi có → max res cap → ES/Life pool → Runic Ward khi có rune → recovery (Ghost Dance + life on hit). Ritualist life + ES hybrid với sustain charm; Amazon nghiêng evasion mạnh nhờ Stalking Panther.

Số tham chiếu poe.ninja 2026-06-10 (snapshot thật, không PoB derive — PoB2 chưa model đủ Twister consume + Trinity → `pob_coverage: PARTIAL`):
- **Ritualist top DPS (MinionSpinAgain, Lv98):** DPS 480k · Life 2,729 · ES 722 · EHP ~11k. Glass-cannon.
- **Pathfinder Twister cùng mẫu:** 469k DPS với EHP ~31k, 427k với EHP ~35k — pool cao gấp 3 con Ritualist ở DPS gần bằng.
- **Mẫu Twister:** 28 char có DPS trong top sample; Twister xuất hiện 3 lần trong top-10 DPS toàn ladder (~427k–480k). Skill Twister 13.1% ladder.

Math chain Twister boss DPS:

```
base_hit (set 2 spear)
  × engine_consume (cộng 80% more / Whirlwind stage, max 3 stage)
  × Trinity (more elemental theo total Resonance, cần balance ba dòng)
  × The_Taming (increased damage per ground type, ba ailment apply)
  × crit_multiplier (Ritualist: crit cluster; Amazon: + excess-accuracy crit + Penetrate flat)
  × ascendancy_more (Ritualist 1.15× Corrupted Lifeforce / Amazon 1.5× Predatory Instinct vs boss)
  × Harness_Elements (1.6×, 3 element type)
  / hit_throttle (0.66s same-target cap cho twister cùng frame)
  = boss DPS floor
```

- Throttle 0.66s = gate cứng: twister cùng frame chỉ hit cùng target 1 lần mỗi 0.66s. Spam projectile (mark, herald) chỉ scale clear. Amazon Predatory Instinct (50% more) đẩy boss DPS tốt hơn — more-multiplier vào chỗ throttle không chặn.

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 5 |
| boss_damage | 4 |
| survivability | 3 |
| mobility | 4 |
| league_start | 4 |
| budget_scaling | 4 |

- survivability 3 vì mẫu Ritualist top-DPS chạy EHP ~11k rất mỏng; hi-sinh ít DPS lên ~25-30k EHP như mẫu Pathfinder → survivability 4.

## Gear

Priority order: cap res 75/75/75 (tính cả −20% all ele res tree Ritualist) → attribute floor cho support tier cao → flat elemental 3 dòng cho Trinity balance → spear damage + crit → +Level projectile (amulet, helm anoint) → ES/eva hybrid → reservation efficiency.

- **Weapon set 1 (spear):** attack speed cao nhất, suffix attack speed + life on hit. Mục tiêu ≥2.36 APS.
- **Weapon set 2 (spear):** flat elemental + crit. Spear flat lightning lớn rất quý cho Trinity balance (lightning phải craft chủ động; cold tự dư từ Ice-Tipped Arrows, fire từ sceptre).
- **Off-hand set 2 (sceptre):** nguồn extra fire cho Trinity. Cần double socket cắm Rabbit Idol (+15% spirit) — bù spirit hụt Ritualist, đủ chỗ Trinity + 2 herald.
- **Helmet:** full ES + res. Anoint Subdivision Mask hoặc cụm crit trước khi có CI.
- **Body:** ES/eva hybrid + life + res. Ritualist cần life roll; Amazon body chỉ cho nửa evasion (Stalking Panther) → ưu tiên ES/life roll trên body, dồn evasion sang helm/glove/boot.
- **Gloves:** flat lightning T1 (Trinity balance) + res + attribute. Amazon thêm accuracy roll cho Penetrate.
- **Boots:** eva/ES hybrid + movement speed 30% + res.
- **Belt:** res cap + life. Endgame :wiki-link{url="https://www.poe2wiki.net/wiki/Darkness_Enthroned"} cho rune frenzy/speed, biến belt thành damage. Ritualist tận dụng charm slot belt mạnh hơn nhờ cụm charm ascendancy.
- **Amulet:** ES/eva + projectile level + res. Anoint cụm 60% inc damage per elemental type.
- **Rings:** flat elemental + res + attribute. **Ritualist chạy 3 ring** (Unfurled Finger), mỗi ring +25% bonus (Mystic Attunement) — lợi thế gear lớn nhất. Amazon 2 ring, ưu tiên accuracy + flat ele. The Taming build-defining cho cả 2 khi mua được.
- **Jewels:** From Nothing (Diamond, allocate quanh CI cho Heavy Frost late) + Heart of the Well (Diamond desecrated, custom mod gain damage as element thiếu) + crit/projectile jewel theo socket.

### Leveling → Late endgame

- **Leveling:** Whirling Slash + Twister ngay sau engrave (cả 2 Tier 1). Spear armour/life base, stack inc damage + cold + crit. Campaign mượt gần standalone.
- **Early Atlas (T1-T6):** chuyển eva/ES hybrid (tree allocate ES node thì base phải có ES roll). Spear set 1 attack speed, set 2 rare lightning + crit rẻ. Anoint cụm crit cheap.
- **Mid endgame (T7-T13):** The Taming khi mua được (giảm giá rõ sau tuần đầu), Ice-Tipped Arrows convert, marks setup, Darkness Enthroned. Ritualist mở ring thứ 3 + Mystic Attunement; Amazon dồn accuracy cho Penetrate.
- **Late endgame (T14-T16, pinnacle):** From Nothing CI + Heavy Frost, Sniper's Mark + Eternal Mark cho frenzy (Ritualist), spear T1 ele + crit hoặc unique transition spear. Amazon hoàn thiện charge source cho Elemental Surge.

## Companion, Pounce, Cackling Companions

Build không dùng companion; nói rõ vì meta report dễ gộp nhầm. Trong list skill phổ biến poe.ninja, "Pounce" và "Cackling Companions" đứng gần Twister/Whirling Slash nhưng không cùng vũ khí:

- **Cackling Companions** là companion skill grant duy nhất bởi :wiki-link{url="https://www.poe2wiki.net/wiki/Hysseg's_Claw"} — Familial Talisman (vũ khí Druid), summon 6-9 Hyena. Cần 1 weapon slot cầm Talisman, mà Twister cần spear ở cả 2 set → ghép phải hi-sinh dual-spear lấy 1 set Talisman swap-summon, không đáng cho self-cast projectile. Thuộc build companion (Druid hoặc cross-class talisman).
- **Pounce** là werewolf meta skill của Druid (Shapeshift into Werewolf, requires Talisman, summon wolf minion). Không dùng spear, không liên quan Twister.
- **Whirling Assault** (hay nhầm với Whirling Slash) là quarterstaff strike skill của Monk, không phải spear.

Ascendancy xác nhận: cả Ritualist lẫn Amazon đều không có node companion. Nhánh Huntress duy nhất xoay quanh companion là Spirit Walker (viết riêng). Muốn build companion thật (hyena, beast pack) → Spirit Walker hoặc Druid.

## Failure Modes

Làm tốt: clear T15-T16 nhờ projectile multi-hit + freeze shatter · leveling campaign mượt nhờ engine consume · freeze-lock cả damage lẫn defense cùng lúc. Chỗ gãy:

- **Pool quá mỏng nếu copy con top-DPS.** Mẫu Ritualist 480k EHP ~11k — 1 slam pinnacle là chết. Cần chủ động hi-sinh DPS lên ~25-30k EHP (như mẫu Pathfinder cùng DPS nhưng EHP gấp 3). Đừng nhìn 480k rồi copy gear glass-cannon bỏ qua pool.
- **Throttle 0.66s khoá boss DPS.** Twister cùng frame chỉ hit cùng target 1 lần mỗi 0.66s. Thêm projectile chỉ scale clear. Boss damage từ crit damage + more multiplier (Amazon Predatory Instinct tốt nhất), không từ stack thêm twister.
- **Trinity balance fragile.** Stack lệch 1 element (quá nhiều fire từ sceptre khi chưa có flat lightning T1) làm Resonance 1 dòng đầy còn 2 dòng decay, more multiplier teo. Cân 3 dòng gần bằng nhau; Heart of the Well custom mod tinh chỉnh sau khi gear chốt.
- **Amazon thiếu accuracy hoặc charge là chết engine.** Critical Strike + Penetrate vô dụng nếu accuracy thấp; Elemental Surge không trigger nếu không có nguồn charge consume. Amazon dưới gear floor chạy yếu hơn hẳn Ritualist cùng budget — không phải nhánh league-start tay không.
- **Ritualist gánh res âm trên tree.** −20% all ele res + spirit/mana hụt → craft gear overcap res nhiều hơn + ưu tiên reservation efficiency. Quên tính dẫn tới uncap res hoặc thiếu spirit cho herald + Trinity.
- **Map mod hostile.** Less recovery + no leech cắt sustain charm (Ritualist) + leech (Amazon); reduced charge gain cắt frenzy mark (Ritualist) + Elemental Surge (Amazon). Reflect ít ảnh hưởng vì self-cast nhưng less damage taken không cứu pool mỏng.
- **Patch sensitivity.** Phụ thuộc Twister consume + Trinity + The Taming ground interaction. Nerf max more Trinity, đổi semantics "count as boosted by ground" The Taming, hoặc đụng throttle/consume Twister → mất 30-60% DPS. Log số thật client mỗi hotfix.

## Verdict

Nhánh đẩy DPS thật cao nhất Huntress spear meta — Twister top-10 DPS toàn ladder 3 lần, cao nhất 480k Ritualist. Engine consume Whirlwind cho leveling mượt từ Act 1 + clear endgame mạnh; freeze-lock vừa damage vừa defense. Chọn Ritualist cho dễ ráp + sustain + top DPS proven, Amazon cho ceiling boss cao hơn nếu sẵn sàng accuracy + charge.

Điểm thẳng thắn từ data: trong mẫu Twister top-DPS, Pathfinder (Ranger) thật ra xuất hiện nhiều hơn cả Ritualist — 2 con 469k và 427k cao nhất sau con Ritualist 480k đều Pathfinder, chạy EHP gấp 3 (~31-35k) ở DPS gần bằng. Twister là spear skill nhưng class nào đạt attribute requirement đều cầm spear được → Pathfinder spear-Twister là hướng cross-class đáng theo dõi (flask uptime + projectile của Pathfinder bù pool tốt hơn). Doc này scope 2 nhánh Huntress theo issue, nhưng nếu mục tiêu DPS-per-EHP tối ưu thì Pathfinder là ứng viên khảo sát riêng.

Số 480k là DPS đo snapshot poe.ninja 2026-06-10, không PoB verified (PoB2 chưa model đủ Twister consume + Trinity). Treat như ceiling tham chiếu; log số thật client khi ráp full kit.

## Changelog

### 2026-06-10
- Initial draft. Verify verbatim từ wiki cho Twister/Whirling Slash (spear skill, consume engine, throttle 0.66s), Ritualist + Amazon ascendancy node, và Cackling Companions/Pounce/Whirling Assault (xác nhận skill Druid talisman / Druid werewolf / Monk quarterstaff — KHÔNG thuộc build spear Twister). Số DPS/population từ snapshot `data/poe-ninja/runesofaldur/snapshots/2026-06-10.json` (mẫu 28 char Twister, top 480k Ritualist). Engine elemental (Trinity, The Taming, Ice-Tipped Arrows, Heavy Frost, From Nothing) dùng chung với bản Spirit Walker.

## Relationships

- **alternative_to** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — cùng engine Twister consume nhưng ascendancy khác: bên kia self-cast Spirit Walker, bên này 2 nhánh meta Ritualist/Amazon.
- **alternative_to** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — muốn build companion thật thay self-cast projectile → hướng companion-pack Huntress.
- **related_mechanics** [Twister — Spear Wind Projectile Skill](/guides/twister) — engine consume Whirlwind, throttle 0.66s, element gain từ ground.
- **related_mechanics** [The Taming — Tripled Wind Skill Ground Effect](/guides/the-taming) — ring cộng increased damage per ailment ground cho Wind Skill.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — league 0.5 với Trinity rework và ground effect interaction cho Wind Skill.
- **alternative_to** [Magic Find Spell Ritualist](/builds/huntress/0-5-ritualist-rarity-solo-duo) — Ritualist hướng self-DPS thuần, dùng Unfurled Finger + ring economics khác hẳn.
- **alternative_to** [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) — Ritualist self-DPS; Unfurled Finger + Ingenuity ring economics dùng cách khác hoàn toàn.
