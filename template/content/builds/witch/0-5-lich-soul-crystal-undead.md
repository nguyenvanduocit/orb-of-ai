---
template: templates/build-template.md
document_type: build
title: Lich Soul Crystal Undead Companion
status: draft
author: duocnv
created: '2026-06-19'
updated: '2026-07-03'
class: Witch
ascendancy: Lich
league: '0.5'
patch: 0.5.3
budget_tier: high-budget
confidence_level: LOW
pob_coverage: NA
build_tags:
  primary_skill: His Grave Command
  damage_type: chaos
  playstyle: minion
  content_focus: endgame
tags:
  - witch
  - lich
  - his-grave-command
  - the-unborn-lich
  - soul-crystal
  - companion
  - undead
  - unholy-might
  - abyss
  - 0-5
  - 0-5-3
  - poe2
---

# Lich Soul Crystal Undead Companion

Witch Lich kéo companion Undead khổng lồ từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_Unborn_Lich"} làm carry, phủ lớp extra Chaos của :wiki-link{url="https://www.poe2wiki.net/wiki/Unholy_Might"} lên nó, ascendancy đẩy magnitude Chaos theo max-mana. Endgame luxury, KHÔNG league-start — gating dài (staff + prefix + con Undead 4 mod).

## Build Overview

- **Damage từ companion, không skill của mình.** :wiki-link{url="https://www.poe2wiki.net/wiki/His_Grave_Command"} hinder rare Undead → giết khi còn hinder → gem thành **Soul Crystal: &lt;tên monster&gt;**, companion permanent giữ tối đa **4 monster modifier ngẫu nhiên** từ con gốc. Modifier retain quyết build (aura "Allies deal extra fire damage" → buff-bot; "drops corpses that explode" → AoE bomb; "monsters near it deal more damage" → stack lên chính nó). Không scale gem level → power budget = (1) chọn base mạnh, (2) roll 4 mod đáng, (3) lớp damage của mình đắp lên.
- **Lớp damage = Lich:** :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Conduit"} cho mình + Allies trong Presence Unholy Might khi không Low Mana (minion là Ally) → 30% damage gained as extra Chaos vào hit companion. :wiki-link{url="https://www.poe2wiki.net/wiki/Blackened_Heart"} 4% increased Magnitude of Unholy Might per 100 max Mana → 1000 mana = +40% magnitude. Curse khoá Chaos res enemy. :wiki-link{url="https://www.poe2wiki.net/wiki/Rupture_the_Soul"}: xác cursed bị companion giết nổ ¼ max Life thành Chaos → clear pack free khi có curse uptime.
- **Defense:** ES pool Witch + curse-aura + companion soak aggro. Backline ra command.
- Patch 0.5.3: His Grave Command bỏ Spirit cost **cast-skill** (trước là reservation kiểu Tame Beast).

## Gating & capture

- :wiki-link{url="https://www.poe2wiki.net/wiki/The_Unborn_Lich"} = Ravenous Staff **drop-restricted** từ :wiki-link{url="https://www.poe2wiki.net/wiki/Vessel_of_Kulemak"} (boss cuối Abyssal Depths qua :wiki-link{url="https://www.poe2wiki.net/wiki/Kulemak's_Invitation"}). Không chance/craft được, phải hunt boss. Staff yêu cầu **Level 78, 137 Int**.
- Staff roll **một** custom desecrated prefix từ pool 5 granted skill (Foul Emergence / Scattering Calamity / Vile Intrusion / Winnowing Flame / **Grave Command**) → xác suất prefix Grave Command = **1/5** mỗi cây. + 3 mod desecrated khác (1 Lich prefix Amanamu/Ulaman/Kurgal, 1 Lich suffix, 1 prefix-or-suffix flex). Reroll bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Essence_of_the_Abyss"} tốn nhiều bone resource Abyss.
- Có staff Grave Command → gem socketed hiện monster category trên enemy. Hunt rare Undead endgame map, tốt nhất Abyssal Depths (native Undead + rare đông). Cast Grave Command → Hinder (**8-11.8 giây** tùy gem level) → giết trong cửa sổ → gem thành Soul Crystal account-bound (chuyển character được, **không trade** được). Hỏng cửa sổ → gem giữ nguyên, cast lại.
- Soul Crystal **vẫn reserve Spirit** theo % dựa sức mạnh con bind + số monster modifier retain. Quality Soul Crystal = 0-10% increased Reservation Efficiency; level cố định theo level Grave Command lúc capture (không level up gem trực tiếp). Caveat 0.5.3: cast-skill free, companion vẫn ăn Spirit → fit **1 con béo + utility nhỏ**, không 5 companion stack.

## Quality 0.5.3

- Trước 0.5.3: quality His Grave Command = "0-20% increased Reservation Efficiency" (giảm Spirit cho Soul Crystal output). 0.5.3 đổi thành "**0-20% more Minion Life**" áp lên skill pre-capture → scale độ tank companion sau summon; phần giảm Spirit Soul Crystal output mất đường (Soul Crystal quality vẫn 0-10% Reservation Efficiency theo wiki, đo client xác nhận).
- Đẩy quality 20 ngay: 20% more Minion Life **multiplicative**, companion life pool cao → cộng vài chục nghìn life thật.

## Chọn con Undead để bind

- Wiki để trống danh sách His Grave Command, community đang điền — chưa canonical. Chọn theo 3 tiêu chí: base hit damage cao + Undead category · spawn rare ổn định để chờ đúng 4 mod · reservation thấp nếu ưu tiên Spirit cho aura phụ.
- Hunt Abyssal Depths. Cast Grave Command lên rare, **đọc 4 mod retain trước khi giết** (skill cho view monster modifier khi gem socketed); mod không đáng → để sống, tìm con khác (mod retained sống cùng companion vĩnh viễn). Ưu tiên: offensive aura ("Allies deal additional damage as X", "Allies have X% increased Attack Speed"), on-hit ("Hits Maim/Bleed/Ignite"), scale damage chính nó ("deals more damage", "extra damage as X").
- :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} có community spreadsheet từng monster (link từ wiki Grave Command) nhưng cho Beast/Spectre category, **không transfer 1:1**. Pattern hunt: farm Abyss Tablet juiced Abyssal Depths nhiều lần, mỗi lần bind thử một rare, drop Soul Crystal kém vào stash, đến khi ra con vừa ý.

## Support gems (Soul Crystal)

Nhận support :wiki-link{url="https://www.poe2wiki.net/wiki/Minion"} thông thường + 3 Abyss Lineage support unlock riêng Lich-flavor:

- **Damage:** :wiki-link{url="https://www.poe2wiki.net/wiki/Feeding_Frenzy"} II (30% more damage / 15% more damage taken, sạch nhất). Hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Execute_III"} nếu carry boss (30% more vs low life enemies, 30% more khi mình low life; Lich Eternal Life path đứng Life 1 → kích hoạt vĩnh viễn).
- **Hulking + Mastery:** :wiki-link{url="https://www.poe2wiki.net/wiki/Hulking_Minions"} (Gigantic: larger, more life, more damage, đổi "cost significantly more Spirit", chỉ lắp khi Spirit thoải mái sau route aura qua :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Communion"}). :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Mastery"} (+1 minion skill level; companion không scale gem-level như spectre nhưng base stat vẫn nhân — đo client trước commit).
- **Kurgal's Leash** (Lineage Abyss carry chính, :wiki-link{url="https://www.poe2wiki.net/wiki/Kurgal's_Leash"}): category Blackblood, **120% Cost & Reservation Multiplier**, requires Level 25 + 5 Int. Mỗi lần Command companion → mình + nó nhận Unholy Might 15 giây. Lich đã có Unholy Might nền từ Necromantic Conduit, Kurgal chồng copy khác nhưng **Unholy Might không stack** (giữ copy mạnh nhất). Giá trị thật: (a) phòng Low Mana tắt Necromantic Conduit còn 15s Kurgal, (b) buff áp luôn lên **mình**. Trade-off: 120% reservation làm Soul Crystal đắt thêm ~¼ Spirit → quyết bằng ratio Spirit pool / Soul Crystal cost.
- **Tecrod's Revenge** (Last Gasp tier endgame): companion không chết ngay khi life về 0, fight tiếp 20 giây trước khi chết hẳn, kèm Soul Eater + 40% increased Attack/Cast Speed giai đoạn dying. Boss dài/multi-phase → cửa sổ 20s + Soul Eater + 40% speed là phase chốt damage (chỉ cần kích lúc HP về 0).
- **Amanamu's Tithe** (Lineage, requires Level 25 + 5 Str): 50% chance mỗi lần minion (từ supported skill) chết → mình gain Abyssal Monster Modifier random 20 giây, max 3 stack. Hợp team nhiều minion chết đi sống lại; companion solo Grave Command chết hiếm → hiệu suất kém. Để cho utility minion phụ (Bone Construct, Skeleton) khi chạy đội lai; single-carry pure không lấy.
- `Exclusion check:` Atziri's Communion "Cannot Support Skills which create Minions" → chỉ Blasphemy/aura, không lắp Grave Command/Soul Crystal. Kurgal's Leash yêu cầu Command; Soul Crystal là Companion-tag commandable nên apply được (khác Spectre autonomous không Command). Tecrod's Revenge mâu thuẫn :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Instability"} (giết minion ngay khi life về 0, bypass Last Gasp). Unholy Might không stack: Necromantic Conduit / Kurgal's Leash / prefix "You have Unholy Might" trên staff chỉ lấy copy mạnh nhất.

## Curse & Blasphemy

- Phần Chaos extra từ Unholy Might chỉ ăn khi enemy chaos-res không quá cao → :wiki-link{url="https://www.poe2wiki.net/wiki/Despair"} kéo chaos-res enemy (multiplier thật, không utility). Curse qua :wiki-link{url="https://www.poe2wiki.net/wiki/Blasphemy"} → aura quanh mình, socket Atziri's Communion để reserve Life thay Spirit (Spirit dồn companion).
- Lab 4 :wiki-link{url="https://www.poe2wiki.net/wiki/Incessant_Cacophony"} (infinite duration + curse slot 2) + keystone tree :wiki-link{url="https://www.poe2wiki.net/wiki/Whispers_of_Doom"} → 3 curse cùng lúc (Despair + Elemental Weakness + curse phụ scale theo damage type chính companion).

## Ascendancy

8 điểm Lich dồn Unholy Might + Curse, bỏ nhánh Spell more-damage (Eldritch Empowerment / Price of Power) vì companion deal Minion không Spell.

- **Lab 1 — Necromantic Conduit** (qua small Mana): engine damage duy nhất ascendancy. Đổi "Lose 5% of maximum Mana per Second" → cần mana regen giữ không Low Mana; rớt Low Mana → Unholy Might tắt, companion mất 30% extra Chaos.
- **Lab 2 — Blackened Heart:** 4% increased Magnitude of Unholy Might per 100 max Mana → tree path qua max-mana thay pure ES; gear stack mana flat = stat damage.
- **Lab 3 — Rupture the Soul** (qua small Curse Area): cursed enemy bị companion giết 33% nổ ¼ max Life thành Chaos, kích bằng Despair reserve sẵn.
- **Lab 4 — Incessant Cacophony** (qua small Curse Area): thêm curse slot + infinite duration → curse thứ hai (Elemental Weakness/Conductivity/Flammability tùy element) không tốn Spirit.

## Passive Tree & Mastery

- 4 nhóm: minion damage + life, **max-mana** (mana = stat damage qua Blackened Heart), reservation efficiency (Spirit fit Soul Crystal), ES pool. Path qua witch start ưu tiên small mana + minion small, vòng qua keystone Whispers of Doom trước khi mana stack.
- **Mana stack** là điểm khác spectre Lich: spectre scale qua minion damage + chaos-res shred; companion solo carry cần thêm magnitude Blackened Heart vì base damage không scale gem level. Đừng nhầm **Eldritch Battery** (convert mana → ES recharge → kill engine Necromantic Conduit, cần mana raw để không Low Mana).
- Reservation efficiency từ tree (cluster **Self Sacrificing** 40% efficiency minion skill, đổi −20% efficiency skill không-minion) đi cặp Atziri's Communion routing curse sang Life (downside trơ vì curse reserve Life không Spirit) → hồi Spirit cho Soul Crystal, fit thêm Hulking Minions hoặc utility minion thứ hai (Skeleton Warrior soak).

## Stat Priorities & Defenses

- **Không verify offline:** PoB2 (community fork v0.17) không model damage Companion từ Tame Beast/His Grave Command → output **0** cho slot Soul Crystal (giống slot Tame Beast của Spirit Walker).
- **Chain:** `base_hit_companion × (1 + Σ increased_minion) × ∏(1 + more_i) × hit_rate`. `∏more_i` = Feeding Frenzy II (1.30) × Hulking Minions (~30% more khi lắp) × quality His Grave Command 0.5.3 (1.20 more Minion **Life**, không damage → KHÔNG vào chain damage). Lớp Unholy Might (30% gained as extra Chaos × magnitude Blackened Heart × shred Chaos res Despair) là **layer song song**, không cộng vào more — gained-as-extra chỉ scale theo modifier + resistance của damage type mới (Chaos), không theo damage type gốc.
- **Cách biết build chạy:** log clear time / TTK client. Map T15+ Abyss-juiced, time TTK boss trước/sau mỗi layer (Unholy Might base → Kurgal's Leash command → Blackened Heart mana stack → Despair curse). Mỗi layer = deltaTTK đo được.
- **Defense layer order 0.5.3:** max res cap (đặc biệt **Chaos res** — Lich không CI → chaos hit ăn 2× lên ES) → ES pool → Life → :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} → recovery. Bỏ armour/evasion/block. Companion soak aggro frontline.

### Performance Ratings

| Aspect          | Rating (1-5) |
|-----------------|--------------|
| clear_speed     | 3            |
| boss_damage     | 3            |
| survivability   | 3            |
| mobility        | 2            |
| league_start    | 1            |
| budget_scaling  | 4            |

Rating dựa framework; số DPS/EHP chưa verify → là expectation theo cơ chế. Re-rate sau in-client data.

## Gear Progression

Priority: cap Chaos res (Lich không CI) → Life floor → Int requirement gem → max mana stack (Blackened Heart) → Spirit (Soul Crystal cost) → ES pool → jewel Crystalline Phylactery.

- **Weapon (2H Staff):** The Unborn Lich, prefix Custom Desecrated "Grants Skill: His Grave Command". 4 mod desecrated khác theo priority; "You have Unholy Might / increased Magnitude of Unholy Might buffs you grant" = dòng tốt thứ hai (stack với Necromantic Conduit). Lich prefix: Amanamu's flat Spirit (+35-50) / Ulaman's Magnitude Damaging Ailments. Lich suffix: Archon duration / cast speed low life / block chance.
- **Off-hand:** không (staff 2H).
- **Helmet:** ES base + max mana, +Int, life, Chaos res; +1 minion level enchant → companion gem level.
- **Body:** :wiki-link{url="https://www.poe2wiki.net/wiki/Vis_Mortis"} (+1 spectre/companion + Unholy Might khi minion die — không stack với Necromantic Conduit nên giá trị thật là +1 companion slot). Không dùng → ES rare +max mana + Life + res.
- **Gloves:** ES + max mana, Int, res; mod desecrated "Allies in Presence deal X% increased damage".
- **Boots:** ES + 30% movement speed baseline; Life + res + Int.
- **Belt:** Life + res + flask charge. :wiki-link{url="https://www.poe2wiki.net/wiki/Darkness_Enthroned"} (Abyss) 50-100% increased effect of Socketed Items + 2 augment socket — min-max khi có 2 abyssal jewel mạnh.
- **Amulet:** +mana flat + Int + Life + res. Anoint notable minion damage ngoài tree (Sovereignty / Whispers of Doom nếu chưa keystone). :wiki-link{url="https://www.poe2wiki.net/wiki/Necromantic_Talisman"} late-game khi amulet +minion-level thuần.
- **Ring x2:** +flat mana + Int + Life + res + Spirit (Ventor's Gamble nếu stack Spirit); một Stellar Amethyst cho Chaos res floor.
- **Jewel:** Crystalline Phylactery (Lich keystone) 100% increased Effect, chứa abyssal jewel mod minion damage / minion life / +Spirit. Timeless Jewel late-game roll seed reservation efficiency theo tribute.
- **Charm:** Freeze removal + Ailment immunity + Movement speed boost on hit.
- **Leveling → Mirror:** không leveling trước Lv 78 (staff requires Level 78) → chạy build khác rồi respec. Level Lich bằng [spectre summoner](/builds/witch/0-5-spectre-summoner-lich) hoặc [bone construct](/builds/witch/0-5-bone-construct-mass-summoner-lich) đến Lv 78 → farm waystone tier 10+ cho Abyss unlock → drop/craft Kulemak's Invitation → hunt Vessel of Kulemak đến khi ra Unborn Lich prefix Grave Command → respec ascendancy + tree về magnitude path. Endgame farm Abyssal Depths juiced (currency + hunt rare Undead replace Soul Crystal). Mirror tier: min-max mana stack jewellery cluster + Timeless Jewel reservation efficiency seed + Darkness Enthroned 2 abyssal jewel BiS.

## Failure Modes

- **Gating chain (lớn nhất).** Unborn Lich drop-restricted từ Vessel of Kulemak, phải có Kulemak's Invitation mỗi fight. Drop staff rồi 1/5 xác suất đúng prefix Grave Command, miss → Essence of the Abyss reroll (tốn Abyss bone). Có Grave Command rồi hunt rare Undead + đọc 4 mod + giết trong cửa sổ Hinder; sai → cast lại. 3 lớp gating độc lập. Ước tính: ~hai chục lần Vessel cho vài cây Unborn Lich, mỗi cây 20% prefix đúng → **vài tuần endgame**, không vài giờ.
- **Soul Crystal vẫn reserve Spirit.** 0.5.3 bỏ Spirit cast-skill nhưng giữ reservation companion output → boss-tier chiếm 40-60% pool Spirit, chỉ còn aura nhỏ + 1 utility minion phụ. Không stack 3-4 companion như Spirit Walker; single-carry default. Hulking "cost significantly more Spirit" → cân nhắc, không free pick.
- **PoB-blind.** PoB2 fork không model damage Companion → output 0 cho Soul Crystal, không truth source verify. Mọi số DPS/EHP/clear là expectation, không PoB-verified. Test plan: log TTK boss + clear time map qua từng patch upgrade (kill timer + map stopwatch). Fork chưa có roadmap support Companion DPS.
- **Infernal Legion (đừng lean vào).** Từng engine kéo build tương tự pre-0.5.0; 0.5.0 halve IL I/II self-burn 20%→10% + remove IL III. Build này dùng IL chỉ như chip damage utility nếu dư socket. Hướng Dinomancer Lich pre-0.5 (IL III walking-simulator burn) đã dead theo patch.

## Verdict

- 3 điểm sáng: (1) lớp Unholy Might-projection lên companion độc nhất Witch — không ascendancy nào khác cho minion 30% extra Chaos vĩnh viễn; (2) 0.5.3 thật sự mở khoá (trước patch Soul Crystal boss-tier ăn 40-60% Spirit, hết chỗ aura/curse; sau patch cast-skill free + quality scale Minion Life); (3) scale tốt theo investment dài hạn — mỗi upgrade Soul Crystal = deltaTTK đo được, không diminishing return nhanh như spectre.
- Hợp người đã có Witch Lich Lv 90+ + pool Abyss đủ farm Vessel of Kulemak đều, tìm flavor khác sau spectre/bone construct. KHÔNG league-start: gating nhiều tuần, PoB không verify, Spirit budget vẫn căng dù 0.5.3 nới.
- Ngân sách mid-range chưa có Unborn Lich → [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) tốt hơn (cùng Lich identity Unholy Might + curse, damage source verified). Quay lại khi materialize staff prefix Grave Command.

## Changelog

### 2026-06-19
- Initial draft sau patch 0.5.3 (His Grave Command bỏ Spirit cost cast-skill).
- Math chain marked theory-craft; mọi số DPS/EHP log in-client sau khi materialize staff.

## Relationships

- **related** [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) — sibling Lich cùng identity Unholy Might + curse, có data ladder verified.
- **related_mechanics** [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation) — cơ chế Soul Crystal vẫn reserve Spirit dù cast-skill free.
- **related_guides** [Unique items mới 0.5](/guides/0-5-new-unique-items) — The Unborn Lich + ecosystem Abyss support gem.
- **competes_with** [Bone Construct Mass Summoner Lich](/builds/witch/0-5-bone-construct-mass-summoner-lich) — Lich path khác dùng minion thuần thay companion.
- **alternative_to** [Spirit Walker Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack) — Huntress là class đúng nếu muốn big-beast companion fantasy.
