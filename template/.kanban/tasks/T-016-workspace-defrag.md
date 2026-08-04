# T-016: Workspace defrag — scripts + skills + knowledge, no trash/overlap/fragment
> Multi-agent workflow audit toàn workspace POE2 → adversarial-verify → aggressive auto-apply: xóa trash, merge overlap, consolidate fragment. Để uncommitted cho user review diff.

- **priority**: high
- **effort**: L

## Problem
Workspace tích tụ lộn xộn sau nhiều iteration: skill overlap (trade/poe-trade/stash; poe-ninja/poe2scout/price-forecast; poewiki/poedb; pob/mobalytics), nghi trash (skill `tmp` & `gitnexus` 0-script; `data/pob-source` vs `data/pobb-source`), fragment (content/en/ vs content/ top-level; half-migration trade-static), dead scripts/__pycache__/temp artifacts. Cần defragment một lượt có hệ thống.

## Goal
All script, skill, knowledge defragmented — no trash, no overlap, no fragment — verify được (zero dead reference, build/generate pass).

## Requirements
- Workflow đa pha: Audit (read-only, parallel theo region) → Synthesize+dedup (master ledger, disjoint exec lanes) → Adversarial verify (Chesterton's Fence: rg references repo-wide + why-it-exists per delete/merge) → Execute (aggressive auto-apply confirmed actions, clean-slate affirmative) → Critic (re-scan + no broken refs).
- KHÔNG xóa active gitignored cache (data/pob-source 572M, wiki, poedb, trade-static, character-exports, poe-ninja snapshots) — regenerable, không phải trash; chỉ flag nếu orphaned/stale.
- KHÔNG commit — để uncommitted cho user review diff.
- Apply clean-slate cho knowledge (affirmative, no residue); history → git/kanban.
- Sau workflow: build/typecheck gate (`bun run generate`) + smoke test các skill bị đụng.

## Criteria
- [x] Skill overlap resolved — 11 SKILL.md rewritten (market trio, reference, trade cluster, build cluster canonicalised)
- [x] Trash removed — gitnexus skill suite (6, non-POE boilerplate), data/pobb-source (245M orphan clone), 3× __pycache__, poe-auth ggg lib (rename→poe-trade), nuxt upgrade-item-badges codemod, pob/.omc residue, orphan twister jpg frames (12, fork assets zero-ref), stash test fixtures
- [x] Fragment consolidated — spectre-shaman → raging-spectre-shaman, return-of-the-ancients → mechanics/leagues/, T-012 archived; content/en structural: zero orphans (EN slug-parity restored)
- [x] Zero dead reference — critic brokenRefs fixed (../CLAUDE.md:92 pointer → leagues/; 2 EN orphans deleted/renamed); post-scan zero EN structural orphans, zero stale return-of-ancients refs
- [x] `bun run generate` pass — 539 routes prerendered, exit 0 (was 541; −2 = spectre-shaman VI+EN routes removed)
- [x] Report delivered

## Done note
Workflow `workspace-defrag` (run wf_a6b565fe-942): 54 findings → 36 deduped → 29 confirmed (1 rejected: stale empty-dir no-op) → applied across ~23 disjoint lanes (43 agents). Build gate green twice (post-workflow + post-followup-fix). Left **uncommitted** for user diff review.
- **Verdict needs-followup → resolved the structural items** myself: CLAUDE.md pointer, EN orphan spectre-shaman (deleted, VI gone), EN slug-drift energy-shield-recovery-rework→energy-shield-recovery (renamed to match VI).
- **Deferred (user decision, NOT defrag-trash):** content/en is a real served locale (`/en/` prefix, content.config.ts) but lags VI by **17 docs missing an EN twin** (largely pre-existing — EN was always a partial mirror). Backfilling = re-translating 17 docs = content authoring, not auto-doable safely. Spin a follow-up if EN parity is wanted; otherwise EN stays a partial-but-valid locale.
