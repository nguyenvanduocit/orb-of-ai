---
name: update-release-note
description: Fetch Path of Exile 2 release/patch notes from the OFFICIAL GGG forum thread (canonical source #1, not the wiki mirror) and save clean Markdown to data/release-notes/Version_X.Y.Z.md. Handles Cloudflare (browser UA), extracts the post body, splits GGG's packed list items into one bullet per entry, and preserves any curated header on re-fetch. Use when the user runs /update-release-note, asks to fetch/refresh POE2 patch notes, pull the latest patch, or sync a patch-notes thread.
allowed-tools:
  - Bash(.claude/skills/update-release-note/scripts/fetch.sh:*)
  - Bash(git diff:*)
  - Bash(git status:*)
argument-hint: "<thread-id-or-url> [version]   (POE2 0.5.0 = 3932540)"
arguments:
  - thread
  - version
context: inline
---

# update-release-note

Fetch POE2 release/patch notes straight from the official GGG forum thread and store them as clean Markdown under `data/release-notes/`. The forum post is the canonical patch-notes source — **source #1** in the project hierarchy (GGG ground truth) — so this skill goes to the source instead of the `poe2wiki.net` mirror (source #3), which lags by hours and wraps the notes in wiki chrome.

## Run it

```bash
.claude/skills/update-release-note/scripts/fetch.sh <thread-id-or-url> [version]
```

- `.../fetch.sh 3932540` — POE2 0.5.0; version parsed from the page title.
- `.../fetch.sh 3932540 0.5.0` — version given explicitly (use for hotfixes where the title is ambiguous).
- Accepts a bare numeric thread id or a full `pathofexile.com/forum/view-thread/<id>` URL.

Output: `data/release-notes/Version_X.Y.Z.md` plus a refreshed `latest.md` symlink.

## Finding the thread id

There is no auto-detect — each patch is its own forum thread, so the id is looked up by hand from GGG's announcement/news forum. Known ids:

- **0.5.0 "Return of the Ancients"** → `3932540`
- **0.5.1** (mid-patch, posted in *Early Access Announcements* as a "Patch Notes Preview") → `3949114` — pass the version explicitly (`fetch.sh 3949114 0.5.1`); preview threads open with "deploying Patch X.Y.Z" and lack the "Content Update X.Y" title, though the parser now reads the "deploying Patch" line as a fallback.
- **0.5.2** → `3960375` — posted as a REGULAR forum thread in *Early Access Patch Notes* (no news layout; sections are bold text, not `<h3>`). Pass the version explicitly (`fetch.sh 3960375 0.5.2`); the extractor reads the OP body via `table.forumPostListTable` (third layout, T-046).

When a new patch drops, grab the new thread id from the GGG forum announcement and pass it in. Record it here so the next person does not have to hunt for it.

## Why a browser User-Agent (the Cloudflare gotcha)

`pathofexile.com` sits behind Cloudflare, which returns **403** to `markitdown`/`curl` default User-Agents. The script sends a browser UA so the public page loads. If a fetch suddenly fails with 403, the UA string in `scripts/fetch.sh` has gone stale — refresh it.

This is the one sanctioned exception to the project's "never call pathofexile.com directly" rule (see root `CLAUDE.md`). That rule guards the authenticated, rate-limited trade/stash/character **APIs** that previously flagged the account. This skill does a single **anonymous, read-only GET of a public forum thread** — no auth, no account, no API — so the flag risk does not apply.

## How the conversion stays clean

The forum page is a table-based layout; feeding the whole page to a converter leaves a wall of raw HTML or silently truncates. The pipeline is:

```
curl (browser UA)  →  forum HTML
  →  extract-forum.py   (bs4: pull the post-body <div class="content">; strip <img>;
                         split <li> that pack several entries via newline/<br> into
                         one <li> per entry — GGG groups skill changes this way)
  →  pandoc -f html -t gfm --wrap=none
  →  sed cleanup        (drop layout <div> wrappers, '-' → '*' bullets, squeeze blanks)
```

`extract-forum.py` anchors on the `<h2>` patch title and walks up to its enclosing `div.content`. GGG's mid-patch *"Patch Notes Preview"* threads (e.g. 0.5.1) ship no `<h2>` — sections start at `<h3>` — so for those it falls back to the first `tr.newsPost` post cell, re-parsed with `lxml` (which reconstructs the malformed forum DOM; `html.parser` mis-nests the unclosed empty content div these threads carry). It fails loudly only if **neither** anchor resolves — a loud failure means the fetch was blocked or GGG redesigned the forum, either of which should stop the pipeline rather than emit a half file.

## Re-fetching an existing version

Re-running for a version that already has a file **preserves the curated header block** (everything up to and including the first `---`) and regenerates only the body below it. So the hand-written provenance/league/launch lines and any dated `Updates to Patch Notes` curation survive a refresh — only the patch-notes body is pulled fresh from the forum.

GGG edits patch-notes threads after launch and logs each change in a dated `Updates for DD/M/YY` block at the end of the post. A re-fetch picks those up automatically, so this is the right way to pull a same-version update (e.g. a launch-eve addendum) rather than hand-editing.

## After fetching

1. **Verify completeness** — confirm the section count and the dated update blocks look right:
   ```bash
   grep -cE '^### ' data/release-notes/Version_X.Y.Z.md     # section headings
   grep -nE '^Updates for ' data/release-notes/Version_X.Y.Z.md
   ```
2. **These are raw reference data, not content prose.** Patch notes live in `data/` and are the verbatim source for writing `content/` notes — they are never themselves a `content/` doc. Do not apply the content writing-voice rules to this file.
3. **Assess downstream impact** — for a major patch, hand off to the `patch-impact-analyzer` agent to scan `content/` for docs affected by the changes; it reads this file as its Phase 0 input.
