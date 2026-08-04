-- extract-gear-mods.lua — canonical gear mod-query reference extractor.
--
-- Runs INSIDE the PoB2 headless runtime (data/pob-source/src) so it reads the
-- exact mod tables the calc engine uses (data.itemMods.Item + data.itemBases).
-- A synthetic item assembled from this file is therefore guaranteed both
-- (a) constructible — only real affixes on bases that can roll them, distinct
-- groups, valid prefix/suffix counts, real tier ranges — and (b) trade-queryable
-- — every mod carries the trade stat hash GGG's site expects.
--
-- Output JSON (path = arg[1]): { meta, axes, bases, mods }.
--   mods[i] = { id, axis, affix, type(Prefix|Suffix), group, level,
--               line(text template), vmin, vmax, tradeIds[], rollsOn[tag] }
--   bases[name] = { slot, tags[], reqLevel, implicit }
--
-- Invoke via extract-gear-mods.sh (sets LUA_PATH/CPATH + cd src).

-- capture output path BEFORE dofile — PoB's Launch.lua rewrites the global `arg`.
local OUT = arg[1] or error("usage: luajit extract-gear-mods.lua <output.json>")

local _print = print
print = function() end
dofile("HeadlessWrapper.lua")
print = _print

-- ── axis taxonomy ────────────────────────────────────────────────────────────
-- Ordered: first matching pattern (Lua pattern, case-sensitive on PoB text) wins.
-- pseudo + cap are trade-side metadata for the filter generator.
local AXES = {
  { axis = "all_res",        pat = "to all Elemental Resistances",       pseudo = "pseudo.pseudo_total_all_elemental_resistances" },
  { axis = "fire_res",       pat = "to Fire Resistance",                 pseudo = "pseudo.pseudo_total_fire_resistance",      cap = 75 },
  { axis = "cold_res",       pat = "to Cold Resistance",                 pseudo = "pseudo.pseudo_total_cold_resistance",      cap = 75 },
  { axis = "lightning_res",  pat = "to Lightning Resistance",            pseudo = "pseudo.pseudo_total_lightning_resistance", cap = 75 },
  { axis = "chaos_res",      pat = "to Chaos Resistance",                pseudo = "pseudo.pseudo_total_chaos_resistance",     cap = 75 },
  { axis = "companion_level",pat = "Level of all Tamed Companion",       note = "PoB cannot sim companion DPS — hand-reasoned tie-breaker" },
  { axis = "minion_level",   pat = "Level of all Minion Skills",         pseudo = nil },
  { axis = "minion_damage",  pat = "Minions deal",                       pseudo = nil },
  { axis = "minion_life",    pat = "Minions have",                       extra = "maximum Life" },
  { axis = "spirit",         pat = "to Spirit",                          pseudo = nil },
  { axis = "all_attributes", pat = "to all Attributes",                  pseudo = "pseudo.pseudo_total_all_attributes" },
  { axis = "strength",       pat = "to Strength",                        pseudo = "pseudo.pseudo_total_strength" },
  { axis = "dexterity",      pat = "to Dexterity",                       pseudo = "pseudo.pseudo_total_dexterity" },
  { axis = "intelligence",   pat = "to Intelligence",                    pseudo = "pseudo.pseudo_total_intelligence" },
  { axis = "life_pct",       pat = "increased maximum Life" },
  { axis = "life",           pat = "to maximum Life" },
  { axis = "es_pct",         pat = "increased.*Energy Shield" },
  { axis = "energy_shield",  pat = "to maximum Energy Shield" },
  { axis = "evasion_pct",    pat = "increased Evasion Rating" },
  { axis = "evasion",        pat = "to Evasion Rating" },
  { axis = "armour_pct",     pat = "increased Armour" },
  { axis = "armour",         pat = "to Armour" },
  { axis = "mana",           pat = "to maximum Mana" },
  { axis = "move_speed",     pat = "increased Movement Speed" },
}

-- Slots we optimize. base.type → canonical slot label (engine/trade side).
local SLOTS = {
  Ring = "ring", Amulet = "amulet", Belt = "belt",
  ["Body Armour"] = "body", Helmet = "helmet", Gloves = "gloves",
  Boots = "boots", Quiver = "quiver", Focus = "focus",
}

-- Reject obviously irrelevant variants that share an axis pattern but are noise
-- (minion-only life on a non-minion axis, "of Allies", reflected, etc.).
local function classify(lines)
  local joined = table.concat(lines, " ")
  -- skip lines that mention minions for non-minion life/es/res axes
  for _, a in ipairs(AXES) do
    if joined:find(a.pat) then
      if a.extra and not joined:find(a.extra) then
        -- e.g. minion_life requires "maximum Life" alongside "Minions have"
      else
        -- guard: plain life/es/eva axes must NOT be minion/ally scoped
        local minionScoped = joined:find("Minion") or joined:find("Allies") or joined:find("Companion")
        local axisIsMinion = a.axis:find("minion") or a.axis:find("companion")
        if minionScoped and not axisIsMinion then
          -- skip — this is a minion-scoped variant, not a player stat
        else
          return a.axis
        end
      end
    end
  end
  return nil
end

local function axisMeta(axis)
  for _, a in ipairs(AXES) do if a.axis == axis then return a end end
  return {}
end

-- parse first (min-max) numeric range from a stat line; fall back to a single
-- literal number; nil if non-numeric.
local function parseRange(line)
  local lo, hi = line:match("%((%-?%d+%.?%d*)%-(%-?%d+%.?%d*)%)")
  if lo then return tonumber(lo), tonumber(hi) end
  local single = line:match("([%-]?%d+%.?%d*)")
  if single then return tonumber(single), tonumber(single) end
  return nil, nil
end

-- ── walk mods ────────────────────────────────────────────────────────────────
-- which base tags actually appear on the slots we care about (so rollsOn only
-- lists meaningful tags)
local relevantTags = {}
for name, b in pairs(data.itemBases) do
  if b.type and SLOTS[b.type] and b.tags then
    for tag, on in pairs(b.tags) do if on then relevantTags[tag] = true end end
  end
end

local mods = {}
for id, m in pairs(data.itemMods.Item) do
  if type(m) == "table" and m.type and (m.type == "Prefix" or m.type == "Suffix") then
    -- gather stat lines (numeric-indexed string entries)
    local lines = {}
    local i = 1
    while type(m[i]) == "string" do lines[#lines + 1] = m[i]; i = i + 1 end
    if #lines > 0 then
      local axis = classify(lines)
      if axis then
        -- rollsOn: base tags with weight>0 that also appear on our slots
        local rollsOn = {}
        if m.weightKey and m.weightVal then
          for wi, tag in ipairs(m.weightKey) do
            if (m.weightVal[wi] or 0) > 0 and relevantTags[tag] then
              rollsOn[#rollsOn + 1] = tag
            end
          end
        end
        if #rollsOn > 0 then  -- only keep mods that can land on an optimized slot
          -- the line carrying the axis (for value range) — first matching line
          local am = axisMeta(axis)
          local axisLine = lines[1]
          for _, ln in ipairs(lines) do if ln:find(am.pat or "") then axisLine = ln; break end end
          local vmin, vmax = parseRange(axisLine)
          -- trade ids
          local tradeIds = {}
          if m.tradeHashes then
            for hash, _ in pairs(m.tradeHashes) do
              tradeIds[#tradeIds + 1] = "explicit.stat_" .. tostring(hash)
            end
          end
          mods[#mods + 1] = {
            id = id, axis = axis, affix = m.affix, type = m.type,
            group = m.group, level = m.level or 1,
            line = axisLine, lines = lines, vmin = vmin, vmax = vmax,
            tradeIds = tradeIds, rollsOn = rollsOn,
          }
        end
      end
    end
  end
end

-- ── bases for our slots ──────────────────────────────────────────────────────
local bases = {}
for name, b in pairs(data.itemBases) do
  if b.type and SLOTS[b.type] then
    local tags = {}
    if b.tags then for tag, on in pairs(b.tags) do if on then tags[#tags + 1] = tag end end end
    table.sort(tags)
    bases[name] = {
      slot = SLOTS[b.type], baseType = b.type, tags = tags,
      reqLevel = (b.req and b.req.level) or 0,
      implicit = b.implicit,
    }
  end
end

-- axes metadata (pseudo + cap) for the trade-filter generator
local axesMeta = {}
for _, a in ipairs(AXES) do
  axesMeta[a.axis] = { pseudo = a.pseudo, cap = a.cap, note = a.note }
end

-- Trade-side-only axes: real 0.5 gear mods that PoB2 0.4 data cannot construct or
-- simulate (the fork lags the patch). Queryable on trade, but their value is
-- hand-reasoned, NEVER part of synthetic PoB validation. The engine may add these
-- as soft trade preferences; it must never claim PoB verified them.
local tradeOnlyAxes = {
  companion_level = {
    tradeId = "explicit.stat_448592698",
    text = "+# to Level of all Tamed Companion Skills",
    rollsOn = { "amulet" },
    note = "Boosts Tamed Companion (Diretusk Boar etc). Not in PoB2 0.4 data → cannot construct/sim; PoB2 also models 0 companion DPS. Trade-side soft preference only, hand-reasoned.",
  },
}

-- ── minimal JSON encoder ─────────────────────────────────────────────────────
local function enc(v)
  local t = type(v)
  if t == "nil" then return "null"
  elseif t == "boolean" then return v and "true" or "false"
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    if math.floor(v) == v then return string.format("%d", v) end
    return string.format("%.4g", v)
  elseif t == "string" then
    return '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\t', ' ') .. '"'
  elseif t == "table" then
    local n = 0; for _ in pairs(v) do n = n + 1 end
    local isArr = (#v == n)
    local parts = {}
    if isArr then
      for _, e in ipairs(v) do parts[#parts + 1] = enc(e) end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local keys = {}; for k in pairs(v) do keys[#keys + 1] = k end
      table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
      for _, k in ipairs(keys) do parts[#parts + 1] = enc(tostring(k)) .. ":" .. enc(v[k]) end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return "null"
end

table.sort(mods, function(a, b)
  if a.axis ~= b.axis then return a.axis < b.axis end
  return (a.level or 0) > (b.level or 0)
end)

local doc = {
  meta = {
    source = "PoB2 data.itemMods.Item + data.itemBases (HeadlessWrapper)",
    treeVersion = (data.latestVersion or "unknown"),
    modCount = #mods,
    slots = (function() local s = {} for _, v in pairs(SLOTS) do s[#s + 1] = v end table.sort(s) return s end)(),
    note = "Affix pool for synthetic-item construction + trade-query generation. Each mod = one tier (distinct affix/level). Player-stat scoped (minion/companion axes flagged).",
  },
  axes = axesMeta,
  tradeOnlyAxes = tradeOnlyAxes,
  bases = bases,
  mods = mods,
}

local f = assert(io.open(OUT, "w"))
f:write(enc(doc))
f:close()
io.stderr:write(string.format("[extract-gear-mods] %d mods across %d bases → %s\n",
  #mods, (function() local n = 0 for _ in pairs(bases) do n = n + 1 end return n end)(), OUT))
