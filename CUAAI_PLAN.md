# Cửa Ải — idle-RPG / auto-expedition feature (design blueprint)

**Status (2026-07-06):** research done · design locked to recommended forks · the pure
domain core `src/rpg.ts` is **written + typechecked + balance-verified** (see §Combat).
Pending: the 3 forks below (asked, user was away — proceeding on recommended defaults),
then the fork-dependent glue (expedition engine + 3 commands + economy wiring).

Người chơi build nhân vật (chỉ số + trang bị), gửi đi **cửa ải** — nhân vật **tự đánh
từng tầng** cho tới khi **chết / hết lương thực / rút về** — nhặt trang bị, mảnh cường
hóa (nâng cấp đồ) và tinh chất (nuôi dưỡng nhân vật). Đúng thể loại **idle RPG /
auto-dungeon** (Soda Dungeon · Melvor Idle · EPIC RPG · IdleRPG).

---

## 1. Ba ngã rẽ (forks) — đề xuất + hệ quả

| Fork | Đề xuất | Nếu đổi |
|---|---|---|
| **Nhịp chơi** | **Realtime, 1 message sống** (tái dùng nguyên `streams.ts`): mỗi tick đánh vài tầng, edit 1 message, chốt thành summary khi kết thúc | *Instant*: `di` cuộn cả chuyến ngay → embed battle-log (bỏ `expeditions.ts` ticker, giữ `scheduleDeadline` cooldown). *Timer dài*: dispatch → resolve sau vài giờ. **Chỉ đổi `expeditions.ts`; `rpg.ts` y nguyên.** |
| **Kinh tế** | **Coin = vé, loot tiền tệ riêng**: coin mua lương thực/thuốc (SINK, đốt); loot/mảnh/tinh chất là tiền tệ RPG riêng, chỉ về coin qua phân rã (lossy) | *Loot bán ra coin*: thêm 1 faucet coin (rủi ro lạm phát — phải cân với `activeMultiplier`). *Tách biệt*: bỏ luôn coupling coin. |
| **Hệ mở rộng** | Lõi + **class** + **@bot** + **BXH** | *Prestige/tiến hóa* để dành phase sau (kiến trúc đã chừa `bestFloor` + power score). |

Cả 3 ngã rẽ **không đụng** tới `src/rpg.ts` (chỉ số, combat, gear, ải, loot, chi phí) —
nên phần lõi đã code trước là zero-waste dù chốt hướng nào.

---

## 2. Vòng lặp cốt lõi

```
/nhanvat tao (chọn class) → có nhân vật lv1 + vũ khí + 12 lương thực
        │
/cuaai mua  ── coin ──►  lương thực 🍖 / thuốc 🧪      (COIN SINK, đốt coin)
        │
/cuaai di <ải> <số lương thực>
        │
        ▼   nhân vật TỰ ĐÁNH từng tầng (realtime, 1 message edit mỗi tick):
   ┌───────────────────────────────────────────────┐
   │  mỗi tầng: -1 lương thực → đánh quái tầng đó   │
   │  thắng → nhặt loot, hồi máu (auto uống thuốc   │
   │          nếu máu < 35%) → tầng kế               │
   │  DỪNG khi: HP=0 (chết) / lương thực=0 /         │
   │            đạt tầng cap tự đặt / /cuaai thu      │
   └───────────────────────────────────────────────┘
        │
        ▼  loot về túi: 🗡️ trang bị · 🔩 mảnh cường hóa · ✨ tinh chất
        │
/tuido mac|cuonghoa|phanra   → mạnh hơn (đồ)
/nhanvat nangcap             → mạnh hơn (cấp, dùng ✨ + coin)
        │
        └──────► đi ải sâu hơn ──► mở khóa ải mới (đạt tầng 15 ải trước)
```

Đúng lời user: *"đi hoài cho tới khi hết nguyên liệu (lương thực) hoặc bị chết (HP)"*.
Lương thực là **nhiên liệu** (1/tầng) mua bằng coin → coin sink rõ ràng; loot là tiền tệ
tiến hóa riêng, không mint coin.

---

## 3. Mô hình dữ liệu

Hai store JSON mới per-guild, **đúng idiom `titles.json`** (`readJsonFile ?? {}` /
`liveGuildDir` gate — `guilds.ts:298-305`). Không DB.

### `characters.json` — `Record<userId, RpgProfile>` (bền, per-member)
```ts
interface RpgProfile {
  cls: "chien" | "phap" | "cung";
  level: number;
  gear: Partial<Record<GearSlot, GearItem>>;     // đang mặc (3 slot)
  bag: GearItem[];                                 // đồ thừa, cap BAG_LIMIT=60
  materials: Partial<Record<MaterialId, number>>;  // luongthuc/thuoc/manh/tinhchat
  bestFloor: Record<stageId, number>;              // tầng sâu nhất đã qua — flex + gate + power
  createdAt: number;
}
```
→ `loadCharacters`/`saveCharacters` trong `guilds.ts`. **GC bắt buộc** (MEMORY invariant
`every-persistent-state-has-gc`): thêm key vào `known` set của `syncGuild`
(`guilds.ts:447-454`) + xoá trong `removeMemberData` (`guilds.ts:485-520`).

### `expeditions.json` — `Record<userId, Expedition>` (transient, streams-style)
Chỉ tồn tại khi *fork Realtime*. Mô hình 1-1 với `StreamSession` (`guilds.ts:139-146`):
```ts
interface Expedition {
  channelId: string;        // nơi message sống ở
  stageId: string;
  startedAt: number;
  combat: Stats & { name: string; maxHp: number };  // SNAPSHOT lúc dispatch (đổi gear giữa chừng không ảnh hưởng)
  hp: number;               // máu hiện tại (bền → restart resume)
  floor: number;            // tầng hiện tại (bền)
  rations: number; potions: number;
  stopAtFloor: number | null;
  loot: { gear: GearItem[]; materials: Partial<Record<MaterialId, number>> };  // tích luỹ, bền (crash giữ loot)
  log: string[];            // vài dòng battle-log gần nhất cho message sống (ring)
  messageId?: string;       // 1 message sống
  done?: boolean;
}
```
→ `loadExpeditions`/`saveExpeditions`. Transient (đóng khi chết/về) nên **KHÔNG** vào
prune của `syncGuild` (giống `drops.json`) — nhưng vẫn xoá trong `removeMemberData` để
người rời server không còn chuyến treo. Ticker + reconcile settle mọi chuyến (§6).

### Catalog — **static trong `rpg.ts`, không lưu**
`CLASSES` · `RARITIES` · `GEAR_BASES` · `STAGES` · `MATERIALS`. Thêm content = thêm entry
(đúng nếp `SYMBOL_KEYS`/`TITLES`). Trang bị lưu **thin** (`base` id + `rarity` + `roll` +
`plus`); chỉ số tính lại qua `gearStats()` — không bao giờ lưu số đã tính.

---

## 4. Nhân vật & chỉ số

- Stat set **HP / ATK / DEF / Crit% / CritDmg** (bỏ Speed cho v1 — gộp vào ATK; ghi chú
  mở rộng sau). Cố ý **không có hit/miss** — bẫy rage số 1 của thể loại là chuỗi trượt +
  tường né; ở đây đòn nào cũng trúng, crit là RNG upside duy nhất.
- **3 class** (`CLASSES`, `rpg.ts`) — mỗi class = base stat + growth/cấp + 1 **passive**
  (identity, chống "one-dimensional = chán"):
  - 🛡️ **Chiến Binh** — nhiều HP/DEF, passive +15% DEF (đi sâu, lì đòn)
  - 🔮 **Pháp Sư** — cao ATK/CritDmg, passive +25% sát thương chí mạng (bùng nổ)
  - 🏹 **Cung Thủ** — Crit cao, passive +12% tỉ lệ chí mạng (ổn định)
- **Lên cấp** (`/nhanvat nangcap`): tiêu **✨ tinh chất + coin** (không có XP thụ động —
  1 sink rõ ràng, khớp gacha hero-essence). Cost leo thang: `levelUpCost(lv) = {tinhchat:
  2+lv, coins: 25·lv}`. Cap `MAX_LEVEL=50`.
- `effectiveStats(profile)` = base(class,level) + Σ gear + passive. `powerScore(stats)` =
  1 số cho BXH + gate ải (eDPS × √eHP).

---

## 5. Trang bị

- **3 slot**: ⚔️ Vũ khí · 🛡️ Giáp · 💍 Trang sức. **5 độ hiếm** (Thường→Huyền Thoại,
  band nhân stat). Mỗi drop = base × band × **roll `0.85–1.15`** (đóng băng lúc rơi) —
  1 roll variance tạo hook "món này ngon hơn không?".
- **Cường hóa** (`/tuido cuonghoa`): +N → +N+1, mỗi cấp +8% stat của món, cap `+12`. Cost
  `enhanceCost(plus) = {manh: 3+2·plus, coins: 20·(plus+1)}`.
- **Phân rã** (`/tuido phanra`): đồ thừa → 🔩 mảnh (`salvageYield`, theo rarity+plus). Lossy
  nhưng **không món nào là rác** (chống anti-pattern "drop vô dụng").
- Mọi message drop hiện **▲/▼ so với đồ đang mặc** (yêu cầu readability số 1 của thể loại
  trên Discord).

---

## 6. Cửa ải + engine đi ải (fork Realtime)

**5 ải** (`STAGES`), gate nhau: phải đạt **tầng 15** ải trước mới mở ải sau. Endless (không
cap tầng — khó dần tới khi chết); tầng sâu nhất là điểm số. **Boss mỗi 10 tầng** (spike
1.6×, drop gear ≥ Hiếm đảm bảo — pacing beat).

`enemyAt(stage, floor)` = base × `(1+growth)^(floor-1)`, boss ×1.6. Loot/tầng
(`rollFloorLoot`): mảnh (đều), tinh chất (thưa hơn), thuốc (hiếm), gear (~10-22% + boss
đảm bảo); tất cả scale theo `floor × stage.lootMult`.

**Engine `src/expeditions.ts` = bản sao `streams.ts`** (pattern gần nhất đã có):
- `startExpeditionScheduler` = `startTicker("expeditions", TICK_MS, forEachGuild(...))` —
  mỗi tick, với mỗi chuyến active: resolve các tầng "đến hạn" (`floor((now-startedAt)/
  FLOOR_MS)` capped bởi lương thực), **synchronous load→mutate→save** (không double-run),
  rồi edit 1 message sống (`deliver` — edit nếu có `messageId`, else send).
- Điều kiện dừng: HP=0 · lương thực=0 · đạt `stopAtFloor` · `/cuaai thu`. Chốt →
  `renderFinal` edit message sống thành summary (loot + tầng + ▲ kỷ lục), cộng loot vào
  `characters.json` (synchronous), xoá session.
- **Restart-safe 3 lớp** như games: `deadline`/`startedAt` bền → resolve lười khi
  `/cuaai xem`/`thu` → ticker startup catch-up settle chuyến lỡ (giống
  `reconcileGuildStreams`). Coin/loot mutation luôn synchronous trước await.

### Combat — đã verify (sim 200 lượt/build)
`src/rpg.ts` compiled sạch; sim cân bằng:

| Build | Kết quả |
|---|---|
| Starter lv1 (12 lương thực, Rừng Ma) | avg **tầng ~8**, chết ở boss tầng 10 → "suýt thắng, đi cày thêm" |
| Mid-game lv20 Hiếm+5 (Hang Băng) | avg **tầng ~17** → qua gate 15, mở ải kế |

DEF = giảm % có cap (`DR=def/(def+90)`, ≤80%) — không bao giờ chia 0, không tank bất tử.
Damage floor ở 1 → trận luôn kết thúc. Balance là **1 surface để tune** (`rpg.ts` block
đầu file) — cần playtest thật để chốt.

---

## 7. Kinh tế (fork Coin-sink)

- **Coin chỉ bị ĐỐT** (sink), không mint: `/cuaai mua` lương thực/thuốc, `nangcap`,
  `cuonghoa` đều trừ coin → xoá khỏi ledger. Đúng triết lý sink của bot (xoso/danhhieu).
- **Loot KHÔNG ra coin** (trừ phân rã → mảnh, không phải coin) → RPG **không mint coin**,
  không đụng `activeMultiplier`, không lạm phát kinh tế coin chung.
- Kinh tế RPG (mảnh/tinh chất/gear) tự chứa, muốn "lạm phát" bao nhiêu cũng được vì tách
  khỏi coin. Faucet coin (checkin/streams) + sink coin (RPG + xoso + danhhieu) cân nhau.

---

## 8. Command surface + agent

3 lệnh mới (1 lệnh = 1 file, wire ở `commands/index.ts:29`):

| Lệnh | Subcommand |
|---|---|
| `/nhanvat` | `tao` (chọn class) · `xem` (chỉ số + gear + power) · `nangcap` (lên cấp bằng ✨) · `bxh` (BXH sức mạnh server) |
| `/tuido` | `xem` (túi đồ) · `mac` · `thao` · `cuonghoa` · `phanra` |
| `/cuaai` | `danhsach` (list ải + gate + drop) · `mua` (lương thực/thuốc bằng coin) · `di` (gửi đi ải) · `xem` (trạng thái chuyến) · `thu` (rút sớm) |

- UI: embed + button/select/modal, customId `"<cmd>:..."` (router `index.ts:152`). `/cuaai
  di` = select ải → modal số lương thực (+ tuỳ chọn `stopAtFloor`). `/tuido` select-menu
  chọn món.
- **Agent (`bot_*`)**: thêm vào `buildBotMcpServer` (`agent-tools.ts`) 2 tool sender-bound
  từ rule-core export của `cuaai.ts`: `bot_rpg_status`, `bot_rpg_expedition_start` (đã có
  `channelId` truyền vào để post message sống). Đúng pattern đang mở rộng (title/lottery/
  worldcup tools) — thêm tool là xong, prompt policy-only tự nhận.
- `/help` + system prompt tự cập nhật qua `commandCatalog()` — 0 công.

---

## 9. File map

**Mới:**
- `src/rpg.ts` — ✅ **đã viết**: pure core (types, catalog, stat/combat/loot/cost math).
- `src/expeditions.ts` — engine đi ải (bản sao `streams.ts`) *[fork Realtime]*.
- `src/commands/nhanvat.ts` · `src/commands/tuido.ts` · `src/commands/cuaai.ts`.

**Sửa:**
- `src/guilds.ts` — +`loadCharacters`/`saveCharacters` (+expeditions); +lifecycle 2 chỗ
  (`syncGuild` known set `:447`, `removeMemberData` `:485`).
- `src/commands/index.ts` — +3 import, +vào mảng `commands` (`:29`).
- `src/agent-tools.ts` — +2 bot tool.
- `src/index.ts` — +`startExpeditionScheduler` + reconcile lúc ready (cạnh streams `:56/60`).
- `template/` — +`characters.json`/`expeditions.json` rỗng (đồng bộ với streams.json).
- `CLAUDE.md` — +section feature (spec sống của repo).

**Không gate env** — feature core, luôn bật (khác worldcup/poe cần token ngoài).

---

## 10. Trình tự build (mỗi bước typecheck xanh)

1. ✅ `src/rpg.ts` pure core + sim cân bằng (đã xong, verified).
2. `guilds.ts` stores + lifecycle wiring.
3. `expeditions.ts` engine (ticker/message sống/reconcile) *[sau khi chốt fork nhịp]*.
4. 3 command file + wire registry + `bun run register`.
5. `index.ts` scheduler + reconcile.
6. `agent-tools.ts` 2 tool.
7. `CLAUDE.md` + template + MEMORY.
8. `bun run typecheck` + smoke thật trên server test.

---

## 11. Anti-pattern đã xử (từ research cộng đồng)

- **Chuỗi trượt / tường né** → bỏ hit/miss hoàn toàn; crit là RNG duy nhất (upside).
- **Không có quyết định = chán** → class + passive + chọn ải/lương thực/`stopAtFloor`.
- **Drop vô dụng** → phân rã mọi đồ → mảnh chung.
- **Chết = phạt dead-time** → chết vẫn GIỮ loot đã farm; về là đi tiếp ngay.
- **Lạm phát faucet** → RPG chỉ đốt coin, loot là tiền tệ riêng.
- **Spam kênh** → 1 message sống edit tại chỗ (Go Live pattern), không post mỗi tầng.
- **Set điểm dừng** (xin nhiều nhất) → `stopAtFloor`.

---

## 12. Câu hỏi mở

3 fork ở §1 (đã hỏi, user away → chạy theo default đề xuất). Chốt khác đi thì báo — chỉ
`expeditions.ts` + wiring economy đổi, `rpg.ts` giữ nguyên.

---

## 13. Endgame — chống chán khi endless (CHỐT 2026-07-06)

Vấn đề thật KHÔNG phải "quá mạnh": quái tăng hàm mũ nên tuyến đầu luôn chết, không ai
thắng hết. Cái gây chán là **push +1 tầng mãi cùng một thao tác, không có quyết định
mới**. User chốt **3 cơ chế** (bỏ server-boss co-op + mùa giải — không chọn). Cả ba là
lớp bọc quanh combat core — **`src/rpg.ts` giữ nguyên**.

### 13.1 Tái Sinh (Prestige) — động cơ cá nhân
Đạt mốc (clear tầng 30 bất kỳ ải / lv50) → reset level+gear+materials-tiến-hóa → nhận
**Cổ Ngọc** (meta-currency BỀN, lưu ngoài vòng reset). Cổ Ngọc mua multiplier vĩnh viễn
(+%ATK, +%HP, +%loot — perk +ô lương thực đã gỡ, xem §16). Reset giữ `coNgoc` + `prestigeLevel` +
`bestFloor`; wipe phần còn lại. Đầu ải sau reset lướt nhanh (đã phê), frontier sâu hơn.
→ RpgProfile thêm `coNgoc: number` + `prestigeLevel: number`; pure `prestigeReward(bestFloor)`
+ `applyPrestige(p)`; multiplier áp trong `effectiveStats`. *Phần thưởng phải sờ thấy được
— reset vô nghĩa là bẫy chán số 1.*

### 13.2 Modifier ải xoay tua (kiểu Genshin Spiral Abyss)
Một "luật tuần" áp lên sim, đổi định kỳ (biweekly) → ép đổi build, cùng nội dung chơi khác
đi. Catalog `MODIFIERS` trong `rpg.ts`: `{ id, name, blurb, mutateEnemy?, mutateLoot? }`.
Vd *Huyết Nguyệt* (+40% HP quái, ×2 mảnh) · *Vô Chí* (quái miễn chí mạng) · *Cuồng Nộ*
(mọi ATK +25%, DEF −30%). Luật hiện tại = **pure hàm của tuần-epoch (không lưu state,
giống `isVietnamWeekend`)**. Áp qua 1 param `modifier` vào `enemyAt`/`rollFloorLoot`.
`/cuaai danhsach` hiện luật tuần; BXH tầng-sâu tính theo luật hiện tại.

### 13.3 Full-loot PvP — "Ải Tử Chiến" (extraction + invasion, power-bracketed)
User chốt full-loot (đã cảnh báo toxic một lần, override có đủ thông tin). Bản **bền vững**
= mô hình extraction (Tarkov / Diablo-hardcore): mở + tàn khốc BÊN TRONG vùng, an toàn ngoài.
- **Vùng riêng**: một ải PvP-on. Vào = đồng ý bị xâm lăng + rớt loot. Ải thường + "town"
  (quản nhân vật) LUÔN an toàn — không có bản đồ chung nên không bị gank lúc vá đồ.
- **Loot chưa rút**: loot farm trong Ải Tử Chiến "chưa ký gửi" tới khi `/cuaai thu`. Chết /
  thua invader TRƯỚC khi rút → **rớt toàn bộ haul chuyến đó** cho kẻ thắng. Build đang mặc
  AN TOÀN (trừ khi tự ante) → full-loot trên HAUL, không xóa sổ tài khoản → chơi lâu dài.
- **Xâm lăng async**: người PvP-on invade **snapshot** nhân vật (không cần online); giải
  bằng sim hero-vs-hero (tái dùng `fightFloor` core).
- **GATE bracket theo power (load-bearing)**: chỉ match trong ±band power. KHÔNG bracket =
  cá mập farm newbie = server chết. **Bake mặc định BẬT.**
- Store: PvP snapshot + Ải Tử Chiến session; thắng chuyển haul (synchronous, ghost-guarded).

**CẦN CONFIRM (2 chi tiết full-loot):** (a) rớt = *haul chưa rút của chuyến* (đề xuất) hay
cả đồ đang mặc · (b) bracket *bật* (đề xuất) hay tắt. → artifact đẹp cập nhật sau khi chốt.

**Không làm (user không chọn):** server-boss co-op, mùa giải/ladder reset. Kiến trúc vẫn
chừa chỗ (`bestFloor` + power score) nếu sau này muốn thêm.

---

## 14. UI/UX + may rủi + chợ + đổi tên /rpg (CHỐT 2026-07-06)

User feedback: chưa thiết kế UI/UX (embed khó nhìn trạng thái), chưa có gambling (đập đồ
bị rớt) + bán đồ, tên `/cuaai` "nghe ngu". Chốt:

### 14.1 Đổi tên → `/rpg` (22 lệnh PHẲNG, tên tự đủ nghĩa)
Bỏ `/cuaai` `/nhanvat` `/tuido` `/tuchien` rời rạc → gom về **một lệnh `/rpg`** với **22 subcommand
PHẲNG, KHÔNG subcommand-group** (nhóm ép thứ tự ngược "ai di" + nesting khó chịu; verb trần như
`tao` thì vô nghĩa "tạo cái gì?"). Mỗi tên là cụm đầy đủ có gạch nối, thứ tự động-từ-tân-ngữ tự
nhiên, ASCII lowercase (Discord chấp nhận chắc), 22 ≤ 25 (cap flat):
- Nhân vật: `tao-nhan-vat` · `nhan-vat` · `len-cap` · `tai-sinh` · `xep-hang`
- Đồ: `tui-do` · `trang-bi` · `thao-do` · `cuong-hoa` · `phan-ra`
- Cửa ải: `cua-ai` · `tiep-te` · `di-ai` · `chuyen-di` · `rut-ve`
- Chợ: `cho-do` · `rao-ban` · `mua-o-cho`
- Tử Chiến: `tu-chien` · `xam-lang` · `xep-hang-pvp`
- Khác: `huong-dan`
→ vẫn "một concern = một file", đăng ký 1 Command `/rpg` (như masoi/blackjack). `execute()`
dispatch thuần trên `getSubcommand()`. customId nội bộ giữ token area cũ (rpg:char/do/cho/pvp) — không đụng.

### 14.2 Cường hóa may rủi ("đập đồ bị rớt")
Ba vùng, pure `enhanceAttempt(plus, hasCharm, rng) → {result: "up"|"down"|"break"|"stay",
newPlus}` + bảng tỉ lệ trong rpg.ts (cùng họ `salvageYield`, KHÔNG đụng combat core):
- **+0→+3: 100%** (an toàn tuyệt đối — power sớm được đảm bảo).
- **+4→+7: 90/82/74/66%**, fail → **tụt 1 cấp** (đồ sống).
- **+8→+12: 55/46/37/28/20%**, fail → **VỠ, mất đồ** (đúng "rớt" user muốn).
- **🛡️ Bùa Hộ Mệnh** (material mới `bua`, mua bằng coin/rơi hiếm): dùng ở vùng vỡ → fail chỉ
  **đứng yên thay vì vỡ**. Quyết định: liều tay không hay trả phí bảo hiểm.
- Chi phí mỗi lần = `enhanceCost(plus)` (🔩 + coin), **đốt dù thắng/thua**. +12 = hàng cực hiếm.

### 14.3 Chợ đồ (bán trang bị — circulation-safe)
"Bán đồ" đi hướng **chợ người-với-người** (KHÔNG bán NPC vì đó là mint coin, phạm nguyên
tắc no-minting): `/rpg rao-ban` rao 1 món giá coin → `/rpg cho-do` duyệt → `/rpg mua-o-cho`
mua; coin chuyển **người→người** (circulation), **thu 5% thuế đốt** = sink nhỏ. Store mới
`market.json` per-guild `{ listings: { id: {sellerId, item, price, listedAt} } }` —
GC: xóa listing của người rời server trong `removeMemberData`; item trả về (hoặc mất theo
người bán — chọn: mất, đơn giản). **CHỜ USER GẬT:** có thêm "bán nhanh cho tiệm" (faucet
coin nhỏ có kiểm soát) không — mặc định KHÔNG, chỉ chợ.

### 14.4 UI/UX — embed
Mock đầy đủ ở artifact design doc (§II Giao diện). Nguyên tắc: số quan trọng nhất lên trên
(sức mạnh, HP bar), khối chỉ số/trang bị/kho tách bạch, mỗi dòng gear mang **màu độ hiếm**
+ **▲/▼** so đồ đang mặc, nút bấm cho hành động thường dùng. Màu viền embed đổi theo ngữ
cảnh (class/ải/đỏ-khi-chết/cam-khi-đập). Character sheet (`/rpg nhan-vat`) là màn được
thiết kế kỹ nhất vì đó là "khó nhìn trạng thái" user than.

### 14.5 Ải + leveling (làm sâu)
- **Ải**: mỗi ải có bản sắc (quái trâu / glass-cannon / cân bằng) + **nghiêng farm** 1
  nguyên liệu (Rừng Ma→🔩, Hang Băng→✨, Sa Mạc→🔩🗡️, Tháp Cổ→gear Sử Thi, Vực Thẳm→Huyền
  Thoại) → chạy ải khác nhau cho mục đích khác nhau. Implement = per-stage loot weights
  thêm vào `rollFloorLoot`. Combat đơn giản (không debuff/tầng) nên "thiết kế ải" = profile
  quái + loot bias + boss — thành thật với engine.
- **Leveling**: mỗi cấp += class growth (nền ổn định; gear/đập = phần nhảy vọt). Tổng
  1→50 ≈ 1,323 ✨ + 30,625 🪙 (đường cong ở doc). Lv50 = trần → cổng Tái Sinh.

**Thứ tự build cập nhật:** (2) bổ sung lõi `enhanceAttempt` + loot-bias + prestige/modifier
pure → (3) stores gồm `market.json` → (4) engine → (5) lệnh `/rpg` + embed → (6) endgame →
(7) chợ + agent + docs.

---

## 15. Onboarding · guide · help (CHỐT 2026-07-06)

Bám DNA onboarding hiện có (`onboarding.ts`: "auto by default, AI làm hộ, zero-config") +
ràng buộc [[onboarding-events-plan]]. Feature nhiều hệ → chống "onboarding overload"
(research) bằng lộ dần. Bốn lớp:

- **First-touch zero-config**: `/rpg tao-nhan-vat` là chơi, không "setup". Bất kỳ `/rpg *` khi
  `profile == null` → route sang màn tạo (3 nút class) thay vì văng lỗi.
- **Nhiệm vụ tân thủ (progressive disclosure)**: checklist ≤5 bước, lộ 1 cơ chế/lần, mỗi bước
  thưởng nhỏ 1 lần: tạo → đi ải → mặc đồ → đập đồ → lên cấp. Gợi ý nâng cao (chợ / tái sinh /
  tử chiến) chỉ mở **khi tới lúc** (đủ đồ thừa / gần lv50 / đủ power vào bracket). Store: field
  `tutorial` (bitmask bước đã xong) trên `RpgProfile` — GC theo character. Sau mỗi hành động,
  result embed kèm **1 gợi ý** bước chưa học; tắt khi đã nắm cơ bản (không nhây veteran).
- **AI là guide sống** (đúng "AI làm hộ"): agent trả lời "chơi rpg sao / đập đồ là gì / ải nào
  farm ✨" + đọc trạng thái thật qua `bot_rpg_status` → khuyên cá nhân. Cần: thêm mục **primer
  RPG** (policy/khái niệm) vào `buildContextAppend` (`agent.ts`) để agent giải thích chính xác;
  KHÔNG hardcode Q&A.
- **`/rpg huongdan`**: guide phân trang ephemeral (select 8 mục: tổng quan / class / trang bị /
  đập đồ / ải / chợ / tử chiến / tái sinh), mở được từ nút 📖 bảng nhân vật. `/help` toàn cục
  tự liệt kê `/rpg` (`commandCatalog` động — không hardcode danh sách).

Fallback không-hành-động: lờ nhiệm vụ/gợi ý vẫn chơi đủ. Build: gộp vào bước (5) lệnh `/rpg`
(thêm `huongdan` + màn onboarding + nhiệm vụ tân thủ) và (7) agent (primer RPG trong context
append).

## 16. Đi ải = NẠP SẠCH KHO (2026-07-07)

User: *"khi đi ải, không cần đem theo đồ, vì sẽ luôn sử dụng mọi thứ có trong kho."* Bỏ hoàn
toàn bước chọn loadout — `/rpg di-ai` chỉ cần chọn ải (+ `dungtang` tuỳ chọn). `startExpedition`
tự ôm **toàn bộ** 🍖 lương thực + 🧪 thuốc trong kho (không tham số `rations`/`potions`), đồ thừa
vẫn hoàn lại kho khi chết/rút/dừng nên "đem hết" không phí. **User chốt: bỏ luôn cap 30 🍖/chuyến**
— một chuyến nạp sạch, không giới hạn số tầng (kho 100 🍖 ⇒ ~100 tầng/chuyến). Hệ quả clean-slate:
- `RATION_BASE_CAP` + `maxRations()` xoá khỏi `expeditions.ts`.
- Perk **🍖 Cổ Ngọc Trường Chinh** (chỉ dùng để nâng cap) gỡ khỏi `PERKS` + `PerkId` +
  `rationBonus()` trong `rpg.ts` → shop tái sinh còn 3 perk (atk/hp/loot, tự co theo `Object.keys(PERKS)`).
- Cả 4 caller (`di-ai` slash, `bot_rpg_expedition_start`, `mcp-test.ts` ×2) đổi sang chữ ký 5 tham số.
- Cần `bun run register` (option `luongthuc` biến mất) + redeploy. Typecheck sạch, `test:mcp` 53/53.
