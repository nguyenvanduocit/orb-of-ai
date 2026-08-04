import { ActionRowBuilder, ButtonBuilder, ContainerBuilder } from "discord.js";
import { mentionOrName } from "../bots";
import { BET_STEP, boardGameCommand, potOf, type BoardState, type EditFn, type Outcome } from "../games";
import { sleep } from "../scheduler";
import { divider, text } from "../ui";

export const ANIMALS = {
  rua: { label: "Rùa", emoji: "🐢" },
  tho: { label: "Thỏ", emoji: "🐇" },
  ngua: { label: "Ngựa", emoji: "🐎" },
  ran: { label: "Rắn", emoji: "🐍" },
  vit: { label: "Vịt", emoji: "🦆" },
  ech: { label: "Ếch", emoji: "🐸" },
} as const;
export type AnimalKey = keyof typeof ANIMALS;
const ANIMAL_KEYS = Object.keys(ANIMALS) as AnimalKey[];

const TRACK_LEN = 20; // lane length in characters — ~24 rendered chars/lane is the mobile-embed wrap limit, don't push past it
const MAX_FRAMES = 18; // hard cap — leader wins if nobody crossed by then
const FRAME_MS = 1500;
export const PAYOUT_MULTIPLIER = 5; // fixed-odds line: back the winner, get 5× your stake back (6 runners → ~16.7% house edge)

interface RaceOutcome extends Outcome {
  winner: AnimalKey;
  frames: number[][];
  pot: number;
}

// Pure core #1: run the race. Each frame every animal advances 1-3; frames[i]
// holds the cumulative positions after frame i. First animal to reach
// TRACK_LEN wins (tie broken by rng among crossers); after MAX_FRAMES the
// leader wins (tie broken by rng).
export function simulateRace(rng: () => number): { winner: AnimalKey; frames: number[][] } {
  const positions = ANIMAL_KEYS.map(() => 0);
  const frames: number[][] = [];
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    for (let i = 0; i < positions.length; i++) {
      positions[i] = positions[i]! + Math.floor(rng() * 3) + 1;
    }
    frames.push([...positions]);
    const crossers = ANIMAL_KEYS.filter((_, i) => positions[i]! >= TRACK_LEN);
    if (crossers.length > 0) {
      const winner =
        crossers.length === 1 ? crossers[0]! : crossers[Math.floor(rng() * crossers.length)]!;
      return { winner, frames };
    }
  }
  const lead = Math.max(...positions);
  const leaders = ANIMAL_KEYS.filter((_, i) => positions[i] === lead);
  const winner = leaders.length === 1 ? leaders[0]! : leaders[Math.floor(rng() * leaders.length)]!;
  return { winner, frames };
}

// Pure core #2: fixed-odds settlement with the host as bookmaker. Every stake on
// the winning animal pays PAYOUT_MULTIPLIER× (stake back + winnings); every other
// stake loses. `credit` is what to return to the player, `net` their round
// result. The host (bankerSettle in games.ts) collects the losing stakes and
// funds the wins from its own balance, capping pro-rata when it can't cover them
// — so nobody backing the winner just means the house sweeps the whole board.
export function settleRace(bets: BoardState<AnimalKey>["bets"], winner: AnimalKey): Outcome["results"] {
  const results: Outcome["results"] = {};
  for (const [userId, userBets] of Object.entries(bets)) {
    const stake = Object.values(userBets).reduce((sum, amount) => sum + (amount ?? 0), 0);
    const credit = (userBets[winner] ?? 0) * PAYOUT_MULTIPLIER;
    results[userId] = { credit, net: credit - stake };
  }
  return results;
}

// Worst case: the most-backed animal wins → the house owes PAYOUT_MULTIPLIER×
// that stake. The engine gates bets against this so the house stays solvent.
export function raceMaxLiability(totals: Partial<Record<AnimalKey, number>>): number {
  const topStake = Object.values(totals).reduce<number>((max, amount) => Math.max(max, amount ?? 0), 0);
  return topStake * PAYOUT_MULTIPLIER;
}

// One animation frame: each lane is the animal's emoji over a dotted track,
// finish flag at the right; the winner gets 🎉 on the final frame.
function renderFrame(frame: number[], winner?: AnimalKey): ContainerBuilder {
  const lanes = ANIMAL_KEYS.map((animal, i) => {
    const pos = Math.min(frame[i] ?? 0, TRACK_LEN);
    const lane = "·".repeat(pos) + ANIMALS[animal].emoji + "·".repeat(TRACK_LEN - pos);
    return `${lane}🏁${winner === animal ? " 🎉" : ""}`;
  });
  return new ContainerBuilder()
    .setAccentColor(winner ? 0xfee75c : 0x5865f2)
    .addTextDisplayComponents(text([`## ${winner ? "🏁 Về đích!" : "🏇 Đua thú đang diễn ra..."}`, "```", ...lanes, "```"].join("\n")));
}

function renderResult(outcome: RaceOutcome): ContainerBuilder {
  const { emoji, label } = ANIMALS[outcome.winner];
  const lines = Object.entries(outcome.results)
    .sort(([, a], [, b]) => b.net - a.net)
    .map(([userId, { net }]) =>
      net >= 0 ? `🎉 ${mentionOrName(userId)}: **+${net}** 🪙` : `💸 ${mentionOrName(userId)}: **${net}** 🪙`,
    );
  const { host } = outcome;
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
  const body = [`## 🏆 ${emoji} ${label} về nhất!`, ...lines, ...bankerLines, `-# Tổng pot: ${outcome.pot} coin`].join("\n");
  return new ContainerBuilder().setAccentColor(0x57f287).addTextDisplayComponents(text(body)).addSeparatorComponents(divider());
}

// Play the race on the board message: one edit per frame every 1.5s; the final
// settle frame carries the "Ván mới" row. Coins were settled before this runs,
// so a crash mid-animation loses nothing.
async function playAnimation(edit: EditFn, outcome: RaceOutcome, again: ActionRowBuilder<ButtonBuilder>): Promise<void> {
  try {
    for (let i = 0; i < outcome.frames.length; i++) {
      const isLast = i === outcome.frames.length - 1;
      await edit(renderFrame(outcome.frames[i]!, isLast ? outcome.winner : undefined));
      await sleep(FRAME_MS);
    }
    await edit(renderResult(outcome).addActionRowComponents(again));
  } catch (error) {
    console.error("[duathu] animation failed:", error);
  }
}

const duathu = boardGameCommand<AnimalKey, RaceOutcome>({
  game: "duathu",
  description: "Đua thú — cược coin cho con nào về nhất, nhà cái ôm kèo tỉ lệ cố định",
  hostIsBanker: true,
  catalog: ANIMALS,
  resolveButton: { action: "run", label: "Đua!", emoji: "🏁" },
  copy: {
    title: "🏇 Đua Thú",
    boardTitle: "🏇 Đua Thú",
    intro: [
      `Mỗi lần bấm nút = cược **${BET_STEP}** 🪙 cho con đó về nhất (bấm nhiều lần để cược thêm).`,
      `Con về nhất trả **gấp ${PAYOUT_MULTIPLIER}×** (cược ${BET_STEP} ăn ${BET_STEP * PAYOUT_MULTIPLIER} 🪙). Chủ ván là **nhà cái** ôm kèo: thua thì cái ăn, hết quỹ thì thắng bao nhiêu chia bấy nhiêu.`,
    ],
    countdown: { lead: "Xuất phát", early: "cho Đua sớm" },
    emptyBets: "*Chưa ai cược — chọn kèo đi bro!*",
    alreadyRunning: "Kênh này đang có ván đua thú rồi — cược hoặc bấm Đua! đi bro.",
    nobodyBet: "Chưa ai cược mà đua gì bro 😅",
    beforeDeadline: "Chưa hết giờ cược — chờ chủ ván cho đua hoặc đợi đếm ngược nhé bro.",
  },
  decide(state) {
    const { winner, frames } = simulateRace(Math.random);
    return {
      winner,
      frames,
      results: settleRace(state.bets, winner),
      pot: potOf(state.bets),
    };
  },
  maxLiability: raceMaxLiability,
  present: playAnimation,
});

export default duathu;
