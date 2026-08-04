# T-046: extract-forum.py không parse được patch-notes thread layout thường

> 0.5.2 Patch Notes (thread 3960375) post như thread forum thường — extractor chỉ biết 2 layout cũ nên fetch.sh fail loud.

- **priority**: high
- **effort**: XS

## Problem

`fetch.sh 3960375 0.5.2` fail tại `extract-forum.py` với "no <h2> title and no newsPost post body found". Curl 200 OK — không phải Cloudflare. Root cause: GGG post 0.5.2 Patch Notes như **thread thường** (Kieren_GGG, `table.forumPostListTable` → `tr` đầu → `td.content-container` → `div.content`, section dùng `<h3>`), khác hai layout extractor đã biết: (1) news-post có `<h2>` title, (2) preview thread `tr.newsPost`. Extractor `.claude/skills/update-release-note/scripts/extract-forum.py:107-116` chỉ có 2 anchor đó.

## Goal

Fetch được patch notes từ cả ba layout GGG đang dùng — 0.5.2 ra file `data/release-notes/Version_0.5.2.md` sạch.

## Requirements

- Thêm fallback thứ 3: row đầu của `table.forumPostListTable`, lấy `div.content` trong `td.content-container`.
- Giữ nguyên hành vi 2 layout cũ (0.5.0 h2, 0.5.1 newsPost) — không regress.
- Vẫn fail loud khi không anchor nào resolve.
- Update docstring + SKILL.md ghi thread id 0.5.2 = 3960375.

## Criteria

- [x] `fetch.sh 3960375 0.5.2` chạy xong, `Version_0.5.2.md` đủ body 139 dòng — lưu ý layout này dùng **bold text** làm section title (Endgame/Delirium/Runes of Aldur/Monster/General/Bug Fixes), không phải `<h3>`; chỉ có 1 `<h3>` là title post
- [x] Dry-run regression (`RELEASE_NOTES_DIR=tmp/relnotes-regress`): 0.5.1 body diff = 0 dòng (byte-identical); 0.5.0 chỉ thiếu block hotfix curate tay cross-thread (expected theo T-028, không phải regression)
- [x] SKILL.md ghi nhận id 3960375 + note regular-thread layout
