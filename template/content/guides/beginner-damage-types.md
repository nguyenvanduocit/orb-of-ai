---
template: templates/guide-template.md
document_type: guide
title: "Các loại damage: Physical, Elemental, Chaos, Hit và DoT"
status: draft
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
  - ailment
  - dot
  - conversion
---

# Các loại damage: Physical, Elemental, Chaos, Hit và DoT

5 loại damage — Physical, Fire, Cold, Lightning, Chaos — mỗi loại bị chặn bởi cơ chế phòng thủ khác nhau ở phía enemy. Chọn sai type = damage tốt trên paper, ì ạch thực chiến.

## 5 loại damage + cơ chế giảm

- **Physical**: phổ biến nhất (weapon attack). Bị giảm bởi :wiki-link{url="https://www.poe2wiki.net/wiki/Armour"}, KHÔNG phải resistance → tốt nhất khi enemy ít armour hoặc có source giảm armour.
- **Fire/Cold/Lightning** = Elemental: bị giảm bởi resistance tương ứng. Elite res cao → nhiều build kèm curse/exposure hạ res trước.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_damage"}: bị giảm bởi Chaos Resistance riêng, tách khỏi elemental. Ít gặp.

## Hit vs Damage over Time

- **Hit**: tức thì khi skill kết nối (attack/spell hit, projectile impact). Crit, leech, block chance + nhiều defensive mechanic CHỈ trên hit.
- **DoT**: dần theo thời gian (:wiki-link{url="https://www.poe2wiki.net/wiki/Ignite"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Bleeding"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Poison"}). DoT ≠ hit → armour + penetration vô tác dụng, chỉ resistance giảm được. DoT không crit, không leech trực tiếp.
- "Increased Spell Damage" không buff spell DoT trừ khi skill ghi "Modifiers to Spell Damage apply to Debuff's Damage over Time" — vd :wiki-link{url="https://www.poe2wiki.net/wiki/Essence_Drain"}.

## Ailment từ hit + damage type

- **Fire hit** → Ignite (Fire DoT, 4s mặc định).
- **Cold hit** → :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"} (giảm action speed) + tích :wiki-link{url="https://www.poe2wiki.net/wiki/Freeze"} (đứng hình 4s).
- **Lightning hit** → :wiki-link{url="https://www.poe2wiki.net/wiki/Shock"} (target +20% damage mọi nguồn) + tích :wiki-link{url="https://www.poe2wiki.net/wiki/Electrocute"} (khóa action 5s).
- **Physical hit** → Bleeding (Physical DoT, 5s, cần source Bleed chance).
- **Physical/Chaos hit** → Poison (Chaos DoT, 2s mặc định, stack nhiều lần, cần source Poison chance).
- 3 ailment damage: Ignite, Bleed, Poison. Bleed + Poison bypass :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} — rút Life trực tiếp dù còn ES.

## Tăng hit damage → ailment DoT mạnh hơn

- Khi hit gây ailment DoT, magnitude tính tại thời điểm hit + **khóa lại** (không nhận modifier sau).
- Ignite = **20% fire damage** của hit/giây. Bleed = **15% physical damage** của hit/giây. Poison = **20% tổng physical + chaos** của hit/giây.
- → "increased Fire Damage" tăng hit → ignite mạnh hơn; không cần "increased Ignite Damage" riêng. Build Bleed tập trung flat physical + weapon damage.
- Ngược lại: modifier chỉ áp lên DoT sau khi inflict thì vô tác dụng. "increased Damage over Time" không kèm "to Hits" không buff hit.

## Chaos có đặc điểm riêng

- Chaos lấy đi **gấp đôi** Energy Shield so với damage thật (100 chaos → 200 ES) → build ES bị xuyên nhanh, chaos res quan trọng hơn trực giác.
- Poison bypass ES + stack nhiều lần → build bắn nhanh/multi-hit scale poison qua attack speed.
- Keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"}: miễn nhiễm chaos hoàn toàn nhưng khóa Life = 1 (CI chỉ sống nhờ ES).

## Conversion đổi type + kéo ailment

- Convert 1 phần/toàn bộ damage sang type khác (passive/support/item). Sau convert scale theo modifier type mới, không type cũ.
- Ví dụ phys convert 100% → fire: scale "increased Fire Damage", giảm bởi Fire Resistance, gây Ignite — không còn phys/Bleed.
- Build convert phải check ailment (convert phys→fire mà dùng Bleed support → Bleed không có phys để tính magnitude).
- **DoT không convert** — conversion chỉ trên hit; Ignite/Bleed/Poison sau khi gây thì type cố định.

## Relationships

- **related** [Ailment và status effect trong POE2](/guides/beginner-ailments) — cách ailment apply + phòng từ phía enemy.
- **related** [Increased và More: toán học scaling damage](/guides/beginner-increased-vs-more) — sau damage type là hiểu increased vs more.
- **related** [Lớp phòng thủ trong POE2](/guides/beginner-defence-layers) — Physical bị armour, Elemental bị resistance.
- **related** [Các keyword damage quan trọng: Exposure, Penetration, Armour Break, Culling](/guides/beginner-damage-keywords) — keyword tác động resistance/armour của từng damage type.
- **related** [Critical Hit: crit chance và crit damage bonus](/guides/beginner-critical-hit) — Critical Damage Bonus là multiplier độc lập.
- **related** [Stun: Light Stun và Heavy Stun khác nhau như thế nào](/guides/beginner-stun) — physical damage được bonus stun đặc biệt, cũng là loại bị Armour giảm
- **related_guides** [Accuracy và Evasion: tấn công có chắc trúng không?](/guides/beginner-accuracy-evasion) — phân biệt attack vs spell; tag nào cần Accuracy.
