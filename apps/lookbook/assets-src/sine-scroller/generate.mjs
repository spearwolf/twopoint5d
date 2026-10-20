// sine-scroller: an Amiga demo in parts — a chrome bitmap font whose 16 colours double as a
// cycling palette, a plain white 8 px font for tinting and glow, copper bars, a colour-cycling
// tunnel with its palette, and light-saber glow strips.
import path from 'node:path';
import {ASCII, buildBitmapFont} from '../lib/bmfont.mjs';
import {texturePackerHash} from '../lib/formats.mjs';
import {hex, hsl, Img, mix, ramp, toHex, withAlpha} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';
import {TrueTypeFont} from '../lib/ttf.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

export const FONT_DIR = path.join(ASSETS_SRC, 'shared/fonts/press-start-2p');

/** Entry 0 is the outline, 1–15 the chrome from the top of the sky down to the ground. */
const CHROME = [
  '#0a0418',
  '#1a2a6c',
  '#2a4aa0',
  '#3f6fd0',
  '#6a9ef0',
  '#a8d0ff',
  '#e8f6ff',
  '#ffffff',
  '#2a1408',
  '#5a2c0c',
  '#8a4a14',
  '#b8701e',
  '#e09a38',
  '#f8c460',
  '#fff0b0',
  '#fffadc',
].map(hex);

/** the chrome entry of each 2-pixel band of the 32-pixel cell, top to bottom */
const CHROME_BANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15];

/**
 * A row of 15 colours that cycles without a seam: entry 15 leads back into entry 1.
 * @param {(t: number) => RGBA} at t in [0, 1)
 */
const cyclic = (at) => Array.from({length: 15}, (_, i) => at(i / 15));

/**
 * The palette of the chrome font: row 0 the source colours, rows 1–3 replacements.
 * Entry 0 (the outline) is the same in every row; `paletteShift` cycles entries 1–15.
 */
function chromePalette() {
  const outline = CHROME[0];
  const rows = [
    CHROME,
    [outline, ...cyclic((t) => hsl(t * 360, 0.85, 0.58))],
    [outline, ...ramp(['#3a1404', '#a04818', '#e8902c', '#ffd890', '#fff6e0', '#e8902c', '#7a300c'].map(hex), 15)],
    [outline, ...cyclic((t) => hsl(200 + 70 * Math.sin(t * Math.PI * 2), 0.9, 0.45 + 0.3 * Math.cos(t * Math.PI * 2)))],
  ];
  const img = new Img(16, rows.length);
  rows.forEach((row, y) => row.forEach((c, x) => img.set(x, y, c)));
  return img;
}

/** 8 copper bars of 16 rows each, 4 pixels wide (stretch them), plus a grey bar for `Tint`. */
function copperBars() {
  const hues = [0, 25, 50, 110, 175, 215, 265, 310];
  const img = new Img(4, 16 * (hues.length + 1));
  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0];
  [...hues, -1].forEach((hue, bar) => {
    const colours =
      hue < 0
        ? ramp([hex('#1c1c24'), hex('#8a8a96'), hex('#ffffff')], 8)
        : ramp([hsl(hue, 0.9, 0.1), hsl(hue, 0.95, 0.45), hsl(hue, 1, 0.68), hsl(hue, 0.6, 0.94)], 8);
    levels.forEach((level, row) => img.fillRect(0, bar * 16 + row, 4, 1, colours[level]));
  });
  return img;
}

/** A spiral tunnel whose 16 grey levels are the source row of its palette. */
function cycleTunnel() {
  const size = 128;
  const img = new Img(size, size);
  const greys = Array.from({length: 16}, (_, i) => /** @type {RGBA} */ ([i * 17, i * 17, i * 17, 255]));
  img.paint((x, y) => {
    const dx = x + 0.5 - size / 2;
    const dy = y + 0.5 - size / 2;
    const r = Math.hypot(dx, dy);
    if (r < 5) return greys[0];
    const depth = 640 / r;
    const turn = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
    return greys[Math.floor(depth + turn * 32) % 16];
  });
  return {img, greys};
}

/** @param {RGBA[]} greys */
function tunnelPalette(greys) {
  const rows = [
    greys,
    Array.from({length: 16}, (_, i) => hsl((i / 16) * 360, 0.9, 0.55)),
    Array.from({length: 16}, (_, i) => {
      const t = Math.sin((i / 16) * Math.PI) ** 1.5;
      return ramp(['#100008', '#7a0c08', '#e0400c', '#ffb020', '#fff4c0'].map(hex), 33)[Math.round(t * 32)];
    }),
    Array.from({length: 16}, (_, i) =>
      hsl(190 + 40 * Math.sin((i / 16) * Math.PI * 2), 0.85, 0.2 + 0.5 * (0.5 + 0.5 * Math.cos((i / 16) * Math.PI * 2))),
    ),
  ];
  const img = new Img(16, rows.length);
  rows.forEach((row, y) => row.forEach((c, x) => img.set(x, y, c)));
  return img;
}

/**
 * A light-saber glow strip, 64 × 16: a white core four pixels high, then the colour, its alpha
 * falling off to the edges. The same along its length, so it tiles horizontally.
 * @param {RGBA} colour
 */
function saberStrip(colour) {
  const img = new Img(64, 16);
  img.paint((_, y) => {
    const d = Math.abs(y + 0.5 - 8);
    if (d < 2) return [255, 255, 255, 255];
    const t = (d - 2) / 6;
    const c = mix([255, 255, 255, 255], colour, Math.min(1, t * 2.5));
    return withAlpha(c, 255 * (1 - t) ** 2);
  });
  return img;
}

export const SABER_COLOURS = /** @type {Record<string, RGBA>} */ ({
  cyan: hex('#30e8ff'),
  green: hex('#40ff60'),
  red: hex('#ff2828'),
  purple: hex('#b040ff'),
  white: hex('#c8d0ff'),
});

/**
 * The plain white 8 px font, shared with ui-panels.
 * @param {TrueTypeFont} font
 */
export function pixelFont8(font) {
  return buildBitmapFont({
    font,
    pixelsPerEm: 8,
    scale: 1,
    face: 'lookbook pixel 8',
    page: 'pixel-8.png',
    codePoints: ASCII,
    style: {fill: () => [255, 255, 255, 255]},
    lineHeight: 10,
    base: 7,
  });
}

/** @param {import('../lib/output.mjs').Output} out */
export function generate(out) {
  const font = new TrueTypeFont(path.join(FONT_DIR, 'PressStart2P-Regular.ttf'));

  const chrome = buildBitmapFont({
    font,
    pixelsPerEm: 8,
    scale: 4,
    face: 'lookbook chrome 32',
    page: 'chrome-32.png',
    codePoints: ASCII,
    style: {fill: (_, y) => CHROME[CHROME_BANDS[Math.floor(y / 2)]], outline: CHROME[0], outlineWidth: 2},
    lineHeight: 36,
    base: 28,
  });
  const palette = chromePalette();
  const sourceRow = new Set(CHROME.map(toHex));
  check(sourceRow.size === 16, 'the 16 chrome colours are distinct');
  for (const c of chrome.sheet.opaqueColours()) check(sourceRow.has(c), `chrome glyph colour ${c} is in palette row 0`);
  out.png('chrome-32.png', chrome.sheet);
  out.text('chrome-32.fnt', chrome.text);
  out.json('chrome-32.json', chrome.json);
  out.png('chrome-32-palette.png', palette);

  const pixel = pixelFont8(font);
  out.png('pixel-8.png', pixel.sheet);
  out.text('pixel-8.fnt', pixel.text);
  out.json('pixel-8.json', pixel.json);
  out.copy('OFL.txt', path.join(FONT_DIR, 'OFL.txt'));

  out.png('copper-bars.png', copperBars());

  const tunnel = cycleTunnel();
  out.png('cycle-tunnel.png', tunnel.img);
  out.png('cycle-tunnel-palette.png', tunnelPalette(tunnel.greys));

  const strips = Object.entries(SABER_COLOURS).map(([name, c]) => ({name: `saber-${name}`, img: saberStrip(c)}));
  const {sheet, frames} = pack(strips, {padding: 2, keepOrder: true});
  out.png('saber-glow.png', sheet);
  out.json('saber-glow.json', texturePackerHash(frames, {image: 'saber-glow.png', width: sheet.width, height: sheet.height}));
}
