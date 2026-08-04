/**
 * Real NeverSink/FilterBlade 0.5 Filter Test
 * Regression guard: the parser must accept an actual FilterBlade export for the
 * live 0.5 "Runes of Aldur" league (NeverSink 0.10.2a, fetched 2026-06-15).
 *
 * This fixture exercises the real-world syntax that the hand-made fixtures missed:
 *   - glued numeric operators            HasExplicitMod >=1 "..."
 *   - numeric conditions with no operator Height 1
 *   - AlwaysShow as a boolean condition   AlwaysShow True
 *   - the Kite minimap icon shape         MinimapIcon 0 Red Kite
 * BaseType validation is intentionally off here so the test stays hermetic
 * (loadGameData fetches poe2filter.com live, whose catalogue lags new bases).
 */

import { describe, test, expect } from 'bun:test'
import { parseAsync, validate, formatErrors } from '../src'
import { readFile } from 'fs/promises'
import { join } from 'path'

const FILTER_PATH = join(__dirname, 'fixtures/neversink-0.10.2a-3-STRICT.filter')

describe('Real NeverSink 0.10.2a (0.5 Runes of Aldur)', () => {
  test('parses the real FilterBlade export without throwing', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)
    expect(blocks.length).toBeGreaterThan(400)
    console.log(`Parsed ${blocks.length} blocks`)
  })

  test('the fixture actually contains the tricky 0.5 syntax', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    expect(content).toContain('HasExplicitMod >=1') // glued operator
    expect(content).toMatch(/\n\s+Height \d/)        // operator-less numeric
    expect(content).toContain('AlwaysShow True')     // boolean condition
    expect(content).toContain(' Kite')               // minimap shape
  })

  test('validates with no errors (class + numeric + color, no network)', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)
    const result = validate(blocks, {
      validateClasses: true,
      validateBaseTypes: false,
      warnHiddenValuables: false,
    })
    if (result.errors.length > 0) {
      console.log(formatErrors(result.errors.slice(0, 15)))
    }
    expect(result.errors.length).toBe(0)
  })
})
