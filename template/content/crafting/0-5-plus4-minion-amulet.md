---
template: templates/mechanic-template.md
document_type: mechanic
title: Craft amulet top-tier cho companion build
status: published
author: duocnv
created: '2026-06-12'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.3
sub_class: crafting
tags:
  - crafting
  - amulet
  - minion
  - companion
  - spirit
  - catalyst
  - fracture
  - desecration
  - omen
  - endgame
  - poe2
  - mechanic
---

# Craft amulet top-tier cho companion build

Amulet đỉnh companion gánh 5 thứ: **+4 Level of all Minion Skills**, **Spirit cao** (T1 ~50), lớp thủ (**Life/ES**), **resistances** (đặc biệt chaos), 1 dòng utility (ES-from-body / all-attr / dual-res). Thứ tự bước quyết định thành hay brick.

Trần: **+4 chắc ăn** (lặp được) · **+5 gamble một-phát** (sanctify) · **+6 bất khả** (số học đóng cửa). Hai nhánh loại trừ:
- **+4 guaranteed** — fracture mod minion để khoá → chaos-spam an toàn. Trần +4.
- **+5 gamble** — KHÔNG fracture minion (Divine không randomise mod fractured → sanctify vô hiệu với nó). Giữ minion tự do để sanctify gamble, mất lưới an toàn.

## Cơ chế quality truncate

- Necrotic Catalyst đẩy +3→+4 bằng quality. Quality = multiplier riêng, áp **sau mọi modifier** (kể cả Sanctification) rồi **truncate** (cắt thập phân, không làm tròn).
- +3 base: 20% qual → 3×1.20=3.6 → **+3** (phí) · 40% → 4.2 → **+4** · 50% (Vaal infuser) → 4.5 → **+4**.
- Phải vượt **40% quality** mới chạm +4; trần mặc định 20% → cần Essence of the Breach nâng lên 40% (bắt buộc).
- Công thức: `truncate(base × hệ_số_sanctify × (1 + quality))`.

## Base + ilvl

- `+# to Level of all Minion Skills` chỉ roll trên **amulet** (ring không có). Suffix, 3 tier: +1 (ilvl 5), +2 (ilvl 41), **+3 (ilvl 75)** — không có tier +4 gốc → +4 chỉ từ quality.
- Minion +3 mở **ilvl 75**. T1 res gate ilvl 82 (chaos 81) ép base lên 82: all-T1 = mua **ilvl 82**; chỉ minion + Spirit (54) + ES (80) + res tier dưới = **ilvl 80**. Đừng mua dưới 80.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Solar_Amulet"} implicit +(10-15) Spirit → base mặc định companion. Grant-skill amulet (Raging Spirits, Cast on Minion Death) có polarity affix "−1 suffix" chặn aug/annul route → ép chaos-spam. Check −prefix/−suffix trước khi mua.

## Lấy +3 minion

- `+3 to Level of all Minion Skills` weight **100** = dòng hiếm thật (cổ chai của cả cây). So sánh: T1 Spirit (+47-50) weight 400, ilvl 54 (dễ hơn nhiều).
- 3 đường theo chi phí:
  1. **Mua base +3 chưa fracture** — rẻ nhất nếu vốn vừa. Lọc +3, chưa corrupt/fracture, magic ít mod.
  2. **Perfect Aug + Annul trên base −prefix** — rẻ hơn chaos-spam. :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Transmutation"} (perfect) → loop annul → perfect aug ép roll vào slot suffix (pool nhỏ).
  3. **Chaos-spam** — đường cuối (−suffix base). Weight 100 ngốn >1000 :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Orb"} cho 1 cú +3, đắt nhất.

## Khoá +3 bằng fracture

- :wiki-link{url="https://www.poe2wiki.net/wiki/Fracturing_Orb"} fracture 1 mod ngẫu nhiên trên rare có ≥4 modifier; mod fractured không gỡ/sửa được.
- Lái xác suất: gắn desecrated modifier **chưa reveal** làm mod thứ 4 bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Gnawed_Collarbone"}. Desecrated mod không thể bị fracture nhưng đếm vào 4 mod tối thiểu → xác suất trúng +3 từ 1/4 lên **1/3**.
- (Nhánh +5: bỏ bước này với minion; fracture **Spirit** thay thế.)

## Roll Spirit + mod còn lại (erasure omen)

Không chaos-spam mù (churn cả cây). Cô lập slot rồi reroll:
1. **Annul sạch về mod fractured**: :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Annulment"} (fractured miễn nhiễm).
2. **Add mod vào slot type muốn** bằng Exaltation side-omen: Spirit prefix → Omen of Sinistral Exaltation; minion suffix → Omen of Dextral Exaltation.
3. **Reroll slot bằng Erasure omen + Chaos**: Sinistral Erasure = "next Chaos removes only prefix"; Dextral Erasure = "next Chaos removes only suffix". Loop tới target; fractured không bị đụng.
- Điểm dừng: T1 Spirit (~+50) hoặc +3 minion. Spirit + implicit Solar (+10-15) = ~60-65 tổng.

## Finish res/defense trước quality

- Ràng buộc cứng: 1 item = 1 quality type ("Replaces other quality types"). Catalyst res đập vào item có minion-quality → **minion-quality bay, +4→+3**. Necrotic là bước tuyệt đối cuối.
- **Đường không đụng quality (an toàn +4)**: chaos res từ desecration dual-res suffix; flat Life/ES từ **Greater Exalted Orb** (Min Mod Level 35) / **Perfect Exalted Orb** (Min Mod Level 50). Verify tier ở ngưỡng (flat Life ilvl 60, flat ES ilvl 80).
- **Đường Catalysing Exaltation (mạnh hơn, tiêu quality)**: Omen of Catalysing Exaltation = "next Exalted Orb consume all Catalyst Quality to increase chance of corresponding Modifier". Vòng: catalyst đúng type → Catalysing Exalt → mod ra → quality về 0. Làm từng res trước Necrotic.
- Catalyst → mod type (jewellery, drop Breach): **Chayula's** → Chaos → chaos res · **Xoph's/Tul's/Esh's** → Fire/Cold/Lightning res · **Flesh** → Life · **Carapace** → Armour/Evasion/ES · **Adaptive** → Attributes.
- Side-omen ép slot: Sinistral Exaltation (prefix) cho ES/Life; Dextral Exaltation (suffix) cho res. Greater/Perfect Exalt để cắt tier rác.

## Desecrate: ES-from-body / chaos res / +1 all skills

- Lái bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Ancient_Collarbone"} (hoặc Preserved — tier ≥65 ilvl, Min Mod Level 40; Gnawed không đủ) + omen faction + Omen of Abyssal Echoes (reroll option 1 lần). Dọn slot trống trước.
- **Kurgal's prefix** (Omen of the Blackblooded): (35-50)% increased ES from Equipped Body Armour.
- **of Amanamu/Kurgal/Ulaman suffix** (Liege/Blackblooded/Sovereign): +(13-17)% Fire+Chaos / Cold+Chaos / Lightning+Chaos Res — chaos dual-res một dòng.
- **of Ulaman suffix +1 to Level of all Skills** (Omen of the Sovereign): +1 all skills cộng thẳng +1 cho minion skill → cây +4 minion + dòng này = minion gem ăn +5 level, không cần sanctify. Chiếm slot suffix tranh với res.
- Bẫy: desecrated `+(1-2) Level of all Minion Skills` (của Amanamu) là **focus-only, KHÔNG lên amulet**. +minion minion-specific trên amulet phải từ fractured/rolled; desecration chỉ cấp dòng "all skills" của Ulaman.

## Necrotic Catalyst đẩy +3→+4

- Bước **tuyệt đối cuối**. Patch 0.5.2 thêm Necrotic Catalyst (qua Genesis Tree) — quality enhance riêng Minion Modifiers trên ring/amulet. Đường +4 duy nhất cho minion (catalyst caster/attack khác tag).
- Trần mặc định 20% → 3.6 → +3; phải 40% → 4.2 → +4. Nâng bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Essence_of_the_Breach"} — trên jewellery cấp **+20% to Maximum Quality** (20%+20%=40%).
  - Essence gỡ mod ngẫu nhiên, fractured miễn nhiễm → +3 fractured an toàn; để sẵn **mod junk làm mồi**.
  - Omen Dextral/Sinistral Crystallisation ("next Perfect or Corrupted Essence" gỡ chỉ 1 chiều) — chưa rõ Essence of the Breach có tính là "Perfect or Corrupted Essence"; verify in-client; không cần thì dùng mồi-junk + lưới fractured.
- Trình tự đóng: Essence of the Breach +20% max quality → Necrotic tới 40% minion quality → +3 thành **+4** → Omen of Whittling + Chaos dọn junk (quality giữ, +4 giữ).
- **Refined Necrotic Catalyst** (cũng Genesis Tree) = bản cho **jewel**, vô dụng cho amulet, nhưng buff 7 viên jewel magic minion-crit của [The Adorned](/builds/huntress/0-5-spirit-walker-companion-pack) — đừng nhầm.

## +5 sanctify + vì sao +6 bất khả

- +5 = trần tuyệt đối, qua **sanctify**. Sanctified (:wiki-link{url="https://www.poe2wiki.net/wiki/Divine_Orb"} + Omen of Sanctification) "randomise giá trị mỗi mod rồi nhân hệ số 0.8-1.2x", khoá mọi craft về sau.
- `truncate(3 × hệ_số × 1.40)` ≥ 5 cần hệ số ≥ **1.19x** → 3×1.19×1.4=4.998; max 1.2x → 5.04 → +5. 50% quality: truncate(3×1.2×1.5)=truncate(5.4)=+5. +6 cần ~67% quality (vượt trần) → **ceiling amulet = +5**.
- Giá phải trả: sanctify randomise lại **toàn bộ mod** (Spirit, res, life/ES) rồi nhân 0.8-1.2x → cây T1 sạch có thể tụt. Mod minion: ~**2-3%** chạm ≥1.19x → +5, ~60% giữ +4, ~**38%** rớt <0.95x → **+3** (item đã khoá). Đừng fracture minion nếu đi +5 (fracture Spirit thay); sanctify là bước cuối, sau Necrotic 40%.
- Vaal Catalysing Infuser ("exceeding maximum quality by up to 10% với chance corrupt") chỉ đẩy 40%→~50% + rủi ro corrupt; không tự ra +5 (vẫn truncate +4 nếu không sanctify).

## Thứ tự tổng (+4 guaranteed) + chi phí

1. Base Solar Amulet ilvl 82, lấy +3 minion (mua sẵn rẻ nhất).
2. Gnawed Collarbone desecrate mod thứ 4 → Fracturing Orb khoá +3 (1/3).
3. Roll Spirit prefix: Sinistral Erasure + Chaos → T1 ~+50.
4. Finish từng res/defense: catalyst đúng type (Chayula's chaos, Xoph's/Tul's/Esh's ele, Carapace ES, Flesh life) + Omen of Catalysing Exaltation + Sinistral/Dextral Exaltation + Greater/Perfect Exalt.
5. Desecrate Kurgal ES-from-body / dual-res / Ulaman +1 all-skills (Ancient Collarbone + faction omen + Abyssal Echoes).
6. Dọn junk (Whittling, Dextral Annul dưới lưới fractured, Dextral Erasure), chừa 1 mod mồi.
7. **Cuối**: Essence of the Breach +20% max quality → Necrotic Catalyst 40% minion quality → +3 thành +4 → Whittle off mồi.

Chi phí (poe2scout 2026-06-12, exalted): Fracturing Orb 122 · Necrotic Catalyst 44 (item mới 0.5.2, biến động mạnh) · Essence of the Breach 13 · Omen of Whittling 487 · Divine Orb 127. Catalyst res + chaos-spam Spirit = hai hố lớn nhất. Mua base +3 sẵn: 10-30 div; tự roll +3 + chase T1 Spirit: 50-200 div. Cây hoàn chỉnh: 100-300 div ([farming Genesis Tree](/guides/0-5-breach-genesis-tree)).

## Failure Modes

- **Fracture trúng nhầm mod** → khoá nhầm Spirit thay +3, base hỏng. Ráp đúng 3-mod-thật + 1-desecrated trước fracture (giữ 1/3).
- **Necrotic quality bị ghi đè** → đập catalyst res SAU Necrotic 40% đổi quality type, +4→+3. Necrotic luôn cuối.
- **Essence of the Breach ăn nhầm mod quý** → gỡ random (fractured miễn nhiễm); để mồi junk trước.
- **Sanctify cây +4 hoàn chỉnh** → ~38% kéo minion về +3 + khoá vĩnh viễn + randomise mọi mod. Chỉ sanctify khi chấp nhận đổi cả cây lấy 2-3% +5.
- **Fracture minion rồi định đi +5** → sanctify vô hiệu, +5 bất khả. Nhánh +5 để minion tự do, fracture Spirit.
- **Base ilvl thấp** → dưới 80 chặn T1 res (81-82) + flat ES (80).

## Version History

- **0.5.3:** ba mod Abyss mới đều trên **staff** (of Amanamu block 12-16%→20-25%, of Kurgal Puppetmaster stacks, Amanamu's prefix 40-50% extra chaos). Pool suffix amulet Amanamu/Kurgal/Ulaman không đổi; guide giữ nguyên.
- **0.5.2:** thêm Necrotic + Refined Necrotic Catalyst (minion quality ring/amulet và jewel) qua Genesis Tree, mở +4 minion trên amulet (trước chỉ caster/attack). Trước 0.5.2 +4 minion phải qua sanctify.
- **0.5.0:** desecration (Collarbone + faction omen Liege/Sovereign/Blackblooded), Catalysing Exaltation, Greater/Perfect Exalted Orb = bộ finish chuẩn.
- **0.3.0:** Sanctified (Omen of Sanctification + Divine Orb) introduced; nền đường +5.

## Relationships

- **requires** [Breach và Genesis Tree](/guides/0-5-breach-genesis-tree) — Necrotic Catalyst + bộ catalyst res chỉ ra từ Genesis Tree.
- **related_builds** [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack) — amulet này là slot amulet của build; Refined Necrotic buff jewel minion-crit.
- **related_guides** [Spirit và Spirit Reservation](/guides/spirit-and-spirit-reservation) — Spirit trên amulet là nguồn spirit chính cho roster.
