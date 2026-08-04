---
template: templates/mechanic-template.md
document_type: mechanic
title: Armour Defensive Scaling
status: draft
author: duocnv
created: '2026-05-25'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.3
tags:
  - poe2
  - armour
  - defense
  - physical-damage-reduction
  - runes-of-aldur
  - buff
---

# Armour Defensive Scaling

:wiki-link{url="https://www.poe2wiki.net/wiki/Armour"} = defence cấp physical damage reduction theo `DR = A / (A + 10 × D_raw)`, cap 90%. Tooltip chỉ hiện armour phẳng; % giảm thực phụ thuộc tỉ lệ armour : hit size. Patch 0.5.0 "Runes of Aldur" nâng floor armour + quét recovery layer :wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} ([Energy Shield Recovery](/guides/energy-shield-recovery)) → armour = điểm đến physical mitigation rõ nhất. Chassis tự nhiên: Warrior/Titan.

## Cơ chế

- `DR(A, D_raw) = A / (A + 10 × D_raw)`; A = armour rating, D_raw = raw physical damage cú hit trước mitigation. Cùng armour → giảm nhiều khi hit nhỏ, ít khi hit lớn → mạnh farm map clear (nhiều hit nhỏ), yếu trước burst boss.
- 0.5 nâng armour item/modifier theo level: **+33% more @lvl65, giảm dần → +15% more @lvl80+** (line 494). Là baseline lift, không phải line "increased Armour" mới — base armour item hiện có tự chỉnh khi login; armour modifier trên item hiện có update giá trị mới bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Divine_Orb"}.

## Math Chain

Total armour = `base × (1 + Σ increased Armour)` (bucket additive) → feed vào DR. Stacker endgame 200,000 armour, +15% @lvl80+ → **230,000** (line 494):

| Hit raw | Pre-0.5 (200k) | Post-0.5 (230k) |
|---|---|---|
| 5,000 | 80.0% DR, ăn 1,000 | 82.1% DR, ăn 893 (−10.5% dmg taken) |
| 15,000 (boss) | 57.1% DR, ăn 6,430 | 60.5% DR, ăn 5,921 (−7.9%) |
| 1,000 | — | 95.8% → cap 90% (small hit gần xoá sạch) |

- Ngưỡng chạm 90% cap: vs hit 5,000 cần A = **450,000**; vs 15,000 cần ~**1,350,000**.
- **Brass Dome** :wiki-link{url="https://www.poe2wiki.net/wiki/Brass_Dome"} giờ 500-600% increased Armour (trước 700-800%, line 459), item hiện có Divine làm tệ đi được. Bucket với base body 1000 + giả định +400% tree/gear: pre `1000×(1+8.0+4.0)=13,000` vs post `1000×(1+6.0+4.0)=11,000` → −15% body contribution ≈ triệt tiêu đúng +15% scaling buff. **Net extreme Brass Dome stacker ≈ wash; net build dùng rare/unique được buff ≈ dương rõ.**

## Key Interactions

- :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion"} buff song song cùng mức (+33% lvl65 → +15% lvl80+, line 495). Deflect formula sửa tuyến tính: `chance to Deflect = 150 × (1 − A/(A + 0.12×D))` (A = accuracy attacker, D = deflection rating defender), cap 95% (line 248-249) → đầu tư cao thưởng nhiều hơn, evasion stacker chạm ~95% deflect khả thi hơn.
  - Armour thắng **consistency** (flat phys mitigation mọi hit); evasion thắng formula sạch + avoidance ceiling nhưng vẫn binary roll.
  - Nguồn Deflection Rating từ Evasion, khu Dexterity: **Wild Cat** 12% Evasion → Deflection Rating; **Staunch Deflection** (0.5.3) +8% Evasion → Deflection Rating. Độc lập deflection-suffix trên gear. Vd 8,000 Evasion lấy cả hai: +960 + 640 = **1,600 Deflection Rating** free từ tree (cộng cùng pool D).
- Unique armour buffed (item hiện có Divine update lên số mới):

| Item (slot) | 0.5 | trước |
|---|---|---|
| :wiki-link{url="https://www.poe2wiki.net/wiki/Keeper_of_the_Arc"} (helmet) | 240-340% AES | 150-250% (line 469) |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Sine_Aequo"} (gloves) | 150-200% AEE | 100-150% (line 478) |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Ab_Aeterno"} (boots) | 200-250% AEE | 100-150% (line 453) |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Acuity"} (gloves) | rework → 150-200% armour + 100-150 max Life + leech | — |

- :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} = backup layer sau armour: kích khi life tụt còn 1, hấp thụ damage thay life, hồi độc lập với life (line 22). Thêm qua :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium_Runeforging"} (unlock Act 1): armour <lvl55 nhận free, ≥lvl55 đánh đổi một phần defence thường (line 21).
- **"Defences" deprecate** (line 245) → viết rõ "Armour, Evasion and Energy Shield". "increased Defences" cũ giờ áp đúng A/E/ES, **KHÔNG** áp Runic Ward / Resistance / Block. Thuần descriptive, không đổi math.

## Optimization

- Body: Brass Dome chỉ khi extreme stacker chấp nhận net wash; còn lại rare body multiple increased-armour roll ăn trọn +15%. Helmet Keeper of the Arc + gloves Sine Aequo đáng Divine update.
- Armour scale tốt nhất vs nhiều hit nhỏ → pair layer chống burst: Runic Ward (Verisium Runeforging từ Act 1) 1-life backup + Block. Verisium Runeforging tier-1 priority: rune Runic Ward vào mọi armour slot <lvl55 (free).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Stone_Rune"} socket armour: +50/75/100 to Stun Threshold (trước +40/60/80, line 518) → armour build str cao + stun threshold scale theo pool → hiếm heavy stun.

## What Doesn't Work

- ✗ Không bao giờ mitigate :wiki-link{url="https://www.poe2wiki.net/wiki/Damage_over_time"} — formula chỉ áp hit; physical DoT (bleed, ground physical) xuyên armour. Cần layer riêng (max life, recovery, hoặc additional physical damage reduction — loại cắt cả DoT).
- ✗ Chỉ áp physical. Elemental/chaos hit xuyên trừ khi convert armour qua :wiki-link{url="https://www.poe2wiki.net/wiki/Blackbraid"} hoặc Refraction support. 300k armour vô dụng trước lightning bolt nếu không conversion.
- ✗ Không cứu hit cực lớn: raw 30,000 trước 230k → `230000/(230000+300000)` = 43.4%, ăn ~17,000.
- ✗ "increased Defences" (giờ AEE) không scale Runic Ward / Resistance / Block — phải dùng Runic Ward Rune riêng từ Remnant.

## Common Mistakes

- ✗ Coi armour như flat % kiểu resistance → overestimate survival trước boss 30-40%, chết lần đầu chạm pinnacle slam. ✓ Đọc DR theo hit size.
- ✗ Chỉ stack armour rồi lao vào boss → slam 15,000 ăn ~6,000 dù 230k armour; không pool/backup = chết. ✓ Pair avoidance (Block/dodge) + pool + Runic Ward.
- ✗ Port Brass Dome 0.4 (700-800%) sang 0.5 expect giữ nguyên +15% → giờ 500-600%, extreme stacker net wash; mất ~15% body contribution nếu vẫn chạy Brass Dome mà nghĩ được +15%.
- ✗ Bỏ elemental mitigation vì "đã có armour" → armour chỉ physical; vẫn cần res cap + layer elemental.

## Cost & Restrictions

- **Strength + base req** — base armour cao (str-based gear) + nhiều nguồn increased Armour; class không str/armour notable phải đầu tư nặng. Chassis: Warrior/Titan.
- **Brass Dome nerf** — 500-600% (từ 700-800, line 459), Divine làm tệ đi được.
- **Elemental gap** — không áp elemental/chaos trừ conversion (Blackbraid/Refraction) → dump currency riêng vào res cap + layer elemental.
- **Hit-size dependency** — 90% DR: hit 5,000 cần ~450,000 armour; hit 15,000 cần ~1,350,000 → buộc pair layer khác.
- **Verisium Runeforging** — armour ≥lvl55 rune Runic Ward đánh đổi base defence thường (line 21), không free.

## Verdict & Open Questions

- **Verdict — BUFF.** 0.5.0: armour +33% lvl65 → +15% lvl80+ (line 494); Evasion song song + deflect tuyến tính cap 95% (line 248-249, 495); ES recovery quét 50-70%. Tương quan defence nghiêng armour/evasion cho physical-heavy.
- **Nuance net không đồng đều** — rare/unique được buff (Keeper of the Arc, Sine Aequo, Ab Aeterno) ăn trọn; extreme Brass Dome stacker (700-800→500-600%) ≈ wash.
- **Không all-rounder** — chỉ physical, kém trước burst, không chạm DoT.
- **Open — 90% cap còn nguyên 0.5?** formula + cap lấy từ wiki mirror; patch note 0.5.0 không nhắc đổi cap; wiki có thể lag.
- **Open — actual endgame survival lift.** compound ~2-3.4 điểm DR; cần PoB2 0.5 + char test T15+. Window verify: 2026-06-01 → 2026-06-08.
- **Open — Runic Ward + armour stacker live behavior** chưa test in-game; log uptime + pop behavior trước boss burst.

## Version History

### Patch 0.5.3 (2026-06-19)
- Staunch Deflection thêm "Gain Deflection Rating equal to 8% of Evasion Rating", join họ deflection-from-evasion bên cạnh Wild Cat (12%). Retroactive mọi Evasion stacker path qua Dexterity — không cần re-spec.

### Patch 0.5.0 — Runes of Aldur (21/05/2026 patch note, 29/05/2026 launch)
- Armour item/modifier +33% @lvl65 → 15% @lvl80+; base auto-adjust login, modifier Divine-updatable. Evasion song song + Deflect tuyến tính `150×(1−A/(A+0.12×D))` cap 95%.
- Unique buffed: Keeper of the Arc 150-250→240-340% AES, Sine Aequo 100-150→150-200% AEE, Ab Aeterno 100-150→200-250% AEE, Atziri's Acuity rework → 150-200% armour + life + leech. Brass Dome 700-800→500-600%.
- Runic Ward ra mắt (1-life backup qua Verisium Runeforging) + 15+ Runic Ward Rune craft từ Remnant. "Defences" deprecate → "Armour, Evasion and Energy Shield". Stone Rune stun threshold +40/60/80 → +50/75/100. Fix mô tả Heavy Armour notable.

### Patch 0.4.0 — Previous baseline
- Armour high-level thấp hơn baseline 0.5. Brass Dome 700-800%. Deflect chưa tuyến tính. ES recovery còn nguyên sức (compound recharge ~3.3x base, tank-by-recharge viable). Chưa có Runic Ward.

## Relationships

- **related_mechanics** [Energy Shield Recovery](/guides/energy-shield-recovery) — nửa còn lại của rebalance defence 0.5; ES recovery nerf trong khi armour nâng floor.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — armour scaling buff, Runic Ward, Verisium Runeforging đều thuộc patch 0.5.0.
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — resistance phòng nguyên tố, armour phòng physical — bổ sung nhau
- **related_guides** [Ailment và status effect trong POE2](/guides/beginner-ailments) — ailment threshold song song armour/evasion/ES.
- **related_guides** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — công thức armour, Runic Ward, cách 0.5 buff armour/evasion.
- **related_guides** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — layer phòng thủ vật lý bổ sung bên cạnh Life và ES
