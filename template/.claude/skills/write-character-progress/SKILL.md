---
name: write-character-progress
description: Viết hoặc update character progress note trong content/characters/ theo chuẩn cheat-sheet fact-dense cho AI reader (templates/content-style.md + templates/character-progress-template.md) — snapshot số live từ pob.sh fetch, bullet tự đứng, giữ 100% hard facts, wiki-link game term. Trigger — "update character progress", "log character", "ghi tiến độ character", "write character note", "character tracker", "update progress log".
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
  - Bash(.claude/skills/pob/scripts/pob.sh:*)
when_to_use: Use when user asks to write, update, or polish a character progress note in content/characters/. Triggers — "update character progress", "log character", "ghi tiến độ character X", "write character note", "character tracker", "update progress log", "thêm log session cho character", "snapshot character".
argument-hint: "<topic | content/characters/file.md>"
arguments:
  - topic_or_path
context: inline
---

# write-character-progress — Character tracking cheat sheet cho AI reader

Skill này viết hoặc update character progress note trong `content/characters/` theo **chuẩn cheat-sheet fact-dense** của `templates/content-style.md` + `templates/character-progress-template.md`. Đây là **live-tracking note**: snapshot số live tại thời điểm fetch + log reverse-chrono. Reader chính là AI agent — tối ưu cho scan nhanh + trích fact chính xác.

## Inputs

- `$topic_or_path` — Một trong:
  - **Path** đến file (vd `content/characters/the-leader-a.md`) → update existing note
  - **Topic** = character name (vd `TheLeader_A`, `the-leader-a`) → glob lookup, hoặc REFUSE + gợi ý tạo file mới theo `templates/character-progress-template.md` nếu chưa tồn tại.

## Goal

File `.md` trong `content/characters/` với:

- Frontmatter khớp schema `content.config.ts` (build `bun run generate` fail nếu sai).
- Format theo `templates/content-style.md` + `templates/character-progress-template.md` — required core (mở đầu 1 dòng + `## Snapshot` + `## Goals` + `## Progress Log`) + optional (`## Gear`, `## Challenge Tracking`). Body ≤ 50 dòng.
- **Snapshot** lấy số live từ `.claude/skills/pob/scripts/pob.sh fetch "<charname>" [--spectre "<name>"]`, timestamp bắt buộc ngay dưới heading. Số current state, KHÔNG static từ frontmatter. DPS ≥ 100k kèm derivation/PoB link.
- **Progress Log** entry mới ở TOP với `### YYYY-MM-DD` (reverse-chrono), 1-3 bullet delta/ngày.
- Game term (item, skill, spectre type, unique, currency drop) → `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` lần đầu.

## Format rules — cheat-sheet fact-dense

Chuẩn đầy đủ ở `templates/content-style.md`; restate cho character note:

1. **Fact-dense, zero narrative.** Mỗi dòng carry một fact: stat number, goal cụ thể, gear bottleneck, session delta. Cắt câu dẫn, recap, "voice" cho người đọc.
2. **Bullet là đơn vị mặc định.** Mỗi bullet tự đứng được, một fact per bullet. Snapshot = stat dump bullet; Progress Log entry = 1-3 bullet delta, không đoạn văn narrative.
3. **Fragment OK, arrow OK.** `slot → mod cần`, `clear X map → drop Y → profit Z`. Không xưng hô ("mình/bạn" bỏ hết).
4. **Giữ 100% hard facts.** Nén là bỏ văn, KHÔNG bỏ fact: stat number, res cap, DPS, drop count, profit.
5. **Số kèm mốc.** Snapshot fetch timestamp bắt buộc; drop/profit trong log kèm ngày (là header entry). DPS ≥ 100k → derivation/PoB link.
6. **Snapshot/Gear/Goals luôn ở thì hiện tại.** Rewrite thẳng thành số/gear/goal current mỗi lần update — KHÔNG để số cũ rồi chú thích "(đã đổi)", KHÔNG chừa gear cũ "để so sánh". `## Progress Log` là chỗ DUY NHẤT mang tính thời gian.
7. **Table/definition-list cho stat block** (Snapshot). Bold key term lần đầu.
8. **H1 = tên character + "Progress Tracker", KHÔNG kèm league/patch** (frontmatter đã có).

## Linking

- Game term → `:wiki-link{url="https://www.poe2wiki.net/wiki/Exact_Name"}` lần đầu.
- Concept có doc riêng (build doc character đang chạy, mechanic) → link inline `[Title](/route)`.
- `## Relationships` **bắt buộc khi có ≥1 doc liên quan** (tối thiểu: build doc character đang chạy) — mỗi dòng `- **predicate** [Title](/route) — reason`. Predicate snake_case (`follows_build | related | references`…). **Link hai chiều**: character theo build X → build doc cũng khai `used_by` / `related` ngược.

## Section structure — required core + optional

Theo `templates/character-progress-template.md`. **Cắt section không dùng, ĐỪNG pad.** Heading giữ ĐÚNG literal để nhất quán schema.

### Required core

1. **Mở đầu (không heading)** — 1 dòng: class/asc/level + stage (campaign/mapping/endgame/40-40) + goal chính.
2. **## Snapshot** — `Last fetch: YYYY-MM-DD via pob.sh fetch <charname>` ngay dưới heading. Stat dump bullet: Life/ES · EHP · Armour/Eva · Block · Res (F/C/L/Chaos) · Max hit per type · DPS (+ spectre/totem multiplier nếu summon; ≥100k kèm derivation) · charges max · MS.
3. **## Goals** — 2-5 goal cụ thể, actionable, priority order, mỗi goal 1 bullet kèm expected outcome.
4. **## Progress Log** — reverse-chrono. `### YYYY-MM-DD` entries, mỗi ngày 1-3 bullet delta (làm gì · drop gì · upgrade nào).

### Optional (KHÔNG required — thêm khi có fact)

- **## Gear** — bottleneck slot + mod cần · **Biggest upgrade** cuối section. Item → `:wiki-link`. Không full item dump — chỉ bottleneck.
- **## Challenge Tracking** — chỉ khi character chase 40/40 hoặc challenge bundle cụ thể. Status N/40, phase reference, checklist. Đặt giữa Gear và Progress Log.
- **## Relationships** — bắt buộc khi có doc liên quan (xem Linking).

## Pre-write checklist

1. **Target file path** xác định.
2. **Character name chính xác** từ frontmatter `character_name:` — match exact với in-game name (case-sensitive cho pob.sh).
3. **Spectre type** (nếu summon build) — pob.sh cần `--spectre "<Type>"` để tính minion DPS đúng. Xem CLAUDE.md cho character hiện tại (vd TheLeader_A → Wretched Defiler).
4. **Mode**: full update (rewrite required core) / log-only (append Progress Log entry) / snapshot-only (refresh Snapshot). Hỏi user nếu mơ hồ.

## Steps

### 1. Resolve target file
Path → `test -f`. Topic → `ls content/characters/*<slug>*.md`. Không tìm thấy → REFUSE + gợi ý tạo file mới theo `templates/character-progress-template.md`.

**Success criteria**: File path absolute, frontmatter readable.

### 2. Determine mode
Hỏi user (hoặc infer từ `$topic_or_path`):
- **Full update** — rewrite required core, refetch live data.
- **Log-only** — append `### YYYY-MM-DD` entry vào Progress Log, không touch section khác.
- **Snapshot-only** — refresh Snapshot section, không touch logs/goals.

**Success criteria**: Mode rõ ràng.

### 3. Live PoB fetch (full update / snapshot-only)
Run `.claude/skills/pob/scripts/pob.sh fetch "<character_name>" [--spectre "<spectre>"]`. Output → `content/characters/<slug>.json` + `<slug>.summary.json` + `<slug>-pob.txt`. Dùng `jq` để extract số cho Snapshot.

**Success criteria**: JSON file timestamp = today, ≥10 stat fields readable.

### 4. Outline (full update only)
Draft 1 dòng/section nói updates gì. Body ≤ 50 dòng. **Human checkpoint** — user duyệt nếu rewrite full.

**Success criteria**: Mode `full update` → user approve. Mode `log-only`/`snapshot-only` → skip step.

### 5. Viết / append cheat sheet
- **Full update**: viết required core + optional có fact theo Section structure.
- **Log-only**: prepend `### YYYY-MM-DD` entry ở TOP của Progress Log (1-3 bullet delta). Cập nhật `updated:` + `level:`/`current_progress:` nếu user mention thay đổi.
- **Snapshot-only**: replace Snapshot block, cập nhật `updated:`.

**Rules** (CẤM):
- Narrative / xưng hô / recap không carry fact
- Progress Log entry văn dài (chuyển 1-3 bullet delta)
- Số stale (Snapshot không live fetch trong session này = stale); DPS ≥ 100k không kèm derivation
- Số cũ chú thích "(đã đổi)" thay vì rewrite thẳng; game term không `:wiki-link` lần đầu

**Success criteria**: File saved, frontmatter `updated:` = today; Snapshot có fetch timestamp; body ≤ 50 dòng; Relationships đủ + hai chiều khi có doc liên quan.

### 6. Validate
Frontmatter khớp schema `content.config.ts` — chạy `bun run generate` để verify.

**Success criteria**: Exit 0.

### 7. Summary cho user
File path, mode (full/log/snapshot), section đã touch, `:wiki-link` count, validate result. Next: commit, hoặc continue session log later.

**Success criteria**: User biết next step.
