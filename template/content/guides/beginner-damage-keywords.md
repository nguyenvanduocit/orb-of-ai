---
template: templates/guide-template.md
document_type: guide
title: "Các keyword damage quan trọng: Exposure, Penetration, Armour Break, Culling"
status: draft
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
guide_type: fundamentals
tags:
  - poe2
  - 0-5
  - beginner
  - damage
  - offense
  - mechanics
  - resistance
---

# Các keyword damage quan trọng: Exposure, Penetration, Armour Break, Culling

Bốn keyword hay đọc nhầm — nhất là Exposure vs Penetration (đều liên quan resistance của enemy nhưng cơ chế khác hẳn).

## Exposure = debuff trên enemy

- :wiki-link{url="https://www.poe2wiki.net/wiki/Exposure"} giảm **resistance thực** của enemy. Mặc định **−20% resistance**, 4s.
- Vì hạ res thực → MỌI nguồn damage hưởng lợi: minion, companion, party.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Cold_Exposure"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Fire_Exposure"}, Lightning Exposure = type-specific. Frost Bomb stack Elemental Exposure tới **50%** qua nhiều pulse → đẩy res về âm; dưới 0% mỗi điểm âm = damage dư ngoài cap.
- Enemy rarity giảm hiệu quả: Magic **15% less**, Rare **30% less**, Unique **50% less** → −20% base chỉ còn −10% với Unique. Boss cần scale "increased Exposure Effect" (passive/rune).

## Penetration = chỉ hit của bạn

- :wiki-link{url="https://www.poe2wiki.net/wiki/Penetration"} KHÔNG đổi res thực; chỉ khi tính damage hit của bạn, game coi res enemy thấp hơn đúng mức penetrate. Nguồn khác giữ nguyên res.
- Không giúp minion/companion/party. Chỉ áp cho **hit**, không cho DoT — build Ignite/Bleed/Poison chỉ scale phần hit tạo ailment.
- Mặc định không đẩy res dưới 0%: enemy 20% fire res + 30% Fire Penetration → tính như 0% (không phải −10%). :wiki-link{url="https://www.poe2wiki.net/wiki/Leopold's_Applause"} cho Penetrate xuống −50%.
- Support: :wiki-link{url="https://www.poe2wiki.net/wiki/Fire_Penetration_I"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Cold_Penetration"}, :wiki-link{url="https://www.poe2wiki.net/wiki/Lightning_Penetration"} — đều Tier 2, mỗi loại 30%.

## Exposure + Penetration stack

- Thứ tự: Exposure hạ res thực trước → Penetration áp lên cái đã hạ khi tính hit. Ví dụ: 75% cold res, Cold Exposure −20% → 55%, hit 30% Cold Penetration → tính như **25%**.
- Exposure cũng cộng với :wiki-link{url="https://www.poe2wiki.net/wiki/Elemental_Weakness"} curse (đều hạ res thực). Combo Elemental Weakness + Exposure + Penetration đưa boss từ 75% về âm.
- Cùng loại Exposure KHÔNG stack — chỉ cái mạnh hơn hiệu lực.

## Armour Break → Fully Broken Armour

- :wiki-link{url="https://www.poe2wiki.net/wiki/Armour_Break"} giảm trực tiếp Armour enemy. Armour về 0 → **Fully Broken Armour** (12s; player 4s): enemy nhận **+20% increased physical damage** từ mọi hit.
- Không phải penetration — tháo armour thật. Reapply refresh duration, không thêm break khi đang Fully Broken.
- Notable **Tempered Mind** (0.5.0): +15% increased effect of Fully Broken Armour → tăng mức bonus trên 20%.
- Warbringer notable **Imploding Impacts**: phá Armour dưới 0 → Fully Broken Armour amplify mọi loại hit (physical + elemental); Armour âm càng sâu, physical damage multiplier càng lớn (ngược chiều armour dương).

## Culling Strike theo rarity

- :wiki-link{url="https://www.poe2wiki.net/wiki/Culling_Strike"} giết ngay enemy dưới threshold khi hit. Threshold check **trước** khi damage áp → enemy 11% life + Culling Strike hit → chết dù hit chỉ 1 damage.
- Threshold: Normal **35%**, Magic **20%**, Rare **10%**, Unique **5%**.
- Bỏ qua mọi mitigation (armour/ES/guard). Ngoại lệ: hit bị evade/dodge → không cull; enemy có :wiki-link{url="https://www.poe2wiki.net/wiki/Runic_Ward"} không cull được (một số enemy endgame Runes of Aldur mang, tới khi Ward bị phá).
- Support :wiki-link{url="https://www.poe2wiki.net/wiki/Culling_Strike_I"} (Tier 4): cull CHỈ Rare + Unique (không Normal/Magic). Culling Strike II: +20% threshold sau mỗi cull thành công.
- DoT KHÔNG cull — Ignite/Bleed/Poison dù giết cũng không trigger.

## Relationships

- **related** [Resistance và cơ chế cap 75%](/guides/beginner-resistances) — Exposure/Penetration tác động resistance enemy.
- **related** [Increased vs More: quy tắc tính damage](/guides/beginner-increased-vs-more) — Penetration là More multiplier độc lập với pool Increased.
- **related** [Các loại damage trong POE2](/guides/beginner-damage-types) — Armour Break gắn physical damage; type nào bypass armour vs check resistance.
