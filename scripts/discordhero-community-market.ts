import { resolve } from "node:path";
import {
  checkDiscordHeroCommunityMarket,
  writeDiscordHeroCommunityMarket,
} from "../src/discord-hero/community-market/compiler";

const projectRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(
  projectRoot,
  "assets/discordhero/community-market.json",
);

async function generate(): Promise<void> {
  const { market, changed } = await writeDiscordHeroCommunityMarket(
    projectRoot,
    outputPath,
  );
  console.log(
    [
      changed ? "wrote" : "unchanged",
      outputPath,
      `${market.pages.length} market pages`,
      `${market.landing.declaredTotal} landing records`,
      market.provenance.compiledSha256,
    ].join(" | "),
  );
}

async function check(): Promise<void> {
  await checkDiscordHeroCommunityMarket(projectRoot, outputPath);
  console.log(`checked | ${outputPath}`);
}

export async function runDiscordHeroCommunityMarketCommand(
  args: string[],
): Promise<void> {
  const mode = args[0] ?? "--generate";
  if (args.length > 1) {
    throw new Error(
      `Unexpected DiscordHero community market arguments: ${args.slice(1).join(" ")}`,
    );
  }
  if (mode === "--generate") {
    await generate();
    return;
  }
  if (mode === "--check") {
    await check();
    return;
  }
  throw new Error(`Unknown DiscordHero community market mode: ${mode}`);
}

if (import.meta.main) {
  await runDiscordHeroCommunityMarketCommand(process.argv.slice(2));
}
