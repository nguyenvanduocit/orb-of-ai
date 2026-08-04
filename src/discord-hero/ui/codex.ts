import {
  DISCORD_HERO_DATASET_NAMES,
  type DiscordHeroCatalogIndexes,
  type DiscordHeroDatasetName,
} from "../catalog/indexes";

export const DISCORD_HERO_CODEX_DATASETS_PER_PAGE = 25;
export const DISCORD_HERO_CODEX_PREVIEW_LENGTH = 2_400;

export interface DiscordHeroCodexLocation {
  readonly datasetPage: number;
  readonly datasetName: DiscordHeroDatasetName | null;
  readonly rowIndex: number;
}

export interface DiscordHeroCodexRecord {
  readonly location: DiscordHeroCodexLocation;
  readonly rowCount: number;
  readonly rawJson: string;
  readonly preview: string;
  readonly previewTruncated: boolean;
  readonly exportFilename: string;
}

export function discordHeroCodexDatasetPageCount(): number {
  return Math.ceil(
    DISCORD_HERO_DATASET_NAMES.length /
      DISCORD_HERO_CODEX_DATASETS_PER_PAGE,
  );
}

export function discordHeroCodexDatasets(
  datasetPage: number,
): readonly DiscordHeroDatasetName[] {
  if (
    !Number.isSafeInteger(datasetPage) ||
    datasetPage < 0 ||
    datasetPage >= discordHeroCodexDatasetPageCount()
  ) {
    throw new Error("DiscordHero Codex dataset page is out of range");
  }
  const start = datasetPage * DISCORD_HERO_CODEX_DATASETS_PER_PAGE;
  return DISCORD_HERO_DATASET_NAMES.slice(
    start,
    start + DISCORD_HERO_CODEX_DATASETS_PER_PAGE,
  );
}

export function isDiscordHeroDatasetName(
  value: string,
): value is DiscordHeroDatasetName {
  return (DISCORD_HERO_DATASET_NAMES as readonly string[]).includes(value);
}

export function readDiscordHeroCodexRecord(
  indexes: DiscordHeroCatalogIndexes,
  datasetName: DiscordHeroDatasetName,
  rowIndex: number,
): DiscordHeroCodexRecord {
  const rows = indexes.tables[datasetName].rows;
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= rows.length
  ) {
    throw new Error(
      `DiscordHero Codex row ${rowIndex} is out of range for ${datasetName}`,
    );
  }
  const rawJson = JSON.stringify(rows[rowIndex]);
  const prettyJson = JSON.stringify(rows[rowIndex], null, 2);
  const previewTruncated =
    prettyJson.length > DISCORD_HERO_CODEX_PREVIEW_LENGTH;
  const preview = previewTruncated
    ? `${prettyJson.slice(0, DISCORD_HERO_CODEX_PREVIEW_LENGTH)}\n…`
    : prettyJson;
  const datasetPage = Math.floor(
    DISCORD_HERO_DATASET_NAMES.indexOf(datasetName) /
      DISCORD_HERO_CODEX_DATASETS_PER_PAGE,
  );
  return {
    location: { datasetPage, datasetName, rowIndex },
    rowCount: rows.length,
    rawJson,
    preview,
    previewTruncated,
    exportFilename: `discordhero-${datasetName}-${rowIndex + 1}.json`,
  };
}

export function encodeDiscordHeroCodexDatasetPage(datasetPage: number): string {
  discordHeroCodexDatasets(datasetPage);
  return `d-${datasetPage.toString(36)}`;
}

export function decodeDiscordHeroCodexDatasetPage(value: string): number {
  const match = /^d-([0-9a-z]+)$/.exec(value);
  if (match === null) {
    throw new Error("DiscordHero Codex dataset page target is malformed");
  }
  const datasetPage = Number.parseInt(match[1]!, 36);
  if (datasetPage.toString(36) !== match[1]) {
    throw new Error("DiscordHero Codex dataset page target is non-canonical");
  }
  discordHeroCodexDatasets(datasetPage);
  return datasetPage;
}

export function encodeDiscordHeroCodexRecordTarget(
  datasetName: DiscordHeroDatasetName,
  rowIndex: number,
): string {
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    !isDiscordHeroDatasetName(datasetName)
  ) {
    throw new Error("DiscordHero Codex record target is invalid");
  }
  return `r-${datasetName}-${rowIndex.toString(36)}`;
}

export function encodeDiscordHeroCodexRowPage(
  direction: "previous" | "next",
  datasetName: DiscordHeroDatasetName,
  rowIndex: number,
): string {
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    !isDiscordHeroDatasetName(datasetName)
  ) {
    throw new Error("DiscordHero Codex row page target is invalid");
  }
  return `${direction === "previous" ? "p" : "n"}-${datasetName}-${rowIndex.toString(36)}`;
}

export function decodeDiscordHeroCodexRowPage(value: string): {
  readonly direction: "previous" | "next";
  readonly datasetName: DiscordHeroDatasetName;
  readonly rowIndex: number;
} {
  const match = /^([pn])-([a-z_]+)-([0-9a-z]+)$/.exec(value);
  if (match === null || !isDiscordHeroDatasetName(match[2]!)) {
    throw new Error("DiscordHero Codex row page target is malformed");
  }
  const rowIndex = Number.parseInt(match[3]!, 36);
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex.toString(36) !== match[3]
  ) {
    throw new Error("DiscordHero Codex row page target is non-canonical");
  }
  return {
    direction: match[1] === "p" ? "previous" : "next",
    datasetName: match[2],
    rowIndex,
  };
}

export function decodeDiscordHeroCodexRecordTarget(value: string): {
  readonly datasetName: DiscordHeroDatasetName;
  readonly rowIndex: number;
} {
  const match = /^r-([a-z_]+)-([0-9a-z]+)$/.exec(value);
  if (match === null || !isDiscordHeroDatasetName(match[1]!)) {
    throw new Error("DiscordHero Codex record target is malformed");
  }
  const rowIndex = Number.parseInt(match[2]!, 36);
  if (
    !Number.isSafeInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex.toString(36) !== match[2]
  ) {
    throw new Error("DiscordHero Codex record target is non-canonical");
  }
  return { datasetName: match[1], rowIndex };
}
