import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type {
  DiscordHeroRepository,
  PersistedUserDataDeletionResult,
} from "./repository";

const temporaryDirectories: string[] = [];
const UnsignedTestIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const CreatedOutcomeSchema = z.object({ created: z.literal(true) }).strict();
const CreatedWithGoldOutcomeSchema = z
  .object({
    created: z.literal(true),
    grantedGold: UnsignedTestIntegerSchema,
  })
  .strict();
const GoldOutcomeSchema = z
  .object({ gold: UnsignedTestIntegerSchema })
  .strict();
const InsufficientGoldOutcomeSchema = z
  .object({
    code: z.literal("INSUFFICIENT_GOLD"),
    available: UnsignedTestIntegerSchema,
  })
  .strict();
const InvalidStarterOutcomeSchema = z
  .object({ code: z.literal("INVALID_STARTER") })
  .strict();
const RollOutcomeSchema = z.object({ roll: z.number().finite() }).strict();

const decodeCreatedOutcome = (value: unknown) =>
  CreatedOutcomeSchema.parse(value);
const decodeCreatedWithGoldOutcome = (value: unknown) =>
  CreatedWithGoldOutcomeSchema.parse(value);
const decodeGoldOutcome = (value: unknown) => GoldOutcomeSchema.parse(value);
const decodeInsufficientGoldOutcome = (value: unknown) =>
  InsufficientGoldOutcomeSchema.parse(value);
const decodeInvalidStarterOutcome = (value: unknown) =>
  InvalidStarterOutcomeSchema.parse(value);
const decodeRollOutcome = (value: unknown) => RollOutcomeSchema.parse(value);
const rejectAnyOutcome = (value: unknown): never => z.never().parse(value);

interface PersistedUserDataLifecycleRepository extends DiscordHeroRepository {
  listAllPersistedUserDataOwnerIds(): string[];
  deleteAllPersistedUserDataForUser(
    userId: string,
  ): PersistedUserDataDeletionResult;
}

function asPersistedUserDataLifecycleRepository(
  repository: DiscordHeroRepository,
): PersistedUserDataLifecycleRepository {
  return repository as PersistedUserDataLifecycleRepository;
}

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "discordhero-state-"));
  temporaryDirectories.push(directory);
  return join(directory, "discordhero.sqlite");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("DiscordHero repository", () => {
  test("fails closed on invalid runtime user IDs at every public input", async () => {
    const { DiscordHeroRepositoryError, openDiscordHeroRepository } =
      await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);
    const expectedMessage =
      "userId must be a string containing 1-200 characters with no surrounding whitespace or control characters";
    const invalidUserIds: ReadonlyArray<{
      label: string;
      value: unknown;
    }> = [
      { label: "number", value: 123 },
      { label: "null", value: null },
      { label: "empty", value: "" },
      { label: "leading whitespace", value: " user-id" },
      { label: "trailing whitespace", value: "user-id " },
      { label: "tab control", value: "user\tid" },
      { label: "newline control", value: "user\nid" },
      { label: "null control", value: "user\u0000id" },
      { label: "delete control", value: "user\u007fid" },
      { label: "overlong", value: "x".repeat(201) },
    ];
    let mutationCalls = 0;

    for (const [index, invalid] of invalidUserIds.entries()) {
      const userId = invalid.value as string;
      const actions = [
        () => repository.getPlayer(userId),
        () =>
          repository.getPlayerTransactionReceipt({
            scope: "player:create",
            interactionId: `invalid-query-${index}`,
            operation: "create-player",
            requestSha256: "b".repeat(64),
            userId,
            expectedRevision: null,
            decodeOutcome: decodeInvalidStarterOutcome,
          }),
        () =>
          repository.transactPlayer({
            scope: "player:create",
            interactionId: `invalid-transaction-${index}`,
            operation: "create-player",
            requestSha256: "c".repeat(64),
            userId,
            expectedRevision: null,
            decodeOutcome: decodeInvalidStarterOutcome,
            nowMs: 50 + index,
            mutate: () => {
              mutationCalls += 1;
              throw new Error("invalid user ID reached the mutation");
            },
          }),
        () => lifecycle.deleteAllPersistedUserDataForUser(userId),
      ];
      const errors = actions.map((action) => {
        try {
          action();
          return null;
        } catch (error) {
          return error;
        }
      });

      expect(
        errors.map((error) => ({
          label: invalid.label,
          repositoryError: error instanceof DiscordHeroRepositoryError,
          message: error instanceof Error ? error.message : null,
        })),
      ).toEqual(
        Array.from({ length: actions.length }, () => ({
          label: invalid.label,
          repositoryError: true,
          message: expectedMessage,
        })),
      );
    }
    expect(mutationCalls).toBe(0);
    repository.close();
  });

  test("fails closed on invalid persisted user IDs during owner enumeration", async () => {
    const { DiscordHeroCorruptStateError, openDiscordHeroRepository } =
      await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "invalid-persisted-owner",
      operation: "create-player",
      requestSha256: "d".repeat(64),
      userId: "valid-owner-before-injection",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
      nowMs: 75,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    const fixture = new Database(databasePath, { strict: true });
    fixture.run(
      `UPDATE idempotency
       SET user_id = ?
       WHERE interaction_id = 'invalid-persisted-owner'`,
      [" persisted\towner "],
    );
    fixture.close();

    expect(() => lifecycle.listAllPersistedUserDataOwnerIds()).toThrow(
      DiscordHeroCorruptStateError,
    );
    repository.close();
  });

  test("enumerates every persisted user-data owner in sorted deduplicated order, including rejected-only receipts", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);

    expect(typeof lifecycle.listAllPersistedUserDataOwnerIds).toBe("function");

    repository.transactPlayer({
      scope: "player:create",
      interactionId: "owner-zulu-rejected-only",
      operation: "create-player",
      requestSha256: "1".repeat(64),
      userId: "owner-zulu",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
      nowMs: 100,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    for (const [userId, interactionId, nowMs] of [
      ["owner-alpha", "owner-alpha-committed", 200],
      ["owner-middle", "owner-middle-committed", 300],
    ] as const) {
      repository.transactPlayer({
        scope: "player:create",
        interactionId,
        operation: "create-player",
        requestSha256: "2".repeat(64),
        userId,
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs,
        mutate: () => ({
          kind: "commit",
          state: createFreshPlayerState(101),
          outcome: { created: true },
        }),
      });
    }
    repository.transactPlayer({
      scope: "player:spend",
      interactionId: "owner-middle-rejected-with-player",
      operation: "spend-gold",
      requestSha256: "3".repeat(64),
      userId: "owner-middle",
      expectedRevision: 1,
      decodeOutcome: decodeInsufficientGoldOutcome,
      nowMs: 400,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INSUFFICIENT_GOLD", available: 100 },
      }),
    });

    expect(lifecycle.listAllPersistedUserDataOwnerIds()).toEqual([
      "owner-alpha",
      "owner-middle",
      "owner-zulu",
    ]);
    repository.close();
  });

  test("atomically deletes all persisted data for one user and is explicitly idempotent", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroRepositoryError, openDiscordHeroRepository } =
      await import("./repository");
    const databasePath = temporaryDatabasePath();
    const directory = join(databasePath, "..");
    const unrelatedFiles = new Map([
      ["characters.json", '{"legacy":"character"}\n'],
      ["expeditions.json", '{"legacy":"expedition"}\n'],
      ["expedition-results.json", '{"legacy":"result"}\n'],
      ["market.json", '{"legacy":"market"}\n'],
      ["pvp.json", '{"legacy":"pvp"}\n'],
      ["coins.json", '{"other-user":1234}\n'],
      ["attendance.json", '{"other-user":["2026-07-29"]}\n'],
    ]);
    for (const [name, bytes] of unrelatedFiles) {
      writeFileSync(join(directory, name), bytes, "utf8");
    }
    const repository = openDiscordHeroRepository({
      databasePath,
      legacyDirectory: directory,
    });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);
    expect(typeof lifecycle.deleteAllPersistedUserDataForUser).toBe("function");

    const rejectedOnlyQuery = {
      scope: "player:create",
      interactionId: "delete-target-rejected-only",
      operation: "create-player",
      requestSha256: "4".repeat(64),
      userId: "delete-target",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
    };
    repository.transactPlayer({
      ...rejectedOnlyQuery,
      nowMs: 500,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    const committedQuery = {
      scope: "player:create",
      interactionId: "delete-target-committed",
      operation: "create-player",
      requestSha256: "5".repeat(64),
      userId: "delete-target",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
    };
    repository.transactPlayer({
      ...committedQuery,
      nowMs: 600,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });
    const rejectedWithPlayerQuery = {
      scope: "player:spend",
      interactionId: "delete-target-rejected-with-player",
      operation: "spend-gold",
      requestSha256: "6".repeat(64),
      userId: "delete-target",
      expectedRevision: 1,
      decodeOutcome: decodeInsufficientGoldOutcome,
    };
    repository.transactPlayer({
      ...rejectedWithPlayerQuery,
      nowMs: 700,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INSUFFICIENT_GOLD", available: 100 },
      }),
    });
    const otherQuery = {
      scope: "player:create",
      interactionId: "delete-other-committed",
      operation: "create-player",
      requestSha256: "7".repeat(64),
      userId: "delete-other",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
    };
    repository.transactPlayer({
      ...otherQuery,
      nowMs: 800,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });

    expect(() => lifecycle.deleteAllPersistedUserDataForUser("")).toThrow(
      DiscordHeroRepositoryError,
    );
    expect(() =>
      lifecycle.deleteAllPersistedUserDataForUser("x".repeat(201)),
    ).toThrow(DiscordHeroRepositoryError);
    expect(
      lifecycle.deleteAllPersistedUserDataForUser("delete-target"),
    ).toEqual({
      status: "deleted",
      playerDeleted: true,
      idempotencyReceiptsDeleted: 3,
    });
    expect(repository.getPlayer("delete-target")).toBeNull();
    expect(
      repository.getPlayerTransactionReceipt(rejectedOnlyQuery),
    ).toBeNull();
    expect(repository.getPlayerTransactionReceipt(committedQuery)).toBeNull();
    expect(
      repository.getPlayerTransactionReceipt(rejectedWithPlayerQuery),
    ).toBeNull();
    expect(repository.getPlayer("delete-other")).not.toBeNull();
    expect(repository.getPlayerTransactionReceipt(otherQuery)).not.toBeNull();
    expect(lifecycle.listAllPersistedUserDataOwnerIds()).toEqual([
      "delete-other",
    ]);
    expect(
      lifecycle.deleteAllPersistedUserDataForUser("delete-target"),
    ).toEqual({
      status: "already_absent",
      playerDeleted: false,
      idempotencyReceiptsDeleted: 0,
    });
    repository.close();

    for (const [name, bytes] of unrelatedFiles) {
      expect(readFileSync(join(directory, name), "utf8")).toBe(bytes);
    }
  });

  test("rolls back receipt deletion when deleting the player faults", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);
    const rejectedQuery = {
      scope: "player:create",
      interactionId: "rollback-delete-rejected-only",
      operation: "create-player",
      requestSha256: "8".repeat(64),
      userId: "rollback-delete-target",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
    };
    repository.transactPlayer({
      ...rejectedQuery,
      nowMs: 900,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    const committedQuery = {
      scope: "player:create",
      interactionId: "rollback-delete-committed",
      operation: "create-player",
      requestSha256: "9".repeat(64),
      userId: "rollback-delete-target",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
    };
    repository.transactPlayer({
      ...committedQuery,
      nowMs: 1_000,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });
    const faultConnection = new Database(databasePath, { strict: true });
    faultConnection.run(`
      CREATE TRIGGER fail_persisted_user_data_delete
      BEFORE DELETE ON players
      WHEN OLD.user_id = 'rollback-delete-target'
      BEGIN
        SELECT RAISE(ABORT, 'injected persisted user-data deletion failure');
      END
    `);

    expect(() =>
      lifecycle.deleteAllPersistedUserDataForUser("rollback-delete-target"),
    ).toThrow("injected persisted user-data deletion failure");
    expect(repository.getPlayer("rollback-delete-target")).not.toBeNull();
    expect(
      repository.getPlayerTransactionReceipt(rejectedQuery),
    ).not.toBeNull();
    expect(
      repository.getPlayerTransactionReceipt(committedQuery),
    ).not.toBeNull();
    expect(lifecycle.listAllPersistedUserDataOwnerIds()).toEqual([
      "rollback-delete-target",
    ]);

    faultConnection.run("DROP TRIGGER fail_persisted_user_data_delete");
    faultConnection.close();
    repository.close();
  });

  test("preserves schema, WAL, foreign keys, integrity, reopen, and closed behavior", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    const lifecycle = asPersistedUserDataLifecycleRepository(repository);
    const rejectedOnlyQuery = {
      scope: "player:create",
      interactionId: "reopen-rejected-only",
      operation: "create-player",
      requestSha256: "a".repeat(64),
      userId: "reopen-owner",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
    };
    repository.transactPlayer({
      ...rejectedOnlyQuery,
      nowMs: 1_100,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    const before = new Database(databasePath, {
      readonly: true,
      strict: true,
    });
    const migrationsBefore = before
      .query<Record<string, unknown>, []>(
        "SELECT * FROM schema_migrations ORDER BY version",
      )
      .all();
    before.close();
    repository.close();

    expect(() => lifecycle.listAllPersistedUserDataOwnerIds()).toThrow(
      "DiscordHero repository is closed",
    );
    expect(() =>
      lifecycle.deleteAllPersistedUserDataForUser("reopen-owner"),
    ).toThrow("DiscordHero repository is closed");

    const reopened = openDiscordHeroRepository({ databasePath });
    const reopenedLifecycle = asPersistedUserDataLifecycleRepository(reopened);
    expect(reopenedLifecycle.listAllPersistedUserDataOwnerIds()).toEqual([
      "reopen-owner",
    ]);
    expect(
      reopenedLifecycle.deleteAllPersistedUserDataForUser("reopen-owner"),
    ).toEqual({
      status: "deleted",
      playerDeleted: false,
      idempotencyReceiptsDeleted: 1,
    });
    expect(reopened.integrityCheck()).toEqual(["ok"]);
    reopened.close();

    const inspection = new Database(databasePath, { strict: true });
    inspection.run("PRAGMA foreign_keys = ON");
    expect(
      inspection
        .query<{ journal_mode: string }, []>("PRAGMA journal_mode")
        .get()?.journal_mode,
    ).toBe("wal");
    expect(
      inspection
        .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
        .get()?.foreign_keys,
    ).toBe(1);
    expect(
      inspection
        .query<Record<string, unknown>, []>("PRAGMA foreign_key_check")
        .all(),
    ).toEqual([]);
    expect(
      inspection
        .query<Record<string, unknown>, []>(
          "SELECT * FROM schema_migrations ORDER BY version",
        )
        .all(),
    ).toEqual(migrationsBefore);
    inspection.close();

    const finalReopen = openDiscordHeroRepository({ databasePath });
    const finalLifecycle = asPersistedUserDataLifecycleRepository(finalReopen);
    expect(finalLifecycle.listAllPersistedUserDataOwnerIds()).toEqual([]);
    expect(finalReopen.integrityCheck()).toEqual(["ok"]);
    finalReopen.close();
  });

  test("commits a new player and reads the same revision and state after reopen", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });

    const committed = repository.transactPlayer({
      scope: "player:create",
      interactionId: "interaction-create-1",
      operation: "create-player",
      requestSha256: "a".repeat(64),
      userId: "user-1",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 1_000,
      mutate: (current) => {
        expect(current).toBeNull();
        return {
          kind: "commit",
          state: createFreshPlayerState(101),
          outcome: { created: true },
        };
      },
    });

    expect(committed).toEqual({
      status: "committed",
      revision: 1,
      outcome: { created: true },
    });
    expect(repository.getPlayer("user-1")).toEqual({
      revision: 1,
      state: createFreshPlayerState(101),
    });
    repository.close();

    const reopened = openDiscordHeroRepository({ databasePath });
    expect(reopened.getPlayer("user-1")).toEqual({
      revision: 1,
      state: createFreshPlayerState(101),
    });
    expect(reopened.integrityCheck()).toEqual(["ok"]);
    reopened.close();
  });

  test("replays the exact stored outcome without running the mutation again", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroIdempotencyConflictError, openDiscordHeroRepository } =
      await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });
    let mutationCalls = 0;
    const request = {
      scope: "player:create",
      interactionId: "interaction-replay-1",
      operation: "create-player",
      requestSha256: "b".repeat(64),
      userId: "user-replay",
      expectedRevision: null,
      decodeOutcome: decodeCreatedWithGoldOutcome,
      nowMs: 2_000,
      mutate: () => {
        mutationCalls += 1;
        return {
          kind: "commit" as const,
          state: createFreshPlayerState(101),
          outcome: { created: true, grantedGold: 100 },
        };
      },
    };

    expect(repository.transactPlayer(request)).toEqual({
      status: "committed",
      revision: 1,
      outcome: { created: true, grantedGold: 100 },
    });
    expect(
      repository.transactPlayer({
        ...request,
        mutate: () => {
          mutationCalls += 1;
          throw new Error("replay must not execute this mutation");
        },
      }),
    ).toEqual({
      status: "committed",
      revision: 1,
      outcome: { created: true, grantedGold: 100 },
    });
    expect(mutationCalls).toBe(1);
    expect(repository.getPlayer("user-replay")?.revision).toBe(1);

    expect(() =>
      repository.transactPlayer({
        ...request,
        requestSha256: "c".repeat(64),
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(repository.getPlayer("user-replay")?.revision).toBe(1);
    repository.close();
  });

  test("looks up exact receipts read-only and rejects metadata mismatch or corruption", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const {
      DiscordHeroCorruptStateError,
      DiscordHeroIdempotencyConflictError,
      openDiscordHeroRepository,
    } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    const receiptQuery = {
      scope: "player:create",
      interactionId: "interaction-read-receipt",
      operation: "create-player",
      requestSha256: "7".repeat(64),
      userId: "user-read-receipt",
      expectedRevision: null,
      decodeOutcome: decodeCreatedWithGoldOutcome,
    };
    repository.transactPlayer({
      ...receiptQuery,
      nowMs: 2_050,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true, grantedGold: 100 },
      }),
    });

    expect(repository.getPlayerTransactionReceipt(receiptQuery)).toEqual({
      status: "committed",
      revision: 1,
      outcome: { created: true, grantedGold: 100 },
    });
    expect(
      repository.getPlayerTransactionReceipt({
        ...receiptQuery,
        interactionId: "missing-read-receipt",
      }),
    ).toBeNull();
    expect(() =>
      repository.getPlayerTransactionReceipt({
        ...receiptQuery,
        requestSha256: "8".repeat(64),
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);

    const fixture = new Database(databasePath, { strict: true });
    fixture.run("PRAGMA ignore_check_constraints = ON");
    fixture.run(
      `UPDATE idempotency
       SET outcome_json = '{"status":"committed"}'
       WHERE interaction_id = 'interaction-read-receipt'`,
    );
    fixture.close();
    expect(() => repository.getPlayerTransactionReceipt(receiptQuery)).toThrow(
      DiscordHeroCorruptStateError,
    );
    repository.close();
  });

  test("decodes operation outcomes strictly on read-only and transaction replay paths", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroCorruptStateError, openDiscordHeroRepository } =
      await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    const racingRepository = openDiscordHeroRepository({ databasePath });
    const decodeOutcome = (value: unknown) =>
      z
        .object({ created: z.literal(true) })
        .strict()
        .parse(value);
    const receiptQuery = {
      scope: "player:create",
      interactionId: "interaction-strict-outcome",
      operation: "create-player",
      requestSha256: "6".repeat(64),
      userId: "user-strict-outcome",
      expectedRevision: null,
      decodeOutcome,
    };
    repository.transactPlayer({
      ...receiptQuery,
      nowMs: 2_075,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true as const },
      }),
    });

    const fixture = new Database(databasePath, { strict: true });
    fixture.run(
      `UPDATE idempotency
       SET outcome_json = ?
       WHERE interaction_id = ?`,
      [
        JSON.stringify({
          outcome: { created: true, extra: "forged" },
          revision: 1,
          status: "committed",
        }),
        receiptQuery.interactionId,
      ],
    );
    fixture.close();

    for (const read of [
      () => repository.getPlayerTransactionReceipt(receiptQuery),
      () =>
        racingRepository.transactPlayer({
          ...receiptQuery,
          nowMs: 2_076,
          mutate: () => {
            throw new Error("raced replay must not execute its mutation");
          },
        }),
    ]) {
      try {
        read();
        throw new Error("forged outcome must be rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(DiscordHeroCorruptStateError);
        expect((error as Error).message).toContain(
          "interaction-strict-outcome",
        );
        expect((error as Error).message).toContain("create-player");
        expect((error as Error).cause).toBeInstanceOf(z.ZodError);
      }
    }
    expect(repository.getPlayer("user-strict-outcome")?.revision).toBe(1);
    racingRepository.close();
    repository.close();
  });

  test("treats an interaction ID as global and rejects the same ID in another scope", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroIdempotencyConflictError, openDiscordHeroRepository } =
      await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "interaction-global",
      operation: "create-player",
      requestSha256: "9".repeat(64),
      userId: "user-global",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 2_100,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });

    expect(() =>
      repository.transactPlayer({
        scope: "player:other-scope",
        interactionId: "interaction-global",
        operation: "create-player",
        requestSha256: "9".repeat(64),
        userId: "user-global",
        expectedRevision: 1,
        decodeOutcome: decodeGoldOutcome,
        nowMs: 2_200,
        mutate: (current) => {
          if (current === null) throw new Error("missing test player");
          current.gold += 1;
          return {
            kind: "commit",
            state: current,
            outcome: { gold: current.gold },
          };
        },
      }),
    ).toThrow(DiscordHeroIdempotencyConflictError);
    expect(repository.getPlayer("user-global")?.revision).toBe(1);
    repository.close();
  });

  test("rejects a stale expected revision across two repository connections", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroRevisionConflictError, openDiscordHeroRepository } =
      await import("./repository");
    const databasePath = temporaryDatabasePath();
    const first = openDiscordHeroRepository({ databasePath });
    const second = openDiscordHeroRepository({ databasePath });

    first.transactPlayer({
      scope: "player:create",
      interactionId: "interaction-cas-create",
      operation: "create-player",
      requestSha256: "d".repeat(64),
      userId: "user-cas",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 3_000,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });
    expect(first.getPlayer("user-cas")?.revision).toBe(1);
    expect(second.getPlayer("user-cas")?.revision).toBe(1);

    first.transactPlayer({
      scope: "player:gold",
      interactionId: "interaction-cas-first",
      operation: "grant-gold",
      requestSha256: "e".repeat(64),
      userId: "user-cas",
      expectedRevision: 1,
      decodeOutcome: decodeGoldOutcome,
      nowMs: 3_100,
      mutate: (current) => {
        if (current === null) throw new Error("missing test player");
        current.gold += 25;
        return { kind: "commit", state: current, outcome: { gold: 125 } };
      },
    });

    expect(() =>
      second.transactPlayer({
        scope: "player:gold",
        interactionId: "interaction-cas-second",
        operation: "grant-gold",
        requestSha256: "f".repeat(64),
        userId: "user-cas",
        expectedRevision: 1,
        decodeOutcome: decodeGoldOutcome,
        nowMs: 3_200,
        mutate: (current) => {
          if (current === null) throw new Error("missing test player");
          current.gold += 50;
          return { kind: "commit", state: current, outcome: { gold: 150 } };
        },
      }),
    ).toThrow(DiscordHeroRevisionConflictError);
    expect(first.getPlayer("user-cas")).toMatchObject({
      revision: 2,
      state: { gold: 125 },
    });
    first.close();
    second.close();
  });

  test("rolls back the player write when a later statement faults", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });

    repository.transactPlayer({
      scope: "player:create",
      interactionId: "interaction-fault-create",
      operation: "create-player",
      requestSha256: "1".repeat(64),
      userId: "user-fault",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 4_000,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });

    const faultConnection = new Database(databasePath, { strict: true });
    faultConnection.run(`
      CREATE TRIGGER fail_fault_transaction
      BEFORE INSERT ON idempotency
      WHEN NEW.operation = 'fault-after-player-write'
      BEGIN
        SELECT RAISE(ABORT, 'injected fault after player write');
      END
    `);

    expect(() =>
      repository.transactPlayer({
        scope: "player:fault",
        interactionId: "interaction-fault-update",
        operation: "fault-after-player-write",
        requestSha256: "2".repeat(64),
        userId: "user-fault",
        expectedRevision: 1,
        decodeOutcome: decodeGoldOutcome,
        nowMs: 4_100,
        mutate: (current) => {
          if (current === null) throw new Error("missing test player");
          current.gold = 999;
          return { kind: "commit", state: current, outcome: { gold: 999 } };
        },
      }),
    ).toThrow("injected fault after player write");
    expect(repository.getPlayer("user-fault")).toMatchObject({
      revision: 1,
      state: { gold: 100 },
    });
    expect(
      faultConnection
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM idempotency WHERE operation = 'fault-after-player-write'",
        )
        .get()?.count,
    ).toBe(0);

    faultConnection.run("DROP TRIGGER fail_fault_transaction");
    faultConnection.close();
    repository.close();
  });

  test("records legacy filenames without changing legacy RPG bytes", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const directory = join(databasePath, "..");
    const legacy = new Map([
      ["characters.json", '{"legacy":"character"}\n'],
      ["expeditions.json", '{"legacy":"expedition"}\n'],
      ["expedition-results.json", '{"legacy":"result"}\n'],
      ["market.json", '{"legacy":"market"}\n'],
      ["pvp.json", '{"legacy":"pvp"}\n'],
    ]);
    for (const [name, bytes] of legacy) {
      writeFileSync(join(directory, name), bytes, "utf8");
    }

    const repository = openDiscordHeroRepository({
      databasePath,
      legacyDirectory: directory,
    });
    expect(repository.getMeta("origin")).toBe("fresh-v1");
    expect(
      JSON.parse(repository.getMeta("legacy_rpg_files_observed") ?? "[]").map(
        (entry: { name: string }) => entry.name,
      ),
    ).toEqual([
      "characters.json",
      "expeditions.json",
      "expedition-results.json",
      "market.json",
      "pvp.json",
    ]);
    repository.close();

    for (const [name, bytes] of legacy) {
      expect(readFileSync(join(directory, name), "utf8")).toBe(bytes);
    }
  });

  test("fails closed without replacing a corrupt existing database", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const corruptBytes = Buffer.from("this is not a sqlite database");
    writeFileSync(databasePath, corruptBytes);

    expect(() => openDiscordHeroRepository({ databasePath })).toThrow();
    expect(readFileSync(databasePath)).toEqual(corruptBytes);
  });

  test("rejects existing unrelated and partial SQLite databases without changing their bytes", async () => {
    const { openDiscordHeroRepository } = await import("./repository");

    for (const sql of [
      "CREATE TABLE unrelated(value TEXT) STRICT",
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY) STRICT",
    ]) {
      const databasePath = temporaryDatabasePath();
      const database = new Database(databasePath, {
        create: true,
        strict: true,
      });
      database.run(sql);
      database.close();
      const before = readFileSync(databasePath);

      expect(() => openDiscordHeroRepository({ databasePath })).toThrow();
      expect(readFileSync(databasePath)).toEqual(before);
    }
  });

  test("fails closed when a required table is missing despite a valid SQLite file", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    repository.close();

    const damaged = new Database(databasePath, { strict: true });
    damaged.run("DROP TABLE players");
    damaged.close();

    expect(() => openDiscordHeroRepository({ databasePath })).toThrow("schema");
  });

  test("rejects forged DDL and required metadata before opening read-write", async () => {
    const { openDiscordHeroRepository } = await import("./repository");

    const forgedDdlPath = temporaryDatabasePath();
    openDiscordHeroRepository({ databasePath: forgedDdlPath }).close();
    const forgedDdl = new Database(forgedDdlPath, { strict: true });
    forgedDdl.run("PRAGMA foreign_keys = OFF");
    forgedDdl
      .transaction(() => {
        forgedDdl.run("ALTER TABLE players RENAME TO original_players");
        forgedDdl.run(`
        CREATE TABLE players (
          user_id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL
        ) STRICT
      `);
        forgedDdl.run("DROP TABLE original_players");
      })
      .immediate();
    forgedDdl.close();
    const forgedDdlBytes = readFileSync(forgedDdlPath);

    expect(() =>
      openDiscordHeroRepository({ databasePath: forgedDdlPath }),
    ).toThrow();
    expect(readFileSync(forgedDdlPath)).toEqual(forgedDdlBytes);

    const forgedMetaPath = temporaryDatabasePath();
    openDiscordHeroRepository({ databasePath: forgedMetaPath }).close();
    const forgedMeta = new Database(forgedMetaPath, { strict: true });
    forgedMeta.run(
      "UPDATE game_meta SET value = 'forged' WHERE key = 'origin'",
    );
    forgedMeta.close();
    const forgedMetaBytes = readFileSync(forgedMetaPath);

    expect(() =>
      openDiscordHeroRepository({ databasePath: forgedMetaPath }),
    ).toThrow();
    expect(readFileSync(forgedMetaPath)).toEqual(forgedMetaBytes);
  });

  test("requires the configured catalog digest to match on reopen", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    openDiscordHeroRepository({
      databasePath,
      catalogDigest: "a".repeat(64),
    } as never).close();
    const before = readFileSync(databasePath);

    expect(() =>
      openDiscordHeroRepository({
        databasePath,
        catalogDigest: "b".repeat(64),
      } as never),
    ).toThrow("catalog digest");
    expect(readFileSync(databasePath)).toEqual(before);
  });

  test("rejects an asynchronous mutation before any state can commit", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });

    expect(() =>
      repository.transactPlayer({
        scope: "player:create",
        interactionId: "interaction-async",
        operation: "create-player",
        requestSha256: "3".repeat(64),
        userId: "user-async",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 5_000,
        mutate: (() =>
          Promise.resolve({
            kind: "commit",
            state: createFreshPlayerState(101),
            outcome: { created: true },
          })) as never,
      }),
    ).toThrow("must be synchronous");
    expect(repository.getPlayer("user-async")).toBeNull();
    repository.close();
  });

  test("rejects an outcome that cannot be replayed losslessly as JSON", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const repository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });

    expect(() =>
      repository.transactPlayer({
        scope: "player:create",
        interactionId: "interaction-non-json",
        operation: "create-player",
        requestSha256: "4".repeat(64),
        userId: "user-non-json",
        expectedRevision: null,
        decodeOutcome: decodeRollOutcome,
        nowMs: 5_100,
        mutate: () => ({
          kind: "commit",
          state: createFreshPlayerState(101),
          outcome: { roll: Number.NaN },
        }),
      }),
    ).toThrow("transaction outcome must be canonical JSON");
    expect(repository.getPlayer("user-non-json")).toBeNull();
    repository.close();
  });

  test("rejects non-canonical JSON values before committing state or outcomes", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    let accessorCalls = 0;
    const accessorOutcome = {};
    Object.defineProperty(accessorOutcome, "value", {
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return 1;
      },
    });
    const hiddenOutcome = { visible: true };
    Object.defineProperty(hiddenOutcome, "hidden", {
      enumerable: false,
      value: true,
    });
    const arrayWithExtraProperty = [1] as number[] & { extra?: number };
    arrayWithExtraProperty.extra = 2;
    const nullPrototypeOutcome = Object.assign(Object.create(null), {
      value: 1,
    });
    const tooDeep: Record<string, unknown> = {};
    let cursor = tooDeep;
    for (let depth = 0; depth < 70; depth += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const tooManyProperties = Object.fromEntries(
      Array.from({ length: 4_097 }, (_, index) => [`key${index}`, index]),
    );

    for (const outcome of [
      { value: -0 },
      hiddenOutcome,
      accessorOutcome,
      arrayWithExtraProperty,
      nullPrototypeOutcome,
      tooDeep,
      tooManyProperties,
      { text: "x".repeat(70_000) },
    ]) {
      const repository = openDiscordHeroRepository({
        databasePath: temporaryDatabasePath(),
      });
      expect(() =>
        repository.transactPlayer({
          scope: "player:create",
          interactionId: `canonical-${temporaryDirectories.length}`,
          operation: "create-player",
          requestSha256: "5".repeat(64),
          userId: `canonical-${temporaryDirectories.length}`,
          expectedRevision: null,
          decodeOutcome: rejectAnyOutcome,
          nowMs: 5_200,
          mutate: () => ({
            kind: "commit",
            state: createFreshPlayerState(101),
            outcome,
          }),
        }),
      ).toThrow("transaction outcome");
      expect(
        repository.getPlayer(`canonical-${temporaryDirectories.length}`),
      ).toBeNull();
      repository.close();
    }
    expect(accessorCalls).toBe(0);

    const stateRepository = openDiscordHeroRepository({
      databasePath: temporaryDatabasePath(),
    });
    expect(() =>
      stateRepository.transactPlayer({
        scope: "player:create",
        interactionId: "canonical-state-negative-zero",
        operation: "create-player",
        requestSha256: "6".repeat(64),
        userId: "canonical-state",
        expectedRevision: null,
        decodeOutcome: decodeCreatedOutcome,
        nowMs: 5_300,
        mutate: () => {
          const state = createFreshPlayerState(101);
          state.gold = -0;
          return { kind: "commit", state, outcome: { created: true } };
        },
      }),
    ).toThrow("player state");
    expect(stateRepository.getPlayer("canonical-state")).toBeNull();
    stateRepository.close();
  });

  test("records and replays an explicit deterministic rejection without incrementing revision", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "rejection-create",
      operation: "create-player",
      requestSha256: "7".repeat(64),
      userId: "rejection-user",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 5_400,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });

    let mutationCalls = 0;
    const request = {
      scope: "player:spend",
      interactionId: "rejection-once",
      operation: "spend-gold",
      requestSha256: "8".repeat(64),
      userId: "rejection-user",
      expectedRevision: 1,
      decodeOutcome: decodeInsufficientGoldOutcome,
      nowMs: 5_500,
      mutate: () => {
        mutationCalls += 1;
        return {
          kind: "reject" as const,
          outcome: { code: "INSUFFICIENT_GOLD", available: 100 },
        };
      },
    };

    expect(repository.transactPlayer(request as never)).toEqual({
      status: "rejected",
      revision: 1,
      outcome: { available: 100, code: "INSUFFICIENT_GOLD" },
    });
    expect(repository.transactPlayer(request as never)).toEqual({
      status: "rejected",
      revision: 1,
      outcome: { available: 100, code: "INSUFFICIENT_GOLD" },
    });
    expect(mutationCalls).toBe(1);
    expect(repository.getPlayer("rejection-user")?.revision).toBe(1);

    const database = new Database(databasePath, {
      readonly: true,
      strict: true,
    });
    expect(
      database
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM idempotency WHERE interaction_id = 'rejection-once'",
        )
        .get()?.count,
    ).toBe(1);
    database.close();
    repository.close();
  });

  test("records and exactly replays a rejection before the player exists", async () => {
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    let mutationCalls = 0;
    const request = {
      scope: "player:create",
      interactionId: "pre-player-rejection",
      operation: "create-player",
      requestSha256: "0".repeat(64),
      userId: "missing-player",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
      nowMs: 5_600,
      mutate: () => {
        mutationCalls += 1;
        return {
          kind: "reject" as const,
          outcome: { code: "INVALID_STARTER" as const },
        };
      },
    };

    const first = repository.transactPlayer(request);
    const replay = repository.transactPlayer({
      ...request,
      mutate: () => {
        mutationCalls += 1;
        throw new Error("replay must not run the mutation");
      },
    });

    expect(first).toEqual({
      status: "rejected",
      revision: null,
      outcome: { code: "INVALID_STARTER" },
    });
    expect(replay).toEqual(first);
    expect(mutationCalls).toBe(1);
    expect(repository.getPlayer("missing-player")).toBeNull();

    const database = new Database(databasePath, {
      readonly: true,
      strict: true,
    });
    expect(
      database
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM idempotency WHERE interaction_id = 'pre-player-rejection'",
        )
        .get()?.count,
    ).toBe(1);
    database.close();
    repository.close();
  });

  test("reopens a near-maximum revision, commits maximum safely, then rejects overflow", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "safe-revision-create",
      operation: "create-player",
      requestSha256: "a".repeat(64),
      userId: "safe-revision-user",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 6_000,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });
    repository.close();

    const fixture = new Database(databasePath, { strict: true });
    fixture.run(
      "UPDATE players SET revision = 9007199254740990 WHERE user_id = 'safe-revision-user'",
    );
    fixture.close();

    const reopened = openDiscordHeroRepository({ databasePath });
    const committed = reopened.transactPlayer({
      scope: "player:gold",
      interactionId: "safe-revision-maximum",
      operation: "grant-gold",
      requestSha256: "b".repeat(64),
      userId: "safe-revision-user",
      expectedRevision: Number.MAX_SAFE_INTEGER - 1,
      decodeOutcome: decodeGoldOutcome,
      nowMs: 6_100,
      mutate: (current) => {
        if (current === null) throw new Error("missing test player");
        current.gold += 1;
        return {
          kind: "commit",
          state: current,
          outcome: { gold: current.gold },
        };
      },
    });
    expect(committed).toMatchObject({
      status: "committed",
      revision: Number.MAX_SAFE_INTEGER,
      outcome: { gold: 101 },
    });

    expect(() =>
      reopened.transactPlayer({
        scope: "player:gold",
        interactionId: "safe-revision-overflow",
        operation: "grant-gold",
        requestSha256: "c".repeat(64),
        userId: "safe-revision-user",
        expectedRevision: Number.MAX_SAFE_INTEGER,
        decodeOutcome: decodeGoldOutcome,
        nowMs: 6_200,
        mutate: (current) => {
          if (current === null) throw new Error("missing test player");
          current.gold += 1;
          return {
            kind: "commit",
            state: current,
            outcome: { gold: current.gold },
          };
        },
      }),
    ).toThrow("maximum safe revision");
    expect(reopened.getPlayer("safe-revision-user")).toMatchObject({
      revision: Number.MAX_SAFE_INTEGER,
      state: { gold: 101 },
    });

    const inspection = new Database(databasePath, {
      readonly: true,
      strict: true,
    });
    expect(
      inspection
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM idempotency WHERE interaction_id = 'safe-revision-overflow'",
        )
        .get()?.count,
    ).toBe(0);
    inspection.close();
    reopened.close();
  });

  test("fails closed on unsafe persisted integer rows during get and reopen", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroCorruptStateError, openDiscordHeroRepository } =
      await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "unsafe-row-create",
      operation: "create-player",
      requestSha256: "d".repeat(64),
      userId: "unsafe-row-user",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 6_300,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });

    const fixture = new Database(databasePath, { strict: true });
    fixture.run("PRAGMA ignore_check_constraints = ON");
    fixture.run(
      "UPDATE players SET revision = 9007199254740992 WHERE user_id = 'unsafe-row-user'",
    );
    fixture.close();

    expect(() => repository.getPlayer("unsafe-row-user")).toThrow(
      DiscordHeroCorruptStateError,
    );
    repository.close();

    let reopened = null;
    let reopenError: unknown;
    try {
      reopened = openDiscordHeroRepository({ databasePath });
    } catch (error) {
      reopenError = error;
    } finally {
      reopened?.close();
    }
    expect(reopenError).toBeInstanceOf(DiscordHeroCorruptStateError);
  });

  test("enforces receipt outcome semantics in SQLite constraints", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { openDiscordHeroRepository } = await import("./repository");
    const databasePath = temporaryDatabasePath();
    const repository = openDiscordHeroRepository({ databasePath });

    repository.transactPlayer({
      scope: "player:create",
      interactionId: "sql-forged-committed-null",
      operation: "create-player",
      requestSha256: "e".repeat(64),
      userId: "sql-missing-player",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
      nowMs: 6_400,
      mutate: () => ({
        kind: "reject",
        outcome: { code: "INVALID_STARTER" },
      }),
    });
    repository.transactPlayer({
      scope: "player:create",
      interactionId: "sql-forged-rejected-create",
      operation: "create-player",
      requestSha256: "f".repeat(64),
      userId: "sql-created-player",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 6_500,
      mutate: () => ({
        kind: "commit",
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    });
    repository.close();

    const database = new Database(databasePath, { strict: true });
    const forgedRows = [
      {
        interactionId: "sql-forged-committed-null",
        outcome:
          '{"outcome":{"code":"INVALID_STARTER"},"revision":null,"status":"committed"}',
      },
      {
        interactionId: "sql-forged-rejected-create",
        outcome:
          '{"outcome":{"created":true},"revision":1,"status":"rejected"}',
      },
    ];
    const updateErrors = forgedRows.map(({ interactionId, outcome }) => {
      try {
        database.run(
          "UPDATE idempotency SET outcome_json = ? WHERE interaction_id = ?",
          [outcome, interactionId],
        );
        return null;
      } catch (error) {
        return error;
      }
    });
    database.close();

    expect(updateErrors.map((error) => error instanceof Error)).toEqual([
      true,
      true,
    ]);
  });

  test("rejects forged receipt outcome semantics during replay and reopen", async () => {
    const { createFreshPlayerState } = await import("../domain/player");
    const { DiscordHeroCorruptStateError, openDiscordHeroRepository } =
      await import("./repository");
    const observedErrors: unknown[] = [];

    const committedNullPath = temporaryDatabasePath();
    const committedNullRepository = openDiscordHeroRepository({
      databasePath: committedNullPath,
    });
    const committedNullRequest = {
      scope: "player:create",
      interactionId: "app-forged-committed-null",
      operation: "create-player",
      requestSha256: "1".repeat(64),
      userId: "app-missing-player",
      expectedRevision: null,
      decodeOutcome: decodeInvalidStarterOutcome,
      nowMs: 6_600,
      mutate: () => ({
        kind: "reject" as const,
        outcome: { code: "INVALID_STARTER" },
      }),
    };
    committedNullRepository.transactPlayer(committedNullRequest);
    const committedNullFixture = new Database(committedNullPath, {
      strict: true,
    });
    committedNullFixture.run("PRAGMA ignore_check_constraints = ON");
    committedNullFixture.run(
      `UPDATE idempotency
       SET outcome_json =
         '{"outcome":{"code":"INVALID_STARTER"},"revision":null,"status":"committed"}'
       WHERE interaction_id = 'app-forged-committed-null'`,
    );
    committedNullFixture.close();
    try {
      committedNullRepository.transactPlayer({
        ...committedNullRequest,
        mutate: () => {
          throw new Error("corrupt replay must not run the mutation");
        },
      });
      observedErrors.push(null);
    } catch (error) {
      observedErrors.push(error);
    }
    committedNullRepository.close();
    let reopenedCommittedNull = null;
    try {
      reopenedCommittedNull = openDiscordHeroRepository({
        databasePath: committedNullPath,
      });
      observedErrors.push(null);
    } catch (error) {
      observedErrors.push(error);
    } finally {
      reopenedCommittedNull?.close();
    }

    const rejectedCreatePath = temporaryDatabasePath();
    const rejectedCreateRepository = openDiscordHeroRepository({
      databasePath: rejectedCreatePath,
    });
    const rejectedCreateRequest = {
      scope: "player:create",
      interactionId: "app-forged-rejected-create",
      operation: "create-player",
      requestSha256: "2".repeat(64),
      userId: "app-created-player",
      expectedRevision: null,
      decodeOutcome: decodeCreatedOutcome,
      nowMs: 6_700,
      mutate: () => ({
        kind: "commit" as const,
        state: createFreshPlayerState(101),
        outcome: { created: true },
      }),
    };
    rejectedCreateRepository.transactPlayer(rejectedCreateRequest);
    const rejectedCreateFixture = new Database(rejectedCreatePath, {
      strict: true,
    });
    rejectedCreateFixture.run("PRAGMA ignore_check_constraints = ON");
    rejectedCreateFixture.run(
      `UPDATE idempotency
       SET outcome_json =
         '{"outcome":{"created":true},"revision":1,"status":"rejected"}'
       WHERE interaction_id = 'app-forged-rejected-create'`,
    );
    rejectedCreateFixture.close();
    try {
      rejectedCreateRepository.transactPlayer({
        ...rejectedCreateRequest,
        mutate: () => {
          throw new Error("corrupt replay must not run the mutation");
        },
      });
      observedErrors.push(null);
    } catch (error) {
      observedErrors.push(error);
    }
    rejectedCreateRepository.close();
    let reopenedRejectedCreate = null;
    try {
      reopenedRejectedCreate = openDiscordHeroRepository({
        databasePath: rejectedCreatePath,
      });
      observedErrors.push(null);
    } catch (error) {
      observedErrors.push(error);
    } finally {
      reopenedRejectedCreate?.close();
    }

    expect(
      observedErrors.map(
        (error) => error instanceof DiscordHeroCorruptStateError,
      ),
    ).toEqual([true, true, true, true]);
  });
});

describe("DiscordHero player state", () => {
  test("creates the source-backed fresh player with Gold 100 and heroes 101/201/301", async () => {
    const { createFreshPlayerState, PlayerStateSchema } =
      await import("../domain/player");
    const state = createFreshPlayerState(101);

    expect(state.gold).toBe(100);
    expect(state.party).toEqual([101, null, null]);
    expect(state.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);
    expect(PlayerStateSchema.safeParse(state).success).toBe(true);
  });

  test("rejects source collections that exceed their catalog maxima", async () => {
    const { createFreshPlayerState, PlayerStateSchema } =
      await import("../domain/player");
    const hero = (heroKey: number) => ({
      heroKey,
      level: 1,
      xp: 0,
      attributes: [],
      skills: [],
      passives: [],
      equipment: [],
      skins: [],
    });
    const stage = (stageKey: number) => ({
      stageKey,
      clearCount: 0,
      firstClearClaimed: false,
      bestClearMs: null,
    });

    const cases = [
      { heroes: Array.from({ length: 7 }, (_, index) => hero(index + 1)) },
      {
        containers: {
          ...createFreshPlayerState(101).containers,
          inventory: { unlockedSlots: 261, slots: [] },
        },
      },
      {
        containers: {
          ...createFreshPlayerState(101).containers,
          stash: { unlockedSlots: 132, slots: [] },
        },
      },
      {
        containers: {
          ...createFreshPlayerState(101).containers,
          storage: { unlockedSlots: 102, slots: [] },
        },
      },
      {
        containers: {
          ...createFreshPlayerState(101).containers,
          tradingStash: { unlockedSlots: 11, slots: [] },
        },
      },
      {
        runes: Array.from({ length: 198 }, (_, index) => ({
          key: index + 1,
          level: 0,
        })),
      },
      {
        pets: {
          unlocked: Array.from({ length: 9 }, (_, index) => index + 1),
          active: null,
        },
      },
      {
        skins: {
          unlocked: Array.from({ length: 101 }, (_, index) => index + 1),
        },
      },
      {
        campaign: {
          highestStageKey: null,
          stages: Array.from({ length: 121 }, (_, index) => stage(index + 1)),
        },
      },
    ];

    for (const patch of cases) {
      expect(
        PlayerStateSchema.safeParse({
          ...createFreshPlayerState(101),
          ...patch,
        }).success,
      ).toBe(false);
    }
  });

  test("rejects a stage session that references an unowned hero", async () => {
    const { createFreshPlayerState, PlayerStateSchema } =
      await import("../domain/player");
    const state = createFreshPlayerState(101);
    state.stageSession = {
      sessionId: "session-1",
      stageKey: 1,
      party: [401, null, null],
      startedAtMs: 1_000,
      advancedThroughMs: 1_000,
      wave: 0,
      rngSeed: "seed-1",
      rngCursor: 0,
      pendingRewards: { gold: 0, xp: 0, items: [] },
    };

    expect(PlayerStateSchema.safeParse(state).success).toBe(false);
  });

  test("enforces three nullable, unique, owned party slots", async () => {
    const { createFreshPlayerState, PlayerStateSchema } =
      await import("../domain/player");
    const hero = (heroKey: number) => ({
      heroKey,
      level: 1,
      xp: 0,
      attributes: [],
      skills: [],
      passives: [],
      equipment: [],
      skins: [],
    });
    const state = createFreshPlayerState(101);
    state.heroes = [hero(101), hero(201), hero(301)];
    state.party = [101, 201, null];
    expect(PlayerStateSchema.safeParse(state).success).toBe(true);

    expect(
      PlayerStateSchema.safeParse({ ...state, party: [101, 101, null] })
        .success,
    ).toBe(false);
    expect(
      PlayerStateSchema.safeParse({ ...state, party: [101, 201] }).success,
    ).toBe(false);
    expect(
      PlayerStateSchema.safeParse({ ...state, party: [101, 201, 401] }).success,
    ).toBe(false);
    expect(
      PlayerStateSchema.safeParse({ ...state, party: ["101", 201, null] })
        .success,
    ).toBe(false);
  });

  test("rejects the same gear instance in two ownership locations", async () => {
    const { createFreshPlayerState, PlayerStateSchema } =
      await import("../domain/player");
    const state = createFreshPlayerState(101);
    const asset = {
      kind: "gear" as const,
      instanceId: "gear-1",
      itemKey: 300001,
      rolledStats: [],
    };
    state.heroes = [
      {
        heroKey: 101,
        level: 1,
        xp: 0,
        attributes: [],
        skills: [],
        passives: [],
        equipment: [{ slot: "weapon", asset }],
        skins: [],
      },
    ];
    state.party = [101, null, null];
    state.containers.inventory = {
      unlockedSlots: 1,
      slots: [{ index: 0, asset }],
    };

    expect(PlayerStateSchema.safeParse(state).success).toBe(false);
  });
});
