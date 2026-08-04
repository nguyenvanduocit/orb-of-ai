---
template: templates/item-template.md
document_type: item
title: Sylvan's Effigy
status: published
author: duocnv
created: '2026-05-25'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
rarity: unique
item_class: Sceptre
level_requirement: 62
item_tags:
- sceptre
- unique
- companion
- spirit
- minion
meta_tags:
- build-enabling
- companion-multiplier
tags:
- item
- unique
- 0-5
- return-of-the-ancients
- spirit-walker
- companion
---

# Sylvan's Effigy

Unique Sceptre trên base :wiki-link{url="https://www.poe2wiki.net/wiki/Stoic_Sceptre"}, Req Level 62, drop từ The Market. Dòng định nghĩa "You can have any number of Companions of different types" gỡ trần số loại companion → zoo enabler cốt lõi của [Spirit Walker](/guides/spirit-walker-companion-beast-hunt).

## Stats

```
Sylvan's Effigy
Stoic Sceptre
Requires Level 62
--------
Grants Skill: Level 18 Azmerian Wolf
Grants Skill: Level 18 Discipline
(50–75)% increased Spirit
Companions deal (50–100)% increased damage to your Marked targets
You can have any number of Companions of different types
```

## Why it matters

- "You can have any number of Companions of different types" → field một con mỗi loại, không khống chế số loại. Confirmed trên ThaoCamVienSaiGon (Lv90 Spirit Walker, 0.5): Sylvan's Effigy offhand → đồng thời Diretusk Boar + Azmerian Wolf + Wild Protector (Bear) + Mighty Silverfist + Wolf Pack (vượt companion cap mặc định). Còn lại chỉ cần đủ Spirit reserve từng con.
- (50–75)% increased Spirit → nới reservation budget để field thêm companion.
- Granted Discipline L18 = lớp ES reservation; granted Azmerian Wolf L18 = wolf companion burst theo cooldown — cả hai trong item, 0 gem slot.
- "Companions deal (50–100)% increased damage to your Marked targets" = conditional multiplier, cần Mark trước (:wiki-link{url="https://www.poe2wiki.net/wiki/Voltaic_Mark"} Voltaic Mark hoặc curse-mark). **Additive** với increased companion damage khác → uplift thực thấp hơn số tuyệt đối khi đã stack sẵn.
- `Exclusion check: none` — build single-strong-companion (dồn một con như Diretusk Boar) KHÔNG cần item; chỉ cần khi field nhiều loại companion đồng thời.

## Build usage

- Trục zoo Spirit Walker: stack Spirit → field nhiều companion khác loại (role tank/dps/utility) → Mark target → cả bầy nhận multiplier trong window.
- Sylvan's Effigy chiếm offhand → main-hand vẫn là weapon thật chịu flat phys cho :wiki-link{url="https://www.poe2wiki.net/wiki/The_Catha%27s_Balance"} The Catha's Balance ("companions deal added Attack Damage = 60% of main hand weapon damage"). Hybrid carry→zoo giữ main-hand spear flat phys cao.
- Stoic Sceptre = base Int → item có Int requirement; phần lớn companion gem cần Int → giữ Int floor.

## Acquisition

- Drop từ The Market (0.5). Req Level 62 — equip khi pivot sang zoo. Giá dao động theo mức meta Spirit Walker companion.
- Base = Stoic Sceptre; alt = rare sceptre Spirit cao khi không cần dòng "any number" nhưng vẫn muốn đẩy Spirit ceiling.

## Version History

### Patch 0.5.1
- Fix bug Unique Tamed Beasts gây "Number of shared states is different on client and server" — ảnh hưởng stability của companion unique beast khi weapon-swap hoặc re-enter zone.

### Patch 0.5.0 (Return of the Ancients)
- Item ra mắt cùng đợt ascendancy :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} Spirit Walker.

## Relationships

- **synergizes_with** [Spirit Walker — Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — item gỡ trần số loại companion, trục chính của ascendancy Spirit Walker.
- **competes_with** [The Auspex](/guides/the-auspex) — Auspex ép single-minion, Sylvan's Effigy thưởng cả bầy companion — hai triết lý ngược.
- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — unique tăng Spirit ceiling + gỡ trần companion, tool chính build zoo Spirit Walker
- **synergizes_with** [Lochtonial Caress](/guides/lochtonial-caress) — Sylvan's Effigy gỡ trần số loại companion; Lochtonial feed charge cho cả bầy đó không tiêu charge player.
