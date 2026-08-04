import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import {
  DiscordHeroIdempotencyConflictError,
  DiscordHeroRevisionConflictError,
  openDiscordHeroRepository,
  type DiscordHeroRepository,
} from "../state/repository";
import {
  allocateDiscordHeroAttributePoint,
  decodeDiscordHeroAllocateAttributePointOutcome,
} from "./allocate-attribute-point";

const temporaryRoot = join(
  process.cwd(),
  ".tmp",
  `discordhero-attribute-allocation-${process.pid}`,
);

let repository: DiscordHeroRepository;
let indexes: ReturnType<typeof buildCatalogIndexes>;
const decodeCreatedOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("created") })
    .strict()
    .parse(value);

beforeEach(async () => {
  rmSync(temporaryRoot, { recursive: true, force: true });
  const catalog = await loadDiscordHeroCatalog();
  indexes = buildCatalogIndexes(catalog);
  repository = openDiscordHeroRepository({
    databasePath: join(temporaryRoot, "players.sqlite"),
    catalogDigest: catalog.provenance.compiledSha256,
  });
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  state.heroes[0]!.skills = [{ key: 10101, level: 1 }];
  state.heroes[0]!.passives = [{ key: 101001, level: 1 }];
  repository.transactPlayer({
    scope: "test.attribute",
    interactionId: "create",
    operation: "create",
    requestSha256: "a".repeat(64),
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
});

afterEach(() => {
  repository.close();
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("allocate DiscordHero Attribute point transaction", () => {
  test("commits exactly one target Attribute point and replays byte-exact", () => {
    const before = repository.getPlayer("123")!;
    const input = {
      userId: "123",
      interactionId: "attribute-1",
      expectedRevision: 1,
      heroKey: 101,
      attributeKey: 101001,
      nowMs: 2,
    };
    const first = allocateDiscordHeroAttributePoint(repository, indexes, input);
    const replay = allocateDiscordHeroAttributePoint(repository, indexes, {
      ...input,
      nowMs: 99,
    });

    expect(replay).toEqual(first);
    expect(first).toEqual({
      status: "committed",
      revision: 2,
      outcome: {
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
    });

    const after = repository.getPlayer("123")!;
    expect(after.state.heroes[0]!.attributes).toEqual([
      { key: 101001, level: 1 },
    ]);
    expect(after.state.heroes[0]!.skills).toEqual([{ key: 10101, level: 1 }]);
    expect(after.state.heroes[0]!.passives).toEqual([
      { key: 101001, level: 1 },
    ]);
    expect({
      ...after.state,
      heroes: after.state.heroes.map((hero) =>
        hero.heroKey === 101 ? { ...hero, attributes: [] } : hero,
      ),
    }).toEqual(before.state);
  });

  test("binds idempotency to both Hero and Attribute and rejects stale revision", () => {
    allocateDiscordHeroAttributePoint(repository, indexes, {
      userId: "123",
      interactionId: "bound",
      expectedRevision: 1,
      heroKey: 101,
      attributeKey: 101001,
      nowMs: 2,
    });

    expect(() =>
      allocateDiscordHeroAttributePoint(repository, indexes, {
        userId: "123",
        interactionId: "bound",
        expectedRevision: 1,
        heroKey: 101,
        attributeKey: 101002,
        nowMs: 3,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(() =>
      allocateDiscordHeroAttributePoint(repository, indexes, {
        userId: "123",
        interactionId: "bound",
        expectedRevision: 1,
        heroKey: 201,
        attributeKey: 201001,
        nowMs: 3,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(() =>
      allocateDiscordHeroAttributePoint(repository, indexes, {
        userId: "123",
        interactionId: "stale",
        expectedRevision: 1,
        heroKey: 101,
        attributeKey: 101002,
        nowMs: 3,
      }),
    ).toThrow(DiscordHeroRevisionConflictError);
    const after = repository.getPlayer("123")!;
    expect(after.revision).toBe(2);
    expect(
      after.state.heroes.find((hero) => hero.heroKey === 101)?.attributes,
    ).toEqual([{ key: 101001, level: 1 }]);
  });

  test("persists insufficient and group-locked outcomes without mutation", () => {
    allocateDiscordHeroAttributePoint(repository, indexes, {
      userId: "123",
      interactionId: "first",
      expectedRevision: 1,
      heroKey: 101,
      attributeKey: 101001,
      nowMs: 2,
    });
    const insufficient = allocateDiscordHeroAttributePoint(
      repository,
      indexes,
      {
        userId: "123",
        interactionId: "insufficient",
        expectedRevision: 2,
        heroKey: 101,
        attributeKey: 101002,
        nowMs: 3,
      },
    );
    expect(insufficient).toMatchObject({
      status: "rejected",
      revision: 2,
      outcome: {
        kind: "insufficient-points",
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
      },
    });

    const state = repository.getPlayer("123")!.state;
    state.heroes[0]!.level = 10;
    repository.transactPlayer({
      scope: "test.attribute",
      interactionId: "level-ten",
      operation: "level-ten",
      requestSha256: "b".repeat(64),
      userId: "123",
      expectedRevision: 2,
      decodeOutcome: (value: unknown) =>
        z
          .object({ kind: z.literal("leveled") })
          .strict()
          .parse(value),
      nowMs: 4,
      mutate: () => ({
        kind: "commit",
        state,
        outcome: { kind: "leveled" },
      }),
    });
    const locked = allocateDiscordHeroAttributePoint(repository, indexes, {
      userId: "123",
      interactionId: "group-locked",
      expectedRevision: 3,
      heroKey: 101,
      attributeKey: 101011,
      nowMs: 5,
    });
    expect(locked).toMatchObject({
      status: "rejected",
      revision: 3,
      outcome: {
        kind: "group-locked",
        spentPoints: 1,
        groupRequiredAllocatedPoint: 10,
      },
    });
    const after = repository.getPlayer("123")!;
    expect(after.revision).toBe(3);
    expect(
      after.state.heroes.find((hero) => hero.heroKey === 101)?.attributes,
    ).toEqual([{ key: 101001, level: 1 }]);
  });

  test("persists and replays exact maximum-level rejection", () => {
    const state = repository.getPlayer("123")!.state;
    state.heroes[0]!.level = 3;
    state.heroes[0]!.attributes = [{ key: 101001, level: 3 }];
    repository.transactPlayer({
      scope: "test.attribute",
      interactionId: "seed-maximum",
      operation: "seed-maximum",
      requestSha256: "c".repeat(64),
      userId: "123",
      expectedRevision: 1,
      decodeOutcome: (value: unknown) =>
        z
          .object({ kind: z.literal("seeded") })
          .strict()
          .parse(value),
      nowMs: 2,
      mutate: () => ({
        kind: "commit",
        state,
        outcome: { kind: "seeded" },
      }),
    });
    const input = {
      userId: "123",
      interactionId: "maximum",
      expectedRevision: 2,
      heroKey: 101,
      attributeKey: 101001,
      nowMs: 3,
    };
    const first = allocateDiscordHeroAttributePoint(repository, indexes, input);
    const replay = allocateDiscordHeroAttributePoint(repository, indexes, {
      ...input,
      nowMs: 99,
    });

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      status: "rejected",
      revision: 2,
      outcome: {
        kind: "maximum-level",
        level: 3,
        maximumLevel: 3,
        spentPoints: 3,
        remainingPoints: 0,
      },
    });
    expect(repository.getPlayer("123")?.revision).toBe(2);
  });

  test("rejects missing players deterministically", () => {
    const result = allocateDiscordHeroAttributePoint(repository, indexes, {
      userId: "999",
      interactionId: "missing",
      expectedRevision: null,
      heroKey: 101,
      attributeKey: 101001,
      nowMs: 1,
    });
    expect(result).toEqual({
      status: "rejected",
      revision: null,
      outcome: { kind: "player-not-found" },
    });
  });

  test("persists and replays unowned Hero rejection before allocation", () => {
    const input = {
      userId: "123",
      interactionId: "unowned",
      expectedRevision: 1,
      heroKey: 401,
      attributeKey: 401001,
      nowMs: 2,
    };
    const first = allocateDiscordHeroAttributePoint(repository, indexes, input);
    const replay = allocateDiscordHeroAttributePoint(repository, indexes, {
      ...input,
      nowMs: 99,
    });

    expect(first).toEqual({
      status: "rejected",
      revision: 1,
      outcome: { kind: "hero-not-owned", heroKey: 401 },
    });
    expect(replay).toEqual(first);
    expect(repository.getPlayer("123")?.revision).toBe(1);
    expect(() =>
      allocateDiscordHeroAttributePoint(repository, indexes, {
        ...input,
        heroKey: 101,
        attributeKey: 101001,
        nowMs: 3,
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(repository.getPlayer("123")?.revision).toBe(1);
  });

  test("strict decoder rejects corrupt receipt outcomes", () => {
    for (const value of [
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
        extra: true,
      },
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        currentLevel: 0,
        nextLevel: 1,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: -1,
        pointBudget: 1,
        remainingPoints: 1,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "maximum-level",
        heroKey: 101,
        attributeKey: 101001,
      },
      { kind: "player-not-found", heroKey: 101 },
      { kind: "hero-not-owned" },
      {
        kind: "allocated",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        level: 1,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 2,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
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
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        currentLevel: 1,
        nextLevel: 3,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "allocated",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        level: 3,
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
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101001,
        groupKey: 10001,
        currentLevel: 2,
        nextLevel: 3,
        maximumLevel: 3,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 1,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 0,
      },
      {
        kind: "group-locked",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        currentLevel: 1,
        maximumLevel: 8,
        requiredPoint: 1,
        spentPoints: 1,
        pointBudget: 10,
        remainingPoints: 9,
        groupRequiredAllocatedPoint: 10,
      },
      {
        kind: "allocated",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        level: 8,
        maximumLevel: 8,
        requiredPoint: 1,
        spentPoints: 11,
        pointBudget: 11,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 10,
      },
      {
        kind: "maximum-level",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        level: 8,
        maximumLevel: 8,
        requiredPoint: 1,
        spentPoints: 11,
        pointBudget: 11,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 10,
      },
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        currentLevel: 8,
        nextLevel: 9,
        maximumLevel: 10,
        requiredPoint: 1,
        spentPoints: 11,
        pointBudget: 11,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: 10,
      },
      {
        kind: "insufficient-points",
        heroKey: 101,
        attributeKey: 101011,
        groupKey: 10002,
        currentLevel: 1,
        nextLevel: 2,
        maximumLevel: 10,
        requiredPoint: 1,
        spentPoints: Number.MAX_SAFE_INTEGER,
        pointBudget: Number.MAX_SAFE_INTEGER,
        remainingPoints: 0,
        groupRequiredAllocatedPoint: Number.MAX_SAFE_INTEGER,
      },
    ]) {
      expect(() =>
        decodeDiscordHeroAllocateAttributePointOutcome(value),
      ).toThrow();
    }
  });

  test("rejects malformed command input before repository access", () => {
    let transactionCalls = 0;
    const countingRepository = {
      transactPlayer: () => {
        transactionCalls += 1;
        throw new Error("invalid input reached repository");
      },
    } as unknown as DiscordHeroRepository;
    for (const input of [
      {
        userId: "not-a-snowflake",
        interactionId: "bad",
        expectedRevision: 1,
        heroKey: 101,
        attributeKey: 101001,
        nowMs: 1,
      },
      {
        userId: "123",
        interactionId: "",
        expectedRevision: 1,
        heroKey: 101,
        attributeKey: 101001,
        nowMs: 1,
      },
      {
        userId: "123",
        interactionId: "bad",
        expectedRevision: 0,
        heroKey: 101,
        attributeKey: 101001,
        nowMs: 1,
      },
      {
        userId: "123",
        interactionId: "bad",
        expectedRevision: 1,
        heroKey: 0,
        attributeKey: 101001,
        nowMs: 1,
      },
      {
        userId: "123",
        interactionId: "bad",
        expectedRevision: 1,
        heroKey: 101,
        attributeKey: 0,
        nowMs: -1,
      },
    ]) {
      expect(() =>
        allocateDiscordHeroAttributePoint(countingRepository, indexes, input),
      ).toThrow();
    }
    expect(transactionCalls).toBe(0);
  });
});
