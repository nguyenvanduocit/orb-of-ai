// Generate the RPG item art (one PNG per gear base + per unique) into assets/items/,
// served at runtime by the /rpg web page (src/server.ts → /rpg/asset/item/<key>.png,
// rendered by src/rpg-web.ts). Keys come straight from the catalog (GEAR_BASES id and
// unique-<UNIQUES id>) so they never drift; the per-item prompt fragments live below.
//
//   bun run items:gen            # fill in any missing PNGs (idempotent, skips existing)
//   bun run items:gen --force    # regenerate everything
//
// LOCAL AUTHORING TOOL — not run in prod. It shells out to the /grok-image skill
// (xAI OAuth via ~/.claude/skills/grok-image/generate.py); /codex-image is the
// alternative when the Tailnet endpoint is up. The committed PNGs are what ship; a
// card falls back to its slot emoji when a PNG is missing, so partial art is fine.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GEAR_BASES, UNIQUES } from "../src/rpg";

const OUT = join(import.meta.dir, "..", "assets", "items");
const GEN = join(homedir(), ".claude", "skills", "grok-image", "generate.py");
const force = process.argv.includes("--force");
const DELAY_MS = 2500; // be gentle on the personal-OAuth image API (skill's own caveat)

const STYLE =
  "Single centered object, painterly fantasy game-icon style, dramatic rim lighting, plain near-black neutral background slightly vignetted, no text, no border, square.";

// Gear bases — clean, generic silhouettes (rarity/mods are shown by the card border + text,
// not the art, so one image per base is shared across all rarities of that base).
const BASE_PROMPT: Record<string, string> = {
  kiem: "a plain steel arming sword with a simple crossguard",
  truong: "a wooden wizard's staff topped with a small glowing blue crystal",
  cungten: "a simple curved wooden shortbow with a taut string",
  riu: "a heavy iron battle axe with a broad single blade",
  quyentruong: "a flame sceptre — a dark metal rod topped with a burning orange fire-orb",
  nonda: "a simple brown leather cap",
  nonsat: "a polished iron helmet with a nose guard",
  monao: "a deep-blue hooded mage cowl with arcane silver trim",
  giapda: "a set of brown leather body armour, chest piece",
  giaptam: "a heavy polished steel plate cuirass",
  aophep: "a flowing blue arcane mage robe with glowing runes",
  gangda: "a pair of brown leather gloves",
  gangsat: "a pair of heavy iron gauntlets",
  giayda: "a pair of brown leather boots",
  giaysat: "a pair of iron greaves, armored boots",
  giayphep: "a pair of light arcane slippers with a soft blue glow",
  nhanlua: "a gold ring set with a glowing red ruby, faint fire glow",
  nhanbang: "a silver ring set with a glowing blue sapphire, faint frost glow",
  nhanset: "a gold ring set with a glowing yellow topaz, faint crackle of lightning",
  nhanchimang: "a dark silver assassin's ring with a small black gem and a subtle menacing glow",
};

// Uniques — bespoke, dramatic art from each item's flavour.
const UNIQUE_PROMPT: Record<string, string> = {
  starforge:
    "a legendary greatsword named Starforge forged from the core of a dead star, molten-gold and cosmic-purple energy along the blade, tiny supernova sparks, ornate metal hilt",
  voidbringer:
    "a sinister sorcerer's staff named Void Bringer that drains all light, wreathed in swirling black-and-violet chaos energy, a dark crystal orb at its tip",
  windripper:
    "an elegant recurve bow named Windripper crackling with white-blue lightning, gilded limbs, a faint motion-blur of impossible speed",
  abyssusveil:
    "a menacing spiked iron war-helm named Abyssus, cursed dark metal with glowing red eye-slits and an aura of danger",
  crownofeyes:
    "an eldritch mage hood named Crown of Eyes covered in many small glowing watchful eyes, shimmering with a violet energy-shield glow",
  kaomsheart:
    "a massive crimson barbarian chestplate named Kaom's Heart built around a glowing molten-red heart, brutal solid plate with no side gaps, radiating life-fire",
  cloakofdefiance:
    "a flowing arcane cloak named Cloak of Defiance shimmering with a translucent blue energy shield and glowing runes along the hem",
  facebreaker:
    "a pair of brutal spiked knuckle gauntlets named Facebreaker of raw iron and leather, cracks of raw physical force radiating from the fists",
  seventeaguestep:
    "a pair of swift enchanted leather boots named Seven-League Step trailing wisps of green wind and speed-energy, light and agile",
  calloftheempire:
    "an ornate dark assassin's ring named Call of the Void, a black gemstone swirling with elemental fire, ice and lightning plus violet chaos energy, thin silver band",
};

interface Job {
  key: string;
  prompt: string;
}
const jobs: Job[] = [];
for (const [id, base] of Object.entries(GEAR_BASES)) {
  jobs.push({ key: id, prompt: BASE_PROMPT[id] ?? `a ${base.name.toLowerCase()}` });
}
for (const u of UNIQUES) {
  jobs.push({ key: `unique-${u.id}`, prompt: UNIQUE_PROMPT[u.id] ?? `${u.name} — ${u.flavor}` });
}

let made = 0;
let skipped = 0;
let failed = 0;
for (const job of jobs) {
  const out = join(OUT, `${job.key}.png`);
  if (!force && existsSync(out)) {
    skipped++;
    continue;
  }
  const prompt = `Dark-fantasy RPG inventory item icon: ${job.prompt}. ${STYLE}`;
  process.stdout.write(`🎨 ${job.key} … `);
  const p = Bun.spawnSync(["python3", GEN, prompt, "-o", out]);
  if (p.exitCode === 0 && existsSync(out)) {
    made++;
    console.log("ok");
  } else {
    failed++;
    console.log("FAIL");
    console.error(p.stderr.toString().split("\n").slice(-3).join("\n"));
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nDone: ${made} generated, ${skipped} skipped, ${failed} failed (of ${jobs.length}).`);
if (failed > 0) process.exit(1);
