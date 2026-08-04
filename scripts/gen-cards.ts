// Generate the 53 card-face PNGs (52 cards + back) into assets/cards/.
// SVG templating → resvg-js rasterization. DEV-ONLY: @resvg/resvg-js is a
// devDependency and is imported nowhere in the runtime (src/), so it never
// ships in the production image (Dockerfile installs --production).
//
//   bun run emojis:gen
//
// The output PNGs are what scripts/upload-emojis.ts pushes to Discord as
// application emojis. Re-run this only to change the card art.

import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { BACK_FILE, DECK, SUIT_META, assetFile } from "../src/cards";

const OUT = "assets/cards";
const RENDER_WIDTH = 256; // Discord downscales emojis to ~48px; render crisp, downscale on send

// Corner rank + suit (top-left, mirrored bottom-right) + one big center suit.
// The corner index is what stays legible at emoji size — the whole point.
function cardSvg(rank: string, color: string, glyph: string): string {
  const rankSize = rank.length > 1 ? 42 : 56; // "10" is two glyphs — shrink so it fits the corner
  return `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350">
  <rect x="6" y="6" width="238" height="338" rx="24" ry="24" fill="#ffffff" stroke="#d0d0d0" stroke-width="4"/>
  <g fill="${color}" font-family="Helvetica, Arial, sans-serif" font-weight="bold" text-anchor="middle">
    <text x="44" y="64" font-size="${rankSize}">${rank}</text>
    <text x="44" y="114" font-size="46">${glyph}</text>
    <text x="125" y="212" font-size="140">${glyph}</text>
    <g transform="rotate(180 206 286)">
      <text x="206" y="286" font-size="${rankSize}">${rank}</text>
      <text x="206" y="336" font-size="46">${glyph}</text>
    </g>
  </g>
</svg>`;
}

// Distinct blue-panel back so the dealer's hole card reads as "face down".
function backSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350">
  <rect x="6" y="6" width="238" height="338" rx="24" ry="24" fill="#ffffff" stroke="#d0d0d0" stroke-width="4"/>
  <rect x="22" y="22" width="206" height="306" rx="16" fill="#1f3a93"/>
  <rect x="34" y="34" width="182" height="282" rx="10" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.55"/>
  <text x="125" y="212" font-size="120" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" fill="#ffffff" opacity="0.9">&#9670;</text>
</svg>`;
}

function rasterize(svg: string, file: string): void {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: RENDER_WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
  writeFileSync(`${OUT}/${file}`, png);
}

mkdirSync(OUT, { recursive: true });
for (const { rank, suit } of DECK) {
  const meta = SUIT_META[suit];
  rasterize(cardSvg(rank, meta.color, meta.glyph), assetFile(rank, suit));
}
rasterize(backSvg(), BACK_FILE);
console.log(`✅ Generated ${DECK.length + 1} card PNGs into ${OUT}/`);
