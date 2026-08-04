---
name: passive-skill-tree
description: Analyze, query, and optimize the POE2 passive skill tree — lookup nodes, find paths, validate allocations, and run real-DPS tree optimization. Backed by Path of Building's own tree + calc engine (POE2 0.4 tree; refresh after 0.5).
version: 3.0.0
license: MIT
compatibility: Requires luajit + the bundled pob-source (data/pob-source). Reuses PoB's tree data, pathing, allocation, and calc engine — no separate tree export.
metadata:
  author: poe-aio
  data-source: data/pob-source (Path of Building Community fork)
  status: live
allowed-tools: Bash(.claude/skills/passive-skill-tree/scripts/pst.sh:*)
---

# Passive Skill Tree — POE2 (PoB-backed)

This skill is a thin Lua CLI over **real Path of Building 2**. It does not parse
the tree itself or re-implement pathing/scoring — every heavy operation
delegates to PoB so results match the calc engine exactly, and there is one
source of truth for the tree (the same one `/pob` and `/build-creator` verify
against).

**Use when:**
- Lookup / search nodes, keystones, notables by name or stat text
- Shortest allocation path between nodes (PoB's real pathing)
- Validate an allocation connects to the class / ascendancy start (orphan check)
- Real-stat analysis of an allocation, or **tree optimization** — find the best
  notables for an objective (DPS/EHP/…) within a passive-point budget, honoring
  required notables.

## Commands

```bash
S=.claude/skills/passive-skill-tree/scripts/pst.sh

# Tree queries (read PoB tree data; no calc)
$S lookup <id|name>            # find node by id or name substring
$S search-stats <text>         # nodes whose stat lines contain text
$S nearby <id> [count]         # nearest nodes by tree position
$S distance <id1> <id2>        # position distance between two nodes
$S types                       # node-type census
$S classes                     # classes with classInternalId + ascendancy tokens
$S ascendancies <class>        # ascendancy tokens for a class
$S export                      # all nodes as JSON

# Pathing (PassiveSpec:GetAllocationPath + node.linked)
$S path <from> <to>            # shortest allocation route between two nodes
$S validate <class> <nodes...> # orphan check + passive-point cost

# Build-context (need a build XML — PoB calc engine)
$S analyze  <build.xml> [nodes...]   # real Life/ES/Mana/DPS/EHP (+optional extra nodes)
$S optimize <build.xml> [options]    # greedy tree optimization by objective
```

### optimize options

```
--objective <stat>   mainOutput stat to maximize (default TotalDPS; e.g. TotalEHP, Life)
--budget <N>         passive-point budget (default 20)
--require <id,id>    notables that MUST be included (allocated first, count toward budget)
--filter <text>      restrict candidate notables to those with this stat text (keeps it fast)
--top <K>            stop after K picks (default: until budget exhausted)
```

Output is JSON: `base`/`final` objective + points, the `picks` (each with real
gain + point cost), and `allocatedNodes` (the full node-id list incl. connecting
paths — paste straight into a `/build-creator` spec `tree.nodes`).

Example — best 25 points of spell damage for a Spark build:
```bash
$S optimize my-build.xml --objective TotalDPS --budget 25 --filter "increased Spell Damage"
```

**Caveat — "0 DPS loss" ≠ "safe / worthless".** The greedy sees only the single
objective stat; it is blind to mechanics. A notable can score ~0 objective gain
yet be load-bearing (e.g. Blood Magic flips skill cost life→mana; rage/warcry
nodes read 0 because PoB's build config has rage at 0 stacks). Always surface the
result for human vetting; never auto-apply a respec from the raw numbers. For
finished builds, optimize is additive (it surfaces *what to add* / respec targets);
the *remove* side needs constraint-aware judgement, not just min-objective-loss.

## How the reuse works (what comes from PoB)

| Command | Delegates to PoB |
|---|---|
| lookup/search/nearby/types | `main:LoadTree("0_4")` node data (`dn`/`sd`/`type`/`x`/`y`) |
| classes/ascendancies | `tree.classes[].integerId` + `.classes[].internalId` (the ids PoB writes to XML) |
| path | `PassiveSpec:GetAllocationPath` (Dijkstra, allocMode + intuitive-leap aware) |
| validate | `ImportFromNodeList` + `BuildAllDependsAndPaths`, BFS over `node.linked` |
| analyze/optimize | `build.calcsTab:BuildOutput()` → `mainOutput` (full multiplicative calc) |

New code is only the glue PoB has no equivalent for: the CLI (`pst.sh`/`pst.lua`),
output formatting (`fmt.lua`), and the optimizer search loop (`calc.lua`).

## File layout

```
scripts/
  pst.sh          # env + cwd wrapper (LUA_PATH, cd pob-source/src, luajit)
  pst.lua         # thin entry: argv parse + command-registry dispatch
  lib/
    bootstrap.lua # ONLY module touching PoB: headless init, loadBuild, recalc, tree version
    fmt.lua       # output formatting + JSON encoder (pure)
    query.lua     # tree-only commands
    path.lua      # path + validate (PassiveSpec)
    calc.lua      # analyze + optimize (calc engine)
```

Add a command by adding a function to a module's `commands` table; `pst.lua`
merges every module's registry automatically. To change tree version or refactor
PoB access, edit only `bootstrap.lua`.

## Data source & version skew

The tree comes from the bundled `data/pob-source` (PoB Community fork), tree
version **`0_4`** (`bootstrap.lua` `TREE_VERSION`). This is the same tree the
calc engine evaluates, so query/path/optimize never disagree with `/pob`.

**0.5 caveat:** at 2026-05-27 pob-source is still 0.4-era — it has no Spirit
Walker / Martial Artist nodes yet, and `classes` reflects 0.4 ascendancies.
After 0.5 launch (2026-05-29) refresh pob-source (`/pob` fetch script), then
bump `TREE_VERSION` in `bootstrap.lua` if `GameVersions.lua` advanced. No other
file needs touching — that is the point of centralizing PoB access in bootstrap.

## classInternalId reference (for /build-creator)

`classes` prints the GGG canonical integerId straight from PoB's tree, so the
values are authoritative for PoB2 XML emission:

```
Witch=1  Ranger=2  Warrior=6  Sorceress=7  Huntress=8  Mercenary=9  Monk=10  Druid=11
Lich = Witch3 (ascendancyInternalId).  Use ascendancyInternalId="" for none.
```

## Performance

`BuildOutput()` is ~18ms; a full reload+recalc ~220ms. `optimize` reloads per
candidate trial (keeps marginals independent), so cost ≈ picks × candidates ×
~220ms — use `--filter` to shrink the candidate set. Brute over all ~1100
notables for one pick is ~60s with the process kept alive.
