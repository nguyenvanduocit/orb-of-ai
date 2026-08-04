export const meta = {
  name: 'atlas-full-points-guide',
  description: 'Research + verify the POE2 0.5 full-atlas-progression unlock path (300+ tree + 3 Masters), return a rewrite brief',
  whenToUse: 'Re-run to refresh the atlas full-points / Masters unlock walkthrough as the live league matures and community pins the numbers patch notes omit.',
  phases: [
    { title: 'Research', detail: 'one haiku agent per contested claim — WebSearch primary, reddit/youtube best-effort' },
    { title: 'Verify', detail: 'one sonnet agent per claim — grounded against the patch-note quote to avoid false-refute' },
    { title: 'Brief', detail: 'synthesize verdicts + confirmed skeleton into a section-by-section rewrite brief' },
  ],
}

// ── Ground truth the verifiers must NOT overturn (verbatim from data/release-notes/Version_0.5.0.md) ──
const PATCH_CONFIRMED = [
  'Atlas reset; you must do the Origins of Divinity storyline to gain Atlas Tree points.',
  'On completion of your first tower, a Fortress rises from the earth.',
  'Maps inside the fortress grant one or more passive points for the Atlas Passive Tree. This entirely replaces the previous method of gaining Atlas Points.',
  'The Atlas Tree has 300+ nodes. Completing all maps inside the fortress gives enough points to FULLY allocate it. No respec needed; multi-choice nodes swap between options at any time.',
  'The Burning Monolith along with Arbiter of Ash has been moved into the Fortress (relocated existing boss).',
  'Quest versions of the Crisis fragments are in two Enigma chambers inside the Fortress.',
  'Three Gateway maps with two new bosses access different sections of the fortress.',
  'Two new Citadel maps with two new bosses drop keys to the new Pinnacle Boss.',
  'Arbiter of Divinity is a NEW Pinnacle Boss (distinct from Arbiter of Ash).',
  'Maps in the fortress can alternatively be completed by killing the Arbiter of Divinity 5 times to auto-complete different sections of the fortress for Atlas Tree points.',
  'Masters of the Atlas: 3 masters, each 12 nodes of which 4 selectable at a time; all three allocatable simultaneously, swap between maps via quick-select; unlock each row of 3 nodes by doing missions.',
  "Doryani's Science questline unlocked by clearing a corruption nexus. Hilda's Hunting unlocked by visiting Hilda's Campsite SW of start. Jado's Spycraft unlocked by completing an anomaly map near start.",
  'Empty tablet slots add random non-tablet league content, so you do NOT need to complete atlas trees for leagues you do not run.',
  'Some items/content now require atlas-passive specialisation: Exceptional Items, Fracturing Orbs, Basic and Overseer precursor tablets.',
]

// ── The claims the existing guide states from in-game observation, needing live-community verification ──
// patchGround = the closest verbatim patch-note line (the verifier must treat this as floor truth)
const CLAIMS = [
  {
    id: 'citadel-boss-names',
    claim: "The two Citadel bosses that drop keys to re-access Arbiter of Divinity are named 'Patriarch's Call' and 'Matriarch's Call'; each re-access cluster needs one Patriarch + one Matriarch killed.",
    patchGround: 'Added two new Citadel maps with two new bosses that drop keys to the new Pinnacle Boss. (Patch notes do NOT name them.)',
    question: 'What are the actual names of the two key-dropping Citadel bosses? Confirm or correct "Patriarch\'s Call" / "Matriarch\'s Call". How many of each must be killed to open one Arbiter of Divinity attempt?',
  },
  {
    id: 'gateway-vs-citadel',
    claim: "The Gateway side (Western/Eastern Gateway → two Enigma chambers with quest Crisis fragments → Arbiter of Ash) is a SEPARATE structure from the Citadel bosses that drop Arbiter of Divinity keys.",
    patchGround: 'Three Gateway maps with two new bosses access different sections of the fortress. Separately: two Citadel maps with two new bosses drop keys to the new Pinnacle Boss. Burning Monolith + Arbiter of Ash moved into Fortress.',
    question: 'Is the Gateway/Enigma/Arbiter-of-Ash path distinct from the Citadel-key/Arbiter-of-Divinity path? Map the two structures and how a player progresses through each.',
  },
  {
    id: 'five-kill-statue-loop',
    claim: 'Each Arbiter of Divinity kill lets you pick 1 of 5 stone statues; picking one auto-completes ALL maps in that one fortress section. So 5 kills = 5 sections = full tree without manually running fortress maps.',
    patchGround: 'Maps in the fortress can alternatively be completed by killing the Arbiter of Divinity 5 times to auto-complete different sections of the fortress for Atlas Tree points.',
    question: 'Confirm the exact 5-kill reward mechanic: do you pick 1 of 5 statues/sections per kill? Exactly how do you re-open Arbiter of Divinity for kills #2-5 (keys from citadel bosses found outside the fortress)?',
  },
  {
    id: 'maps-per-section',
    claim: 'The fortress holds ~150 maps total, roughly ~30 per section across 5 sections.',
    patchGround: 'No count given in patch notes ("after completing ALL the maps inside the fortress...").',
    question: 'How many maps does the fortress hold total, and per section? Pin a real number from community mapping if available.',
  },
  {
    id: 'time-to-full-tree',
    claim: 'Fully unlocking the 300+ node atlas tree takes roughly ~30 hours.',
    patchGround: 'No time estimate in patch notes.',
    question: 'What is a realistic hours-played estimate to fully allocate the atlas tree via the 5-kill route vs manual fortress clearing?',
  },
  {
    id: 'doryani-questline-length',
    claim: "Doryani's Science full questline = three corruption nexus plus one nexus boss.",
    patchGround: "Doryani's Science questline is unlocked by clearing a corruption nexus. (Unlock step only; full length not stated.)",
    question: "How many steps in the full Doryani's Science questline to finish it? Confirm or correct '3 corruption nexus + 1 boss'.",
  },
  {
    id: 'jado-questline-length',
    claim: "Jado's Spycraft full questline = four anomaly maps.",
    patchGround: "Jado's Spycraft questline is unlocked by completing an anomaly map near the starting location. (Unlock step only.)",
    question: "How many steps in the full Jado's Spycraft questline? Confirm or correct '4 anomaly maps'. What is an anomaly map (is Jade Island one)?",
  },
  {
    id: 'master-row-unlock-cost',
    claim: 'Each master has 4 rows of 3 nodes (12 total, choose 4). Each row of 3 is unlocked by doing missions for that master.',
    patchGround: 'Each master has 12 nodes of which 4 can be selected at a time. Unlock each row of 3 nodes by performing missions for the masters.',
    question: 'How many missions unlock each row, and roughly how much play to fully unlock all 12 nodes of one master? What do master missions look like in practice?',
  },
]

const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['claimId', 'found', 'summary', 'evidence'],
  properties: {
    claimId: { type: 'string' },
    found: { type: 'boolean', description: 'true if community evidence addressing the claim was located' },
    summary: { type: 'string', description: 'what the live community currently says about this claim (1-4 sentences)' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'detail'],
        properties: {
          source: { type: 'string', description: 'site/creator/subreddit + URL if available' },
          detail: { type: 'string', description: 'the specific finding or quote' },
        },
      },
    },
    conflicts: { type: 'string', description: 'any disagreement between sources, or empty string' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['claimId', 'status', 'resolvedFact', 'confidence', 'sources'],
  properties: {
    claimId: { type: 'string' },
    status: { type: 'string', enum: ['CONFIRMED', 'CORRECTED', 'UNVERIFIED'], description: 'CONFIRMED = claim holds; CORRECTED = claim wrong, resolvedFact has the fix; UNVERIFIED = no credible community evidence, keep as test-plan' },
    resolvedFact: { type: 'string', description: 'the fact to write into the guide (corrected if needed); for UNVERIFIED, phrase as what to log in-game' },
    correction: { type: 'string', description: 'if CORRECTED: what the old claim got wrong and the right version; else empty' },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    groundedOnPatch: { type: 'boolean', description: 'true if the verdict is consistent with the supplied patch-note ground (must never contradict it)' },
    sources: { type: 'array', items: { type: 'string' } },
  },
}

phase('Research')

const verdicts = await pipeline(
  CLAIMS,
  // Stage 1 — community research (cheap, parallel, web-first)
  (c) => agent(
    `POE2 0.5 "Return of the Ancients" / Runes of Aldur league is LIVE (day ~8, today 2026-06-06). Research one specific claim about the endgame Atlas unlock path.

CLAIM TO INVESTIGATE: ${c.claim}

SPECIFIC QUESTION: ${c.question}

PATCH-NOTE GROUND (official, treat as floor truth — do not contradict it): ${c.patchGround}

Method:
- Use WebSearch as your PRIMARY tool. Good day-8 sources: maxroll.gg, poe2db.tw, poewiki/poe2 wiki, fextralife, reddit.com/r/PathOfExile2 threads, recent YouTube atlas/endgame guides (search the titles).
- Do NOT cite content/guides/0-5-atlas-unlock-walkthrough.md (the rewrite target) or other local content/ files as evidence — they are the documents being rewritten. Corroborate from INDEPENDENT external sources only, so a provisional prior claim cannot confirm itself.
- Reddit MCP and YouTube transcript tools are best-effort only — if they 403 or bot-wall, fall back to WebSearch result snippets. Do not block on them.
- You are pinning DETAILS the patch notes omit (exact boss names, counts, hours, questline lengths). Prefer concrete numbers and proper nouns with a source URL.
- If you find nothing credible, set found=false and say so honestly. Do NOT invent.

Return the structured object for claimId="${c.id}".`,
    { label: `research:${c.id}`, phase: 'Research', schema: RESEARCH_SCHEMA, model: 'haiku' },
  ),
  // Stage 2 — grounded verification (sonnet)
  (research, c) => agent(
    `Verify a claim about the POE2 0.5 endgame Atlas unlock path. Ground every judgement against the official patch note; community research only DETAILS what the patch note leaves open — it can never overturn the patch note.

CLAIM: ${c.claim}
PATCH-NOTE GROUND (official, immovable): ${c.patchGround}
COMMUNITY RESEARCH (may be partial, wrong, or empty): ${JSON.stringify(research)}

Rules:
- If community evidence CONTRADICTS the patch-note ground, the patch note wins — flag the community source as wrong, set groundedOnPatch=true.
- CONFIRMED only if credible community evidence supports the claim's specifics (and patch note doesn't contradict).
- CORRECTED if credible evidence shows a specific number/name/count is wrong — put the right version in resolvedFact + correction.
- UNVERIFIED if research came back empty/thin — resolvedFact must be phrased as an in-game thing to LOG (test-plan), not a hedge, and confidence=LOW.
- Confidence: HIGH only with multiple agreeing credible sources or direct patch-note support; MEDIUM single decent source; LOW guess/none.

Return the structured verdict for claimId="${c.id}".`,
    { label: `verify:${c.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'sonnet' },
  ),
)

const clean = verdicts.filter(Boolean)
log(`Verified ${clean.length}/${CLAIMS.length} claims: ${clean.map((v) => `${v.claimId}=${v.status}`).join(', ')}`)

phase('Brief')

const brief = await agent(
  `You are preparing a REWRITE BRIEF for a Vietnamese POE2 guide titled "Mở Khóa Toàn Bộ Atlas Endgame" — how to unlock the FULL atlas progression in 0.5: all 300+ atlas-tree points AND max out all three Masters of the Atlas. You are NOT writing the final guide; you are handing the author a precise, source-grounded outline. The author will write the prose.

PATCH-CONFIRMED SKELETON (immovable ground truth):
${PATCH_CONFIRMED.map((s, i) => `${i + 1}. ${s}`).join('\n')}

VERIFIED CLAIM VERDICTS (community-pinned details):
${JSON.stringify(clean, null, 2)}

LANE BOUNDARY (do NOT duplicate — these live in the sibling guide /guides/0-5-endgame-mapping-sustain):
- node allocation order, node values, per-mechanic subtree priority, waystone sustain, early-league bug list.
This guide owns: WHERE to go, WHAT to kill, in WHAT ORDER, to unlock everything — plus the 3 Master questlines as a first-class section, plus a short "what full allocation unlocks" payoff (atlas-gated Exceptional Items, Fracturing Orbs, Basic/Overseer precursor tablets).

Produce a section-by-section rewrite brief in markdown. For EACH section give:
- the heading (sentence-case, natural Vietnamese-player voice, no "X — Y" dash-subtitle)
- the key facts to state, each tagged inline as [CONFIRMED] / [CORRECTED: was X now Y] / [TEST-PLAN: log in-game] so the author knows what is solid vs what to phrase as a thing to verify in play
- which facts trace to patch notes vs community

Priorities:
1. Protect the Arbiter of Ash (relocated, Gateway/Enigma side) vs Arbiter of Divinity (new, 5-kill target) distinction — they are DIFFERENT bosses.
2. Make the three Master questlines (Doryani, Jado, Hilda) a full section with unlock condition + full questline length + how rows-of-3 unlock.
3. Make the 5-kill statue shortcut the spine of the fast route, with the exact re-access loop.
Keep it tight and factual. Output only the brief.`,
  { label: 'synthesize-brief', phase: 'Brief', model: 'sonnet' },
)

return { verdicts: clean, brief }
