# T-007: Dev cloudflared tunnel cho live preview domain
> Chạy `nuxt dev --host` + cloudflared quick tunnel song song để publish dev server ra public HTTPS domain (`*.trycloudflare.com`) cho preview/share.

- **priority**: low
- **effort**: XS

## Problem
Dev server chỉ expose LAN qua `nuxt dev --host` — không share live được cho người ngoài mạng (review preview, mobile test, demo). cloudflared quick tunnel giải quyết, nhưng Vite 7.3.3 (`nuxt.config.ts:121` vite block) bật `server.allowedHosts` mặc định → request từ host tunnel bị chặn `"Blocked request. This host is not allowed."`, nên cách "chạy 2 lệnh thô" không hoạt động.

## Goal
Một lệnh `bun run dev:tunnel` bật dev server + in ra public HTTPS URL share được ngay, không lỗi blocked-host.

## Requirements
- Thêm `.trycloudflare.com` vào `vite.server.allowedHosts` (dev-only, KHÔNG ảnh hưởng `nuxt generate` / SSG output).
- Script `dev:tunnel` chạy nuxt dev --host + cloudflared song song qua `concurrently --kill-others`; `concurrently` khai báo local devDep cho reproducible (không phụ thuộc global install).
- Pin `--port 3000` để cloudflared `--url` luôn khớp.
- **Non-goal**: named tunnel / custom domain (chỉ quick tunnel ephemeral). Không auth gate — chấp nhận public-by-URL vì URL random + ephemeral.

## Criteria
- [x] `bun run dev:tunnel` in ra URL `https://*.trycloudflare.com` (verified: `birds-schools-quantitative-seed.trycloudflare.com`)
- [x] curl URL đó trả HTML site (không chứa "Blocked request") — HTTP 200, 22607 bytes, allowedHosts OK
- [x] Ctrl-C kill cả hai process (`concurrently --kill-others`) — TaskStop → 0 orphan nuxt/cloudflared
- [x] `bun run generate` vẫn pass (config edit không vỡ SSG) — Prerendered 535 routes, exit 0
