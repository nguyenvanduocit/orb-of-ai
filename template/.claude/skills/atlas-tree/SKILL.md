---
name: atlas-tree
description: Analyze POE2 Atlas Passive Tree (0.5 "Return of the Ancients" rewrite) — lookup nodes, paths, distances, values, Masters of the Atlas mapping
version: 1.0.0
license: MIT
compatibility: Requires bun runtime. POE2 0.5 atlas data sourced from PathOfBuildingCommunity/PathOfBuilding-PoE2 (research-in-progress).
metadata:
  author: poe-aio
  data-source: PathOfBuildingCommunity/PathOfBuilding-PoE2 (lua AtlasTreeData) — TBD verify after 0.5 launch
  status: scaffold — data layer chưa wire (xem scripts/README.md)
allowed-tools: Bash(bun scripts/atlas-tree:*
---

# Atlas Tree Tools — POE2 (0.5 Endgame Rewrite)

**Status:** SCAFFOLD. Fetcher + analyzer chưa implement. Mục đích là declare command surface + capture 0.5 endgame rewrite facts trước khi data về, để wire-up sau launch ~29/05/2026 chỉ là filling-in.

**Use this skill when:**
- User muốn analyze POE2 Atlas Passive Tree (sau 0.5)
- User hỏi về node Atlas POE2 cụ thể (Delirium Atlas Tree, Breach Atlas Tree, Ritual Atlas Tree, Fate of the Vaal Atlas Tree, league-specific subtree)
- User cần tìm path / distance giữa atlas node POE2
- User cần suggest allocation tối ưu cho Atlas budget
- User cần lookup **Masters of the Atlas** node (Jado's Spycraft / Hilda's Hunting / Doryani's Science) — 12 nodes/master, choose-4

**Use POE1 skill `/atlas-tree`** khi user nói về POE1 atlas (Mirage 3.28, Path of Pathing URL, voidstone, scarab nodes POE1). POE2 atlas sau 0.5 không backward-compatible.

## POE2 0.5 Atlas — khác biệt cốt lõi vs POE1 (source: `data/release-notes/Version_0.5.0.md`)

POE2 0.5 vừa rewrite toàn bộ endgame. Skill này phải reflect rewrite, KHÔNG copy assumption POE1:

- **Fixed points of interest** — Atlas có vị trí cố định cho hub area (The Withered Willow = Delirium, Monastery of the Keepers = Breach, Caer Tarth = Ritual, Lira Vaal = Fate of the Vaal). Khác POE1 layout random theo seed.
- **300+ node trong Atlas Tree mới** — mở rộng đáng kể. Allocate được toàn bộ tree (no respec needed). Multi-choice node có thể đổi anytime → schema phải support `multiChoice` field.
- **Mỗi league mechanic có sub-tree riêng được rewrite hoàn toàn**:
  - Delirium Atlas Tree (rebuilt từ scratch)
  - Breach Atlas Tree (rebuilt)
  - Ritual Atlas Tree (rebuilt)
  - Fate of the Vaal Atlas Tree (mới được core-ified)
- **Masters of the Atlas** — hệ thống ascendancy-like cho endgame. 3 master (Jado, Hilda, Doryani), mỗi master 12 node, chọn 4. Đây là layer riêng — schema phải có `masterTree: { jado, hilda, doryani }` ngoài main atlas tree.
- **No voidstone / no watchstone** — POE1 8-voidstone progression KHÔNG tồn tại POE2 0.5. Bỏ hoàn toàn concept đó khỏi analyze logic.
- **Atlas point source = clear map trong Fortress** thay vì Maven witness POE1.
- **Ancient Modifier (40+) trên map ngoài Fortress** — không phải atlas tree node nhưng cần handle khi search-stats `"ancient modifier"`.

## Commands (planned — mirror POE1 atlas-tree)

```bash
bun .claude/skills/atlas-tree/scripts/analyze.ts lookup <query>
bun .claude/skills/atlas-tree/scripts/analyze.ts nearby <id> [count]
bun .claude/skills/atlas-tree/scripts/analyze.ts distance <id1> <id2>
bun .claude/skills/atlas-tree/scripts/analyze.ts path <from> <to>
bun .claude/skills/atlas-tree/scripts/analyze.ts analyze <nodes...>
bun .claude/skills/atlas-tree/scripts/analyze.ts search-stats <text>
bun .claude/skills/atlas-tree/scripts/analyze.ts suggest <start> <points>
bun .claude/skills/atlas-tree/scripts/analyze.ts types
bun .claude/skills/atlas-tree/scripts/analyze.ts export
bun .claude/skills/atlas-tree/scripts/analyze.ts masters [name]
bun .claude/skills/atlas-tree/scripts/analyze.ts subtree <league>
```

Hai command mới so với POE1:
- **`masters [name]`** — list 3 Atlas Master, hoặc dump 12-node tree của 1 master (jado/hilda/doryani). Trả về node có thể allocate cùng nhau cho combo.
- **`subtree <league>`** — focus sub-tree riêng cho một league mechanic (delirium / breach / ritual / vaal). Vì mỗi sub-tree rewrite riêng và user thường tập trung farm 1 mechanic, dedicated command rẻ hơn filter manual.

## Value Scoring Heuristic — POE2 0.5 adapted (MEDIUM confidence)

POE1 atlas heuristic (Scarab +2-4, Map drop +2-3, Unique map +5) chỉ partial áp dụng. POE2 0.5 economy chưa ổn định → starting weights, recalibrate sau 2 tuần league:

- **League mechanic encounter scaling** (more Delirium / more Breach / more Ritual splinter): +3
- **Map drop / map quantity / map rarity**: +3
- **Boss-related** (Pinnacle access, Citadel key drop, Crisis fragment): +4
- **Currency item drop** (Wombgift, Hiveblood, Energised Crystal): +3
- **Tower / Precursor Tablet bonus**: +2
- **Notable**: x1.5 multiplier
- **Keystone**: x3 multiplier
- **Masters of the Atlas node** scored riêng vì 4-of-12 budget cap thay đổi optimal-greedy logic — flag riêng để `suggest` không treat nó như atlas main tree.

## Data Source — research-in-progress

- **Primary candidate:** [PathOfBuildingCommunity/PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) — PoB2 fork. Atlas data có thể nằm trong `Data/AtlasTree-0_5_0.lua` hoặc tương tự (TBD verify). PoB2 maintainer thường update trong 1-2 tuần sau league launch.
- **Secondary:** [poe2db.tw](https://poe2db.tw) atlas section sau khi 0.5 patch.
- **Official:** Chưa có `pathofexile.com/atlas-skill-tree/...` cho POE2 (POE1 không có endpoint riêng, dùng atlastree-export repo). KHÔNG có `grindinggear/atlastree-export` cho POE2.
- **Patch note** `data/release-notes/Version_0.5.0.md` là source of truth cho mechanic-level facts (đã reference ở trên). Dùng để cross-check khi PoB2 fork chưa update.

**Confidence:**
- LOW: PoB2 fork sẽ ship atlas data trong N ngày sau 0.5 launch
- LOW: Schema layout (PoB1 lua format được tái dùng vs rewrite riêng)
- HIGH: 300+ node, fixed POI, Masters system, league sub-tree rewrite (verified từ patch note 0.5.0)
- HIGH: KHÔNG có Path of Pathing URL format cho POE2 — đừng port `generate.ts` (HTML viewer từ POP URL) cho đến khi có equivalent

## What we DON'T port từ POE1 atlas-tree

- **`generate.ts`** (HTML viewer từ Path of Pathing URL): bỏ. POE2 chưa có Path of Pathing equivalent. Sau khi community tool xuất hiện (likely "poe2 atlas tool" trong vài tuần đầu league), thêm command `generate` riêng.
- **PoB atlas import code parsing** (POE1 binary format): POE2 PoB2 atlas export sẽ dùng format khác. Defer.

## Typical Workflows (POE2 0.5)

1. **Plan farming sub-tree một league mechanic**: `subtree breach` → `search-stats "splinter"` / `"hiveblood"` → `analyze` cho điểm starter
2. **Master combo cho map portfolio**: `masters jado` + `masters hilda` → pick 4 node mỗi master synergize với strategy
3. **Pinnacle access path**: `search-stats "citadel"` / `"key"` → path từ start → Citadel notable cho Arbiter of Divinity
4. **Compare Delirium tree vs Breach tree value/point**: `subtree delirium` → `subtree breach` → tổng value mỗi sub-tree với budget tương đương

## Status & Limitations

- Toàn bộ skill scaffold. `analyze.ts` chưa exist. Mọi command fail cho đến khi follow `scripts/README.md`.
- Patch note 0.5 đã trong project (`data/release-notes/Version_0.5.0.md`) → dùng làm reference khi mechanic question hỏi mà data layer chưa wire.
- Version bump: 1.0 (scaffold) → 1.1 (data wired) → 2.0 (Path of Pathing equivalent / generate.ts wired).
