// NHIỆM VỤ HẰNG NGÀY — PURE (no Discord, no I/O, no ledger).
//
// Why this exists: telemetry showed both mid-tier players hit MAX_LEVEL within hours and
// then left. Once the level cap is reached the only remaining goal is "farm deeper", which
// is open-ended and therefore no goal at all. Daily quests hand out something a session can
// actually FINISH — three small, concrete targets that reset each day.
//
// Design:
//   • Targets are drawn from what the engine already reports, so nothing new needs tracking
//     mid-run: floors cleared, elites killed, bosses killed, depth reached, chests opened.
//   • Progress is credited at SETTLE (one place, from the run's own summary), never per
//     floor — that keeps quests out of the hot loop and impossible to double-count.
//   • The reward is materials + coins, deliberately NOT power: a daily should pull you back,
//     not out-scale the people who play the actual game.
//   • The day key is UTC, matching the telemetry journal's date-stamped file rotation, so
//     "today" means the same thing in both systems.

import type { MaterialId } from "./rpg";

export type QuestMetric = "floors" | "elites" | "bosses" | "depth" | "chests";

export interface QuestDef {
  id: string;
  metric: QuestMetric;
  emoji: string;
  // `target` is the number to reach; `label` renders it for the player.
  label: (target: number) => string;
  targets: number[]; // the tiers a daily roll picks from (easy → chunky)
  reward: { materials?: Partial<Record<MaterialId, number>>; coins?: number };
}

export const QUESTS: QuestDef[] = [
  {
    id: "dicho",
    metric: "floors",
    emoji: "🚶",
    label: (n) => `Vượt ${n} tầng trong ngày`,
    targets: [40, 80, 150],
    reward: { materials: { luongthuc: 30 }, coins: 150 },
  },
  {
    id: "santinhanh",
    metric: "elites",
    emoji: "💀",
    label: (n) => `Hạ ${n} quái tinh anh`,
    targets: [3, 6, 10],
    reward: { materials: { tinhchat: 4 }, coins: 250 },
  },
  {
    id: "diettrum",
    metric: "bosses",
    emoji: "👑",
    label: (n) => `Hạ ${n} trùm ải`,
    targets: [2, 4, 7],
    reward: { materials: { manh: 40 }, coins: 200 },
  },
  {
    id: "xuongsau",
    metric: "depth",
    emoji: "🕳️",
    label: (n) => `Chạm tầng ${n} trong một chuyến`,
    targets: [30, 60, 100],
    reward: { materials: { bua: 1 }, coins: 300 },
  },
  {
    id: "morong",
    metric: "chests",
    emoji: "🎁",
    label: (n) => `Mở ${n} Rương Cổ`,
    targets: [2, 4, 7],
    reward: { materials: { tinhchat: 3, manh: 25 } },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// One accepted daily: which quest, what number to hit, how far along, whether paid out.
export interface QuestState {
  id: string;
  target: number;
  progress: number;
  claimed: boolean;
}

// The player's daily board — three quests keyed to a UTC day.
export interface QuestBoard {
  day: string; // YYYY-MM-DD (UTC)
  quests: QuestState[];
}

export const DAILY_COUNT = 3;

// UTC day key — same convention as the telemetry journal's file rotation.
export function dayKey(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// Roll a fresh board of DAILY_COUNT distinct quests. Pure given rng.
export function rollBoard(at: number, rng: () => number): QuestBoard {
  const pool = [...QUESTS];
  const quests: QuestState[] = [];
  while (quests.length < DAILY_COUNT && pool.length > 0) {
    const def = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const target = def.targets[Math.floor(rng() * def.targets.length)]!;
    quests.push({ id: def.id, target, progress: 0, claimed: false });
  }
  return { day: dayKey(at), quests };
}

// The board for `at`, rolling a new one when the day turned (or none existed). Returns the
// board plus whether it is newly rolled, so the shell knows to persist.
export function boardFor(existing: QuestBoard | undefined, at: number, rng: () => number): { board: QuestBoard; rolled: boolean } {
  if (existing && existing.day === dayKey(at)) return { board: existing, rolled: false };
  return { board: rollBoard(at, rng), rolled: true };
}

// What one finished run contributed, read straight off the expedition summary.
export interface RunTally {
  floors: number; // floors cleared this run
  elites: number; // elite monsters killed
  bosses: number; // boss floors cleared
  depth: number; // deepest floor reached
  chests: number; // chests opened
}

// Credit a run against the board. `depth` is a HIGH-WATER metric (deepest single run), the
// rest accumulate. Mutates and returns the board so the caller persists once. Pure otherwise.
export function creditRun(board: QuestBoard, tally: RunTally): QuestBoard {
  for (const q of board.quests) {
    if (q.claimed) continue;
    const def = QUEST_BY_ID[q.id];
    if (!def) continue;
    const got = tally[def.metric];
    if (!got) continue;
    q.progress = def.metric === "depth" ? Math.max(q.progress, got) : q.progress + got;
  }
  return board;
}

export function isComplete(q: QuestState): boolean {
  return q.progress >= q.target;
}

// Quests finished but not yet paid — the shell hands out the rewards and marks them.
export function claimable(board: QuestBoard): QuestState[] {
  return board.quests.filter((q) => !q.claimed && isComplete(q));
}
