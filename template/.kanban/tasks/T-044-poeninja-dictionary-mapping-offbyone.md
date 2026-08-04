# T-044: poe.ninja dictionary mapping lệch slot trong collect-builds.py + builds-api.sh
> Class distribution trong latest.json dán nhãn sai (label lệch 1 slot dictionary), và panel "Top Main Skills" của builds-api.sh map sai dictionary cho skill dimension
- **priority**: medium
- **effort**: S

## Problem
Hai script poe.ninja cùng có lỗi mapping dimension→dictionary, phát hiện 2026-06-10 khi đối chiếu với website thật (playwriter):

1. `collect-builds.py` — `data/poe-ninja/runesofaldur/latest.json` ghi class distribution "Titan 24.68%, Pathfinder 18.69%, ..." trong khi website thật là **Martial Artist 25%, Spirit Walker 19%**. Label lệch 1 slot dictionary (count đúng, tên sai). Evidence: filter API `class=Spirit+Walker` trả 23,271 chars ≈ count đang dán nhãn "Pathfinder" (23,212); website xác nhận Spirit Walker 19%.
2. `builds-api.sh` `parse_overview` — section "Top Main Skills" in tên từ gem dictionary nhưng dimension skills dùng dictionary khác (hoặc offset khác): in "Shock 97.1%" trong khi website là "Wild Protector 97%". Item dimension thì map ĐÚNG (Lavianga's 56% khớp website) — chỉ skill dimension sai.

Filter server-side theo tên (`--class`, có sẵn trong script) hoạt động đúng — chỉ phần resolve tên hiển thị bị sai.

## Goal
Đọc distribution poe.ninja từ script ra đúng tên như website, không cần mở browser đối chiếu.

## Requirements
- Fix mapping cho cả 2 script (root cause chung: dimension `dict_id` → dictionary nào, offset nào).
- Re-validate bằng website: SW-filtered top skills phải ra Wild Protector 97% / Whirling Slash 51% / Twister 51%; class dist phải ra Martial Artist 25% / Spirit Walker 19%.
- Snapshot `latest.json` + `trends.json` + snapshots cũ của runesofaldur cần re-generate sau fix (label sai đã persist).

## Criteria
- [ ] `builds-api.sh overview runesofaldur --class "Spirit+Walker"` in top main skill = Wild Protector ~97%
- [ ] `collect-builds.py` chạy lại ra class dist khớp website (Martial Artist #1, Spirit Walker #2)
- [ ] Snapshot runesofaldur re-generated với label đúng
