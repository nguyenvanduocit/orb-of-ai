export const meta = {
  name: 'league-day-scan',
  description: 'Scan YouTube + Reddit + GGG forum + poe.ninja cho POE2 live-league day hiện tại — build, meta, economy intel report',
  whenToUse: 'Chạy bất kỳ ngày nào của POE2 live league để lấy pulse build/meta/economy từ creators, community, official, và data sites. Re-runnable mỗi ngày — file output stamp theo ngày nên không ghi đè.',
  phases: [
    { title: 'Harvest', detail: '6 lanes: YouTube, Reddit community, Reddit builds, GGG forum, poe.ninja builds, economy' },
    { title: 'Synthesize', detail: 'build / meta / economy synthesis từ findings đã filter theo angle' },
    { title: 'Critique', detail: 'freshness, cross-source contradiction, confidence calibration' },
    { title: 'Report', detail: 'assemble + write dated intel report' },
  ],
}

// ---- config: slug ổn định nhiều tháng; DATE stamp lúc report (date +%F), KHÔNG bake ----
const A = (typeof args !== 'undefined' && args && typeof args === 'object') ? args : {}
const LEAGUE_NAME = A.leagueName || 'Runes of Aldur (POE2 0.5.0 "Return of the Ancients")'
const NINJA_LEAGUE = A.ninjaLeague || 'runesofaldur'   // poe.ninja slug
const SCOUT_LEAGUE = A.scoutLeague || 'runes'          // poe2scout slug
const LAUNCH_DATE = A.launchDate || '2026-05-29'       // ngưỡng phân biệt post-launch vs pre-league
const OUT_DIR = A.outDir || 'tmp'

const RECENCY = `Content publish/post >= ${LAUNCH_DATE} = POST-LAUNCH (current). Cũ hơn = PRE-LEAGUE THEORYCRAFT — tag rõ, ĐỪNG trình bày như current meta. Ghi lại ngày publish/post của mỗi item.`
const WEBTOOLS = `Load web tools trước: ToolSearch('select:WebSearch,WebFetch'). Nếu WebFetch bị chặn, fallback Bash: 'markitdown <url>' hoặc 'curl -sL -A "Mozilla/5.0" <url>'.`
const REDDIT_TOOLS = `Load Reddit MCP: ToolSearch('select:mcp__reddit__browse_subreddit,mcp__reddit__search_reddit,mcp__reddit__get_post_comments,mcp__reddit__get_reddit_post'). Dùng các tool này (KHÔNG WebFetch reddit).`
const HONESTY = `Đây là league DAY 1-2 — data thật sự mỏng. Nếu nguồn không có data current thật, set dataAvailable:false và nói rõ trong gaps. KHÔNG bịa giá/tier/build để lấp schema. Vài finding verified > một đống padding.`
const NUDGE = `BẮT BUỘC: kết thúc bằng việc gọi StructuredOutput đúng schema, KHÔNG trả prose.`

// Creator watchlist — YouTube lane phải check trực tiếp các kênh này (ngoài generic search). Thêm creator mới vào đây.
const PRIORITY_CREATORS = [
  { h: 'CaptainLance9', angle: 'companion / Spirit Walker beast tamer specialist', url: 'https://www.youtube.com/captainlance9' },
]
const PRIORITY_BLOCK = PRIORITY_CREATORS.length
  ? `\nWATCHLIST — ưu tiên check trực tiếp các creator này (yt-dlp ytsearch theo handle, lấy video Runes of Aldur / 0.5 MỚI NHẤT của họ, tag recency theo upload_date):\n${PRIORITY_CREATORS.map(c => `- ${c.h} (${c.angle}) — ${c.url}`).join('\n')}\nVới angle companion/minion, các creator watchlist này là nguồn primary — nếu họ có video post-launch thì ưu tiên transcript họ trước generic search.`
  : ''

const HARVEST_SCHEMA = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    dataAvailable: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          angle: { type: 'string', enum: ['build', 'meta', 'economy'] },
          headline: { type: 'string' },
          detail: { type: 'string' },
          url: { type: 'string' },
          recency: { type: 'string', enum: ['post-launch', 'pre-league-theorycraft', 'unknown'] },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['angle', 'headline', 'detail', 'recency', 'confidence'],
      },
    },
    gaps: { type: 'string' },
  },
  required: ['source', 'dataAvailable', 'findings', 'gaps'],
}

// ---------- Phase 1: Harvest ----------
phase('Harvest')

const youtubeLane = () => agent(
`YouTube harvest lane cho POE2 live league "${LEAGUE_NAME}".
${WEBTOOLS}
${RECENCY}${PRIORITY_BLOCK}
Cách làm:
1. WebSearch các query (dùng TÊN league, không phải "0.5"): "Path of Exile 2 Runes of Aldur league start build", "POE2 Runes of Aldur day 1 tier list", "POE2 Runes of Aldur best build", "POE2 Runes of Aldur leveling guide".
2. Với 4-8 video hứa hẹn nhất, lấy metadata + transcript bằng Bash yt-dlp. NÉ BOT-WALL (bắt buộc): yt-dlp PHẢI current — nếu gặp 429 / "Sign in to confirm you're not a bot" / "Only images available" / "n challenge ... no solutions" thì chạy 'python3 -m pip install -U yt-dlp' rồi retry; và MỌI lệnh thêm cờ '--cookies-from-browser chrome --remote-components ejs:github' (cookies bypass bot-wall, ejs giải JS challenge):
   - metadata: yt-dlp --cookies-from-browser chrome --remote-components ejs:github --skip-download --print "%(upload_date)s | %(title)s | %(uploader)s | %(webpage_url)s" "<url>"
   - transcript: yt-dlp --cookies-from-browser chrome --remote-components ejs:github --skip-download --write-auto-subs --sub-lang 'en.*' --sub-format vtt -o '/tmp/yt-%(id)s' "<url>" → clean .vtt (strip '<...>' tags + dedupe dòng liền nhau) rồi đọc.
   Nếu vẫn fail → dùng title + description (yt-dlp --print "%(description)s") + WebSearch snippet, hạ confidence.
3. Tag recency theo upload_date so với ${LAUNCH_DATE}.
Trích build được recommend (skill/ascendancy/class), tier-list verdict (meta), currency/farming tip (economy). Mỗi finding: angle, headline ngắn, detail (số/cơ chế cụ thể nếu có), url, recency, confidence.
${HONESTY} ${NUDGE}`,
  { label: 'harvest:youtube', phase: 'Harvest', schema: HARVEST_SCHEMA })

const redditCommunityLane = () => agent(
`Reddit community-sentiment lane cho POE2 "${LEAGUE_NAME}".
${REDDIT_TOOLS}
Đo sentiment + meta + bug + economy chatter từ cộng đồng:
1. browse_subreddit r/pathofexile2 (sort=hot, và sort=top timeframe=week) — lấy top threads.
2. search_reddit "Runes of Aldur" và "league start" (thử cả r/pathofexile2, r/pathofexile).
3. get_reddit_post + get_post_comments trên 4-6 thread nhiều upvote/comment nhất (megathread, "what are you playing", tier list, bug report, "how's the league").
Trích: build người ta đang chơi & feedback (build), class/ascendancy/skill mạnh-yếu + balance sentiment + phản ứng nerf/buff (meta), giá/currency/early money-maker chatter (economy).
${RECENCY} Mỗi finding kèm url permalink + confidence (LOW nếu chỉ opinion 1 người, MEDIUM nếu nhiều người đồng thuận).
${HONESTY} ${NUDGE}`,
  { label: 'harvest:reddit-community', phase: 'Harvest', schema: HARVEST_SCHEMA })

const redditBuildsLane = () => agent(
`Reddit build-focus lane cho POE2 "${LEAGUE_NAME}".
${REDDIT_TOOLS}
1. search_reddit "Runes of Aldur build", "POE2 league start build", "what to play 0.5" — thử r/PathOfExileBuilds, r/PathOfExile2Builds (nếu tồn tại), r/pathofexile2.
2. browse_subreddit các build sub tìm được; get_post_comments trên thread build hữu ích nhất.
Tập trung angle 'build': skill + ascendancy + class combo đang được khuyến nghị / đang work, leveling path, gear floor. Ghi cả meta verdict nếu thread xếp hạng builds.
${RECENCY} url + confidence mỗi finding. ${HONESTY} ${NUDGE}`,
  { label: 'harvest:reddit-builds', phase: 'Harvest', schema: HARVEST_SCHEMA })

const gggLane = () => agent(
`GGG official lane cho POE2 "${LEAGUE_NAME}".
${WEBTOOLS}
1. Đọc baseline patch notes local: Bash 'sed -n "1,80p" data/release-notes/Version_0.5.0.md' và 'grep -niE "hotfix|known issue|update" data/release-notes/Version_0.5.0.md | head -40' để biết league launch với gì + có addendum nào chưa.
2. WebSearch: "Path of Exile 2 Runes of Aldur hotfix", "POE2 0.5.0 patch notes update", "pathofexile.com forum 0.5 known issues". Tìm dev post / hotfix thread / "Updates to Patch Notes" addendum SAU ${LAUNCH_DATE}.
3. WebFetch các forum/news thread công khai tìm được (browser UA fallback). KHÔNG gọi API trade/stash/character có auth — chỉ đọc forum/news công khai.
Trích: hotfix/balance change ảnh hưởng meta (meta), skill/item nerf-buff ảnh hưởng build (build), thay đổi economy/drop (economy).
${RECENCY} Mỗi finding url + confidence (HIGH cho official GGG wording). ${HONESTY} ${NUDGE}`,
  { label: 'harvest:ggg-forum', phase: 'Harvest', schema: HARVEST_SCHEMA })

const ninjaLane = () => agent(
`poe.ninja build-data lane cho POE2 "${LEAGUE_NAME}" (slug ${NINJA_LEAGUE}).
Dùng Bash skill (KHÔNG web). Chạy không tham số để xem usage nếu cần: bash .claude/skills/poe-ninja/scripts/builds-api.sh
  bash .claude/skills/poe-ninja/scripts/builds-api.sh version ${NINJA_LEAGUE}
  bash .claude/skills/poe-ninja/scripts/builds-api.sh overview ${NINJA_LEAGUE}
  (map ID→name nếu cần: bash .claude/skills/poe-ninja/scripts/builds-api.sh dictionary class|gem|keypassive)
Trích distribution: class %, ascendancy %, skill phổ biến, keystone — đây là META data-driven thật, không phải hype (angle 'meta'). Note top build characters nếu có (angle 'build').
TỐI QUAN TRỌNG: report sample size + snapshot recency trong field gaps. Day 1-2 poe.ninja thường RẤT ít character (chưa ai lên cao + link). Nếu sample nhỏ (vài chục/trăm) hoặc snapshot rỗng → dataAvailable:false, nói rõ "quá sớm, distribution chưa ý nghĩa". KHÔNG present % từ sample 10 người như meta. confidence theo sample size. ${NUDGE}`,
  { label: 'harvest:poe-ninja-builds', phase: 'Harvest', schema: HARVEST_SCHEMA })

const economyLane = () => agent(
`Economy lane cho POE2 "${LEAGUE_NAME}".
Dùng Bash skill (KHÔNG web trade API). Chạy không tham số để xem usage: bash .claude/skills/poe2scout/scripts/api.sh
  bash .claude/skills/poe2scout/scripts/api.sh leagues
  bash .claude/skills/poe2scout/scripts/api.sh categories ${SCOUT_LEAGUE}
  bash .claude/skills/poe2scout/scripts/api.sh list ${SCOUT_LEAGUE} <currency-category>   (giá currency hiện tại)
  bash .claude/skills/poe2scout/scripts/api.sh pairs ${SCOUT_LEAGUE}                       (Currency Exchange: volume trade thật + ex/div)
Đo: tỉ giá Divine<->Exalted, currency đắt, unique đắt sớm, early money-maker. ${RECENCY}
HONESTY: poe2scout đã báo "1 div = 0 Exalted Orb" cho slug ${SCOUT_LEAGUE} = volume trade chưa có (day 1-2). Nếu giá 0/trống → dataAvailable:false, gaps nói "economy chưa hình thành, re-check day 3-7". KHÔNG bịa giá. confidence theo volume. ${NUDGE}`,
  { label: 'harvest:economy', phase: 'Harvest', schema: HARVEST_SCHEMA })

const LANES = [youtubeLane, redditCommunityLane, redditBuildsLane, gggLane, ninjaLane, economyLane]
const harvest = (await parallel(LANES)).filter(Boolean)
const allFindings = harvest.flatMap(h => (h.findings || []).map(f => ({ ...f, source: h.source })))
const gapsList = harvest.map(h => `- ${h.source} (dataAvailable=${h.dataAvailable}): ${h.gaps}`)
log(`Harvest xong: ${harvest.length}/6 lanes, ${allFindings.length} findings`)

// ---------- Phase 2: Synthesize (barrier — mỗi synth cần cross-source findings) ----------
const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    angle: { type: 'string' },
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string' },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          sources: { type: 'string' },
        },
        required: ['name', 'note', 'confidence'],
      },
    },
    contradictions: { type: 'array', items: { type: 'string' } },
    dataQuality: { type: 'string' },
  },
  required: ['angle', 'summary', 'highlights', 'dataQuality'],
}

phase('Synthesize')
const ANGLES = [
  { key: 'build', label: 'synth:build', focus: 'builds đang được chơi/recommend, league starter holding up, leveling, gear floor' },
  { key: 'meta', label: 'synth:meta', focus: 'class/ascendancy/skill popularity & strength, balance sentiment, tác động hotfix, tier movement' },
  { key: 'economy', label: 'synth:economy', focus: 'tỉ giá currency, item đắt, early money-maker, crafting/farming — flag nếu economy chưa hình thành' },
]
const synthInput = (key) => JSON.stringify(allFindings.filter(f => f.angle === key))
const synths = (await parallel(ANGLES.map(a => () => agent(
`Synthesize angle "${a.key.toUpperCase()}" cho intel POE2 "${LEAGUE_NAME}" day 1-2.
Findings (CHỈ angle ${a.key}, gộp từ mọi nguồn) — JSON:
${synthInput(a.key)}

Source gaps/staleness:
${gapsList.join('\n')}

Tập trung: ${a.focus}.
- Gộp tín hiệu trùng, ưu tiên recency='post-launch' hơn 'pre-league-theorycraft'.
- highlights = điểm cụ thể nhất (build name / class / skill / item / currency), mỗi cái confidence + sources (nguồn nào nói).
- contradictions = nơi các nguồn mâu thuẫn.
- dataQuality = data angle này day 1-2 đáng tin cỡ nào (vd 'economy gần như chưa có volume — LOW').
KHÔNG bịa lấp schema; nếu angle thiếu data thật, summary nói thẳng "quá sớm". ${NUDGE}`,
  { label: a.label, phase: 'Synthesize', schema: SYNTH_SCHEMA }))) ).filter(Boolean)

// ---------- Phase 3: Critique (barrier — cần cả 3 synthesis) ----------
const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    freshnessWarnings: { type: 'array', items: { type: 'string' } },
    crossSourceContradictions: { type: 'array', items: { type: 'string' } },
    confidenceCalibration: { type: 'string' },
    missingCoverage: { type: 'array', items: { type: 'string' } },
    recheckPlan: { type: 'array', items: { type: 'string' } },
  },
  required: ['confidenceCalibration'],
}

phase('Critique')
const critique = await agent(
`Freshness & contradiction critic cho intel scan POE2 "${LEAGUE_NAME}" (day 1-2, sau launch ${LAUNCH_DATE}).
3 synthesis (build/meta/economy) — JSON:
${JSON.stringify(synths)}

Source gaps:
${gapsList.join('\n')}

Devil's advocate:
- freshnessWarnings: chỗ nào info có thể là PRE-LEAGUE theorycraft bị trình bày như current meta? Guide cũ recycled?
- crossSourceContradictions: YouTube hype vs poe.ninja data thật vs Reddit complaint — mâu thuẫn ở đâu?
- confidenceCalibration: 1 đoạn — tổng thể day 1-2 nên tin tới mức nào (poe.ninja sample mỏng, economy chưa volume)?
- missingCoverage: nguồn/góc nào không lấy được data?
- recheckPlan: 3-5 việc nên re-check day 3-7 khi data dày lên.
${NUDGE}`,
  { label: 'critique', phase: 'Critique', schema: CRITIQUE_SCHEMA })

// ---------- Phase 4: Report ----------
phase('Report')
const report = await agent(
`Viết FINAL intel report cho POE2 live league "${LEAGUE_NAME}", day 1-2.
Lấy ngày hôm nay: Bash 'date +%F' → dùng làm <DATE> trong tên file + tiêu đề.

INPUT — 3 synthesis JSON:
${JSON.stringify(synths)}

INPUT — critique JSON:
${JSON.stringify(critique)}

INPUT — source gaps:
${gapsList.join('\n')}

Viết Markdown, giọng Việt-Anh code-switching (giữ nguyên game term tiếng Anh). Đây là intel report cho user đọc — ĐƯỢC PHÉP cite nguồn + URL + confidence label (khác content note: ở đây attribution là tính năng). Cấu trúc:
# POE2 ${LEAGUE_NAME} — League Pulse <DATE>
(2-3 câu mở: hôm nay day mấy + độ tin cậy tổng thể từ critique.confidenceCalibration)
## ⚡ TL;DR — 5-7 bullet điều quan trọng nhất ngay bây giờ.
## 🏗️ Builds — build đang chơi/recommend + league starter, mỗi cái [confidence] + nguồn.
## 📊 Meta — class/ascendancy/skill distribution (poe.ninja nếu đủ sample) + sentiment + tác động hotfix.
## 💰 Economy — tỉ giá, item đắt, money-maker; NẾU chưa có volume nói thẳng "economy chưa hình thành, re-check day 3-7".
## ⚠️ Freshness & Contradictions — từ critique: cảnh báo pre-league theorycraft + mâu thuẫn chéo nguồn.
## 🔁 Re-check Day 3-7 — từ critique.recheckPlan.
## 🔗 Sources — link tổng hợp.

QUY TẮC: KHÔNG bịa số/giá/tier để lấp chỗ. Day 1-2 thin là OK — report nói thật "quá sớm" còn hơn confident-sai. Mỗi build/meta claim kèm [HIGH]/[MEDIUM]/[LOW].

Sau khi viết: Bash 'mkdir -p ${OUT_DIR}', rồi dùng Write tool ghi report vào '${OUT_DIR}/league-pulse-<DATE>.md'. Cuối cùng TRẢ VỀ toàn bộ markdown làm final message.`,
  { label: 'report', phase: 'Report' })

return {
  report,
  outDir: OUT_DIR,
  harvestSources: harvest.map(h => ({ source: h.source, dataAvailable: h.dataAvailable, n: (h.findings || []).length })),
  synths,
  critique,
}
