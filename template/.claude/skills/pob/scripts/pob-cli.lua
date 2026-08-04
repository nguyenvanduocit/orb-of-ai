#!/usr/bin/env luajit
-- PoB2 CLI - Command line interface for Path of Building 2
-- Usage: ./pob-cli.lua <command> [args]
--
-- Commands:
--   stats <pob-code>     - Load build from PoB code and output stats
--   info <pob-code>      - Show build overview (class, skills, items)
--   calc <pob-code>      - Full calculation output
--   help                 - Show this help

-- Change to src directory for proper loading
local scriptPath = arg[0]:match("(.*/)")
if scriptPath then
    local srcPath = scriptPath .. "src"
    package.path = srcPath .. "/?.lua;" .. scriptPath .. "runtime/lua/?.lua;" .. scriptPath .. "runtime/lua/?/init.lua;" .. package.path
    -- Change working directory
    local lfs = pcall(require, "lfs")
    if lfs then require("lfs").chdir(srcPath) end
end

-- Suppress print during loading
local originalPrint = print
local suppressOutput = true
print = function(...)
    if not suppressOutput then
        originalPrint(...)
    end
end

-- Load HeadlessWrapper
dofile("src/HeadlessWrapper.lua")

-- Restore print
print = originalPrint

-- JSON encoder (simple)
local function toJSON(val, indent)
    indent = indent or 0
    local spaces = string.rep("  ", indent)
    local t = type(val)

    if t == "nil" then
        return "null"
    elseif t == "boolean" then
        return val and "true" or "false"
    elseif t == "number" then
        if val ~= val then return "null" end -- NaN
        if val == math.huge or val == -math.huge then return "null" end
        return string.format("%.2f", val):gsub("%.?0+$", "")
    elseif t == "string" then
        return '"' .. val:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n') .. '"'
    elseif t == "table" then
        local isArray = #val > 0
        local parts = {}
        if isArray then
            for i, v in ipairs(val) do
                table.insert(parts, toJSON(v, indent + 1))
            end
            return "[\n" .. spaces .. "  " .. table.concat(parts, ",\n" .. spaces .. "  ") .. "\n" .. spaces .. "]"
        else
            for k, v in pairs(val) do
                if type(k) == "string" then
                    table.insert(parts, '"' .. k .. '": ' .. toJSON(v, indent + 1))
                end
            end
            table.sort(parts)
            if #parts == 0 then return "{}" end
            return "{\n" .. spaces .. "  " .. table.concat(parts, ",\n" .. spaces .. "  ") .. "\n" .. spaces .. "}"
        end
    else
        return "null"
    end
end

-- Extract key stats from build
local function getStats()
    local output = build.calcsTab.mainOutput or {}
    local stats = {
        -- Offence
        totalDPS = output.TotalDPS,
        totalDot = output.TotalDot,
        combinedDPS = output.CombinedDPS,
        speed = output.Speed,
        hitChance = output.HitChance,
        critChance = output.CritChance,
        critMultiplier = output.CritMultiplier,

        -- Defence
        life = output.Life,
        energyShield = output.EnergyShield,
        mana = output.Mana,
        armour = output.Armour,
        evasion = output.Evasion,
        block = output.BlockChance,
        spellBlock = output.SpellBlockChance,

        -- Resistances
        fireRes = output.FireResist,
        coldRes = output.ColdResist,
        lightningRes = output.LightningResist,
        chaosRes = output.ChaosResist,

        -- Resources
        lifeRegen = output.LifeRegen,
        manaRegen = output.ManaRegen,
        esRegen = output.EnergyShieldRegen,

        -- Costs
        manaCost = output.ManaCost,
        lifeCost = output.LifeCost,
        spiritReserved = output.SpiritReservedPercent,
    }

    -- Clean nil values
    for k, v in pairs(stats) do
        if v == nil or v ~= v then stats[k] = nil end
    end

    return stats
end

-- Get build overview
local function getBuildInfo()
    local info = {
        class = build.spec and build.spec.curClassName or "Unknown",
        ascendancy = build.spec and build.spec.curAscendClassName or "None",
        level = build.characterLevel or 1,
    }

    -- Get active skills
    info.skills = {}
    if build.skillsTab and build.skillsTab.socketGroupList then
        for _, group in ipairs(build.skillsTab.socketGroupList) do
            if group.enabled and group.displaySkillList then
                for _, skill in ipairs(group.displaySkillList) do
                    if skill.activeEffect and skill.activeEffect.grantedEffect then
                        table.insert(info.skills, {
                            name = skill.activeEffect.grantedEffect.name,
                            level = skill.level or 1,
                        })
                    end
                end
            end
        end
    end

    -- Get equipped items
    info.items = {}
    if build.itemsTab and build.itemsTab.items then
        for slotName, item in pairs(build.itemsTab.items) do
            if item and item.name then
                table.insert(info.items, {
                    slot = slotName,
                    name = item.name,
                    rarity = item.rarity or "Normal",
                })
            end
        end
    end

    return info
end

-- Load build from PoB code
local function loadBuild(pobCode)
    if not pobCode or pobCode == "" then
        return false, "No PoB code provided"
    end

    -- PoB codes are base64 encoded, zlib compressed XML
    -- The loadBuildFromXML function expects decoded XML
    -- We need to decode and decompress first

    -- Try loading via import tab
    newBuild()

    -- The import is handled internally by PoB
    local success, err = pcall(function()
        build.importTab:ImportPobCode(pobCode)
    end)

    if not success then
        return false, "Failed to import: " .. tostring(err)
    end

    runCallback("OnFrame")
    return true
end

-- Main CLI handler
local function main()
    local command = arg[1]
    local pobCode = arg[2]

    if not command or command == "help" or command == "-h" or command == "--help" then
        print([[
PoB2 CLI - Path of Building 2 Command Line Interface

Usage: pob-cli.lua <command> [pob-code]

Commands:
  stats <pob-code>   Load build and output key stats as JSON
  info <pob-code>    Show build overview (class, skills, items)
  calc <pob-code>    Full calculation output
  new                Create empty build and show default stats
  help               Show this help

Examples:
  ./pob-cli.lua stats "eNrtVd1u2z..."
  ./pob-cli.lua info "eNrtVd1u2z..."
  ./pob-cli.lua new
]])
        return
    end

    if command == "new" then
        newBuild()
        runCallback("OnFrame")
        print(toJSON({
            status = "ok",
            info = getBuildInfo(),
            stats = getStats(),
        }))
        return
    end

    if command == "stats" or command == "info" or command == "calc" then
        if not pobCode then
            io.stderr:write("Error: PoB code required\n")
            os.exit(1)
        end

        local ok, err = loadBuild(pobCode)
        if not ok then
            print(toJSON({ status = "error", error = err }))
            os.exit(1)
        end

        if command == "stats" then
            print(toJSON({
                status = "ok",
                stats = getStats(),
            }))
        elseif command == "info" then
            print(toJSON({
                status = "ok",
                info = getBuildInfo(),
            }))
        elseif command == "calc" then
            print(toJSON({
                status = "ok",
                info = getBuildInfo(),
                stats = getStats(),
            }))
        end
        return
    end

    io.stderr:write("Unknown command: " .. command .. "\n")
    os.exit(1)
end

-- Run
suppressOutput = true
main()
