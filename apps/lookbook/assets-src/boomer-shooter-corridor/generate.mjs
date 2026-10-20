// boomer-shooter-corridor: the stalker, a cyber-mutant rendered in Blender from eight directions
// and shaded here into pixel art with neon rim lights, packed as `stalker_<anim>_<view>_<frame>`;
// and the corridor around it — wall, floor, ceiling and door textures and neon signs.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {texturePackerHash} from '../lib/formats.mjs';
import {fbm, hex, Img, mix, Rng, withAlpha} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';
import {decodeImage} from '../lib/png.mjs';
import {TrueTypeFont} from '../lib/ttf.mjs';
import {FONT_DIR} from '../sine-scroller/generate.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

const HERE = path.join(ASSETS_SRC, 'boomer-shooter-corridor');
const CACHE = path.join(HERE, '.render-cache');

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(blender(), ['-b', '--factory-startup', '--python', path.join(HERE, 'blender_render.py'), '--', CACHE], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0)
    throw new Error(`blender failed (${run.status}):\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
}

/** Lit from the upper left and front, in camera space (x right, y up, z towards the viewer). */
const LIGHT = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();

/** Four bands, dark to light, per lit material; one base and one core colour per glowing one. */
const BANDS = /** @type {Record<number, RGBA[]>} */ ({
  1: ['#241c40', '#463a70', '#7468a4', '#b4aad8'].map(hex), // armour
  2: ['#0c0a14', '#1c1828', '#302c44', '#4a4662'].map(hex), // frame, joints
  3: ['#3a1228', '#7a2848', '#c04c78', '#f08cb0'].map(hex), // mutant flesh
  6: ['#08161c', '#123038', '#1c545e', '#368690'].map(hex), // cables
  7: ['#101016', '#24242e', '#424252', '#727288'].map(hex), // gun metal
});
const GLOW = /** @type {Record<number, [RGBA, RGBA]>} */ ({
  4: [hex('#3ad8ff'), hex('#9af4ff')], // visor, thigh strips
  5: [hex('#ff2ab8'), hex('#ff7ad8')], // neon
  8: [hex('#ffb030'), hex('#fff4b0')], // muzzle flash
});
const RIM_LEFT = hex('#3ae8ff');
const RIM_RIGHT = hex('#ff3ac8');
const OUTLINE = hex('#0a0612');

/**
 * The shading of one G-buffer sample as a key: material · 8 + band, or 0 for no surface. Bands 0–3
 * are lit, 4 the cyan rim on the left, 5 the magenta rim on the right, 6 a glow, 7 its core.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a
 */
function shadeKey(r, g, b, a) {
  if (a < 128) return 0;
  const id = b;
  const nx = (r / 255) * 2 - 1;
  const ny = (g / 255) * 2 - 1;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  if (GLOW[id]) return id * 8 + (nz > 0.75 ? 7 : 6);
  if (!BANDS[id]) throw new Error(`G-buffer: unknown material id ${id}`);
  if (nz < 0.3) return id * 8 + (nx < 0 ? 4 : 5);
  const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return id * 8 + (lit > 0.8 ? 3 : lit > 0.45 ? 2 : lit > 0.1 ? 1 : 0);
}

/** @param {number} key */
function keyColour(key) {
  const id = key >> 3;
  const band = key & 7;
  if (band >= 6) return GLOW[id][band - 6];
  if (band === 4) return mix(BANDS[id][2], RIM_LEFT, 0.7);
  if (band === 5) return mix(BANDS[id][2], RIM_RIGHT, 0.7);
  return BANDS[id][band];
}

/**
 * Shades a G-buffer render and scales it down by `ss`: the most frequent key of the ss × ss
 * samples of a pixel wins (no blended colours), the pixel is opaque when at least 7 of 16 samples
 * hit a surface. Then a dark outline.
 * @param {{width: number, height: number, data: Uint8Array}} gbuffer
 * @param {number} ss
 */
function shadeDown(gbuffer, ss) {
  const w = gbuffer.width / ss;
  const h = gbuffer.height / ss;
  const img = new Img(w, h);
  const counts = new Map();
  const need = Math.ceil((ss * ss * 7) / 16);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      counts.clear();
      let covered = 0;
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const o = ((y * ss + j) * gbuffer.width + (x * ss + i)) * 4;
          const d = gbuffer.data;
          const key = shadeKey(d[o], d[o + 1], d[o + 2], d[o + 3]);
          if (!key) continue;
          covered++;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      if (covered < need) continue;
      let best = 0;
      let bestCount = 0;
      for (const [key, count] of counts) {
        // glows win ties, so a thin neon strip survives the vote
        const score = count + ((key & 7) >= 6 ? 0.5 : 0) - key * 1e-6;
        if (score > bestCount) {
          best = key;
          bestCount = score;
        }
      }
      img.set(x, y, keyColour(best));
    }
  }
  img.outline(OUTLINE);
  return img;
}

/** @returns {Promise<{name: string, img: Img}[]>} */
async function stalkerFrames() {
  const info = JSON.parse(fs.readFileSync(path.join(CACHE, 'renders.json'), 'utf8'));
  /** @type {{name: string, anim: string, view: number, frame: number}[]} */
  const renders = info.renders;
  // frame-major inside each animation: the eight views of frame 0, then of frame 1, …
  const order = [...new Set(renders.map((r) => r.anim))];
  renders.sort((a, b) => order.indexOf(a.anim) - order.indexOf(b.anim) || a.frame - b.frame || a.view - b.view);
  const out = [];
  for (const r of renders) {
    const gbuffer = await decodeImage(path.join(CACHE, `${r.name}.png`));
    check(gbuffer.width === info.framePx * info.supersample, `${r.name} is rendered at ${info.framePx * info.supersample} px`);
    out.push({name: r.name, img: shadeDown(gbuffer, info.supersample)});
  }
  return out;
}

const W = {
  ink: hex('#07060c'),
  deep: hex('#100e1c'),
  panel: hex('#1c1a2e'),
  panelLit: hex('#2c2a46'),
  edge: hex('#45426a'),
  shine: hex('#6e6a9a'),
  pipe: hex('#16404a'),
  pipeLit: hex('#2a7480'),
  pipeShine: hex('#5ac0c8'),
  cyan: hex('#3ae8ff'),
  magenta: hex('#ff3ac8'),
  amber: hex('#ffb030'),
  red: hex('#ff3a4a'),
  green: hex('#4aff8a'),
};

/** A wall, 64 × 64, seamless both ways: two metal panels, a pipe run, status lights, grime. */
function wall() {
  const img = new Img(64, 64);
  img.paint((x, y) => {
    const px = x % 32;
    if (px === 0) return W.ink;
    if (px === 1 || y === 1 || y === 33) return W.edge;
    if (px === 31 || y === 31 || y === 63) return W.deep;
    if (y === 0 || y === 32) return W.ink;
    const grime = fbm(x / 8, y / 8, 3, 3, 8);
    return grime > 0.62 ? W.deep : y > 52 && grime > 0.5 ? W.deep : W.panel;
  });
  // a pipe run across, with brackets
  for (let x = 0; x < 64; x++) {
    img.set(x, 40, W.ink);
    img.set(x, 41, W.pipeShine);
    img.set(x, 42, W.pipeLit);
    img.set(x, 43, W.pipeLit);
    img.set(x, 44, W.pipe);
    img.set(x, 45, W.ink);
  }
  for (const x of [10, 42]) img.fillRect(x, 39, 3, 8, W.edge);
  // rivets and a status panel
  for (const [x, y] of [
    [4, 4],
    [27, 4],
    [36, 4],
    [59, 4],
    [4, 27],
    [27, 27],
    [36, 27],
    [59, 27],
  ])
    img.set(x, y, W.shine);
  img.fillRect(44, 10, 12, 8, W.ink);
  img.fillRect(45, 11, 10, 6, W.deep);
  img.set(46, 13, W.green);
  img.set(48, 13, W.green);
  img.set(50, 13, W.amber);
  img.set(52, 13, W.red);
  img.fillRect(46, 15, 8, 1, W.cyan);
  return img;
}

/** The floor, 64 × 64, seamless: a metal grating over the dark, wet with neon reflections. */
function floor() {
  const img = new Img(64, 64);
  const rng = new Rng(17);
  img.paint((x, y) => {
    const gx = x % 8;
    const gy = y % 8;
    if (gx === 0 || gy === 0) return W.edge;
    if (gx === 1 || gy === 1) return W.panelLit;
    if (gx === 7 || gy === 7) return W.panel;
    return W.ink;
  });
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, 63);
    const y = rng.int(0, 63);
    if (img.get(x, y).join() === W.ink.join()) continue;
    img.set(x, y, rng.next() < 0.5 ? mix(W.panelLit, W.magenta, 0.5) : mix(W.panelLit, W.cyan, 0.5));
  }
  return img;
}

/** The ceiling, 64 × 64, seamless: panels with a light strip along x in rows 28–35. */
function ceiling() {
  const img = new Img(64, 64);
  img.paint((x, y) => {
    if (y >= 30 && y <= 33) return hex('#f0ffff');
    if (y === 29 || y === 34) return hex('#9af0ff');
    if (y === 28 || y === 35) return W.edge;
    if (x % 16 === 0 || y === 0) return W.ink;
    if (x % 16 === 1 || y === 1) return W.panelLit;
    return W.deep;
  });
  return img;
}

/** A blast door, 64 × 96, standing on its bottom edge: two leaves, hazard stripes, a lit seam. */
function door() {
  const img = new Img(64, 96);
  img.paint((x, y) => {
    if (x < 2 || x > 61 || y < 2) return W.ink;
    if (x < 4 || x > 59 || y < 4) return W.edge;
    if (x === 31 || x === 32) return y % 6 < 3 ? W.cyan : hex('#1a6a80');
    if (y > 78) return (x + y) % 12 < 6 ? W.amber : W.ink;
    if (y === 78) return W.ink;
    if (y % 24 === 0) return W.deep;
    if (y % 24 === 1) return W.edge;
    return x < 31 ? W.panel : W.panelLit;
  });
  for (const x of [10, 53]) {
    img.fillRect(x - 2, 30, 4, 10, W.ink);
    img.set(x - 1, 32, W.red);
    img.set(x, 32, W.red);
  }
  return img;
}

/**
 * A neon sign: the white 8 px font scaled ×2 as glass tubes — a pale core, the colour around it
 * and two rings of glow fading out on a clear ground.
 * @param {TrueTypeFont} font
 * @param {string} text
 * @param {RGBA} colour
 * @param {(mask: Img) => void} [extra] draws more tube shapes into the mask
 */
function neon(font, text, colour, extra) {
  const scale = 2;
  const glyphs = [...text].map(
    (ch) => /** @type {NonNullable<ReturnType<TrueTypeFont['rasterize']>>} */ (font.rasterize(ch.codePointAt(0) ?? 32, 8)),
  );
  const textW = glyphs.reduce((sum, g) => sum + g.advance, 0) * scale;
  const pad = 4;
  const mask = new Img(textW + 2 * pad + (extra ? 20 : 0), 8 * scale + 2 * pad);
  let cx = pad;
  for (const g of glyphs) {
    for (let y = 0; y < g.height * scale; y++) {
      for (let x = 0; x < g.width * scale; x++) {
        if (g.mask[Math.floor(y / scale) * g.width + Math.floor(x / scale)]) mask.set(cx + x, pad + y, [255, 255, 255, 255]);
      }
    }
    cx += g.advance * scale;
  }
  extra?.(mask);
  const img = new Img(mask.width, mask.height);
  const dist = (/** @type {number} */ x, /** @type {number} */ y) => {
    let best = 9;
    for (let j = -3; j <= 3; j++)
      for (let i = -3; i <= 3; i++) if (mask.alpha(x + i, y + j)) best = Math.min(best, Math.max(Math.abs(i), Math.abs(j)));
    return best;
  };
  img.paint((x, y) => {
    if (mask.alpha(x, y)) {
      const inner =
        dist(x, y) === 0 && mask.alpha(x - 1, y) && mask.alpha(x + 1, y) && mask.alpha(x, y - 1) && mask.alpha(x, y + 1);
      return inner ? mix(colour, [255, 255, 255, 255], 0.75) : colour;
    }
    const d = dist(x, y);
    if (d === 1) return withAlpha(colour, 150);
    if (d === 2) return withAlpha(colour, 70);
    if (d === 3) return withAlpha(colour, 25);
    return undefined;
  });
  return img;
}

/** @param {Img} mask */
const arrow = (mask) => {
  const x0 = mask.width - 20;
  for (let i = 0; i < 12; i++) mask.fillRect(x0 + i, 11, 1, 2, [255, 255, 255, 255]);
  for (let i = 0; i < 6; i++) {
    mask.set(x0 + 11 - i, 11 - i, [255, 255, 255, 255]);
    mask.set(x0 + 11 - i, 12 + i, [255, 255, 255, 255]);
  }
};

/** @param {Img} mask */
const bowl = (mask) => {
  const x0 = mask.width - 18;
  for (let x = 0; x < 14; x++) mask.set(x0 + x, 10, [255, 255, 255, 255]);
  for (let x = 0; x < 14; x++) {
    const y = 10 + Math.round(Math.sqrt(Math.max(0, 49 - (x - 6.5) ** 2)) * 0.8);
    mask.set(x0 + x, y, [255, 255, 255, 255]);
  }
  mask.fillRect(x0 + 4, 3, 1, 6, [255, 255, 255, 255]);
  mask.fillRect(x0 + 8, 2, 1, 7, [255, 255, 255, 255]);
};

/** @param {import('../lib/output.mjs').Output} out @param {{skipRender: boolean}} opts */
export async function generate(out, opts) {
  if (!opts.skipRender || !fs.existsSync(path.join(CACHE, 'renders.json'))) render();
  const frames = await stalkerFrames();
  check(frames.length === 80, `80 stalker frames, got ${frames.length}`);
  for (const f of frames) {
    const box = f.img.opaqueBounds();
    check(box && box.x > 0 && box.y > 0 && box.x + box.w < 64, `${f.name} stays inside its frame`);
  }
  const {sheet, frames: packed} = pack(frames, {padding: 2, keepOrder: true, width: 1024});
  out.png('stalker.png', sheet);
  out.json('stalker.json', texturePackerHash(packed, {image: 'stalker.png', width: sheet.width, height: sheet.height}));

  out.png('wall.png', wall());
  out.png('floor.png', floor());
  out.png('ceiling.png', ceiling());
  out.png('door.png', door());

  const font = new TrueTypeFont(path.join(FONT_DIR, 'PressStart2P-Regular.ttf'));
  const signs = [
    {name: 'sign-noodle', img: neon(font, 'NOODLE', W.magenta, bowl)},
    {name: 'sign-bar', img: neon(font, 'BAR', W.cyan)},
    {name: 'sign-open', img: neon(font, 'OPEN 24H', W.green)},
    {name: 'sign-exit', img: neon(font, 'EXIT', W.red, arrow)},
    {name: 'sign-danger', img: neon(font, 'DANGER', W.amber)},
    {name: 'sign-love', img: neon(font, '<3', hex('#ff6ab0'))},
  ];
  const signSheet = pack(signs, {padding: 2, keepOrder: true});
  out.png('signs.png', signSheet.sheet);
  out.json(
    'signs.json',
    texturePackerHash(signSheet.frames, {image: 'signs.png', width: signSheet.sheet.width, height: signSheet.sheet.height}),
  );
}
