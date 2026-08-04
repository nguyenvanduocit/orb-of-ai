---
name: poedb
description: Access Path of Exile 2 database (poe2db.tw) via local goscrape mirror — patch-versioned snapshots of item base stats, modifier rolls, skill numerical data, monster info. POE2 ONLY. For POE2 wiki use /poewiki.
version: 1.0.0
tags: [database, data, research, poe2]
---

# PoE 2 Database Tools (Local Mirror — poe2db.tw)

poe2db.tw là **database site** cho POE2 (khác với wiki) — chuyên item base stat tables, modifier roll ranges, skill numerical breakdowns, monster stat sheets. Mirror về local qua `goscrape --markdown`, **tổ chức theo patch number** vì raw number thay đổi từng patch.

**Khi nào dùng skill này:**
- Cần item base stat chính xác (armour, evasion, ES roll range theo ilvl)
- Cần modifier roll range theo tier (T1 maximum life, T2 cold res, v.v.)
- Cần skill numerical breakdown (per-level damage scaling, AoE, cast time)
- Cần monster stat sheet (life, resist, damage type)
- Cần verify patch difference (so sánh 0.4 vs 0.5 numbers)

**KHÔNG dùng skill này khi:**
- Wiki-style description (mechanic explanation, lore) → `/poewiki`
- Live price → `/poe-ninja`
- Build calc → `/pob` hoặc `/mobalytics`

## Mirror Location — Patch-Versioned

```
data/poedb/
├── <patch>/                      # ví dụ 0.5.0, 0.5.1, 0.6.0
│   ├── <Page_Title>.md           # English page (poe2db.tw/us/<Page>) — flat, không lồng us/
│   ├── ...
│   ├── passive-skill-tree/       # Optional: JSON dump from POB2 fork
│   │   ├── data_us.json
│   │   └── meta.json
│   └── atlas-skill-tree/         # Future: atlas tree JSON dump
└── ...
```

poe2db phục vụ mọi page dưới segment locale `/us/`; goscrape mirror nguyên path nên page rơi vào `us/`. Ta chỉ dùng tiếng Anh nên `download.sh` flatten cấp `/us/` đó đi — page nằm thẳng `data/poedb/<patch>/<Page>.md`.

Mỗi patch tách thư mục riêng để giữ snapshot lịch sử. Numbers thay đổi → cần biết bạn đang đọc version nào.

## Refresh Mirror

Yêu cầu **goscrape >= v0.5.0** (`--url-file`, `--no-follow`, direct-output-dir fix). Mặc định fetch **đúng** những page mình muốn — không crawl mù cả site.

### Targeted — download chính xác page cần (mode chính)

Đây là cách dùng thường ngày: chỉ kéo về đúng các page đang research. Truyền **tên page** (slug) trực tiếp, hoặc full URL, hoặc một `--url-file`:

```bash
# Tên page trần — script tự prepend https://poe2db.tw/us/
./.claude/skills/poedb/scripts/download.sh 0.5.0 The_Auspex Mageblood The_Hollow_Mask

# Full URL cũng được
./.claude/skills/poedb/scripts/download.sh 0.5.0 https://poe2db.tw/us/The_Auspex

# List từ file (1 URL/dòng, bỏ qua # comment + dòng trống)
./.claude/skills/poedb/scripts/download.sh 0.5.0 --url-file /tmp/new-uniques.txt
```

Cơ chế: `goscrape --no-follow` chỉ tải đúng các page được nêu (+ assets của page), **không** follow `<a>` link nên không lan ra hàng nghìn page khác. Page nào fail (slug sai, 404) được log vào `goscrape-errors.log` rồi skip — phần còn lại của batch vẫn chạy hết.

Dựng `--url-file` thẳng từ patch notes — ví dụ toàn bộ unique mới của 0.5.0:

```bash
rg -o 'Unique item mới: (.+)' -r '$1' data/release-notes/Version_0.5.0.md \
  | sed 's/\.$//' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' \
  | sed "s/['’]//g; s/ /_/g; s#^#https://poe2db.tw/us/#" > /tmp/new-uniques.txt
./.claude/skills/poedb/scripts/download.sh 0.5.0 --url-file /tmp/new-uniques.txt
```

### Full crawl — toàn bộ `/us/` (fallback, hiếm khi cần)

```bash
./.claude/skills/poedb/scripts/download.sh 0.5.0 --all
```

Crawl đệ quy mọi link trong `/us/` (hàng nghìn page) — chỉ dùng khi thật sự cần mirror đầy đủ. Chậm, và thêm exclude editor dynamic URLs (`/us/passive-skill-tree/<hash>`, `/us/atlas-skill-tree/<hash>`).

Cả hai mode đều ghi vào `data/poedb/<patch>/<Page>.md` (flat — cấp `/us/` đã được strip), `--markdown`, exclude binary assets, rate-limit 4 req/s + delay 250ms (lịch sự với poe2db.tw).

## Query Workflows

### Pin một patch để query

```bash
# Set patch root cho session
PATCH_ROOT=data/poedb/0.5.0

# Tìm page theo title
find "$PATCH_ROOT" -iname "*hollow*mask*"

# Search nội dung
rg -l "Spirit Cost" "$PATCH_ROOT/"
rg -C 3 "Runic Ward" "$PATCH_ROOT/"
```

### So sánh số giữa 2 patch

```bash
# Diff item stat giữa 0.4 và 0.5
diff data/poedb/0.4.0/The_Hollow_Mask.md \
     data/poedb/0.5.0/The_Hollow_Mask.md
```

### Đọc page

```bash
# Dùng tool Read với path tuyệt đối
# data/poedb/0.5.0/<Page>.md
```

## Khi nào dùng poe2db vs poe2wiki

| Cần info | Dùng skill |
|---|---|
| Item description, lore, mechanic explanation | `/poewiki` |
| Item base stat ranges per ilvl | `/poedb` |
| Skill verbatim wiki text | `/poewiki` |
| Skill per-level damage table | `/poedb` |
| Monster lore / location | `/poewiki` |
| Monster exact life/resist values | `/poedb` |

Hai source bổ sung nhau — wiki cho "tại sao", db cho "bao nhiêu".

## Importing Database Content vào content/

Database data hữu ích nhất khi đưa vào content/guides/ làm "math chain PoC" hoặc "evaluation rule". Pattern owner-voice:

> "Item base T1 maximum life roll 110-119 trên helmet ilvl 86+" — viết as fact, không "theo poe2db.tw".

Numbers từ database là raw — phải tích hợp vào reasoning của owner, không paste table raw.

## Game Concept Linking

Skill này KHÔNG có MDC component riêng — game concept linking trong content/ vẫn dùng `:wiki-link{url="https://www.poe2wiki.net/wiki/..."}` (poe2wiki domain). poedb chỉ là **internal research source**, không phải public link target.

## Known goscrape Quirks

1. **Locale segment `/us/`**: poe2db phục vụ mọi page dưới `/us/` và goscrape mirror nguyên path → page rơi vào `${OUTPUT_DIR}/us/`. `download.sh` strip cấp này sau crawl (move lên patch root, xoá `us/`) vì ta chỉ dùng tiếng Anh. Bản goscrape cũ còn lồng thêm host-prefix (`data/poedb/<patch>/poe2db.tw/us/`) — **fixed ở goscrape v0.5.0** (ghi thẳng `--output`). Chạy binary cũ thấy folder `poe2db.tw/` sót lại thì `rm -rf` an toàn rồi rebuild goscrape (`GOTOOLCHAIN=local go install .` trong repo goscrape).

2. **Dynamic editor URLs**: poe2db.tw có `/us/passive-skill-tree/<base64_hash>` cho mỗi build user share. Script exclude regex chặn variant explosion — chỉ scrape landing page.

3. **Patch number folder**: ALWAYS pass patch arg. Script không auto-detect — vì chắc chắn biết patch mình đang research.
