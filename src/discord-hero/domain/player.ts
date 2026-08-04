import { z } from "zod";
import type { DiscordHeroStarterKey } from "./party";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MAX_HEROES = 6;
const MAX_INVENTORY_SLOTS = 260;
const MAX_STASH_SLOTS = 131;
const MAX_STORAGE_SLOTS = 101;
const MAX_TRADING_STASH_SLOTS = 10;
const MAX_RUNES = 197;
const MAX_PETS = 8;
const MAX_SKINS = 100;
const MAX_STAGES = 120;
const MAX_PENDING_REWARD_ITEMS = MAX_INVENTORY_SLOTS;

export const CatalogKeySchema = z
  .number()
  .int()
  .positive()
  .max(MAX_SAFE_INTEGER);
export const UnsignedIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_SAFE_INTEGER);

function uniqueNumericField<T extends Record<string, unknown>>(
  values: T[],
  field: keyof T,
  context: z.RefinementCtx,
  label: string,
): void {
  const seen = new Set<number>();
  for (const [index, value] of values.entries()) {
    const key = value[field] as number;
    if (seen.has(key)) {
      context.addIssue({
        code: "custom",
        message: `${label} contains duplicate key ${key}`,
        path: [index, field as string],
      });
    }
    seen.add(key);
  }
}

function uniqueNumbers(
  values: number[],
  context: z.RefinementCtx,
  label: string,
): void {
  const seen = new Set<number>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        message: `${label} contains duplicate key ${value}`,
        path: [index],
      });
    }
    seen.add(value);
  }
}

export const PartySchema = z
  .tuple([
    CatalogKeySchema.nullable(),
    CatalogKeySchema.nullable(),
    CatalogKeySchema.nullable(),
  ])
  .superRefine((party, context) => {
    const occupied = party.filter(
      (heroKey): heroKey is number => heroKey !== null,
    );
    uniqueNumbers(occupied, context, "party");
  });

export const RolledStatSchema = z
  .object({
    statModKey: CatalogKeySchema,
    value: z.number().finite(),
  })
  .strict();

export const GearAssetSchema = z
  .object({
    kind: z.literal("gear"),
    instanceId: z.string().min(1).max(128),
    itemKey: CatalogKeySchema,
    rolledStats: z.array(RolledStatSchema).max(620),
  })
  .strict();

export const StackAssetSchema = z
  .object({
    kind: z.literal("stack"),
    itemKey: CatalogKeySchema,
    quantity: z.number().int().positive().max(MAX_SAFE_INTEGER),
  })
  .strict();

export const StoredAssetSchema = z.discriminatedUnion("kind", [
  GearAssetSchema,
  StackAssetSchema,
]);

export const SlotContainerSchema = z
  .object({
    unlockedSlots: UnsignedIntegerSchema,
    slots: z.array(
      z
        .object({
          index: UnsignedIntegerSchema,
          asset: StoredAssetSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((container, context) => {
    const seenSlots = new Set<number>();
    for (const [position, slot] of container.slots.entries()) {
      if (slot.index >= container.unlockedSlots) {
        context.addIssue({
          code: "custom",
          message: `slot ${slot.index} is outside unlocked capacity ${container.unlockedSlots}`,
          path: ["slots", position, "index"],
        });
      }
      if (seenSlots.has(slot.index)) {
        context.addIssue({
          code: "custom",
          message: `container repeats slot ${slot.index}`,
          path: ["slots", position, "index"],
        });
      }
      seenSlots.add(slot.index);
    }
  });

const LeveledCatalogEntrySchema = z
  .object({
    key: CatalogKeySchema,
    level: UnsignedIntegerSchema,
  })
  .strict();

const EquippedGearSchema = z
  .object({
    slot: z.string().min(1).max(64),
    asset: GearAssetSchema,
  })
  .strict();

const EquippedSkinSchema = z
  .object({
    partsCategory: z.string().min(1).max(64),
    skinKey: CatalogKeySchema,
  })
  .strict();

export const HeroProgressSchema = z
  .object({
    heroKey: CatalogKeySchema,
    level: z.number().int().positive().max(100),
    xp: UnsignedIntegerSchema,
    attributes: z.array(LeveledCatalogEntrySchema).max(132),
    skills: z.array(LeveledCatalogEntrySchema).max(106),
    passives: z.array(LeveledCatalogEntrySchema).max(108),
    equipment: z.array(EquippedGearSchema).max(20),
    skins: z.array(EquippedSkinSchema).max(MAX_SKINS),
  })
  .strict()
  .superRefine((hero, context) => {
    uniqueNumericField(hero.attributes, "key", context, "attributes");
    uniqueNumericField(hero.skills, "key", context, "skills");
    uniqueNumericField(hero.passives, "key", context, "passives");

    const equipmentSlots = new Set<string>();
    for (const [index, equipment] of hero.equipment.entries()) {
      if (equipmentSlots.has(equipment.slot)) {
        context.addIssue({
          code: "custom",
          message: `equipment repeats slot ${equipment.slot}`,
          path: ["equipment", index, "slot"],
        });
      }
      equipmentSlots.add(equipment.slot);
    }

    const skinParts = new Set<string>();
    for (const [index, skin] of hero.skins.entries()) {
      if (skinParts.has(skin.partsCategory)) {
        context.addIssue({
          code: "custom",
          message: `skins repeat category ${skin.partsCategory}`,
          path: ["skins", index, "partsCategory"],
        });
      }
      skinParts.add(skin.partsCategory);
    }
  });

const CampaignStageSchema = z
  .object({
    stageKey: CatalogKeySchema,
    clearCount: UnsignedIntegerSchema,
    firstClearClaimed: z.boolean(),
    bestClearMs: UnsignedIntegerSchema.nullable(),
  })
  .strict();

const StageSessionSchema = z
  .object({
    sessionId: z.string().min(1).max(128),
    stageKey: CatalogKeySchema,
    party: PartySchema,
    startedAtMs: UnsignedIntegerSchema,
    advancedThroughMs: UnsignedIntegerSchema,
    wave: UnsignedIntegerSchema,
    rngSeed: z.string().min(1).max(256),
    rngCursor: UnsignedIntegerSchema,
    pendingRewards: z
      .object({
        gold: UnsignedIntegerSchema,
        xp: UnsignedIntegerSchema,
        items: z.array(StoredAssetSchema).max(MAX_PENDING_REWARD_ITEMS),
      })
      .strict(),
  })
  .strict();

export const PlayerStateSchema = z
  .object({
    version: z.literal(1),
    gold: UnsignedIntegerSchema,
    party: PartySchema,
    heroes: z.array(HeroProgressSchema).max(MAX_HEROES),
    containers: z
      .object({
        inventory: SlotContainerSchema,
        stash: SlotContainerSchema,
        storage: SlotContainerSchema,
        tradingStash: SlotContainerSchema,
      })
      .strict(),
    cube: z
      .object({
        level: z.number().int().positive().max(100),
        xp: UnsignedIntegerSchema,
        unlockedRecipes: z.array(CatalogKeySchema).max(8),
        unlockedSubRecipes: z.array(CatalogKeySchema).max(31),
      })
      .strict(),
    runes: z.array(LeveledCatalogEntrySchema).max(MAX_RUNES),
    pets: z
      .object({
        unlocked: z.array(CatalogKeySchema).max(MAX_PETS),
        active: CatalogKeySchema.nullable(),
      })
      .strict(),
    skins: z
      .object({
        unlocked: z.array(CatalogKeySchema).max(MAX_SKINS),
      })
      .strict(),
    offline: z
      .object({
        accrualCursorMs: UnsignedIntegerSchema,
        rewardStageLevel: UnsignedIntegerSchema,
      })
      .strict(),
    campaign: z
      .object({
        highestStageKey: CatalogKeySchema.nullable(),
        stages: z.array(CampaignStageSchema).max(MAX_STAGES),
      })
      .strict(),
    stageSession: StageSessionSchema.nullable(),
  })
  .strict()
  .superRefine((player, context) => {
    uniqueNumericField(player.heroes, "heroKey", context, "heroes");
    uniqueNumericField(player.runes, "key", context, "runes");
    uniqueNumbers(player.pets.unlocked, context, "pets.unlocked");
    uniqueNumbers(player.skins.unlocked, context, "skins.unlocked");
    uniqueNumericField(
      player.campaign.stages,
      "stageKey",
      context,
      "campaign.stages",
    );
    uniqueNumbers(player.cube.unlockedRecipes, context, "cube.unlockedRecipes");
    uniqueNumbers(
      player.cube.unlockedSubRecipes,
      context,
      "cube.unlockedSubRecipes",
    );

    const containerLimits = {
      inventory: MAX_INVENTORY_SLOTS,
      stash: MAX_STASH_SLOTS,
      storage: MAX_STORAGE_SLOTS,
      tradingStash: MAX_TRADING_STASH_SLOTS,
    } as const;
    for (const [name, limit] of Object.entries(containerLimits)) {
      const container =
        player.containers[name as keyof typeof player.containers];
      if (container.unlockedSlots > limit) {
        context.addIssue({
          code: "custom",
          message: `${name} unlocked capacity exceeds catalog maximum ${limit}`,
          path: ["containers", name, "unlockedSlots"],
        });
      }
      if (container.slots.length > limit) {
        context.addIssue({
          code: "custom",
          message: `${name} contains more than ${limit} slots`,
          path: ["containers", name, "slots"],
        });
      }
    }

    const ownedHeroes = new Set(player.heroes.map((hero) => hero.heroKey));
    for (const [index, heroKey] of player.party.entries()) {
      if (heroKey !== null && !ownedHeroes.has(heroKey)) {
        context.addIssue({
          code: "custom",
          message: `party hero ${heroKey} is not owned`,
          path: ["party", index],
        });
      }
    }
    for (const [index, heroKey] of player.stageSession?.party.entries() ?? []) {
      if (heroKey !== null && !ownedHeroes.has(heroKey)) {
        context.addIssue({
          code: "custom",
          message: `stage session hero ${heroKey} is not owned`,
          path: ["stageSession", "party", index],
        });
      }
    }
    if (
      player.pets.active !== null &&
      !player.pets.unlocked.includes(player.pets.active)
    ) {
      context.addIssue({
        code: "custom",
        message: `active pet ${player.pets.active} is not unlocked`,
        path: ["pets", "active"],
      });
    }

    const gearLocations = new Map<string, string>();
    const registerGear = (
      asset: z.infer<typeof GearAssetSchema>,
      location: string,
    ): void => {
      const previous = gearLocations.get(asset.instanceId);
      if (previous !== undefined) {
        context.addIssue({
          code: "custom",
          message: `gear instance ${asset.instanceId} exists in both ${previous} and ${location}`,
          path: [],
        });
      } else {
        gearLocations.set(asset.instanceId, location);
      }
    };

    for (const hero of player.heroes) {
      for (const equipment of hero.equipment) {
        registerGear(equipment.asset, `hero:${hero.heroKey}:${equipment.slot}`);
      }
    }
    for (const [containerName, container] of Object.entries(
      player.containers,
    )) {
      for (const slot of container.slots) {
        if (slot.asset.kind === "gear") {
          registerGear(slot.asset, `${containerName}:${slot.index}`);
        }
      }
    }
    for (const [
      index,
      asset,
    ] of player.stageSession?.pendingRewards.items.entries() ?? []) {
      if (asset.kind === "gear") {
        registerGear(asset, `stageSession:${index}`);
      }
    }
  });

export type CatalogKey = z.infer<typeof CatalogKeySchema>;
export type GearAsset = z.infer<typeof GearAssetSchema>;
export type StoredAsset = z.infer<typeof StoredAssetSchema>;
export type SlotContainer = z.infer<typeof SlotContainerSchema>;
export type HeroProgress = z.infer<typeof HeroProgressSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export function createFreshPlayerState(
  starterHeroKey: DiscordHeroStarterKey,
): PlayerState {
  const starterHero = (heroKey: number): HeroProgress => ({
    heroKey,
    level: 1,
    xp: 0,
    attributes: [],
    skills: [],
    passives: [],
    equipment: [],
    skins: [],
  });

  return PlayerStateSchema.parse({
    version: 1,
    gold: 100,
    party: [starterHeroKey, null, null],
    heroes: [starterHero(101), starterHero(201), starterHero(301)],
    containers: {
      inventory: { unlockedSlots: 0, slots: [] },
      stash: { unlockedSlots: 0, slots: [] },
      storage: { unlockedSlots: 0, slots: [] },
      tradingStash: { unlockedSlots: 0, slots: [] },
    },
    cube: {
      level: 1,
      xp: 0,
      unlockedRecipes: [],
      unlockedSubRecipes: [],
    },
    runes: [],
    pets: { unlocked: [], active: null },
    skins: { unlocked: [] },
    offline: { accrualCursorMs: 0, rewardStageLevel: 0 },
    campaign: { highestStageKey: null, stages: [] },
    stageSession: null,
  });
}
