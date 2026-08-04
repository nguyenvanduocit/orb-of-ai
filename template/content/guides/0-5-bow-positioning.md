---
template: templates/guide-template.md
document_type: guide
title: Kỹ thuật positioning cho bow build
status: published
author: duocnv
created: '2026-06-11'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
guide_type: fundamentals
tags:
  - poe2
  - 0-5
  - bow
  - positioning
  - kiting
  - dodge-roll
  - deadeye
  - combat
---

# Kỹ thuật positioning cho bow build

Kỹ thuật chỗ đứng cho mọi bow build POE2: accuracy rơi theo distance, damage có band tối ưu, pack map 0.5 dí rát. Build tham chiếu: [Pathfinder Herald of Ice Bow](/builds/ranger/0-5-pathfinder-herald-of-ice-bow).

## Khoảng cách là một stat damage

- Attack penalty theo distance: 2m đầu không penalty → tăng đều → 90% less :wiki-link{url="https://www.poe2wiki.net/wiki/Accuracy"} khi target >9m. Penalty là **multiplier**: 1.000 Accuracy → 100 effective ngoài 9m. Bow là attack nên dính trọn. Cơ chế accuracy vs evasion: [Accuracy và Evasion](/guides/beginner-accuracy-evasion).
- Band thoải mái ~4–6m: penalty ~26–51% (nội suy 2m→9m), bù bằng accuracy gear/tree. Ngoài 9m = vùng 90%, chỉ đứng lúc né cơ chế.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Deadeye"} kéo band về hai phía bằng 2 node loại trừ nhau:
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Point_Blank"}: 20% more hit damage target trong 3.5m đầu đường bay, giảm về 0% sau 7m → damage đỉnh ở vùng nguy hiểm (hợp build evasion dày).
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Far_Shot"}: 0% trong 3.5m, leo 20% sau 7m — nhưng ở 7m accuracy penalty đã ~64%. Vá: stack accuracy vượt "đủ dùng", hoặc mod "Accuracy is not reduced at distance" (hiếm).
- ✗ Projectile Speed **KHÔNG** kéo dài tầm bay :wiki-link{url="https://www.poe2wiki.net/wiki/Projectile"} trong POE2 — chỉ làm đạn tới đích nhanh hơn.

## Dodge roll là nút phản ứng

- :wiki-link{url="https://www.poe2wiki.net/wiki/Dodge_roll"}: mặc định không cooldown, không tốn resource, lăn 3.7m, nửa đầu animation cho i-frame với projectile + đòn không phải AoE. AoE dưới chân KHÔNG né bằng i-frame — phải lăn ra khỏi vùng phủ. Timing telegraph: [Dodge roll và combat](/guides/beginner-dodge-roll).
- Trong roll, kích thước nhân vật về 0 unit → lách qua khe giữa 2 con quái. Bị melee bọc = tình huống chết số 1 của bow → roll xuyên khe thưa nhất, không roll lùi (hướng lùi thường là hướng bị dồn).
- Roll cancel hầu hết animation. Đang channel :wiki-link{url="https://www.poe2wiki.net/wiki/Snipe"} mà boss vung đòn → roll (mất stage channel rẻ hơn mất máu, Snipe bắn lại ngay).
- Tổng quãng đường roll = đi bộ cùng thời gian (cùng ăn movement speed) → roll liên tục không nhanh hơn chạy; spam roll còn kẹt animation đúng lúc cần né. Đi đường dài → giữ spacebar sprint, roll để dành đòn có telegraph. Roll không vượt gap / hàng rào thấp / chênh độ cao.

## Kite bằng WASD theo nhịp bắn

- WASD: bắn 1 hướng, bước hướng khác khung sau; click-to-move dễ misclick vào quái. Nền combat WASD: [Parry, combo và WASD](/guides/beginner-combat-basics).
- Bow attack root chân trong attack animation → bắn 1-2 phát, bước 1 nhịp đổi vị trí, bắn tiếp. Mỗi bước: kéo khoảng cách về band + ra khỏi đường đạn quái đã nhắm + mở góc bắn mới.
- Hướng kite > tốc độ kite. ✗ lùi thẳng (quái dí đường ngắn nhất, giữ nguyên hướng cả pack, tốc lùi bị ngắt bởi attack animation). ✓ kite chéo/vòng cung → giữ band, quái đổi hướng liên tục, pack kéo thành hàng dọc (đúng hình cho pierce/chain). Đổi hướng vòng cung vài giây/lần xếp quái thành line không tốn skill.

## Escape Shot và Blink là hai nút thoát hiểm

- :wiki-link{url="https://www.poe2wiki.net/wiki/Escape_Shot"}: nhảy lùi + bắn mũi tên băng nổ chỗ vừa đứng — radius 2.4m, 300–585% more Chill magnitude + Freeze buildup theo level gem. +0.7s Total Attack Time → nút tình huống, không spam.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Blink"}: persistent buff — off cooldown thì dodge roll → teleport tầm ngắn. Teleport KHÔNG tính là dodge roll → không kích :wiki-link{url="https://www.poe2wiki.net/wiki/Cast_on_Dodge"}.

## Control ghim quái tại chỗ

- Ghim quái đứng yên giữ band mà không tốn nhịp bước. Support :wiki-link{url="https://www.poe2wiki.net/wiki/Pin_I"} đổi stun buildup thành Pin buildup từ phys damage; đủ ngưỡng (40% thường / 50% magic / 60% rare / 70% unique) → target :wiki-link{url="https://www.poe2wiki.net/wiki/Pinned"} 3s (không di chuyển, không bị đẩy, không evade). Chill/freeze cùng vai cho build cold.
- Deadeye: :wiki-link{url="https://www.poe2wiki.net/wiki/Tailwind"} qua node :wiki-link{url="https://www.poe2wiki.net/wiki/Gathering_Winds"} — mỗi stack 1% movement speed, 2% Skill Speed, 10% inc Evasion, chặn 1% damage từ Deflected hit, max 10 stack. Full = +10% tốc chạy + 20% skill speed.

## Positioning theo encounter

- **Boss**: band tầm trung, đừng max range. Trước khi né biết hướng roll kế; vị trí mới còn ≥1 đường thoát (roll vào góc tường = tự nhốt). Arena boss chồng nhiều vùng telegraph — bước sớm ra rẻ hơn roll ép timing.
- **Map thường**: lưng hướng về vùng đã dọn. Tiến pack mới theo góc xiên, không đi thẳng giữa 2 pack.
- **Breach**: quái trồi quanh mép vòng lan — đứng giữa tâm = bị bọc. Men theo rìa đã dọn.
- **Ritual**: ụp cả đàn revived khi chạm altar, layout hẹp không đường lùi. Trước activate đảo vòng nhìn địa hình, chọn cung ít chướng ngại làm chỗ kite. Cơ chế + chọn map: [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless).

## Pitfalls

- ✗ Đứng cuối màn hình bắn (thói POE1) → accuracy penalty 90% ngoài 9m.
- ✗ Spam roll để di chuyển → không nhanh hơn chạy, kẹt animation đúng lúc cần né. Sprint để đi, roll để né.
- ✗ Lăn tại chỗ trong vòng đỏ → i-frame roll không chặn AoE, phải lăn ra khỏi vùng.
- ✗ Tiếc phát Snipe full channel khi boss ra đòn → roll cancel channel luôn, bắn lại sau.
- ✗ Lùi thẳng khi kite → kéo pack về phía mình; kite chéo/vòng cung.
- ✗ Lấy mép vực/gap làm đường thoát → roll không qua được.

## Relationships

- **related_builds** [Pathfinder Herald of Ice Bow](/builds/ranger/0-5-pathfinder-herald-of-ice-bow) — bow build tham chiếu áp dụng các kỹ thuật này.
- **related_guides** [Dodge roll và combat trong POE2](/guides/beginner-dodge-roll) — timing telegraph + i-frame chi tiết.
- **related_guides** [Accuracy và Evasion](/guides/beginner-accuracy-evasion) — cơ chế accuracy distance penalty band dựa vào.
- **related_guides** [Parry, combo và WASD](/guides/beginner-combat-basics) — nền combat WASD cho kỹ thuật kite.
- **related_guides** [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless) — cơ chế Ritual cho positioning theo encounter.
