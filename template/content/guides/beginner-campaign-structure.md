---
template: templates/guide-template.md
document_type: guide
title: "Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint"
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
  - campaign
  - checkpoint
  - waypoint
  - resistance
---

# Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint

Campaign = Act story + Interlude filler dẫn vào Endgame. Nắm cấu trúc để không bị bất ngờ khi resistance rớt hoặc respawn nhầm chỗ.

## Cấu trúc: Act 1–4 + 3 Interlude + Epilogue

- :wiki-link{url="https://www.poe2wiki.net/wiki/Act_1"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Act_2"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Act_3"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Act_4"} — mỗi act: town + NPC + act boss. Act 5/6 chưa ra trong 0.5 (TBA).
- Sau Act 4: 3 :wiki-link{url="https://www.poe2wiki.net/wiki/Interlude"} (filler Early Access, gỡ khi full campaign ra): *The Curse of Holten*, *The Stolen Barya*, *Doryani's Contingency*. Xong 3 → :wiki-link{url="https://www.poe2wiki.net/wiki/Epilogue"} = start Endgame.
- Hành trình 7 mốc: Act 1 → 2 → 3 → 4 → Interlude 1 → 2 → 3 → Epilogue.

## Mỗi act −10% resistance, tổng −60%

- Từ Act 2 trở đi, mỗi act mới: **−10% all elemental resistance** (fire/cold/lightning cùng lúc). Permanent trong campaign.
- Tới Epilogue: tổng **−60% all elemental res**.
- Sau mỗi act → mở Character Panel check res; res nào dưới 75% → tìm gear bù trước khi đi tiếp.
- Act boss rớt skull +Spirit: Act 1 boss **+30 Spirit**, Act 3 boss **+30 Spirit**, Interlude 3 **+40 Spirit** → tổng **100 Spirit** từ campaign.

## Checkpoint: hồi phục + teleport nội bộ area

- :wiki-link{url="https://www.poe2wiki.net/wiki/Checkpoint"}: điểm sáng nhỏ, dày trước boss arena + entrance/exit giữa các khu. Đến gần = tự kích hoạt (không cần click) → refill full :wiki-link{url="https://www.poe2wiki.net/wiki/Flask"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} + Life/Mana.
- Click Checkpoint đã mở → teleport tức thì tới Checkpoint khác cùng area (hoặc tới Waypoint trong area). CHỈ trong cùng area, không cross-area.

## Waypoint: di chuyển cross-area

- :wiki-link{url="https://www.poe2wiki.net/wiki/Waypoint"}: đi qua lại giữa area/town đã unlock. Đến gần = sáng xanh, unlock vĩnh viễn (không cần click).
- Phím `U` (hoặc click Waypoint) → World Interface: bản đồ mọi Waypoint unlocked + :wiki-link{url="https://www.poe2wiki.net/wiki/Town"} các act + Hideout/Ascension Trial. Click icon → teleport.
- Waypoint cũng refill Life/Mana/Flask/Charm. Trong Atlas: click Town trực tiếp trên map để về town.

## Chết trong softcore

- Không mất character, không mất XP, không penalty. Area reset: quái respawn, item dưới sàn biến mất (trừ guaranteed boss drop như uncut gem).
- 2 lựa chọn respawn: town act hiện tại, hoặc Checkpoint cuối đã kích hoạt (Waypoint trong area cũng tính).
- Trước boss: kích hoạt Checkpoint ngay trước arena → chết chọn respawn ở đó. Boss KHÔNG reset, HP giữ nguyên.
- Hardcore: chết = xóa character, không respawn.

## Relationships

- **related** [Spirit: tài nguyên reservation của POE2](/guides/beginner-spirit) — act boss rớt skull +Spirit; chi tiết Spirit dùng vào gì.
- **related** [Resistances trong POE2](/guides/beginner-resistances) — cap 75%, bù −60% penalty để vào Endgame.
- **related** [Flask và Charm cơ bản](/guides/beginner-flask) — Checkpoint refill Flask + Charm.
- **related** [Waystone và Atlas cơ bản](/guides/beginner-waystone-atlas) — Town click trên Atlas map mở rộng Waypoint system.
- **related** [Chết trong POE2: XP penalty, portal rules và Hardcore](/guides/beginner-death-portals) — chi tiết death, endgame XP penalty, Hardcore.
- **related** [Phần thưởng quest vĩnh viễn: Spirit, Life và passive points từ boss](/guides/beginner-quest-rewards) — thứ tự act/zone để không bỏ lỡ boss thưởng
