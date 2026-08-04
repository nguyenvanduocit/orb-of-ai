---
template: templates/guide-template.md
document_type: guide
title: "Critical Hit: crit chance và crit damage bonus"
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
  - critical-hit
  - damage-scaling
  - crit-chance
  - crit-damage
---

# Critical Hit: crit chance và crit damage bonus

:wiki-link{url="https://www.poe2wiki.net/wiki/Critical_hit"} = axis damage scaling phổ biến. Khác POE1 ở tên gọi + cách tính → dễ hiểu nhầm.

## Crit mặc định gấp đôi damage

- Crit = **+100% extra damage** = **200% tổng** của hit. Mặc định cho mọi player + minion.
- Crit chance 100% với setup cơ bản = đúng 2× base damage, không cần modifier phức tạp.

## Critical Damage Bonus ≠ "crit multi"

- Stat kiểm soát phần extra khi crit gọi là :wiki-link{url="https://www.poe2wiki.net/wiki/Critical_damage_bonus"} (POE1: "Critical Strike Multiplier"). Đọc item tìm đúng tên.
- Multiplier độc lập. Tính: lấy +100% mặc định, cộng mọi "+#% to Critical Damage Bonus" (weapon/buff) TRƯỚC, rồi mới apply increased/more. Weapon +50% → base +150%; "50% more Critical Damage Bonus" nhân từ +150% (không phải +100%).
- "+#% to Critical Damage Bonus" trên weapon = **local** (chỉ hit từ weapon đó). "increased Critical Damage Bonus" = global.

## Crit chance: attack vs spell nguồn khác nhau

- :wiki-link{url="https://www.poe2wiki.net/wiki/Attack"}: base crit từ **weapon** đang cầm — martial weapon ~5%–13% tùy loại; unarmed = 5%.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Spell"}: base crit ghi trên **skill gem**, không lấy từ weapon (Reap = 14% trên gem, không đổi khi swap weapon).

## "Increased Critical Hit Chance" cộng additive vào base

- Ví dụ wiki: base 7% + 100% increased = **14%** (= 7% × (1 + 100%), không phải multiplicative).
- Công thức: `crit chance = base_crit × (1 + tổng_increased) × các_more`. "more" nhân thêm — vd :wiki-link{url="https://www.poe2wiki.net/wiki/Charge_Regulation"} 20–26% more Critical Hit Chance khi có Power Charge.
- 300% increased trên base weapon 10% → **40% final** (không phải 300% + base).

## Bifurcated Critical: roll 2 lần

- :wiki-link{url="https://www.poe2wiki.net/wiki/Bifurcated_Critical_Hits"}: hit roll crit check **2 lần độc lập**.
- 1 lần thành công → crit thường, Critical Damage Bonus áp 1 lần.
- Cả 2 thành công → crit, Critical Damage Bonus áp **2 lần**: base +100% → +200% extra = **300% damage** thay vì 200%.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Tangletongue"} (Forked Spear) có sẵn Bifurcates Critical Hits; support :wiki-link{url="https://www.poe2wiki.net/wiki/Garukhan%27s_Resolve"} cho cơ chế này nhưng cap crit chance ở **50%**. Bifurcated build stack Critical Damage Bonus cao.

## Khác POE1

- **Tên**: Critical Strike Multiplier → Critical Damage Bonus.
- **Không còn "never critically strikes"**: keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Resolute_Technique"} vẫn block crit hoàn toàn, nhưng monster immunity dùng evasion downgrade — attack có thể evaded, evasion check 1 fail (hit land) → check lần 2; lần 2 thành công → downgrade thành non-crit.
- **Crit check roll 1 lần / hit từ 1 skill**: 1 cast nhiều projectile → mỗi projectile player roll crit riêng; projectile monster cùng skill all-or-nothing. Sustained + channelling roll từng hit.

## Relationships

- **related** [Increased vs More: hai loại damage modifier khác nhau](/guides/beginner-increased-vs-more) — additive vs multiplicative để đánh giá modifier crit.
- **related** [Damage types trong POE2](/guides/beginner-damage-types) — Critical Damage Bonus là multiplier độc lập.
- **related** [Defence layers trong POE2](/guides/beginner-defence-layers) — Evasion downgrade crit thành non-crit.
