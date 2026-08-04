import { describe, expect, test } from "bun:test";
import {
  assertDiscordHeroComponentOwner,
  decodeDiscordHeroCustomId,
  encodeDiscordHeroCustomId,
} from "./custom-id";

describe("DiscordHero custom IDs", () => {
  test("round-trips an owner-bound, revision-bound component ID", () => {
    const value = {
      ownerId: "12345678901234567890",
      view: "inventory" as const,
      action: "equip" as const,
      revision: Number.MAX_SAFE_INTEGER,
      value: "item_zz",
    };
    const encoded = encodeDiscordHeroCustomId(value);

    expect(encoded.length).toBeLessThanOrEqual(100);
    expect(decodeDiscordHeroCustomId(encoded)).toEqual(value);
  });

  test("round-trips the explicit Alchemy interaction action", () => {
    const value = {
      ownerId: "12345678901234567890",
      view: "cube" as const,
      action: "alchemy" as const,
      revision: Number.MAX_SAFE_INTEGER,
      value: "a-zz",
    };
    const encoded = encodeDiscordHeroCustomId(value);

    expect(encoded.length).toBeLessThanOrEqual(100);
    expect(decodeDiscordHeroCustomId(encoded)).toEqual(value);
  });

  test("rejects stale/non-canonical and delimiter-injection inputs", () => {
    expect(() =>
      decodeDiscordHeroCustomId("discordhero:1:home:view:01"),
    ).toThrow("non-canonical revision");
    expect(() =>
      encodeDiscordHeroCustomId({
        ownerId: "1",
        view: "world",
        action: "select",
        revision: 1,
        value: "1101:confirm",
      }),
    ).toThrow("URL-safe");
    expect(() =>
      decodeDiscordHeroCustomId("discordhero:1:unknown:view:1"),
    ).toThrow("unknown view");
  });

  test("rejects another player before a component can mutate state", () => {
    const decoded = decodeDiscordHeroCustomId(
      encodeDiscordHeroCustomId({
        ownerId: "123",
        view: "cube",
        action: "confirm",
        revision: 7,
      }),
    );

    expect(() => assertDiscordHeroComponentOwner(decoded, "456")).toThrow(
      "another player",
    );
    expect(() => assertDiscordHeroComponentOwner(decoded, "123")).not.toThrow();
  });
});
