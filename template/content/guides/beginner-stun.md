---
template: templates/guide-template.md
document_type: guide
title: "Stun: Light Stun và Heavy Stun khác nhau như thế nào"
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
  - stun
  - crowd-control
  - melee
---

# Stun: Light Stun và Heavy Stun khác nhau như thế nào

2 loại stun khác cơ chế — Light Stun (tức thì) + Heavy Stun (tích lũy). Giải thích vì sao mace/hammer physical là class CC mạnh.

## Light Stun (tức thì, theo damage)
- Mỗi hit có chance gây :wiki-link{url="https://www.poe2wiki.net/wiki/Light_Stun"} = `damage / max life target` (%): hit 100% life → 100% chance, 50% life → 50%
- Chance **<15% xử lý như 0** → hit nhỏ không bao giờ Light Stun (14% life = không stun, cần ≥15%)
- Duration **0.53 giây** → đủ interrupt cast + reset hành động; attack speed cao → Light Stun liên tục giữ địch bị gián đoạn không cần Heavy Stun

## Heavy Stun (tích lũy, đứng yên lâu)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Heavy_Stun"} = buildup: mỗi hit cộng vào **Stun bar** (dưới thanh máu địch) tỷ lệ damage; bar đầy → địch đứng im hoàn toàn, tính **Immobilised** vài giây
- Buildup **rút dần** nếu không có hit mới → đánh thưa không bao giờ đầy bar
- Sau khi vừa Heavy Stun → có **immunity window ngắn** → lock boss liên tục không thực tế
- Duration phụ thuộc damage hit vượt **Stun Threshold** bao nhiêu → hit mạnh, đứng lâu

## Physical + Melee đều bonus stun
- Cả :wiki-link{url="https://www.poe2wiki.net/wiki/Physical_Damage"} lẫn player Melee cho **50% more Light Stun chance + 50% more Heavy Stun buildup**, **multiplicative** (không cộng)
- Hit vừa physical vừa melee: 1.5 × 1.5 = **2.25** (125% hiệu quả hơn hit không physical/melee) → mace/hammer physical CC tốt tự nhiên
- ⚠ Bonus melee **chỉ cho player**, không cho monster: monster melee chỉ 33% more (physical của monster 100% more) → boss melee physical rất nguy hiểm nếu thiếu Stun Threshold

## Player thường không bị Heavy Stun
- Player + minion thường không thể Heavy Stun trực tiếp từ hit thường (không có Stun bar)
- 3 trường hợp player tích Heavy Stun buildup: :wiki-link{url="https://www.poe2wiki.net/wiki/Raise_Shield"} block · :wiki-link{url="https://www.poe2wiki.net/wiki/Parry"} với Buckler · nhận hit khi sprint → đầy = Heavy Stun **3 giây** (không evade/block được)
- Evasion không tránh hit khi block/parry nhưng giúp tránh phần Stun buildup (chance = evasion chance)

## Tăng stun lên enemy
- Đơn giản nhất: tăng damage/hit (cả Light + Heavy đều theo damage)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Daze"}: target nhận **50% more Stun buildup** từ mọi hit → áp Daze trước rồi hit, đầy bar nhanh hơn (vs rare/boss Stun Threshold cao)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Primed_for_Stun"} = địch đã tích 1 phần buildup:

| Rarity | Primed tại |
|--------|-----------|
| Normal | 40% bar |
| Magic | 50% |
| Rare | 60% |
| Unique | 70% |

- :wiki-link{url="https://www.poe2wiki.net/wiki/Crushing_Blows"} = hit auto Heavy Stun ngay địch đang Primed (khỏi điền đầy 100%); Titan passive **Crushing Impacts** ("Your Hits are Crushing Blows") → Warrior/Titan = class stun mạnh nhất
- **Stun Threshold** địch = buildup cần để stun; giảm Threshold địch (gear/passive) → stun dễ hơn · tăng Threshold bản thân → khó bị Light Stun

## Relationships

- **related** [Damage types trong POE2](/guides/beginner-damage-types) — physical damage được bonus stun đặc biệt, cũng là loại bị Armour giảm
- **related** [Defence layers trong POE2](/guides/beginner-defence-layers) — Heavy Stun buildup khi Raise Shield/Parry là trade-off active block
- **related** [Ailments trong POE2](/guides/beginner-ailments) — stun không phải ailment nhưng liên quan Immobilise (Freeze, Electrocution)
