#!/bin/bash
# Fetch full PathOfBuilding-PoE2 repository to <project-root>/data/pob-source/
# Used for querying game data (skills, items, etc.)
# Scripts stay inside skill; the 572M PoB2 fork lives under project-wide data/.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# SCRIPT_DIR = <root>/.claude/skills/pob/scripts/scripts → climb 5 to reach project root.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

REPO_URL="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git"
TARGET_DIR="$PROJECT_ROOT/data/pob-source"

if [ -d "$TARGET_DIR/.git" ]; then
    echo "Repository exists, pulling latest changes..."
    cd "$TARGET_DIR"
    git pull --ff-only
    cd - > /dev/null
else
    echo "Cloning PathOfBuilding-PoE2 (shallow clone)..."
    rm -rf "$TARGET_DIR"
    git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
fi

echo ""
echo "Done! PathOfBuilding-PoE2 is now in $TARGET_DIR"
echo ""
echo "Key data locations:"
echo "  - Skills:  $TARGET_DIR/src/Data/Skills/"
echo "  - Gems:    $TARGET_DIR/src/Data/Gems.lua"
echo "  - Uniques: $TARGET_DIR/src/Data/Uniques/"
echo "  - Minions: $TARGET_DIR/src/Data/Minions.lua"
echo "  - Mods:    $TARGET_DIR/src/Data/Mod*.lua"
