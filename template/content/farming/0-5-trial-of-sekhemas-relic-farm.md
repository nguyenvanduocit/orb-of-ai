---
template: templates/farming-template.md
document_type: farming-strategy
title: Trial of the Sekhemas Relic và Cache Farm
status: active
created: '2026-06-16'
updated: '2026-07-03'
strategy_tier: S
investment_tier: Medium
league: '0.5'
patch: 0.5.2
league_phase: Mid
confidence_level: Medium
---

# Trial of the Sekhemas Relic và Cache Farm

:wiki-link{url="https://www.poe2wiki.net/wiki/The_Trial_of_the_Sekhemas"} = dungeon roguelite 4 tầng 32 phòng, mở bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Djinn_Barya"}, chạy bằng thanh :wiki-link{url="https://www.poe2wiki.net/wiki/Honour"} thay máu. `Tier S (đáy) · investment Medium · nền ~10-25 div/h chưa tính jackpot (2026-06-16)`. Tiền hai tầng tách hẳn: nền đều từ cache reward room sau mỗi boss (currency/waystone/jewel/relic), jackpot từ Zarokh tầng 4 (unique relic + Zarokh's Reliquary Key ~74 div). Đòi build chuyên sống nổi 32 phòng ~10 phút/run.

## Cơ chế

- Giá trị nằm trong **cache reward room** mở bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Bronze_Key"}/:wiki-link{url="https://www.poe2wiki.net/wiki/Silver_Key"}/:wiki-link{url="https://www.poe2wiki.net/wiki/Gold_Key"} — nhả Arcanist currency, Cartographer waystone, jewel (Royal/Time-Lost/Grand Spectrum), relic, gear. Tầng 4 thêm Zarokh (boss duy nhất nhả unique relic + Reliquary Key).
- Honour pool = Life + :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} lúc start (+ Mana nếu :wiki-link{url="https://www.poe2wiki.net/wiki/Mind_over_Matter"}); Honour về 0 = fail run ngay, không mất experience. Fail tầng 3 mất gần toàn bộ giá trị (back-loaded). Build thủ tốt giữ Honour → dồn Sacred Water sang key ở Keth Forge; build thủ yếu đốt water hồi Honour → ít cache hơn (build khỏe thắng kép).

## Setup

- **Build floor:** Honour pool scale theo Life + ES + Runic Ward (EHP dày lợi, CI ES cao cũng tốt). Cận chiến có thưởng ngầm **35% less Honour damage khi đứng sát quái** → melee/khoảng cách ngắn dễ sống hơn ranged. Mục tiêu: cap **Honour Resistance 75%** qua relic + EHP đủ để 1 đòn lỡ không xóa nửa thanh. Zarokh tầng 4 đòi thêm movement speed — pha time-stop trừ Honour nặng (trước 0.3.0 auto-fail) nếu không gom hourglass trước khi đồng hồ quay đủ vòng.
- **Relic Altar** (18 ô: 6 mở sẵn, 12 mở dần khi xong từng tầng; relic cắm trước start mới tính, relic nhặt trong run để dành run sau). Ưu tiên mod: **+% Honour Resistance** tới cap 75% (số một) > **% increased maximum Honour** > cụm key (**% increased quantity of Keys dropped by Monsters**, **When you gain a Key, X% chance to gain another**, **% chance for each Key to upgrade on completing a Floor**) > **% increased quantity of Relics dropped** > Sacred Water (double water từ quái/fountain/room clear) > QoL (movement speed, dodge roll distance, reveal extra room).
  - Relic non-unique reforge 3-thành-1 cùng base ở :wiki-link{url="https://www.poe2wiki.net/wiki/Reforging_Bench"} (Tapestry Relic không áp dụng), hoặc craft bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Augmentation"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Annulment"} ép dòng honour-res/key. Reforging Bench ở entrance từ patch 0.5, làm giữa run không cần về town.
- **Keys:** mở run bằng Djinn Barya **area level 75+** cho đủ 4 tầng (key thấp hơn chốt trần thưởng tầng 1-3, không chạm Zarokh). Key trade được, tính đến 2026-06-16 vài ex tới <1 div → mua lô lúc rẻ (chi phí đầu vào lớn duy nhất).

## Profit math

```
profit/run = (cache floor + relic resale + zarokh jackpot) − key cost − relic setup amortize
```

- Nền cache 1 run 4 tầng stack key đủ ra **~2-4 div** (currency + waystone + jewel + relic reforge, 2026-06-16). Trừ Djinn Barya 75+ (vài ex tới <1 div) → net nền ~2-4 div/run. Build tune ~8-12 phút (~5-7 run/h) → **~10-25 div/h chưa jackpot**; Zarokh kéo trung bình lên nhưng không đều.
- Giá poe2scout 2026-06-16, 1 div = 182 ex:

| Nhóm | Item · giá · volume · Δ7d |
|---|---|
| Jewel cache (volume cao, đang nguội) | Against the Darkness Time-Lost Diamond ~363 ex (~2 div, vol 3.476, −31%) · Undying Hate Timeless Jewel ~120 ex (~0.66 div, vol 4.512, −51%) · Heroic Tragedy Timeless Jewel ~55 ex (~0.3 div, vol 10.985) · Grand Spectrum Ruby ~40 ex (~0.22 div, vol 1.638, −64%) |
| Zarokh jackpot (leo nhưng thưa) | The Last Flame Incense Relic ~290.662 ex (~1.597 div, vol 46, +137%) · The Desperate Alliance Vase Relic ~1.503 ex (~8.3 div, vol 368) · **Zarokh's Reliquary Key: Against the Darkness ~13.470 ex (~74 div, vol 7, +87%)** — mở lại Zarokh guaranteed unique relic + Time-Lost Diamond, bản thân key trade div |
| Relic resale (đệm) | 3 relic cùng base reforge → 1 tốt hơn; dòng Honour Res cao / cụm key bán vài–vài chục ex; tự nuôi kho nên setup ~amortize |

- Jewel cache nhả :wiki-link{url="https://www.poe2wiki.net/wiki/Time-Lost_Ruby"}, Timeless Jewel, :wiki-link{url="https://www.poe2wiki.net/wiki/Grand_Spectrum_(Ruby)"} — volume cao bán ngay nhưng cả bốn rớt giá mạnh trong tuần.

## Gameplay

- Coi thanh Honour là HP thật: đứng sát quái ăn 35% less Honour damage, dodge-roll xuyên trap (animation miễn nhiễm). Chọn đường qua phòng cache + key khi Honour khỏe; né phòng viền tím (afflicted).
- Boon 3 nhóm: thủ (Lustrous Lacquer 50% more Defences, Fright Mask monster 20% less damage, Glowing Orb phao dưới 20% Life), hồi Honour (Earned Honour mỗi phòng xong, Adrenaline Vial 30% vào boss room), key (Mirror of Fortune nhân đôi key kế).
- Boss cố định: :wiki-link{url="https://www.poe2wiki.net/wiki/Rattlecage,_the_Earthbreaker"} T1 né AoE mở màn · T2 Hadi + Rafiq đánh đều hoặc kill con hai nhanh sau con một (để lâu hồi máu, coi chừng nổ nguyên tố lúc mỗi con chết) · :wiki-link{url="https://www.poe2wiki.net/wiki/Ashar,_the_Sand_Mother"} T3 lờ Balbala giục nhảy platform (bẫy) + tránh quicksand · :wiki-link{url="https://www.poe2wiki.net/wiki/Zarokh,_the_Temporal"} T4 sprint gom hourglass trước khi đồng hồ quay đủ vòng.
- Reward room sau mỗi boss: mở hết cache bằng key, **convert toàn bộ Sacred Water dư ở Keth Forge thành key** mở thêm cache, rồi ghé Balbala mua relic/boon. Đừng mở cửa tầng kế trước khi vét xong (mở cửa khóa luôn merchant phòng đó).

## Failure Modes

- **Nền jewel-cache đang nguội thật** — cả bốn món chủ lực rớt 31-64% trong 7 ngày tới 2026-06-16; giá trị trôi từ nền sang jackpot Zarokh (+87-137%). Càng về sau càng phụ thuộc cú hên.
- **Build floor gate cả run** — fail trước tầng 4 mất nguyên run (giá trị back-loaded). Sekhemas là S cho build khỏe, bẫy đốt key cho build yếu.
- **Zarokh time-stop one-shot build chậm** — đúng con boss có tiền nhất giết oan build thiếu movement speed → bù movement speed qua boon/relic trước khi farm key 4 tầng.
- **Phương sai jackpot tàn nhẫn** — Reliquary Key volume 7 và The Last Flame volume 46 trên toàn market → chạy hàng chục run mới thấy 1 cái. Coi jackpot như xổ số.
- **Affliction brick run** — Corrosive Concoction xóa defences, Branded Balbalakh cấm hồi Honour, Orb of Negation vô hiệu relic non-unique. Boon Dekhara's Necklace + né phòng viền tím giảm rủi ro, không xóa hẳn.
- **Patch sensitivity** — GGG hay nerf farm lãi nhất giữa league; giá jewel-cache đang tự nén. Nerf droprate cache hoặc key generation cắt thẳng dây chuyền chính.

## Changelog

### 0.5.2
- Turret fireball fix. Reforging Bench đã ở entrance từ 0.5.0.

### 0.5.0
- Runic Ward cộng vào Honour pool (buff trực tiếp EHP dày → Honour to hơn); Reforging Bench dời về ngay entrance.

### 2026-06-16
- Initial. Giá pull live poe2scout (1 div = 182 ex): Zarokh's Reliquary Key ~13.470 ex, The Last Flame ~290.662 ex, The Desperate Alliance ~1.503 ex, jewel cache volume cao Δ7d −31% tới −64%. Cơ chế verify từ wiki mirror `data/wiki/Trial_of_the_Sekhemas.md` + relic mod pool `List_of_modifiers_for_medium_relics`. Throughput là quan sát kinh tế chung, chưa phải sample cá nhân — log số run/cache/jewel + Reliquary Key bán/giờ để thay bằng số của chính mình.

## Relationships

- **related_mechanics** [Farming strategy tier list](/guides/0-5-farming-strategy-tier-list) — Sekhemas xếp đáy S; doc này là bản farm chi tiết của entry đó.
- **competes_with** [Abyss Ulaman và Amanamu Farm](/farming/0-5-abyss-ulaman-amanamu-farm) — farm map không đồng hồ, tha thứ build chậm, thu nhập đều hơn nhưng không nhả cú drop to kiểu Reliquary Key.
- **competes_with** [Breach Rare Juice Farm](/farming/0-5-breach-rare-juice-farm) — currency density cao trên atlas map, đối trọng nền-đều với jackpot-variance của Sekhemas.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — league system 0.5 thêm Runic Ward vào Honour pool và rewrite endgame.
