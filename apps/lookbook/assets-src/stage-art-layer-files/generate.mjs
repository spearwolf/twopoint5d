// stage-art-layer-files: "the specimen shelf", the art of the demo stage-art-layer-files — a shelf of
// specimen jars in the cabinet of a research vessel, built in Blender (`blender_shelf.py`) and
// rendered layer by layer through one camera, each layer a full canvas of 1280 × 800. Here the
// renders become what a paint tool's "Export Layers" writes: one full-canvas PNG per layer, named by
// the conventions the art reads out of a list of files — `wall@240.png` (a depth in the name),
// `<jar>.pivot.png` (a marker layer with one dot), `motes.png` and `motes-1.png` … `motes-7.png` (a
// layer and its further frames).
// No atlas: the art trims and packs the files itself when it loads them. README.md documents the
// files.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {Img, Rng} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {decodeImage} from '../lib/png.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

const HERE = path.join(ASSETS_SRC, 'stage-art-layer-files');
const CACHE = path.join(HERE, '.render-cache');
const CANVAS = {width: 1280, height: 800};

/** The jars, left to right: each a layer of its own, with a pivot marker at the middle of its foot. */
const JARS = ['coral', 'octopus', 'urchin', 'nautilus', 'starfish'];
/**
 * The alpha below which a pixel of a render is cut, by a soft knee — every alpha lowered by the floor
 * and stretched back to 255 —, so that a soft edge shows no step where it crosses the floor. The art
 * trims each file to its pixels with an alpha above 0: a speck of render noise left far from its
 * picture would stretch the box of the layer, and its quad, across the canvas.
 */
const ALPHA_FLOOR = 6;
/** How far the light of the porthole reaches from its middle, in canvas pixels: full up to the first, gone at the second. */
const SUN_REACH = [120, 205];
/** The share of the light of the porthole the layer adds at its brightest: the brightest channel of the render, times this, is its alpha. */
const SUN_STRENGTH = 0.6;
/** The frames of the dust in the light: a loop, frame 8 would be frame 0. */
const MOTE_FRAMES = 8;
/**
 * The file of a frame of the dust: `motes.png`, then `motes-1.png` … — further frames of a layer by
 * the `<layer>-<suffix>` of their names. Not `motes#1.png`: a `#` goes out as `%23`, and the dev
 * server of the lookbook finds no file under a name with a percent escape in it.
 * @param {number} frame
 */
const moteFile = (frame) => (frame === 0 ? 'motes.png' : `motes-${frame}.png`);
const MOTE_COUNT = 56;

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(
    blender(),
    ['-b', '--factory-startup', '--python-exit-code', '1', '--python', path.join(HERE, 'blender_shelf.py'), '--', CACHE],
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
 * Cuts the faint pixels of a render by the soft knee of `ALPHA_FLOOR`, and every pixel outside
 * `keep` — the generous box Blender wrote for a jar, which holds the jar and its lid whole.
 * @param {Img} img
 * @param {{x: number, y: number, w: number, h: number}} [keep]
 */
function cut(img, keep) {
  const {width: w, data: d} = img;
  for (let i = 3; i < d.length; i += 4) {
    const p = (i - 3) / 4;
    const x = p % w;
    const y = Math.floor(p / w);
    const outside = keep !== undefined && (x < keep.x || y < keep.y || x >= keep.x + keep.w || y >= keep.y + keep.h);
    const alpha = outside ? 0 : Math.round((Math.max(0, d[i] - ALPHA_FLOOR) * 255) / (255 - ALPHA_FLOOR));
    if (alpha === 0) d.fill(0, i - 3, i + 1);
    else d[i] = alpha;
  }
  return img;
}

/**
 * The light of the porthole is rendered on black, light alone, on a plain screen. As a layer it is
 * that light with an alpha: the brightest channel becomes the alpha and the colour is lifted by it, so
 * that drawn over the dark bulkhead it adds about what it would add; beyond `SUN_REACH` of its middle
 * it fades out, so that its box does not cover the canvas.
 * @param {Img} img
 * @param {[number, number]} centre
 */
function lightToLayer(img, [cx, cy]) {
  const d = img.data;
  const [near, far] = SUN_REACH;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const t = Math.min(1, Math.max(0, (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - near) / (far - near)));
      const reach = 1 - t * t * (3 - 2 * t);
      const peak = Math.max(d[i], d[i + 1], d[i + 2]);
      const alpha = Math.min(255, Math.round(peak * reach * SUN_STRENGTH));
      if (alpha === 0) {
        d.fill(0, i, i + 4);
        continue;
      }
      for (let c = 0; c < 3; c++) d[i + c] = Math.round((d[i + c] * 255) / peak);
      d[i + 3] = alpha;
    }
  }
  return img;
}

/**
 * A marker layer as a paint tool exports it: the full canvas, clear but for a dot of 2 × 2 pixels
 * whose middle — a corner between four pixels — is the pivot of its layer.
 * @param {[number, number]} pivot
 */
function pivotMarker([px, py]) {
  const img = new Img(CANVAS.width, CANVAS.height);
  img.fillRect(px - 1, py - 1, 2, 2, [255, 255, 255, 255]);
  return img;
}

/**
 * The dust in the light of the porthole, painted: specks that drift on small circles and glint as
 * they turn, a loop of `MOTE_FRAMES` frames, within the reach of the light. Seeded, the same on every
 * run.
 * @param {[number, number]} centre
 */
function paintMotes([cx, cy]) {
  const rng = new Rng(147);
  const motes = Array.from({length: MOTE_COUNT}, () => {
    const a = rng.range(0, Math.PI * 2);
    const r = SUN_REACH[0] * 1.1 * Math.sqrt(rng.next());
    return {
      x: cx + Math.cos(a) * r * 1.15,
      y: cy + Math.sin(a) * r * 0.9,
      orbit: rng.range(1.5, 4.5),
      phase: rng.range(0, Math.PI * 2),
      turn: rng.pick([-1, 1]),
      size: rng.range(0.8, 1.9),
      glint: rng.range(0.35, 1),
    };
  });
  return Array.from({length: MOTE_FRAMES}, (_, frame) => {
    const img = new Img(CANVAS.width, CANVAS.height);
    const t = frame / MOTE_FRAMES;
    for (const m of motes) {
      const a = m.phase + m.turn * t * Math.PI * 2;
      const x = m.x + Math.cos(a) * m.orbit;
      const y = m.y + Math.sin(a) * m.orbit * 0.6;
      // a speck catches the light as it turns its face to the porthole
      const shine = m.glint * (0.45 + 0.55 * Math.max(0, Math.cos(a - 0.6)) ** 2);
      const fall = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / SUN_REACH[1]);
      const r = m.size + 1.2;
      for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
        for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
          const d = Math.hypot(px + 0.5 - x, py + 0.5 - y);
          const k = Math.exp(-((d / m.size) ** 2) * 1.4);
          const alpha = Math.round(255 * shine * fall * k);
          if (alpha > 0) img.blend(px, py, [255, 232, 196, alpha]);
        }
      }
    }
    return img;
  });
}

/**
 * The files of the shelf, bottom first — the list the demo hands the art, and the order of this
 * table in README.md.
 * @param {number} wallDepth
 */
function shelfFiles(wallDepth) {
  return [
    `wall@${wallDepth}.png`,
    'sunlight.png',
    ...Array.from({length: MOTE_FRAMES}, (_, i) => moteFile(i)),
    'shelf.png',
    ...JARS.flatMap((jar) => [`${jar}.png`, `${jar}.pivot.png`]),
    'rail.png',
    'tag.png',
    'tag.pivot.png',
  ];
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
  /** @type {(name: string) => [number, number]} */
  const pivotOf = (name) => [Math.round(layout.pivots[name][0]), Math.round(layout.pivots[name][1])];
  /** @type {Map<string, Img>} */
  const files = new Map();

  const wall = await load('wall.png');
  check(wall.opaqueBounds()?.w === CANVAS.width && wall.alpha(0, 0) === 255, 'wall.png covers the canvas, opaque');
  check(
    wall.data.every((v, i) => i % 4 !== 3 || v === 255),
    'every pixel of wall.png is opaque',
  );
  files.set(`wall@${layout.wall_depth}.png`, wall);

  const sun = /** @type {[number, number]} */ (layout.sunlight);
  files.set('sunlight.png', cut(lightToLayer(await load('sunlight.png'), sun)));
  paintMotes(sun).forEach((img, i) => {
    files.set(moteFile(i), img);
  });

  const shelf = cut(await load('shelf.png'));
  files.set('shelf.png', shelf);

  for (const jar of JARS) {
    const [x, y, w, h] = layout.boxes[jar];
    const img = cut(await load(`${jar}.png`), {x, y, w, h});
    const found = img.opaqueBounds();
    check(found !== undefined, `${jar}.png has a picture`);
    const [px, py] = pivotOf(jar);
    check(
      Math.abs(found.y + found.h - py) <= 4 && px > found.x && px < found.x + found.w,
      `the pivot of ${jar}, (${px}, ${py}), lies at the foot of its picture ${JSON.stringify(found)}`,
    );
    files.set(`${jar}.png`, img);
    files.set(`${jar}.pivot.png`, pivotMarker([px, py]));
  }

  files.set('rail.png', cut(await load('rail.png')));
  const tag = cut(await load('tag.png'));
  const tagBox = tag.opaqueBounds();
  check(tagBox !== undefined, 'tag.png has a picture');
  // the tag swings about its knot: its picture keeps clear of the edge of the canvas, which would cut it
  check(
    tagBox.y + tagBox.h <= CANVAS.height - 12,
    `the tag ends 12 pixels above the bottom of the canvas, got ${tagBox.y + tagBox.h}`,
  );
  files.set('tag.png', tag);
  files.set('tag.pivot.png', pivotMarker(pivotOf('tag')));

  const names = shelfFiles(layout.wall_depth);
  check(
    names.length === files.size && names.every((name) => files.has(name)),
    'every file of the list is written, and nothing else',
  );
  for (const name of names) out.png(name, /** @type {Img} */ (files.get(name)));
}
