# DiscordHero StageBox Deterministic T2 Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile the 59 authoritative StageBox item-to-DropKey mappings into the hash-pinned DiscordHero catalog and expose a frozen loader lookup, without implementing chest opening or changing gameplay state.

**Architecture:** Refresh extracts one immutable `stage-box-drop-keys.json` side artifact from the 59 pinned Markdown pages before source-lock creation. An explicit migration bridge validates the installed authority as either the exact reviewed v1 generation or the exact reviewed v2 generation, while every staged/materialized candidate must be the reviewed v2 generation. The compiler validates the v2 artifact bidirectionally against `items`, joins its 41 DropKeys through existing `drops`/`item_groups`/`items`/`heroes`/`stages` datasets, and emits only mapping plus provenance into catalog v3; raw reward rows remain in their existing datasets. Refresh builds and validates the target catalog from staged v2 bytes before a journaled source-plus-catalog publication, and any interrupted publication rolls both authorities back to the prior pair. The loader performs the same pinned-file validation and deep-freeze as today, then uses a linear search over 59 records.

**Tech Stack:** Bun 1.3.x, TypeScript 5.9, `bun:test`, Node `crypto` and `fs/promises`, JSON artifacts, Prettier 3.9.6.

## Global Constraints

- The checkout is Git-managed as of 2026-08-04. Per-task commits replace the hand-rolled manifest receipts this plan was written around: `git status --porcelain` and `git diff --stat <baseline>..HEAD` give the same before/after accounting, including symlink targets, with nothing bespoke to keep correct. The exact SHA-256 baseline below still gates the start.
- Strict RED first: Task 2 adds and runs every StageBox contract test before Tasks 3-7 change production or generated artifacts. Preserve the complete RED command/output.
- Authored scope is exactly `src/discord-hero/catalog/source-refresh.ts`, `src/discord-hero/catalog/compiler.ts`, `src/discord-hero/catalog/loader.ts`, `src/discord-hero/catalog/catalog.test.ts`, and `scripts/discordhero-catalog.ts`.
- Generated scope is exactly `assets/discordhero/catalog.json`, `preferences/taskbarhero/raw-data/current-version`, the `preferences/taskbarhero/raw-data/current` symlink, and one new immutable `preferences/taskbarhero/raw-data/versions/91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4/`.
- Keep `src/discord-hero/catalog/indexes.ts`, `src/discord-hero/catalog/indexes.test.ts`, every source Markdown page, the manifest, `package.json`, `bun.lock`, the existing raw-source version, community artifacts, domain/use-case/UI/command/repository/PlayerState code, starter/formation code, and critical-loop runtime code frozen.
- Do not add a package, helper file, utility module, index/cache, standalone compiler/loader, artifact command, chest-opening use case, reward selection, RNG, debit/grant, custom ID, Discord control, or live-parity claim.
- `DropKey` is captured from `/data/items_detail.json`; it is never calculated from `itemId`.
- Pin both different row counts: 2,428 raw drop rows across 41 unique DropKeys, and 3,975 per-page expansion rows obtained by joining each of the 59 mappings separately and counting reused tables again.
- Preserve 45 datasets, 25,757 raw rows, 61 monster details, all current dataset/manifest/monster pins, and raw reward rows byte-for-byte.
- All failure paths throw a plain namespaced `Error`, preserve or restore the prior `current` symlink, `current-version`, and compiled catalog as one authority pair, and leave no owned stage/current/catalog/journal residue.
- Keep the v1-installed/v2-target migration bridge while the preserved v1 version is a recovery authority. No code path may validate a staged v1 generation or an unpinned hybrid.
- All 22 required mutation categories (50 explicitly named atomic variants) run only in isolated temporary checkout copies; canonical scoped and complete frozen manifests must match before and after every variant and the whole sweep.
- A fresh independent read-only reviewer, not the implementing context, gives the final verdict.

---

## Baseline and Exact Target Locks

Execution must start by rerunning the following command. Any mismatch means another lane changed a file in this plan's authority; stop and reconcile instead of overwriting it.

```bash
shasum -a 256 \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/loader.ts \
  src/discord-hero/catalog/indexes.ts \
  src/discord-hero/catalog/catalog.test.ts \
  src/discord-hero/catalog/indexes.test.ts \
  scripts/discordhero-catalog.ts \
  assets/discordhero/catalog.json \
  preferences/taskbarhero/raw-data/current/source-lock.json \
  preferences/taskbarhero/stage-boxes.md \
  package.json bun.lock
```

Expected baseline:

```text
3ccbf90f03622272425fc1aa67dac83286e365ba086d3e366f7d69ee8c542776  src/discord-hero/catalog/compiler.ts
e935740c91c66e2820e44a7f305e757659d26351556e98dfb9766df0eadd20da  src/discord-hero/catalog/source-refresh.ts
733b8093ae483ce55f53e4dec833e85370b93a5ff7e8a1de4612fedd5f9aa19b  src/discord-hero/catalog/loader.ts
a81916328de47f3e309f629c830ef0ae79f8c8ff73c9b13eb78c53c80d4668b7  src/discord-hero/catalog/indexes.ts
f251864233d442a5f7e800ca526805837bf5845f65affb5cdd89645c35ff5065  src/discord-hero/catalog/catalog.test.ts
0ade3c4bff3cdfae35e8f17ba610dbdad7003a46e9b727370da0e84dd0b23d68  src/discord-hero/catalog/indexes.test.ts
201b908d660e045056d6b12c2098a8da269414da09ea6f71ca3244e812019d50  scripts/discordhero-catalog.ts
2a046b2b0f5c1ddff451dddadf13a7b9c8d6d112b1c6455ccda59f2af9e879f2  assets/discordhero/catalog.json
8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1  preferences/taskbarhero/raw-data/current/source-lock.json
593600dd77bff7a789084db131e385292671ad57629c7313be0525991141b7f7  preferences/taskbarhero/stage-boxes.md
e08ae935f04ded0b9c92c1711f0d53fb5a9267aa6ee8d6d35d17221f850c9da0  package.json
95efcff7454e1e55d066f69c5be51a3b76da0cd042ba69691e01b25ace62bc2c  bun.lock
```

The architecture report's older loader/index hashes are observation history, not this lane's baseline. The hashes above include current loader authority hardening and index work and are authoritative for this plan.

Exact independently regenerated StageBox and target artifact locks:

```text
inventory aggregate                         cb107ebc086f776e2d792bbc24be52940cd9dccbdb47bdfcb62ba54dfb8523a8
sorted mapping aggregate                    3210ffc48bc73dad29f057e6fd45458d9d9cf2f2076be2c6be996e9c7b0d5845
stage-box-drop-keys.json (19,897 bytes)      5abd1eb6538d2ba59052845c2be376c67a79bf47393de2f6b8ceca17fb668ce9
source-lock v2 (40,992 bytes)                91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4
compiled catalog v3 payload                  7e39f04f3657f24bf6576202d2fd497c6c615a5d68d5c20c75e7c8b1fd15d44d
compiled catalog v3 file (8,599,055 bytes)   182d2b5a5c1b5c8c64bd92997f3a2d211c17f55d6e6934da9189b952286f50d7
```

These target SHA values are valid only with the exact property order and serialization defined below: source-lock fields end with `monsterDetails`, then `stageBoxDropKeys`; catalog semantic fields are `monsterAttacks`, then `stageBoxDropKeys`; pretty JSON uses two spaces and one trailing newline; compiled JSON is compact with one trailing newline. Tests independently reconstruct all values from source rather than accepting these constants as evidence.

## File and Interface Map

- `src/discord-hero/catalog/source-refresh.ts:53-63,208-313,347-692`: securely capture `stage-boxes.md` and its 59 item pages once, validate exact appendices, serialize `stage-box-drop-keys.json` before `source-lock.json`, and own the recoverable source-plus-catalog publication.
- `src/discord-hero/catalog/compiler.ts:16-30,164-251,508-703,827-1088`: define v1-installed/v2-target validation policies and pins/types, bounded-read the aggregate, construct source-lock v2, validate all reward relationships and Act Boss costs, compile against an explicit staged raw root, emit catalog v3, and validate payload/file pins.
- `src/discord-hero/catalog/loader.ts:19-136`: export the loaded mapping type and `getStageBoxDropKeyMapping`.
- `src/discord-hero/catalog/catalog.test.ts:1-1091`: own the independent source oracle, all RED contracts, attack fixtures, runtime assertions, and atomicity assertions.
- `scripts/discordhero-catalog.ts:1-59`: keep the existing three modes; make `--refresh` call the single source-plus-catalog publication and print the StageBox artifact SHA.
- `assets/discordhero/catalog.json`: generated catalog v3 only.
- `preferences/taskbarhero/raw-data/versions/91740273.../stage-box-drop-keys.json`: generated aggregate only.
- `preferences/taskbarhero/raw-data/versions/91740273.../source-lock.json`: generated v2 lock only.

Exact produced interfaces:

```ts
export type StageBoxKind = "NORMAL" | "STAGE_BOSS" | "ACT_BOSS";

export type StageBoxDropKeyMapping = DeepReadonly<{
  boxKind: StageBoxKind;
  itemId: number;
  dropKey: number;
  sourcePath: string;
  itemRecordSha256: string;
  detailRecordSha256: string;
}>;

export type SourceLockStageBoxDropKeys = DeepReadonly<{
  path: "stage-box-drop-keys.json";
  count: 59;
  distinctDropKeyCount: 41;
  inventoryAggregateSha256: string;
  mappingAggregateSha256: string;
  sha256: string;
}>;

export type LoadedStageBoxDropKeyMapping = DeepReadonly<StageBoxDropKeyMapping>;

export function getStageBoxDropKeyMapping(
  catalog: LoadedDiscordHeroCatalog,
  itemId: number,
): LoadedStageBoxDropKeyMapping;
```

The exact aggregate shape is:

```ts
{
  format: "discordhero-stage-box-drop-keys/v1";
  inventoryAggregateSha256: string;
  mappings: StageBoxDropKeyMapping[];
}
```

The exact source-lock addition is:

```ts
stageBoxDropKeys: {
  path: "stage-box-drop-keys.json";
  count: 59;
  distinctDropKeyCount: 41;
  inventoryAggregateSha256: string;
  mappingAggregateSha256: string;
  sha256: string;
}
```

The exact compiled addition is:

```ts
semantic: {
  monsterAttacks: ExistingMonsterAttackSemantic;
  stageBoxDropKeys: {
    provenance: {
      sourceCount: 59;
      distinctDropKeyCount: 41;
      inventoryAggregateSha256: string;
      sourceAggregateSha256: string;
      sourceArtifactSha256: string;
    };
    mappings: StageBoxDropKeyMapping[];
  };
}
```

### Task 1: Freeze the No-Git Baseline and Source Oracle

**Files:**

- Read: all baseline paths above
- Read frozen code: every file under `src/discord-hero/**` except the four authored catalog files, every `src/commands/discordhero*.ts`, `scripts/discordhero-achievements.ts`, `scripts/discordhero-community-market.ts`, `scripts/discordhero-community-content.ts`, and `scripts/docker-artifact-gate.test.ts`
- Read frozen docs/raw/community: every `preferences/taskbarhero/**/*.md`, `preferences/taskbarhero/manifest.json`, the complete `preferences/taskbarhero/raw-data/versions/8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1/**`, `assets/discordhero/community-achievements.json`, `assets/discordhero/community-market.json`, `assets/discordhero/community-content.json`, `package.json`, and `bun.lock`
- Create outside repository: `/tmp/discordhero-stagebox-t2-baseline/`

**Interfaces:**

- Consumes: current checkout bytes and the pinned raw source
- Produces: immutable complete frozen/scoped/authority manifests, including file-type and symlink-target receipts, and an independent oracle receipt; no repository change

- [ ] **Step 1: Capture the exact scoped/frozen baseline outside the checkout**

Create one outside-repository manifest program that uses `lstat`, never follows a
symlink, rejects unsupported node types, sorts repository-relative POSIX paths by
raw code point, and emits one JSON line per node:

```ts
type ManifestReceipt =
  | { path: string; type: "file"; size: number; sha256: string }
  | { path: string; type: "symlink"; target: string };
```

The program takes `frozen`, `scoped`, or `authority` as its only mode:

- `frozen` walks every declared frozen code/docs/raw/community path in the
  **Files** block. Under `src/discord-hero/**`, exclude exactly
  `catalog/source-refresh.ts`, `catalog/compiler.ts`, `catalog/loader.ts`, and
  `catalog/catalog.test.ts`; include every other file. Include all Markdown
  anywhere below `preferences/taskbarhero`, not only `items/` and `monsters/`.
- `scoped` records the five authored paths plus `assets/discordhero/catalog.json`,
  `preferences/taskbarhero/raw-data/current-version`,
  `preferences/taskbarhero/raw-data/current`, and every node below
  `preferences/taskbarhero/raw-data/versions/`. This manifest is for explicit
  before/after accounting, not equality.
- `authority` records `current-version`, the `current` symlink receipt without
  following it, the resolved current `source-lock.json`, and
  `assets/discordhero/catalog.json`.

Run it from the checkout root and hash the manifests themselves:

```bash
STAGEBOX_BASELINE_DIR=/tmp/discordhero-stagebox-t2-baseline
mkdir -p "$STAGEBOX_BASELINE_DIR"
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" frozen \
  > "$STAGEBOX_BASELINE_DIR/frozen.before.jsonl"
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" scoped \
  > "$STAGEBOX_BASELINE_DIR/scoped.before.jsonl"
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" authority \
  > "$STAGEBOX_BASELINE_DIR/authority.before.jsonl"
shasum -a 256 "$STAGEBOX_BASELINE_DIR"/*.before.jsonl
```

Expected: the key entries in `scoped.before.jsonl` exactly match the baseline
block, the `current` receipt is a symlink to
`versions/8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1`,
`current-version` contains that same target plus one newline, all declared
frozen paths appear exactly once, and no repository file changes. Preserve the
program bytes and all three manifests for Tasks 8-9; using a differently
implemented final manifest is invalid.

- [ ] **Step 2: Run the current behavioral baseline**

```bash
bun test src/discord-hero/catalog/catalog.test.ts
bun test src/discord-hero/catalog/indexes.test.ts
bun run discordhero:catalog:check
```

Expected: `35 pass, 0 fail`; `94 pass, 0 fail`; `checked | .../assets/discordhero/catalog.json`.

- [ ] **Step 3: Independently re-derive the StageBox oracle**

Use a test-side parser, not production functions. It must parse the 59 inventory rows in inventory order, require one `items` and one `items_detail` fenced appendix per page, hash `JSON.stringify(parsedRecord)`, and calculate:

```ts
expect(mappings).toHaveLength(59);
expect(new Set(mappings.map((row) => row.dropKey)).size).toBe(41);
expect(countBy(mappings, (row) => row.boxKind)).toEqual({
  NORMAL: 19,
  STAGE_BOSS: 29,
  ACT_BOSS: 11,
});
expect(uniqueDropRows).toHaveLength(2_428);
expect(
  mappings.reduce(
    (total, mapping) =>
      total + drops.filter((row) => row.DropKey === mapping.dropKey).length,
    0,
  ),
).toBe(3_975);
```

Expected pins are the six target locks in the baseline section. If any current-source derivation differs, stop; do not force the planned constant.

- [ ] **Step 4: Confirm the 18 arithmetic discriminators**

```ts
expect(
  mappings
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
```

Expected: exactly 18 mismatches. This is the falsifier for an arithmetic implementation.

### Task 2: Author and Record the Complete StageBox RED Suite

**Files:**

- Modify: `src/discord-hero/catalog/catalog.test.ts`
- Test: `src/discord-hero/catalog/catalog.test.ts`

**Interfaces:**

- Consumes: Task 1's independent oracle and existing public compiler/refresh/loader APIs
- Produces: twelve named RED contract groups; no production or generated artifact change

- [ ] **Step 1: Add independent test helpers**

Add `readStageBoxOracle(projectRoot, rawDataRoot)`,
`copyStageBoxProject()`, `materializeInstalledV1()`,
`materializeStagedV2FromOracle()`, `servePinnedRawSource()`,
`snapshotCatalogAuthority()`, and exact-key helpers inside `catalog.test.ts`.
`materializeInstalledV1()` must copy the reviewed
`8229a408...5285d1` generation and point both `current` and
`current-version` to it. `materializeStagedV2FromOracle()` must copy the same
underlying 45 datasets/61 monster details into a temporary stage, add the
oracle's exact aggregate bytes, and write the independently reconstructed v2
source-lock bytes with SHA `91740273...f770a4`. It must not call production
extraction, lock serialization, or validation. Every existing promotion
fixture must use this exact v1-installed/v2-staged pair; the former v1-to-v1
`prepareOldAndNewVersions` fixture is removed.

The oracle must return:

```ts
type StageBoxOracle = {
  inventoryAggregateSha256: string;
  mappingAggregateSha256: string;
  artifactSha256: string;
  artifactBytes: string;
  mappings: Array<{
    boxKind: "NORMAL" | "STAGE_BOSS" | "ACT_BOSS";
    itemId: number;
    dropKey: number;
    sourcePath: string;
    itemRecordSha256: string;
    detailRecordSha256: string;
  }>;
  uniqueDropRows: Record<string, unknown>[];
  perPageDropRowCount: number;
};
```

The test oracle must never import or call the production StageBox extractor/validator.

- [ ] **Step 2: Add the ten strict RED contract groups**

Use `describe("Stage Box T2 RED", ...)` and these exact test names:

```text
exposes the missing v3 semantic contract and loader getter
re-derives all 59 mappings and kills arithmetic DropKey derivation
pins the exact aggregate bytes and 59/41/19/29/11 census
joins 2,428 unique rows and 3,975 per-page rows with exact reward counts
pins all 12 Act Boss stage costs and four Soulstone identities
rejects hostile inventory and page sources before artifact output
rejects hostile aggregate and recomputed source-lock artifacts
returns a detached deeply frozen deterministic mapping or a plain Error
validates installed v1 and staged v2 with distinct pinned policies
publishes source and catalog as one rollback-capable authority pair
recovers an interrupted source-plus-catalog publication before a new refresh
preserves all frozen files and existing catalog authorities
```

The full join assertion is:

```ts
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
expect(countBy(oracle.uniqueDropRows, (row) => row.HeroKeyCondition)).toEqual({
  null: 956,
  0: 496,
  501: 488,
  601: 488,
});
expect(weightCounts).toEqual({ positive: 2_203, zero: 225, negative: 0 });
expect(uniqueGroupKeys.size).toBe(561);
expect(selectedGroupMemberships).toHaveLength(1_171);
expect(distinctDirectItemKeys.size).toBe(23);
expect(unresolved).toEqual({
  dropTables: 0,
  groups: 0,
  groupItems: 0,
  directItems: 0,
  heroConditions: 0,
});
```

The Act Boss assertion is:

```ts
expect(actBossStages).toHaveLength(12);
expect(new Set(actBossStages.map((row) => row.BossDropItemKey)).size).toBe(11);
expect(countBy(actBossStages, (row) => row.STAGEDIFFICULITY)).toEqual({
  NORMAL: 3,
  NIGHTMARE: 3,
  HELL: 3,
  TORMENT: 3,
});
const expectedSoulstoneByDifficulty = {
  NORMAL: 190001,
  NIGHTMARE: 190002,
  HELL: 190003,
  TORMENT: 190004,
} as const;
for (const row of actBossStages) {
  expect(row.SoulstoneAmount).toBe(1);
  expect(row.SoulstoneItemKey).toBe(
    expectedSoulstoneByDifficulty[row.STAGEDIFFICULITY],
  );
}
```

- [ ] **Step 3: Add every source and artifact attack fixture**

Table-drive these exact cases: 58/60/duplicate inventory rows; duplicate
ID/slug/path; absolute/traversal/non-canonical path; symlink/directory target;
inventory/page/artifact of exactly 64 KiB and 64 KiB + 1; missing/duplicate
`items` fence; missing/duplicate `items_detail` fence; malformed JSON;
duplicate top-level `items.id`; escaped-equivalent duplicate
`items.\u0069d`; duplicate `items_detail.dropKey` whose final value is the
canonical value; missing/extra item/detail key; ID/slug/raw-item mismatch;
non-`STAGEBOX`; unsafe/non-positive DropKey; actual pathname identity
replacement; missing/extra/reordered/duplicate aggregate mapping; duplicate
aggregate top-level/mapping key; changed kind/path/source hash; unknown
DropKey; attacker-recomputed mapping aggregate; attacker-recomputed source
lock; attacker-recomputed compiled payload/file self-hash.

The pathname attack must wait until the victim page descriptor is open, rename
the canonical page to a sibling backup, create a new regular file at the
original pathname with valid canonical bytes, then let capture continue. It
must fail on descriptor/path identity even though both files are individually
valid, and restore the fixture in `finally`; overwriting bytes through the
already-open inode is not this test.

Add three migration/publication fixtures:

1. exact installed v1 + exact staged v2 succeeds, and installed v2 is accepted
   after promotion;
2. staged v1, unpinned v1/v2, and a v1 lock plus v2 aggregate hybrid all fail
   before pointer or catalog mutation;
3. inject a failure after both source pointers select v2 but before catalog
   rename; assert `current`, `current-version`, and catalog bytes all return to
   the prior v1/catalog pair, the newly owned v2 version is removed, and no
   `.discordhero-raw-stage-*`, `.discordhero-current-*`,
   `.discordhero-catalog-*`, or `.discordhero-publication-*` node remains.

Also construct a crash-left journal fixture at the same post-source/pre-catalog
state and invoke the next refresh's recovery entrypoint. Assert the same prior
pair and zero owned residue before the new download callback is allowed to run.
For every ordinary refresh failure assert the complete three-authority
snapshot is unchanged and the same residue list is empty.

- [ ] **Step 4: Record RED before any production edit**

```bash
shasum -a 256 \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/loader.ts \
  scripts/discordhero-catalog.ts \
  assets/discordhero/catalog.json
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED"
```

Expected: the five production/artifact hashes still equal baseline and the
command exits non-zero for the missing extractor, target v2 validator,
migration bridge, catalog v3 semantic, loader getter, and recoverable paired
publication. The current authority remains reviewed v1 throughout RED.
Preserve the exact failed assertion list; a vacuous or all-green "RED" is
invalid.

- [ ] **Step 5: Hash the RED test state**

```bash
shasum -a 256 src/discord-hero/catalog/catalog.test.ts
```

Record this test-only SHA as the Task 2 checkpoint. Do not edit tests to accommodate later implementation behavior unless the source/design contract is proven wrong.

### Task 3: Extract the Immutable StageBox Aggregate During Refresh

**Files:**

- Modify: `src/discord-hero/catalog/source-refresh.ts:347-471`
- Test: `src/discord-hero/catalog/catalog.test.ts`

**Interfaces:**

- Consumes: `projectRoot`, `stagedDirectory`, exact inventory/page bytes
- Produces: `stage-box-drop-keys.json` with SHA `5abd...668ce9` before `createDiscordHeroSourceLock`

- [ ] **Step 1: Add bounded descriptor-and-path capture**

Use a single `captureRegularFile(path, onOpened?)` implementation for the
inventory and every item page. Set `MAX_SOURCE_BYTES = 64 * 1024` and allocate
exactly `MAX_SOURCE_BYTES + 1` bytes. For each capture:

1. `lstat(path, { bigint: true })`; require a regular non-symlink.
2. `open(path, constants.O_RDONLY | constants.O_NOFOLLOW)`, then descriptor
   `stat({ bigint: true })`; require regular and require pathname/descriptor
   `dev` and `ino` equality before reading.
3. Invoke the existing refresh fault-injection callback at
   `{ step: "opened-stage-box-page", path }`; production calls omit it.
4. Loop positional `handle.read(buffer, offset, remaining, offset)` only until
   EOF or `MAX_SOURCE_BYTES + 1` bytes. Never call `readFile()`. Reject if the
   captured length is `MAX_SOURCE_BYTES + 1`.
5. Take descriptor `stat` and canonical-path `lstat` again. Require all four
   observations (pre-path, pre-descriptor, post-descriptor, post-path) to have
   identical `dev`, `ino`, `size`, `mtimeNs`, and `ctimeNs`, and again require
   the final path to be a regular non-symlink. Then decode strict UTF-8.
6. Close in `finally`.

Resolve every page as a direct child of `preferences/taskbarhero/items`;
reject symlink, directory, absolute path, traversal, and non-canonical relative
spelling before opening. The post-read pathname `lstat` is mandatory: comparing
only two `fstat` calls observes the old inode and cannot detect rename-replace.

- [ ] **Step 2: Parse exact inventory and appendices**

Require exactly 59 unique inventory rows matching:

```ts
/^\| \[([^\]]+)\]\((items\/[^)]+\.md)\) \| ([^|]+?) \| ([1-9]\d*) \|$/gm;
```

Extract each fenced appendix's raw JSON text. Parse it with a local recursive
JSON lexer/parser that consumes the complete JSON grammar, decodes string
escapes before key comparison, maintains a fresh `Set<string>` for every
object, and throws a plain namespaced `Error` on a repeated decoded key before
constructing the object. It must reject trailing tokens and malformed UTF-16;
do not use `JSON.parse` before duplicate detection. Require these nine item own
keys, and accept `deleted` as the only permitted tenth:

```ts
["affix", "gear", "grade", "icon", "id", "level", "name", "slug", "type"];
// optional tenth, boolean: "deleted"
```

41 of the 59 pages carry the nine keys and 18 carry `deleted: true`. Those 18
are exactly the 18 arithmetic discriminators below: a retired box keeps its own
item id while pointing at a surviving box's `DropKey`, which is why `DropKey`
can never be computed from `itemId`. They belong in the aggregate — the pinned
artifact hash `5abd1eb6...668ce9` is only reproducible with all 59 present and
`deleted` inside the hashed item record. Requiring exactly nine keys would
reject 18 pages and make that hash unreachable.

Require detail own keys exactly:

```ts
["desc", "dropKey", "stats", "synthType", "uniqueMod"];
```

Require one `en-US` name, inventory/page/raw item ID and slug equality, raw `items.type === "STAGEBOX"`, and a positive safe-integer `dropKey`. Classify exactly one prefix: `Normal Monster Box`, `Stage Boss Box`, or `Act Boss Box`.

- [ ] **Step 3: Build and atomically write the aggregate**

Calculate the inventory aggregate in inventory order from
`{ itemId, sourcePath, slug }`. Sort captured mapping values numerically by
`itemId`, calculate `sha256(JSON.stringify(mappings))`, serialize once with two
spaces and one trailing newline, require the serialized bytes are at most
64 KiB, write to a unique `.discordhero-stage-box-*` file inside the stage,
close it, then rename it to `stage-box-drop-keys.json`. On any error, remove
only the owned temporary file. Do not reread pages or rebuild from live objects
after validation.

```ts
const artifact = {
  format: "discordhero-stage-box-drop-keys/v1" as const,
  inventoryAggregateSha256,
  mappings: mappings.toSorted((left, right) => left.itemId - right.itemId),
};
const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
```

- [ ] **Step 4: Place extraction before source-lock creation**

```ts
await extractMonsterDetails(projectRoot, stagedDirectory);
await extractStageBoxDropKeys(projectRoot, stagedDirectory);
const sourceLock = await createDiscordHeroSourceLock(
  projectRoot,
  stagedDirectory,
);
```

`extractStageBoxDropKeys` reads and parses staged `datasets/items.json` exactly once for its raw-item equality check. It does not export a test-only production interface, and the compiler never parses mutable Markdown.

- [ ] **Step 5: Run the extractor attack subset**

```bash
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED.*(59 mappings|hostile inventory)"
```

Expected: exact aggregate, 64 KiB boundary, duplicate-key, and real
rename-replace assertions pass; compiler/migration/publication/source-lock/
loader assertions remain RED.

- [ ] **Step 6: Record the task hash checkpoint**

```bash
shasum -a 256 \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/catalog.test.ts
```

### Task 4: Add the Exact v1-Installed/v2-Target Bridge and Source Lock v2

**Files:**

- Modify: `src/discord-hero/catalog/compiler.ts:16-30,164-251,490-703`
- Test: `src/discord-hero/catalog/catalog.test.ts`

**Interfaces:**

- Consumes: exact `stage-box-drop-keys.json` bytes from Task 3 and raw `items`
- Produces: distinct pinned installed/target validation policies, inspected immutable mapping snapshot, and `discordhero-source-lock/v2`

- [ ] **Step 1: Add exact types and reviewed pins**

Add `StageBoxKind`, `StageBoxDropKeyMapping`, `SourceLockStageBoxDropKeys`, and constants:

```ts
export const STAGE_BOX_INVENTORY_SHA256 =
  "cb107ebc086f776e2d792bbc24be52940cd9dccbdb47bdfcb62ba54dfb8523a8";
export const STAGE_BOX_MAPPING_SHA256 =
  "3210ffc48bc73dad29f057e6fd45458d9d9cf2f2076be2c6be996e9c7b0d5845";
export const STAGE_BOX_ARTIFACT_SHA256 =
  "5abd1eb6538d2ba59052845c2be376c67a79bf47393de2f6b8ceca17fb668ce9";
export const INSTALLED_V1_SOURCE_LOCK_SHA256 =
  "8229a4083bb05481250fbba0e18607e89ebf2341e5f351d5074e32b33c5285d1";
export const TARGET_V2_SOURCE_LOCK_SHA256 =
  "91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4";
```

Keep `SOURCE_LOCK_SHA256` as an alias for
`TARGET_V2_SOURCE_LOCK_SHA256` for the compiled target. Define
`RawSourceAuthority = "installed" | "target"` and require every validation
call to choose one explicitly:

```ts
export async function validateRawSourceDirectory(
  projectRoot: string,
  rawDataRoot: string,
  options: { authority: RawSourceAuthority },
): Promise<InspectedRawSource>;
```

For `authority: "installed"`, bounded-read `source-lock.json`, hash the exact
bytes first, and accept only:

- SHA `8229...5285d1`: reconstruct the exact
  `discordhero-source-lock/v1` shape from the 45 datasets and 61 monster
  details, require byte equality, and require
  `stage-box-drop-keys.json` absent;
- SHA `91740273...f770a4`: run the complete v2 inspection below.

For `authority: "target"`, accept only the second branch. Never select a
schema from an unpinned `format` field or aggregate presence. Change
`preparePromotionDestination` and rollback recovery to use `installed`;
change staged/materialized validation and explicit-root catalog compilation to
use `target`. Retain this bridge after successful promotion because the
preserved v1 directory remains the rollback/recovery authority. This ordering
must land before the first `--refresh`; changing the only validator to v2
without this branch is invalid.

- [ ] **Step 2: Validate the aggregate fail-closed**

Open `stage-box-drop-keys.json` with `O_RDONLY | O_NOFOLLOW`, perform the same
pre/post pathname `lstat` plus descriptor `fstat` identity checks as Task 3,
and positional-read at most `64 * 1024 + 1` bytes; never use
`readFile()` for this artifact. Reject 64 KiB + 1 before parsing. Use a
duplicate-key-aware complete lexical JSON parser before exact-key validation,
so repeated top-level or mapping fields cannot collapse to a canonical final
value.

Before iterating, require exact top-level keys, `mappings.length === 59`, and
artifact size at most 64 KiB. Each mapping must have exactly six keys and valid
primitive types. Require numeric ascending order, unique item IDs, 19/29/11
kinds, 41 DropKeys, exact inventory/mapping/artifact SHA values, and
bidirectional equality with all and only the 59 raw `items` rows whose type is
`STAGEBOX`.

- [ ] **Step 3: Carry the captured snapshot through `InspectedRawSource`**

Add:

```ts
stageBoxMappings: StageBoxDropKeyMapping[];
```

Return the parsed-and-validated snapshot. Compilation must consume this field, not reread `stage-box-drop-keys.json` and not derive from current Markdown.

- [ ] **Step 4: Construct source-lock v2 in the locked property order**

```ts
stageBoxDropKeys: {
  path: "stage-box-drop-keys.json",
  count: 59,
  distinctDropKeyCount: 41,
  inventoryAggregateSha256: STAGE_BOX_INVENTORY_SHA256,
  mappingAggregateSha256: STAGE_BOX_MAPPING_SHA256,
  sha256: STAGE_BOX_ARTIFACT_SHA256,
},
```

Keep monster lock bytes and aggregate unchanged. The v1 reconstruction omits
this field; the v2 reconstruction appends it after `monsterDetails` exactly.

- [ ] **Step 5: Run source-lock and aggregate attacks**

```bash
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED.*(aggregate bytes|hostile aggregate|installed v1)"
```

Expected: v1-installed/v2-target migration fixtures and all
source-lock/aggregate attacks pass. In particular staged v1 and every hybrid
fail before promotion. Compiled semantic, paired-publication, and loader tests
remain RED.

- [ ] **Step 6: Record the task hash checkpoint**

```bash
shasum -a 256 \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/catalog.test.ts
```

### Task 5: Compile and Validate the Complete StageBox Relationship Census

**Files:**

- Modify: `src/discord-hero/catalog/compiler.ts:211-251,756-1035`
- Test: `src/discord-hero/catalog/catalog.test.ts`
- Read only: `src/discord-hero/catalog/indexes.ts:1321-1341,1586-1611`

**Interfaces:**

- Consumes: Task 4 mappings and existing `drops`, `item_groups`, `items`, `heroes`, `stages`
- Produces: catalog v3 `semantic.stageBoxDropKeys`; no duplicated raw reward rows

- [ ] **Step 1: Add catalog v3 semantic types**

Change the catalog format literal to `discordhero-catalog/v3` and append the exact StageBox semantic interface after `monsterAttacks`. Do not add a derived reward array.

Replace the ambiguous current `rawDataRoot` option with a discriminated source
selection:

```ts
type CatalogSource =
  | { currentRawDataRoot?: string; sourceDirectory?: never }
  | { currentRawDataRoot?: never; sourceDirectory: string };
```

With `sourceDirectory`, canonicalize that exact directory and validate it with
`authority: "target"` without resolving `current-version`. With
`currentRawDataRoot` or no option, resolve current and then require the target
v2 authority. Task 7 uses `sourceDirectory: stagedDirectory` to serialize and
pin the complete catalog before either live source pointer changes.

- [ ] **Step 2: Validate every mapped table and reward edge**

For each mapping require an existing STAGEBOX item and at least one drop row. Across the 41 unique DropKeys require:

```text
unique selected rows             2,428
per-page expanded rows           3,975
DropType                         2,418 EachDropOneWeight_DLCVariant; 10 EachDropOneWeight
REWARDTYPE                       2,282 ITEMGROUP; 146 ITEM
HeroKeyCondition                 956 null; 496 zero; 488 Hero 501; 488 Hero 601
Weight                           2,203 positive; 225 zero; 0 negative
unique groups/membership rows    561 / 1,171
distinct direct item keys        23
unresolved references            0
kind-selected rows               639 NORMAL; 736 STAGE_BOSS; 1,053 ACT_BOSS
```

Weights must be safe non-negative integers and each table's total must be a positive safe integer. Non-null/nonzero hero conditions must resolve to `heroes`. Group rewards must resolve to non-empty groups and every member to `items`; direct rewards must resolve to `items`.

- [ ] **Step 3: Validate exact Act Boss costs**

Select `stages` whose `BossDropItemKey` is an ACT_BOSS mapping. Require 12
rows, 11 distinct mapped boxes, and exact difficulty counts
`{ NORMAL: 3, NIGHTMARE: 3, HELL: 3, TORMENT: 3 }`. Iterate every selected
row, require `SoulstoneAmount === 1`, and compare its `SoulstoneItemKey`
directly with:

```ts
{
  NORMAL: 190001,
  NIGHTMARE: 190002,
  HELL: 190003,
  TORMENT: 190004,
}
```

Do not reduce the 12 rows with `Object.fromEntries` or another overwriting map:
three rows share each difficulty and every row is part of the contract. The
existing index rules already validate `BossDropItemKey -> items` and
`SoulstoneItemKey -> items`; leave both index files unchanged.

- [ ] **Step 4: Emit only inspected mappings and provenance**

```ts
stageBoxDropKeys: {
  provenance: {
    sourceCount: 59,
    distinctDropKeyCount: 41,
    inventoryAggregateSha256: STAGE_BOX_INVENTORY_SHA256,
    sourceAggregateSha256: STAGE_BOX_MAPPING_SHA256,
    sourceArtifactSha256: STAGE_BOX_ARTIFACT_SHA256,
  },
  mappings: inspected.stageBoxMappings,
},
```

Change `validateDiscordHeroCatalog` to require exact semantic/top-level shapes, all provenance pins, all mapping fields/order/counts, and relationship census before payload-pin validation.

- [ ] **Step 5: Set the independently derived compiled pins**

```ts
export const COMPILED_PAYLOAD_SHA256 =
  "7e39f04f3657f24bf6576202d2fd497c6c615a5d68d5c20c75e7c8b1fd15d44d";
export const COMPILED_FILE_SHA256 =
  "182d2b5a5c1b5c8c64bd92997f3a2d211c17f55d6e6934da9189b952286f50d7";
```

- [ ] **Step 6: Run compiler/join/Act Boss tests**

```bash
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED.*(v3 semantic|2,428|Act Boss|recomputed)"
```

Expected: compiler/source/artifact tests pass; loader getter test remains RED.

- [ ] **Step 7: Record the task hash checkpoint**

```bash
shasum -a 256 \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/catalog.test.ts
```

### Task 6: Expose the Frozen Loader Lookup

**Files:**

- Modify: `src/discord-hero/catalog/loader.ts:19-136`
- Test: `src/discord-hero/catalog/catalog.test.ts`

**Interfaces:**

- Consumes: validated `LoadedDiscordHeroCatalog`
- Produces: `LoadedStageBoxDropKeyMapping` and `getStageBoxDropKeyMapping(catalog, itemId)`

- [ ] **Step 1: Export the loaded mapping type**

Import `StageBoxDropKeyMapping` as a type and add:

```ts
export type LoadedStageBoxDropKeyMapping = DeepReadonly<StageBoxDropKeyMapping>;
```

- [ ] **Step 2: Add the linear fail-closed getter**

```ts
export function getStageBoxDropKeyMapping(
  catalog: LoadedDiscordHeroCatalog,
  itemId: number,
): LoadedStageBoxDropKeyMapping {
  const mapping = catalog.semantic.stageBoxDropKeys.mappings.find(
    (candidate) => candidate.itemId === itemId,
  );
  if (mapping === undefined) {
    throw new Error(
      `DiscordHero catalog: no StageBox DropKey mapping for item ${itemId}`,
    );
  }
  return mapping;
}
```

Do not add a cache or index. The loaded catalog's existing detached JSON parse and recursive freeze own immutability.

- [ ] **Step 3: Prove runtime behavior**

Tests must assert the known 910011 mapping, all nested values frozen, mutation throws `TypeError`, source artifact/catalog input bytes unchanged, two lookups are structurally deterministic, unknown/unsafe IDs throw plain namespaced `Error` and never `TypeError`, and wrapped `Math.random`/`Date.now` counters remain zero.

Until Task 7 performs the canonical publication, compile/load through
`copyStageBoxProject()` with its exact target-v2 current pointer. No Task 3-6
test may rewrite the canonical checkout's v1 pointer or catalog.

- [ ] **Step 4: Run the complete non-publication StageBox subset**

```bash
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED.*(exposes|re-derives|pins the exact|joins|pins all 12|rejects hostile|returns a detached|validates installed)"
```

Expected: all non-publication StageBox contract tests pass in the isolated v2
fixture. The paired-publication tests remain RED until Task 7; the canonical
checkout remains the v1/catalog-v2 pair.

- [ ] **Step 5: Record the task hash checkpoint**

```bash
shasum -a 256 \
  src/discord-hero/catalog/loader.ts \
  src/discord-hero/catalog/catalog.test.ts
```

### Task 7: Publish Pinned Source and Catalog as One Recoverable Pair

**Files:**

- Modify: `scripts/discordhero-catalog.ts:24-34`
- Modify: `src/discord-hero/catalog/source-refresh.ts:53-63,208-313,479-692`
- Modify: `src/discord-hero/catalog/compiler.ts:827-1088`
- Generate: `preferences/taskbarhero/raw-data/versions/91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4/**`
- Generate: `preferences/taskbarhero/raw-data/current-version`
- Generate symlink: `preferences/taskbarhero/raw-data/current`
- Generate: `assets/discordhero/catalog.json`

**Interfaces:**

- Consumes: installed-v1/target-v2 validation, exact staged catalog bytes, and the existing promotion lock
- Produces: one recoverable publication of the immutable source generation and exact compiled catalog v3

- [ ] **Step 1: Replace raw-only refresh with a paired publication**

Keep `--generate` and `--check` behavior unchanged. Replace the production
`refreshDiscordHeroRawSource`/later-`generate()` sequence with:

```ts
export async function refreshDiscordHeroCatalogPublication(
  projectRoot: string,
  outputPath: string,
  options?: {
    sourceOrigin?: string;
    onPublicationStep?: (step: PublicationStep) => void | Promise<void>;
  },
): Promise<{
  sourceLockSha256: string;
  monsterDetailsSha256: string;
  stageBoxDropKeysSha256: string;
  compiledFileSha256: string;
  changed: boolean;
}>;
```

After download/extraction, validate the stage with `authority: "target"`.
Compile with `{ sourceDirectory: stagedDirectory }`, serialize once, and require
all six target pins before any current pointer or `outputPath` mutation. Write
those exact catalog bytes to a unique `.discordhero-catalog-candidate-*` file
beside `outputPath`, close and sync it, then enter the promotion lock. Revalidate
the installed authority with `authority: "installed"`, revalidate the stage
with `authority: "target"`, and require the installed authority still equals
the pre-download snapshot.

- [ ] **Step 2: Add an explicit durable rollback/recovery protocol**

Under the promotion lock, create
`raw-data/.discordhero-publication-journal.json` by write/sync/rename and record
exactly: format v1, token, phase, prior/new `current` targets, prior
`current-version` bytes, prior catalog SHA/backup path, candidate catalog
SHA/path, target version path, and whether this transaction created that
version. The backup is a unique regular file beside `outputPath`; verify its
bytes equal the pre-transaction catalog before switching anything.

Use these phases and order:

```text
prepared       target version + pointer temps + catalog candidate + backup ready
source-active  current symlink and current-version both select target v2
catalog-active outputPath contains exact catalog v3 candidate bytes
committed      all three authorities re-read and match the six pins
```

Sync changed files and parent directories before advancing the durable journal
phase. `onPublicationStep("source-active")` runs after both source pointers
select v2 and before catalog rename; this is the mandatory injected-failure
point.

On any thrown failure through `catalog-active`, use journal data to restore
`outputPath` from the verified backup and restore both source pointers to the
prior target. Re-read and validate the prior installed source plus exact prior
catalog SHA before deleting the journal, candidate, backup, pointer temps,
stage, and transaction-created target version. Aggregate the original and
rollback errors if restoration itself fails; never report clean rollback
without the re-read.

At the start of every refresh, while holding the same lock and before stale
artifact collection/download:

- a `prepared`, `source-active`, or `catalog-active` journal is rolled back by
  the same routine;
- a `committed` journal is finalized only after the exact new source/catalog
  pair is revalidated;
- malformed, unpinned, path-escaping, symlinked, or inconsistent journal/
  backup/candidate state fails closed without starting a new download.

The recovery routine accepts the preserved reviewed v1 pin as the prior
authority. Do not remove the bridge after the first v2 publication. Make the
old source-only installer private to this transaction or remove it; there must
be no production `--refresh` path that switches source without already staged
and pinned catalog bytes.

- [ ] **Step 3: Prove rollback and recovery before canonical promotion**

Run the exact v1-installed/v2-staged fixtures:

```bash
bun test src/discord-hero/catalog/catalog.test.ts \
  --test-name-pattern "Stage Box T2 RED.*(validates installed|publishes source|recovers an interrupted)"
```

Expected: all migration, all existing promotion-boundary, the injected
post-source/pre-catalog failure, and crash-left recovery assertions pass. At
each failure, `current`, `current-version`, and catalog equal the prior pair;
the target version is absent if created by that transaction; no owned source,
pointer, catalog, backup, or journal residue remains. The test must use the
real compiler and real rename operations, not mock assertions.

- [ ] **Step 4: Run the only authorized paired publication path**

```bash
bun run scripts/discordhero-catalog.ts --refresh
```

Expected:

```text
source lock 91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4
stage box drop keys 5abd1eb6538d2ba59052845c2be376c67a79bf47393de2f6b8ceca17fb668ce9
compiled file 182d2b5a5c1b5c8c64bd92997f3a2d211c17f55d6e6934da9189b952286f50d7
```

The CLI calls only `refreshDiscordHeroCatalogPublication`, prints its returned
pins, and does not call `generate()` afterward. Do not hand-create, copy, or
edit the version directory, pointers, or catalog.

- [ ] **Step 5: Verify exact promoted layout and clean journal state**

```bash
readlink preferences/taskbarhero/raw-data/current
cat preferences/taskbarhero/raw-data/current-version
shasum -a 256 \
  preferences/taskbarhero/raw-data/current/stage-box-drop-keys.json \
  preferences/taskbarhero/raw-data/current/source-lock.json \
  assets/discordhero/catalog.json
wc -c \
  preferences/taskbarhero/raw-data/current/stage-box-drop-keys.json \
  preferences/taskbarhero/raw-data/current/source-lock.json \
  assets/discordhero/catalog.json
find preferences/taskbarhero/raw-data assets/discordhero -maxdepth 1 \
  \( -name '.discordhero-raw-stage-*' \
  -o -name '.discordhero-current-*' \
  -o -name '.discordhero-catalog-*' \
  -o -name '.discordhero-publication-*' \) -print
```

Expected pointer in both locations:

```text
versions/91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4
```

Expected hashes/sizes:

```text
5abd1eb6538d2ba59052845c2be376c67a79bf47393de2f6b8ceca17fb668ce9  19,897
91740273a6399950f5d972fa082f9abf97544a6b0716dda06b71acce66f770a4  40,992
182d2b5a5c1b5c8c64bd92997f3a2d211c17f55d6e6934da9189b952286f50d7  8,599,055
```

Expected residue output: empty.

- [ ] **Step 6: Prove unchanged underlying authorities**

Assert 45 datasets, 25,757 rows, unchanged `catalog.json`, unchanged 45 dataset hashes, 61 monster details, and unchanged monster aggregate `7211c8fc...3a48`. Confirm the previous `versions/8229a408...5285d1/` still exists and its `source-lock.json` remains SHA `8229a408...5285d1`.

- [ ] **Step 7: Run complete StageBox GREEN**

```bash
bun test src/discord-hero/catalog/catalog.test.ts
bun run discordhero:catalog:check
```

Expected: all catalog tests pass and check mode reports the exact generated artifact.

- [ ] **Step 8: Record the authored/generated hash checkpoint**

```bash
shasum -a 256 \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/loader.ts \
  src/discord-hero/catalog/catalog.test.ts \
  scripts/discordhero-catalog.ts \
  preferences/taskbarhero/raw-data/current/stage-box-drop-keys.json \
  preferences/taskbarhero/raw-data/current/source-lock.json \
  assets/discordhero/catalog.json
```

### Task 8: Kill All 50 Atomic Variants in 22 Mutation Categories

**Files:**

- Read only canonical: the five authored files and generated artifacts
- Modify only: isolated `/tmp/discordhero-stagebox-mutant-*/` copies
- Test: copied `src/discord-hero/catalog/catalog.test.ts`

**Interfaces:**

- Consumes: canonical GREEN implementation and target hashes
- Produces: 50 individually named non-zero mutant receipts across 22 categories while canonical scoped and frozen manifests remain unchanged

- [ ] **Step 1: Capture canonical hashes and create one fresh copy per mutant**

Before each atomic variant, regenerate and compare the canonical
`frozen` and `scoped` manifests with the post-Task-7 checkpoints. Create a
fresh temporary directory, copy the checkout without following raw-data
symlinks, preserve the `current` symlink as a symlink, apply exactly one
named mutation, and run the named StageBox test plus
`bun run discordhero:catalog:check`. After that variant, compare both canonical
manifests again. Never run `--refresh` against the canonical checkout during
mutation work.

- [ ] **Step 2: Execute this exact mutation matrix**

| Category | Atomic variant IDs         | Single buildable mutation per fresh run                                                                                                                            | Must be killed by                                                 |
| -------: | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
|        1 | `1a`                       | replace captured `detail.dropKey` with `item.id * 10 + 1`                                                                                                          | 18 arithmetic discriminators                                      |
|        2 | `2a`, `2b`, `2c`, `2d`     | move the 59-row cap after iteration; unbound page read; unbound aggregate read; remove post-read pathname `lstat` identity comparison                              | 60-row, 64 KiB + 1 page/artifact, and real rename-replace attacks |
|        3 | `3a`, `3b`                 | accept 58 mappings; accept 60 mappings                                                                                                                             | exact 59 census                                                   |
|        4 | `4a`, `4b`, `4c`           | delete first; middle; last mapping                                                                                                                                 | aggregate count/hash and bidirectional coverage                   |
|        5 | `5a`, `5b`, `5c`, `5d`     | disable item-appendix duplicate-key rejection; detail-appendix duplicate-key rejection; aggregate duplicate-key rejection; duplicate mapping item-ID rejection     | literal/escaped duplicate JSON and duplicate mapping attacks      |
|        6 | `6a`, `6b`                 | sort lexically; accept input order                                                                                                                                 | canonical numeric order                                           |
|        7 | `7a`, `7b`, `7c`           | remove 19; 29; 11 kind guard                                                                                                                                       | exact kind census                                                 |
|        8 | `8a`                       | trust inventory identity without page/raw-item equality                                                                                                            | ID/slug/raw-item mismatch attacks                                 |
|        9 | `9a`, `9b`, `9c`           | ignore `sourcePath`; `itemRecordSha256`; `detailRecordSha256`                                                                                                      | source provenance attacks                                         |
|       10 | `10a`                      | remove mapping aggregate pin                                                                                                                                       | attacker-recomputed mapping aggregate                             |
|       11 | `11a`                      | remove aggregate file pin                                                                                                                                          | changed artifact with recomputed inner hash                       |
|       12 | `12a`, `12b`               | remove source-lock pin; select schema from unpinned format                                                                                                         | recomputed and v1/v2 hybrid locks                                 |
|       13 | `13a`, `13b`               | remove compiled payload pin; compiled file pin                                                                                                                     | recomputed compiled self-hash/file attacks                        |
|       14 | `14a`, `14b`               | accept unknown item; non-STAGEBOX item                                                                                                                             | bidirectional item joins                                          |
|       15 | `15a`                      | accept unknown DropKey                                                                                                                                             | missing drop-table attack                                         |
|       16 | `16a`, `16b`, `16c`, `16d` | remove direct-item; group; member; hero-condition join                                                                                                             | unresolved-reference attacks                                      |
|       17 | `17a`, `17b`, `17c`        | accept negative weight; unsafe weight; zero-total table                                                                                                            | weight/table-total attacks                                        |
|       18 | `18a`, `18b`, `18c`, `18d` | omit one stage; accept amount 0; accept amount 2; swap only the first of three same-difficulty Soulstone rows                                                      | 3/3/3/3 counts and per-row Act Boss assertions                    |
|       19 | `19a`                      | rebuild mappings from mutable/live objects after inspection                                                                                                        | captured-snapshot identity-swap attack                            |
|       20 | `20a`                      | return `undefined` for unknown loader item                                                                                                                         | plain namespaced `Error`                                          |
|       21 | `21a`                      | skip recursive freeze for StageBox mappings                                                                                                                        | deep mutation/`TypeError`                                         |
|       22 | `22a`, `22b`, `22c`, `22d` | write aggregate after source-lock; compile catalog after source switch; suppress rollback after injected `source-active` failure; skip crash-left journal recovery | layout, prepublication build, rollback, and recovery tests        |

Record one receipt per exact variant ID with changed-file SHA, command, non-zero
exit, and the named assertion that killed it. The required summary is
`50/50 atomic variants killed; 22/22 categories covered`. A category-level
`22/22` receipt alone is invalid. A mutant killed only by syntax/type failure
is invalid; repair the mutation so the altered implementation builds, then
rerun.

- [ ] **Step 3: Prove canonical files were untouched**

```bash
shasum -a 256 \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/loader.ts \
  src/discord-hero/catalog/catalog.test.ts \
  scripts/discordhero-catalog.ts \
  preferences/taskbarhero/raw-data/current/stage-box-drop-keys.json \
  preferences/taskbarhero/raw-data/current/source-lock.json \
  assets/discordhero/catalog.json
```

Regenerate the complete canonical `frozen` and `scoped` manifests with Task 1's
preserved program. Expected: byte-identical to the post-Task-7 checkpoints and
to every per-variant boundary receipt.

### Task 9: Run Release Gates, Scope Audit, and Independent Review

**Files:**

- Verify authored: the five authored files
- Verify generated: the four generated surfaces
- Verify frozen: all Global Constraints frozen paths
- No further change unless a failed gate identifies a real defect; any fix repeats focused RED/GREEN and the relevant mutants

**Interfaces:**

- Consumes: GREEN implementation, generated artifacts, mutation receipts
- Produces: reproducible validation evidence and an independent verdict

- [ ] **Step 1: Run formatting and complete validation**

```bash
bunx prettier@3.9.6 --check \
  src/discord-hero/catalog/source-refresh.ts \
  src/discord-hero/catalog/compiler.ts \
  src/discord-hero/catalog/loader.ts \
  src/discord-hero/catalog/catalog.test.ts \
  scripts/discordhero-catalog.ts
bun test src/discord-hero/catalog/catalog.test.ts
bun test src/discord-hero/catalog/indexes.test.ts
bun run typecheck
bun run discordhero:catalog:check
bun run discordhero:achievements:check
bun run discordhero:community-market:check
bun run discordhero:community-content:check
bun test scripts/docker-artifact-gate.test.ts
```

Expected: every command exits zero. Report focused catalog, index, global typecheck, adjacent artifact, and Docker-gate results separately.

- [ ] **Step 2: Audit exact source/artifact invariants**

Re-run the independent oracle and assert all values:

```text
59 mappings; 41 DropKeys; 19/29/11 kinds
2,428 unique-table drop rows; 3,975 per-page expansion rows
2,418/10 drop types; 2,282/146 reward types
956/496/488/488 hero conditions; 2,203/225/0 weights
561 groups; 1,171 membership rows; 23 direct item keys; zero unresolved
12 Act Boss rows; 11 boxes; amount 1; Soulstones 190001/190002/190003/190004
Act Boss difficulty rows 3/3/3/3; every row matches its difficulty Soulstone
```

- [ ] **Step 3: Audit residue and frozen hashes**

```bash
find preferences/taskbarhero/raw-data assets/discordhero -maxdepth 1 \
  \( -name '.discordhero-raw-stage-*' \
  -o -name '.discordhero-current-*' \
  -o -name '.discordhero-catalog-*' \
  -o -name '.discordhero-publication-*' \) -print
STAGEBOX_BASELINE_DIR=/tmp/discordhero-stagebox-t2-baseline
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" frozen \
  > "$STAGEBOX_BASELINE_DIR/frozen.after.jsonl"
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" scoped \
  > "$STAGEBOX_BASELINE_DIR/scoped.after.jsonl"
bun "$STAGEBOX_BASELINE_DIR/manifest.ts" authority \
  > "$STAGEBOX_BASELINE_DIR/authority.after.jsonl"
cmp "$STAGEBOX_BASELINE_DIR/frozen.before.jsonl" \
  "$STAGEBOX_BASELINE_DIR/frozen.after.jsonl"
```

Expected: no residue and complete frozen manifest byte equality, including
every non-authored DiscordHero code file, all command/community code declared
in Task 1, all source Markdown (including monsters and non-item pages), the
manifest, the complete preserved v1 raw generation, three community artifacts,
package/lock files, file types, and symlink targets. Inspect
`scoped.before.jsonl -> scoped.after.jsonl` and require differences only for
the five authored files plus the four declared generated surfaces/new v2
generation. `authority.after.jsonl` must show a symlink to the exact v2 target,
matching `current-version`, source-lock v2, and compiled catalog v3.

- [ ] **Step 4: Obtain a fresh independent read-only review**

Give a new reviewer the architecture/correction documents, this plan,
baseline/final complete manifests, RED receipt, GREEN outputs, and all 50
atomic mutation receipts. The reviewer must pin the current plan and
authored/generated SHA values before reading, verify the exact property order
and six pins, falsify the 59/41/2,428/3,975 joins independently, execute the
v1-installed/v2-target transition, inspect pathname/descriptor and paired
publication rollback/recovery boundaries, verify complete frozen scope, and
return severity/confidence/file:line findings plus one verdict:

```text
APPROVE
REQUEST_CHANGES
BLOCKED
```

Only `APPROVE` with no unresolved high/medium finding completes T2. This review does not approve T3-T5, release/deploy, or live Discord parity.

- [ ] **Step 5: Produce the final no-Git handoff**

Report:

```text
Authored file before -> after SHA-256
Generated artifact SHA-256 and byte size
Current raw-source pointer
RED receipt
Focused/global/adjacent gate results
50/50 atomic mutation variants and 22/22 category results
Frozen-scope hash comparison
Independent reviewer verdict
Explicit T3-T5 and live-proof exclusions
```

No completion claim is valid if any field is missing, any test is unrun/failing, any owned temporary residue remains, or the reviewer has not approved the exact final hashes.
