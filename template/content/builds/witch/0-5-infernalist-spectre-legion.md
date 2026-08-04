---
template: templates/build-template.md
document_type: build
title: Infernalist Spectre Legion
status: draft
author: duocnv
created: '2026-05-29'
updated: '2026-07-03'
class: Witch
ascendancy: Infernalist
league: '0.5'
patch: 0.5.0
budget_tier: league-starter
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Bind Spectre
  damage_type: elemental
  playstyle: minion
  content_focus: all-content
tags:
  - witch
  - infernalist
  - bind-spectre
  - spectre
  - minion
  - minion-army
  - summoner
  - 0-5
  - poe2
---

# Infernalist Spectre Legion

Summoner "đạo quân": bầy :wiki-link{url="https://www.poe2wiki.net/wiki/Spectre"} hồi sinh vĩnh viễn cùng một giống quái mạnh, đứng backline cày cả màn lẫn boss. Core = :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"}; gánh bởi spirit headroom + ES defense của :wiki-link{url="https://www.poe2wiki.net/wiki/Infernalist"} — hướng league-start mượt nhất 0.5.

## Build Overview

- **Damage:** bầy spectre — mỗi con tái hiện gần nguyên bộ skill của monster gốc → spectre caster/projectile mạnh = nguồn AoE sạch. Chạy **bầy đồng giống** (5-6 con cùng loại) → mỗi điểm spirit + support dồn cùng profile. AoE từ native skill spectre × số con, không cần Melee Splash.
- **Scaling 3 trục:** gem level (nâng cả damage lẫn Life spectre) × số lượng spectre (then chốt, cap bởi Spirit) × buff minion toàn cục (0.5 sửa bug → mạnh hơn).
- **Defense:** ES pool Witch + **Beidat's Hand** (Life reserved → ES); safety từ backline.
- **Ràng buộc cứng:** Spirit — mỗi spectre reserve theo sức mạnh monster gốc.
- **Tên gọi:** "Legion" là ẩn dụ, KHÔNG phải support :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Legion"} (nerf 0.5: fire DoT 20%→10%, Infernal Legion III gỡ hẳn) — build không bao giờ socket nó, nerf đó không đụng.

## Chọn spectre nào để bind

Meta con nào #1 là ẩn số ngày đầu (cần datamine); guide nghiêng:

- **Vaal Guard** (Bomber variant) — 50 Spirit, oil grenade physical+fire; kiếm ở Utzaal Act 3, tránh variant cùng tên melee/ranged.
- **Powered Zealot** — 55 Spirit, lightning Spark.
- Caster wiki-confirmed khác (đắt spirit hơn): Priest of the Sun (100, Firebolt/Solar Orb), Doryani's Elite (70, lightning orb).
- Meta 0.5 là lightning/physical — **không** phải fire (Infernal Legion gut + meta không fire), nên nhánh fire-Infernalist không tối ưu.

## Skill Gems & Links

- :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"}: cast lên xác monster non-unique → gem thành `Spectre: <tên monster>` (Summon Spectre), reviving minion account-bound. Quality → "Minions deal 0-20% more Damage" → luôn đẩy quality 20 (20% more free cả bầy). Spirit reservation theo sức mạnh monster bound → chọn con scale mạnh = nhiều damage/điểm spirit.
- **Triết lý link:** more-damage-trên-mỗi-điểm-spirit, không more% thô. Support có Cost & Reservation Multiplier làm *mỗi* spectre đắt → bớt 1 con → ưu tiên support 0% reservation multiplier.
- **Main (6L):** Summon Spectre (20% quality) + :wiki-link{url="https://www.poe2wiki.net/wiki/Magnified_Area_Support"} II (more AoE) + :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Mastery"} (+1 gem level, không downside/reservation) + :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Army"} (+30% all ele res minion) + :wiki-link{url="https://www.poe2wiki.net/wiki/Last_Gasp"} (minion chết vẫn đánh tiếp 4 giây; 0.5 vá để trong cửa sổ không die do damage vượt max Life — overkill-proof) + flex.
- **Flex/damage slot:** :wiki-link{url="https://www.poe2wiki.net/wiki/Feeding_Frenzy"} **II** (30% more damage, 20%→**15%** more damage taken, 0% reservation multiplier) — dùng bản II không bản I; support more-damage **duy nhất** cho minion (gem chỉ tag Minion + Persistent). Endgame swap Magnified Area → :wiki-link{url="https://www.poe2wiki.net/wiki/Dialla's_Desire"} (Lineage, +5% quality).
- **Aura:** spirit dư → aura/herald minion tùy element spectre. **Movement:** :wiki-link{url="https://www.poe2wiki.net/wiki/Blink"}. **Utility:** :wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Arsonist"} body phụ + detonator leveling.
- KHÔNG dùng dù tool gemcutting gợi ý: :wiki-link{url="https://www.poe2wiki.net/wiki/Crazed_Minions"} (30% more nếu vừa Revived, nhưng **115% Cost & Reservation Multiplier** + điều kiện chỉ bật khi spectre đang chết — bật liên tục = bầy chết liên tục); :wiki-link{url="https://www.poe2wiki.net/wiki/Hulking_Minions"} (Gigantic 20% more Life/Damage/size, "cost significantly more Spirit" — chỉ đáng nuôi 1 con béo lúc spirit dư).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Muster"} (7% more/*loại* reviving minion khác nhau) yếu với bầy đồng giống: 5x một spectre + :wiki-link{url="https://www.poe2wiki.net/wiki/Summon_Infernal_Hound"} = ~2 loại ≈ 14% → cắt đầu tiên khi không đa giống.
- Đừng :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Splash"} (0.5 ghi rõ chỉ hỗ trợ minion **Strike**; spectre cast/projectile không kích hoạt). Đừng :wiki-link{url="https://www.poe2wiki.net/wiki/Meat_Shield"} (35% less damage).
- `Exclusion check:` Minion Splash (chỉ Strike); Crazed/Hulking (reservation multiplier vs mục tiêu max spectre); Last Gasp **không** dùng chung bất kỳ nguồn :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Instability"} nào (0.5 vá để Minion Instability bypass Last Gasp, giết minion ngay thay vì cho cửa sổ 4 giây).

## Ascendancy

Chọn Infernalist không vì spirit-king (Druid Shaman stack spirit nhiều hơn) mà vì **ES defense layer + damage-taken conversion** → league-start mượt. Đúng 8 điểm (4 lab × 2), không có chỗ phí.

- Cổng bắt buộc **Altered Flesh**: 20% Physical taken as Chaos + 20% Cold taken as Fire + 20% Lightning taken as Fire; *prerequisite* mở cả 3 hợp đồng Beidat (mỗi hợp đồng reserve 25% Life).
- Thứ tự 8 điểm: **Altered Flesh** (2đ: small Life + notable) → :wiki-link{url="https://www.poe2wiki.net/wiki/Beidat's_Will"} (2đ: +1 max Spirit mỗi 25 max Life — biến pool Life thành spirit) → :wiki-link{url="https://www.poe2wiki.net/wiki/Beidat's_Hand"} (2đ: +1 max ES mỗi 8 max Life; key theo Life nên chạy kể cả với Pyromantic Pact) → **Loyal Hellhound** (2đ: free :wiki-link{url="https://www.poe2wiki.net/wiki/Summon_Infernal_Hound"}, tank kéo aggro + là reviving type cho Muster).
- KHÔNG lấy :wiki-link{url="https://www.poe2wiki.net/wiki/Beidat's_Gaze"} (Mana per Life, dead với ES Witch, chết dưới Pyromantic Pact).
- **Bỏ hẳn nhánh Demon Form:** node Uber **Demonic Possession** mở :wiki-link{url="https://www.poe2wiki.net/wiki/Demon_Form"} = "3% more **Spell** damage mỗi Demonflame". Spectre deal **Minion** damage → Demon Form/Demonic Possession/Mastered Darkness cho spectre thuần **0 damage** (ngoại lệ Bind Spectre re-summon giữ form nhưng không route buff). 4 điểm đó dùng Loyal Hellhound + Beidat.
- **Bringer of Flame** (damage của mình + Allies trong Presence đóng góp magnitude Flammability + Ignite) áp lên spectre nhưng chỉ nâng Ignite/Flammability (DoT), không hit damage, **chết** nếu spectre không fire → chỉ đi khi cố tình build fire-spectre (yếu hơn meta).

## Passive Tree & Mastery

- 3 cụm: minion damage/life, reservation efficiency, ES.
- **KHÔNG có "spirit cluster" trên cây.** Notable Spirit generic duy nhất **Profane Commander** (4% increased Spirit). Spirit headroom = Beidat's Will + gear + unique. Tree cho spirit = **reservation efficiency**: **Lord of Horrors** (+12% reservation efficiency of Minion Skills), **Self Sacrificing** (+40% nhưng −20% spirit reservation efficiency mọi skill).
- **Mọi node minion damage = "increased" (cộng dồn), không "more"** — more chỉ từ support (Feeding Frenzy, Bind Spectre quality). Ưu tiên small double-dip: "Spell and Minion Damage" (10%+10%, ×3), "Damage and Minion Damage" (15%+15%, ×3), "Sentinels" (10%+10%, ×5) → notable **Comradery** (30% increased), **Bringer of Order** (20% increased). 26 small "Minion Damage" (10-16%) lấp path.
- **Map ele weakness:** 3 notable minion-res mạnh hơn gem Elemental Army: **Crystalline Flesh** (+20% all ele res + 5% max), **Living Death** (+22% + 3% max), **Silent Guardian** (+20% + ailment threshold).
- **ES:** 0.5 cắt mạnh ES recharge — small faster-start 15%→**6%**, small "ES Recharge Rate" **xoá hẳn**. Notable giảm: **Rapid Recharge** (12% faster start + 12% recharge rate, từ 25%), **Dependable Ward** (12% faster start + 8% chaos res, từ 25%), **Mystic Stance** (12% từ 30%), **Devoted Protector** (10% từ 15%).
- Late-game keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Talisman"} ("bonus từ Amulet áp lên Minion thay vì mình") — nhưng tước ES/res phòng thủ amulet khỏi player.
- **Mastery:** GGG export lưu stats **rỗng** cho mastery node → đối chiếu poedb/wiki trước khi quote; để PoB làm nguồn allocation, log số thật khi vào league.

## Stat Priorities & Defenses

Chưa có sim PoB2 0.5 public tại league start → không bịa số headline. Chuỗi nhân + priority:

- **DPS chain (mỗi spectre):** `base_hit_monster × (1 + Σ increased_minion_dmg) × ∏(1 + more_i) × global_minion_buff × hit_rate × ailment_uptime`. `∏more_i` = slot damage support (Feeding Frenzy II 1.30 nếu dùng) × Bind Spectre quality (1.20) × Magnified Area (more AoE, KHÔNG more damage). Tree minion damage ∈ `(1 + Σ increased)` (cộng dồn). Tổng bầy = DPS mỗi spectre × số spectre.
- **Global minion buff — KHÔNG double-count** (một modifier): gốc 0.3 "more damage with hits and ailments vs non-unique", 3% @skill level 3 → 50% @level 8. 0.5 sửa bug → late-game ~25-35% more vs non-unique / ~20-25% vs unique. Magnitude ≈ **1.25-1.35 non-unique / ~1.20-1.25 unique** — không phải 1.50.
- **Buff ẨN khỏi tooltip:** 0.5 "no longer factored into the damage numbers displayed for skills of your minions" → tooltip + PoB2 under-report; caveat `pob_coverage: PARTIAL` cốt lõi. Đo clear-speed bằng thực chiến.
- **Spirit budget:** `Spirit = 100 (quest reward campaign, universal mọi class) + 50 (Chober Chaber) hoặc +75 (Soul Mantle) + floor(maxLife/25) (Beidat's Will) + sceptre base (~100 nếu không 2H) + gear/idol`. Ở ~1500-2000 Life, Beidat's Will +~60-80 → pool ~210-230 trước gear → nuôi **~3 con premium** (Priest 100 + Doryani 70 + Vaal Guard 50 = 220) **hoặc ~5 con rẻ** (Vaal Guard 50 + 4× con 40 = 210). "5-6 spectre" chỉ đạt với spectre rẻ + reservation efficiency + +Spirit gear.
- **ES/Life:** ES chính qua Beidat's Hand; Life reserve qua Beidat (mỗi node 25%) → đo EHP vì 50% (2 Beidat) khác 75% (3 Beidat).
- **Res:** cap 75% F/C/L trước maps; Chaos res càng cao càng tốt.
- **Test plan:** log tooltip damage mỗi spectre × số spectre × uptime → nhân tay ×1.25-1.35 (non-unique) cho buff ẩn → so clear T15-T16; log riêng unique boss (~1.20-1.25).

### Performance Ratings

| Aspect          | Rating (1-5) |
|-----------------|--------------|
| clear_speed     | 4            |
| boss_damage     | 3            |
| survivability   | 4            |
| mobility        | 3            |
| league_start    | 4            |
| budget_scaling  | 4            |

## Resources

Chưa có PoB2 0.5 sim public — gắn link sau khi materialize character + xuất từ PoB2 fork hỗ trợ 0.5.

- **PoB:** _(cập nhật sau khi vào league)_
- **Spectre reference:** danh sách spectre cộng đồng — khảo monster đáng bind, không quote số tuyệt đối.

## Gear Progression

- **Leveling:** Act đầu chưa cần unique, KHÔNG level bằng spectre. Vũ khí "+to Level of Minion Skills" + "increased minion damage" + Spirit. Món rẻ: :wiki-link{url="https://www.poe2wiki.net/wiki/Trenchtimbre"} (Spiked Club, Lvl 16, +1-2 to Level of all Minion Skills) — pair off-hand spirit/focus; clause "also affect you" = minion Attack Speed, vô hại caster spectre. Int đủ requirement gem minion Int.
- **Early Mapping:** cap 75% ba res + Spirit nuôi 3-4 spectre. Quality Bind Spectre 20 sớm. Idol rẻ: :wiki-link{url="https://www.poe2wiki.net/wiki/Primate_Idol"} trong Sceptre ("Allies in your Presence deal 40% increased Damage") + Primate Idol trong Helmet (minion 15% increased max Life); :wiki-link{url="https://www.poe2wiki.net/wiki/Rabbit_Idol"} trong Sceptre (15% increased Spirit, limit 1).
- **Endgame:** trục số 1 = số lượng spectre → unique đáng nhất :wiki-link{url="https://www.poe2wiki.net/wiki/Bones_of_Ullr"} (boots, thêm thẳng minion count). Body :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Mantle"} — 0.5 cho **+75 to Spirit** (thay reduced Totem Life cũ), downside "random curse khi Totem chết" trơ (không totem); +75 > +50 Chober, không tranh slot vũ khí.
- **Vũ khí (tradeoff PoB):** :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} (Two-Hand Leaden Greathammer, Requires Lvl 33, 60 Str, 100 Int — không sceptre): +50 Spirit, +(80-100) Mana, +2-3 to Level of All Minion Skills, clause "Increases/Reductions to Minion Damage also affect you" (trơ). vs :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock"} (Perching Staff, Lvl 70): Minions deal 111% increased Damage + 34% increased Spirit Reservation Efficiency + 14% Cast Speed + 24 Int — không flat Spirit/gem level, staff → mất base-spirit off-hand. Chober thắng +50 flat Spirit + 2-3 gem level (nâng minion Life); Raven's Flock thắng reservation efficiency + cast speed.
- Slot Last Gasp endgame → :wiki-link{url="https://www.poe2wiki.net/wiki/Tecrod's_Revenge"} (Lineage, chia sẻ cơ chế "không die trong cửa sổ").
- **Mirror Tier:** stack tối đa 3 đòn bẩy Spirit (đừng double-count): flat (Chober +50, Soul Mantle +75, sceptre base ~100, suffix "Lord's" 20-26% increased), % increased (:wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy"} 54-63%, Rabbit Idol 15%), reservation efficiency (Raven's Flock 34%, Bones of Ullr cho Undead). Reservation efficiency mạnh nhất per-point. Bầy đầy → minion damage % + 1 spectre cao cấp.
- **Quipolatl's Thesis** (:wiki-link{url="https://www.poe2wiki.net/wiki/Quipolatl's_Thesis"} soul core Gloves, "ES Recharge starts when your Minions are Reformed"): tech riêng, không guide meta nào dùng, kém tin cậy — "Reform" nghiêm ngặt hơn revive, chỉ kích khi minion permanent hồi sau hết timer ~7.5s, không tính revive nhanh/Last-Gasp/leash → backline an toàn / boss dài **không** fire đúng lúc. Utility mapping tình huống.
- Anti-rec: đừng :wiki-link{url="https://www.poe2wiki.net/wiki/Heartbound_Loop"} ("300 Physical Damage taken on Minion Death" cascade giết khi 5-6 con chết/hồi liên tục).

## Flasks

- ES + utility. Giữ 1 :wiki-link{url="https://www.poe2wiki.net/wiki/Life_Flask"} để mở :wiki-link{url="https://www.poe2wiki.net/wiki/Umbilicus_Immortalis"} (belt: "Minions cannot Die while affected by a Life Flask" + "Your Life Flask also applies to your Minions") — trả lời boss AoE xoá bầy. Pyromantic Pact xoá Mana không Life → Life Flask + belt vẫn chạy trên Infernal Flame variant.
- Còn lại: flask kháng ailment (freeze/stun), flask movement/speed, slot tùy content. Nếu Pyromantic Pact → KHÔNG :wiki-link{url="https://www.poe2wiki.net/wiki/Mana_Flask"}.

## Leveling Notes

- **KHÔNG level bằng spectre từ level 1.** Act 1-3 minion Int cơ bản — skeleton/zombie gem-independent, summon ngay.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Arsonist"} cầu nối: reviving minion (auto-revive 7 giây) + "Command: Explosive Demise" detonate minion gần đó cho 300% base attack damage + 8% max Life minion đó dạng fire. Dùng *cùng bộ support* với Bind Spectre (Magnified Area II + Minion Mastery + Elemental Army + Last Gasp).
- Đủ Spirit + cuối Act 3 → engrave Bind Spectre, chuyển trụ damage sang spectre. Endgame re-bind con mạnh hơn: disenchant gem cũ (trả Bind Spectre trắng) + bắt con mới.

## Budget & Investment

- Sàn thấp: vài chaos cap res + sceptre minion-level + Primate/Rabbit Idol.
- Breakpoint đầu: Bones of Ullr (thêm spectre = damage tuyến tính) + Soul Mantle (+75 Spirit). Breakpoint sau: vũ khí endgame (Chober rẻ league-start, Raven's Flock đắt hơn) + stack +Spirit/reservation efficiency.
- Diminishing returns khi bầy đầy + spirit dư → minion damage % + 1 spectre cao cấp thay con thứ 7.

## Failure Modes

- **Map mod hostile.** "minions deal no/less damage" cắt nguồn damage duy nhất → reroll waystone. "Less recovery"/"less recovery rate" hỏng chu kỳ revive → bầy mỏng dần. Ele weakness ăn minion res — mitigate Elemental Army + 3 notable max-ele-res; cẩn thận ele weakness + extra ele damage chồng nhau.
- **One-shot qua cửa sổ 4 giây.** Last Gasp cho 4 giây sau Life về 0 rồi revive; 0.5 vá minion không die do damage vượt max Life. Boss AoE >4 giây (slam liên hoàn, beam quét, degen vùng) vẫn xoá bầy sau khi cửa sổ đóng → quãng trống damage khi cả legion cùng revive. Umbilicus Immortalis là câu trả lời tốt nhất; boss pinnacle AoE phủ sàn liên tục = khắc tinh.
- **Spirit / gear floor + patch sensitivity.** Paper math giả định 5-6 spectre; dưới sàn (thiếu Bones of Ullr/Soul Mantle/Beidat) → 3-4 con, damage tụt tuyến tính. Nhạy 2 thứ GGG dễ chỉnh: buff minion toàn cục (vừa sửa bug 0.5) + spirit cost spectre.
- **League-start viability vs meta companion.** vs single-companion :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} (dồn 1 beast), legion *chia* đầu tư N con; Tame Beast vừa buff 0.5 (+40% more @gem level 9 → +84% @level 20, min gem level 9→7) → khoảng cách boss-DPS rộng hơn. Legion thắng clear/budget/lì backline; pinnacle bossing tối thượng → companion tập trung mạnh hơn.

## Verdict

- Infernalist = pick league-start / ES-defense mạnh, **không** phải spirit-king (Shaman) hay endgame-king (Lich miễn nhiễm nerf 0.5). Edge = ES defense + smoothness + Altered Flesh conversion.
- Tốt: clear speed cao (AoE native + Magnified Area), survivability backline (Last Gasp overkill-proof), league-start gần free. Struggle: boss single-target (buff toàn cục lên unique ~20-25% vs ~50% trash + bầy chia N con), Spirit là trần cứng.
- Meta spectre #1 chưa chốt ngày đầu — đợi datamine ngày 3-7; DPS tuyệt đối chờ PoB2 0.5 sim.

## Changelog

### 2026-05-29
- Dựng lại toàn diện sau verify từ 0.5.0 + wiki mirror + passive tree 0.5 + meta live: bỏ nhánh Demon Form (buff Spell không Minion), thêm Altered Flesh gate + thứ tự 8 điểm, hết double-count global minion buff (một modifier ~1.25-1.35 non-unique, ẩn tooltip), exemplar spectre Vaal Guard + Powered Zealot, link Magnified Area II + Minion Mastery + Elemental Army + Last Gasp (bench Crazed/Hulking vì reservation tax), ưu tiên Bones of Ullr + Soul Mantle, demote Quipolatl/Chober, thêm Umbilicus Immortalis + anti-rec Heartbound Loop, reframe Infernalist vs Lich/Shaman. DPS tuyệt đối chưa chốt (chưa có PoB2 0.5 sim).
- Initial draft (cùng ngày, đã thay thế): core + ascendancy verbatim từ 0.5.0.

## Relationships

- **alternative_to** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — companion tamed beast Huntress, một con carry gánh single-target; so sánh boss DPS vs clear.
- **alternative_to** [Bone Construct Mass Summoner Lich](/builds/witch/0-5-bone-construct-mass-summoner-lich) — summoner Lich endgame-king miễn nhiễm nerf 0.5; đối trọng ascendancy.
- **related_builds** [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) — spectre trên Druid Shaman (spirit-king thật của 0.5); so sánh trục spirit headroom.
- **related_mechanics** [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt) — minion/companion + spirit reservation nền tảng.
- **related_mechanics** [Energy Shield recovery](/guides/energy-shield-recovery) — nerf ES recharge 0.5 build phải path qua.
- **references** [New unique items](/guides/0-5-new-unique-items) — Chober Chaber, Soul Mantle, Raven's Flock, Bones of Ullr.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5.0.
- **alternative_to** [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) — cùng engine spectre, khác ascendancy: Infernalist thiên league-start floor + Spirit (Beidat's Will) + ES defense, Lich thiên endgame ceiling qua chaos-conversion + mana-scaling.
- **related_guides** [Minion Army Build Comparison](/guides/0-5-minion-army-build-comparison) — league-start an toàn nhất: backline ES tự hồi sinh, né trọn nerf Infernal Legion.
