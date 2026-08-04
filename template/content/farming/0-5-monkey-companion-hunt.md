---
template: templates/farming-template.md
document_type: farming-strategy
title: Săn Monkey Companion qua Ritual
status: draft
created: '2026-06-15'
updated: '2026-07-03'
strategy_tier: B
investment_tier: Variable
league: '0.5'
patch: 0.5.2
league_phase: Mid
confidence_level: Medium
---

# Săn Monkey Companion qua Ritual

Fish :wiki-link{url="https://www.poe2wiki.net/wiki/Zekoa,_The_Headcrusher"} hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Alpha_Primate"} mang bộ rare modifier (đỉnh **Extra Crits**) → carry account-bound giữ cho build, KHÔNG bán được. Mô hình = **cost/con đạt target**, không phải div/h. `Tier B · investment Variable · bản nhanh ~1.5 div/map, full ritual amortize Head qua 5 map (2026-06-14)`. Endgame, không league-start.

## Cơ chế nhân số con (3 lớp)

- **Rite of the Nameless** (lớp chính): 1 :wiki-link{url="https://www.poe2wiki.net/wiki/The_Head_of_the_King"} → chuỗi 5 map chung ritual; boss map đầu tái xuất ở ritual cuối mỗi map sau → đặt :wiki-link{url="https://www.poe2wiki.net/wiki/Riverside"}/:wiki-link{url="https://www.poe2wiki.net/wiki/Rupture_(map)"} làm map đầu → Zekoa respawn nhiều lần, throughput 1 con/map → **5-8 con/map**.
- **Mod/con**: 3 slot tablet = 3 mod thêm; slot City thứ 4 (Industrial Improvements) = 4. Mỗi mod thêm = 1 vé fish Extra Crits.
- **Volume thô**: cần ~100 con/ngày mới khả thi → clear speed = biến kinh tế lớn nhất.
- 0.5.2: Jado **Partial Translations** "20% chance double effect" → "0-40% increased effect" — hết nhân số mod, chiến lược xoay sang volume.

## Setup

- **Atlas tree:** Ritual quanh hub **Caer Tarth** (tây điểm start atlas) mở Rite of the Nameless, node "+1 map" kéo chuỗi lên 6 · **Industrial Improvements** ("An additional Tablet may be used on City Maps") mở slot tablet 4, thiếu = trần 3 mod · **Doryani's Science → Remnants of Greatness** (map boss 20% chance guard Precursor Terraformer) ép biome Forest/Swamp cho nhiều Riverside/Rupture · thêm pack size/rare density Forest/Swamp + generic rarity nếu dư point.
- **Masters:** swap tự do trước mỗi map. **Doryani** đáng nhất sau 0.5.2 (Remnants of Greatness terraform Forest/Swamp). Jado Partial Translations hết đáng (chỉ tăng effect, không tăng số mod). **Hilda**: Mighty Prey (25% chance nâng map boss thành Powerful Map Boss), Breeding Season (thêm rare + rare-có-modifier).
- **Tablets:** cắm vào :wiki-link{url="https://www.poe2wiki.net/wiki/Map_Device"} cùng waystone; slot theo mod waystone (6-mod = 3 slot; slot 4 chỉ trên City/Citadel biome + Industrial Improvements):
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Cruel_Hegemony"} (unique Overseer tablet) — map boss thêm 1 modifier + empower Powerful Map Boss, **chỉ 5 uses** (kiểm khi mua) — [trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Cruel%20Hegemony%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D).
  - **2× "of Contest"** ("Unique Monsters in your Maps have 1 additional Rare Modifier") — mỗi cái +1 rare mod, mua off-peak (NA/EU ngủ) rẻ 20-30 ex — [trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Overseer%20Tablet%22%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22explicit.stat_3371085671%22%2C%22value%22%3A%7B%22min%22%3A1%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D).
  - Slot City 4 = thêm 1 "of Contest" → 4 mod. Tránh "4 Vaal Temple tablet" guarantee 4 mod (~25 div/tablet, ~1/8 map ra Quadrilla Sergeant, không đáng).
- **Waystone:** 6-mod = 3 slot, 0 revive (tame ngay, chết/lỡ kill = mất nguyên stack tablet — người quen tay); 4-mod = 2 slot, 2 revive (soi mod Zekoa, xấu để boss giết → respawn ngoài boss room = roll mới — an toàn, người mới). Tier không đổi base con tame → chạy tier thấp nhất còn đúng base.
- **Build floor:** clear nhanh + đứng nổi boss room empowered (6-mod one-shot = mất nguyên stack tablet) + **spirit headroom** đủ summon con carry vừa bắt.

## Profit math

```
cost/con target = (div/map tablet ÷ con/map raw) ÷ P(bộ mod đạt target)
```

- Throughput field-observed (Mattjestic + nhóm cày, 2026-06-14): full ritual ~3-4 div tablet/10 map → ~8-15 con → **~0.25-0.5 div/con raw**; monkey-only (1 Head + 3 tablet) ~1.5 div/map, 3-5 con/map → **~0.3-0.5 div/con raw**.
- Drop-rate field-estimate: just Extra Crits **1/15-1/30** con · Extra Crits + 1 mod tốt **1/30-1/50** · 3 mod tốt **1/100-1/300**.
- Ráp (~0.3-0.5 div/con raw): "just Extra Crits" tốn ~5-15 div mapping; 3×-good 30-150 div (cần ~100 con/ngày). Clear speed kéo cost mạnh hơn số mod khi đích chỉ "just Extra Crits".
- Mod priority: **Extra Crits** ("300% increased Critical Hit Chance") — trên Alpha Primate (~25% base crit) 1 mod cap 100%, trên Zekoa (~5% base) cần thêm :wiki-link{url="https://www.poe2wiki.net/wiki/Critical_Weakness"} mới ~60% > Extra Damage (Chaos/Lightning/Cold/Fire), Enrage, Hasted, T1 aura > Defensive (evasion, barrier) nếu carry hay chết.
- The Head of the King **không mua được** (search trả Unknown, poe2scout không list) → farm từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_King_in_the_Mists"}. Tablet bulk status `securable`. Giá tablet biến động: poe2scout 2026-06-10 ~130 ex/div, field 2026-06-14 ~180 ex/div — re-fetch trước session.

## Gameplay

- Roll waystone → cắm Cruel Hegemony + 2/3 "of Contest" → mở Rite of the Nameless với Riverside/Rupture làm map đầu.
- Trước chuỗi Rite: chạy tới map boss có Precursor Terraformer, kích terraform cụm sang Forest/Swamp gom Riverside/Rupture liền kề.
- Mỗi Zekoa tái xuất ở ritual: Extra Crits → tắt minion, wisp rồi giết khi còn wisps; không → để lượt trôi (4-mod) hoặc tame rồi disenchant sau (6-mod).
- Con xấu disenchant gem Tame Beast ở vendor → lấy lại con trắng giữ level/quality/socket, tái dùng. Giữ 1 Tame Beast rẻ standby soi mod, chỉ dồn 6-link con đáng giữ.

## Failure Modes

- **Spirit budget bóp chết con carry vừa bắt** — reservation scale theo modifier-count → tính spirit headroom trước khi fish con nhiều mod.
- **6-mod one-shot mất nguyên stack tablet** — 0 revive: chết/lỡ giết Zekoa = mất Cruel Hegemony (1 use) lẫn 2-3 "of Contest". Người chưa quen chạy 4-mod.
- **The Head of the King là nút thắt nhịp độ, farm-only** — mỗi Rite nuốt 1 Head; không sustain được → tụt về monkey-only map lẻ, mất lớp nhân số con.
- **Variance ăn cả ví ở bộ GG** — 3×-good là 1/100-1/300, có thể cày 150+ con trắng tay. Build clear chậm (20-30 con/ngày) thực tế không chase nổi → dừng ở "just Extra Crits".
- **Patch risk** — Partial Translations đã nerf giữa 0.5.2; "of Contest", slot City, ritual revival đều có thể là mục tiêu kế nếu route viral.

## Changelog

### 0.5.2
- Partial Translations redesign "20% chance double effect" → "0-40% increased effect", hết nhân số mod → chiến lược xoay sang volume thuần.

### 2026-06-15
- Initial draft. Seed từ guide Mattjestic "How to Find 3-4 Mods Monkey After 0.5.2 Nerf" (mobalytics, 2026-06-14). Cơ chế verify patch note 0.5.0/0.5.2 + poedb/wiki live. Drop-rate + throughput + cost là field-estimate.

## Relationships

- **related_guides** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — cơ chế tame, retention modifier, chuỗi multiplier; doc farming này lo phần kinh tế.
- **related_guides** [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless) — cơ chế ritual đầy đủ mà lớp revival nhân số con chạy trên đó.
- **competes_with** [Belt Hunting qua Ritual](/farming/0-5-ritual-belt-hunting) — cùng dùng The Head of the King + slot tablet + Map Device, output belt thay vì carry companion.
- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build tiêu thụ con carry làm nguồn damage chính.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — league 0.5 mở Spirit Walker + Tame Beast + Endgame rewrite.
