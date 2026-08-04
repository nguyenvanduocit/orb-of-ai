---
template: templates/farming-template.md
document_type: farming-strategy
title: Raven Boss Rush Farming
status: draft
created: '2026-06-23'
updated: '2026-07-03'
strategy_tier: B
investment_tier: Medium
league: '0.5'
patch: 0.5.3
league_phase: Mid
confidence_level: Medium
---

# Raven Boss Rush Farming

Spam thẳng boss Raven (Delirium pinnacle boss) mở bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Raven's_Reflection"} tại Map Device → săn :wiki-link{url="https://www.poe2wiki.net/wiki/Raven-Touched_Shard"} ~69 div/cái (poe2scout 2026-06-23). Không juice map, không tablet, chỉ mua vé + đánh ~100 lần trong ~3h. `Tier B · investment Medium · ~40 div/h (2026-06-23)` — biên mỏng vì vé vào tăng >2× so tuần trước.

## Cơ chế

- 95% lợi nhuận nằm ở Raven-Touched Shard — currency-class drop **~2.5-3%/kill**, bất kể build (không node/gear nào tăng tỉ lệ). Shard gắn property **Raven-Touched** lên helmet bất kỳ → instill 1 Passive Tree Notable kiểu anoint (vốn chỉ amulet làm được) → mọi build endgame thèm.
- Shard: ~827 ex (01/06) → ~16.940 ex (10/06) → **~24.878 ex** (2026-06-23, 1 div = 358.7 ex).
- Tier B vì vé vào tăng ~0.44 div → đúng **1 div**/cái mà shard không tăng kịp → EV/vé cố định, chất lượng build chỉ đổi thành run/giờ + tỉ lệ không mất run vì death.

## Setup

- **Atlas tree:** boss rush không cần subtree Delirium/density (không có map juice). Điểm duy nhất đáng: master **Doryani → Head of the Snake** (Doryani's Science Tier 4): **Pinnacle Bosses có 1 Revive** (giá trị thật — chết hụt không phá run, không reset companion pack, không mất 1 div vé) + **Pinnacle Bosses 25% chance rớt thêm 1 Unique** (pool = :wiki-link{url="https://www.poe2wiki.net/wiki/Horror's_Flight"} + :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock"}, gần vô giá trị → chỉ thêm staff bán 5 ex). Dòng "Powerful Map Bosses 5% reveal Citadel" vô dụng (không chạy map boss). Thêm node revival phụ nếu dư point.
- **Map Device & vé:** vé = Raven's Reflection, mua thẳng từ :wiki-link{url="https://www.poe2wiki.net/wiki/Currency_Exchange"} (không farm, không craft). Hiện **1 reflection = 1 div** (2026-06-23) → set 100 run = 100 div, mua sỉ cả set trước khi bắt đầu. **Ctrl + left-click** node Withered Willow trong Map Device để teleport nhanh.
- **Build floor:** single-target hạ boss **1m20s-2m** (chậm hơn = DPS mất thẳng vào div/h); phòng thủ nuốt được Lightning Barrage (nhiều projectile tầm gần ở pha burst pinnacle). Build companion clear-pack thường yếu đúng chỗ single-target + companion dễ chết theo AoE + no-weapon-swap phải cẩn thận (swap despawn pack). Test 10 vé (~10 div): đo time/fight, số death/despawn, companion có bám boss di chuyển không → <2 phút & 0-1 death/10 thì commit; lê thê hoặc 3-4 death thì build chưa hợp.

## Profit math

```
net/set = entry + shard_EV + side_EV − entry_cost ; EV/set 100 run (2026-06-23)
```

- `entry 100 div + shard_EV 100×3%×69 div = 207 div + side 14 div → net ~121 div / 3h ≈ 40 div/h`.
- Side loot (tiếng ồn): Horror's Flight ~2 ex/cái (~8 cái/set bán unidentified) · The Raven's Flock ~5 ex/cái (khó bán) · :wiki-link{url="https://www.poe2wiki.net/wiki/Split_Personality"} sàn **20 ex** (~0.06 div, 2.000 listing, −69% 7d) · + raw divine → ~14 div/set.
- Break-even cần **~1.3 shard/set**; đúng 1 shard → **lỗ ~17 div**; 0 shard (xác suất ~5%) → **lỗ ~86 div** → ~1/5 set hòa hoặc lỗ. Vé 0.44 div cũ "khó mà lỗ" → reflection 1:1 đã lật ngược tính an toàn.

## Gameplay

- 1 run: activate reflection ở Map Device → vào park → qua cutscene → hạ boss. Nhặt shard + raw divine + jewel; bán bracer unidentified; bỏ/vendor staff + gem.
- Boss chết → thoát willow, re-enter con kế. Cả sort loot + reset ~1.5-2 phút/run → 100 run ~3h.
- Chạy đủ **100 run** — drop ~3% nên chuỗi 20-30 run không shard là bình thường, sample nhỏ bị variance nuốt.

## Failure Modes

- **Entry-price creep** — vé là input duy nhất, đang tăng nhanh. Tại 1 div EV còn ~40 div/h; quá ~1.3 div thì hết lời → quote giá reflection live trước khi mua set.
- **Dry streak lỗ thật** — ~20% set 100 run hòa hoặc lỗ; set 0 shard mất ~86 div. Chạy dưới 100 run nhân variance lên.
- **Build floor single-target** — boss rush bắt hạ pinnacle <2 phút + sống qua Lightning Barrage. Build companion clear-pack yếu chỗ này → chậm/chết vừa giảm run/giờ vừa đốt vé.
- **Shard giá volatile** — 06-20 ~17k ex, 06-23 ~24.8k ex, swing ±30%/ngày. Set kéo 3h có thể bán shard lúc giá đang tụt.
- **Patch nerf** — farm dựa vào Raven-Touched còn được mọi build thèm; patch hạ giá trị anoint-trên-helmet hoặc tăng cung shard → cầu sụp, mất nền.

## Changelog

### 0.5.3 (2026-06-23)
- Initial draft. Shard ~69 div, reflection 1:1 (1 div). EV ~40 div/h; biên mỏng do vé tăng từ ~0.44 div — còn +EV nhưng không còn an toàn.

## Relationships

- **alternative_to** [Withered Willow Delirium Farming](/farming/0-5-withered-willow-delirium-farm) — cùng boss Raven và cùng Raven-Touched Shard, nhưng hub map-farm vào gần bằng không và không có set nào lỗ, an toàn hơn khi reflection đắt.
- **related_guides** [Delirium và Trial of Madness](/guides/0-5-delirium-trial-of-madness) — cơ chế Delirium và pinnacle boss nền cho cả hai farm.
- **related_guides** [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation) — The Raven's Flock là minion staff scale spirit reservation, bối cảnh cho vì sao nó kén người mua.
