#!/usr/bin/env bash
# Download local mirror of poe2wiki.net (POE2 wiki) as Markdown via goscrape (>= v0.5.0).
#
# Output: ./data/wiki/<Page_Name>.md  (flat — no nested wiki/ subfolder)
#
# Skips three categories of noise:
#   1. MediaWiki page actions (edit, history, raw, diff, oldid, ...)
#   2. Binary assets (images, CSS, JS, fonts, archives)
#   3. Non-content namespaces — Modifier: (2830 noise pages), Template: (534),
#      Category: (836), Module: (119), Area: (378 monster zones), File:,
#      MediaWiki:, User:, Talk:, Special:, Help:, Form:, Property:, Concept:,
#      Portal:, Guide:, Map:  (only main-namespace items/skills/uniques/mechanics
#      pages are needed for :wiki-link cards in content/).

set -euo pipefail

# scripts/download.sh → ../../../.. = project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/data/wiki"
TARGET_URL="https://www.poe2wiki.net/wiki/Path_of_Exile_2_Wiki"
ERROR_LOG="${SCRIPT_DIR}/goscrape-errors.log"

ACTION_KEYWORDS='edit|history|info|raw|delete|protect|watch|unwatch|purge|submit|credits|markpatrolled|revert|rollback|move|render'

# Non-content namespaces. MediaWiki uses `:` as separator; URLs may keep it raw
# or percent-encode to `%3A`. Match both.
NS_KEYWORDS='Modifier|Template|Category|Module|File|MediaWiki|User|Talk|Special|Help|Form|Property|Concept|Portal|Area|Guide|Map'

EXCLUDE_WIKI_ACTIONS="([?&](action=(${ACTION_KEYWORDS})|oldid=|diff=|printable=|veaction=))|(/wiki/[^?#]+/(${ACTION_KEYWORDS})([?#]|\$))"
EXCLUDE_NAMESPACES="/wiki/(${NS_KEYWORDS})(:|%3A)"
EXCLUDE_ASSETS='(\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff?|css|js|mjs|map|woff2?|ttf|eot|otf|mp3|mp4|webm|ogg|wav|flac|pdf|zip|tar|gz|7z|rar)([?#]|$))|(/(images|resources|skins|extensions|thumb)/)|(/load\.php)'

EXCLUDE_REGEX="(${EXCLUDE_WIKI_ACTIONS})|(${EXCLUDE_NAMESPACES})|(${EXCLUDE_ASSETS})"

mkdir -p "${OUTPUT_DIR}"

# RESUME=1 env var enables --skip-existing — useful for crash recovery on a
# fresh-enough mirror. WARNING from goscrape: with --skip-existing, cached
# pages are NOT re-parsed for child links, so newly-added wiki pages will
# NOT be discovered. Default is full crawl (no --skip-existing) so POE2 0.5
# new mechanic pages (Runic_Ward, Verisium_Runeforging, ...) get fetched.
SKIP_EXISTING_FLAG=()
if [[ "${RESUME:-0}" == "1" ]]; then
  SKIP_EXISTING_FLAG=(--skip-existing)
  echo "RESUME=1 → using --skip-existing (will NOT discover new wiki pages)" >&2
fi

# Pre-migrate: lift legacy ${OUTPUT_DIR}/wiki/ up so --skip-existing (RESUME) matches.
if [[ -d "${OUTPUT_DIR}/wiki" ]] && command -v rsync >/dev/null 2>&1; then
  echo "Pre-migrate: flattening legacy ${OUTPUT_DIR}/wiki/ into ${OUTPUT_DIR}/ ..." >&2
  rsync -a --remove-source-files "${OUTPUT_DIR}/wiki/" "${OUTPUT_DIR}/"
  find "${OUTPUT_DIR}/wiki" -type d -empty -delete 2>/dev/null || true
fi

# v0.5.0+ writes directly under --output (no host wrapper).
# URL `/wiki/Page` lands at `${OUTPUT_DIR}/wiki/Page.md` — we flatten after.
goscrape \
  --markdown \
  --output "${OUTPUT_DIR}" \
  --exclude "${EXCLUDE_REGEX}" \
  --depth 0 \
  --rate-limit 4 \
  --delay 250 \
  --concurrency 4 \
  "${SKIP_EXISTING_FLAG[@]}" \
  --skip-403 \
  --no-progress \
  --error-log "${ERROR_LOG}" \
  --useragent "poe2-wiki-mirror/1.0 (personal study)" \
  "${TARGET_URL}"

# Post-scrape flatten: lift `${OUTPUT_DIR}/wiki/*` up to `${OUTPUT_DIR}/`.
if [[ -d "${OUTPUT_DIR}/wiki" ]]; then
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --remove-source-files "${OUTPUT_DIR}/wiki/" "${OUTPUT_DIR}/"
    find "${OUTPUT_DIR}/wiki" -type d -empty -delete 2>/dev/null || true
  else
    echo "WARN: rsync not found; leftover ${OUTPUT_DIR}/wiki — flatten manually" >&2
  fi
fi

echo ""
echo "✓ POE2 wiki mirror updated: ${OUTPUT_DIR}/"
