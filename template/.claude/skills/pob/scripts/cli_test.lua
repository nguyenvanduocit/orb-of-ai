-- CLI test for PoB2
describe("CLI", function()
    it("loads build and outputs stats", function()
        -- Create a new build
        newBuild()

        -- Set class to Witch
        build.spec:SelectClass("Witch")
        runCallback("OnFrame")

        -- Add a skill
        build.skillsTab:PasteSocketGroup("Raise Zombie 1/0  1\n")
        runCallback("OnFrame")

        -- Get output stats
        local output = build.calcsTab.mainOutput

        -- Print as JSON-like format
        print("=== POB2 CLI OUTPUT ===")
        print("class: " .. (build.spec.curClassName or "none"))
        print("ascendancy: " .. (build.spec.curAscendClassName or "none"))
        print("life: " .. (output.Life or 0))
        print("energyShield: " .. (output.EnergyShield or 0))
        print("mana: " .. (output.Mana or 0))
        print("armour: " .. (output.Armour or 0))
        print("evasion: " .. (output.Evasion or 0))
        print("=== END OUTPUT ===")

        assert.True(true)
    end)
end)
