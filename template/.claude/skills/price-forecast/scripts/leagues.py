#!/usr/bin/env python3
"""
Single source of truth for the POE2 league table used by the price-forecast
pipeline. collect.py and forecast.py both import from here so the slug/start
mapping never drifts between the two scripts.

Each entry:
  name  — canonical league name; collect.py matches this to poe2scout `Leagues[].Value`
          to resolve the poe2scout slug, so it MUST match poe2scout's display name exactly.
  start — league launch date (YYYY-MM-DD), used to compute league_day
  end   — transition date into the next league, or None if still active
  slug  — legacy field (poe.ninja-style); collect.py no longer reads it (resolves
          poe2scout ShortName dynamically). Kept for any other consumer.

Verify names + dates against poe2scout each time a new league launches:
  curl -sL https://api.poe2scout.com/poe2/Leagues | python3 -c "import sys,json;[print(l['Value'],l['ShortName'],l.get('IsCurrent')) for l in json.load(sys.stdin)]"
"""

from datetime import datetime

LEAGUES = [
    # Runes of Aldur (0.5) — main SC POE2 league from 2026-05-29.
    {
        "name": "Runes of Aldur",
        "start": "2026-05-29",
        "end": None,
        "slug": "Runes of Aldur",
    },
    # Vaal (0.4) — archive league. End date = transition into Runes of Aldur.
    {"name": "Vaal", "start": "2026-01-15", "end": "2026-05-29", "slug": "Vaal"},
    # Dawn of the Hunt (0.3) — archive.
    {
        "name": "Dawn of the Hunt",
        "start": "2025-09-15",
        "end": "2026-01-15",
        "slug": "Dawn of the Hunt",
    },
]

# {name: datetime(start)} — convenience map for league_day arithmetic.
LEAGUE_STARTS = {
    lg["name"]: datetime.strptime(lg["start"], "%Y-%m-%d") for lg in LEAGUES
}
