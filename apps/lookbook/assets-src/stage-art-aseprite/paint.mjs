// The pixels of "the night-shift machine", the art of the demo stage-art-aseprite: a vending machine
// on a street at night with odd goods behind its glass, a black cat beside it and a moth at its
// sign. Every picture is painted here, by code, at the size it is drawn; `vending-machine.lua` lays
// the pictures out as an Aseprite file — its layers, groups, tags and pivot slices — from the scene
// this module answers. README.md documents the layers.
import {bayer, ditherRamp, hex, Img, mix, Rng, valueNoise, withAlpha} from '../lib/image.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */
/** @typedef {import('../lib/ttf.mjs').TrueTypeFont} TrueTypeFont */

export const CANVAS = {width: 480, height: 300};
const W = CANVAS.width;
const H = CANVAS.height;

// --- the scene: layers, groups, frames, tags and pivots, as the Lua script builds them -----------

/**
 * @typedef {object} SceneLayer
 * @property {'layer'} kind
 * @property {string} name
 * @property {string} [data] the user data of the layer
 * @property {Map<number, Img>} cels by frame of the sprite
 * @property {[number, number]} [pivot] a corner between pixels on the canvas, the point it turns about
 */
/**
 * @typedef {object} SceneGroup
 * @property {'group'} kind
 * @property {string} name
 * @property {string} [data]
 * @property {(SceneLayer | SceneGroup)[]} children bottom first
 */
/** @typedef {{name: string, from: number, to: number, direction: 'forward' | 'pingpong'}} SceneTag */

export class Scene {
  constructor() {
    /** The duration of each frame of the sprite in milliseconds; frame 0 is the rest of every layer. */
    this.durations = [100];
    /** @type {SceneTag[]} */
    this.tags = [];
    /** @type {(SceneLayer | SceneGroup)[]} */
    this.root = [];
    /** @type {(SceneLayer | SceneGroup)[]} */
    this.into = this.root;
  }

  /**
   * Appends frames of the given durations and a tag over them; answers the frames of the sprite.
   * @param {string} name
   * @param {number[]} durations milliseconds
   * @param {'forward' | 'pingpong'} [direction]
   */
  tag(name, durations, direction = 'forward') {
    const from = this.durations.length;
    this.durations.push(...durations);
    const to = this.durations.length - 1;
    this.tags.push({name, from, to, direction});
    return Array.from({length: to - from + 1}, (_, i) => from + i);
  }

  /**
   * A second tag over the frames of `of`, under another name: two layers that step together.
   * @param {string} name
   * @param {string} of
   */
  twin(name, of) {
    const tag = this.tags.find((t) => t.name === of);
    if (tag === undefined) throw new Error(`paint: no tag ${of}`);
    this.tags.push({...tag, name});
    return Array.from({length: tag.to - tag.from + 1}, (_, i) => tag.from + i);
  }

  /**
   * @param {string} name
   * @param {string | undefined} data
   * @param {() => void} fill adds the layers of the group
   */
  group(name, data, fill) {
    /** @type {SceneGroup} */
    const group = {kind: 'group', name, data, children: []};
    this.into.push(group);
    const outer = this.into;
    this.into = group.children;
    try {
      fill();
    } finally {
      this.into = outer;
    }
  }

  /**
   * @param {string} name
   * @param {{data?: string, pivot?: [number, number]}} [opts]
   * @returns {SceneLayer}
   */
  layer(name, opts = {}) {
    /** @type {SceneLayer} */
    const layer = {kind: 'layer', name, data: opts.data, cels: new Map(), pivot: opts.pivot};
    this.into.push(layer);
    return layer;
  }
}

// --- palettes ------------------------------------------------------------------------------------

/** @param {string[]} colours */
const pal = (colours) => colours.map(hex);

const NIGHT = hex('#070912');
// the street lit by the cold light of the window and the pink of the sign
const WALL_COLD = pal(['#0b0f1c', '#121a2c', '#1a263e', '#243650', '#304964', '#3f5f7c', '#557c96', '#7097ad']);
const WALL_PINK = pal(['#0b0f1c', '#18142a', '#261a3a', '#38204a', '#4c2858', '#643466', '#7e4474', '#9a5a86']);
const FLOOR = pal(['#090c17', '#0f1424', '#161e32', '#1f2a42', '#2a3852', '#384a64', '#4a6078', '#62798e']);
const BODY = pal(['#2a0c16', '#46121f', '#651a28', '#842331', '#a42e38', '#c4443f', '#e06a50']);
const BODY_SIDE = pal(['#16070e', '#240a13', '#36101b', '#4a1622', '#5e1d2a']);
const OUTLINE = hex('#0a0510');
const CHROME = pal(['#1c2131', '#343c52', '#56617c', '#8590aa', '#b9c4d8', '#e8eef7']);
const PLATE = pal(['#0c0a16', '#141222', '#1c1a2e', '#26243a']);
const INTERIOR = pal(['#070b14', '#0c1424', '#132036', '#1b2e48', '#25405e', '#325676', '#456f90']);
const GOOD_OUTLINE = hex('#05080f');
const LIGHT = hex('#86ecff');
const NEON_TUBE = hex('#ff4fa8');
const NEON_CORE = hex('#ffd9ee');
const NEON_GLOW = hex('#ff3a9a');
const NEON_DIM = hex('#a8357a');
const NEON_OFF = hex('#3c1a32');
const LED = hex('#ff6a3a');

// --- where things are, canvas pixels, y down -----------------------------------------------------

/** The front of the cabinet; the side shows to the right of it. */
const BODY_BOX = {x0: 158, x1: 310, y0: 40, y1: 250};
const SIDE_X1 = 318;
const SIGN_BOX = {x0: 166, x1: 302, y0: 16, y1: 40};
const WINDOW = {x0: 170, x1: 276, y0: 52, y1: 196};
/** The top of each shelf: the row below the goods that stand on it. */
const SHELVES = [100, 146, 192];
/** The middle of each column of the window: the corner between pixels a good stands centred on. */
const COLUMNS = [183, 209, 235, 261];
const PANEL = {x0: 280, x1: 306, y0: 50, y1: 198};
const DISPLAY = {x0: 283, x1: 303, y0: 55, y1: 67};
const BAY = {x0: 176, x1: 268, y0: 206, y1: 236};
const FLAP = {x0: 178, x1: 266, y0: 207, y1: 227};
/** Where the wall meets the pavement, and where the machine, the cat and the curb stand. */
const WALL_FOOT = 246;
const MACHINE_FOOT = 256;
const CAT = {x: 350, foot: 268};
const BIN = {x: 128, foot: MACHINE_FOOT + 2};
const MOTH = {x: 150, y: 30};
/** The light of the window, and the light of the sign. */
const WINDOW_LIGHT = {x: 222, y: 128};
const SIGN_LIGHT = {x: 234, y: 26};

// --- helpers -------------------------------------------------------------------------------------

/** @param {number} v */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 1 at the middle of a light, 0 from `d` = 1 on. @param {number} d */
const falloff = (d) => (d >= 1 ? 0 : (1 - d) ** 1.7);

const blank = () => new Img(W, H);

/**
 * A triangle filled where the centres of the pixels lie inside it.
 * @param {Img} img
 * @param {[number, number][]} pts
 * @param {RGBA} c
 */
function fillTriangle(img, [[ax, ay], [bx, by], [cx, cy]], c) {
  const x0 = Math.floor(Math.min(ax, bx, cx));
  const x1 = Math.ceil(Math.max(ax, bx, cx));
  const y0 = Math.floor(Math.min(ay, by, cy));
  const y1 = Math.ceil(Math.max(ay, by, cy));
  const edge = (/** @type {number} */ px, /** @type {number} */ py, ex0, ey0, ex1, ey1) =>
    (ex1 - ex0) * (py - ey0) - (ey1 - ey0) * (px - ex0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const e0 = edge(px, py, ax, ay, bx, by);
      const e1 = edge(px, py, bx, by, cx, cy);
      const e2 = edge(px, py, cx, cy, ax, ay);
      if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) img.set(x, y, c);
    }
  }
}

/**
 * A cylinder standing upright, lit from the upper left: each column shaded by where it faces.
 * @param {Img} img
 * @param {number} x0
 * @param {number} y0
 * @param {number} w
 * @param {number} h
 * @param {RGBA[]} ramp dark to light
 * @param {number} [lift] added to the light of every pixel
 */
function cylinder(img, x0, y0, w, h, ramp, lift = 0) {
  for (let i = 0; i < w; i++) {
    const n = ((i + 0.5) / w) * 2 - 1;
    const facing = Math.sqrt(Math.max(0, 1 - n * n));
    const light = clamp01(0.12 + 0.62 * facing - 0.3 * n + lift);
    for (let j = 0; j < h; j++) img.set(x0 + i, y0 + j, ditherRamp(ramp, light - (j / h) * 0.12, x0 + i, y0 + j));
  }
}

/**
 * A ball, lit from the upper left.
 * @param {Img} img
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {RGBA[]} ramp
 * @param {number} [lift]
 */
function ball(img, cx, cy, rx, ry, ramp, lift = 0) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const light = clamp01(0.18 + 0.55 * (-0.5 * nx - 0.55 * ny + 0.65 * nz) + lift);
      img.set(x, y, ditherRamp(ramp, light, x, y));
    }
  }
}

/**
 * Pixel art written as text, drawn with its top left at (x, y).
 * @param {Img} img
 * @param {number} x
 * @param {number} y
 * @param {string[]} rows
 * @param {Record<string, RGBA>} palette
 * @param {boolean} [mirror]
 */
function ascii(img, x, y, rows, palette, mirror = false) {
  const width = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.' || ch === ' ') return;
      const c = palette[ch];
      if (!c) throw new Error(`paint: no colour for '${ch}'`);
      img.blend(x + (mirror ? width - 1 - i : i), y + j, c);
    });
  });
}

/** A 3 × 5 font for the display and the flap. */
const MINI = {
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  E: ['###', '#..', '##.', '#..', '###'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  S: ['###', '#..', '###', '..#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  5: ['###', '#..', '###', '..#', '###'],
  '.': ['.', '.', '.', '.', '#'],
};

/** @param {string} text */
const miniWidth = (text) => [...text].reduce((w, ch) => w + MINI[ch][0].length + 1, -1);

/**
 * @param {Img} img
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {RGBA} c
 */
function miniText(img, text, x, y, c) {
  for (const ch of text) {
    const glyph = MINI[ch];
    ascii(img, x, y, glyph, {'#': c});
    x += glyph[0].length + 1;
  }
}

// --- the street ----------------------------------------------------------------------------------

/**
 * How much of each light reaches a point of the wall.
 * @param {number} x
 * @param {number} y
 */
function wallLight(x, y) {
  const cold = falloff(Math.hypot((x - WINDOW_LIGHT.x) / 168, (y - WINDOW_LIGHT.y) / 150));
  const pink = falloff(Math.hypot((x - SIGN_LIGHT.x) / 130, (y - SIGN_LIGHT.y) / 80));
  return {cold, pink};
}

/**
 * Picks the cold or the pink ramp for a pixel, dithered by the share of the pink light.
 * @param {RGBA[]} cold
 * @param {RGBA[]} pink
 * @param {number} share
 * @param {number} x
 * @param {number} y
 */
const tinted = (cold, pink, share, x, y) => (share > bayer(x + 2, y + 1) ? pink : cold);

/** Brick, lit where the lights reach it and dissolving into the night beyond. */
function paintWall() {
  const img = blank();
  const tones = new Rng(7);
  /** @type {Map<string, number>} */
  const brickTone = new Map();
  for (let y = 0; y < WALL_FOOT; y++) {
    for (let x = 0; x < W; x++) {
      const {cold, pink} = wallLight(x, y);
      const reach = cold + pink * 0.8;
      if (reach < 0.2 && reach / 0.2 <= bayer(x, y)) continue;
      const row = Math.floor(y / 6);
      const shift = row % 2 === 0 ? 0 : 7;
      const col = Math.floor((x + shift) / 14);
      const mortar = y % 6 === 5 || (x + shift) % 14 === 13;
      const key = `${row},${col}`;
      if (!brickTone.has(key)) brickTone.set(key, tones.range(-0.07, 0.07));
      const grain = (valueNoise(x / 3, y / 3, 11) - 0.5) * 0.12;
      let light = 0.08 + cold * 0.82 + pink * 0.55 + grain;
      light = mortar ? light * 0.55 : light + (brickTone.get(key) ?? 0);
      // the top edge of a brick catches the light from below, the window
      if (!mortar && y % 6 === 4) light += 0.05;
      const ramp = tinted(WALL_COLD, WALL_PINK, (pink * 0.9) / (cold + pink + 0.001), x, y);
      img.set(x, y, ditherRamp(ramp, light, x, y));
    }
  }
  // a drainpipe on the left, its brackets, and its shadow on the wall
  for (let y = 0; y < WALL_FOOT; y++) {
    for (let x = 96; x < 103; x++) {
      if (img.alpha(x, y) === 0) continue;
      const {cold, pink} = wallLight(x, y);
      const n = (x - 99.5) / 3.5;
      const light = clamp01(0.1 + (cold * 0.9 + pink * 0.5) * (0.55 + 0.45 * n));
      img.set(x, y, ditherRamp(CHROME.slice(0, 4), light, x, y));
    }
    if (img.alpha(103, y) !== 0) img.set(103, y, WALL_COLD[0]);
    if (y % 40 === 20 && img.alpha(95, y) !== 0) img.fillRect(95, y, 9, 2, CHROME[1]);
  }
  // a torn poster: a lost cat, wanted; it sits right below it
  const poster = {x0: 344, y0: 96, x1: 382, y1: 146};
  const paper = pal(['#3c3a44', '#5e5a62', '#857e80', '#aea49c', '#d0c6b4']);
  for (let y = poster.y0; y < poster.y1; y++) {
    for (let x = poster.x0; x < poster.x1; x++) {
      // the torn corner, bottom right
      if (x - poster.x1 + (y - poster.y1) * 1.1 > -10) continue;
      const {cold, pink} = wallLight(x, y);
      const light = 0.1 + cold * 0.85 + pink * 0.5 + (valueNoise(x / 2, y / 2, 21) - 0.5) * 0.1;
      img.set(x, y, ditherRamp(paper, light, x, y));
    }
  }
  const ink = hex('#16141c');
  // "LOST" across the top, a cat below, and lines of small print
  miniText(img, 'LOST', 352, 100, ink);
  const cat = [
    '.#.....#.',
    '.##...##.',
    '.#######.',
    '##.###.##',
    '#########',
    '.#######.',
    '..#####..',
    '.#######.',
    '#########.#',
    '#########.#',
    '#########.#',
    '.########.#',
    '..######.#.',
    '..##..####.',
  ];
  ascii(img, 357, 110, cat, {'#': ink});
  for (const y of [128, 131, 134, 137]) img.fillRect(350, y, y === 137 ? 14 : 24, 1, mix(ink, paper[3], 0.35));
  // the shadow of the poster's top edge and of the curl at its corner
  img.fillRect(poster.x0, poster.y0 - 1, poster.x1 - poster.x0, 1, paper[4]);
  return img;
}

/** The pavement: slabs, the curb, a puddle; a shadow under the machine and under the cat. */
function paintPavement() {
  const img = blank();
  for (let y = WALL_FOOT; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cold = falloff(Math.hypot((x - 232) / 190, (y - 262) / 46));
      const pink = falloff(Math.hypot((x - 234) / 150, (y - WALL_FOOT) / 30));
      const reach = cold + pink * 0.6 + 0.06;
      if (reach < 0.24 && reach / 0.24 <= bayer(x, y)) continue;
      let light = 0.06 + cold * 0.72 + pink * 0.35 + (valueNoise(x / 4, y / 2, 31) - 0.5) * 0.08;
      // the foot of the wall, and the joints of the slabs
      if (y < WALL_FOOT + 2) light *= 0.45;
      const row = y < 266 ? 0 : 1;
      if (y === 265 || (y < 284 && (x + row * 23) % 46 === 0)) light *= 0.55;
      // the curb: its top catches the light, its face is in shadow, the road below is dark
      if (y >= 284 && y < 287) light = light * 1.25 + 0.06;
      else if (y >= 287 && y < 292) light *= 0.45;
      else if (y >= 292) light *= 0.22;
      // the machine and the cat stand on it: what is under them gets no light
      const underMachine = x >= BODY_BOX.x0 - 2 && x < SIDE_X1 + 4 && y < MACHINE_FOOT + 3;
      if (underMachine) light *= 0.35 + 0.65 * clamp01((y - (MACHINE_FOOT - 4)) / 8);
      const catShadow = Math.hypot((x - CAT.x - 3) / 15, (y - CAT.foot) / 2.6);
      if (catShadow < 1) light *= 0.45 + 0.55 * catShadow;
      const ramp = tinted(FLOOR, WALL_PINK, (pink * 0.5) / (cold + pink + 0.001), x, y);
      img.set(x, y, ditherRamp(ramp, light, x, y));
    }
  }
  // a puddle in front of the machine: dark water, its far edge catching the window's light, the
  // pink of the sign and the cold of the window in its ripples
  const water = pal(['#04060c', '#080c18', '#0e1628', '#16223a']);
  for (let y = 272; y < 286; y++) {
    for (let x = 282; x < 352; x++) {
      const d = Math.hypot((x - 316) / 32, (y - 279) / 5.5) + (valueNoise(x / 6, y / 2, 41) - 0.5) * 0.35;
      if (d > 1 || img.alpha(x, y) === 0) continue;
      const rim = d > 0.82 && y < 279;
      img.set(x, y, rim ? hex('#5a90aa') : ditherRamp(water, 0.3 + (1 - d) * 0.6, x, y));
      if (!rim && d < 0.75 && (x * 7 + y * 13) % 17 === 0) img.set(x, y, y < 279 ? hex('#4a8aa6') : hex('#b04a88'));
    }
  }
  // a bin stands left of the machine: what is under it gets no light
  for (let y = MACHINE_FOOT - 2; y < MACHINE_FOOT + 4; y++) {
    for (let x = BIN.x - 13; x < BIN.x + 14; x++) {
      if (img.alpha(x, y) === 0) continue;
      const d = Math.hypot((x - BIN.x) / 14, (y - BIN.foot) / 2.5);
      if (d < 1) img.set(x, y, mix(img.get(x, y), [4, 5, 10, 255], 0.6 * (1 - d)));
    }
  }
  return img;
}

/**
 * The light the window casts onto the wall and the pavement, a soft glow in steps of alpha; the
 * tube flickers, and the light with it.
 * @param {number} strength 1 at full light
 */
function paintLight(strength) {
  const img = blank();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const pool = 0.42 * falloff(Math.hypot((x - 232) / 160, (y - 264) / 28));
      const halo = y < WALL_FOOT ? 0.2 * falloff(Math.hypot((x - WINDOW_LIGHT.x) / 128, (y - WINDOW_LIGHT.y) / 118)) : 0;
      const a = Math.max(pool, halo) * strength;
      const steps = Math.floor(a * 12 + bayer(x, y));
      if (steps <= 0) continue;
      img.set(x, y, withAlpha(LIGHT, Math.min(255, steps * 20)));
    }
  }
  return img;
}

// --- the machine ---------------------------------------------------------------------------------

/**
 * A rectangle with a bevel: the top and left edge light, the bottom and right edge dark.
 * @param {Img} img
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {RGBA[]} ramp
 * @param {number} light
 * @param {boolean} [sunken] dark top left, light bottom right
 */
function bevel(img, x0, y0, x1, y1, ramp, light, sunken = false) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let l = light - ((y - y0) / Math.max(1, y1 - y0)) * 0.12;
      const topLeft = x === x0 || y === y0;
      const bottomRight = x === x1 - 1 || y === y1 - 1;
      if (topLeft) l += sunken ? -0.3 : 0.28;
      else if (bottomRight) l += sunken ? 0.22 : -0.3;
      img.set(x, y, ditherRamp(ramp, l, x, y));
    }
  }
}

/** The cabinet: everything of the machine that does not move. */
function paintCabinet() {
  const img = blank();
  const {x0, x1, y0, y1} = BODY_BOX;
  // the front: lit pink from the sign at the top, darker towards the street, a light left edge
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const t = (y - y0) / (y1 - y0);
      let light = 0.62 - 0.26 * t + 0.3 * Math.max(0, 1 - (y - y0) / 16);
      if (x < x0 + 3) light += 0.22;
      if (x > x1 - 4) light -= 0.18;
      light += (valueNoise(x / 6, y / 9, 51) - 0.5) * 0.06;
      img.set(x, y, ditherRamp(BODY, light, x, y));
    }
  }
  // the side, foreshortened, its top slanting back
  for (let x = x1; x < SIDE_X1; x++) {
    const top = y0 + 4 + Math.floor((x - x1) / 2);
    for (let y = top; y < y1 - 2; y++) {
      const light = 0.55 - 0.3 * ((y - y0) / (y1 - y0)) - (x - x1) * 0.03;
      img.set(x, y, ditherRamp(BODY_SIDE, light, x, y));
    }
  }
  // the sign box on top: a dark plate in a chrome frame, four bolts
  bevel(img, SIGN_BOX.x0, SIGN_BOX.y0, SIGN_BOX.x1, SIGN_BOX.y1, CHROME, 0.62);
  bevel(img, SIGN_BOX.x0 + 2, SIGN_BOX.y0 + 2, SIGN_BOX.x1 - 2, SIGN_BOX.y1 - 2, PLATE, 0.45, true);
  for (const [bx, by] of [
    [SIGN_BOX.x0 + 4, SIGN_BOX.y0 + 4],
    [SIGN_BOX.x1 - 5, SIGN_BOX.y0 + 4],
    [SIGN_BOX.x0 + 4, SIGN_BOX.y1 - 5],
    [SIGN_BOX.x1 - 5, SIGN_BOX.y1 - 5],
  ]) {
    img.set(bx, by, CHROME[4]);
  }
  // the sign box stands on the cabinet on a chrome lip
  img.fillRect(SIGN_BOX.x0 - 4, y0, SIGN_BOX.x1 - SIGN_BOX.x0 + 8, 1, CHROME[4]);
  img.fillRect(SIGN_BOX.x0 - 4, y0 + 1, SIGN_BOX.x1 - SIGN_BOX.x0 + 8, 1, CHROME[2]);

  paintWindow(img);
  paintPanel(img);

  // the chrome trim under the window, the bay, a grille beside it
  for (let x = x0 + 2; x < x1 - 2; x++) {
    img.set(x, 200, CHROME[4]);
    img.set(x, 201, CHROME[2]);
    img.set(x, 202, BODY[1]);
  }
  bevel(img, BAY.x0 - 2, BAY.y0 - 2, BAY.x1 + 2, BAY.y1 + 2, CHROME, 0.5, true);
  for (let y = BAY.y0; y < BAY.y1; y++) {
    for (let x = BAY.x0; x < BAY.x1; x++) {
      // the inside of the bay, a little light on its floor
      const light = y > BAY.y1 - 6 ? 0.28 + (y - (BAY.y1 - 6)) * 0.03 : 0.06;
      img.set(x, y, ditherRamp(INTERIOR, light, x, y));
    }
  }
  for (let y = 208; y < 234; y += 3) {
    img.fillRect(278, y, 26, 1, BODY[0]);
    img.fillRect(278, y + 1, 26, 1, BODY[4]);
  }
  // the plinth with its kick plate and its vents
  for (let y = 240; y < y1; y++) {
    for (let x = x0; x < x1; x++) img.set(x, y, ditherRamp(BODY, 0.22 - (y - 240) * 0.012, x, y));
  }
  img.fillRect(x0, 240, x1 - x0, 1, CHROME[3]);
  for (let y = 243; y < 248; y += 2) img.fillRect(192, y, 84, 1, OUTLINE);
  // the feet
  for (const fx of [164, 294]) {
    img.fillRect(fx, y1, 12, MACHINE_FOOT - y1, hex('#14141c'));
    img.fillRect(fx, y1, 12, 1, hex('#3a3a4a'));
  }
  // wear: scratches on the enamel, light, never on the glass or the panel
  const scratches = new Rng(97);
  for (let i = 0; i < 70; i++) {
    const x = scratches.int(x0 + 2, x1 - 3);
    const y = scratches.int(y0 + 4, 238);
    const onEnamel = !(x >= WINDOW.x0 - 2 && x < PANEL.x1 + 1 && y >= WINDOW.y0 - 2 && y < 203);
    if (onEnamel && !(x >= BAY.x0 - 3 && x < BAY.x1 + 3 && y >= BAY.y0 - 3)) img.set(x, y, BODY[6]);
  }
  img.outline(OUTLINE);
  return img;
}

/**
 * The window of the machine, cut into the cabinet: a chrome frame, the lit inside, the shelves with
 * their price labels.
 * @param {Img} img
 */
function paintWindow(img) {
  const {x0, x1, y0, y1} = WINDOW;
  bevel(img, x0 - 2, y0 - 2, x1 + 2, y1 + 2, CHROME, 0.6, true);
  const tops = [y0, SHELVES[0] + 6, SHELVES[1] + 6];
  for (let y = y0; y < y1; y++) {
    const top = tops.filter((t) => t <= y).at(-1) ?? y0;
    for (let x = x0; x < x1; x++) {
      // each compartment bright under the shelf above it, darker to its floor; the side walls darker
      let light = 0.62 - 0.32 * ((y - top) / 40);
      if (x < x0 + 3 || x >= x1 - 3) light -= 0.22;
      img.set(x, y, ditherRamp(INTERIOR, light, x, y));
    }
  }
  // the tube's fitting: a dark rail under the top of the window
  img.fillRect(x0 + 2, y0, x1 - x0 - 4, 1, INTERIOR[0]);
  img.fillRect(x0 + 3, y0 + 1, 2, 4, CHROME[2]);
  img.fillRect(x1 - 5, y0 + 1, 2, 4, CHROME[2]);
  for (const s of SHELVES) {
    for (let x = x0; x < x1; x++) {
      img.set(x, s, CHROME[4]);
      for (let j = 1; j < 5; j++) img.set(x, s + j, ditherRamp(CHROME, 0.62 - j * 0.1, x, s + j));
      img.set(x, s + 5, INTERIOR[0]);
    }
    for (const cx of COLUMNS) {
      img.fillRect(cx - 4, s + 2, 8, 3, hex('#e8ecf2'));
      img.fillRect(cx - 3, s + 3, 2, 1, hex('#3a3f4c'));
      img.fillRect(cx, s + 3, 3, 1, hex('#c83c3c'));
    }
  }
}

/** @param {Img} img */
function paintPanel(img) {
  bevel(img, PANEL.x0, PANEL.y0, PANEL.x1, PANEL.y1, PLATE, 0.62);
  // the display window, dark; the display layer lights it
  bevel(img, DISPLAY.x0, DISPLAY.y0, DISPLAY.x1, DISPLAY.y1, CHROME.slice(0, 3), 0.6, true);
  img.fillRect(DISPLAY.x0 + 1, DISPLAY.y0 + 1, DISPLAY.x1 - DISPLAY.x0 - 2, DISPLAY.y1 - DISPLAY.y0 - 2, hex('#0a0605'));
  // the keypad
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const bx = 284 + col * 7;
      const by = 74 + row * 7;
      const ramp = row === 3 && col === 0 ? pal(['#3a0c10', '#7a1c22', '#c83c3c', '#ff7a6a']) : CHROME;
      const body = row === 3 && col === 2 ? pal(['#0c3a1c', '#1c7a3c', '#3cc86a', '#9affb0']) : ramp;
      bevel(img, bx, by, bx + 5, by + 5, body, 0.62);
      img.set(bx + 2, by + 2, body[1]);
    }
  }
  // the coin slot, its plate and a ring of warm light round the slot
  bevel(img, 285, 104, 302, 124, CHROME, 0.58);
  for (let y = 107; y < 121; y++) {
    for (let x = 291; x < 296; x++) {
      const edge = x === 291 || x === 295 || y === 107 || y === 120;
      img.set(x, y, edge ? hex('#ff9a3a') : x === 292 || x === 294 ? hex('#ffd08a') : hex('#05060a'));
    }
  }
  // the bill slot, an arrow of green light above it
  img.fillRect(285, 133, 17, 2, hex('#05060a'));
  img.fillRect(285, 135, 17, 1, CHROME[3]);
  for (const ax of [289, 293, 297]) {
    img.set(ax, 129, hex('#5cf08a'));
    img.set(ax - 1, 130, hex('#5cf08a'));
    img.set(ax + 1, 130, hex('#5cf08a'));
  }
  // a sticker with a moon, its top right corner peeling
  for (let y = 144; y < 162; y++) {
    for (let x = 285; x < 302; x++) {
      if (x - 301 + (144 - y) > -4) {
        if (x - 301 + (144 - y) > -2) continue;
        img.set(x, y, hex('#fff2b0'));
        continue;
      }
      img.set(x, y, ditherRamp(pal(['#a87a1c', '#d8a432', '#f2c94c']), 0.75 - (y - 144) * 0.02, x, y));
    }
  }
  for (let y = 147; y < 159; y++) {
    for (let x = 287; x < 299; x++) {
      const inMoon = Math.hypot(x + 0.5 - 293, y + 0.5 - 153) < 5;
      const bitten = Math.hypot(x + 0.5 - 295.5, y + 0.5 - 151.5) < 4.2;
      if (inMoon && !bitten) img.set(x, y, hex('#2a1a3a'));
    }
  }
  // the coin return, round
  ball(img, 293.5, 176.5, 3.5, 3.5, CHROME);
  img.fillRect(289, 183, 9, 1, CHROME[1]);
}

/**
 * The fluorescent tube at the top of the window.
 * @param {'on' | 'dim' | 'off'} state
 */
function paintTube(state) {
  const img = blank();
  const x0 = WINDOW.x0 + 5;
  const x1 = WINDOW.x1 - 5;
  const rows = {
    on: pal(['#a6f2ff', '#f4ffff', '#7fdcec']),
    dim: pal(['#4d8896', '#8ab6c0', '#3d6c78']),
    off: pal(['#24343e', '#34485a', '#1c2a34']),
  }[state];
  for (let x = x0; x < x1; x++) {
    for (let j = 0; j < 3; j++) img.set(x, WINDOW.y0 + 1 + j, rows[j]);
  }
  // the dark ends of the tube; an off tube keeps a faint glow at one end
  for (const ex of [x0, x0 + 1, x1 - 2, x1 - 1]) for (let j = 0; j < 3; j++) img.set(ex, WINDOW.y0 + 1 + j, CHROME[1]);
  if (state === 'off') img.fillRect(x0 + 2, WINDOW.y0 + 2, 3, 1, hex('#7a4a68'));
  if (state === 'on') {
    for (let x = x0 + 2; x < x1 - 2; x++) img.blend(x, WINDOW.y0 + 4, withAlpha(LIGHT, 110));
  }
  return img;
}

/**
 * A spring coil round the front of a good, seen end on: the loop nearest the glass with a gap where
 * the wire's free end stands, and two loops further back, smaller and darker, seen only beside the
 * good, which hides them where it stands in front of them. The gap turns as the coil turns.
 * @param {Img} img
 * @param {number} cx
 * @param {number} shelf
 * @param {number} gap the angle of the gap, degrees, clockwise from the right
 * @param {Img} good the picture of the good inside the coil
 */
function coilAt(img, cx, shelf, gap, good) {
  const shade = CHROME.slice(1);
  for (let loop = 2; loop >= 0; loop--) {
    const rx = 11 - loop * 1.5;
    const ry = 10 - loop * 1.5;
    const cy = shelf - 11 - loop * 1.5;
    for (let a = 0; a < 360; a += 0.5) {
      const rel = (((a - gap - loop * 120) % 360) + 360) % 360;
      if (loop === 0 && rel < 48) continue;
      const rad = (a * Math.PI) / 180;
      const x = Math.floor(cx + rx * Math.cos(rad));
      const y = Math.floor(cy + ry * Math.sin(rad));
      if (loop > 0 && good.alpha(x, y) !== 0) continue;
      // lit from the upper left; the wire nearest its free end is the brightest, the far loops dark
      const light = 0.35 + 0.4 * Math.cos(rad - (225 * Math.PI) / 180) + (loop === 0 && rel < 60 ? 0.3 : 0) - loop * 0.32;
      const c = shade[Math.max(0, Math.min(shade.length - 1, Math.round(light * (shade.length - 1))))];
      if (loop === 0 || img.alpha(x, y) === 0) img.set(x, y, c);
    }
  }
}

/**
 * The display: one word of red LEDs, a faint glow round them.
 * @param {string} word
 */
function paintDisplay(word) {
  const img = blank();
  const w = miniWidth(word);
  const x = DISPLAY.x0 + Math.floor((DISPLAY.x1 - DISPLAY.x0 - w) / 2);
  const y = DISPLAY.y0 + 4;
  const lit = blank();
  miniText(lit, word, x, y, LED);
  for (let j = y - 1; j < y + 6; j++) {
    for (let i = x - 1; i < x + w + 1; i++) {
      if (lit.alpha(i, j)) continue;
      const near = lit.alpha(i - 1, j) || lit.alpha(i + 1, j) || lit.alpha(i, j - 1) || lit.alpha(i, j + 1);
      if (near) img.set(i, j, withAlpha(LED, 70));
    }
  }
  img.blit(lit, 0, 0);
  return img;
}

/** The flap of the bay: smoked plastic on a hinge at its top, "PUSH" on it. */
function paintFlap() {
  const img = blank();
  const {x0, x1, y0, y1} = FLAP;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const streak = (x - x0 + (y - y0) * 2) % 37 < 3;
      const c = y === y0 ? CHROME[4] : y === y1 - 1 ? CHROME[2] : streak ? hex('#3a4a5e') : hex('#18202e');
      img.set(x, y, withAlpha(c, y === y0 || y === y1 - 1 ? 255 : 225));
    }
  }
  miniText(img, 'PUSH', Math.floor((x0 + x1 - miniWidth('PUSH')) / 2), y0 + 8, hex('#8a96a8'));
  return img;
}

/**
 * The neon sign: "NIGHT SHIFT" in pink glass tubes between a moon and a star, glowing. Each tube is
 * on, dim or off.
 * @param {TrueTypeFont} font
 * @param {(index: number) => 'on' | 'dim' | 'off'} stateOf the state of the tube of each letter; the moon is -1, the star -2
 */
function paintSign(font, stateOf) {
  const text = 'NIGHT SHIFT';
  /** @type {Map<number, number>} which tube a pixel belongs to */
  const tube = new Map();
  const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ index) => tube.set(y * W + x, index);
  const glyphs = [...text].map((ch) => font.rasterize(ch.codePointAt(0) ?? 32, 8));
  const width = glyphs.reduce((sum, g) => sum + (g?.advance ?? 0), 0);
  // centred between the moon and the star
  let gx = 235 - Math.floor(width / 2);
  const top = SIGN_BOX.y0 + 8;
  glyphs.forEach((g, index) => {
    if (g === undefined) return;
    for (let y = 0; y < g.height; y++)
      for (let x = 0; x < g.width; x++) if (g.mask[y * g.width + x]) put(gx + x, top + y - (g.baseline - 8), index);
    gx += g.advance;
  });
  // a crescent moon on the left, a four-pointed star on the right
  for (let y = SIGN_BOX.y0 + 5; y < SIGN_BOX.y1 - 5; y++) {
    for (let x = SIGN_BOX.x0 + 6; x < SIGN_BOX.x0 + 20; x++) {
      const d = Math.hypot(x + 0.5 - (SIGN_BOX.x0 + 13), y + 0.5 - (SIGN_BOX.y0 + 12));
      const bite = Math.hypot(x + 0.5 - (SIGN_BOX.x0 + 16), y + 0.5 - (SIGN_BOX.y0 + 10));
      if (d < 6.5 && d >= 5.3 && bite > 5.2) put(x, y, -1);
      if (d < 6.5 && bite <= 5.2 && bite > 4) put(x, y, -1);
    }
  }
  const sx = SIGN_BOX.x1 - 14;
  const sy = SIGN_BOX.y0 + 12;
  for (let i = -5; i <= 5; i++) {
    put(sx + i, sy, -2);
    put(sx, sy + i, -2);
  }
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    put(sx + dx, sy + dy, -2);
  }

  const img = blank();
  const glowOf = {on: 1, dim: 0.45, off: 0};
  // the glow first: by the distance to the nearest lit tube
  for (let y = SIGN_BOX.y0 - 3; y < SIGN_BOX.y1 + 3; y++) {
    for (let x = SIGN_BOX.x0 - 3; x < SIGN_BOX.x1 + 3; x++) {
      if (tube.has(y * W + x)) continue;
      let best = 0;
      for (let j = -3; j <= 3; j++) {
        for (let i = -3; i <= 3; i++) {
          const index = tube.get((y + j) * W + x + i);
          if (index === undefined) continue;
          const d = Math.max(Math.abs(i), Math.abs(j));
          best = Math.max(best, [0, 150, 80, 34][d] * glowOf[stateOf(index)]);
        }
      }
      const a = Math.floor(best / 24 + bayer(x, y)) * 24;
      if (a > 0) img.set(x, y, withAlpha(NEON_GLOW, Math.min(200, a)));
    }
  }
  // then the tubes: a pale core where a tube is thick, the pink round it; dim and dark glass
  for (const [key, index] of tube) {
    const x = key % W;
    const y = Math.floor(key / W);
    const state = stateOf(index);
    const neighbours = [tube.has(key - 1), tube.has(key + 1), tube.has(key - W), tube.has(key + W)].filter(Boolean).length;
    const c = state === 'off' ? NEON_OFF : state === 'dim' ? NEON_DIM : neighbours >= 3 ? NEON_CORE : NEON_TUBE;
    img.set(x, y, c);
  }
  return img;
}

// --- the goods -----------------------------------------------------------------------------------

/** @typedef {(img: Img, cx: number, shelf: number, frame: number) => void} GoodPainter */

const STEEL_BLUE = pal(['#1e2c44', '#2b3f5c', '#3f5f85', '#5f87b0', '#93b9da', '#d4ecff']);
const LABEL_WHITE = pal(['#6a7686', '#8b98a8', '#b9c4d0', '#e3ebf2']);
const BRASS = pal(['#3a2408', '#5e3f12', '#9a6a1e', '#d4a03a', '#f6dc8a']);
const YELLOW = pal(['#6a3e08', '#a8681a', '#e0a020', '#f6cc3a', '#fff08a']);
const GREEN = pal(['#0c2a16', '#123a1e', '#1e5a2c', '#2e8040', '#56aa5a', '#9ad47a']);
const TERRACOTTA = pal(['#3a160a', '#5a2614', '#8a3e20', '#b85a30', '#e08050']);
const CREAM = pal(['#7a6a58', '#a8988a', '#d8ccbc', '#f4ecdc']);
const RED = pal(['#4a0c10', '#7a1c22', '#b8302e', '#e85a46']);
const SILVER = pal(['#2a2e3a', '#4a5262', '#7a8496', '#b4bccc', '#eef2f8']);
const DARK_GREY = pal(['#101218', '#1a1c24', '#2a2d38', '#3e4252', '#5a6072']);
const COPPER = pal(['#3a1a06', '#5a2a0a', '#a85a18', '#e89a3a', '#ffd08a']);

/** @type {Record<string, GoodPainter>} */
const GOODS = {
  // a tin of rain: a cloud on its label, the rain falling out of it
  'canned-rain'(img, cx, s) {
    cylinder(img, cx - 7, s - 22, 14, 22, STEEL_BLUE);
    cylinder(img, cx - 7, s - 17, 14, 11, LABEL_WHITE, 0.05);
    for (let x = cx - 6; x < cx + 7; x++) img.set(x, s - 22, STEEL_BLUE[5]);
    img.fillRect(cx - 7, s - 21, 14, 1, STEEL_BLUE[2]);
    img.fillRect(cx - 1, s - 23, 3, 1, STEEL_BLUE[1]);
    img.fillRect(cx - 7, s - 1, 14, 1, STEEL_BLUE[0]);
    ascii(img, cx - 4, s - 16, ['..##...', '.####..', '#######', '.#####.'], {'#': hex('#6f8aa8')});
    ascii(img, cx - 3, s - 11, ['#.#.#', '.#.#.', '#...#'], {'#': hex('#2a6ad0')});
  },
  // a spare moon in a blister on a card
  'spare-moon'(img, cx, s) {
    for (let y = s - 26; y < s; y++) {
      for (let x = cx - 9; x < cx + 9; x++)
        img.set(x, y, ditherRamp(pal(['#101838', '#1a2650', '#26346a']), 0.8 - (y - s + 26) * 0.025, x, y));
    }
    img.fillRect(cx - 2, s - 24, 4, 1, GOOD_OUTLINE);
    img.fillRect(cx - 6, s - 21, 12, 2, hex('#f0d468'));
    for (const [x, y] of [
      [cx - 7, s - 18],
      [cx + 6, s - 23],
      [cx + 7, s - 5],
      [cx - 7, s - 4],
    ]) {
      img.set(x, y, hex('#fff3b0'));
    }
    for (let y = s - 17; y < s - 3; y++) {
      for (let x = cx - 7; x < cx + 7; x++) {
        const edge = x === cx - 7 || x === cx + 6 || y === s - 17 || y === s - 4;
        const corner = (x === cx - 7 || x === cx + 6) && (y === s - 17 || y === s - 4);
        if (corner) continue;
        img.set(x, y, edge ? hex('#a7c6e0') : hex('#2c3c72'));
      }
    }
    const moon = blank();
    ball(moon, cx + 0.5, s - 10, 5.5, 5.5, pal(['#8a6a20', '#c9a640', '#f0d468', '#fff3b0']), 0.15);
    for (let y = s - 17; y < s - 3; y++) {
      for (let x = cx - 7; x < cx + 7; x++)
        if (Math.hypot(x + 0.5 - (cx + 3.5), y + 0.5 - (s - 12)) < 5) moon.set(x, y, [0, 0, 0, 0]);
    }
    img.blit(moon, 0, 0);
    img.set(cx - 5, s - 15, hex('#e8f4ff'));
    img.set(cx - 5, s - 14, hex('#e8f4ff'));
  },
  // an old brass key nobody came back for, on a stand, with its tag
  'lost-key'(img, cx, s) {
    img.fillRect(cx - 6, s - 3, 12, 3, hex('#14161e'));
    img.fillRect(cx - 6, s - 3, 12, 1, hex('#3a3e4c'));
    const key = blank();
    for (let y = s - 27; y < s - 17; y++) {
      for (let x = cx - 5; x < cx + 5; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - (s - 22));
        if (d < 4.8 && d >= 2) key.set(x, y, ditherRamp(BRASS, 0.75 - (x - cx) * 0.08 - (y - s + 27) * 0.03, x, y));
      }
    }
    cylinder(key, cx - 1, s - 18, 3, 15, BRASS, 0.1);
    for (const [y, w] of [
      [s - 10, 3],
      [s - 9, 2],
      [s - 8, 4],
      [s - 7, 4],
      [s - 6, 2],
      [s - 5, 3],
    ]) {
      for (let x = cx + 2; x < cx + 2 + w; x++) key.set(x, y, ditherRamp(BRASS, 0.55, x, y));
    }
    img.blit(key, 0, 0);
    img.line(cx - 4, s - 25, cx - 8, s - 21, hex('#c8c0a8'));
    for (let y = s - 21; y < s - 11; y++) {
      for (let x = cx - 11; x < cx - 5; x++)
        img.set(x, y, ditherRamp(pal(['#8f7e5c', '#c2ae84', '#e8dcb8']), 0.85 - (x - cx + 11) * 0.06, x, y));
    }
    img.set(cx - 8, s - 20, GOOD_OUTLINE);
    ascii(img, cx - 10, s - 18, ['##.', '..#', '.#.', '...', '.#.'], {'#': hex('#c83c3c')});
  },
  // a light bulb that has not quite gone out
  'night-light'(img, cx, s) {
    const glass = pal(['#5a4a32', '#a08654', '#e2c47e', '#fff0bc', '#fffbe8']);
    ball(img, cx, s - 19, 6.5, 7, glass, 0.12);
    for (let y = s - 13; y < s - 10; y++) {
      const half = 4 - (y - (s - 13));
      for (let x = cx - half; x < cx + half; x++) img.set(x, y, ditherRamp(glass, 0.6 - (x - cx) * 0.05, x, y));
    }
    for (let y = s - 10; y < s - 3; y++) {
      for (let x = cx - 3; x < cx + 3; x++) img.set(x, y, (y - s) % 2 === 0 ? SILVER[3 - (x >= cx ? 1 : 0)] : SILVER[1]);
    }
    img.fillRect(cx - 2, s - 3, 4, 2, GOOD_OUTLINE);
    img.fillRect(cx - 1, s - 1, 2, 1, SILVER[2]);
    ascii(img, cx - 3, s - 21, ['.#.#.#', '#.#.#.'], {'#': hex('#ff9a40')});
    img.set(cx - 2, s - 19, hex('#fff2c0'));
    img.set(cx + 1, s - 19, hex('#fff2c0'));
    img.set(cx - 2, s - 23, hex('#ffffff'));
    img.set(cx - 3, s - 22, hex('#ffffff'));
  },
  // a goldfish in a bag of water, swimming back and forth
  goldfish(img, cx, s, frame) {
    const bag = blank();
    bag.ellipse(cx, s - 11, 9, 10.5, [255, 255, 255, 255]);
    for (let y = s - 26; y < s - 19; y++) {
      const half = Math.max(1.5, 4 - (s - 19 - y) * 0.45);
      for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) bag.set(x, y, [255, 255, 255, 255]);
    }
    const water = pal(['#103a58', '#1e5a7e', '#3486aa', '#6ec0dc', '#a8e4f2']);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (bag.alpha(x, y) === 0) continue;
        const edge = !bag.alpha(x - 1, y) || !bag.alpha(x + 1, y) || !bag.alpha(x, y - 1) || !bag.alpha(x, y + 1);
        if (edge) img.set(x, y, withAlpha(hex('#c8ecf8'), 235));
        else if (y >= s - 17) {
          const light = 0.65 - ((y - (s - 17)) / 16) * 0.4 - (x - cx) * 0.02;
          img.set(x, y, withAlpha(ditherRamp(water, light, x, y), 205));
        } else img.set(x, y, withAlpha(hex('#cfe8f4'), 60));
      }
    }
    img.fillRect(cx - 5, s - 17, 10, 1, withAlpha(hex('#c8f0fa'), 230));
    img.fillRect(cx - 2, s - 27, 4, 2, hex('#d03a3a'));
    img.fillRect(cx - 3, s - 29, 2, 2, withAlpha(hex('#c8ecf8'), 235));
    img.fillRect(cx + 1, s - 29, 2, 2, withAlpha(hex('#c8ecf8'), 235));
    img.set(cx - 6, s - 15, hex('#ffffff'));
    img.set(cx - 7, s - 13, hex('#ffffff'));
    // the fish: three places swimming right, then three swimming left; frame 0 is its rest
    const path = [
      {dx: -1, left: false},
      {dx: -3, left: false},
      {dx: -1, left: false},
      {dx: 1, left: false},
      {dx: 1, left: true},
      {dx: -1, left: true},
      {dx: -3, left: true},
    ];
    const {dx, left} = path[frame];
    const tailUp = frame % 2 === 0;
    const fish = ['....o...', `${tailUp ? 't' : '.'}.oOOo..`, 'ttOOOOeo', `${tailUp ? '.' : 't'}.oOOo..`, '....o...'];
    ascii(img, cx + dx - 4, s - 12, fish, {o: hex('#e8641e'), O: hex('#ff9a3a'), t: hex('#ffc070'), e: hex('#1a0a06')}, left);
    // a bubble on its way up
    img.set(cx + 3 - (frame % 3), s - 16 + ((frame * 2) % 5), withAlpha(hex('#ffffff'), 200));
  },
  // a mixtape, side B
  cassette(img, cx, s) {
    for (let y = s - 14; y < s; y++) {
      for (let x = cx - 11; x < cx + 11; x++) {
        if ((x === cx - 11 || x === cx + 10) && (y === s - 14 || y === s - 1)) continue;
        img.set(x, y, ditherRamp(DARK_GREY, 0.7 - (y - s + 14) * 0.03 + (x === cx - 11 || y === s - 14 ? 0.25 : 0), x, y));
      }
    }
    img.fillRect(cx - 9, s - 12, 18, 7, hex('#e8dcc0'));
    img.fillRect(cx - 9, s - 12, 18, 1, hex('#ff6aa8'));
    img.fillRect(cx - 9, s - 11, 18, 1, hex('#ff6aa8'));
    img.line(cx - 8, s - 9, cx - 2, s - 9, hex('#3a2a4a'));
    img.set(cx + 6, s - 9, hex('#3a2a4a'));
    img.set(cx + 7, s - 9, hex('#3a2a4a'));
    img.fillRect(cx - 5, s - 8, 10, 3, hex('#14141c'));
    img.fillRect(cx - 4, s - 7, 2, 2, hex('#e8eef7'));
    img.fillRect(cx + 2, s - 7, 2, 2, hex('#e8eef7'));
    img.fillRect(cx - 1, s - 7, 2, 1, hex('#5a3a2a'));
    for (let y = s - 4; y < s - 1; y++) {
      const inset = s - 1 - y;
      img.fillRect(cx - 7 + inset, y, 14 - 2 * inset, 1, DARK_GREY[4]);
    }
    img.set(cx - 4, s - 3, GOOD_OUTLINE);
    img.set(cx + 3, s - 3, GOOD_OUTLINE);
    for (const [x, y] of [
      [cx - 10, s - 13],
      [cx + 9, s - 13],
      [cx - 10, s - 2],
      [cx + 9, s - 2],
    ]) {
      img.set(x, y, SILVER[3]);
    }
  },
  // two tins of sardines, the key on the top one
  sardines(img, cx, s) {
    for (const top of [s - 7, s - 14]) {
      for (let y = top; y < top + 7; y++) {
        for (let x = cx - 10; x < cx + 10; x++) {
          if ((x === cx - 10 || x === cx + 9) && (y === top || y === top + 6)) continue;
          img.set(x, y, ditherRamp(SILVER, 0.82 - (y - top) * 0.1 - (x - cx) * 0.01, x, y));
        }
      }
      img.fillRect(cx - 8, top + 2, 16, 3, hex('#2a4a8a'));
      img.fillRect(cx - 8, top + 2, 16, 1, hex('#c83c3c'));
      ascii(img, cx - 4, top + 3, ['#.####.', '.######'], {'#': SILVER[4]});
    }
    img.line(cx - 8, s - 16, cx - 3, s - 16, SILVER[3]);
    img.fillRect(cx - 9, s - 17, 2, 2, SILVER[4]);
  },
  // a rubber duck, facing left
  'rubber-duck'(img, cx, s) {
    ball(img, cx + 1, s - 5.5, 8, 5.5, YELLOW);
    fillTriangle(
      img,
      [
        [cx + 6, s - 7],
        [cx + 10, s - 12],
        [cx + 9, s - 5],
      ],
      YELLOW[2],
    );
    ball(img, cx - 3, s - 13, 4.5, 4.5, YELLOW, 0.05);
    img.fillRect(cx - 9, s - 13, 3, 2, hex('#ff8a2a'));
    img.fillRect(cx - 9, s - 11, 3, 1, hex('#c8541a'));
    img.set(cx - 4, s - 15, GOOD_OUTLINE);
    img.set(cx - 5, s - 15, hex('#ffffff'));
    img.line(cx, s - 7, cx + 4, s - 5, YELLOW[1]);
  },
  // a small cactus in a terracotta pot, one flower
  cactus(img, cx, s) {
    for (let y = s - 8; y < s; y++) {
      const half = 6 - Math.floor((y - (s - 8)) / 3);
      cylinder(img, cx - half, y, half * 2, 1, TERRACOTTA, y < s - 6 ? 0.2 : 0);
    }
    img.fillRect(cx - 5, s - 9, 10, 1, hex('#2a160c'));
    const plant = blank();
    cylinder(plant, cx - 3, s - 22, 7, 13, GREEN);
    ball(plant, cx + 0.5, s - 22, 3.5, 3, GREEN, 0.1);
    cylinder(plant, cx + 4, s - 20, 4, 6, GREEN, 0.05);
    ball(plant, cx + 6, s - 20, 2, 2, GREEN, 0.1);
    plant.fillRect(cx + 3, s - 15, 2, 2, GREEN[2]);
    img.blit(plant, 0, 0);
    for (let y = s - 23; y < s - 9; y += 3) {
      img.set(cx - 2, y, hex('#e8f0c0'));
      img.set(cx + 2, y + 1, hex('#e8f0c0'));
    }
    img.set(cx + 7, s - 19, hex('#e8f0c0'));
    ascii(img, cx - 1, s - 27, ['.p.', 'pyp', '.p.'], {p: hex('#ff7ab0'), y: hex('#ffe066')});
  },
  // two batteries, a spare charge for the night
  batteries(img, cx, s) {
    for (const bx of [cx - 7, cx + 1]) {
      cylinder(img, bx, s - 17, 6, 6, COPPER);
      cylinder(img, bx, s - 11, 6, 11, DARK_GREY, 0.08);
      img.fillRect(bx, s - 11, 6, 1, SILVER[3]);
      img.fillRect(bx + 2, s - 19, 2, 2, SILVER[3]);
      img.set(bx + 2, s - 15, hex('#ffe8c0'));
    }
  },
  // a cup of instant noodles
  'instant-noodles'(img, cx, s) {
    for (let y = s - 20; y < s; y++) {
      const half = Math.round(9 - ((y - (s - 20)) / 19) * 2);
      const ramp = y < s - 15 ? RED : CREAM;
      cylinder(img, cx - half, y, half * 2, 1, ramp, -((y - (s - 20)) / 20) * 0.08);
    }
    for (let x = cx - 9; x < cx + 9; x++) img.set(x, s - 21, SILVER[x < cx ? 4 : 3]);
    img.fillRect(cx - 10, s - 22, 3, 2, SILVER[4]);
    ball(img, cx, s - 8.5, 4.5, 3.5, pal(['#a8301a', '#e8641e', '#ff9a3a']), 0.1);
    ascii(img, cx - 3, s - 10, ['#.#.#.', '.#.#.#', '#.#.#.'], {'#': hex('#ffe066')});
  },
  // a sock that lost its pair
  'lonely-sock'(img, cx, s) {
    const sock = blank();
    for (let y = s - 22; y < s - 5; y++) for (let x = cx - 6; x < cx + 1; x++) sock.set(x, y, [255, 255, 255, 255]);
    for (let y = s - 7; y < s; y++) for (let x = cx - 6; x < cx + 4; x++) sock.set(x, y, [255, 255, 255, 255]);
    sock.ellipse(cx + 4, s - 3.5, 3.5, 3.5, [255, 255, 255, 255]);
    sock.set(cx - 6, s - 1, [0, 0, 0, 0]);
    for (let y = 0; y < H; y++) {
      for (let x = cx - 8; x < cx + 9; x++) {
        if (sock.alpha(x, y) === 0) continue;
        const n = (x - (cx - 2.5)) / 4;
        let c;
        if (y < s - 18) c = (x - cx) % 2 === 0 ? CREAM[1] : CREAM[3];
        else if (x > cx + 1 || (x < cx - 3 && y > s - 5)) c = RED[2 + (n < 0 ? 1 : 0)];
        else c = Math.floor((y - s) / 3) % 2 === 0 ? hex('#2a8a8a') : hex('#e0a838');
        img.set(x, y, n > 0.6 && y < s - 6 ? mix(c, [0, 0, 0, 255], 0.3) : c);
      }
    }
  },
};

/** The goods behind the glass, by shelf and column; the coil of the cassette is the one that turns. */
const SLOTS = [
  ['canned-rain', 'spare-moon', 'lost-key', 'night-light'],
  ['goldfish', 'cassette', 'sardines', 'rubber-duck'],
  ['cactus', 'batteries', 'instant-noodles', 'lonely-sock'],
];
const TURNING = 'cassette';

/**
 * @param {string} name
 * @param {number} frame
 */
function paintGood(name, frame = 0) {
  const img = blank();
  SLOTS.forEach((row, r) => {
    const c = row.indexOf(name);
    if (c >= 0) GOODS[name](img, COLUMNS[c], SHELVES[r], frame);
  });
  img.outline(GOOD_OUTLINE);
  return img;
}

/** @param {string} name */
function slotOf(name) {
  for (let r = 0; r < SLOTS.length; r++) {
    const c = SLOTS[r].indexOf(name);
    if (c >= 0) return {cx: COLUMNS[c], shelf: SHELVES[r]};
  }
  throw new Error(`paint: no slot for ${name}`);
}

// --- the visitors --------------------------------------------------------------------------------

/**
 * A ribbed steel bin with a lid, left of the machine, lit from the right by its window; a crumpled
 * can on the lid.
 */
function paintBin() {
  const img = blank();
  const metal = pal(['#080a12', '#10141e', '#1a2030', '#263044', '#36445c', '#4a6078', '#6a8aa4']);
  const {x: cx, foot} = BIN;
  const top = foot - 30;
  for (let y = top; y < foot; y++) {
    // the body narrows a little to its foot
    const half = 11 - Math.floor((y - top) / 15);
    for (let x = cx - half; x < cx + half; x++) {
      const n = (x + 0.5 - cx) / half;
      const facing = Math.sqrt(Math.max(0, 1 - n * n));
      let light = 0.12 + 0.38 * facing + 0.34 * n - ((y - top) / 30) * 0.1;
      if ((x - cx + 64) % 5 === 0) light -= 0.16;
      if ((x - cx + 64) % 5 === 1) light += 0.08;
      if (y === top + 3 || y === foot - 4) light += 0.18;
      img.set(x, y, ditherRamp(metal, light, x, y));
    }
    // its right edge catches the window
    img.set(cx + half - 1, y, hex('#7fd6ea'));
  }
  // the lid, wider than the bin, and its handle
  for (let y = top - 4; y < top; y++) {
    for (let x = cx - 13; x < cx + 13; x++) {
      const n = (x + 0.5 - cx) / 13;
      img.set(x, y, ditherRamp(metal, 0.3 + 0.3 * n + (y === top - 4 ? 0.22 : 0), x, y));
    }
  }
  img.fillRect(cx + 12, top - 4, 1, 4, hex('#7fd6ea'));
  img.fillRect(cx - 4, top - 7, 8, 1, metal[5]);
  img.fillRect(cx - 4, top - 6, 1, 2, metal[4]);
  img.fillRect(cx + 3, top - 6, 1, 2, metal[5]);
  // a crumpled can of something red, left on the lid
  ascii(img, cx - 11, top - 9, ['.rr.', 'rRrs', 'rrRs', '.rs.', '.ss.'], {r: hex('#a8302e'), R: hex('#e85a46'), s: SILVER[3]});
  img.outline(OUTLINE);
  return img;
}

/**
 * A black cat sitting on the pavement, rim-lit by the window on its left; its tail swings.
 * @param {number} phase 0 … 5, the place of the tail
 * @param {boolean} blink
 */
function paintCat(phase, blink) {
  const {x: cx, foot} = CAT;
  const mask = blank();
  const on = /** @type {RGBA} */ ([255, 255, 255, 255]);
  mask.ellipse(cx, foot - 11, 8.5, 11, on);
  mask.ellipse(cx + 3, foot - 6, 8.5, 6, on);
  mask.ellipse(cx - 1, foot - 17, 6, 6, on);
  mask.ellipse(cx - 2, foot - 29, 7, 6, on);
  fillTriangle(
    mask,
    [
      [cx - 9, foot - 31],
      [cx - 7, foot - 39],
      [cx - 3, foot - 33],
    ],
    on,
  );
  fillTriangle(
    mask,
    [
      [cx, foot - 33],
      [cx + 3, foot - 39],
      [cx + 5, foot - 30],
    ],
    on,
  );
  mask.ellipse(cx - 4, foot - 1, 2.5, 1.5, on);
  mask.ellipse(cx + 1, foot - 1, 2.5, 1.5, on);
  // the tail: from the haunch out to the right and up, its tip somewhere on an arc
  const tips = [
    [15, -18],
    [16, -14],
    [17, -10],
    [16, -6],
    [14, -3],
    [12, -1],
  ];
  const [tx, ty] = tips[phase];
  const bx = cx + 9;
  const by = foot - 3;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * (bx + 9) + t * t * (bx + tx - 6);
    const y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * (by + 1) + t * t * (by + ty);
    mask.ellipse(x, y, 1.8 - t * 0.6, 1.8 - t * 0.6, on);
  }
  const img = blank();
  for (let y = foot - 42; y < foot + 1; y++) {
    for (let x = cx - 12; x < cx + 30; x++) {
      if (mask.alpha(x, y) === 0) continue;
      let c = hex('#0d0f1a');
      if (!mask.alpha(x - 1, y)) c = hex('#8fe6f4');
      else if (!mask.alpha(x - 2, y)) c = hex('#3f8ea8');
      else if (!mask.alpha(x, y - 1)) c = x < cx ? hex('#5a3a6a') : hex('#262c44');
      else if (!mask.alpha(x + 1, y) || y > foot - 3) c = hex('#07080f');
      img.set(x, y, c);
    }
  }
  // the inside of the ears, the eyes, the nose
  img.set(cx - 7, foot - 35, hex('#5a2a44'));
  img.set(cx + 3, foot - 35, hex('#3a1a2c'));
  for (const ex of [cx - 6, cx + 1]) {
    if (blink) img.fillRect(ex, foot - 29, 3, 1, hex('#4a6a20'));
    else {
      img.fillRect(ex, foot - 30, 3, 2, hex('#d8f070'));
      img.set(ex + 1, foot - 30, hex('#101408'));
      img.set(ex + 1, foot - 29, hex('#101408'));
    }
  }
  img.set(cx - 2, foot - 26, hex('#d07a8a'));
  return img;
}

/**
 * A moth at the sign, its wings up, out or down.
 * @param {'up' | 'out' | 'down'} wings
 */
function paintMoth(wings) {
  const art = {
    up: ['.w.....w.', '.ww...ww.', '.dWw.wWd.', '..dWbWd..', '....b....', '....b....', '.........'],
    out: ['.........', '.........', 'wwWw.wWww', '.ddWbWdd.', '...dbd...', '....b....', '.........'],
    down: ['.........', '.........', '....b....', '..dWbWd..', '.dWw.wWd.', '.ww.b.ww.', '.w.....w.'],
  }[wings];
  const img = blank();
  ascii(img, MOTH.x - 4, MOTH.y - 3, art, {w: hex('#c8bfa8'), W: hex('#ece4cc'), d: hex('#8a7f6a'), b: hex('#3a2e24')});
  img.outline(hex('#1a1420'));
  return img;
}

// --- the scene -----------------------------------------------------------------------------------

/**
 * Paints every picture and answers the scene: the layers bottom first, in their groups, with a
 * pivot for each moving part and a tag for each loop, named like the layer it loops.
 * @param {TrueTypeFont} font Press Start 2P, for the sign
 */
export function paintScene(font) {
  const scene = new Scene();

  // the loops, each on frames of its own after frame 0, the rest of every layer
  const sign = scene.tag('sign', [2000, 70, 90, 420, 1600, 60, 110, 80]);
  const coil = scene.tag('coil', [90, 90, 90, 90, 90, 90, 90, 90]);
  const tube = scene.tag('tube', [2600, 60, 90, 50, 140, 1800, 70, 120]);
  const light = scene.twin('light', 'tube');
  const display = scene.tag('display', [900, 500, 700, 1200]);
  const moth = scene.tag('moth', [50, 50, 50, 50]);
  const cat = scene.tag('cat', [400, 140, 120, 120, 140, 300], 'pingpong');
  const goldfish = scene.tag('goldfish', [180, 180, 180, 180, 180, 180]);

  const TUBE = /** @type {const} */ (['on', 'off', 'on', 'dim', 'off', 'on', 'dim', 'on']);
  const STRENGTH = {on: 1, dim: 0.5, off: 0.16};

  scene.group('street', 'depth=40', () => {
    scene.layer('wall').cels.set(0, paintWall());
    scene.layer('pavement').cels.set(0, paintPavement());
    const glow = scene.layer('light');
    glow.cels.set(0, paintLight(1));
    light.forEach((f, i) => glow.cels.set(f, paintLight(STRENGTH[TUBE[i]])));
  });

  scene.group('machine', undefined, () => {
    scene.layer('cabinet', {pivot: [(BODY_BOX.x0 + SIDE_X1) / 2, MACHINE_FOOT]}).cels.set(0, paintCabinet());
    const tubeLayer = scene.layer('tube');
    tubeLayer.cels.set(0, paintTube('on'));
    tube.forEach((f, i) => tubeLayer.cels.set(f, paintTube(TUBE[i])));

    scene.group('goods', undefined, () => {
      for (const row of SLOTS) {
        for (const name of row) {
          const {cx, shelf} = slotOf(name);
          const layer = scene.layer(name, {pivot: [cx, shelf]});
          layer.cels.set(0, paintGood(name));
          if (name === 'goldfish') goldfish.forEach((f, i) => layer.cels.set(f, paintGood(name, i + 1)));
        }
      }
    });

    // the coils in front of the goods: all of them still, but the one that turns
    const coils = blank();
    const gaps = new Rng(23);
    for (const row of SLOTS) {
      for (const name of row) {
        const {cx, shelf} = slotOf(name);
        const gap = gaps.int(0, 7) * 45;
        if (name !== TURNING) coilAt(coils, cx, shelf, gap, paintGood(name));
      }
    }
    scene.layer('coils').cels.set(0, coils);
    const turning = slotOf(TURNING);
    const coilLayer = scene.layer('coil', {pivot: [turning.cx, turning.shelf - 10]});
    const turningGood = paintGood(TURNING);
    const coilFrame = (/** @type {number} */ k) => {
      const img = blank();
      coilAt(img, turning.cx, turning.shelf, k * 45, turningGood);
      return img;
    };
    coilLayer.cels.set(0, coilFrame(0));
    coil.forEach((f, k) => coilLayer.cels.set(f, coilFrame(k)));

    scene.layer('glass').cels.set(0, paintGlass());

    const displayLayer = scene.layer('display');
    const WORDS = ['OPEN', 'ALL', 'NITE', '0.50'];
    displayLayer.cels.set(0, paintDisplay(WORDS[0]));
    display.forEach((f, i) => displayLayer.cels.set(f, paintDisplay(WORDS[i])));

    scene.layer('flap', {pivot: [(FLAP.x0 + FLAP.x1) / 2, FLAP.y0 + 1]}).cels.set(0, paintFlap());

    // the letters N I G H T _ S H I F T: the F stutters, now and then the whole sign dims
    /** @type {((i: number) => 'on' | 'dim' | 'off')[]} */
    const SIGN = [
      () => 'on',
      (i) => (i === 9 ? 'off' : 'on'),
      () => 'on',
      (i) => (i === 9 ? 'off' : 'on'),
      () => 'on',
      () => 'dim',
      () => 'on',
      () => 'dim',
    ];
    const signLayer = scene.layer('sign', {pivot: [SIGN_LIGHT.x, SIGN_BOX.y1]});
    signLayer.cels.set(0, paintSign(font, SIGN[0]));
    sign.forEach((f, i) => signLayer.cels.set(f, paintSign(font, SIGN[i])));
  });

  scene.layer('bin', {pivot: [BIN.x, BIN.foot]}).cels.set(0, paintBin());

  const catLayer = scene.layer('cat', {pivot: [CAT.x, CAT.foot]});
  catLayer.cels.set(0, paintCat(0, false));
  cat.forEach((f, i) => catLayer.cels.set(f, paintCat(i, i === 5)));

  const WINGS = /** @type {const} */ (['up', 'out', 'down', 'out']);
  const mothLayer = scene.layer('moth', {data: 'depth=-12', pivot: [MOTH.x, MOTH.y]});
  mothLayer.cels.set(0, paintMoth('up'));
  moth.forEach((f, i) => mothLayer.cels.set(f, paintMoth(WINGS[i])));

  return scene;
}

/** Reflections on the glass of the window: two streaks and a glint, thin, so a click passes them. */
function paintGlass() {
  const img = blank();
  const glare = hex('#d8f6ff');
  for (let y = WINDOW.y0; y < WINDOW.y1; y++) {
    const shift = Math.floor((WINDOW.y1 - y) * 0.45);
    for (const [x0, w, a] of [
      [WINDOW.x0 + 8, 3, 46],
      [WINDOW.x0 + 16, 1, 34],
    ]) {
      for (let i = 0; i < w; i++) {
        const x = x0 + shift + i;
        if (x < WINDOW.x1 - 1 && (y + i) % 9 !== 0) img.set(x, y, withAlpha(glare, a));
      }
    }
  }
  for (let i = 0; i < 6; i++) img.set(WINDOW.x0 + 1 + i, WINDOW.y0 + 1, withAlpha(glare, 110 - i * 14));
  for (let i = 1; i < 5; i++) img.set(WINDOW.x0 + 1, WINDOW.y0 + 1 + i, withAlpha(glare, 96 - i * 18));
  return img;
}

export {NIGHT};
