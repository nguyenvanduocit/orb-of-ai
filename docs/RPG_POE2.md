# Cửa Ải → PoE2-minified rewrite (Season 1)

A faithful, Discord-minified Path of Exile 2 adaptation of `/rpg`. Auto-battle stays (fits
Discord + PoE's own combat log), but combat is now driven by **skill gem + support gems +
passive tree + resistances vs monster ailments** — real build depth.

## Locked decisions
- **Fresh league wipe** — Season 1. Wipe `characters.json` / `expeditions.json` /
  `rpg-market.json` / `rpg-pvp.json` on rollout; keep coins/attendance/streams/lottery/worldcup.
  Announce "🩸 Liên Minh Mùa 1". A `season` int in the store bumps → wipe-on-load.
- **Full signature set** in v1 (see phases).
- **VN "bro" persona + PoE2 mechanics** (mechanics = PoE2, voice = current bot).

## Systems (PoE2 → Discord)
| System | Minified form | Module |
|---|---|---|
| Items: base + ilvl + prefix/suffix weighted mods | done | `rpg.ts` (item layer) |
| Currency crafting (9 orbs) | done | `rpg.ts` (`craftOrb`) |
| Damage types + resistances + ailments | phys/fire/cold/light/chaos · res cap 75% · ignite/shock/freeze/poison/bleed | `rpg-combat.ts` |
| Skill gem + support gems | 1 main skill + N linked supports; gems level with use | `rpg-skills.ts` |
| Passive tree | ~50-node cluster graph, points/level | `rpg-passives.ts` |
| Flasks | life + utility, charges on kill, auto-used by sim | `rpg-skills.ts` (or `rpg-flasks.ts`) |
| Zones → Maps/Atlas | tiered maps + rollable map-mods (danger↑ → loot↑) | `rpg-maps.ts` |
| Uniques, Vaal/corrupt, ascendancy, leagues, trade | later | — |
| Real-time movement, 1500-node tree, gem quality | **cut** | — |

## Combat model (`rpg-combat.ts`)
Each fighter resolves to `Offense { hit: DamageBundle, crit, critMulti, speed, ailment } ` +
`Defenses { life, armour, evasion, res{fire,cold,light,chaos} }`. Round loop: DoTs tick →
each side acts (frozen = skip; `speed` hits/round) → per hit: evade check → crit → phys via
armour DR, elemental via `(1-res)`, chaos ignores armour → ailment rolls (ignite/poison/bleed
DoT, shock = +dmg-taken, freeze = skip). Seeded/pure, injected rng — same convention as the
old `fightFloor`.

## Character build assembly
`effectiveBuild(profile)` = class base × level → + gear (base stats + mods) → + passive-tree
nodes → skill gem (+supports) produces the Offense → gear/tree produce Defenses. This replaces
the old `effectiveStats`/`fightFloor`. `powerScore` re-derived for BXH/PvP bracket.

## Profile schema v2 (`RpgProfile`)
`cls, level, gear{slots}, bag[], skillGem, supports[], gemBag[], passives[] (allocated node
ids), flasks[], materials{+orbs}, atlas/map progress, coNgoc/perks (prestige = Atlas-ish),
tutorial, season`.

## Phase checklist
- [x] **P0** Item mods + currency orbs (prefix/suffix weighted ilvl tiers, 9-orb bench) — `rpg.ts`
- [ ] **P1** Combat core: damage types + resistances + ailments + auto-battle — `rpg-combat.ts` ← *in progress*
- [ ] **P2** Skill gems + support gems (defs + resolve → Offense) — `rpg-skills.ts`
- [ ] **P3** Passive tree (clusters) — `rpg-passives.ts`
- [ ] **P4** Character assembly `effectiveBuild` + new `RpgProfile` schema + flasks
- [ ] **P5** Maps / Atlas (tiers + map-mods) + expedition rewire
- [ ] **P6** Command surface rebuild: `/rpg` panels (gem socket, tree, flasks, craft bench, map device)
- [ ] **P7** Season wipe on load + agent-tool + orb-bot skill refresh
- [ ] **P8** Tests (per pure module) + independent review + CLAUDE.md docs

Build keeps the repo compiling at every phase; new pure modules land + tested standalone,
then the engine/commands swap over.
