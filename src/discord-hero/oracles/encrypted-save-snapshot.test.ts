import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import {
  createDiscordHeroEncryptedSaveSnapshot,
  DiscordHeroEncryptedSaveSnapshotError,
  redactDiscordHeroEncryptedSaveSnapshotError,
  resolveTaskbarHeroEncryptedSaveSource,
} from "./encrypted-save-snapshot";

const FIXED_TIME = new Date("2026-07-29T02:45:03.125Z");
const SOURCE_BYTES = Uint8Array.from([
  0, 255, 17, 91, 42, 4, 200, 38, 73, 19, 88,
]);
const SOURCE_SHA256 = createHash("sha256").update(SOURCE_BYTES).digest("hex");
const temporaryDirectories: string[] = [];

interface Fixture {
  readonly root: string;
  readonly project: string;
  readonly output: string;
  readonly source: string;
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "discordhero-save-snapshot-"));
  temporaryDirectories.push(root);
  const project = join(root, "project");
  const output = join(root, "captures");
  const source = join(root, "SaveFile_Live.es3");
  await Promise.all([
    mkdir(project),
    mkdir(output),
    writeFile(source, SOURCE_BYTES),
  ]);
  return { root, project, output, source };
}

async function capture(input: Fixture) {
  return createDiscordHeroEncryptedSaveSnapshot({
    label: "before-pet-1001-to-1002",
    outputDirectory: input.output,
    sourcePath: input.source,
    projectRoot: input.project,
    platform: process.platform,
    environment: Object.create(null) as Record<string, string>,
    now: () => FIXED_TIME,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("TaskbarHero encrypted-save source resolver", () => {
  test("uses an explicit source on every platform", () => {
    expect(
      resolveTaskbarHeroEncryptedSaveSource({
        sourcePath: "/private/capture.es3",
        platform: "linux",
        environment: Object.create(null),
      }),
    ).toBe("/private/capture.es3");
  });

  test("resolves the Windows default from injected environment only", () => {
    const environment = Object.assign(Object.create(null), {
      USERPROFILE: String.raw`C:\Users\oracle`,
    }) as Record<string, string>;

    expect(
      resolveTaskbarHeroEncryptedSaveSource({
        platform: "win32",
        environment,
      }),
    ).toBe(
      win32.join(
        String.raw`C:\Users\oracle`,
        "AppData",
        "LocalLow",
        "TesseractStudio",
        "TaskbarHero",
        "SaveFile_Live.es3",
      ),
    );
  });

  test("requires --source off Windows and with a missing Windows profile", () => {
    for (const input of [
      {
        platform: "darwin" as const,
        environment: Object.create(null) as Record<string, string>,
      },
      {
        platform: "win32" as const,
        environment: Object.create(null) as Record<string, string>,
      },
    ]) {
      expect(() => resolveTaskbarHeroEncryptedSaveSource(input)).toThrow(
        new DiscordHeroEncryptedSaveSnapshotError("source_required"),
      );
    }
  });
});

describe("DiscordHero encrypted-save snapshot", () => {
  test("publishes byte-identical encrypted data and a deterministic path-free manifest", async () => {
    const input = await fixture();
    const sourceBefore = await stat(input.source);

    const result = await capture(input);

    expect(result).toMatchObject({
      format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
      status: "SNAPSHOT_CREATED",
      label: "before-pet-1001-to-1002",
      capturedAt: "2026-07-29T02:45:03.125Z",
      bytes: SOURCE_BYTES.byteLength,
      sha256: SOURCE_SHA256,
      snapshotFile: "encrypted-save.es3",
      manifestFile: "manifest.json",
    });
    const capturePrefix = `20260729T024503125Z--before-pet-1001-to-1002--${SOURCE_SHA256.slice(0, 12)}--`;
    expect(result.captureDirectory.startsWith(capturePrefix)).toBe(true);
    expect(result.captureDirectory).toHaveLength(capturePrefix.length + 6);

    const captureDirectory = join(input.output, result.captureDirectory);
    expect(await readFile(join(captureDirectory, result.snapshotFile))).toEqual(
      Buffer.from(SOURCE_BYTES),
    );
    const expectedManifest = `${JSON.stringify(
      {
        format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
        version: 1,
        label: "before-pet-1001-to-1002",
        capturedAt: "2026-07-29T02:45:03.125Z",
        bytes: SOURCE_BYTES.byteLength,
        sha256: SOURCE_SHA256,
        snapshotFile: "encrypted-save.es3",
      },
      null,
      2,
    )}\n`;
    const manifest = await readFile(
      join(captureDirectory, result.manifestFile),
      "utf8",
    );
    expect(manifest).toBe(expectedManifest);
    expect(manifest).not.toContain(input.root);
    expect(await readdir(input.output)).toEqual([result.captureDirectory]);
    expect(await readFile(input.source)).toEqual(Buffer.from(SOURCE_BYTES));
    const sourceAfter = await stat(input.source);
    expect(sourceAfter.mtimeMs).toBe(sourceBefore.mtimeMs);
    expect(sourceAfter.mode).toBe(sourceBefore.mode);
    if (process.platform !== "win32") {
      expect((await stat(captureDirectory)).mode & 0o777).toBe(0o700);
      expect(
        (await stat(join(captureDirectory, result.snapshotFile))).mode & 0o777,
      ).toBe(0o600);
      expect(
        (await stat(join(captureDirectory, result.manifestFile))).mode & 0o777,
      ).toBe(0o600);
    }
  });

  test("rejects a source that changes across the stat/read/stat/read proof", async () => {
    const input = await fixture();

    await expect(
      createDiscordHeroEncryptedSaveSnapshot({
        label: "before-pet-change",
        outputDirectory: input.output,
        sourcePath: input.source,
        projectRoot: input.project,
        platform: process.platform,
        environment: Object.create(null),
        now: () => FIXED_TIME,
        afterFirstRead: async () => {
          await writeFile(input.source, Uint8Array.from([9, 8, 7, 6]));
        },
      }),
    ).rejects.toEqual(
      new DiscordHeroEncryptedSaveSnapshotError("source_changed"),
    );
    expect(await readdir(input.output)).toEqual([]);
  });

  test.skipIf(process.platform === "win32")(
    "detects a validated output redirected into the project before writing raw bytes",
    async () => {
      const input = await fixture();
      const movedOutput = join(input.root, "captures-moved");
      const projectTarget = join(input.project, "redirect-target");
      await mkdir(projectTarget);

      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label: "before-pet-change",
          outputDirectory: input.output,
          sourcePath: input.source,
          projectRoot: input.project,
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
          afterFirstRead: async () => {
            await rename(input.output, movedOutput);
            await symlink(projectTarget, input.output);
          },
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("output_changed"),
      );

      expect(await readdir(projectTarget)).toEqual([]);
      expect(await readdir(movedOutput)).toEqual([]);
    },
  );

  test("rejects a non-regular source without reading it", async () => {
    const input = await fixture();
    const sourceDirectory = join(input.root, "source-directory");
    await mkdir(sourceDirectory);

    await expect(
      createDiscordHeroEncryptedSaveSnapshot({
        label: "before-pet-change",
        outputDirectory: input.output,
        sourcePath: sourceDirectory,
        projectRoot: input.project,
        platform: process.platform,
        environment: Object.create(null),
        now: () => FIXED_TIME,
      }),
    ).rejects.toEqual(
      new DiscordHeroEncryptedSaveSnapshotError("source_invalid"),
    );
    expect(await readdir(input.output)).toEqual([]);
  });

  test.skipIf(process.platform === "win32")(
    "rejects a source symlink without reading it",
    async () => {
      const input = await fixture();
      const sourceLink = join(input.root, "source-link.es3");
      await symlink(input.source, sourceLink);

      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label: "before-pet-change",
          outputDirectory: input.output,
          sourcePath: sourceLink,
          projectRoot: input.project,
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("source_invalid"),
      );
      expect(await readdir(input.output)).toEqual([]);
    },
  );

  test("requires an existing real output directory outside the project", async () => {
    const input = await fixture();
    const outputFile = join(input.root, "output-file");
    const missingOutput = join(input.root, "missing-output");
    const insideProject = join(input.project, "captures");
    await Promise.all([
      writeFile(outputFile, "not a directory"),
      mkdir(insideProject),
    ]);

    for (const outputDirectory of [outputFile, missingOutput]) {
      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label: "before-pet-change",
          outputDirectory,
          sourcePath: input.source,
          projectRoot: input.project,
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("output_invalid"),
      );
    }
    await expect(
      createDiscordHeroEncryptedSaveSnapshot({
        label: "before-pet-change",
        outputDirectory: insideProject,
        sourcePath: input.source,
        projectRoot: input.project,
        platform: process.platform,
        environment: Object.create(null),
        now: () => FIXED_TIME,
      }),
    ).rejects.toEqual(
      new DiscordHeroEncryptedSaveSnapshotError("output_inside_project"),
    );
    expect(await readdir(input.output)).toEqual([]);
  });

  test.skipIf(process.platform === "win32")(
    "rejects an output symlink",
    async () => {
      const input = await fixture();
      const outputLink = join(input.root, "output-link");
      await symlink(input.output, outputLink);

      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label: "before-pet-change",
          outputDirectory: outputLink,
          sourcePath: input.source,
          projectRoot: input.project,
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("output_invalid"),
      );
      expect(await readdir(input.output)).toEqual([]);
    },
  );

  test("rejects non-canonical labels before filesystem access", async () => {
    for (const label of [
      "",
      "Before-Pet",
      "before_pet",
      "-before-pet",
      "before-pet-",
      "before--pet",
      "../before-pet",
      "a".repeat(65),
    ]) {
      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label,
          outputDirectory: "/private/does-not-exist",
          sourcePath: "/private/does-not-exist.es3",
          projectRoot: "/private/project",
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("invalid_label"),
      );
    }
  });

  test("uses exclusive unique directories for same-input logical collisions", async () => {
    const input = await fixture();
    const first = await capture(input);
    const firstDirectory = join(input.output, first.captureDirectory);
    const snapshotBefore = await readFile(
      join(firstDirectory, first.snapshotFile),
    );
    const manifestBefore = await readFile(
      join(firstDirectory, first.manifestFile),
    );

    const second = await capture(input);

    expect(second.captureDirectory).not.toBe(first.captureDirectory);
    expect((await readdir(input.output)).sort()).toEqual(
      [first.captureDirectory, second.captureDirectory].sort(),
    );
    expect(await readFile(join(firstDirectory, first.snapshotFile))).toEqual(
      snapshotBefore,
    );
    expect(await readFile(join(firstDirectory, first.manifestFile))).toEqual(
      manifestBefore,
    );
  });

  test("fails closed before capture creation when output identity is zero", async () => {
    const input = await fixture();

    const outcome = await createDiscordHeroEncryptedSaveSnapshot({
      label: "before-pet-change",
      outputDirectory: input.output,
      sourcePath: input.source,
      projectRoot: input.project,
      platform: process.platform,
      environment: Object.create(null),
      now: () => FIXED_TIME,
      directoryIdentityProbe: () => ({ dev: 0n, ino: 0n }),
    }).then(
      () => ({ code: "resolved", outputEntries: [] as string[] }),
      async (error: DiscordHeroEncryptedSaveSnapshotError) => ({
        code: error.code,
        outputEntries: await readdir(input.output),
      }),
    );

    expect(outcome).toEqual({
      code: "output_identity_unavailable",
      outputEntries: [],
    });
  });

  test("rejects a capture identity equal to its output before writing raw bytes", async () => {
    const input = await fixture();
    let outputIdentity:
      { readonly dev: bigint; readonly ino: bigint } | undefined;

    const outcome = await createDiscordHeroEncryptedSaveSnapshot({
      label: "before-pet-change",
      outputDirectory: input.output,
      sourcePath: input.source,
      projectRoot: input.project,
      platform: process.platform,
      environment: Object.create(null),
      now: () => FIXED_TIME,
      directoryIdentityProbe: (kind, actual) => {
        if (kind === "output") {
          outputIdentity = actual;
          return actual;
        }
        return outputIdentity ?? actual;
      },
    }).then(
      () => ({ code: "resolved", captureContents: [] as string[][] }),
      async (error: DiscordHeroEncryptedSaveSnapshotError) => {
        const captures = await readdir(input.output);
        return {
          code: error.code,
          captureContents: await Promise.all(
            captures.map((name) => readdir(join(input.output, name))),
          ),
        };
      },
    );

    expect(outcome).toEqual({
      code: "output_identity_unavailable",
      captureContents: [[]],
    });
  });

  test("removes only its exclusive directory when publication fails", async () => {
    const input = await fixture();

    await expect(
      createDiscordHeroEncryptedSaveSnapshot({
        label: "before-pet-change",
        outputDirectory: input.output,
        sourcePath: input.source,
        projectRoot: input.project,
        platform: process.platform,
        environment: Object.create(null),
        now: () => FIXED_TIME,
        beforeManifestWrite: () => {
          throw new Error("injected publication failure");
        },
      }),
    ).rejects.toEqual(
      new DiscordHeroEncryptedSaveSnapshotError("capture_failed"),
    );

    expect(await readdir(input.output)).toEqual([]);
  });

  test.skipIf(process.platform === "win32")(
    "never deletes an unowned same-name victim after the output path is swapped",
    async () => {
      const input = await fixture();
      const movedOwnedOutput = join(input.root, "captures-owned-moved");
      const replacementOutput = join(input.root, "captures-replacement");
      const victimMarker = Uint8Array.from([91, 44, 19, 203]);
      let captureDirectory: string | undefined;
      await mkdir(replacementOutput);

      await expect(
        createDiscordHeroEncryptedSaveSnapshot({
          label: "before-pet-change",
          outputDirectory: input.output,
          sourcePath: input.source,
          projectRoot: input.project,
          platform: process.platform,
          environment: Object.create(null),
          now: () => FIXED_TIME,
          beforeManifestWrite: async () => {
            [captureDirectory] = await readdir(input.output);
            if (captureDirectory === undefined) {
              throw new Error("capture directory was not created");
            }
            const victimDirectory = join(replacementOutput, captureDirectory);
            await mkdir(victimDirectory);
            await writeFile(
              join(victimDirectory, "victim-marker.bin"),
              victimMarker,
            );
            await rename(input.output, movedOwnedOutput);
            await symlink(replacementOutput, input.output);
            throw new Error("injected output swap");
          },
        }),
      ).rejects.toEqual(
        new DiscordHeroEncryptedSaveSnapshotError("output_changed"),
      );

      if (captureDirectory === undefined) {
        throw new Error("capture directory was not observed");
      }
      expect(
        await readFile(
          join(replacementOutput, captureDirectory, "victim-marker.bin"),
        ),
      ).toEqual(Buffer.from(victimMarker));
      expect(
        (await readdir(join(movedOwnedOutput, captureDirectory))).sort(),
      ).toEqual(["encrypted-save.es3"]);
      expect(
        await lstat(
          join(movedOwnedOutput, captureDirectory, "manifest.json"),
        ).then(
          () => "present",
          (error: NodeJS.ErrnoException) => error.code,
        ),
      ).toBe("ENOENT");
    },
  );

  test("ambiguous cleanup identity preserves an unowned same-name victim", async () => {
    const input = await fixture();
    const movedOwnedOutput = join(input.root, "captures-owned-moved");
    const replacementOutput = join(input.root, "captures-replacement");
    const victimMarker = Uint8Array.from([77, 31, 92, 4]);
    let captureDirectory: string | undefined;
    let identityUnavailable = false;
    await mkdir(replacementOutput);

    await expect(
      createDiscordHeroEncryptedSaveSnapshot({
        label: "before-pet-change",
        outputDirectory: input.output,
        sourcePath: input.source,
        projectRoot: input.project,
        platform: process.platform,
        environment: Object.create(null),
        now: () => FIXED_TIME,
        directoryIdentityProbe: (_kind, actual) =>
          identityUnavailable ? { dev: 0n, ino: 0n } : actual,
        beforeManifestWrite: async () => {
          [captureDirectory] = await readdir(input.output);
          if (captureDirectory === undefined) {
            throw new Error("capture directory was not created");
          }
          const victimDirectory = join(replacementOutput, captureDirectory);
          await mkdir(victimDirectory);
          await writeFile(
            join(victimDirectory, "victim-marker.bin"),
            victimMarker,
          );
          await rename(input.output, movedOwnedOutput);
          await rename(replacementOutput, input.output);
          identityUnavailable = true;
          throw new Error("injected ambiguous output swap");
        },
      }),
    ).rejects.toEqual(
      new DiscordHeroEncryptedSaveSnapshotError("output_identity_unavailable"),
    );

    if (captureDirectory === undefined) {
      throw new Error("capture directory was not observed");
    }
    expect(
      await readFile(join(input.output, captureDirectory, "victim-marker.bin")),
    ).toEqual(Buffer.from(victimMarker));
    expect(
      (await readdir(join(movedOwnedOutput, captureDirectory))).sort(),
    ).toEqual(["encrypted-save.es3"]);
    expect(
      await lstat(
        join(movedOwnedOutput, captureDirectory, "manifest.json"),
      ).then(
        () => "present",
        (error: NodeJS.ErrnoException) => error.code,
      ),
    ).toBe("ENOENT");
  });
});

describe("DiscordHero encrypted-save snapshot diagnostics", () => {
  test("redacts unknown errors to a static result", () => {
    const secretPath = "/Users/private/SaveFile_Live.es3";

    const diagnostic = redactDiscordHeroEncryptedSaveSnapshotError(
      new Error(`read failed: ${secretPath}; password=private`),
    );

    expect(diagnostic).toEqual({
      format: "taskbarhero-runtime-oracle/encrypted-save-snapshot/v1",
      status: "FAIL",
      error: {
        code: "capture_failed",
        message: "Encrypted-save snapshot failed.",
      },
    });
    expect(JSON.stringify(diagnostic)).not.toContain(secretPath);
    expect(JSON.stringify(diagnostic)).not.toContain("password");
  });
});
