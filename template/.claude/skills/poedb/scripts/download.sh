#!/usr/bin/env bash
# Download POE2 database pages from poe2db.tw/us as Markdown via goscrape.
#
# Patch-versioned — each patch gets its own folder so historical snapshots are
# preserved (poe2db numbers change every patch).
#
# PRIMARY mode — targeted download (what you almost always want):
#   Fetch ONLY the pages you name. Uses goscrape --no-follow so it grabs exactly
#   those pages (+ their assets) and never follows <a> links — no multi-thousand
#   page crawl. Pass bare page names (slugs) or full URLs, and/or a --url-file.
#
#     ./download.sh <patch> <Page> [Page ...]
#     ./download.sh <patch> --url-file <file>
#
#     ./download.sh 0.5.0 The_Auspex Mageblood The_Hollow_Mask
#     ./download.sh 0.5.0 https://poe2db.tw/us/The_Auspex
#     ./download.sh 0.5.0 --url-file /tmp/new-uniques.txt
#
#   Build a --url-file straight from patch notes, e.g. the new uniques of 0.5.0:
#     rg -o 'Unique item mới: (.+)' -r '$1' data/release-notes/Version_0.5.0.md \
#       | sed 's/\.$//' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' \
#       | sed "s/['’]//g; s/ /_/g; s#^#https://poe2db.tw/us/#" > /tmp/new-uniques.txt
#     ./download.sh 0.5.0 --url-file /tmp/new-uniques.txt
#
#   A failing page is logged to goscrape-errors.log and skipped — the rest of the
#   batch still completes.
#
# FALLBACK mode — full crawl of the whole /us tree (rarely needed, slow):
#     ./download.sh <patch> --all
#
# Output (both modes): ./data/poedb/<patch>/<Page>.md
# (poe2db serves pages under /us/; that constant locale level is flattened away.)
#
# Requires goscrape >= v0.5.0 (--url-file, --no-follow, direct-output-dir fix).

set -euo pipefail

BASE_URL="https://poe2db.tw/us/"

if [[ $# -lt 1 ]]; then
  cat >&2 <<'EOF'
Usage:
  download.sh <patch> <Page> [Page ...]     # targeted: only these pages (slug or URL)
  download.sh <patch> --url-file <file>     # targeted: pages listed in file
  download.sh <patch> --all                 # fallback: full crawl of /us (slow)
Examples:
  download.sh 0.5.0 The_Auspex Mageblood
  download.sh 0.5.0 --url-file /tmp/new-uniques.txt
  download.sh 0.5.0 --all
EOF
  exit 1
fi

PATCH="$1"; shift

# Sanity-check patch format (vd 0.5.0, 0.5.1) — allow x.y.z and x.y formats.
if ! [[ "$PATCH" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "ERROR: patch must look like X.Y or X.Y.Z (got: ${PATCH})" >&2
  exit 1
fi

# Parse args after <patch>:
#   --all                 → full crawl
#   --url-file <path>     → read URLs from file (targeted)
#   http(s)://...         → full URL (targeted)
#   anything else         → page slug, prepended with BASE_URL (targeted)
FULL_CRAWL=0
URL_FILE=""
SEED_URLS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)        FULL_CRAWL=1; shift ;;
    --url-file)   URL_FILE="${2:?--url-file needs a path}"; shift 2 ;;
    --url-file=*) URL_FILE="${1#*=}"; shift ;;
    --*)          echo "ERROR: unknown flag '$1'" >&2; exit 1 ;;
    http://*|https://*) SEED_URLS+=("$1"); shift ;;
    *)            SEED_URLS+=("${BASE_URL}$1"); shift ;;  # bare slug → URL
  esac
done

if [[ "$FULL_CRAWL" -eq 0 && -z "$URL_FILE" && ${#SEED_URLS[@]} -eq 0 ]]; then
  echo "ERROR: nothing to fetch — pass page name(s), --url-file <file>, or --all" >&2
  exit 1
fi
if [[ "$FULL_CRAWL" -eq 1 && ( -n "$URL_FILE" || ${#SEED_URLS[@]} -gt 0 ) ]]; then
  echo "ERROR: --all (full crawl) cannot be combined with specific pages/--url-file" >&2
  exit 1
fi

# scripts/download.sh → ../../../.. = project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/data/poedb/${PATCH}"
ERROR_LOG="${SCRIPT_DIR}/goscrape-errors.log"

# Binary assets — we only want markdown text (applies to both modes).
EXCLUDE_ASSETS='(\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff?|css|js|mjs|map|woff2?|ttf|eot|otf|mp3|mp4|webm|ogg|wav|flac|pdf|zip|tar|gz|7z|rar)([?#]|$))|(/(images|img|assets|static|fonts|css|js)/)'

mkdir -p "${OUTPUT_DIR}"

# Politeness flags shared by both modes. These override goscrape's profile
# defaults (concurrency/rate-limit/delay default to 0 = "use profile"); ~4 req/s
# + 250ms jitter keeps us polite to poe2db.tw.
COMMON=(
  --markdown
  --output "${OUTPUT_DIR}"
  --rate-limit 4
  --delay 250
  --concurrency 4
  --skip-403
  --error-log "${ERROR_LOG}"
  --useragent "poe2-wiki-mirror/1.0 (personal study)"
)

if [[ "$FULL_CRAWL" -eq 1 ]]; then
  # Full crawl: follow every /us link. --include keeps us inside /us; the editor
  # variant exclude drops /us/passive-skill-tree/<hash> dynamic page explosion.
  INCLUDE_REGEX='^/us(/|$)'
  EXCLUDE_EDITOR_VARIANTS='/us/(passive-skill-tree|atlas-skill-tree|skill-tree)/[^/]+'
  EXCLUDE_REGEX="(${EXCLUDE_ASSETS})|(${EXCLUDE_EDITOR_VARIANTS})"
  echo "Full crawl of ${BASE_URL} into ${OUTPUT_DIR}/ ..." >&2
  goscrape \
    "${COMMON[@]}" \
    --include "${INCLUDE_REGEX}" \
    --exclude "${EXCLUDE_REGEX}" \
    --depth 0 \
    "${BASE_URL}"
else
  # Targeted: --no-follow downloads only the given URLs (+ their page assets) and
  # never follows <a> links — fetch exactly the pages you asked for.
  ARGS=("${COMMON[@]}" --no-follow --exclude "${EXCLUDE_ASSETS}")
  [[ -n "$URL_FILE" ]] && ARGS+=(--url-file "${URL_FILE}")
  echo "Targeted fetch (--no-follow) into ${OUTPUT_DIR}/ ..." >&2
  goscrape "${ARGS[@]}" "${SEED_URLS[@]}"
fi

# poe2db serves every page under the /us/ locale segment, and goscrape mirrors
# the URL path — so pages land in ${OUTPUT_DIR}/us/. We only ever use English,
# so flatten that constant locale level into the patch root: data/poedb/<patch>/<Page>.md
if [[ -d "${OUTPUT_DIR}/us" ]]; then
  find "${OUTPUT_DIR}/us" -mindepth 1 -maxdepth 1 -exec mv -f {} "${OUTPUT_DIR}/" \;
  rmdir "${OUTPUT_DIR}/us" 2>/dev/null || true
fi

echo ""
echo "✓ poedb mirror updated: ${OUTPUT_DIR}/"
echo "  Patch: ${PATCH}  Mode: $([[ $FULL_CRAWL -eq 1 ]] && echo full-crawl || echo targeted)"
