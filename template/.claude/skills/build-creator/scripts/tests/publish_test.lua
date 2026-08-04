local H = require("tests.helper")
local publish = require("publish")
return {
  ["curlCommand targets pobb.in and passes the code via stdin"] = function()
    local cmd = publish.curlCommand("ABC-_123")
    H.truthy(cmd:find("https://pobb.in/pob/", 1, true), "hits pobb.in")
    H.truthy(cmd:find("--data-binary @-", 1, true), "code via stdin, not argv")
    H.truthy(cmd:find("Path of Building", 1, true), "sets PoB user-agent")
  end,
  ["poeninjaSnippet embeds the code"] = function()
    local snip = publish.poeninjaSnippet("XYZ123")
    H.truthy(snip:find("XYZ123", 1, true), "code present in snippet")
    H.truthy(snip:find("/poe2/pob/api/upload", 1, true), "poe.ninja upload path")
  end,
}
