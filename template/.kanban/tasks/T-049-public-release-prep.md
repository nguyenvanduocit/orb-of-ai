# T-049: Public-release prep — clean docs, history, credentials, license
> Make the repo safe + clean to flip from private to public on GitHub.
- **priority**: high
- **effort**: M

## Problem
Repo `nguyenvanduocit/poe2` is private and about to go public. Audit found publish blockers:
- `.git` is 589MB. Two heavyweight liabilities baked into ALL history:
  - `stream/PressKit/` — 55 GGG-copyrighted press-kit PNGs, ~523MB.
  - `data/wiki/` — 11,268 scraped poe2wiki.net files, ~181MB (dev-only `/poewiki` cache, gitignored-intent, unused by build).
  - `data/poedb/` — 47 scraped poe2db.tw files, ~28MB (gitignored-intent, unused by build).
- No `LICENSE`; default = all-rights-reserved.
- No `.env.example`; required env vars undocumented.
- `content/guides/spirit-walker-companion-beast-hunt.md` deleted in working tree but referenced 40+ times → mass broken links (FIXED: restored from HEAD).
- `content/builds/monk/hollow-mask-acolyte-minion-hypothesis.md` ships a fake `pobb.in/PENDING_HOLLOW_MASK_ACOLYTE` URL.
- Stale `seo-gsc` branch (0 unique commits, fully merged into main).

Credentials verified clean: `.env` never committed (checked all history); Discord/Reddit/Algolia values live only in local gitignored `.env`; no secrets in tracked source or history.

## Goal
A small, clean, licensed public repo whose history contains no third-party copyrighted/scraped bulk and no secrets, with all internal links resolving.

## Requirements
- Purge `stream/PressKit/`, `data/wiki/`, `data/poedb/` from ALL git history (filter-repo), keep the on-disk mirrors locally (gitignored) so skills still work.
- Backup bundle taken before rewrite (`/tmp/poe2-pre-rewrite-backup.bundle`).
- Add MIT `LICENSE` (code) + CC BY-NC 4.0 `LICENSE-CONTENT` (content notes); reference both in README.
- Add sanitized `.env.example`.
- Add `stream/PressKit/` to `.gitignore`.
- Fix the PENDING placeholder URL.
- Delete stale `seo-gsc` branch (local + remote).
- Site still builds (`bun run generate` green) after cleanup.
- Do NOT flip visibility to public automatically — leave that final action to explicit user confirmation.

## Criteria
- [ ] `git log --all -- data/wiki data/poedb stream/PressKit` returns nothing (purged from history).
- [ ] `.git` size reduced from 589MB to < 80MB.
- [ ] On-disk `data/wiki` + `data/poedb` still present (skills unaffected).
- [ ] `LICENSE`, `LICENSE-CONTENT`, `.env.example` present and referenced in README.
- [ ] 0 broken internal content links.
- [ ] No PENDING/placeholder external URLs in content.
- [ ] `bun run generate` completes successfully.
- [ ] `seo-gsc` branch gone (local + remote).
