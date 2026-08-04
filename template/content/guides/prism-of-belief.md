---
template: templates/mechanic-template.md
document_type: mechanic
title: Prism of Belief
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
sub_class: items
tags:
  - item
  - unique
  - jewel
  - skill-gem-level
  - poe2
  - mechanic
---

# Prism of Belief

Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Diamond"} jewel (:wiki-link{url="https://www.poe2wiki.net/wiki/Prism_of_Belief"}), luôn drop **đã corrupted** từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_Arbiter_of_Ash"} (drop-restricted → không chance được). Đúng một explicit mod `+(1–3) to Level of all [Specific Skill] Skills`; skill roll ngẫu nhiên lúc tạo, khoá vĩnh viễn vì corrupted. Build scale chủ đạo bằng gem level skill chính đều săn đúng roll.

## Chỉ số

```
Prism of Belief
Diamond
Limited To: 1
Requires Level 20
──────────────────────────────────────────────
+(1–3) to Level of all [Specific Skill] Skills
Corrupted

"Entropy can be reversed."
```

- Sample roll thực tế: "+1 to Level of all :wiki-link{url="https://www.poe2wiki.net/wiki/Rain_of_Arrows"} Skills" — tên skill thay `[Specific Skill]` ngay khi drop.

## Cơ chế

- Hai trục random độc lập: (1) chọn skill từ TOÀN BỘ :wiki-link{url="https://www.poe2wiki.net/wiki/Active_skill_gem"} active skill gem + :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_gem"} spirit gem; (2) chọn số 1/2/3 → cùng skill có thể +1 hoặc +3, phải thắng cả hai trục.
- Corrupted → :wiki-link{url="https://www.poe2wiki.net/wiki/Divine_Orb"} hay currency nào cũng không đổi roll; không có bước activate/re-roll khi socket.
- Pool hợp lệ gồm persistent buff gem (:wiki-link{url="https://www.poe2wiki.net/wiki/Discipline"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Vitality"}) + :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Spectre"} → gem level ảnh hưởng trực tiếp sức mạnh companion/spectre (quan trọng cho companion/necromancer build).
- "Level of all [Skill] Skills" → mọi bản cài skill đó nhận bonus cùng lúc (một jewel nâng cả hai gem setup).
- Limited to 1: mỗi character một Prism, không stack.

## Interactions

- Gem level scale base value: damage, AoE, projectile-per-level, debuff-value-per-level — mọi stat phụ thuộc level lên đồng thời.
- Spirit gem roll: Discipline +3 → ES flat cao hơn; Vitality +3 → life regen nhiều hơn.
- Ưu tiên +3 hơn +1: gap giá trị +1↔+3 cùng skill thường lớn hơn gap giữa hai skill khác ở cùng roll value.

## Anti-patterns

- ✗ Build scale từ flat weapon damage (Verisium Runeforging flat phys), main skill chỉ là delivery vehicle → gem level không đổi output.
- ✗ Damage đến từ support-gem-chain interaction, không từ active skill level.
- ✗ Trade +1 roll thay vì rare jewel tốt (resist+life+damage) — rare jewel đôi khi lời hơn Prism roll kém; jewel socket có hạn.
- Market: phần lớn drop từ Arbiter roll skill không ai chơi → build mua đúng roll từ trade; build count đa dạng nên roll nào cũng có người cần.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Fixed bug Prism roll modifier cho :wiki-link{url="https://www.poe2wiki.net/wiki/Solar_Orb"} — Solar Orb loại khỏi pool eligible.

### Patch 0.4.0d
- Fixed bug :wiki-link{url="https://www.poe2wiki.net/wiki/Living_Bomb"} không roll được — Living Bomb thêm lại vào pool.

### Patch 0.3.0
- :wiki-link{url="https://www.poe2wiki.net/wiki/Flammability"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Hypothermia"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Conductivity"} gộp vào :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"} → ba curse không roll được nữa. Item đang cầm không bị ảnh hưởng. [Undocumented]

### Patch 0.1.0
- Item giới thiệu.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — The Arbiter of Ash là endgame boss drop source, gắn hệ endgame 0.5.
- **related** [0.5 New Unique Items Overview](/guides/0-5-new-unique-items) — overview unique 0.5.
- **synergizes_with** [Spirit Walker — Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — Tame Beast nằm trong pool; Companion Zoo scale companion qua gem level.
