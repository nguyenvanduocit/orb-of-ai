---
name: craftofexile
description: "Hướng dẫn craft item POE2 bằng cách lái craftofexile.com/?game=poe2 live qua playwriter — dịch intent (base + mod muốn + method) thành id của CoE, để CoE TỰ tính xác suất + chi phí, đọc số về + screenshot, rồi viết plan craft từng bước. Dùng khi user hỏi 'craft cái này thế nào', 'xác suất hit mod X bao nhiêu', 'bao nhiêu chaos/exalt để ra item Y', 'hướng dẫn craft ring/spear/amulet', 'craft of exile', 'coe'. Chỉ cho orb/essence crafting — KHÔNG model league bench (Runeforging/Runic Recipe)."
version: 1.0.0
tags: [crafting, probability, poe2, playwriter, craftofexile]
---

# Craft of Exile POE2 — driver hướng dẫn craft

[Craft of Exile](https://www.craftofexile.com/?game=poe2) là crafting probability engine chuẩn cho POE2: chọn base + ilvl + method (orb), đánh dấu mod muốn, nó tính xác suất hit mỗi lần roll và expected cost. Skill này **lái site đó live qua playwriter** — không bao giờ tự tính lại math. Engine của CoE là máy tính; skill là người phiên dịch intent + tài xế browser + người đọc số.

Luồng một câu: user nói muốn craft gì → resolve sang base/mod id của CoE → navigate CoE với state-URL → CoE auto-compute → đọc xác suất + cost + screenshot → viết plan craft.

## Khi nào dùng

- "Craft một ring có life + fire res tốn bao nhiêu?" → xác suất + cost thật.
- "Spear này chaos spam để ra phys + attack speed thì trung bình mấy lần?"
- "Exalt thêm một suffix vào item magic, khả năng trúng cold res là bao nhiêu?"
- So sánh method: alch-spam vs chaos-spam vs essence cho cùng một target.

## Khi nào KHÔNG dùng

- League bench 0.5 — **Verisium Runeforging, Runic Recipe, Remnant** — CoE không model. Những thứ này là meta-craft riêng, không phải orb probability. Đừng hứa hướng dẫn được.
- Giá item thành phẩm trên thị trường → `/trade` hoặc `/poe-ninja`.
- Roll range tĩnh của một mod (không cần xác suất) → `/poedb`.

## Prerequisite

Giống `/trade`: cần Chrome của user **đang mở** + Playwriter **bật trên một tab bất kỳ** (click icon extension). Đây là site ngoài (không phải GGG) nên **không có rate-limit-flag** — không cần spacing 2s, không cần login. Driver tự mở tab craftofexile.com nếu chưa có.

Nếu báo "extension not connected" → bảo user click icon Playwriter trên một tab Chrome.

## Cách dùng — CLI driver

Mọi lệnh chạy từ `.claude/skills/craftofexile/scripts/`:

```bash
# Tra base id theo tên
bun craft.ts --search-base "spear"

# Liệt kê method craftable (đã verify từ poec_methods)
bun craft.ts --list-methods

# Liệt kê mọi affix craft được trên một base + tier ilvls của chúng
bun craft.ts --base "Ring" --list-mods

# Lái CoE: tính xác suất + cost để hit các mod muốn
bun craft.ts --base "Ring" --ilvl 84 --method alchemy \
  --mod "maximum Life" --mod "Fire Resistance"
```

Output craft là JSON:

```json
{
  "base": "Ring", "ilvl": 84, "method": "Orb of Alchemy",
  "target": [{"mod": "+# to maximum Life", "affix": "prefix", "requiredTierIlvl": 1}, ...],
  "avgAttempts": 78, "costChaos": 3.963, "confidencePct": 63.449,
  "screenshot": "/tmp/coe-craft-ring-84.png",
  "coeUrl": "https://www.craftofexile.com/?game=poe2&b=1&lv=84&m=alchemy&req=..."
}
```

`avgAttempts` = số lần orb trung bình để trúng TẤT CẢ mod muốn. `costChaos` = chi phí quy về Chaos Orb mà CoE tính. `confidencePct` = độ tin (CoE's confidence metric). `screenshot` = ảnh kết quả đầy đủ (bảng per-mod %, avg tries từng mod, currency breakdown) — Read nó để lấy chi tiết per-mod.

**Luôn đọc `target[].mod` trước khi quote số.** Resolver match mod theo substring tên, chỉ lấy affix explicit (prefix/suffix — loại corrupted/implicit vì orb không roll được), và nếu query mơ hồ (vd "Resistance" trúng cả 7 mod) thì in `note:` ra stderr liệt kê các mod khác đã trúng. Nếu `target[].mod` không khớp ý định (vd định craft "Cold Resistance" pure mà nó lấy hybrid), refine `--mod` cho cụ thể hơn rồi chạy lại. Số chỉ đúng khi mod resolve đúng.

Với method `pre` (exalted/chaos/regal/annul), số giả định **item nền mặc định** của CoE (rare/magic chưa có mod cụ thể nào). Khi viết plan từ con số exalt, nói rõ "trên item nền X mod sẵn" để user không đọc 21 lần như vô điều kiện.

Sau khi có số, **viết plan craft cho user**: method nào, mỗi lần tốn gì, trung bình mấy lần, kỳ vọng tổng cost, và khi nào nên đổi chiến thuật (vd "nếu quá 2× avg mà chưa trúng thì scour làm lại").

### Tier hint cho mod

Mặc định mỗi `--mod` yêu cầu mod đó ở **bất kỳ tier nào** (chỉ cần có mod). Muốn ép một tier roll cao thì thêm `#<tierIlvl>`:

```bash
# Yêu cầu maximum Life ở tier có ilvl >= 46 (tier cao), Fire Res bất kỳ tier
bun craft.ts --base "Ring" --ilvl 84 --method alchemy --mod "maximum Life#46" --mod "Fire Resistance"
```

`--list-mods` in ra tier ilvls hợp lệ của từng mod để biết chọn số nào. Driver snap `#N` xuống tier ilvl hợp lệ gần nhất ≤ N.

## Method reference

7 method cơ bản (verified live từ `poec_methods`, 2026-06-09). `pre` = method cộng-thêm, chạy trên item đã có sẵn mod:

- `transmute` — Orb of Transmutation (normal → magic, thêm 1 mod)
- `augmentation` — Orb of Augmentation `pre` (thêm mod vào magic)
- `alchemy` — Orb of Alchemy (normal → rare, full roll)
- `regal` — Regal Orb `pre` (magic → rare)
- `exalted` — Exalted Orb `pre` (thêm mod vào rare)
- `chaos` — Chaos Orb (reroll/đổi mod trên rare)
- `annul` — Orb of Annulment `pre` (xoá 1 mod)

Essence + Omen + Desecration là advanced method (CoE có data: 81 essence, omen modifiers) nhưng driver hiện chưa expose chúng qua CLI — dùng `e=<id>`/`om=<id>`/`am=<id>` trong state-URL khi cần (xem dưới).

## Cơ chế bên trong

CoE là SPA, toàn bộ state craft sống trong global `poec_*` và **encode được vào query string**. Driver lợi dụng chính bộ deserialize onload của CoE để dựng state — robust hơn nhiều so với script hoá wizard nhiều bước của nó:

```
https://www.craftofexile.com/?game=poe2&b=<id_base>&lv=<ilvl>&m=<method>&req=<JSON>
```

- `b` = id_base, `lv` = ilvl, `m` = method key, `bi` = id_bitem (base variant cụ thể), `e` = essence id, `om` = omens, `am` = advanced method.
- `req` = `encodeURIComponent(JSON.stringify({ "<id_modifier>": {"l": <tier_ilvl>}, ... }))` — các mod bắt buộc, `l` là tier ilvl yêu cầu.

**CoE auto-compute ngay khi load** — driver chỉ poll `#poecConfidenceResult` cho tới khi có số rồi đọc, KHÔNG gọi `poec_computeFinalProbsV2()` tay (gọi tay nó throw cho method `pre` vì bỏ qua bước setup affix-group page chạy lúc load). Số đọc từ: `#poecConfidenceResult` (confidence%), `#poecCurrencyOutput` (avg tries + chaos cost), `#poecAffixes .affix.req` (mod đang required). Screenshot toàn trang cho user xem bảng đầy đủ.

## Data — id-map reference

`data/craftofexile/poec_data.json` (+ `poec_common.json` cho league map) là snapshot id-map của CoE, chỉ để dịch tên ↔ id, KHÔNG chứa math. Schema chính:

- `bases.seq[]` `{id_base, name_base, id_bgroup}` — 80 base
- `bitems.seq[]` `{id_bitem, id_base, name_bitem}` — 1775 variant
- `modifiers.seq[]` `{id_modifier, name_modifier, affix, id_mgroup}` — 1318 mod (`#` trong tên = chỗ điền giá trị)
- `basemods[id_base]` = `[id_modifier]` — mod hợp lệ trên base
- `tiers[id_modifier][id_base]` = `[{ilvl, weighting, nvalues}]` — bảng tier PER-BASE
- `essences.seq[]`, `socketables` (rune/soul core), `catalysts`

Refresh khi stale (CoE version data theo unix-ts; data hiện ~current league):

```bash
bash .claude/skills/craftofexile/scripts/refresh.sh
```

Script strip prefix JS-assignment (`poecd=`/`poecc=`) → lưu JSON sạch. League hiện tại = id 20 "Return of the Ancients" (POE2 0.5, là main league nên không cần `lg=`).

## Gotchas

- **Sandbox playwriter chỉ ghi được `/tmp`** — ScopedFS reject macOS `$TMPDIR` (`/var/folders/...`) với EPERM. Result json + screenshot bắt buộc dưới `/tmp`. (Đã handle trong `craft.ts` qua `const TMP='/tmp'`.)
- **Đừng force compute** — `poec_computeFinalProbsV2()` gọi tay throw `null[1]` cho chaos/exalted/regal/annul/augmentation. CoE tự compute lúc load; driver poll thay vì trigger.
- **Method `pre` cần item nền** — chaos/exalt/annul chạy trên rare/magic có sẵn. CoE setup item nền mặc định khi load; nếu muốn item nền cụ thể (đã có sẵn mod X rồi mới exalt) thì cần thêm state — chưa expose qua CLI.
- **Session playwriter** — cache ở `~/.coe-playwriter-session`. Nếu drive lỗi "no result / executor error" → `playwriter session reset <id>` rồi thử lại; driver tự tạo session mới nếu stale.
- **Read-only** — driver chỉ ĐỌC số + screenshot. Không whisper, không craft thật trong game. Output là hướng dẫn để user tự craft.
