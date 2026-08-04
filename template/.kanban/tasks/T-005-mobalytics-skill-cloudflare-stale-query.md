# T-005: Mobalytics skill hỏng — Cloudflare 403 + stale GraphQL query + profile-URL slug
> `/mobalytics` fetch.sh không kéo được build POE2 nữa (3 tầng lỗi); hiện phải workaround tay bằng playwriter.
- **priority**: medium
- **effort**: M

## Problem
`.claude/skills/mobalytics/scripts/fetch.sh` hỏng 3 tầng (phát hiện 2026-05-30 khi kéo build CaptainLance9 Spirit Walker):
1. **Slug regex** `s|.*/poe(-2)?/builds/([^/?]+).*|` KHÔNG match profile-URL `/poe-2/profile/<user>/builds/<slug>` → SLUG = nguyên URL → API NOT_FOUND/parse error.
2. **Cloudflare challenge** — endpoint `mobalytics.gg/api/poe-2/v1/graphql/query` giờ trả `HTTP 403 cf-mitigated: challenge` với mọi curl trần (bất kể UA). Skill curl-based chết hẳn.
3. **Schema drift** — query còn `tags`/`author`/`content` ở payload level → `GRAPHQL_VALIDATION_FAILED` ("Cannot query field X on Poe2UserGeneratedDocumentPayload").

Workaround hiện tại (ghi ở memory project_mobalytics_pob_gotchas): playwriter navigate build page → in-page `fetch()` same-origin (cf_clearance của Chrome) với query đã bỏ tags/author/content. Hoạt động nhưng thủ công, không nằm trong skill.

## Goal
`/mobalytics <profile-or-builds-url>` kéo lại được build POE2 (pobCode + equipment + skills + tree) mà không cần thao tác tay.

## Requirements
- Slug extraction handle cả `/poe-2/builds/<slug>` lẫn `/poe-2/profile/<user>/builds/<slug>` (và slug trần).
- Bypass Cloudflare: route qua playwriter in-page fetch (hoặc CDP Relay / cf_clearance cookie) thay vì curl trần — same pattern như các skill cf-walled khác.
- Sửa GraphQL query khớp schema hiện tại (bỏ hoặc relocate tags/author/content; giữ data{buildVariants/skillGems/passiveTree} + pobCode).
- Non-goal: không cần fix PoE1 path nếu chưa hỏng.

## Criteria
- [ ] `fetch.sh "https://mobalytics.gg/poe-2/profile/captainlance/builds/0-5-captainlance9-s-spirit-walker-beast-tamer"` trả YAML có pobCode (len > 1000) + skills + passiveTree, exit 0.
- [ ] `fetch.sh "<một /poe-2/builds/<slug> URL>"` vẫn hoạt động (không regress).
- [ ] Không còn `GRAPHQL_VALIDATION_FAILED` trong response.
