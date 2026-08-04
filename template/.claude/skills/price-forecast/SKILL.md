---
skill_name: price-forecast
description: "Predict POE2 item/currency prices using Chronos-2 ML model. Collect price history from poe2scout.com (single price source), forecast 7-day trends, output BUY/SELL/HOLD recommendations. Use when user asks about POE2 price predictions, investment advice, market trends, or 'should I buy/sell X in POE2'."
version: 1.0.0
tags: [prices, forecast, ml, chronos, economy, investment, poe2]
---

# POE2 Price Forecaster (Chronos-2)

Predict POE2 item + currency price movements using Amazon Chronos-2 time-series model. Fetches history từ poe2scout.com (nguồn giá duy nhất của workspace), runs ML forecast, gives actionable BUY/SELL/HOLD recommendations.

**Currency unit:** POE2 dùng **Exalted Orb** làm trade default thay vì Chaos Orb của POE1. Tất cả price baseline trong skill này là Exalted.

## When to Use

- User asks "should I buy X in POE2?", "will X go up?", "POE2 price prediction"
- User asks về investment opportunities trong POE2 economy
- User wants best time to buy/sell expensive POE2 items
- User asks "giá X POE2 có tăng không?", "POE2 nên mua gì?", "đầu tư POE2"

## Scripts

### 1. Collect History (`collect.py`)

Fetches POE2 price history từ poe2scout.com — currency + uniques, cả 24 category, full-league daily OHLC (DailyStatsHistory). Resolve poe2scout slug tự động từ league name. Run first to build training data.

```bash
# Collect all POE2 leagues
python .claude/skills/price-forecast/scripts/collect.py

# Specific league only
python .claude/skills/price-forecast/scripts/collect.py --leagues "Runes of Aldur"

# Specific items only
python .claude/skills/price-forecast/scripts/collect.py --items "Divine Orb,Mageblood"
```

Output: `data/price-history/master.json` + `daily/<date>.json` snapshots.

### 2. Forecast (`forecast.py`)

Reads collected `master.json`, forecasts ALL items. Uses Chronos-2 nếu available, fallback to multiplicative trend analysis. Results sorted by confidence (signal-to-noise ratio).

```bash
# All items ≥5ex với ≥5 days history
python .claude/skills/price-forecast/scripts/forecast.py

# Top 20 movers
python .claude/skills/price-forecast/scripts/forecast.py --top 20

# Filter by item type
python .claude/skills/price-forecast/scripts/forecast.py --type Currency
python .claude/skills/price-forecast/scripts/forecast.py --type UniqueWeapon,UniqueArmour

# Specific items only
python .claude/skills/price-forecast/scripts/forecast.py --items "Divine Orb,The Auspex"

# Higher minimum price threshold (exalted)
python .claude/skills/price-forecast/scripts/forecast.py --min-price 50

# Custom prediction window
python .claude/skills/price-forecast/scripts/forecast.py --days 14

# JSON output (for piping)
python .claude/skills/price-forecast/scripts/forecast.py --json
```

## Output Format

```
       Item                          Now    Predict   Change                  Range
------------------------------------------------------------------------------------------
  BUY  The Auspex                   170ex      239ex   +40.5% (222—256ex)
  SELL Astramentis                 5,191ex   3,027ex   -41.7% (2,663—3,390ex)
  HOLD Divine Orb                   269ex      282ex    +5.0% (268—296ex)

--- Summary: 17 BUY | 13 SELL | 5 HOLD ---
```

**Note giá unit "ex" thay vì "c"** — POE2 economy denominate Exalted.

## Item Coverage (POE2)

Collect mọi item ≥ 5 ex (flippable threshold) trên **cả 24 category** poe2scout expose — `type` field = category Label:

- **Currency categories (17):** `Currency`, `Fragments`, `Runes`, `Essences`, `Soul Cores`, `Expedition Coinage & Artifacts`, `Ritual Omens`, `Reliquary Keys`, `Breach`, `Abyssal Bones`, `Uncut Gems`, `Lineage Support Gems`, `Delirium`, `Incursion`, `Idols`, `Verisium`, `Vaal`
- **Unique categories (7):** `Weapons`, `Armour`, `Accessories`, `Jewels`, `Flasks`, `Maps`, `Sanctum Research`

Currency dùng volume-weighted price từ Currency Exchange (volume thật); uniques dùng floor-ask securable. Cả hai denominated theo Exalted (BaseCurrencyApiId="exalted").

Use `--type`, `--items`, `--min-price`, `--top` to filter (vd `--type Currency`, `--type Weapons,Armour`).

## Collect Features

- **Full-league history** — mỗi item ≥5ex pull DailyStatsHistory (tới 365d), không phải 7d sparkline; date từ league start tới hôm nay
- **Auto-select leagues** — only active POE2 leagues + ended without data; poe2scout slug resolve tự động từ league name (Value→ShortName)
- **Merge & dedup** — gộp data cũ + mới, xóa trùng theo (league, item, variant, type, date); NEW thắng collision
- **Polite pacing** — 0.12s giữa mỗi history call (poe2scout rate-limit bulk pull)
- `--force` to keep ONLY this crawl (drop old history for re-fetched items)

## Model Details (giống POE1)

- **Model:** Amazon Chronos-2 (time-series foundation model)
- **Device:** Apple MPS (Metal Performance Shaders)
- **Covariates:** league_day, listings count
- **Quantiles:** 10% (pessimistic), 50% (median), 90% (optimistic)
- **Cross-league learning** — prepends previous POE2 league data (Vaal, Dawn of the Hunt) cho better patterns

**POE2 caveat:** league history còn ngắn (POE2 EA mới ~12 tháng), ít data so với POE1. Forecast confidence thấp hơn POE1 trong early phase mỗi league mới.

## Dependencies

```bash
pip install pandas numpy
# For ML forecast (optional, has fallback):
pip install torch chronos-forecasting
```

## Workflow

1. **Collect** history first if no recent data: `python .claude/skills/price-forecast/scripts/collect.py`
2. **Forecast**: `python .claude/skills/price-forecast/scripts/forecast.py`
3. Interpret results — BUY items predicted to rise >5%, SELL items predicted to drop >5%
4. Cross-reference với `/farming-strategy` cho farming-relevant items
5. Check `/trade` cho actual current listings trước khi acting

## POE2 League Timeline

| League | Start | End | Slug |
|--------|-------|-----|------|
| Runes of Aldur (0.5) | 2026-05-29 *(launch)* | TBD | `Runes of Aldur` |
| Vaal (0.4) | 2026-01-?? | 2026-05-29 *(transition)* | `Vaal` |
| Dawn of the Hunt (0.3) | 2025-09-?? | 2026-01-?? | `Dawn of the Hunt` |
| Early Access (0.1-0.2) | 2024-12-06 | 2025-09-?? | `Early Access` *(may not exist on poe2scout)* |

**Khi league mới launch:** adjust `LEAGUES` table trong `scripts/leagues.py` (single source — collect.py + forecast.py import từ đó; chỉ cần `name` + `start` đúng, collect.py tự resolve poe2scout slug). Verify poe2scout có league bằng:
```bash
curl -sL "https://api.poe2scout.com/poe2/Leagues" | python3 -c "import sys,json;[print(l['Value'],l['ShortName'],l.get('IsCurrent')) for l in json.load(sys.stdin)]"
```

## Notes

- poe2scout cho full-league daily history (tới 365d cap), không bị giới hạn 7d như sparkline cũ — training window dày hơn
- Predictions probabilistic — use the range (low—high) not just median
- Early league data (<7 days) produces unreliable forecasts
- Chronos-2 first run downloads ~500MB model weights to `tmp/.hf_cache/`
- POE2 economy volatile hơn POE1 (mỗi 0.X patch reshape meta drastically) — recompute trends sau mỗi patch note
- **0.5 specific:** Runes of Aldur introduces 13 Alloy + 13 Ancient Rune currency types mới — first 7 days, prices wild oscillate; chỉ trust forecast sau day 14

## Boundary vs poe2scout

Cùng nguồn data (poe2scout.com), khác lớp. `price-forecast` = pipeline tự động: collect.py kéo full-league history về `data/price-history/master.json` rồi Chronos-2 dự báo 7d (feed site badge index + BUY/SELL/HOLD). `/poe2scout` = lookup tay một item lẻ (catalog + OHLC + pairs) khi cần spot-check ngay. Forecast nói "giá sẽ đi đâu", poe2scout nói "giá đang là bao nhiêu". poe2scout là nguồn GIÁ duy nhất của workspace — poe.ninja chỉ còn cho build/meta.
