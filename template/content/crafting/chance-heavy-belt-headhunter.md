---
document_type: mechanic
title: Chance Heavy Belt Săn Headhunter
mechanic_type: Crafting
league: '0.5'
patch: 0.5.1
status: draft
author: nguyenvanduocit
created: '2026-06-09'
updated: '2026-07-03'
tags: [poe2, crafting, orb-of-chance, headhunter, heavy-belt, gambling, economy, currency, chancing, 0-5]
template: templates/mechanic-template.md
---

# Chance Heavy Belt Săn Headhunter

:wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"} POE2 = nhị phân: dùng lên Normal item → **hoặc nâng thẳng Unique, hoặc phá huỷ** (không ra Magic/Rare như POE1). "Săn belt từ normal" = xổ số: spam Orb of Chance lên white :wiki-link{url="https://www.poe2wiki.net/wiki/Heavy_Belt"} nhắm :wiki-link{url="https://www.poe2wiki.net/wiki/Headhunter"} (222 div). Giá HH hiện định trò về ngưỡng hoà vốn → tính break-even trước.

## Cơ chế + pool base

- Không roll rarity ngẫu nhiên. Tooltip: "Unpredictably either upgrades a Normal item to Unique rarity or destroys it." Mỗi lần: ra unique của đúng base đó, hoặc bốc hơi. Xác suất trúng vs phá phụ thuộc unique tier — càng hiếm, cửa trúng càng nhỏ.
- Mỗi unique gắn cứng 1 base. Heavy Belt host 3 unique, 1 con bị loại → pool thực **2 con**:
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Headhunter"} — chance được ("can be chanced"). Jackpot duy nhất.
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Zerphi's_Genesis"} — drop-restricted, KHÔNG chance được, loại khỏi pool.
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Waistgate"} — chance được, rác ~1 ex.
- 1 quả "thành công" (không phá) → HH hoặc Waistgate; HH hiếm hơn nên gần như luôn ra Waistgate. **Điều kiện cứng: belt ilvl ≥ 50** thì HH mới trong pool; ilvl thấp chỉ ra Waistgate (vô hiệu hoá chiến lược âm thầm).

## Break-even (poe2scout, Runes of Aldur, 2026-06-09)

- Orb of Chance (spot, 15,280 listing) — 13.5 ex
- White Heavy Belt ilvl ≥ 50 mua lẻ — ~10 ex; **0 ex nếu tự farm**
- Total/lần: ~23.5 ex (mua base) / ~13.5 ex (tự farm)
- Headhunter = 22,050 ex ≈ 222 div (30 listing) → ngưỡng hoà vốn:
  - Tự farm base: P(HH) > 13.5/22,050 = **1/1,631** mỗi orb
  - Mua base ~10 ex: P(HH) > 23.5/22,050 = **1/938** mỗi orb
- Waistgate (~1 ex) quá nhỏ để dời ngưỡng. GGG không công bố tỉ lệ (poedb: "Modifier weight information cannot be obtained from game files") → suy từ thực nghiệm + thị trường.

## Tỉ lệ thật + biến thiên

- Thực nghiệm league này: 1,230 white Heavy Belt + 1,230 Orb of Chance, tốn **565 div** → **0 Headhunter**, 55 Waistgate (~4.5% orb ra unique rác, ~95% phá belt).
- "1 in 115" sai: nếu 1/115 thì P(0/1,230) ≈ 0.002%. Tỉ lệ thực địa **~1/2,000–1/10,000** (hiếm hơn 0.4 ~1/250, nhóm farm ~40 con/~10,000 belt).
- Thị trường chốt biên trên: nếu lời rõ ở 1/500 → chance hàng loạt → HH tràn chợ → giá sập. HH 222 div + chỉ 30 listing = tỉ lệ ở mức hoà vốn trở xuống, chưa bị arbitrage.
- Biến thiên giết người chơi: kịch bản đẹp nhất (1/1,631), để 63% trúng 1 HH phải đốt 1,631 orb ≈ 222 div (= giá mua thẳng), mà chỉ 63% ăn. Edge kỳ vọng = 0, đuôi xui đốt gấp nhiều lần. "Trúng ở orb thứ 3" = survivorship bias.

## Omen

- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_the_Ancients"} (2.6 ex): đổi quả chance kế tiếp thành unique ngẫu nhiên **cùng item class**, không destroy. Nhưng "same Item Class" = bất kỳ unique belt nào (~20 belt) → cửa trúng đúng HH còn thấp hơn raw chance; ra belt không phải HH/:wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} = coi như phá. Đi Ancients thì dùng belt trắng rẻ nhất, tuyệt đối không Heavy Belt đắt (omen bỏ qua base).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Chance"} (699 ex): chặn destroy đúng 1 quả. 699 ex/lần vô lý với lottery base-free — sinh ra để bảo vệ base craft đắt, không phải spam Heavy Belt trắng.

## Chơi đỡ lỗ

- Edge dương duy nhất = chi phí đầu vào (tỉ lệ là hằng số). **Tự farm white Heavy Belt ilvl ≥ 50** (rớt khắp endgame map area level ≥ 50) → break-even 1/1,631 thay vì 1/938. Mua orb spot 13.5 ex, đừng bulk premium (15,280 listing).
- ✗ Âm thầm đốt currency: chance belt ilvl < 50 (HH = 0%); chance :wiki-link{url="https://www.poe2wiki.net/wiki/Utility_Belt"} mong :wiki-link{url="https://www.poe2wiki.net/wiki/Ingenuity"}/Mageblood (Ingenuity drop-restricted không chance được, còn rớt 15 ex — ngõ cụt); gambler's fallacy (mỗi orb độc lập).

Verdict: **NEUTRAL** — lottery âm-EV được thị trường định về ngưỡng hoà vốn, không phải farm thu nhập ổn. Cần P(HH) > 1/1,631 (tự farm) / 1/938 (mua base); tỉ lệ thật ~1/2,000–1/10,000. Edge dương chỉ khi tự farm base free + mua orb spot; còn lại bán thẳng orb + belt lời hơn. Payout 222 div đổi đời cho char mới, với tiền nhàn rỗi. Open: 0.5 có đẩy HH sang tier "t0"? poeladder vẫn list t1, chưa có t0; cần mẫu ≥ 5,000 belt ilvl 50+ tự farm.

## Version History

### Patch 0.5.0
- Orb of Chance dùng được lên cả Tablet. Tỉ lệ HH hiếm hơn rõ so 0.4 (chance hàng nghìn belt không ra); nghi HH bị đẩy tier hiếm hơn, chưa xác nhận datamine.

### Patch 0.4.0
- Tỉ lệ chance HH ~1/250 (nhóm ~40 con/~10,000 belt) — mốc tham chiếu để thấy 0.5 siết tới mức nào.

## Relationships

- **alternative_to** [Ritual Belt Hunting](/farming/0-5-ritual-belt-hunting) — đường lấy belt khác: chance thẳng base trắng, không qua ritual; toán break-even âm-tới-hoà-vốn.
- **related_guides** [Currency cơ bản: mỗi orb làm gì](/guides/beginner-currency) — ví dụ craft nâng cao Orb of Chance trên specific base.
