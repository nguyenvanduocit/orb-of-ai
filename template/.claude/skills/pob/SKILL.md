---
skill_name: pob
description: Analyze and calculate Path of Building 2 (POE2) builds from poe.ninja, mobalytics.gg, or pobb.in URLs
version: 2.7.1
tags: [pob, path-of-building, builds, decoder, pobb.in, poe.ninja, mobalytics, poe2, calculations, dps]
---

# Path of Building 2 Skill

Analyze PoE2 builds from **poe.ninja**, **mobalytics.gg**, or **pobb.in** URLs.

**Use this skill when:**
- User provides a build URL from any supported source
- User needs DPS/defensive calculations
- User wants to compare build stats
- User asks about equipment, gems, or keystones

## Analysis Discipline — read every mod before any verdict (MANDATORY)

Lesson burned in from a real session (2026-06-12, ThaoCamVienSaiGon): three wrong verdicts in a row — "the pack has no crit" (Zekoa carried the **Extra Crits** retained mod), "Uruk's Smelting is dead on Repulsion" (Mark for Death II makes **all hits** vs Marked break armour, and Repulsion Wave hits ~2/s, so the placement was correct), "Healing Runes is dead, no Ward source" (Refutation costs 11 Ward and was a core active skill — the pool existed). Every one came from reasoning off gem **names** and PoB Lua **paraphrases** instead of reading the actual mods. Do not repeat this.

Before ANY interaction claim or build verdict about a character:

1. **Dump and read the full gem text first — every group, every gem, every line.** The poe.ninja model JSON (`data/character-exports/export-<char>.json`) carries the real in-game tooltips under `charModel.skills[].allGems[].itemData`:
   - `gemTabs[].pages[].stats` — verbatim stat lines per gem and per sub-skill
   - `properties` — Level / Quality / **Reservation** (flat vs % spirit lives here)
   - `socketedItems[]` — each support's actual stats + `SupportGemCategory` (exclusion group)
   - `tamedBeastProperties` — **retained monster mods on tamed beasts** (Extra Crits, All Damage Shocks, auras live HERE, not in any gem name)
2. **Item mods too, every array:** `explicitMods`, `runeMods`, `craftedMods`, `fracturedMods`, `desecratedMods`, `enchantMods` (anoint), `grantedSkills` per slot. Granted skills from weapon-set-2 items are dormant — listed but not reserving.
3. **Source order: in-game tooltip (export JSON) > PoB Lua data > patch notes/poedb > intuition.** PoB Lua `description` fields are paraphrases and HAVE misled before. Quote the verbatim stat line as evidence for every interaction verdict.
4. **Absence claims need a full scan.** "The build has no X" is only valid after grepping the entire export (all gems + all items + quest stats + beast mods). One retained beast mod invalidates the verdict.
5. **Support exclusion comes from `SupportGemCategory` in the tooltip**, not from memory: e.g. Romira's Requital and Loyalty share category "Loyalty" (per-skill exclusion); Lineage supports are one copy each per build.
6. **When the player contradicts your read, they are looking at the client and you are looking at a snapshot.** Re-dump, re-read, then answer — never defend an unverified claim.

## Quick Start

```bash
# Auto-detects source from URL
.claude/skills/pob/scripts/scripts/analyze.sh "https://mobalytics.gg/poe-2/builds/bear-druid-build"
.claude/skills/pob/scripts/scripts/analyze.sh "https://poe.ninja/poe2/builds/vaal/character/account/CharName"
.claude/skills/pob/scripts/scripts/analyze.sh "https://pobb.in/abc123"

# Or use the POB2 CLI directly (after setup) with raw POB code
data/pob-source/pob-cli.sh calc @/path/to/pob-code.txt
```

## Setup

If POB2 is not installed, run the setup script:

```bash
.claude/skills/pob/scripts/setup.sh
```

**Idempotent — safe to re-run.** Each step is skipped if its output is already in place:

1. **Clone PathOfBuilding-PoE2** → `<project-root>/data/pob-source/` via `fetch-poe2-data.sh` (skipped if `.git` exists; refresh by running the fetch script directly)
2. **Install lua-zlib** via luarocks for Lua 5.1 (skipped if `luarocks show lua-zlib` returns OK)
3. **Patch `src/HeadlessWrapper.lua`** with zlib `Deflate`/`Inflate` impls (skipped if marker `zlib.deflate()(data, "finish")` already present)
4. **Sync CLI helpers** (`pob-cli.sh`, `pob-cli.lua`, `cli_test.lua`) from skill dir → install dir (skipped per-file if `cmp -s` reports identical)
5. **Smoke test** by running `pob-cli.sh new`

**Requirements:**
- luajit (`brew install luajit`)
- luarocks (`brew install luarocks`)
- git

## Scripts

### analyze.sh

Unified analyzer that auto-detects the source from URL.

```bash
.claude/skills/pob/scripts/scripts/analyze.sh <url> [command]
```

**Supported sources:**
- `mobalytics.gg/poe-2/builds/...`
- `poe.ninja/poe2/builds/.../character/...`
- `pobb.in/...`

**Commands:**
- `calc` - Full build data (default): info, stats, equipment, gem links, keystones
- `stats` - DPS and defensive stats only
- `info` - Class, level only

**Examples:**
```bash
.claude/skills/pob/scripts/scripts/analyze.sh "https://mobalytics.gg/poe-2/builds/bear-druid-build"
.claude/skills/pob/scripts/scripts/analyze.sh "https://poe.ninja/poe2/builds/vaal/character/account/CharName"
.claude/skills/pob/scripts/scripts/analyze.sh "https://pobb.in/abc123" stats
```

### extract-tree.sh

Extract passive skill tree from a POB build.

```bash
.claude/skills/pob/scripts/scripts/extract-tree.sh <url-or-file> [format]
```

**Formats:**
- `json` - Full JSON with all nodes, mods, and IDs (default)
- `summary` - Counts and key node names only
- `nodes` - List all nodes with their mods, grouped by type

**Examples:**
```bash
# Summary view
.claude/skills/pob/scripts/scripts/extract-tree.sh "https://mobalytics.gg/poe-2/builds/bear-druid" summary

# Full JSON
.claude/skills/pob/scripts/scripts/extract-tree.sh @pob-code.txt json

# All nodes with mods
.claude/skills/pob/scripts/scripts/extract-tree.sh "https://poe.ninja/..." nodes
```

**Output includes:**
- Keystones (with mods)
- Notables (with mods)
- Ascendancy nodes (with mods)
- Small passive nodes
- Mastery selections

### fetch-poe2-data.sh

Fetch the PathOfBuilding-PoE2 repository for local game data access.

```bash
.claude/skills/pob/scripts/scripts/fetch-poe2-data.sh
```

**What it does:**
- Clones or updates PathOfBuilding-PoE2 repository to `<project-root>/data/pob-source/`
- Provides local access to game data (skills, items, gems, mods, minions)
- 572M git clone — kept out of skill tree so cloning the repo doesn't pull a Lua fork inside `.claude/skills/`.

**Key data locations:**
- `data/pob-source/src/Data/Skills/` - All skill definitions
- `data/pob-source/src/Data/Gems.lua` - Gem data
- `data/pob-source/src/Data/Uniques/` - Unique items
- `data/pob-source/src/Data/Minions.lua` - Minion data
- `data/pob-source/src/Data/Mod*.lua` - Item modifiers

**Use when:**
- Need to query game data programmatically
- Want to reference official PoB data sources
- Setting up local development environment

### fetch-poeninja.sh

Fetch the PoB code from poe.ninja (without analysis). Handles **two** poe.ninja surfaces:

**A. Own profile (any connected character — including low-level leveling chars):**

```bash
.claude/skills/pob/scripts/scripts/fetch-poeninja.sh \
  "https://poe.ninja/poe2/profile/{account}/{league}/character/{character}"
# account uses '-' for '#', e.g. hopthuxacnhan-3062 ; league is the slug, e.g. runesofaldur
```

This is the **no-OAuth, zero-ban-risk path to a live-played POE2 character** — poe.ninja runs its
own OAuth integration with GGG, so it surfaces POE2 chars that GGG's own website profile does not
(the pathofexile.com profile is POE1-only — verified). The script resolves the latest snapshot id
dynamically via the events SSE stream (`events/character/...` → `data: {"version":<id>}`), then
fetches `.../model/<id>`. Besides printing the PoB code, it saves the **full model JSON** (rich
`defensiveStats`, `items`, `skills`, `keystones`, `jewels`, `passiveSelection` that poe.ninja
already computed) to `data/character-exports/export-<character>.json`.

> **Snapshot, not live — force a fresh crawl first.** poe.ninja only re-crawls on its own schedule
> (can be 6h+ stale). The script logs `updatedUtc` — if it's old, the numbers are old. To get current
> data on demand, click **"Refresh character"** on the poe.ninja profile page (it makes poe.ninja
> re-pull live from GGG via *their* OAuth — no GGG call from us, no ban risk), THEN run the fetch (it
> auto-resolves the new model via the events SSE). Refresh via playwriter:
> ```js
> await state.page.goto('https://poe.ninja/poe2/profile/<account>/<league>/character/<char>', {waitUntil:'domcontentloaded'});
> await state.page.getByRole('button', { name: 'Refresh character' }).click();   // → new model id
> await state.page.waitForTimeout(6000);
> ```
> Only works while the character stays public/connected on poe.ninja.
> **Analyze 0.5 chars from the saved model JSON, not PoB2** — PoB2 0.4 can't yet model 0.5 Spirit
> Walker / companion scaling (returns DPS 0). poe.ninja's `defensiveStats` + skill `damage` are the
> trustworthy numbers until the PoB2 fork catches up (`pob_coverage: PARTIAL`).

**B. Builds ladder (laddered characters only):**

```bash
.claude/skills/pob/scripts/scripts/fetch-poeninja.sh \
  "https://poe.ninja/poe2/builds/{league}/character/{account}/{character}" build-code.txt
```

> Live-equipment pull for POE2 now exists via `fetch-live.sh` (below) — it reads the pathofexile2.com
> website's own internal-api through Playwriter, no OAuth. It returns EQUIPMENT ONLY though; passives/
> skills/quest-stats still come from poe.ninja's computed model, and OWN-stash has no API at all. GGG's
> character OAuth API (`api.pathofexile.com/character/poe2/<name>`) would also give passives+skills live,
> but requires registering a developer app + token (heavyweight, account was previously flagged) — use
> only if a future need demands it.

### fetch-live.sh

Pull **LIVE** character equipment straight from the pathofexile2.com website (the new POE2 site), driven through Playwriter. This is the freshest no-OAuth path — it reflects the character the instant GGG's own site does, with full raw item mods (every resist roll, rune, socketed gem, flask), richer than poe.ninja's pre-computed `defensiveStats`.

```bash
.claude/skills/pob/scripts/scripts/fetch-live.sh [character-name]
```

- Omit the name to just **list** the account's characters (id + name + level + class + league).
- With a name → saves the raw GGG-shape JSON to `data/character-exports/live-<name>.json` (gitignored).

**Examples:**
```bash
.claude/skills/pob/scripts/scripts/fetch-live.sh ThaoCamVienSaiGon
.claude/skills/pob/scripts/scripts/fetch-live.sh        # list characters
```

**How it works (and why it's ban-safe):** the script drives an already-logged-in pathofexile2.com tab to view your own character page. The site's SPA fires the `internal-api/my-account/character/<id>` request with its **own DPoP token**, and we only intercept the *response* — we never read, store, or replay the token, so auth stays inside the browser, same-origin. Same same-origin safety model as the trade transport; it's just you viewing your own character. (name→id is resolved from the SPA's `localStorage` roster, because the list network call only fires on the first visit.)

**Scope — EQUIPMENT ONLY.** This endpoint does not expose passive tree, skills, or quest stats (confirmed: the DPoP token's permission set has only `my-account|character` + `my-account|characters`). For passives / skills / quest-buffs / computed EHP+res, use `fetch-poeninja.sh` — poe.ninja gets those from GGG's official OAuth API. The two sources are complementary: live equipment here + computed stats from poe.ninja.

**Requirements:** Chrome open with the Playwriter extension enabled on a tab (click the extension icon once if you hit a connection timeout). CLI: `npm i -g playwriter@latest`.

**Tab reuse:** the script persists one Playwriter session (`tmp/.pob-playwriter-session`) and reuses a single tab across runs — no new tab per invocation. A dead session (e.g. after a relay restart) is detected and recreated automatically. On a reused tab the roster is read straight from `localStorage`, so repeat pulls skip the list-page navigation entirely.

> **Interim transport.** This uses the Playwriter package for now; it will be reimplemented inside our own browser extension later.

### pob-cli.sh

Direct POB2 CLI for analyzing build codes. **Must run from the install dir** (`data/pob-source/`) because it expects `src/HeadlessWrapper.lua` and `runtime/lua/` siblings — the source-of-truth copy in `.claude/skills/pob/scripts/` is for git tracking, not direct execution.

```bash
data/pob-source/pob-cli.sh <command> [pob-code]
```

**Commands:**
- `new` - Create empty build and show default stats
- `calc <code>` - Full calculation (info + stats)
- `stats <code>` - Stats only
- `info <code>` - Info only
- `help` - Show help

**File Input:**
Use `@` prefix to read code from file:
```bash
data/pob-source/pob-cli.sh calc @/path/to/code.txt
```

### Fetch a live character — `--oauth`

Pull a live POE2 character and turn it into a PoB code in one command. POE2 character data (equipment + passives + skills) lives on the OAuth API `api.pathofexile.com/character/poe2/<name>`; `--oauth` runs the same `client_id=pob` PKCE flow Path of Building's desktop import uses.

```bash
data/pob-source/pob-cli.sh --oauth <character> [realm]      # realm defaults to poe2
data/pob-source/pob-cli.sh --oauth --list [realm]           # list account characters
data/pob-source/pob-cli.sh --token <bearer> <character>     # reuse an existing token
```

First run prints an authorize URL and opens a `localhost:49082` catcher — open the URL in a browser on this machine (logged into pathofexile.com), click **Authorize**, and the flow captures the token (cached in `tmp/.poe-oauth.json`, ~10h, auto-refreshed via the refresh token), fetches the character, and emits a PoB code through `export-pob`. To skip the browser step, paste a token from PoB desktop's `Settings.xml` (`lastToken`) with `--token`.

Output is `export-pob`'s JSON `{ code, imported, info, stats }`; feed `code` to `pob-cli.sh calc @file`.

> Companion / Spirit Walker builds: tree, skills, ascendancy, gear and defense import accurately, but PoB2 does not model companion (Tame Beast) damage, so `combinedDPS` reads 0 — reason companion DPS by hand (`pob_coverage: PARTIAL`).

### export-pob.sh

The serializer `--oauth` builds on: turns a **GGG character-API JSON** into a PoB code by reusing Path of Building's own import + export Lua — `ImportItemsAndSkills` / `ImportPassiveTreeAndJewels` to parse, `base64(Deflate(SaveDB("code")))` to serialize. No hand-rolled parsing, no engine edits, no network in-tool.

```bash
data/pob-source/export-pob.sh <charData.json>     # also accepts @file
```

**Input shapes** (auto-normalised to the inner charData):
- OAuth `/character/poe2/<name>` → `{ character: { equipment, skills, passives, jewels } }` — full build code (tree + skills + gear + defense).
- `fetch-live.sh` (pathofexile2.com internal-api) → `{ data: { equipment } }` — equipment-only → gear-only code (defense from item rolls; no tree/skills). Missing `skills`/`jewels` arrays normalise to empty so item import still runs.

## Attribute & Level Requirements (`requirements.ts`)

`bun .claude/skills/pob/scripts/requirements.ts <export.json> [--candidate "str:114,martial"] [--global-reduced N] [--json]`

Reads a character export JSON (the poe.ninja model saved by `fetch-poeninja.sh`) and reports every item + gem requirement, the binding (max) requirement per attribute, the character's attributes, and headroom. The value-add is the EFFECTIVE requirement the export does not precompute.

**Where requirements live in the export:** item base req in `items[].itemData.requirements` (`{name:"[Strength|Str]", values:[["36",0]]}`); socketed gems in `socketedItems[].itemData.requirements` (+ `weaponRequirements` / `supportGemRequirements`); character attributes in `defensiveStats.{strength,dexterity,intelligence}`; level in `level`; keystones in `keystones[].name`; Bonded-active flag in `enableBondedMods`.

**Effective-requirement rules (verified):**
- **Giant's Blood** keystone triples the attribute requirement of Martial Weapons — and it triples ALL THREE attributes (Str/Dex/Int) of the wielded weapon, not just Str. A high-Int weapon req balloons your Int floor too. Caster weapons (Wand/Sceptre/Focus) are not martial, so they are not tripled.
- **`#% reduced Attribute Requirements` is ALWAYS LOCAL** (wiki `Explicit_modifier`): it lowers only the requirements of the item it sits on — never another item's, never a socketed gem's. The canonical mod name carries the word `Local` (e.g. `ReducedLocalAttributeRequirements3` = 25%). A reduced-req helm does NOT help you wield a high-req weapon.
- The only character-wide reduction is worded **`Equipment and Skill Gems have #% reduced Attribute Requirements`** (passive notables ~4%/node, a few uniques). The export does not carry tree-node stat text, so pass `--global-reduced N` to supply a tree total.
- The binding requirement is the MAX effective requirement across all items + gems.

**Worked example (why the tool exists):** checking The Hammer of Faith (Giant Maul, Str 114) on ThaoCamVienSaiGon via `--candidate "str:114,martial"` returns effective 342 (114×3), char Str 150 → SHORT 192. A local 35% tiara mod does nothing for it; even 35% GLOBAL (`--global-reduced 35`) only reaches 223 → SHORT 73. The same run shows the binding Int is 339 (Chober Chaber's Int 113 tripled by Giant's Blood), so Int 361 has only 22 headroom — the build is not sitting on spare Int to convert.

Gotcha: the export's `requirements` field is RAW (pre-Giant's-Blood, pre-reduction). Never read it as the effective floor — run this tool.

## poe.ninja API Reference

### Get Snapshot Versions

```bash
curl -s "https://poe.ninja/poe2/api/data/index-state"
```

Response includes `snapshotVersions` array with:
- `url` - League URL slug (e.g., "vaal", "vaalhc")
- `name` - League name (e.g., "Fate of the Vaal")
- `version` - Snapshot version ID (e.g., "1054-20251218-53431")
- `snapshotName` - Snapshot name (e.g., "fate-of-the-vaal")

### Get Character Build

```bash
curl -s "https://poe.ninja/poe2/api/builds/{version}/character?account={account}&name={name}&overview={snapshotName}"
```

**Parameters:**
- `{version}` - From index-state snapshotVersions
- `{account}` - Account name (URL encoded)
- `{name}` - Character name (URL encoded)
- `{snapshotName}` - From index-state snapshotVersions

**Response includes:**
- `pathOfBuildingExport` - Base64 zlib-compressed XML
- `defensiveStats` - Life, ES, resistances, etc.
- `skills` - All equipped skills with gems
- `items` - All equipped items
- `keystones` - Allocated keystones
- `level`, `class` - Character info

### Example Workflow

```bash
# 1. Get current snapshot version for "vaal" league
VERSION=$(curl -s "https://poe.ninja/poe2/api/data/index-state" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print([s['version'] for s in d['snapshotVersions'] if s['url']=='vaal'][0])")

# 2. Fetch character
curl -s "https://poe.ninja/poe2/api/builds/$VERSION/character?account=wongklun-2431&name=Kai_FotV&overview=fate-of-the-vaal" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['pathOfBuildingExport'])" > build.txt

# 3. Analyze
data/pob-source/pob-cli.sh calc @build.txt
```

## pobb.in Integration

For pobb.in URLs, use the TypeScript client:

```bash
bun .claude/skills/pob/scripts/pob.ts summary https://pobb.in/8-9u-rZYxc0a
bun .claude/skills/pob/scripts/pob.ts skills https://pobb.in/8-9u-rZYxc0a
bun .claude/skills/pob/scripts/pob.ts items https://pobb.in/8-9u-rZYxc0a
```

Or programmatically:

```typescript
import { pobClient } from './.claude/skills/pob/scripts/pob-client';

const build = await pobClient.fetchBuild('https://pobb.in/8-9u-rZYxc0a');
console.log(build.parsed.className);      // "Druid"
console.log(build.parsed.ascendClassName); // "Shaman"
console.log(build.parsed.skills);          // Skill array
```

## Output Stats Reference

The POB CLI outputs these stats:

### Offensive Stats
- `totalDPS` - Total damage per second
- `combinedDPS` - Combined DPS including DoT
- `speed` - Attack/cast speed
- `hitChance` - Chance to hit (%)
- `critChance` - Critical strike chance (%)
- `critMultiplier` - Critical strike multiplier

### Defensive Stats
- `life` - Maximum life
- `energyShield` - Maximum energy shield
- `mana` - Maximum mana
- `armour` - Armour rating
- `evasion` - Evasion rating
- `block` - Block chance (%)

### Resistances
- `fireRes` - Fire resistance (%)
- `coldRes` - Cold resistance (%)
- `lightningRes` - Lightning resistance (%)
- `chaosRes` - Chaos resistance (%)

### Resources
- `lifeRegen` - Life regeneration per second
- `manaRegen` - Mana regeneration per second
- `manaCost` - Mana cost of main skill

## Common Workflows

### Analyze any build

```bash
# Just pass any supported URL
.claude/skills/pob/scripts/scripts/analyze.sh "https://mobalytics.gg/poe-2/builds/bear-druid-build"
.claude/skills/pob/scripts/scripts/analyze.sh "https://poe.ninja/poe2/builds/vaal/character/account/CharName"
```

### Compare two builds

```bash
# Save both builds
.claude/skills/pob/scripts/scripts/fetch-poeninja.sh "url1" build1.txt
.claude/skills/pob/scripts/scripts/fetch-poeninja.sh "url2" build2.txt

# Compare stats
data/pob-source/pob-cli.sh stats @build1.txt > stats1.json
data/pob-source/pob-cli.sh stats @build2.txt > stats2.json
```

### Extract skills for documentation

```bash
data/pob-source/pob-cli.sh info @build.txt | jq '.info.skills'
```

### Check defensive stats

```bash
data/pob-source/pob-cli.sh stats @build.txt | jq '{life, armour, evasion, fireRes, coldRes, lightningRes, chaosRes}'
```

## Troubleshooting

### "POB2 not installed"
Run the setup script:
```bash
.claude/skills/pob/scripts/setup.sh
```

### "lua-zlib not found"
Install lua-zlib for LuaJIT:
```bash
luarocks install lua-zlib --lua-version=5.1
```

### "Character not found"
- Check the URL format: `https://poe.ninja/poe2/builds/{league}/character/{account}/{name}`
- Verify the character exists on poe.ninja
- The character may not be in the current snapshot (try different time machine)

### "Inflate failed"
The PoB code may be corrupted or in an unsupported format. Try:
1. Re-fetch from poe.ninja
2. Check if the code is URL-safe base64 encoded
3. Verify zlib is properly installed

## File Structure

```
.claude/skills/pob/                  # Skill source-of-truth (tracked in git)
├── SKILL.md                         # This file
└── scripts/
    ├── setup.sh                     # Idempotent installer
    ├── pob.ts                       # pobb.in TypeScript client (bun runner)
    ├── pob-client.ts                # pobb.in TypeScript module
    ├── pob-cli.sh                   # POB2 bash CLI (synced to install dir)
    ├── pob-cli.lua                  # POB2 pure-Lua CLI (synced to install dir)
    ├── cli_test.lua                 # CLI test scaffold (synced to install dir)
    ├── export-pob.sh                # GGG charData JSON → PoB code wrapper (synced to install dir)
    ├── export-pob.lua               # Reuses PoB ImportItemsAndSkills/ImportPassiveTreeAndJewels + SaveDB
    └── scripts/
        ├── analyze.sh               # Unified URL analyzer (auto-detects source)
        ├── extract-tree.sh          # Extract passive skill tree
        ├── fetch-poe2-data.sh       # Clone/update PathOfBuilding-PoE2
        ├── fetch-poeninja.sh        # Fetch raw POB code from poe.ninja
        ├── fetch-live.sh            # Pull LIVE equipment from pathofexile2.com (Playwriter)
        ├── fetch-live.js            # Playwriter script driven by fetch-live.sh
        └── fetch-oauth.py           # OAuth client_id=pob PKCE flow → full charData → export-pob (--oauth)

<project-root>/data/pob-source/      # POB2 install + game data (gitignored, ~572MB)
├── .git/                            # Shallow clone of PathOfBuildingCommunity/PathOfBuilding-PoE2
├── src/
│   ├── HeadlessWrapper.lua          # Patched with zlib Deflate/Inflate by setup.sh
│   └── Data/                        # Skills/, Gems.lua, Uniques/, Minions.lua, Mod*.lua
├── runtime/                         # Lua runtime + Windows DLLs (used by HeadlessWrapper)
├── pob-cli.sh                       # Synced from skill dir by setup.sh
├── pob-cli.lua                      # Synced from skill dir by setup.sh
└── cli_test.lua                     # Synced from skill dir by setup.sh
```

**Why split:** the skill dir is tracked in git (so helpers + setup logic survive a wipe of `data/`). The install dir is gitignored — too big to commit, regenerable via `fetch-poe2-data.sh` + `setup.sh`. The CLI must execute from the install dir because `pob-cli.sh` resolves `src/` and `runtime/` relative to its own location.

## Version History

- **2.7.1** - Added mandatory "Analysis Discipline" section: read every gem/support/beast-mod verbatim from the export JSON before any build verdict; tooltip > PoB Lua paraphrase; absence claims require a full scan. Born from the 2026-06-12 session where three verdicts (no-crit pack, Uruk's-dead, Healing-Runes-dead) were wrong because they were reasoned from gem names instead of mods.
- **2.7.0** - Added `--oauth` / `--token` (`fetch-oauth.py`) — fetch a live POE2 character via the `client_id=pob` PKCE flow (the OAuth API `/character/poe2/<name>` is the only source of POE2 charData incl. passives/skills) and emit a PoB code through `export-pob`. PKCE base64url + state check, `localhost:49082` redirect catcher (GGG's registered loopback for `client_id=pob`), curl token-exchange + Bearer char fetch, token cached + auto-refreshed in `tmp/.poe-oauth.json` (gitignored). Verified: ThaoCamVienSaiGon → full charData (16 equipment + passives + 9 skills) → 9584-char code → `calc` shows Huntress / Spirit Walker / Lv66, keystone Trusted Kinship, real defense (Life 1173 / ES 158 / Armour 555 / Eva 825 / res 56-55-59). Companion (Tame Beast) DPS unmodelled by PoB2 → `combinedDPS` 0 (`pob_coverage: PARTIAL`).
- **2.6.0** - Added `export-pob.sh` / `export-pob.lua` — convert a GGG character-API JSON into a PoB2 import code by reusing PoB's own `ImportItemsAndSkills` / `ImportPassiveTreeAndJewels` + `base64(Deflate(SaveDB("code")))`; no engine edits, no in-tool network (new untracked files copied by setup.sh). Captures the file arg before `dofile(HeadlessWrapper)` (Launch.lua rewrites global `arg`); normalises missing `skills`/`jewels` arrays so equipment-only inputs import; settles calc with double `OnFrame` so the stat readout matches the round-trip.
- **2.5.0** - Added `fetch-live.sh` — pull LIVE character equipment from the pathofexile2.com website internal-api via Playwriter (no OAuth, no token replay; intercepts the SPA's own DPoP-authed response). name→id resolved from the SPA `localStorage` roster; equipment re-fetched fresh per visit (tagged `source:"live"`, falls back to `source:"cache"` only if the live intercept misses). Persists one Playwriter session + reuses a single tab across runs (no tab-per-run; dead session auto-recreated). Saves `data/character-exports/live-<name>.json`. Scope is equipment-only — passives/skills/quest-stats stay on `fetch-poeninja.sh`. Interim Playwriter transport (extension reimpl later).
- **2.4.0** - Consolidated POB2 install at `data/pob-source/` (single clone shared with `fetch-poe2-data.sh`). Setup.sh now idempotent — skips clone/lua-zlib/patch/copy steps when output already in place. CLI helpers tracked in skill dir, synced to install dir.
- **2.3.0** - Added extract-tree.sh for passive tree extraction
- **2.2.0** - Unified analyze.sh with auto-detection, rich output
- **2.1.0** - Added mobalytics.gg integration
- **2.0.0** - Added POB2 headless CLI, poe.ninja integration
- **1.0.0** - Initial version with pobb.in support
