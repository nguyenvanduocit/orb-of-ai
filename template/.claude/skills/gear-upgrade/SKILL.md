---
skill_name: gear-upgrade
description: "Find optimal POE2 gear upgrades by building confidence OFFLINE — simulate constructible synthetic item combinations in PoB2 from a canonical mod-query file, balance every hard constraint at once, then touch trade ONLY to price the combo you already trust. Use when user says 'upgrade POE2 gear', 'find POE2 upgrade', 'optimize my POE2 character', 'what should I buy for POE2', or wants to improve their POE2 character's equipment."
version: 3.0.0
tags: [gear, upgrade, trade, pob, simulation, optimization, poe2, playwriter, combination]
---

# POE2 Gear Upgrade Optimizer

Gear in POE2 is a **balance problem**, not a greedy stat chase. Swapping one piece shifts the whole envelope — resistances clip at cap, attribute requirements span items, Spirit reservation is a hard wall. You do not push one stat slot-by-slot; you distribute stats so **every hard constraint holds at once** and the set harmonises. And you do not spend scarce, rate-limited trade calls to *test* whether a combo works — you reach confidence entirely offline with PoB, then trade only to **price** the combo you already trust.

## The two halves — confidence offline, trade only to price

The whole tool is one principle: **trade is the last step, not part of the search.**

```
search  (OFFLINE — zero GGG calls, runs with Chrome closed)
  └─ assemble CONSTRUCTIBLE synthetic items from the canonical mod-query file
     → cross-product tier variants across a plan's slots
     → simulate every combo in PoB2 (cheap, parallel)
     → keep combos passing ALL hard constraints, rank by balance then cost
     → output the winning per-slot TARGET (base + achieved thresholds)

price   (the ONLY phase that touches GGG — sequential, rate-limit-safe)
  └─ search securable listings ONCE per slot for the chosen target
     → report real prices + trade URLs
     → re-sim the cheapest real combo to confirm it still passes
     → if the affordable roll falls below target: loop back to search,
        NEVER hammer trade
```

PoB validates the **defensive + hard-constraint envelope** (res / life / evasion / ES / Int / Spirit). It cannot model companion/minion DPS for a Spirit Walker zoo (PoB2 0.4 reports `combinedDPS=0`); damage-scaling mods (minion-level, companion-level) are **trade-side soft preferences, hand-reasoned**, never claimed as PoB-verified.

**NEVER whisper automatically.** Present the combo + cost + trade URLs; the user whispers in-client.

## Pieces

| Piece | Path | Role |
|------|------|------|
| Canonical mod-query file | `data/gear-mods/<patch>-gear-mods.json` | The single "raw material": every gear mod with affix type, group, tier ranges, `rollsOn` base tags, and the trade stat hash. Synthetic items are built FROM it (so they're constructible) and trade filters are generated FROM it (so stat IDs are always right). |
| Extractor | `.claude/skills/gear-upgrade/scripts/extract-gear-mods.{lua,sh}` | Dumps the canonical file from PoB2's own loaded mod tables (`data.itemMods.Item` + `data.itemBases`) — same data the calc engine uses. |
| Engine | `.claude/skills/gear-upgrade/scripts/gear-optimize.py` | `baseline` / `search` (offline) / `price` (trade) / `sim` (debug). |
| Trade primitive | `.claude/skills/gear-upgrade/scripts/trade-fetch.ts` | Clean-JSON securable fetch through `poeFetch` (rate-limit-safe). |
| Workflow | `.claude/workflows/gear-upgrade.js` (saved — invoke by `name`) | Orchestration: divergent hypotheses → search → adversarial verify → price → present. |
| PoB calc | `data/pob-source/pob-cli.sh calc` | Defensive stats + Int/Str/Dex/Spirit (extended `getStats`). |
| Live fetch | `data/pob-source/pob-cli.sh --oauth <char>` | OAuth full charData → PoB code (the only path to full POE2 charData). |

## Quick start (one character, end to end)

```bash
# 1. fresh live state → pin baseline XML (re-pin every run; never reuse a stale pin)
bash data/pob-source/pob-cli.sh --oauth ThaoCamVienSaiGon | jq -r .code > tmp/code.txt
python3 - <<'PY'
import base64,zlib,pathlib
code=open("tmp/code.txt").read().strip()
xml=zlib.decompress(base64.urlsafe_b64decode(code+"="*(-len(code)%4))).decode()
pathlib.Path("tmp/tcvsg-current.xml").write_text(xml)
PY

# 2. audit — confirm it matches the character's real stats before trusting anything
python3 .claude/skills/gear-upgrade/scripts/gear-optimize.py baseline tmp/spec.json

# 3. OFFLINE search — build confidence (no trade, Chrome can be closed)
python3 .claude/skills/gear-upgrade/scripts/gear-optimize.py search tmp/spec.json --out tmp/gopt-chosen.json

# 4. price-check the chosen combo (ONLY now touch GGG; needs logged-in Chrome + Playwriter)
python3 .claude/skills/gear-upgrade/scripts/gear-optimize.py price tmp/gopt-chosen.json
```

Or run the whole thing as one orchestration (see **Workflow** below).

## The spec — hypothesis intent, engine does the enumeration

The spec is the **reasoning layer**: it declares which slots to touch, which base, and which axes matter — derived from the build's mod pool + the audit. The engine then *enumerates the constructible variants* from the canonical file and lets PoB judge. You do not hand-write rolls.

```jsonc
{
  "baseline": "tmp/tcvsg-current.xml",
  "league": "Runes of Aldur", "patch": "0.5.0",
  "modfile": "data/gear-mods/0.5.0-gear-mods.json",
  "budget_ex": 100, "workers": 6, "tiers": 2, "base_ilvl": 82,
  "max_slot_variants": 8, "max_combos": 200, "top": 6,

  "hard": { "fireRes": 75, "coldRes": 75, "lightningRes": 75,
            "intMargin": 0, "spiritFree": 0, "life": 1170 },   // PoB MUST satisfy all
  "soft": ["coldRes","lightningRes","evasion","spiritUnreserved","life"], // ranked balance
  "tradePrefs": ["minion_level","companion_level"],            // hand-reasoned, not PoB-verified

  "slots": {
    // dict key = free LABEL (a variant group); "slot" = the real baseline slot it targets
    "Ring 2 (Prismatic)": { "slot": "Ring 2", "base": "Prismatic Ring",
      "axes": { "all_res": {"min":8}, "intelligence": {"min":18}, "life": {"min":30} } },
    "Belt": { "slot": "Belt", "base": "Heavy Belt",
      "axes": { "fire_res": {"min":30}, "life": {"min":60} } }
    // explicit-item mode (test one specific item): { "slot":"Ring 2", "item":["Rarity: RARE", ...] }
  },
  "plans": [
    { "label": "Prismatic ring + fire belt", "swaps": ["Ring 2 (Prismatic)", "Belt"] }
  ]
}
```

- **`hard`** keys: `fireRes coldRes lightningRes chaosRes intMargin strMargin dexMargin spiritFree life energyShield`. `intMargin: 0` means `Int ≥ ReqInt` (never break a gem requirement).
- **Constructibility is enforced**: a slot whose axes need more than 3 prefixes or 3 suffixes, or an axis that can't roll on the chosen base, is reported `INFEASIBLE` and dropped. Resistances/attributes are suffixes; life/spirit/mana are prefixes — a ring asking fire+cold+light+int (4 suffixes) is rejected, which forces the harmony solution (e.g. an all-elemental Prismatic ring instead).
- **Difficulty** = how high the tiers are; the search prefers the cheapest tier combo that still passes, so the chosen target is realistic to buy.

## Workflow (the orchestration)

The saved workflow `.claude/workflows/gear-upgrade.js` runs the full pipeline. Parallel agents are used ONLY where divergence helps; the engine handles combo-sim parallelism itself, and the trade phase stays sequential.

```
(caller, before invoke)  fresh OAuth → decode → pin baseline XML → body-correct any dropped
                          unique (see T-019 / [[project_oauth_export_drops_body]]) → baseline
                          audit, sanity-check vs real stats → pass baseline+audit+equipped via args
Phase 1  Hypotheses  (parallel)    N agents, each a distinct philosophy (cheapest-res-cap / max-evasion /
                                    spirit+minion-level / fewest-swaps), each grounded in the canonical file
                                    → emits a constructible spec fragment (no hallucinated hashes)
Phase 2  Synthesize   (JS)         merge fragments → one spec
Phase 3  Search      (offline)     runner agent runs gear-optimize.py search → ranked combos (GATE: no trade)
Phase 4  Verify      (parallel)    skeptics re-sim the winner + re-check constructibility + companion caveat
Phase 5  Price       (trade ONLY)  runner agent runs gear-optimize.py price → real prices + URLs
(return)  combo + cost + trade URLs; never whisper
```

Invoke BY NAME (after pinning + body-correcting the baseline):

```js
Workflow({ name: "gear-upgrade",
           args: { baseline:"tmp/tcvsg-current.xml", league:"Runes of Aldur", patch:"0.5.0",
                   modfile:"data/gear-mods/0.5.0-gear-mods.json", budget_ex:100,
                   hard:{ fireRes:75, lightningRes:75, coldRes:70, intMargin:0, dexMargin:0, spiritFree:0, life:1250 },
                   soft:["evasion","life","spiritUnreserved","coldRes"], tradePrefs:["minion_level","companion_level"],
                   audit:"<baseline audit line>", equipped:"<per-slot mods so agents don't drop load-bearing stats>" } })
```

## Trade — securable, rate-limit-safe, page-context only

Every GGG call goes through `poeFetch` (`poe-trade/ggg/transport.ts`): a same-origin `fetch()` inside a logged-in `www.pathofexile.com` tab driven by Playwriter — never curl/WebFetch to GGG. The account `hopthuxacnhan#3062` was previously flagged, so the transport self-enforces ≥2s spacing + 429/penalty backoff + a cross-process lockfile. **Prerequisite for `price`:** Chrome open, logged into `www.pathofexile.com`, Playwriter extension enabled on that tab.

- **`status: securable`** for every gear search — instant-buy via secure trade, whisper-free. Smaller pool than `online` but every hit is buyable now. If a tight target returns nothing, loosen the target in `search` — do not drop to `online`.
- **Currency = `exalted`** (POE2 main trade currency, not chaos).
- **Categories:** `accessory.ring` / `accessory.amulet` / `accessory.belt` / `armour.chest` / `armour.helmet` / `armour.gloves` / `armour.boots` / `accessory.quiver` / `armour.focus`.
- Resistance/attribute caps: filter by **per-element pseudo** (`pseudo.pseudo_total_fire_resistance` etc.), which counts single + all-ele rolls — the engine's `trade_filter_for` does this automatically from the canonical axes.

### Stat IDs

Do not recall hashes — they live in the canonical file (`mods[].tradeIds`, `tradeOnlyAxes`). Spot-verify against live `/api/trade2/data/stats?realm=poe2` if a search returns empty. Cross-checked 0.5 (Runes of Aldur):

| Stat | ID |
|------|----|
| `+# to maximum Life` | `explicit.stat_3299347043` |
| `+#% to Fire Resistance` | `explicit.stat_3372524247` |
| `+#% to all Elemental Resistances` | `explicit.stat_2901986750` |
| `+# to Spirit` | `explicit.stat_3981240776` |
| `+# to Intelligence` | `explicit.stat_328541901` |
| `+# to Level of all Minion Skills` | `explicit.stat_2162097452` |
| `+# to Level of all Tamed Companion Skills` | `explicit.stat_448592698` (trade-only — PoB2 0.4 can't construct/sim) |

## Current character — ThaoCamVienSaiGon (Spirit Walker zoo)

Evasion-based Dex Huntress, companion carry. Optimization profile (see `../CLAUDE.md` Current Context):
- **Defensive** (PoB-validated): cap Fire/Cold/Lightning res at 75; keep **Int ≥ 82** (hard gem cap, margin was only +1); keep Spirit reservation intact; favour **Evasion + Life** (never chase Armour — it doesn't scale this build).
- **Offensive** (hand-reasoned, not PoB-validated): `+Level of all Minion Skills` (amulet/helmet — securable) > `+Level of all Tamed Companion Skills` (amulet — rare, boosts Diretusk Boar). Spirit (amulet/body) for more companions.
- **Amulet** is the slot that carries Spirit + minion-level + life together; **body** carries the biggest Spirit roll.

## Refresh the canonical file

After a patch (or when PoB2 fork updates), re-extract:

```bash
bash .claude/skills/gear-upgrade/scripts/extract-gear-mods.sh 0.5.0
```

## Appendix — manual XML swap (debug / pin a baseline by hand)

The engine pins a decoded equipped-state XML and swaps `<Item id="N">…</Item>` blocks, stripping `<ModRange>` so PoB reads literal numbers (keeping ModRange makes PoB recompute from the roll midpoint → wrong numbers). Slot→itemId comes from the active `<Slot … itemId="N" name="…"/>` map. To inspect/edit by hand:

```bash
# decode a PoB code to XML
python3 -c 'import base64,zlib,sys; c=open("tmp/code.txt").read().strip(); print(zlib.decompress(base64.urlsafe_b64decode(c+"="*(-len(c)%4))).decode())' > tmp/build.xml
# ... edit an <Item> block ...
# Int/Spirit are NOT in the calc JSON — dump from the output table directly:
cd data/pob-source/src
export LUA_PATH="../runtime/lua/?.lua;../runtime/lua/?/init.lua;;"; export LUA_CPATH="$HOME/.luarocks/lib/lua/5.1/?.so;;"
luajit -e '_p=print;print=function()end;dofile("HeadlessWrapper.lua");print=_p;
  local c=io.open("/abs/tmp/code.txt"):read("*a"):gsub("-","+"):gsub("_","/");
  loadBuildFromXML(Inflate(common.base64.decode(c)),"X");runCallback("OnFrame");
  local o=build.calcsTab.mainOutput;
  print("Int="..o.Int.."(req"..o.ReqInt..") Spirit free="..o.SpiritUnreserved)'
```

Slot names (POE2): `Weapon 1/2`, `Helmet`, `Body Armour`, `Gloves`, `Boots`, `Ring 1/2`, `Amulet`, `Belt`, `Quiver`. No trade-able flask slot.
