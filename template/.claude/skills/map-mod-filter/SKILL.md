---
id: map-mod-filter
name: Waystone & Tablet Mod Filter (POE2) - Stash Tab Regex Decoder & Generator
description: Decode and generate Path of Exile 2 stash tab search regex for Waystones, Tablets, and rare items. Understand poe.re algorithm, Waystone-mod-to-regex mapping, and bulk trade filtering on pathofexile.com/trade2. POE2 0.5+ "Runes of Aldur" league-aware.
source: derived from POE1 map-mod-filter skill
tags: [poe, poe2, regex, stash, trade, waystone, tablet, runes-of-aldur]
version: 1.0.0
triggers:
  - "poe2 regex"
  - "waystone regex"
  - "tablet regex"
  - "poe.re poe2"
  - "waystone mods"
  - "stash tab search poe2"
  - "bulk buyer poe2"
  - "waystone mod filter"
  - "tablet mod filter"
  - "!s rec poe2"
  - "trade regex"
quality: validated
---

# Waystone & Tablet Mod Filter — POE2 Stash Tab Search Decoder

## Scope

POE2 only — `pathofexile.com/trade2` and POE2 stash tabs. For POE1 maps, use the sister `map-mod-filter` skill. POE2 has Waystones (not Maps) and Precursor Tablets (not Sextants), and the mod pool differs entirely.

POE2 0.5 "Runes of Aldur" (2026-05-21 patch / ~2026-05-29 launch) adds **Remnant Runic Recipes** which generate runic modifiers on monster waves but **do not** change the Waystone modifier pool itself. Existing waystone regex remains valid through 0.5 unless GGG reworks waystone mods (none announced in patch notes).

## The Insight

POE stash tab regex is NOT standard regex — it's a simplified substring search that matches against **mod text lines** on items. Tools like poe.re generate the **shortest unique substring** for each mod so the regex stays under POE's 50-character limit. Understanding this algorithm lets you decode any regex back to the mods it targets, and generate new ones.

The algorithm is identical between POE1 and POE2 — what differs is the **mod text corpus** the substring is searched against. POE2 has a smaller, redesigned mod pool (see 0.3.0 waystone rework: every mod now has a downside + specific upside + drop chance bonus).

## Why This Matters (POE2)

- TFT POE2 bulk trade posts include regex filters specifying acceptable waystones
- Bulk waystone deals at 0.5 launch will be regex-gated almost immediately
- Without decoding these, you can't evaluate bulk deals correctly or fulfill orders
- The regex is NOT filtering map names — it filters **Waystone modifier text**
- POE2 0.3+ waystones each have a **downside + upside** — bulk buyers regex-out the dangerous downsides, sellers regex-in the desirable upsides (pack size, quantity, rarity)

## Recognition Pattern

- User shares a POE2 regex string and asks what it means
- Evaluating TFT POE2 bulk buyer/seller posts with regex requirements
- Need to generate regex for filtering waystones / tablets in POE2 stash tabs
- Any discussion of waystone mods and which waystones are "runnable"
- User asks about pathofexile.com/trade2 stat filters and stash regex limits

## The Approach

### Decoding Regex

1. **`!s` prefix** = NOT (exclude waystones matching this regex)
2. **`|` separator** = OR (any of these patterns)
3. Each segment is a **shortest unique substring** of a mod's text
4. `$` means end-of-line anchor
5. Regex case-insensitive, character limit 50 per search field (same as POE1)

### Common POE2 Waystone Mod Regex Fragments (high tier)

Source: `data/wiki/List_of_modifiers_for_waystones_(high_tier).md`

| Fragment | Mod text (POE2) | Why dangerous / desired |
|----------|----------------|------------------------|
| `rec` | Monsters **rec**over damage / **rec**eive damage variants | Often dangerous (defensive mods on monsters) |
| `extra fi` | Monsters deal X% of Damage as Extra **Fi**re | Extra fire damage (Infernal) |
| `extra co` | Monsters deal X% of Damage as Extra **Co**ld | Extra cold damage (Frostbitten) |
| `extra li` | Monsters deal X% of Damage as Extra **Li**ghtning | Extra lightning damage (Thunderous) |
| `extra ch` | Monsters deal X% of Damage as Extra **Ch**aos | Extra chaos damage (Profane) |
| `2 add` | Monsters fire **2 add**itional Projectiles (of Splitting) | Extra projectiles |
| `chill` | Players are **Chill**ed by monster attacks | Action speed loss |
| `freeze` | Monsters have +X% chance to **Freeze** | Crowd control on player |
| `shock` | Monsters have +X% chance to **Shock** | Damage taken amplifier |
| `ignit` | Monsters have +X% chance to **Ignit**e | DoT pressure |
| `pack` | +X% to Monster Pack Size | **DESIRED** upside |
| `quantity` | +X% increased Item **Quantity** | **DESIRED** upside |
| `rarity` | +X% increased Item **Rarity** | **DESIRED** upside |
| `waystones f` | X% increased **Waystones f**ound in Area | **DESIRED** upside (sustain) |

**Confidence: MEDIUM** — these fragments are derived from the 0.4 waystone mod corpus. Run the regex generator (see below) against the 0.5 mod list once league is live to validate uniqueness — patch 0.5 may shift the unique-substring boundary.

### Common POE2 Tablet Mod Regex Fragments

Tablets augment the Atlas — bulk buyers care about scaling mods (pack size, rarity, league mechanic spawn chance). Regex is applied to the Tablet's affix text the same way as Waystones.

| Fragment | Mod family |
|----------|-----------|
| `breach` | "Maps in Range contain Breaches" / "Breaches in your Maps contain ..." |
| `delir` | Delirium mod family |
| `expedi` | Expedition mod family |
| `ritual` | Ritual mod family |
| `essence` | Essence mod family |
| `monoli` | "Maps in Range contain X additional Monoliths" |
| `pack` | Pack size scaling |
| `rarity` | Item Rarity scaling |

### poe.re Algorithm (hawolt/poe-regex)

**Source:** https://github.com/hawolt/poe-regex

The hawolt poe-regex repo ships separate config files per game — POE2 config (`waystone.mods.config` / `tablet.mods.config`) is loaded for POE2 mode.

**Config format:**
```
$ID;active;[category];[bypass=IDs];[fallback=regex];Full Mod Text
```
- `bypass=37` — skip association with mod $37 (semantic alias)
- `fallback=ex co` — if no unique substring found, use this regex instead
- POE2 categories: empty (regular waystone mods), `corrupted`, `precursor` (Tablet-specific)

**Core algorithm** (`FilterModifierAll.ts`):
1. For each selected mod, generate ALL possible substrings of the mod text
2. Filter out blacklisted substrings (common words: `to`, `you`, `the`, `with`, `monsters`)
3. For each substring, check if it's **unique** — only matches the selected mod and NO other unselected mods in the active corpus
4. Sort by length → pick the **shortest unique substring**
5. If no unique substring exists → use the predefined `fallback` regex
6. Combine all results with `|` separator
7. Prefix with `"!s "` if user wants to EXCLUDE these mods

**Number optimization** (`MinNumRegex.ts`):
- Converts numeric thresholds to regex (e.g., +30% pack size minimum → `[3-9]\d%`)
- Used for mods with `#%` values when user sets minimum thresholds (e.g. "pack size ≥30%")

### Practical: Evaluating Bulk Trade Deals (POE2)

When a TFT POE2 post says "buy 100 T15 waystones with regex filter":
1. **Decode the regex** to understand which mods are excluded (downsides) or required (upsides)
2. **Estimate rejection rate** — POE2 waystone mods are **fewer** than POE1 maps but **every mod has a downside**, so ~50-60% of rare-rolled waystones fail typical regex
3. **Adjust cost calculation** — need to buy ~160-180 waystones to get 100 that pass a strict regex
4. **Consider alternatives** — selling unrolled waystones (white/magic) is cheaper supply-side, but bulk buyers nearly always want pre-rolled rares to skip currency cost

### Trade API Note (POE2)

POE2 trade lives at `/api/trade2/` (NOT `/api/trade/` — that's POE1). Use the project's `trade` skill for actual trade interaction. Direct API calls should go through CDP Relay per project rules — never raw curl to pathofexile.com from this environment.

Reference shape (do **not** run with curl per project rules — use CDP Relay):

```json
POST https://www.pathofexile.com/api/trade2/search/<LEAGUE>
{
  "query": {
    "status": {"option": "online"},
    "filters": {
      "type_filters": {
        "disabled": false,
        "filters": {
          "category": {"option": "map"},
          "rarity": {"option": "rare"}
        }
      },
      "map_filters": {
        "disabled": false,
        "filters": {
          "map_tier": {"min": 15, "max": 16}
        }
      }
    }
  },
  "sort": {"price": "asc"}
}
```

> Note: `category: "map"` is the API category umbrella for Waystones on trade (legacy naming carried over from POE1). The on-site filter is labelled "Waystone Tier".

## Example

Decoding `"!s extra co|extra li|2 add|chill"`:
- `!s` → EXCLUDE mode (NOT match)
- `extra co` → Monsters deal extra cold damage (Frostbitten)
- `extra li` → Monsters deal extra lightning damage (Thunderous)
- `2 add` → Monsters fire 2 additional Projectiles (of Splitting)
- `chill` → Players are Chilled by monster attacks

**Result:** Buyer wants rare T15+ waystones WITHOUT extra cold, extra lightning, extra projectiles, or chilling ground. Likely a non-cold, ranged squishy build (probably a Ranger or Witch ranged setup) that can't handle elemental amplifiers or chill-induced positioning loss.

## Regex Generator Stub

A stub Bun/TypeScript regex generator lives at `scripts/generate-regex.ts`. It loads the POE2 waystone mod corpus (you must provide it — see TODO at top of script) and applies the hawolt algorithm.

```bash
cd .claude/skills/map-mod-filter

# Generate exclude regex for a list of mod fragments
bun scripts/generate-regex.ts --exclude "extra cold,extra lightning,additional Projectiles,Chilled"

# Generate include regex for desired upsides
bun scripts/generate-regex.ts --include "pack size,quantity,rarity"
```

**Status:** Script is a working stub with the algorithm wired up but **the POE2 0.5 mod corpus is not yet bundled**. See `scripts/README.md` for the data-fetch TODO.

## TODOs at 0.5 Launch (2026-05-29)

- [ ] Fetch the live POE2 0.5 waystone mod list from poe2wiki.net (`List_of_modifiers_for_waystones_(high_tier)`, `(mid_tier)`, `(low_tier)`) and bundle into `data/map-mods/waystone-mods-0.5.json`
- [ ] Fetch the live POE2 0.5 tablet mod list from poe2wiki.net and bundle into `data/map-mods/tablet-mods-0.5.json`
- [ ] Re-validate the "common fragments" table above — 0.5 may shift unique-substring boundaries if any new mod shares text with an existing one
- [ ] Check if 0.5 adds **Remnant-specific waystone mods** (none announced in patch notes — but Remnants drop *inside* maps, so waystone mod pool likely unchanged)
- [ ] Validate `pathofexile.com/trade2` API endpoint shape didn't change in 0.5 (last verified 0.4)
- [ ] Update poe.re upstream config from https://github.com/hawolt/poe-regex if maintainer ships a 0.5 update

## References

- [poe.re](https://poe.re/) — community waystone regex generator (POE2 mode available)
- [hawolt/poe-regex](https://github.com/hawolt/poe-regex) — algorithm + config source
- [POE2 Wiki — List of modifiers for waystones (high tier)](https://www.poe2wiki.net/wiki/List_of_modifiers_for_waystones_(high_tier))
- [POE2 Wiki — Waystone](https://www.poe2wiki.net/wiki/Waystone)
- [POE2 Wiki — Precursor Tablet](https://www.poe2wiki.net/wiki/Precursor_tablet)
- Local POE2 wiki mirror: `data/wiki/`
- POE2 0.5 patch notes: `data/release-notes/Version_0.5.0.md`
- Project skill `/trade` — for actual POE2 trade search via CDP Relay
- Project skill `/lootfilter` — companion POE2 loot filter skill
