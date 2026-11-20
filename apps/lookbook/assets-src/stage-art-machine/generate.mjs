// stage-art-machine: "the listening machine", the art of the demo stage-art-machine — a brass
// contraption on a foggy pier, built in Blender (`blender_machine.py`) and rendered part by part
// through one camera, each part alone on a transparent canvas of 1280 × 800. Here the renders become
// the layers of a painting: trimmed and packed into one atlas in free-tex-packer's "JSON (hash)"
// layout, named after the layers they are, the pivots of the turning parts as `<layer>.pivot` marker
// frames. README.md documents the files and the frame names.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {freeTexPackerHash} from '../lib/formats.mjs';
import {Img} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';
import {decodeImage} from '../lib/png.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

const HERE = path.join(ASSETS_SRC, 'stage-art-machine');
const CACHE = path.join(HERE, '.render-cache');
const CANVAS = {width: 1280, height: 800};
const STEAM_FRAMES = 12;

/** The parts rendered once each, by the file Blender writes and the frame it becomes. */
const PARTS = ['fog', 'body', 'strip', 'flywheel', 'needle', 'glass', 'lever', 'lamp', 'lamp-on', 'glow'];
/** The parts that turn about a pivot of their own, written as a `<layer>.pivot` marker. */
const PIVOTED = ['flywheel', 'needle', 'lever'];
/** How far the light of the lamp reaches into the fog, in canvas pixels: full up to the first, gone at the second. */
const GLOW_REACH = [130, 320];
/**
 * The alpha below which a pixel is cut: the faint edge of the shadow the body throws onto the deck,
 * of the light of the lamp, of the steam — and the noise of the shadow catcher. Cut with a soft
 * knee — every alpha is lowered by the floor and stretched back to 255 —, so that a part that fades
 * out, the light of the lamp most of all, shows no step where it crosses the floor.
 */
const ALPHA_FLOOR = 8;
/**
 * The trim of a part is rounded out to this grid: a GPU render is not the same byte for byte on
 * every run, and the box of a part found pixel by pixel would move with its noise, the layout of
 * the atlas with it. The grid makes such a move unlikely, not impossible: a `machine.json` that
 * changes after a render of an unchanged scene asks for a look at the boxes.
 */
const TRIM_GRID = 8;
/** How many pixels the colour of a part is carried out into its clear surroundings. */
const BLEED = 4;

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(
    blender(),
    ['-b', '--factory-startup', '--python-exit-code', '1', '--python', path.join(HERE, 'blender_machine.py'), '--', CACHE],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  if (run.status !== 0)
    throw new Error(`blender failed (${run.status}):\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
}

/** @param {string} file */
async function load(file) {
  const {width, height, data} = await decodeImage(path.join(CACHE, file));
  check(width === CANVAS.width && height === CANVAS.height, `${file} is ${CANVAS.width} × ${CANVAS.height}`);
  return new Img(width, height, data);
}

/**
 * The light of the lamp is rendered on black, light alone. As a layer it is that light with an
 * alpha: the brightest channel becomes the alpha and the colour is lifted by it, so that drawn over
 * dark fog it adds about what it would add; beyond `GLOW_REACH` of the lamp it fades out, so that
 * its box does not cover the canvas.
 * @param {Img} img
 * @param {[number, number]} lamp
 */
function lightToLayer(img, [lx, ly]) {
  const d = img.data;
  const [near, far] = GLOW_REACH;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const t = Math.min(1, Math.max(0, (Math.hypot(x + 0.5 - lx, y + 0.5 - ly) - near) / (far - near)));
      const reach = 1 - t * t * (3 - 2 * t);
      const peak = Math.max(d[i], d[i + 1], d[i + 2]);
      const alpha = Math.round(peak * reach);
      if (alpha === 0) {
        d.fill(0, i, i + 4);
        continue;
      }
      for (let c = 0; c < 3; c++) d[i + c] = Math.round((d[i + c] * 255) / peak);
      d[i + 3] = alpha;
    }
  }
}

/**
 * A light blur of the steam: Cycles' denoiser smooths the colour of a render, not its alpha, and
 * the alpha of a volume is grainy. Blurred premultiplied, by the binomial kernel 1 4 6 4 1.
 * @param {Img} img
 */
function soften(img) {
  const {width: w, height: h} = img;
  const k = [1, 4, 6, 4, 1];
  const pre = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = img.data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) pre[i * 4 + c] = img.data[i * 4 + c] * a;
    pre[i * 4 + 3] = img.data[i * 4 + 3];
  }
  /** @param {Float32Array} src @param {number} dx @param {number} dy */
  const pass = (src, dx, dy) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let j = 0; j < 5; j++) {
          const sx = Math.min(w - 1, Math.max(0, x + (j - 2) * dx));
          const sy = Math.min(h - 1, Math.max(0, y + (j - 2) * dy));
          const s = (sy * w + sx) * 4;
          const o = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) out[o + c] += (src[s + c] * k[j]) / 16;
        }
      }
    }
    return out;
  };
  const blurred = pass(pass(pre, 1, 0), 0, 1);
  for (let i = 0; i < w * h; i++) {
    const a = blurred[i * 4 + 3];
    img.data[i * 4 + 3] = Math.round(a);
    for (let c = 0; c < 3; c++) img.data[i * 4 + c] = a > 0 ? Math.min(255, Math.round((blurred[i * 4 + c] / a) * 255)) : 0;
  }
}

/**
 * Carries the colour of the visible pixels out into the clear ones around them, `BLEED` pixels
 * deep, their alpha left at 0: the atlas is sampled with linear filtering, and a clear pixel of
 * colour 0 would darken the soft edges of a part.
 * @param {Img} img
 */
function bleed(img) {
  const {width: w, height: h, data: d} = img;
  let filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let ring = 0; ring < BLEED; ring++) {
    const next = filled.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (filled[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !filled[ny * w + nx]) continue;
            const j = (ny * w + nx) * 4;
            r += d[j];
            g += d[j + 1];
            b += d[j + 2];
            n++;
          }
        }
        if (n === 0) continue;
        d[i * 4] = Math.round(r / n);
        d[i * 4 + 1] = Math.round(g / n);
        d[i * 4 + 2] = Math.round(b / n);
        next[i] = 1;
      }
    }
    filled = next;
  }
}

/**
 * Cuts the faint pixels of a part by the soft knee of `ALPHA_FLOOR`, carries its colour out, and answers its trim rounded out to
 * `TRIM_GRID`.
 * @param {Img} img
 */
function trimOf(img) {
  for (let i = 3; i < img.data.length; i += 4) {
    const alpha = Math.round((Math.max(0, img.data[i] - ALPHA_FLOOR) * 255) / (255 - ALPHA_FLOOR));
    if (alpha === 0) img.data.fill(0, i - 3, i + 1);
    else img.data[i] = alpha;
  }
  bleed(img);
  const found = img.opaqueBounds();
  check(found !== undefined, 'every part has a picture');
  const x0 = Math.floor(found.x / TRIM_GRID) * TRIM_GRID;
  const y0 = Math.floor(found.y / TRIM_GRID) * TRIM_GRID;
  const x1 = Math.min(img.width, Math.ceil((found.x + found.w) / TRIM_GRID) * TRIM_GRID);
  const y1 = Math.min(img.height, Math.ceil((found.y + found.h) / TRIM_GRID) * TRIM_GRID);
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
}

/**
 * A marker the art reads as the pivot of a layer: a dot of 2 × 2 pixels whose middle is the
 * pivot, a corner between four pixels.
 * @param {[number, number]} pivot
 */
function pivotMarker([px, py]) {
  const img = new Img(CANVAS.width, CANVAS.height);
  img.fillRect(px - 1, py - 1, 2, 2, [255, 255, 255, 255]);
  return img;
}

/**
 * @param {Output} out
 * @param {{skipRender?: boolean}} [opts]
 */
export async function generate(out, opts = {}) {
  const cached = fs.existsSync(path.join(CACHE, 'layout.json'));
  if (!opts.skipRender || !cached) render();
  const layout = JSON.parse(fs.readFileSync(path.join(CACHE, 'layout.json'), 'utf8'));
  check(
    layout.canvas[0] === CANVAS.width && layout.canvas[1] === CANVAS.height,
    `the canvas of the renders is ${CANVAS.width} × ${CANVAS.height}`,
  );

  /** @type {import('../lib/pack.mjs').PackInput[]} */
  const inputs = [];
  for (const part of PARTS) {
    const img = await load(`${part}.png`);
    if (part === 'glow') lightToLayer(img, layout.lamp);
    if (part === 'fog')
      check(img.opaqueBounds()?.w === CANVAS.width && img.alpha(0, 0) === 255, 'fog.png covers the canvas, opaque');
    inputs.push({name: part, img, box: trimOf(img)});
  }
  for (let frame = 0; frame < STEAM_FRAMES; frame++) {
    const img = await load(`steam-${frame}.png`);
    soften(img);
    inputs.push({name: `steam#${frame}`, img, box: trimOf(img)});
  }
  for (const part of PIVOTED) {
    const pivot = layout.pivots[part];
    check(
      pivot.every((/** @type {number} */ v) => Number.isInteger(v)),
      `the pivot of ${part} lies on a corner between pixels, got ${pivot.join(', ')}`,
    );
    inputs.push({name: `${part}.pivot`, img: pivotMarker(pivot), trim: true});
  }

  const {sheet, frames} = pack(inputs, {padding: 4});
  for (const f of frames) {
    check(f.w > 0 && f.h > 0 && f.sourceSize.w === CANVAS.width, `${f.name} has a picture on the canvas`);
  }
  check(
    frames.find((f) => f.name === 'fog')?.trimmed === false,
    'the fog fills the canvas: the one frame of the atlas that is not trimmed',
  );
  check(
    sheet.width <= 4096 && sheet.height <= 4096,
    `the atlas fits a texture of 4096 × 4096, got ${sheet.width} × ${sheet.height}`,
  );

  // lossy colour, lossless alpha; `exact` keeps the colour bled into the clear pixels
  const webp = await sharp(Buffer.from(sheet.data), {raw: {width: sheet.width, height: sheet.height, channels: 4}})
    .webp({quality: 90, alphaQuality: 100, exact: true, effort: 6})
    .toBuffer();
  out.bytes('machine.webp', webp);
  out.json('machine.json', freeTexPackerHash(frames, {image: 'machine.webp', width: sheet.width, height: sheet.height}));
}
