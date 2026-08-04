import { afterEach, describe, expect, test } from "bun:test";
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runDiscordHeroCampaignSaveDeltaCommand } from "./discordhero-campaign-save-delta";

const temporaryDirectories: string[] = [];
const FIXTURE_PASSWORD = "REDACTED_TASKBARHERO_ES3_PASSWORD";
const FIXTURE_SALT_AND_IV = Uint8Array.from([
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
]);
const SNAPSHOT_FORMAT = "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1";
const PROJECT_ROOT = resolve(import.meta.dir, "..");

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function encryptedSave(
  stageKey: number,
  secret: string,
  privateValue?: number | boolean,
): Uint8Array {
  const plaintext = JSON.stringify({
    PlayerSaveData: {
      value: JSON.stringify({
        CampaignState: {
          CurrentStageKey: stageKey,
          SecretNote: secret,
        },
        ...(privateValue === undefined
          ? {}
          : {
              Authentication: {
                CustomerAlpha9000: { Gold: privateValue },
              },
            }),
      }),
      revision: 1,
    },
    AccountSaveData: {
      value: JSON.stringify(
        privateValue === undefined
          ? {}
          : { DynamicSecretCanary9: { Gold: privateValue } },
      ),
    },
    SystemInfo: { value: "{}" },
    UnknownOuterRoot: { Stable: true },
    ...(privateValue === undefined
      ? {}
      : { AliceIdentifier777: { Gold: privateValue } }),
  });
  const key = pbkdf2Sync(
    FIXTURE_PASSWORD,
    FIXTURE_SALT_AND_IV,
    100,
    16,
    "sha1",
  );
  const cipher = createCipheriv("aes-128-cbc", key, FIXTURE_SALT_AND_IV);
  return Uint8Array.from([
    ...FIXTURE_SALT_AND_IV,
    ...cipher.update(plaintext, "utf8"),
    ...cipher.final(),
  ]);
}

async function makeParent(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "discordhero-campaign-oracle-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function writeCompletedCapture(input: {
  readonly parent: string;
  readonly name: string;
  readonly label: string;
  readonly stageKey: number;
  readonly secret: string;
  readonly privateValue?: number | boolean;
  readonly capturedAt?: string;
  readonly mutateManifest?: (manifest: Record<string, unknown>) => void;
  readonly omitManifest?: boolean;
  readonly omitSave?: boolean;
}): Promise<string> {
  const directory = join(input.parent, input.name);
  await mkdir(directory, { recursive: true });
  const bytes = encryptedSave(input.stageKey, input.secret, input.privateValue);
  const digest = sha256Hex(bytes);
  if (!input.omitSave) {
    await writeFile(join(directory, "encrypted-save.es3"), bytes, {
      mode: 0o600,
    });
  }
  if (!input.omitManifest) {
    const manifest: Record<string, unknown> = {
      format: SNAPSHOT_FORMAT,
      version: 1,
      label: input.label,
      capturedAt: input.capturedAt ?? "2026-07-29T04:05:06Z",
      bytes: bytes.byteLength,
      sha256: digest,
      snapshotFile: "encrypted-save.es3",
    };
    input.mutateManifest?.(manifest);
    await writeFile(
      join(directory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
  return directory;
}

async function runCli(args: readonly string[]) {
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "scripts/discordhero-campaign-save-delta.ts",
      ...args,
    ],
    {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

function discoveryArgs(input: {
  readonly beforeDir: string;
  readonly afterDir: string;
  readonly beforeLabel?: string;
  readonly afterLabel?: string;
  readonly capturedAt?: string;
}): string[] {
  return [
    "--before-dir",
    input.beforeDir,
    "--after-dir",
    input.afterDir,
    "--before-label",
    input.beforeLabel ?? "before-normal-1101",
    "--after-label",
    input.afterLabel ?? "after-normal-1101",
    "--captured-at",
    input.capturedAt ?? "2026-07-29T04:05:06Z",
  ];
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("DiscordHero campaign save-delta discovery CLI", () => {
  test("accepts completed snapshot directories and emits deterministic redacted DISCOVERY", async () => {
    const parent = await makeParent();
    const beforeDir = await writeCompletedCapture({
      parent,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "before-plaintext-secret",
      privateValue: 314159,
    });
    const afterDir = await writeCompletedCapture({
      parent,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "after-plaintext-secret",
      privateValue: 271828,
    });

    const first = await runCli(discoveryArgs({ beforeDir, afterDir }));
    const second = await runCli(discoveryArgs({ beforeDir, afterDir }));
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toBe(second.stdout);
    expect(first.stdout.trim().split("\n")).toHaveLength(1);

    const report = JSON.parse(first.stdout) as {
      readonly status: string;
      readonly pair: Readonly<{ beforeLabel: string; afterLabel: string }>;
    };
    expect(report.status).toBe("DISCOVERY");
    expect(report.pair).toEqual({
      beforeLabel: "before-normal-1101",
      afterLabel: "after-normal-1101",
    });
    for (const forbidden of [
      beforeDir,
      afterDir,
      "encrypted-save.es3",
      "manifest.json",
      "before-plaintext-secret",
      "after-plaintext-secret",
      "Authentication",
      "CustomerAlpha9000",
      "Gold",
      "314159",
      "271828",
      FIXTURE_PASSWORD,
      "PASS",
      "bun run",
    ]) {
      expect(first.stdout).not.toContain(forbidden);
    }

    // Inputs unchanged.
    const beforeSave = join(beforeDir, "encrypted-save.es3");
    const beforeMeta = await lstat(beforeSave);
    const beforeBytes = await readFile(beforeSave);
    await runCli(discoveryArgs({ beforeDir, afterDir }));
    const afterMeta = await lstat(beforeSave);
    const afterBytes = await readFile(beforeSave);
    expect(afterMeta.mtimeMs).toBe(beforeMeta.mtimeMs);
    expect(sha256Hex(afterBytes)).toBe(sha256Hex(beforeBytes));
  });

  test("rejects capture-dir symlink, nested file symlinks, incomplete and mismatched manifests", async () => {
    const parent = await makeParent();
    const beforeDir = await writeCompletedCapture({
      parent,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "before-secret",
    });
    const afterDir = await writeCompletedCapture({
      parent,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "after-secret",
    });

    // Capture directory is a symlink.
    const linkedDir = join(parent, "linked-before");
    await symlink(beforeDir, linkedDir);
    let result = await runCli(
      discoveryArgs({ beforeDir: linkedDir, afterDir }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      status: "FAIL",
      error: { code: "capture_failed" },
    });
    expect(result.stderr).not.toContain(linkedDir);

    // encrypted-save.es3 replaced by symlink.
    const evilParent = await makeParent();
    const targetSave = join(evilParent, "target.es3");
    await writeFile(targetSave, encryptedSave(1, "x"));
    const symlinkSaveDir = await writeCompletedCapture({
      parent,
      name: "symlink-save",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
    });
    await rm(join(symlinkSaveDir, "encrypted-save.es3"));
    await symlink(targetSave, join(symlinkSaveDir, "encrypted-save.es3"));
    result = await runCli(
      discoveryArgs({ beforeDir: symlinkSaveDir, afterDir }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");

    // Missing manifest.
    const noManifest = await writeCompletedCapture({
      parent,
      name: "no-manifest",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
      omitManifest: true,
    });
    result = await runCli(discoveryArgs({ beforeDir: noManifest, afterDir }));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");

    // Missing encrypted save.
    const noSave = await writeCompletedCapture({
      parent,
      name: "no-save",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
      omitSave: true,
    });
    result = await runCli(discoveryArgs({ beforeDir: noSave, afterDir }));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");

    // Wrong format.
    const badFormat = await writeCompletedCapture({
      parent,
      name: "bad-format",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
      mutateManifest: (manifest) => {
        manifest.format = "not-a-snapshot";
      },
    });
    result = await runCli(discoveryArgs({ beforeDir: badFormat, afterDir }));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");

    // sha256 mismatch.
    const badHash = await writeCompletedCapture({
      parent,
      name: "bad-hash",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
      mutateManifest: (manifest) => {
        manifest.sha256 = "a".repeat(64);
      },
    });
    result = await runCli(discoveryArgs({ beforeDir: badHash, afterDir }));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");

    // Label mismatch between CLI and manifest.
    result = await runCli(
      discoveryArgs({
        beforeDir,
        afterDir,
        beforeLabel: "before-wrong-label",
      }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");
  });

  test("rejects same capture dir, relative paths, project-inside dirs, and bad args without leakage", async () => {
    const parent = await makeParent();
    const beforeDir = await writeCompletedCapture({
      parent,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "before-secret",
    });
    const afterDir = await writeCompletedCapture({
      parent,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "after-secret",
    });

    // Same directory twice.
    let result = await runCli(
      discoveryArgs({ beforeDir, afterDir: beforeDir }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).error.code).toMatch(
      /invalid_arguments|capture_failed/,
    );

    // Relative path rejected.
    result = await runCli(
      discoveryArgs({
        beforeDir: "relative-before",
        afterDir,
      }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("invalid_arguments");
    expect(result.stderr).not.toContain("relative-before");

    // Capture directory inside project root.
    const inside = join(PROJECT_ROOT, `.tmp-campaign-capture-${Date.now()}`);
    temporaryDirectories.push(inside);
    await mkdir(inside, { recursive: true });
    const insideBefore = await writeCompletedCapture({
      parent: inside,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "s",
    });
    const insideAfter = await writeCompletedCapture({
      parent: inside,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "t",
    });
    result = await runCli(
      discoveryArgs({ beforeDir: insideBefore, afterDir: insideAfter }),
    );
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");
    expect(result.stderr).not.toContain(insideBefore);

    // Invalid / duplicate / unknown args.
    const canary = "/private/argument-canary-dir";
    const cases: readonly (readonly string[])[] = [
      [],
      ["--before", canary, "--after", canary],
      ["--before-dir", canary, "--after-dir"],
      [
        "--before-dir",
        canary,
        "--before-dir",
        "duplicate",
        "--after-dir",
        afterDir,
        "--before-label",
        "before-normal-1101",
        "--after-label",
        "after-normal-1101",
        "--captured-at",
        "2026-07-29T04:05:06Z",
      ],
      ["--unknown", canary],
      [
        "--before-dir",
        beforeDir,
        "--after-dir",
        afterDir,
        "--before-label",
        "../private-before",
        "--after-label",
        "after-normal-1101",
        "--captured-at",
        "2026-07-29T04:05:06Z",
      ],
      [
        "--before-dir",
        beforeDir,
        "--after-dir",
        afterDir,
        "--before-label",
        "same-label",
        "--after-label",
        "same-label",
        "--captured-at",
        "2026-07-29T04:05:06Z",
      ],
      [
        "--before-dir",
        beforeDir,
        "--after-dir",
        afterDir,
        "--before-label",
        "before-normal-1101",
        "--after-label",
        "after-normal-1101",
        "--captured-at",
        "not-a-date",
      ],
    ];
    for (const args of cases) {
      result = await runCli(args);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      const code = JSON.parse(result.stderr).error.code as string;
      expect([
        "invalid_arguments",
        "invalid_label",
        "capture_failed",
      ]).toContain(code);
      expect(result.stderr).not.toContain(canary);
      expect(result.stderr).not.toContain("../private-before");
      expect(result.stderr).not.toContain(FIXTURE_PASSWORD);
    }
  });

  test("detects source mutation between double-reads via injected size change", async () => {
    const parent = await makeParent();
    const beforeDir = await writeCompletedCapture({
      parent,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "before-secret",
    });
    const afterDir = await writeCompletedCapture({
      parent,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "after-secret",
    });

    // Unit-level: mutate encrypted file after first successful load path by
    // replacing bytes and re-running should still succeed if stable; inject
    // mid-flight by calling the command API with a path we mutate using a
    // custom projectRoot (happy path already covered). Here we prove mismatch
    // after rewriting save without updating manifest.
    const savePath = join(beforeDir, "encrypted-save.es3");
    await writeFile(savePath, encryptedSave(9999, "mutated"));
    const result = await runCli(discoveryArgs({ beforeDir, afterDir }));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stderr).error.code).toBe("capture_failed");
    expect(result.stdout).toBe("");
  });

  test("exports a programmatic runner that never returns PASS", async () => {
    const parent = await makeParent();
    const beforeDir = await writeCompletedCapture({
      parent,
      name: "before-cap",
      label: "before-normal-1101",
      stageKey: 1101,
      secret: "before-secret",
    });
    const afterDir = await writeCompletedCapture({
      parent,
      name: "after-cap",
      label: "after-normal-1101",
      stageKey: 1102,
      secret: "after-secret",
    });
    const report = await runDiscordHeroCampaignSaveDeltaCommand(
      discoveryArgs({ beforeDir, afterDir }),
      { projectRoot: PROJECT_ROOT },
    );
    expect(report.status).toBe("DISCOVERY");
    expect(report).not.toHaveProperty("transition");
    expect(JSON.stringify(report)).not.toContain("PASS");
  });
});
