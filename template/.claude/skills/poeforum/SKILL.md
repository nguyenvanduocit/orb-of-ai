---
name: poeforum
description: Read Path of Exile 2 GGG forum pages (pathofexile.com/forum) as clean JSON — forum listing (threads[]) or thread posts (posts[] with author/date/staff/content/links + pagination). Anonymous read-only browser-UA curl, no auth, no playwriter. Use when user wants to read the POE2 Builds forum, a build/feedback thread, "đọc forum", "xem forum builds", "view-thread", "view-forum", or "/poeforum".
version: 1.0.0
tags: [forum, ggg, research, json, poe2]
---

# /poeforum — đọc GGG POE2 forum trả JSON

Đọc trang forum public của GGG (`pathofexile.com/forum`) và trả về JSON sạch để consume trong chat, workflow, hoặc khi nghiên cứu build/feedback. Hai chế độ: **listing** (danh sách thread của một forum) và **thread** (post array, có pagination).

## Khi nào dùng

- User đưa link `view-forum/<id>` hoặc `view-thread/<id>`, hoặc bảo "đọc forum builds POE2", "xem thread này nói gì".
- Cần survey forum Builds (id `2216`), Feedback, Announcements... mà không muốn viết parser BeautifulSoup ad-hoc mỗi lần.
- Cần content thread (build guide, megathread, feedback) ở dạng structured để trích link PoB/mobalytics/youtube, lọc staff reply, hoặc đọc nhiều page.

KHÔNG dùng để: lấy patch notes (đã có `/update-release-note`, parse section + ghi `data/release-notes/`), post/reply (read-only), hay search forum (GGG không có forum-search API ổn định).

## Transport — vì sao curl an toàn ở đây

CLAUDE.md cấm gọi thẳng endpoint `pathofexile.com` để bảo vệ account đã từng bị flag. Rule đó canh **API auth + rate-limited** (trade/stash/character). Skill này chỉ GET **ẩn danh, read-only, trang forum public** — không auth, không account, không API, không cookie. Flag risk không áp dụng. Browser User-Agent là bắt buộc vì Cloudflare trả 403 cho UA mặc định của curl/markitdown. Đây đúng exception đã document trong `update-release-note/fetch.sh`, dùng lại y hệt UA + cờ `curl -fsS`. Không cần playwriter (không có session đăng nhập để mượn).

## Lệnh

```bash
.claude/skills/poeforum/scripts/forum.sh list   <forum-id>            # listing -> threads[]
.claude/skills/poeforum/scripts/forum.sh thread <thread-id> [page]    # 1 page -> posts[]
.claude/skills/poeforum/scripts/forum.sh thread <thread-id> --all     # mọi page gộp lại
```

Output JSON ra stdout, pipe `jq` để cắt. `--all` fetch tuần tự mọi page với spacing 1.2s giữa mỗi fetch (lịch sự với Cloudflare) — thread dài (15+ page) sẽ mất chục giây, cân nhắc đọc từng page nếu chỉ cần phần đầu.

Forum id hay dùng: **`2216`** = Path of Exile 2 Builds. (Subforum khác lookup id từ URL forum trên trang GGG.)

## JSON shape

**`list <forum-id>`:**

```json
{
  "type": "forum",
  "forum_id": "2216",
  "forum_name": "Path of Exile 2 Builds",
  "url": "https://www.pathofexile.com/forum/view-forum/2216",
  "fetched_at": "2026-06-09T...Z",
  "thread_count": 30,
  "threads": [
    {
      "thread_id": "3953968",
      "title": "BOTW [0.5] Disciple of BODACH (Raven's Flock Varashta)",
      "url": "https://www.pathofexile.com/forum/view-thread/3953968",
      "author": "SpudTheKing#2343",
      "posted_at": "Jun 7, 2026, 6:37:59 PM",
      "replies": 3,
      "views": 419,
      "last_post_by": "arkanie#2558",
      "last_post_at": "Jun 9, 2026, 2:59:03 PM",
      "sticky": false
    }
  ]
}
```

**`thread <thread-id> [page]`:**

```json
{
  "type": "thread",
  "thread_id": "3931901",
  "title": "[0.5.0] | Eldritch Spirit Walker Summoner Megathread ...",
  "forum_name": "Path of Exile 2 Builds",
  "url": "https://www.pathofexile.com/forum/view-thread/3931901",
  "page": 1,
  "total_pages": 15,
  "fetched_at": "2026-06-09T...Z",
  "post_count": 10,
  "posts": [
    {
      "index": 0,
      "is_op": true,
      "is_staff": false,
      "author": "Heroxsolbadguy#5368",
      "posted_at": "May 17, 2026, 4:26:18 AM",
      "content": "...lời CỦA author, spoiler body expand, chrome + quote tách ra...",
      "quotes": [{"author": "Casia#1093", "text": "...post bị quote..."}],
      "links": ["https://youtu.be/...", "https://mobalytics.gg/poe-2/profile/..."]
    }
  ]
}
```

Ghi chú field:
- **`is_op`** chỉ true cho post đầu tiên tuyệt đối (page 1, index 0). Tác giả mở thread đăng lại nhiều lần KHÔNG được tính is_op cho mỗi post.
- **`is_staff`** true khi author là GGG staff (vd `Natalia_GGG`, `Belakay_ggg`) — đọc từ class `staff` trên author span. Post announcement (newsPost) tách author sang row `newsPostInfo` riêng; parser đã gộp đúng.
- **`content`** là lời CỦA author thôi: spoiler body giữ ("Spoiler"/"Show" chrome strip), reply-quote tách sang `quotes[]` để không bị đọc nhầm thành lời author; không lẫn HTML thô.
- **`quotes`** `[{author, text}]` = các post mà author này đang reply/quote. Blockquote chỉ tính là quote khi có attribution view-profile (`X wrote:`); banner tự-đóng-khung của chính author (blockquote không attribution, vd welcome banner của megathread) ở lại trong `content`.
- **`links`** gom mọi `<a href>` trong post (kể cả trong spoiler đã đóng), bỏ permalink `/forum/view-post/...` + profile link `/account/view-profile/...`, dedupe giữ thứ tự — dùng để trích PoB/mobalytics/youtube/poe.ninja reference.
- **`total_pages`** detect từ link pagination, default 1 khi thread một page.

## Script

`scripts/forum.sh` — entrypoint, resolve python có bs4 (Framework python như fetch.sh) rồi gọi `forum.py`.
`scripts/forum.py` — curl (transport, imperative shell) + parse bs4 (functional core) + JSON. Không persist data (đọc live, ephemeral). Cần `curl` + python `bs4`.
