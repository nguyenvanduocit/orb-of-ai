import { ActionRowBuilder, ButtonBuilder, ContainerBuilder } from "discord.js";
import { mentionOrName } from "../bots";
import { BET_STEP, boardGameCommand, type BoardState, type EditFn, type Outcome } from "../games";
import { sleep } from "../scheduler";
import { divider, text } from "../ui";

export const SYMBOLS = {
  bau: { label: "Bầu", emoji: "🎃" },
  cua: { label: "Cua", emoji: "🦀" },
  tom: { label: "Tôm", emoji: "🦐" },
  ca: { label: "Cá", emoji: "🐟" },
  ga: { label: "Gà", emoji: "🐓" },
  nai: { label: "Nai", emoji: "🦌" },
} as const;
type SymbolKey = keyof typeof SYMBOLS;
const SYMBOL_KEYS = Object.keys(SYMBOLS) as SymbolKey[];

interface RollOutcome extends Outcome {
  dice: SymbolKey[];
}

// Pure core: settle a round against 3 rolled dice. Bets were deducted when
// placed, so `credit` is what to pay back (stake + winnings) and `net` is the
// player's overall result for display.
export function settle(bets: BoardState<SymbolKey>["bets"], dice: SymbolKey[]): Outcome["results"] {
  const results: Outcome["results"] = {};
  for (const [userId, userBets] of Object.entries(bets)) {
    let credit = 0;
    let net = 0;
    for (const [symbol, amount] of Object.entries(userBets) as [SymbolKey, number][]) {
      const matches = dice.filter((d) => d === symbol).length;
      if (matches > 0) {
        credit += amount * (matches + 1);
        net += amount * matches;
      } else {
        net -= amount;
      }
    }
    results[userId] = { credit, net };
  }
  return results;
}

// Worst-case house payout over every possible 3-dice roll. A symbol staked B
// pays B×(count+1) when it appears, so the priciest roll is one of three shapes
// on the most-staked symbols (b1≥b2≥b3): triple (4×b1), pair+single (3×b1+2×b2),
// or three singles (2×(b1+b2+b3)). The engine gates bets against this so the
// house is always solvent up front.
export function baucuaMaxLiability(totals: Partial<Record<SymbolKey, number>>): number {
  const [b1 = 0, b2 = 0, b3 = 0] = Object.values(totals)
    .map((amount) => amount ?? 0)
    .sort((a, b) => b - a);
  return Math.max(4 * b1, 3 * b1 + 2 * b2, 2 * (b1 + b2 + b3));
}

const SHAKE_MS = 650;
const REVEAL_MS = 650;
const HIDDEN = "🎲"; // the rattling dice while the bowl is still down

// The "xóc đĩa" build-up: a covered bowl rattling left-right over the 3 hidden
// dice, then the bowl lifts and each face flips up one at a time. Pure theater —
// coins are already settled before present() runs, so a crash here loses nothing.
function shakeFrame(i: number): ContainerBuilder {
  const bowl = i % 2 === 0 ? "🥣💨💨" : "💨💨🥣";
  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(text(["## 🫳 Đang xóc đĩa...", `# ${bowl}`, `### ${HIDDEN} ${HIDDEN} ${HIDDEN}`].join("\n")));
}

function revealFrame(dice: SymbolKey[], shown: number): ContainerBuilder {
  const faces = dice.map((d, i) => (i < shown ? SYMBOLS[d].emoji : HIDDEN)).join("  ");
  const done = shown >= dice.length;
  return new ContainerBuilder()
    .setAccentColor(done ? 0xfee75c : 0xfaa61a)
    .addTextDisplayComponents(text([`## ${done ? "✨ Lật đĩa!" : "🍽️ Mở đĩa..."}`, `# ${faces}`].join("\n")));
}

// 3 shake frames + one reveal per die + the settle container (~7 edits, well
// under the message-edit rate limit); the final frame carries the "Ván mới" row.
async function playAnimation(edit: EditFn, outcome: RollOutcome, again: ActionRowBuilder<ButtonBuilder>): Promise<void> {
  try {
    for (let i = 0; i < 3; i++) {
      await edit(shakeFrame(i));
      await sleep(SHAKE_MS);
    }
    for (let shown = 1; shown <= outcome.dice.length; shown++) {
      await edit(revealFrame(outcome.dice, shown));
      await sleep(REVEAL_MS);
    }
    await edit(renderResult(outcome).addActionRowComponents(again));
  } catch (error) {
    console.error("[baucua] animation failed:", error);
  }
}

function renderResult({ dice, results, host }: RollOutcome): ContainerBuilder {
  const diceLine = dice.map((d) => `${SYMBOLS[d].emoji} ${SYMBOLS[d].label}`).join("  ");
  const lines = Object.entries(results)
    .sort(([, a], [, b]) => b.net - a.net)
    .map(([userId, { net }]) =>
      net >= 0 ? `🎉 ${mentionOrName(userId)}: **+${net}** 🪙` : `💸 ${mentionOrName(userId)}: **${net}** 🪙`,
    );
  const bankerLines = host
    ? [
        "",
        host.delta >= 0
          ? `🏦 Nhà cái <@${host.id}> ăn **+${host.delta}** 🪙`
          : `🏦 Nhà cái <@${host.id}> chung **${host.delta}** 🪙`,
        ...(host.fee > 0 ? [`🔥 Phí nhà cái: **-${host.fee}** 🪙`] : []),
        ...(host.capped ? ["⚠️ Nhà cái không đủ quỹ — tiền thắng chia theo tỉ lệ."] : []),
      ]
    : [];
  const body = ["## 🎲 Kết quả Bầu Cua", `# ${diceLine}`, "", ...lines, ...bankerLines].join("\n");
  return new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(text(body)).addSeparatorComponents(divider());
}

const baucua = boardGameCommand<SymbolKey, RollOutcome>({
  game: "baucua",
  description: "Mở ván Bầu Cua Tôm Cá — cược coin, lắc 3 hột",
  hostIsBanker: true,
  catalog: SYMBOLS,
  resolveButton: { action: "roll", label: "Lắc!", emoji: "🎲" },
  copy: {
    title: "🎲 Bầu Cua",
    boardTitle: "🎲 Bầu Cua Tôm Cá",
    intro: [
      `Mỗi lần bấm nút = cược **${BET_STEP}** 🪙 vào con đó (bấm nhiều lần để cược thêm).`,
      "Chủ ván là **nhà cái**: bạn thắng thì nhà cái chung, bạn thua thì nhà cái ăn. Nhà cái hết quỹ thì thắng bao nhiêu chia bấy nhiêu.",
    ],
    countdown: { lead: "Chốt cược", early: "Lắc sớm" },
    emptyBets: "*Chưa ai cược — làm phát đi bro!*",
    alreadyRunning: "Kênh này đang có ván bầu cua rồi — cược hoặc bấm Lắc đi bro!",
    nobodyBet: "Chưa ai cược mà lắc gì bro 😅",
    beforeDeadline: "Chưa hết giờ cược — chờ chủ ván lắc hoặc đợi đếm ngược nhé bro.",
  },
  decide(state) {
    const dice = Array.from(
      { length: 3 },
      () => SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]!,
    );
    return { dice, results: settle(state.bets, dice) };
  },
  maxLiability: baucuaMaxLiability,
  present: playAnimation,
});

export default baucua;
