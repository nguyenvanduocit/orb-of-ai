---
template: templates/item-template.md
document_type: item
title: Vestige of Darkness
status: draft
author: duocnv
created: '2026-06-01'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
pob_coverage: PARTIAL
rarity: unique
item_class: Helmet
level_requirement: 65
item_tags:
  - helmet
  - unique
  - tenebrous-crown
  - physical
  - chill
  - freeze
  - shatter
  - blind
  - pinnacle-drop
meta_tags:
  - clear-speed
  - build-enabling
  - ailment-physical
  - endgame-chase
tags:
  - item
  - unique
  - helmet
  - physical
  - freeze
  - shatter
  - 0-5
  - runes-of-aldur
---

# Vestige of Darkness

Unique helmet duy nhất trên base :wiki-link{url="https://www.poe2wiki.net/wiki/Tenebrous_Crown"}. Mod #3 `Physical damage from Hits Contributes to Chill Magnitude and Freeze Buildup` cho build physical-hit clear pack bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Freeze"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Shatter"} không cần cold conversion. **Clear-speed/map item, không phải boss-killer**: unique boss không shatter, chill bị cắt nửa trên unique. Lvl 65 pinnacle drop → power spike giữa–cuối endgame, không build-around từ league start. Context: [Đợt Unique Mới](/guides/0-5-new-unique-items).

## Stats

Req Level 65, 59 Str, 59 Int. Base Tenebrous Crown = str/int armour helmet, đúng **1 rune socket**.

```
Vestige of Darkness
Tenebrous Crown
Requires Level 65, 59 Str, 59 Int
--------
(150–200)% increased Armour and Energy Shield
+(20–30) to Strength and Intelligence
Physical damage from Hits Contributes to Chill Magnitude and Freeze Buildup
Enemies in your Presence are Blinded
The Bodach haunts your Presence
--------
"Your covetous hands bring the Unlight ever closer to consuming your realm."
```

- Instance đã roll: 173% inc AR/ES, +22 Str/Int (trong range). Defenses hiển thị Armour 447–537, ES 125–150 = **sau** khi %inc của item áp lên base (base Tenebrous Crown ~179 AR / 50 ES) → phân biệt base vs rolled để không nhân hai lần.

## Why This Item Is Powerful

- Mod #3 "Contributes" ≠ conversion. Mặc định 0.5 chỉ Cold damage đóng góp Chill Magnitude + Freeze Buildup; mod nhét thêm phần physical mỗi hit vào cả hai → hit **physical thuần** vẫn chill + tích freeze, không cần một điểm cold conversion.
- **Freeze** = hit-buildup: mỗi hit dưới min threshold cộng vào Freeze Buildup counter, ≥100% → freeze base **4s** rồi reset về 0 (freeze = action speed 0).
- **Chill** apply ngay nếu damage vượt threshold (luôn dính, không roll), nhưng phải tạo ≥30% magnitude slow không thì bị discard; magnitude scale damage-sau-mitigation / ailment threshold, cap 50% (70% với Stormweaver Heavy Snows).
- **Shatter**: enemy chết trong lúc Frozen → nổ tan xác, không để corpse cho on-death/revive/detonate/desecrate.
- Ailment threshold (mốc 100% buildup) scale theo **monster level, độc lập monster life** ở 0.5 (khác PoE1). Base verified: lvl 65 = 9.723 · lvl 80 = 26.029 · lvl 82 = 29.684 · lvl 90 = 50.219 · lvl 100 = 96.892. T1 normal = lvl 65, T16 normal = lvl 80, magic/rare +1, boss +2 (T16 map boss base ≈ lvl 82). Model: buildup/hit ≈ 100% × (P_sau-mitigation / AT) × (1 + more/inc Freeze Buildup); số hit ≈ ceil(AT / (P × mult)) nếu hit kịp trước decay (→ attack speed quan trọng). mult=1: hit physical 8.000 freeze lvl 65 normal (AT 9.723) trong 2 hit, lvl 80 normal 4, lvl 82 boss-base 4; hit 20.000 → 1 / 2 / 2. Số boss = cận dưới (chưa áp rarity multiplier + threshold-tăng-mỗi-lần-freeze).

## Build Enabler Mechanics

- Profile ép ra: physical-hit, đánh quanh Presence, clear-speed bằng freeze + shatter explosion, tanky nhờ armour+ES + blind aura, chơi map. Cần 59 Str + 59 Int, chấp nhận endgame chase. Ring slot gần mặc định :wiki-link{url="https://www.poe2wiki.net/wiki/Polcirkeln"} mở shatter-on-chill.
- Scale đúng trục: mọi nguồn generic (inc/more Freeze Buildup, inc/more Magnitude of Chill, Freeze Duration, Slow Magnitude, giảm enemy ailment-threshold) + tăng physical hit damage đều đẩy chill + freeze. `increased Cold Damage` **không** chạm phần physical này → đầu tư physical + node generic ailment, tuyệt đối không đổ node cold-damage.
- Defense: helmet là khối phòng thủ riêng (%inc AR/ES trên str/int base, +str/int cover req gear khác, blind toàn enemy trong Presence). Chill/freeze cũng là defense. Runeforge → Runemastered thêm Runic Ward 56 (không phải strict upgrade, xem Acquisition).
- **Exclusion check:** ăn ít/không gì từ mod #3 — (1) cold/conversion cao (Glacial Lance convert 80% phys→cold, còn quá ít physical); (2) ele/chaos caster không physical hit; (3) DoT build (ignite/poison/bleed — freeze là hit-buildup, DoT không tích); (4) non-hit/trigger/totem/minion-only; (5) full phys→ele conversion. Edge: hybrid giữ physical residual có thể double-dip — test trong PoB2.

## Acquisition

- Lvl 65 pinnacle drop → maps/endgame sau khi mở Ritual pinnacle, không leveling/league-start. Drop source suy ra = **The Bodach** (Ritual pinnacle boss 0.5, monster level 79) qua Rite of the Nameless: giết The King in the Mists lấy key "The Head of the King", chạy 5 map (mỗi map boss rớt effigy/key), đánh The Bodach ở ritual cuối. Phân biệt The Bodach (boss) với "the wendigo" helmet manifest qua mod #5 — hai entity khác. Chưa loot table nào xác nhận (maxroll boss-loot bỏ Bodach, poe2db không có drop field) → suy luận hội tụ.
- Giá: snapshot **2026-05-31 16:57 UTC** (Runes of Aldur) ~143.3 Exalted ≈ 2.81 Divine (1 div = 51 Ex), 74 listings — ~thứ 11 đắt nhất trong 218 armour unique. **Không ổn định**: nổ ~36× trong một ngày (4 Ex 30/05 → 143 Ex 31/05). Treat 143 Ex provisional, re-price sau 5–7 ngày.
- Runeforge gần free: 300 :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium"} Verisium ~0.34 Ex + Medved's Crest of the Circle ~0.61 Ex = ~0.95 Ex (<1% giá item). Nhưng item >lvl 55 → Verisium KHÔNG nâng base defense, đánh đổi Armour/ES lấy Runic Ward — không strict upgrade.
- Adoption ~0: poe.ninja index 60.147 character, Vestige vắng khỏi Top Items (~0% usage); chưa build PoB-verified/indexed/guide, maxroll chỉ stat-entry không recommend, creator meta day-2/3 không nhắc. Giai đoạn "creator demo pinnacle unique vừa rớt".

## Failure Modes

- **Boss/pinnacle damage rỗng.** Unique boss không shatter, chill cắt 50% trên unique, freeze threshold boss tăng-rồi-decay mỗi lần freeze. Build phải có damage profile riêng cho single-target.
- **Map mod hostile.** "Monsters cannot be Chilled/Frozen" tắt toàn bộ giá trị tấn công, chỉ còn defensive (blind + AR/ES).
- **Conversion trap.** Lỡ đi phys→cold → physical còn quá ít feed mod #3 → dead mod tấn công (bẫy dễ mắc nhất vì "freeze = cold").
- **Attribute floor.** 59 Str + 59 Int là tax thật với class lệch attribute; dex class gánh cả hai.
- **Accessibility floor.** Lvl 65 + pinnacle drop → không build-around từ league start; giá biến động ~36×/ngày → mua sớm rủi ro.

## Version History

### Patch 0.5.0 (Runes of Aldur — 2026-05-29)
- Item introduced. Mod values, base Tenebrous Crown, level req 65 verbatim-confirmed poe2db.tw; freeze/chill/shatter/threshold verified từ wiki mirror.
- Còn phải log khi vào league: (1) wendigo helmet manifest deal damage type/lượng/uptime + định nghĩa "enemy power" (chưa document); (2) freeze buildup thực vs threshold lvl 82 boss sau rarity multiplier (bao nhiêu hit freeze T16 map boss thật); (3) PoB2 sim physical mace/crossbow + Vestige + Polcirkeln — `pob_coverage: PARTIAL` vì PoB2 fork chưa model phys→freeze-buildup lẫn Runic Ward 0.5; (4) re-price live qua /poe2scout sau 5–7 ngày; (5) xác nhận drop source từ The Bodach; (6) re-scrape `data/poedb/0.5.0/Vestige_of_Darkness.md` (stub pre-launch stale).

## Related Items & Alternatives

- :wiki-link{url="https://www.poe2wiki.net/wiki/Polcirkeln"} Polcirkeln — unique Sapphire Ring, `Enemies Chilled by your Hits can be Shattered as though Frozen`. Partner gần bắt buộc: ghép mod #3, physical build chỉ cần CHILL (dễ hơn 100% freeze buildup) là shatter trash gần mỗi hit. Vẫn không shatter unique boss.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Sculpted_Suffering"} Sculpted Suffering — cùng dòng shatter-on-chill, alt khi ring slot bận.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ice"} Herald of Ice — `Enemies you Shatter explode` (30 Spirit, cần Martial Weapon: mace/crossbow/spear/quarterstaff). Thêm sau Polcirkeln → shatter đơn thành AoE chain clear cả màn.
- Archetype dẫn đầu = **physical mace-slam Warrior (Warbringer/Titan)**: slam physical cực lớn xoá phần lớn threshold tức thì (hit 20k freeze lvl 65 normal trong 1, lvl 82 boss-base ~2 trước rarity multiplier), str-stack thoả 59 Str dễ, 59 Int splash nhẹ, armour+ES + blind + Runic Ward hợp melee đứng-trụ. Khác: physical spear Huntress :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} (dex class gánh cả 59 Str + 59 Int); physical crossbow Mercenary :wiki-link{url="https://www.poe2wiki.net/wiki/Witchhunter"} (str/int native → 59/59 gần free, ranged an toàn); physical quarterstaff :wiki-link{url="https://www.poe2wiki.net/wiki/Monk"} (attack speed cao, cần skill quarterstaff physical).

## Relationships

- **synergizes_with** [Đợt Unique Mới và Meta Shift](/guides/0-5-new-unique-items) — cùng đợt 42 unique 0.5, item cắt trục physical-ailment chưa được survey cover sâu.
