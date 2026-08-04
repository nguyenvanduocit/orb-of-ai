---
template: templates/mechanic-template.md
document_type: mechanic
title: Twister
status: published
author: duocnv
created: '2026-05-19'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.0
sub_class: skills
tags:
  - twister
  - whirling-slash
  - spear
  - projectile
  - wind
  - huntress
  - spirit-walker
  - poe2
  - mechanic
---

# Twister

:wiki-link{url="https://www.poe2wiki.net/wiki/Twister"} = spear attack skill, tags Attack/AoE/Projectile/Duration/Barrageable/Wind — Tier 1, từ Act 1. Không tự đứng: damage thật đến từ consume :wiki-link{url="https://www.poe2wiki.net/wiki/Whirlwind"} do :wiki-link{url="https://www.poe2wiki.net/wiki/Whirling_Slash"} dựng. Không Whirlwind → projectile tầm thường 80–232% base attack damage; đủ 3-stage → cùng một cast nhân ~12× qua consume compound. Hai điểm hay hiểu sai: **Gain** trong dòng elemental ground (không phải Convert), và throttle **0.66s** same-target (khoá hit rate lên boss).

## Engine hai tầng: Whirling Slash rồi Twister

- Whirling Slash tạo Whirlwind xoáy quanh, tích tối đa 3 stage (+1/cast). Whirlwind radius 1.8m, +0.3m/stage, kéo dài đến khi rời vùng hoặc bị Twister consume. Twister đi vào Whirlwind → consume toàn bộ: mỗi stage +1 twister, twister đó nhận 80% more damage nhân theo stage.
- 3-stage Whirlwind:
  - Base twister (không consume): 1× base
  - Stage 1: 1.80×
  - Stage 2: 1.80² = 3.24×
  - Stage 3: 1.80³ = 5.83×
  - **Tổng một cast đủ 3-stage: ~11.87× base damage** (trước crit/accuracy/resistance)
- Consume, không phải gem level, là trục damage chính: GL20 mới 232% base, nhưng hệ số 11.87× gánh phần lớn. Single twister spear endgame ~300 raw → cast 3-stage ~3.560 raw (300 × 11.87) trước modifier khác.
- Rotation bắt buộc: spin Whirling Slash 3 lần → Whirlwind đủ 3-stage trên ground → mới cast Twister. Cast khi chưa có Whirlwind → 1 base twister. Act 1 chậm vì chưa có support spin nhanh (~1.5–2s/lần chuẩn bị).
- Whirling Slash giữ **level 1** suốt endgame — chỉ dựng Whirlwind, không damage trực tiếp; level cao chỉ tăng mana cost + cast time.

## Elemental ground: Gain là added damage

> Elemental twisters Gain 50% of damage as damage of the corresponding Type

- **Gain** = cùng class "Gain X% of Damage as extra Y" — added damage, KHÔNG phải conversion. Physical base nguyên vẹn; 50% cold cộng thêm như pool riêng. Trên :wiki-link{url="https://www.poe2wiki.net/wiki/Chilled_Ground"}: mỗi twister = 100% physical + 50% cold = 150% total.
- Vì là Gain, cả physical node lẫn cold node scale Twister trên ground — stack physical vẫn full value trong cold Twister build.
- Nguồn Chilled Ground ổn định nhất: :wiki-link{url="https://www.poe2wiki.net/wiki/Fangs_of_Frost"} — spear attack tier 3, convert 80% phys→cold, hit target đang Parried → consume Parried Debuff tạo frost explosion + Chilled Ground 8s. Huntress có :wiki-link{url="https://www.poe2wiki.net/wiki/Parry"} từ đầu → chain Parry → Fangs of Frost → Chilled Ground → Twister chạy từ campaign.
- ✗ :wiki-link{url="https://www.poe2wiki.net/wiki/Wake_of_Destruction"} boots spawn Shocked Ground (lightning) không phải Chilled → Twister gain 50% lightning, vô nghĩa nếu scale cold.

## Throttle 0.66s (projectile count không scale boss DPS)

> Twisters fired at the same time can Hit the same target no more than once every 0.66 seconds

- Một batch (4/10/nhiều hơn) hit cùng boss tối đa 1/0.66 ≈ 1.515 lần/giây. Cast rate 0.8 cast/s (attack speed 80% base) → ~0.8 batch/s → effective hit rate trần ~0.8 × 1.515 ≈ **1.2 lần/giây lên boss**, không phụ thuộc projectile count.
- Projectile count tăng mạnh clear (mỗi enemy target độc lập, không chung throttle). Boss = một target → throttle khoá cứng.
- Boss DPS scale theo **damage per twister** (flat damage weapon, crit chance/multi, curse, exposure, consume multiplier), không theo projectile count.

## Salvo Support sau rework 0.5.0

- **Trước 0.5.0**: 1 seal/2s, max 3 seals, +2 projectile/seal; không earn seal khi đang cast.
- **Từ 0.5.0**: 1 seal/1s, max 6 seals, +1 projectile/seal; earn seal được cả khi cast. Max added projectile vẫn +6 (6 seals × 1). Bỏ restriction "không earn khi cast" → seal tích liên tục cả khi spin/cast, nhất quán hơn trong rotation.
- Projectile Salvo bay random direction — không nhắm boss; contribution lên boss nhỏ hơn nhiều so với clear.

## Spirit Walker owl feather với Twister

- :wiki-link{url="https://www.poe2wiki.net/wiki/Primal_Bounty_(passive)"} (notable Spirit Walker) grant Primal Bounty: định kỳ 1 Primal Owl Feather, max 3. Dodge roll consume 1 feather → empower next projectile attack (+projectile + projectile speed).
- :wiki-link{url="https://www.poe2wiki.net/wiki/The_Mhacha%27s_Gift"} (notable kế) enhance: consume tới 3 feathers một dodge roll, earn rate 4s → 2.67s.
- Với Mhacha full cycle: 3 feathers × 2.67s = ~8s. Empower trigger = dodge roll (không phải skill use) — không dodge đều → feather cap 3 rồi ngừng sinh. Boss cần cadence dodge khớp ~8s; nhiều boss telegraph ~8–10s nên feather cycle fit tự nhiên.
- Owl feather = lý do Spirit Walker là ascendancy tự nhiên nhất cho Twister (empower thẳng vào projectile count + speed, dodge vốn có trong boss fight).

## Anti-patterns

- ✗ Cast Twister trước khi Whirling Slash dựng đủ Whirlwind → 1 base twister. Spin ≥3 lần trước mỗi cast.
- ✗ Giữ Whirling Slash level cao endgame → đốt mana + cast time, 0 giá trị. Level 1 là chuẩn.
- ✗ Attack speed tăng cast rate không tăng damage per cast. Weapon set: main-hand (Twister) flat phys + flat cold + crit; Whirling Slash socket attack speed. Nhầm hai bộ support → rotation không smooth.
- ✗ Twister trên elemental ground không tạo ailment từ 50% Gain (Gain là added damage on hit). Freeze build-up cần nguồn riêng: Fangs of Frost, :wiki-link{url="https://www.poe2wiki.net/wiki/Frost_Nexus"} support, hoặc Freezing Mark curse.
- ✗ "Gain X% of Damage as extra Y" modifier không double-dip với Gain layer của Twister (apply on base hit). Đừng cắm :wiki-link{url="https://www.poe2wiki.net/wiki/Xoph%27s_Pyre"} để nhân cold gain.
- ✗ Stack projectile count cho boss DPS (throttle 0.66s) → đầu tư damage per twister hiệu quả hơn.

## Version History

### Patch 0.5.0 (Return of the Ancients)
- Salvo Support rework: 1 proj/seal, max 6 seals, 1 seal/giây; bỏ restriction không earn seal khi casting (trước: 2 proj/seal, max 3 seals, 1 seal/2 giây, không earn khi casting).
- Primal Bounty + The Mhacha's Gift (Spirit Walker Ascendancy) introduced — owl feather cycle empower next projectile attack on dodge roll, max 3 feather × 2.67s/feather với Mhacha.

### Patch 0.4.0
- Wind tag thêm vào Twister + Whirling Slash — synergy với Spirit Walker notables nhắm Wind skills.
- Whirlwind giữ element từ elemental ground 8 giây (trước 4 giây).

### Patch 0.3.0
- Twister damage buff: 80–232% attack damage ở gem level 1–20 (trước 72–190%).

### Patch 0.2.0b
- Hotfix bug "Gain 50% per projectile": element gain từng scale per projectile thay vì 1 lần per cast. Từ hotfix, Gain áp đúng 1 lần/cast bất kể projectile count.

### Patch 0.2.0
- Twister + Whirling Slash introduced.

## Relationships

- **used_by** [Tame Beast Companion Pack Spirit Walker](/builds/huntress/0-5-spirit-walker-companion-pack) — dùng Twister làm engine leveling gánh campaign trước khi pivot companion; DPS chain phụ thuộc Whirlwind consume.
- **related_mechanics** [The Taming](/guides/the-taming) — ring biến "Gain 50% as corresponding Type" thành triple elemental ground boost thường trực.
- **related_mechanics** [Spirit Walker Companion Beast Hunt](/guides/spirit-walker-companion-beast-hunt) — hướng Spirit Walker projectile dùng companion như utility layer thay carry.
- **related_builds** [Spear Twister Ritualist và Amazon](/builds/huntress/0-5-twister-ritualist-amazon) — engine consume Whirlwind, throttle 0.66s, element gain từ ground.
- **related_builds** [Twister Spirit Walker](/builds/huntress/0-5-spirit-walker-twister) — engine consume Whirlwind, throttle 0.66s, Salvo rework, owl feather Primal Bounty empower.
- **synergizes_with** [Herald of Ice Shatter](/guides/herald-of-ice-shatter) — cold Twister freeze enemy rồi shatter, Herald of Ice gánh clear pack cho cùng cú đánh.
