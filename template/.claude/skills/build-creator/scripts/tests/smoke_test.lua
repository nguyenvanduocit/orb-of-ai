local H = require("tests.helper")
return {
  ["headless wrapper loads and newBuild works"] = function()
    local _p = print; print = function() end
    dofile("HeadlessWrapper.lua")  -- cwd is pob src
    print = _p
    newBuild()
    runCallback("OnFrame")
    H.truthy(build, "build global exists")
    H.truthy(build.calcsTab.mainOutput.Life, "default build has Life")
  end,
}
