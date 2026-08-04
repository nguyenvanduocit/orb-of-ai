#!/bin/bash
# POB2 Setup Script — idempotent
# Sets up Path of Building 2 for headless CLI usage at <project-root>/data/pob-source/.
#
# Idempotent steps (safe to re-run):
#   1. Clone PathOfBuilding-PoE2 to data/pob-source/ (delegates to fetch-poe2-data.sh; updates if exists)
#   2. Install lua-zlib via luarocks (skipped if already installed)
#   3. Patch src/HeadlessWrapper.lua with zlib Deflate/Inflate (skipped if marker present)
#   4. Copy pob-cli.sh / pob-cli.lua / cli_test.lua from skill dir to runtime dir (skipped if identical)
#   5. Smoke-test by running pob-cli.sh new
#
# WHY data/pob-source/: this is the canonical POB2 install location (gitignored, ~572MB).
# The same clone is used for both runtime (HeadlessWrapper + pob-cli) and game-data reference
# (src/Data/Skills/, src/Data/Gems.lua, etc.) — one source of truth, no duplicate clones.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# SCRIPT_DIR = <root>/.claude/skills/pob/scripts → climb 4 to reach project root.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
POB2_DIR="$PROJECT_ROOT/data/pob-source"
FETCH_SCRIPT="$SCRIPT_DIR/scripts/fetch-poe2-data.sh"

echo "=== POB2 CLI Setup ==="
echo "Skill scripts:    $SCRIPT_DIR"
echo "POB2 install dir: $POB2_DIR"

# ─── Dependencies ──────────────────────────────────────────────────────────
echo ""
echo "Checking dependencies..."

if ! command -v luajit &> /dev/null; then
    echo "ERROR: luajit not found. Install with: brew install luajit"
    exit 1
fi
echo "  - luajit:   OK"

if ! command -v luarocks &> /dev/null; then
    echo "ERROR: luarocks not found. Install with: brew install luarocks"
    exit 1
fi
echo "  - luarocks: OK"

if ! command -v git &> /dev/null; then
    echo "ERROR: git not found"
    exit 1
fi
echo "  - git:      OK"

# ─── 1. Clone/update POB2 ──────────────────────────────────────────────────
echo ""
if [ -d "$POB2_DIR/.git" ]; then
    echo "POB2 already cloned at $POB2_DIR — to refresh run:"
    echo "  $FETCH_SCRIPT"
else
    echo "Cloning PathOfBuilding-PoE2 via fetch script..."
    bash "$FETCH_SCRIPT"
fi

# ─── 2. lua-zlib ───────────────────────────────────────────────────────────
echo ""
if luarocks show lua-zlib --lua-version=5.1 &> /dev/null; then
    echo "lua-zlib already installed (Lua 5.1) — skipping."
else
    echo "Installing lua-zlib..."
    luarocks install lua-zlib --lua-version=5.1
fi

# ─── 3. Patch HeadlessWrapper.lua ──────────────────────────────────────────
echo ""
WRAPPER_FILE="$POB2_DIR/src/HeadlessWrapper.lua"

if [ ! -f "$WRAPPER_FILE" ]; then
    echo "ERROR: $WRAPPER_FILE not found. Clone may be corrupted — try removing $POB2_DIR and re-running."
    exit 1
fi

# Idempotency marker: presence of zlib impl in Deflate body.
if grep -q 'zlib.deflate()(data, "finish")' "$WRAPPER_FILE"; then
    echo "HeadlessWrapper.lua already patched — skipping."
elif grep -q 'function Deflate(data)' "$WRAPPER_FILE"; then
    echo "Patching HeadlessWrapper.lua with zlib support..."
    python3 - "$WRAPPER_FILE" << 'PYSCRIPT'
import re, sys
path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()

# Match upstream stubs: Deflate/Inflate returning "" with TODO comments.
pattern = r'function Deflate\(data\)\s*\n\s*-- TODO: Might need this\s*\n\s*return ""\s*\nend\s*\nfunction Inflate\(data\)\s*\n\s*-- TODO: And this\s*\n\s*return ""\s*\nend'

replacement = '''-- Load zlib for compression/decompression
local zlibOk, zlib = pcall(require, "zlib")
if not zlibOk then
\tzlib = nil
end

function Deflate(data)
\tif zlib then
\t\treturn zlib.deflate()(data, "finish")
\tend
\treturn ""
end
function Inflate(data)
\tif zlib then
\t\tlocal stream = zlib.inflate()
\t\tlocal result, eof, bytesIn, bytesOut = stream(data)
\t\treturn result or ""
\tend
\treturn ""
end'''

new_content, n = re.subn(pattern, replacement, content)
if n == 0:
    print("WARNING: stub pattern not matched — file may have an unexpected layout. Inspect manually.", file=sys.stderr)
    sys.exit(2)

with open(path, "w") as f:
    f.write(new_content)
print(f"Patched ({n} substitution)")
PYSCRIPT
else
    echo "WARNING: Deflate stub not found in $WRAPPER_FILE — upstream layout may have changed. Inspect manually."
fi

# ─── 4. Copy CLI helpers into install dir ──────────────────────────────────
echo ""
echo "Syncing CLI helpers from skill dir to install dir..."
for helper in pob-cli.sh pob-cli.lua cli_test.lua export-pob.sh export-pob.lua; do
    SRC="$SCRIPT_DIR/$helper"
    DST="$POB2_DIR/$helper"

    if [ ! -f "$SRC" ]; then
        echo "  - $helper: SOURCE MISSING at $SRC (skipping)"
        continue
    fi

    if [ -f "$DST" ] && cmp -s "$SRC" "$DST"; then
        echo "  - $helper: already identical, skip"
    else
        cp "$SRC" "$DST"
        echo "  - $helper: copied"
    fi
done
chmod +x "$POB2_DIR/pob-cli.sh" "$POB2_DIR/export-pob.sh"

# ─── 5. Smoke test ─────────────────────────────────────────────────────────
echo ""
echo "Smoke test (pob-cli.sh new)..."
cd "$POB2_DIR"
if ./pob-cli.sh new 2>&1 | head -5 | grep -q '.'; then
    echo "  - pob-cli.sh: responsive"
else
    echo "  WARNING: pob-cli.sh new produced no output — install may be broken."
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Usage:"
echo "  $POB2_DIR/pob-cli.sh new              # Create empty build"
echo "  $POB2_DIR/pob-cli.sh calc <pob-code>  # Analyze build"
echo "  $POB2_DIR/pob-cli.sh calc @file.txt   # Load from file"
echo ""
echo "Fetch builds from poe.ninja / pobb.in / mobalytics:"
echo "  $SCRIPT_DIR/scripts/analyze.sh <url>"
echo ""
echo "Refresh PathOfBuilding-PoE2 source:"
echo "  $FETCH_SCRIPT"
