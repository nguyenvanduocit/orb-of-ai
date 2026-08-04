---
template: templates/character-progress-template.md
document_type: character-progress
title: ThaoCamVienSaiGon — Progress Tracker
status: endgame
author: duocnv
created: '2026-06-14'
updated: '2026-07-03'
character_name: ThaoCamVienSaiGon
character_class: Huntress
ascendancy: Spirit Walker
league: '0.5'
patch: 0.5.3
current_progress: t16-farming
---

# ThaoCamVienSaiGon — Progress Tracker

Huntress / Spirit Walker Lv96 — đàn companion :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} quanh carry crit Zekoa the Headcrusher; :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} một tay qua :wiki-link{url="https://www.poe2wiki.net/wiki/Giant's_Blood"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy"} (any number of Companions). Farm T15; còn cap cold res + 5 điểm cuối Lv96-100.

## Snapshot

Last fetch: 2026-06-14 — poe.ninja model snapshot (khớp client). PoB2 0.4 chưa model Tame Beast → DPS tamed-beast đọc client; defense từ model.

- **Life/ES/Mana:** 1,885 / 1,929 / 1,384 + Runic Ward 121 · **Spirit** 439
- **Armour/Eva/Deflection:** 1,941 (17% phys DR) / 8,625 (48% evade, cap 95%) / 7,115 (43% deflect) · **Block** 0% (Dunkelhalt buckler ở weapon set 2 dormant)
- **EHP** 19,432 · **Max hit:** Phys 4,120 / Fire >10k / Cold >10k / Lightning >10k / Chaos >10k (phys mỏng nhất)
- **Res:** Fire 72 / Cold 66 / Lightning 75 (overcap 31) / Chaos 72 — cold 66 lỗ duy nhất dưới cap. 3 dòng Bonded trên Morior/sceptre là ShamanOnly → chết trên Huntress (cold đứng yên 66)
- **Attr:** Str 155 / Dex 147 / Int 339 · **Charges** Endurance 3 / Frenzy 3 / Power 3 · **MS** 128%
- **Carry + companion** (DPS đọc client): Zekoa the Headcrusher (carry); granted Bear Wild Protector + Azmerian Wolf (~126.6k / 126.9k); Wolf Pack 17.6k; đàn damage/utility (Fungal Wolf, Hyena Demon, Bramble Rhoa, Swarming Wasp); body-block (Quill Crab, Coconut Crab)

## Goals

North star = vá thủ, không kéo DPS công khai (2 con granted tự đẩy DPS free).
1. **Cap cold 66→75**: 1 dòng cold trên ring rare hoặc craft cold lên belt — lỗ res rẻ nhất.
2. **5 điểm cuối Lv96-100 → cụm Staunch Deflection** (0.5.3 thêm Deflection Rating = 8% Evasion Rating): 4 node detour (Deflection → Evasion Rating → Deflection → Staunch Deflection) → +690 deflection (eva 8,625), +2-3pp chance deflect. Verify cách path 4 node in-client trước commit.
3. **Dày phys EHP**: phys max hit 4,120 mỏng hơn element (>10k). Thêm armour, life-ES flat, hoặc % phys taken as element.
4. **Đọc crit%/DPS Zekoa in-client** (PoB2 trả 0) để biết The Adorned + jewel magic + 2 nhẫn (25%+22% crit damage bonus) đủ chưa.

## Skill Gems & Links

15 nhóm skill live (fetch 2026-06-16). Carry Zekoa; con khác chia damage-support-free / aura-body-block.
- **Zekoa** (carry): Rage III + Feeding Frenzy II + Rapid Attacks II + Muster + Tangmazu's Thurible. Rage III giữ 30 rage → +30% more attack damage; Tangmazu cho Gigantic + mượn evasion/deflection của mình để Zekoa tank.
- **Bear** (Wild Protector, granted): Catha's Brilliance + Rapid Attacks II + Romira's Requital + Magnified Area II + Hulking Minions. Romira's ở đây vì Bear granted tự hồi sinh.
- **Azmerian Wolf** (granted): Feeding Frenzy II + Kurgal's Leash + Muster + Loyalty + Rapid Attacks II. Command xả Eternal Hunt + Unholy Might 15s cho mình + Wolf.
- **Wolf Pack**: Minion Splash II + Uruk's Smelting + Heft + Muster + Feeding Frenzy II — engine clear + nguồn full-break; Heft +30% more max phys hit.
- **Fungal Wolf · Hyena Demon · Bramble Rhoa** (damage): mỗi con Rage III + Loyalty + Rapid Attacks II + Muster + Feeding Frenzy II — support free, đập tối đa.
- **Swarming Wasp**: Loyalty + Rapid Attacks II + Rage III + Muster + Feeding Frenzy II — full damage + Periodic Invulnerability Aura (anti-wipe).
- **Quill Crab · Coconut Crab** (body-block): Rage III + Loyalty + Meat Shield II + Last Gasp + Minion Mastery — Meat Shield đổi 40% less damage lấy 40% less taken.
- **Sniper's Mark**: Mark for Death II + Cooldown Recovery II + Eternal Mark + Charged Mark + Second Wind III — giữ uptime mark (Sylvan's chỉ phát +90% companion damage vs Marked khi mark sống).
- **Player utility**: Ghost Dance (+ Cooldown Recovery II + Clarity II) hồi ES theo evasion; Discipline (granted, no reserve) chạy ES; Purity of Lightning (granted Chober Chaber) giữ lightning res; Parry ở set 2 dormant.

## Gear Summary

- **Chober Chaber** (Runeforged Leaden Greathammer) vũ khí chính — một tay qua Giant's Blood, +4 level minion skill + "Increases and Reductions to Minion Damage also affect you". Off-hand **Sylvan's Effigy**: "any number of Companions", grant Discipline + Azmerian Wolf, +90% companion damage vs Marked. Set 2 (Rapture Gnarl + Dunkelhalt) dormant (no-weapon-swap).
- Body :wiki-link{url="https://www.poe2wiki.net/wiki/Morior_Invictus"} (Grand Regalia): 309% inc AES, +7 all attr / +11% chaos res / +13 spirit mỗi socket filled, armour áp 10% sang chaos → armour 1,670, chaos res 55 (từ ~0 bản Forgotten Warden). **Bẫy**: 3 dòng Bonded (+12 cold, +12 light, +8 chaos) là ShamanOnlyMods = 0 trên Huntress; đừng tính bonded vào res.
- Jewel engine: **The Adorned** Diamond nhân 108% cho 8 viên magic "of Gripping" (corrupted magic) — 7 Authoritative (Minion Critical Damage Bonus + increased Damage), 1 Iconic (Presence Area + crit damage). Cả 8 đổ vào Zekoa (companion duy nhất giữ Extra Crits); đổi lại ES rớt 1,667.
- Boots **Atziri's Step** (30% MS + deflection từ evasion). Amulet **Empyrean Locket** fractured +4 minion levels, anoint The Soul Meridian (ES recovery). Helm **Skull Corona** +2 minion levels.
- Hai nhẫn Unset (dưới). **Biggest fix**: vá res sau đổi nhẫn — kéo cold + fire về cap qua găng/belt/flask; DPS công khai dư từ 2 granted. Cơ chế bắt beast: [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt).

## Hai nhẫn Unset

- Cả 2 slot là :wiki-link{url="https://www.poe2wiki.net/wiki/Unset_Ring"}: **Corruption Finger** (+51 life, +26 Dex, Minions 27% inc Damage, +8% atk/cast speed, **+25% Minion Critical Damage Bonus**, +13 mana) + **Morbid Circle** (+96 life, +30 Str, 9-15 cold to attacks, Minions 25% inc Damage, +10% atk/cast speed, **+22% Minion Critical Damage Bonus**). Được: 2 skill slot, ~52% minion inc damage, ~47% crit damage bonus, +18% atk/cast speed, Dex+Str gỡ kẹt attribute.
- Ring CÓ roll "Minions have increased Critical Damage Bonus" (cả 2 viên có explicit) → không cần ép về jewel; The Adorned vẫn gánh phần lớn, ring cộng thêm.
- Unset không res implicit + 2 viên không roll res → gánh res dồn hết vào găng/belt/amulet/flask. Craft tiếp:
  - **Găng rare** (thay Blood Talons, giữ base evasion): prefix +120-149 max Life · prefix % inc Evasion · suffix +41-45% Cold Res (kênh duy nhất dưới cap) · suffix +41-45% Fire/Chaos Res (overcap ele-weakness).
  - **Belt** (Dusk Lock +53 cold/+54 light/+46 fire desecrated, 2 charm slot): suffix +41-45% Cold Res · prefix flat Armour.
  - Sau craft: cold 75 (hết lỗ), fire 72→≥75, lightning overcap 31, chaos 72; giữ 2 skill slot + ~47% crit damage bonus + deflection (Atziri's Step) + sau 0.5.3 thêm ~+690 nếu allocate Staunch Deflection.

## Tinh chỉnh gem cho Zekoa

Rà toàn pool support 0.5 (556 thường + 80 Lineage) cho companion melee phys crit, A/B in-client. **Không support nào cấp crit chance cho minion** — crit chance Zekoa chỉ từ Extra Crits + minion crit damage bonus gear/tree.
- **Supercritical** (slot 5 candidate): DPS 969,768, crit 99%, CDB +747%, atk speed 0.81/giây, hit sẵn ~32% chaos (từ Unholy Might buff 15s, không cố định). Đáng ~**+12%** (crit capped 99% nên −20% less crit gần miễn phí; +100% CDB ăn ở 99% uptime — bỏ nó CDB tụt đúng 100, DPS −12%).
- **Brutality**: loại — DPS 851,291 (−12%), xóa sạch chaos, CDB 747→647, "Cannot Ignite". Impale + Heavy Swing cũng bỏ (atk speed 0.81 quá chậm cho Impale; Heavy Swing −10% AS). Không gem cut nào thắng Supercritical.
- **Uul-Netol's Embrace** (Lineage, mua trade): "gain 40% of Physical as Extra Chaos" — cộng thêm 40% phys = +43k chaos chồng Unholy Might (70% khi cả hai bật), vô điều kiện không cần Command; mất CDB Supercritical (về 647). base hit 142.6k→~185.9k, CDB 647 @ crit 100% → **~1.12M (+15%)**. Chaos break armour, feed Uruk's. Swap dương duy nhất — mua không cut ra được.
- **Crit overcap ~24%** (bỏ Supercritical còn dư 123%) → mọi dòng crit chance gear tương lai là phí; đổi sang crit damage/phòng thủ.
- **Pool loại**: "you use yourself"+UsedByProxy (Combo Finisher, Cadence, Defy, Momentum, Minion Pact, Clash, Crescendo, Culmination, Vruun's, Varashta's, Rigwald's); command-only cần Commandable (Bidding, Commandment, Kurgal's — Zekoa không Command); reserve-spirit (Atalui's Bloodletting); minion utility/thủ (Meat Shield, Elemental Army, Deathmarch, Tecrod's = 0 uptime, Crazed Minions chỉ khi hồi sinh); Bloodlust cần Bleeding (build không có). Uul-Netol's + Heft không bị exclude UsedByProxy/Minion → gắn companion được.
- **Uruk's Smelting cắm trên Repulsion** (+ Armour Explosion), không Sniper's Mark: Repulsion Wave nổ ~2/giây = hit tần suất cao góp break (mỗi hit vào Marked break 15% phys qua Mark for Death II); full-break → Uruk's +20% Physical Damage taken cả đàn. Mark không hit nên không break. Verify broken-armour bar; chưa full-break thì Uruk's thẳng lên Zekoa.
- **Second Wind III trên Sniper's Mark**: "twice as many Cooldown Uses", khác category Cooldown Recovery II (chạy cùng). Mark bị crit consume sau ~2.5s, cooldown ~4.6s → uptime trống ~54%; Sylvan's +90% companion damage vs Marked cho cả đàn nên mỗi giây mark tắt = cả đàn mất 90% lên boss. Second Wind kéo uptime ~95%, bonus vs-Marked ~+49%→~+86% = **~+25% boss DPS cả đàn**. Đổi lại bấm mark mỗi ~2-3s. Giữ tay thì Mark of Siphoning II (sustain, không tối ưu damage).

Còn phải làm:
1. So **Rage III vs Supercritical** slot 5 in-client (Supercritical 969,768; Rage III = +30% more attack damage qua 30 rage) — PoB2 không trả.
2. Mua **Uul-Netol's Embrace** slot 5 → ~1.12M (+15% vs baseline Supercritical 969,768), vô điều kiện.
3. Giữ **Muster · Feeding Frenzy II · Rapid Attacks II · Tangmazu's Thurible** (Muster ~49-56% more; Feeding Frenzy 30% more; Tangmazu Gigantic 20% more damage + 20% more life + tank; Rapid Attacks nuôi cycle mark-crit + break).
4. Gear: đừng thêm crit chance (99% capped) → crit damage/phòng thủ; ES 1,667 → 1 viên jewel ES/mana phòng thủ kéo EHP.

## Gem các skill khác

- Bear + Azmerian Wolf cân sub-DPS granted + redirect + Lineage utility — không đụng.
- 4 con damage free (Fungal Wolf, Hyena Demon, Bramble Rhoa, Swarming Wasp): Muster + Feeding Frenzy II + Rapid Attacks II (+ Loyalty/Rage III) → damage trực tiếp; Swarming Wasp thêm Periodic Invulnerability Aura. Support free → vắt kiệt.
- 2 body-block (Quill Crab, Coconut Crab): Meat Shield II + Last Gasp + Minion Mastery — không tính DPS; Rage III vô tác dụng nhưng free.
- Feeding Frenzy II = +15% damage taken → con nào chết nhiều đổi RIÊNG Feeding Frenzy sang Meat Shield II (−40% taken), mất ~26k DPS con đó. Muster + Rapid Attacks luôn giữ.
- Purity of Lightning = res load-bearing (granted free, không reserve); sau res sụp lightning chỉ overcap 21 → giữ.
- Discipline nên mang Healing Runes: +10 spirit, rút 10% max Runic Ward mỗi 5s heal đàn 200% ward mất. Verify granted aura nhận support không.

## Progress Log

### 2026-06-19

- Patch 0.5.3: Staunch Deflection thêm Deflection Rating = 8% Evasion Rating. Cluster Ranger-adjacent SE: từ path phải qua 2 Deflection + 1 Evasion Rating + Staunch Deflection = 4 node, ăn trọn 5 điểm cuối Lv96-100. Eva 8,625 → +690 Deflection (7,115→7,805), +2-3pp chance deflect. Vá thủ rẻ nhất (không tốn currency).
- Sync live snapshot 2026-06-14: Eva 8,625 / Defl 7,115 / Cold 66 (lỗ duy nhất) / EHP 19,432 / phys max hit 4,120.

### 2026-06-16

- Refresh model live poe.ninja (updatedUtc 2026-06-16T12:49Z, model 135327768). Đổi nhẫn: cả 2 slot Unset — Corruption Finger (+26 Dex, minion 27% damage, +25% crit damage bonus, +8% atk speed) + Morbid Circle (+30 Str, minion 25% damage, +22% crit damage bonus, +10% atk speed). Được 2 skill slot, ~52% minion inc damage, ~47% crit damage bonus. Sửa giả định: ring CÓ roll "Minions have increased Critical Damage Bonus" explicit → không cần ép jewel.
- Giá: nhẫn Unset không cõng res → cold 66→**0**, fire→**57**, EHP 16,401, cold max hit 5,115 (phys max hit thực lên 5,276) — lỗ one-shot mới. Ưu tiên cap lại cold+fire qua găng/belt/flask. Zekoa cắm Rage III slot 5; Supercritical 969,768 + Uul-Netol's ~1.12M vẫn là 2 lựa chọn. Thêm section Skill Gems & Links (15 nhóm).

### 2026-06-15

- Refresh poe.ninja (updatedUtc 2026-06-15T03:41Z). Tái cấu trúc đàn sang thủ: bỏ Caustic Crab, Bramble Hulk, Quadrilla; thêm Adorned Scarab (ES Aura), Swarming Wasp (Periodic Invulnerability Aura), Coconut Crab (Extra Physical Damage Aura + Ignite). Pack rẻ hơn (gross tamed ~203%→~168%), mất redirect "Damage Taken From Minions First" của Bramble Hulk. Thực thi 2 cú gem: Uruk's Smelting → Repulsion, Second Wind III → Sniper's Mark. 1 viên jewel phòng thủ → Iconic of Gripping → ES 1,929→1,667, EHP 19,432→18,080, phys max hit 4,120→3,857. Granted DPS Bear 134.8k / Azmerian Wolf 135.0k / Wolf Pack 20.5k.
- Kế hoạch skill slot qua Unset Ring: rare ring không roll minion damage/crit damage thường; dòng minion damage duy nhất = conditional Abyss Amanamu's "if you've Hit Recently" (sống vì Repulsion hit ~2/giây), minion crit damage bonus jewel-only. Chốt Storm Circle → Unset gánh Amanamu + Int + skill slot, giữ Oblivion Coil (+30% minion crit damage), dồn res sang găng/belt, giữ Atziri's Step. Build 7 trade link securable. Chưa price live.

### 2026-06-14

- Audit gem Zekoa, A/B in-client: Supercritical 969,768 (crit 99%, CDB +747%, ~32% chaos từ Unholy Might); Brutality 851,291 (−12%, CDB 647, mất chaos) → loại. Supercritical đáng ~+12%, không gem cut thắng. Swap dương duy nhất = mua Uul-Netol's Embrace (40% phys-as-chaos) thay Supercritical, ~1.12M (+15%). Crit overcap ~24% → gear đừng thêm crit chance. Cần sửa Uruk's Smelting (Sniper's Mark → Repulsion).
- Snapshot sau quay xe lớn, Lv96. Bỏ Tyranny's Grip + Forgotten Warden → Chober Chaber một tay (Giant's Blood) + Morior Invictus body: armour ~0→1,941, chaos res ~25→72; thêm Atziri's Step + The Adorned + magic "of Gripping" (crit damage → Zekoa). Roster aura: Caustic Crab + Bramble Hulk gánh Extra Physical Damage Aura, Quadrilla ES Aura, bỏ Antlion Charger. Hở 2 chỗ: cold res 66, phys max hit 4,120. Mark link gắn Cooldown Recovery II. 2 granted (Bear + Azmerian Wolf) ~127k mỗi con.

## Link trade

Sort giá tăng dần, mở trong Chrome đã login; kéo min trên form. Jewel/gear lọc `securable`; unique đắt (The Adorned, Uul-Netol's) để `any`. Giá live mỗi slot chưa rank — mở tab pathofexile.com login + Playwriter để rank top-10 securable/slot.

**Minion DPS:**
- [Uul-Netol's Embrace](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22any%22%7D%2C%22name%22%3A%22Uul-Netol%27s%20Embrace%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): Lineage support, cú nâng đơn lớn nhất, thay Supercritical → ~1.12M (+15% so 969,768)
- [Jewel "of Gripping" corrupted magic](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%2C%22filters%22%3A%7B%22type_filters%22%3A%7B%22filters%22%3A%7B%22category%22%3A%7B%22option%22%3A%22jewel%22%7D%2C%22rarity%22%3A%7B%22option%22%3A%22magic%22%7D%7D%7D%2C%22misc_filters%22%3A%7B%22filters%22%3A%7B%22corrupted%22%3A%7B%22option%22%3A%22true%22%7D%7D%7D%7D%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22explicit.stat_1854213750%22%2C%22value%22%3A%7B%22min%22%3A22%7D%7D%2C%7B%22id%22%3A%22explicit.stat_1589917703%22%2C%22value%22%3A%7B%22min%22%3A18%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): engine jewel minion crit damage bonus + minion damage, The Adorned ×108%/viên, mua roll cao hơn
- [Jewel minion damage + minion asp, corrupted magic](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%2C%22filters%22%3A%7B%22type_filters%22%3A%7B%22filters%22%3A%7B%22category%22%3A%7B%22option%22%3A%22jewel%22%7D%2C%22rarity%22%3A%7B%22option%22%3A%22magic%22%7D%7D%7D%2C%22misc_filters%22%3A%7B%22filters%22%3A%7B%22corrupted%22%3A%7B%22option%22%3A%22true%22%7D%7D%7D%7D%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22explicit.stat_1589917703%22%2C%22value%22%3A%7B%22min%22%3A12%7D%7D%2C%7B%22id%22%3A%22explicit.stat_3091578504%22%2C%22value%22%3A%7B%22min%22%3A3%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): "Authoritative of Orchestration", minion damage + attack/cast speed, The Adorned ×108%; tăng nhịp đánh Zekoa (aps 0.81/giây)
- [The Adorned, % effect cao hơn 108](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22any%22%7D%2C%22name%22%3A%22The%20Adorned%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): scale cả 8 viên jewel cùng lúc
- [Amulet minion + tamed companion + spirit](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%2C%22filters%22%3A%7B%22type_filters%22%3A%7B%22filters%22%3A%7B%22category%22%3A%7B%22option%22%3A%22accessory.amulet%22%7D%7D%7D%7D%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22explicit.stat_2162097452%22%2C%22value%22%3A%7B%22min%22%3A3%7D%7D%2C%7B%22id%22%3A%22explicit.stat_448592698%22%2C%22value%22%3A%7B%22min%22%3A2%7D%7D%2C%7B%22id%22%3A%22explicit.stat_3981240776%22%2C%22value%22%3A%7B%22min%22%3A40%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): chỉ mua nếu beat Empyrean Locket +4 minion fractured

**Res (găng + belt):**
- [Găng: Life 110+ / Dex 30+ / Fire 40+ / Cold 40+](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%2C%22filters%22%3A%7B%22type_filters%22%3A%7B%22filters%22%3A%7B%22category%22%3A%7B%22option%22%3A%22armour.gloves%22%7D%7D%7D%7D%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22pseudo.pseudo_total_life%22%2C%22value%22%3A%7B%22min%22%3A110%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_dexterity%22%2C%22value%22%3A%7B%22min%22%3A30%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_fire_resistance%22%2C%22value%22%3A%7B%22min%22%3A40%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_cold_resistance%22%2C%22value%22%3A%7B%22min%22%3A40%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): nhớ pick base Evasion
- [Belt: Life 130+ / Str 30+ / Light 40+ / Chaos 20+](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%2C%22filters%22%3A%7B%22type_filters%22%3A%7B%22filters%22%3A%7B%22category%22%3A%7B%22option%22%3A%22accessory.belt%22%7D%7D%7D%7D%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22pseudo.pseudo_total_life%22%2C%22value%22%3A%7B%22min%22%3A130%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_strength%22%2C%22value%22%3A%7B%22min%22%3A30%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_lightning_resistance%22%2C%22value%22%3A%7B%22min%22%3A40%7D%7D%2C%7B%22id%22%3A%22pseudo.pseudo_total_chaos_resistance%22%2C%22value%22%3A%7B%22min%22%3A20%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D): thêm flat Armour cho phys EHP

## Relationships

- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build doc đầy đủ cho character này.
- **related_mechanics** [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt) — ascendancy mechanic + cách bắt beast.
- **related_guides** [Spirit và spirit reservation](/guides/spirit-and-spirit-reservation) — quản spirit cho nguyên đàn.
- **related** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5.
