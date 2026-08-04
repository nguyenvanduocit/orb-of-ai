import { resolve } from "node:path";
import {
  checkDiscordHeroCommunityAchievements,
  writeDiscordHeroCommunityAchievements,
} from "../src/discord-hero/community-achievements/compiler";

const projectRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(
  projectRoot,
  "assets/discordhero/community-achievements.json",
);

async function generate(): Promise<void> {
  const { catalog, changed } = await writeDiscordHeroCommunityAchievements(
    projectRoot,
    outputPath,
  );
  console.log(
    [
      changed ? "wrote" : "unchanged",
      outputPath,
      `${catalog.achievements.length} achievements`,
      catalog.provenance.compiled_sha256,
    ].join(" | "),
  );
}

async function check(): Promise<void> {
  await checkDiscordHeroCommunityAchievements(projectRoot, outputPath);
  console.log(`checked | ${outputPath}`);
}

export async function runDiscordHeroAchievementsCommand(
  args: string[],
): Promise<void> {
  const mode = args[0] ?? "--generate";
  if (args.length > 1) {
    throw new Error(
      `Unexpected DiscordHero achievements arguments: ${args.slice(1).join(" ")}`,
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
  throw new Error(`Unknown DiscordHero achievements mode: ${mode}`);
}

if (import.meta.main) {
  await runDiscordHeroAchievementsCommand(process.argv.slice(2));
}
