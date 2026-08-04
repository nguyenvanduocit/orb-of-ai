---
template: templates/guide-template.md
document_type: guide
title: "Charms: slot trên belt, cách lấy charges và trigger"
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
  - charm
  - belt
  - ailment
  - defense
---

# Charms: slot trên belt, cách lấy charges và trigger

:wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} = lớp phòng thủ chủ động thứ 2 bên cạnh flask, nhưng KHÔNG bấm tay — tự bật khi điều kiện + đủ charges.

## Slot riêng, tách khỏi flask

- Belt có flask slot + charm slot tách biệt — charm không chiếm chỗ flask. Charm slot = ô nhỏ hình kim cương dưới flask.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Ruby_Charm"} tự bật khi ăn fire damage từ hit; :wiki-link{url="https://www.poe2wiki.net/wiki/Thawing_Charm"} tự bật khi bị freeze. Không có nút bấm.

## Số slot theo item level của belt

| Belt ilvl | Charm slot |
|---|---|
| 1–29 | 1 |
| 30–59 | 1–2 |
| 60+ | 1–3 |

- Tối đa 3 charm cùng lúc dù có bao nhiêu slot.
- Quest :wiki-link{url="https://www.poe2wiki.net/wiki/Ancient_Vows"} thưởng +1 charm slot. Một số passive node cho thêm slot (endgame).
- Leveling: belt act 1 ilvl thấp = 1 slot. Act 3–4 tìm belt ilvl 30+ mở slot thứ 2.

## Charges: từ kill + Well

- Kill quái → charm charges = ½ Power quái. Magic ×2 normal, rare ×5, unique luôn 20 Power.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Well"} (town) + :wiki-link{url="https://www.poe2wiki.net/wiki/Checkpoint"} (map) refill charm đầy.
- Magic charm roll **Charges gained per Second** → tự nạp không cần kill (tốt cho boss corridor thưa quái). :wiki-link{url="https://www.poe2wiki.net/wiki/Elevore"} (unique Hunter Hood lv33): mọi charm gain 0.5 charge/giây + 1 charm slot.

## Trigger theo điều kiện

- Mỗi charm 1 điều kiện trigger (ghi tooltip): :wiki-link{url="https://www.poe2wiki.net/wiki/Staunching_Charm"}→bleeding, :wiki-link{url="https://www.poe2wiki.net/wiki/Antidote_Charm"}→poison, :wiki-link{url="https://www.poe2wiki.net/wiki/Stone_Charm"}→stun.
- 2 charm CÙNG loại → chỉ 1 bật một lúc. 2 charm KHÁC loại → cùng trigger đồng thời (hit vừa freeze vừa poison → Thawing + Antidote cùng bật).
- Charm có duration sau trigger (thường 3–4s), trong đó không re-trigger; charges/lần cố định.

## Charm nào cho beginner (match threat của zone)

- **Thawing Charm** (freeze): tiêu 40/40 charges/lần (sạch charge sau 1 trigger), immunity freeze 3s.
- **Antidote Charm** (poison): zone snake/spider/chaos.
- **Staunching Charm** (bleeding): bleed = physical DoT đi thẳng qua Energy Shield vào Life, ×2 khi di chuyển/Aggravated.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Grounding_Charm"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Dousing_Charm"}: shock & ignite immunity.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Amethyst_Charm"}: +18% chaos resistance khi nhận chaos hit (không charm nào cho chaos immunity thẳng).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Silver_Charm"} + Stone Charm (slow/stun immunity): ưu tiên thấp campaign, giá trị endgame.
- Rarity: normal/magic/unique — KHÔNG có rare charm. Normal = 0 mod; magic tối đa 2 mod (increased Effect Duration, reduced Charges per use, Charges gained per Second).

## Relationships

- **related** [Flask: cách dùng bình hồi và hệ thống charge](/guides/beginner-flask) — flask + charm share charge từ kill và Well.
- **related** [Ailment và status effect trong POE2](/guides/beginner-ailments) — từng ailment charm bảo vệ.
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — Amethyst/Ruby/Sapphire/Topaz Charm cho resistance tạm thời.
- **related** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — charm là lớp situational trên các lớp passive.
