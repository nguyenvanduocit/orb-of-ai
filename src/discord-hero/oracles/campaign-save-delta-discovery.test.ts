import { describe, expect, test } from "bun:test";
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto";
import {
  evaluateCampaignSaveDeltaDiscovery,
  redactCampaignSaveDeltaDiscoveryError,
} from "./campaign-save-delta-discovery";

const FIXTURE_PASSWORD = "REDACTED_TASKBARHERO_ES3_PASSWORD";
const FIXTURE_SALT_AND_IV = Uint8Array.from([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
]);

function encryptPlaintext(
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

function defineOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

interface SaveOptions {
  readonly account?: unknown;
  readonly system?: unknown;
  readonly playerWrapperSiblings?: readonly (readonly [
    key: string,
    value: unknown,
  ])[];
  readonly unknownOuter?: readonly (readonly [key: string, value: unknown])[];
}

function encryptedSave(player: unknown, options: SaveOptions = {}): Uint8Array {
  const playerWrapper = Object.create(null) as object;
  defineOwn(playerWrapper, "value", JSON.stringify(player));
  for (const [key, value] of options.playerWrapperSiblings ?? []) {
    defineOwn(playerWrapper, key, value);
  }

  const outer = Object.create(null) as object;
  defineOwn(outer, "PlayerSaveData", playerWrapper);
  defineOwn(outer, "AccountSaveData", {
    value: JSON.stringify(options.account ?? { StableAccount: true }),
  });
  defineOwn(outer, "SystemInfo", {
    value: JSON.stringify(options.system ?? { StableBuild: 1 }),
  });
  for (const [key, value] of options.unknownOuter ?? []) {
    defineOwn(outer, key, value);
  }
  return encryptPlaintext(JSON.stringify(outer));
}

function outerJson(
  entries: readonly (readonly [key: string, value: unknown])[],
): string {
  const outer = Object.create(null) as object;
  for (const [key, value] of entries) {
    defineOwn(outer, key, value);
  }
  return JSON.stringify(outer);
}

function discoveryInput(
  beforePlayer: unknown,
  afterPlayer: unknown,
  options: {
    readonly beforeSave?: SaveOptions;
    readonly afterSave?: SaveOptions;
  } = {},
) {
  return {
    beforeEncrypted: encryptedSave(beforePlayer, options.beforeSave),
    afterEncrypted: encryptedSave(afterPlayer, options.afterSave),
    beforeLabel: "before-normal-1101",
    afterLabel: "after-normal-1101",
    capturedAt: "2026-07-29T04:05:06.000Z",
  } as const;
}

async function discoveryDiagnostic(
  input: Parameters<typeof evaluateCampaignSaveDeltaDiscovery>[0],
) {
  try {
    await evaluateCampaignSaveDeltaDiscovery(input);
  } catch (error) {
    return {
      failure: error,
      diagnostic: redactCampaignSaveDeltaDiscoveryError(error),
    };
  }
  throw new Error("expected discovery to fail");
}

function publicJson(value: unknown): string {
  return JSON.stringify(value);
}

describe("TaskbarHero campaign save-delta discovery", () => {
  test("hashes alphanumeric dynamic identifiers and fingerprints every numeric and boolean scalar", async () => {
    const privatePaths = [
      "Authentication",
      "CustomerAlpha9000",
      "DynamicSecretCanary9",
      "AliceIdentifier777",
      "Gold",
    ] as const;

    for (const [beforeValue, afterValue] of [
      [314159, 271828],
      [false, true],
    ] as const) {
      const report = await evaluateCampaignSaveDeltaDiscovery(
        discoveryInput(
          {
            Authentication: {
              CustomerAlpha9000: { Gold: beforeValue },
            },
          },
          {
            Authentication: {
              CustomerAlpha9000: { Gold: afterValue },
            },
          },
          {
            beforeSave: {
              account: {
                DynamicSecretCanary9: { Gold: beforeValue },
              },
              unknownOuter: [["AliceIdentifier777", { Gold: beforeValue }]],
            },
            afterSave: {
              account: {
                DynamicSecretCanary9: { Gold: afterValue },
              },
              unknownOuter: [["AliceIdentifier777", { Gold: afterValue }]],
            },
          },
        ),
      );

      expect(report.changes.map((change) => change.path)).toEqual([
        [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "66880d2d8216260d201917a72eb245440ef18ba9b54c070ee39aa4c343ae126f",
          },
          {
            kind: "field_hash",
            sha256:
              "dd05f1574ae611337ca37deaa2f4ba2adae52494179fc247b1ed7f05820102a0",
          },
          {
            kind: "field_hash",
            sha256:
              "6249df4367d0a2e088c8eb1117ef59430f0d7dad4bf0fcf8a01d7f0415f4d511",
          },
        ],
        [
          { kind: "field", name: "AccountSaveData" },
          {
            kind: "field_hash",
            sha256:
              "6ed7e9b283e0e06f46cfdabcc056cfb1b63b379e67bf355006a260b6a17ff7d1",
          },
          {
            kind: "field_hash",
            sha256:
              "6249df4367d0a2e088c8eb1117ef59430f0d7dad4bf0fcf8a01d7f0415f4d511",
          },
        ],
        [
          { kind: "field", name: "OuterSaveData" },
          {
            kind: "field_hash",
            sha256:
              "3c26daee63b073f7d95364f28ccf5a0df4fecee2eedfa4c82dc54e21f54e6899",
          },
          {
            kind: "field_hash",
            sha256:
              "6249df4367d0a2e088c8eb1117ef59430f0d7dad4bf0fcf8a01d7f0415f4d511",
          },
        ],
      ]);
      for (const change of report.changes) {
        expect(change.before).toEqual({
          type: typeof beforeValue === "number" ? "number" : "boolean",
          length: String(beforeValue).length,
          sha256: expect.any(String),
        });
        expect(change.after).toEqual({
          type: typeof afterValue === "number" ? "number" : "boolean",
          length: String(afterValue).length,
          sha256: expect.any(String),
        });
        expect("value" in change.before).toBe(false);
        expect("value" in change.after).toBe(false);
      }
      const json = publicJson(report);
      for (const privatePath of privatePaths) {
        expect(json).not.toContain(privatePath);
      }
      expect(json).not.toContain(String(beforeValue));
      expect(json).not.toContain(String(afterValue));
    }
  });

  test("reports DISCOVERY with stable labels, canonical time, and fingerprinted campaign scalars", async () => {
    const before = {
      CampaignState: {
        ArbitraryCounter: 7,
        ClearCount: 0,
        CurrentStageKey: 1101,
        IsDead: false,
        SecretNote: "before-secret",
      },
    };
    const after = {
      CampaignState: {
        ArbitraryCounter: 8,
        ClearCount: 1,
        CurrentStageKey: 1102,
        IsDead: true,
        SecretNote: "after-secret",
      },
    };
    const input = discoveryInput(before, after);

    const report = await evaluateCampaignSaveDeltaDiscovery(input);

    expect(report).toEqual({
      format: "taskbarhero-runtime-oracle/campaign-save-delta-discovery/v1",
      status: "DISCOVERY",
      capturedAt: "2026-07-29T04:05:06Z",
      pair: {
        beforeLabel: "before-normal-1101",
        afterLabel: "after-normal-1101",
      },
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
      changes: [
        {
          path: [
            { kind: "field", name: "PlayerSaveData" },
            {
              kind: "field_hash",
              sha256:
                "87f74ab1d3a042fbc660348f3aea33a23b0e40151c2b02522dcd17699a58b9ff",
            },
            {
              kind: "field_hash",
              sha256:
                "ebe460eb410714acca8ea4f4817a2a61b5f9e4498e5f0d39ee1675827f46a290",
            },
          ],
          change: "MODIFIED",
          before: {
            type: "number",
            length: 1,
            sha256:
              "7902699be42c8a8e46fbbb4501726517e86b22c56a189f7625a6da49081b2451",
          },
          after: {
            type: "number",
            length: 1,
            sha256:
              "2c624232cdd221771294dfbb310aca000a0df6ac8b66b696d90ef06fdefb64a3",
          },
        },
        {
          path: [
            { kind: "field", name: "PlayerSaveData" },
            {
              kind: "field_hash",
              sha256:
                "87f74ab1d3a042fbc660348f3aea33a23b0e40151c2b02522dcd17699a58b9ff",
            },
            {
              kind: "field_hash",
              sha256:
                "309fc44771e7ebcf6db6f49ec0bfe0dd76f66694ebd2082138242ff149f602d7",
            },
          ],
          change: "MODIFIED",
          before: {
            type: "number",
            length: 1,
            sha256:
              "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
          },
          after: {
            type: "number",
            length: 1,
            sha256:
              "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
          },
        },
        {
          path: [
            { kind: "field", name: "PlayerSaveData" },
            {
              kind: "field_hash",
              sha256:
                "87f74ab1d3a042fbc660348f3aea33a23b0e40151c2b02522dcd17699a58b9ff",
            },
            {
              kind: "field_hash",
              sha256:
                "6ddf79fac09b4c68b2543744e88e0e4861614182f0ffdc4f25c900c1d7597382",
            },
          ],
          change: "MODIFIED",
          before: {
            type: "number",
            length: 4,
            sha256:
              "36ab771eba23f49d7ae43af88c601f3de8fccb201250906a4085444ae765f2db",
          },
          after: {
            type: "number",
            length: 4,
            sha256:
              "277375b99e186c72ac38ac47b03199038342fe0389be8765476fa2be0c5b5649",
          },
        },
        {
          path: [
            { kind: "field", name: "PlayerSaveData" },
            {
              kind: "field_hash",
              sha256:
                "87f74ab1d3a042fbc660348f3aea33a23b0e40151c2b02522dcd17699a58b9ff",
            },
            {
              kind: "field_hash",
              sha256:
                "c06a33e3803c8e3dc2f5611739c325a5ee19d9a23fe0b5752a4509dbff761f1d",
            },
          ],
          change: "MODIFIED",
          before: {
            type: "boolean",
            length: 5,
            sha256:
              "fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa",
          },
          after: {
            type: "boolean",
            length: 4,
            sha256:
              "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b",
          },
        },
        {
          path: [
            { kind: "field", name: "PlayerSaveData" },
            {
              kind: "field_hash",
              sha256:
                "87f74ab1d3a042fbc660348f3aea33a23b0e40151c2b02522dcd17699a58b9ff",
            },
            {
              kind: "field_hash",
              sha256:
                "92aa6c54632a4971bd9da473e63d9c686eedfa367ee8de4dabd9c1a5e5163d6a",
            },
          ],
          change: "MODIFIED",
          before: {
            type: "string",
            length: 15,
            sha256:
              "6f88345585462d2750279aab6563b09f4674e2ff178fdd61544d8453921777b0",
          },
          after: {
            type: "string",
            length: 14,
            sha256:
              "e75dc2b7a05ab2b0683923f9f6d884964250c2e6cb5431a3fa619951c7a5c12a",
          },
        },
      ],
    });
    expect(publicJson(report)).not.toContain("before-secret");
    expect(publicJson(report)).not.toContain("after-secret");
    expect(publicJson(report)).not.toContain(FIXTURE_PASSWORD);
  });

  test("compares normalized roots, wrapper siblings, and unknown outer roots", async () => {
    const input = discoveryInput(
      { Stable: true },
      { Stable: true },
      {
        beforeSave: {
          account: { CampaignCursor: 1 },
          system: { BuildCounter: 1 },
          playerWrapperSiblings: [["revision", 1]],
          unknownOuter: [["FutureCampaignData", { Value: 1 }]],
        },
        afterSave: {
          account: { CampaignCursor: 2 },
          system: { BuildCounter: 2 },
          playerWrapperSiblings: [["revision", 2]],
          unknownOuter: [["FutureCampaignData", { Value: 2 }]],
        },
      },
    );

    const report = await evaluateCampaignSaveDeltaDiscovery(input);

    expect(report.changes.map((change) => change.path)).toEqual([
      [
        { kind: "field", name: "AccountSaveData" },
        {
          kind: "field_hash",
          sha256:
            "7a7d0a66ba8cdefe42d5e119f1207edc99fd73a2f971e7e8d4e8085d0c4a6277",
        },
      ],
      [
        { kind: "field", name: "SystemInfo" },
        {
          kind: "field_hash",
          sha256:
            "d3fbaa3cad2dc9b9bdd0f61a0cb392c0f8cac30f5bd4db3b272e91328c51fd10",
        },
      ],
      [
        { kind: "field", name: "OuterSaveData" },
        {
          kind: "field_hash",
          sha256:
            "f496698c76e7f7dd77341f076bda54446d8bd8fc0aaa93efb6b3aeabb21b65e7",
        },
        {
          kind: "field_hash",
          sha256:
            "8e37953d23daca5ff01b8282c33f4e0a2152f1d1885f94c06418617e3ee1d24e",
        },
      ],
      [
        { kind: "field", name: "OuterSaveData" },
        { kind: "field", name: "PlayerSaveData" },
        {
          kind: "field_hash",
          sha256:
            "2b214ddf3326016519afcb268f63623b80b91a65265277668e4d020d87dd9078",
        },
      ],
    ]);
  });

  test("uses valid encrypted JSON to preserve every representable root value kind as ADDED and REMOVED", async () => {
    const roots = [
      { name: "PlayerSaveData", label: "player" },
      { name: "AccountSaveData", label: "account" },
      { name: "SystemInfo", label: "system" },
    ] as const;
    const values = [
      { label: "null", type: "null", value: null },
      { label: "object", type: "object", value: { Stable: "object" } },
      { label: "array", type: "array", value: ["stable", 7] },
      { label: "string", type: "string", value: "stable-string" },
      { label: "number", type: "number", value: 123.5 },
      { label: "boolean", type: "boolean", value: true },
    ] as const;
    const missingJson = outerJson([]);

    for (const root of roots) {
      for (const fixture of values) {
        const wrapperRevision = `${root.label}-${fixture.label}-wrapper-v1`;
        const wrappedValue =
          fixture.type === "object" || fixture.type === "array"
            ? JSON.stringify(fixture.value)
            : fixture.value;
        const presentJson = outerJson([
          [
            root.name,
            {
              value: wrappedValue,
              revision: wrapperRevision,
            },
          ],
        ]);

        for (const json of [missingJson, presentJson]) {
          expect(JSON.stringify(JSON.parse(json))).toBe(json);
        }

        const missing = encryptPlaintext(missingJson);
        const present = encryptPlaintext(presentJson);
        for (const [beforeEncrypted, afterEncrypted, change] of [
          [missing, present, "ADDED"],
          [present, missing, "REMOVED"],
        ] as const) {
          const report = await evaluateCampaignSaveDeltaDiscovery({
            beforeEncrypted,
            afterEncrypted,
            beforeLabel: `before-${root.label}-${fixture.label}-${change.toLowerCase()}`,
            afterLabel: `after-${root.label}-${fixture.label}-${change.toLowerCase()}`,
            capturedAt: "2026-07-29T04:05:06Z",
          });

          expect(report.status).toBe("DISCOVERY");
          expect(
            report.changes.map((entry) => ({
              path: entry.path,
              change: entry.change,
              beforeType: entry.before.type,
              afterType: entry.after.type,
            })),
          ).toEqual([
            {
              path: [{ kind: "field", name: root.name }],
              change,
              beforeType: change === "ADDED" ? "missing" : fixture.type,
              afterType: change === "ADDED" ? fixture.type : "missing",
            },
            {
              path: [
                { kind: "field", name: "OuterSaveData" },
                { kind: "field", name: root.name },
              ],
              change,
              beforeType: change === "ADDED" ? "missing" : "object",
              afterType: change === "ADDED" ? "object" : "missing",
            },
          ]);
          const wrapperDescriptor =
            change === "ADDED"
              ? report.changes[1]!.after
              : report.changes[1]!.before;
          expect(wrapperDescriptor).toMatchObject({
            type: "object",
            length: expect.any(Number),
            sha256: expect.any(String),
          });
          expect(wrapperDescriptor.length).not.toBe(2);
          expect(publicJson(report)).not.toContain(wrapperRevision);
        }
      }
    }
  });

  test("reports additions, removals, array length, and array order without object payloads", async () => {
    const before = {
      CampaignRows: [{ StageKey: 1101 }, { StageKey: 1102 }],
      RemovedCheckpoint: { StageKey: 1101, Secret: "remove-me" },
    };
    const after = {
      AddedCheckpoint: { StageKey: 1102, Secret: "add-me" },
      CampaignRows: [
        { StageKey: 1102 },
        { StageKey: 1101 },
        { StageKey: 1103 },
      ],
    };

    const report = await evaluateCampaignSaveDeltaDiscovery(
      discoveryInput(before, after),
    );

    expect(
      report.changes.map((change) => ({
        path: change.path,
        change: change.change,
        beforeType: change.before.type,
        afterType: change.after.type,
      })),
    ).toEqual([
      {
        path: [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "ba00cea158dfde2617d0f65581ef000cbefda66a9daaf57aa3cb9a58e60fe12d",
          },
        ],
        change: "ADDED",
        beforeType: "missing",
        afterType: "object",
      },
      {
        path: [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "80d52c84eb84daecaa592b3b19316c79333147ca69721697cbba3d2bf2c686a6",
          },
          { kind: "index", index: 0 },
          {
            kind: "field_hash",
            sha256:
              "b37dd0f1fc6671ce2b02f9fd59d079adb6612ce49fb4f3a7d665aa1f80b13b63",
          },
        ],
        change: "MODIFIED",
        beforeType: "number",
        afterType: "number",
      },
      {
        path: [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "80d52c84eb84daecaa592b3b19316c79333147ca69721697cbba3d2bf2c686a6",
          },
          { kind: "index", index: 1 },
          {
            kind: "field_hash",
            sha256:
              "b37dd0f1fc6671ce2b02f9fd59d079adb6612ce49fb4f3a7d665aa1f80b13b63",
          },
        ],
        change: "MODIFIED",
        beforeType: "number",
        afterType: "number",
      },
      {
        path: [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "80d52c84eb84daecaa592b3b19316c79333147ca69721697cbba3d2bf2c686a6",
          },
          { kind: "index", index: 2 },
        ],
        change: "ADDED",
        beforeType: "missing",
        afterType: "object",
      },
      {
        path: [
          { kind: "field", name: "PlayerSaveData" },
          {
            kind: "field_hash",
            sha256:
              "7178c984d46e2207d6874407633efc6344f7c49c0532f12fa35e9c68bb42c922",
          },
        ],
        change: "REMOVED",
        beforeType: "object",
        afterType: "missing",
      },
    ]);
    const json = publicJson(report);
    expect(json).not.toContain("add-me");
    expect(json).not.toContain("remove-me");
    expect(json).not.toContain('"Secret"');
  });

  test("hashes __proto__, symbolic, numeric, and dynamic path tokens", async () => {
    const unsafeKeys = [
      "__proto__",
      "$symbolic",
      "123456789",
      "private_dynamic_key_canary_7f4c91",
    ] as const;
    const before = Object.create(null) as object;
    const after = Object.create(null) as object;
    for (const key of unsafeKeys) {
      defineOwn(before, key, "before-value-secret");
      defineOwn(after, key, "after-value-secret");
    }

    const first = await evaluateCampaignSaveDeltaDiscovery(
      discoveryInput(before, after),
    );
    const second = await evaluateCampaignSaveDeltaDiscovery(
      discoveryInput(before, after),
    );

    expect(first.changes).toEqual(second.changes);
    expect(first.changes.map((change) => change.path.at(-1))).toEqual([
      {
        kind: "field_hash",
        sha256:
          "becca1c8080e2318f517c3a4042fea10f95804da7b790d5e95f8adf6d9042aba",
      },
      {
        kind: "field_hash",
        sha256:
          "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225",
      },
      {
        kind: "field_hash",
        sha256:
          "30e2af384186b57fda019524ade9f9afe48e815480b993d14ec8dc68251b592a",
      },
      {
        kind: "field_hash",
        sha256:
          "22b522b52efe694601c6e78074540c8ae1e2e13750ce3da98fd49af45b371339",
      },
    ]);
    const json = publicJson(first);
    for (const secret of [
      ...unsafeKeys,
      "before-value-secret",
      "after-value-secret",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  test("sorts changes deterministically regardless of object insertion order", async () => {
    const beforeA = Object.create(null) as object;
    const afterA = Object.create(null) as object;
    const beforeB = Object.create(null) as object;
    const afterB = Object.create(null) as object;
    for (const key of ["Zulu", "Alpha", "Middle"]) {
      defineOwn(beforeA, key, 1);
      defineOwn(afterB, key, 2);
    }
    for (const key of ["Middle", "Alpha", "Zulu"]) {
      defineOwn(afterA, key, 2);
      defineOwn(beforeB, key, 1);
    }

    const first = await evaluateCampaignSaveDeltaDiscovery(
      discoveryInput(beforeA, afterA),
    );
    const second = await evaluateCampaignSaveDeltaDiscovery(
      discoveryInput(beforeB, afterB),
    );

    expect(first.changes).toEqual(second.changes);
    expect(
      first.changes.map((change) => {
        const segment = change.path.at(-1);
        return segment?.kind === "field_hash" ? segment.sha256 : null;
      }),
    ).toEqual([
      "b1a96dd646bccaa24cef7a3db22a6f995f05658f4f1c3272913e258c03e6fb24",
      "d93006ec2e4339d770a7afd068c1f1e789a52df12f595e529fd0f302fc1e5ec7",
      "5cd8645e8311342f270a642dcf704ef83464e1debb07db09c8aa4e49813f1b99",
    ]);
  });

  test("rejects invalid labels and timestamps without leaking attacker input", async () => {
    const secretLabel = "/Users/player/private-before-save.es3";
    for (const input of [
      { ...discoveryInput({}, {}), beforeLabel: secretLabel },
      {
        ...discoveryInput({}, {}),
        afterLabel: "before-normal-1101",
      },
      {
        ...discoveryInput({}, {}),
        capturedAt: "2026-02-29T00:00:00Z",
      },
      {
        ...discoveryInput({}, {}),
        capturedAt: "2026-07-29T04:05:06.0Z",
      },
    ]) {
      const { failure, diagnostic } = await discoveryDiagnostic(input);
      const output = `${publicJson(failure)}\n${publicJson(diagnostic)}`;
      expect(diagnostic).toMatchObject({ status: "FAIL" });
      expect(output).not.toContain(secretLabel);
      expect(output).not.toContain("SaveFile_Live");
      expect(output).not.toContain(FIXTURE_PASSWORD);
    }
  });

  test("fails closed for short, undecryptable, and invalid JSON inputs", async () => {
    const valid = encryptedSave({ Stable: true });
    const cases = [
      {
        beforeEncrypted: Uint8Array.from([1, 2, 3]),
        code: "file_too_small",
      },
      {
        beforeEncrypted: encryptPlaintext('{"PlayerSaveData":{}}', "wrong"),
        code: "decryption_failed",
      },
      {
        beforeEncrypted: encryptPlaintext("not-json"),
        code: "invalid_json",
      },
      {
        beforeEncrypted: encryptPlaintext("[]"),
        code: "invalid_json",
      },
    ] as const;

    for (const fixture of cases) {
      const { diagnostic } = await discoveryDiagnostic({
        ...discoveryInput({}, {}),
        beforeEncrypted: fixture.beforeEncrypted,
        afterEncrypted: valid,
      });
      expect(diagnostic).toEqual({
        format: "taskbarhero-runtime-oracle/campaign-save-delta-discovery/v1",
        status: "FAIL",
        error: {
          code: fixture.code,
          message: expect.any(String),
        },
      });
      expect(publicJson(diagnostic)).not.toContain(FIXTURE_PASSWORD);
    }
  });

  test("does not mutate encrypted inputs and redacts arbitrary errors", async () => {
    const input = discoveryInput({ StageKey: 1101 }, { StageKey: 1102 });
    const beforeCopy = Uint8Array.from(input.beforeEncrypted);
    const afterCopy = Uint8Array.from(input.afterEncrypted);

    await evaluateCampaignSaveDeltaDiscovery(input);

    expect(input.beforeEncrypted).toEqual(beforeCopy);
    expect(input.afterEncrypted).toEqual(afterCopy);
    const diagnostic = redactCampaignSaveDeltaDiscoveryError(
      new Error(
        "/Users/player/SaveFile_Live.es3 REDACTED_TASKBARHERO_ES3_PASSWORD plaintext-secret",
      ),
    );
    expect(diagnostic).toEqual({
      format: "taskbarhero-runtime-oracle/campaign-save-delta-discovery/v1",
      status: "FAIL",
      error: {
        code: "capture_failed",
        message: "Campaign save-delta discovery failed.",
      },
    });
    expect(publicJson(diagnostic)).not.toContain("SaveFile_Live");
    expect(publicJson(diagnostic)).not.toContain("plaintext-secret");
    expect(publicJson(diagnostic)).not.toContain(FIXTURE_PASSWORD);
  });
});
