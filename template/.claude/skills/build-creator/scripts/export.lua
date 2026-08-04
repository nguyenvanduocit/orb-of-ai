-- Export the live build to a PoB import code, and decode codes back to XML.
-- Recipe is PoB's own (ImportTab.lua): base64(Deflate(SaveDB("code"))) url-safe.
-- SaveDB serializes the build object — including <PlayerStat> from mainOutput —
-- so the XML can never disagree with what PoB loads, and stats are embedded
-- without a separate bake step.
local export = {}

function export.toCode()
  local xml = build:SaveDB("code")
  if not xml then error("export: SaveDB returned nil") end
  return (common.base64.encode(Deflate(xml)):gsub("+", "-"):gsub("/", "_"))
end

function export.decode(code)
  local b64 = code:gsub("-", "+"):gsub("_", "/")
  local raw = common.base64.decode(b64)
  if not raw or #raw == 0 then error("export: base64 decode failed") end
  local xml = Inflate(raw)
  if not xml or #xml == 0 then error("export: inflate failed") end
  return xml
end

return export
