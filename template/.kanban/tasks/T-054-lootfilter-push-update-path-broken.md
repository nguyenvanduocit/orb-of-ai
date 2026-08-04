# T-054: push-to-account.ts update path navigates to read-only view URL

> Updating an existing POE2 account filter times out — the script opens the filter's view URL (no form) instead of the edit URL.

- **priority**: medium
- **effort**: S

## Problem

`.claude/skills/lootfilter/scripts/push-to-account.ts` (the `/lootfilter` push) has two paths: create (works) and update (broken). When a filter with the requested `--name` already exists, the update path resolves the existing filter's anchor `href` (`/my-account/item-filters/<id>`) and `goto`s it, then waits for `input.poe-input__input[type=text]` (push-to-account.ts:78-84). That URL is the **read-only view** page — it renders only an ACE editor, zero text inputs — so `waitForSelector` times out after 25s and the upload aborts with `Timeout 25000ms exceeded`.

Verified live 2026-06-28 while updating "Divine Only" → "Currency 10c Plus":
- View URL `/my-account/item-filters/xzkmgXU6` → `hasAce: true`, `txtInputs: []` (no name/version inputs).
- Real edit URL is **`/my-account/item-filters/edit/<id>`** (note the `/edit/` segment), OR click the per-row `button` "Edit" inside `.item-filter-row__header` scoped to the filter's anchor text. Either reveals the name input + version input + ACE editor.
- Manual workaround that succeeded: `goto('/my-account/item-filters/edit/'+id)` → fill `texts[0]`=name, `texts[1]`=version, `ace.env.editor.setValue(body)` → click `Submit` → POST `/internal-api/item-filters` returns 200.

Secondary finding (not a bug, but should be guarded): GGG validates `filter_name` server-side with "Letters, numbers, punctuation and spaces only" and **rejects `+`** (400, `field: filter_name`). The script should pre-validate the name and fail fast with a clear message rather than submitting a doomed POST.

## Goal

`/lootfilter` push can update an existing POE2 account filter in place (same id, no duplicate) as reliably as it creates a new one.

## Requirements

- Update path must navigate to the edit surface (`/my-account/item-filters/edit/<id>`), not the view URL. Derive `<id>` from the existing filter's anchor href on the list page.
- Keep the create path unchanged (it works: `/my-account/item-filters/create`).
- Pre-validate `--name` against GGG's allowed set (letters, numbers, spaces, and the punctuation subset they accept — `+` is NOT accepted) and abort before any POST with a clear error if it fails.
- Preserve flagged-account safety: keep the existing inter-action sleeps; do not parallelise; one submit per run.
- Non-goal: deleting filters, changing the create flow, OAuth.

## Criteria

- [ ] Re-running `push-to-account.ts --file <f> --name "<existing name>"` updates that filter (POST 200, same id, version bumped) instead of timing out.
- [ ] Creating a brand-new filter still works (no regression).
- [ ] A `--name` containing `+` (or other rejected chars) aborts pre-POST with a readable error, not a 400.
- [ ] Update path confirmed against a live account filter (POST 200 + name/version reflected on the list page).
