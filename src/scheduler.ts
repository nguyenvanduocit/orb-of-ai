// The one home for timing. Recurring jobs: startTicker runs once at startup
// (catch-up for work missed while the bot was down), then on a fixed interval,
// never overlapping — a tick that outlives the interval makes the next firing
// skip instead of race. One-shot deadlines: scheduleDeadline keys replaceable
// best-effort timers — restarts drop them, so callers persist the deadline and
// resolve lazily on the next interaction. Callers still own the other half of
// the contract: every ledger mutation stays synchronous (load → mutate → save,
// no await in between) so an interleaved firing can never double-settle.

import type { Client, Guild } from "discord.js";

// Frame pacing for the games' reveal animations — a resolved-Promise delay.
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function startTicker(name: string, intervalMs: number, tick: () => Promise<void>): void {
  let running = false;
  const run = async (): Promise<void> => {
    if (running) {
      console.warn(`[${name}] previous tick still running — skipping this firing`);
      return;
    }
    running = true;
    try {
      await tick();
    } catch (error) {
      console.error(`[${name}] tick failed:`, error);
    } finally {
      running = false;
    }
  };
  void run();
  setInterval(() => void run(), intervalMs);
  console.log(`[${name}] ticker started (every ${Math.round(intervalMs / 1000)}s)`);
}

// Per-guild fan-out with per-guild error isolation: one broken guild logs and
// moves on instead of killing the whole tick for everyone else.
export async function forEachGuild(
  client: Client,
  name: string,
  fn: (guild: Guild) => Promise<void>,
): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      await fn(guild);
    } catch (error) {
      console.error(`[${name}] guild ${guild.id} failed:`, error);
    }
  }
}

// One-shot deadline timers, keyed by owner (games key by `guildId:channelId`).
// Scheduling an existing key replaces its pending timer, so a stale timer can
// never outlive the round that superseded it.
const deadlines = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleDeadline(key: string, delayMs: number, fn: () => void | Promise<void>): void {
  cancelDeadline(key);
  deadlines.set(
    key,
    setTimeout(async () => {
      deadlines.delete(key);
      try {
        await fn(); // await catches sync throws and async rejections alike
      } catch (error) {
        console.error(`[deadline] ${key} failed:`, error);
      }
    }, delayMs),
  );
}

export function cancelDeadline(key: string): void {
  const timer = deadlines.get(key);
  if (timer) clearTimeout(timer);
  deadlines.delete(key);
}
