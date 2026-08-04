#!/usr/bin/env python3
"""
poe.ninja POE2 builds crawler — auto-detect current POE2 league và snapshot build
distribution + character list ra JSON, kèm computed trends để biết build nào đang
lên ngôi / chìm xuống.

Output (per league):
  data/poe-ninja/<league>/latest.json            — snapshot mới nhất (overwrite)
  data/poe-ninja/<league>/snapshots/<date>.json  — 1 file/ngày, idempotent
  data/poe-ninja/<league>/trends.json            — top rising/falling 1d & 7d

Yêu cầu runtime:
  - python3 (stdlib only)
  - protoc binary trên PATH (Linux: apt-get install protobuf-compiler)

Detect league: lấy buildLeagues[0].url từ /poe2/api/data/index-state — đó là main
softcore league của mùa hiện tại POE2 (vaal tại pre-0.5, runesofaldur sau 2026-05-29).
"""

from __future__ import annotations

import codecs
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any


def decode_protoc_string(s: str) -> str:
    """Convert protoc `--decode_raw` C-style escape về UTF-8 string thật.

    protoc emit non-printable bytes dạng `\\NNN` (octal, 3 chữ số), apostrophe `'` thành
    `\\'`, quote `"` thành `\\"`. Skill name 'Sniper's Mark' raw = `Sniper\\'s Mark`,
    tên character non-ASCII = `Brain\\343\\206\\215`. Cần decode để JSON output đẹp.
    """
    try:
        # escape_decode trả bytes — handle octal + simple C escapes — sau đó decode UTF-8.
        decoded, _ = codecs.escape_decode(s.encode("utf-8"))  # type: ignore[attr-defined]
        return decoded.decode("utf-8", errors="replace")
    except Exception:
        return s


def decode_protoc_bytes(s: str) -> bytes:
    """Convert protoc octal-escaped string back to raw bytes (for varint streams)."""
    try:
        decoded, _ = codecs.escape_decode(s.encode("utf-8"))  # type: ignore[attr-defined]
        return decoded
    except Exception:
        return b""


def decode_varints(b: bytes) -> list[int]:
    """Decode a stream of protobuf varints. Used for `skills`/`keypassives` per-char lists."""
    out: list[int] = []
    i = 0
    while i < len(b):
        v = 0
        shift = 0
        while i < len(b):
            byte = b[i]
            i += 1
            v |= (byte & 0x7F) << shift
            if not (byte & 0x80):
                break
            shift += 7
            if shift > 63:  # safety: malformed → bail
                return out
        out.append(v)
    return out


# Parse display strings like "686k", "2.9M", "333M", "1.5G" → integer numeric value.
# poe.ninja formats DPS/EHP as humanized strings; raw bytes (field 3 of dps entries)
# encode damage type breakdown, NOT the numeric value.
_DISPLAY_RE = re.compile(r"^\s*([\d.]+)\s*([kMGT]?)\s*$")
_DISPLAY_MULT = {
    "": 1,
    "k": 1_000,
    "M": 1_000_000,
    "G": 1_000_000_000,
    "T": 1_000_000_000_000,
}


def parse_display_value(s: str | None) -> int | None:
    if not s:
        return None
    m = _DISPLAY_RE.match(s)
    if not m:
        return None
    try:
        return int(float(m.group(1)) * _DISPLAY_MULT[m.group(2)])
    except (ValueError, KeyError):
        return None


BASE = "https://poe.ninja"
GAMES = ("poe2",)

# Sanity threshold — POE2 player base nhỏ hơn POE1; main SC POE2 league có ~500-2000
# chars sample ngay cả early league. Set thấp hơn POE1 (1000) để 0.5 launch day-1
# vẫn commit được data thực.
MIN_CHARS = 200

# scripts/ → poe-ninja/ → skills/ → .claude/ → project root (poe2/).
PROJECT_DIR = Path(__file__).resolve().parents[4]
DATA_DIR = PROJECT_DIR / "data" / "poe-ninja"
CACHE_DIR = PROJECT_DIR / "tmp" / "poeninja-cache"


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "poe2-crawler/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    raw = http_get(url).decode("utf-8", errors="replace")
    # poe.ninja đôi lúc embed control chars trong JSON (tên character/league có ký tự lạ)
    return json.loads(raw, strict=False)


def decode_protobuf(blob: bytes) -> str:
    """Decode protobuf bytes → text dạng `--decode_raw` của protoc."""
    if not shutil.which("protoc"):
        raise RuntimeError("protoc not found on PATH. Install protobuf-compiler.")
    res = subprocess.run(
        ["protoc", "--decode_raw"], input=blob, capture_output=True, check=True
    )
    return res.stdout.decode("utf-8", errors="replace")


def detect_league(game: str) -> tuple[str, str, str, str | None, str]:
    """Return (league_url, league_display, snapshot_version, snapshot_type, snapshot_name).

    snapshot_type là `exp` cho POE1, None cho POE2 (POE2 không có field type).
    """
    state = fetch_json(f"{BASE}/{game}/api/data/index-state")

    leagues = state.get("buildLeagues") or []
    if not leagues:
        raise RuntimeError(f"{game}: index-state has no buildLeagues")
    main = leagues[0]
    league_url = main["url"]
    league_name = main.get("displayName", league_url)

    # Tìm snapshot khớp: POE1 ưu tiên type=exp, POE2 không có type.
    candidates = [
        s for s in state.get("snapshotVersions", []) if s.get("url") == league_url
    ]
    if not candidates:
        raise RuntimeError(f"{game}/{league_url}: no snapshotVersions match")

    snap = next((s for s in candidates if s.get("type") == "exp"), candidates[0])
    return (
        league_url,
        league_name,
        snap["version"],
        snap.get("type"),
        snap["snapshotName"],
    )


def fetch_dictionary(game: str, dict_hash: str) -> list[str]:
    """Tải dictionary blob → list of values theo index."""
    cache = CACHE_DIR / f"{game}-dict-{dict_hash}.txt"
    if cache.exists():
        text = cache.read_text(encoding="utf-8")
    else:
        blob = http_get(f"{BASE}/{game}/api/builds/dictionary/{dict_hash}")
        text = decode_protobuf(blob)
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8")
    # Field 2 = value, theo thứ tự xuất hiện = index. Decode C-escape về UTF-8.
    return [
        decode_protoc_string(v) for v in re.findall(r'^2: "(.*)"', text, re.MULTILINE)
    ]


def parse_search(text: str) -> dict[str, Any]:
    """Parse decoded protobuf text → cấu trúc Python."""
    # Total chars (field 1 -> 1)
    m = re.search(r"^\s*1: (\d+)", text, re.MULTILINE)
    total = int(m.group(1)) if m else 0

    # Dimensions (top-level field 2): id, dict_id, list of (key, count)
    dim_pattern = re.compile(
        r"  2 \{\s*\n\s*1: \"([^\"]+)\"\s*\n\s*2: \"([^\"]+)\"\s*\n"
        r"((?:\s*3 \{[^}]*\}\s*\n)*)\s*\}"
    )
    count_pattern = re.compile(r"3 \{\s*\n(?:\s*1: (\d+)\s*\n)?\s*2: (\d+)\s*\n\s*\}")

    dimensions: dict[str, dict[str, Any]] = {}
    for m in dim_pattern.finditer(text):
        dim_id = m.group(1)
        dict_id = m.group(2)
        block = m.group(3)
        counts = []
        for cm in count_pattern.finditer(block):
            key = int(cm.group(1)) if cm.group(1) else 0
            counts.append((key, int(cm.group(2))))
        dimensions[dim_id] = {"dict_id": dict_id, "counts": counts}

    # Dictionary hashes (field 6): map dict_id -> hash
    dict_hashes = {}
    for m in re.finditer(
        r"  6 \{\s*\n\s*1: \"([^\"]+)\"\s*\n\s*2: \"([^\"]+)\"\s*\n\s*\}", text
    ):
        dict_hashes[m.group(1)] = m.group(2)

    # Value lists (field 5): list_name → [entry_dict] (one per character, in order).
    # Each entry is dict với key tuỳ field xuất hiện:
    #   f1 (str) cho "name", "account", "ehp", "dps" display string
    #   f2 (int) cho "level", "life", "energyshield", "class", "dps" main-skill gem index
    #   f3_bytes cho "skills", "keypassives" (varint stream của gem/keystone indices)
    # Empty entry `2: ""` (no value for that char) → empty dict {}.
    # Brace-balanced parser cần thiết vì non-UTF8 character names emit nested struct
    # `1 { 9: 0x... }` thay vì plain string — quantifier-based regex cũ break trên đó.
    value_lists: dict[str, list[dict[str, Any]]] = {}
    header_pat = re.compile(r'^  5 \{\s*\n\s*1: "([^"]+)"', re.MULTILINE)
    headers = [(m.group(1), m.end()) for m in header_pat.finditer(text)]
    for i, (name, start) in enumerate(headers):
        end = headers[i + 1][1] if i + 1 < len(headers) else len(text)
        body = text[start:end]
        entries = _parse_value_list_entries(body)
        # Một số list (ví dụ "ehp") xuất hiện 2 lần trong response — giữ list dài nhất.
        if name not in value_lists or len(entries) > len(value_lists[name]):
            value_lists[name] = entries

    return {
        "total": total,
        "dimensions": dimensions,
        "dict_hashes": dict_hashes,
        "value_lists": value_lists,
    }


def _parse_value_list_entries(body: str) -> list[dict[str, Any]]:
    """Parse value_list body (sau dòng `1: "<name>"`) thành list entries.
    Mỗi entry là dict với optional keys: f1 (str), f2 (int), f3_bytes (bytes).
    """
    entries: list[dict[str, Any]] = []
    lines = body.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # Hết block field-5 khi gặp dòng indent <4 (e.g. `  }` đóng field-5, hoặc field-7 mở).
        if line and not line.startswith("    "):
            break
        if line == '    2: ""':
            entries.append({})
            i += 1
            continue
        if line == "    2 {":
            inner_lines: list[str] = []
            depth = 1
            j = i + 1
            while j < len(lines) and depth > 0:
                ln = lines[j]
                stripped = ln.strip()
                if stripped.endswith("{"):
                    depth += 1
                    inner_lines.append(ln)
                elif stripped == "}":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                    inner_lines.append(ln)
                else:
                    inner_lines.append(ln)
                j += 1
            entries.append(_parse_entry_inner(inner_lines))
            i = j
            continue
        # Dòng lạ ở indent 4 — bỏ qua defensively.
        i += 1
    return entries


_INNER_F1 = re.compile(r'^      1: "((?:[^"\\]|\\.)*)"$')
_INNER_F2 = re.compile(r"^      2: (\d+)$")
_INNER_F3_STR = re.compile(r'^      3: "((?:[^"\\]|\\.)*)"$')
_INNER_NESTED = re.compile(r"^      \d+ \{$")


def _parse_entry_inner(lines: list[str]) -> dict[str, Any]:
    """Extract f1/f2/f3_bytes từ inner content của 1 entry. Skip nested struct (rare)."""
    out: dict[str, Any] = {}
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = _INNER_F1.match(ln)
        if m:
            out["f1"] = decode_protoc_string(m.group(1))
            i += 1
            continue
        m = _INNER_F2.match(ln)
        if m:
            out["f2"] = int(m.group(1))
            i += 1
            continue
        m = _INNER_F3_STR.match(ln)
        if m:
            out["f3_bytes"] = decode_protoc_bytes(m.group(1))
            i += 1
            continue
        if _INNER_NESTED.match(ln):
            # Skip nested block (e.g. non-UTF8 names emit `1 { 9: 0x... }`).
            depth = 1
            i += 1
            while i < len(lines) and depth > 0:
                stripped = lines[i].strip()
                if stripped.endswith("{"):
                    depth += 1
                elif stripped == "}":
                    depth -= 1
                i += 1
            continue
        i += 1
    return out


def resolve_distributions(
    game: str,
    parsed: dict[str, Any],
    dict_cache: dict[str, list[str]],
    top_n: int = 50,
) -> dict[str, list[dict[str, Any]]]:
    """Map mỗi dimension → top-N entries với name + count + pct.
    `dict_cache` được caller chia sẻ để tránh fetch trùng dictionary qua các snapshot.
    """
    total = parsed["total"]
    out: dict[str, list[dict[str, Any]]] = {}

    for dim_id, dim in parsed["dimensions"].items():
        dict_id = dim["dict_id"]
        if dict_id not in dict_cache:
            h = parsed["dict_hashes"].get(dict_id)
            dict_cache[dict_id] = fetch_dictionary(game, h) if h else []
        names = dict_cache[dict_id]

        # Lọc bỏ entries có count=0 (defensive — protobuf không nên emit nhưng phòng trường hợp)
        sorted_counts = sorted(
            (c for c in dim["counts"] if c[1] > 0), key=lambda x: x[1], reverse=True
        )
        rows = []
        for key, count in sorted_counts[:top_n]:
            name = names[key] if 0 <= key < len(names) else f"#{key}"
            pct = round(count / total * 100, 2) if total > 0 else 0.0
            rows.append({"name": name, "count": count, "pct": pct})
        out[dim_id] = rows
    return out


# Top-list config — sample chỉ ~100 chars top XP nên cap top-N bảo thủ.
TOP_OVERALL_N = 25  # top chars overall theo DPS / EHP
TOP_PER_SKILL_N = 5  # top chars cho mỗi skill
MIN_CHARS_PER_SKILL = 2  # skill cần ≥N chars trong sample mới xuất hiện trong by_skill


def _resolve_dict(
    game: str, parsed: dict[str, Any], dict_cache: dict[str, list[str]], dict_id: str
) -> list[str]:
    if dict_id not in dict_cache:
        h = parsed["dict_hashes"].get(dict_id)
        dict_cache[dict_id] = fetch_dictionary(game, h) if h else []
    return dict_cache[dict_id]


def build_character_records(
    game: str, parsed: dict[str, Any], dict_cache: dict[str, list[str]]
) -> list[dict[str, Any]]:
    """Build per-character records từ value_lists, resolve gem/class names.
    Sample ~100 chars/fetch (top experience trong league).
    """
    vls = parsed["value_lists"]
    name_l = vls.get("name", [])
    account_l = vls.get("account", [])
    class_l = vls.get("class", [])
    level_l = vls.get("level", [])
    life_l = vls.get("life", [])
    es_l = vls.get("energyshield", [])
    ehp_l = vls.get("ehp", [])
    skills_l = vls.get("skills", [])
    dps_l = vls.get("dps", [])

    gem_names = _resolve_dict(game, parsed, dict_cache, "gem")
    class_names = _resolve_dict(game, parsed, dict_cache, "class")

    def _f1(lst: list[dict[str, Any]], i: int) -> str | None:
        return lst[i].get("f1") if i < len(lst) else None

    def _f2(lst: list[dict[str, Any]], i: int) -> int | None:
        return lst[i].get("f2") if i < len(lst) else None

    def _varints(lst: list[dict[str, Any]], i: int) -> list[int]:
        if i < len(lst) and "f3_bytes" in lst[i]:
            return decode_varints(lst[i]["f3_bytes"])
        return []

    def _gem(idx: int | None) -> str | None:
        if idx is None or idx < 0 or idx >= len(gem_names):
            return None
        return gem_names[idx]

    def _class(idx: int | None) -> str | None:
        if idx is None or idx < 0 or idx >= len(class_names):
            return None
        return class_names[idx]

    chars: list[dict[str, Any]] = []
    for i in range(len(name_l)):
        n = _f1(name_l, i)
        if not n:
            continue
        ehp_disp = _f1(ehp_l, i)
        dps_disp = _f1(dps_l, i)
        main_skill_idx = _f2(dps_l, i)
        skill_indices = _varints(skills_l, i)
        chars.append(
            {
                "name": n,
                "account": _f1(account_l, i),
                "class": _class(_f2(class_l, i)),
                "level": _f2(level_l, i),
                "life": _f2(life_l, i),
                "es": _f2(es_l, i),
                "ehp_display": ehp_disp,
                "ehp": parse_display_value(ehp_disp),
                "dps_display": dps_disp,
                "dps": parse_display_value(dps_disp),
                "main_skill": _gem(main_skill_idx),
                "skills": [g for g in (_gem(s) for s in skill_indices) if g],
            }
        )
    return chars


def _strip_char_for_output(c: dict[str, Any]) -> dict[str, Any]:
    """Loại bỏ field internal (skills array, redundant) khỏi top-list output."""
    return {
        "name": c["name"],
        "account": c["account"],
        "class": c["class"],
        "level": c["level"],
        "life": c["life"],
        "es": c["es"],
        "ehp": c["ehp"],
        "ehp_display": c["ehp_display"],
        "dps": c["dps"],
        "dps_display": c["dps_display"],
        "main_skill": c["main_skill"],
    }


def build_top_lists(chars: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute top DPS/EHP overall + per main skill từ per-char records.

    Caveat: sample chỉ là top ~100 chars theo experience của league (poe.ninja /search
    không support filter/sort/pagination qua query param — đã verify). Vậy "top DPS
    cho skill X" thực tế là "DPS cao nhất TRONG TOP 100 XP có dùng skill X làm
    main skill". Skill rare có thể vắng mặt hoàn toàn; skill phổ biến có sample
    đủ tốt cho ranking tương đối.
    """
    with_dps = [c for c in chars if c["dps"] is not None]
    with_ehp = [c for c in chars if c["ehp"] is not None]

    top_dps = sorted(with_dps, key=lambda c: c["dps"], reverse=True)[:TOP_OVERALL_N]
    top_ehp = sorted(with_ehp, key=lambda c: c["ehp"], reverse=True)[:TOP_OVERALL_N]

    by_skill: dict[str, dict[str, Any]] = {}
    skill_groups: dict[str, list[dict[str, Any]]] = {}
    for c in with_dps:
        sk = c["main_skill"]
        if sk:
            skill_groups.setdefault(sk, []).append(c)

    for skill, group in skill_groups.items():
        if len(group) < MIN_CHARS_PER_SKILL:
            continue
        # Chars cho top_ehp của 1 skill phải dùng skill đó (cùng group).
        top_d = sorted(group, key=lambda c: c["dps"] or 0, reverse=True)[
            :TOP_PER_SKILL_N
        ]
        with_ehp_in_group = [c for c in group if c["ehp"] is not None]
        top_e = sorted(with_ehp_in_group, key=lambda c: c["ehp"], reverse=True)[
            :TOP_PER_SKILL_N
        ]
        by_skill[skill] = {
            "char_count": len(group),
            "top_dps": [_strip_char_for_output(c) for c in top_d],
            "top_ehp": [_strip_char_for_output(c) for c in top_e],
        }

    return {
        "sample_size": len(chars),
        "with_dps_count": len(with_dps),
        "with_ehp_count": len(with_ehp),
        "top_overall_dps": [_strip_char_for_output(c) for c in top_dps],
        "top_overall_ehp": [_strip_char_for_output(c) for c in top_ehp],
        "by_skill": dict(sorted(by_skill.items(), key=lambda kv: -kv[1]["char_count"])),
    }


def fetch_search(
    game: str,
    version: str,
    snap_name: str,
    snap_type: str | None,
    dict_cache: dict[str, list[str]],
    tm_label: str | None = None,
    with_per_char: bool = False,
) -> dict[str, Any]:
    """Fetch + parse 1 search snapshot. tm_label='day-1'/'week-1' → query time machine.
    `dict_cache` shared across calls để tránh re-fetch dictionary giữa current/baselines.
    `with_per_char=True` → resolve per-char records (dùng cho current snapshot, không
    cho baselines vì top_lists cần data hiện tại).
    """
    params = [f"overview={snap_name}"]
    if snap_type:
        params.append(f"type={snap_type}")
    if tm_label:
        params.append(f"timeMachine={tm_label}")
    url = f"{BASE}/{game}/api/builds/{version}/search?{'&'.join(params)}"
    text = decode_protobuf(http_get(url))
    parsed = parse_search(text)
    distributions = resolve_distributions(game, parsed, dict_cache, top_n=50)
    out: dict[str, Any] = {
        "total_characters": parsed["total"],
        "distributions": distributions,
        "_value_lists": parsed["value_lists"],  # internal, drop trước khi serialize
    }
    if with_per_char:
        out["_chars"] = build_character_records(game, parsed, dict_cache)
    return out


def collect_game(game: str) -> dict[str, Any]:
    league_url, league_name, version, snap_type, snap_name = detect_league(game)
    print(
        f"[{game}] league={league_url} ({league_name}) version={version} type={snap_type}",
        flush=True,
    )

    dict_cache: dict[str, list[str]] = {}
    current = fetch_search(
        game, version, snap_name, snap_type, dict_cache, with_per_char=True
    )

    if current["total_characters"] < MIN_CHARS:
        raise RuntimeError(
            f"{game}/{league_url}: total={current['total_characters']} < MIN_CHARS={MIN_CHARS} — refuse to write"
        )

    # Fetch baselines từ poe.ninja time machine — cho phép tính trend ngay từ run đầu
    # mà không cần đợi history local tích lũy. Top-lists chỉ tính cho current,
    # baselines chỉ dùng cho distribution trend.
    baselines: dict[str, dict[str, Any]] = {}
    for label in ("day-1", "week-1"):
        try:
            b = fetch_search(
                game, version, snap_name, snap_type, dict_cache, tm_label=label
            )
            print(
                f"[{game}] baseline {label}: total={b['total_characters']:,}",
                flush=True,
            )
            baselines[label] = b
        except Exception as e:  # noqa: BLE001
            print(f"[{game}] baseline {label} failed: {e}", file=sys.stderr, flush=True)

    # Top characters: lấy 100 chars đầu (raw — không quan tâm DPS/EHP, chỉ ID).
    chars = current.get("_chars", [])
    top_chars = [{"name": c["name"], "account": c["account"]} for c in chars[:100]]

    # Top lists: top DPS/EHP overall + per main skill.
    top_lists = build_top_lists(chars)
    print(
        f"[{game}] top-lists: sample={top_lists['sample_size']} "
        f"with_dps={top_lists['with_dps_count']} with_ehp={top_lists['with_ehp_count']} "
        f"skills_grouped={len(top_lists['by_skill'])}",
        flush=True,
    )

    return {
        "game": game,
        "league_url": league_url,
        "league_name": league_name,
        "snapshot_version": version,
        "snapshot_name": snap_name,
        "snapshot_type": snap_type,
        "fetched_at": dt.datetime.now(dt.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "total_characters": current["total_characters"],
        "distributions": current["distributions"],
        "top_characters": top_chars,
        "top_lists": top_lists,
        "_baselines": baselines,  # internal, drop trước khi serialize snapshot
    }


def _snapshot_date(snap: dict[str, Any]) -> str:
    """ISO date của snapshot — dùng làm filename."""
    return snap["fetched_at"][:10]


def _pct_map(rows: list[dict[str, Any]]) -> dict[str, float]:
    """Map name → pct cho dễ diff."""
    return {r["name"]: r["pct"] for r in rows}


def _count_map(rows: list[dict[str, Any]]) -> dict[str, int]:
    return {r["name"]: r["count"] for r in rows}


def _delta_for_dim(
    current_rows: list[dict[str, Any]],
    prev_rows: list[dict[str, Any]],
    top_n: int = 15,
    min_current_count: int = 50,
) -> dict[str, list[dict[str, Any]]]:
    """So sánh distribution → list rising/falling theo delta percentage point.

    `min_current_count` lọc bỏ entry quá nhỏ (1-2 char) khỏi rising — tránh noise
    "build từ 0 → 0.01% xuất hiện top rising". Build "lên ngôi" thật phải đã có
    base count đáng kể.
    """
    cur_pct = _pct_map(current_rows)
    prev_pct = _pct_map(prev_rows)
    cur_cnt = _count_map(current_rows)
    prev_cnt = _count_map(prev_rows)

    # Union các name xuất hiện ở cả 2 bên (entries chỉ xuất hiện 1 bên → delta = pct - 0)
    all_names = set(cur_pct) | set(prev_pct)
    rows = []
    for name in all_names:
        c_pct = cur_pct.get(name, 0.0)
        p_pct = prev_pct.get(name, 0.0)
        c_cnt = cur_cnt.get(name, 0)
        p_cnt = prev_cnt.get(name, 0)
        rows.append(
            {
                "name": name,
                "current_pct": c_pct,
                "prev_pct": p_pct,
                "delta_pct_pts": round(c_pct - p_pct, 2),
                "current_count": c_cnt,
                "prev_count": p_cnt,
                "delta_count": c_cnt - p_cnt,
            }
        )

    rising = sorted(
        (
            r
            for r in rows
            if r["delta_pct_pts"] > 0 and r["current_count"] >= min_current_count
        ),
        key=lambda r: r["delta_pct_pts"],
        reverse=True,
    )[:top_n]
    falling = sorted(
        (
            r
            for r in rows
            if r["delta_pct_pts"] < 0 and r["prev_count"] >= min_current_count
        ),
        key=lambda r: r["delta_pct_pts"],
    )[:top_n]
    return {"rising": rising, "falling": falling}


def compute_trends(
    current: dict[str, Any], baselines: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    """Tính trend so với baselines lấy từ poe.ninja time machine.

    Lưu ý semantic của poe.ninja: label `day-1` = snapshot tại NGÀY 1 CỦA LEAGUE
    (ngày khai mạc), `week-1` = TUẦN 1 CỦA LEAGUE — KHÔNG phải "1 ngày/1 tuần
    trước". Trend output do đó thể hiện *meta evolution since league launch*,
    không phải rolling daily window. Đó vẫn là góc nhìn cực hữu ích để biết build
    nào "lên ngôi" sau khi meta đã ổn định, vs chỉ hot trong tuần đầu rồi tắt.
    Rolling daily delta sẽ xuất hiện sau khi cron tích lũy snapshots/<date>.json.
    """
    cur_date = _snapshot_date(current)
    cur_dims = current["distributions"]

    label_to_bucket = {
        "day-1": "since_league_day_1",
        "week-1": "since_league_week_1",
    }
    out: dict[str, Any] = {
        "current_date": cur_date,
        "compared_to": {
            bucket: f"poe.ninja time machine label={label}"
            for label, bucket in label_to_bucket.items()
            if label in baselines
        },
        "total_characters": {"current": current["total_characters"]},
        "trends": {},
    }
    for label, bucket in label_to_bucket.items():
        if label in baselines:
            out["total_characters"][bucket] = baselines[label]["total_characters"]

    if not baselines:
        out["note"] = "all baseline fetches failed — no trends computed"
        return out

    for dim_id, cur_rows in cur_dims.items():
        bucket: dict[str, Any] = {}
        for label, key in label_to_bucket.items():
            if label in baselines:
                base_dims = baselines[label].get("distributions", {})
                bucket[key] = _delta_for_dim(cur_rows, base_dims.get(dim_id, []))
        out["trends"][dim_id] = bucket
    return out


def write_outputs(snapshot: dict[str, Any]) -> dict[str, Path]:
    # Workspace is game-specific (poe2/) — canonical layout has no game subpath.
    out_dir = DATA_DIR / snapshot["league_url"]
    snap_dir = out_dir / "snapshots"
    snap_dir.mkdir(parents=True, exist_ok=True)

    baselines = snapshot.pop("_baselines", {})

    # 1. Snapshot dated — idempotent rerun cùng ngày sẽ overwrite cùng file.
    dated = snap_dir / f"{_snapshot_date(snapshot)}.json"
    dated.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # 2. latest.json = mirror của snapshot mới nhất, để link tới chỗ cố định.
    latest = out_dir / "latest.json"
    latest.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # 3. trends.json — top rising/falling so với baseline từ time machine.
    trends = compute_trends(snapshot, baselines)
    trends_path = out_dir / "trends.json"
    trends_path.write_text(
        json.dumps(trends, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    return {"latest": latest, "snapshot": dated, "trends": trends_path}


def main() -> int:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for game in GAMES:
        try:
            snap = collect_game(game)
            paths = write_outputs(snap)
            print(
                f"[{game}] total={snap['total_characters']:,} "
                f"dimensions={len(snap['distributions'])} "
                f"top_chars={len(snap['top_characters'])} → "
                f"{paths['snapshot'].relative_to(PROJECT_DIR)}",
                flush=True,
            )
        except Exception as e:  # noqa: BLE001
            failures.append((game, e))
            print(f"[{game}] FAILED: {e}", file=sys.stderr, flush=True)

    if failures:
        # Partial success vẫn commit data của game thành công, nhưng exit non-zero để CI flag.
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
