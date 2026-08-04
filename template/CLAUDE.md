# CLAUDE.md — PoE 2 Workspace

**PoE 2 League Gameplay Workspace** — AI skills, content/notes, scripts cho Path of Exile 2 mỗi league/patch. Workspace này KHÔNG handle POE1.

File này chứa **workspace-specific bindings**: slash command aliases, frontmatter convention, pointer scripts. Tất cả đều POE2 native — không cross-game.

---

## Slash Command Aliases

Mọi command trong workspace này trỏ POE2. Không có command POE1.

- `/pob` → PoB2 calculator (community fork POE2)
- `/poewiki` → wiki mirror poe2wiki.net (qua `data/wiki/`)
- `/poedb` → database mirror poe2db.tw per patch (qua `data/poedb/<patch>/`)
- `/poeforum` → đọc GGG forum (listing + thread) trả JSON (anonymous browser-UA curl, read-only)
- `/update-release-note` → fetch patch notes từ official GGG forum thread → `data/release-notes/`
- `/passive-skill-tree` → passive tree
- `/atlas-tree` → atlas passive tree
- `/trade` → trade qua playwriter (page-context fetch trong tab đã login)
- `/gear-upgrade` → tìm gear upgrade (playwriter + PoB2 sim)
- `/poe-ninja` → popular builds + item prices
- `/farming-strategy` → analyze farming strategy
- `/lootfilter` → create/modify loot filter (poe2filter.com)
- `/map-mod-filter` → decode/generate stash regex cho waystone + tablet
- `/build-creator` → tạo build POE2 từ request + targets, materialize PoB2 code, verify headless, publish link

---

## Gameplay Workflows

### Check character status

```
.claude/skills/pob/scripts/scripts/analyze.sh "https://poe.ninja/poe2/builds/<league>/character/<account>/<charname>"
  # hoặc mobalytics.gg/poe-2/builds/... hoặc pobb.in link
  → stats, gear, gems, keystones (xem skill /pob)
```

Lưu ý: POE2 hiện chủ yếu dùng poe.ninja snapshot / pobb.in / mobalytics — chưa có fetch trực tiếp bằng tên character như POE1.

### Analyze a build

`/pob <url>` — accept pobb.in, mobalytics.gg/poe-2/..., poe.ninja/poe2/...

### Look up game mechanics

```
/poewiki <query>          → search wiki mirror (poe2wiki.net)
/poedb <patch>            → database mirror (poe2db.tw) per patch
/passive-skill-tree       → passive nodes, paths, stats (0.5+)
/atlas-tree               → atlas passive tree (0.5+)
```

### Read forum (builds / feedback / threads)

```
.claude/skills/poeforum/scripts/forum.sh list 2216           # POE2 Builds forum -> threads[] JSON
.claude/skills/poeforum/scripts/forum.sh thread 3931901      # 1 page of posts -> posts[] JSON
.claude/skills/poeforum/scripts/forum.sh thread 3931901 --all # every page (1.2s spacing)
```

- Anonymous read-only browser-UA curl trang forum public — KHÔNG auth, KHÔNG GGG API, KHÔNG playwriter (xem skill `/poeforum`). Forum id hay dùng: `2216` = POE2 Builds.
- Trả JSON sạch (author/date/staff/content/links + pagination), pipe `jq` để cắt. Dùng để survey build forum, đọc megathread, trích link PoB/mobalytics. KHÔNG dùng cho patch notes (đó là `/update-release-note`).

### Fetch release notes / patch notes

```
.claude/skills/update-release-note/scripts/fetch.sh 3932540          # POE2 0.5.0 (thread id 3932540)
.claude/skills/update-release-note/scripts/fetch.sh 3932540 0.5.0    # version explicit (hotfix)
```

- Fetch verbatim từ **official GGG forum thread** (canonical source #1), không phải wiki mirror. Xem skill `/update-release-note`.
- Mỗi patch là một thread id riêng (lookup tay từ GGG forum announcement) — không auto-detect. Đã biết: 0.5.0 = `3932540`.
- Pipeline `curl` (browser UA, né Cloudflare 403) → `extract-forum.py` (bs4 post-body + split packed `<li>`) → `pandoc` → cleanup. Output `data/release-notes/Version_X.Y.Z.md` + `latest.md` symlink, tracked in git.
- Re-fetch cùng version giữ nguyên header block đã curate (mọi thứ trên `---`), chỉ refresh body — đúng cách để kéo dated "Updates to Patch Notes" addendum mới.
- Dùng khi cần exact wording của changes cho league/patch mới (đặc biệt trước khi viết mechanics hoặc farming strategy notes).

### Trading & pricing

```
/trade <search>           → search trade qua playwriter (page-context fetch, safest)
/gear-upgrade             → tìm gear upgrade qua playwriter + PoB2 sim
/poe-ninja                → popular builds, item prices
```

### Farming & filters

```
/farming-strategy → analyze farming strategy
/lootfilter       → create/modify loot filter (poe2filter.com)
/map-mod-filter   → decode/generate waystone + tablet regex
```

### Build authoring

```
/build-creator → tạo build POE2 từ request + targets, materialize PoB2 code, verify trong PoB2 headless, publish link
```

### TFT Discord

```
discord https://discord.com/channels/645607528297922560/1143637598313652344
```

---

## Frontmatter Convention

Áp dụng PoB Coverage Disclosure với field tên neutral **`pob_coverage`** trong build note frontmatter:

```yaml
---
patch: 0.5.0
pob_coverage: PARTIAL
---
```

Field này signal PoB2 community fork đã model đủ league-mới mechanic chưa (`FULL` / `PARTIAL` / `NA`). POE2 PoB fork hay trễ patch — flag `PARTIAL` cho build dùng companion AI, Runeforging, Runic Ward, Kalguuran skill, Spirit Walker / Martial Artist mechanic chưa được community fork support.

---

## Data Paths

Mọi data persistent sống dưới `data/`:

- `data/wiki/` — wiki mirror poe2wiki.net (goscrape)
- `data/poedb/<patch>/` — database mirror poe2db.tw per patch
- `data/release-notes/Version_X.Y.Z.md` — patch notes (+ `latest.md` symlink)
- `data/atlas-tree/atlas-tree.json` — GGG atlas tree export
- `data/passive-tree/<tag>/data.json` — GGG `poe2-skilltree-export` passive tree (normalized), pinned per release tag (+ `meta.json`)
- `data/poe-ninja/<league>/{latest,trends}.json + snapshots/` — economy snapshot
- `data/price-history/{daily/,master.json}` — currency/item price time series cho price-forecast
- `data/map-mods/<corpus>-mods-X.Y.json` — waystone/tablet mod corpus
- `data/pob-source/` — PathOfBuildingCommunity clone (~572M, gitignored, fetch qua PoB fetch script)
- `data/character-exports/` — per-character JSON export (gitignored, instance data)

<!-- kanban:start -->
## Task Board

!`bash .kanban/status.sh 2>/dev/null`

Board: `.kanban/board.md` (index) | Tasks: `.kanban/tasks/T-NNN-slug.md` | Archive: `.kanban/archive/`

**Session start:** Read `.kanban/board.md`. For Doing tasks, open their task files.
**Session end:** Update `.kanban/board.md` — move completed task lines to Done, note blockers, update timestamp.

**Board line format** (one per task):
```
- [T-NNN](tasks/T-NNN-slug.md) Title — priority/effort
```

**Task file format** (`.kanban/tasks/T-NNN-slug.md`):
```
# T-NNN: Title
> One-line description
- **priority**: critical|high|medium|low
- **effort**: XS|S|M|L

## Criteria
- [ ] Acceptance criterion
```

**Rules:** WIP limit = 2 in Doing. Pick highest-priority from Todo. Never skip criteria checkboxes. Slug is kebab-case from title, ≤40 chars.
<!-- kanban:end -->
