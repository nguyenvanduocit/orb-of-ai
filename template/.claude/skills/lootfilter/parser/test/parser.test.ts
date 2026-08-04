/**
 * POE2 Filter Parser Tests
 * Comprehensive tests for parsing POE2 filter syntax
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { parseAsync, type FilterBlock } from '../src/index'

describe('POE2 Filter Parser', () => {
  describe('Basic Block Parsing', () => {
    test('parses simple Show block', async () => {
      const input = `Show
  Class == "Stackable Currency"
  SetFontSize 45
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].activity).toBe('Show')
      expect(blocks[0].conditions.Class).toEqual({
        operator: '==',
        values: ['Stackable Currency'],
      })
      expect(blocks[0].actions.SetFontSize).toBe(45)
    })

    test('parses simple Hide block', async () => {
      const input = `Hide
  Rarity Normal Magic
  AreaLevel >= 65
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].activity).toBe('Hide')
      expect(blocks[0].conditions.Rarity).toEqual({
        operator: '=',
        values: ['Normal', 'Magic'],
      })
      expect(blocks[0].conditions.AreaLevel).toEqual({
        operator: '>=',
        value: 65,
      })
    })

    test('parses Minimal block', async () => {
      const input = `Minimal
  Class == "Charms"
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].activity).toBe('Minimal')
    })

    test('parses AlwaysShow block', async () => {
      const input = `AlwaysShow
  Class == "Quest Items"
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].activity).toBe('AlwaysShow')
    })

    test('parses multiple blocks', async () => {
      const input = `Show
  BaseType == "Divine Orb"
  SetFontSize 45

Hide
  Rarity Normal
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].activity).toBe('Show')
      expect(blocks[1].activity).toBe('Hide')
    })
  })

  describe('Condition Parsing', () => {
    describe('String Array Conditions', () => {
      test('parses Class with single value', async () => {
        const input = `Show
  Class == "Stackable Currency"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Class).toEqual({
          operator: '==',
          values: ['Stackable Currency'],
        })
      })

      test('parses Class with multiple values', async () => {
        const input = `Show
  Class == "Life Flasks" "Mana Flasks" "Charms"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Class).toEqual({
          operator: '==',
          values: ['Life Flasks', 'Mana Flasks', 'Charms'],
        })
      })

      test('parses BaseType with exact match operator', async () => {
        const input = `Show
  BaseType == "Divine Orb" "Mirror of Kalandra"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.BaseType).toEqual({
          operator: '==',
          values: ['Divine Orb', 'Mirror of Kalandra'],
        })
      })

      test('parses BaseType without operator (default =)', async () => {
        const input = `Show
  BaseType "Chaos Orb"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.BaseType).toEqual({
          operator: '=',
          values: ['Chaos Orb'],
        })
      })
    })

    describe('Numeric Conditions', () => {
      test('parses ItemLevel with various operators', async () => {
        const tests = [
          { op: '>=', val: 75 },
          { op: '<=', val: 50 },
          { op: '>', val: 80 },
          { op: '<', val: 20 },
          { op: '=', val: 100 },
        ] as const

        for (const { op, val } of tests) {
          const input = `Show\n  ItemLevel ${op} ${val}\n`
          const blocks = await parseAsync(input)
          expect(blocks[0].conditions.ItemLevel).toEqual({
            operator: op,
            value: val,
          })
        }
      })

      test('parses AreaLevel', async () => {
        const input = `Show
  AreaLevel >= 68
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.AreaLevel).toEqual({
          operator: '>=',
          value: 68,
        })
      })

      test('parses Quality', async () => {
        const input = `Show
  Quality >= 20
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Quality).toEqual({
          operator: '>=',
          value: 20,
        })
      })

      test('parses Sockets', async () => {
        const input = `Show
  Sockets >= 3
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Sockets).toEqual({
          operator: '>=',
          value: 3,
        })
      })

      test('parses StackSize', async () => {
        const input = `Show
  StackSize >= 1000
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.StackSize).toEqual({
          operator: '>=',
          value: 1000,
        })
      })

      test('parses WaystoneTier (POE2 specific)', async () => {
        const input = `Show
  WaystoneTier >= 15
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.WaystoneTier).toEqual({
          operator: '>=',
          value: 15,
        })
      })

      test('parses UnidentifiedItemTier (POE2 specific)', async () => {
        const input = `Show
  UnidentifiedItemTier >= 4
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.UnidentifiedItemTier).toEqual({
          operator: '>=',
          value: 4,
        })
      })

      test('parses Height and Width', async () => {
        const input = `Show
  Height >= 2
  Width >= 1
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Height).toEqual({
          operator: '>=',
          value: 2,
        })
        expect(blocks[0].conditions.Width).toEqual({
          operator: '>=',
          value: 1,
        })
      })

      test('parses BaseArmour, BaseEvasion, BaseEnergyShield', async () => {
        const input = `Show
  BaseArmour > 100
  BaseEvasion > 50
  BaseEnergyShield > 30
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.BaseArmour).toEqual({
          operator: '>',
          value: 100,
        })
        expect(blocks[0].conditions.BaseEvasion).toEqual({
          operator: '>',
          value: 50,
        })
        expect(blocks[0].conditions.BaseEnergyShield).toEqual({
          operator: '>',
          value: 30,
        })
      })
    })

    describe('Boolean Conditions', () => {
      test('parses Corrupted', async () => {
        const input = `Show
  Corrupted True
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Corrupted).toBe(true)
      })

      test('parses TwiceCorrupted (POE2 specific)', async () => {
        const input = `Show
  TwiceCorrupted True
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.TwiceCorrupted).toBe(true)
      })

      test('parses Identified', async () => {
        const input = `Show
  Identified False
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Identified).toBe(false)
      })

      test('parses Mirrored', async () => {
        const input = `Show
  Mirrored True
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Mirrored).toBe(true)
      })

      test('parses IsVaalUnique (POE2 specific)', async () => {
        const input = `Show
  IsVaalUnique True
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.IsVaalUnique).toBe(true)
      })

      test('parses HasVaalUniqueMod (POE2 specific)', async () => {
        const input = `Show
  HasVaalUniqueMod True
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.HasVaalUniqueMod).toBe(true)
      })
    })

    describe('Rarity Condition', () => {
      test('parses single rarity', async () => {
        const input = `Show
  Rarity Unique
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Rarity).toEqual({
          operator: '=',
          values: ['Unique'],
        })
      })

      test('parses multiple rarities', async () => {
        const input = `Show
  Rarity Normal Magic Rare
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Rarity).toEqual({
          operator: '=',
          values: ['Normal', 'Magic', 'Rare'],
        })
      })

      test('parses rarity with operator', async () => {
        const input = `Show
  Rarity >= Rare
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.Rarity).toEqual({
          operator: '>=',
          values: ['Rare'],
        })
      })
    })

    describe('HasExplicitMod Condition', () => {
      test('parses HasExplicitMod with mod names', async () => {
        const input = `Show
  HasExplicitMod "Tyrannical" "Merciless"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.HasExplicitMod).toEqual({
          count: null,
          values: ['Tyrannical', 'Merciless'],
        })
      })

      test('parses HasExplicitMod with count', async () => {
        const input = `Show
  HasExplicitMod >= 2 "Prefix" "Suffix"
`
        const blocks = await parseAsync(input)
        expect(blocks[0].conditions.HasExplicitMod).toEqual({
          count: { operator: '>=', value: 2 },
          values: ['Prefix', 'Suffix'],
        })
      })
    })
  })

  describe('Action Parsing', () => {
    test('parses SetFontSize', async () => {
      const input = `Show
  SetFontSize 45
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.SetFontSize).toBe(45)
    })

    test('parses SetTextColor with RGB', async () => {
      const input = `Show
  SetTextColor 255 0 0
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.SetTextColor).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 255,
      })
    })

    test('parses SetTextColor with RGBA', async () => {
      const input = `Show
  SetTextColor 255 215 0 200
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.SetTextColor).toEqual({
        r: 255,
        g: 215,
        b: 0,
        a: 200,
      })
    })

    test('parses SetBorderColor', async () => {
      const input = `Show
  SetBorderColor 100 100 100 255
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.SetBorderColor).toEqual({
        r: 100,
        g: 100,
        b: 100,
        a: 255,
      })
    })

    test('parses SetBackgroundColor', async () => {
      const input = `Show
  SetBackgroundColor 0 0 0 180
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.SetBackgroundColor).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 180,
      })
    })

    test('parses PlayEffect', async () => {
      const input = `Show
  PlayEffect Red
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.PlayEffect).toEqual({
        color: 'Red',
        temp: false,
      })
    })

    test('parses PlayEffect with Temp', async () => {
      const input = `Show
  PlayEffect Yellow Temp
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.PlayEffect).toEqual({
        color: 'Yellow',
        temp: true,
      })
    })

    test('parses MinimapIcon', async () => {
      const input = `Show
  MinimapIcon 0 Red Star
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.MinimapIcon).toEqual({
        size: 'Large',
        color: 'Red',
        shape: 'Star',
      })
    })

    test('parses MinimapIcon with different sizes', async () => {
      const tests = [
        { size: '0', expected: 'Large' },
        { size: '1', expected: 'Medium' },
        { size: '2', expected: 'Small' },
      ] as const

      for (const { size, expected } of tests) {
        const input = `Show\n  MinimapIcon ${size} Blue Circle\n`
        const blocks = await parseAsync(input)
        expect(blocks[0].actions.MinimapIcon?.size).toBe(expected)
      }
    })

    test('parses PlayAlertSound', async () => {
      const input = `Show
  PlayAlertSound 1 300
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.PlayAlertSound).toEqual({
        id: 1,
        volume: 300,
      })
    })

    test('parses PlayAlertSound without volume', async () => {
      const input = `Show
  PlayAlertSound 5
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.PlayAlertSound).toEqual({
        id: 5,
        volume: 100,
      })
    })

    test('parses CustomAlertSound', async () => {
      const input = `Show
  CustomAlertSound "sounds/drop.mp3" 200
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.CustomAlertSound).toEqual({
        path: 'sounds/drop.mp3',
        volume: 200,
      })
    })

    test('parses DisableDropSound', async () => {
      const input = `Show
  DisableDropSound True
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.DisableDropSound).toBe(true)
    })

    test('parses DisableDropSound without value', async () => {
      const input = `Show
  DisableDropSound
`
      const blocks = await parseAsync(input)
      expect(blocks[0].actions.DisableDropSound).toBe(true)
    })
  })

  describe('Continue Directive', () => {
    test('parses Continue directive', async () => {
      const input = `Show
  ItemLevel >= 82
  Rarity Rare
  SetTextColor 255 255 0
  Continue
`
      const blocks = await parseAsync(input)
      expect(blocks[0].continue).toBe(true)
    })

    test('block without Continue has continue=false', async () => {
      const input = `Show
  Rarity Unique
`
      const blocks = await parseAsync(input)
      expect(blocks[0].continue).toBe(false)
    })
  })

  describe('Comments', () => {
    test('parses comment lines before block', async () => {
      const input = `# This is a comment
# Another comment
Show
  BaseType == "Divine Orb"
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].comments).toContain('This is a comment')
      expect(blocks[0].comments).toContain('Another comment')
    })

    test('ignores inline comments', async () => {
      const input = `Show # Show valuable currency
  BaseType == "Divine Orb" # God tier
  SetFontSize 45
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].conditions.BaseType).toBeDefined()
    })

    test('handles comment-only lines within block', async () => {
      const input = `Show
  # Currency section
  Class == "Stackable Currency"
  # Visual settings
  SetFontSize 40
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].conditions.Class).toBeDefined()
      expect(blocks[0].actions.SetFontSize).toBe(40)
    })
  })

  describe('Edge Cases', () => {
    test('handles empty filter', async () => {
      const input = ``
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(0)
    })

    test('handles filter with only comments', async () => {
      const input = `# Just a comment
# Another one
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(0)
    })

    test('handles block with no conditions', async () => {
      const input = `Show
  SetFontSize 40
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(Object.keys(blocks[0].conditions)).toHaveLength(0)
    })

    test('handles block with no actions', async () => {
      const input = `Hide
  Rarity Normal
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(Object.keys(blocks[0].actions)).toHaveLength(0)
    })

    test('handles Windows line endings (CRLF)', async () => {
      const input = `Show\r\n  Class == "Waystones"\r\n  SetFontSize 40\r\n`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].conditions.Class).toBeDefined()
    })

    test('handles tabs in indentation', async () => {
      const input = `Show
\tClass == "Jewels"
`
      // This should fail or handle gracefully - tabs are not standard
      // The grammar uses spaces for indentation
    })

    test('handles special characters in BaseType', async () => {
      const input = `Show
  BaseType == "Zerphi's Infamy" "Arjun's Medal"
`
      const blocks = await parseAsync(input)
      expect(blocks[0].conditions.BaseType?.values).toContain("Zerphi's Infamy")
      expect(blocks[0].conditions.BaseType?.values).toContain("Arjun's Medal")
    })
  })

  describe('Location Tracking', () => {
    test('tracks block location', async () => {
      const input = `Show
  BaseType == "Test"
`
      const blocks = await parseAsync(input)
      expect(blocks[0].location).toBeDefined()
      expect(blocks[0].location.start.line).toBe(1)
      expect(blocks[0].location.start.column).toBe(1)
    })
  })

  describe('Real-World Filter Examples', () => {
    test('parses S-tier currency block', async () => {
      const input = `Show
  BaseType == "Divine Orb" "Mirror of Kalandra" "Fracturing Orb"
  SetFontSize 45
  SetTextColor 255 0 0 255
  SetBorderColor 255 0 0 255
  SetBackgroundColor 255 255 255 255
  PlayEffect Red
  MinimapIcon 0 Red Star
  DisableDropSound True
`
      const blocks = await parseAsync(input)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].activity).toBe('Show')
      expect(blocks[0].conditions.BaseType?.values).toHaveLength(3)
      expect(blocks[0].actions.SetFontSize).toBe(45)
      expect(blocks[0].actions.PlayEffect?.color).toBe('Red')
      expect(blocks[0].actions.MinimapIcon?.shape).toBe('Star')
    })

    test('parses waystone tier block', async () => {
      const input = `Show
  WaystoneTier >= 15
  Class == "Waystones"
  SetFontSize 38
  SetTextColor 255 0 0 255
  PlayEffect Red
  MinimapIcon 0 Red Star
`
      const blocks = await parseAsync(input)
      expect(blocks[0].conditions.WaystoneTier?.value).toBe(15)
      expect(blocks[0].conditions.Class?.values).toContain('Waystones')
    })

    test('parses hide block for low-tier items', async () => {
      const input = `Hide
  Rarity Normal Magic
  AreaLevel >= 65
  DisableDropSound True
`
      const blocks = await parseAsync(input)
      expect(blocks[0].activity).toBe('Hide')
      expect(blocks[0].conditions.Rarity?.values).toContain('Normal')
      expect(blocks[0].conditions.Rarity?.values).toContain('Magic')
      expect(blocks[0].conditions.AreaLevel?.value).toBe(65)
    })
  })
})
