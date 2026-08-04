// Wiki integrity — the wiki's whole value proposition is that a number a player reads is the
// number the engine rolls. These tests guard that link, and the formatter that carries it.
//
// The formatter test is not hypothetical: the first version of pct() trimmed trailing zeros
// with /0+$/, which silently rendered 100% as "1%", 90% as "9%" and 20% as "2%" — every round
// rate on the page was a tenth of the truth, and it looked completely plausible.

import { describe, expect, test } from "bun:test";
import { wikiDoc, wikiMarkdown, wikiSkillFiles, type WikiSection } from "./wiki";
import { inline, renderWikiPage } from "./wiki-web";
import { commandCatalog } from "./commands/index";
import { ENHANCE_TABLE, RARITIES, UNIQUES, MOD_POOL, STAGES } from "./rpg";
import { AURAS } from "./rpg-auras";
import { SKILL_GEMS, SUPPORT_GEMS } from "./rpg-skills";

const flatten = (s: WikiSection): WikiSection[] => [s, ...(s.subs ?? []).flatMap(flatten)];
const allSections = () => wikiDoc().flatMap(flatten);

describe("wiki numbers match the engine", () => {
  const md = wikiMarkdown();

  test("every enhancement rate is rendered at full magnitude", () => {
    // The regression that motivated this file: 1 → "100%", 0.9 → "90%", 0.2 → "20%".
    for (const [plus, odds] of Object.entries(ENHANCE_TABLE)) {
      const rendered = `${Math.round(odds.up * 100)}%`;
      expect(md).toContain(`| +${plus} → +${Number(plus) + 1} | ${rendered} |`);
    }
  });

  test("percentages never lose a significant zero", () => {
    // A "1%" success rate anywhere in the enhancement table would mean the trim came back.
    const enhanceBlock = md.slice(md.indexOf("| +0 → +1"), md.indexOf("| +11 → +12") + 60);
    expect(enhanceBlock).toContain("100%");
    expect(enhanceBlock).not.toContain("| 1% |");
    expect(enhanceBlock).not.toContain("| 9% |");
    // A full damage split must read as 100%, not 1%.
    expect(md).toContain("Physical 100%");
  });

  test("no rendering artifact leaks into the page", () => {
    for (const bad of ["undefined", "NaN", "[object Object]", "Infinity"]) {
      expect(md).not.toContain(bad);
    }
  });

  test("the HTML renderer promotes every markdown mark the model writes", () => {
    // The model authors prose in markdown; the renderer must understand every mark it uses.
    // It once handled **bold** and `code` but not *italics*, so the page printed
    // "game nhập vai *nhàn tay*" with the asterisks showing, in six places.
    // Asserted per prose string rather than over the whole document, because the page's CSS
    // and its search index legitimately contain asterisks and backticks.
    for (const s of allSections()) {
      const prose = [
        s.blurb,
        ...s.blocks.flatMap((b) =>
          b.kind === "p" || b.kind === "note" ? [b.text] : b.kind === "list" ? b.items : [...b.headers, ...b.rows.flat()],
        ),
      ];
      for (const text of prose) {
        const html = inline(text);
        expect(html).not.toContain("*");
        expect(html).not.toContain("`");
      }
    }
  });

  test("the rendered page is well-formed and self-contained", () => {
    const html = renderWikiPage();
    // Exactly one stylesheet request (the fonts) — everything else is inline, so the page
    // works behind a strict CSP and never blocks on a CDN.
    expect(html.match(/<link[^>]+stylesheet/g)?.length).toBe(1);
    // Asserted on the font REQUEST, not the document: the stylesheet comment names the
    // rejected face on purpose, so a document-wide search would match the explanation.
    const fontUrl = html.match(/<link href="(https:\/\/fonts\.googleapis[^"]+)"/)?.[1] ?? "";
    expect(fontUrl).toContain("Playfair+Display"); // carries the vietnamese subset
    expect(fontUrl).not.toContain("Cinzel"); // latin + latin-ext only — breaks every diacritic
    expect(html.split("<section").length).toBe(html.split("</section>").length);
  });
});

describe("wiki covers the live catalogs", () => {
  const md = wikiMarkdown();

  test("every registered command is listed", () => {
    // This is the anti-drift guarantee: a new command shows up without touching the wiki.
    // Asserted against the DOCUMENT rather than the markdown, because a table cell escapes
    // the pipes in a usage like "/diemdanh checkin|bxh|stats".
    const cells = allSections()
      .flatMap((s) => s.blocks)
      .flatMap((b) => (b.kind === "table" ? b.rows.flat() : []));
    for (const { usage } of commandCatalog()) expect(cells).toContain(`\`${usage}\``);
  });

  test("every unique, aura, gem, region, affix and rarity is documented", () => {
    for (const u of UNIQUES) expect(md).toContain(u.name);
    for (const a of AURAS) expect(md).toContain(a.name);
    for (const g of [...SKILL_GEMS, ...SUPPORT_GEMS]) expect(md).toContain(g.name);
    for (const s of STAGES) expect(md).toContain(s.name);
    for (const m of MOD_POOL) expect(md).toContain(m.name);
    for (const r of RARITIES) expect(md).toContain(r.name);
  });
});

describe("wiki document shape", () => {
  test("section ids are unique — they are anchors and reference filenames", () => {
    const ids = allSections().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every section carries a blurb and at least one block", () => {
    for (const s of allSections()) {
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.blocks.length).toBeGreaterThan(0);
    }
  });

  test("every table row matches its header width", () => {
    for (const s of allSections()) {
      for (const b of s.blocks) {
        if (b.kind !== "table") continue;
        for (const row of b.rows) expect(row.length).toBe(b.headers.length);
      }
    }
  });
});

describe("generated agent skill", () => {
  const files = wikiSkillFiles();

  test("ships a SKILL.md plus one reference file per top-level section", () => {
    expect(files["SKILL.md"]).toBeDefined();
    for (const s of wikiDoc()) expect(files[`reference/${s.id}.md`]).toBeDefined();
  });

  test("SKILL.md stays small — it is always in context, the references are on demand", () => {
    // Progressive disclosure: the deep content must live behind the index, not in front of it.
    expect(files["SKILL.md"]!.length).toBeLessThan(8_000);
  });

  test("SKILL.md indexes every reference file it ships", () => {
    for (const path of Object.keys(files)) {
      if (path !== "SKILL.md") expect(files["SKILL.md"]).toContain(path);
    }
  });

  test("SKILL.md keeps the tools-only mutation rule", () => {
    expect(files["SKILL.md"]).toContain("mcp__bot__");
  });
});
