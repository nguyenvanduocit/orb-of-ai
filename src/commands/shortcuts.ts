import { ApplicationCommandOptionType } from "discord.js";
import type { Command } from "../types";
import coin from "./coin";
import diemdanh from "./diemdanh";

// Shortcut = lệnh top-level trỏ thẳng vào một subcommand có sẵn (/anxin ≡ /coin anxin).
// `data` lấy nguyên JSON của subcommand từ lệnh gốc nên tên/option/description không
// bao giờ lệch; execute forward về lệnh gốc với sub cố định. Button/modal của message
// tạo ra vẫn mang customId "<lệnh gốc>:..." nên route về lệnh gốc như thường —
// shortcut không cần handler nào khác. Thêm shortcut = thêm một dòng trong danh sách.
function shortcut(parent: Command, sub: string): Command {
  const parentJson = parent.data.toJSON();
  const subJson = (parentJson.options ?? []).find(
    (opt) => opt.type === ApplicationCommandOptionType.Subcommand && opt.name === sub,
  );
  if (subJson?.type !== ApplicationCommandOptionType.Subcommand) {
    throw new Error(`/${parentJson.name} không có subcommand "${sub}" để làm shortcut`);
  }
  return {
    data: {
      name: sub,
      toJSON: () => ({ name: sub, description: subJson.description, options: subJson.options }),
    },
    execute: (interaction) => parent.execute(interaction, sub),
  };
}

export const shortcuts = [
  shortcut(coin, "anxin"),
  shortcut(coin, "doino"),
  shortcut(coin, "tang"),
  shortcut(coin, "sodu"),
  shortcut(diemdanh, "checkin"),
];
