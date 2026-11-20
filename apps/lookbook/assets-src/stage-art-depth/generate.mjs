// stage-art-depth: "the drowned platform", the art of the demo stage-art-depth — an underground
// station at night whose track bed has flooded, someone waiting under a red umbrella, built in
// Blender (`blender_platform.py`) and rendered plane by plane through one perspective camera. Here
// the renders become the planes of a multiplane camera in one Aseprite file:
// `drowned-platform.lua` lays them out as layers in groups — a group per plane, its depth in its
// user data —, with a tag for the ripples on the water and a pivot slice for the light of the
// train, and Aseprite exports the file as the guide tells a user to
// (packages/twopoint5d/docs/stage-art.md, "A scene out of an Aseprite file"). README.md documents
// the files and the layers.
//
// Needs Blender (unless `--skip-render` finds the render cache) and the Aseprite binary: the one
// ASEPRITE names, else `aseprite` on the PATH.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Img} from '../lib/image.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {decodeImage, encodePng} from '../lib/png.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

const HERE = path.join(ASSETS_SRC, 'stage-art-depth');
const CACHE = path.join(HERE, '.render-cache');
const NAME = 'drowned-platform';
const CANVAS = {width: 960, height: 540};
/** The distance of the camera Blender rendered through, in canvas pixels: the `D` the demo starts at. */
const CAMERA_PX = 600;
/** The layers bottom first, by the group that is their plane; the order of the groups is the stack. */
const GROUPS = [
  {group: 'tunnel', layers: ['bore', 'train-light']},
  {group: 'mouth', layers: ['end-wall']},
  {group: 'hall', layers: ['vault', 'pillars']},
  {group: 'flood', layers: ['water', 'ripples']},
  {group: 'edge', layers: ['platform', 'figure']},
  {group: 'foreground', layers: ['cables']},
];
const RIPPLE_FRAMES = 8;
/** The time each frame shows, in milliseconds: frame 0, the rest, then the loop of the ripples. */
const REST_MS = 100;
const RIPPLE_MS = 110;
/**
 * The alpha below which a pixel is cut, with a soft knee — every alpha lowered by the floor and
 * stretched back to 255 —, so that the light of the train, which fades out, shows no step.
 */
const ALPHA_FLOOR = 4;
/** How many pixels the colour of a layer is carried out into the clear pixels around it, for `linear` filtering. */
const BLEED = 2;
/** The width of the band along the edge of the canvas in which the picture sinks into the night around it. */
const VIGNETTE = 40;
/** The colour of the night round the canvas, the clear colour of the demo: the picture fades into it. */
const NIGHT = [4, 6, 7];

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(
    blender(),
    ['-b', '--factory-startup', '--python-exit-code', '1', '--python', path.join(HERE, 'blender_platform.py'), '--', CACHE],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  if (run.status !== 0)
    throw new Error(`blender failed (${run.status}):\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
}

/**
 * Runs Aseprite and answers what it printed; fails naming `ASEPRITE` where there is no binary.
 * @param {string[]} args
 * @param {string} [cwd]
 */
function aseprite(args, cwd) {
  const binary = process.env['ASEPRITE'] || 'aseprite';
  const run = spawnSync(binary, args, {cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (/** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ENOENT') {
    throw new Error(
      `stage-art-depth: no Aseprite binary at ${JSON.stringify(binary)} — set ASEPRITE to the path of the Aseprite binary, or put \`aseprite\` on the PATH`,
    );
  }
  if (run.error) throw run.error;
  if (run.status !== 0)
    throw new Error(`stage-art-depth: aseprite ${args.join(' ')} exited with ${run.status}\n${run.stdout}${run.stderr}`);
  return run.stdout;
}

/** @param {string} file */
async function load(file) {
  const {width, height, data} = await decodeImage(path.join(CACHE, file));
  check(width === CANVAS.width && height === CANVAS.height, `${file} is ${CANVAS.width} × ${CANVAS.height}`);
  return new Img(width, height, data);
}

/**
 * The light of the train is rendered on black, light alone. As a layer it is that light with an
 * alpha: the brightest channel becomes the alpha and the colour is lifted by it, so that drawn over
 * the dark bore it adds about what it would add.
 * @param {Img} img
 */
function lightToLayer(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const peak = Math.max(d[i], d[i + 1], d[i + 2]);
    if (peak === 0) {
      d.fill(0, i, i + 4);
      continue;
    }
    for (let c = 0; c < 3; c++) d[i + c] = Math.round((d[i + c] * 255) / peak);
    d[i + 3] = peak;
  }
}

/**
 * Cuts the faint pixels by the soft knee of `ALPHA_FLOOR`.
 * @param {Img} img
 */
function alphaFloor(img) {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    const alpha = Math.round((Math.max(0, d[i] - ALPHA_FLOOR) * 255) / (255 - ALPHA_FLOOR));
    if (alpha === 0) d.fill(0, i - 3, i + 1);
    else d[i] = alpha;
  }
}

/**
 * The picture sinks into the night along the edge of the canvas: each colour mixed towards
 * `NIGHT` by the same share in every layer, so the layers stacked give the stack mixed by it — the
 * painting at rest, with a soft edge where a wide window or a moved camera shows the canvas end.
 * @param {Img} img
 */
function vignette(img) {
  const {width: w, height: h, data: d} = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x + 0.5, y + 0.5, w - x - 0.5, h - y - 0.5);
      const t = Math.min(1, edge / VIGNETTE);
      const v = t * t * (3 - 2 * t);
      if (v === 1) continue;
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(NIGHT[c] + (d[i + c] - NIGHT[c]) * v);
    }
  }
}

/**
 * Carries the colour of the visible pixels out into the clear ones around them, `BLEED` pixels
 * deep, their alpha left at 0: the sheet is sampled with linear filtering, and a clear pixel of
 * colour 0 would darken the soft edges of a layer. Aseprite keeps the colour of a clear pixel in
 * a cel, and `--extrude` carries the edge of each picture into its padding.
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
 * Makes a render a picture of a layer: the light of the train becomes a layer of light, the
 * faint pixels go, the edge of the canvas sinks into the night, and the colour is carried out.
 * @param {Img} img
 * @param {string} layer
 */
function prepare(img, layer) {
  if (layer === 'train-light') lightToLayer(img);
  alphaFloor(img);
  vignette(img);
  bleed(img);
  check(img.opaqueBounds() !== undefined, `${layer} has a picture`);
  return img;
}

/**
 * @param {Output} out
 * @param {{skipRender?: boolean}} [opts]
 */
export async function generate(out, opts = {}) {
  const version = aseprite(['--version']).trim();
  check(version.startsWith('Aseprite 1.3'), `Aseprite 1.3 builds the file, got ${version}`);

  const cached = fs.existsSync(path.join(CACHE, 'layout.json'));
  if (!opts.skipRender || !cached) render();
  const rendered = JSON.parse(fs.readFileSync(path.join(CACHE, 'layout.json'), 'utf8'));
  check(
    rendered.canvas[0] === CANVAS.width && rendered.canvas[1] === CANVAS.height && rendered.cameraPx === CAMERA_PX,
    `the renders lie on a canvas of ${CANVAS.width} × ${CANVAS.height} under a camera ${CAMERA_PX} pixels in front of it`,
  );
  check(rendered.rippleFrames === RIPPLE_FRAMES, `Blender rendered ${RIPPLE_FRAMES} frames of ripples`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-art-depth-'));
  /** @type {object[]} */
  const slices = [];
  try {
    /** @param {string} file @param {Img} img */
    const write = (file, img) => fs.writeFileSync(path.join(work, file), encodePng(img.width, img.height, img.data));

    const layers = [];
    for (const {group, layers: names} of GROUPS) {
      const depth = rendered.groups[group];
      check(Number.isInteger(depth), `the plane ${group} has a depth in whole pixels`);
      const entries = [];
      for (const name of names) {
        /** @type {{frame: number, file: string}[]} */
        const cels = [];
        if (name === 'ripples') {
          // frame 0, the rest, is the first frame of the loop; Aseprite merges the two pictures
          for (let frame = 0; frame <= RIPPLE_FRAMES; frame++) {
            const file = `${name}#${frame}.png`;
            write(file, prepare(await load(`ripples-${Math.max(0, frame - 1)}.png`), name));
            cels.push({frame, file});
          }
        } else {
          const img = prepare(await load(`${name}.png`), name);
          if (name === 'end-wall') {
            check(
              img.alpha(0, 0) === 255 && img.alpha(CANVAS.width - 1, CANVAS.height - 1) === 255,
              'the end wall covers the canvas',
            );
          }
          write(`${name}#0.png`, img);
          cels.push({frame: 0, file: `${name}#0.png`});
          if (name === 'train-light') {
            // the slice: the box of the light, grown to hold the pixel whose bottom left corner is
            // the pivot, the middle between the two lamps of the train
            const px = Math.round(rendered.train[0]);
            const py = Math.round(rendered.train[1]);
            const box = /** @type {{x: number, y: number, w: number, h: number}} */ (img.opaqueBounds());
            const x0 = Math.min(box.x, px);
            const y0 = Math.min(box.y, py - 1);
            const x1 = Math.max(box.x + box.w, px + 1);
            const y1 = Math.max(box.y + box.h, py);
            slices.push({name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, px: px - x0, py: py - 1 - y0});
          }
        }
        entries.push({name, cels});
      }
      layers.push({group, data: `depth=${depth}`, layers: entries});
    }
    const durations = [REST_MS, ...Array.from({length: RIPPLE_FRAMES}, () => RIPPLE_MS)];
    const tags = [{name: 'ripples', from: 1, to: RIPPLE_FRAMES, direction: 'forward'}];
    const layout = {width: CANVAS.width, height: CANVAS.height, durations, layers, tags, slices};
    fs.writeFileSync(path.join(work, 'layout.json'), JSON.stringify(layout));

    const file = out.path(`${NAME}.aseprite`);
    aseprite([
      '-b',
      '--script-param',
      `dir=${work}`,
      '--script-param',
      `out=${file}`,
      '--script',
      path.join(HERE, `${NAME}.lua`),
    ]);

    // the export of the guide: --split-layers before the file, trimmed, the empty cels left out,
    // every picture named `{layer}#{frame}`; packed, two pixels apart, a picture that repeats once,
    // and the edge of each picture carried into its padding for linear filtering
    out.path(`${NAME}.png`);
    out.path(`${NAME}.json`);
    aseprite(
      [
        '-b',
        '--split-layers',
        '--trim',
        '--ignore-empty',
        file,
        '--sheet',
        `${NAME}.png`,
        '--sheet-type',
        'packed',
        '--shape-padding',
        '2',
        '--extrude',
        '--merge-duplicates',
        '--data',
        `${NAME}.json`,
        '--format',
        'json-array',
        '--filename-format',
        '{layer}#{frame}',
        '--list-layers',
        '--list-tags',
        '--list-slices',
      ],
      out.dir,
    );
  } finally {
    fs.rmSync(work, {recursive: true, force: true});
  }

  const json = JSON.parse(fs.readFileSync(path.join(out.dir, `${NAME}.json`), 'utf8'));
  check(
    json.meta.size.w <= 4096 && json.meta.size.h <= 4096,
    `the sheet fits 4096 × 4096, got ${json.meta.size.w} × ${json.meta.size.h}`,
  );
  check(
    json.frames.every(
      (/** @type {{sourceSize: {w: number, h: number}}} */ f) =>
        f.sourceSize.w === CANVAS.width && f.sourceSize.h === CANVAS.height,
    ),
    `every picture lies on the canvas of ${CANVAS.width} × ${CANVAS.height}`,
  );
  const names = GROUPS.flatMap((g) => g.layers);
  const listed = json.meta.layers.map((/** @type {{name: string}} */ l) => l.name);
  check(
    names.every((name) => listed.filter((n) => n === name).length === 1),
    `the sheet lists each of the ${names.length} layers once, and no group is named like a layer`,
  );
  check(json.meta.frameTags.length === 1, 'the sheet lists the tag of the ripples');
  check(json.meta.slices.length === slices.length, 'the sheet lists the pivot slice of the train light');
}
