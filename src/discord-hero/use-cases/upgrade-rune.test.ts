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
import { upgradeDiscordHeroRune } from "./upgrade-rune";

const tempRoot = join(
  process.cwd(),
  ".tmp",
  `discordhero-rune-test-${process.pid}`,
);

let repository: DiscordHeroRepository;
let indexes: ReturnType<typeof buildCatalogIndexes>;
const decodeCreatedOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("created") })
    .strict()
    .parse(value);
const decodeSeededRunesOutcome = (value: unknown) =>
  z
    .object({ kind: z.literal("seeded-runes") })
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
  repository.transactPlayer({
    scope: "test",
    interactionId: "create",
    operation: "create",
    requestSha256: "a".repeat(64),
    userId: "123",
    expectedRevision: null,
    decodeOutcome: decodeCreatedOutcome,
    nowMs: 1,
    mutate: (current) => {
      expect(current).toBeNull();
      return {
        kind: "commit",
        state: createFreshPlayerStateFromCatalog(indexes),
        outcome: { kind: "created" },
      };
    },
  });
});

afterEach(() => {
  repository.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

function seedRunes(
  interactionId: string,
  gold: number,
  runes: readonly Readonly<{ key: number; level: number }>[],
): void {
  repository.transactPlayer({
    scope: "test",
    interactionId,
    operation: "seed-runes",
    requestSha256: "c".repeat(64),
    userId: "123",
    expectedRevision: 1,
    decodeOutcome: decodeSeededRunesOutcome,
    nowMs: 2,
    mutate: (current) => {
      if (current === null) throw new Error("expected seeded player");
      const state = structuredClone(current);
      state.gold = gold;
      state.runes = runes.map((rune) => ({ ...rune }));
      return {
        kind: "commit",
        state,
        outcome: { kind: "seeded-runes" },
      };
    },
  });
}

describe("upgrade DiscordHero rune transaction", () => {
  test("commits exact source cost once and replays the same interaction", () => {
    seedRunes("seed-supported", 20_000, [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    ]);
    const first = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "rune-1",
      expectedRevision: 2,
      runeKey: 2031,
      nowMs: 3,
    });
    const replay = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "rune-1",
      expectedRevision: 2,
      runeKey: 2031,
      nowMs: 99,
    });

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      status: "committed",
      revision: 3,
      outcome: {
        kind: "upgraded",
        runeKey: 2031,
        level: 1,
        cost: 20_000,
        gold: 0,
      },
    });
    expect(repository.getPlayer("123")?.state.runes.at(-1)).toEqual({
      key: 2031,
      level: 1,
    });
  });

  test("rejects affordable formation Rune effects with a replayable explicit outcome and no state revision", () => {
    seedRunes("seed-command", 1_000, [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
    ]);
    const before = repository.getPlayer("123");
    const first = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "unsupported-command",
      expectedRevision: 2,
      runeKey: 21,
      nowMs: 3,
    });
    const replay = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "unsupported-command",
      expectedRevision: 2,
      runeKey: 21,
      nowMs: 99,
    });

    expect(first).toEqual(replay);
    expect(first).toEqual({
      status: "rejected",
      revision: 2,
      outcome: {
        kind: "unsupported-effect",
        runeKey: 21,
        name: "Rune of Command",
        currentLevel: 0,
        nextLevel: 1,
        cost: 1_000,
        statType: "UnlockArrangeSlotCount",
        value: 1,
      },
    });
    expect(repository.getPlayer("123")).toEqual(before);
  });

  test("rejects affordable Skill-slot Rune effects without debit or state revision", () => {
    seedRunes("seed-awakening", 50_000, [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 21, level: 1 },
      { key: 25, level: 1 },
      { key: 26, level: 1 },
    ]);
    const before = repository.getPlayer("123");
    const result = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "unsupported-awakening",
      expectedRevision: 2,
      runeKey: 27,
      nowMs: 3,
    });

    expect(result).toEqual({
      status: "rejected",
      revision: 2,
      outcome: {
        kind: "unsupported-effect",
        runeKey: 27,
        name: "Rune of Awakening",
        currentLevel: 0,
        nextLevel: 1,
        cost: 50_000,
        statType: "UnlockSkillSlotCount",
        value: 1,
      },
    });
    expect(repository.getPlayer("123")).toEqual(before);
  });

  test("persists prerequisite rejection without changing revision", () => {
    const locked = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "locked",
      expectedRevision: 1,
      runeKey: 10,
      nowMs: 2,
    });
    expect(locked).toMatchObject({
      status: "rejected",
      revision: 1,
      outcome: {
        kind: "prerequisite-locked",
        requiredLevel: 1,
        predecessorKeys: [1],
      },
    });

    expect(repository.getPlayer("123")?.revision).toBe(1);
  });

  test("rejects insufficient source currency without changing revision", () => {
    seedRunes("make-poor", 19_999, [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    ]);

    const poor = upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "poor",
      expectedRevision: 2,
      runeKey: 2031,
      nowMs: 3,
    });
    expect(poor).toMatchObject({
      status: "rejected",
      revision: 2,
      outcome: {
        kind: "insufficient-gold",
        cost: 20_000,
        availableGold: 19_999,
      },
    });
    expect(repository.getPlayer("123")?.revision).toBe(2);
  });

  test("binds request identity, revision and rune key", () => {
    seedRunes("seed-bound", 20_000, [
      { key: 1, level: 1 },
      { key: 10, level: 1 },
      { key: 201, level: 1 },
      { key: 202, level: 1 },
      { key: 203, level: 1 },
    ]);
    upgradeDiscordHeroRune(repository, indexes, {
      userId: "123",
      interactionId: "bound",
      expectedRevision: 2,
      runeKey: 2031,
      nowMs: 3,
    });
    expect(() =>
      upgradeDiscordHeroRune(repository, indexes, {
        userId: "123",
        interactionId: "bound",
        expectedRevision: 2,
        runeKey: 2032,
        nowMs: 4,
      }),
    ).toThrow("reused with different request metadata");
    expect(() =>
      upgradeDiscordHeroRune(repository, indexes, {
        userId: "123",
        interactionId: "stale",
        expectedRevision: 2,
        runeKey: 2032,
        nowMs: 4,
      }),
    ).toThrow("revision");
  });
});
