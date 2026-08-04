# T-027: Transport vỡ khi response > ~10KB (playwriter cap console.log)
> poeFetch dùng file làm result channel thay console.log — bỏ trần 10KB của playwriter CLI

- **priority**: high
- **effort**: S

## Problem

`poe-trade/ggg/transport.ts` trả kết quả page-context fetch qua
`console.log(__marker + JSON.stringify(__out))` rồi parse dòng stdout đó. Nhưng **playwriter
CLI cap console.log output ở ~10,000 ký tự** — log 50KB chỉ ra ~10KB file. Response nào
stringify > ~10KB bị cắt giữa string → `JSON.parse` ném `Unterminated string`.

Evidence: search (`name:"Sylvan's Effigy"` → ~7KB) parse OK; fetch-detail 5 item (>10KB) →
`FETCH FAIL: JSON Parse error: Unterminated string`. Probe: `console.log("A".repeat(50000))`
→ file chỉ 10,071 bytes. Sandbox `require("fs").writeFileSync(path, "B".repeat(50000))` ghi
đủ 50,000 bytes (không cap). → fetch-detail của mọi `/trade`/`/gear-upgrade` đang chết.

## Goal

poeFetch lấy kết quả qua **file** (sandbox `fs.writeFileSync` vào temp dir đã có) thay vì
stdout, nên payload lớn cỡ nào cũng nguyên vẹn — fetch-detail multi-item work lại.

## Requirements

- Sandbox script ghi `__out` (JSON) ra `result.json` trong temp dir transport đã tạo, qua
  `require("fs")` (đã verify available).
- poeFetch đọc file đó TRƯỚC khi `rmSync` temp dir; parse từ file, không parse stdout.
- File thiếu/rỗng = playwriter không chạy xong (extension chưa connect / sandbox crash) →
  giữ error rõ ràng cũ, dùng stdout/stderr làm diagnostic.
- Bỏ `RESULT_MARKER` + `__marker` (dead sau khi đổi channel) — không để lại residue.
- Giữ nguyên rate-limit / lockfile / spacing / auto-open (T-026).

## Criteria

- [x] `poeFetch` GET fetch-detail 5-10 item trả `{result:[...]}` đủ, không `Unterminated string`.
- [x] `trade-search.ts --name "Sylvan's Effigy" --limit 5 --json` chạy xong + in URL trade2.
- [x] Response nhỏ (data/leagues) vẫn work.
- [x] Extension chưa connect → vẫn báo lỗi rõ, không crash.
- [x] `grep -c RESULT_MARKER transport.ts` = 0 (đã prune).
