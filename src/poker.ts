// Texas Hold'em — the pure, testable engine behind /poker. NO Discord, NO ledger,
// NO I/O: just the hand state machine (preflop → flop → turn → river → showdown),
// a 7-card hand evaluator, No-Limit betting with all-in, and side-pot math. The
// command shell (commands/poker.ts) owns persistence, rendering and the coin
// ledger; everything money-sensitive that can be proven in isolation lives here
// and is covered by poker.test.ts.
//
// Coin model is peer-pot zero-sum (like /masoi, /noitu): a player's coins are
// converted to a chip `stack` at buy-in, chips only move stack↔pot during the
// hand, and every seat's final stack (+ any pot winnings) is credited back — so
// Σ(credited) == Σ(buy-ins) exactly. Nothing minted, nothing burned, no rake.

import { RANKS, SUITS, type Card, type Rank } from "./cards";

export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;

// --- Deck (single 52-card pack, shuffled). blackjack uses a 4-deck shoe; poker
// is always one pack so the community/hole cards can never collide. ---

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 11, Q: 12, K: 13, A: 14,
};

// --- Hand evaluation (pure) ---
// A hand's strength is a comparable number[] tuple: [category, ...tiebreakers],
// every element a rank value, compared lexicographically. Categories 8..0:
// 8 straight flush · 7 quads · 6 full house · 5 flush · 4 straight · 3 trips
// · 2 two pair · 1 pair · 0 high card. Bigger tuple = better hand.

export function compareScores(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Highest card of a 5-long straight in `valuesDesc` (distinct, sorted desc), or 0
// if not a straight. Handles the A-2-3-4-5 "wheel" where the ace plays low (high
// card = 5).
function straightHigh(valuesDesc: number[]): number {
  const uniq = [...new Set(valuesDesc)];
  if (uniq.length < 5) return 0;
  for (let i = 0; i + 4 < uniq.length; i++) {
    if (uniq[i]! - uniq[i + 4]! === 4) return uniq[i]!;
  }
  // Wheel: A,5,4,3,2 → treat as a 5-high straight.
  if (uniq.includes(14) && [5, 4, 3, 2].every((v) => uniq.includes(v))) return 5;
  return 0;
}

// Rank exactly 5 cards into their comparable tuple.
export function rank5(cards: Card[]): number[] {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0]!.suit);
  const straight = straightHigh(values);

  // group values by count, ordered by (count desc, value desc)
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const [g0, g1] = groups;

  if (isFlush && straight) return [8, straight];
  if (g0![1] === 4) return [7, g0![0], groups[1]![0]];
  if (g0![1] === 3 && g1 && g1[1] === 2) return [6, g0![0], g1[0]];
  if (isFlush) return [5, ...values];
  if (straight) return [4, straight];
  if (g0![1] === 3) return [3, g0![0], ...groups.slice(1).map((g) => g[0])];
  if (g0![1] === 2 && g1 && g1[1] === 2) {
    const kicker = groups.find((g) => g[1] === 1)![0];
    return [2, g0![0], g1[0], kicker];
  }
  if (g0![1] === 2) return [1, g0![0], ...groups.slice(1).map((g) => g[0])];
  return [0, ...values];
}

// 5 choose from up-to-7: the best 5-card tuple over every combination.
export function best7(cards: Card[]): number[] {
  if (cards.length <= 5) return rank5(cards);
  let best: number[] | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const score = rank5([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (!best || compareScores(score, best) > 0) best = score;
          }
  return best!;
}

const CATEGORY_NAME = [
  "Mậu thầu", // 0 high card
  "Đôi", // 1 pair
  "Hai đôi", // 2
  "Sám cô", // 3 trips
  "Sảnh", // 4 straight
  "Thùng", // 5 flush
  "Cù lũ", // 6 full house
  "Tứ quý", // 7 quads
  "Thùng phá sảnh", // 8 straight flush
];
const VALUE_NAME: Record<number, string> = {
  14: "A", 13: "K", 12: "Q", 11: "J", 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "3", 2: "2",
};

// Friendly Vietnamese label for a score tuple — used in the private "xem bài" hint
// so a beginner sees "Đôi K" instead of a raw array.
export function handName(score: number[]): string {
  const cat = score[0]!;
  const base = CATEGORY_NAME[cat]!;
  if (cat === 8) return score[1] === 14 ? "Sảnh rồng (A cao)" : `${base} ${VALUE_NAME[score[1]!]} cao`;
  if (cat === 7) return `${base} ${VALUE_NAME[score[1]!]}`;
  if (cat === 6) return `${base} (${VALUE_NAME[score[1]!]} trên ${VALUE_NAME[score[2]!]})`;
  if (cat === 5) return `${base} ${VALUE_NAME[score[1]!]} cao`;
  if (cat === 4) return `${base} ${VALUE_NAME[score[1]!]} cao`;
  if (cat === 3) return `${base} ${VALUE_NAME[score[1]!]}`;
  if (cat === 2) return `${base} ${VALUE_NAME[score[1]!]} & ${VALUE_NAME[score[2]!]}`;
  if (cat === 1) return `${base} ${VALUE_NAME[score[1]!]}`;
  return `${base} ${VALUE_NAME[score[1]!]} cao`;
}

// --- Side pots (pure) ---
// From each contender's total chips committed this hand (folded players still
// contributed) build the layered pots: a player only competes for chips up to
// what they matched. Returns pots in order (main pot first); each pot lists the
// non-folded ids eligible to win it. Σ(pot.amount) == Σ(committed).

export interface Contribution {
  id: string;
  committed: number;
  folded: boolean;
}
export interface SidePot {
  amount: number;
  eligible: string[]; // non-folded contributors who reached this layer
}

export function buildSidePots(contribs: Contribution[]): SidePot[] {
  const remaining = contribs.filter((c) => c.committed > 0).map((c) => ({ ...c }));
  const pots: SidePot[] = [];
  let carry = 0; // chips from a fully-folded layer roll into the next real pot
  while (remaining.some((c) => c.committed > 0)) {
    const level = Math.min(...remaining.filter((c) => c.committed > 0).map((c) => c.committed));
    const atLevel = remaining.filter((c) => c.committed > 0);
    let amount = level * atLevel.length + carry;
    carry = 0;
    const eligible = atLevel.filter((c) => !c.folded).map((c) => c.id);
    for (const c of atLevel) c.committed -= level;
    if (eligible.length === 0) {
      carry = amount; // everyone at this layer folded — dead chips join the next pot
      continue;
    }
    // Merge into the previous pot when the eligible set is identical (avoids a
    // pile of 1-chip pots with the same contenders).
    const prev = pots[pots.length - 1];
    if (prev && sameSet(prev.eligible, eligible)) prev.amount += amount;
    else pots.push({ amount, eligible });
  }
  if (carry > 0 && pots.length > 0) pots[pots.length - 1]!.amount += carry;
  return pots;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// Award every pot to the best hand(s) among its eligible players; ties split
// floored, the odd chip going to the earliest eligible id in `order` (seat order
// left of the button). Returns chips won per id (0 for non-winners).
export function awardPots(
  pots: SidePot[],
  scores: Record<string, number[]>,
  order: string[],
): Record<string, number> {
  const won: Record<string, number> = {};
  for (const pot of pots) {
    let best: number[] | null = null;
    for (const id of pot.eligible) {
      if (!best || compareScores(scores[id]!, best) > 0) best = scores[id]!;
    }
    const winners = pot.eligible.filter((id) => compareScores(scores[id]!, best!) === 0);
    const ordered = order.filter((id) => winners.includes(id));
    const share = Math.floor(pot.amount / ordered.length);
    let dealt = 0;
    for (const id of ordered) {
      won[id] = (won[id] ?? 0) + share;
      dealt += share;
    }
    const remainder = pot.amount - dealt;
    if (remainder > 0 && ordered[0]) won[ordered[0]] = (won[ordered[0]] ?? 0) + remainder;
  }
  return won;
}

// --- Hand state + No-Limit betting engine ---

export type PokerPhase = "lobby" | "preflop" | "flop" | "turn" | "river" | "showdown" | "ended";
const STREETS: PokerPhase[] = ["preflop", "flop", "turn", "river"];

// A street with live betting (someone may be to act) — the command shell arms its
// turn timer only during these.
export function isBettingPhase(phase: PokerPhase): boolean {
  return STREETS.includes(phase);
}

export interface PokerSeat {
  stack: number; // chips left in front of the player
  committedRound: number; // chips put into the current street's betting
  committedTotal: number; // chips put in across the whole hand (drives side pots)
  hole: Card[]; // 2 private cards
  folded: boolean;
  allIn: boolean;
  hasActed: boolean; // has acted since the last aggression on this street
}

export interface PokerState {
  phase: PokerPhase;
  host: string;
  messageId: string;
  deadline: number; // epoch ms — current turn's clock (0 in lobby / when no one is to act)
  order: string[]; // seat order, fixed at deal
  seats: Record<string, PokerSeat>;
  buttonIndex: number; // dealer button position in `order`
  buyins: Record<string, number>; // lobby: chosen buy-in per seat (→ stack at deal)
  deck: Card[];
  board: Card[]; // community cards, 0/3/4/5 as streets are dealt
  currentBet: number; // highest committedRound this street (the amount to match)
  lastRaiseSize: number; // size of the last raise/bet — the No-Limit minimum re-raise
  toAct: string | null; // whose turn; null when the street's betting is settled
  // showdown results (set once, for the command to render + credit)
  reveal?: boolean; // true when a showdown happened (hole cards shown)
  payouts?: Record<string, number>; // chips won from pots per id
  potsInfo?: SidePot[]; // the layered pots, for the result embed
}

function activeIds(state: PokerState): string[] {
  return state.order.filter((id) => !state.seats[id]!.folded);
}
export function potTotal(state: PokerState): number {
  return state.order.reduce((sum, id) => sum + state.seats[id]!.committedTotal, 0);
}

// Deal a fresh hand from the lobby: shuffle, seat stacks from buy-ins, post
// blinds, deal 2 hole cards each, open preflop betting. Mutates `state`.
export function startHand(state: PokerState): void {
  const n = state.order.length;
  state.deck = freshDeck();
  state.board = [];
  for (const id of state.order) {
    state.seats[id] = {
      stack: state.buyins[id]!,
      committedRound: 0,
      committedTotal: 0,
      hole: [state.deck.pop()!, state.deck.pop()!],
      folded: false,
      allIn: false,
      hasActed: false,
    };
  }
  // Heads-up: the button is the small blind and acts first preflop. 3+: SB is
  // left of the button, BB next, and the seat after the BB opens the action.
  const sbIndex = n === 2 ? state.buttonIndex : (state.buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (state.buttonIndex + 1) % n : (state.buttonIndex + 2) % n;
  postBlind(state, state.order[sbIndex]!, SMALL_BLIND);
  postBlind(state, state.order[bbIndex]!, BIG_BLIND);
  state.currentBet = BIG_BLIND;
  state.lastRaiseSize = BIG_BLIND;
  state.phase = "preflop";
  const firstIndex = (bbIndex + 1) % n;
  state.toAct = firstActor(state, firstIndex);
  // Everyone all-in from blinds alone (tiny stacks) → run it out immediately.
  if (state.toAct === null) runToShowdown(state);
}

function postBlind(state: PokerState, id: string, amount: number): void {
  const seat = state.seats[id]!;
  const pay = Math.min(amount, seat.stack); // a stack shorter than the blind posts all of it
  seat.stack -= pay;
  seat.committedRound += pay;
  seat.committedTotal += pay;
  if (seat.stack === 0) seat.allIn = true;
}

// A seat still owes an action this street if it can act (live, not all-in) and
// either hasn't acted since the last raise or is short of the current bet.
function needsToAct(state: PokerState, id: string): boolean {
  const s = state.seats[id]!;
  return !s.folded && !s.allIn && (!s.hasActed || s.committedRound < state.currentBet);
}

// First seat that owes an action, scanning clockwise from `fromIndex`. null when
// the street's betting is settled.
function firstActor(state: PokerState, fromIndex: number): string | null {
  const n = state.order.length;
  for (let i = 0; i < n; i++) {
    const id = state.order[(fromIndex + i) % n]!;
    if (needsToAct(state, id)) return id;
  }
  return null;
}

// What the seat to act may legally do right now.
export interface LegalMoves {
  toCall: number; // chips needed to match the current bet (0 → can check)
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean; // has chips beyond the call → can put in a raise/all-in
  minRaiseTo: number; // smallest legal total a full raise may go to
  maxRaiseTo: number; // all-in total (committedRound + stack)
}
export function legalMoves(state: PokerState, id: string): LegalMoves {
  const seat = state.seats[id]!;
  const toCall = Math.min(state.currentBet - seat.committedRound, seat.stack);
  const maxRaiseTo = seat.committedRound + seat.stack;
  const minRaiseTo = state.currentBet + state.lastRaiseSize;
  return {
    toCall,
    canCheck: state.currentBet === seat.committedRound,
    canCall: toCall > 0,
    canRaise: maxRaiseTo > state.currentBet, // something left to raise with
    minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
    maxRaiseTo,
  };
}

// The three preset raise buttons (½ pot / pot / all-in), resolved to concrete
// "raise to" totals and clamped legal. Deduped so a short stack doesn't show three
// buttons that all mean all-in. Empty when the seat can't raise.
export interface Preset {
  key: "half" | "pot" | "allin";
  to: number; // resulting committedRound total
  add: number; // extra chips this costs the seat now
  allIn: boolean;
}
export function betPresets(state: PokerState, id: string): Preset[] {
  const seat = state.seats[id]!;
  const lm = legalMoves(state, id);
  if (!lm.canRaise) return [];
  const potAfterCall = potTotal(state) + lm.toCall;
  const raw: { key: Preset["key"]; to: number }[] = [
    { key: "half", to: state.currentBet + Math.max(state.lastRaiseSize, Math.floor(potAfterCall / 2)) },
    { key: "pot", to: state.currentBet + Math.max(state.lastRaiseSize, potAfterCall) },
    { key: "allin", to: lm.maxRaiseTo },
  ];
  const seen = new Set<number>();
  const presets: Preset[] = [];
  for (const { key, to } of raw) {
    const clamped = Math.min(to, lm.maxRaiseTo);
    if (clamped <= state.currentBet) continue; // not actually a raise
    if (seen.has(clamped)) continue;
    seen.add(clamped);
    presets.push({ key, to: clamped, add: clamped - seat.committedRound, allIn: clamped === lm.maxRaiseTo });
  }
  return presets;
}

export type Move =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number };

// Apply the seat-to-act's move, then advance the turn — closing the street (and
// dealing the next / going to showdown) when the betting is settled. Mutates
// `state`. Assumes the caller already validated it's this seat's turn and the
// move is legal (legalMoves/betPresets); an illegal raise is clamped defensively.
export function act(state: PokerState, id: string, move: Move): void {
  const seat = state.seats[id]!;
  const lm = legalMoves(state, id);
  switch (move.type) {
    case "fold":
      seat.folded = true;
      break;
    case "check":
      break; // legal only when toCall == 0; nothing moves
    case "call": {
      const pay = lm.toCall;
      seat.stack -= pay;
      seat.committedRound += pay;
      seat.committedTotal += pay;
      if (seat.stack === 0) seat.allIn = true;
      break;
    }
    case "raise": {
      const to = Math.min(Math.max(move.to, state.currentBet + 1), lm.maxRaiseTo);
      const add = to - seat.committedRound;
      seat.stack -= add;
      seat.committedRound += add;
      seat.committedTotal += add;
      const raiseSize = to - state.currentBet;
      if (raiseSize >= state.lastRaiseSize) state.lastRaiseSize = raiseSize; // a full raise re-opens the min
      state.currentBet = to;
      if (seat.stack === 0) seat.allIn = true;
      break;
    }
  }
  seat.hasActed = true;

  // Everyone folded but one → that player wins the whole pot, no showdown.
  if (activeIds(state).length === 1) {
    endHand(state, false);
    return;
  }
  const fromIndex = (state.order.indexOf(id) + 1) % state.order.length;
  const next = firstActor(state, fromIndex);
  if (next) {
    state.toAct = next;
    return;
  }
  advanceStreet(state); // street's betting settled
}

// Move to the next street. If ≤1 seat can still act (the rest all-in/folded) but
// ≥2 remain live, run the remaining board out and go to showdown. Otherwise deal
// the street and open its betting.
function advanceStreet(state: PokerState): void {
  const live = activeIds(state);
  const canStillAct = live.filter((id) => !state.seats[id]!.allIn);
  if (canStillAct.length <= 1 && live.length >= 2) {
    runToShowdown(state);
    return;
  }
  const streetIdx = STREETS.indexOf(state.phase);
  const nextPhase = STREETS[streetIdx + 1];
  if (!nextPhase) {
    endHand(state, true); // river betting done → showdown
    return;
  }
  dealStreet(state, nextPhase);
  for (const id of state.order) {
    state.seats[id]!.committedRound = 0;
    state.seats[id]!.hasActed = false;
  }
  state.currentBet = 0;
  state.lastRaiseSize = BIG_BLIND;
  state.phase = nextPhase;
  // Postflop action opens with the first live seat left of the button.
  state.toAct = firstActor(state, (state.buttonIndex + 1) % state.order.length);
  if (state.toAct === null) advanceStreet(state); // nobody can act (all all-in) → keep dealing
}

function dealStreet(state: PokerState, phase: PokerPhase): void {
  const need = phase === "flop" ? 3 : 1;
  for (let i = 0; i < need; i++) state.board.push(state.deck.pop()!);
}

// Deal any missing community cards then go to showdown (used when all remaining
// players are all-in, so there's no more betting to do).
function runToShowdown(state: PokerState): void {
  while (state.board.length < 5) state.board.push(state.deck.pop()!);
  endHand(state, true);
}

// Resolve the hand: build side pots from the total each seat committed, award
// them, stamp results. `reveal` = a real showdown (≥2 live) vs an uncontested win.
function endHand(state: PokerState, reveal: boolean): void {
  const contribs: Contribution[] = state.order.map((id) => ({
    id,
    committed: state.seats[id]!.committedTotal,
    folded: state.seats[id]!.folded,
  }));
  const pots = buildSidePots(contribs);
  const scores: Record<string, number[]> = {};
  for (const id of activeIds(state)) scores[id] = best7([...state.seats[id]!.hole, ...state.board]);
  const payouts = awardPots(pots, scores, rotatedOrder(state));
  for (const [id, chips] of Object.entries(payouts)) state.seats[id]!.stack += chips;
  state.payouts = payouts;
  state.potsInfo = pots;
  state.reveal = reveal && activeIds(state).length >= 2;
  state.toAct = null;
  state.deadline = 0;
  state.phase = "showdown";
}

// Seat order starting left of the button — the tie-break order for odd chips.
function rotatedOrder(state: PokerState): string[] {
  const n = state.order.length;
  return Array.from({ length: n }, (_, i) => state.order[(state.buttonIndex + 1 + i) % n]!);
}

// Timeout / AFK: the seat to act auto-checks when it's free, otherwise folds.
export function autoAct(state: PokerState, id: string): Move {
  const lm = legalMoves(state, id);
  const move: Move = lm.canCheck ? { type: "check" } : { type: "fold" };
  act(state, id, move);
  return move;
}

// Final chips each seat walks away with = whatever is left in front of them
// (winners already had pot chips added in endHand). The command credits these
// back to wallets (ghost-guarded). Σ == Σ(buy-ins): coins conserved.
export function finalStacks(state: PokerState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.order) out[id] = state.seats[id]!.stack;
  return out;
}
