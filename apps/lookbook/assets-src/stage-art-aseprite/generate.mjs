// stage-art-aseprite: "the night-shift machine", the art of the demo stage-art-aseprite — a vending
// machine on a street at night, odd goods behind its glass, a cat and a moth. One Aseprite file is
// the layout: `paint.mjs` paints the pictures, `vending-machine.lua` lays them out in Aseprite as
// layers in groups, with a tag per loop and a pivot slice per moving part, and Aseprite exports the
// file as the guide tells a user to (packages/twopoint5d/docs/stage-art.md, "A scene out of an
// Aseprite file"). README.md documents the files and the layers.
//
// Needs the Aseprite binary: the one ASEPRITE names, else `aseprite` on the PATH.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {encodePng} from '../lib/png.mjs';
import {ASSETS_SRC, check} from '../lib/output.mjs';
import {TrueTypeFont} from '../lib/ttf.mjs';
import {CANVAS, paintScene} from './paint.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */
/** @typedef {import('./paint.mjs').SceneLayer} SceneLayer */
/** @typedef {import('./paint.mjs').SceneGroup} SceneGroup */

const HERE = path.join(ASSETS_SRC, 'stage-art-aseprite');
const FONT = path.join(ASSETS_SRC, 'shared/fonts/press-start-2p/PressStart2P-Regular.ttf');
const NAME = 'vending-machine';

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
      `stage-art-aseprite: no Aseprite binary at ${JSON.stringify(binary)} — set ASEPRITE to the path of the Aseprite binary, or put \`aseprite\` on the PATH`,
    );
  }
  if (run.error) throw run.error;
  if (run.status !== 0)
    throw new Error(`stage-art-aseprite: aseprite ${args.join(' ')} exited with ${run.status}\n${run.stdout}${run.stderr}`);
  return run.stdout;
}

/**
 * The layers of the scene as the Lua script reads them, their pictures written as PNGs into `dir`,
 * and a slice for each layer with a pivot.
 * @param {(SceneLayer | SceneGroup)[]} entries
 * @param {string} dir
 * @param {object[]} slices filled
 * @returns {object[]}
 */
function layoutOf(entries, dir, slices) {
  return entries.map((entry) => {
    if (entry.kind === 'group') return {group: entry.name, data: entry.data, layers: layoutOf(entry.children, dir, slices)};
    const cels = [...entry.cels].map(([frame, img]) => {
      check(img.opaqueBounds() !== undefined, `${entry.name} has a picture at frame ${frame}`);
      const file = `${entry.name}#${frame}.png`;
      img.clearTransparent();
      fs.writeFileSync(path.join(dir, file), encodePng(img.width, img.height, img.data));
      return {frame, file};
    });
    if (entry.pivot) {
      const [px, py] = entry.pivot;
      check(Number.isInteger(px) && Number.isInteger(py), `the pivot of ${entry.name} is a corner between pixels`);
      // the slice: the box of the picture at rest, grown to hold the pixel the pivot marks — the one
      // whose bottom left corner is the pivot
      const box = /** @type {{x: number, y: number, w: number, h: number}} */ (entry.cels.get(0)?.opaqueBounds());
      check(box !== undefined, `${entry.name} has a picture at rest`);
      const x0 = Math.min(box.x, px);
      const y0 = Math.min(box.y, py - 1);
      const x1 = Math.max(box.x + box.w, px + 1);
      const y1 = Math.max(box.y + box.h, py);
      slices.push({name: entry.name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, px: px - x0, py: py - 1 - y0});
    }
    return {name: entry.name, data: entry.data, cels};
  });
}

/**
 * @param {Output} out
 */
export async function generate(out) {
  const version = aseprite(['--version']).trim();
  check(version.startsWith('Aseprite 1.3'), `Aseprite 1.3 builds the file, got ${version}`);

  const scene = paintScene(new TrueTypeFont(FONT));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-art-aseprite-'));
  /** @type {object[]} */
  const slices = [];
  try {
    const layers = layoutOf(scene.root, work, slices);
    const layout = {width: CANVAS.width, height: CANVAS.height, durations: scene.durations, layers, tags: scene.tags, slices};
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
    // every picture named `{layer}#{frame}`; packed, two pixels apart, a picture that repeats once
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

  const sliceCount = slices.length;
  const json = JSON.parse(fs.readFileSync(path.join(out.dir, `${NAME}.json`), 'utf8'));
  check(
    json.meta.size.w <= 2048 && json.meta.size.h <= 2048,
    `the sheet fits 2048 × 2048, got ${json.meta.size.w} × ${json.meta.size.h}`,
  );
  check(
    json.frames.every(
      (/** @type {{sourceSize: {w: number, h: number}}} */ f) =>
        f.sourceSize.w === CANVAS.width && f.sourceSize.h === CANVAS.height,
    ),
    `every picture lies on the canvas of ${CANVAS.width} × ${CANVAS.height}`,
  );
  check(json.meta.frameTags.length === scene.tags.length, `the sheet lists the ${scene.tags.length} tags`);
  check(json.meta.slices.length === sliceCount, `the sheet lists the ${sliceCount} pivot slices`);
}
