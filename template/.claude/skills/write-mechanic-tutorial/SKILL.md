---
name: write-mechanic-tutorial
description: Viết hoặc polish mechanic guide trong content/guides/ (flat) hoặc content/crafting/ theo chuẩn cheat-sheet fact-dense cho AI reader (templates/content-style.md + templates/mechanic-template.md) — bullet tự đứng, fragment/arrow OK, giữ 100% hard facts, wiki-link game term. Trigger — "viết mechanic doc", "giải thích cơ chế", "tutorial mechanic", "write mechanic guide", "doc về <league/skill/item>", "polish mechanic doc".
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
when_to_use: Use when user asks to write, draft, or polish a mechanic guide in content/guides/ (flat) or content/crafting/. Triggers — "viết mechanic doc", "giải thích cơ chế X", "tutorial mechanic", "write mechanic guide", "doc về Mirage/Breach/Harvest/Spectre/Doryani's...", "polish mechanic doc", "explain mechanic".
argument-hint: "<topic | content/guides/file.md>"
arguments:
  - topic_or_path
context: inline
---

# write-mechanic-tutorial — Viết mechanic cheat sheet cho AI reader

Skill này viết mechanic guide trong `content/guides/` (flat — phân loại bằng frontmatter `sub_class`) hoặc `content/crafting/` (top-level, ngang hàng `farming/`) theo **chuẩn cheat-sheet fact-dense** của `templates/content-style.md` + `templates/mechanic-template.md`. Reader chính là AI agent — tối ưu cho scan nhanh + trích fact chính xác, KHÔNG phải người đọc tuần tự.

## Inputs

- `$topic_or_path` — Một trong:
  - **Path** đến file đã có (vd `content/guides/return-of-the-ancients.md`) → rewrite full content giữ frontmatter schema
  - **Topic** ngắn (vd `mirage`, `spectre`, `doryanis prototype`) → skill glob lookup. File chưa có → REFUSE, gợi ý tạo file mới theo template tương ứng trong `templates/` trước.

## Goal

File `.md` trong `content/guides/` (hoặc `content/crafting/` cho craft walkthrough) với:

- Frontmatter khớp schema `content.config.ts` (build `bun run generate` fail nếu sai).
- Format theo `templates/content-style.md` + `templates/mechanic-template.md` — required core (mở đầu 1-2 dòng + 1 section cơ chế) + optional menu, số section khớp độ phức tạp.
- Body ≤ 50 dòng — mechanic atomic → 2-3 section; league system → tối đa 6-7.
- Mọi số (damage scaling %, drop rate %, charge gain, breakpoint) **chính xác từ in-game / poewiki / poedb**, không guess. Ambiguity chưa verify → ghi thẳng `chưa verify in-client: <điểm nghi>` một lần.
- Game term (skill, support, item, monster, keystone, currency) → `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` lần đầu.

## Format rules — cheat-sheet fact-dense

Chuẩn đầy đủ ở `templates/content-style.md`; restate cho mechanic doc:

1. **Fact-dense, zero narrative.** Mỗi dòng carry một fact/rule: trigger → hành vi → outcome, số quan trọng, breakpoint, exclusion, mod wording nguyên văn. Cắt câu dẫn, câu chuyển, recap, "voice" cho người đọc.
2. **Bullet là đơn vị mặc định.** Mỗi bullet tự đứng được, một fact/rule per bullet. Prose chỉ khi chuỗi nhân-quả nhiều bước không nén được — tối đa 2-3 câu.
3. **Fragment OK, arrow OK.** `trigger → hành vi → outcome`, `A + B → effect`. `✗/✓` cho anti-pattern/pattern. Không xưng hô ("mình/bạn" bỏ hết).
4. **Giữ 100% hard facts.** Nén là bỏ văn, KHÔNG bỏ fact. Mất một số/breakpoint/exclusion = rewrite hỏng.
5. **Số kèm nguồn/mốc.** `4% chance`, `+130 Attributes` — kèm nguồn (wiki/poedb/in-client test); market data kèm timestamp; số cơ chế dễ đổi kèm patch.
6. **Mỗi worked example/số/cơ chế một lần** ở section sở hữu nó; chỗ sau chỉ nhắc + link. ĐỪNG lặp cùng phép tính (`200k armour vs hit 5000 → 80%`) ở nhiều section — đó là cách doc phình. Caveat (verify in-client / wiki lag) nói một lần.
7. **Table cho data enumerable** (breakpoint ladder, so sánh mod). Bold key term lần đầu.
8. **H1 = tên mechanic, KHÔNG kèm league/patch.** Rewrite fresh: interaction/item đã chết theo patch gỡ hẳn, lịch sử chỉ ở `## Version History` hoặc git — doc hiện tại chỉ trạng thái đúng-bây-giờ.

## Linking (giá trị chính của corpus)

- Nhắc concept có doc riêng (build, mechanic khác) → link inline `[Title](/route)` lần đầu. Route bỏ prefix `content/` + đuôi `.md`.
- Game term → `:wiki-link{url="https://www.poe2wiki.net/wiki/Exact_Name"}` lần đầu.
- `## Relationships` **bắt buộc khi có ≥1 doc liên quan trong corpus** — mỗi dòng `- **predicate** [Title](/route) — reason`. Predicate snake_case (`related_mechanics | synergizes_with | used_by | references | competes_with | source_research`…). **Link hai chiều**: mechanic A dùng bởi build B → cả hai doc đều khai.

## Section structure — required core + optional menu

Theo `templates/mechanic-template.md`. **Số section khớp độ phức tạp mechanic, KHÔNG ép bộ cố định.** Mechanic atomic (một crafting trick, một interaction) → 2-3 section; league system phức tạp → tối đa 6-7. Thêm section mỏng/rỗng cho "đủ template" là vi phạm. Heading validator-enforced giữ ĐÚNG literal (`## Version History`, `## Relationships`); heading tự do thì ngắn, danh từ nói thẳng nội dung (`## Cơ chế`, `## Interactions`, `## Anti-patterns`, hoặc custom sát nội dung).

### Required core (mọi doc đều có)

1. **Mở đầu (không heading)** — 1-2 dòng: cơ chế là gì + visual/tooltip anchor nếu có · build/ai đang dùng (named hoặc % poe.ninja).
2. **Một section cơ chế** (`## Cơ chế` hoặc tên sát nội dung) — spine của doc. Mỗi bullet `trigger/điều kiện → hành vi → outcome`; số quan trọng (base %, duration, cap, breakpoint) kèm nguồn. Ambiguity → ghi thẳng `chưa verify in-client: <điểm nghi>` một lần, không rải.

### Optional menu (chỉ thêm khi mechanic THẬT SỰ cần)

- **Toán/breakpoint** — **dùng khi** có scaling đa nguồn hoặc phép tính không tầm thường (DPS/EHP/break-even/xác suất); **bỏ khi** thuần định tính. Line-item dẫn tới số cuối (`- Entity (source) — số` … `**Total — số**`); mọi số lớn truy được về derivation đã show. Single source → một bullet "single source <X>, không có chain".
- **## Interactions** — **dùng khi** synergy/anti-synergy đáng kể; **bỏ khi** standalone. Mỗi interaction `[A] + [B] → effect — why (cơ chế underlying)` + `Exclusion check: <none | list>` (xem Interaction Verification Protocol trong CLAUDE.md hoặc agent `interaction-mapper`). Modifier dễ nhầm → compare verbatim 2 wording + hệ quả.
- **## Anti-patterns** (cái không hoạt động / lỗi tốn kém) — **dùng khi** có kỳ vọng sai phổ biến; mỗi bullet `✗ [kỳ vọng sai] → thực tế [X], cost [Y]`. **Bỏ khi** không có.
- **Chi phí & ràng buộc** — **dùng khi** setup có currency cost / exclusion / gating thật; **bỏ khi** free + unrestricted.
- **## Version History** — **dùng khi** lịch sử patch ảnh hưởng tính hợp lệ của advice; `### Patch X.Y.Z` reverse-chrono, mỗi patch 1-3 bullet delta. **Bỏ khi** chưa có lịch sử đáng kể.
- **Custom section** — tự do tạo section đặt tên sát nội dung khi menu trên không phủ (vd `## Farm white base ở đâu`, `## Mô hình xác suất trúng`).
- **## Relationships** — bắt buộc khi có doc liên quan (xem Linking).

## Pre-write checklist

1. **Target file path** xác định.
2. **Folder routing đúng** — crafting walkthrough → `content/crafting/`; mọi mechanic guide khác (skill, item, league, class, atlas) → `content/guides/` flat, phân loại bằng frontmatter `sub_class` (skills/items/leagues/classes/atlas). Sai folder → REFUSE.
3. **Số chính xác** — Wiki/poedb cho percent, drop rate, scaling. KHÔNG curl direct GGG API. Dùng `/poewiki`, `/poedb` skill.
4. **Ví dụ số thật** — mechanic apply tới character → đọc `content/characters/*.json` qua `jq`. Economy/crafting/league mechanic không gắn character → ground bằng số live (market snapshot, empirical run, wiki/poedb).

## Steps

### 1. Resolve target file
Path → verify. Topic → glob `content/{guides,crafting}/*<slug>*.md`. Không tìm thấy → REFUSE + gợi ý tạo file mới theo template tương ứng trong `templates/`.

**Success criteria**: File path absolute, đúng subfolder cho mechanic type.

### 2. Đọc context
Read target file. Đọc 1-2 mechanic doc cùng subfolder để spot `:wiki-link` usage + Relationships link hai chiều.

**Success criteria**: Nắm mechanic type, scope.

### 3. Source data
- Wiki/poedb facts → `/poewiki <term>`, `/poedb`.
- Personal example → đọc character JSON qua `jq`.
- Interaction chưa chắc → verify per Interaction Verification Protocol (CLAUDE.md) hoặc `interaction-mapper`.

**Success criteria**: ≥3 số chính xác sẵn sàng cite + (nếu apply) 1 ví dụ số thật.

### 4. Outline section (right-sized)
Chọn section từ required core (mở đầu + cơ chế) + optional menu — chỉ lấy section có fact thật. Draft 1 dòng/section. Mechanic atomic → dừng ở 2-3 section; league/skill phức tạp → tối đa 6-7. Body ≤ 50 dòng. **Human checkpoint** — user duyệt danh sách section để bắt sớm nếu thừa/thiếu.

**Success criteria**: User approve; không section nào dự kiến rỗng/mỏng.

### 5. Viết cheat sheet
Follow Format rules + Section structure.

**Rules** (CẤM):
- Narrative / xưng hô / recap / câu dẫn không carry fact
- Số guess; số cơ chế không kèm nguồn
- Bỏ hard fact khi nén (số, mod wording, breakpoint, exclusion)
- Game term không `:wiki-link` lần đầu
- Lặp cùng worked example/số ở >1 section

**Success criteria**: required core + đúng optional section có fact; mỗi bullet tự đứng; ground bằng ≥1 số thật; body ≤ 50 dòng; Relationships đủ + hai chiều khi có doc liên quan.

### 6a. Self-test (content-style.md, BẮT BUỘC trước Validate)
- Xóa ngẫu nhiên một bullet → mất fact hay chỉ mất văn? Mọi bullet phải "mất fact".
- AI grep "X hoạt động thế nào / breakpoint bao nhiêu / interaction gì" → trúng dòng chứa đủ answer?
- Mỗi số lớn truy được về derivation/nguồn đã show? Số nào *giải thích* ở >1 chỗ → gộp còn một.
- Game term có `:wiki-link` lần đầu? Concept có doc riêng đã link? Relationships có chiều ngược?
- Body vượt 50 dòng (hoặc 6-7 section) → section/dòng nào đang là văn thay vì fact?

Gate FAIL → loop back step 5. KHÔNG bypass.

**Success criteria**: 5 self-test pass.

### 6b. Validate
Frontmatter khớp schema `content.config.ts` — chạy `bun run generate` để verify.

**Success criteria**: Exit 0.

### 7. Summary cho user
File path, section status, body line count vs 50, `:wiki-link` count, validate result. Next: review, fact-check qua `/poewiki`, commit.

**Success criteria**: User biết next step.
