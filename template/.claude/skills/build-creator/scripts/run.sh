#!/bin/bash
# build-creator entry point. Runs cli.lua inside the PoB2 headless env.
# Usage: run.sh <command> [args...]   (e.g. run.sh test, run.sh build spec.json)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# .claude/skills/build-creator/scripts → climb 4 to repo root
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
POB="$REPO_ROOT/data/pob-source"
RT="$POB/runtime/lua"
LR="$HOME/.luarocks"

export LUA_PATH="$POB/src/?.lua;$RT/?.lua;$RT/?/init.lua;$LR/share/lua/5.1/?.lua;$LR/share/lua/5.1/?/init.lua;./?.lua;./?/init.lua;;"
export LUA_CPATH="$LR/lib/lua/5.1/?.so;;"

# Preserve the caller's cwd so main.lua can resolve relative spec paths — we
# cd into the PoB src dir (required for HeadlessWrapper's relative loads).
BC_INVOKE_DIR="$(pwd)"
export BC_INVOKE_DIR

cd "$POB/src"
exec luajit "$SCRIPT_DIR/main.lua" "$@"
