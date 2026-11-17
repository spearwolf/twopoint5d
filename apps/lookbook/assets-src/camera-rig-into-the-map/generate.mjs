// camera-rig-into-the-map: "Station 4", the assets of the demo camera-rig-into-the-map — a sheet of a
// field survey of a dry basin and the place it marks, both built in Blender
// (`blender_survey.py`): the map rendered top down as flat ink on paper, written here as a WebP
// with its layout in a JSON file, and station 4 as a diorama whose light is baked into one texture,
// exported as a `.glb` with one camera. README.md documents the files.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ASSETS_SRC, check} from '../lib/output.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

const HERE = path.join(ASSETS_SRC, 'camera-rig-into-the-map');
const CACHE = path.join(HERE, '.render-cache');
const GLB = 'station.glb';
const MAP_PNG = 'survey-map.png';
const MAP_JSON = 'survey-map.json';

/** The names the demo looks up in the `.glb`. */
const CAMERA = 'camera_station';
const LAMP = 'mast_lamp';

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(
    blender(),
    ['-b', '--factory-startup', '--python-exit-code', '1', '--python', path.join(HERE, 'blender_survey.py'), '--', CACHE],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (run.status !== 0)
    throw new Error(`blender failed (${run.status}):\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
}

/**
 * The JSON chunk of a binary glTF.
 * @param {Buffer} glb
 * @returns {{nodes: {name?: string, camera?: number}[], cameras: {type: string, perspective?: {aspectRatio?: number}}[], animations?: unknown[], extensionsUsed?: string[]}}
 */
function gltfJson(glb) {
  check(glb.readUInt32LE(0) === 0x46546c67, `${GLB} is a binary glTF`);
  const length = glb.readUInt32LE(12);
  check(glb.readUInt32LE(16) === 0x4e4f534a, `${GLB} starts with its JSON chunk`);
  return JSON.parse(glb.subarray(20, 20 + length).toString('utf8'));
}

/**
 * @param {Output} out
 * @param {{skipRender?: boolean}} [opts]
 */
export async function generate(out, opts = {}) {
  const cached = [GLB, MAP_PNG, MAP_JSON].every((file) => fs.existsSync(path.join(CACHE, file)));
  if (!opts.skipRender || !cached) render();

  const glb = fs.readFileSync(path.join(CACHE, GLB));
  const json = gltfJson(glb);
  check(json.cameras.length === 1, `${GLB} has one camera, ${CAMERA}`);
  const index = json.nodes.find((n) => n.name === CAMERA)?.camera;
  check(index !== undefined, `${GLB} has a camera node named ${CAMERA}`);
  const camera = json.cameras[index];
  check(camera?.type === 'perspective' && camera.perspective?.aspectRatio, `${CAMERA} is a perspective camera with its aspect`);
  check(
    json.nodes.some((n) => n.name === LAMP),
    `${GLB} has the node ${LAMP}`,
  );
  check(!json.animations?.length, `${GLB} has no animation`);
  check(json.extensionsUsed?.includes('KHR_materials_unlit'), `${GLB} carries its light baked, in an unlit material`);
  out.bytes(GLB, glb);

  /** @type {{width: number, height: number, station: {x: number, y: number, unitsPerMetre: number}, route: [number, number][]}} */
  const map = JSON.parse(fs.readFileSync(path.join(CACHE, MAP_JSON), 'utf8'));
  check(map.width === 1600 && map.height === 900, `${MAP_JSON} is a sheet of 1600 × 900 units`);
  check(map.route.length > 100, `${MAP_JSON} has the route of the field party`);
  const png = path.join(CACHE, MAP_PNG);
  const {width, height} = await sharp(png).metadata();
  check(width === map.width * 2 && height === map.height * 2, `${MAP_PNG} has two pixels per unit`);
  out.bytes('survey-map.webp', await sharp(png).webp({quality: 88, effort: 6}).toBuffer());
  out.json(MAP_JSON, map);
}
