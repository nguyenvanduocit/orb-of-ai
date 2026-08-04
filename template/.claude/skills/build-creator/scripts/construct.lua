-- JSON spec → loaded PoB build object, using PoB's own object API.
local engine = require("engine")
local construct = {}

local function ascendIdByName(name)
  for ascendId, asc in pairs(build.spec.curClass.classes) do
    if asc.name == name then return ascendId end
  end
  return nil
end

local function pasteSkillGroup(group)
  local lines = {}
  if group.label and group.label ~= "" then
    lines[#lines + 1] = "Label: " .. group.label
  end
  for _, gem in ipairs(group.gems or {}) do
    -- gem is "Name level/quality"; PasteSocketGroup wants a trailing count.
    -- Append "  1" (double space = empty state token, 1 = count).
    lines[#lines + 1] = gem .. "  1"
  end
  build.skillsTab:PasteSocketGroup(table.concat(lines, "\n") .. "\n")
end

local function equipItem(entry)
  local item = new("Item", entry.text)
  if not item.base then
    error("construct: item text did not resolve a base for slot '" .. tostring(entry.slot) .. "'")
  end
  item:NormaliseQuality()
  item:BuildModList()
  build.itemsTab:AddItem(item, true)  -- noAutoEquip; assigns item.id
  local slot = build.itemsTab.slots[entry.slot]
  if not slot then
    error("construct: unknown item slot '" .. tostring(entry.slot) .. "'")
  end
  slot:SetSelItemId(item.id)
end

local function allocNodes(ids)
  for _, id in ipairs(ids) do
    local node = build.spec.nodes[id]
    if node then
      build.spec:AllocNode(node)
    else
      io.stderr:write("construct: warning — unknown node id " .. tostring(id) .. "\n")
    end
  end
  build.spec:BuildAllDependsAndPaths()
end

-- Build the full character from a decoded spec table. Returns nothing; the
-- result lives in the global `build`. Raises on any unresolved name.
function construct.build(spec)
  engine.newBuild()

  engine.selectClass(spec.class)

  if spec.ascendancy and spec.ascendancy ~= "" then
    local aid = ascendIdByName(spec.ascendancy)
    if not aid then
      error("construct: unknown ascendancy '" .. spec.ascendancy
        .. "' for class '" .. spec.class .. "'")
    end
    build.spec:SelectAscendClass(aid)
  end

  if spec.level then engine.setLevel(spec.level) end

  if spec.skills then
    for _, group in ipairs(spec.skills) do
      pasteSkillGroup(group)
    end
    if spec.skills[1] then build.mainSocketGroup = 1 end
  end

  if spec.items then
    for _, entry in ipairs(spec.items) do equipItem(entry) end
    build.itemsTab:PopulateSlots()
  end

  if spec.tree and spec.tree.nodes then
    allocNodes(spec.tree.nodes)
  end

  engine.commit()
  engine.assertClass(spec.class)
end

return construct
