#!/usr/bin/env python3
"""Extract the patch-notes post body from a GGG forum thread HTML page.

Reads HTML from the path in argv[1] (or stdin), locates the first forum post's
content container — the ``<div class="content">`` that encloses the ``<h2>``
patch title — strips ``<img>`` tags, splits multi-entry list items, and writes
that fragment HTML to stdout.

Why extract the post body before converting to Markdown: the forum page is a
table-based layout. Feeding the whole page to pandoc/markitdown leaves a wall of
raw HTML (or silently truncates). Handing the converter ONLY the post-body
fragment lets it emit clean Markdown headings and bullet lists.

Selector is semantic, not positional. Full patch-notes threads carry an ``<h2>``
patch title, so we anchor on it and walk up to its enclosing ``div.content``.
GGG's mid-patch *"Patch Notes Preview"* threads instead start sections at ``<h3>``
with no ``<h2>``; for those we fall back to the first ``tr.newsPost`` post cell and
take its ``div.content`` body, re-parsed with ``lxml`` (which reconstructs the
malformed forum DOM like a browser — ``html.parser`` mis-nests the unclosed empty
content div these threads ship). Patch notes posted as a REGULAR forum thread
(0.5.2 = thread 3960375 — no news layout at all, sections at ``<h3>``) have
neither anchor; for those we take the OP body: first row of
``table.forumPostListTable`` → ``td.content-container`` → ``div.content``.
Fails loudly if no anchor resolves — that signals a blocked fetch (Cloudflare)
or a forum redesign, both of which should stop the pipeline rather than emit a
partial file.

GGG sometimes packs several patch-note entries into a single ``<li>``, one
entry per line, separated by a newline or a ``<br>``. With ``pandoc --wrap=none``
those collapse into one giant bullet. ``split_packed_list_items`` restores one
bullet per entry by splitting such list items before conversion.
"""

import sys

from bs4 import BeautifulSoup, NavigableString


def split_packed_list_items(node, soup) -> None:
    """Split leaf ``<li>`` elements that pack several entries (newline/``<br>``
    separated) into one ``<li>`` per entry. Skips any ``<li>`` that holds a
    nested list, so sub-lists are left intact."""
    for li in list(node.find_all("li")):
        if li.find(["ul", "ol"]):
            continue
        has_break = any(getattr(c, "name", None) == "br" for c in li.children) or any(
            isinstance(c, NavigableString) and "\n" in c for c in li.children
        )
        if not has_break:
            continue

        segments = [[]]
        for child in list(li.children):
            if getattr(child, "name", None) == "br":
                segments.append([])
                continue
            if isinstance(child, NavigableString) and "\n" in child:
                parts = str(child).split("\n")
                segments[-1].append(NavigableString(parts[0]))
                for part in parts[1:]:
                    segments.append([NavigableString(part)])
            else:
                segments[-1].append(child)

        made = False
        for seg in segments:
            if not any(
                getattr(c, "name", None) is not None or str(c).strip() for c in seg
            ):
                continue
            new_li = soup.new_tag("li")
            for c in seg:
                # original tree nodes must be detached; freshly built strings
                # (from the newline split) have no parent and are appended as-is.
                new_li.append(c.extract() if c.parent is not None else c)
            li.insert_before(new_li)
            made = True
        if made:
            li.decompose()


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "/dev/stdin"
    html = open(src, encoding="utf-8", errors="replace").read()
    soup = BeautifulSoup(html, "html.parser")

    # Full patch-notes thread: anchor on the <h2> title, walk up to its div.content.
    title = soup.find("h2")
    if title is not None:
        node = title.find_parent("div", class_="content")
        if node is None:
            sys.exit(
                "extract-forum: <h2> title has no enclosing <div class='content'> "
                "— forum post structure changed"
            )
        for img in node.find_all("img"):
            img.decompose()
        split_packed_list_items(node, soup)
        sys.stdout.write(str(node))
        return

    # Preview thread (h3 sections, no h2): re-parse with lxml so the OP body sits
    # in a non-empty div.content inside the first newsPost cell, then emit that.
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        sys.exit(
            "extract-forum: preview-thread layout (no <h2>) needs the 'lxml' parser "
            "— install with: pip install lxml"
        )
    post = soup.find("tr", class_="newsPost")
    cell = post.find("td") if post else None
    node = cell.find("div", class_="content") if cell else None
    if node is None or not node.get_text(strip=True):
        node = cell  # whole post cell when the content div is empty/absent

    # Regular forum thread (no news layout at all, e.g. 0.5.2 = 3960375):
    # the OP body is the div.content of the first post row.
    if node is None:
        table = soup.find("table", class_="forumPostListTable")
        row = table.find("tr") if table else None
        op_cell = row.find("td", class_="content-container") if row else None
        node = op_cell.find("div", class_="content") if op_cell else None

    if node is None:
        sys.exit(
            "extract-forum: no <h2> title, no newsPost post body, and no "
            "forumPostListTable OP body found — fetch was blocked (Cloudflare) "
            "or the forum layout changed"
        )

    for img in node.find_all("img"):
        img.decompose()
    for div in node.find_all("div", class_="content"):
        if not div.get_text(strip=True):  # drop empty layout wrappers only
            div.decompose()
    split_packed_list_items(node, soup)
    sys.stdout.write(node.decode_contents())


if __name__ == "__main__":
    main()
