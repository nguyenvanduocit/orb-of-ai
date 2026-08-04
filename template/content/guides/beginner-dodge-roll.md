---
template: templates/guide-template.md
document_type: guide
title: Dodge roll và combat trong POE2
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
  - dodge
  - combat
  - i-frame
---

# Dodge roll và combat trong POE2

Dodge roll = phòng thủ chủ động cốt lõi, không phải cách di chuyển nhanh. Mọi boss endgame design với giả định người chơi biết roll né.

## Dodge roll cho i-frame

- :wiki-link{url="https://www.poe2wiki.net/wiki/Dodge_roll"}: nửa đầu animation roll → nhân vật không nhận damage từ projectile + đòn không phải AoE. = **i-frame** (miễn nhiễm hoàn toàn, không phải "khó trúng hơn").
- Khác chạy né: đứng né ngang → projectile vẫn có thể trúng theo hitbox; trong i-frame projectile xuyên qua 0 damage.
- AoE khác: i-frame KHÔNG chặn AoE → phải lăn ra khỏi vùng phủ thật.
- Mặc định không cooldown, không tốn resource. Giới hạn duy nhất = animation, đợi roll xong mới roll tiếp. Không có "stamina".

## Roll sau telegraph, không roll trước

- Hầu hết boss có **animation telegraph** rõ trước khi đòn chạm: wind-up dài, vòng sáng đỏ/cam trên sàn, âm thanh cảnh báo → tín hiệu để roll.
- Lỗi phổ biến nhất: roll **quá sớm** — thấy boss cử động thì roll ngay, i-frame hết trước khi đòn tới → vẫn chết.
- Timing đúng: roll SAU khi telegraph khởi động rõ, TRƯỚC khi đòn chạm vị trí đang đứng. Window khá rộng.

## Roll ngắt skill đang cast — và đó là đúng

- Roll **hủy bất kỳ skill nào đang cast**. Đòn boss endgame > phần DPS mất khi roll sớm, đặc biệt one-shot/debuff nặng.
- Cứ roll, nhận DPS thấp hơn 1 chút, cast lại sau khi đòn qua.

## Sprint ≠ dodge roll

- **Tap** spacebar → roll. **Hold** spacebar → sprint. Sprint KHÔNG có i-frame, chỉ chạy nhanh hơn. Hold nhầm → vẫn trúng đòn dù "đã né".

## Pitfalls

- ✗ Roll quá sớm trước telegraph → đợi animation khởi động rõ mới roll.
- ✗ Roll liên tục khi không có đòn nguy hiểm → đứng yên cast damage hiệu quả hơn.
- Boss AoE phủ full màn → roll ra edge của AoE, không roll vào giữa.
- Bị vây kín → roll hướng khe thưa nhất, tránh kẹt.

## Relationships

- **related_guides** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — lớp passive bổ trợ khi miss roll.
- **related_guides** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — pool sống chịu đòn khi timing roll sai.
- **related_guides** [Parry, combo và WASD: cơ bản combat POE2](/guides/beginner-combat-basics) — dodge roll gắn WASD; Parry + Active Block bổ sung.
- **related_guides** [Kỹ thuật positioning cho bow build](/guides/0-5-bow-positioning) — timing telegraph + i-frame chi tiết.
