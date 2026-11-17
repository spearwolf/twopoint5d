// camera-rig-two-rooms: "The Night Shift", the asset of the demo camera-rig-two-rooms — two rooms of
// an abandoned observatory joined by one door, built and lit in Blender (`blender_observatory.py`),
// its light baked into one texture, exported as a `.glb` with a camera in each room and a third
// camera animated through the door. README.md documents the file, its cameras and its clip.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ASSETS_SRC, check} from '../lib/output.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

const HERE = path.join(ASSETS_SRC, 'camera-rig-two-rooms');
const CACHE = path.join(HERE, '.render-cache');
const GLB = 'two-rooms.glb';

/** The names the demo looks the cameras and the clip up by. */
const CAMERAS = ['camera_control_room', 'camera_dome', 'camera_flight'];
const CLIP = 'through_the_door';

function blender() {
  const which = spawnSync('which', ['blender'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : '/usr/bin/blender';
}

function render() {
  fs.rmSync(CACHE, {recursive: true, force: true});
  const run = spawnSync(
    blender(),
    ['-b', '--factory-startup', '--python', path.join(HERE, 'blender_observatory.py'), '--', CACHE],
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
 * @returns {{nodes: {name?: string, camera?: number}[], cameras: {type: string, perspective?: {aspectRatio?: number}}[], animations: {name?: string, channels: {target: {node: number}}[]}[], extensionsUsed?: string[]}}
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
  const cached = fs.existsSync(path.join(CACHE, GLB));
  if (!opts.skipRender || !cached) render();
  const glb = fs.readFileSync(path.join(CACHE, GLB));
  const json = gltfJson(glb);
  check(json.cameras.length === CAMERAS.length, `${GLB} has the cameras ${CAMERAS.join(', ')} and no other`);
  for (const name of CAMERAS) {
    const index = json.nodes.find((n) => n.name === name)?.camera;
    check(index !== undefined, `${GLB} has a camera node named ${name}`);
    const camera = json.cameras[index];
    check(camera?.type === 'perspective' && camera.perspective?.aspectRatio, `${name} is a perspective camera with its aspect`);
  }
  const flight = json.nodes.findIndex((n) => n.name === 'camera_flight');
  const clip = json.animations.find((a) => a.name === CLIP);
  check(
    clip?.channels.every((c) => c.target.node === flight),
    `${GLB} has the clip ${CLIP}, and it moves camera_flight alone`,
  );
  check(json.extensionsUsed?.includes('KHR_materials_unlit'), `${GLB} carries its light baked, in an unlit material`);
  out.bytes(GLB, glb);
}
