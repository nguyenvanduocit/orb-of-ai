---
template: templates/guide-template.md
document_type: guide
title: "Crafting cơ bản: các orb chính, essence và omen"
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
  - crafting
  - essence
  - omen
---

# Crafting cơ bản: các orb chính, essence và omen

Craft POE2 xây trên rarity Normal → Magic → Rare, mỗi rarity có bộ orb riêng. Góc craft (cơ chế), không phải trade value.

## Dây chuyền nâng rarity

- Item **Normal** = 0 explicit modifier.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Transmutation"}: Normal → Magic, 1 mod ngẫu nhiên. Magic tối đa **2 mod (1 prefix + 1 suffix)**. Nếu chỉ ra 1 mod → :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Augmentation"} thêm mod thiếu.
- Magic → Rare, 2 đường:
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Alchemy"}: Normal/Magic → Rare, **4 mod ngẫu nhiên**, KHÔNG giữ mod cũ. Chọn khi cần Rare nhanh.
  - :wiki-link{url="https://www.poe2wiki.net/wiki/Regal_Orb"}: Magic → Rare, giữ 2 mod + thêm 1 → **3 mod**, kiểm soát hơn. Chọn khi Magic đã có 1–2 mod tốt.
- Rare tối đa **6 mod (3 prefix + 3 suffix)** — ceiling, đầy thì không craft thêm.

## Sửa Rare item

- :wiki-link{url="https://www.poe2wiki.net/wiki/Exalted_Orb"}: thêm 1 mod ngẫu nhiên vào Rare < 6 mod (lấp slot trống). Trade value cao.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Orb"}: xóa 1 mod ngẫu nhiên + thêm 1 mod mới. POE2 chỉ thay MỘT mod (không reroll toàn bộ như POE1).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Annulment"}: xóa 1 mod ngẫu nhiên khỏi Magic/Rare, không thêm lại. Rủi ro xóa nhầm mod tốt — càng ít mod còn lại càng cao.

## Essence = guaranteed modifier

- Lesser/thường/Greater dùng lên Magic → Rare với guaranteed mod + mod ngẫu nhiên khác. Ví dụ: Essence of the Body = **+(85–99) maximum Life** trên armour; Essence of Abrasion = flat physical damage trên weapon; Essence of Sorcery = % increased Spell Damage trên focus/wand.
- Perfect Essence + Corrupted Essence dùng lên Rare: xóa 1 mod ngẫu nhiên + thêm guaranteed mod (kết hợp Omen để chọn mod bị xóa).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Essence"} rớt từ Act 1 qua encounter Essence (quái giam trong tinh thể). Đập lấy luôn.

## Omen = meta-crafting

- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen"} đổi hành vi orb kế tiếp. Right-click activate → nằm inventory active → tự consume khi điều kiện xảy ra.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Sinistral_Exaltation"}: Exalted tiếp theo CHỈ thêm prefix.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Dextral_Erasure"}: Chaos tiếp theo CHỈ xóa suffix.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Whittling"}: Chaos tiếp theo xóa modifier level thấp nhất.
- Phần lớn Omen từ :wiki-link{url="https://www.poe2wiki.net/wiki/Ritual"} endgame, mua bằng Tribute. Campaign không cần.

## Orb POE1 không có trong POE2

- **Orb of Alteration** (reroll Magic) — POE2 không có; Magic không reroll, dùng Annulment + Augmentation.
- **Orb of Scouring** (strip về Normal) — không có.
- **Chromatic Orb** (đổi màu socket) — POE2 không có socket màu, support gem gắn riêng.
- **Orb of Fusing** (link socket) — POE2 không có link.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Jeweller's_Orb"} VẪN có nhưng khác: thêm support slot cho Skill Gem, không phải socket trên gear.

## Relationships

- **related_guides** [Currency cơ bản: mỗi orb làm gì](/guides/beginner-currency) — trade value từng orb.
- **related_guides** [Trading cơ bản](/guides/beginner-trading) — mua gear thường hiệu quả hơn craft bừa giai đoạn đầu.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — Verisium Runeforging + Ancient Rune, craft riêng 0.5.
- **related_guides** [Độ hiếm item: Normal, Magic, Rare, Unique](/guides/beginner-item-rarity) — prefix/suffix + rarity nền tảng craft.
- **related_guides** [Corrupted item: tại sao không craft được](/guides/beginner-corrupted-items) — Corrupted khóa các orb trên; Corrupted Essence là currency khác.
- **related** [Rune và augment socket: cách socket stat vào gear](/guides/beginner-runes) — các phương pháp craft item khác ngoài rune socket
- **related** [Salvage Bench và Disenchant: cách thu hồi currency từ item cũ](/guides/beginner-salvage-disenchant) — quy trình dùng Whetstone/Scrap/Etcher/Bauble khi craft
