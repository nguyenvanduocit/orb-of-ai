# T-033: Mechanic template/skill quá cứng — section linh hoạt + right-sizing
> Bỏ ràng buộc 11-H2-cố-định trong write-mechanic-tutorial; cho AI chọn section theo độ phức tạp mechanic với guide required/optional + dùng-khi.
- **priority**: medium
- **effort**: S

## Problem
`write-mechanic-tutorial/SKILL.md` ép **11 H2 section "theo đúng thứ tự"** (`## Section structure`, line 97-152) + **self-check 8 trait BẮT BUỘC tick** (line 195-210) + Goal "11 H2 section theo đúng thứ tự" (line 36). Hệ quả: mọi doc — kể cả mechanic nhỏ/atomic — bị ép thành 11 section → bloat.

Bằng chứng:
- `content/mechanics/crafting/chance-heavy-belt-headhunter.md` (mechanic gambling đơn giản) phình thành 11 English section dài, user phản hồi "viết quá chừng".
- `content/mechanics/crafting/talisman-crafting.md` (right-sized, custom Vietnamese headings theo nội dung) validate **100% published** → validator KHÔNG hề yêu cầu 11 section.
- Template `sections:` (`templates/mechanic-template.md:4-10`) chỉ là **reorder-hint cho `/vault.fix`**, không validate presence — confirmed `node_modules/claude-code-vault-keeper/lib/canonical-formatter.js:171-213` ("Reorder body sections... unlisted slot in at `*`").

Rigidity nằm 100% ở SKILL.md guidance, không ở vault-keeper.

## Goal
AI tự chọn đúng số section khớp độ phức tạp mechanic — mechanic nhỏ ngắn gọn (3-4 section), league system lớn mới nhiều section — với guide nội bộ nói rõ section nào required, section nào optional, và mỗi optional dùng-khi-nào.

## Requirements
- Required core tối thiểu: intro (no heading) + 1 explanation section + 1 closing takeaway.
- Mọi section khác optional, mỗi cái kèm trigger "dùng khi / bỏ khi" explicit.
- Cho phép custom-named section (heading tiếng Việt sentence-case, không dash-subtitle).
- Self-check đổi từ "8 trait bắt buộc tick" → relevance-gated lenses + 1 check right-sizing (cắt section <2 câu nội dung thật).
- Giữ nguyên Voice rules 1-11 + numeric/entity/no-filler discipline (orthogonal — không đụng).
- Non-goal: KHÔNG đổi validator; template `sections:` chỉ chỉnh reorder-hint, existing docs vẫn pass.

## Criteria
- [x] SKILL.md `## Section structure` rewrite: required-core + optional-menu-with-triggers + right-sizing principle; bỏ "H2 tiếng Anh mandatory" (Vietnamese sentence-case default, no dash-subtitle).
- [x] SKILL.md self-check 6a → relevance-gated lenses + right-sizing check; Goal + step 4/5 success-criteria bỏ "11 H2".
- [x] `templates/mechanic-template.md` body = required-core skeleton + commented optional menu (dùng-khi/bỏ-khi); `sections:` = `["*","version-history","relationships"]`.
- [x] `chance-heavy-belt-headhunter.md` right-sized theo model mới (11→7 H2, 78 lines, 4-way redundancy collapsed), `bun run validate` exit 0.
- [x] `talisman-crafting.md` + orb doc vẫn `bun run validate` exit 0 — full mechanics folder 42/42 valid (no regression).
