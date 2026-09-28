import { afterEach, describe, expect, test } from "bun:test";
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectories: string[] = [];
const PASSWORD = "fixture-es3-password";
const SALT_AND_IV = Uint8Array.from([
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
]);

function encryptFixture(arrangedPetKey: number): Uint8Array {
  const plaintext = JSON.stringify({
    PlayerSaveData: {
      value: JSON.stringify({
        commonSaveData: { ArrangedPetKey: arrangedPetKey },
        PetSaveData: [
          { PetKey: 1001, IsUnlock: true },
          { PetKey: 1002, IsUnlock: true },
        ],
      }),
    },
    AccountSaveData: { value: "{}" },
    SystemInfo: { value: "{}" },
  });
  const key = pbkdf2Sync(PASSWORD, SALT_AND_IV, 100, 16, "sha1");
  const cipher = createCipheriv("aes-128-cbc", key, SALT_AND_IV);
  return Uint8Array.from([
    ...SALT_AND_IV,
    ...cipher.update(plaintext, "utf8"),
    ...cipher.final(),
  ]);
}

async function fixtureFiles(): Promise<{
  readonly directory: string;
  readonly before: string;
  readonly after: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "discordhero-pet-oracle-"));
  temporaryDirectories.push(directory);
  const before = join(directory, "private-before.es3");
  const after = join(directory, "private-after.es3");
  await writeFile(before, encryptFixture(1001));
  await writeFile(after, encryptFixture(1002));
  return { directory, before, after };
}

async function runCli(args: readonly string[]) {
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "scripts/discordhero-pet-arrangement-oracle.ts",
      ...args,
    ],
    {
      cwd: join(import.meta.dir, ".."),
      env: { ...process.env, TASKBARHERO_ES3_PASSWORD: PASSWORD },
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("DiscordHero Pet arrangement capture CLI", () => {
  test("prints one PASS JSON report to stdout and writes no artifact", async () => {
    const files = await fixtureFiles();
    const result = await runCli([
      "--before",
      files.before,
      "--after",
      files.after,
      "--from",
      "1001",
      "--to",
      "1002",
      "--captured-at",
      "2026-07-29T02:45:03Z",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "PASS",
      capturedAt: "2026-07-29T02:45:03Z",
      transition: { fromPetKey: 1001, toPetKey: 1002 },
    });
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(
      (await Array.fromAsync(new Bun.Glob("*").scan(files.directory))).sort(),
    ).toEqual(["private-after.es3", "private-before.es3"]);
  });

  test("uses nonzero exit and redacted stderr JSON for failure", async () => {
    const files = await fixtureFiles();
    const secretPath = join(files.directory, "secret-missing.es3");
    const result = await runCli([
      "--before",
      secretPath,
      "--after",
      files.after,
      "--from",
      "1001",
      "--to",
      "1002",
      "--captured-at",
      "2026-07-29T02:45:03Z",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      format: "taskbarhero-runtime-oracle/pet-arrangement-capture/v1",
      status: "FAIL",
      error: {
        code: "capture_failed",
        message: "Pet arrangement capture failed.",
      },
    });
    expect(result.stderr).not.toContain(secretPath);
    expect(result.stderr).not.toContain(PASSWORD);
  });

  test("rejects missing, duplicate, malformed, and unknown arguments", async () => {
    for (const args of [
      [],
      [
        "--before",
        "a",
        "--before",
        "b",
        "--after",
        "c",
        "--from",
        "1001",
        "--to",
        "1002",
        "--captured-at",
        "2026-07-29T02:45:03Z",
      ],
      [
        "--before",
        "a",
        "--after",
        "b",
        "--from",
        "01",
        "--to",
        "1002",
        "--captured-at",
        "2026-07-29T02:45:03Z",
      ],
      ["--unknown", "value"],
    ]) {
      const result = await runCli(args);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr)).toMatchObject({
        status: "FAIL",
        error: { code: "invalid_arguments" },
      });
    }
  });
});
