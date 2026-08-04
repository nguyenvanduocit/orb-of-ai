#!/usr/bin/env bash
# poe2scout.com market data API client (POE2 workspace — realm=poe2)
#
# Usage:
#   api.sh leagues                              List leagues for poe2 realm
#   api.sh categories [league]                  List currency + unique categories
#   api.sh list <category> [league] [top]       List items in a category (sorted by price desc)
#   api.sh item <name-or-apiid> [league]        Lookup item with full history (24h cache, live fetch on miss)
#   api.sh history <name-or-apiid> [league]     Force-refresh single item history (bypass cache)
#   api.sh trends [league]                      Opt-in: pull all histories + multi-window trends (slow ~15 min)
#   api.sh reference [league]                   Reference currency rates (chaos/divine/exalted)
#   api.sh snapshot [league]                    Fast catalog snapshot only (~30s, no rate-limit)
#   api.sh pairs [league] [top]                 Currency Exchange pairs — REAL traded volume (cxapi-derived)
#   api.sh ticks <name-or-id> [league] [count]  Raw per-tick price history (Price/Time/Quantity, count÷4)
#
# Env overrides:
#   POE2SCOUT_LEAGUE   Default league slug (otherwise auto-detect IsCurrent softcore)
#   POE2SCOUT_NOCACHE  Set to "1" to bypass HTTP cache

set -euo pipefail

REALM="poe2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
DATA_DIR="$WORKSPACE_DIR/data/poe2scout"
CACHE_DIR="$WORKSPACE_DIR/tmp/poe2scout-cache"
BASE_URL="https://api.poe2scout.com"
CACHE_TTL_SEC=300  # 5 min

mkdir -p "$CACHE_DIR"

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 not found — install it first"; }
need curl
need jq

# Cached GET — cache key derived from URL hash
http_get() {
  local url="$1"
  local key
  key="$(echo -n "$url" | shasum | cut -d' ' -f1)"
  local cache="$CACHE_DIR/$key.json"

  if [[ "${POE2SCOUT_NOCACHE:-0}" != "1" && -f "$cache" ]]; then
    local age=$(( $(date +%s) - $(stat -f%m "$cache" 2>/dev/null || stat -c%Y "$cache" 2>/dev/null || echo 0) ))
    if (( age < CACHE_TTL_SEC )); then
      cat "$cache"
      return
    fi
  fi

  curl -sfL --max-time 20 "$url" > "$cache.tmp" \
    || { rm -f "$cache.tmp"; die "GET $url failed"; }
  mv "$cache.tmp" "$cache"
  cat "$cache"
}

# Resolve league: explicit arg > env > auto-detect (IsCurrent, non-HC)
resolve_league() {
  local explicit="${1:-}"
  if [[ -n "$explicit" ]]; then echo "$explicit"; return; fi
  if [[ -n "${POE2SCOUT_LEAGUE:-}" ]]; then echo "$POE2SCOUT_LEAGUE"; return; fi

  http_get "$BASE_URL/$REALM/Leagues" \
    | jq -r '[.[] | select(.IsCurrent == true) | .ShortName]
             | (map(select(endswith("hc") | not)) | first) // .[0]'
}

# ===== Subcommands =====

cmd_leagues() {
  echo "## Leagues — realm=$REALM"
  echo ""
  http_get "$BASE_URL/$REALM/Leagues" | jq -r '
    .[] |
    "- **\(.Value)** — slug `\(.ShortName)` "
    + (if .IsCurrent then "(current) " else "" end)
    + "— 1 div = \(.DivinePrice | floor) \(.BaseCurrencyText)"
  '
}

cmd_categories() {
  local league; league="$(resolve_league "${1:-}")"
  local data; data="$(http_get "$BASE_URL/$REALM/Leagues/$league/Items/Categories")"

  echo "## Categories — league=$league realm=$REALM"
  echo ""
  echo "### Currency categories"
  echo "$data" | jq -r '.CurrencyCategories[] | "- `\(.ApiId)` — \(.Label)"'

  local ucnt
  ucnt="$(echo "$data" | jq -r '.UniqueCategories | length')"
  if (( ucnt > 0 )); then
    echo ""
    echo "### Unique categories"
    echo "$data" | jq -r '.UniqueCategories[] | "- `\(.ApiId)` — \(.Label)"'
  fi
}

# Fetch all pages of a single category (currencies or uniques)
# $1=league $2=kind(Currencies|Uniques) $3=category
fetch_all_category() {
  local league="$1" kind="$2" category="$3"
  local page=1 perpage=100
  local out='[]'
  while :; do
    local body
    body="$(http_get "$BASE_URL/$REALM/Leagues/$league/$kind/ByCategory?Category=$category&Page=$page&PerPage=$perpage")"
    local items pages
    items="$(echo "$body" | jq -c '.Items')"
    pages="$(echo "$body" | jq -r '.Pages')"
    out="$(jq -c -n --argjson a "$out" --argjson b "$items" '$a + $b')"
    (( page >= pages )) && break
    page=$((page + 1))
  done
  echo "$out"
}

# Pretty print rich item history from wrapped cache file (see _wrap_item).
# $1 = wrapped JSON  ({itemId, apiId, text, categoryApiId, kind, baseCurrencyText, dailyStats, ...})
print_item_history() {
  local wrapped="$1"
  jq -nr --argjson c "$wrapped" '
    ($c.dailyStats // []) as $stats |
    ($stats | length) as $n |
    "- **\($c.text)** (`\($c.apiId)`)"
    + (if $c.type then " — \($c.type)" else "" end)
    + "\n  - Category: \($c.categoryApiId) (\($c.kind))"
    + "\n  - Current: **\($c.currentPrice | tostring | .[0:10])** \($c.baseCurrencyText // "") · listed now: \($c.currentQuantity)"
    + (if $n == 0 then "\n  - History: none"
       else
         # Freshness flag — last data point relative to today
         ((now | strftime("%Y-%m-%d")) as $today |
          ((($today | strptime("%Y-%m-%d") | mktime) -
            ($stats[-1].Time | strptime("%Y-%m-%d") | mktime)) / 86400 | floor) as $stale_days |
          "\n  - History: \($n) days, \($stats[0].Time) → \($stats[-1].Time)"
          + (if $stale_days > 7 then " ⚠️ last data \($stale_days)d ago (stale)" else "" end))
         + (
           # Compute deltas at 7d / 30d / league windows from end of series
           ($stats[-1]) as $cur |
           ($stats[0]) as $oldL |
           (($cur.Average // $cur.Close) as $cp |
            ($oldL.Average // $oldL.Close) as $op |
            (if $op > 0 then "\n  - Δ league (\($n)d): \((($cp - $op) / $op * 100) | tostring | .[0:7])%" else "" end))
           +
           (if $n >= 7 then
              ($stats[-7]) as $o |
              ($cur.Average // $cur.Close) as $cp |
              ($o.Average // $o.Close) as $op |
              (if $op > 0 then "\n  - Δ 7d:  \((($cp - $op) / $op * 100) | tostring | .[0:7])%" else "" end)
            else "" end)
           +
           (if $n >= 30 then
              ($stats[-30]) as $o |
              ($cur.Average // $cur.Close) as $cp |
              ($o.Average // $o.Close) as $op |
              (if $op > 0 then "\n  - Δ 30d: \((($cp - $op) / $op * 100) | tostring | .[0:7])%" else "" end)
            else "" end)
         )
         + (
           # Volume summary (avg over last 7 days of data)
           ($stats | (if length > 7 then .[length-7:] else . end)) as $recent |
           (($recent | map(.Volume // 0) | add) / ($recent | length)) as $avgv |
           "\n  - Volume avg (last \($recent | length)d): \($avgv | tostring | .[0:8])"
         )
         + "\n  - Recent OHLC (last 10d):"
         + ($stats | (if length > 10 then .[length-10:] else . end) | reverse
             | map("\n    · \(.Time)  avg \(.Average | tostring | .[0:10])  H \(.High | tostring | .[0:10])  L \(.Low | tostring | .[0:10])  vol \(.Volume)")
             | join(""))
       end
     )
  '
}

cmd_list() {
  local category="${1:-}"; shift || true
  [[ -z "$category" ]] && die "Usage: api.sh list <category> [league] [top]"
  local league; league="$(resolve_league "${1:-}")"; [[ $# -gt 0 ]] && shift
  local top="${1:-25}"

  local cats; cats="$(http_get "$BASE_URL/$REALM/Leagues/$league/Items/Categories")"
  local kind=""
  if echo "$cats" | jq -e --arg c "$category" '.CurrencyCategories[] | select(.ApiId==$c)' >/dev/null; then
    kind="Currencies"
  elif echo "$cats" | jq -e --arg c "$category" '.UniqueCategories[] | select(.ApiId==$c)' >/dev/null; then
    kind="Uniques"
  else
    die "Unknown category '$category'. Run: api.sh categories"
  fi

  echo "## $category items — league=$league ($kind), top $top by current price"
  echo ""
  fetch_all_category "$league" "$kind" "$category" \
    | jq -r --argjson top "$top" '
        sort_by(-(.CurrentPrice // 0))[:$top] | .[] |
        ((.PriceLogs // []) | map(select(. != null))) as $pl |
        "- **\(.Text)** — \(.CurrentPrice // 0 | tostring | .[0:10]) (vol \(.CurrentQuantity // 0))"
        + (if ($pl | length) >= 2 and ($pl[-1].Price // 0) > 0 then
            ($pl[0].Price as $cur | $pl[-1].Price as $old |
              " · Δ7d \((($cur - $old) / $old * 100) | tostring | .[0:6])%")
          else "" end)
      '
}

# Resolve item by query → catalog entry (catalog.json local OR live scan as fallback)
# Echoes the catalog JSON object on stdout; returns 1 if not found.
resolve_item() {
  local league="$1" query="$2"
  local catalog="$DATA_DIR/$league/catalog.json"
  local lc_query; lc_query="$(echo "$query" | tr '[:upper:]' '[:lower:]')"

  if [[ -f "$catalog" ]]; then
    local hit
    hit="$(jq -c --arg q "$lc_query" '
      [.items | to_entries[] | .value
        | select(
            (.text // "" | ascii_downcase | contains($q)) or
            (.apiId // "" | ascii_downcase | contains($q)) or
            (.name // "" | ascii_downcase | contains($q))
          )]
      | sort_by(-(.currentPrice // 0)) | first // null
    ' "$catalog")"
    if [[ -n "$hit" && "$hit" != "null" ]]; then echo "$hit"; return 0; fi
  fi
  return 1
}

# Wrap raw DailyStatsHistory response + catalog metadata → unified item JSON
# $1 = catalog item JSON  $2 = raw DailyStatsHistory response JSON
_wrap_item() {
  local cat_json="$1" hist_json="$2"
  jq -nc --argjson c "$cat_json" --argjson h "$hist_json" '{
    itemId: $c.itemId,
    apiId: $c.apiId,
    text: $c.text,
    categoryApiId: $c.categoryApiId,
    kind: $c.kind,
    currentPrice: ($c.currentPrice // 0),
    currentQuantity: ($c.currentQuantity // 0),
    name: $c.name,
    type: $c.type,
    iconUrl: $c.iconUrl,
    baseCurrencyApiId: $h.BaseCurrencyApiId,
    baseCurrencyText: $h.BaseCurrencyText,
    fetched_at: (now | todate),
    dailyStats: ($h.DailyStats // [])
  }'
}

# Fetch item history (with optional cache).
# $1=league $2=itemId $3=cat_json $4=ttl_seconds (0=force refetch)
# Writes wrapped JSON to items/<id>.json and echoes wrapped JSON to stdout.
_fetch_item_history() {
  local league="$1" item_id="$2" cat_json="$3" ttl="${4:-86400}"
  local items_dir="$DATA_DIR/$league/items"
  local cache="$items_dir/${item_id}.json"
  mkdir -p "$items_dir"

  if (( ttl > 0 )) && [[ -f "$cache" ]]; then
    local age
    age=$(( $(date +%s) - $(stat -f%m "$cache" 2>/dev/null || stat -c%Y "$cache" 2>/dev/null || echo 0) ))
    if (( age < ttl )); then
      # Cache hit — but refresh `currentPrice/Quantity` from catalog (catalog is fresher than items/ TTL)
      jq -c --argjson cat "$cat_json" '
        .currentPrice = ($cat.currentPrice // 0)
        | .currentQuantity = ($cat.currentQuantity // 0)
      ' "$cache"
      return
    fi
  fi

  # Cache miss / expired — live fetch
  local hist_json
  hist_json="$(http_get "$BASE_URL/$REALM/Leagues/$league/Items/$item_id/DailyStatsHistory?DayCount=365")"
  local wrapped
  wrapped="$(_wrap_item "$cat_json" "$hist_json")"
  echo "$wrapped" | jq -S . > "$cache.tmp"
  mv "$cache.tmp" "$cache"
  echo "$wrapped"
}

cmd_item() {
  local query="${1:-}"; shift || true
  [[ -z "$query" ]] && die "Usage: api.sh item <name-or-apiid> [league]"
  local league; league="$(resolve_league "${1:-}")"

  local cat_json
  if cat_json="$(resolve_item "$league" "$query")"; then
    echo "## Item match (catalog hit, history fetched live)"
  else
    # No catalog → do live scan via ByCategory then synthesize a minimal catalog entry
    echo "## Item match (live scan — run \`api.sh snapshot\` for instant lookups)"
    local cats; cats="$(http_get "$BASE_URL/$REALM/Leagues/$league/Items/Categories")"
    local lc_query; lc_query="$(echo "$query" | tr '[:upper:]' '[:lower:]')"
    local found=""

    while read -r cat; do
      local items; items="$(fetch_all_category "$league" "Currencies" "$cat")"
      local hit
      hit="$(echo "$items" | jq -c --arg q "$lc_query" '
        map(select((.Text // "" | ascii_downcase | contains($q)) or
                   (.ApiId // "" | ascii_downcase | contains($q))))
        | sort_by(-(.CurrentPrice // 0)) | first
      ')"
      if [[ "$hit" != "null" && -n "$hit" ]]; then found="$hit"; break; fi
    done < <(echo "$cats" | jq -r '.CurrencyCategories[].ApiId')

    if [[ -z "$found" ]]; then
      while read -r cat; do
        local items; items="$(fetch_all_category "$league" "Uniques" "$cat")"
        local hit
        hit="$(echo "$items" | jq -c --arg q "$lc_query" '
          map(select((.Text // "" | ascii_downcase | contains($q)) or
                     (.Name // "" | ascii_downcase | contains($q)) or
                     (.ApiId // "" | ascii_downcase | contains($q))))
          | sort_by(-(.CurrentPrice // 0)) | first
        ')"
        if [[ "$hit" != "null" && -n "$hit" ]]; then found="$hit"; break; fi
      done < <(echo "$cats" | jq -r '.UniqueCategories[].ApiId')
    fi

    [[ -z "$found" ]] && die "No item matching '$query' in league=$league"
    # Synthesize catalog-style JSON from ByCategory row.
    # Uniques have no .ApiId — use itemId as fallback slug for display.
    cat_json="$(jq -c '{
      itemId: .ItemId,
      apiId: (.ApiId // (.ItemId | tostring)),
      text: .Text,
      categoryApiId: .CategoryApiId,
      kind: (if .Name then "Unique" else "Currency" end),
      iconUrl: .IconUrl,
      currentPrice: (.CurrentPrice // 0),
      currentQuantity: (.CurrentQuantity // 0),
      name: .Name,
      type: .Type
    }' <<<"$found")"
  fi

  local item_id; item_id="$(echo "$cat_json" | jq -r '.itemId')"
  # TTL=24h — cache hit returns instantly, miss does 1 live fetch + cache.
  local wrapped; wrapped="$(_fetch_item_history "$league" "$item_id" "$cat_json" 86400)"

  echo ""
  print_item_history "$wrapped"
  echo ""
}

# Force-refresh single item history (bypass cache, write fresh items/<id>.json)
cmd_history() {
  local query="${1:-}"; shift || true
  [[ -z "$query" ]] && die "Usage: api.sh history <name-or-apiid> [league]"
  local league; league="$(resolve_league "${1:-}")"

  local cat_json
  if ! cat_json="$(resolve_item "$league" "$query")"; then
    die "No catalog match for '$query'. Run \`api.sh snapshot\` first or use \`api.sh item\` for live scan."
  fi
  local item_id; item_id="$(echo "$cat_json" | jq -r '.itemId')"

  echo "## Refreshing $item_id history (bypass cache)"
  echo ""
  local wrapped; wrapped="$(_fetch_item_history "$league" "$item_id" "$cat_json" 0)"
  print_item_history "$wrapped"
  echo ""
}

# Opt-in heavy compute — pull DailyStatsHistory for ALL items in catalog,
# write items/<id>.json (TTL-respected), compute multi-window trends.json.
# Takes ~15 min for ~1000 items with 250ms pacing.
cmd_trends() {
  local league; league="$(resolve_league "${1:-}")"
  need bun
  bun "$SCRIPT_DIR/trends.ts" --realm "$REALM" --league "$league" --data "$DATA_DIR"
}

cmd_reference() {
  local league; league="$(resolve_league "${1:-}")"
  echo "## Reference currencies — league=$league"
  echo ""
  http_get "$BASE_URL/$REALM/Leagues/$league/ReferenceCurrencies" | jq -r '
    .[] | "- **\(.Text)** (`\(.ApiId)`) — 1 \(.Text) = \(.RelativePrice) \(.DefaultCurrency.Text // "exalted")"
  '
  echo ""
  echo "League rates (from /Leagues):"
  http_get "$BASE_URL/$REALM/Leagues" \
    | jq -r --arg lg "$league" '
        .[] | select(.ShortName == $lg) |
        "- 1 Divine Orb = \(.DivinePrice | floor) \(.BaseCurrencyText)\n- 1 Chaos Orb = \(.ChaosDivinePrice) per div"
      '
}

cmd_snapshot() {
  local league; league="$(resolve_league "${1:-}")"
  need bun
  bun "$SCRIPT_DIR/snapshot.ts" --realm "$REALM" --league "$league"
}

# Currency Exchange pairs — REAL traded volume (cxapi-derived, NOT listing asks).
# Each pair reports VolumeTraded + HighestStock per side; the currency price
# aggregation poe2scout serves is built from exactly these snapshots.
cmd_pairs() {
  local league; league="$(resolve_league "${1:-}")"; [[ $# -gt 0 ]] && shift
  local top="${1:-30}"
  echo "## Currency Exchange pairs — league=$league realm=$REALM (real traded volume, top $top)"
  echo ""
  http_get "$BASE_URL/$REALM/Leagues/$league/SnapshotPairs" | jq -r --argjson top "$top" '
    sort_by(-((.Volume // "0") | tonumber))[:$top] | .[] |
    "- **\(.CurrencyOne.Text) ⇄ \(.CurrencyTwo.Text)** — pair vol \(((.Volume // "0") | tonumber) | floor)"
    + "\n    · \(.CurrencyOne.Text): traded \(.CurrencyOneData.VolumeTraded) · stock \(.CurrencyOneData.HighestStock) · rel \(((.CurrencyOneData.RelativePrice // "0") | tonumber * 10000 | floor) / 10000)"
    + "\n    · \(.CurrencyTwo.Text): traded \(.CurrencyTwoData.VolumeTraded) · stock \(.CurrencyTwoData.HighestStock) · rel \(((.CurrencyTwoData.RelativePrice // "0") | tonumber * 10000 | floor) / 10000)"
  '
}

# Raw per-tick price history — Price/Time/Quantity straight from price_log.
# Currency = every snapshot; uniques = every 6th (server log_frequency). count must be ÷4.
cmd_ticks() {
  local query="${1:-}"; shift || true
  [[ -z "$query" ]] && die "Usage: api.sh ticks <name-or-id> [league] [count]"
  local league; league="$(resolve_league "${1:-}")"; [[ $# -gt 0 ]] && shift
  local count="${1:-40}"
  (( count % 4 != 0 )) && die "count must be a multiple of 4 (API constraint)"

  local item_id name
  if [[ "$query" =~ ^[0-9]+$ ]]; then
    item_id="$query"; name="item $query"
  else
    local cat_json
    cat_json="$(resolve_item "$league" "$query")" \
      || die "No catalog match for '$query'. Run \`api.sh snapshot\` first, or pass a numeric ItemId."
    item_id="$(echo "$cat_json" | jq -r '.itemId')"
    name="$(echo "$cat_json" | jq -r '.text')"
  fi

  echo "## Raw price ticks — $name (id $item_id) — league=$league, last $count"
  echo ""
  http_get "$BASE_URL/$REALM/Leagues/$league/Items/$item_id/History?LogCount=$count" | jq -r '
    (.PriceHistory // []) as $h |
    (if ($h | length) == 0 then "_(no ticks)_"
     else ($h | map("- \(.Time)  price \(.Price)  qty \(.Quantity)") | join("\n"))
     end)
    + (if .HasMore then "\n_(more available — raise count)_" else "" end)
  '
}

# ===== Dispatcher =====

case "${1:-}" in
  leagues)    shift; cmd_leagues "$@" ;;
  categories) shift; cmd_categories "$@" ;;
  list)       shift; cmd_list "$@" ;;
  item)       shift; cmd_item "$@" ;;
  history)    shift; cmd_history "$@" ;;
  trends)     shift; cmd_trends "$@" ;;
  reference)  shift; cmd_reference "$@" ;;
  snapshot)   shift; cmd_snapshot "$@" ;;
  pairs)      shift; cmd_pairs "$@" ;;
  ticks)      shift; cmd_ticks "$@" ;;
  ""|-h|--help|help)
    sed -n '2,18p' "$0"
    ;;
  *)
    die "Unknown subcommand: $1. Run api.sh help."
    ;;
esac
