# T-039: Skill /poeforum — đọc GGG forum trả JSON

> Skill + script đọc forum pathofexile.com (listing + thread) trả JSON sạch để dễ tái dùng về sau.

- **priority**: medium
- **effort**: M

## Problem

Hiện đọc GGG forum (vd `view-forum/2216` = POE2 Builds, hay `view-thread/<id>` build/feedback thread) phải curl ad-hoc rồi viết parser BeautifulSoup một lần dùng trong `/tmp` mỗi lần hỏi. Không có entrypoint ổn định, không có output structured để workflow/agent khác consume. `update-release-note/fetch.sh` có fetch forum nhưng đóng khung riêng cho patch-notes (parse h2/h3 section, ghi markdown `data/release-notes/`, curate header) — không trả listing, không trả post array, không tái dùng cho forum đọc tổng quát.

GGG forum sau Cloudflare: default UA (markitdown/curl/WebFetch) ăn 403; phải browser-UA. Đây là GET ẩn danh read-only trang public — KHÔNG phải GGG API auth/rate-limited (trade/stash), nên không dính account-flag risk (đúng exception đã document trong `update-release-note/fetch.sh`).

## Goal

Có một skill `/poeforum` với script sẵn: cho forum-id hoặc thread-id → trả JSON sạch (thread list / post array, có pagination), để lần sau làm việc với forum chỉ cần gọi script thay vì viết parser mới.

## Requirements

- Transport = browser-UA curl, anonymous read-only GET public forum page. KHÔNG đụng GGG auth API, KHÔNG playwriter (không cần — trang public, không account).
- Hai lệnh:
  - `list <forum-id>` → JSON forum listing: forum_name + threads[] {thread_id, title, url, author, posted_at, replies, views, last_post_at, last_post_by, sticky}.
  - `thread <thread-id> [page]` → JSON thread: title, forum_name, page, total_pages, posts[] {index, is_op, author, posted_at, content (text, spoiler-expanded), links[]}.
  - `thread <thread-id> --all` → fetch mọi page, spacing ≥1s giữa page (lịch sự với Cloudflare), gộp posts.
- Output là JSON hợp lệ (`jq .` parse được), không lẫn HTML thô. Links (youtube/pobb.in/mobalytics/poe.ninja…) tách riêng `links[]` mỗi post để dễ consume build reference.
- Script sống ở `.claude/skills/poeforum/scripts/`, resolve python có bs4+lxml (Framework python pattern như fetch.sh). Data KHÔNG persist (đọc live, ephemeral) — đây là transport skill, không phải data blob.
- SKILL.md document command + JSON shape + lý do transport an toàn. Thêm alias `/poeforum` vào `poe2/CLAUDE.md`.
- Non-goal: ghi content note, parse patch-notes (đã có update-release-note), post/reply (read-only), search forum (GGG không có forum search API ổn định).

## Criteria

- [x] `forum.sh list 2216` → JSON, `jq '.threads | length'` = 30 (≥ 20), 0 thread thiếu thread_id/title/url/author/replies/views.
- [x] `forum.sh thread 3931901` → JSON, `total_pages` = 15, `posts[0].is_op == true`, `posts[0].author` = "Heroxsolbadguy#5368", links[] có 7 youtube/mobalytics URL từ spoiler.
- [x] `--all` proven trên thread 3908496 (2 page) → post_count 17 (10+7), op_count=1, elapsed 2.8s = spacing 1.2s thật; 3931901 dùng cùng code path.
- [x] Mọi output `jq -e` exit 0 (JSON hợp lệ); grep HTML/spoiler-chrome leak trong content = 0.
- [x] SKILL.md có command reference + JSON shape + transport-safety note; `/poeforum` alias + workflow snippet trong poe2/CLAUDE.md; staff fixture 3949114 confirm `is_staff` (Natalia_GGG).
