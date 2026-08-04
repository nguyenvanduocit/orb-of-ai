import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { gemGroups, salvageGemDuplicates } from "./commands/rpg";
import { GEM_BAG_LIMIT, GEM_SALVAGE_SHARDS, newProfile } from "./rpg";
import { loadCharacters, saveCharacters } from "./rpg-store";
import { guildDir } from "./store";
import { SUPPORT_GEMS, newSupportGem, type SupportGemInstance } from "./rpg-skills";

// The bug this guards: the gem select listed one option per INSTANCE and sliced to Discord's
// 25-option cap, while the bag holds up to GEM_BAG_LIMIT (40). Unsocket pushes the gem to the
// END of the bag, so a player with a full bag saw the gem they had just removed drop off the
// list forever — reported, correctly, as "tháo gem ra là mất". A prod hero had 40 supports
// with `tanbao`/`themset` sitting in the hidden tail: two gem types they could never socket.
// `rare` is the type held back so a test can plant its single copy in the hidden tail.
const RARE = "tanbao";
function fullBag(): SupportGemInstance[] {
  // Mirror the real shape: lots of duplicates of a few types, nothing sorted.
  const common = SUPPORT_GEMS.filter((g) => g.id !== RARE);
  return Array.from({ length: GEM_BAG_LIMIT }, (_, i) => newSupportGem(common[i % common.length]!.id));
}

describe("gemGroups", () => {
  test("a full bag still fits Discord's 25-option cap — one option per type, not per instance", () => {
    const bag = fullBag();
    const groups = gemGroups(bag, bag);

    expect(bag.length).toBe(GEM_BAG_LIMIT);
    expect(groups.length).toBeLessThanOrEqual(25);
    expect(groups.length).toBe(new Set(bag.map((g) => g.defId)).size);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(bag.length);
  });

  test("every owned type is reachable — including one sitting past the 25th slot", () => {
    const bag = fullBag();
    // The exact prod shape: a type whose ONLY copy lives in the hidden tail.
    const rare = newSupportGem(RARE);
    bag.splice(0, 1); // keep the bag at the cap
    bag.push(rare);
    expect(bag.slice(0, 25).some((g) => g.defId === RARE)).toBe(false); // invisible pre-fix

    const groups = gemGroups(bag, bag);
    const found = groups.find((g) => g.inst.defId === RARE);
    expect(found).toBeDefined();
    expect(bag[found!.bagIndex]).toBe(rare);
  });

  test("a gem returned to the end of a full bag is offered again (the unsocket path)", () => {
    const bag = fullBag();
    const unsocketed = newSupportGem("themlua");
    unsocketed.level = 7; // levelled by the run it was linked for
    bag.push(unsocketed); // exactly what unsocketSupport does

    const group = gemGroups(bag, bag).find((g) => g.inst.defId === "themlua");
    // Best copy wins, which is the one just taken out of the socket.
    expect(group?.inst).toBe(unsocketed);
    expect(bag[group!.bagIndex]).toBe(unsocketed);
  });

  test("offers the highest level, breaking ties on xp", () => {
    const low = newSupportGem("chimang");
    const high = newSupportGem("chimang");
    high.level = 5;
    const tie = newSupportGem("chimang");
    tie.level = 5;
    tie.xp = 99;
    const bag = [low, high, tie];

    expect(gemGroups(bag, bag)[0]!.inst).toBe(tie);
    expect(gemGroups(bag, [low, high])[0]!.inst).toBe(high);
  });

  test("bagIndex points into the WHOLE bag, not the filtered list", () => {
    const skillLike = newSupportGem("themlua"); // stands in for a leading skill gem
    const target = newSupportGem("docto");
    const bag = [skillLike, target];

    // Filtered list omits the first entry — the index must still address the full bag.
    expect(gemGroups(bag, [target])[0]!.bagIndex).toBe(1);
  });
});

// Salvaging duplicates is the only way to free gem-bag space, so it moves the real ledger:
// gems leave the bag and 🔩 appear. What must never happen is losing a gem type entirely,
// or touching gems that are socketed.
describe("salvageGemDuplicates", () => {
  const guildId = "test-gem-salvage";
  const userId = "gem-salvage-user";

  function seed(gemBag: SupportGemInstance[], supports: SupportGemInstance[] = []) {
    const profile = newProfile("chien", 0, () => 0.5);
    profile.gemBag = gemBag;
    profile.supports = supports;
    profile.materials.manh = 0;
    saveCharacters({ [userId]: profile });
  }

  // The guild folder is where the telemetry journal lands; without it every salvage logs a
  // dropped write (harmless by design, but it buries the test output).
  beforeEach(() => {
    mkdirSync(guildDir(guildId), { recursive: true });
    saveCharacters({});
  });
  afterAll(() => rmSync(guildDir(guildId), { recursive: true, force: true }));

  test("keeps the best copy, pays GEM_SALVAGE_SHARDS per gem traded", () => {
    const weak = newSupportGem("themlua");
    const mid = newSupportGem("themlua");
    mid.level = 4;
    const best = newSupportGem("themlua");
    best.level = 9;
    const other = newSupportGem("docto");
    seed([weak, mid, best, other]);

    const r = salvageGemDuplicates(guildId, userId, "themlua");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.count).toBe(2);
    expect(r.manh).toBe(2 * GEM_SALVAGE_SHARDS);

    const bag = loadCharacters()[userId]!.gemBag;
    expect(bag.filter((g) => g.defId === "themlua").map((g) => g.level)).toEqual([9]);
    expect(bag.filter((g) => g.defId === "docto").length).toBe(1); // other types untouched
    expect(loadCharacters()[userId]!.materials.manh).toBe(2 * GEM_SALVAGE_SHARDS);
  });

  test("refuses the last copy of a type — a gem type can never be clicked away", () => {
    const only = newSupportGem("tanbao");
    seed([only, newSupportGem("docto")]);

    const r = salvageGemDuplicates(guildId, userId, "tanbao");
    expect(r.ok).toBe(false);
    expect(loadCharacters()[userId]!.gemBag.length).toBe(2);
    expect(loadCharacters()[userId]!.materials.manh).toBe(0);
  });

  test("ignores socketed gems — only the bag is salvageable", () => {
    const linked = newSupportGem("themlua");
    const inBag = newSupportGem("themlua");
    seed([inBag], [linked]);

    // One in the bag + one socketed is NOT a duplicate pair: the socketed one is in use.
    const r = salvageGemDuplicates(guildId, userId, "themlua");
    expect(r.ok).toBe(false);
    const after = loadCharacters()[userId]!;
    expect(after.gemBag.length).toBe(1);
    expect(after.supports.length).toBe(1);
  });

  test("a full bag can always be brought back under the cap", () => {
    seed(fullBag());
    let freed = 0;
    for (const g of gemGroups(loadCharacters()[userId]!.gemBag, loadCharacters()[userId]!.gemBag)) {
      if (g.count < 2) continue;
      const r = salvageGemDuplicates(guildId, userId, g.inst.defId);
      if (r.ok) freed += r.count;
    }
    const bag = loadCharacters()[userId]!.gemBag;
    expect(freed).toBe(GEM_BAG_LIMIT - bag.length);
    expect(bag.length).toBeLessThan(GEM_BAG_LIMIT);
    expect(new Set(bag.map((g) => g.defId)).size).toBe(bag.length); // one of each type left
  });
});
