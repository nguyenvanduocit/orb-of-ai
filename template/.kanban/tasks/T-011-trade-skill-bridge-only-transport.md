# T-011: /trade skill chuyển sang poe-bridge làm transport DUY NHẤT

> **SUPERSEDED bởi [T-017](T-017-playwriter-replaces-poe-bridge-transport.md) (2026-06-02).** Hướng đã đảo ngược: hard cut poe-bridge → playwriter làm transport GGG duy nhất cho cả poe1+poe2. Goal "bridge làm transport duy nhất" obsolete. Card giữ làm history.

> Rewrite .claude/skills/trade/SKILL.md để mọi trade call đi qua poe-bridge daemon, xoá hẳn playwriter + CDP Relay.
- **priority**: medium
- **effort**: M

## Problem
`poe-bridge/README.md:3` định vị bridge là "Local bridge **thay cho** CDP/Playwriter", nhưng skill consumer `/trade` (`.claude/skills/trade/SKILL.md`, last-mod 2026-05-26) chưa biết bridge tồn tại — `grep -rin "bridge\|7474" .claude/skills/trade/` = 0 match. Skill vẫn chỉ định nghĩa 2 transport cũ: playwriter (preferred) + CDP Relay (alternative). Hệ quả: invoke `/trade` → đi đường cũ, bỏ phí lợi ích bridge (single-funnel rate-limiter bền vững sống độc lập phiên Claude + state persist `.ratelimit-state.json` + HUD live). Drift doc↔tooling.

## Goal
Khi chạy `/trade`, mọi call PoE trade đi qua poe-bridge daemon (browser page-context, rate-limit single funnel) thay vì playwriter/CDP — rate-limiting bền vững hơn và an toàn account `hopthuxacnhan#3062` (đã từng bị flag).

## Requirements
- Bridge = transport DUY NHẤT. Xoá sạch (clean-slate, no residue) các section: "Setup — playwriter", "Search Pattern (playwriter)", "CDP Relay (alternative path)", và mọi reference `playwriter`/`CDP`/`state.page`/`cdp.evaluate_async`.
- Host = pi production `http://100.69.204.59:7474`. Token = **pi token** (`ssh pi cat ~/.bridge-token`). Cảnh báo rõ: local `poe-bridge/.bridge-token` ở repo chỉ cho daemon test local → dùng cho pi = `401`.
- Map mọi flow sang bridge endpoint (response bọc `{status, ratelimit, data}`): search→`POST /trade/search {game,league,query}`, fetch→`POST /trade/fetch {game,ids[],queryId}`, exchange→`POST /trade/exchange`, data→`POST /trade/data {game,kind}`, escape→`POST /raw`.
- Rate-limiting: bridge enforce ≥2s spacing internally (single funnel) → skill KHÔNG còn cần manual `sleep(2500)`. Document rằng spacing + 429/penalty do daemon lo; check `ratelimit` field trong response wrapper.
- Preserve TẤT CẢ game-knowledge transport-agnostic: name-vs-type gotcha, status `any` (offline supply), POE2 currency tiers (exalted/divine/chaos/gold), stat group types, pagination, stat-filter lookup qua `/trade/data {kind:"stats"}`, league "Runes of Aldur", endpoint path `/api/trade2/*`, realm=poe2.
- Whisper: bridge **read-only** (không whisper/mua được) → xoá section "Click Whisper Button via Browser" automation, thay bằng "đưa user trade UI URL (`/trade2/search/poe2/<league>/<queryId>`) để tự whisper". Document capability boundary này explicit.
- Preserve Authenticity gate (đã-flag account): call thật đầu tiên phải verify data + ratelimit header thật, không chỉ status 200.
- **Non-goals:** KHÔNG sửa daemon/extension code trong `poe-bridge/`; KHÔNG đụng skill khác (gear-upgrade, map-mod-filter, poe2scout) — drift của chúng tách card riêng nếu cần.

## Criteria
- [x] `grep -rin "playwriter\|cdp\|state\.page" .claude/skills/trade/SKILL.md` = 0 match (verified: 0)
- [x] `grep -in "7474\|/trade/search\|x-bridge-token\|100.69.204.59" .claude/skills/trade/SKILL.md` > 0 (verified: 15)
- [x] SKILL.md vẫn còn section: name-vs-type, status `any`, currency tiers, stat group types, pagination (verified: tất cả >0)
- [x] Token guidance nêu rõ pi token + cảnh báo local token = 401 (verified L36/L39)
- [x] Whisper section phản ánh read-only (user tự whisper qua URL), không còn DOM-click automation (verified L18/L20)
- [ ] (Runtime — BLOCKED bởi `tab_ready:false` lúc 2026-06-02) một `POST /trade/search` qua bridge trả `total` + query `id`. Test-plan: user mở/ready tab pathofexile.com/trade2 trong Chrome (extension trỏ pi) → re-check `/health` `tab_ready:true` → authenticity gate (1× `/trade/data {kind:"stats"}` GET rồi 1× `/trade/search`). Tới đó mới đóng được criterion này + chuyển card sang Done.
