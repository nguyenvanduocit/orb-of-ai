---
template: templates/guide-template.md
document_type: guide
title: "Chết trong POE2: XP penalty, portal rules và Hardcore"
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
  - death
  - portal
  - hardcore
---

# Chết trong POE2: XP penalty, portal rules và Hardcore

Chết campaign → không sao. Chết endgame → mất XP. Chết Hardcore → character sang Softcore. Ba trường hợp cơ chế khác hẳn.

## Chết campaign không penalty

- Softcore campaign: không mất gì. Respawn tại checkpoint gần nhất / waypoint đã kích hoạt / town. Area reset, quái hồi sinh, item dưới sàn biến mất trừ guaranteed boss drop (thường :wiki-link{url="https://www.poe2wiki.net/wiki/Uncut_gem"}).
- Không XP penalty, không mất inventory. Chỉ mất thời gian dọn lại.
- Party: đồng đội sống revive người chết = đứng gần + channel ~2.5s; +1.5s mỗi lần chết tiếp theo của cùng người trong cùng instance.

## XP penalty từ endgame

- Area level **65+** (từ map T1 đầu tiên): mỗi lần chết mất **10% thanh XP đang có** so với level tiếp theo. Không tụt level: XP < 10% → thanh về 0%, không trừ sang level cũ.
- Level 90+ mỗi death = mất vài tiếng farm.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Omen_of_Amelioration"}: để active trong inventory → cắt XP penalty còn **2.5%** cho lần chết tiếp theo, dùng 1 lần. Dành cho boss khó level cao.

## Portal = re-entry, không phải one-shot

- Portal chỉ consume khi **chết trong map**. Thoát tự nguyện (deposit loot, đổi gear, bỏ dở) → không mất portal.
- Mỗi portal = 1 lượt respawn. Hết portal → không vào lại, map thất bại. :wiki-link{url="https://www.poe2wiki.net/wiki/Waystone"} mới dùng lại map trên Atlas, nhưng mọi modifier đã đặt (:wiki-link{url="https://www.poe2wiki.net/wiki/Precursor_Tablet"} / encounter icon) bị xóa.
- Party: chỉ map owner respawn cả party cùng lúc khi đánh boss, và respawn đó reset boss về full life. Mỗi người có portal riêng (hiện dưới icon nhân vật UI party).
- Rush boss, chết, respawn → game xóa quái thường + content còn lại, chỉ giữ boss (chống farm loot bằng cách cố chết).

## Portal giảm theo modifier waystone

| Mod | Portal | Số lần chết |
|---|---|---|
| 0 | 6 | 5 |
| 1–2 | 5 | 4 |
| 3–4 | 4 | 3 |
| 5 | 3 | 2 |
| 6 | 2 | 1 |

- Lệch 1 vì 1 portal dùng để vào map lần đầu. Waystone 6 mod: 2 portal nhưng chỉ được chết 1 lần.
- Map 6-mod nguy hiểm không cân xứng: quái mạnh hơn + không safety net.

## Pinnacle boss không mất XP

- Chết :wiki-link{url="https://www.poe2wiki.net/wiki/Pinnacle_boss"} không mất XP (ngoại lệ duy nhất endgame). Portal vẫn tiêu, nhưng 10% penalty không áp.
- Số portal pinnacle phụ thuộc Difficulty của boss, không phải modifier waystone.

## Hardcore → Softcore khi chết

- :wiki-link{url="https://www.poe2wiki.net/wiki/Hardcore"}: chết → character + toàn bộ inventory tự chuyển sang **Softcore equivalent** cùng league (HC Runes of Aldur → SC Runes of Aldur). Không đảo ngược.
- Item trong stash vẫn ở HC league (char HC mới cùng league giữ stash). Chỉ character + inventory chuyển.
- Một số event: chết HC event đôi khi sang **Void League** (character không chơi được, chỉ xem/xóa) thay vì Softcore — đọc kỹ điều kiện event.

## Relationships

- **related** [Waystone và Atlas: bước vào endgame mapping](/guides/beginner-waystone-atlas) — modifier trên waystone + chạy map.
- **related** [Defence layers trong POE2](/guides/beginner-defence-layers) — không chết = không mất XP.
- **related** [Life, ES và Mana trong POE2](/guides/beginner-life-es-mana) — health pool bảo vệ khỏi cái chết.
- **related** [Cấu trúc campaign: Acts, Interludes, Checkpoint và Waypoint](/guides/beginner-campaign-structure) — respawn campaign qua Checkpoint/Waypoint.
