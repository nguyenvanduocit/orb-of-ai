# T-015: /pob OAuth self-flow — fetch full POE2 charData (client_id=pob PKCE, localhost catcher)
> Tự chạy OAuth authorization-code (PKCE) với `client_id=pob` trên Mac → Bearer token → fetch `api.pathofexile.com/character/poe2/<name>` (full equipment+passives+skills) → export-pob → full PoB code. Đây là đường DUY NHẤT lấy full charData POE2 (POESESSID = POE1-only).

- **priority**: high
- **effort**: M

## Problem
Char POE2 chỉ tồn tại trên OAuth API `api.pathofexile.com/character/poe2/<name>` (T-014 verified: POESESSID website character-window → 404 cho POE2). PoB2 lấy charData qua OAuth `client_id=pob` PKCE flow, nhưng flow đó GUI-only + headless networking stub → không chạy headless được (T-014). Tuy nhiên `client_id=pob` là **public PKCE client** (no client_secret — xác nhận PoEAPI.lua:120) và GGG đăng ký redirect `http://localhost:49082` (fallback 49083/49084 — xác nhận LaunchServer.lua). Nên replicate flow trên Mac này được: tự dựng localhost catcher, user authorize 1 lần, đổi code lấy token, fetch char.

## Goal
`pob-cli.sh --oauth [character] [realm]` → user bấm Authorize 1 lần trong browser → script tự lấy Bearer token → fetch full charData POE2 → export-pob → full PoB code (tree + skills + DPS thật).

## Requirements
- PKCE chuẩn: `code_verifier` (base64url random, no pad) + `code_challenge = base64url(sha256(verifier))`; `state` random verify chống forge.
- redirect_uri = `http://localhost:<port>` với port ∈ {49082,49083,49084} (khớp đăng ký GGG cho client_id=pob).
- scope = `account:profile account:leagues account:characters account:trade` (như PoB).
- Token exchange POST `pathofexile.com/oauth/token` (form, no secret); refresh qua `grant_type=refresh_token` khi `tokenExpiry` hết hạn.
- Char fetch GET `api.pathofexile.com/character/poe2/<name>` Bearer + PoB-style UA + spacing → `.character` → `export-pob`.
- Token lưu `tmp/.poe-oauth.json` (gitignored, KHÔNG commit). Hỗ trợ `--token <bearer>` reuse token đã có (PoB Settings.xml `lastToken`).
- File mới trong skill scripts dir; wire `pob-cli.sh --oauth`. Owner-authorised direct GGG call (override rule, dùng client_id=pob sanctioned + rate-limit spacing).

## Criteria
- [x] `pob-cli.sh --oauth` in ra authorize URL + dựng localhost catcher (49082); sau khi user authorize → access_token lưu tmp/.poe-oauth.json (expires 36000s)
- [x] `--oauth ThaoCamVienSaiGon poe2` → fetch full charData **equipment=16 + passives=yes + skills=9** → export-pob → `items:true + passives:true`, code 9584 ký tự có tree+skills
- [x] Round-trip: code → `pob-cli.sh calc` → **Huntress / Spirit Walker / Lv66**, keystone `Trusted Kinship`, 11 skill groups (Wild Protector, Spear Throw, Skeletal Reaver/Sniper, **Companion: Diretusk Boar ×2**, Wind Dancer). Defense thật: Life 1173/ES 158/Armour 555/Eva 825/res 56-55-59
- [x] `--token <bearer> <char>` reuse token implemented; refresh tự động qua `grant_type=refresh_token` khi hết hạn
- [x] Token gitignored (`git check-ignore tmp/.poe-oauth.json` ✓); charData oauth-*.json trong data/character-exports/ gitignored

## Done note
OAuth self-flow (`client_id=pob` PKCE, owner-approved "mượn client_id=pob") chạy end-to-end: PKCE base64url no-pad + state verify + localhost catcher (socket, 300s) + curl token exchange (qua Cloudflare, no secret) + curl Bearer char fetch. Đây là đường DUY NHẤT lấy full charData POE2 (passives+skills) — POESESSID/website = POE1-only (T-014).
- **DPS = 0**: PoB2 chưa model companion damage (Tame Beast/Diretusk Boar) → `pob_coverage: PARTIAL`, đúng giới hạn đã biết, KHÔNG phải lỗi flow. Defense/tree/skills/ascendancy đều chuẩn → code dùng tốt cho EHP + gear + tree analysis; companion DPS phải reason tay.
- Direct GGG call (token exchange + char fetch) = owner-authorised override rule, dùng client_id=pob sanctioned + PoB UA + spacing. Token 10h, refresh-able, revoke ở GGG.
- `--token` cho phép paste token PoB Settings.xml (`lastToken`) để skip interactive.
