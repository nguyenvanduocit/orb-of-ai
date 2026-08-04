# T-047: Web-based price check — Ctrl+C clipboard + PiP overlay
> Trang `/price-check` trên site: copy item trong game bằng Ctrl+C, overlay PiP nổi trên game tự đọc clipboard và hiện giá — không cần cài app.
- **priority**: high
- **effort**: M

## Problem
Mọi tool price-check hiện tại (Awakened PoE Trade, Exiled Exchange 2, Sidekick) đều là desktop app phải cài — overlay native + global hotkey + đọc clipboard nền. User muốn web-based thuần, không cài gì.

Constraint browser đã verify:
- **Global hotkey khi game đang focus = bất khả thi cho web page.** Browser chỉ nhận keyboard event khi nó focus. Không có API nào (Keyboard Lock chỉ hoạt động khi fullscreen chính browser) cho phép web page bắt phím lúc app khác focus.
- **Clipboard là cây cầu:** POE2 client hỗ trợ Ctrl+C copy nguyên văn item text đang hover (đúng cơ chế Exiled Exchange 2 dựa vào — `data/github-research/Exiled-Exchange-2`). Web page đọc được clipboard qua `navigator.clipboard.readText()` khi document focused + permission `clipboard-read` đã grant (Chrome prompt 1 lần, nhớ vĩnh viễn theo origin).
- **Overlay nổi trên game:** Document Picture-in-Picture window luôn always-on-top, đè lên game khi game chạy Windowed/Borderless. Engine đã có sẵn: `app/composables/usePictureInPicture.ts` + `app/components/PipPanel.vue` (T-042).
- **Giá KHÔNG gọi được api.poe2scout.com từ browser:** CORS lock origin `https://poe2scout.com` (verified 2026-06-12: GET với Origin khác không trả `access-control-allow-origin`). Nguồn giá = build-time index đã có sẵn `app/composables/data/prices.generated.ts` (`useItemPrice`, rebuild qua `.github/workflows/collect-prices.yml` từ poe2scout). KHÔNG gọi GGG API từ site (CORS + workspace rule).

## Goal
Đứng trong game, hover item → Ctrl+C → click cửa sổ PiP đang nổi → thấy giá ngay. Zero app cài thêm, chỉ Chrome/Edge + site.

## Requirements
- Page `app/pages/price-check.vue` + parser `app/composables/item-parse.ts` (pure module, test được như `carry-match.ts`): parse clipboard item text POE2 (Item Class / Rarity / name / base / mods — format tham khảo Exiled-Exchange-2 parser).
- Auto-read flow: lắng `window focus` event (cả trên PiP window lẫn main page) → `navigator.clipboard.readText()` → nếu text là item POE2 hợp lệ thì parse + lookup + render. Fallback luôn-hoạt-động: paste event (Ctrl+V) + nút "Dán" trong PiP — Firefox/Safari không có readText persistent permission.
- Price lookup theo loại item:
  - Currency / unique / fragment / rune...: `useItemPrice` static index (giá exalted + divine, staleness flag sẵn có).
  - Rare (giá theo mod): không định giá tĩnh được → render nút deep-link mở `pathofexile.com/trade2/search/poe2/<league>?q=<json>` prefill query từ mods đã parse (mở tab official site, không phải API call). PoC xác nhận trade2 có nhận `?q=` GET prefill như trade1 — nếu không nhận thì degrade còn copy-query-JSON.
  - Item không có trong index → hiện "Chưa có giá" (index chỉ chứa item ≥5ex từ collect.py — gap này chính là tín hiệu item rẻ).
- Hotkey TRONG page khi page/PiP focus: Ctrl+V dán, ESC clear. Không hứa hotkey global.
- **Polling nền = bất khả thi pure-web (verified 2026-06-12):** Chrome gate đọc clipboard theo document focus — page/PiP không focus thì không đọc được, và khi permission còn `prompt` thì `readText()` TREO chờ user bấm dialog (đo thật: hung >3s, không reject). Vậy nên kiến trúc là event-driven theo focus, không setInterval.
- **`clipboardchange` event ĐÃ có trong Chrome của user** (`'onclipboardchange' in navigator.clipboard` = true, đo 2026-06-12) — dùng nó thay vì tự đọc trên focus event: clipboard đổi lúc unfocused → event fire khi focus trở lại (per spec proposal). PoC xác nhận behavior thật + có fire trong Document-PiP window context không.
- PoC bắt buộc trước khi build full: (1) `clipboard.readText()` / `clipboardchange` trong Document-PiP window context (nếu không → đọc ở main page khi focus, hoặc paste event trong PiP); (2) trade2 `?q=` prefill.
- Non-goals: screen capture + OCR (getDisplayMedia + tesseract.js — khả thi nhưng kém chính xác hơn clipboard text nguyên văn, để phase sau nếu cần); pricing rare bằng ML; mọi hình thức call GGG API từ site.
- Phase 2 (card riêng nếu cần zero-click thật): companion Chrome extension — offscreen document + permission `clipboardRead` poll clipboard KHÔNG cần focus, message sang content-script của site → PiP cập nhật trong khi game vẫn focus; cộng `chrome.commands` global hotkey (hoạt động khi Chrome unfocused). Extension cài 1 lần như Playwriter, vẫn không phải desktop app.

## Criteria
- [ ] Parser test (bun) ≥15 assertions: currency, unique, rare nhiều mods, gem, waystone, text rác → null.
- [ ] Live flow trên Chrome: Ctrl+C item trong game (hoặc paste fixture) → focus PiP → giá hiện < 1s, không thêm keystroke nào ngoài click/focus.
- [ ] Unique có trong index hiện giá ex + quy đổi divine + staleness flag; item thiếu index hiện "Chưa có giá".
- [ ] Rare → nút mở trade2 search prefill đúng base + ≥2 mod filter (hoặc fallback copy-query đã document nếu `?q=` không hoạt động).
- [ ] `bun run generate` exit 0, 0 link error.
- [ ] Firefox/Safari: paste-button flow hoạt động (auto-read là progressive enhancement, hint hiển thị như PipPanel làm với PiP support).
