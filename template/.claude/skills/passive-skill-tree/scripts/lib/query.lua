-- query.lua — tree-only commands. Read node + class data straight from the
-- bundled PoB tree (build.spec.nodes / build.spec.tree). No calc, no allocation.
-- These reuse PoB as the single tree source, not its calc engine.

local boot = require("lib.bootstrap")
local fmt = require("lib.fmt")

local M = { commands = {}, help = {} }

-- Load the tree once (Witch minimal build — class is irrelevant for node data)
-- and memoise the spec for every command in this module.
local _spec
local function spec()
  if not _spec then _spec = boot.loadForClass(1, "").spec end
  return _spec
end

-- All processed nodes that carry a display name (skips ClassStart/proxy noise
-- for name/stat queries; callers that want everything iterate spec().nodes).
local function namedNodes()
  local out = {}
  for id, n in pairs(spec().nodes) do
    if n.dn and n.dn ~= "" then out[#out + 1] = n end
  end
  return out
end

local function dist(a, b)
  local dx, dy = (a.x or 0) - (b.x or 0), (a.y or 0) - (b.y or 0)
  return math.sqrt(dx * dx + dy * dy)
end

-- lookup <query> — by numeric id (exact) or name substring (case-insensitive).
M.help["lookup"] = "<query>   find node by id or name substring"
M.commands["lookup"] = function(args)
  local q = table.concat(args, " "):lower()
  if q == "" then io.stderr:write("usage: lookup <id|name>\n"); os.exit(1) end
  local results = {}
  for _, n in ipairs(namedNodes()) do
    if tostring(n.id) == q or n.dn:lower():find(q, 1, true) then results[#results + 1] = n end
  end
  if #results == 0 then print("No nodes matching: " .. q); return end
  print(string.format("=== %d node(s) matching '%s' ===\n", #results, q))
  for i = 1, math.min(#results, 25) do
    local n = results[i]
    print(fmt.nodeHeader(n))
    local sd = fmt.statLines(n)
    if sd ~= "" then print(sd) end
    print("")
  end
end

-- nearby <id> [count] — nearest nodes by tree position.
M.help["nearby"] = "<id> [n]  nearest nodes by position"
M.commands["nearby"] = function(args)
  local id = tonumber(args[1]); local count = tonumber(args[2]) or 10
  local target = id and spec().nodes[id]
  if not target then io.stderr:write("node not found: " .. tostring(args[1]) .. "\n"); os.exit(1) end
  local list = {}
  for _, n in ipairs(namedNodes()) do
    if n.id ~= target.id then list[#list + 1] = { node = n, d = dist(target, n) } end
  end
  table.sort(list, function(a, b) return a.d < b.d end)
  print(string.format("=== %d nodes near %s ===\n", count, fmt.nodeHeader(target)))
  for i = 1, math.min(count, #list) do
    local e = list[i]
    print(string.format("%s  (dist %.0f)", fmt.nodeHeader(e.node), e.d))
    local first = (e.node.sd or {})[1]
    if first then print("  " .. first) end
  end
end

-- distance <id1> <id2> — euclidean tree distance.
M.help["distance"] = "<id1> <id2>  position distance between two nodes"
M.commands["distance"] = function(args)
  local a = tonumber(args[1]) and spec().nodes[tonumber(args[1])]
  local b = tonumber(args[2]) and spec().nodes[tonumber(args[2])]
  if not a then io.stderr:write("node not found: " .. tostring(args[1]) .. "\n"); os.exit(1) end
  if not b then io.stderr:write("node not found: " .. tostring(args[2]) .. "\n"); os.exit(1) end
  print(string.format("%s\n  ->\n%s\ndistance: %.1f units", fmt.nodeHeader(a), fmt.nodeHeader(b), dist(a, b)))
end

-- search-stats <text> — nodes whose stat lines contain the text.
M.help["search-stats"] = "<text>   find nodes by stat text"
M.commands["search-stats"] = function(args)
  local q = table.concat(args, " "):lower()
  if q == "" then io.stderr:write("usage: search-stats <text>\n"); os.exit(1) end
  local results = {}
  for _, n in ipairs(namedNodes()) do
    for _, s in ipairs(n.sd or {}) do
      if s:lower():find(q, 1, true) then results[#results + 1] = n; break end
    end
  end
  if #results == 0 then print("No nodes with stat containing: " .. q); return end
  print(string.format("=== %d nodes with '%s' ===\n", #results, q))
  for i = 1, math.min(#results, 25) do
    local n = results[i]
    print(fmt.nodeHeader(n))
    for _, s in ipairs(n.sd or {}) do
      if s:lower():find(q, 1, true) then print("  -> " .. s) end
    end
  end
end

-- types — node-type census.
M.help["types"] = "          node-type counts"
M.commands["types"] = function()
  local c = { Keystone = 0, Notable = 0, Socket = 0, Mastery = 0, Normal = 0, other = 0 }
  local total = 0
  for _, n in pairs(spec().nodes) do
    total = total + 1
    local t = n.type
    if c[t] ~= nil then c[t] = c[t] + 1 else c.other = c.other + 1 end
  end
  print("=== Tree census (" .. boot.TREE_VERSION .. ") ===")
  print("Total nodes:   " .. total)
  print("Keystones:     " .. c.Keystone)
  print("Notables:      " .. c.Notable)
  print("Jewel Sockets: " .. c.Socket)
  print("Masteries:     " .. c.Mastery)
  print("Small/normal:  " .. (c.Normal + c.other))
end

-- classes — roster annotated with the GGG classInternalId + ascendancy tokens,
-- read straight from tree.classes[].integerId / .classes[].internalId (exactly
-- the values PoB writes into PoB2 XML). Use these in build-creator specs.
M.help["classes"] = "          classes with classInternalId + ascendancy tokens"
M.commands["classes"] = function()
  local tree = spec().tree
  local list = {}
  for _, cls in pairs(tree.classes) do list[#list + 1] = cls end
  table.sort(list, function(a, b) return (a.integerId or 99) < (b.integerId or 99) end)
  print("=== Classes ===")
  print("format: <name> [classInternalId=N] -> <ascendancy> (ascendancyInternalId)\n")
  for _, cls in ipairs(list) do
    print(string.format("%s [classInternalId=%s]", cls.name, tostring(cls.integerId)))
    for ascId, asc in pairs(cls.classes or {}) do
      if asc.name and asc.name ~= "None" then
        print(string.format("  -> %s (%s)", asc.name, tostring(asc.internalId or ascId)))
      end
    end
  end
end

-- ascendancies <class> — ascendancy tokens for one class.
M.help["ascendancies"] = "<class>  ascendancy tokens for a class"
M.commands["ascendancies"] = function(args)
  if not args[1] then io.stderr:write("usage: ascendancies <class>\n"); os.exit(1) end
  local found = boot.findClass(spec().tree, table.concat(args, " "))
  if not found then print("class not found: " .. table.concat(args, " ")); return end
  print(string.format("=== %s ascendancies [classInternalId=%s] ===\n", found.cls.name, tostring(found.cls.integerId)))
  for ascId, asc in pairs(found.cls.classes or {}) do
    if asc.name and asc.name ~= "None" then
      print(string.format("%s: %s", tostring(asc.internalId or ascId), asc.name))
    end
  end
end

-- export — all nodes as JSON (id, name, type, pos, stats, ascendancy).
M.help["export"] = "          dump all nodes as JSON"
M.commands["export"] = function()
  local out = {}
  for id, n in pairs(spec().nodes) do
    out[tostring(id)] = {
      name = n.dn or n.name,
      type = fmt.nodeType(n),
      x = n.x and math.floor(n.x + 0.5) or 0,
      y = n.y and math.floor(n.y + 0.5) or 0,
      ascendancy = n.ascendancyName,
      stats = n.sd or {},
    }
  end
  print(fmt.json(out))
end

return M
