import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  decodeDiscordHeroCollectionKey,
  decodeDiscordHeroCollectionPage,
  discordHeroCollectionPageCount,
  discordHeroCollectionRows,
  encodeDiscordHeroCollectionPage,
  readDiscordHeroPet,
  readDiscordHeroSkin,
} from "./collection";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero Collection source projection", () => {
  test("covers every pet and skin once in source order with bounded pages", () => {
    expect(discordHeroCollectionPageCount(indexes, "pets")).toBe(1);
    expect(discordHeroCollectionPageCount(indexes, "skins")).toBe(4);

    const petRows = discordHeroCollectionRows(indexes, "pets", 0);
    expect(petRows).toHaveLength(8);
    expect(Object.isFrozen(petRows)).toBe(true);
    expect(petRows.map((row) => row.PetKey)).toEqual(
      indexes.tables.pets.rows.map((row) => row.PetKey),
    );

    const skinPages = Array.from({ length: 4 }, (_, page) =>
      discordHeroCollectionRows(indexes, "skins", page),
    );
    expect(skinPages.map((page) => page.length)).toEqual([25, 25, 25, 25]);
    expect(skinPages.flat().map((row) => row.PcSkinKey)).toEqual(
      indexes.tables.skins.rows.map((row) => row.PcSkinKey),
    );
  });

  test("projects exact pet names, unlock conditions, and every linked stat row", () => {
    const bat = readDiscordHeroPet(indexes, 1001);
    expect(bat).toEqual({
      key: 1001,
      name: "Bat",
      description: "Defeat Bat",
      unlockCondition: "KillMonster",
      unlockParam1: 10031,
      unlockParam2: 5000,
      stats: [
        {
          statType: "DropChanceNormalChestPercent",
          modType: "FLAT",
          value: 100,
        },
        {
          statType: "IncreaseExpAmount",
          modType: "FLAT",
          value: 150,
        },
      ],
    });

    const dragon = readDiscordHeroPet(indexes, 6003);
    expect(dragon.name).toBe("Dragon");
    expect(dragon.unlockCondition).toBe("DLC");
    expect(dragon.unlockParam1).toBe(4_427_390);
    expect(dragon.unlockParam2).toBeNull();
    expect(dragon.stats).toHaveLength(3);

    expect(
      indexes.tables.pets.rows.flatMap((pet) =>
        readDiscordHeroPet(indexes, pet.PetKey).stats.map((stat) => [
          pet.StatDataKey,
          stat.statType,
          stat.modType,
          stat.value,
        ]),
      ),
    ).toEqual(
      indexes.tables.pet_stats.rows.map((stat) => [
        stat.PetStatKey,
        stat.STATTYPE,
        stat.MODTYPE,
        stat.Value,
      ]),
    );
  });

  test("projects exact skin ownership metadata without inventing purchase semantics", () => {
    expect(readDiscordHeroSkin(indexes, 10001)).toEqual({
      key: 10001,
      partsCategory: "Body",
      decorableType: "Body",
      groupKeys: null,
      cost: 0,
      hasUpperLayer: null,
      defaultUnlocked: true,
      iconPath: "Sprites/Icon/PcSkin/Body_10001",
    });
    expect(readDiscordHeroSkin(indexes, 25003)).toEqual({
      key: 25003,
      partsCategory: "Clothing",
      decorableType: "Accessory2",
      groupKeys: null,
      cost: 80,
      hasUpperLayer: null,
      defaultUnlocked: false,
      iconPath: "Sprites/Icon/PcSkin/Accessory2_25003",
    });
    expect(
      indexes.tables.skins.rows.filter((row) => row.IsDefaultUnlocked),
    ).toHaveLength(57);
  });

  test("round-trips canonical locations and rejects forged page/key values", () => {
    expect(
      decodeDiscordHeroCollectionPage(
        encodeDiscordHeroCollectionPage("skins", 3),
      ),
    ).toEqual({ kind: "skins", page: 3 });
    expect(decodeDiscordHeroCollectionKey("pets", "1001")).toBe(1001);
    expect(decodeDiscordHeroCollectionKey("skins", "25003")).toBe(25003);

    for (const value of ["c-s-03", "c-x-0", "c-p--1", "c-p-0-extra"]) {
      expect(() => decodeDiscordHeroCollectionPage(value)).toThrow();
    }
    for (const value of ["0", "01001", "-1", "1e3", "9007199254740992"]) {
      expect(() => decodeDiscordHeroCollectionKey("pets", value)).toThrow();
    }
    expect(() => discordHeroCollectionRows(indexes, "pets", 1)).toThrow(
      "outside",
    );
    expect(() =>
      encodeDiscordHeroCollectionPage("garbage" as unknown as "pets", 0),
    ).toThrow("unknown kind");
    expect(() =>
      decodeDiscordHeroCollectionKey("garbage" as unknown as "pets", "1001"),
    ).toThrow("unknown kind");
    expect(() => readDiscordHeroPet(indexes, 9999)).toThrow("unknown pet");
    expect(() => readDiscordHeroSkin(indexes, 99999)).toThrow("unknown skin");
  });
});
