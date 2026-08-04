const PREFIX = "discordhero";
const MAX_CUSTOM_ID_LENGTH = 100;

export const DISCORD_HERO_VIEWS = [
  "home",
  "heroes",
  "party",
  "world",
  "inventory",
  "runes",
  "cube",
  "collection",
  "codex",
  "market",
] as const;

export const DISCORD_HERO_ACTIONS = [
  "view",
  "page",
  "select",
  "unlock",
  "upgrade",
  "alchemy",
  "equip",
  "unequip",
  "start",
  "resume",
  "collect",
  "export",
  "confirm",
  "cancel",
] as const;

export type DiscordHeroView = (typeof DISCORD_HERO_VIEWS)[number];
export type DiscordHeroAction = (typeof DISCORD_HERO_ACTIONS)[number];

export interface DiscordHeroCustomId {
  ownerId: string;
  view: DiscordHeroView;
  action: DiscordHeroAction;
  revision: number;
  value?: string;
}

const VIEW_SET = new Set<string>(DISCORD_HERO_VIEWS);
const ACTION_SET = new Set<string>(DISCORD_HERO_ACTIONS);

function encodeRevision(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error(
      "DiscordHero custom ID revision must be a positive safe integer",
    );
  }
  return revision.toString(36);
}

function decodeRevision(encoded: string): number {
  if (!/^[0-9a-z]+$/.test(encoded)) {
    throw new Error("DiscordHero custom ID has an invalid revision");
  }
  const revision = Number.parseInt(encoded, 36);
  if (
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    revision.toString(36) !== encoded
  ) {
    throw new Error("DiscordHero custom ID has a non-canonical revision");
  }
  return revision;
}

function validateOwnerId(ownerId: string): void {
  if (!/^\d{1,20}$/.test(ownerId)) {
    throw new Error("DiscordHero custom ID owner must be a Discord snowflake");
  }
}

function validateValue(value: string): void {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(value)) {
    throw new Error(
      "DiscordHero custom ID value must contain 1-32 URL-safe characters",
    );
  }
}

export function encodeDiscordHeroCustomId(input: DiscordHeroCustomId): string {
  validateOwnerId(input.ownerId);
  if (!VIEW_SET.has(input.view)) {
    throw new Error(
      `DiscordHero custom ID has unknown view ${String(input.view)}`,
    );
  }
  if (!ACTION_SET.has(input.action)) {
    throw new Error(
      `DiscordHero custom ID has unknown action ${String(input.action)}`,
    );
  }
  if (input.value !== undefined) validateValue(input.value);

  const parts = [
    PREFIX,
    input.ownerId,
    input.view,
    input.action,
    encodeRevision(input.revision),
  ];
  if (input.value !== undefined) parts.push(input.value);
  const encoded = parts.join(":");
  if (encoded.length > MAX_CUSTOM_ID_LENGTH) {
    throw new Error(
      "DiscordHero custom ID exceeds Discord's 100-character limit",
    );
  }
  return encoded;
}

export function decodeDiscordHeroCustomId(
  customId: string,
): DiscordHeroCustomId {
  if (customId.length > MAX_CUSTOM_ID_LENGTH) {
    throw new Error(
      "DiscordHero custom ID exceeds Discord's 100-character limit",
    );
  }
  const parts = customId.split(":");
  if (parts.length !== 5 && parts.length !== 6) {
    throw new Error("DiscordHero custom ID has an invalid field count");
  }
  const [prefix, ownerId, view, action, encodedRevision, value] = parts;
  if (prefix !== PREFIX) {
    throw new Error("DiscordHero custom ID has an invalid prefix");
  }
  validateOwnerId(ownerId!);
  if (!VIEW_SET.has(view!)) {
    throw new Error(`DiscordHero custom ID has unknown view ${String(view)}`);
  }
  if (!ACTION_SET.has(action!)) {
    throw new Error(
      `DiscordHero custom ID has unknown action ${String(action)}`,
    );
  }
  if (value !== undefined) validateValue(value);

  return {
    ownerId: ownerId!,
    view: view as DiscordHeroView,
    action: action as DiscordHeroAction,
    revision: decodeRevision(encodedRevision!),
    ...(value === undefined ? {} : { value }),
  };
}

export function assertDiscordHeroComponentOwner(
  customId: DiscordHeroCustomId,
  interactionUserId: string,
): void {
  if (customId.ownerId !== interactionUserId) {
    throw new Error("DiscordHero component belongs to another player");
  }
}
