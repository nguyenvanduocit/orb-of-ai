/**
 * POE2 Filter Validator
 * Validates filter syntax and game data references
 */

import type {
  FilterBlock,
  GameData,
  ValidationError,
  ValidationResult,
} from './types'
import { POE2_CLASSES } from './types'

const POE2_CLASSES_SET = new Set<string>(POE2_CLASSES)

export interface ValidatorOptions {
  /** Check BaseType values against game data */
  validateBaseTypes?: boolean
  /** Check Class values against known POE2 classes */
  validateClasses?: boolean
  /** Warn about potentially hidden valuable items */
  warnHiddenValuables?: boolean
  /** Game data for validation */
  gameData?: GameData
}

const defaultOptions: ValidatorOptions = {
  validateBaseTypes: true,
  validateClasses: true,
  warnHiddenValuables: true,
}

/**
 * Validate a parsed filter
 */
export function validate(
  blocks: FilterBlock[],
  options: ValidatorOptions = {}
): ValidationResult {
  const opts = { ...defaultOptions, ...options }
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Statistics
  const stats = {
    totalBlocks: blocks.length,
    showBlocks: 0,
    hideBlocks: 0,
    conditions: {} as Record<string, number>,
    actions: {} as Record<string, number>,
  }

  for (const block of blocks) {
    // Count activity types
    if (block.activity === 'Show' || block.activity === 'AlwaysShow') {
      stats.showBlocks++
    } else if (block.activity === 'Hide' || block.activity === 'Minimal') {
      stats.hideBlocks++
    }

    // Count conditions and actions
    for (const condName of Object.keys(block.conditions)) {
      stats.conditions[condName] = (stats.conditions[condName] || 0) + 1
    }
    for (const actName of Object.keys(block.actions)) {
      stats.actions[actName] = (stats.actions[actName] || 0) + 1
    }

    // Validate Class values
    if (opts.validateClasses && block.conditions.Class) {
      for (const cls of block.conditions.Class.values) {
        if (!POE2_CLASSES_SET.has(cls)) {
          // Check for partial match
          const matches = POE2_CLASSES.filter(c =>
            c.toLowerCase().includes(cls.toLowerCase())
          )
          if (matches.length === 0) {
            errors.push({
              type: 'error',
              message: `Unknown Class: "${cls}"`,
              block,
              location: block.location,
              suggestion: `Valid classes: ${POE2_CLASSES.slice(0, 5).join(', ')}...`,
            })
          }
        }
      }
    }

    // Validate BaseType values against game data
    if (opts.validateBaseTypes && opts.gameData && block.conditions.BaseType) {
      for (const baseType of block.conditions.BaseType.values) {
        if (!opts.gameData.baseTypes.has(baseType)) {
          // Check for close matches (typos)
          const similar = findSimilar(baseType, opts.gameData.baseTypes, 3)
          warnings.push({
            type: 'warning',
            message: `Unknown BaseType: "${baseType}"`,
            block,
            location: block.location,
            suggestion: similar.length > 0 ? `Did you mean: ${similar.join(', ')}?` : undefined,
          })
        }
      }
    }

    // Validate numeric ranges
    validateNumericRanges(block, errors)

    // Validate color values
    validateColors(block, errors)

    // Warn about hidden valuable items
    if (opts.warnHiddenValuables && opts.gameData) {
      checkHiddenValuables(block, opts.gameData, warnings)
    }

    // Check for empty blocks
    if (
      Object.keys(block.conditions).length === 0 &&
      block.activity !== 'Hide'
    ) {
      warnings.push({
        type: 'warning',
        message: `Block has no conditions - will match ALL items`,
        block,
        location: block.location,
      })
    }

    // Check for Show blocks without visual actions
    if (
      (block.activity === 'Show' || block.activity === 'AlwaysShow') &&
      !block.actions.SetFontSize &&
      !block.actions.SetTextColor &&
      !block.actions.PlayEffect &&
      !block.actions.MinimapIcon
    ) {
      warnings.push({
        type: 'warning',
        message: `Show block has no visual styling - items may be hard to notice`,
        block,
        location: block.location,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  }
}

/**
 * Validate numeric condition ranges
 */
function validateNumericRanges(
  block: FilterBlock,
  errors: ValidationError[]
): void {
  const { conditions } = block

  // ItemLevel: 1-100
  if (conditions.ItemLevel && (conditions.ItemLevel.value < 1 || conditions.ItemLevel.value > 100)) {
    errors.push({
      type: 'error',
      message: `ItemLevel must be between 1 and 100, got ${conditions.ItemLevel.value}`,
      block,
      location: block.location,
    })
  }

  // AreaLevel: 1-100
  if (conditions.AreaLevel && (conditions.AreaLevel.value < 1 || conditions.AreaLevel.value > 100)) {
    errors.push({
      type: 'error',
      message: `AreaLevel must be between 1 and 100, got ${conditions.AreaLevel.value}`,
      block,
      location: block.location,
    })
  }

  // Quality: 0-30
  if (conditions.Quality && (conditions.Quality.value < 0 || conditions.Quality.value > 30)) {
    errors.push({
      type: 'error',
      message: `Quality must be between 0 and 30, got ${conditions.Quality.value}`,
      block,
      location: block.location,
    })
  }

  // Sockets: 0-6
  if (conditions.Sockets && (conditions.Sockets.value < 0 || conditions.Sockets.value > 6)) {
    errors.push({
      type: 'error',
      message: `Sockets must be between 0 and 6, got ${conditions.Sockets.value}`,
      block,
      location: block.location,
    })
  }

  // WaystoneTier: 1-16
  if (conditions.WaystoneTier && (conditions.WaystoneTier.value < 1 || conditions.WaystoneTier.value > 16)) {
    errors.push({
      type: 'error',
      message: `WaystoneTier must be between 1 and 16, got ${conditions.WaystoneTier.value}`,
      block,
      location: block.location,
    })
  }

  // UnidentifiedItemTier: 0-6
  if (conditions.UnidentifiedItemTier && (conditions.UnidentifiedItemTier.value < 0 || conditions.UnidentifiedItemTier.value > 6)) {
    errors.push({
      type: 'error',
      message: `UnidentifiedItemTier must be between 0 and 6, got ${conditions.UnidentifiedItemTier.value}`,
      block,
      location: block.location,
    })
  }

  // Height: 1-4
  if (conditions.Height && (conditions.Height.value < 1 || conditions.Height.value > 4)) {
    errors.push({
      type: 'error',
      message: `Height must be between 1 and 4, got ${conditions.Height.value}`,
      block,
      location: block.location,
    })
  }

  // Width: 1-2
  if (conditions.Width && (conditions.Width.value < 1 || conditions.Width.value > 2)) {
    errors.push({
      type: 'error',
      message: `Width must be between 1 and 2, got ${conditions.Width.value}`,
      block,
      location: block.location,
    })
  }
}

/**
 * Validate color values
 */
function validateColors(block: FilterBlock, errors: ValidationError[]): void {
  const { actions } = block

  const colorActions = [
    { name: 'SetTextColor', value: actions.SetTextColor },
    { name: 'SetBorderColor', value: actions.SetBorderColor },
    { name: 'SetBackgroundColor', value: actions.SetBackgroundColor },
  ]

  for (const { name, value } of colorActions) {
    if (value) {
      if (value.r < 0 || value.r > 255 || value.g < 0 || value.g > 255 || value.b < 0 || value.b > 255 || value.a < 0 || value.a > 255) {
        errors.push({
          type: 'error',
          message: `${name} color values must be between 0 and 255`,
          block,
          location: block.location,
        })
      }
    }
  }

  // Validate PlayAlertSound volume
  if (actions.PlayAlertSound && (actions.PlayAlertSound.volume < 0 || actions.PlayAlertSound.volume > 300)) {
    errors.push({
      type: 'error',
      message: `PlayAlertSound volume must be between 0 and 300, got ${actions.PlayAlertSound.volume}`,
      block,
      location: block.location,
    })
  }
}

/**
 * Check for potentially hidden valuable items
 */
function checkHiddenValuables(
  block: FilterBlock,
  _gameData: GameData, // Reserved for future: check against known valuable items
  warnings: ValidationError[]
): void {
  if (block.activity !== 'Hide') return

  const { conditions } = block

  // Check if hiding all Support Gems
  if (conditions.Class?.values.includes('Support Gems') && !conditions.BaseType) {
    warnings.push({
      type: 'warning',
      message: `Hiding all Support Gems - some lineage gems are very valuable!`,
      block,
      location: block.location,
      suggestion: `Consider adding BaseType conditions for valuable gems like "Zerphi's Infamy", "Arjun's Medal"`,
    })
  }

  // Check if hiding all Uniques
  if (conditions.Rarity?.values.includes('Unique') && !conditions.BaseType) {
    warnings.push({
      type: 'warning',
      message: `Hiding all Unique items - some may be very valuable!`,
      block,
      location: block.location,
      suggestion: `Consider adding BaseType conditions for valuable unique bases`,
    })
  }

  // Check if hiding all Currency
  if (conditions.Class?.values.includes('Stackable Currency') && !conditions.BaseType) {
    warnings.push({
      type: 'warning',
      message: `Hiding all Currency - some may be valuable!`,
      block,
      location: block.location,
    })
  }
}

/**
 * Find similar strings (for typo detection)
 */
function findSimilar(target: string, candidates: Set<string>, maxResults: number): string[] {
  const targetLower = target.toLowerCase()
  const results: Array<{ str: string; score: number }> = []

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase()

    // Check if contains
    if (candidateLower.includes(targetLower) || targetLower.includes(candidateLower)) {
      results.push({ str: candidate, score: 1 })
      continue
    }

    // Calculate Levenshtein distance
    const distance = levenshtein(targetLower, candidateLower)
    if (distance <= 3) {
      results.push({ str: candidate, score: 1 / (distance + 1) })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => r.str)
}

/**
 * Levenshtein distance calculation
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Load game data from poe2filter.com APIs
 */
export async function loadGameData(): Promise<GameData> {
  const baseTypes = new Set<string>()
  const classes = new Set<string>(POE2_CLASSES)
  const currencies = new Set<string>()
  const uniques = new Map<string, string[]>()
  const supportGems = new Set<string>()

  try {
    // Fetch gear data
    const gearRes = await fetch('https://poe2filter.com/data/poe2/gear-data.json')
    const gearData = await gearRes.json() as Array<{ name: string }>
    for (const item of gearData) {
      baseTypes.add(item.name)
    }

    // Fetch currency data
    const currencyRes = await fetch('https://poe2filter.com/data/poe2/currency-data.json')
    const currencyData = await currencyRes.json() as Array<{ baseType: string }>
    for (const item of currencyData) {
      baseTypes.add(item.baseType)
      currencies.add(item.baseType)
    }

    // Fetch uniques data
    const uniquesRes = await fetch('https://poe2filter.com/data/poe2/uniques-data.json')
    const uniquesData = await uniquesRes.json() as Array<{ baseType: string; name: string }>
    for (const item of uniquesData) {
      baseTypes.add(item.baseType)
      const existing = uniques.get(item.baseType) || []
      existing.push(item.name)
      uniques.set(item.baseType, existing)
    }

    // Fetch support gems
    const gemsRes = await fetch('https://poe2filter.com/data/poe2/currency-data-manual.json')
    const gemsData = await gemsRes.json() as Array<{ baseType: string }>
    for (const item of gemsData) {
      baseTypes.add(item.baseType)
      supportGems.add(item.baseType)
    }
  } catch (error) {
    console.error('Failed to load game data:', error)
  }

  return { baseTypes, classes, currencies, uniques, supportGems }
}
