---
template: templates/build-template.md
document_type: build
title: Pathfinder Herald of Ice Bow
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
class: Ranger
ascendancy: Pathfinder
league: '0.5'
patch: 0.5.3
budget_tier: low-budget
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Lightning Arrow
  damage_type: Lightning/Cold
  playstyle: Bow / Projectile
  content_focus: Map clear / Atlas farming
tags:
- poe2
- ranger
- pathfinder
- lightning-arrow
- herald-of-ice
- barrage
- bow
- shatter
- mapping
---

# Pathfinder Herald of Ice Bow

Clear map nhanh nhất league: :wiki-link{url="https://www.poe2wiki.net/wiki/Lightning_Arrow"} từng loạt (shock + chill) → :wiki-link{url="https://www.poe2wiki.net/wiki/Herald_of_Ice"} biến mỗi shatter thành nổ lạnh quét màn. :wiki-link{url="https://www.poe2wiki.net/wiki/Pathfinder"} = flask uptime + evasion→elemental damage reduction. Ladder: Pathfinder 18.7% (đông thứ hai), tăng nhanh nhất. Hợp bắn-và-chạy, ưu tiên farm > boss, entry rẻ.

## Build Overview

- **Damage:** Lightning Arrow chuyển 80% physical thành lightning ở skill, bắn một mũi rồi nảy lightning beam sang 2–4 enemy gần. Scale bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Shock"}, lightning penetration, curse. Cùng cú bắn cộng ít cold → mọi enemy trúng bị :wiki-link{url="https://www.poe2wiki.net/wiki/Chill"}
- **Clear engine:** :wiki-link{url="https://www.poe2wiki.net/wiki/Polcirkeln"} cho enemy bị Chill được :wiki-link{url="https://www.poe2wiki.net/wiki/Shatter"} như thể Frozen → chỉ cần chill, không cần freeze buildup. Kill enemy đang chill → shatter → Herald of Ice proc → nổ lạnh dội lên pack
- **Burst:** :wiki-link{url="https://www.poe2wiki.net/wiki/Barrage"} không phải skill bắn — buff nạp một loạt tên, khiến cú bắn Barrageable tiếp theo Repeat thêm 2 lần + 1 lần mỗi :wiki-link{url="https://www.poe2wiki.net/wiki/Frenzy_Charge"} tiêu thụ. Mỗi mũi là hit riêng shatter + proc Herald of Ice
- **Defense:** evasion cao né đòn + Pathfinder đổi một nửa evasion thành elemental damage reduction + flask hồi liên tục

## Vòng shatter của Herald of Ice

- Điều kiện proc: shatter một enemy bằng non-Herald attack hit. Shatter = giết enemy Frozen — hoặc Chill nếu có Polcirkeln. Nổ deal cold attack damage bán kính 1.6m + radius theo quality gem. Herald of Ice reserve 30 Spirit + yêu cầu martial weapon (bow)
- **Giới hạn 1:** nổ Herald of Ice không tự gây freeze buildup → không tự tạo điều kiện shatter cho chính nó
- **Giới hạn 2:** on-shatter Herald skill không trigger từ kill do Herald skill gây ra → nổ Herald giết enemy khác không đẻ nổ mới. Loop vô hạn không tồn tại
- Sức mạnh = số shatter do đòn bắn tạo ra trong một khoảnh khắc (Barrage nhả nhiều mũi, mỗi mũi giết một enemy đang chill = một nổ). Pack đông = nhiều nổ đồng thời, không phải một nổ tự nhân
- Hai thứ quyết định clear: độ phủ chill + sát thương kill-trong-lúc-chill. Lightning Arrow nảy beam → chill lan nhanh; một nguồn cold nhỏ trên gear đủ để mọi hit chill
- :wiki-link{url="https://www.poe2wiki.net/wiki/Ice-Tipped_Arrows"} = burst on-demand: empower 4 đòn bắn tiếp theo convert physical sang cold + tạo Ice Fragment khi hit → cửa sổ freeze nặng. Cooldown 12 giây, bypass bằng tiêu một Frenzy Charge

## Skill Gems & Links

- **Main link Lightning Arrow.** Support ưu tiên: projectile/chain (phủ pack rộng) → :wiki-link{url="https://www.poe2wiki.net/wiki/Lightning_Penetration"} (xuyên lightning res, nhân mạnh khi đi cùng curse) → support tăng damage tổng → support flat cold / tăng cold (chill chắc)
- `Exclusion check:` tránh :wiki-link{url="https://www.poe2wiki.net/wiki/Cold_Attunement"} ở main link — kèm "50% less fire and lightning damage" = cắt thẳng damage chính của skill lightning-primary. Chỉ dùng nếu chuyển hẳn cold-primary
- Herald of Ice riêng, reserve 30 Spirit. Dư Spirit → :wiki-link{url="https://www.poe2wiki.net/wiki/Deadly_Herald"} (30% more damage lên phần nổ; "more" nhân thẳng — một trong số ít more multiplier build chạm tới)
- Barrage ở slot riêng, bấm trước pack đông / rare/boss. Ice-Tipped Arrows buff slot riêng cho cold burst. Cả hai buff empower cú bắn Barrageable kế tiếp, KHÔNG xung đột → stack cả Barrage + Ice-Tipped lên cùng loạt
- :wiki-link{url="https://www.poe2wiki.net/wiki/Sniper's_Mark"}: mark mục tiêu, crit kế tiếp tiêu mark → cộng crit damage + trả lại một Frenzy Charge (nuôi repeat Barrage) → tăng burst single-target + khép vòng charge
- :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"}: hạ -40 đến -59% elemental resistance cả vùng (ăn cả lightning + cold) = multiplier rẻ nhất. Curse 0.5 giới hạn theo level mục tiêu → cần level gem đủ cao / +curse level để bám map boss + pinnacle

## Ascendancy Pathfinder

- Không cho damage trực tiếp, cho nền chạy mượt
- **Enduring Elixirs** (life flask effect không huỷ khi life đầy, không xếp hàng chờ) + node tăng flask charge → life flask thành nguồn hồi liên tục
- **Skill Speed node:** tăng tốc mọi skill; POE2 Skill Speed là chỉ số riêng tách attack speed → cộng dồn, không giẫm chân
- **Sustainable Practices:** 50% Evasion Rating cũng cho elemental damage reduction → lớp giảm ele miễn phí (lý do Pathfinder bow sống dai hơn Deadeye thuần evasion). Evasion node ascendancy nuôi thẳng lớp này
- **Path of the Sorceress:** mở 4 điểm + lối sang Sorceress start (cụm cold/lightning)
- **Overwhelming Toxicity:** node poison — build không đi poison → bỏ qua

## Chỉ số và phòng thủ

- Profile ladder điển hình: life thấp ~1,500 + energy shield 3,000–6,000 + EHP 28k–45k (phần lớn từ evasion + elemental reduction Sustainable Practices). Build né + giảm, không tank máu
- Cap elemental resistance 75% bắt buộc trước damage; chaos res sau cùng
- :wiki-link{url="https://www.poe2wiki.net/wiki/Nascent_Hope"}: một Thawing Charm, tự kích khi Frozen → freeze immunity 3 giây + khởi động lại Energy Shield Recharge khi proc. Đóng lỗ chết-vì-freeze của character life thấp. Rẻ → core
- **0.5.3 Staunch Deflection:** thêm Deflection Rating = 8% Evasion Rating. Cluster ở Ranger-adjacent, từ start Ranger ~16 hop (ngắn hơn Huntress ~20 hop). Evasion floor 6,000-9,000 → +480 đến +720 Deflection Rating. **Verify path Pathfinder có chạm Staunch Deflection trong 2-3 điểm detour không trước khi commit;** chạm thì pickup ngay
- **DPS:** không chốt số tổng — PoB2 0.5 chưa model trigger shatter Herald of Ice + cửa sổ convert Ice-Tipped Arrows; nhãn DPS-theo-skill poe.ninja gắn nhầm Pathfinder bow sang skill khác. Chuỗi scale: base hit Lightning Arrow (80–250% theo gem level) × increased lightning/elemental (cây + gear) × -res Elemental Weakness + lightning penetration; mỗi loạt Barrage cộng repeat (mỗi repeat 50% less — multiplier giảm — nhưng hit riêng nên vẫn shatter + proc Herald of Ice). Nổ Herald of Ice = cold attack damage riêng scale theo cold/attack modifier. Vào league materialize PoB2, đo DPS thực Lightning Arrow hit + nổ Herald of Ice riêng, log lại → chốt breakpoint gem level + quality

## Gear theo slot

Ưu tiên cap resistance trước, rồi damage. Thứ tự từ rẻ nhất:

- **Ring 1 — Polcirkeln (~1 ex):** enabler cả clear engine — "enemies Chilled by your Hits can be Shattered as though Frozen". Kèm cold damage + cold res. Cắm là build chạy
- **Ring 2 — :wiki-link{url="https://www.poe2wiki.net/wiki/The_Taming"} (~5 div = 658 ex):** Prismatic Ring, all-ele res + "10–20% increased Damage for each type of Elemental Ailment on Enemy". Build gây shock + chill → tối thiểu hai ailment → cố tình giữ cả hai element. Món chase chính; trước đủ tiền dùng rare ring cap res + flat lightning/cold
- **Boots — :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Step"} (~1 ex):** 30% movement speed, 80–120% increased evasion, +70–100 life, deflection = 40–60% evasion rating
- **Gloves — :wiki-link{url="https://www.poe2wiki.net/wiki/Lochtonial_Caress"} (~1 ex):** 10–15% Skill Speed + life (Skill Speed là chỉ số riêng → cộng thẳng tốc độ bắn). Dùng leveling → đầu endgame; sau thay rare gloves cap res nếu cần lỗ res
- **Bow:** rare bow = nơi đổ ngân sách damage — flat lightning/cold added, tăng attack/projectile/skill speed, crit nếu đi crit. Khác biệt lớn nhất league-start vs đầu tư
- **Jewel — :wiki-link{url="https://www.poe2wiki.net/wiki/Heart_of_the_Well"} (~5 ex):** Diamond jewel mod desecrated, 53% ladder cắm — attack speed, pierce, hoặc mod tấn công mạnh
- **Amulet / Helm / Body / Belt:** rare — cap res, life/ES, dex, lấp lỗ ailment chance / damage thiếu. Body evasion base nuôi Sustainable Practices
- Món đắt nhất nhóm meta: :wiki-link{url="https://www.poe2wiki.net/wiki/Rite_of_Passage"} (~27 div) — usage 13%, giá cao vì cung siết. Không bắt buộc; mục tiêu cuối min-max

## Flask và charm

- :wiki-link{url="https://www.poe2wiki.net/wiki/Lavianga's_Spirits"} (~9 ex): mana flask không bấm được, áp dụng hiệu ứng liên tục với lượng hồi giảm bớt = mana regen vĩnh viễn chiếm một slot. Giải quyết sustain Lightning Arrow + Barrage
- Slot life flask còn lại hồi burst, Enduring Elixirs giữ hiệu ứng không gián đoạn
- Nascent Hope (~8 ex): charm slot, freeze immunity + đạp ES recharge
- Ba món Polcirkeln + Lavianga's Spirits + Nascent Hope < 20 ex mà gánh enabler clear + hai lớp sustain → build rẻ bất thường để khởi động

## Failure Modes

- **Single-target/boss yếu hơn clear nhiều:** engine xoay shatter pack đông; boss đơn không có gì shatter chồng → damage tụt về mỗi Lightning Arrow hit + burst Barrage. Pinnacle + map boss cứng lâu hơn hẳn. Sniper's Mark + Ice-Tipped Arrows giúp burst nhưng không bù hết
- **Map mod đánh thẳng engine:** "Monsters cannot be Frozen/Chilled" = tắt clear engine (không chill = không shatter = Herald ngừng proc → còn Lightning Arrow thuần) · "Less elemental ailment effect" → chill khó bám · "Monster elemental resistance" pha loãng cả lightning + cold. Skip / chạy chậm
- **One-shot vào character life thấp:** EHP 28k–45k phần lớn từ evasion = phòng thủ xác suất. Đòn không né được (boss slam / porcupine) xuyên khi life ~1,500. Freeze giữa pack = kiểu chết kinh điển — Nascent Hope đóng lỗ nhưng vẫn tôn trọng pattern boss
- **Ngưỡng gear:** bản <~20 ex (ba enabler core + rare cap res) clear act + map thấp ổn nhưng damage mỏng; map cao cần rare bow tử tế + The Taming (~5 div). Dưới ngưỡng chơi được, chậm hơn rõ
- **Nhạy nerf shatter + Herald:** clear dựa chill đủ rẻ để shatter (Polcirkeln) + Herald of Ice proc mỗi shatter. Patch siết điều kiện shatter / đổi cơ chế Polcirkeln / hạ damage nổ Herald of Ice → engine yếu rõ. Rủi ro patch lớn nhất

## Verdict

Một trong lựa chọn league-start tốt nhất 0.5 cho farm map tốc độ cao không đổ tiền: ba enabler core < 20 ex đủ engine chạy, phần còn lại scale bằng rare bow + The Taming. Đổi lại: single-target tầm trung + character mỏng máu cần chơi tỉnh táo. Hợp bắn-và-chạy + ưu tiên currency-per-hour. Ngưỡng map cao đúng mô tả: rare bow ổn + The Taming; dưới mức vẫn vui nhưng chậm hơn.

## Changelog

### 2026-06-19
- Patch 0.5.3: Staunch Deflection thêm Deflection Rating = 8% Evasion Rating. Cluster Ranger-adjacent, từ start Ranger ~16 hop. Pathfinder bow evasion floor 6-9k → +480 đến +720 Deflection Rating nếu chạm cluster (layer rẻ). Cần verify path tree thực tế có chạm Staunch Deflection trong 2-3 điểm detour trước khi commit

### 2026-06-10
- Bản đầu cho 0.5.0 Runes of Aldur. Engine Lightning Arrow + Herald of Ice shatter qua Polcirkeln, nền Pathfinder flask/evasion. Số meta snapshot poe.ninja runesofaldur 2026-06-10 (Pathfinder 18.7%, Herald of Ice 30.9%, Barrage 23.4%). Giá gear poe2scout 2026-06-10. DPS tổng chưa materialize trong PoB2 — cần đo khi vào league

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview league Runes of Aldur
- **references** [Herald of Ice Shatter](/guides/herald-of-ice-shatter) — cơ chế nổ shatter cốt lõi của clear engine
- **related_guides** [Kỹ thuật positioning cho bow build](/guides/0-5-bow-positioning) — positioning/di chuyển cho playstyle bắn-và-chạy
- **alternative_to** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — engine spear cận chiến thay bow, cùng tầm meta
