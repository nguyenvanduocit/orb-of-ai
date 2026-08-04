-- Substrate over PoB2 HeadlessWrapper. Loads the engine once, then exposes
-- thin helpers over the live `build` object. cwd must be the pob src dir.
local engine = {}
local loaded = false

local METRIC_KEYS = {
  "Life", "EnergyShield", "Mana", "Armour", "Evasion",
  "TotalDPS", "CombinedDPS", "FullDPS", "TotalEHP",
  "FireResist", "ColdResist", "LightningResist", "ChaosResist",
}

function engine.init()
  if loaded then return end
  local _p = print; print = function() end
  dofile("HeadlessWrapper.lua")
  print = _p
  loaded = true
end

function engine.newBuild() newBuild() end

-- Recompute the build. Forces build.buildFlag so OnFrame actually re-runs the
-- calc — PassiveSpec:AllocNode and friends mutate state WITHOUT setting the flag
-- (Build.lua:OnFrame early-outs when it is false), so a commit after a tree/gem
-- mutation would otherwise be a no-op and every optimizer candidate would read a
-- stale metric and get rejected. mainOutput is replaced each frame, so callers
-- must re-read it via engine.stats()/engine.out() after commit — never cache it.
function engine.commit()
  build.buildFlag = true
  runCallback("OnFrame")
end

function engine.out() return build.calcsTab.mainOutput or {} end

function engine.stats()
  local o = engine.out()
  local s = {}
  for _, k in ipairs(METRIC_KEYS) do
    local v = o[k]
    if type(v) == "number" and v == v then s[k] = v end
  end
  return s
end

-- Resolve a class display name to its classId key in build.spec.tree.classes.
function engine.classIdByName(name)
  for classId, class in pairs(build.spec.tree.classes) do
    if class.name == name then return classId end
  end
  return nil
end

-- Set an explicit character level. MUST disable characterLevelAutoMode, else
-- OnFrame re-derives the level from gems/tree (Build.lua:845-846) and our value
-- is silently overwritten on the next commit.
function engine.setLevel(n)
  build.characterLevelAutoMode = false
  build.characterLevel = math.max(1, math.min(100, n))
end

function engine.selectClass(name)
  local id = engine.classIdByName(name)
  if not id then error("engine: unknown class '" .. tostring(name) .. "'") end
  build.spec:SelectClass(id)
end

function engine.assertClass(expected)
  local actual = build.spec and build.spec.curClassName
  if actual ~= expected then
    error("engine.assertClass: expected class '" .. tostring(expected)
      .. "', build resolved '" .. tostring(actual) .. "'")
  end
end

return engine
