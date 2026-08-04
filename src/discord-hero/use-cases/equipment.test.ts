import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { GearAsset, PlayerState } from "../domain/player";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRepository,
  DiscordHeroRevisionConflictError,
} from "../state/repository";
import { equipDiscordHeroGear } from "./equip-gear";
import { unequipDiscordHeroGear } from "./unequip-gear";

const catalog = await loadDiscordHeroCatalog();
const indexes = buildCatalogIndexes(catalog);
const temporaryDirectories: string[] = [];
const repositories: DiscordHeroRepository[] = [];
const decodeCreatedOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("created") })
    .strict()
    .parse(value);

function repository(): DiscordHeroRepository {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-equipment-"));
  temporaryDirectories.push(directory);
  const store = new DiscordHeroRepository({
    databasePath: join(directory, "discordhero.sqlite"),
    catalogDigest: catalog.provenance.compiledSha256,
    legacyDirectory: directory,
  });
  repositories.push(store);
  return store;
}

function itemKeyFor(gearType: string): number {
  const item = indexes.tables.items.rows.find(
    (candidate) => candidate.type === "GEAR" && candidate.gear === gearType,
  );
  if (item === undefined) throw new Error(`missing test gear type ${gearType}`);
  return item.id;
}

function gear(gearType: string, instanceId: string): GearAsset {
  return {
    kind: "gear",
    instanceId,
    itemKey: itemKeyFor(gearType),
    rolledStats: [{ statModKey: 100101, value: 1 }],
  };
}

function createPlayer(
  store: DiscordHeroRepository,
  userId: string,
  modify: (state: PlayerState) => void = () => {},
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  modify(state);
  store.transactPlayer({
    scope: "test.equipment",
    interactionId: `create-${userId}`,
    operation: "create",
    requestSha256: "a".repeat(64),
    userId,
    expectedRevision: null,
    decodeOutcome: decodeCreatedOutcome,
    nowMs: 1_000,
    mutate: (current) => {
      expect(current).toBeNull();
      return { kind: "commit", state, outcome: { kind: "created" } };
    },
  });
  return state;
}

afterEach(() => {
  for (const store of repositories.splice(0)) store.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("DiscordHero equipment transactions", () => {
  test("creates, equips, replays, unequips to the explicit slot, and replays", () => {
    const store = repository();
    const selected = gear("SWORD", "sqlite-sword");
    createPlayer(store, "123", (state) => {
      state.containers.inventory.slots.push({ index: 4, asset: selected });
    });

    const equipInput = Object.freeze({
      userId: "123",
      interactionId: "equip-1",
      expectedRevision: 1,
      heroKey: 101,
      inventorySlotIndex: 4,
      nowMs: 2_000,
    });
    const equipped = equipDiscordHeroGear(store, indexes, equipInput);
    const equipReplay = equipDiscordHeroGear(store, indexes, {
      ...equipInput,
      nowMs: 9_999,
    });

    expect(equipped).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
        kind: "equipped",
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 4,
        instanceId: "sqlite-sword",
        itemKey: selected.itemKey,
      },
    });
    expect(equipReplay).toEqual(equipped);
    expect(equipInput).toEqual({
      userId: "123",
      interactionId: "equip-1",
      expectedRevision: 1,
      heroKey: 101,
      inventorySlotIndex: 4,
      nowMs: 2_000,
    });
    const persistedEquipped = store.getPlayer("123");
    expect(persistedEquipped?.revision).toBe(2);
    expect(persistedEquipped?.state.containers.inventory.slots).toEqual([]);
    expect(
      persistedEquipped?.state.heroes.find((hero) => hero.heroKey === 101)
        ?.equipment,
    ).toEqual([
      {
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "sqlite-sword",
          itemKey: selected.itemKey,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      },
    ]);

    const unequipInput = Object.freeze({
      userId: "123",
      interactionId: "unequip-1",
      expectedRevision: 2,
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 7,
      nowMs: 3_000,
    });
    const unequipped = unequipDiscordHeroGear(store, indexes, unequipInput);
    const unequipReplay = unequipDiscordHeroGear(store, indexes, {
      ...unequipInput,
      nowMs: 9_999,
    });

    expect(unequipped).toEqual({
      status: "committed",
      revision: 3,
      outcome: {
        kind: "unequipped",
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 7,
        instanceId: "sqlite-sword",
        itemKey: selected.itemKey,
      },
    });
    expect(unequipReplay).toEqual(unequipped);
    const persistedUnequipped = store.getPlayer("123");
    expect(persistedUnequipped?.revision).toBe(3);
    expect(persistedUnequipped?.state.containers.inventory.slots).toEqual([
      {
        index: 7,
        asset: {
          kind: "gear",
          instanceId: "sqlite-sword",
          itemKey: selected.itemKey,
          rolledStats: [{ statModKey: 100101, value: 1 }],
        },
      },
    ]);
    expect(
      persistedUnequipped?.state.heroes.find((hero) => hero.heroKey === 101)
        ?.equipment,
    ).toEqual([]);
  });

  test("persists source-valid unavailable actions as deterministic rejections", () => {
    const store = repository();
    createPlayer(store, "123", (state) => {
      state.containers.inventory.slots.push({
        index: 0,
        asset: gear("SWORD", "incompatible-sword"),
      });
    });

    const incompatible = equipDiscordHeroGear(store, indexes, {
      userId: "123",
      interactionId: "incompatible",
      expectedRevision: 1,
      heroKey: 201,
      inventorySlotIndex: 0,
      nowMs: 2_000,
    });
    const empty = unequipDiscordHeroGear(store, indexes, {
      userId: "123",
      interactionId: "empty",
      expectedRevision: 1,
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 1,
      nowMs: 2_001,
    });

    expect(incompatible).toEqual({
      status: "rejected",
      revision: 1,
      outcome: {
        kind: "incompatible-gear",
        heroKey: 201,
        gearType: "SWORD",
        itemKey: itemKeyFor("SWORD"),
      },
    });
    expect(empty).toEqual({
      status: "rejected",
      revision: 1,
      outcome: {
        kind: "equipment-slot-empty",
        heroKey: 101,
        gearType: "SWORD",
      },
    });
    expect(store.getPlayer("123")?.revision).toBe(1);
  });

  test("binds each request hash to operation fields and enforces revision", () => {
    const store = repository();
    createPlayer(store, "123", (state) => {
      state.containers.inventory.slots.push({
        index: 0,
        asset: gear("SWORD", "bound-sword"),
      });
    });
    equipDiscordHeroGear(store, indexes, {
      userId: "123",
      interactionId: "bound-equip",
      expectedRevision: 1,
      heroKey: 101,
      inventorySlotIndex: 0,
      nowMs: 2_000,
    });

    expect(() =>
      equipDiscordHeroGear(store, indexes, {
        userId: "123",
        interactionId: "bound-equip",
        expectedRevision: 1,
        heroKey: 201,
        inventorySlotIndex: 0,
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(() =>
      unequipDiscordHeroGear(store, indexes, {
        userId: "123",
        interactionId: "stale-unequip",
        expectedRevision: 1,
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 1,
        nowMs: 3_000,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);

    unequipDiscordHeroGear(store, indexes, {
      userId: "123",
      interactionId: "bound-unequip",
      expectedRevision: 2,
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 1,
      nowMs: 3_000,
    });
    expect(() =>
      unequipDiscordHeroGear(store, indexes, {
        userId: "123",
        interactionId: "bound-unequip",
        expectedRevision: 2,
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 2,
        nowMs: 4_000,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
  });

  test("rejects missing players deterministically for both operations", () => {
    const store = repository();

    expect(
      equipDiscordHeroGear(store, indexes, {
        userId: "999",
        interactionId: "missing-equip",
        expectedRevision: null,
        heroKey: 101,
        inventorySlotIndex: 0,
        nowMs: 1_000,
      }),
    ).toEqual({
      status: "rejected",
      revision: null,
      outcome: { kind: "player-not-found" },
    });
    expect(
      unequipDiscordHeroGear(store, indexes, {
        userId: "998",
        interactionId: "missing-unequip",
        expectedRevision: null,
        heroKey: 101,
        gearType: "SWORD",
        inventorySlotIndex: 0,
        nowMs: 1_000,
      }),
    ).toEqual({
      status: "rejected",
      revision: null,
      outcome: { kind: "player-not-found" },
    });
  });

  test("throws on malformed transaction input before opening a mutation", () => {
    const store = repository();

    expect(() =>
      equipDiscordHeroGear(store, indexes, {
        userId: "not-a-snowflake",
        interactionId: "bad-equip",
        expectedRevision: null,
        heroKey: 101,
        inventorySlotIndex: 0,
        nowMs: 1_000,
      }),
    ).toThrow("userId must be a Discord snowflake");
    expect(() =>
      unequipDiscordHeroGear(store, indexes, {
        userId: "999",
        interactionId: "bad-unequip",
        expectedRevision: null,
        heroKey: 101,
        gearType: "LASER",
        inventorySlotIndex: 0,
        nowMs: 1_000,
      }),
    ).toThrow("unknown equipment category LASER");

    const forgedEquipInput = {
      userId: "999",
      interactionId: "forged-equip",
      expectedRevision: null,
      heroKey: 101,
      inventorySlotIndex: 0,
      nowMs: 1_000,
      gearType: "SWORD",
    };
    expect(() =>
      equipDiscordHeroGear(store, indexes, forgedEquipInput),
    ).toThrow("equip gear input has unknown field gearType");

    const forgedUnequipInput = {
      userId: "999",
      interactionId: "forged-unequip",
      expectedRevision: null,
      heroKey: 101,
      gearType: "SWORD",
      inventorySlotIndex: 0,
      nowMs: 1_000,
      instanceId: "caller-selected",
    };
    expect(() =>
      unequipDiscordHeroGear(store, indexes, forgedUnequipInput),
    ).toThrow("unequip gear input has unknown field instanceId");
  });
});
