local H = require("tests.helper")
local engine = require("engine")
return {
  ["init loads wrapper once and stats reads mainOutput"] = function()
    engine.init()
    engine.newBuild()
    engine.commit()
    local s = engine.stats()
    H.truthy(s.Life and s.Life > 0, "Life present after commit")
  end,
  ["assertClass passes for the selected class"] = function()
    engine.init(); engine.newBuild()
    engine.selectClass("Witch")
    engine.commit()
    engine.assertClass("Witch")  -- must not error
  end,
  ["assertClass errors on mismatch"] = function()
    engine.init(); engine.newBuild()
    engine.selectClass("Witch")
    local ok = pcall(function() engine.assertClass("Ranger") end)
    H.eq(ok, false, "assertClass should error on wrong class")
  end,
}
