#!/bin/bash
# Fetch build from poe.ninja — supports two surfaces:
#   1. builds ladder : https://poe.ninja/poe2/builds/{league}/character/{account}/{character}
#   2. own profile   : https://poe.ninja/poe2/profile/{account}/{league}/character/{character}
#
# The profile surface works for ANY character the account has connected to poe.ninja
# (including low-level/leveling chars not on the public ladder). It returns the full
# charModel — pathOfBuildingExport + defensiveStats + items/skills/keystones/jewels —
# which is the no-OAuth, zero-ban-risk path to a live-played POE2 character.
#
# Usage:
#   fetch-poeninja.sh <poe.ninja-url> [pob-output-file]
#
# Examples:
#   fetch-poeninja.sh 'https://poe.ninja/poe2/profile/hopthuxacnhan-3062/runesofaldur/character/ThaoCamVienSaiGon'
#   fetch-poeninja.sh 'https://poe.ninja/poe2/builds/vaal/character/account/CharName' build.txt
#
# On the profile surface the full model JSON is also saved to:
#   <project-root>/data/character-exports/export-<character>.json   (rich stats, gitignored)

set -e

URL="$1"
OUTPUT="${2:-/dev/stdout}"

# Resolve project root for the character-exports sink.
# This file lives at .claude/skills/pob/scripts/scripts/ → climb 5 to project root.
SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
EXPORT_DIR="$PROJECT_ROOT/data/character-exports"

if [ -z "$URL" ]; then
    echo "Usage: fetch-poeninja.sh <poe.ninja-url> [pob-output-file]"
    echo ""
    echo "Fetches Path of Building export from a poe.ninja character page."
    echo ""
    echo "Supported URLs:"
    echo "  profile (any connected char, incl. leveling):"
    echo "    https://poe.ninja/poe2/profile/{account}/{league}/character/{character}"
    echo "  builds ladder (laddered chars only):"
    echo "    https://poe.ninja/poe2/builds/{league}/character/{account}/{character}"
    exit 1
fi

emit_pob() {
    # $1 = pob code
    local code="$1"
    if [ -z "$code" ]; then
        echo "ERROR: No Path of Building export found in character data" >&2
        exit 1
    fi
    if [ "$OUTPUT" = "/dev/stdout" ]; then
        echo "$code"
    else
        echo "$code" > "$OUTPUT"
        echo "Saved PoB code to: $OUTPUT" >&2
    fi
    echo "Done! PoB code length: ${#code} characters" >&2
}

# ─────────────────────────────────────────────────────────────────────────────
# Surface 1: own profile  (events SSE → modelId → model JSON)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$URL" =~ poe\.ninja/poe2/profile/([^/]+)/([^/]+)/character/([^/?]+) ]]; then
    ACCOUNT="${BASH_REMATCH[1]}"
    LEAGUE="${BASH_REMATCH[2]}"
    CHARACTER="${BASH_REMATCH[3]}"

    echo "Source: poe.ninja profile" >&2
    echo "Account: $ACCOUNT | League: $LEAGUE | Character: $CHARACTER" >&2

    # Step 1: resolve latest modelId from the SSE event stream (changes every snapshot —
    # never hardcode). The stream emits a single line: data: {"version":<modelId>}
    echo "Resolving latest model id..." >&2
    EVENTS_URL="https://poe.ninja/poe2/api/events/character/$ACCOUNT/$LEAGUE/$CHARACTER"
    MODEL_ID=$(curl -sN --max-time 10 "$EVENTS_URL" | grep -m1 '^data:' \
        | python3 -c "import json,sys; s=sys.stdin.read().split('data:',1); print(json.loads(s[1])['version']) if len(s)>1 else sys.exit(1)" 2>/dev/null || true)

    if [ -z "$MODEL_ID" ]; then
        echo "ERROR: Could not resolve model id for $CHARACTER." >&2
        echo "  → Char may not be connected/public on poe.ninja, or league slug is wrong." >&2
        exit 1
    fi
    echo "Model id: $MODEL_ID" >&2

    # Step 2: fetch the full character model
    echo "Fetching character model..." >&2
    MODEL_URL="https://poe.ninja/poe2/api/profile/characters/$ACCOUNT/$LEAGUE/$CHARACTER/model/$MODEL_ID"
    MODEL_JSON=$(curl -s --max-time 25 -H 'Accept: application/json' -H "Referer: https://poe.ninja/poe2/profile/$ACCOUNT" "$MODEL_URL")

    if echo "$MODEL_JSON" | grep -q '"status":4'; then
        echo "ERROR: poe.ninja returned an error for model $MODEL_ID" >&2
        echo "$MODEL_JSON" | head -c 300 >&2; echo "" >&2
        exit 1
    fi

    # Step 3: persist the full model JSON (rich stats poe.ninja already computed — used
    # for analysis because PoB2 0.4 cannot yet model 0.5 Spirit Walker) + report freshness.
    mkdir -p "$EXPORT_DIR"
    EXPORT_FILE="$EXPORT_DIR/export-$CHARACTER.json"
    echo "$MODEL_JSON" > "$EXPORT_FILE"
    echo "Saved full model JSON to: $EXPORT_FILE" >&2

    POB_CODE=$(echo "$MODEL_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
cm = d.get('charModel') or {}
lvl = cm.get('level'); cls = cm.get('class'); upd = cm.get('updatedUtc') or cm.get('lastSeenUtc')
print('  level=%s class=%s updatedUtc=%s (SNAPSHOT — not live)' % (lvl, cls, upd), file=sys.stderr)
pob = cm.get('pathOfBuildingExport', '')
if pob:
    print(pob)
else:
    sys.exit(1)
")
    emit_pob "$POB_CODE"
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Surface 2: builds ladder  (index-state version → builds character endpoint)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$URL" =~ poe\.ninja/poe2/builds/([^/]+)/character/([^/]+)/([^/?]+) ]]; then
    LEAGUE="${BASH_REMATCH[1]}"
    ACCOUNT="${BASH_REMATCH[2]}"
    CHARACTER="${BASH_REMATCH[3]}"

    echo "Source: poe.ninja builds ladder" >&2
    echo "League: $LEAGUE | Account: $ACCOUNT | Character: $CHARACTER" >&2

    echo "Fetching snapshot version..." >&2
    INDEX_STATE=$(curl -s "https://poe.ninja/poe2/api/data/index-state")

    VERSION=$(echo "$INDEX_STATE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for snap in data.get('snapshotVersions', []):
    if snap.get('url') == '$LEAGUE':
        print(snap.get('version')); break
")
    SNAPSHOT_NAME=$(echo "$INDEX_STATE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for snap in data.get('snapshotVersions', []):
    if snap.get('url') == '$LEAGUE':
        print(snap.get('snapshotName')); break
")

    if [ -z "$VERSION" ]; then
        echo "ERROR: Could not find snapshot version for league: $LEAGUE" >&2
        exit 1
    fi
    echo "Snapshot: $VERSION ($SNAPSHOT_NAME)" >&2

    echo "Fetching character data..." >&2
    CHAR_DATA=$(curl -s "https://poe.ninja/poe2/api/builds/$VERSION/character?account=$ACCOUNT&name=$CHARACTER&overview=$SNAPSHOT_NAME")

    if echo "$CHAR_DATA" | grep -q '"status":404'; then
        echo "ERROR: Character not found on builds ladder (try the profile URL instead)" >&2
        exit 1
    fi

    POB_CODE=$(echo "$CHAR_DATA" | python3 -c "
import json, sys
data = json.load(sys.stdin)
pob = data.get('pathOfBuildingExport', '')
print(pob) if pob else sys.exit(1)
")
    emit_pob "$POB_CODE"
    exit 0
fi

echo "ERROR: Invalid poe.ninja URL format" >&2
echo "Expected profile: https://poe.ninja/poe2/profile/{account}/{league}/character/{character}" >&2
echo "Expected builds:  https://poe.ninja/poe2/builds/{league}/character/{account}/{character}" >&2
exit 1
