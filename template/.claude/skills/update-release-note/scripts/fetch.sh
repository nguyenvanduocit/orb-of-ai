#!/usr/bin/env bash
# Fetch Path of Exile 2 release notes from the OFFICIAL GGG forum thread.
#
# The forum thread is the canonical patch-notes source (#1 in the project source
# hierarchy — GGG ground truth). poe2wiki.net is a community mirror (#3) that can
# lag the forum by hours, so fetches come straight from the source.
#
# RULE EXCEPTION — CLAUDE.md says "NEVER call pathofexile.com endpoints directly"
# to protect a previously-flagged account. That rule guards the authenticated,
# rate-limited trade/stash/character APIs. This script does a single ANONYMOUS,
# READ-ONLY GET of a PUBLIC forum thread — no auth, no account, no API. The
# flag risk does not apply. A browser User-Agent is required because Cloudflare
# returns 403 to markitdown/curl default UAs.
#
# Pipeline:
#   curl (browser UA) -> forum HTML
#   -> extract-forum.py (bs4: pull the post-body <div class="content">)
#   -> pandoc (clean fragment -> GitHub-flavored Markdown)
#   -> strip residual layout <div> wrappers, squeeze blank lines
#
# Usage:
#   ./fetch.sh <thread-id-or-url> [version]
#   ./fetch.sh 3932540              # POE2 0.5.0 — version parsed from the page
#   ./fetch.sh 3932540 0.5.0        # version given explicitly
#
# Thread IDs are looked up by hand from GGG forum announcements — each patch is
# its own thread, so there is no auto-detect-latest. Known: 0.5.0 = 3932540.
#
# Output: data/release-notes/Version_X.Y.Z.md  (+ latest.md symlink)
# Re-fetch preserves any curated header block above the first '---'; only the
# body below it is regenerated from the forum.

set -euo pipefail

# scripts/ is 4 levels deep: .claude/skills/update-release-note/scripts → root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
# RELEASE_NOTES_DIR override exists for dry-run validation into a temp dir.
OUTPUT_DIR="${RELEASE_NOTES_DIR:-${ROOT_DIR}/data/release-notes}"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

PY="/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"
[[ -x "$PY" ]] || PY="$(command -v python3 || true)"

ARG_THREAD="${1:-}"
REQUESTED_VER="${2:-}"

if [[ -z "$ARG_THREAD" ]]; then
  echo "ERROR: missing thread id/url." >&2
  echo "Usage: $0 <thread-id-or-url> [version]   (POE2 0.5.0 = 3932540)" >&2
  exit 2
fi

# --- Dependency checks -------------------------------------------------------
for dep in "$PY:python3" "$(command -v pandoc || true):pandoc" "$(command -v curl || true):curl"; do
  bin="${dep%%:*}"; name="${dep##*:}"
  if [[ -z "$bin" || ! -x "$bin" ]]; then
    echo "ERROR: ${name} not found." >&2
    [[ "$name" == "pandoc" ]] && echo "Install with: brew install pandoc" >&2
    exit 1
  fi
done
if ! "$PY" -c 'import bs4' 2>/dev/null; then
  echo "ERROR: python module 'bs4' (beautifulsoup4) not available to ${PY}." >&2
  echo "Install with: ${PY} -m pip install beautifulsoup4" >&2
  exit 1
fi

# --- Resolve thread URL ------------------------------------------------------
if [[ "$ARG_THREAD" =~ ^[0-9]+$ ]]; then
  THREAD_ID="$ARG_THREAD"
  URL="https://www.pathofexile.com/forum/view-thread/${THREAD_ID}"
elif [[ "$ARG_THREAD" =~ ^https?://([^/]*\.)?pathofexile\.com/forum/view-thread/([0-9]+) ]]; then
  THREAD_ID="${BASH_REMATCH[2]}"
  URL="$ARG_THREAD"
else
  echo "ERROR: '${ARG_THREAD}' is not a numeric thread id or a pathofexile.com forum thread URL." >&2
  exit 2
fi

mkdir -p "${OUTPUT_DIR}"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# --- 1. Fetch forum HTML (browser UA, fail on HTTP error) --------------------
echo "Fetching forum thread ${THREAD_ID} ..."
if ! curl -fsS -A "$UA" "$URL" -o "${WORK}/page.html"; then
  echo "ERROR: GGG forum fetch failed for ${URL}" >&2
  echo "  A 403 means Cloudflare blocked the request — refresh the UA string in this script." >&2
  echo "  Anything else: check the thread id is correct and the network is up." >&2
  exit 1
fi

# --- 2. Extract post body -> 3. pandoc -> 4. cleanup -------------------------
"$PY" "${SCRIPT_DIR}/extract-forum.py" "${WORK}/page.html" > "${WORK}/fragment.html"
pandoc -f html -t gfm --wrap=none "${WORK}/fragment.html" -o "${WORK}/body.raw.md"

# Clean pandoc output to match the release-notes house style:
#   - drop leftover layout <div>/</div> wrappers (standalone lines, no text)
#   - drop stray &#10; newline entities
#   - normalize pandoc's '-' list bullets to the corpus '*' bullets
#   - trim trailing whitespace, squeeze blank runs
sed -E \
  -e '/^[[:space:]]*<\/?div[^>]*>[[:space:]]*$/d' \
  -e 's/&#10;//g' \
  -e 's/^([[:space:]]*)- /\1* /' \
  -e 's/[[:space:]]+$//' \
  "${WORK}/body.raw.md" | cat -s > "${WORK}/body.md"

if [[ ! -s "${WORK}/body.md" ]]; then
  echo "ERROR: conversion produced an empty body for ${URL}" >&2
  exit 1
fi

# --- Determine version (arg wins, else parse the page title) -----------------
if [[ -n "$REQUESTED_VER" ]]; then
  VER="$REQUESTED_VER"
else
  VER="$(grep -oE 'Content Update [0-9]+\.[0-9]+(\.[0-9]+)?' "${WORK}/body.md" | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' || true)"
  # Preview threads have no "Content Update X.Y" line but open with "deploying Patch X.Y.Z".
  if [[ -z "$VER" ]]; then
    VER="$(grep -oiE 'deploying Patch [0-9]+\.[0-9]+(\.[0-9]+)?' "${WORK}/body.md" | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' || true)"
  fi
  if [[ -z "$VER" ]]; then
    echo "ERROR: could not parse version from the page; pass it explicitly: $0 ${THREAD_ID} <version>" >&2
    exit 1
  fi
fi
MD_FILE="${OUTPUT_DIR}/Version_${VER}.md"

# --- Assemble file: preserve curated header above '---', refresh body --------
if [[ -f "$MD_FILE" ]] && grep -qxE '\-\-\-' "$MD_FILE"; then
  # Keep everything up to and including the first '---' (curated provenance).
  HEAD="$(awk '{print} /^---$/{exit}' "$MD_FILE")"
  echo "Preserving curated header from existing ${MD_FILE##*/}; refreshing body."
else
  HEAD="$(printf '# Version %s\n\n> **Nguồn canonical:** Official GGG forum thread — [pathofexile.com/forum/view-thread/%s](%s) (patch notes gốc, source #1 trong hierarchy). Fetch sau lấy từ thread này.\n> **Fetched:** %s\n\n---' \
    "$VER" "$THREAD_ID" "$URL" "$(date +%F)")"
fi

printf '%s\n\n%s\n' "$HEAD" "$(cat "${WORK}/body.md")" > "$MD_FILE"
ln -sf "Version_${VER}.md" "${OUTPUT_DIR}/latest.md"

echo ""
echo "✓ Done — Version ${VER} from GGG forum thread ${THREAD_ID}"
echo "  ${MD_FILE}"
echo "  ${OUTPUT_DIR}/latest.md → Version_${VER}.md"
