# T-021: Per-page generated OG images (nuxt-og-image)
> Replace the static site-wide OG image with per-route 1200×630 PNGs generated at build time, branded for POE2 Vault, verified to actually render on the Cloudflare Pages Linux build.

- **priority**: medium
- **effort**: M

## Problem
T-020 shipped core SEO with a single static `/images/og-cover.jpg` (316×316) as the social image. The user asked for generated per-page OG images. nuxt-og-image is installed (via `@nuxtjs/seo`) but `ogImage.enabled: false` because:
- The module is inert when merely enabled — it needs a default OG component registered (`defineOgImageComponent` in `app/app.vue`, or per-page `defineOgImage`).
- Its built-in community templates (e.g. `NuxtSeo`) resolve to the **satori** variant ("NuxtSeoSatori") which (a) must be `eject`ed for production and (b) needs the satori renderer — we installed **takumi** (`@takumi-rs/core`, lockfile-pinned incl. `core-linux-x64-gnu` for CF).
- Generated-image correctness is only verifiable AFTER a CF deploy (CF runs its own `bun install --frozen-lockfile && generate` on Linux); local success doesn't prove production success.

## Goal
Every content page serves a unique, branded 1200×630 OG/Twitter image generated at build time — confirmed rendering on the live poe2.aiocean.io after a CF deploy.

## Requirements
- Write a custom takumi-compatible OG component in `app/components/OgImage/` (brand: dark bg, lime `#d4ff00` accent, page title + description + "poe2.aiocean.io") — avoids the eject/renderer-variant trap and gives brand control. Configure fonts (`ogImage.fonts`) so text actually renders.
- Register it site-wide via a consumer `app/app.vue` (replicate the theme's trivial `<NuxtLayout><NuxtPage/>` template) calling `defineOgImageComponent`.
- Set `ogImage.enabled: true`; remove the static `og:image` from `app.head` so it doesn't dedupe-win over the generated injection.
- Scope generation to content/listing pages; consider disabling for `/tags/**` to bound CF build time (measure — full build must stay well under CF's 20-min limit).
- The static `/images/og-cover.jpg` stays as the ultimate fallback only where no generated image applies.

## Criteria
- [ ] `bun run generate` exits 0 and writes per-route PNGs (find `.output` `*og-image*` `*.png` > 0).
- [ ] Built content-page HTML has `og:image` pointing at the generated PNG (absolute, poe2.aiocean.io), with `og:image:width`/`height` = 1200/630.
- [ ] No `/_og/` URL in output that lacks a corresponding generated PNG (no broken social images).
- [ ] After CF deploy: live page's og:image URL returns HTTP 200 + a valid PNG (verify via curl/playwriter).
- [ ] Social-card preview (e.g. opengraph.xyz or X card validator) renders the branded image for a sample build page.
