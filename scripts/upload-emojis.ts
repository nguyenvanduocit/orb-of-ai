// Upload the generated card PNGs (assets/cards/) as Discord APPLICATION emojis —
// one-time (run again with --force to replace after re-arting the cards):
//
//   bun run emojis:gen      # produce the PNGs first
//   bun run emojis:upload   # push them to the app (idempotent: skips existing)
//   bun run emojis:upload --force   # delete + re-upload existing ones
//
// Application emojis (cap 2000) work in every server the bot is in with no
// per-guild upload, referenced in text as <:bj_as:id>. Runtime picks them up by
// name in src/cards.ts (initCardEmojis) — no ids are hard-coded anywhere.
//
// Reads DISCORD_BOT_TOKEN + DISCORD_APPLICATION_ID straight from the env (via
// `bun --env-file=.env`), decoupled from the app's other required config.

import { REST } from "discord.js";
import { existsSync, readFileSync } from "node:fs";
import { BACK_FILE, BACK_NAME, DECK, assetFile, emojiName } from "../src/cards";

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
if (!token || !appId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in env.");
  process.exit(1);
}

const force = process.argv.includes("--force");

// name → asset filename, for all 53.
const assets = [
  ...DECK.map((c) => ({ name: emojiName(c.rank, c.suit), file: assetFile(c.rank, c.suit) })),
  { name: BACK_NAME, file: BACK_FILE },
];

const rest = new REST({ version: "10" }).setToken(token);
const route = `/applications/${appId}/emojis` as `/${string}`;

// Discord returns { items: [{ id, name }, ...] } for the app's emoji list.
const list = (await rest.get(route)) as { items: { id: string; name: string }[] };
const existing = new Map(list.items.map((e) => [e.name, e.id]));

let uploaded = 0;
let skipped = 0;
for (const { name, file } of assets) {
  const path = `assets/cards/${file}`;
  if (!existsSync(path)) {
    console.error(`⚠️  missing ${path} — run \`bun run emojis:gen\` first.`);
    process.exit(1);
  }
  const have = existing.get(name);
  if (have && !force) {
    skipped++;
    continue;
  }
  if (have) await rest.delete(`${route}/${have}`); // --force: replace
  const image = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  await rest.post(route, { body: { name, image } });
  uploaded++;
  console.log(`  ✓ ${name}`);
}
console.log(`✅ Done — ${uploaded} uploaded, ${skipped} already present (use --force to replace).`);
