# atlas-tree/scripts — TODO list để wire data layer (POE2 0.5 Endgame Rewrite)

**Trạng thái hiện tại:** SCAFFOLD ONLY. Chưa có `analyze.ts`, chưa có fetcher, chưa có `<project-root>/data/atlas-tree/atlas-tree.json`.

POE2 0.5 vừa rewrite toàn bộ endgame ngày 21/05/2026 (patch note), launch ~29/05/2026. Atlas Tree mới 300+ node, layout fixed POI, có Masters of the Atlas (3 master × 12 node). Hệ thống này hoàn toàn mới — dữ liệu KHÔNG tồn tại trước 0.5.

Mục tiêu doc: agent/user follow checklist dưới để wire skill 30-90 phút sau khi PoB2 fork update atlas data cho 0.5.

## TODO — theo thứ tự dependency

### 1. Wait for PoB2 fork update (~1-2 tuần sau 0.5 launch)

PoB2 maintainer thường cần 1-2 tuần để parse new patch data. Không có quick-path. Monitor:
- Repo: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 — issue + release tag
- Discord PoB community channel
- Reddit r/PathOfExile2 thread "PoB2 0.5 update"

Trong thời gian chờ, có thể tham khảo:
- Patch note `data/release-notes/Version_0.5.0.md` cho mechanic-level fact
- poe2db.tw (sẽ update sau patch live)
- Reddit/community datamine

### 2. Inspect PoB2 fork để confirm atlas data location (~15 phút)

Check ứng viên path trong PoB2 fork:
- `src/TreeData/Atlas/0_5_0/tree.lua`
- `src/Data/AtlasTreeData.lua`
- `src/Data/AtlasTree-0_5_0.lua`

Schema có thể chứa:
- `mainTree` — Atlas tree chính (300+ node)
- `masterTrees` — sub-section cho Jado, Hilda, Doryani (12 node mỗi master)
- `leagueSubTrees` — Delirium / Breach / Ritual / Vaal (mỗi sub-tree rewrite)
- HOẶC: tất cả flatten vào `nodes[]` với `subTree` field discriminator

Schema discovery là step quan trọng nhất — note ra commit:
- File path
- Top-level keys
- Có separate per-master tree không hay flatten
- League sub-tree có separate file không

### 3. Viết fetcher (`scripts/fetch.ts`) (~15 phút)

- Download lua từ GitHub raw URL của PoB2 fork
- Parse lua → JSON (xem option A/B/C trong `../passive-skill-tree/scripts/README.md` step 2)
- Nếu schema chia nhiều file (atlas main + per-master + per-league), fetch tất cả → merge vào `<project-root>/data/atlas-tree/atlas-tree.json` với top-level discriminator:

```json
{
  "version": "0.5.0",
  "mainTree": { "nodes": {...}, "groups": {...} },
  "masters": {
    "jado": { "nodes": {...} },
    "hilda": { "nodes": {...} },
    "doryani": { "nodes": {...} }
  },
  "leagueSubTrees": {
    "delirium": {...},
    "breach": {...},
    "ritual": {...},
    "vaal": {...}
  }
}
```

- TTL 7 ngày, support `--force-update`

### 4. Port `analyze.ts` từ POE1, adapt cho 0.5 schema (~30 phút)

Port base từ POE1 sibling (`../poe1/`):
```bash
cp ../poe1/.claude/skills/atlas-tree/scripts/analyze.ts \
   .claude/skills/atlas-tree/scripts/analyze.ts
```

Adapt:
- `DATA_PATH` → `<project-root>/data/atlas-tree/atlas-tree.json` (resolve qua `../../../../data/atlas-tree/` relative từ `scripts/analyze.ts`)
- Schema layer: nếu data chia main/masters/leagueSubTrees, loader phải handle 3 namespace riêng. Mặc định command query `mainTree`; flag `--subtree <name>` switch namespace.
- Implement 2 command mới (xem SKILL.md):
  - `masters [name]` — dump 12-node tree của 1 master. Logic combo-4-of-12: brute-force C(12,4) = 495 combination, score mỗi combo, return top-N.
  - `subtree <league>` — switch namespace to leagueSubTrees[league], run search/analyze trên đó
- Value scoring weights mới (SKILL.md POE2 heuristic) — đặc biệt boss-related +4, currency drop +3
- Remove POE1-only `unique map` weight branch (POE2 unique map system khác)

### 5. Wait + import Path of Pathing equivalent (~variable)

POE1 `generate.ts` parse Path of Pathing URL. POE2 chưa có. Hold `generate` command cho đến khi:
- Community ship "poe2 atlas planner" tool, hoặc
- Official client expose atlas export

Khi có, add `scripts/generate.ts` riêng — không port mù từ POE1 vì URL binary format chắc chắn khác.

### 6. Smoke test (~5 phút)

```bash
bun .claude/skills/atlas-tree/scripts/analyze.ts types
bun .claude/skills/atlas-tree/scripts/analyze.ts masters
bun .claude/skills/atlas-tree/scripts/analyze.ts masters jado
bun .claude/skills/atlas-tree/scripts/analyze.ts subtree breach
bun .claude/skills/atlas-tree/scripts/analyze.ts search-stats "splinter"
bun .claude/skills/atlas-tree/scripts/analyze.ts search-stats "citadel"
```

Expected: 300+ node trong main tree, 3 master × 12 node, breach sub-tree có splinter-related node, mention citadel near Arbiter of Divinity.

### 7. Update SKILL.md

- `version: 1.0.0` → `1.1.0`
- `metadata.status: scaffold` → `live, data-source: PoB2 fork <sha>, patch 0.5.x`
- Remove status warnings

## Schema diff POE1 atlas → POE2 0.5 atlas (cheat sheet)

| Concept POE1 | POE2 0.5 status | Note |
|--------------|-----------------|------|
| Voidstone / Watchstone | REMOVE | 0.5 không có |
| 8-region Maven witness | REMOVE | Atlas point từ Fortress map |
| Single flat tree | REPLACE | Main + 4 league sub-tree + 3 master tree |
| Path of Pathing URL | NONE YET | Defer `generate.ts` |
| Scarab nodes | KEEP concept | POE2 scarab khác base nhưng node pattern tương tự |
| Multi-choice nodes | NEW field needed | POE2 0.5 có multi-choice node toggle anytime |
| Respec gold cost | REMOVE | 0.5 không cần respec (allocate được toàn bộ tree) |

## Reference

- POE1 skill (port pattern from): `../poe1/.claude/skills/atlas-tree/`
- PoB2 fork: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2
- POE2 0.5 patch notes (Atlas/Endgame section): `data/release-notes/Version_0.5.0.md` heading "Đại Tu Endgame — Origins of Divinity" + "Masters of the Atlas" + per-league sections
- POE2 mechanic overview: `content/guides/return-of-the-ancients.md`
