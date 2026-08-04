# T-028: update-release-note fetch.sh can't parse GGG preview-thread layout (no h2)

> Make the release-note extractor heading-agnostic so it handles GGG "Patch Notes Preview" threads (h3 sections, no h2 title), not just full patch-notes threads.

- **priority**: medium
- **effort**: S

## Problem

`.claude/skills/update-release-note/scripts/extract-forum.py` anchors on `soup.find("h2")` and walks up to the enclosing `div.content`. GGG's full patch-notes threads (e.g. 0.5.0 = `3932540`) have an `<h2>` patch title, so this works. But GGG's mid-patch **"Patch Notes Preview"** threads (e.g. 0.5.1 = `3949114`) start sections at `<h3>` with **no `<h2>`**, so the extractor exits with "no <h2> patch title found — fetch was blocked or the forum layout changed" even though the page loaded fine (HTTP 200, no Cloudflare). This forced a one-off `tmp/extract-051.py` to fetch the 0.5.1 notes.

Root cause confirmed by probe: under `lxml`, BOTH thread layouts put the OP body in a non-empty `div.content` inside the first `tr.newsPost > td`; the only structural difference is the presence of the `<h2>` title. `html.parser` additionally mis-nests the 0.5.1 unclosed empty `div.content` (swallows siblings), which is why a naive `find("div.content")` over-/under-captured.

## Goal

`fetch.sh <preview-thread-id> <version>` produces the same clean Markdown (sections + one-bullet-per-entry, no raw HTML) as a full patch-notes thread, with the existing 0.5.0 path unchanged.

## Requirements

- Existing `<h2>` path stays byte-identical (no regression on 0.5.0 `3932540` body output).
- New no-`h2` branch parses the preview layout via `lxml` → first `tr.newsPost > td` → non-empty `div.content` (fallback to the cell).
- Loud failure preserved when neither anchor resolves (real Cloudflare block / forum redesign).
- `fetch.sh` version-parse also recognises "deploying Patch X.Y.Z" (preview body has no "Content Update X.Y"); explicit version still wins.
- Record `0.5.1 = 3949114` in SKILL.md known-ids; document preview-thread handling.
- Regenerate `data/release-notes/Version_0.5.1.md` via the canonical pipeline; delete `tmp/extract-051.py`.

## Criteria

- [x] Dry-run `fetch.sh 3932540` (temp dir) — body diff vs committed `Version_0.5.0.md` body is empty (no 0.5.0 regression).
- [x] Dry-run `fetch.sh 3949114 0.5.1` (temp dir) — body matches the verified one-off output (5 sections, Refutation/Repulsion/Olroth's lines, no raw `<table>/<li>/<h3>`).
- [x] `data/release-notes/Version_0.5.1.md` regenerated via canonical `fetch.sh`; curated header no longer references the one-off; `tmp/extract-051.py` removed.
- [x] SKILL.md lists `0.5.1 = 3949114` and explains the preview-thread (no-h2) path.
