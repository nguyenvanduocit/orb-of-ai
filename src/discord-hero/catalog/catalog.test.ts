import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import {
  checkDiscordHeroCatalog,
  compileDiscordHeroCatalog,
  computeDiscordHeroCatalogPayloadSha256,
  createDiscordHeroSourceLock,
  CURRENT_VERSION_FILE,
  resolveCurrentRawSource,
  serializeSourceLock,
  validateDiscordHeroCatalog,
  writeDiscordHeroCatalog,
} from "./compiler";
import {
  datasetRowToRecord,
  getDiscordHeroDataset,
  getMonsterAttackEnrichment,
  loadDiscordHeroCatalog,
} from "./loader";
import {
  installValidatedRawSource,
  refreshDiscordHeroRawSource,
  type PromotionStep,
} from "./source-refresh";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const RAW_DATA_ROOT = join(PROJECT_ROOT, "preferences/taskbarhero/raw-data");

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

async function copyRawData(): Promise<string> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "discordhero-raw-"));
  const copy = join(temporaryRoot, "raw-data");
  await cp(RAW_DATA_ROOT, copy, { recursive: true });
  return copy;
}

async function currentRawSource(rawDataRoot = RAW_DATA_ROOT): Promise<string> {
  return resolveCurrentRawSource(rawDataRoot);
}

async function createProjectCopy(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "discordhero-project-"));
  const taskbarHeroRoot = join(projectRoot, "preferences/taskbarhero");
  await mkdir(taskbarHeroRoot, { recursive: true });
  await cp(
    join(PROJECT_ROOT, "preferences/taskbarhero/manifest.json"),
    join(taskbarHeroRoot, "manifest.json"),
  );
  // Refresh extracts monster details and Stage Box drop keys from Markdown, so
  // a project copy that omits those pages is not a project a refresh can run in.
  for (const relative of ["stage-boxes.md", "items", "monsters"]) {
    await cp(
      join(PROJECT_ROOT, "preferences/taskbarhero", relative),
      join(taskbarHeroRoot, relative),
      { recursive: true },
    );
  }
  await cp(RAW_DATA_ROOT, join(taskbarHeroRoot, "raw-data"), {
    recursive: true,
  });
  return projectRoot;
}

async function createCanonicalStage(projectRoot: string): Promise<string> {
  const rawDataRoot = join(projectRoot, "preferences/taskbarhero/raw-data");
  const staged = await mkdtemp(join(rawDataRoot, ".discordhero-raw-stage-"));
  await cp(await currentRawSource(rawDataRoot), staged, { recursive: true });
  return staged;
}

async function prepareOldAndNewVersions(projectRoot: string): Promise<{
  rawDataRoot: string;
  staged: string;
  oldPointer: string;
  newPointer: string;
}> {
  const rawDataRoot = join(projectRoot, "preferences/taskbarhero/raw-data");
  const canonical = await currentRawSource(rawDataRoot);
  const oldPointer =
    "versions/old-8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1";
  const newPointer =
    "versions/8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1";
  const oldVersion = join(rawDataRoot, oldPointer);
  await cp(canonical, oldVersion, { recursive: true });
  const temporaryLink = join(rawDataRoot, ".discordhero-current-test-link");
  const temporaryVersion = join(
    rawDataRoot,
    ".discordhero-current-test-version",
  );
  await symlink(oldPointer, temporaryLink);
  await writeFile(temporaryVersion, `${oldPointer}\n`, "utf8");
  await rename(temporaryLink, join(rawDataRoot, "current"));
  await rename(temporaryVersion, join(rawDataRoot, CURRENT_VERSION_FILE));
  const staged = await mkdtemp(join(rawDataRoot, ".discordhero-raw-stage-"));
  await cp(oldVersion, staged, { recursive: true });
  await rm(canonical, { recursive: true });
  return { rawDataRoot, staged, oldPointer, newPointer };
}

function digest(bytes: string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function currentRecoveryArtifacts(
  rawDataRoot: string,
): Promise<string[]> {
  return (await readdir(rawDataRoot))
    .filter((name) => name.startsWith(".discordhero-current-"))
    .sort();
}

async function hardKillAfterCurrentLinkSwitch(
  projectRoot: string,
  staged: string,
): Promise<{ exitCode: number; stderr: string }> {
  const sourceRefreshUrl = new URL("./source-refresh.ts", import.meta.url).href;
  const script = `
    import { installValidatedRawSource } from ${JSON.stringify(sourceRefreshUrl)};
    await installValidatedRawSource(process.argv[1], process.argv[2], {
      onPromotionStep: async (step) => {
        if (step !== "switched-current-link") return;
        process.stdout.write("switched-current-link\\n");
        await new Promise(() => {});
      },
    });
  `;
  const child = Bun.spawn(
    [process.execPath, "-e", script, projectRoot, staged],
    {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let stdout = "";
  while (!stdout.includes("switched-current-link\n")) {
    const chunk = await reader.read();
    if (chunk.done) {
      const exitCode = await child.exited;
      const stderr = await new Response(child.stderr).text();
      throw new Error(
        `promotion subprocess exited ${exitCode} before the crash boundary: ${stderr}`,
      );
    }
    stdout += decoder.decode(chunk.value, { stream: true });
  }
  reader.releaseLock();
  child.kill(9);
  const exitCode = await child.exited;
  const stderr = await new Response(child.stderr).text();
  return { exitCode, stderr };
}

describe("structured TaskbarHero source", () => {
  test("resolves a checked-in current pointer to one immutable canonical version", async () => {
    const currentPath = join(RAW_DATA_ROOT, "current");
    const pointer = await readlink(currentPath).catch(() => null);

    expect(pointer).toMatch(
      /^versions\/8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1$/,
    );
    expect(
      await readFile(join(RAW_DATA_ROOT, CURRENT_VERSION_FILE), "utf8"),
    ).toBe(`${pointer}\n`);
    expect((await lstat(currentPath)).isSymbolicLink()).toBe(true);
    expect(await realpath(currentPath)).toBe(
      join(
        RAW_DATA_ROOT,
        "versions/8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1",
      ),
    );
  });

  test("preserves every raw dataset row without Markdown string coercion", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);

    expect(catalog.datasets).toHaveLength(45);
    expect(catalog.totals).toEqual({ datasets: 45, rows: 25_757 });

    for (const dataset of catalog.datasets) {
      const raw = JSON.parse(
        await readFile(
          join(await currentRawSource(), "datasets", `${dataset.name}.json`),
          "utf8",
        ),
      );
      expect(JSON.stringify(dataset.rows)).toBe(JSON.stringify(raw));
    }
  });

  test("uses the curated items schema instead of catalog-declared table columns", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const items = getDiscordHeroDataset(catalog, "items");

    expect(items.columns).toEqual([
      "id",
      "name",
      "grade",
      "type",
      "gear",
      "level",
      "icon",
      "affix",
      "slug",
      "deleted",
      "marketable",
    ]);
    expect(items.declaredColumns).toHaveLength(19);
    expect(items.rows).toHaveLength(5_944);
    expect(items.rows[0]).toEqual({
      id: 910011,
      name: { "en-US": "Normal Monster Box 1" },
      grade: "COMMON",
      type: "STAGEBOX",
      gear: null,
      level: null,
      icon: "/game/items/boxes/Item_910011.png",
      affix: null,
      slug: "normal-monster-box-1",
    });
  });

  test("keeps all six hero descriptions as real newlines and native JSON types", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const heroes = getDiscordHeroDataset(catalog, "heroes");

    expect(heroes.rows).toHaveLength(6);
    for (const row of heroes.rows) {
      const description = row.DescriptionKey_i18n;
      expect(typeof row.HeroKey).toBe("number");
      expect(typeof row.IsAvailable).toBe("boolean");
      expect(Array.isArray(row.attribute_keys)).toBe(true);
      expect(typeof description).toBe("object");
      expect((description as Record<string, string>)["en-US"]).toContain("\n");
      expect((description as Record<string, string>)["en-US"]).not.toContain(
        String.raw`\n`,
      );
    }
  });

  test("keeps exact structured skill null, number, array, and enrichment types", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const skills = getDiscordHeroDataset(catalog, "skills");
    const rawSkills = JSON.parse(
      await readFile(
        join(await currentRawSource(), "datasets/skills.json"),
        "utf8",
      ),
    );

    expect(skills.columns).toHaveLength(27);
    expect(skills.columns.slice(-2)).toEqual([
      "SkillNameKey_i18n",
      "SkillDescriptionKey_i18n",
    ]);
    expect(JSON.stringify(skills.rows)).toBe(JSON.stringify(rawSkills));
    expect(skills.rows[0]!.SkillNameKey).toBeNull();
    expect(typeof skills.rows[0]!.SkillKey).toBe("number");
    expect(Array.isArray(skills.rows[0]!.levels)).toBe(true);
  });
});

describe("monster semantic enrichment", () => {
  test("keeps 33 empty raw attacks untouched and exposes 33 separately locked enrichments", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const monsters = getDiscordHeroDataset(catalog, "monsters");
    const missing = monsters.rows.filter(
      (row) =>
        row.attack === undefined ||
        row.attack === null ||
        row.attacks === undefined ||
        row.attacks === null ||
        row.attackElements === undefined ||
        row.attackElements === null,
    );

    expect(monsters.rows).toHaveLength(61);
    expect(missing).toHaveLength(33);
    expect(catalog.semantic.monsterAttacks.provenance.sourceCount).toBe(61);
    expect(catalog.semantic.monsterAttacks.enrichments).toHaveLength(33);

    for (const rawMonster of missing) {
      expect(rawMonster.attack ?? null).toBeNull();
      const enrichment = getMonsterAttackEnrichment(
        catalog,
        rawMonster.MonsterKey as number,
      );
      expect(enrichment.attack).not.toBeNull();
      expect(enrichment.attacks.length).toBeGreaterThan(0);
      expect(enrichment.attackElements.length).toBeGreaterThan(0);
    }
  });
});

describe("source and artifact locks", () => {
  test("leases a refresh stage before the first network request", async () => {
    const projectRoot = await createProjectCopy();
    const rawDataRoot = join(projectRoot, "preferences/taskbarhero/raw-data");
    let leasePresentAtFirstRequest: boolean | undefined;
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        if (leasePresentAtFirstRequest === undefined) {
          const stageName = (await readdir(rawDataRoot)).find((name) =>
            name.startsWith(".discordhero-raw-stage-"),
          );
          leasePresentAtFirstRequest =
            stageName !== undefined &&
            (await readFile(
              join(rawDataRoot, stageName, ".discordhero-stage-lease.json"),
              "utf8",
            )
              .then(() => true)
              .catch(() => false));
        }
        return new Response("injected download failure", { status: 503 });
      },
    });

    try {
      await expect(
        refreshDiscordHeroRawSource(projectRoot, {
          sourceOrigin: server.url.origin,
        }),
      ).rejects.toThrow("fetch failed");
      expect(leasePresentAtFirstRequest).toBe(true);
    } finally {
      server.stop(true);
    }
  });

  test("rejects a raw row tamper even when its JSON remains structurally valid", async () => {
    const rawDataRoot = await copyRawData();
    const heroesPath = join(
      await currentRawSource(rawDataRoot),
      "datasets/heroes.json",
    );
    const heroes = JSON.parse(await readFile(heroesPath, "utf8"));
    heroes[0].AttackDamage = 99_999;
    await writeFile(heroesPath, JSON.stringify(heroes), "utf8");

    await expect(
      compileDiscordHeroCatalog(PROJECT_ROOT, { rawDataRoot }),
    ).rejects.toThrow("heroes raw SHA-256");
  });

  test("rejects a compensating per-dataset cardinality shift with unchanged total rows", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const shifted = structuredClone(catalog) as DeepMutable<typeof catalog>;
    const attributes = shifted.datasets.find(
      (dataset) => dataset.name === "attributes",
    )!;
    const buffs = shifted.datasets.find((dataset) => dataset.name === "buffs")!;
    buffs.rows.push(attributes.rows.pop()!);
    shifted.provenance.compiledSha256 =
      computeDiscordHeroCatalogPayloadSha256(shifted);

    expect(() => validateDiscordHeroCatalog(shifted)).toThrow(
      "attributes must contain 132 rows",
    );
  });

  test("rejects artifact row tamper after the attacker recomputes its self-hash", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);
    const tampered = structuredClone(catalog) as DeepMutable<typeof catalog>;
    tampered.datasets.find(
      (dataset) => dataset.name === "heroes",
    )!.rows[0]!.AttackDamage = 99_999;
    tampered.provenance.compiledSha256 =
      computeDiscordHeroCatalogPayloadSha256(tampered);

    expect(() => validateDiscordHeroCatalog(tampered)).toThrow(
      "pinned compiled payload",
    );

    const outputDirectory = await mkdtemp(
      join(tmpdir(), "discordhero-tampered-"),
    );
    const outputPath = join(outputDirectory, "catalog.json");
    await writeFile(outputPath, `${JSON.stringify(tampered)}\n`, "utf8");
    await expect(loadDiscordHeroCatalog(outputPath)).rejects.toThrow(
      "pinned artifact file",
    );
  });

  test("does not replace an existing raw source when staged bytes fail validation", async () => {
    const projectRoot = await createProjectCopy();
    const rawDataRoot = join(projectRoot, "preferences/taskbarhero/raw-data");
    const staged = await createCanonicalStage(projectRoot);
    const destinationCatalogBefore = await readFile(
      join(await currentRawSource(rawDataRoot), "catalog.json"),
      "utf8",
    );
    const stagedMonstersPath = join(staged, "datasets/monsters.json");
    const stagedMonsters = JSON.parse(
      await readFile(stagedMonstersPath, "utf8"),
    );
    stagedMonsters[0].AttackDamage = 99_999;
    await writeFile(stagedMonstersPath, JSON.stringify(stagedMonsters), "utf8");

    await expect(
      installValidatedRawSource(projectRoot, staged),
    ).rejects.toThrow("monsters raw SHA-256");
    expect(
      await readFile(
        join(await currentRawSource(rawDataRoot), "catalog.json"),
        "utf8",
      ),
    ).toBe(destinationCatalogBefore);
  });

  test("rejects tampered monster details even when a direct caller regenerates the source lock", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, oldPointer } =
      await prepareOldAndNewVersions(projectRoot);
    const detailDirectory = join(staged, "monster-details");
    const detailName = (await readdir(detailDirectory)).sort()[0]!;
    const detailPath = join(detailDirectory, detailName);
    const detail = JSON.parse(await readFile(detailPath, "utf8"));
    detail.AttackDamage = 99_999;
    await writeFile(detailPath, `${JSON.stringify(detail)}\n`, "utf8");
    const attackerLock = await createDiscordHeroSourceLock(projectRoot, staged);
    await writeFile(
      join(staged, "source-lock.json"),
      serializeSourceLock(attackerLock),
      "utf8",
    );

    await expect(
      installValidatedRawSource(projectRoot, staged),
    ).rejects.toThrow("source lock SHA-256 does not match the reviewed pin");
    expect(await readlink(join(rawDataRoot, "current"))).toBe(oldPointer);
  });

  test("rejects a staged source outside the exact project raw-data scope", async () => {
    const outsideStage = await mkdtemp(
      join(tmpdir(), "discordhero-outside-stage-"),
    );
    await cp(await currentRawSource(), outsideStage, { recursive: true });
    const pointerBefore = await readlink(join(RAW_DATA_ROOT, "current"));

    await expect(
      installValidatedRawSource(PROJECT_ROOT, outsideStage),
    ).rejects.toThrow("direct child of preferences/taskbarhero/raw-data");
    expect(await readlink(join(RAW_DATA_ROOT, "current"))).toBe(pointerBefore);
  });
});

describe("atomic raw-source promotion", () => {
  test("rejects a current-version symlink even when its target contains a valid pointer", async () => {
    const rawDataRoot = await mkdtemp(
      join(tmpdir(), "discordhero-pointer-file-symlink-"),
    );
    const pointer = "versions/canonical";
    await mkdir(join(rawDataRoot, pointer), { recursive: true });
    await writeFile(
      join(rawDataRoot, "pointer-target"),
      `${pointer}\n`,
      "utf8",
    );
    await symlink("pointer-target", join(rawDataRoot, CURRENT_VERSION_FILE));

    await expect(resolveCurrentRawSource(rawDataRoot)).rejects.toThrow(
      "current-version must be a regular non-symlink file",
    );
  });

  test("rejects a version-entry symlink even when it aliases an in-scope directory", async () => {
    const rawDataRoot = await mkdtemp(
      join(tmpdir(), "discordhero-version-entry-symlink-"),
    );
    await mkdir(join(rawDataRoot, "versions/canonical"), { recursive: true });
    await symlink("canonical", join(rawDataRoot, "versions/alias"));
    await writeFile(
      join(rawDataRoot, CURRENT_VERSION_FILE),
      "versions/alias\n",
      "utf8",
    );

    await expect(resolveCurrentRawSource(rawDataRoot)).rejects.toThrow(
      "version entry must be a direct non-symlink directory",
    );
  });

  test("rejects malformed and traversal current-version values before target lookup", async () => {
    for (const pointerBytes of [
      "versions/canonical",
      "versions/../outside\n",
    ]) {
      const rawDataRoot = await mkdtemp(
        join(tmpdir(), "discordhero-invalid-current-version-"),
      );
      await writeFile(
        join(rawDataRoot, CURRENT_VERSION_FILE),
        pointerBytes,
        "utf8",
      );

      await expect(resolveCurrentRawSource(rawDataRoot)).rejects.toThrow(
        "current pointer is not an in-scope immutable version",
      );
    }
  });

  test("resolves the stable pointer while the compatibility link is transiently unreadable", async () => {
    const rawDataRoot = await mkdtemp(
      join(tmpdir(), "discordhero-pointer-interleaving-"),
    );
    const pointer = "versions/old";
    const versionDirectory = join(rawDataRoot, pointer);
    await mkdir(versionDirectory, { recursive: true });
    await writeFile(
      join(rawDataRoot, CURRENT_VERSION_FILE),
      `${pointer}\n`,
      "utf8",
    );
    await mkdir(join(rawDataRoot, "current"));

    await expect(resolveCurrentRawSource(rawDataRoot)).resolves.toBe(
      await realpath(versionDirectory),
    );
  });

  test("stable-pointer readers observe only complete generations during repeated link switches", async () => {
    const rawDataRoot = await mkdtemp(
      join(tmpdir(), "discordhero-pointer-stress-"),
    );
    const oldPointer = "versions/old";
    const newPointer = "versions/new";
    await mkdir(join(rawDataRoot, oldPointer), { recursive: true });
    await mkdir(join(rawDataRoot, newPointer), { recursive: true });
    await symlink(oldPointer, join(rawDataRoot, "current"));
    await writeFile(
      join(rawDataRoot, CURRENT_VERSION_FILE),
      `${oldPointer}\n`,
      "utf8",
    );
    const resolvedRawDataRoot = await realpath(rawDataRoot);
    const observations: string[] = [];
    const errors: unknown[] = [];
    let polling = true;

    const poll = async () => {
      while (polling) {
        try {
          observations.push(
            relative(
              resolvedRawDataRoot,
              await resolveCurrentRawSource(rawDataRoot),
            ),
          );
        } catch (error) {
          errors.push(error);
        }
      }
    };

    const pollers = Array.from({ length: 8 }, () => poll());
    for (let iteration = 0; iteration < 1_000; iteration += 1) {
      const pointer = iteration % 2 === 0 ? newPointer : oldPointer;
      const temporaryLink = join(
        rawDataRoot,
        `.discordhero-current-link-${iteration}`,
      );
      const temporaryVersion = join(
        rawDataRoot,
        `.discordhero-current-version-${iteration}`,
      );
      await symlink(pointer, temporaryLink);
      await writeFile(temporaryVersion, `${pointer}\n`, "utf8");
      await rename(temporaryLink, join(rawDataRoot, "current"));
      await rename(temporaryVersion, join(rawDataRoot, CURRENT_VERSION_FILE));
    }
    polling = false;
    await Promise.all(pollers);

    expect(errors).toEqual([]);
    expect(observations.length).toBeGreaterThan(1_000);
    expect(new Set(observations)).toEqual(new Set([oldPointer, newPointer]));
  });

  test("hard-kill recovery reconciles from authority before a failing network fetch without recovery artifacts", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, oldPointer, newPointer } =
      await prepareOldAndNewVersions(projectRoot);

    const crash = await hardKillAfterCurrentLinkSwitch(projectRoot, staged);

    expect(crash.exitCode).not.toBe(0);
    expect(crash.stderr).toBe("");
    expect(await readlink(join(rawDataRoot, "current"))).toBe(newPointer);
    expect(
      await readFile(join(rawDataRoot, CURRENT_VERSION_FILE), "utf8"),
    ).toBe(`${oldPointer}\n`);
    expect(
      relative(
        await realpath(rawDataRoot),
        await resolveCurrentRawSource(rawDataRoot),
      ),
    ).toBe(oldPointer);
    expect(
      (await currentRecoveryArtifacts(rawDataRoot)).length,
    ).toBeGreaterThan(0);

    for (const artifact of await currentRecoveryArtifacts(rawDataRoot)) {
      await rm(join(rawDataRoot, artifact), { force: true });
    }
    expect(await currentRecoveryArtifacts(rawDataRoot)).toEqual([]);

    let fetchCount = 0;
    let stateAtFetch:
      { link: string; pointer: string; artifacts: string[] } | undefined;
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        fetchCount += 1;
        stateAtFetch ??= {
          link: await readlink(join(rawDataRoot, "current")),
          pointer: await readFile(
            join(rawDataRoot, CURRENT_VERSION_FILE),
            "utf8",
          ),
          artifacts: await currentRecoveryArtifacts(rawDataRoot),
        };
        return new Response("deliberate fetch failure", { status: 503 });
      },
    });
    try {
      await expect(
        refreshDiscordHeroRawSource(projectRoot, {
          sourceOrigin: server.url.origin,
        }),
      ).rejects.toThrow("returned HTTP 503");
    } finally {
      server.stop(true);
    }

    expect(fetchCount).toBe(2);
    expect(stateAtFetch).toEqual({
      link: oldPointer,
      pointer: `${oldPointer}\n`,
      artifacts: [],
    });
    expect(await readlink(join(rawDataRoot, "current"))).toBe(oldPointer);
    expect(
      relative(
        await realpath(rawDataRoot),
        await resolveCurrentRawSource(rawDataRoot),
      ),
    ).toBe(oldPointer);
  }, 15_000);

  test("hard-kill recovery reconciles and cleans artifacts before a successful refresh", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, oldPointer, newPointer } =
      await prepareOldAndNewVersions(projectRoot);
    await cp(
      join(PROJECT_ROOT, "preferences/taskbarhero/monsters"),
      join(projectRoot, "preferences/taskbarhero/monsters"),
      { recursive: true },
    );
    const source = await resolveCurrentRawSource(rawDataRoot);
    const manifest = JSON.parse(
      await readFile(
        join(projectRoot, "preferences/taskbarhero/manifest.json"),
        "utf8",
      ),
    ) as { datasets: Array<{ data_url: string }> };
    const responseBytes = new Map<string, Uint8Array>();
    responseBytes.set(
      "/data/catalog.json",
      await readFile(join(source, "catalog.json")),
    );
    for (const dataset of manifest.datasets) {
      responseBytes.set(
        new URL(dataset.data_url, "http://source.invalid").pathname,
        await readFile(
          join(
            source,
            "datasets",
            basename(
              new URL(dataset.data_url, "http://source.invalid").pathname,
            ),
          ),
        ),
      );
    }

    const crash = await hardKillAfterCurrentLinkSwitch(projectRoot, staged);

    expect(crash.exitCode).not.toBe(0);
    expect(crash.stderr).toBe("");
    expect(await readlink(join(rawDataRoot, "current"))).toBe(newPointer);
    expect(
      await readFile(join(rawDataRoot, CURRENT_VERSION_FILE), "utf8"),
    ).toBe(`${oldPointer}\n`);
    expect(
      (await currentRecoveryArtifacts(rawDataRoot)).length,
    ).toBeGreaterThan(0);

    let stateAtFirstFetch:
      { link: string; pointer: string; artifacts: string[] } | undefined;
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        stateAtFirstFetch ??= {
          link: await readlink(join(rawDataRoot, "current")),
          pointer: await readFile(
            join(rawDataRoot, CURRENT_VERSION_FILE),
            "utf8",
          ),
          artifacts: await currentRecoveryArtifacts(rawDataRoot),
        };
        const bytes = responseBytes.get(new URL(request.url).pathname);
        return bytes === undefined
          ? new Response("not found", { status: 404 })
          : new Response(bytes);
      },
    });
    try {
      await refreshDiscordHeroRawSource(projectRoot, {
        sourceOrigin: server.url.origin,
      });
    } finally {
      server.stop(true);
    }

    expect(stateAtFirstFetch).toEqual({
      link: oldPointer,
      pointer: `${oldPointer}\n`,
      artifacts: [],
    });
    expect(await readlink(join(rawDataRoot, "current"))).toBe(newPointer);
    expect(
      await readFile(join(rawDataRoot, CURRENT_VERSION_FILE), "utf8"),
    ).toBe(`${newPointer}\n`);
    expect(await currentRecoveryArtifacts(rawDataRoot)).toEqual([]);
  }, 20_000);

  test("reconciliation failure aborts before fetch and preserves recovery artifacts", async () => {
    const projectRoot = await createProjectCopy();
    const rawDataRoot = join(projectRoot, "preferences/taskbarhero/raw-data");
    const existingRecovery = ".discordhero-current-existing-recovery";
    await rename(
      join(rawDataRoot, "current"),
      join(rawDataRoot, existingRecovery),
    );
    await mkdir(join(rawDataRoot, "current"));
    let fetchCount = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        fetchCount += 1;
        return new Response("must not fetch", { status: 503 });
      },
    });
    try {
      await expect(
        refreshDiscordHeroRawSource(projectRoot, {
          sourceOrigin: server.url.origin,
        }),
      ).rejects.toMatchObject({ code: "EISDIR" });
    } finally {
      server.stop(true);
    }

    expect(fetchCount).toBe(0);
    const recoveryArtifacts = await currentRecoveryArtifacts(rawDataRoot);
    expect(recoveryArtifacts).toContain(existingRecovery);
    expect(
      recoveryArtifacts.some((name) =>
        name.startsWith(".discordhero-current-reconcile-"),
      ),
    ).toBe(true);
  });

  test("collects an abandoned unleased stage while preserving a live downloader", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged } = await prepareOldAndNewVersions(projectRoot);
    const abandonedStage = await mkdtemp(
      join(rawDataRoot, ".discordhero-raw-stage-"),
    );
    const liveStage = await mkdtemp(
      join(rawDataRoot, ".discordhero-raw-stage-"),
    );
    await writeFile(
      join(liveStage, ".discordhero-stage-lease.json"),
      `${JSON.stringify({
        format: "discordhero-stage-lease/v1",
        hostname: hostname(),
        pid: process.pid,
        token: "live-downloader",
      })}\n`,
      "utf8",
    );
    const abandonedAt = new Date(Date.now() - 120_000);
    await utimes(abandonedStage, abandonedAt, abandonedAt);

    await installValidatedRawSource(projectRoot, staged);

    await expect(lstat(abandonedStage)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect((await lstat(liveStage)).isDirectory()).toBe(true);
  });

  test("serializes two direct installers without losing either validated stage", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, newPointer } =
      await prepareOldAndNewVersions(projectRoot);
    const secondStage = await mkdtemp(
      join(rawDataRoot, ".discordhero-raw-stage-"),
    );
    await cp(staged, secondStage, { recursive: true });

    const results = await Promise.allSettled([
      installValidatedRawSource(projectRoot, staged, {
        onPromotionStep: () => Bun.sleep(15),
      }),
      installValidatedRawSource(projectRoot, secondStage, {
        onPromotionStep: () => Bun.sleep(15),
      }),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    expect(await readlink(join(rawDataRoot, "current"))).toBe(newPointer);
  });

  test("collects a dead refresh stage and crash-left pointer under the promotion lock", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, oldPointer } =
      await prepareOldAndNewVersions(projectRoot);
    const staleStage = await mkdtemp(
      join(rawDataRoot, ".discordhero-raw-stage-"),
    );
    await writeFile(
      join(staleStage, ".discordhero-stage-lease.json"),
      `${JSON.stringify({
        format: "discordhero-stage-lease/v1",
        hostname: hostname(),
        pid: 2_147_483_647,
        token: "crash-left-owner",
      })}\n`,
      "utf8",
    );
    const stalePointer = join(rawDataRoot, ".discordhero-current-crash-left");
    await symlink(oldPointer, stalePointer);

    await installValidatedRawSource(projectRoot, staged);

    await expect(lstat(staleStage)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(stalePointer)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("concurrent readers observe only complete old or new immutable versions", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, oldPointer, newPointer } =
      await prepareOldAndNewVersions(projectRoot);
    const resolvedRawDataRoot = await realpath(rawDataRoot);
    const observations: string[] = [];
    const errors: unknown[] = [];
    let polling = true;

    const poll = async () => {
      while (polling) {
        try {
          const source = await resolveCurrentRawSource(rawDataRoot);
          const [catalogBytes, lockBytes] = await Promise.all([
            readFile(join(source, "catalog.json"), "utf8"),
            readFile(join(source, "source-lock.json"), "utf8"),
          ]);
          expect(digest(catalogBytes)).toBe(
            "186d90e9d1caf1be28d0480e760c082ea434a80588ed76f97c1b4f1fed2b9d12",
          );
          expect(digest(lockBytes)).toBe(
            "8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1",
          );
          observations.push(relative(resolvedRawDataRoot, source));
        } catch (error) {
          errors.push(error);
        }
      }
    };

    observations.push(await readlink(join(rawDataRoot, "current")));
    const pollers = Array.from({ length: 8 }, () => poll());
    await installValidatedRawSource(projectRoot, staged, {
      onPromotionStep: async () => {
        await Bun.sleep(5);
      },
    });
    observations.push(await readlink(join(rawDataRoot, "current")));
    polling = false;
    await Promise.all(pollers);

    expect(errors).toEqual([]);
    expect(observations.length).toBeGreaterThan(100);
    expect(new Set(observations)).toEqual(new Set([oldPointer, newPointer]));
  });

  for (const failureStep of [
    "validated-stage",
    "materialized-version",
    "prepared-pointer",
    "switched-current-link",
    "switched-pointer",
  ] as const satisfies readonly PromotionStep[]) {
    test(`leaves a complete source and cleans owned artifacts after failure at ${failureStep}`, async () => {
      const projectRoot = await createProjectCopy();
      const { rawDataRoot, staged, oldPointer, newPointer } =
        await prepareOldAndNewVersions(projectRoot);

      await expect(
        installValidatedRawSource(projectRoot, staged, {
          onPromotionStep: (step) => {
            if (step === failureStep) {
              throw new Error(`injected failure at ${step}`);
            }
          },
        }),
      ).rejects.toThrow(`injected failure at ${failureStep}`);

      const expectedPointer =
        failureStep === "switched-pointer" ? newPointer : oldPointer;
      expect(await readlink(join(rawDataRoot, "current"))).toBe(
        expectedPointer,
      );
      expect(
        await readFile(join(rawDataRoot, CURRENT_VERSION_FILE), "utf8"),
      ).toBe(`${expectedPointer}\n`);
      const source = await resolveCurrentRawSource(rawDataRoot);
      expect(relative(await realpath(rawDataRoot), source)).toBe(
        expectedPointer,
      );
      expect(digest(await readFile(join(source, "catalog.json"), "utf8"))).toBe(
        "186d90e9d1caf1be28d0480e760c082ea434a80588ed76f97c1b4f1fed2b9d12",
      );
      expect(
        digest(await readFile(join(source, "source-lock.json"), "utf8")),
      ).toBe(
        "8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1",
      );
      expect(
        (await readdir(rawDataRoot)).filter(
          (name) =>
            name.startsWith(".discordhero-raw-stage-") ||
            name.startsWith(".discordhero-current-"),
        ),
      ).toEqual([]);
    });
  }

  test("reuses a complete crash-left version and removes the new stage", async () => {
    const projectRoot = await createProjectCopy();
    const { rawDataRoot, staged, newPointer } =
      await prepareOldAndNewVersions(projectRoot);
    const crashLeftVersion = join(rawDataRoot, newPointer);
    await cp(staged, crashLeftVersion, { recursive: true });
    const crashLeasePath = join(
      crashLeftVersion,
      ".discordhero-stage-lease.json",
    );
    await writeFile(
      crashLeasePath,
      '{"format":"discordhero-stage-lease/v1","hostname":"crashed","pid":1,"token":"left-in-version"}\n',
      "utf8",
    );

    await installValidatedRawSource(projectRoot, staged);

    expect(await readlink(join(rawDataRoot, "current"))).toBe(newPointer);
    expect(await lstat(crashLeftVersion)).toBeTruthy();
    await expect(lstat(crashLeasePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(
      (await readdir(rawDataRoot)).filter((name) =>
        name.startsWith(".discordhero-raw-stage-"),
      ),
    ).toEqual([]);
  });
});

describe("deterministic writer and check mode", () => {
  test("supports three concurrent writers with unique temp files and exact final bytes", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "discordhero-writers-"),
    );
    const outputPath = join(outputDirectory, "catalog.json");

    await Promise.all([
      writeDiscordHeroCatalog(PROJECT_ROOT, outputPath),
      writeDiscordHeroCatalog(PROJECT_ROOT, outputPath),
      writeDiscordHeroCatalog(PROJECT_ROOT, outputPath),
    ]);

    await loadDiscordHeroCatalog(outputPath);
    expect(digest(await readFile(outputPath, "utf8"))).toBe(
      "2a046b2b0f5c1ddff451dddadf13a7b9c8d6d112b1c6455ccda59f2af9e879f2",
    );
    expect(
      (await readdir(outputDirectory)).filter(
        (name) => name !== "catalog.json",
      ),
    ).toEqual([]);
  });

  test("check mode is non-mutating for both valid and invalid artifacts", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "discordhero-check-"));
    const outputPath = join(outputDirectory, "catalog.json");
    await writeDiscordHeroCatalog(PROJECT_ROOT, outputPath);
    const validStat = await stat(outputPath);

    await checkDiscordHeroCatalog(PROJECT_ROOT, outputPath);
    expect((await stat(outputPath)).mtimeMs).toBe(validStat.mtimeMs);

    await writeFile(outputPath, '{"tampered":true}\n', "utf8");
    const tamperedBytes = await readFile(outputPath, "utf8");
    const tamperedStat = await stat(outputPath);
    await expect(
      checkDiscordHeroCatalog(PROJECT_ROOT, outputPath),
    ).rejects.toThrow("does not match generated catalog");
    expect(await readFile(outputPath, "utf8")).toBe(tamperedBytes);
    expect((await stat(outputPath)).mtimeMs).toBe(tamperedStat.mtimeMs);
  });
});

describe("immutable loaded catalog", () => {
  test("compiler API exposes recursively readonly catalog values", async () => {
    const catalog = await compileDiscordHeroCatalog(PROJECT_ROOT);

    expect(catalog.datasets[0]?.rows[0]).toBeDefined();
    if (false) {
      // @ts-expect-error Compiled catalog rows are recursively readonly.
      catalog.datasets[0]!.rows[0]!.HeroKey = 999;
      // @ts-expect-error Compiled catalog collections are recursively readonly.
      catalog.datasets.push(catalog.datasets[0]!);
    }
  });

  test("deep-freezes nested arrays, rows, and localized description objects", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "discordhero-frozen-"),
    );
    const outputPath = join(outputDirectory, "catalog.json");
    await writeDiscordHeroCatalog(PROJECT_ROOT, outputPath);
    const catalog = await loadDiscordHeroCatalog(outputPath);
    const heroes = getDiscordHeroDataset(catalog, "heroes");
    const knight = datasetRowToRecord(heroes, heroes.rows[0]!);
    const descriptions = knight.DescriptionKey_i18n as Readonly<
      Record<string, string>
    >;
    const original = descriptions["en-US"];

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.datasets)).toBe(true);
    expect(Object.isFrozen(heroes)).toBe(true);
    expect(Object.isFrozen(heroes.rows)).toBe(true);
    expect(Object.isFrozen(knight)).toBe(true);
    expect(Object.isFrozen(descriptions)).toBe(true);

    expect(() => {
      (descriptions as Record<string, string>)["en-US"] = "tampered";
    }).toThrow(TypeError);
    expect(descriptions["en-US"]).toBe(original);

    if (false) {
      // @ts-expect-error Loaded catalogs expose recursively readonly values.
      catalog.datasets[0]!.rows[0]!.HeroKey = 999;
    }
  });
});

// ---------------------------------------------------------------------------
// Stage Box drop-key mapping
// ---------------------------------------------------------------------------

/**
 * Re-derives the StageBox mapping straight from the pinned Markdown. It shares
 * no code with the production extractor on purpose: a test that calls the
 * implementation it is checking proves only that the implementation agrees
 * with itself.
 */
type StageBoxOracleMapping = {
  boxKind: "NORMAL" | "STAGE_BOSS" | "ACT_BOSS";
  itemId: number;
  dropKey: number;
  sourcePath: string;
  itemRecordSha256: string;
  detailRecordSha256: string;
};

type StageBoxOracle = {
  inventory: { itemId: number; sourcePath: string; slug: string }[];
  mappings: StageBoxOracleMapping[];
  inventoryAggregateSha256: string;
  mappingAggregateSha256: string;
  artifactBytes: string;
  artifactSha256: string;
  uniqueDropRows: Record<string, unknown>[];
  perPageDropRowCount: number;
};

const STAGE_BOX_INVENTORY_ROW =
  /^\| \[([^\]]+)\]\((items\/[^)]+\.md)\) \| ([^|]+?) \| ([1-9]\d*) \|$/gm;

const STAGE_BOX_KIND_PREFIXES = [
  ["Normal Monster Box", "NORMAL"],
  ["Stage Boss Box", "STAGE_BOSS"],
  ["Act Boss Box", "ACT_BOSS"],
] as const;

function readFencedAppendix(page: string, dataset: string): string {
  const heading = "### `" + dataset + "`";
  const headingAt = page.indexOf(heading);
  if (headingAt === -1) throw new Error(`missing ${dataset} appendix`);
  if (page.indexOf(heading, headingAt + 1) !== -1) {
    throw new Error(`duplicate ${dataset} appendix`);
  }
  const fenceAt = page.indexOf("```json", headingAt);
  if (fenceAt === -1) throw new Error(`unfenced ${dataset} appendix`);
  const start = page.indexOf("\n", fenceAt) + 1;
  const end = page.indexOf("```", start);
  if (end === -1) throw new Error(`unterminated ${dataset} appendix`);
  return page.slice(start, end).replace(/\n$/, "");
}

let stageBoxOraclePromise: Promise<StageBoxOracle> | undefined;

async function readStageBoxOracle(): Promise<StageBoxOracle> {
  stageBoxOraclePromise ??= (async () => {
    const prefs = join(PROJECT_ROOT, "preferences/taskbarhero");
    const inventorySource = await readFile(
      join(prefs, "stage-boxes.md"),
      "utf8",
    );
    const inventory = [
      ...inventorySource.matchAll(STAGE_BOX_INVENTORY_ROW),
    ].map((match) => ({
      itemId: Number(match[4]),
      sourcePath: match[2]!,
      slug: match[3]!.trim(),
    }));

    const mappings: StageBoxOracleMapping[] = [];
    for (const row of inventory) {
      const page = await readFile(join(prefs, row.sourcePath), "utf8");
      const itemText = readFencedAppendix(page, "/data/items.json");
      const detailText = readFencedAppendix(page, "/data/items_detail.json");
      const item = JSON.parse(itemText) as Record<string, unknown> & {
        id: number;
        slug: string;
        type: string;
        name: Record<string, string>;
      };
      const detail = JSON.parse(detailText) as { dropKey: number };

      // 41 pages carry the nine base keys; the 18 retired boxes add `deleted`.
      const baseKeys = [
        "affix",
        "gear",
        "grade",
        "icon",
        "id",
        "level",
        "name",
        "slug",
        "type",
      ];
      const itemKeys = Object.keys(item);
      expect(itemKeys.filter((key) => key !== "deleted")).toEqual(baseKeys);
      expect(Object.keys(detail)).toEqual([
        "desc",
        "dropKey",
        "stats",
        "synthType",
        "uniqueMod",
      ]);
      expect(item.type).toBe("STAGEBOX");
      expect(item.id).toBe(row.itemId);
      expect(item.slug).toBe(row.slug);
      expect(Number.isSafeInteger(detail.dropKey)).toBe(true);
      expect(detail.dropKey).toBeGreaterThan(0);

      const name = item.name["en-US"]!;
      const kind = STAGE_BOX_KIND_PREFIXES.find(([prefix]) =>
        name.startsWith(prefix),
      );
      if (kind === undefined) throw new Error(`unclassified box ${name}`);

      mappings.push({
        boxKind: kind[1],
        itemId: row.itemId,
        dropKey: detail.dropKey,
        sourcePath: row.sourcePath,
        itemRecordSha256: digest(JSON.stringify(item)),
        detailRecordSha256: digest(JSON.stringify(detail)),
      });
    }

    const inventoryAggregateSha256 = digest(JSON.stringify(inventory));
    const sorted = mappings.toSorted(
      (left, right) => left.itemId - right.itemId,
    );
    const artifactBytes = `${JSON.stringify(
      {
        format: "discordhero-stage-box-drop-keys/v1",
        inventoryAggregateSha256,
        mappings: sorted,
      },
      null,
      2,
    )}\n`;

    const rawRoot = await currentRawSource();
    const drops = JSON.parse(
      await readFile(join(rawRoot, "datasets/drops.json"), "utf8"),
    ) as Record<string, unknown>[];
    const dropKeys = new Set(mappings.map((row) => row.dropKey));

    return {
      inventory,
      mappings,
      inventoryAggregateSha256,
      mappingAggregateSha256: digest(JSON.stringify(sorted)),
      artifactBytes,
      artifactSha256: digest(artifactBytes),
      uniqueDropRows: drops.filter((row) =>
        dropKeys.has(row.DropKey as number),
      ),
      perPageDropRowCount: mappings.reduce(
        (total, mapping) =>
          total + drops.filter((row) => row.DropKey === mapping.dropKey).length,
        0,
      ),
    };
  })();
  return stageBoxOraclePromise;
}

function countBy<T>(rows: readonly T[], key: (row: T) => unknown) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const bucket = String(key(row));
    totals[bucket] = (totals[bucket] ?? 0) + 1;
    return totals;
  }, {});
}

describe("Stage Box drop-key source facts", () => {
  test("re-derives all 59 mappings and kills arithmetic DropKey derivation", async () => {
    const oracle = await readStageBoxOracle();

    expect(oracle.inventory).toHaveLength(59);
    expect(oracle.mappings).toHaveLength(59);
    expect(new Set(oracle.mappings.map((row) => row.itemId)).size).toBe(59);
    expect(new Set(oracle.mappings.map((row) => row.sourcePath)).size).toBe(59);

    // The falsifier for computing DropKey from itemId: 18 retired boxes keep
    // their own id while pointing at a surviving box's table.
    expect(
      oracle.mappings
        .filter((row) => row.dropKey !== row.itemId * 10 + 1)
        .map(({ itemId, dropKey }) => [itemId, dropKey]),
    ).toEqual([
      [910251, 9102011],
      [910351, 9103011],
      [910451, 9104011],
      [910551, 9105011],
      [910601, 9105011],
      [910701, 9106511],
      [910751, 9106511],
      [910851, 9108011],
      [910901, 9108011],
      [920251, 9202011],
      [920351, 9203011],
      [920451, 9204011],
      [920551, 9205011],
      [920601, 9205011],
      [920701, 9206511],
      [920751, 9206511],
      [920851, 9208011],
      [920901, 9208011],
    ]);
  });

  test("pins the exact aggregate bytes and 59/41/19/29/11 census", async () => {
    const oracle = await readStageBoxOracle();

    expect(new Set(oracle.mappings.map((row) => row.dropKey)).size).toBe(41);
    expect(countBy(oracle.mappings, (row) => row.boxKind)).toEqual({
      NORMAL: 19,
      STAGE_BOSS: 29,
      ACT_BOSS: 11,
    });
    expect(oracle.inventoryAggregateSha256).toBe(
      "cb107ebc086f776e2d792bbc24be52940cd9dccbdb47bdfcb62ba54dfb8523a8",
    );
    expect(oracle.mappingAggregateSha256).toBe(
      "3210ffc48bc73dad29f057e6fd45458d9d9cf2f2076be2c6be996e9c7b0d5845",
    );
    expect(Buffer.byteLength(oracle.artifactBytes)).toBe(19_897);
    expect(Buffer.byteLength(oracle.artifactBytes)).toBeLessThanOrEqual(
      64 * 1024,
    );
    expect(oracle.artifactSha256).toBe(
      "5abd1eb6538d2ba59052845c2be376c67a79bf47393de2f6b8ceca17fb668ce9",
    );
  });

  test("joins 2,428 unique rows and 3,975 per-page rows with exact reward counts", async () => {
    const oracle = await readStageBoxOracle();
    const rawRoot = await currentRawSource();
    const itemGroups = JSON.parse(
      await readFile(join(rawRoot, "datasets/item_groups.json"), "utf8"),
    ) as { ItemGroupKey: number }[];

    expect(oracle.uniqueDropRows).toHaveLength(2_428);
    expect(oracle.perPageDropRowCount).toBe(3_975);
    expect(countBy(oracle.uniqueDropRows, (row) => row.DropType)).toEqual({
      EachDropOneWeight_DLCVariant: 2_418,
      EachDropOneWeight: 10,
    });
    expect(countBy(oracle.uniqueDropRows, (row) => row.REWARDTYPE)).toEqual({
      ITEMGROUP: 2_282,
      ITEM: 146,
    });
    expect(
      countBy(oracle.uniqueDropRows, (row) => row.HeroKeyCondition),
    ).toEqual({ null: 956, 0: 496, 501: 488, 601: 488 });

    const weights = oracle.uniqueDropRows.map((row) => row.Weight as number);
    expect({
      positive: weights.filter((weight) => weight > 0).length,
      zero: weights.filter((weight) => weight === 0).length,
      negative: weights.filter((weight) => weight < 0).length,
    }).toEqual({ positive: 2_203, zero: 225, negative: 0 });

    const groupKeys = new Set(
      oracle.uniqueDropRows
        .filter((row) => row.REWARDTYPE === "ITEMGROUP")
        .map((row) => row.RewardKey as number),
    );
    expect(groupKeys.size).toBe(561);
    expect(
      itemGroups.filter((row) => groupKeys.has(row.ItemGroupKey)),
    ).toHaveLength(1_171);
    expect(
      new Set(
        oracle.uniqueDropRows
          .filter((row) => row.REWARDTYPE === "ITEM")
          .map((row) => row.RewardKey as number),
      ).size,
    ).toBe(23);
  });

  test("pins all 12 Act Boss stage costs and four Soulstone identities", async () => {
    const rawRoot = await currentRawSource();
    const stages = JSON.parse(
      await readFile(join(rawRoot, "datasets/stages.json"), "utf8"),
    ) as Record<string, unknown>[];
    const actBossStages = stages.filter((row) => row.SoulstoneItemKey !== null);

    expect(actBossStages).toHaveLength(12);
    expect(new Set(actBossStages.map((row) => row.BossDropItemKey)).size).toBe(
      11,
    );
    expect(countBy(actBossStages, (row) => row.STAGEDIFFICULITY)).toEqual({
      NORMAL: 3,
      NIGHTMARE: 3,
      HELL: 3,
      TORMENT: 3,
    });

    const soulstoneByDifficulty: Record<string, number> = {
      NORMAL: 190_001,
      NIGHTMARE: 190_002,
      HELL: 190_003,
      TORMENT: 190_004,
    };
    for (const row of actBossStages) {
      expect(row.SoulstoneAmount).toBe(1);
      expect(row.SoulstoneItemKey).toBe(
        soulstoneByDifficulty[row.STAGEDIFFICULITY as string],
      );
    }
  });
});

describe("Stage Box drop-key production contract", () => {
  test("records the aggregate in the source lock beside monster details", async () => {
    const oracle = await readStageBoxOracle();
    const projectRoot = await createProjectCopy();
    const staged = await createCanonicalStage(projectRoot);
    await writeFile(
      join(staged, "stage-box-drop-keys.json"),
      oracle.artifactBytes,
      "utf8",
    );

    const sourceLock = (await createDiscordHeroSourceLock(
      projectRoot,
      staged,
    )) as unknown as {
      stageBoxDropKeys?: {
        path: string;
        count: number;
        distinctDropKeyCount: number;
        inventoryAggregateSha256: string;
        mappingAggregateSha256: string;
        sha256: string;
      };
    };

    expect(sourceLock.stageBoxDropKeys).toEqual({
      path: "stage-box-drop-keys.json",
      count: 59,
      distinctDropKeyCount: 41,
      inventoryAggregateSha256: oracle.inventoryAggregateSha256,
      mappingAggregateSha256: oracle.mappingAggregateSha256,
      sha256: oracle.artifactSha256,
    });
    // The lock must serialize the new field last, after monsterDetails.
    const serialized = serializeSourceLock(sourceLock as never);
    expect(serialized.indexOf("stageBoxDropKeys")).toBeGreaterThan(
      serialized.indexOf("monsterDetails"),
    );
  });

  test("compiles the mapping and its provenance into the catalog semantic", async () => {
    const oracle = await readStageBoxOracle();
    const catalog = (await loadDiscordHeroCatalog()) as unknown as {
      semantic: {
        stageBoxDropKeys?: {
          provenance: {
            sourceCount: number;
            distinctDropKeyCount: number;
            inventoryAggregateSha256: string;
            sourceAggregateSha256: string;
            sourceArtifactSha256: string;
          };
          mappings: StageBoxOracleMapping[];
        };
      };
    };

    const semantic = catalog.semantic.stageBoxDropKeys;
    expect(semantic).toBeDefined();
    expect(semantic!.provenance).toEqual({
      sourceCount: 59,
      distinctDropKeyCount: 41,
      inventoryAggregateSha256: oracle.inventoryAggregateSha256,
      sourceAggregateSha256: oracle.mappingAggregateSha256,
      sourceArtifactSha256: oracle.artifactSha256,
    });
    expect(semantic!.mappings).toEqual(
      oracle.mappings.toSorted((left, right) => left.itemId - right.itemId),
    );
  });

  test("returns a detached deeply frozen mapping or a plain Error", async () => {
    const oracle = await readStageBoxOracle();
    const loader = (await import("./loader")) as unknown as {
      getStageBoxDropKeyMapping?: (
        catalog: unknown,
        itemId: number,
      ) => StageBoxOracleMapping;
    };
    expect(typeof loader.getStageBoxDropKeyMapping).toBe("function");

    const catalog = await loadDiscordHeroCatalog();
    const first = oracle.mappings[0]!;
    const mapping = loader.getStageBoxDropKeyMapping!(catalog, first.itemId);
    expect(mapping).toEqual(first);
    expect(Object.isFrozen(mapping)).toBe(true);

    // Same input, same value, and never the caller's to mutate.
    expect(loader.getStageBoxDropKeyMapping!(catalog, first.itemId)).toEqual(
      mapping,
    );
    expect(() => {
      (mapping as { dropKey: number }).dropKey = 1;
    }).toThrow(TypeError);

    for (const forged of [0, -1, 1.5, Number.NaN, 999_999_999]) {
      let thrown: unknown;
      try {
        loader.getStageBoxDropKeyMapping!(catalog, forged);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(Object.getPrototypeOf(thrown)).toBe(Error.prototype);
    }
  });
});
