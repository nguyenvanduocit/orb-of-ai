/**
 * POE2 Filter Validator Tests
 * Tests for filter validation logic
 */

import { describe, test, expect } from 'bun:test'
import { validate } from '../src/validator'
import type { FilterBlock, GameData } from '../src/types'

// Helper to create a minimal block for testing
function createBlock(overrides: Partial<FilterBlock>): FilterBlock {
  return {
    id: '0001',
    activity: 'Show',
    conditions: {},
    actions: {},
    continue: false,
    comments: [],
    location: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    },
    ...overrides,
  }
}

// Mock game data for testing
const mockGameData: GameData = {
  baseTypes: new Set([
    'Divine Orb',
    'Chaos Orb',
    'Mirror of Kalandra',
    'Altar Robe',
    'Heavy Belt',
  ]),
  classes: new Set([
    'Stackable Currency',
    'Body Armours',
    'Belts',
    'Support Gems',
  ]),
  currencies: new Set(['Divine Orb', 'Chaos Orb', 'Mirror of Kalandra']),
  uniques: new Map([
    ['Altar Robe', ["Atziri's Splendour"]],
    ['Heavy Belt', ['Headhunter']],
  ]),
  supportGems: new Set(["Zerphi's Infamy", "Arjun's Medal"]),
}

describe('POE2 Filter Validator', () => {
  describe('Basic Validation', () => {
    test('validates empty filter', () => {
      const result = validate([])
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.stats.totalBlocks).toBe(0)
    })

    test('validates simple valid block', () => {
      const blocks = [
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Stackable Currency'] },
          },
          actions: {
            SetFontSize: 40,
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('counts block statistics', () => {
      const blocks = [
        createBlock({ activity: 'Show' }),
        createBlock({ activity: 'Show' }),
        createBlock({ activity: 'Hide' }),
        createBlock({ activity: 'AlwaysShow' }),
        createBlock({ activity: 'Minimal' }),
      ]
      const result = validate(blocks)
      expect(result.stats.totalBlocks).toBe(5)
      expect(result.stats.showBlocks).toBe(3) // Show + AlwaysShow
      expect(result.stats.hideBlocks).toBe(2) // Hide + Minimal
    })
  })

  describe('Class Validation', () => {
    test('passes valid Class values', () => {
      const blocks = [
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Stackable Currency'] },
          },
        }),
      ]
      const result = validate(blocks, { validateClasses: true })
      expect(result.errors.filter(e => e.message.includes('Class'))).toHaveLength(0)
    })

    test('errors on unknown Class', () => {
      const blocks = [
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Invalid Class Name'] },
          },
        }),
      ]
      const result = validate(blocks, { validateClasses: true })
      expect(result.errors.some(e => e.message.includes('Unknown Class'))).toBe(true)
    })

    test('skips Class validation when disabled', () => {
      const blocks = [
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Invalid Class'] },
          },
        }),
      ]
      const result = validate(blocks, { validateClasses: false })
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('BaseType Validation', () => {
    test('passes valid BaseType values with game data', () => {
      const blocks = [
        createBlock({
          conditions: {
            BaseType: { operator: '==', values: ['Divine Orb', 'Chaos Orb'] },
          },
        }),
      ]
      const result = validate(blocks, {
        validateBaseTypes: true,
        gameData: mockGameData,
      })
      expect(result.warnings.filter(e => e.message.includes('BaseType'))).toHaveLength(0)
    })

    test('warns on unknown BaseType', () => {
      const blocks = [
        createBlock({
          conditions: {
            BaseType: { operator: '==', values: ['Nonexistent Item'] },
          },
        }),
      ]
      const result = validate(blocks, {
        validateBaseTypes: true,
        gameData: mockGameData,
      })
      expect(result.warnings.some(e => e.message.includes('Unknown BaseType'))).toBe(true)
    })

    test('suggests similar BaseTypes for typos', () => {
      const blocks = [
        createBlock({
          conditions: {
            BaseType: { operator: '==', values: ['Devine Orb'] }, // Typo
          },
        }),
      ]
      const result = validate(blocks, {
        validateBaseTypes: true,
        gameData: mockGameData,
      })
      const warning = result.warnings.find(e => e.message.includes('Unknown BaseType'))
      expect(warning?.suggestion).toBeDefined()
    })
  })

  describe('Numeric Range Validation', () => {
    test('validates ItemLevel range', () => {
      const blocks = [
        createBlock({
          conditions: {
            ItemLevel: { operator: '>=', value: 150 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('ItemLevel'))).toBe(true)
    })

    test('passes valid ItemLevel', () => {
      const blocks = [
        createBlock({
          conditions: {
            ItemLevel: { operator: '>=', value: 75 },
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.filter(e => e.message.includes('ItemLevel'))).toHaveLength(0)
    })

    test('validates Quality range (0-30)', () => {
      const blocks = [
        createBlock({
          conditions: {
            Quality: { operator: '>=', value: 50 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('Quality'))).toBe(true)
    })

    test('validates Sockets range (0-6)', () => {
      const blocks = [
        createBlock({
          conditions: {
            Sockets: { operator: '>=', value: 10 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('Sockets'))).toBe(true)
    })

    test('validates WaystoneTier range (1-16)', () => {
      const blocks = [
        createBlock({
          conditions: {
            WaystoneTier: { operator: '>=', value: 20 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('WaystoneTier'))).toBe(true)
    })

    test('validates UnidentifiedItemTier range (0-6)', () => {
      const blocks = [
        createBlock({
          conditions: {
            UnidentifiedItemTier: { operator: '>=', value: 10 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('UnidentifiedItemTier'))).toBe(true)
    })

    test('validates Height range (1-4)', () => {
      const blocks = [
        createBlock({
          conditions: {
            Height: { operator: '>=', value: 5 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('Height'))).toBe(true)
    })

    test('validates Width range (1-2)', () => {
      const blocks = [
        createBlock({
          conditions: {
            Width: { operator: '>=', value: 3 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('Width'))).toBe(true)
    })
  })

  describe('Color Validation', () => {
    test('passes valid colors', () => {
      const blocks = [
        createBlock({
          actions: {
            SetTextColor: { r: 255, g: 0, b: 0, a: 255 },
            SetBorderColor: { r: 100, g: 100, b: 100, a: 200 },
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.filter(e => e.message.includes('color'))).toHaveLength(0)
    })

    test('errors on invalid color values', () => {
      const blocks = [
        createBlock({
          actions: {
            SetTextColor: { r: 300, g: 0, b: 0, a: 255 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('color values'))).toBe(true)
    })
  })

  describe('Sound Validation', () => {
    test('errors on invalid PlayAlertSound volume', () => {
      const blocks = [
        createBlock({
          actions: {
            PlayAlertSound: { id: 1, volume: 500 }, // Invalid
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.errors.some(e => e.message.includes('volume'))).toBe(true)
    })
  })

  describe('Hidden Valuables Warning', () => {
    test('warns when hiding all Support Gems', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {
            Class: { operator: '==', values: ['Support Gems'] },
          },
        }),
      ]
      const result = validate(blocks, {
        warnHiddenValuables: true,
        gameData: mockGameData,
      })
      expect(result.warnings.some(e => e.message.includes('Support Gems'))).toBe(true)
    })

    test('warns when hiding all Uniques', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {
            Rarity: { operator: '=', values: ['Unique'] },
          },
        }),
      ]
      const result = validate(blocks, {
        warnHiddenValuables: true,
        gameData: mockGameData,
      })
      expect(result.warnings.some(e => e.message.includes('Unique'))).toBe(true)
    })

    test('warns when hiding all Currency', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {
            Class: { operator: '==', values: ['Stackable Currency'] },
          },
        }),
      ]
      const result = validate(blocks, {
        warnHiddenValuables: true,
        gameData: mockGameData,
      })
      expect(result.warnings.some(e => e.message.includes('Currency'))).toBe(true)
    })

    test('no warning when hiding with specific BaseTypes', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {
            Class: { operator: '==', values: ['Support Gems'] },
            BaseType: { operator: '==', values: ['Some Specific Gem'] },
          },
        }),
      ]
      const result = validate(blocks, {
        warnHiddenValuables: true,
        gameData: mockGameData,
      })
      expect(result.warnings.filter(e => e.message.includes('Support Gems'))).toHaveLength(0)
    })

    test('skips warning when disabled', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {
            Class: { operator: '==', values: ['Support Gems'] },
          },
        }),
      ]
      const result = validate(blocks, { warnHiddenValuables: false })
      expect(result.warnings.filter(e => e.message.includes('Support Gems'))).toHaveLength(0)
    })
  })

  describe('Empty Block Warnings', () => {
    test('warns about Show block with no conditions', () => {
      const blocks = [
        createBlock({
          activity: 'Show',
          conditions: {},
        }),
      ]
      const result = validate(blocks)
      expect(result.warnings.some(e => e.message.includes('no conditions'))).toBe(true)
    })

    test('no warning for Hide block with no conditions', () => {
      const blocks = [
        createBlock({
          activity: 'Hide',
          conditions: {},
        }),
      ]
      const result = validate(blocks)
      expect(result.warnings.filter(e => e.message.includes('no conditions'))).toHaveLength(0)
    })
  })

  describe('Visual Styling Warnings', () => {
    test('warns about Show block without visual styling', () => {
      const blocks = [
        createBlock({
          activity: 'Show',
          conditions: {
            Rarity: { operator: '=', values: ['Unique'] },
          },
          actions: {},
        }),
      ]
      const result = validate(blocks)
      expect(result.warnings.some(e => e.message.includes('no visual styling'))).toBe(true)
    })

    test('no warning when Show block has visual styling', () => {
      const blocks = [
        createBlock({
          activity: 'Show',
          conditions: {
            Rarity: { operator: '=', values: ['Unique'] },
          },
          actions: {
            SetFontSize: 40,
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.warnings.filter(e => e.message.includes('no visual styling'))).toHaveLength(0)
    })
  })

  describe('Statistics', () => {
    test('counts conditions correctly', () => {
      const blocks = [
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Currency'] },
            BaseType: { operator: '==', values: ['Orb'] },
          },
        }),
        createBlock({
          conditions: {
            Class: { operator: '==', values: ['Gems'] },
            Rarity: { operator: '=', values: ['Rare'] },
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.stats.conditions['Class']).toBe(2)
      expect(result.stats.conditions['BaseType']).toBe(1)
      expect(result.stats.conditions['Rarity']).toBe(1)
    })

    test('counts actions correctly', () => {
      const blocks = [
        createBlock({
          actions: {
            SetFontSize: 40,
            SetTextColor: { r: 255, g: 0, b: 0, a: 255 },
          },
        }),
        createBlock({
          actions: {
            SetFontSize: 38,
            PlayEffect: { color: 'Red', temp: false },
          },
        }),
      ]
      const result = validate(blocks)
      expect(result.stats.actions['SetFontSize']).toBe(2)
      expect(result.stats.actions['SetTextColor']).toBe(1)
      expect(result.stats.actions['PlayEffect']).toBe(1)
    })
  })
})
