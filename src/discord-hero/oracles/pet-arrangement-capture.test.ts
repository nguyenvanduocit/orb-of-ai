import { describe, expect, test } from "bun:test";
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto";
import {
  decodeTaskbarHeroEs3,
  evaluatePetArrangementCapture,
  redactPetArrangementCaptureError,
} from "./pet-arrangement-capture";

const FIXTURE_PASSWORD = "REDACTED_TASKBARHERO_ES3_PASSWORD";
const FIXTURE_SALT_AND_IV = Uint8Array.from([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
]);

function encryptEs3(
  plaintext: string,
  password = FIXTURE_PASSWORD,
): Uint8Array {
  const key = pbkdf2Sync(password, FIXTURE_SALT_AND_IV, 100, 16, "sha1");
  const cipher = createCipheriv("aes-128-cbc", key, FIXTURE_SALT_AND_IV);
  return Uint8Array.from([
    ...FIXTURE_SALT_AND_IV,
    ...cipher.update(plaintext, "utf8"),
    ...cipher.final(),
  ]);
}

interface WrappedSaveOptions {
  readonly playerWrapperSiblings?: readonly (readonly [
    key: string,
    value: unknown,
  ])[];
  readonly unknownOuter?: readonly (readonly [key: string, value: unknown])[];
}

function defineOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function wrappedSave(
  playerValue: string,
  options: WrappedSaveOptions = {},
): Uint8Array {
  const playerWrapper = Object.create(null) as object;
  defineOwn(playerWrapper, "value", playerValue);
  for (const [key, value] of options.playerWrapperSiblings ?? []) {
    defineOwn(playerWrapper, key, value);
  }
  const outer = Object.create(null) as object;
  defineOwn(outer, "PlayerSaveData", playerWrapper);
  defineOwn(outer, "AccountSaveData", {
    value: JSON.stringify({ AccountId: "fixture-account" }),
  });
  defineOwn(outer, "SystemInfo", {
    value: JSON.stringify({ Version: "fixture-build" }),
  });
  defineOwn(outer, "IgnoredOuterSecret", "must never be returned");
  for (const [key, value] of options.unknownOuter ?? []) {
    defineOwn(outer, key, value);
  }
  return encryptEs3(JSON.stringify(outer));
}

function playerValue(
  arrangedPetKey: number | null,
  options: {
    readonly fromUnlocked?: boolean;
    readonly toUnlocked?: boolean;
    readonly gold?: number;
  } = {},
): string {
  return JSON.stringify({
    commonSaveData: {
      ArrangedPetKey: arrangedPetKey,
      Gold: options.gold ?? 100,
    },
    PetSaveData: [
      { PetKey: 1001, IsUnlock: options.fromUnlocked ?? true },
      { PetKey: 1002, IsUnlock: options.toUnlocked ?? true },
    ],
    Stable: { Nested: ["same", 7] },
  });
}

function playerValueWithOwnProperty(
  arrangedPetKey: number,
  key: string,
  value: unknown,
): string {
  const player = JSON.parse(playerValue(arrangedPetKey)) as object;
  Object.defineProperty(player, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return JSON.stringify(player);
}

function captureInput(
  beforePlayer = playerValue(1001),
  afterPlayer = playerValue(1002),
) {
  return {
    beforeEncrypted: wrappedSave(beforePlayer),
    afterEncrypted: wrappedSave(afterPlayer),
    fromPetKey: 1001,
    toPetKey: 1002,
    capturedAt: "2026-07-29T02:45:03Z",
  } as const;
}

function captureEncryptedInput(
  beforeEncrypted: Uint8Array,
  afterEncrypted: Uint8Array,
) {
  return {
    beforeEncrypted,
    afterEncrypted,
    fromPetKey: 1001,
    toPetKey: 1002,
    capturedAt: "2026-07-29T02:45:03Z",
  } as const;
}

async function captureDiagnostic(
  input: ReturnType<typeof captureInput>,
): Promise<{
  readonly failure: unknown;
  readonly diagnostic: ReturnType<typeof redactPetArrangementCaptureError>;
}> {
  try {
    await evaluatePetArrangementCapture(input);
    throw new Error("expected capture to fail");
  } catch (failure) {
    return {
      failure,
      diagnostic: redactPetArrangementCaptureError(failure),
    };
  }
}

describe("TaskbarHero ES3 decoder", () => {
  test("decodes the pinned ES3 protocol and returns only normalized save roots", async () => {
    const decoded = await decodeTaskbarHeroEs3(
      wrappedSave(
        '{"commonSaveData":{"ArrangedPetKey":1001},"PetSaveData":[]}',
      ),
    );

    expect(decoded).toEqual({
      PlayerSaveData: {
        commonSaveData: { ArrangedPetKey: 1001 },
        PetSaveData: [],
      },
      AccountSaveData: { AccountId: "fixture-account" },
      SystemInfo: { Version: "fixture-build" },
    });
    expect("IgnoredOuterSecret" in decoded).toBe(false);
    expect("_raw" in decoded).toBe(false);
  });

  test("preserves unquoted 16-plus-digit integers inside wrapped JSON", async () => {
    const decoded = await decodeTaskbarHeroEs3(
      wrappedSave(
        '{"commonSaveData":{"ArrangedPetKey":1001},"PetSaveData":[],"UniqueId":123456789012345678}',
      ),
    );

    expect(decoded.PlayerSaveData).toMatchObject({
      UniqueId: "123456789012345678",
    });
  });

  test("classifies wrong-password, truncated, and invalid-JSON inputs without leaking data", async () => {
    await expect(
      decodeTaskbarHeroEs3(wrappedSave(playerValue(1001)), "wrong-password"),
    ).rejects.toMatchObject({ code: "decryption_failed" });
    await expect(
      decodeTaskbarHeroEs3(Uint8Array.from([1, 2, 3])),
    ).rejects.toMatchObject({ code: "file_too_small" });
    await expect(
      decodeTaskbarHeroEs3(encryptEs3("definitely not JSON")),
    ).rejects.toMatchObject({ code: "invalid_json" });
  });
});

describe("TaskbarHero Pet arrangement oracle capture", () => {
  test("passes only the exact unlocked arranged-Pet leaf transition", async () => {
    const input = captureInput();
    const report = await evaluatePetArrangementCapture(input);

    expect(report).toEqual({
      format: "taskbarhero-runtime-oracle/pet-arrangement-capture/v1",
      status: "PASS",
      capturedAt: "2026-07-29T02:45:03Z",
      encryptedInputs: {
        beforeBytes: input.beforeEncrypted.byteLength,
        beforeSha256: createHash("sha256")
          .update(input.beforeEncrypted)
          .digest("hex"),
        afterBytes: input.afterEncrypted.byteLength,
        afterSha256: createHash("sha256")
          .update(input.afterEncrypted)
          .digest("hex"),
      },
      transition: {
        fromPetKey: 1001,
        toPetKey: 1002,
        changedPaths: ["PlayerSaveData.commonSaveData.ArrangedPetKey"],
      },
      whitelistedState: {
        before: {
          arrangedPetKey: 1001,
          pets: [
            { petKey: 1001, isUnlock: true },
            { petKey: 1002, isUnlock: true },
          ],
        },
        after: {
          arrangedPetKey: 1002,
          pets: [
            { petKey: 1001, isUnlock: true },
            { petKey: 1002, isUnlock: true },
          ],
        },
      },
    });
  });

  test("does not mutate encrypted inputs and returns deterministic reports", async () => {
    const input = captureInput();
    const beforeCopy = Uint8Array.from(input.beforeEncrypted);
    const afterCopy = Uint8Array.from(input.afterEncrypted);

    const first = await evaluatePetArrangementCapture(input);
    const second = await evaluatePetArrangementCapture(input);

    expect(first).toEqual(second);
    expect(input.beforeEncrypted).toEqual(beforeCopy);
    expect(input.afterEncrypted).toEqual(afterCopy);
  });

  test("rejects wrong, locked, null, and identical Pet arrangements", async () => {
    const cases = [
      {
        input: captureInput(playerValue(1002), playerValue(1001)),
        code: "unexpected_before_pet",
      },
      {
        input: captureInput(
          playerValue(1001, { toUnlocked: false }),
          playerValue(1002, { toUnlocked: false }),
        ),
        code: "pet_not_unlocked",
      },
      {
        input: captureInput(playerValue(null), playerValue(1002)),
        code: "invalid_arranged_pet",
      },
      {
        input: captureInput(playerValue(1001), playerValue(1001)),
        code: "unexpected_after_pet",
      },
    ] as const;

    for (const fixture of cases) {
      await expect(
        evaluatePetArrangementCapture(fixture.input),
      ).rejects.toMatchObject({ code: fixture.code });
    }
    await expect(
      evaluatePetArrangementCapture({
        ...captureInput(),
        toPetKey: 1001,
      }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  test("falsifies the oracle when any timestamp, currency, or other leaf also changes", async () => {
    const input = captureInput(
      playerValue(1001, { gold: 100 }),
      playerValue(1002, { gold: 101 }),
    );
    const { diagnostic } = await captureDiagnostic(input);

    expect(diagnostic).toEqual({
      format: "taskbarhero-runtime-oracle/pet-arrangement-capture/v1",
      status: "FAIL",
      error: {
        code: "extra_state_delta",
        message: "Capture changed state outside the arranged Pet field.",
        evidence: {
          capturedAt: "2026-07-29T02:45:03Z",
          encryptedInputs: {
            beforeBytes: input.beforeEncrypted.byteLength,
            beforeSha256: createHash("sha256")
              .update(input.beforeEncrypted)
              .digest("hex"),
            afterBytes: input.afterEncrypted.byteLength,
            afterSha256: createHash("sha256")
              .update(input.afterEncrypted)
              .digest("hex"),
          },
          transition: { fromPetKey: 1001, toPetKey: 1002 },
          changedPaths: {
            totalCount: 2,
            allowedArrangedPetPathChanged: true,
            unexpectedCount: 1,
            unexpectedPathSha256: [
              "646fa1c5002a3e6ec7e764b9114c19153ed8ffd408a667eb84c80a21af1604c5",
            ],
          },
        },
      },
    });
  });

  test("detects own __proto__ additions and removals even when the object is empty", async () => {
    for (const input of [
      captureInput(
        playerValue(1001),
        playerValueWithOwnProperty(1002, "__proto__", {}),
      ),
      captureInput(
        playerValueWithOwnProperty(1001, "__proto__", {}),
        playerValue(1002),
      ),
    ]) {
      const { diagnostic } = await captureDiagnostic(input);
      expect(diagnostic).toMatchObject({
        status: "FAIL",
        error: {
          code: "extra_state_delta",
          evidence: {
            changedPaths: {
              totalCount: 2,
              allowedArrangedPetPathChanged: true,
              unexpectedCount: 1,
              unexpectedPathSha256: [
                "8de60350c94c015471b499c2203d3ba9476c7163be50e72ada4c5b2595f7d33a",
              ],
            },
          },
        },
      });
    }
  });

  test("hashes dynamic changed keys without exposing the canary through errors or FAIL JSON", async () => {
    const canary = "private_dynamic_key_canary_7f4c91";
    const secretValue = "raw-save-value-must-stay-private";
    const input = captureInput(
      playerValue(1001),
      playerValueWithOwnProperty(1002, canary, secretValue),
    );
    const { failure, diagnostic } = await captureDiagnostic(input);
    const publicErrorJson = JSON.stringify(failure);
    const diagnosticJson = JSON.stringify(diagnostic);

    expect(diagnostic).toMatchObject({
      error: {
        code: "extra_state_delta",
        evidence: {
          changedPaths: {
            unexpectedPathSha256: [
              "5edfcaa953dca105fa75fe873e4389531e3f48221ffb5be938193be980ce9579",
            ],
          },
        },
      },
    });
    for (const output of [publicErrorJson, diagnosticJson]) {
      expect(output).not.toContain(canary);
      expect(output).not.toContain(secretValue);
      expect(output).not.toContain("PlayerSaveData.private_dynamic");
    }
  });

  test("falsifies arbitrary unknown outer-root value changes", async () => {
    const input = captureEncryptedInput(
      wrappedSave(playerValue(1001), {
        unknownOuter: [["UnknownRoot", { Counter: 1 }]],
      }),
      wrappedSave(playerValue(1002), {
        unknownOuter: [["UnknownRoot", { Counter: 2 }]],
      }),
    );
    const { diagnostic } = await captureDiagnostic(input);

    expect(diagnostic).toMatchObject({
      error: {
        code: "extra_state_delta",
        evidence: {
          changedPaths: {
            totalCount: 2,
            allowedArrangedPetPathChanged: true,
            unexpectedCount: 1,
            unexpectedPathSha256: [
              "431e0c31bc4f9c8d85f170c45c4a109f975531b98bba2000caee29ea87552874",
            ],
          },
        },
      },
    });
  });

  test("falsifies known wrapper sibling metadata changes without diffing raw value strings", async () => {
    const input = captureEncryptedInput(
      wrappedSave(playerValue(1001), {
        playerWrapperSiblings: [["type", "player-save-v1"]],
      }),
      wrappedSave(playerValue(1002), {
        playerWrapperSiblings: [["type", "player-save-v2"]],
      }),
    );
    const { diagnostic } = await captureDiagnostic(input);

    expect(diagnostic).toMatchObject({
      error: {
        code: "extra_state_delta",
        evidence: {
          changedPaths: {
            totalCount: 2,
            allowedArrangedPetPathChanged: true,
            unexpectedCount: 1,
            unexpectedPathSha256: [
              "8dfec758604e80b836de859790736874f8c95cbc25c86e4310690f5bf16a1632",
            ],
          },
        },
      },
    });
  });

  test("detects own outer __proto__ additions and removals", async () => {
    for (const input of [
      captureEncryptedInput(
        wrappedSave(playerValue(1001)),
        wrappedSave(playerValue(1002), {
          unknownOuter: [["__proto__", {}]],
        }),
      ),
      captureEncryptedInput(
        wrappedSave(playerValue(1001), {
          unknownOuter: [["__proto__", {}]],
        }),
        wrappedSave(playerValue(1002)),
      ),
    ]) {
      const { diagnostic } = await captureDiagnostic(input);
      expect(diagnostic).toMatchObject({
        error: {
          code: "extra_state_delta",
          evidence: {
            changedPaths: {
              totalCount: 2,
              unexpectedCount: 1,
              unexpectedPathSha256: [
                "1eaa379da178112b9c5295afd32d60a5c9a060932e1c1bf6c29f2af0d2ad1deb",
              ],
            },
          },
        },
      });
    }
  });

  test("permits exact Pet-only change when outer roots and wrapper metadata are unchanged", async () => {
    const options = {
      playerWrapperSiblings: [["type", "player-save-v1"]],
      unknownOuter: [["UnknownRoot", { Stable: true }]],
    } as const;
    const report = await evaluatePetArrangementCapture(
      captureEncryptedInput(
        wrappedSave(playerValue(1001), options),
        wrappedSave(playerValue(1002), options),
      ),
    );

    expect(report.status).toBe("PASS");
    expect(report.transition.changedPaths).toEqual([
      "PlayerSaveData.commonSaveData.ArrangedPetKey",
    ]);
  });

  test("hashes outer dynamic canary changes without exposing its key, value, or raw path", async () => {
    const canary = "private_outer_canary_2a8d71";
    const secretValue = "outer-raw-save-value-must-stay-private";
    const input = captureEncryptedInput(
      wrappedSave(playerValue(1001)),
      wrappedSave(playerValue(1002), {
        unknownOuter: [[canary, secretValue]],
      }),
    );
    const { failure, diagnostic } = await captureDiagnostic(input);

    expect(diagnostic).toMatchObject({
      error: {
        code: "extra_state_delta",
        evidence: {
          changedPaths: {
            unexpectedPathSha256: [
              "c62f79b142693eb662933c59781666001059a1f094176bc3e683bf61fe642b8f",
            ],
          },
        },
      },
    });
    for (const output of [
      JSON.stringify(failure),
      JSON.stringify(diagnostic),
    ]) {
      expect(output).not.toContain(canary);
      expect(output).not.toContain(secretValue);
      expect(output).not.toContain("OuterSaveData.private_outer");
    }
  });

  test("binds known post-input rejections to canonical capture and encrypted evidence", async () => {
    const input = captureInput(playerValue(1002), playerValue(1002));
    const { diagnostic } = await captureDiagnostic(input);

    expect(diagnostic).toEqual({
      format: "taskbarhero-runtime-oracle/pet-arrangement-capture/v1",
      status: "FAIL",
      error: {
        code: "unexpected_before_pet",
        message: "Before-save arranged Pet does not match --from.",
        evidence: {
          capturedAt: "2026-07-29T02:45:03Z",
          encryptedInputs: {
            beforeBytes: input.beforeEncrypted.byteLength,
            beforeSha256: createHash("sha256")
              .update(input.beforeEncrypted)
              .digest("hex"),
            afterBytes: input.afterEncrypted.byteLength,
            afterSha256: createHash("sha256")
              .update(input.afterEncrypted)
              .digest("hex"),
          },
          transition: { fromPetKey: 1001, toPetKey: 1002 },
        },
      },
    });
  });

  test("rejects normalized or noncanonical UTC and retains canonical precision", async () => {
    for (const capturedAt of [
      "2026-02-29T00:00:00Z",
      "2026-07-29T02:45:03.0Z",
    ]) {
      await expect(
        evaluatePetArrangementCapture({
          ...captureInput(),
          capturedAt,
        }),
      ).rejects.toMatchObject({ code: "invalid_capture_time" });
    }

    const zeroMilliseconds = await evaluatePetArrangementCapture({
      ...captureInput(),
      capturedAt: "2026-07-29T02:45:03.000Z",
    });
    expect(zeroMilliseconds.capturedAt).toBe("2026-07-29T02:45:03Z");

    const milliseconds = await evaluatePetArrangementCapture({
      ...captureInput(),
      capturedAt: "2026-07-29T02:45:03.125Z",
    });
    expect(milliseconds.capturedAt).toBe("2026-07-29T02:45:03.125Z");
  });

  test("redacts arbitrary errors and exposes only deterministic diagnostic fields", () => {
    const diagnostic = redactPetArrangementCaptureError(
      new Error(
        "/Users/player/SaveFile_Live.es3 REDACTED_TASKBARHERO_ES3_PASSWORD decrypted-secret",
      ),
    );

    expect(diagnostic).toEqual({
      format: "taskbarhero-runtime-oracle/pet-arrangement-capture/v1",
      status: "FAIL",
      error: {
        code: "capture_failed",
        message: "Pet arrangement capture failed.",
      },
    });
    expect(JSON.stringify(diagnostic)).not.toContain("SaveFile_Live");
    expect(JSON.stringify(diagnostic)).not.toContain("decrypted-secret");
    expect(JSON.stringify(diagnostic)).not.toContain(FIXTURE_PASSWORD);
  });
});
