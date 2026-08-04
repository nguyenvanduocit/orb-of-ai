# T-040: Voice lexicon + lint hook v2 — chặn calque/AI-ese ở tầng viết

> Audit 92 docs content/ tìm ra ~10 nhóm lỗi văn dịch/AI-ese hệ thống; nâng control từ rule trừu tượng lên lexicon cụ thể + hook enforce tự động.

- **priority**: high
- **effort**: M

## Problem

Voice rule hiện tại (CLAUDE.md `## Content Writing Voice`, memory `feedback_natural_game_native_voice`, write-* skills) là **rule trừu tượng** ("viết tự nhiên", "không văn dịch") — writer agent không có danh sách từ/cụm CỤ THỂ bị cấm nên tái phạm hàng loạt. Audit 2026-06-10 (3 agent đọc đủ 92 docs):

- Calque «trục» (axis) ~35-100% docs tuỳ folder, «đòn bẩy», «cốt lõi» (22 hits), «đáng kể» (42), «trả về», «vòng lặp»
- Động từ sai context: «dựng Whirlwind», «cấp flat lightning», «chèn support», «quăng Twister đi qua»
- AI pivot tics: «— đây là lý do/cách» (55+ hits), «Hệ quả thực tế:» (~9 file), «Điều này có nghĩa là», «Đây là X» mở bài (~90% build docs), em-dash 50-68/doc
- Cấu trúc: «Sai:/Đúng:» audit-style (refutation.md, stormweaver), heading English nguyên file (refutation.md), heading dạng câu hỏi «Tại sao X?» (~6 file)
- Register: «bạn»/«người chơi»/«mình» trộn lẫn trong + giữa file; 1 file dùng «mày»

Hook `content-voice-lint.sh` (T-022) mới bắt 2 pattern (dash-subtitle + gạch nối VN) — quá hẹp.

## Goal

AI viết content mới ra văn game-native tự nhiên ngay lần đầu, không cần user bắt lỗi văn dịch lại.

## Requirements

- Một nguồn lexicon canonical `templates/voice-lexicon-vi.md`: banned → preferred kèm ví dụ thật từ corpus, để writer (người + agent) load trước khi viết.
- Hook `content-voice-lint.sh` v2: bắt mọi pattern grep-được với độ chính xác cao (false positive thấp), output cap để không spam context, vẫn non-blocking exit 0.
- 4 write-* SKILL.md + CLAUDE.md voice section + memory trỏ về lexicon (single source).
- Non-goal: KHÔNG tự động fix corpus cũ trong card này (batch rewrite 92 docs là việc riêng, cần user quyết scope).

## Criteria

- [ ] `templates/voice-lexicon-vi.md` tồn tại, cover đủ các nhóm lỗi audit tìm ra, mỗi entry có thay thế + ví dụ.
- [ ] Hook v2: echo JSON giả lập Write vào file vi phạm (twister build) → additionalContext liệt kê đúng pattern, capped; file sạch → silent; exit 0 mọi nhánh.
- [ ] 4 write-* SKILL.md có rule tra lexicon; CLAUDE.md voice section có bullet banned-lexicon; memory cập nhật.
