// Auto economy events. Tier-1 = weekend x2 (pure clock derive, zero stored
// state — see isVietnamWeekend/activeMultiplier in economy.ts). This module owns
// the scheduler: it GC-sweeps an expired Tier-2 activeEvent so a lapsed
// multiplier never lingers past its `until`, then announces the weekend bonus
// once per ISO week in each server. The multiplier value itself is computed in
// economy.ts (activeMultiplier); here we only announce + provide the reducers
// the Tier-2 admin tools (agent-tools.ts) drive.
//
// The event itself is system-wide, because the wallet is: a multiplier that
// differed per server would just be an arbitrage — claim your check-in wherever
// the bonus happens to be richest. Only the ANNOUNCE is per-server, so each
// room hears about it once.

import { EmbedBuilder, type Client, type Guild } from "discord.js";
import {
  isVietnamWeekend,
  loadGlobalSettings,
  saveGlobalSettings,
  type EventKind,
  type GlobalSettings,
} from "./economy";
import { loadSettings, resolveAnnounceChannel, saveSettings } from "./guilds";
import { forEachGuild, startTicker } from "./scheduler";

const EVENT_TICK_MS = 10 * 60_000; // 10 phút — dọn event hết hạn + announce cuối tuần

// Pure reducers over GlobalSettings (like the game reducers): open / close the
// Tier-2 custom event, returning a NEW settings object. The caller computes
// `until` (now + hours) and does the load → apply → save.
export function startEvent(
  settings: GlobalSettings,
  event: { kind: EventKind; multiplier: number; until: number; by: string },
): GlobalSettings {
  return {
    ...settings,
    activeEvent: { kind: event.kind, multiplier: event.multiplier, until: event.until, startedBy: event.by },
  };
}

export function stopEvent(settings: GlobalSettings): GlobalSettings {
  return { ...settings, activeEvent: null };
}

// An event multiplies the faucet for EVERYONE, so it is announced in every
// server rather than only where the admin happened to type the command — a
// player in another server would otherwise never learn their check-in is worth
// double right now. Best-effort per server: the event is already live in the
// store, so a failed send only costs the announcement. Returns how many rooms
// heard it.
export async function announceEverywhere(client: Client, embed: EmbedBuilder): Promise<number> {
  let announced = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const channel = await resolveAnnounceChannel(guild);
      if (!channel) continue;
      await channel.send({ embeds: [embed] });
      announced++;
    } catch (error) {
      console.error(`[events] announce failed in guild ${guild.id}:`, error);
    }
  }
  return announced;
}

// startTicker: one catch-up run at startup then every EVENT_TICK_MS, never
// overlapping; forEachGuild isolates a broken guild from the rest of the tick.
export function startEventScheduler(client: Client): void {
  startTicker("events", EVENT_TICK_MS, async () => {
    sweepExpiredEvent();
    await forEachGuild(client, "events", (guild) => announceWeekend(guild));
  });
}

// GC: sweep a Tier-2 event past its deadline (activeMultiplier already ignores
// it — this just tidies the store so it doesn't linger until the next start).
// System-wide, so it runs once per tick rather than once per guild.
function sweepExpiredEvent(): void {
  const settings = loadGlobalSettings();
  if (settings.activeEvent && Date.now() >= settings.activeEvent.until) {
    saveGlobalSettings({ ...settings, activeEvent: null });
  }
}

// Weekend x2: announce once per ISO week, per server. lastWeekendAnnounced is
// only a dedup key — the multiplier is derived from the clock, not from it.
async function announceWeekend(guild: Guild): Promise<void> {
  if (!loadGlobalSettings().weekendDouble || !isVietnamWeekend()) return;
  const settings = loadSettings(guild.id);
  const week = isoWeek(new Date());
  if (settings.lastWeekendAnnounced === week) return;

  // Commit the dedup key BEFORE announcing, like the xoso draw: a send hiccup
  // can then only drop the announce, never trigger a re-announce loop next tick.
  saveSettings(guild.id, { ...settings, lastWeekendAnnounced: week });

  const channel = await resolveAnnounceChannel(guild);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle("🎉 Cuối tuần x2 coin!")
    .setDescription("Cuối tuần rồi bro — **điểm danh** và **coin voice/Go Live** đều nhân đôi. Tranh thủ cày nhé! 🔥")
    .setColor(0xffd700);
  await channel.send({ embeds: [embed] }).catch((error) => {
    console.error(`[events] weekend announce failed in guild ${guild.id}:`, error);
  });
}

// ISO-8601 week label ("2026-W27") for `now`, computed in Asia/Ho_Chi_Minh.
// Used only as the once-per-week dedup key, so it just needs to be stable within
// a week and roll over on the Monday boundary.
function isoWeek(now: Date): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const d = new Date(`${ymd}T00:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // the Thursday of this week fixes the ISO year
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4)); // Jan 4 is always in ISO week 1
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
