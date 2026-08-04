import { ApplicationCommandOptionType, InteractionContextType, type ApplicationCommandType } from "discord.js";
import { config } from "../config";
import type { Command } from "../types";
import baucua from "./baucua";
import blackjack from "./blackjack";
import bug from "./bug";
import clear from "./clear";
import coin from "./coin";
import coindrop from "./coindrop";
import danhhieu from "./danhhieu";
import diemdanh from "./diemdanh";
import discordhero from "./discordhero";
import duathu from "./duathu";
import flex from "./flex";
import help from "./help";
import hoi from "./hoi";
import masoi from "./masoi";
import noitu from "./noitu";
import oantuti from "./oantuti";
import ping from "./ping";
import poe from "./poe";
import poker from "./poker";
import roulette from "./roulette";
import rpg from "./rpg";
import { shortcuts } from "./shortcuts";
import worldcup from "./worldcup";
import xoso from "./xoso";

// /worldcup (cá cược World Cup) chỉ tồn tại khi FOOTBALL_DATA_TOKEN được set —
// hết mùa gỡ token là lệnh biến mất khỏi cả registry lẫn register.ts.
// Shortcuts (/anxin, /checkin, ...) đứng cuối để /help liệt kê sau các lệnh gốc.
export const commands = new Map<string, Command>(
  [ping, help, diemdanh, coin, coindrop, baucua, blackjack, poker, noitu, masoi, oantuti, duathu, roulette, xoso, danhhieu, discordhero, rpg, clear, hoi, poe, flex, bug, ...(config.footballDataToken ? [worldcup] : []), ...shortcuts].map(
    (cmd) => [cmd.data.name, cmd],
  ),
);

// Context menus (user & message) dispatch by the menu's own name (≠ slash command name).
export const contextMenuCommands = new Map<string, Command>(
  [...commands.values()].flatMap((cmd) => (cmd.contextMenus ?? []).map((menu) => [menu.name, cmd] as const)),
);

// Bot server-only: khai báo guild-only ngay tại registration để Discord ẩn mọi
// lệnh & context menu khỏi DM. Gắn tập trung ở đây nên lệnh mới tự có, không lệch.
export const commandData = [
  ...[...commands.values()].map((c) => ({ ...c.data.toJSON(), contexts: [InteractionContextType.Guild] })),
  ...[...commands.values()].flatMap((c) =>
    (c.contextMenus ?? []).map((menu) => ({ ...menu.toJSON(), contexts: [InteractionContextType.Guild] })),
  ),
];

// Tên các context menu theo loại (User/Message), build từ registry sống —
// dùng chung bởi /help và system prompt của agent nên hai nơi không bao giờ lệch.
export function contextMenuCatalog(type: ApplicationCommandType): string[] {
  return [...commands.values()]
    .flatMap((cmd) => cmd.contextMenus ?? [])
    .filter((menu) => menu.type === type)
    .map((menu) => menu.name);
}

// Dòng "usage — mô tả" cho từng lệnh, build từ registry sống. Dùng chung bởi
// /help và system prompt của agent (agent.ts) nên hai nơi không bao giờ lệch.
export function commandCatalog(): { usage: string; description: string }[] {
  return [...commands.values()].map((cmd) => {
    const json = cmd.data.toJSON();
    const subs = (json.options ?? [])
      .filter((opt) => opt.type === ApplicationCommandOptionType.Subcommand)
      .map((opt) => opt.name);
    return {
      usage: subs.length > 0 ? `/${json.name} ${subs.join("|")}` : `/${json.name}`,
      description: json.description,
    };
  });
}
