#!/usr/bin/env luajit
-- export-pob.lua — turn a GGG character-API JSON into a PoB2 import code by
-- reusing Path of Building's OWN import + export Lua. No network here: the JSON
-- is fetched separately (playwriter browser-session / OAuth / pathofexile2.com
-- internal-api). Reusing PoB's code path is the ban-safe principle — we never
-- hand-roll item/passive parsing or the code serializer.
--
-- Run with cwd = data/pob-source/src (export-pob.sh sets this up).
-- Usage: luajit export-pob.lua <charData.json>
--
-- Input shapes accepted (auto-normalised to the inner charData object):
--   • OAuth        api.pathofexile.com/character/poe2/<name>  -> { character: {...} }
--   • internal-api pathofexile2.com .../character/<id>         -> { data: {...} }
--   • bare charData                                            -> {...}
-- charData needs `.equipment` for items/skills; `.passives` (+ `.jewels`) for tree.
--
-- Output (stdout, JSON):
--   { status, code, imported: { items, passives, errItems?, errPassives? },
--     info: { class, ascendancy, level }, stats: {...} }
-- `code` is a URL-safe base64 PoB2 import code — feed it to `pob-cli.sh calc @file`.

-- Capture the file arg BEFORE loading the engine — PoB's Launch.lua rewrites the
-- global `arg`, so reading it after dofile() would come back empty.
local path = arg[1]
if not path or path == "" then
	io.stderr:write("Usage: export-pob.lua <charData.json>\n")
	os.exit(1)
end

-- ── Load the headless engine (cwd is src) ───────────────────────────────────
local _print = print
print = function() end
dofile("HeadlessWrapper.lua")
print = _print

local dkjson = require("dkjson")

-- ── Read + decode the character JSON ────────────────────────────────────────
local fh = io.open(path, "r")
if not fh then
	print('{"status":"error","error":"cannot open '..path..'"}')
	os.exit(1)
end
local raw = fh:read("*a")
fh:close()

local decoded, _, derr = dkjson.decode(raw)
if type(decoded) ~= "table" then
	print('{"status":"error","error":"JSON decode failed: '..tostring(derr)..'"}')
	os.exit(1)
end

-- Normalise to the inner charData object (the one carrying .equipment / .passives).
local charData = decoded.character or decoded.data or decoded

-- Default optional arrays the OAuth shape always carries but partial sources
-- (e.g. the pathofexile2.com internal-api, which returns equipment only) omit.
-- PoB's ImportItemsAndSkills iterates charData.skills unconditionally; a missing
-- array would crash pairs(). This is input normalisation, not a logic change.
charData.skills = charData.skills or {}
charData.jewels = charData.jewels or {}

-- ── Reuse PoB's import functions ────────────────────────────────────────────
newBuild()

local imported = { items = false, passives = false }

if charData.equipment then
	local ok, err = pcall(function() build.importTab:ImportItemsAndSkills(charData) end)
	imported.items = ok
	if not ok then imported.errItems = tostring(err) end
end

if charData.passives then
	local ok, err = pcall(function() build.importTab:ImportPassiveTreeAndJewels(charData) end)
	imported.passives = ok
	if not ok then imported.errPassives = tostring(err) end
end

-- Settle the calc: import sets buildFlag, but mainOutput only refreshes on the
-- next frame — read one frame early and stats (e.g. Life) come back transient.
build.buildFlag = true
runCallback("OnFrame")
runCallback("OnFrame")

-- ── Export to a PoB code (reuse PoB serializer + zlib Deflate patch) ─────────
local code
local okc, errc = pcall(function()
	code = common.base64.encode(Deflate(build:SaveDB("code"))):gsub("+", "-"):gsub("/", "_")
end)
if not okc or not code or code == "" then
	print('{"status":"error","error":"export (SaveDB/Deflate) failed: '..tostring(errc)..'"}')
	os.exit(1)
end

-- ── Minimal stat readout for at-a-glance verification ───────────────────────
local function getStats()
	local o = build.calcsTab.mainOutput or {}
	local s = {
		combinedDPS = o.CombinedDPS, totalDPS = o.TotalDPS, speed = o.Speed,
		life = o.Life, energyShield = o.EnergyShield, mana = o.Mana,
		armour = o.Armour, evasion = o.Evasion,
		fireRes = o.FireResist, coldRes = o.ColdResist,
		lightningRes = o.LightningResist, chaosRes = o.ChaosResist,
	}
	for k, v in pairs(s) do if v == nil or v ~= v then s[k] = nil end end
	return s
end

local out = {
	status = "ok",
	code = code,
	imported = imported,
	info = {
		class = build.spec and build.spec.curClassName or "Unknown",
		ascendancy = build.spec and build.spec.curAscendClassName or "None",
		level = build.characterLevel or 1,
	},
	stats = getStats(),
}

print(dkjson.encode(out, { indent = true }))
