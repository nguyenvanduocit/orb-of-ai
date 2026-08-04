#!/bin/bash
# export-pob.sh — GGG character JSON → PoB2 import code (reuses PoB's own import/export).
# Usage: ./export-pob.sh <charData.json>     (also accepts @file for parity with pob-cli.sh)
#
# The JSON must be fetched separately, ban-safely:
#   • equipment-only (POE2):  .claude/skills/pob/scripts/scripts/fetch-live.sh <name>
#                             -> data/character-exports/live-<name>.json  (no passives)
#   • full charData (passives): OAuth /character/poe2/<name> via PoB OAuth (client_id=pob)
# Emits a URL-safe base64 code on stdout (inside JSON) — feed it to `pob-cli.sh calc @file`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

JSON_ARG="$1"
if [ -z "$JSON_ARG" ]; then
    echo "Usage: export-pob.sh <charData.json>" >&2
    exit 1
fi
# Accept @file for parity with pob-cli.sh's convention.
JSON_ARG="${JSON_ARG#@}"
# Resolve to an absolute path BEFORE we cd into src (the lua opens it directly).
JSON_ABS="$(cd "$(dirname "$JSON_ARG")" 2>/dev/null && pwd)/$(basename "$JSON_ARG")"
if [ ! -f "$JSON_ABS" ]; then
    echo "ERROR: file not found: $JSON_ARG" >&2
    exit 1
fi

cd "$SCRIPT_DIR/src" || { echo "ERROR: src dir missing in $SCRIPT_DIR — run setup.sh" >&2; exit 1; }
export LUA_PATH="$SCRIPT_DIR/runtime/lua/?.lua;$SCRIPT_DIR/runtime/lua/?/init.lua;;"
export LUA_CPATH="$HOME/.luarocks/lib/lua/5.1/?.so;;"

exec luajit "$SCRIPT_DIR/export-pob.lua" "$JSON_ABS"
