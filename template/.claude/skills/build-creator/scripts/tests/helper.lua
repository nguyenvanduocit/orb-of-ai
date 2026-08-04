-- Tiny test harness. Each test file returns a table of { name = function }.
local H = { passed = 0, failed = 0, failures = {} }

function H.eq(actual, expected, msg)
  if actual ~= expected then
    error((msg or "eq") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual), 2)
  end
end

function H.truthy(v, msg)
  if not v then error((msg or "truthy") .. ": value was falsy", 2) end
end

function H.near(actual, expected, tol, msg)
  tol = tol or 1e-6
  if math.abs(actual - expected) > tol then
    error((msg or "near") .. ": expected ~" .. tostring(expected) .. ", got " .. tostring(actual), 2)
  end
end

-- Runs a { name = fn } table; records results into H.
function H.run(tests)
  for name, fn in pairs(tests) do
    local ok, err = pcall(fn)
    if ok then
      H.passed = H.passed + 1
      io.write("  PASS " .. name .. "\n")
    else
      H.failed = H.failed + 1
      H.failures[#H.failures + 1] = name .. ": " .. tostring(err)
      io.write("  FAIL " .. name .. " -- " .. tostring(err) .. "\n")
    end
  end
end

return H
