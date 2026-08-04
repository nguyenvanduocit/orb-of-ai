{
  // POE2 Filter Parser
  // Based on advanced-poe-filter-parser by isuke (MIT License)
  // Adapted for Path of Exile 2 filter syntax

  let blockId = 0

  function getBlockId() {
    blockId++
    return blockId.toString().padStart(4, '0')
  }

  function resetBlockId() {
    blockId = 0
  }
}

//
// Entry Point
//
start = filter

filter = items:filterItem* { return items.filter(item => item !== null) }

filterItem = block / standaloneComment / standaloneEmptyLine

standaloneComment = !activityStart _* commentLine { return null }
standaloneEmptyLine = _* newline { return null }
activityStart = _* ('Show' / 'Hide' / 'Minimal' / 'AlwaysShow')

//
// Block Structure
//
block =
  _* comments:commentLines
  activity:activity
  lines:blockLine*
  _* {
    const conditions = {}
    const actions = {}
    let hasContinue = false

    for (const line of lines) {
      if (!line) continue
      if (line.type === 'condition') {
        conditions[line.name] = line.value
      } else if (line.type === 'action') {
        actions[line.name] = line.value
      } else if (line.type === 'continue') {
        hasContinue = true
      }
    }

    return {
      id: getBlockId(),
      activity,
      conditions,
      actions,
      continue: hasContinue,
      comments: comments.filter(c => c),
      location: location()
    }
  }

activity =
  _* a:('Show' / 'Hide' / 'Minimal' / 'AlwaysShow') _* comment:inlineComment? eol {
    return a
  }

blockLine =
  _* line:(continueDirective / condition / action) _* comment:inlineComment? lineEnd {
    return line
  }
  / _* comment:commentLine { return null }
  / emptyLineWithNewline { return null }

emptyLineWithNewline = _* newline

newline = '\r\n' / '\n' / '\r'
lineEnd = newline / !.

commentLines = lines:commentLine* { return lines }
commentLine = _* '#' text:$[^\n\r]* eol { return text.trim() }
inlineComment = '#' text:$[^\n\r]* { return text.trim() }

//
// Continue Directive
//
continueDirective = 'Continue' { return { type: 'continue' } }

//
// Conditions - POE2 Specific
//
condition =
    conditionClass
  / conditionBaseType
  / conditionRarity
  / conditionItemLevel
  / conditionAreaLevel
  / conditionDropLevel
  / conditionQuality
  / conditionSockets
  / conditionStackSize
  / conditionGemLevel
  / conditionWaystoneTier
  / conditionUnidentifiedItemTier
  / conditionHeight
  / conditionWidth
  / conditionCorrupted
  / conditionTwiceCorrupted
  / conditionMirrored
  / conditionIdentified
  / conditionAnyEnchantment
  / conditionAlwaysShow
  / conditionHasExplicitMod
  / conditionHasImplicitMod
  / conditionIsVaalUnique
  / conditionHasVaalUniqueMod
  / conditionBaseArmour
  / conditionBaseEvasion
  / conditionBaseEnergyShield

// String array conditions
conditionClass =
  'Class' __ op:(matchOperator __)? vals:stringList {
    return { type: 'condition', name: 'Class', value: { operator: op ? op[0] : '=', values: vals } }
  }

conditionBaseType =
  'BaseType' __ op:(matchOperator __)? vals:stringList {
    return { type: 'condition', name: 'BaseType', value: { operator: op ? op[0] : '=', values: vals } }
  }

conditionHasExplicitMod =
  'HasExplicitMod' __ count:(numOperator _* integer __)? vals:stringList {
    return {
      type: 'condition',
      name: 'HasExplicitMod',
      value: {
        count: count ? { operator: count[0], value: count[2] } : null,
        values: vals
      }
    }
  }

// Numeric conditions
conditionItemLevel =
  'ItemLevel' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'ItemLevel', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionAreaLevel =
  'AreaLevel' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'AreaLevel', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionDropLevel =
  'DropLevel' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'DropLevel', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionQuality =
  'Quality' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'Quality', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionSockets =
  'Sockets' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'Sockets', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionStackSize =
  'StackSize' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'StackSize', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionGemLevel =
  'GemLevel' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'GemLevel', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionWaystoneTier =
  'WaystoneTier' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'WaystoneTier', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionUnidentifiedItemTier =
  'UnidentifiedItemTier' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'UnidentifiedItemTier', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionHeight =
  'Height' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'Height', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionWidth =
  'Width' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'Width', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionBaseArmour =
  'BaseArmour' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'BaseArmour', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionBaseEvasion =
  'BaseEvasion' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'BaseEvasion', value: { operator: op ? op[0] : '=', value: val } }
  }

conditionBaseEnergyShield =
  'BaseEnergyShield' __ op:(numOperator _*)? val:integer {
    return { type: 'condition', name: 'BaseEnergyShield', value: { operator: op ? op[0] : '=', value: val } }
  }

// Boolean conditions
conditionCorrupted =
  'Corrupted' __ val:boolean {
    return { type: 'condition', name: 'Corrupted', value: val }
  }

conditionTwiceCorrupted =
  'TwiceCorrupted' __ val:boolean {
    return { type: 'condition', name: 'TwiceCorrupted', value: val }
  }

conditionMirrored =
  'Mirrored' __ val:boolean {
    return { type: 'condition', name: 'Mirrored', value: val }
  }

conditionIdentified =
  'Identified' __ val:boolean {
    return { type: 'condition', name: 'Identified', value: val }
  }

conditionAnyEnchantment =
  'AnyEnchantment' __ val:boolean {
    return { type: 'condition', name: 'AnyEnchantment', value: val }
  }

conditionAlwaysShow =
  'AlwaysShow' __ val:boolean {
    return { type: 'condition', name: 'AlwaysShow', value: val }
  }

conditionHasImplicitMod =
  'HasImplicitMod' __ val:boolean {
    return { type: 'condition', name: 'HasImplicitMod', value: val }
  }

conditionIsVaalUnique =
  'IsVaalUnique' __ val:boolean {
    return { type: 'condition', name: 'IsVaalUnique', value: val }
  }

conditionHasVaalUniqueMod =
  'HasVaalUniqueMod' __ val:boolean {
    return { type: 'condition', name: 'HasVaalUniqueMod', value: val }
  }

// Rarity condition (special - list of values without quotes)
conditionRarity =
  'Rarity' __ op:(numOperator _*)? vals:rarityList {
    return { type: 'condition', name: 'Rarity', value: { operator: op ? op[0] : '=', values: vals } }
  }

rarityList =
  first:rarity rest:(__ rarity)* {
    return [first, ...rest.map(r => r[1])]
  }

rarity = val:('Normal' / 'Magic' / 'Rare' / 'Unique') { return val }

//
// Actions
//
action =
    actionSetFontSize
  / actionSetTextColor
  / actionSetBorderColor
  / actionSetBackgroundColor
  / actionPlayEffect
  / actionMinimapIcon
  / actionPlayAlertSound
  / actionCustomAlertSound
  / actionDisableDropSound
  / actionEnableDropSound

actionSetFontSize =
  'SetFontSize' __ val:integer &{ return val >= 18 && val <= 45 } {
    return { type: 'action', name: 'SetFontSize', value: val }
  }

actionSetTextColor =
  'SetTextColor' __ val:color {
    return { type: 'action', name: 'SetTextColor', value: val }
  }

actionSetBorderColor =
  'SetBorderColor' __ val:color {
    return { type: 'action', name: 'SetBorderColor', value: val }
  }

actionSetBackgroundColor =
  'SetBackgroundColor' __ val:color {
    return { type: 'action', name: 'SetBackgroundColor', value: val }
  }

actionPlayEffect =
  'PlayEffect' __ col:effectColor temp:(__ 'Temp')? {
    return { type: 'action', name: 'PlayEffect', value: { color: col, temp: !!temp } }
  }

actionMinimapIcon =
  'MinimapIcon' __ size:iconSize __ col:iconColor __ shape:iconShape {
    return { type: 'action', name: 'MinimapIcon', value: { size, color: col, shape } }
  }

actionPlayAlertSound =
  'PlayAlertSound' __ id:soundId vol:(__ integer)? {
    return { type: 'action', name: 'PlayAlertSound', value: { id, volume: vol ? vol[1] : 100 } }
  }

actionCustomAlertSound =
  'CustomAlertSound' __ path:quotedString vol:(__ integer)? {
    return { type: 'action', name: 'CustomAlertSound', value: { path, volume: vol ? vol[1] : 100 } }
  }

actionDisableDropSound =
  'DisableDropSound' val:(__ boolean)? {
    return { type: 'action', name: 'DisableDropSound', value: val ? val[1] : true }
  }

actionEnableDropSound =
  'EnableDropSound' val:(__ boolean)? {
    return { type: 'action', name: 'EnableDropSound', value: val ? val[1] : true }
  }

//
// Values
//
color =
  r:colorComponent __ g:colorComponent __ b:colorComponent a:(__ colorComponent)? {
    return { r, g, b, a: a ? a[1] : 255 }
  }

colorComponent =
  val:integer &{ return val >= 0 && val <= 255 } { return val }

effectColor =
  'Red' / 'Orange' / 'Yellow' / 'Green' / 'Blue' / 'Purple' / 'White' / 'Cyan' / 'Grey' / 'Brown' / 'Pink' / 'Black'

iconSize =
  val:('0' / '1' / '2') {
    return val === '0' ? 'Large' : val === '1' ? 'Medium' : 'Small'
  }

iconColor =
  'Red' / 'Orange' / 'Yellow' / 'Green' / 'Blue' / 'Purple' / 'White' / 'Cyan' / 'Grey' / 'Brown' / 'Pink'

iconShape =
  'Circle' / 'Diamond' / 'Hexagon' / 'Square' / 'Star' / 'Triangle' / 'Cross' / 'Moon' / 'Raindrop' / 'Kite' / 'Pentagon' / 'UpsideDownHouse'

soundId =
  id:$([1-9] [0-9]? / [1-9]) { return parseInt(id, 10) }

stringList =
  first:quotedString rest:(__ quotedString)* {
    return [first, ...rest.map(s => s[1])]
  }

quotedString =
  '"' chars:$[^"\n\r]* '"' { return chars }

//
// Operators
//
numOperator = '<=' / '>=' / '==' / '<' / '>' / '='
matchOperator = '==' / '='

//
// Primitives
//
integer = digits:$[0-9]+ { return parseInt(digits, 10) }
boolean = val:('True' / 'False') { return val === 'True' }

//
// Whitespace & EOL
//
_ = [ \t]
__ = [ \t]+
eol = '\r\n' / '\n' / '\r' / !.
