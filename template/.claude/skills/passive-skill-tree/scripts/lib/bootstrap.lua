-- bootstrap.lua — the ONLY module that touches Path of Building internals.
--
-- Everything PoB-specific is centralised here so that a PoB refresh (e.g. the
-- 0.4 -> 0.5 tree bump after 2026-05-29) only ever requires editing this file.
-- Command modules (query/path/calc) consume the build/spec/tree handles this
-- module returns and never `dofile` or reach into PoB globals themselves.
--
-- Runs against real PoB2 headless via luajit with cwd = data/pob-source/src
-- (pst.sh sets that up). The init path mirrors verify.lua / HeadlessWrapper.lua.

local M = {}

-- Latest tree shipped by the bundled pob-source. Bump alongside a PoB refresh;
-- check data/pob-source/src/GameVersions.lua + TreeData/ after pulling.
M.TREE_VERSION = "0_4"

local initialised = false

-- dofile HeadlessWrapper.lua exactly once. After this, the PoB globals
-- (build, loadBuildFromXML, newBuild, …) exist. cwd must already be the
-- pob-source/src dir — pst.sh guarantees that.
function M.init()
  if initialised then return end
  -- PoB logs everything (tree load, "missing node N", "Uniques loaded", …) via
  -- ConPrintf -> print -> stdout, which would pollute machine-readable output
  -- (export/optimize JSON). Silence it: noop `print` across the dofile (which
  -- runs Launch's OnInit/OnFrame and their ConPrintf calls), then noop ConPrintf
  -- directly for the load phase, and restore `print` for our own command output.
  local realPrint = _G.print
  _G.print = function() end
  dofile("HeadlessWrapper.lua")
  _G.ConPrintf = function() end
  _G.print = realPrint
  initialised = true
end

-- Emit a minimal but PoB2-valid build XML for tree/spec queries that don't need
-- a real skill or gear (lookup, path, validate, …). Same wire-format invariants
-- as build-creator's emitter: <PathOfBuilding2> root, targetVersion 0_1,
-- classInternalId = GGG integerId, mainSocketGroup + one PlayerStat child.
function M.minimalBuildXML(classInternalId, ascendancyInternalId, level)
  classInternalId = classInternalId or 1 -- Witch
  ascendancyInternalId = ascendancyInternalId or ""
  level = level or 1
  return table.concat({
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PathOfBuilding2>',
    string.format('\t<Build targetVersion="0_1" level="%d" className="" mainSocketGroup="1" viewMode="TREE" characterLevelAutoMode="false">', level),
    '\t\t<PlayerStat stat="Life" value="0"/>',
    '\t</Build>',
    '\t<Tree activeSpec="1">',
    string.format('\t\t<Spec treeVersion="%s" classInternalId="%d" ascendancyInternalId="%s" nodes="">', M.TREE_VERSION, classInternalId, ascendancyInternalId),
    '\t\t</Spec>',
    '\t</Tree>',
    '</PathOfBuilding2>',
  }, "\n")
end

-- Load a build from raw XML and return the PoB `build` global. Throws (via PoB's
-- own error path) if the XML is rejected. Callers that need calc'd stats must
-- call M.recalc(build) afterwards.
function M.loadBuild(xml)
  M.init()
  loadBuildFromXML(xml, "pst")
  return build
end

-- Load just the tree + spec for a class (no skill/gear). Returns build; access
-- build.spec and build.spec.tree from there. Used by every non-calc command.
function M.loadForClass(classInternalId, ascendancyInternalId)
  return M.loadBuild(M.minimalBuildXML(classInternalId, ascendancyInternalId, 1))
end

-- Force a full recalc and return mainOutput. ~18ms cold; AllocNode already runs
-- BuildAllDependsAndPaths, so callers only need this to refresh calc results.
function M.recalc(b)
  b = b or build
  b.buildFlag = true
  b.calcsTab:BuildOutput()
  return b.calcsTab.mainOutput
end

-- Resolve a class name (case-insensitive, prefix ok) to its PoB curClassId AND
-- GGG integerId, reading the bundled tree's classes table. Single source of
-- truth: tree.classes[i].integerId is what PoB writes as classInternalId.
function M.findClass(tree, query)
  local q = query:lower()
  local exact, prefix
  for classId, cls in pairs(tree.classes) do
    local name = (cls.name or ""):lower()
    if name == q then exact = { classId = classId, cls = cls } end
    if not prefix and name:find(q, 1, true) then prefix = { classId = classId, cls = cls } end
  end
  return exact or prefix
end

return M
