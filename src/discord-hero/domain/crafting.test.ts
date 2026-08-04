import { describe, expect, test } from "bun:test";
import rawCraftingRecipes from "../../../preferences/taskbarhero/raw-data/current/datasets/crafting_recipes.json";
import rawCubeSubRecipes from "../../../preferences/taskbarhero/raw-data/current/datasets/cube_sub_recipes.json";
import rawDrops from "../../../preferences/taskbarhero/raw-data/current/datasets/drops.json";
import rawExtractionCosts from "../../../preferences/taskbarhero/raw-data/current/datasets/extraction_costs.json";
import rawGear from "../../../preferences/taskbarhero/raw-data/current/datasets/gear.json";
import rawGearTypeScales from "../../../preferences/taskbarhero/raw-data/current/datasets/gear_type_scales.json";
import rawGrades from "../../../preferences/taskbarhero/raw-data/current/datasets/grades.json";
import rawItemGroups from "../../../preferences/taskbarhero/raw-data/current/datasets/item_groups.json";
import rawItemLevelScales from "../../../preferences/taskbarhero/raw-data/current/datasets/item_level_scales.json";
import rawItems from "../../../preferences/taskbarhero/raw-data/current/datasets/items.json";
import rawItemTypeScales from "../../../preferences/taskbarhero/raw-data/current/datasets/item_type_scales.json";
import rawMaterials from "../../../preferences/taskbarhero/raw-data/current/datasets/materials.json";
import rawStatModGroups from "../../../preferences/taskbarhero/raw-data/current/datasets/stat_mod_groups.json";
import rawStatMods from "../../../preferences/taskbarhero/raw-data/current/datasets/stat_mods.json";
import rawSynthesisDrops from "../../../preferences/taskbarhero/raw-data/current/datasets/synthesis_drops.json";
import rawSynthesisRecipes from "../../../preferences/taskbarhero/raw-data/current/datasets/synthesis_recipes.json";
import type { GearAsset, SlotContainer } from "./player";
import type { SourceDropRow, SourceItemGroupRow } from "./drops";
import {
  OracleRequiredError,
  type InventoryDebit,
  type SourceItemRow,
  type SourceStatModRow,
} from "./items";
import {
  executeAlchemy,
  executeCrafting,
  executeEnchantment,
  executeExtraction,
  executeOffering,
  executeSynthesis,
  parseMaterialRequirements,
  type CraftingRecipeRow,
  type CubeInventoryState,
  type CubeSubRecipeRow,
  type ExtractionCostRow,
  type GradeRow,
  type MaterialRow,
  type StatModGroupRow,
  type SynthesisDropRow,
  type SynthesisRecipeRow,
} from "./crafting";

const CRAFTING_RECIPES = rawCraftingRecipes as readonly CraftingRecipeRow[];
const CUBE_SUB_RECIPES = rawCubeSubRecipes as readonly CubeSubRecipeRow[];
const DROPS = rawDrops as readonly SourceDropRow[];
const EXTRACTION_COSTS = rawExtractionCosts as readonly ExtractionCostRow[];
const GRADES = rawGrades as readonly GradeRow[];
const ITEM_GROUPS = rawItemGroups as readonly SourceItemGroupRow[];
const ITEMS = rawItems as readonly SourceItemRow[];
const MATERIALS = rawMaterials as readonly MaterialRow[];
const STAT_MOD_GROUPS = rawStatModGroups as readonly StatModGroupRow[];
const STAT_MODS = rawStatMods as readonly SourceStatModRow[];
const SYNTHESIS_DROPS = rawSynthesisDrops as readonly SynthesisDropRow[];
const SYNTHESIS_RECIPES = rawSynthesisRecipes as readonly SynthesisRecipeRow[];
const VALUE_SOURCE = {
  items: rawItems,
  gear: rawGear,
  grades: rawGrades,
  itemLevelScales: rawItemLevelScales,
  gearTypeScales: rawGearTypeScales,
  itemTypeScales: rawItemTypeScales,
};

function state(
  slots: SlotContainer["slots"],
  gold = 1_000,
): CubeInventoryState {
  return {
    inventory: { unlockedSlots: 20, slots },
    gold,
    cubeExperience: 0,
    cubeLevel: 1,
  };
}

function gear(
  instanceId: string,
  itemKey: number,
  rolledStats: GearAsset["rolledStats"] = [],
): GearAsset {
  return { kind: "gear", instanceId, itemKey, rolledStats };
}

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) throw new Error("test RNG exhausted");
    index += 1;
    return value;
  };
}

describe("DiscordHero Cube source coverage", () => {
  test("covers all 8 operations and exact source unlock levels/costs", () => {
    const main = new Map(
      CUBE_SUB_RECIPES.filter((row) =>
        [
          "ALCHEMY",
          "DECORATION",
          "ENGRAVING",
          "INSCRIPTION",
          "EXTRACTION",
        ].includes(row.RECIPETYPE),
      ).map((row) => [row.RECIPETYPE, [row.UnlockCubeLevel, row.UnlockCost]]),
    );

    expect(new Set(CUBE_SUB_RECIPES.map((row) => row.RECIPETYPE))).toEqual(
      new Set([
        "SYNTHESIS",
        "ALCHEMY",
        "CRAFTING",
        "DECORATION",
        "ENGRAVING",
        "INSCRIPTION",
        "OFFERING",
        "EXTRACTION",
      ]),
    );
    expect(main).toEqual(
      new Map([
        ["ALCHEMY", [1, 10]],
        ["DECORATION", [8, 300]],
        ["ENGRAVING", [15, 1_000]],
        ["INSCRIPTION", [25, 10_000]],
        ["EXTRACTION", [10, 1_000]],
      ]),
    );
    expect(
      CUBE_SUB_RECIPES.find(
        (row) => row.RECIPETYPE === "CRAFTING" && row.RecipeTier === 1,
      ),
    ).toMatchObject({ UnlockCubeLevel: 5, UnlockCost: 100 });
    expect(
      CUBE_SUB_RECIPES.find((row) => row.CubeSubRecipeKey === 700011),
    ).toMatchObject({ UnlockCubeLevel: 20, UnlockCost: 3_000 });
  });

  test("parses every crafting material string exactly and totals 78 source units", () => {
    const requirements = CRAFTING_RECIPES.map((row) =>
      parseMaterialRequirements(row.Material),
    );

    expect(CRAFTING_RECIPES).toHaveLength(56);
    expect(
      requirements
        .flat()
        .reduce((total, requirement) => total + requirement.quantity, 0),
    ).toBe(78);
    expect(
      parseMaterialRequirements(
        CRAFTING_RECIPES.find((row) => row.CraftingRecipeKey === 6001003)!
          .Material,
      ),
    ).toEqual([{ kind: "stack", itemKey: 140001, quantity: 1 }]);
    expect(() => parseMaterialRequirements("140001_1_bad")).toThrow(
      "invalid material token",
    );
  });
});

describe("DiscordHero Alchemy", () => {
  test("rejects zero and more than nine source items without mutation", () => {
    const before = state([]);
    const snapshot = structuredClone(before);
    expect(() =>
      executeAlchemy({
        state: before,
        materials: [],
        source: VALUE_SOURCE,
        bonuses: { alchemyGold: 0, cubeExperience: 0 },
      }),
    ).toThrow("between 1 and 9");
    expect(() =>
      executeAlchemy({
        state: before,
        materials: Array.from({ length: 10 }, (_, index) => ({
          kind: "gear" as const,
          instanceId: `never-resolved-${index}`,
        })),
        source: VALUE_SOURCE,
        bonuses: { alchemyGold: 0, cubeExperience: 0 },
      }),
    ).toThrow("between 1 and 9");
    expect(before).toEqual(snapshot);
  });
});

describe("DiscordHero Crafting", () => {
  test("oracle-gates all 16 unresolved drop tables before RNG or mutation", () => {
    const blockedRecipes = CRAFTING_RECIPES.filter((row) =>
      ["MainWeapon", "SubWeapon"].includes(row.ItemCraftingType),
    );
    let calls = 0;

    expect(blockedRecipes).toHaveLength(16);
    for (const recipe of blockedRecipes) {
      const requirements = parseMaterialRequirements(recipe.Material);
      const before = state(
        requirements.map((requirement, index) => ({
          index,
          asset: {
            kind: "stack" as const,
            itemKey: requirement.itemKey,
            quantity: requirement.quantity,
          },
        })),
      );
      const snapshot = structuredClone(before);
      expect(() =>
        executeCrafting({
          state: before,
          recipe,
          drops: DROPS,
          itemGroups: ITEM_GROUPS,
          source: VALUE_SOURCE,
          bonuses: { cubeExperience: 0 },
          destinationIndex: 19,
          outputGearInstanceId: `blocked-${recipe.CraftingRecipeKey}`,
          rng: () => {
            calls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(before).toEqual(snapshot);
    }
    expect(calls).toBe(0);
  });

  test("oracle-gates all 40 otherwise deterministic recipes on null-level material EXP", () => {
    const deterministicDropRecipes = CRAFTING_RECIPES.filter((row) =>
      ["Helmet", "Armor", "Gloves", "Boots", "Accessory"].includes(
        row.ItemCraftingType,
      ),
    );
    let calls = 0;

    expect(deterministicDropRecipes).toHaveLength(40);
    for (const recipe of deterministicDropRecipes) {
      const requirements = parseMaterialRequirements(recipe.Material);
      const slots = requirements.map((requirement, index) => ({
        index,
        asset: {
          kind: "stack" as const,
          itemKey: requirement.itemKey,
          quantity: requirement.quantity,
        },
      }));
      const before = state(slots);
      const snapshot = structuredClone(before);
      expect(() =>
        executeCrafting({
          state: before,
          recipe,
          drops: DROPS,
          itemGroups: ITEM_GROUPS,
          source: VALUE_SOURCE,
          bonuses: { cubeExperience: 0 },
          destinationIndex: 19,
          outputGearInstanceId: `craft-${recipe.CraftingRecipeKey}`,
          rng: () => {
            calls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(before).toEqual(snapshot);
    }
    expect(calls).toBe(0);
  });
});

describe("DiscordHero Synthesis", () => {
  test("oracle-gates 525 ranged levels and 4 deterministic Gear drops before RNG/mutation", () => {
    const ranged = SYNTHESIS_RECIPES.filter(
      (row) => row.MinResultLevel !== row.MaxResultLevel,
    );
    const deterministicGear = SYNTHESIS_RECIPES.filter(
      (row) =>
        row.MinResultLevel === row.MaxResultLevel &&
        row.ItemSynthesisType === "Gear",
    );
    const before = state([]);
    let calls = 0;
    const base = {
      state: before,
      materials: [],
      synthesisDrops: SYNTHESIS_DROPS,
      drops: DROPS,
      itemGroups: ITEM_GROUPS,
      source: VALUE_SOURCE,
      bonuses: { cubeExperience: 0 },
      destinationIndex: 0,
      outputGearInstanceId: "never-created",
      rng: () => {
        calls += 1;
        return 0;
      },
    };

    expect(ranged).toHaveLength(525);
    expect(deterministicGear).toHaveLength(4);
    expect(() => executeSynthesis({ ...base, recipe: ranged[0]! })).toThrow(
      OracleRequiredError,
    );
    expect(() =>
      executeSynthesis({ ...base, recipe: deterministicGear[0]! }),
    ).toThrow(OracleRequiredError);
    expect(calls).toBe(0);
    expect(before).toEqual(state([]));
  });

  test("executes exactly 2 deterministic Accessory recipes and rejects dead paths", () => {
    const executableKeys = [10200111, 10200112];

    for (const recipeKey of executableKeys) {
      const recipe = SYNTHESIS_RECIPES.find(
        (row) => row.SynthesisRecipeKey === recipeKey,
      )!;
      const sourceItem = ITEMS.find(
        (item) =>
          item.type === "GEAR" &&
          item.gear === "AMULET" &&
          item.grade === recipe.GRADE &&
          item.level === 1,
      )!;
      const materials = Array.from({ length: 9 }, (_, index) => ({
        kind: "gear" as const,
        instanceId: `synthesis-${recipeKey}-${index}`,
      }));
      const result = executeSynthesis({
        state: state(
          materials.map((material, index) => ({
            index,
            asset: gear(material.instanceId, sourceItem.id),
          })),
        ),
        recipe,
        materials,
        synthesisDrops: SYNTHESIS_DROPS,
        drops: DROPS,
        itemGroups: ITEM_GROUPS,
        source: VALUE_SOURCE,
        bonuses: { cubeExperience: 0 },
        destinationIndex: 19,
        outputGearInstanceId: `synthesis-output-${recipeKey}`,
        rng: sequence(0, 0),
      });

      expect(result.inventory.slots).toHaveLength(1);
      expect(result.inventory.slots[0]!.asset.kind).toBe("gear");
      expect(result.cubeExperience).toBeGreaterThan(0);
    }

    const legendary = SYNTHESIS_RECIPES.find(
      (row) => row.SynthesisRecipeKey === 10200113,
    )!;
    let calls = 0;
    expect(() =>
      executeSynthesis({
        state: state([]),
        recipe: legendary,
        materials: [],
        synthesisDrops: SYNTHESIS_DROPS,
        drops: DROPS,
        itemGroups: ITEM_GROUPS,
        source: VALUE_SOURCE,
        bonuses: { cubeExperience: 0 },
        destinationIndex: 0,
        outputGearInstanceId: "missing-path",
        rng: () => {
          calls += 1;
          return 0;
        },
      }),
    ).toThrow(OracleRequiredError);
    expect(calls).toBe(0);

    const common = SYNTHESIS_RECIPES.find(
      (row) => row.SynthesisRecipeKey === 10200110,
    )!;
    expect(() =>
      executeSynthesis({
        state: state([]),
        recipe: common,
        materials: [],
        synthesisDrops: SYNTHESIS_DROPS,
        drops: DROPS,
        itemGroups: ITEM_GROUPS,
        source: VALUE_SOURCE,
        bonuses: { cubeExperience: 0 },
        destinationIndex: 0,
        outputGearInstanceId: "dead-recipe",
        rng: () => {
          calls += 1;
          return 0;
        },
      }),
    ).toThrow("no source material candidates");
    expect(calls).toBe(0);
  });
});

describe("DiscordHero Decoration, Engraving, and Inscription", () => {
  test("executes the corpus's deterministic Decoration row without RNG", () => {
    const before = state([
      { index: 0, asset: gear("decorate-me", 631099) },
      { index: 1, asset: { kind: "stack", itemKey: 119001, quantity: 1 } },
    ]);
    let calls = 0;

    const after = executeEnchantment({
      state: before,
      operation: "DECORATION",
      gearInstanceId: "decorate-me",
      gearGroup: "ACCESSORY",
      gearTier: 10,
      occupiedSlotCount: 0,
      availableSlotCount: 2,
      materialItemKey: 119001,
      materials: MATERIALS,
      statModGroups: STAT_MOD_GROUPS,
      statMods: STAT_MODS,
      rng: () => {
        calls += 1;
        return 0;
      },
    });

    expect(calls).toBe(0);
    expect(after.inventory.slots).toEqual([
      {
        index: 0,
        asset: gear("decorate-me", 631099, [{ statModKey: 101001, value: 1 }]),
      },
    ]);
  });

  test("oracle-gates unresolved random mod values before RNG or material debit", () => {
    const before = state([
      { index: 0, asset: gear("decorate-me", 631001) },
      { index: 1, asset: { kind: "stack", itemKey: 110001, quantity: 1 } },
    ]);
    const snapshot = structuredClone(before);
    let calls = 0;

    expect(() =>
      executeEnchantment({
        state: before,
        operation: "DECORATION",
        gearInstanceId: "decorate-me",
        gearGroup: "ACCESSORY",
        gearTier: 1,
        occupiedSlotCount: 0,
        availableSlotCount: 1,
        materialItemKey: 110001,
        materials: MATERIALS,
        statModGroups: STAT_MOD_GROUPS,
        statMods: STAT_MODS,
        rng: () => {
          calls += 1;
          return 0;
        },
      }),
    ).toThrow(OracleRequiredError);
    expect(calls).toBe(0);
    expect(before).toEqual(snapshot);
  });

  test("finds exactly 4 deterministic Decoration, 1 Engraving, and 0 Inscription combinations", () => {
    const deterministic = {
      DECORATION: 0,
      ENGRAVING: 0,
      INSCRIPTION: 0,
    };

    for (const material of MATERIALS) {
      if (!(material.MATERIALTYPE in deterministic)) continue;
      for (const group of STAT_MOD_GROUPS.filter(
        (candidate) => candidate.StatModGroupKey === material.StatModGroupKey,
      )) {
        for (let tier = group.MinTier; tier <= group.MaxTier; tier += 1) {
          const statRows = STAT_MODS.filter(
            (stat) =>
              stat.StatModKey === group.StatModKey && stat.Tier === tier,
          );
          if (
            statRows.length === 1 &&
            statRows[0]!.MinValue === statRows[0]!.MaxValue
          ) {
            deterministic[
              material.MATERIALTYPE as keyof typeof deterministic
            ] += 1;
          }
        }
      }
    }

    expect(deterministic).toEqual({
      DECORATION: 4,
      ENGRAVING: 1,
      INSCRIPTION: 0,
    });
  });
});

describe("DiscordHero Offering and Extraction", () => {
  test("oracle-gates all 10 Offering tables before RNG, gold charge, or material debit", () => {
    const offerings = CUBE_SUB_RECIPES.filter(
      (row) => row.RECIPETYPE === "OFFERING",
    );
    let calls = 0;

    expect(offerings).toHaveLength(10);
    for (const recipe of offerings) {
      const requirement = parseMaterialRequirements(recipe.Material!)[0]!;
      const before = state(
        [
          {
            index: 0,
            asset: {
              kind: "stack",
              itemKey: requirement.itemKey,
              quantity: requirement.quantity,
            },
          },
        ],
        recipe.TriggerGoldCost!,
      );
      const snapshot = structuredClone(before);
      expect(() =>
        executeOffering({
          state: before,
          recipe,
          drops: DROPS,
          itemGroups: ITEM_GROUPS,
          source: VALUE_SOURCE,
          bonuses: { cubeExperience: 0 },
          destinationIndex: 4,
          rng: () => {
            calls += 1;
            return 0;
          },
        }),
      ).toThrow(OracleRequiredError);
      expect(before).toEqual(snapshot);
    }
    expect(calls).toBe(0);
  });

  test("oracle-gates forged Extraction provenance before cost selection or mutation", () => {
    const forgedTuples = [
      {
        gearGroup: "WEAPON",
        materialType: "DECORATION",
        gearTier: 1,
      },
      {
        gearGroup: "ACCESSORY",
        materialType: "INSCRIPTION",
        gearTier: 10,
      },
    ] as const;

    const attempts = forgedTuples.map((tuple) => {
      const before = state(
        [
          {
            index: 0,
            asset: gear("extract-me", 300001, [
              { statModKey: 100101, value: 1 },
              { statModKey: 101001, value: 1 },
            ]),
          },
        ],
        250_000,
      );
      const snapshot = structuredClone(before);
      let costLookups = 0;
      let result: CubeInventoryState | undefined;
      let error: unknown;

      const forgedInput = {
        state: before,
        gearInstanceId: "extract-me",
        rolledStatIndex: 0,
        ...tuple,
        get costs(): readonly ExtractionCostRow[] {
          costLookups += 1;
          return EXTRACTION_COSTS;
        },
      };

      try {
        result = executeExtraction(forgedInput);
      } catch (caught) {
        error = caught;
      }

      return {
        before,
        snapshot,
        error,
        costLookups,
        result,
        tuple: `${tuple.gearGroup}/${tuple.materialType}/${tuple.gearTier}`,
      };
    });

    expect(
      attempts.map((attempt) => ({
        tuple: attempt.tuple,
        oracleRequired: attempt.error instanceof OracleRequiredError,
        errorMessage:
          attempt.error instanceof Error ? attempt.error.message : null,
        costLookups: attempt.costLookups,
        returnedGold: attempt.result?.gold ?? null,
        returnedRolledStatCount:
          attempt.result?.inventory.slots[0]?.asset.kind === "gear"
            ? attempt.result.inventory.slots[0].asset.rolledStats.length
            : null,
      })),
    ).toEqual([
      {
        tuple: "WEAPON/DECORATION/1",
        oracleRequired: true,
        errorMessage:
          "source-backed applied-stat material type and tier provenance is required for Extraction",
        costLookups: 0,
        returnedGold: null,
        returnedRolledStatCount: null,
      },
      {
        tuple: "ACCESSORY/INSCRIPTION/10",
        oracleRequired: true,
        errorMessage:
          "source-backed applied-stat material type and tier provenance is required for Extraction",
        costLookups: 0,
        returnedGold: null,
        returnedRolledStatCount: null,
      },
    ]);
    for (const attempt of attempts) {
      expect(attempt.before).toEqual(attempt.snapshot);
      expect(attempt.before.gold).toBe(250_000);
      expect(attempt.before.inventory).toEqual(attempt.snapshot.inventory);
    }
  });

  test("rejects an out-of-range Extraction rolled-stat index without mutation", () => {
    const before = state(
      [
        {
          index: 0,
          asset: gear("extract-me", 300001, [{ statModKey: 100101, value: 1 }]),
        },
      ],
      1_000,
    );
    const snapshot = structuredClone(before);

    expect(() =>
      executeExtraction({
        state: before,
        gearInstanceId: "extract-me",
        rolledStatIndex: 1,
      }),
    ).toThrow("rolled stat index 1 is outside gear stat count 1");
    expect(before).toEqual(snapshot);
  });
});

describe("DiscordHero reviewed Cube transaction boundary", () => {
  test("derives gear Alchemy gold and EXP internally and rejects arbitrary yield fields", () => {
    const before = {
      ...state([{ index: 0, asset: gear("alchemy-gear-source", 300001) }], 100),
      cubeLevel: 1,
    };
    const input = {
      state: before,
      materials: [{ kind: "gear" as const, instanceId: "alchemy-gear-source" }],
      source: VALUE_SOURCE,
      bonuses: { alchemyGold: 0, cubeExperience: 0 },
    };

    const after = executeAlchemy(input);
    expect(after).toEqual({
      inventory: { unlockedSlots: 20, slots: [] },
      gold: 110,
      cubeExperience: 2,
      cubeLevel: 1,
    });

    const forgedMaterials = [
      {
        kind: "gear" as const,
        instanceId: "alchemy-gear-source",
        goldPerItem: Number.MAX_SAFE_INTEGER,
        cubeExperiencePerItem: Number.MAX_SAFE_INTEGER,
      },
    ];
    expect(() =>
      executeAlchemy({
        ...input,
        materials: forgedMaterials,
      }),
    ).toThrow("caller-supplied yield");
  });

  test("returns Alchemy state with no inventory aliases to caller state", () => {
    const before = state(
      [
        { index: 0, asset: gear("alchemy-consumed", 300001) },
        {
          index: 1,
          asset: { kind: "stack", itemKey: 140001, quantity: 2 },
        },
      ],
      100,
    );
    const after = executeAlchemy({
      state: before,
      materials: [{ kind: "gear", instanceId: "alchemy-consumed" }],
      source: VALUE_SOURCE,
      bonuses: { alchemyGold: 0, cubeExperience: 0 },
    });

    expect(after.inventory).not.toBe(before.inventory);
    expect(after.inventory.slots).not.toBe(before.inventory.slots);
    expect(after.inventory.slots[0]).not.toBe(before.inventory.slots[1]);
    expect(after.inventory.slots[0]!.asset).not.toBe(
      before.inventory.slots[1]!.asset,
    );
    if (
      before.inventory.slots[1]!.asset.kind !== "stack" ||
      after.inventory.slots[0]!.asset.kind !== "stack"
    ) {
      throw new Error("test fixture must contain an unconsumed stack");
    }
    before.inventory.slots[1]!.asset.quantity = 99;
    expect(after.inventory.slots[0]!.asset.quantity).toBe(2);
    after.inventory.slots[0]!.asset.quantity = 1;
    expect(before.inventory.slots[1]!.asset.quantity).toBe(99);
  });

  test("fails closed for null-level material Cube EXP before Crafting RNG or mutation", () => {
    const recipe = CRAFTING_RECIPES.find(
      (row) => row.CraftingRecipeKey === 6001003,
    )!;
    const before = {
      ...state([
        { index: 0, asset: { kind: "stack", itemKey: 140001, quantity: 1 } },
      ]),
      cubeLevel: 1,
    };
    const snapshot = structuredClone(before);
    let calls = 0;

    expect(() =>
      executeCrafting({
        state: before,
        recipe,
        drops: DROPS,
        itemGroups: ITEM_GROUPS,
        source: VALUE_SOURCE,
        bonuses: { cubeExperience: 0 },
        destinationIndex: 4,
        outputGearInstanceId: "craft-source-output",
        rng: () => {
          calls += 1;
          return 0;
        },
      }),
    ).toThrow(OracleRequiredError);
    expect(calls).toBe(0);
    expect(before).toEqual(snapshot);
  });

  test("rejects caller-supplied Crafting output before RNG", () => {
    const recipe = CRAFTING_RECIPES.find(
      (row) => row.CraftingRecipeKey === 6001003,
    )!;
    let calls = 0;

    const forgedInput = {
      state: {
        ...state([
          {
            index: 0,
            asset: { kind: "stack", itemKey: 140001, quantity: 1 },
          },
        ]),
        cubeLevel: 1,
      },
      recipe,
      drops: DROPS,
      itemGroups: ITEM_GROUPS,
      source: VALUE_SOURCE,
      bonuses: { cubeExperience: 0 },
      destinationIndex: 4,
      outputGearInstanceId: "canonical-id",
      output: {
        index: 4,
        asset: {
          kind: "stack",
          itemKey: 140001,
          quantity: Number.MAX_SAFE_INTEGER,
        },
      },
      rng: () => {
        calls += 1;
        return 0;
      },
    };
    expect(() => executeCrafting(forgedInput)).toThrow(
      "caller-supplied output",
    );
    expect(calls).toBe(0);
  });

  test("rejects spoofed or unsafe output gear IDs before Crafting RNG", () => {
    const recipe = CRAFTING_RECIPES.find(
      (row) => row.CraftingRecipeKey === 6001003,
    )!;
    let calls = 0;

    for (const outputGearInstanceId of [
      ["array-spoof"],
      { length: 1 },
      "unsafe\nid",
      "x".repeat(129),
    ]) {
      expect(() =>
        executeCrafting({
          state: state([
            {
              index: 0,
              asset: { kind: "stack", itemKey: 140001, quantity: 1 },
            },
          ]),
          recipe,
          drops: DROPS,
          itemGroups: ITEM_GROUPS,
          source: VALUE_SOURCE,
          bonuses: { cubeExperience: 0 },
          destinationIndex: 4,
          outputGearInstanceId: outputGearInstanceId as unknown as string,
          rng: () => {
            calls += 1;
            return 0;
          },
        }),
      ).toThrow("canonical stable instance ID");
    }
    expect(calls).toBe(0);
  });

  test("constructs Synthesis output from source and adds exact consumed-gear Cube EXP", () => {
    const recipe = SYNTHESIS_RECIPES.find(
      (row) => row.SynthesisRecipeKey === 10200111,
    )!;
    const materials = Array.from({ length: 9 }, (_, index) => ({
      kind: "gear" as const,
      instanceId: `review-synthesis-${index}`,
    }));
    const result = executeSynthesis({
      state: {
        ...state(
          materials.map((material, index) => ({
            index,
            asset: gear(material.instanceId, 601011),
          })),
        ),
        cubeLevel: 1,
      },
      recipe,
      materials,
      synthesisDrops: SYNTHESIS_DROPS,
      drops: DROPS,
      itemGroups: ITEM_GROUPS,
      source: VALUE_SOURCE,
      bonuses: { cubeExperience: 0 },
      destinationIndex: 12,
      outputGearInstanceId: "synthesis-source-output",
      rng: sequence(0, 0),
    });

    expect(result.cubeExperience).toBe(216);
    expect(result.inventory.slots).toEqual([
      {
        index: 12,
        asset: {
          kind: "gear",
          instanceId: "synthesis-source-output",
          itemKey: 602011,
          rolledStats: [],
        },
      },
    ]);
  });

  test("validates Synthesis output type, category, grade, and level before RNG", () => {
    const recipe = SYNTHESIS_RECIPES.find(
      (row) => row.SynthesisRecipeKey === 10200111,
    )!;
    const materials = Array.from({ length: 9 }, (_, index) => ({
      kind: "gear" as const,
      instanceId: `output-validation-${index}`,
    }));
    const sourceItem = ITEMS.find((item) => item.id === 602011)!;
    const invalidDefinitions = [
      { ...sourceItem, type: "MATERIAL", gear: null, level: null },
      { ...sourceItem, gear: "HELMET" },
      { ...sourceItem, grade: "LEGENDARY" },
      { ...sourceItem, level: 5 },
    ];
    let calls = 0;

    for (const invalid of invalidDefinitions) {
      expect(() =>
        executeSynthesis({
          state: {
            ...state(
              materials.map((material, index) => ({
                index,
                asset: gear(material.instanceId, 601011),
              })),
            ),
            cubeLevel: 1,
          },
          recipe,
          materials,
          synthesisDrops: SYNTHESIS_DROPS,
          drops: DROPS,
          itemGroups: ITEM_GROUPS,
          source: {
            ...VALUE_SOURCE,
            items: ITEMS.map((item) => (item.id === 602011 ? invalid : item)),
          },
          bonuses: { cubeExperience: 0 },
          destinationIndex: 12,
          outputGearInstanceId: "invalid-output",
          rng: () => {
            calls += 1;
            return 0;
          },
        }),
      ).toThrow();
    }
    expect(calls).toBe(0);
  });

  test("completes debit, destination, identity, and overflow preflight before Synthesis RNG", () => {
    const recipe = SYNTHESIS_RECIPES.find(
      (row) => row.SynthesisRecipeKey === 10200111,
    )!;
    const materials = Array.from({ length: 9 }, (_, index) => ({
      kind: "gear" as const,
      instanceId: `preflight-${index}`,
    }));
    const materialSlots = materials.map((material, index) => ({
      index,
      asset: gear(material.instanceId, 601011),
    }));
    let calls = 0;
    const attempt = (
      currentState: CubeInventoryState,
      outputGearInstanceId = "preflight-output",
    ): void => {
      executeSynthesis({
        state: currentState,
        recipe,
        materials,
        synthesisDrops: SYNTHESIS_DROPS,
        drops: DROPS,
        itemGroups: ITEM_GROUPS,
        source: VALUE_SOURCE,
        bonuses: { cubeExperience: 0 },
        destinationIndex: 12,
        outputGearInstanceId,
        rng: () => {
          calls += 1;
          return 0;
        },
      });
    };

    expect(() => attempt({ ...state([]), cubeLevel: 1 })).toThrow(
      "requires 9 items",
    );
    expect(() =>
      attempt({
        ...state([
          ...materialSlots,
          {
            index: 12,
            asset: { kind: "stack", itemKey: 140001, quantity: 1 },
          },
        ]),
        cubeLevel: 1,
      }),
    ).toThrow("occupied");
    expect(() =>
      attempt(
        {
          ...state([
            ...materialSlots,
            { index: 10, asset: gear("duplicate-id", 300001) },
          ]),
          cubeLevel: 1,
        },
        "duplicate-id",
      ),
    ).toThrow("duplicate gear instance");
    expect(() =>
      attempt({
        ...state(materialSlots),
        cubeLevel: 1,
        cubeExperience: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow("unsafe");
    expect(calls).toBe(0);
  });

  test("rejects caller-supplied Offering quantity before its source oracle", () => {
    const recipe = CUBE_SUB_RECIPES.find(
      (row) => row.CubeSubRecipeKey === 700011,
    )!;
    let calls = 0;

    const forgedInput = {
      state: {
        ...state([
          {
            index: 0,
            asset: { kind: "stack", itemKey: 160001, quantity: 1 },
          },
        ]),
        cubeLevel: 1,
      },
      recipe,
      drops: DROPS,
      itemGroups: ITEM_GROUPS,
      source: VALUE_SOURCE,
      bonuses: { cubeExperience: 0 },
      destinationIndex: 4,
      output: {
        index: 4,
        asset: { kind: "stack", itemKey: 140001, quantity: 999 },
      },
      rng: () => {
        calls += 1;
        return 0;
      },
    };
    expect(() => executeOffering(forgedInput)).toThrow(
      "caller-supplied output",
    );
    expect(calls).toBe(0);
  });

  test("Decoration never adds Cube EXP", () => {
    const decorated = executeEnchantment({
      state: {
        ...state([
          { index: 0, asset: gear("no-exp-decoration", 631099) },
          { index: 1, asset: { kind: "stack", itemKey: 119001, quantity: 1 } },
        ]),
        cubeExperience: 42,
      },
      operation: "DECORATION",
      gearInstanceId: "no-exp-decoration",
      gearGroup: "ACCESSORY",
      gearTier: 10,
      occupiedSlotCount: 0,
      availableSlotCount: 2,
      materialItemKey: 119001,
      materials: MATERIALS,
      statModGroups: STAT_MOD_GROUPS,
      statMods: STAT_MODS,
      rng: () => 0,
    });
    expect(decorated.cubeExperience).toBe(42);
  });
});
