---
template: templates/farming-template.md
document_type: farming-strategy
title: Leveling Carry Service
status: draft
created: '2026-06-09'
updated: '2026-07-03'
strategy_tier: B
investment_tier: Low
league: '0.5'
patch: 0.5.1
league_phase: Mid
confidence_level: Medium
---

# Leveling Carry Service

Bán thời gian map nhanh cho buyer: họ vào party, đứng gần soak XP từ kill của mình, trả div theo level. Map chạy như bình thường, phí carry dán thêm lên loot sẵn có → gần như passive income. `Tier B · investment Low · ~60 div/h act rush nhóm 3, ~20 div/h buyer lẻ (2026-06-09, softcore EU/NA)`. Không cần build riêng, chỉ 1 bộ movement speed (act rush) + 1 bộ resist + HP (XP carry) để cho mượn.

Hai mô hình: **act rush** kéo char mới qua campaign Act 1-7 (ra Lv55+, đủ passive point, 100 Spirit, resist từ quest) · **XP carry** kéo level trong map 55 → 90+. Act rush ăn tiền nhất mấy ngày đầu league rồi tụt nhanh khi người ta qua campaign — giữa league cửa đó đang khép. XP carry bền hơn (XP mỗi level khúc 88-90 phình khủng khiếp, buyer kéo dài nhiều tuần). Giai đoạn này ưu tiên XP carry trong map đang farm, không cược act rush.

## Setup

- Giữ nguyên atlas + build đang farm (carry KHÔNG bắt đổi tree).
- Thêm 1 :wiki-link{url="https://www.poe2wiki.net/wiki/Precursor_Tablet"} Elevated `increased Experience gain in Map` + 1 density tablet (:wiki-link{url="https://www.poe2wiki.net/wiki/Breach"} / :wiki-link{url="https://www.poe2wiki.net/wiki/Abyss"} / :wiki-link{url="https://www.poe2wiki.net/wiki/Ritual"}) — nhiều kill hơn = nhiều XP hơn cho buyer.
- Set party **Permanent Allocation** hướng về mình TRƯỚC khi mời (loot vẫn về tay mình).
- Gear cho mượn: movement speed (act rush) + resist + HP (XP carry); nhân lên nếu kéo nhiều buyer.
- **Cơ chế party:** buyer tự đăng nhập char của họ, không ai chơi hộ. Campaign: quest reward (passive point, Spirit, respec, resist) ghi vào char **có mặt trong instance** lúc boss chết — buyer chỉ cần đứng. Map: buyer soak XP từ kill của mình; party member thêm nhân loot mỗi người gần đó lúc quái chết (~gấp đôi currency + ring/amulet, ~28% item thêm/người). XP buyer phạt theo chênh level với quái → buyer 55-80 cần map tier thấp; buyer 85-90 cần tier cao nhưng mong manh hơn (giá nhảy vọt khúc cuối).

## Profit math

Giá chợ **2026-06-09**, softcore EU/NA:
- **Act rush:** full run 40-100 div (2h30-3h); lẻ từng act 9-15 div.
- **XP carry:** ~1 div/level (55-80), 2-3 div (80-85), 5-8 div/level (88-90).
- **Derivation:** 3 buyer act rush cùng run × ~50 div → 150 div/2h30 ≈ **60 div/h** (campaign loot ~0 nên gần thuần phí). Buyer lẻ ~20 div/h. XP carry trong map đang farm: `lãi/h = (loot farm sẵn) + (số buyer × phí/level × level/h) − (tablet exp + tablet density)`; mỗi buyer là div cộng thêm, không đánh đổi loot.
- Kéo nhóm 3-5 ghế cùng lúc = nhân thu nhập (cùng thời gian map, mỗi ghế trả 1 phí); gom buyer cùng khoảng level cho tier khớp.

## Gameplay

- Mời buyer, trade gear phù hợp (movement cho act, resist cho map), dặn đứng gần + không lao lên trước.
- Chạy map như bình thường: mình clear, họ soak. Theo dõi level buyer → chạm target → thu tiền, đòi lại gear, kick.

## Failure Modes

- **Scam hai chiều.** Buyer biến mất không trả, hoặc ôm gear cho mượn. Mới vào không vouch thì buyer không dám giao dịch — chạy vài run "free for vouch" trước.
- **Gear cho mượn là vốn hở.** Kéo nhóm 5 người thì rủi ro nhân lên; không cho mượn nhiều bộ hơn số mình có.
- **Buyer chết mất 10% XP level hiện tại.** Map cao trên level buyer tăng xác suất one-shot; đừng đẩy tier quá cao chỉ để nhanh.
- **Demand co theo league.** Act rush qua đỉnh giữa league; XP carry nhạt dần cuối league — nghề front-loaded, không phải thu nhập vĩnh viễn.
- **Ranh giới tài khoản.** Mô hình party (buyer tự chơi char họ) hợp lệ. Chơi hộ bằng mật khẩu buyer vi phạm điều khoản + ban tài khoản buyer.

## Changelog

### 2026-06-09
- Viết mới giữa league 0.5 (Runes of Aldur). Giá chợ snapshot softcore EU/NA ngày này. Cơ chế party loot, tablet experience và phạt XP theo level đã verify; tốc độ level/h theo tier map cần đo in-client khi chạy ca thật để chốt.

## Relationships

- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — nhân vật map đang chạy, nền của carry service nếu clear đủ nhanh.
- **related_guides** [Leveling Tracker](/leveling) — bám route campaign theo Client.txt, công cụ chị em của bảng party.
- **synergizes_with** [Ritual Belt Hunting](/farming/0-5-ritual-belt-hunting) — farm endgame chạy song song, loot vẫn về mình khi kéo carry trong cùng map.
