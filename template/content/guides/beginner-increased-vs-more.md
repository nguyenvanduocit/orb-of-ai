---
template: templates/guide-template.md
document_type: guide
title: "Increased vs More: quy tắc tính damage"
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
guide_type: fundamentals
tags:
  - poe2
  - 0-5
  - beginner
  - damage
  - support-gem
  - passive-tree
  - scaling
---

# Increased vs More: quy tắc tính damage

**Increased Damage** và **More Damage** trông giống nhưng tính khác hẳn → biết để đánh giá đúng support gem / passive node nào đáng lấy.

## Increased = cộng 1 pool · More = nhân riêng
- Mọi nguồn **Increased** (tree + gear + gem) cộng chung 1 pool → `damage = base × (1 + ΣIncreased)`
- Mọi nguồn **More** nhân riêng lên toàn bộ damage hiện có, không quan tâm pool Increased
- Nhiều More nhân chồng: More 20% × More 30% = 1.2 × 1.3 = **1.56×** (56%, không phải +50%)

Ví dụ base 100:

| Trạng thái | Damage | Δ từ mốc trước |
|-----------|--------|---|
| 200% Increased | 100×(1+2.0) = 300 | — |
| +50% Increased (pool 250%) | 100×(1+2.5) = 350 | +17% |
| thay bằng More 20% | 300×1.2 = 360 | +20% |

## Càng nhiều Increased → More càng đáng
- Increased có diminishing return: pool càng lớn, mỗi 50% thêm càng ít %; More luôn nhân ngoài pool nên giữ nguyên giá trị

| Pool Increased sẵn (base 100) | +50% Increased | More 20% |
|------|------|------|
| 400% (dmg 500) | 550 → +10% | 600 → +20% |
| 900% (dmg 1000) | +5% | +20% |

- Build endgame săn More multiplier thay vì chồng thêm Increased

## Support gem + notable thường là More
- Support gem POE2 hầu hết mang **More** — nguồn sức mạnh chính; More 30% = mọi thứ build có +30% không trừ hao
- Một số ascendancy notable cấp More → dấu hiệu node thiết kế để tạo bước nhảy damage lớn
- Chọn support: con số More trên gem = mức tăng damage thực tế, bất kể tree có bao nhiêu Increased, không giảm khi stack nhiều

## Relationships

- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — guide cơ bản tương đương, giải thích reservation theo cùng góc beginner
- **related** [Skill gem và Support gem: hệ thống Uncut Gem của POE2](/guides/beginner-skill-gem) — support gem là nguồn More multiplier chính, gắn thế nào
- **related** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — ví dụ thực tế More multiplier trong companion build (4 trục nhân damage con carry)
- **related** [Critical Hit: crit chance và crit damage bonus](/guides/beginner-critical-hit) — additive vs multiplicative để đánh giá modifier crit.
- **related** [Các keyword damage quan trọng: Exposure, Penetration, Armour Break, Culling](/guides/beginner-damage-keywords) — Penetration là More multiplier độc lập với pool Increased.
- **related** [Các loại damage: Physical, Elemental, Chaos, Hit và DoT](/guides/beginner-damage-types) — sau damage type là hiểu increased vs more.
