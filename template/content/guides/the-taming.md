---
template: templates/mechanic-template.md
document_type: mechanic
title: The Taming
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
  - ring
  - prismatic-ring
  - elemental-ailment
  - wind-skills
  - poe2
  - mechanic
---

# The Taming

Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Prismatic_Ring"} (:wiki-link{url="https://www.poe2wiki.net/wiki/The_Taming"}), Req Level 42, drop từ The Market (0.5). Hai mechanic độc lập: (10–20)% increased Damage per loại Elemental Ailment trên enemy (tối đa 3 loại → 30–60%), và cặp dòng Wind Skills biến elemental ground interaction thành triple buff thường trực không cần ground thật. [Twister](/guides/twister) Huntress với Wind Skills = user tự nhiên nhất (gộp cả ba Berek ring vào một slot).

## Chỉ số

```
The Taming
Prismatic Ring
Requires Level 42
--------
+(7–10)% to all Elemental Resistances
--------
+(10–20)% to all Elemental Resistances
(10–20)% increased Damage for each type of Elemental Ailment on Enemy
Wind Skills which can be boosted by Elemental Ground Surfaces can be boosted by multiple Elemental Ground Surfaces
Wind Skills which can be boosted by Elemental Ground Surfaces count as being boosted by Ignited, Shocked, and Chilled Ground

"Moon after moon did Berek make fools
Of the great and Untamed Three
Until malice for a Brother
Slew the hatred of the Other
And Berek did hunt
Alone and free."
- Berek and the Untamed
```

- Res: 10% implicit + 20% explicit = **30% all elemental res** từ một ring slot.

## Damage theo số loại ailment

- Scale theo số **loại** ailment khác nhau trên enemy, không theo stack count. 3 loại Elemental Ailment: :wiki-link{url="https://www.poe2wiki.net/wiki/Ignite"} (fire), :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Freeze"} (cold), :wiki-link{url="https://www.poe2wiki.net/wiki/Shock"} (lightning). Đủ 3 → 3 × (10–20)% = 30–60% increased.
- Ring chỉ gọi tên 3 ground (Ignited/Shocked/Chilled) → Chill + Freeze cùng tính một loại cold, trần thực tế 3 loại (chưa verify in-game).
- "Increased" = additive vào pool increased damage từ tree/gear/flask → uplift biên thấp khi đã stack sẵn; đòn bẩy rõ với build ít increased (companion zoo, flat phys support).
- Yêu cầu đủ 3: build phải apply đồng thời Ignite + Shock + Chill/Freeze. Thuần một nguyên tố → chỉ 10–20%, không đủ giữ slot.

## Wind Skills + triple elemental ground

- Hai dòng Wind Skills = một hiệu ứng: mọi Wind Skill boostable by elemental ground luôn nhận boost từ cả ba ground — :wiki-link{url="https://www.poe2wiki.net/wiki/Ignited_Ground"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Shocked_Ground"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Chilled_Ground"} — đồng thời + thường trực, bất kể ground thật.
- Context Berek trio (0.5): :wiki-link{url="https://www.poe2wiki.net/wiki/Berek%27s_Grip"} → Shocked, :wiki-link{url="https://www.poe2wiki.net/wiki/Berek%27s_Pass"} → Chilled, :wiki-link{url="https://www.poe2wiki.net/wiki/Berek%27s_Respite"} → Ignited. Mỗi chiếc một loại, cần cả ba nhưng chỉ 2 ring slot → The Taming gộp cả ba + dòng "multiple" gỡ giới hạn một-loại-một-lúc.
- Với :wiki-link{url="https://www.poe2wiki.net/wiki/Twister"} ("Gain 50% of damage as damage of corresponding Type" trên elemental ground): mỗi cast triple elemental +50% cold +50% lightning +50% fire đồng thời, không cần ground thật → nếu 3 boost áp độc lập thì mỗi twister tổng 150% added elemental trên base attack damage spear, mọi multiplier consume Whirlwind (chưa verify in-game 3 boost stack riêng thay vì ghi đè).
- Dòng "count as" quan trọng hơn "multiple": không cần tạo/đứng lên ground nào (không cần :wiki-link{url="https://www.poe2wiki.net/wiki/Fangs_of_Frost"} tạo Chilled Ground).
- `Exclusion check:` chỉ kích cho Wind Skill có qualifier "which can be boosted by Elemental Ground Surfaces" — không phải Wind Skill nào cũng có; verify tooltip từng skill in-league, log Twister tooltip xem cả ba ground boost hiển thị đồng thời.

## Khi nào đúng lựa chọn

- Twister Huntress spear Wind Skills — user tự nhiên nhất: triple ground boost thường trực + nếu đủ 3 ailment thì ailment-damage stacking kích thêm (hai mechanic dùng chung damage output kích lẫn nhau).
- Multi-ailment elemental build (không nhất thiết Twister) apply đủ 3 loại → 30–60% + res platform.
- ✗ Build một nguyên tố / không Wind Skills / không đủ loại ailment → rare Prismatic Ring tốt hơn (res linh hoạt + slot cho Spirit/life/flat damage).

## Version History

### Patch 0.5.0 (Return of the Ancients)
- The Taming giới thiệu với hai dòng Wind Skills mới (không tồn tại trong POE1 cùng tên). Liên quan bộ Berek 3 ring cùng patch (cùng design space Wind Skills + elemental ground). Drop từ The Market.

## Relationships

- **related_mechanics** [Twister](/guides/twister) — skill chính hưởng triple elemental ground boost; "Gain 50% as corresponding Type" là trục damage Twister.
- **related** [0.5 New Unique Items Overview](/guides/0-5-new-unique-items) — overview unique 0.5 gồm Berek trio + context.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — league 0.5 giới thiệu The Market là drop source.
- **related_builds** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — ring cộng increased damage per ailment ground cho Wind Skill.
- **related_builds** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — ring định nghĩa build: count as boosted by Ignited/Shocked/Chilled cùng lúc, inc damage per ailment type.
