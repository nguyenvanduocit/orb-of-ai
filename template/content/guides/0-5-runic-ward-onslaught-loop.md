---
template: templates/mechanic-template.md
document_type: mechanic
title: Runic Ward Onslaught Loop cho Minion
status: published
author: duocnv
created: '2026-06-02'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
confidence_level: MEDIUM
tags:
  - runic-ward
  - low-runic-ward
  - onslaught
  - minion
  - companion
  - spirit-walker
  - verisium-manifestations
  - warding-rune-of-bodyguards
  - blasphemy
  - repulsion
  - olroths-resolve
  - 0-5
  - 0-5-1
  - poe2
---

# Runic Ward Onslaught Loop cho Minion

Cách cấp :wiki-link{url="https://www.poe2wiki.net/wiki/Onslaught"} cho cả đội companion bằng pool :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"}: cố tình giữ **Low Runic Ward**, một sceptre rune biến trạng thái đó thành Onslaught vĩnh viễn cho minion trong presence. Cắt 4 hệ: :wiki-link{url="https://www.poe2wiki.net/wiki/Verisium_Manifestations"} (Kalguuran skill rút ward) + :wiki-link{url="https://www.poe2wiki.net/wiki/Warding_Rune_of_Bodyguards"} (rune đổi Low Ward → Onslaught) + pool Runic Ward (nhiên liệu) + tuỳ chọn :wiki-link{url="https://www.poe2wiki.net/wiki/Repulsion"} qua :wiki-link{url="https://www.poe2wiki.net/wiki/Blasphemy"} (rảnh tay).

Verdict: loop chạy thật (mọi mắt verify) nhưng **cách cấp Onslaught tệ nhất** — chỉ hợp khi roster thiếu mọi nguồn Onslaught khác. [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack) cấp Onslaught qua gloves rune **Carved Majesty** (Onslaught 4s khi hit Marked, Voltaic Mark giữ uptime ~100% boss) rẻ hơn, không hi sinh lớp đệm 1-life → ward-drain là alt-path đã xét, không dùng. Đáng lấy khi **không còn nguồn Onslaught khác VÀ đang Low Runic Ward vì lý do sẵn có** (roster chưa sắm marks gloves lẫn parry buckler); lúc đó skill self-clear (Hollow Shell hoặc Spear Stab + Runic Confusion) vốn rút ward → bật Onslaught chỉ tốn 1 slot rune.

## Cơ chế: đòn attack của chính pilot rút ward

- VM gate verbatim: "While active, Hitting with an Attack will spend Runic Ward to summon a Verisium Manifestation, a short-lived Temporary Minion that rapidly Attacks nearby enemies, ignoring commands." Chủ ngữ ngầm = **người chơi**. Pilot zoo vung Twister/Spear Throw (đều Attack) → mỗi đòn thoả gate trực tiếp.
- VM tiêu **7–30 Runic Ward/summon**, cooldown 0.50s, max 10 manifestation, mỗi con sống 8s → kéo pool ward tụt. Ward **≤35% maximum** = Low Runic Ward (verbatim) → Warding Rune of Bodyguards bật: "Minions in your Presence have Onslaught while you are on Low Runic Ward". Cả đội companion trong presence ăn Onslaught.
- Không cần Repulsion/Blasphemy. Verify chắc: VM gate + ward cost (7–30), Bodyguards key vào **người chơi** (không phải minion), ngưỡng 35%, Runic Ward hồi 5%/giây độc lập life. Warding Rune of Bodyguards = sceptre rune, Requires Level 45, Limited to 1.

## Đường rảnh tay Repulsion — thừa + 1 mắt chưa test

- Chỉ nghĩa cho pilot **không** tự đánh: minion đánh enemy dính Repulsion → Repulsion là hex (Blasphemy-compatible, không phải Mark), gắn Blasphemy phủ Fragility thành aura (60 Spirit/curse). "Hitting these enemies causes the Curse to Trigger an explosion" — hit lên cursed-target nổ Repulsion Wave ("Physical Attack damage in an area around the Cursed target"). Repulsion Wave là Attack → về lý thuyết thoả gate VM. 0.5.1 thêm base Critical Strike Chance 6%.
- ⚠ **chưa test**: VM kích bằng "Trigger Manifest Rune on Hitting with an Attack" — 1 trigger; Repulsion Wave cũng là skill được trigger. Attack đã-trigger có kích tiếp Manifest Rune không = câu hỏi trigger-chain, datamine không trả lời, đo client. Dù chạy vẫn **thừa** với build pilot còn vung skill attack (Twister thoả trực tiếp). Blasphemy + Repulsion chỉ phục vụ build AFK thật, đúng lúc đó tựa mắt chưa test.

## Onslaught cộng additive, biên mỏng

- Onslaught 0.5 = "20% increased Skill Speed and 10% increased movement speed". Skill Speed cộng dồn **additive** cùng bucket với increased Attack/Cast Speed minion (không phải more-multiplier).
- Gần trùng buff zoo đã có: Boar rare roll aura Haste-tương-đương ("Allies in Presence 20% increased Attack and Cast Speed + 10% movement speed") gần identical + Commanding Rage (2% inc Minion Attack Speed/5 Rage) + Snake Idol (10% inc Attack Speed) đổ cùng bucket. Nhồi +20% vào bucket ~50%+ → uplift biên thực **~11–15%**, phần lớn redundant. Cộng additive chắc; ~11–15% ước lượng bucket giả định, đo lại.

## Năm nguồn Onslaught (loop này tệ nhất)

- **Gloves** "Companions gain Onslaught for 4 seconds on Hitting your Marked targets" — build chạy Sniper's/Charged Mark, gần miễn phí, không đụng ward; mượt nhất single-target/boss, spottier lúc clear pack rời.
- **Bucklers** "companions gain Onslaught when you parry" — Reputation auto-parry (buckler) gần liên tục → Onslaught đều clear + boss, không đụng ward (anchor "đã có" chắc nhất).
- "Companions have 50% chance to gain Onslaught on Kill" — gần permanent lúc clear.
- **Sceptres** "Minions in your Presence have Onslaught while you are on Low Runic Ward" — Warding Rune of Bodyguards (loop này).
- "Companions in your Presence have Onslaught while you are Shapeshifted" — đường Druid.
- Bodyguards là cái **duy nhất** bắt đánh đổi lớp đệm 1-life + (rảnh tay) đốt 30–90 Spirit. Marks gloves/parry buckler cho gần đúng buff không hi sinh → loop chỉ hợp khi roster thiếu cả hai; lúc đó là nguồn Onslaught **chính**, giá còn lại 1 slot rune + chạy ward cạn.

## Sustain và uptime

- Ward hồi 5%/giây **của max pool** → giữ ≤35% là breakpoint, không mặc định. VM tiêu 7–30 ward/summon cd 0.5s, drain không full 2 summon/giây mãi: limit 10 manifestation, mỗi con 8s.
- ⚠ đầy 10/10 → hành vi cap chưa test: VM **block** (ngừng tiêu ward) hay **thay con cũ nhất** (tiếp tục tiêu)?
  - Thay con cũ nhất → drain giữ nhịp, ward ghim dải thấp, Onslaught up bền khi còn đánh.
  - Block → drain rớt xuống nhịp hết-hạn (~10 con/8s ≈ 1.25 summon/giây → ~9–37 ward/giây) đua với regen (pool 200 hồi 10/giây, pool 300 hồi 15/giây). Gem cost thấp (~7–9) + pool to → regen thắng, ward leo qua 35%, Onslaught chập chờn. Nghịch lý: **stack thêm max Runic Ward làm loop khó nuôi hơn** (regen tuyệt đối nhanh hơn). Equilibrium ở breakpoint ward-cost-per-summon (gem level) vs 5%-max-pool, đo client.
- Grace khi ngừng đánh: ward leo 5%/giây, đáy → quá 35% mất ~7 giây, dodge-phase 2–3 giây không drop.

## Chi phí phòng thủ thật: ward ≤35% suốt trận

- Giữ Onslaught on = giữ ward ≤35% suốt trận. Runic Ward là lớp chót (kích khi life chạm 1, hồi 5%/giây độc lập, đệm cứu-mạng-cuối). Rút xuống dải thấp = chạy đệm gần rỗng đúng lúc cày DPS boss dài — lúc một cú one-shot cần ward đầy nhất. Build không HC-safe = survivability cost thật.
- ✗ bẫy 0.5.1: :wiki-link{url="https://www.poe2wiki.net/wiki/Olroth's_Resolve"} flask "Regenerate 2.5-5% of maximum Runic Ward per second during Effect" (rework live từ 0.5.0, patch note 0.5.1 mới ghi) đi ngược loop (bơm ward vượt ngưỡng, rớt Onslaught). Đừng đội với ward-drain; đối nghịch với cách [Refutation](/guides/refutation) cần ward đầy để đốt.
- Giữ ward thấp **không** mất stun threshold: 0.5 gỡ Runic Ward khỏi keyword "Defences" (chỉ Armour/Evasion/ES), stun threshold key theo Life/ES. Dòng Bonded của Bodyguards ("Damage of Enemies Hitting you is Unlucky if your Runic Ward has been damaged Recently") chỉ bù 1 phần, kích *sau khi* ward đã ăn damage.

## Spirit accounting

- Rảnh tay đầy đủ: Blasphemy 60 + Verisium Manifestations 30 = 90 Spirit raw. Cả hai non-Companion → dưới keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Trusted_Kinship"} (rework 0.5: "30% more Reservation Efficiency of Companion Skills, 20% less Reservation Efficiency of non-Companion Skills", gỡ 2 dòng defence cũ) ăn phạt 20% → effective ~112.5 Spirit (60/0.8=75, 30/0.8=37.5).
- Đường thật (VM một mình, đòn attack pilot rút ward): 30 Spirit raw → 37.5 effective, bỏ Blasphemy + Repulsion + mắt chưa test. Vẫn phải cân với parry buckler/marks gloves gần miễn phí.

## Failure Modes

- **Redundant với nguồn Onslaught bản carry sẵn** — parry buckler + marks gloves không đụng ward; on-kill 50% phủ clear. Lấy Bodyguards = trả slot rune + 90 Spirit (bản full) đổi ~0 lợi ích ròng. KHÔNG áp bản zoo no-weapon-swap (không parry/marks → không redundant, engine Onslaught chính).
- **Đánh đổi phòng thủ thật** — Onslaught up = ward ≤35% suốt trận = đệm 1-life gần rỗng đúng lúc boss cày DPS dài.
- **Onslaught biên mỏng** — ~11–15% additive sau khi Haste-tương-đương + Commanding Rage + Snake Idol đã lấp bucket.
- **Đường rảnh tay tựa mắt chưa test** — trigger-chain "Repulsion Wave (đã trigger) → kích Manifest Rune" chưa xác nhận; dù chạy vẫn thừa.
- **Spirit floor** — full combo 112.5 effective trên build spirit-capped đắt cho buff thừa; lõi VM 37.5 vẫn cạnh tranh nguồn miễn phí hơn.

## Test plan

Đo client trước khi commit currency + respec (PoB2 không model pool Runic Ward, companion AI, VM trigger, Spirit Walker bonus):

1. **Trigger-chain Repulsion**: Repulsion Wave (skill đã trigger) kích được VM không? Cất Twister, chỉ minion đánh enemy dính Repulsion, xem manifestation có summon.
2. **Blasphemy + Repulsion**: curse áp qua Blasphemy aura có vẫn nổ Repulsion Wave khi hit cursed-target, hay chỉ phủ Fragility mất phần trigger.
3. **Onslaught uptime so sánh**: glove "on Hitting Marked" + buckler "on parry" (đã có) vs Bodyguards-via-ward — nguồn nào ổn hơn mà không chạy ward cạn.
4. **Hành vi cap + ward equilibrium**: VM 10/10 block hay thay con cũ nhất; với gear thật (max ward + ward cost efficiency từ boots) dải ward in-combat, breakpoint ward-cost-per-summon vs 5%-max-pool, stretch không-đánh bao lâu Onslaught tắt.

## Version History

### 2026-06-09 — fold 0.5.1
- 0.5.1 (05/06) không động lõi loop: Verisium Manifestations, Warding Rune of Bodyguards, Onslaught, Trusted Kinship + reservation efficiency giữ nguyên. Fix 1 crash "Number of shared states is different on client and server" do Unique Tamed Beast (đỡ cho build companion).
- Repulsion Triggered Wave thêm base Critical Strike Chance 6% (0.5.1) — không đổi câu hỏi trigger-chain.
- Thêm cảnh báo Olroth's Resolve (rework live từ 0.5.0, patch note 0.5.1 mới ghi) regen 2.5-5% maximum Runic Ward/giây đi ngược loop.
- VM cap behavior + trigger-chain Repulsion vẫn để ngỏ (test plan).

### 2026-06-03 — verification pass
- Verify verbatim từ poe2db.tw + patch note 0.5.0: VM gate + cost (7–30) Ward + 30 Spirit + 0.5s cd + limit 10 + 8s; Warding Rune of Bodyguards (Lvl 45, Limited 1); Runic Ward hồi 5%/giây; Onslaught 20% Skill Speed / 10% move (additive attack/cast speed); Trusted Kinship -20% non-Companion reservation.
- Resolve: **Low Runic Ward = 35% maximum trở xuống** + Runic Ward 5%/giây.
- Bỏ giả định sai: "Curse does not apply to enemies above level" là cơ chế chung mọi curse 0.5 (Despair/Enfeeble cùng scale 20→78), không phải lỗi riêng Repulsion.
- Reframe: loop chạy bằng đòn attack pilot (Twister thoả gate trực tiếp), đường minion→Repulsion thừa + mắt trigger-chain chưa test. Cost thật là chạy buffer 1-life ≤35% suốt fight.
- Verdict: ≥5 nguồn cấp companion Onslaught 0.5, build đã có parry-buckler + marks-gloves → loop là cách tệ nhất, chỉ đáng khi thiếu mọi nguồn khác.

### 2026-06-02 — bản đầu
- Research-derived từ tech Joespresso (Verisium Manifestation, 2026-05-31), front-load mắt xích trigger chưa chắc + Twister-confound, hạ Onslaught xuống additive ~11–15%, tách chi phí phòng thủ (pool 1-life) khỏi stun threshold.

## Relationships

- **related_builds** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build đã xét loop này và không dùng: Carved Majesty gloves cấp Onslaught qua Marked target rẻ hơn. Loop chỉ còn nghĩa cho roster chưa có marks gloves.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Runic Ward / Runeforging / Kalguuran skill mà loop khai thác.
- **farming_relevance** [Remnant Runeforging Crafting Loop](/farming/0-5-remnant-runeforging-profit-loop) — Verisium farm từ loop nuôi Runeforging gắn Runic Ward cho build defensive.
- **related_mechanics** [Olroth's Resolve](/guides/olroths-resolve) — cơ chế + cách stack Runic Ward; Ward ceiling quyết định Guard value.
- **related_mechanics** [Refutation — Runic Ward Block Buff Skill](/guides/refutation) — chung hệ Runic Ward; loop giữ ward thấp thụ động (không feed stun threshold), Refutation đốt ward đổi bonus stun threshold tạm thời — hai cách dùng ngược một pool.
