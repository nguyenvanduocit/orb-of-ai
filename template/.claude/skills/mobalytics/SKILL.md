---
name: mobalytics
description: Fetch PoE 1 or PoE 2 build data from mobalytics.gg. Use when user provides a mobalytics.gg build URL or asks to import a build from mobalytics. (project)
---

# Mobalytics Build Fetcher

Fetches PoE 1 and PoE 2 build data from mobalytics.gg.
- **PoE 2:** Full YAML output via GraphQL (equipment, skills, passive tree, guide text)
- **PoE 1:** Extracts pobCode from page HTML for use with pob skill

## Quick start

```bash
# PoE 2 (GraphQL, full YAML output)
.claude/skills/mobalytics/scripts/fetch.sh "https://mobalytics.gg/poe-2/builds/bear-druid-build-league-starter-to-endgame"

# PoE 1 (HTML scraping, outputs pobCode)
.claude/skills/mobalytics/scripts/fetch.sh "https://mobalytics.gg/poe/builds/ronarray-absolution-necromancer-build"

# Force PoE 1 mode
.claude/skills/mobalytics/scripts/fetch.sh --poe1 "some-slug"

# From slug only (defaults to PoE 2)
.claude/skills/mobalytics/scripts/fetch.sh "bear-druid-build-league-starter-to-endgame"
```

## Output format

The script outputs YAML with:
- `name`: Build name
- `author`: Author name
- `slug`: URL slug
- `pobCode`: Path of Building export code
- `tags`: Class, ascendancy, patch, build type
- `equipment`: All gear slots with item names and unique status
- `skills`: Active skills with support gems
- `passiveTree`: Node counts for main and ascendancy trees
- `content`: Guide text sections and strengths/weaknesses

## Workflow

1. User provides mobalytics URL
2. Run `fetch.sh` to get build data
3. Use the YAML output to create content in `content/builds/`

## GraphQL API Reference

**Endpoint:** `https://mobalytics.gg/api/poe-2/v1/graphql/query`

**Required Headers:**
```
content-type: application/json
x-moba-client: mobalytics-web
x-moba-proxy-gql-ops-name: Poe2UgFeaturedDocumentQuery
```

**Query Variables:**
```json
{
  "input": {
    "slug": "build-slug-here",
    "type": "builds",
    "widgetsOverride": []
  }
}
```

**Key Response Types:**

| Type | Description |
|------|-------------|
| `Poe2UserGeneratedDocument` | Main build document |
| `Poe2UserGeneratedDocumentData` | Build data (name, pobCode, variants) |
| `Poe2UserGeneratedDocumentBuildVariantEquipment` | Equipment slots |
| `Poe2UserGeneratedDocumentBuildVariantSkillGems` | Skill gem links |
| `Poe2UserGeneratedDocumentBuildVariantPassiveTree` | Passive tree nodes |

**Content Widget Types:**
- `NgfDocumentCmWidgetRichTextSimplifiedV2` - Guide text sections (uses Lexical JSON)
- `NgfDocumentCmWidgetStrengthsAndWeaknessesV1` - Pros/cons (uses Lexical JSON)
- `NgfDocumentCmWidgetVideoV2` - Embedded videos
- `Poe2DocumentUgWidgetEquipmentV1` - Equipment widget
- `Poe2DocumentUgWidgetSkillGemsV1` - Skill gems widget
- `Poe2DocumentUgWidgetPassiveTreeV1` - Passive tree widget

**Lexical JSON Format:**
Rich text content uses Lexical editor format with nested structure:
```
root.children[].children[].text -> actual text content
type: "text" -> text node
type: "static-data-widget" -> game item/skill reference (use .label)
type: "listitem" -> list item container
```

**Equipment Slots:**
`mainHand`, `offHand` (both have `set1`/`set2` for weapon swap), `helmet`, `body`, `gloves`, `boots`, `amulet`, `leftRing`, `rightRing`, `belt`, `flask1`, `flask2`, `charm1`, `charm2`, `charm3`

## Integration with POB Skill

Mobalytics builds include a `pobCode` field containing the Path of Building export code. Use the **pob skill** to analyze this code for detailed DPS calculations and stat breakdowns.

**End-to-end (mobalytics URL → PoB stats):** the pob skill's `analyze.sh` handles mobalytics URLs directly — fetch + analyze in one call:
```bash
.claude/skills/pob/scripts/scripts/analyze.sh "https://mobalytics.gg/poe-2/builds/bear-druid-build"
```

**Manual (extract pobCode, then calc):**
```bash
# 1. Fetch build from mobalytics
.claude/skills/mobalytics/scripts/fetch.sh "bear-druid-build-league-starter-to-endgame" > build.yaml

# 2. Extract pobCode and save to file
grep "pobCode:" build.yaml | sed 's/pobCode: //' > pob-code.txt

# 3. Analyze with the POB CLI (run from the install dir)
data/pob-source/pob-cli.sh calc @pob-code.txt
```

**What POB adds:**
- Accurate DPS calculations (totalDPS, combinedDPS)
- Defensive stats (life, armour, evasion, block)
- Resistance breakdowns
- Attack/cast speed
- Crit chance and multiplier

See `.claude/skills/pob/SKILL.md` for full POB skill documentation.

## Notes

- Response converted to YAML saves ~80% tokens vs raw JSON
- Script extracts first build variant (most builds have one)
- Lexical JSON is recursively parsed to extract plain text
- `static-data-widget` nodes contain game item/skill references with `.label` for display name
