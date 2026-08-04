import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { buildCatalogIndexes } from "../discord-hero/catalog/indexes";
import { loadDiscordHeroCatalog } from "../discord-hero/catalog/loader";
import { loadDiscordHeroCommunityAchievements } from "../discord-hero/community-achievements/loader";
import { loadDiscordHeroCommunityContent } from "../discord-hero/community-content/loader";
import { loadDiscordHeroCommunityMarket } from "../discord-hero/community-market/loader";
import { createFreshPlayerStateFromCatalog } from "../discord-hero/domain/invariants";
import type { DiscordHeroRuntime } from "../discord-hero/runtime";
import { openDiscordHeroRepository } from "../discord-hero/state/repository";
import { decodeDiscordHeroCustomId } from "../discord-hero/ui/custom-id";
import {
  assertDiscordHeroComponentPayload,
  assertDiscordHeroSelectValues,
  assertDiscordHeroScenarioDirectoryEmpty,
  cleanupDiscordHeroScenarioSandbox,
  createDiscordHeroComponentInteraction,
  createDiscordHeroSlashInteraction,
  createDiscordHeroScenarioSandbox,
} from "./discordhero.e2e-testkit";
import { execute, handleButton, handleSelect } from "./discordhero";

type Json = Record<string, any> | any[] | string | number | boolean | null;

function json(value: unknown): Json {
  if (value && typeof value === "object" && "toJSON" in value) {
    return (value as { toJSON: () => Json }).toJSON();
  }
  return value as Json;
}

function walk(
  value: unknown,
  visit: (value: Record<string, any>) => void,
): void {
  if (!value || typeof value !== "object") return;
  const normalized = json(value);
  if (!normalized || typeof normalized !== "object") return;
  if (Array.isArray(normalized)) {
    normalized.forEach((entry) => walk(entry, visit));
    return;
  }
  visit(normalized);
  Object.values(normalized).forEach((entry) => walk(entry, visit));
}

function controls(payload: unknown) {
  const buttons: string[] = [];
  const menus: Array<{ customId: string; options: Array<{ value: string }> }> =
    [];
  walk(payload, (entry) => {
    if (typeof entry.custom_id !== "string") return;
    if (Array.isArray(entry.options)) {
      menus.push({
        customId: entry.custom_id,
        options: entry.options.filter(
          (option: any) => typeof option?.value === "string",
        ),
      });
    } else {
      buttons.push(entry.custom_id);
    }
  });
  return { buttons, menus };
}

function pickButton(payload: unknown, view: string, action: string): string {
  const found = controls(payload).buttons.find((id) => {
    try {
      const decoded = decodeDiscordHeroCustomId(id);
      return decoded.view === view && decoded.action === action;
    } catch {
      return false;
    }
  });
  if (!found)
    throw new Error(
      `missing emitted ${view}/${action} button: ${JSON.stringify(controls(payload).buttons)}`,
    );
  return found;
}

function pickMenu(
  payload: unknown,
  view: string,
  action: string,
  valuePrefix?: string,
) {
  const found = controls(payload).menus.find((menu) => {
    try {
      const decoded = decodeDiscordHeroCustomId(menu.customId);
      return (
        decoded.view === view &&
        decoded.action === action &&
        (valuePrefix === undefined ||
          decoded.value?.startsWith(valuePrefix) === true)
      );
    } catch {
      return false;
    }
  });
  if (!found || found.options.length === 0) {
    throw new Error(
      `missing emitted ${view}/${action} menu: ${JSON.stringify(controls(payload).menus)}`,
    );
  }
  return found;
}

function assertBoard(payload: any): void {
  assertDiscordHeroComponentPayload(payload);
  expect(payload.components).toHaveLength(1);
}

function slash(userId: string, id: string) {
  const mock = createDiscordHeroSlashInteraction(userId, id);
  return {
    interaction: mock.interaction as unknown as ChatInputCommandInteraction,
    events: mock.events,
  };
}

function button(customId: string, userId: string, id: string) {
  const mock = createDiscordHeroComponentInteraction(customId, userId, id);
  return {
    interaction: mock.interaction as unknown as ButtonInteraction,
    updates: mock.updates,
    replies: mock.replies,
  };
}

function select(
  customId: string,
  values: string[],
  userId: string,
  id: string,
  options?: Array<{ value: string; disabled?: boolean }>,
) {
  if (options) assertDiscordHeroSelectValues(options, values);
  const mock = createDiscordHeroComponentInteraction(customId, userId, id);
  return {
    interaction: {
      ...mock.interaction,
      values,
    } as unknown as StringSelectMenuInteraction,
    updates: mock.updates,
    replies: mock.replies,
  };
}

async function scenario() {
  const sandbox = createDiscordHeroScenarioSandbox();
  const catalog = await loadDiscordHeroCatalog();
  const [communityAchievements, communityContent, communityMarket] =
    await Promise.all([
      loadDiscordHeroCommunityAchievements(),
      loadDiscordHeroCommunityContent(),
      loadDiscordHeroCommunityMarket(),
    ]);
  const indexes = buildCatalogIndexes(catalog);
  const databasePath = sandbox.databasePath;
  const repository = openDiscordHeroRepository({
    databasePath,
    catalogDigest: catalog.provenance.compiledSha256,
  });
  const runtime: DiscordHeroRuntime = {
    catalog,
    indexes,
    communityAchievements,
    communityContent,
    communityMarket,
    repository,
  };
  return {
    root: sandbox.root,
    databasePath,
    runtime,
    provider: async () => runtime,
  };
}

function rows(databasePath: string): string {
  const db = new Database(databasePath, { readonly: true });
  try {
    return JSON.stringify({
      players: db.query("SELECT * FROM players ORDER BY user_id").all(),
      idempotency: db
        .query("SELECT * FROM idempotency ORDER BY interaction_id")
        .all(),
      integrity: db.query("PRAGMA integrity_check").all(),
      databaseBytesBase64: readFileSync(databasePath).toString("base64"),
      sidecars: ["-wal", "-shm"].map((suffix) => ({
        suffix,
        exists: existsSync(`${databasePath}${suffix}`),
      })),
    });
  } finally {
    db.close();
  }
}

async function closeScenario(s: Awaited<ReturnType<typeof scenario>>) {
  s.runtime.repository.close();
  cleanupDiscordHeroScenarioSandbox({
    root: s.root,
    databasePath: s.databasePath,
  });
  expect(existsSync(`${s.databasePath}-wal`)).toBe(false);
  expect(existsSync(`${s.databasePath}-shm`)).toBe(false);
  assertDiscordHeroScenarioDirectoryEmpty(s.root);
}

describe("DiscordHero Phase 5 emitted-control journeys", () => {
  test("journey 1: fresh slash -> Home -> Heroes -> emitted hero option", async () => {
    const s = await scenario();
    try {
      const first = slash("123", "j1-slash");
      await execute(first.interaction, s.provider, () => 1000);
      expect(first.events.map((event) => event.kind)).toEqual([
        "defer",
        "edit",
      ]);
      expect(first.events[0]!.payload).toMatchObject({ flags: 64 });
      assertBoard(first.events[1]!.payload);
      const before = rows(s.databasePath);

      const heroes = button(
        pickButton(first.events[1]!.payload, "heroes", "view"),
        "123",
        "j1-heroes",
      );
      await handleButton(heroes.interaction, s.provider, () => 1000);
      assertBoard(heroes.updates[0]);
      const heroMenu = pickMenu(heroes.updates[0], "heroes", "select");
      const hero = select(
        heroMenu.customId,
        [heroMenu.options[0]!.value],
        "123",
        "j1-hero",
      );
      await handleSelect(hero.interaction, s.provider, () => 1000);
      assertBoard(hero.updates[0]);
      expect(rows(s.databasePath)).toBe(before);
      expect(s.runtime.repository.getPlayer("123")?.revision).toBe(1);
    } finally {
      await closeScenario(s);
    }
  });

  test("journey 2: existing save -> Inventory -> emitted item -> emitted equip choice", async () => {
    const s = await scenario();
    try {
      const seed = createFreshPlayerStateFromCatalog(s.runtime.indexes);
      seed.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "phase5-sword",
          itemKey: 300001,
          rolledStats: [],
        },
      });
      s.runtime.repository.transactPlayer({
        scope: "phase5-seed",
        interactionId: "phase5-seed",
        operation: "seed",
        requestSha256: "a".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: (value) => value as { kind: "seeded" },
        nowMs: 1000,
        mutate: () => ({
          kind: "commit",
          state: seed,
          outcome: { kind: "seeded" },
        }),
      });
      const before = rows(s.databasePath);
      const start = slash("123", "j2-slash");
      await execute(start.interaction, s.provider, () => 1000);
      const inventory = button(
        pickButton(start.events[1]!.payload, "inventory", "view"),
        "123",
        "j2-inventory",
      );
      await handleButton(inventory.interaction, s.provider, () => 1000);
      assertBoard(inventory.updates[0]);
      const itemMenu = pickMenu(
        inventory.updates[0],
        "inventory",
        "select",
        "i-",
      );
      const item = select(
        itemMenu.customId,
        [itemMenu.options[0]!.value],
        "123",
        "j2-item",
      );
      await handleSelect(item.interaction, s.provider, () => 1000);
      assertBoard(item.updates[0]);
      const equipMenu = pickMenu(item.updates[0], "inventory", "equip", "e-");
      const equip = select(
        equipMenu.customId,
        [equipMenu.options[0]!.value],
        "123",
        "j2-equip",
      );
      await handleSelect(equip.interaction, s.provider, () => 1000);
      assertBoard(equip.updates[0]);
      expect(s.runtime.repository.getPlayer("123")?.revision).toBe(2);
      const after = rows(s.databasePath);
      expect(after).not.toBe(before);
      const replay = select(
        equipMenu.customId,
        [equipMenu.options[0]!.value],
        "123",
        "j2-equip",
      );
      await handleSelect(replay.interaction, s.provider, () => 1000);
      expect(rows(s.databasePath)).toBe(after);
    } finally {
      await closeScenario(s);
    }
  });

  test("journey 3: slash -> World -> emitted page/stage, stale/foreign/forged controls are safe", async () => {
    const s = await scenario();
    try {
      const seed = createFreshPlayerStateFromCatalog(s.runtime.indexes);
      seed.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "phase5-world-stale-sword",
          itemKey: 300001,
          rolledStats: [],
        },
      });
      s.runtime.repository.transactPlayer({
        scope: "phase5-world-stale-seed",
        interactionId: "phase5-world-stale-seed",
        operation: "seed",
        requestSha256: "b".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: (value) => value as { kind: "seeded" },
        nowMs: 1000,
        mutate: () => ({
          kind: "commit",
          state: seed,
          outcome: { kind: "seeded" },
        }),
      });
      const start = slash("123", "j3-slash");
      await execute(start.interaction, s.provider, () => 1000);
      const world = button(
        pickButton(start.events[1]!.payload, "world", "view"),
        "123",
        "j3-world",
      );
      await handleButton(world.interaction, s.provider, () => 1000);
      assertBoard(world.updates[0]);
      const stageMenu = pickMenu(world.updates[0], "world", "select");
      const captured = stageMenu.options[0]!.value;
      const inventory = button(
        pickButton(start.events[1]!.payload, "inventory", "view"),
        "123",
        "j3-inventory",
      );
      await handleButton(inventory.interaction, s.provider, () => 1000);
      assertBoard(inventory.updates[0]);
      const itemMenu = pickMenu(
        inventory.updates[0],
        "inventory",
        "select",
        "i-",
      );
      const item = select(
        itemMenu.customId,
        [itemMenu.options[0]!.value],
        "123",
        "j3-item",
        itemMenu.options,
      );
      await handleSelect(item.interaction, s.provider, () => 1000);
      assertBoard(item.updates[0]);
      const equipMenu = pickMenu(item.updates[0], "inventory", "equip", "e-");
      const equip = select(
        equipMenu.customId,
        [equipMenu.options[0]!.value],
        "123",
        "j3-equip",
        equipMenu.options,
      );
      await handleSelect(equip.interaction, s.provider, () => 1000);
      assertBoard(equip.updates[0]);
      expect(s.runtime.repository.getPlayer("123")?.revision).toBe(2);
      const afterEquip = rows(s.databasePath);
      const stale = select(stageMenu.customId, [captured], "123", "j3-stale");
      await handleSelect(stale.interaction, s.provider, () => 1000);
      assertBoard(stale.updates[0]);
      expect(JSON.stringify(stale.updates[0])).toMatch(
        /state changed|refreshed|stale/i,
      );
      expect(rows(s.databasePath)).toBe(afterEquip);
      const foreign = select(
        stageMenu.customId,
        [captured],
        "456",
        "j3-foreign",
      );
      await handleSelect(foreign.interaction, s.provider, () => 1000);
      expect(foreign.replies).toHaveLength(1);
      const forgedId =
        stageMenu.customId.slice(0, -1) +
        (stageMenu.customId.endsWith("a") ? "b" : "a");
      const forged = select(forgedId, [captured], "123", "j3-forged");
      await handleSelect(forged.interaction, s.provider, () => 1000);
      expect(forged.updates).toHaveLength(1);
      expect(rows(s.databasePath)).toBe(afterEquip);
    } finally {
      await closeScenario(s);
    }
  });

  test("cold start defers before an unresolved runtime and edits once after resolve", async () => {
    let resolve!: (runtime: DiscordHeroRuntime) => void;
    const pending = new Promise<DiscordHeroRuntime>((next) => (resolve = next));
    const s = await scenario();
    try {
      const interaction = slash("123", "cold-start");
      const promise = execute(
        interaction.interaction,
        () => pending,
        () => 1000,
      );
      await Promise.resolve();
      expect(interaction.events.map((event) => event.kind)).toEqual(["defer"]);
      resolve(s.runtime);
      await promise;
      expect(interaction.events.map((event) => event.kind)).toEqual([
        "defer",
        "edit",
      ]);
    } finally {
      await closeScenario(s);
    }
  });

  test("rejected runtime provider edits one bounded generic error after defer", async () => {
    const interaction = slash("123", "provider-rejected");
    await execute(
      interaction.interaction,
      async () => {
        throw new Error("provider unavailable");
      },
      () => 1000,
    );
    expect(interaction.events.map((event) => event.kind)).toEqual([
      "defer",
      "edit",
    ]);
    const edit = interaction.events[1]!.payload as Record<string, unknown>;
    assertBoard(edit);
    expect(JSON.stringify(edit)).toMatch(/temporarily unavailable|try again/i);
  });

  test("execute slash -> Inventory -> equipped SWORD -> Rolled -> page2 -> row25 is read-only", async () => {
    const s = await scenario();
    try {
      const { sourceIntervalCandidates } =
        await import("../discord-hero/domain/items");
      const {
        decodeDiscordHeroItemEffectsPageTarget,
        decodeDiscordHeroItemEffectsSectionTarget,
        encodeDiscordHeroEquipmentPage,
        encodeDiscordHeroEquipmentSelection,
      } = await import("../discord-hero/ui/inventory");
      const seed = createFreshPlayerStateFromCatalog(s.runtime.indexes);
      const rolledStats = [...s.runtime.indexes.tables.stat_mods.groups]
        .sort(([left], [right]) => left - right)
        .map(([statModKey, rows]) => ({
          statModKey,
          value: sourceIntervalCandidates(rows[0]!)[0]!,
        }));
      expect(rolledStats).toHaveLength(62);
      seed.heroes[0]!.equipment.push({
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "e2e-item-effects-sword",
          itemKey: 300001,
          rolledStats,
        },
      });
      s.runtime.repository.transactPlayer({
        scope: "e2e.item-effects",
        interactionId: "e2e-item-effects-seed",
        operation: "seed",
        requestSha256: "b".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: (value) => value as { kind: "seeded" },
        nowMs: 1000,
        mutate: () => ({
          kind: "commit",
          state: seed,
          outcome: { kind: "seeded" },
        }),
      });
      const before = rows(s.databasePath);
      const beforePlayer = JSON.stringify(
        s.runtime.repository.getPlayer("123"),
      );

      const start = slash("123", "e2e-ie-slash");
      await execute(start.interaction, s.provider, () => 2000);
      expect(start.events.map((event) => event.kind)).toEqual([
        "defer",
        "edit",
      ]);
      assertBoard(start.events[1]!.payload);

      const inventory = button(
        pickButton(start.events[1]!.payload, "inventory", "view"),
        "123",
        "e2e-ie-inventory",
      );
      await handleButton(inventory.interaction, s.provider, () => 2000);
      assertBoard(inventory.updates[0]);
      expect(inventory.replies).toHaveLength(0);

      const equipMenu = controls(inventory.updates[0]).menus.find((menu) => {
        try {
          return (
            decodeDiscordHeroCustomId(menu.customId).value ===
            encodeDiscordHeroEquipmentPage(0)
          );
        } catch {
          return false;
        }
      });
      if (equipMenu === undefined) {
        throw new Error("Inventory has no bound equipment selector");
      }
      const sword = equipMenu.options.find(
        (option) =>
          option.value === encodeDiscordHeroEquipmentSelection(101, "SWORD"),
      );
      if (sword === undefined) {
        throw new Error("equipment selector has no exact equipped SWORD");
      }
      const inspect = select(
        equipMenu.customId,
        [sword.value],
        "123",
        "e2e-ie-inspect",
      );
      await handleSelect(inspect.interaction, s.provider, () => 2000);
      assertBoard(inspect.updates[0]);

      const sectionMenu = controls(inspect.updates[0]).menus.find((menu) => {
        const value = decodeDiscordHeroCustomId(menu.customId).value;
        if (value === undefined) return false;
        try {
          decodeDiscordHeroItemEffectsSectionTarget(s.runtime.indexes, value);
          return true;
        } catch {
          return false;
        }
      });
      if (sectionMenu === undefined) {
        throw new Error("equipped detail has no Item Effects section selector");
      }
      const openRolled = select(
        sectionMenu.customId,
        ["r"],
        "123",
        "e2e-ie-rolled",
      );
      await handleSelect(openRolled.interaction, s.provider, () => 2000);
      assertBoard(openRolled.updates[0]);

      const pageTwoId = controls(openRolled.updates[0]).buttons.find((id) => {
        try {
          const decoded = decodeDiscordHeroCustomId(id);
          if (decoded.action !== "page" || decoded.value === undefined) {
            return false;
          }
          const target = decodeDiscordHeroItemEffectsPageTarget(
            s.runtime.indexes,
            decoded.value,
          );
          return target.sourceVector === "rolled" && target.effectPage === 1;
        } catch {
          return false;
        }
      });
      if (pageTwoId === undefined) {
        throw new Error("rolled Item Effects has no emitted page 2 control");
      }
      const openPageTwo = button(pageTwoId, "123", "e2e-ie-page2");
      await handleButton(openPageTwo.interaction, s.provider, () => 2000);
      assertBoard(openPageTwo.updates[0]);

      const detailMenu = controls(openPageTwo.updates[0]).menus.find((menu) => {
        try {
          const decoded = decodeDiscordHeroCustomId(menu.customId);
          if (decoded.action !== "select" || decoded.value === undefined) {
            return false;
          }
          const target = decodeDiscordHeroItemEffectsPageTarget(
            s.runtime.indexes,
            decoded.value,
          );
          return target.sourceVector === "rolled" && target.effectPage === 1;
        } catch {
          return false;
        }
      });
      if (detailMenu === undefined) {
        throw new Error("rolled page 2 has no emitted detail selector");
      }
      expect(detailMenu.options.map((option) => option.value)).toEqual(
        Array.from({ length: 25 }, (_, index) => String(index + 25)),
      );
      const inspectDetail = select(
        detailMenu.customId,
        ["25"],
        "123",
        "e2e-ie-row25",
      );
      await handleSelect(inspectDetail.interaction, s.provider, () => 2000);
      assertBoard(inspectDetail.updates[0]);
      expect(JSON.stringify(inspectDetail.updates[0])).toContain(
        "Selected effect #25",
      );
      expect(inspectDetail.replies).toHaveLength(0);

      for (const customId of [
        ...controls(inventory.updates[0]).buttons,
        ...controls(inspect.updates[0]).buttons,
        ...controls(openRolled.updates[0]).buttons,
        ...controls(openPageTwo.updates[0]).buttons,
        ...controls(inspectDetail.updates[0]).buttons,
      ]) {
        const decoded = decodeDiscordHeroCustomId(customId);
        expect(decoded.ownerId).toBe("123");
        expect(decoded.revision).toBe(1);
      }

      expect(rows(s.databasePath)).toBe(before);
      expect(JSON.stringify(s.runtime.repository.getPlayer("123"))).toBe(
        beforePlayer,
      );
      expect(s.runtime.repository.getPlayer("123")?.revision).toBe(1);
    } finally {
      await closeScenario(s);
    }
  });
});
