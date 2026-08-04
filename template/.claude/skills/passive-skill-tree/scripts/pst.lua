-- pst.lua — thin entry point. Parses argv, merges the command registry from each
-- command module, dispatches. No logic lives here; adding a command means adding
-- it to a module's `commands` table (or adding a new module to MODULES below).
--
-- Invoked by pst.sh with cwd = data/pob-source/src and LUA_PATH including the
-- skill scripts dir (so `require("lib.x")` and `require("commands.x")` resolve).

local MODULES = {
  require("lib.query"),
  require("lib.path"),
  require("lib.calc"),
}

-- Merge per-module command + help tables into flat registries.
local commands, help = {}, {}
for _, mod in ipairs(MODULES) do
  for name, fn in pairs(mod.commands or {}) do commands[name] = fn end
  for name, desc in pairs(mod.help or {}) do help[name] = desc end
end

local function usage()
  print("POE2 Passive Skill Tree (PoB-backed) — pst.sh <command> [args]\n")
  local names = {}
  for name in pairs(commands) do names[#names + 1] = name end
  table.sort(names)
  for _, name in ipairs(names) do
    print(string.format("  %-14s %s", name, help[name] or ""))
  end
  print("\nData source: bundled pob-source tree (single source of truth with the PoB calc engine).")
end

local cmd = arg[1]
if not cmd or cmd == "help" or cmd == "-h" or cmd == "--help" then
  usage()
  os.exit(cmd and 0 or 1)
end

local handler = commands[cmd]
if not handler then
  io.stderr:write("Unknown command: " .. cmd .. "\n")
  usage()
  os.exit(1)
end

-- Pass the remaining argv (everything after the command name) to the handler.
local args = {}
for i = 2, #arg do args[#args + 1] = arg[i] end
handler(args)
