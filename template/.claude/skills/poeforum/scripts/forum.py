#!/usr/bin/env python3
"""Read a Path of Exile 2 GGG forum page (listing or thread) and emit JSON.

RULE EXCEPTION — CLAUDE.md says "NEVER call pathofexile.com endpoints directly"
to protect a previously-flagged account. That rule guards the authenticated,
rate-limited trade/stash/character APIs. This script does a single ANONYMOUS,
READ-ONLY GET of a PUBLIC forum page — no auth, no account, no API. The flag
risk does not apply. A browser User-Agent is required because Cloudflare returns
403 to default curl/markitdown UAs. Mirrors update-release-note/fetch.sh exactly
(curl -fsS -A "$UA"); no playwriter needed since there is no logged-in session.

Subcommands:
  list   <forum-id>            -> forum listing: threads[] {id,title,author,replies,views,...}
  thread <thread-id> [page]    -> one page of posts: posts[] {author,posted_at,content,links}
  thread <thread-id> --all     -> every page concatenated (>=1.2s spacing between fetches)

Output is always valid JSON on stdout. Pure parse layer; curl is the transport.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
BASE = "https://www.pathofexile.com"
PAGE_GAP_SECONDS = 1.2  # polite spacing between page fetches for --all


# --- transport (imperative shell) -------------------------------------------


def fetch(url):
    """Anonymous read-only GET via curl with a browser UA (Cloudflare needs it)."""
    proc = subprocess.run(
        ["curl", "-fsS", "-A", UA, url],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        sys.exit(
            f"ERROR: curl failed ({proc.returncode}) for {url}: "
            f"{proc.stderr.strip()[:200]}"
        )
    return proc.stdout


# --- parse helpers (functional core) ----------------------------------------


def soupify(html):
    return BeautifulSoup(html, "html.parser")


def abs_url(href):
    if not href:
        return None
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE + href
    return None  # skip javascript:, #anchors, mailto, etc.


def to_int(text):
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def thread_id_from_href(href):
    m = re.search(r"/view-thread/(\d+)", href or "")
    return m.group(1) if m else None


def split_thread_title(raw_title):
    """'<Forum> - <Thread> - Forum - Path of Exile' -> (forum, thread)."""
    t = raw_title.strip()
    t = re.sub(r"\s*-\s*Path of Exile\s*$", "", t)
    t = re.sub(r"\s*-\s*Forum\s*$", "", t)
    if " - " in t:
        forum, thread = t.split(" - ", 1)
        return forum.strip(), thread.strip()
    return None, t


def forum_name_from_title(raw_title):
    """'<Forum> - Forum - Path of Exile' -> '<Forum>'."""
    t = re.sub(r"\s*-\s*Forum\s*-\s*Path of Exile\s*$", "", raw_title.strip())
    return t.strip()


def extract_content(content_div):
    """Clean post text + ordered de-duped links + the user-quotes it replies to.

    Returns (text, links, quotes):
      - text:   what THIS author wrote, with spoiler bodies kept (chrome stripped)
                and replied-to user-quotes pulled out so they aren't read as the
                author's own words.
      - links:  external/forum references the author posted (view-post permalinks
                and view-profile links dropped as navigation noise).
      - quotes: [{author, text}] of the posts being quoted. A blockquote counts as
                a user-quote only when it carries a view-profile attribution; the
                poster's own framing banner (a blockquote with no attribution, e.g.
                the megathread welcome banner) stays in `text`.
    """
    node = BeautifulSoup(str(content_div), "html.parser")  # clone, don't mutate doc

    quotes = []
    for bq in node.find_all("blockquote"):
        if bq.find_parent("blockquote") is not None:
            continue  # handled as part of its top-level quote
        attrib = bq.select_one('a[href*="view-profile"]')
        if attrib is None:
            continue  # author's own banner, not a reply-quote — leave in text
        author = attrib.get_text(strip=True)
        for chrome in bq.select("span.quote"):
            chrome.decompose()
        attrib.decompose()  # drop the "Name" link; "wrote:" stub removed below
        qtext = re.sub(r'^["\s]*wrote:\s*', "", bq.get_text("\n").strip())
        qtext = re.sub(r"\n{3,}", "\n\n", qtext).strip()
        quotes.append({"author": author, "text": qtext})
        bq.decompose()

    links = []
    for a in node.find_all("a", href=True):
        u = abs_url(a["href"])
        if not u or u.startswith(BASE + "/forum/view-post") or "view-profile" in u:
            continue  # skip permalinks + profile links (navigation noise)
        if u not in links:
            links.append(u)

    for chrome in node.select(".spoilerTitle, .spoilerButtons, span.quote"):
        chrome.decompose()
    for btn in node.find_all(["input", "button"]):
        btn.decompose()

    text = node.get_text("\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text, links, quotes


# --- listing parser ----------------------------------------------------------


def parse_listing(html, forum_id):
    soup = soupify(html)
    raw_title = soup.select_one("title").get_text(strip=True)
    threads = []
    for cell in soup.select("td.thread"):
        link = cell.select_one("div.title a") or cell.select_one("a.title")
        if not link:
            continue
        href = link.get("href", "")
        row = cell.find_parent("tr")
        author_a = cell.select_one(".postBy .post_by_account a")
        posted = cell.select_one(".postBy .post_date")

        replies = views = last_by = last_at = None
        sticky = False
        if row:
            vcell = row.select_one("td.views")
            if vcell:
                rep_span = vcell.find("span")
                replies = to_int(rep_span.get_text(strip=True)) if rep_span else None
                view_span = vcell.select_one(".post-stat span")
                views = to_int(view_span.get_text(strip=True)) if view_span else None
            lp = row.select_one("td.last_post")
            if lp:
                lb = lp.select_one(".post_by_account a")
                last_by = lb.get_text(strip=True) if lb else None
                ld = lp.select_one(".post_date")
                last_at = ld.get_text(" ", strip=True) if ld else None
            sticky = bool(
                row.select_one("[class*=sticky], [class*=important], td.flags img")
            )

        tid = thread_id_from_href(href)
        threads.append(
            {
                "thread_id": tid,
                "title": link.get_text(" ", strip=True),
                "url": abs_url(href),
                "author": author_a.get_text(strip=True) if author_a else None,
                "posted_at": posted.get_text(" ", strip=True).lstrip(", ")
                if posted
                else None,
                "replies": replies,
                "views": views,
                "last_post_by": last_by,
                "last_post_at": last_at,
                "sticky": sticky,
            }
        )

    return {
        "type": "forum",
        "forum_id": str(forum_id),
        "forum_name": forum_name_from_title(raw_title),
        "url": f"{BASE}/forum/view-forum/{forum_id}",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "thread_count": len(threads),
        "threads": threads,
    }


# --- thread parser -----------------------------------------------------------


def detect_total_pages(soup):
    pages = []
    for a in soup.find_all("a", href=True):
        m = re.search(r"/view-thread/\d+/page/(\d+)", a["href"])
        if m:
            pages.append(int(m.group(1)))
    return max(pages) if pages else 1


def parse_thread(html, thread_id, page):
    soup = soupify(html)
    raw_title = soup.select_one("title").get_text(strip=True)
    forum_name, thread_title = split_thread_title(raw_title)
    total_pages = detect_total_pages(soup)

    table = soup.select_one("table.forumPostListTable")
    rows = table.find_all("tr", recursive=False) if table else []

    posts = []
    i = 0
    while i < len(rows):
        tr = rows[i]
        content_div = tr.select_one("div.content")
        if not content_div:
            i += 1
            continue
        # Regular posts carry author + body in one row. Announcement (newsPost)
        # rows split the body from a following 'newsPostInfo' meta row — pull the
        # author/date/staff from there when this row has no author of its own.
        meta = tr
        if tr.select_one(".post_by_account") is None and i + 1 < len(rows):
            nxt = rows[i + 1]
            if "newsPostInfo" in (nxt.get("class") or []) and nxt.select_one(
                ".post_by_account"
            ):
                meta = nxt
                i += 1  # consume the meta row so it is not re-scanned
        acc = meta.select_one(".post_by_account")
        author = acc.get_text(" ", strip=True) if acc else None
        is_staff = bool(acc and "staff" in (acc.get("class") or []))
        pd = meta.select_one(".post_date")
        posted_at = pd.get_text(" ", strip=True) if pd else None
        text, links, quotes = extract_content(content_div)
        idx = len(posts)
        posts.append(
            {
                "index": idx,
                "is_op": (page == 1 and idx == 0),
                "is_staff": is_staff,
                "author": author,
                "posted_at": posted_at,
                "content": text,
                "quotes": quotes,
                "links": links,
            }
        )
        i += 1

    return {
        "type": "thread",
        "thread_id": str(thread_id),
        "title": thread_title,
        "forum_name": forum_name,
        "url": f"{BASE}/forum/view-thread/{thread_id}",
        "page": page,
        "total_pages": total_pages,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "post_count": len(posts),
        "posts": posts,
    }


def thread_url(thread_id, page):
    if page <= 1:
        return f"{BASE}/forum/view-thread/{thread_id}"
    return f"{BASE}/forum/view-thread/{thread_id}/page/{page}"


def parse_thread_all(thread_id):
    first = parse_thread(fetch(thread_url(thread_id, 1)), thread_id, 1)
    posts = list(first["posts"])
    for p in range(2, first["total_pages"] + 1):
        time.sleep(PAGE_GAP_SECONDS)
        page = parse_thread(fetch(thread_url(thread_id, p)), thread_id, p)
        posts.extend(page["posts"])
    first["page"] = "all"
    first["post_count"] = len(posts)
    first["posts"] = posts
    return first


# --- CLI ---------------------------------------------------------------------


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="forum.py", description="Read a GGG POE2 forum page as JSON."
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="forum listing -> threads[]")
    p_list.add_argument("forum_id", help="numeric forum id, e.g. 2216 (POE2 Builds)")

    p_thread = sub.add_parser("thread", help="thread posts -> posts[]")
    p_thread.add_argument("thread_id", help="numeric thread id, e.g. 3931901")
    p_thread.add_argument(
        "page", nargs="?", type=int, default=1, help="page number (default 1)"
    )
    p_thread.add_argument(
        "--all",
        action="store_true",
        help="fetch every page (polite spacing between fetches)",
    )

    args = parser.parse_args(argv)

    if args.cmd == "list":
        out = parse_listing(
            fetch(f"{BASE}/forum/view-forum/{args.forum_id}"), args.forum_id
        )
    else:
        if args.all:
            out = parse_thread_all(args.thread_id)
        else:
            out = parse_thread(
                fetch(thread_url(args.thread_id, args.page)), args.thread_id, args.page
            )

    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
