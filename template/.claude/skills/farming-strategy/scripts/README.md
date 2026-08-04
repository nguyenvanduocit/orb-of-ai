# farming-strategy/scripts — TODO

Script POE2 chưa implement. Đây là plan + assumption để khi POE2 0.5 launch (~29/05/2026) và market data stable, agent/user có thể wire data layer trong vài giờ.

## Why scaffold instead of port?

POE1 version (`.claude/skills/farming-strategy/scripts/`) dùng `poe-watch` API qua import:

```ts
import { fetchAPI, getCurrentLeague, type ItemData } from "../poe-watch/poe-watch";
```

**poe.watch hiện chỉ support POE1.** Port 1:1 sẽ fail ngay import. POE2 price source là **poe2scout** (`.claude/skills/poe2scout/scripts/api.sh`) + **trade API** cho spot-check — schema, endpoint, rate limit khác. poe.ninja CHỈ còn cho build/meta, KHÔNG phải giá.

Cũng không nên copy `analyze.ts` rồi find-replace category name. `STRATEGIES` record POE1 (delirium/essence/harvest/scarab/expedition/bossing) reference POE1 mechanic không tồn tại POE2 (scarab category, deliriumOrb category, Vivid/Wild/Primal Lifeforce). Phải re-author STRATEGIES từ archetype list trong SKILL.md.

## TODO 1: `market-snapshot.ts`

**Goal:** equivalent của `farming-strategy/scripts/market-snapshot.ts` nhưng cho POE2 economy.

**Data source decision:**
- **Primary:** poe2scout qua `.claude/skills/poe2scout/scripts/api.sh` — `list <cat>` (price + listed-stock + Δ7d, 24 category), `pairs` (traded-volume + ex/div từ Currency Exchange), `item` (per-item OHLC). Reuse skill, đừng gọi API tay. Cân nhắc gọi luôn `/economy-scan` đã orchestrate sẵn.
- **Fallback / cross-check:** trade API qua playwriter page-context (xem `/trade` skill). Trade2 cho real-time listing nhưng rate-limit chặt — chỉ dùng cho spot-check không cho bulk snapshot.

**Schema diff vs POE1:**
- POE1 category: `scarab`, `fragment`, `map`, `essence`, `fossil`, `resonator`, `oil`, `deliriumOrb`, `card`, `gem`, `jewel`, `accessory`, `armour`, `weapon`, `flask`.
- POE2 category (verify khi 0.5 live — best guess từ patch note 0.5.0):
  - **Input:** `tablet`, `waystone`, `breachstone`, `logbook` (Ocean Logbook), `remnant` (nếu poe2scout list rarity tier), `key-fragment` (Pinnacle/Citadel)
  - **Currency:** `exalted`, `divine`, `chaos`, `mirror`, `verisium` (new POE2 0.5), `alloy` (13 mới), `ancient-rune` (13 mới), `flux` (3 mới), `liquid-emotion` (Delirium), `wombgift` + `hiveblood` (Breach Genesis Tree input)
  - **Output:** `unique-armour`, `unique-weapon`, `kalguuran-skill` (21 mới), `kalguuran-support` (8 mới), `lineage-support` (~21 mới), `catalyst` (12 mới, Genesis Tree only), `corrupted-idol` (3 mới Ritual), `timelost-jewel` (Delirium), `runic-ward-rune`, `idol` (8 mới Azmerian)

**Currency baseline:** POE2 = Exalted, NOT Chaos. POE1 helper `divine_in_chaos` / `exalt_in_chaos` cần đổi thành `divine_in_exalted` / `chaos_in_exalted` / `mirror_in_divine`.

**Meta signal heuristic POE2 0.5 (replace POE1 "Delirium meta / scarab spike"):**
- **Atlas Master meta shift** — node distribution của top build qua `/poe-ninja` cho Master allocation
- **Pinnacle boss key surge** — Olroth-key, Tul+Esh-key, Head of the King price spike
- **Remnant slot tier shift** — supply curve 2-slot vs 6-slot vs 10-slot
- **Build guide effect** — Kalguuran Skill/Support spike khi creator drop guide
- **Lineage Support meta** — ~21 mới chưa có price floor, early-league volatility

**CLI surface (giữ parity với POE1):**
```bash
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --top 30
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --category tablet
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --json
bun .claude/skills/farming-strategy/scripts/market-snapshot.ts --output snapshots/poe2/2026-06-01.json
```

## TODO 2: `analyze.ts`

**Goal:** equivalent của `farming-strategy/scripts/analyze.ts` nhưng STRATEGIES record viết lại từ archetype list POE2 trong SKILL.md.

**`StrategyDefinition` interface giữ nguyên shape POE1** — pattern (inputs/outputs/maps_per_hour/self_sustain/build_requirements/atlas_nodes/notes) generic, work cho cả 2 game.

**Field đổi giá trị, không đổi shape:**
- `atlas_nodes` POE1 = "Delirium Effect, Delirium Reward, Map Sustain" — POE2 = "Atlas Master selection (Doryani/Hilda/Jado), specific Atlas Tree node POE2 (300+ node mới), Tablet stack count".
- `build_requirements` POE1 reference EHP/DPS theo POE1 build standard — POE2 reference Runic Ward layer, Spirit Walker companion HP, Monk Martial Artist mobility.
- `inputs[].category` đổi sang category POE2 (xem TODO 1).
- `maps_per_hour` POE2 thường < POE1 (POE2 map slower-paced) — default 6–10 thay vì 12–20.

**STRATEGIES record cần author (theo archetype list SKILL.md):**

| Strategy key | Source archetype trong SKILL.md |
|---|---|
| `remnant-runic` | Archetype 1: Remnant Runic Recipe |
| `ocean-exploring` | Archetype 2: Ocean Exploring |
| `pinnacle-arbiter` | Archetype 3 (Arbiter of Divinity quest + infinite) |
| `pinnacle-olroth` | Archetype 3 (Olroth-key Runes of Aldur Pinnacle) |
| `pinnacle-vruun` | Archetype 3 (Vruun, Marshal of Xesht — Stabilised Breach boss) |
| `breach-domain` | Archetype 4: Breach Domain Catalyst |
| `delirium-trial-madness` | Archetype 5: Delirium Trial of Madness |
| `ritual-rite-nameless` | Archetype 6: Ritual Rite of the Nameless |
| `vaal-temple` | Archetype 8: Fate of the Vaal — Atziri's Temple |
| `abyss-depths` | Archetype 9: Abyss Depths Boss |
| `tablet-stacking` | Archetype 10: Tablet Mass Stacking (juicing layer, có thể là modifier flag thay vì standalone) |

Archetype 7 (Atlas Master Juicing) **không phải standalone strategy** — apply như multiplier lên các strategy khác qua `atlas_nodes` field hoặc config separate `atlas_master_preset`.

**CLI surface (giữ parity với POE1):**
```bash
bun .claude/skills/farming-strategy/scripts/analyze.ts --list
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy remnant-runic
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy ocean-exploring --maps-per-hour 8
bun .claude/skills/farming-strategy/scripts/analyze.ts --compare remnant-runic,ocean-exploring,breach-domain
bun .claude/skills/farming-strategy/scripts/analyze.ts
bun .claude/skills/farming-strategy/scripts/analyze.ts --strategy remnant-runic --json
```

## Wire-up checklist khi league live

1. [ ] Reuse poe2scout `api.sh` (đã wire + verified) cho price/volume — `api.sh categories` cho category map thực tế, `api.sh list/pairs` cho data. Không cần tự build fetch layer.
2. [ ] Verify category map ở TODO 1 khớp `api.sh categories <league>` thực tế (24 category poe2scout).
3. [ ] Implement `market-snapshot.ts` reference POE1 `farming-strategy/scripts/market-snapshot.ts` cho code structure (cùng pattern: fetch → trending → categorize → meta-signal → output formatter).
4. [ ] Implement `analyze.ts` reference POE1 `farming-strategy/scripts/analyze.ts` cho code structure (cùng pattern: STRATEGIES record → priceStrategy() → calculateProfit() → format output / compare table).
5. [ ] Author STRATEGIES record từ 10 archetype trong SKILL.md, mỗi cái với realistic input quantity + maps_per_hour estimate (verify với in-game testing tuần đầu league).
6. [ ] Test với current character POE2 0.5 (TBD) — fetch real character envelope qua `/pob`, cross-check build_requirements field thực tế tank được strategy.
7. [ ] Update `SKILL.md` line "Status: SCAFFOLD" → "Status: ACTIVE" + bump version 0.1.0 → 1.0.0 + remove "(TODO)" markers.
8. [ ] Test snapshot pipeline end-to-end: `market-snapshot.ts --output snapshots/poe2/<date>.json` → `analyze.ts --compare ...` → generate strategy doc trong `content/farming/0-5-<strategy>.md` theo template `templates/farming-template.md`.

## Confidence labels

- **Category list POE2 (TODO 1):** MEDIUM — best guess từ patch note 0.5.0 fields. Verify với `api.sh categories` (poe2scout) thực tế khi league live.
- **STRATEGIES archetype (TODO 2):** HIGH cho existence (patch note confirm mọi mechanic) + MEDIUM cho profit estimate (no market data yet) + LOW cho specific atlas node naming (Atlas Tree 300+ node, names chưa fully documented).
- **Build requirement field:** LOW — POE2 0.5 character chưa final, meta build chưa stabilize. Update sau tuần 1 league.
