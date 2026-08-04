// best-build-05 — POE2 0.5 "best league-start build" research workflow (parameterized).
//
// Generalized from the class-specific Witch hunt: works for ANY class, or all classes.
//
// INVOKE:
//   Workflow({ name: 'best-build-05', args: 'Witch' })                       // class-scoped, auto-resolve ascendancies
//   Workflow({ name: 'best-build-05', args: { class: 'Huntress' } })         // same
//   Workflow({ name: 'best-build-05', args: { class: 'Monk',
//                ascendancies: ['Invoker','Acolyte of Chayula','Martial Artist'] } })  // skip resolver
//   Workflow({ name: 'best-build-05' })                                      // ALL-CLASS hunt (no scope filter)
//   Workflow({ name: 'best-build-05', args: { class: 'Witch',
//                weights: { strength: 1.3, easyPlay: 1.0 }, topN: 8 } })      // tune scoring / candidate pool
//
// args shape (all optional):
//   class         string  — target class; omit → all-class mode
//   ascendancies  string[] — authoritative ascendancy names; omit (class-scoped) → resolver agent reads patch+wiki
//   weights       object  — partial override of the 8-axis scoring weights
//   topN          number  — candidate pool size before ascendancy-balancing (default 6)
//
// Output: a complete build guide written to content/builds/<class>/0-5-*.md, validated via `bun run generate`.

export const meta = {
  name: 'best-build-05',
  description: 'Exhaustive multi-agent hunt for the single best POE2 0.5 league-start build — class-scoped (any class) or all-class. Harvest creators+reddit, verify mechanics, score 8 axes, adversarially stress-test, deep-dive winner, author a complete build file with validate loop.',
  whenToUse: 'When you need the strongest+smoothest POE2 0.5 (Runes of Aldur) build for a given class (or across all classes) researched end-to-end and written to content/builds/. Pass the class via args; omit args for an all-class hunt.',
  phases: [
    { title: 'Foundation', detail: 'resolve ascendancies → patch-note buff-vector map, inventory drafts, scan mechanics, power outliers' },
    { title: 'Creator Harvest', detail: 'per-creator YouTube transcript + web build extraction' },
    { title: 'Community Harvest', detail: 'reddit, GGG forum, tier lists, OP-build chatter' },
    { title: 'Mechanism Sweep', detail: 'first-principles finders — derive the build that maximally abuses each 0.5 buff vector / ascendancy power outlier (catches strong builds no creator has posted)' },
    { title: 'Synthesis', detail: 'dedup + normalize into ranked candidate table (ascendancy-balanced when class-scoped) + completeness critic' },
    { title: 'Mechanic Verify', detail: 'perspective-diverse 3-lens verify per candidate (existence+source-conflict / synergy-exclusion / load-bearing keystone) vs patch/wiki/poedb' },
    { title: 'Scoring', detail: 'multi-axis judges: smooth/strong/buff-stack/easy-play/easy-hit/floor/tank/risk' },
    { title: 'Adversarial', detail: 'two diverse-lens skeptics per finalist (league-start reality / mechanic fragility), surface failure modes, kill weak' },
    { title: 'Enrich', detail: 'graft verified runner-up tech (gear/leveling/defense ideas) into the winner brief without changing core identity' },
    { title: 'Deep Dive', detail: 'fan-out winner: leveling/gear/tree/asc/gems/league-mechanic/budget' },
    { title: 'PoB Numbers', detail: 'derive DPS+EHP math chain, flag pob_coverage' },
    { title: 'Authoring', detail: 'write knowledge-led build file (no rigid template), validate, reviewer loop-until-quality' },
  ],
}

// ---------------- args normalization ----------------
const A = (typeof args === 'string') ? { class: args } : (args || {})
const CLS = ((A.class || A.cls || '') + '').trim() || null
const CLASS_SCOPED = !!CLS
const CLASS_FOLDER = CLASS_SCOPED ? CLS.toLowerCase().replace(/\s+/g, '-') : '<class>'
let ASCENDANCIES = Array.isArray(A.ascendancies) ? A.ascendancies.filter(Boolean) : null
const TOPN_CAP = Number(A.topN) > 0 ? Math.floor(Number(A.topN)) : 6
const DEFAULT_W = { smoothness: 1.2, strength: 1.1, buffStack: 1.0, easyPlay: 1.2, easyHit: 1.3, leagueStartFloor: 1.1, tankiness: 1.0, patchRisk: -0.9 }
const W = Object.assign({}, DEFAULT_W, (A.weights && typeof A.weights === 'object') ? A.weights : {})

const PATCH = 'data/release-notes/Version_0.5.0.md'

// ---------------- schemas ----------------
const ASC_SCHEMA = {
  type: 'object', properties: {
    class: { type: 'string' }, ascendancies: { type: 'array', items: { type: 'string' } }, source: { type: 'string' },
  }, required: ['ascendancies'],
}
const HARVEST_SCHEMA = {
  type: 'object', properties: {
    builds: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, class: { type: 'string' }, ascendancy: { type: 'string' },
      mainSkill: { type: 'string' }, damageType: { type: 'string' }, playstyle: { type: 'string' },
      defenseLayers: { type: 'string' }, buffVectorsUsed: { type: 'array', items: { type: 'string' } },
      difficulty: { type: 'string' }, gearDependency: { type: 'string' },
      thesis: { type: 'string' }, strengths: { type: 'string' }, weaknesses: { type: 'string' },
      source: { type: 'string' }, confidence: { type: 'string' },
    }, required: ['name', 'class', 'ascendancy', 'mainSkill', 'thesis', 'source'] } },
    notes: { type: 'string' },
  }, required: ['builds'],
}
const SYNTH_SCHEMA = {
  type: 'object', properties: { candidates: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, name: { type: 'string' }, class: { type: 'string' }, ascendancy: { type: 'string' },
    mainSkill: { type: 'string' }, damageType: { type: 'string' }, playstyle: { type: 'string' },
    defenseSummary: { type: 'string' }, buffVectorsUsed: { type: 'array', items: { type: 'string' } },
    consensusCount: { type: 'number' }, sources: { type: 'array', items: { type: 'string' } },
    thesis: { type: 'string' }, knownStrengths: { type: 'string' }, knownWeaknesses: { type: 'string' },
  }, required: ['id', 'name', 'class', 'ascendancy', 'mainSkill', 'thesis', 'consensusCount'] } } },
  required: ['candidates'],
}
// one lens of a perspective-diverse verify — each lens fills only its own fields (the rest stay empty),
// merged in plain JS into a combined verify object. existence catches fabrication+source-conflict,
// synergy-exclusion catches anti-synergy/breakpoint, load-bearing names the single claim the thesis rests on.
const VERIFY_LENS_SCHEMA = {
  type: 'object', properties: {
    id: { type: 'string' }, lens: { type: 'string' },
    exists: { type: 'boolean' },                                      // existence lens: do ALL cited entities exist verbatim?
    claimsChecked: { type: 'array', items: { type: 'string' } },
    sourceConflicts: { type: 'array', items: { type: 'string' } },    // patch vs poedb vs wiki disagreements (level/magnitude/drop-source)
    exclusions: { type: 'string' }, breakpoints: { type: 'string' },  // synergy-exclusion lens
    loadBearingAssumption: { type: 'string' },                        // load-bearing lens: the ONE claim the whole thesis rests on
    loadBearingStatus: { type: 'string' },                            // VERIFIED | THEORYCRAFT | FALSE
    pobCoverage: { type: 'string' },                                  // FULL | PARTIAL | NA
    redFlags: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string' }, note: { type: 'string' },
  }, required: ['id', 'lens', 'note'],
}
const SCORE_SCHEMA = {
  type: 'object', properties: {
    id: { type: 'string' }, smoothness: { type: 'number' }, strength: { type: 'number' },
    buffStack: { type: 'number' }, easyPlay: { type: 'number' }, easyHit: { type: 'number' },
    leagueStartFloor: { type: 'number' }, tankiness: { type: 'number' }, patchRisk: { type: 'number' },
    rationale: { type: 'string' },
  }, required: ['id', 'smoothness', 'strength', 'buffStack', 'easyPlay', 'easyHit', 'leagueStartFloor', 'tankiness', 'patchRisk'],
}
const ADV_SCHEMA = {
  type: 'object', properties: {
    id: { type: 'string' }, survives: { type: 'boolean' }, severity: { type: 'string' },
    killFactors: { type: 'array', items: { type: 'string' } }, failureModes: { type: 'array', items: { type: 'string' } },
    adjustedConfidence: { type: 'string' }, verdict: { type: 'string' },
  }, required: ['id', 'survives', 'verdict'],
}
const AUTHOR_SCHEMA = { type: 'object', properties: { path: { type: 'string' }, summary: { type: 'string' } }, required: ['path', 'summary'] }
const REVIEW_SCHEMA = {
  type: 'object', properties: {
    approved: { type: 'boolean' }, voicePass: { type: 'boolean' }, completenessPass: { type: 'boolean' },
    gaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
  }, required: ['approved', 'gaps'],
}

// =================================================================
// PHASE 1 — FOUNDATION (resolve ascendancies first, then fan out)
// =================================================================
phase('Foundation')

// Resolve the target class's ascendancy roster from authoritative sources (no fabrication).
if (CLASS_SCOPED && (!ASCENDANCIES || !ASCENDANCIES.length)) {
  const r = await agent(
    `CWD = poe2 workspace. Đọc ${PATCH} (đặc biệt section "Ascendancy Changes") + grep/read data/wiki/ (vd ${CLS}.md, Ascendancy.md) để liệt kê ĐẦY ĐỦ các Ascendancy class của class **${CLS}** trong POE2 0.5 "Return of the Ancients". Bao gồm cả ascendancy MỚI 0.5 (Spirit Walker cho Huntress, Martial Artist cho Monk). KHÔNG bịa — chỉ liệt kê ascendancy có thật, kèm source (file đã đọc). Trả: class, ascendancies (mảng tên chính xác tiếng Anh), source.`,
    { label: `resolve-ascendancies:${CLS}`, phase: 'Foundation', schema: ASC_SCHEMA }
  )
  ASCENDANCIES = (r.ascendancies || []).filter(Boolean)
  log(`Resolved ${CLS} ascendancies: ${ASCENDANCIES.join(', ') || '(none found — running class-only)'}`)
}
ASCENDANCIES = ASCENDANCIES || []

// ascendancy normalizer — distinctive token (longest word) per canonical name
function makeAscKey(list) {
  const map = list.map(a => ({
    canon: a,
    token: (a.toLowerCase().split(/\s+/).sort((x, y) => y.length - x.length)[0] || a.toLowerCase()),
  }))
  return function (a) {
    const s = (a || '').toLowerCase()
    for (const m of map) { if (m.token && s.includes(m.token)) return m.canon }
    return a || 'Unknown'
  }
}
const ascKey = makeAscKey(ASCENDANCIES)
function inScope(b) {
  if (!CLASS_SCOPED) return true
  if (((b.class || '') + '').toLowerCase().includes(CLS.toLowerCase())) return true
  return ASCENDANCIES.includes(ascKey(b.ascendancy))
}

// ---------------- shared context (depends on resolved scope) ----------------
const ascList = ASCENDANCIES.join(', ')
const SCOPE = CLASS_SCOPED ? [
  `SCOPE CỨNG — CHỈ NGHIÊN CỨU BUILD CLASS = ${CLS}.` + (ascList ? ` ${CLS} trong 0.5 có các ascendancy: ${ascList}. KHÔNG giới hạn ở ascendancy nào — cân nhắc đủ tất cả, tìm cái mạnh+mượt nhất bất kể ascendancy.` : ''),
  `${CLS} là MỘT class riêng. Gặp build của class KHÁC (không phải ${CLS}) → BỎ QUA, không đưa vào candidate. Cẩn thận các class dễ nhầm (caster vs caster, attacker vs attacker) — chỉ build ${CLS} mới tính.`,
  `Mọi candidate, mọi điểm số, winner cuối cùng PHẢI là build ${CLS}. Một harvest không tìm thấy build ${CLS} → trả builds:[] + notes, KHÔNG độn class khác cho đủ số.`,
].join('\n') : 'SCOPE: nghiên cứu MỌI class POE2 0.5 — tìm build mạnh+mượt+dễ trúng nhất bất kể class/ascendancy.'

const RULES = [
  SCOPE,
  'CWD = poe2 workspace. Patch notes verbatim: ' + PATCH + '. Wiki mirror: data/wiki/. Existing drafts: content/builds/<class>/. Mechanics notes: content/guides/.',
  'POE2 0.5.0 "Return of the Ancients" / Runes of Aldur là LEAGUE-START context (pre/early-league). Chưa có poe.ninja 0.5 data ổn định → mọi build phần lớn là theorycraft (label LOW/MEDIUM trung thực).',
  'Evidence over assertion: quote patch-note wording, wiki numbers, creator claims kèm source URL/handle. KHÔNG bịa skill/item/passive/ascendancy — không chắc thì nói rõ.',
  'Game terms giữ tiếng Anh (skill gems, supports, uniques, ascendancies, classes).',
].join('\n')

const focusNoun = CLASS_SCOPED ? CLS : 'build'
const cTag = CLASS_SCOPED ? CLS + ' ' : ''
const ascGroupClause = (CLASS_SCOPED && ascList)
  ? `NHÓM THEO các ascendancy của ${CLS} (${ascList}) + nhóm chung (mọi ${CLS} dùng được).`
  : 'nhóm theo build archetype (minion/companion/attack/spell/dot...).'
const draftScope = CLASS_SCOPED ? `content/builds/${CLASS_FOLDER}/` : 'content/builds/ (mọi class)'

const CREATORS = [
  { h: 'Mathil', angle: 'off-meta high-ceiling / weird strong builds' },
  { h: 'Zizaran (Ziz)', angle: 'league-start tier list + beginner-safe starters' },
  { h: 'Ben (Ben_ / CarnApparel)', angle: 'min-max meta + boss-killer theorycraft' },
  { h: 'Goratha', angle: 'currency-efficient farmer starters' },
  { h: 'Fubgun', angle: 'fast clear / mapper builds' },
  { h: 'Palsteron', angle: 'tanky budget / hardcore-viable builds' },
  { h: 'Ghazzy', angle: 'minion / summoner specialist (easy-to-hit auto builds)' },
  { h: 'CaptainLance9', angle: 'companion / beast tamer specialist (Spirit Walker zoo, beast hunt)' },
  { h: 'Subtractem', angle: 'smooth all-rounder league starters' },
  { h: 'Tytykiller (Ty / TyTy)', angle: 'theorycraft + class tier ranking' },
  { h: 'Jungroan (Jung)', angle: 'deep theorycraft / scaling math' },
  { h: 'Grimro', angle: 'mechanics-first build breakdowns' },
  { h: 'Moxsy', angle: 'beginner-friendly one-button builds' },
]
const COMMUNITY = [
  { label: 'reddit-poe2', q: `r/PathOfExile2 best 0.5 Runes of Aldur ${cTag}league starter build discussion` },
  { label: 'reddit-poe2builds', q: `r/PoE2Builds top theorycraft 0.5 ${cTag}builds, what to play day 1` },
  { label: 'ggg-forum', q: `pathofexile.com forum PoE2 0.5 ${cTag}build discussion Runes of Aldur feedback` },
  { label: 'tier-lists', q: `POE2 0.5 league starter tier list maxroll mobalytics icy-veins best ${CLASS_SCOPED ? CLS + ' ascendancy' : 'class ascendancy'}` },
  { label: 'op-broken', q: `POE2 0.5 broken overpowered ${cTag}build, what got buffed, abusing new mechanics` },
  { label: 'mechanic-abuse', q: `POE2 0.5 ${cTag}builds abusing Kalguuran skills, Lineage supports, Minion Splash, Runic Ward, Ancient Runes, Runeforging` },
]
// First-principles finders — a search modality the consensus harvest is blind to. Pre-league creator content
// is thin, so derive the strongest build PER MECHANISM straight from the patch (build-priority: mechanics > hype).
const MECHANISM = [
  { label: 'buff-abuse', q: `Cho MỖI buff vector / power outlier mạnh nhất của 0.5 (Minion Splash/Splash II, 23 Kalguuran skills + 7 supports, 23 Lineage supports, Runic Ward, Verisium Runeforging gear, 13 Ancient Runes, unique mới), DERIVE từ first-principles một build${CLASS_SCOPED ? ` ${CLS}` : ''} khai thác nó TỐI ĐA — kể cả build CHƯA creator nào post.` },
  { label: 'asc-power', q: `Cho MỖI ascendancy${CLASS_SCOPED && ascList ? ` của ${CLS} (${ascList})` : ' (mọi class)'}, archetype 0.5 MẠNH NHẤT của nó là gì dựa trên node changes ở patch — derive thuần từ cơ chế, không cần consensus.` },
]

const [buffMap, draftInv, mechScan, powerOutliers] = await parallel([
  () => agent(`${RULES}\n\nĐọc ${PATCH} đầy đủ. Trích xuất BẢN ĐỒ "BUFF VECTOR" của 0.5${CLASS_SCOPED ? ` RIÊNG CHO ${CLS}` : ''} — các cơ chế MỚI/được buff mà một build${CLASS_SCOPED ? ` ${CLS}` : ''} có thể hưởng để mạnh/mượt hơn, ${ascGroupClause} Cho mỗi vector: tên, nó cho gì, ascendancy/archetype nào hưởng nhiều nhất. Bao trùm: Runic Ward (defense mới), Verisium Runeforging (gear path), Remnant + Runic Recipe + 13 Alloy + 13 Ancient Runes (crafting), 23 Kalguuran skills + 7 Kalguuran supports, 23 Lineage supports, Minion Splash / Minion Splash II, các unique mới quan trọng (Mageblood, The Hollow Mask, The Auspex, Sylvan's Effigy, The Unborn Lich...), 2 ascendancy mới (Spirit Walker, Martial Artist). Trả text có cấu trúc, dày dữ kiện.`, { label: 'buff-vector-map', phase: 'Foundation' }),
  () => agent(`${RULES}\n\nLiệt kê mọi build draft 0.5 đã tồn tại trong ${draftScope} (đọc frontmatter + intro mỗi file bắt đầu bằng "0-5-" hoặc có patch 0.5.0). Cho mỗi cái: file path, class, ascendancy, main skill, thesis 1 câu, trạng thái (đầy đủ hay sơ sài). Mục tiêu: biết cái gì đã cover để khỏi trùng + tái dùng research; nếu winner trùng một draft, ta cải thiện file đó thay vì tạo mới. Trả text.`, { label: 'draft-inventory', phase: 'Foundation' }),
  () => agent(`${RULES}\n\nĐọc các file trong content/guides/ liên quan 0.5${CLASS_SCOPED ? ` + ${CLS}` : ''} (return-of-the-ancients.md, spirit-walker-companion-beast-hunt.md, energy-shield-recovery.md, armour-defensive-scaling.md, infernal-legion-ignite-loop.md, twister.md, các file trong items/ và leagues/). Tóm tắt mỗi cơ chế đã nghiên cứu kỹ + con số quan trọng + interaction đáng chú ý${CLASS_SCOPED ? ` cho build ${CLS}` : ''}. Đây là tri thức nền build có thể khai thác. Trả text súc tích.`, { label: 'mechanic-scan', phase: 'Foundation' }),
  () => agent(`${RULES}\n\nĐọc các section "Ascendancy Changes"${CLASS_SCOPED && ascList ? ` (đặc biệt ${ascList})` : ''}, "Skill Changes", "Support Changes", "Unique Item Changes", "Passive Tree Changes", "Player Changes" trong ${PATCH}. Xác định OUTLIER POWER${CLASS_SCOPED ? ` CHO ${CLS}` : ''}: cái gì buff mạnh, cái gì mới rõ ràng overpowered, combo nào lộ ra. Tập trung thứ giúp build "mạnh + mượt + dễ trúng". Trả danh sách xếp hạng theo impact, mỗi mục kèm patch-note wording ngắn${CLASS_SCOPED ? ' + ascendancy liên quan' : ''}.`, { label: 'power-outliers', phase: 'Foundation' }),
])
const FOUNDATION = `# BUFF VECTOR MAP${CLASS_SCOPED ? ' (' + CLS + ', per ascendancy)' : ''}\n${buffMap}\n\n# EXISTING DRAFTS\n${draftInv}\n\n# MECHANIC KNOWLEDGE\n${mechScan}\n\n# POWER OUTLIERS\n${powerOutliers}`
log(`Foundation done — buff-vector map + power outliers ready${CLASS_SCOPED ? ' for ' + CLS : ''}`)

// =================================================================
// PHASE 2 + 3 — HARVEST (creators + community, all parallel, barrier into synthesis)
// =================================================================
phase('Creator Harvest')
const harvestThunks = CREATORS.map(c => () => agent(
  `${RULES}\n\nBẠN nghiên cứu content creator **${c.h}** cho POE2 0.5 (góc: ${c.angle}).\n\nNHIỆM VỤ: tìm content ${focusNoun} MỚI NHẤT của ${c.h} cho 0.5 "Return of the Ancients" / Runes of Aldur và trích từng build cụ thể.${CLASS_SCOPED ? ` CHỈ build ${CLS} — nếu ${c.h} chủ yếu làm class khác, vẫn chỉ lấy phần ${CLS} (nếu có).` : ''}\n\nCÁCH LÀM (dùng mọi công cụ):\n- yt-dlp (PHẢI current — nếu 429 / bot-wall "Sign in to confirm" / "Only images" / "n challenge no solutions" thì 'python3 -m pip install -U yt-dlp' rồi retry; MỌI lệnh thêm '--cookies-from-browser chrome --remote-components ejs:github'). Tìm video: \`yt-dlp --cookies-from-browser chrome --remote-components ejs:github 'ytsearch6:${c.h} PoE2 0.5 ${cTag}build league starter Return of the Ancients' --flat-playlist --dump-json\` (lấy id+title+url).\n- Lấy transcript: \`yt-dlp --cookies-from-browser chrome --remote-components ejs:github --skip-download --write-auto-subs --sub-lang 'en.*' --sub-format vtt -o '/tmp/yt-%(id)s' 'URL'\` → clean .vtt (strip '<...>' + dedupe dòng) đọc. Fail → WebSearch + WebFetch.\n- Bổ sung WebSearch: "${c.h} POE2 0.5 ${cTag}build", maxroll/mobalytics nếu có.\n- Không thấy content 0.5 phù hợp của ${c.h} → trả builds:[] + notes lý do. KHÔNG bịa${CLASS_SCOPED ? ', KHÔNG độn class khác' : ''}.\n\nVới mỗi build: name, class, ascendancy, mainSkill, damageType, playstyle, defenseLayers, buffVectorsUsed (cơ chế 0.5 nào dùng — đối chiếu BUFF VECTOR MAP dưới), difficulty, gearDependency, thesis (tại sao mạnh/mượt), strengths, weaknesses, source (URL/handle), confidence.\n\n=== FOUNDATION CONTEXT ===\n${FOUNDATION}`,
  { label: `creator:${c.h.split(' ')[0]}`, phase: 'Creator Harvest', schema: HARVEST_SCHEMA }
))

phase('Community Harvest')
const communityThunks = COMMUNITY.map(cm => () => agent(
  `${RULES}\n\nBẠN harvest cộng đồng — góc "${cm.label}". Truy vấn: ${cm.q}.\n\nDùng WebSearch + WebFetch (reddit.com, old.reddit.com, pathofexile.com/forum, maxroll.gg, mobalytics.gg, poe2db, youtube). Tìm các build${CLASS_SCOPED ? ` ${CLS}` : ''} được nhắc/đề cử nhiều nhất cho 0.5 league start, đặc biệt cái mạnh/mượt/dễ chơi/dễ trúng hoặc "broken". Ghi MỨC ĐỒNG THUẬN (bao nhiêu nguồn nhắc cùng 1 build).\n\nVới mỗi build: name, class, ascendancy, mainSkill, damageType, playstyle, defenseLayers, buffVectorsUsed, difficulty, gearDependency, thesis, strengths, weaknesses, source, confidence.${CLASS_SCOPED ? ` CHỈ ${CLS} — không thấy thì builds:[] + notes. KHÔNG độn class khác.` : ' Không bịa — không thấy thì builds:[] + notes.'}\n\n=== FOUNDATION CONTEXT ===\n${FOUNDATION}`,
  { label: `community:${cm.label}`, phase: 'Community Harvest', schema: HARVEST_SCHEMA }
))

phase('Mechanism Sweep')
const mechanismThunks = MECHANISM.map(m => () => agent(
  `${RULES}\n\nBẠN là FIRST-PRINCIPLES build deriver — KHÔNG dựa consensus/hype, chỉ dựa cơ chế 0.5. Nhiệm vụ: ${m.q}\n\nĐối chiếu BUFF VECTOR MAP + POWER OUTLIERS dưới. Mỗi build derive được: name, class, ascendancy, mainSkill, damageType, playstyle, defenseLayers, buffVectorsUsed (vector nào build abuse), difficulty, gearDependency, thesis (CHUỖI NHÂN cơ chế cụ thể làm nó mạnh), strengths, weaknesses, source ("first-principles: ${m.label}"), confidence (trung thực — theorycraft → LOW/MEDIUM).${CLASS_SCOPED ? ` CHỈ ${CLS}.` : ''} Mục tiêu: build MẠNH NHẤT về cơ chế kể cả chưa ai chơi.\n\n=== FOUNDATION CONTEXT ===\n${FOUNDATION}`,
  { label: `mechanism:${m.label}`, phase: 'Mechanism Sweep', schema: HARVEST_SCHEMA }
))

const harvestRaw = await parallel([...harvestThunks, ...communityThunks, ...mechanismThunks])
const harvestResults = harvestRaw.filter(Boolean)
const allBuilds = harvestResults.flatMap(r => (r.builds || [])).filter(inScope)
const emptySrc = harvestResults.filter(r => !(r.builds && r.builds.length)).length
log(`Harvest: ${harvestResults.length}/${harvestRaw.length} sources returned (${harvestRaw.length - harvestResults.length} dropped/errored, ${emptySrc} empty) → ${allBuilds.length} raw ${CLASS_SCOPED ? CLS + '-scoped ' : ''}build mentions`)

// =================================================================
// PHASE 4 — SYNTHESIS (barrier: needs all harvest)
// =================================================================
phase('Synthesis')
const synth = await agent(
  `${RULES}\n\nĐây là TOÀN BỘ build mention thu được (JSON). Hãy DEDUP + NORMALIZE thành danh sách candidate sạch${CLASS_SCOPED ? ` — CHỈ ${CLS}` : ''}.\n\n- Gộp mention cùng build (cùng class+ascendancy+mainSkill, hoặc tên đồng nghĩa) thành 1 candidate; consensusCount = số nguồn độc lập.\n- Mỗi candidate: id (kebab ngắn), name, class, ascendancy, mainSkill, damageType, playstyle, defenseSummary, buffVectorsUsed (hợp nhất), consensusCount, sources (gộp URL), thesis, knownStrengths, knownWeaknesses.\n${CLASS_SCOPED ? `- LOẠI mọi thứ không phải ${CLS} lọt vào.\n` : ''}- Giữ TẤT CẢ candidate hợp lệ (kể cả ít đồng thuận nhưng cơ chế mạnh) nhưng loại trùng/nhiễu.\n- Sắp xếp theo consensusCount giảm dần.\n\n=== RAW BUILDS JSON ===\n${JSON.stringify(allBuilds).slice(0, 60000)}`,
  { label: 'dedup-normalize', phase: 'Synthesis', schema: SYNTH_SCHEMA }
)
let candidates = (synth.candidates || []).filter(inScope)

// completeness critic — adds any obviously strong build harvest missed (per ascendancy when scoped)
const critic = await agent(
  `${RULES}\n\nĐây là danh sách candidate đã dedup. Hỏi: 0.5 còn build${CLASS_SCOPED ? ` ${CLS}` : '/archetype'} nào RÕ RÀNG MẠNH mà danh sách BỎ SÓT không${CLASS_SCOPED && ascList ? ` — KIỂM ĐỦ CẢ các ascendancy (${ascList})` : ''}? Đối chiếu BUFF VECTOR MAP + POWER OUTLIERS + EXISTING DRAFTS.${CLASS_SCOPED && ascList ? ` Nếu một ascendancy đang vắng mặt nhưng CÓ archetype mạnh hiển nhiên, THÊM nó.` : ''} Chỉ thêm cái thật sự đáng cân nhắc cho "mạnh+mượt+dễ trúng" league start. Trả candidates BỔ SUNG (cùng schema${CLASS_SCOPED ? `, class="${CLS}"` : ''}). Không thiếu → candidates:[].\n\n=== HIỆN CÓ ===\n${JSON.stringify(candidates.map(c => c.name + ' (' + c.class + '/' + c.ascendancy + '/' + c.mainSkill + ')'))}\n\n=== FOUNDATION ===\n${FOUNDATION.slice(0, 22000)}`,
  { label: 'completeness-critic', phase: 'Synthesis', schema: SYNTH_SCHEMA }
)
candidates = candidates.concat((critic.candidates || []).filter(inScope))
candidates.sort((a, b) => (b.consensusCount || 0) - (a.consensusCount || 0))

// take top by consensus; when class-scoped, GUARANTEE each ascendancy's best candidate is included
let top = candidates.slice(0, Math.min(TOPN_CAP, candidates.length))
if (CLASS_SCOPED && ASCENDANCIES.length) {
  for (const k of ASCENDANCIES) {
    if (!top.some(c => ascKey(c.ascendancy) === k)) {
      const best = candidates.find(c => ascKey(c.ascendancy) === k)
      if (best) top.push(best)
    }
  }
  top = top.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
}
log(`Synthesis done — ${candidates.length} candidates, evaluating ${top.length}${CLASS_SCOPED ? ' (ascendancy-balanced)' : ''}: ${top.map(c => c.name + (CLASS_SCOPED ? '[' + ascKey(c.ascendancy) + ']' : '')).join(', ')}`)

// =================================================================
// PHASE 5 + 6 — VERIFY then SCORE (pipeline per candidate, no barrier)
// =================================================================
function weighted(s) {
  return W.smoothness * s.smoothness + W.strength * s.strength + W.buffStack * s.buffStack
    + W.easyPlay * s.easyPlay + W.easyHit * s.easyHit + W.leagueStartFloor * s.leagueStartFloor
    + W.tankiness * s.tankiness + W.patchRisk * s.patchRisk
}
// three distinct verify lenses — diversity catches failure modes redundant skeptics share (§2b).
// each agent fills only its lens fields; the .then() merges them into one verify object in plain JS.
const VERIFY_LENSES = [
  { lens: 'existence', q: 'KIỂM TỒN TẠI VERBATIM: mọi skill/support/unique/ascendancy node build dùng có THẬT + đúng wording 0.5 trong patch (' + PATCH + ') / wiki (data/wiki/ grep+read) / poedb không? Bịa = redFlag. SOURCE CONFLICT: nếu patch vs poedb vs wiki mâu thuẫn (level, magnitude, drop source — vd unique drop-restricted vs buy-early) thì GHI vào sourceConflicts kèm nguồn nào THẮNG theo hierarchy (patch > poedb > wiki). Set exists + pobCoverage (PoB2 fork model đủ chưa? league-mới mechanic → PARTIAL/NA).' },
  { lens: 'synergy-exclusion', q: 'KIỂM EXCLUSION + BREAKPOINT: keystone khoá crit/life, more-multiplier cùng class chỉ nhân 1 lần, ascendancy lock, CI vs Blood Magic / life-cost vs ES, spirit reservation gating; breakpoint res cap / minion cap / attack-cast speed / ES recharge delay. Combo có bị một clause chặn ngầm khiến thực tế yếu hơn paper không? Set exclusions + breakpoints.' },
  { lens: 'load-bearing', q: 'XÁC ĐỊNH GIẢ ĐỊNH CHỊU LỰC: claim DUY NHẤT mà TOÀN BỘ thesis dựa vào (vd "Minion Splash áp dụng lên native attack của tamed beast", "X% more thật sự apply lên skill này"). Nó VERIFIED (patch/wiki có số xác nhận), THEORYCRAFT (cơ chế hợp lý nhưng chưa có số / chưa test được pre-league), hay FALSE (nguồn bác bỏ)? Nếu nó sai thì build có sụp toàn bộ thesis không? Set loadBearingAssumption + loadBearingStatus.' },
]
const scored = await pipeline(
  top,
  (c) => parallel(VERIFY_LENSES.map(L => () => agent(
    `${RULES}\n\nVERIFY candidate "${c.name}" (${c.class}/${c.ascendancy}, main: ${c.mainSkill}) — LENS = ${L.lens}.\nThesis: ${c.thesis}\nbuffVectors: ${(c.buffVectorsUsed || []).join(', ')}\n\nCHỈ làm phần lens của bạn (field khác để trống): ${L.q}\n\nTrả: id="${c.id}", lens="${L.lens}", các field thuộc lens + note 1-2 câu + redFlags nếu có.`,
    { label: `verify:${c.id}:${L.lens}`, phase: 'Mechanic Verify', schema: VERIFY_LENS_SCHEMA }
  ))).then(lensesRaw => {
    const ls = lensesRaw.filter(Boolean)
    const ex = ls.find(x => x.lens === 'existence') || {}
    const sx = ls.find(x => x.lens === 'synergy-exclusion') || {}
    const lb = ls.find(x => x.lens === 'load-bearing') || {}
    const confs = ls.map(x => x.confidence).filter(Boolean)
    const conf = confs.includes('LOW') ? 'LOW' : (confs.includes('MEDIUM') ? 'MEDIUM' : (confs[0] || 'MEDIUM'))
    const verify = {
      id: c.id,
      mechanicVerified: ex.exists !== false && lb.loadBearingStatus !== 'FALSE',
      claimsChecked: ls.flatMap(x => x.claimsChecked || []),
      sourceConflicts: ls.flatMap(x => x.sourceConflicts || []),
      exclusions: sx.exclusions || '', breakpoints: sx.breakpoints || '',
      loadBearingAssumption: lb.loadBearingAssumption || '(chưa xác định — treat as THEORYCRAFT)',
      loadBearingStatus: lb.loadBearingStatus || 'THEORYCRAFT',
      pobCoverage: ex.pobCoverage || 'PARTIAL',
      verifiedThesis: c.thesis,
      redFlags: ls.flatMap(x => x.redFlags || []),
      confidence: conf,
      lensNotes: ls.map(x => x.lens + ': ' + (x.note || '')),
    }
    return { candidate: c, verify }
  }),
  (vr) => agent(
    `${RULES}\n\nCHẤM ĐIỂM candidate "${vr.candidate.name}" (${vr.candidate.class}/${vr.candidate.ascendancy}) theo 8 trục, thang 0-10 (10 tốt nhất; patchRisk: 10 = RẤT rủi ro bị nerf).\nDựa trên verifiedThesis + redFlags + buff vectors + kiến thức league-start 0.5.\n\n- smoothness: clear speed + QoL + ít downtime\n- strength: trần DPS / boss-kill\n- buffStack: build hưởng BAO NHIÊU cơ chế buff 0.5 (Kalguuran skill/support, Lineage support, Minion Splash, Runic Ward, Runeforging gear, Ancient Runes...) — đếm thực tế\n- easyPlay: APM thấp, ít combo, tha lỗi\n- easyHit: damage tự trúng — minion/companion/DoT/homing/AoE lớn > skillshot cần aim\n- leagueStartFloor: chạy được với gear rác / self-found ngày 1\n- tankiness: EHP + lớp phòng thủ (gồm Runic Ward) sống sót\n- patchRisk: phụ thuộc 1 cơ chế dễ bị nerf / chưa chắc tồn tại\nTrả schema với id="${vr.candidate.id}" + rationale ngắn.\n\n=== VERIFY ===\n${JSON.stringify(vr.verify)}`,
    { label: `score:${vr.candidate.id}`, phase: 'Scoring', schema: SCORE_SCHEMA }
  ).then(s => ({ ...vr, score: s, total: weighted(s) }))
)
const ranked = scored.filter(Boolean).sort((a, b) => b.total - a.total)
log(`Scored ${ranked.length} candidates. Ranking: ${ranked.map(r => r.candidate.name + (CLASS_SCOPED ? '[' + ascKey(r.candidate.ascendancy) + ']' : '') + '=' + r.total.toFixed(1)).join(' | ')}`)

// =================================================================
// PHASE 7 — ADVERSARIAL (top 3 finalists × 2 diverse-lens skeptics each)
// =================================================================
phase('Adversarial')
const finalists = ranked.slice(0, Math.min(3, ranked.length))
// two DISTINCT lenses, not two identical refuters — diversity catches blind spots redundancy shares (§2b).
const SKEPTIC_LENSES = [
  { key: 'league-start-reality', focus: 'leveling khổ / ascendancy + spirit-mana gating, gear-currency floor thực tế CAO hơn quảng cáo, self-found ngày 1 có chạy không, APM + clear-reliability thực chiến, hype-chasing (creator nói hay nhưng thực chiến đuối).' },
  { key: 'mechanic-fragility', focus: 'LOAD-BEARING ASSUMPTION có thật hoạt động ngày 1 không (xem load-bearing dưới — nếu THEORYCRAFT/FALSE thì cả thesis lung lay), exclusion bị bỏ sót, patch nerf-bait, PoB2 coverage gap khiến số DPS/EHP là fiction, one-shot encounter / boss pattern giết bất chấp EHP, map mod hostile.' },
]
const advResults = (await parallel(finalists.flatMap(f => SKEPTIC_LENSES.map(L => () => agent(
  `${RULES}\n\nBẠN là SKEPTIC — LENS = ${L.key}. Cố BÁC BỎ rằng "${f.candidate.name}" (${f.candidate.class}/${f.candidate.ascendancy}, ${f.candidate.mainSkill}) là best league-start build 0.5${CLASS_SCOPED ? ' cho ' + CLS : ''}. Mặc định hoài nghi; chỉ tha nếu thật sự sống sót đòn của lens bạn.\n\nTẤN CÔNG theo lens: ${L.focus}\n\nTrả: id="${f.candidate.id}", survives (true nếu vẫn xứng top sau đòn lens bạn), severity, killFactors, failureModes, adjustedConfidence (HIGH/MEDIUM/LOW), verdict.\n\n=== HỒ SƠ ===\nthesis: ${f.candidate.thesis}\nload-bearing: ${f.verify.loadBearingAssumption} [${f.verify.loadBearingStatus}]\nscore: ${JSON.stringify(f.score)}\nverify: ${JSON.stringify(f.verify)}`,
  { label: `skeptic:${L.key}:${f.candidate.id}`, phase: 'Adversarial', schema: ADV_SCHEMA }
))))).filter(Boolean)

// aggregate adversarial per finalist
const advBy = {}
for (const a of advResults) { (advBy[a.id] = advBy[a.id] || []).push(a) }
const finalScored = finalists.map(f => {
  const votes = advBy[f.candidate.id] || []
  const killed = votes.length > 0 && votes.every(v => v.survives === false)
  const failureModes = votes.flatMap(v => v.failureModes || [])
  const killFactors = votes.flatMap(v => v.killFactors || [])
  const conf = votes.map(v => v.adjustedConfidence).filter(Boolean)
  return { ...f, killed, failureModes, killFactors, advVerdicts: votes, adjustedConfidence: conf.includes('LOW') ? 'LOW' : (conf.includes('MEDIUM') ? 'MEDIUM' : (conf[0] || 'MEDIUM')) }
})
// winner: prefer survivors, else least-bad; tie-break by weighted total
const survivors = finalScored.filter(f => !f.killed)
const pool = survivors.length ? survivors : finalScored
pool.sort((a, b) => b.total - a.total)
const winner = pool[0]
// pre-league honesty: a build whose keystone claim is unverified can't earn HIGH — cap by load-bearing status.
const lbStatus = winner.verify.loadBearingStatus || 'THEORYCRAFT'
if (lbStatus === 'FALSE') winner.adjustedConfidence = 'LOW'
else if (lbStatus === 'THEORYCRAFT' && winner.adjustedConfidence === 'HIGH') winner.adjustedConfidence = 'MEDIUM'
log(`WINNER: ${winner.candidate.name} (${winner.candidate.class}/${ascKey(winner.candidate.ascendancy)}) total=${winner.total.toFixed(1)} conf=${winner.adjustedConfidence} (load-bearing ${lbStatus}) survivors=${survivors.length}/${finalScored.length}`)

const WINNER_BRIEF = `# WINNER: ${winner.candidate.name}\nclass=${winner.candidate.class} ascendancy=${winner.candidate.ascendancy} mainSkill=${winner.candidate.mainSkill} damageType=${winner.candidate.damageType} playstyle=${winner.candidate.playstyle}\nthesis: ${winner.candidate.thesis}\nbuffVectors: ${(winner.candidate.buffVectorsUsed || []).join(', ')}\ndefense: ${winner.candidate.defenseSummary}\nsources: ${(winner.candidate.sources || []).join(' ')}\nLOAD-BEARING ASSUMPTION (PHẢI thành Failure Mode #1 + Day-1 test #1): ${winner.verify.loadBearingAssumption} [${lbStatus}]\nSOURCE CONFLICTS (ghi rõ trong note, đừng giấu): ${JSON.stringify(winner.verify.sourceConflicts || [])}\nSCORE: ${JSON.stringify(winner.score)}\nVERIFY: ${JSON.stringify(winner.verify)}\nFAILURE MODES (from skeptics): ${JSON.stringify(winner.failureModes)}\nKILL FACTORS: ${JSON.stringify(winner.killFactors)}\nconfidence: ${winner.adjustedConfidence} pobCoverage: ${winner.verify.pobCoverage}\n\n=== FOUNDATION (buff vectors etc.) ===\n${FOUNDATION}`

// ENRICH — graft verified runner-up tech into the winner so the deliverable isn't bound to one harvest's blind spots (§2c judge-panel).
phase('Enrich')
const enrich = await agent(
  `${RULES}\n\nWINNER đã chọn. Nhiệm vụ: GRAFT — lấy ý tưởng/tech ĐÃ VERIFY từ các finalist/candidate KHÁC có thể làm WINNER mạnh/mượt hơn MÀ KHÔNG đổi core identity (giữ nguyên mainSkill + ascendancy + defense base). Vd: gear tech, leveling pivot, defense layer, support gem, atlas / league-mechanic interaction từ runner-up.\n\nChỉ graft cái CÓ cơ sở cơ chế (đối chiếu FOUNDATION trong brief) — KHÔNG nhồi ý tưởng mâu thuẫn với core. Mỗi graft 1 dòng: ý tưởng + cải thiện gì + nguồn candidate. Không có gì đáng graft thì nói rõ. Trả text súc tích.\n\n${WINNER_BRIEF}\n\n=== FINALIST KHÁC ===\n${JSON.stringify(finalScored.filter(f => f.candidate.id !== winner.candidate.id).map(f => ({ name: f.candidate.name, asc: ascKey(f.candidate.ascendancy), mainSkill: f.candidate.mainSkill, strengths: f.candidate.knownStrengths, verifiedThesis: f.verify.verifiedThesis })))}\n=== TOP CANDIDATE POOL ===\n${JSON.stringify(ranked.slice(0, 8).map(r => ({ name: r.candidate.name, asc: ascKey(r.candidate.ascendancy), skill: r.candidate.mainSkill, strengths: r.candidate.knownStrengths })))}`,
  { label: 'graft-enrich', phase: 'Enrich' }
)
const ENRICHED_BRIEF = `${WINNER_BRIEF}\n\n=== ENRICHMENT (graft từ runner-up, đã verify — tích hợp vào gear/leveling/defense, KHÔNG đổi core) ===\n${enrich}`
log('Enrichment graft done')

// =================================================================
// PHASE 8 — DEEP DIVE (fan-out winner research)
// =================================================================
phase('Deep Dive')
const SECTIONS = [
  { key: 'leveling', q: 'Leveling act 1 → endgame: skill chính từng act, gem swap, breakpoint gear, lúc nào pivot sang main skill (build thường dùng skill khởi đầu khác main — ghi rõ). Cụ thể, theo thứ tự.' },
  { key: 'skill-links', q: 'Endgame skill setup: main 6-link (skill + 5 support, mỗi support 1 câu why interaction), aura/herald/buff, movement, utility/curse/totem/minion-command. Ưu tiên support 0.5 nếu hợp (Kalguuran/Lineage/Minion Splash/Commanding Rage).' },
  { key: 'ascendancy', q: 'Ascendancy: vì sao chọn ascendancy này cho build, thứ tự lấy điểm ascendancy (Lab1→2→3→4) + lý do từng node, đặc biệt node thay đổi ở 0.5. So sánh ngắn vì sao hơn các ascendancy còn lại của class cho build này.' },
  { key: 'passive-tree', q: 'Passive tree: cluster/notable chính + lý do scale, đường đi quan trọng, Atlas tree 0.5 lưu ý. Mastery nếu có. Class start area + wheels liên quan (life/ES/chaos/minion/crit...).' },
  { key: 'gear', q: 'Gear progression theo tier: Leveling / Early Mapping / Endgame / BiS. Mỗi tier base + key mod + lý do. Unique 0.5 nào dùng (Mageblood / The Unborn Lich / Sylvan\'s Effigy / The Hollow Mask / The Auspex... nếu hợp). Stat priority + requirement (attribute, spirit) — ghi rõ stat gating của class.' },
  { key: 'defense', q: 'Defense layering chi tiết: thứ tự lớp (armour→evasion→block→res cap→ES/Life→Runic Ward→recovery), tích hợp Runic Ward (defense mới 0.5), EHP mục tiêu, flask + charm setup, cap resistance. Ghi rõ defense base của build (ES/Life/hybrid).' },
  { key: 'league-mechanic', q: 'Tương tác league Runes of Aldur: Remnant + Runic Recipe craft gear cho build, Verisium Runeforging (Runic Ward / upgrade unique), Ancient Rune cho weapon type của build, Kalguuran skill/support nào craft được mà build muốn, Ocean Exploring/Pinnacle có dễ với build không.' },
  { key: 'budget-risk', q: 'Budget & investment curve: min để chạy (self-found ngày 1) → divine breakpoint → mirror tier, diminishing returns ở đâu. PLUS: Failure Modes (≥3 scenario build gãy) — FAILURE MODE #1 PHẢI là LOAD-BEARING ASSUMPTION ở WINNER BRIEF (claim mà cả thesis dựa vào), rồi thêm map mod hostile / one-shot / gear floor / patch nerf / league-start viability. Và DAY-1 LIVE TEST PLAN: log gì khi vào league để xác nhận theorycraft — TEST #1 PHẢI verify chính load-bearing assumption đó.' },
]
const deep = await parallel(SECTIONS.map(s => () => agent(
  `${RULES}\n\nDEEP-DIVE cho build WINNER. Viết phần "${s.key}" thật chi tiết, số thật khi có (đối chiếu patch/wiki/poedb — grep/read/WebSearch). Nội dung: ${s.q}\n\nGiải thích WHY (cơ chế + lý do), không chỉ liệt kê. Nguyên liệu cho người viết build guide — dày, chính xác, có wording patch khi cần. Trả text.\n\n${ENRICHED_BRIEF}`,
  { label: `deep:${s.key}`, phase: 'Deep Dive', schema: undefined }
)))
const DEEP = SECTIONS.map((s, i) => `## ${s.key}\n${deep[i] || '(thiếu)'}`).join('\n\n')
log('Deep dive done')

// =================================================================
// PHASE 9 — PoB NUMBERS (math chain)
// =================================================================
phase('PoB Numbers')
const [dpsMath, ehpMath] = await parallel([
  () => agent(`${RULES}\n\nWINNER build. Dựng DPS MATH CHAIN ước lượng (POE2): base_hit × (1+inc) × ∏(1+more_i) × pen/exposure × hit_rate × ailment/uptime (+ spirit cost / minion AI uptime nếu minion/companion build). Show từng node với giả định rõ. PoB2 fork chưa model đủ → ghi pob_coverage + giả định chưa sim. Theorycraft pre-league → label LOW/MEDIUM. Trả text.\n\n${ENRICHED_BRIEF}\n\n=== DEEP DIVE (skills/gear) ===\n${DEEP.slice(0, 25000)}`, { label: 'dps-math', phase: 'PoB Numbers' }),
  () => agent(`${RULES}\n\nWINNER build. Dựng EHP / DEFENSE estimate theo layer order POE2 0.5 (armour→evasion→block→res cap→ES/Life→Runic Ward→recovery). Ước lượng EHP, max hit mỗi damage type, Runic Ward contribution, recovery. Show pool chính (ES/Life) + recharge/recovery. Giả định rõ, label confidence. Trả text.\n\n${ENRICHED_BRIEF}\n\n=== DEEP DIVE (defense) ===\n${DEEP.slice(0, 25000)}`, { label: 'ehp-math', phase: 'PoB Numbers' }),
])
const NUMBERS = `## DPS MATH\n${dpsMath}\n\n## EHP MATH\n${ehpMath}`
log('PoB numbers done')

// =================================================================
// PHASE 10 — AUTHORING (write file + validate + reviewer loop)
// =================================================================
const AUTHOR_INSTR = `${RULES}\n\nVIẾT MỘT FILE BUILD GUIDE HOÀN CHỈNH cho WINNER vào content/builds/<class>/ — class folder = lowercase của winner.class (witch/huntress/monk/sorceress/warrior/druid/ranger/mercenary). Slug filename prefix "0-5-" + kebab mô tả build (vd 0-5-spirit-walker-companion-zoo.md). Nếu build winner TRÙNG một draft đã có (xem EXISTING DRAFTS trong FOUNDATION), GHI ĐÈ/CẢI THIỆN file đó thay vì tạo file mới trùng lặp.\n\nTRƯỚC KHI VIẾT: đọc 1-2 file build cùng class trong content/builds/<class>/ để khớp giọng + cách dùng :wiki-link + thấy frontmatter hợp lệ. Lấy NGÀY HÔM NAY bằng \`date +%F\` (Bash) — dùng cho created/updated/Changelog, KHÔNG hardcode.\n\nFRONTMATTER (đúng schema content.config.ts):\n---\ntemplate: templates/build-template.md\ndocument_type: build\ntitle: <CONCEPT, KHÔNG kèm league/patch>\nstatus: draft\nauthor: duocnv\ncreated: '<YYYY-MM-DD hôm nay>'\nupdated: '<YYYY-MM-DD hôm nay>'\nclass: <winner.class>\nascendancy: <winner.ascendancy>\nleague: '0.5'\npatch: 0.5.0\nbudget_tier: league-starter\nconfidence_level: <HIGH/MEDIUM/LOW từ adversarial>\npob_coverage: <FULL/PARTIAL/NA từ verify>\nbuild_tags:\n  primary_skill: <skill>\n  damage_type: <type>\n  playstyle: <minion/attack/spell/dot/companion...>\n  content_focus: all-content\ntags: [<class lowercase>, <ascendancy lowercase>, <skill kebab>, <archetype>, 0-5, poe2]\n---\n\nCẤU TRÚC THÂN — CHEAT-SHEET FACT-DENSE (chuẩn templates/content-style.md), KHÔNG template cứng:\nMỗi dòng carry một fact/rule dùng được; bullet tự đứng là đơn vị mặc định (fragment + "A → B" arrow OK), zero narrative, không xưng hô, không recap. Heading ngắn nói thẳng nội dung — chọn/merge/split theo build này, KHÔNG ép một bộ H2 cố định, KHÔNG pad. Body ≤ 120 dòng. validate chỉ kiểm frontmatter (sections:["*"]) — giữ ## Failure Modes literal.\n\nNHƯNG PHẢI PHỦ ĐỦ SUBSTANCE (ở bất kỳ cấu trúc heading hợp lý nào): (1) intro 2-3 câu + thesis "tại sao mạnh+mượt+dễ trúng" (không heading); (2) skill setup endgame — main skill + mỗi support kèm WHY interaction, aura/herald/buff/movement/utility; (3) ascendancy — vì sao chọn + thứ tự lấy node + node 0.5 đổi gì; (4) passive tree — cluster/notable chính + đường đi + atlas lưu ý; (5) defense layering chi tiết (armour→evasion→block→res cap→ES/Life→Runic Ward→recovery) + EHP target; (6) gear progression theo tier (leveling → early mapping → endgame → mirror) + unique 0.5 + stat/spirit gating; (7) leveling path (skill từng act + lúc pivot sang main); (8) budget & investment curve (self-found ngày 1 → divine breakpoint → diminishing returns); (9) tương tác league Runes of Aldur; (10) BẮT BUỘC heading ## Failure Modes — ≥3 scenario build gãy, FAILURE MODE #1 PHẢI là LOAD-BEARING ASSUMPTION ở WINNER BRIEF (claim cả build dựa vào) + DAY-1 LIVE TEST PLAN (log gì khi vào league để xác nhận theorycraft; test #1 verify chính load-bearing đó); (11) ## Changelog (### <hôm nay> — research-derived, pre-league theorycraft); (12) nếu brief có SOURCE CONFLICTS → ghi rõ (nguồn nào thắng + tại sao), đừng giấu.\n\nFORMAT RULES (BẮT BUỘC — cheat-sheet fact-dense, chuẩn templates/content-style.md):\n- Fact-dense, zero narrative: mỗi dòng một fact/rule; cắt câu dẫn/chuyển/recap/meta-summary ("theo Fubgun/creator nói", "bài này tổng hợp"). Không xưng hô (mình/bạn/bro).\n- Bullet tự đứng là đơn vị mặc định (đọc một mình vẫn hiểu); fragment + "A → B" arrow OK; prose chỉ khi chuỗi nhân-quả nhiều bước (tối đa 2-3 câu).\n- Giữ 100% hard facts + mỗi choice kèm WHY/cơ chế ngay trong bullet đó; số kèm nguồn/patch; DPS/EHP ≥ 100k kèm PoB link hoặc math chain (KHÔNG số trần).\n- Game term → :wiki-link{url="https://www.poe2wiki.net/wiki/Exact_Name"} (POE2 dùng poe2wiki.net, KHÔNG poewiki.net) lần đầu. Bold key term lần đầu. Table OK cho data enumerable (stat block, ratings).\n- Confidence ở frontmatter confidence_level — KHÔNG nhãn HIGH/MEDIUM/LOW trong body; pre-league theorycraft ghi rõ ở Failure Modes/Changelog là test plan.\n- Title + H1 KHÔNG kèm league/patch. Relationships link hai chiều khi có doc liên quan.\n\nDùng toàn bộ WINNER_BRIEF + DEEP DIVE + NUMBERS làm nguồn. Viết file bằng Write tool. Trả về path + summary 1 câu.`

let author = await agent(
  `${AUTHOR_INSTR}\n\n=== WINNER BRIEF ===\n${ENRICHED_BRIEF}\n\n=== DEEP DIVE ===\n${DEEP}\n\n=== NUMBERS ===\n${NUMBERS}`,
  { label: 'author-v1', phase: 'Authoring', schema: AUTHOR_SCHEMA }
)
let filePath = author.path
let review = null
for (let round = 1; round <= 3; round++) {
  review = await agent(
    `${RULES}\n\nREVIEW file build guide tại "${filePath}". Đọc file. Chấm:\n- voicePass: cheat-sheet fact-dense (mỗi dòng một fact, zero narrative/recap, không xưng hô/meta-summary), bullet tự đứng, mỗi choice kèm WHY ngay trong bullet, :wiki-link poe2wiki.net cho mọi game term lần đầu, title không kèm league, class đúng winner, body ≤ 120 dòng.\n- completenessPass: PHỦ ĐỦ SUBSTANCE (overview+thesis, skill setup + why, ascendancy + node order, passive tree, defense layering incl Runic Ward, gear progression theo tier, leveling pivot, budget curve, league interaction) bằng heading fact-dense — KHÔNG đòi đúng một bộ 13 H2 cố định/theo thứ tự (rập khuôn = FAIL); BẮT BUỘC có ## Failure Modes (≥3) với Failure Mode #1 = load-bearing assumption + Day-1 test plan; có math chain (DPS+EHP) hoặc reference; confidence ở frontmatter confidence_level; gear/tree/asc/leveling cụ thể có số; source conflicts (nếu có) ghi rõ.\n- Chạy \`bun run generate\` (Bash, từ CWD poe2 workspace) → build phải green. Nếu fail, đọc error tìm lỗi frontmatter trong file vừa viết "${filePath}" và sửa.\n- approved = voicePass && completenessPass && validate-ok.\nLiệt kê gaps cụ thể (actionable) nếu chưa đạt.`,
    { label: `review-r${round}`, phase: 'Authoring', schema: REVIEW_SCHEMA }
  )
  log(`Review r${round}: approved=${review.approved} gaps=${(review.gaps || []).length}`)
  if (review.approved) break
  if (round === 3) break
  const revise = await agent(
    `${AUTHOR_INSTR}\n\nSỬA file build guide tại "${filePath}" để khắc phục các GAP sau (giữ phần tốt, chỉ vá chỗ thiếu, đảm bảo validate pass). Dùng Read + Edit/Write. Trả path + summary.\n\n=== GAPS ===\n${JSON.stringify(review.gaps)}\nnotes: ${review.notes || ''}\n\n=== WINNER BRIEF ===\n${ENRICHED_BRIEF}\n\n=== DEEP DIVE ===\n${DEEP}\n\n=== NUMBERS ===\n${NUMBERS}`,
    { label: `revise-r${round}`, phase: 'Authoring', schema: AUTHOR_SCHEMA }
  )
  filePath = revise.path || filePath
}

return {
  scope: CLASS_SCOPED ? `${CLS} only${ascList ? ' — ascendancies: ' + ascList : ''}` : 'all classes',
  class: CLASS_SCOPED ? CLS : null,
  ascendancies: ASCENDANCIES,
  weights: W,
  winner: { name: winner.candidate.name, class: winner.candidate.class, ascendancy: winner.candidate.ascendancy, mainSkill: winner.candidate.mainSkill, total: Number(winner.total.toFixed(2)), confidence: winner.adjustedConfidence, loadBearingAssumption: winner.verify.loadBearingAssumption, loadBearingStatus: lbStatus, pobCoverage: winner.verify.pobCoverage, sourceConflicts: winner.verify.sourceConflicts || [] },
  filePath,
  approved: review ? review.approved : false,
  reviewGaps: review ? review.gaps : [],
  ranking: ranked.map(r => ({ name: r.candidate.name, class: r.candidate.class, ascendancy: ascKey(r.candidate.ascendancy), total: Number(r.total.toFixed(2)), score: r.score })),
  finalists: finalScored.map(f => ({ name: f.candidate.name, ascendancy: ascKey(f.candidate.ascendancy), killed: f.killed, confidence: f.adjustedConfidence, failureModes: f.failureModes })),
  candidateCount: candidates.length,
  rawMentions: allBuilds.length,
}
