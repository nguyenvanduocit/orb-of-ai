# T-025: /economy-scan sinh HTML value-chain report từ template baked-in

> Bake template "bản đồ chuỗi cung ứng" (data-driven HTML) vào workflow economy-scan; supply-chains synth nâng lên model value-chain (farm→drop→craft→item→sink→buyer) + phân loại bottleneck cung/cầu, edge SOURCE từ patch+poe2db.

- **priority**: medium
- **effort**: M

## Problem
`economy-scan` hiện chỉ ra markdown pulse; phần supply-chains dùng model yếu "X scarce". User muốn mỗi lần chạy tự sinh HTML value-chain report như `tmp/economy-supply-chains-2026-06-05.md`→`.html` đã làm tay. Template phải nằm trong workflow để tái dùng, không hand-code mỗi lần (tránh hallucination cấu trúc HTML).

## Goal
Chạy `/economy-scan` → ngoài markdown pulse, sinh thêm `tmp/economy-supply-chains-<DATE>.html` vẽ chuỗi giá trị đầy đủ cho item nóng, edge có nguồn, bottleneck phân loại đúng (cung vs cầu vs sốc cung).

## Requirements
- Template data-driven `.claude/workflows/templates/economy-supply-chains.template.html`: CSS + JS render từ JSON `REPORT` (chains/nodes/ranking/provenance); marker `/*__REPORT_DATA__*/` để workflow inject; SAMPLE để render standalone. Self-contained, dark-mode, responsive, print (theo html-report checklist).
- Workflow: thêm agent `value-chain` (sonnet) SOURCE edge từ `data/release-notes/Version_0.5.0.md` (grep) + poe2db cho item nóng → output structured CHAINS (schema-enforced, mỗi node có `src` patch/poe2db/inference). KHÔNG hồi tưởng.
- Report stage mới: đọc template, inject JSON, ghi HTML. Giữ markdown pulse hiện có.
- Non-goal: macro SVG layout cầu kỳ — auto-layout đơn giản từ data là đủ.

## Criteria
- [ ] Template render standalone (mở bằng SAMPLE data → thấy chains + ranking, no JS error)
- [ ] `node -c`/parse `.claude/workflows/economy-scan.js` OK (script hợp lệ)
- [ ] Resume-run workflow (harvest cached, synth+report live) → `tmp/economy-supply-chains-<DATE>.html` sinh ra, HTML well-formed, chains có edge `src` labels
- [ ] Bottleneck phân loại: ≥1 supply-gated + ≥1 demand-pressure (không gọi mọi thứ là "scarce")
