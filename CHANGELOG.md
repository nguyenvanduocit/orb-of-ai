# Changelog

Lịch sử thay đổi của **Orb Of AI** (discord-claude-bot). Định dạng: mục mới nhất trên cùng.

---

## Cửa Ải — Mùa 2 (2026-07-15)

Bản cân bằng lớn cho game `/rpg` (Cửa Ải), sinh ra từ feedback của người chơi (An D Huynh) + phân tích telemetry Mùa 1. **Tiến độ của mọi người được GIỮ NGUYÊN** — season này là rebalance, không phải wipe.

### 🌟 Sửa kẹt Trùng Sinh (Prestige) — vấn đề số 1

**Trước:** thưởng 🔮 Jewel = (tầng sâu nhất lần này − lần trước) ÷ 3, và phải phá kỷ lục tầng cũ mới được trùng sinh. Hai điều kiện triệt tiêu nhau → càng trùng sinh càng kẹt (An trùng sinh 3 lần rồi khoá cứng, chỉ nhận +1 🔮).

**Nay:** thưởng tính **theo sức mạnh (power)** lúc reset — `reward = max(1, ⌊2·log₂(power/1000)⌋)`:
- Luôn ≥ 1, tăng theo power → **không bao giờ khoá**.
- Điều kiện = đạt floor 20 **kể từ lần trùng sinh gần nhất** (field mới `bestFloorThisLife`, reset mỗi lần tái sinh) — chống spam vì `bestFloor` all-time vẫn giữ.
- Kết quả trên dữ liệu thật: An (power 1.56M) từ kẹt **+1 → +21 🔮**.

### 🌋 Làm mềm đường cong độ khó — hết "tường dựng đứng"

- Sát thương/máu quái đổi từ **cấp số nhân** `(1+g)^(floor−1)` sang **đa thức** `1 + c·(floor−1)^1.5`, neo vào floor 20 nên đầu/giữa game & mọi cột mốc **y hệt cũ**, còn về sâu mềm hẳn (floor 100: cũ ~12.500× → nay ~60×).
- Giờ **càng mạnh càng đi sâu được thật** (floor đạt được ∝ power^(1/1.5), không còn tường tiệm cận).

### ⭐ Hệ Ghép Sao mới (`/rpg ghep`)

- Nung đồ **cùng ô trang bị** (fodder — ăn đồ yếu nhất trong túi trước) + coin vào một món → **+1 ⭐ (tối đa 5⭐)**.
- Mỗi sao: **+7% chỉ số nền** của món **+ nâng dòng mod dở nhất lên 1 tier** (T4→…→T1) — cách **duy nhất** cải thiện mod đã rơi.
- Số fodder tăng dần theo sao (1→2→3→4→5, tổng 15 cho 5⭐) + tốn coin ⇒ **sink cho đồ thừa và coin**.
- ⭐ hiển thị ở tên đồ (Discord) và trang `/rpg` (web).

### 💰 Kinh tế & nguyên liệu

- **Hết dư mảnh (8×) & tinh chất (9.5×):** trùng sinh reset gear/level ⇒ mỗi vòng phải **ép lại mảnh + lên cấp lại tinh chất** ⇒ hai chỗ tiêu vô hạn, lặp lại.
- **Giảm lạm phát coin:** Ghép Sao thêm một coin-sink; mảnh có giá trở lại ⇒ người chơi rã đồ thay vì bán NPC ⇒ bớt mint coin.
- Telemetry mới ghi sự kiện `merge` + power/reward mỗi lần prestige; báo cáo `bun run rpg:stats` có thêm dòng ⭐ Ghép Sao.

### 🔄 Migrate (không wipe)

- `wipeRpgForSeason` → `migrateRpgForSeason`: nâng cấp profile Mùa 1 **tại chỗ**, giữ nguyên level/gear/coNgoc/prestige/perk/passive/bestFloor; chỉ thêm field mới, đóng dấu season, bỏ field cũ `bestFloorAtLastPrestige`.
- Expeditions/market/pvp (đồ đang rao, gear đang cược) **không bị xoá**. Coins/danh hiệu/điểm danh vốn đã an toàn.
- Chạy tự động trong `syncGuild` lúc khởi động (idempotent); bot đăng thông báo "Mùa 2 — giữ tiến độ".
- Đã verify `migrateProfile` trên **save production thật của cả 5 người chơi**: `preserved=true` 100%.

### 🛠️ Kỹ thuật

- Core (thuần, có test): `src/rpg.ts` (prestige power-based, `starUpItem`/`mergeFodderNeeded`/`mergeCoinCost`, `migrateProfile`, `MAX_STAR`, `star` trên `GearItem`, gearStats fold ⭐), `src/rpg-maps.ts` (`floorDifficultyMul`).
- UI/shell: `src/commands/rpg.ts` (`/rpg ghep` + `mergeCore` + panel/handlers, prestige panel, guide), `src/rpg-web.ts` (⭐ trên item card), `src/guilds.ts` (migrate + announce).
- Telemetry: `src/rpg-telemetry.ts` (`merge` event, prestige `power`), `src/rpg-telemetry-report.ts`.
- `SEASON` 1 → 2. Test: **78/78 pass** (`bun test`), typecheck sạch. Thêm test cho prestige power/spam-proof, ⭐, đường cong, migration.
