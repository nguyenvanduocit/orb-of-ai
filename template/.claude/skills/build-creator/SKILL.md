---
skill_name: build-creator
description: Author a full POE2 build from a request + targets, materialize it as a PoB2 code, verify stats in POB2 headless, optimize in-process, and publish a viewable link (poe.ninja / pobb.in). Use when user says "build giùm", "tạo build", "make me a build", or wants a build they can view/edit in PoB.
version: 1.0.0
tags: [poe2, path-of-building, build-creator, author, pob, poe.ninja, pobb.in, optimize]
---

# Build Creator (POE2)

Author a Path of Exile 2 build from a natural-language request, calculate and
verify it in real POB2, optimize it in-process against your targets, and publish
a shareable link the user can open on poe.ninja/poe2/pob or pobb.in.

This is the **write** counterpart to `/pob` (which only reads/analyzes builds).

## How it works (the design)

Everything runs **inside real Path of Building 2** via `data/pob-source` —
nothing hand-emits XML. A single luajit process loads PoB once and operates on
the live `build` object:

- **Construct** uses PoB's own object API — `SelectClass`, `SelectAscendClass`,
  `PasteSocketGroup`, `AddItem` + slot, `AllocNode`. There is no XML to get
  wrong; PoB builds the build.
- **Export** uses PoB's own serializer: `build:SaveDB("code")` → `Deflate` →
  url-safe base64 (the exact recipe PoB's import/export uses). The XML can never
  disagree with what PoB loads, and verified `<PlayerStat>` values are embedded
  automatically — no separate "bake" step, so poe.ninja's viewer shows real
  Life/Mana/DPS.
- **Optimize** mutates the loaded build, calls one `OnFrame`, reads the metric,
  and keeps or reverts — sub-millisecond per candidate. This is what makes
  optimizing items / gems / passives practical.

Because we reuse the community's engine and serializer, the toolkit stays correct
as PoB evolves and inherits its calc fidelity.

## When to use

- User says "build giùm <class/skill>", "tạo build", "make me a X build".
- User gives an archetype + targets ("spectre witch ~2M DPS, 5k ES").
- User wants a starting PoB they can open and tweak, or wants a build's passive /
  gem choices optimized against a target metric.

## The conversational workflow (you drive this)

1. **Gather references.** Pull the relevant POE2 data before designing:
   - Top builds of the archetype from poe.ninja (`/pob` analyze on a
     poe.ninja/poe2 URL) — for tree/gear/gem ideas, NOT to fork.
   - Skill/gem names + uniques from the wiki (`/poewiki`) or
     `data/pob-source/src/Data/`.
   - Class + ascendancy names from `/passive-skill-tree classes`.
2. **Propose the build in chat** (owner voice, prose): class/ascendancy, main
   skill + supports, key uniques, tree notable plan, expected stats + reasoning.
   Let the user steer BEFORE materializing.
3. **Materialize → verify loop.** Write a spec JSON, run `run.sh build`, read the
   stats, compare to targets, adjust the spec, re-run. Optionally run
   `run.sh optimize` with candidate nodes/gem-swaps to climb a target metric.
   Bounded (~5 passes); if you can't hit the bar, report best-effort + the gap.
4. **Publish** → return the viewable link.

## Spec shape (JSON)

Class and ascendancy are given **by name** — PoB resolves them internally (no
class ids). Gems are `"Name level/quality"` strings; items are full PoB item
text; tree nodes are GGG node ids.

```json
{
  "level": 90,
  "class": "Witch",
  "ascendancy": "Infernalist",
  "skills": [
    { "label": "Main", "gems": ["Spark 20/20", "Spell Echo 20/0"], "main": 1 }
  ],
  "items": [
    { "slot": "Helmet", "text": "Rarity: NORMAL\nRusted Greathelm\nRusted Greathelm" }
  ],
  "tree": { "treeVersion": "0_4", "nodes": [4739, 44871] },
  "optimize": { "target": "TotalDPS", "tryNodes": [12345], "trySwaps": [] }
}
```

- `ascendancy` — omit or `""` for none. Must be a real ascendancy of the class
  (e.g. Witch: Infernalist, Blood Mage, Lich, Abyssal Lich in 0.4 data).
- `skills[].gems` — `"Name level/quality"`. The first gem (or `main`) is the
  active skill; the rest are supports in the same group.
- `items[].slot` — exact PoB slot: `Weapon 1/2`, `Helmet`, `Body Armour`,
  `Gloves`, `Boots`, `Amulet`, `Ring 1/2`, `Belt`, `Flask 1/2`, `Charm 1/2/3`.
- `items[].text` — full PoB item text (Rarity line, name, base type, mods).
- `tree.nodes` — allocatable passive node ids (leaf ids auto-fill their path).
- `optimize` (optional) — `target` is any stat key (`TotalDPS`, `TotalEHP`,
  `Life`, …). `tryNodes` = node ids to consider allocating; `trySwaps` =
  `{ group, index, gem }` gem replacements. Greedy: each candidate is kept only
  if it raises the target, else reverted.

## Running

```bash
SC=.claude/skills/build-creator/scripts

$SC/run.sh build  <spec.json>            # → {status, stats, code}
$SC/run.sh build  <spec.json> --publish  # also POST to pobb.in → {…, published}
$SC/run.sh optimize <spec.json>          # run the spec's optimize block
$SC/run.sh analyze <pob-code>            # load a code, print {stats, class, level}
$SC/run.sh test                          # run the Lua test suite
```

`run.sh` sets the PoB headless env, `cd`s into `data/pob-source/src`, and runs
`main.lua`. Spec paths are resolved against your invocation directory.

## Publishing

- **pobb.in** (headless, default via `--publish`): `publish.toPobbin(code)`
  shells out to `curl` and returns `https://pobb.in/<id>`. The `/<id>/raw`
  endpoint always serves the code (import into PoB2 desktop); the HTML viewer may
  302/error for very sparse builds.
- **poe.ninja** (the viewer users usually want): the upload API is browser-gated,
  so it must run in the user's Chrome. Use `playwriter`: navigate to
  `https://poe.ninja/poe2/pob`, then eval the JS from `publish.poeninjaSnippet(code)`
  in the page context — it POSTs `/poe2/pob/api/upload` and returns the absolute
  `poe.ninja/poe2/pob/<id>` link. **This step needs the user's browser running.**

## One-time env setup

POB2 headless runs on `luajit` against `data/pob-source`. Native lua deps:

```bash
luarocks --lua-version=5.1 --lua-dir=/opt/homebrew/opt/luajit install luautf8 luafilesystem lua-zlib
```

(If `luarocks` errors with a bad lua interpreter, `brew reinstall luarocks` first.)

## Caveats

- `data/pob-source` is POE2 0.4-era. After 0.5 launch (2026-05-29) refresh it
  (`/pob` `fetch-poe2-data.sh`); ascendancy names, item bases, gem names, and
  node ids shift. The fixtures (`scripts/fixtures/`) and any data-coupled test
  literals may need updating — `run.sh test` surfaces breakage.
- The toolkit is *more* robust to data churn than hand-XML because PoB serializes
  whatever version it actually loaded.
- Jewels socketed into tree sockets are not constructed yet (slot ids exist but
  aren't wired) — future work.
- "Optimized" = the per-request target the user sets; the verify/optimize loop is
  the judge, not vibes.

## Gotchas (PoB headless) — learned the hard way

- **Revert with `CreateUndoState`/`RestoreUndoState`, not `DeallocNode`+`AllocNode`.**
  `optimize.lua` reverts *additions* it just made, which is symmetric. But for
  REMOVING an existing node (trim/swap) and measuring marginal loss, re-`AllocNode`
  does NOT restore the node's attribute choice — `SwitchAttributeNode` defaults to
  Strength, silently corrupting Str/Dex/Int and drifting every later measurement
  down (observed: a 147pt trim reported 397k DPS instead of the true 491k).
  `CreateUndoState` captures `hashOverrides` (= attribute choices), so
  snapshot/restore is the only correct revert for removals.
- **"0 DPS loss" ≠ "safe to cut".** `mainOutput.TotalDPS` is all the greedy sees;
  it is blind to mechanics. Cutting `Blood Magic` (flips skill cost life→mana) or
  rage/warcry nodes scores 0 DPS loss yet can break the build. PoB calc is also
  **config-dependent** — rage at 0 stacks in the build config makes rage nodes
  read 0 DPS even if they matter in play. Always surface the cut list for human
  vetting; never auto-apply.
- **Tree trim only removes leaves.** A node is safe to deallocate iff
  `#node.depends == 1` (only itself depends on it). Cutting a bridge cascades and
  orphans everything downstream. `DeallocNode` re-runs `BuildAllDependsAndPaths`,
  so `depends` is fresh each round.
- **PoB logs via `ConPrintf`→`print`→stdout.** Silence it (noop `print` around the
  `dofile`, then noop `ConPrintf`) or machine-readable JSON output gets polluted.

## Files

```
scripts/
  run.sh            # env wrapper → luajit main.lua "$@"
  main.lua          # process entry: parse argv, dispatch, print JSON
  cli.lua           # library: runBuild / runAnalyze (pure, no side effects)
  engine.lua        # HeadlessWrapper substrate: init/commit/stats/selectClass/setLevel
  construct.lua     # JSON spec → loaded build (class/ascend/level/skills/items/tree)
  export.lua        # SaveDB → url-safe PoB code; decode codes back to XML
  optimize.lua      # in-process greedy hill-climb (nodes + gem swaps)
  publish.lua       # pobb.in via curl + poe.ninja playwriter snippet
  lib/json.lua      # pure-Lua JSON decode/encode
  fixtures/*.json   # sample specs
  tests/*.lua       # bun-free Lua test harness + per-feature tests
```

```bash
.claude/skills/build-creator/scripts/run.sh test
```
