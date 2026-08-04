# Plan: Onboarding wizard + Event system

> **Trạng thái:** đã chốt thiết kế, chưa code. Đây là **Phase 1** (hạ tầng) của một đợt nâng cấp kinh tế lớn hơn — xem [Roadmap kinh tế](#roadmap-kinh-tế-phase-sau) ở cuối.
> **Ngôn ngữ:** prose tiếng Việt, identifier/code tiếng Anh (đúng convention repo).
> `file:line` là mốc tham chiếu tại thời điểm viết plan — code có thể dịch, dùng làm neo chứ đừng tin tuyệt đối.

---

## 1. Vì sao làm cái này (bối cảnh)

Xuất phát từ một đợt review toàn bộ nền kinh tế coin. Kết luận:

- **Solidity kỹ thuật: xuất sắc** — ledger atomic, ghost-guard, restart-safe 3 lớp, banker solvency gate, coin-conservation chứng minh được (`bankerSettle`, `games.ts:204`).
- **Thiết kế kinh tế: còn non** — **lạm phát cấu trúc**: faucet đúc tiền (điểm danh `[100,250,500,800,1200,2000,5000]` = **9.850/tuần**, `diemdanh.ts:11`; Go Live 120/giờ, `streams.ts:31`) lớn hơn nhiều so với sink. Sink thật thì **bão hòa**: cả bộ danh hiệu = 11.450 🪙 mua **một lần** (`danhhieu.ts`), xổ số chỉ đốt 30% (`xoso.ts:18`), mọi game khác zero-sum. → coin phình ra vô nghĩa theo thời gian.
- **BXH đóng băng** — không mùa giải/reset/decay → người vào sớm thống trị vĩnh viễn, người mới nản.
- **Coin thiếu "điểm đến cuối"** — giàu cũng chẳng làm được gì; AI lane thì miễn phí (không phải sink).

**Ràng buộc chủ đạo do user đặt:** admin **không phải setup gì cả**. Nếu có cấu hình thì phải **zero-config mặc định**, và AI phải **làm hộ admin** được (nói chuyện, chọn giúp). Đây là DNA sẵn có của bot (workspace tự provision `guilds.ts:21`, xổ số tự mở vòng `xoso.ts:215`) — bảo tồn, không phá.

Phase 1 này xây **hạ tầng** (settings dùng chung, hệ số sự kiện, onboarding, admin AI tools) để các tính năng kinh tế lớn (mùa giải, sink recurring, level) cắm vào sau.

---

## 2. Nguyên tắc: mô hình 2 tầng "auto mặc định — AI chỉnh khi cần"

- **Tầng 1 — chạy tự động, admin không đụng gì.** Feature ship ON với default hợp lý + kênh thông báo tự dò. Bề mặt chính.
- **Tầng 2 — AI làm hộ admin.** Muốn tùy biến thì admin @bot nói tiếng Việt → AI gọi tool → xong. Không slash command, không sửa file config.
- **Mọi lựa chọn có fallback không-hành-động.** Lờ hết đi thì bot vẫn chạy đủ. Wizard/tool chỉ là đường tắt cho ai muốn tùy biến.

---

## 3. Quyết định đã chốt

1. **Wizard onboarding = ephemeral** (nút/select), không dùng thread — gọn, không rác kênh.
2. **"Tạo kênh riêng" = một nút tùy chọn** admin tự bấm (opt-in). **Không bao giờ auto-tạo kênh.** Thiếu quyền Manage Channels → degrade êm (báo dùng kênh sẵn có).
3. **DM chỉ là courtesy best-effort** cho owner. Không phải đường chính (Discord hay chặn DM bot→user). **Không** build lane AI-trong-DM ở phase này (cần bật DM intent + lane `dm_<userId>` đang chỉ reserved — lớn & kém tin cậy).
4. **Sự kiện auto (Tier-1) MVP = chỉ "cuối tuần x2"** (thuần derive từ clock, zero state). "Happy hour" để làm **preset Tier-2** do AI/admin mở (`bot_event_start`), tránh phải lưu state khung giờ.

---

## 4. Scope

**Trong phạm vi:**
- Guild settings dùng chung (`settings.json`).
- Auto-detect kênh thông báo (bỏ gánh nặng `/xoso kenh` bắt buộc).
- Sự kiện x2 tự động (cuối tuần) + sự kiện tùy biến do AI/admin mở.
- Tin chào onboarding + wizard ephemeral + nút tạo kênh tùy chọn.
- Admin MCP tools (gate ManageGuild bằng cơ chế).

**Ngoài phạm vi (phase sau):** mùa giải/reset BXH, sink recurring (danh hiệu tùy biến, tier prestige), level/XP, nhiệm vụ hằng ngày, treasury (đốt→gom→mega lì xì), coin làm sink cho AI lane.

---

## 5. Nguyên tắc correctness (BẮT BUỘC — sai là hỏng)

1. **Hệ số sự kiện chỉ nhân FAUCET (điểm danh + Go Live). Tuyệt đối không đụng game nhà cái.**
   Game banker zero-sum + solvency-gated (`bankerSettle` giữ `Σpaid + hostDelta == totalStake`, `games.ts:204`). Nhân đôi payout → vỡ bảo toàn coin + phá solvency gate. → multiplier chỉ chạm `performCheckin` (`diemdanh.ts`) và `settleSession` (`streams.ts`). Không đụng xổ số (jackpot là tái phân phối, nhân lên = đúc tiền).
2. **Onboarding chỉ chạy trên `guildCreate` thật (lúc cài), KHÔNG trên startup sync.**
   Cả hai hiện đều gọi `syncGuild` (`guilds.ts:301`). Phải tách: tin chào chỉ post từ event `guildCreate`. Chốt bằng cờ `onboardedAt` để restart không spam lại.
3. **Mọi state mới có deadline phải có GC** (invariant sẵn có của bot): `activeEvent.until` được ticker quét dọn + `activeMultiplier` tự bỏ qua khi hết hạn → restart-safe. `settings.json` per-guild, xoá theo folder khi GuildDelete (không có per-member data nên không cần vào prune của `syncGuild`).
4. **Gate quyền bằng cơ chế, không bằng "AI nghe lời".**
   Mọi tool/nút đổi config tự đọc quyền *sống* của người gọi, refuse nếu thiếu ManageGuild. Tiền lệ: `coindrop.ts:133` (check runtime + `setDefaultMemberPermissions`), guard cứng `transferForSender` (`agent-tools.ts:47`). Model obedience KHÔNG phải ranh giới an ninh.

---

## 6. Thiết kế chi tiết

### 6.1. Guild settings dùng chung (`settings.json`)

Thêm vào `src/guilds.ts` (cùng convention atomic-write + quarantine như các ledger khác):

```ts
interface GuildSettings {
  announceChannelId: string | null;    // null → resolveAnnounceChannel tự dò
  weekendDouble: boolean;              // Tier-1 auto, default true
  activeEvent: {                       // Tier-2 tùy biến, null nếu không có
    kind: "checkin" | "stream" | "all";
    multiplier: number;                // 2, 3...
    until: number;                     // epoch ms — GC bằng cái này
    startedBy: string;
  } | null;
  onboardedAt: number | null;          // chống post tin chào 2 lần
  lastWeekendAnnounced: string | null; // "2026-W27" — announce cuối tuần đúng 1 lần/tuần
}
```

Hàm mới:
- `loadSettings(guildId)` / `saveSettings(guildId, settings)` — default rỗng như trên.
- `resolveAnnounceChannel(guild)`: `announceChannelId` (nếu set & bot gửi được) → `guild.systemChannel` (nếu gửi được) → kênh text đầu tiên bot gửi được → `null`.
- `activeMultiplier(guildId, kind)`: `max(weekendMultiplier, eventMultiplier)`.
  - `weekendMultiplier` = 2 nếu `weekendDouble` & hôm nay là T7/CN giờ `Asia/Ho_Chi_Minh`, else 1. (Thuần derive, zero state.)
  - `eventMultiplier` = `activeEvent.multiplier` nếu `activeEvent && Date.now() < until && (kind khớp hoặc activeEvent.kind === "all")`, else 1.
  - Không có gì → trả **1**.

### 6.2. Sự kiện tự động Tier-1 — `src/events.ts` (mới)

- **Cuối tuần x2** thuần derive từ clock → không lưu state, đúng kể cả sau restart.
- `startEventScheduler(client)` qua `startTicker` (`scheduler.ts`): mỗi tick + `forEachGuild`:
  - Nếu đang cuối tuần & `lastWeekendAnnounced != tuần-ISO hiện tại` → announce "🎉 Cuối tuần x2 coin điểm danh & Go Live!" vào `resolveAnnounceChannel`, set `lastWeekendAnnounced`.
  - Dọn `activeEvent` đã quá `until` (GC) — optional announce "sự kiện kết thúc".
- Rule core tách pure/testable: `startEvent(settings, {kind, multiplier, until, by})` và `stopEvent(settings)` trả settings mới (giống các game reducer).

### 6.3. Sự kiện tùy biến Tier-2 — admin AI tools (`src/agent-tools.ts`)

`buildBotMcpServer` đổi signature nhận thêm `member: GuildMember` (chat.ts đã có sẵn member — đang truyền cho bước nickname PoE; thread qua `buildAgentMcpServers`).

```ts
function requireAdmin(member: GuildMember) {
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild))
    throw new Error("Chỉ admin (Manage Server) mới làm được — từ chối, đừng thử lại.");
}
```

Tools mới (mỗi tool gọi `requireAdmin` đầu tiên):
- `bot_event_start({ kind: "checkin"|"stream"|"all", multiplier: int≥2, hours: number })` → set `activeEvent.until = now + hours*3600e3`, announce.
- `bot_event_stop()` → `activeEvent = null`.
- `bot_set_announce_channel()` → `announceChannelId = kênh hiện tại của tin nhắn`.

Prompt (`agent.ts`): thêm mục **policy-only** "Admin Actions" — chỉ mô tả chính sách (chỉ admin; xác nhận trước khi mở sự kiện tốn kém), **KHÔNG liệt kê tên tool** (đúng convention hiện tại — SDK tự quảng cáo tool qua description).

UX: admin `@Orb mở happy hour x2 điểm danh 2 tiếng` → AI gọi `bot_event_start(kind:"checkin", multiplier:2, hours:2)` → bot tự announce. Non-admin nhờ tương tự → tool ném lỗi refuse.

### 6.4. Onboarding — `src/onboarding.ts` (mới)

`handleGuildCreate(guild)` (gọi từ event `guildCreate` trong `index.ts`, sau `syncGuild`):
1. `syncGuild` chạy như cũ (provision + coin).
2. Nếu `settings.onboardedAt == null`: post **một** tin chào vào `resolveAnnounceChannel`, set `onboardedAt`. Best-effort DM `guild.ownerId` (fail thì bỏ qua).
3. Tin chào nhấn mạnh "**không cần cài gì, bot chạy luôn**" + 4 nút (`customId` prefix `onboard:`; nút đổi config gate ManageGuild khi bấm):
   - `⚡ Cấu hình nhanh với AI` (`onboard:wizard`) → wizard **ephemeral**: select chọn kênh thông báo · toggle cuối tuần x2 · nút "mở thử happy hour".
   - `📣 Đặt kênh thông báo ở đây` (`onboard:setchannel`) → set announce = kênh này (một chạm).
   - `🏠 Tạo kênh riêng cho Orb` (`onboard:createchannel`) → tạo `#orb-of-ai` (cần Manage Channels; thiếu quyền → ephemeral báo dùng kênh sẵn có), set làm announce.
   - `📖 Hướng dẫn` (`onboard:help`) → embed `/help`.
4. **Fallback không-hành-động:** lờ hết → auto-detect kênh vẫn chạy, cuối tuần x2 vẫn bật, coin vẫn hoạt động.

Route trong `index.ts`: customId bắt đầu `onboard:` → `handleOnboardButton` / `handleOnboardSelect`.

---

## 7. File thay đổi

| File | Việc |
|---|---|
| `src/guilds.ts` | **+** `GuildSettings`, `loadSettings`/`saveSettings`, `resolveAnnounceChannel(guild)`, `activeMultiplier(guildId, kind)` |
| `src/events.ts` *(mới)* | Engine sự kiện: `activeMultiplier` logic, `startEventScheduler`, `startEvent`/`stopEvent` (pure core) |
| `src/onboarding.ts` *(mới)* | `handleGuildCreate`, `handleOnboardButton`, `handleOnboardSelect` |
| `src/commands/diemdanh.ts` | `performCheckin`: `reward *= activeMultiplier(guildId, "checkin")`; trả thêm `multiplier` để embed khoe "x2 sự kiện!" |
| `src/streams.ts` | `settleSession`: `reward *= activeMultiplier(guildId, "stream")` |
| `src/agent-tools.ts` | `buildBotMcpServer` nhận `member`; **+** `bot_event_start`/`bot_event_stop`/`bot_set_announce_channel` (admin-gated) |
| `src/chat.ts` + `buildAgentMcpServers` (agent.ts) | Thread `GuildMember` người gửi xuống `buildBotMcpServer` |
| `src/commands/xoso.ts` + worldcup | `/xoso kenh` & `/worldcup kenh` ghi vào `settings.announceChannelId` dùng chung; announce đọc qua `resolveAnnounceChannel` (kenh = đường ghi đè thủ công) |
| `src/index.ts` | Hook `guildCreate` → `handleGuildCreate`; route `onboard:*`; khởi động `startEventScheduler` |
| `template/settings.json` *(mới)* | Default rỗng |
| `src/agent.ts` (system prompt) | Mục policy-only "Admin Actions" (không tên tool) |

---

## 8. Thứ tự build (mỗi bước typecheck + chạy được độc lập)

1. **Settings nền** — `GuildSettings`, load/save, `resolveAnnounceChannel`, `template/settings.json`, migrate `/xoso kenh` + `/worldcup kenh` sang settings dùng chung. *(Không đổi hành vi user, chỉ dọn nền.)*
2. **Multiplier + auto cuối tuần** — `activeMultiplier`, cắm vào checkin/stream, `startEventScheduler` + announce. *(Sự kiện auto đã sống.)*
3. **Admin MCP tools** — thread member, 3 tool admin-gated + mục prompt policy-only. *(AI mở sự kiện được.)*
4. **Onboarding** — `onboarding.ts`, hook `guildCreate`, route `onboard:*`, wizard ephemeral + tạo kênh. *(Trải nghiệm cài đặt xong.)*

Sau mỗi bước: `bun run typecheck`; bước đụng lệnh thì `bun run register`. Nhớ `fly machine stop` trước khi `bun run dev` (bot đang chạy trên Fly — chạy 2 instance là trả lời 2 lần).

---

## 9. Roadmap kinh tế (phase sau)

Phase 1 (plan này) là nền. Các đợt sau, ưu tiên theo ROI:

- **Mùa giải + reset BXH (đòn bẩy engagement lớn nhất).** Cron tự chốt hàng tháng → trao danh hiệu vô địch vĩnh viễn ("Vô địch Mùa 3") → soft-reset số dư (giữ %, hoặc quy đổi prestige). Chữa cùng lúc: staleness BXH + kiểm soát cung tiền (reset = đốt). Khớp hạ tầng `TITLES`/`titles.json` sẵn có. Chạy tự động, admin không làm gì.
- **Sink recurring & scale-theo-giàu.** Danh hiệu tùy biến (user tự đặt chữ, ~25k) = sink vô hạn cá nhân hóa; tier prestige siêu đắt (50k–100k) cho whale; vật phẩm tiêu hao (buff, màu tên tạm). Đây là thứ đối trọng faucet recurring.
- **Coin làm sink cho AI lane.** Quota free/ngày, vượt thì trả coin → sink scale theo mức dùng + gánh chi phí vận hành đắt nhất.
- **Level/XP tách khỏi coin.** Không mua/bán/đánh-bạc được → thưởng độ chăm chứ không phải độ giàu; không bao giờ lạm phát; gate quyền (làm cái, bet cap) theo level.
- **Nhiệm vụ hằng ngày/tuần.** Auto-sinh, zero config → kéo người "chỉ điểm danh" sang dùng game.
- **Treasury** — đốt → gom một slice → bot tự thả mega lì xì định kỳ (biến tiền đốt vô hình thành khoảnh khắc cộng đồng). *Cần mô phỏng số tham số để vẫn net-burn.*
- **Mềm hóa streak** — "vé giữ streak" (1 miss/tháng) chống anxiety-quit + là item để tiêu coin. Cân nhắc hạ đỉnh đường cong điểm danh (9.850/tuần đang quá nóng).

**Việc nên làm sớm bất kể phase:** mô phỏng số cung tiền theo thời gian với vài cấu hình faucet/sink để chọn tham số chuẩn (đặc biệt đường cong reset mùa giải & tỉ lệ treasury) — sai tham số ở đây phản tác dụng.
