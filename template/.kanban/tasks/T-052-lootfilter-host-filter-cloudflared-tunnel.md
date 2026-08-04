# T-052: /lootfilter host — serve filter download page qua cloudflared quick tunnel
> Script host thư mục filter/ ra public URL bằng trycloudflare (cloudflared) để share link cho viewer tải filter.

- **priority**: medium
- **effort**: S

## Problem
`filter/index.html` là trang download filter (link `leedgod.filter` + các `.filter` khác) nhưng chỉ mở được local — không có cách share ra ngoài mà không deploy site. Chưa có script nào host thư mục `filter/`. Repo chỉ có `package.json` script `dev:tunnel` phục vụ `nuxt dev`, không liên quan filter/.

## Goal
Chạy một lệnh → `filter/` được serve và in ngay public URL `trycloudflare.com` để gửi cho người khác tải filter.

## Requirements
- Script sống trong skill: `.claude/skills/lootfilter/scripts/host-filter.ts` (bun — theo rule "helper script thuộc về một skill").
- Static server cho `filter/` (mặc định `/` → index.html, `.filter` tải về dạng attachment).
- Tự spawn `cloudflared tunnel --url http://localhost:<port>`, parse stdout/stderr → in public URL nổi bật.
- Ctrl-C dừng cả server lẫn tunnel (trap SIGINT/SIGTERM, không để process mồ côi).
- cloudflared chưa cài → báo lỗi rõ (`brew install cloudflared`).
- Document usage trong SKILL.md.

## Criteria
- [ ] `bun .../host-filter.ts` serve `filter/` ở `localhost:<port>`; curl `/` trả index.html, `/leedgod.filter` trả nội dung filter
- [ ] In ra public URL dạng `https://*.trycloudflare.com`
- [ ] Ctrl-C / SIGTERM kill cả cloudflared lẫn server
- [ ] SKILL.md có mục hướng dẫn host
