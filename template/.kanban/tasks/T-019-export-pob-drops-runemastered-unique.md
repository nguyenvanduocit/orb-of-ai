# T-019: export-pob drops 0.5 RunicUnique items (frameType 14)

> OAuth→export-pob drops every RunicUnique (frameType 14) because PoB v0.17.1's rarityMap has no key 14 → rarity=nil → item discarded at import. Fix = normalize frameType 14→3 in our adapter before ImportItemsAndSkills.

- **priority**: high
- **effort**: S

## Problem
`pob-cli.sh --oauth <char>` → `export-pob.sh` (`ImportItemsAndSkills`) drops EVERY equipped item whose GGG `frameType == 14` / `frameTypeId == "RunicUnique"` (the new 0.5 Verisium-Runeforged unique frame). Root cause verified by PoC (2026-06-03): PoB `src/Classes/ImportTab.lua:1026` has `rarityMap = {[0]="NORMAL","MAGIC","RARE","UNIQUE",[9]="RELIC",[10]="RELIC",[13]="RARE"}` — **no key 14** — and line 1051 `item.rarity = rarityMap[itemData.frameType]` → `nil` → item construction fails → dropped. On ThaoCamVienSaiGon (Lv71) this dropped BOTH **Enfolding Dawn** (body, Runemastered Pilgrim Vestments) AND **Tyranny's Grip** (active Weapon 1, Runemastered Ironhead Spear); exported XML had 16 `<Item>` (14 equip + 2 jewels) with Body Armour + Weapon 1 slots `itemId=0`. Baseline audit then reads fake fire **−22** (real ≈ +7 — body gives +15% all-ele + +14% fire rune = +29), missing +100 Spirit, +40 life, and the whole main-hand weapon.

Falsified by PoC (don't chase these): NOT a data gap (PoB has `itemBases["Runemastered Pilgrim Vestments"]`, `["Runemastered Ironhead Spear"]`, and uniques `Enfolding Dawn`/`Tyranny's Grip`), NOT a unique-base-name mismatch, NOT rune sockets / bonded mods / "Gain no inherent bonus from Intelligence". Fork is already at tip (v0.17.1 == origin/dev, no newer 0.x) so `git pull` does NOT fix it. See [[project_oauth_export_drops_body]]. The id15/16 "Emerald" items are the 2 real jewels, not bogus.

## Goal
`--oauth` → PoB code round-trips ALL equipped items incl. RunicUnique, so the baseline audit matches in-game with zero manual re-injection.

## Requirements
- Fix in OUR adapter (`fetch-oauth.py` or `export-pob.lua`), NOT the vendored fork: before `ImportItemsAndSkills`, rewrite equipment with `frameType == 14` → `frameType = 3`, `frameTypeId = "Unique"`. Verified sufficient — base prefix "Runemastered " resolves on its own, no strip needed. (Patching fork `ImportTab.lua:1026` to add `[14]="UNIQUE"` is the alternative but gets clobbered on re-clone.)
- Confirm fix survives a fork re-clone (lives in our code, not `data/pob-source/`).

## Criteria
- [ ] Fresh `--oauth ThaoCamVienSaiGon` export (no hand-injection) → decoded XML has 18 `<Item>` with Enfolding Dawn in Body Armour slot + Tyranny's Grip in active Weapon 1.
- [ ] `gear-optimize.py baseline` on that XML reads fire ~+7 / cold ~75 / light ~69 / spiritFree positive — matching the body-corrected baseline.
- [ ] PoC proof retained: `frameType 14→3` alone takes `<Item>` count 16→18, Body Armour=non-zero itemId, Weapon 1=non-zero itemId.
