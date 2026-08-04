export const meta = {
  name: 'gear-upgrade',
  description: 'POE2 gear optimizer: build confidence OFFLINE (divergent hypotheses → constructible synthetic combos → PoB-validated balance), then touch trade ONLY to price the chosen combo.',
  whenToUse: 'After pinning a fresh baseline XML, to find a balanced multi-slot gear upgrade for a POE2 character. Pass args={baseline,league,patch,budget_ex,hard,soft,tradePrefs,audit,equipped,modfile}.',
  phases: [
    { title: 'Hypotheses', detail: 'parallel agents, each a distinct optimization philosophy, grounded in the canonical mod-query file' },
    { title: 'Search', detail: 'offline: write merged spec, run gear-optimize.py search (zero trade) — the confidence gate' },
    { title: 'Verify', detail: 'parallel skeptics re-check the winning combo (constructibility, build-integrity, companion caveat)' },
    { title: 'Price', detail: 'the ONLY GGG phase: gear-optimize.py price → real securable prices + trade URLs' },
  ],
};

// ── args (from the main loop, which handles interactive OAuth + pins the baseline) ──
const A = args || {};
const ROOT = process.cwd();
const ENGINE = `${ROOT}/.claude/skills/gear-upgrade/scripts/gear-optimize.py`;
const MODFILE = A.modfile || `data/gear-mods/${A.patch || '0.5.0'}-gear-mods.json`;
const baseline = A.baseline || 'tmp/tcvsg-current.xml';
const league = A.league || 'Runes of Aldur';
const patch = A.patch || '0.5.0';
const budget = A.budget_ex || 100;
const hard = A.hard || { fireRes: 75, coldRes: 75, lightningRes: 75, intMargin: 0, spiritFree: 0, life: 1170 };
const soft = A.soft || ['coldRes', 'lightningRes', 'evasion', 'spiritUnreserved', 'life'];
const tradePrefs = A.tradePrefs || ['minion_level', 'companion_level'];
const audit = A.audit || '(no audit provided — runner will compute baseline)';
const equipped = A.equipped || '(equipped mods not provided — read from baseline XML if needed)';

// shared grounding every hypothesis agent receives — the canonical file is the
// single source of truth for valid bases / axes / affix types, so agents pick
// from it instead of recalling (the engine rejects anything infeasible anyway).
const GROUND = `
You are proposing a CONSTRUCTIBLE POE2 gear-upgrade hypothesis for the /gear-upgrade engine.

Character baseline audit (PoB-measured, current state):
  ${audit}
Currently equipped (mods per slot — losing a load-bearing mod when you swap is the trap):
  ${equipped}

Hard constraints the combo MUST satisfy (PoB will judge):
  ${JSON.stringify(hard)}
Soft objective (ranked balance, higher better): ${JSON.stringify(soft)}
Budget: ~${budget} ex. League: ${league}.

GROUND TRUTH — the canonical mod-query file at:
  ${ROOT}/${MODFILE}
Read it before proposing. Use ONLY:
  - bases that exist in .bases (and whose .slot matches the gear slot you target),
  - axes that exist in .axes / .mods (e.g. fire_res, cold_res, lightning_res, all_res,
    chaos_res, life, energy_shield, evasion, evasion_pct, armour, strength, dexterity,
    intelligence, all_attributes, spirit, minion_level, mana, move_speed),
  - and remember affix-slot limits: resistances/attributes are SUFFIXES, life/spirit/mana
    are PREFIXES; a POE2 rare has at most 3 prefixes + 3 suffixes. A ring asking
    fire+cold+light+int = 4 suffixes is IMPOSSIBLE — use an all-elemental (Prismatic) or
    two-stone base instead. Distribute stats across items so every hard constraint holds.

PoB CANNOT simulate companion/minion DPS for this build (combinedDPS=0). minion_level /
companion_level are TRADE-SIDE soft preferences only (list them in plan rationale, never
rely on them to pass a hard constraint).

Inspect with e.g.:
  jq '.bases|to_entries[]|select(.value.slot=="ring")|.key' ${ROOT}/${MODFILE}
  jq '.mods[]|select(.axis=="fire_res")|{affix,type,level,vmax,rollsOn}' ${ROOT}/${MODFILE}

Output a spec FRAGMENT: a set of slot-configs + plans.
  - Each slot-config: key = a free LABEL; { "slot": "<real baseline slot e.g. Ring 2>",
    "base": "<base name from .bases>", "axes": { "<axis>": {"min": <number>}, ... } }.
  - Each plan: { "label": "<short>", "swaps": ["<slot-config label>", ...] } — swaps that
    go together as one combo. A plan may be a single slot (an independent per-item upgrade).
Real baseline slots: Weapon 1, Weapon 2, Helmet, Body Armour, Gloves, Boots, Ring 1, Ring 2, Amulet, Belt, Quiver.`;

const FRAGMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string', description: 'one sentence: the balance idea + any trade-side (minion/companion) note' },
    slots: {
      type: 'object',
      description: 'label -> {slot, base, axes}',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          slot: { type: 'string' },
          base: { type: 'string' },
          axes: { type: 'object', additionalProperties: { type: 'object', properties: { min: { type: 'number' } } } },
        },
        required: ['slot', 'base', 'axes'],
      },
    },
    plans: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' }, swaps: { type: 'array', items: { type: 'string' } } },
        required: ['label', 'swaps'],
      },
    },
  },
  required: ['rationale', 'slots', 'plans'],
};

const PHILOSOPHIES = [
  { key: 'cheap-cap', angle: 'CHEAPEST path to cap all three resistances while keeping Int and Spirit intact. Minimal swaps (1-2 slots). Favour all-elemental / two-stone bases that fix multiple resistances in one suffix.' },
  { key: 'eva-life', angle: 'Cap resistances AND maximise Evasion + Life (the build defensive identity). You may touch more slots (boots, body, belt). Never chase Armour.' },
  { key: 'spirit-minion', angle: 'Cap resistances but route the amulet/body toward Spirit + minion_level (the companion-pack scaler), accepting a higher tier/cost. State clearly that minion/companion value is hand-reasoned, not PoB-verified.' },
  { key: 'per-slot', angle: 'Independent single-slot upgrades — one plan per slot — so the user can buy items one at a time. Each plan swaps exactly one slot and must still keep every hard constraint via that slot alone where possible.' },
];

function namespaceFragment(frag, idx) {
  // prefix slot labels to avoid collisions across agents, rewrite plan swaps to match
  if (!frag || !frag.slots) return { slots: {}, plans: [] };
  const map = {};
  const slots = {};
  for (const [label, cfg] of Object.entries(frag.slots)) {
    const nl = `a${idx}:${label}`;
    map[label] = nl;
    slots[nl] = cfg;
  }
  const plans = (frag.plans || [])
    .map((p) => ({ label: `[${PHILOSOPHIES[idx]?.key || idx}] ${p.label}`, swaps: (p.swaps || []).map((s) => map[s]).filter(Boolean) }))
    .filter((p) => p.swaps.length > 0);
  return { slots, plans };
}

async function runSearch(spec, tag) {
  const specJson = JSON.stringify(spec, null, 2);
  return agent(
    `Run the OFFLINE gear-upgrade search (no trade — Chrome irrelevant).
1. Write this spec verbatim to ${ROOT}/tmp/gopt-spec-${tag}.json:
\`\`\`json
${specJson}
\`\`\`
2. Run: cd ${ROOT} && python3 ${ENGINE} search tmp/gopt-spec-${tag}.json --out tmp/gopt-chosen-${tag}.json
3. Read the full stdout AND ${ROOT}/tmp/gopt-chosen-${tag}.json (if written).
Return: whether any combo PASSED all hard constraints, the chosen-combo JSON (verbatim, if any),
the top passing combos' one-line audits, the count "X/Y combos pass", and any INFEASIBLE slots.
Do NOT touch trade. Do NOT whisper.`,
    {
      label: `search:${tag}`,
      phase: 'Search',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          passed: { type: 'boolean' },
          passCount: { type: 'string' },
          chosenPath: { type: 'string' },
          chosen: { type: 'object', description: 'the chosen-combo JSON, or {} if none passed' },
          topAudits: { type: 'array', items: { type: 'string' } },
          infeasible: { type: 'array', items: { type: 'string' } },
          closest: { type: 'array', items: { type: 'string' }, description: 'if none passed: closest combos + their misses' },
        },
        required: ['passed', 'passCount', 'topAudits'],
      },
    }
  );
}

// ── Phase 1: divergent hypotheses (parallel) ─────────────────────────────────
phase('Hypotheses');
log(`Generating ${PHILOSOPHIES.length} divergent hypotheses, grounded in the canonical mod-query file...`);
const fragments = await parallel(
  PHILOSOPHIES.map((p, i) => () =>
    agent(`${GROUND}\n\nYOUR PHILOSOPHY (${p.key}): ${p.angle}\n\nPropose 1-3 plans that fit this philosophy. Every base + axis must be real (canonical file). Prefer feasible over ambitious — an over-constrained slot is wasted.`,
      { label: `hypo:${p.key}`, phase: 'Hypotheses', schema: FRAGMENT_SCHEMA })
      .then((frag) => namespaceFragment(frag, i))
  )
);

// ── Phase 2: synthesize one spec (JS) ────────────────────────────────────────
const merged = { slots: {}, plans: [] };
for (const f of fragments.filter(Boolean)) {
  Object.assign(merged.slots, f.slots);
  merged.plans.push(...f.plans);
}
const spec = {
  baseline, league, patch, modfile: MODFILE,
  budget_ex: budget, workers: 6, tiers: 2, base_ilvl: 82,
  max_slot_variants: 8, max_combos: 240, top: 8,
  hard, soft, tradePrefs,
  slots: merged.slots, plans: merged.plans,
};
log(`Merged ${Object.keys(merged.slots).length} slot-variants across ${merged.plans.length} plans → one spec.`);

// ── Phase 3: offline search (the confidence GATE — zero trade) ────────────────
phase('Search');
let search = await runSearch(spec, 'r1');

// one bounded retry: if nothing passed, ask a corrector to relax toward the closest
if (!search.passed) {
  phase('Hypotheses');
  log('No combo passed round 1 — generating a corrected hypothesis from the closest near-misses.');
  const fix = await agent(
    `${GROUND}\n\nRound 1 found NO passing combo. Closest near-misses + their constraint misses:\n${(search.closest || search.topAudits || []).join('\n')}\nInfeasible slots: ${(search.infeasible || []).join(', ') || 'none'}\n\nPropose a CORRECTED set of plans: redistribute stats (e.g. move a resistance to a different slot, add a slot, choose an all-elemental base) so the hard constraints can all hold at once. Stay constructible.`,
    { label: 'hypo:fix', phase: 'Hypotheses', schema: FRAGMENT_SCHEMA }
  ).then((frag) => namespaceFragment(frag, 9));
  Object.assign(spec.slots, fix.slots);
  spec.plans.push(...fix.plans);
  phase('Search');
  search = await runSearch(spec, 'r2');
}

if (!search.passed) {
  return {
    status: 'no-pass',
    message: 'No constructible combo satisfied all hard constraints offline. Loosen the hypothesis (raise budget, touch another slot, relax a soft cap) and re-run.',
    passCount: search.passCount,
    closest: search.closest || search.topAudits,
  };
}

// ── Phase 4: adversarial verify the winner (parallel, offline) ───────────────
phase('Verify');
const chosenStr = JSON.stringify(search.chosen || {}, null, 2);
const VERIFY_LENSES = [
  { key: 'constructible', ask: 'Is EVERY synthetic item in the chosen combo actually constructible — affixes that can roll on that base (check rollsOn), distinct groups, ≤3 prefixes and ≤3 suffixes? Re-derive the prefix/suffix counts. Flag any item that could not exist.' },
  { key: 'build-integrity', ask: 'Does swapping these slots LOSE anything load-bearing the current items provide (a unique mod, Spirit, an attribute the gems need)? Compare the chosen slots against the equipped mods. Confirm Int stays ≥ requirement and Spirit reservation is not broken. Flag any silent regression. Also confirm the minion/companion-level value is stated as hand-reasoned (not PoB-verified).' },
];
const verdicts = await parallel(
  VERIFY_LENSES.map((v) => () =>
    agent(`Adversarially verify this PoB-validated gear combo from the ${v.key} lens. Default to skeptical.

Chosen combo (offline-validated by PoB):
${chosenStr}

Equipped baseline mods:
${equipped}

Canonical mod-query file: ${ROOT}/${MODFILE} (read it to check rollsOn / affix types).
You may run:  cd ${ROOT} && python3 ${ENGINE} baseline tmp/gopt-spec-${search.passed ? 'r1' : 'r2'}.json  (debug only).

QUESTION: ${v.ask}

Return real:true only if the combo survives this lens with no blocking issue.`,
      { label: `verify:${v.key}`, phase: 'Verify', schema: {
        type: 'object', additionalProperties: false,
        properties: { real: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } },
        required: ['real', 'issues'],
      } })
  )
);
const blocking = verdicts.filter(Boolean).filter((v) => !v.real);
log(`Verify: ${verdicts.filter(Boolean).filter((v) => v.real).length}/${verdicts.filter(Boolean).length} lenses confirm.`);

// ── Phase 5: price — the ONLY phase that touches GGG (sequential) ────────────
phase('Price');
log('Confidence reached offline. Pricing the chosen combo on trade (securable, rate-limit-safe)...');
const priced = await agent(
  `Price-check the chosen gear combo. This is the ONLY step that touches GGG — it requires the user's Chrome open + logged into www.pathofexile.com + Playwriter enabled.
Run: cd ${ROOT} && python3 ${ENGINE} price ${search.chosenPath || `tmp/gopt-chosen-r1.json`}
Read the full stdout. Return per-slot: the securable listing count, cheapest price + currency, the trade URL; the cheapest-real-combo re-sim audit line and whether it still PASSES; and total cost.
If a slot returned no securable supply, report it (signal to loosen that target in search — do NOT widen blindly). NEVER whisper.`,
  { label: 'price', phase: 'Price', schema: {
    type: 'object', additionalProperties: false,
    properties: {
      reachable: { type: 'boolean', description: 'did trade respond (Chrome/Playwriter ready)?' },
      slots: { type: 'array', items: { type: 'object', additionalProperties: true } },
      realResimAudit: { type: 'string' },
      realResimPasses: { type: 'boolean' },
      totalCostEx: { type: 'number' },
      tradeUrls: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
    },
    required: ['reachable', 'tradeUrls'],
  } }
);

// ── Phase 6: present (synthesis) ─────────────────────────────────────────────
return {
  status: 'ok',
  plan: (search.chosen || {}).plan,
  predicted_offline: (search.chosen || {}).predicted,
  passCount: search.passCount,
  topAudits: search.topAudits,
  verify: { confirmed: blocking.length === 0, blocking },
  price: priced,
  chosenPath: search.chosenPath,
  note: 'Defensive envelope is PoB-validated. Minion/companion-level value is hand-reasoned (PoB cannot sim companion DPS). Engine never whispers — open the trade URLs and whisper in-client.',
};
