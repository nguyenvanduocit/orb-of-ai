# T-001: Tag listing pages bị dead link

> Mỗi article render tag badge link tới `/tags/<slug>` nhưng không có route nào list content theo tag → 404 panel "Not Found".

- **priority**: high
- **effort**: S

## Problem

Theme `andy-note-nuxt@0.4.3` render tag badge trên mỗi article view (`node_modules/andy-note-nuxt/app/components/ContentView.vue:836-849`) dưới dạng `<NuxtLink :to="/tags/<kebab-tag>">`. Nhưng theme **không ship route `/tags/**` hay bất kỳ tag-listing logic nào** — page duy nhất là catch-all `[...slug].vue` → `<StackedColumns>` → `ContentView`, và `ContentView` chỉ resolve content **theo path** (`queryCollection('content').where('path','=',...)` + path-prefix children).

Hậu quả: `/tags/knight-of-aldur` không match content doc nào, không có path-children → `notFound=true` → render panel "Not Found". **Mọi tag badge trên toàn site là dead link.**

Evidence (live, 2026-05-29): `https://poe2.aiocean.io/tags/knight-of-aldur/` → HTTP 200 nhưng body là panel "Not Found" (title generic `PoE Vault — Path of Exile Builds & Guides`), trong khi article thật (`/guides/challenge-guide/`) hiện đúng title. Tag `knight-of-aldur` có thật trong `content/guides/challenge-guide.md` frontmatter.

## Goal

Click tag badge bất kỳ → mở một trang list mọi article mang tag đó, navigate được vào từng article.

## Requirements

- Tag listing phải hoạt động **generic — column-0 (direct `/tags/x`) VÀ stack column (`?stack=/tags/x`)**. Vì stack columns do theme's `StackedColumns → StackedColumn → ContentView` (path-driven) render, một standalone `pages/tags/[tag].vue` chỉ cover column-0, KHÔNG cover stack. Seam duy nhất render mọi column là `StackedColumn` → override nó.
- Theme là npm dep pinned `^0.4.3`, không sửa trực tiếp. Override bằng app-layer component (shadow theme component cùng tên): `app/components/StackedColumn.vue` (copy byte-faithful theme, chỉ đổi inner render branch `/tags/` → `<TagListing>`), + `app/components/TagListing.vue` (logic + markup tag listing).
- `toKebab` phải `String(str)` coerce trước `.trim()` — numeric YAML tag (`- 0.5`, `- 8`) parse thành number, `.trim()` trên number → `str.trim is not a function`, fatal vì scan tag mọi doc.
- TagListing chỉ giữ inner chrome (header + `flex-1 overflow-y-auto`) — `.stacked-column` wrapper (sizing + mobile 100vw) do StackedColumn cấp.
- Empty (không index doc + không match) → inline panel @ 200 (StackedColumn luôn truyền `no-throw`), khớp convention ContentView; KHÔNG hard-404.
- Dotted-slug tag (`0.5`) không prerender (Nitro coi `.5` là extension) → rename data `0.5`→`0-5`, `0.4`→`0-4` (URL-safe, khớp convention filename). Theme badge href là npm dep nên chỉ fix poe2-side bằng đổi data.
- **Index doc tuỳ chọn**: `content/tags/<slug>.md` → body render (ContentRenderer) phía trên Articles list. Excluded khỏi vault-keeper template validation (giống index.md). Thuần additive.
- **Đích cuối: upstream về repo `andy-note-nuxt`** — bug gốc ở theme. StackedColumn override + TagListing + toKebab String-coerce lift sạch sang theme (không dính i18n/poe2).
- Follow-up: mirror sang `../poe1/`; deploy poe2; reconcile andy `0.4.2` vs `0.4.3` trước khi upstream.

## Criteria

- [x] `app/components/StackedColumn.vue` (override) + `app/components/TagListing.vue` — branch `/tags/` → TagListing tại seam render mọi column.
- [x] Build sạch — `nuxt generate` exit 0, 533 routes, 0 lỗi 500, 0 `str.trim`. vault validate 63/63.
- [x] **Column-0**: `.output/public/tags/knight-of-aldur/index.html` list challenge-guide, no Not-Found, `<title>#Knight Of Aldur</title>` (render qua override sau khi xoá standalone page → chứng minh override take effect).
- [x] **No regression**: content page thường (challenge-guide article, builds section) vẫn render đúng column-0.
- [x] **Stack**: user confirm `?stack=...&stack=/tags/companion` render column tag listing OK (client-side).
- [x] **Index doc**: `content/tags/companion.md` → intro body + custom title + 6 article list; `/tags/knight-of-aldur` (no index) vẫn list-only.
- [x] **Upstream + release**: feature moved to `andy-note-nuxt` (StackedColumn branch + TagListing + ContentView toKebab fix + demo `content/tags/reference.md`), released **`0.5.0`** via release-please (npm + tag v0.5.0 verified).
- [x] **`0.5.1` fix**: tag-listing items thiếu `terminal-item--active` trail highlight khi mở thành deeper column (TagListing thiếu `isDrilled` của ContentView). Thêm `isDrilled` (path ∈ fullStack) → released `0.5.1`. Verified qua playwriter trên andy demo: click item → push column + item nhận `terminal-item--active` (activeCount=1). poe2 bumped `^0.5.1`.
- [x] **Cleanup poe2**: bump dep `^0.5.0` + install; deleted local overrides `StackedColumn.vue`+`TagListing.vue`; regenerate verified transparent (`/tags/knight-of-aldur` + companion intro + `/tags/0-5`, 533 routes, 0 errors). Data kept (24 tag renames, `content/tags/companion.md`, vault-keeper exclusion).
- [ ] **Follow-up (cần user quyết)**: commit + deploy poe2 (working tree lẫn draft WIP → commit chọn lọc); bump poe1 dep `^0.5.0` (cùng theme, cũng hưởng feature).

## Results (2026-05-29)

Pivot từ standalone page sang **StackedColumn override** sau khi user yêu cầu generic + stack. Kiến trúc cuối:

1. **`app/components/StackedColumn.vue`** (override, byte-faithful theme + 1 branch) + **`app/components/TagListing.vue`**. StackedColumn render MỌI column (kể cả index 0) nên branch `/tags/` ở đây làm tag page work y hệt standalone lẫn stack, không phải fork ContentView (to). Click article trong tag column bubble lên `@click.capture="onClick"` → push column như mọi in-column link. Standalone `pages/tags/[tag].vue` đã xoá (DRY — catch-all → StackedColumn cover column-0).
2. **`toKebab` String-coerce** — root cause 500 (numeric YAML tag). Theme's ContentView cùng latent bug.
3. **Rename 24 dotted tag** `0.5→0-5`, `0.4→0-4` (VI+EN) — URL-safe để prerender.
4. **Index doc feature** — `content/tags/<slug>.md` body render trên Articles list. `content/tags/companion.md` là ví dụ live. Excluded khỏi vault-keeper.

**Flags (out of scope, không tự sửa):**
- `content/mechanics/skills/blood-mage-sanguine-tides-flask-0.5.md` — filename có `.` → article unreachable (Nitro skip). Pre-existing, untracked. Rename `-0-5` để fix (cần user OK).
- `/en/tags/*` → 404 (không 500). EN namespace vốn broken (catch-all chỉ query collection `content`). TagListing cũng VI-only (`content`), nhất quán.
- andy clone local `0.4.2` vs poe consume `0.4.3` → reconcile trước khi upstream.
