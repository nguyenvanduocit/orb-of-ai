local H = require("tests.helper")
local engine = require("engine")
local construct = require("construct")
return {
  ["class+ascendancy+level applied from spec"] = function()
    engine.init()
    construct.build({ level = 80, class = "Witch", ascendancy = "Infernalist" })
    H.eq(build.spec.curClassName, "Witch", "class set")
    H.eq(build.characterLevel, 80, "level set")
    H.eq(build.spec.curAscendClassName, "Infernalist", "ascendancy set")
  end,
  ["unknown class raises"] = function()
    engine.init()
    local ok = pcall(function() construct.build({ level = 1, class = "Notaclass" }) end)
    H.eq(ok, false, "unknown class errors")
  end,
  ["skill group adds a socket group with the active gem"] = function()
    engine.init()
    construct.build({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      skills = { { label = "Main", gems = { "Spark 20/20" }, main = 1 } },
    })
    local groups = build.skillsTab.socketGroupList
    H.eq(#groups, 1, "one socket group")
    H.eq(groups[1].label, "Main", "label applied")
    H.eq(groups[1].gemList[1].nameSpec, "Spark", "active gem nameSpec")
    H.eq(groups[1].gemList[1].level, 20, "gem level parsed")
    H.eq(groups[1].gemList[1].quality, 20, "gem quality parsed")
  end,
  ["item is created and equipped to its named slot"] = function()
    engine.init()
    construct.build({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      items = { { slot = "Helmet",
        text = "Rarity: NORMAL\nRusted Greathelm\nRusted Greathelm" } },
    })
    local slot = build.itemsTab.slots["Helmet"]
    H.truthy(slot and slot.selItemId and slot.selItemId > 0, "helmet slot has an item")
    local item = build.itemsTab.items[slot.selItemId]
    H.truthy(item and item.baseName, "equipped item resolved a base")
  end,
  ["tree nodes allocate (count increases beyond class start)"] = function()
    engine.init()
    -- Discover real allocatable node ids adjacent to the Witch start node,
    -- so the test is data-version independent.
    construct.build({ level = 80, class = "Witch", ascendancy = "Infernalist" })
    local startId = build.spec.curClass.startNodeId
    local picks = {}
    for _, n in ipairs(build.spec.nodes[startId].linked or {}) do
      if n.id and not n.isAscendancyStart and n.type ~= "ClassStart" then
        picks[#picks + 1] = n.id
        if #picks >= 2 then break end
      end
    end
    H.truthy(#picks >= 1, "found at least one adjacent node to allocate")

    local before = 0
    for _ in pairs(build.spec.allocNodes) do before = before + 1 end

    construct.build({
      level = 80, class = "Witch", ascendancy = "Infernalist",
      tree = { nodes = picks },
    })

    local after = 0
    for _ in pairs(build.spec.allocNodes) do after = after + 1 end
    H.truthy(after > before, "allocNodes grew after allocating tree nodes")
  end,
}
