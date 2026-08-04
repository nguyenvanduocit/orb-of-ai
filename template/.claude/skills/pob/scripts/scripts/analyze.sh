#!/bin/bash
# Unified POB analyzer - auto-detects source from URL
# Usage: analyze.sh <url> [command]
#
# Supported sources:
#   - mobalytics.gg builds
#   - poe.ninja character pages
#   - pobb.in codes
#
# Commands: calc (default), stats, info

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
# PoB2 fork lives in project-wide data/, not inside skill (572M git clone — kept out of skill tree).
# SCRIPT_DIR = <root>/.claude/skills/pob/scripts/scripts → climb 5 to reach project root.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
POB2_DIR="$PROJECT_ROOT/data/pob-source"
MOBALYTICS_DIR="$SKILL_DIR/../mobalytics"

INPUT="$1"
COMMAND="${2:-calc}"

if [ -z "$INPUT" ]; then
    echo "Usage: analyze.sh <url> [command]"
    echo ""
    echo "Analyzes a PoE2 build from various sources using POB2."
    echo ""
    echo "Supported sources:"
    echo "  - mobalytics.gg/poe-2/builds/..."
    echo "  - poe.ninja/poe2/builds/.../character/..."
    echo "  - pobb.in/..."
    echo ""
    echo "Commands:"
    echo "  calc   - Full build data (default)"
    echo "  stats  - DPS and defensive stats only"
    echo "  info   - Class, level only"
    echo ""
    echo "Examples:"
    echo "  analyze.sh 'https://mobalytics.gg/poe-2/builds/bear-druid-build'"
    echo "  analyze.sh 'https://poe.ninja/poe2/builds/vaal/character/account/CharName'"
    echo "  analyze.sh 'https://pobb.in/abc123'"
    exit 1
fi

# Check POB2 installation
if [ ! -d "$POB2_DIR" ]; then
    echo "ERROR: POB2 not installed. Run setup.sh first:" >&2
    echo "  $SKILL_DIR/setup.sh" >&2
    exit 1
fi

# Create temp file for POB code
TEMP_POB=$(mktemp)
trap "rm -f $TEMP_POB" EXIT

# Detect source and fetch POB code
if [[ "$INPUT" == *"mobalytics.gg"* ]] || [[ "$INPUT" != *"://"* && "$INPUT" != *"."* ]]; then
    # Mobalytics URL or slug
    if [ ! -f "$MOBALYTICS_DIR/fetch.sh" ]; then
        echo "ERROR: Mobalytics skill not found" >&2
        exit 1
    fi
    echo "=== Fetching from mobalytics.gg ===" >&2
    YAML=$("$MOBALYTICS_DIR/fetch.sh" "$INPUT")
    POB_CODE=$(echo "$YAML" | awk '/^pobCode:/{found=1; next} found && /^[a-zA-Z]/{exit} found{gsub(/^  /, ""); print}' | tr -d '\n')

elif [[ "$INPUT" == *"poe.ninja"* ]]; then
    # poe.ninja URL
    echo "=== Fetching from poe.ninja ===" >&2
    "$SCRIPT_DIR/fetch-poeninja.sh" "$INPUT" "$TEMP_POB"
    POB_CODE=$(cat "$TEMP_POB")

elif [[ "$INPUT" == *"pobb.in"* ]]; then
    # pobb.in URL - extract code from URL
    echo "=== Fetching from pobb.in ===" >&2
    CODE=$(echo "$INPUT" | sed -E 's|.*pobb\.in/([^/?]+).*|\1|')
    # Fetch the raw POB code from pobb.in API
    POB_CODE=$(curl -s "https://pobb.in/api/pob/$CODE" | jq -r '.pobCode // empty')
    if [ -z "$POB_CODE" ]; then
        echo "ERROR: Could not fetch POB code from pobb.in" >&2
        exit 1
    fi
else
    echo "ERROR: Unrecognized URL format" >&2
    echo "Supported: mobalytics.gg, poe.ninja, pobb.in" >&2
    exit 1
fi

if [ -z "$POB_CODE" ]; then
    echo "ERROR: No POB code found" >&2
    exit 1
fi

# Save POB code and run analysis
echo "$POB_CODE" > "$TEMP_POB"

echo "" >&2
echo "=== POB2 Analysis ===" >&2
cd "$POB2_DIR"
./pob-cli.sh "$COMMAND" "@$TEMP_POB"
