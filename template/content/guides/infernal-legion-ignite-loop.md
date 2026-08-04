---
template: templates/mechanic-template.md
document_type: mechanic
title: Infernal Legion Ignite Loop
status: published
author: duocnv
created: '2026-05-19'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: skills
tags:
  - infernal-legion
  - ignite
  - synthesized-ignite
  - minion-mechanic
  - support-gem
  - poe2
  - mechanic
---

# Infernal Legion Ignite Loop

:wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Legion"} = support gem cho minion tự đốt bản thân mỗi giây + ignite mọi enemy trong bán kính. Text quyết định cách scale: minion ignite "**as though dealing Base Fire Damage equal to X% of Minion's Maximum Life**" = synthesized ignite — không hit, magnitude tính thẳng từ % máu minion → nửa số modifier ignite quen không đụng được.

## Còn lại gì sau 0.5.0

- **Infernal Legion I** — self-burn 10% max life/giây as fire (trước 20%), ignite bán kính 1.5m as though dealing Base Fire Damage = 10% Minion's Maximum Life (trước 20%).
- **Infernal Legion II** — y hệt 10%/10%, bán kính 2m, +20% Fire Resistance cho minion.
- **Infernal Legion III** — không còn lấy được (trước: self-burn 30%/giây, ignite base 25%, bán kính 2m — trần scaling cao nhất).
- Cộng lại: ignite output IL endgame < một nửa pre-patch.
- Nerf gián tiếp: 0.5.0 fix bug IL luôn tính critical hit nếu minion có crit chance. Setup cho companion ít crit đang ăn ké damage từ bug — giờ hết. Build ignite thuần không đầu tư crit không đổi (ignite = DoT).

## Vì sao synthesized ignite không qua pipeline hit

- Standard ignite POE2: Hit fire damage → Flammability/Ignite magnitude → roll chance → tick 20% fire damage hit/giây. IL bỏ hết. "as though dealing Base Fire Damage" cho magnitude cố định = X% máu minion, không cần hit — minion trong radius → enemy ignited ngay.
- Cùng pattern: :wiki-link{url="https://www.poe2wiki.net/wiki/Flame_Wall"} ("as though dealing Fire Damage equal to 20% of your Maximum Mana"), :wiki-link{url="https://www.poe2wiki.net/wiki/Saitha%27s_Spear"} ("equal to 10% of your maximum Life"). Hệ quả: mọi modifier gắn "Hit" trượt; damage chỉ còn 2 trục — magnitude ignite + damage enemy nhận.

## Con số ignite theo máu minion

- Magnitude khóa theo companion max life H. Base fire damage = 0.10 × H; ignite tick 20% base/giây → DPS nền:

$$
\text{DPS}_\text{target} = 0.02 \times H \times M_\text{magnitude} \times D_\text{taken}
$$

- `M_magnitude` = mọi "more/increased Magnitude of Ignite"; `D_taken` = hệ số damage enemy nhận (curse, exposure, shock).
- Vd H = 80.000: nền 0.02 × 80.000 = 1.600/giây/target → + :wiki-link{url="https://www.poe2wiki.net/wiki/Searing_Flame"} II (×2.0) ~3.200 → + curse + shock (~1.5×) ~4.800/giây/target; 5 enemy ≈ 24.000 DPS từ riêng ignite. Hệ số **0.02** = chỗ nerf rõ nhất (IL III era = 0.05 → skill giờ < nửa damage cũ cùng máu minion).

## Vòng bomber chậm vì self-burn bị halve

- Self-burn 10%/giây = đồng hồ cho 2 support khác. Minion chạm :wiki-link{url="https://www.poe2wiki.net/wiki/Low_Life"} (35% máu, mất 65%) ở **6,5 giây**, chạm 0 ở **10 giây**. IL III (30%/giây): 2,17s và 3,33s → cả vòng bomber giờ chậm gần ×3.
- Low Life trigger :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Instability"}: minion nổ AOE Hit = 15% max life as fire — là Hit thật nên ignite riêng đi qua pipeline standard, channel độc lập với IL synthesized ignite. Sau 0 máu, :wiki-link{url="https://www.poe2wiki.net/wiki/Last_Gasp"} giữ minion đúng **4 giây cố định** (không scale skill effect duration), IL AOE vẫn radiate. Cycle tổng dài ×3 → tần suất nổ Minion Instability thưa hẳn.

## Gate-split: scale được gì, không gì

Ăn modifier:
- **More/increased Magnitude of Ignite** — trục chính. Mỗi 10% more magnitude = +10% DPS tuyến tính.
- **Searing Flame II** — text 2 dòng: "30% less Damage with Hits" (chỉ đụng hit damage, IL ignite không phải hit → không cắt) + "100% more Magnitude of Ignite" (wording "inflicted with Supported Skills" → áp). Net: nhân đôi magnitude.
- **Enemy-side res reduction** — :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"} (-40 đến -59% all ele res) + Fire Exposure. Cách duy nhất "xuyên" fire res với IL (penetration không có chỗ bám).
- **Magnified Area II** — +45% area, radius scale sqrt(area) → thực tế ~+20% bán kính (không gấp đôi).

Không ăn modifier:
- **Fire Penetration** — áp "on Hit", IL ignite không hit.
- **Crit** — ignite DoT, không crit roll. Crit vào IL channel = phí (sau fix bug 0.5.0 cũng hết ké).
- **"Gain X% of Damage as Extra Y"** — gồm :wiki-link{url="https://www.poe2wiki.net/wiki/Xoph%27s_Pyre"} 40% fire→chaos. Precedent Minion Instability wiki: "does not scale with the Gain X% of Damage as Y modifier".
- **Multiple IL minion** — gem text "the ignite debuff does not stack; enemies will only take damage from the highest ignite". 2 companion IL chỉ phủ rộng hơn, không cộng damage cùng enemy.
- Lưu ý: companion auto-attack là hit thật → channel đó ăn Fire Pen/crit/Xoph's Pyre, nhưng đó là damage đòn đánh companion, không phải IL ignite. Xoph's Pyre chỉ đáng cắm lên skill có hit (Frost Bomb, Storm Mage shock).

## IL trong meta 0.5

- Mất III + halve → không còn engine endgame tự đứng. Về vai damage campaign/leveling + enabler bomber niche. [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) dùng IL I/II xuyên campaign rồi bỏ khi engine endgame (Tecrod's Revenge) lên. Muốn companion damage thật: 0.5.0 buff :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} +40% đến +84% more damage — đường companion-damage tự đứng, không phụ thuộc IL.

## Lỗi hay gặp

- ✗ Đầu tư crit cho IL channel → ignite không crit; chỉ chạm auto-attack companion (channel nhỏ).
- ✗ Cắm Xoph's Pyre lên companion bơm IL → cả 2 dòng Hit-gated/"Gain as extra", không nhấc IL ignite.
- ✗ Stack 3-4 companion nhân ignite → IL không stack, chỉ highest applies; thừa tốn spirit.
- ✗ Giữ IL II làm engine endgame → sau 0.5.0 chỉ damage campaign.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- IL I và II: self-burn + ignite base halve 20% → 10% (radius giữ 1.5m/2m; II thêm +20% Fire Resistance).
- IL III: không còn obtain được (mất 25% ignite base / 30% self-burn).
- Fix bug IL luôn critical hit khi minion có crit chance — nerf gián tiếp minion-crit setup.

## Relationships

- **related_builds** [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) — dùng IL I/II damage campaign rồi chuyển Tecrod's Revenge ở endgame.
- **related_guides** [Minion Army Build Comparison](/guides/0-5-minion-army-build-comparison) — so sánh companion-ignite với spectre vĩnh viễn + construct.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview 0.5.0, nerf Infernal Legion + buff Tame Beast.
- **alternative_to** [Stormweaver Infusion Mana Loop](/guides/stormweaver-infusion-mana-loop) — một engine self-sustain khác của Witch, đối chiếu mô hình loop.
- **related_guides** [Ailment và status effect trong POE2](/guides/beginner-ailments) — build khai thác ignite làm main damage.
- **related_guides** [Patch Notes — Return of the Ancients](/guides/0-5-0-patch-notes) — cơ chế ignite của Infernal Legion sau nerf 0.5.0.
- **related_mechanics** [Unique Items Mới](/guides/0-5-new-unique-items) — The Raven's Flock hỗ trợ minion build; Gruelling Madness từ staff stack với ignite.
