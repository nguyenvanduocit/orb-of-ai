---
template: templates/mechanic-template.md
document_type: mechanic
title: Refutation — Runic Ward Block Buff Skill
status: draft
author: duocnv
created: '2026-06-03'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
sub_class: skills
confidence_level: MEDIUM
tags:
  - refutation
  - runic-ward
  - verisium-runeforging
  - block
  - stun-threshold
  - parried
  - brass-dome
  - kalguuran-skill
  - olroths-resolve
  - 0-5
  - 0-5-1
  - poe2
  - mechanic
---

# Refutation — Runic Ward Block Buff Skill

:wiki-link{url="https://www.poe2wiki.net/wiki/Refutation"} = Kalguuran Skill tag Buff + Spell + Duration (POE2 0.5), một trong 23 Kalguuran Skill 0.5.0, craft từ Remnant qua Runes of Aldur. Đốt sạch toàn bộ :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} đang có → buff ngắn cho :wiki-link{url="https://www.poe2wiki.net/wiki/Block"} mọi Blockable Hit. Hai downside bị hype giấu: **−50% less Stun Threshold** (chạy sai config → dễ stun HƠN) và uptime trần ~40% (không "permanent").

## How It Works

- Tiêu **toàn bộ Ward hiện có** — không phải min cost (3 Ward lvl1 → 13 Ward lvl20), mà sạch pool dù 50 hay 1400.
- Đổi lại buff cứng **4 giây** (`runic_fortress`), KHÔNG scale gem level (lvl1 = lvl20 = 4s, chỉ quality kéo dài). Trong buff: Block 100% mọi Blockable Hit từ **mọi hướng**, không directional check, không roll.
- Cast time 0.65s, trong cast −70% movement speed final → burst-window chủ động, không toggle.

> Spends all your Ward to gain a short-duration Buff that causes you to Block all Blockable Hits and apply Parried to enemies from which you've Blocked a Hit. This Buff is removed if you are Heavy Stunned. While this Buff is active, you cannot be Light Stunned, but Blocking too much damage may Heavy Stun you.

- Thủ: block-all → 0 damage 4s + miễn Light Stun. Công: mỗi enemy bị block → dính :wiki-link{url="https://www.poe2wiki.net/wiki/Parried"} Parried (50% more Attack Damage, 2.0s lvl1 → 3.9s lvl20 ~ gần trọn buff 4s).
- Self-limit: "Blocking too much damage may Heavy Stun you" → mỗi Hit block vẫn đẩy stun buildup lên player; đủ cao → Heavy Stun → **gỡ buff giữa pha block**. Chống spike nhỏ liên tục tốt; đứng tắm damage khổng lồ (boss slam, T17 dày) thì buff tự bị stun-cancel (buildup có thể chạm ngưỡng nhanh hơn trực giác — đo in-client).

## Math Chain

- Stun Threshold base = maximum Life (Ward không đóng góp — 0.5 gỡ Runic Ward khỏi keyword "Defences"). Flat stun threshold từ gear (Brass Dome) cộng vào base **trước** khi nhân.
- Refutation chồng hai dòng: "50% less Stun Threshold" + "5% more Stun Threshold per 10 Runic Ward spent" (= 0.5%/1 Ward đốt). Engine dồn cả hai vào MỘT stat `stun threshold +% final from runic fortress` → hai cách cộng, hai break-even chênh gấp đôi.

Multiplicative (quy ước more/less):

$$\text{net} = \text{base} \times 0.5 \times (1 + 0.005 \times \text{Ward spent})$$

Break-even **W = 200**; 1400 Ward → 0.5 × 8.0 = **×4.0** (+300%).

Additive (gộp mọi dòng vào một "+% final", khớp việc engine chỉ phơi một stat):

$$\text{net} = \text{base} \times (0.5 + 0.005 \times \text{Ward spent})$$

Break-even **W = 100**; 1400 Ward → 0.5 + 7.0 = **×7.5** (+650%).

- Tên stat đơn lẻ nghiêng additive. "+700%" của guide gần đúng nếu additive (+650% ở 1400, sát), là lỗi quên ×0.5 nếu multiplicative (net thật ×4.0). Datamine không phân định — **đốt đúng 200 Ward** đọc Stun Threshold in-client: multiplicative ×1.0 (về base), additive ×1.5 (+50%) — một mốc chốt cả hai break-even.
- Sàn Ward (dưới đó buff hạ Stun Threshold < base): multiplicative 200, additive 100. Đốt 100 Ward → multiplicative ×0.75 (mất 25%), additive ×1.0 (hoà). Nhắm pool **≥200** net dương cả hai cách; dải 100–200 là vùng đổi dấu. Quality +20% cùng stat (+1s buff) kéo sàn xuống (~130 mult, 60 add) + bù net — ở 1000 Ward + 20% quality: multiplicative ~×3.6, additive ~×6.5 (gap giãn ở Ward cao → đo sớm).
- Uptime (0.5.1 khoá): "Cooldown no longer recovers while the Buff is active" → cycle = 4 + 10 (không max(4,10)). Buff 4s base (5s với 20% quality), CD 10.0s lvl20:

$$\text{uptime}_\text{base} = \tfrac{4}{4+10} \approx 28.6\% \qquad \text{uptime}_\text{quality} = \tfrac{5}{5+10} \approx 33.3\%$$

- Full support — Prolonged Duration II (35% more → 5.4s) + Cooldown Recovery I (25% increased CDR → 8.0s CD) → 5.4/(5.4+8.0) ≈ **40.3%**. Trần thực 40–50%; ~6 giây hở mỗi cycle = cửa sổ nguy hiểm.

## Key Interactions

- **Ward pool (nhiên liệu)**: giá trị chỉ đến từ Ward nạp trước cast — vừa là điều kiện vượt sàn, vừa là toàn bộ stun-threshold-upside. 0.5 KHÔNG có node Runic Ward trên passive tree → pool đến từ gear/runeforging.
- **Parried (cửa sổ công)**: 50% more Attack Damage, lvl20 3.9s ~ buff 4s. Enemy dính ngay hit block đầu → cả window để xả. Cast/attack speed không đổi timing block; cái quyết định là tốc độ land attack sau block. Parried của Refutation dùng chung debuff với Parry buckler (cùng 50% more) → hai nguồn không stack riêng.
- **Ward regen timing**: Runic Ward hồi 5%/s max. Pool 1000 → 200 Ward = 20% pool ~4s từ 0, 100 Ward ~2s (khớp/nhanh hơn buff). [Olroth's Resolve](/guides/olroths-resolve) flask (live từ 0.5.0, ghi ở 0.5.1): "Regenerate 2.5–5% max Runic Ward per second during Effect" → ~10%/s (halve rebuild) + "Gain Guard equal to current Runic Ward for 10 seconds".
- **Wording**: "Block all Blockable Hits" = **guaranteed, không roll** (khác block chance %) — block-all không phụ thuộc Ward, chỉ phần stun-threshold phụ thuộc. Stun-threshold-upside chỉ đến từ **Ward đã đốt**, chỉ **trong lúc buff active**; có Ward thụ động trong pool KHÔNG feed Stun Threshold (Runic Ward không nằm trong Defences — xem [Runic Ward Onslaught Loop](/guides/0-5-runic-ward-onslaught-loop)).

## Optimization

- Việc đầu tiên KHÔNG phải minmax mà **vượt downside**: stack Ward qua sàn (≥200 cho chắc cả hai model, lý tưởng 600+), không thì Refutation là nút bấm làm bạn dễ stun hơn.
- 20% quality đáng (+20% more stun threshold + 1s buff, kéo sàn ~130 mult / 60 add).
- Uptime: increased Skill Effect Duration (Prolonged Duration II 35% more → 5.4s) + Cooldown Recovery (CDR I 25% → CD 8.0s) → trần ~40%. Grounded in the Earth notable (16% increased Skill Effect Duration + 16% increased Stun Threshold) hợp.
- Stun-threshold floor (flat cộng base trước nhân đáng nhất): :wiki-link{url="https://www.poe2wiki.net/wiki/The_Brass_Dome"} +200–300 flat Stun Threshold, Chakra of Stability +1 per Dexterity (400 Dex = +400), notable Flesh Withstands (21% increased). base = max Life → Str build stack Life cũng nâng base. Phải **attack-based** để ăn Parried (spell build mất 50% more attack damage).

## Nguồn Ward

- Nguồn chính **Verisium Runeforging**: bất kỳ armour nào runeforge để gain Runic Ward — basic (Act 1, armour dưới lvl 55 gain free; trên lvl 55 đổi base defences lấy ward), Unique Verisium Runeforging (Act 3, runeforge unique base lvl-55+ thêm ward bằng cách giảm defence khác). Ward là thứ **rèn vào gear**, đánh đổi Armour/Evasion/ES.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Svalinn"} (Crucible Tower Shield, Lv 60): +50–100 maximum Runic Ward + (200–300)% increased Armour + Chance to Block Lucky — patch 0.5 thêm dòng ward (patch note line 650), không carryover POE1. Patch thêm 15+ Runic Ward Rune craft từ Remnant (catalog đầy đủ cần compile in-client).
- **Brass Dome hai trục**: base KHÔNG cho Ward — +200–300 flat Stun Threshold, (500–600)% increased Armour, −(5–1)% max res, Take no Extra Damage from Critical Hits (giúp Refutation qua flat stun threshold cộng base). "~1400 Ward từ Brass Dome" là **Brass Dome đã runeforge** (Unique Verisium Runeforging đổi một phần 500–600% armour lấy pool ward lớn); lượng ward phụ thuộc roll → ~1400 là item cụ thể của creator, không cố định.

## What Doesn't Work

- ✗ Chỉ block **Hit** → DoT (ignite/poison/bleed), ground degen, unblockable hit đi xuyên hoàn toàn (đứng trong buff giảm 0 DoT).
- ✗ Spell build: đủ block-all nhưng **0 giá trị Parried** (chỉ khuếch đại Attack Damage) → chỉ dùng như công cụ thủ thuần, cửa sổ Parried phí.
- ✗ Cast **dưới sàn Ward** (100 additive / 200 multiplicative): net-negative stun threshold — bấm nút làm mình dễ stun hơn (config mặc định của build chưa đầu tư Ward; nhắm ≥200, lý tưởng 600+).
- ✗ Trông đợi uptime gần permanent → tính theo trần ~40% (5.4s / 8.0s full support), chừa kế hoạch thủ cho ~6s hở mỗi cycle.
- ✗ Coi Refutation thay lớp thủ chính → dùng như burst-window chồng lên baseline thủ đủ (Armour/Evasion/ES, max res, recovery); 60% thời gian không buff + buff chỉ chặn Hit.
- ✗ Bỏ 20% quality → là multiplier thứ ba (1000 Ward ×3.0 → ×3.6) + 1s buff (uptime 28.6% → 33.3%), uplift rẻ nhất.
- ✗ :wiki-link{url="https://www.poe2wiki.net/wiki/Lifetap"}: đổi cost sang Life → không còn Ward đốt → "5% more per 10 Ward spent" = 0 → chỉ còn ×0.5 penalty trần trụi. Phá core loop.

## Cost & Restrictions

- Cost lớn nhất = **gap cooldown**: trần ~40% để lại ~6s/cycle không buff, phải sống bằng lớp thủ nền. Burst-window, không phải lớp thủ thường trực.
- Ward sustain: pool nạp lại liên tục (5%/s max); cast kế net-dương chỉ nếu pool kịp vượt sàn trước đó. Cast mỗi off-cooldown trên pool nhỏ = thường đốt dưới sàn.
- Gear cost (nặng nhất, ẩn): runeforging **đánh đổi base defence lấy Ward** — body runeforge cho ward lớn là body từ bỏ Armour/Evasion/ES gốc. Ward-stacker hi sinh defence thường trực mua burst-window 40% uptime.

## Verdict & Open Questions

- Defensive burst đáng giá khi đầu tư đúng (Ward > 200, 20% quality, attack-based để ăn Parried); vô dụng phía công với spell build, net-negative nếu Ward thấp.
- Math hai model tuỳ engine gộp stat: multiplicative (break-even 200, ×4.0 ở 1400) hoặc additive (break-even 100, ×7.5 ở 1400). Datamine một-stat nghiêng additive; đốt 200 Ward đọc Stun Threshold để chốt (×1.0 = mult, ×1.5 = add).
- Uptime trần ~40%; 0.5.1 khoá ("Cooldown no longer recovers while Buff active" — nerf vs launch). "permanent block" cường điệu.
- Brass Dome giúp hai trục: +200–300 flat stun threshold (base) + ward pool nếu runeforge; base không cho ward.
- Block-all chỉ chặn Hit — DoT/ground degen/unblockable đi xuyên.
- **Verdict: NEUTRAL-to-strong nhưng overhyped** — burst layer chồng thêm, không phải nền tảng thủ.
- Cần đo in-client (league live): stacking form stat (đốt 200 Ward đọc Stun Threshold); stun buildup qua block có chạm Heavy-Stun-self nhanh hơn dự kiến không (0.5.1 chặn logout-thoát-heavy-stun, buildup giữ qua relog); ward thật của Brass Dome runeforged; CDR II %; Kalguuran Support nào support Spell (Runic Infusion confirmed Attack-only nên loại).

## Version History

### Patch 0.5.1
- "Refutation's Cooldown no longer recovers while the Buff is active" — khoá uptime 4+10/cycle (~28.6% base, ~40% full support), nerf vs launch.
- Olroth's Resolve flask: ghi lại dòng đã live từ 0.5.0 — "Regenerate 2.5–5% of maximum Runic Ward per second during Effect" + "Gain Guard equal to current Runic Ward for 10 seconds when effect ends" (nạp ward ~10%/s + Guard layer, hợp ward-stacker Refutation).
- "Logging out and in again now preserves your heavy stun buildup" — chặn logout thoát Heavy Stun, hết cheese "block too much → Heavy Stun → mất buff" bằng relog.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Repulsion"} Triggered Wave thêm base Critical Strike Chance 6% — không đụng Refutation trực tiếp, cùng hệ ward-drain (xem [Runic Ward Onslaught Loop](/guides/0-5-runic-ward-onslaught-loop)).

### Patch 0.5.0
- Refutation thêm như một trong 23 Kalguuran Skill, craft từ Remnant qua Runes of Aldur.
- :wiki-link{url="https://www.poe2wiki.net/wiki/The_Brass_Dome"} nerf armour: 700–800% → 500–600% increased Armour (base vẫn +200–300 Stun Threshold, không Ward).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Svalinn"} thêm +50–100 maximum Runic Ward (+ Cast on Block supported skills cost nothing) — nguồn ward cố định cho ward-stacker.
- Verisium Runeforging ra mắt (basic Act 1, Unique Act 3) + 15+ Runic Ward Rune craft từ Remnant — toàn bộ nền ward là cơ chế mới 0.5.

## Relationships

- **related_mechanics** [Runic Ward Onslaught Loop cho Minion](/guides/0-5-runic-ward-onslaught-loop) — chung hệ Runic Ward; loop giữ ward thấp thụ động (không feed stun threshold), Refutation đốt ward đổi bonus stun threshold tạm thời — hai cách dùng ngược một pool.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Kalguuran skill + Verisium Runeforging, hệ league sinh ra Refutation + nguồn ward.
- **synergizes_with** [Olroth's Resolve](/guides/olroths-resolve) — flask nạp Ward ~10%/s + Guard layer, đường sustain pool cho ward-stacker.
- **related** [0-5 new unique items](/guides/0-5-new-unique-items) — Brass Dome, Svalinn, Eventide Petals: unique stun threshold + ward mà build Refutation dùng.
