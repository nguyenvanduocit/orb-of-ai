// WIKI web presentation — the public HTML page served at GET /wiki (src/server.ts).
//
// This module owns ONE concern: turning the WikiSection tree from src/wiki.ts into a single
// self-contained HTML document. It knows nothing about the game; every number on the page
// came from the model, which read the live catalogs. Adding a system to the game means
// editing wiki.ts only — this file never changes.
//
// STATIC by design: no auth, no token, no per-user state, no server round-trips. The whole
// document is one string that depends only on static catalogs + config, so server.ts renders
// it once and serves the cached copy to everyone. Search and nav are client-side.
//
// Aesthetic deliberately matches src/rpg-web.ts (obsidian + nebula, engraved gold Cinzel
// display type) — a player moving between the passive-tree page and the wiki should feel one
// product. The only external fetch is the Google Fonts stylesheet.

import { config } from "./config";
import type { WikiBlock, WikiSection } from "./wiki";
import { wikiDoc } from "./wiki";

const esc = (s: string): string =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// The model writes prose with the three markdown marks that carry meaning here: **emphasis**
// for the number or rule that matters, *italics* for a term being named, and `code` for a
// command. Escape first, then promote — so content can never inject markup.
//
// Order matters: bold runs first and consumes its asterisks, so the single-asterisk pass that
// follows can only match real italics. Miss that pass and the page prints "*nhàn tay*" with
// the asterisks showing, which is exactly what it did.
export function inline(text: string): string {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function blockHtml(b: WikiBlock): string {
  switch (b.kind) {
    case "p":
      return `<p>${inline(b.text)}</p>`;
    case "list":
      return `<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
    case "note":
      return `<aside class="note">${inline(b.text)}</aside>`;
    case "table":
      // Wrapped in its own scroller: a wide table must never make the PAGE scroll sideways.
      return `<div class="tw"><table><thead><tr>${b.headers
        .map((h) => `<th>${inline(h)}</th>`)
        .join("")}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`;
  }
}

// Everything a section says, flattened to one lowercase haystack for client-side search.
// The markdown marks are stripped: a reader searches for what they SEE, so the index must
// hold "cửa ải", never "**cửa ải**".
function searchText(s: WikiSection): string {
  const parts = [s.title, s.blurb];
  for (const b of s.blocks) {
    if (b.kind === "p" || b.kind === "note") parts.push(b.text);
    else if (b.kind === "list") parts.push(...b.items);
    else parts.push(...b.headers, ...b.rows.flat());
  }
  return parts.join(" ").replaceAll("*", "").replaceAll("`", "").toLowerCase();
}

function sectionHtml(s: WikiSection, sub: boolean): string {
  const tag = sub ? "h3" : "h2";
  return `<section class="sec${sub ? " sub" : ""}" id="${esc(s.id)}" data-q="${esc(searchText(s))}">
  <${tag}><a class="anchor" href="#${esc(s.id)}"><span class="em">${s.emoji}</span>${esc(s.title)}</a></${tag}>
  <p class="blurb">${inline(s.blurb)}</p>
  ${s.blocks.map(blockHtml).join("\n  ")}
  ${(s.subs ?? []).map((x) => sectionHtml(x, true)).join("\n")}
</section>`;
}

function navHtml(doc: WikiSection[]): string {
  return doc
    .map(
      (s) => `<div class="navgroup">
      <a class="navtop" href="#${esc(s.id)}"><span class="em">${s.emoji}</span>${esc(s.title)}</a>
      ${(s.subs ?? [])
        .map((x) => `<a class="navsub" href="#${esc(x.id)}">${esc(x.title)}</a>`)
        .join("")}
    </div>`,
    )
    .join("");
}

export function renderWikiPage(): string {
  const doc = wikiDoc();
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Cẩm nang ${esc(config.botUsername)} — coin, minigame, Cửa Ải: luật chơi, tỉ lệ và mọi con số.">
<title>Cẩm nang ${esc(config.botUsername)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;900&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>
<header>
  <a class="brand" href="#top"><span class="orn">✦</span><span class="brand-name">Cẩm nang</span><span class="orn">✦</span></a>
  <div class="searchwrap">
    <input id="q" type="search" placeholder="Tìm trong cẩm nang — thử &quot;cường hóa&quot;, &quot;roulette&quot;, &quot;unique&quot;…" autocomplete="off" spellcheck="false">
  </div>
  <button id="menu" class="menu" aria-label="Mục lục">☰</button>
</header>
<div class="shell">
  <nav id="nav">${navHtml(doc)}</nav>
  <main id="top">
    <div id="empty" class="empty hidden">Không tìm thấy gì khớp — thử từ khoá khác nhé bro.</div>
    ${doc.map((s) => sectionHtml(s, false)).join("\n")}
    <footer>
      <p>Trang này sinh thẳng từ mã nguồn đang chạy của bot — mọi tỉ lệ và con số ở trên là con số engine thật sự dùng.</p>
      <p><a href="/">Trạng thái bot</a></p>
    </footer>
  </main>
</div>
<script>${PAGE_JS}</script>
</body>
</html>`;
}

const PAGE_CSS = `
:root{
  --ink:#0a0a10;--gold:#c9a44c;--gold-hi:#ecd493;--gold-dim:#8a7233;
  --ember:#e07b3a;--arcane:#6ee29a;--ivory:#ece2cd;--muted:#a2957c;
  --edge:rgba(201,164,76,.22);--panel:rgba(26,23,36,.72);
  /* Display + body BOTH must cover Vietnamese. Cinzel (the obvious "engraved" choice) ships
     only latin + latin-ext, so every ắ/ệ/ữ in a heading fell back to a system serif and the
     page rendered half in one face, half in another. Playfair Display carries the vietnamese
     subset and keeps the high-contrast inscriptional feel; Spectral is the fallback rather
     than a system font, so even a failed webfont load stays diacritic-complete. */
  --disp:'Playfair Display','Spectral',Georgia,serif;--dispd:'Playfair Display','Spectral',Georgia,serif;--body:'Spectral',Georgia,serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:88px;scrollbar-color:var(--gold-dim) transparent}
body{margin:0;font-family:var(--body);color:var(--ivory);background:var(--ink);min-height:100vh;overflow-x:hidden;text-rendering:optimizeLegibility;line-height:1.68}
::selection{background:rgba(201,164,76,.32);color:#fff}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
    radial-gradient(1100px 820px at 50% 0%,rgba(96,66,150,.28),transparent 62%),
    radial-gradient(760px 640px at 50% 6%,rgba(150,110,48,.12),transparent 58%),
    radial-gradient(2px 2px at 12% 22%,rgba(255,244,214,.6),transparent),
    radial-gradient(1.5px 1.5px at 82% 16%,rgba(255,244,214,.5),transparent),
    radial-gradient(1.5px 1.5px at 68% 68%,rgba(220,210,255,.45),transparent),
    radial-gradient(2px 2px at 28% 74%,rgba(255,244,214,.45),transparent),
    radial-gradient(1px 1px at 44% 12%,rgba(255,255,255,.5),transparent),
    radial-gradient(1px 1px at 90% 60%,rgba(255,255,255,.45),transparent),
    var(--ink);}

/* ── header ─────────────────────────────────────────────────────────── */
header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:16px;padding:12px 22px;
  background:linear-gradient(180deg,rgba(12,10,18,.96),rgba(12,10,18,.78));backdrop-filter:blur(10px);
  border-bottom:1px solid var(--edge);box-shadow:0 8px 30px -18px rgba(0,0,0,.9)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;flex:none}
.brand-name{font-family:var(--dispd);font-weight:900;font-size:21px;letter-spacing:.04em;background:linear-gradient(180deg,#f4e2ab,#c9a44c 62%,#8a6a26);-webkit-background-clip:text;background-clip:text;color:transparent}
.orn{color:var(--gold-dim);font-size:11px}
.searchwrap{flex:1;max-width:560px;margin:0 auto}
#q{width:100%;font-family:var(--body);font-size:14.5px;color:var(--ivory);background:rgba(20,18,28,.7);
  border:1px solid var(--edge);border-radius:3px;padding:9px 14px;outline:none;transition:.18s}
#q::placeholder{color:#6f6a5b}
#q:focus{border-color:var(--gold-dim);box-shadow:0 0 20px -8px rgba(201,164,76,.6);background:rgba(26,23,36,.9)}
.menu{display:none;flex:none;background:rgba(20,18,28,.6);color:var(--gold-hi);border:1px solid var(--edge);border-radius:3px;font-size:17px;padding:6px 12px;cursor:pointer}

/* ── layout ─────────────────────────────────────────────────────────── */
.shell{display:flex;gap:34px;max-width:1360px;margin:0 auto;padding:0 22px}
nav{flex:0 0 262px;position:sticky;top:70px;align-self:flex-start;max-height:calc(100vh - 88px);overflow-y:auto;padding:22px 0 40px}
.navgroup{margin-bottom:16px}
.navtop{display:flex;align-items:center;gap:8px;font-family:var(--disp);font-weight:600;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--gold);text-decoration:none;padding:6px 10px;border-left:2px solid transparent;transition:.15s}
.navtop:hover{color:var(--gold-hi)}
.navsub{display:block;font-size:13.5px;color:var(--muted);text-decoration:none;padding:4px 10px 4px 30px;border-left:2px solid transparent;transition:.15s}
.navsub:hover{color:var(--ivory);border-left-color:var(--gold-dim)}
.navtop.on,.navsub.on{color:var(--gold-hi);border-left-color:var(--gold);background:linear-gradient(90deg,rgba(201,164,76,.10),transparent)}
.em{font-size:15px}

main{flex:1;min-width:0;padding:26px 0 90px}

/* ── sections ───────────────────────────────────────────────────────── */
.sec{margin:0 0 46px;scroll-margin-top:88px}
.sec.sub{margin:34px 0 0;padding-top:22px;border-top:1px solid rgba(201,164,76,.12)}
h2,h3{margin:0 0 4px;font-family:var(--disp);letter-spacing:.02em}
h2{font-size:29px}
h3{font-size:20px}
.anchor{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--gold-hi)}
h2 .anchor{background:linear-gradient(180deg,#f6e8bd,#c9a44c 78%);-webkit-background-clip:text;background-clip:text;color:transparent}
h2 .anchor .em,h3 .anchor .em{-webkit-text-fill-color:initial;color:initial}
h3 .anchor{color:#e2cf9d}
.anchor:hover{filter:brightness(1.14)}
.blurb{margin:0 0 18px;color:var(--muted);font-style:italic;font-size:15px}
p{margin:0 0 15px;max-width:78ch}
ul{margin:0 0 16px;padding-left:0;list-style:none;max-width:78ch}
li{position:relative;padding-left:20px;margin-bottom:8px}
li::before{content:"◆";position:absolute;left:2px;top:1px;color:var(--gold-dim);font-size:9px}
strong{color:var(--gold-hi);font-weight:600}
em{font-style:italic;color:#d8cbb0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;color:var(--arcane);
  background:rgba(110,226,154,.09);border:1px solid rgba(110,226,154,.2);border-radius:3px;padding:1px 6px;white-space:nowrap}
a{color:var(--gold)}

.note{margin:0 0 18px;max-width:78ch;padding:13px 17px;font-size:14.5px;color:#e6dcc6;
  background:linear-gradient(90deg,rgba(201,164,76,.10),rgba(201,164,76,.02));
  border:1px solid rgba(201,164,76,.26);border-left:3px solid var(--gold);border-radius:0 4px 4px 0}
.note strong{color:#f6e5b6}

/* ── tables ─────────────────────────────────────────────────────────── */
.tw{overflow-x:auto;margin:0 0 20px;border:1px solid var(--edge);border-radius:5px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:14px}
th{font-family:var(--disp);font-weight:600;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);
  text-align:left;padding:11px 14px;background:rgba(12,10,18,.6);border-bottom:1px solid var(--edge);white-space:nowrap}
td{padding:10px 14px;border-bottom:1px solid rgba(201,164,76,.09);vertical-align:top;line-height:1.55}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:rgba(201,164,76,.05)}
/* Inline code stays on one line in PROSE, but must wrap inside a cell: a usage string like
   "/rpg create|hero|levelup|…" is long enough to blow the first column past the container
   and shove every other column out of sight. Cells wrap; the table stays readable. */
table code{white-space:normal;overflow-wrap:anywhere}
/* Cap the label column. Without a ceiling, auto table layout sizes it to its max-content —
   and /rpg's usage string is 200 characters, which reserved 70% of the table for column one
   and squeezed every description into two lines. A nowrap on this column is NOT the answer:
   it makes that max-content binding no matter how the inner code chip wraps. */
th:first-child,td:first-child{max-width:34ch}

.empty{padding:40px 0;color:var(--muted);font-style:italic}
.hidden{display:none!important}
footer{margin-top:60px;padding-top:22px;border-top:1px solid var(--edge);color:var(--muted);font-size:13.5px}
footer p{margin:0 0 6px}

@media(max-width:960px){
  .shell{gap:0;padding:0 16px}
  nav{position:fixed;top:61px;left:0;bottom:0;width:280px;z-index:19;padding:16px 8px 40px;
    background:rgba(12,10,18,.985);border-right:1px solid var(--edge);transform:translateX(-102%);transition:transform .22s ease;max-height:none}
  nav.open{transform:none}
  .menu{display:block}
  .searchwrap{max-width:none}
  .brand-name{display:none}
  main{padding:20px 0 70px}
  h2{font-size:24px}
  h3{font-size:18px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const PAGE_JS = String.raw`
const $=s=>document.querySelector(s);
const secs=[...document.querySelectorAll('.sec')];
const navLinks=[...document.querySelectorAll('.navtop,.navsub')];

// Search: hide any section whose flattened text misses the query. A parent stays visible
// when one of its subs matches, so a hit deep in Cửa Ải never loses its heading.
const q=$('#q');
q.addEventListener('input',()=>{
  const v=q.value.trim().toLowerCase();
  if(!v){secs.forEach(s=>s.classList.remove('hidden'));$('#empty').classList.add('hidden');return;}
  let any=false;
  for(const s of secs){
    const self=s.dataset.q.includes(v);
    const kid=[...s.querySelectorAll('.sec')].some(k=>k.dataset.q.includes(v));
    const show=self||kid;
    s.classList.toggle('hidden',!show);
    if(show&&!s.classList.contains('sub'))any=true;
  }
  $('#empty').classList.toggle('hidden',any);
});
// "/" focuses search the way every docs site does; Esc clears it.
addEventListener('keydown',e=>{
  if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus();}
  if(e.key==='Escape'&&document.activeElement===q){q.value='';q.dispatchEvent(new Event('input'));q.blur();}
});

// Scroll-spy: light the nav entry of whichever section owns the top of the viewport.
const byId=new Map(navLinks.map(a=>[a.getAttribute('href').slice(1),a]));
const spy=new IntersectionObserver(entries=>{
  for(const e of entries){
    if(!e.isIntersecting)continue;
    navLinks.forEach(a=>a.classList.remove('on'));
    const link=byId.get(e.target.id);
    if(link){
      link.classList.add('on');
      if(link.classList.contains('navsub')){
        const top=link.closest('.navgroup')?.querySelector('.navtop');
        if(top)top.classList.add('on');
      }
      link.scrollIntoView({block:'nearest'});
    }
  }
},{rootMargin:'-84px 0px -72% 0px'});
secs.forEach(s=>spy.observe(s));

// Mobile drawer.
const nav=$('#nav');
$('#menu').addEventListener('click',()=>nav.classList.toggle('open'));
nav.addEventListener('click',e=>{if(e.target.closest('a'))nav.classList.remove('open');});
`;
