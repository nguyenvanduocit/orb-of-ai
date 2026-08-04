---
template: templates/mechanic-template.md
document_type: mechanic
title: Lavianga's Spirits
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
  - mana-flask
  - mana
  - reservation
  - caster
  - poe2
  - mechanic
---

# Lavianga's Spirits

Unique :wiki-link{url="https://www.poe2wiki.net/wiki/Gargantuan_Mana_Flask"} (Level 49) định nghĩa bởi 1 dòng: "This Flask cannot be Used but applies its Effect constantly." Không activation, không tốn charge, phục hồi mana liên tục không micro. User: caster + build nhiều aura reservation cần mana sustain thụ động.

## Chỉ số

```
Lavianga's Spirits
Gargantuan Mana Flask
Recovers (37–55.5) Mana over 2.00 Seconds
Consumes 10 of 75 Charges on use
Requires Level 49
──────────────────────────────────────────────
This Flask cannot be Used but applies its Effect constantly
(70–80)% reduced Amount Recovered
──────────────────────────────────────────────
"How do I cope with what I witnessed on Wraeclast?
Thank the Ancestors! My cup, it overflows."
- Lavianga, former advisor to Kaom
```

- Base Gargantuan Mana Flask = 185 mana/2s. "(70–80)% reduced Amount Recovered" cắt còn 20–30% → 37–55.5 mana/2s.

## Cơ chế always-on + recovery thực tế

- "Cannot be Used" = không nút uống, không tốn charge, không re-trigger. Luôn "đang dùng" — mỗi 2s hoàn thành 1 chu kỳ rồi restart ngay. "Consumes 10 of 75 Charges on use" trên tooltip = info base flask, không tác dụng thực (không bao giờ kích hoạt tay).
- Recovery/sec theo roll:

| Roll | Mana/2s | Mana/sec |
|---|---|---|
| 70% reduced (best) | 55.5 | 27.75 |
| 80% reduced (worst) | 37 | 18.5 |
| best + 20% :wiki-link{url="https://www.poe2wiki.net/wiki/Quality"} | 66.6 | 33.3 |
| worst + 20% quality | 44.4 | 22.2 |

- Flask Duration mod (tree) **không tăng tổng mana** — chỉ kéo dài chu kỳ 2s → giảm rate/sec, tổng/chu kỳ không đổi. Vd +50% duration: chu kỳ 3s, cùng 37–55.5 mana → 12.3–18.5 mana/sec. Build có flask duration mod phải tính.

## Build nào cần

- **Caster nhiều aura reservation:** reservation cắt max mana → pool mỏng cho skill cost; burst cost dễ cạn pool → dừng cast. Always-on bù liên tục không click, hơn hẳn flask mana thường ở encounter dài không downtime.
- **Skill mana cost cao/cast:** spell spam cast speed cao, hoặc skill qua nhiều :wiki-link{url="https://www.poe2wiki.net/wiki/Support_Skill"} → cost/cast tăng. 18.5–27.75 mana/sec thụ động giảm tải base mana regen + tree.
- Không cần: build không kẹt mana (attack ít skill cost, hoặc đã có "mana gained on kill"/"mana leech"). Flask mana thường roll tốt cho burst recovery cao hơn trong 2–4s active. Lavianga's chỉ thắng ở chiều duy trì liên tục no-micro.
- Không tương thích setup dùng flask chủ động trigger on-use / on-flask-use passive (không có "use" event).

## Version History

### Patch 0.4.0
- Item introduced.

## Relationships

- **related_mechanics** [Return of the Ancients](/guides/return-of-the-ancients) — overview 0.5.0, meta caster + reservation Runes of Aldur.
- **related_mechanics** [Stormweaver Infusion Mana Loop](/guides/stormweaver-infusion-mana-loop) — caster spam cast speed cao, archetype hưởng lợi nhất từ mana recovery thụ động.
- **related_mechanics** [0.5 New Unique Items Overview](/guides/0-5-new-unique-items) — danh sách unique mới 0.5, gồm mana-related.
- **related_builds** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — Gargantuan Mana Flask Cannot Be Used apply constantly, mở passive cluster "during flask effect".
