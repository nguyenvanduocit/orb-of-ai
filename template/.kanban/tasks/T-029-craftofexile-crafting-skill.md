# T-029: Skill `/craftofexile` — drive Craft of Exile POE2 để hướng dẫn craft

> Một skill điều khiển craftofexile.com/?game=poe2 live qua playwriter: dịch intent craft của user → set base + required mods + method trên CoE → đọc xác suất/chi phí CoE tự tính + screenshot → viết plan craft từng bước trong chat.

- **priority**: medium
- **effort**: M

## Problem

Khi user hỏi "hướng dẫn craft item X" chưa có công cụ nào trong workspace trả lời được "method nào, xác suất hit mỗi lần, expected cost". `/poedb` chỉ cho roll range tĩnh, `/trade` chỉ cho giá item thành phẩm. Craft of Exile (craftofexile.com/?game=poe2) là crafting probability engine chuẩn cho POE2 — model đủ orb/essence/omen/desecration crafting — nhưng hiện phải mở browser bấm tay, không tích hợp được vào chat.

Đã verify kiến trúc CoE POE2 (2026-06-09):
- Data tĩnh client-side: `json/poe2/main/poec_data.json` (`poecd=`) — 1775 bitems / 80 bases / 1318 modifiers / 1300 tier-weight tables / `basemods` (base→mods) / `modbases` (mod→bases) / 81 essences / 287 socketables. Plus `poec_common.json`, `prices/poec_prices.json`, `lang/poec_lang.us.json`. Versioned `v≈1780940397` (~2026-06-08, đang maintain cho league hiện tại).
- Engine xác suất client-side: `js/poe2.js` + `packages/package.js` — `poec_computeFinalProbsV2`. Model: Transmute/Augment/Regal/Exalt/Chaos/Annul/Alchemy + Essence + Omens + Desecration + Whittling.
- Trạng thái craft phơi ra qua globals: `poec_cBase`, `poec_nBase.i` (bitem), `poec_cMethod`, `poec_cEssence`, `poec_cOmens`, `poec_cILvl`, `poec_cSettings` (required mods: `{id_modifier: {l: tier_level}}`), `poec_cLeague`. Share-link encode hết qua query string (`b/bi/m/e/om/lv/req=JSON(poec_cSettings)/...`).
- `ajax/get_recipees.php` (recipe DB) tồn tại nhưng trả HTTP 500 khi probe blind → community-content chất lượng 0.5 chưa rõ → KHÔNG làm cornerstone.

## Goal

User gõ "/craftofexile <mô tả item>" (hoặc "hướng dẫn craft ...") → nhận lại plan craft từng bước với xác suất + expected cost do chính engine CoE tính, kèm screenshot kết quả, không phải tự bấm web.

## Requirements

- **Mechanism = full browser-drive qua playwriter** (user chọn): skill điều khiển craftofexile.com/?game=poe2 đang chạy trong Chrome của user, set base + required mods + method, đọc số CoE tính ra, screenshot. Ưu tiên drive qua page-context JS (`evaluate_script` gọi global/function của CoE + đọc DOM kết quả) hơn là click toạ độ — robust trước khi CoE đổi DOM. Click-driven chỉ là fallback.
- **KHÔNG reimplement math xác suất của CoE.** JSON của CoE chỉ dùng để id-mapping (tên base/mod → id, tra tier/ilvl, danh sách mod hợp lệ cho base) và reference. Mọi P(hit)/cost lấy từ engine CoE. (Non-goal cứng — vi phạm = mất lý do dùng site + tạo hố divergence mỗi patch.)
- **Scope = orb/essence/omen/desecration crafting** (đúng cái CoE model). KHÔNG hứa hướng dẫn league bench 0.5 (Verisium Runeforging, Runic Recipe / Remnant) — CoE không model. SKILL.md nói rõ ranh giới này.
- **Prerequisite tường minh**: Chrome mở + tab craftofexile.com/?game=poe2 + Playwriter bật trên tab đó (giống các skill GGG nhưng đây là site ngoài, không rate-limit-flag — không cần spacing 2s của transport GGG).
- **Data snapshot refreshable**: cache `poec_data.json` (+ common/lang/prices) về `data/craftofexile/` (id-map reference, gitignore tuỳ size). Refresh script kéo lại khi stale. KHÔNG để data trong skill folder (rule workspace).
- Code/script sống ở `.claude/skills/craftofexile/` (scripts trong subfolder), theo convention skill khác. Prose SKILL.md tiếng Việt, English term inline.
- Theo `feedback_model_routing_cost` nếu có sub-agent: không pin Opus cho fetch/extract.

## Criteria

- [x] `.claude/skills/craftofexile/SKILL.md` tồn tại: mô tả mechanism (browser-drive qua playwriter), prerequisite, non-goal (no math reimpl, no league bench), workflow intent→drive→read→plan, và bảng id-map/method reference đã verify từ data thật.
- [x] Có driver (script hoặc playwriter recipe đã document trong SKILL.md) thực sự: navigate CoE POE2 → set 1 base + ≥1 required mod + 1 method → đọc được con số xác suất/cost CoE tính ra → screenshot. Selector/global đọc-được verify bằng live exploration thật (không bịa selector).
- [x] Refresh script kéo `poec_data.json` (+ common/prices/lang) về `data/craftofexile/`, strip prefix `poecd=`/`poecc=`, parse OK; SKILL.md ghi cách refresh.
- [x] Demo end-to-end 1 ví dụ craft thật (vd: một base spear/ring + 2-3 mod mong muốn) → chạy driver → trả về xác suất + cost + screenshot + plan từng bước. Paste output làm bằng chứng.
- [x] SKILL.md ghi rõ scope orb/essence-only + giới hạn (CoE không model Runeforging/Runic Recipe), và prerequisite Chrome+Playwriter.
