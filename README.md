# Orb Of AI — Discord Bot

Discord bot chạy trên **discord.js v14** (gateway) + **Claude Agent SDK**, runtime **Bun**. Chat AI trực tiếp trong Discord + bộ slash command minigame/tiện ích thuần TypeScript.

## Features

| Feature | Cách dùng | Lane |
|---|---|---|
| Chat AI | @mention bot hoặc reply tin nhắn của bot trong server | Claude Agent SDK (nhớ ngữ cảnh theo channel) |
| `/hoi` | Hỏi AI một câu nhanh | Claude Agent SDK |
| `/diemdanh checkin` | Điểm danh hằng ngày, thưởng coin tăng theo chuỗi (chu kỳ 7 ngày, tới 🪙 5.000 đại thưởng ngày 7, đứt chuỗi về ngày 1) + lộ trình | Pure TS |
| `/diemdanh bxh` | Bảng xếp hạng điểm danh | Pure TS |
| `/diemdanh stats` | Thống kê điểm danh cá nhân | Pure TS |
| `/oantuti` | Oẳn tù tì với bot | Pure TS |
| `/ping` | Kiểm tra bot sống | Pure TS |
| `/clear` | Xoá ngữ cảnh chat AI của channel hiện tại | Pure TS |

Bảng trên là highlights — danh sách đầy đủ (coin, bầu cua, nối từ, PoE, World Cup, …): gõ `/help` trong Discord, hoặc xem `CLAUDE.md`.

## Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- [flyctl](https://fly.io/docs/flyctl/) (chỉ cần nếu deploy production)
- Claude auth — một trong hai:
  - `claude` CLI đã login trên máy, **hoặc**
  - `CLAUDE_CODE_OAUTH_TOKEN` — lấy bằng lệnh `claude setup-token`

## Setup

```bash
cp .env.example .env
# điền DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN
# (optional) DISCORD_GUILD_ID để slash command hiện ngay trong 1 server — global mất ~1h

bun install
bun run register   # đăng ký slash commands với Discord
bun run dev        # chạy dev (watch mode)
```

## Production (Fly.io)

Bot chạy trên Fly.io: app `orb-of-ai` (region `sin`, https://orb-of-ai.fly.dev), **đúng 1 machine** — gateway bot 2 instance là trả lời đúp mọi tin nhắn. Data thật nằm trên volume `orb_data` (mount `/app/data`); `data/` trong repo chỉ là snapshot cũ. Secrets quản lý qua `fly secrets` (đã import từ `.env`).

```bash
fly deploy --remote-only --ha=false   # ship bản mới
fly logs --app orb-of-ai              # xem log
fly ssh console --app orb-of-ai       # shell vào machine
```

⚠️ Muốn chạy bot local (dev với token thật): `fly machine stop` trước, xong việc `fly machine start` — không bao giờ để hai instance cùng sống.

## ⚠️ Discord Developer Portal — BẮT BUỘC kiểm tra

Vào [Discord Developer Portal](https://discord.com/developers/applications) → chọn application của bot:

1. **Bot → Privileged Gateway Intents → bật `MESSAGE CONTENT INTENT`.**
   Không bật thì bot KHÔNG đọc được nội dung tin nhắn → lane chat AI chết hoàn toàn.

2. **General Information → "Interactions Endpoint URL" phải ĐỂ TRỐNG.**
   Nếu field này đang set (bot orbofai cũ trong familybot dùng webhook `https://telebot.aiocean.io/...`), Discord sẽ gửi slash command vào webhook đó thay vì gateway của bot này → slash commands im lặng không hoạt động. **Xoá URL đó đi** rồi Save.

3. **Cảnh báo instance cũ:** nếu bot familybot/orbofai cũ vẫn đang chạy (trên Pi) với cùng bot token/application, cả hai bot sẽ cùng trả lời khi được mention → nên stop instance cũ trước khi chạy bot này.

## Architecture

```
Discord Gateway (discord.js)
  ├─ interactionCreate ──→ src/commands/index.ts (Map) ──→ command.execute()   [pure TS]
  └─ messageCreate ─────→ src/chat.ts handleMessage()
                            (mention / reply + allowlist filter; DM → stub)
                              └─→ src/agent.ts runAgent()
                                    Claude Agent SDK — one-shot query + session resume
                                    (mỗi server một workspace data/guild_<id>/:
                                     sessions.json + personality CLAUDE.md riêng)
                                      └─→ progress events → throttled edits
                                          final text → chunked ≤2000 chars
```

## Thêm command mới

1. Tạo `src/commands/foo.ts`, default-export một `Command` (xem `src/types.ts`):

```ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";

const foo: Command = {
  data: new SlashCommandBuilder().setName("foo").setDescription("Mô tả"),
  async execute(interaction) {
    await interaction.reply("bar");
  },
};

export default foo;
```

2. Thêm vào Map trong `src/commands/index.ts`.
3. Chạy `bun run register` để Discord biết command mới.
