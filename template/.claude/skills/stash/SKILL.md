---
skill_name: stash
description: Read POE2 stash tabs in-game via DOM; route character data to /pob
version: 4.0.0
tags: [stash, inventory, poe2]
---

POE2 has no stash API. Read stash contents in-game, or scrape the stash page DOM
via Playwriter. For POE2 *character* data (gear, gems, passives), use `/pob` with a
poe.ninja profile URL — see the `pob` skill.

## Character data → /pob

POE2 character gear, gems, and passives come from `/pob`, not from this skill.
Pass a poe.ninja profile URL (or run `/pob --oauth <name>` for live state). See the
`pob` skill and memory `reference_poe2_char_stash_api` for the OAuth and snapshot paths.

## Stash → DOM scraping via Playwriter

Navigate to the stash page in the browser and read the DOM directly. Uses the
existing browser session; no auth token needed.

```python
import sys, os, json, time
sys.path.insert(0, os.path.expanduser("~/.claude/plugins/marketplaces/aiocean-plugins/plugins/aio-cdp-relay/skills/aio-cdp-relay/scripts"))
from cdp_client import CDPClient

with CDPClient() as cdp:
    tab = cdp.find_tab(url_contains="pathofexile.com")
    cdp.attach(tab["targetId"])

    # Navigate to stash page (account name uses - not # separator)
    cdp.navigate(
        "https://www.pathofexile.com/account/view-stash/hopthuxacnhan-3062/Mirage",
        wait=5
    )

    # Read stash tab names from DOM
    tabs = cdp.evaluate("""
        (() => {
            const tabs = document.querySelectorAll('.stashTabList .tab, .inventoryTab');
            return Array.from(tabs).map((t, i) => ({
                index: i,
                name: t.textContent.trim() || t.getAttribute('data-tab-name') || 'Tab ' + i
            }));
        })()
    """)
    print("Tabs:", json.dumps(tabs, indent=2))

    # Click on a specific tab by name (e.g. Currency)
    cdp.evaluate("""
        (() => {
            const tabs = document.querySelectorAll('.stashTabList .tab, .inventoryTab');
            for (const t of tabs) {
                if (t.textContent.trim() === 'Currency') { t.click(); return true; }
            }
            return false;
        })()
    """)
    time.sleep(2)  # wait for tab contents to load

    # Read items from the active tab
    items = cdp.evaluate("""
        (() => {
            const cells = document.querySelectorAll('.inventorySlot .itemContainer, .stashItem');
            return Array.from(cells)
                .filter(el => el.querySelector('.itemName, .itemHeader'))
                .map(el => ({
                    name: (el.querySelector('.itemName')?.textContent || '').trim(),
                    stackSize: el.querySelector('.stackSize')?.textContent?.trim() || null,
                    x: el.getAttribute('data-x'),
                    y: el.getAttribute('data-y'),
                }));
        })()
    """)
    print("Items:", json.dumps(items, indent=2))
```

**Tips:**
- Account URL format: `hopthuxacnhan-3062` (replace `#` with `-`)
- League name is case-sensitive: `Mirage`, `Standard`
- Wait at least 2s after clicking a tab before reading items
- If the DOM selectors change between PoE patches, inspect the page with DevTools to find new ones
- Sleep 1-2s between every Playwriter action on pathofexile.com to avoid flagging the account
