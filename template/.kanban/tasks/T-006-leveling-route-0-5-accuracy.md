# T-006: Leveling route data đúng với POE2 0.5 "Return of the Ancients"
> Rewrite `app/composables/data/leveling-poe2-0-5.ts` cho khớp campaign 0.5 thật (4 Acts + 3 Interludes), verify từng zone từ nguồn current — không nhận data 0.4-era.

- **priority**: high
- **effort**: L

## Problem
`app/composables/data/leveling-poe2-0-5.ts` (70 zones / 306 steps, feed trang `/leveling`) được author ~29/05 nhưng base structure đến từ wiki mirror scrape **26/05 — TRƯỚC launch 0.5 (29/05)**. Hệ quả: data là 0.4-era hybrid.

Bằng chứng đã verify:
- File **thiếu hoàn toàn 3 Interludes** (0.5 thay Cruel mode bằng 3 Interlude — campaign = 4 Acts + 3 Interludes, exit Lv60-65).
- **Act 4 hiện tại đáng ngờ/có thể fabricated**: chứa "Trial of the Ancestors" (POE1 league), "Benedictus, First Herald of Utopia" (vốn là Act 3 boss 0.4) → cần rebuild từ nguồn current.
- Chưa có steps cho **Farrow** (NPC mới, 4 quests xuyên Act 1-4) và **Fate of the Vaal** (6 Ancient Beacons Act 3 + Interludes — patch L195, L50).
- Act 3 chưa chắc đã **rearrange order** (patch L303).
- `clientName` (key match Client.txt auto-advance) chưa verify từ name-authority; phát hiện spelling ambiguity "The Dreadnought" (file) vs "Dreadnaught" (patch L302).
- Nguồn community (maxroll/domistae) bất đồng nặng về tên Interlude + boss → phải reconcile từ primary text, không nhận summary.

## Goal
Người chơi mở `/leveling` thấy route campaign POE2 0.5 chính xác từng zone theo đúng thứ tự đi thật của patch hiện tại, và auto-advance theo Client.txt khớp tên zone in-game.

## Requirements
- Chỉ sửa data file (+ matcher comment nếu cần). KHÔNG đổi page/composable/matcher logic — model Interludes như `LevelingAct[]` entries (renderer data-driven, zero blast radius).
- Giữ owner-voice tiếng Việt hiện có cho zone không đổi (diff-drive: chỉ rewrite delta, không regen content đang đúng).
- `clientName` source từ name-authority (poe2db/wiki page title), KHÔNG từ prose guide; field này mark LOW-confidence in-game-test (chỉ verify được khi vào game).
- Structure (4 Acts + 3 Interludes, tên/level/boss/order) phải có ≥2 nguồn current độc lập confirm; bất đồng = resolve từ primary source, không paper-over bằng confidence label.
- Source hierarchy: patch notes > poedb > wiki cho zone-existence/name/level/boss; maxroll + domistae cho order + objectives.

## Criteria
- [x] Campaign structure = 4 Acts + 3 Interludes, xác nhận bởi ≥2 nguồn 0.5-current. (4 nguồn: poe2db live, maxroll, domistae, patch notes; 0 blocking conflict)
- [x] 3 Interludes có mặt với tên chính xác (resolve conflict Interlude names), đúng vị trí slot sau Act 4, đủ zones + boss. (The Curse of Holten / The Stolen Barya / Doryani's Contingency, id 5/6/7, 22 zones từ wiki navbox + boss từ progression graph)
- [x] Act 4 — verify từ nguồn current: 18 zones KHÔNG fabricated (Trial of the Ancestors = trial buff area thật, The Excavation/Benedictus thật, finale Tavakai the Chieftain ✓ không phải Zarokh 0.4).
- [x] Patch-note deltas tick từng dòng: Dreadnaught Vanguard removed + Jamanra Abomination vào The Dreadnought (L302) ✓; Act 3 reorder (L303 — giữ order cũ + flag in-game test, patch không enumerate); Freythorn ritual-reward step removed (L189) ✓; Plunder's Point gate 4 Map Pieces (L770) ✓ đã có sẵn; Farrow 4 quests Act 1/2/3/4 (L50/52/54/55/57) ✓; Fate of the Vaal beacons Act 3 + Interlude 3, optional (L195) ✓; Matlan Waterways pressure pads (L304) ✓; Navali Greater Mind Rune (L771) ✓. Kingsmarch hub (L67) = Atlas endgame, KHÔNG thêm vào campaign ✓.
- [x] `clientName` từ name-authority (poe2db live, confirm trực tiếp fetch The_Azak_Bog=40); Dreadnought (-ought) giữ, Dreadnaught (-aught)=0; LOW in-game-test note trong header.
- [x] Không có `clientName` trùng across acts+interludes (0 dup); matcher comment "Cruel re-run" → "a revisited zone" (clean-slate).
- [x] `bun run generate` pass (535 routes, exit 0); matcher 23/23 pass.
- [x] Header comment cập nhật: 4 Acts + 3 Interludes, 92 zones / 337 steps.
- [x] Reviewer agent (oh-my-claudecode:code-reviewer) cross-check vs spec + patch notes — APPROVE, 0 critical/high/medium, zero 0.4 residue.

## In-league residual (test plan — log khi chơi 0.5)
- clientName từng zone vs Client.txt "You have entered <X>." thật (đặc biệt interludes LOW confidence).
- Act 3 area order (L303 rearrange nhưng patch không enumerate — đang giữ order cũ).
- 3 Interludes order + area level (nguồn 0.3-era navbox, 22/92 zones).
- Freythorn s2 dispel-mist còn cần không (L189 chỉ bỏ reward, giữ dispel-mist access — defensible, cần confirm in-game).
- Map Piece thứ 4 location (route list 3/4 spot; gate đúng nhưng spot thứ 4 tìm in-game).
