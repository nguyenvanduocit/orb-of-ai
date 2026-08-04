/**
 * POE2 Filter Parser Types
 * Type definitions for Path of Exile 2 item filter syntax
 */

// Activity types
export type Activity = 'Show' | 'Hide' | 'Minimal' | 'AlwaysShow'

// Operators
export type NumericOperator = '<' | '<=' | '=' | '>=' | '>' | '=='
export type MatchOperator = '=' | '=='

// Rarity values
export type Rarity = 'Normal' | 'Magic' | 'Rare' | 'Unique'

// Effect colors
export type EffectColor =
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Green'
  | 'Blue'
  | 'Purple'
  | 'White'
  | 'Cyan'
  | 'Grey'
  | 'Brown'
  | 'Pink'
  | 'Black'

// Icon properties
export type IconSize = 'Large' | 'Medium' | 'Small'
export type IconColor =
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Green'
  | 'Blue'
  | 'Purple'
  | 'White'
  | 'Cyan'
  | 'Grey'
  | 'Brown'
  | 'Pink'
export type IconShape =
  | 'Circle'
  | 'Diamond'
  | 'Hexagon'
  | 'Square'
  | 'Star'
  | 'Triangle'
  | 'Cross'
  | 'Moon'
  | 'Raindrop'
  | 'Pentagon'
  | 'UpsideDownHouse'

// Color value
export interface Color {
  r: number
  g: number
  b: number
  a: number
}

// Condition value types
export interface NumericCondition {
  operator: NumericOperator
  value: number
}

export interface StringArrayCondition {
  operator: MatchOperator
  values: string[]
}

export interface RarityCondition {
  operator: NumericOperator | MatchOperator
  values: Rarity[]
}

export interface HasExplicitModCondition {
  count: NumericCondition | null
  values: string[]
}

// All possible conditions
export interface Conditions {
  Class?: StringArrayCondition
  BaseType?: StringArrayCondition
  Rarity?: RarityCondition
  ItemLevel?: NumericCondition
  AreaLevel?: NumericCondition
  DropLevel?: NumericCondition
  Quality?: NumericCondition
  Sockets?: NumericCondition
  StackSize?: NumericCondition
  GemLevel?: NumericCondition
  WaystoneTier?: NumericCondition
  UnidentifiedItemTier?: NumericCondition
  Height?: NumericCondition
  Width?: NumericCondition
  BaseArmour?: NumericCondition
  BaseEvasion?: NumericCondition
  BaseEnergyShield?: NumericCondition
  Corrupted?: boolean
  TwiceCorrupted?: boolean
  Mirrored?: boolean
  Identified?: boolean
  AnyEnchantment?: boolean
  HasImplicitMod?: boolean
  IsVaalUnique?: boolean
  HasVaalUniqueMod?: boolean
  HasExplicitMod?: HasExplicitModCondition
}

// Action value types
export interface PlayEffectAction {
  color: EffectColor
  temp: boolean
}

export interface MinimapIconAction {
  size: IconSize
  color: IconColor
  shape: IconShape
}

export interface PlayAlertSoundAction {
  id: number
  volume: number
}

export interface CustomAlertSoundAction {
  path: string
  volume: number
}

// All possible actions
export interface Actions {
  SetFontSize?: number
  SetTextColor?: Color
  SetBorderColor?: Color
  SetBackgroundColor?: Color
  PlayEffect?: PlayEffectAction
  MinimapIcon?: MinimapIconAction
  PlayAlertSound?: PlayAlertSoundAction
  CustomAlertSound?: CustomAlertSoundAction
  DisableDropSound?: boolean
  EnableDropSound?: boolean
}

// Location information
export interface Location {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

// Filter block
export interface FilterBlock {
  id: string
  activity: Activity
  conditions: Conditions
  actions: Actions
  continue: boolean
  comments: string[]
  location: Location
}

// Parse result
export type ParseResult = FilterBlock[]

// Validation types
export interface ValidationError {
  type: 'error' | 'warning'
  message: string
  block?: FilterBlock
  location?: Location
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  stats: {
    totalBlocks: number
    showBlocks: number
    hideBlocks: number
    conditions: Record<string, number>
    actions: Record<string, number>
  }
}

// Game data types for validation
export interface GameData {
  baseTypes: Set<string>
  classes: Set<string>
  currencies: Set<string>
  uniques: Map<string, string[]> // baseType -> unique names
  supportGems: Set<string>
}

// Condition names for POE2
export const POE2_CONDITIONS = [
  'Class',
  'BaseType',
  'Rarity',
  'ItemLevel',
  'AreaLevel',
  'DropLevel',
  'Quality',
  'Sockets',
  'StackSize',
  'GemLevel',
  'WaystoneTier',
  'UnidentifiedItemTier',
  'Height',
  'Width',
  'BaseArmour',
  'BaseEvasion',
  'BaseEnergyShield',
  'Corrupted',
  'TwiceCorrupted',
  'Mirrored',
  'Identified',
  'AnyEnchantment',
  'HasImplicitMod',
  'IsVaalUnique',
  'HasVaalUniqueMod',
  'HasExplicitMod',
] as const

// Action names for POE2
export const POE2_ACTIONS = [
  'SetFontSize',
  'SetTextColor',
  'SetBorderColor',
  'SetBackgroundColor',
  'PlayEffect',
  'MinimapIcon',
  'PlayAlertSound',
  'CustomAlertSound',
  'DisableDropSound',
  'EnableDropSound',
] as const

// POE2 Item Classes
export const POE2_CLASSES = [
  // Equipment
  'Body Armours',
  'Boots',
  'Gloves',
  'Helmets',
  'Shields',
  'Bucklers',
  'Foci',
  'Bows',
  'Crossbows',
  'Quarterstaves',
  'Staves',
  'Wands',
  'Sceptres',
  'One Hand Maces',
  'Two Hand Maces',
  'Spears',
  'Talismans',
  'Amulets',
  'Rings',
  'Belts',
  'Quivers',
  // Currency
  'Stackable Currency',
  'Augment',
  'Omen',
  'Incubators',
  // Consumables
  'Life Flasks',
  'Mana Flasks',
  'Charms',
  // Other
  'Jewels',
  'Relics',
  'Skill Gems',
  'Support Gems',
  'Waystones',
  'Tablet',
  'Map Fragments',
  'Expedition Logbook',
  'Pinnacle Keys',
  'Vault Keys',
  'Quest Items',
  'Instance Local Items',
  'Fishing Rods',
] as const

export type POE2Class = (typeof POE2_CLASSES)[number]
