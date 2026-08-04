# T-036: Carry tracker — auto-fill row từ whisper của buyer

> Parse whisper `@From` trong Client.txt — khi buyer nhắn template "WTB level 78 to 90", tự tạo row pre-fill Start/Target.

- **priority**: medium
- **effort**: S

## Problem

Buyer được dặn whisper người bán theo template (vd `@Sparktito WTB level xx to xx`, `lvl from xx to xx`). Whisper đó nằm trong Client.txt nhưng carry tracker (T-034/T-035) cố tình bỏ qua mọi dòng chat (neo `] : ` để whisper không giả mạo level-up). Nên người bán phải tự gõ tay tên + range mỗi buyer, trong khi thông tin đã có sẵn trong log.

Format whisper verified từ `client_strings.js` (Exiled-Exchange-2): `… [INFO Client N] @From (?:<guild> )?<name>: <body>`.

## Goal

Buyer whisper "WTB level 78 to 90" → một row tự hiện trong tab Party với tên buyer + Start 78 + Target 90 pre-fill, người bán chỉ việc mời vào party.

## Requirements

- Parse dòng whisper incoming (`@From`, bỏ qua `@To` và channel khác) trong `carry-match.ts` → event `whisper` mang name + body + fromLevel/toLevel.
- Trích range từ body: "78 to 90", "78-90", "lvl 78 đến 90"… Chỉ tạo row khi parse được range hợp lệ (from<to, 1..100) + guard nhẹ chống chat rác (có keyword service HOẶC from≥40).
- Whisper đi nhánh RIÊNG — không bao giờ set `level`/`deaths` (không spoof được level-up).
- applyEvent whisper: pre-fill startLevel/targetLevel CHỈ khi field còn trống (không đè giá trị người bán đã sửa); không set present/level (buyer chưa join).
- UI: row từ whisper (chưa join) hiện tag nhỏ "📩" + tooltip = nội dung whisper.
- Sim `tmp/sim-client-txt.ts` emit whisper trước khi buyer join để test được.

## Criteria

- [x] `bun run tmp/carry-match.test.ts` pass — whisper có range → event đúng; whisper không range / `@To` / chat thường → null; vẫn không spoof level-up. (24 assertions, +9 whisper cases gồm guild-tag strip + "đến" range)
- [x] `bun run generate` pass. (exit 0, 484 routes, 0 errors — request field + whisper branch + 📩 tag compile/prerender)
- [x] Sim emit whisper → row tự hiện với Start/Target pre-fill; sau đó buyer join + level-up fill Lv mà không mất Start/Target. (sim emit 3 whisper parse đúng order; ingest→prefill dùng cùng path applyEvent đã proven live cho level/join/leave/slain — nhánh whisper chỉ set request + fill start/target-if-null. LƯU Ý: live file-read không tự test được — FSA picker + requestPermission là native dialog Playwright không drive được; user confirm bằng 1 gesture)
- [x] Người bán sửa Start/Target rồi, whisper lại không đè field đã sửa. (applyEvent whisper: `if (startLevel == null)` / `if (targetLevel == null)` — chỉ fill ô trống)

## Notes

- Verify machine-verified: parser (whisper→order, HIGH) + build (HIGH). Ingest→UI link = by-construction (same proven ingest path + trivial whisper branch). Browser file-read E2E không automate được (native picker/permission) → user live-confirm.
- Files: `carry-match.ts` (+whisper event, `@From` parse, range+service-keyword guard), `useCarryTracker.ts` (+`request` field, whisper branch fill-if-null), `CarryTracker.vue` (📩 chờ tag + tooltip), `tmp/sim-client-txt.ts` (emit whisper trước join).
