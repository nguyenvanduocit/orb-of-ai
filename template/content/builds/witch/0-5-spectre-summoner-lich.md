---
template: templates/build-template.md
document_type: build
title: Spectre Summoner Curse Lich
status: draft
author: duocnv
created: '2026-05-30'
updated: '2026-07-03'
class: Witch
ascendancy: Lich
league: '0.5'
patch: 0.5.3
budget_tier: league-starter
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Bind Spectre
  damage_type: chaos
  playstyle: minion
  content_focus: all-content
tags:
  - witch
  - lich
  - bind-spectre
  - spectre
  - minion
  - curse
  - summoner
  - 0-5
  - poe2
---

# Spectre Summoner Curse Lich

Summoner đứng sau bầy :wiki-link{url="https://www.poe2wiki.net/wiki/Spectre"} hồi sinh vĩnh viễn, dựng trên :wiki-link{url="https://www.poe2wiki.net/wiki/Lich"} để cộng tầng damage summoner Witch khác không có: spectre bắn lightning, Lich đổ chaos qua curse, mỗi xác cursed chết nổ lan chaos clear màn. Core = :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} bắt **Powered Zealot** variant Spark. Sống thật ladder: 4.392 character field Spectre: Powered Zealot, 384 con Lich.

## Build Overview

- **Damage:** bầy spectre đồng giống — mỗi con tái hiện native skill monster gốc → clear AoE từ skill spectre × số con. Engine giống [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) (cùng spectre, support 0%-reservation, trục Spirit). Cái khác = lớp Lich.
- **Trục chaos của Lich:** spectre hit lightning → :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Conduit"} cấp :wiki-link{url="https://www.poe2wiki.net/wiki/Unholy_Might"} cho bầy (minion là Ally trong Presence) = "30% of all damage gained as extra Chaos damage" → :wiki-link{url="https://www.poe2wiki.net/wiki/Blackened_Heart"} biến max mana thành magnitude. Lớp gained-as-chaos chỉ đáng khi chaos-res enemy kéo xuống → curse là **damage multiplier**: :wiki-link{url="https://www.poe2wiki.net/wiki/Despair"} shred chaos-res, :wiki-link{url="https://www.poe2wiki.net/wiki/Rupture_the_Soul"} làm xác cursed nổ chaos lan. Đây là vòng damage Infernalist không có.
- **Đòn bẩy Spirit 0.5.1:** :wiki-link{url="https://www.poe2wiki.net/wiki/Eternal_Life"} không còn chặn Life Reservation + Lineage :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Communion"} chuyển Persistent skill sang reserve Life thay Spirit → curse (Blasphemy) + aura phụ route sang Life pool, dành nguyên Spirit nuôi spectre. Lich không có node Spirit ascendancy như Beidat's Will của Infernalist → tech này trả lời điểm yếu đó.
- **Defense:** ES pool chính + Life pool thật + :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} lớp đệm cuối ở 1 life. Đội lai là chủ đích: support :wiki-link{url="https://www.poe2wiki.net/wiki/Muster"} cho minion more damage theo số *loại* Reviving Minion khác nhau đang field → roster nhiều giống = multiplier. Top PZ Lich đứng low-life (Life 1 sau reserve sạch, ES 6-14k, EHP 16-53k).
- **Live reference — Ermiss** (Lich Lv98 top-10 exp): Life 1.649, ES 11.286, Spirit 433, EHP 31.590, chaos res 72%; Powered Zealot trong đội skeleton hỗn hợp + Blasphemy + Atziri's Communion.

## Chọn spectre nào để bind

Anchor = :wiki-link{url="https://www.poe2wiki.net/wiki/Powered_Zealot"} — spectre #1 tuyệt đối: 4.392 character field nó (poe.ninja 2026-06-10), bỏ xa Vaal Guard 261. Nhiều variant gần giống, bind nhầm mất build:

- **Variant Spark** — cầm **spear mũi nhọn**, cast lightning orb xanh mọi khoảng cách, không vào melee. Skill: Spark, Spark Nova, Lightning Blast. Reserve **60 Spirit**. Con cần bắt.
- **Variant melee** — cầm staff, thrust cận chiến, lightning yếu. Reserve 50 Spirit. Không phải con cần.
- Gem panel không hiện Spark → quan sát animation trước khi bind (orb xanh + không lao vào gần → cast). Powered Zealot ở Etched Ravine và The Ziggurat Refuge.
- Rẻ Spirit hơn / chưa tới zone (lightning spectre theo poedb): :wiki-link{url="https://www.poe2wiki.net/wiki/Lost-men_Zealot"} (70, lightning storm), :wiki-link{url="https://www.poe2wiki.net/wiki/Winged_Horror"} (70, ball lightning), :wiki-link{url="https://www.poe2wiki.net/wiki/Vaal_Researcher"} (60, Spark + flame wall), :wiki-link{url="https://www.poe2wiki.net/wiki/Ancient_Ezomyte"} (50, lightning arrow), :wiki-link{url="https://www.poe2wiki.net/wiki/Risen_Rattler"} (50, lightning projectile). :wiki-link{url="https://www.poe2wiki.net/wiki/Vaal_Guard"} (50, grenade physical + fire) lệch element — chỉ đáng nếu bỏ trục lightning-shred.

## Skill Gems & Links

- :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"}: cast lên xác monster non-unique → gem thành `Spectre: <tên monster>`, reviving minion account-bound. Quality → "Minions deal 0-20% more Damage" → luôn đẩy quality 20.
- Support trong gem Spectre đánh giá theo skill con spectre cast (Powered Zealot cast Spark → slot ăn nguyên họ support Spell/Projectile), không theo gem Bind Spectre gốc.
- **Main (6L)** — consensus 384 PZ Lich ladder (poe.ninja 2026-06-10): Spectre: Powered Zealot (20% quality) + :wiki-link{url="https://www.poe2wiki.net/wiki/Wildshards"} **II** (98% — chance bắn thêm vòng projectile, mỗi Spark thành nova) + :wiki-link{url="https://www.poe2wiki.net/wiki/Pierce"} **III** (95% — xuyên hết pack) + :wiki-link{url="https://www.poe2wiki.net/wiki/Feeding_Frenzy"} **II** (78% — 30% more damage, minion take 15% more damage) + Muster (68% — biến đội lai thành multiplier) + flex. Ô 5 chia: :wiki-link{url="https://www.poe2wiki.net/wiki/Vilenta's_Propulsion"} (31% — cast speed áp vào projectile speed), Projectile Acceleration (~43% gộp 2 bản), :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Mastery"} (19% — +1 gem level). Map ele weakness → swap 1 ô sang :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Army"} (+30% all res minion).
- **Curse lane (chỗ Lich tách):** Despair kéo chaos-res → nhân toàn bộ Unholy Might; :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"} shred lightning-res cho phần lightning gốc Spark. 2 cách giữ uptime: (1) :wiki-link{url="https://www.poe2wiki.net/wiki/Incessant_Cacophony"} ascendancy (+curse slot + infinite duration, dán 1 lần lên boss); (2) — cách ladder — :wiki-link{url="https://www.poe2wiki.net/wiki/Blasphemy"} biến curse thành aura + Atziri's Communion để cả cụm reserve **Life thay Spirit** ("Supports Persistent Skills, making them Reserve Life instead of Spirit") + keystone tree :wiki-link{url="https://www.poe2wiki.net/wiki/Whispers_of_Doom"} cho curse thứ hai. Cách 2 hands-free + trả Spirit về bầy, đổi lại curse radius quanh mình → đứng gần pack hơn.
- **Aura/Movement:** Unholy Might (Necromantic Conduit) là buff chủ lực, zero socket cost, giữ mana trên Low Mana; aura phụ nhét chung ổ Atziri's Communion. :wiki-link{url="https://www.poe2wiki.net/wiki/Blink"} reposition.
- `Exclusion check:` :wiki-link{url="https://www.poe2wiki.net/wiki/Esh's_Radiance"} socket được (đánh giá theo Spark, 27/384 PZ Lich live) nhưng slot endgame thuần: Requires Level 65, drop từ Xesht, 120% Cost & Reservation Multiplier → mỗi con đắt ~¼; đo 40% lightning-as-chaos có thắng mất 1 con không. Atziri's Communion "Cannot Support Skills which create Minions" → chỉ Blasphemy/aura. :wiki-link{url="https://www.poe2wiki.net/wiki/Kurgal's_Leash"} cấp Unholy Might khi **Command** minion mà spectre autonomous không Command → không apply. Unholy Might không stack — Necromantic Conduit + :wiki-link{url="https://www.poe2wiki.net/wiki/Vis_Mortis"} chỉ lấy copy mạnh nhất. Last Gasp không dùng chung :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Instability"} (bypass Last Gasp). Extra-chaos từ Unholy Might chỉ scale chaos modifier + enemy chaos-res, không scale lightning mods, DoT không hưởng gained-as → **Despair bắt buộc**.

## Ascendancy

Witch 0.5 có 4 ascendancy: Infernalist, Blood Mage, Lich, Abyssal Lich (nhánh mới tách từ base Lich, thiên chaos caster — không phải nhà spectre). Trên cây Lich, nhánh Eldritch Empowerment / Price of Power = *Spell* more-damage → vô dụng spectre (Minion damage). 8 điểm dồn minion + curse:

- **Lab 1 — Necromantic Conduit** (qua small Mana): đóng góp damage duy nhất ascendancy, lấy đầu tiên — Unholy Might 30% gained-as-chaos lên cả bầy. Đổi "Lose 5% of maximum Mana per Second".
- **Lab 2 — Blackened Heart:** "4% increased Magnitude of Unholy Might Buffs you grant per 100 maximum Mana" → 1000 mana = +40% magnitude; mana-stacking = stat damage → tree path qua max-mana.
- **Lab 3 — Rupture the Soul** (qua small Curse Area): xác cursed bị bầy giết 33% nổ ¼ max Life thành chaos → clear speed nhảy vọt.
- **Lab 4 — theo cách chạy curse:** self-cast → Incessant Cacophony (default). Đã đi Blasphemy + Atziri's Communion → curse uptime + slot 2 đã có → 2 điểm cuối đổ vào **Soulless Form + Eternal Life**: từ 0.5.1 Eternal Life cho phép Life Reservation, ăn khớp Atziri's — Life bị reserve + phần còn lại đứng yên dưới ES ("Your Life cannot change while you have Energy Shield"). Ladder nghiêng hẳn hướng này.

## Spirit budget nuôi bao nhiêu con

Số con = floor(tổng Spirit ÷ cost mỗi con). Powered Zealot Spark 60 Spirit → 300 Spirit = 5 con, 433 Spirit (Ermiss) = trần 7 con nếu dồn thuần (thực tế chừa cho skeleton utility nếu đội lai). Nguồn Spirit:

- **Sceptre base** ~100 Spirit + roll "% increased Spirit" — slot lớn nhất.
- **Atziri's Communion routing** — mỗi aura/Blasphemy sang Life = chừng đó Spirit trả về bầy.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Bones_of_Ullr"} — 30% reservation efficiency cho skill tạo Undead Minion; Ermiss vẫn mang @Lv98.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Mantle"} — +75 Spirit flat trên body, đổi slot ES rare.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Ventor's_Gamble"} — ring Spirit + res, stack 2 chiếc.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Self_Sacrificing"} tree — +40% Reservation Efficiency of Minion Skills, kèm −20% cho skill không-minion; cặp Atziri's routing → downside trơ.
- Timeless Jewel roll reservation efficiency theo tribute — tech min-max ladder.

## Passive Tree & Mastery

- 4 nhóm: minion damage/life, reservation efficiency, max-mana (stat damage qua Blackened Heart), ES pool. Minion damage giống sibling Infernalist (xem đó cho bản đồ đầy đủ): mọi node minion = "increased" cộng dồn, more chỉ từ support + Unholy Might, ưu tiên small double-dip → notable. Đừng phí điểm Spell Damage start-area.
- Max-mana node double duty: nuôi drain 5%/giây Necromantic Conduit + nâng magnitude Unholy Might → lý do Lich spectre path về mana thay pure ES. Keystone Whispers of Doom đáng detour khi chạy Blasphemy (curse thứ hai từ tree trả ascendancy point về nhánh Life).
- ES: 0.5 cắt mạnh ES recharge (small "increased Recharge Rate" xoá, notable cắt sâu) → pool dựa raw + Runic Ward + recoup thay recharge. Late-game :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Talisman"} khi amulet +minion-level thuần + res cap slot khác.

## Stat Priorities & Defenses

- **DPS chain mỗi con:** `base_hit_lightning × (1 + Σ increased_minion) × ∏(1 + more_i) × shred_multiplier × hit_rate`, `∏more_i` = Feeding Frenzy II (1.30) × Bind Spectre quality (1.20) × gem level. Lớp chaos từ Unholy Might = gained-as-extra layer song song — chỉ scale chaos modifier + enemy chaos-res qua Despair, đừng cộng như more. Tổng bầy = DPS mỗi con × số con.
- **2 caveat số liệu:** (1) late-game minion hidden multiplier ~25-35% vs non-unique / ~20-25% vs unique từ bản fix 0.5 — **một** modifier, đừng double-count. (2) ẩn khỏi tooltip + PoB2 ("no longer factored into the damage numbers displayed for skills of your minions") → mọi số under-report ~20-35% — caveat `pob_coverage: PARTIAL` cốt lõi, đo clear speed bằng thực chiến.
- **Defense EHP layer order 0.5:** res cap → ES pool → Life → Runic Ward → recovery. Bỏ armour/evasion/block (Ermiss Lv98 armour 0, evasion 11 — vẫn EHP 31.590 nhờ ES 11.286). Physical + chaos hit ăn thẳng ES → bù bằng minion soak + đứng xa. Chaos yếu nhất (không CI, chaos 2× lên ES) → push chaos-res dương cao (Ermiss 72%). Runic Ward không ăn keyword "Defences" → scale qua Runic Ward Runes craft từ Remnant; 0.5.1 flask :wiki-link{url="https://www.poe2wiki.net/wiki/Olroth's_Resolve"} regen Runic Ward + Guard bằng đúng lượng Ward hiện có.

### Performance Ratings

| Aspect          | Rating (1-5) |
|-----------------|--------------|
| clear_speed     | 4            |
| boss_damage     | 3            |
| survivability   | 3            |
| mobility        | 3            |
| league_start    | 3            |
| budget_scaling  | 4            |

## Gear Progression

- **Leveling:** Act đầu không level bằng spectre (Bind Spectre cần corpse + Spirit + gem level, Lv1-12 chưa có cả ba). Minion Int cơ bản (:wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Warrior"} tank) + spell filler. Vũ khí "+to Level of Minion Skills" + Spirit implicit. Bones of Ullr (Lv16, 23 Int) vào sớm, giữ tới endgame.
- **Early Mapping:** cap 75% ba res, Spirit nuôi 3-4 con, Bind Spectre quality 20. Body rare ES base; idol vào sceptre buff toàn bầy 1 socket (:wiki-link{url="https://www.poe2wiki.net/wiki/Primate_Idol"} "Allies in your Presence deal 40% increased Damage", :wiki-link{url="https://www.poe2wiki.net/wiki/Rabbit_Idol"} 15% increased Spirit). Engrave Despair ngay.
- **Endgame:** trục 1 số lượng spectre → gem level (**+2 helm, +3 sceptre** = 2 breakpoint lớn nhất) → minion-damage %. Body 3 hướng: rare ES thuần (đường Ermiss — ES là layer thủ duy nhất), Soul Mantle +75 Spirit, Vis Mortis (+ES +mana, Minions have Unholy Might vô điều kiện — gỡ phụ thuộc Presence-geometry + mana drain, đổi −50% minion Life đau cho swarm reviving). Ring :wiki-link{url="https://www.poe2wiki.net/wiki/Ventor's_Gamble"} khi cần Spirit + res. Vũ khí tradeoff PoB: :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock"} (+111% Minion Damage + 34% reservation efficiency, Int-gated hợp Witch) vs :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} (+50 Spirit +2-3 minion gem level, 60 Str gating trên class Int thuần) vs rare sceptre +3 minion level + % Spirit.
- **Mirror Tier:** stack 3 đòn bẩy Spirit: flat (Chober +50, Soul Mantle +75, sceptre base ~100), % increased (:wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy"} 54%, Rabbit Idol 15%), reservation efficiency (Raven's Flock 34%, Bones of Ullr, Self Sacrificing, Atziri's routing). Reservation efficiency mạnh nhất per-point. Bầy chạm trần → mana-stack cho Blackened Heart + chaos modifier cho lớp gained-as + rare jewel double-effect qua :wiki-link{url="https://www.poe2wiki.net/wiki/Crystalline_Phylactery"} (con thứ 8 hiếm khi đáng hơn). Lớp chaos cuối khi Spirit dư hẳn = Esh's Radiance vào ô flex (40% lightning-as-chaos đổi 120% reservation, đo uplift trước commit).

## Flasks

- :wiki-link{url="https://www.poe2wiki.net/wiki/Mana_Flask"} là panic-button thật: kéo mana trên Low Mana giữ Unholy Might uptime khi drain 5%/giây + spike. Life flask slot cho 1 trong 2 unique: Olroth's Resolve (0.5.1 regen Runic Ward + Guard theo Ward hiện có) hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Umbilicus_Immortalis"} ("Minions cannot Die while affected by a Life Flask" — trả lời boss AoE xoá bầy); commit Eternal Life thì Life Flask không heal mình, thuần minion-tech. Còn lại: flask kháng ailment (freeze/stun — không CI nên không miễn gì), flask movement. Đừng giả định :wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} bật flask như POE1 — Mageblood 0.5 chỉ là charm-slot belt.

## Leveling Notes

- Act 1-2 minion Int cơ bản — Skeletal Warrior tank + spell filler. Cầu nối engine leveling: :wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Arsonist"} (reviving minion + nút bom "Command: Explosive Demise" dọn pack — nguồn clear chính Act 2, dùng *cùng bộ support* với Bind Spectre).
- Spirit milestone: :wiki-link{url="https://www.poe2wiki.net/wiki/Gembloom_Skull"} (+30 Spirit, Freythorn Act 1) → :wiki-link{url="https://www.poe2wiki.net/wiki/Gemrot_Skull"} (+30 Spirit, The Azak Bog Act 3). Pivot spectre khi đủ Spirit + zone có con đáng bắt: 2 con 50-Spirit lên sớm Risen Rattler / Ancient Ezomyte → đổi Powered Zealot variant Spark khi tới Etched Ravine / The Ziggurat Refuge (quan sát animation, bind nhầm melee phải bắt lại). Re-bind: disenchant gem cũ + bắt con mới. Lab đầu Necromantic Conduit ngay để bật Unholy Might sớm.

## Budget & Investment

- Sàn thấp: damage từ gem level + hidden multiplier free + Unholy Might một node. Vài chaos cap res + sceptre minion-level + Primate/Rabbit Idol, engrave Despair.
- Breakpoint đầu: Bones of Ullr + body Spirit/ES. Breakpoint divine khi gói Unholy Might mở hết — mana-stack + Blackened Heart + Atziri's Communion route aura sang Life — **sweet spot kinh tế**, nơi Lich tách Infernalist.
- Mirror tier (Raven's Flock, jewel double-effect, swarm trần) = min-max marginal.

## Resources

- **Live reference:** [Ermiss — Lich Lv98 trên poe.ninja](https://poe.ninja/poe2/builds/runesofaldur/character/Ermiss-7734/Ermiss) — Powered Zealot đội skeleton lai, Blasphemy + Atziri's Communion, ES 11.286 / EHP 31.590 / Spirit 433.
- **Ladder filter:** [Lich + Spectre: Powered Zealot](https://poe.ninja/poe2/builds/runesofaldur?class=Lich&skills=Spectre%3A+Powered+Zealot) — 384 character live, top dồn Lv97-98.
- **Guide archetype:** [Storm Mage Lich — maxroll](https://maxroll.gg/poe2/build-guides/storm-mage-lich-build-guide) — cùng họ lightning minion Lich với Powered Zealots.

## Failure Modes

Build làm tốt 3 thứ: clear speed cao (AoE native + explosion chaos Rupture the Soul), ease-of-play đỉnh (pure summoner zero aim), trục chaos riêng. Lỗ:

- **Map mod hostile.** "minions deal no/less damage" cắt nguồn damage duy nhất → reroll. "Less recovery rate" hỏng chu kỳ revive → bầy mỏng dần. "No regen" siết mana → mất uptime Necromantic Conduit → mất more-multiplier lớn nhất. Nền tảng: ES recharge cắt sâu từ 0.5 → pool ES (lớp thủ duy nhất) sustain yếu.
- **One-shot + lỗ chaos.** Sustained boss AoE wipe bầy nhanh hơn revive → quãng trống damage khi cả bầy revive (Umbilicus Immortalis). Player: chaos hit khắc tinh structural (không CI, chaos 2× lên ES, max-hit chaos thấp hơn max-hit elemental); physical slam ăn thẳng ES vì zero armour. Death-spiral: ES cạn đúng lúc mana spike → Low Mana → Unholy Might tắt giữa pha nguy hiểm.
- **Spirit floor + bind nhầm.** Day-1 sceptre base ~100 Spirit nuôi 1-2 con 60-Spirit — "bầy 5-7 con" là outcome gear floor (Bones of Ullr + body Spirit + Atziri's routing), không league-start reality; engine spectre dead tới khi qua Act 3. Powered Zealot variant melee gần giống Spark → bind nhầm = damage tụt + bắt lại.
- **Meta reality.** Powered Zealot khoẻ ladder (4.392 field) nhưng bầy *thuần* một giống không ai top-exp chạy — cấu hình sống là spectre trong đội lai ăn Muster. Chạy bầy thuần = đổi multiplier Muster lấy identity, ít nhân chứng, tự đo số.
- **Patch sensitivity.** Build cưỡi hidden minion multiplier từ bản fix 0.5 — nerf target hiển nhiên nếu summoner over-perform; re-nerf gut cả build này + sibling Infernalist. 0.5.1 không đụng minion/spectre/curse → hiện an toàn, nhưng tech Atziri's Communion + Eternal Life mới một patch tuổi — nếu GGG đánh giá Lich quá nhiều Spirit free, chỗ sửa là một trong hai đầu.

## Verdict

- Build niche có thật, không paper-craft: Powered Zealot live ladder, tech Spirit 0.5.1 trả lời điểm yếu cố hữu của Lich, lớp curse-chaos không summoner nào khác có.
- Đường vào an toàn nhất = dạng lai (spectre trụ damage trong đội minion hỗn hợp như Ermiss) → dồn dần bầy thuần khi Spirit qua ~350-400.
- Hợp người thích walking-simulator + tự đo số; ngưỡng đầu tư = divine breakpoint (mana-stack + Bones of Ullr + body Spirit/ES), không day-1.

## Changelog

### 2026-06-19
- 0.5.3 sửa bug Spiraling Conspiracy của :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock"} không cập nhật damage khi stat thay đổi. Build chạy Spark qua Powered Zealot chứ không cast Spiraling Conspiracy → fix không tác động trực tiếp, nhưng Raven's Flock hoạt động đúng hơn cho build dùng skill đó.

### 2026-06-10
- Rewrite theo live data ngày 12 (poe.ninja 2026-06-10, poedb 0.5.0, patch notes 0.5.1). Anchor Powered Zealot variant Spark 60 Spirit (4.392 field, 384 Lich); Doryani's Elite hoá cannon napalm fire → rời vai trò lightning anchor; thêm phân biệt variant spear/staff. Link đổi theo consensus: Wildshards II + Pierce III + Feeding Frenzy II + Muster; Esh's Radiance từ core → option 7% với cost 120% reservation. Thêm tech 0.5.1 Atziri's Communion + Eternal Life (low-life Life 1), Olroth's Resolve. Sửa số ascendancy Witch = bốn (Abyssal Lich mới). Thêm reference Ermiss Lv98. league_start 4→3.

### 2026-05-30
- Initial draft (research-derived, pre-league theorycraft) từ 0.5.0 verbatim + wiki mirror + cross-check sibling Infernalist Spectre Legion.

## Relationships

- **alternative_to** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — cùng engine spectre, khác ascendancy: Infernalist thiên league-start floor + Spirit (Beidat's Will) + ES defense, Lich thiên endgame ceiling qua chaos-conversion + mana-scaling.
- **alternative_to** [Unearth Bone Construct Mass Summoner](/builds/witch/0-5-bone-construct-mass-summoner-lich) — cùng Lich, minion physical mass-summon; đối trọng spectre swarm.
- **alternative_to** [Plants Lich Abyssal League Starter](/builds/witch/plants-lich-abyssal-league-starter) — cùng Witch Lich league-starter, caster totem/vines thay spectre swarm.
- **related_mechanics** [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt) — minion/companion + spirit reservation nền tảng.
- **related_mechanics** [Energy Shield recovery](/guides/energy-shield-recovery) — nerf ES recharge 0.5 build phải path qua.
- **references** [New unique items](/guides/0-5-new-unique-items) — Vis Mortis, Soul Mantle, Raven's Flock, Bones of Ullr.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5.0 + Remnant/Runic Ward + meta build.
- **related** [Lich Soul Crystal Undead Companion](/builds/witch/0-5-lich-soul-crystal-undead) — sibling Lich cùng identity Unholy Might + curse, có data ladder verified.
