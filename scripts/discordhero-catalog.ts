import { resolve } from "node:path";
import {
  checkDiscordHeroCatalog,
  writeDiscordHeroCatalog,
} from "../src/discord-hero/catalog/compiler";
import { refreshDiscordHeroRawSource } from "../src/discord-hero/catalog/source-refresh";

const projectRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(projectRoot, "assets/discordhero/catalog.json");

async function generate(): Promise<void> {
  const { catalog, changed } = await writeDiscordHeroCatalog(projectRoot, outputPath);
  console.log(
    [
      changed ? "wrote" : "unchanged",
      outputPath,
      `${catalog.totals.datasets} datasets`,
      `${catalog.totals.rows} rows`,
      catalog.provenance.compiledSha256,
    ].join(" | "),
  );
}

async function check(): Promise<void> {
  await checkDiscordHeroCatalog(projectRoot, outputPath);
  console.log(`checked | ${outputPath}`);
}

async function refresh(): Promise<void> {
  const result = await refreshDiscordHeroRawSource(projectRoot);
  console.log(
    `refreshed | source lock ${result.sourceLockSha256} | monster details ${result.monsterDetailsSha256}`,
  );
  await generate();
}

export async function runDiscordHeroCatalogCommand(args: string[]): Promise<void> {
  const mode = args[0] ?? "--generate";
  if (args.length > 1) {
    throw new Error(`Unexpected DiscordHero catalog arguments: ${args.slice(1).join(" ")}`);
  }
  if (mode === "--generate") {
    await generate();
    return;
  }
  if (mode === "--check") {
    await check();
    return;
  }
  if (mode === "--refresh") {
    await refresh();
    return;
  }
  throw new Error(`Unknown DiscordHero catalog mode: ${mode}`);
}

if (import.meta.main) {
  await runDiscordHeroCatalogCommand(process.argv.slice(2));
}
