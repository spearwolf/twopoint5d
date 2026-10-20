// ui-panels: a dungeon UI in the tiny pixel look of Tiny Rogue — nine-slice frames packed
// untrimmed (as a TexturePacker hash and as an Aseprite sheet with slices), 12-pixel item icons,
// the white 8 px font, and six anime portraits cut from curated ComfyUI paintings.
import path from 'node:path';
import sharp from 'sharp';
import {asepriteHash, texturePackerHash} from '../lib/formats.mjs';
import {hex, Img} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';
import {TrueTypeFont} from '../lib/ttf.mjs';
import {FONT_DIR, pixelFont8} from '../sine-scroller/generate.mjs';
import {icons} from './icons.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */
/** @typedef {[number, number, number, number]} Insets left, top, right, bottom */

const CLEAR = /** @type {RGBA} */ ([0, 0, 0, 0]);

/**
 * A frame drawn from its cross-section: `profile[d]` paints the pixels `d` steps in from the
 * nearest edge, as a pair — the colour on the top and left sides, the colour on the bottom and
 * right — so the edges are the same along their length and stretch cleanly. `fill` paints the
 * inside, `corner` draws the details into the four corners afterwards.
 * @param {number} w
 * @param {number} h
 * @param {[RGBA, RGBA][]} profile
 * @param {RGBA} fill
 * @param {(img: Img) => void} [corner]
 */
function frame(w, h, profile, fill, corner) {
  const img = new Img(w, h);
  img.paint((x, y) => {
    const dl = x;
    const dt = y;
    const dr = w - 1 - x;
    const db = h - 1 - y;
    const d = Math.min(dl, dt, dr, db);
    if (d >= profile.length) return fill;
    const lightSide = Math.min(dl, dt) <= Math.min(dr, db);
    return profile[d][lightSide ? 0 : 1];
  });
  // round the outer corners off by one pixel
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ])
    img.set(x, y, CLEAR);
  corner?.(img);
  return img;
}

/**
 * Draws `f(img, x, y, sx, sy)` once per corner, (sx, sy) pointing into the panel.
 * @param {Img} img
 * @param {number} inset
 * @param {(img: Img, x: number, y: number) => void} f
 */
function corners(img, inset, f) {
  f(img, inset, inset);
  f(img, img.width - 1 - inset, inset);
  f(img, inset, img.height - 1 - inset);
  f(img, img.width - 1 - inset, img.height - 1 - inset);
}

const C = {
  ink: hex('#14101a'),
  stoneLit: hex('#a09aac'),
  stone: hex('#6a6676'),
  stoneDark: hex('#4a4656'),
  stoneDeep: hex('#2a2632'),
  hollow: hex('#1e1a26'),
  shadow: hex('#0e0c14'),
  gold: hex('#ffd040'),
  goldDark: hex('#a86a10'),
  goldMid: hex('#e0a028'),
  woodLit: hex('#c08a50'),
  wood: hex('#8a5a30'),
  woodDark: hex('#5a3418'),
  woodDeep: hex('#2e2018'),
  nail: hex('#b8c0cc'),
  paperLit: hex('#fff4d8'),
  paper: hex('#e8d4a8'),
  paperDark: hex('#b89a68'),
  paperInk: hex('#3a2414'),
  paperFill: hex('#f2e6c6'),
  ruby: hex('#e03a3a'),
  night: hex('#120e1a'),
  btn: hex('#b89a60'),
  btnLit: hex('#f0e0b0'),
  btnDark: hex('#6a5030'),
  btnFill: hex('#a08850'),
};

/**
 * The panels: name → [image, insets]. Insets are left, top, right, bottom in pixels.
 * @returns {{name: string, img: Img, insets: Insets, what: string}[]}
 */
function panels() {
  /** @type {{name: string, img: Img, insets: Insets, what: string}[]} */
  const out = [];
  const add = (/** @type {string} */ name, /** @type {Img} */ img, /** @type {Insets} */ insets, /** @type {string} */ what) =>
    out.push({name, img, insets, what});

  add(
    'panel-stone',
    frame(
      24,
      24,
      [
        [C.ink, C.ink],
        [C.stoneLit, C.stoneDark],
        [C.stone, C.stoneDark],
        [C.stone, C.stoneDark],
        [C.stone, C.stoneDark],
        [C.stoneDeep, C.stoneDeep],
        [C.ink, C.ink],
        [C.shadow, C.stoneDeep],
      ],
      C.hollow,
      (img) =>
        corners(img, 3, (im, x, y) => {
          im.set(x, y, C.gold);
          im.set(x + 1, y, C.goldDark);
          im.set(x, y + 1, C.goldDark);
          im.set(x + 1, y + 1, C.goldDark);
        }),
    ),
    [8, 8, 8, 8],
    'stone frame with gold rivets, dark hollow inside — inventories, the main window',
  );
  add(
    'panel-wood',
    frame(
      24,
      24,
      [
        [C.ink, C.ink],
        [C.woodLit, C.woodDark],
        [C.wood, C.woodDark],
        [C.wood, C.wood],
        [C.woodDark, C.woodDark],
        [C.ink, C.ink],
        [C.shadow, C.woodDeep],
      ],
      C.woodDeep,
      (img) => corners(img, 2, (im, x, y) => im.set(x, y, C.nail)),
    ),
    [7, 7, 7, 7],
    'wooden frame with nails, dark wood inside — shops, chests',
  );
  add(
    'panel-parchment',
    frame(
      24,
      24,
      [
        [C.paperInk, C.paperInk],
        [C.paperLit, C.paperDark],
        [C.paper, C.paperDark],
        [C.paper, C.paper],
        [C.paperDark, C.paperDark],
      ],
      C.paperFill,
      (img) =>
        corners(img, 1, (im, x, y) => {
          im.set(x, y, C.paperDark);
        }),
    ),
    [6, 6, 6, 6],
    'parchment, light inside — quest text, maps; write on it in a dark tint',
  );
  add(
    'panel-dark',
    frame(
      24,
      24,
      [
        [C.ink, C.ink],
        [C.gold, C.goldDark],
        [C.ink, C.ink],
        [C.night, C.night],
      ],
      C.night,
      (img) =>
        corners(img, 1, (im, x, y) => {
          im.set(x, y, C.ruby);
        }),
    ),
    [5, 5, 5, 5],
    'near-black with a thin gold trim and ruby corners — dialogue boxes',
  );
  const button = (/** @type {'up' | 'hover' | 'down'} */ state) => {
    const lit = state === 'hover' ? hex('#fff6d8') : C.btnLit;
    const face = state === 'hover' ? hex('#c8aa6a') : state === 'down' ? hex('#8a7040') : C.btnFill;
    const rim =
      state === 'down' ? /** @type {[RGBA, RGBA]} */ ([C.btnDark, lit]) : /** @type {[RGBA, RGBA]} */ ([lit, C.btnDark]);
    return frame(24, 16, [[C.ink, C.ink], rim, [state === 'down' ? face : C.btn, state === 'down' ? face : C.btnDark]], face);
  };
  add('button-up', button('up'), [4, 4, 4, 4], 'a raised button');
  add('button-hover', button('hover'), [4, 4, 4, 4], 'the same, lit');
  add('button-down', button('down'), [4, 4, 4, 4], 'the same, pressed: the bevel turned round; move the label 1 px down');
  add(
    'slot',
    frame(
      20,
      20,
      [
        [C.ink, C.ink],
        [C.stoneDeep, C.stoneLit],
        [C.stoneDark, C.stone],
        [C.stoneDeep, C.stoneDeep],
      ],
      hex('#26222e'),
    ),
    [4, 4, 4, 4],
    'a sunken inventory slot — an icon fits inside at 12 × 12',
  );
  add(
    'bar-frame',
    frame(
      32,
      10,
      [
        [C.ink, C.ink],
        [C.stoneLit, C.stoneDark],
        [C.ink, C.ink],
      ],
      C.shadow,
    ),
    [3, 3, 3, 3],
    'the frame of a health or mana bar; its inside is the empty bar',
  );
  const fill = (/** @type {string[]} */ rows) => {
    const img = new Img(8, 4);
    rows.forEach((c, y) => img.fillRect(0, y, 8, 1, hex(c)));
    return img;
  };
  add('bar-fill-red', fill(['#ff8a7a', '#e03a3a', '#e03a3a', '#8a1a2a']), [0, 1, 0, 1], 'health, to stretch inside `bar-frame`');
  add('bar-fill-blue', fill(['#8ac0ff', '#3a6ae0', '#3a6ae0', '#1a2a8a']), [0, 1, 0, 1], 'mana');
  add('bar-fill-green', fill(['#b0ff8a', '#4ac04a', '#4ac04a', '#1a6a2a']), [0, 1, 0, 1], 'stamina, poison');
  add(
    'portrait-frame',
    frame(
      40,
      40,
      [
        [C.ink, C.ink],
        [C.gold, C.goldDark],
        [C.goldMid, C.goldDark],
        [C.goldMid, C.goldMid],
        [C.goldDark, C.goldDark],
        [C.ink, C.ink],
      ],
      CLEAR,
      (img) =>
        corners(img, 2, (im, x, y) => {
          im.set(x, y, C.ruby);
          im.set(x + (x < 20 ? 1 : -1), y, C.ink);
          im.set(x, y + (y < 20 ? 1 : -1), C.ink);
        }),
    ),
    [6, 6, 6, 6],
    'a gold frame with ruby corners and a clear inside — lay it over a portrait',
  );
  add(
    'tooltip',
    frame(
      16,
      16,
      [
        [C.ink, C.ink],
        [C.stone, C.stoneDeep],
        [C.hollow, C.hollow],
      ],
      hex('#1a1622'),
    ),
    [3, 3, 3, 3],
    'a small dark box — tooltips, labels, damage numbers',
  );
  const divider = new Img(32, 5);
  divider.fillRect(4, 2, 24, 1, C.goldDark);
  divider.fillRect(4, 1, 24, 1, C.gold);
  divider.fillRect(4, 3, 24, 1, C.ink);
  for (const x of [1, 30]) {
    divider.fillRect(x - 1, 1, 3, 3, C.gold);
    divider.set(x, 2, C.ruby);
  }
  divider.outline(C.ink);
  add('divider', divider, [5, 0, 5, 0], 'a horizontal rule with gold studs at both ends; stretch it in x only');

  for (const p of out) {
    const [l, t, r, b] = p.insets;
    check(l + r < p.img.width && t + b < p.img.height, `${p.name}: insets leave a middle`);
    // the stretched parts must be uniform along their stretch: every column of the top and bottom
    // edges between the corners is the same, and every row of the left and right edges
    for (let y = 0; y < p.img.height; y++) {
      for (let x = l + 1; x < p.img.width - r; x++) {
        if (y < t || y >= p.img.height - b) {
          check(p.img.get(x, y).join() === p.img.get(l, y).join(), `${p.name}: top/bottom edge is uniform at (${x}, ${y})`);
        }
      }
    }
    // a frame without top and bottom insets stretches in x only
    for (let x = 0; t + b > 0 && x < p.img.width; x++) {
      for (let y = t + 1; y < p.img.height - b; y++) {
        if (x < l || x >= p.img.width - r) {
          check(p.img.get(x, y).join() === p.img.get(x, t).join(), `${p.name}: left/right edge is uniform at (${x}, ${y})`);
        }
      }
    }
  }
  return out;
}

/** Where each portrait's head sits in its 512 × 512 source: a square crop [x, y, size]. */
const PORTRAITS = /** @type {Record<string, [number, number, number]>} */ ({
  knight: [86, 30, 340],
  rogue: [86, 45, 340],
  witch: [56, 0, 400],
  wizard: [40, 0, 400],
  ranger: [76, 30, 360],
  barbarian: [56, 10, 400],
});
const PORTRAIT_SIZE = 96;

/** @param {import('../lib/output.mjs').Output} out */
export async function generate(out) {
  const list = panels();
  const {sheet, frames} = pack(
    list.map((p) => ({name: p.name, img: p.img})),
    {padding: 2},
  );
  check(
    frames.every((f) => !f.trimmed),
    'panels are packed untrimmed',
  );
  out.png('panels.png', sheet);
  out.json('panels.json', texturePackerHash(frames, {image: 'panels.png', width: sheet.width, height: sheet.height}));
  // the same sheet as an Aseprite UI kit: one frame, the whole canvas, one slice per panel
  const whole = {
    name: 'panels',
    x: 0,
    y: 0,
    w: sheet.width,
    h: sheet.height,
    trimmed: false,
    spriteSourceSize: {x: 0, y: 0, w: sheet.width, h: sheet.height},
    sourceSize: {w: sheet.width, h: sheet.height},
  };
  out.json(
    'panels.aseprite.json',
    asepriteHash({
      title: 'panels',
      frames: [whole],
      durations: [100],
      tags: [],
      slices: list.map((p, i) => {
        const f = frames[i];
        const [l, t, r, b] = p.insets;
        return {
          name: p.name,
          color: '#0000ffff',
          keys: [{frame: 0, bounds: {x: f.x, y: f.y, w: f.w, h: f.h}, center: {x: l, y: t, w: f.w - l - r, h: f.h - t - b}}],
        };
      }),
      image: 'panels.png',
      width: sheet.width,
      height: sheet.height,
    }),
  );
  out.json('panels.insets.json', Object.fromEntries(list.map((p) => [p.name, p.insets])));

  const iconList = icons();
  const iconSheet = pack(iconList, {padding: 2, keepOrder: true});
  out.png('icons.png', iconSheet.sheet);
  out.json(
    'icons.json',
    texturePackerHash(iconSheet.frames, {image: 'icons.png', width: iconSheet.sheet.width, height: iconSheet.sheet.height}),
  );

  const font = pixelFont8(new TrueTypeFont(path.join(FONT_DIR, 'PressStart2P-Regular.ttf')));
  out.png('pixel-8.png', font.sheet);
  out.text('pixel-8.fnt', font.text);
  out.json('pixel-8.json', font.json);
  out.copy('OFL.txt', path.join(FONT_DIR, 'OFL.txt'));

  for (const [name, [x, y, size]] of Object.entries(PORTRAITS)) {
    const source = path.join(ASSETS_SRC, 'ui-panels/raw', `${name}.webp`);
    const {data, info} = await sharp(source)
      .ensureAlpha()
      .extract({left: x, top: y, width: size, height: size})
      .resize(PORTRAIT_SIZE, PORTRAIT_SIZE, {kernel: 'lanczos3'})
      .raw()
      .toBuffer({resolveWithObject: true});
    check(info.width === PORTRAIT_SIZE && info.channels === 4, `portrait ${name} is ${PORTRAIT_SIZE} × ${PORTRAIT_SIZE} RGBA`);
    out.png(`portraits/${name}.png`, new Img(info.width, info.height, new Uint8Array(data)));
  }
}
