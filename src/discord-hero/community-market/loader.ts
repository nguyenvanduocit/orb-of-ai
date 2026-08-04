import { readFile } from "node:fs/promises";
import {
  COMMUNITY_MARKET_FILE_SHA256,
  type DiscordHeroCommunityMarket,
  sha256,
  validateDiscordHeroCommunityMarket,
} from "./compiler";

const DEFAULT_COMMUNITY_MARKET_URL = new URL(
  "../../../assets/discordhero/community-market.json",
  import.meta.url,
);

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type LoadedDiscordHeroCommunityMarket =
  DeepReadonly<DiscordHeroCommunityMarket>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export async function loadDiscordHeroCommunityMarket(
  path: string | URL = DEFAULT_COMMUNITY_MARKET_URL,
): Promise<LoadedDiscordHeroCommunityMarket> {
  const bytes = await readFile(path);
  const fileSha256 = sha256(bytes);
  if (fileSha256 !== COMMUNITY_MARKET_FILE_SHA256) {
    throw new Error(
      `DiscordHero community market: file does not match the reviewed artifact SHA-256: ${fileSha256}`,
    );
  }
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  validateDiscordHeroCommunityMarket(parsed);
  return deepFreeze(parsed);
}
