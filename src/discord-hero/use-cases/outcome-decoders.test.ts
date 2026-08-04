import { describe, expect, test } from "bun:test";
import { decodeDiscordHeroAlchemyOutcome } from "./alchemy";
import { decodeDiscordHeroAllocateAttributePointOutcome } from "./allocate-attribute-point";
import { decodeDiscordHeroEquipGearOutcome } from "./equip-gear";
import { decodeDiscordHeroOpenWorkspaceOutcome } from "./open-workspace";
import { decodeDiscordHeroUnequipGearOutcome } from "./unequip-gear";
import { decodeDiscordHeroUnlockContainerSlotOutcome } from "./unlock-container-slot";
import { decodeDiscordHeroUnlockCubeRecipeOutcome } from "./unlock-cube-recipe";
import { decodeDiscordHeroUpgradeRuneOutcome } from "./upgrade-rune";

interface DecoderCase {
  readonly name: string;
  readonly decode: (value: unknown) => unknown;
  readonly valid: readonly Readonly<Record<string, unknown>>[];
  readonly numericField?: string;
  readonly wrongShape: Readonly<Record<string, unknown>>;
}

const decoderCases: readonly DecoderCase[] = [
  {
    name: "open workspace",
    decode: decodeDiscordHeroOpenWorkspaceOutcome,
    valid: [{ created: true }],
    wrongShape: { created: false },
  },
  {
    name: "unlock container slot",
    decode: decodeDiscordHeroUnlockContainerSlotOutcome,
    valid: [
      {
        kind: "unlocked",
        container: "inventory",
        slotIndex: 0,
        cost: 10,
        gold: 90,
        unlockedSlots: 21,
      },
      {
        kind: "insufficient-gold",
        container: "stash",
        slotIndex: 20,
        cost: 10,
        availableGold: 9,
      },
      {
        kind: "maximum-capacity",
        container: "storage",
        unlockedSlots: 101,
      },
      { kind: "player-not-found" },
    ],
    numericField: "slotIndex",
    wrongShape: {
      kind: "maximum-capacity",
      container: "unknown",
      unlockedSlots: 1,
    },
  },
  {
    name: "unlock Cube recipe",
    decode: decodeDiscordHeroUnlockCubeRecipeOutcome,
    valid: [
      {
        kind: "unlocked",
        cubeKey: 200001,
        defaultSubRecipeKeys: [200011],
        recipeType: "ALCHEMY",
        cost: 10,
        gold: 90,
      },
      {
        kind: "insufficient-gold",
        cubeKey: 200001,
        recipeType: "ALCHEMY",
        requiredCubeLevel: 1,
        cost: 10,
        availableGold: 9,
      },
      {
        kind: "already-unlocked",
        cubeKey: 200001,
        recipeType: "ALCHEMY",
      },
      {
        kind: "level-locked",
        cubeKey: 600001,
        recipeType: "CRAFTING",
        requiredCubeLevel: 5,
        currentCubeLevel: 1,
      },
      { kind: "player-not-found" },
    ],
    numericField: "cubeKey",
    wrongShape: {
      kind: "unlocked",
      cubeKey: 200001,
      defaultSubRecipeKeys: [200011, 200011],
      recipeType: "ALCHEMY",
      cost: 10,
      gold: 90,
    },
  },
  {
    name: "upgrade Rune",
    decode: decodeDiscordHeroUpgradeRuneOutcome,
    valid: [
      {
        kind: "upgraded",
        runeKey: 1,
        name: "Rune",
        level: 1,
        cost: 100,
        gold: 0,
        statType: "Attack",
        value: 1,
      },
      {
        kind: "insufficient-gold",
        runeKey: 1,
        name: "Rune",
        nextLevel: 1,
        cost: 100,
        availableGold: 99,
      },
      { kind: "maximum-level", runeKey: 1, name: "Rune", level: 5 },
      {
        kind: "prerequisite-locked",
        runeKey: 2,
        name: "Rune",
        currentLevel: 0,
        requiredLevel: 1,
        predecessorKeys: [1],
      },
      { kind: "player-not-found" },
    ],
    numericField: "runeKey",
    wrongShape: { kind: "maximum-level", runeKey: 1, name: "", level: 5 },
  },
  {
    name: "allocate Attribute point",
    decode: decodeDiscordHeroAllocateAttributePointOutcome,
    valid: [
      {
        kind: "allocated",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        level: 1,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "maximum-level",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        level: 3,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: 3,
        pointBudget: 3,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "group-locked",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        currentLevel: 0,
        maximumLevel: 8,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 10,
        remainingPoints: 9,
        groupRequiredAllocatedPoint: 10,
      },
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101002,
        groupKey: 10001,
        currentLevel: 0,
        nextLevel: 1,
        maximumLevel: 8,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      { kind: "hero-not-owned", heroKey: 401 },
      { kind: "player-not-found" },
    ],
    numericField: "heroKey",
    wrongShape: {
      kind: "maximum-level",
      heroKey: 101,
      attributeKey: 101001,
      groupKey: 10001,
      level: 2,
      maximumLevel: 3,
      requiredPoint: 1,
      spentPoints: 2,
      pointBudget: 3,
      remainingPoints: 1,
      groupRequiredAllocatedPoint: 0,
    },
  },
  {
    name: "equip gear",
    decode: decodeDiscordHeroEquipGearOutcome,
    valid: [
      {
        kind: "equipped",
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 0,
        instanceId: "gear-1",
        itemKey: 300001,
      },
      { kind: "hero-not-owned", heroKey: 101 },
      {
        kind: "inventory-slot-locked",
        inventorySlotIndex: 20,
        unlockedSlots: 20,
      },
      { kind: "inventory-slot-empty", inventorySlotIndex: 0 },
      {
        kind: "inventory-slot-not-gear",
        inventorySlotIndex: 0,
        itemKey: 140001,
      },
      {
        kind: "incompatible-gear",
        heroKey: 101,
        gearType: "BOW",
        itemKey: 310001,
      },
      {
        kind: "equipment-slot-occupied",
        heroKey: 101,
        gearType: "SWORD",
        instanceId: "gear-2",
      },
      { kind: "player-not-found" },
    ],
    numericField: "heroKey",
    wrongShape: {
      kind: "equipped",
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 0,
      instanceId: "",
      itemKey: 300001,
    },
  },
  {
    name: "unequip gear",
    decode: decodeDiscordHeroUnequipGearOutcome,
    valid: [
      {
        kind: "unequipped",
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 0,
        instanceId: "gear-1",
        itemKey: 300001,
      },
      { kind: "hero-not-owned", heroKey: 101 },
      {
        kind: "inventory-slot-locked",
        inventorySlotIndex: 20,
        unlockedSlots: 20,
      },
      { kind: "inventory-slot-occupied", inventorySlotIndex: 0 },
      { kind: "equipment-slot-empty", heroKey: 101, gearType: "SWORD" },
      { kind: "player-not-found" },
    ],
    numericField: "heroKey",
    wrongShape: {
      kind: "equipment-slot-empty",
      heroKey: 101,
      gearType: "",
    },
  },
  {
    name: "Alchemy",
    decode: decodeDiscordHeroAlchemyOutcome,
    valid: [
      {
        kind: "alchemized",
        consumedItems: 1,
        goldGained: 10,
        cubeExperienceGained: 2,
        gold: 110,
        cubeLevel: 1,
        cubeXp: 2,
      },
      { kind: "recipe-locked" },
      { kind: "player-not-found" },
    ],
    numericField: "gold",
    wrongShape: {
      kind: "alchemized",
      consumedItems: 10,
      goldGained: 10,
      cubeExperienceGained: 2,
      gold: 110,
      cubeLevel: 1,
      cubeXp: 2,
    },
  },
];

describe("DiscordHero persisted operation outcome decoders", () => {
  for (const candidate of decoderCases) {
    test(`${candidate.name} accepts every exact outcome variant`, () => {
      for (const valid of candidate.valid) {
        expect(candidate.decode(valid)).toEqual(valid);
      }
    });

    test(`${candidate.name} rejects forged contracts`, () => {
      const base = candidate.valid[0]!;
      const missing = { ...base };
      delete missing[Object.keys(missing).find((key) => key !== "kind")!];
      for (const forged of [
        { ...base, extra: true },
        "kind" in base ? { ...base, kind: "forged" } : { kind: "forged" },
        missing,
        candidate.wrongShape,
        [],
        null,
      ]) {
        expect(() => candidate.decode(forged)).toThrow();
      }
    });

    if (candidate.numericField !== undefined) {
      test(`${candidate.name} rejects non-canonical numeric fields`, () => {
        const base = candidate.valid[0]!;
        for (const forgedNumber of [
          Number.MAX_SAFE_INTEGER + 1,
          Number.POSITIVE_INFINITY,
          Number.NaN,
          -1,
          -0,
          1.5,
        ]) {
          expect(() =>
            candidate.decode({
              ...base,
              [candidate.numericField!]: forgedNumber,
            }),
          ).toThrow();
        }
      });
    }
  }
});
