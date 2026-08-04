# T-020: Full SEO support + Search Console / Bing registration
> Make poe2.aiocean.io fully SEO-ready (canonical domain, fresh metadata, sitemap, robots, OG/Twitter meta, JSON-LD, generated per-page OG images) and register the site with Google Search Console (DNS-TXT Domain property) + Bing Webmaster, submitting the sitemap.

- **priority**: high
- **effort**: L

## Problem
The poe2 Nuxt 4 SSG site ships with broken/thin SEO:
- `nuxt.config.ts:107` `i18n.baseUrl: 'https://poe.aiocean.io'` points at the **old/dead** project domain. Production is `poe2.aiocean.io` (deploy skill + README authoritative; poe.aiocean.io is a different CF project). Every `<link rel=canonical>` + hreflang is misattributed → duplicate/wrong-host signals to crawlers.
- Site metadata is stale POE1 data copied in: `runtimeConfig.public.site` title "PoE", POE1 description, `currentLeague: 'Mirage'`, `currentPatch: '3.28'`; `app.head` title "PoE Vault — Path of Exile Builds & Guides", theme-color `#d4ff00` vs site `#af6025`. Workspace is POE2 Runes of Aldur 0.5.0.
- Theme `andy-note-nuxt` `ContentView.vue` emits only `title`, `description`, `og:title`. No `og:description/image/url/type`, no Twitter card, no JSON-LD.
- No `sitemap.xml`; `robots.txt` is bare `Disallow:` with no sitemap reference.
- Site not registered with any search engine.

## Goal
A crawler hitting poe2.aiocean.io sees correct canonical URLs, a complete sitemap, rich per-page social/structured metadata, and Google + Bing both know about the site and its sitemap.

## Requirements
- Use the idiomatic Nuxt SEO stack (`@nuxtjs/seo` umbrella: sitemap + robots + og-image + schema-org + seo-utils). No hand-rolled meta plumbing, no fighting framework conventions.
- **One owner per tag**: `@nuxtjs/i18n` already emits canonical + hreflang — do NOT double-emit. SEO module is for sitemap/robots/OG-fallback/schema/og-image only. Verify exactly one `<link rel=canonical>` per page in the built HTML.
- Do NOT edit `node_modules/andy-note-nuxt` (npm layer) or clobber its `app.vue`. Configure site-wide defaults via module config / `nuxt.config`.
- Generated per-page OG images via nuxt-og-image; if that backend breaks the CF Pages SSG build, fall back to the static default OG image (`Path_of_Exile_2_cover_art.jpg`) and ship core SEO — og-image must not block the high-value deploy.
- GSC verification = **DNS-TXT Domain property** (add TXT to `aiocean.io` Cloudflare zone, same CF account, wrangler token available). Confirm the logged-in Google account in Chrome before creating the property (outward-facing).
- All GGG/external browser actions via playwriter (user's Chrome), ≥1-2s between DOM actions.

## Criteria
- [ ] `i18n.baseUrl` + `site.url` = `https://poe2.aiocean.io`; no remaining ref to `poe.aiocean.io` in config.
- [ ] Site metadata reflects POE2 Runes of Aldur 0.5.0 (title, description, league, patch, consistent theme-color).
- [ ] `bun run generate` exits 0 (the type/SSR gate — no vue-tsc in repo).
- [ ] Built output contains `sitemap.xml` listing poe2.aiocean.io URLs; `robots.txt` references the sitemap.
- [ ] Built page HTML shows exactly ONE canonical (poe2.aiocean.io), plus og:title/description/image/url/type + twitter:card + JSON-LD.
- [ ] Per-page OG image renders (or documented fallback to static default if backend unavailable).
- [ ] Deployed to poe2.aiocean.io.
- [ ] GSC Domain property `aiocean.io` (or `poe2.aiocean.io`) verified via DNS TXT; sitemap submitted.
- [ ] Bing Webmaster registered (import from GSC) + sitemap submitted.
