---
name: write-farming-tutorial
description: Viết hoặc polish farming strategy doc trong content/farming/ theo chuẩn cheat-sheet fact-dense cho AI reader (templates/content-style.md + templates/farming-template.md) — bullet tự đứng, fragment/arrow OK, số có timestamp, giữ 100% hard facts, wiki-link game term. Trigger — "viết farming strategy", "draft farming doc", "tutorial farming", "write farming strategy", "farming guide cho <content>", "polish farming doc".
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
when_to_use: Use when user asks to write, draft, or polish a farming strategy in content/farming/. Triggers — "viết farming strategy", "viết tutorial farming", "draft farming doc", "write farming strategy", "farming guide cho Breach/Delirium/Harvest/...", "polish farming doc", "farm guide".
argument-hint: "<topic | content/farming/file.md>"
arguments:
  - topic_or_path
context: inline
---

# write-farming-tutorial — Viết farming cheat sheet cho AI reader

Skill này viết farming strategy trong `content/farming/` theo **chuẩn cheat-sheet fact-dense** của `templates/content-style.md` + `templates/farming-template.md`. Reader chính là AI agent — tối ưu cho scan nhanh + trích fact chính xác, KHÔNG phải người đọc tuần tự.

## Inputs

- `$topic_or_path` — Một trong:
  - **Path** đến file đã có (vd `content/farming/harvest-rush.md`) → rewrite full content giữ frontmatter schema
  - **Topic** ngắn (vd `harvest`, `breach currency`) → skill glob lookup. File chưa tồn tại → REFUSE, gợi ý tạo file mới theo `templates/farming-template.md` trước.

## Goal

File `.md` trong `content/farming/` với:

- Frontmatter khớp schema `content.config.ts` (build `bun run generate` fail nếu sai).
- Format theo `templates/content-style.md` + `templates/farming-template.md` — required core (mở đầu 1-2 dòng + `## Setup` + `## Profit math` + `## Failure Modes`) + optional menu, cắt section không có fact.
- Body ≤ 60 dòng — vượt chỉ khi mật độ fact thật sự cần.
- Mở đầu restate frontmatter metric inline: `Tier X · investment Y · ~Z div/h (YYYY-MM-DD)`.
- Mọi số market (profit, tablet cost, drop value) **kèm timestamp + nguồn**: `~3 div/cái (2026-06-05, poe2scout)`. Số không có timestamp = fabricate. Snapshot > 7 ngày → re-fetch trước khi quote.
- Game term (tablet, waystone, atlas keystone, unique, fragment, currency, Master) → `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` lần đầu.

## Format rules — cheat-sheet fact-dense

Chuẩn đầy đủ ở `templates/content-style.md`; restate cho farming doc:

1. **Fact-dense, zero narrative.** Mỗi dòng carry một fact/rule: atlas node, tablet loadout, drop rate, profit số, gate cơ chế. Cắt câu dẫn, câu chuyển, recap, "voice" cho người đọc.
2. **Bullet là đơn vị mặc định.** Mỗi bullet tự đứng được, một fact/rule per bullet. Prose chỉ khi chuỗi nhân-quả nhiều bước không nén được — tối đa 2-3 câu. KHÔNG bảng nhiều cột (site stack-column UI vỡ layout) cho atlas tree / tablet list.
3. **Fragment OK, arrow OK.** `tablet → hệ quả`, `input cost → output value → profit`. `✗/✓` cho anti-pattern/pattern. Không xưng hô ("mình/bạn" bỏ hết).
4. **Giữ 100% hard facts.** Nén là bỏ văn, KHÔNG bỏ fact: profit math, tablet slot rule, drop rate, exclusion. Mất fact = rewrite hỏng.
5. **Số market kèm timestamp + nguồn** (`~40 div (2026-06-15, poe2scout)`). Số không có timestamp = invalidate trong 1 tuần.
6. **Mỗi số/cơ chế một lần** ở section sở hữu nó (profit math ở Profit math, cơ chế ở Setup); chỗ sau chỉ nhắc + link, KHÔNG giảng lại multiplier. Số không tựa vào một quyết định reward thì cắt.
7. **POE2 vocabulary:** Waystone, Precursor Tablet (slot theo mod count waystone: 1-2=1, 3-5=2, 6+=3; City biome + Industrial Improvements → slot 4), Precursor Tower (nguồn rớt tablet, không phải nơi cắm), Atlas Passive Tree + mechanic subtree, Masters of the Atlas, fragment. KHÔNG có scarab. Currency: ex nền, div high-end.
8. **H1 = tên strategy, KHÔNG kèm league/patch.** Rewrite fresh: strategy đã chết theo patch (tablet removed, mod nerfed, content disabled) gỡ hẳn hoặc xoá doc; số stale thay thẳng kèm timestamp mới. Lịch sử chỉ ở `## Changelog` hoặc git.

## Linking (giá trị chính của corpus)

- Nhắc concept có doc riêng (mechanic, build phù hợp) → link inline `[Title](/route)` lần đầu. Route bỏ prefix `content/` + đuôi `.md`.
- Game term → `:wiki-link{url="https://www.poe2wiki.net/wiki/Exact_Name"}` lần đầu.
- `## Relationships` **bắt buộc khi có ≥1 doc liên quan trong corpus** — mỗi dòng `- **predicate** [Title](/route) — reason`. Predicate snake_case (`farming_relevance | related_mechanics | requires | supports | competes_with | source_research`…). **Link hai chiều**: farming A cần mechanic B → cả hai doc đều khai.

## Section structure — required core + optional menu

Theo `templates/farming-template.md`. **Cắt section không có fact, ĐỪNG pad, ĐỪNG lặp.** Heading validator-enforced giữ ĐÚNG literal (`## Failure Modes`, `## Relationships`); heading tự do thì ngắn, danh từ nói thẳng nội dung.

### Required core (luôn có)

1. **Mở đầu (không heading)** — 1-2 dòng: farm content gì → drop nào ra tiền. Restate metric inline `Tier X · investment Y · ~Z div/h (YYYY-MM-DD)`.
2. **## Setup** — atlas tree (cluster/node + why · subtree) · Masters (master + bonus) · tablets (loadout + why từng cái, slot theo mod count waystone) · waystone (T-tier + biome + density reason) · build floor (DPS/clear/survivability tối thiểu). Mỗi mục 1 bullet.
3. **## Profit math** — `profit/h = (drop_rate × stack × price) × maps/h − cost/map`. Mỗi input số **kèm timestamp + nguồn**. Cost/map: tablet/waystone/fragment.
4. **## Failure Modes** — **validator-enforced `required: true`, giữ ĐÚNG literal `## Failure Modes`**. ≥3 scenario gãy, mỗi cái 1 bullet `nguyên nhân → hậu quả`: saturation (giá compress khi nào) · sustain fail · build floor · patch nerf · break-even.

### Optional (include khi có fact, OMIT cả section khi không)

- **## Gameplay** — thứ tự trong map: activate gì trước → clear order → nhặt gì / bỏ gì → khi nào rời. Mỗi bước 1 bullet, không list 20 step.
- **## Optimization** — atlas node upgrade B→A, tablet roll min-max, bulk vs individual sale. Kiểm breakpoint trước khi quote uplift %.
- **## Alternatives** — strategy cạnh tranh + when to switch, mỗi cái 1 bullet.
- **## Changelog** — `### YYYY-MM-DD` reverse-chrono, mỗi ngày 1-3 bullet delta.
- **## Relationships** — bắt buộc khi có doc liên quan (xem Linking).

## Pre-write checklist

1. **Target file path** xác định (đã tồn tại).
2. **Frontmatter values** read: `strategy_tier`, `investment_tier`, `league`, `patch`, `league_phase`, `confidence_level`. Tier B mà profit claim 50 div/h = inconsistent → flag user.
3. **Số thật**:
   - Currency/item price → `/poe2scout` (nguồn giá duy nhất: price + volume + history) hoặc user fetch.
   - Bulk / live listing → `/trade` qua playwriter page-context fetch (KHÔNG curl direct GGG API per CLAUDE.md).
   - Personal testing → user cung cấp sample size + map count.
   - Số chưa có → placeholder `<!-- TODO: profit data, run /trade -->`, flag.
4. **Reference farming doc** — đọc 1-2 file `content/farming/` để spot `:wiki-link` usage + Relationships link hai chiều.

## Steps

### 1. Resolve target file
Path → `test -f`. Topic → `ls content/farming/*<slug>*.md`. Không tìm thấy → REFUSE + gợi ý tạo file mới theo `templates/farming-template.md`.

**Success criteria**: File path absolute, frontmatter readable.

### 2. Đọc context
Read target file. Đọc 1-2 farming doc khác. Đọc atlas tree mechanic doc nếu link.

**Success criteria**: Nắm tier, content type, key tablets.

### 3. Source data
- Currency/item price → `/poe2scout` (price + volume + Δ7d + history) hoặc user cung cấp manually.
- Trade bulk / live listing → user run `/trade <query>`.
- Personal experience → ask user sample size.

**Success criteria**: Profit claim có ≥1 evidence với timestamp.

### 4. Outline section (right-sized)
Chọn từ required core (4) + optional menu — chỉ lấy section có fact thật. Draft 1 dòng/section. Body ≤ 60 dòng. **Human checkpoint** — user duyệt outline.

**Success criteria**: User approve; không section nào dự kiến rỗng/mỏng.

### 5. Viết cheat sheet
Follow Format rules + Section structure. Atlas tree section: bullet group, KHÔNG bảng, KHÔNG list 50 node.

**Rules** (CẤM):
- Narrative / xưng hô / recap / câu dẫn không carry fact
- Số không có timestamp + nguồn
- Bảng (table) cho atlas tree / tablet list (site stack-column vỡ layout)
- Bỏ hard fact khi nén (profit math, slot rule, drop rate, exclusion)
- Game term không `:wiki-link` lần đầu

**Success criteria**: required core + đúng optional section có fact; mỗi bullet tự đứng; mọi số có timestamp; body ≤ 60 dòng; Relationships đủ + hai chiều khi có doc liên quan.

### 6. Self-test (content-style.md)
- Xóa ngẫu nhiên một bullet → mất fact hay chỉ mất văn? Mọi bullet phải "mất fact".
- AI grep "farm gì / lãi bao nhiêu / cắm tablet nào" → trúng dòng chứa đủ answer?
- Mọi số market có timestamp + nguồn? Số nào *giải thích* ở >1 chỗ → gộp còn một.
- Concept có doc riêng đã link? Relationships có chiều ngược?
- Body vượt 60 dòng → dòng nào đang là văn thay vì fact?

**Success criteria**: self-test pass.

### 7. Validate
Frontmatter khớp schema `content.config.ts` — chạy `bun run generate` để verify.

**Success criteria**: Exit 0.

### 8. Summary cho user
Báo file path, section status, body line count vs 60, `:wiki-link` count, validate result. Gợi ý next: `/poe2scout` để fact-check số giá, `/heal-links` cho relationships, commit.

**Success criteria**: User biết next step.
