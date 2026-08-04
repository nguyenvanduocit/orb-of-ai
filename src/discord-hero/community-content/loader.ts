import { readFile } from "node:fs/promises";
import {
  COMMUNITY_CONTENT_FILE_SHA256,
  type DiscordHeroCommunityContent,
  sha256,
  validateDiscordHeroCommunityContent,
} from "./compiler";

const DEFAULT_COMMUNITY_CONTENT_URL = new URL(
  "../../../assets/discordhero/community-content.json",
  import.meta.url,
);

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type LoadedDiscordHeroCommunityContent =
  DeepReadonly<DiscordHeroCommunityContent>;

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  Object.freeze(value);
}

export async function loadDiscordHeroCommunityContent(
  path: string | URL = DEFAULT_COMMUNITY_CONTENT_URL,
): Promise<LoadedDiscordHeroCommunityContent> {
  const bytes = await readFile(path);
  const fileSha256 = sha256(bytes);
  if (fileSha256 !== COMMUNITY_CONTENT_FILE_SHA256) {
    throw new Error(
      `DiscordHero community content: file does not match the reviewed artifact SHA-256: ${fileSha256}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(
      "DiscordHero community content: artifact is not valid JSON",
    );
  }
  validateDiscordHeroCommunityContent(parsed);
  deepFreeze(parsed);
  return parsed;
}
