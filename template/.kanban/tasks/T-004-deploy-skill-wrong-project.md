# T-004: Skill /deploy trỏ sai CF project (poe-n cũ thay vì poe2)

> Sửa skill deploy để document đúng project `poe2` / `poe2.aiocean.io` sau khi tách repo.

- **priority**: high
- **effort**: S

## Problem

Skill `.claude/skills/deploy/SKILL.md` vẫn document CF project **`poe`** / repo **`nguyenvanduocit/poe-n`** / domain **`poe.aiocean.io`** — đây là repo CŨ gộp poe1+poe2 trước khi tách. Workspace `poe2` hiện tại deploy lên một CF project KHÁC.

Verified qua CF API list projects:
- Project đúng: **`poe2`** · repo `nguyenvanduocit/poe2` · subdomain `poe2-7sl.pages.dev` · domain `poe2.aiocean.io`
- Project cũ `poe` / `poe-n` vẫn tồn tại, đứng yên từ 2026-05-25 (commit `83e7c717`, không có trong history repo poe2).

Hậu quả: mọi lệnh trong skill (status check, manual trigger, recreate, verify live) trỏ vào `/projects/poe` → query/thao tác nhầm project cũ. Lúc check version suýt kết luận sai là "server lag 4 ngày".

## Goal

`/deploy` chạy đúng vào project `poe2` / `poe2.aiocean.io` — không còn dấu vết project `poe`/`poe-n` cũ trong skill.

## Requirements

- Đổi mọi tham chiếu: project `poe`→`poe2`, repo `poe-n`→`poe2`, subdomain `poe-70i`→`poe2-7sl`, domain `poe.aiocean.io`→`poe2.aiocean.io`.
- Giữ nguyên giá trị đã verify khớp giữa 2 project: CF account (`$CF_ACCOUNT_ID`), build_command, dest_dir `dist`, compat `2025-11-04`, build_image v3, env NODE_VERSION=20 / BUN_VERSION=1.2.5.
- Clean-slate: không để lại "trước đây là poe-n", không ghi chú lịch sử tách repo trong body skill (history thuộc git, không thuộc skill).
- Non-goal: KHÔNG đụng vào project CF `poe`/`poe-n` cũ (để nguyên cho poe1 hoặc xử lý riêng); KHÔNG sửa skill bên `../poe1/`.

## Criteria

- [x] `grep -nE 'poe-n|poe-70i|projects/poe[^2]|poe\.aiocean' SKILL.md` không còn match config (chỉ còn 1 dòng note cố ý cảnh báo project khác).
- [x] Block "Project state" hiển thị project=poe2, repo=poe2, subdomain=poe2-7sl.pages.dev, domain=poe2.aiocean.io.
- [x] Mọi URL API dùng `/projects/poe2/...` (10 lần).
- [x] Recreate payload có `"name":"poe2"`, `"repo_name":"poe2"`, domain `poe2.aiocean.io`.
- [x] frontmatter `description` + H1 trỏ `poe2.aiocean.io`.
- [x] Bonus: snippet "verify server đã chạy commit mới nhất" chạy thật → HEAD=Deployed=45c698a, in `✅ server = latest commit`.
