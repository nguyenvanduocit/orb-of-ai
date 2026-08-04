# T-051: /lootfilter tự upload filter lên POE2 account

> Thêm đường đẩy .filter thẳng lên account POE2 (pathofexile2.com filter SPA) qua playwriter DOM automation — không OAuth, không GGG app.

- **priority**: high
- **effort**: M

## Problem

`/lootfilter` hiện chỉ upload filter bằng SCP vào thư mục game trên máy Windows remote (cần máy đó, không sync cross-machine, không hiện trong dropdown account). User muốn filter tự đẩy lên **account POE2** giống FilterBlade "sync to account", kiểu OAuth-localhost của `/pob --oauth`.

Đã probe (T-051 investigation, 2026-06-15):
- OAuth borrow `client_id=pob` để xin `account:item_filter` → GGG trả `error=invalid_request, "An unsupported scope was requested"`. pob KHÔNG có scope filter. Reuse pob = bất khả.
- www.pathofexile.com/my-account/item-filters → POE1-only (`poe2:false`, form post `/item-filter/delete` cookie-based, không realm selector).
- **pathofexile2.com/my-account/item-filters → CÓ, quản lý filter POE2 đầy đủ** (account đang có 1 NeverSink 0.10.2a + 1 "leech"). SPA, internal-api `GET /internal-api/item-filters/filters?game=poe2`. Page-context fetch raw = **401** (DPoP session auth, đúng constraint T-013) → KHÔNG replay token được → phải DOM-drive.
- Create page `pathofexile2.com/my-account/item-filters/create`: text input (name) + **ACE editor** (`ace_editor`, body filter) + checkbox public + nút Submit. Realm implicit poe2.

## Goal

Một lệnh trong `/lootfilter` nhận file .filter local → validate bằng parser → đẩy lên account POE2 (tạo mới hoặc update filter theo tên) qua playwriter, dùng browser session đã login. Verify filter xuất hiện đúng trong list account.

## Requirements

- Transport = playwriter DOM automation trên `pathofexile2.com` (KHÔNG OAuth, KHÔNG raw internal-api vì DPoP 401). Reuse session login sẵn (như `/trade`).
- LUÔN validate filter bằng parser nội bộ TRƯỚC khi đẩy (chặn syntax lỗi lên account).
- Inject body vào ACE editor qua ACE API (`ace.edit(el).setValue(...)`), không type từng ký tự (5000+ dòng).
- Set name + public/type theo flag. Update = mở filter sẵn theo tên → ghi đè body → save (KHÔNG tạo trùng).
- An toàn account (đã từng bị flag): sleep 1-2s giữa mỗi DOM action, không chạy song song, fail-loud nếu không thấy field/nút.
- Verify sau upload: GET list (qua DOM/intercept) thấy filter tên đó, version/updated mới.
- Non-goal: bỏ đường SCP local (giữ song song); không đụng filter "Very strict"/"leech" sẵn có khi test.

## Criteria

- [x] Validate-fail thì abort TRƯỚC khi mở browser (test `/tmp/broken.filter` → "does not parse (line 2)", không tới bước playwriter)
- [x] Tạo mới filter lên account POE2 thành công, hiện trong list — user chọn upload THẬT thay vì throwaway: "NeverSink 3-STRICT" 0.10.2a 3-STRICT live trên account
- [x] Update lại chính filter đó (ghi đè body) KHÔNG tạo bản trùng — re-run → 1 occurrence duy nhất, timestamp 3:29→3:32
- [x] SKILL.md có section "Push Filter to Your POE2 Account" + lệnh + caveat DPoP/OAuth-scope/flag-safety
- [~] Cleanup throwaway: bỏ — user yêu cầu upload thật, filter giữ lại làm filter dùng được

## Resolution (2026-06-15)

Script `.claude/skills/lootfilter/scripts/push-to-account.ts`. Flow: parser-validate (class+numeric, no-network) → ghi body ra `/tmp/poe2-filter-body.txt` (tránh cmdline limit 252KB) → playwriter (`-s <session> --timeout 120000`) DOM-drive `pathofexile2.com`: tìm filter theo tên exact trong list → update `/my-account/item-filters/<id>` nếu có, else `/create`; set name + version qua React-native-setter, inject body qua `.ace_editor.env.editor.setValue`, click Submit, verify listed. Probe kết luận: OAuth `pob` thiếu scope `account:item_filter` (GGG "unsupported scope"), www = POE1-only → SPA same-origin là đường DUY NHẤT cho POE2. Gotcha: playwriter exec timeout mặc định 10s giết flow giữa chừng (submit vẫn chạy nhưng RESULT không in) → `--timeout 120000`. internal-api raw fetch = 401 (DPoP, như T-013) → bắt buộc DOM-drive. Verified live: create (POST 202) + update no-dup + abort-on-invalid.
