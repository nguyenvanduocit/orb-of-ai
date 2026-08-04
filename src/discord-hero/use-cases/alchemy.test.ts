import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import {
  openDiscordHeroRepository,
  type DiscordHeroRepository,
} from "../state/repository";
import {
  alchemizeDiscordHeroItems,
  createDiscordHeroAlchemyReceiptQuery,
  decodeDiscordHeroAlchemyOutcome,
} from "./alchemy";

const tempRoot = join(
  process.cwd(),
  ".tmp",
  `discordhero-alchemy-test-${process.pid}`,
);

let repository: DiscordHeroRepository;
let indexes: ReturnType<typeof buildCatalogIndexes>;
const decodeSeededOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("seeded") })
    .strict()
    .parse(value);
const decodeReplacedOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("replaced") })
    .strict()
    .parse(value);

beforeEach(async () => {
  rmSync(tempRoot, { recursive: true, force: true });
  const catalog = await loadDiscordHeroCatalog();
  indexes = buildCatalogIndexes(catalog);
  repository = openDiscordHeroRepository({
    databasePath: join(tempRoot, "players.sqlite"),
    catalogDigest: catalog.provenance.compiledSha256,
  });
});

afterEach(() => {
  repository.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

function seedPlayer(
  interactionId: string,
  mutate: (state: ReturnType<typeof createFreshPlayerStateFromCatalog>) => void,
): void {
  repository.transactPlayer({
    scope: "test",
    interactionId,
    operation: "seed",
    requestSha256: "a".repeat(64),
    userId: "123",
    expectedRevision: null,
    decodeOutcome: decodeSeededOutcome,
    nowMs: 1,
    mutate: () => {
      const state = structuredClone(
        createFreshPlayerStateFromCatalog(indexes, 101),
      );
      mutate(state);
      return { kind: "commit", state, outcome: { kind: "seeded" } };
    },
  });
}

function unlockAlchemy(
  state: ReturnType<typeof createFreshPlayerStateFromCatalog>,
): void {
  state.cube.unlockedRecipes.push(200001);
  state.cube.unlockedSubRecipes.push(200011);
}

describe("DiscordHero Alchemy transaction", () => {
  test("strictly decodes only exact canonical Alchemy outcomes", () => {
    const valid = {
      kind: "alchemized" as const,
      consumedItems: 1,
      goldGained: 10,
      cubeExperienceGained: 2,
      gold: 110,
      cubeLevel: 1,
      cubeXp: 2,
    };
    expect(decodeDiscordHeroAlchemyOutcome(valid)).toEqual(valid);

    for (const forged of [
      { kind: "forged" },
      { ...valid, extra: true },
      { ...valid, gold: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, gold: Number.POSITIVE_INFINITY },
      { ...valid, gold: -1 },
      { ...valid, gold: -0 },
      { ...valid, gold: 1.5 },
      { ...valid, cubeLevel: 0 },
      { kind: "alchemized", consumedItems: 1 },
      ["alchemized"],
      null,
    ]) {
      expect(() => decodeDiscordHeroAlchemyOutcome(forged)).toThrow();
    }
  });

  test("consumes exact gear once, derives source gold/EXP, and replays idempotently", () => {
    seedPlayer("seed-gear", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "alchemy-source-gear",
          itemKey: 300001,
          rolledStats: [],
        },
      });
    });

    const input = {
      userId: "123",
      interactionId: "alchemy-gear",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    };
    const first = alchemizeDiscordHeroItems(repository, indexes, input);
    const replay = alchemizeDiscordHeroItems(repository, indexes, {
      ...input,
      nowMs: 99,
    });

    expect(first).toEqual(replay);
    expect(first).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "alchemized",
        consumedItems: 1,
        goldGained: 10,
        cubeExperienceGained: 2,
        gold: 110,
        cubeLevel: 1,
        cubeXp: 2,
      },
    });
    expect(repository.getPlayer("123")).toMatchObject({
      revision: 2,
      state: {
        gold: 110,
        containers: { inventory: { slots: [] } },
        cube: { level: 1, xp: 2 },
      },
    });
  });

  test("advances through the exact Cube level boundary", () => {
    const levelOneThreshold =
      indexes.tables.cube_levels.groups.get(1)?.[0]?.ExpForLevelUp;
    expect(levelOneThreshold).toBe(15);
    seedPlayer("seed-level", (state) => {
      unlockAlchemy(state);
      state.cube.xp = levelOneThreshold! - 1;
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "level-up-gear",
          itemKey: 300001,
          rolledStats: [],
        },
      });
    });

    const result = alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "level-up",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    });

    expect(result).toMatchObject({
      status: "committed",
      outcome: {
        kind: "alchemized",
        cubeExperienceGained: 2,
        cubeLevel: 2,
        cubeXp: 1,
      },
    });
    expect(repository.getPlayer("123")?.state.cube).toMatchObject({
      level: 2,
      xp: 1,
    });
  });

  test("rejects a locked recipe without consuming inventory", () => {
    seedPlayer("seed-locked", (state) => {
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "locked-gear",
          itemKey: 300001,
          rolledStats: [],
        },
      });
    });

    const result = alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "locked",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    });

    expect(result).toEqual({
      status: "rejected",
      revision: 1,
      outcome: { kind: "recipe-locked" },
    });
    expect(repository.getPlayer("123")).toMatchObject({
      revision: 1,
      state: {
        gold: 100,
        containers: {
          inventory: {
            slots: [{ asset: { instanceId: "locked-gear" } }],
          },
        },
      },
    });
  });

  test("rolls back when material level:null requires an oracle", () => {
    seedPlayer("seed-material", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push({
        index: 0,
        asset: { kind: "stack", itemKey: 140001, quantity: 1 },
      });
    });

    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "material-oracle",
        expectedRevision: 1,
        inventorySlotIndexes: [0],
        nowMs: 2,
      }),
    ).toThrow("level:null");
    expect(repository.getPlayer("123")).toMatchObject({
      revision: 1,
      state: {
        gold: 100,
        containers: {
          inventory: {
            slots: [
              {
                index: 0,
                asset: { kind: "stack", itemKey: 140001, quantity: 1 },
              },
            ],
          },
        },
      },
    });
  });

  test("applies every owned Alchemy/Cube Rune level from the canonical graph", () => {
    seedPlayer("seed-bonus", (state) => {
      unlockAlchemy(state);
      state.runes = [
        { key: 1, level: 1 },
        { key: 10, level: 1 },
        { key: 201, level: 1 },
        { key: 202, level: 1 },
        { key: 203, level: 1 },
        { key: 2031, level: 1 },
        { key: 2032, level: 2 },
      ];
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "bonus-gear",
          itemKey: 300002,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      });
    });

    const result = alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "bonus",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    });

    expect(result).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "alchemized",
        consumedItems: 1,
        goldGained: 55,
        cubeExperienceGained: 21,
        gold: 155,
        cubeLevel: 2,
        cubeXp: 6,
      },
    });
  });

  test("converts current-level XP to cumulative XP across multiple level-ups", () => {
    seedPlayer("seed-multi-level", (state) => {
      unlockAlchemy(state);
      state.cube.level = 2;
      state.cube.xp = 3;
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "multi-level-gear",
          itemKey: 604031,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      });
    });

    const result = alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "multi-level",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    });

    expect(result).toMatchObject({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "alchemized",
        goldGained: 81_000,
        cubeExperienceGained: 22_032,
        cubeLevel: 14,
        cubeXp: 2_495,
      },
    });
  });

  test("consumes multiple selected instances without loss or duplication", () => {
    seedPlayer("seed-multiple", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push(
        {
          index: 0,
          asset: {
            kind: "gear",
            instanceId: "multiple-a",
            itemKey: 300001,
            rolledStats: [],
          },
        },
        {
          index: 1,
          asset: {
            kind: "gear",
            instanceId: "multiple-b",
            itemKey: 300002,
            rolledStats: [{ statModKey: 100101, value: 1 }],
          },
        },
        {
          index: 2,
          asset: { kind: "stack", itemKey: 140001, quantity: 3 },
        },
        {
          index: 3,
          asset: {
            kind: "gear",
            instanceId: "unrelated-gear",
            itemKey: 300003,
            rolledStats: [{ statModKey: 101001, value: 1 }],
          },
        },
      );
    });

    const result = alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "multiple",
      expectedRevision: 1,
      inventorySlotIndexes: [0, 1],
      nowMs: 2,
    });

    expect(result).toMatchObject({
      status: "committed",
      outcome: {
        kind: "alchemized",
        consumedItems: 2,
        goldGained: 60,
        cubeExperienceGained: 22,
      },
    });
    expect(
      repository.getPlayer("123")?.state.containers.inventory.slots,
    ).toEqual([
      {
        index: 2,
        asset: { kind: "stack", itemKey: 140001, quantity: 3 },
      },
      {
        index: 3,
        asset: {
          kind: "gear",
          instanceId: "unrelated-gear",
          itemKey: 300003,
          rolledStats: [{ statModKey: 101001, value: 1 }],
        },
      },
    ]);
  });

  test("rolls back gold overflow with exact inventory and revision intact", () => {
    seedPlayer("seed-overflow", (state) => {
      unlockAlchemy(state);
      state.gold = Number.MAX_SAFE_INTEGER - 5;
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "overflow-gear",
          itemKey: 300001,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      });
    });
    const before = repository.getPlayer("123");

    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "overflow",
        expectedRevision: 1,
        inventorySlotIndexes: [0],
        nowMs: 2,
      }),
    ).toThrow("Alchemy gold balance produced an unsafe integer");
    expect(repository.getPlayer("123")).toEqual(before);
  });

  test("rejects unknown top-level yield fields before entering a transaction", () => {
    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "forged-yield",
        expectedRevision: null,
        inventorySlotIndexes: [0],
        nowMs: 2,
        goldYield: 999_999,
      } as Parameters<typeof alchemizeDiscordHeroItems>[2]),
    ).toThrow("unknown field goldYield");
    expect(repository.getPlayer("123")).toBeNull();
  });

  test("returns missing-player and rejects stale revisions without mutation", () => {
    expect(
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "missing",
        expectedRevision: null,
        inventorySlotIndexes: [0],
        nowMs: 2,
      }),
    ).toEqual({
      status: "rejected",
      revision: null,
      outcome: { kind: "player-not-found" },
    });

    seedPlayer("seed-stale", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "stale-gear",
          itemKey: 300001,
          rolledStats: [],
        },
      });
    });
    const before = repository.getPlayer("123");
    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "stale",
        expectedRevision: 2,
        inventorySlotIndexes: [0],
        nowMs: 3,
      }),
    ).toThrow("revision");
    expect(repository.getPlayer("123")).toEqual(before);
  });

  test("binds request identity to the exact material selection", () => {
    seedPlayer("seed-bound", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push(
        {
          index: 0,
          asset: {
            kind: "gear",
            instanceId: "bound-a",
            itemKey: 300001,
            rolledStats: [],
          },
        },
        {
          index: 1,
          asset: {
            kind: "gear",
            instanceId: "bound-b",
            itemKey: 300001,
            rolledStats: [],
          },
        },
      );
    });
    alchemizeDiscordHeroItems(repository, indexes, {
      userId: "123",
      interactionId: "bound",
      expectedRevision: 1,
      inventorySlotIndexes: [0],
      nowMs: 2,
    });

    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "bound",
        expectedRevision: 1,
        inventorySlotIndexes: [1],
        nowMs: 3,
      }),
    ).toThrow("reused with different request metadata");
  });

  test("normalizes slot-index receipt identity and rejects duplicate indexes before a transaction", () => {
    const input = {
      userId: "123",
      interactionId: "normalized-slots",
      expectedRevision: 7,
      inventorySlotIndexes: [8, 2],
      nowMs: 10,
    };
    const normalized = createDiscordHeroAlchemyReceiptQuery(input);
    expect(
      createDiscordHeroAlchemyReceiptQuery({
        ...input,
        inventorySlotIndexes: [2, 8],
        nowMs: 99,
      }),
    ).toEqual(normalized);
    expect(
      createDiscordHeroAlchemyReceiptQuery({
        ...input,
        inventorySlotIndexes: [2, 9],
      }).requestSha256,
    ).not.toBe(normalized.requestSha256);
    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        ...input,
        inventorySlotIndexes: [2, 2],
      }),
    ).toThrow("repeats index 2");
    expect(repository.getPlayer("123")).toBeNull();
  });

  test("rejects a stale slot replacement before resolving the new asset", () => {
    seedPlayer("seed-slot-replacement", (state) => {
      unlockAlchemy(state);
      state.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "slot-before-replacement",
          itemKey: 300001,
          rolledStats: [],
        },
      });
    });
    repository.transactPlayer({
      scope: "test",
      interactionId: "replace-slot",
      operation: "replace",
      requestSha256: "e".repeat(64),
      userId: "123",
      expectedRevision: 1,
      decodeOutcome: decodeReplacedOutcome,
      nowMs: 2,
      mutate: (current) => {
        if (current === null) throw new Error("missing replacement player");
        current.containers.inventory.slots[0] = {
          index: 0,
          asset: {
            kind: "gear",
            instanceId: "slot-after-replacement",
            itemKey: 300002,
            rolledStats: [],
          },
        };
        return {
          kind: "commit",
          state: current,
          outcome: { kind: "replaced" },
        };
      },
    });

    expect(() =>
      alchemizeDiscordHeroItems(repository, indexes, {
        userId: "123",
        interactionId: "stale-slot-replacement",
        expectedRevision: 1,
        inventorySlotIndexes: [0],
        nowMs: 3,
      }),
    ).toThrow("revision");
    expect(repository.getPlayer("123")).toMatchObject({
      revision: 2,
      state: {
        containers: {
          inventory: {
            slots: [
              {
                index: 0,
                asset: { instanceId: "slot-after-replacement" },
              },
            ],
          },
        },
      },
    });
  });
});
