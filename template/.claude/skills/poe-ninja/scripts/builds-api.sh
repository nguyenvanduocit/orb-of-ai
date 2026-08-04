#!/usr/bin/env bash
# poe.ninja POE2 Builds API client — fetches POE2 build data via protobuf API
# Same protobuf shape as POE1, but URL prefix is /poe2/ and snapshots typically
# have NO `type` field (POE1 dùng exp/depthsolo, POE2 chỉ 1 ranking).
#
# Usage:
#   builds-api.sh overview [league]              — aggregate build stats
#   builds-api.sh dictionary <type> [league]     — list dictionary entries
#   builds-api.sh leagues                        — list available POE2 leagues
#   builds-api.sh version [league]               — show current snapshot version
#   builds-api.sh raw [league]                   — raw decoded protobuf

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# scripts/ → poe-ninja/ → skills/ → .claude/ → workspace root (poe2/).
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CACHE_DIR="$PROJECT_DIR/tmp/poeninja-cache"
mkdir -p "$CACHE_DIR"

BASE_URL="https://poe.ninja"
# POE2 default league. Verify via `builds-api.sh leagues` after each new league launch.
# 0.5 launch (~2026-05-29) — guessed slug "runesofaldur". Update sau khi index-state confirm.
DEFAULT_LEAGUE="runesofaldur"
# POE2 snapshots typically have empty `type`. Pass "exp" only nếu future POE2 adds depthsolo.
DEFAULT_TYPE=""

die() { echo "ERROR: $*" >&2; exit 1; }

require_protoc() {
  command -v protoc >/dev/null 2>&1 || die "protoc not found. Install: brew install protobuf"
}

# Fetch index-state (JSON, cached 5 min)
get_index_state() {
  local cache="$CACHE_DIR/index-state.json"
  local max_age=300

  if [[ -f "$cache" ]]; then
    local age=$(( $(date +%s) - $(stat -f%m "$cache" 2>/dev/null || echo 0) ))
    if (( age < max_age )); then
      cat "$cache"
      return
    fi
  fi

  curl -sf "$BASE_URL/poe2/api/data/index-state" > "$cache" || die "Failed to fetch index-state"
  cat "$cache"
}

# Get snapshot version for a league
# POE2: snapshot `type` thường vắng. Match khi user pass "" hoặc khi snapshot không có type field.
get_version() {
  local league="${1:-$DEFAULT_LEAGUE}"
  local type="${2:-$DEFAULT_TYPE}"
  get_index_state | python3 -c "
import json, sys
data = json.loads(sys.stdin.readline())
want_type = '$type'
for sv in data.get('snapshotVersions', []):
    if sv['url'] != '$league':
        continue
    sv_type = sv.get('type', '') or ''
    if want_type == sv_type:
        print(sv['version'])
        sys.exit(0)
sys.exit(1)
" || die "No snapshot found for league=$league type='$type'"
}

get_snapshot_name() {
  local league="${1:-$DEFAULT_LEAGUE}"
  local type="${2:-$DEFAULT_TYPE}"
  get_index_state | python3 -c "
import json, sys
data = json.loads(sys.stdin.readline())
want_type = '$type'
for sv in data.get('snapshotVersions', []):
    if sv['url'] != '$league':
        continue
    sv_type = sv.get('type', '') or ''
    if want_type == sv_type:
        print(sv['snapshotName'])
        sys.exit(0)
sys.exit(1)
" || die "No snapshot found for league=$league type='$type'"
}

# Fetch search protobuf to a file, return the file path
# Extra filter params can be passed as $3, $4, etc.
fetch_search_file() {
  local league="${1:-$DEFAULT_LEAGUE}"
  local type="${2:-$DEFAULT_TYPE}"
  shift 2 2>/dev/null || true

  local version
  version=$(get_version "$league" "$type")
  local snapshot
  snapshot=$(get_snapshot_name "$league" "$type")

  # POE2: skip &type= when type is empty (snapshot has no type field).
  local params="overview=$snapshot"
  if [[ -n "$type" ]]; then
    params="$params&type=$type"
  fi
  # Append extra filter params (e.g. class=Necromancer skill=Raise+Spectre)
  for arg in "$@"; do
    params="$params&$arg"
  done
  local url="$BASE_URL/poe2/api/builds/$version/search?$params"
  local cache_key
  cache_key=$(echo "$url" | md5 -q 2>/dev/null || echo "$url" | md5sum | cut -d' ' -f1)
  local cache_file="$CACHE_DIR/search-$cache_key.bin"
  local decoded_file="$CACHE_DIR/search-$cache_key.txt"
  local cache_age=120

  if [[ -f "$cache_file" && -f "$decoded_file" ]]; then
    local age=$(( $(date +%s) - $(stat -f%m "$cache_file" 2>/dev/null || echo 0) ))
    if (( age < cache_age )); then
      echo "$decoded_file"
      return
    fi
  fi

  curl -sf "$url" -o "$cache_file" || die "Failed to fetch search data"
  protoc --decode_raw < "$cache_file" > "$decoded_file" 2>/dev/null || die "Failed to decode protobuf"
  echo "$decoded_file"
}

# Fetch dictionary by hash → decoded text file
fetch_dict_file() {
  local hash="$1"
  local cache_bin="$CACHE_DIR/dict-$hash.bin"
  local cache_txt="$CACHE_DIR/dict-$hash.txt"

  if [[ -f "$cache_txt" ]]; then
    echo "$cache_txt"
    return
  fi

  curl -sf "$BASE_URL/poe2/api/builds/dictionary/$hash" -o "$cache_bin" || die "Failed to fetch dictionary $hash"
  protoc --decode_raw < "$cache_bin" > "$cache_txt" 2>/dev/null || die "Failed to decode dictionary"
  echo "$cache_txt"
}

# Extract dictionary values (field 2) as ordered list
dict_values() {
  local dict_file="$1"
  grep -E '^2: "' "$dict_file" | sed -E 's/^2: "(.*)"/\1/'
}

# Parse search result with python for reliable protobuf text parsing
parse_overview() {
  local search_file="$1"

  python3 - "$search_file" "$CACHE_DIR" "$BASE_URL" << 'PYEOF'
import sys, re, os, subprocess, json

search_file = sys.argv[1]
cache_dir = sys.argv[2]
base_url = sys.argv[3]

with open(search_file) as f:
    text = f.read()

# Extract total (field 1 at top level inside field 1)
total_match = re.search(r'^\s*1: (\d+)', text, re.MULTILINE)
total = int(total_match.group(1)) if total_match else 0
print(f"Total characters: {total}")
print()

# Extract dimensions (field 2 blocks): id, dictionaryId, counts
dim_pattern = r'  2 \{\s*\n\s*1: "([^"]+)"\s*\n\s*2: "([^"]+)"\s*\n((?:\s*3 \{[^}]*\}\s*\n)*)\s*\}'
dimensions = {}
for m in re.finditer(dim_pattern, text):
    dim_id = m.group(1)
    dict_id = m.group(2)
    counts_block = m.group(3)
    counts = []
    for cm in re.finditer(r'3 \{\s*\n(?:\s*1: (\d+)\s*\n)?\s*2: (\d+)\s*\n\s*\}', counts_block):
        key = int(cm.group(1)) if cm.group(1) else 0
        count = int(cm.group(2))
        counts.append((key, count))
    dimensions[dim_id] = {"dict_id": dict_id, "counts": counts}

# Extract dictionary hashes (field 6 blocks)
dict_hashes = {}
for m in re.finditer(r'  6 \{\s*\n\s*1: "([^"]+)"\s*\n\s*2: "([^"]+)"\s*\n\s*\}', text):
    dict_hashes[m.group(1)] = m.group(2)

# Extract value lists (field 5 blocks) - character names, accounts
value_lists = {}
for m in re.finditer(r'  5 \{\s*\n\s*1: "([^"]+)"\s*\n((?:\s*2 \{[^}]*\}\s*\n)*)', text):
    list_name = m.group(1)
    values_block = m.group(2)
    values = re.findall(r'2 \{\s*\n\s*1: "([^"]+)"', values_block)
    value_lists[list_name] = values

# Helper: load dictionary names
def load_dict(dict_type):
    if dict_type not in dict_hashes:
        return []
    h = dict_hashes[dict_type]
    txt_file = os.path.join(cache_dir, f"dict-{h}.txt")
    if not os.path.exists(txt_file):
        bin_file = os.path.join(cache_dir, f"dict-{h}.bin")
        subprocess.run(
            ["curl", "-sf", f"{base_url}/poe2/api/builds/dictionary/{h}", "-o", bin_file],
            check=True
        )
        with open(bin_file, "rb") as bf:
            result = subprocess.run(["protoc", "--decode_raw"], stdin=bf, capture_output=True, text=True)
            with open(txt_file, "w") as tf:
                tf.write(result.stdout)
    with open(txt_file) as f:
        return re.findall(r'^2: "(.+)"', f.read(), re.MULTILINE)

def print_dimension(title, dim_id, dict_type, limit=20):
    if dim_id not in dimensions:
        return
    dim = dimensions[dim_id]
    names = load_dict(dict_type)
    counts = sorted(dim["counts"], key=lambda x: x[1], reverse=True)

    print(f"--- {title} ---")
    for key, count in counts[:limit]:
        name = names[key] if key < len(names) else f"#{key}"
        pct = f"{count/total*100:.1f}%" if total > 0 else "?%"
        print(f"  {name:40s} {count:>6,} ({pct})")
    print()

print_dimension("Class Distribution", "class", "class", 25)
print_dimension("Top Main Skills", "skills", "gem", 20)
print_dimension("Top Items", "items", "item", 20)
print_dimension("Top Keystones", "keypassives", "keypassive", 20)
print_dimension("Masteries", "masteries", "mastery", 15)
print_dimension("Bandits", "bandit", "bandit", 5)
print_dimension("Pantheon", "pantheon", "pantheon", 10)

# Character list
if "name" in value_lists:
    print("--- Top Characters ---")
    accounts = value_lists.get("account", [])
    for i, name in enumerate(value_lists["name"][:25]):
        acct = accounts[i] if i < len(accounts) else "?"
        print(f"  {i+1:3d}. {name:30s} ({acct})")
PYEOF
}

# --- commands ---

cmd_leagues() {
  echo "=== Available Leagues ==="
  get_index_state | python3 -c "
import json, sys
data = json.loads(sys.stdin.readline())
print('Current:')
for l in data.get('buildLeagues', data.get('economyLeagues', [])):
    print(f'  {l[\"url\"]:30s} {l[\"displayName\"]}')
print()
print('Old:')
for l in data.get('oldBuildLeagues', data.get('oldEconomyLeagues', [])):
    print(f'  {l[\"url\"]:30s} {l[\"displayName\"]}')
"
}

cmd_version() {
  local league="${1:-$DEFAULT_LEAGUE}"
  local type="${2:-$DEFAULT_TYPE}"
  get_version "$league" "$type"
}

cmd_dictionary() {
  require_protoc
  local dict_type="${1:?Usage: builds-api.sh dictionary <type> [league]}"
  local league="${2:-$DEFAULT_LEAGUE}"
  local type="${3:-$DEFAULT_TYPE}"

  local search_file
  search_file=$(fetch_search_file "$league" "$type")

  # Find hash for this dict type
  local hash
  hash=$(grep -A2 "^  6 {" "$search_file" | paste - - - - | grep "\"$dict_type\"" | grep -oE '[a-f0-9]{40}' | head -1)

  if [[ -z "$hash" ]]; then
    echo "Available dictionary types:"
    grep -A2 "^  6 {" "$search_file" | paste - - - - | sed -E 's/.*1: "([^"]+)".*/  \1/' | sort
    die "Dictionary type '$dict_type' not found"
  fi

  echo "=== Dictionary: $dict_type ==="
  local dict_file
  dict_file=$(fetch_dict_file "$hash")
  dict_values "$dict_file" | nl -ba
}

cmd_overview() {
  require_protoc
  local league="$DEFAULT_LEAGUE"
  local type="$DEFAULT_TYPE"
  local -a filters=()

  # Parse args: positional league/type, then --class/--skill filters
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --class)  filters+=("class=$2"); shift 2 ;;
      --skill)  filters+=("skill=$2"); shift 2 ;;
      --item)   filters+=("item=$2"); shift 2 ;;
      -*)       die "Unknown flag: $1" ;;
      *)
        if [[ "$league" == "$DEFAULT_LEAGUE" && "$1" != "$DEFAULT_TYPE" ]]; then
          league="$1"
        else
          type="$1"
        fi
        shift ;;
    esac
  done

  local version
  version=$(get_version "$league" "$type")

  local filter_desc=""
  for f in "${filters[@]}"; do
    filter_desc="$filter_desc | Filter: $f"
  done

  echo "=== poe.ninja Build Overview ==="
  echo "League: $league | Type: $type | Version: $version$filter_desc"
  echo ""

  local search_file
  search_file=$(fetch_search_file "$league" "$type" "${filters[@]}")

  parse_overview "$search_file"
}

cmd_character() {
  local account="${1:?Usage: builds-api.sh character <account> <name> [league]}"
  local name="${2:?Usage: builds-api.sh character <account> <name> [league]}"
  local league="${3:-$DEFAULT_LEAGUE}"
  local type="${4:-$DEFAULT_TYPE}"

  local version
  version=$(get_version "$league" "$type")
  local snapshot
  snapshot=$(get_snapshot_name "$league" "$type")

  local encoded_account encoded_name
  encoded_account=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$account'))")
  encoded_name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$name'))")

  local url="$BASE_URL/poe2/api/builds/$version/character?account=$encoded_account&name=$encoded_name&overview=$snapshot"
  local out_file="$CACHE_DIR/char-$name.json"

  curl -sf "$url" -o "$out_file" || die "Character not found: $name (account: $account)"

  python3 - "$out_file" << 'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    d = json.load(f)

print(f'=== {d["name"]} — Lv{d["level"]} {d.get("class", d.get("ascendancyClassName","?"))} ===')
print(f'Account: {d["account"]}')
print(f'League: {d.get("league","?")}')
print()

# Defensive stats
ds = d.get("defensiveStats", {})
if ds:
    print("--- Defenses ---")
    for k in ["life","energyShield","mana","armour","evasionRating","effectiveHealthPool"]:
        if k in ds: print(f"  {k}: {ds[k]:,}")
    print(f"  Block: {ds.get('blockChance',0)}% / Spell: {ds.get('spellBlockChance',0)}%")
    print()
    print("--- Resistances ---")
    for k in ["fireResistance","coldResistance","lightningResistance","chaosResistance"]:
        if k in ds:
            over = ds.get(k.replace("Resistance","ResistanceOverCap"), 0)
            overcap = f" (overcap: +{over})" if over else ""
            print(f"  {k}: {ds[k]}%{overcap}")
    print()

# Keystones
ks = d.get("keyStones", [])
if ks:
    print(f"--- Keystones ({len(ks)}) ---")
    for k in ks:
        name = k if isinstance(k, str) else k.get("name", str(k))
        print(f"  - {name}")
    print()

# Skills/gems
skills = d.get("skills", [])
if skills:
    print(f"--- Gem Groups ({len(skills)}) ---")
    for i, group in enumerate(skills):
        all_gems = group.get("allGems", []) if isinstance(group, dict) else []
        gem_strs = []
        for g in all_gems:
            name = g.get("name", "?")
            gem_strs.append(name)
        if gem_strs:
            print(f"  [{i+1}] {' + '.join(gem_strs)}")
    print()

# Masteries
masteries = d.get("masteries", [])
if masteries:
    print(f"--- Masteries ({len(masteries)}) ---")
    for m in masteries[:10]:
        name = m if isinstance(m, str) else m.get("name", str(m))
        print(f"  - {name}")
    print()

# Pantheon
print(f"Pantheon: {d.get('pantheonMajor','?')} / {d.get('pantheonMinor','?')}")
print(f"Bandit: {d.get('banditChoice','?')}")

# PoB code
pob = d.get("pathOfBuildingExport", "")
if pob:
    print(f"\nPoB code: {len(pob)} chars")
    # Save to file
    pob_file = sys.argv[1].replace(".json", "-pob.txt")
    with open(pob_file, "w") as f:
        f.write(pob)
    print(f"Saved to: {pob_file}")
PYEOF
}

cmd_raw() {
  require_protoc
  local league="${1:-$DEFAULT_LEAGUE}"
  local type="${2:-$DEFAULT_TYPE}"

  local search_file
  search_file=$(fetch_search_file "$league" "$type")
  cat "$search_file"
}

# --- main ---

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  overview)   cmd_overview "$@" ;;
  character)  cmd_character "$@" ;;
  dictionary) cmd_dictionary "$@" ;;
  leagues)    cmd_leagues ;;
  version)    cmd_version "$@" ;;
  raw)        cmd_raw "$@" ;;
  help|-h|--help)
    echo "poe.ninja POE2 Builds API client (protobuf)"
    echo ""
    echo "Usage:"
    echo "  builds-api.sh overview [league] [--class X] [--skill Y]  — aggregate POE2 stats"
    echo "  builds-api.sh character <account> <name> [league]        — character detail + PoB2 export"
    echo "  builds-api.sh dictionary <type> [league]                 — list dictionary entries"
    echo "  builds-api.sh leagues                                    — list available POE2 leagues"
    echo "  builds-api.sh version [league]                           — show snapshot version"
    echo "  builds-api.sh raw [league]                               — raw decoded protobuf"
    echo ""
    echo "Examples:"
    echo "  builds-api.sh overview --class Lich"
    echo "  builds-api.sh overview runesofaldur --class Stormweaver --skill Spark"
    echo "  builds-api.sh character hopthuxacnhan-3062 MyCharName"
    echo ""
    echo "POE2 leagues: runesofaldur (0.5 — guess slug, verify), vaal (0.4 archive)"
    echo "Snapshot type: empty by default (POE2 has 1 ranking style only)"
    echo "Dict types: class, gem, item, keypassive (POE2 has NO mastery/pantheon/bandit)"
    ;;
  *)
    die "Unknown command: $cmd. Run with 'help' for usage."
    ;;
esac
