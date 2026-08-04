#!/bin/bash
# fetch-live.sh — pull LIVE POE2 character equipment from pathofexile2.com internal-api
# via the Playwriter-controlled Chrome (no OAuth, no token replay).
#
# How it works: drives an already-logged-in pathofexile2.com tab to view your own
# character page; the site's SPA fires the internal-api request with its own DPoP
# token and we intercept the RESPONSE. We never read/store/replay the token — auth
# stays inside the browser, same-origin. Same same-origin safety model.
#
# Scope: EQUIPMENT ONLY (raw mods/runes/sockets/gems/flasks). Passives, skills and
# quest stats are NOT exposed here — get those from poe.ninja (fetch-poeninja.sh).
#
# NOTE: this is the interim playwriter-package transport. It will be reimplemented
# inside our own browser extension later.
#
# Usage:
#   fetch-live.sh [character-name]      # omit name to just list the account's characters
#
# Examples:
#   fetch-live.sh ThaoCamVienSaiGon
#   fetch-live.sh                       # list characters (id + name + level + class)
#
# Output: <project-root>/data/character-exports/live-<name>.json  (raw GGG shape, gitignored)
#
# Requires: Chrome open + the Playwriter extension enabled on a tab (click the icon
# once if you get a connection timeout). Install CLI: npm i -g playwriter@latest

set -e

TARGET="${1:-}"
REALM="poe2"

SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
EXPORT_DIR="$PROJECT_ROOT/data/character-exports"
TEMPLATE="$SCRIPT_DIR/fetch-live.js"
RUN_JS="$PROJECT_ROOT/tmp/.pob-fetch-live.run.js"
SESS_FILE="$PROJECT_ROOT/tmp/.pob-playwriter-session"   # persist one session → reuse the same tab

mkdir -p "$EXPORT_DIR" "$PROJECT_ROOT/tmp"

command -v playwriter >/dev/null 2>&1 || {
    echo "ERROR: playwriter CLI not found. Install: npm i -g playwriter@latest" >&2
    exit 1
}
[ -f "$TEMPLATE" ] || { echo "ERROR: template not found: $TEMPLATE" >&2; exit 1; }

# Reuse the persisted session if it's still alive (keeps state.page → same tab);
# otherwise create a fresh one and remember it. Retry once — the first 'session new'
# after a relay restart connects the extension but may not report it.
SID=""
if [ -f "$SESS_FILE" ]; then
    CAND="$(tr -dc '0-9' < "$SESS_FILE" 2>/dev/null)"
    if [ -n "$CAND" ] && playwriter session list 2>/dev/null | grep -qE "^${CAND}[[:space:]]"; then
        SID="$CAND"
    fi
fi
if [ -z "$SID" ]; then
    for _ in 1 2; do
        NEW_OUT="$(playwriter session new 2>&1 || true)"
        SID="$(printf '%s\n' "$NEW_OUT" | grep -oE 'Session [0-9]+ created' | grep -oE '[0-9]+' | head -1)"
        [ -n "$SID" ] && break
    done
    [ -n "$SID" ] || {
        echo "ERROR: could not create a Playwriter session. Is Chrome running with the Playwriter extension?" >&2
        exit 1
    }
    printf '%s' "$SID" > "$SESS_FILE"
fi

# Substitute placeholders into the runnable file ( '|' delimiter — paths contain '/').
sed -e "s|__POB_NAME__|${TARGET}|g" \
    -e "s|__POB_EXPORT_DIR__|${EXPORT_DIR}|g" \
    -e "s|__POB_REALM__|${REALM}|g" \
    "$TEMPLATE" > "$RUN_JS"

echo "Fetching live character${TARGET:+ '$TARGET'} via Playwriter session $SID ..." >&2
RESULT="$(playwriter -s "$SID" --timeout 60000 -f "$RUN_JS" 2>&1 || true)"
rm -f "$RUN_JS"

# Surface the character list (always useful) on stderr.
printf '%s\n' "$RESULT" | grep -E 'POB_LIVE_CHARS:' | sed 's/.*POB_LIVE_CHARS: /Characters: /' >&2 || true

if printf '%s\n' "$RESULT" | grep -q 'POB_LIVE_OK:'; then
    printf '%s\n' "$RESULT" | grep 'POB_LIVE_OK:' | sed 's/.*POB_LIVE_OK: //'
    exit 0
elif printf '%s\n' "$RESULT" | grep -q 'POB_LIVE_LISTONLY:'; then
    printf '%s\n' "$RESULT" | grep 'POB_LIVE_CHARS:' | sed 's/.*POB_LIVE_CHARS: //'
    exit 0
fi

# Failure: surface the error line, or the raw output + a hint about the extension.
if printf '%s\n' "$RESULT" | grep -q 'POB_LIVE_ERROR:'; then
    printf '%s\n' "$RESULT" | grep 'POB_LIVE_ERROR:' | sed 's/.*POB_LIVE_ERROR: /ERROR: /' >&2
else
    printf '%s\n' "$RESULT" >&2
    echo "HINT: open Chrome and click the Playwriter extension icon on a tab, then retry." >&2
fi
exit 1
