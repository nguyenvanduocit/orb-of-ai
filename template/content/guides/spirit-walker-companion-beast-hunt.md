---
template: templates/mechanic-template.md
document_type: mechanic
title: Spirit Walker Companion Beast Hunt
status: draft
author: nguyenvanduocit
created: '2026-05-20'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
tags:
  - poe2
  - huntress
  - spirit-walker
  - tame-beast
  - companion
  - minion
  - unique-beast
  - crafting
  - farming
  - 0-5
---

# Spirit Walker Companion Beast Hunt

Build :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} companion carry: damage nhân vật = damage một con beast tame bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} rồi bind làm companion. Pipeline 5 khâu: hiểu tame + retention modifier → chọn beast carry → săn ở đâu → nhồi modifier lên nó → chồng multiplier ngoài. Con carry tự seek + tự đánh → min-max là ráp pipeline + chồng multiplier, không xoay skill tay.

## Cơ chế tame

- Tame Beast đặt wisps lên rare Beast trong cửa sổ ngắn. Con chết khi còn wisps → gem thành `Companion: <Monster Name>` cùng level + quality (reviving companion). Target phải là **rare Beast** (không normal/magic/humanoid), phải chết khi wisps còn dán; hết duration trước khi chết → không capture.
- Giữ tối đa **4 regular monster modifier**; >4 → random 4. Modifier Essence/Azmerian wisp **không** giữ. Bài toán là săn đúng rare modifier trên đúng base.
- Constraint chính = **spirit reservation**. Reservation Summon Beast scale theo sức mạnh monster + số modifier → con 4-mod ăn spirit nhiều hơn con 1-mod cùng base. Hai hướng: build một con gánh → 4-mod càng nhiều càng tốt; build nguyên đàn qua :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan%27s_Effigy"} → "4-mod across the board" bóp nát spirit budget (filler ít mod cho rẻ, chỉ đầu đàn 4-mod). Chi tiết ledger: [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation).
- **Account-bound**: gem thành Summon Beast account-bound, không trade nhưng stash + chuyển char của chính mình. Không bán con đã tame, không mời buyer vào tame hộ — beast khoá chỉ người đã ở trong area lúc nó hiện lên màn hình. Chỉ bán được instance sạch nếu buyer vào trước khi con hiện.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} = cùng họ khác target: bắt gần mọi non-unique làm reviving minion; Tame Beast chỉ rare Beast → companion (mạnh hơn ở support-oriented modifier, Bind Spectre hợp minion có skill cụ thể).

## Reservation nền từng loại beast

Mức nền = % spirit pool bản companion chiếm (0-mod, trước efficiency stack + mod giữ lại). Damage%/Life% = hệ số stat so với monster chuẩn cùng level; reservation bám stat budget.

| Beast | Dmg% / Life% | Reservation |
|---|---|---|
| Hatchling | 10 / 0 | 9.3% |
| Feral Primate | 65 / 65 | 24% |
| Winged Fiend | 80 / 80 | 26.7% |
| Hungry Wolf | 100 / 100 | 30% |
| Diretusk Boar | 170 / 170 | 39% |
| Alpha Primate | 175 / 175 | 39.6% |
| Bramble Hulk | 200 / 200 | 42.3% |
| Antlion Charger | 200 / 200 | 42.3% |
| Quadrilla Sergeant | 462 / 250 | 42.3% |
| Zekoa / Silverfist | 463 / 250 | 47.4% |
| Morvak, the Infernal | 500 / 313 | 47.4% |
| The Black Crow | 375 / 250 | 47.4% |
| Azmerian Wolf | 243 / 270 | 49.2% |
| Elephant Tortoise | 245 / 350 | 56.1% |

- Unique boss beast phần lớn 47.4% bất kể Damage% → nhắm con Damage% cao nhất (Morvak 500, Zekoa/Silverfist 463 đầu bảng; The Black Crow 375 cùng giá spirit mà thua pool damage). Quadrilla Sergeant đáng dừng mắt: Damage% 462 ~ Zekoa nhưng nền 42.3% + là **rare** (không cần The Natural Order, không chiếm Unique slot, săn ở Jungle Ruins cùng pool rare Quadrilla). Winged Fiend 26.7% = base aura-bot chuẩn (săn bản giữ mod All Damage Shocks làm slot shred); Feral Primate + Hungry Wolf lấp campaign.
- Caveat: nền tính cho 0-mod, mỗi rare mod đẩy lên trên; số chỉ áp cho bản tame bằng gem — companion granted từ item (Azmerian Wolf qua Sylvan's Effigy, Spirit Vessel qua Forgotten Warden) reserve theo item grant, đọc tooltip in-client.

## The Natural Order mở hướng Unique carry

- :wiki-link{url="https://www.poe2wiki.net/wiki/The_Natural_Order"} = node ascendancy Spirit Walker, cửa duy nhất biến Tame Beast thành unique-beast carry. Cho Tame Beast bắt **Unique Beast**, chỉ một Unique Tamed Beast tại một thời điểm; con Unique +30% Movement Speed; bị possess bởi một **Azmeri Spirit ngẫu nhiên, đổi mỗi 20 giây**.
- Possess-đổi-20s là layer riêng, **không phải** 4 rare modifier rotate. 4 rare mod giữ lúc bắt khoá cứng; cái luân phiên là Azmeri Spirit buff do node áp. Hai layer coexist. Pool Azmeri Spirit ~chục bonus (phần lớn damage-type); danh sách đầy đủ + buff đáng cần đọc in-client.
- Chỉ giữ một Unique Tamed Beast → boss companion không thay hoàn toàn rare beast package.

## Con beast nào đáng carry

- Carry crit tiêu biểu = hai con ape, hai tier theo base crit. :wiki-link{url="https://www.poe2wiki.net/wiki/Alpha_Primate"} (monkey) base crit cao (~25%): một mod Extra Crits là cap (25% × 4 = 100%). :wiki-link{url="https://www.poe2wiki.net/wiki/Mighty_Silverfist"} (map-boss = :wiki-link{url="https://www.poe2wiki.net/wiki/Zekoa,_The_Headcrusher"}) tooltip ~5% base → Extra Crits một mình chỉ 5% × 4 = 20%, cần :wiki-link{url="https://www.poe2wiki.net/wiki/Critical_Weakness"} lên ~60%. Hai số base (5%, 25%) là tooltip read, mốc tham chiếu; dấu hiệu Silverfist mới là con high-crit (~250% crit-damage, không sinh từ Extra Crits vì mod chỉ crit *chance*). Chốt cứng: tame trắng, đọc crit + crit-damage companion in-client.
- Mighty Silverfist = Unique monster Act 3 :wiki-link{url="https://www.poe2wiki.net/wiki/Jungle_Ruins"} (Level 34), type :wiki-link{url="https://www.poe2wiki.net/wiki/Quadrilla"} (silverback ape dùng thân cây, không phải "monkey"). Carry phổ biến vì attack pool damage cao + xuất hiện nhiều map (dễ roll đúng mod).
- Nhánh khác theo damage type: :wiki-link{url="https://www.poe2wiki.net/wiki/Morvak,_the_Infernal"} fire/physical single target (cần debuff fire res/armor break); :wiki-link{url="https://www.poe2wiki.net/wiki/The_Black_Crow"} mobility đáng test nhưng chưa lý do vượt Head Crusher/Morvak; :wiki-link{url="https://www.poe2wiki.net/wiki/Diretusk_Boar"} rare Beast :wiki-link{url="https://www.poe2wiki.net/wiki/Infested_Barrens"} (nền 39%, charge + 25% Maim) — carry rẻ cho zoo, không cần đường Unique.
- Định nghĩa vai trò trước khi đổ tiền: thiếu phòng thủ → beast aura/defensive; thiếu ailment → ground effect/guaranteed ailment. Boss nguy hiểm với player ≠ companion tốt (skill khó né/arena pressure không chuyển thành damage khi thành minion).

## Bốn nguồn nhân damage (compound, khác bucket)

1. **Gem level**: more-multiplier trên skill ~60% more @ L20, ~79% @ L30, + flat 25% more riêng Tamed Beast ở mọi level. Chạm mọi con → **+level minion là upgrade #1** (amulet/sceptre/helmet suffix "+# to Level of all Minion Skills"). Jewel KHÔNG cấp gem level (đóng góp minion của jewel = increased damage + crit-damage-bonus suffix "of Gripping").
2. **Crit từ monster modifier**: **Extra Crits** = :wiki-link{url="https://www.poe2wiki.net/wiki/Monster_modifier"} "300% increased Critical Hit Chance" = ×4 base crit. Con tier ~5% cần Critical Weakness: +0.5 base crit/stack, max 20 = +10 base, cộng vào base **trước** khi nhân → (5 + 10) × (1 + 3.00) ≈ 60%. Build đã online nửa chuỗi: :wiki-link{url="https://www.poe2wiki.net/wiki/Malice"} inflict Critical Weakness trong presence → +10 base free.
3. **Pain Offering package**: :wiki-link{url="https://www.poe2wiki.net/wiki/Pain_Offering"} grant companion "20-29% increased Attack and Cast Speed" + tới "58% increased damage", scale theo increased Buff effect. :wiki-link{url="https://www.poe2wiki.net/wiki/Danse_Macabre"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Sacrificial_Offering"} mỗi cái "30% increased Buff effect". + :wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Cleric"} heal minion + companion. Cả gói chạy trên vài skeleton rẻ.
4. **Parry debuff**: :wiki-link{url="https://www.poe2wiki.net/wiki/Parry"} cho enemy "50% more Attack Damage" 2s base; scale duration bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Prolonged_Duration"} II (35% more → 2.0s lên 2.7s), scale magnitude bằng node Parried Debuff Magnitude (~100% từ node cây, buckler Dunkelhalt đẩy ~150%). More-multiplier tách bucket → nhân chồng crit + gem-level.
- Thứ tự đầu tư: gem level minion trước (rẻ, phổ quát); crit nếu carry crit (~25% cap trên một Extra Crits → dồn crit-damage-bonus; ~5% cần Extra Crits + Critical Weakness tới ~60%); Pain Offering package; Parry ở weapon-set 2 (end-state). Trần: **100% crit chance là breakpoint cứng** — cap rồi thì crit-chance thêm là số chết → pivot crit-damage-bonus (jewel "of Gripping" tới 25, Wolf Idol +20% crit damage bonus, support Super Critical).

## Săn rare beast ở đâu

Nghẽn = số lần gặp đúng base với đúng mod giữ lại. Ba đường:

- **Untainted Paradise (volume)**: :wiki-link{url="https://www.poe2wiki.net/wiki/Untainted_Paradise"} unique map water biome, area level 65, breeding — density cao (2× monster, 4× magic/rare) + 200–400% increased Experience, **không drop item nào** (giá trị ở rare bắt được). Mang loạt Tame Beast rỗng, juice density, tame mọi rare, disenchant con xấu tại chỗ. Một run juice = đủ rare 4-mod lọc cho hướng nguyên đàn.
- **Essence reset (đúng một base)**: mỗi overworld zone pool riêng — :wiki-link{url="https://www.poe2wiki.net/wiki/Whakapanu_Island"} (Act 4, area level 46) spawn đúng Caustic/Coconut/Quill Crab. Tìm essence monster (rare bị essence giam, hiện 2-3 regular modifier trước thả). Đọc mod: xấu → reset con essence mới; ưng → wisp rồi giết khi còn wisps. **Đừng đánh vỡ essence trước khi ưng mod** (vỡ = chốt). Reset hai tầng: nhẹ = respawn checkpoint reroll essence trong instance; nặng = Ctrl+left-click cửa area tạo zone mới. **Tắt minion khi tame zone level thấp** (đàn DPS giết beast trước khi wisps kịp bám).
- **Camp cổ điển (base phổ biến)**: reset checkpoint gần Troubled Camp trong Infested Barrens cho 2 rare/lần (Diretusk Boar ở đây), Jungle Ruins cho rare Quadrilla, Egg Cave trong :wiki-link{url="https://www.poe2wiki.net/wiki/Singing_Caverns"} cho rare Brine Maiden.
- Tier map **không** đổi base stat con tame (companion scale gem level không theo độ juicy) → essence reset chạy zone level thấp nhất còn ra đúng base; Untainted Paradise thì juice vì mục tiêu là density.

## Nhồi modifier lên Unique carry bằng tablet

- Bản Unique overworld spawn mod xoàng → tame bản **map-boss**. Silverfist map-boss = Zekoa the Headcrusher (area level 65), boss của :wiki-link{url="https://www.poe2wiki.net/wiki/Riverside"} (Forest) + :wiki-link{url="https://www.poe2wiki.net/wiki/Rupture_(map)"} (Swamp).
- Số tablet slot của :wiki-link{url="https://www.poe2wiki.net/wiki/Map_Device"} do **số modifier waystone** quyết (không do cắm tablet): 0-2 mod → 1 slot, 3-5 mod → 2 slot, **6 mod → cả 3 slot**. Alch + spam exalted đẩy waystone lên 6 mod. (0.5 bỏ Tower — tablet đặt thẳng vào Map Device.)
- Đầy 3 slot bằng hai :wiki-link{url="https://www.poe2wiki.net/wiki/Precursor_tablet"}: :wiki-link{url="https://www.poe2wiki.net/wiki/Cruel_Hegemony"} (unique Overseer tablet, "Map Bosses have 1 additional Modifier", 5 uses) + tablet suffix **"of Contest"** ("Unique Monsters in your Maps have 1 additional Rare Modifier", roll trên bất kỳ base, mỗi cái +1 rare mod). 3 slot → Zekoa ~3 rare mod thêm, Tame Beast giữ 4 nên không phí.
- Tầng trên cùng: node của **Jado of the Order of the Djinn** (Master of the Atlas, questline "Jado's Spycraft" bằng clear anomaly map gần start atlas) "20% chance for double effect of explicit modifiers on tablets" — proc → 3 "of Contest" đẩy boss tới 6 rare modifier (Tame Beast chỉ giữ random 4, không phí hẳn nhưng không kiểm soát giữ cái nào).
- Con boss nên thành **Powerful Map Boss** (mạnh hơn, drop xịn, +1 tier waystone). Cruel Hegemony làm sẵn (Overseer "Empowers the Map Boss"). Build mod count thuần "of Contest" trên base non-Overseer (Temple/Ritual/Breach) → boss không tự Powerful → :wiki-link{url="https://www.poe2wiki.net/wiki/Summoning_Circle"} + atlas notable **Runic Flare** (10% chance empower map boss khi hoàn thành vòng) là đường empower free. Empower nhị phân, không cộng dồn.
- Ưu tiên modifier khi soi boss (cao → thấp):
  - **Extra Crits** ("300% increased Critical Hit Chance") — #1 tuyệt đối.
  - **Periodically Enrages / Enraged** + **Hasted** — cùng bậc 2. Enraged +40% damage +25% action speed; Hasted 30% increased Attack/Cast Speed.
  - **Soul Eater** ("skill speed + damage reduction per consumed Soul", stack 50 souls) — mạnh trên carry ăn soul liên tục.
  - **Extra Fire/Cold/Lightning/Chaos Damage** ("gain 40% of Damage as Extra <element>") — added-as-extra additive, không conversion; ưu tiên chaos/lightning (ít resist).
  - **Shroud Walker** ("teleports to distant Enemies creating a Smoke Cloud") — gần meme, đỡ clear chút.
  - **"facing" KHÔNG phải monster modifier** — đừng chờ.

## Reroll + revive theo số mod waystone

- Số lần thử lại/map = số **waystone modifier**, không phải map modifier tablet. Stack "of Contest" + Cruel Hegemony chỉ thêm *map* modifier (mở slot, cộng mod boss), không đụng waystone modifier → nhồi tablet **không** đốt revive. Bảng: waystone 4-mod → 2 respawn attempt, 6-mod → 0 respawn attempt.
- **Run 6-mod (alch + spam exalted) — 0 revive, one-shot**: nhồi tối đa modifier (cả 3 slot) nhưng không thử lại. Chạy map → tới boss → **tame ngay** rồi mới xem modifier; chết/giết boss = mất trắng 3 tablet (gồm Cruel Hegemony 1 use). Rủi ro cao, chỉ khi quen tay.
- **Run rare 4-mod — 2 revive, soi-rồi-reroll**: vào boss room, tắt minion, soi mod Zekoa; xấu → để boss giết → respawn checkpoint **ngoài** boss room, chỉ còn boss present. Mỗi respawn = một lần soi mod mới → một lượt tablet cho nhiều lần thử. Người mới nên chạy.
- Soi bộ mod xấu → lượt phí, nhưng con vừa bắt không vứt được nếu đang chiếm Tame Beast 6-link đầu tư. Thoát: **disenchant** Tame Beast gem ở vendor → clear con đã lưu, trả Tame Beast trắng giữ level/quality/sockets. Thủ thêm Tame Beast thứ hai rẻ (Lv18, 5-link) làm standby soi mod, chỉ dồn link xịn sau khi trúng.

## Chain con boss bằng Rite of the Nameless

- Mỗi map một boss, atlas chỉ vài map có đúng con cần → nghẽn cứng. Rite nhân số lần gặp. Bắt đầu từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_King_in_the_Mists"}: giết → drop **The Head of the King** → hub **Caer Tarth** khởi động Rite of the Nameless (chuỗi 5 map một ritual liên tục). Monster mỗi ritual (gồm map boss) tái xuất ở từng map; unique boss mỗi map chỉ xuất hiện ở **ritual cuối** của map đó. Mỗi map sau map đầu mang modifier riêng + nhả mảnh key Ritual Pinnacle Boss.
- Đặt boss target làm **map đầu tiên** (boss kéo theo cả 5 bất kể 4 map sau) → một The Head of the King đổi ~5 lần gặp lại cùng con boss = ~5 cú fish độc lập cho Extra Crits. 4 map sau chọn theo an toàn (tier thấp nhất chịu được, chỉ cần giữ boss sống đủ wisp). Nhồi "of Contest" trên map Rite: Rite quyết **số lần** spawn, tablet quyết **số mod**, summoning circle **empower** — ba lớp nhân.
- Cơ chế ritual đầy đủ (8 point subtree, tribute/reroll, tablet suffix pool, Queen in the Mists): [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless).

## Weapon + gear xoay quanh companion

- Carry chạy attack pool monster → weapon buff companion. :wiki-link{url="https://www.poe2wiki.net/wiki/The_Catha%27s_Balance"}: "companions deal added Attack Damage equal to 60% of main hand weapon damage" → main-hand weapon damage thành stat companion. Weapon chậm, damage range cao, crit thấp vẫn tốt nếu không tự đánh → talisman damage cao đáng nghiên cứu. Weapon damage cao cũng buff :wiki-link{url="https://www.poe2wiki.net/wiki/Vivid_Stampede_%28passive%29"} (Vivid Wisps khi di chuyển → Spirit Stags khi attack).
- Weapon package: :wiki-link{url="https://www.poe2wiki.net/wiki/Jade_Talisman"} + non-unique sceptre qua :wiki-link{url="https://www.poe2wiki.net/wiki/Lord_of_the_Wilds"} = ceiling cao (main-hand damage lớn + minion stats trên sceptre); :wiki-link{url="https://www.poe2wiki.net/wiki/Spire_of_Ire"} low-friction spear (stat req nhẹ + chaos ít resist); :wiki-link{url="https://www.poe2wiki.net/wiki/Giant%27s_Blood"} + :wiki-link{url="https://www.poe2wiki.net/wiki/The_Hammer_of_Faith"}/:wiki-link{url="https://www.poe2wiki.net/wiki/Ironwood_Greathammer"} = peak-damage puzzle nhưng attribute pressure nặng.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Idolatry"} cho companion damage + res eff theo idol, phạt −4% ele res mỗi non-idol augment. Chỉ đáng khi idol setup vượt rune/augment thường; khai delta resistance trước mọi swap.
- Rare sceptre cho hướng dồn một boss: ưu tiên minion attack speed hơn cooldown recovery (attack pool Head Crusher nhiều cooldown skill không phải hit tốt nhất; attack speed đưa boss về basic/high-value attack nhanh hơn).

## Cái không hoạt động

- ✗ Tính mọi companion như multiplier free — companion chiếm spirit, AI, animation lock, survival problem, content không cho tame. Bỏ aura quan trọng chạy beast yếu = build tệ hơn.
- ✗ **Jewel không phải nguồn gem-level** — đóng góp minion ở "increased Damage" + crit-damage-bonus suffix; tìm minion-level trên jewel là phí, soi amulet/sceptre/helmet.
- ✗ **Parry không khuếch đại spell** — Parried Debuff là "more Attack Damage taken", chỉ con đánh attack. Cả hai ape attack-based nên ăn được, đừng giả định Parry phổ quát.
- ✗ **"30% more Damage" của Danse Macabre / Sacrificial Offering không phải buff companion** — dòng more đó scale offering spike; cái cộng vào carry là "increased Buff effect" khuếch đại grant Pain Offering. Danse Macabre chỉ apply nếu có skeletal minion dư consume; Sacrificial Offering tốn 15% Life/lần (cân trên Huntress evasion máu mỏng).
- ✗ **Stack crit chance quá 100% là số chết** → pivot crit-damage-bonus.
- ✗ **Modifier từ Essence/Azmerian wisp không dính** — chỉ 4 regular monster modifier gốc được giữ.

## Chi phí + ràng buộc

- Untainted Paradise không drop item → thuần máy farm beast, lời ở số rare tame được.
- Essence reset tốn thời gian reset hơn tài nguyên (mỗi zone/respawn = một vòng thao tác tay).
- Carry càng nhiều mod càng đắt spirit (reservation scale modifier-count, không node miễn). 4-mod + companion phụ + self-defense dễ vượt spirit budget league-start → rút skeleton (mất Pain Offering package). Tính reservation **trước** khi săn con nhiều mod.
- The Head of the King tiêu mỗi Rite; gặp King phải dồn tribute + sacrifice lấy Audience with the King → tốc độ săn bị rate-limit bởi tốc độ farm tới King. Mỗi Rite commit 5 map, không bỏ giữa chừng lấy lại key.
- **Tablet giá** (live 2026-06-02, POE2 0.5 day 4, fetch trade2): Cruel Hegemony floor ~1 exalted; "of Contest" floor ~6-8 annul base single-mod, bản multi-mod juiced ~25 ex; 1 divine ≈ 54-75 exalted. Đã crash ~60-75× so với day-2 (Cruel Hegemony từng ~1 divine, "of Contest" ~2-3 divine mỗi cái). Snapshot quá 7 ngày → re-fetch qua `/trade` trước khi quote. **Đừng mua tablet còn ít use** — Cruel Hegemony 5 uses, tablet thường 10 uses; một cái 1-use giá thấp thực ra đắt gấp 5 tính theo lượt.

## Chưa chốt in-client

- Con ape nào high-crit thật + crit-damage của nó (~250% hay khác); enumerate pool Azmeri Spirit mà The Natural Order luân phiên; double-effect node của Jado có apply cho dòng unique-monster không; cơ chế reset/reroll modifier khi respawn-at-checkpoint.

## Version History

### Patch 0.5.1
Tame Beast scaling giữ nguyên: minion more-damage theo gem level (~60% @ L20, ~79% @ L30) + 25% more của Tamed Beast ở mọi level; patch không đụng companion (Trusted Kinship, Extra Crits, Critical Weakness, Parry, Pain Offering đều y nguyên). The Natural Order possess con Unique bằng Azmeri Spirit đổi mỗi 20s — layer riêng, 4 rare mod giữ lúc bắt không rotate.

### Patch 0.5.0
Spirit Walker, Tame Beast + hệ companion ra mắt cùng Endgame rewrite. The Natural Order mở hướng Unique carry; tablet đi thẳng vào Map Device (bỏ Tower); Masters of the Atlas (Jado's Spycraft) thêm node double-effect; Rite of the Nameless (The Head of the King → Caer Tarth → chuỗi 5 map) cho chain một con boss để tame liên tiếp.

## Relationships

- **used_by** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build nguyên đàn xây trên cơ chế tame + modifier retention + chuỗi multiplier này.
- **related_guides** [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless) — cơ chế ritual đầy đủ mà đường chain-boss-để-tame chạy trên đó.
- **related_mechanics** [Twister](/guides/twister) — hướng Spirit Walker projectile dùng companion như utility layer thay carry chính.
- **related_mechanics** [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation) — ledger Spirit + reservation efficiency quyết định field được bao nhiêu companion.
- **related** [Prism of Belief](/guides/prism-of-belief) — Tame Beast nằm trong pool eligible skills; Prism scale companion level qua gem level.
- **competes_with** [Belt Hunting qua Ritual](/farming/0-5-ritual-belt-hunting) — cùng tốn slot tablet + atlas Map Device; chọn một hướng output mỗi session.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — 0.5 mở Spirit Walker + The Natural Order + Tame Beast + Endgame rewrite.
- **competes_with** [Abyss Ulaman và Amanamu Farm](/farming/0-5-abyss-ulaman-amanamu-farm) — cùng tốn slot tablet + atlas Map Device, output là carry companion thay vì abyss loot.
- **farming_relevance** [Săn Monkey Companion qua Ritual](/farming/0-5-monkey-companion-hunt) — cơ chế tame, retention modifier, chuỗi multiplier; doc farming này lo phần kinh tế.
- **related** [Increased vs More: quy tắc tính damage](/guides/beginner-increased-vs-more) — ví dụ thực tế More multiplier trong companion build (4 trục nhân damage con carry)
- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — ascendancy chuyên Spirit + companion reservation, ví dụ build phụ thuộc Spirit cao
- **related** [ThaoCamVienSaiGon — Progress Tracker](/characters/thao-cam-vien-sai-gon) — ascendancy mechanic + cách bắt beast.
- **related_builds** [Aura Bot Zoo Spirit Walker](/builds/huntress/0-5-spirit-walker-aura-bot-zoo) — pipeline tame nền: modifier retention, essence reset hai tầng, disenchant, Untainted Paradise.
- **related_builds** [Infernal Monkey Spirit Walker](/builds/huntress/0-5-spirit-walker-infernal-monkey) — cơ chế tame, modifier retention, Extra Crits, đường săn rare beast mà khỉ đi qua.
- **related_builds** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — minion/companion + spirit reservation nền tảng.
- **related_builds** [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) — minion/companion + spirit reservation nền tảng.
- **related_builds** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — ascendancy node Wild Protector / Primal Bounty / Mhacha's Gift / Vivid Stampede / Sacred Unity verbatim.
- **related_guides** [Ascendancy: chọn subclass và mở khoá như thế nào](/guides/beginner-ascendancy) — cơ chế + build direction của Spirit Walker.
- **related_guides** [Hoàn thành 8 challenge lấy Knight of Aldur](/guides/challenge-guide) — ascendancy + companion, liên quan The Hunter và The Ascendant.
- **related_guides** [Patch Notes — Return of the Ancients Mid-League Update](/guides/0-5-2-patch-notes) — Bear Spirit presence 4m→8m và fix Forgotten Warden chạm trực tiếp companion system.
- **related_guides** [Patch Notes — Return of the Ancients](/guides/0-5-0-patch-notes) — ascendancy companion mới và buff Tame Beast.
- **related_guides** [Skill gem và Support gem: hệ thống Uncut Gem của POE2](/guides/beginner-skill-gem) — chuỗi support gem cho companion (Pain Offering package)
- **related_guides** [Đặc trưng từng class và ascendancy](/guides/beginner-classes) — ascendancy companion mới của Huntress.
- **related_mechanics** [Farm aura beast cho companion zoo](/guides/0-5-aura-beast-farming) — pipeline tame nền: modifier retention, on-screen lock, disenchant, Untainted Paradise cho volume.
- **related_mechanics** [Olroth's Legacy](/guides/olroth-s-legacy) — companion build invest block cao hưởng rune lucky block Svalinn.
- **related_mechanics** [Stormweaver Infusion Mana Loop](/guides/stormweaver-infusion-mana-loop) — cùng league 0.5 caster/companion archetype, tham chiếu khi so sánh league-start option.
- **related_mechanics** [Unique Items Mới](/guides/0-5-new-unique-items) — Sylvan's Effigy + Forgotten Warden cắm thẳng vào trục companion.
- **synergizes_with** [From Nothing](/guides/from-nothing) — Trusted Kinship trong pool → companion build island-grab keystone trục qua jewel socket gần.
- **synergizes_with** [Heart of the Well](/guides/heart-of-the-well) — prefix "increased Damage while Companion in Presence" ngắm thẳng cho companion build.
- **synergizes_with** [Lochtonial Caress](/guides/lochtonial-caress) — charge share buff cả bầy companion miễn phí khi player giữ charge từ tree.
- **synergizes_with** [Sylvan's Effigy](/guides/sylvans-effigy) — item gỡ trần số loại companion, trục chính của ascendancy Spirit Walker.
## Resources

- [How to Scale Spirit Walker Tame Beast Damage](https://www.youtube.com/watch?v=hxqPJkbTp5Q) — nguồn multiplier cho Unique tame carry.
- [Spirit Walker Beast Master Build Guide — CaptainLance9](https://www.youtube.com/watch?v=p6uR2uC1Kk4) — carry vs zoo, Parry magnitude, crit ape.
- [GhazzyTV — How to FARM Rare Tamed Beasts VERY QUICKLY](https://www.youtube.com/watch?v=Fj7JjMjwLUU) — Untainted Paradise volume farm + essence reset Whakapanu, caveat account-bound + on-screen tame lock.
- [GhazzyTV — How to Tame Unique Beasts with 3+ MODIFIERS!](https://www.youtube.com/watch?v=23wZWPR16o4) — walkthrough tablet stacking + reroll trên Zekoa.
- [CaptainLance9 — Zoomancer Spirit Walker Setup](https://www.youtube.com/watch?v=7xaY6l3J7zE&t=376) — Rite of the Nameless chain con boss tame qua nhiều map, tested live.
