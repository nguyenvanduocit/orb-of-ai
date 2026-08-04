---
template: templates/guide-template.md
document_type: guide
title: "Ba lớp phòng thủ vật lý: Armour, Evasion và Block"
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.3
guide_type: fundamentals
tags:
  - poe2
  - 0-5
  - beginner
  - armour
  - evasion
  - block
  - defence
  - physical
---

# Ba lớp phòng thủ vật lý: Armour, Evasion và Block

POE2 không có 1 con số "giảm damage" duy nhất — survival = 3 lớp riêng, mỗi lớp che điểm yếu của nhau. Bẫy cổ điển: stack 1 thứ thật cao rồi chết vì lý do khác.

## Armour — giảm nhiều với hit nhỏ, ít với hit lớn

- :wiki-link{url="https://www.poe2wiki.net/wiki/Armour"} giảm physical damage theo công thức phụ thuộc cỡ đòn: cần armour **×10 damage của hit** để giảm 50%.
- 1.000 armour vs đòn 100 → giảm 50%. 1.000 armour vs đòn 1.000 → chỉ ~9%.
- Mạnh khi hứng pack hit nhỏ liên tục; yếu trước boss slam lớn. Cap **90% reduction**, chỉ physical — elemental xuyên qua hoàn toàn.
- Warrior/Titan tự nhiên (strength scaling). Playstyle: đứng yên hứng đòn.

## Evasion — né hoàn toàn hoặc ăn full

- :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion"}: né thành công = 0 damage; fail = full 100%, không giảm giữa chừng. Vô giá trị khi fail + vô giá trị trước DoT (poison/bleed không phải hit).
- Né được MỌI hit — physical/elemental/chaos.
- 0.5 evasion build thường lấy thêm **Deflection** (passive gần Dexterity): layer phụ cho cơ hội giảm **40% damage** từ hit, kể cả đòn boss glow đỏ Evasion không chặn. Hai notable chuyển Evasion Rating → Deflection Rating: **Wild Cat (12%)** + **Staunch Deflection (8% — patch 0.5.3 thêm)** → char 8.000 Evasion lấy cả hai nhận +1.600 Deflection Rating từ tree, không chiếm suffix trên gear.
- Playstyle: di chuyển liên tục, dodge roll đòn lớn.

## Block — chặn hẳn nhưng cần shield + giới hạn

- :wiki-link{url="https://www.poe2wiki.net/wiki/Block"} chặn toàn bộ damage 1 hit (không giảm — chặn hẳn). Nguồn chính shield, mặc định cap **50% chance** → nửa số hit vẫn xuyên.
- Block vẫn để stun xuyên; boss skill glow đỏ không passive-block được → cần active-block (giơ shield chủ động, tốn action).
- Shield thêm armour + foundation melee tank. Playstyle: cận chiến, shield raise khi boss wind-up, + armour bù 50% block hụt.

## Tại sao stack 1 lớp thường tệ hơn

- Armour mạnh pack, yếu boss burst. Evasion vô giá trị khi fail (fail sẽ xảy ra). Block 50%, đòn không block ăn full. Mỗi lớp đơn độc có kịch bản gần vô dụng.
- Kết hợp 2–3: armour giảm khi evasion fail, block chặn đòn boss evasion không xử lý, evasion giảm số lần armour phải gánh → gear hybrid (body có cả armour+evasion) là bình thường, không lãng phí.
- Lớp thứ 4 (0.5): **Runic Ward** từ Verisium Runeforging — safety net khi life tụt về 1, hấp thụ damage thêm 1 nhịp trước khi chết.

## Relationships

- **related_mechanics** [Armour Defensive Scaling](/guides/armour-defensive-scaling) — công thức armour, Runic Ward, cách 0.5 buff armour/evasion.
- **related_mechanics** [Energy Shield Recovery](/guides/energy-shield-recovery) — layer thứ tư, ES đọc cùng cho đủ bức tranh defence.
- **related_guides** [Dodge roll và combat trong POE2](/guides/beginner-dodge-roll) — phòng thủ chủ động bổ trợ khi miss roll.
- **related** [Ba chỉ số cơ bản: Strength, Dexterity, Intelligence](/guides/beginner-attributes) — Str/Dex/Int là req của Armour/Evasion/ES.
- **related** [Charms: slot trên belt, cách lấy charges và trigger](/guides/beginner-charms) — charm là lớp situational trên các lớp passive.
- **related** [Chết trong POE2: XP penalty, portal rules và Hardcore](/guides/beginner-death-portals) — không chết = không mất XP.
- **related** [Critical Hit: crit chance và crit damage bonus](/guides/beginner-critical-hit) — Evasion downgrade crit thành non-crit.
- **related** [Các loại damage: Physical, Elemental, Chaos, Hit và DoT](/guides/beginner-damage-types) — Physical bị armour, Elemental bị resistance.
- **related** [Flask: cách dùng bình hồi và hệ thống charge](/guides/beginner-flask) — flask là một lớp phòng thủ trong bức tranh toàn cảnh
- **related** [Recovery: Life regen, ES recharge và Leech hoạt động thế nào](/guides/beginner-recovery) — recovery là một trong nhiều layer, đặt đúng chỗ
- **related** [Stun: Light Stun và Heavy Stun khác nhau như thế nào](/guides/beginner-stun) — Heavy Stun buildup khi Raise Shield/Parry là trade-off active block
- **related_guides** [Accuracy và Evasion: tấn công có chắc trúng không?](/guides/beginner-accuracy-evasion) — Evasion từ góc defender + entropy + Deflection.
- **related_guides** [Parry, combo và WASD: cơ bản combat POE2](/guides/beginner-combat-basics) — evasion/armour/block tương tác layered.
- **related_guides** [Passive skill tree: cách đọc và phân bổ điểm](/guides/beginner-passive-tree) — node armour/evasion/ES trên tree áp dụng trực tiếp cơ chế defence layers
- **related_guides** [Độ hiếm item: Normal, Magic, Rare, Unique và prefix/suffix](/guides/beginner-item-rarity) — khi nào Rare item thật sự cần cho defense
