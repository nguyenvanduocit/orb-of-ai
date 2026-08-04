# DiscordHero Starter Selection and Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new player choose exactly one of Knight `101`, Ranger `201`, or Sorcerer `301` before any player row exists, then manage a one-to-three-slot ordered formation whose capacity is unlocked by source-backed Runes `21` and `24`.

**Architecture:** Opening DiscordHero becomes a read-only query that returns either an existing snapshot or the exact three starter candidates. Starter selection atomically creates revision `1` with all three standard heroes owned and party `[selected, null, null]`; subsequent fill, replace, and swap operations use pure domain transitions, optimistic revisions, request-bound idempotency, and catalog-derived formation capacity. The persisted schema stays version `1`; capacity and UI status are projections, while active-stage changes and the source-described 60-second cooldown remain runtime-oracle-gated.

**Tech Stack:** TypeScript 5.9, Bun test runner and `bun:sqlite`, Zod 4, discord.js 14 Components V2, SHA-256 content manifests, Prettier 3.9.6.

## Global Constraints

- User goal: a first-time DiscordHero player explicitly chooses a starter, then can evolve the ordered formation through the source-backed slot unlocks without stale, foreign, forged, or duplicate controls mutating state.
- A missing player remains missing after `/discordhero`: no player row and no idempotency receipt may exist before a valid starter choice.
- Starter candidates are exactly source rows `101`, `201`, and `301`, all `IsAvailable=true` and `IsFirstAvailable=true`; one and only one emitted option is selected.
- **MEDIUM confidence:** fresh `heroes[]` owns all three first-available standard heroes. This is the approved source-corpus inference from the catalog and progression guides; pristine before/after starter-save capture remains the runtime evidence needed to raise that confidence.
- Revision `1` is created atomically with `heroes.map(heroKey) === [101, 201, 301]`, `party === [selectedStarterKey, null, null]`, Gold `100`, and no owned Runes.
- Formation capacity is derived, never persisted: base `1`; owned reachable Rune `21/1` adds `1` after an exact `1_000` Gold purchase; owned reachable Rune `24/1` adds `1` after an exact `150_000` Gold purchase.
- Valid capacity is exactly `1 | 2 | 3`. Non-positive, fractional, or overflowing source values fail closed; no clamp and no hardcoded Rune-key summation.
- Every occupied party hero is owned and unique; slot `1` is occupied; occupied slots form a prefix; every locked slot is `null`.
- Per-slot controls support fill, replace, and swap. They never emit an Empty option and never mutate hero ownership.
- A formation change with `stageSession !== null` is rejected. Do not add a cooldown timestamp or claim the 60-second source behavior in this slice.
- Starter and formation custom IDs are owner-bound. Starter uses null revision token `new_`; existing formation uses canonical positive base-36 revisions and `s-1`, `s-2`, or `s-3`.
- Foreign owner rejection occurs before runtime or repository access. Stale, locked, malformed, and off-menu controls perform zero transactions. Duplicate delivery replays the first receipt without another revision.
- `src/discord-hero/state/repository.ts`, SQL schema, and transaction ordering remain unchanged.
- Persisted JSON remains schema version `1`; do not add `starter`, `onboarding`, `formationCapacity`, or cooldown fields.
- Greenfield release boundary: no migration or compatibility branch. Store reset or deployment is a separate explicitly authorized action.
- The checkout is not Git-managed. Every task ends with a SHA-256 checkpoint instead of a commit; never use `git add`, `git commit`, reset, checkout, or worktree commands.
- Keep tasks sequential. A file is owned by exactly one task in the ownership map below.

---

## Evidence and Current Contracts

### Pinned source evidence

| Fact                                                                                             | Evidence                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `101`, `201`, and `301` are the three first-available heroes                                     | `preferences/taskbarhero/database/heroes.md:25-30`; compiled catalog SHA-256 `2a046b2b0f5c1ddff451dddadf13a7b9c8d6d112b1c6455ccda59f2af9e879f2` |
| The first screen asks the player to choose a class and Formation permits class switching         | `preferences/taskbarhero/guides/task-bar-hero-101.md:40-54`                                                                                     |
| Fresh capacity is one; the second slot is the first target; Sorcerer can later occupy slot three | `preferences/taskbarhero/guides/f2p-guide-for-early-game.md:42-64`                                                                              |
| Rune `21/1` costs `1_000` Gold and contributes `UnlockArrangeSlotCount=1`                        | `preferences/taskbarhero/database/rune_levels.md:194`                                                                                           |
| Rune `24/1` costs `150_000` Gold and contributes `UnlockArrangeSlotCount=1`                      | `preferences/taskbarhero/database/rune_levels.md:203`                                                                                           |
| Runtime field authority is hero collection/unlock/key plus ordered `arrangedHeroKey`             | `preferences/taskbarhero/oracles/hero-unlock-investigation-v1.json:20-34`                                                                       |
| The cooldown and live-stage transition remain unresolved                                         | `preferences/taskbarhero/guides/task-bar-hero-101.md:48-54`; oracle has no before/after formation delta                                         |

### Existing code to preserve and reuse

- `PlayerState.party` is already a three-nullable-key tuple with uniqueness and ownership checks (`src/discord-hero/domain/player.ts:52-61,218-317`).
- Fresh helpers currently deploy all three starters and must take an explicit selected key (`domain/player.ts:367-402`, `domain/invariants.ts:889-976`).
- `projectOwnedRuneSourceEffects()` already emits typed `arrange-slot-source-metadata`, including raw value and source cost provenance (`domain/rune-effects.ts:81-104,144-150,634-641,672-703`).
- Generic transition validation currently blocks every party change and must admit only transitions produced by the new pure operation (`domain/invariants.ts:640-705`).
- `transactPlayer()` checks a matching receipt before revision comparison, then atomically inserts revision `1` and its receipt (`state/repository.ts:1412-1491,1541-1653`).
- The current custom-ID grammar accepts only positive revisions (`ui/custom-id.ts:37-69,86-150`).
- Party rendering exposes raw keys and emits no Party control (`ui/workspace.ts:3478-3486,3804-4015`).
- Home currently classifies every null tuple entry as empty and alerts on locked slots (`ui/home.ts:24-34,194-210,284-290`).
- Slash execution currently persists before rendering, and select handling assumes a row exists (`commands/discordhero.ts:186-227,1724-1745`).
- The E2E kit already enforces one acknowledgement, owner-bound parsable IDs, emitted menu membership, private Components V2, disabled pings, no attachments, unique IDs, Discord length/count bounds, and sandbox/WAL/SHM cleanup (`commands/discordhero.e2e-testkit.ts:24-237`).

### Current baseline hashes

The design was pinned against these verified current digests:

```text
2a83a1757de27c229d4e382993e929c2d05ef9b6259ee4e7cd219108e7bb746c  src/discord-hero/domain/player.ts
874172153b78bc9af97f02bb8afe73938b844bb6fa70a6d29b44bc3290ec4eea  src/discord-hero/domain/invariants.ts
a10470bb970ab84023d7082aa3a91b84be01d9946a0f2420a673e9791491d1e2  src/discord-hero/domain/runes.ts
9b1f5de1938e07949b797c717650f924836c0e3e94a4ed385b3485f511d7314f  src/discord-hero/domain/rune-effects.ts
976563bfc4b125f47f887a767f1b2ac7e77dc873b2ec56dff0a0f77d24e3bb96  src/discord-hero/use-cases/open-workspace.ts
b86834fdf48d45219fcd2d4d07f4ef2276847eb3d1a4087866acd2d595939033  src/discord-hero/use-cases/upgrade-rune.ts
5cb814ebc49ae0a9a05152554f0d03afc653c458d66e43436b60ae7c6a8e2a32  src/discord-hero/state/repository.ts
3ddab7c6063fe7e86fff8bdc3d1ef36b9862b5f1f2cf7d7560705a91e35ba68a  src/discord-hero/ui/custom-id.ts
cff22b522977db855983da4a43cfe877f3aaa9b91cd5c944ba05070bf0f7df73  src/discord-hero/ui/workspace.ts
f1410e96fe6c89b129faf26b6613a11049489de35ff422e653431cff34068277  src/discord-hero/ui/home.ts
f3dcceed5ca2befca3921907d5b33261358d7822526f1f5dcbd5017b3ae3eac4  src/commands/discordhero.ts
e08ae935f04ded0b9c92c1711f0d53fb5a9267aa6ee8d6d35d17221f850c9da0  package.json
95efcff7454e1e55d066f69c5be51a3b76da0cd042ba69691e01b25ace62bc2c  bun.lock
```

Before Task 1, re-run `git rev-parse --show-toplevel` and require the expected `fatal: not a git repository`. Save a complete manifest outside the checkout:

```bash
rg --files src/discord-hero src/commands docs \
  | sort \
  | xargs shasum -a 256 \
  > /tmp/discordhero-starter-formation.before.sha256
shasum -a 256 package.json bun.lock \
  > /tmp/discordhero-starter-formation.dependencies.before.sha256
```

### Sequential file ownership

| Task | Exclusive ownership                                                                                                                                                                                   |
| ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | `domain/player.ts`, `domain/party.ts`, `domain/party.test.ts`, `domain/invariants.ts`, `domain/invariants.test.ts`, `state/repository.test.ts`, and the unrelated fixture-call tests listed in Task 1 |
|    2 | `domain/runes.ts`, `domain/runes.test.ts`, `use-cases/upgrade-rune.test.ts`                                                                                                                           |
|    3 | `use-cases/open-workspace.ts`, `use-cases/open-workspace.test.ts`, `use-cases/unlock-container-slot.test.ts`, `use-cases/unlock-cube-recipe.test.ts`                                                  |
|    4 | `use-cases/select-starter.ts`, `use-cases/select-starter.test.ts`                                                                                                                                     |
|    5 | `use-cases/arrange-party.ts`, `use-cases/arrange-party.test.ts`                                                                                                                                       |
|    6 | `ui/custom-id.ts`, `ui/custom-id.test.ts`, `ui/starter.ts`, `ui/starter.test.ts`                                                                                                                      |
|    7 | `ui/party.ts`, `ui/party.test.ts`, `ui/home.ts`, `ui/home.test.ts`                                                                                                                                    |
|    8 | `ui/workspace.ts`, `ui/workspace.test.ts`                                                                                                                                                             |
|    9 | `commands/discordhero.e2e.test.ts`                                                                                                                                                                    |
|   10 | `commands/discordhero.ts`, `commands/discordhero.test.ts`                                                                                                                                             |
|   11 | No writes; final E2E repeat/concurrency verification only                                                                                                                                             |
|   12 | `docs/DISCORDHERO_PARITY.md`, `docs/DISCORDHERO_ARCHITECTURE.md`                                                                                                                                      |
|   13 | No writes; independent verification and scope audit only                                                                                                                                              |

`domain/rune-effects.ts`, `use-cases/upgrade-rune.ts`, `state/repository.ts`, `runtime.ts`, `package.json`, and `bun.lock` are read-only dependencies for this slice.

---

### Task 1: Pure Formation Domain, Explicit Fresh Factory, and Catalog Invariants

**Files:**

- Create: `src/discord-hero/domain/party.ts`
- Create: `src/discord-hero/domain/party.test.ts`
- Modify: `src/discord-hero/domain/player.ts:367-403`
- Modify: `src/discord-hero/domain/invariants.ts:1-18,640-705,876-983,1078-1096`
- Modify: `src/discord-hero/domain/invariants.test.ts`
- Modify: `src/discord-hero/state/repository.test.ts`
- Modify only for explicit starter fixture calls:
  - `src/discord-hero/domain/attribute-effects.test.ts`
  - `src/discord-hero/domain/attributes.test.ts`
  - `src/discord-hero/domain/containers.test.ts`
  - `src/discord-hero/domain/cube-unlocks.test.ts`
  - `src/discord-hero/domain/equipment.test.ts`
  - `src/discord-hero/domain/heroes.test.ts`
  - `src/discord-hero/domain/item-effects.test.ts`
  - `src/discord-hero/ui/alchemy.test.ts`
  - `src/discord-hero/ui/attributes.test.ts`
  - `src/discord-hero/ui/containers.test.ts`
  - `src/discord-hero/ui/cube.test.ts`
  - `src/discord-hero/ui/inventory.test.ts`
  - `src/discord-hero/ui/item-effects.test.ts`
  - `src/discord-hero/use-cases/alchemy.test.ts`
  - `src/discord-hero/use-cases/allocate-attribute-point.test.ts`
  - `src/discord-hero/use-cases/equipment.test.ts`

**Interfaces:**

- Consumes: `projectOwnedRuneSourceEffects({ indexes, ownedRunes })` from `domain/rune-effects.ts`.
- Produces:

```ts
export const DISCORD_HERO_STARTER_KEYS = [101, 201, 301] as const;
export type DiscordHeroStarterKey = (typeof DISCORD_HERO_STARTER_KEYS)[number];
export type DiscordHeroFormationCapacity = 1 | 2 | 3;
export type DiscordHeroPartySlot = 1 | 2 | 3;

export interface DiscordHeroStarterCandidate {
  readonly heroKey: DiscordHeroStarterKey;
  readonly name: string;
  readonly classType: string;
}

export function discordHeroStarterCandidates(
  indexes: DiscordHeroCatalogIndexes,
): readonly DiscordHeroStarterCandidate[];

export function deriveDiscordHeroFormationCapacity(
  indexes: DiscordHeroCatalogIndexes,
  ownedRunes: PlayerState["runes"],
): DiscordHeroFormationCapacity;

export type ArrangePartySlotResult =
  | Readonly<{
      kind: "changed";
      transition: "fill" | "replace" | "swap";
      targetSlot: DiscordHeroPartySlot;
      selectedHeroKey: number;
      previousHeroKey: number | null;
      sourceSlot: DiscordHeroPartySlot | null;
      state: PlayerState;
    }>
  | Readonly<{ kind: "unchanged" }>
  | Readonly<{ kind: "slot-locked"; capacity: DiscordHeroFormationCapacity }>
  | Readonly<{ kind: "hero-not-owned" }>
  | Readonly<{ kind: "stage-active" }>
  | Readonly<{ kind: "invalid-target" }>;

export function arrangePartySlot(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  targetSlot: number,
  selectedHeroKey: number,
): ArrangePartySlotResult;

export function isDiscordHeroPartyTransition(
  indexes: DiscordHeroCatalogIndexes,
  previous: PlayerState,
  current: PlayerState,
): boolean;

export function createFreshPlayerState(
  starterHeroKey: DiscordHeroStarterKey,
): PlayerState;

export function createFreshPlayerStateFromCatalog(
  indexes: DiscordHeroCatalogIndexes,
  starterHeroKey: DiscordHeroStarterKey,
): PlayerState;
```

- `discordHeroStarterCandidates()` filters `IsFirstAvailable`, requires exactly three rows, requires every row to be available, requires the ordered keys to equal `[101, 201, 301]`, and returns frozen detached `{heroKey,name,classType}` values.
- `deriveDiscordHeroFormationCapacity()` starts at `1`, consumes only owned reachable effects whose kind/stat type are `arrange-slot-source-metadata`/`UnlockArrangeSlotCount`, requires each `rawValue` to be a positive safe integer, and rejects totals outside `1..3`.
- `isDiscordHeroPartyTransition()` returns true for an unchanged party or when one call to `arrangePartySlot()` from `previous` reproduces `current.party`; it never admits hero ownership mutation.

- [ ] **Step 1: Write the failing fresh-state, capacity, transition, and invariant tests**

Add table-driven starter tests and exact mutation cases:

```ts
for (const selected of [101, 201, 301] as const) {
  const state = createFreshPlayerStateFromCatalog(indexes, selected);
  expect(state.heroes.map((hero) => hero.heroKey)).toEqual([101, 201, 301]);
  expect(state.party).toEqual([selected, null, null]);
  expect(state.gold).toBe(100);
  expect(state.runes).toEqual([]);
  expect(validatePlayerAgainstCatalog(state, indexes)).toEqual(state);
}

expect(deriveDiscordHeroFormationCapacity(indexes, [])).toBe(1);
expect(
  deriveDiscordHeroFormationCapacity(indexes, [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
  ]),
).toBe(2);
expect(
  deriveDiscordHeroFormationCapacity(indexes, [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
    { key: 22, level: 1 },
    { key: 23, level: 1 },
    { key: 24, level: 1 },
  ]),
).toBe(3);
```

Assert Rune `21` provenance has `costValue: 1_000`, `rawValue: 1`, and Rune `24` provenance has `costValue: 150_000`, `rawValue: 1`. Mutate the catalog effect to `0`, `1.5`, and `3`; each must throw and must not clamp.

Cover all transition outcomes:

```ts
expect(arrangePartySlot(indexes, base, 1, 201)).toMatchObject({
  kind: "changed",
  transition: "replace",
  targetSlot: 1,
  selectedHeroKey: 201,
  previousHeroKey: 101,
  sourceSlot: null,
  state: { party: [201, null, null] },
});
expect(arrangePartySlot(indexes, capacityTwo, 2, 201)).toMatchObject({
  kind: "changed",
  transition: "fill",
  state: { party: [101, 201, null] },
});
expect(arrangePartySlot(indexes, capacityTwoFilled, 1, 201)).toMatchObject({
  kind: "changed",
  transition: "swap",
  sourceSlot: 2,
  state: { party: [201, 101, null] },
});
expect(arrangePartySlot(indexes, capacityTwoFilled, 2, 301)).toMatchObject({
  kind: "changed",
  transition: "replace",
  state: { party: [101, 301, null] },
});
```

Also assert no-op, locked target, unowned/DLC hero, malformed slot/key, deployed-hero-to-empty, and active-stage results; input JSON must be byte-for-byte unchanged and returned result/state must be detached according to the existing `upgradeRune()` convention.

In `invariants.test.ts`, assert rejection of `[null,null,null]`, holes such as `[101,null,201]`, occupied locked slots, duplicate/unowned heroes, Rune `24` without its graph path, and capacity overflow. Assert valid replace/fill/swap transitions pass `validatePlayerAgainstCatalog(next,indexes,previous)`, while ownership changes still fail.

- [ ] **Step 2: Run the focused tests and capture the exact RED receipt**

Run:

```bash
bun test \
  src/discord-hero/domain/party.test.ts \
  src/discord-hero/domain/invariants.test.ts \
  src/discord-hero/state/repository.test.ts
```

Expected: FAIL because `domain/party.ts` and its exports do not exist, fresh factories still take no starter, and invariant validation still rejects party transitions.

- [ ] **Step 3: Implement the minimal pure domain and explicit factories**

The capacity fold must follow this shape:

```ts
let capacity = 1;
for (const effect of projectOwnedRuneSourceEffects({ indexes, ownedRunes })
  .sourceEffects) {
  if (
    effect.kind !== "arrange-slot-source-metadata" ||
    effect.statType !== "UnlockArrangeSlotCount"
  ) {
    continue;
  }
  if (!Number.isSafeInteger(effect.rawValue) || effect.rawValue < 1) {
    throw new Error(
      "formation slot contribution must be a positive safe integer",
    );
  }
  capacity += effect.rawValue;
}
if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 3) {
  throw new Error(
    `formation capacity ${capacity} exceeds the three-slot party`,
  );
}
return capacity as DiscordHeroFormationCapacity;
```

`arrangePartySlot()` must validate numeric inputs before indexing, reject an active stage, derive capacity, preserve ownership, clone only for a changed result, and use deterministic cases in this order: same target hero, locked slot, empty target, deployed selected hero, replacement, swap.

Change fresh party creation to:

```ts
party: [starterHeroKey, null, null],
heroes: starterProgress,
```

After `validateRunes(player,indexes)`, derive capacity and validate slot `0` occupied, the occupied prefix, and every index `>= capacity` null. Replace the blanket party-transition rejection with `isDiscordHeroPartyTransition(indexes, previous, current)`.

Update every Task 1 test fixture call to pass `101` explicitly. Do not add a default parameter or overload that permits omission.

- [ ] **Step 4: Run Task 1 GREEN tests**

Run:

```bash
bun test \
  src/discord-hero/domain/party.test.ts \
  src/discord-hero/domain/invariants.test.ts \
  src/discord-hero/state/repository.test.ts \
  src/discord-hero/domain/attribute-effects.test.ts \
  src/discord-hero/domain/attributes.test.ts \
  src/discord-hero/domain/containers.test.ts \
  src/discord-hero/domain/cube-unlocks.test.ts \
  src/discord-hero/domain/equipment.test.ts \
  src/discord-hero/domain/heroes.test.ts \
  src/discord-hero/domain/item-effects.test.ts \
  src/discord-hero/ui/alchemy.test.ts \
  src/discord-hero/ui/attributes.test.ts \
  src/discord-hero/ui/containers.test.ts \
  src/discord-hero/ui/cube.test.ts \
  src/discord-hero/ui/inventory.test.ts \
  src/discord-hero/ui/item-effects.test.ts \
  src/discord-hero/use-cases/alchemy.test.ts \
  src/discord-hero/use-cases/allocate-attribute-point.test.ts \
  src/discord-hero/use-cases/equipment.test.ts
```

Expected: PASS. The full typecheck is deferred until Tasks 2, 3, 7, 8, 9, and 10 update their exclusively owned call sites.

- [ ] **Step 5: Kill the domain mutants**

Temporarily make each one-line mutation, run the focused command, require failure, then reverse the edit:

1. Return base capacity `2`.
2. Sum `effect.provenance.costValue` instead of `effect.rawValue`.
3. Clamp capacity with `Math.min(capacity, 3)`.
4. Build fresh party from all starter rows.
5. Force fresh party slot `1` to `101`.
6. Permit a party transition without reproducing it through `arrangePartySlot()`.

Run after each mutation:

```bash
bun test src/discord-hero/domain/party.test.ts src/discord-hero/domain/invariants.test.ts
```

Expected: FAIL for every mutant. After reversal, require PASS and record:

```bash
shasum -a 256 \
  src/discord-hero/domain/player.ts \
  src/discord-hero/domain/party.ts \
  src/discord-hero/domain/party.test.ts \
  src/discord-hero/domain/invariants.ts \
  src/discord-hero/domain/invariants.test.ts \
  src/discord-hero/state/repository.test.ts \
  src/discord-hero/domain/attribute-effects.test.ts \
  src/discord-hero/domain/attributes.test.ts \
  src/discord-hero/domain/containers.test.ts \
  src/discord-hero/domain/cube-unlocks.test.ts \
  src/discord-hero/domain/equipment.test.ts \
  src/discord-hero/domain/heroes.test.ts \
  src/discord-hero/domain/item-effects.test.ts \
  src/discord-hero/ui/alchemy.test.ts \
  src/discord-hero/ui/attributes.test.ts \
  src/discord-hero/ui/containers.test.ts \
  src/discord-hero/ui/cube.test.ts \
  src/discord-hero/ui/inventory.test.ts \
  src/discord-hero/ui/item-effects.test.ts \
  src/discord-hero/use-cases/alchemy.test.ts \
  src/discord-hero/use-cases/allocate-attribute-point.test.ts \
  src/discord-hero/use-cases/equipment.test.ts \
  > /tmp/discordhero-starter-formation.task1.sha256
```

---

### Task 2: Make Arrangement Runes Purchasable

**Files:**

- Modify: `src/discord-hero/domain/runes.ts:189-217`
- Modify: `src/discord-hero/domain/runes.test.ts:1-330`
- Modify: `src/discord-hero/use-cases/upgrade-rune.test.ts`

**Interfaces:**

- Consumes: explicit `createFreshPlayerStateFromCatalog(indexes, 101)` and `deriveDiscordHeroFormationCapacity(indexes,state.runes)`.
- Produces: existing `quoteRuneUpgrade()` returns `kind:"available"` for exact next-level `STATTYPE === "UnlockArrangeSlotCount"`; existing `upgradeRune()` and `upgradeDiscordHeroRune()` need no signature change.

- [ ] **Step 1: Change the current unsupported-effect test to RED capacity-upgrade tests**

For Rune `21`, seed only its valid graph path and exact funds:

```ts
state.gold = 1_000;
state.runes = [
  { key: 1, level: 1 },
  { key: 20, level: 1 },
];
expect(quoteRuneUpgrade(indexes, state, 21)).toMatchObject({
  kind: "available",
  cost: 1_000,
  canAfford: true,
  statType: "UnlockArrangeSlotCount",
  value: 1,
});
const upgraded = upgradeRune(indexes, state, 21);
expect(upgraded).toMatchObject({
  kind: "upgraded",
  state: {
    gold: 0,
    party: [101, null, null],
    runes: [
      { key: 1, level: 1 },
      { key: 20, level: 1 },
      { key: 21, level: 1 },
    ],
  },
});
```

Assert capacity changes `1 -> 2`. For Rune `24`, seed `1,20,21,22,23` at level `1` and `150_000` Gold, then assert exact debit, `{key:24,level:1}`, capacity `2 -> 3`, and unchanged party. Keep Rune `27` unsupported.

In `upgrade-rune.test.ts`, assert committed revision, replay, insufficient Gold, prerequisite failure, stale revision, and no duplicate Rune. Pass explicit starter `101` in its fixture.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test \
  src/discord-hero/domain/runes.test.ts \
  src/discord-hero/use-cases/upgrade-rune.test.ts
```

Expected: FAIL because `UnlockArrangeSlotCount` still returns `unsupported-effect`.

- [ ] **Step 3: Extend only the supported-effect predicate**

Use the exact next-level source stat type:

```ts
if (
  level.STATTYPE !== "CubeAlchemyGoldPercent" &&
  level.STATTYPE !== "CubeExpPercent" &&
  level.STATTYPE !== "UnlockArrangeSlotCount"
) {
  return Object.freeze({ kind: "unsupported-effect" /* existing fields */ });
}
```

Do not key behavior on Rune `21` or `24`. Do not modify the upgrade mutation or persist capacity.

- [ ] **Step 4: Run GREEN and mutation checks**

Run:

```bash
bun test \
  src/discord-hero/domain/runes.test.ts \
  src/discord-hero/use-cases/upgrade-rune.test.ts \
  src/discord-hero/domain/party.test.ts
```

Expected: PASS.

Temporarily remove the new stat type from the supported predicate, then run the same command and require failure. Temporarily make Rune `21` auto-fill slot `2`, require the party-unchanged assertions to fail, reverse both edits, and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/domain/runes.ts \
  src/discord-hero/domain/runes.test.ts \
  src/discord-hero/use-cases/upgrade-rune.test.ts \
  > /tmp/discordhero-starter-formation.task2.sha256
```

---

### Task 3: Make Workspace Open a Read-Only Query

**Files:**

- Modify: `src/discord-hero/use-cases/open-workspace.ts:1-121`
- Modify: `src/discord-hero/use-cases/open-workspace.test.ts:1-108`
- Modify: `src/discord-hero/use-cases/unlock-container-slot.test.ts`
- Modify: `src/discord-hero/use-cases/unlock-cube-recipe.test.ts`

**Interfaces:**

- Consumes: `discordHeroStarterCandidates(indexes)` from Task 1 and repository `getPlayer(userId)`.
- Produces:

```ts
export interface OpenWorkspaceInput {
  readonly userId: string;
}

export type OpenWorkspaceResult =
  | Readonly<{ status: "ready"; snapshot: PlayerSnapshot }>
  | Readonly<{
      status: "starter-required";
      candidates: readonly DiscordHeroStarterCandidate[];
    }>;

export function openDiscordHeroWorkspace(
  repository: Pick<WorkspaceRepository, "getPlayer">,
  indexes: DiscordHeroCatalogIndexes,
  input: OpenWorkspaceInput,
): OpenWorkspaceResult;
```

- Remove `interactionId`, `nowMs`, `created`, outcome decoding, create retries, and `transactPlayer()` from this module.

- [ ] **Step 1: Replace create-on-open tests with read-only union tests**

Use a spy repository:

```ts
let transactions = 0;
const queryOnly = {
  getPlayer: store.getPlayer.bind(store),
  transactPlayer: () => {
    transactions += 1;
    throw new Error("open must not transact");
  },
};
const result = openDiscordHeroWorkspace(queryOnly, indexes, { userId: "123" });
expect(result).toEqual({
  status: "starter-required",
  candidates: [
    { heroKey: 101, name: "Knight", classType: "Knight" },
    { heroKey: 201, name: "Ranger", classType: "Ranger" },
    { heroKey: 301, name: "Sorcerer", classType: "Sorcerer" },
  ],
});
expect(transactions).toBe(0);
expect(store.getPlayer("123")).toBeNull();
```

Query SQLite and assert both `players` and `idempotency` counts remain `0`. Seed a valid revision-1 player through the repository, reopen, and assert `{status:"ready",snapshot}` without another write. Invalid user IDs must fail before repository access.

Replace `openDiscordHeroWorkspace()` as a seed helper in the two unlock tests with an explicit repository seed using `createFreshPlayerStateFromCatalog(indexes,101)`.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test \
  src/discord-hero/use-cases/open-workspace.test.ts \
  src/discord-hero/use-cases/unlock-container-slot.test.ts \
  src/discord-hero/use-cases/unlock-cube-recipe.test.ts
```

Expected: FAIL because open still creates revision `1` and a receipt.

- [ ] **Step 3: Implement the read-only query**

The complete branch is:

```ts
const snapshot = repository.getPlayer(input.userId);
if (snapshot === null) {
  return Object.freeze({
    status: "starter-required",
    candidates: discordHeroStarterCandidates(indexes),
  });
}
validatePlayerAgainstCatalog(snapshot.state, indexes);
return Object.freeze({
  status: "ready",
  snapshot: structuredClone(snapshot),
});
```

Keep strict snowflake validation. A returned ready snapshot must be detached from repository storage.

- [ ] **Step 4: Run GREEN and prove zero writes**

Run the Step 2 command. Expected: PASS.

Run the missing-player test twice and compare the SQLite projection before/after:

```sql
SELECT COUNT(*) AS count FROM players;
SELECT COUNT(*) AS count FROM idempotency;
PRAGMA integrity_check;
```

Expected: `0`, `0`, and `ok`.

Record:

```bash
shasum -a 256 \
  src/discord-hero/use-cases/open-workspace.ts \
  src/discord-hero/use-cases/open-workspace.test.ts \
  src/discord-hero/use-cases/unlock-container-slot.test.ts \
  src/discord-hero/use-cases/unlock-cube-recipe.test.ts \
  > /tmp/discordhero-starter-formation.task3.sha256
```

---

### Task 4: Atomic Starter Selection Use Case

**Files:**

- Create: `src/discord-hero/use-cases/select-starter.ts`
- Create: `src/discord-hero/use-cases/select-starter.test.ts`

**Interfaces:**

- Consumes: `discordHeroStarterCandidates()`, `createFreshPlayerStateFromCatalog(indexes,starterHeroKey)`, `validatePlayerAgainstCatalog()`, and `PlayerTransaction`.
- Produces:

```ts
export interface SelectStarterInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly starterHeroKey: number;
  readonly nowMs: number;
}

export interface SelectStarterOutcome {
  readonly kind: "selected";
  readonly starterHeroKey: DiscordHeroStarterKey;
}

export function decodeDiscordHeroSelectStarterOutcome(
  value: unknown,
): SelectStarterOutcome;

export function selectDiscordHeroStarter(
  repository: StarterRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: SelectStarterInput,
): PlayerTransactionResult<SelectStarterOutcome>;
```

Transaction constants are exact: scope `discordhero.starter`, operation `select-starter`, expected revision `null`, SHA payload `discordhero.select-starter/v1\nstarterHeroKey=<key>`.

- [ ] **Step 1: Write transaction RED tests**

Test all three valid starters. Each result commits revision `1`; persisted state owns `[101,201,301]` and deploys exactly the selected key. Repeating the same interaction/key must return the byte-identical outcome and leave row count/state/revision unchanged.

Also assert:

```ts
expect(() =>
  selectDiscordHeroStarter(store, indexes, {
    userId: "123",
    interactionId: "invalid",
    starterHeroKey: 401,
    nowMs: 1,
  }),
).toThrow(/starter/i);
expect(store.getPlayer("123")).toBeNull();
```

Repeat for unknown/malformed keys and catalog mutations with a flipped `IsFirstAvailable`, duplicated starter row, or starter count other than three. Use a transaction spy to prove invalid inputs never call `transactPlayer()`.

Race two different interaction IDs against expected missing state: exactly one commits; the other raises `DiscordHeroRevisionConflictError`. Replay the winning interaction after the row exists; it must still return the stored commit because repository receipt lookup precedes revision comparison. Reuse one interaction ID with a different starter; require `DiscordHeroIdempotencyConflictError`.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test src/discord-hero/use-cases/select-starter.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict input, request hashing, decoding, and transaction**

Validate the chosen key against the recomputed candidate list before calling the repository. The mutation is:

```ts
mutate: (current) => {
  if (current !== null) {
    throw new Error("starter selection expected a missing player");
  }
  const state = createFreshPlayerStateFromCatalog(indexes, starterHeroKey);
  validatePlayerAgainstCatalog(state, indexes);
  return {
    kind: "commit",
    state,
    outcome: { kind: "selected", starterHeroKey },
  };
},
```

Do not query `getPlayer()` before `transactPlayer()`.

- [ ] **Step 4: Run GREEN and request-hash mutants**

Run:

```bash
bun test \
  src/discord-hero/use-cases/select-starter.test.ts \
  src/discord-hero/state/repository.test.ts
```

Expected: PASS.

Temporarily remove `starterHeroKey` from the SHA payload; the same-interaction/different-starter conflict test must fail. Temporarily add a pre-transaction row check; the replay-after-row-exists test must fail. Reverse edits and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/use-cases/select-starter.ts \
  src/discord-hero/use-cases/select-starter.test.ts \
  > /tmp/discordhero-starter-formation.task4.sha256
```

---

### Task 5: Idempotent Arrange-Party Use Case

**Files:**

- Create: `src/discord-hero/use-cases/arrange-party.ts`
- Create: `src/discord-hero/use-cases/arrange-party.test.ts`

**Interfaces:**

- Consumes: `arrangePartySlot()`, `validatePlayerAgainstCatalog()`, and `PlayerTransaction`.
- Produces:

```ts
export interface ArrangePartyInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly expectedRevision: number;
  readonly targetSlot: number;
  readonly selectedHeroKey: number;
  readonly nowMs: number;
}

export type ArrangePartyOutcome =
  | Readonly<{
      kind: "arranged";
      transition: "fill" | "replace" | "swap";
      targetSlot: DiscordHeroPartySlot;
      selectedHeroKey: number;
      previousHeroKey: number | null;
      sourceSlot: DiscordHeroPartySlot | null;
    }>
  | Readonly<{ kind: "unchanged" }>
  | Readonly<{ kind: "slot-locked"; capacity: DiscordHeroFormationCapacity }>
  | Readonly<{ kind: "hero-not-owned" }>
  | Readonly<{ kind: "stage-active" }>
  | Readonly<{ kind: "invalid-target" }>;

export function arrangeDiscordHeroParty(
  repository: PartyRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: ArrangePartyInput,
): PlayerTransactionResult<ArrangePartyOutcome>;
```

Transaction constants: scope `discordhero.party`, operation `arrange-party`, SHA payload `discordhero.arrange-party/v1\ntargetSlot=<slot>\nselectedHeroKey=<key>`.

- [ ] **Step 1: Write RED tests for commit, deterministic rejection, replay, and conflict**

Create separate cases for replace at capacity `1`, fill/replace/swap at capacity `2`, and fill slot `3` at capacity `3`. Assert exact ordered party and ownership stability after every commit.

For `unchanged`, locked, unowned, malformed, and active-stage outcomes, assert status `rejected`, unchanged revision/state JSON, and one replayable receipt. For an absent player with the required positive `expectedRevision`, assert `DiscordHeroRevisionConflictError`, prove the mutation callback is never invoked, and require zero player rows and zero idempotency receipts. Assert stale expected revision throws before mutation. Assert same interaction with another slot or hero produces an idempotency conflict.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test src/discord-hero/use-cases/arrange-party.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the transaction shell around the pure transition**

Use this mutation sequence:

```ts
if (current === null) {
  throw new Error("arrange-party mutation requires an existing player");
}
validatePlayerAgainstCatalog(current, indexes);
const result = arrangePartySlot(
  indexes,
  current,
  input.targetSlot,
  input.selectedHeroKey,
);
if (result.kind !== "changed") {
  return { kind: "reject", outcome: result };
}
validatePlayerAgainstCatalog(result.state, indexes, current);
return {
  kind: "commit",
  state: result.state,
  outcome: {
    kind: "arranged",
    transition: result.transition,
    targetSlot: result.targetSlot,
    selectedHeroKey: result.selectedHeroKey,
    previousHeroKey: result.previousHeroKey,
    sourceSlot: result.sourceSlot,
  },
};
```

The null guard is a defensive invariant, not a domain outcome: with positive `expectedRevision`, `transactPlayer()` compares the absent row’s `actualRevision === null` first and throws `DiscordHeroRevisionConflictError` before invoking `mutate`. Never create a receipt for that absent-row path.

- [ ] **Step 4: Run GREEN and hash-binding mutants**

Run:

```bash
bun test \
  src/discord-hero/use-cases/arrange-party.test.ts \
  src/discord-hero/domain/party.test.ts
```

Expected: PASS.

Temporarily omit `targetSlot` from the request SHA, then omit `selectedHeroKey`; each corresponding conflict test must fail. Temporarily commit `unchanged`; the no-revision assertion must fail. Reverse edits and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/use-cases/arrange-party.ts \
  src/discord-hero/use-cases/arrange-party.test.ts \
  > /tmp/discordhero-starter-formation.task5.sha256
```

---

### Task 6: Nullable Revision IDs and the Private Starter Board

**Files:**

- Modify: `src/discord-hero/ui/custom-id.ts:37-69,86-150`
- Modify: `src/discord-hero/ui/custom-id.test.ts`
- Create: `src/discord-hero/ui/starter.ts`
- Create: `src/discord-hero/ui/starter.test.ts`

**Interfaces:**

- Consumes: `DiscordHeroStarterCandidate`, `encodeDiscordHeroCustomId()`, shared `text()`, and command-side `boardPayload()`.
- Produces:

```ts
export interface DiscordHeroCustomId {
  ownerId: string;
  view: DiscordHeroView;
  action: DiscordHeroAction;
  revision: number | null;
  value?: string;
}

export function renderDiscordHeroStarter(
  ownerId: string,
  candidates: readonly DiscordHeroStarterCandidate[],
  notice?: string,
): ContainerBuilder;
```

- Null revision encodes only as `new_`; positive revisions preserve canonical lowercase base-36.
- Starter menu custom ID is exactly `discordhero:<owner>:party:select:new_:starter`.

- [ ] **Step 1: Write RED custom-ID and starter-board tests**

Add:

```ts
const id = encodeDiscordHeroCustomId({
  ownerId: "123",
  view: "party",
  action: "select",
  revision: null,
  value: "starter",
});
expect(id).toBe("discordhero:123:party:select:new_:starter");
expect(decodeDiscordHeroCustomId(id)).toEqual({
  ownerId: "123",
  view: "party",
  action: "select",
  revision: null,
  value: "starter",
});
```

Reject `new`, `none`, `NEW_`, `new__`, `01`, and zero. Keep maximum-safe positive revision coverage.

Starter rendering must show one select with exactly three options, labels Knight/Ranger/Sorcerer, values `"101"`, `"201"`, `"301"`, no navigation IDs, no files/attachments after `boardPayload()`, V2 flag, disabled mentions, and all Discord bounds.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test \
  src/discord-hero/ui/custom-id.test.ts \
  src/discord-hero/ui/starter.test.ts
```

Expected: FAIL because null revision and the starter renderer do not exist.

- [ ] **Step 3: Implement exact revision grammar and starter rendering**

Revision codec:

```ts
function encodeRevision(revision: number | null): string {
  if (revision === null) return "new_";
  // retain the current positive-safe-integer validation
  return revision.toString(36);
}

function decodeRevision(encoded: string): number | null {
  if (encoded === "new_") return null;
  // retain the current canonical lowercase base-36 validation
}
```

Starter copy is affirmative and bounded: “Choose your first deployed hero. Knight, Ranger, and Sorcerer all remain available in Formation.” The container has one text display and one action row with one `StringSelectMenuBuilder`; it has no Home navigation.

- [ ] **Step 4: Run GREEN and codec mutation**

Run the Step 2 command. Expected: PASS.

Temporarily encode null as `new`; require the exact-ID and ambiguous-token tests to fail. Reverse and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/ui/custom-id.ts \
  src/discord-hero/ui/custom-id.test.ts \
  src/discord-hero/ui/starter.ts \
  src/discord-hero/ui/starter.test.ts \
  > /tmp/discordhero-starter-formation.task6.sha256
```

---

### Task 7: Formation Projection, Legal Slot Options, and Capacity-Aware Home

**Files:**

- Create: `src/discord-hero/ui/party.ts`
- Create: `src/discord-hero/ui/party.test.ts`
- Modify: `src/discord-hero/ui/home.ts:1-15,24-34,149-210,284-290`
- Modify: `src/discord-hero/ui/home.test.ts`

**Interfaces:**

- Consumes: `deriveDiscordHeroFormationCapacity()`, catalog localized hero names, and validated `PlayerState`.
- Produces:

```ts
export type DiscordHeroPartySlotStatus = "occupied" | "empty" | "locked";

export interface DiscordHeroPartyOption {
  readonly heroKey: number;
  readonly label: string;
  readonly value: string;
}

export interface DiscordHeroPartySlotProjection {
  readonly slot: DiscordHeroPartySlot;
  readonly status: DiscordHeroPartySlotStatus;
  readonly heroKey: number | null;
  readonly heroName: string | null;
  readonly options: readonly DiscordHeroPartyOption[];
}

export interface DiscordHeroPartyProjection {
  readonly capacity: DiscordHeroFormationCapacity;
  readonly occupied: number;
  readonly slots: readonly DiscordHeroPartySlotProjection[];
}

export function encodeDiscordHeroPartySlot(slot: DiscordHeroPartySlot): string;
export function decodeDiscordHeroPartySlot(value: string): DiscordHeroPartySlot;
export function projectDiscordHeroParty(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): DiscordHeroPartyProjection;
```

- Occupied slots expose all owned heroes as options, including current and already-deployed heroes.
- The first empty unlocked slot exposes only undeployed owned heroes.
- Later empty unlocked slots expose no options, because selecting them would create a forbidden hole.
- Locked slots expose no options.
- `DiscordHeroHomePartySlot` gains `{slot,status:"locked",hero:null}`.

- [ ] **Step 1: Write RED projection tests**

For capacity `1`, assert slot statuses `occupied,locked,locked`, `Formation 1/3`, and slot-1 options `[101,201,301]`. For capacity `2` with `[101,null,null]`, assert `occupied,empty,locked` and slot-2 options `[201,301]`. For `[101,201,null]`, occupied slot options include all three heroes so swap and replace are available. For capacity `3` with `[101,null,null]`, assert slot `2` options `[201,301]` and slot `3` options `[]`; after slot `2` is filled, slot `3` becomes the first empty slot and exposes the one undeployed hero.

Assert canonical slot encoding:

```ts
expect(encodeDiscordHeroPartySlot(1)).toBe("s-1");
expect(decodeDiscordHeroPartySlot("s-3")).toBe(3);
for (const invalid of ["s-0", "s-4", "s-01", "S-1", "1"]) {
  expect(() => decodeDiscordHeroPartySlot(invalid)).toThrow();
}
```

Home fresh state must project `occupied,locked,locked` and have no `empty-party-slots` alert. Capacity `2` with slot `2` empty alerts only `[2]`; locked slot `3` never alerts.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test \
  src/discord-hero/ui/party.test.ts \
  src/discord-hero/ui/home.test.ts
```

Expected: FAIL because Party projection is absent and Home treats locked slots as empty.

- [ ] **Step 3: Implement projection and Home status**

Derive Party status by comparing one-based slot to capacity. Resolve names through `getLocalizedCatalogName(indexes,"heroes",heroKey,"en-US")`; never use the raw key as the primary label.

Home null-slot branch:

```ts
if (heroKey === null) {
  return slot <= capacity
    ? { slot, status: "empty", hero: null }
    : { slot, status: "locked", hero: null };
}
```

Filter alerts only where `status === "empty"`. Pass explicit starter `101` in Home test fixtures and replace invalid hole fixtures with valid prefix formations.

- [ ] **Step 4: Run GREEN and locked-slot mutant**

Run the Step 2 command. Expected: PASS.

Temporarily classify every null as empty; fresh Home and Party tests must fail. Temporarily include deployed heroes in the empty-slot options; the exact slot-2 option test must fail. Reverse and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/ui/party.ts \
  src/discord-hero/ui/party.test.ts \
  src/discord-hero/ui/home.ts \
  src/discord-hero/ui/home.test.ts \
  > /tmp/discordhero-starter-formation.task7.sha256
```

---

### Task 8: Integrate the Formation Screen into the Workspace

**Files:**

- Modify: `src/discord-hero/ui/workspace.ts:1-180,617-662,3412-3486,3804-4015`
- Modify: `src/discord-hero/ui/workspace.test.ts`

**Interfaces:**

- Consumes: `projectDiscordHeroParty()`, `encodeDiscordHeroPartySlot()`, `encodeDiscordHeroCustomId()`, and existing `renderDiscordHeroWorkspace()`.
- Produces: Party body showing `Formation <capacity>/3`; one `party/select/<revision>/s-N` menu for each occupied actionable slot plus at most the first empty unlocked slot, bounded by capacity; no action for locked or later empty slots.

- [ ] **Step 1: Write RED workspace rendering tests**

Render Party at capacities `1`, `2`, and `3`. Assert:

- localized names and `Occupied`, `Empty (unlocked)`, `Locked`;
- no raw-key-only labels;
- exact menu count equals occupied actionable slots plus at most the first empty unlocked slot, bounded by capacity;
- IDs decode to owner, view `party`, action `select`, current revision, and the exact actionable `s-N` values;
- options exactly match Task 7 projection;
- IDs/options are unique and within Discord bounds;
- Home navigation remains present only for persisted workspaces.

Require these exact count/control cases: capacity `1` with `[101,null,null]` emits only `s-1`; capacity `2` with `[101,null,null]` emits `s-1,s-2`; capacity `3` with `[101,null,null]` still emits only `s-1,s-2` and no `s-3`; capacity `3` with `[101,201,null]` emits `s-1,s-2,s-3`.

Pass starter `101` to every `createFreshPlayerStateFromCatalog()` call owned by this file and replace hole fixtures with valid prefix formations.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test src/discord-hero/ui/workspace.test.ts
```

Expected: FAIL because Party still emits raw text and no controls.

- [ ] **Step 3: Compose the Party projection into the existing workspace**

Replace the current Party switch branch with projection-backed text:

```ts
[
  "## ⚔️ Party",
  `Formation ${party.capacity}/3`,
  ...party.slots.map((slot) =>
    slot.status === "occupied"
      ? `Slot ${slot.slot}: ${slot.heroName} · Occupied`
      : slot.status === "empty"
        ? `Slot ${slot.slot}: Empty (unlocked)`
        : `Slot ${slot.slot}: Locked`,
  ),
].join("\n");
```

After body components and before navigation, add a menu only for projected slots whose `options.length > 0`. Use option labels from `projectDiscordHeroParty()` and values as canonical decimal hero keys. The selector prompt text must identify the target slot.

- [ ] **Step 4: Run GREEN and emitted-control mutant**

Run:

```bash
bun test \
  src/discord-hero/ui/workspace.test.ts \
  src/discord-hero/ui/party.test.ts \
  src/discord-hero/ui/home.test.ts
```

Expected: PASS.

Temporarily omit the slot-2 row at capacity `2`; require the menu-count and exact-ID tests to fail. Temporarily emit slot `3` for capacity `3` with `[101,null,null]`; require the no-`s-3` assertion to fail. Temporarily emit a locked slot-3 menu at capacity `2`; require failure. Reverse and require PASS.

Record:

```bash
shasum -a 256 \
  src/discord-hero/ui/workspace.ts \
  src/discord-hero/ui/workspace.test.ts \
  > /tmp/discordhero-starter-formation.task8.sha256
```

---

### Task 9: Author Full Emitted-Control SQLite E2E Acceptance RED

**Files:**

- Modify: `src/commands/discordhero.e2e.test.ts`
- Read only: `src/commands/discordhero.e2e-testkit.ts`
- Read only: `src/commands/discordhero.e2e-testkit.test.ts`
- Read only: `src/commands/discordhero.ts`

**Interfaces:**

- Consumes: Tasks 1-8 domain, use-case, projection, workspace, and custom-ID contracts; existing exported `execute`, `handleButton`, and `handleSelect`; real catalog/runtime/repository; emitted-control harvesters and testkit gates.
- Produces: a fully authored behavior contract and exact RED receipt from emitted Discord controls through persisted SQLite state before Task 10 changes command production behavior.

- [ ] **Step 1: Replace the old fresh journey with complete starter and formation assertions**

Every happy-path ID and value comes from the immediately preceding payload:

1. Slash -> private starter board; assert SQLite player and receipt counts are zero.
2. Select emitted Ranger `201` -> Home revision `1`; SQLite state owns `[101,201,301]`, party `[201,null,null]`, Gold `100`, no Runes.
3. Reopen -> Home directly with no starter menu.
4. Emitted Home Party button -> emitted slot-1 menu -> emitted Knight `101` -> Party revision `2`, `[101,null,null]`.
5. Seed only `{1/1,20/1}` plus `1_000` Gold through a fixture transaction; use emitted Runes page/menu to purchase `21`; assert exact debit and capacity `2`; use emitted Party slot-2 menu to fill Ranger.
6. Seed the valid source path `{1,20,21,22,23}/1` plus `150_000` Gold; purchase emitted Rune `24`; assert exact debit/capacity `3`; fill slot `3`.
7. Use an emitted occupied-slot menu to select an already deployed hero and assert atomic swap.
8. Use an emitted occupied-slot menu to select the undeployed hero and assert replacement without ownership change.

Pass `101` explicitly in every E2E fixture that calls `createFreshPlayerStateFromCatalog()`.

- [ ] **Step 2: Add complete negative, replay, race, and restart assertions**

- Duplicate delivery: replay the same interaction ID/custom ID/value; player row count, serialized state, and revision remain unchanged after the first result.
- Stale: capture a Party control, commit a different action, then use the old control; compare `snapshotDiscordHeroSqlite()` before/after and require no transaction/state change.
- Foreign: another user activates the captured control; exactly one ephemeral denial and a repository/provider spy proves zero owner-state access.
- Forged/off-menu/locked: use a validly encoded locked `s-3` at capacity `1`, a hero absent from emitted options, malformed target, and multiple values; require zero transaction and no revision.
- Starter race: two no-row boards choose different starters; one revision `1` winner, loser refreshes winner.
- Arrange-player disappearance: remove the row after harvesting a positive-revision Party control, activate it, and require a starter refresh notice, zero player rows, and zero new idempotency receipts.
- Request binding: same interaction ID with different starter, slot, or hero conflicts without mutation.
- Restart: close/reopen the real SQLite repository and prove heroes, ordered party, Rune levels, and derived capacity persist.
- Every emitted response passes `assertDiscordHeroComponentPayload()` and acknowledgement cardinality; cleanup proves root, WAL, and SHM absence.

- [ ] **Step 3: Complete fixtures without hand-built happy IDs**

Use `pickButton()`/`pickMenu()` plus exact option search. Hand-built IDs are allowed only for negative malformed/locked/foreign probes. Query real SQLite `players` and `idempotency`; do not accept an in-memory snapshot as persistence proof.

- [ ] **Step 4: Run the emitted-control suite and capture behavior-only RED**

Run:

```bash
bun test \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --timeout 30000
```

Expected after Tasks 1-8 are GREEN and before Task 10: FAIL because slash still persists immediately and emitted Party selection is not handled. The receipt must name at least the read-only starter-open or emitted Party assertion; fixture, syntax, testkit, and unrelated baseline failures must be corrected within this task and rerun until the remaining failure is behavior-only.

- [ ] **Step 5: Record the complete E2E RED contract hash**

```bash
shasum -a 256 src/commands/discordhero.e2e.test.ts \
  > /tmp/discordhero-starter-formation.task9.sha256
```

Task 10 must make this exact hashed test contract GREEN without editing it.

---

### Task 10: Command Boundary for Starter, Formation, Race, and Zero-Write Rejections

**Files:**

- Modify: `src/commands/discordhero.ts:1-228,1724-1745,2886-3046,3122-3178`
- Modify: `src/commands/discordhero.test.ts`

**Interfaces:**

- Consumes:
  - `OpenWorkspaceResult` from Task 3;
  - `selectDiscordHeroStarter()` from Task 4;
  - `arrangeDiscordHeroParty()` from Task 5;
  - `renderDiscordHeroStarter()` from Task 6;
  - `decodeDiscordHeroPartySlot()` and `projectDiscordHeroParty()` from Task 7;
  - the immutable emitted-control acceptance contract and RED receipt from Task 9.
- Produces: `/discordhero` starter branch and `handleSelect()` branches for `party/select/new_/starter` and `party/select/<revision>/s-N` that make the Task 9 E2E contract GREEN.

- [ ] **Step 1: Write command RED tests with repository/runtime spies**

Slash missing-player expectations:

```ts
expect(opened.status).toBe("starter-required");
expect(repository.getPlayer("123")).toBeNull();
expect(transactionCalls).toBe(0);
expect(JSON.stringify(edit)).toContain("Choose your first deployed hero");
expect(
  collectSelectMenus(edit)[0]!.options.map((option) => option.value),
).toEqual(["101", "201", "301"]);
```

Starter selection tests:

- valid emitted value creates revision `1` and renders Home;
- duplicate delivery returns the same committed result;
- different value with same interaction ID conflicts without mutation;
- competing valid starter interactions produce one winner and render winner Home for the loser with a refresh notice;
- malformed/multiple/off-menu values render the starter board with zero transaction;
- foreign owner yields one ephemeral denial with zero runtime calls.

Party tests:

- current slot-1 replace, slot-2 fill, occupied-slot swap, and replacement render exact notices;
- stale revision, locked slot, malformed target, off-menu value, and multiple values make zero transaction calls;
- an absent row found before arrangement renders the starter board with “This player no longer exists; choose a starter to begin again.” and makes zero transaction calls;
- a revision conflict reloads current Party when the row still exists, or renders that starter refresh notice when the row disappeared; the disappeared-row path creates no receipt;
- foreign owner makes zero runtime/repository calls;
- active stage returns a deterministic rejection and no revision;
- replay preserves state/revision after the first result.

Rune handler coverage must prove Rune `21` is no longer intercepted as `unsupported-effect`.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test src/commands/discordhero.test.ts
```

Expected: FAIL because slash still persists immediately and Party select is not handled.

- [ ] **Step 3: Implement slash branching**

Use:

```ts
const opened = openDiscordHeroWorkspace(runtime.repository, runtime.indexes, {
  userId: interaction.user.id,
});
const container =
  opened.status === "starter-required"
    ? renderDiscordHeroStarter(interaction.user.id, opened.candidates)
    : renderDiscordHeroWorkspace(
        interaction.user.id,
        "home",
        opened.snapshot,
        runtime.indexes,
      );
await interaction.editReply(boardPayload(container));
```

Keep ephemeral defer before awaiting the runtime provider. Do not pass interaction/time into open.

- [ ] **Step 4: Implement starter handling before the generic player lookup**

After decode and owner check, get the runtime, then identify exactly `party/select`, `revision === null`, and `value === "starter"`. Recompute candidates and legal values; malformed/off-menu selection updates the starter board without transaction.

For a valid choice, call `selectDiscordHeroStarter()` directly. On success or replay, reload revision `1` and render Home. On `DiscordHeroRevisionConflictError`, reload the winning row and render Home with “Another starter selection committed first; this workspace was refreshed.” Do not reject merely because a row exists before the transaction.

- [ ] **Step 5: Implement current-formation handling after player lookup**

Reject all other null-revision controls. If the initial player lookup for a positive-revision Party selector returns null, recompute starter candidates, render `renderDiscordHeroStarter(owner,candidates,"This player no longer exists; choose a starter to begin again.")`, and return without calling `transactPlayer()`. Otherwise:

1. If bound revision is stale, render current Party and return.
2. Decode `s-1..s-3`.
3. Recompute that slot’s legal options from `projectDiscordHeroParty()`.
4. Require exactly one selected emitted value.
5. Call `arrangeDiscordHeroParty()`.
6. Reload and render Party with fill/replace/swap/no-op/stage-active notice.
7. On `DiscordHeroRevisionConflictError`, reload once. Render current Party with a safe refresh notice when the row exists; when it is absent, render the same starter refresh notice. Do not map absence to an `ArrangePartyOutcome`.

No invalid/stale/pre-lookup-absent path reaches `transactPlayer()`. A disappearance after the lookup reaches the repository once, fails its positive-revision comparison before mutation, and writes no receipt.

- [ ] **Step 6: Run GREEN and command-boundary mutants**

Run:

```bash
bun test \
  src/commands/discordhero.test.ts \
  src/discord-hero/use-cases/select-starter.test.ts \
  src/discord-hero/use-cases/arrange-party.test.ts
```

Expected: PASS.

Kill these mutants one at a time:

1. Move owner check after `runtimeProvider()`: foreign zero-runtime test fails.
2. Accept any syntactically valid hero value: off-menu zero-transaction test fails.
3. Remove stale check: stale revision/state assertion fails.
4. Pre-reject starter when a row exists: duplicate replay test fails.
5. Allow null revision into normal handlers: forged null-control test fails.

Reverse each edit and require PASS.

Run the exact Task 9 E2E contract without editing it:

```bash
shasum -a 256 -c /tmp/discordhero-starter-formation.task9.sha256
bun test \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --timeout 30000
```

Expected: the hash check and E2E command PASS.

Record the command-task checkpoint:

```bash
shasum -a 256 \
  src/commands/discordhero.ts \
  src/commands/discordhero.test.ts \
  > /tmp/discordhero-starter-formation.task10.sha256
```

---

### Task 11: Final Repeated and Concurrent Emitted-Control Verification

**Files:**

- Verify only; no repository writes.
- Read only: `src/commands/discordhero.e2e.test.ts`
- Read only: `src/commands/discordhero.e2e-testkit.ts`
- Read only: `src/commands/discordhero.e2e-testkit.test.ts`
- Read only: `src/commands/discordhero.ts`
- Read only: `src/commands/discordhero.test.ts`

**Interfaces:**

- Consumes: the Task 9 hashed E2E contract and Task 10 GREEN command implementation.
- Produces: post-GREEN normal, repeated, concurrent, restart, cleanup, and unchanged-test-contract evidence.

- [ ] **Step 1: Recheck immutable task receipts**

```bash
shasum -a 256 -c /tmp/discordhero-starter-formation.task9.sha256
shasum -a 256 -c /tmp/discordhero-starter-formation.task10.sha256
```

Expected: both checks PASS before verification begins.

- [ ] **Step 2: Run normal, repeated, and concurrent E2E after GREEN**

Run:

```bash
bun test \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --timeout 30000

bun test \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --rerun-each=2 \
  --timeout 30000

bun test \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --concurrent \
  --max-concurrency=4 \
  --timeout 30000
```

Expected: all three commands PASS; no scenario directory, WAL, or SHM remains.

- [ ] **Step 3: Audit RED, mutant, restart, and cleanup evidence**

Confirm:

- Task 9 recorded behavior-only E2E RED before Task 10 production handling;
- Task 1, 4, 5, 6, 7, 8, and 10 receipts show that off-menu acceptance, stale-check removal, post-lookup owner checks, starter replay bypass, request-hash omissions, locked-slot actions, and locked-as-empty projections each produced a failing focused test before reversal;
- the normal run executes the close/reopen restart journey and proves persisted heroes, ordered party, Rune levels, and derived capacity;
- every emitted response passes payload/acknowledgement gates and cleanup proves root, WAL, and SHM absence.

Record the no-write verification checkpoint:

```bash
shasum -a 256 \
  src/commands/discordhero.e2e.test.ts \
  src/commands/discordhero.ts \
  src/commands/discordhero.test.ts \
  > /tmp/discordhero-starter-formation.task11.sha256
```

---

### Task 12: Update Architecture and Parity Documentation

**Files:**

- Modify: `docs/DISCORDHERO_PARITY.md`
- Modify: `docs/DISCORDHERO_ARCHITECTURE.md`

**Interfaces:**

- Consumes: verified Task 1-11 behavior and pinned source/oracle evidence.
- Produces: accurate state/transaction/UI contracts and an explicit remaining runtime-oracle boundary.

- [ ] **Step 1: Write documentation assertions before prose**

Define the exact statements the docs must contain:

```text
Fresh open is read-only and persists no player.
Starter selection creates revision 1 with all three standard heroes owned.
Only the chosen starter is deployed in [selected, null, null].
Formation capacity is derived as base 1 plus owned reachable arrangement effects.
Rune 21 costs 1,000 Gold; Rune 24 costs 150,000 Gold.
Fill, replace, and swap are supported only while no stage session is active.
Initial save layout, live-stage replacement timing, and 60-second cooldown parity remain unverified by a pristine runtime delta.
```

- [ ] **Step 2: Update both documents with source citations and confidence**

Describe the corpus-backed inference that all three standard heroes are owned, the exact repository lifecycle, custom-ID grammar, zero-write bounds, and greenfield fresh-store release assumption. Keep the oracle gap affirmative: this slice rejects active-stage formation changes and stores no cooldown field.

- [ ] **Step 3: Verify documentation content and formatting**

Run:

```bash
rg -n \
  "starter|revision 1|formation|Rune 21|Rune 24|1,000|150,000|stageSession|60-second|runtime oracle" \
  docs/DISCORDHERO_PARITY.md \
  docs/DISCORDHERO_ARCHITECTURE.md

bunx --no-install prettier --check \
  docs/DISCORDHERO_PARITY.md \
  docs/DISCORDHERO_ARCHITECTURE.md
```

Expected: every assertion is findable and Prettier passes.

Record:

```bash
shasum -a 256 \
  docs/DISCORDHERO_PARITY.md \
  docs/DISCORDHERO_ARCHITECTURE.md \
  > /tmp/discordhero-starter-formation.task12.sha256
```

---

### Task 13: Independent Verification, Scope Hashes, and Release Boundary

**Files:**

- Verify only; no repository writes.

**Interfaces:**

- Consumes: all prior task outputs and `/tmp/discordhero-starter-formation.before.sha256`.
- Produces: a reviewer-facing verification receipt separating focused behavior, global checks, scope, and unverified live behavior.

- [ ] **Step 1: Run the complete focused gameplay suite**

Run:

```bash
bun test \
  src/discord-hero/domain/party.test.ts \
  src/discord-hero/domain/invariants.test.ts \
  src/discord-hero/domain/runes.test.ts \
  src/discord-hero/use-cases/open-workspace.test.ts \
  src/discord-hero/use-cases/select-starter.test.ts \
  src/discord-hero/use-cases/arrange-party.test.ts \
  src/discord-hero/use-cases/upgrade-rune.test.ts \
  src/discord-hero/ui/custom-id.test.ts \
  src/discord-hero/ui/starter.test.ts \
  src/discord-hero/ui/party.test.ts \
  src/discord-hero/ui/home.test.ts \
  src/discord-hero/ui/workspace.test.ts \
  src/commands/discordhero.test.ts \
  src/commands/discordhero.e2e-testkit.test.ts \
  src/commands/discordhero.e2e.test.ts \
  --timeout 30000
```

Expected: PASS.

- [ ] **Step 2: Run global type, format, artifact, and test gates**

Run:

```bash
bun run typecheck
bunx --no-install prettier --version
bunx --no-install prettier --check \
  src/discord-hero/domain/player.ts \
  src/discord-hero/domain/party.ts \
  src/discord-hero/domain/party.test.ts \
  src/discord-hero/domain/invariants.ts \
  src/discord-hero/domain/invariants.test.ts \
  src/discord-hero/state/repository.test.ts \
  src/discord-hero/domain/attribute-effects.test.ts \
  src/discord-hero/domain/attributes.test.ts \
  src/discord-hero/domain/containers.test.ts \
  src/discord-hero/domain/cube-unlocks.test.ts \
  src/discord-hero/domain/equipment.test.ts \
  src/discord-hero/domain/heroes.test.ts \
  src/discord-hero/domain/item-effects.test.ts \
  src/discord-hero/domain/runes.ts \
  src/discord-hero/domain/runes.test.ts \
  src/discord-hero/ui/alchemy.test.ts \
  src/discord-hero/ui/attributes.test.ts \
  src/discord-hero/ui/containers.test.ts \
  src/discord-hero/ui/cube.test.ts \
  src/discord-hero/ui/inventory.test.ts \
  src/discord-hero/ui/item-effects.test.ts \
  src/discord-hero/use-cases/alchemy.test.ts \
  src/discord-hero/use-cases/allocate-attribute-point.test.ts \
  src/discord-hero/use-cases/equipment.test.ts \
  src/discord-hero/use-cases/open-workspace.ts \
  src/discord-hero/use-cases/open-workspace.test.ts \
  src/discord-hero/use-cases/unlock-container-slot.test.ts \
  src/discord-hero/use-cases/unlock-cube-recipe.test.ts \
  src/discord-hero/use-cases/select-starter.ts \
  src/discord-hero/use-cases/select-starter.test.ts \
  src/discord-hero/use-cases/arrange-party.ts \
  src/discord-hero/use-cases/arrange-party.test.ts \
  src/discord-hero/use-cases/upgrade-rune.test.ts \
  src/discord-hero/ui/custom-id.ts \
  src/discord-hero/ui/custom-id.test.ts \
  src/discord-hero/ui/starter.ts \
  src/discord-hero/ui/starter.test.ts \
  src/discord-hero/ui/party.ts \
  src/discord-hero/ui/party.test.ts \
  src/discord-hero/ui/home.ts \
  src/discord-hero/ui/home.test.ts \
  src/discord-hero/ui/workspace.ts \
  src/discord-hero/ui/workspace.test.ts \
  src/commands/discordhero.ts \
  src/commands/discordhero.test.ts \
  src/commands/discordhero.e2e.test.ts \
  docs/DISCORDHERO_PARITY.md \
  docs/DISCORDHERO_ARCHITECTURE.md
bun run discordhero:catalog:check
bun run discordhero:achievements:check
bun run discordhero:community-market:check
bun run discordhero:community-content:check
bun test --timeout 30000
```

Expected: typecheck PASS; Prettier reports `3.9.6` and PASS; all four artifact checks PASS; global tests PASS.

- [ ] **Step 3: Prove immutable dependencies and exact touched scope**

Run:

```bash
shasum -a 256 package.json bun.lock \
  > /tmp/discordhero-starter-formation.dependencies.after.sha256
diff -u \
  /tmp/discordhero-starter-formation.dependencies.before.sha256 \
  /tmp/discordhero-starter-formation.dependencies.after.sha256

shasum -a 256 \
  src/discord-hero/domain/rune-effects.ts \
  src/discord-hero/use-cases/upgrade-rune.ts \
  src/discord-hero/state/repository.ts
```

Expected: dependency diff is empty; the three read-only production hashes remain:

```text
9b1f5de1938e07949b797c717650f924836c0e3e94a4ed385b3485f511d7314f  src/discord-hero/domain/rune-effects.ts
b86834fdf48d45219fcd2d4d07f4ef2276847eb3d1a4087866acd2d595939033  src/discord-hero/use-cases/upgrade-rune.ts
5cb814ebc49ae0a9a05152554f0d03afc653c458d66e43436b60ae7c6a8e2a32  src/discord-hero/state/repository.ts
```

Create an after manifest and compare paths whose hashes changed. The changed/new set must be a subset of the Task 1-12 ownership table:

```bash
rg --files src/discord-hero src/commands docs \
  | sort \
  | xargs shasum -a 256 \
  > /tmp/discordhero-starter-formation.after.sha256
```

Because there is no Git index, the reviewer must report the exact changed/new path list and final SHA-256 for every path, not a commit SHA.

- [ ] **Step 4: Verify no residue and state the proof boundary**

Run:

```bash
find . -maxdepth 3 \
  \( -name 'players.sqlite*' -o -name 'discordhero-*test*' -o -name '*.orig' -o -name '*.rej' \) \
  -print
```

Expected: no agent-created SQLite, WAL, SHM, backup, or reject file remains in the checkout.

Final handoff must distinguish:

- HIGH: focused and global local proof from commands above;
- HIGH: hash-scoped files and unchanged repository/dependency surfaces;
- MEDIUM: all-three-standard-heroes ownership is the approved corpus-backed inference;
- UNVERIFIED: pristine TaskbarHero save parity, mid-stage formation timing, 60-second cooldown behavior, deployment, and live Discord smoke.

No deploy, store reset, live interaction, or compatibility migration is part of this plan.

---

## Plan Self-Review

- Spec coverage: deferred no-row open, three exact starters, atomic revision `1`, all-three ownership, one deployed hero, capacities `1/2/3`, Rune costs/effects, fill/replace/swap, stage-active rejection, custom-ID grammar, owner/revision/off-menu bounds, replay/race/restart, Home locked slots, docs, hashes, and release boundary each map to a task.
- Type consistency: the same `DiscordHeroStarterKey`, `DiscordHeroFormationCapacity`, `DiscordHeroPartySlot`, `ArrangePartySlotResult`, `OpenWorkspaceResult`, `SelectStarterOutcome`, and `ArrangePartyOutcome` signatures are consumed by all downstream tasks.
- File ownership: no path appears as writable in more than one task. Production repository, Rune projection, and Rune transaction shell remain read-only.
- TDD order: every implementation task starts with a failing behavior test, records the expected RED reason, implements the minimum contract, runs focused GREEN, and kills a named plausible mutant.
- Discord proof: happy journeys harvest emitted IDs/options; negative journeys alone construct malformed/locked/foreign controls; SQLite and acknowledgement/payload gates prove behavior beyond rendering.
- Oracle boundary: the plan implements the approved corpus-backed slice and preserves active-stage/cooldown behavior as an explicit runtime-oracle boundary.
