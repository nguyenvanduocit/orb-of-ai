---
template: templates/mechanic-template.md
document_type: mechanic
title: Blood Mage Sanguine Tides Flask Sustain
status: published
author: duocnv
created: '2026-05-27'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: skills
tags:
  - blood-mage
  - sanguine-tides
  - life-flask
  - sustain
  - coc-comet
  - poe2
  - mechanic
---

# Blood Mage Sanguine Tides Flask Sustain

:wiki-link{url="https://www.poe2wiki.net/wiki/Sanguine_Tides"} = notable ascendancy Blood Mage: life spent → flask charge; flask đầy → auto-consume charge grant physical damage buff. KHÔNG phải healing — 0.5.0 flask recover 0 life với node này. Loop = charge gen → auto-consume → damage buff. Life recovery đến từ leech qua :wiki-link{url="https://www.poe2wiki.net/wiki/Vitality_Siphon"}.

## Node text (0.5.0) — 4 dòng

- Gain 1 Life Flask Charge per **2% Life spent** (trước 4% → nhân đôi rate).
- On Hitting an Enemy while a Life Flask is at full Charges, **40% of its Charges are consumed** (passive trigger, không press flask).
- Gain **1% of damage as Physical damage for 5 seconds** per Charge consumed this way (trước 3s).
- **Flasks do not recover Life** (trước 0.5.0 = 50% less recovery; giờ zero).
- Prerequisite: :wiki-link{url="https://www.poe2wiki.net/wiki/Sanguimancy"} (free node đầu: Skills gain a Base Life Cost equal to Base Mana Cost) + 1 minor Crit Chance node. Không Sanguimancy → spell không tốn life → không có gì convert.

## Charge gen theo life spent

- Sanguimancy active → mỗi spell tốn mana đồng thời tốn life = base mana cost. Sanguine Tides đếm đơn vị 2% max life = 1 charge.
- Vd 4.000 max life → 2% = 80 life. :wiki-link{url="https://www.poe2wiki.net/wiki/Comet"} Lv20 tốn 173 mana (+173 life) → 173/80 ≈ 2 charge/cast (xấp xỉ). Gargantuan Life Flask 75 charge; 40% auto-consume = 30 charge/trigger → ~15 cast để bù.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Cast_on_Critical"} Comet lý tưởng: CoC trigger theo energy từ crit (không cooldown cố định); Comet base mana cost cao nhất trong spell phổ biến (173 @Lv20) → nhiều charge/trigger. Đủ Comet fire trong 5s (buff duration) → loop tự duy trì.
- Life pool thấp hơn (2.500) → 2% = 50 → 173/50 ≈ 3 charge/cast (gen nhanh hơn, pool mỏng hơn). Không cần bơm life cực cao, nhưng phải cẩn thận vì flask không recover life.

## Physical damage buff

- 40% charge auto-consume at full → 30 charge (Gargantuan) → **+30% of damage as Physical / 5s**. Không stack — reapply chỉ reset duration.
- "gain X% of damage as extra physical" (≠ increased physical): cộng phẳng mỗi hit tỷ lệ base damage hit đó — kiểu :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Proliferation"} nhưng physical. Comet cold → 30% hit thêm dạng physical. Không scale qua physical pen/modifier trừ khi đầu tư riêng.
- Trigger automatic → chỉ cần giữ uptime: flask gần đầy liên tục + hit enemy đều để trigger trước khi buff hết.

## Life recovery ngoài flask

- Recovery thật = :wiki-link{url="https://www.poe2wiki.net/wiki/Vitality_Siphon"} — 20% of Spell Damage Leeched as Life (buffed từ 10% ở 0.5.0). Comet damage cao + trigger dày → đủ sustain combat thường.
- Nguy hiểm khi không có enemy hit (corridor, transition, đứng aura không cast) → mất cả leech lẫn Life Remnant. :wiki-link{url="https://www.poe2wiki.net/wiki/Grasping_Wounds"} (25% hit damage → delayed loss over 4s) buffer spike, không phải full solution. Cần life pool đủ chịu burst trước khi leech kịp.
- "Flasks do not recover Life" chỉ tắt recovery từ flask. :wiki-link{url="https://www.poe2wiki.net/wiki/Life_Remnants"} (skill từ Sanguimancy) vẫn drop khi monster bị hit, collect vẫn recover life — source thứ hai ngoài leech.

## Optimization

- Flask size → buff magnitude: 40% của 30-charge = +12% physical; 40% của 75-charge = +30%. Gargantuan Life Flask (Lv40, 75 charge) = tier tốt nhất.
- Charge/cast theo mana cost spell — Comet (173) nhiều hơn spell nhỏ. Two-spell CoC (Comet + Spark) → tăng max energy (cần nhiều crit trigger) + hai spell tốn life/trigger → charge gen tốt hơn nhưng energy req cao hơn.
- High tier: ailment threshold monster tăng mạnh → CoC cần damage cao hơn để fill energy (wiki CoC: crit ~10× ailment threshold mới reliable). Trigger sụt → charge gen sụt → buff uptime giảm. Điểm gãy nhất khi low-tier → endgame.

## Failure modes

- **Map mod No Leech**: với "Flasks do not recover Life" active → mất toàn bộ recovery trừ Life Remnants. Không chạy được trừ khi có source recovery thứ ba. (Hexproof / Cannot be Stunned không liên quan.)
- **Burst one-shot trước leech**: Vitality Siphon cần hit mới activate; burst lúc không cast (sai position boss slam) → không recovery kịp. Grasping Wounds giảm không loại bỏ. Life pool 4.000+ = floor chịu standard T16 hit.
- **CoC trigger sụt high-tier**: ailment threshold scale exponential theo monster level. 100k damage reliable @T1; @T16 (monster lvl 80, threshold ~26k) cần cao hơn nhiều.
- **Thiếu Life Flask slot**: Sanguine Tides track 1 "Life Flask"; không life flask trong belt (hoặc hết charge) → loop dừng hẳn.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Sanguine Tides: charge rate nhân đôi — 1 charge per 2% Life spent (trước 4%).
- Physical damage buff duration 3s → 5s.
- Penalty "50% less Life Recovery from Flasks" → "Flasks do not recover Life".
- Vitality Siphon (cùng cluster): 10% → 20% Spell Damage Leeched as Life.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview patch 0.5.0, gồm buff Blood Mage.
