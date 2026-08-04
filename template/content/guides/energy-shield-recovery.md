---
template: templates/mechanic-template.md
document_type: mechanic
title: "Energy Shield Recovery"
status: draft
author: duocnv
created: '2026-05-24'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.3
tags:
  - poe2
  - energy-shield
  - defense
  - recovery
  - runes-of-aldur
  - runic-ward
  - deflection
---

# Energy Shield Recovery

:wiki-link{url="https://www.poe2wiki.net/wiki/Energy_Shield"} 0.5 hồi qua 2 cơ chế riêng: **delay** (thời gian tránh hit trước khi recharge bắt đầu, base 2s) + **rate** (tốc độ hồi ES/giây sau delay, base 33% max ES/giây). Đổi mạnh từ 0.4. Build dùng: hybrid Evasion + Deflection + Runic Ward trên Huntress Spirit Walker, Lich Witch, vài Stormweaver. (TheLeader_A chạy CI + Ghost Dance + high ES → recovery chỉ phụ, chính là Deflection + Ward.)

## How It Works

- **Delay phase**: chờ sau khi mất ES trước tick recharge đầu; modifier "faster start of Energy Shield Recharge" rút ngắn.
- **Rate phase**: tốc độ hồi/giây sau delay; "increased Energy Shield Recharge Rate" chi phối.
- Tree 0.5: **85 node** cấp faster start (chủ yếu small 4% + 6%). Rate gần như bị tước khỏi small node, chỉ còn ở vài notable + gear. Cụ thể **30 small node 4%** + **23 small node 6%** faster start. Notable rate còn ít: **Rapid Recharge** 12% rate + 12% faster start (mạnh nhất còn lại); **Convalescence** 20% faster start + penalty 10% reduced rate; **Patient Barrier** 50% max ES + 20% slower start.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"}: lớp an toàn khi life về 1, hấp thụ damage + hồi độc lập ES/life. :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium_Runeforging"} socket Ward Rune vào armour từ Act 1, free <lvl55. Không bị keyword "Defences".

## Math Chain

Setup hybrid điển hình right-side tree:
- 4 small node 4% + 3 small node 6% faster start (~34%)
- Rapid Recharge: 12% rate + 12% faster start · Mystic Stance: 12% faster start · Essence Infusion: 12% faster start
- Gear (Foci + Essence of Hysteria + Rebirth Rune): ~50-55% rate
- Runic Ward từ gear: 15-25% max Ward tùy craft
- **Tổng faster start** tree + notable ~70-90% tùy pathing. **Tổng rate** chủ yếu từ gear (tree gần không hỗ trợ) → thấp hơn nhiều so 0.4 → build dựa pool + Ward + Deflection thay recharge spam.

## Key Interactions

- **Runic Ward** = quan trọng nhất: ES sạch + life chạm 1 → Ward kích, cho thêm thời gian sống. Stack Ward tốt → chịu burst dài hơn khi ES hồi chậm.
- **Ghost Dance**: lớp ES regen độc lập recovery rate thường. Mỗi lần mất Ghost Shroud → 2% Evasion Rating dạng ES regen/giây (10k Evasion → ~200 ES/s ổn định, không bị nerf recovery tree).
- **Deflection** (nổi bật 0.5): nhiều notable Deflection đồng thời cấp faster start — Mending Deflection 20% (khi không Full Life), Energising Deflection 12%. Cách lấy recovery value rẻ + hiệu quả nhất nhánh Evasion.
- **Staunch Deflection** (0.5.3): thêm Deflection Rating = 8% Evasion Rating — là deflection-from-evasion (KHÔNG phải ES recovery/faster start), cùng họ Wild Cat (12% Evasion → Deflection Rating), khác họ Mending/Energising Deflection. Evasion stacker qua Dexterity có 2 option song song; pick theo path hoặc lấy cả hai.

### Phân biệt faster start vs increased rate
- "faster start of Energy Shield Recharge" → chỉ delay phase, rút ngắn chờ trước tick đầu.
- "increased Energy Shield Recharge Rate" → throughput, tăng ES hồi/giây sau delay.
- 0.5 đập **rate** mạnh hơn delay → build chỉ stack faster start thấy ES hồi chậm rõ khi vào rate phase, đặc biệt dưới sustained damage.

## Optimization

- Tree right-side (Evasion/Intelligence) cho mật độ hybrid tốt nhất: path qua cluster nhiều small node 4-6% faster start + Deflection. Rapid Recharge đáng lấy nếu pathing không xa (rate sạch hiếm).
- Gear: Foci + body armour cho rate suffix (of Suffusion, of Ardour). Intelligence Body Armour giờ roll rate suffix được = ưu thế mới. Verisium Runeforging sớm từ Act 1 (armour <lvl55 free).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Spirit_Walker"} ascendancy hỗ trợ qua node ground effect + companion → di chuyển duy trì evasion + trigger Ward đúng lúc.

## Interactions with Other Content

- Runes of Aldur: Remnant encounter + Verisium Runeforging trực tiếp cấp Ward — đẩy sớm → lợi thế survivability từ giữa campaign.
- Map mod giảm recovery rate ảnh hưởng nặng hơn (baseline đã thấp) → reroll hoặc chuẩn bị Ward pool lớn.
- Trial of the Sekhemas: cộng max Runic Ward vào Honour ban đầu → synergy hai chiều combat thường ↔ endgame.

## What Doesn't Work

- ✗ Recharge spam giữa 2 hit boss gần như chết: TTF tăng đáng kể so 0.4, boss downtime <3s không đủ full refill.
- ✗ Stack thuần faster start, bỏ rate từ gear + Runic Ward → ES hồi rất chậm sau phase rate. Patient Barrier giờ 20% slower start, không còn pool miễn phí.
- ✗ Core of the Guardian trừ thẳng 20% max ES → cực xấu cho pure ES build.

## Common Mistakes

- ✗ Coi Patient Barrier là pool "sạch" như 0.4 → kèm 20% slower start, TTF tệ nếu không Ward đủ mạnh; lấy nó = phải đầu tư Runic Ward song song.
- ✗ Path sâu cluster recovery cũ (Convalescence + Essence Infusion + Rapid Recharge) → trả rất ít value so chi phí point 0.5. Chỉ lấy Rapid Recharge nếu pathing thuận; còn lại ưu tiên Deflection notable (cấp cả faster start + layer phòng thủ).
- ✗ Coi Verisium Runeforging là league mechanic phụ → nó là layer phòng thủ chính bù recovery baseline yếu; không Ward = chết nhanh hơn rõ ở high tier + boss burst.

## Cost & Restrictions

- Verisium Runeforging đòi farm Remnant sớm + Verisium currency; armour ≥lvl55 đánh đổi base defence để có Ward.
- Patient Barrier + Convalescence mang penalty recovery; Core of the Guardian trừ max ES cứng.
- Runic Ward không scale với modifier "Defences" nào → invest riêng max Ward + Ward recovery rune.

## Verdict & Open Questions

- **Verdict: NEUTRAL.** ES recovery vẫn tồn tại + có giá trị, nhưng không còn primary defence — buộc kết hợp Deflection + Runic Ward.
- **Open**: Recovery rate có cap nào trong 0.5? Cần test build full rate gear T16+ xác nhận TTF thực; update sau data live tuần đầu league.

## Version History

### Patch 0.5.3 (2026-06-19)
- Staunch Deflection thêm "Gain Deflection Rating equal to 8% of Evasion Rating", join họ deflection-from-evasion bên cạnh Wild Cat (12%). Không chạm trực tiếp ES recharge layer nhưng tăng giá trị tree-path Evasion stacker qua Dexterity (nhiều build ES-hybrid đi qua lấy Mending/Energising Deflection).

### Patch 0.5.0 — Return of the Ancients
- Loại bỏ hầu hết small node increased ES Recharge Rate, cắt mạnh nhiều notable recovery, giới thiệu Runic Ward + đổi keyword Defences. Thay đổi lớn nhất hệ thống phòng thủ ES từ khi POE2 ra mắt.

### Patch 0.4.0 — baseline trước
- Recovery layer compound cao qua stack tree + notable + gear + essence + rune. Nhiều build recharge spam làm sustain chính, TTF <1s sau khi tránh hit.

## Relationships

- **related_mechanics** [Armour Defensive Scaling](/guides/armour-defensive-scaling) — nửa còn lại của rebalance defence 0.5; armour nâng floor trong khi ES recovery bị nerf, đọc cùng cho bức tranh đầy đủ.
- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — ES nhận damage sau khi qua resistance filter
- **related_builds** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — nerf ES recharge 0.5 build phải path qua.
- **related_builds** [Spectre Summoner Curse Lich](/builds/witch/0-5-spectre-summoner-lich) — nerf ES recharge 0.5 build phải path qua.
- **related_builds** [Unearth Bone Construct Mass Summoner](/builds/witch/0-5-bone-construct-mass-summoner-lich) — lớp ES mà Soulless Form chọc thủng 10%.
- **related_guides** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — layer thứ tư, ES đọc cùng cho đủ bức tranh defence.
- **related_guides** [Ba pool tài nguyên: Life, Energy Shield và Mana](/guides/beginner-life-es-mana) — cơ chế recharge delay, rate, và Runic Ward trong 0.5
- **related_guides** [Patch Notes — Return of the Ancients](/guides/0-5-0-patch-notes) — đợt nerf ES recharge của patch này.
- **related_guides** [Recovery: Life regen, ES recharge và Leech hoạt động thế nào](/guides/beginner-recovery) — deep-dive recharge delay, rate, Runic Ward 0.5
