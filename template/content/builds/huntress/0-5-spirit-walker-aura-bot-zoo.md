---
template: templates/build-template.md
document_type: build
title: Aura Bot Zoo Spirit Walker
status: draft
author: duocnv
created: '2026-06-12'
updated: '2026-07-03'
class: Huntress
ascendancy: Spirit Walker
league: '0.5'
patch: 0.5.2
budget_tier: low-budget
confidence_level: MEDIUM
pob_coverage: NA
build_tags:
  primary_skill: Tame Beast
  damage_type: physical
  playstyle: companion
  content_focus: all-content
tags:
  - huntress
  - spirit-walker
  - tame-beast
  - companion
  - aura-bot
  - zoo
  - essence-farming
  - 0-5
  - poe2
---

# Aura Bot Zoo Spirit Walker

Nhánh aura zoo của [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack): giữ khung gear/tree/carry, đổi một phần spirit lấy con rare beast rẻ nhất mang **monster aura modifier** làm aura bot buff cả đàn lẫn mình (Haste, Extra Physical Damage, Energy Shield, Elemental Resistance, Temporal Bubble). Sức mạnh không mua bằng currency (beast tame account-bound); giá phải trả = thời gian farm essence ở campaign zone.

## Build Overview

- :wiki-link{url="https://www.poe2wiki.net/wiki/Tame_Beast"} giữ tối đa 4 regular :wiki-link{url="https://www.poe2wiki.net/wiki/Monster_modifier"} trên beast bắt về; trong pool có nhóm aura "You and nearby Allies gain..." — beast thành companion thì "allies" = mình + cả đàn. Wiki mô tả Tame Beast support-oriented so với :wiki-link{url="https://www.poe2wiki.net/wiki/Bind_Spectre"} chính vì nhóm aura này.
- Beast mang Haste Aura = aura bot cho 25% attack/cast speed + 25% movement speed cho team. Buff cỡ đó không tồn tại dạng gem tự bật cho companion ở 0.5.
- Giá mỗi aura = spirit reservation của beast, scale theo sức mạnh monster base + số mod giữ. Ngược với hunt carry: tìm con base **yếu nhất còn roll được aura** (base yếu = reservation thấp, nằm campaign zone level thấp). Swarming Wasp 21% pool, Crag Leaper 23%, Quill Crab 24.9% — mỗi con dưới efficiency của build ăn ~30-35 spirit, rẻ hơn nửa con Diretusk Boar.
- Catha flat phys, Vulnerability, Voltaic Mark, redirect + Idolatry ledger đứng nguyên như doc gốc. Nhánh này chỉ đổi: bỏ con damage nào, nhét aura bot nào, bắt ở đâu.

## Aura modifier đáng săn

Pool monster modifier có 8 mod buff/debuff vùng (giá trị thường/Empowered):

- **Haste Aura** — allies 25% increased Attack/Cast Speed + 25% increased Movement Speed. Giá trị nhất: bucket skill speed companion gần rỗng (đàn chỉ có Onslaught từ Carved Majesty trên mục tiêu Marked); Haste chạy thường trực không điều kiện.
- **Extra Physical Damage Aura** — allies 20/40% increased Global Physical Damage. Đàn ~89% phys nên ăn trọn, nhưng increased → pha loãng với Effigy 85-91% + jewel, uplift thật ~10-15% chứ không 40%.
- **Energy Shield Aura** — allies gain 12/30% of Maximum Life as Extra Maximum ES. Scale theo life từng ally: companion ăn +50% max life từ :wiki-link{url="https://www.poe2wiki.net/wiki/Forgotten_Warden"} nên dày; mình 1,947 life nhận thêm 234-584 ES trên nền 1,347.
- **Elemental Resistance Aura** — allies +20/35% all Elemental Resistances. Mình cap rồi nên player thừa; giá trị ở đàn khi map mod ele damage.
- **Temporal Bubble** — enemy trong bubble 10/25% reduced Action Speed, 20/60% reduced Cooldown Recovery, debuff expire chậm 40%. Defensive multiplier cả team, đặc biệt quanh boss.
- **Periodic Invulnerability Aura** — định kỳ cho allies gần buff Immunity ngắn. Clause khắc trên mod: **"Allies with Immunity cannot gain Immunity"** → nhiều bot Invulnerability không cộng dồn/kéo dài lẫn nhau; tối đa cải thiện uptime nếu chu kỳ lệch pha (lệch pha có điều khiển được không → log khi vào game). "Đàn bất tử vĩnh viễn" bị clause chặn cứng.
- **Hinder Aura** (enemy gần 30% reduced Movement Speed) + **Healing Nova** (allies regen 10% life mỗi 2s theo chu kỳ) = hai mod hạng hai: giữ nếu đi kèm con đã có mod chính, không đáng slot riêng.
- Thứ tự săn: Haste (lấp bucket rỗng) → Energy Shield (nhân với +50% companion life) → Temporal Bubble (boss). Extra Physical sau (pha loãng), Invulnerability cuối (thử nghiệm).

## Chọn beast theo spirit reservation

- Reservation đọc trên monster trước khi bắt, nhưng dò mù vô tận. Đường tắt: spirit cost spectre trên community sheet **correlate** với reservation khi tame cùng base — cost 29 → 21% pool, cost 59 → 33%, cost 84 → ~42%. Quy trình: thấy beast lạ → tra tên poe2db biết base → tra base trên sheet spectre → cost thấp mới đáng reset essence. Correlation = số đo cộng đồng, không phải công thức GGG; số chốt = dòng reservation đọc trên monster trong client.
- Con đã đo (spirit hiệu dụng dưới efficiency **2.353** = Trusted Kinship + Lord of Horrors, pool 332):

| Beast | % pool | Spirit | Farm |
|---|---|---|---|
| :wiki-link{url="https://www.poe2wiki.net/wiki/Swarming_Wasp"} | 21% | ~29.6 | :wiki-link{url="https://www.poe2wiki.net/wiki/Ashen_Forest"} (Interlude 3, area lvl 54, vào từ town :wiki-link{url="https://www.poe2wiki.net/wiki/The_Glade"}) |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Crag_Leaper"} | 23.1% | ~32.5 | :wiki-link{url="https://www.poe2wiki.net/wiki/Vastiri_Outskirts"} (Act 2); tag very_fast_movement → không roll Haste Aura |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Porcupine_Crab"} | 24.9% | ~35.1 | :wiki-link{url="https://www.poe2wiki.net/wiki/Whakapanu_Island"}; nameplate ghi Quill Crab, cùng con |
| :wiki-link{url="https://www.poe2wiki.net/wiki/Winged_Fiend"} | 26.7% | ~37.7 | The Spires of Deshar (Act 2), chưa pin được spot essence ổn định |

- Caustic Crab cùng đảo Whakapanu là 32%: cùng zone vẫn phải lọc base, đừng tame con đầu tiên thấy aura.
- Ứng viên chưa đo: :wiki-link{url="https://www.poe2wiki.net/wiki/Sabre_Spider"} (Mastodon Badlands, Act 2), :wiki-link{url="https://www.poe2wiki.net/wiki/Chaw_Mongrel"} (The Azak Bog / The Matlan Waterways, Act 3). Sheet spectre báo cost thấp, gặp essence thì đọc reservation bổ sung.
- Companion giới hạn **1 con mỗi loại** cùng lúc → zoo bắt buộc đa dạng base: 3 con Crag Leaper roll 3 aura khác nhau vẫn chỉ field 1. Mỗi aura thường trực cần 1 base riêng.

## Săn essence reset

Nền = essence encounter ở overworld: rare bị essence giam hiện sẵn 2-3 modifier đọc được trước khi thả (soi loại beast + reservation + mod mà chưa cam kết). Quy trình:

1. Vào zone, quét tìm essence. Không có → reset instance ngay, đừng dọn map.
2. Gặp essence đầu, đọc tên con bị giam. **Con đầu tiên khoá base cả chuỗi reset**: ~9/10 lần sau ra đúng con đó. Sai base → đổi zone hoặc chấp nhận tỉ lệ thấp; đừng cắm đầu reset mong đổi base. 90% = quan sát thực địa chưa có nguồn chính thức, log tỉ lệ của chính mình.
3. Đọc mod. Có aura mục tiêu → ritual capture. Không → reset.
4. Reset: zone có waypoint → về town, Ctrl+click tên zone tạo instance mới. Zone không waypoint (Ashen Forest) → **Alt+click vào cửa zone** (không biết trick này thì không farm được zone interlude).

- **Ritual capture đúng thứ tự** (đàn DPS cao giết beast trước khi wisps bám): weapon-swap despawn cả đàn (bug cấm swap khi map, ở đây thành công cụ dọn bãi) → gỡ offhand chắc không còn con nào. Con Bear từ :wiki-link{url="https://www.poe2wiki.net/wiki/Wild_Protector"} lì hơn: bug làm nó bám lại sau swap, phải swap qua lại vài lần tới khi sạch minion. Sạch rồi mới Tame Beast lên mục tiêu, tự tay giết khi wisps còn dán. Tame Beast mang Prolonged Duration II khi săn để kéo wisp window.
- Tip: essence đổi chỗ/biến mất giữa reset — không thấy spot cũ thì đảo một vòng trước khi reset. Whakapanu chỉ cần quét nhánh sa mạc, tới rừng chưa thấy essence thì reset luôn.
- Pipeline tame nền (modifier retention, disenchant gem về bản trắng, Untainted Paradise cho volume) ở [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt). Bảng reservation đầy đủ + vị trí farm 0.5 theo Interlude + route ba chặng gom aura ở [Farm aura beast cho companion zoo](/guides/0-5-aura-beast-farming).

## Spirit ledger nhánh zoo

- Ledger gốc chốt 302.4 trên pool 332: headroom 29.6 vừa khít **1** con Swarming Wasp. Muốn zoo thật thì đổi chỗ: park Diretusk Boar nhả 55.0 spirit, park Antlion Charger nhả 59.7 → cộng headroom ~144 spirit, đủ field 4 aura bot hạng 21-25%.
- Phép đổi không lỗ Muster: mỗi aura bot vẫn là loại reviving companion nên giữ stack 7% more riêng — bỏ 2 loại lấy 4 loại = **net +2 stack Muster** cho đàn, tự bù phần damage mất. Cái mất thật = 2 body clear (Antlion charge dọn pack + Boar trám phys-hit) → zoo clear chậm hơn doc gốc một nhịp, đổi lấy Haste cho Zekoa với Bramble Hulk + ES + Temporal Bubble cả team.
- Bot beast level thấp ít mod nên máu mỏng hơn mặt bằng đàn; vẫn hưởng +50% companion life từ Forgotten Warden + tự revive theo Reviving. Đừng cắm Loyalty/Romira's lên bot — redirect dồn về con trâu, bot chỉ cần sống để phát aura.
- Mỗi bot chiếm 1 gem slot thường trực = sức ép thật: roster gốc đã dày, thêm 4 bot phải đếm slot trống trong client trước, săn sau. Bot không cần support đắt; dư socket thì Meat Shield hoặc Elemental Army cho con hay chết.

## Budget & Investment

Giá poe2scout 2026-06-12 (1 Divine = 126.6 Exalted). Phần mua được gần miễn phí:
- Mỗi bot cần 1 gem Tame Beast riêng, cắt từ Uncut Skill Gem. **Bẫy giá ở level:** Uncut Skill Gem L20 ~661 ex ≈ 5.2 div còn leo (+53% trong 7 ngày — demand minion đẩy giá trần), L19 chỉ **~6 ex**. Aura bot không ăn gì từ tier damage 84% của gem L20 → dừng L19, để dành L20 cho carry (chênh 5 div/con cho đúng 0 giá trị).
- Mỗi 20% quality companion gem = 10% Reservation Efficiency; :wiki-link{url="https://www.poe2wiki.net/wiki/Gemcutter's_Prism"} áp thẳng sau capture (+5%/viên, 1.37 ex → Q20 hết 4 viên ≈ 5.5 ex; trên bot 21% tiết kiệm ~3 spirit — đáng vì rẻ, quên thì vá sau).
- Tổng input mua được cho zoo 4 bot: **~46 ex ≈ 0.36 div**. Phần còn lại = thời gian.
- Thời gian = tiền thật: mỗi bot đúng base đúng aura ăn 30 phút - 2 giờ reset tuỳ RNG, zoo 4 con = 1 buổi tối 3-6 giờ; campaign zone lvl 54 không nhả gì bán được → giá thật = div lẽ ra kiếm nếu chạy T15. Đổi lại: beast account-bound → ngoài market, không ai mua tắt, không inflation ăn mòn, còn nguyên tới khi patch đổi cơ chế. Con tame hỏng không bán lại — chỉ disenchant vendor lấy gem trắng giữ nguyên level/quality/socket rồi bắt lại.

## Failure Modes

Làm tốt: buff team-wide ~30 spirit mỗi aura không gem nào mua được · đường nâng sức mạnh tách khỏi market cho người có giờ · ngồi gọn lên khung sẵn (không đổi gear/respec, quay về roster damage chỉ re-summon). Chỗ gãy:

- **Immunity không stack.** Clause "Allies with Immunity cannot gain Immunity" → nhiều bot Invulnerability không chồng buff/nối duration. "Đàn bất tử" xây trên cát; 1 bot Invulnerability là thử nghiệm uptime, không phải defense layer tin được. Field thì log uptime Immunity thực tế 1 session map trước khi cho chỗ cố định.
- **Aura là "nearby", AI không biết đứng đội hình.** Mọi mod theo bán kính quanh bot, companion AI tản theo combat → bot lao sai hướng là cả đàn mất Haste đúng lúc cần. Uptime thực chiến < 100% — đo bằng quan sát icon buff trên status của mình 1 session T15; rớt thường xuyên → giá trị zoo chiết khấu tương ứng.
- **Spirit và gem slot = hai bức tường cứng.** Mỗi bot ~30-38 spirit → zoo nghiêm túc phải park bớt damage companion (clear chậm khi mất Antlion + Boar), mỗi bot ngồi vĩnh viễn 1 gem slot. Đầy slot rồi thì mỗi bot mới là lựa chọn bỏ-con-nào.
- **RNG thời gian + mọi số trượt theo patch.** First-encounter khoá base 90% + spectre-cost correlation đều là số đo cộng đồng; GGG sửa essence reset / bug Alt+click door / bảng reservation là cả pipeline đổi giá. Bug Bear không despawn + bug weapon-swap despawn đàn nằm trong danh sách fix bất kỳ lúc nào — cái sau vừa là điều cấm khi map vừa là công cụ khi săn, fix xong ritual capture phải tìm cách dọn đàn khác.
- **Buff không cứu lỗ thủ gốc.** Zoo cho ES aura + Temporal Bubble nhưng không vá hai mặt one-shot phys/chaos 3.6k của build mẹ — đòn vượt pool vẫn giết. Thứ tự đúng: ring chaos cap 75 trước, zoo sau.

## Verdict

Nhánh cho người đã chạy ổn build pack và còn giờ chơi hơn currency: 1 buổi tối ~0.36 div input = hệ buff team-wide market không bán. Giá trị nhất với khung hiện tại: Haste Aura lấp bucket skill speed rỗng + ES Aura nhân với +50% companion life sẵn có; Invulnerability cuối cùng như thử nghiệm vì clause chống stack. Đừng chạy thay việc vá chaos res — lớp kem trên build đã đứng, không phải xương sống mới.

## Changelog

### 2026-06-12
- Viết nhánh aura bot zoo từ phân tích farm rare beast reservation thấp: verify 8 aura modifier + clause Immunity từ wiki, spirit math dưới hệ số 2.353 của build mẹ, giá input poe2scout cùng ngày (L19/L20 gap 6 ex vs 661 ex).

## Relationships

- **derived_from** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — build mẹ: toàn bộ gear, tree, ascendancy, ledger gốc và lớp redirect; nhánh này chỉ đổi cấu trúc roster.
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — pipeline tame nền: modifier retention, essence reset hai tầng, disenchant, Untainted Paradise.
- **related_guides** [Farm aura beast cho companion zoo](/guides/0-5-aura-beast-farming) — bảng reservation đầy đủ, vị trí farm 0.5 theo Interlude, route ba chặng gom aura.
- **part_of** [Return of the Ancients](/guides/return-of-the-ancients) — league 0.5 với Spirit Walker, Tame Beast, essence encounter làm nền cho hướng companion.
- **related_builds** [Infernal Monkey Spirit Walker](/builds/huntress/0-5-spirit-walker-infernal-monkey) — bản gốc creator chạy 5 aura bot reservation thấp làm nền cho khỉ; spirit dư của nhánh này đổ vào đúng các bot đó.
## Resources

- [NEW 0.5 DISCOVERY! Rare Companion Spirit Cost & Locations — Mattjestic](https://www.youtube.com/watch?v=zuoSLaKXLNE) — field data reservation theo base + phương pháp tra spectre sheet, spot Ashen Forest / Whakapanu.
- [Community Spectre Cost Spreadsheet](https://docs.google.com/spreadsheets/d/1oadXSCHczpyCgRxzTk3nRBeeOLlefZAzKM3ijwmWevY/htmlview?gid=0#gid=0) — bảng tra cost spectre dùng làm pre-filter reservation.
