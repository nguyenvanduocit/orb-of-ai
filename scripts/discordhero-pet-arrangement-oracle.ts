import { readFile } from "node:fs/promises";
import {
  DiscordHeroPetArrangementCaptureError,
  evaluatePetArrangementCapture,
  redactPetArrangementCaptureError,
  type PetArrangementCaptureReport,
} from "../src/discord-hero/oracles/pet-arrangement-capture";

interface PetArrangementCaptureArguments {
  readonly beforePath: string;
  readonly afterPath: string;
  readonly fromPetKey: number;
  readonly toPetKey: number;
  readonly capturedAt: string;
}

const OPTION_NAMES = [
  "--before",
  "--after",
  "--from",
  "--to",
  "--captured-at",
] as const;

function positiveCanonicalInteger(value: string | undefined): number {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_arguments");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_arguments");
  }
  return parsed;
}

function parseArguments(
  args: readonly string[],
): PetArrangementCaptureArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      option === undefined ||
      !OPTION_NAMES.includes(option as (typeof OPTION_NAMES)[number]) ||
      value === undefined ||
      value.startsWith("--") ||
      values.has(option)
    ) {
      throw new DiscordHeroPetArrangementCaptureError("invalid_arguments");
    }
    values.set(option, value);
  }
  if (
    args.length !== OPTION_NAMES.length * 2 ||
    values.size !== OPTION_NAMES.length
  ) {
    throw new DiscordHeroPetArrangementCaptureError("invalid_arguments");
  }
  return {
    beforePath: values.get("--before")!,
    afterPath: values.get("--after")!,
    fromPetKey: positiveCanonicalInteger(values.get("--from")),
    toPetKey: positiveCanonicalInteger(values.get("--to")),
    capturedAt: values.get("--captured-at")!,
  };
}

export async function runDiscordHeroPetArrangementCaptureCommand(
  args: readonly string[],
): Promise<PetArrangementCaptureReport> {
  const parsed = parseArguments(args);
  const [beforeEncrypted, afterEncrypted] = await Promise.all([
    readFile(parsed.beforePath),
    readFile(parsed.afterPath),
  ]);
  return evaluatePetArrangementCapture({
    beforeEncrypted,
    afterEncrypted,
    fromPetKey: parsed.fromPetKey,
    toPetKey: parsed.toPetKey,
    capturedAt: parsed.capturedAt,
  });
}

if (import.meta.main) {
  try {
    const report = await runDiscordHeroPetArrangementCaptureCommand(
      process.argv.slice(2),
    );
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(redactPetArrangementCaptureError(error))}\n`,
    );
    process.exitCode = 1;
  }
}
