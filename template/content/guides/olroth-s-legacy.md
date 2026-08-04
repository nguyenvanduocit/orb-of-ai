---
template: templates/mechanic-template.md
document_type: mechanic
title: Olroth's Legacy
status: published
author: duocnv
created: '2026-05-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: crafting
tags:
  - rune
  - unique
  - crafting
  - olroth
  - kalguuran
  - ezomyte
  - poe2
  - mechanic
---

# Olroth's Legacy

Rune dùng một lần: phá hủy vĩnh viễn 1 unique **Ezomyte/Kalguuran** → đúc 1 modifier đặc trưng thành socketable rune "Legacy of \<unique\>", gắn vào item **cùng class** với unique gốc. Mục đích: transplant mod đỉnh khỏi unique base rác → dán lên base crafted tốt. 0.5.0 thêm 60+ loại rune (phủ gần hết unique 2 nhóm này).

## Cơ chế

- 1 unique → đúng 1 rune cố định, không roll: phá :wiki-link{url="https://www.poe2wiki.net/wiki/Svalinn"} luôn ra "Legacy of Svalinn" (lucky block). Phá lặp lại → cùng mod.
- Class restriction tuyệt đối: rune shield → chỉ shield, bow → chỉ bow. Không cross-class (two-hand ↛ one-hand cùng type, bow ↛ quiver, armour ↛ belt/ring), không exception.
- Mod convert đôi khi bị giảm value so với mod gốc (GGG xác nhận, không công thức công khai; một số giữ nguyên) → tính value ở mức "một phần mod gốc", đừng assume 100%.
- Target lý tưởng = unique có giá trị dồn vào ĐÚNG 1 mod đặc trưng, phần còn lại là stat nền/rác. Phá chỉ ra 1 mod → unique 3-4 mod tốt ngang nhau là target tệ.
- Kinh tế: unique 1-mod-thống-trị tăng giá league (demand đeo nguyên + demand lấy rune); unique nhiều mod mạnh không mod nào tuyệt đối → giữ giá thấp hơn kỳ vọng.

## Target uniques

- **Svalinn (shield):** *Chance to Block Damage is Lucky* — roll block 2 lần lấy lần tốt: effective = 1 − (1 − p)²; base 50% → ~75%, 60% → ~84%. Mod còn lại (200-300% inc Armour, take 0-20% damage from Blocked Hits) phụ thuộc base, không extract-worthy. Rune lucky block → shield thật (life + res + spell block) = defense trade-off top league cho build block cao; build không block thì bỏ qua.
- **Quill Rain (bow):** :wiki-link{url="https://www.poe2wiki.net/wiki/Quill_Rain"} — extract *100% increased Attack Speed* (local); dòng *40% less Attack Damage* là modifier RIÊNG, không đi kèm rune → lấy tốc đánh, bỏ lại downside định nghĩa unique gốc.
- **Ironbound (bow, Ezomyte mới 0.5):** :wiki-link{url="https://www.poe2wiki.net/wiki/Ironbound"} — *Arrows Return if they have Pierced a target which had Fully Broken Armour* (pierce + return = hit 2 lần cùng enemy). Điều kiện cứng: build phải có nguồn armour break chủ động (pair :wiki-link{url="https://www.poe2wiki.net/wiki/Heavy_Stun"} / mod break trên quiver/passive). Mod block của nó (+12% block, 3-5% inc block per 100 armour) không phải target.
- **Keeper of the Arc (helmet, Kalguuran):** alternating mỗi 5s — *Take 40% less Damage from Hits* ↔ *Take 40% less Damage over Time*. Kể cả sau giảm value convert, rune "take less Damage" lên helmet thật (life + res + armour) = upgrade defensive lớn, class/weapon-agnostic.
- **Irongrasp (body armour):** :wiki-link{url="https://www.poe2wiki.net/wiki/Irongrasp"} cấp 2 keystone không có trên tree — *Iron Grip* (1% inc projectile attack damage per 2 Str, Str mất inherent Life) + *Iron Will* (tương tự cho spell damage). Rune chỉ mang MỘT trong hai. Base Vagabond Armour (armour+eva cấp 16) quá thấp endgame → value nằm trọn ở keystone = pattern phá lý tưởng.

## Không extract được

- Active skill từ "Grants Skill" (Svalinn → Raise Shield/Cast on Block, Mjolner → Thunder God's Wrath) — skill gắn liền unique object, chỉ extract được stat modifier khác nếu có.
- Keystone rune không stack với keystone trên tree — binary toggle, có từ nguồn nào cũng chỉ tính 1 lần.

## Lỗi hay gặp

- ✗ Mua unique để phá rồi mới phát hiện gear đích khác class / hết rune socket → xác nhận class + socket TRƯỚC khi mua.
- ✗ Upgrade gear quên rune — rune không tự dịch chuyển, phải unequip + re-socket thủ công.
- ✗ Assume mọi unique đều thuộc target list — chỉ Ezomyte + Kalguuran.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Ra mắt: 60+ rune legacy, 1 rune per unique Ezomyte/Kalguuran. Rune Olroth's Legacy drop từ Kalguuran endgame (Ocean Exploring) + trade được.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — hệ rune legacy + Ocean Exploring là một phần thay đổi 0.5.0.
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — companion build invest block cao hưởng rune lucky block Svalinn.
- **related_mechanics** [Unique Items Mới & Meta Shift](/guides/0-5-new-unique-items) — Ironbound thuộc lứa Ezomyte unique 0.5 trong target list.
