#!/usr/bin/env python3
"""
Collect POE2 price history từ poe2scout.com — nguồn giá DUY NHẤT của workspace.

poe2scout là registered GGG partner (OAuth scope service:cxapi) nên re-publish ra
api.poe2scout.com (public, no-auth):
  - Currency: volume-weighted từ Currency Exchange (volume trade THẬT).
  - Uniques: floor-ask securable từ trade2, quy về Exalted.
Cả 24 category (currency + fragments + runes + uniques + ...) đều có per-item
DailyStatsHistory (OHLC + Volume) full-league — không còn giới hạn 7d sparkline.

Progressive theo dedup key (league, item, variant, type, date): chạy lại trong ngày
ghi đè record hôm nay; ngày khác cùng tồn tại.

NOTE: record field giữ tên `price_chaos` (downstream contract với forecast.py +
build.ts) nhưng giá trị denominated theo **Exalted Orb** — baseline POE2. poe2scout
DailyStatsHistory đã denominate theo BaseCurrencyApiId="exalted" cho league hiện tại,
nên map THẲNG từ DailyStats.Average (fallback Close) — KHÔNG cần convert như poe.ninja.
`listings` = DailyStats.Volume (volume giao dịch trong ngày). `type` = category Label
(currency category → "Currency", giữ forecast.py `--type Currency`).

SOURCE:
  GET https://api.poe2scout.com/poe2/Leagues                      → resolve slug (Value→ShortName)
  GET .../Leagues/{slug}/Items/Categories                         → 24 category
  GET .../Leagues/{slug}/{Currencies|Uniques}/ByCategory?...      → item list + CurrentPrice
  GET .../Leagues/{slug}/Items/{ItemId}/DailyStatsHistory?DayCount=365  → daily OHLC + Volume

Usage:
  python .claude/skills/price-forecast/scripts/collect.py
  python .claude/skills/price-forecast/scripts/collect.py --leagues "Runes of Aldur"
  python .claude/skills/price-forecast/scripts/collect.py --force    # drop old history for re-fetched items
"""

import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leagues import LEAGUES

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

try:
    import certifi

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

# scripts → price-forecast → skills → .claude → project root (poe2/).
# Workspace is game-specific — canonical layout is data/price-history/ (no game subpath).
DATA_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "data", "price-history"
)
DAILY_DIR = os.path.join(DATA_DIR, "daily")
os.makedirs(DAILY_DIR, exist_ok=True)

# Master file accumulates one record per (league, item, variant, type, date).
MASTER_FILE = os.path.join(DATA_DIR, "master.json")

BASE = "https://api.poe2scout.com/poe2"

# POE2 baseline = Exalted Orb. Only track items ≥ 5 ex (flippable threshold) so we
# don't fetch DailyStatsHistory for hundreds of vendor-trash uniques.
MIN_EXALTED = 5

# Politeness delay between per-item history calls — poe2scout rate-limits bulk pulls
# (the reason its own skill went lazy-cache). 0.12s keeps a full crawl ~1-2 min.
HISTORY_DELAY_SEC = 0.12


# Per-day raw crawl snapshot. Overwritten on every crawl within the same day, so it
# always reflects the latest fetch. Audit trail; master can be reconstructed from these.
def daily_path(date_str):
    return os.path.join(DAILY_DIR, f"{date_str}.json")


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as r:
        return json.loads(r.read())


def load_existing():
    """Load master.json (accumulated history). Returns the record list."""
    if not os.path.exists(MASTER_FILE):
        return []
    with open(MASTER_FILE) as f:
        return json.load(f)


def progress(current, total, name, price=None):
    pct = current / total * 100 if total else 0
    bar_len = 20
    filled = int(bar_len * current / total) if total else 0
    bar = "█" * filled + "░" * (bar_len - filled)
    extra = f" {price:,.0f}ex" if price else ""
    print(
        f"\r    [{bar}] {current}/{total} ({pct:.0f}%) {name}{extra}    ",
        end="",
        flush=True,
    )


def resolve_scout_slug(league_name):
    """Map a leagues.py display name → poe2scout ShortName slug (via live Leagues API)."""
    try:
        leagues = fetch_json(f"{BASE}/Leagues")
    except Exception as e:
        print(f"  ! could not fetch poe2scout leagues: {e}")
        return None
    for lg in leagues:
        if lg.get("Value") == league_name:
            return lg.get("ShortName")
    return None


def fetch_category_items(slug, kind, category_api_id):
    """Paginate ByCategory → all items (kind = 'Currencies' | 'Uniques')."""
    items = []
    page = 1
    while True:
        url = (
            f"{BASE}/Leagues/{slug}/{kind}/ByCategory"
            f"?Category={urllib.parse.quote(category_api_id)}&Page={page}&PerPage=100"
        )
        body = fetch_json(url)
        items.extend(body.get("Items", []))
        if page >= body.get("Pages", 1):
            break
        page += 1
    return items


def collect_league(league_info):
    """
    For each category, list items ≥ MIN_EXALTED, then pull each item's full-league
    DailyStatsHistory (OHLC + Volume) → one record per day. Prices already in Exalted.
    """
    league_name = league_info["name"]
    league_start = datetime.strptime(league_info["start"], "%Y-%m-%d")

    print(f"\n{'=' * 60}")
    print(f"  {league_name} (start: {league_info['start']})")
    print(f"{'=' * 60}\n")

    slug = resolve_scout_slug(league_name)
    if not slug:
        print(f"  ! poe2scout has no league matching {league_name!r} — skipped")
        return []
    print(f"  poe2scout slug: {slug}")

    try:
        cats = fetch_json(f"{BASE}/Leagues/{slug}/Items/Categories")
    except Exception as e:
        print(f"  ! could not fetch categories: {e}")
        return []

    groups = [("Currencies", c) for c in cats.get("CurrencyCategories", [])] + [
        ("Uniques", c) for c in cats.get("UniqueCategories", [])
    ]

    records = []
    for gi, (kind, cat) in enumerate(groups, 1):
        cat_api = cat["ApiId"]
        cat_label = cat.get("Label", cat_api)
        try:
            items = fetch_category_items(slug, kind, cat_api)
        except Exception as e:
            print(f"  [{gi}/{len(groups)}] {cat_label}: ERROR listing ({e})")
            continue

        flippable = [it for it in items if (it.get("CurrentPrice") or 0) >= MIN_EXALTED]
        print(
            f"  [{gi}/{len(groups)}] {cat_label}: {len(items)} items, "
            f"{len(flippable)} ≥ {MIN_EXALTED} ex"
        )

        collected = 0
        for i, it in enumerate(flippable):
            item_id = it["ItemId"]
            item_name = it.get("Text") or it.get("Name") or str(item_id)
            progress(i + 1, len(flippable), item_name, it.get("CurrentPrice"))

            try:
                hist = fetch_json(
                    f"{BASE}/Leagues/{slug}/Items/{item_id}/DailyStatsHistory?DayCount=365"
                )
            except Exception:
                continue  # skip a flaky item, keep the crawl going

            for ds in hist.get("DailyStats", []):
                try:
                    day = datetime.strptime(ds["Time"], "%Y-%m-%d")
                except (KeyError, ValueError):
                    continue
                if day < league_start:
                    continue
                price = ds.get("Average") or ds.get("Close")
                if not price or price <= 0:
                    continue
                records.append(
                    {
                        "league": league_name,
                        "item": item_name,
                        "variant": "",
                        "type": cat_label,
                        "date": day.strftime("%Y-%m-%d"),
                        "league_day": (day - league_start).days,
                        "price_chaos": round(price, 2),
                        "listings": round(ds.get("Volume") or 0),
                        "day_of_week": day.weekday(),
                    }
                )
            collected += 1
            time.sleep(HISTORY_DELAY_SEC)

        print(f"\r    ✓ {collected} items snapshotted{' ' * 40}")

    return records


def main():
    start_time = time.time()

    filter_leagues = None
    force = "--force" in sys.argv
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--leagues" and i < len(sys.argv) - 1:
            filter_leagues = [l.strip() for l in sys.argv[i + 1].split(",")]

    existing_data = load_existing()

    print(f"{'=' * 60}")
    print(f"  PoE2 Price Collector — source: poe2scout.com (single price source)")
    print(
        f"  Min {MIN_EXALTED} ex | {'FORCE (drop old history for re-fetched)' if force else 'Merge mode'}"
    )
    print(f"{'=' * 60}")

    # Which leagues: explicit filter, else active leagues + any ended league we lack data for.
    leagues = LEAGUES
    if filter_leagues:
        leagues = [l for l in LEAGUES if l["name"] in filter_leagues]
        print(f"\nFiltered to: {[l['name'] for l in leagues]}")
    else:
        active = []
        for l in LEAGUES:
            if l["end"] is None:
                active.append(l)
            elif not any(d["league"] == l["name"] for d in existing_data):
                active.append(l)
        leagues = active
        print(f"\nAuto-selected leagues: {[l['name'] for l in leagues]}")

    new_data = []
    for league in leagues:
        items = collect_league(league)
        new_data.extend(items)
        print(f"\n  → {len(items):,} new data points from {league['name']}")

    if not new_data and not existing_data:
        print("\n❌ No data collected!")
        return

    # Merge into master: NEW wins for any (league, item, variant, type, date) collision.
    # --force keeps only NEW data (old history dropped for re-fetched items, kept otherwise).
    all_records = new_data if force else new_data + existing_data

    seen = set()
    merged = []
    for d in all_records:
        key = (d["league"], d["item"], d.get("variant", ""), d["type"], d["date"])
        if key not in seen:
            seen.add(key)
            merged.append(d)

    # Atomic master write so a crash mid-write can't corrupt the source build.ts depends on.
    tmp_master = MASTER_FILE + ".tmp"
    with open(tmp_master, "w") as f:
        json.dump(merged, f)
    os.replace(tmp_master, MASTER_FILE)

    # Per-day audit snapshot — exactly what came back this crawl (no merge).
    today = datetime.now().strftime("%Y-%m-%d")
    todays_crawl = [d for d in new_data if d["date"] == today]
    if todays_crawl:
        daily_file = daily_path(today)
        tmp_daily = daily_file + ".tmp"
        with open(tmp_daily, "w") as f:
            json.dump(todays_crawl, f)
        os.replace(tmp_daily, daily_file)
        print(f"  Audit snapshot: daily/{today}.json ({len(todays_crawl)} records)")

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"  DONE in {int(elapsed // 60)}m {int(elapsed % 60)}s")
    print(
        f"  {len(new_data):,} new + {len(existing_data):,} existing → {len(merged):,} total (deduped)"
    )
    print(f"  Saved to {MASTER_FILE}")
    leagues_found = sorted(set(d["league"] for d in merged))
    print(
        f"  {len(leagues_found)} leagues, {len(set(d['item'] for d in merged))} unique items"
    )
    for league in leagues_found:
        league_data = [d for d in merged if d["league"] == league]
        days = set(d["league_day"] for d in league_data)
        types = sorted(set(d["type"] for d in league_data))
        print(
            f"    {league}: {len(league_data):,} pts, days {min(days)}→{max(days)}, "
            f"{len(set(d['item'] for d in league_data))} items"
        )
        print(f"      types: {', '.join(types)}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
