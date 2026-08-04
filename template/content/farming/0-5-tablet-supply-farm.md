---
template: templates/farming-template.md
document_type: farming-strategy
title: Tablet Supply Farming
status: draft
created: '2026-06-14'
updated: '2026-07-03'
strategy_tier: B
investment_tier: Low
league: '0.5'
patch: 0.5.3
league_phase: Mid
confidence_level: Medium
---

# Tablet Supply Farming

Cắm 3 :wiki-link{url="https://www.poe2wiki.net/wiki/Irradiated_Tablet"} rồi nhặt tablet của mechanic KHÔNG cắm để bán cho juicer. `Tier B · investment Low · zoom ~18-24 div/h, companion pack ~12-16 div/h (2026-06-14)`. Vốn sát không (irradiated ~20 ex × 3, hoàn vốn 1-2 map). Giá tablet đã crash sau khi viral — con số 45 div/h của video là Rakiata luck + giá cũ, không phải baseline.

## Cơ chế

- Patch 0.5.0: "Each empty tablet slot contributes to the amount of random non-tablet spawned league content in the area." Cắm đủ tablet 1 mechanic → chỉ ra mechanic đó, tablet của nó cạn. Đảo: cắm irradiated (effect = +1 Monster Level, là **map mechanic** không phải league encounter) → 3 slot vẫn "trống" về phía league content → map gieo Breach/Ritual/Abyss ngẫu nhiên, rớt tablet full rate. Thực đo: **~2 tablet/map**, map đông 5-10.
- Tiền không chỉ từ tablet. "Waystone-coded" (tablet, Origin Cradle/Spark, Breachlord Sac) đều nhận buff từ "increased Quantity of Waystones found in Map" + "Monsters have increased Effectiveness" trên tablet → 3 dòng chồng: bán tablet, gom fragment (Citadel/Breachstone rush), loot thô. Dòng to nhất là **fragment (~8 div/h đo trên 6h)**, không phải tablet.
- Abyss/Ritual/Breach bán được; Irradiated/Temple/Delirium ai cũng dư gần không bán; Expedition không có chợ (bỏ khỏi tính).

## Setup

- **Atlas — điều kiện cứng:** **Eons of Contamination** mở "Irradiated Precursor Tablets may now be found" ở area Lv70+ (chưa lấy phải mua toàn bộ irradiated).
- **4 node nhân output:** **Propagating Secrets** ("8% increased Quantity of Tablets found for each Tablet affecting Map area" → 3 tablet = +24%) · **Specialised Seeker** ("Tablets also provide 10% increased Rarity of Items Dropped to Monsters from their mechanic") · **Curiously Durable Stone** (Lv75+: "8% chance to not consume Tablet uses" → cứ 12-13 map mới tốn 10 charge) · **Partial Translation** hoặc **Reverse Transcription** ("Your Tablets may be upgraded to Rare and have +1 Maximum Modifier" — cần để Regal tablet lên Rare 4 mod, Abyss god-roll 30-40 div vs vài div).
- Ngoài nhánh tablet: fill Breach/Abyss/Delirium subtree (gặp nhiều trên travel), Ritual chỉ đủ clear altar. **Forest Mastery** vành ngoài "50% increased chance to find Lineage Supports in Forest Areas" — cửa jackpot Rakiata's Flow (~112 div, vol 632, 2026-06-14) không tốn thêm.
- **Masters — Jado's Spycraft** chính: **Long Days** (T3, "20% more chance of Random Extra Content" — nguồn tablet chính) · **Partial Translations** (T3, "20% chance double effect Explicit Modifiers on Tablets") · **Unforeseen Threats** (T2, "5% chance on completing Maps for a nearby Anomaly Map to be revealed" — nguồn Lineage) · **Ancient Activations** (T4, "Powerful Map Bosses have 5% chance to add Ancient Modifiers to a nearby Map"). Khi rẽ đập 2 Citadel/pinnacle cân nhắc **Untold Histories** (T4: 35% chance Lineage + 50% chance rớt Lineage ở pinnacle, đổi boss nhận ít hơn 35% damage — build chậm tránh).
- **Tablets:** cắm **3 Irradiated Tablet**, mỗi cuốn 2 mod: **"increased Quantity of Waystones found in Map"** (of the Cartographer, 30-50%) + **"Monsters have increased Effectiveness"** (Challenger's, 7-11%). ~20 ex/cuốn × 3 — [trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Irradiated%20Tablet%22%2C%22stats%22%3A%5B%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22id%22%3A%22explicit.stat_2777224821%22%2C%22value%22%3A%7B%22min%22%3A1%7D%7D%5D%7D%5D%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D), chia 10 charge ≈ 6 ex/map (trước Curiously Durable Stone). City biome mở slot 4 qua Industrial Improvements. **Đừng cắm tablet của mechanic muốn nhặt** (cắm Breach tablet = tự giết nguồn Breach tablet — bẫy phổ biến nhất). Waystone travel roll 6 mod; corrupt qua Jado đẩy 7-9 mod; ưu tiên "increased Quantity of Waystones" (cùng nhóm coded). Biome rừng cho Forest Mastery, mountain cho tỉ lệ tablet tốt; 2 Citadel mới max-juice T15-T16.
- **Build floor** (clear-speed-bound, không boss-rush): clear speed là ngưỡng thật (zoom quét Breach/Abyss/Deli vài giây → 38-45 div/h; companion pack chậm → 12-16 div/h) · boots ≥30% MS + Quicksilver/Onslaught · boss DPS đủ xé 2 Citadel (~60-90s) + Breachlord ở Twisted Domain · EHP ≥8-10k (map đông mechanic juiced nguy hiểm hơn rush boss đơn).

## Profit math

```
profit/h = fragment (~8) + loot thô (~7) + tablet resale (~4-5) − irradiated (<1) + Lineage upside thưa
```

- Giá live trade 2026-06-14, poe2scout cùng ngày, 1 div = 136 ex.

| Dòng | Chi tiết |
|---|---|
| 1 tablet resale | ~2 tablet/map × ~15-20 ex → 0.22-0.29 div/map → **~4-5 div/h** (15 map/h). Abyss ~30-40 ex, Ritual ~10-20 ex, Breach 7-10 ex; god-roll 4 mod 0 listing (không tính baseline). Cost ~6 ex/map |
| 2 fragment (to nhất) | Breachlord Sac 649 ex (~4.8 div, +32% 7d) · Origin Cradle ~433 ex (~3.2 div, +48%) · Origin Spark 276 ex (~2.0 div, +30%) · Head of the King 167 ex (~1.2 div) từ Crux of Nothingness. Đo 6h: **~8 div/h** |
| 3 loot thô | raw currency + Deli liquid + Simulacrum splinter + logbook. Đo 6h: ~25 div raw + 9 div Deli + 9 div logbook → **~7 div/h** (scale theo clear speed) |
| 4 Lineage jackpot | Rakiata's Flow ~112 div (vol 632). Cực hiếm — 2 cuốn/run = +225 div, cũng là thứ thổi số video lên 45 div/h |

- Kết: build zoom **~18-24 div/h steady-state**; companion pack Spirit Walker (ThaoCamVienSaiGon, Lv95) **~12-16 div/h**.

## Gameplay

- Cắm 3 irradiated (4 nếu city map) + waystone corrupt vào Map Device, travel một hướng cố định nhắm point of interest gần nhất (Citadel mới, Anomaly map, Tower). Lao về boss/POI nhưng **clear mọi mechanic ngẫu nhiên trên đường** — chỗ tiền ra.
- Quy tắc từng mechanic: Breach hoàn thành hand mới rớt tablet (~1/Breach, gom :wiki-link{url="https://www.poe2wiki.net/wiki/Breach_Splinter"}) · Ritual chỉ clear mob quanh altar, đừng chạy reward · Abyss chạy hết + mở pit (rare Amanamu dùng pull-out tech kéo ra khỏi khói rồi giết — GGG xác nhận tăng tỉ lệ Omen of Light) · Temple clear altar rồi mở chest (chỉ chest nhả Temple tablet) · Delirium chạy hết fog rồi kết counter · Expedition remnant ngon thì làm, logbook >1 div/cuốn.
- Tới POI: 2 Citadel nhả Origin Cradle/Spark; xé Breachstone lấy Breachlord Sac. Cuối session Regal tablet base ngon lên Rare 4 mod trước khi list.

## Failure Modes

- **Giá tablet đã crash** — Breach 7-10 ex (không phải div), Abyss cao nhất 30-40 ex, god-roll 4 mod 0 listing. Cung vẫn lãi vì cost gần không, nhưng dòng tablet teo về 4-5 div/h. Đừng vào vì con số div/h của video.
- **Market saturation theo loại** — Irradiated/Temple/Delirium ai cũng dư, gần không bán. Chỉ Breach/Ritual/Abyss bán; meta co về ít mechanic thì cầu các loại còn lại sụp.
- **Build floor** — companion pack Spirit Walker 12-16 div/h vì clear mechanic đông chậm (mất ~40% income dòng 1+3 so zoom). Strat thưởng clear speed gấp đôi; build chậm cân nhắc strat boss-centric.
- **Roll hiếm gate revenue tablet** — tablet 4 mod đắt cần Partial Translation/Reverse Transcription + Regal trúng combo hiếm; farm 100 cuốn mà đa số 2-mod junk thì revenue dòng 1 thấp.
- **Patch nerf risk** — GGG có thể chỉnh empty-slot/inverse-drop ("very aware ... will have to be adjusted"). Nếu tablet rớt đều bất kể slot, hoặc tách khỏi nhóm waystone-coded, engine strat gãy.

## Changelog

### 0.5.3 (2026-06-19)
- Followers of the King in the Mists xuất hiện trong maze Crux of Nothingness; cung Head of the King có thể tăng, re-check giá trước khi xếp vào income model.

### 2026-06-14
- Initial draft. Verify mechanic từ patch note 0.5.0 (empty-slot rule) + poedb (Eons of Contamination, Propagating Secrets, Jado nodes). Giá live trade sửa claim video ("tablet 16-40 div" → Breach 7-10 ex, Abyss 30-40 ex, god-roll 0 listing). Tier A→B, income 45→18-24 div/h zoom, Lineage jackpot tách thành variance. Tablet Expedition bỏ vì không giao dịch.

## Relationships

- **synergizes_with** [Withered Willow Delirium Farming](/farming/0-5-withered-willow-delirium-farm) — Grand Mirror từ subtree Delirium nhân đôi effect mọi tablet đang cắm, gồm irradiated — mechanic ngẫu nhiên dày gấp đôi, tablet rớt nhiều hơn.
- **synergizes_with** [Fragment Supply Farming](/farming/0-5-fragment-supply-farm) — cùng mặt cung farm-bán cho juicer; đường travel tablet farm tự gom fragment, đường fragment farm tự gom tablet.
- **synergizes_with** [Ocean Exploring Grand Expedition Farm](/guides/0-5-ocean-exploring) — Expedition remnant ăn proc khi clear map travel, không xung đột atlas point.
- **related** [Remnant và Runeforging Profit Loop](/farming/0-5-remnant-runeforging-profit-loop) — Remnant nhặt trên đường clear là overlay không xung đột.
- **related_guides** [Endgame mapping sustain](/guides/0-5-endgame-mapping-sustain) — cơ chế tablet slot theo số mod waystone và Powerful Map Boss rớt waystone.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — bối cảnh 0.5 endgame overhaul, tablet rework empty-slot và hai Citadel mới.
- **related** [Tier list các chiến lược farm currency](/guides/0-5-farming-strategy-tier-list) — deep dive Tablets rush.
- **synergizes_with** [Ritual Tablet Supply Crafting](/farming/0-5-ritual-tablet-supply-craft) — engine cày ra ritual tablet thô (cách B): 3 Irradiated + atlas tablet node + empty-slot rule; doc này craft đầu ra thành cuốn bán div.
