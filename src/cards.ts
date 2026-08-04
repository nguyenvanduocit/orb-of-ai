// Playing-card display: the 52-card deck + a card-back, rendered as Discord
// application emojis (uploaded once via `bun run emojis:upload`). Runtime fetches
// them by name on ClientReady; every lookup falls back to plain text so a
// missing / not-yet-loaded emoji never breaks a render.
//
// This module is the ONE source of truth shared three ways: the SVG generator
// (scripts/gen-cards.ts), the uploader (scripts/upload-emojis.ts), and the live
// render — so the emoji name, the asset filename, and the lookup can never drift.

import type { Client } from "discord.js";

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const SUITS = ["♠️", "♥️", "♦️", "♣️"] as const; // emoji-variation glyphs: ♥️♦️ đỏ, ♠️♣️ đen
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export interface Card {
  rank: Rank;
  suit: Suit;
}

// suit → letter (emoji name + asset filename) + color/glyph (SVG art). Kept here
// so the name and the drawn card are generated from the same table.
export const SUIT_META: Record<Suit, { letter: string; color: string; glyph: string }> = {
  "♠️": { letter: "s", color: "#1a1a1a", glyph: "&#9824;" }, // ♠
  "♥️": { letter: "h", color: "#d40000", glyph: "&#9829;" }, // ♥
  "♦️": { letter: "d", color: "#d40000", glyph: "&#9830;" }, // ♦
  "♣️": { letter: "c", color: "#1a1a1a", glyph: "&#9827;" }, // ♣
};

export const EMOJI_PREFIX = "bj_"; // namespaces our card emojis among the app's emojis
export const BACK_NAME = `${EMOJI_PREFIX}back`;
export const BACK_FILE = "back.png";

function rankKey(rank: Rank): string {
  return rank === "10" ? "10" : rank.toLowerCase();
}
export function emojiName(rank: Rank, suit: Suit): string {
  return `${EMOJI_PREFIX}${rankKey(rank)}${SUIT_META[suit].letter}`;
}
export function assetFile(rank: Rank, suit: Suit): string {
  return `${rankKey(rank)}${SUIT_META[suit].letter}.png`;
}

// Full 52-card enumeration — iterated by the generator and the uploader.
export const DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit): Card => ({ rank, suit })));

// name → "<:name:id>". Empty until initCardEmojis populates it on ClientReady.
const loaded = new Map<string, string>();

// Fetch the app's uploaded card emojis once. Best-effort: on any failure the map
// stays empty and every render falls back to text — never throws into ClientReady.
export async function initCardEmojis(client: Client): Promise<void> {
  try {
    if (!client.application) return;
    const emojis = await client.application.emojis.fetch();
    loaded.clear();
    for (const e of emojis.values()) {
      if (e.name?.startsWith(EMOJI_PREFIX)) loaded.set(e.name, e.toString());
    }
    console.log(`   Card emojis loaded: ${loaded.size}/${DECK.length + 1}`);
  } catch (error) {
    console.error("[cards] failed to load application emojis (falling back to text):", error);
  }
}

export function cardEmoji(rank: Rank, suit: Suit): string {
  return loaded.get(emojiName(rank, suit)) ?? `${rank}${suit}`; // text fallback
}
export function cardBack(): string {
  return loaded.get(BACK_NAME) ?? "🂠";
}
