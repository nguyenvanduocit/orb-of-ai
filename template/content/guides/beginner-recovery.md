---
template: templates/guide-template.md
document_type: guide
title: "Recovery: Life regen, ES recharge và Leech hoạt động thế nào"
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
  - recovery
  - leech
  - energy-shield
  - defense
---

# Recovery: Life regen, ES recharge và Leech hoạt động thế nào

3 recovery, 3 logic khác hẳn. Nhầm cách hoạt động = chết oan (mong Leech bù liên tục như regen, mong ES hồi giữa pack).

## Life regen
- :wiki-link{url="https://www.poe2wiki.net/wiki/Life_regeneration"} = lượng Life cố định/giây, **không điều kiện, không delay, không bị reset bởi damage** → chạy cả khi đứng yên lẫn đang hứng đòn
- Nguồn: passive tree (flat +X Life/s + % max Life/s), gear, một số flask suffix
- Campaign Life thuần thường đủ regen tự hồi giữa combat; endgame damage/hit cao → regen quá thấp nếu không đầu tư → flask vẫn là recovery chính trong fight nặng

## ES recharge
- :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield_Recharge"} = delay rồi hồi: sau **4 giây** không nhận damage vào ES/Life → recharge **12.5% max ES/giây**
- Reset đồng hồ bởi **mọi hit làm giảm ES HOẶC Life** (không chỉ hit vào ES) → ES cạn mà Life bị hit thì đồng hồ ES vẫn reset
- Passive/gear rút delay ("X% faster start of ES Recharge"), base = 4 giây → giá trị nhất ở đánh burst, gần như không hồi trong boss fight liên tục

## Leech
- :wiki-link{url="https://www.poe2wiki.net/wiki/Leech"}: `damage hit × leech%` = lượng hồi, chia đều trong **1 giây** (hit 1,000 × 10% life leech = instance hồi 100 Life/giây)
- Chỉ **1 instance/resource** active cùng lúc → nhiều instance thì chỉ cái recovery rate cao nhất chạy, còn lại xếp hàng; instance hết → cái kế tự kích; leech xóa hết khi resource đầy
- Monster có **Leech Resistance** tăng theo level (Lv80+ đáng kể) → giảm lượng thực recover/hit

## 0.5.0: cap 40,000 damage/hit cho tính Leech
- Từ 0.5.0, hit >40,000 total damage → phần vượt KHÔNG tính leech (hit 200,000 = leech như hit 40,000; damage type scale down đều để đạt limit)
- leech% vẫn cộng tuyến tính: 10% leech trên 40,000 cap = 4,000 Life · 20% = 8,000 → **tăng leech% chứ không tăng damage vô hạn**
- Build one-shot dựa leech bù damage phải thiết kế lại: leech cố định từ 40k+, boss damage có thể lớn hơn nhiều → cần layer phòng thủ khác

## Vaal Pact (đánh đổi lớn, không phải buff thuần)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Vaal_Pact"} keystone, 0.5.0 có 4 hiệu ứng đồng thời:

| Hiệu ứng | Ý nghĩa |
|----------|---------|
| 50% more amount of Life Leeched | tổng Life/instance +50% |
| 67% less Life Leech speed | tốc độ còn 33% → 1 instance mất ~4.5 giây thay vì 1 giây |
| Cannot Recover Life other than from Leech | khóa flask/regen/on-kill — Life CHỈ từ Leech |
| Life Leech not removed when Unreserved Life is Filled | leech không cắt khi Life đầy → overflow vào buffer |

- Tradeoff: phụ thuộc hoàn toàn Leech → không leech 1 khoảnh khắc (miss, boss immune phase) = Life không hồi; cần hit rate cao + leech% mạnh + tránh phase không damage được. KHÔNG cho người mới; kết hợp cap 40,000 → cần nhiều hit nhỏ-vừa liên tục hơn vài hit lớn

## Runic Ward (cơ chế riêng)
- :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} mới trong 0.5.0, KHÔNG như ES/Life → lớp cuối chỉ kích khi Life sắp về 0
- Damage vào Life trước; hit sẽ đưa Life về 0 → Ward hấp thụ phần thiếu, Life dừng ở 1; damage > Life + Ward → vẫn chết. Ward không giảm damage thường
- Ward tự hồi cố định **5% max Ward/giây**, độc lập hoàn toàn (không dính flask/leech/regen); tăng qua "increased Runic Ward Regeneration Rate" từ Charging Rune / passive
- Chỉ đáng kể với char dùng Kalguuran gear (weapon/armour có Augment slot phù hợp); char thường gần như không ảnh hưởng trừ pha sát tử

## Relationships

- **related** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — pool cơ bản và cách phân tầng, đọc trước
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — resistance giảm damage đầu vào, recovery bù phần còn lại
- **related_mechanics** [Energy Shield Recovery](/guides/energy-shield-recovery) — deep-dive recharge delay, rate, Runic Ward 0.5
- **related** [Các layer phòng thủ trong POE2](/guides/beginner-defence-layers) — recovery là một trong nhiều layer, đặt đúng chỗ
- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — aura hỗ trợ recovery (Vitality, Clarity) tiêu Spirit để bật
