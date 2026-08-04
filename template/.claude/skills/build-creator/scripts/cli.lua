-- build-creator library. Pure module — no process side effects, so tests and
-- main.lua can require it freely. Process dispatch lives in main.lua.
local SCRIPT_DIR = (arg and arg[0] or ""):match("(.*/)") or "./"
package.path = SCRIPT_DIR .. "?.lua;" .. SCRIPT_DIR .. "lib/?.lua;" .. package.path

local engine = require("engine")
local construct = require("construct")
local export = require("export")

local M = {}

function M.runBuild(spec)
  engine.init()
  construct.build(spec)
  return { stats = engine.stats(), code = export.toCode() }
end

function M.runAnalyze(code)
  engine.init()
  local xml = export.decode(code)
  loadBuildFromXML(xml, "analyze")
  engine.commit()
  return {
    stats = engine.stats(),
    class = build.spec and build.spec.curClassName,
    level = build.characterLevel,
  }
end

return M
