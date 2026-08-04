// HTTP status server on :8080 — health surface for the localhost-8080.aiocean.dev tunnel,
// plus the PoE OAuth callback (the one route with side effects). Everything else about
// the bot talks to Discord over the gateway.

import type { Client } from "discord.js";
import { commands } from "./commands/index";
import { config } from "./config";
import { completeAuth, poeCallbackPath } from "./poe";
import { buildSnapshot, expiredPage, renderPage, verifyLink } from "./rpg-web";
import { renderWikiPage } from "./wiki-web";
import { allocateNode, deallocateNode, equipCore, respecPassives, unequipCore } from "./commands/rpg";
import { loadCharacters } from "./rpg-store";
import type { GearSlot } from "./rpg";

const startedAt = Date.now();

// The rendered wiki page. The document depends only on static catalogs + config, so one
// render serves the whole process lifetime; a deploy is what publishes new content.
//
// It is served with an ETag and must-revalidate rather than a long max-age. A long max-age
// was the first attempt and it is wrong for this page: the content changes on every deploy,
// so a reader who opened the wiki an hour before a fix keeps being served the broken copy —
// which is exactly how a shipped font fix appeared not to have shipped. Revalidation costs
// one conditional request and returns 304 (no body) whenever the page is unchanged.
let wikiHtml: string | null = null;
let wikiEtag: string | null = null;

function uptime(): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Landing page after the pathofexile.com redirect — same card style as the status page.
function poeResultPage(ok: boolean, message: string): Response {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${config.botUsername} — Path of Exile</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #1e1f22; color: #dbdee1; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { background: #2b2d31; border-radius: 12px; padding: 32px 40px; max-width: 460px; text-align: center; }
  h1 { font-size: 40px; margin: 0 0 16px; }
  p { font-size: 15px; line-height: 1.6; margin: 0; }
</style>
</head>
<body>
<div class="card">
  <h1>${ok ? "✅" : "😵"}</h1>
  <p>${escapeHtml(message)}</p>
  <p style="margin-top: 16px; color: #949ba4;">Đóng tab này và quay lại Discord nhé bro.</p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /rpg/* — the interactive passive-tree + inventory web page (src/rpg-web.ts). Owner-
// scoped via a 30-min signed token in the URL path; the WRITE cores are the same
// synchronous load→validate→save ones the Discord handlers use, so browser and Discord
// share one source of truth and can't race (single process, single machine). This whole
// block is matched FIRST in the fetch handler, above the blanket POST→501 branch.
// ─────────────────────────────────────────────────────────────────────────────

// no-referrer so the page's font/CDN sub-requests never carry the path-token in a Referer.
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" } as const;

// Per-user cooldown on the one expensive side effect (saveCharacters = sync fsync on the
// Fly volume) so a POST loop can't stall the event loop. Modeled on poe.ts throttleGggCall;
// in-memory, clears on restart (fine — it's abuse protection, not correctness).
const rpgActCooldownUntil = new Map<string, number>();
const RPG_ACT_COOLDOWN_MS = 1000;
function rpgActAllowed(userId: string): boolean {
  const now = Date.now();
  if (now < (rpgActCooldownUntil.get(userId) ?? 0)) return false;
  rpgActCooldownUntil.set(userId, now + RPG_ACT_COOLDOWN_MS);
  return true;
}

async function handleRpgWeb(req: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean); // ["rpg", <area>, <arg>, ...]
  const area = parts[1];
  const token = parts[2] ?? "";

  // Static item art — GET /rpg/asset/item/<name>.png (name guarded, no traversal).
  if (req.method === "GET" && area === "asset" && parts[2] === "item" && parts[3]) {
    const name = decodeURIComponent(parts[3]).replace(/\.png$/, "");
    if (!/^[a-z0-9-]+$/.test(name)) return new Response("Not found", { status: 404 });
    const file = Bun.file(`${import.meta.dir}/../assets/items/${name}.png`);
    if (await file.exists()) return new Response(file, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    return new Response("Not found", { status: 404 });
  }

  // Page — GET /rpg/tree/<token> | /rpg/inv/<token>.
  if (req.method === "GET" && (area === "tree" || area === "inv")) {
    const auth = verifyLink(token);
    const profile = auth ? loadCharacters()[auth.userId] : undefined;
    if (!auth || !profile) return new Response(expiredPage(), { status: 401, headers: HTML_HEADERS });
    return new Response(renderPage(area, buildSnapshot(profile), token), { headers: HTML_HEADERS });
  }

  // State snapshot — GET /rpg/state/<token>.
  if (req.method === "GET" && area === "state") {
    const auth = verifyLink(token);
    const profile = auth ? loadCharacters()[auth.userId] : undefined;
    if (!auth || !profile) return Response.json({ ok: false, error: "expired" }, { status: 401 });
    return Response.json(buildSnapshot(profile));
  }

  // Mutate — POST /rpg/act/<token> {op:"alloc"|"equip"|"unequip", …}. JSON-only (forces a
  // CORS preflight a cross-origin page can't satisfy); no Access-Control-Allow-Origin sent.
  if (req.method === "POST" && area === "act") {
    const auth = verifyLink(token);
    if (!auth) return Response.json({ ok: false, error: "Link hết hạn" }, { status: 401 });
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
      return Response.json({ ok: false, error: "Cần JSON" }, { status: 415 });
    }
    if (!rpgActAllowed(auth.userId)) return Response.json({ ok: false, error: "Chậm thôi bro" }, { status: 429 });

    let body: { op?: string; nodeId?: unknown; itemId?: unknown; slot?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json({ ok: false, error: "Body lỗi" }, { status: 400 });
    }

    let err: string | null = null;
    if (body.op === "alloc") {
      if (typeof body.nodeId !== "string") err = "Thiếu nodeId";
      else {
        const r = allocateNode(auth.guildId, auth.userId, body.nodeId);
        if (!r.ok) err = r.reason;
      }
    } else if (body.op === "dealloc") {
      if (typeof body.nodeId !== "string") err = "Thiếu nodeId";
      else {
        const r = deallocateNode(auth.guildId, auth.userId, body.nodeId);
        if (!r.ok) err = r.reason;
      }
    } else if (body.op === "respec") {
      const r = respecPassives(auth.guildId, auth.userId);
      if (!r.ok) err = r.reason;
    } else if (body.op === "equip") {
      if (typeof body.itemId !== "string") err = "Thiếu itemId";
      else {
        const r = equipCore(auth.userId, body.itemId);
        if ("error" in r) err = r.error;
      }
    } else if (body.op === "unequip") {
      if (typeof body.slot !== "string") err = "Thiếu slot";
      else {
        const r = unequipCore(auth.userId, body.slot as GearSlot);
        if ("error" in r) err = r.error;
      }
    } else {
      err = "Thao tác không hợp lệ";
    }
    if (err) return Response.json({ ok: false, error: err });

    const after = loadCharacters()[auth.userId];
    if (!after) return Response.json({ ok: false, error: "Chưa có nhân vật" }, { status: 401 });
    return Response.json({ ok: true, state: buildSnapshot(after) });
  }

  return new Response("Not found", { status: 404 });
}

export function startStatusServer(client: Client): void {
  const port = config.port;

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // RPG web page (passive tree + inventory) — matched first so its POST /rpg/act
      // route isn't swallowed by the blanket POST→501 branch below.
      if (url.pathname.startsWith("/rpg/")) return handleRpgWeb(req, url);

      // PoE OAuth callback — GGG redirects here after the user logs in.
      // The route only exists while the feature is configured (POE_* env vars).
      if (req.method === "GET" && poeCallbackPath() !== null && url.pathname === poeCallbackPath()) {
        const denied = url.searchParams.get("error");
        if (denied) {
          return poeResultPage(false, `Đăng nhập bị hủy (${denied}). Muốn thử lại thì mở /poe bấm Kết nối nhé.`);
        }
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return poeResultPage(false, "Thiếu tham số code/state — link không hợp lệ.");
        try {
          const { accountName } = await completeAuth(state, code);
          return poeResultPage(true, `Đã kết nối account ${accountName} với ${config.botUsername}!`);
        } catch (error) {
          console.error("[poe] callback failed:", error);
          return poeResultPage(false, error instanceof Error ? error.message : "Có lỗi khi kết nối.");
        }
      }

      if (req.method === "POST") {
        // The Discord Interactions Endpoint URL must stay EMPTY in the Developer
        // Portal — this bot receives interactions over the gateway, not webhooks.
        return Response.json(
          {
            error:
              "Webhook interactions mode is not enabled. Clear the Interactions Endpoint URL in the Discord Developer Portal — this bot handles everything over the gateway.",
          },
          { status: 501 },
        );
      }

      // Public wiki (GET /wiki) — the game's own manual, generated from the live catalogs
      // (src/wiki.ts). Fully static: no auth, no per-user state, identical for everyone, so
      // it is rendered once on first hit and served from memory afterwards.
      if (req.method === "GET" && (url.pathname === "/wiki" || url.pathname === "/wiki/")) {
        if (wikiHtml === null) {
          wikiHtml = renderWikiPage();
          wikiEtag = `W/"${Bun.hash(wikiHtml).toString(36)}"`;
        }
        const headers = {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=0, must-revalidate",
          etag: wikiEtag!,
        };
        // Unchanged since the reader's last visit → 304, no body. A deploy changes the hash,
        // so the very next request gets the new page instead of a stale cached one.
        if (req.headers.get("if-none-match") === wikiEtag) return new Response(null, { status: 304, headers });
        return new Response(wikiHtml, { headers });
      }

      if (url.pathname === "/health") {
        return Response.json({
          ok: client.isReady(),
          bot: client.user?.tag ?? null,
          uptime: uptime(),
          model: config.model,
          guilds: client.guilds.cache.size,
          commands: [...commands.keys()],
        });
      }

      if (url.pathname === "/") {
        const online = client.isReady();
        const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${config.botUsername} — status</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #1e1f22; color: #dbdee1; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { background: #2b2d31; border-radius: 12px; padding: 32px 40px; max-width: 460px; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${online ? "#23a55a" : "#f23f43"}; margin-right: 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; font-size: 14px; }
  dt { color: #949ba4; }
  dd { margin: 0; }
  a { color: #00a8fc; }
</style>
</head>
<body>
<div class="card">
  <h1><span class="dot"></span>${config.botUsername}</h1>
  <dl>
    <dt>Status</dt><dd>${online ? `online — ${client.user?.tag}` : "connecting..."}</dd>
    <dt>Uptime</dt><dd>${uptime()}</dd>
    <dt>Model</dt><dd>${config.model}</dd>
    <dt>Servers</dt><dd>${client.guilds.cache.size}</dd>
    <dt>Commands</dt><dd>${[...commands.keys()].map((n) => `/${n}`).join(" ")}</dd>
    ${config.installUrl ? `<dt>Invite</dt><dd><a href="${config.installUrl}">Add to server</a></dd>` : ""}
  </dl>
</div>
</body>
</html>`;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`🌐 Status page: http://localhost:${port}/`);
}
