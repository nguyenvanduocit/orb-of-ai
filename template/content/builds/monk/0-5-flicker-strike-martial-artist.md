---
document_type: build
title: Flicker Strike Martial Artist
class: Monk
ascendancy: Martial Artist
league: '0.5'
patch: 0.5.2
status: draft
author: duocnv
created: '2026-06-15'
updated: '2026-07-03'
budget_tier: high-budget
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Flicker Strike
  damage_type: Lightning
  playstyle: Melee
  content_focus: Mapping / Bossing
tags:
- poe2
- monk
- martial-artist
- flicker-strike
- power-charge
- crit
- lightning
- quarterstaff
- energy-shield
- culling
template: templates/build-template.md
---

# Flicker Strike Martial Artist

Teleport-strike point-blank: nạp đầy :wiki-link{url="https://www.poe2wiki.net/wiki/Power_Charge"} → :wiki-link{url="https://www.poe2wiki.net/wiki/Flicker_Strike"} dump hết thành chuỗi teleport-strike. Damage = crit nguyên tố (lightning/cold quarterstaff), KHÔNG phải phys. Off-meta high-budget, zoomer clear.

## Build Overview

- **Damage:** crit nguyên tố quarterstaff (flat lightning + cold) → scale bằng increased Elemental Damage with Attacks → crit nhân lên
- **Beacon of Azis:** crit bỏ qua hoàn toàn elemental resistance quái → crit chạm trần = mọi hit Flicker ăn full như enemy 0 res
- **Engine charge (tách khỏi damage):** :wiki-link{url="https://www.poe2wiki.net/wiki/Martial_Artist"} (mọi skill sinh charge khi crit) + :wiki-link{url="https://www.poe2wiki.net/wiki/Redflare_Conduit"} (20% sinh charge/hit) + :wiki-link{url="https://www.poe2wiki.net/wiki/Killing_Palm"} (Charge Profusion)
- **Culling:** :wiki-link{url="https://www.poe2wiki.net/wiki/Deathblow"} (Culling Strike) + :wiki-link{url="https://www.poe2wiki.net/wiki/Myris_Uxor"} (100% increased Culling Strike Threshold) + Killing Palm cull ramp → trash trắng xoá ngay khi rớt dưới ngưỡng cull
- **Defense:** Chaos Inoculation (pool = ES, đứng 1 life) + Evasion/Deflection Monk + cull-clear (trash chết trước khi chạm)
- **Ràng buộc cứng:** Beacon of Azis + crit gần trần; Flicker "You cannot gain Power Charges while using this Skill" → charge phải nạp giữa các Flicker, không trong lúc đánh
- Damage/Flicker = số strike × damage mỗi strike; số strike = 2N+1 (N = charge tiêu thụ)
- 285% more Attack Speed nén chuỗi vào một khoảnh khắc → sustained DPS chặn bởi tốc độ refill charge, không phải animation
- Single-target yếu cấu trúc: boss không add/kill để refill → :wiki-link{url="https://www.poe2wiki.net/wiki/Falling_Thunder"} nuke (tiêu Power Charge, nova lightning lớn)

## Skill Gems & Links

- **Main clear (6L):** Flicker Strike + Hit and Run + Momentum + :wiki-link{url="https://www.poe2wiki.net/wiki/Close_Combat"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Perpetual_Charge"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Heightened_Charges"}
  - Close Combat: tới 20% more attack damage trong 1 mét (Flicker luôn dí mặt → gần full)
  - Perpetual Charge: 25% chance không remove charge nhưng vẫn count as consumed
  - Heightened Charges: 20% chance benefit-từ-consume nhân đôi
  - 0.5.2 fix: trước 0.5.2 hai support modify-charge bug mutual-exclusive với skill consume charge; patch fix → Flicker stack cả hai
- **Boss dump:** Falling Thunder + Perpetual Charge + Heightened Charges + Nova Projectiles + Pinpoint Critical + Ricochet
- **Buff/clear phụ:** :wiki-link{url="https://www.poe2wiki.net/wiki/Charged_Staff"} (uptime 100%, flat lightning + crit) + Innervate + Blazing Critical + Pinpoint Critical + Blind + Thrill of the Kill · :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Thunder"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ash"} song song · :wiki-link{url="https://www.poe2wiki.net/wiki/Tempest_Bell"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Whirling_Assault"} weave combo + crit
- **Engine charge (ngoài link Flicker):** Killing Palm + Charge Profusion + Culling Strike
- `Exclusion check:` KHÔNG cắm Brutality (xoá non-physical → giết lightning/cold + Charged Staff). Culmination không support Flicker vì Flicker đã gain Combo qua Martial Artist ("Cannot support skills which already gain Combo")

## Ascendancy

- Martial Artist > :wiki-link{url="https://www.poe2wiki.net/wiki/Invoker"}: Invoker + Flicker = charge starvation (Flicker tiêu sạch, không tự sinh)
- Node định nghĩa: mọi skill sinh power charge khi crit → crit gần trần + 5-6 nguồn crit = charge refill liên tục ngoài frame Flicker ("infinite charges" thực sự)
- Deathblow: Fist of Stone + Culling Strike → cull-clear
- Bell (Hollow Resonance, Hollow Focus): carry spectral bell + combo liên tục, quý cho single-target
- Rune socket phụ: mật độ stat cap res + đệm phòng thủ (Invoker không có)
- Thứ tự: node sinh charge → combo/bell → Deathblow → rune socket

## Stat Priorities & Defenses

- Tree: mọi node +max Power Charge, increased Critical Hit Chance, Critical Damage Bonus, attack speed, quarterstaff/elemental damage
- Max Power Charge = stat đắt giá nhất (tăng số strike/Flicker + trần burst) — node tree = khác biệt 13 hit vs 19 hit mỗi bấm
- Crit chance kéo gần 100%: vừa nuôi engine charge vừa mở Beacon of Azis (thiếu crit = đói charge + mất damage cùng lúc)
- Damage nguyên tố: flat lightning + cold weapon × increased Elemental Damage with Attacks × crit × Beacon of Azis. Nhẫn lo flat lightning to attacks (không flat phys)
- **Defense CI:** pool = Energy Shield, đứng 1 life. :wiki-link{url="https://www.poe2wiki.net/wiki/Shavronne%27s_Satchel"} "Life Recovery from Flasks also applies to Energy Shield" → Ultimate Life Flask hồi thẳng ES
- Nền: Evasion + Deflection (Monk), Guard 499 từ Thawing Charm, Spirit of the Stag 20 giây từ :wiki-link{url="https://www.poe2wiki.net/wiki/Rite_of_Passage"}
- Vẫn là melee dí mặt: ES dày không cứu slam boss đọc trượt

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 5 |
| boss_damage | 4 |
| survivability | 3 |
| mobility | 5 |
| league_start | 1 |
| budget_scaling | 4 |

## Gear Progression

Ưu tiên: cap resist 75% → Dex/Str/Int gem requirement (110/70/115) → max Power Charge → crit chance + crit damage → flat elemental damage + attack speed → ES đệm. Engine charge + cull gắn vào slot cụ thể (không nhường cho stat khác).

- **Weapon (quarterstaff):** rare elemental — flat lightning + cold dày, increased Elemental Damage with Attacks, crit chance, attack speed. Bản bossing thêm increased stun buildup ở suffix cuối
- **Amulet:** Beacon of Azis — "Critical Hits ignore Enemy Monster Elemental Resistances" + Spirit + mana. ~1 ex
- **Body:** Redflare Conduit — "20% chance to gain a Power Charge on Hit"; "Shocks you when you reach maximum Power Charges" (shock nhỏ, on-hit charge mới là chính). Trước Redflare: :wiki-link{url="https://www.poe2wiki.net/wiki/Voll%27s_Protector"} (gain Power Charge on Critical Hit)
- **Helmet:** Myris Uxor — 100% increased Culling Strike Threshold + evasion + accuracy + mana
- **Gloves:** Deathblow — Culling Strike, 18% more global Evasion và ES, hồi life/mana khi kill, cull threshold ramp
- **Boots:** rare ES cao + movement speed — Sekhema Sandals ~99% increased Energy Shield + flat ES + 35% MS
- **Belt:** Shavronne's Satchel — "Life Recovery from Flasks also applies to Energy Shield" + flask charges + Int
- **Ring ×2:** Unset Ring (thêm skill slot), flat lightning to attacks, resist (fire/lightning), evasion, rarity
- **Flask & charm:** Ultimate Life Flask (hồi ES qua Shavronne's Satchel) · :wiki-link{url="https://www.poe2wiki.net/wiki/Lavianga%27s_Spirits"} (mana liên tục) · :wiki-link{url="https://www.poe2wiki.net/wiki/The_Fall_of_the_Axe"} (Onslaught) · Thawing Charm (Guard) · Rite of Passage (Spirit of the Stag)

**Theo giai đoạn:**

- Campaign: quarterstaff strike thường (Ice Strike / Tempest Flurry) tới Flicker level 52 (base 3 charge → burst mỏng, chưa đáng bật)
- "Online" ~level 55: Voll's Protector reforged (Verisium Anvil hạ requirement 59→55) → charge bắt đầu chảy
- Endgame: đổi Redflare Conduit, ráp cull threshold (Deathblow + Myris Uxor), crit gần trần → Beacon of Azis + engine charge cùng bật

## Budget & Investment

- KHÔNG phải league-start. Core khởi động rẻ: Voll's Protector reforged <1 div, Beacon of Azis ~1 ex
- Mốc nặng: vũ khí elemental crit ~100 div (bản bossing có stun buildup), Myris Uxor reforged ~40 div, Redflare Conduit cultivated 120+ div
- Diminishing returns khi charge topped up + trash chết trong một cull → dồn crit multi + flat elemental cho burst dày hơn

## Failure Modes

- **Charge starvation trên boss** (điểm gãy số một): boss không add/kill để refill → weave Whirling Assault + Tempest Bell build combo+crit rồi dump, hoặc Falling Thunder nuke. Pilot kém = DPS boss tụt thẳng
- **Map mod hostile:** "Less recovery" cắt sustain ES qua flask · "Monsters gain a Power Charge on Hit" → quái crit mình nhiều · elemental reflect = sát thủ thật (Flicker bung hàng chục hit nguyên tố trong một khoảnh khắc → reflect one-shot). Né elemental reflect
- **One-shot:** CI ES dày nhưng Monk thiếu armour/block + point-blank → boss slam T16/pinnacle hoặc Simulacrum wave cao xuyên EHP. Dodge tay, không face-tank
- **Gear floor:** chỉ đạt số khi crit gần trần + cull overcap + đủ flat elemental. Dưới floor: charge cạn, trash không cull, như một skill rưỡi. Không có chế độ "nghèo mà chạy"
- **Patch sensitivity:** identity = power-charge generation + cull threshold. GGG nerf charge consumption Flicker (cap reduction 75% thay vì 100%) → giết bản Gemling giảm-tiêu-charge, KHÔNG đụng bản generation này. Nerf node Martial Artist / Redflare Conduit / clause "cannot gain Power Charges while using this Skill" → sụp. Cull threshold siết → cắt clear speed

## Verdict

- Zoomer clear nhanh nhất game cho người chịu đầu tư crit-charge engine + pilot single-target. Ngưỡng chạy đúng: crit gần trần + cull overcap; dưới ngưỡng đừng đụng
- Off-meta: không lọt top skill league; Martial Artist chưa đủ mẫu trong class distribution runesofaldur; Monk meta = Hollow Palm + Hollow Focus trên Invoker
- Chưa có DPS công khai cho combo này (poe.ninja trống, mobalytics không tính, forum/reddit không quote) → tự đo in-client: crit%, số strike/Flicker, DPS Falling Thunder boss. PoB2 0.5 fork chưa model burst 285%-more-AS-per-charge + node Martial Artist → đừng tin số sim
- Hợp Monk tier cao muốn dự án high-budget teleport non-stop; không hợp build an toàn/league-start

## Changelog

### 2026-06-15
- Viết lại quanh bản chạy thật: damage nguyên tố crit (lightning/cold quarterstaff + Beacon of Azis bỏ qua ele res) thay pure-phys Brutality; phòng thủ CI ES + Evasion + cull threshold; engine charge Redflare Conduit + generate-on-crit + Killing Palm Charge Profusion
- Giữ phần draft đoán trúng: Perpetual Charge + Heightened Charges trên Flicker (0.5.2), Falling Thunder boss dump, charge starvation là điểm gãy. Nguồn gear: build Skybreaker Martial Artist (shadowclone515) mobalytics. Nerf charge-consumption Flicker 0.5 (cap 75%) không đụng bản generation này

## Relationships

- **related_builds** [Martial Artist Hollow Palm](/builds/monk/0-5-martial-artist-hollow-palm-leaguestarter) — bản Martial Artist unarmed/Facebreaker, route league-start thay high-budget elemental crit Flicker
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview 0.5, rune system + endgame rewrite build tận dụng cho rune socket
