---
template: templates/build-template.md
document_type: build
title: Rarity Cull Bot Ritualist
status: published
author: duocnv
created: '2026-06-14'
updated: '2026-07-03'
class: Huntress
ascendancy: Ritualist
league: '0.5'
patch: 0.5.3
budget_tier: high-budget
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Spark
  damage_type: lightning
  playstyle: projectile
  content_focus: currency-farming
tags:
  - huntress
  - ritualist
  - spark
  - rarity
  - cull
  - culling-strike
  - magic-find
  - party-support
  - currency-farming
  - 0-5
  - poe2
---

# Rarity Cull Bot Ritualist

MF bot cho duo: nhường damage cho carry, lấy kill bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Culling_Strike"} → drop loot ở rarity cao nhất. :wiki-link{url="https://www.poe2wiki.net/wiki/Ritualist"} ascendancy: Unfurled Finger mở ring slot thứ 3 → 3× :wiki-link{url="https://www.poe2wiki.net/wiki/Ventor%27s_Gamble"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Ingenuity"}. Dùng khi có duo partner ổn định; KHÔNG solo/PUG. Muốn tự đánh → [Magic Find Spell Ritualist](/builds/huntress/0-5-ritualist-rarity-solo-duo).

## Build Overview

- **Damage:** :wiki-link{url="https://www.poe2wiki.net/wiki/Spark"} = hit-delivery (lightning projectile) → trigger Culling Strike on-hit. Build KHÔNG đầu tư damage; carry kéo HP enemy xuống threshold, culler chỉ hit đúng lúc.
- Culling Strike check HP hiện tại của target NGAY TRƯỚC khi damage hit trừ → HP trong threshold = chết ngay bất kể damage thực. Spark không tự kéo HP xuống threshold.
- **Scale:** toàn bộ passive + gear → (1) nâng Culling Strike Threshold, (2) stack Item Rarity. Không damage/defense đầu tư.
- **Defense:** evasion + ES mỏng. :wiki-link{url="https://www.poe2wiki.net/wiki/Blasphemy"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Temporal_Chains"} slow aura giữ enemy xa. :wiki-link{url="https://www.poe2wiki.net/wiki/Convalescence"} trigger ES recharge on-demand khi bị hit.
- **Party 0.5:** non-unique monster threshold restored full base value trong party (patch note line 1091) → cull Normal/Rare dễ hơn pre-0.5. Unique boss threshold vẫn giảm per member thêm → party 2 tối ưu; party 3-4 boss cull khó dần (threshold% co, HP boss phình). Thiết kế cho duo, không nhóm lớn.

## Ngưỡng cull & breakpoint

- Culling Strike = on-hit, 3 điều kiện cull được: hit không evade/dodge · enemy không Runic Ward · HP hiện tại trước damage < threshold. DoT không cull.
- Mọi "increased Culling Strike Threshold" additive rồi nhân base: `effective = base × (1 + Σincreased)`.
- Base threshold theo rarity (giá trị 0.5.0; Normal buff 30%→35% ở patch này):

| Rarity | Base threshold |
|---|---|
| Normal | 35% |
| Magic | 20% |
| Rare | 10% |
| Unique | 5% |

- Nguồn "increased CST" universal (mọi rarity):
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Myris_Uxor"} (helmet): **+100%**
  - Bounty Hunter passive cluster: **+40%** (notable 25% + 3 small node 5% mỗi cái)
  - Hunting Companion notable (instill amulet): **+20%**
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Heart_of_the_Well"} (unique Diamond Jewel, max roll): **+25%**
  - **Tổng universal: 185%**
- Ở 185%: Normal 35% × 2.85 = **99.75%** (carry chạm Normal là đủ) · Rare 10% × 2.85 = **28.5%**
- Instant Normal cull tuyệt đối (100%+) cần đúng **186% increased**. Thực tế carry giao ≥0.25% HP mọi Normal enemy nên 99.75% functional.
- Cull the Hordes (notable tree, **+40% vs Rare/Unique only**, không áp Normal): Rare 10% × 3.25 = **32.5%**
- Fear Incarnate từ :wiki-link{url="https://www.poe2wiki.net/wiki/Horror%27s_Flight"} tranh slot gloves với Deathblow → không cộng vào universal (xem nguồn cull).

## Nguồn Culling Strike cho Spark

- :wiki-link{url="https://www.poe2wiki.net/wiki/Culling_Strike_I"} + Culling Strike II support đều **Attack-only** → không link Spark (Spell). Cull lấy từ equipment.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Deathblow"} (unique gloves, base Doubled Gauntlets, Lv33, 24 Str/Dex): Culling Strike unconditional dạng mod cố định = nguồn cull chính, BẮT BUỘC, thứ duy nhất luôn-bật cho clear. KHÔNG có "increased Culling Strike Threshold"; chỉ Culling Strike on-hit + armour/evasion + attack speed + life/mana on kill.
- Gloves slot dễ hiểu sai: Horror's Flight (base Engraved Bracers) và Deathblow (base Doubled Gauntlets) đều **Item class: Gloves** = cùng slot, loại trừ nhau. POE2 không có slot bracers/wrist. "Transfer Culling Strike Deathblow→Horror's Flight": 0.5 không có mechanic transfer mod giữa unique. Horror's Flight grant "Gain 1 Fear Incarnate when you Cull a target" nhưng tự nó không cho Culling Strike → bỏ Deathblow = mất nguồn cull luôn-bật cho clear.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Attrition"} (Spirit gem, Tier 4, 30 Spirit): cull Rare/Unique sau **31-40 giây** Presence. Nguồn cull duy nhất không chiếm gloves nhưng delay quá dài → chỉ cover boss dài, không thay Deathblow cho map clear.

## Stack rarity: 3× Ventor's + Ingenuity

- :wiki-link{url="https://www.poe2wiki.net/wiki/Gravebind"} dead cho MF từ 0.5 (patch note line 635): "Your other Modifiers to Rarity of Items found do not apply" → lock effective IIR ở 15-20%. Triple Ventor's bypass qua đủ ring slot (Unfurled Finger), không qua Gravebind.
- Ventor's Gamble roll **(−25% đến +25%)** increased IIR + **(−40 đến +40)** mỗi resistance — cả hai chiều đều có thể âm cùng ring. Ingenuity nhân 30% more vào TOÀN BỘ ring stats kể cả âm: ring −30% cold res sau Ingenuity 30% = −39% cold res. Chỉ mua ring IIR dương + resist không catastrophic.
- Ingenuity amplify "(20-30)% increased bonuses gained from **left** Equipped Ring" + "**right** Equipped Ring". Unfurled Finger = ring thứ 3, không "left"/"right" → gần như chắc chắn KHÔNG amplify.
- Math max roll Ingenuity 30%:
  - Ring trái (amplify): +25% × 1.30 = **+32.5% IIR**
  - Ring phải (amplify): **+32.5% IIR**
  - Ring Unfurled Finger (không amplify): **+25% IIR**
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Rabbit_Idol"} (body socket, limited 1, buffed 0.5.0): **+12% IIR**
  - Subtotal player IIR (ring + idol): **~102%** trước Mageblood
- Player IIR **diminishing returns mạnh sau ~150%**. :wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} (Utility Belt, mới 0.5): 4 slot Mage's Legacy random từ pool ~14 loại. :wiki-link{url="https://www.poe2wiki.net/wiki/Legacy_of_Gold"} = 45% IIR/copy; belt roll "(25-50)% increased effect per duplicate Mage's Legacy held" nhân khi nhiều copy cùng loại. 3 Legacy of Gold/belt = RNG cao; hit rồi vẫn dính diminishing.
- Player IIR (item, buff) vs area IIR (waystone mod, tablet mod) = **2 bucket riêng**: nhân nhau (không cộng), area IIR không diminishing. Qua ~150% → chọn waystone/tablet high IIR ăn hơn stack player IIR. Chi tiết: [Độ hiếm item](/guides/beginner-item-rarity).
- Resist solve: :wiki-link{url="https://www.poe2wiki.net/wiki/Grand_Spectrum_(Sapphire)"} (unique Diamond Jewel, Trial of Sekhemas, Gold Spectrum Cache): mỗi viên **+6% all Elemental Resistances**, max 3 = **+18% all ele res**. Bù downside Reduced Resistances của Unfurled Finger không tốn ring slot. :wiki-link{url="https://www.poe2wiki.net/wiki/The_Adorned"} KHÔNG amplify Grand Spectrum (Adorned chỉ amplify passive node socket chứa corrupted magic jewel; Grand Spectrum là unique jewel).

## Passive tree & instill amulet

- Amulet POE2 giữ **1** instilled notable (trừ unique đặc biệt như :wiki-link{url="https://www.poe2wiki.net/wiki/Strugglescream"} cho thêm slot). Instill không cộng dồn với allocate: allocate rồi thì instill bản 2 vô dụng → chia 2 notable CST: 1 allocate tree, 1 instill amulet.
- **Bounty Hunter** (tree): notable 25% + 3 small node 5% = **40%**. Phải allocate cả cụm; không instill (instill chỉ cho 25% notable).
- **Hunting Companion** (instill amulet) qua 3 :wiki-link{url="https://www.poe2wiki.net/wiki/Liquid_Emotion"} (Guilt + Envy + Ire): **20% CST** universal + Culling Strike against Beasts khi Companion có mặt (điều kiện Beasts). Chiếm slot instill duy nhất.
- Universal: Myris Uxor 100 + Bounty Hunter 40 (tree) + Hunting Companion 20 (amulet) + Heart of the Well max 25 = **185%**.
- **Cull the Hordes** (tree): +40% CST Rare/Unique only, không áp Normal/Magic. Có nó → total vs Rare 225% increased, Rare threshold 32.5%.
- Tree còn lại: evasion (entry chance) · ES (pool Convalescence recharge) · reservation efficiency bù Ritualist penalty **−25% Spirit** (cần đủ Spirit cho Blasphemy 60 + Convalescence 30 + Blink 60 = **150 Spirit min**) · jewel socket cho Heart of the Well + Grand Spectrum.

## Skill Gems & Links

- **Spark (main):** :wiki-link{url="https://www.poe2wiki.net/wiki/Spark"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Pierce_I"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Prolonged_Duration_I"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Rapid_Casting_I"} + projectile support.
  - Pierce → xuyên hit nhiều target trong pack. Prolonged Duration I (30% more Skill Effect Duration) kéo dài 2s base Spark → tăng coverage. Rapid Casting I (tên cũ pre-0.3.0: Arcane Tempo) tăng cast speed. :wiki-link{url="https://www.poe2wiki.net/wiki/Rapid_Casting_II"} (Tier 4) nếu budget.
  - Support slot 4: :wiki-link{url="https://www.poe2wiki.net/wiki/Multishot_I"} candidate gần nhất theo effect — **verify tên gem thật trong client** (xem Optimization). Upgrade: :wiki-link{url="https://www.poe2wiki.net/wiki/Pierce_II"} → Prolonged Duration I → Rapid Casting II.
- **Curse aura:** Blasphemy = Meta Gem (Tier 8, 60 Spirit per socketed Curse), KHÔNG phải support. Curse cắm VÀO Blasphemy qua Skills Panel (không linked socket). Temporal Chains vào Blasphemy: slow 40-59% + debuff expire chậm 25%. Gem phải **lv20** xóa level-cap clause (dưới lv20 không áp enemy trên level X → aura chết ở endgame).
- **Spirit gems:** Convalescence (Tier 4, 30 Spirit) trigger ES recharge on-demand, bảo vệ ES khỏi interrupt. :wiki-link{url="https://www.poe2wiki.net/wiki/Blink"} (Tier 8, 60 Spirit) teleport thay dodge, cooldown 3.5-4.5s, range 4-4.9m. Attrition (30 Spirit) nếu dư Spirit cho boss dài.
- `Exclusion check: none` — Culling Strike I/II Attack-only không link Spark (build không cố link) · Temporal Chains level-cap tự xóa lv20 · không conflict Blasphemy/Convalescence/Blink.

## Gear

Ưu tiên: cap res 75/75/75 (bù Unfurled Finger Reduced Resistances) → Myris Uxor + Deathblow (enabler tối thiểu, thiếu = không cull được) → 3× Ventor's IIR dương + resist không catastrophic → 3× Grand Spectrum Sapphire → Heart of the Well max → Ingenuity → Mageblood chase.

- **Helmet:** Myris Uxor — 100% CST, bắt buộc, không thay thế.
- **Gloves:** Deathblow — Culling Strike unconditional, nguồn cull chính, bắt buộc; chiếm trọn slot (Horror's Flight cùng slot không kèm được).
- **Belt:** Ingenuity (mid-endgame) → Mageblood (endgame chase). Ingenuity amplify 2 ring slot chuẩn 30% more; Mageblood hunt Legacy of Gold.
- **Ring ×3:** Ventor's Gamble (trái + phải + Unfurled Finger). 2 ring chuẩn được Ingenuity amplify, ring 3 không. Mua theo roll, chỉ IIR dương.
- **Amulet:** evasion + ES + res + life. Instill Hunting Companion qua Liquid Emotions (20% CST) — slot instill duy nhất (Bounty Hunter nằm tree).
- **Body:** evasion + ES + life + res. Rabbit Idol vào body socket nếu base có (limited 1, +12% IIR).
- **Boots:** eva + life + 30% movement speed + res.
- **Jewels:** 3× Grand Spectrum (Sapphire) → +18% all ele res. Heart of the Well (max roll 25% CST) vào diamond jewel socket còn lại.

Budget tier:
- **Entry (tối thiểu):** Myris Uxor + Deathblow + 1 Ventor's IIR dương + Bounty Hunter (tree) + Hunting Companion (instill) + Cull the Hordes (tree). Functional ngay: Normal 99.75%, Rare 28.5%.
- **Mid:** Ingenuity + 3 Ventor's (2 dương) + 3 Grand Spectrum (res solve) + Heart of the Well max. ES + evasion để survive party.
- **Endgame:** Mageblood hunt Legacy of Gold, 3 Ventor's max IIR. Area IIR qua waystone + tablet = lever chính (quan trọng hơn player IIR khi đã qua ~150%).

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 3 |
| boss_damage | 2 |
| survivability | 2 |
| mobility | 4 |
| league_start | 1 |
| budget_scaling | 3 |

- clear 3: phụ thuộc carry speed (tính khi pair carry tốt) · boss 2: Unique cull window chỉ 5%, giảm thêm party lớn · survivability 2: không damage investment ngăn hit, ES mỏng · mobility 4: Blink + MS boots · league_start 1: cần drop-restricted uniques + carry sẵn · budget_scaling 3: entry rẻ, ceiling phụ thuộc Mageblood + area IIR.

## Failure Modes

- **Runic Ward immunity (0.5 — cao nhất).** Enemy mang Runic Ward không cull được — Spark hit nhưng kill không về culler. Wave-boss, Runeforged rare, enemy mặc Runeforged armour đều có thể có Runic Ward trong 0.5. Không fallback → cull engine thất bại im lặng. Content Remnant + Runeforging sinh nhiều Runeforged rare → đọc [Remnant + Runeforging Profit Loop](/farming/0-5-remnant-runeforging-profit-loop), verify content type trước khi juice.
- **Solo không khả thi endgame.** Spark không đủ damage kéo Rare xuống 10% hay Unique boss xuống 5% HP. Không carry → build ngừng chức năng hoàn toàn, không build-around được nếu không hi sinh toàn bộ IIR stack.
- **Ventor's roll tệ phá gear.** IIR (−25→+25) và resist (−40→+40) đều âm được; Ingenuity 30% nhân more vào cả âm (−30% cold → −39%). 3 Ventor's unlucky đồng thời IIR-negative + uncap resist. Ring max IIR (+20→+25%) đắt hơn nhiều — kiểm price trước khi mua cả 3.
- **Coordinated duo là tiên quyết.** Carry không được overkill trước khi culler hit, không kết boss sớm. Random PUG không coordination → carry overkill, culler không lấy được kill. Không chạy trong public matchmaking.
- **Unique boss cull xấu hơn ở party 3-4.** 0.5 khôi phục non-unique threshold full base (buff map clear) nhưng Unique boss threshold vẫn giảm per member → party 4 đẩy cull window rất nhỏ trong khi HP boss phình 3×. Party 2 tối ưu; culler redundant trên boss nhóm lớn.
- **Map mods hard brick.** "No Energy Shield Recharge" cắt layer defense duy nhất (Convalescence không trigger recharge). "Monsters are Hexproof" kill Temporal Chains aura. "Enemies deal extra Elemental Damage" + resist âm từ Ventor's tệ = chết spike qua evasion. 3 mod này roll over hoặc brick.
- **ES recharge passives nerfed 0.5.** Convalescence notable 40%→20%, Quick Response 20%→10%, Rapid Recharge 25%→12%. Sustain yếu hơn → phụ thuộc Convalescence Spirit Gem active trigger, không được one-shot trước khi dùng.
- **Temporal Chains level-cap.** Dưới gem lv20 không áp enemy trên level X → endgame enemy vượt cap không bị slow. Lên lv20 trước T15+.
- **Acquisition gate cao.** Ingenuity (The King in the Mists, drop-restricted), Myris Uxor, Heart of the Well max-roll (15-25%), Grand Spectrum ×3 (Trial of Sekhemas) đều có gating. Entry setup rẻ hơn nhiều nhưng ceiling thấp hơn hẳn.

## Verdict

Build rất hẹp, làm đúng một việc rất tốt trong điều kiện cụ thể. Setup tối thiểu (Myris Uxor + Deathblow + Ventor's dương + passive cluster) functional với carry tốt (Normal 99.75%, Rare 28.5%). Endgame kit (Ingenuity + 3 Ventor's max + Mageblood Legacy of Gold) đẩy rarity cao hơn, nhưng carry quality + area IIR quan trọng hơn gear culler ở ngưỡng đó. Chọn nếu có duo partner sẵn, muốn role loot collector. KHÔNG chọn nếu solo, PUG, content sinh nhiều Runeforged, hay cần boss farmer chính.

## Optimization

Verify trong client khi vào league:
- **Route Fear Incarnate (Horror's Flight):** chiếm slot gloves của Deathblow → chỉ đáng thử nếu có nguồn Culling Strike luôn-bật ngoài gloves (hiện chỉ Attrition, boss-only). Nếu có: equip Horror's Flight, cull 1 pack, log stack cap + per-stack CST + decay rate. "+200% CST" trong nguồn gốc thực ra là 200-300% Evasion Rating trên item, không phải CST.
- **Tên gem projectile support slot:** một số tên gem nguồn thứ cấp không match database (zero hit "Seon's Temper", "Valenta's Propulsion"). Confirm trong Skills Panel. Multishot I và Projectile Acceleration candidate gần nhất theo effect.
- **Corrupted jewel implicit resist pool:** nếu dùng corrupted implicit thêm resist ngoài Grand Spectrum, verify pool cho loại jewel cụ thể — chưa xác nhận từ primary source.
- **Runic Ward frequency:** log encounter type nào sinh Runic Ward enemy để build whitelist content an toàn.
- **Threshold thực sau Fear Incarnate:** nếu route chạy được, sau đo per-stack CST → tính lại effective threshold vs Rare/Normal, cập nhật số ngưỡng cull.

## Changelog

### 2026-06-19
- Patch 0.5.3: Staunch Deflection thêm Deflection Rating bằng 8% Evasion Rating. Cull-bot này Witch-class, tree dồn IIR/CST + evasion node hoàn toàn off-path; class-jumper qua Ranger để chạm tốn quá nhiều điểm → pickup không khả thi cho archetype, ghi nhận để khỏi đào lại.

### 2026-06-14
- Initial draft, corrections folded từ primary source reconcile (patch note line-cited + wiki mirror + poedb live):
  - Helmet Myris Uxor (không phải "Meginord's Visage") · Gloves Deathblow (không phải "Death's Blow", không có 33% CST modifier) · notable Cull the Hordes (không phải "Call the Hordes")
  - Amulet: Instilling via Liquid Emotions (không phải "Anointing via Distilled Emotions"); Hunting Companion instill = Guilt+Envy+Ire, Bounty Hunter = Despair+Suffering+Guilt · Support Rapid Casting I/II (không phải "Rapid Cast"; cũ pre-0.3.0 Arcane Tempo) · Blasphemy Meta Gem không phải support
  - "Elder's Legacy Brew" không tồn tại 0.5. Horror's Flight (Engraved Bracers) + Deathblow (Doubled Gauntlets) đều Item class: Gloves → cùng slot, loại trừ nhau; mechanic transfer mod không có
  - Ingenuity 20-30% more (không phải "double"); amplify left + right only, không amplify Unfurled Finger · Ventor's IIR −25→+25 (âm được), resist −40→+40 mỗi resist (âm được), Ingenuity nhân more vào cả âm · Mageblood POE2: 4 Mage's Legacy passive permanent, không có flask mechanic
  - Party 0.5: non-unique threshold restored full base trong party; Unique boss threshold vẫn giảm per member
  - Bỏ Thunderfist: item page grant Crackling Palm (glove Monk unarmed), không phải Fear Incarnate; dòng Fear Incarnate gán Thunderfist chỉ ở list-page packed (cargo glitch), không đáng tin
  - Gravebind nerfed 0.5 → dùng triple Ventor's thay · Threshold math: 185% = 99.75% Normal (không phải 100%), instant cần 186%; Heart of the Well roll 15-25% (không fixed 25%) · Attrition cull Rare/Unique chỉ sau 31-40s Presence

## Relationships

- **related_guides** [Độ hiếm item: Normal, Magic, Rare, Unique và prefix/suffix](/guides/beginner-item-rarity) — IIR bucket system (player vs area), area IIR từ waystone nhân độc lập, không diminishing.
- **farming_relevance** [Withered Willow Delirium Farm](/farming/0-5-withered-willow-delirium-farm) — Delirium pinnacle; duo culler tăng loot quality khi chạy cùng carry.
- **farming_relevance** [Remnant + Runeforging Profit Loop](/farming/0-5-remnant-runeforging-profit-loop) — Runeforged rare mang Runic Ward, culler không cull được; tránh hoặc verify trước khi juice.
- **alternative_to** [Magic Find Spell Ritualist](/builds/huntress/0-5-ritualist-rarity-solo-duo) — cùng Ritualist rarity nhưng tự đánh bằng spell (Runeseeker + Blood Magic), solo/duo; chọn nếu không muốn phụ thuộc carry.
- **alternative_to** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — Ritualist self-DPS; Unfurled Finger + Ingenuity ring economics dùng cách khác hoàn toàn.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — 0.5 đổi party cull threshold (non-unique restored), Runic Ward mới, Mageblood + Horror's Flight là item mới 0.5.
