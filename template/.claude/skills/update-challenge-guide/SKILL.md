---
name: update-challenge-guide
description: Fetch live Path of Exile 2 challenge progress (via Playwriter or pasted HTML), then hand-write the canonical POE2 challenge guide with semantic reasoning — pick which of the 8 Runes of Aldur challenges to push next based on user's target tier (2/4/6/8), bundle-ability with current build, and cost/effort tradeoffs. POE2 0.5 is the FIRST league with a challenge system. Use when the user runs /update-challenge-guide, asks to refresh the POE2 challenge guide, or provides POE2 challenge page HTML.
allowed-tools:
  - Bash(playwriter:*)
  - Bash(git diff:*)
  - Bash(git status:*)
argument-hint: "[--url <challenge-page-url> | --account <poe-account> | --html-file <file>]"
arguments:
  - source
context: inline
---

# update-challenge-guide

Refresh the canonical POE2 challenge guide from live challenge page data. This skill is **agentic** — the agent fetches HTML, then reasons semantically and writes the guide by hand. No parser script, no template fill.

## POE2 0.5 — bối cảnh challenge system lần đầu

POE2 0.5 "Runes of Aldur" (launch ~29/05/2026) là league POE2 ĐẦU TIÊN có challenge system. So với POE1 (40 challenge, 4 reward tier 12/24/36/40):

- **POE2 chỉ có 8 challenge** — scope nhỏ hơn nhiều, dễ tiếp cận hơn cho người chơi casual.
- **4 reward tier: 2 / 4 / 6 / 8** — mỗi tier rớt một mảnh của bộ giáp cosmetic **Knight of Aldur**.
- **Cộng dồn từ challenge 1**: mỗi challenge hoàn thành cho thêm một mảnh của vật trang trí **Runes of Aldur Totem** hideout. Cột totem phản ánh trực tiếp progress 1–8.
- **Cosmetic-only reward**: không có portal effect riêng theo tier như POE1, không có title 40/40-style. Knight of Aldur armor set + totem hideout là toàn bộ reward chính.
- **Reward chỉ trong league** — sang Standard không lấy được nữa. Đây là pressure để hoàn thành trong league window.

Vì scope nhỏ và reward cosmetic, **default target thường là 8/8** thay vì split theo tier như POE1 — chi phí marginal để đi từ 6 lên 8 thấp, và bộ giáp full set có giá trị cosmetic cao hơn từng mảnh rời. Override target nếu user nói cụ thể (vd "chỉ cần 4 cho mảnh chest").

## Canonical Guide Path

`content/guides/challenge-guide.md` — single stable file, rolling living doc. Filename không đổi giữa các league; mỗi lần chạy ghi đè body với content league hiện tại. Không tạo dated copy hay league-suffixed copy. Khi league đổi, chỉ overwrite content và bump frontmatter `league` + `patch` — không rename.

## Step 1 — Get fresh HTML

Account on file: `hopthuxacnhan-3062`. URL challenge page POE2 (verify sau khi 0.5 live):

```
https://www.pathofexile.com/account/view-profile/hopthuxacnhan-3062/challenges?game=poe2
```

> **TODO khi POE2 0.5 live (~29/05/2026):** verify URL chính xác. Khả năng cao GGG dùng cùng domain `pathofexile.com` với query param `?game=poe2` hoặc subpath `/poe2/challenges`. Nếu URL khác, update vào `scripts/fetch-html.example.sh` + section này. Verify selector `.achievement-list` / `.achievement-container` vẫn dùng được cho POE2 — nếu GGG redesign UI cho POE2, adjust selector. **Confidence: MEDIUM** — assumption dựa trên pattern POE1 và việc account profile page hiện đã share giữa 2 game (character list đã có toggle PoE1/PoE2).

Use the running Playwriter session if one exists; otherwise create a new one.

```bash
playwriter -s <id> --timeout 60000 -e "$(cat <<'EOF'
const fs = require('node:fs')
state.page = context.pages().find((p) => p.url().includes('pathofexile.com')) ?? context.pages()[0] ?? (await context.newPage())
await state.page.goto('https://www.pathofexile.com/account/view-profile/hopthuxacnhan-3062/challenges?game=poe2', { waitUntil: 'domcontentloaded', timeout: 45000 })
await state.page.waitForSelector('.achievement-list', { timeout: 30000 })
const html = await state.page.locator('.achievement-container').first().evaluate((el) => el.outerHTML)
fs.mkdirSync('tmp', { recursive: true })
fs.writeFileSync('tmp/challenges-poe2.html', html)
const info = await state.page.locator('.achievement-container .info').first().evaluate((el) => el.textContent.trim())
console.log('saved tmp/challenges-poe2.html', html.length)
console.log('info:', info)
EOF
)"
```

Nếu user paste HTML trong chat, ghi vào `tmp/challenges-poe2.html` và bỏ qua Playwriter.

Nếu page bị block hoặc chưa login, ask user login vào pathofexile.com trong Chrome rồi rerun. Không fallback sang cookie extraction hay curl.

## Step 2 — Read + reason

Read `tmp/challenges-poe2.html`. Mỗi challenge là một `.achievement` block (assumption: cùng markup POE1; verify sau live). Extract cho mỗi challenge:

- title (h2 text)
- completion status (class `incomplete` present or absent)
- counter `X/Y` nếu h2.completion-detail present
- sub-items trong `<li>` với counter riêng

Count totals: `done/8` và list incomplete challenges.

Sau đó **reason about user's actual target**:

- **Default target = 8/8** (full Knight of Aldur set + complete Totem). Khác POE1 — POE2 challenge scope nhỏ nên đẩy hết là rule of thumb, không phải over-investment.
- Nếu user nói rõ "chỉ cần 4" hoặc "chỉ cần mảnh chest" — honor target đó.
- Nếu user đã 7/8 và challenge thứ 8 đắt khủng khiếp (vd boss kill yêu cầu fragment 30+ div) — surface trade-off explicit, không tự ý đẩy.

Với mỗi challenge incomplete, phân loại:

- **Must-do** (top N where N = target - done): bundle-friendly với current map/atlas loop, hoặc cheap one-off (single boss quest version, single mechanic encounter, etc.). POE2 0.5 có **quest version của mọi Pinnacle Boss** (deterministic) — quest version thường cheaper hơn infinite-farm version, ưu tiên dùng cho challenge.
- **Skip-able / defer** (rest): grind tail dài, expensive boss key (vd Arbiter of Divinity infinite version), drop hiếm (specific unique từ specific encounter).

Use character context từ `CLAUDE.md` (current POE2 character — TBD cho 0.5; có thể Witch Lich/Huntress Spirit Walker/Monk Martial Artist) để confirm challenges nằm trong envelope. **Confidence: LOW cho character context — POE2 0.5 character chưa chọn cứng tại thời điểm scaffold skill.**

## Step 3 — Write the guide by hand

**Voice + structure rules** (overriding default markdown habits — xem project CLAUDE.md "Content Writing Voice"):

- **Author voice** — viết như owner đã chơi + test. State numbers as facts, không citation.
- **Prose-first** — narrative paragraph giải thích *why*. Bullet chỉ khi truly enumerative (≥3 item, không có causal flow) hoặc numbered checklist. Nếu bullet có thể join bằng "vì", "do đó", "tuy nhiên" → rewrite thành prose.
- **Tutorial voice** — giải thích *why* mỗi must-do là doable + cách bundle. Đừng chỉ list counter.
- **Cross-link aggressive** — mọi game concept POE2 (skill, item, mechanic, monster, atlas keystone) dùng `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` MDC. **POE2 dùng `poe2wiki.net`, không phải `poewiki.net`** — đây là khác biệt quan trọng.
- **Headings carry structure**, không phải bullet. Mỗi section là prose unit dạy một ý.
- **Title** không include league name hay patch number — site auto-prepend qua frontmatter `league_name` + `patch`.
- **No meta-summary** — đừng viết "this guide is", "we will cover", "based on the challenge panel".
- **No POE1 carryover assumption** — POE2 KHÔNG có scarab, không có map roll, không có voidstone. Đừng adapt POE1 challenge advice (vd "run Beyond scarab") sang POE2 mechanics.

**Section template** (adapt theo nhu cầu):

1. **Opening paragraph** — current state (done/8), target chosen (default 8 hoặc custom) và *why* target đó, count must-do + skip-able.
2. **Build status** — short paragraph confirm current POE2 character envelope cover all must-do (cite character file nếu có).
3. **N must-do challenges** — một H3 mỗi challenge. Mỗi cái: **inline `:memorable-check{}` ticks ngay dưới H3** (action-first, xem "Inline Progress Ticks" bên dưới), rồi current counter, what's needed, why nó bundle hoặc cách one-shot, specific atlas keystone / tablet / waystone setup, specific item cần mua/craft với verbatim wiki-link `poe2wiki.net`, expected map count hoặc divine cost.
4. **Atlas + Tablet loop** — section giải thích multi-tick setup. POE2 0.5 có Masters of the Atlas (Doryani's Science / Hilda's Hunting / Jado's Spycraft — pick 1 active mỗi map), Atlas Tree mới (300+ node), Tablet stacking (cùng loại stack được). Math tổng map count để compound mọi thứ.
5. **Boss tour** (nếu must-do bao gồm Pinnacle hoặc Citadel boss) — separate section với specific key/fragment cần buy/farm. Ưu tiên **quest version** của pinnacle boss (deterministic, cheaper) thay vì infinite-farm version.
6. **K skip-able challenges** — paragraph mỗi skip-able, giải thích cost vs reward và *khi nào* đảo quyết định (vd "skip nếu Arbiter of Divinity infinite-version key giá >X div").
7. **Pitfalls / không làm** — specific traps (wrong fragment cho pinnacle quest version, waystone chưa identify nên không activate được, tablet đặc thù league không rớt từ Simulacrum/Abyssal Depths/Twisted Domain nữa).
8. **Checklist sau mỗi session** — counter cần track + abort condition.
9. **Related Resources** — link đến character progress, farming strategy POE2, related mechanic doc (`content/guides/return-of-the-ancients.md`, `content/guides/spirit-walker-companion-beast-hunt.md`).

## Inline Progress Ticks — `:memorable-check{}` MDC

Guide phải interactive. Mỗi must-do milestone phải **tick được inline** qua component `MemorableCheck.vue` (`app/components/MemorableCheck.vue` — generic, render brutalist coral checkbox, persist state ở `localStorage`).

**Placement rule** — ticks đặt **trước**, ngay dưới mỗi `### <Challenge Name>` heading, *trước* prose. Action-first scan tốt hơn narrative-first scroll. Prose giải thích đi sau và nói *vì sao* tick đó quan trọng.

**Syntax** — một milestone một dòng:

```mdc
:memorable-check{id="<stable-slug>" label="<task với target counter>" storageKey="poe2-<league-slug>-challenges"}
```

- `id` — stable kebab-slug unique trong storageKey namespace. Dùng form `<challenge>-<milestone>` (vd `rune-seeker-7slot`, `hunter-aki`, `cartographer-300`). **Stable qua các lần rewrite guide** — đừng đổi ID khi bump counter, user sẽ mất tick state. Nếu challenge có sub-milestone mới, *thêm* id mới; đừng recycle.
- `label` — short Vietnamese task description với target counter và one-line action hint (vd `"Craft thành công Remnant 7-slot (sống qua 6 wave)"`). Giữ dưới ~80 ký tự cho khỏi wrap xấu.
- `storageKey` — league-scoped namespace. Dùng literal `poe2-<league-slug>-challenges` (vd `poe2-runes-of-aldur-challenges`). Khi đổi league, bump slug để fresh league bắt đầu với empty checks thay vì kế thừa state league cũ.

**Số ticks per challenge** — một per *trackable milestone*, không phải một per counter unit. POE2 0.5 có 8 challenge và phần lớn chỉ có 1-3 milestone mỗi cái (tick craft + tick threshold cao chẳng hạn). Aim ~10-20 ticks total cho 8/8 push, không phải 50+.

**Setup-phase ticks** — cũng tick *loop prep* (atlas master active, tablet stack configured, pinnacle quest key bought). Đây là one-time prerequisite, không per-map. Đặt trong các section "Atlas + Tablet loop" / "Boss tour".

**Example** (từ current guide POE2 0.5):

```mdc
## Challenge 1 — The Rune Seeker

:memorable-check{id="rune-seeker-craft" label="Craft item từ Remnant nhiều slot trong map loop" storageKey="poe2-runes-of-aldur-challenges"}
:memorable-check{id="rune-seeker-7slot" label="Craft thành công Remnant 7-slot (sống qua 6 wave)" storageKey="poe2-runes-of-aldur-challenges"}

Đây là challenge gắn trực tiếp với league mechanic, nên nó tự tiến triển khi mình chơi Remnant. ...
```

**Đừng** đặt ticks bên trong bullet list, blockquote, hoặc code block — MDC component phải ở block level. **Đừng** wrap nhiều ticks bằng prose dài dòng giữa chúng — chúng đọc như checklist khi stack thẳng. **Đừng** invent component name mới; `:memorable-check{}` là tick syntax duy nhất sanctioned trong guide này.

**Frontmatter required**:

```yaml
---
template: templates/guide-template.md
document_type: guide
title: "<topic only — no league/patch>"
status: draft
author: POE AIO
created: '<original creation date>'
updated: '<today YYYY-MM-DD>'
game: poe2
league: 'Runes of Aldur'
patch: 0.5.0
guide_type: challenge
tags:
  - runes-of-aldur
  - challenges
  - <target-slug like "8-8" or "4-8">
  - execution-plan
  - poe2
  - endgame
relationships:
  supports:
  - path: content/characters/<character>.md
    title: <character title>
  references:
  - path: content/guides/return-of-the-ancients.md
    title: Return of the Ancients — POE2 0.5 Overview
---
```

Use Write tool trên canonical guide path. Overwrite toàn file — đừng merge với version cũ (counter drift gây confusion).

## Step 4 — Validate

```bash
bun run generate
```

Build phải green.

## Step 5 — Report

Đến user:

- source (Playwriter session ID + URL, hoặc pasted HTML)
- current count parsed từ page (`X/8`)
- target chosen và rationale (default 8 unless overridden)
- must-do count + skip-able count
- target file written
- validation result

## Failure handling

- HTML không có `.achievement` block → ask user URL đúng hoặc HTML đã save. **POE2 có thể đổi selector** — surface explicit nếu detect markup khác POE1.
- Playwriter không access được logged-in page → ask user login pathofexile.com trong Chrome và retry.
- User's stated target conflict với current done (target ≤ done) → tell user đã đạt target.
- Frontmatter sai schema → fix frontmatter khớp `content.config.ts`, không commit broken guide.
- Không tạo alternate guide file cho cùng league; one canonical file only.
- **POE2 challenge page chưa live** (trước ~29/05/2026 hoặc trước khi user complete campaign 0.5) → tell user explicit và defer skill cho đến khi league mở + character đã unlock challenge panel.

## Anti-patterns

- Đừng reintroduce parser script. Counter extraction đơn giản, làm inline được; giá trị của skill là **semantic reasoning về push challenge nào tiếp theo**, không phải HTML parsing.
- Đừng generate template-shaped output với placeholder. Viết specific prose với actual POE2 character numbers và actual challenge cần push *session này*.
- Đừng list mọi challenge incomplete đều nhau. Job của skill là *rank + filter* theo bundle-ability + cost — đó là agentic value-add.
- Đừng include "according to wiki" / "based on community guides" hedging. State facts as build owner.
- Đừng adapt POE1 challenge wording (vd "run Beyond scarab on T16+ map") — POE2 có hệ kinh tế khác hoàn toàn. Mọi advice phải bám POE2 0.5 mechanics (Waystone, Tablet, Remnant, Ocean Exploring, Atlas Masters).
- Đừng confuse `poewiki.net` với `poe2wiki.net`. Mọi wiki-link trong guide poe2 phải dùng `poe2wiki.net`.
