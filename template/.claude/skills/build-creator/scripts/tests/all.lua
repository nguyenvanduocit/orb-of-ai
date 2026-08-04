-- Runs every *_test.lua module. Add new test files to TEST_FILES.
-- Invoked via cli.lua (`run.sh test`), which has already put the scripts dir on
-- package.path, so `tests.*` and bare module names resolve.
local H = require("tests.helper")

local TEST_FILES = {
  "tests.smoke_test",
  "tests.engine_test",
  "tests.export_test",
  "tests.construct_test",
  "tests.cli_test",
  "tests.optimize_test",
  "tests.publish_test",
  -- "tests.cli_test", "tests.optimize_test", "tests.publish_test",
}

for _, mod in ipairs(TEST_FILES) do
  io.write(mod .. "\n")
  H.run(require(mod))
end

io.write(string.format("\n%d passed, %d failed\n", H.passed, H.failed))
if H.failed > 0 then
  for _, f in ipairs(H.failures) do io.write("  " .. f .. "\n") end
  os.exit(1)
end
