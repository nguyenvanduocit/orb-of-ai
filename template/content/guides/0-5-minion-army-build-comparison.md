---
template: templates/guide-template.md
document_type: guide
title: Minion Army Build Comparison
status: draft
author: duocnv
created: '2026-05-29'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
---

# Minion Army Build Comparison

So sánh 3 hướng minion 0.5 — Witch Infernalist / Witch Lich bone-construct / Druid Shaman Raging Spectre — theo 3 **mục tiêu khác nhau**, không phải thang yếu→mạnh.

- **Witch Infernalist** — league-start an toàn nhất. Backline spectre tự hồi sinh vĩnh viễn qua :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"}, hứng đòn bằng pool ES (qua :wiki-link{url="https://www.poe2wiki.net/wiki/Beidat's_Hand"} chuyển Life-reserve → ES) + cửa sổ overkill :wiki-link{url="https://www.poe2wiki.net/wiki/Last_Gasp"}. Không hi sinh lớp phòng thủ nào; damage từ gem level + buff toàn cục. Rẻ, lì, ít thao tác.
- **Witch Lich bone-construct mass summoner** — RTS fantasy. :wiki-link{url="https://www.poe2wiki.net/wiki/Unearth"} sinh ~24 :wiki-link{url="https://www.poe2wiki.net/wiki/Bone_Construct"} từ xác quái. Construct tạm thời: không teleport theo, despawn ~15s, 20+ minion → tụt 10-15 FPS. Không phải build leaderboard.
- **Druid Shaman Raging Spectre** — all-rounder clear-và-boss, đầu tư cao. :wiki-link{url="https://www.poe2wiki.net/wiki/Gargantuan_Wasp"} bay vượt địa hình + tự lao vào pack, scale bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Rage"} qua ascendancy, nuôi sống bằng vòng lặp bất tử :wiki-link{url="https://www.poe2wiki.net/wiki/Tecrod's_Revenge"}. Spirit ceiling + clear + single-target khá nhất, nhưng gate sau unique phải farm.

| Build | Mạnh nhất | Tránh nếu |
|---|---|---|
| Infernalist | Rẻ & lì | Cần boss |
| Lich | Vui RTS | Cày endgame |
| Shaman | All-round | Mới vào league |

## Spirit ceiling

- **Shaman** cao nhất: :wiki-link{url="https://www.poe2wiki.net/wiki/Sacred_Flow"} +40 Spirit mỗi ô :wiki-link{url="https://www.poe2wiki.net/wiki/Charm"} trống → 3 ô = +120 trên base 100 + sceptre ~100. Giá: charm trống = mất ailment immunity.
- **Infernalist** giữa: :wiki-link{url="https://www.poe2wiki.net/wiki/Beidat's_Will"} +1 Spirit/25 max Life, tốn 25% Life reservation. Life 1500-2000 → +60-80 trên base 100 + sceptre ~100, pool ~210-230 trước gear. Chỉ vượt +120 Shaman khi life-stack nặng.
- **Lich** cuối dứt khoát (không node Spirit ascendancy; Beidat's Will khóa cho Infernalist). Dựa sceptre base ~100, gear "% increased Spirit", :wiki-link{url="https://www.poe2wiki.net/wiki/Profane_Commander"} (4%), :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Mantle"} (+75). Construct cast bằng mana không reserve spirit → Spirit chỉ gate spectre + offerings.

## Clear speed

- **Shaman** dẫn (chuyển động): Wasp bay vượt địa hình/vật cản, tự lao vào pack, không kẹt chokepoint.
- **Lich** mật độ cao nhất khi bầy sống (20-24 construct đánh physical), nhưng snowball gãy ở chokepoint/đi nhanh (không teleport, re-summon từ xác mỗi pack).
- **Infernalist** mượt nhưng screen-density thấp (spectre AoE trải 5-6 xác tự hồi sinh × buff toàn cục).
- Bug fix minion nâng cả ba đều: "approximately 25-35% more late-game minion damage against non-unique enemies … no longer factored into the damage numbers displayed" (Version_0.5.0.md:1039) — không phân định class. Yếu tố phân định là Wasp bay vượt địa hình.

## Single-target / boss

- **Shaman** khá nhất: Wasp + sustain Tecrod's Revenge + buff ẩn ~20-25% lên unique. Solid không superlative — tech boss-spectre Death Knight Elite của 0.4 bị bỏ ở 0.5.
- **Infernalist** yếu nhất: chia đều N spectre, buff toàn cục ~20-25% lên unique (vs ~25-35% lên trash).
- **Lich** sàn: construct cap 24, pool tí hon, nguồn xác cạn trên boss solo (không add → không construct mới khi cũ despawn ~15s). 1 video creator, chưa Uber clear.
- ⚠ bẫy scope: "Lich vua pinnacle 0.5" thuộc **ED/Contagion Lich** (chaos-DoT khác), KHÔNG trong so sánh này.

## Survivability

- **Shaman** trần EHP cao nhất + lỗ hổng: :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"} (chaos immunity) + :wiki-link{url="https://www.poe2wiki.net/wiki/Reactive_Growth"}, ES ~5-6k lvl 79 → trần 16-17k endgame. Charm trống → không ailment immunity → hở freeze/ignite.
- **Infernalist** tốt (không hi sinh lớp nào): backline thật, pool ES qua Beidat's Hand, overkill Last Gasp. Nerf ES recharge 0.5 chỉ chậm ramp: "faster start … 6% (previously 15%)" + bỏ small node recharge-rate (Version_0.5.0.md:546-547) — chậm hồi, không teo pool.
- **Lich** mong manh: :wiki-link{url="https://www.poe2wiki.net/wiki/Soulless_Form"} làm 10% mọi damage xuyên ES đập thẳng pool Life thấp (~1.5k), không armour/evasion.

## Mobility / QoL

- **Infernalist** nhẹ nhất: backline, không weapon swap, không nuôi xác, legion tự hồi sinh (Bind Spectre); dời chỗ :wiki-link{url="https://www.poe2wiki.net/wiki/Blink"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Loyal_Hellhound"} tank + kéo quái.
- **Shaman** QoL tốt: :wiki-link{url="https://www.poe2wiki.net/wiki/Furious_Wellspring"} giữ Rage vĩnh viễn sau 1 ramp; setup single-Wasp 0.5 bỏ weapon-swap clear/boss kiểu 0.4.
- **Lich** tệ nhất: construct không teleport → gãy bầy ở chokepoint; re-cast ~15s; 20+ minion tụt 10-15 FPS (gần như không chơi console).

## Budget & league-start

- **Infernalist** rẻ nhất (starter rẻ nhất 0.5, gần free, damage gem level + buff toàn cục, ES gánh campaign). Vài chaos cap res + 1 sceptre minion-level.
- **Lich** rẻ tốt (sceptre Spirit + gear +minion skill level/max-Life, không unique bắt buộc). Rủi ro thật: dependency corpse-spectre chưa giải.
- **Shaman** không starter: gate sau :wiki-link{url="https://www.poe2wiki.net/wiki/From_Nothing"} (drop pinnacle King in the Mists, ally-Rage) + Tecrod's Revenge (level 65, :wiki-link{url="https://www.poe2wiki.net/wiki/Abyssal_Depths"}, vòng lặp bất tử).

## Endgame scaling ceiling

- **Shaman** sâu nhất: Rage stacking → :wiki-link{url="https://www.poe2wiki.net/wiki/Commanding_Rage"} (Rage player → minion damage/speed) + Furious Wellspring + buff ẩn; spirit ceiling lớn nhất nuôi swarm lớn nhất.
- **Infernalist** vừa, diminishing returns khi bầy đầy. Pivot minion-damage% + 1 spectre premium; weapon (:wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber"} vs :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock"}) là breakpoint PoB.
- **Lich** yếu, tường cứng: cap construct 24 (20 base + 4 từ 2 node +limit); +skill level qua 20 chỉ thêm damage/đòn, không thêm con.

## Patch risk 0.5 (bẫy tên)

- "Infernalist Spectre Legion" **không bao giờ socket** :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Legion"} → nerf IL trượt qua. Druid Shaman (không "Legion" trong tên) từng dùng IL nhưng chỉ ở campaign leveling; engine bất tử endgame là Tecrod's Revenge (can't-die support độc lập, Version_0.5.0.md:349), **không** chạy IL burn. Patch: "Infernal Legion I/II … 10% … (previously 20%)" + "Infernal Legion III: Can no longer be obtained" (Version_0.5.0.md:632-634).
- **Infernalist** rủi ro thấp nhất, net buff (né gut IL + buff minion toàn cục fix). Đòn bẩy hại: re-nerf buff non-unique hoặc tăng spirit-cost spectre.
- **Shaman** elevated (không vì nerf IL) — tựa Tecrod's Revenge + Commanding Rage + rủi ro buff-minion-ẩn retune.
- **Lich** medium-high: tựa Unearth scaling theo level, Soulless Form đổi Life→Mana, buff minion vừa retune; lag mass-minion là target balance lặp; enabler corpse-spectre chưa chứng minh. Class Lich không bị đụng.

## Chọn build nào

- **League-start mượt nhất** → Witch Infernalist Bind-Spectre Legion (sàn rẻ nhất, né trọn nerf Infernal Legion, không weapon swap / nuôi xác / unique farm).
- **Clear speed tối đa** → Druid Shaman Raging Spectre (Wasp bay vượt địa hình, không gãy chokepoint như construct Lich). Chọn Lich chỉ nếu muốn mật độ màn hình hơn throughput.
- **Single-target / pinnacle tối đa** → Druid Shaman (con bossing đáng tin duy nhất). Caveat: pinnacle thuần, con Lich genre-best là ED/Contagion — khác build.
- **RTS "command a horde" / vui** → Witch Lich Unearth Bone-Construct. Mở mắt: gãy chokepoint, re-cast liên tục, tụt 10-15 FPS (gần không chơi console), bossing chưa chứng minh.
- **Budget thấp nhất / SSF** → Infernalist (#1) hoặc Lich (#2 sát). Tránh Shaman (gate From Nothing + Tecrod's Revenge).
- **Hardcore / an toàn nhất** → Witch Infernalist (không lỗ hổng: full ES pool qua Beidat's Hand, backline, overkill Last Gasp). Shaman trần EHP cao hơn nhưng hở freeze/ignite; Lich rò 10% damage xuyên ES vào Life ~1.5k.

## Cảnh báo & ẩn số ngày đầu league

- Số tuyệt đối = cơ chế đã chắc; tổng số + thứ hạng meta = ẩn số ngày 1 (cần tự log).
- Meta ngày 0/1 chưa chốt: "build minion phổ biến nhất" nghiêng Shaman từ web aggregator (không phải ladder) — coi là chỉ-hướng, log poe.ninja sau tuần đầu.
- Boss-tier bone-construct Lich chưa chứng minh (1 video, chưa Uber/pinnacle). Log: construct solo boss duy trì bao nhiêu con + DPS rớt bao nhiêu khi không add.
- Không PoB sim back số tuyệt đối: trần ~450 Spirit endgame + 16-17k ES CI Shaman = trần mơ ước chưa verify (cơ chế Sacred Flow +120 / CI immunity thì chắc). pob_coverage PARTIAL/NA cả ba (PoB2 trễ 0.5) — dựng PoB thật.
- Buff minion toàn cục (~25-35% non-unique / ~20-25% unique) ẩn khỏi tooltip + PoB2 damage number (Version_0.5.0.md:1039) → mọi tooltip under-report. Mục tiêu nerf tương lai (vừa retune), cả ba chia rủi ro. Log clear/boss time thật.
- Spirit ranking Shaman > Infernalist > Lich đúng ở life pool điển hình; Infernalist có điều kiện (Beidat's Will scale life + 25% reservation); Lich cuối dứt khoát.

## Relationships

- **related_builds** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — league-start an toàn nhất: backline ES tự hồi sinh, né trọn nerf Infernal Legion.
- **related_builds** [Bone Construct Mass Summoner Lich](/builds/witch/0-5-bone-construct-mass-summoner-lich) — RTS fantasy: 20-30+ construct tràn màn, sàn boss/endgame, mong manh vì Soulless Form rò damage.
- **related_builds** [Raging Spectre Shaman](/builds/druid/raging-spectre-shaman) — all-rounder clear-và-boss: spirit ceiling cao nhất, Wasp bay vượt địa hình, gate sau unique + hở ailment.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — thay đổi 0.5 (nerf Infernal Legion, buff minion toàn cục bug-fix, ES recharge ramp) định đoạt so sánh này.
- **related_builds** [Hollow Mask Acolyte Minion](/builds/monk/hollow-mask-acolyte-minion-hypothesis) — so sánh minion path (Acolyte vs Infernalist Witch vs Spirit Walker Huntress)
- **related_mechanics** [Infernal Legion Ignite Loop](/guides/infernal-legion-ignite-loop) — so sánh companion-ignite với spectre vĩnh viễn + construct.
