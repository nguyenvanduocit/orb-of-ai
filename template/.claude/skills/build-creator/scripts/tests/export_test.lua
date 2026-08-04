local H = require("tests.helper")
local engine = require("engine")
local export = require("export")
return {
  ["code is url-safe base64 and round-trips class/level"] = function()
    engine.init(); engine.newBuild()
    engine.selectClass("Witch")
    engine.setLevel(30)
    engine.commit()
    local code = export.toCode()
    H.truthy(#code > 100, "code is non-trivial length")
    H.eq(code:find("[+/]"), nil, "code has no + or / (url-safe)")

    -- round-trip: decode → inflate → reload → same class/level
    local xml = export.decode(code)
    H.truthy(xml:find("<PathOfBuilding2>", 1, true), "root tag present")
    loadBuildFromXML(xml, "rt"); engine.commit()
    H.eq(build.spec.curClassName, "Witch", "class round-trips")
    H.eq(build.characterLevel, 30, "level round-trips")
  end,
}
