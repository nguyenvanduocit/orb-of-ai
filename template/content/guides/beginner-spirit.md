---
template: templates/guide-template.md
document_type: guide
title: "Spirit: tài nguyên reservation của POE2"
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
  - spirit
  - reservation
  - aura
  - minion
---

# Spirit: tài nguyên reservation của POE2

Spirit = resource duy trì aura, minion thường trực, persistent skill — hoàn toàn tách Mana. Người mới từ POE1 hay nhầm hai thứ.

## Spirit ≠ Mana, không có sẵn
- POE1: aura tốn Mana reservation. POE2: aura + persistent skill tiêu **Spirit**, không phải Mana
- Char mới tạo có **Spirit = 0** (Mana vẫn có để cast skill thường); Spirit zero đến khi tự đi kiếm
- Campaign cho 100 Spirit qua quest reward: boss cuối Act 1 rớt **Gembloom Skull** (+30) · boss Act 3 rớt **Gemrot Skull** (+30) · Interlude 3 có **Gemcrust Skull** (+40) → nhặt đủ = **100 Spirit** (đủ vài skill nhỏ, không đủ aura-heavy/minion army)

## Reservation, không phải tiêu
- Bật persistent skill → Spirit bị "chiếm" (không mất, không hồi, không dao động); tắt skill → trả lại
- Tổng Spirit cost > max → skill cuối không bật (không báo lỗi to, chỉ nút không sáng)
- Khác Mana: Mana tiêu rồi hồi theo thời gian; Spirit không hồi, là **trần cố định**

## Lấy Spirit từ đâu
- Sau 100 quest reward → chỉ từ gear + ascendancy
- **amulet** + **body armour**: prefix flat Spirit (vd +30 đến +61 tùy tier)
- **sceptre**: không cho flat nhưng **% increased Spirit** → base cao thì sceptre đẩy thêm nhiều
- :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan%27s_Effigy"}: (54-63)% increased Spirit, thiết kế cho companion zoo; helmet thường không có Spirit trừ corruption
- Ascendancy: Spirit Walker (Huntress) nhiều node cho Spirit + companion reservation efficiency

## Vì sao hết Spirit
- Mỗi aura/minion/herald/persistent buff chiếm lượng Spirit cố định; build 2-3 skill thì 100 đủ, stack thêm → vượt trần nhanh
- ✗ Cố lắp hết persistent skill mà không check tổng → ✓ mở Skills Panel, nhìn phần Spirit: trái = đang dùng, phải = tối đa; trái > phải → skill mới nhất không bật
- Build nhiều aura + companion phải đầu tư Spirit nhiều slot: amulet prefix + body armour prefix + sceptre % increased + ascendancy node → plan từ đầu

## Relationships

- **related** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — Spirit là pool thứ tư hay bị nhầm với Mana
- **related** [Phần thưởng quest vĩnh viễn](/guides/beginner-quest-rewards) — chi tiết 3 boss cho 100 Spirit campaign
- **related** [Skill gem và Support gem](/guides/beginner-skill-gem) — Uncut Spirit Gem tạo skill persistent tiêu Spirit
- **related** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — ascendancy chuyên Spirit + companion reservation, ví dụ build phụ thuộc Spirit cao
- **related** [Sylvan's Effigy](/guides/sylvans-effigy) — unique tăng Spirit ceiling + gỡ trần companion, tool chính build zoo Spirit Walker
- **related** [Ascendancy: chọn subclass và mở khoá như thế nào](/guides/beginner-ascendancy) — Spirit Walker phụ thuộc Spirit resource.
- **related** [Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint](/guides/beginner-campaign-structure) — act boss rớt skull +Spirit; chi tiết Spirit dùng vào gì.
- **related** [Increased vs More: quy tắc tính damage](/guides/beginner-increased-vs-more) — guide cơ bản tương đương, giải thích reservation theo cùng góc beginner
- **related** [Recovery: Life regen, ES recharge và Leech hoạt động thế nào](/guides/beginner-recovery) — aura hỗ trợ recovery (Vitality, Clarity) tiêu Spirit để bật
- **related_guides** [Passive skill tree: cách đọc và phân bổ điểm](/guides/beginner-passive-tree) — spirit node trên tree liên kết hệ thống skill reservation
- **related_guides** [Weapon set và weapon swap trong POE2](/guides/beginner-weapon-swap) — Spirit pool thay đổi theo set active; prerequisite để setup dual-set an toàn
