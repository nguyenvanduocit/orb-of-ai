---
template: templates/guide-template.md
document_type: guide
title: "Parry, combo và WASD: cơ bản combat POE2"
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
  - combat
  - parry
  - shield
  - combo
---

# Parry, combo và WASD: cơ bản combat POE2

POE2 xây lại combat: không click-to-move, không đứng tank dựa flask. Mỗi class đối phó đòn khác nhau — Buckler→Parry, Shield→block, evasion→né, dodge roll→i-frame.

## WASD là control mặc định

- W/A/S/D điều khiển hướng di chuyển; chuột chỉ nhắm skill/attack. Không phải tùy chọn.
- WASD → di chuyển chính xác + nhắm skill về quái đồng thời. Boss telegraph rõ, window né hẹp → mili-giây quyết định sống/chết.
- Dodge roll gắn WASD: spacebar khi đang giữ hướng WASD → roll đúng hướng tức thì. Chi tiết i-frame: [Dodge roll và combat trong POE2](/guides/beginner-dodge-roll).

## Parry (Buckler) = active defense

- :wiki-link{url="https://www.poe2wiki.net/wiki/Buckler"} = shield không có armour, grant skill :wiki-link{url="https://www.poe2wiki.net/wiki/Parry"} (channelling).
- Giữ Parry → Active Block theo hướng nhìn, block chance **100%** cho strike + projectile từ phía trước tầm gần (**1m strike, 1.5m projectile**) — chắc chắn, không RNG.
- Parry thành công → auto counter sweep diện rộng + apply :wiki-link{url="https://www.poe2wiki.net/wiki/Parried_Debuff"}.
- Giới hạn: giữ Parry → move giảm còn **25% tốc độ**. Công cụ đọc đòn, không dùng liên tục.

## Parried debuff → combo follow-up (Huntress)

- Parried Debuff: **2s**, địch nhận **50% more Attack Damage** + không thể evade attack.
- Spear skill consume debuff để burst: :wiki-link{url="https://www.poe2wiki.net/wiki/Disengage"} nhảy lùi + shockwave + grant 1 Frenzy Charge; :wiki-link{url="https://www.poe2wiki.net/wiki/Fangs_of_Frost"} đâm địch Parried → frost explosion + Chilled Ground.
- Nhịp Huntress: Parry đòn → debuff → consume bằng spear → burst (reactive).

## Raise Shield khác evasion

- :wiki-link{url="https://www.poe2wiki.net/wiki/Raise_Shield"} (grant bởi :wiki-link{url="https://www.poe2wiki.net/wiki/Armoured_Shield"}): Active Block 100% strike+projectile từ trước, thiên defense. Release ngay sau khi chặn + địch gần → Shield Bash: luôn Light Stun; Tower Shield thêm Daze.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Evasion"}: xác suất né HOÀN TOÀN 1 hit (physical/elemental). Success = 0 damage, fail = full 100%. Né mọi hướng; Block chỉ chặn từ trước, địch sau lưng không chặn.

## Active Block build Heavy Stun lên người chơi

- Bình thường player miễn Heavy Stun. Nhưng active-block (Raise Shield/Parry) → tích Heavy Stun buildup từ hit bị chặn → chặn quá nhiều đòn mạnh liên tiếp → Heavy Stun.
- Evasion cứu: hit bị chặn mà roll evasion thành công → không tạo Heavy Stun buildup → lý do combo Buckler + evasion cao.

## Combo = resource của Monk

- :wiki-link{url="https://www.poe2wiki.net/wiki/Combo"}: counter số melee strike trong 8s. CHỈ strike cộng combo — không slam, không cộng dù 1 strike hit nhiều địch.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Monk"} + Quarterstaff xoay quanh combo. :wiki-link{url="https://www.poe2wiki.net/wiki/Tempest_Bell"}: cần **4 combo** mới cast, đặt chuông → attack khác đập → shockwave. Combo reset 0 nếu không strike trong 8s.
- Combo = proactive (tự tấn công build resource); Parried debuff = reactive (đọc đòn phản).

## Relationships

- **related_guides** [Dodge roll và combat trong POE2](/guides/beginner-dodge-roll) — i-frame chủ động, kết hợp Parry + Active Block.
- **related_guides** [Ba lớp phòng thủ vật lý: Armour, Evasion và Block](/guides/beginner-defence-layers) — evasion/armour/block tương tác layered.
- **related_guides** [Ailment và debuff trong POE2](/guides/beginner-ailments) — Parried debuff, Daze, Heavy Stun.
- **related_guides** [Đặc trưng từng class và ascendancy](/guides/beginner-classes) — Buckler/Parry (Huntress), combo (Monk) gắn class nào.
- **related_guides** [Kỹ thuật positioning cho bow build](/guides/0-5-bow-positioning) — nền combat WASD cho kỹ thuật kite.
