// Pure-core proof for the poker engine. Run: `bun test src/poker.test.ts`.
// Covers hand ranking (incl. the wheel + kickers), 7-card best-5 selection, the
// side-pot builder + award, and the load-bearing invariant: coins are conserved
// across a whole hand (Σ final stacks == Σ buy-ins) no matter how it's played.

import { describe, expect, test } from "bun:test";
import { SUIT_META, type Card, type Rank, type Suit } from "./cards";
import {
  act,
  awardPots,
  best7,
  betPresets,
  buildSidePots,
  compareScores,
  finalStacks,
  legalMoves,
  potTotal,
  rank5,
  startHand,
  type PokerSeat,
  type PokerState,
} from "./poker";

// "As" / "10d" / "Kh" → Card. Suit letters s/h/d/c match cards.ts SUIT_META.
const LETTER_TO_SUIT: Record<string, Suit> = Object.fromEntries(
  (Object.entries(SUIT_META) as [Suit, { letter: string }][]).map(([suit, m]) => [m.letter, suit]),
);
function c(spec: string): Card {
  const letter = spec.slice(-1);
  const rank = spec.slice(0, -1) as Rank;
  return { rank, suit: LETTER_TO_SUIT[letter]! };
}
const cards = (specs: string): Card[] => specs.split(" ").map(c);

describe("rank5 categories", () => {
  test("orders every category correctly", () => {
    const straightFlush = rank5(cards("9h 8h 7h 6h 5h"));
    const quads = rank5(cards("As Ah Ad Ac Kd"));
    const fullHouse = rank5(cards("Ks Kh Kd 2s 2h"));
    const flush = rank5(cards("Ah Jh 9h 6h 3h"));
    const straight = rank5(cards("9s 8h 7d 6c 5s"));
    const trips = rank5(cards("Qs Qh Qd 7s 2h"));
    const twoPair = rank5(cards("Js Jh 4d 4c Kh"));
    const pair = rank5(cards("10s 10h 8d 5c 2h"));
    const high = rank5(cards("Ah Qd 9s 6c 3h"));
    const ordered = [high, pair, twoPair, trips, straight, flush, fullHouse, quads, straightFlush];
    for (let i = 1; i < ordered.length; i++) {
      expect(compareScores(ordered[i]!, ordered[i - 1]!)).toBeGreaterThan(0);
    }
    expect(straightFlush[0]).toBe(8);
    expect(high[0]).toBe(0);
  });

  test("the wheel A-2-3-4-5 is a 5-high straight, below 6-high", () => {
    const wheel = rank5(cards("As 2h 3d 4c 5s"));
    const sixHigh = rank5(cards("6s 5h 4d 3c 2s"));
    expect(wheel[0]).toBe(4);
    expect(wheel[1]).toBe(5); // ace plays low
    expect(compareScores(sixHigh, wheel)).toBeGreaterThan(0);
  });

  test("kickers break ties within a category", () => {
    const aceKingKicker = rank5(cards("As Ah Kd 5c 3h"));
    const aceQueenKicker = rank5(cards("As Ah Qd 5c 3h"));
    expect(compareScores(aceKingKicker, aceQueenKicker)).toBeGreaterThan(0);
  });
});

describe("best7", () => {
  test("finds the flush inside 7 cards", () => {
    const score = best7(cards("Ah Kh 9h 4h 2h 7s 7d"));
    expect(score[0]).toBe(5); // flush beats the pair of 7s
  });
  test("uses both hole cards + board for a full house", () => {
    const score = best7(cards("Ks Kh 2s 2h 2d 9c 4s")); // twos full of kings? no — 2s trip + K pair
    expect(score[0]).toBe(6);
    expect(score[1]).toBe(2); // trip twos
    expect(score[2]).toBe(13); // kings
  });
});

describe("buildSidePots", () => {
  test("no side pot when everyone matched", () => {
    const pots = buildSidePots([
      { id: "a", committed: 100, folded: false },
      { id: "b", committed: 100, folded: false },
      { id: "c", committed: 100, folded: true },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(300);
    expect(pots[0]!.eligible.sort()).toEqual(["a", "b"]);
  });

  test("a short all-in creates a main pot + a side pot", () => {
    // a all-in for 50, b and c bet 200 each.
    const pots = buildSidePots([
      { id: "a", committed: 50, folded: false },
      { id: "b", committed: 200, folded: false },
      { id: "c", committed: 200, folded: false },
    ]);
    expect(pots).toHaveLength(2);
    expect(pots[0]!.amount).toBe(150); // 50×3 — a, b, c eligible
    expect(pots[0]!.eligible.sort()).toEqual(["a", "b", "c"]);
    expect(pots[1]!.amount).toBe(300); // 150×2 — only b, c
    expect(pots[1]!.eligible.sort()).toEqual(["b", "c"]);
  });

  test("conserves chips exactly", () => {
    const contribs = [
      { id: "a", committed: 33, folded: false },
      { id: "b", committed: 77, folded: true },
      { id: "c", committed: 120, folded: false },
      { id: "d", committed: 120, folded: false },
    ];
    const pots = buildSidePots(contribs);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(33 + 77 + 120 + 120);
  });
});

describe("awardPots", () => {
  test("short all-in can only win the main pot", () => {
    // a (all-in 50) has the best hand but only competes for the main pot; the
    // side pot goes to the better of b/c.
    const pots = buildSidePots([
      { id: "a", committed: 50, folded: false },
      { id: "b", committed: 200, folded: false },
      { id: "c", committed: 200, folded: false },
    ]);
    const scores = {
      a: best7(cards("As Ah Ad Ac Ks 2h 3d")), // quads — best overall
      b: best7(cards("Ks Kh Kd 4c 9s 2c 7h")), // trips
      c: best7(cards("Qs Qh Qd 4d 9h 2s 7d")), // trips, worse
    };
    const won = awardPots(pots, scores, ["a", "b", "c"]);
    expect(won.a).toBe(150); // main pot only
    expect(won.b).toBe(300); // side pot
    expect(won.c ?? 0).toBe(0);
  });

  test("split pot halves with the odd chip to the earliest seat", () => {
    // 3 contributors of 17 (one folded) → one 51-chip pot contested by a & b.
    const pots = buildSidePots([
      { id: "a", committed: 17, folded: false },
      { id: "b", committed: 17, folded: false },
      { id: "c", committed: 17, folded: true },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(51);
    const tie = best7(cards("As Ah 2d 3c 4s 5h 9d"));
    const won = awardPots(pots, { a: tie, b: tie, c: [0] }, ["a", "b", "c"]);
    expect(won.a).toBe(26); // 51 → 25/25, odd chip to a (earliest in order)
    expect(won.b).toBe(25);
    expect(won.a + won.b).toBe(51);
  });
});

// --- Full-hand coin conservation ---

function seat(stack: number): PokerSeat {
  return { stack, committedRound: 0, committedTotal: 0, hole: [], folded: false, allIn: false, hasActed: false };
}
function freshState(buyins: Record<string, number>): PokerState {
  const order = Object.keys(buyins);
  return {
    phase: "lobby",
    host: order[0]!,
    messageId: "",
    deadline: 0,
    order,
    seats: Object.fromEntries(order.map((id) => [id, seat(buyins[id]!)])),
    buttonIndex: 0,
    buyins,
    deck: [],
    board: [],
    currentBet: 0,
    lastRaiseSize: 0,
    toAct: null,
  };
}

// While betting is live, chips are never created/destroyed: every seat's
// stack + chips-in-the-pot always sums back to the buy-ins. (After showdown the
// pot is distributed into winners' stacks, so this per-street identity no longer
// applies — the terminal guarantee is Σ finalStacks == Σ buy-ins, asserted below.)
const sumBuyins = (b: Record<string, number>): number => Object.values(b).reduce((s, v) => s + v, 0);
function assertConserved(state: PokerState, buyins: Record<string, number>): void {
  const total = state.order.reduce((s, id) => s + state.seats[id]!.stack + state.seats[id]!.committedTotal, 0);
  expect(total).toBe(sumBuyins(buyins));
}

// Drive a hand with a policy. Each iteration top is a live betting street (the
// while guard proves phase != showdown), so the invariant is asserted there; the
// terminal showdown state is covered by the Σ finalStacks check in each test.
function playOut(state: PokerState, buyins: Record<string, number>, policy: (s: PokerState, id: string) => void): void {
  let guard = 0;
  while (state.phase !== "showdown" && state.toAct && guard++ < 500) {
    assertConserved(state, buyins);
    policy(state, state.toAct);
  }
  expect(guard).toBeLessThan(500);
}

describe("full hand conserves coins", () => {
  test("everyone checks/calls to showdown", () => {
    const buyins = { a: 300, b: 300, c: 300 };
    const state = freshState(buyins);
    startHand(state);
    assertConserved(state, buyins);
    playOut(state, buyins, (s, id) => {
      const lm = legalMoves(s, id);
      act(s, id, lm.canCheck ? { type: "check" } : { type: "call" });
    });
    expect(state.phase).toBe("showdown");
    const stacks = finalStacks(state);
    const out = Object.values(stacks).reduce((x, y) => x + y, 0);
    expect(out).toBe(900); // Σ final stacks == Σ buy-ins
  });

  test("all but one fold preflop → the last player scoops the blinds", () => {
    const buyins = { a: 300, b: 300, c: 300 };
    const state = freshState(buyins);
    startHand(state);
    playOut(state, buyins, (s, id) => act(s, id, { type: "fold" }));
    expect(state.phase).toBe("showdown");
    expect(Object.values(finalStacks(state)).reduce((x, y) => x + y, 0)).toBe(900);
    // Exactly one player is unfolded and holds > their buy-in (won the blinds).
    const winners = state.order.filter((id) => !state.seats[id]!.folded);
    expect(winners).toHaveLength(1);
    expect(state.seats[winners[0]!]!.stack).toBeGreaterThan(300);
  });

  test("uneven stacks + all-in run-out still conserves and pays a side pot", () => {
    const buyins = { a: 40, b: 500, c: 500 }; // a is short → forced all-in creates a side pot
    const state = freshState(buyins);
    startHand(state);
    playOut(state, buyins, (s, id) => {
      const lm = legalMoves(s, id);
      // Shove when able, else call/check — guarantees all-ins and a run-out.
      const presets = betPresets(s, id);
      const allin = presets.find((p) => p.allIn);
      if (allin && s.seats[id]!.stack > 0) act(s, id, { type: "raise", to: allin.to });
      else act(s, id, lm.canCall ? { type: "call" } : { type: "check" });
    });
    expect(state.phase).toBe("showdown");
    expect(Object.values(finalStacks(state)).reduce((x, y) => x + y, 0)).toBe(1040);
    // side pots were built and their sum equals the total wagered
    const potSum = (state.potsInfo ?? []).reduce((s, p) => s + p.amount, 0);
    expect(potSum).toBe(potTotal(state));
  });
});
