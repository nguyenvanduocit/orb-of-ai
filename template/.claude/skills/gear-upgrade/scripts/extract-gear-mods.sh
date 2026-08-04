#!/usr/bin/env bash
# extract-gear-mods.sh — build the canonical gear mod-query reference.
#
# Runs extract-gear-mods.lua inside the PoB2 headless runtime so it reads the
# exact mod tables the calc engine uses, then writes the JSON to the canonical
# data path: data/gear-mods/<patch>-gear-mods.json (+ meta provenance).
#
# Usage: extract-gear-mods.sh [patch]   (patch default = 0.5.0)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# .claude/skills/gear-upgrade/scripts → climb 4 to workspace root (poe2/)
ROOT="$(cd "$HERE/../../../.." && pwd)"
POB_SRC="$ROOT/data/pob-source/src"
PATCH="${1:-0.5.0}"
OUT_DIR="$ROOT/data/gear-mods"
OUT="$OUT_DIR/${PATCH}-gear-mods.json"

[ -d "$POB_SRC" ] || { echo "ERROR: PoB2 source not found at $POB_SRC" >&2; exit 1; }
mkdir -p "$OUT_DIR"

cd "$POB_SRC"
export LUA_PATH="../runtime/lua/?.lua;../runtime/lua/?/init.lua;;"
export LUA_CPATH="$HOME/.luarocks/lib/lua/5.1/?.so;;"

luajit "$HERE/extract-gear-mods.lua" "$OUT" 2>&1 | grep -v \
  "^missing node\|^Loading\|^Processing\|^Unicode\|loaded$\|^Startup\|^Uniques\|^Rares" || true

# provenance
cat > "$OUT_DIR/meta.json" <<EOF
{ "patch": "$PATCH", "source": "data/pob-source/src (PoB2 fork HeadlessWrapper)", "extractor": ".claude/skills/gear-upgrade/scripts/extract-gear-mods.lua" }
EOF

echo "→ $OUT" >&2
