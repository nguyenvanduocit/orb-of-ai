---
template: templates/farming-template.md
document_type: farming-strategy
title: Rite of the Nameless Omen Farm
status: active
created: '2026-06-24'
updated: '2026-07-03'
strategy_tier: A
investment_tier: High
league: '0.5'
patch: 0.5.3
league_phase: Mid
confidence_level: Medium
---

# Rite of the Nameless Omen Farm

Cùng cơ chế :wiki-link{url="https://www.poe2wiki.net/wiki/Ritual"} với [Ritual Belt Hunting](/farming/0-5-ritual-belt-hunting) nhưng đảo mục tiêu: juice **pack size tối đa** → nhiều tribute → nhiều reroll → **omen volume làm nền thu đều**, belt chỉ là jackpot thỉnh thoảng. `Tier A · investment High · ~45 div/h (đo ~20 map/2.8h ra ~52, lấy conservative) · ~2.5-3 div/map`. Endgame, không league-start.

::omen-farm-cheatsheet
::

## Cơ chế

- Chuỗi giá trị: pack size cao → nhiều tribute → nhiều reroll → mỗi reroll xúc xắc ra omen/unique cao cấp. :wiki-link{url="https://www.poe2wiki.net/wiki/Freedom_of_Faith"} nhân đôi reroll (tablet "+3 additional free rolls" → +6) + node Rite of the Nameless đẩy reroll lên dần mỗi map → **map cuối chuỗi ~22+ reroll**.
- Khác belt hunting: bỏ Abyss (belt hunting lấy Abyss làm nền + Spreading Darkness nghiêng unique về belt); strat này dồn atlas vào pack size, lấy omen volume làm nền. Master **Jado → Partial Translations** +avg 20% effect mọi tablet, khuếch đại cả tăng-chance-omen lẫn giảm-tribute-reroll.
- **Defer omen qua item filter:** bật `apply item filter to ritual = true` trong `production_config` → filter highlight omen/unique đáng lấy. Món quá đắt (:wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} 25k tribute) không hiện, nhưng Defer hạ xuống ~3-3.5k tribute là vừa túi → quay tiếp, gom hết cuối map. Head of the King + Rite + defer đầy đủ ở [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless).

## Setup

- **Atlas tree:** dồn hết **pack size > effectiveness > rarity**. Forest master lấy rare monsters, Swamp master lấy pack size (select cả Forest lẫn Swamp). Ritual node: **Tainted (Traveller's Woe)** cho jackpot belt + **Between Two Worlds** cho wildwood wisp +30% tribute. Content wheel: rogue exiles + summoning circles (spawn trong ritual = mob miễn phí). Vị trí node ba master ở [Atlas passive tree gồm những gì](/guides/0-5-atlas-passive-tree).
- **Tablets** (khoản nặng nhất): **Freedom of Faith** roll increased-tribute-cost thấp nhất (~11%) · **1 Ritual Tablet rare "+3 additional free rolls"** ~20-23 div (đắt nhất nhưng cốt strat) · 2 tablet phụ ~3-4 div mang *reduced tribute for rerolling favours* + *increased chance to have omens*, lý tưởng "3/6 chance một favour không tốn tribute" để buyout omen đắt thụ động. Prefix ưu tiên pack size + increased magic monsters (cho tribute nhiều nhất).
- **Waystone:** exalt lên 6 mod → gỡ 1 item-rarity omen + 1 chaotic effectiveness ép guaranteed pack size; gỡ thêm monster-rarity omen (~2c) → pure pack size, mục tiêu **~48%**.
- **Build floor:** đứng nổi phòng ritual đông (pack size cao + boss nhồi từ Rite + chaos damage chồng); chaos res ~25 chưa cap của build companion là lỗ rõ nhất. Đọc map mod (extra damage, no regen) trước khi mở.

## Profit math

```
net/map = omen_đều + tablet phụ rớt lại − cost/map ; jackpot belt = EV riêng
```

- Nền = omen quay ra mỗi map. Giá poe2scout 2026-06-18: :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Whittling"} ~4.5 div (volume dày) · Omen of Sinistral Annulment/Erasure ~6.3 div/cái · cặp Dextral ~3.7-4.1 div · Omen of Chance ~8.2 div. Trung bình ~1 omen đắt/map, rẻ nhất ~6 div → riêng omen ~3 div/map; + tablet phụ ~1 div/map → **net ~4-5 div/map** sau cost.
- Đừng bỏ omen rẻ 1.5-3c: gom hết, 1 run ra **~278c + 33.5 div** chỉ từ nhóm này (nguồn lời nhì).
- Jackpot belt window Tainted: Mageblood ~611 div · :wiki-link{url="https://www.poe2wiki.net/wiki/Headhunter"} ~275 div — throughput ~45-52 div/h chưa tính EV hai món. Div trượt giá nhanh (0.5 thiếu divine sink) → re-check trước session.

## Gameplay

- Vào map lao thẳng **ritual phòng boss và làm trước** — Rite of the Nameless luôn để 1 ritual trong boss room, mob ritual đầu copy sang mọi ritual sau → làm boss trước = nhồi boss vào tất cả window còn lại, mỗi window +~3k tribute. Rồi mở ritual đông mob nhất, theo đàn locust tím tới các ritual còn lại.
- Chạy Rite: kích Head of the King → chọn **city map** rìa ngoài push vào (dễ kiếm hơn farm 200% deli). Trong map mở ra, chọn map "+20% number of Favours" **đầu tiên** để proliferate toàn chuỗi (buff stack qua từng map). Vài link đầu rush boss nhồi tribute; link sau bỏ qua được (chỉ thêm ~30s).
- Mỗi window: **reroll → defer → reroll → defer**, defer mọi món đắt để khoá tribute thấp, hết tay thì select-all bằng tribute dư.

## Failure Modes

- **Phương sai cộng tablet đắt ăn vốn** — reroll tablet ~20-23 div là khoản chìm lớn; stretch trắng omen đắt vẫn đốt tablet. Vốn mỏng chạy ít slot thay vì full bản đắt.
- **Phòng ritual đông one-shot** — pack size cao + boss nhồi từ Rite + chaos damage chồng = chết bất ngờ dù DPS thừa; chaos res ~25 chưa cap của build companion là lỗ rõ nhất.
- **Không có loot ngoài window** — ~7-8 raw divine trong 3 giờ, gần như không tink; giá trị nằm hết trong window.
- **Area level dưới 79 cắt omen đắt nhất** — omen giá trị nhất cần area 79; map thấp chỉ còn omen rác mức chaos.
- **Kích Head of the King mới xoá chuỗi đang dở** — gom Head dư mà bấm nhầm là bay cả run; reset instance giữa chừng cũng mất tiến độ.

## Changelog

### 2026-06-24
- Initial draft. Cơ chế cross-ref [Ritual guide](/guides/0-5-ritual-rite-of-the-nameless) + [belt-hunting](/farming/0-5-ritual-belt-hunting) (verify poedb + patch 0.5.x). Throughput đo từ run ~20 map/2.8 giờ; giá omen poe2scout 2026-06-18.

## Relationships

- **alternative_to** [Ritual Belt Hunting](/farming/0-5-ritual-belt-hunting) — cùng cơ chế Ritual + Head of the King, khác mục tiêu: belt hunting nghiêng unique về belt qua Spreading Darkness + nền Abyss; strat này dồn pack size cho omen volume, belt chỉ là jackpot.
- **related_guides** [Ritual và Rite of the Nameless](/guides/0-5-ritual-rite-of-the-nameless) — cơ chế đầy đủ: tribute, reroll, defer, Head of the King, Rite chain.
- **related_mechanics** [Atlas passive tree gồm những gì](/guides/0-5-atlas-passive-tree) — vị trí node pack size và ba master (Jado/Hilda/Doryani).
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — league system 0.5 (Ritual rewrite, Masters of the Atlas).
- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — character endgame đủ clear T15-16 và đứng nổi phòng đông quái.
