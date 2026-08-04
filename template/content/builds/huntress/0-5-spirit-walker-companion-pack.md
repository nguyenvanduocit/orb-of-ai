---
template: templates/build-template.md
document_type: build
title: Tame Beast Companion Pack Spirit Walker
status: draft
author: duocnv
created: '2026-05-29'
updated: '2026-07-03'
class: Huntress
ascendancy: Spirit Walker
league: '0.5'
patch: 0.5.3
budget_tier: mirror-tier
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Tame Beast
  damage_type: physical
  playstyle: companion
  content_focus: all-content
tags:
  - huntress
  - spirit-walker
  - tame-beast
  - companion
  - pack
  - chober-chaber
  - giants-blood
  - morior-invictus
  - minion
  - crit
  - armour-break
  - 0-5
  - poe2
---

# Tame Beast Companion Pack Spirit Walker

Bắt beast bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"}, ráp đàn companion quanh 1 con crit carry (Zekoa the Headcrusher giữ Extra Crits gánh single target) + đàn aura bot phủ phys/haste/ES/ele-res + shock/ignite, 1 con Periodic Invulnerability Aura, Wolf Pack trám clear, Bear + Azmerian Wolf granted miễn phí. Nguyên tắc chi tiêu: **spirit không trả cho DPS riêng của 1 con — chỉ trả carry, multiplier toàn đàn, hoặc lớp giữ mạng**; sub-DPS thật = 2 con granted không tốn gì (poe.ninja đo Bear + Azmerian Wolf mỗi con ~132k). Character thật Lv96, clear T15 ổn định.

## Build Overview

- **Damage dồn về 1 con.** Zekoa giữ **Extra Crits** (300% increased Critical Hit Chance, nhân 4 base crit) → engine crit đổ vào nó: 8 viên jewel magic Minion Critical Damage Bonus (~21-24%/viên) được :wiki-link{url="https://www.poe2wiki.net/wiki/The_Adorned"} nhân 108% effect + 2 Unset ring (Corruption Finger, Morbid Circle) mỗi viên ~22-25% Minion Critical Damage Bonus + :wiki-link{url="https://www.poe2wiki.net/wiki/Sniper's_Mark"} trả crit damage bonus cho cú crit kế lên Marked. Con khác không crit → mọi đầu tư crit = cho Zekoa.
- **Nền damage 2 hướng.** (1) Level: đàn ăn +10 Level of all Minion Skills từ :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} (+4) + Skull Corona (+2) + Empyrean Locket fractured (+4) → companion gem L19-20 chạy như L29-30. (2) Flat phys qua :wiki-link{url="https://www.poe2wiki.net/wiki/The_Catha's_Balance"}: companion nhận Attack Damage bằng phần damage main-hand; Chober Chaber Runeforged phys cao, đổi lấy 2 mod sceptre không cho (+4 minion levels + "Increases and Reductions to Minion Damage also affect you"). Cầm greathammer một tay nhờ keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Giant's_Blood"} (chừa tay kia cho Sylvan's Effigy).
- **Single target engine 2: armour break.** Mark for Death II biến mọi hit đàn lên Marked thành armour break bằng 15% phys gây ra; Bramble Rhoa Breaks Armour góp; Uruk's Smelting trên Wolf Pack, full break → mục tiêu **vĩnh viễn chịu thêm 5% phys, stack tới 20%**, sống xuyên khoảng trống mark. Uruk's cưỡi Wolf Pack (nguồn hit tần suất cao nhất, 7 con sói). Mức stack chính xác đọc client.
- **Defense xếp lớp:** evasion 8,625 / deflection 7,115 đỡ entry, armour 1,941 phys DR mỏng; ES 1,929 + Life 1,885 pool, :wiki-link{url="https://www.poe2wiki.net/wiki/Mind_Over_Matter"} đẩy damage sang mana 1,384; :wiki-link{url="https://www.poe2wiki.net/wiki/Ghost_Dance"} hồi ES theo evasion sau mất shroud; lưới giữ đàn (Loyalty rải redirect, Romira's Requital trên Bear, Periodic Invulnerability Aura của Swarming Wasp). **Ở lì weapon set 1, không weapon-swap** (swap = despawn cả đàn, bug spirit desync chưa fix).

## Đàn companion (roster)

7 con tamed chiếm spirit, mỗi con 1 vai do mod retained. Chỉ dòng "… Aura" phủ cả đàn (allies trong presence); All Damage Shocks/Ignites không phải aura nhưng dán ailment lên enemy con đó đánh → đàn hưởng gián tiếp; Extra Crits / Breaks Armour / Shroud Walker / Extra Cold Damage chỉ thuộc con mang nó.

| Con | Aura phủ đàn | Self/khác | Reservation | Vai |
|---|---|---|---|---|
| Zekoa the Headcrusher | — | Extra Crits (+ slot rác Periodically unleashes Ice, chờ fish) | 47.4% + 30 Tangmazu | carry duy nhất; bản unique của :wiki-link{url="https://www.poe2wiki.net/wiki/Mighty_Silverfist"}, bắt qua The Natural Order |
| Coconut Crab | Extra Physical Damage Aura | All Damage Ignites | 24% | Meat Shield body-block |
| Fungal Wolf | Energy Shield Aura | All Damage Ignites; Powerful Minions (self) | 30% | vẫn đánh, ăn đủ damage support |
| Bramble Rhoa | Haste Aura | Breaks Armour + Burning Ground on Death | 34.2% | — |
| Quill Crab | Temporal Bubble | All Damage Shocks + Extra Cold Damage self | 24.9% | Meat Shield body-block |
| Hyena Demon | Elemental Resistance Aura | Cold Resistant self | 30% | — |
| Swarming Wasp | Periodic Invulnerability Aura | Shroud Walker + Extra Cold Damage self | 21% | filler rẻ nhất, gánh lớp thủ đáng nhất |

- Wolf Pack (60 spirit flat, ra 7 con sói, level bằng Uncut Spirit Gem) gánh clear + Uruk's Smelting cho break. 2 nguồn granted không tốn gem slot/spirit: Azmerian Wolf từ Sylvan's Effigy + Bear từ :wiki-link{url="https://www.poe2wiki.net/wiki/Wild_Protector"} — poe.ninja đo Bear ~126.6k, Azmerian Wolf ~126.9k, reserve 0 điểm.
- Companion gem nuôi cả level (Uncut Skill Gem) + quality (Gemcutter's Prism áp thẳng, Q20 = 10% Reservation Efficiency) sau capture. Tame Beast Q20 trước tame → companion sinh Q20, quên thì 4 GCP vá. Bản Zekoa thứ 2 dự phòng ở weapon set 2, không reserve khi chưa kích.

## Skill Gems & Links

2 support redirect (Romira's Requital, Loyalty) cùng category "Loyalty" → 1 con chỉ cắm 1 trong 2.

- **Zekoa 5-support:** Rage III + Feeding Frenzy II + Rapid Attacks II + **Tangmazu's Thurible** + Muster. Tangmazu's Thurible cho carry thành Gigantic + mượn evasion/deflection của mình (+4 mỗi 10 điểm) để Zekoa tự tank. Rage III giữ 30 rage cho +30% more attack damage; đổi engine rage tập trung thì slot nhường Supercritical (Chase tier).
- **Bear (Wild Protector) 5-support:** Catha's Brilliance + **Romira's Requital** + Rapid Attacks II + Magnified Area II + Hulking Minions. Romira's ở đây vì Bear granted, chết tự hồi. Bear thiếu Feeding Frenzy II + Muster (2 multiplier lớn nhất) nên carry 132k vẫn dưới chuẩn — sửa rẻ nhất ở Chase tier.
- **Azmerian Wolf 5-support:** Feeding Frenzy II + **Kurgal's Leash** + Muster + Loyalty + Rapid Attacks II. 1 phím Command xả Eternal Hunt + kích Unholy Might **15 giây** cho mình lẫn Wolf.
- **Wolf Pack 5L:** Minion Splash II + **Uruk's Smelting** + **Heft** + Muster + Feeding Frenzy II — engine clear + nguồn full-break vĩnh viễn, Heft 30% more max phys hit damage.
- **Companion damage (Fungal Wolf, Hyena Demon, Bramble Rhoa, Swarming Wasp):** mỗi con Rage III + Loyalty + Rapid Attacks II + Muster + Feeding Frenzy II.
- **Body-block bot (Quill Crab, Coconut Crab):** Rage III + Loyalty + **Meat Shield II** + Last Gasp + Minion Mastery. Meat Shield II: deal 40% less damage đổi 40% less damage taken → chỉ đứng phủ aura + chặn đường; Rage III trên chúng gần vô tác dụng.
- **Mark package:** Sniper's Mark + Mark for Death II + **Cooldown Recovery II** + Eternal Mark + Charged Mark + **Second Wind III**. Mark kích khi mục tiêu ăn crit rồi bị consume; Zekoa full crit nên mark bị ăn sau ~2-3 hit. Cooldown Recovery II + Second Wind III (2 charge) giữ uptime vì Sylvan's Effigy chỉ phát 90% increased companion damage vs Marked khi mark còn sống → mỗi giây mark tắt cả đàn mất 90% damage boss. Mark for Death II = mảnh break đầu (15% phys mỗi hit lên Marked).
- **Aura player:** Discipline (granted từ Sylvan's Effigy, không reserve) chạy ES · Ghost Dance (+ Cooldown Recovery II + Clarity II) hồi ES theo evasion · Purity of Lightning. Parry ở weapon set 2 cùng Dunkelhalt, dormant chờ fix swap.
- `Exclusion check`: Romira's Requital × Loyalty cùng category "Loyalty" (Romira's lên Bear, Loyalty rải con khác); Lineage support (Catha's Brilliance, Kurgal's Leash, Uruk's Smelting, Tangmazu's Thurible) mỗi gem đúng 1 bản toàn build.

## Spirit ledger

- Pool 439, full pack 7 con tamed. Anoint The Soul Meridian (ES recovery) thay Gigantic Following — gỡ 25% reduced Reservation Efficiency mà Gigantic Following bắt trả, và chính khoản đó + pool 439 mới đủ chỗ. Trusted Kinship cho companion 30% more Reservation Efficiency đổi 20% less cho skill non-companion.
- Reservation tooltip: Zekoa 47.4% (+30 flat Tangmazu) · Bramble Rhoa 34.2% · Fungal Wolf 30% · Hyena Demon 30% · Quill Crab 24.9% · Coconut Crab 24% · Swarming Wasp 21% · Wolf Pack 60 flat. Gross tamed ~211% trước efficiency. Tree kéo xuống: Easy Going 25% increased Reservation Efficiency of Companion Skills, Lord of Horrors 12% của Minion Skills, helm rune 8%, Effigy 75% increased Spirit. Headroom đọc client; 3 nguồn granted (Azmerian Wolf, Wild Protector, Discipline) không reserve.

## Ascendancy

- :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} thứ tự **Wild Protector → The Natural Order → The Catha's Balance → :wiki-link{url="https://www.poe2wiki.net/wiki/Idolatry"}**. Wild Protector cho Bear ngay Lab 1 (tank miễn phí). The Natural Order mở tame Unique Beast (cửa vào Zekoa). The Catha's Balance = multiplier không gate gear, biến main-hand thành flat damage cả đàn. Idolatry cuối vì thuế: companion 10% increased damage mỗi Idol nhưng **mỗi non-Idol augment trên gear = -4% all elemental res**.
- Idolatry → rule cứng cho mọi swap augment: đọc res tab trước/sau từng lần đổi rune — số nhảy ±4% nghĩa là classification augment khác giả định, dừng tính lại. Thuế ~-53% all ele (~13 non-idol augment) → kênh res ít nguồn gear tụt sâu nhất: cold chỉ có Dusk Lock nên rớt còn 15, fire/light có 3-4 nguồn nên trụ 72 và 75.

## Passive Tree

- 3 keystone: **Giant's Blood** (cầm Chober Chaber một tay), **Trusted Kinship** (gốc spirit ledger), **Mind Over Matter** (mana 1,384 thành đệm EHP đẩy phys max hit). Tree nuôi đàn: Easy Going + Lord of Horrors (reservation efficiency), Vile Mending (minion 20% inc max life + regen 3%/s + +13% chaos res), Entropic Incarnation (minion +13% chaos res + 10% phys-as-chaos), Lifelong Friend (đàn revive nhanh 35% khi mọi minion đều companion). Thủ player: Blur + The Wild Cat (evasion + node chuyển evasion thành deflection).
- 5 điểm cuối Lv96→100 dồn cụm evasion-to-deflection + minion-life, đừng đụng Glancing Blows (unlucky evade phá layer entry). Sau 0.5.3: **Staunch Deflection** (cluster Ranger Đông-Nam, qua 2 Deflection + 1 Evasion Rating) thêm Deflection Rating bằng 8% Evasion Rating → eva live 8,625 = +690 deflection, đẩy 7,115 lên 7,805, chance deflect +2-3pp tuỳ accuracy; + 2 dòng cũ "deflected hits không gây Bleeding/Maim". Cái phải trả: từ node allocated gần nhất đi 4 node → ăn trọn 5 điểm cuối, để lại 1 điểm cho minion-life. 21 điểm Parry ở weapon-set-2 points, dormant 0 cost.
- Verify client: mở cluster Deflection (từ Attribute SE qua Deflection → Evasion Rating → Deflection → Staunch Deflection) đếm đúng 4 unallocated nodes, đọc deflection rating tab trước/sau tăng ~690.

## Stats & Defenses

Snapshot Lv96, poe.ninja model 2026-06-14. Tracking: [character note ThaoCamVienSaiGon](/characters/thao-cam-vien-sai-gon).

- **Life / ES:** 1,885 / 1,929 · **Spirit:** 439 · **Mana:** 1,384
- **Armour / Evasion / Deflection:** 1,941 / 8,625 (evade 48%) / 7,115 (deflect 43%)
- **Res:** Fire 72 / Cold 66 / Light 75 (overcap 31) / Chaos 72 — cold 66 lỗ duy nhất dưới cap
- **EHP:** 19,432 · **Max hit phys:** 4,120 (kênh mỏng nhất, element đều >10k) · **MS:** 128%
- 3 dòng Bonded cold/light/chaos trên Morior + sceptre là ShamanOnlyMods, Huntress không kích → số 0. Thứ tự stat EHP-first: **cap cold 66→75** (roll cold trên ring/craft cold belt) → **dày phys EHP** (armour, life-ES flat, % phys taken as element san về element >10k) → đọc crit% + DPS Zekoa in-client.
- **EHP layer order:** redirect vào máu đàn (Loyalty rải, Romira's Bear) → evasion/deflection entry → armour 1,941 (phys DR 17%) → Mind Over Matter → max res → ES 1,929 + Life 1,885 pool → Ghost Dance regen → recovery. Redirect mỏng vì roster không có con mang "Damage Taken From Minions First". DPS companion không quote cứng (PoB2 không model tamed beast, `pob_coverage: PARTIAL`) — Bear ~126.6k + Azmerian Wolf ~126.9k + Wolf Pack ~17.6k; Zekoa + aura beast đọc in-client.

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 4 |
| boss_damage | 4 |
| survivability | 3 |
| mobility | 3 |
| league_start | 4 |
| budget_scaling | 4 |

## Gear

2 ràng buộc dẫn mọi quyết định: giữ nguồn flat main-hand cho Catha, đừng vỡ res khi đổi rune (Idolatry -4% all ele mỗi non-idol augment).

- **Main-hand:** Chober Chaber, Runeforged Leaden Greathammer, cầm một tay qua Giant's Blood. +4 Level of all Minion Skills, "Increases and Reductions to Minion Damage also affect you", +44 spirit, rune convert requirement sang Dex.
- **Offhand:** Sylvan's Effigy, "any number of Companions", grant Discipline + Azmerian Wolf, 90% increased companion damage vs Marked, 75% increased Spirit. Bất khả thay khi full pack.
- **Weapon set 2 (dormant):** Rapture Gnarl (Shrine Sceptre, +3 minion, +34% spirit, allies thêm cold damage, "Onslaught while on Low Runic Ward") + Dunkelhalt buckler (block + Parry). Không kích vì swap despawn.
- **Body:** Morior Invictus, Grand Regalia. Inc Armour/Evasion/ES, +7 all attr / +11% chaos res / +13 spirit mỗi socket filled, "+10% of Armour also applies to Chaos", idol socket. Nguồn chaos res + armour 1,670. Bonded cold/light/chaos = 0 (ShamanOnly).
- **Helm:** Skull Corona, Ancestral Tiara, +2 Level of all Minion Skills, fire + light res. Rune: Minions 15% inc max Life + 8% Reservation Efficiency of Minion Skills.
- **Gloves:** Blood Talons, Runeforged Grand Bracers, +27% fire +39% light, 13% lightning penetration. Rune gain Rage on melee hit.
- **Boots:** :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Step"}, Cinched Boots, 30% MS, inc evasion, gain Deflection bằng 50% Evasion.
- **Belt:** Dusk Lock, Heavy Belt, +46% fire / +53% cold / +54% lightning res + 30% increased Explicit Resistance Modifier magnitude. Nguồn res cứng chính; +53 cold là nguồn cold duy nhất → không tháo trước khi có cold thay.
- **Ring 1:** Corruption Finger, Unset Ring, Minions deal 27% increased Damage, 8% attack/cast speed, 25% Minion Critical Damage Bonus.
- **Ring 2:** Morbid Circle, Unset Ring, Minions deal 25% increased Damage, 10% attack/cast speed, 22% Minion Critical Damage Bonus, adds cold damage to attacks. 2 Unset cho gem socket nhưng không res → 1 phần lý do cold/chaos starve.
- **Amulet:** Empyrean Locket, Azure Amulet, fractured +4 Level of all Minion Skills, +45 spirit, +15% all elemental res, anoint The Soul Meridian. Cấm vaal.
- **Jewels:** The Adorned (×108% effect cho jewel magic) + 8 viên magic Sapphire/Diamond (mỗi viên ~8-11% Minions increased Damage + ~21-24% Minions Critical Damage Bonus, 1 viên Iconic 24% Presence Area) + From Nothing cho Blackflame Covenant. Đọc crit chance sheet Zekoa: chạm 100% thì jewel nâng cấp vẫn là crit damage bonus.
- **Charm:** Thawing Charm cho freeze (cold 66 dưới cap → freeze threshold không lý tưởng), còn lại đóng ailment vector.

### Chase tier

Build mỏng so với top: EHP 19.4k, cùng dàn Zekoa + The Adorned + Sylvan's Effigy + Chober Chaber các con đầu bảng đạt 27-35k; granted DPS đo (~253k Bear + Azmerian Wolf) giữa bảng, con dẫn đầu 700-880k. Xếp theo lợi nhuận:
- **Cap cold 66→75.** Rẻ nhất, 1 nguồn cold trên ring rare / craft cold belt.
- **5 điểm cuối Lv96-100: cụm Staunch Deflection.** +690 deflection trên eva 8,625, đẩy 7,115→7,805, chance deflect +2-3pp. Cụm cách path 4 node, khít 5 điểm cuối; còn 1 điểm minion-life.
- **Mageblood — đòn EHP đơn lẻ lớn nhất.** 4 magic flask life/defense vĩnh viễn = phần lớn khoảng cách 19.4k → 27k+, cap res qua flask (Sapphire cap cold), tách nhu cầu craft res trên gear.
- **Sửa support Bear.** Carry 132k thiếu Feeding Frenzy II (30% more) + Muster (~50% more với roster 7 loại). Đổi Magnified Area II + Hulking Minions sang Feeding Frenzy II + Muster (giữ Romira's).
- **Engine rage tập trung.** Rage III đang trên 7 companion, Bear + Azmerian Wolf 0 rage. Lấy Eternal Rage từ amulet grant (persistent buff qua item không reserve spirit, free) + 2 notable Commanding Rage (player rage thành minion damage global) + Warlord Berserker (allies trong presence regen 5 rage/s) → cả đàn gồm Bear/Wolf lên 30 rage cho +30% more attack damage; 7 slot Rage III nhường support DPS (Zekoa lấy lại Supercritical, con damage lấy +1 level hoặc Uul-Netol's). Cost: 2 passive point + -40% Presence của Warlord Berserker — đo in-client xem đàn có rớt khỏi presence.
- **Đổi engine The Adorned** từ jewel crit-bonus sang minion/companion damage + max ES — nuôi đồng thời EHP + 2 con granted.
- **Vaal pipeline bước chót** — jewel rẻ trước, rồi Effigy gated với backup mua sẵn. Cấm vaal Empyrean Locket, Morior, charms.

## Wish list

- **Belt rare minion thay Dusk Lock:** cần 3 dòng cùng lúc — +Level of all Minion Skills, suffix "of Ravaging" (Minions' Strikes have Melee Splash), 1 dòng reservation efficiency (Spirit Reservation Efficiency hoặc Reservation Efficiency of Minion Skills ≥10). Combo chưa list securable → god-roll craft/canh dài; riêng +Level of all Minion Skills trên belt ~15-20 div dù mod còn rác = sàn giá. Chọn giữa splash và reservation efficiency → lấy **reservation efficiency**. Dusk Lock nguồn cold duy nhất → bản minion belt phải tự kèm cold giữ cold ≥75, hoặc cap cold từ ring/amulet/jewel trước. Belt slot chỉ 1: minion belt và Mageblood tranh cùng ô, không đeo cả hai. Search `d8lmO4rvcJ`.
- **Helm tiara rare +4 minion level:** enchant +2 Level of all Minion Skills + explicit +2 cùng dòng → +4 từ 1 slot, kèm life, ele res, 2 rune socket. Thay Skull Corona (+2) → net +2 minion level, giữ rune reservation efficiency (dời socket mới), socket còn lại nhét rune minion damage. Đứng một mình; đắt nhất wish list: full combo ~450-585 div (24 listing). Search `G67z6PyZhb`.
- **The Hammer of Faith (đã loại):** ý ban đầu tháo Chober lấy phys thuần feed Catha nhiều hơn (Hammer 388-582 phys vs Chober 64-116). Tool requirements (`.claude/skills/pob/scripts/requirements.ts`): Hammer yêu cầu Str 114, Giant's Blood triple lên **342**; mod "reduced Attribute Requirements" luôn **local** nên dòng 35% trên tiara không chạm req weapon → Str live 150 hụt **192** (kể cả đổ ~35% global tree-reduced ≈9 node còn 223 vẫn hụt **73**). Int không dư đổi sang Str: Giant's Blood triple Int req Chober (113→**339**) nên Int 361 chỉ dư 22. + mất ~77 spirit + rune Bonded chết (enableBondedMods=false) → giữ Chober. Search cũ `rP7MLzWrHQ`.

## Leveling

- Campaign level bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Twister"}: rotation Whirling Slash ×3 rồi Twister, Frost Nexus lay chilled ground. 2 việc bắt buộc: giữ ~20,000 gold Act 2→Act 3 cho full respec, unlock :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium_Runeforging"} từ NPC Farrow ngay Act 1.
- Pivot Act 3 sau Lab 2, thứ tự sống còn: **tame con Unique carry TRƯỚC, rồi mới full respec** sang cây companion. Capture timeline thật: wolf tạm ở Act 2 khi có Tame Beast, ape carry ở Act 3 Jungle Ruins, 1 aura bot ở interlude. Vào map: Masters of the Atlas ưu tiên Hilda, Overseer tablet nhảy tier waystone, fish mod lên carry bằng tablet "additional rare modifier" trên map có boss Silverfist — stack tablet + chain boss qua Rite of the Nameless ở [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt).

## Budget

- Chạy từ league-start không gear cố định (Twister gánh campaign, beast tame free). Bản đang đeo (runes 2026-06-15, 1 div = 170 ex) là luxury **~380-420 div**, phần lớn ở engine crit.
- Tiền dồn 2 khối: The Adorned roll 108% effect **~170-200 div** (poe2scout floor 6.75 div là bản rác, đừng tin) + 8 viên jewel magic Minion Crit Damage Bonus **~150 div** (corrupted magic 2-mod, ~12-35 div/viên). Khối jewel ~85% chi phí. + amulet rare +4 minion + spirit ~40-50 div = ~95%. "Carry" rẻ: Chober Chaber ~1 regal, Sylvan's Effigy ~1 ex, :wiki-link{url="https://www.poe2wiki.net/wiki/Morior_Invictus"} + Atziri's Step ~1-20 ex, rare thủ ~1-7 ex.
- Quy luật: chỉ mod hiếm + build-defining mới đắt (%effect The Adorned, minion crit damage bonus jewel corrupted, +4 minion level amulet). Cùng mod đổi slot đổi giá: +4 minion amulet ~40 div nhưng +2/+3 minion helm/sceptre ~1-7 ex. Đừng quote giá floor (poe2scout currentPrice / search 1-mod-lẻ), undercount chục→nghìn lần.
- Floor build chạy được: **~15-25 div**. The Adorned roll thấp ~6-7 div, jewel crit-bonus roll vừa, amulet +3 minion đủ clear T15. Nấc floor→geared = roll cao trên engine đó, diminishing returns.

## Failure Modes

Làm tốt: clear T15 gần như không aim · single target qua 1 carry crit cả đàn + break engine · lưới redirect khiến phần lớn hit không chạm mình. Chỗ gãy:

- **Companion wipe kéo sập cả DPS lẫn thủ.** Loyalty + Romira's bắt đàn chịu less max life đổi redirect; Morior + Vile Mending bù, nhưng AoE chaff lớn (wave Simulacrum) giết đàn nhanh → mình trần: mất redirect + damage + aura phys/haste/ES/ele-res. Counter cứng nhất: Swarming Wasp Periodic Invulnerability Aura pulse allies miễn nhiễm damage từng đợt. Đánh đổi: roster không có con mang "Damage Taken From Minions First" nên redirect vào máu minion mỏng. Đo client xem pulse phủ player.
- **One-shot phys 4.1k.** Phys max hit 4,120 mỏng nhất — element >10k, phys T17 slam + pinnacle burst vượt pool là chết. Armour 1,941 chỉ phys DR 17%; dodge + deflection + Mind Over Matter là layer chính. Cần mua tiếp EHP (armour, life-ES flat, % phys taken as element chia tải sang element >10k).
- **Cold 66 và map mod ele-weakness.** Cold dưới cap 9 điểm — chưa tử huyệt nhưng ele-weakness kéo 3 kênh thì cold lộ trước. Vá lên 75 bằng cold trên ring/craft cold belt; chưa vá thì giữ ele-weakness ra khỏi pool roll map + Thawing Charm.
- **Mark downtime trên boss.** Sniper's Mark sống ~2s mỗi 6s vì crit Zekoa consume — Effigy 90% increased + armour break chỉ chạy trong window. Cooldown Recovery II + Second Wind III thu hẹp; debuff vĩnh viễn Uruk's là bù. Damage giữa window vẫn hụt → Voltaic Mark fallback giữ Marked thường trực giá bỏ payload crit.
- **Patch sensitivity hai chiều.** GGG fix bug weapon-swap → 21 điểm Parry dormant + Rapture Gnarl quay lại là buff lớn free. Ngược: nerf Sylvan's Effigy/Trusted Kinship = chết cả hướng pack; nerf mod retention Tame Beast = mất Extra Crits, toàn bộ đầu tư crit đi theo.

## Verdict

Build cho người thích minion APM thấp: đàn tự đánh, mình giữ 2 nhịp phím (mark mỗi 6 giây, Command Wolf mỗi 15 giây), còn lại di chuyển né. Triết lý spirit: 1 carry crit, dàn aura bot, mọi sub-DPS miễn phí. Hiện trạng farm T15-16 thoải mái, chưa phải shell tank pinnacle deathless. EHP 19.4k mỏng so với top, phys max hit 4,120 trần one-shot thấp nhất, cold 66 dưới cap 9 điểm là lỗ rẻ nhất. Trần pinnacle trong chính archetype: cùng dàn các con đầu bảng EHP 27-35k + granted DPS 700-880k nhờ Mageblood + jewel minion/companion damage + max ES → hướng đẩy tiếp là leo lên đó, không đổi build. Số DPS Zekoa quan sát in-client vì PoB2 chưa model tamed companion.

## Changelog

### 2026-06-30
- Wish list mở rộng 3 target: (1) Belt rare minion thay Dusk Lock (+minion level + "of Ravaging" Melee Splash + reservation efficiency; chọn thì reservation eff hơn splash, query d8lmO4rvcJ). (2) Helm tiara rare +4 minion (enchant +2 + explicit +2), ~450-585 div (query G67z6PyZhb). (3) Loại The Hammer of Faith: reduced-attribute-requirement luôn LOCAL nên tiara không hạ req weapon, Str hiệu dụng 342 (114×3), Str live 150 hụt 192 (đổ 35% global vẫn hụt 73); Int không dư (Giant's Blood triple Int req Chober 113→339, Int 361 dư 22); + mất ~77 spirit + Bonded chết → giữ Chober. Sửa lỗi belt slot: minion belt và Mageblood tranh cùng ô nên không cap cold bằng Mageblood khi đã đeo minion belt.

### 2026-06-19
- Patch 0.5.3: Staunch Deflection thêm Deflection Rating bằng 8% Evasion Rating. Live 2026-06-14 (Eva 8,625 / Defl 7,115) → +690 deflection nếu allocate, cluster cách path 4 node → ăn trọn 5 điểm cuối Lv96-100. Sync defense: armour 1,941 / eva 8,625 (48%) / defl 7,115 (43%), Life 1,885 / ES 1,929, res F72/C66/L75/Ch72, EHP 19,432, phys max hit 4,120. Granted DPS: Bear 126.6k / Azmerian Wolf 126.9k / Wolf Pack 17.6k. Chase reorder: cap cold 66→75 → Staunch Deflection → Mageblood → support Bear → engine rage → re-point jewel.

### 2026-06-16
- Sync doc sang character live (poe.ninja model 16/06, Lv96). Roster sang 7 con tamed: Zekoa (Extra Crits) + Coconut Crab (Extra Physical Damage Aura) + Fungal Wolf (Energy Shield Aura) + Bramble Rhoa (Haste Aura + Breaks Armour) + Quill Crab (All Damage Shocks + Temporal Bubble) + Hyena Demon (Elemental Resistance Aura) + Swarming Wasp (Periodic Invulnerability Aura). Zekoa bỏ Supercritical lấy Rage III. Curse package Blasphemy/Repulsion/Armour Explosion gỡ; Uruk's Smelting dời sang Wolf Pack; armour break qua Mark for Death II + Bramble Rhoa + Uruk's. Belt Dusk Lock (triple res), ring 2 Unset (Corruption Finger + Morbid Circle, gem socket không res). Keystone thêm Mind Over Matter. Defense: Life 1,916 / ES 1,667 / armour 1,670 / eva 7,397 (44%) / defl 6,102 (39%), res F72/C15/L75/Ch55 — cold rớt còn 15 (Dusk Lock + thuế Idolatry ~-53%), EHP 17,681, phys max hit 5,229, Bear 132.5k / Azmerian Wolf 132.8k / Wolf Pack 20.6k.

### 2026-06-15
- Đối chiếu cả archetype (62 character cùng dàn Zekoa + The Adorned + Sylvan's Effigy + Chober Chaber): build mỏng nhất EHP, granted DPS giữa bảng. Chỉnh thesis EHP-first: Mageblood, đổi engine The Adorned sang jewel minion/companion damage + max ES, stack evasion/deflection, cân nhắc Forgotten Warden cho redirect companion.

### 2026-06-14
- Rewrite theo poe.ninja model Lv96: quay xe vũ khí sang Chober Chaber cầm một tay qua Giant's Blood (giữ Sylvan's Effigy offhand), body Morior Invictus, boots Atziri's Step, amulet Empyrean Locket. Anoint The Soul Meridian, bỏ thuế reservation nên full pack chạy trên pool 439. Engine crit sang The Adorned ×108%. Bonded mods trên Morior/sceptre ShamanOnly nên chết trên Huntress.

### 2026-06-12
- Bản trước: Tyranny's Grip + Forgotten Warden + Antlion Charger, anoint Gigantic Following, chaos là lỗ res duy nhất, pool 347.

## Relationships

- **related** [Character ThaoCamVienSaiGon](/characters/thao-cam-vien-sai-gon) — live snapshot tracking của character chạy build này.
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — pipeline đầy đủ: tame + modifier retention, bảng reservation nền theo loại beast, 4 nguồn nhân damage carry, săn rare beast, nhồi modifier qua tablet stacking, chain boss Rite of the Nameless.
- **related_guides** [Spirit và spirit reservation](/guides/spirit-and-spirit-reservation) — quản spirit cho nguyên đàn, nguồn spirit + reservation efficiency.
- **references** [Unique Items Mới & Meta Shift](/guides/0-5-new-unique-items) — Sylvan's Effigy, Morior Invictus, Atziri's Step + lứa companion item 0.5.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Remnant, Runeforging, Runic Ward mà build khai thác.
- **alternative_to** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — companion tamed beast Huntress, một con carry gánh single-target; so sánh boss DPS vs clear.
- **alternative_to** [Lich Soul Crystal Undead Companion](/builds/witch/0-5-lich-soul-crystal-undead) — Huntress là class đúng nếu muốn big-beast companion fantasy.
- **alternative_to** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — muốn build companion thật thay self-cast projectile → hướng companion-pack Huntress.
- **alternative_to** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — cùng ascendancy Spirit Walker nhưng damage source ngược: bên kia companion-pack, bên này self-cast projectile.
- **derived_builds** [Aura Bot Zoo Spirit Walker](/builds/huntress/0-5-spirit-walker-aura-bot-zoo) — build mẹ: toàn bộ gear, tree, ascendancy, ledger gốc và lớp redirect; nhánh này chỉ đổi cấu trúc roster.
- **derived_builds** [Infernal Monkey Spirit Walker](/builds/huntress/0-5-spirit-walker-infernal-monkey) — build mẹ: gear, tree, Catha, Forgotten Warden, pipeline tame; nhánh này đổi carry + cấu trúc roster.
- **farming_relevance** [200% Delirium Breach](/farming/0-5-delirium-breach-density-farm) — build companion ví dụ đủ điều kiện chạy, kèm note vá cold res + phys EHP.
- **farming_relevance** [Breach Rare Juice Farm](/farming/0-5-breach-rare-juice-farm) — ví dụ build endgame đủ DPS + EHP đứng nổi 200% Delirium fog 20+ rare cùng spawn.
- **farming_relevance** [Leveling Carry Service](/farming/0-5-leveling-carry-service) — nhân vật map đang chạy, nền của carry service nếu clear đủ nhanh.
- **farming_relevance** [Rite of the Nameless Omen Farm](/farming/0-5-rite-of-nameless-omen-farm) — character endgame đủ clear T15-16 và đứng nổi phòng đông quái.
- **farming_relevance** [Ritual Belt Hunting](/farming/0-5-ritual-belt-hunting) — character endgame đủ clear T15-16 và đứng nổi phòng đông quái.
- **farming_relevance** [Săn Monkey Companion qua Ritual](/farming/0-5-monkey-companion-hunt) — build tiêu thụ con carry làm nguồn damage chính.
- **references** [Farm aura beast cho companion zoo](/guides/0-5-aura-beast-farming) — roster live 4 aura bot (Diretusk Haste, Coconut Crab Extra Phys, Adorned Scarab ES, Swarming Wasp Invulnerability).
- **references** [Flux resistance conversion](/crafting/0-5-flux-resistance-conversion) — Void Flux vá lỗ chaos res ~25 của char.
- **references** [Twister](/guides/twister) — dùng Twister làm engine leveling gánh campaign trước khi pivot companion; DPS chain phụ thuộc Whirlwind consume.
- **references** [Unique charms](/guides/unique-charms) — belt 3 charm slot + slot thứ tư từ quest reward, đúng loại slot các charm nhắm tới.
- **related_guides** [Patch Notes — Return of the Ancients Mid-League Update](/guides/0-5-2-patch-notes) — build hưởng trực tiếp buff Bear presence và fix deflect-redirect của Forgotten Warden.
- **related_guides** [Tier list các chiến lược farm currency](/guides/0-5-farming-strategy-tier-list) — build cân được nhóm S raw-currency delirium.
- **related_guides** [Tư duy kiếm currency](/guides/0-5-currency-making-mindset) — máy Producer nuôi vốn để leo Refiner/Distributor.
- **related_guides** [Weapon set và weapon swap trong POE2](/guides/beginner-weapon-swap) — build giữ Parry setup ở set 2 nhưng chơi no-swap vì swap làm cả đàn despawn
- **related_mechanics** [Craft amulet top-tier cho companion build](/crafting/0-5-plus4-minion-amulet) — amulet này là slot amulet của build; Refined Necrotic buff jewel minion-crit.
- **related_mechanics** [Runic Ward Onslaught Loop cho Minion](/guides/0-5-runic-ward-onslaught-loop) — build đã xét loop này và không dùng: Carved Majesty gloves cấp Onslaught qua Marked target rẻ hơn. Loop chỉ còn nghĩa cho roster chưa có marks gloves.
