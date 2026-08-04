-- calc.lua — build-context commands. These need a real build (skill + gear) so
-- the PoB calc engine produces meaningful multiplicative stats, not additive
-- node-stat sums. Input is a build XML (e.g. from build-creator's emitter).
--
--   analyze  <build.xml> [extra-node-ids...]   real mainOutput stats
--   optimize <build.xml> [opts]                greedy tree search by objective
--
-- optimize is the reason this whole skill moved to Lua: it drives the proven
-- alloc -> recalc -> delta loop over candidate notables, honouring a passive
-- point budget and required notables, using PoB's real pathing + calc.

local boot = require("lib.bootstrap")
local fmt = require("lib.fmt")

local M = { commands = {}, help = {} }

-- Resolve a path arg against the caller's original cwd (pst.sh cd's into the
-- pob-source dir, so relative build-file args would otherwise break).
local function resolve(p)
  if p:sub(1, 1) == "/" then return p end
  local base = os.getenv("PST_PWD")
  return base and (base .. "/" .. p) or p
end

local function readFile(p)
  local f = io.open(resolve(p), "r"); if not f then return nil end
  local s = f:read("*a"); f:close(); return s
end

-- Merge extra node ids into a build XML's Spec nodes="..." attribute.
local function withNodes(xml, idList)
  if #idList == 0 then return xml end
  local extra = table.concat(idList, ",")
  local replaced = false
  local out = xml:gsub('(nodes=")([^"]*)(")', function(pre, existing, post)
    replaced = true
    local merged = (existing ~= "" and (existing .. ",") or "") .. extra
    return pre .. merged .. post
  end, 1)
  return replaced and out or xml
end

-- Parse simple --flag value options out of an arg list. Returns (opts, positional).
local function parseOpts(args)
  local opts, pos = {}, {}
  local i = 1
  while i <= #args do
    local a = args[i]
    local flag = a:match("^%-%-(.+)$")
    if flag then opts[flag] = args[i + 1]; i = i + 2
    else pos[#pos + 1] = a; i = i + 1 end
  end
  return opts, pos
end

-- analyze <build.xml> [extra-node-ids...] — load build (+ optional extra nodes),
-- recalc, print the real mainOutput stats PoB computes.
M.help["analyze"] = "<build.xml> [nodes...]  real PoB stats for a build (+optional extra nodes)"
M.commands["analyze"] = function(args)
  local path = args[1]
  if not path then io.stderr:write("usage: analyze <build.xml> [node-id...]\n"); os.exit(1) end
  local xml = readFile(path)
  if not xml then io.stderr:write("cannot read: " .. path .. "\n"); os.exit(1) end
  local extra = {}
  for i = 2, #args do extra[#extra + 1] = args[i] end

  local b = boot.loadBuild(withNodes(xml, extra))
  local out = boot.recalc(b)
  local main = select(1, b.spec:CountAllocNodes())
  local keys = { "Life", "EnergyShield", "Mana", "TotalDPS", "CombinedDPS", "FullDPS", "TotalEHP" }
  local stats = {}
  print("=== Build stats (" .. boot.TREE_VERSION .. ") ===")
  print("allocated passive points: " .. (main or 0))
  for _, k in ipairs(keys) do
    local v = out[k]
    stats[k] = type(v) == "number" and v or 0
    print(string.format("  %-12s %s", k, type(v) == "number" and string.format("%.6g", v) or "-"))
  end
end

-- Apply a committed id list to the base XML, allocate one candidate on top,
-- recalc, and return (objectiveValue, pointsUsed, allocatedIds).
local function trial(baseXml, committedIds, candidateNode, objective)
  local b = boot.loadBuild(withNodes(baseXml, committedIds))
  if candidateNode then
    local node = b.spec.nodes[candidateNode]
    if node then b.spec:AllocNode(node) end
  end
  local out = boot.recalc(b)
  local main = select(1, b.spec:CountAllocNodes())
  local allocated = {}
  for id, n in pairs(b.spec.allocNodes) do
    if n.type ~= "ClassStart" and n.type ~= "AscendClassStart" then allocated[#allocated + 1] = id end
  end
  return (type(out[objective]) == "number" and out[objective] or 0), (main or 0), allocated
end

-- optimize <build.xml> [--objective TotalDPS] [--budget N] [--require a,b]
--          [--filter "spell damage"] [--top K]
-- Greedy: each round, reload the committed allocation, try every candidate
-- notable on top, keep the one with the best objective gain that still fits the
-- point budget; commit its full allocated path; repeat. Reload-per-trial keeps
-- marginals independent. JSON result on stdout.
M.help["optimize"] = "<build.xml> [--objective S --budget N --require ids --filter txt --top K]"
M.commands["optimize"] = function(args)
  local opts, pos = parseOpts(args)
  local path = pos[1]
  if not path then io.stderr:write("usage: optimize <build.xml> [--objective S --budget N --require ids --filter txt --top K]\n"); os.exit(1) end
  local xml = readFile(path)
  if not xml then io.stderr:write("cannot read: " .. path .. "\n"); os.exit(1) end

  local objective = opts.objective or "TotalDPS"
  local budget = tonumber(opts.budget) or 20
  local maxPicks = tonumber(opts.top) or math.huge
  local filter = opts.filter and opts.filter:lower() or nil
  local required = {}
  if opts.require then for id in opts.require:gmatch("%d+") do required[#required + 1] = id end end

  -- Candidate notables, optionally filtered by stat text. Read names/types from
  -- a throwaway tree load (no calc needed for candidate enumeration).
  local probeSpec = boot.loadForClass(1, "").spec
  local candidates = {}
  for id, n in pairs(probeSpec.nodes) do
    if n.type == "Notable" and not n.ascendancyName then
      local keep = true
      if filter then
        keep = false
        for _, s in ipairs(n.sd or {}) do if s:lower():find(filter, 1, true) then keep = true; break end end
      end
      if keep then candidates[#candidates + 1] = { id = id, name = n.dn } end
    end
  end

  -- Baseline objective with no extra allocation.
  local baseObj, basePoints = trial(xml, {}, nil, objective)
  local picks = {}

  -- Commit required notables by ALLOCATING them (AllocNode pulls in each one's
  -- connecting path); the resulting full alloc set — not the bare ids — becomes
  -- the starting committed allocation so the corridors stay paid for.
  local committed = {}
  local curObj, curPoints = baseObj, basePoints
  if #required > 0 then
    local b0 = boot.loadBuild(withNodes(xml, {}))
    for _, id in ipairs(required) do
      local n = b0.spec.nodes[tonumber(id)]
      if n then b0.spec:AllocNode(n) end
    end
    local out = boot.recalc(b0)
    curObj = type(out[objective]) == "number" and out[objective] or curObj
    curPoints = select(1, b0.spec:CountAllocNodes()) or 0
    for id, n in pairs(b0.spec.allocNodes) do
      if n.type ~= "ClassStart" and n.type ~= "AscendClassStart" then committed[#committed + 1] = id end
    end
  end

  while #picks < maxPicks and curPoints < budget do
    local best
    for _, cand in ipairs(candidates) do
      -- skip already-committed
      local skip = false
      for _, c in ipairs(committed) do if tostring(c) == tostring(cand.id) then skip = true; break end end
      if not skip then
        -- alloc = the FULL allocated set for this trial (committed paths +
        -- candidate's connecting path); committing this — not just cand.id —
        -- is what keeps the corridor allocated for the next round.
        local obj, pts, alloc = trial(xml, committed, cand.id, objective)
        if pts <= budget and obj > curObj then
          local gain = obj - curObj
          local cost = pts - curPoints
          local eff = cost > 0 and (gain / cost) or gain
          if not best or eff > best.eff then
            best = { id = cand.id, name = cand.name, obj = obj, pts = pts, gain = gain, cost = cost, eff = eff, alloc = alloc }
          end
        end
      end
    end
    if not best then break end
    committed = best.alloc -- cumulative full allocation incl. paths
    curObj, curPoints = best.obj, best.pts
    picks[#picks + 1] = best
  end

  -- Final allocated set for the result.
  local _, finalPoints, finalAlloc = trial(xml, committed, nil, objective)
  local result = {
    objective = objective, budget = budget,
    base = { value = baseObj, points = basePoints },
    final = { value = curObj, points = finalPoints },
    required = required,
    picks = {},
    allocatedNodes = finalAlloc,
  }
  for _, p in ipairs(picks) do
    result.picks[#result.picks + 1] = { id = p.id, name = p.name, value = p.obj, points = p.pts, gain = p.gain, cost = p.cost }
  end
  print(fmt.json(result))
end

return M
