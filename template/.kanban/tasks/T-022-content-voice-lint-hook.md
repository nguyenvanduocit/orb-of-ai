# T-022: Content voice-lint hook (PostToolUse, chặn anti-pattern lúc ghi)
> PostToolUse hook scan Write/Edit vào content/**/*.md, cảnh báo các anti-pattern voice grep được (dash-subtitle heading, gạch nối từ Việt, homophone) ngay lúc ghi.

- **priority**: medium
- **effort**: S

## Problem
Voice rule "natural game-native" (memory `feedback_natural_game_native_voice`) bị vi phạm lặp lại — bài Spirit Walker Companion Army draft đầu (2026-06-04) lại ra dash-subtitle heading + câu dịch gượng + "đàn-đông"/"đàn đông", user phải bắt tay 3 lần.

Root cause đã xác định (không phải đãng trí):
1. Doc cũ dùng làm style anchor (vd `0-5-spirit-walker-companion-zoo.md` có 9 dash-subtitle heading) → khi viết doc mới, rule "match sibling style" làm kế thừa luôn voice cũ.
2. Specifics chỉ sống trong file memory → load vào session chỉ là 1 dòng index, quá yếu để đè khuôn sibling đang đập vào mắt.
3. Không có gate nào chặn lúc ghi.

Đã vá surface luôn-được-load (CLAUDE.md `## Content Writing Voice` + write-build-tutorial SKILL.md rule 6) — nhưng đó là instruction, vẫn dựa vào việc tự tuân. Còn thiếu một **enforcement gate cơ học**.

## Goal
Mỗi lần ghi/sửa file `content/**/*.md`, các anti-pattern voice grep được bị flag ngay (system-reminder) để sửa trước khi đóng — không đợi user đọc bắt lỗi.

## Requirements
- PostToolUse hook (settings.json) match `Write|Edit|MultiEdit`, chỉ chạy khi path khớp `content/**/*.md` (bỏ qua `content/**/index.md` theo exclude của vault-keeper).
- Script (`.claude/skills/<nơi-phù-hợp>/scripts/` hoặc `.claude/hooks/`) grep các pattern cơ học:
  - Dash-subtitle heading: `^##+ .+ — ` (trừ heading canonical như `## Failure Modes — N ...` nếu muốn whitelist).
  - Gạch nối từ Việt đáng ngờ: `đàn-đông`, `nguyên-đàn`, và homophone list (`đàn đông`).
  - (Optional) Title Case heading tiếng Việt (nhiều từ viết hoa liên tiếp).
- Output là **cảnh báo non-blocking** (emit system-reminder/warning, exit 0) — KHÔNG block write (tránh chặn thao tác hợp lệ); chỉ nhắc.
- Whitelist được (vd canonical section name) để tránh false-positive ồn.
- KHÔNG đụng prose của user, chỉ đọc + cảnh báo.

## Criteria
- [x] Hook fire khi Write/Edit vào `content/builds/x.md` có `## A — B` → in cảnh báo nêu đúng dòng.
- [x] Hook im khi file content sạch anti-pattern.
- [x] Hook KHÔNG fire cho file ngoài `content/` hoặc file `index.md` excluded.
- [x] Homophone list bắt được `đàn đông` / `đàn-đông`.
- [x] Exit 0 luôn (non-blocking), verified bằng một write thử có + không có vi phạm.
- [x] settings.json hợp lệ (hook load được, `claude` không báo lỗi config).
