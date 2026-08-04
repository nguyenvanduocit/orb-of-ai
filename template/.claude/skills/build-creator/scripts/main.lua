-- build-creator process entry. Invoked by run.sh as `luajit main.lua <cmd> [args]`.
-- Parses argv, dispatches to the cli library, prints JSON. Kept separate from
-- cli.lua so the library can be required by tests without side effects.
local SCRIPT_DIR = (arg and arg[0] or ""):match("(.*/)") or "./"
package.path = SCRIPT_DIR .. "?.lua;" .. SCRIPT_DIR .. "lib/?.lua;" .. package.path

local function die(msg) io.stderr:write(msg .. "\n"); os.exit(1) end

-- cwd is the PoB src dir, but spec paths are relative to where the user ran
-- run.sh. Resolve non-absolute paths against the preserved invocation dir.
local INVOKE_DIR = os.getenv("BC_INVOKE_DIR")
local function resolve(p)
  if p:sub(1, 1) == "/" or not INVOKE_DIR then return p end
  return INVOKE_DIR .. "/" .. p
end
local function readFile(p)
  local f = assert(io.open(resolve(p), "r"), "cannot open spec: " .. p)
  local s = f:read("*a"); f:close(); return s
end

local cmd = arg[1]

if cmd == "test" then
  dofile(SCRIPT_DIR .. "tests/all.lua")
  return
end

local cli = require("cli")
local json = require("json")

if cmd == "build" then
  local specPath = arg[2] or die("usage: run.sh build <spec.json> [--publish]")
  local spec = json.decode(readFile(specPath))
  local r = cli.runBuild(spec)
  if arg[3] == "--publish" then
    r.published = require("publish").toPobbin(r.code)
  end
  print(json.encode({ status = "ok", stats = r.stats, code = r.code, published = r.published }))
elseif cmd == "analyze" then
  local code = arg[2] or die("usage: run.sh analyze <pob-code>")
  print(json.encode({ status = "ok", analyze = cli.runAnalyze(code) }))
elseif cmd == "optimize" then
  local specPath = arg[2] or die("usage: run.sh optimize <spec.json>")
  local spec = json.decode(readFile(specPath))
  print(json.encode({ status = "ok", result = require("optimize").run(spec) }))
else
  die("usage: run.sh <test|build|analyze|optimize> [args]")
end
