/**
 * POE2 Filter Parser
 * Parser and validator for Path of Exile 2 item filters
 *
 * @example
 * ```typescript
 * import { parse, validate, loadGameData } from 'poe2-filter-parser'
 *
 * const filterContent = `
 * Show
 *   Class == "Stackable Currency"
 *   BaseType == "Divine Orb"
 *   SetFontSize 45
 *   PlayEffect Red
 * `
 *
 * // Parse the filter
 * const blocks = parse(filterContent)
 *
 * // Validate with game data
 * const gameData = await loadGameData()
 * const result = validate(blocks, { gameData })
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 */

// Re-export types
export * from './types'

// Re-export validator
export { validate, loadGameData, type ValidatorOptions } from './validator'

// Parser will be generated from PEG.js
// For now, create a wrapper that handles the generated parser

export interface ParseError {
  message: string
  location: {
    start: { line: number; column: number; offset: number }
    end: { line: number; column: number; offset: number }
  }
}

// Parser module - lazy loaded
let parserModule: { parse: (input: string) => unknown } | null = null

async function loadParser(): Promise<{ parse: (input: string) => unknown }> {
  if (parserModule) return parserModule
  try {
    // Try to import the generated parser
    // @ts-expect-error - parser.js is generated at build time
    const mod = await import('./parser.js')
    parserModule = mod.default || mod
    return parserModule!
  } catch {
    throw new Error(
      'Parser not built. Run `bun run build:grammar` first.'
    )
  }
}

/**
 * Parse a POE2 filter file content (async version)
 * @param input - The filter file content as a string
 * @returns Parsed filter blocks
 * @throws ParseError if the filter has syntax errors
 */
export async function parseAsync(input: string): Promise<import('./types').FilterBlock[]> {
  const parser = await loadParser()

  try {
    return parser.parse(input) as import('./types').FilterBlock[]
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'location' in error) {
      const pegError = error as { message: string; location: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } } }
      throw {
        message: pegError.message,
        location: pegError.location,
      } as ParseError
    }
    throw error
  }
}

/**
 * Parse a POE2 filter file content (sync version - requires parser to be pre-loaded)
 * @param input - The filter file content as a string
 * @returns Parsed filter blocks
 * @throws ParseError if the filter has syntax errors
 */
export function parse(input: string): import('./types').FilterBlock[] {
  if (!parserModule) {
    throw new Error(
      'Parser not loaded. Use parseAsync() or call loadParser() first.'
    )
  }

  try {
    return parserModule.parse(input) as import('./types').FilterBlock[]
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'location' in error) {
      const pegError = error as { message: string; location: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } } }
      throw {
        message: pegError.message,
        location: pegError.location,
      } as ParseError
    }
    throw error
  }
}

/**
 * Parse a filter file and validate it
 * Convenience function that combines parse and validate
 */
export async function parseAndValidate(
  input: string,
  options?: import('./validator').ValidatorOptions
): Promise<{
  blocks: import('./types').FilterBlock[]
  validation: import('./types').ValidationResult
}> {
  const blocks = await parseAsync(input)

  // Load game data if not provided
  let gameData = options?.gameData
  if (!gameData && (options?.validateBaseTypes !== false)) {
    const { loadGameData } = await import('./validator')
    gameData = await loadGameData()
  }

  const { validate } = await import('./validator')
  const validation = validate(blocks, { ...options, gameData })

  return { blocks, validation }
}

/**
 * Format validation errors for display
 */
export function formatErrors(
  errors: import('./types').ValidationError[]
): string {
  return errors
    .map(e => {
      const loc = e.location
        ? `[Line ${e.location.start.line}:${e.location.start.column}]`
        : ''
      const suggestion = e.suggestion ? `\n  Suggestion: ${e.suggestion}` : ''
      return `${e.type.toUpperCase()}: ${loc} ${e.message}${suggestion}`
    })
    .join('\n')
}
