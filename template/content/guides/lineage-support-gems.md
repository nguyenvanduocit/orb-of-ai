---
template: templates/mechanic-template.md
document_type: mechanic
title: Lineage Support Gems
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
tags:
  - lineage-support
  - support-gem
  - siones-temper
  - endgame
  - drop-restricted
  - poe2
  - mechanic
---

# Lineage Support Gems

:wiki-link{url="https://www.poe2wiki.net/wiki/Lineage_support_gem"} = subcategory support gem mạnh hơn hẳn support thường, mỗi cái viết lại luật của skill, kèm ràng buộc. = "unique item cho support gem", mỗi gem mang tên nhân vật huyền thoại POE (Sione, Esh, Tul, Olroth, Breachlord, Atziri…). Ra mắt 0.3.0; 0.5.0 thêm **24 gem mới** → roster **>40**.

## Lineage support khác support thường

- **Sức mạnh**: không phải "increased X% damage" theo tier mà viết lại luật skill — Dialla's Desire cho +1 level + +10% quality đồng thời giảm cost/reservation; Esh's Prowess cho lightning skill chỉ roll min hoặc max (bỏ khoảng giữa) + +1 level; Breachlord's Amalgam biến projectile cold/lightning bay về xuyên target.
- **Ràng buộc**: mỗi gem có giới hạn riêng, không craft ra được như support thường.
- Phần lớn require Level 65, vài cái thấp hơn (Kurgal's Leash chỉ Lv25), + yêu cầu attribute. Mỗi gem thuộc 1 category → quyết định xung khắc support nào.

## Hai luật giới hạn

- **Một copy**: chỉ socket **1 bản mỗi Lineage support** trên toàn build cùng lúc. Không cắm 2 Sione's Temper cho 2 skill. Vượt giới hạn duy nhất: :wiki-link{url="https://www.poe2wiki.net/wiki/Solus_Ipse"} (Grand Visage helm) cho socket thêm 2 bản mỗi Lineage support, mỗi bản 1 skill khác.
- **Category**: 1 active skill chỉ nhận 1 support mỗi category, **tính cả bản non-lineage**. Vd Uruk's Smelting category Armour Demolisher → không cắm chung Uruk's Smelting + Armour Demolisher II vào cùng skill. Pick Lineage support phải kiểm category có đụng support thường đang chạy không.
- `Exclusion check:` 1 copy mỗi Lineage support toàn nhân vật (trừ Solus Ipse cho 2 copy) · cùng category loại trừ nhau kể cả bản non-lineage · không socket được vào skill mà category đã bị support khác chiếm.

## Kiếm ở đâu (quyết định giá)

- Không engrave được từ :wiki-link{url="https://www.poe2wiki.net/wiki/Uncut_Support_Gem"} như support thường — không craft. Chỉ rớt.
- **Global** (rớt bất cứ đâu endgame, cung dày → rẻ): Sione's Temper, Dialla's Desire, Dominus' Grasp, Arakaali's Lust, Ratha's Assault, Brutus' Brain, Morgana's Tempest…
- **Encounter-locked** (hiếm, đắt):
  - Pinnacle boss: :wiki-link{url="https://www.poe2wiki.net/wiki/Xesht,_We_That_Are_One"} → Esh's Radiance, Xoph's Pyre, Tul's Stillness, Uul-Netol's Embrace; Atziri → Atziri's Impatience, Zerphi's Infamy; Olroth → bộ ba Uhtred; The Arbiter of Ash → Arbiter's Ignition; Trialmaster → Ixchel's Torment.
  - Abyssal Depths: Large Abyssal Trove cuối dungeon → Amanamu's Tithe, Kurgal's Leash, Kulemak's Dominion, hiếm khi Lineage support khác.
  - Anomaly boss / Deadly Map Boss: pool riêng từng boss (Manoki → Rakiata's Flow, Tawhoa's Tending, Kaom's Madness, Tasalio's Rhythm…).
- Giá: gem global sàn vài chục ex; gem chase khoá Pinnacle có thể lên hàng nghìn ex khi build mạnh cần đúng nó. Định giá phải kiểm global hay boss-locked trước.

## Sione's Temper

- Tags: Support, Lineage, Spell, Projectile. Effect: support projectile spell, cho chance ngày càng cao bắn thêm nhiều projectile thành một vòng tròn, reset chance khi bắn vòng đó. Single-projectile spell → thỉnh thoảng dội cả vòng projectile bao quanh — đổi pattern bắn, không chỉ cộng damage.
- Rớt global → sàn **~25 ex (~0.19 div)** theo poe2scout 10/06/2026, rẻ so gem khoá boss. Dễ biến động: cộng đồng tìm ra projectile spell nhân tốt với cơ chế vòng → cầu kéo giá nhanh.

## Lineage ≠ Kalguuran support

- Dễ gộp nhầm vì cùng quanh nội dung Kalguur, nhưng tách hoàn toàn.
- **Lineage support** = unique-tier ở trên: rớt boss/global, không craft, tên nhân vật huyền thoại.
- **Kalguuran support** = đúng 7 cái (Concussive Runes, Fist of Kalguur, Healing Runes, Runeforged Blades, Runic Extraction, Runic Infusion, Scouring Flame) + 23 Kalguuran skill — **craft từ** :wiki-link{url="https://www.poe2wiki.net/wiki/Remnant"} qua league mechanic, không drop.
- Nói "Sione's Temper thuộc hệ Kalguuran" là gộp nhầm: Sione's Temper là Lineage support (drop, tag Spell/Projectile), không liên quan Remnant/Kalguuran craft.
- Open question: roll cụ thể Sione's Temper (chance khởi điểm, mức tăng mỗi lần, số projectile mỗi vòng) chưa trích được từ poedb tag page — đọc client/poe2db gem page để chốt trước khi đưa vào build math.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Thêm 24 Lineage support mới (Arbiter's Reach, Breachlord's Amalgam, Catha's Brilliance, Eonyr's Thunder, Esh's Prowess, Tul's Avalanche, bộ Olroth, bộ Uhtred, bộ Vruun…) → roster >40.
- Bugfix Lineage support cũ (Dialla's Desire không còn function khi bị disable, Hayoxi's Fulmination không còn support non-Curse skill).

### Patch 0.3.0
- Lineage support gem introduced — support unique-tier drop từ endgame, không engrave từ Uncut Support Gem.

## Relationships

- **related** [Herald of Ice Shatter](/guides/herald-of-ice-shatter) — cùng lớp gem layer định hình meta cold/lightning league Runes of Aldur.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Lineage support tách khỏi Kalguuran support craft-from-Remnant của league mechanic này.
- **related** [Anomaly Map Lineage Support Farming](/farming/0-5-anomaly-lineage-support-farm) — nền cơ chế: luật một-copy, category loại trừ, drop boss-locked vs global.
- **related** [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation) — Dialla's Desire + Atziri's Communion can thiệp reservation.
