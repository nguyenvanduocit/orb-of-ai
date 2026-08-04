-- path.lua — pathing + allocation validation backed by PoB's PassiveSpec.
-- Reuses GetAllocationPath (real Dijkstra over the tree, allocMode-aware,
-- handles intuitive-leap-likes) and node.linked (PoB's own adjacency) so results
-- match the calc engine instead of a re-derived BFS graph.

local boot = require("lib.bootstrap")
local fmt = require("lib.fmt")

local M = { commands = {}, help = {} }

-- BFS through ONLY the allocated nodes, starting from `start`, over PoB's
-- node.linked adjacency. Returns the set of reachable allocated node ids — the
-- same connectivity the calc engine honours (orphan allocated nodes contribute
-- nothing). `restrict` (optional) keeps traversal inside one ascendancy graph.
local function reachableAlloc(spec, start, restrict)
  local seen = { [start.id] = true }
  local queue = { start }
  local o = 1
  while queue[o] do
    local node = queue[o]; o = o + 1
    for _, other in ipairs(node.linked) do
      if other.alloc and not seen[other.id] and (not restrict or restrict(other)) then
        seen[other.id] = true
        queue[#queue + 1] = other
      end
    end
  end
  return seen
end

-- path <from> <to> — shortest allocation route between two nodes, via PoB.
-- Allocates `from` (which pulls in its own connecting path from the class start),
-- then asks PoB for the route to `to`. Class-aware and exclusion-aware.
M.help["path"] = "<from> <to>  shortest allocation route (PoB pathing)"
M.commands["path"] = function(args)
  local fromId, toId = tonumber(args[1]), tonumber(args[2])
  if not fromId or not toId then io.stderr:write("usage: path <from-id> <to-id>\n"); os.exit(1) end
  local spec = boot.loadForClass(1, "").spec
  local from, to = spec.nodes[fromId], spec.nodes[toId]
  if not from then io.stderr:write("node not found: " .. fromId .. "\n"); os.exit(1) end
  if not to then io.stderr:write("node not found: " .. toId .. "\n"); os.exit(1) end

  spec:AllocNode(from)
  local route = spec:GetAllocationPath(to)
  if not route then print("No path found (disconnected, or different ascendancy graph)."); return end

  -- GetAllocationPath returns target-first; reverse for from->to reading.
  local ordered = {}
  for i = #route, 1, -1 do ordered[#ordered + 1] = route[i] end
  print(string.format("=== Path %s -> %s ===", fmt.nodeHeader(from), fmt.nodeHeader(to)))
  print(string.format("%d nodes to connect %s onward to %s:\n", #route, from.dn or fromId, to.dn or toId))
  for _, n in ipairs(ordered) do
    print("  " .. fmt.nodeHeader(n))
  end
end

-- validate <class> <nodes...> — does every allocated node connect back to its
-- start? Main-tree nodes -> class start; ascendancy nodes -> their ascendancy
-- start (disjoint graphs). Reports orphans + passive/ascendancy point cost.
M.help["validate"] = "<class> <nodes...>  check allocation connectivity + point cost"
M.commands["validate"] = function(args)
  if #args < 2 then io.stderr:write("usage: validate <class> <node-id...>\n"); os.exit(1) end
  local className = args[1]

  -- Resolve the class to its GGG integerId via a throwaway tree load, then
  -- reload with that class + the requested nodes baked into the XML so PoB's
  -- own ImportFromNodeList allocates them and builds paths.
  local found = boot.findClass(boot.loadForClass(1, "").spec.tree, className)
  if not found then io.stderr:write("class not found: " .. className .. "\n"); os.exit(1) end

  local ids = {}
  for i = 2, #args do ids[#ids + 1] = args[i] end
  local xml = boot.minimalBuildXML(found.cls.integerId, "", 100)
        :gsub('nodes=""', 'nodes="' .. table.concat(ids, ",") .. '"')
  local spec = boot.loadBuild(xml).spec

  -- Partition requested ids into main vs ascendancy vs unknown.
  local mainStart, ascStarts = nil, {}
  for _, n in pairs(spec.allocNodes) do
    if n.type == "ClassStart" then mainStart = n
    elseif n.type == "AscendClassStart" then ascStarts[n.ascendancyName] = n end
  end

  local mainReq, ascReq, unknown = {}, {}, {}
  for _, idStr in ipairs(ids) do
    local n = spec.nodes[tonumber(idStr)]
    if not n then unknown[#unknown + 1] = idStr
    elseif n.ascendancyName then
      ascReq[n.ascendancyName] = ascReq[n.ascendancyName] or {}
      table.insert(ascReq[n.ascendancyName], n)
    else mainReq[#mainReq + 1] = n end
  end

  local orphans = {}
  if mainStart then
    local reached = reachableAlloc(spec, mainStart, function(n) return not n.ascendancyName end)
    for _, n in ipairs(mainReq) do if not reached[n.id] then orphans[#orphans + 1] = n end end
  else
    for _, n in ipairs(mainReq) do orphans[#orphans + 1] = n end
  end
  for ascName, reqNodes in pairs(ascReq) do
    local s = ascStarts[ascName]
    if s then
      local reached = reachableAlloc(spec, s, function(n) return n.ascendancyName == ascName end)
      for _, n in ipairs(reqNodes) do if not reached[n.id] then orphans[#orphans + 1] = n end end
    else
      for _, n in ipairs(reqNodes) do orphans[#orphans + 1] = n end
    end
  end

  local main, w1, w2 = spec:CountAllocNodes()
  print(string.format("=== Validate %s ===", found.cls.name))
  print(string.format("requested: %d node(s)  | allocated passive points: %d", #ids, main or 0))
  if #orphans == 0 and #unknown == 0 then
    print("VALID — every requested node connects back to its start.")
  else
    print(string.format("INVALID — %d orphan, %d unknown id:", #orphans, #unknown))
    for _, n in ipairs(orphans) do print("  orphan: " .. fmt.nodeHeader(n)) end
    for _, id in ipairs(unknown) do print("  unknown id: " .. id) end
  end
end

return M
