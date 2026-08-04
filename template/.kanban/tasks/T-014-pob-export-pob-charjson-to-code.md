# T-014: /pob export-pob — GGG character JSON → PoB2 code (reuse PoB import/export, headless)
> Headless tool biến một GGG character-API JSON thành PoB2 import code bằng chính code import/export của PoB, không sửa engine, không gọi network.

- **priority**: high
- **effort**: M

## Problem
Cần đường "char tươi → headless calc" mà reuse code PoB (ban-safe). Yêu cầu gốc là `pob-cli.sh --sessid <POESESSID>`, nhưng đã verify đường này **bất khả thi cho char POE2**:
- Website `character-window/get-characters?realm=poe2` (cookie/POESESSID auth) trả về **chỉ char POE1** — không thấy char POE2 (test qua poe-bridge: 16 char POE1, không có ThaoCamVienSaiGon).
- `character-window/get-items?realm=poe2&character=ThaoCamVienSaiGon` → **404 "Resource not found"**.
- PoB2 char-import (`PoEAPI.lua`) là **OAuth Bearer only** (`client_id=pob`, `Authorization: Bearer`), zero POESESSID trong char-import path; `GETSESSIONID` chỉ là error-state label. POESESSID trong PoB2 chỉ dùng cho trade (`TradeQuery.lua`).
- Headless networking bị stub: `HeadlessWrapper.lua:133 LaunchSubScript() end` rỗng + `lcurl` disabled → `DownloadPage` không chạy headless. Không thể reuse code-fetch của PoB headless.

Phần code PoB **reusable headless** là các hàm thuần (no network): `ImportItemsAndSkills(charData)`, `ImportPassiveTreeAndJewels(charData)`, và export `common.base64.encode(Deflate(build:SaveDB("code")))`. Vậy giải pháp: fetch JSON **ngoài engine** (bridge/OAuth/internal-api) → feed pure import của PoB → emit PoB code → dùng với `pob-cli.sh calc`.

## Goal
Một tool headless nhận GGG character-API JSON và xuất PoB2 import code hợp lệ qua đúng code import/export của PoB — không modify `data/pob-source/`.

## Requirements
- File mới CHỈ trong skill dir: `export-pob.lua` (pure Lua) + `export-pob.sh` (wrapper), setup.sh copy vào install dir như pob-cli.*. **Zero edit** file tracked của pob-source.
- Nhận cả shape OAuth `{character:{equipment,passives,jewels,...}}` lẫn internal-api/live `{data:{equipment,...}}` lẫn bare charData.
- `pcall`-guard quanh import (ImportPassiveTreeAndJewels đụng GUI control: `configTab.varControls`, `controls.characterLevel`, `main:SetWindowTitleSubtext`) — items-only vẫn export được code.
- Output PoB code dùng được bởi `pob-cli.sh calc @file`.
- Transport fetch JSON là quyết định riêng của user (bridge browser-session = ban-safe default; OAuth Bearer cho full passives). Tool này KHÔNG tự fetch.

## Criteria
- [x] `export-pob.sh @charData.json` xuất base64 PoB code (URL-safe) — code 7400 ký tự
- [x] Code feed `pob-cli.sh calc` → `status: ok` (round-trip verified) — stats khớp 100% (Life 322, ES 99, Armour 347, Eva 180, res 51/45/49)
- [x] Test với live equipment JSON thật (ThaoCamVienSaiGon) — `imported.items: true` qua chính `ImportItemsAndSkills` của PoB
- [x] Zero modification lên file tracked trong `data/pob-source/` — chỉ `HeadlessWrapper.lua` (zlib patch có sẵn); `export-pob.*` là untracked file mới
- [x] `setup.sh` deploy `export-pob.*` idempotent — re-run "already identical, skip"

## `--sessid` — explored, removed
Built `pob-cli.sh --sessid` + `fetch-sessid.sh` to test POESESSID char-fetch (token `cd11b2f5...`): list mode worked, but POESESSID is **POE1-only** — POE2 char ThaoCamVienSaiGon → HTTP 404 (website character-window doesn't serve POE2; confirmed 3× via bridge + direct). Removed in the clean-slate pass (dead weight in a POE2-only workspace); full POE2 char fetch ships via **T-015 OAuth** (`/pob --oauth`).

## Done note
- 3 bug fix trong quá trình build: (1) capture `arg[1]` TRƯỚC `dofile(HeadlessWrapper)` vì Launch.lua rewrite global `arg`; (2) normalize `skills`/`jewels` về `{}` — `ImportItemsAndSkills:955 pairs(charData.skills)` crash khi internal-api JSON thiếu field; (3) double `OnFrame` + `buildFlag=true` để settle calc (stat readout lệch Life 1129 vs round-trip 322 nếu đọc sớm 1 frame).
- **CẢ HAI import path verified headless** (không chỉ items): passives path (`ImportPassiveTreeAndJewels` — đụng GUI controls `SetWindowTitleSubtext`/`configTab.varControls:SetSel`/`characterLevel:SetText`/`versionSelect`/`EstimatePlayerProgress`) chạy OK với synthetic minimal passives → `info` đổi sang `Huntress Lv65`. Combined test (16 equipment thật + 6 real 0.5 tree hashes) → `items:true + passives:true` → code 7684 ký tự → `pob-cli calc` round-trip class/level `Huntress 65` preserved, Life 1055 (tree-allocated, tăng từ 322 gear-only). Real node allocation confirmed.
- **Transport for full charData shipped in T-015** (`/pob --oauth`, client_id=pob OAuth). export-pob remains the serializer both `--oauth` (full charData) and `fetch-live.sh` (equipment-only → gear-only code) feed into.
- SKILL.md v2.6.0 (export-pob) → v2.7.0 (OAuth, T-015).
