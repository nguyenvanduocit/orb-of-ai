#!/bin/bash
# pst.sh — env + cwd wrapper for the PoB-backed passive-skill-tree Lua CLI.
# Usage: pst.sh <command> [args...]
#
# Sets LUA_PATH so `require("lib.x")` resolves to this skill's scripts dir, plus
# PoB's own runtime + luarocks paths, then runs luajit from data/pob-source/src
# (PoB loads HeadlessWrapper.lua / Launch.lua via cwd-relative paths).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# .claude/skills/passive-skill-tree/scripts → climb 4 to repo root
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
POB2_SRC="$REPO_ROOT/data/pob-source/src"
RT="$REPO_ROOT/data/pob-source/runtime/lua"
LR="$HOME/.luarocks"

if [ ! -d "$POB2_SRC" ]; then
  echo "pst.sh: pob-source not found at $POB2_SRC — fetch it via the PoB fetch script." >&2
  exit 1
fi

# $SCRIPT_DIR first so our lib/* modules win; then PoB runtime + luarocks + cwd.
export LUA_PATH="$SCRIPT_DIR/?.lua;$RT/?.lua;$RT/?/init.lua;$LR/share/lua/5.1/?.lua;$LR/share/lua/5.1/?/init.lua;./?.lua;./?/init.lua;;"
export LUA_CPATH="$LR/lib/lua/5.1/?.so;;"

# Preserve the caller's cwd so calc.lua can resolve relative build-file args
# (we cd into POB2_SRC below, which would otherwise break relative paths).
export PST_PWD="$PWD"
cd "$POB2_SRC"
exec luajit "$SCRIPT_DIR/pst.lua" "$@"
