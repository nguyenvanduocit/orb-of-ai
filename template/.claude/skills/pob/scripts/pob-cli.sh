#!/bin/bash
# PoB2 CLI wrapper script
# Usage: ./pob-cli.sh <command> [pob-code]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --oauth / --token: fetch a FULL POE2 character via the OAuth client_id=pob PKCE
# flow (the only path that returns POE2 charData incl. passives/skills), then
# export it to a PoB code via PoB's import. Delegates to fetch-oauth.py.
#   pob-cli.sh --oauth [character] [realm]          # interactive authorize once
#   pob-cli.sh --oauth --list [realm]               # list characters
#   pob-cli.sh --token <bearer> <character> [realm] # reuse an existing token
if [ "${1:-}" == "--oauth" ] || [ "${1:-}" == "--token" ]; then
    [ "${1:-}" == "--oauth" ] && shift   # --oauth is just the trigger; --token is parsed by fetch-oauth.py
    for cand in "$SCRIPT_DIR/scripts/fetch-oauth.py" "$SCRIPT_DIR/../../.claude/skills/pob/scripts/scripts/fetch-oauth.py"; do
        [ -f "$cand" ] && exec python3 "$cand" "$@"
    done
    echo "ERROR: fetch-oauth.py not found (looked under skill scripts/ and install ../../)" >&2
    exit 1
fi

cd "$SCRIPT_DIR/src"

export LUA_PATH="$SCRIPT_DIR/runtime/lua/?.lua;$SCRIPT_DIR/runtime/lua/?/init.lua;;"
export LUA_CPATH="$HOME/.luarocks/lib/lua/5.1/?.so;;"

CMD="$1"
POB_CODE="$2"

# If POB_CODE starts with @, read from file
if [[ "$POB_CODE" == @* ]]; then
    POB_FILE="${POB_CODE:1}"
    POB_CODE=$(cat "$POB_FILE")
fi

exec luajit -e "
-- Suppress output during load
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
    elseif t == 'number' then
        if val ~= val or val == math.huge or val == -math.huge then return 'null' end
        return string.format('%.2f', val):gsub('%.?0+\$', '')
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

local function getStats()
    local o = build.calcsTab.mainOutput or {}
    local s = {
        totalDPS = o.TotalDPS, combinedDPS = o.CombinedDPS, speed = o.Speed,
        hitChance = o.HitChance, critChance = o.CritChance, critMultiplier = o.CritMultiplier,
        life = o.Life, energyShield = o.EnergyShield, mana = o.Mana,
        armour = o.Armour, evasion = o.Evasion, block = o.BlockChance,
        fireRes = o.FireResist, coldRes = o.ColdResist, lightningRes = o.LightningResist, chaosRes = o.ChaosResist,
        lifeRegen = o.LifeRegen, manaRegen = o.ManaRegen, manaCost = o.ManaCost,
    }
    for k, v in pairs(s) do if v == nil or v ~= v then s[k] = nil end end
    return s
end

local function getGemLinks()
    local links = {}
    if build.skillsTab and build.skillsTab.socketGroupList then
        for _, g in ipairs(build.skillsTab.socketGroupList) do
            if g.enabled then
                local link = { active = nil, supports = {}, slot = g.slot or g.label or 'Unslotted' }
                -- Get active skill from displaySkillList
                if g.displaySkillList then
                    for _, sk in ipairs(g.displaySkillList) do
                        if sk.activeEffect and sk.activeEffect.grantedEffect then
                            link.active = sk.activeEffect.grantedEffect.name
                            break
                        end
                    end
                end
                -- Get support gems from gemList
                if g.gemList then
                    for _, gem in ipairs(g.gemList) do
                        local name = gem.nameSpec or (gem.grantedEffect and gem.grantedEffect.name)
                        local isSupport = gem.grantedEffect and gem.grantedEffect.support
                        if name and isSupport then
                            table.insert(link.supports, name)
                        end
                    end
                end
                if link.active then
                    table.insert(links, link)
                end
            end
        end
    end
    return links
end

local function getEquipment()
    local equipment = {}
    local slotOrder = {'Weapon 1', 'Weapon 2', 'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Amulet', 'Ring 1', 'Ring 2', 'Belt', 'Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3'}
    if build.itemsTab then
        local slots = build.itemsTab.slots or {}
        local items = build.itemsTab.items or {}
        for _, slotName in ipairs(slotOrder) do
            local slotData = slots[slotName]
            if slotData and slotData.selItemId and slotData.selItemId > 0 then
                local item = items[slotData.selItemId]
                if item then
                    table.insert(equipment, {
                        slot = slotName,
                        name = item.name or 'Unknown',
                        base = item.baseName or item.base,
                        rarity = item.rarity,
                    })
                end
            end
        end
    end
    return equipment
end

local function getKeystones()
    local keystones = {}
    if build.spec and build.spec.allocNodes then
        for _, node in pairs(build.spec.allocNodes) do
            if node.isKeystone and node.name then
                table.insert(keystones, node.name)
            end
        end
        table.sort(keystones)
    end
    return keystones
end

local function getInfo()
    local info = {
        class = build.spec and build.spec.curClassName or 'Unknown',
        ascendancy = build.spec and build.spec.curAscendClassName or 'None',
        level = build.characterLevel or 1,
    }
    return info
end

local function getFullBuild()
    return {
        info = getInfo(),
        stats = getStats(),
        gemLinks = getGemLinks(),
        equipment = getEquipment(),
        keystones = getKeystones(),
    }
end

local cmd = '$CMD'
local pobCode = [==[$POB_CODE]==]

if cmd == 'help' or cmd == '' then
    print('PoB2 CLI - Usage: pob-cli.sh <command> [pob-code]')
    print('Commands: new, stats, info, calc, methods, help')
    os.exit(0)
end

if cmd == 'methods' then
    print('Global functions from HeadlessWrapper:')
    print('  newBuild: ' .. type(newBuild))
    print('  loadBuildFromXML: ' .. type(loadBuildFromXML))
    print('  loadBuildFromJSON: ' .. type(loadBuildFromJSON))
    print('  runCallback: ' .. type(runCallback))
    os.exit(0)
end

if cmd == 'new' then
    newBuild()
    runCallback('OnFrame')
    print(toJSON({ status = 'ok', info = getInfo(), stats = getStats() }))
    os.exit(0)
end

if pobCode == '' then
    io.stderr:write('Error: PoB code required\\n')
    os.exit(1)
end

-- Load build from PoB code
-- PoB codes are URL-safe base64 encoded, zlib compressed XML
local ok, err = pcall(function()
    -- Convert URL-safe base64 to standard base64
    local b64 = pobCode:gsub('-', '+'):gsub('_', '/')
    -- Decode and decompress using PoB's built-in functions
    local decoded = common.base64.decode(b64)
    if not decoded or #decoded == 0 then
        error('Base64 decode failed')
    end
    local xmlText = Inflate(decoded)
    if not xmlText or #xmlText == 0 then
        error('Inflate failed - decoded length: ' .. #decoded)
    end
    loadBuildFromXML(xmlText, 'Imported Build')
end)
runCallback('OnFrame')

if not ok then
    print(toJSON({ status = 'error', error = tostring(err) }))
    os.exit(1)
end

if cmd == 'stats' then
    print(toJSON({ status = 'ok', stats = getStats() }))
elseif cmd == 'info' then
    print(toJSON({ status = 'ok', info = getInfo() }))
elseif cmd == 'calc' then
    local result = getFullBuild()
    result.status = 'ok'
    print(toJSON(result))
else
    io.stderr:write('Unknown command: ' .. cmd .. '\\n')
    os.exit(1)
end
"
