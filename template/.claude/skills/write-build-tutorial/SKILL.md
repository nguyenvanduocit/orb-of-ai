---
name: write-build-tutorial
description: Viết hoặc polish build guide trong content/builds/{class}/ theo chuẩn cheat-sheet fact-dense cho AI reader (templates/content-style.md + templates/build-template.md) — bullet tự đứng, fragment/arrow OK, giữ 100% hard facts, wiki-link game term. Trigger — "viết build guide", "draft build doc", "tutorial build", "write build guide", "build guide cho <ascendancy>", "polish build guide", "build doc <skill>".
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(test:*)
  - Bash(ls:*)
  - Bash(jq:*)
  - Bash(bun:*)
when_to_use: Use when user asks to write, draft, or polish a build guide in content/builds/. Triggers — "viết build guide", "viết tutorial cho build X", "draft build", "write build guide", "build doc cho ascendancy Y", "polish build guide", "build guide spectre/RF/CoC...".
argument-hint: "<topic | content/builds/.../file.md>"
arguments:
  - topic_or_path
context: inline
---

# write-build-tutorial — Viết build cheat sheet cho AI reader

Skill này viết build guide trong `content/builds/<class>/` theo **chuẩn cheat-sheet fact-dense** của `templates/content-style.md` + `templates/build-template.md`. Reader chính là AI agent (bot Discord, research agents) — tối ưu cho scan nhanh + trích fact chính xác, KHÔNG phải người đọc tuần tự.

## Inputs

- `$topic_or_path` — Một trong:
  - **Path** đến file đã có (vd `content/builds/witch/spectre-necromancer.md`) → rewrite full content giữ frontmatter schema
  - **Topic** ngắn (vd `spectre necromancer`) → skill glob lookup. File chưa tồn tại → REFUSE, gợi ý tạo file mới theo `templates/build-template.md` trước. Skill KHÔNG tạo file mới.

## Goal

File `.md` trong `content/builds/<class>/` với:

- Frontmatter khớp schema `content.config.ts` (build `bun run generate` fail nếu sai).
- Format theo `templates/content-style.md` + `templates/build-template.md` — required core (mở đầu 1-2 dòng + `## Build Overview` + `## Failure Modes` + `## Verdict`) + optional menu, cắt section không có fact.
- Body ≤ 120 dòng — vượt chỉ khi mật độ fact thật sự cần.
- Số thật từ PoB hoặc character file (`content/characters/*.json`), zero fabrication. DPS/EHP ≥ 100k phải kèm PoB link hoặc math chain.
- Game term (skill gem, support, unique, jewel, flask, atlas keystone, currency, fragment) → `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` lần đầu.

## Format rules — cheat-sheet fact-dense

Chuẩn đầy đủ ở `templates/content-style.md`; restate cho build doc:

1. **Fact-dense, zero narrative.** Mỗi dòng carry một fact/rule dùng được (số, mod wording, breakpoint, exclusion, thứ tự ưu tiên, tên gem/item/node chính xác). Cắt câu dẫn, câu chuyển, recap, mọi "voice" cho người đọc.
2. **Bullet là đơn vị mặc định.** Mỗi bullet tự đứng được (đọc một mình vẫn hiểu), một fact/rule per bullet. Prose chỉ khi quan hệ nhân-quả nhiều bước không nén được — tối đa 2-3 câu.
3. **Fragment OK, arrow OK.** `điều kiện → hệ quả`, `A + B → C`. `✗/✓` cho anti-pattern/pattern. Không cần câu hoàn chỉnh, không xưng hô ("mình/bạn/bro" bỏ hết).
4. **Giữ 100% hard facts.** Nén là bỏ văn, KHÔNG bỏ fact. Mất một số/breakpoint/exclusion = rewrite hỏng.
5. **Số kèm nguồn/mốc.** Market data → `~40 div (2026-06-15, poe2scout)`. Số cơ chế game (mod roll, %) kèm patch nếu dễ đổi. DPS/EHP ≥ 100k → PoB link hoặc math chain, không quote số trần.
6. **Mỗi fact một lần** ở section sở hữu nó; chỗ khác chỉ nhắc tên + link. Không recap, không Quick Summary. Caveat PoB chưa model → frontmatter `pob_coverage`, không rải body.
7. **Table cho data enumerable** (stat block, `### Performance Ratings`, so sánh). Bold key term lần đầu.
8. **H1 = tên build, KHÔNG kèm league/patch** (frontmatter đã có). Rewrite fresh: số/gear/skill/node đã chết theo patch gỡ hẳn, lịch sử chỉ ở `## Changelog` hoặc git — doc hiện tại chỉ trạng thái đúng-bây-giờ.

## Linking (giá trị chính của corpus)

- Nhắc concept có doc riêng (mechanic, build khác) → link inline `[Title](/route)` ngay lần đầu. Route bỏ prefix `content/` + đuôi `.md`.
- Game term → `:wiki-link{url="https://www.poe2wiki.net/wiki/Exact_Name"}` lần đầu — vừa render site vừa cho AI canonical URL.
- `## Relationships` **bắt buộc khi có ≥1 doc liên quan trong corpus** — mỗi dòng `- **predicate** [Title](/route) — reason`. Predicate snake_case (`synergizes_with | related | related_mechanics | requires | competes_with | derived_from | source_research | follows_build`…). **Link hai chiều**: build A liên quan mechanic B → cả hai doc đều khai.

## Section structure — required core + optional menu

Theo `templates/build-template.md`. **Cắt section không có fact, ĐỪNG pad, ĐỪNG lặp.** Heading validator-enforced giữ ĐÚNG literal; heading tự do thì ngắn, danh từ nói thẳng nội dung.

### Required core (luôn có)

1. **Mở đầu (không heading)** — 1-2 dòng: damage source + defense chính + content focus.
2. **## Build Overview** — Damage (source → scaling vector), Defense (layer order), Ràng buộc cứng (keystone/unique bắt buộc, exclusion). Mỗi mục 1 bullet.
3. **## Failure Modes** — **validator-enforced `required: true`, giữ ĐÚNG literal `## Failure Modes`** (Vietnamese-ize sẽ fail validate). ≥3 scenario gãy, mỗi cái 1 bullet `nguyên nhân → hậu quả → counter/cost`: map mod hostile · one-shot · gear floor · patch sensitivity · league start.
4. **## Verdict** — 1-2 dòng: hợp ai, ngưỡng đầu tư, trần ở đâu. Confidence ở frontmatter `confidence_level`, không nhãn HIGH/MEDIUM/LOW trong body.

### Optional (include khi có fact, OMIT cả section khi không)

- **## Skill Gems & Links** — Main (6L) + support (mỗi support 1 mệnh đề why interaction), aura, movement/utility. `Exclusion check: <none | list>` khi combo có support category trùng / keystone one-way.
- **## Ascendancy** — thứ tự node → mỗi node 1 mệnh đề why/unlock. Omit nếu đã gói trong Build Overview.
- **## Passive Tree** — keystone + why · cluster chính + why · PoB link cho allocation.
- **## Stats & Defenses** (+ `### Performance Ratings` table) — số thật từ PoB/client kèm ngày snapshot. Life/ES · EHP · Res · Max hit (kênh mỏng nhất) · DPS (PoB link/math chain). EHP layer order 0.5+: armour → evasion → block → max res → ES/Life → Runic Ward → recovery.
- **## Gear** — mỗi slot 1 bullet, **MỞ ĐẦU bằng mod cần hunt theo thứ tự ưu tiên (kèm breakpoint số)**, item đang chạy chỉ là context cuối dòng. Slot unique bắt buộc → "unique bắt buộc: X — why". Ưu tiên chung: cap res → Life/ES → attribute floor → damage chính → +skill level → utility.
- **## Budget** — floor chạy được (~X div, gồm gì) · geared (~Y div) · món đắt nhất.
- **## Leveling** — skill/gem theo act + lúc pivot sang main. Omit nếu trùng Gear.
- **## Resources** — PoB link. OMIT cả section nếu build chưa materialize (KHÔNG ship "PoB: PENDING").
- **## Changelog** — `### YYYY-MM-DD` reverse-chrono, mỗi ngày 1-3 bullet delta.
- **## Relationships** — bắt buộc khi có doc liên quan (xem Linking).

## Pre-write checklist

1. **Target file path** xác định (đã tồn tại — skill KHÔNG tạo file).
2. **Frontmatter values** từ file: class, ascendancy, primary_skill, budget_tier — align nội dung.
3. **Số thật**:
   - Build dựa trên character `content/characters/*.json` → đọc qua `jq`.
   - Build dựa trên PoB external → user cung cấp PoB code/URL → `/pob` analyze.
   - Chưa có data → placeholder `<!-- TODO: số thật từ PoB -->`, flag user.
4. **Reference build cùng class** — đọc 1-2 file `content/builds/<class>/` để spot existing `:wiki-link` usage + Relationships link hai chiều.

## Steps

### 1. Resolve target file
Parse `$topic_or_path`. Path → verify `test -f`. Topic → `ls content/builds/**/*<slug>*.md`. Không tìm thấy → REFUSE + gợi ý tạo file mới theo `templates/build-template.md`.

**Success criteria**: File path absolute, file tồn tại, đọc được frontmatter.

### 2. Đọc context
Read target file. Đọc 1-2 build file cùng class. Nếu link tới character → đọc character JSON.

**Success criteria**: Nắm class, ascendancy, primary_skill, budget_tier, key items/numbers.

### 3. Source data
Frontmatter `pob_link` chưa fetch → run `/pob <pob_link>`. Build trên character realtime → run `.claude/skills/pob/scripts/pob.sh fetch "<charname>" --spectre "<spectre>"` (xem CLAUDE.md).

**Success criteria**: ≥5 số thật sẵn sàng cite (ES, EHP, Block %, Res cap, DPS).

### 4. Outline section (right-sized)
Chọn từ required core (4) + optional menu — chỉ lấy section có fact thật. Draft 1 dòng/section: "Section X chứa fact Y". Build atomic → dừng sớm; build phức tạp → nhiều hơn, nhưng body ≤ 120 dòng.

**Human checkpoint** — User duyệt outline trước khi viết. Adjust nếu user thay đổi section.

**Success criteria**: User explicit approve; không section nào dự kiến rỗng/mỏng.

### 5. Viết cheat sheet
Section by section, follow Format rules + Section structure.

**Rules** (CẤM):
- Narrative / xưng hô / recap / câu dẫn không carry fact
- League name / patch number trong title hay H1
- Bỏ hard fact khi nén (số, mod wording, breakpoint, exclusion)
- Số fabricate (mọi số phải từ PoB hoặc character file); DPS/EHP ≥ 100k không kèm PoB link/math chain
- Game term không `:wiki-link` lần đầu; POE2 KHÔNG có Pantheon/Bandit

**Success criteria**: required core + đúng optional section có fact; mỗi bullet tự đứng; body ≤ 120 dòng; không TODO placeholder; Relationships đủ + hai chiều khi có doc liên quan.

### 6. Self-test (content-style.md)
- Xóa ngẫu nhiên một bullet → mất fact hay chỉ mất văn? Mọi bullet phải "mất fact".
- AI grep "build này dùng gì / trần DPS / floor bao nhiêu div" → trúng dòng chứa đủ answer?
- Concept có doc riêng đã link chưa? Relationships có chiều ngược chưa?
- Body vượt 120 dòng → dòng nào đang là văn thay vì fact?

**Success criteria**: 4 self-test pass.

### 7. Validate
Frontmatter khớp schema `content.config.ts` — chạy `bun run generate` để verify.

**Success criteria**: Validate exit 0.

### 8. Summary cho user
Báo: file path, section status (required core + optional đã dùng), body line count vs 120, `:wiki-link` count, validate result, gợi ý next step (review / `/heal-links` cho relationships frontmatter / commit).

**Success criteria**: User biết next step rõ ràng.
