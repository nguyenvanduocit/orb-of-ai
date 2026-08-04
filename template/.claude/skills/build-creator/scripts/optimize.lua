-- Greedy hill-climb over a constructed build, in-process. Each candidate is
-- applied, committed, measured against the target metric, and kept only if it
-- improves by >= EPS; otherwise reverted. The build object is the single source
-- of truth — we never re-spawn the engine, so each candidate costs one OnFrame.
local engine = require("engine")
local construct = require("construct")
local export = require("export")

local optimize = {}
local EPS = 1e-6

local function metric(name) return engine.out()[name] or 0 end

-- Try allocating each node id; keep allocations that raise the target.
local function climbNodes(target, ids)
  local kept = {}
  for _, id in ipairs(ids or {}) do
    local node = build.spec.nodes[id]
    if node and not node.alloc then
      local before = metric(target)
      build.spec:AllocNode(node)
      engine.commit()
      local after = metric(target)
      if after >= before + EPS then
        kept[#kept + 1] = id
      else
        build.spec:DeallocNode(node)
        engine.commit()
      end
    end
  end
  return kept
end

-- Try each gem swap; keep swaps that raise the target.
-- A swap = { group = <1-based group index>, index = <1-based gem index>, gem = "Name level/quality" }
local function climbSwaps(target, swaps)
  local kept = {}
  for _, sw in ipairs(swaps or {}) do
    local group = build.skillsTab.socketGroupList[sw.group]
    local gem = group and group.gemList[sw.index]
    if gem then
      local prev = { nameSpec = gem.nameSpec, level = gem.level, quality = gem.quality }
      local name, lvl, q = sw.gem:match("([ %a']+) (%d+)/(%d+)")
      local before = metric(target)
      gem.nameSpec = name or sw.gem
      gem.level = tonumber(lvl) or gem.level
      gem.quality = tonumber(q) or gem.quality
      engine.commit()  -- engine.commit() forces build.buildFlag for the recalc
      local after = metric(target)
      if after >= before + EPS then
        kept[#kept + 1] = sw
      else
        gem.nameSpec, gem.level, gem.quality = prev.nameSpec, prev.level, prev.quality
        engine.commit()
      end
    end
  end
  return kept
end

-- spec.optimize = { target = "TotalDPS", tryNodes = {...}, trySwaps = {...} }
function optimize.run(spec)
  engine.init()
  construct.build(spec)
  local opt = spec.optimize or {}
  local target = opt.target or "TotalDPS"
  local before = metric(target)

  local keptNodes = climbNodes(target, opt.tryNodes)
  local keptSwaps = climbSwaps(target, opt.trySwaps)

  local after = metric(target)
  return {
    target = target,
    before = before,
    after = after,
    keptNodes = keptNodes,
    keptSwaps = keptSwaps,
    stats = engine.stats(),
    code = export.toCode(),
  }
end

return optimize
