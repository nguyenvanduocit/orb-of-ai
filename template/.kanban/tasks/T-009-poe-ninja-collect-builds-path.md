# T-009: poe-ninja collect-builds ghi data sai chỗ (`.claude/skills/data/`)
> Fix path resolution của collect-builds.py để snapshot ghi vào canonical `data/poe-ninja/<league>/`
- **priority**: high
- **effort**: XS

## Problem
`.claude/skills/poe-ninja/scripts/collect-builds.py` resolve sai project root:
- `PROJECT_DIR = Path(__file__).resolve().parents[2]` → `.claude/skills` (chỉ leo 2 cấp), khiến `DATA_DIR = .claude/skills/data/poe-ninja` thay vì `<root>/data/poe-ninja`.
- `out_dir = DATA_DIR / snapshot["game"] / snapshot["league_url"]` chèn segment `poe2/` kiểu POE1-era, mâu thuẫn docstring (`data/poe-ninja/<league>/`) + rule canonical "workspace đã game-specific, không có poe{1,2}/ subpath".

Hệ quả: snapshot economy `runesofaldur` (bản DUY NHẤT — canonical đang trống) bị ghi vào `.claude/skills/data/poe-ninja/poe2/runesofaldur/{latest,trends,snapshots}`, vi phạm "skill folder không được giữ data/ con". CACHE_DIR cũng rơi vào `.claude/skills/tmp/`.

## Goal
Chạy collect-builds.py → snapshot ghi đúng `data/poe-ninja/<league>/`, cache vào `tmp/`, không đụng `.claude/skills/`.

## Requirements
- Không đổi read-side: baselines fetch live từ poe.ninja time machine (HTTP), không đọc snapshot local → an toàn đổi write path.
- Move bản data lạc về canonical (đã làm trong commit relocate).

## Criteria
- [x] `parents[2]` → `parents[4]` (scripts→poe-ninja→skills→.claude→root)
- [x] Bỏ segment `snapshot["game"]` khỏi out_dir → `DATA_DIR / league_url`
- [x] `python3 -m py_compile` pass
- [x] Resolve verify: PROJECT_DIR == project root, out_dir == `data/poe-ninja/runesofaldur` (khớp data đã relocate), CACHE_DIR == `tmp/poeninja-cache`
