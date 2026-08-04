import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Discord rejects the WHOLE message with COMPONENT_INVALID_EMOJI (400) when a button or
// select option carries an `emoji` that isn't a real Unicode emoji — so one bad glyph in a
// catalog silently bricks every panel that renders it, and only once the item drops.
// (That is exactly how Pierce's "➹" — a dingbat arrow, U+27B9 — killed the /rpg Skill Gem
// panel for anyone holding the gem.) The invariant guarded here: every emoji literal in the
// source is RGI ("recommended for general interchange"), which is the set Discord accepts.
//
// Scanning the source rather than importing each catalog is deliberate: a new catalog, or a
// hardcoded setEmoji() on a new button, is covered with no edit here.
const RGI = /^\p{RGI_Emoji}$/v;

// `setEmoji("X")` (buttons/select options) and `emoji: "X"` (catalog entries).
const PATTERNS = [/setEmoji\(\s*"([^"]*)"\s*\)/g, /\bemoji:\s*"([^"]*)"/g];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    // Test files are skipped: nothing they build reaches Discord, and a test is free to
    // use a deliberately bogus glyph as a fixture (this file's own examples included).
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("emoji literals", () => {
  test("every emoji Discord could receive is a real Unicode emoji", () => {
    const bad: string[] = [];
    for (const file of tsFiles("src")) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const pattern of PATTERNS) {
            pattern.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = pattern.exec(line))) {
              const emoji = m[1]!;
              if (emoji.startsWith("<")) continue; // custom application emoji (`<:bj_as:123>`)
              if (RGI.test(emoji)) continue;
              const cps = [...emoji].map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(" ");
              bad.push(`${file}:${i + 1} ${JSON.stringify(emoji)} (${cps})`);
            }
          }
        });
    }
    expect(bad).toEqual([]);
  });
});
