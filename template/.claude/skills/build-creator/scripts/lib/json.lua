-- Minimal JSON for spec input + CLI output. Pure Lua 5.1, no deps.
local json = {}

local function skipWs(s, i)
  local _, j = s:find("^[ \t\r\n]*", i)
  return (j or i - 1) + 1
end

local decodeValue -- fwd

local function decodeString(s, i)
  assert(s:sub(i, i) == '"', "json: expected string at " .. i)
  i = i + 1
  local buf = {}
  while true do
    local c = s:sub(i, i)
    if c == "" then error("json: unterminated string") end
    if c == '"' then return table.concat(buf), i + 1 end
    if c == "\\" then
      local e = s:sub(i + 1, i + 1)
      local map = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
      if map[e] then buf[#buf + 1] = map[e]; i = i + 2
      elseif e == "u" then
        local hex = s:sub(i + 2, i + 5)
        buf[#buf + 1] = string.char(tonumber(hex, 16) % 256); i = i + 6
      else error("json: bad escape \\" .. e) end
    else buf[#buf + 1] = c; i = i + 1 end
  end
end

local function decodeNumber(s, i)
  local _, j, num = s:find("^(-?%d+%.?%d*[eE]?[+-]?%d*)", i)
  assert(num, "json: bad number at " .. i)
  return tonumber(num), j + 1
end

local function decodeArray(s, i)
  i = skipWs(s, i + 1)
  local arr = {}
  if s:sub(i, i) == "]" then return arr, i + 1 end
  while true do
    local v; v, i = decodeValue(s, i); arr[#arr + 1] = v
    i = skipWs(s, i)
    local c = s:sub(i, i)
    if c == "]" then return arr, i + 1 end
    assert(c == ",", "json: expected , or ] in array at " .. i)
    i = skipWs(s, i + 1)
  end
end

local function decodeObject(s, i)
  i = skipWs(s, i + 1)
  local obj = {}
  if s:sub(i, i) == "}" then return obj, i + 1 end
  while true do
    local k; k, i = decodeString(s, i)
    i = skipWs(s, i)
    assert(s:sub(i, i) == ":", "json: expected : at " .. i)
    local v; v, i = decodeValue(s, skipWs(s, i + 1)); obj[k] = v
    i = skipWs(s, i)
    local c = s:sub(i, i)
    if c == "}" then return obj, i + 1 end
    assert(c == ",", "json: expected , or } in object at " .. i)
    i = skipWs(s, i + 1)
  end
end

decodeValue = function(s, i)
  i = skipWs(s, i)
  local c = s:sub(i, i)
  if c == '"' then return decodeString(s, i)
  elseif c == "{" then return decodeObject(s, i)
  elseif c == "[" then return decodeArray(s, i)
  elseif c == "t" and s:sub(i, i + 3) == "true" then return true, i + 4
  elseif c == "f" and s:sub(i, i + 4) == "false" then return false, i + 5
  elseif c == "n" and s:sub(i, i + 3) == "null" then return nil, i + 4
  else return decodeNumber(s, i) end
end

function json.decode(s)
  local v = decodeValue(s, 1)
  return v
end

function json.encode(v)
  local t = type(v)
  if t == "nil" then return "null"
  elseif t == "boolean" then return v and "true" or "false"
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    return string.format("%.6g", v)
  elseif t == "string" then
    return '"' .. v:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n") .. '"'
  elseif t == "table" then
    if #v > 0 or next(v) == nil then
      local parts = {}
      for _, e in ipairs(v) do parts[#parts + 1] = json.encode(e) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    local parts = {}
    for k, val in pairs(v) do parts[#parts + 1] = json.encode(tostring(k)) .. ":" .. json.encode(val) end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return "null"
end

return json
