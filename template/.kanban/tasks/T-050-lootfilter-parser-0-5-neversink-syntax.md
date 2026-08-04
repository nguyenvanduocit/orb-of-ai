# T-050: Lootfilter parser ăn được filter NeverSink/FilterBlade 0.5 thật

> Parser POE2 fail trên filter NeverSink 0.10.2a (0.5) vì syntax glued-operator; refresh fixture + data + sửa class mismatch + dọn doc.

- **priority**: high
- **effort**: M

## Problem

Skill `/lootfilter` (POE2-only) có parser PEG tự viết (`.claude/skills/lootfilter/parser/`). Test suite nội bộ pass 94/94 nhưng test toàn dùng filter hand-made — chưa từng validate filter NeverSink/FilterBlade thật. Tải bản 0.5 hiện hành (NeverSink `0.10.2a`, publish 2026-06-09) về `/tmp` rồi parse → **fail cả 3 strictness**:

- **Root cause #1 (parser bug):** grammar `numOperator __ integer` ép whitespace giữa operator và số. NeverSink viết glued `HasExplicitMod >=1 "Hellion's"` (và mọi numeric condition kiểu `>=1`). PEG báo `Expected [ \t] but "1" found` tại `poe2-filter.pegjs` — áp cho mọi rule `numOperator __ integer` (ItemLevel/AreaLevel/Quality/Sockets/StackSize/GemLevel/WaystoneTier/.../HasExplicitMod count).
- **Root cause #2 (class mismatch):** NeverSink dùng Class `"Expedition Logbook"` (số ít) nhưng `parser/src/types.ts POE2_CLASSES` ghi `'Expedition Logbooks'` (số nhiều) → `validateClasses` false-flag.
- **Doc drift #3:** `SKILL.md` line ~319 khẳng định POE2 không support `Sockets`/`GemLevel`, nhưng NeverSink 0.10.2a dùng cả hai (0.5 có rune socket) — grammar đã handle, chỉ doc sai.
- **Doc drift #4:** `SKILL.md` trỏ `parser/src/cli.ts` + `scripts/fetch-game-data.ts` (package.json `validate`/`fetch-data`) nhưng hai file KHÔNG tồn tại → lệnh trong doc chạy fail.
- **Stale #5:** sample local `filter/template-filter-donot-edit.filter` là NeverSink `0.9.1a` (pre-0.5). Chưa có sample 0.5 thật để regression.

## Goal

`/lootfilter` parse + validate sạch filter NeverSink/FilterBlade 0.5 thật (mọi strictness), có sample 0.5 trong repo làm fixture regression, và SKILL.md mô tả đúng khả năng hiện tại.

## Requirements

- Sửa grammar `poe2-filter.pegjs` cho whitespace giữa operator↔số là optional; regenerate `parser.js` qua `bun run build:grammar`.
- Iterate parse trên cả 3 bản tải (`0-SOFT`/`3-STRICT`/`6-UBER-PLUS-STRICT`) tới khi 0 parse-error; bắt mọi syntax gap thật, không chỉ cái đầu.
- Sửa `POE2_CLASSES` cho khớp tên class in-game NeverSink dùng (Expedition Logbook…), verify không phá class nào khác.
- Thêm fixture 0.5 thật vào `parser/test/fixtures/` + test khẳng định parse-clean + validate (errors=0) cho filter NeverSink 0.10.2a.
- Lưu sample 0.5 vào `filter/` (thay/bổ sung bản 0.9.1a stale).
- Dọn SKILL.md: bỏ tuyên bố sai về Sockets/GemLevel, sửa/loại reference `cli.ts`+`scripts/`, đánh dấu các TODO 0.5 đã verify, ghi rõ parser nhận glued-operator.
- Non-goal: viết lại validator data-layer (đang live-fetch poe2filter.com — chấp nhận); không build CLI mới trừ khi cần để test.

## Criteria

- [x] parse `/tmp/ns-{0-SOFT,3-STRICT,6-UBER-PLUS-STRICT}.filter` → 0 parse-error cả ba (455/427/268 blocks)
- [x] `validate(..., {validateClasses, validateBaseTypes:false})` cả 3 bản → 0 errors (basetype-warning từ poe2filter.com lag là advisory)
- [x] `bun test` xanh 97/97, gồm `test/neversink-0.5.test.ts` parse+validate fixture 0.5
- [x] không còn reference `cli.ts`/`fetch-game-data.ts` chết trong SKILL.md lẫn package.json
- [x] SKILL.md không còn câu "POE2 does NOT support Sockets/GemLevel" (rewrite: 0.5 CÓ Sockets+GemLevel)
- [x] Sample NeverSink 0.10.2a trong `filter/` (neversink-0.10.2a-3-STRICT + template-donot-edit refresh 0.9.1a→0.10.2a)

## Resolution (2026-06-15)

Root cause parser fail = grammar `numOperator __ integer` ép whitespace. Fix `poe2-filter.pegjs` (regen `parser.js`): (1) operator↔số thành optional `(numOperator _*)?` → ăn cả `>=1` glued lẫn operator-less `Height 1`; (2) +condition `AlwaysShow True`; (3) +minimap shape `Kite`. `types.ts` POE2_CLASSES: `Expedition Logbooks`→`Expedition Logbook` (poedb 52:6 + NeverSink xác nhận singular). Doc: SKILL.md sửa claim sai Sockets/GemLevel, gỡ dead cli.ts/scripts ref, TODO 0.5→status-block verified, +section sample filter download. `build:grammar` dùng `bunx peggy` (devDeps chưa install). 191 unknown-basetype warning = bases 0.5 thật (Dusk/Gloam/Penumbra/Tenebrous/Runic Fork) poe2filter.com chưa catalog — validator live-fetch nên tự clear khi upstream update.
