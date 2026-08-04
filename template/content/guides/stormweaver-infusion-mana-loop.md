---
template: templates/mechanic-template.md
document_type: mechanic
title: Stormweaver Infusion Mana Loop
status: draft
author: duocnv
created: '2026-05-28'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
pob_coverage: PARTIAL
tags:
  - poe2
  - sorceress
  - stormweaver
  - elemental-infusion
  - remnant
  - mana
  - power-charge
  - spark
  - comet
  - mechanic
  - return-of-the-ancients
---

# Stormweaver Infusion Mana Loop

Engine sustain biến **Elemental Infusion** thành mana: không chạy mana regen mà hồi mana bằng nhặt **Remnant** + consume **Power Charge**, đủ spam :wiki-link{url="https://www.poe2wiki.net/wiki/Comet"} không nghỉ trên boss.[^1] Node tree + Stormweaver ascendancy có từ 0.1–0.4, chỉ đóng vòng ở 0.5.0 sau free passive refund "due to the changes" → đọc node mana từ export 0.5.0.[^18] Chưa character nào chạy live 0.5 — league-start plan của mas0ny1 ("this will be a learning experience"; "I'm hoping GGG does not see this... before league start").[^1] Đáng phân tích vì loop net-positive mana hiếm không cần :wiki-link{url="https://www.poe2wiki.net/wiki/Archmage"}; Abiding Hex trong Cast on Critical có thể là bug → quyết định chốt tuần league launch 2026-05-29.[^1][^19]

## Cơ chế: hai path mana độc lập

- **Elemental Infusion tự nó KHÔNG cho mana**: wiki "Elemental Infusions by themselves do nothing, making increased Remnant Effect useless on them".[^5] Infusion = buff sinh dạng Remnant trên đất; nhặt Remnant mới cho buff, cap 3 stack/nguyên tố, 20s hoặc tới khi consume. Mana từ *nhặt* Remnant, KHÔNG từ *tiêu* infusion.[^5]
- **Path A (nhặt Remnant)**: node 0.5.0 "Recover 3% of Maximum Mana when you collect a Remnant" + song sinh "Recover 3% of Maximum Life...".[^2] Slot luôn đầy (cap 3) → *tiêu* cái cũ mở chỗ → *nhặt* cái mới (cú nhặt mới sinh 3% mana). Nguồn Remnant: :wiki-link{url="https://www.poe2wiki.net/wiki/Frost_Bomb"} (Cold Infusion khi nổ)[^11], :wiki-link{url="https://www.poe2wiki.net/wiki/Siphon_Elements"} (5% chance/nguyên tố spawn Remnant khi Freeze/Ignite/Shock)[^7], notable **Storm's Recollection** "Remnants you create reappear once, 3 seconds after being collected" → mỗi Remnant nhặt hai lần, double mana Path A.[^6]
- **Path B (Power Charge)** — mắt xích trả mana lớn nhất/kích: node "Gain a Power Charge when you consume an Elemental Infusion"[^3] → mỗi lần tiêu infusion nạp 1 charge. Cụm 4 node "Recover 2% of maximum Mana when you consume a Power Charge" (×3) + "Recover 5%..." (×1) = **11% max mana per power charge consumed**.[^2] Consume charge chủ động: :wiki-link{url="https://www.poe2wiki.net/wiki/Enfeeble"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Abiding_Hex"} "Supported Skills consume a Power Charge on use"[^13] → mỗi Enfeeble cast (qua Cast on Critical) ăn 1 charge → 11% max mana. Enfeeble cost < 11% max mana → lãi ròng.[^1]
- Cả hai path chạy → mana bar gần đứng yên giữa boss fight, Comet mưa liên tục. Character bị giới hạn bởi số Comet, không phải mana → nâng cấp = tăng damage :wiki-link{url="https://www.poe2wiki.net/wiki/Spark"} để mỗi hit sinh nhiều energy → nhiều Comet.[^1]

## Mana mỗi chu kỳ (mẫu 1.5k max mana, perfect uptime)

- Cold-Infused Spark consume 1 Cold Infusion → 1 Remnant → +3% = **+45 mana**[^8][^2]
- Comet + Spell Cascade consume 3 Fire Infusion → 3 Remnant → +9% = **+135 mana**[^9][^2]
- Flame Wall consume 1 Lightning Infusion → 1 Remnant → +3% = **+45 mana**[^12][^2]
- Firestorm consume tối đa 3 infusion → tối đa 3 Remnant → +9% = **+135 mana**[^10][^2]
- Enfeeble + Abiding Hex consume 1 Power Charge (cụm 2+2+2+5) → +11% = **+165 mana**[^13][^2]
- **Total +35% max mana ≈ +525 mana/chu kỳ**[^1]
- Cost = tổng mana cost phẳng (không Archmage nên không scale max mana). Sheet mas0ny1: −364 mana/chu kỳ → **net +161 mana/chu kỳ** ở 1.5k.[^1]
- Bất đối xứng: gain = %max mana, cost = **flat**. 3k max mana → gain +1050, cost ~−364 → margin +686. Lý do đi **Mind Over Matter** + hybrid life/mana + kéo max mana cao.[^1][^16] Firestorm + Comet+Spell Cascade ưu tiên vì ăn nhiều infusion nhất (tối đa 3) → nguồn mana chính Path A, không phải damage chính.[^1][^10]

## Tương tác chính

- **Refracted Infusion**: "When collecting an Elemental Infusion, gain another different Elemental Infusion"[^6] → nhân đôi tốc độ tích infusion (chỉ Frost Bomb sinh Cold vẫn nhanh có đủ 3 nguyên tố). + Storm's Recollection → tốc độ sinh infusion Stormweaver vượt xa ascendancy khác (engine gần như chỉ chạy trên Stormweaver).[^6]
- **Charge Regulation**: "(20-26)% more Critical Hit Chance while you have a Power Charge" + "Consumes one of each Charge every 10 seconds".[^15] Path B sinh power charge liên tục → uptime ~100% → crit bonus gần permanent; ăn charge mỗi 10s lại feed cụm node 11% mana. Crit cao quan trọng vì endgame trigger Comet qua Cast on Critical bằng Spark.[^1]
- **Cold-Infused Spark crit ẩn**: base Spark 9% crit, Cold-Infused → 11%[^8] → build crit đi hướng cold; mỗi % crit nền khuếch đại tần suất trigger Cast on Critical → nhiều Comet.[^1][^8]
- **Infusion Remnant vs league Remnant** (dễ nhầm): Infusion Remnant = vật thể caster tạo, nhặt để nhận Elemental Infusion buff, cap 3/nguyên tố, 20s.[^5] Remnant (Runic Recipe crafting) = league Runes of Aldur, không liên quan mana/infusion.[^19] Chữ "Remnant" trong context Stormweaver/Infusion luôn là Infusion Remnant.

## Mind Over Matter có thể cắt hồi mana

- **Mind Over Matter** = "All Damage is taken from Mana before Life" + "50% less Mana Recovery Rate".[^16] Dòng 50% less recovery rate chưa được mas0ny1 nhắc, có thể bào mòn math chain nếu áp lên hồi 3%/11%. "Recovery Rate" chắc chắn cắt regen + leech; cắt luôn instant recovery "recover X% on event" hay không chưa xác nhận. Nếu áp: +525 gain tụt còn ~+262, đủ lật một số setup max-mana thấp sang net-negative — **test target #1** khi vào league, không phải kết luận.[^16][^1]

## Hướng đầu tư (thứ tự: max mana → power-charge uptime → damage)

- Max mana = đòn bẩy lớn nhất (gain %max, cost flat).[^1][^16] Ascendancy: Refracted Infusion + Storm's Recollection sớm; Storm's Recollection "Remnants can be collected from 50% further away" hốt trọn 3 Remnant từ Frost Bomb spell-cascade.[^6] **Force of Will** "20% of Damage is taken from Mana before Life" (lớp MoM nhỏ free + buff Arcane Surge theo mana thiếu hụt).[^6]
- Enfeeble giữ **level thấp nhất**: cost 41 mana lvl1 → 178 lvl20.[^14] Lãi Path B cố định 11% (165 mana ở 1.5k) → lvl1 (41) net +124/cú, lvl20 (178) lỗ −13. mas0ny1 thừa nhận lỡ level Enfeeble cao là sai lầm; engine muốn curse rẻ nhất, không phải mạnh nhất.[^1][^14] Cùng nguyên tắc cho Firestorm.[^1]
- Chống RNG infusion: mana-on-Remnant đã đủ; mana-on-kill tùy chọn (không cần thiết).[^1] Endgame swap Adonia's ego → Pinnacle of Power buff cả 3 nguyên tố, Siphon Elements proc đều 3 màu thay vì lệ Frost Bomb.[^1]

## Va chạm endgame

- **Mana Tempest**: spike DPS clear/boss nhưng buộc đứng yên: "Empowers your Mana-costing Spells while you remain inside it" + "30% of Mana and Life spent while in the storm is added to this Skill's Mana Cost per Second".[^17] Đứng yên đối nghịch phòng thủ chính (chạy freeze cả màn) → chọn giữa Mana Tempest (damage cao, bất động) và kiting freeze (an toàn, damage thấp) tuỳ encounter.[^1][^17]
- Defense dựa nặng freeze toàn màn từ Cold-Infused Spark → encounter kháng/miễn freeze lột trần điểm yếu defense.[^1]

## Anti-patterns

- ✗ Cắm increased Remnant Effect để infusion mạnh hơn — "Elemental Infusions by themselves do nothing, making increased Remnant Effect useless on them"; Remnant Effect chỉ ảnh hưởng Remnant có giá trị nội tại.[^5]
- ✗ Kỳ vọng consume infusion trực tiếp ra mana — node chỉ trả mana khi *nhặt Remnant* (Path A) hoặc *consume Power Charge* (Path B); hết Remnant trên đất → spam skill ăn infusion chỉ tốn mana, loop đứt.[^5][^2]
- ✗ Đôn Enfeeble/Firestorm lên level cao "cho mạnh" — dùng để mở khoá mana; level cao làm cost vượt lượng mana mở khoá, lật chu kỳ âm.[^1][^14]
- ✗ Vào endgame vẫn dùng staff — chuyển **wand + scepter ở T15 để đủ 190 spirit**: Cast on Critical setup endgame cần 190 spirit, wand cho cắm scepter (nguồn spirit lớn); staff tốt cho early rush tới T15 nhưng không đủ spirit fit Cast on Critical đầy đủ.[^1]

## Chi phí + giới hạn cơ chế

- Spirit: setup endgame ~190 spirit gồng :wiki-link{url="https://www.poe2wiki.net/wiki/Cast_on_Critical"} + aura → gần như bắt buộc scepter (buộc dùng wand làm vũ khí chính thay staff).[^1] Siphon Elements 30 spirit + Charge Regulation 30 spirit.[^7][^15]
- Restriction: Path B chỉ chạy nếu có power charge (từ consume infusion); chuỗi infusion đứt (RNG, hết Remnant nguồn) → Path B im. Mana cap 3 infusion/nguyên tố → không tích trữ gồng qua giai đoạn khô Remnant.[^5]
- Downside: MoM "50% less Mana Recovery Rate" (xem mục caveat).[^16] Defense mỏng — gear test "very bad", character "squishy", phòng thủ gần như chỉ freeze cả màn → engine mana mạnh không bù survivability ở pha one-shot.[^1]
- Patch gating: Abiding Hex trong Cast on Critical bị chính tác giả gọi "could be considered a bug"; engine chạy được không cần Abiding Hex nhưng phải bù pool mana lớn hơn / cost efficiency cao hơn → margin hẹp lại đáng kể nếu vá.[^1]

## Đánh giá + câu hỏi còn mở

- Engine net-positive mana **thật về cơ chế**: mọi node (3% mana/Remnant, 11%/power charge từ cụm 2+2+2+5, "gain power charge on consume infusion") xác nhận verbatim export 0.5.0; Abiding Hex consume power charge + Enfeeble cost thấp khớp wiki.[^2][^13][^14]
- Net-positive chu kỳ thực phụ thuộc uptime nhặt Remnant (RNG) + giả định perfect collection — +161/chu kỳ chỉ số trên giấy, cần đo mana thực trước/sau một chu kỳ khi vào league.[^1]
- Build sống (clear/boss thực 0.5) chưa kiểm chứng: chưa character live, Comet nerf 0.5 xuống 787–1181 damage lvl 20 (trước 829–1243), defense mỏng.[^9][^1]
- **Verdict: EXPLOITABLE, patch-sensitive.** Khai thác bất đối xứng %-gain vs flat-cost; treo trên hai biến chưa chốt.
- Open Q1: Abiding Hex trong Cast on Critical sống qua hotfix đầu league không? Vá → margin hẹp, cần pool mana lớn hơn.[^1]
- Open Q2: "50% less Mana Recovery Rate" của MoM cắt hồi 3%/11% không? Log mana trước/sau một chu kỳ ngay khi vào league.[^16]
- Open Q3: với Comet nerf, số Comet/giây còn đủ boss DPS check endgame mới không? Test T15 full boss point sau launch 2026-05-29.[^9][^19]

## Version History

### Patch 0.5.0 (Return of the Ancients — 2026-05-29)
Character passive tree tinh chỉnh + free refund "due to the changes" → đọc node mana từ export 0.5.0. Comet nerf: lvl 20 xuống 787–1181 (từ 829–1243); Fire-Infused xuống 787–1181 (từ 1036–1554). :wiki-link{url="https://www.poe2wiki.net/wiki/Ice_Nova"} mất khả năng originate từ Frostbolt khi cascade ngang.[^18][^9] Patch đầu tiên engine đóng vòng như league-start plan công khai.[^1]

### Patch 0.4.0
Stormweaver buff mắt xích nền: Refracted Infusion thành 100% "gain another different Elemental Infusion" (trước 50% chance), Storm's Recollection thêm "collected from 50% further away".[^6]

### Patch 0.3.0–0.2.0
Storm's Recollection (đổi tên từ Scouring Winds) nhận "Remnants reappear once"; Force of Will rework sang "20% of Damage is taken from Mana before Life"; node mana nhỏ Stormweaver chuyển "4% increased maximum Mana" → "12% increased Mana Regeneration Rate".[^6] Abiding Hex giới thiệu 0.2.0, đặt nền Path B power-charge.[^13]

## Relationships

- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — cùng league 0.5 caster/companion archetype, tham chiếu khi so sánh league-start option.
- **alternative_to** [Infernal Legion Ignite Loop](/guides/infernal-legion-ignite-loop) — một engine self-sustain khác của Witch, đối chiếu mô hình loop.
- **related_mechanics** [Lavianga's Spirits](/guides/laviangas-spirits) — caster spam cast speed cao, archetype hưởng lợi nhất từ mana recovery thụ động.
## References

[^1]: mas0ny1 — *"[POE2 0.5] My League Start Plans: Comet Spam Stormweaver"* (2026-05-28). Mô tả engine, math chain mana gain/loss, leveling, gear transition, và tác giả tự khai Abiding Hex "could be considered a bug" + chưa từng chơi caster POE2. <https://www.youtube.com/watch?v=CrRAcnBaMvw>

[^2]: GGG passive skill tree export, tag `0.5.0` (`data/passive-tree/0.5.0/data.json`, fetched 2026-05-26, source `grindinggear/poe2-skilltree-export`). Node verbatim: "Recover 3% of Maximum Mana when you collect a Remnant"; "Recover 3% of Maximum Life when you collect a Remnant"; "Gain a Power Charge when you consume an Elemental Infusion"; ba node "Recover 2% of maximum Mana when you consume a Power Charge" + một node "Recover 5% of maximum Mana when you consume a Power Charge" (tổng 11%). Mind Over Matter và Infusion of Power hiện diện trong cùng export.

[^3]: GGG passive skill tree export 0.5.0 — node "Gain a Power Charge when you consume an Elemental Infusion" (mắt xích sinh power charge cho Path B).

[^4]: GGG passive skill tree export 0.5.0 — cụm bốn node consume-power-charge: 2% + 2% + 2% + 5% = 11% max mana mỗi power charge consumed.

[^5]: poe2wiki — *Infusion*. "Picking up the Remnant grants you the Infusion for 20 seconds or until it is Consumed by another Skill. You can have up to 3 of each Infusion by default." + "Elemental Infusions by themselves do nothing, making increased Remnant Effect useless on them." <https://www.poe2wiki.net/wiki/Infusion>

[^6]: poe2wiki — *Stormweaver*. Refracted Infusion: "When collecting an Elemental Infusion, gain another different Elemental Infusion"; Storm's Recollection: "Remnants you create reappear once, 3 seconds after being collected" + "Remnants can be collected from 50% further away"; Force of Will: "20% of Damage is taken from Mana before Life". Version history xác nhận 0.4.0 buff Refracted Infusion lên 100%. <https://www.poe2wiki.net/wiki/Stormweaver>

[^7]: poe2wiki — *Siphon Elements*. Spirit gem, reservation 30 Spirit: "5% chance per Power to spawn a Cold Remnant on Freezing", "5% chance to spawn a Fire Remnant on Igniting a non-Ignited target", "5% chance to spawn a Lightning Remnant on Shocking a non-Shocked target". <https://www.poe2wiki.net/wiki/Siphon_Elements>

[^8]: poe2wiki — *Infusion* (mục Spark). Spark base Critical Strike Chance 9.00%, "Consumes a Cold Infusion if possible to fire many sparks in a circle"; bản Cold-Infused: Critical Hit Chance 11.00%, fires 12–16 projectiles, +0.5s cast time. <https://www.poe2wiki.net/wiki/Spark>

[^9]: poe2wiki — *Comet* (Cost (17–173) Mana, "Consumes a Fire Infusion if possible") cùng GGG 0.5.0 patch notes: "Comet: Now deals 212 to 318 Cold Damage at Gem level 11 (previously 223 to 335), scaling up to 787 to 1181 damage at Gem level 20 (previously 829 to 1243). Fire-Infused Comet now deals 212 to 318 ... scaling to 787 to 1181 (previously 1036 to 1554)." (`data/release-notes/Version_0.5.0.md`). <https://www.poe2wiki.net/wiki/Comet>

[^10]: poe2wiki — *Firestorm*. "Can Consume all three types of Elemental Infusion, creating a much larger storm when Fire-Infused, causing lightning bolts when Lightning-Infused, and raining ice bolts when Cold-Infused." Cost (14–147) Mana. <https://www.poe2wiki.net/wiki/Firestorm>

[^11]: poe2wiki — *Frost Bomb*. Cost (9–99) Mana, Cooldown 6.00s, để lại Cold Infusion khi detonate, áp Elemental Exposure tới tối đa 50%. <https://www.poe2wiki.net/wiki/Frost_Bomb>

[^12]: poe2wiki — *Infusion* (mục Flame Wall). "Consumes a Lightning Infusion if possible to also add Lightning damage to the Projectiles." <https://www.poe2wiki.net/wiki/Flame_Wall>

[^13]: poe2wiki — *Abiding Hex*. Support gem (Curse): "Supported Skills consume a Power Charge on use" + significant Curse duration. Introduced 0.2.0. <https://www.poe2wiki.net/wiki/Abiding_Hex>

[^14]: poe2wiki — *Enfeeble*. Curse spell, Cost (41–178) Mana scaling theo gem level 1→20, "Curse all targets in an area ... making them deal less damage". <https://www.poe2wiki.net/wiki/Enfeeble>

[^15]: poe2wiki — *Charge Regulation*. Spirit gem, reservation 30 Spirit: "(20-26)% more Critical Hit Chance while you have a Power Charge", "Consumes one of each Charge every 10 seconds". <https://www.poe2wiki.net/wiki/Charge_Regulation>

[^16]: poe2wiki — *Mind Over Matter*. Keystone: "All Damage is taken from Mana before Life" + "50% less Mana Recovery Rate". <https://www.poe2wiki.net/wiki/Mind_over_Matter>

[^17]: poe2wiki — *Mana Tempest*. Cost 1% Mana per second: "Empowers your Mana-costing Spells while you remain inside it" + "30% of Mana and Life spent while in the storm is added to this Skill's Mana Cost per Second". <https://www.poe2wiki.net/wiki/Mana_Tempest>

[^18]: GGG 0.5.0 patch notes (`data/release-notes/Version_0.5.0.md`): "a free passive tree refund has been granted due to the changes"; section "Passive Tree Changes"; "Ice Nova: Is no longer able to originate from Frostbolt while cascading sideways."

[^19]: GGG 0.5.0 patch notes (`data/release-notes/Version_0.5.0.md`): "The Return of the Ancients expansion contains a new league, an overhaul to Path of Exile 2's Endgame, with six new Endgame storylines and 2 new Ascendancy classes" (Martial Artist/Monk, Spirit Walker/Huntress); league Runes of Aldur dùng Remnant + Runic Recipe crafting; "Added support for Build Guides ... .build files".
