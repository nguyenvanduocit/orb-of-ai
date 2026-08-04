# T-041: ProseA duplicate-component warning + lost external-link target

> Nuxt warns "Two component files resolving to the same name ProseA" (app override vs andy-note-nuxt layer); local override also dropped the theme's external-link `_blank` behavior.

- **priority**: medium
- **effort**: XS

## Problem

`app/components/content/ProseA.vue` (footnote-popover override) and `node_modules/andy-note-nuxt/app/components/content/ProseA.vue` (external-link `_blank` override) both register globally at default priority 0 → Nuxt logs the duplicate-name WARN on every dev/build, and which one wins is ambiguous by contract (warning = equal priority).

Functional regression hidden behind the warning: the local override renders plain `<NuxtLink :href :target>` for non-footnote links, so web-external links (`http://`, `https://`, `//`) lose the theme's `target="_blank"` defaulting — external links open in the current tab, breaking the stacked-column navigation assumption in the theme's `useStack.ts`.

## Goal

Build/dev runs with zero component-name warnings, and markdown links keep BOTH behaviors: footnote refs get the popover, external links default to a new tab.

## Requirements

- App-level component must win deterministically (Nuxt `components` dir `priority` — framework convention, no rename hacks).
- Local ProseA becomes a superset of the theme's: footnote-ref branch + external-link `linkTarget` logic (explicit MDC `target` still wins).
- No upstream theme edit required for this fix (theme-side priority lowering can ride the existing andy-upstream batch later).

## Criteria

- [x] `nuxt dev`/`generate` output contains no "Two component files resolving to the same name" warning (tmp/t041-generate.log: 0 matches)
- [x] Footnote ref links still render `FootnoteRef` (popover) — prerendered stormweaver page has `data-footnote-ref` anchors with `fn-ref` markup
- [x] External `https://` markdown link renders `target="_blank"` (`rel="nofollow" target="_blank"` on youtube/maxroll/wiki prose links); internal route links carry no target; explicit target preserved by `props.target ?? ...`
- [x] `bun run generate` passes (exit 0)
