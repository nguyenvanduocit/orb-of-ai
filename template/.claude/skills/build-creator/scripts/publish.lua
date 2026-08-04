-- Publish a PoB code. pobb.in is headless via curl (shell-out keeps us off
-- LuaSocket/luasec). The code is fed through stdin (--data-binary @-) so it
-- never lands in argv. poe.ninja is browser-gated, so we only emit a playwriter
-- snippet for the caller to run in the user's Chrome.
local publish = {}

-- The curl invocation. Code arrives on stdin, so it is not interpolated here.
function publish.curlCommand(_code)
  return table.concat({
    "curl -fsS",
    "-X POST",
    "-H 'User-Agent: Path of Building/2.42.0'",
    "--data-binary @-",
    "https://pobb.in/pob/",
  }, " ")
end

-- POST the code to pobb.in via curl; return the shareable URL. luajit's io.popen
-- is unidirectional, so we feed stdin with a `printf | curl` pipe. The code is
-- url-safe base64 (alphabet [A-Za-z0-9-_=]) with no shell metacharacters, so
-- single-quoting is safe.
function publish.toPobbin(code)
  if code:find("[^%w%-_=]") then
    error("publish: code has unexpected characters; refusing to shell-quote")
  end
  local feed = "printf '%s' '" .. code .. "' | " .. publish.curlCommand(code)
  local p = assert(io.popen(feed, "r"), "publish: io.popen failed")
  local id = (p:read("*a") or ""):gsub("%s+$", "")
  p:close()
  if id == "" then error("publish: pobb.in returned empty response") end
  return { target = "pobb.in", id = id, url = "https://pobb.in/" .. id }
end

-- Playwriter JS to run on a loaded https://poe.ninja/poe2/pob page.
function publish.poeninjaSnippet(code)
  return ([[
const code = %q;
const res = await fetch('/poe2/pob/api/upload', { method: 'POST', body: new URLSearchParams({ code }) });
if (!res.ok) throw new Error('poe.ninja upload failed: ' + res.status);
const body = (await res.text()).trim();
return body.startsWith('http') ? body : 'https://poe.ninja' + (body.startsWith('/') ? '' : '/') + body;
]]):format(code)
end

return publish
