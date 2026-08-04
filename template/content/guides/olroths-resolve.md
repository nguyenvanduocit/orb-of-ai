---
template: templates/mechanic-template.md
document_type: mechanic
title: Olroth's Resolve
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
sub_class: items
tags:
  - item
  - unique
  - life-flask
  - guard
  - recovery
  - poe2
  - mechanic
---

# Olroth's Resolve

Unique Ultimate Life Flask (:wiki-link{url="https://www.poe2wiki.net/wiki/Olroth%27s_Resolve"}), Req Level 60, drop từ :wiki-link{url="https://www.poe2wiki.net/wiki/Olroth%2C_Origin_of_the_Fall"} — pinnacle boss Expedition. 0.5 redesign hoàn toàn: bỏ Instant Recovery + "Excess Life Recovery as Guard", thay bằng hai mod tương tác :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} — regen Ward suốt Effect rồi cấp :wiki-link{url="https://www.poe2wiki.net/wiki/Guard"} = Ward hiện tại khi Effect kết thúc.

## Chỉ số

```
Olroth's Resolve
Ultimate Life Flask
Recovers 920 Life over 3.00 Seconds
Consumes (20–25) of 75 Charges on use
Requires Level 60
────────────────────────────────────────────
(100–150)% increased Charges per use
Regenerate (2.5–5)% of maximum Runic Ward per second during Effect
Gain Guard equal to Current Runic Ward for 10 seconds when Effect ends
────────────────────────────────────────────
"Olroth the Gallant,
tireless and true,
he fights for me,
he fights for you!"
```

- (100–150)% increased Charges per use × base 10 charges (Ultimate Life Flask) → 20–25 charges/use; 75 total → 3–3.75 lần dùng per full flask.

## Cơ chế hai tầng

- Nhấn flask → 3s Effect: +920 life trả đều; đồng thời Ward regen +2.5–5%/s (flask) + base 5%/s Ward = **7.5–10%/s** trong 3s. Ward trống lúc nhấn → regen tối đa 22.5–30% max Ward trước khi hết.
- Effect kết thúc → đọc **Runic Ward hiện tại** → grant Guard = đúng số đó, 10s. Ward KHÔNG bị tiêu/convert; Guard là lớp absorb riêng đứng trước life+ES, Ward vẫn tồn tại → 10s có đồng thời Guard + Ward chồng lớp.
- Guard = Ward **hiện tại** lúc kết thúc, KHÔNG phải max Ward. max Ward 500 nhưng Ward còn 80 → 80 Guard.
- Best case (nhấn khi Ward full, max 500): bonus regen giữ Ward ổn định 3s → **500 Guard/10s**.
- Emergency press (Ward depleted về 0, max 500): flask regen lại 22.5–30% × 500 = 112–150 Ward → Guard chỉ 112–150.
- Tối ưu: nhấn TRƯỚC pha nguy hiểm, không phải sau khi bị hit. Ward ceiling cao hơn (:wiki-link{url="https://www.poe2wiki.net/wiki/Ward_Rune"} Ward Rune, :wiki-link{url="https://www.poe2wiki.net/wiki/Charging_Rune"} Charging Rune, passive Ward node) → Guard ceiling cao hơn.
- "% increased Life Recovery from Flasks" + flask effect modifier tăng 920 life nhưng KHÔNG chạm Guard (Guard từ Ward, không từ life recovery).

## Anti-patterns

- ✗ Không nguồn Runic Ward → Guard = 0 → chỉ là life recovery thường không Instant Recovery, kém plain Ultimate Life Flask (charge efficiency tốt hơn).
- ✗ Map mod "No Regeneration" block Ward regen tự nhiên, có thể block cả bonus regen flask → Guard về 0 (chưa verify in-client: log Ward trước/sau flask dưới no-regen).
- ✗ Mất cả life + Ward trong T17/Pinnacle slam → Guard 112–150 (max 500 depleted) không đủ absorb hit lớn kế.
- Verdict **EXPLOITABLE** cho build đầu tư Runic Ward trung bình–cao: Expedition-heavy Runeforged gear, 6 slot Perfect Ward Rune (+30/slot) = 180 Ward từ rune + passive node + item. Chọn vì Guard payoff khi Ward đã stack, không vì life recovery. Chưa invest Ward / không Runeforged → không khác flask thường.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Redesign hoàn toàn. Bỏ Instant Recovery + "Excess Life Recovery added as Guard for 20 seconds". Thêm "Regenerate (2.5–5)% of maximum Runic Ward per second during Effect" + "Gain Guard equal to Current Runic Ward for 10 seconds when Effect ends".
- Guard duration 20s → 10s; Guard value giờ dựa Runic Ward pool thật thay vì excess life recovery. Silent rework, không nhắc trong patch note 0.5.0 chính thức; confirmed từ poedb.

### Patch 0.4.0
- Guard duration 10s → 20s trên cơ chế cũ (Excess Life Recovery as Guard).

### Patch 0.1.0
- Ra mắt với Instant Recovery, (100–150)% increased Charges per use, Excess Life Recovery added as Guard for 10 seconds.

## Relationships

- **related_mechanics** [Runic Ward Onslaught Loop cho Minion](/guides/0-5-runic-ward-onslaught-loop) — cơ chế + cách stack Runic Ward; Ward ceiling quyết định Guard value.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — 0.5 giới thiệu Runeforging + Runic Ward, tiền đề redesign flask.
- **related** [0.5 New Unique Items Overview](/guides/0-5-new-unique-items) — tổng quan unique mới cùng patch.
- **synergizes_with** [Refutation](/guides/refutation) — flask nạp Ward (~10%/s) + Guard layer cho ward-stacker chạy Refutation.
- **related** [Ocean Exploring Grand Expedition Farm](/guides/0-5-ocean-exploring) — unique đáng giá trong pool drop nhánh boss Olroth.
