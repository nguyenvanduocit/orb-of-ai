---
template: templates/mechanic-template.md
document_type: mechanic
title: Farm aura beast cho companion zoo
status: published
author: duocnv
created: '2026-06-15'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.2
tags:
  - poe2
  - huntress
  - spirit-walker
  - tame-beast
  - companion
  - aura-bot
  - zoo
  - essence-farming
  - 0-5
---

# Farm aura beast cho companion zoo

Aura beast = rare beast rẻ nhất mang :wiki-link{url="https://www.poe2wiki.net/wiki/Monster_modifier"} dạng "… Aura". Tame bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} → companion phát aura cho cả đàn + mình. Account-bound (không bán/mua); cái phải trả là thời gian reset essence. Roster thật: Diretusk Boar (Haste), Coconut Crab (Extra Physical), Adorned Scarab (Energy Shield), Swarming Wasp (Periodic Invulnerability). Cơ chế tame nền (retention, on-screen lock, disenchant): [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt).

## Aura nào phủ ra cả đàn

- Chỉ dòng mod kết thúc "**Aura**" phủ ra allies (mình + cả pack).
- All Damage Shocks/Ignites → chỉ dán ailment lên enemy con đó đánh (đàn hưởng gián tiếp qua ailment).
- Regenerates Life, Armoured, Fire Resistant, Shroud Walker → self-only.
- Rule phân vai roster: [companion pack](/builds/huntress/0-5-spirit-walker-companion-pack).

Pool 8 aura (thường / Empowered), xếp giá trị thực chiến:

- **Haste Aura**: allies 25% inc Attack/Cast Speed + 25% inc Movement Speed. Đáng nhất — bucket skill speed companion gần rỗng, chạy thường trực.
- **Extra Physical Damage Aura**: allies 20/40% inc Global Physical Damage. "increased" → pha loãng; đàn có 80-90% inc phys sẵn → uplift thực ~10-15%.
- **Energy Shield Aura**: allies gain 12/30% Maximum Life as Extra Maximum ES (scale theo life từng ally).
- **Periodic Invulnerability Aura**: pulse buff Immunity ngắn cho allies gần, clause "Allies with Immunity cannot gain Immunity" (nhiều con không cộng dồn/nối duration — cứu 1 đợt AoE, không bất tử).
- **Temporal Bubble**: enemy trong bubble 10/25% reduced Action Speed, 20/60% reduced Cooldown Recovery, debuff expire chậm 40%.
- **Elemental Resistance Aura**: allies +20/35% all Elemental Resistances (thừa khi đã cap res, giá trị nằm ở đàn khi chạy map mod elemental).
- **Hinder Aura** (enemy gần 30% reduced Movement Speed) + **Healing Nova** (allies regen 10% life/2s) — hạng hai, chỉ giữ khi đi kèm con đã có aura chính.

Thứ tự: Extra Physical/Haste → Energy Shield/Invulnerability → Temporal Bubble → Elemental Resistance cuối. Con mang 2 aura đáng giữ → nhảy đầu hàng đợi bất kể reservation (1 body tiết kiệm cả spirit + gem slot).

## Con nhanh không roll Haste

- Haste không spawn trên con tag `very_fast_movement` (game cấm con vốn nhanh roll thêm mod tăng tốc).
- poe2db xác nhận :wiki-link{url="https://www.poe2wiki.net/wiki/Crag_Leaper"} mang tag đó → rẻ thứ nhì (23.1%) nhưng vĩnh viễn không gánh Haste.
- Field-confirmed cấm Haste: Hyena Demon, Swarming Wasp, Quadrilla. Vẫn roll mọi T1 aura khác.
- Hệ quả: Haste phải lấy từ base chậm — tiện nhất là crab ở Whakapanu. Settle Haste với crab trước rồi mới nhặt aura khác trên con nhanh rẻ.

## Bảng reservation và chỗ farm

Reservation đọc thẳng trên monster, **cố định theo base** (tier/area level không đổi số) — farm zone nào dễ nhất còn ra đúng base. Field data 1000+ map; số chốt là dòng reservation trong client. Vị trí đã sửa về nhãn 0.5 (0.4 ghi "Act 5" — 0.5 không có Act 5, là Interlude 2/3, area lvl 54–56).

| Con | Reservation | Zone | Haste? |
|---|---|---|---|
| :wiki-link{url="https://www.poe2wiki.net/wiki/Swarming_Wasp"} | 21% | :wiki-link{url="https://www.poe2wiki.net/wiki/Ashen_Forest"} (Interlude 3, lvl 54), essence, vào từ town The Glade | ✗ |
| Bloodthief Wisp | 21% | Qimah (Interlude 2), cực hiếm trong essence | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Crag_Leaper"} | 23.1% | :wiki-link{url="https://www.poe2wiki.net/wiki/Vastiri_Outskirts"} (Act 2, lvl 16), essence | ✗ (very_fast) |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Porcupine_Crab"} | 24.9% | :wiki-link{url="https://www.poe2wiki.net/wiki/Whakapanu_Island"} (Act 4, lvl 46), essence+rare. Nameplate ghi Quill Crab | ✓ mọi T1 |
| Coconut Crab | 24.9% | Whakapanu (Act 4) | ✓ |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Bramble_Ape"} | 24.9% | :wiki-link{url="https://www.poe2wiki.net/wiki/Kriar_Village"} (Interlude 3) | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Rasp_Scavenger"} | 26.7% essence / 32.7% rare | :wiki-link{url="https://www.poe2wiki.net/wiki/The_Khari_Crossing"} (Interlude 2, lvl 54) | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Winged_Fiend"} | 26.7% | Qimah (Interlude 2, lvl 56), essence | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Sabre_Spider"} | 28.2% | :wiki-link{url="https://www.poe2wiki.net/wiki/Mastodon_Badlands"} (Act 2) | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Hyena_Demon"} | 30% | Vastiri Outskirts (Act 2), essence rare | ✗ |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Mantis_Rat"} | 30% | :wiki-link{url="https://www.poe2wiki.net/wiki/Mawdun_Mine"} (Act 2) | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Chaw_Mongrel"} | 30% | :wiki-link{url="https://www.poe2wiki.net/wiki/The_Azak_Bog"} / The Matlan Waterways (Act 3) | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Slitherspitter"} | 31.2% | :wiki-link{url="https://www.poe2wiki.net/wiki/The_Venom_Crypts"} (Act 3) | — |
| Caustic Crab | 32.1% | Whakapanu (Act 4), cùng đảo Quill/Coconut → lọc base | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Bane_Sapling"} | 33.3% | :wiki-link{url="https://www.poe2wiki.net/wiki/Jungle_Ruins"} (Act 3), rare hiếm | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Diretusk_Boar"} | 39% | :wiki-link{url="https://www.poe2wiki.net/wiki/Infested_Barrens"} (Act 3), guaranteed. Build giữ vì 1 body gánh Haste + All Damage Shocks | ✓ |
| Antlion | 42.3% | Infested Barrens (Act 3), guaranteed | — |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Quadrilla"} | 42.3% | Jungle Ruins (Act 3), rare hiếm | ✗ (roll mọi T1 khác) |

Hạng 39%+ chỉ lấy khi con đó gói 2 giá trị.

## Săn bằng essence reset

- Essence encounter overworld: rare bị :wiki-link{url="https://www.poe2wiki.net/wiki/Essence"} giam hiện 2-3 modifier đọc trước khi thả → soi loại beast, reservation, aura trước khi cam kết.
- Vào zone quét essence; không có → reset instance ngay, đừng dọn. Con essence đầu gần như khoá base cả chuỗi (~90% reset sau ra đúng con — quan sát thực địa, chưa nguồn chính thức, log lại); sai base → đổi zone. Có aura mục tiêu → wisp rồi giết khi wisps còn dán; không → reset.
- Reset: zone có waypoint → về town, Ctrl+left-click tên zone. Zone Interlude không waypoint (Ashen Forest) → Alt+left-click cửa vào zone.
- ✗ Đàn DPS cao giết beast trước khi wisps bám đủ → **tắt minion trước khi wisp** (build cấm weapon-swap: swap để despawn đàn rồi Tame). ✓ mang :wiki-link{url="https://www.poe2wiki.net/wiki/Prolonged_Duration"} II trên gem Tame Beast nới cửa sổ wisp. Essence có thể đổi chỗ giữa reset — đảo một vòng trước khi reset tiếp.

## Route ba chặng

Mục tiêu: gom 2-3 aura T1 đầu bảng, không phải cả 8.

- **Chặng 1 Whakapanu (Act 4)**: essence crab bãi biển đầu map, target Quill + Coconut 24.9%. Lấy **Haste Aura trên bất kỳ crab nào** trước; aura T1 khác tiện thì giữ.
- **Chặng 2 Ashen Forest (Interlude 3)**: target Swarming Wasp 21%, giữ **bất kỳ aura T1 trừ Haste**. Để mắt Sabre Spider 28%.
- **Chặng 3 Vastiri Outskirts (Act 2)**: Crag Leaper 23.1% qua essence (aura ngoài Haste); Hyena Demon 30% cùng zone tuỳ chọn. Bắt đầu mix — trùng aura thì giữ bản chặng 2/3 (base hiếm hơn), đẩy crab chặng 1 farm lại. Thiếu aura → Rasp Scavenger 26.7% ở Khari Crossing (Interlude 2).
- Đi theo zone vì encounter rate do số **loại monster** chia chung pool essence zone. Pool mỏng → con mục tiêu hiện liên tục (Whakapanu/Ashen Forest/Vastiri); tránh zone density cao nhiều loại (Crematorium, Kaom's Village — có khi 50 reset).

## Anti-patterns

- ✗ Field nhiều con cùng loại → companion giới hạn **1 con mỗi loại** cùng lúc; zoo bắt buộc đa dạng base.
- ✗ Tính uptime aura = 100% → aura phủ "nearby" quanh bot, AI companion tản theo combat, uptime thực <100%. Quan sát icon buff 1 session T15.
- ✗ Vứt con tame hỏng khi nó chiếm gem đã đầu tư → disenchant gem Tame Beast ở vendor để clear con lưu, lấy lại gem trắng giữ level/quality/socket. Thủ 1 gem rẻ làm standby soi mod.
- ✗ Cắt gem L20 cho aura bot → bot không ăn tier damage gem cao, dùng Uncut Skill Gem **L19** (chênh L19↔L20 vài div cho 0 giá trị). Quality thì đáng: mỗi 20% quality = 10% Reservation Efficiency, :wiki-link{url="https://www.poe2wiki.net/wiki/Gemcutter%27s_Prism"} áp sau capture.

## Version History

### Patch 0.5.2
Reservation base + pool aura giữ nguyên 0.5.0→0.5.2; patch không đụng essence reset/tame. Số reservation field-measure từ 0.4 vẫn khớp 0.5. Thay đổi duy nhất ảnh hưởng doc: nhãn vị trí (0.4 "Act 5" cho Ashen Forest/Qimah/Khari Crossing/Kriar Village → 0.5 là Interlude 2/3, area lvl 54–56). Haste không spawn con `very_fast_movement` là cơ chế spawn theo tag, không phải nerf patch.

## Relationships

- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — pipeline tame nền: modifier retention, on-screen lock, disenchant, Untainted Paradise cho volume.
- **used_by** [Aura Bot Zoo Spirit Walker](/builds/huntress/0-5-spirit-walker-aura-bot-zoo) — nhánh đổi spirit lấy aura bot, dùng bảng reservation + route này.
- **used_by** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — roster live 4 aura bot (Diretusk Haste, Coconut Crab Extra Phys, Adorned Scarab ES, Swarming Wasp Invulnerability).
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — league 0.5 mở Spirit Walker, Tame Beast, essence encounter.

## Resources

- [Mattjestic — Ultra Rare Beast Companion Farming Guide](https://mobalytics.gg/poe-2/profile/mattjestic-multigaming/guides/new-0-4-ultra-rare-beast-companion-farming-guide) — bảng reservation 1000+ map + route ba chặng (nhãn act 0.4, đã sửa về Interlude 0.5).
- [Mattjestic — Rare Companion Spirit Cost & Locations](https://www.youtube.com/watch?v=zuoSLaKXLNE) — field data reservation theo base, spot Ashen Forest + Whakapanu.
- [Community Spectre Cost Spreadsheet](https://docs.google.com/spreadsheets/d/1oadXSCHczpyCgRxzTk3nRBeeOLlefZAzKM3ijwmWevY/htmlview?gid=0#gid=0) — tra cost spectre làm pre-filter reservation.
