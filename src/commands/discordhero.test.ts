import { beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AttachmentBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { z } from "zod";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../discord-hero/catalog/indexes";
import { loadDiscordHeroCatalog } from "../discord-hero/catalog/loader";
import type { DiscordHeroCommunityContent } from "../discord-hero/community-content/compiler";
import {
  type LoadedDiscordHeroCommunityAchievements,
  loadDiscordHeroCommunityAchievements,
} from "../discord-hero/community-achievements/loader";
import {
  type LoadedDiscordHeroCommunityContent,
  loadDiscordHeroCommunityContent,
} from "../discord-hero/community-content/loader";
import {
  type LoadedDiscordHeroCommunityMarket,
  loadDiscordHeroCommunityMarket,
} from "../discord-hero/community-market/loader";
import {
  createFreshPlayerStateFromCatalog,
  validatePlayerAgainstCatalog,
} from "../discord-hero/domain/invariants";
import { sourceIntervalCandidates } from "../discord-hero/domain/items";
import type { DiscordHeroRuntime } from "../discord-hero/runtime";
import {
  DiscordHeroCorruptStateError,
  DiscordHeroRevisionConflictError,
  openDiscordHeroRepository,
} from "../discord-hero/state/repository";
import {
  decodeDiscordHeroCustomId,
  encodeDiscordHeroCustomId,
} from "../discord-hero/ui/custom-id";
import {
  encodeDiscordHeroAttributePage,
  encodeDiscordHeroAttributeTarget,
} from "../discord-hero/ui/attributes";
import {
  encodeDiscordHeroCodexDatasetPage,
  encodeDiscordHeroCodexRecordTarget,
} from "../discord-hero/ui/codex";
import {
  encodeDiscordHeroCommunityChunkTarget,
  encodeDiscordHeroCommunityDocumentTarget,
  encodeDiscordHeroCommunityListPage,
} from "../discord-hero/ui/community-content";
import {
  encodeDiscordHeroAchievementPage,
  encodeDiscordHeroAchievementTarget,
} from "../discord-hero/ui/achievements";
import { encodeDiscordHeroAlchemyPage } from "../discord-hero/ui/alchemy";
import { encodeDiscordHeroCollectionPage } from "../discord-hero/ui/collection";
import {
  encodeDiscordHeroContainerPageTarget,
  projectDiscordHeroContainerPage,
} from "../discord-hero/ui/containers";
import {
  encodeDiscordHeroCubePage,
  encodeDiscordHeroCubeTarget,
} from "../discord-hero/ui/cube";
import {
  DISCORD_HERO_INVENTORY_ALL_FILTER,
  decodeDiscordHeroItemEffectsPageTarget,
  decodeDiscordHeroItemEffectsSectionTarget,
  encodeDiscordHeroEquipTarget,
  encodeDiscordHeroEquipmentPage,
  encodeDiscordHeroEquipmentRollPageTarget,
  encodeDiscordHeroEquipmentSelection,
  encodeDiscordHeroItemEffectsPageTarget,
  encodeDiscordHeroItemEffectsSectionTarget,
  encodeDiscordHeroInventoryPage,
  encodeDiscordHeroInventoryRollPageTarget,
  encodeDiscordHeroUnequipTarget,
} from "../discord-hero/ui/inventory";
import { renderDiscordHeroWorkspace } from "../discord-hero/ui/workspace";
import {
  discordHeroRunes,
  encodeDiscordHeroRunePage,
} from "../discord-hero/ui/runes";
import {
  encodeDiscordHeroSkillPage,
  encodeDiscordHeroSkillTarget,
} from "../discord-hero/ui/skills";
import {
  discordHeroMarketPage,
  encodeDiscordHeroMarketPage,
} from "../discord-hero/ui/market";
import {
  discordHeroStages,
  encodeDiscordHeroStagePage,
} from "../discord-hero/ui/world";
import { selectDiscordHeroStarter } from "../discord-hero/use-cases/select-starter";
import { execute, handleButton, handleSelect } from "./discordhero";

let runtime: DiscordHeroRuntime;
let communityAchievements: LoadedDiscordHeroCommunityAchievements;
let communityContent: LoadedDiscordHeroCommunityContent;
let communityMarket: LoadedDiscordHeroCommunityMarket;
const decodeSeededOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("seeded") })
    .strict()
    .parse(value);
const decodeCreatedOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("created") })
    .strict()
    .parse(value);

beforeAll(async () => {
  const catalog = await loadDiscordHeroCatalog();
  [communityAchievements, communityContent, communityMarket] =
    await Promise.all([
      loadDiscordHeroCommunityAchievements(),
      loadDiscordHeroCommunityContent(),
      loadDiscordHeroCommunityMarket(),
    ]);
  const indexes = buildCatalogIndexes(catalog);
  const snapshot = {
    revision: 13,
    state: createFreshPlayerStateFromCatalog(indexes, 101),
  };
  runtime = {
    catalog,
    indexes,
    communityAchievements,
    communityContent,
    communityMarket,
    repository: {
      getPlayer: () => structuredClone(snapshot),
    } as unknown as DiscordHeroRuntime["repository"],
  };
});

function slashInteraction(userId = "123", interactionId = "slash-interaction") {
  const deferrals: unknown[] = [];
  const edits: unknown[] = [];
  const interaction = {
    id: interactionId,
    user: { id: userId },
    deferReply: async (payload: unknown) => {
      deferrals.push(payload);
    },
    editReply: async (payload: unknown) => {
      edits.push(payload);
    },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, deferrals, edits };
}

function buttonInteraction(
  customId: string,
  userId = "123",
  interactionId = "button-interaction",
) {
  const replies: unknown[] = [];
  const updates: unknown[] = [];
  const followUps: unknown[] = [];
  const interaction = {
    customId,
    id: interactionId,
    user: { id: userId },
    reply: async (payload: unknown) => {
      replies.push(payload);
    },
    update: async (payload: unknown) => {
      updates.push(payload);
    },
    followUp: async (payload: unknown) => {
      followUps.push(payload);
    },
  } as unknown as ButtonInteraction;
  return { interaction, replies, updates, followUps };
}

function selectInteraction(
  customId: string,
  values: readonly string[],
  userId = "123",
  interactionId = "select-interaction",
) {
  const replies: unknown[] = [];
  const updates: unknown[] = [];
  const followUps: unknown[] = [];
  const interaction = {
    customId,
    values,
    id: interactionId,
    user: { id: userId },
    reply: async (payload: unknown) => {
      replies.push(payload);
    },
    update: async (payload: unknown) => {
      updates.push(payload);
    },
    followUp: async (payload: unknown) => {
      followUps.push(payload);
    },
  } as unknown as StringSelectMenuInteraction;
  return { interaction, replies, updates, followUps };
}

function runtimeProvider(): Promise<DiscordHeroRuntime> {
  return Promise.resolve(runtime);
}

function payloadRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("test payload must be an object");
  }
  return value as Record<string, unknown>;
}

function collectCustomIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectCustomIds);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.custom_id === "string" ? [record.custom_id] : []),
    ...Object.values(record).flatMap(collectCustomIds),
  ];
}

function countDiscordComponents(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (total, entry) => total + countDiscordComponents(entry),
      0,
    );
  }
  if (typeof value !== "object" || value === null) return 0;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.type === "number" ? 1 : 0) +
    Object.values(record).reduce<number>(
      (total, entry) => total + countDiscordComponents(entry),
      0,
    )
  );
}

function collectTextDisplayContents(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectTextDisplayContents);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(record.type === 10 && typeof record.content === "string"
      ? [record.content]
      : []),
    ...Object.values(record).flatMap(collectTextDisplayContents),
  ];
}

function assertDiscordPayloadBounds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertDiscordPayloadBounds(entry);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (typeof record.custom_id === "string") {
    expect(record.custom_id.length).toBeLessThanOrEqual(100);
  }
  for (const field of [
    "label",
    "description",
    "placeholder",
    "value",
  ] as const) {
    if (typeof record[field] === "string") {
      expect(record[field].length).toBeLessThanOrEqual(100);
    }
  }
  if (record.type === 10 && typeof record.content === "string") {
    expect(record.content.length).toBeLessThanOrEqual(4_000);
  }
  if (Array.isArray(record.options)) {
    expect(record.options.length).toBeLessThanOrEqual(25);
  }
  for (const entry of Object.values(record)) {
    assertDiscordPayloadBounds(entry);
  }
}

function collectSelectMenus(value: unknown): Array<{
  customId: string;
  options: Array<Record<string, unknown>>;
}> {
  if (Array.isArray(value)) return value.flatMap(collectSelectMenus);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  if (typeof record.toJSON === "function") {
    return collectSelectMenus(record.toJSON());
  }
  return [
    ...(record.type === 3 &&
    typeof record.custom_id === "string" &&
    Array.isArray(record.options)
      ? [
          {
            customId: record.custom_id,
            options: record.options as Array<Record<string, unknown>>,
          },
        ]
      : []),
    ...Object.values(record).flatMap(collectSelectMenus),
  ];
}

type EnabledDiscordControl =
  | {
      kind: "button";
      customId: string;
    }
  | {
      kind: "select";
      customId: string;
      value: string;
    };

function collectEnabledDiscordControls(
  value: unknown,
): EnabledDiscordControl[] {
  const controls: EnabledDiscordControl[] = [];
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      for (const entry of current) visit(entry);
      return;
    }
    if (typeof current !== "object" || current === null) return;
    const record = current as Record<string, unknown>;
    if (record.disabled !== true && typeof record.custom_id === "string") {
      if (record.type === 2) {
        controls.push({ kind: "button", customId: record.custom_id });
      } else if (record.type === 3 && Array.isArray(record.options)) {
        const option = record.options.find(
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            (candidate as Record<string, unknown>).disabled !== true &&
            typeof (candidate as Record<string, unknown>).value === "string",
        ) as Record<string, unknown> | undefined;
        if (option !== undefined) {
          controls.push({
            kind: "select",
            customId: record.custom_id,
            value: option.value as string,
          });
        }
      }
    }
    for (const entry of Object.values(record)) visit(entry);
  };
  visit(JSON.parse(JSON.stringify(value)));
  return controls;
}

function customIdForAction(
  value: unknown,
  action: "equip" | "unequip",
): string {
  const customId = collectCustomIds(value).find(
    (candidate) => decodeDiscordHeroCustomId(candidate).action === action,
  );
  if (customId === undefined) {
    throw new Error(`test payload has no ${action} component`);
  }
  return customId;
}

function stateWithPaginatedRollFixtures() {
  const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
  const itemKeys = {
    SWORD: 300001,
    BOW: 310001,
    STAFF: 320001,
    SHIELD: 400001,
    ARROW: 410001,
    ORB: 420001,
    HELMET: 500001,
    ARMOR: 510001,
    GLOVES: 520001,
    BOOTS: 530001,
    AMULET: 601011,
    EARING: 611011,
    RING: 621011,
    BRACER: 631011,
  } as const;
  const categories = {
    101: [
      "SWORD",
      "SHIELD",
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ],
    201: [
      "BOW",
      "ARROW",
      "HELMET",
      "ARMOR",
      "GLOVES",
      "BOOTS",
      "AMULET",
      "EARING",
      "RING",
      "BRACER",
    ],
    301: ["STAFF", "ORB", "HELMET", "ARMOR", "GLOVES", "BOOTS"],
  } as const;
  for (const hero of state.heroes) {
    const heroCategories = categories[hero.heroKey as keyof typeof categories];
    if (heroCategories === undefined) continue;
    hero.equipment.push(
      ...heroCategories.map((gearType) => ({
        slot: gearType,
        asset: {
          kind: "gear" as const,
          instanceId: `handler-equipped-${hero.heroKey}-${gearType}`,
          itemKey: itemKeys[gearType],
          rolledStats:
            hero.heroKey === 301 && gearType === "BOOTS"
              ? Array.from({ length: 620 }, () => ({
                  statModKey: 105401,
                  value: 100,
                }))
              : [],
        },
      })),
    );
  }
  state.containers.inventory.slots.push({
    index: 4,
    asset: {
      kind: "gear",
      instanceId: "handler-inventory-paginated-rolls",
      itemKey: 300001,
      rolledStats: Array.from({ length: 620 }, () => ({
        statModKey: 105401,
        value: 100,
      })),
    },
  });
  validatePlayerAgainstCatalog(state, runtime.indexes);
  return state;
}

describe("DiscordHero Home command handler", () => {
  test("refreshes stale Home progression read-only through real SQLite with private owner bounds", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-home-progression-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.heroes[0]!.level = 10;
      state.heroes[0]!.xp = 7;
      repository.transactPlayer({
        scope: "test.home-progression-handler",
        interactionId: "create-home-progression-player",
        operation: "create",
        requestSha256: "e".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const before = JSON.stringify(repository.getPlayer("123"));
      let runtimeCalls = 0;
      let transactionCalls = 0;
      const provider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository: {
            getPlayer: (userId: string) => repository.getPlayer(userId),
            transactPlayer: () => {
              transactionCalls += 1;
              throw new Error("Home refresh must never transact");
            },
          } as unknown as DiscordHeroRuntime["repository"],
        } satisfies DiscordHeroRuntime);
      };
      const stale = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "home",
          action: "view",
          revision: 2,
        }),
        "123",
        "stale-home-progression",
      );

      await handleButton(stale.interaction, provider);

      expect(stale.replies).toHaveLength(0);
      expect(stale.updates).toHaveLength(1);
      expect(payloadRecord(stale.updates[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      const staleJson = JSON.stringify(stale.updates[0]);
      expect(staleJson).toContain(
        "State changed; this view was refreshed before accepting another action.",
      );
      expect(staleJson).toContain(
        "Knight (#101) · Knight · Lv10 · XP 7 / 74,880 · 74,873 XP to Lv11 · 0%",
      );
      const customIds = collectCustomIds(JSON.parse(staleJson));
      expect(customIds).not.toHaveLength(0);
      expect(customIds.every((customId) => customId.length <= 100)).toBe(true);
      expect(
        customIds.every((customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          return decoded.ownerId === "123" && decoded.revision === 1;
        }),
      ).toBe(true);
      expect(runtimeCalls).toBe(1);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);

      const callsBeforeForeign = runtimeCalls;
      const foreign = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "999",
          view: "home",
          action: "view",
          revision: 1,
        }),
        "123",
        "foreign-home-progression",
      );
      await handleButton(foreign.interaction, provider);
      expect(foreign.updates).toHaveLength(0);
      expect(foreign.replies).toEqual([
        {
          content: "Workspace này thuộc về người chơi khác.",
          flags: MessageFlags.Ephemeral,
        },
      ]);
      expect(runtimeCalls).toBe(callsBeforeForeign);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("DiscordHero Codex command handlers", () => {
  test("rejects another owner before loading runtime", async () => {
    let runtimeCalls = 0;

    for (const value of [
      encodeDiscordHeroCodexRecordTarget("heroes", 0),
      encodeDiscordHeroCommunityChunkTarget(
        communityContent,
        "builds",
        0,
        0,
        0,
      ),
    ]) {
      const customId = encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "codex",
        action: "export",
        revision: 13,
        value,
      });
      const fake = buttonInteraction(customId);

      await handleButton(fake.interaction, async () => {
        runtimeCalls += 1;
        return runtime;
      });

      expect(fake.updates).toHaveLength(0);
      expect(fake.replies).toHaveLength(1);
      expect(payloadRecord(fake.replies[0]).flags).toBe(MessageFlags.Ephemeral);
    }
    expect(runtimeCalls).toBe(0);
  });

  test("refreshes stale and forged exports with update-safe flags", async () => {
    const stale = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 12,
        value: encodeDiscordHeroCodexRecordTarget("heroes", 0),
      }),
    );
    await handleButton(stale.interaction, runtimeProvider);
    expect(stale.replies).toHaveLength(0);
    expect(stale.updates).toHaveLength(1);
    expect(payloadRecord(stale.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(stale.updates[0])).toContain(
      "refresh before exporting",
    );

    const forged = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 13,
        value: encodeDiscordHeroCodexRecordTarget("heroes", 999),
      }),
    );
    await handleButton(forged.interaction, runtimeProvider);
    expect(forged.replies).toHaveLength(0);
    expect(forged.updates).toHaveLength(1);
    expect(payloadRecord(forged.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(forged.updates[0])).toContain(
      "does not name a valid source row",
    );
  });

  test("exports compact source JSON byte-for-byte in an ephemeral attachment", async () => {
    const fake = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 13,
        value: encodeDiscordHeroCodexRecordTarget("heroes", 0),
      }),
    );
    await handleButton(fake.interaction, runtimeProvider);

    expect(fake.updates).toHaveLength(0);
    expect(fake.replies).toHaveLength(1);
    const reply = payloadRecord(fake.replies[0]);
    expect(reply.flags).toBe(MessageFlags.Ephemeral);
    const files = reply.files as AttachmentBuilder[];
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("discordhero-heroes-1.json");
    expect(Buffer.isBuffer(files[0]!.attachment)).toBe(true);
    expect((files[0]!.attachment as Buffer).toString("utf8")).toBe(
      JSON.stringify(runtime.indexes.tables.heroes.rows[0]),
    );
  });

  test("accepts one in-page dataset and rejects multi-select or cross-page forgery", async () => {
    const customId = encodeDiscordHeroCustomId({
      ownerId: "123",
      view: "codex",
      action: "select",
      revision: 13,
      value: encodeDiscordHeroCodexDatasetPage(0),
    });
    const valid = selectInteraction(customId, ["heroes"]);
    await handleSelect(valid.interaction, runtimeProvider);
    expect(valid.replies).toHaveLength(0);
    expect(payloadRecord(valid.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(valid.updates[0])).toContain("**heroes** · row 1/6");

    for (const values of [["heroes", "items"], ["runes"]]) {
      const invalid = selectInteraction(customId, values);
      await handleSelect(invalid.interaction, runtimeProvider);
      expect(invalid.replies).toHaveLength(0);
      expect(payloadRecord(invalid.updates[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      expect(JSON.stringify(invalid.updates[0])).toContain(
        "does not name a valid source dataset",
      );
    }
  });

  test("browses stale Community pages and chunks while preserving the exact bound location", async () => {
    const list = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroCommunityListPage(
          communityContent,
          "builds",
          1,
        ),
      }),
    );
    await handleButton(list.interaction, runtimeProvider);

    expect(list.replies).toHaveLength(0);
    expect(list.updates).toHaveLength(1);
    expect(JSON.stringify(list.updates[0])).toContain(
      "read-only Community view was refreshed",
    );
    expect(JSON.stringify(list.updates[0])).toContain("Builds · Page 2/4");

    const target = encodeDiscordHeroCommunityChunkTarget(
      communityContent,
      "builds",
      0,
      0,
      1,
    );
    const chunk = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "page",
        revision: 12,
        value: target,
      }),
    );
    await handleButton(chunk.interaction, runtimeProvider);

    const chunkJson = JSON.stringify(chunk.updates[0]);
    expect(chunk.replies).toHaveLength(0);
    expect(chunkJson).toContain("read-only Community view was refreshed");
    expect(chunkJson).toContain("Chunk 2/");
    expect(chunkJson).toContain(communityContent.documents[0]!.sha256);
  });

  test("selects only a canonical document projected on the bound Community page", async () => {
    const customId = encodeDiscordHeroCustomId({
      ownerId: "123",
      view: "codex",
      action: "select",
      revision: 13,
      value: encodeDiscordHeroCommunityListPage(communityContent, "builds", 0),
    });
    const validTarget = encodeDiscordHeroCommunityDocumentTarget(
      communityContent,
      "builds",
      0,
      0,
    );
    const valid = selectInteraction(customId, [validTarget]);
    await handleSelect(valid.interaction, runtimeProvider);

    expect(valid.replies).toHaveLength(0);
    expect(JSON.stringify(valid.updates[0])).toContain(
      communityContent.documents[0]!.sha256,
    );
    const crossPageTarget = encodeDiscordHeroCommunityDocumentTarget(
      communityContent,
      "builds",
      1,
      25,
    );

    for (const values of [
      [validTarget.replace("cd-b-", "cd-g-")],
      [crossPageTarget],
      [validTarget, validTarget],
      [validTarget.replace("cd-b-0-0-", "cd-b-0-00-")],
    ]) {
      const invalid = selectInteraction(customId, values);
      await handleSelect(invalid.interaction, runtimeProvider);
      expect(invalid.replies).toHaveLength(0);
      expect(JSON.stringify(invalid.updates[0])).toContain(
        "does not name a valid Community document",
      );
      expect(JSON.stringify(invalid.updates[0])).not.toContain(
        communityContent.documents[113]!.sha256,
      );
    }
  });

  test("exports exact Community Markdown and blocks stale export without an attachment", async () => {
    const document = communityContent.documents[0]!;
    const target = encodeDiscordHeroCommunityChunkTarget(
      communityContent,
      "builds",
      0,
      0,
      1,
    );
    const current = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 13,
        value: target,
      }),
    );
    await handleButton(current.interaction, runtimeProvider);

    expect(current.updates).toHaveLength(0);
    expect(current.replies).toHaveLength(1);
    const reply = payloadRecord(current.replies[0]);
    expect(reply.flags).toBe(MessageFlags.Ephemeral);
    const files = reply.files as AttachmentBuilder[];
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("discordhero-community-1-builds.md");
    expect((files[0]!.attachment as Buffer).toString("utf8")).toBe(
      document.markdown,
    );

    const stale = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 12,
        value: target,
      }),
    );
    await handleButton(stale.interaction, runtimeProvider);

    expect(stale.replies).toHaveLength(0);
    expect(stale.updates).toHaveLength(1);
    expect(payloadRecord(stale.updates[0]).files).toBeUndefined();
    expect(JSON.stringify(stale.updates[0])).toContain(
      "refresh before exporting this Community document",
    );
    expect(JSON.stringify(stale.updates[0])).toContain(document.sha256);
    expect(JSON.stringify(stale.updates[0])).toContain("Chunk 2/");
  });

  test("Community browse, forgery, and export paths never transact or leak another document", async () => {
    let transactions = 0;
    const trackedRuntime = {
      ...runtime,
      repository: {
        getPlayer: runtime.repository.getPlayer.bind(runtime.repository),
        transactPlayer: () => {
          transactions += 1;
          throw new Error("read-only Community path attempted a transaction");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    };
    const provider = () => Promise.resolve(trackedRuntime);
    const validDocument = encodeDiscordHeroCommunityChunkTarget(
      communityContent,
      "builds",
      0,
      0,
      0,
    );
    const crossPageDocument = encodeDiscordHeroCommunityDocumentTarget(
      communityContent,
      "builds",
      1,
      25,
    );
    const interactions = [
      buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "codex",
          action: "page",
          revision: 13,
          value: validDocument.replace("cc-b-0-0-0-", "cc-b-0-0-z-"),
        }),
      ),
      buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "codex",
          action: "export",
          revision: 13,
          value: validDocument.replace("cc-b-", "cc-g-"),
        }),
      ),
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "codex",
          action: "select",
          revision: 13,
          value: encodeDiscordHeroCommunityListPage(
            communityContent,
            "builds",
            0,
          ),
        }),
        [crossPageDocument],
      ),
      buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "codex",
          action: "export",
          revision: 13,
          value: validDocument,
        }),
      ),
    ];

    for (const candidate of interactions) {
      await ("values" in candidate.interaction
        ? handleSelect(
            candidate.interaction as StringSelectMenuInteraction,
            provider,
          )
        : handleButton(candidate.interaction as ButtonInteraction, provider));
    }

    expect(transactions).toBe(0);
    expect(JSON.stringify(interactions.slice(0, 3))).not.toContain(
      communityContent.documents[113]!.sha256,
    );
  });

  test("rejects an export identity from an older artifact without disclosing the shifted document", async () => {
    const oldTarget = encodeDiscordHeroCommunityChunkTarget(
      communityContent,
      "builds",
      0,
      0,
      0,
    );
    const shiftedContent = structuredClone(
      communityContent,
    ) as DiscordHeroCommunityContent;
    shiftedContent.provenance.compiledSha256 = "a".repeat(64);
    shiftedContent.documents[0]!.frontmatter.title = "SHIFTED SECRET TITLE";
    shiftedContent.documents[0]!.path = "builds/shifted-secret.md";
    shiftedContent.documents[0]!.sha256 = "b".repeat(64);
    shiftedContent.documents[0]!.markdown = "SHIFTED SECRET MARKDOWN";
    const shiftedRuntime = {
      ...runtime,
      communityContent: shiftedContent,
    };
    const fake = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "codex",
        action: "export",
        revision: 13,
        value: oldTarget,
      }),
    );

    await handleButton(fake.interaction, () => Promise.resolve(shiftedRuntime));

    expect(fake.replies).toHaveLength(0);
    expect(fake.updates).toHaveLength(1);
    const payload = JSON.stringify(fake.updates[0]);
    expect(payload).toContain("does not name a valid Community document");
    expect(payload).not.toContain("SHIFTED SECRET");
    expect(payload).not.toContain("b".repeat(64));
  });
});

describe("DiscordHero Hero command handlers", () => {
  test("inspects an exact source Hero and refreshes stale state read-only", async () => {
    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "heroes",
        action: "select",
        revision: 12,
      }),
      ["401"],
    );
    await handleSelect(selected.interaction, runtimeProvider);

    expect(selected.replies).toHaveLength(0);
    expect(payloadRecord(selected.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(selected.updates[0])).toContain(
      "read-only Hero inspection was refreshed",
    );
    expect(JSON.stringify(selected.updates[0])).toContain("**Priest** · #401");
    expect(JSON.stringify(selected.updates[0])).toContain("Base skill: 40001");
  });

  test("reaches the base-only combat line through the real owner-bound Hero select without state change", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-hero-base-combat-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      repository.transactPlayer({
        scope: "test.hero-base-combat-handler",
        interactionId: "create-hero-base-combat-player",
        operation: "create",
        requestSha256: "9".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const before = JSON.stringify(repository.getPlayer("123"));
      let runtimeCalls = 0;
      let transactionCalls = 0;
      const provider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository: {
            getPlayer: (userId: string) => repository.getPlayer(userId),
            transactPlayer: () => {
              transactionCalls += 1;
              throw new Error("Hero inspection must never transact");
            },
          } as unknown as DiscordHeroRuntime["repository"],
        } satisfies DiscordHeroRuntime);
      };
      const selected = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 1,
        }),
        ["101"],
        "123",
        "hero-base-combat",
      );

      await handleSelect(selected.interaction, provider);

      expect(selected.replies).toHaveLength(0);
      expect(selected.updates).toHaveLength(1);
      expect(payloadRecord(selected.updates[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      expect(payloadRecord(selected.updates[0]).files).toBeUndefined();
      expect(payloadRecord(selected.updates[0]).attachments).toBeUndefined();
      const payload = JSON.parse(JSON.stringify(selected.updates[0]));
      const text = collectTextDisplayContents(payload).join("\n");
      expect(text).toContain(
        "Base-only canonical combat units: attackDamage 2 · attackSpeedPerSecond 0.9 · castSpeedMultiplier 1 · criticalChanceRatio 0.025 · criticalDamageMultiplier 1.4 · baseAttackDps exact 1.818 · baseAttackDpsDisplay2dp 1.82",
      );
      expect(text).toContain(
        "Base + allocated Attributes [Base, Attribute] · uncapped and unrounded raw source units:",
      );
      const customIds = collectCustomIds(payload);
      expect(customIds).not.toHaveLength(0);
      expect(new Set(customIds).size).toBe(customIds.length);
      const decodedControls = customIds.map(decodeDiscordHeroCustomId);
      expect(
        decodedControls.every(
          (control) =>
            control.ownerId === "123" &&
            control.revision === 1 &&
            ["view", "select", "page"].includes(control.action ?? ""),
        ),
      ).toBe(true);
      expect(countDiscordComponents(payload)).toBeLessThanOrEqual(40);
      assertDiscordPayloadBounds(payload);
      expect(runtimeCalls).toBe(1);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);

      const stale = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 2,
        }),
        ["101"],
        "123",
        "stale-hero-base-combat",
      );
      await handleSelect(stale.interaction, provider);
      expect(stale.replies).toHaveLength(0);
      expect(stale.updates).toHaveLength(1);
      expect(JSON.stringify(stale.updates[0])).toContain(
        "State changed; the read-only Hero inspection was refreshed.",
      );
      expect(payloadRecord(stale.updates[0]).files).toBeUndefined();
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);

      const callsBeforeForeign = runtimeCalls;
      const foreign = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "999",
          view: "heroes",
          action: "select",
          revision: 1,
        }),
        ["101"],
        "123",
        "foreign-hero-base-combat",
      );
      await handleSelect(foreign.interaction, provider);
      expect(foreign.updates).toHaveLength(0);
      expect(foreign.replies).toEqual([
        {
          content: "Workspace này thuộc về người chơi khác.",
          flags: MessageFlags.Ephemeral,
        },
      ]);
      expect(runtimeCalls).toBe(callsBeforeForeign);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects unknown and non-canonical Hero keys", async () => {
    for (const heroKey of ["999", "0401"]) {
      const invalid = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 13,
        }),
        [heroKey],
      );
      await handleSelect(invalid.interaction, runtimeProvider);
      expect(JSON.stringify(invalid.updates[0])).toContain(
        "does not name a source Hero",
      );
    }
  });

  test("binds Attribute tabs and detail to owner, revision, Hero, page, and exact target without transactions", async () => {
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Attribute inspection must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };
    const knightPage = encodeDiscordHeroAttributePage(runtime.indexes, 101, 0);
    const knightTarget = encodeDiscordHeroAttributeTarget(
      runtime.indexes,
      101,
      0,
      101001,
    );

    const staleTab = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "heroes",
        action: "page",
        revision: 12,
        value: knightPage,
      }),
    );
    await handleButton(staleTab.interaction, provider);
    expect(JSON.stringify(staleTab.updates[0])).toContain(
      "read-only Attribute page was refreshed",
    );
    expect(JSON.stringify(staleTab.updates[0])).toContain(
      "Knight Attributes · Page 1/1",
    );

    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "heroes",
        action: "select",
        revision: 13,
        value: knightPage,
      }),
      [knightTarget],
    );
    await handleSelect(selected.interaction, provider);
    expect(JSON.stringify(selected.updates[0])).toContain(
      "Attribute #101001 · Group #10001",
    );

    const rejected = [
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 13,
          value: knightPage,
        }),
        [encodeDiscordHeroAttributeTarget(runtime.indexes, 201, 0, 201001)],
      ),
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 13,
          value: knightPage,
        }),
        ["a-2t-1-25xl"],
      ),
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "select",
          revision: 13,
          value: knightPage,
        }),
        ["a-02t-0-25xl"],
      ),
    ];
    for (const candidate of rejected) {
      await handleSelect(candidate.interaction, provider);
      expect(JSON.stringify(candidate.updates[0])).toContain(
        "does not name an Attribute on the bound Hero page",
      );
    }

    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "heroes",
        action: "page",
        revision: 13,
        value: knightPage,
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(5);
    expect(transactionCalls).toBe(0);
  });
});

describe("DiscordHero Attribute allocation command handler", () => {
  test("commits +1 and keeps exact Hero page and node after success and rejection", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-attribute-allocation-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      repository.transactPlayer({
        scope: "test.attribute-handler",
        interactionId: "create-attribute-player",
        operation: "create",
        requestSha256: "e".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
          outcome: { kind: "created" },
        }),
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      const firstTarget = encodeDiscordHeroAttributeTarget(
        runtime.indexes,
        101,
        0,
        101001,
      );
      const success = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "upgrade",
          revision: 1,
          value: firstTarget,
        }),
        "123",
        "allocate-attribute-success",
      );
      await handleButton(success.interaction, provider);
      const successJson = JSON.stringify(success.updates[0]);
      expect(successJson).toContain(
        "Attribute #101001 allocated to level 1 for 1 point",
      );
      expect(successJson).toContain("Knight Attributes · Page 1/1");
      expect(successJson).toContain("Attribute #101001 · Group #10001");
      expect(successJson).toContain("Allocated level: 1 / 3");
      expect(successJson).toContain(
        "Allocated passive effect: #101001 · AttackDamage · FLAT · raw 1/level · raw total 1 · flat internal units",
      );
      const afterSuccess = repository.getPlayer("123")!;
      expect(afterSuccess.revision).toBe(2);
      expect(
        afterSuccess.state.heroes.find((hero) => hero.heroKey === 101),
      ).toMatchObject({
        heroKey: 101,
        attributes: [{ key: 101001, level: 1 }],
        skills: [],
        passives: [],
      });

      const secondTarget = encodeDiscordHeroAttributeTarget(
        runtime.indexes,
        101,
        0,
        101002,
      );
      const rejected = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "upgrade",
          revision: 2,
          value: secondTarget,
        }),
        "123",
        "allocate-attribute-rejected",
      );
      await handleButton(rejected.interaction, provider);
      const rejectedJson = JSON.stringify(rejected.updates[0]);
      expect(rejectedJson).toContain(
        "Attribute #101002 needs 1 point; 0 remain",
      );
      expect(rejectedJson).toContain("Attribute #101002 · Group #10001");
      expect(rejectedJson).toContain("Allocation status: Insufficient points");
      expect(repository.getPlayer("123")?.revision).toBe(2);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects stale, forged, cross-Hero, unowned, and foreign controls before mutation", async () => {
    const snapshot = {
      revision: 9,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve({
        ...runtime,
        repository: {
          getPlayer: () => structuredClone(snapshot),
          transactPlayer: () => {
            transactionCalls += 1;
            throw new DiscordHeroRevisionConflictError("123", 9, 10);
          },
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    };
    const target = encodeDiscordHeroAttributeTarget(
      runtime.indexes,
      101,
      0,
      101001,
    );

    const stale = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "heroes",
        action: "upgrade",
        revision: 8,
        value: target,
      }),
    );
    await handleButton(stale.interaction, provider);
    expect(JSON.stringify(stale.updates[0])).toContain(
      "Attribute quote was refreshed without allocating a point",
    );
    expect(JSON.stringify(stale.updates[0])).toContain(
      "Attribute #101001 · Group #10001",
    );
    expect(transactionCalls).toBe(0);

    for (const value of [
      "a-2t-0-4b3d",
      "a-2t-1-25xl",
      "a-02t-0-25xl",
      encodeDiscordHeroAttributeTarget(runtime.indexes, 401, 0, 401001),
    ]) {
      const forged = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "heroes",
          action: "upgrade",
          revision: 9,
          value,
        }),
      );
      await handleButton(forged.interaction, provider);
      expect(JSON.stringify(forged.updates[0])).toContain(
        "does not name an owned Attribute on its bound Hero page",
      );
    }
    expect(transactionCalls).toBe(0);

    const conflict = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "heroes",
        action: "upgrade",
        revision: 9,
        value: target,
      }),
    );
    await handleButton(conflict.interaction, provider);
    expect(JSON.stringify(conflict.updates[0])).toContain(
      "Attribute quote was refreshed without allocating a point",
    );
    expect(JSON.stringify(conflict.updates[0])).toContain(
      "Attribute #101001 · Group #10001",
    );
    expect(transactionCalls).toBe(1);

    const callsBeforeForeign = runtimeCalls;
    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "heroes",
        action: "upgrade",
        revision: 9,
        value: target,
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(callsBeforeForeign);
    expect(transactionCalls).toBe(1);
  });
});

describe("DiscordHero Cube browser command handlers", () => {
  test("binds main and sub-recipe browsing to owner, revision, page, and source group without transactions", async () => {
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Cube browsing must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };
    const mainPage = encodeDiscordHeroCubePage({
      kind: "main-recipes",
      page: 0,
    });
    const synthesisTarget = encodeDiscordHeroCubeTarget({
      kind: "main-recipe",
      page: 0,
      cubeKey: 100001,
    });
    const synthesisSubPage = encodeDiscordHeroCubePage({
      kind: "sub-recipes",
      cubeKey: 100001,
      page: 0,
    });
    const synthesisSubTarget = encodeDiscordHeroCubeTarget({
      kind: "sub-recipe",
      cubeKey: 100001,
      page: 0,
      cubeSubRecipeKey: 100011,
    });

    const staleBrowse = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "cube",
        action: "page",
        revision: 12,
        value: mainPage,
      }),
    );
    await handleButton(staleBrowse.interaction, provider);
    expect(JSON.stringify(staleBrowse.updates[0])).toContain(
      "read-only Cube Browse page was refreshed",
    );

    const selectedMain = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "cube",
        action: "select",
        revision: 13,
        value: mainPage,
      }),
      [synthesisTarget],
    );
    await handleSelect(selectedMain.interaction, provider);
    expect(JSON.stringify(selectedMain.updates[0])).toContain(
      "Main #100001 · SYNTHESIS · Index 0",
    );

    const selectedSub = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "cube",
        action: "select",
        revision: 13,
        value: synthesisSubPage,
      }),
      [synthesisSubTarget],
    );
    await handleSelect(selectedSub.interaction, provider);
    expect(JSON.stringify(selectedSub.updates[0])).toContain(
      "Sub #100011 · Lv.1~10",
    );

    const rejected = [
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "cube",
          action: "select",
          revision: 13,
          value: synthesisSubPage,
        }),
        [
          encodeDiscordHeroCubeTarget({
            kind: "sub-recipe",
            cubeKey: 700001,
            page: 0,
            cubeSubRecipeKey: 700011,
          }),
        ],
      ),
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "cube",
          action: "select",
          revision: 13,
          value: synthesisSubPage,
        }),
        ["s-255t-1-255v"],
      ),
      selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "cube",
          action: "select",
          revision: 13,
          value: synthesisSubPage,
        }),
        ["s-0255t-0-255v"],
      ),
    ];
    for (const candidate of rejected) {
      await handleSelect(candidate.interaction, provider);
      expect(JSON.stringify(candidate.updates[0])).toContain(
        "does not name a Cube recipe on the bound source page and group",
      );
    }

    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "cube",
        action: "page",
        revision: 13,
        value: mainPage,
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(6);
    expect(transactionCalls).toBe(0);
  });

  test("keeps Cube unlock results in the originating Browse or Alchemy tab", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-cube-tabs-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      for (const userId of ["130", "131"]) {
        repository.transactPlayer({
          scope: "test.cube-tab-handler",
          interactionId: `seed-cube-tab-${userId}`,
          operation: "seed",
          requestSha256: userId.repeat(64).slice(0, 64),
          userId,
          expectedRevision: null,
          decodeOutcome: decodeSeededOutcome,
          nowMs: 1,
          mutate: () => ({
            kind: "commit",
            state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
            outcome: { kind: "seeded" },
          }),
        });
      }
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      const browse = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "130",
          view: "cube",
          action: "unlock",
          revision: 1,
          value: "b-200001",
        }),
        "130",
        "unlock-cube-browse",
      );
      const alchemy = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "131",
          view: "cube",
          action: "unlock",
          revision: 1,
          value: "a-200001",
        }),
        "131",
        "unlock-cube-alchemy",
      );

      await handleButton(browse.interaction, provider);
      await handleButton(alchemy.interaction, provider);

      const browseJson = JSON.stringify(browse.updates[0]);
      const alchemyJson = JSON.stringify(alchemy.updates[0]);
      expect(browseJson).toContain("ALCHEMY unlocked for 10 gold");
      expect(browseJson).toContain("Browse main recipes · Page 1");
      expect(browseJson).toContain("cube:page:2:t-c-b");
      expect(alchemyJson).toContain("ALCHEMY unlocked for 10 gold");
      expect(alchemyJson).toContain("Alchemy · Page 1/1");
      expect(alchemyJson).toContain("cube:page:2:t-c-a");
      expect(
        collectCustomIds(browse.updates[0])
          .map(decodeDiscordHeroCustomId)
          .filter(
            (customId) =>
              customId.view === "cube" && customId.action === "unlock",
          )
          .every((customId) => customId.value?.startsWith("b-")),
      ).toBe(true);
      expect(
        collectCustomIds(alchemy.updates[0])
          .map(decodeDiscordHeroCustomId)
          .filter(
            (customId) =>
              customId.view === "cube" && customId.action === "unlock",
          )
          .every((customId) => customId.value?.startsWith("a-")),
      ).toBe(true);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("DiscordHero Rune command handlers", () => {
  test("pages and inspects exact Skills read-only while rejecting stale, cross-page, and foreign controls", async () => {
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Skill inspection must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };

    const stalePage = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroSkillPage(4),
      }),
    );
    await handleButton(stalePage.interaction, provider);
    expect(JSON.stringify(stalePage.updates[0])).toContain(
      "read-only Skill page was refreshed",
    );
    expect(JSON.stringify(stalePage.updates[0])).toContain("Skills · Page 5/5");

    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroSkillPage(2),
      }),
      [encodeDiscordHeroSkillTarget(68)],
    );
    await handleSelect(selected.interaction, provider);
    expect(JSON.stringify(selected.updates[0])).toContain(
      'Source key: \\"200111 \\"',
    );

    const staleSelection = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "select",
        revision: 12,
        value: encodeDiscordHeroSkillPage(0),
      }),
      [encodeDiscordHeroSkillTarget(1)],
    );
    await handleSelect(staleSelection.interaction, provider);
    expect(JSON.stringify(staleSelection.updates[0])).toContain(
      "read-only Skill inspection was refreshed",
    );

    const crossPage = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroSkillPage(0),
      }),
      [encodeDiscordHeroSkillTarget(68)],
    );
    await handleSelect(crossPage.interaction, provider);
    expect(JSON.stringify(crossPage.updates[0])).toContain(
      "does not name a Skill on the bound source page",
    );

    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "runes",
        action: "page",
        revision: 13,
        value: encodeDiscordHeroSkillPage(0),
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(4);
    expect(transactionCalls).toBe(0);
  });

  test("pages all source Runes without mutating stale state", async () => {
    const fake = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroRunePage(7),
      }),
    );
    await handleButton(fake.interaction, runtimeProvider);

    expect(fake.replies).toHaveLength(0);
    expect(fake.updates).toHaveLength(1);
    expect(payloadRecord(fake.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(fake.updates[0])).toContain(
      "read-only Rune page was refreshed",
    );
    expect(JSON.stringify(fake.updates[0])).toContain("Page 8/8");
  });

  test("rejects stale and cross-page Rune selections before transaction", async () => {
    const stale = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "upgrade",
        revision: 12,
        value: encodeDiscordHeroRunePage(0),
      }),
      ["1"],
    );
    await handleSelect(stale.interaction, runtimeProvider);
    expect(JSON.stringify(stale.updates[0])).toContain(
      "refreshed without spending gold",
    );

    const pageOneKey = discordHeroRunes(runtime.indexes, 1)[0]!.RuneKey;
    const forged = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "runes",
        action: "upgrade",
        revision: 13,
        value: encodeDiscordHeroRunePage(0),
      }),
      [String(pageOneKey)],
    );
    await handleSelect(forged.interaction, runtimeProvider);
    expect(JSON.stringify(forged.updates[0])).toContain(
      "does not name a Rune on the bound source page",
    );
  });

  test("rejects a forged unsupported Rune action before any real SQLite transaction or state change", async () => {
    const tempRoot = join(
      process.cwd(),
      ".tmp",
      `discordhero-command-rune-gate-${process.pid}`,
    );
    rmSync(tempRoot, { recursive: true, force: true });
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      expect(
        selectDiscordHeroStarter(repository, runtime.indexes, {
          userId: "123",
          interactionId: "create-rune-gate-player",
          starterHeroKey: 101,
          nowMs: 1,
        }).revision,
      ).toBe(1);
      repository.transactPlayer({
        scope: "test",
        interactionId: "seed-rune-gate-player",
        operation: "seed",
        requestSha256: "d".repeat(64),
        userId: "123",
        expectedRevision: 1,
        decodeOutcome: decodeSeededOutcome,
        nowMs: 2,
        mutate: (current) => {
          if (current === null) throw new Error("expected Rune player");
          const state = structuredClone(current);
          state.gold = 1_000;
          // Rune 21 is owned so that Rune 22 is reachable; its
          // MaxInventorySlot effect is the still-oracle-gated one under test.
          state.runes = [
            { key: 1, level: 1 },
            { key: 20, level: 1 },
            { key: 21, level: 1 },
          ];
          return { kind: "commit", state, outcome: { kind: "seeded" } };
        },
      });
      const before = repository.getPlayer("123");
      let transactionCalls = 0;
      const guardedRepository = new Proxy(repository, {
        get(target, property) {
          const value = Reflect.get(target, property, target);
          if (property === "transactPlayer") {
            return (...args: unknown[]) => {
              transactionCalls += 1;
              return Reflect.apply(
                value as (...input: unknown[]) => unknown,
                target,
                args,
              );
            };
          }
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository: guardedRepository,
        } satisfies DiscordHeroRuntime);
      const forged = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "runes",
          action: "upgrade",
          revision: 2,
          value: encodeDiscordHeroRunePage(2),
        }),
        ["22"],
        "123",
        "forge-unsupported-rune",
      );

      await handleSelect(forged.interaction, provider);

      expect(forged.replies).toHaveLength(0);
      expect(forged.updates).toHaveLength(1);
      expect(JSON.stringify(forged.updates[0])).toContain(
        "MaxInventorySlot is oracle-gated",
      );
      expect(transactionCalls).toBe(0);
      expect(repository.getPlayer("123")).toEqual(before);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects an unsupported Rune action with invalid owned Hero before UI output or transaction", async () => {
    const tempRoot = join(
      process.cwd(),
      ".tmp",
      `discordhero-command-rune-invalid-state-${process.pid}`,
    );
    rmSync(tempRoot, { recursive: true, force: true });
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      selectDiscordHeroStarter(repository, runtime.indexes, {
        userId: "123",
        interactionId: "create-invalid-rune-player",
        starterHeroKey: 101,
        nowMs: 1,
      });
      repository.transactPlayer({
        scope: "test",
        interactionId: "seed-invalid-rune-player",
        operation: "seed",
        requestSha256: "e".repeat(64),
        userId: "123",
        expectedRevision: 1,
        decodeOutcome: decodeSeededOutcome,
        nowMs: 2,
        mutate: (current) => {
          if (current === null) throw new Error("expected Rune player");
          const state = structuredClone(current);
          state.gold = 1_000;
          state.runes = [
            { key: 1, level: 1 },
            { key: 20, level: 1 },
          ];
          return { kind: "commit", state, outcome: { kind: "seeded" } };
        },
      });
      const before = repository.getPlayer("123");
      if (before === null) throw new Error("expected seeded Rune snapshot");
      const invalid = structuredClone(before);
      invalid.state.heroes[0]!.heroKey = 999999;
      let transactionCalls = 0;
      const guardedRepository = new Proxy(repository, {
        get(target, property) {
          if (property === "getPlayer") return () => invalid;
          const value = Reflect.get(target, property, target);
          if (property === "transactPlayer") {
            return (...args: unknown[]) => {
              transactionCalls += 1;
              return Reflect.apply(
                value as (...input: unknown[]) => unknown,
                target,
                args,
              );
            };
          }
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository: guardedRepository,
        } satisfies DiscordHeroRuntime);
      const forged = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "runes",
          action: "upgrade",
          revision: 2,
          value: encodeDiscordHeroRunePage(2),
        }),
        ["21"],
        "123",
        "invalid-unsupported-rune",
      );

      await expect(handleSelect(forged.interaction, provider)).rejects.toThrow(
        "heroes[0].heroKey references unknown heroes key 999999",
      );
      expect(forged.replies).toHaveLength(0);
      expect(forged.updates).toHaveLength(0);
      expect(transactionCalls).toBe(0);
      expect(repository.getPlayer("123")).toEqual(before);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("commits one exact Rune level through the real repository", async () => {
    const tempRoot = join(
      process.cwd(),
      ".tmp",
      `discordhero-command-rune-${process.pid}`,
    );
    rmSync(tempRoot, { recursive: true, force: true });
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const opened = selectDiscordHeroStarter(repository, runtime.indexes, {
        userId: "123",
        interactionId: "create-rune-handler-player",
        starterHeroKey: 101,
        nowMs: 1,
      });
      expect(opened.revision).toBe(1);
      repository.transactPlayer({
        scope: "test",
        interactionId: "seed-supported-rune-handler",
        operation: "seed",
        requestSha256: "e".repeat(64),
        userId: "123",
        expectedRevision: 1,
        decodeOutcome: decodeSeededOutcome,
        nowMs: 2,
        mutate: (current) => {
          if (current === null) throw new Error("expected Rune player");
          const state = structuredClone(current);
          state.gold = 20_000;
          state.runes = [
            { key: 1, level: 1 },
            { key: 10, level: 1 },
            { key: 201, level: 1 },
            { key: 202, level: 1 },
            { key: 203, level: 1 },
          ];
          return { kind: "commit", state, outcome: { kind: "seeded" } };
        },
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      const fake = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "runes",
          action: "upgrade",
          revision: 2,
          value: encodeDiscordHeroRunePage(5),
        }),
        ["2031"],
        "123",
        "upgrade-rune-handler",
      );

      await handleSelect(fake.interaction, provider);

      expect(fake.replies).toHaveLength(0);
      expect(fake.updates).toHaveLength(1);
      expect(payloadRecord(fake.updates[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      expect(JSON.stringify(fake.updates[0])).toContain(
        "Rune of Alchemy upgraded to level 1 for 20,000 gold",
      );
      expect(repository.getPlayer("123")).toMatchObject({
        revision: 3,
        state: {
          gold: 0,
          runes: expect.arrayContaining([{ key: 2031, level: 1 }]),
        },
      });
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("DiscordHero World command handlers", () => {
  test("pages and inspects exact stages without mutating state", async () => {
    const page = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "world",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroStagePage(4),
      }),
    );
    await handleButton(page.interaction, runtimeProvider);
    expect(page.replies).toHaveLength(0);
    expect(payloadRecord(page.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(page.updates[0])).toContain(
      "read-only World page was refreshed",
    );
    expect(JSON.stringify(page.updates[0])).toContain("Page 5/5");

    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "world",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroStagePage(0),
      }),
      ["1101"],
    );
    await handleSelect(selected.interaction, runtimeProvider);
    expect(selected.replies).toHaveLength(0);
    expect(payloadRecord(selected.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(JSON.stringify(selected.updates[0])).toContain(
      "**Pasture** · #1101",
    );
    expect(JSON.stringify(selected.updates[0])).toContain("Boss: 10022");
  });

  test("refreshes stale stage monster detail read-only and rejects a foreign owner before runtime", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-world-monster-stats-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      expect(
        selectDiscordHeroStarter(repository, runtime.indexes, {
          userId: "123",
          interactionId: "create-world-monster-stats-player",
          starterHeroKey: 101,
          nowMs: 1,
        }).revision,
      ).toBe(1);
      repository.transactPlayer({
        scope: "test.world-monster-stats-handler",
        interactionId: "advance-world-monster-stats-revision",
        operation: "advance",
        requestSha256: "7".repeat(64),
        userId: "123",
        expectedRevision: 1,
        decodeOutcome: decodeSeededOutcome,
        nowMs: 2,
        mutate: (current) => {
          if (current === null) throw new Error("expected World player");
          return {
            kind: "commit",
            state: structuredClone(current),
            outcome: { kind: "seeded" },
          };
        },
      });
      const before = JSON.stringify(repository.getPlayer("123"));
      expect(JSON.parse(before).revision).toBe(2);

      let runtimeCalls = 0;
      let transactionCalls = 0;
      const guardedRepository = new Proxy(repository, {
        get(target, property) {
          if (property === "transactPlayer") {
            return () => {
              transactionCalls += 1;
              throw new Error("World stage inspection must never transact");
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const provider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository: guardedRepository,
        } satisfies DiscordHeroRuntime);
      };
      const stale = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "world",
          action: "select",
          revision: 1,
          value: encodeDiscordHeroStagePage(0),
        }),
        ["1208"],
        "123",
        "stale-world-monster-stats",
      );

      await handleSelect(stale.interaction, provider);

      expect(stale.replies).toHaveLength(0);
      expect(stale.updates).toHaveLength(1);
      expect(payloadRecord(stale.updates[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      const staleJson = JSON.stringify(stale.updates[0]);
      expect(staleJson).toContain(
        "State changed; the read-only stage inspection was refreshed.",
      );
      expect(staleJson).toContain("### Source-scaled monster base stats");
      expect(staleJson).toContain(
        "Wave #20101 · Weight raw 1000 · source monster row unresolved; base stats unavailable",
      );
      expect(staleJson.indexOf("Wave #20061 ·")).toBeLessThan(
        staleJson.indexOf("Boss #20061 ·"),
      );
      const customIds = collectCustomIds(JSON.parse(staleJson));
      expect(customIds).not.toHaveLength(0);
      expect(
        customIds.every((customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          return (
            customId.length <= 100 &&
            decoded.ownerId === "123" &&
            decoded.revision === 2
          );
        }),
      ).toBe(true);
      expect(runtimeCalls).toBe(1);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);

      const callsBeforeForeign = runtimeCalls;
      const foreign = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "999",
          view: "world",
          action: "select",
          revision: 2,
          value: encodeDiscordHeroStagePage(0),
        }),
        ["1208"],
        "123",
        "foreign-world-monster-stats",
      );
      await handleSelect(foreign.interaction, provider);

      expect(foreign.updates).toHaveLength(0);
      expect(foreign.replies).toEqual([
        {
          content: "Workspace này thuộc về người chơi khác.",
          flags: MessageFlags.Ephemeral,
        },
      ]);
      expect(runtimeCalls).toBe(callsBeforeForeign);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(before);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects a stage selected from another source page", async () => {
    const pageOneStage = discordHeroStages(runtime.indexes, 1)[0]!.StageKey;
    const forged = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "world",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroStagePage(0),
      }),
      [String(pageOneStage)],
    );
    await handleSelect(forged.interaction, runtimeProvider);

    expect(forged.replies).toHaveLength(0);
    expect(JSON.stringify(forged.updates[0])).toContain(
      "does not name a stage on the bound source page",
    );
  });
});

describe("DiscordHero Community Market command handlers", () => {
  test("keeps page and detail navigation read-only while rejecting all 945 cross-filter forgeries", async () => {
    const snapshot = {
      revision: 13,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let runtimeCalls = 0;
    let transactionCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Community Market inspection must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };

    const staleLastPage = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "market",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroMarketPage(
          communityMarket,
          runtime.indexes,
          "all",
          37,
        ),
      }),
    );
    await handleButton(staleLastPage.interaction, provider);
    const staleJson = JSON.stringify(staleLastPage.updates[0]);
    expect(staleJson).toContain("read-only captured Market page was refreshed");
    expect(staleJson).toContain("All · Page 38/38");
    expect(staleJson).toContain(
      communityMarket.provenance.sourceAggregateSha256,
    );
    expect(staleJson).toContain(communityMarket.provenance.compiledSha256);

    const firstPage = discordHeroMarketPage(
      communityMarket,
      runtime.indexes,
      "all",
      0,
    );
    const firstOption = firstPage.options[0]!;
    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "market",
        action: "select",
        revision: 13,
        value: firstPage.pageTarget,
      }),
      [firstOption.value],
    );
    await handleSelect(selected.interaction, provider);
    const selectedJson = JSON.stringify(selected.updates[0]);
    expect(selectedJson).toContain("**Long Sword** · #303011 · confirmed");
    expect(selectedJson).toContain("2026-07-28T14:55:28Z");
    expect(selectedJson).toContain(
      "Captured snapshot only; live settlement remains oracle-gated.",
    );

    const crossPage = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "market",
        action: "select",
        revision: 13,
        value: firstPage.pageTarget,
      }),
      [
        discordHeroMarketPage(communityMarket, runtime.indexes, "all", 1)
          .options[0]!.value,
      ],
    );
    await handleSelect(crossPage.interaction, provider);
    expect(JSON.stringify(crossPage.updates[0])).toContain(
      "does not name a Market listing on the bound captured page and filter",
    );

    const forgedSlug = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "market",
        action: "select",
        revision: 13,
        value: firstPage.pageTarget,
      }),
      [`${firstOption.value}x`],
    );
    await handleSelect(forgedSlug.interaction, provider);
    expect(JSON.stringify(forgedSlug.updates[0])).toContain(
      "does not name a Market listing on the bound captured page and filter",
    );

    let rejectedTargets = 0;
    for (let pageIndex = 0; pageIndex < 38; pageIndex += 1) {
      const page = discordHeroMarketPage(
        communityMarket,
        runtime.indexes,
        "all",
        pageIndex,
      );
      for (const option of page.options) {
        const forgedTarget = option.value.replace(
          /^t-a-/,
          option.status === "confirmed" ? "t-u-" : "t-c-",
        );
        const forged = selectInteraction(
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "market",
            action: "select",
            revision: 13,
            value: page.pageTarget,
          }),
          [forgedTarget],
          "123",
          `forged-market-${option.rowIndex}`,
        );

        await handleSelect(forged.interaction, provider);

        expect(forged.replies).toHaveLength(0);
        expect(JSON.stringify(forged.updates[0])).toContain(
          "does not name a Market listing on the bound captured page and filter",
        );
        rejectedTargets += 1;
      }
    }

    const callsBeforeForeign = runtimeCalls;
    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "market",
        action: "page",
        revision: 13,
        value: firstPage.pageTarget,
      }),
      "123",
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(callsBeforeForeign);
    expect(rejectedTargets).toBe(945);
    expect(transactionCalls).toBe(0);
  }, 30_000);
});

describe("DiscordHero Collection command handlers", () => {
  test("pages and inspects Pets, Skins, and captured Achievements without transactions", async () => {
    const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
    state.pets.unlocked = [1001];
    state.pets.active = 1001;
    const snapshot = { revision: 13, state };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Collection inspection must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };

    const staleSkinsPage = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "collection",
        action: "page",
        revision: 12,
        value: encodeDiscordHeroCollectionPage("skins", 3),
      }),
    );
    await handleButton(staleSkinsPage.interaction, provider);
    expect(JSON.stringify(staleSkinsPage.updates[0])).toContain(
      "read-only Skins page was refreshed",
    );
    expect(JSON.stringify(staleSkinsPage.updates[0])).toContain(
      "Skins · Page 4/4",
    );

    const activePet = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "collection",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroCollectionPage("pets", 0),
      }),
      ["1001"],
    );
    await handleSelect(activePet.interaction, provider);
    expect(JSON.stringify(activePet.updates[0])).toContain(
      "**Bat** · #1001 · Owned · Active",
    );

    const achievement = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "collection",
        action: "select",
        revision: 13,
        value: encodeDiscordHeroAchievementPage(communityAchievements, 2),
      }),
      [encodeDiscordHeroAchievementTarget(communityAchievements, 53)],
    );
    await handleSelect(achievement.interaction, provider);
    expect(JSON.stringify(achievement.updates[0])).toContain(
      "...Wait, I'm the Only One Left?",
    );
    expect(JSON.stringify(achievement.updates[0])).toContain(
      "2026-07-28T14:15:14Z",
    );

    for (const [pageTarget, selectedTarget] of [
      [encodeDiscordHeroCollectionPage("skins", 0), "25003"],
      [
        encodeDiscordHeroAchievementPage(communityAchievements, 0),
        encodeDiscordHeroAchievementTarget(communityAchievements, 53),
      ],
    ] as const) {
      const forged = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "collection",
          action: "select",
          revision: 13,
          value: pageTarget,
        }),
        [selectedTarget],
      );
      await handleSelect(forged.interaction, provider);
      expect(JSON.stringify(forged.updates[0])).toContain(
        "does not name a Collection entry on the bound source page",
      );
    }

    const staleAchievement = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "collection",
        action: "select",
        revision: 12,
        value: encodeDiscordHeroAchievementPage(communityAchievements, 2),
      }),
      [encodeDiscordHeroAchievementTarget(communityAchievements, 53)],
    );
    await handleSelect(staleAchievement.interaction, provider);
    expect(JSON.stringify(staleAchievement.updates[0])).toContain(
      "read-only Collection inspection was refreshed",
    );

    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "collection",
        action: "page",
        revision: 13,
        value: encodeDiscordHeroCollectionPage("pets", 0),
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(6);
    expect(transactionCalls).toBe(0);
  });
});

describe("DiscordHero Alchemy command handler", () => {
  test("commits exact SQLite Alchemy once, replays read-only, rejects stale or forged input, and rolls back oracle failures", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-alchemy-"),
    );
    const databasePath = join(tempRoot, "players.sqlite");
    const repository = openDiscordHeroRepository({
      databasePath,
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    const seed = (
      userId: string,
      interactionId: string,
      state: ReturnType<typeof createFreshPlayerStateFromCatalog>,
    ) => {
      repository.transactPlayer({
        scope: "test.alchemy-handler",
        interactionId,
        operation: "seed",
        requestSha256: userId.repeat(64).slice(0, 64),
        userId,
        expectedRevision: null,
        decodeOutcome: decodeSeededOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "seeded" },
        }),
      });
    };
    const unlockedState = (
      asset: ReturnType<
        typeof createFreshPlayerStateFromCatalog
      >["containers"]["inventory"]["slots"][number]["asset"],
    ) => {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.cube.unlockedRecipes.push(200001);
      state.cube.unlockedSubRecipes.push(200011);
      state.containers.inventory.slots.push({ index: 0, asset });
      return state;
    };

    try {
      seed(
        "123",
        "seed-alchemy-command-123",
        unlockedState({
          kind: "gear",
          instanceId: "alchemy-command-gear",
          itemKey: 300001,
          rolledStats: [],
        }),
      );
      seed(
        "124",
        "seed-alchemy-command-124",
        unlockedState({
          kind: "gear",
          instanceId: "alchemy-stale-gear",
          itemKey: 300001,
          rolledStats: [],
        }),
      );
      seed(
        "125",
        "seed-alchemy-command-125",
        unlockedState({
          kind: "stack",
          itemKey: 140001,
          quantity: 2,
        }),
      );
      const locked = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      locked.containers.inventory.slots.push({
        index: 0,
        asset: {
          kind: "gear",
          instanceId: "alchemy-locked-gear",
          itemKey: 300001,
          rolledStats: [],
        },
      });
      seed("126", "seed-alchemy-command-126", locked);
      const paginated = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      paginated.cube.unlockedRecipes.push(200001);
      paginated.cube.unlockedSubRecipes.push(200011);
      paginated.containers.inventory.unlockedSlots = 30;
      paginated.containers.inventory.slots.push(
        ...Array.from({ length: 26 }, (_, index) => ({
          index,
          asset: {
            kind: "gear" as const,
            instanceId: `alchemy-page-replay-${index}`,
            itemKey: 300001,
            rolledStats: [],
          },
        })),
      );
      seed("127", "seed-alchemy-command-127", paginated);

      let transactionCalls = 0;
      const observedRepository = {
        getPlayer: repository.getPlayer.bind(repository),
        getPlayerTransactionReceipt:
          repository.getPlayerTransactionReceipt.bind(repository),
        transactPlayer: <T>(
          input: Parameters<typeof repository.transactPlayer<T>>[0],
        ) => {
          transactionCalls += 1;
          return repository.transactPlayer(input);
        },
      } as unknown as DiscordHeroRuntime["repository"];
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository: observedRepository,
        } satisfies DiscordHeroRuntime);
      const customId = (userId: string, revision: number, page = 0) =>
        encodeDiscordHeroCustomId({
          ownerId: userId,
          view: "cube",
          action: "alchemy",
          revision,
          value: encodeDiscordHeroAlchemyPage(page),
        });

      const pageCustomId = (revision: number, page: number) =>
        encodeDiscordHeroCustomId({
          ownerId: "124",
          view: "cube",
          action: "page",
          revision,
          value: encodeDiscordHeroAlchemyPage(page),
        });
      const currentPage = buttonInteraction(pageCustomId(1, 0), "124");
      await handleButton(currentPage.interaction, provider);
      expect(JSON.stringify(currentPage.updates[0])).toContain(
        "Alchemy · Page 1/1",
      );
      const stalePage = buttonInteraction(pageCustomId(2, 0), "124");
      await handleButton(stalePage.interaction, provider);
      expect(JSON.stringify(stalePage.updates[0])).toContain(
        "read-only Alchemy page was refreshed",
      );
      const forgedPage = buttonInteraction(pageCustomId(1, 1), "124");
      await handleButton(forgedPage.interaction, provider);
      expect(JSON.stringify(forgedPage.updates[0])).toContain(
        "does not name a valid Alchemy page",
      );
      expect(transactionCalls).toBe(0);

      const first = selectInteraction(
        customId("123", 1),
        ["0"],
        "123",
        "alchemy-command-once",
      );
      await handleSelect(first.interaction, provider);
      const firstNotice = JSON.stringify(first.updates[0]);
      expect(firstNotice).toContain(
        "Alchemy consumed 1 item for 10 gold and 2 Cube EXP",
      );
      expect(repository.getPlayer("123")).toMatchObject({
        revision: 2,
        state: {
          gold: 110,
          containers: { inventory: { slots: [] } },
          cube: { level: 1, xp: 2 },
        },
      });
      expect(transactionCalls).toBe(1);

      const replay = selectInteraction(
        customId("123", 1),
        ["0"],
        "123",
        "alchemy-command-once",
      );
      await handleSelect(replay.interaction, provider);
      expect(JSON.stringify(replay.updates[0])).toContain(
        "Alchemy consumed 1 item for 10 gold and 2 Cube EXP",
      );
      expect(repository.getPlayer("123")?.revision).toBe(2);
      expect(transactionCalls).toBe(1);

      const rejected = [
        selectInteraction(
          customId("124", 2),
          ["0"],
          "124",
          "alchemy-stale-new-interaction",
        ),
        selectInteraction(
          customId("124", 1),
          ["0", "0"],
          "124",
          "alchemy-duplicate-selection",
        ),
        selectInteraction(
          customId("124", 1, 1),
          ["0"],
          "124",
          "alchemy-cross-page",
        ),
        selectInteraction(customId("126", 1), ["0"], "126", "alchemy-locked"),
      ];
      for (const candidate of rejected) {
        await handleSelect(candidate.interaction, provider);
      }
      expect(JSON.stringify(rejected[0]!.updates[0])).toContain(
        "refreshed without consuming items",
      );
      expect(JSON.stringify(rejected[1]!.updates[0])).toContain(
        "does not name 1–9 unique items on the bound Alchemy page",
      );
      expect(JSON.stringify(rejected[2]!.updates[0])).toContain(
        "does not name 1–9 unique items on the bound Alchemy page",
      );
      expect(JSON.stringify(rejected[3]!.updates[0])).toContain(
        "Alchemy recipe is locked",
      );
      expect(repository.getPlayer("124")?.revision).toBe(1);
      expect(repository.getPlayer("126")?.revision).toBe(1);
      expect(transactionCalls).toBe(1);

      const oracle = selectInteraction(
        customId("125", 1),
        ["0"],
        "125",
        "alchemy-material-oracle",
      );
      await handleSelect(oracle.interaction, provider);
      expect(JSON.stringify(oracle.updates[0])).toContain(
        "Alchemy needs a source oracle for level:null material value",
      );
      expect(repository.getPlayer("125")).toMatchObject({
        revision: 1,
        state: {
          gold: 100,
          containers: {
            inventory: {
              slots: [
                {
                  index: 0,
                  asset: {
                    kind: "stack",
                    itemKey: 140001,
                    quantity: 2,
                  },
                },
              ],
            },
          },
        },
      });
      expect(transactionCalls).toBe(2);

      const disappearingPage = selectInteraction(
        customId("127", 1, 1),
        ["25"],
        "127",
        "alchemy-page-disappears",
      );
      await handleSelect(disappearingPage.interaction, provider);
      const disappearingPageReplay = selectInteraction(
        customId("127", 1, 1),
        ["25"],
        "127",
        "alchemy-page-disappears",
      );
      await handleSelect(disappearingPageReplay.interaction, provider);
      expect(JSON.stringify(disappearingPageReplay.updates[0])).toContain(
        "Alchemy consumed 1 item for 10 gold and 2 Cube EXP",
      );
      expect(repository.getPlayer("127")).toMatchObject({
        revision: 2,
        state: {
          containers: {
            inventory: {
              slots: expect.arrayContaining([
                expect.objectContaining({ index: 24 }),
              ]),
            },
          },
        },
      });
      expect(
        repository.getPlayer("127")?.state.containers.inventory.slots,
      ).toHaveLength(25);
      expect(transactionCalls).toBe(3);

      const forgedReceipt = new Database(databasePath, { strict: true });
      forgedReceipt.run(
        `UPDATE idempotency
         SET outcome_json = ?
         WHERE interaction_id = ?`,
        [
          JSON.stringify({
            outcome: {
              consumedItems: 1,
              cubeExperienceGained: 2,
              cubeLevel: 1,
              cubeXp: 2,
              extra: "forged",
              gold: 110,
              goldGained: 10,
              kind: "alchemized",
            },
            revision: 2,
            status: "committed",
          }),
          "alchemy-page-disappears",
        ],
      );
      forgedReceipt.close();
      const rejectedForgedReceipt = selectInteraction(
        customId("127", 1, 1),
        ["25"],
        "127",
        "alchemy-page-disappears",
      );
      let forgedReceiptError: unknown;
      try {
        await handleSelect(rejectedForgedReceipt.interaction, provider);
      } catch (error) {
        forgedReceiptError = error;
      }
      expect(forgedReceiptError).toBeInstanceOf(DiscordHeroCorruptStateError);
      expect((forgedReceiptError as Error).message).toContain(
        "alchemy-page-disappears",
      );
      expect((forgedReceiptError as Error).message).toContain("alchemy");
      expect(rejectedForgedReceipt.updates).toHaveLength(0);
      expect(transactionCalls).toBe(3);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("DiscordHero shared Container command handlers", () => {
  test("binds Container pages and slots to owner, revision, kind, page, and unlocked identity without transactions", async () => {
    const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
    state.containers.stash = {
      unlockedSlots: 131,
      slots: [
        {
          index: 130,
          asset: {
            kind: "gear",
            instanceId: "handler-stash-gear",
            itemKey: 300001,
            rolledStats: [{ statModKey: 100101, value: 1 }],
          },
        },
      ],
    };
    state.containers.storage = { unlockedSlots: 101, slots: [] };
    state.containers.tradingStash = { unlockedSlots: 10, slots: [] };
    validatePlayerAgainstCatalog(state, runtime.indexes);
    const snapshot = { revision: 13, state };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Container browsing must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };
    const stashLastTarget = encodeDiscordHeroContainerPageTarget(
      runtime.indexes,
      state,
      "stash",
      5,
    );
    const stashLast = projectDiscordHeroContainerPage(
      runtime.indexes,
      state,
      stashLastTarget,
    );

    const stalePage = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "page",
        revision: 12,
        value: stashLastTarget,
      }),
    );
    await handleButton(stalePage.interaction, provider);
    expect(JSON.stringify(stalePage.updates[0])).toContain(
      "read-only Stash page was refreshed",
    );
    expect(JSON.stringify(stalePage.updates[0])).toContain("Stash · Page 6/6");

    const selected = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "select",
        revision: 13,
        value: stashLastTarget,
      }),
      [stashLast.slots.at(-1)!.target],
    );
    await handleSelect(selected.interaction, provider);
    const selectedJson = JSON.stringify(selected.updates[0]);
    expect(selectedJson).toContain("Stash slot #130");
    expect(selectedJson).toContain("handler-stash-gear");
    expect(selectedJson).toContain('\\"statModKey\\":100101');

    const staleSelection = selectInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "select",
        revision: 12,
        value: stashLastTarget,
      }),
      [stashLast.slots.at(-1)!.target],
    );
    await handleSelect(staleSelection.interaction, provider);
    expect(JSON.stringify(staleSelection.updates[0])).toContain(
      "read-only Stash slot inspection was refreshed",
    );

    const storageFirst = projectDiscordHeroContainerPage(
      runtime.indexes,
      state,
      "cp-o-0",
    );
    const stashPrevious = projectDiscordHeroContainerPage(
      runtime.indexes,
      state,
      "cp-s-4",
    );
    for (const target of [
      storageFirst.slots[0]!.target,
      stashPrevious.slots[0]!.target,
      "cs-s-5-3n",
      "cs-s-05-3m",
    ]) {
      const forged = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "select",
          revision: 13,
          value: stashLastTarget,
        }),
        [target],
      );
      await handleSelect(forged.interaction, provider);
      expect(JSON.stringify(forged.updates[0])).toContain(
        "does not name a Container slot on the bound source page and kind",
      );
    }

    const invalidPage = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "page",
        revision: 13,
        value: "cp-s-6",
      }),
    );
    await handleButton(invalidPage.interaction, provider);
    expect(JSON.stringify(invalidPage.updates[0])).toContain(
      "does not name a valid bound Container page",
    );

    const callsBeforeForeign = runtimeCalls;
    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "inventory",
        action: "page",
        revision: 13,
        value: stashLastTarget,
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(callsBeforeForeign);
    expect(transactionCalls).toBe(0);
  });

  test("revalidates every contextual capacity unlock and preserves its originating tab and page", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-container-context-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.gold = 1_000;
      repository.transactPlayer({
        scope: "test.container-handler",
        interactionId: "create-container-context-player",
        operation: "create",
        requestSha256: "d".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      const cases = [
        ["cu-i-c-s-1", 1, "inventory slot 20 unlocked for 50 gold"],
        ["cu-s-c-s-1", 2, "stash slot 41 unlocked for 100 gold"],
        ["cu-o-c-s-1", 3, "storage slot 39 unlocked for 50 gold"],
        [
          "cu-t-c-s-1",
          4,
          "tradingStash is already at source maximum capacity (10)",
        ],
      ] as const;
      for (const [value, revision, expectedNotice] of cases) {
        const interaction = buttonInteraction(
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "unlock",
            revision,
            value,
          }),
          "123",
          `container-context-${revision}`,
        );
        await handleButton(interaction.interaction, provider);
        const json = JSON.stringify(interaction.updates[0]);
        expect(json).toContain(expectedNotice);
        expect(json).toContain("Stash · Page 2/2");
      }
      expect(repository.getPlayer("123")).toMatchObject({
        revision: 4,
        state: {
          gold: 800,
          containers: {
            inventory: { unlockedSlots: 21 },
            stash: { unlockedSlots: 42 },
            storage: { unlockedSlots: 40 },
            tradingStash: { unlockedSlots: 10 },
          },
        },
      });
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }

    const insufficientState = createFreshPlayerStateFromCatalog(
      runtime.indexes,
      101,
    );
    insufficientState.gold = 0;
    const insufficientSnapshot = { revision: 7, state: insufficientState };
    let insufficientTransactions = 0;
    const insufficientProvider = () =>
      Promise.resolve({
        ...runtime,
        repository: {
          getPlayer: () => structuredClone(insufficientSnapshot),
          transactPlayer: <T>(input: {
            mutate: (state: typeof insufficientState) => {
              kind: "reject";
              outcome: T;
            };
          }) => {
            insufficientTransactions += 1;
            const result = input.mutate(structuredClone(insufficientState));
            return {
              status: "rejected" as const,
              revision: 7,
              outcome: result.outcome,
            };
          },
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    const insufficient = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 7,
        value: "cu-o-c-o-1",
      }),
    );
    await handleButton(insufficient.interaction, insufficientProvider);
    expect(JSON.stringify(insufficient.updates[0])).toContain(
      "Need 50 gold to unlock storage; you have 0",
    );
    expect(JSON.stringify(insufficient.updates[0])).toContain(
      "Storage · Page 2/2",
    );
    expect(insufficientTransactions).toBe(1);

    const conflictSnapshot = {
      revision: 9,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    let conflictTransactions = 0;
    const conflictProvider = () =>
      Promise.resolve({
        ...runtime,
        repository: {
          getPlayer: () => structuredClone(conflictSnapshot),
          transactPlayer: () => {
            conflictTransactions += 1;
            throw new DiscordHeroRevisionConflictError("123", 9, 10);
          },
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    const conflict = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 9,
        value: "cu-i-c-s-1",
      }),
    );
    await handleButton(conflict.interaction, conflictProvider);
    expect(JSON.stringify(conflict.updates[0])).toContain(
      "capacity quote was refreshed without spending gold",
    );
    expect(JSON.stringify(conflict.updates[0])).toContain("Stash · Page 2/2");
    expect(conflictTransactions).toBe(1);

    const stale = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "unlock",
        revision: 8,
        value: "cu-i-c-s-1",
      }),
    );
    await handleButton(stale.interaction, conflictProvider);
    expect(JSON.stringify(stale.updates[0])).toContain(
      "source quote was refreshed without spending gold",
    );
    expect(JSON.stringify(stale.updates[0])).toContain("Stash · Page 2/2");
    expect(conflictTransactions).toBe(1);
  });
});

describe("DiscordHero Inventory and Equipment command handlers", () => {
  test("filters, paginates, inspects, equips, and rejects a cross-filter slot through emitted components", async () => {
    const swords = { kind: "gear-type", value: "SWORD" } as const;
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-inventory-filter-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.containers.inventory.unlockedSlots = 60;
      for (let index = 25; index >= 0; index -= 1) {
        state.containers.inventory.slots.push({
          index,
          asset: {
            kind: "gear",
            instanceId: `handler-filtered-sword-${index}`,
            itemKey: 300001,
            rolledStats: [{ statModKey: 100101, value: index + 1 }],
          },
        });
      }
      state.containers.inventory.slots.push({
        index: 59,
        asset: { kind: "stack", itemKey: 140001, quantity: 2 },
      });
      repository.transactPlayer({
        scope: "test.inventory-filter-handler",
        interactionId: "create-inventory-filter-handler-player",
        operation: "create",
        requestSha256: "d".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      const initial = repository.getPlayer("123");

      const openInventory = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "view",
          revision: 1,
        }),
        "123",
        "open-filtered-inventory",
      );
      await handleButton(openInventory.interaction, provider);
      const gearFilterMenu = collectSelectMenus(openInventory.updates[0]).find(
        (menu) => decodeDiscordHeroCustomId(menu.customId).value === "fg",
      );
      if (gearFilterMenu === undefined) {
        throw new Error("Inventory response has no gear-type filter component");
      }
      expect(gearFilterMenu.options).toContainEqual(
        expect.objectContaining({ label: "Gear type SWORD", value: "gSWORD" }),
      );

      const selectFilter = selectInteraction(
        gearFilterMenu.customId,
        ["gSWORD"],
        "123",
        "select-sword-filter",
      );
      await handleSelect(selectFilter.interaction, provider);
      expect(JSON.stringify(selectFilter.updates[0])).toContain(
        "Filter: Gear type SWORD · Matching: 26/27 · Occupied page 1/2",
      );
      expect(repository.getPlayer("123")).toEqual(initial);

      const secondPageId = collectCustomIds(selectFilter.updates[0]).find(
        (customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          return (
            decoded.action === "page" &&
            decoded.value === encodeDiscordHeroInventoryPage(swords, 1)
          );
        },
      );
      if (secondPageId === undefined) {
        throw new Error("filtered Inventory response has no second page");
      }
      const secondPage = buttonInteraction(
        secondPageId,
        "123",
        "page-filtered-inventory",
      );
      await handleButton(secondPage.interaction, provider);
      expect(JSON.stringify(secondPage.updates[0])).toContain(
        "Filter: Gear type SWORD · Matching: 26/27 · Occupied page 2/2",
      );
      expect(repository.getPlayer("123")).toEqual(initial);

      const inventoryMenu = collectSelectMenus(secondPage.updates[0]).find(
        (menu) =>
          decodeDiscordHeroCustomId(menu.customId).value ===
          encodeDiscordHeroInventoryPage(swords, 1),
      );
      if (inventoryMenu === undefined) {
        throw new Error("filtered Inventory page has no item selector");
      }
      expect(inventoryMenu.options).toEqual([
        expect.objectContaining({ label: "Slot 25 · Long Sword", value: "25" }),
      ]);

      const crossFilter = selectInteraction(
        inventoryMenu.customId,
        ["59"],
        "123",
        "cross-filter-inventory-slot",
      );
      await handleSelect(crossFilter.interaction, provider);
      expect(JSON.stringify(crossFilter.updates[0])).toContain(
        "does not name an occupied slot on the bound Inventory page",
      );
      expect(repository.getPlayer("123")).toEqual(initial);

      const inspect = selectInteraction(
        inventoryMenu.customId,
        ["25"],
        "123",
        "inspect-filtered-inventory-slot",
      );
      await handleSelect(inspect.interaction, provider);
      expect(JSON.stringify(inspect.updates[0])).toContain(
        "Instance: handler-filtered-sword-25",
      );
      expect(repository.getPlayer("123")).toEqual(initial);

      const equip = selectInteraction(
        customIdForAction(inspect.updates[0], "equip"),
        ["101"],
        "123",
        "equip-filtered-inventory-slot",
      );
      await handleSelect(equip.interaction, provider);
      expect(JSON.stringify(equip.updates[0])).toContain(
        "Long Sword equipped to Knight",
      );
      const after = repository.getPlayer("123");
      expect(after?.revision).toBe(2);
      expect(
        after?.state.containers.inventory.slots.some(
          (slot) => slot.index === 25,
        ),
      ).toBe(false);
      expect(
        after?.state.heroes.find((hero) => hero.heroKey === 101)?.equipment,
      ).toEqual([
        {
          slot: "SWORD",
          asset: {
            kind: "gear",
            instanceId: "handler-filtered-sword-25",
            itemKey: 300001,
            rolledStats: [{ statModKey: 100101, value: 26 }],
          },
        },
      ]);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("pages exact rolled stats read-only and rejects stale, forged, cross-page, or foreign controls without transactions", async () => {
    const snapshot = {
      revision: 13,
      state: stateWithPaginatedRollFixtures(),
    };
    let transactionCalls = 0;
    let runtimeCalls = 0;
    const readOnlyRuntime = {
      ...runtime,
      repository: {
        getPlayer: () => structuredClone(snapshot),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("rolled-stat pagination must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"],
    } satisfies DiscordHeroRuntime;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve(readOnlyRuntime);
    };
    const rollLine = "#105401 · IncreaseAreaOfEffectDamage · ADDITIVE · 100";

    for (const value of [
      encodeDiscordHeroEquipmentRollPageTarget(1, 301, "BOOTS", 24),
      encodeDiscordHeroInventoryRollPageTarget(
        DISCORD_HERO_INVENTORY_ALL_FILTER,
        0,
        4,
        24,
      ),
    ]) {
      const valid = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "page",
          revision: 13,
          value,
        }),
      );
      await handleButton(valid.interaction, provider);
      const rendered = JSON.stringify(valid.updates[0]);
      expect(rendered).toContain("Rolled stats · Page 25/25");
      expect(rendered.split(rollLine)).toHaveLength(21);
      expect(valid.replies).toHaveLength(0);
    }

    const rejected = [
      {
        revision: 12,
        value: encodeDiscordHeroEquipmentRollPageTarget(1, 301, "BOOTS", 24),
        notice: "read-only rolled-stat page was refreshed",
      },
      {
        revision: 13,
        value: encodeDiscordHeroEquipmentRollPageTarget(0, 301, "BOOTS", 24),
        notice: "does not name rolled stats on the bound selection page",
      },
      {
        revision: 13,
        value: encodeDiscordHeroEquipmentRollPageTarget(1, 301, "SWORD", 24),
        notice: "does not name rolled stats on the bound selection page",
      },
      {
        revision: 13,
        value: encodeDiscordHeroEquipmentRollPageTarget(1, 301, "BOOTS", 25),
        notice: "does not name rolled stats on the bound selection page",
      },
      {
        revision: 13,
        value: encodeDiscordHeroInventoryRollPageTarget(
          DISCORD_HERO_INVENTORY_ALL_FILTER,
          1,
          4,
          24,
        ),
        notice: "does not name rolled stats on the bound selection page",
      },
    ] as const;
    for (const candidate of rejected) {
      const interaction = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "page",
          revision: candidate.revision,
          value: candidate.value,
        }),
      );
      await handleButton(interaction.interaction, provider);
      expect(JSON.stringify(interaction.updates[0])).toContain(
        candidate.notice,
      );
    }

    const foreign = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "999",
        view: "inventory",
        action: "page",
        revision: 13,
        value: encodeDiscordHeroInventoryRollPageTarget(
          DISCORD_HERO_INVENTORY_ALL_FILTER,
          0,
          4,
          24,
        ),
      }),
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toHaveLength(1);
    expect(runtimeCalls).toBe(7);
    expect(transactionCalls).toBe(0);
    expect(readOnlyRuntime.repository.getPlayer("123")?.revision).toBe(13);
  });

  test("browses equipped Item Effects from the real SQLite workspace through page 2 detail without a write", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-item-effects-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      const rolledStats = [...runtime.indexes.tables.stat_mods.groups]
        .sort(([left], [right]) => left - right)
        .map(([statModKey, rows]) => ({
          statModKey,
          value: sourceIntervalCandidates(rows[0]!)[0]!,
        }));
      expect(rolledStats).toHaveLength(62);
      state.heroes[0]!.equipment.push({
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "handler-item-effects-sword",
          itemKey: 300001,
          rolledStats,
        },
      });
      repository.transactPlayer({
        scope: "test.item-effects-handler",
        interactionId: "create-item-effects-handler-player",
        operation: "create",
        requestSha256: "d".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const beforeSerialized = JSON.stringify(repository.getPlayer("123"));
      let runtimeCalls = 0;
      let transactionCalls = 0;
      const trackedRepository = {
        getPlayer: (userId: string) => repository.getPlayer(userId),
        transactPlayer: () => {
          transactionCalls += 1;
          throw new Error("Item Effects browsing must never transact");
        },
      } as unknown as DiscordHeroRuntime["repository"];
      const provider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository: trackedRepository,
        } satisfies DiscordHeroRuntime);
      };
      // Write provider only for the exported slash seam (workspace open may create).
      const slashProvider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);
      };
      const slash = slashInteraction("123", "open-item-effects-workspace");
      await execute(slash.interaction, slashProvider, () => 2);
      expect(slash.deferrals).toHaveLength(1);
      expect(slash.edits).toHaveLength(1);
      expect(payloadRecord(slash.deferrals[0]).flags).toBe(
        MessageFlags.Ephemeral,
      );
      expect(payloadRecord(slash.edits[0]).flags).toBe(
        MessageFlags.IsComponentsV2,
      );
      expect(payloadRecord(slash.edits[0]).files).toBeUndefined();
      expect(payloadRecord(slash.edits[0]).attachments).toBeUndefined();
      expect(countDiscordComponents(slash.edits[0])).toBeLessThanOrEqual(40);
      assertDiscordPayloadBounds(slash.edits[0]);
      const inventoryId = collectCustomIds(slash.edits[0]).find((customId) => {
        const decoded = decodeDiscordHeroCustomId(customId);
        return decoded.view === "inventory" && decoded.action === "view";
      });
      if (inventoryId === undefined) {
        throw new Error("slash workspace has no Inventory navigation");
      }
      const interactions: Array<{
        replies: unknown[];
        updates: unknown[];
        followUps: unknown[];
      }> = [];
      const assertReadOnlyUpdate = (interaction: {
        replies: unknown[];
        updates: unknown[];
        followUps: unknown[];
      }) => {
        interactions.push(interaction);
        expect(interaction.replies).toHaveLength(0);
        expect(interaction.followUps).toHaveLength(0);
        expect(interaction.updates).toHaveLength(1);
        const payload = payloadRecord(interaction.updates[0]);
        expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
        expect(payload.files).toBeUndefined();
        expect(payload.attachments).toBeUndefined();
        expect(countDiscordComponents(payload)).toBeLessThanOrEqual(40);
        assertDiscordPayloadBounds(payload);
      };

      const openInventory = buttonInteraction(
        inventoryId,
        "123",
        "item-effects-open-inventory",
      );
      await handleButton(openInventory.interaction, provider);
      assertReadOnlyUpdate(openInventory);

      const equipmentMenu = collectSelectMenus(openInventory.updates[0]).find(
        (menu) =>
          decodeDiscordHeroCustomId(menu.customId).value ===
          encodeDiscordHeroEquipmentPage(0),
      );
      if (equipmentMenu === undefined) {
        throw new Error("Inventory has no bound equipment selector");
      }
      const equipmentOption = equipmentMenu.options.find(
        (option) =>
          option.value === encodeDiscordHeroEquipmentSelection(101, "SWORD"),
      );
      if (equipmentOption === undefined) {
        throw new Error("equipment selector has no exact equipped sword");
      }
      const inspectEquipment = selectInteraction(
        equipmentMenu.customId,
        [String(equipmentOption.value)],
        "123",
        "item-effects-inspect-equipment",
      );
      await handleSelect(inspectEquipment.interaction, provider);
      assertReadOnlyUpdate(inspectEquipment);

      const sectionMenu = collectSelectMenus(inspectEquipment.updates[0]).find(
        (menu) => {
          const value = decodeDiscordHeroCustomId(menu.customId).value;
          if (value === undefined) return false;
          try {
            decodeDiscordHeroItemEffectsSectionTarget(runtime.indexes, value);
            return true;
          } catch {
            return false;
          }
        },
      );
      if (sectionMenu === undefined) {
        throw new Error("equipped detail has no Item Effects section selector");
      }
      expect(sectionMenu.options.map((option) => option.value)).toEqual([
        "s",
        "b",
        "i",
        "r",
      ]);
      const openRolled = selectInteraction(
        sectionMenu.customId,
        ["r"],
        "123",
        "item-effects-open-rolled",
      );
      await handleSelect(openRolled.interaction, provider);
      assertReadOnlyUpdate(openRolled);

      const pageTwoId = collectCustomIds(openRolled.updates[0]).find(
        (customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          if (decoded.action !== "page" || decoded.value === undefined) {
            return false;
          }
          try {
            const target = decodeDiscordHeroItemEffectsPageTarget(
              runtime.indexes,
              decoded.value,
            );
            return target.sourceVector === "rolled" && target.effectPage === 1;
          } catch {
            return false;
          }
        },
      );
      if (pageTwoId === undefined) {
        throw new Error("rolled Item Effects has no emitted page 2 control");
      }
      const openPageTwo = buttonInteraction(
        pageTwoId,
        "123",
        "item-effects-page-2",
      );
      await handleButton(openPageTwo.interaction, provider);
      assertReadOnlyUpdate(openPageTwo);

      const detailMenu = collectSelectMenus(openPageTwo.updates[0]).find(
        (menu) => {
          const decoded = decodeDiscordHeroCustomId(menu.customId);
          if (decoded.action !== "select" || decoded.value === undefined) {
            return false;
          }
          try {
            const target = decodeDiscordHeroItemEffectsPageTarget(
              runtime.indexes,
              decoded.value,
            );
            return target.sourceVector === "rolled" && target.effectPage === 1;
          } catch {
            return false;
          }
        },
      );
      if (detailMenu === undefined) {
        throw new Error("rolled page 2 has no emitted detail selector");
      }
      expect(detailMenu.options).toHaveLength(25);
      expect(detailMenu.options.map((option) => option.value)).toEqual(
        Array.from({ length: 25 }, (_, index) => String(index + 25)),
      );
      const inspectDetail = selectInteraction(
        detailMenu.customId,
        ["25"],
        "123",
        "item-effects-detail-25",
      );
      await handleSelect(inspectDetail.interaction, provider);
      assertReadOnlyUpdate(inspectDetail);
      expect(
        collectTextDisplayContents(inspectDetail.updates[0]).join("\n"),
      ).toContain("Selected effect #25");

      for (const interaction of interactions) {
        for (const customId of collectCustomIds(interaction.updates[0])) {
          const decoded = decodeDiscordHeroCustomId(customId);
          expect(decoded.ownerId).toBe("123");
          expect(decoded.revision).toBe(1);
        }
      }
      // slash open + 5 browse steps
      expect(runtimeCalls).toBe(6);
      expect(transactionCalls).toBe(0);
      expect(repository.getPlayer("123")?.revision).toBe(1);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(
        beforeSerialized,
      );
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("propagates a requested Collection renderer dependency failure", async () => {
    const snapshot = {
      revision: 5,
      state: createFreshPlayerStateFromCatalog(runtime.indexes, 101),
    };
    const provider = () =>
      Promise.resolve({
        ...runtime,
        communityAchievements: undefined,
        repository: {
          getPlayer: () => snapshot,
        } as unknown as DiscordHeroRuntime["repository"],
      } as unknown as DiscordHeroRuntime);
    const view = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "collection",
        action: "view",
        revision: 5,
      }),
      "123",
      "collection-renderer-dependency-failure",
    );

    await expect(handleButton(view.interaction, provider)).rejects.toThrow(
      "Collection view requires loaded community achievements",
    );
    expect(view.replies).toHaveLength(0);
    expect(view.updates).toHaveLength(0);
    expect(view.followUps).toHaveLength(0);
  });

  test("propagates a catalog lookup failure with an Item Effects-shaped message", async () => {
    const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "handler-catalog-lookup-failure",
        itemKey: 300001,
        rolledStats: [{ statModKey: 100101, value: 1 }],
      },
    });
    const lookupFailure = new Error(
      "heroes[0].equipment.SWORD.asset.rolledStats[0].statModKey references unknown stat_mods key 100101",
    );
    const statModGroups = new Map(
      runtime.indexes.tables.stat_mods.groups,
    ) as DiscordHeroCatalogIndexes["tables"]["stat_mods"]["groups"];
    Object.defineProperty(statModGroups, "get", {
      value: () => {
        throw lookupFailure;
      },
    });
    const indexes = {
      ...runtime.indexes,
      tables: {
        ...runtime.indexes.tables,
        stat_mods: {
          ...runtime.indexes.tables.stat_mods,
          groups: statModGroups,
        },
      },
    } as DiscordHeroCatalogIndexes;
    const snapshot = { revision: 5, state };
    const provider = () =>
      Promise.resolve({
        ...runtime,
        indexes,
        repository: {
          getPlayer: () => snapshot,
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    const view = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "home",
        action: "view",
        revision: 5,
      }),
      "123",
      "catalog-lookup-failure",
    );

    await expect(handleButton(view.interaction, provider)).rejects.toBe(
      lookupFailure,
    );
    expect(view.replies).toHaveLength(0);
    expect(view.updates).toHaveLength(0);
    expect(view.followUps).toHaveLength(0);
  });

  test("acknowledges every enabled control emitted by corrupt Item Effects recovery without a leak or write", async () => {
    const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
    state.heroes[0]!.equipment.push({
      slot: "SWORD",
      asset: {
        kind: "gear",
        instanceId: "handler-unknown-effect-source",
        itemKey: 300001,
        rolledStats: [{ statModKey: 999999, value: 1 }],
      },
    });
    const snapshot = { revision: 5, state };
    const before = JSON.stringify(snapshot);
    let runtimeCalls = 0;
    let transactionCalls = 0;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve({
        ...runtime,
        repository: {
          getPlayer: () => snapshot,
          transactPlayer: () => {
            transactionCalls += 1;
            throw new Error("invalid Item Effects must never transact");
          },
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    };
    const rolledTarget = encodeDiscordHeroItemEffectsPageTarget(
      runtime.indexes,
      0,
      0,
      101,
      "SWORD",
      "rolled",
      0,
    );
    const invalid = buttonInteraction(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "inventory",
        action: "page",
        revision: 5,
        value: rolledTarget,
      }),
      "123",
      "unknown-item-effect-source",
    );

    await handleButton(invalid.interaction, provider);

    expect(invalid.replies).toHaveLength(0);
    expect(invalid.followUps).toHaveLength(0);
    expect(invalid.updates).toHaveLength(1);
    expect(payloadRecord(invalid.updates[0]).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(collectTextDisplayContents(invalid.updates[0]).join("\n")).toContain(
      "does not name Item Effects on the bound equipment page and source page",
    );
    expect(JSON.stringify(invalid.updates[0])).not.toContain(
      "handler-unknown-effect-source",
    );
    expect(countDiscordComponents(invalid.updates[0])).toBeLessThanOrEqual(40);
    assertDiscordPayloadBounds(invalid.updates[0]);

    const recoveryControls = collectEnabledDiscordControls(invalid.updates[0]);
    expect(
      recoveryControls.filter((control) => control.kind === "button"),
    ).toHaveLength(10);
    expect(
      recoveryControls.filter((control) => control.kind === "select"),
    ).toHaveLength(1);
    expect(
      new Set(recoveryControls.map((control) => control.customId)).size,
    ).toBe(recoveryControls.length);
    const replayResults: Array<{
      kind: EnabledDiscordControl["kind"];
      view: string;
      action: string;
      acknowledgements: number;
      replies: number;
      updates: number;
      followUps: number;
      error: string | null;
    }> = [];
    for (const [index, control] of recoveryControls.entries()) {
      const decoded = decodeDiscordHeroCustomId(control.customId);
      expect(decoded.ownerId).toBe("123");
      expect(decoded.revision).toBe(5);
      const replay =
        control.kind === "button"
          ? buttonInteraction(
              control.customId,
              "123",
              `recovery-button-${index}`,
            )
          : selectInteraction(
              control.customId,
              [control.value],
              "123",
              `recovery-select-${index}`,
            );
      let error: string | null = null;
      try {
        if (control.kind === "button") {
          await handleButton(replay.interaction as ButtonInteraction, provider);
        } else {
          await handleSelect(
            replay.interaction as StringSelectMenuInteraction,
            provider,
          );
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      const acknowledgements = replay.replies.length + replay.updates.length;
      replayResults.push({
        kind: control.kind,
        view: decoded.view,
        action: decoded.action,
        acknowledgements,
        replies: replay.replies.length,
        updates: replay.updates.length,
        followUps: replay.followUps.length,
        error,
      });
      expect(
        replay.followUps,
        `${decoded.view}/${decoded.action}`,
      ).toHaveLength(0);
      if (replay.updates.length === 1) {
        const payload = replay.updates[0];
        expect(
          payloadRecord(payload).flags,
          `${decoded.view}/${decoded.action}`,
        ).toBe(MessageFlags.IsComponentsV2);
        expect(
          payloadRecord(payload).allowedMentions,
          `${decoded.view}/${decoded.action}`,
        ).toEqual({ parse: [] });
        expect(
          Object.hasOwn(payloadRecord(payload), "files"),
          `${decoded.view}/${decoded.action}`,
        ).toBe(false);
        expect(
          Object.hasOwn(payloadRecord(payload), "attachments"),
          `${decoded.view}/${decoded.action}`,
        ).toBe(false);
        const serialized = JSON.stringify(payload);
        expect(serialized, `${decoded.view}/${decoded.action}`).not.toContain(
          "handler-unknown-effect-source",
        );
        expect(serialized, `${decoded.view}/${decoded.action}`).not.toContain(
          "999999",
        );
        expect(serialized, `${decoded.view}/${decoded.action}`).not.toContain(
          "Selected effect",
        );
        expect(
          countDiscordComponents(payload),
          `${decoded.view}/${decoded.action}`,
        ).toBeLessThanOrEqual(40);
        assertDiscordPayloadBounds(payload);
        for (const emittedId of collectCustomIds(payload)) {
          const emitted = decodeDiscordHeroCustomId(emittedId);
          expect(emitted.ownerId, `${decoded.view}/${decoded.action}`).toBe(
            "123",
          );
          expect(emitted.revision, `${decoded.view}/${decoded.action}`).toBe(5);
        }
      }
    }
    const resultFor = (view: "home" | "runes") =>
      replayResults.find(
        (result) => result.view === view && result.action === "view",
      );
    expect({
      home: resultFor("home"),
      runes: resultFor("runes"),
    }).toEqual({
      home: {
        kind: "button",
        view: "home",
        action: "view",
        acknowledgements: 1,
        replies: 0,
        updates: 1,
        followUps: 0,
        error: null,
      },
      runes: {
        kind: "button",
        view: "runes",
        action: "view",
        acknowledgements: 1,
        replies: 0,
        updates: 1,
        followUps: 0,
        error: null,
      },
    });
    expect(
      replayResults.filter(
        (result) =>
          result.error !== null ||
          result.acknowledgements !== 1 ||
          result.replies !== 0 ||
          result.updates !== 1 ||
          result.followUps !== 0,
      ),
    ).toEqual([]);

    // Stale Button + SELECT on the same corrupt equipped snapshot must each
    // ack once, close safely, expose neither old instance nor effects, mutate nothing.
    for (const [label, drive] of [
      [
        "stale-button",
        async () => {
          const stale = buttonInteraction(
            encodeDiscordHeroCustomId({
              ownerId: "123",
              view: "inventory",
              action: "page",
              revision: 1,
              value: rolledTarget,
            }),
            "123",
            "stale-corrupt-button",
          );
          await handleButton(stale.interaction, provider);
          return stale;
        },
      ],
      [
        "stale-select",
        async () => {
          const stale = selectInteraction(
            encodeDiscordHeroCustomId({
              ownerId: "123",
              view: "inventory",
              action: "select",
              revision: 1,
              value: rolledTarget,
            }),
            ["0"],
            "123",
            "stale-corrupt-select",
          );
          await handleSelect(stale.interaction, provider);
          return stale;
        },
      ],
    ] as const) {
      const stale = await drive();
      expect(stale.replies, label).toHaveLength(0);
      expect(stale.followUps, label).toHaveLength(0);
      expect(stale.updates, label).toHaveLength(1);
      const payload = JSON.stringify(stale.updates[0]);
      expect(payload, label).toContain(
        "Item Effects were closed before resolving equipped gear",
      );
      expect(payload, label).not.toContain("handler-unknown-effect-source");
      expect(payload, label).not.toContain("Selected effect");
      expect(payload, label).not.toContain("#0 rolled");
      expect(
        countDiscordComponents(stale.updates[0]),
        label,
      ).toBeLessThanOrEqual(40);
      assertDiscordPayloadBounds(stale.updates[0]);
    }

    expect(runtimeCalls).toBe(1 + recoveryControls.length + 2);
    expect(transactionCalls).toBe(0);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  test("rejects cross-relation, off-page, duplicate, stale, malformed, and foreign Item Effects controls read-only", async () => {
    const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
    state.heroes[0]!.equipment.push(
      {
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "handler-relation-sword",
          itemKey: 300001,
          rolledStats: [...runtime.indexes.tables.stat_mods.groups]
            .sort(([left], [right]) => left - right)
            .map(([statModKey, rows]) => ({
              statModKey,
              value: sourceIntervalCandidates(rows[0]!)[0]!,
            })),
        },
      },
      {
        slot: "SHIELD",
        asset: {
          kind: "gear",
          instanceId: "handler-relation-shield",
          itemKey: 400001,
          rolledStats: [],
        },
      },
    );
    validatePlayerAgainstCatalog(state, runtime.indexes);
    let snapshot = { revision: 1, state };
    let runtimeCalls = 0;
    let transactionCalls = 0;
    const provider = () => {
      runtimeCalls += 1;
      return Promise.resolve({
        ...runtime,
        repository: {
          getPlayer: () => snapshot,
          transactPlayer: () => {
            transactionCalls += 1;
            throw new Error("Item Effects controls must never transact");
          },
        } as unknown as DiscordHeroRuntime["repository"],
      } satisfies DiscordHeroRuntime);
    };
    const before = JSON.stringify(snapshot);
    const itemEffectsId = (
      value: string,
      action: "page" | "select" = "page",
      revision = snapshot.revision,
      ownerId = "123",
    ) =>
      encodeDiscordHeroCustomId({
        ownerId,
        view: "inventory",
        action,
        revision,
        value,
      });
    const swordRolled = encodeDiscordHeroItemEffectsPageTarget(
      runtime.indexes,
      0,
      0,
      101,
      "SWORD",
      "rolled",
      0,
    );

    for (const value of [
      encodeDiscordHeroItemEffectsPageTarget(
        runtime.indexes,
        0,
        1,
        101,
        "SWORD",
        "rolled",
        0,
      ),
      encodeDiscordHeroItemEffectsPageTarget(
        runtime.indexes,
        0,
        0,
        201,
        "BOW",
        "rolled",
        0,
      ),
      encodeDiscordHeroItemEffectsPageTarget(
        runtime.indexes,
        0,
        0,
        101,
        "SWORD",
        "rolled",
        3,
      ),
      encodeDiscordHeroItemEffectsPageTarget(
        runtime.indexes,
        1,
        0,
        101,
        "SWORD",
        "rolled",
        0,
      ),
      encodeDiscordHeroItemEffectsPageTarget(
        runtime.indexes,
        0,
        0,
        101,
        "SWORD",
        "inherent",
        1,
      ),
      "ef-00-0-2t-SWORD-r-0",
    ]) {
      const rejected = buttonInteraction(itemEffectsId(value));
      await handleButton(rejected.interaction, provider);
      expect(rejected.replies).toHaveLength(0);
      expect(rejected.followUps).toHaveLength(0);
      expect(rejected.updates).toHaveLength(1);
      expect(
        collectTextDisplayContents(rejected.updates[0]).join("\n"),
      ).toContain(
        "does not name Item Effects on the bound equipment page and source page",
      );
      expect(JSON.stringify(rejected.updates[0])).not.toContain(
        "handler-relation-sword",
      );
      expect(JSON.stringify(rejected.updates[0])).not.toContain(
        "handler-relation-shield",
      );
      expect(countDiscordComponents(rejected.updates[0])).toBeLessThanOrEqual(
        40,
      );
    }

    for (const values of [[], ["0", "1"], ["25"]]) {
      const rejected = selectInteraction(
        itemEffectsId(swordRolled, "select"),
        values,
      );
      await handleSelect(rejected.interaction, provider);
      expect(rejected.replies).toHaveLength(0);
      expect(rejected.followUps).toHaveLength(0);
      expect(rejected.updates).toHaveLength(1);
      expect(
        collectTextDisplayContents(rejected.updates[0]).join("\n"),
      ).toContain(
        "does not name an Item Effect on the bound equipment page and source page",
      );
      expect(JSON.stringify(rejected.updates[0])).not.toContain(
        "Selected effect",
      );
    }

    const mismatchedSection = selectInteraction(
      itemEffectsId(
        encodeDiscordHeroItemEffectsSectionTarget(
          runtime.indexes,
          0,
          1,
          101,
          "SWORD",
        ),
        "select",
      ),
      ["r"],
    );
    await handleSelect(mismatchedSection.interaction, provider);
    expect(
      collectTextDisplayContents(mismatchedSection.updates[0]).join("\n"),
    ).toContain(
      "does not name an Item Effect on the bound equipment page and source page",
    );

    const coherentShield = buttonInteraction(
      itemEffectsId(
        encodeDiscordHeroItemEffectsPageTarget(
          runtime.indexes,
          0,
          1,
          101,
          "SHIELD",
          "base",
          0,
        ),
      ),
    );
    await handleButton(coherentShield.interaction, provider);
    const shieldText = collectTextDisplayContents(
      coherentShield.updates[0],
    ).join("\n");
    expect(shieldText).toContain("Item #400001");
    expect(shieldText).toContain("BlockChance/FLAT");
    expect(shieldText).not.toContain("Item #300001");

    const duplicateState = structuredClone(state);
    duplicateState.heroes[0]!.equipment[0]!.asset.rolledStats.push({
      statModKey: 100101,
      value: 1,
    });
    snapshot = { revision: 1, state: duplicateState };
    const duplicate = buttonInteraction(itemEffectsId(swordRolled));
    await handleButton(duplicate.interaction, provider);
    expect(
      collectTextDisplayContents(duplicate.updates[0]).join("\n"),
    ).toContain(
      "does not name Item Effects on the bound equipment page and source page",
    );
    expect(JSON.stringify(duplicate.updates[0])).not.toContain(
      "#0 rolled · AttackDamage",
    );

    const replacementState = structuredClone(state);
    replacementState.heroes[0]!.equipment[0]!.asset = {
      kind: "gear",
      instanceId: "handler-replacement-sword",
      itemKey: 301011,
      rolledStats: [{ statModKey: 100102, value: 100 }],
    };
    snapshot = { revision: 2, state: replacementState };
    for (const [label, drive] of [
      [
        "stale-button-replacement",
        async () => {
          const stale = buttonInteraction(
            itemEffectsId(swordRolled, "page", 1),
            "123",
            "stale-replacement-button",
          );
          await handleButton(stale.interaction, provider);
          return stale;
        },
      ],
      [
        "stale-select-replacement",
        async () => {
          const stale = selectInteraction(
            itemEffectsId(swordRolled, "select", 1),
            ["0"],
            "123",
            "stale-replacement-select",
          );
          await handleSelect(stale.interaction, provider);
          return stale;
        },
      ],
    ] as const) {
      const stale = await drive();
      expect(stale.replies, label).toHaveLength(0);
      expect(stale.followUps, label).toHaveLength(0);
      expect(stale.updates, label).toHaveLength(1);
      const stalePayload = JSON.stringify(stale.updates[0]);
      expect(stalePayload, label).toContain(
        "Item Effects were closed before resolving equipped gear",
      );
      expect(stalePayload, label).not.toContain("handler-relation-sword");
      expect(stalePayload, label).not.toContain("handler-replacement-sword");
      expect(stalePayload, label).not.toContain("#0 rolled");
      expect(stalePayload, label).not.toContain("Selected effect");
    }

    const removalState = structuredClone(state);
    removalState.heroes[0]!.equipment =
      removalState.heroes[0]!.equipment.filter(
        (equipment) => equipment.slot !== "SWORD",
      );
    snapshot = { revision: 3, state: removalState };
    for (const [label, drive] of [
      [
        "stale-button-removal",
        async () => {
          const stale = buttonInteraction(
            itemEffectsId(swordRolled, "page", 1),
            "123",
            "stale-removal-button",
          );
          await handleButton(stale.interaction, provider);
          return stale;
        },
      ],
      [
        "stale-select-removal",
        async () => {
          const stale = selectInteraction(
            itemEffectsId(swordRolled, "select", 1),
            ["0"],
            "123",
            "stale-removal-select",
          );
          await handleSelect(stale.interaction, provider);
          return stale;
        },
      ],
    ] as const) {
      const stale = await drive();
      const staleRemovalPayload = JSON.stringify(stale.updates[0]);
      expect(stale.updates, label).toHaveLength(1);
      expect(staleRemovalPayload, label).toContain(
        "Item Effects were closed before resolving equipped gear",
      );
      expect(staleRemovalPayload, label).not.toContain(
        "handler-relation-sword",
      );
      expect(staleRemovalPayload, label).not.toContain("#0 rolled");
    }

    const callsBeforeForeign = runtimeCalls;
    const foreign = buttonInteraction(
      itemEffectsId(swordRolled, "page", 3, "999"),
      "123",
    );
    await handleButton(foreign.interaction, provider);
    expect(foreign.updates).toHaveLength(0);
    expect(foreign.replies).toEqual([
      {
        content: "Workspace này thuộc về người chơi khác.",
        flags: MessageFlags.Ephemeral,
      },
    ]);
    expect(runtimeCalls).toBe(callsBeforeForeign);
    expect(transactionCalls).toBe(0);
    expect(JSON.stringify({ revision: 1, state })).toBe(before);
  }, 30_000);

  test("equips and unequips one exact gear instance through real SQLite selections", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-equipment-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const selected = {
        kind: "gear" as const,
        instanceId: "handler-sword",
        itemKey: 300001,
        rolledStats: [
          { statModKey: 100101, value: 1 },
          { statModKey: 100201, value: 45 },
        ],
      };
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.containers.inventory.slots.push({ index: 4, asset: selected });
      repository.transactPlayer({
        scope: "test.inventory-handler",
        interactionId: "create-equipment-handler-player",
        operation: "create",
        requestSha256: "b".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      const provider = () =>
        Promise.resolve({
          ...runtime,
          repository,
        } satisfies DiscordHeroRuntime);

      const inspectInventory = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "select",
          revision: 1,
          value: encodeDiscordHeroInventoryPage(
            DISCORD_HERO_INVENTORY_ALL_FILTER,
            0,
          ),
        }),
        ["4"],
        "123",
        "inspect-inventory-gear",
      );
      await handleSelect(inspectInventory.interaction, provider);
      expect(repository.getPlayer("123")?.revision).toBe(1);
      expect(JSON.stringify(inspectInventory.updates[0])).toContain(
        "Instance: handler-sword",
      );

      const equip = selectInteraction(
        customIdForAction(inspectInventory.updates[0], "equip"),
        ["101"],
        "123",
        "equip-handler-sword",
      );
      await handleSelect(equip.interaction, provider);
      expect(JSON.stringify(equip.updates[0])).toContain(
        "Long Sword equipped to Knight",
      );
      const equippedSnapshot = repository.getPlayer("123");
      expect(equippedSnapshot?.revision).toBe(2);
      expect(equippedSnapshot?.state.containers.inventory.slots).toEqual([]);
      expect(
        equippedSnapshot?.state.heroes.find((hero) => hero.heroKey === 101)
          ?.equipment,
      ).toEqual([{ slot: "SWORD", asset: selected }]);

      const equipmentSelectId = collectCustomIds(equip.updates[0]).find(
        (customId) => {
          const decoded = decodeDiscordHeroCustomId(customId);
          return (
            decoded.view === "inventory" &&
            decoded.action === "select" &&
            decoded.value === encodeDiscordHeroEquipmentPage(0)
          );
        },
      );
      if (equipmentSelectId === undefined) {
        throw new Error("equipped response has no equipment selector");
      }
      const inspectEquipped = selectInteraction(
        equipmentSelectId,
        [encodeDiscordHeroEquipmentSelection(101, "SWORD")],
        "123",
        "inspect-equipped-handler-sword",
      );
      await handleSelect(inspectEquipped.interaction, provider);
      expect(repository.getPlayer("123")?.revision).toBe(2);
      expect(JSON.stringify(inspectEquipped.updates[0])).toContain(
        "Equipped by Knight (#101) · SWORD",
      );

      const unequip = selectInteraction(
        customIdForAction(inspectEquipped.updates[0], "unequip"),
        ["7"],
        "123",
        "unequip-handler-sword",
      );
      await handleSelect(unequip.interaction, provider);
      expect(JSON.stringify(unequip.updates[0])).toContain(
        "Long Sword unequipped from Knight to Inventory slot 7",
      );
      const unequippedSnapshot = repository.getPlayer("123");
      expect(unequippedSnapshot?.revision).toBe(3);
      expect(unequippedSnapshot?.state.containers.inventory.slots).toEqual([
        { index: 7, asset: selected },
      ]);
      expect(
        unequippedSnapshot?.state.heroes.find((hero) => hero.heroKey === 101)
          ?.equipment,
      ).toEqual([]);
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects stale, cross-page, forged and multi-select flows without a write", async () => {
    const tempRoot = mkdtempSync(
      join(tmpdir(), "discordhero-command-equipment-reject-"),
    );
    const repository = openDiscordHeroRepository({
      databasePath: join(tempRoot, "players.sqlite"),
      catalogDigest: runtime.catalog.provenance.compiledSha256,
    });
    try {
      const state = createFreshPlayerStateFromCatalog(runtime.indexes, 101);
      state.containers.inventory.unlockedSlots = 60;
      state.containers.inventory.slots.push(
        ...Array.from({ length: 26 }, (_, index) => ({
          index,
          asset: {
            kind: "gear" as const,
            instanceId: `reject-sword-${index}`,
            itemKey: 300001,
            rolledStats: [{ statModKey: 100101, value: index + 1 }],
          },
        })),
      );
      state.heroes[0]!.equipment.push({
        slot: "SWORD",
        asset: {
          kind: "gear",
          instanceId: "reject-equipped-sword",
          itemKey: 300001,
          rolledStats: [{ statModKey: 100101, value: 2 }],
        },
      });
      repository.transactPlayer({
        scope: "test.inventory-handler",
        interactionId: "create-equipment-reject-player",
        operation: "create",
        requestSha256: "c".repeat(64),
        userId: "123",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 1,
        mutate: () => ({
          kind: "commit",
          state,
          outcome: { kind: "created" },
        }),
      });
      let runtimeCalls = 0;
      let transactionCalls = 0;
      const trackedRepository = {
        getPlayer: (userId: string) => repository.getPlayer(userId),
        transactPlayer: (
          input: Parameters<typeof repository.transactPlayer>[0],
        ) => {
          transactionCalls += 1;
          return repository.transactPlayer(input);
        },
      } as DiscordHeroRuntime["repository"];
      const provider = () => {
        runtimeCalls += 1;
        return Promise.resolve({
          ...runtime,
          repository: trackedRepository,
        } satisfies DiscordHeroRuntime);
      };
      const beforeSerialized = JSON.stringify(repository.getPlayer("123"));
      const inventorySelect = (revision: number) =>
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "select",
          revision,
          value: encodeDiscordHeroInventoryPage(
            DISCORD_HERO_INVENTORY_ALL_FILTER,
            0,
          ),
        });

      const stalePage = buttonInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "inventory",
          action: "page",
          revision: 2,
          value: encodeDiscordHeroInventoryPage(
            DISCORD_HERO_INVENTORY_ALL_FILTER,
            1,
          ),
        }),
      );
      await handleButton(stalePage.interaction, provider);
      expect(JSON.stringify(stalePage.updates[0])).toContain(
        "read-only Inventory page was refreshed",
      );
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(
        beforeSerialized,
      );

      for (const [customId, values, expectedNotice] of [
        [
          inventorySelect(2),
          ["0"],
          "Inventory selection was refreshed without moving gear",
        ],
        [
          inventorySelect(1),
          ["25"],
          "does not name an occupied slot on the bound Inventory page",
        ],
        [
          inventorySelect(1),
          ["0", "1"],
          "does not name an occupied slot on the bound Inventory page",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "equip",
            revision: 1,
            value: encodeDiscordHeroEquipTarget(
              DISCORD_HERO_INVENTORY_ALL_FILTER,
              0,
              0,
            ),
          }),
          ["201"],
          "does not name a compatible owned Hero",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "equip",
            revision: 1,
            value: encodeDiscordHeroEquipTarget(
              DISCORD_HERO_INVENTORY_ALL_FILTER,
              0,
              25,
            ),
          }),
          ["101"],
          "does not name a compatible owned Hero",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "equip",
            revision: 2,
            value: encodeDiscordHeroEquipTarget(
              DISCORD_HERO_INVENTORY_ALL_FILTER,
              0,
              0,
            ),
          }),
          ["101"],
          "Inventory action was refreshed without moving gear",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "select",
            revision: 1,
            value: encodeDiscordHeroEquipmentPage(0),
          }),
          [encodeDiscordHeroEquipmentSelection(201, "SWORD")],
          "does not name equipped gear on the bound page",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "unequip",
            revision: 1,
            value: encodeDiscordHeroUnequipTarget(0, 101, "SWORD", 0),
          }),
          ["51"],
          "does not name a free Inventory slot on the bound page",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "unequip",
            revision: 1,
            value: encodeDiscordHeroUnequipTarget(0, 101, "SWORD", 0),
          }),
          ["26", "27"],
          "does not name a free Inventory slot on the bound page",
        ],
        [
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "unequip",
            revision: 1,
            value: encodeDiscordHeroUnequipTarget(0, 201, "SWORD", 0),
          }),
          ["26"],
          "does not name a free Inventory slot on the bound page",
        ],
      ] as const) {
        const interaction = selectInteraction(
          customId,
          values,
          "123",
          `rejected-${expectedNotice}`,
        );
        await handleSelect(interaction.interaction, provider);
        expect(JSON.stringify(interaction.updates[0])).toContain(
          expectedNotice,
        );
        expect(repository.getPlayer("123")?.revision).toBe(1);
        expect(JSON.stringify(repository.getPlayer("123"))).toBe(
          beforeSerialized,
        );
      }

      for (const [label, customId, values] of [
        ["zero-select", inventorySelect(1), []],
        [
          "malformed-target",
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "select",
            revision: 1,
            value: "i-not-a-target",
          }),
          ["0"],
        ],
        [
          "noncanonical-target",
          encodeDiscordHeroCustomId({
            ownerId: "123",
            view: "inventory",
            action: "select",
            revision: 1,
            value: "i-a-00",
          }),
          ["0"],
        ],
      ] as const) {
        const callsBefore = runtimeCalls;
        const rejected = selectInteraction(
          customId,
          values,
          "123",
          `reject-${label}`,
        );
        await handleSelect(rejected.interaction, provider);
        expect(rejected.replies).toHaveLength(0);
        expect(rejected.updates).toHaveLength(1);
        expect(payloadRecord(rejected.updates[0]).flags).toBe(
          MessageFlags.IsComponentsV2,
        );
        expect(JSON.stringify(rejected.updates[0])).toContain(
          "does not name an occupied slot on the bound Inventory page",
        );
        expect(runtimeCalls).toBe(callsBefore + 1);
        expect(transactionCalls).toBe(0);
        expect(JSON.stringify(repository.getPlayer("123"))).toBe(
          beforeSerialized,
        );
      }

      const callsBeforeForeign = runtimeCalls;
      const foreign = selectInteraction(
        encodeDiscordHeroCustomId({
          ownerId: "999",
          view: "inventory",
          action: "select",
          revision: 1,
          value: encodeDiscordHeroInventoryPage(
            DISCORD_HERO_INVENTORY_ALL_FILTER,
            0,
          ),
        }),
        ["0"],
        "123",
        "reject-foreign-owner",
      );
      await handleSelect(foreign.interaction, provider);
      expect(foreign.updates).toHaveLength(0);
      expect(foreign.replies).toEqual([
        {
          content: "Workspace này thuộc về người chơi khác.",
          flags: MessageFlags.Ephemeral,
        },
      ]);
      expect(runtimeCalls).toBe(callsBeforeForeign);
      expect(transactionCalls).toBe(0);
      expect(JSON.stringify(repository.getPlayer("123"))).toBe(
        beforeSerialized,
      );
    } finally {
      repository.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
