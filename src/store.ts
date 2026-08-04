// The JSON store foundation: where data lives on disk, and how it is read and
// written safely. Imports nothing from the rest of the bot, so the three store
// layers above it — economy.ts (the shared wallet), rpg-store.ts (the shared
// world) and guilds.ts (per-server rooms) — can all sit on it without an
// evaluation cycle.
//
// Two roots, and the split is the whole data model:
//   data/global/       — ONE economy and ONE character per person, for every
//                        server the bot is in. A player carries their wallet,
//                        titles, hero and market listings wherever they play.
//   data/guild_<id>/   — what genuinely belongs to a single server: its agent
//                        workspace + personality, the announce channel, voice
//                        reward sessions, coin drops, begs, and the games
//                        running in its channels.
// If a piece of state answers "who is this player?" it is global; if it answers
// "what is happening in this room?" it is per-guild.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Where the store lives. ORB_DATA_DIR relocates it explicitly; otherwise a test
// run is redirected to .test-data/ automatically (Bun sets NODE_ENV=test).
// That redirect matters now: the shared world sits at data/global/, so a test
// that used to scribble in its own throwaway guild folder would otherwise be
// writing into real wallets.
export const DATA_DIR = process.env.ORB_DATA_DIR
  ? `${process.env.ORB_DATA_DIR.replace(/\/$/, "")}/`
  : fileURLToPath(new URL(process.env.NODE_ENV === "test" ? "../.test-data/" : "../data/", import.meta.url));
export const TEMPLATE_DIR = fileURLToPath(new URL("../template/", import.meta.url));

export function guildDir(guildId: string): string {
  return join(DATA_DIR, `guild_${guildId}`);
}

// The shared world's root. Unlike a guild folder it has no lifecycle event to
// provision it, and no event that ever deletes it: it outlives every individual
// server the bot is installed in. Resolving the path never creates it — writes
// do (writeJsonFile), so reading, or a migration dry run, leaves no trace.
export function globalDir(): string {
  return join(DATA_DIR, "global");
}

export function globalFile(name: string): string {
  return join(globalDir(), name);
}

// Every provisioned guild folder on disk, by id. Powers sweeps that run off
// disk rather than the client's guild cache — the migration, and the RPG
// telemetry report reading every server's journal. A missing data root (fresh
// checkout) yields [].
export function listGuildIds(): string[] {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((name) => name.startsWith("guild_"))
    .map((name) => name.slice("guild_".length));
}

// Missing file → null (fresh start). Corrupt file → quarantined as
// <file>.corrupt-<timestamp> and treated as missing, so a later save can never
// legitimize wiping data that was really there. Other I/O errors propagate.
// Exported: agent.ts stores its per-workspace sessions.json through the same
// convention.
export function readJsonFile<T>(file: string): T | null {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const quarantined = `${file}.corrupt-${Date.now()}`;
    renameSync(file, quarantined);
    console.error(`[store] corrupt JSON in ${file} — quarantined to ${quarantined}:`, error);
    return null;
  }
}

// Write to a tmp file then rename over the target — a crash mid-write leaves
// the previous version intact instead of a truncated file. The parent directory
// is created on demand, which is what provisions data/global/ the first time
// anything is saved there (a guild folder is gated by liveGuildDir instead, so
// this can't resurrect a wiped server).
export function writeJsonFile(file: string, value: unknown): void {
  mkdirSync(join(file, ".."), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, file);
}

// Provisioning belongs to lifecycle (syncGuild / the chat lane). A straggler
// write racing GuildDelete must not resurrect a wiped guild folder as a zombie
// template copy, so per-guild saves drop the write instead of re-provisioning.
// Global saves never need this: data/global/ has no delete event.
export function liveGuildDir(guildId: string): string | null {
  const dir = guildDir(guildId);
  if (existsSync(dir)) return dir;
  console.warn(`[store] dropped write — guild ${guildId} folder no longer exists`);
  return null;
}
