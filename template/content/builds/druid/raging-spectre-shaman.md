---
template: templates/build-template.md
document_type: build
title: Raging Spectre Shaman
class: Druid
ascendancy: Shaman
league: '0.5'
patch: 0.5.0
status: draft
author: duocnv
created: '2025-12-17'
updated: '2026-07-03'
budget_tier: medium-budget
confidence_level: MEDIUM
pob_coverage: PARTIAL
build_tags:
  primary_skill: Bind Spectre
  damage_type: Physical
  playstyle: Minion
  content_focus: Allrounder
tags:
- poe2
- spectre
- minion
- shaman
- druid
- rage
- warcry
- gargantuan-wasp
- minion-army
---

# Raging Spectre Shaman

Summoner dùng bầy :wiki-link{url="https://www.poe2wiki.net/wiki/Spectre"} hồi sinh từ :wiki-link{url="https://www.poe2wiki.net/wiki/Gargantuan_Wasp"} ("Cocaine Wasps") bay nhanh + aggressive, tự lao vào pack tiếp theo, gánh cả clear lẫn boss; mình đứng sau stack :wiki-link{url="https://www.poe2wiki.net/wiki/Rage"}. Trục damage = Rage người chơi được :wiki-link{url="https://www.poe2wiki.net/wiki/Shaman"} *quy đổi* thành minion stat.

## Build Overview

- **Damage:** bầy Gargantuan Wasp — mỗi con tái hiện gần nguyên bộ skill con ong gốc, projectile nhanh + aggressive → nuôi đủ số con = AoE sạch tự tìm enemy. Dồn scaling vào **minion damage + minion attack speed**.
- **Vector Shaman:** notable :wiki-link{url="https://www.poe2wiki.net/wiki/Commanding_Rage"} biến mỗi điểm Rage → 1% increased Minion Damage + mỗi 5 Rage → 2% increased Minion Attack Speed. Rage KHÔNG chuyển sang minion — nằm trên người mình, *quy đổi* thành chỉ số minion.
- **Giữ Rage:** notable :wiki-link{url="https://www.poe2wiki.net/wiki/Furious_Wellspring"} regen 6% max Rage/giây + "No Inherent loss of Rage" → build lên một lần giữ nguyên, không spam warcry.
- **Defense:** Energy Shield leo dần qua campaign → swap :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"} khi pool đủ dày (chaos immunity). Mobility do bầy spectre lo.

## Skill Gems & Links

- Trục chính :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} bắt Gargantuan Wasp (clear + boss). Link đẩy số con + tốc độ đánh + giữ aggressive: :wiki-link{url="https://www.poe2wiki.net/wiki/Feeding_Frenzy"} (minion hung hãn, lao vào enemy) + :wiki-link{url="https://www.poe2wiki.net/wiki/Minion_Mastery"} / support minion damage-attack speed (cộng dồn Commanding Rage đã quy đổi) + :wiki-link{url="https://www.poe2wiki.net/wiki/Tecrod%27s_Revenge"} (engine bất tử).
- **Warcry (cơ chế):** trục chính :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Cry"} tốn **Mana, KHÔNG tốn Rage** — base cost (19-85) Mana, cooldown 8 giây, bypass bằng một Endurance Charge. Rage dính warcry qua 3 đường gián tiếp: Furious Wellspring "+5 to Rage cost" cho mọi skill; :wiki-link{url="https://www.poe2wiki.net/wiki/Enraged_Warcry"} tiêu Rage bỏ qua cooldown warcry; :wiki-link{url="https://www.poe2wiki.net/wiki/Raging_Cry"} cấp 4 Rage mỗi 5 Power khi gào. Infernal Cry mang tag Nova → :wiki-link{url="https://www.poe2wiki.net/wiki/Astral_Projection"} hợp lệ cast warcry tại vị trí chỉ định (đổi 25% less Area of Effect), châm Rage từ xa.
- **Minion phụ (gia vị):** :wiki-link{url="https://www.poe2wiki.net/wiki/Skeletal_Brute"} / skeleton tạp body-block + bia đỡ; một con buff :wiki-link{url="https://www.poe2wiki.net/wiki/Pain_Offering"} đẩy damage cả bầy pha boss. Không tiêu nhiều spirit vào đám phụ (spirit dồn số Wasp tối đa).
- `Exclusion check: none` — không combo one-way block (không Avatar of Fire, không Resolute Technique trên minion; Chaos Inoculation khóa Life ở 1 nhưng build vốn ES/CI nên không xung đột).

## Ascendancy

Thứ tự 4 notable cốt lõi Shaman qua các Trial:

- **Sacred Flow** — +40 Spirit mỗi charm slot bỏ trống, tối đa **+120 Spirit** khi trống cả 3 slot (charm slot cap 3). Cú spike spirit lớn nhất campaign, đổi từ bỏ toàn bộ charm utility.
- **Druidic Champion** — chỉ cho "Every 2 Rage also grants 1% more Spell damage" → **gating node thuần** với build minion (không cast spell), đi qua để mở Furious Wellspring.
- **Furious Wellspring** (Lab 3) — regen 6% max Rage/giây, "No Inherent loss of Rage", +7 Maximum Rage, và increased/reduced Mana Regeneration Rate áp luôn lên Rage Regeneration Rate.
- **Reactive Growth** (Lab cuối) — thích nghi theo loại Elemental Damage cao nhất mỗi đòn nhận, mỗi adaptation 10% less Damage của loại đó + nền 10% less Elemental Damage taken.

## Passive Tree & Mastery

- Campaign: Spirit nodes trước (nuôi nhiều Wasp sớm) → minion damage + minion attack speed cluster → dày dần Energy Shield.
- 2 notable Rage lấy *ngoài* tree chính qua jewel: :wiki-link{url="https://www.poe2wiki.net/wiki/From_Nothing"} (Diamond jewel, "Passives in Radius of Keystone can be Allocated without being connected to your tree") đặt quanh keystone :wiki-link{url="https://www.poe2wiki.net/wiki/Bulwark"} để mở **Warlord Berserker** không cần kéo dây.
- Tách 2 notable guide cũ gộp: **Commanding Rage** (trên tree / instill amulet) = quy đổi Rage → minion stat. **Warlord Berserker** (qua From Nothing) = node khác: "Allies in your Presence Regenerate 5 Rage per second if you have gained Rage Recently" + "40% reduced Presence Area of Effect" — node bơm Rage cho ally trong presence. 2 mục đích khác nhau, không phải một "rage sharing".
- Mastery node cluster minion thường để trống stat trong export → không allocate đặc biệt; ưu tiên mastery minion attack speed / spirit reservation efficiency khi có lựa chọn.

## Stat Priorities & Defenses

Ưu tiên gear: **Spirit** (nuôi đủ Wasp — trần damage thực, mỗi Wasp = bộ damage hoàn chỉnh nữa) → +Minion Levels → Energy Shield → minion attack speed / minion damage → resistance cap.

- **ES / Life:** CI nên Life khóa ở 1; mục tiêu ES ~5-6k khi swap CI (~lvl 79), trần aspiration 16-17k endgame full gear.
- **Defense layers (0.5+):** evasion phụ → max res cap → ES pool → Reactive Growth elemental adaptation → recovery rate.
- **Res:** cap F/C/L 75%; Chaos không cần lo sau CI (immune).
- **Spirit:** ~300+ cuối campaign, ~400-450 endgame (plausible với gear+tree nhưng chưa verify PoB).
- **Movement Speed:** boots :wiki-link{url="https://www.poe2wiki.net/wiki/Bones_of_Ullr"} (5-15% MS sau rework 0.5).
- **DPS insight:** từ 0.3 global minion damage bonus chống non-unique (~25-35% more late-game) + chống unique (~20-25% more late-game), 0.5 sửa bug (Version_0.5.0.md:1039). Bonus **KHÔNG** tính vào số damage hiển thị trên skill của minion → clear + boss thực tế nhỉnh hơn PoB/tooltip.

### Performance Ratings

| Aspect          | Rating (1-5) |
|-----------------|--------------|
| clear_speed     | 5            |
| boss_damage     | 4            |
| survivability   | 4            |
| mobility        | 4            |
| league_start    | 2            |
| budget_scaling  | 3            |

## Resources

- **PoB:** chưa có pastebin chính thức 0.5 — cần materialize + publish khi vào league.
- **Guide kế thừa 0.5 (canonical):** https://maxroll.gg/poe2/build-guides/minion-army-shaman-build-guide
- **Video gốc 0.4 (GhazzyTV, tech cũ — tham khảo lịch sử):** https://www.youtube.com/watch?v=TM036eoTJUY
- **Forum guide gốc 0.4 (poe-vault, stale):** https://www.poe-vault.com/poe2/druid/shaman/raging-spectre-build-guide

## Gear Progression

- **Leveling:** minion nào để khởi động (wolves, skeleton tạp). Vũ khí +Minion Levels + Spirit; helm/body ES base. Lấy charm slot sớm (belt ilvl 60+ cho đủ 3 slot + quest Ancient Vows) rồi để trống cả ba cho Sacred Flow +120 Spirit.
- **Early Mapping:** Bind Gargantuan Wasp ngay khi tới Ashen Forest (Third Interlude). Cap 3 elemental res, ES ~3-4k, spirit nuôi 4-5 con. Bones of Ullr đáng: rework 0.5 cho 20-30% increased Reservation Efficiency cho skill tạo Undead Minion (áp lên spectre) + 5-15% Movement Speed.
- **Endgame:** bộ unique định hình — From Nothing (Diamond jewel, drop từ The King in the Mists) quanh keystone Bulwark để mở Warlord Berserker; :wiki-link{url="https://www.poe2wiki.net/wiki/Darkness_Enthroned"} belt (2 Augment Socket ẩn + "(50-100)% increased effect of Socketed Items"); Tecrod's Revenge (lvl 65, drop từ Abyssal Depths / Vessel of Kulemak) support bất tử cho Wasp. Amulet instill Commanding Rage. Vào CI quanh lvl 79 khi ES ~5-6k → dồn ES recharge + spirit.
- **Mirror Tier:** max-roll mọi slot ES + spirit, +minion levels amulet/helm, ES pool 16-17k aspiration. Diminishing returns nhanh sau khi spirit đủ nuôi số Wasp tối đa.

## Flasks

- CI nên flask Life vô dụng; chạy 2 Mana flask đỡ chi phí warcry + flask utility nếu slot cho phép.
- **Đánh đổi cốt lõi:** bỏ trống cả 3 charm slot cho Sacred Flow → KHÔNG có ailment immunity / freeze removal / bleed removal từ charm. Reactive Growth (giảm elemental damage) + pool ES dày gánh phần thủ charm bỏ lại. Vào league nếu chết vì freeze/ignite nhiều → cân nhắc hi sinh phần Spirit lấy lại 1 charm slot.

## Leveling Notes

- Campaign minion tạp tới khi bind Gargantuan Wasp ở Ashen Forest (Third Interlude) → chuyển hẳn sang nó làm trục.
- Đầu campaign, :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Legion"} có thể cắt vào bằng Uncut Support Gem đầu tiên (Level 2) như boost damage rẻ — chỉ tạm thời campaign, không engine endgame (xem Failure Modes).
- Trial: Sacred Flow (spike spirit, bỏ trống charm) → Druidic Champion → Furious Wellspring → Reactive Growth. ES gear đủ dày (~5-6k, quanh lvl 79) → allocate Chaos Inoculation.

## Budget & Investment

- **Không league starter.** Chạy đúng paper math cần 2 unique farmed: From Nothing (pinnacle drop từ The King in the Mists) + Tecrod's Revenge (lvl 65, từ Abyssal Depths / Vessel of Kulemak). Trước 2 món vẫn nuôi Wasp nhưng thiếu ally-Rage regen + engine bất tử → clear chậm hơn + minion chết thường. budget_tier thực tế medium — build thứ hai sau khi có currency.
- Sau 2 unique nền: đẩy spirit (thêm Wasp) + ES (sống dai). Mirror tier max-roll ES/spirit + +minion levels — diminishing returns nhanh khi số Wasp chạm cap spirit.

## Failure Modes

- **Map mod hostile.** "minions cannot be revived" / "less recovery" đánh engine: Wasp chết + không hồi sinh trong khi Tecrod's window cooldown → bầy mỏng, damage sụp. "Elemental weakness" nguy hiểm (CI chỉ miễn chaos, vẫn ăn full elemental); + bỏ charm (không ailment immunity) → map nhiều ground effect nguyên tố dễ giết.
- **One-shot encounter.** Boss slam diện rộng / burst một phát (Pinnacle, T17 slam) quét sạch bầy Wasp nhanh hơn re-summon. Tecrod's Revenge giữ minion bất tử *trong* cửa sổ Last Gasp, nhưng cả bầy bị xóa cùng lúc + resummon từ đầu → khoảng damage rỗng; bản thân dù ES dày vẫn có thể one-shot nếu không né pattern.
- **Gear / currency floor.** Paper giả định có From Nothing (King in the Mists) cho Warlord Berserker + Tecrod's Revenge (Abyss lvl 65) cho engine bất tử. Dưới floor vẫn chạy nhưng mất ally-Rage regen + can't-die — không build khởi động league.
- **Patch sensitivity.** Nerf Infernal Legion 0.5 (I/II giảm self-burn + ignite 20%→10% max life mỗi giây, III không obtainable — Version_0.5.0.md:632-634) chỉ chạm campaign (IL chỉ support leveling rẻ; engine bất tử endgame là Tecrod's Revenge, can't-die support độc lập — Version_0.5.0.md:349 — không chạy bằng IL burn). Patch risk thật: build tựa nặng 2 mảnh load-bearing **Tecrod's Revenge + Commanding Rage** — nerf bất kỳ = đánh thẳng trục build.

## Verdict

- Tốt 3 thứ: clear tốc độ cao (Wasp bay qua địa hình + tự lao vào pack); playstyle nhàn (build Rage một lần → Furious Wellspring giữ vĩnh viễn); sống dai endgame (CI chaos immunity + Reactive Growth).
- Struggle: bỏ charm cho Sacred Flow → không ailment immunity (freeze/ignite = điểm yếu cố hữu); phụ thuộc nặng 2 unique farmed → không vào sớm; single-target tốt nhưng không "best in game" như guide 0.4 (tech boss-spectre Death Knight đã bị meta 0.5 bỏ) — bossing dựa Wasp + Tecrod's + bonus minion ẩn chống unique, đủ mạnh không superlative.

## Changelog

### 2026-05-29
- Port 0.4 → 0.5: frontmatter (league 0.5, patch 0.5.0, author duocnv, pob_coverage PARTIAL).
- Sửa core engine: Commanding Rage quy đổi Rage người chơi thành minion stat (không transfer Rage); tách Warlord Berserker (ally-Rage regen qua From Nothing) khỏi Commanding Rage. Sửa FAQ: warcry tốn Mana không Rage (Rage chỉ vào qua Furious Wellspring +5 cost / Enraged Warcry / Raging Cry). Sửa Sacred Flow: +40 Spirit mỗi charm slot trống (max +120 ở cap 3), không flat conditional.
- Bỏ tech 0.4 stale: Death Knight Elite boss-spectre + weapon-swap dual-spectre; reframe Infernal Legion thành campaign-only sau nerf 0.5 (20%→10%, IL3 removed). Cờ Bones of Ullr buff 0.5 (20-30% reservation efficiency + 5-15% MS). Viết lại prose owner-voice, bỏ ASCII box + table thừa; thêm Failure Modes.

## Relationships

- **related_builds** [Infernalist Spectre Legion](/builds/witch/0-5-infernalist-spectre-legion) — cùng Bind Spectre minion-army, so sánh elemental spectre vs Rage-scaling Wasp.
- **alternative_to** [Unearth Bone Construct Mass Summoner](/builds/witch/0-5-bone-construct-mass-summoner-lich) — mass summoner khác cho ai không muốn phụ thuộc unique farmed.
- **related_guides** [Minion Army Build Comparison](/guides/0-5-minion-army-build-comparison) — đối chiếu hướng minion-army 0.5 về clear/boss/budget.
- **related_mechanics** [Amor Mandragora](/guides/amor-mandragora) — Shaman Rage + warcry, user chính của Amor ở meta 0.5.
- **related_mechanics** [Infernal Legion Ignite Loop](/guides/infernal-legion-ignite-loop) — dùng IL I/II damage campaign rồi chuyển Tecrod's Revenge ở endgame.
