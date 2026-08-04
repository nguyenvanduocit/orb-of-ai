-- fmt.lua — pure output formatting. No PoB knowledge, no I/O beyond returning
-- strings. Keeps presentation separate from the query/calc logic.

local M = {}

-- Classify a PoB node by its `type` field into a short human label.
function M.nodeType(node)
  if node.type == "Keystone" then return "Keystone" end
  if node.type == "Notable" then return "Notable" end
  if node.type == "Socket" then return "Jewel Socket" end
  if node.type == "ClassStart" then return "Class Start" end
  if node.type == "AscendClassStart" then return "Ascendancy Start" end
  if node.type == "Mastery" then return "Mastery" end
  return "Small"
end

-- One-line node header: "12345: Name [Notable] {Lich}"
function M.nodeHeader(node)
  local asc = node.ascendancyName and (" {" .. node.ascendancyName .. "}") or ""
  return string.format("%s: %s [%s]%s", tostring(node.id), tostring(node.dn or node.name or "?"), M.nodeType(node), asc)
end

-- Indented stat lines from node.sd (the parsed stat descriptions).
function M.statLines(node, indent)
  indent = indent or "  "
  local out = {}
  for _, s in ipairs(node.sd or {}) do out[#out + 1] = indent .. "- " .. s end
  return table.concat(out, "\n")
end

-- Minimal JSON encoder for machine-readable command output (optimize, export).
-- Handles nil/boolean/number/string/array/object. Arrays = tables with a [1];
-- empty tables encode as {}. Sufficient for our flat result shapes.
local function encode(v, parts)
  local t = type(v)
  if v == nil then
    parts[#parts + 1] = "null"
  elseif t == "boolean" then
    parts[#parts + 1] = tostring(v)
  elseif t == "number" then
    -- Avoid scientific notation / trailing noise; integers stay integers.
    if v == math.floor(v) and math.abs(v) < 1e15 then
      parts[#parts + 1] = string.format("%d", v)
    else
      parts[#parts + 1] = string.format("%.6g", v)
    end
  elseif t == "string" then
    parts[#parts + 1] = '"' .. v:gsub('[%z\1-\31\\"]', function(c)
      local map = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
      return map[c] or string.format("\\u%04x", c:byte())
    end) .. '"'
  elseif t == "table" then
    if v[1] ~= nil or next(v) == nil then
      parts[#parts + 1] = "["
      for i, item in ipairs(v) do
        if i > 1 then parts[#parts + 1] = "," end
        encode(item, parts)
      end
      parts[#parts + 1] = "]"
    else
      parts[#parts + 1] = "{"
      local first = true
      for k, val in pairs(v) do
        if not first then parts[#parts + 1] = "," end
        first = false
        encode(tostring(k), parts)
        parts[#parts + 1] = ":"
        encode(val, parts)
      end
      parts[#parts + 1] = "}"
    end
  end
end

function M.json(v)
  local parts = {}
  encode(v, parts)
  return table.concat(parts)
end

return M
