---
template: templates/build-template.md
document_type: build
title: Infernal Monkey Spirit Walker
status: draft
author: duocnv
created: '2026-06-12'
updated: '2026-07-03'
class: Huntress
ascendancy: Spirit Walker
league: '0.5'
patch: 0.5.2
budget_tier: medium-budget
confidence_level: MEDIUM
pob_coverage: NA
build_tags:
  primary_skill: Tame Beast
  damage_type: fire
  playstyle: companion
  content_focus: mapping
tags:
  - huntress
  - spirit-walker
  - tame-beast
  - companion
  - infernal-legion
  - tecrods-revenge
  - soul-eater
  - alpha-primate
  - 0-5
  - poe2
---

# Infernal Monkey Spirit Walker

Nhánh carry dị nhất của [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack): tame con khỉ :wiki-link{url="https://www.poe2wiki.net/wiki/Alpha_Primate"}, cắm :wiki-link{url="https://www.poe2wiki.net/wiki/Infernal_Legion_I"} cho nó **tự thiêu**, cái chết kích :wiki-link{url="https://www.poe2wiki.net/wiki/Tecrod's_Revenge"}: 20 giây không thể chết, :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Eater"} stack tới 50, attack speed +40%, con khỉ phình gấp đôi gấp ba, một mình cày nát map. Damage chính = ignite tính theo **max life của con khỉ** → scale xoay quanh nhồi máu cho minion thay vì damage. Build mapping đúng nghĩa.

## Build Overview

- Engine = chu kỳ sống chết có chủ đích. Infernal Legion bắt con khỉ chịu **10% max life mỗi giây** thành fire damage, đồng thời ignite mọi enemy trong 1.5-2m như đánh base fire bằng 10% max life. Cố tình để con khỉ **0 fire res** → cháy rụi vài giây; life chạm 0 → Tecrod's Revenge: minion không chết ngay, chiến đấu tiếp **20 giây**, nhận Soul Eater + 40% increased Attack/Cast Speed.
- Soul Eater: 1% increased Skill Speed mỗi stack, stack theo kill trong Presence, cap 50 → mapping pack dày lên +50% skill speed sau vài giây.
- Hết 20 giây con khỉ chết thật; lỗ hổng 6 giây revive vá bằng **Wolf Pack hy sinh đúng nhịp**: sói cũng mang Infernal Legion tự thiêu, canh tier gem cho chúng chết lệch pha với khỉ; cơ chế Reviving = cái chết của một reviving minion reset nhịp hồi sinh cả nhóm. Canh đúng → khỉ revive tức thì, zero downtime.
- Sói chết nuôi :wiki-link{url="https://www.poe2wiki.net/wiki/Amanamu's_Tithe"}: 50% chance nhận 1 Abyssal Monster Modifier 20 giây mỗi lần minion được support chết, giữ tối đa 3 — headhunter mini bằng xác sói.
- Burn đọc theo max life → mọi nguồn minion life = damage: :wiki-link{url="https://www.poe2wiki.net/wiki/Forgotten_Warden"} +50% max life companion, anoint **Gigantic Following** ("Your Minions are Gigantic" vừa cộng life vừa multiplier, đổi 25% reduced Reservation Efficiency). Đứng giữa pack mạnh nhất; boss room vắng mob thì soul decay, phải đổi bài.

## Engine Tecrod's Revenge

- Tecrod's Revenge = **Lineage support**: mỗi character chỉ socket **1 bản duy nhất** mỗi Lineage gem trên toàn skill → chỉ 1 con làm berserker; "cả đàn cùng bất tử 20 giây" chết từ rule này. Gem drop level 65 từ Large Abyssal Trove cuối :wiki-link{url="https://www.poe2wiki.net/wiki/Abyssal_Depths"} hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Vessel_of_Kulemak"}, trade ~219 exalted ≈ 1.7 div (leo +56% trong 7 ngày).
- Chu kỳ 1 vòng đời: khỉ full life tự đốt 10%/s + damage mob → về 0 trong ~3-8 giây tuỳ map → Tecrod 20 giây berserk → chết thật → sói chết kéo dậy ngay. Berserk chiếm đa số thời lượng → uptime damage cao, điều kiện duy nhất là nhịp sói khớp.
- **Phần mỏng nhất:** lệch nhịp = carry biến mất 6 giây giữa pack; độ chính xác tween timing chưa đo được trong client — ráp bản này thì log thời gian chết + revive của khỉ với sói vài map đầu, chỉnh tier Infernal Legion + Feeding Frenzy trên sói tới khi hết khoảng trống.
- Soul Eater 2 chiều: thuận (1% Skill Speed/stack, mapping cap 50 vài giây) · nghịch (mất stack mỗi 0.5 giây nếu 4 giây không kill → boss room không add là buff tan trong nửa phút). 2 cấu hình gem riêng cho map và boss, swap vài socket.

## Skill Gems & Links

- **Con khỉ (mapping):** Infernal Legion + Minion Splash + Tecrod's Revenge + Rage + Muster. Infernal Legion = nguồn damage + nút tự huỷ; Minion Splash lan hit phys giữa burn; Rage + Muster như build mẹ. Không cắm tăng sống sót — chết nhanh là tính năng.
- **Con khỉ (bossing):** rút Infernal Legion + Minion Splash + Tecrod's Revenge, trả vào Rapid Attacks + Feeding Frenzy + Heft → attacker thuần flat phys Catha, vì 2 lý do ignite không gánh boss: (1) Soul Eater decay khi không add · (2) ignite Infernal Legion **không stack giữa các minion** → nhiều con cháy thì enemy chỉ ăn tick cao nhất → single target burn trần thấp.
- **Bầy sói (đếm giờ + máy buff):** Loyalty + Feeding Frenzy + Infernal Legion + Amanamu's Tithe, mọi gem tier thấp. Loyalty cắt 30% max life sói cho chết đúng hẹn + đẩy 10% hit damage của mình sang chúng; Feeding Frenzy I thêm damage-taken cho sói cháy nhanh hơn; Infernal Legion I = đồng hồ 10%/s; Amanamu's Tithe đổi mỗi xác sói thành 50% chance 1 Abyssal modifier 20s, giữ 3 gần thường trực. Tier gem sói = núm vặn timing (chỉnh ở đây, không phải trên khỉ).
- **Tầng buff cuối:** Upwelling cắm vào Discipline — persistent support minion increased damage khi mana không đầy, ~30 spirit, giới hạn 1 bản toàn skill. Build mẹ spam Vulnerability + Voltaic Mark → mana gần như không đầy, điều kiện tự thoả.
- `Exclusion check`: Tecrod's Revenge Lineage 1 bản duy nhất, chỉ khỉ cầm (trừ khi cầm :wiki-link{url="https://www.poe2wiki.net/wiki/Solus_Ipse"} mở bản 2 trên skill khác); Gigantic Following không stack với Hulking Minions, đã anoint đừng phí socket; ignite Infernal Legion không stack giữa minion nên đừng cắm bản 2 lên sói (trên sói chỉ là đồng hồ).

## Ghép vào khung pack

- Khung build mẹ giữ nguyên gear; 3 mảnh nuôi con khỉ: :wiki-link{url="https://www.poe2wiki.net/wiki/Forgotten_Warden"} +50% max life → burn theo max life = 50% more burn không tốn gì · :wiki-link{url="https://www.poe2wiki.net/wiki/The_Catha's_Balance"} ~247 flat phys mỗi đòn cho phần attack giữa tick cháy + toàn bộ damage bản bossing · :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy"} giữ trần số lượng mở cho sói + bot.
- **Spirit ledger phải trả:** anoint đổi từ Lord of Horrors về Gigantic Following → hệ số efficiency tamed beast tụt **2.353 → 1.872** (mọi con đắt thêm ~26% spirit). Pool 332 không gánh nổi cả roster damage cũ lẫn engine mới: Zekoa, Bramble Hulk, Antlion, Diretusk **park hết**; roster nhánh này = con khỉ + Wolf Pack + Discipline kèm Upwelling + Ghost Dance, dư mới tính 1-2 aura bot rẻ từ [Aura Bot Zoo](/builds/huntress/0-5-spirit-walker-aura-bot-zoo). Reservation khỉ Extra Crits đọc tooltip sau tame (thay đổi theo số mod giữ, đừng tin số ước lượng).
- **Khác build mẹ:** build mẹ dồn redirect (Loyalty, Romira's, Forgotten Warden) vào đàn để mình tank qua máu tụi nó. Nhánh này carry **chủ động chết liên tục** → redirect mỏng rõ rệt (Loyalty trên sói vẫn chạy nhưng sói cũng chết theo chu kỳ). Phòng thủ lùi về evasion + Ghost Dance + dodge nhiều hơn hẳn bản pack; 1% less damage taken mỗi soul khi đứng cạnh khỉ no soul là bonus, đừng tính là layer.

## Săn khỉ & gem

- Con carry = **Alpha Primate** — rare Quadrilla ở :wiki-link{url="https://www.poe2wiki.net/wiki/Jungle_Ruins"} Act 3, base crit ~25% nên 1 mod **Extra Crits** là cap crit (lý do chọn thay Zekoa). Quy trình y pipeline build mẹ: reset checkpoint Jungle Ruins fish rare Quadrilla, đọc mod trước khi tame, ưu tiên Extra Crits rồi Hasted/Extra Damage. Ritual capture y vậy: weapon-swap despawn cả đàn trước Tame Beast, swap nhiều lần cho Bear lì bug. Tame Beast Q20 trước tame → khỉ sinh 10% Reservation Efficiency, không thì :wiki-link{url="https://www.poe2wiki.net/wiki/Gemcutter's_Prism"} áp thẳng sau capture; level khỉ bằng Uncut Skill Gem L20 — nhánh này level đáng trả full vì gem level = minion level = max life = burn.
- Tecrod's Revenge + Amanamu's Tithe đều Lineage drop-restricted từ Abyss, trade rẻ: ~219 exalted + ~329 exalted. Upwelling, Infernal Legion, Feeding Frenzy engrave từ Uncut Support Gem thường, rẻ như cho.

## Budget & Investment

Giá poe2scout 2026-06-12 (1 Divine = 126.6 Exalted). Core rẻ hơn nhiều so với ấn tượng:
- Tecrod's Revenge ~219 ex ≈ 1.7 div, Amanamu's Tithe ~329 ex ≈ 2.6 div.
- Uncut Skill Gem L20 cho khỉ ~661 ex ≈ 5.2 div + 4 Gemcutter's Prism ≈ 5.5 ex cho Q20 trước tame. Vaal +1 sau cùng là gamble.
- Con khỉ tự săn, account-bound → 1 buổi reset Jungle Ruins fish Extra Crits là chi phí thời gian chính.
- **Cộng ~10-12 div trên khung gear sẵn có = engine chạy đủ.** Phần còn lại bản gốc video là chassis stat-stacking riêng: :wiki-link{url="https://www.poe2wiki.net/wiki/Mageblood"} 71,904 ex ≈ **568 div** (leo +117% 7 ngày); Prism of Belief +2 minion levels ~100-200 div, +3 hét 800-1,500 div (floor poe2scout 1 ex toàn bản +1); From Nothing roll đúng keystone Blackflame Covenant ~144-150 div (floor roll rác 10 ex); Megalomaniac trúng cặp notable minion ~100 div (floor 55 ex). Bốn món + Giant's Blood stat-stack 432 Int gần nghìn div **không thuộc engine** — làm khỉ to hơn + tanky hơn, không đổi chu kỳ cháy-chết-revive. Mua engine trước; phần lớn chassis đó khung Forgotten Warden + Catha đã thay.
- Tín hiệu thị trường: cả cụm gem tăng — Tecrod's +56%, Amanamu's +129%, Uncut Skill L20 +53% trong 7 ngày. Vào sớm.

## Failure Modes

Làm tốt: mapping zero-button với 1 carry tự hồi vĩnh viễn · scale bằng minion life mà gear minion-life rẻ · engine core ~10-12 div ngồi vừa khung sẵn có. Chỗ gãy:

- **Nhịp revive là single point of failure.** Uptime carry treo trên sói chết đúng pha với khỉ. Bảng timing chuẩn chưa có — chính tác giả bản gốc làm hỏng lần quay đầu vì sói revive khỉ sớm, cắt ngắn cửa sổ berserk. Wiki về Reviving chỉ nói delay reset khi 1 reviving minion khác chết, không nói rõ thứ tự dậy. Ráp xong phải log chu kỳ trong client: khỉ chạm 0 / chết thật / sói chết / khỉ đứng dậy — lệch ở đâu chỉnh tier gem sói ở đó.
- **Boss room là nơi engine tắt.** Soul Eater decay sau 4 giây không kill + ignite không stack giữa minion → bản mapping vào pinnacle khỉ xìu. Bản bossing swap 3 socket bắt buộc — damage quay về flat phys Catha, mọi đầu tư thuần burn (Gigantic Following, minion life) đứng ngoài trận boss.
- **Gigantic Following bóp ledger cả đàn.** 25% reduced Reservation Efficiency đủ buộc park toàn bộ roster damage build mẹ. Đổi nhánh = đổi cả cấu trúc đàn; muốn quay về bản pack, anoint lại Lord of Horrors bằng Distilled Emotions là ma sát nữa.
- **Patch sensitivity dày hơn build mẹ.** 3 chân đều ứng viên nerf: Tecrod's Revenge đang hot (+56% giá 7 ngày, vol thấp), Infernal Legion vừa halve 20%→10% ngay 0.5.0 (GGG sẵn sàng đụng tiếp), tween revive bằng cái chết reviving minion là loại interaction hay bị "fixed a bug where". Mỗi chân gãy = engine dừng.
- **Mua nhầm chassis.** Bản gốc video chạy Mageblood 568 div + jewel chase vài trăm div — ví của creator. Copy shopping list nguyên bản = đốt nghìn div cho thứ engine 10 div không cần. Floor thật: khung build mẹ + 3 gem + 1 con khỉ Extra Crits; dưới floor thiếu Extra Crits thì khỉ vẫn cháy vẫn revive, chỉ mất phần crit scaling.

## Verdict

Nhánh cho người đã chán bản pack ổn định, muốn engine có nhịp: carry sống chết theo chu kỳ mình thiết kế, mapping nhanh gần như không bấm. Vào tiền theo thứ tự — 3 gem + khỉ trước (~10-12 div) — chỉ cân nhắc chassis đắt khi engine chạy mượt qua log timing thật. Trần = boss content: swap bài bossing chơi được nhưng không còn điểm mạnh → build farm map chuyên trách hơn all-rounder thay bản pack.

## Changelog

### 2026-06-12
- Viết nhánh Infernal Monkey từ phân tích engine Tecrod's Revenge: verify gem text + Lineage one-copy + Soul Eater decay + Infernal Legion 0.5 từ wiki và patch note, giá core + chassis poe2scout cùng ngày.

## Relationships

- **derived_from** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build mẹ: gear, tree, Catha, Forgotten Warden, pipeline tame; nhánh này đổi carry + cấu trúc roster.
- **related_builds** [Aura Bot Zoo Spirit Walker](/builds/huntress/0-5-spirit-walker-aura-bot-zoo) — bản gốc creator chạy 5 aura bot reservation thấp làm nền cho khỉ; spirit dư của nhánh này đổ vào đúng các bot đó.
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — cơ chế tame, modifier retention, Extra Crits, đường săn rare beast mà khỉ đi qua.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — Abyss lineage gem, Tame Beast, Spirit Walker của league 0.5 là nền engine.

## Resources

- [NEW #1 ENDGAME 190% ATK Spd +300% Size GIANT MONKEY Spirit Walker Build — Mattjestic](https://www.youtube.com/watch?v=xnbUfEVwjmY) — bản gốc engine trên chassis Giant's Blood stat-stack + Mageblood; tween revive bằng wolf timing demo live, video breakdown timing hẹn ở kênh này.
