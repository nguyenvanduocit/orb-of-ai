#!/usr/bin/env python3
"""
Gear-optimizer for POE2 /gear-upgrade — offline-confidence-first.

The user's principle: POE gear is a balance problem. You do not greedily push one
stat slot-by-slot; you distribute stats so EVERY hard constraint holds at once and
the whole set harmonises. And you do NOT spend scarce trade calls to *test* whether
a combo works — you reach confidence entirely offline with PoB, then trade only to
PRICE the combo you already trust.

So the pipeline is two clean halves with trade pushed to the very end:

  search  (OFFLINE, no GGG):
    - Assemble synthetic items from the canonical mod-query file
      (data/gear-mods/<patch>-gear-mods.json), which is extracted from PoB's own
      mod tables. Every synthetic item is CONSTRUCTIBLE by construction — only real
      affixes, on bases that can roll them, distinct affix groups, valid prefix/
      suffix counts, real tier ranges. A "mod salad" PoB would happily calc but that
      cannot exist is rejected here, so the confidence is real, not fake.
    - Enumerate tier variants per slot, cross-product across a plan's slots, simulate
      every combo in PoB (cheap + parallel), keep combos passing ALL hard constraints,
      rank by soft objective then by roll-difficulty (cheapest tier that still passes).
    - Output the winning per-slot TARGET (base + achieved axis thresholds). Zero trade.

  price  (the ONLY phase that touches GGG, sequential, rate-limit-safe):
    - For the chosen combo's per-slot targets, search securable listings ONCE each
      and report real prices + trade URLs, then re-sim the single cheapest real combo
      to confirm the affordable roll still passes. If it does not, that is the ONLY
      signal to loop back to `search` with a different target — never hammer trade.

PoB validates the DEFENSIVE + hard-constraint envelope (res/life/eva/ES/Int/Spirit).
It cannot model companion/minion DPS for this build (combinedDPS=0); damage-scaling
mods (minion/companion level) are trade-side soft preferences, hand-reasoned, never
claimed as PoB-verified.

Subcommands:
  baseline <spec>                 print baseline stats + the hard-constraint audit
  search   <spec> [--out FILE]    OFFLINE combo search; write chosen combo target
  price    <chosen.json>          trade price-check the chosen combo (touches GGG)
  sim      <spec> --slot S --pob F  one ad-hoc swap (debug)

Baseline is PINNED to a decoded equipped-state XML — never re-import live mid-loop.
"""

import argparse
import base64
import json
import math
import os
import re
import subprocess
import sys
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import product
from pathlib import Path

HERE = Path(__file__).resolve().parent
# .claude/skills/gear-upgrade/scripts -> climb to workspace root (poe2/)
ROOT = HERE.parents[3]
POB_CLI = ROOT / "data" / "pob-source" / "pob-cli.sh"
TRADE_FETCH = HERE / "trade-fetch.ts"
TMP = ROOT / "tmp"

# POE2 rares: 3 prefixes + 3 suffixes.
MAX_PREFIX, MAX_SUFFIX = 3, 3
# Assume budget allows near-top item levels when enumerating tiers.
DEFAULT_BASE_ILVL = 82


# ── PoB code <-> XML ─────────────────────────────────────────────────────────
def encode_pob(xml: str) -> str:
    return base64.urlsafe_b64encode(zlib.compress(xml.encode("utf-8"), 9)).decode(
        "ascii"
    )


def strip_wiki(text: str) -> str:
    text = re.sub(r"\[([^\[\]|]+)\|([^\[\]]+)\]", r"\2", text)
    text = re.sub(r"\[([^\[\]]+)\]", r"\1", text)
    return text


def slot_item_ids(xml: str) -> dict:
    """name -> itemId from the active item-set Slot map. Attribute-order-agnostic
    (OAuth export and pobb.in emit <Slot> attrs in different orders), scoped to the
    active item set when more than one exists."""
    block = xml
    active = re.search(r'activeItemSet="(\d+)"', xml)
    sets = re.findall(r'<ItemSet\b[^>]*\bid="(\d+)"', xml)
    if active and len(sets) > 1:
        m = re.search(
            r'<ItemSet\b[^>]*\bid="%s".*?(?=<ItemSet\b|</Items>|\Z)'
            % re.escape(active.group(1)),
            xml,
            re.S,
        )
        if m:
            block = m.group(0)
    out = {}
    for m in re.finditer(r"<Slot\b([^>]*?)/?>", block):
        attrs = m.group(1)
        iid = re.search(r'itemId="(\d+)"', attrs)
        nm = re.search(r'name="([^"]+)"', attrs)
        if iid and nm and iid.group(1) != "0":
            out[nm.group(1)] = iid.group(1)
    return out


def replace_item(xml: str, item_id: str, pob_text: str) -> str:
    """Replace the inner body of <Item id="N">...</Item> with a fresh PoB-text block.
    ModRange lines are omitted so PoB parses the literal numbers we write."""
    body = strip_wiki(pob_text.strip())
    body = "\n".join(l for l in body.splitlines() if "<ModRange" not in l)
    block = f'<Item id="{item_id}">\n{body}\n</Item>'
    pat = re.compile(r'<Item id="%s">.*?</Item>' % re.escape(item_id), re.S)
    new_xml, n = pat.subn(lambda _m: block, xml, count=1)
    if n != 1:
        raise RuntimeError(f"could not locate <Item id={item_id}> to replace")
    return new_xml


# ── simulation ───────────────────────────────────────────────────────────────
def load_baseline(spec) -> str:
    p = Path(spec["baseline"])
    if not p.is_absolute():
        p = ROOT / p
    return p.read_text()


def simulate(baseline_xml: str, swaps: dict, slotmap: dict, tag: str) -> dict:
    """swaps: {SlotName: pob_text}. Returns parsed PoB stats dict (+ _tag)."""
    xml = baseline_xml
    for slot, pob_text in swaps.items():
        if slot not in slotmap:
            raise RuntimeError(
                f"slot {slot!r} not in baseline slot map {list(slotmap)}"
            )
        xml = replace_item(xml, slotmap[slot], pob_text)
    code = encode_pob(xml)
    TMP.mkdir(exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", tag)[:80]
    code_file = TMP / f"gopt-{safe}.code.txt"
    code_file.write_text(code)
    res = subprocess.run(
        [str(POB_CLI), "calc", f"@{code_file}"], capture_output=True, text=True
    )
    try:
        data = json.loads(res.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(
            f"pob-cli calc failed for {tag}: {res.stdout[:300]} {res.stderr[:300]}"
        )
    if data.get("status") != "ok":
        raise RuntimeError(f"pob-cli error for {tag}: {data.get('error')}")
    s = data["stats"]
    s["_tag"] = tag
    return s


def sim_many(baseline_xml, jobs, slotmap, workers=6):
    """jobs: list of (tag, swaps). Returns {tag: stats} (parallel; PoB calc is local)."""
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {
            ex.submit(simulate, baseline_xml, swaps, slotmap, tag): tag
            for tag, swaps in jobs
        }
        for fut in as_completed(futs):
            tag = futs[fut]
            try:
                out[tag] = fut.result()
            except Exception as e:
                out[tag] = {"_tag": tag, "_error": str(e)}
    return out


# ── constraints ──────────────────────────────────────────────────────────────
def hard_violations(stats: dict, hard: dict) -> list:
    bad = []
    f = lambda k: stats.get(k) or 0
    if stats.get("_error"):
        return [f"simerr:{stats['_error'][:40]}"]
    if "fireRes" in hard and f("fireRes") < hard["fireRes"]:
        bad.append(f"fire {f('fireRes'):.0f}<{hard['fireRes']}")
    if "coldRes" in hard and f("coldRes") < hard["coldRes"]:
        bad.append(f"cold {f('coldRes'):.0f}<{hard['coldRes']}")
    if "lightningRes" in hard and f("lightningRes") < hard["lightningRes"]:
        bad.append(f"light {f('lightningRes'):.0f}<{hard['lightningRes']}")
    if "chaosRes" in hard and f("chaosRes") < hard["chaosRes"]:
        bad.append(f"chaos {f('chaosRes'):.0f}<{hard['chaosRes']}")
    if "intMargin" in hard and (f("int") - f("reqInt")) < hard["intMargin"]:
        bad.append(f"int {f('int'):.0f}-{f('reqInt'):.0f}<{hard['intMargin']}")
    if "strMargin" in hard and (f("str") - f("reqStr")) < hard["strMargin"]:
        bad.append(f"str {f('str'):.0f}-{f('reqStr'):.0f}<{hard['strMargin']}")
    if "dexMargin" in hard and (f("dex") - f("reqDex")) < hard["dexMargin"]:
        bad.append(f"dex {f('dex'):.0f}-{f('reqDex'):.0f}<{hard['dexMargin']}")
    if "spiritFree" in hard and f("spiritUnreserved") < hard["spiritFree"]:
        bad.append(f"spiritFree {f('spiritUnreserved'):.0f}<{hard['spiritFree']}")
    if "life" in hard and f("life") < hard["life"]:
        bad.append(f"life {f('life'):.0f}<{hard['life']}")
    if "energyShield" in hard and f("energyShield") < hard["energyShield"]:
        bad.append(f"es {f('energyShield'):.0f}<{hard['energyShield']}")
    return bad


SOFT_SCALE = {
    "lightningRes": lambda v: min(v, 75) / 75,
    "fireRes": lambda v: min(v, 75) / 75,
    "coldRes": lambda v: min(v, 75) / 75,
    "chaosRes": lambda v: min(v, 75) / 75,
    "evasion": lambda v: v / 4000,
    "armour": lambda v: v / 4000,
    "spiritUnreserved": lambda v: v / 60,
    "life": lambda v: v / 2000,
    "energyShield": lambda v: v / 1000,
}


def soft_score(stats: dict, soft: list) -> float:
    f = lambda k: stats.get(k) or 0
    return sum(SOFT_SCALE.get(k, lambda v: 0)(f(k)) for k in soft)


def audit_line(stats, hard):
    if stats.get("_error"):
        return f"SIM ERROR: {stats['_error'][:120]}"
    bad = hard_violations(stats, hard)
    flag = "PASS" if not bad else "FAIL(" + ", ".join(bad) + ")"
    return (
        f"fire {stats.get('fireRes', 0):.0f} cold {stats.get('coldRes', 0):.0f} "
        f"light {stats.get('lightningRes', 0):.0f} chaos {stats.get('chaosRes', 0):.0f} | "
        f"int {stats.get('int', 0):.0f}/{stats.get('reqInt', 0):.0f} "
        f"spiritFree {stats.get('spiritUnreserved', 0):.0f} | life {stats.get('life', 0):.0f} "
        f"eva {stats.get('evasion', 0):.0f} es {stats.get('energyShield', 0):.0f}  -> {flag}"
    )


# ── canonical mod-query file ─────────────────────────────────────────────────
def load_modfile(spec) -> dict:
    p = (
        spec.get("modfile")
        or f"data/gear-mods/{spec.get('patch', '0.5.0')}-gear-mods.json"
    )
    pp = Path(p)
    if not pp.is_absolute():
        pp = ROOT / pp
    return json.loads(pp.read_text())


def base_entry(modfile, base_name):
    b = modfile["bases"].get(base_name)
    if not b:
        raise RuntimeError(
            f"base {base_name!r} not in modfile (slot bases: try one of {list(modfile['bases'])[:3]}...)"
        )
    return b


def mods_for(modfile, base_name, axis, base_ilvl):
    """Tiers of `axis` rollable on `base_name` at <= base_ilvl, best (highest vmax)
    first. Constructibility: the base must carry a tag the mod rolls on (weight>0)."""
    b = base_entry(modfile, base_name)
    btags = set(b["tags"])
    out = []
    for m in modfile["mods"]:
        if m["axis"] != axis:
            continue
        if (m.get("level") or 1) > base_ilvl:
            continue
        if not (set(m.get("rollsOn", [])) & btags):
            continue
        out.append(m)
    out.sort(key=lambda m: (-(m.get("vmax") or 0), m.get("level") or 0))
    return out


def roll_line(line: str, value):
    """Replace each (min-max) range in a stat line with `value` (or, for ranges
    other than the first, their max). value None -> use each range's max."""
    if value is None:
        return re.sub(r"\((-?\d+\.?\d*)-(-?\d+\.?\d*)\)", lambda m: m.group(2), line)
    used = {"done": False}

    def sub(m):
        if not used["done"]:
            used["done"] = True
            iv = int(round(value)) if float(value) == int(value) else value
            return str(iv)
        return m.group(2)

    return re.sub(r"\((-?\d+\.?\d*)-(-?\d+\.?\d*)\)", sub, line)


def build_item(modfile, base_name, picks):
    """picks: list of (mod, value). Returns PoB-text block (implicit rolled to max)."""
    b = base_entry(modfile, base_name)
    lines = ["Rarity: RARE", f"Synthetic {base_name}", base_name]
    impl = b.get("implicit")
    impl_lines = []
    if impl and impl not in ("-1", None):
        for ln in str(impl).split("\n"):
            ln = ln.strip()
            if (
                ln
                and not ln.startswith("{")
                and "Modifier allowed" not in ln
                and "Grants Skill" not in ln
            ):
                impl_lines.append(roll_line(ln, None))
    lines.append(f"Implicits: {len(impl_lines)}")
    lines += impl_lines
    for mod, value in picks:
        for li, ln in enumerate(mod["lines"]):
            lines.append(roll_line(ln, value if li == 0 else None))
    return "\n".join(lines)


def validate_constructible(
    modfile, base_name, picks, max_prefix=MAX_PREFIX, max_suffix=MAX_SUFFIX
):
    """Return list of violations ([] == a real, buyable item)."""
    b = base_entry(modfile, base_name)
    btags = set(b["tags"])
    bad, groups, npre, nsuf = [], set(), 0, 0
    for mod, _ in picks:
        if not (set(mod.get("rollsOn", [])) & btags):
            bad.append(f"{mod['axis']} can't roll on {base_name}")
        g = mod.get("group")
        if g in groups:
            bad.append(f"group {g} twice")
        groups.add(g)
        if mod.get("type") == "Prefix":
            npre += 1
        else:
            nsuf += 1
    if npre > max_prefix:
        bad.append(f"{npre} prefixes > {max_prefix}")
    if nsuf > max_suffix:
        bad.append(f"{nsuf} suffixes > {max_suffix}")
    return bad


def enumerate_slot_variants(modfile, slot_cfg, tiers, base_ilvl, max_variants):
    """Enumerate constructible synthetic items for one slot.

    slot_cfg modes:
      - explicit item:  {"item": ["Rarity: RARE", ...]}  -> single fixed variant
      - axis-driven:    {"base": "Sapphire Ring", "axes": {"fire_res":{"min":30}, ...}}
    Returns [{pob, desc, difficulty, achieved:{axis:value}, base}], lowest-difficulty
    first. difficulty = summed tier-rank (0 = top tier); proxy for cost.
    """
    if "item" in slot_cfg:
        return [
            {
                "pob": "\n".join(slot_cfg["item"]),
                "desc": "explicit",
                "difficulty": 0,
                "achieved": {},
                "base": None,
            }
        ]

    base = slot_cfg["base"]
    axes = slot_cfg["axes"]
    mp = slot_cfg.get("maxPrefix", MAX_PREFIX)
    ms = slot_cfg.get("maxSuffix", MAX_SUFFIX)

    # per axis: the candidate tiers (mods), capped to `tiers`, that can meet min
    per_axis = []
    for axis, req in axes.items():
        cands = mods_for(modfile, base, axis, base_ilvl)
        mn = (req or {}).get("min")
        if mn is not None:
            usable = [m for m in cands if (m.get("vmax") or 0) >= mn] or cands[:1]
        else:
            usable = cands
        usable = usable[:tiers]
        if not usable:
            return []  # an axis cannot roll on this base at all -> plan infeasible here
        per_axis.append((axis, usable))

    variants = []
    axis_names = [a for a, _ in per_axis]
    for combo in product(*[opts for _, opts in per_axis]):
        picks = [(mod, mod.get("vmax")) for mod in combo]
        bad = validate_constructible(modfile, base, picks, mp, ms)
        if bad:
            continue  # over-constrained (e.g. 4 suffixes) -> not a real item
        # difficulty = how high the tiers are (rank within axis candidate list)
        difficulty = 0
        achieved = {}
        for (axis, opts), mod in zip(per_axis, combo):
            difficulty += opts.index(mod)
            achieved[axis] = mod.get("vmax")
        variants.append(
            {
                "pob": build_item(modfile, base, picks),
                "desc": ", ".join(
                    f"{ax} {mod.get('affix')}({mod.get('vmax')})"
                    for ax, mod in zip(axis_names, combo)
                ),
                "difficulty": difficulty,
                "achieved": achieved,
                "base": base,
                "picks": [
                    {
                        "axis": ax,
                        "id": mod["id"],
                        "tradeIds": mod.get("tradeIds", []),
                        "value": mod.get("vmax"),
                        "vmin": mod.get("vmin"),
                    }
                    for ax, mod in zip(axis_names, combo)
                ],
            }
        )
    variants.sort(key=lambda v: v["difficulty"])
    return variants[:max_variants]


# ── trade (price-check ONLY) ─────────────────────────────────────────────────
# pseudo ids preferred for the cap-relevant axes (aggregate single + all-ele etc.)
AXIS_PSEUDO = {
    "fire_res": "pseudo.pseudo_total_fire_resistance",
    "cold_res": "pseudo.pseudo_total_cold_resistance",
    "lightning_res": "pseudo.pseudo_total_lightning_resistance",
    "chaos_res": "pseudo.pseudo_total_chaos_resistance",
    "life": "pseudo.pseudo_total_life",
    "strength": "pseudo.pseudo_total_strength",
    "dexterity": "pseudo.pseudo_total_dexterity",
    "intelligence": "pseudo.pseudo_total_intelligence",
    "all_attributes": "pseudo.pseudo_total_all_attributes",
}
# axis -> keyword(s) in a base implicit line. all_res / all_attributes feed each
# member axis (pseudo totals count them), so a Ruby implicit (+fire) or Prismatic
# implicit (+all-ele) lifts the fire pseudo threshold the price target must clear.
IMPLICIT_KW = {
    "fire_res": ["Fire Resistance", "all Elemental Resistances"],
    "cold_res": ["Cold Resistance", "all Elemental Resistances"],
    "lightning_res": ["Lightning Resistance", "all Elemental Resistances"],
    "chaos_res": ["Chaos Resistance"],
    "intelligence": ["Intelligence", "all Attributes"],
    "strength": ["Strength", "all Attributes"],
    "dexterity": ["Dexterity", "all Attributes"],
    "all_attributes": ["all Attributes"],
    "life": ["maximum Life"],
    "mana": ["maximum Mana"],
    "spirit": ["Spirit"],
}


def implicit_contrib(base_implicit, axis):
    """Max value a base implicit contributes to `axis` (0 if none). The synthetic
    item's total on this axis is implicit + the rolled suffix/prefix, and the trade
    pseudo counts both — so the price threshold must include the implicit."""
    if not base_implicit:
        return 0
    for kw in IMPLICIT_KW.get(axis, []):
        if kw in base_implicit:
            r = re.search(r"\((\d+)-(\d+)\)", base_implicit)
            return int(r.group(2)) if r else 0
    return 0


# base name -> trade category
SLOT_CATEGORY = {
    "ring": "accessory.ring",
    "amulet": "accessory.amulet",
    "belt": "accessory.belt",
    "body": "armour.chest",
    "helmet": "armour.helmet",
    "gloves": "armour.gloves",
    "boots": "armour.boots",
    "quiver": "accessory.quiver",
    "focus": "armour.focus",
}


def trade_filter_for(slot_target, modfile, relax=0.85):
    """Build trade-fetch.ts --stat args from a chosen slot target's achieved axes.
    Prefer pseudo for caps/attributes; explicit tradeId otherwise. min = relaxed
    achieved value (so trade returns that tier band or better)."""
    base = slot_target.get("base")
    binfo = modfile["bases"].get(base) if base else None
    category = (
        SLOT_CATEGORY.get(binfo["slot"]) if binfo else slot_target.get("category")
    )
    implicit = (binfo or {}).get("implicit")
    stats = []
    for pick in slot_target.get("picks", []):
        axis = pick["axis"]
        # total target on this axis = rolled value + what the base implicit adds
        # (the pseudo total counts both); relax for tier headroom.
        total = (pick.get("value") or 0) + implicit_contrib(implicit, axis)
        mn = max(1, int(math.floor(total * relax)))
        sid = AXIS_PSEUDO.get(axis) or (pick.get("tradeIds") or [None])[0]
        if sid:
            stats.append(f"{sid}:{mn}")
    # Search by exact base type: the offline search chose this base because its
    # implicit (e.g. Prismatic all-ele, Ruby fire) was load-bearing for the combo.
    # A different base would lack that implicit and the re-sim would fail. If supply
    # is thin the printed trade URL lets the user broaden the base in-browser.
    # When `type` is set it already pins the item class precisely, so drop the
    # `category` (avoids an Unknown-category empty result if an armour category id is
    # off). Category is only the fallback when no specific base was chosen.
    use_base = base and not slot_target.get("category_only")
    return {
        "category": None if use_base else category,
        "type": base if use_base else None,
        "trade_stats": stats,
    }


def trade_search(slot_cfg: dict, league: str, limit=10, price_ex=None) -> dict:
    cmd = ["bun", str(TRADE_FETCH), "--league", league, "--limit", str(limit)]
    if slot_cfg.get("type"):
        cmd += ["--type", slot_cfg["type"]]
    if slot_cfg.get("category"):
        cmd += ["--category", slot_cfg["category"]]
    if price_ex:
        cmd += ["--price", str(price_ex)]
    for st in slot_cfg.get("trade_stats", []):
        cmd += ["--stat", st]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        out = json.loads(res.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return {
            "url": None,
            "total": None,
            "items": [],
            "error": (res.stdout[-200:] + " | " + res.stderr[-200:]),
        }
    for i, it in enumerate(out.get("items", [])):
        it["n"] = i + 1
    out.setdefault("error", None)
    return out


# ── pipeline ─────────────────────────────────────────────────────────────────
def cmd_baseline(spec):
    xml = load_baseline(spec)
    slotmap = slot_item_ids(xml)
    stats = simulate(xml, {}, slotmap, "baseline")
    print("BASELINE  " + audit_line(stats, spec["hard"]))
    print(
        "slots present:",
        ", ".join(
            f"{k}=#{v}" for k, v in slotmap.items() if k in spec.get("slots", {})
        ),
    )
    return xml, slotmap, stats


def cmd_search(spec, out_path=None):
    """OFFLINE. No GGG. Enumerate constructible synthetic combos, sim, rank."""
    modfile = load_modfile(spec)
    xml = load_baseline(spec)
    slotmap = slot_item_ids(xml)
    base = simulate(xml, {}, slotmap, "baseline")
    print("BASELINE  " + audit_line(base, spec["hard"]))
    print(
        f"modfile: {modfile['meta']['modCount']} mods, {len(modfile['bases'])} bases\n"
    )

    tiers = spec.get("tiers", 2)
    base_ilvl = spec.get("base_ilvl", DEFAULT_BASE_ILVL)
    max_slot_variants = spec.get("max_slot_variants", 8)
    max_combos = spec.get("max_combos", 200)

    # build per-slot variant pools (offline, constructibility-checked).
    # A slot-config's dict key is a free LABEL (variant group); `slot` is the real
    # baseline slot it targets (defaults to the label when they coincide).
    slot_variants = {}
    for label, cfg in spec["slots"].items():
        realslot = cfg.get("slot", label)
        if realslot not in slotmap:
            print(f"  {label}: real slot {realslot!r} not in baseline slot map — skip")
            slot_variants[label] = []
            continue
        vs = enumerate_slot_variants(modfile, cfg, tiers, base_ilvl, max_slot_variants)
        for v in vs:
            v["realslot"] = realslot
        slot_variants[label] = vs
        tag = cfg.get("base") or "explicit"
        print(
            f"  {label} → {realslot} ({tag}): {len(vs)} constructible variant(s)"
            + (
                ""
                if vs
                else "  — INFEASIBLE (axes can't fit affix slots / not rollable)"
            )
        )

    # cross-product per plan, cap combos by total difficulty
    all_jobs, job_meta = [], {}
    for plan in spec["plans"]:
        pools = [slot_variants[s] for s in plan["swaps"]]
        if any(not p for p in pools):
            print(f"[skip] {plan['label']} — a slot is infeasible")
            continue
        if len({pools[i][0]["realslot"] for i in range(len(pools))}) != len(
            plan["swaps"]
        ):
            print(f"[skip] {plan['label']} — two variants target the same real slot")
            continue
        combos = list(product(*pools))
        combos.sort(key=lambda c: sum(v["difficulty"] for v in c))
        for combo in combos[:max_combos]:
            tag = f"{plan['label'][:3]}|" + "|".join(
                f"{s}:{v['difficulty']}" for s, v in zip(plan["swaps"], combo)
            )
            tag = tag + f"|{abs(hash(tuple(v['desc'] for v in combo))) % 10000}"
            swaps = {v["realslot"]: v["pob"] for v in combo}
            all_jobs.append((tag, swaps))
            job_meta[tag] = {
                "plan": plan["label"],
                "combo": list(zip(plan["swaps"], combo)),
                "difficulty": sum(v["difficulty"] for v in combo),
            }

    if not all_jobs:
        print(
            "\nNo constructible combo to simulate. Loosen the hypothesis (different base / "
            "fewer axes per slot / touch another slot) and re-run."
        )
        return None
    print(
        f"\nsimulating {len(all_jobs)} constructible combos in PoB (offline, parallel)..."
    )
    results = sim_many(xml, all_jobs, slotmap, workers=spec.get("workers", 6))

    scored = []
    for tag, st in results.items():
        bad = hard_violations(st, spec["hard"])
        scored.append((tag, st, job_meta[tag], bad))

    def desc(meta):
        return "  +  ".join(f"{s}: {v['desc']}" for s, v in meta["combo"])

    passing = [(t, st, m) for (t, st, m, bad) in scored if not bad]
    # rank: best balance (soft) first, then cheapest (difficulty), then fewest swaps
    passing.sort(
        key=lambda x: (
            -soft_score(x[1], spec["soft"]),
            x[2]["difficulty"],
            len(x[2]["combo"]),
        )
    )

    print(
        f"\n=== {len(passing)}/{len(all_jobs)} combos PASS all hard constraints (offline PoB) ==="
    )
    for tag, st, meta in passing[: spec.get("top", 6)]:
        print(f"\n[difficulty {meta['difficulty']}] {meta['plan']}")
        print(f"    {desc(meta)}")
        print("    " + audit_line(st, spec["hard"]))

    if not passing:
        near = sorted(
            scored,
            key=lambda x: (
                len(x[3]),
                -soft_score(x[1], spec["soft"]),
                x[2]["difficulty"],
            ),
        )
        print("\n--- CLOSEST (fewest violations) — adjust hypothesis toward these ---")
        for tag, st, meta, bad in near[: spec.get("top", 5)]:
            print(f"\n[{len(bad)} miss: {', '.join(bad)}] {meta['plan']}")
            print(f"    {desc(meta)}")
            print("    " + audit_line(st, spec["hard"]))
        return None

    # winner -> chosen-combo target file for `price`
    win_tag, win_st, win_meta = passing[0]
    chosen = {
        "league": spec["league"],
        "patch": spec.get("patch", "0.5.0"),
        "baseline": spec["baseline"],
        "modfile": spec.get("modfile"),
        "budget_ex": spec.get("budget_ex"),
        "hard": spec["hard"],
        "plan": win_meta["plan"],
        "predicted": {
            k: win_st.get(k)
            for k in (
                "fireRes",
                "coldRes",
                "lightningRes",
                "chaosRes",
                "int",
                "reqInt",
                "spiritUnreserved",
                "life",
                "evasion",
                "energyShield",
            )
        },
        "slots": {},
        "trade_prefs": spec.get("tradePrefs", []),
    }
    for label, v in win_meta["combo"]:
        chosen["slots"][label] = {
            "slot": v.get("realslot", label),
            "base": v.get("base"),
            "picks": v.get("picks", []),
            "achieved": v.get("achieved", {}),
        }
    out = Path(out_path) if out_path else (TMP / "gopt-chosen.json")
    if not out.is_absolute():
        out = ROOT / out
    out.write_text(json.dumps(chosen, indent=2))
    print(f"\n→ chosen combo written: {out}")
    print("  Next: price it with  gear-optimize.py price " + str(out))
    return chosen


def cmd_price(chosen_path):
    """The ONLY phase that touches GGG. Price the chosen combo's per-slot targets."""
    chosen = json.loads(Path(chosen_path).read_text())
    spec_stub = {
        "baseline": chosen["baseline"],
        "modfile": chosen.get("modfile"),
        "patch": chosen.get("patch", "0.5.0"),
        "hard": chosen["hard"],
    }
    modfile = load_modfile(spec_stub)
    xml = load_baseline(spec_stub)
    slotmap = slot_item_ids(xml)
    league = chosen["league"]
    budget = chosen.get("budget_ex")

    print(f"=== PRICE-CHECK (securable, ≤{budget}ex) — plan: {chosen['plan']} ===")
    print(
        "Predicted (offline PoB): "
        + ", ".join(
            f"{k}={v:.0f}"
            for k, v in chosen["predicted"].items()
            if isinstance(v, (int, float))
        )
    )
    print()
    slot_real, slot_url = {}, {}
    for slot, target in chosen["slots"].items():
        tf = trade_filter_for(target, modfile)
        print(
            f"  searching {slot} ({tf['category']}) stats={tf['trade_stats']} ...",
            flush=True,
        )
        r = trade_search(
            tf, league, limit=chosen.get("trade_limit", 10), price_ex=budget
        )
        slot_url[slot] = r["url"]
        slot_real[slot] = r["items"]
        print(f"    total={r['total']} fetched={len(r['items'])}  url={r['url']}")
        if not r["items"]:
            print(
                f"    (no securable supply at target; error: {r.get('error')}) "
                f"→ loosen this slot's target in search, do NOT widen trade blindly"
            )

    # re-sim the single cheapest real item per slot together (one combo, reality check)
    if all(slot_real.get(s) for s in chosen["slots"]):
        swaps = {
            chosen["slots"][s].get("slot", s): slot_real[s][0]["pob"]
            for s in chosen["slots"]
        }
        st = simulate(xml, swaps, slotmap, "price-realcheck")
        bad = hard_violations(st, chosen["hard"])
        cost = sum((slot_real[s][0].get("price") or 0) for s in chosen["slots"])
        print(f"\n=== CHEAPEST REAL COMBO re-sim (~{cost:.0f}ex) ===")
        for s in chosen["slots"]:
            it = slot_real[s][0]
            print(
                f"  {s}: {it['name'].strip()} — {it['price']}{(it['currency'] or '')[:1]}"
            )
        print("  " + audit_line(st, chosen["hard"]))
        if bad:
            print(
                "  ⚠ affordable roll falls below target → loop back to search with a lower target,"
                " or raise budget. Do NOT hammer trade."
            )
        else:
            print(
                "  ✓ affordable real combo still passes — confidence holds at real prices."
            )

    print("\nTrade URLs (open + whisper in-game yourself — engine never whispers):")
    for slot, url in slot_url.items():
        print(f"  {slot}: {url}")


def cmd_sim(spec, slot, pobfile):
    xml = load_baseline(spec)
    slotmap = slot_item_ids(xml)
    pob = Path(pobfile).read_text()
    st = simulate(xml, {slot: pob}, slotmap, "adhoc")
    print(audit_line(st, spec["hard"]))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("baseline",):
        p = sub.add_parser(name)
        p.add_argument("spec")
    ps = sub.add_parser("search")
    ps.add_argument("spec")
    ps.add_argument("--out", default=None)
    pp = sub.add_parser("price")
    pp.add_argument("chosen")
    psim = sub.add_parser("sim")
    psim.add_argument("spec")
    psim.add_argument("--slot", required=True)
    psim.add_argument("--pob", required=True)
    args = ap.parse_args()

    if args.cmd == "baseline":
        cmd_baseline(json.loads(Path(args.spec).read_text()))
    elif args.cmd == "search":
        cmd_search(json.loads(Path(args.spec).read_text()), out_path=args.out)
    elif args.cmd == "price":
        cmd_price(args.chosen)
    elif args.cmd == "sim":
        cmd_sim(json.loads(Path(args.spec).read_text()), args.slot, args.pob)


if __name__ == "__main__":
    main()
