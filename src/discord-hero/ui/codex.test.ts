import { beforeAll, describe, expect, test } from "bun:test";
import {
  DISCORD_HERO_DATASET_NAMES,
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import {
  decodeDiscordHeroCodexDatasetPage,
  decodeDiscordHeroCodexRecordTarget,
  decodeDiscordHeroCodexRowPage,
  discordHeroCodexDatasetPageCount,
  discordHeroCodexDatasets,
  encodeDiscordHeroCodexDatasetPage,
  encodeDiscordHeroCodexRecordTarget,
  encodeDiscordHeroCodexRowPage,
  readDiscordHeroCodexRecord,
} from "./codex";

let indexes: DiscordHeroCatalogIndexes;

beforeAll(async () => {
  indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
});

describe("DiscordHero source Codex", () => {
  test("makes all 45 datasets selectable within Discord's 25-option limit", () => {
    expect(discordHeroCodexDatasetPageCount()).toBe(2);
    const pages = [0, 1].map(discordHeroCodexDatasets);
    expect(pages[0]).toHaveLength(25);
    expect(pages[1]).toHaveLength(20);
    expect(pages.flat()).toEqual([...DISCORD_HERO_DATASET_NAMES]);
    expect(() => discordHeroCodexDatasets(-1)).toThrow("out of range");
    expect(() => discordHeroCodexDatasets(2)).toThrow("out of range");
  });

  test("round-trips canonical dataset-page and record targets", () => {
    for (let page = 0; page < discordHeroCodexDatasetPageCount(); page += 1) {
      expect(
        decodeDiscordHeroCodexDatasetPage(
          encodeDiscordHeroCodexDatasetPage(page),
        ),
      ).toBe(page);
    }
    for (const datasetName of DISCORD_HERO_DATASET_NAMES) {
      const target = encodeDiscordHeroCodexRecordTarget(datasetName, 12_345);
      expect(target.length).toBeLessThanOrEqual(32);
      expect(decodeDiscordHeroCodexRecordTarget(target)).toEqual({
        datasetName,
        rowIndex: 12_345,
      });
      for (const direction of ["previous", "next"] as const) {
        const pageTarget = encodeDiscordHeroCodexRowPage(
          direction,
          datasetName,
          12_345,
        );
        expect(pageTarget.length).toBeLessThanOrEqual(32);
        expect(decodeDiscordHeroCodexRowPage(pageTarget)).toEqual({
          direction,
          datasetName,
          rowIndex: 12_345,
        });
      }
    }
    expect(() => decodeDiscordHeroCodexDatasetPage("d-00")).toThrow(
      "non-canonical",
    );
    expect(() =>
      decodeDiscordHeroCodexRecordTarget("r-not_source-0"),
    ).toThrow("malformed");
    expect(() =>
      decodeDiscordHeroCodexRecordTarget("r-items-00"),
    ).toThrow("non-canonical");
    expect(() => decodeDiscordHeroCodexRowPage("x-items-0")).toThrow(
      "malformed",
    );
  });

  test("exports every source row exactly and previews without mutating it", () => {
    let visitedRows = 0;
    for (const datasetName of DISCORD_HERO_DATASET_NAMES) {
      const rows = indexes.tables[datasetName].rows;
      for (const [rowIndex, row] of rows.entries()) {
        const record = readDiscordHeroCodexRecord(
          indexes,
          datasetName,
          rowIndex,
        );
        const prettyJson = JSON.stringify(row, null, 2);
        expect(record.rawJson).toBe(JSON.stringify(row));
        expect(record.rowCount).toBe(rows.length);
        expect(record.exportFilename).toBe(
          `discordhero-${datasetName}-${rowIndex + 1}.json`,
        );
        if (record.previewTruncated) {
          expect(record.preview.endsWith("\n…")).toBe(true);
          expect(prettyJson.startsWith(record.preview.slice(0, -2))).toBe(
            true,
          );
        } else {
          expect(record.preview).toBe(prettyJson);
        }
        visitedRows += 1;
      }
    }
    expect(visitedRows).toBe(indexes.catalog.totals.rows);
    expect(visitedRows).toBe(25_757);
  });

  test("fails closed on forged or out-of-range row indexes", () => {
    expect(() => readDiscordHeroCodexRecord(indexes, "heroes", -1)).toThrow(
      "out of range",
    );
    expect(() =>
      readDiscordHeroCodexRecord(
        indexes,
        "heroes",
        indexes.tables.heroes.rows.length,
      ),
    ).toThrow("out of range");
  });
});
