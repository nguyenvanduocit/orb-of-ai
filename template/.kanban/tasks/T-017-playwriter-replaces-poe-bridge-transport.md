# T-017: Thay poe-bridge bằng playwriter làm transport GGG (cả poe1 + poe2)

> Mọi GGG call (trade/stash/gear-upgrade/update-static-data) đổi từ poe-bridge daemon sang playwriter `page.evaluate(fetch)` trong tab pathofexile.com đã login, ≥2s spacing + header backoff. Hard cut, clean-slate cả hai workspace.

- **priority**: high
- **effort**: L

## Problem

Hiện mọi GGG call route qua **poe-bridge daemon** chạy trên pi (`100.69.204.59:7474`):
`poe-trade/ggg/bridge.ts → POST /raw → daemon → fetch() trong page-context tab pathofexile.com`. Daemon là single-funnel enforce ≥2s spacing + học rate-limit policy + persist `blockedUntil`.

Keystone rule `poe/CLAUDE.md:139` bắt buộc đi qua daemon; `:140` giới hạn playwriter chỉ cho DOM. Footprint (xác minh `rg --hidden`):

- **Transport core (identical poe1↔poe2):** `poe-trade/ggg/bridge.ts` (`bridgeRaw` + `BridgeResponse`), `client.ts`.
- **Consumer thật của `bridgeRaw` (3):** `client.ts:364` (PoeTradeClient), `stash.ts:79`, `update-static-data/scripts/update-static-data.ts:46`. + test mock `loadToken`.
- **Guidance:** `poe/CLAUDE.md:18,139,140`, `poe1/CLAUDE.md`, `poe2/CLAUDE.md` (slash aliases). ~10 SKILL.md (trade, poe-trade, stash, gear-upgrade, update-static-data ×both + pob/map-mod-filter/passive-skill-tree/write-farming-tutorial/build-creator references).
- **Daemon project:** `poe-bridge/` (git sub-project riêng, đang chạy live trên pi).

Chi phí của daemon: dependency ngoài (pi qua Tailscale, PM2, token riêng, extension config) + một codebase riêng phải deploy/sync. playwriter chạy `page.evaluate(fetch)` trong chính Chrome đã login của user = **same-origin y hệt**, giữ nguyên authenticity gate, bỏ được toàn bộ daemon.

## Goal

Mọi GGG call đi qua playwriter (page-context fetch trong tab pathofexile.com đã login), không còn poe-bridge daemon ở bất kỳ live surface nào của poe1+poe2. An toàn account `hopthuxacnhan#3062` (đã từng flag) giữ nguyên: ≥2s spacing + đọc `x-rate-limit-*` header + backoff khi 429/penalty.

## Requirements

- **Transport core** — rewrite `poe-trade/ggg/bridge.ts` → `transport.ts`, `bridgeRaw`→`poeFetch`, `BridgeResponse`→`PoeFetchResponse`. Body shell-out `playwriter -s <sid> -f <script>` chạy `page.evaluate(async () => fetch('https://www.pathofexile.com'+path, {method, body, headers}))` trên tab pathofexile.com; return SHAPE `{status, ratelimit, data}` **không đổi** để 3 consumer chạy nguyên. File identical copy sang cả poe1 + poe2.
- **Rate-limit safety (yêu cầu thật, không phải literal `sleep 2`):**
  - (a) ≥2s min spacing qua **timestamp file persisted** (sống xuyên các lần invoke CLI riêng biệt, không chỉ in-process).
  - (b) Đọc `x-rate-limit-*` + `x-rate-limit-account-state` từ same-origin response vào field `ratelimit` (same-origin nên header không bị CORS che).
  - (c) HTTP 429 hoặc penalty/ban state → backoff (tôn trọng `retry-after`) hoặc abort với error rõ ràng; KHÔNG hammer.
  - (d) Serialize — lockfile để chỉ một POE playwriter call chạy tại một thời điểm (chặn caller song song).
- **Tab handling** — tìm/reuse tab `*.pathofexile.com` đã login qua `context.pages()`; không có → error rõ "mở + login + enable playwriter trên tab pathofexile.com". KHÔNG launch browser mới. KHÔNG `bringToFront`.
- **Consumers** — update import + comment của `client.ts`, `stash.ts`, `update-static-data.ts` sang tên mới; update test mock.
- **Guidance rewrite (clean-slate, zero bridge residue trên live surface):** `poe/CLAUDE.md:18` (bỏ daemon ops pointer), `:139` (keystone → "route mọi GGG call qua playwriter page-context fetch, ≥2s spacing"), `:140` (merge — playwriter giờ là CẢ transport API LẪN DOM tool, giữ rule sleep 1-2s giữa action). poe1+poe2 CLAUDE.md aliases. SKILL.md: nêu playwriter transport + 2s spacing + read-only (không whisper/mua) + prerequisite "Chrome mở + tab login".
- **Daemon project** — để `poe-bridge/` nguyên tại chỗ (sub-project riêng, vẫn chạy trên pi; xoá local không dừng được nó). Decommission pi daemon (`pm2 delete poe-bridge`) = ops task riêng, out of scope trừ khi user yêu cầu.
- **Non-goals:** KHÔNG sửa daemon/extension code trong `poe-bridge/`; KHÔNG đụng OAuth flow `/pob` (client_id=pob PKCE — transport riêng, không phải bridge) trừ khi nó thật sự route qua `bridgeRaw`; history (kanban archive, plan docs cũ) giữ nguyên — chỉ rewrite live surface.

## Criteria

- [x] `bridge.ts` không còn; `transport.ts` export `poeFetch` ở cả `poe1` + `poe2` ggg/, hai bản identical. (verified: `diff -q` IDENTICAL, bridge.ts gone cả hai)
- [x] `rg --hidden -i "poe-bridge|bridgeRaw|100\.69\.204\.59|x-bridge-token|:7474|POE_BRIDGE"` trên live surface = 0 (loại trừ `poe-bridge/`, `.kanban`, plan docs history, `tmp/`, graph-theory "bridge" trong poe-graph.ts). (verified: ZERO residual)
- [x] `poe/CLAUDE.md:139/140` mô tả playwriter là transport GGG (≥2s spacing + header backoff), không còn "route through poe-bridge daemon". (+ xóa bullet daemon-ops L18; poe1+poe2 CLAUDE.md aliases; ~14 SKILL.md + pob scripts rewrite — 3 executor agent + tự sửa)
- [x] `poeFetch` enforce được: persisted ≥2s spacing (`~/.poe-playwriter-state.json`) + đọc x-rate-limit header vào `ratelimit` + abort/backoff khi 429/penalty (parse `x-rate-limit-account-state`) + lockfile serialize. (verified: đọc code path + `bun build` transport.ts sạch)
- [x] `bun test` trong `poe-trade/ggg/__tests__` pass (mock đổi từ globalThis.fetch → `mock.module('../transport')`) ở cả hai workspace. (verified: 179 pass / 0 fail × 2)
- [ ] **(Runtime — TEST-PLAN, cần Chrome user mở + tab www.pathofexile.com login + Playwriter enabled)** Gate = một **POST `/search`** (không phải GET — GET `/data` là false-green, không exercise `X-Requested-With`). Lệnh: `cd poe2/.claude/skills/poe-trade/ggg && bun -e "import {poeFetch} from './transport'; console.log(JSON.stringify(await poeFetch('poe2','POST','/api/trade2/search/poe2/Runes%20of%20Aldur',{query:{status:{option:'any'},type:'Heavy Crossbow'}}),null,2))"`. Kỳ vọng: status **200** + `data.id` + `data.result[]` + `ratelimit` có x-rate-limit-* thật. Nếu **403** → `X-Requested-With: XMLHttpRequest` (đã thêm vào `buildScript`) chưa đủ, cần soi thêm header diff. 2 call liên tiếp cách ≥2s. Đóng criterion + chuyển Done sau khi POST 200.

> **Đã verify zero-GGG (2026-06-02):** Smoke A — `bun -e` static import `transport.ts` → `typeof poeFetch === 'function'` (pob-cli.sh path OK). Smoke B — `playwriter session new` + `-f` exec + stdout marker capture + parse logic của transport → PARSE OK (status/ratelimit/data extract đúng qua prefix `[log]`). Còn lại CHỈ page.evaluate fetch thật cần tab login. Bug đã sửa pre-runtime: `buildScript` thiếu `X-Requested-With` (trade SKILL.md cũ L221 ghi bridge phải thêm tay) → đã thêm vào transport + 7 ad-hoc POST snippet trong docs.
