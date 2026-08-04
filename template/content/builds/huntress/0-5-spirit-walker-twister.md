---
template: templates/build-template.md
document_type: build
title: Twister Spirit Walker
status: draft
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
class: Huntress
ascendancy: Spirit Walker
league: '0.5'
patch: 0.5.3
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
  - spirit-walker
  - twister
  - whirling-slash
  - projectile
  - trinity
  - the-taming
  - crit
  - freeze
  - 0-5
  - poe2
---

# Twister Spirit Walker

Self-cast Twister — Huntress dựng Whirlwind 3 stage bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Whirling_Slash"} rồi quăng :wiki-link{url="https://www.poe2wiki.net/wiki/Twister"} đi qua để consume, mỗi twister ăn thêm 80% more damage per stage + gain element từ ground effect. Leveling cực mượt từ Act 1 nhờ engine consume; endgame thành crit-freeze projectile carry quanh trục :wiki-link{url="https://www.poe2wiki.net/wiki/The_Taming"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Trinity"}. KHÔNG phải build companion — companion chỉ utility (Wild Protector bear, Spirit Vessel buff bot, Primal Bounty owl feather), damage đến từ chính mình.

## Build Overview

- **Damage = chain consume:** Whirling Slash set 1 dựng Whirlwind tối đa 3 stage; Twister set 2 đi xuyên, mỗi stage consume thêm 1 twister phụ + 80% more damage. Cú swap đầy đủ = Twister ăn ≈**11.87× base damage** trước mọi multiplier → không cần stack projectile để cày boss, chỉ stack scaling element + crit + uptime.
- **Trục scaling = triple-elemental đồng thời:** :wiki-link{url="https://www.poe2wiki.net/wiki/Ice-Tipped_Arrows"} convert toàn bộ physical → cold (Empowers 4 Attacks, cooldown 12s, bypass bằng frenzy charge); :wiki-link{url="https://www.poe2wiki.net/wiki/Sacred_Flame"} hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Guiding_Palm_of_the_Heart"} chèn 25-60% damage as extra fire; The Ordained hoặc spear crit endgame cấp flat lightning. 3 dòng element nuôi Trinity (max **57% more** ở lvl 20 balance tốt) + apply đủ 3 ailment để The Taming bung trần ("Wind Skills count as boosted by Ignited/Shocked/Chilled Ground" + 10-20% increased damage mỗi ailment, max 30-60% cùng lúc).
- **Defense = evasion + energy shield hybrid** với freeze-lock layer kép. Endgame chuyển :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"} qua jewel :wiki-link{url="https://www.poe2wiki.net/wiki/From_Nothing"}: miễn nhiễm chaos + unlock Heavy Frost (frozen enemies bỏ qua resistance hoàn toàn nếu resistance đó positive) → freeze = tăng damage. :wiki-link{url="https://www.poe2wiki.net/wiki/Ghost_Dance"} biến evasion thành ES regen, :wiki-link{url="https://www.poe2wiki.net/wiki/Wind_Dancer"} cộng evasion stack, Forgotten Warden body endgame trả deflection rating theo missing ES.
- **Mobility:** Whirling Slash di chuyển vừa apply Whirlwind vừa charge through pack; dodge roll trigger Primal Bounty empower + frenzy charge từ :wiki-link{url="https://www.poe2wiki.net/wiki/Sniper's_Mark"} mở cap +3 max frenzy.

## Skill Gems & Links

Tay set 1 soaring spear attack-speed (target ≥2.36 APS), set 2 spear damage + sceptre. **Ice-Tipped Arrows phải ở set 2 cùng Twister** — đặt sai set là skill bug không apply convert. Whirling Slash bind set 1, Twister bind set 2, swap thật trong combat.

- **Whirling Slash (5L, set 1):** :wiki-link{url="https://www.poe2wiki.net/wiki/Rapid_Attack"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Rage"} III + :wiki-link{url="https://www.poe2wiki.net/wiki/Magnified_Area"} II + Blazing Critical. Rapid Attack đẩy APS dựng 3 stage; Rage III sinh rage; Magnified Area II tăng vùng quét; Blazing Critical 15% damage as extra fire 5s sau crit (đẩy fire cho Trinity + prime ignite). Whirlwind max 3 stage, mỗi stage +150% more collapse damage + +0.3m radius.
- **Twister (5L, set 2):** :wiki-link{url="https://www.poe2wiki.net/wiki/Projectile_Acceleration"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Armament"} II + Prolonged Duration + Concentrated Aura + Blind Side. Projectile Acceleration biến projectile speed thành damage; Elemental Armament II tăng ele flat; Prolonged Duration kéo twister 3s dài hơn; Concentrated Aura 10% more thay :wiki-link{url="https://www.poe2wiki.net/wiki/Deliberation"} (AoE loss negligible vì twister move erratic). **Blind Side thay Pinpoint Critical** (bản endgame): Pinpoint cộng crit chance nhưng trade crit damage; Blind Side cộng cả crit chance + crit damage khi không thể blind. Twister tự blind enemies nên phải đẩy blind sang chỗ khác (Spirit Vessel barrage có Blind II) để Blind Side trigger.
- **Ice-Tipped Arrows (4L, set 2):** Elemental Armament II + Cooldown Recovery II + Cold Attunement + Short Fuse. Cooldown Recovery II + Frenzy charge bypass = effectively always-on cho clear; Cold Attunement +25% damage gained as cold; Short Fuse rút detonation. 2 vai: convert toàn bộ phys → cold (lý do dùng dù không phải bow) + spawn Ice Fragments multi-hit clear.
- **Barrage (3L, set 2):** :wiki-link{url="https://www.poe2wiki.net/wiki/Rapid_Casting"} II + Cooldown Recovery II + Utrid's Constellation. Utrid's Constellation +2 skill use → cast 3 lần thay 1, nhân 3 burst boss. Barrage empower projectile attack tiếp theo thành repeat +2 (+1 per frenzy consumed), repeats deal 50% less damage → 1 Twister sau Barrage = 3-6 twister đồng thời, đều consume + multiply.
- **Primal Bounty empower (ascendancy-granted):** Olroth's Conviction — support khoá chính Spirit Walker 0.5, empower thêm 2 skill use, biến 1 feather đáng 1 attack empowered thành 3 attack empowered. Đặt trên Barrage cũng chạy nhưng Spirit Walker không gen frenzy ổn định như Deadeye → giữ feather lâu lợi hơn. Mirror chưa có wording chính xác → đeo đọc tooltip client verify cost; gem có "100% of life/mana cost as extra Runic Ward cost" nên cần Runic Ward layer trước khi cắm.
- **Trinity (100 spirit, persistent buff):** chỉ chèn +1 level support (Fire Mastery/Cold Mastery). Trinity 1-6% more elemental damage per 30 Resonance của bất kỳ type, cap 100/element + 300 total — không bao giờ giữ đủ 100/100/100 nên max thực tế lvl 20 ~57% more. Hit element nào gain 5-13 Resonance type đó, mất 3 Resonance 2 type còn lại; idle 8s không hit type đó = decay 10 Resonance/s.
- **Marks:** :wiki-link{url="https://www.poe2wiki.net/wiki/Freezing_Mark"} + Prolonged Duration (Hits against Marked 25-35% more Freeze buildup + khi target frozen grant buff 30% damage as extra cold 10s); :wiki-link{url="https://www.poe2wiki.net/wiki/Charged_Mark"} trên Freezing Mark/Sniper's Mark → mỗi activate spawn Shocked Ground (Twister "Elemental twisters Gain 50% of damage as damage of the corresponding Type" → thêm lightning gain).
- **Sniper's Mark + Eternal Mark (endgame):** bù frenzy không tự động. Sniper's Mark next crit hit lên Marked 20-77% increased crit damage bonus + grant 1 frenzy charge khi activate; Eternal Mark khiến mark không bị consume lần activate đầu → mỗi cast effective 2 frenzy. Cộng nhánh tree Charge for Fusion lên 80% chance gain extra frenzy → ~4 frenzy/cast + unlock +3 max frenzy charge thay +1. Cần **unset ring** chứa thêm 1 slot skill → lý do chuyển sang rare unset thay gold ring late endgame.
- **Heralds:** :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Thunder"} (Elemental Focus + Elemental Armament + Magnified Area II + Lightning Attunement) + :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ice"} (Cold Attunement + Magnified Area II + Elemental Armament II + Name). Cộng flat ele + shatter pack; Herald of Thunder shock-on-hit nuôi Shocked Ground. Unlock 1 slot Herald of Thunder khi build sang unset ring early endgame.
- **Defense layer skill:** Ghost Dance (quality 20 cho +20% increased Spirit Reservation Efficiency — cách mở chỗ chứa Trinity + 2 herald + Wind Dancer + companion stack) + Wind Dancer (Name + Pin II).
- `Exclusion check`: Trinity scale **elemental** không scale physical → BẮT BUỘC Ice-Tipped Arrows convert; phys không convert out khỏi Trinity mất ~30-40% damage. The Taming "count as" chỉ apply Wind Skills qualifier matching ground (Twister có, Whirling Slash không). Sacred Flame mod presence "Enemies in your Presence Resist Elemental Damage based on their Lowest Resistance" lợi clear nhưng anti-synergy Rakiyata's Flow late (verify client khi đeo cả hai). Heavy Frost chỉ ignore resistance "if their resistance values were positive" — boss res âm tự nhiên (rare) không trigger; 99% map mob dương.

## Trinity: cân ba nguyên tố

- Trinity scale theo **total Resonance** không phải Resonance một type; Resonance gain chỉ vào type damage cao nhất của hit. Dump 80% damage cold → Resonance cold đầy 100, fire/lightning teo 0 → tổng ~100, more multiplier ~17% thay 57%.
- **Cold:** Ice-Tipped Arrows convert (100% phys→cold trong empowered attack) + Cold Attunement + Herald of Ice — luôn dư.
- **Fire:** sceptre. Sacred Flame 40-60% damage as extra fire (+ grant Purity of Fire có **exploit reservation** — supports cắm vào Purity of Fire socket KHÔNG tốn spirit, vd Vitality II + Precision II + Cannibalism II + Herbalism II free 120 spirit, mirror chưa confirm bug hay intended, ở trong game từ 0.1). Hoặc Guiding Palm of the Heart 25% damage as extra fire — ít hơn nhưng balance dễ hơn. Tradeoff: Sacred Flame mạnh hơn nhưng dễ phá Trinity balance; Palm of the Heart yếu hơn nhưng giữ 3 dòng Resonance gần nhau. Build mới thường Palm of the Heart (craft chưa bù flat lightning); full T1 flat lightning spear + ring + glove thì Sacred Flame thắng. Sacred Flame drop từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_Arbiter_of_Ash"}, không dễ kiếm.
- **Lightning:** flat lightning trên spear (The Ordained 1-209 lightning grant sẵn), ring + glove (T1 "of Crashing Storms" prefix), Herald of Thunder. Phải craft chủ động.
- Heart of the Well jewel desecrated bù element thiếu — chọn mod "gain damage as fire" / "gain damage as lightning" tuỳ lệch. Jewel duy nhất tinh chỉnh Trinity sau khi gear chốt.
- **QoL:** Trinity gem chèn Fire/Cold Mastery cho +1 level đẩy more cap. Quality 20% Trinity cộng 15% increased Skill Speed khi tổng Resonance >250 — breakpoint thực: stack đầy thì attack/cast speed cộng theo.

## Ascendancy

:wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} thứ tự **Wild Protector → Primal Bounty → The Mhacha's Gift → Vivid Stampede → Sacred Unity (free)**.

- **Wild Protector (Lab 1):** grant Bear Spirit không tốn companion slot, life leech slam + intimidate roar. Layer tank + Intimidate buff damage taken trên enemy (offensive miễn phí).
- **Primal Bounty (Lab 2):** engine empower — định kỳ grant Primal Owl Feather, dodge roll consume feather để empower projectile attack tiếp theo với additional projectiles + projectile speed. Dodge roll = damage button.
- **The Mhacha's Gift (Lab 3):** cộng vào Primal Bounty pool, scale thêm feather + projectile bonus.
- **Vivid Stampede (Lab 4):** từng nghĩ priority đầu vì cho shocked ground deterministic ở max distance; thực tế spawn chậm + đắt cooldown, lightning exposure không stack lên 3 element, có ring The Taming thì ground effect tự apply → node nhạt. Lý do duy nhất giữ = unlock Sacred Unity Lab 5.
- **Sacred Unity (free, đủ 3 spirit node):** nâng cả 3. Soaring Ground (từ Primal Bounty central projectile) cho 30% increased Evasion Rating + 40% increased damage while at Full Life + Onslaught đến user + allies, lingering 6s + 1s linger. Embrace of the Wild trên Bear cộng 2% max life regenerate per second cho allies + 8% damage taken redirect vào Bear. Soaring Ground = damage layer thật (40% more ở Full Life + Onslaught 20% inc attack/cast/movement speed).

## Passive Tree & Mastery

- Crit-heavy + projectile + freeze + weapon-set conditional. Cluster chính nhánh huntress trung tâm: precision salvo (set 2 conditional crit damage), javelin (inc damage + crit chance), struck through + hearts stopping + heartbreaking (crit base), moment of truth, true strike + jugular + deadly force (full crit), killer instinct (inc attack damage khi at Full Life — luôn full nhờ ES pool), 10fold attacks (attack speed set 1).
- **Freeze/cold:** Hail (freeze buildup — source chính sau khi đeo The Taming vì Call of the Brotherhood không dùng), Crushing Wave (inc damage on crit hit), Deep Freeze (qua From Nothing — freeze buildup + frozen enemies -8 cold res). Harness the Elements big multiplier (inc damage per element type — 3 element = 60% inc).
- **Defense:** Subdivision Mask (eva per ES on helmet), Mindful Awareness (eva + ES), Trained Deflection (qua From Nothing, push deflection 46% cap), Wildcat (deflection rating khi gloves không có deflection suffix vì đeo unique freeze-glove), + sau 0.5.3 **Staunch Deflection** (Deflection Rating = 8% Evasion Rating). Eva target 12-15k → +960 đến +1,200 deflection rating. Staunch Deflection cùng cluster Ranger-adjacent với Trained Deflection + Wild Cat nên path bao trọn 3 cái.
- **Weapon-set conditional:** set 1 = attack speed (Stimulants, Acceleration, Agile Succession, 10fold Attacks — nuôi Whirling Slash APS), set 2 = crit/damage (Concussive Attacks, Killer Instinct, Critical Exploit, Embodiment of Power — nuôi Twister). 2 pool tách biệt, không hoán chuyển.
- Concentrated Aura > Deliberation: 10% more damage thay 20% more + 30% less movement speed penalty.
- Anoint amulet endgame **Stormbreaker** (20% inc damage per elemental type — 60% với 3 element) hoặc **Critical Exploit** khi chưa có Lavianga's Spirits + Stormbreaker. Đeo Raven Touched Shard thì anoint helm thêm (cost 1 augment socket). Bỏ Beacon of Azathoth khi có Heavy Frost qua From Nothing.
- **Heavy Frost** vào tree qua From Nothing Diamond jewel allocate quanh keystone Chaos Inoculation (passive trong radius allocate không cần connect). Cụm CI mở Heavy Frost + Thin Ice (50% increased damage against frozen) + Shakra of Elements (8% phys as extra cold + lightning vs shocked + chilled — nguồn lightning nữa cho Trinity từ phys spear).
- **Controlled Metamorphosis** (medium ring jewel) allocate quanh Kitrunner (projectile damage + speed) + Distracted Targets (crit vs blinded — lý do nữa cho Blind Side) + Dizzying Sweep (area damage + AoE) + Chakra of Thought (attack speed khi low mana, Lavianga's ép low mana). Cộng -20 to -5 all elemental resistances — cost bù bằng ring/belt/helm rare.

## Stats & Defenses

EHP layer order: evasion (entry) → block từ tree khi có → max res cap → ES pool → Runic Ward khi có rune → recovery (Ghost Dance + life on hit). Build CI endgame skip life pool — pool 1 life, chaos immune, sống bằng ES + evasion + Runic Ward.

Target sau CI (từ creator playtest, PoB2 chưa model đầy đủ Spirit Walker companion AI → `pob_coverage: PARTIAL`; verify client từng patch):
- **ES:** 6,500-8,000 (Forgotten Warden body + helm full ES + boots/gloves ES roll + Subdivision Mask)
- **Evasion:** 12,000-15,000 (hybrid eva/ES base + Wind Dancer + Ghost Dance)
- **Deflection:** 46%+ (Trained Deflection + Wildcat + Staunch Deflection sau 0.5.3 khi gloves không có deflection suffix); +960 đến +1,200 Deflection Rating từ Staunch Deflection tuỳ eva floor 12-15k
- **Resistances:** 75/75/75 cap (overcap +20% với Controlled Metamorphosis penalty); chaos 0 (CI miễn nhiễm)
- **Cast Resistance:** ~40% (qua belt)
- **Attack Speed (set 1):** ≥2.36 APS (target 2.5+ với corrupt second socket + Celestial Alloy attack speed prefix)
- **Boss DPS playtest target:** ~12M+ (đo client với full late endgame craft + Headhunter + Voices — chưa PoB verified vì PoB2 model Trinity + companion buff không đầy đủ; treat như target floor, log số thật khi đeo full kit)

Math chain Twister boss DPS:

```
base_hit (set 2 spear)
  × engine_consume (11.87× max khi đủ 3 Whirlwind stage)
  × Trinity (max 1.57× khi đủ ba Resonance balance)
  × The_Taming (1.3× → 1.6× tuỳ tier ring, ba ailment apply)
  × crit_multiplier (~3.5× với Blind Side + Moment of Truth cluster + crit base spear 13%)
  × Sacred_Unity_full_life (1.4× khi Soaring Ground active)
  × Harness_Elements (1.6×, 3 element type)
  / hit_throttle (0.66s same-target cap với projectile cùng frame)
  = boss DPS floor
```

- Base hit từ spear: The Ordained cho 56-84 phys + 1-209 lightning + 243% increased physical + 6.47% crit; spear endgame rare crit đẩy hit base gấp đôi The Ordained. Throttle 0.66s = **gate cứng** — projectile count chỉ scale clear, không scale boss (boss chỉ ăn hit từ 1 twister cùng frame). Lý do endgame stack crit damage + more multiplier thay stack additional projectile.

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 5 |
| boss_damage | 4 |
| survivability | 4 |
| mobility | 4 |
| league_start | 5 |
| budget_scaling | 4 |

## Gear

Priority order: res cap 75/75/75 → attribute floor (Int cho support gem high tier, Dex cho spear req) → +Level projectile (amulet, helm anoint) → spear damage stat → spirit reservation efficiency → ES/eva hybrid → deflection rating.

- **Weapon set 1 spear:** soaring spear base (highest attack speed base), suffix attack speed T1 + life on hit, prefix attack damage + spirit reservation efficiency. Endgame craft Celestial Alloy thêm prefix attack speed (override 1 damage prefix, +0.2-0.3 APS). Sky Sliver budget. Mục tiêu ≥2.36, mirror ≥2.5 với corrupt 8% attack speed thứ hai.
- **Weapon set 2 spear:** flat element + crit. **The Ordained** (Grand Spear Lv79, 243% inc phys + 1-209 lightning + 6.47% crit, grant Skill + Trinity-related Fragment of Divinity creation) = transition spear tốt nhất (lightning flat lớn cho Trinity + spear crit base 5% + 6.47% explicit). Endgame craft Tangle Tongue bifurcated crit hoặc rare soaring spear T1 ele + T1 crit; The Ordained ngang rare T1 nếu chưa crit, win khi không crit.
- **Off-hand (set 2 only) sceptre:** Sacred Flame hoặc Guiding Palm of the Heart. Cần **double socket** chứa Rabbit Idol (+15% spirit) — cách chèn Trinity 100 + Herald of Thunder + Herald of Ice + Wind Dancer + Ghost Dance + persistent buff không nổ spirit cap. Mở Purity of Fire reservation-exploit nếu đeo Sacred Flame.
- **Helmet:** full ES + res. Endgame anoint qua Raven Touched Shard (Delirium augment, cost 1 augment socket); anoint Subdivision Mask/Critical Exploit/Heavy Frost trước khi có From Nothing CI.
- **Body:** **Forgotten Warden (Primal Markings)** endgame — mirror chưa có doc 0.5; client đeo đọc: cộng ES lớn + deflection rating per missing ES (creator đo +100 deflection rating per 50 missing ES nâng deflection từ 40% lên 70% khi ES vơi), 15% deflected damage redirect vào companion, grant Spirit Vessel skill. Nguồn deflection chính endgame + lý do Spirit Vessel free trong skill bar. Trước đó rare ES/eva hybrid + life + res.
- **Gloves:** unique freeze-at-50%-buildup + 50% increased damage vs immobilized/frozen + increased Skill Speed (mirror chưa có wording chính xác, verify client). Đôi với Heavy Frost: freeze sớm hơn = ignore res sớm hơn = damage tăng kép. Chưa có thì rare eva/ES + flat lightning T1 + res + Dex.
- **Boots:** eva/ES hybrid + deflection rating suffix + movement speed 30% + res. Streamline rare craft (cùng base cùng mod theo Aer0, đổi tier khi tier-up). Endgame thêm rarity prefix nếu corrupt double socket.
- **Belt:** rare cast resistance + res cap + life (trước CI). Endgame **Darkness Enthroned** (Fine Belt Lv62, 50-100% inc augment effect, 2 hidden augment sockets) đeo augment frenzy charge rune + speed/ailment. Cuối cùng **Headhunter** (Heavy Belt Lv50, kill rare gain modifier 60s) — bản POE2 random buff trùm map farm + slap boss khi kill rare adds.
- **Amulet:** ES/eva + projectile levels + res. Anoint Stormbreaker (60% inc damage với 3 element) hoặc Critical Exploit. Bỏ Beacon of Azathoth khi có Heavy Frost.
- **Rings:** **The Taming** + 1 rare unset (chứa Sniper's Mark hoặc Herald of Thunder/Ice). Rare unset roll flat ele damage + res + attribute + skill slot — ring craft cuối cho Trinity flat balance. Trước Sniper's Mark + Eternal Mark thì chạy 2 rare ring.
- **Jewels:** From Nothing (Diamond, allocate quanh Chaos Inoculation hoặc Trusted Kinship khi chưa CI) + Heart of the Well (Diamond desecrated, custom mod gain damage as element) + Controlled Metamorphosis (Diamond, ring radius cho Kitrunner cluster) + Time-Lost Emerald (crit damage + crit chance attack craft) + Voices (Sapphire corrupted, allocates 2-4 Sinister Jewel sockets — mirror tier, chiếm jewel slot, mở 4 cluster jewel mini). Build dùng jewel làm tree thật.

### Leveling → Late endgame

- **Leveling (Act 1-6 Cruel):** spear armor + life base, Whirling Slash + Twister ngay sau engrave. Stack inc damage + cold + crit nodes. Defense armour + life flask thường. Chạy gần standalone trong campaign.
- **Early Atlas (T1-T6):** chuyển eva/ES hybrid (tree allocate ES node thì bases phải có ES roll). Anoint amulet Critical Exploit (cheap). Quest reward Act 4 Halls of the Dead nhận **Tribal Medicine** (30% inc armour/eva/ES) — EHP tốt hơn deflection-armour-from-ele-res. Spear set 1 attack speed soaring, set 2 rare lightning + crit (cheap thay The Ordained).
- **Mid endgame (T7-T13):** The Taming ngay khi mua được — first build-defining upgrade, ring giảm giá đáng kể tuần đầu league. Sau đó The Ordained spear nếu chưa craft Tangle Tongue, Guiding Palm of the Heart sceptre, Darkness Enthroned belt với rune frenzy. Lavianga's Spirits flask. Olroth's Conviction support trên Primal Bounty.
- **Late endgame (T14-T16, pinnacle):** Forgotten Warden body, gloves unique freeze-50%, Sacred Flame sceptre (nếu balance Trinity OK), Sniper's Mark + Eternal Mark combo trên unset ring, From Nothing Chaos Inoculation jewel (chuyển CI), Raven Touched Shard anoint helm.
- **Mirror tier:** Voices jewel (2-4 cluster), Tangle Tongue T1 bifurcated crit spear, Headhunter belt thay Darkness Enthroned, Rakiyata's Flow (verify anti-synergy Sacred Flame client), Rite of Passage cluster.

## Flasks

- Trục = **Lavianga's Spirits** (Gargantuan Mana Flask, "Cannot be used" — apply effect constantly): always-on mana sustain, không tốn slot belt charm, mở toàn bộ passive cluster "during flask effect". Trước Lavianga's thì mana flask thường + life flask thường, sau đó life flask đỏ + utility (granite/quartz tuỳ map). Charm slot belt cho freeze immunity, stun immunity + 1 slot ailment tuỳ map mod.

## Leveling

- Twister Tier 1 → engrave Uncut Skill Gem ngay quest skill đầu Act 1; Whirling Slash cũng Tier 1. Rotation campaign Whirling Slash ×3 quanh pack, swap quăng Twister đi qua, mob shatter. Frost Nexus support khi unlock cho chilled ground. Salvo support bind sớm để Twister bắn thêm projectile từ 3 seal accumulate — Salvo 0.5 rework spawn seal mỗi 2s thay vì hold charge, uptime cao trong combat dài. Act 1-2 không cần weapon swap.
- Pivot setup full khi vào Cruel: allocate weapon-set conditional points, buy spear set 2 riêng (crit base ≥7% nếu được), bind Whirling Slash set 1 + Twister/Ice-Tipped Arrows set 2. Ascend Lab 1 Wild Protector ngay khi mở. Ice-Tipped Arrows engrave khi phys damage chiếm phần lớn — thường Act 3.
- Salvo rework khác POE1: 0.5 Accumulate seal mỗi 2s, max 3 seal, consume tất cả khi cast. Giữ Salvo trên Twister đến early Atlas; vào Bodok/anti-twister boss thì swap Salvo ra (mới aim được).

## Budget

Chạy league-start không gear cố định (Twister + Whirling Slash tier 1, engine consume tự nhân). Floor như paper math:
- **Min chạy endgame:** The Taming (vài exalt-low div tuần 2), Lavianga's Spirits (vài exalt), The Ordained spear hoặc rare T1 lightning spear (vài exalt craft tự), Guiding Palm of the Heart sceptre (cheap). ~1-3 div đầu tuần.
- **Divine breakpoint:** Forgotten Warden body, gloves unique freeze-50%, Darkness Enthroned belt rune đúng, From Nothing Diamond jewel. Nhảy power thực (chaos cap immune, freeze-lock, deflection scaling) — ~20-50 div tuần 3-4.
- **Mirror tier:** Voices jewel (multi-mirror), Tangle Tongue T1 craft (10+ div), Headhunter, Rakiyata's Flow, Rite of Passage cluster, soaring spear corrupted double socket ≥2.5 APS. Hàng trăm div+.
- Diminishing returns ở mirror tier vì throttle 0.66s same-target hit cap gate boss DPS — Voices nâng cluster damage nhưng boss DPS không scale tuyến tính. Trên 100 div power gain mỗi div giảm rõ; build power-pack của league, không mirror-chase.

## Failure Modes

Làm tốt: clear T15-T16 cực mượt (projectile multi-hit + Salvo seal + Soaring Ground onslaught) · leveling campaign mượt nhất huntress tuần một league · freeze-lock + Heavy Frost làm cả damage lẫn defense cùng layer. Chỗ gãy:

- **Bodok / ritual anti-twister boss.** 1 boss GGG design explicit anti-twister — Salvo random direction là thảm hoạ, phải gỡ Salvo + aim tay Twister thẳng vào boss. Over-geared làm được nhưng mất ~30-40% clear-speed feel, pain point xuyên league. Không có gear fix, chỉ skill cap.
- **Throttle 0.66s khoá boss DPS.** Twister projectile fired at the same time can Hit the same target no more than once every 0.66 seconds. Spam thêm projectile (Salvo seal, Primal Bounty empower, Barrage repeat) chỉ scale clear. Quote "12M+ damage" là playtest number combat dài stack toàn bộ buff (Sacred Unity full life, Trinity 250+ Resonance, Headhunter buff trùng), không phải DPS tốc độ.
- **Transition late Atlas → early endgame nguy hiểm nhất.** Defense vừa pivot armour → eva/ES nhưng chưa đủ Forgotten Warden, boss DPS vừa swap crit setup nhưng chưa craft Trinity đủ flat lightning. Tough thật — Bodok chật vật. Workaround: War Banner thay Herald sớm khi unset ring chưa có; giữ Critical Exploit anoint trước Stormbreaker; chấp nhận parry layer một thời gian.
- **Spirit Walker không auto-generate frenzy.** Không có node frenzy on hit/kill automatic; mọi frenzy từ hard-cast Sniper's Mark (kèm Eternal Mark + Charge for Fusion node). Trước setup này thì frenzy = 0 gần toàn map, Barrage giảm hiệu lực, Olroth's Conviction cũng yếu. Mid endgame là "press mark every 8s on boss" thay autopilot frenzy.
- **Trinity balance fragile.** Stack quá nhiều fire (Sacred Flame chưa có flat lightning T1 ring/glove) → Resonance fire đầy 100, cold/lightning decay → more multiplier teo ~17% thay 57%. Fix: Guiding Palm of the Heart thay Sacred Flame trước khi flat lightning đủ tier, hoặc Heart of the Well custom mod gain damage as lightning.
- **Olroth's Conviction drop source chưa confirm.** Mirror wiki không có doc item 0.5 mới; creator suspect drop từ pinnacle expedition (boss tier cuối Expedition chain), chưa có data farm rate. Build chạy được không có Olroth's, mất ~30% Primal Bounty uptime — không gate sống chết nhưng chase tier mid-endgame chưa biết farm đâu là risk.
- **Gear/currency floor cao cho full power.** The Taming + Voices + Headhunter + Rakiyata's Flow là multi-div/mirror tier. Paper "12M boss DPS" giả định toàn bộ kit chase. Dưới floor chạy ổn nhưng đừng kỳ vọng oneshot pinnacle; mid-budget clear T15 mượt là realistic.
- **Patch sensitivity Trinity + The Taming.** Trinity mới 0.3, đã rework 0.3.0 (elemental attack damage → all elemental damage) — nerf max more cap hoặc Resonance gain rate = mất 30-40% DPS. The Taming "Wind Skills count as boosted by all three grounds" — fix "count as" semantics = mất 30-60% increased damage + engine ailment-stacking. Verify client mỗi hotfix.
- **No-flask weapon swap bug.** Ice-Tipped Arrows BẮT BUỘC ở set 2 cùng Twister — để set 1 thì empower conversion sometimes không apply, gem bug silent. Verify skill panel mỗi lần respec/gem swap.

## Verdict

Build cho người thích projectile + crit + freeze-lock với APM trung bình cao (cast Whirling Slash → swap → cast Twister → cast Mark → dodge roll trigger Primal Bounty) — không phải minion auto. Leveling từ Act 1 cực mượt nhờ engine consume Whirlwind; endgame thành crit-freeze carry quanh trục The Taming + Trinity + Heavy Frost. Floor chạy league-start không gear cố định; ngưỡng để build đứng như paper là 20-50 div (Forgotten Warden + From Nothing + gloves unique + Darkness Enthroned). Dưới floor clear T13-T14 tốt nhưng boss thiếu freeze-lock; trên floor farm pinnacle thoải mái trừ Bodok anti-twister. Quote "12M+ DPS" là playtest number stack buff, không PoB verified — log số thật client khi đeo full kit.

## Changelog

### 2026-06-19
- Patch 0.5.3: Staunch Deflection thêm Deflection Rating bằng 8% Evasion Rating. Eva target 12-15k → +960 đến +1,200 deflection rating đi thẳng vào cluster Trained Deflection + Wild Cat đã có, pickup miễn phí ở 5 điểm cuối. Cập nhật target deflection floor 46% lên cao hơn tuỳ eva cuối, không quote số cứng vì PoB2 0.5 chưa model Spirit Walker đầy đủ.

### 2026-06-10
- Initial draft tổng hợp creator playtest data (Aer0 endgame tech, SiahZ 12M breakdown, SnooBAE85 progression variants) + verbatim wiki verify cho Twister/Whirling Slash/Trinity/Ice-Tipped Arrows/The Ordained/Sacred Flame/Guiding Palm of the Heart/Sniper's Mark/Eternal Mark/Heavy Frost/Sacred Unity/Vivid Stampede/Wild Protector/Primal Bounty/Headhunter/Voices/Darkness Enthroned/From Nothing/Controlled Metamorphosis. Forgotten Warden, Olroth's Conviction, Tangle Tongue, Stormbreaker, Critical Exploit, Raven Touched Shard, Rakiyata's Flow flag verify in-client (mirror 404 vì entity 0.5 mới hoặc anoint node).

## Relationships

- **related_mechanics** [Twister — Spear Wind Projectile Skill](/guides/twister) — engine consume Whirlwind, throttle 0.66s, Salvo rework, owl feather Primal Bounty empower.
- **related_mechanics** [The Taming — Tripled Wind Skill Ground Effect](/guides/the-taming) — ring định nghĩa build: count as boosted by Ignited/Shocked/Chilled cùng lúc, inc damage per ailment type.
- **related_mechanics** [Lavianga's Spirits — Always-on Mana Flask](/guides/laviangas-spirits) — Gargantuan Mana Flask Cannot Be Used apply constantly, mở passive cluster "during flask effect".
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — ascendancy node Wild Protector / Primal Bounty / Mhacha's Gift / Vivid Stampede / Sacred Unity verbatim.
- **alternative_to** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — cùng ascendancy Spirit Walker nhưng damage source ngược: bên kia companion-pack, bên này self-cast projectile.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Spirit Walker ascendancy mới, Trinity rework, ground effect interaction cho Wind Skills.
- **alternative_to** [Pathfinder Herald of Ice Bow](/builds/ranger/0-5-pathfinder-herald-of-ice-bow) — engine spear cận chiến thay bow, cùng tầm meta
- **alternative_to** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — cùng engine Twister consume nhưng ascendancy khác: bên kia self-cast Spirit Walker, bên này 2 nhánh meta Ritualist/Amazon.
