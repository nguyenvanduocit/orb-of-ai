---
template: templates/farming-template.md
document_type: farming-strategy
title: Remnant Runeforging Crafting Loop
status: draft
created: '2026-06-10'
updated: '2026-07-03'
strategy_tier: A
investment_tier: Low
league: '0.5'
patch: 0.5.3
league_phase: Mid
confidence_level: Medium
---

# Remnant Runeforging Crafting Loop

Mỗi area rải 1 :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium_Remnant"} (2-10 slot) → khắc Runic Recipe, đánh thắng wave → nhận item craft + :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium"} từ quái triệu hồi. Nền crafting của cả league (đa số build cần rune + alloy, nguồn duy nhất = Remnant). `Tier A · investment Low · EV/high-slot remnant ~2× pre-patch (0.5.3)`. Ba dòng tiền độc lập: rune/alloy unlock, Perfect/Masterwork Rune liquid, Runeforging flip unique low-level.

## Cơ chế

- 0.5.3 buff Runic Modifier reward trên Monster do Runic Inscription tạo ra **x2** (vài trường hợp cao hơn) → đường cong slot-to-reward dốc gấp đôi pre-patch.
- 0.5.3 mở lại demand: :wiki-link{url="https://www.poe2wiki.net/wiki/Masterwork_Rune"} Transcendent Alloy gắn được lên **Foci + Wand** (cùng hiệu ứng Staff, số thấp hơn), đảo lần gỡ ở 0.5.2. Transcendent Alloy snapshot 19/06 vùng đáy ~49 ex — upside rõ, tốc hồi phụ thuộc adoption Foci/Wand.
- Dòng rune/alloy đắt nhất nhưng variance cao; Perfect/Masterwork Rune (~87-179 ex, ~2.000 viên list) trả tiền đều giữa jackpot; Runeforging flip là kênh riêng không tốn atlas point, chồng lên mọi farm khác.

## Setup

- **Đẩy slot + mở tầng craft:** giá trị Remnant ∝ số slot (2 slot item thường, 7-8 slot chạm tầng rune đắt); slot là thuộc tính spawn tự nhiên, **không ép bằng tablet**. Hai cách: chạy **waystone T15+** (max Remnant/area scale theo Waystone Tier, đỉnh T15+) + chạy nhiều map rồi dồn recipe đắt vào con nhiều slot. Mốc sau 0.5.3: 5 slot → Masterwork Rune ~87 ex; 7-8 slot → Ancient Rune; 1 con 8-10 slot > cả chục con 2-3 slot.
- **Unlock Farrow (bắt buộc trước khi loop sinh tiền):** Act 1 → Verisium Runeforging · Act 2 → 13 Alloy · Act 3 → Unique Verisium Runeforging · Act 4 → 13 Ancient Rune. Thiếu Act 4 = thiếu nguyên dòng đắt nhất.
- **Build floor:** con full-slot = 8-10 wave quái buff chồng → chết người nếu build mỏng. Không kén clear speed nhưng kén survivability trong encounter dồn; build chưa vững thì craft con ít slot trước.

## Profit math

```
EV = m × [P(jackpot)×giá_jackpot + P(alloy/perfect)×giá_tier] + verisium_drop×giá_verisium − cost_recipe − death_risk
```

- **m ≈ 2** (Runic Modifier reward multiplier 0.5.3); cost_recipe ≈ 0. Biên dưới: 5 slot → ~87 ex Masterwork trả công. Biên trên: Astrid's ~20.4 div hoặc Aldur's Legacy ~398 div — vé số kỳ vọng dương.
- Giá poe2scout 19/06 (patch-day, re-check), 1 Divine ≈ 195 ex:

| Nhóm | Giá |
|---|---|
| Alloy | Celestial 2.244 ex (~11.5 div) · Runebinder's 51 ex · Runefather's 10 ex · Transcendent 49 ex (đáy, chờ hồi) |
| Ancient Rune | :wiki-link{url="https://www.poe2wiki.net/wiki/Aldur's_Legacy"} 77.548 ex (~398 div, thanh khoản mỏng) · Astrid's Creativity 3.971 ex (~20.4 div) · Cadigan's Epiphany 1.889 ex (~9.7 div) |
| Perfect / Masterwork | Perfect Iron Rune 179 ex · Masterwork Rune 87 ex (sàn liquid xoay vòng đều) |
| Verisium thô | nhiên liệu Runeforging, không bán; Exceptional Verisium mới đáng list |

- **Runeforging flip:** input unique base <level 55 (vài–vài chục ex), Verisium không đáng, output theo giá unique đã nâng. 0.5.3 giảm 20% defence loss trên non-Unique armour cao level (Runic Ward giữ nguyên, item cũ tự update) → margin nhánh armour flip nới tự nhiên.
- **Rite of Passage KHÔNG thuộc loop này** — :wiki-link{url="https://www.poe2wiki.net/wiki/Rite_of_Passage"} Golden Charm ~27 div chỉ rớt từ quái bị Azmeri spirit nhập, mechanic riêng.

## Gameplay

- Mỗi map: dọn tới Remnant, đọc số slot. Con 2-4 slot: khắc recipe rẻ đang dư, nhả nhanh lấy Verisium + rune tầm thường. Con 7+ slot: chọn recipe đắt nhất build gánh nổi wave, đánh sạch, nhặt item craft.
- Gom Verisium thành stack lớn để Runeforging flip ở hideout (giá trị ở nâng unique, không bán thô).
- Flip ở hideout giữa phiên: lọc chợ unique base-type <level 55 rẻ, mua, nâng bằng Verisium, re-list bản upgrade. Tách khỏi map → chồng lên mọi farm, không tốn slot atlas.

## Failure Modes

- **Supply tăng nhanh hơn demand sau buff x2** — Perfect/Masterwork Rune là tầng nén giá nhanh nhất, có thể rớt 30-50% vài ngày sau patch → bán nhanh trong cửa sổ patch-day, đừng hold. Ancient Rune thanh khoản mỏng ngược lại (đắt nhưng khó bán nhanh) → đăng kiên nhẫn, đừng panic-sell.
- **Build floor** — con full-slot 8-10 wave buff chồng; chết trước wave cuối mất nguyên reward. Buff x2 không đổi điều kiện encounter — chỉ build sống nổi tier cao mới hưởng lãi cao nhất.
- **Knowledge floor Runeforging** — flip chỉ lãi nếu thuộc bảng unique nào đáng nâng; Runeforge nhầm món không ai mua = lỗ cơ hội. Patch defence-loss −20% mở thêm cửa base armour cao level, kiến thức cũ cần update.
- **Transcendent Alloy timing** — hold đầu cơ vùng đáy ~49 ex có upside rõ nhưng không guarantee timing, phụ thuộc adoption Foci/Wand.
- **Variance cao, hợp overlay hơn farm chính** — jackpot variance cao; chạy ít map thì cả phiên có thể chỉ ra tầng liquid → hợp chồng lên farm khác.

## Changelog

### 0.5.3
- Runic Modifier reward x2 (vài trường hợp cao hơn); Transcendent Alloy gắn lại Foci/Wand (đảo 0.5.2); Runeforging non-Unique armour cao level mất ít defence hơn 20% (Runic Ward giữ nguyên, item cũ tự update); Remnant max count scale theo Waystone Tier (đỉnh T15+). Tier B→A. Giá 19/06 (Div ≈ 195 ex): Aldur's Legacy ~398 div, Astrid's ~20.4 div, Cadigan's ~9.7 div, Masterwork ~87 ex, Perfect Iron ~179 ex, Transcendent ~49 ex.

### 0.5.0
- Initial. Cơ chế từ patch note 0.5.0. Đính chính: Rite of Passage drop Azmeri-possession, không thuộc loop Remnant.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — cơ chế đầy đủ của Remnant, Verisium Runeforging, Runic Ward và bốn tầng unlock của Farrow.
- **alternative_to** [Ocean Exploring Grand Expedition Farm](/guides/0-5-ocean-exploring) — biến thể juiced cùng Verisium Remnant, gated qua rumour Ocean với reward-table đọc trước.
- **supports** [Runic Ward Onslaught Loop](/guides/0-5-runic-ward-onslaught-loop) — Verisium farm từ loop nuôi Runeforging gắn Runic Ward cho build defensive.
- **synergizes_with** [Tablet Supply Farming](/farming/0-5-tablet-supply-farm) — chạy chồng làm overlay, Remnant nhặt trên đường clear map travel không xung đột atlas point.
- **related** [Tier list các chiến lược farm currency](/guides/0-5-farming-strategy-tier-list) — loop chạy chồng overlay cho Expedition cluster.
- **related** [Tư duy kiếm currency](/guides/0-5-currency-making-mindset) — ví dụ vai Refiner ở 0.5.
- **related_builds** [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) — Runeforged rare mang Runic Ward, culler không cull được; tránh hoặc verify trước khi juice.
