local H = require("tests.helper")
local engine = require("engine")
local optimize = require("optimize")
return {
  ["node optimization never lowers the target metric"] = function()
    engine.init()
    -- Base: Witch with a skill so DPS is non-zero.
    local construct = require("construct")
    construct.build({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      skills = { { label = "Main", gems = { "Spark 20/20" }, main = 1 } },
    })
    local startId = build.spec.curClass.startNodeId
    local candidates = {}
    for _, n in ipairs(build.spec.nodes[startId].linked or {}) do
      if n.id and n.type ~= "ClassStart" and not n.isAscendancyStart then
        candidates[#candidates + 1] = n.id
      end
    end

    local r = optimize.run({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      skills = { { label = "Main", gems = { "Spark 20/20" }, main = 1 } },
      optimize = { target = "TotalDPS", tryNodes = candidates },
    })
    H.truthy(r.after >= r.before - 1e-6, "target never decreased: "
      .. tostring(r.before) .. " -> " .. tostring(r.after))
    H.truthy(r.code and #r.code > 100, "returns a final code")
  end,
  ["optimizer accepts a node that actually raises the target"] = function()
    engine.init()
    -- Node 4739 = "Spell Damage" (+8% increased Spell Damage), adjacent to the
    -- Witch start. With a Spark spell as main skill it raises TotalDPS, so a
    -- correct greedy optimizer MUST keep it. This is the positive proof that the
    -- optimizer improves builds, not merely "doesn't make them worse".
    local r = optimize.run({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      skills = { { label = "Main", gems = { "Spark 20/20" }, main = 1 } },
      optimize = { target = "TotalDPS", tryNodes = { 4739 } },
    })
    H.truthy(#r.keptNodes >= 1, "kept the improving node")
    H.truthy(r.after > r.before, "metric increased: "
      .. tostring(r.before) .. " -> " .. tostring(r.after))
  end,
}
