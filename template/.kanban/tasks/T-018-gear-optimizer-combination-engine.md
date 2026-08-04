# T-018: Gear-optimizer — offline-confidence-first, trade chỉ price-check

> Tool /gear-upgrade: dựng confidence về một combo gear HOÀN TOÀN offline bằng PoB2 calc trên synthetic item **constructible thật** (mod roll được + tier có thật, lấy từ canonical mod-query file extract từ PoB data). Chỉ khi đã chắc combo mới đi trade — và lúc đó trade chỉ trả lời "có hàng không, bao nhiêu". Một Workflow orchestrate fetch→audit→sinh giả thuyết phân kỳ→search offline→adversarial verify→price-check.

- **priority**: high
- **effort**: L

## Problem
Engine `gear-optimize.py` bản đầu để **trade nằm trong inner loop**: prune best-case → fetch trade item thật → combo-sim bằng item thật để *validate*. Trade rate-limited (≥2s/call tuần tự, account từng flag) nên đốt lượt trade chỉ để test giả thuyết → cực kỳ chậm, đúng cái cần loại bỏ. Thêm hai lỗ hổng: (1) synthetic item chỉ là list mod, không check affix prefix/suffix-count / group / base-roll-validity → PoB calc vui vẻ một "mod salad" không tồn tại → confidence GIẢ; (2) SKILL.md mô tả manual XML-swap, không hề tham chiếu engine — doc và code diverge.

Ví dụ sống: ThaoCamVienSaiGon fire crash xuống thấp sau khi đổi evasion piece; phải redistribute cold-overcap → fire qua nhiều slot cùng lúc giữ Int≥82 + Spirit, không greedy 1 stat được (penalty + cap khiến res không hand-computable).

## Goal
Kiểm nghiệm giả thuyết "cân bằng chỉ số giữa các item" bằng số PoB đo được, offline, trước khi tiêu bất kỳ lượt trade nào; trade tách hẳn thành bước cuối chỉ để price-check combo đã chốt. PoB chứng thực **defensive + hard-constraint envelope** (res/life/eva/ES/Int/Spirit); damage companion/minion (PoB combinedDPS=0 cho char này) reason tay làm tie-breaker có gắn nhãn rõ.

## Requirements
- **Canonical mod-query file** `data/gear-mods/<patch>-gear-mods.json` extract từ `data.itemMods.Item` + `data.itemBases` (chạy Lua trong runtime PoB, reuse data engine calc dùng): mỗi mod gồm `affix/type(Prefix|Suffix)/group/level/value-range/tradeHashes/rollsOn(base tags)` + base catalog (slot/tags/implicit). File này = nguyên liệu DUY NHẤT để (a) dựng synthetic item constructible + (b) sinh trade filter đúng stat ID — không recall hash.
- **Engine tách `search` (offline) + `price` (trade-only):**
  - `search <spec>`: dựng synthetic item TỪ canonical file (base + affix-valid mods, đúng prefix/suffix count + group-distinct, ở tier chọn được), cross-product plan × tier-variant, sim song song trong PoB, validate hard-constraint, rank theo soft + độ-khó-roll. Output: per-slot target của combo thắng. KHÔNG chạm trade.
  - `price <spec> --combo <chosen>`: mỗi slot trong combo search trade securable MỘT lần → listing thật + giá + URL; re-sim 1 combo bằng item thật rẻ-nhất-đạt-target để chốt còn pass hard-constraint. Roll affordable rớt dưới target = tín hiệu DUY NHẤT loop về search đổi target, KHÔNG hammer trade.
- Constructibility validator: reject synthetic item vi phạm affix-count / group / base-roll (dùng canonical file).
- Pin baseline XML từ fresh OAuth fetch — KHÔNG re-import live giữa loop (drop unique → fake spirit/fire). Sanity-check audit khớp stat thật trước khi build combo.
- Stat ID trade filter lấy từ canonical file (hoặc bảng verified SKILL.md) — không recall.
- **Workflow** `gear-upgrade.workflow.js`: Phase0 fetch+pin+audit (sequential) → Phase1 N agent sinh giả thuyết phân kỳ (mỗi agent 1 philosophy, ĐỀU đọc canonical file làm ground-truth, không hallucinate hash) → Phase2 synth spec → Phase3 engine `search` offline (gate) → Phase4 adversarial verify combo thắng → Phase5 engine `price` (lần DUY NHẤT chạm GGG) → Phase6 present. Agent song song chỉ cho divergent-gen + verify; engine tự lo parallel sim; Phase trade tuần tự.
- SKILL.md rewrite reconnect engine + canonical file + workflow + triết lý "confidence trước, trade sau"; manual XML xuống appendix.
- Không auto-whisper — present combo + cost + trade URL, chờ user.

## Criteria
- [x] `data/gear-mods/0.5.0-gear-mods.json` tồn tại (428 mod / 1108 base / 21 axis), mỗi mod có tradeHashes + tier range + rollsOn + affix type; fire-res suffix trên ring = 8 tiers (6-10%→41-45% đúng bậc POE2), tradeId `explicit.stat_3372524247` khớp bảng verified; companion_level ghi `tradeOnlyAxes` (PoB 0.4 không construct được).
- [x] `gear-optimize.py search` chạy offline KHÔNG trade call (static-analysis xác nhận codepath; Chrome irrelevant) — test fire-fix: 88/136 combo PASS toàn hard-constraint, winner Prismatic-ring+fire-belt cap cả 3 res giữ Int margin; ring 4-suffix bị reject INFEASIBLE (constructibility enforced).
- [x] `gear-optimize.py price` chỉ chạm GGG ở bước này (poeFetch ≥2s+backoff), ra giá + trade URL securable + re-sim item thật. Demonstrated live: target Ruby Ring (implicit-aware pseudo_fire≥63) → 4-mod ring 0 hàng (loop-back signal đúng) → nới 3-mod → "Rune Eye Ruby Ring" 100ex, re-sim thật fire **74** (engine bắt 74<75, flag loop-back trung thực thay vì giả pass).
- [x] Workflow chạy live trên ThaoCamVienSaiGon end-to-end (wf_ec4b19a0-9dc, 7 agent / 468 combo): fresh OAuth → **baseline body-corrected** (export drop Enfolding Dawn, re-inject từ raw charData → fire −22→7, spirit −29→+22, [[project_oauth_export_drops_body]]) → search offline → verify → diagnose. Workflow tự chẩn fire là blocker + agents sai khi swap body (nguồn fire). Corrective offline search (giữ body/amulet, dồn fire vào Ring 2 Gold→Ruby) → winner cap fire+light 1-slot, price thật 100ex (fire 74, 1 short of cap — close-gap options surfaced). No auto-whisper.
- [x] SKILL.md v3.0.0 tham chiếu engine (search/price split) + canonical file + workflow + triết lý "confidence offline trước, trade sau"; manual XML xuống appendix. Regression: `search` tìm được fire-fix combo (thay cơ chế prune cũ bằng synthetic-combo search constructible).
