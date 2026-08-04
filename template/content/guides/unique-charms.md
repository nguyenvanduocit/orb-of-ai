---
template: templates/mechanic-template.md
document_type: mechanic
title: Unique charms
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
  - charm
  - ailment-immunity
  - freeze
  - ignite
  - poison
  - slow
  - rarity
  - poe2
  - mechanic
---

# Unique charms

:wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} = trinket trong charm slot trên belt, giữ thanh charge, tự kích theo điều kiện "Used when you become X" (không bấm tay như flask). Năm unique charm phủ gần hết charm slot meta 0.5.1 — bốn charm chặn ailment lethal (:wiki-link{url="https://www.poe2wiki.net/wiki/Freeze"} Freeze / :wiki-link{url="https://www.poe2wiki.net/wiki/Ignite"} Ignite / :wiki-link{url="https://www.poe2wiki.net/wiki/Poison"} Poison / :wiki-link{url="https://www.poe2wiki.net/wiki/Slow"} Slow) + Rite of Passage magic-find.

poe.ninja unique-charm (mains top-XP): Nascent Hope **41,4%** · The Fall of the Axe **24,0%** · Beira's Anguish **19,3%** · Rite of Passage **11,2%** · Arakaali's Gift **10,5%**.

| Charm | Base | Chặn | Consumes | Payload phụ |
|---|---|---|---|---|
| Nascent Hope | Thawing | Freeze | 40/40 | (20–25)% Charge on-kill · ES Recharge starts on use |
| Beira's Anguish | Dousing | Ignite | 30/40 | (20–25)% Charge on-kill · Ignited Ground (500% max Life) |
| Arakaali's Gift | Antidote | Poison | 20/40 | cross-recovery Life↔Mana (15–20)% flask amount |
| The Fall of the Axe | Silver | Slow | 20/40 | Grants Onslaught during effect |
| Rite of Passage | Golden | — (MF) | 80/80 | Possessed by random Azmeri Spirit (10–20)s |

## Cơ chế belt + trigger

- Chỉ giữ charge khi ở charm slot trên belt (belt Vengeance Harness mở 2 charm slot). Max charge 40 (bốn charm immunity), 80 (Golden Charm); refill bằng giết quái hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Wells"} Wells.
- Tự dùng khi điều kiện trigger thỏa; mỗi proc tiêu "Consumes X of Y Charges" rồi cấp effect trong duration (3s bốn immunity, 1s Golden Charm).
- Charge/proc quyết nhịp sẵn sàng: 40/40 hoặc 80/80 = cạn sạch một proc (phải refill đầy); 20/40 = đỡ hai proc.
- Immunity + trigger là property của **base charm**, không phải unique — rare :wiki-link{url="https://www.poe2wiki.net/wiki/Thawing_Charm"} Thawing Charm cũng cho Immune to Freeze + "Used when you become Frozen" y Nascent Hope. Giá trị unique nằm ở **payload phụ**.

### Nascent Hope

```
Nascent Hope
Thawing Charm
Lasts 3.00 Seconds
Consumes 40 of 40 Charges on use
Immune to Freeze
Requires Level 12
Used when you become Frozen
──────────────────────────────
(20–25)% Chance to gain a Charge when you kill an enemy
Energy Shield Recharge starts on use
```

- Chặn Freeze (khoá toàn bộ hành động → nguy hiểm nhất, dẫn đầu 41,4%). On-kill sustain giữ thanh 40/40 đầy lại khi mapping (khỏi ghé Wells). "ES Recharge starts on use" reset delay :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} ngay lúc proc — với build ES, freeze thường đi kèm hit lớn → lớp hồi thêm.

### Beira's Anguish

```
Beira's Anguish
Dousing Charm
Lasts 3.00 Seconds
Consumes 30 of 40 Charges on use
Immune to Ignite
Requires Level 32
Used when you become Ignited
──────────────────────────────
(20–25)% Chance to gain a Charge when you kill an enemy
Creates Ignited Ground for 4 seconds when used, Igniting enemies as though dealing Fire damage equal to 500% of your maximum Life
```

- Chặn Ignite (fire DoT), on-kill sustain, 30/40. Rider tấn công: proc tạo :wiki-link{url="https://www.poe2wiki.net/wiki/Ignited_Ground"} Ignited Ground 4s, ignite như deal fire = 500% max Life (pool 2.000 → ~10.000 fire damage). Rider scale max Life → gần chết trên CI (1 life)/low-life ES thấp → build đó chỉ dùng phần immunity.

### Arakaali's Gift

```
Arakaali's Gift
Antidote Charm
Lasts 3.00 Seconds
Consumes 20 of 40 Charges on use
Immune to Poison
Requires Level 24
Used when you become Poisoned
──────────────────────────────
Recover Life equal to (15–20)% of Mana Flask's Recovery Amount when used
Recover Mana equal to (15–20)% of Life Flask's Recovery Amount when used
```

- Chặn Poison (chaos DoT stacking), 20/40 (đỡ hai proc). Cross-recovery tính theo **Flask's Recovery Amount** → cục hồi = 0 nếu không slot mana/life flask tương ứng. Xếp cuối 10,5% vì Poison ít gặp hơn freeze/ignite/slow ở endgame 0.5.

### The Fall of the Axe

```
The Fall of the Axe
Silver Charm
Lasts 3.00 Seconds
Consumes 20 of 40 Charges on use
Your speed is unaffected by Slows
Requires Level 10
Used when you are affected by a Slow
──────────────────────────────
Grants Onslaught during effect
```

- Không "Immune to ailment" mà "Your speed is unaffected by Slows" (chill/temporal chains/chilled ground không cắt tốc độ khi active). Rider "Grants Onslaught" đẩy lên hạng 2 (24,0%): :wiki-link{url="https://www.poe2wiki.net/wiki/Onslaught"} Onslaught = 20% increased Skill Speed + 10% increased Movement Speed. Bị slow xảy ra liên tục → charm gần như luôn active, Onslaught uptime cao → vừa thủ vừa công một slot.

### Rite of Passage

```
Rite of Passage
Golden Charm
Lasts 1.00 Second
Consumes 80 of 80 Charges on use
15% increased Rarity of Items found
Requires Level 50
Used when you kill a Rare or Unique enemy
──────────────────────────────
Possessed by Spirit Of The <random Azmeri Spirit> for (10–20) seconds on use
```

- Charm thuần kinh tế. Base :wiki-link{url="https://www.poe2wiki.net/wiki/Golden_Charm"} Golden Charm: 15% increased :wiki-link{url="https://www.poe2wiki.net/wiki/Rarity"} Rarity + trigger khi giết Rare/Unique. Rider "Possessed by Spirit Of The <random Azmeri Spirit>" (10–20)s: random một :wiki-link{url="https://www.poe2wiki.net/wiki/Azmeri_Spirit"} non-Sacred lúc drop rồi khoá variant (không reroll). VD Spirit of the Bear: 20% increased max Life, 100% increased Stun Threshold, 60% increased Stun Buildup, 20% reduced Damage taken + định kỳ triệu Bear slam.
- Nhiều bản Rite dùng đồng thời nếu khác Spirit effect → gom nhiều possession buff. 3 bản reforge ở :wiki-link{url="https://www.poe2wiki.net/wiki/Reforging_Bench"} Reforging Bench luôn ra Owl variant. Drop-restricted: chỉ rơi từ quái bị Azmeri spirit possess, không chance được bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"} Orb of Chance.

## Chọn charm

- Belt thường 2 charm slot → ưu tiên hai ailment đáng sợ nhất: Nascent Hope (freeze khoá hành động) + The Fall of the Axe (cộng Onslaught).
- Charge economy: Nascent Hope + Rite of Passage cạn full bar/proc (40/40, 80/80) — Nascent's on-kill bù khi mapping. The Fall of the Axe + Arakaali's Gift tiêu nửa bar (20/40, đỡ hai proc), không sustain bonus nhưng vẫn nạp on-kill.

## Anti-patterns

- Charm bật **sau** khi dính ailment, không chặn cú hit gây ailment. Immunity cleanse ngay + chặn re-apply 3s, nhưng đòn tạo freeze vẫn trúng trước — cứu lockout, không cứu hit mở màn.
- Charge cạn giữa chuỗi nguy hiểm: freeze liên tiếp nhanh hơn refill (đặc biệt boss fight không add để nạp on-kill) → lần freeze kế không còn charm đỡ. Nascent Hope rủi ro cao nhất (40/40 mỗi proc — log xem có kịp refill 40 charge giữa hai lần freeze không).
- Mỗi charm phủ một ailment, belt 2 slot chỉ hai loại; chọn Freeze + Slow thì Poison/Ignite bỏ ngỏ. Rider có điều kiện chết: Beira's "500% max Life" vô dụng trên CI/low-life; Arakaali's cross-recovery = 0 nếu không slot mana/life flask.

## Version History

### Patch 0.3.0
- Beira's Anguish đổi sang "Creates Ignited Ground for 4 seconds when used, Igniting enemies as though dealing Fire damage equal to 500% of your maximum Life" (trước: ignite enemies in Presence on use). Dòng hiện tại = bản 0.3.0.

### Patch 0.2.0f
- Mọi charm trừ Golden Charm halve maximum Charges + halve Charges per Use → refill nhanh hơn. Đây là lý do charm immunity trên thang 40, Golden Charm vẫn 80.

## Relationships

- **related** [Unique Items Mới](/guides/0-5-new-unique-items) — danh mục unique nổi bật 0.5; charm bổ sung lớp trinket.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5 + meta trang bị.
- **used_by** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — belt 3 charm slot + slot thứ tư từ quest reward, đúng loại slot các charm nhắm tới.
