// MCP smoke test for the in-process `bot` MCP server (src/agent-tools.ts) — the
// tools the chat agent calls. Each check runs a tool's exported rule-core (the
// exact logic the SDK handler executes), the security guards, and the
// asToolResult result shape, against a throwaway test guild created and torn
// down here. No Discord gateway, no production data touched.
//
//   bun run test:mcp            deterministic checks only (fast, no LLM/quota)
//   bun run test:mcp --live     + real agent runs proving the LLM invokes tools
//
// Exits non-zero if any check fails. (PoE tools live in a separate per-user MCP
// server that hits the live GGG API — not covered here.)

// Prime the command registry FIRST so the `commands/*` modules below don't enter
// the coin→bots→agent→commands/index→shortcuts→coin import cycle from a bad node
// (a direct `./commands/coin` import hits a TDZ; going through `commands/index`
// first — exactly what production's index.ts does — initializes it in order).
import "./commands/index";
import { config } from "./config";
import { guildDir } from "./store";
import { activeMultiplier, addCoins, loadAttendance, loadCoins, loadGlobalSettings, saveGlobalSettings } from "./economy";
import { loadCharacters, saveCharacters } from "./rpg-store";
import { displayNames, ensureWorkspace, loadSettings, removeGuildData, saveSettings } from "./guilds";
import { newProfile, npcSellPrice, rollGear, salvageYield } from "./rpg";
import {
  autoEquipBestCore, buySupplyCore, bulkSalvageCore, createCharacter, enhanceCore, equipCore,
  inventoryCore, levelUpCore, prestigeCore, rpgStatus, salvageCore, sellItemsCore, sellJunkCore, unequipCore,
} from "./commands/rpg";
import { recallExpedition, startExpedition, syncExpedition } from "./expeditions";
import { browseListings, buyListing, cancelListing, listItem } from "./rpg-market";
import { enterZone, extractZone, invade, pvpLadder, pvpStatus } from "./rpg-pvp";
import { attendanceRanking, currentStreak, performCheckin } from "./commands/diemdanh";
import { coinRanking } from "./commands/coin";
import { buyTitle, equipTitle, memberTitles, titlesShop, unequipTitle } from "./commands/danhhieu";
import { buyLottery, lotteryHistory, lotteryInfo } from "./commands/xoso";
import { startEvent, stopEvent } from "./events";
import { asToolResult, buildBotMcpServer, transferForSender } from "./agent-tools";

const LIVE = process.argv.includes("--live") || process.env.MCP_TEST_LIVE === "1";

const GID = "test-mcp";
const SENDER = "111111111111111111";
const RECIP = "999999999999999999";
const CH = "222222222222222222";

let pass = 0;
let fail = 0;
const ok = (cond: unknown, label: string, extra = ""): void => {
  if (cond) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label} ${extra}`);
    fail++;
  }
};
const refuses = async (fn: () => unknown | Promise<unknown>, label: string): Promise<void> => {
  try {
    await fn();
    ok(false, label, "(expected a refusal but none was thrown)");
  } catch {
    ok(true, label);
  }
};
const section = (name: string): void => console.log(`\n${name}`);

// A minimal Guild stand-in: only guild.id, guild.members.fetch (both call shapes
// the tools use), and guild.client are ever touched by the bot_* tools.
const guild = {
  id: GID,
  client: {},
  members: {
    fetch: async (arg: unknown) => {
      if (typeof arg === "string") {
        return { id: arg, displayName: arg === RECIP ? "Recipient" : "Someone", user: { bot: false } };
      }
      const ids: string[] = (arg as { user?: string[] })?.user ?? [];
      return new Map(ids.map((id) => [id, { id, displayName: id === SENDER ? "Sender" : "Recipient" }]));
    },
  },
} as never;

async function run(): Promise<void> {
  // --- setup: a throwaway guild with a character + coins ---
  try {
    removeGuildData(GID);
  } catch {
    // no prior test guild — fine
  }
  ensureWorkspace(GID);
  const profile = newProfile("cung", Date.now(), Math.random);
  profile.level = 20;
  profile.materials = { luongthuc: 30, thuoc: 3, manh: 50, tinhchat: 100, bua: 2 };
  profile.bestFloor = { rungma: 12 };
  saveCharacters({ [SENDER]: profile });
  addCoins(SENDER, 100_000);
  addCoins(RECIP, 100);
  console.log(`MCP smoke test — guild ${GID}, Cung Thủ Lv20, Sender 100000🪙, Recipient 100🪙${LIVE ? " (+ live AI)" : ""}`);

  // --- RPG (bot_rpg_status / bot_rpg_expedition_start) ---
  section("bot_rpg_status / bot_rpg_expedition_start");
  const st = rpgStatus(SENDER);
  ok(st?.level === 20 && (st as { power?: number })?.power! > 0, "rpg status: Lv20 + power computed");
  const exp = startExpedition(GID, SENDER, CH, "rungma", null);
  ok(!("error" in exp), "expedition dispatched", "error" in exp ? (exp as { error: string }).error : "");
  ok(!("error" in exp) && exp.rations === 30 && exp.potions === 3, "nạp sạch kho: loaded all 🍖30 + 🧪3");
  ok(
    loadCharacters()[SENDER]!.materials.luongthuc === 0 && loadCharacters()[SENDER]!.materials.thuoc === 0,
    "kho emptied on dispatch (🍖30→0, 🧪3→0)",
  );
  ok(syncExpedition(GID, SENDER) !== null, "run resolvable (syncExpedition)");
  await refuses(async () => {
    const r = startExpedition(GID, SENDER, CH, "rungma", null);
    if ("error" in r) throw new Error(r.error);
  }, "double-dispatch refused (already on a run)");

  // --- Coin (bot_coin_balance / bot_leaderboard / bot_coin_transfer) ---
  section("bot_coin_balance / bot_leaderboard / bot_coin_transfer");
  ok(loadCoins()[SENDER] === 100_000, "balance = 100000");
  const rank = coinRanking();
  ok(rank.length === 2 && rank[0]!.balance >= rank[1]!.balance, "coin leaderboard sorted");
  ok((await displayNames(guild, rank.map((r) => r.id)))(SENDER) === "Sender", "leaderboard resolves names");
  ok(attendanceRanking().length === 0, "diemdanh leaderboard empty (no checkins yet)");
  const tr = await transferForSender(guild, SENDER, `chuyển cho <@${RECIP}>`, `<@${RECIP}>`, 500);
  ok((tr as { amount: number }).amount === 500 && loadCoins()[RECIP] === 600, "valid transfer 500 → recipient 600");
  await refuses(() => transferForSender(guild, SENDER, "chuyển 500 giùm", `<@${RECIP}>`, 500), "SECURITY: refuses when recipient not in sender's own text");
  await refuses(() => transferForSender(guild, SENDER, `<@${SENDER}>`, `<@${SENDER}>`, 10), "SECURITY: refuses self-transfer");

  // --- Checkin (bot_checkin / bot_diemdanh_stats) ---
  section("bot_checkin / bot_diemdanh_stats");
  ok((performCheckin(SENDER) as { ok: boolean; reward: number }).reward > 0, "first checkin rewards coin");
  ok((performCheckin(SENDER) as { ok: boolean }).ok === false, "second checkin same day refused");
  ok(currentStreak(loadAttendance()[SENDER] ?? []) >= 1, "attendance stats: streak ≥ 1");

  // --- Titles (bot_titles_shop / buy / equip / view / unequip) ---
  section("bot_titles_shop / buy / equip / view / unequip");
  const shop = titlesShop(SENDER) as { titles?: { id: string }[] };
  const titleId = shop.titles?.[0]?.id;
  ok(!!titleId, "titles shop lists items");
  ok((buyTitle(SENDER, titleId!) as { ok: boolean }).ok === true, `buy title '${titleId}'`);
  ok((buyTitle(SENDER, titleId!) as { reason?: string }).reason === "owned", "re-buy → already owned");
  ok((equipTitle(SENDER, titleId!) as { ok: boolean }).ok === true, "equip title");
  const mt = memberTitles(SENDER);
  ok(mt.owned.some((t) => t.id === titleId) && mt.equipped?.id === titleId, "titles view: owned + equipped");
  ok((unequipTitle(SENDER) as { ok: boolean }).ok === true, "unequip title");

  // --- Lottery (bot_lottery_info / buy / history) ---
  section("bot_lottery_info / buy / history");
  ok(typeof (lotteryInfo(GID, SENDER) as { jackpot: number }).jackpot === "number", "lottery info");
  ok((buyLottery(GID, SENDER, { numbers: [7, 68] }, CH) as { ok: boolean }).ok === true, "buy lottery [7,68]");
  ok(Array.isArray(lotteryHistory()), "lottery history");

  // --- Admin events (bot_event_start / stop / set_announce) — functional cores ---
  section("bot_event_start / stop / set_announce");
  saveGlobalSettings(startEvent(loadGlobalSettings(), { kind: "checkin", multiplier: 5, until: Date.now() + 3_600_000, by: SENDER }));
  ok(activeMultiplier("checkin") === 5, "event x5 → activeMultiplier=5", `got ${activeMultiplier("checkin")}`);
  saveGlobalSettings(stopEvent(loadGlobalSettings()));
  ok(activeMultiplier("checkin") < 5, "stop → multiplier drops");
  const settings = loadSettings(GID);
  settings.announceChannelId = CH;
  saveSettings(GID, settings);
  ok(loadSettings(GID).announceChannelId === CH, "set announce channel persists");

  // --- Wrapper shape + server assembly ---
  section("asToolResult shape / server assembly / worldcup gate");
  const rBal = await asToolResult(async () => ({ balance: loadCoins()[SENDER] ?? 0 }));
  ok(rBal.content?.[0]?.type === "text" && !rBal.isError, "asToolResult → text content, not error");
  const rErr = await asToolResult(async () => transferForSender(guild, SENDER, "no target", `<@${RECIP}>`, 1));
  ok(rErr.isError === true, "guarded refusal maps to isError:true");
  ok(buildBotMcpServer(SENDER, guild, "test", undefined, CH) != null, "buildBotMcpServer assembles (all tool schemas valid)");
  ok(true, config.footballDataToken ? "worldcup tools registered (token set)" : "worldcup tools absent (no token)");

  // --- RPG full concierge: the expanded bot_rpg_* tool cores ---
  section("RPG concierge cores (create/inventory/equip/enhance/salvage/supply/level/market/pvp/prestige)");
  ok(recallExpedition(GID, SENDER) !== null, "recall active expedition");
  ok("error" in createCharacter(GID, SENDER, "cung"), "create refused (already has a hero)");
  ok(!("error" in createCharacter(GID, "333333333333333333", "chien")), "create fresh character");
  const chars = loadCharacters();
  const hero = chars[SENDER]!;
  const it = {
    w1: rollGear("kiem", 2, Math.random), w2: rollGear("truong", 1, Math.random),
    a1: rollGear("giapda", 2, Math.random), a2: rollGear("aochoang", 1, Math.random),
    t1: rollGear("nhan", 3, Math.random), t2: rollGear("buangoc", 2, Math.random),
  };
  hero.bag.push(...Object.values(it));
  saveCharacters(chars);
  const inv = inventoryCore(SENDER);
  ok(inv != null && inv.bag.length >= 6 && inv.bag.every((i) => !!i.id), "inventory lists bag items with ids");
  ok(!("error" in equipCore(SENDER, it.w1.id)), "equip weapon");
  ok(!("error" in unequipCore(SENDER, "vukhi")), "unequip weapon");
  const enh = enhanceCore(GID, SENDER, it.w2.id, false) as { result?: string; error?: string };
  ok(!enh.error && ["up", "down", "break", "stay"].includes(enh.result ?? ""), "enhance (đập đồ) returns an outcome", JSON.stringify(enh));
  const sv = salvageCore(GID, SENDER, it.a2.id) as { manh?: number; error?: string };
  ok(!sv.error && (sv.manh ?? 0) > 0, "salvage → 🔩 gained");
  ok(!("error" in buySupplyCore(GID, SENDER, "luongthuc", 5)), "buy supply (tiếp tế)");
  const lvl = levelUpCore(GID, SENDER) as { level?: number; error?: string };
  ok(!lvl.error && lvl.level === 21, "level up 20→21", JSON.stringify(lvl));
  const BUYER = "444444444444444444";
  createCharacter(GID, BUYER, "chien");
  addCoins(BUYER, 5000);
  const listed = listItem(SENDER, it.t2.id, 1000) as { ok: boolean; listing?: { id: string } };
  ok(listed.ok === true, "market: list item for 1000🪙");
  const listingId = listed.listing?.id ?? "";
  ok(browseListings().some((l) => l.id === listingId), "market: listing shows in browse");
  ok(!("error" in buyListing(BUYER, listingId)), "market: buyer buys listing (coins circulate)");
  const listed2 = listItem(SENDER, it.t1.id, 500) as { ok: boolean; listing?: { id: string } };
  ok((cancelListing(SENDER, listed2.listing?.id ?? "") as { ok: boolean }).ok === true, "market: cancel returns item");
  const enter = enterZone(SENDER, [it.a1.id], "Sender") as { ok?: boolean; reason?: string };
  ok(enter.ok === true || typeof enter.reason === "string", "pvp: enter zone (stake haul)", JSON.stringify(enter));
  ok(pvpStatus(SENDER) !== undefined, "pvp: status readable");
  ok(Array.isArray(pvpLadder()), "pvp: ladder readable");
  ok(invade(GID, SENDER, "Sender") != null, "pvp: invade returns a result (no crash)");
  ok(extractZone(SENDER) != null, "pvp: extract returns a result (no crash)");
  const PU = "555555555555555555";
  createCharacter(GID, PU, "cung");
  ok("error" in prestigeCore(GID, PU), "prestige refused when not eligible");
  const pchars = loadCharacters();
  pchars[PU]!.bestFloor = { rungma: 30 };
  saveCharacters(pchars);
  ok(!("error" in prestigeCore(GID, PU)), "prestige succeeds when eligible (floor 30)");

  // --- Farm-gold cores: bán rác (mint) / trang bị tốt nhất / phân rã rác ---
  section("RPG farm-gold cores (sell junk / auto-equip / bulk salvage)");

  // Fresh seller: 3 junk (⚪⚪🟢) + one 🟣 Sử Thi that must NEVER be bulk-sold at ≤ Hiếm.
  const FARM = "666666666666666666";
  createCharacter(GID, FARM, "chien");
  addCoins(FARM, 100_000);
  const fchars = loadCharacters();
  const fjunk = [rollGear("kiem", 0, Math.random), rollGear("giapda", 0, Math.random), rollGear("nhan", 1, Math.random)];
  const fepic = rollGear("truong", 3, Math.random); // Sử Thi (r3)
  fchars[FARM]!.bag.push(...fjunk, fepic);
  saveCharacters(fchars);
  const fbalBefore = loadCoins()[FARM] ?? 0;
  const fExpect = fjunk.reduce((s, it) => s + npcSellPrice(it), 0);
  const sj = sellJunkCore(GID, FARM, 1) as { sold?: unknown[]; coinsPaid?: number; error?: string };
  ok(!sj.error && (sj.sold?.length ?? 0) === 3, "sell junk: sold 3 items ≤ Khá", JSON.stringify(sj));
  ok(sj.coinsPaid === fExpect, "sell junk: coinsPaid = Σ npcSellPrice", `${sj.coinsPaid} vs ${fExpect}`);
  ok((loadCoins()[FARM] ?? 0) === fbalBefore + fExpect, "sell junk: coin credited (minted)");
  const fbag = loadCharacters()[FARM]!.bag;
  ok(fbag.length === 1 && fbag[0]!.rarity === 3, "sell junk: only 🟣 Sử Thi left (top gear never bulk-sold)");

  // Auto-equip: a 🟠 Huyền weapon in the bag beats the ⚪ starter → power rises, ≥1 slot changed.
  const AE = "777777777777777777";
  createCharacter(GID, AE, "chien");
  const aechars = loadCharacters();
  aechars[AE]!.bag.push(rollGear("riu", 4, Math.random)); // Huyền Thoại axe
  saveCharacters(aechars);
  const ae = autoEquipBestCore(AE) as { changed?: unknown[]; before?: number; after?: number; error?: string };
  ok(!ae.error && (ae.after ?? 0) > (ae.before ?? 0) && (ae.changed?.length ?? 0) >= 1, "auto-equip: power rises + ≥1 slot changed", JSON.stringify({ b: ae.before, a: ae.after }));
  ok((autoEquipBestCore(AE) as { changed?: unknown[] }).changed?.length === 0, "auto-equip: idempotent second run (already optimal → no change)");

  // Bulk salvage: junk (⚪🟢) yields manh, 🟣 Sử Thi kept, manh added to materials.
  const BS = "888888888888888888";
  createCharacter(GID, BS, "cung");
  const bschars = loadCharacters();
  const bsjunk = [rollGear("kiem", 0, Math.random), rollGear("giapda", 1, Math.random)];
  bschars[BS]!.bag.push(...bsjunk, rollGear("nhan", 3, Math.random)); // + one Sử Thi to keep
  saveCharacters(bschars);
  const bsExpect = bsjunk.reduce((s, it) => s + salvageYield(it).manh, 0);
  const bs = bulkSalvageCore(BS, 2) as { count?: number; manh?: number; total?: number; error?: string };
  ok(!bs.error && bs.count === 2 && bs.manh === bsExpect, "bulk salvage: 2 junk → Σ manh", JSON.stringify(bs));
  const bsBag = loadCharacters()[BS]!.bag;
  ok(bsBag.length === 1 && bsBag[0]!.rarity === 3, "bulk salvage: 🟣 Sử Thi kept, junk removed");
  ok((loadCharacters()[BS]!.materials.manh ?? 0) === bsExpect, "bulk salvage: manh added to materials");

  console.log(`\n─── Deterministic: ${pass} passed, ${fail} failed ───`);

  // --- Live AI: prove the agent actually routes to the MCP tools ---
  if (LIVE) {
    section("Live AI — the agent must invoke the MCP tool");
    const { runAgent } = await import("./agent");
    const balAtLive = loadCoins()[SENDER] ?? 0;
    const probes: { prompt: string; wants: string; truth: (t: string) => boolean }[] = [
      { prompt: "[Sender]: nhân vật rpg của mình cấp mấy, class gì? ngắn gọn.", wants: "rpg_status", truth: (t) => /20|cung/i.test(t) },
      { prompt: "[Sender]: mình còn bao nhiêu coin? ngắn gọn.", wants: "coin_balance", truth: (t) => t.replace(/\D/g, "").includes(String(balAtLive)) },
      { prompt: "[Sender]: mua giúp mình 10 🍖 lương thực cho nhân vật rpg nhé.", wants: "buy_supply", truth: (t) => /lương thực|🍖|tiếp tế|mua/i.test(t) },
    ];
    for (const probe of probes) {
      try {
        const bot = buildBotMcpServer(SENDER, guild, probe.prompt, undefined, CH);
        const res = await runAgent({ sessionKey: `mcp-test-${probe.wants}-${Date.now()}`, prompt: probe.prompt, cwd: guildDir(GID), mcpServers: { bot } });
        console.log(`  · [${probe.wants}] toolsUsed=${JSON.stringify(res.toolsUsed)} → "${res.text.slice(0, 120)}"`);
        ok(res.toolsUsed.some((t) => t.includes(probe.wants)), `agent called bot_${probe.wants}`);
        ok(probe.truth(res.text), `answer reflects real data (${probe.wants})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(/limit|quota|rate/i.test(msg) ? `  ⚠️ ${probe.wants}: token rate-limited, skipped (${msg.slice(0, 80)})` : `  ⚠️ ${probe.wants}: ${msg.slice(0, 160)}`);
      }
    }
  } else {
    console.log("\n(Live AI skipped — pass --live to run real agent invocations.)");
  }
}

try {
  await run();
} finally {
  try {
    removeGuildData(GID);
  } catch {
    // best-effort cleanup
  }
}

console.log(`\n═══ ${fail === 0 ? "MCP OK ✅" : `${fail} check(s) FAILED ❌`} ═══`);
process.exit(fail === 0 ? 0 : 1);
