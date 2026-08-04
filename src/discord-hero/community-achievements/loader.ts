import { readFile } from "node:fs/promises";
import {
  COMMUNITY_ACHIEVEMENTS_FILE_SHA256,
  type DiscordHeroCommunityAchievements,
  sha256,
  validateDiscordHeroCommunityAchievements,
} from "./compiler";

const DEFAULT_COMMUNITY_ACHIEVEMENTS_URL = new URL(
  "../../../assets/discordhero/community-achievements.json",
  import.meta.url,
);

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type LoadedDiscordHeroCommunityAchievements =
  DeepReadonly<DiscordHeroCommunityAchievements>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export async function loadDiscordHeroCommunityAchievements(
  path: string | URL = DEFAULT_COMMUNITY_ACHIEVEMENTS_URL,
): Promise<LoadedDiscordHeroCommunityAchievements> {
  const bytes = await readFile(path);
  const fileSha256 = sha256(bytes);
  if (fileSha256 !== COMMUNITY_ACHIEVEMENTS_FILE_SHA256) {
    throw new Error(
      `DiscordHero community achievements: file does not match the reviewed artifact SHA-256: ${fileSha256}`,
    );
  }
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  validateDiscordHeroCommunityAchievements(parsed);
  return deepFreeze(parsed);
}
