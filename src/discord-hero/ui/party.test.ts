import { describe, expect, test } from "bun:test";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { createFreshPlayerStateFromCatalog } from "../domain/invariants";
import type { PlayerState } from "../domain/player";
import {
  decodeDiscordHeroPartySlot,
  encodeDiscordHeroPartySlot,
  projectDiscordHeroParty,
} from "./party";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());

const CAPACITY_RUNES = {
  1: [],
  2: [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
  ],
  3: [
    { key: 1, level: 1 },
    { key: 20, level: 1 },
    { key: 21, level: 1 },
    { key: 22, level: 1 },
    { key: 23, level: 1 },
    { key: 24, level: 1 },
  ],
} as const;

function stateAt(
  capacity: 1 | 2 | 3,
  party: PlayerState["party"],
): PlayerState {
  const state = createFreshPlayerStateFromCatalog(indexes, 101);
  state.runes = CAPACITY_RUNES[capacity].map((rune) => ({ ...rune }));
  state.party = [...party] as PlayerState["party"];
  return state;
}

const keysOf = (options: readonly { heroKey: number }[]) =>
  options.map((option) => option.heroKey);

describe("DiscordHero formation projection", () => {
  test("locks every slot past capacity one", () => {
    const projection = projectDiscordHeroParty(
      indexes,
      stateAt(1, [101, null, null]),
    );

    expect(projection.capacity).toBe(1);
    expect(projection.occupied).toBe(1);
    expect(projection.slots.map((slot) => slot.status)).toEqual([
      "occupied",
      "locked",
      "locked",
    ]);
    expect(keysOf(projection.slots[0]!.options)).toEqual([101, 201, 301]);
    expect(projection.slots[1]!.options).toEqual([]);
    expect(projection.slots[2]!.options).toEqual([]);
    expect(projection.slots[0]!.heroName).toBe("Knight");
  });

  test("offers only undeployed heroes to the first empty unlocked slot", () => {
    const projection = projectDiscordHeroParty(
      indexes,
      stateAt(2, [101, null, null]),
    );

    expect(projection.slots.map((slot) => slot.status)).toEqual([
      "occupied",
      "empty",
      "locked",
    ]);
    expect(keysOf(projection.slots[1]!.options)).toEqual([201, 301]);
    expect(projection.slots[2]!.options).toEqual([]);
  });

  test("keeps every owned hero available on an occupied slot so swap and replace both work", () => {
    const projection = projectDiscordHeroParty(
      indexes,
      stateAt(2, [101, 201, null]),
    );

    expect(projection.occupied).toBe(2);
    for (const slot of [0, 1]) {
      expect(keysOf(projection.slots[slot]!.options)).toEqual([101, 201, 301]);
    }
  });

  test("never opens a slot that would leave a hole", () => {
    const sparse = projectDiscordHeroParty(
      indexes,
      stateAt(3, [101, null, null]),
    );
    expect(sparse.slots.map((slot) => slot.status)).toEqual([
      "occupied",
      "empty",
      "empty",
    ]);
    expect(keysOf(sparse.slots[1]!.options)).toEqual([201, 301]);
    expect(sparse.slots[2]!.options).toEqual([]);

    const filled = projectDiscordHeroParty(
      indexes,
      stateAt(3, [101, 201, null]),
    );
    expect(keysOf(filled.slots[2]!.options)).toEqual([301]);
  });

  test("round-trips only canonical slot tokens", () => {
    expect(encodeDiscordHeroPartySlot(1)).toBe("s-1");
    expect(encodeDiscordHeroPartySlot(3)).toBe("s-3");
    expect(decodeDiscordHeroPartySlot("s-3")).toBe(3);
    for (const invalid of [
      "s-0",
      "s-4",
      "s-01",
      "S-1",
      "1",
      "s-",
      "",
      "s-1 ",
    ]) {
      expect(() => decodeDiscordHeroPartySlot(invalid)).toThrow();
    }
  });

  test("returns a detached projection", () => {
    const state = stateAt(2, [101, null, null]);
    const projection = projectDiscordHeroParty(indexes, state);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.slots)).toBe(true);
    expect(Object.isFrozen(projection.slots[0]!.options)).toBe(true);
  });
});
