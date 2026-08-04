import { join } from "node:path";
import {
  createDiscordHeroEncryptedSaveSnapshot,
  DiscordHeroEncryptedSaveSnapshotError,
  redactDiscordHeroEncryptedSaveSnapshotError,
  type EncryptedSaveSnapshotResult,
} from "../src/discord-hero/oracles/encrypted-save-snapshot";

interface EncryptedSaveSnapshotArguments {
  readonly label: string;
  readonly outputDirectory: string;
  readonly sourcePath?: string;
}

const OPTION_NAMES = ["--label", "--output", "--source"] as const;

function parseArguments(
  args: readonly string[],
): EncryptedSaveSnapshotArguments {
  const values = new Map<string, string>();
  if (args.length % 2 !== 0) {
    throw new DiscordHeroEncryptedSaveSnapshotError("invalid_arguments");
  }
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      option === undefined ||
      !OPTION_NAMES.includes(option as (typeof OPTION_NAMES)[number]) ||
      value === undefined ||
      value.length === 0 ||
      value.startsWith("--") ||
      values.has(option)
    ) {
      throw new DiscordHeroEncryptedSaveSnapshotError("invalid_arguments");
    }
    values.set(option, value);
  }

  const label = values.get("--label");
  const outputDirectory = values.get("--output");
  if (
    label === undefined ||
    outputDirectory === undefined ||
    values.size < 2 ||
    values.size > 3
  ) {
    throw new DiscordHeroEncryptedSaveSnapshotError("invalid_arguments");
  }
  return {
    label,
    outputDirectory,
    sourcePath: values.get("--source"),
  };
}

export async function runDiscordHeroEncryptedSaveSnapshotCommand(
  args: readonly string[],
): Promise<EncryptedSaveSnapshotResult> {
  const parsed = parseArguments(args);
  return createDiscordHeroEncryptedSaveSnapshot({
    label: parsed.label,
    outputDirectory: parsed.outputDirectory,
    sourcePath: parsed.sourcePath,
    projectRoot: join(import.meta.dir, ".."),
    platform: process.platform,
    environment: process.env,
  });
}

if (import.meta.main) {
  try {
    const result = await runDiscordHeroEncryptedSaveSnapshotCommand(
      process.argv.slice(2),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(redactDiscordHeroEncryptedSaveSnapshotError(error))}\n`,
    );
    process.exitCode = 1;
  }
}
