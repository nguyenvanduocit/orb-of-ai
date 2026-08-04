import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import {
  COMPILED_FILE_SHA256,
  type DeepReadonly,
  type DiscordHeroCatalog,
  type DiscordHeroDataset,
  type JsonObject,
  type MonsterAttackEnrichment,
  sha256,
  validateDiscordHeroCatalog,
} from "./compiler";

const DEFAULT_CATALOG_URL = new URL(
  "../../../assets/discordhero/catalog.json",
  import.meta.url,
);

export type { DeepReadonly } from "./compiler";

export type LoadedDiscordHeroCatalog = DeepReadonly<DiscordHeroCatalog>;
export type LoadedDiscordHeroDataset = DeepReadonly<DiscordHeroDataset>;
export type LoadedJsonObject = DeepReadonly<JsonObject>;
export type LoadedMonsterAttackEnrichment =
  DeepReadonly<MonsterAttackEnrichment>;

const applyIntrinsic = Reflect.apply;
const nativeBufferToString = Buffer.prototype.toString;
const nativeJsonParse = JSON.parse;
const nativeObjectFreeze = Object.freeze;
const nativeObjectIsFrozen = Object.isFrozen;
const nativeObjectValues = Object.values;
const nativeWeakSetAdd = WeakSet.prototype.add;
const nativeWeakSetHas = WeakSet.prototype.has;
const loadedCatalogAuthorities = new WeakSet<object>();

function objectValues(value: object): unknown[] {
  return applyIntrinsic(nativeObjectValues, Object, [value]) as unknown[];
}

function objectIsFrozen(value: object): boolean {
  return applyIntrinsic(nativeObjectIsFrozen, Object, [value]) as boolean;
}

function freezeObject<T extends object>(value: T): Readonly<T> {
  return applyIntrinsic(nativeObjectFreeze, Object, [value]) as Readonly<T>;
}

function weakSetAdd(set: WeakSet<object>, value: object): void {
  applyIntrinsic(nativeWeakSetAdd, set, [value]);
}

function weakSetHas(set: WeakSet<object>, value: object): boolean {
  return applyIntrinsic(nativeWeakSetHas, set, [value]) as boolean;
}

export function isLoadedDiscordHeroCatalogAuthority(
  value: unknown,
): value is LoadedDiscordHeroCatalog {
  return (
    typeof value === "object" &&
    value !== null &&
    weakSetHas(loadedCatalogAuthorities, value)
  );
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || objectIsFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  const children = objectValues(value);
  for (let index = 0; index < children.length; index += 1) {
    deepFreeze(children[index]);
  }
  return freezeObject(value) as DeepReadonly<T>;
}

export async function loadDiscordHeroCatalog(
  path: string | URL = DEFAULT_CATALOG_URL,
): Promise<LoadedDiscordHeroCatalog> {
  const bytes = await readFile(path);
  const fileSha256 = sha256(bytes);
  if (fileSha256 !== COMPILED_FILE_SHA256) {
    throw new Error(
      `DiscordHero catalog: file does not match the pinned artifact file SHA-256: ${fileSha256}`,
    );
  }
  const parsed: unknown = applyIntrinsic(nativeJsonParse, JSON, [
    applyIntrinsic(nativeBufferToString, bytes, ["utf8"]) as string,
  ]);
  validateDiscordHeroCatalog(parsed);
  const catalog = deepFreeze(parsed);
  weakSetAdd(loadedCatalogAuthorities, catalog);
  return catalog;
}

export function getDiscordHeroDataset(
  catalog: LoadedDiscordHeroCatalog,
  name: string,
): LoadedDiscordHeroDataset {
  const dataset = catalog.datasets.find((candidate) => candidate.name === name);
  if (dataset === undefined) {
    throw new Error(`DiscordHero catalog: unknown dataset ${name}`);
  }
  return dataset;
}

export function datasetRowToRecord(
  dataset: LoadedDiscordHeroDataset,
  row: LoadedJsonObject,
): LoadedJsonObject {
  const unknownColumns = Object.keys(row).filter(
    (column) => !dataset.columns.includes(column),
  );
  if (unknownColumns.length > 0) {
    throw new Error(
      `DiscordHero catalog: ${dataset.name} row contains unknown columns ${unknownColumns.join(", ")}`,
    );
  }
  return row;
}

export function getMonsterAttackEnrichment(
  catalog: LoadedDiscordHeroCatalog,
  monsterKey: number,
): LoadedMonsterAttackEnrichment {
  const enrichment = catalog.semantic.monsterAttacks.enrichments.find(
    (candidate) => candidate.MonsterKey === monsterKey,
  );
  if (enrichment === undefined) {
    throw new Error(
      `DiscordHero catalog: no attack enrichment for monster ${monsterKey}`,
    );
  }
  return enrichment;
}
