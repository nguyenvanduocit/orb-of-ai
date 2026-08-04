#!/usr/bin/env python3
"""
POE2 Price Forecaster using Amazon Chronos-2.

Reads collected POE2 price history từ data/price-history/master.json,
runs Chronos-2 time-series model on ALL items, outputs BUY/SELL/HOLD recommendations.

Usage:
  python .claude/skills/price-forecast/scripts/forecast.py
  python .claude/skills/price-forecast/scripts/forecast.py --days 14
  python .claude/skills/price-forecast/scripts/forecast.py --items "Divine Orb,The Auspex"
  python .claude/skills/price-forecast/scripts/forecast.py --type Currency
  python .claude/skills/price-forecast/scripts/forecast.py --min-price 50
  python .claude/skills/price-forecast/scripts/forecast.py --top 20
  python .claude/skills/price-forecast/scripts/forecast.py --json

League is auto-detected from poe2scout (Leagues IsCurrent). Previous POE2 league
data is prepended as extra history for cross-league pattern learning (limited —
POE2 history is shorter than POE1 because POE2 EA only started 2024-12).

POE2 baseline currency = Exalted Orb (NOT Chaos Orb). The record field is named
`price_chaos` for the downstream contract but values are exalted-denominated
(poe2scout DailyStatsHistory denominates in the league base currency = exalted).
"""

import json
import os
import sys
import urllib.request
import pandas as pd
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leagues import LEAGUE_STARTS

# scripts → price-forecast → skills → .claude → project root (poe2/).
# Canonical layout is data/price-history/master.json — same SOURCE the nuxt
# build:prices step reads. Workspace is game-specific, no game subpath.
DATA_FILE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "..",
    "data",
    "price-history",
    "master.json",
)
LEAGUES_URL = "https://api.poe2scout.com/poe2/Leagues"
MIN_HISTORY_DAYS = 5

# LEAGUE_STARTS ({name: datetime(start)}) comes from leagues.py — the single
# source of truth shared with collect.py.


def fetch_current_league():
    """Detect current league (display name) from poe2scout Leagues API."""
    try:
        req = urllib.request.Request(LEAGUES_URL, headers={"User-Agent": "Mozilla/5.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        # Current non-hardcore softcore league = the temp league we forecast.
        for lg in data:
            name = lg.get("Value", "")
            if (
                lg.get("IsCurrent")
                and "Hardcore" not in name
                and not name.startswith("HC")
            ):
                return name
    except Exception as e:
        print(f"  Warning: could not fetch current league ({e})")
    return None


def detect_league_from_data():
    """Fallback: detect most recent league from collected data."""
    with open(DATA_FILE) as f:
        raw = json.load(f)
    leagues = set(r["league"] for r in raw)
    # Return league with most recent data
    latest = {}
    for r in raw:
        lg = r["league"]
        if lg not in latest or r["date"] > latest[lg]:
            latest[lg] = r["date"]
    if latest:
        return max(latest, key=latest.get)
    return None


def load_history(league, filter_items=None, filter_types=None, min_price=5):
    """Load price history from collected JSON, return list of DataFrames per item.

    Uses current league data for forecasting, prepends previous league data
    (by league_day) as extra history so Chronos-2 can learn cross-league patterns.
    """
    with open(DATA_FILE) as f:
        raw = json.load(f)

    all_leagues = sorted(set(r["league"] for r in raw))
    other_leagues = [lg for lg in all_leagues if lg != league]

    # Current league records
    current_records = [r for r in raw if r["league"] == league]
    if not current_records:
        return [], 0

    df_current = pd.DataFrame(current_records)
    df_current["date"] = pd.to_datetime(df_current["date"])

    # Previous league records (for cross-league training)
    prev_records = [r for r in raw if r["league"] in other_leagues]
    df_prev = pd.DataFrame(prev_records) if prev_records else pd.DataFrame()
    if not df_prev.empty:
        df_prev["date"] = pd.to_datetime(df_prev["date"])

    # Apply filters
    if filter_items:
        df_current = df_current[df_current["item"].isin(filter_items)]
        if not df_prev.empty:
            df_prev = df_prev[df_prev["item"].isin(filter_items)]
    if filter_types:
        df_current = df_current[df_current["type"].isin(filter_types)]
        if not df_prev.empty:
            df_prev = df_prev[df_prev["type"].isin(filter_types)]

    # Group by item+variant
    all_dfs = []
    cross_league_count = 0
    for (item, variant), group in df_current.groupby(["item", "variant"]):
        group = group.sort_values("date").drop_duplicates("date").reset_index(drop=True)
        if len(group) < MIN_HISTORY_DAYS:
            continue

        latest_price = group["price_chaos"].iloc[-1]
        if latest_price < min_price and not filter_items:
            continue

        label = f"{item} ({variant})" if variant else item

        # Try to prepend previous league data for same item+variant
        # Offset dates so previous league data comes before current league data
        frames = []
        if not df_prev.empty:
            prev_match = df_prev[
                (df_prev["item"] == item) & (df_prev["variant"] == (variant or ""))
            ]
            if not prev_match.empty:
                prev_match = (
                    prev_match.sort_values("date")
                    .drop_duplicates("date")
                    .reset_index(drop=True)
                )
                # Place prev league data before current league, with 1 day gap
                earliest_current = group["date"].min()
                latest_prev = prev_match["date"].max()
                offset = earliest_current - latest_prev - timedelta(days=1)

                prices = prev_match["price_chaos"].astype(float)
                rolling_med = prices.rolling(7, min_periods=1).median()
                prices = prices.clip(upper=rolling_med * 10)

                prev_df = pd.DataFrame(
                    {
                        "item_id": label,
                        "timestamp": prev_match["date"] + offset,
                        "target": prices,
                        "league_day": prev_match["league_day"].astype(float),
                        "listings": prev_match["listings"].astype(float),
                    }
                )
                frames.append(prev_df)
                cross_league_count += 1

        # Clip outlier spikes (>10x rolling median) before feeding to model
        prices = group["price_chaos"].astype(float)
        rolling_med = prices.rolling(7, min_periods=1).median()
        prices = prices.clip(upper=rolling_med * 10)

        current_df = pd.DataFrame(
            {
                "item_id": label,
                "timestamp": group["date"],
                "target": prices,
                "league_day": group["league_day"].astype(float),
                "listings": group["listings"].astype(float),
            }
        )
        frames.append(current_df)

        # Concat and resample to daily frequency (fill gaps)
        item_df = (
            pd.concat(frames, ignore_index=True)
            .sort_values("timestamp")
            .reset_index(drop=True)
        )
        item_df = item_df.set_index("timestamp").resample("1D").last().reset_index()
        item_df["item_id"] = label
        all_dfs.append(item_df)

    return all_dfs, cross_league_count


def chronos_forecast(all_dfs, prediction_length=7):
    """Run Chronos-2 (120M) forecast on all items.

    Covariates: league_day + listings only (day_of_week/is_weekend removed — PoE
    economy is league-lifecycle driven, not calendar driven; redundant covariates
    add noise per Chronos-2 docs).
    """
    import torch
    from chronos import BaseChronosPipeline

    print("Loading Chronos-2 model...")
    pipeline = BaseChronosPipeline.from_pretrained(
        "amazon/chronos-2",
        device_map="mps",
        dtype=torch.float32,
    )
    print("Model loaded!\n")

    results = []
    for df in all_dfs:
        name = df["item_id"].iloc[0]
        current = df["target"].dropna().iloc[-1]

        last_date = df["timestamp"].max()
        last_ld = df["league_day"].dropna().iloc[-1]
        future_dates = pd.date_range(
            last_date + timedelta(days=1), periods=prediction_length, freq="D"
        )

        future_df = pd.DataFrame(
            {
                "item_id": name,
                "timestamp": future_dates,
                "league_day": [last_ld + i + 1 for i in range(prediction_length)],
                "listings": [df["listings"].dropna().iloc[-1]] * prediction_length,
            }
        )

        cols = ["item_id", "timestamp", "target", "league_day", "listings"]

        pred = pipeline.predict_df(
            df[cols],
            future_df=future_df,
            prediction_length=prediction_length,
            quantile_levels=[0.1, 0.5, 0.9],
            id_column="item_id",
            timestamp_column="timestamp",
            target="target",
        )

        mid = pred["0.5"].iloc[-1]
        low = pred["0.1"].iloc[-1]
        high = pred["0.9"].iloc[-1]
        change = ((mid - current) / current) * 100

        results.append(
            {
                "item": name,
                "current": current,
                "predicted": mid,
                "low": low,
                "high": high,
                "change_pct": change,
                "method": "chronos-2",
            }
        )

    return results


def main():
    # Parse args
    prediction_length = 7
    filter_items = None
    filter_types = None
    min_price = 5
    top_n = None
    output_json = False

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--days" and i + 1 < len(args):
            prediction_length = int(args[i + 1])
            i += 2
        elif args[i] == "--items" and i + 1 < len(args):
            filter_items = [s.strip() for s in args[i + 1].split(",")]
            i += 2
        elif args[i] == "--type" and i + 1 < len(args):
            filter_types = [s.strip() for s in args[i + 1].split(",")]
            i += 2
        elif args[i] == "--min-price" and i + 1 < len(args):
            min_price = float(args[i + 1])
            i += 2
        elif args[i] == "--top" and i + 1 < len(args):
            top_n = int(args[i + 1])
            i += 2
        elif args[i] == "--json":
            output_json = True
            i += 1
        else:
            i += 1

    # Detect current league
    print("=== PoE Price Forecaster ===")
    league = fetch_current_league()
    if not league:
        try:
            league = detect_league_from_data()
            if league:
                print(f"  (detected from data: {league})")
        except FileNotFoundError:
            pass
    if not league:
        print("Could not detect current league. Check network or data file.")
        return

    league_start = LEAGUE_STARTS.get(league)
    league_day = (datetime.now() - league_start).days if league_start else "?"
    print(f"League: {league} | Day {league_day}")
    print(f"Data: {DATA_FILE}\n")

    # Load collected data
    print("--- Loading price history ---\n")
    try:
        all_dfs, cross_count = load_history(
            league, filter_items, filter_types, min_price
        )
    except FileNotFoundError:
        print(f"No data file found at {DATA_FILE}")
        print(
            "Run collect.py first: python .claude/skills/price-forecast/scripts/collect.py"
        )
        return

    if not all_dfs:
        print(
            "No items with enough history. Try lowering --min-price or running collect.py."
        )
        return

    print(
        f"  {len(all_dfs)} items loaded (min {min_price}c, ≥{MIN_HISTORY_DAYS} days history)"
    )
    if cross_count:
        print(f"  {cross_count} items enriched with previous league data")
    for df in sorted(all_dfs, key=lambda d: -d["target"].iloc[-1])[:10]:
        name = df["item_id"].iloc[0]
        print(f"    {name}: {df['target'].iloc[-1]:,.0f}c ({len(df)} days)")
    if len(all_dfs) > 10:
        print(f"    ... and {len(all_dfs) - 10} more")

    print(f"\n--- Forecast ({prediction_length} days, {len(all_dfs)} items) ---\n")
    results = chronos_forecast(all_dfs, prediction_length)

    # Sort by absolute predicted change (biggest movers first)
    results.sort(key=lambda x: -abs(x["change_pct"]))

    if top_n:
        results = results[:top_n]

    if output_json:
        print(json.dumps(results, indent=2, default=str))
        return

    # Pretty print
    method = results[0]["method"] if results else "unknown"
    print(f"Method: {method} | Showing {len(results)} items\n")
    print(
        f"{'':>6} {'Item':<30} {'Now':>10} {'Predict':>10} {'Change':>8} {'Range':>22}"
    )
    print("-" * 90)
    for r in results:
        change = r["change_pct"]
        icon = "BUY" if change > 5 else "SELL" if change < -5 else "HOLD"
        name = r["item"][:29]
        print(
            f"  {icon:4} {name:<30} {r['current']:>9,.0f}c {r['predicted']:>9,.0f}c {change:>+7.1f}% ({r['low']:,.0f}—{r['high']:,.0f}c)"
        )

    # Summary
    buys = [r for r in results if r["change_pct"] > 5]
    sells = [r for r in results if r["change_pct"] < -5]
    holds = [r for r in results if -5 <= r["change_pct"] <= 5]

    print(
        f"\n--- Summary: {len(buys)} BUY | {len(sells)} SELL | {len(holds)} HOLD ---\n"
    )
    if buys:
        print("TOP BUY (predicted +5%+):")
        for r in buys[:10]:
            print(
                f"  {r['item']}: {r['current']:,.0f}c → {r['predicted']:,.0f}c ({r['change_pct']:+.1f}%)"
            )
        if len(buys) > 10:
            print(f"  ... +{len(buys) - 10} more (use --json for full list)")
    if sells:
        print("TOP SELL (predicted -5%+):")
        for r in sells[:10]:
            print(
                f"  {r['item']}: {r['current']:,.0f}c → {r['predicted']:,.0f}c ({r['change_pct']:+.1f}%)"
            )
        if len(sells) > 10:
            print(f"  ... +{len(sells) - 10} more (use --json for full list)")


if __name__ == "__main__":
    main()
