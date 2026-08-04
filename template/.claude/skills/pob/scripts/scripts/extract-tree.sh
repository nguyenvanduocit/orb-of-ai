#!/bin/bash
# Extract passive skill tree from POB code
# Usage: extract-tree.sh <url-or-pobcode-file> [format]
#
# Formats: json (default), summary, nodes

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
POB2_DIR="$SKILL_DIR/pob"

INPUT="$1"
FORMAT="${2:-json}"

if [ -z "$INPUT" ]; then
    echo "Usage: extract-tree.sh <url-or-file> [format]"
    echo ""
    echo "Extracts passive skill tree from a POB build."
    echo ""
    echo "Input:"
    echo "  URL from mobalytics.gg, poe.ninja, or pobb.in"
    echo "  Or @file with raw POB code"
    echo ""
    echo "Formats:"
    echo "  json    - Full JSON with all nodes (default)"
    echo "  summary - Counts and key nodes only"
    echo "  nodes   - List all node names grouped by type"
    exit 1
fi

# Check POB2 installation
if [ ! -d "$POB2_DIR" ]; then
    echo "ERROR: POB2 not installed. Run setup.sh first:" >&2
    exit 1
fi

# Get POB code
if [[ "$INPUT" == @* ]]; then
    POB_CODE=$(cat "${INPUT:1}")
elif [[ "$INPUT" == *"://"* ]]; then
    # Use analyze.sh logic to fetch
    TEMP_FILE=$(mktemp)
    trap "rm -f $TEMP_FILE" EXIT
    "$SCRIPT_DIR/analyze.sh" "$INPUT" info >/dev/null 2>&1 || true
    # Re-fetch the POB code
    MOBALYTICS_DIR="$SKILL_DIR/../mobalytics"
    if [[ "$INPUT" == *"mobalytics.gg"* ]]; then
        YAML=$("$MOBALYTICS_DIR/fetch.sh" "$INPUT" 2>/dev/null)
        POB_CODE=$(echo "$YAML" | awk '/^pobCode:/{found=1; next} found && /^[a-zA-Z]/{exit} found{gsub(/^  /, ""); print}' | tr -d '\n')
    elif [[ "$INPUT" == *"poe.ninja"* ]]; then
        "$SCRIPT_DIR/fetch-poeninja.sh" "$INPUT" "$TEMP_FILE" 2>/dev/null
        POB_CODE=$(cat "$TEMP_FILE")
    elif [[ "$INPUT" == *"pobb.in"* ]]; then
        CODE=$(echo "$INPUT" | sed -E 's|.*pobb\.in/([^/?]+).*|\1|')
        POB_CODE=$(curl -s "https://pobb.in/api/pob/$CODE" | jq -r '.pobCode // empty')
    fi
else
    POB_CODE=$(cat "$INPUT")
fi

if [ -z "$POB_CODE" ]; then
    echo "ERROR: Could not get POB code" >&2
    exit 1
fi

cd "$POB2_DIR/src"
export LUA_PATH="$POB2_DIR/runtime/lua/?.lua;$POB2_DIR/runtime/lua/?/init.lua;;"
export LUA_CPATH="$HOME/.luarocks/lib/lua/5.1/?.so;;"

luajit -e "
local _print = print
print = function() end
dofile('HeadlessWrapper.lua')
print = _print

local function toJSON(val, indent)
    indent = indent or 0
    local spaces = string.rep('  ', indent)
    local t = type(val)
    if t == 'nil' then return 'null'
    elseif t == 'boolean' then return val and 'true' or 'false'
    elseif t == 'number' then return tostring(val)
    elseif t == 'string' then
        return '\"' .. val:gsub('\\\\', '\\\\\\\\'):gsub('\"', '\\\\\"'):gsub('\\n', '\\\\n') .. '\"'
    elseif t == 'table' then
        local parts = {}
        local isArray = #val > 0
        if isArray then
            for _, v in ipairs(val) do table.insert(parts, toJSON(v, indent + 1)) end
            if #parts == 0 then return '[]' end
            return '[\\n' .. spaces .. '  ' .. table.concat(parts, ',\\n' .. spaces .. '  ') .. '\\n' .. spaces .. ']'
        else
            for k, v in pairs(val) do
                if type(k) == 'string' then table.insert(parts, '\"' .. k .. '\": ' .. toJSON(v, indent + 1)) end
            end
            table.sort(parts)
            if #parts == 0 then return '{}' end
            return '{\\n' .. spaces .. '  ' .. table.concat(parts, ',\\n' .. spaces .. '  ') .. '\\n' .. spaces .. '}'
        end
    end
    return 'null'
end

local pobCode = [==[$POB_CODE]==]
local format = '$FORMAT'

local b64 = pobCode:gsub('-', '+'):gsub('_', '/')
local decoded = common.base64.decode(b64)
local xmlText = Inflate(decoded)
loadBuildFromXML(xmlText, 'Build')
runCallback('OnFrame')

local tree = {
    class = build.spec.curClassName,
    ascendancy = build.spec.curAscendClassName,
    totalNodes = 0,
    keystones = {},
    notables = {},
    smallNodes = {},
    ascendancyNodes = {},
    masteries = {},
}

-- Collect all allocated nodes
for nodeId, node in pairs(build.spec.allocNodes or {}) do
    tree.totalNodes = tree.totalNodes + 1
    local entry = {
        id = nodeId,
        name = node.name or 'Unknown',
        mods = {},
    }
    if node.sd then
        for _, mod in ipairs(node.sd) do
            table.insert(entry.mods, mod)
        end
    end

    -- Categorize by type
    if node.isKeystone then
        table.insert(tree.keystones, entry)
    elseif node.isAscendancyStart or (node.ascendancyName and node.ascendancyName ~= '') then
        table.insert(tree.ascendancyNodes, entry)
    elseif node.isNotable then
        table.insert(tree.notables, entry)
    else
        table.insert(tree.smallNodes, entry)
    end
end

-- Collect mastery selections
for nodeId, effectId in pairs(build.spec.masterySelections or {}) do
    local node = build.spec.allocNodes[nodeId]
    if node then
        table.insert(tree.masteries, {
            nodeId = nodeId,
            effectId = effectId,
            name = node.name or 'Unknown',
        })
    end
end

-- Sort by name
table.sort(tree.keystones, function(a,b) return a.name < b.name end)
table.sort(tree.notables, function(a,b) return a.name < b.name end)
table.sort(tree.ascendancyNodes, function(a,b) return a.name < b.name end)

if format == 'json' then
    print(toJSON(tree))
elseif format == 'summary' then
    print('Class: ' .. tree.class .. ' (' .. tree.ascendancy .. ')')
    print('Total Nodes: ' .. tree.totalNodes)
    print('')
    print('Keystones (' .. #tree.keystones .. '):')
    for _, k in ipairs(tree.keystones) do print('  - ' .. k.name) end
    print('')
    print('Notables (' .. #tree.notables .. '):')
    for _, n in ipairs(tree.notables) do print('  - ' .. n.name) end
    print('')
    print('Ascendancy Nodes (' .. #tree.ascendancyNodes .. '):')
    for _, a in ipairs(tree.ascendancyNodes) do print('  - ' .. a.name) end
elseif format == 'nodes' then
    print('=== Keystones ===')
    for _, k in ipairs(tree.keystones) do
        print(k.name)
        for _, mod in ipairs(k.mods) do print('  ' .. mod) end
    end
    print('')
    print('=== Notables ===')
    for _, n in ipairs(tree.notables) do
        print(n.name)
        for _, mod in ipairs(n.mods) do print('  ' .. mod) end
    end
    print('')
    print('=== Ascendancy ===')
    for _, a in ipairs(tree.ascendancyNodes) do
        print(a.name)
        for _, mod in ipairs(a.mods) do print('  ' .. mod) end
    end
end
"
