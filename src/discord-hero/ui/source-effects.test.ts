import { beforeAll, describe, expect, test } from "bun:test";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { projectSourceEffectTopology } from "../domain/source-effects";
import {
  DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE,
  DISCORD_HERO_SOURCE_EFFECTS_SECTIONS,
  discordHeroSourceEffectsDetail,
  discordHeroSourceEffectsPage,
  discordHeroSourceEffectsPageCount,
  discordHeroSourceEffectsSectionSummary,
  discordHeroSourceEffectsTextRows,
  filterDiscordHeroSourceEffectsPage,
  projectDiscordHeroSourceEffectsBrowser,
  type DiscordHeroSourceEffectsSection,
} from "./source-effects";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function withRows(
  source: DiscordHeroCatalogIndexes,
  name: "buffs" | "status_effects",
  mutate: (rows: Record<string, unknown>[]) => void,
): DiscordHeroCatalogIndexes {
  const rows = source.tables[name].rows.map((row) => ({
    ...row,
  })) as Record<string, unknown>[];
  mutate(rows);
  return {
    ...source,
    tables: {
      ...source.tables,
      [name]: {
        ...source.tables[name],
        rows,
      },
    },
  } as unknown as DiscordHeroCatalogIndexes;
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function expectDiscordSafePlainText(value: string): void {
  expect(value.length).toBeLessThanOrEqual(200);
  expect(value).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u);
  expect(value).not.toContain("`");
  expect(value).not.toMatch(/@(?:everyone|here)|<@!?\d+>|<@&\d+>|<#\d+>/iu);
  expect(hasLoneSurrogate(value)).toBe(false);
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return (error as Error).message;
  }
  throw new Error("expected operation to reject");
}

const TRAILING_SPACE_MONSTER_SKILL_REFERENCES = [
  [20011, 200111],
  [20021, 200211],
  [20022, 200221],
  [20023, 200231],
  [20024, 200241],
  [20031, 200311],
  [20041, 200411],
  [20042, 200421],
  [20051, 200511],
  [20061, 200611],
  [20062, 200621],
  [20071, 200711],
  [20081, 200811],
  [20091, 200911],
  [20111, 201111],
  [30011, 300111],
  [30012, 300121],
  [30013, 300131],
  [30021, 300211],
  [30031, 300311],
  [30041, 300411],
  [30042, 300421],
  [30043, 300431],
  [30044, 300441],
  [30051, 300511],
  [30061, 300611],
  [30071, 300711],
  [30081, 300811],
  [30082, 300821],
  [30083, 300831],
  [30084, 300841],
  [30091, 300911],
  [30111, 301111],
] as const;

describe("DiscordHero Source Effects browser read model", () => {
  test("exposes five catalog-ordered sections with exact topology counts", () => {
    const browser = projectDiscordHeroSourceEffectsBrowser(indexes);
    expect([...DISCORD_HERO_SOURCE_EFFECTS_SECTIONS]).toEqual([
      "skills",
      "buff-groups",
      "buffs",
      "status-effects",
      "monster-skill-references",
    ]);
    expect(browser.counts).toEqual({
      skills: 106,
      buffGroupRows: 16,
      uniqueBuffGroupKeys: 15,
      buffs: 29,
      statusEffects: 6,
      monsterSkillReferences: 91,
    });
    expect(browser.sections.map((section) => section.section)).toEqual([
      ...DISCORD_HERO_SOURCE_EFFECTS_SECTIONS,
    ]);
    expect(browser.sections.map((section) => section.rowCount)).toEqual([
      106, 16, 29, 6, 91,
    ]);
    expectDeeplyFrozen(browser);
  });

  test("pages skills in catalog order with page size 25 and preserves raw fields", () => {
    expect(DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE).toBe(25);
    expect(discordHeroSourceEffectsPageCount(indexes, "skills")).toBe(5);
    const pages = Array.from({ length: 5 }, (_, page) =>
      discordHeroSourceEffectsPage(indexes, {
        section: "skills",
        page,
      }),
    );
    expect(pages.map((page) => page.rows.length)).toEqual([25, 25, 25, 25, 6]);
    const skillKeys = pages.flatMap((page) =>
      page.rows.map((row) => {
        expect(row.section).toBe("skills");
        if (row.section !== "skills") throw new Error("expected skills row");
        return row.skillKey;
      }),
    );
    expect(skillKeys).toEqual(
      projectSourceEffectTopology({ indexes }).skills.map(
        (skill) => skill.skillKey,
      ),
    );
    const first = pages[0]!.rows[0]!;
    expect(first).toMatchObject({
      section: "skills",
      rowIndex: 0,
      skillKey: 10001,
      activationType: "BASEATTACK",
      activationValue: 0,
      skillBuffType: "Normal",
      buffGroupKey: null,
      damageType: "Physical",
      deliveryType: "Melee",
      range: 140,
      value: 1000,
      buffGroupReference: { kind: "none" },
      resolutionLabel: "resolved",
    });
  });

  test("preserves trailing-space skill keys and does not invent localized names", () => {
    const topology = projectSourceEffectTopology({ indexes });
    const rowIndex = topology.skills.findIndex(
      (skill) => skill.skillKey === "200111 ",
    );
    expect(rowIndex).toBeGreaterThanOrEqual(0);
    const page = Math.floor(rowIndex / DISCORD_HERO_SOURCE_EFFECTS_PAGE_SIZE);
    const rows = discordHeroSourceEffectsPage(indexes, {
      section: "skills",
      page,
    }).rows;
    const row = rows.find(
      (candidate) =>
        candidate.section === "skills" && candidate.rowIndex === rowIndex,
    );
    expect(row).toMatchObject({
      section: "skills",
      skillKey: "200111 ",
      value: "1000 ",
      resolutionLabel: "resolved",
    });
    expect(JSON.stringify(row)).not.toMatch(/Piercing|localized|displayName/i);
  });

  test("surfaces missing buff 206011, duplicate 60601 rows, and four runtime-value-unresolved buffs", () => {
    const buffGroups = discordHeroSourceEffectsPage(indexes, {
      section: "buff-groups",
      page: 0,
    });
    expect(buffGroups.rows).toHaveLength(16);
    const missing = buffGroups.rows.find(
      (row) => row.section === "buff-groups" && row.buffGroupKey === 20601,
    );
    expect(missing).toMatchObject({
      section: "buff-groups",
      buffGroupKey: 20601,
      resolutionLabel: "unresolved-source",
      buffReferences: [
        {
          kind: "unresolved-source",
          buffKey: 206011,
          ruleId: "buff_groups.BuffKeys->buffs",
        },
      ],
    });

    const duplicates = buffGroups.rows.filter(
      (row) => row.section === "buff-groups" && row.buffGroupKey === 60601,
    );
    expect(duplicates).toEqual([
      expect.objectContaining({
        rowIndex: 10,
        buffGroupKey: 60601,
        rawBuffKeys: 606011,
        resolutionLabel: "resolved",
      }),
      expect.objectContaining({
        rowIndex: 11,
        buffGroupKey: 60601,
        rawBuffKeys: null,
        resolutionLabel: "resolved",
      }),
    ]);

    const buffs = discordHeroSourceEffectsPage(indexes, {
      section: "buffs",
      page: 0,
    });
    expect(buffs.rows).toHaveLength(25);
    const page1 = discordHeroSourceEffectsPage(indexes, {
      section: "buffs",
      page: 1,
    });
    expect(page1.rows).toHaveLength(4);
    const allBuffs = [...buffs.rows, ...page1.rows];
    const unresolvedValues = allBuffs.filter(
      (row) =>
        row.section === "buffs" &&
        row.runtimeValue.kind === "runtime-value-unresolved",
    );
    expect(
      unresolvedValues.map((row) =>
        row.section === "buffs" ? row.buffKey : null,
      ),
    ).toEqual([402011, 405011, 405012, 405013]);
    expect(
      unresolvedValues.every(
        (row) =>
          row.section === "buffs" &&
          row.resolutionLabel === "runtime-value-unresolved",
      ),
    ).toBe(true);
  });

  test("keeps status effects as a separate six-row topology section", () => {
    expect(discordHeroSourceEffectsPageCount(indexes, "status-effects")).toBe(
      1,
    );
    const page = discordHeroSourceEffectsPage(indexes, {
      section: "status-effects",
      page: 0,
    });
    expect(page.rows).toHaveLength(6);
    expect(
      page.rows.map((row) =>
        row.section === "status-effects"
          ? [row.statusEffectKey, row.statusEffectType, row.duration]
          : null,
      ),
    ).toEqual([
      [101, "Chill", 400],
      [102, "Freeze", 150],
      [103, "Ignite", 400],
      [104, "Shock", 600],
      [105, "Bleed", 700],
      [106, "Stun", 200],
    ]);
    expect(
      page.rows.every(
        (row) =>
          row.section === "status-effects" &&
          row.resolutionLabel === "resolved",
      ),
    ).toBe(true);
  });

  test("lists all 91 monster skill references with exactly 33 trailing-space unresolved labels", () => {
    expect(
      discordHeroSourceEffectsPageCount(indexes, "monster-skill-references"),
    ).toBe(4);
    const pages = Array.from({ length: 4 }, (_, page) =>
      discordHeroSourceEffectsPage(indexes, {
        section: "monster-skill-references",
        page,
      }),
    );
    expect(pages.map((page) => page.rows.length)).toEqual([25, 25, 25, 16]);
    const refs = pages.flatMap((page) => page.rows);
    expect(refs).toHaveLength(91);
    const unresolved = refs.filter(
      (row) =>
        row.section === "monster-skill-references" &&
        row.resolutionLabel === "unresolved-source",
    );
    expect(unresolved).toHaveLength(33);
    expect(
      unresolved.map((row) =>
        row.section === "monster-skill-references"
          ? [row.monsterKey, row.skillKey]
          : null,
      ),
    ).toEqual(
      TRAILING_SPACE_MONSTER_SKILL_REFERENCES.map(([monsterKey, skillKey]) => [
        monsterKey,
        skillKey,
      ]),
    );
    for (const row of unresolved) {
      if (row.section !== "monster-skill-references") continue;
      expect(row.kind).toBe("unresolved-source");
      expect(row.apparentSkillKey).toBe(`${row.skillKey} `);
      expect(row.ruleId).toBe("monsters.SkillKey->skills");
    }
  });

  test("filters pages by resolution label without inventing eligibility semantics", () => {
    const unresolvedMonsters = filterDiscordHeroSourceEffectsPage(indexes, {
      section: "monster-skill-references",
      page: 0,
      resolutionLabel: "unresolved-source",
    });
    expect(unresolvedMonsters.totalMatching).toBe(33);
    expect(unresolvedMonsters.pageCount).toBe(2);
    expect(unresolvedMonsters.rows).toHaveLength(25);
    expect(
      unresolvedMonsters.rows.every(
        (row) => row.resolutionLabel === "unresolved-source",
      ),
    ).toBe(true);

    const runtimeBuffs = filterDiscordHeroSourceEffectsPage(indexes, {
      section: "buffs",
      page: 0,
      resolutionLabel: "runtime-value-unresolved",
    });
    expect(runtimeBuffs.totalMatching).toBe(4);
    expect(runtimeBuffs.pageCount).toBe(1);
    expect(runtimeBuffs.rows).toHaveLength(4);

    const serialized = JSON.stringify(unresolvedMonsters).toLowerCase();
    for (const forbidden of [
      "stacking",
      "expiry",
      "cooldown start",
      "damage application",
      "rng",
      "target selection",
      "probability",
      "guaranteed",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("returns bounded Discord-safe text rows and exact detail panels", () => {
    const skillDetail = discordHeroSourceEffectsDetail(indexes, {
      section: "skills",
      rowIndex: 0,
    });
    expect(skillDetail).toMatchObject({
      section: "skills",
      rowIndex: 0,
      skillKey: 10001,
    });
    const textRows = discordHeroSourceEffectsTextRows(indexes, {
      section: "skills",
      page: 0,
    });
    expect(textRows.length).toBeLessThanOrEqual(25);
    expect(textRows.every((row) => row.length <= 200)).toBe(true);
    expect(textRows[0]).toContain("10001");
    expect(textRows[0]).toContain("BASEATTACK");
    expect(textRows.every((row) => !row.includes("\u0000"))).toBe(true);

    const summary = discordHeroSourceEffectsSectionSummary(indexes, "buffs");
    expect(summary).toEqual({
      section: "buffs",
      rowCount: 29,
      pageCount: 2,
      resolvedCount: 25,
      unresolvedSourceCount: 0,
      runtimeValueUnresolvedCount: 4,
    });
  });

  test("sanitizes forged source text only at the Discord presentation boundary", () => {
    const unsafeBuffType =
      "@everyone @here <@123> <@!456> <@&789> <#101112>\n\r```inline` \u0000\u0001\u001f\u007f\u0085";
    const unsafeStatusType =
      "<#202122> <@&232425> @everyone\r\n`status` \u0000\u2028\u2029\ud83d";
    const forgedBuffs = withRows(indexes, "buffs", (rows) => {
      rows[6]!.STATTYPE = unsafeBuffType;
    });
    const forgedStatuses = withRows(indexes, "status_effects", (rows) => {
      rows[0]!.StatusEffectType = unsafeStatusType;
    });

    const buffText = discordHeroSourceEffectsTextRows(forgedBuffs, {
      section: "buffs",
      page: 0,
    })[6]!;
    const statusText = discordHeroSourceEffectsTextRows(forgedStatuses, {
      section: "status-effects",
      page: 0,
    })[0]!;

    expectDiscordSafePlainText(buffText);
    expectDiscordSafePlainText(statusText);
    expect(buffText).toBe(
      discordHeroSourceEffectsTextRows(forgedBuffs, {
        section: "buffs",
        page: 0,
      })[6],
    );
    expect(statusText).toBe(
      discordHeroSourceEffectsTextRows(forgedStatuses, {
        section: "status-effects",
        page: 0,
      })[0],
    );

    const buffDetail = discordHeroSourceEffectsDetail(forgedBuffs, {
      section: "buffs",
      rowIndex: 6,
    });
    const statusDetail = discordHeroSourceEffectsDetail(forgedStatuses, {
      section: "status-effects",
      rowIndex: 0,
    });
    expect(buffDetail.section).toBe("buffs");
    expect(statusDetail.section).toBe("status-effects");
    if (
      buffDetail.section !== "buffs" ||
      statusDetail.section !== "status-effects"
    ) {
      throw new Error("expected exact source detail rows");
    }
    expect(buffDetail.statType).toBe(unsafeBuffType);
    expect(statusDetail.statusEffectType).toBe(unsafeStatusType);
  });

  test("truncates forged astral text without producing a lone surrogate", () => {
    const boundaryValue = `${"a".repeat(181)}😀${"b".repeat(40)}`;
    const forged = withRows(indexes, "buffs", (rows) => {
      rows[6]!.STATTYPE = boundaryValue;
    });

    const first = discordHeroSourceEffectsTextRows(forged, {
      section: "buffs",
      page: 0,
    })[6]!;
    const second = discordHeroSourceEffectsTextRows(forged, {
      section: "buffs",
      page: 0,
    })[6]!;

    expect(first).toBe(second);
    expect(first).toEndWith("…");
    expectDiscordSafePlainText(first);
    expect(
      discordHeroSourceEffectsDetail(forged, {
        section: "buffs",
        rowIndex: 6,
      }),
    ).toMatchObject({ statType: boundaryValue });
  });

  test("describes invalid value types without invoking hostile coercion", () => {
    let coercionCalls = 0;
    const hostile = {
      toString() {
        coercionCalls += 1;
        throw new Error("hostile coercion executed");
      },
    };

    const pageError = errorMessage(() =>
      discordHeroSourceEffectsPage(indexes, {
        section: hostile,
        page: 0,
      } as never),
    );
    const filterError = errorMessage(() =>
      filterDiscordHeroSourceEffectsPage(indexes, {
        section: "buffs",
        page: 0,
        resolutionLabel: hostile,
      } as never),
    );

    expect(coercionCalls).toBe(0);
    expect(pageError).toBe(
      "source-effects page input.section must be a known section string; received object",
    );
    expect(filterError).toBe(
      "source-effects filter input.resolutionLabel must be a known resolution label string; received object",
    );
    expectDiscordSafePlainText(pageError);
    expectDiscordSafePlainText(filterError);
  });

  test("sanitizes attacker-controlled property names in rejection errors", () => {
    const unsafeField = "@everyone\n```field```\u0000";
    const input: Record<string, unknown> = {
      section: "skills",
      page: 0,
    };
    input[unsafeField] = true;

    const message = errorMessage(() =>
      discordHeroSourceEffectsPage(indexes, input as never),
    );

    expect(message).toContain("source-effects page input has unknown field");
    expectDiscordSafePlainText(message);
  });

  test("rejects own accessors across page, filter, and detail without reading them", () => {
    let accessorReads = 0;
    const page = { section: "skills" };
    Object.defineProperty(page, "page", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 0;
      },
    });
    const filter = { section: "buffs", page: 0 };
    Object.defineProperty(filter, "resolutionLabel", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "resolved";
      },
    });
    const detail = { section: "status-effects" };
    Object.defineProperty(detail, "rowIndex", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return 0;
      },
    });

    for (const run of [
      () => discordHeroSourceEffectsPage(indexes, page as never),
      () => filterDiscordHeroSourceEffectsPage(indexes, filter as never),
      () => discordHeroSourceEffectsDetail(indexes, detail as never),
    ]) {
      expect(run).toThrow(/own data properties without accessors/i);
    }
    expect(accessorReads).toBe(0);
  });

  test("rejects symbol own keys across page, filter, and detail", () => {
    for (const run of [
      () =>
        discordHeroSourceEffectsPage(indexes, {
          section: "skills",
          page: 0,
          [Symbol("page")]: true,
        } as never),
      () =>
        filterDiscordHeroSourceEffectsPage(indexes, {
          section: "buffs",
          page: 0,
          resolutionLabel: "resolved",
          [Symbol("filter")]: true,
        } as never),
      () =>
        discordHeroSourceEffectsDetail(indexes, {
          section: "status-effects",
          rowIndex: 0,
          [Symbol("detail")]: true,
        } as never),
    ]) {
      expect(run).toThrow(/symbol own keys/i);
    }
  });

  test("rejects nonstandard prototypes across page, filter, and detail", () => {
    const page = Object.assign(Object.create({ inherited: true }), {
      section: "skills",
      page: 0,
    });
    const filter = Object.assign(Object.create({ inherited: true }), {
      section: "buffs",
      page: 0,
      resolutionLabel: "resolved",
    });
    const detail = Object.assign(Object.create({ inherited: true }), {
      section: "status-effects",
      rowIndex: 0,
    });

    for (const run of [
      () => discordHeroSourceEffectsPage(indexes, page as never),
      () => filterDiscordHeroSourceEffectsPage(indexes, filter as never),
      () => discordHeroSourceEffectsDetail(indexes, detail as never),
    ]) {
      expect(run).toThrow(/prototype must be Object\.prototype or null/i);
    }
  });

  test("fails closed on exact-own page/filter/detail inputs and out-of-range pages", () => {
    expect(() =>
      discordHeroSourceEffectsPage(indexes, {
        section: "skills",
        page: 0,
        extra: true,
      } as never),
    ).toThrow(/unknown field|exact/i);
    expect(() =>
      discordHeroSourceEffectsPage(indexes, {
        page: 0,
      } as never),
    ).toThrow(/missing field|section/i);
    expect(() =>
      discordHeroSourceEffectsPage(indexes, {
        section: "skills",
        page: 99,
      }),
    ).toThrow(/outside|out of range/i);
    expect(() =>
      discordHeroSourceEffectsDetail(indexes, {
        section: "status-effects",
        rowIndex: 99,
      }),
    ).toThrow(/outside|out of range/i);
    expect(() =>
      filterDiscordHeroSourceEffectsPage(indexes, {
        section: "buffs",
        page: 0,
        resolutionLabel: "not-a-label" as never,
      }),
    ).toThrow(/resolutionLabel|unknown/i);

    const proto = Object.create({ section: "skills", page: 0 });
    expect(() => discordHeroSourceEffectsPage(indexes, proto as never)).toThrow(
      /prototype|own/i,
    );
  });

  test("returns detached frozen pages and leaves indexes unchanged", () => {
    const before = JSON.stringify(indexes.tables.skills.rows);
    const first = discordHeroSourceEffectsPage(indexes, {
      section: "skills",
      page: 0,
    });
    const second = discordHeroSourceEffectsPage(indexes, {
      section: "skills",
      page: 0,
    });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.rows).not.toBe(second.rows);
    expectDeeplyFrozen(first);
    expect(JSON.stringify(indexes.tables.skills.rows)).toBe(before);
  });
});
