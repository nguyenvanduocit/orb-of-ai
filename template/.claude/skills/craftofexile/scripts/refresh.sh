#!/usr/bin/env bash
# Refresh the Craft of Exile POE2 static dataset into data/craftofexile/.
#
# CoE serves its data as JS-assignment files (poecd={...}, poecc={...}). We strip
# the `<var>=` prefix and trailing `;` so the result is valid JSON the resolver can
# json-parse directly. Only id-mapping / reference data — the probability MATH stays
# in CoE's own engine (we never recompute it).
#
# Usage:  bash refresh.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .claude/skills/craftofexile/scripts -> climb 4 to repo root
DATA_DIR="$(cd "$HERE/../../../../data/craftofexile" && pwd)"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
BASE="https://www.craftofexile.com/json/poe2"

# remote path  ->  local filename
# Only the two files the resolver needs: poec_data (bases/mods/tiers/methods id-map)
# and poec_common (league id->name). Prices/lang are skipped — CoE computes cost live.
declare -a FILES=(
  "main/poec_data.json|poec_data.json"
  "poec_common.json|poec_common.json"
)

strip_prefix() {
  # Drop everything before the first '{' and a trailing ';' so the file is pure JSON.
  python3 -c "import sys; s=sys.stdin.read(); i=s.find('{'); sys.stdout.write(s[i:].rstrip().rstrip(';'))"
}

echo "Refreshing Craft of Exile POE2 data -> $DATA_DIR"
for entry in "${FILES[@]}"; do
  remote="${entry%%|*}"; local="${entry##*|}"
  raw="$(curl -fsS -A "$UA" "$BASE/$remote")"
  echo "$raw" | strip_prefix > "$DATA_DIR/$local"
  # validate
  python3 -c "import json,sys; json.load(open('$DATA_DIR/$local')); print('  ok  $local', __import__('os').path.getsize('$DATA_DIR/$local'), 'bytes')"
done

# Stamp provenance (CoE versions its assets with a unix-ts query string)
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DATA_DIR/.fetched_at"
echo "Done. Fetched at $(cat "$DATA_DIR/.fetched_at")"
