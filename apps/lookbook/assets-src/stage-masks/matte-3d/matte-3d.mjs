// stage-masks/matte-3d: "Mirror, Mirror", the art of the demo stage-masks-matte-3d — an antique
// bathroom at night and the same bathroom as the world inside its mirror, rendered by Blender from
// one camera (`blender_bathroom.py`), so the two pictures lie exactly over each other. The 3D
// shards and the ring of the mask are no asset: the demo builds them as meshes at run time.
// README.md documents every file.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ASSETS_SRC} from '../../lib/output.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'matte-3d';
const HERE = path.join(ASSETS_SRC, 'stage-masks', DIR);
const CACHE = path.join(HERE, '.render-cache');

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(blender(), ['-b', '--factory-startup', '--python', path.join(HERE, 'blender_bathroom.py'), '--', CACHE], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0)
    throw new Error(`blender failed (${run.status}):\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
}

/** @param {string} name */
const webp = (name) =>
  sharp(path.join(CACHE, `${name}.png`))
    .toColourspace('srgb')
    .removeAlpha()
    .webp({quality: 90, effort: 6, smartSubsample: true})
    .toBuffer();

/**
 * @param {Output} out
 * @param {{skipRender?: boolean}} [opts]
 */
export async function generate(out, opts = {}) {
  const cached = fs.existsSync(path.join(CACHE, 'layout.json'));
  if (!opts.skipRender || !cached) render();
  out.bytes(`${DIR}/bathroom.webp`, await webp('bathroom'));
  out.bytes(`${DIR}/reflection.webp`, await webp('reflection'));
  out.json(`${DIR}/layout.json`, JSON.parse(fs.readFileSync(path.join(CACHE, 'layout.json'), 'utf8')));
}
