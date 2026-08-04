---
template: templates/mechanic-template.md
document_type: mechanic
title: From Nothing
status: published
author: duocnv
created: '2026-06-10'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.1
sub_class: items
tags:
  - item
  - unique
  - jewel
  - keystone
  - passive
  - poe2
  - mechanic
---

# From Nothing

Unique jewel base :wiki-link{url="https://www.poe2wiki.net/wiki/Diamond"} Diamond, Corrupted, Limited to 1. Không cộng stat trực tiếp — mở khoá passive quanh một :wiki-link{url="https://www.poe2wiki.net/wiki/Keystone"} Keystone để allocate mà không cần nối vào tree. Keystone không cố định: mỗi copy roll một keystone từ pool, Corrupted khoá luôn. = phiên bản POE2 của :wiki-link{url="https://www.poewiki.net/wiki/Impossible_Escape"} Impossible Escape (POE1). Giá trị = tiết kiệm điểm passive.

## Chỉ số

```
From Nothing
Diamond
Limited to: 1
Radius: Small (1000)
Corrupted
--------
Passives in Radius of [Keystone] can be Allocated
without being connected to your tree

"They clawed their way up from the agonising depths of nonexistence,
breathing deep with joy the exquisite light of meaning."
```

- `[Keystone]` = biến, baked sẵn vào mod mỗi copy. poe2db roll sample: Giant's Blood; copy khác: Chaos Inoculation, Avatar of Fire, bất kỳ keystone trong pool. Radius Small (1000) — chỉ cụm sát keystone.

## Cơ chế island-grab keystone

- Chuỗi phụ thuộc từng bước: socket vào jewel socket đã allocate → passive trong radius Small (1000) quanh chính keystone jewel roll ra trở thành allocatable không cần nối (nổi tự do, vẫn trả điểm từng node).
- Keystone không allocate float-free được. Nhưng: allocate 1 passive sát keystone (jewel cho phép) → keystone giờ kề node đã allocate → allocate keystone theo cách thường.
- Kết quả: cầm keystone đủ hiệu ứng (kể cả downside) mà chỉ tốn điểm cho cụm nhỏ + node keystone, thay vì cả path dài.
- Vd companion: :wiki-link{url="https://www.poe2wiki.net/wiki/Trusted_Kinship"} Trusted Kinship (trục Spirit Walker, field nhiều companion hơn) nằm trong pool → character xa keystone island-grab qua jewel socket gần, điểm dôi đổ sang life/ES/damage.
- Cụm mở khoá = quanh keystone jewel roll, KHÔNG quanh ô jewel. In-client: ướm socket vài vị trí để xác nhận có node free thật sự kề keystone (radius Small → chỉ vài node).

## Vì sao đeo (point-efficiency)

- Tree POE2 0.5 rộng, keystone rải ở góc theo class. Build muốn keystone xa (Witch thèm keystone bên Str; hoặc :wiki-link{url="https://www.poe2wiki.net/wiki/Chaos_Inoculation"} Chaos Inoculation, :wiki-link{url="https://www.poe2wiki.net/wiki/Mind_Over_Matter"} Mind Over Matter, :wiki-link{url="https://www.poe2wiki.net/wiki/Avatar_of_Fire"} Avatar of Fire) → path tốn vài điểm tới hơn chục điểm.
- From Nothing biến thành: 1 điểm jewel socket (nhiều build đã đi qua) + cụm nhỏ quanh keystone. Điểm dôi quay về life/ES/resist/damage. Đáng một slot jewel khi keystone xa + endgame đói điểm.

## Canh bạc roll

- Corrupted + keystone baked → không chọn được nếu tự farm. Pool lớn — **33 keystone**; 0.5 xác nhận có Trusted Kinship, :wiki-link{url="https://www.poe2wiki.net/wiki/Resolute_Technique"} Resolute Technique, :wiki-link{url="https://www.poe2wiki.net/wiki/Eldritch_Battery"} Eldritch Battery + nhiều keystone phòng thủ/tiện ích. Cách thực tế: mua trade copy đã roll đúng keystone, lọc theo tên.
- Trap: From Nothing chỉ tiết kiệm đường tới keystone, KHÔNG gỡ downside. `Exclusion check:` keystone's own exclusion clauses vẫn áp (Chaos Inoculation khoá life = 1, Avatar of Fire chặn non-fire, Resolute Technique tắt crit, Eldritch Battery, Blood Magic…). From Nothing không bypass cái nào.

## Cách kiếm

- Drop-restricted, không :wiki-link{url="https://www.poe2wiki.net/wiki/Orb_of_Chance"} Orb of Chance được. Nguồn duy nhất: :wiki-link{url="https://www.poe2wiki.net/wiki/The_King_in_the_Mists"} The King in the Mists ở Crux of Nothingness — boss của :wiki-link{url="https://www.poe2wiki.net/wiki/Ritual"} Ritual. Corrupted → roll cố định, mua đúng roll thay vì tự đập.

## Khi nào không đáng

- Keystone vốn sát điểm xuất phát → path thẳng vài node rẻ hơn bỏ 1 slot jewel.
- Radius Small (1000): không có node free nào thật sự kề keystone → chuỗi adjacency không đóng.
- Corrupted → roll sai keystone là vĩnh viễn; chỉ kiếm copy khác/mua đúng roll.
- Verdict: **NEUTRAL** — point-economy tool, không phải power spike. Không grant keystone free, không gỡ downside. Open question: pool roll-able đổi theo patch → trước khi mua roll cụ thể, kiểm keystone còn trong pool 0.5.1 không.

## Version History

### Patch 0.5.1
- Dạng hiện tại (Runes of Aldur): base Diamond, Radius Small (1000), roll 1 keystone từ pool, drop từ The King in the Mists. Pool tiếp tục dịch chuyển → copy cũ có thể mang keystone đã ra khỏi pool.
- Radius conflict `chưa verify in-client`: wiki mirror (scrape 2026-05-18) ghi "Radius: 2000" dạng số; poe2db raw stat xác nhận internal 1000 (= size label Small). Doc giữ Small (1000) theo poe2db — nếu client hiện "2000", cập nhật.

### Patch 0.1.0
- Item introduced.

## Relationships

- **related** [Unique Items Mới](/guides/0-5-new-unique-items) — cùng họ "sửa tree" với Voices; From Nothing có từ 0.1.0, không phải item mới 0.5.
- **synergizes_with** [Spirit Walker — Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — Trusted Kinship trong pool → companion build island-grab keystone trục qua jewel socket gần.
- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview league 0.5, Ritual nơi The King in the Mists drop item này.
