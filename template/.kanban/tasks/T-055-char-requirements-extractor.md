# T-055: Char requirements extractor (attribute/level, effective-req aware)
> Đọc export JSON của character → liệt kê requirement của mọi item + gem, tính binding requirement và effective-req (Giant's Blood ×3, reduced attribute requirement) so với attribute thật.

- **priority**: medium
- **effort**: S

## Problem

Kiểm character có đủ requirement không (đặc biệt là effective requirement sau khi Giant's Blood triple và mod reduced-attribute-requirement áp vào) hiện phải lục tay bằng python qua export JSON mỗi lần. Vừa dính đúng chuyện này khi cân nhắc đổi vũ khí The Hammer of Faith: cần biết Str live 150 có chạm nổi requirement effective ~222-342 dưới Giant's Blood không. Đây là nhu cầu lặp lại và dễ sai khi làm tay (quên ×3 của Giant's Blood, hoặc quên trừ mod reduced-requirement).

Đã verify cấu trúc export (`data/character-exports/export-<char>.json`, format poe.ninja model):
- Item có field `requirements` (list `Level` / `Str` / `Dex` / `Int`).
- Gem socketed có `requirements` + `weaponRequirements` + `supportGemRequirements`.
- Attribute thật ở `defensiveStats.{strength,dexterity,intelligence}`.
- Keystone ở `keystones` (Giant's Blood detect được ở đây).
→ Requirement gốc nằm SẴN trong export, không cần cross-ref poedb. Phần export KHÔNG precompute là effective-requirement (Giant's Blood ×3, reduced-req) — đó là value-add của tool.

## Goal

Một lệnh đọc export JSON và in ra: requirement từng item + từng gem, binding requirement per attribute (max), attribute thật của char, và headroom — có tính effective-requirement modifier. Kèm chế độ what-if: đưa requirement gốc của một item ứng viên → trả effective requirement dưới keystone/mod hiện tại + còn thiếu bao nhiêu so với attribute char.

## Requirements

- Single source: chỉ đọc export JSON, không fetch, không cross-ref poedb/wiki cho base requirement.
- Effective-req math: detect keystone Giant's Blood → ×3 attribute requirement của Martial Weapon; áp mod `reduced attribute requirements` (global %). Hiển thị cả raw lẫn effective, flag cái nào char chưa đạt.
- What-if mode: ví dụ `--candidate "str:114,martial"` → effective ~342 (hoặc ~222 nếu có mod 35% reduced) + gap so với Str char.
- Home: `.claude/skills/pob/scripts/requirements.ts` (bun/TS, sibling `pob.ts`/`pob-client.ts`). Knowledge ghi vào `pob/SKILL.md` (cơ chế requirement POE2 + map field trong export + gotcha Giant's Blood/reduced-req).
- Non-goals: KHÔNG fetch (reuse fetch script sẵn có), KHÔNG recommend gear, KHÔNG model DPS. Future consumer: `/gear-upgrade` gọi lại khi check một synthetic item.

## Criteria

- [x] `bun .claude/skills/pob/scripts/requirements.ts data/character-exports/export-ThaoCamVienSaiGon.json` in per-item + per-gem Str/Dex/Int/Level requirement, binding (max) per attribute, char Str/Dex/Int, headroom.
- [x] Có Giant's Blood → Martial Weapon attribute requirement hiển thị ×3; mod reduced-attr-req áp đúng (LOCAL only, không cross-item); flag mọi requirement chưa đạt.
- [x] What-if: candidate Str 114 martial weapon → effective 342 (114×3), gap 192 so với Str char 150; `--global-reduced 35` → 223 (chỉ global mới hạ req weapon, local tiara không).
- [x] Section knowledge thêm vào `pob/SKILL.md`: cơ chế + vị trí field export + gotcha Giant's Blood/reduced-req (local-vs-global) + worked example.
- [x] Verify trên export live: Str 150 / Int 361, Giant's Blood ×3, binding Int 339 từ Chober (Int 361 chỉ dư 22).

## Outcome

Tool đã build + verify. Phát hiện sửa hai lỗi mình từng nói: (1) reduced-attr-req LOCAL nên tiara không hạ req weapon → Hammer gap 192 chứ không 72; (2) Int không dư vì Giant's Blood triple cả Int req Chober (339). Build doc 0-5-spirit-walker-companion-pack.md đã sync (Hammer "đã loại"). Future consumer: `/gear-upgrade` gọi requirements.ts khi check synthetic item.
