---
template: templates/item-template.md
document_type: item
title: Liminal Coil
status: published
author: duocnv
created: '2026-05-25'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
rarity: unique
item_class: Wand
level_requirement: 65
item_tags:
- wand
- unique
- curse
- chaos
- spell
meta_tags:
- build-enabling
- curse-stacking
tags:
- item
- unique
- 0-5
- return-of-the-ancients
- curse
---

# Liminal Coil

Wand unique base :wiki-link{url="https://www.poe2wiki.net/wiki/Twisted_Wand"} Twisted Wand, drop từ The Market trong Ritual. Hai dòng cốt lõi: "Curses you inflict ignore Curse limit" + "Spell Hits Gain (23–31)% of Damage as Extra Chaos/Physical Damage per Curse on target" → player chồng nhiều curse khác loại lên 1 target, mỗi curse thêm 1 lớp extra damage vào spell hit. Nền cho caster vừa bóc res/slow vừa scale damage theo số curse.

## Item Stats

```
Liminal Coil
Twisted Wand
Requires: Level 65, 114 Int
--------
(71–113)% increased Spell Damage
(7–13)% increased Cast Speed
Curses you inflict ignore Curse limit
Spell Hits Gain (23–31)% of Damage as Extra Chaos Damage per Curse on target
Spell Hits Gain (23–31)% of Damage as Extra Physical Damage per Curse on target
```

## Why it matters

- Không cắt curse — magnitude nguyên: :wiki-link{url="https://www.poe2wiki.net/wiki/Despair"} Despair vẫn giảm chaos res, :wiki-link{url="https://www.poe2wiki.net/wiki/Temporal_Chains"} Temporal Chains vẫn slow, :wiki-link{url="https://www.poe2wiki.net/wiki/Conductivity"} Conductivity vẫn giảm lightning res. "Ignore curse limit" chỉ xoá giới hạn 1 curse/target → mọi curse khác loại cùng tồn tại. Curse = vừa debuff vừa bộ đếm bơm damage.
- Mỗi curse trên target → +(23–31)% extra chaos **và** +(23–31)% extra physical mỗi spell hit. 3 curse khác = 69–93% extra chaos + 69–93% extra physical từ riêng cơ chế này — cộng dồn trên spell damage gốc, không thay thế.
- Roll cap **31%** cả hai dòng = mục tiêu craft/chọn copy: 23%→31% per-curse = chênh 35%.
- `Exclusion check: <none>` — không penalty/tradeoff ngoài yêu cầu đa dạng curse source.

## Cơ chế enable build

- Kéo caster theo curse **rộng**, không curse sâu. Thay vì "increased curse effect" (scale 1 curse), đầu tư càng nhiều curse source càng tốt để đẩy curse count. Curse-on-hit support, trigger curse qua multiple skills, AoE curse đều quan trọng — mỗi curse type = 1 lớp (23–31)% extra damage.
- Wand cho (71–113)% increased Spell Damage + (7–13)% increased Cast Speed = baseline caster tốt, không đủ nếu bỏ qua curse count. Ăn rõ nhất khi duy trì 3–4 curse khác nhau lên target trước khi spam spell; damage ramp tuyến tính theo từng curse. Curse effect investment vẫn có giá trị phụ (curse vẫn debuff).
- Không hợp: caster dùng 1 curse duy nhất, hoặc build không apply curse nhanh (melee không AoE curse reach, minion build không apply curse trực tiếp).

## Acquisition

- Dropped by The Market trong :wiki-link{url="https://www.poe2wiki.net/wiki/Ritual"} Ritual — drop có địa chỉ rõ, không random pool chung. Farm lặp Ritual encounter = con đường chắc chắn nhất.

## Version History

### Patch 0.5.0 (Return of the Ancients — 2026-05-29)
- Item introduced.

## Relationships

- **part_of** [Đợt Unique Mới và Meta Shift](/guides/0-5-new-unique-items) — trục curse-stacking của đợt unique 0.5.
- **synergizes_with** [Twisted Empyrean](/guides/twisted-empyrean) — cùng nhóm unique build-enabling 0.5.
- **alternative_to** [The Auspex](/guides/the-auspex) — cùng thiết kế "một mod bỏ giới hạn, một mod khai thác việc bỏ đó".
