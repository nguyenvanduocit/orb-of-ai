---
template: templates/guide-template.md
document_type: guide
title: Ailment và status effect trong POE2
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
  - ailment
  - defense
  - status-effect
---

# Ailment và status effect trong POE2

Ailment = debuff gắn lên target khi hit đúng damage type. Hiểu cả hai chiều — gây cho địch + chịu từ địch.

## Ailment gây cho địch

- Damage ailment: :wiki-link{url="https://www.poe2wiki.net/wiki/Ignite"}, **Bleed**, :wiki-link{url="https://www.poe2wiki.net/wiki/Poison"}.
- **Ignite**: fire DoT = 20% fire damage của hit gây ignite, 4s mặc định.
- **Bleed**: physical DoT = 15% physical damage/giây; ×2 khi địch đang di chuyển → boss di động chịu nặng hơn.
- **Poison**: chaos DoT, stack nhiều lần — mỗi hit có poison chance = 1 stack mới (không ghi đè) → nhiều hit nhỏ nhanh scale poison mạnh.
- Magnitude ignite/bleed/poison tính từ damage của hit gây ra → hit mạnh hơn = DoT mạnh hơn.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Shock"} (không damage trực tiếp): địch nhận +20% damage từ MỌI nguồn (kể cả ignite/bleed/poison + hit sau) → lý do build đầu tư lightning phụ dù main damage loại khác.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"}: giảm action speed tới 50%. :wiki-link{url="https://www.poe2wiki.net/wiki/Freeze"}: dừng hẳn 4s. Chill auto khi cold hit đủ mạnh; freeze cần buildup. Boss/rare map tier cao khó freeze hơn (ailment threshold tăng theo monster level).

## Ailment trên người mình

- Ailment threshold người chơi = ½ max life mặc định → ít life = threshold thấp = dễ bị ailment.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Electrocute"}: nguy hiểm nhất — khóa mọi action 5s, không dodge roll, không flask. Giữa pack dense = chết.
- Freeze trên người: tương tự, bị freeze trước hit lớn của boss = mất hết HP.
- Bleed trên người: ×2 khi di chuyển → dodge roll lúc bleed nặng = tự damage.
- Shock trên người: +20% damage nhận từ mọi nguồn, gồm DoT tick.

## Phòng ailment

- Flask mod "Remove Bleeding on use" / "Remove Shock on use" → cleanse SAU khi bị (rẻ, đủ cho map thường). Electrocute/freeze thì không kịp dùng flask.
- T10+: cắt nguồn thay vì cleanse. Gear "cannot be Frozen"/"cannot be Shocked" → chặn từ đầu. Passive **Elemental Ailment Threshold** → khó apply + giảm buildup freeze/electrocute. Tăng life → tăng threshold (½ max life).
- Ưu tiên: xử lý freeze + electrocute trước (lock hoàn toàn). Shock/bleed còn room react.

## Relationships

- **related_mechanics** [Armour và defensive scaling](/guides/armour-defensive-scaling) — ailment threshold song song armour/evasion/ES.
- **related_mechanics** [Infernal Legion ignite loop](/guides/infernal-legion-ignite-loop) — build khai thác ignite làm main damage.
- **related** [Các loại damage trong POE2](/guides/beginner-damage-types) — damage type nào sinh ailment nào.
- **related** [Charms: slot trên belt, cách lấy charges và trigger](/guides/beginner-charms) — charm cho immunity từng ailment (freeze/shock/ignite/poison/bleed).
- **related** [Flask: cách dùng bình hồi và hệ thống charge](/guides/beginner-flask) — charm chặn freeze/shock/bleed; biết ailment nào cần charm nào
- **related** [Stun: Light Stun và Heavy Stun khác nhau như thế nào](/guides/beginner-stun) — stun không phải ailment nhưng liên quan Immobilise (Freeze, Electrocution)
- **related_guides** [Parry, combo và WASD: cơ bản combat POE2](/guides/beginner-combat-basics) — Parried debuff, Daze, Heavy Stun.
