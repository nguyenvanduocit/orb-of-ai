#!/usr/bin/env bash
# /poeforum — read a GGG Path of Exile 2 forum page (listing or thread) as JSON.
#
# Thin entrypoint: resolve the Python that has bs4 (Framework python first, same
# as update-release-note/fetch.sh), then hand off to forum.py which does the
# anonymous browser-UA curl + parse. Read-only public forum pages only — no auth,
# no GGG API, no playwriter (see forum.py header for the rule rationale).
#
# Usage:
#   ./forum.sh list 2216                 # POE2 Builds forum -> threads[]
#   ./forum.sh thread 3931901            # one thread page 1 -> posts[]
#   ./forum.sh thread 3931901 2          # page 2
#   ./forum.sh thread 3931901 --all      # every page concatenated
#
# Output: JSON on stdout. Pipe to `jq` to slice.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PY="/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"
[[ -x "$PY" ]] || PY="$(command -v python3 || true)"
[[ -n "$PY" && -x "$PY" ]] || { echo "ERROR: python3 not found." >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found." >&2; exit 2; }

exec "$PY" "${SCRIPT_DIR}/forum.py" "$@"
