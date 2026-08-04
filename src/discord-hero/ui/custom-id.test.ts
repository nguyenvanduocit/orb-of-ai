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

  test("round-trips the pre-player revision as exactly new_", () => {
    const value = {
      ownerId: "123",
      view: "party" as const,
      action: "select" as const,
      revision: null,
      value: "starter",
    };
    const encoded = encodeDiscordHeroCustomId(value);

    expect(encoded).toBe("discordhero:123:party:select:new_:starter");
    expect(decodeDiscordHeroCustomId(encoded)).toEqual(value);
  });

  test("keeps the pre-player token out of the base-36 revision space", () => {
    // Every bare word is legal base-36, so a sentinel without the trailing
    // underscore would collide with a revision a real player can reach.
    for (const [encoded, revision] of [
      ["new", 30_344],
      ["none", 1_105_034],
      ["null", 1_112_745],
    ] as const) {
      expect(
        decodeDiscordHeroCustomId(`discordhero:123:party:select:${encoded}`)
          .revision,
      ).toBe(revision);
    }

    for (const encoded of ["NEW_", "New_", "new__", "_new", "0", "01"]) {
      expect(() =>
        decodeDiscordHeroCustomId(`discordhero:123:party:select:${encoded}`),
      ).toThrow("revision");
    }

    for (const revision of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() =>
        encodeDiscordHeroCustomId({
          ownerId: "123",
          view: "party",
          action: "select",
          revision,
        }),
      ).toThrow("revision");
    }
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
