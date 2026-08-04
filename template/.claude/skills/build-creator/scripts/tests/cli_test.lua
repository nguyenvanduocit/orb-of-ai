local H = require("tests.helper")
local cli = require("cli")
return {
  ["runBuild returns stats and a code"] = function()
    local r = cli.runBuild({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      skills = { { label = "Main", gems = { "Spark 20/20" }, main = 1 } },
    })
    H.truthy(r.code and #r.code > 100, "code returned")
    H.truthy(r.stats.Life and r.stats.Life > 0, "Life computed")
  end,
  ["runAnalyze round-trips a built code"] = function()
    local r = cli.runBuild({ level = 42, class = "Witch" })
    local a = cli.runAnalyze(r.code)
    H.eq(a.class, "Witch", "class")
    H.eq(a.level, 42, "level")
  end,
}
