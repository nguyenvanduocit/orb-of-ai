import type { DiscordHeroCatalogIndexes } from "../catalog/indexes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  readDiscordHeroStoredAsset,
  type DiscordHeroStoredAssetView,
} from "./inventory";

const CONTAINER_PAGE_SIZE = 25;
const MAX_CODEC_LENGTH = 64;
const MAX_OPTION_TEXT_LENGTH = 100;

export const DISCORD_HERO_CONTAINER_KINDS = [
  "inventory",
  "stash",
  "storage",
  "tradingStash",
] as const;

export type DiscordHeroContainerKind =
  (typeof DISCORD_HERO_CONTAINER_KINDS)[number];

const CONTAINER_SPECS = {
  inventory: {
    code: "i",
    label: "Inventory",
    dataset: "inventory",
    capacity: 260,
  },
  stash: {
    code: "s",
    label: "Stash",
    dataset: "stash",
    capacity: 131,
  },
  storage: {
    code: "o",
    label: "Storage",
    dataset: "storage",
    capacity: 101,
  },
  tradingStash: {
    code: "t",
    label: "Trading Stash",
    dataset: "trading_stash",
    capacity: 10,
  },
} as const satisfies Record<
  DiscordHeroContainerKind,
  {
    readonly code: string;
    readonly label: string;
    readonly dataset: "inventory" | "stash" | "storage" | "trading_stash";
    readonly capacity: number;
  }
>;

type ContainerSourceRow = {
  readonly Index: number;
  readonly CostForUnlock: number;
};

export type DiscordHeroContainerUnlockQuote =
  | {
      readonly kind: "available";
      readonly slotIndex: number;
      readonly cost: number;
      readonly canAfford: boolean;
      readonly source: ContainerSourceRow;
    }
  | {
      readonly kind: "maximum-capacity";
      readonly unlockedSlots: number;
    };

export interface DiscordHeroContainerTab {
  readonly kind: DiscordHeroContainerKind;
  readonly label: string;
  readonly capacity: number;
  readonly unlocked: number;
  readonly occupied: number;
  readonly free: number;
  readonly pageCount: number;
  readonly pageTarget: string;
  readonly unlockQuote: DiscordHeroContainerUnlockQuote | null;
}

interface DiscordHeroContainerSlotBase {
  readonly slotIndex: number;
  readonly target: string;
  readonly label: string;
  readonly description: string;
}

export type DiscordHeroContainerSlotOption =
  | (DiscordHeroContainerSlotBase & {
      readonly status: "free";
    })
  | (DiscordHeroContainerSlotBase & {
      readonly status: "occupied";
      readonly assetKind: "gear" | "stack";
      readonly itemKey: number;
      readonly instanceId: string | null;
      readonly quantity: number | null;
    });

export interface DiscordHeroContainerPage {
  readonly kind: DiscordHeroContainerKind;
  readonly label: string;
  readonly capacity: number;
  readonly unlocked: number;
  readonly occupied: number;
  readonly free: number;
  readonly page: number;
  readonly pageCount: number;
  readonly pageTarget: string;
  readonly slots: readonly DiscordHeroContainerSlotOption[];
}

interface DiscordHeroContainerSlotDetailBase {
  readonly kind: DiscordHeroContainerKind;
  readonly page: number;
  readonly slotIndex: number;
  readonly target: string;
}

export type DiscordHeroContainerSlotDetail =
  | (DiscordHeroContainerSlotDetailBase & {
      readonly status: "free";
      readonly asset: null;
    })
  | (DiscordHeroContainerSlotDetailBase & {
      readonly status: "occupied";
      readonly asset: DiscordHeroStoredAssetView;
    });

export interface DecodedDiscordHeroContainerPageTarget {
  readonly kind: DiscordHeroContainerKind;
  readonly page: number;
}

export interface DecodedDiscordHeroContainerSlotTarget extends DecodedDiscordHeroContainerPageTarget {
  readonly slotIndex: number;
}

interface ProjectionContext {
  readonly state: PlayerState;
  readonly sourceRows: Readonly<
    Record<DiscordHeroContainerKind, readonly ContainerSourceRow[]>
  >;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function frozenClone<T>(value: T): Readonly<T> {
  return deepFreeze(structuredClone(value));
}

function sameSourceRow(
  left: ContainerSourceRow,
  right: ContainerSourceRow,
): boolean {
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && leftRecord[key] === rightRecord[key],
    )
  );
}

function requireSourceTables(
  indexes: DiscordHeroCatalogIndexes,
): Readonly<Record<DiscordHeroContainerKind, readonly ContainerSourceRow[]>> {
  const canonicalRows: Partial<
    Record<DiscordHeroContainerKind, readonly ContainerSourceRow[]>
  > = {};
  for (const kind of DISCORD_HERO_CONTAINER_KINDS) {
    const spec = CONTAINER_SPECS[kind];
    const table = indexes.tables[spec.dataset];
    const rows = table.rows as readonly ContainerSourceRow[];
    const groups = table.groups as ReadonlyMap<
      number,
      readonly ContainerSourceRow[]
    >;
    if (rows.length !== spec.capacity) {
      throw new Error(
        `${spec.dataset} source capacity ${rows.length} does not match PlayerState maximum ${spec.capacity}`,
      );
    }
    if (groups.size !== rows.length) {
      throw new Error(
        `${spec.dataset} source index has ${groups.size} keys for ${rows.length} rows`,
      );
    }
    const indexedKeys = [...groups.keys()];
    for (const [position, key] of indexedKeys.entries()) {
      if (key !== position) {
        throw new Error(
          `${spec.dataset} indexed source key ${String(key)} is out of order at ${position}`,
        );
      }
    }
    let paidSlotSeen = false;
    for (const [slotIndex, row] of rows.entries()) {
      if (!Number.isSafeInteger(row.Index) || row.Index < 0) {
        throw new Error(
          `${spec.dataset} source row ${slotIndex} has invalid slot identity`,
        );
      }
      if (row.Index !== slotIndex) {
        throw new Error(
          `${spec.dataset} source row ${row.Index} does not match slot index ${slotIndex}`,
        );
      }
      if (!Number.isSafeInteger(row.CostForUnlock) || row.CostForUnlock < 0) {
        throw new Error(
          `${spec.dataset} source slot ${slotIndex} has invalid unlock cost`,
        );
      }
      if (row.CostForUnlock > 0) paidSlotSeen = true;
      else if (paidSlotSeen) {
        throw new Error(
          `${spec.dataset} zero-cost source slots must form one prefix`,
        );
      }
      const indexed = groups.get(slotIndex);
      if (indexed === undefined) {
        throw new Error(
          `${spec.dataset} indexed source is missing key ${slotIndex}`,
        );
      }
      if (indexed.length !== 1) {
        throw new Error(
          `${spec.dataset} indexed source key ${slotIndex} has ${indexed.length} rows`,
        );
      }
      if (!sameSourceRow(row, indexed[0]!)) {
        throw new Error(
          `${spec.dataset} indexed source key ${slotIndex} disagrees with row ${slotIndex}`,
        );
      }
    }
    canonicalRows[kind] = rows;
  }
  return canonicalRows as Readonly<
    Record<DiscordHeroContainerKind, readonly ContainerSourceRow[]>
  >;
}

function projectionContext(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): ProjectionContext {
  const sourceRows = requireSourceTables(indexes);
  return {
    state: validatePlayerAgainstCatalog(state, indexes),
    sourceRows,
  };
}

function requireContainerKind(value: unknown): DiscordHeroContainerKind {
  if (
    typeof value !== "string" ||
    !(DISCORD_HERO_CONTAINER_KINDS as readonly string[]).includes(value)
  ) {
    throw new Error(
      `DiscordHero container target has unknown kind ${String(value)}`,
    );
  }
  return value as DiscordHeroContainerKind;
}

function kindFromCode(code: string): DiscordHeroContainerKind {
  const kind = DISCORD_HERO_CONTAINER_KINDS.find(
    (candidate) => CONTAINER_SPECS[candidate].code === code,
  );
  if (kind === undefined) {
    throw new Error(
      `DiscordHero container target has unknown kind code ${code}`,
    );
  }
  return kind;
}

function encodeNonNegative(value: number, context: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
  return value.toString(36);
}

function decodeNonNegative(encoded: string, context: string): number {
  if (!/^[0-9a-z]+$/.test(encoded)) {
    throw new Error(`${context} has invalid encoding`);
  }
  const value = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value.toString(36) !== encoded
  ) {
    throw new Error(`${context} has non-canonical encoding`);
  }
  return value;
}

function requireCodecLength(value: string, context: string): void {
  if (value.length === 0 || value.length > MAX_CODEC_LENGTH) {
    throw new Error(`${context} has invalid encoding`);
  }
}

function pageCount(unlockedSlots: number): number {
  return Math.max(1, Math.ceil(unlockedSlots / CONTAINER_PAGE_SIZE));
}

function requirePage(
  context: ProjectionContext,
  kind: DiscordHeroContainerKind,
  page: number,
): void {
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new Error(
      "DiscordHero container page must be a non-negative safe integer",
    );
  }
  const count = pageCount(context.state.containers[kind].unlockedSlots);
  if (page >= count) {
    throw new Error(
      `DiscordHero ${CONTAINER_SPECS[kind].label} page ${page} is outside 0-${count - 1}`,
    );
  }
}

function requireSlot(
  context: ProjectionContext,
  kind: DiscordHeroContainerKind,
  page: number,
  slotIndex: number,
): void {
  requirePage(context, kind, page);
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) {
    throw new Error(
      "DiscordHero container slot must be a non-negative safe integer",
    );
  }
  const unlockedSlots = context.state.containers[kind].unlockedSlots;
  if (slotIndex >= unlockedSlots) {
    throw new Error(
      `DiscordHero ${CONTAINER_SPECS[kind].label} slot ${slotIndex} is outside unlocked capacity ${unlockedSlots}`,
    );
  }
  const expectedPage = Math.floor(slotIndex / CONTAINER_PAGE_SIZE);
  if (page !== expectedPage) {
    throw new Error(
      `DiscordHero ${CONTAINER_SPECS[kind].label} slot ${slotIndex} is on page ${expectedPage}, not ${page}`,
    );
  }
}

function encodePageUnchecked(
  kind: DiscordHeroContainerKind,
  page: number,
): string {
  return `cp-${CONTAINER_SPECS[kind].code}-${page.toString(36)}`;
}

function encodeSlotUnchecked(
  kind: DiscordHeroContainerKind,
  page: number,
  slotIndex: number,
): string {
  return `cs-${CONTAINER_SPECS[kind].code}-${page.toString(36)}-${slotIndex.toString(36)}`;
}

function parsePageTarget(value: string): DecodedDiscordHeroContainerPageTarget {
  requireCodecLength(value, "DiscordHero container page target");
  const match = /^cp-([isot])-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero container page target has invalid encoding");
  }
  const kind = kindFromCode(match[1]!);
  const page = decodeNonNegative(
    match[2]!,
    "DiscordHero container page target",
  );
  return { kind, page };
}

function decodePageUnchecked(
  context: ProjectionContext,
  value: string,
): DecodedDiscordHeroContainerPageTarget {
  const { kind, page } = parsePageTarget(value);
  requirePage(context, kind, page);
  return { kind, page };
}

function parseSlotTarget(value: string): DecodedDiscordHeroContainerSlotTarget {
  requireCodecLength(value, "DiscordHero container slot target");
  const match = /^cs-([isot])-([0-9a-z]+)-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero container slot target has invalid encoding");
  }
  const kind = kindFromCode(match[1]!);
  const page = decodeNonNegative(match[2]!, "DiscordHero container slot page");
  const slotIndex = decodeNonNegative(
    match[3]!,
    "DiscordHero container slot index",
  );
  return { kind, page, slotIndex };
}

function decodeSlotUnchecked(
  context: ProjectionContext,
  value: string,
): DecodedDiscordHeroContainerSlotTarget {
  const { kind, page, slotIndex } = parseSlotTarget(value);
  requireSlot(context, kind, page, slotIndex);
  return { kind, page, slotIndex };
}

function optionText(value: string): string {
  if (value.length <= MAX_OPTION_TEXT_LENGTH) return value;
  const contentBudget = MAX_OPTION_TEXT_LENGTH - 1;
  let preview = "";
  let length = 0;
  for (const codePoint of value) {
    if (length + codePoint.length > contentBudget) break;
    preview += codePoint;
    length += codePoint.length;
  }
  return `${preview}…`;
}

function unlockQuote(
  context: ProjectionContext,
  kind: DiscordHeroContainerKind,
): DiscordHeroContainerUnlockQuote | null {
  const spec = CONTAINER_SPECS[kind];
  const container = context.state.containers[kind];
  if (container.unlockedSlots === spec.capacity) {
    return {
      kind: "maximum-capacity",
      unlockedSlots: container.unlockedSlots,
    };
  }
  const source = context.sourceRows[kind][container.unlockedSlots]!;
  if (source.CostForUnlock === 0) return null;
  return {
    kind: "available",
    slotIndex: source.Index,
    cost: source.CostForUnlock,
    canAfford: context.state.gold >= source.CostForUnlock,
    source: { Index: source.Index, CostForUnlock: source.CostForUnlock },
  };
}

function tab(
  context: ProjectionContext,
  kind: DiscordHeroContainerKind,
): DiscordHeroContainerTab {
  const spec = CONTAINER_SPECS[kind];
  const container = context.state.containers[kind];
  const count = pageCount(container.unlockedSlots);
  return {
    kind,
    label: spec.label,
    capacity: spec.capacity,
    unlocked: container.unlockedSlots,
    occupied: container.slots.length,
    free: container.unlockedSlots - container.slots.length,
    pageCount: count,
    pageTarget: encodePageUnchecked(kind, 0),
    unlockQuote: unlockQuote(context, kind),
  };
}

export function projectDiscordHeroContainerTabs(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
): readonly DiscordHeroContainerTab[] {
  const context = projectionContext(indexes, state);
  return frozenClone(
    DISCORD_HERO_CONTAINER_KINDS.map((kind) => tab(context, kind)),
  ) as readonly DiscordHeroContainerTab[];
}

export function encodeDiscordHeroContainerPageTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  kind: DiscordHeroContainerKind,
  page: number,
): string {
  const context = projectionContext(indexes, state);
  const requiredKind = requireContainerKind(kind);
  requirePage(context, requiredKind, page);
  return encodePageUnchecked(requiredKind, page);
}

export function decodeDiscordHeroContainerPageTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  value: string,
): DecodedDiscordHeroContainerPageTarget {
  const context = projectionContext(indexes, state);
  return frozenClone(
    decodePageUnchecked(context, value),
  ) as DecodedDiscordHeroContainerPageTarget;
}

export function encodeDiscordHeroContainerSlotTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  kind: DiscordHeroContainerKind,
  page: number,
  slotIndex: number,
): string {
  const context = projectionContext(indexes, state);
  const requiredKind = requireContainerKind(kind);
  requireSlot(context, requiredKind, page, slotIndex);
  return encodeSlotUnchecked(requiredKind, page, slotIndex);
}

export function decodeDiscordHeroContainerSlotTarget(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  value: string,
): DecodedDiscordHeroContainerSlotTarget {
  const context = projectionContext(indexes, state);
  return frozenClone(
    decodeSlotUnchecked(context, value),
  ) as DecodedDiscordHeroContainerSlotTarget;
}

export function projectDiscordHeroContainerPage(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  pageTarget: string,
): DiscordHeroContainerPage {
  const context = projectionContext(indexes, state);
  const { kind, page } = decodePageUnchecked(context, pageTarget);
  const summary = tab(context, kind);
  const occupied = new Map(
    context.state.containers[kind].slots.map((slot) => [
      slot.index,
      slot.asset,
    ]),
  );
  const start = page * CONTAINER_PAGE_SIZE;
  const end = Math.min(
    context.state.containers[kind].unlockedSlots,
    start + CONTAINER_PAGE_SIZE,
  );
  const slots: DiscordHeroContainerSlotOption[] = [];
  for (let slotIndex = start; slotIndex < end; slotIndex += 1) {
    const asset = occupied.get(slotIndex);
    const target = encodeSlotUnchecked(kind, page, slotIndex);
    if (asset === undefined) {
      slots.push({
        status: "free",
        slotIndex,
        target,
        label: optionText(`#${slotIndex} Free`),
        description: optionText(`Unlocked slot ${slotIndex}`),
      });
      continue;
    }
    const detail = readDiscordHeroStoredAsset(indexes, asset);
    slots.push({
      status: "occupied",
      slotIndex,
      target,
      label: optionText(`#${slotIndex} ${detail.name}`),
      description: optionText(
        asset.kind === "gear"
          ? `Gear · ${asset.instanceId}`
          : `Stack × ${asset.quantity}`,
      ),
      assetKind: asset.kind,
      itemKey: asset.itemKey,
      instanceId: asset.kind === "gear" ? asset.instanceId : null,
      quantity: asset.kind === "stack" ? asset.quantity : null,
    });
  }
  return frozenClone({
    kind,
    label: summary.label,
    capacity: summary.capacity,
    unlocked: summary.unlocked,
    occupied: summary.occupied,
    free: summary.free,
    page,
    pageCount: summary.pageCount,
    pageTarget: encodePageUnchecked(kind, page),
    slots,
  }) as DiscordHeroContainerPage;
}

function requireOriginatingPage(
  context: ProjectionContext,
  expectedPage: DiscordHeroContainerPage,
): DecodedDiscordHeroContainerPageTarget {
  if (typeof expectedPage !== "object" || expectedPage === null) {
    throw new Error("DiscordHero container detail page context is invalid");
  }
  const expectedKind = requireContainerKind(expectedPage.kind);
  if (!Number.isSafeInteger(expectedPage.page) || expectedPage.page < 0) {
    throw new Error(
      "DiscordHero container detail page context has invalid page",
    );
  }
  if (typeof expectedPage.pageTarget !== "string") {
    throw new Error(
      "DiscordHero container detail page context has invalid target",
    );
  }
  const targetLocation = decodePageUnchecked(context, expectedPage.pageTarget);
  if (expectedKind !== targetLocation.kind) {
    throw new Error(
      `DiscordHero container detail page context kind ${expectedKind} does not match target kind ${targetLocation.kind}`,
    );
  }
  if (expectedPage.page !== targetLocation.page) {
    throw new Error(
      `DiscordHero container detail page context page ${expectedPage.page} does not match target page ${targetLocation.page}`,
    );
  }
  return targetLocation;
}

export function readDiscordHeroContainerSlot(
  indexes: DiscordHeroCatalogIndexes,
  state: PlayerState,
  expectedPage: DiscordHeroContainerPage,
  target: string,
): DiscordHeroContainerSlotDetail {
  const context = projectionContext(indexes, state);
  const origin = requireOriginatingPage(context, expectedPage);
  const { kind, page, slotIndex } = parseSlotTarget(target);
  if (kind !== origin.kind || page !== origin.page) {
    throw new Error(
      `DiscordHero container slot target belongs to ${CONTAINER_SPECS[kind].label} page ${page}, not ${CONTAINER_SPECS[origin.kind].label} page ${origin.page}`,
    );
  }
  requireSlot(context, kind, page, slotIndex);
  const slot = context.state.containers[kind].slots.find(
    (candidate) => candidate.index === slotIndex,
  );
  const detail: DiscordHeroContainerSlotDetail =
    slot === undefined
      ? {
          kind,
          page,
          slotIndex,
          target: encodeSlotUnchecked(kind, page, slotIndex),
          status: "free",
          asset: null,
        }
      : {
          kind,
          page,
          slotIndex,
          target: encodeSlotUnchecked(kind, page, slotIndex),
          status: "occupied",
          asset: readDiscordHeroStoredAsset(indexes, slot.asset),
        };
  return frozenClone(detail) as DiscordHeroContainerSlotDetail;
}
