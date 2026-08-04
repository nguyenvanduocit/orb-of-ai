---
template: templates/mechanic-template.md
document_type: mechanic
title: Herald of Ice Shatter
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: skills
tags:
  - herald-of-ice
  - shatter
  - freeze
  - cold
  - clear-engine
  - payoff
  - poe2
  - mechanic
---

# Herald of Ice Shatter

:wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ice"} = persistent buff, tags Buff/Attack/Persistent/AoE/Cold/Herald/Payoff — Tier 4, reserve 30 Spirit, cần bất kỳ :wiki-link{url="https://www.poe2wiki.net/wiki/Martial_Weapon"} là bật được. Clear-engine phổ biến nhất league Runes of Aldur: **30.9% ladder** (~1/3 character). Mạnh ở clear (không single-target): mỗi enemy :wiki-link{url="https://www.poe2wiki.net/wiki/Shatter"} → nổ 1 cold AoE lớn dọn pack, gần miễn phí.

Điểm hay hiểu sai: vụ nổ **KHÔNG** deal máu con vừa chết, cũng không phải base cố định — nó deal **% damage của chính cú đánh mình**, convert 100% sang cold.

## Vụ nổ deal bao nhiêu + scale gì

- Trigger: buff on, Shatter enemy bằng 1 **non-Herald Attack Hit** → Herald of Ice bắn icy explosion deal Attack damage cho enemy xung quanh. Gem text 0.5.0:
  - Explosion Attack Damage: **70% @gem lv1, 144% @lv10, 286% @lv20**.
  - 100% phần Physical của vụ nổ convert sang Cold.
  - Radius **1.6m**, không bị :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion"} né.
  - Quality: tới +20% increased Cold damage + tới +0.4m radius.
- +level (Skull Corona, gem >20): 415% @lv25, 1267% @lv40.
- % áp lên damage cú đánh mình: hit raw 1.000 attack damage @gem lv20 → vụ nổ 2.860 (286%) → convert cold → 2.860 cold AoE cho pack. Hit càng mạnh vụ nổ càng mạnh → double-dip đầu tư weapon/attack, gói thành cold bom.
- 100% phys→cold: mọi cold damage / cold pen / area of effect scale vụ nổ; phys damage weapon cũng scale (input trước convert). Build cold attack hợp tự nhiên.

## "Shatter chain reaction" là hiểu lầm

- Trigger cần **non-Herald** Attack Hit. Vụ nổ là Herald hit (không phải non-Herald attack hit) → không tự kích lại Herald of Ice. GGG khoá thêm từ 0.2.0: on-kill effect của Herald skill không trigger từ kill do chính Herald skill gây ra. → vụ nổ **không self-chain**.
- Cảm giác "chain" thật ra: 1 cú cold AoE freeze+kill nhiều con cùng lúc, mỗi con Shatter = 1 vụ nổ riêng. 1 cast → nhiều shatter → nhiều vụ nổ phủ màn hình, finish con thoi thóp. Tăng clear = tăng số enemy shatter/cú (AoE rộng, freeze nhanh), KHÔNG có ricochet để dựa.
- `Exclusion check:` vụ nổ không tự trigger Herald of Ice (cần non-Herald attack hit) · vụ nổ không inflict freeze buildup nên không tự freeze con mới · không martial weapon → không reserve được.

## Shatter đến từ đâu

- Shatter = kill 1 enemy đang :wiki-link{url="https://www.poe2wiki.net/wiki/Frozen"} (xác vỡ vụn thay vì để corpse). Cần freeze source ổn định: cold hit build Freeze buildup tới ngưỡng → frozen → kill khi frozen. Vụ nổ Herald tự nó không build freeze (area damage cannot inflict freeze buildup) → freeze từ cú đánh/skill khác.
- Hạ rào shatter: :wiki-link{url="https://www.poe2wiki.net/wiki/Polcirkeln"} → enemy bị :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"} bởi hit mình được Shatter như thể Frozen (chỉ cần chill, proc dày trên build cold nhẹ). :wiki-link{url="https://www.poe2wiki.net/wiki/Sculpted_Suffering"} → enemy Fully Armour Broken kill bằng hit sẽ Shatter (mở Herald cho build phys armour-break không chạm cold).

## Scale damage vụ nổ

- Vụ nổ = payoff hit → nhận modifier như mọi cold attack hit + nguồn riêng Herald:
- **Deadly Herald** (support): vụ nổ +30% more damage, đổi +20 Spirit reservation. Multiplier "more", nhân thẳng 286% base.
- :wiki-link{url="https://www.poe2wiki.net/wiki/The_Coming_Calamity"} (body, Lv65): grant cả 3 Herald level 15, "Herald Skills deal (50—100)% increased Damage", "Enemies in your Presence have no Elemental Resistances" → bỏ cold res enemy trong tầm, vụ nổ ăn full.
- Gem level: nguồn base chính (70% → 286% → cao hơn với +level).
- Cold/area/pen passive: increased Cold + area vào pool increased chung; cold pen/exposure nhân ở tầng riêng.
- Chuỗi ví dụ @gem lv20, hit nền 1.000: vụ nổ 286% = 2.860 → Deadly Herald ×1.30 = 3.718 cold → trong Presence của The Coming Calamity (no ele res) ăn trọn. + increased Herald (+50–100%) + cold passive → wipe pack trash mỗi shatter. Lý do 30.9% ladder: rẻ, mọi martial weapon, mọi build cold/freeze shatter sẵn.

## Tổng kết

- Clear-engine archetype cold/shatter, không single-target tool. Vụ nổ 70–286% damage cú đánh (theo gem level), convert cold → scale theo weapon hit + cold + area + Herald-damage, double-dip weapon. Không self-chain — pack tan vì 1 cú shatter nhiều con frozen. Cần freeze source riêng; Polcirkeln (chill cũng shatter) hạ rào dễ nhất.
- Open question: đo empirical hit rate vụ nổ trên boss đơn (1 target, không pack) đóng góp bao nhiêu DPS so với clear — Herald of Ice gần như chỉ clear payoff, single-target boss vẫn dựa skill chính.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Số scaling verify từ poedb: Explosion Attack Damage 70% → 286% @gem lv1–20, 100% phys-to-cold, reservation 30 Spirit, radius 1.6m. Không thay đổi cơ chế Herald of Ice trong patch note 0.5.0.

### Patch 0.2.0
- Explosion radius 1.8m → 1.6m. On-kill effect Herald skill không còn trigger từ kill do chính Herald skill gây ra — khoá self-chain.

## Relationships

- **related_builds** [Pathfinder Herald of Ice Bow](/builds/ranger/0-5-pathfinder-herald-of-ice-bow) — build dùng Herald of Ice làm clear-engine cold bow.
- **synergizes_with** [Twister](/guides/twister) — cold Twister freeze enemy rồi shatter, Herald of Ice gánh clear pack cho cùng cú đánh.
- **related** [Lineage Support Gems](/guides/lineage-support-gems) — cùng lớp gem layer định hình meta cold/lightning league Runes of Aldur.
