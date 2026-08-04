import { resolve } from "node:path";
import {
  checkDiscordHeroCommunityContent,
  writeDiscordHeroCommunityContent,
} from "../src/discord-hero/community-content/compiler";

const projectRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(
  projectRoot,
  "assets/discordhero/community-content.json",
);

async function generate(): Promise<void> {
  const { content, changed } = await writeDiscordHeroCommunityContent(
    projectRoot,
    outputPath,
  );
  console.log(
    [
      changed ? "wrote" : "unchanged",
      outputPath,
      `${content.documents.length} community snapshots`,
      `${content.reconciliation.resolvedLandingLinks} resolved landing links`,
      `${content.reconciliation.unlistedDetails} unlisted details`,
      content.provenance.compiledSha256,
    ].join(" | "),
  );
}

async function check(): Promise<void> {
  await checkDiscordHeroCommunityContent(projectRoot, outputPath);
  console.log(`checked | ${outputPath}`);
}

export async function runDiscordHeroCommunityContentCommand(
  args: string[],
): Promise<void> {
  const mode = args[0] ?? "--generate";
  if (args.length > 1) {
    throw new Error(
      `Unexpected DiscordHero community content arguments: ${args.slice(1).join(" ")}`,
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
  throw new Error(`Unknown DiscordHero community content mode: ${mode}`);
}

if (import.meta.main) {
  await runDiscordHeroCommunityContentCommand(process.argv.slice(2));
}
