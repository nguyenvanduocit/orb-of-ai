# DiscordHero architecture contract

Status: implementation contract  
Parity contract: [`DISCORDHERO_PARITY.md`](./DISCORDHERO_PARITY.md)  
Runtime: Bun, `discord.js`, `bun:sqlite`

## Outcome

DiscordHero is one Discord-native game whose rules and catalog reproduce the
TaskbarHero source snapshot. It has:

- one `/discordhero` command and one private Components V2 workspace;
- a generated, lossless, provenance-bearing catalog;
- a pure deterministic game core;
- one SQLite database with short ACID transactions;
- lazy, deterministic offline/campaign settlement that survives process
  restart;
- per-player revisions and interaction idempotency;
- a private gold ledger independent of Orb coins; and
- a fresh state namespace. Existing RPG JSON files remain byte-for-byte
  untouched as archival data.

This is a greenfield replacement. The target contains one DiscordHero model and
one set of rules. Compatibility adapters to the current `/rpg` mechanics are
outside the design.

## Package layout

```text
src/discord-hero/
  catalog/
    schema.ts
    generate.ts
    load.ts
    indexes.ts
    provenance.ts
  domain/
    model.ts
    invariants.ts
    stats.ts
    combat.ts
    progression.ts
    drops.ts
    cube.ts
    crafting.ts
    offline.ts
  state/
    model.ts
    schema.ts
    migrations.ts
    store.ts
    transaction.ts
  use-cases/
    open-workspace.ts
    heroes.ts
    party.ts
    campaign.ts
    inventory.ts
    runes.ts
    crafting.ts
    cube.ts
    collection.ts
    codex.ts
    market.ts
    orphan.ts
  ui/
    custom-id.ts
    workspace.ts
    home.ts
    heroes.ts
    party.ts
    world.ts
    inventory.ts
    runes.ts
    crafting.ts
    collection.ts
    codex.ts
    market.ts
src/commands/discordhero.ts
scripts/generate-discordhero-catalog.ts
assets/discordhero/
  catalog.json
```

The modules are concrete game concerns, not generic repositories, service
layers, or framework wrappers. A helper is extracted only after repeated use
demonstrates the shared invariant.

## Dependency direction

```text
preferences/taskbarhero Markdown
           │ build-time only
           ▼
catalog/generate ──► assets/discordhero/catalog.json ──► catalog/load + indexes
                                              │
                                              ▼
                                         domain (pure)
                                              │
                                              ▼
state (SQLite boundary) ◄────────────── use-cases (transactions)
                                              │
                                              ▼
                                         ui (Discord V2)
                                              │
                                              ▼
                              commands/discordhero + app integrations
```

Rules:

- `catalog` imports no Discord, persistence, economy, clock, or random source.
- `domain` imports catalog types/values only. It receives time and random values
  as explicit inputs and returns new values plus domain events.
- `state` owns SQLite schema, migrations and transaction mechanics. It imports
  state/domain types but never Discord UI.
- `use-cases` are the only mutation entry points. They load one player, resolve
  elapsed work, call pure domain functions, validate invariants, and commit.
- `ui` maps use-case read models/outcomes to Components V2. It never computes
  rewards, rolls, combat, costs, or ownership.
- `src/commands/discordhero.ts`, guild cleanup, wiki, and agent tools compose the
  packages. They never write SQL or mutate player JSON directly.
- DiscordHero never imports `src/economy.ts` or any legacy `src/rpg*.ts` module.

## Catalog: build once, validate completely

The runtime image does not parse thousands of Markdown pages. The checked-in
source snapshot is converted during development into
`assets/discordhero/catalog.json`, and that generated artifact is copied with
`assets/` into the container.

`generate.ts` must:

1. Verify the manifest inventory, coverage, catalog coverage, row totals and
   digest before generation. The current authority is 6,570/6,570 pages, 45/45
   datasets, 25,757 rows, digest
   `186d90e9d1caf1be28d0480e760c082ea434a80588ed76f97c1b4f1fed2b9d12`
   ([`manifest.json:3`](../preferences/taskbarhero/manifest.json#L3),
   [`manifest.json:19`](../preferences/taskbarhero/manifest.json#L19),
   [`manifest.json:833`](../preferences/taskbarhero/manifest.json#L833)).
2. Parse every database table with a strict table-specific schema. Preserve
   source keys as strings, all declared/actual columns, nulls, booleans, decimal
   text where rounding matters, and source ordering fields.
3. Emit typed records plus lossless raw fields; never synthesize missing source
   values.
4. Validate and report all required references: hero→skills/attributes,
   skill→levels/buffs, rune graph→levels/next nodes,
   item→gear/material/drop/grade, stage→next stage/monsters/boss/drops/sound,
   recipe→materials/drops, and every enum. A source-dangling reference remains
   losslessly addressable and gates its runtime branch; it is never replaced by
   a synthetic record.
5. Emit `catalog-meta.json` with export format, manifest digest, generator
   version, per-table counts/hashes, source paths, and known source limitations.
   The item source explicitly records that its curated route is the available
   authority because the raw route was unavailable
   ([`database/items.md:14`](../preferences/taskbarhero/database/items.md#L14)).
6. Produce byte-identical generated output on a second run.

Runtime startup loads and freezes the artifact once, verifies its embedded
digest/schema, and builds read-only indexes. A mismatch is a fail-fast startup
error; it cannot fall back to generated names or partial content.

## Functional core

All gameplay commands reduce to:

```ts
type GameInput = {
  nowMs: number;
  rng: RandomState;
  catalog: Catalog;
};

type Transition<S, O> = {
  state: S;
  outcome: O;
  events: DomainEvent[];
  rng: RandomState;
};
```

Domain functions receive values and return values. They have no file access,
SQLite calls, Discord objects, network calls, ambient time, `Math.random()`, or
global mutable state.

Important invariants live in `domain/invariants.ts` and run before every commit:

- level, cube level, capacities, slot types, rune prerequisites, unlocks and
  catalog references are valid;
- item instance IDs are unique and an instance has exactly one location;
- no balance, stack, XP, HP, cost, or quantity is negative;
- every material/item/gold debit equals the declared operation input;
- every reward originates from a catalog drop/reward rule;
- campaign progress and settlement counters are monotonic;
- state and RNG versions are supported.

Arithmetic and rounding are centralized in the relevant domain module. The
armor formula and cap come from the recovered mechanics
([`mechanics.md:75`](../preferences/taskbarhero/mechanics.md#L75)); resistance
does not inherit the current RPG's fixed cap
([`mechanics.md:94`](../preferences/taskbarhero/mechanics.md#L94)). Formula
boundaries reject non-finite results and unsafe integer totals instead of
persisting corrupted values. The armor implementation uses an
overflow-stable algebraic form and property vectors prove equivalence to the
recovered equation over realistic inputs.

Generic Dodge, Elemental Dodge, generic Block, Elemental Block, and each
corresponding maximum remain distinct domain inputs and trace values. The
generic dodge-before-block path is executable. A non-zero elemental-specific
chance throws an explicit oracle-required domain error before RNG because the
snapshot does not establish how generic and elemental chances combine or
which one rolls first. Any other rounding, ordering, targeting, or RNG detail
not established by the snapshot remains an oracle fixture requirement in the
parity contract.

## One SQLite state boundary

Path: `data/global/discord-hero.sqlite`

The database is created with Bun's built-in `bun:sqlite`. It is the sole
DiscordHero persistence boundary. The connection enables:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = FULL;
```

The initial schema is deliberately small:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE game_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE players (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  schema_version INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE idempotency (
  interaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  expected_revision INTEGER,
  committed_revision INTEGER NOT NULL,
  outcome_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idempotency_user_created
  ON idempotency(user_id, created_at_ms);
```

`game_meta` records at least the catalog digest, state schema version, and
application compatibility version. Migrations run in a transaction, have stable
checksums, and refuse a database newer than the application. Backups and
integrity checks operate on the SQLite database, not a mixture of files.

Each player row owns a self-contained versioned state document: source-defined
hero/progression, inventory and item instances, equipment, runes, cube/crafting,
collection, game gold, deterministic RNG state, and active campaign settlement
state. A player mutation reads and writes one player row plus its idempotency
record. There is no application-wide mutex and no O(all players) JSON rewrite.
SQLite may serialize the brief write section; catalog lookup, domain simulation,
and rendering do not hold a cross-guild application lock.

State migrations transform one parsed player document to the next schema and
are covered by golden before/after fixtures. Catalog migrations are distinct
from state migrations: a catalog digest change requires an explicit compatibility
decision and fixture, never opportunistic repair during a user interaction.

## Transaction, revision, and idempotency protocol

Every mutating use-case receives:

```ts
{
  userId: string;
  interactionId: string;
  requestHash: string;
  expectedRevision: number;
  nowMs: number;
  input: CommandInput;
}
```

The imperative shell performs this protocol:

1. Validate and normalize the request before opening a write transaction.
2. Start a short SQLite transaction.
3. Look up `interaction_id` first.
   - Same `user_id` and `request_hash`: return the recorded outcome without
     running the domain transition again.
   - Different request identity/hash: reject as an idempotency collision and
     mutate nothing.
4. Read the player row, or construct source-backed fresh state at revision 1:
   first-available heroes 101/201/301 and Gold 100. Other defaults require their
   runtime-oracle fixture.
5. Compare `expectedRevision` to the row revision. On mismatch, roll back and
   return a `STALE` outcome containing the current revision/read model.
6. Lazily resolve elapsed offline/campaign work into the in-memory state.
7. Run the requested pure transition and validate all invariants.
8. Update with compare-and-swap:
   `UPDATE players ... WHERE user_id = ? AND revision = ?`, incrementing the
   revision exactly once. A zero-row update is a stale conflict.
9. Insert the idempotency outcome in the same transaction and commit.
10. Render after commit from the committed read model.

The transaction callback is synchronous; it contains no Discord or network
await. A domain failure, invariant failure, busy timeout, or process termination
before commit changes neither player state nor idempotency. A committed
interaction can be retried after restart and returns its recorded outcome.

Committed mutation idempotency rows have no automatic TTL. They remain the
durable proof that an interaction already changed source-of-truth state, so a
late replay cannot become a second mutation. Explicit player deletion removes
that player's state and ledger together through the declared foreign key.

Read-only navigation may render at the current revision without creating an
idempotency row. Every button/select/modal capable of mutation carries an
expected revision and uses this protocol.

## Lazy and restart-safe campaign resolution

Correctness never depends on an interval timer. Player state persists:

```ts
type CampaignState = {
  campaignId: string;
  sourceStageKey: string;
  startedAtMs: number;
  accountedThroughMs: number;
  combatState: PersistedCombatState;
  rng: RandomState;
  rewardSequence: number;
  status: "running" | "won" | "lost" | "retreated";
};
```

On every `/discordhero` open and every player mutation,
`resolveElapsedCampaign(state, nowMs, catalog)`:

1. clamps time according to the recovered offline rules (ordinary rewards cap
   at 8 hours; timestamps older than 30 days yield zero)
   ([`mechanics.md:109`](../preferences/taskbarhero/mechanics.md#L109));
2. simulates only the interval after `accountedThroughMs` using persisted RNG
   and combat state;
3. produces deterministic events and rewards in bounded batches;
4. advances `accountedThroughMs`, `rewardSequence`, combat state and RNG
   together; and
5. commits resolution plus the requested action in the same player transaction.

Large elapsed intervals are handled by deterministic chunking with a persisted
cursor. If execution stops between chunks, only committed chunks exist and the
next interaction resumes from the cursor. If it stops before commit, the same
inputs replay to the same output. Rewards never exist solely in memory or in a
Discord message.

An optional presentation ticker may request the same campaign use-case to make
an open board feel live. It owns no simulation logic and is not required for
settlement. After a restart or expired interaction token, the user opens
`/discordhero` and receives a fresh private workspace backed by persisted state.

## Components V2 workspace

The initial `/discordhero` reply and every edit/update in that message lifecycle
use `privateBoardPayload`, which already combines Components V2, ephemeral
visibility, and no-ping behavior ([`src/ui.ts:1`](../src/ui.ts#L1),
[`src/ui.ts:24`](../src/ui.ts#L24)).

`ui/custom-id.ts` is the single encoder/decoder:

```text
discordhero:<view>:<action>:<entity-key>:r<revision>
```

Requirements:

- encoded IDs are at most 100 characters;
- every segment uses an allowlisted grammar and catalog/entity lookup;
- mutation IDs always include the rendered revision;
- navigation IDs may be revisionless only when they cannot mutate;
- owner ID is checked from the interaction, not trusted from the custom ID;
- a stale control returns a fresh workspace and applies no partial action;
- destructive or irreversible actions use a confirmation view with exact
  authoritative cost/input/output bounds;
- renderer pagination stays inside Discord component/content limits;
- shared/public output is an explicit read-only snapshot with no owner controls.

The existing dispatcher already routes components by the first custom-ID
segment to the command map ([`src/index.ts:211`](../src/index.ts#L211)).
`discordhero:*` therefore uses the normal command handlers without a parallel
collector or router.

## Fresh-state and currency boundary

DiscordHero creates a new player only inside its SQLite database at revision 1.
The catalog supplies first-available heroes 101, 201 and 301 through
`IsFirstAvailable`, and the sole currency row supplies initial Gold 100
([`heroes.md:25`](../preferences/taskbarhero/database/heroes.md#L25),
[`currencies.md:25`](../preferences/taskbarhero/database/currencies.md#L25)).
Every additional new-save field requires a runtime-oracle fixture.

There is no automatic import, conversion, reset, deletion, or compatibility
read from:

- `data/global/characters.json`;
- the legacy RPG market, PvP, expedition, season, telemetry, or other RPG JSON
  files; or
- Orb's coin, attendance, title, lottery, or betting ledgers.

DiscordHero gold is a field in `players.state_json`; every debit/reward is a
DiscordHero domain event inside the same ACID transaction. The current RPG
shares Orb coin and stores multiple independent JSON documents
([`src/rpg-store.ts:1`](../src/rpg-store.ts#L1),
[`src/rpg-store.ts:25`](../src/rpg-store.ts#L25),
[`src/rpg-store.ts:126`](../src/rpg-store.ts#L126)). None of those stores is a
DiscordHero dependency.

Before cutover, record path, byte size and SHA-256 for every legacy RPG JSON
file. After migration, test, container build and smoke test, the exact inventory
and hashes must match. Their eventual archival retention/deletion policy
requires a separate explicit decision.

## Exact integration and removal map

All rows are part of the same completion contract. Removal occurs only after
DiscordHero passes its gates, then the final tree contains one active RPG game.

| Surface | Required final change | Verification |
|---|---|---|
| `src/commands/discordhero.ts` | Add the sole Discord adapter: command data, execute, button/select/modal handlers. It calls workspace/use-cases only. | `/discordhero` opens, navigates and mutates a private V2 board in a real guild. |
| `src/commands/index.ts` | Replace the `./rpg` import and `rpg` registry entry at [`index.ts:23`](../src/commands/index.ts#L23) and [`index.ts:31`](../src/commands/index.ts#L31) with `discordhero`. Registry-derived help/catalog then exposes the final command automatically ([`index.ts:60`](../src/commands/index.ts#L60)). | `commandData` contains `discordhero` exactly once and contains no `rpg`. |
| `src/register.ts` | Keep the registry-derived registration flow unchanged ([`register.ts:2`](../src/register.ts#L2), [`register.ts:11`](../src/register.ts#L11)). | Registration response and Discord application command list contain `/discordhero`; `/rpg` is absent. |
| `src/index.ts` | Remove `rollRpgSeason`, legacy expedition reconciliation/scheduler and RPG telemetry imports/calls at [`index.ts:29`](../src/index.ts#L29), [`index.ts:35`](../src/index.ts#L35), [`index.ts:38`](../src/index.ts#L38), [`index.ts:78`](../src/index.ts#L78), [`index.ts:89`](../src/index.ts#L89), and [`index.ts:116`](../src/index.ts#L116). Keep the generic command/component dispatch. Open/mutate calls settle lazily. | Cold start touches neither old RPG JSON nor legacy schedulers; restart/campaign tests and interaction routing pass. |
| `src/guilds.ts` | Replace active RPG holder/removal imports at [`guilds.ts:17`](../src/guilds.ts#L17). Orphan enumeration queries DiscordHero player IDs; `forgetIfGone` deletes that user's DiscordHero row/idempotency in one transaction. Legacy RPG JSON is excluded from active holder enumeration and mutation. Preserve the full-member-fetch safety guard at [`guilds.ts:352`](../src/guilds.ts#L352). | Failed/incomplete guild fetch deletes nothing; confirmed orphan deletion removes only new DiscordHero rows plus existing non-RPG behavior, and legacy RPG hashes remain unchanged. |
| `src/server.ts` | Remove legacy RPG imports and `/rpg/*` routes currently beginning at [`server.ts:9`](../src/server.ts#L9) and [`server.ts:72`](../src/server.ts#L72). DiscordHero mutations remain interaction-only; do not create an unauthenticated HTTP mutation API. Keep `/wiki` ([`server.ts:226`](../src/server.ts#L226)). | Route test returns 404 for old RPG routes, serves `/wiki`, and exposes no DiscordHero write endpoint. |
| `src/wiki.ts` | Replace legacy RPG catalog imports beginning at [`wiki.ts:27`](../src/wiki.ts#L27) and its RPG sections beginning at [`wiki.ts:542`](../src/wiki.ts#L542) with pure DiscordHero catalog/mechanics sections. Preserve `wikiDoc()`/`wikiSkillFiles()` as the one shared human/agent document boundary ([`wiki.ts:1349`](../src/wiki.ts#L1349), [`wiki.ts:1399`](../src/wiki.ts#L1399)). | Wiki contains exact DiscordHero source counts/digest and no current `/rpg`, prestige, atlas, PoE gem, or Orb-coin gameplay claims. |
| `src/wiki-web.ts` | Keep it a renderer of `wikiDoc`; update only branding/navigation demanded by the new document. It must not import domain/state directly. | HTML snapshot matches `wikiDoc` sections and contains no second hand-written game truth. |
| `src/agent-tools.ts` | Remove legacy RPG command/market/PvP imports at [`agent-tools.ts:1`](../src/agent-tools.ts#L1) and all `bot_rpg_*` tools beginning at [`agent-tools.ts:368`](../src/agent-tools.ts#L368). Add narrowly named `bot_discordhero_*` read/mutation tools that call the same use-cases and revision/idempotency protocol. | Tool catalog contains no `bot_rpg_*`; duplicate/stale/destructive-confirmation tests use the production use-cases and preserve invariants. |
| `Dockerfile` | Rely on `COPY assets ./assets` for `assets/discordhero/catalog.json` ([`Dockerfile:21`](../Dockerfile#L21)); keep `/data` as the Fly volume ([`Dockerfile:23`](../Dockerfile#L23)). Replace the obsolete `/rpg`-specific asset comment at [`Dockerfile:19`](../Dockerfile#L19) while retaining assets used by other games. | Production image boots with catalog verification and opens the SQLite database on the mounted volume; it does not need `preferences/` at runtime. |
| `package.json` | Add `discordhero:catalog:generate`, `discordhero:catalog:verify`, and focused test commands using Bun. Remove the legacy RPG stats/sandbox/retier scripts at [`package.json:14`](../package.json#L14). `bun:sqlite` adds no package dependency. | `bun run discordhero:catalog:verify`, typecheck, full tests and production start pass from a clean install. |
| Legacy code/assets | Delete active `/rpg` command and runtime-only `src/rpg*.ts`, expedition/telemetry/sandbox/migration modules and RPG-only web assets after import/reference search reaches zero. Preserve files still used by non-RPG features. | `rg` shows no runtime import, command, route, scheduler, tool or wiki claim for legacy RPG; build and all unrelated game tests pass. |
| Synthetic TaskbarHero scaffold | Removed after dependency audit; DiscordHero parity tests load only the pinned generated source catalog. | `rg` shows no production/test import of the removed scaffold. |

## Verification strategy

### Catalog

- exact table and row counts, manifest and per-table hashes;
- schema round-trip with no dropped field;
- exhaustive enum and cross-reference validation;
- deterministic regeneration diff;
- reachability report for every record shown through Codex or a system flow.

### Domain

- table-driven golden vectors for every recovered formula;
- property tests for conservation, bounds, monotonic progress, graph validity,
  inventory uniqueness and deterministic replay;
- seeded traces for every activation, delivery, status, drop, crafting, cube,
  synthesis, item-mod and campaign branch;
- separate oracle fixtures for every ambiguity listed in the parity contract.

### State

- schema migration checksums and golden migrations;
- rollback on domain error, invariant error, thrown exception and process kill;
- two writers on different players, two writers on one player, stale revision,
  duplicate interaction, idempotency collision and busy timeout;
- WAL restart/recovery and `PRAGMA integrity_check`;
- lazy campaign replay after restart and repeated open;
- byte-for-byte proof that legacy RPG JSON does not change.

### UI and integration

- custom-ID round-trip/length/fuzz tests;
- every view and pagination boundary under Discord limits;
- owner, stale, duplicate, confirmation and private/public-share policies;
- registry/register/dispatcher/guild cleanup/server/wiki/agent/container tests;
- a real guild journey through fresh player, progress, restart and destructive
  operation confirmation.

## Dependency-ordered execution checklist

This sequence is for implementation safety; every checkbox is required for the
single completion outcome.

- [ ] Freeze source manifest/digest and runtime-oracle register; capture legacy
      RPG JSON inventory and SHA-256.
- [ ] Implement strict catalog schemas/generator/provenance/indexes and commit
      deterministic generated artifacts for all 45 datasets.
- [ ] Replace invented scaffold fixtures with exact count, schema,
      cross-reference, and representative deep-equality fixtures.
- [ ] Implement pure stats/combat/progression/drop/crafting/cube/offline
      transitions, invariants and deterministic RNG with golden/property/trace
      tests.
- [ ] Resolve and fixture every runtime-oracle blocker required for the 100%
      claim.
- [ ] Implement SQLite schema, checked migrations, WAL configuration,
      per-player state, revisions, idempotency and short transaction protocol.
- [ ] Implement fresh state and lazy/restart-safe campaign settlement, including
      bounded chunk replay and all 8h/30d boundaries.
- [ ] Implement every use-case over the same transaction boundary and make game
      gold independent from Orb coins.
- [ ] Implement the complete private Components V2 workspace, pagination,
      custom-ID revision protocol, confirmations and explicit read-only sharing.
- [ ] Integrate registry/registration/startup/guild cleanup/server/wiki/agent
      tools/container/package scripts exactly as mapped above.
- [ ] Remove every active legacy RPG/scaffold import, route, scheduler, command,
      tool, wiki claim, script and RPG-only asset; preserve unrelated features
      and archival JSON.
- [ ] Run catalog verification, typecheck, unit/property/integration/restart/
      concurrency/container tests, SQLite integrity check and a real Discord
      end-to-end smoke journey.
- [ ] Recompute legacy RPG JSON inventory/hashes and prove exact equality.
- [ ] Obtain an independent verifier review against every parity and
      architecture gate before describing DiscordHero as complete or 100%.
