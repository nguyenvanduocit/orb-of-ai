#!/usr/bin/env bun
/**
 * POE2 Waystone / Tablet Mod Regex Generator
 *
 * Implements the hawolt/poe-regex algorithm for POE2:
 *   1. Load mod corpus (waystone or tablet) from <project-root>/data/map-mods/
 *   2. For each selected mod, find the shortest substring that is UNIQUE
 *      within the corpus (matches selected mod, no other unselected mod)
 *   3. Fall back to predefined fallback regex if no unique substring exists
 *   4. Join results with `|`; prefix with `!s ` if --exclude mode
 *
 * Usage:
 *   bun scripts/generate-regex.ts --exclude "extra cold,additional Projectiles,Chilled"
 *   bun scripts/generate-regex.ts --include "pack size,quantity,rarity"
 *   bun scripts/generate-regex.ts --corpus tablet --include "breach,delirium"
 *
 * Status: WORKING STUB. Algorithm is wired; corpus data file is the TODO.
 * See <project-root>/data/map-mods/README.md for the fetch-from-wiki recipe.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ModEntry {
  id: string
  text: string         // Full mod text (single line, lowercased for matching)
  fallback?: string    // Override regex if no unique substring exists
}

interface ParsedArgs {
  mode: 'exclude' | 'include'
  corpus: 'waystone' | 'tablet'
  needles: string[]    // User-provided mod search terms
}

// ────────────────────────────────────────────────────────────────────────────
// Corpus loading
// ────────────────────────────────────────────────────────────────────────────

function loadCorpus(corpus: 'waystone' | 'tablet'): ModEntry[] {
  // Canonical corpus path: <project-root>/data/map-mods/<corpus>-mods-0.5.json
  // Script lives at .claude/skills/map-mod-filter/scripts/generate-regex.ts — climb ../../../../
  const path = resolve(__dirname, `../../../../data/map-mods/${corpus}-mods-0.5.json`)
  if (!existsSync(path)) {
    console.error(`[generate-regex] Corpus missing: ${path}`)
    console.error(`[generate-regex] See <project-root>/data/map-mods/README.md for fetch recipe.`)
    console.error(`[generate-regex] Falling back to BUILT-IN minimal sample corpus (incomplete — for smoke test only).`)
    return BUILTIN_SAMPLE_CORPUS[corpus]
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as ModEntry[]
  return raw.map(m => ({ ...m, text: m.text.toLowerCase() }))
}

// Minimal handwritten sample (replaces real corpus until data/ is populated)
// Mods sourced from data/wiki/List_of_modifiers_for_waystones_(high_tier).md
const BUILTIN_SAMPLE_CORPUS: Record<'waystone' | 'tablet', ModEntry[]> = {
  waystone: [
    { id: 'infernal', text: 'monsters deal 26-30% of damage as extra fire' },
    { id: 'frostbitten', text: 'monsters deal 26-30% of damage as extra cold' },
    { id: 'thunderous', text: 'monsters deal 26-30% of damage as extra lightning' },
    { id: 'profane', text: 'monsters deal 26-30% of damage as extra chaos' },
    { id: 'of_splitting', text: 'monsters fire 2 additional projectiles' },
    { id: 'pack_size', text: '20% increased pack size' },
    { id: 'item_quantity', text: '20% increased item quantity' },
    { id: 'item_rarity', text: '40% increased item rarity' },
    { id: 'waystones_found', text: '25% increased waystones found in area' },
    { id: 'monster_life', text: 'monsters have 50% more life' },
    { id: 'monster_damage', text: 'monsters deal 35% more damage' },
  ],
  tablet: [
    { id: 'breach', text: 'maps in range contain breaches' },
    { id: 'delirium', text: 'maps in range contain delirium' },
    { id: 'expedition', text: 'maps in range contain expedition' },
    { id: 'ritual', text: 'maps in range contain ritual' },
    { id: 'essence', text: 'maps in range contain essence monsters' },
    { id: 'pack_size_tablet', text: 'maps in range have 10% increased pack size' },
    { id: 'rarity_tablet', text: 'maps in range have 25% increased item rarity' },
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Algorithm: shortest-unique-substring per selected mod
// ────────────────────────────────────────────────────────────────────────────

const BLACKLIST = new Set([
  'the', 'and', 'to', 'in', 'of', 'a', 'is', 'are', 'you', 'your',
  'monsters', 'players', 'map', 'maps', 'have', 'has', 'with', 'extra',
])

/** All substrings of `s` with length >= minLen, sorted shortest-first */
function substrings(s: string, minLen = 2): string[] {
  const out = new Set<string>()
  for (let i = 0; i < s.length; i++) {
    for (let j = i + minLen; j <= s.length; j++) {
      out.add(s.slice(i, j))
    }
  }
  return [...out]
    .filter(sub => !BLACKLIST.has(sub.trim()))
    .filter(sub => sub.trim().length >= minLen)
    .sort((a, b) => a.length - b.length)
}

/** Find shortest substring of `mod.text` that matches NO entry in `others`. */
function shortestUniqueSubstring(mod: ModEntry, others: ModEntry[]): string | null {
  for (const sub of substrings(mod.text)) {
    const collidesWith = others.some(o => o.text.includes(sub))
    if (!collidesWith) return sub
  }
  return null
}

function matchModsByNeedle(corpus: ModEntry[], needle: string): ModEntry[] {
  const n = needle.toLowerCase().trim()
  return corpus.filter(m => m.text.includes(n) || m.id.includes(n))
}

function generateRegex(args: ParsedArgs): string {
  const corpus = loadCorpus(args.corpus)

  const selected = new Set<string>()
  for (const needle of args.needles) {
    const matches = matchModsByNeedle(corpus, needle)
    if (matches.length === 0) {
      console.error(`[generate-regex] No mod matches needle "${needle}" in ${args.corpus} corpus.`)
    }
    for (const m of matches) selected.add(m.id)
  }

  if (selected.size === 0) {
    console.error(`[generate-regex] No mods selected — empty regex.`)
    return ''
  }

  const fragments: string[] = []
  for (const id of selected) {
    const mod = corpus.find(m => m.id === id)!
    const others = corpus.filter(m => !selected.has(m.id))
    const frag = shortestUniqueSubstring(mod, others) ?? mod.fallback ?? mod.text.slice(0, 4)
    fragments.push(frag)
  }

  // Deduplicate fragments — multiple selected mods may collapse to the same substring
  const unique = [...new Set(fragments)]
  const joined = unique.join('|')
  const prefix = args.mode === 'exclude' ? '!s ' : ''
  return `"${prefix}${joined}"`
}

// ────────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): ParsedArgs {
  let mode: 'exclude' | 'include' = 'exclude'
  let corpus: 'waystone' | 'tablet' = 'waystone'
  let needles: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--exclude') {
      mode = 'exclude'
      needles = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    } else if (a === '--include') {
      mode = 'include'
      needles = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    } else if (a === '--corpus') {
      const c = argv[++i]
      if (c !== 'waystone' && c !== 'tablet') throw new Error(`--corpus must be waystone|tablet, got "${c}"`)
      corpus = c
    } else if (a === '--help' || a === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  if (needles.length === 0) {
    printHelp()
    process.exit(1)
  }
  return { mode, corpus, needles }
}

function printHelp() {
  console.log(`POE2 Waystone/Tablet Mod Regex Generator

Usage:
  bun scripts/generate-regex.ts --exclude "<mod1>,<mod2>,..."
  bun scripts/generate-regex.ts --include "<mod1>,<mod2>,..."
  bun scripts/generate-regex.ts --corpus tablet --include "breach,delirium"

Options:
  --exclude <list>   Generate !s (negated) regex to EXCLUDE these mods
  --include <list>   Generate plain regex to INCLUDE these mods
  --corpus <name>    waystone (default) | tablet
  --help             This message

Output is a single quoted regex ready to paste into a POE2 stash tab search field
(50-character limit per field).

Status: STUB. Real 0.5 mod corpus not yet bundled — using a small built-in sample.
See <project-root>/data/map-mods/README.md for the TODO to fetch the live 0.5 corpus.`)
}

if (import.meta.main) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const regex = generateRegex(args)
    if (regex) console.log(regex)
  } catch (err) {
    console.error(`[generate-regex] ${(err as Error).message}`)
    process.exit(1)
  }
}

export { generateRegex, shortestUniqueSubstring, loadCorpus }
