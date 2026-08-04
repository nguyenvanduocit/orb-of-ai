# T-037: Áp right-sizing cho build/farming/character/guide template + skills
> Mở rộng pattern T-033 (required-core + optional-menu + right-sizing) sang các template content còn lại; enforce mandate Failure Modes ở validator; xoá Pantheon & Bandits (POE2 không có).
- **priority**: medium
- **effort**: M

## Problem
3 evaluation agent đọc toàn bộ content/ xác nhận cùng pattern T-033 ở các template khác (rigidity ở SKILL.md + body pre-fill, KHÔNG ở validator — mọi template đã `sections: ["*"]`):
- **build-template + write-build-tutorial** ("13 H2 theo đúng thứ tự") = offender nặng nhất. Smoking gun: `## Pantheon & Bandits` — POE2 KHÔNG có hệ Pantheon/Bandit (verified: no `Pantheon.md` wiki mirror, no poedb 0.5 system), nhưng 6/10 build doc vẫn mang section này, 3 doc tự thú "giữ để đúng cấu trúc template", và `monk/0-5-martial-artist-hollow-palm` **bịa ra** "Soul of the Brine King" pantheon → misinformation. `## Summary` ép bullet-recap toàn bài. Strengths & Limitations trùng Failure Modes. Resources ship placeholder "PoB: PENDING".
- **farming-template** ép `## Summary` + `## Quick Reference Card` (hai recap), Market Context trùng Failure Modes.
- **mechanics**: ~42% doc còn mang dấu 11-section English rigid (legacy — template/skill đã fix ở T-033; doc cũ là offender-list cho user).
- **guide-template**: `> **Quick Summary:**` blockquote meta-summary residue + `## Related Resources` trùng `## Relationships`.
- **character-progress-template**: đã lean, chỉ cần light pass.

vault-keeper nâng 1.2.0 → **1.3.0** (user nhắc): section semantics IDENTICAL (reorderSections byte-equal), full vault 43/43 valid; entropy 98 (frontmatter/lifecycle khoẻ — bloat là body-issue). `section-rules` hỗ trợ `required: true` trên named section (`template-section-rules.js:24`) → enforce mandate được ở validator.

## Goal
Tác giả viết build/farming/guide doc right-sized — cắt section không áp dụng, không pad, không lặp — với required-core domain-specific + mandate cứng (Failure Modes) enforce ở validator chứ không chỉ prose.

## Requirements
- Required-core **domain-specific** (advisor): build = intro + Build Overview + **Failure Modes** + Verdict; farming = intro + Strategy + **profit math** + **Failure Modes** + execution. Giữ `## Failure Modes` heading tiếng Anh (voice-lint whitelist).
- Enforce `## Failure Modes` `required: true` qua section-rules trên build + farming template (leverage 1.3.0). KHÔNG đụng `fields:` (confidence_level, pob_coverage, class…).
- **Xoá hẳn** Pantheon & Bandits khỏi build-template (clean-slate — POE2 không có, không phải "omit-when-NA").
- Bỏ `## Summary` ép recap (build + farming) → Verdict prose / giữ 1 Quick Reference Card.
- guide-template: bỏ Quick Summary blockquote, gộp Related Resources vào Relationships.
- Skill SKILL.md (build/farming/character): "N H2 theo thứ tự" → required-core + optional-menu + right-sizing + relevance-gated self-check (như T-033).
- Non-goal: KHÔNG mass-rewrite ~10 doc bloat — hand offender-list cho user greenlight. CHỈ dogfood martial-artist (kill fabrication) + fix 3 doc thiếu Failure Modes (để enforcement land).

## Criteria
- [x] build-template: Pantheon xoá, Summary→Verdict, Strengths gộp Failure Modes, required-core marked, `## Failure Modes` section-rules `required: true`, right-sizing header. `fields:` nguyên.
- [x] farming-template: Summary+Quick Reference Card → 1 card, Market Context risk fold Failure Modes, `## Failure Modes` required:true, right-sizing header.
- [x] character-progress-template + guide-template: light pass (guide bỏ Quick Summary + gộp Related Resources; right-sizing header).
- [x] write-build/farming/character SKILL.md: flexible required-core + optional-menu; build skill thêm Failure Modes vào section list (trước đây thiếu → là root cause docs bỏ section mandated).
- [x] Dogfood `monk/0-5-martial-artist-hollow-palm`: xoá fabricated Pantheon (Soul of the Brine King) + 3 Woolie source-leak + de-hype + Summary→Verdict + Strengths gộp FM + self-link. 16→14 H2, validate exit 0.
- [x] 4 build doc thiếu/sai Failure Modes (carry dash-subtitle, hollow-mask + twister rename Strengths→FM, plants-lich thêm FM + strip source-leak) → full vault 43/43 valid 100%.
- [x] vault-keeper 1.2.0→1.3.0 installed (section semantics unchanged, leverage section-rules required:true). Offender-list (bloat/voice) handed user — xem report.

## Gotcha (encode cho lần sau)
- section-rules `required: true` key theo **toàn bộ heading line** — inline `<!-- comment -->` trên heading line làm key = `## X <!-- ... -->` → mọi doc fail. Heading required PHẢI sạch `## Failure Modes`, comment để dòng riêng hoặc trong description.
