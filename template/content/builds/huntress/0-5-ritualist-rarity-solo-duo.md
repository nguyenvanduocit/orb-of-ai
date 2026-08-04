---
template: templates/build-template.md
document_type: build
title: Magic Find Spell Ritualist
status: draft
author: duocnv
created: '2026-06-29'
updated: '2026-07-03'
class: Huntress
ascendancy: Ritualist
league: '0.5'
patch: 0.5.3
budget_tier: mirror-tier
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Comet
  damage_type: cold
  playstyle: caster
  content_focus: currency-farming
tags:
  - huntress
  - ritualist
  - rarity
  - magic-find
  - spell
  - blood-magic
  - andvarius
  - kalandras-touch
  - greeds-embrace
  - mageblood
  - runeseeker
  - solo
  - duo
  - currency-farming
  - 0-5
  - poe2
---

# Magic Find Spell Ritualist

Clone con đầu board rarity poe.ninja Runes of Aldur — [ZerxSexZerx](https://poe.ninja/poe2/builds/runesofaldur/character/ZerxZerxZerx-1953/ZerxSexZerx): **627% Item Rarity + 365k DPS**, cây cân bằng rarity/damage nhất trong 124,292 character. Khác [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) (bám carry), build này **tự đánh** nhờ damage spell → solo tự map, duo với account aura riêng còn khoẻ hơn. Mirror-tier: rarity engine rẻ, damage + lớp sống sót đắt. Character page render đủ gear/tree/stat + cột rarity + nút Import code PoB2 desktop.

## Build Overview

- **Skill chính:** :wiki-link{url="https://www.poe2wiki.net/wiki/Comet"} (cold spell), scale bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Runeseeker's_Call"} (Runic Fork): weapon chỉ socket rune + nhân 200% hiệu lực rune socketed → rune cho 315% spell damage + 9 levels spell skill → Comet **~366k DPS** (average hit ~519k, crit 31.85%, cast ~0.70/s, hit chance 100%, không DoT).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Palm_of_the_Dreamer"} offhand: 27% gain as extra chaos cho allies trong presence.
- Keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Blood_Magic"} + Sacrifice of Flesh bỏ mana hoàn toàn → cast bằng life, Mana hiển thị 0.
- Damage 366k đủ farm map MF (white → T15 nhẹ, duo có carry gánh boss) nhưng yếu solo boss/pinnacle — farm rarity, không bosser.
- **Điểm yếu thật = thủ:** Life 3173, ES 299, EHP 5,750, evade 1%, max hit chịu phys 4,341 / fire 5,078 / cold 4,739, fire/cold res **19/13 undercap nặng**. Con gốc sống nhờ :wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} flask uptime; clone bắt buộc res-offset nếu không 1 đòn element ~4-5k = chết. Duo account aura gánh thủ tốt hơn → Mageblood thành optional.

## Rarity ledger 627%

Đọc thẳng từ character thật:

| Slot | Rarity | Chi tiết |
|---|---|---|
| Andvarius (ring 1) | 98% | implicit 15 + explicit 83 |
| Andvarius (ring 2) | 96% | implicit 13 + explicit 83 |
| Kalandra's Touch (ring 3) | ~98% | copy con Andvarius kế bên |
| Greed's Embrace (body) | 62% | explicit 50 + rune rarity 12 |
| Aurseize (gloves) | 58% | — |
| Gold Amulet rare | 56% | implicit 19 + explicit 18 + desecrated 19 |
| Beast Spur boots | 21% | — |
| Mind Dome helm | 19% | — |
| Passive tree + ascendancy + 2 anoint | ~119% | — |

- Gear ~508% + tree ~119% = **627%**. Hai điều quyết định total đúng: hai Andvarius phải roll cao **88-95%** (không phải floor 67-79%), và ~119% là **tree Ritualist + anoint, không phải gear** — không allocate node rarity thì trần chỉ ~508%.

## Shopping list (roll + giá 2026-06-29, 1 div ≈ 424 ex)

**Lớp rarity — chỗ floor-trap nặng nhất, phải đúng roll:**
- **Andvarius (Gold Ring) ×2** — lọc explicit rarity ≥82 khớp 83% gốc (corrupted). **~40 div/cây (~80 div cặp)**. Bản 5-20 ex chỉ 67-79% → mất ~20% mỗi ring. POE2 0.5 không có rarity catalyst → không DIY roll cao, phải mua sẵn. [Search Andvarius ≥82](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/Ypm4wDYOUY)
- **Kalandra's Touch** — **~22 div**, copy nguyên con Andvarius cạnh nó → nhân đôi roll 96%. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/KljEoE3Ec5)
- **Aurseize (gloves)** — lọc rarity ≥55 khớp 58% (corrupted). **~5 div**. Bản 45% ~1 ex nhưng thiếu rarity. [Search Aurseize ≥55](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/G67pqZ3bFb)
- **Greed's Embrace (body)** — explicit 50% rarity **~1 ex**; +12% còn lại tự cắm 1 rune rarity vào socket. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/RJdgvnmZs7)
- **Gold Amulet rare** — đắt và rối nhất. Gốc 56% = implicit 19 (free base Gold Amulet) + explicit 18 + **desecrated 19**, cộng fractured +4 spell levels. Cây +4 spell rarity tới 51% = **~500 div**; cây +4 spell 122 div chỉ 36-37% rarity (thiếu desecrated). Đủ 56% → trả 500 div hoặc mua 122 div rồi craft thêm desecrated rarity. [Search +4 spell + rarity](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/nr28XaB2H0)
- **Helm rare (Skycrown Tiara)** — search ĐẦY ĐỦ profile, đừng filter mỗi rarity: rarity 18-19 + ES% ≥70 + life ≥140 + cold ≥25 + light ≥25. Floor **~4 ex**, cây tốt (life ~165 + dual res) **~1-2 div**. Slot vá res chính: dual res kéo lại phần lớn −33% từ hai Andvarius. [Search full profile](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/WvY7EPKbtm)
- **Boots rare (Dunerunner)** — MS ≥25 + rarity 18 + life ≥100 + light res ≥30. Floor **~10 ex**, cây tốt **~1-2 div**. Lọc cả res (một nguồn light res bù Andvarius). [Search full profile](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/3qEVoWM9T5)

**Lớp damage + sống sót — chỗ đốt phần lớn ngân sách:**
- **Runeseeker's Call** (weapon, DPS engine) — **~349 div** (corrupted), chỉ ~682 cây tồn tại → floor cứng. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/MdmLVLzRFJ)
- **Mageblood** (belt, flask uptime) — **~520 div** (corrupted). Cắt được nếu duo account aura. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/gl9vQBGghQ)
- **Belt rare** (thay Mageblood bản duo) — life ≥150 + fire ≥35 + cold ≥35 + 2 charm slot. **~35 ex - 1 div**. Mageblood không cho res → rare belt 2 dòng res vá lỗ fire/cold; bản duo res cao hơn cả ZerxSexZerx. [Search res belt](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/8rWG9vrbIV)
- **Palm of the Dreamer** (offhand) — **~190 div** (corrupted). [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/eRa9Xj69iL)
- **The Adorned** (jewel) — **~19-30 div**. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/yYD7EqkeSR)
- **Grand Spectrum ×3** — **~1 div/viên**. [Search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/PP6kd7MMFL)
- **Weapon set 2 swap** — :wiki-link{url="https://www.poe2wiki.net/wiki/Quill_Rain"} ~7 ex + :wiki-link{url="https://www.poe2wiki.net/wiki/Cadiro's_Gambit"} ~5 ex (Covetous arrow = mũi tên rarity). [Cadiro search](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/kyprX8Q5T5)
- **Jewel còn lại:** Flesh Crucible ~25-30 ex, Split Personality ~10-15 ex, Heart of the Well ~7-15 ex, Undying Hate ~85 ex, vài rare jewel ~5-20 ex/viên.

## Res & life offset

- Hai Andvarius = **−33% all res**, fire/cold gốc chỉ còn 19/13. Mỗi slot craft phải mua dạng **full item** (rarity đúng roll CỘNG life/res/ES) — không filter mỗi rarity. Lọc 1 mod → cây rẻ mạt nhưng đeo vào chết.
- Nguồn res kéo lại −33%: **Helm** dual res (cold + light, mỗi dòng ~37) + ES% + life (slot lớn nhất, ~1-2 div) · **Boots** 1 dòng res (light ~35) + life + MS · **Belt** bản duo rare fire + cold + life · **Amulet** ô suffix nhét 1 res · vài node res tree.
- Cộng đủ → bản duo (rare res-belt) dày res hơn ZerxSexZerx (gốc xài Mageblood nên bỏ trống fire/cold). Mục tiêu: rarity ~627%, fire/cold từ undercap lên gần cap, life pool ≥ 3,200.

## Ba bậc ngân sách

- **Faithful 627% (sát mọi roll): ~1,900 div.** Rarity engine ~610 div (rings 80 + Kalandra 22 + Aurseize 5 + amulet 500) + shell damage/thủ ~1,080 div (Runeseeker 349 + Palm 190 + Mageblood 520 + jewel ~60) + lớp rune ~210 div (Legacy of Lifesprig 209 + special runes chưa tra). Lớp rune ~210 div áp cho mọi bậc còn giữ damage Runeseeker.
- **Tương đối ~608% (amulet 122 div, bỏ desecrated): ~1,310 div.** Chỉ mất ~19% rarity ở amulet, slot rarity-chính vẫn full roll. Điểm vào hợp lý nhất.
- **Duo account aura (cắt Mageblood ~515 div): ~800 div**, rarity vẫn ~608%. Account aura Grace/Determination/Purity đủ cho cây kính đứng. Đổi Mageblood lấy rare res-belt (~1 div) → fire/cold gần cap không cần partner phủ Purity — bản ít kính nhất, res cao hơn con gốc.

## Runes, anoint, allocate

Character page có nguyên rune/anoint/allocate/tree/gear/stat + cột Item Rarity + nút Import code PoB2 desktop. Phần tự gắn:
- **Runeseeker's Call:** Legacy of Lifesprig (~209 div, rune đắt nhất ngoài weapon) + Hedgewitch Assandra's Rune of Wisdom + 3× Perfect Iron Rune → 315% spell damage + 9 spell levels mà weapon nhân 200%.
- **Helm:** Raven-Touched Shard + 1 Perfect Body Rune; enchant Allocates All Natural.
- **Gloves / Boots:** mỗi cái 2× Perfect Body Rune (+life).
- **Greed's Embrace:** Rabbit Idol (+12% rarity + life idol socket) + 3× Perfect Body Rune.
- **Palm of the Dreamer:** Idol of the Martyr.
- **Amulet:** anoint Zarokh's Gift; **Belt** (Mageblood) enchant +22% fire res.
- **Cảnh báo:** mọi dòng Bonded (ShamanOnly) trên rune là **chết** vì Ritualist/Huntress (enableBondedMods=false) — chỉ non-bonded (+life, rarity, spell) đếm. Perfect Body/Iron Rune rẻ; Legacy of Lifesprig ~209 div; Raven-Touched Shard + Hedgewitch Assandra's Rune of Wisdom không tra được bằng tên trên trade (reward/craft-only), đọc giá trong client.

## Failure Modes

- **Res undercap = một-shot bởi đòn element.** Hai Andvarius −33% all res, fire 19 / cold 13 sau bù. Map mod elemental hay AoE element = chết. Solo né cẩn thận; duo account aura (Purity/Determination) vá.
- **Mageblood là single point of cost bản solo.** ~520 div để flask uptime gánh res âm; chưa đủ → solo chưa đứng, lùi về duo aura partner.
- **Sai roll Andvarius = total rarity sai.** Bản floor 67-79% thay vì 88-95% = tụt ~40% total — lỗi dễ mắc nhất vì floor rẻ gấp mười lần.
- **Damage engine không thay được rẻ.** Runeseeker ~349 div + Palm ~190 div không có bản budget; thiếu = mất tự map, tụt về vai cull-bot.
- **Lose 2% Life on Kill của Aurseize** đánh thẳng life, bypass ES, có thể giết. Build tự ra đòn kết liễu bằng spell → kill tính cho mình → dòng này **có nổ**, mỗi kill mất ~2% life; pack dày phải để ý leech/regen bù kịp.

## Verdict

Trả lời "vừa rarity cao vừa tự farm được, không bám carry." Giá: mirror-tier ~1,300 div bản tương đối, ~1,650 div bản sát hoàn toàn. Engine rarity rẻ nếu mua đúng roll cao (rings 80 div + Kalandra 22 div + Aurseize 5 div), tiền thật ở Runeseeker + Palm + Mageblood. Duo account aura cắt Mageblood → ~800 div vẫn giữ rarity = cách vào rẻ nhất. Chỉ muốn rarity không tự đánh → [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) rẻ hơn nhiều.

## Optimization

- Mua Andvarius 88-95% (~40 div) thay floor — biến số quyết định total rarity, đừng tiếc.
- Amulet craft: mua +4 spell 122 div (~37% rarity) rồi tự thêm desecrated rarity line, rẻ hơn cây 56% bán sẵn 500 div.
- Allocate đủ node rarity Ritualist + 2 anoint trước khi than total thấp — ~119% ở đó, không phải gear.
- Vào league log res in-client sau khi đeo hai Andvarius + Greed's → biết account aura cần phủ Purity bao nhiêu; số này quyết định solo đi map mod nào.
- Cân Mageblood vs account aura: duo partner ổn định → dồn ~515 div sang amulet 56% hoặc Runeseeker roll tốt hơn.

## Changelog

### 2026-06-29
- Tạo bài từ clone ZerxSexZerx (poe.ninja Runes of Aldur snapshot 0556-20260629): 627% rarity + 365k DPS, spell Ritualist Blood Magic, tách khỏi nhánh cull-bot.
- Ledger rarity: gear ~508% (rings 292 + Greed's 62 + Aurseize 58 + amulet 56 + boots 21 + helm 19) + tree ~119% = 627%.
- Giá securable đo từng slot: Andvarius 88-95% ~40 div/cây, Kalandra 22 div, Aurseize 56% ~5 div, amulet 56% ~500 div (hoặc 37% 122 div + craft), Runeseeker 349 div, Palm 190 div, Mageblood 520 div. Faithful ~1,690 div / tương đối ~1,310 div / duo-aura ~800 div.

## Relationships

- **alternative_to** [Rarity Cull Bot Ritualist](/builds/huntress/0-5-ritualist-rarity-cull-bot) — nhánh duo thuần không tự đánh, dùng Ventor's + Culling Strike thay engine Andvarius + spell self-clear; chọn nếu chỉ làm loot mule.
- **alternative_to** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — Ritualist hướng self-DPS thuần, dùng Unfurled Finger + ring economics khác hẳn.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — 0.5 thêm Mageblood, đổi party rarity, Runic Ward; nền cho mọi nhánh MF Ritualist.
