---
template: templates/guide-template.md
document_type: guide
title: "Ba pool tài nguyên: Life, Energy Shield và Mana"
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
  - life
  - energy-shield
  - mana
  - defense
  - fundamentals
---

# Ba pool tài nguyên: Life, Energy Shield và Mana

3 pool riêng — Life, ES, Mana — + Spirit (hay bị nhầm với Mana). Quyết định cách đọc combat + hướng phòng thủ.

## Life
- Life = 0 → chết. Không cơ chế nào cứu → giới hạn cứng duy nhất
- Recover 3 cách: **life flask** (quan trọng nhất trong combat, hồi ngay) · **life regen** (passive/gear) · **life leech** (on hit); town/hideout → auto full
- Life < 35% max = **Low Life** → một số passive/unique unlock buff mạnh, nhưng là lãnh thổ build nâng cao (1 hit bất ngờ = chết)

## Energy Shield (ES)
- Lớp đệm TRÊN Life: mọi hit trừ ES trước, ES cạn sạch mới tới Life
- **Tự recharge, không cần flask**: sau **4 giây** không nhận damage vào ES/Life → recharge **12.5% max ES/giây**
- Mọi hit làm giảm ES HOẶC Life → reset đồng hồ 4 giây; passive/gear rút delay còn 2 giây khi đạt 100% faster start of ES Recharge (base = 4 giây, không phải 2)
- Giá trị nhất ở combat burst (nhận đòn → né → chờ hồi → vào lại), vô dụng khi đứng chịu đòn liên tục
- **Bleeding + Poison bypass ES hoàn toàn** → trừ thẳng Life; **chaos damage** không bypass nhưng đánh ES gấp đôi (100 chaos = 200 ES) → build ES nặng cần chaos resistance

## Mana + Spirit
- **Mana** = fuel skill: mỗi cast/attack trừ theo cost; regen liên tục 4% max mana/giây; spam quá dày → cạn, skill bị block đến khi hồi đủ
- **Spirit** = resource riêng, KHÔNG liên quan Mana → dùng reservation (aura, minion thường trực, persistent buff); không tiêu không hồi, là trần cố định — chi tiết [Spirit](/guides/beginner-spirit)

## Life hay ES
- Không cần chọn 1: **Hybrid Life+ES** hợp lệ, phổ biến — ES giảm áp lực flask, Life làm nền
- **Life thuần** dễ đọc cho người mới (biết ngay còn bao nhiêu, không lo Bleeding/Poison bypass)
- **ES cao** cần hiểu recharge + biết lúc nghỉ để hồi → áp lực hơn khi mới quen
- Endgame quen rhythm → hybrid thường là điểm cân bằng tốt nhất

## Relationships

- **related_mechanics** [Energy Shield Recovery](/guides/energy-shield-recovery) — cơ chế recharge delay, rate, và Runic Ward trong 0.5
- **related** [Recovery: Life regen, ES recharge và Leech](/guides/beginner-recovery) — ba logic recovery cho từng pool này
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — resistance lọc damage trước khi trừ vào các pool
- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — pool thứ tư hay bị nhầm với Mana, cách kiếm và quản lý
- **related_mechanics** [Armour Defensive Scaling](/guides/armour-defensive-scaling) — layer phòng thủ vật lý bổ sung bên cạnh Life và ES
- **related** [Ba chỉ số cơ bản: Strength, Dexterity, Intelligence](/guides/beginner-attributes) — Str +2 Life/point, Int +2 Mana/point.
- **related** [Chết trong POE2: XP penalty, portal rules và Hardcore](/guides/beginner-death-portals) — health pool bảo vệ khỏi cái chết.
- **related** [Flask: cách dùng bình hồi và hệ thống charge](/guides/beginner-flask) — resource mà flask đang hồi
- **related_guides** [Dodge roll và combat trong POE2](/guides/beginner-dodge-roll) — pool sống chịu đòn khi timing roll sai.
