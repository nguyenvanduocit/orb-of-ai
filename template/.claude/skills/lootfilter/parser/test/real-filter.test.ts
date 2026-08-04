/**
 * Real-World Filter Test
 * Tests parsing and validation of the actual FilterBlade.filter file
 */

import { describe, test, expect } from 'bun:test'
import { parseAsync, validate, formatErrors } from '../src'
import { readFile } from 'fs/promises'
import { join } from 'path'

const FILTER_PATH = join(__dirname, 'fixtures/FilterBlade.filter')

describe('Real FilterBlade.filter', () => {
  test('parses FilterBlade.filter without throwing', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)

    expect(blocks.length).toBeGreaterThan(0)
    console.log(`Parsed ${blocks.length} blocks successfully`)
  })

  test('validates FilterBlade.filter', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)
    const result = validate(blocks)

    console.log('Validation stats:')
    console.log(`  Total blocks: ${result.stats.totalBlocks}`)
    console.log(`  Show blocks: ${result.stats.showBlocks}`)
    console.log(`  Hide blocks: ${result.stats.hideBlocks}`)

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`)
      console.log(formatErrors(result.errors.slice(0, 10)))
    }

    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`)
      console.log(formatErrors(result.warnings.slice(0, 10)))
    }

    // Filter should parse, but may have validation warnings
    expect(result.stats.totalBlocks).toBeGreaterThan(0)
  })

  test('extracts condition statistics', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)
    const result = validate(blocks)

    console.log('\nCondition usage:')
    const conditions = Object.entries(result.stats.conditions)
      .sort(([, a], [, b]) => b - a)
    for (const [name, count] of conditions) {
      console.log(`  ${name}: ${count}`)
    }
  })

  test('extracts action statistics', async () => {
    const content = await readFile(FILTER_PATH, 'utf-8')
    const blocks = await parseAsync(content)
    const result = validate(blocks)

    console.log('\nAction usage:')
    const actions = Object.entries(result.stats.actions)
      .sort(([, a], [, b]) => b - a)
    for (const [name, count] of actions) {
      console.log(`  ${name}: ${count}`)
    }
  })
})
