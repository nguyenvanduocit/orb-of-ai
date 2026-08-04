---
template: templates/guide-template.md
document_type: guide
title: Resistance và cơ chế cap 75%
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
  - resistance
  - defense
  - chaos-resistance
  - elemental
---

# Resistance và cơ chế cap 75%

:wiki-link{url="https://www.poe2wiki.net/wiki/Resistance"} quyết định % damage fire/cold/lightning/chaos thực nhận mỗi đòn. Lý do #1 khiến người mới chết oan (chưa cap → ăn damage gấp 2–4 lần).

## Vì sao mỗi 1% dưới cap đều quan trọng
- Giảm damage đầu vào trực tiếp: 0% = nhận 100% · 75% = nhận 25% (đòn 1000 fire: cap nhận 250, không res nhận 1000)
- Mỗi 1% thiếu so với 75% = 1% damage dư chịu thêm
- Cap mặc định 75% cả 4 loại; trên 75% vô hiệu trừ khi có **maximum resistance** (hiếm) → mục tiêu người mới: **75/75/75/75**

## Penalty elemental theo tiến trình
Game tự giảm elemental resistance (fire/cold/lightning), KHÔNG áp cho chaos:

| Mốc | Penalty |
|-----|---------|
| Hết Act 2 | −10% |
| Hết Act 3 | −20% |
| Hết Act 4 | −30% |
| Interlude (area lv 54–59) | −40% |
| Interlude (area lv 60–64) | −50% |
| Endgame (area lv 65+) | −60% |

- Endgame −60%: gear +75% fire res → còn 15% → nhận 85% fire damage → cần **+135% elemental resistance từ gear** để đạt 75

## Chaos resistance luôn thấp
- Không bị penalty nhưng: tree ít node chaos res · gear ít roll · **rune (Verisium Runeforging) KHÔNG có rune chaos res, chỉ elemental** → chaos thường kẹt thấp/âm
- Ví dụ ThaoCamVienSaiGon (Lv93 Spirit Walker) endgame: fire 50 / cold 75 / light 75 / :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Resistance"} 27 → chaos thiếu 48%, nhận 73% thay vì 25%
- Chaos damage đến từ poison pool, boss ability pha cuối, corrupted map mod (giết không báo trước); **belt** dễ roll chaos nhất, amulet + ring cũng được → ưu tiên 3 slot này

## Tìm resistance ở đâu
- **Gear** = nguồn chính: "+X% to Elemental Resistances" gộp cả 3 fire/cold/lightning → tiết kiệm nhất; chaos res phải tìm riêng (không gộp vào elemental / all resistance)
- **Passive tree**: cụm all elemental + từng loại → gõ "resist" ô search
- **Quest reward** cố định: Beira of the Rotten Pack (Act 1) +10% cold · Sisters of Garukhan (Act 2) +10% lightning · Blackjaw the Remnant (Act 3) +10% fire · 3 tattoo Act 4 mỗi loại +5% — res miễn phí, đừng bỏ
- Map mod :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"} đẩy cả 3 xuống dưới 75% dù đang cap → check số trong ngoặc (uncapped res thật) trước khi vào; cần **overcap** (res thực >75%) để bù

## Relationships

- **related** [Armour và cơ chế giảm physical damage](/guides/armour-defensive-scaling) — resistance phòng nguyên tố, armour phòng physical — bổ sung nhau
- **related** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — resistance lọc damage trước khi trừ vào pool
- **related** [Recovery: Life regen, ES recharge và Leech](/guides/beginner-recovery) — resistance giảm damage đầu vào, recovery bù phần còn lại
- **related** [Energy Shield và cách recover](/guides/energy-shield-recovery) — ES nhận damage sau khi qua resistance filter
- **related** [Charms: slot trên belt, cách lấy charges và trigger](/guides/beginner-charms) — Amethyst/Ruby/Sapphire/Topaz Charm cho resistance tạm thời.
- **related** [Các keyword damage quan trọng: Exposure, Penetration, Armour Break, Culling](/guides/beginner-damage-keywords) — Exposure/Penetration tác động resistance enemy.
- **related** [Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint](/guides/beginner-campaign-structure) — cap 75%, bù −60% penalty để vào Endgame.
- **related** [Flask: cách dùng bình hồi và hệ thống charge](/guides/beginner-flask) — Ruby/Sapphire/Topaz Charm cho resistance tạm thời khi ăn hit
- **related_guides** [Passive skill tree: cách đọc và phân bổ điểm](/guides/beginner-passive-tree) — resistance node là ưu tiên tree đầu tiên khi vào endgame
- **related_guides** [Trading và đổi currency cơ bản](/guides/beginner-trading) — resistance thường là mod đầu tiên cần filter khi search gear
