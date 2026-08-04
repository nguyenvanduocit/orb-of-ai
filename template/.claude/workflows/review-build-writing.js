// review-build-writing — judge the cheat-sheet quality of every build doc in content/builds/.
//
// Evaluates each build guide against the project's documented standard
// (write-build-tutorial SKILL.md + build-template.md + templates/content-style.md)
// on what the corpus is for: fact-dense cheat sheets for an AI reader — every line a usable
// fact, 100% hard facts preserved, self-contained bullets, fully linked. DIAGNOSTIC ONLY —
// never edits content/.
//
// INVOKE:
//   Workflow({ scriptPath: '.claude/workflows/review-build-writing.js', args: { date: '2026-06-09' } })
//   Workflow({ name: 'review-build-writing', args: { date: '2026-06-09' } })
//
// args (all optional):
//   date     string  — YYYY-MM-DD stamp for the report filename (Date.now() is unavailable in scripts)
//   outDir   string  — output dir for the report (default 'tmp')
//
// Output: a ranked corpus report at <outDir>/build-writing-review-<date>.md  + an executive summary returned to the caller.

export const meta = {
  name: 'review-build-writing',
  description: 'Judge the cheat-sheet quality of every build doc in content/builds/ against the content-style.md standard — two-track scoring (evergreen fact-density/preservation/scannability vs era-sensitive template+size conformance), mechanical violation checklist + 1-5 judgment scores, corpus synthesis + adversarial critic. Diagnostic only, writes a report to tmp/.',
  whenToUse: 'When the user wants all build writing reviewed/judged against the cheat-sheet standard: fact-dense (no narrative), 100% hard facts kept + sourced, self-contained bullets, within size target, fully linked. Produces a ranked report, not edits.',
  phases: [
    { title: 'Discover', detail: 'glob build docs, exclude class-level index stubs by path shape', model: 'haiku' },
    { title: 'Review', detail: 'one reviewer per doc — cheat-sheet violation checklist + 1-5 judgment scores, two tracks', model: 'sonnet' },
    { title: 'Synthesize', detail: 'rank docs, surface systemic patterns, pick exemplars vs needs-work', model: 'sonnet' },
    { title: 'Critique', detail: 'single critic challenges the rankings + REWRITE calls + systemic claims', model: 'opus' },
    { title: 'Finalize', detail: 'fold critic adjustments, write the corpus report to tmp/', model: 'sonnet' },
  ],
}

// ---------------- args ----------------
// Accept args as an object, or a JSON-encoded string (some invocations stringify it).
let _A = args
if (typeof _A === 'string') { try { _A = JSON.parse(_A) } catch (e) { _A = {} } }
const A = (_A && typeof _A === 'object') ? _A : {}
const DATE = (A.date && /^\d{4}-\d{2}-\d{2}$/.test(A.date)) ? A.date : 'undated'
const OUT_DIR = (A.outDir || 'tmp').replace(/\/+$/, '')
const REPORT_PATH = OUT_DIR + '/build-writing-review-' + DATE + '.md'

// ---------------- the standard (distilled rubric injected into every reviewer) ----------------
// Canonical sources a reviewer may open for a borderline call:
//   templates/content-style.md                    (the cheat-sheet standard — every doc obeys it)
//   templates/build-template.md                   (section intents + required/literal sections + size target)
//   .claude/skills/write-build-tutorial/SKILL.md  (how a build cheat sheet is authored)
const RUBRIC = [
  'You judge a Path of Exile 2 build guide as a FACT-DENSE CHEAT SHEET FOR AN AI READER (the bot, research agents) — not prose for a human. The standard is templates/content-style.md: every line carries one usable fact, 100% of the hard facts are preserved, bullets are self-contained, numbers are sourced, and everything is linked. Judge on TWO INDEPENDENT TRACKS. Do not let one contaminate the other.',
  '',
  'TRACK A — CHEAT-SHEET QUALITY (EVERGREEN: applies to EVERY doc regardless of patch/era). Violations here are real defects.',
  'Detect each as a binary/count with line citations. Use these exact codes:',
  '  Q1 narrative / filler line — a line that carries no usable fact: a lead-in, a transition, a recap, "đoạn này nói về X", flavour. Test: delete the line — if only prose is lost (no fact), it is a Q1.',
  '  Q2 speaker / register — "mình/bạn/bro", first/second-person address, a narrating voice. A cheat sheet has no speaker.',
  '  Q3 recap / meta-summary — a Quick Summary/Overview/recap section, "bài này tổng hợp", "tóm lại", "trong note này", or source-attribution ("theo Fubgun/creator", "video nói", "transcript"). Each fact lives in exactly ONE section; no restating.',
  '  Q4 non-self-contained bullet — a bullet that only parses by reading a neighbouring line (dangling pronoun/continuation, "cái này cũng vậy"). Each bullet must stand alone.',
  '  Q5 number without source/timestamp — a market number (price/profit) missing "(YYYY-MM-DD, nguồn)", or a volatile game number missing a patch tag.',
  '  Q6 DPS/EHP >=100k without a PoB link or a shown math chain — a bare headline number.',
  '  Q7 vague word instead of a fact — "tốt/mạnh/đáng kể/rất nhiều" (or English "strong/huge/insane") standing in for a concrete number; a mod described loosely instead of quoting its wording.',
  '  Q8 bare game term missing wiki-link — a unique/skill/support/currency named without a :wiki-link{} on first mention (cite the most egregious few, not an exhaustive sweep).',
  '  Q9 linking gap — the doc plainly relates to another corpus doc but Relationships is missing/empty, or a Relationships link is one-directional (the reverse edge is absent on the other doc — flag as needs-check).',
  '',
  'TRACK B — TEMPLATE + SIZE CONFORMANCE (ERA-SENSITIVE). A doc that predates the cheat-sheet template (old prose scaffold, patch 0.4 archetype) — FLAG as a MIGRATION item, do NOT let it drag down the quality verdict. Codes:',
  '  T1 body over size target — body (excluding frontmatter) exceeds 120 lines for a build doc. Record the line_count. Oversize is a Track-B signal (usually narrative bloat), not an automatic quality fail.',
  '  T2 missing `## Failure Modes`, or it has fewer than 3 distinct failure scenarios (REQUIRED by project rule).',
  '  T3 validator-literal heading altered — a heading the validator keys on is not verbatim: "## Failure Modes", "### Performance Ratings", "## Relationships", "## Changelog" must appear EXACTLY (no Vietnamese-ising, no em-dash subtitle "## X — Y"). List each altered heading.',
  '  T4 required core missing — the opening 1-2 line summary, "## Build Overview", or "## Verdict" is absent (build-template required core).',
  '  T5 legacy structure artifact — predates the cheat-sheet template: a "Pantheon & Bandits" section (POE2 has none), a standalone "Summary"/"Strengths & Limitations" section (folded into Failure Modes/Verdict now), or old dash-subtitle/Title-Case heading scaffolding. List which.',
  '  T6 frontmatter validation errors (you will run `bun run generate` to verify — build must be green; record any frontmatter errors).',
  '',
  'NOT a violation (the cheat-sheet standard ALLOWS these — do NOT flag): markdown tables for enumerable data (stat blocks, the Performance Ratings table, tier/compare tables); fenced blocks that are validator `section-rules` or a single formula; sentence fragments and "A → B" arrows; a dense stat line. Density is the goal, not a defect.',
  '',
  'JUDGMENT SCORES (1-5, cheat-sheet axes). 5=excellent, 3=acceptable, 1=poor:',
  '  fact_density (mọi dòng là fact) — the share of lines that carry a usable fact vs narrative/filler/recap. 5 = zero filler, every line pulls weight; 1 = mostly prose.',
  '  fact_completeness (giữ đủ hard facts, có nguồn) — no hard fact lost (numbers, breakpoints, exclusions, exact mod wording, node/gem/item names), numbers sourced/timestamped, DPS/EHP >=100k backed by a PoB link or math chain, no vague word standing in for a number. 5 = complete + sourced; 1 = facts missing/bare/vague.',
  '  scannability (AI trích được ngay) — a bullet stands alone, an AI can grep one line and get the whole answer (what the build uses / DPS / floor cost), and linking is complete + bidirectional. 5 = fully scannable + linked; 1 = must read in sequence, links missing.',
  '',
  'CORRECTNESS SCOPE: judge INTERNAL correctness only — numbers are concrete (not "tốt"/"mạnh") and attributed to PoB/character/patch, no internal contradictions, no obvious fabrication. DO NOT attempt external fact-checking of game mechanics against wiki/patch (out of scope, no tools for it here). If a claim looks unsupported or suspicious, FLAG it as a note; do not try to resolve it.',
  '',
  'VERDICTS (two independent outputs):',
  '  quality_verdict — KEEP (cheat-sheet-clean, publish-ready), POLISH (good but has the listed fixes), REWRITE (pervasive narrative/recap, lost or bare facts, or not scannable). Based on Track A + judgment scores ONLY, never on template era.',
  '  template_status — CURRENT (matches today\'s cheat-sheet template + within size target) or LEGACY-MIGRATION (predates it / oversize scaffold; needs structural migration). Based on Track B.',
].join('\n')

// ---------------- schemas ----------------
const DISCOVER_SCHEMA = {
  type: 'object',
  properties: {
    docs: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    stubs: { type: 'array', items: { type: 'string' } },
  },
  required: ['docs'],
}

const SCORES = {
  type: 'object',
  properties: {
    fact_density: { type: 'integer', minimum: 1, maximum: 5 },
    fact_completeness: { type: 'integer', minimum: 1, maximum: 5 },
    scannability: { type: 'integer', minimum: 1, maximum: 5 },
  },
  required: ['fact_density', 'fact_completeness', 'scannability'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    patch: { type: 'string' },
    line_count: { type: 'integer' },
    evergreen_violations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },        // Q1..Q9
          count: { type: 'integer' },
          lines: { type: 'string' },        // e.g. "41, 73, 110-118"
          note: { type: 'string' },
        },
        required: ['code', 'count'],
      },
    },
    template_issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: { code: { type: 'string' }, detail: { type: 'string' } }, // T1..T6
        required: ['code', 'detail'],
      },
    },
    validate_status: { type: 'string' },     // "clean" or a short error summary
    scores: SCORES,
    quality_verdict: { type: 'string', enum: ['KEEP', 'POLISH', 'REWRITE'] },
    template_status: { type: 'string', enum: ['CURRENT', 'LEGACY-MIGRATION'] },
    one_line: { type: 'string' },            // the verdict in one sentence
    top_fixes: { type: 'array', items: { type: 'string' } },   // <=3 highest-leverage fixes
    strengths: { type: 'array', items: { type: 'string' } },   // <=3 things done well
    suspicious_claims: { type: 'array', items: { type: 'string' } }, // flagged, not resolved
  },
  required: ['path', 'scores', 'quality_verdict', 'template_status', 'one_line'],
}

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          rank: { type: 'integer' },
          quality_verdict: { type: 'string' },
          template_status: { type: 'string' },
          fact_density: { type: 'integer' }, fact_completeness: { type: 'integer' }, scannability: { type: 'integer' },
          one_line: { type: 'string' },
        },
        required: ['path', 'rank', 'quality_verdict', 'one_line'],
      },
    },
    systemic_patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: { pattern: { type: 'string' }, affected_count: { type: 'integer' }, examples: { type: 'array', items: { type: 'string' } } },
        required: ['pattern', 'affected_count'],
      },
    },
    exemplars: { type: 'array', items: { type: 'string' } },     // copy-these docs
    needs_work: { type: 'array', items: { type: 'string' } },    // priority fix list
    corpus_take: { type: 'string' },                            // 3-5 sentence overall judgment
  },
  required: ['ranking', 'systemic_patterns', 'corpus_take'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    sound: { type: 'boolean' },
    verdict_adjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, why: { type: 'string' } },
        required: ['path', 'why'],
      },
    },
    ranking_issues: { type: 'array', items: { type: 'string' } },
    unsupported_claims: { type: 'array', items: { type: 'string' } }, // synthesis claims not backed by the reviews
    notes: { type: 'string' },
  },
  required: ['sound'],
}

const FINAL_SCHEMA = {
  type: 'object',
  properties: { report_path: { type: 'string' }, executive_summary: { type: 'string' } },
  required: ['report_path', 'executive_summary'],
}

// ---------------- helpers ----------------
const shortName = (p) => p.split('/').slice(-2).join('/')

// ================= PHASE 0 — DISCOVER =================
phase('Discover')
const discovery = await agent(
  [
    'Find every Path of Exile 2 BUILD GUIDE under content/builds/ that should be reviewed.',
    'Use Glob/Bash to list content/builds/**/*.md.',
    'EXCLUDE class-level landing stubs whose path matches exactly content/builds/<class>/index.md (exactly ONE path segment between "builds/" and "/index.md") — these are ~17-line class index pages, not build guides.',
    'KEEP everything else, INCLUDING real build docs nested as content/builds/<class>/<slug>/index.md (two segments — these are full guides).',
    'Return kept docs in `docs` (one {path} each) and the excluded stubs in `stubs`. Do NOT read full file contents — paths only.',
  ].join('\n'),
  { schema: DISCOVER_SCHEMA, label: 'discover', phase: 'Discover', model: 'haiku' },
)
const docs = (discovery && Array.isArray(discovery.docs)) ? discovery.docs.filter(d => d && d.path) : []
log('Discovered ' + docs.length + ' build docs to review (' + ((discovery && discovery.stubs && discovery.stubs.length) || 0) + ' stubs excluded).')
if (!docs.length) { return { error: 'No build docs discovered.', report_path: null } }

// ================= PHASE 1 — REVIEW (one agent per doc) =================
phase('Review')
const reviews = (await parallel(docs.map((d) => () => agent(
  [
    'You are a meticulous editor reviewing ONE Path of Exile 2 build guide as a FACT-DENSE CHEAT SHEET FOR AN AI READER. Be specific and cite line numbers.',
    '',
    'TARGET FILE: ' + d.path,
    '',
    'STEPS:',
    '1. Read the full file (Read tool).',
    '2. Run `bun run generate` and record the result in validate_status ("clean" or a one-line error summary). Map any frontmatter errors to template_issues code T6.',
    '3. Note the frontmatter `patch` and the body line_count (lines excluding frontmatter); if body > 120 lines, record template_issues code T1.',
    '4. Score against the rubric below. For EVERY Track-A (cheat-sheet) violation you find, give its code (Q1..Q9), a count, and the line numbers. For Track-B template issues, give the code (T1..T6) + a short detail. Then assign the three 1-5 judgment scores.',
    '5. Decide quality_verdict (KEEP/POLISH/REWRITE — Track A + judgment ONLY, ignore template era) and template_status (CURRENT/LEGACY-MIGRATION — Track B).',
    '6. Give <=3 highest-leverage top_fixes and <=3 strengths. Flag (do not resolve) any internally-unsupported or suspicious factual claims in suspicious_claims.',
    '',
    'Be calibrated, not harsh: a clean cheat-sheet doc (fact-dense, self-contained bullets, sourced numbers, wiki-links, tables for enumerable data, Failure Modes present, within size target) should score 4-5 and KEEP. Reserve REWRITE for pervasive narrative/recap, lost or bare facts, or a doc that cannot be scanned. Do NOT penalise density, tables, fragments, or arrows — those are the standard.',
    'DIAGNOSTIC ONLY — do NOT edit the file.',
    '',
    '=== RUBRIC ===',
    RUBRIC,
  ].join('\n'),
  { schema: REVIEW_SCHEMA, label: 'review:' + shortName(d.path), phase: 'Review', model: 'sonnet' },
)))).filter(Boolean)
log('Reviewed ' + reviews.length + '/' + docs.length + ' docs.')

// ================= PHASE 2 — SYNTHESIZE =================
phase('Synthesize')
const synthesis = await agent(
  [
    'You are the editor-in-chief synthesizing per-doc reviews of the content/builds/ corpus into one ranked judgment.',
    'Input: a JSON array of per-doc reviews (mechanical violation checklists on two tracks + 1-5 judgment scores + verdicts).',
    '',
    'Produce:',
    '- ranking: ALL docs ordered best->worst by cheat-sheet quality (quality_verdict then judgment scores; template_status is a SEPARATE axis, do not let LEGACY-MIGRATION sink a fact-dense doc). Assign rank 1..N. Carry fact_density/fact_completeness/scannability + one_line.',
    '- systemic_patterns: corpus-wide facts aggregated from the mechanical checklists, with affected_count and example paths. E.g. "N docs carry narrative/filler lines (Q1)", "M docs have a speaker/register (Q2)", "K docs are over the 120-line size target (T1)", "J docs are LEGACY-MIGRATION". These are FACTS from the checklists, not opinions.',
    '- exemplars: the docs whose cheat-sheet form others should copy.',
    '- needs_work: the priority fix list (REWRITE first, then worst judgment scores).',
    '- corpus_take: a 3-5 sentence honest overall answer to the owner\'s question — is our build corpus fact-dense, correct, scannable, and complete (100% hard facts kept, sourced, linked)? Where is it strong, where does it slip?',
    '',
    'Ground every systemic claim in the review data. Do not invent counts.',
    '',
    '=== REVIEWS (JSON) ===',
    JSON.stringify(reviews),
  ].join('\n'),
  { schema: SYNTH_SCHEMA, label: 'synthesize', phase: 'Synthesize', model: 'sonnet' },
)

// ================= PHASE 3 — CRITIQUE (single high-leverage adversarial pass) =================
phase('Critique')
const critique = await agent(
  [
    'You are an adversarial critic. Your job is to stress-test the synthesis below — NOT to re-review every doc.',
    'You have both the per-doc reviews and the synthesis. Challenge the CONCLUSIONS:',
    '- Are the REWRITE / KEEP quality_verdicts defensible given the cited evidence? Name any that look mis-called (verdict_adjustments with from/to/why).',
    '- Is any doc clearly mis-ranked relative to its scores and violations? (ranking_issues)',
    '- Does any systemic_pattern count or corpus_take claim go beyond what the review data supports? (unsupported_claims)',
    '- Watch specifically for the trap of conflating template era with cheat-sheet quality — a LEGACY-MIGRATION doc penalised on quality for being old-format, or a current-template doc rated highly despite thin/narrative content. Also flag any reviewer that mistakenly dinged a table, a fragment, or an arrow as a defect (the standard allows them).',
    'Set sound=true only if the synthesis holds up after your challenge. Keep adjustments evidence-backed; do not manufacture disagreement.',
    '',
    '=== SYNTHESIS (JSON) ===',
    JSON.stringify(synthesis),
    '',
    '=== REVIEWS (JSON) ===',
    JSON.stringify(reviews),
  ].join('\n'),
  { schema: CRITIC_SCHEMA, label: 'critique', phase: 'Critique', model: 'opus' },
)

// ================= PHASE 4 — FINALIZE (write the report) =================
phase('Finalize')
const final = await agent(
  [
    'Write the final build-writing review report to ' + REPORT_PATH + ' using the Write tool. This is a DIAGNOSTIC report — do NOT edit any file under content/.',
    'Fold the critic\'s evidence-backed adjustments into the synthesis before writing (apply verdict_adjustments and ranking_issues; drop or soften any unsupported_claims the critic named).',
    '',
    'Report structure (Markdown, written for the project owner — direct, no fluff):',
    '1. Title + date (' + DATE + ') + one-paragraph corpus_take (the honest overall judgment, post-critique).',
    '2. "## Ranked scorecard" — a compact list (NOT a wide table), one line per doc, best->worst: rank, short path, quality_verdict, template_status, scores as fact_density/fact_completeness/scannability, and the one_line. Group or mark the LEGACY-MIGRATION docs so the owner sees cheat-sheet-quality and template-era as separate axes.',
    '3. "## Systemic patterns" — the corpus-wide facts with counts and example paths (narrative/filler lines, speaker/register, unsourced numbers, oversize docs, missing Failure Modes, legacy scaffold, etc.).',
    '4. "## Exemplars to copy" and "## Priority fixes" — actionable lists; for each priority doc give its top_fixes.',
    '5. "## Per-doc detail" — one short subsection per doc with its violations (codes + lines), scores, verdict, top_fixes, strengths, and any suspicious_claims flagged.',
    '6. "## Critic notes" — what the adversarial pass changed or affirmed.',
    'Keep it scannable. Use the violation CODES (Q1..Q9, T1..T6) with a one-line legend at the top so they are decodable.',
    '',
    'Return report_path and a 4-6 sentence executive_summary (the headline judgment + the 2-3 biggest systemic issues + which docs are exemplars vs need rewriting).',
    '',
    '=== SYNTHESIS (JSON) ===',
    JSON.stringify(synthesis),
    '',
    '=== CRITIQUE (JSON) ===',
    JSON.stringify(critique),
    '',
    '=== REVIEWS (JSON) ===',
    JSON.stringify(reviews),
  ].join('\n'),
  { schema: FINAL_SCHEMA, label: 'finalize', phase: 'Finalize', model: 'sonnet' },
)

return {
  report_path: (final && final.report_path) || REPORT_PATH,
  reviewed: reviews.length,
  critic_sound: critique ? critique.sound : null,
  executive_summary: (final && final.executive_summary) || null,
}
