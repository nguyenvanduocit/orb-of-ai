---
template: templates/farming-template.md
document_type: farming-strategy
title: Fragment Supply Farming
status: draft
created: '2026-06-11'
updated: '2026-07-03'
strategy_tier: A
investment_tier: Low
league: '0.5'
patch: 0.5.3
league_phase: Mid
confidence_level: Medium
---

# Fragment Supply Farming

Phe cung thị trường fragment 0.5: farm content nhả fragment → bán cho boss-rusher đập :wiki-link{url="https://www.poe2wiki.net/wiki/Breachstone"}, gom :wiki-link{url="https://www.poe2wiki.net/wiki/Origin_Cradle"}/:wiki-link{url="https://www.poe2wiki.net/wiki/Origin_Spark"} mở Arbiter of Divinity, hoặc nhồi :wiki-link{url="https://www.poe2wiki.net/wiki/Simulacrum_Splinter"} vào Realmgate. `Tier A · investment Low · ~6,5-8,5 div/h Faded window, ~4-6 div/h baseline (2026-06-11, poe2scout)`. Baseline companion pack Spirit Walker Lv94, 1 Divine = 124 Exalted Orb.

**Nguyên tắc cung side:** chọn nguồn có (giá fragment)/(thời gian farm + cost juice) cao nhất từng thời điểm — re-pick theo sóng mỗi tuần. Δ7d > +50% = sóng cầu, swap vào; Δ7d < -10% = saturated, swap ra.

## Setup

Atlas master swap free/map; full atlas Aldur 300+ point giữ cả hai cụm cùng lúc.

**Session Breach** (3 node trụ, full Breach subtree quanh hub The Monastery of the Keepers):
- **Shape the Chains** → pack size: "Breaches have 15% increased Pack Size" (nhiều mob → nhiều splinter + Wombgift).
- **Moment of Risk** → "Wombgifts have 5% chance to drop one Level higher per Explicit Modifier on the Map / Unstable Breaches spawn 2 additional Rare Monsters when Stabilised". Waystone 6-mod = +30% Wombgift level-up.
- **Breeding Program** → "100% increased chance to find selected Wombgifts" (chọn loại cần cho chuỗi craft Genesis Tree).
- Tablet: 3 :wiki-link{url="https://www.poe2wiki.net/wiki/Breach_Precursor_Tablet"} thường (~5-8 ex/cái, 10 uses ≈ 0,7 ex/map). Same-type stack: "Tablets of the same type may now be used together to increase the amount of the league content that is spawned" → 3 cùng kiểu = 4-5 Breach/map. Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Wraeclast_Besieged"} ([trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Wraeclast%20Besieged%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D)) "Breaches expand to at least 20 metres in radius" nếu budget.

**Session Citadel** (cụm "Powerful Map Boss" main atlas + **Head of the Snake**, Doryani's Science tier 4: "Powerful Map Bosses have 5% chance when defeated to reveal a nearby Citadel"):
- Master **Doryani's Science** — Powerful Boss của Breach map cũng proc reveal Citadel (dual với session Breach).
- Tablet: KHÔNG cắm trong Citadel run (pinnacle area, tablet không áp). Travel giữa Citadel cắm 1 :wiki-link{url="https://www.poe2wiki.net/wiki/Overseer_Precursor_Tablet"} ([trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Overseer%20Tablet%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D)) (Empowers Map Boss) kích Head of the Snake.

**Session Crisis** (Copper Citadel only, không cụm atlas riêng): tablet 3 Tower suffix Waystone Drop Chance. Wiki Crisis_Fragment verbatim: "Increases to waystone drop chance (specifically #% increased Waystone Drop Chance stat only) affect the number of fragments that drop" — waystone phải roll **prefix Waystone Drop**, không phải item rarity/quantity.

**Session Delirium** (hub Withered Willow): 1 Delirium tablet rẻ (~1 ex)/map. Waystone 6-mod chỉ đáng khi dồn splinter push Simulacrum key.

**Build floor** (companion pack Spirit Walker Lv94, EHP ~12,7k, Zekoa carry):
- Breach dễ nhất — Vruun slam tránh được; ~5M boss DPS + 8k EHP. Dưới sàn skip Vruun vẫn gom splinter.
- Citadel: boss mới ~60-90s, boss cũ (Jamanra/Doryani/Geonor) ~90-120s. Hạ trong 2 phút hoặc lỗ thời gian.
- Simulacrum 7-wave khó nhất: wave 5-6 cluster rare buff, companion pack đủ Diff 1, không nổi Diff 2-3. Build zoom (Lightning Spear, Twister) đẩy Diff 2.
- Faded Crisis: Jamanra ~120s/lần Spirit Walker, ~3-4 Faded/h (vs 6-8 zoom).

## Profit math

Snapshot poe2scout **2026-06-11**, 1 Divine = 124 Exalted Orb:

| Fragment | Giá | ~div | Δ7d | vol/ngày |
|---|---|---|---|---|
| Breachstone | 56 ex | 0,45 | +11% | 16,4k |
| Origin Cradle | 362 ex | 2,92 | +12% | 31k |
| Origin Spark | 292 ex | 2,35 | +13% | 33k |
| Faded Crisis | 290 ex | 2,34 | **+237%** | 28k (sóng cầu) |
| Weathered / Ancient Crisis | 99 / 58 ex | — | -20% cả hai | skip, giá trượt |
| Simulacrum Splinter | 1,92 ex | — | +50% | 514k |
| Simulacrum key | 620 ex | 5 | +52% | 9k |

- **Breach:** 4-5 map/h × ~0,5-0,8 Breachstone/map × 0,45 div + rare + Wombgift/Hiveblood → **4-6 div/h**. Chuỗi (release note 0.5.0): "Breachstone splinters turn into a special wombgift when fully stacked. This can be turned in at the Genesis Tree to create a Breachstone". Catalyst 0.5 chỉ craft từ Genesis Tree, không drop từ monster. *Stack size cho special wombgift: patch note không ghi số, cần log — **Low confidence**.* Splinter raw 0,127 ex ratio xấu → phải convert Breachstone.
- **Citadel:** ~0,5-0,8 Citadel mới/h (5% reveal, ~10-15 Powerful Boss/h) × avg 327 ex (~2,64 div) − 30 ex juice ≈ 2,4 div/Citadel + travel ~1-2 div/h → **3-5 div/h**.
- **Crisis Faded:** ~3-4 Jamanra/h × 290 ex − 15-25 ex juice → 810-1080 ex net ≈ **6,5-8,5 div/h** (đỉnh trong cửa sổ sóng 1-2 tuần). Chỉ farm Copper Citadel.
- **Delirium splinter:** ~20-40/map × 6-8 map/h × 1,92 ex → 2-4 div/h raw; push Simulacrum 7-wave (release note: "Completing a Simulacrum will now give you a key to face the new Delirium Pinnacle Boss") net 524 ex/key (~20-25 phút) → **4-6 div/h nếu push key**.
- **Build zoom** (Lightning Spear, Twister): +2× map/h → 12-17 div/h. Optimal tuần này: Crisis Faded trong cửa sổ, sau đó Citadel + Breach dual-session (~5-7 div/h cộng dồn).
- **Bỏ qua:** Kulemak's Invitation 8 ex quá thấp (nhặt thêm nếu chạy [Abyss](/farming/0-5-abyss-ulaman-amanamu-farm)). An Audience with the King (Ritual tribute sacrifice) không list chợ chính — tự đập King lấy Head of the King (167 ex, ~1,35 div) nếu farm Ritual song song.

## Gameplay

Mở session 2-3 giờ theo một nguồn, không nhảy (chuyển tốn ~10-15 phút setup).
- **Breach:** dò Breach, lao vào tâm mở rộng tới bar ~100%, đợi stabilise → Vruun → dập → nhặt Wombgift + Hiveblood + splinter. Cuối map về Realmgate, Genesis Tree: splinter đầy stack gộp special wombgift → turn in lấy Breachstone. Bán bulk 30-50 cuốn qua TFT lot (thấp hơn trade2 ~5-10% nhưng bán vài phút, sit time = 0).
- **Citadel:** chạy map hub liên tục, giết Powerful Map Boss, proc Head of the Snake. Citadel mới → chạy ngay, Cradle/Spark bán raw. Copper Citadel → chạy (Faded sóng). Stone/Iron skip.
- **Crisis (Copper only):** waystone T16 6-mod prefix Waystone Drop Chance ≥+95%, vào Copper Citadel, kill Jamanra, 1 Faded/kill (~3-4/h). Check Δ7d Faded trước session; <+50% swap Citadel ổn định.
- **Delirium:** farm cụm Withered Willow, gom splinter bán bulk. Đủ 50 splinter → push Simulacrum Diff 1 (~5-8 phút) → 1 key 620 ex.

## Failure Modes

- **Giá fragment sụp khi rusher đủ stock.** Faded +237%/7d là cầu spike; pattern league cũ: pinnacle key compress 40-60% trong 2-3 tuần khi pool rusher cạn. Faded về mức Weathered (~99 ex) → session rớt ~6,5-8,5 xuống 3-4 div/h. Breachstone +154%/9 ngày (22→56 ex) cũng sẽ fade. Re-pick nguồn hàng tuần.
- **Head of the Snake proc rate có thể bị chỉnh.** Nerf 5% → 2-3% = Citadel encounter halve, session Citadel rớt 3-5 xuống 1,5-2,5 div/h.
- **Build floor không đều ba session.** Breach thấp nhất (skip Vruun vẫn chạy); Citadel đòi hạ boss 2 phút; Jamanra ~120s Spirit Walker. Build <2M boss DPS chỉ chạy Breach thường.
- **Genesis Tree patch sensitivity.** Chuỗi splinter → special wombgift → Breachstone mới, GGG hay chỉnh 2-3 patch đầu. Splinter drop -30-50% qua hotfix → session Breach rớt 4-6 xuống 2-3 div/h.
- **Cửa sổ Crisis Faded ngắn.** Chạy 5-10 giờ mới break-even setup Copper Citadel. Vào muộn sau khi Faded peak = lỗ tương đối so Citadel ổn định.

## Changelog

### 2026-06-19 (0.5.3)
- Followers of the King in the Mists xuất hiện trong maze Crux of Nothingness, thêm combat khi rẽ qua. Drop rate Head of the King chưa xác nhận thay đổi; verify in-client + re-check giá Head sau vài ngày nếu cung dịch chuyển.

### 2026-06-12
- Soát toàn bài: sửa chuỗi splinter → special wombgift → Breachstone, gỡ claim không nguồn, align số Faded về 6,5-8,5 div/h theo math chain, thêm tablet setup session Delirium.

### 2026-06-11
- Initial draft. Snapshot giá poe2scout cùng ngày. Verbatim mechanic từ release notes 0.5.0.

## Relationships

- **synergizes_with** [Tablet Supply Farming](/farming/0-5-tablet-supply-farm) — cùng phe cung farm-bán cho juicer, khác hàng (fragment vs tablet); đường travel bên này tự gom hàng bên kia.
- **synergizes_with** [Breach Rare Juice Farm](/farming/0-5-breach-rare-juice-farm) — cùng nền Breach mechanic; Breach Rare Juice là tầng cao cấp (200% Delirium fog), cung side này tầng thường investment Low.
- **synergizes_with** [Withered Willow Delirium Farming](/farming/0-5-withered-willow-delirium-farm) — chia cụm map Delirium hub, splinter bulk chồng được với emotion + Raven-Touched Shard jackpot.
- **synergizes_with** [Abyss Ulaman và Amanamu Farm](/farming/0-5-abyss-ulaman-amanamu-farm) — Kulemak's Invitation đi kèm Abyssal boss kill nhưng giá quá thấp để farm chủ động.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — bối cảnh 0.5 endgame, hai-track Pinnacle (Crisis → Arbiter of Ash, Origin → Arbiter of Divinity mới).
- **related** [Delirium Boss Rush Splinter Farming](/farming/0-5-delirium-boss-rush-farm) — biến thể boss rush nhắm fragment pinnacle.
- **related** [Tier list các chiến lược farm currency](/guides/0-5-farming-strategy-tier-list) — nguồn entry/fragment cho boss rush.
