---
name: farming-strategy
description: POE2 Farming Strategy Analyzer (0.5 Runes of Aldur+). Analyze POE2 economy, determine optimal farming strategies (Remnant + Runic Recipe, Ocean Exploring, Atlas Master juicing, Pinnacle boss farming, Genesis Tree crafting), and generate strategy documents in content/farming/. Use when user asks about POE2 farming, currency generation, what to farm in Runes of Aldur, or wants to compare POE2 farming strategies.
allowed-tools:
  - Bash(bun .claude/skills/farming-strategy/scripts/*:*)
context: inline
---

# POE2 Farming Strategy Analyzer

**TOOL SKILL** — analyze POE2 economy (0.5 Runes of Aldur trở đi), determine optimal farming strategies, và generate comprehensive strategy doc trong `content/farming/`. POE2 version của POE1 `farming-strategy` skill.

Dùng `/farming-strategy` (no `2`) cho POE1. POE2 economy khác POE1 cốt lõi — đừng port strategy POE1 trực tiếp.

## When to Use

- User asks "POE2 nên farm gì?"
- User muốn optimize Exalted/Divine generation cho Runes of Aldur
- User asks về meta farming POE2 0.5
- User asks về Remnant slot count tradeoff (2 vs 6 vs 10 slot)
- User muốn compare Ocean Exploring vs Pinnacle farming vs Atlas Master juicing
- User asks trending POE2 item và why

## POE2 economy fundamentals — khác POE1 cốt lõi

Khi adapt strategy thinking từ POE1, hold giùm những khác biệt sau:

**Không có scarab.** POE1 scarab loop (consume specific scarab → drop other scarab) không tồn tại POE2. POE2 dùng **Tablet** + **Waystone modifier** + **Atlas Passive Tree node** + **Atlas Master selection** để juice content.

**Không có map roll bằng currency.** Waystone (POE2 equivalent của map) phải được **identify trước khi activate** trong Map Device (0.5 change). Modifier của Waystone roll cố định lúc generate. Không có Chisel/Alteration/Scour loop để re-roll map quant như POE1.

**Tablet stack được.** Cùng loại Tablet stack chung tăng lượng league content spawn (đôi khi tăng size encounter đơn, đôi khi tăng số encounter). Mỗi slot tablet trống góp vào lượng random league content. **Mọi slot tablet đầy = chỉ thấy content từ tablet đang dùng** — tức nếu chỉ chuyên farm 1 mechanic, đầy slot bằng tablet đó. Mục đích là không cần allocate Atlas Tree cho league bạn không chạy.

**Currency primary là Exalted, không phải Chaos.** POE2 Exalted Orb = currency baseline (re-roll prefix/suffix), Divine = high-tier (re-roll value). Chaos Orb POE2 hoạt động khác POE1 — giờ có thể dùng lên Tablet. Mọi price snapshot phải quy về Exalted (hoặc Divine cho high-tier item), không Chaos.

**Nguồn giá = poe2scout.** POE2 economy data lấy từ:
- **poe2scout** — giá/volume/Δ7d/history cho currency + uniques (nguồn GIÁ duy nhất). `/poe2scout` lookup tay, `/economy-scan` survey, `/price-forecast` Chronos forecast.
- **trade API** (pathofexile.com/trade2) — current listing, demand indicator — dùng qua skill `/trade` (playwriter page-context)
- **poe-ninja** — CHỈ build/meta distribution (class/skill popularity), KHÔNG phải nguồn giá (xem `/poe-ninja`)

**Crafting endgame là Remnant + Runic Recipe.** Mỗi area Runes of Aldur có Remnant với 2–10 slot. Mỗi Runeshape khắc thêm tăng wave + runic modifier monster. Slot count cao → hiếm hơn → craft được item hiếm hơn. Đây là wave-encounter risk-vs-reward loop — equivalent gần nhất với "scarab loop" của POE1 về mặt input/output economics.

**Catalyst chỉ từ Genesis Tree (Breach).** POE2 0.5 Catalyst không còn rớt từ monster — chỉ Breach mechanic (Genesis Tree, consume Wombgift + Hiveblood) tạo ra. Bất kỳ jewel quality strategy nào đều cần Genesis Tree trong loop.

**Pinnacle boss có 2 phiên bản.** Quest version (deterministic, dễ tiếp cận) + Infinite Farm version (challenge cao hơn, cho key/fragment re-runnable). Strategy farm boss key cần specify phiên bản nào.

**Atlas reset mỗi league + Atlas Tree 300+ node.** Origins of Divinity storyline mới grant Atlas Tree point. Atlas Masters (Doryani's / Hilda's / Jado's) là layer Ascendancy-like cho endgame — chọn 1 active mỗi map cho asymmetric bonus.

## Scripts

> **Status: SCAFFOLD.** Cả 2 script POE2 chưa implement. Trước khi tự viết script, dùng `/poe2scout` (`api.sh list/pairs/item`) + `/economy-scan` đã có sẵn cho price/volume — chúng đã wire poe2scout. Follow TODO trong `scripts/README.md` nếu cần snapshot riêng. Mục đích file này là khai báo command surface + data assumption.

### 1. Market Snapshot (`scripts/market-snapshot.ts` — TODO)

Fetch economy overview từ poe2scout: trending item, input cost (Tablet, Waystone, Remnant slot count), output value (Unique armour/weapon, Alloy, Ancient Rune, Kalguuran Skill/Support), currency rate (Exalted/Divine từ Currency Exchange pairs), và auto-detected meta signal. Reuse `.claude/skills/poe2scout/scripts/api.sh` thay vì gọi API tay.

```bash
# Default: top 20 trending + categorized inputs/outputs + meta signals
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts

# Filter to category
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --category tablet
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --category unique

# JSON output
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --json

# Save snapshot
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --output snapshots/poe2/2026-06-01.json
```

**Output sẽ bao gồm (khi implement):**
- Currency rate (Divine, Exalted, Chaos quy về 1 baseline)
- Top trending POE2 item với price, change %, daily volume
- Farming input theo category (Tablet, Waystone, Remnant rarity tier, Breachstone, Logbook/Ocean Logbook, key fragment cho Pinnacle/Citadel boss)
- Farming output theo category (Unique armour/weapon, Alloy, Ancient Rune, Kalguuran Skill/Support, Catalyst, Liquid Emotion, Wombgift/Hiveblood)
- Meta signal: auto-detect pattern (build guide spike, Remnant slot tier shift, Pinnacle boss key surge, Atlas Master meta shift)

### 2. Strategy Analyzer (`scripts/analyze.ts` — TODO)

Calculate profitability của predefined POE2 farming strategy dùng live market data. Fetch input cost + output value, compute profit/hour + ROI.

```bash
# List all available POE2 strategies
bun .claude/skills/farming-strategy/scripts/analyze.ts --list

# Analyze specific strategy
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy remnant-runic
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy ocean-exploring

# Override maps/hour (personal speed)
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy remnant-runic --maps-per-hour 10

# Compare specific strategies
bun .claude/skills/farming-strategy/scripts/analyze.ts --compare remnant-runic,ocean-exploring,breach-domain

# Compare ALL strategies
bun .claude/skills/farming-strategy/scripts/analyze.ts

# JSON output
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy remnant-runic --json
```

**Output sẽ bao gồm (khi implement):**
- Input cost per map (Tablet stack, Waystone tier, Remnant slot rarity)
- Output value per map (drop từ Remnant wave / Ocean island / Breach domain)
- Self-sustain saving (Tablet drop từ map, Waystone drop chain, Verisium drop từ Remnant)
- Profit/map, profit/hour (Exalted + Divine), ROI %
- Warning (low confidence price, unprofitable, low liquidity)
- Comparison table khi dùng `--compare`

## POE2 0.5 Strategy Archetypes — high-level

Đây là archetype list cho 0.5 Runes of Aldur. Khi league live và market price chạy, mỗi archetype dưới đây nên trở thành một strategy entry trong `analyze.ts` STRATEGIES record và một doc trong `content/farming/`.

**Confidence: MEDIUM cho phân loại archetype** (rút từ patch note 0.5.0); **LOW cho profit estimate** (chưa có market data, sẽ verify khi league live).

### 1. Remnant Runic Recipe (league mechanic chính)

Farm Remnant slot count cao (6–10) trong area Runes of Aldur. Mỗi slot thêm wave + runic modifier monster — risk-vs-reward classic. Verisium currency primary từ chain này. Crafted item từ Runic Recipe (Alloy mod, Ancient Rune, Kalguuran Skill/Support) là output high-tier khi build meta nắm chắc.

- **Input:** Waystone tier cao + Tablet stacking (Runic-affinity nếu có) + Atlas Tree spec cho Remnant density.
- **Output:** Verisium, Alloy, Ancient Rune, Kalguuran Skill/Support, Unique từ Runeforging upgrade.
- **Build requirement:** Tank đủ wave (Remnant monster có runic mod nặng — Runic Ward layer mới là defense option).
- **Why this works:** Đây là *the* league mechanic, juice trực tiếp lên monster đã trong area — không cần secondary content layer.

### 2. Ocean Exploring (Grand Expedition successor)

Logbook đã đổi thành Ocean Exploring. Use logbook hé lộ vùng đại dương với nhiều đảo. Đánh **4 Faction Leader** (Medved, Vorana, Uhtred, Olroth) trên các đảo. Olroth drop key cho Runes of Aldur Pinnacle Boss.

- **Input:** Logbook (Ocean Logbook tier cao) + Atlas Tree spec Expedition/Ocean.
- **Output:** Logbook reward (Expedition Vendor currency để mua item), Faction Leader drop, Olroth Pinnacle key.
- **Build requirement:** Ranged-friendly hoặc movement skill mạnh — Ocean encounter scattered theo đảo.
- **Why this works:** Pinnacle key supply = pinnacle boss demand. Olroth key liquid vì pinnacle boss tied vào challenge + cosmetic.

### 3. Pinnacle Boss Farming (Quest version + Infinite Farm)

Mỗi Pinnacle boss POE2 0.5 có 2 phiên bản: Quest (deterministic, cheaper) và Infinite Farm (re-runnable, challenge cao). Boss roster 0.5: **Arbiter of Divinity** (Endgame storyline mới), **Olroth-key boss** (Runes of Aldur), **Vruun, Marshal of Xesht** (Stabilised Breach), **Breach Pinnacle qua Tul+Esh key**, **Delirium Pinnacle qua Simulacrum**, **Queen in the Mists** (Ritual unlock node), **Arbiter of Ash** (Burning Monolith trong Fortress), Atziri.

- **Input:** Boss key/fragment + character envelope đủ kill consistent.
- **Output:** Unique drop boss-specific, lineage support (POE2 0.5 add ~21 lineage), challenge progress, key supply nếu re-sell.
- **Build requirement:** Boss-killer build (high single-target, defense layered, instance recovery).
- **Why this works:** Boss-specific unique drop pool nhỏ + meta build cần. Lineage Support mới chưa có market floor → early-league spike.

### 4. Breach Domain — Genesis Tree Catalyst farming

Catalyst POE2 0.5 không còn rớt từ monster — chỉ Genesis Tree (Breach) tạo ra. Mỗi build dùng jewel quality = demand Catalyst. Loop: farm Breach (drop Wombgift + Hiveblood + Breachstone Splinter) → Breachstone Splinter full stack thành special Wombgift → submit Genesis Tree → craft Ring/Amulet/Belt + Catalyst.

- **Input:** Atlas Tree Breach spec, Tablet Breach-affinity, Map quanh Monastery of the Keepers hub.
- **Output:** Catalyst (12 loại mới, quality mod cho Jewel), Genesis Tree Ring/Amulet/Belt base type mới, Breachstone (vào Breach Domain), Tul+Esh key (Breach Pinnacle).
- **Build requirement:** AoE clear mạnh — Breach density cao + Stabilised Breach spawn challenge mới.
- **Why this works:** Monopoly supply (Catalyst chỉ từ đây) + perpetual demand (mọi jewel build = Catalyst consumer).

### 5. Delirium Trial of Madness — Timelost Jewel

Stabilised Delirium → Grand Mirror → Trial of Madness atlas mechanic. Map trong Trial bị Delirious 10–200%. Drop Potent Emotion (craft jewel high-tier), Ancient Emotion (craft Timelost Jewel), Liquid Emotion (mod jewel cơ chế greater-essence-like).

- **Input:** Delirium Atlas Tree spec, Trial of Madness key (unlock qua kill cả 2 map boss khi Grand Mirror spawn).
- **Output:** Potent Emotion (3 loại), Ancient Emotion (10 loại), Timelost Jewel, Passive Tree Notable mới (16 instillable), Delirium Pinnacle key qua Simulacrum.
- **Build requirement:** Speed + survivability trong sương Delirious 100%+.
- **Why this works:** Timelost Jewel là item-class mới — meta build mới sẽ scaffold quanh nó early league.

### 6. Ritual — Rite of the Nameless chain

Caer Tarth hub. Audience with the King → Head of the King drop khi kill King in the Mists → trigger Rite of the Nameless (chain 5 map, monster + boss reappear mỗi map, encounter cực khó). Output: Ritual Pinnacle key + Queen in the Mists 3 Corrupted Idol mới (nếu unlock node).

- **Input:** Ritual Atlas Tree spec, King in the Mists kill, 5 map chain pre-selected (modifier ảnh hưởng difficulty + reward).
- **Output:** Ritual reward 100% Unique/Omen, Audience with the King fragment, Pinnacle key, Corrupted Idol (3 loại).
- **Build requirement:** Boss-killer + sustained DPS qua nhiều wave consolidated.
- **Why this works:** Reward screen toàn Unique/Omen — không có waste tribute. Pinnacle key + Corrupted Idol là endgame item-class.

### 7. Atlas Master Juicing (Doryani / Hilda / Jado)

Masters of the Atlas là Ascendancy-like layer cho endgame. 12 node mỗi master, chọn 4 active cùng lúc, quick-select đổi giữa các master trước map. Mỗi master cấp asymmetric bonus định hình build farm.

- **Doryani's Science** — unlock qua corruption nexus, theo lý thuyết juice corruption/Vaal-flavored content.
- **Hilda's Hunting** — unlock qua Hilda's Campsite, theo lý thuyết juice beast/hunter content.
- **Jado's Spycraft** — unlock qua anomaly map, theo lý thuyết juice rare monster/stealth content.

Đây không phải strategy độc lập mà là **multiplier layer** áp lên các archetype khác. Strategy doc nên specify Atlas Master config cho mỗi archetype thay vì viết doc riêng cho Master.

**Confidence: LOW** cho asymmetric bonus per master — patch note chỉ nói "asymmetric, build-defining bonuses", chưa list specific node. Cần verify in-game khi league live.

### 8. Fate of the Vaal — Atziri's Temple Core

Fate of the Vaal đã move vào core 0.5. Atziri's Temple ở Lira Vaal. Energised Crystal + Temple Precursor Tablet (guarantee Vaal Beacon). 4 loại Infuser mới (Armour / Martial Weapon / Wand-Staff-Sceptre / Jewellery). Apply lên item 20%+ Quality.

- **Input:** Energised Crystal (cap 60 default), Atziri's Temple Medallion (cap 6), Atlas Temple Tree allocate.
- **Output:** Vaal-tier corrupted item, Atziri's Temple Medallion drop, Atziri's Splendour / The Covenant / Atziri's Rule unique (rebalanced 0.5).
- **Build requirement:** Boss-killer Atziri-tier.
- **Why this works:** Vaal Infuser apply lên 20% quality item = bridge crafting layer mới. Demand từ everyone-craft-once.

### 9. Abyss Depths Boss

Abyss vết nứt lớn trên atlas. Hoàn thành đóng vết → guaranteed Abyssal Depths với boss. Kulemak's Invitation always allocate cho chủ map.

- **Input:** Atlas Tree Abyss spec, map có Abyss content rớt (chest modifier cũng apply tăng cơ hội Abyssal Depths).
- **Output:** Abyss Jewel, Abyss Omen (level 65+ area), Kulemak's drop, Abyssal Depths boss unique.
- **Build requirement:** Single-target cho Abyssal Depths boss.
- **Why this works:** Stable mid-tier income — Abyss Jewel meta-relevant.

### 10. Tablet Mass Stacking (juicing layer)

Không phải strategy độc lập — đây là **economy lens**. Cùng-loại Tablet stack tăng league content spawn. Mọi slot tablet đầy = pure focus content (no random). Mua bulk Tablet cùng loại cho tier mid-league khi giá Tablet drop sau peak demand.

- **Input:** Tablet bulk (10–20 cùng loại), Map Device slot.
- **Output:** Massive concentration của 1 mechanic per map.
- **Build requirement:** Build phù hợp với mechanic chosen (vd Delirium tank cho Delirium tablet stack).
- **Why this works:** Liquidity arbitrage — mass Tablet rẻ nếu mua khi sale window, juice density up 5–10x.

## Methodology

### Core Formula
```
Profit = (Output Value × Drop Rate × Speed) - Input Cost
```

### Analysis Framework

1. **Input của strategy là gì?** Tablet, Waystone tier, Remnant slot, Atlas tree spec, Atlas Master selection — check price với `market-snapshot.ts`.
2. **Output là gì?** Direct drop, secondary currency, key/fragment — check value.
3. **Economic loop:** Self-sustain (Waystone chain, Tablet drop)? Creates supply (Catalyst monopoly)? Consumes input creating demand (Pinnacle key)?
4. **Build meta:** Top build POE2 0.5 cần gì? Content nào generate item đó?
5. **Liquidity:** Daily sale cao = dễ sell. POE2 trade thinner POE1 nên liquidity matter hơn.

### Workflow

```bash
# Step 1: Market overview
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --json --output snapshots/poe2/today.json

# Step 2: Compare strategies với live price
bun .claude/skills/farming-strategy/scripts/analyze.ts

# Step 3: Deep dive best strategy
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy <best> --maps-per-hour <your-speed>

# Step 4: Research community
# - YouTube transcript (yt-dlp) — POE2 creator: Ben_, Mathil, Goratha (POE2 content), Empyriangaming, Fubgun (POE2 league)
# - Reddit r/PathOfExile2 + r/PathOfExile2Builds
# - poe.ninja/poe2 build data (/poe-ninja skill — đã support POE2)

# Step 5: Generate strategy doc
# Tạo trong content/farming/ với template templates/farming-template.md
# Naming: 0-5-<strategy-name>.md (vd 0-5-remnant-runic-recipe.md)
```

## Output Location

**Generated docs go in:** `content/farming/`
**Template:** `templates/farming-template.md` (tạo file mới theo template tương ứng trong `templates/`)
**Naming:** `0-5-<strategy-name>.md` cho POE2 0.5 (vd `0-5-remnant-runic-recipe.md`, `0-5-ocean-exploring.md`)
**Frontmatter `game: poe2`** + `league: 'Runes of Aldur'` + `patch: 0.5.0`

## Research Sources

### YouTube Channels (POE2-active)
- **Ben_**: POE2 endgame, mapping efficiency
- **Mathil**: build experiment, often farm-context
- **Goratha**: POE2 specific coverage
- **Empyriangaming**: meta + group play (POE2 content khi league active)
- **Fubgun**: POE2 league start + efficiency
- **DarthMicrotransaction**: POE2 build + endgame

### Market Data
- **poe2scout** — nguồn GIÁ duy nhất: price + volume + Δ7d + history cho currency/uniques (via `/poe2scout`, `/economy-scan`, `/price-forecast`)
- **Trade2 API** — current listing POE2 (via `/trade` skill, playwriter page-context)
- **poe-ninja** — CHỈ build/meta distribution, KHÔNG phải nguồn giá

### Community
- r/PathOfExile2 — general discussion
- r/PathOfExile2Builds — build meta trend

## Anti-Patterns

1. **Đừng** port POE1 strategy 1:1. POE2 không có scarab/map roll/voidstone — entire input layer khác.
2. **Đừng** chỉ nhìn trending item mà không hiểu WHY (Atlas Master meta shift? Build guide spike? Remnant slot supply crunch?).
3. **Đừng** ignore investment cost (Remnant 10-slot rất hiếm — input scarcity ≠ profit nếu output không liquid).
4. **Đừng** assume strategy scale tuyến tính (Atlas Master node giới hạn 4 active — switch overhead).
5. **Đừng** quên build requirement (Remnant wave high-tier không phải build nào cũng tank được).
6. **Đừng** ignore liquidity (POE2 market thinner POE1; high-tier unique có thể stuck 1-2 ngày).
7. **Đừng** chase yesterday's meta (Atlas Master meta shift + Pinnacle boss key supply biến động nhanh).
8. **Đừng** confuse Chaos Orb POE2 với Chaos Orb POE1 — hành vi khác. Quy mọi price về Exalted.
9. **Đừng** confuse `poewiki.net` với `poe2wiki.net`. Mọi wiki-link trong farming doc poe2 dùng `poe2wiki.net`.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | This documentation |
| `scripts/README.md` | TODO list cho data layer wire-up (market-snapshot.ts + analyze.ts cho POE2) |

---

**Version**: 0.1.0 (scaffold pre-league)
**Last Updated**: 2026-05-24
**League**: Runes of Aldur (POE2 0.5.0) — launch ~29/05/2026
**Status**: SCAFFOLD — script chưa implement, archetype list từ patch note 0.5.0
